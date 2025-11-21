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

// ============================================================================
// Orbit-Based Circle Fitting (No Centroid Anchoring)
// ============================================================================

/** Number of orbit steps for iterative transform application */
const NUM_ORBIT_STEPS = 16;

/** Number of sample points for orbit generation */
const NUM_SAMPLE_POINTS = 12;

/** Minimum radius for valid circle fit (meters) */
const MIN_RADIUS = 0.0001; // 0.1mm

/** Maximum radius for valid circle fit (meters) */
const MAX_RADIUS = 10.0; // 10m

/**
 * Result of orbit-based circle fitting for a single orbit.
 */
export interface OrbitCircleFitResult {
  /** 3D center (pivot estimate) */
  center3D: BABYLON.Vector3;
  /** Radius of fitted circle */
  radius: number;
  /** RMS residual error */
  residualError: number;
  /** Plane normal (rotation axis estimate) */
  planeNormal: BABYLON.Vector3;
}

/**
 * Result of multi-orbit pivot solving.
 */
export interface OrbitPivotResult {
  /** Computed pivot point */
  pivot: BABYLON.Vector3;
  /** Average radius across orbits */
  averageRadius: number;
  /** Combined confidence (0-1) */
  confidence: number;
  /** Rotation axis (from ICP decomposition) */
  axis: BABYLON.Vector3;
  /** From vector for visualization (pivot → start point, projected to plane) */
  fromVector: BABYLON.Vector3;
  /** To vector for visualization (pivot → end point, projected to plane) */
  toVector: BABYLON.Vector3;
  /** Rotation angle in radians */
  angle: number;
}

/**
 * Generate an orbit by repeatedly applying transform to a starting point.
 *
 * @param startPoint - Initial point position
 * @param transform - ICP transform matrix
 * @param steps - Number of transform applications (default: NUM_ORBIT_STEPS)
 * @returns Array of orbit points
 */
export function generateOrbit(
  startPoint: BABYLON.Vector3,
  transform: BABYLON.Matrix,
  steps: number = NUM_ORBIT_STEPS
): BABYLON.Vector3[] {
  const orbit: BABYLON.Vector3[] = [];
  let p = startPoint.clone();

  for (let i = 0; i <= steps; i++) {
    orbit.push(p.clone());
    p = BABYLON.Vector3.TransformCoordinates(p, transform);
  }

  return orbit;
}

/**
 * Compute mean of a set of points.
 */
export function computeMean(points: BABYLON.Vector3[]): BABYLON.Vector3 {
  if (points.length === 0) return BABYLON.Vector3.Zero();

  const sum = points.reduce((acc, p) => acc.add(p), BABYLON.Vector3.Zero());
  return sum.scale(1 / points.length);
}

/**
 * Sample high-leverage points from a point cloud.
 * Selects points furthest from the cloud's mean (for better conditioning).
 *
 * @param points - Input point cloud
 * @param numSamples - Number of points to sample
 * @returns Selected high-leverage points
 */
export function sampleHighLeveragePoints(
  points: BABYLON.Vector3[],
  numSamples: number = NUM_SAMPLE_POINTS
): BABYLON.Vector3[] {
  if (points.length <= numSamples) return [...points];

  const mean = computeMean(points);
  const pointsWithDistance = points.map(p => ({
    point: p,
    distance: BABYLON.Vector3.Distance(p, mean)
  }));

  pointsWithDistance.sort((a, b) => b.distance - a.distance);
  return pointsWithDistance.slice(0, numSamples).map(pd => pd.point);
}

/**
 * Compute RMS residual error for a 2D circle fit.
 */
function compute2DCircleResidual(
  points: { u: number; v: number }[],
  centerU: number,
  centerV: number,
  radius: number
): number {
  if (points.length === 0) return Infinity;

  let sumSqError = 0;
  for (const p of points) {
    const du = p.u - centerU;
    const dv = p.v - centerV;
    const dist = Math.sqrt(du * du + dv * dv);
    const error = dist - radius;
    sumSqError += error * error;
  }

  return Math.sqrt(sumSqError / points.length);
}

/**
 * Fit a single orbit to extract pivot estimate via PCA plane + 2D circle fit.
 *
 * Algorithm:
 * 1. Compute orbit mean (for plane fitting only)
 * 2. Build covariance matrix and find smallest eigenvector (plane normal)
 * 3. Project orbit points to 2D on the plane
 * 4. Fit 2D circle using Kåsa method
 * 5. Map 2D center back to 3D
 *
 * @param orbit - Array of orbit points
 * @returns Circle fit result or null if fit fails
 */
