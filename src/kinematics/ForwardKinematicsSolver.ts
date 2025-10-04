// Forward Kinematics Solver
// Owner: George
// Calculates mesh transforms based on joint values

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../scene/SceneManager';
import { SceneTreeManager } from '../scene/SceneTreeManager';
import { EntityRegistry } from '../entities/EntityRegistry';
import { KinematicsManager, JointConfig } from './KinematicsManager';

/**
 * Forward Kinematics Solver
 * Updates mesh transforms based on joint values
 */
export class ForwardKinematicsSolver {
  private static instance: ForwardKinematicsSolver | null = null;
  private kinematicsManager: KinematicsManager;
  private sceneTreeManager: SceneTreeManager;
  private sceneManager: SceneManager;

  private constructor() {
    this.kinematicsManager = KinematicsManager.getInstance();
    this.sceneTreeManager = SceneTreeManager.getInstance();
    this.sceneManager = SceneManager.getInstance();
  }

  static getInstance(): ForwardKinematicsSolver {
    if (!ForwardKinematicsSolver.instance) {
      ForwardKinematicsSolver.instance = new ForwardKinematicsSolver();
    }
    return ForwardKinematicsSolver.instance;
  }

  /**
   * Update a single joint position and recalculate transforms
   */
  updateJointPosition(jointId: string, value: number): boolean {
    const joint = this.kinematicsManager.getJoint(jointId);
    if (!joint) {
      console.error(`Joint not found: ${jointId}`);
      return false;
    }

    // Clamp value to joint limits
    const clampedValue = Math.max(
      joint.limits.lower,
      Math.min(joint.limits.upper, value)
    );

    // Update joint state
    joint.position = clampedValue;

    // Update the scene tree node's joint data
    const childNode = this.sceneTreeManager.getNode(joint.childNodeId);
    if (childNode?.jointData) {
      childNode.jointData.currentValue =
        joint.type === 'revolute' ? (clampedValue * 180 / Math.PI) : clampedValue;
    }

    // Calculate and apply transform
    return this.applyJointTransform(joint);
  }

  /**
   * Apply joint transform to child mesh
   */
  private applyJointTransform(joint: JointConfig): boolean {
    const scene = this.sceneManager.getScene();
    if (!scene) return false;

    const parentNode = this.sceneTreeManager.getNode(joint.parentNodeId);
    const childNode = this.sceneTreeManager.getNode(joint.childNodeId);

    if (!parentNode || !childNode) return false;

    // Get Babylon meshes/transform nodes
    const parentBabylonNode = this.getBabylonNode(parentNode.id, scene);
    const childBabylonNode = this.getBabylonNode(childNode.id, scene);

    if (!parentBabylonNode || !childBabylonNode) {
      console.warn('Babylon nodes not found for joint:', joint.name);
      return false;
    }

    // Calculate transform based on joint type
    const transform = this.calculateJointTransform(joint);

    // Get joint origin in world space (from parent)
    parentBabylonNode.computeWorldMatrix(true);

    // Apply transform to child
    if (childBabylonNode.parent !== parentBabylonNode) {
      childBabylonNode.parent = parentBabylonNode;
    }

    // Set local transform relative to parent
    childBabylonNode.position.copyFrom(transform.position);
    childBabylonNode.rotationQuaternion = transform.rotation;

    // Sync to physics if entity exists
    if (childNode.entityId) {
      const registry = EntityRegistry.getInstance();
      const entity = registry.get(childNode.entityId);
      entity?.syncToPhysics();
    }

    // Recursively update child joints
    this.updateChildJoints(joint.childNodeId);

    return true;
  }

