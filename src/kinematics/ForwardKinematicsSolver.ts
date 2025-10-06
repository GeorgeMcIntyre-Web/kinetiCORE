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
  updateJointPosition(jointId: string, value: number, syncPhysics: boolean = true): boolean {
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
    return this.applyJointTransform(joint, syncPhysics);
  }

  /**
   * Apply joint transform to child mesh
   */
  private applyJointTransform(joint: JointConfig, syncPhysics: boolean = true): boolean {
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

    // Sync to physics if entity exists (skip during initial FK solve to avoid Rapier errors)
    if (syncPhysics && childNode.entityId) {
      const registry = EntityRegistry.getInstance();
      const entity = registry.get(childNode.entityId);
      entity?.syncToPhysics();
    }

    // Recursively update child joints
    this.updateChildJoints(joint.childNodeId, syncPhysics);

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
      joint.origin.x, // Already in meters from URDF
      joint.origin.y,
      joint.origin.z
    );

    // Start with the origin rotation (base orientation from URDF)
    let rotation = joint.originRotation
      ? new BABYLON.Quaternion(
          joint.originRotation.x,
          joint.originRotation.y,
          joint.originRotation.z,
          joint.originRotation.w
        )
      : BABYLON.Quaternion.Identity();

    switch (joint.type) {
      case 'revolute': {
        // Rotate around joint axis by the current joint position
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        const jointRotation = BABYLON.Quaternion.RotationAxis(axis, joint.position);

        // Combine origin rotation with joint rotation
        rotation = rotation.multiply(jointRotation);
        break;
      }

      case 'prismatic': {
        // Translate along joint axis
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        const translation = axis.scale(joint.position); // Already in meters
        position.addInPlace(translation);
        break;
      }

      case 'fixed':
        // No movement, just use origin rotation
        break;

      case 'spherical': {
        // Ball joint - for now, interpret position as rotation around Z
        // TODO: Implement 3DOF spherical joint control
        const axis = BABYLON.Vector3.Up();
        const jointRotation = BABYLON.Quaternion.RotationAxis(axis, joint.position);
        rotation = rotation.multiply(jointRotation);
        break;
      }

      case 'cylindrical': {
        // Combined rotation + translation
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();

        // Position controls translation
        const translation = axis.scale(joint.position);
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
        const translation = axis.scale(joint.position);
        position.addInPlace(translation);
        break;
      }
    }

    return { position, rotation };
  }

  /**
   * Recursively update all child joints in the kinematic chain
   */
  private updateChildJoints(nodeId: string, syncPhysics: boolean = true): void {
    const childJoints = this.kinematicsManager.getNodeJoints(nodeId);

    for (const childJoint of childJoints) {
      if (childJoint.parentNodeId === nodeId) {
        this.applyJointTransform(childJoint, syncPhysics);
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

    // Try as TransformNode (collection) using uniqueId
    if (node.babylonTransformNodeId) {
      const transformNode = scene.transformNodes.find(tn => tn.uniqueId === parseInt(node.babylonTransformNodeId!));
      if (transformNode) return transformNode;
    }

    // Fallback: Try as TransformNode (collection) by name (for backward compatibility)
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

  /**
   * Compute forward kinematics up to a specific joint index
   * Returns pose at the specified joint given joint angles
   * @param chainName - Name of the kinematic chain
   * @param jointAngles - Array of all joint angles
   * @param upToJointIndex - Compute FK only up to this joint index (inclusive)
   */
  solveUpToJoint(
    chainName: string,
    jointAngles: number[],
    upToJointIndex: number
  ): {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } | null {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      console.error(`Chain not found: ${chainName}`);
      return null;
    }

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    if (joints.length !== jointAngles.length) {
      console.error(
        `Joint count mismatch: expected ${joints.length}, got ${jointAngles.length}`
      );
      return null;
    }

    if (upToJointIndex < 0 || upToJointIndex >= joints.length) {
      console.error(
        `Invalid joint index: ${upToJointIndex} (chain has ${joints.length} joints)`
      );
      return null;
    }

    // Start with identity transform at base
    let accumulatedTransform = BABYLON.Matrix.Identity();

    // Build transformation chain from base up to specified joint
    for (let i = 0; i <= upToJointIndex; i++) {
      const joint = joints[i];
      const angle = jointAngles[i];

      // Create origin translation matrix
      const originTranslation = BABYLON.Matrix.Translation(
        joint.origin.x,
        joint.origin.y,
        joint.origin.z
      );

      // Create origin rotation matrix
      let originRotation = BABYLON.Matrix.Identity();
      if (joint.originRotation) {
        const quat = new BABYLON.Quaternion(
          joint.originRotation.x,
          joint.originRotation.y,
          joint.originRotation.z,
          joint.originRotation.w
        );
        originRotation = BABYLON.Matrix.FromQuaternionToRef(
          quat,
          new BABYLON.Matrix()
        );
      }

      // Create joint rotation/translation matrix based on type
      let jointTransform = BABYLON.Matrix.Identity();

      if (joint.type === 'revolute') {
        // Rotation around axis
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        jointTransform = BABYLON.Matrix.RotationAxis(axis, angle);
      } else if (joint.type === 'prismatic') {
        // Translation along axis
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        const translation = axis.scale(angle);
        jointTransform = BABYLON.Matrix.Translation(
          translation.x,
          translation.y,
          translation.z
        );
      }

      // Combine: T = T_prev * T_origin * R_origin * T_joint
      const linkTransform = originTranslation
        .multiply(originRotation)
        .multiply(jointTransform);

      accumulatedTransform = accumulatedTransform.multiply(linkTransform);
    }

    // Extract position and rotation from accumulated transform
    const position = new BABYLON.Vector3(
      accumulatedTransform.m[12],
      accumulatedTransform.m[13],
      accumulatedTransform.m[14]
    );

    const rotation = BABYLON.Quaternion.FromRotationMatrix(accumulatedTransform);

    return { position, rotation };
  }

  /**
   * Compute forward kinematics for a kinematic chain
   * Returns end-effector pose given joint angles
   */
  solve(chainName: string, jointAngles: number[]): {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } | null {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      console.error(`Chain not found: ${chainName}`);
      return null;
    }

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    if (joints.length !== jointAngles.length) {
      console.error(
        `Joint count mismatch: expected ${joints.length}, got ${jointAngles.length}`
      );
      return null;
    }

    // Start with identity transform at base
    let accumulatedTransform = BABYLON.Matrix.Identity();

    // Build transformation chain from base to end-effector
    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i];
      const angle = jointAngles[i];

      // Create origin translation matrix
      const originTranslation = BABYLON.Matrix.Translation(
        joint.origin.x,
        joint.origin.y,
        joint.origin.z
      );

      // Create origin rotation matrix
      let originRotation = BABYLON.Matrix.Identity();
      if (joint.originRotation) {
        const quat = new BABYLON.Quaternion(
          joint.originRotation.x,
          joint.originRotation.y,
          joint.originRotation.z,
          joint.originRotation.w
        );
        originRotation = BABYLON.Matrix.FromQuaternionToRef(
          quat,
          new BABYLON.Matrix()
        );
      }

      // Create joint rotation/translation matrix based on type
      let jointTransform = BABYLON.Matrix.Identity();

      if (joint.type === 'revolute') {
        // Rotation around axis
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        jointTransform = BABYLON.Matrix.RotationAxis(axis, angle);
      } else if (joint.type === 'prismatic') {
        // Translation along axis
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        const translation = axis.scale(angle);
        jointTransform = BABYLON.Matrix.Translation(
          translation.x,
          translation.y,
          translation.z
        );
      }

      // Combine: T = T_prev * T_origin * R_origin * T_joint
      const linkTransform = originTranslation
        .multiply(originRotation)
        .multiply(jointTransform);

      accumulatedTransform = accumulatedTransform.multiply(linkTransform);
    }

    // Extract position and rotation from final transform
    const position = accumulatedTransform.getTranslation();
    const rotation = BABYLON.Quaternion.FromRotationMatrix(accumulatedTransform);

    return { position, rotation };
  }

  /**
   * Compute Jacobian matrix for velocity kinematics
   * J * joint_velocities = end_effector_velocity
   * Returns 6xN matrix (3 linear + 3 angular velocities)
   */
  computeJacobian(chainName: string, jointAngles: number[]): number[][] | null {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      console.error(`Chain not found: ${chainName}`);
      return null;
    }

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    if (joints.length !== jointAngles.length) {
      console.error(
        `Joint count mismatch: expected ${joints.length}, got ${jointAngles.length}`
      );
      return null;
    }

    const n = joints.length;
    const jacobian: number[][] = Array(6).fill(0).map(() => Array(n).fill(0));

    // Get end-effector position
    const endEffectorPose = this.solve(chainName, jointAngles);
    if (!endEffectorPose) return null;

    const endEffectorPos = endEffectorPose.position;

    // Compute transform for each joint
    const jointTransforms: BABYLON.Matrix[] = [];
    let accumulatedTransform = BABYLON.Matrix.Identity();

    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i];
      const angle = jointAngles[i];

      const originTranslation = BABYLON.Matrix.Translation(
        joint.origin.x,
        joint.origin.y,
        joint.origin.z
      );

      let originRotation = BABYLON.Matrix.Identity();
      if (joint.originRotation) {
        const quat = new BABYLON.Quaternion(
          joint.originRotation.x,
          joint.originRotation.y,
          joint.originRotation.z,
          joint.originRotation.w
        );
        originRotation = BABYLON.Matrix.FromQuaternionToRef(
          quat,
          new BABYLON.Matrix()
        );
      }

      let jointTransform = BABYLON.Matrix.Identity();
      if (joint.type === 'revolute') {
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        jointTransform = BABYLON.Matrix.RotationAxis(axis, angle);
      } else if (joint.type === 'prismatic') {
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();
        const translation = axis.scale(angle);
        jointTransform = BABYLON.Matrix.Translation(
          translation.x,
          translation.y,
          translation.z
        );
      }

      const linkTransform = originTranslation
        .multiply(originRotation)
        .multiply(jointTransform);

      accumulatedTransform = accumulatedTransform.multiply(linkTransform);
      jointTransforms.push(accumulatedTransform.clone());
    }

    // Compute Jacobian columns
    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i];

      // Get joint position in world frame
      const jointPos = jointTransforms[i].getTranslation();

      // Get joint axis in world frame
      const localAxis = new BABYLON.Vector3(
        joint.axis.x,
        joint.axis.y,
        joint.axis.z
      ).normalize();

      // Transform axis to world frame
      const worldAxis = BABYLON.Vector3.TransformNormal(
        localAxis,
        jointTransforms[i]
      );

      if (joint.type === 'revolute') {
        // Linear velocity: v = axis × (end_effector_pos - joint_pos)
        const r = endEffectorPos.subtract(jointPos);
        const linearVel = BABYLON.Vector3.Cross(worldAxis, r);

        jacobian[0][i] = linearVel.x;
        jacobian[1][i] = linearVel.y;
        jacobian[2][i] = linearVel.z;

        // Angular velocity: ω = axis
        jacobian[3][i] = worldAxis.x;
        jacobian[4][i] = worldAxis.y;
        jacobian[5][i] = worldAxis.z;
      } else if (joint.type === 'prismatic') {
        // Linear velocity: v = axis
        jacobian[0][i] = worldAxis.x;
        jacobian[1][i] = worldAxis.y;
        jacobian[2][i] = worldAxis.z;

        // Angular velocity: ω = 0
        jacobian[3][i] = 0;
        jacobian[4][i] = 0;
        jacobian[5][i] = 0;
      }
    }

    return jacobian;
  }

  /**
   * Get end-effector pose for a kinematic chain
   * Uses current joint positions from KinematicsManager
   */
  getEndEffectorPose(chainName: string): {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } | null {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return null;

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    const jointAngles = joints.map((j: JointConfig) => j.position);

    return this.solve(chainName, jointAngles);
  }
}