export function fitOrbitCircle(orbit: BABYLON.Vector3[]): OrbitCircleFitResult | null {
  if (orbit.length < 4) return null;

  // Step 1: Compute orbit mean (for plane fitting only, NOT for anchoring)
  const orbitMean = computeMean(orbit);

  // Step 2: Compute covariance matrix and find plane normal
  const cov = computeCovarianceMatrix(orbit, orbitMean);
  const planeNormal = computeSmallestEigenvector(cov);

  // Step 3: Project orbit points to 2D
  const projected = projectToPlane(orbit, planeNormal, orbitMean);
  if (projected.length === 0) return null;

  const points2D = projected.map(p => ({ u: p.u, v: p.v }));
  const { uAxis, vAxis } = projected[0];

  // Step 4: Fit 2D circle
  const circle2D = fit2DCircle(points2D);
  if (!circle2D) return null;

  // Validate radius
  if (circle2D.radius < MIN_RADIUS || circle2D.radius > MAX_RADIUS) return null;
  if (!isFinite(circle2D.radius)) return null;

  // Step 5: Map 2D center back to 3D
  const center3D = mapFrom2DToPlane(circle2D.centerU, circle2D.centerV, orbitMean, uAxis, vAxis);

  // Compute residual error
  const residualError = compute2DCircleResidual(points2D, circle2D.centerU, circle2D.centerV, circle2D.radius);

  return {
    center3D,
    radius: circle2D.radius,
    residualError,
    planeNormal
  };
}

/**
 * Solve for pivot point using orbit-based circle fitting.
 *
 * This is the main entry point for revolute joint pivot detection.
 * NO CENTROID ANCHORING - pivot is derived purely from orbit geometry.
 *
 * Algorithm:
 * 1. Sample high-leverage points from retracted cloud
 * 2. Generate orbit for each sample point
 * 3. Fit circle to each orbit
 * 4. Combine pivot estimates with weighted average
 * 5. Compute fromVector/toVector for visualization
 *
 * @param retractedPoints - Point cloud in retracted state
 * @param transform - ICP transform (retracted → extended)
 * @param axis - Rotation axis from transform decomposition
 * @param angle - Rotation angle from transform decomposition
 * @returns Pivot result or null if fitting fails
 */
export function solveOrbitBasedPivot(
  retractedPoints: BABYLON.Vector3[],
  transform: BABYLON.Matrix,
  axis: BABYLON.Vector3,
  angle: number
): OrbitPivotResult | null {
  // Guard: need minimum points
  if (retractedPoints.length < 3) {
    console.warn('[JointMath] Insufficient points for orbit-based pivot solving');
    return null;
  }

  // Step 1: Sample high-leverage points
  const samplePoints = sampleHighLeveragePoints(retractedPoints, NUM_SAMPLE_POINTS);
  if (samplePoints.length < 3) {
    console.warn('[JointMath] Insufficient sample points for orbit generation');
    return null;
  }

  // Step 2 & 3: Generate orbits and fit circles
  const circleFits: OrbitCircleFitResult[] = [];

  for (const samplePoint of samplePoints) {
    const orbit = generateOrbit(samplePoint, transform, NUM_ORBIT_STEPS);
    const fit = fitOrbitCircle(orbit);

    if (!fit) continue;
    if (!isFinite(fit.residualError)) continue;

    circleFits.push(fit);
  }

  // Guard: need minimum successful fits
  if (circleFits.length < 2) {
    console.warn(`[JointMath] Insufficient circle fits: ${circleFits.length}/${samplePoints.length}`);
    return null;
  }

  // Step 4: Combine pivot estimates with weighted average
  // Weight by inverse residual error (lower error = higher weight)
  const epsilon = 1e-6;
  let totalWeight = 0;
  let weightedPivot = BABYLON.Vector3.Zero();
  let weightedRadius = 0;

  for (const fit of circleFits) {
    const weight = 1 / (fit.residualError + epsilon);
    weightedPivot = weightedPivot.add(fit.center3D.scale(weight));
    weightedRadius += fit.radius * weight;
    totalWeight += weight;
  }

  if (totalWeight < epsilon) {
    console.warn('[JointMath] Total weight too small for pivot averaging');
    return null;
  }

  const pivot = weightedPivot.scale(1 / totalWeight);
  const averageRadius = weightedRadius / totalWeight;

  // Compute confidence based on fit consistency
  const pivotDeviations = circleFits.map(fit => BABYLON.Vector3.Distance(fit.center3D, pivot));
  const maxDeviation = Math.max(...pivotDeviations);
  const avgResidual = circleFits.reduce((sum, fit) => sum + fit.residualError, 0) / circleFits.length;

  // Confidence drops if pivots disagree or residuals are high
  let confidence = 0.9;
  if (maxDeviation > 0.01) confidence *= 0.8; // > 10mm deviation
  if (maxDeviation > 0.05) confidence *= 0.5; // > 50mm deviation
  if (avgResidual > 0.001) confidence *= 0.9; // > 1mm average residual

  // Step 5: Compute fromVector/toVector for visualization
  // Use a representative sample point (first one)
  const pRep = samplePoints[0];
  const pFrom = pRep;
  const pTo = BABYLON.Vector3.TransformCoordinates(pRep, transform);

  // Vectors from pivot to start/end points
  const fromRaw = pFrom.subtract(pivot);
  const toRaw = pTo.subtract(pivot);

  // Project onto plane perpendicular to rotation axis
  const normalizedAxis = axis.normalize();
  const fromProj = projectVectorOnPlane(fromRaw, normalizedAxis);
  const toProj = projectVectorOnPlane(toRaw, normalizedAxis);

  // Normalize and scale to common radius for consistent visualization
  const fromLen = fromProj.length();
  const toLen = toProj.length();

  if (fromLen < epsilon || toLen < epsilon) {
    console.warn('[JointMath] From/to vectors too short for normalization');
    return null;
  }

  const fromVector = fromProj.normalize().scale(averageRadius);
  const toVector = toProj.normalize().scale(averageRadius);

  return {
    pivot,
    averageRadius,
    confidence,
    axis: normalizedAxis,
    fromVector,
    toVector,
    angle
  };
}