  /**
   * Calculate transform for a joint based on its type and current value
   */
  private calculateJointTransform(joint: JointConfig): {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } {
    const position = new BABYLON.Vector3(
      joint.origin.x * 0.001, // mm to meters
      joint.origin.y * 0.001,
      joint.origin.z * 0.001
    );

    let rotation = BABYLON.Quaternion.Identity();

    switch (joint.type) {
      case 'revolute': {
        // Rotate around joint axis
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        rotation = BABYLON.Quaternion.RotationAxis(axis, joint.position);
        break;
      }

      case 'prismatic': {
        // Translate along joint axis
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        const translation = axis.scale(joint.position * 0.001); // mm to meters
        position.addInPlace(translation);
        break;
      }

      case 'fixed':
        // No movement
        break;

      case 'spherical': {
        // Ball joint - for now, interpret position as rotation around Z
        // TODO: Implement 3DOF spherical joint control
        const axis = BABYLON.Vector3.Up();
        rotation = BABYLON.Quaternion.RotationAxis(axis, joint.position);
        break;
      }

      case 'cylindrical': {
        // Combined rotation + translation
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();

        // Position controls translation (in mm)
        const translation = axis.scale(joint.position * 0.001);
        position.addInPlace(translation);

        // TODO: Add rotation component (needs second DOF control)
        break;
      }

      case 'planar': {
        // 2D motion in plane
        // TODO: Implement full planar joint (needs 2 translation DOFs)
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        const translation = axis.scale(joint.position * 0.001);
        position.addInPlace(translation);
        break;
      }
    }

    return { position, rotation };
  }

  /**
   * Recursively update all child joints in the kinematic chain
   */
  private updateChildJoints(nodeId: string): void {
    const childJoints = this.kinematicsManager.getNodeJoints(nodeId);

    for (const childJoint of childJoints) {
      if (childJoint.parentNodeId === nodeId) {
        this.applyJointTransform(childJoint);
      }
    }
  }

  /**
   * Update entire kinematic chain with joint values
   */
  solveChain(jointValues: Map<string, number>): boolean {
    let success = true;

    for (const [jointId, value] of jointValues.entries()) {
      if (!this.updateJointPosition(jointId, value)) {
        success = false;
      }
    }

    return success;
  }

  /**
   * Reset all joints to zero position
   */
  resetToHome(): void {
    const joints = this.kinematicsManager.getAllJoints();

    for (const joint of joints) {
      this.updateJointPosition(joint.id, 0);
    }
  }

  /**
   * Get Babylon node (Mesh or TransformNode) from scene tree node ID
   */
  private getBabylonNode(
    nodeId: string,
    scene: BABYLON.Scene
  ): BABYLON.TransformNode | null {
    const node = this.sceneTreeManager.getNode(nodeId);
    if (!node) return null;

    // Try as mesh first
    if (node.babylonMeshId) {
      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
      if (mesh) return mesh;
    }

    // Try as TransformNode (collection)
    if (node.type === 'collection') {
      const transformNode = scene.transformNodes.find(tn => tn.name === node.name);
      if (transformNode) return transformNode;
    }

    return null;
  }

  /**
   * Animate joint through its range of motion
   */
  animateJoint(
    jointId: string,
    duration: number = 2000,
    onUpdate?: (value: number) => void
  ): void {
    const joint = this.kinematicsManager.getJoint(jointId);
    if (!joint) return;

    const scene = this.sceneManager.getScene();
    if (!scene) return;

    const startValue = joint.position;
    const endValue = joint.limits.upper;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentValue = startValue + (endValue - startValue) * eased;

      this.updateJointPosition(jointId, currentValue);

      if (onUpdate) {
        onUpdate(currentValue);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Return to start
        setTimeout(() => {
          this.updateJointPosition(jointId, startValue);
        }, 500);
      }
    };

    animate();
  }

  /**
   * Get current joint values as array (for export/saving)
   */
  getJointValues(): Map<string, number> {
    const values = new Map<string, number>();
    const joints = this.kinematicsManager.getAllJoints();

    for (const joint of joints) {
      values.set(joint.id, joint.position);
    }

    return values;
  }

  /**
   * Set joint values from saved state
   */
  setJointValues(values: Map<string, number>): void {
    for (const [jointId, value] of values.entries()) {
      this.updateJointPosition(jointId, value);
    }
  }
}
