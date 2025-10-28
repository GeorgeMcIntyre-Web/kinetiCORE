/**
 * Skeleton Gizmo Manager
 * Owner: Edwin (Agent 3)
 * 
 * Provides robot skeleton visualization by drawing cylinders between joint origins
 * Integrates with existing motion panel and joint widget system
 */

import * as BABYLON from '@babylonjs/core';
import { KinematicsManager } from './KinematicsManager';
import { SceneTreeManager } from '../scene/SceneTreeManager';

export interface SkeletonLink {
  id: string;
  startJointId: string;
  endJointId: string;
  startPosition: BABYLON.Vector3;
  endPosition: BABYLON.Vector3;
  length: number;
  direction: BABYLON.Vector3;
  mesh: BABYLON.Mesh | null;
  material: BABYLON.StandardMaterial | null;
  isActive: boolean;
  jointType: string;
  linkInfo?: {
    length: number;
    angle: number;
    jointName: string;
  };
}

export interface SkeletonGizmoConfig {
  robotId: string;
  chainId: string;
  enabled: boolean;
  opacity: number;
  linkColor: BABYLON.Color3;
  showCoordinates: boolean;
  coordinateSize: number;
  linkStyle: 'cylinder' | 'line' | 'tube';
  linkThickness: number;
  showLinkInfo: boolean;
  highlightActiveJoints: boolean;
  animationSpeed: number;
}

export class SkeletonGizmoManager {
  private static instance: SkeletonGizmoManager | null = null;
  private scene: BABYLON.Scene | null = null;
  private kinematicsManager: KinematicsManager;
  private treeManager: SceneTreeManager;
  
  // Skeleton state
  private activeSkeletons: Map<string, SkeletonGizmoConfig> = new Map();
  private skeletonLinks: Map<string, SkeletonLink[]> = new Map();
  private coordinateLabels: Map<string, BABYLON.Mesh[]> = new Map();
  
  // Materials
  private linkMaterial: BABYLON.StandardMaterial | null = null;
  private coordinateMaterials: Map<string, BABYLON.StandardMaterial> = new Map();

  private constructor() {
    this.kinematicsManager = KinematicsManager.getInstance();
    this.treeManager = SceneTreeManager.getInstance();
  }

  static getInstance(): SkeletonGizmoManager {
    if (!SkeletonGizmoManager.instance) {
      SkeletonGizmoManager.instance = new SkeletonGizmoManager();
    }
    return SkeletonGizmoManager.instance;
  }

  /**
   * Initialize with scene
   */
  initialize(scene: BABYLON.Scene): void {
    this.scene = scene;
    this.createMaterials();
    console.log('[SkeletonGizmoManager] Initialized with scene');
  }

  /**
   * Create or update skeleton for a robot
   */
  createSkeleton(config: SkeletonGizmoConfig): void {
    if (!this.scene) {
      console.warn('[SkeletonGizmoManager] Scene not initialized');
      return;
    }

    // Remove existing skeleton if it exists
    this.removeSkeleton(config.robotId);

    // Store config
    this.activeSkeletons.set(config.robotId, { ...config });

    if (config.enabled) {
      this.buildSkeletonLinks(config);
      this.createSkeletonMeshes(config);
      
      if (config.showCoordinates) {
        this.createCoordinateLabels(config);
      }
    }

    console.log(`[SkeletonGizmoManager] Created skeleton for robot: ${config.robotId}`);
  }

  /**
   * Update skeleton visibility
   */
  updateSkeletonVisibility(robotId: string, enabled: boolean): void {
    const config = this.activeSkeletons.get(robotId);
    if (!config) return;

    config.enabled = enabled;
    
    const links = this.skeletonLinks.get(robotId) || [];
    links.forEach(link => {
      if (link.mesh) {
        link.mesh.isVisible = enabled;
      }
    });

    const labels = this.coordinateLabels.get(robotId) || [];
    labels.forEach(label => {
      label.isVisible = enabled && config.showCoordinates;
    });

    console.log(`[SkeletonGizmoManager] ${enabled ? 'Showed' : 'Hid'} skeleton for robot: ${robotId}`);
  }

  /**
   * Update skeleton when joints move
   */
  updateSkeleton(robotId: string): void {
    const config = this.activeSkeletons.get(robotId);
    if (!config || !config.enabled) return;

    // Rebuild links with current joint positions
    this.buildSkeletonLinks(config);
    this.updateSkeletonMeshes(config);
    
    if (config.showCoordinates) {
      this.updateCoordinateLabels(config);
    }
  }

