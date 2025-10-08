/**
 * MJCF Exporter
 * Export kinematic devices to MuJoCo XML format with real hardware specs
 * Includes ZIP packaging with meshes
 */

import JSZip from 'jszip';
import {
  KinematicDevice,
  HardwareActuator,
  Joint,
  Link,
} from '../device/UnifiedDeviceDefinition';

// Note: Frame data is already in user space (Z-up, mm), so no coordinate conversion needed.
// MJCF also uses Z-up convention, we only need unit conversion (mm → m).

export interface MJCFExportResult {
  success: boolean;
  zipBlob?: Blob;
  xml?: string;
  error?: string;
}

export class MJCFExporter {
  /**
   * Export device to MJCF format and download as ZIP
   */
  async exportAndDownload(device: KinematicDevice): Promise<MJCFExportResult> {
    try {
      console.log(`[MJCFExporter] Exporting device: ${device.name}`);

      // Generate MJCF XML
      const xml = this.generateMJCFXML(device);

      // Create ZIP package
      const zipBlob = await this.createZipPackage(device, xml);

      // Trigger download
      this.downloadZip(device.name, zipBlob);

      return {
        success: true,
        zipBlob,
        xml,
      };
    } catch (error) {
      console.error('[MJCFExporter] Export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate MJCF XML document
   */
  private generateMJCFXML(device: KinematicDevice): string {
    let xml = '<?xml version="1.0"?>\n';
    xml += `<mujoco model="${device.name}">\n\n`;

    // Compiler settings
    xml += '  <compiler angle="radian" meshdir="meshes"/>\n\n';

    // Options
    xml += '  <option timestep="0.002" gravity="0 0 -9.81"/>\n\n';

    // Assets (mesh files)
    xml += '  <asset>\n';
    for (const link of device.links) {
      xml += `    <mesh name="${link.name}_mesh" file="${link.name}.stl"/>\n`;
    }
    xml += '  </asset>\n\n';

    // World body
    xml += '  <worldbody>\n';
    xml += this.generateBodyTree(device);
    xml += '  </worldbody>\n\n';

    // Actuators (THE MOST IMPORTANT PART!)
    if (device.actuators && device.actuators.length > 0) {
      xml += '  <actuator>\n';
      xml += this.generateActuators(device);
      xml += '  </actuator>\n\n';
    }

    xml += '</mujoco>\n';
    return xml;
  }

  /**
   * Generate body tree (links and joints)
   */
  private generateBodyTree(device: KinematicDevice): string {
    let xml = '';

    // Find base link
    const baseLink = device.links.find(l => l.id === device.baseLink);
    if (!baseLink) {
      throw new Error('Base link not found');
    }

    // Generate base body
    xml += `    <body name="${baseLink.name}" pos="0 0 0">\n`;
    xml += `      <geom type="mesh" mesh="${baseLink.name}_mesh" rgba="${this.colorToRGBA(baseLink.material.color)}"/>\n`;

    // Generate child bodies recursively
    xml += this.generateChildBodies(device, baseLink.id, 3);

    xml += '    </body>\n';
    return xml;
  }

  /**
   * Generate child bodies recursively
   */
  private generateChildBodies(
    device: KinematicDevice,
    parentLinkId: string,
    indent: number
  ): string {
    let xml = '';
    const ind = '  '.repeat(indent);

    // Find joints with this parent
    const childJoints = device.joints.filter(j => j.parentLink === parentLinkId);

    for (const joint of childJoints) {
      const childLink = device.links.find(l => l.id === joint.childLink);
      if (!childLink) continue;

      // Convert joint position from Babylon (Y-up, m) to MJCF (Z-up, m)
      // Frame is already in user space (Z-up, mm), just convert units
      const pos = joint.parentFrame.origin;
      const posM = { x: pos.x * 0.001, y: pos.y * 0.001, z: pos.z * 0.001 }; // mm to m

      xml += `${ind}<body name="${childLink.name}" pos="${posM.x} ${posM.y} ${posM.z}">\n`;

      // Joint
      xml += this.generateJoint(joint, indent + 1);

      // Geometry
      xml += `${ind}  <geom type="mesh" mesh="${childLink.name}_mesh" rgba="${this.colorToRGBA(childLink.material.color)}"/>\n`;

      // Recursively add children
      xml += this.generateChildBodies(device, childLink.id, indent + 1);

      xml += `${ind}</body>\n`;
    }

    return xml;
  }

  /**
   * Generate MJCF joint element
   */
  private generateJoint(joint: Joint, indent: number): string {
    const ind = '  '.repeat(indent);
    let xml = '';

    const type = joint.type === 'revolute' ? 'hinge' :
                 joint.type === 'prismatic' ? 'slide' : 'fixed';

    // Frame is already in user space (Z-up)
    const axis = `${joint.parentFrame.zAxis.x} ${joint.parentFrame.zAxis.y} ${joint.parentFrame.zAxis.z}`;
    const range = `${joint.limits.min} ${joint.limits.max}`;

    xml += `${ind}<joint name="${joint.name}" type="${type}"`;

    if (type !== 'fixed') {
      xml += ` axis="${axis}"`;
      xml += ` range="${range}"`;

      if (joint.damping !== undefined) {
        xml += ` damping="${joint.damping}"`;
      }
      if (joint.friction !== undefined) {
        xml += ` frictionloss="${joint.friction}"`;
      }
    }

    xml += '/>\n';
    return xml;
  }

  /**
   * Generate actuators (CORE MJCF FEATURE!)
   */
  private generateActuators(device: KinematicDevice): string {
    let xml = '';

    if (!device.actuators) return xml;

    for (const actuator of device.actuators) {
      xml += this.generateActuator(actuator, device);
    }

    return xml;
  }

  /**
   * Generate single actuator element
   */
  private generateActuator(actuator: HardwareActuator, device: KinematicDevice): string {
    let xml = '';

    // Each joint gets an actuator element
    for (const coord of actuator.coordination) {
      const joint = device.joints.find(j => j.id === coord.jointId);
      if (!joint) continue;

      const actuatorName = `${actuator.name}_${joint.name}`;

      switch (actuator.controlMode) {
        case 'position':
          xml += this.generatePositionActuator(actuatorName, joint.name, actuator, coord.ratio);
          break;

        case 'velocity':
          xml += this.generateVelocityActuator(actuatorName, joint.name, actuator);
          break;

        case 'force':
        case 'motor':
          xml += this.generateMotorActuator(actuatorName, joint.name, actuator, coord.ratio);
          break;
      }
    }

    return xml;
  }

  /**
   * Generate position actuator (servo control)
   */
  private generatePositionActuator(
    name: string,
    jointName: string,
    actuator: HardwareActuator,
    ratio: number
  ): string {
    const specs = actuator.specs;
    const ind = '    ';

    let xml = `${ind}<position name="${name}" joint="${jointName}"`;

    if (specs.kp !== undefined) {
      xml += ` kp="${specs.kp}"`;
    }

    xml += ` forcerange="${specs.forceRange.min} ${specs.forceRange.max}"`;
    xml += ` ctrlrange="${specs.ctrlRange.min} ${specs.ctrlRange.max}"`;

    if (specs.gearRatio !== undefined && ratio !== 1.0) {
      xml += ` gear="${specs.gearRatio * ratio}"`;
    } else if (specs.gearRatio !== undefined) {
      xml += ` gear="${specs.gearRatio}"`;
    }

    xml += '/>\n';

    // Add comment with hardware info
    if (actuator.manufacturer && actuator.modelNumber) {
      xml += `${ind}<!-- ${actuator.manufacturer} ${actuator.modelNumber} -->\n`;
    }

    return xml;
  }

  /**
   * Generate velocity actuator
   */
  private generateVelocityActuator(
    name: string,
    jointName: string,
    actuator: HardwareActuator
  ): string {
    const specs = actuator.specs;
    const ind = '    ';

    let xml = `${ind}<velocity name="${name}" joint="${jointName}"`;

    if (specs.kv !== undefined) {
      xml += ` kv="${specs.kv}"`;
    }

    xml += ` forcerange="${specs.forceRange.min} ${specs.forceRange.max}"`;

    if (specs.gearRatio !== undefined) {
      xml += ` gear="${specs.gearRatio}"`;
    }

    xml += '/>\n';
    return xml;
  }

  /**
   * Generate motor actuator (force/torque control)
   */
  private generateMotorActuator(
    name: string,
    jointName: string,
    actuator: HardwareActuator,
    ratio: number
  ): string {
    const specs = actuator.specs;
    const ind = '    ';

    let xml = `${ind}<motor name="${name}" joint="${jointName}"`;

    const gear = specs.gearRatio !== undefined ? specs.gearRatio * ratio : ratio * 100;
    xml += ` gear="${gear}"`;

    xml += ` ctrllimited="true"`;
    xml += ` ctrlrange="${specs.forceRange.min} ${specs.forceRange.max}"`;

    xml += '/>\n';
    return xml;
  }

  /**
   * Export meshes as STL files
   */
  private exportMeshAsSTL(link: Link): string {
    let stl = `solid ${link.name}\n`;

    const vertices = link.geometry.vertices;
    const indices = link.geometry.indices;
    const normals = link.geometry.normals;

    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i] * 3;
      const i2 = indices[i + 1] * 3;
      const i3 = indices[i + 2] * 3;

      const nx = normals[i1] || 0;
      const ny = normals[i1 + 1] || 0;
      const nz = normals[i1 + 2] || 0;

      stl += `  facet normal ${nx} ${ny} ${nz}\n`;
      stl += '    outer loop\n';
      stl += `      vertex ${vertices[i1]} ${vertices[i1 + 1]} ${vertices[i1 + 2]}\n`;
      stl += `      vertex ${vertices[i2]} ${vertices[i2 + 1]} ${vertices[i2 + 2]}\n`;
      stl += `      vertex ${vertices[i3]} ${vertices[i3 + 1]} ${vertices[i3 + 2]}\n`;
      stl += '    endloop\n';
      stl += '  endfacet\n';
    }

    stl += `endsolid ${link.name}\n`;
    return stl;
  }

  /**
   * Create ZIP package with XML and meshes
   */
  private async createZipPackage(device: KinematicDevice, xml: string): Promise<Blob> {
    const zip = new JSZip();

    // Add main XML file
    zip.file(`${device.name}.xml`, xml);

    // Create meshes folder
    const meshesFolder = zip.folder('meshes');
    if (!meshesFolder) {
      throw new Error('Failed to create meshes folder');
    }

    // Add mesh files
    for (const link of device.links) {
      const stlData = this.exportMeshAsSTL(link);
      meshesFolder.file(`${link.name}.stl`, stlData);
    }

    // Generate ZIP blob
    return await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
    });
  }

  /**
   * Trigger browser download of ZIP file
   */
  private downloadZip(deviceName: string, zipBlob: Blob): void {
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deviceName}_mjcf.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`[MJCFExporter] Downloaded: ${deviceName}_mjcf.zip`);
  }

  /**
   * Convert color to RGBA string
   */
  private colorToRGBA(color: { r: number; g: number; b: number; a: number }): string {
    return `${color.r} ${color.g} ${color.b} ${color.a}`;
  }
}
