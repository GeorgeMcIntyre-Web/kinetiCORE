import * as BABYLON from '@babylonjs/core';
import { WorldSpace } from '../utils/WorldSpace';

/**
 * Type of kinematic joint.
 * - 'hinge': Rotational joint (revolute) with axis of rotation
 * - 'prismatic': Linear sliding joint with axis of translation
 */
export type JointKind = 'hinge' | 'prismatic';

/**
 * Joint motion limits in joint space.
 * Units: radians for hinge joints, meters for prismatic joints
 */
export interface JointLimits {
  /** Lower bound of joint range */
  lower: number;
  /** Upper bound of joint range */
  upper: number;
}

/**
 * Complete definition of a kinematic joint in world space.
 * All positions, rotations, and axes are expressed in world coordinates.
 *
 * @example
 * ```typescript
 * const joint: JointDefinition = {
 *   id: 'gripper_hinge',
 *   kind: 'hinge',
 *   parentNodeId: 'arm_link',
 *   childNodeId: 'gripper_jaw',
 *   axisWorld: new BABYLON.Vector3(0, 0, 1), // Z-axis rotation
 *   anchorWorld: new BABYLON.Vector3(0, 0, 0.5), // Pivot at 50cm height
 *   limits: { lower: 0, upper: Math.PI / 2 } // 0-90 degrees
 * };
 * ```
 */
export interface JointDefinition {
  /** Unique identifier for this joint */
  id: string;
  /** Type of joint (hinge or prismatic) */
  kind: JointKind;
  /** Parent node ID in the kinematic tree */
  parentNodeId: string;
  /** Child node ID that moves relative to parent */
  childNodeId: string;
  /** Axis of rotation/translation in world space (unit vector) */
  axisWorld: BABYLON.Vector3;
  /** Anchor point in world space (pivot for hinge, reference for prismatic) */
  anchorWorld: BABYLON.Vector3;
  /** Joint limits */
  limits: JointLimits;
}

/**
 * Motion profile constraints for trajectory planning.
 * Optional velocity and acceleration limits for smooth motion.
 */
export interface MotionProfile {
  /** Maximum velocity (rad/s for hinge, m/s for prismatic) */
  maxVelocity?: number;
  /** Maximum acceleration (rad/s² for hinge, m/s² for prismatic) */
  maxAcceleration?: number;
}

/**
 * Runtime state of a joint.
 * Tracks current position/angle value.
 */
export class JointState {
  /** Current joint value (radians for hinge, meters for prismatic) */
  value: number = 0;
}

/**
 * Joint mathematics utilities for kinematic transformations.
 * Handles forward kinematics: applies joint values to scene node transforms.
 *
 * @remarks
 * All transforms are computed in world space and then converted to local space
 * relative to the parent node. This ensures correctness regardless of the
 * scene hierarchy structure.
 */
export class JointMath {
  /**
   * Apply a joint transform to move a child node relative to its parent.
   *
   * @param scene - Babylon scene containing the nodes
   * @param joint - Joint definition with axis, anchor, and limits
   * @param state - Current joint state (value)
   *
   * @remarks
   * For hinge joints: Rotates child around axis through anchor point
   * For prismatic joints: Translates child along axis by state.value distance
   *
   * Transform pipeline:
   * 1. Build delta transform M in world space (rotation or translation)
   * 2. Compose with current world transform
   * 3. Convert to local space relative to parent
   * 4. Apply local transform to node
   *
   * @example
   * ```typescript
   * const state = new JointState();
   * state.value = Math.PI / 4; // 45 degrees
   * JointMath.applyJointTransform(scene, joint, state);
   * ```
   */
  static applyJointTransform(
    scene: BABYLON.Scene,
    joint: JointDefinition,
    state: JointState
  ): void {
    const childNode = (scene.getTransformNodeByID(joint.childNodeId) || scene.getNodeById(joint.childNodeId)) as BABYLON.TransformNode | null;
    if (!childNode) {
      console.warn(`[JointMath] Child node not found: ${joint.childNodeId}`);
      return;
    }

    // Build world transform for child = R|t about anchor along axis
    const axis = joint.axisWorld.normalize();
    const anchor = joint.anchorWorld;

    // Build delta transform M (world space) around anchor
    let M: BABYLON.Matrix;
    if (joint.kind === 'hinge') {
      // Hinge: rotate around axis through anchor
      const q = BABYLON.Quaternion.RotationAxis(axis, state.value);
      const R = BABYLON.Matrix.Identity();
      BABYLON.Matrix.FromQuaternionToRef(q, R);
      // T = T2 * R * T1 (translate to origin, rotate, translate back)
      const T1 = BABYLON.Matrix.Translation(-anchor.x, -anchor.y, -anchor.z);
      const T2 = BABYLON.Matrix.Translation(anchor.x, anchor.y, anchor.z);
      M = T2.multiply(R).multiply(T1);
    } else {
      // Prismatic: translate along axis
      const delta = axis.scale(state.value);
      M = BABYLON.Matrix.Translation(delta.x, delta.y, delta.z);
    }

    // Compose with current world matrix and convert to local relative to parent
    const currentWorld = WorldSpace.getWorldMatrix(childNode);
    const newWorld = M.multiply(currentWorld);
    const parentWorld = childNode.parent ? WorldSpace.getWorldMatrix(childNode.parent) : BABYLON.Matrix.Identity();
    const invParent = parentWorld.clone();
    invParent.invert();
    const local = newWorld.multiply(invParent);

    // Decompose and apply
    const s = new BABYLON.Vector3();
    const r = new BABYLON.Quaternion();
    const t = new BABYLON.Vector3();
    local.decompose(s, r, t);
    childNode.scaling = s;
    childNode.rotationQuaternion = r;
    childNode.position = t;
  }

  /**
   * Clamp a joint value to its defined limits.
   *
   * @param value - Joint value to clamp (radians or meters)
   * @param limits - Joint limits
   * @returns Clamped value within [limits.lower, limits.upper]
   *
   * @example
   * ```typescript
   * const clamped = JointMath.clampToLimits(Math.PI, { lower: 0, upper: Math.PI / 2 });
   * // clamped === Math.PI / 2 (90 degrees)
   * ```
   */
  static clampToLimits(value: number, limits: JointLimits): number {
    return Math.min(limits.upper, Math.max(limits.lower, value));
  }
}