/**
 * Compute bounding box for a set of points.
 */
export function computeBoundingBox(points: BABYLON.Vector3[]): {
  min: BABYLON.Vector3;
  max: BABYLON.Vector3;
  center: BABYLON.Vector3;
  size: BABYLON.Vector3;
} {
  if (points.length === 0) {
    const zero = BABYLON.Vector3.Zero();
    return { min: zero, max: zero, center: zero, size: zero };
  }

  let minX = points[0].x, minY = points[0].y, minZ = points[0].z;
  let maxX = points[0].x, maxY = points[0].y, maxZ = points[0].z;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const min = new BABYLON.Vector3(minX, minY, minZ);
  const max = new BABYLON.Vector3(maxX, maxY, maxZ);
  const center = min.add(max).scale(0.5);
  const size = max.subtract(min);

  return { min, max, center, size };
}

/**
 * Compute 3x3 covariance matrix for a set of points around their mean.
 */
export function computeCovarianceMatrix(
  points: BABYLON.Vector3[],
  mean: BABYLON.Vector3
): number[][] {
  const n = points.length;
  if (n === 0) {
    return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  }

  let cxx = 0, cxy = 0, cxz = 0;
  let cyy = 0, cyz = 0;
  let czz = 0;

  for (const p of points) {
    const dx = p.x - mean.x;
    const dy = p.y - mean.y;
    const dz = p.z - mean.z;

    cxx += dx * dx;
    cxy += dx * dy;
    cxz += dx * dz;
    cyy += dy * dy;
    cyz += dy * dz;
    czz += dz * dz;
  }

  const scale = 1 / n;
  return [
    [cxx * scale, cxy * scale, cxz * scale],
    [cxy * scale, cyy * scale, cyz * scale],
    [cxz * scale, cyz * scale, czz * scale]
  ];
}

/**
 * Compute smallest eigenvector of a 3x3 symmetric matrix (for plane normal).
 * Uses Jacobi eigenvalue algorithm for numerical stability.
 */
export function computeSmallestEigenvector(matrix: number[][]): BABYLON.Vector3 {
  // Copy matrix for in-place operations
  const a = [
    [matrix[0][0], matrix[0][1], matrix[0][2]],
    [matrix[1][0], matrix[1][1], matrix[1][2]],
    [matrix[2][0], matrix[2][1], matrix[2][2]]
  ];

  // Eigenvector matrix (starts as identity)
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];

  // Jacobi rotation iterations
  for (let iter = 0; iter < 50; iter++) {
    // Find largest off-diagonal element
    let maxVal = 0;
    let p = 0, q = 1;
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        if (Math.abs(a[i][j]) > maxVal) {
          maxVal = Math.abs(a[i][j]);
          p = i;
          q = j;
        }
      }
    }

    if (maxVal < 1e-12) break; // Converged

    // Compute rotation angle
    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;

    // Apply rotation to A
    const app = a[p][p], aqq = a[q][q], apq = a[p][q];
    a[p][p] = app - t * apq;
    a[q][q] = aqq + t * apq;
    a[p][q] = 0;
    a[q][p] = 0;

    for (let k = 0; k < 3; k++) {
      if (k === p || k === q) continue;
      const akp = a[k][p], akq = a[k][q];
      a[k][p] = c * akp - s * akq;
      a[p][k] = a[k][p];
      a[k][q] = s * akp + c * akq;
      a[q][k] = a[k][q];
    }

    // Apply rotation to eigenvector matrix
    for (let k = 0; k < 3; k++) {
      const vkp = v[k][p], vkq = v[k][q];
      v[k][p] = c * vkp - s * vkq;
      v[k][q] = s * vkp + c * vkq;
    }
  }

  // Find smallest eigenvalue
  let minIdx = 0;
  let minVal = a[0][0];
  for (let i = 1; i < 3; i++) {
    if (a[i][i] < minVal) {
      minVal = a[i][i];
      minIdx = i;
    }
  }

  // Return corresponding eigenvector
  return new BABYLON.Vector3(v[0][minIdx], v[1][minIdx], v[2][minIdx]).normalize();
}