  /**
   * Remove skeleton for a robot
   */
  removeSkeleton(robotId: string): void {
    // Remove links
    const links = this.skeletonLinks.get(robotId) || [];
    links.forEach(link => {
      if (link.mesh) {
        link.mesh.dispose();
      }
      if (link.material) {
        link.material.dispose();
      }
    });
    this.skeletonLinks.delete(robotId);

    // Remove coordinate labels
    const labels = this.coordinateLabels.get(robotId) || [];
    labels.forEach(label => {
      label.dispose();
    });
    this.coordinateLabels.delete(robotId);

    // Remove config
    this.activeSkeletons.delete(robotId);

    console.log(`[SkeletonGizmoManager] Removed skeleton for robot: ${robotId}`);
  }

  /**
   * Clear all skeletons
   */
  clearAll(): void {
    const robotIds = Array.from(this.activeSkeletons.keys());
    robotIds.forEach(id => this.removeSkeleton(id));
    console.log('[SkeletonGizmoManager] Cleared all skeletons');
  }

  /**
   * Build skeleton links by connecting consecutive joints with enhanced information
   */
  private buildSkeletonLinks(config: SkeletonGizmoConfig): void {
    const chains = this.kinematicsManager.getAllChains();
    const robotChain = chains.find(chain => 
      chain.joints.some((joint: any) => joint.id.startsWith(config.robotId))
    );

    if (!robotChain) {
      console.warn(`[SkeletonGizmoManager] No chain found for robot: ${config.robotId}`);
      return;
    }

    const joints = this.kinematicsManager.getChainJoints(robotChain.id);
    const movableJoints = joints.filter(joint => 
      joint.type === 'revolute' || joint.type === 'prismatic'
    );

    const links: SkeletonLink[] = [];

    // Connect consecutive joints with enhanced link information
    for (let i = 0; i < movableJoints.length - 1; i++) {
      const startJoint = movableJoints[i];
      const endJoint = movableJoints[i + 1];

      const startPos = this.getJointWorldPosition(startJoint.id);
      const endPos = this.getJointWorldPosition(endJoint.id);

      if (startPos && endPos) {
        const direction = endPos.subtract(startPos);
        const length = direction.length();
        const normalizedDirection = direction.normalize();

        // Calculate link angle relative to world axes
        const angle = Math.acos(Math.abs(normalizedDirection.y)) * (180 / Math.PI);

        // Determine if this joint is currently active (has non-zero velocity or recent movement)
        const isActive = this.isJointActive(startJoint.id);

        links.push({
          id: `link_${startJoint.id}_${endJoint.id}`,
          startJointId: startJoint.id,
          endJointId: endJoint.id,
          startPosition: startPos.clone(),
          endPosition: endPos.clone(),
          length,
          direction: normalizedDirection,
          mesh: null,
          material: null,
          isActive,
          jointType: startJoint.type,
          linkInfo: {
            length: length * 1000, // Convert to mm for display
            angle,
            jointName: startJoint.name || `Joint ${i + 1}`
          }
        });
      }
    }

    this.skeletonLinks.set(config.robotId, links);
  }

  /**
   * Check if a joint is currently active (moving or recently moved)
   */
  private isJointActive(jointId: string): boolean {
    const joint = this.kinematicsManager.getJoint(jointId);
    if (!joint) return false;

    // Check if joint has non-zero velocity
    if (joint.velocity && Math.abs(joint.velocity) > 0.001) {
      return true;
    }

    // Check if joint position has changed recently (simple heuristic)
    // This could be enhanced with a more sophisticated tracking system
    return false;
  }

  /**
   * Create meshes for skeleton links with multiple styles
   */
  private createSkeletonMeshes(config: SkeletonGizmoConfig): void {
    if (!this.scene) return;

    const links = this.skeletonLinks.get(config.robotId) || [];
    
    links.forEach(link => {
      if (link.length < 0.001) return; // Skip very short links

      let mesh: BABYLON.Mesh;
      const midpoint = link.startPosition.add(link.endPosition).scale(0.5);

      // Create mesh based on style preference
      switch (config.linkStyle) {
        case 'line':
          mesh = this.createLineMesh(link, config);
          break;
        case 'tube':
          mesh = this.createTubeMesh(link, config);
          break;
        case 'cylinder':
        default:
          mesh = this.createCylinderMesh(link, config);
          break;
      }

      // Position mesh at midpoint
      mesh.position = midpoint;

      // Orient mesh along link direction
      this.orientMeshAlongDirection(mesh, link.direction);

      // Apply material with enhanced properties
      const material = this.createLinkMaterial(link, config);
      mesh.material = material;

      // Configure rendering
      mesh.isPickable = false;
      mesh.renderingGroupId = 2; // Render on top of robot
      mesh.isVisible = config.enabled;

      // Add subtle animation for active joints
      if (config.highlightActiveJoints && link.isActive) {
        this.addJointHighlightAnimation(mesh, config.animationSpeed);
      }

      link.mesh = mesh;
      link.material = material;
    });
  }

