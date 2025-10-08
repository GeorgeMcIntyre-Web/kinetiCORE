/**
 * URDF Exporter
 * Export kinematic devices to URDF format with coordinate conversion
 * Includes ZIP packaging with meshes
 */

import JSZip from 'jszip';
import {
  KinematicDevice,
  Joint,
  Link,
} from '../device/UnifiedDeviceDefinition';

export interface URDFExportResult {
  success: boolean;
  zipBlob?: Blob;
  urdf?: string;
  error?: string;
}

export class URDFExporter {
  /**
   * Export device to URDF format and download as ZIP
   */
  async exportAndDownload(device: KinematicDevice): Promise<URDFExportResult> {
    try {
      console.log(`[URDFExporter] Exporting device: ${device.name}`);

      // Generate URDF XML
      const urdf = this.generateURDFXML(device);

      // Create ZIP package
      const zipBlob = await this.createZipPackage(device, urdf);

      // Trigger download
      this.downloadZip(device.name, zipBlob);

      return {
        success: true,
        zipBlob,
        urdf,
      };
    } catch (error) {
      console.error('[URDFExporter] Export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate URDF XML document
   */
  private generateURDFXML(device: KinematicDevice): string {
    let xml = '<?xml version="1.0"?>\n';
    xml += `<robot name="${device.name}">\n\n`;

    // Export all links
    for (const link of device.links) {
      xml += this.generateLink(link);
    }

    // Export all joints
    for (const joint of device.joints) {
      xml += this.generateJoint(joint, device);
    }

    xml += '</robot>\n';
    return xml;
  }

  /**
   * Generate URDF link element
   */
  private generateLink(link: Link): string {
    let xml = `  <link name="${link.name}">\n`;

    // Visual
    xml += '    <visual>\n';
    xml += '      <geometry>\n';
    xml += `        <mesh filename="meshes/${link.name}.stl"/>\n`;
    xml += '      </geometry>\n';
    xml += `      <material name="${link.name}_material">\n`;
    xml += `        <color rgba="${this.colorToRGBA(link.material.color)}"/>\n`;
    xml += '      </material>\n';
    xml += '    </visual>\n';

    // Collision (same as visual for now)
    xml += '    <collision>\n';
    xml += '      <geometry>\n';
    xml += `        <mesh filename="meshes/${link.name}.stl"/>\n`;
    xml += '      </geometry>\n';
    xml += '    </collision>\n';

    // Inertial (if available)
    if (link.mass && link.inertia) {
      xml += '    <inertial>\n';
      xml += `      <mass value="${link.mass}"/>\n`;
      xml += '      <inertia';
      xml += ` ixx="${link.inertia.ixx}"`;
      xml += ` iyy="${link.inertia.iyy}"`;
      xml += ` izz="${link.inertia.izz}"`;
      xml += ` ixy="${link.inertia.ixy}"`;
      xml += ` ixz="${link.inertia.ixz}"`;
      xml += ` iyz="${link.inertia.iyz}"`;
      xml += '/>\n';
      xml += '    </inertial>\n';
    }

    xml += '  </link>\n\n';
    return xml;
  }

  /**
   * Generate URDF joint element
   */
  private generateJoint(joint: Joint, device: KinematicDevice): string {
    const parentLink = device.links.find(l => l.id === joint.parentLink);
    const childLink = device.links.find(l => l.id === joint.childLink);

    if (!parentLink || !childLink) {
      throw new Error(`Invalid joint links: ${joint.name}`);
    }

    let xml = `  <joint name="${joint.name}" type="${joint.type}">\n`;
    xml += `    <parent link="${parentLink.name}"/>\n`;
    xml += `    <child link="${childLink.name}"/>\n`;

    // Use joint parentFrame directly (already in user space: Z-up, mm)
    const pos = joint.parentFrame.origin;
    const posM = { x: pos.x * 0.001, y: pos.y * 0.001, z: pos.z * 0.001 }; // mm to m

    // For rotation, URDF uses RPY (roll-pitch-yaw)
    // For now, we'll use zero rotation and just translate
    xml += `    <origin xyz="${posM.x} ${posM.y} ${posM.z}" rpy="0 0 0"/>\n`;

    // Joint axis (only for revolute/prismatic)
    if (joint.type === 'revolute' || joint.type === 'prismatic') {
      const axis = joint.parentFrame.zAxis;
      xml += `    <axis xyz="${axis.x} ${axis.y} ${axis.z}"/>\n`;

      // Limits
      xml += '    <limit';
      xml += ` lower="${joint.limits.min}"`;
      xml += ` upper="${joint.limits.max}"`;
      xml += ` velocity="${joint.limits.velocity || 1.0}"`;
      xml += ` effort="${joint.limits.effort || 100}"`;
      xml += '/>\n';

      // Dynamics (if available)
      if (joint.damping !== undefined || joint.friction !== undefined) {
        xml += '    <dynamics';
        if (joint.damping !== undefined) {
          xml += ` damping="${joint.damping}"`;
        }
        if (joint.friction !== undefined) {
          xml += ` friction="${joint.friction}"`;
        }
        xml += '/>\n';
      }
    }

    xml += '  </joint>\n\n';
    return xml;
  }

  /**
   * Export mesh as STL
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
   * Create ZIP package with URDF and meshes
   */
  private async createZipPackage(device: KinematicDevice, urdf: string): Promise<Blob> {
    const zip = new JSZip();

    // Add main URDF file
    zip.file(`${device.name}.urdf`, urdf);

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
    a.download = `${deviceName}_urdf.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`[URDFExporter] Downloaded: ${deviceName}_urdf.zip`);
  }

  /**
   * Convert color to RGBA string
   */
  private colorToRGBA(color: { r: number; g: number; b: number; a: number }): string {
    return `${color.r} ${color.g} ${color.b} ${color.a}`;
  }
}