/**
 * Compute an arbitrary vector orthogonal to the given vector.
 */
export function computeOrthogonal(v: BABYLON.Vector3): BABYLON.Vector3 {
  const absX = Math.abs(v.x);
  const absY = Math.abs(v.y);
  const absZ = Math.abs(v.z);

  // Pick axis least aligned with v to avoid numerical issues in cross product
  let referenceAxis: BABYLON.Vector3;
  if (absX <= absY && absX <= absZ) {
    referenceAxis = new BABYLON.Vector3(1, 0, 0);
  } else if (absY <= absZ) {
    referenceAxis = new BABYLON.Vector3(0, 1, 0);
  } else {
    referenceAxis = new BABYLON.Vector3(0, 0, 1);
  }

  // Cross product gives a vector orthogonal to both v and the reference axis
  return BABYLON.Vector3.Cross(v, referenceAxis).normalize();
}

/**
 * Project 3D points onto a plane, returning 2D coordinates in plane's local frame.
 */
export function projectToPlane(
  points: BABYLON.Vector3[],
  planeNormal: BABYLON.Vector3,
  planeCenter: BABYLON.Vector3
): { u: number; v: number; uAxis: BABYLON.Vector3; vAxis: BABYLON.Vector3 }[] {
  // Create orthonormal basis on plane
  const n = planeNormal.normalize();
  const tempU = computeOrthogonal(n);
  const uAxis = BABYLON.Vector3.Cross(tempU, n).normalize();
  const vAxis = BABYLON.Vector3.Cross(n, uAxis).normalize();

  const projected = points.map(p => {
    const rel = p.subtract(planeCenter);
    return {
      u: BABYLON.Vector3.Dot(rel, uAxis),
      v: BABYLON.Vector3.Dot(rel, vAxis),
      uAxis,
      vAxis
    };
  });

  return projected;
}

/**
 * Fit a 2D circle to a set of 2D points using algebraic least squares (Kåsa method).
 * Center-shifts data for numerical stability.
 */
export function fit2DCircle(points: { u: number; v: number }[]): {
  centerU: number;
  centerV: number;
  radius: number;
} | null {
  const n = points.length;
  if (n < 3) return null;

  // Center-shift for numerical stability
  let meanU = 0, meanV = 0;
  for (const p of points) {
    meanU += p.u;
    meanV += p.v;
  }
  meanU /= n;
  meanV /= n;

  // Build linear system with centered data
  let sumU = 0, sumV = 0, sumUU = 0, sumVV = 0, sumUV = 0;
  let sumUUU = 0, sumUVV = 0, sumVVV = 0, sumUUV = 0;

  for (const p of points) {
    const u = p.u - meanU;
    const v = p.v - meanV;
    const uu = u * u;
    const vv = v * v;

    sumU += u;
    sumV += v;
    sumUU += uu;
    sumVV += vv;
    sumUV += u * v;
    sumUUU += uu * u;
    sumUVV += u * vv;
    sumVVV += vv * v;
    sumUUV += uu * v;
  }

  // Solve 2x2 linear system for circle center (relative to mean)
  const A11 = sumUU;
  const A12 = sumUV;
  const A21 = sumUV;
  const A22 = sumVV;
  const B1 = 0.5 * (sumUUU + sumUVV);
  const B2 = 0.5 * (sumUUV + sumVVV);

  const det = A11 * A22 - A12 * A21;
  if (Math.abs(det) < 1e-15) return null;

  const uc = (A22 * B1 - A12 * B2) / det;
  const vc = (A11 * B2 - A21 * B1) / det;

  // Compute radius from center
  const radiusSq = uc * uc + vc * vc + (sumUU + sumVV) / n;
  if (radiusSq < 0) return null;

  const radius = Math.sqrt(radiusSq);
  if (!isFinite(radius) || radius < 1e-10) return null;

  return {
    centerU: uc + meanU,
    centerV: vc + meanV,
    radius
  };
}

/**
 * Map 2D coordinates back to 3D on the plane.
 */
export function mapFrom2DToPlane(
  u: number,
  v: number,
  planeCenter: BABYLON.Vector3,
  uAxis: BABYLON.Vector3,
  vAxis: BABYLON.Vector3
): BABYLON.Vector3 {
  return planeCenter.add(uAxis.scale(u)).add(vAxis.scale(v));
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