  /**
   * Create cylinder mesh for link
   */
  private createCylinderMesh(link: SkeletonLink, config: SkeletonGizmoConfig): BABYLON.Mesh {
    return BABYLON.MeshBuilder.CreateCylinder(
      `skeleton_link_${link.id}`,
      {
        height: link.length,
        diameter: config.linkThickness,
        tessellation: 8
      },
      this.scene!
    );
  }

  /**
   * Create tube mesh for link (more detailed)
   */
  private createTubeMesh(link: SkeletonLink, config: SkeletonGizmoConfig): BABYLON.Mesh {
    const points = [
      link.startPosition,
      link.endPosition
    ];
    
    return BABYLON.MeshBuilder.CreateTube(
      `skeleton_tube_${link.id}`,
      {
        path: points,
        radius: config.linkThickness / 2,
        tessellation: 8,
        cap: BABYLON.Mesh.CAP_ALL
      },
      this.scene!
    );
  }

  /**
   * Create line mesh for link (lightweight)
   */
  private createLineMesh(link: SkeletonLink, _config: SkeletonGizmoConfig): BABYLON.Mesh {
    const points = [
      link.startPosition,
      link.endPosition
    ];
    
    return BABYLON.MeshBuilder.CreateLines(
      `skeleton_line_${link.id}`,
      {
        points: points,
        updatable: true
      },
      this.scene!
    );
  }

  /**
   * Orient mesh along direction vector
   */
  private orientMeshAlongDirection(mesh: BABYLON.Mesh, direction: BABYLON.Vector3): void {
    const upVector = new BABYLON.Vector3(0, 1, 0);
    const angle = Math.acos(BABYLON.Vector3.Dot(upVector, direction));
    const crossProduct = BABYLON.Vector3.Cross(upVector, direction).normalize();
    
    if (crossProduct.length() > 0.01) {
      mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(crossProduct, angle);
    }
  }

  /**
   * Create enhanced material for link
   */
  private createLinkMaterial(link: SkeletonLink, config: SkeletonGizmoConfig): BABYLON.StandardMaterial {
    const material = this.linkMaterial!.clone(`skeleton_mat_${link.id}`);
    material.diffuseColor = config.linkColor;
    material.alpha = config.opacity;
    
    // Enhanced visual properties
    if (link.isActive) {
      material.emissiveColor = config.linkColor.scale(0.3);
      material.specularColor = new BABYLON.Color3(1, 1, 1);
      material.specularPower = 64;
    }
    
    // Add subtle glow for better visibility
    material.disableLighting = false;
    material.useEmissiveAsIllumination = true;
    
    return material;
  }

