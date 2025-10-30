import * as BABYLON from '@babylonjs/core';
import { JointDefinitionOutput } from './Schemas';

/**
 * Proprietary tooling JSON joint specification.
 * Format observed in production tooling files (e.g., 9X_110_GEO.json).
 *
 * @remarks
 * This format comes from external CAD/analysis tools and contains
 * joint parameters fitted from point cloud data.
 */
export interface ToolingJointJson {
  /** Human-readable joint name */
  Name: string;
  /** Electrical control name (for PLC integration) */
  ElectricalName: string;
  /** Path to the moving node in the scene hierarchy */
  NodeId: string;
  /** Optional node ID to hide when joint is active */
  HideId?: string;
  /** Joint type: 0 = prismatic (linear), 1 = hinge (rotational) */
  Type: number;
  /** Maximum joint value (meters for prismatic, degrees for hinge) */
  MaxValue: number;
  /** Minimum joint value (meters for prismatic, degrees for hinge) */
  MinValue: number;
  /** End vector defining joint motion direction/axis */
  ToVector: { X: number; Y: number; Z: number };
  /** Start vector defining joint motion direction/axis */
  FromVector: { X: number; Y: number; Z: number };
  /** Point cloud sample count in closed state (for validation) */
  PointCountClose?: number;
  /** Point cloud sample count in open state (for validation) */
  PointCountOpen?: number;
  /** RMS error from ICP fit (meters, quality metric) */
  RmsError?: number;
  /** Maximum error from ICP fit (meters, quality metric) */
  MaxError?: number;
  /** 4x4 transformation matrix as 4 strings of space-separated floats */
  TransformationMatrix: string[];
}

/**
 * Tool unit containing multiple joints.
 * Represents a complete kinematic assembly (e.g., gripper, clamp fixture).
 */
export interface ToolingUnitJson {
  /** Name of the tool unit */
  UnitName: string;
  /** Array of joints in this unit */
  Joints: ToolingJointJson[];
}

/**
 * Complete tooling file format: array of tool units.
 */
export type ToolingFileJson = ToolingUnitJson[];

/**
 * Parse a 4x4 transformation matrix from array of string rows.
 *
 * @param rows - Array of 4 strings, each containing 4 space-separated floats
 * @returns Babylon Matrix in row-major order
 * @throws Error if matrix doesn't contain exactly 16 values
 *
 * @example
 * ```typescript
 * const rows = [
 *   "1 0 0 0",
 *   "0 1 0 0",
 *   "0 0 1 0",
 *   "0 0 0 1"
 * ];
 * const matrix = parseMatrix4(rows); // Identity matrix
 * ```
 */
function parseMatrix4(rows: string[]): BABYLON.Matrix {
  const vals: number[] = [];
  for (const r of rows) {
    const parts = r.trim().split(/\s+/).filter(s => s.length > 0);
    for (const p of parts) vals.push(parseFloat(p));
  }

  if (vals.length !== 16) {
    throw new Error(`Invalid TransformationMatrix: expected 16 values, got ${vals.length}`);
  }

  return BABYLON.Matrix.FromArray(vals);
}

/**
 * Compute axis direction from two points (start and end vectors).
 *
 * @param a - Start vector
 * @param b - End vector
 * @returns Normalized axis direction from a to b
 *
 * @remarks
 * Returns Z-axis (0, 0, 1) if vectors are too close (< 1e-8).
 */
export function axisFromVectors(a: BABYLON.Vector3, b: BABYLON.Vector3): BABYLON.Vector3 {
  const delta = b.subtract(a);
  const len = delta.length();
  return len > 1e-8 ? delta.scale(1 / len) : new BABYLON.Vector3(0, 0, 1);
}

/**
 * Extract rotation angle from a transformation matrix.
 *
 * @param m - Transformation matrix
 * @returns Rotation angle in radians
 */
export function angleFromMatrix(m: BABYLON.Matrix): number {
  const s = new BABYLON.Vector3();
  const q = new BABYLON.Quaternion();
  const t = new BABYLON.Vector3();
  m.decompose(s, q, t);
  // Angle from quaternion: θ = 2 * arccos(w)
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, q.w)));
  return angle;
}

/**
 * Extract rotation axis from a transformation matrix.
 *
 * @param m - Transformation matrix
 * @returns Normalized rotation axis
 *
 * @remarks
 * Returns Z-axis (0, 0, 1) for identity/small rotations (angle < 1e-6).
 */
export function axisFromMatrix(m: BABYLON.Matrix): BABYLON.Vector3 {
  const s = new BABYLON.Vector3();
  const q = new BABYLON.Quaternion();
  const t = new BABYLON.Vector3();
  m.decompose(s, q, t);

  // Axis from quaternion: (x, y, z) / sqrt(1 - w²)
  const denom = Math.sqrt(1 - q.w * q.w);
  if (denom < 1e-6) return new BABYLON.Vector3(0, 0, 1);

  return new BABYLON.Vector3(q.x / denom, q.y / denom, q.z / denom).normalize();
}

/**
 * Convert JSON vector to Babylon Vector3.
 *
 * @param v - JSON vector with X, Y, Z properties
 * @returns Babylon Vector3
 */
export function toVector3(v: { X: number; Y: number; Z: number }): BABYLON.Vector3 {
  return new BABYLON.Vector3(v.X, v.Y, v.Z);
}

/**
 * Convert tooling JSON format to internal joint definitions in world space.
 *
 * @param data - Array of tool units from tooling JSON file
 * @param resolveParentId - Function to resolve parent node ID from child path
 * @returns Array of joint definitions ready for kinematic simulation
 *
 * @remarks
 * Conversion rules:
 * - Type 0 (prismatic): Uses FromVector→ToVector for axis, FromVector as anchor
 * - Type 1 (hinge): Extracts axis from TransformationMatrix, degrees→radians conversion
 * - Joint IDs are constructed as "{UnitName}_{JointName}"
 *
 * @example
 * ```typescript
 * const joints = toolingJsonToJoints(data, (childPath) => {
 *   const idx = childPath.lastIndexOf('/');
 *   return idx > 0 ? childPath.substring(0, idx) : 'WORLD';
 * });
 * ```
 */
export function toolingJsonToJoints(
  data: ToolingFileJson,
  resolveParentId: (movingNodePath: string) => string
): JointDefinitionOutput[] {
  const joints: JointDefinitionOutput[] = [];

  for (const unit of data) {
    for (const j of unit.Joints) {
      const childId = j.NodeId;
      const parentId = resolveParentId(j.NodeId);

      const from = toVector3(j.FromVector);
      const to = toVector3(j.ToVector);
      const T = parseMatrix4(j.TransformationMatrix);

      if (j.Type === 0) {
        // Prismatic joint: linear motion along FromVector→ToVector axis
        joints.push({
          id: `${unit.UnitName}_${j.Name}`,
          type: 'prismatic',
          parentId,
          childId,
          axisWorld: axisFromVectors(from, to),
          anchorWorld: from.clone(),
          limits: { lower: j.MinValue, upper: j.MaxValue },
        });
      } else {
        // Hinge joint: rotational motion around axis from transformation matrix
        const axis = axisFromMatrix(T);
        // Convert degrees to radians
        const lower = (j.MinValue * Math.PI) / 180.0;
        const upper = (j.MaxValue * Math.PI) / 180.0;
        joints.push({
          id: `${unit.UnitName}_${j.Name}`,
          type: 'hinge',
          parentId,
          childId,
          axisWorld: axis,
          anchorWorld: from.clone(), // Use FromVector as approximate anchor
          limits: { lower, upper },
        });
      }
    }
  }

  return joints;
}
