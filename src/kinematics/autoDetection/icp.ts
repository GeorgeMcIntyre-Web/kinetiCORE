/**
 * Step 4: ICP (Iterative Closest Point) Registration
 *
 * Finds the rigid transformation (rotation + translation) that best aligns
 * two point clouds. Uses the Kabsch algorithm for optimal rotation estimation.
 */

import type { ICPConfig, ICPResult, AxisAngle } from './types';
import type { Vec3, Mat3 } from './mathUtils';
import {
  vecAdd,
  vecSub,
  vecScale,
  vecLength,
  vecDistance,
  vecNormalize,
  vecDot,
  vecCross,
  mat3Identity,
  mat3ApplyToVec,
  mat3Multiply,
  mat3Transpose,
  mat3Determinant,
  mat3Trace,
  computeCentroid,
  computeCovarianceMatrix,
  subsamplePoints,
} from './mathUtils';
import { Matrix, SVD, determinant } from 'ml-matrix';

const DEFAULT_CONFIG: Required<ICPConfig> = {
  maxIterations: 50,
  convergenceThreshold: 1e-6,
  maxCorrespondenceDistance: Infinity,  // Accept all correspondences (will be filtered by distance)
  subsampleRatio: 0.1,                  // 10% of points
};

interface Correspondence {
  sourceIndex: number;
  targetIndex: number;
  sourcePoint: Vec3;
  targetPoint: Vec3;
  distance: number;
}

/**
 * Run ICP to find rigid transform from source to target.
 *
 * @param sourcePoints - World-space vertices from closed pose
 * @param targetPoints - World-space vertices from open pose
 * @param config - ICP configuration
 * @returns ICP result with rotation, translation, and error metrics
 */
export function runICP(
  sourcePoints: Float32Array,
  targetPoints: Float32Array,
  config: Partial<ICPConfig> = {}
): ICPResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  console.log(`[ICP] Starting with ${sourcePoints.length / 3} source pts, ${targetPoints.length / 3} target pts`);

  // Subsample for performance
  const source = subsamplePoints(sourcePoints, cfg.subsampleRatio);
  const target = targetPoints;  // Keep target dense for accurate nearest neighbor

  console.log(`[ICP] Subsampled to ${source.length / 3} source pts`);

  let R = mat3Identity();
  let t: Vec3 = [0, 0, 0];
  let prevError = Infinity;

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    // 1. Transform source points with current estimate
    const transformed = applyRigidTransform(source, R, t);

    // 2. Find closest point correspondences
    const correspondences = findCorrespondences(
      transformed,
      target,
      cfg.maxCorrespondenceDistance
    );

    // Need at least 3 points for 3D transform (in practice, want more for stability)
    const minCorr = Math.min(3, Math.floor(source.length / 3 / 2)); // At least 3 or half of source points
    if (correspondences.length < minCorr) {
      console.warn(`[ICP] Too few correspondences (${correspondences.length} < ${minCorr}), stopping`);
      return {
        rotation: R,
        translation: t,
        rmsError: Infinity,
        correspondences: 0,
        converged: false,
      };
    }

    // 3. Compute optimal rigid transform using simplified Kabsch
    const { R: dR, t: dt } = computeOptimalTransform(
      correspondences.map(c => c.sourcePoint),
      correspondences.map(c => c.targetPoint)
    );

    // 4. Update cumulative transform
    R = mat3Multiply(dR, R);
    t = vecAdd(mat3ApplyToVec(dR, t), dt);

    // 5. Compute RMS error
    const error = computeRMSError(correspondences);

    console.log(`[ICP] Iter ${iter + 1}: ${correspondences.length} corr, RMS error ${error.toFixed(6)}`);

    // 6. Check convergence
    if (Math.abs(prevError - error) < cfg.convergenceThreshold) {
      console.log(`[ICP] Converged after ${iter + 1} iterations`);
      return {
        rotation: R,
        translation: t,
        rmsError: error,
        correspondences: correspondences.length,
        converged: true,
      };
    }

    prevError = error;
  }

  console.log(`[ICP] Max iterations reached, final RMS error ${prevError.toFixed(6)}`);

  return {
    rotation: R,
    translation: t,
    rmsError: prevError,
    correspondences: prevError === Infinity ? 0 : source.length / 3,
    converged: false,
  };
}

