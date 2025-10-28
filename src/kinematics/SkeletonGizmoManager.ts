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
}

export interface SkeletonGizmoConfig {
  robotId: string;
  chainId: string;
  enabled: boolean;
  opacity: number;
  linkColor: BABYLON.Color3;
  showCoordinates: boolean;
  coordinateSize: number;
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
   * Build skeleton links by connecting consecutive joints
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

    // Connect consecutive joints
    for (let i = 0; i < movableJoints.length - 1; i++) {
      const startJoint = movableJoints[i];
      const endJoint = movableJoints[i + 1];

      const startPos = this.getJointWorldPosition(startJoint.id);
      const endPos = this.getJointWorldPosition(endJoint.id);

      if (startPos && endPos) {
        const direction = endPos.subtract(startPos);
        const length = direction.length();

        links.push({
          id: `link_${startJoint.id}_${endJoint.id}`,
          startJointId: startJoint.id,
          endJointId: endJoint.id,
          startPosition: startPos.clone(),
          endPosition: endPos.clone(),
          length,
          direction: direction.normalize(),
          mesh: null,
          material: null
        });
      }
    }

    this.skeletonLinks.set(config.robotId, links);
  }

  /**
   * Create cylinder meshes for skeleton links
   */
  private createSkeletonMeshes(config: SkeletonGizmoConfig): void {
    if (!this.scene) return;

    const links = this.skeletonLinks.get(config.robotId) || [];
    
    links.forEach(link => {
      if (link.length < 0.001) return; // Skip very short links

      // Create cylinder mesh
      const cylinder = BABYLON.MeshBuilder.CreateCylinder(
        `skeleton_link_${link.id}`,
        {
          height: link.length,
          diameter: 0.01, // 10mm diameter
          tessellation: 8
        },
        this.scene
      );

      // Position cylinder at midpoint
      const midpoint = link.startPosition.add(link.endPosition).scale(0.5);
      cylinder.position = midpoint;

      // Orient cylinder along link direction
      const upVector = new BABYLON.Vector3(0, 1, 0);
      const angle = Math.acos(BABYLON.Vector3.Dot(upVector, link.direction));
      const crossProduct = BABYLON.Vector3.Cross(upVector, link.direction).normalize();
      
      if (crossProduct.length() > 0.01) {
        cylinder.rotationQuaternion = BABYLON.Quaternion.RotationAxis(crossProduct, angle);
      }

      // Apply material
      const material = this.linkMaterial!.clone(`skeleton_mat_${link.id}`);
      material.diffuseColor = config.linkColor;
      material.alpha = config.opacity;
      cylinder.material = material;

      // Configure rendering
      cylinder.isPickable = false;
      cylinder.renderingGroupId = 2; // Render on top of robot
      cylinder.isVisible = config.enabled;

      link.mesh = cylinder;
      link.material = material;
    });
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
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.scene !== null;
  }
}