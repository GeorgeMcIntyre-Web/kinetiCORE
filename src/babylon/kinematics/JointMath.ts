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

// ============================================================================
// Circle Fit Helper Functions for Joint Extraction
// ============================================================================

/**
 * Decomposes a 4x4 transform matrix into rotation angle, rotation axis, and translation.
 * 
 * @param matrix - The ICP transform matrix
 * @returns Object containing angle (radians), axis (normalized Vector3), and translation (Vector3)
 */
export function decomposeTransform(matrix: BABYLON.Matrix): {
  angle: number;
  axis: BABYLON.Vector3;
  translation: BABYLON.Vector3
} {
  const translation = matrix.getTranslation();
  const rotationQuaternion = new BABYLON.Quaternion();
  matrix.getRotationMatrix().decompose(undefined, rotationQuaternion, undefined);

  // Ensure quaternion is normalized
  rotationQuaternion.normalize();

  // Extract axis-angle from quaternion
  // angle = 2 * acos(w), axis = (x,y,z) / sin(angle/2)
  const w = rotationQuaternion.w;
  const angle = 2 * Math.acos(Math.min(1, Math.max(-1, w))); // Clamp for numerical stability

  let axis: BABYLON.Vector3;
  const sinHalfAngle = Math.sin(angle / 2);

  if (Math.abs(sinHalfAngle) < 1e-6) {
    // Near-zero rotation, axis is arbitrary
    axis = new BABYLON.Vector3(0, 1, 0);
  } else {
    axis = new BABYLON.Vector3(
      rotationQuaternion.x / sinHalfAngle,
      rotationQuaternion.y / sinHalfAngle,
      rotationQuaternion.z / sinHalfAngle
    ).normalize();
  }

  return {
    angle: angle,
    axis: axis,
    translation: translation
  };
}

/**
 * Projects a point onto a plane defined by a normal and a point on the plane.
 * 
 * @param point - Point to project
 * @param planeNormal - Normal vector of the plane
 * @param planePoint - Any point on the plane
 * @returns Projected point on the plane
 */
export function projectPointOnPlane(
  point: BABYLON.Vector3,
  planeNormal: BABYLON.Vector3,
  planePoint: BABYLON.Vector3
): BABYLON.Vector3 {
  const v = point.subtract(planePoint);
  const dist = BABYLON.Vector3.Dot(v, planeNormal);
  return point.subtract(planeNormal.scale(dist));
}

/**
 * Projects a vector onto a plane (removes component parallel to normal).
 * Used to ensure rotation vectors lie in the plane perpendicular to the rotation axis.
 * 
 * @param vector - Vector to project
 * @param planeNormal - Normal vector of the plane
 * @returns Projected vector with component parallel to normal removed
 */
export function projectVectorOnPlane(vector: BABYLON.Vector3, planeNormal: BABYLON.Vector3): BABYLON.Vector3 {
  const dist = BABYLON.Vector3.Dot(vector, planeNormal);
  return vector.subtract(planeNormal.scale(dist));
}

/**
 * Solves for the pivot point (center of rotation) using the Circle Fit algorithm.
 * 
 * Uses Least Squares to find the intersection of perpendicular bisector planes.
 * For a revolute joint, the pivot must lie on the perpendicular bisector plane
 * of every chord connecting start point p_i and end point p'_i.
 * 
 * @param pairs - Array of [start, end] point pairs where end = Transform · start
 * @param axis - The normalized rotation axis direction
 * @param centroid - The centroid of the object (anchors pivot along axis)
 * @returns Computed pivot point in world space
 * 
 * @remarks
 * Mathematical approach:
 * - For each pair (p, p'), pivot lies on bisector plane of chord p → p'
 * - Construct linear system M·X = B via Normal Equations: (M^T M)·X = M^T·B
 * - Axis constraint prevents sliding along rotation axis (infinite solutions)
 */
export function solvePivotPoint(
  pairs: [BABYLON.Vector3, BABYLON.Vector3][],
  axis: BABYLON.Vector3,
  centroid: BABYLON.Vector3
): BABYLON.Vector3 {
  if (pairs.length === 0) {
    return centroid.clone();
  }

  // Initialize 3x3 system accumulators for A = M^T M
  let a00 = 0, a01 = 0, a02 = 0;
  let a10 = 0, a11 = 0, a12 = 0;
  let a20 = 0, a21 = 0, a22 = 0;

  // Initialize vector accumulators for B_vec = M^T B
  let b0 = 0, b1 = 0, b2 = 0;

  const addEquation = (normal: BABYLON.Vector3, value: number, weight: number = 1.0) => {
    const w = weight;
    const nx = normal.x;
    const ny = normal.y;
    const nz = normal.z;

    // Update A matrix (outer product weighted)
    a00 += w * nx * nx; a01 += w * nx * ny; a02 += w * nx * nz;
    a10 += w * ny * nx; a11 += w * ny * ny; a12 += w * ny * nz;
    a20 += w * nz * nx; a21 += w * nz * ny; a22 += w * nz * nz;

    // Update B vector
    b0 += w * nx * value;
    b1 += w * ny * value;
    b2 += w * nz * value;
  };

  // 1. Add bisector plane constraints from point pairs
  for (const [p1, p2] of pairs) {
    const m = p1.add(p2).scale(0.5); // Midpoint
    const n = p2.subtract(p1);       // Chord vector

    const len = n.length();
    if (len < 1e-6) continue; // Skip coincident points

    n.normalize();
    const val = BABYLON.Vector3.Dot(m, n);

    // Weight by chord length: longer chords = more reliable
    addEquation(n, val, len);
  }

  // 2. Add axis constraint to fix sliding along axis
  const axisWeight = 10.0 + pairs.length;
  const axisVal = BABYLON.Vector3.Dot(centroid, axis);
  addEquation(axis, axisVal, axisWeight);

  // 3. Solve via 3x3 matrix inversion
  const A = BABYLON.Matrix.FromValues(
    a00, a01, a02, 0,
    a10, a11, a12, 0,
    a20, a21, a22, 0,
    0, 0, 0, 1
  );

  const AInv = A.invert();

  const px = AInv.m[0] * b0 + AInv.m[1] * b1 + AInv.m[2] * b2;
  const py = AInv.m[4] * b0 + AInv.m[5] * b1 + AInv.m[6] * b2;
  const pz = AInv.m[8] * b0 + AInv.m[9] * b1 + AInv.m[10] * b2;

  return new BABYLON.Vector3(px, py, pz);
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
      // T = T1 * R * T2 (translate to origin, rotate, translate back)
      // Note: Babylon uses row vectors (v * M), so order is T1 -> R -> T2
      const T1 = BABYLON.Matrix.Translation(-anchor.x, -anchor.y, -anchor.z);
      const T2 = BABYLON.Matrix.Translation(anchor.x, anchor.y, anchor.z);
      M = T1.multiply(R).multiply(T2);
    } else {
      // Prismatic: translate along axis
      const delta = axis.scale(state.value);
      M = BABYLON.Matrix.Translation(delta.x, delta.y, delta.z);
    }

    // Compose with current world matrix and convert to local relative to parent
    const currentWorld = WorldSpace.getWorldMatrix(childNode);
    const newWorld = currentWorld.multiply(M);
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