/**
 * Apply rigid transform to point cloud
 */
function applyRigidTransform(
  points: Float32Array,
  R: Mat3,
  t: Vec3
): Float32Array {
  const result = new Float32Array(points.length);

  for (let i = 0; i < points.length; i += 3) {
    const p: Vec3 = [points[i], points[i + 1], points[i + 2]];
    const rotated = mat3ApplyToVec(R, p);
    const transformed = vecAdd(rotated, t);

    result[i] = transformed[0];
    result[i + 1] = transformed[1];
    result[i + 2] = transformed[2];
  }

  return result;
}

/**
 * Find nearest neighbor correspondences
 */
function findCorrespondences(
  source: Float32Array,
  target: Float32Array,
  maxDistance: number
): Correspondence[] {
  const correspondences: Correspondence[] = [];

  for (let i = 0; i < source.length; i += 3) {
    const sp: Vec3 = [source[i], source[i + 1], source[i + 2]];

    // Find closest target point (brute force for simplicity)
    let closestDist = Infinity;
    let closestIdx = -1;
    let closestPoint: Vec3 = [0, 0, 0];

    for (let j = 0; j < target.length; j += 3) {
      const tp: Vec3 = [target[j], target[j + 1], target[j + 2]];
      const dist = vecDistance(sp, tp);

      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = j / 3;
        closestPoint = tp;
      }
    }

    if (closestDist < maxDistance && closestIdx >= 0) {
      correspondences.push({
        sourceIndex: i / 3,
        targetIndex: closestIdx,
        sourcePoint: sp,
        targetPoint: closestPoint,
        distance: closestDist,
      });
    }
  }

  return correspondences;
}

/**
 * Compute optimal rigid transform using Kabsch algorithm with proper SVD.
 *
 * Uses ml-matrix library for numerically stable SVD computation.
 */
function computeOptimalTransform(
  sourcePoints: Vec3[],
  targetPoints: Vec3[]
): { R: Mat3; t: Vec3 } {
  // 1. Compute centroids
  const sourceCentroid = computeCentroidVec3(sourcePoints);
  const targetCentroid = computeCentroidVec3(targetPoints);

  // 2. Center the points
  const sourceCentered = sourcePoints.map(p => vecSub(p, sourceCentroid));
  const targetCentered = targetPoints.map(p => vecSub(p, targetCentroid));

  // 3. Compute covariance matrix H = Σ(source_i * target_i^T)
  const H = computeCovarianceMatrix(sourceCentered, targetCentered);

  // 4. Use proper SVD to compute optimal rotation: H = U * S * V^T, R = V * U^T
  const R = computeRotationViaSVD(H);

  // 5. Translation: t = target_centroid - R * source_centroid
  const t = vecSub(targetCentroid, mat3ApplyToVec(R, sourceCentroid));

  return { R, t };
}

/**
 * Compute rotation matrix from covariance matrix using SVD (Kabsch algorithm).
 *
 * Given H = source * target^T, compute H = U * S * V^T via SVD,
 * then R = V * U^T is the optimal rotation.
 */