  /**
   * Add highlight animation for active joints
   */
  private addJointHighlightAnimation(mesh: BABYLON.Mesh, speed: number): void {
    const animation = new BABYLON.Animation(
      `highlight_${mesh.name}`,
      'emissiveColor',
      30, // fps
      BABYLON.Animation.ANIMATIONTYPE_COLOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const keys = [
      { frame: 0, value: new BABYLON.Color3(0.2, 0.2, 0.2) },
      { frame: 30, value: new BABYLON.Color3(0.8, 0.8, 0.8) },
      { frame: 60, value: new BABYLON.Color3(0.2, 0.2, 0.2) }
    ];

    animation.setKeys(keys);
    mesh.animations.push(animation);
    
    if (this.scene) {
      this.scene.beginAnimation(mesh, 0, 60, true, speed);
    }
  }

  /**
   * Update skeleton meshes when joints move
   */
  private updateSkeletonMeshes(config: SkeletonGizmoConfig): void {
    const links = this.skeletonLinks.get(config.robotId) || [];
    
    links.forEach(link => {
      if (!link.mesh) return;

      // Update positions
      const startPos = this.getJointWorldPosition(link.startJointId);
      const endPos = this.getJointWorldPosition(link.endJointId);

      if (startPos && endPos) {
        const direction = endPos.subtract(startPos);
        const length = direction.length();

        if (length > 0.001) {
          // Update cylinder position and orientation
          const midpoint = startPos.add(endPos).scale(0.5);
          link.mesh.position = midpoint;

          const upVector = new BABYLON.Vector3(0, 1, 0);
          const angle = Math.acos(BABYLON.Vector3.Dot(upVector, direction.normalize()));
          const crossProduct = BABYLON.Vector3.Cross(upVector, direction.normalize()).normalize();
          
          if (crossProduct.length() > 0.01) {
            link.mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(crossProduct, angle);
          }

          // Update cylinder height
          link.mesh.scaling.y = length / 1.0; // Assuming original height is 1.0
        }
      }
    });
  }

  /**
   * Create coordinate labels for joint positions
   */
  private createCoordinateLabels(config: SkeletonGizmoConfig): void {
    if (!this.scene) return;

    const chains = this.kinematicsManager.getAllChains();
    const robotChain = chains.find(chain => 
      chain.joints.some((joint: any) => joint.id.startsWith(config.robotId))
    );

    if (!robotChain) return;

    const joints = this.kinematicsManager.getChainJoints(robotChain.id);
    const movableJoints = joints.filter(joint => 
      joint.type === 'revolute' || joint.type === 'prismatic'
    );

    const labels: BABYLON.Mesh[] = [];

    movableJoints.forEach((joint) => {
      const position = this.getJointWorldPosition(joint.id);
      if (!position) return;

      // Create coordinate axes (X=Red, Y=Green, Z=Blue)
      const axisLength = config.coordinateSize;
      
      // X axis (Red)
      const xAxis = BABYLON.MeshBuilder.CreateCylinder(
        `coord_x_${joint.id}`,
        { height: axisLength, diameter: 0.002 },
        this.scene
      );
      xAxis.position = position.add(new BABYLON.Vector3(axisLength/2, 0, 0));
      xAxis.rotation.z = Math.PI / 2;
      xAxis.material = this.getCoordinateMaterial('x');
      xAxis.isPickable = false;
      xAxis.renderingGroupId = 2;
      labels.push(xAxis);

      // Y axis (Green)
      const yAxis = BABYLON.MeshBuilder.CreateCylinder(
        `coord_y_${joint.id}`,
        { height: axisLength, diameter: 0.002 },
        this.scene
      );
      yAxis.position = position.add(new BABYLON.Vector3(0, axisLength/2, 0));
      yAxis.rotation.x = Math.PI / 2;
      yAxis.material = this.getCoordinateMaterial('y');
      yAxis.isPickable = false;
      yAxis.renderingGroupId = 2;
      labels.push(yAxis);

      // Z axis (Blue)
      const zAxis = BABYLON.MeshBuilder.CreateCylinder(
        `coord_z_${joint.id}`,
        { height: axisLength, diameter: 0.002 },
        this.scene
      );
      zAxis.position = position.add(new BABYLON.Vector3(0, 0, axisLength/2));
      zAxis.rotation.x = 0;
      zAxis.material = this.getCoordinateMaterial('z');
      zAxis.isPickable = false;
      zAxis.renderingGroupId = 2;
      labels.push(zAxis);
    });

    this.coordinateLabels.set(config.robotId, labels);
  }

  /**
   * Update coordinate labels when joints move
   */
  private updateCoordinateLabels(config: SkeletonGizmoConfig): void {
    const chains = this.kinematicsManager.getAllChains();
    const robotChain = chains.find(chain => 
      chain.joints.some((joint: any) => joint.id.startsWith(config.robotId))
    );

    if (!robotChain) return;

    const joints = this.kinematicsManager.getChainJoints(robotChain.id);
    const movableJoints = joints.filter(joint => 
      joint.type === 'revolute' || joint.type === 'prismatic'
    );

    const labels = this.coordinateLabels.get(config.robotId) || [];
    let labelIndex = 0;

    movableJoints.forEach((joint) => {
      const position = this.getJointWorldPosition(joint.id);
      if (!position || labelIndex >= labels.length) return;

      const axisLength = config.coordinateSize;
      
      // Update X axis
      if (labels[labelIndex]) {
        labels[labelIndex].position = position.add(new BABYLON.Vector3(axisLength/2, 0, 0));
        labelIndex++;
      }
      
      // Update Y axis
      if (labels[labelIndex]) {
        labels[labelIndex].position = position.add(new BABYLON.Vector3(0, axisLength/2, 0));
        labelIndex++;
      }
      
      // Update Z axis
      if (labels[labelIndex]) {
        labels[labelIndex].position = position.add(new BABYLON.Vector3(0, 0, axisLength/2));
        labelIndex++;
      }
    });
  }

  /**
   * Get world position of a joint
   */
  private getJointWorldPosition(jointId: string): BABYLON.Vector3 | null {
    const joint = this.kinematicsManager.getJoint(jointId);
    if (!joint) return null;

    const tree = this.treeManager;
    const parentNode = tree.getNode(joint.parentNodeId);
    if (!parentNode) return null;

    // Get parent's Babylon node
    let parentBabylonNode: BABYLON.TransformNode | null = null;
    if (parentNode.babylonMeshId) {
      parentBabylonNode = this.scene!.getMeshByUniqueId(parseInt(parentNode.babylonMeshId)) as BABYLON.TransformNode;
    }
    if (!parentBabylonNode && parentNode.babylonTransformNodeId) {
      parentBabylonNode = this.scene!.transformNodes.find(tn =>
        tn.uniqueId === parseInt(parentNode.babylonTransformNodeId!)
      ) || null;
    }
    if (!parentBabylonNode && parentNode.type === 'collection') {
      parentBabylonNode = this.scene!.transformNodes.find(tn => tn.name === parentNode.name) || null;
    }

    if (!parentBabylonNode) return null;

    // Joint origin in parent's local space
    const jointOriginLocal = new BABYLON.Vector3(
      joint.origin.x,
      joint.origin.y,
      joint.origin.z
    );

    // Transform to world space
    parentBabylonNode.computeWorldMatrix(true);
    const parentWorldMatrix = parentBabylonNode.getWorldMatrix();
    const jointOriginWorld = BABYLON.Vector3.TransformCoordinates(
      jointOriginLocal,
      parentWorldMatrix
    );

    return jointOriginWorld;
  }

  /**
   * Create materials for skeleton visualization
   */
  private createMaterials(): void {
    if (!this.scene) return;

    // Link material
    this.linkMaterial = new BABYLON.StandardMaterial('skeleton_link_mat', this.scene);
    this.linkMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.8, 1.0); // Cyan
    this.linkMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.5);
    this.linkMaterial.disableLighting = true;
    this.linkMaterial.alpha = 0.8;

