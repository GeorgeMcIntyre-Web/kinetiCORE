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
  private warnedNoTCP: Set<string> = new Set();

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
    const result = this.applyJointTransform(joint, syncPhysics);

    // Update joint gizmos for this joint and all child joints
    const scene = this.sceneManager.getScene();
    if (scene) {
      this.kinematicsManager.updateJointGizmo(jointId, scene);
      this.updateChildJointGizmos(joint.childNodeId, scene);
      
      // Cache the joint frame world matrix (joint origin position + rotation)
      const parentNode = this.sceneTreeManager.getNode(joint.parentNodeId);
      const childNode = this.sceneTreeManager.getNode(joint.childNodeId);
      if (parentNode && childNode) {
        const parentBabylonNode = this.getBabylonNode(parentNode.id, scene);
        const childBabylonNode = this.getBabylonNode(childNode.id, scene);
        
        if (parentBabylonNode && childBabylonNode) {
          // The joint frame is at parent's world transform + joint origin
          parentBabylonNode.computeWorldMatrix(true);
          const parentWorldMatrix = parentBabylonNode.getWorldMatrix();
          
          // Joint origin in parent's local space
          const originLocal = new BABYLON.Vector3(
            joint.origin.x,
            joint.origin.y,
            joint.origin.z
          );
          
          // Transform joint origin to world space
          const originWorld = BABYLON.Vector3.TransformCoordinates(originLocal, parentWorldMatrix);
          
          // Create a simple matrix representing the joint frame position
          const jointWorldMatrix = BABYLON.Matrix.Translation(
            originWorld.x,
            originWorld.y,
            originWorld.z
          );
          
          // Apply joint rotation to the matrix
          const transform = this.calculateJointTransform(joint);
          const rotationMatrix = BABYLON.Matrix.Identity();
          rotationMatrix.setTranslation(jointWorldMatrix.getTranslation());
          const rotationQuat = transform.rotation;
          rotationQuat.toRotationMatrix(rotationMatrix);
          
          const rotatedMatrix = BABYLON.Matrix.Identity();
          rotationMatrix.multiplyToRef(jointWorldMatrix, rotatedMatrix);
          
          // Find the chain this joint belongs to
          const chains = this.kinematicsManager.getAllChains();
          for (const chain of chains) {
            if (chain.joints.some(j => j.id === jointId)) {
              // Cache the joint frame world matrix
              this.kinematicsManager.setJointWorldMatrix(chain.id, jointId, rotatedMatrix.clone());
              // Emit FK update event
              this.kinematicsManager.emitFkUpdated(chain.id);
              break;
            }
          }
        }
      }
    }

    return result;
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
    // IMPORTANT: Check for circular parent reference before setting parent
    // This prevents "Maximum call stack size exceeded" errors in Babylon's _syncParentEnabledState
    if (childBabylonNode.parent !== parentBabylonNode) {
      // Verify this won't create a circular reference (child becoming ancestor of itself)
      let ancestor = parentBabylonNode.parent;
      let maxDepth = 100; // Safety limit
      let isCircular = false;

      while (ancestor && maxDepth-- > 0) {
        if (ancestor === childBabylonNode) {
          console.error(
            `[FK Solver] Circular parent reference detected: ` +
            `Cannot set ${childBabylonNode.name} as child of ${parentBabylonNode.name} ` +
            `because it would create a cycle`
          );
          isCircular = true;
          break;
        }
        ancestor = ancestor.parent;
      }

      if (!isCircular) {
        childBabylonNode.parent = parentBabylonNode;
      } else {
        console.warn(`[FK Solver] Skipping joint ${joint.name} due to circular reference`);
        return false;
      }
    }

    // Set local transform relative to parent
    childBabylonNode.position.copyFrom(transform.position);
    childBabylonNode.rotationQuaternion = transform.rotation;

    // Debug: Log when we update tool0
    if (joint.name && joint.name.includes('tool0')) {
      const euler = transform.rotation.toEulerAngles();
      console.log(`[FK applyJointTransform] Setting tool0 LOCAL rotation: Rx=${(euler.x*180/Math.PI).toFixed(1)}° Ry=${(euler.y*180/Math.PI).toFixed(1)}° Rz=${(euler.z*180/Math.PI).toFixed(1)}°`);
    }

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
        console.log(`[FK applyJointTransform] Fixed joint ${joint.name}: originRotation = ${JSON.stringify(joint.originRotation)}`);
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
   * Recursively update all child joint gizmos after a parent joint moves
   */
  private updateChildJointGizmos(nodeId: string, scene: BABYLON.Scene): void {
    const childJoints = this.kinematicsManager.getNodeJoints(nodeId);

    for (const childJoint of childJoints) {
      if (childJoint.parentNodeId === nodeId) {
        this.kinematicsManager.updateJointGizmo(childJoint.id, scene);
        // Recursively update this joint's children
        this.updateChildJointGizmos(childJoint.childNodeId, scene);
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
   * Returns TCP pose (tool0 or last link) given joint angles
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

    // Build transformation chain from base to TCP (tool0)
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

    // Extract TCP position and rotation from final transform
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
   * Get null TCP pose by querying the actual mesh world position
   * This is the RELIABLE method: directly get the world position of tool0/last link mesh
   */
  getNullTCPPose(chainName: string): {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } | null {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return null;

    // Get the TCP frame's link node (tool0)
    const joints = this.kinematicsManager.getChainJoints(chain.id);
    if (joints.length === 0) return null;

    // Find the last child node in the joint chain (the end effector/last link)
    // This is the last joint's child node, which is the actual end of the kinematic chain
    let lastLinkNodeId: string | null = null;
    const lastJoint = joints[joints.length - 1];
    
    if (lastJoint && lastJoint.childNodeId) {
      lastLinkNodeId = lastJoint.childNodeId;
    }

    if (!lastLinkNodeId) {
      console.error(`[FK getNullTCPPose] Last child node not found in ${joints.length} joints`);
      return null;
    }

    // Get the actual scene node
    const lastLinkNode = this.sceneTreeManager.getNode(lastLinkNodeId);
    if (!lastLinkNode) {
      console.error(`[FK getNullTCPPose] Last link node not found: ${lastLinkNodeId}`);
      return null;
    }

    // Get scene
    const scene = this.sceneManager.getScene();
    if (!scene) return null;

    // Get the actual Babylon node (could be mesh or transform node)
    const babylonNode = this.getBabylonNode(lastLinkNodeId, scene);
    if (!babylonNode) {
      console.error(`[FK getNullTCPPose] Last link Babylon node not found for ${lastLinkNodeId}`);
      return null;
    }

    // Get ACTUAL world position from the mesh in the last link
    // If it's a TransformNode, get its child meshes
    let actualMesh: BABYLON.Mesh | BABYLON.TransformNode | null = null;
    
    if (babylonNode instanceof BABYLON.Mesh) {
      actualMesh = babylonNode;
    } else if (babylonNode instanceof BABYLON.TransformNode) {
      // Get all child meshes and use the first one
      const childMeshes = babylonNode.getChildMeshes(false, (node): node is BABYLON.Mesh => node instanceof BABYLON.Mesh);
      
      if (childMeshes.length > 0) {
        actualMesh = childMeshes[0];
      } else {
        // No child meshes, use the transform node itself
        actualMesh = babylonNode;
      }
    } else {
      actualMesh = babylonNode;
    }

    if (!actualMesh) {
      console.error(`[FK getNullTCPPose] Could not get actual mesh from last link node`);
      return null;
    }

    // Get world position from the actual mesh
    actualMesh.computeWorldMatrix(true);
    const worldMatrix = actualMesh.getWorldMatrix();
    const worldPosition = new BABYLON.Vector3();
    worldMatrix.getTranslationToRef(worldPosition);
    const worldRotation = BABYLON.Quaternion.FromRotationMatrix(worldMatrix);
    
    return {
      position: worldPosition,
      rotation: worldRotation
    };
  }

  /**
   * Legacy method name - use getNullTCPPose() instead
   * @deprecated Use getNullTCPPose() for clarity (returns null TCP, i.e., tool0 without offset)
   */
  getEndEffectorPose(chainName: string) {
    return this.getNullTCPPose(chainName);
  }

  /**
   * Alias for getNullTCPPose() - kept for backward compatibility
   * @deprecated Use getNullTCPPose() for clarity
   */
  getTCPPoseLocal(chainName: string) {
    return this.getNullTCPPose(chainName);
  }

  /**
   * Get TCP pose for a kinematic chain (for tools mounted to the robot)
   * Applies TCP frame offset and rotation to the null TCP (last link pose)
   * @param chainName - Name of the kinematic chain
   * @param tcpFrameId - Optional TCP frame ID (uses first TCP frame if not specified)
   * @returns TCP pose (null TCP + tool offset/rotation) in world space, or null if chain not found
   */
  getTCPPose(chainName: string, tcpFrameId?: string): {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } | null {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      console.error(`[FK getTCPPose] Chain not found: ${chainName}`);
      return null;
    }

    // Get TCP frames for this chain
    const tcpFrames = this.kinematicsManager.getTCPFrames(chain.id);
    if (tcpFrames.length === 0) {
      // Only warn once per chain to avoid spam
      if (!this.warnedNoTCP.has(chainName)) {
        console.warn(`[FK getTCPPose] No TCP frames found for chain: ${chainName}`);
        this.warnedNoTCP.add(chainName);
      }
      return this.getTCPPoseWorld(chainName); // Fallback to tool0/last link
    }

    // Debug: Log all available TCP frames
    console.log(`[FK getTCPPose] Available TCP frames (${tcpFrames.length}):`);
    tcpFrames.forEach((frame, idx) => {
      const euler = new BABYLON.Quaternion(frame.rotation.x, frame.rotation.y, frame.rotation.z, frame.rotation.w).toEulerAngles();
      console.log(`  [${idx}] ${frame.name}: rot=(${(euler.x*180/Math.PI).toFixed(1)}°, ${(euler.y*180/Math.PI).toFixed(1)}°, ${(euler.z*180/Math.PI).toFixed(1)}°), offset=(${frame.offset.x.toFixed(3)}, ${frame.offset.y.toFixed(3)}, ${frame.offset.z.toFixed(3)})`);
    });

    // Select TCP frame (use specified ID or default to first frame)
    let tcpFrame = tcpFrames[0];
    if (tcpFrameId) {
      const found = tcpFrames.find(f => f.id === tcpFrameId);
      if (found) {
        tcpFrame = found;
      } else {
        console.warn(`[FK getTCPPose] TCP frame ${tcpFrameId} not found, using ${tcpFrame.name}`);
      }
    }
    console.log(`[FK getTCPPose] Using TCP frame: ${tcpFrame.name}`);

    // The TCP frame represents a tool mounted on the robot with an offset/rotation.
    // Since solve() processes ALL joints including fixed ones, the null TCP pose (tool0) already includes
    // the position and orientation of the last link. Now we apply the TCP frame transform and convert to world space.
    
    // Get null TCP pose - now returns ACTUAL world position from mesh
    const nullTCPPose = this.getNullTCPPose(chainName);
    if (!nullTCPPose) {
      console.error(`[FK getTCPPose] Could not get null TCP pose`);
      return null;
    }

    // nullTCPPose is already in WORLD SPACE (from actual mesh)
    // Now apply TCP frame offset and rotation in world space
    const tcpFrameOffset = new BABYLON.Vector3(
      tcpFrame.offset.x,
      tcpFrame.offset.y,
      tcpFrame.offset.z
    );

    const tcpFrameRotation = new BABYLON.Quaternion(
      tcpFrame.rotation.x,
      tcpFrame.rotation.y,
      tcpFrame.rotation.z,
      tcpFrame.rotation.w
    );

    // Transform TCP frame offset in the tool0's local frame to world space
    // TCP frame offset is specified in the tool0 frame's coordinate system
    const rotatedOffset = BABYLON.Vector3.TransformCoordinates(
      tcpFrameOffset,
      BABYLON.Matrix.FromQuaternionToRef(nullTCPPose.rotation, new BABYLON.Matrix())
    );

    // Apply TCP frame offset to null TCP position (already in world space)
    const tcpPositionWorld = nullTCPPose.position.add(rotatedOffset);

    // Combine rotations: null TCP rotation * TCP frame rotation
    const tcpRotationWorld = nullTCPPose.rotation.multiply(tcpFrameRotation);

    console.log(`[FK getTCPPose] Applying TCP frame ${tcpFrame.name} in world space:`);
    console.log(`  Tool0 world pos: (${nullTCPPose.position.x.toFixed(3)}, ${nullTCPPose.position.y.toFixed(3)}, ${nullTCPPose.position.z.toFixed(3)})`);
    console.log(`  TCP offset (tool0 frame): (${tcpFrameOffset.x.toFixed(3)}, ${tcpFrameOffset.y.toFixed(3)}, ${tcpFrameOffset.z.toFixed(3)})`);
    console.log(`  TCP world pos: (${tcpPositionWorld.x.toFixed(3)}, ${tcpPositionWorld.y.toFixed(3)}, ${tcpPositionWorld.z.toFixed(3)})`);

    return {
      position: tcpPositionWorld,
      rotation: tcpRotationWorld
    };
  }

  /**
   * Transform a robot-local pose to world space
   * Helper method used by both null TCP and TCP frame transformations
   */
  // @ts-ignore - Reserved for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _transformToWorldSpace(
    chainName: string,
    localPosition: BABYLON.Vector3,
    localRotation: BABYLON.Quaternion
  ): {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } | null {
    // Get chain
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      console.warn(`[FK getTCPPose] Chain not found: ${chainName}`);
      return null;
    }

    // Get robot base node (first joint's parent)
    const joints = this.kinematicsManager.getChainJoints(chain.id);
    if (joints.length === 0) {
      console.warn(`[FK getTCPPose] No joints in chain ${chainName}`);
      return { position: localPosition, rotation: localRotation };
    }

    const firstJoint = joints[0];
    const baseNode = this.sceneTreeManager.getNode(firstJoint.parentNodeId);
    if (!baseNode) {
      console.warn(`[FK getTCPPose] Base node not found for chain ${chainName}`);
      return { position: localPosition, rotation: localRotation };
    }

    // Get base node's world transform
    const scene = this.sceneManager.getScene();
    if (!scene) {
      console.warn(`[FK getTCPPose] Scene not available`);
      return { position: localPosition, rotation: localRotation };
    }

    const baseBabylonNode = this.getBabylonNode(baseNode.id, scene);
    if (!baseBabylonNode) {
      console.warn(`[FK getTCPPose] Base Babylon node not found for ${baseNode.id}`);
      return { position: localPosition, rotation: localRotation };
    }

    // Get world matrix for base
    baseBabylonNode.computeWorldMatrix(true);
    const baseWorldMatrix = baseBabylonNode.getWorldMatrix();

    // Transform position from robot-local to world space
    const worldPosition = BABYLON.Vector3.TransformCoordinates(
      localPosition,
      baseWorldMatrix
    );

    // Transform rotation to world space
    const baseWorldRotation = BABYLON.Quaternion.FromRotationMatrix(baseWorldMatrix);
    const worldRotation = baseWorldRotation.multiply(localRotation);

    // Debug logging
    const localEuler = localRotation.toEulerAngles();
    const worldEuler = worldRotation.toEulerAngles();
    console.log(`[FK transformToWorldSpace] Transforming to world space:`);
    console.log(`  Local: pos=(${localPosition.x.toFixed(3)}, ${localPosition.y.toFixed(3)}, ${localPosition.z.toFixed(3)}), rot=(Rx=${(localEuler.x*180/Math.PI).toFixed(1)}°, Ry=${(localEuler.y*180/Math.PI).toFixed(1)}°, Rz=${(localEuler.z*180/Math.PI).toFixed(1)}°)`);
    console.log(`  World: pos=(${worldPosition.x.toFixed(3)}, ${worldPosition.y.toFixed(3)}, ${worldPosition.z.toFixed(3)}), rot=(Rx=${(worldEuler.x*180/Math.PI).toFixed(1)}°, Ry=${(worldEuler.y*180/Math.PI).toFixed(1)}°, Rz=${(worldEuler.z*180/Math.PI).toFixed(1)}°)`);

    return {
      position: worldPosition,
      rotation: worldRotation
    };
  }

  /**
   * Get null TCP pose in world space
   * Simply returns null TCP since getNullTCPPose() now returns actual world position
   */
  private getTCPPoseWorld(chainName: string): {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } | null {
    // getNullTCPPose() now returns actual world position from mesh
    return this.getNullTCPPose(chainName);
  }

  /**
   * Load a saved pose/keyframe and apply joint positions
   * @param keyframeId - ID of the keyframe to load
   * @param syncPhysics - Whether to sync to physics engine (default: true)
   * @returns true if pose was loaded successfully
   */
  loadPose(keyframeId: string, syncPhysics: boolean = true): boolean {
    const keyframe = this.kinematicsManager.getKeyframe(keyframeId);

    if (!keyframe) {
      console.error(`[FK Solver] Keyframe not found: ${keyframeId}`);
      return false;
    }

    console.log(`[FK Solver] Loading pose: ${keyframe.name} (${Object.keys(keyframe.jointPositions).length} joints)`);

    let successCount = 0;
    let totalCount = 0;

    // Apply each joint position from the keyframe
    for (const [jointId, position] of Object.entries(keyframe.jointPositions)) {
      totalCount++;
      const success = this.updateJointPosition(jointId, position, syncPhysics);
      if (success) {
        successCount++;
      } else {
        console.warn(`[FK Solver] Failed to update joint: ${jointId}`);
      }
    }

    console.log(`[FK Solver] ✅ Loaded pose: ${keyframe.name} (${successCount}/${totalCount} joints updated)`);

    return successCount === totalCount;
  }

  /**
   * Load pose by name (searches for keyframe with matching name)
   * @param poseName - Name of the pose to load
   * @param chainId - Optional chain ID to filter keyframes
   * @param syncPhysics - Whether to sync to physics engine (default: true)
   * @returns true if pose was loaded successfully
   */
  loadPoseByName(poseName: string, chainId?: string, syncPhysics: boolean = true): boolean {
    const allKeyframes = this.kinematicsManager.getAllKeyframes();

    let keyframe;
    if (chainId) {
      keyframe = allKeyframes.find(kf => kf.name === poseName && kf.chainId === chainId);
    } else {
      keyframe = allKeyframes.find(kf => kf.name === poseName);
    }

    if (!keyframe) {
      console.error(`[FK Solver] Pose not found: ${poseName}`);
      return false;
    }

    return this.loadPose(keyframe.id, syncPhysics);
  }
}