function computeRotationViaSVD(H: Mat3): Mat3 {
  // Convert Mat3 to ml-matrix Matrix (note: ml-matrix uses row-major)
  const matH = new Matrix([
    [H[0][0], H[0][1], H[0][2]],
    [H[1][0], H[1][1], H[1][2]],
    [H[2][0], H[2][1], H[2][2]],
  ]);

  // Compute SVD: H = U * S * V^T
  const svd = new SVD(matH);
  const U = svd.leftSingularVectors; // U matrix
  const V = svd.rightSingularVectors; // V matrix

  // R = V * U^T
  const R_matrix = V.mmul(U.transpose());

  // Handle reflection (ensure det(R) = +1, not -1)
  let det = determinant(R_matrix);

  if (det < 0) {
    // Flip sign of last column of V
    const V_corrected = V.clone();
    for (let i = 0; i < 3; i++) {
      V_corrected.set(i, 2, -V_corrected.get(i, 2));
    }
    const R_corrected = V_corrected.mmul(U.transpose());

    // Convert back to Mat3 format
    return [
      [R_corrected.get(0, 0), R_corrected.get(0, 1), R_corrected.get(0, 2)],
      [R_corrected.get(1, 0), R_corrected.get(1, 1), R_corrected.get(1, 2)],
      [R_corrected.get(2, 0), R_corrected.get(2, 1), R_corrected.get(2, 2)],
    ];
  }

  // Convert back to Mat3 format
  return [
    [R_matrix.get(0, 0), R_matrix.get(0, 1), R_matrix.get(0, 2)],
    [R_matrix.get(1, 0), R_matrix.get(1, 1), R_matrix.get(1, 2)],
    [R_matrix.get(2, 0), R_matrix.get(2, 1), R_matrix.get(2, 2)],
  ];
}

/**
 * Compute centroid for Vec3 array
 */
function computeCentroidVec3(points: Vec3[]): Vec3 {
  if (points.length === 0) return [0, 0, 0];

  let sum: Vec3 = [0, 0, 0];
  for (const p of points) {
    sum = vecAdd(sum, p);
  }

  return vecScale(sum, 1 / points.length);
}

/**
 * Compute RMS error
 */
function computeRMSError(correspondences: Correspondence[]): number {
  if (correspondences.length === 0) return Infinity;

  let sumSq = 0;
  for (const corr of correspondences) {
    sumSq += corr.distance * corr.distance;
  }

  return Math.sqrt(sumSq / correspondences.length);
}

/**
 * Extract axis-angle representation from rotation matrix
 */
export function matrixToAxisAngle(R: Mat3): AxisAngle {
  // Rotation angle from trace: cos(θ) = (trace(R) - 1) / 2
  const trace = mat3Trace(R);
  const cosAngle = Math.max(-1, Math.min(1, (trace - 1) / 2));
  const angle = Math.acos(cosAngle);

  if (angle < 0.001) {
    // Near-zero rotation
    return { axis: [0, 0, 1], angle: 0 };
  }

  if (angle > Math.PI - 0.001) {
    // Near 180° rotation - extract axis from eigenvector
    // For 180°, the axis is the eigenvector with eigenvalue +1
    // Simplified: use the column with largest diagonal element
    const diag = [R[0][0], R[1][1], R[2][2]];
    const maxIdx = diag[0] > diag[1]
      ? (diag[0] > diag[2] ? 0 : 2)
      : (diag[1] > diag[2] ? 1 : 2);

    let axis: Vec3;
    if (maxIdx === 0) {
      axis = [R[0][0] + 1, R[1][0], R[2][0]];
    } else if (maxIdx === 1) {
      axis = [R[0][1], R[1][1] + 1, R[2][1]];
    } else {
      axis = [R[0][2], R[1][2], R[2][2] + 1];
    }

    return { axis: vecNormalize(axis), angle: Math.PI };
  }

  // General case: axis from skew-symmetric part
  const sinAngle = Math.sin(angle);
  const axis: Vec3 = [
    (R[2][1] - R[1][2]) / (2 * sinAngle),
    (R[0][2] - R[2][0]) / (2 * sinAngle),
    (R[1][0] - R[0][1]) / (2 * sinAngle),
  ];

  return { axis: vecNormalize(axis), angle };
}