    // Coordinate materials
    this.coordinateMaterials.set('x', this.createCoordinateMaterial('x'));
    this.coordinateMaterials.set('y', this.createCoordinateMaterial('y'));
    this.coordinateMaterials.set('z', this.createCoordinateMaterial('z'));
  }

  /**
   * Create coordinate material for specific axis
   */
  private createCoordinateMaterial(axis: 'x' | 'y' | 'z'): BABYLON.StandardMaterial {
    if (!this.scene) throw new Error('Scene not initialized');

    const material = new BABYLON.StandardMaterial(`coord_${axis}_mat`, this.scene);
    
    switch (axis) {
      case 'x':
        material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red
        material.emissiveColor = new BABYLON.Color3(0.5, 0, 0);
        break;
      case 'y':
        material.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green
        material.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        break;
      case 'z':
        material.diffuseColor = new BABYLON.Color3(0, 0, 1); // Blue
        material.emissiveColor = new BABYLON.Color3(0, 0, 0.5);
        break;
    }
    
    material.disableLighting = true;
    material.alpha = 0.9;
    return material;
  }

  /**
   * Get coordinate material for axis
   */
  private getCoordinateMaterial(axis: 'x' | 'y' | 'z'): BABYLON.StandardMaterial {
    return this.coordinateMaterials.get(axis) || this.createCoordinateMaterial(axis);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.clearAll();
    
    if (this.linkMaterial) {
      this.linkMaterial.dispose();
    }
    
    this.coordinateMaterials.forEach(material => material.dispose());
    this.coordinateMaterials.clear();
    
    this.scene = null;
    console.log('[SkeletonGizmoManager] Disposed');
  }

  /**
   * Get skeleton information for a robot (for tooltips, debugging, etc.)
   */
  getSkeletonInfo(robotId: string): {
    linkCount: number;
    totalLength: number;
    activeLinks: number;
    links: SkeletonLink[];
  } | null {
    const links = this.skeletonLinks.get(robotId);
    if (!links) return null;

    const totalLength = links.reduce((sum, link) => sum + link.length, 0);
    const activeLinks = links.filter(link => link.isActive).length;

    return {
      linkCount: links.length,
      totalLength: totalLength * 1000, // Convert to mm
      activeLinks,
      links: links.map(link => ({
        ...link,
        // Remove mesh references for serialization
        mesh: null,
        material: null
      }))
    };
  }

  /**
   * Get link information for tooltip display
   */
  getLinkInfo(robotId: string, linkId: string): SkeletonLink | null {
    const links = this.skeletonLinks.get(robotId);
    if (!links) return null;

    const link = links.find(l => l.id === linkId);
    if (!link) return null;

    return {
      ...link,
      mesh: null,
      material: null
    };
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.scene !== null;
  }
}