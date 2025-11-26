/**
 * Precise Pivot Point Computation from ICP Transformation Matrix
 *
 * Method: Apply ICP transformation to vertices from closed pose, then fit a 3D circle
 * to find the rotation center. This uses the actual transformation rather than
 * assuming geometric bisectors.
 */

import type { Vec3, Mat3 } from './mathUtils';
import {
  vecSub,
  vecAdd,
  vecScale,
  vecDot,
  vecCross,
  vecLength,
  vecNormalize,
  mat3ApplyToVec,
  mat3Subtract,
  mat3Identity,
  mat3Determinant,
  solve3x3,
  vecDistance,
  projectToPlane,
} from './mathUtils';

/**
 * Compute pivot point by fitting a circle to transformed vertices.
 *
 * Method:
 * 1. Apply ICP transformation (R, t) to vertices from closed pose
 * 2. For each vertex pair (v_closed, R*v_closed + t), these trace a circular arc
 * 3. Fit a circle to these points to find the center (pivot)
 *
 * @param closedPoints - Sample of vertices from closed pose
 * @param rotation - 3x3 rotation matrix from ICP
 * @param translation - Translation vector from ICP
 * @param rotationAxis - Rotation axis from ICP
 * @returns Pivot point (circle center) in world space
 */
export function computePivotFromMatrix(
  closedPoints: Vec3[],
  rotation: Mat3,
  translation: Vec3,
  rotationAxis: Vec3
): Vec3 {
  console.log(`[PIVOT-CIRCLE] Computing pivot from ${closedPoints.length} vertices using circle fitting`);

  // Step 1: Apply ICP transformation to closed points
  const transformedPoints: Vec3[] = [];
  for (const p of closedPoints) {
    const rotated = mat3ApplyToVec(rotation, p);
    const transformed = vecAdd(rotated, translation);
    transformedPoints.push(transformed);
  }

  // Step 2: Fit circle to point pairs in 3D
  // For a revolute joint, each point pair traces a circular arc
  // The circle lies in a plane perpendicular to the rotation axis
  const pivot = fitCircleCenter3D(closedPoints, transformedPoints, rotationAxis);

  console.log(`[PIVOT-CIRCLE] Fitted pivot: [${pivot.map(v => v.toFixed(6)).join(', ')}] meters`);

  // Step 3: Verify rotation normal (plane of rotation)
  verifyRotationPlane(closedPoints, transformedPoints, pivot, rotationAxis);

  return pivot;
}

/**
 * Verify that the rotation occurs in the correct plane perpendicular to the axis.
 *
 * For each point pair, check that:
 * 1. Both points lie in a plane perpendicular to the rotation axis through the pivot
 * 2. The motion is circular (distance from pivot is constant)
 *
 * @param pointsBefore - Points before transformation
 * @param pointsAfter - Points after transformation
 * @param pivot - Computed pivot point
 * @param rotationAxis - Expected rotation axis
 */
function verifyRotationPlane(
  pointsBefore: Vec3[],
  pointsAfter: Vec3[],
  pivot: Vec3,
  rotationAxis: Vec3
): void {
  const n = Math.min(10, pointsBefore.length);  // Check first 10 points

  let sumPlaneDev = 0;
  let sumRadiusDev = 0;

  for (let i = 0; i < n; i++) {
    const p1 = pointsBefore[i];
    const p2 = pointsAfter[i];

    // Check plane deviation: (p - pivot) · axis should be constant
    const r1 = vecSub(p1, pivot);
    const r2 = vecSub(p2, pivot);

    const h1 = Math.abs(vecDot(r1, rotationAxis));  // Distance from plane
    const h2 = Math.abs(vecDot(r2, rotationAxis));

    sumPlaneDev += Math.abs(h2 - h1);

    // Check radius consistency
    const radius1 = vecLength(r1);
    const radius2 = vecLength(r2);
    sumRadiusDev += Math.abs(radius2 - radius1);
  }

  const avgPlaneDev = (sumPlaneDev / n) * 1000;  // Convert to mm
  const avgRadiusDev = (sumRadiusDev / n) * 1000;  // Convert to mm

  console.log(`[PIVOT-VERIFY] Plane deviation: ${avgPlaneDev.toFixed(4)}mm (should be ~0)`);
  console.log(`[PIVOT-VERIFY] Radius deviation: ${avgRadiusDev.toFixed(4)}mm (should be ~0)`);
  console.log(`[PIVOT-VERIFY] Rotation axis: [${rotationAxis.map(v => v.toFixed(6)).join(', ')}]`);

  if (avgPlaneDev > 1.0) {
    console.warn(`[PIVOT-VERIFY] ⚠️  High plane deviation - points may not rotate in expected plane`);
  }

  if (avgRadiusDev > 1.0) {
    console.warn(`[PIVOT-VERIFY] ⚠️  High radius deviation - motion may not be purely circular`);
  }

  if (avgPlaneDev < 1.0 && avgRadiusDev < 1.0) {
    console.log(`[PIVOT-VERIFY] ✓ Rotation is circular in plane perpendicular to axis`);
  }
}

/**
 * Fit a circle to point pairs in 3D space.
 *
 * Given pairs of points (before, after) that trace circular arcs around an axis,
 * find the center of the circle using least-squares fitting.
 *
 * Method: For a circle with center C and points P1, P2 on the circle:
 *   |P1 - C|² = r²  and  |P2 - C|² = r²
 *   => |P1 - C|² = |P2 - C|²
 *   => P1·P1 - 2*P1·C + C·C = P2·P2 - 2*P2·C + C·C
 *   => 2*(P2 - P1)·C = P2·P2 - P1·P1
 *
 * This gives us a linear equation in C for each point pair.
 * We solve using least-squares over all pairs.
 *
 * @param pointsBefore - Points before transformation
 * @param pointsAfter - Points after transformation
 * @param rotationAxis - Rotation axis (normal to circle plane)
 * @returns Circle center (pivot point)
 */
function fitCircleCenter3D(
  pointsBefore: Vec3[],
  pointsAfter: Vec3[],
  rotationAxis: Vec3
): Vec3 {
  const n = Math.min(pointsBefore.length, pointsAfter.length);
  if (n < 3) {
    console.warn('[PIVOT-CIRCLE] Not enough points, using midpoint');
    const mid = vecAdd(pointsBefore[0], pointsAfter[0]);
    return vecScale(mid, 0.5);
  }

  // Build linear system: A * center = b
  // For each point pair: 2*(P2 - P1) · C = (P2·P2 - P1·P1)
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < n; i++) {
    const P1 = pointsBefore[i];
    const P2 = pointsAfter[i];

    // Skip if points are too close (on the rotation axis)
    const dist = vecDistance(P1, P2);
    if (dist < 0.001) continue;  // 1mm threshold

    // Equation: 2*(P2 - P1) · C = (P2·P2 - P1·P1)
    const coeff = vecScale(vecSub(P2, P1), 2);
    const rhs = vecDot(P2, P2) - vecDot(P1, P1);

    A.push([coeff[0], coeff[1], coeff[2]]);
    b.push(rhs);
  }

  console.log(`[PIVOT-CIRCLE] Built system with ${A.length} equations from ${n} point pairs`);

  if (A.length < 3) {
    console.warn('[PIVOT-CIRCLE] Not enough valid equations, using midpoint');
    const mid = vecAdd(pointsBefore[0], pointsAfter[0]);
    return vecScale(mid, 0.5);
  }

  // Solve least-squares: A^T * A * x = A^T * b
  const ATA: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const ATb: Vec3 = [0, 0, 0];

  for (let i = 0; i < A.length; i++) {
    const row = A[i];
    const bVal = b[i];

    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        ATA[j][k] += row[j] * row[k];
      }
      ATb[j] += row[j] * bVal;
    }
  }

  try {
    const center = solve3x3(ATA, ATb);

    // Validate: Check that center is reasonable
    const distToOrigin = vecLength(center);
    if (distToOrigin > 50.0) {
      console.warn(`[PIVOT-CIRCLE] Center is ${distToOrigin.toFixed(2)}m from origin - seems unreasonable`);
    }

    // Verify all points are approximately equidistant from center
    let sumRadius = 0;
    let sumRadiusSq = 0;
    for (let i = 0; i < Math.min(10, n); i++) {
      const r1 = vecDistance(pointsBefore[i], center);
      const r2 = vecDistance(pointsAfter[i], center);
      sumRadius += (r1 + r2) / 2;
      sumRadiusSq += (r1 * r1 + r2 * r2) / 2;
    }
    const avgRadius = sumRadius / Math.min(10, n);
    const radiusStdDev = Math.sqrt(sumRadiusSq / Math.min(10, n) - avgRadius * avgRadius);

    console.log(`[PIVOT-CIRCLE] Average radius: ${(avgRadius * 1000).toFixed(2)}mm, std dev: ${(radiusStdDev * 1000).toFixed(2)}mm`);

    return center;

  } catch (e) {
    console.error('[PIVOT-CIRCLE] Failed to solve least squares:', e);
    // Fallback: use centroid
    let sum: Vec3 = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      sum = vecAdd(sum, pointsBefore[i]);
      sum = vecAdd(sum, pointsAfter[i]);
    }
    return vecScale(sum, 1 / (2 * n));
  }
}

/**
 * Fallback: Compute pivot point using rotation axis and translation.
 *
 * The pivot lies somewhere along the rotation axis. We find the point
 * on the axis closest to satisfying t = p - R*p.
 *
 * @param rotation - 3x3 rotation matrix
 * @param translation - Translation vector
 * @param axis - Normalized rotation axis
 * @returns Pivot point on the rotation axis
 */
function computePivotFromAxis(
  rotation: Mat3,
  translation: Vec3,
  axis: Vec3
): Vec3 {
  // For a 90° rotation around an axis through point p:
  // The transformation is: x' = R*(x - p) + p = R*x + (I-R)*p
  // So: t = (I-R)*p
  //
  // For a pure 90° rotation, (I-R) maps vectors perpendicular to the axis
  // to other perpendicular vectors. The pivot lies on the axis.
  //
  // Strategy: Find the point on the rotation axis that minimizes |R*x + t - x|
  // Parameterize axis as: p(s) = s * axis (assuming axis passes through origin)
  // We need to find the offset along the axis.

  // Compute the component of translation perpendicular to axis
  const t_parallel = vecScale(axis, vecDot(translation, axis));
  const t_perp = vecSub(translation, t_parallel);

  console.log(`[PIVOT-AXIS] Translation perpendicular to axis: [${t_perp.map(v => v.toFixed(4)).join(', ')}], magnitude: ${vecLength(t_perp).toFixed(4)}m`);

  // For a 90° rotation, if we have a point at distance r from the axis,
  // the perpendicular component of translation should be ~ sqrt(2)*r
  // We can estimate the pivot by finding where the axis intersects
  // the perpendicular bisector plane of t_perp

  // The pivot should lie on the axis at: p = -0.5 * t_perp (rotated by -45°)
  // But simpler: for 90° rotation, pivot is at -t_perp/2 projected back
  // Let's use a more robust approach:

  // For 90° rotation about axis through p: t = p - R*p
  // If p is on the axis, then R*p = p (axis is eigenvector with eigenvalue 1)
  // This would give t = 0, which contradicts our non-zero t.
  // This means pivot is NOT on the axis passing through origin.

  // Better approach: Find point p such that t = p - R*p
  // For 90° rotation, let's use the perpendicular bisector method in 2D
  // Project everything onto the plane perpendicular to the axis

  // Take a reference point and its rotation
  // Use t_perp to find the center of rotation in the perpendicular plane
  const R_t_perp = mat3ApplyToVec(rotation, t_perp);
  const midpoint = vecScale(vecAdd(t_perp, R_t_perp), 0.5);

  console.log(`[PIVOT-AXIS] Midpoint of translation: [${midpoint.map(v => v.toFixed(4)).join(', ')}]`);

  // The pivot in the perpendicular plane is at the midpoint
  // Add the parallel component to get the full 3D pivot
  const pivot = vecAdd(midpoint, t_parallel);

  console.log(`[PIVOT-AXIS] Computed pivot: [${pivot.map(v => v.toFixed(4)).join(', ')}]`);

  return pivot;
}

/**
 * Validate pivot point by checking that transformed points match the circle.
 *
 * For revolute motion around pivot with rotation R:
 *   p_after = R * (p_before - pivot) + pivot
 *
 * The error is the deviation from perfect circular motion.
 *
 * @param pointsBefore - Points before transformation
 * @param pointsAfter - Points after ICP transformation (R*p + t)
 * @param rotation - Rotation matrix from ICP
 * @param pivot - Pivot point to validate
 * @returns RMS error in meters (should be close to ICP RMS)
 */
export function validatePivot(
  pointsBefore: Vec3[],
  pointsAfter: Vec3[],
  rotation: Mat3,
  pivot: Vec3
): number {
  if (pointsBefore.length === 0) return Infinity;

  let sumSqError = 0;

  for (let i = 0; i < pointsBefore.length; i++) {
    const pBefore = pointsBefore[i];
    const pAfter = pointsAfter[i];

    // Predict after position using revolute motion: R * (p_before - pivot) + pivot
    const relative = vecSub(pBefore, pivot);
    const rotated = mat3ApplyToVec(rotation, relative);
    const predicted = vecAdd(rotated, pivot);

    // Error between predicted and actual transformed position
    const error = vecDistance(predicted, pAfter);
    sumSqError += error * error;
  }

  const rms = Math.sqrt(sumSqError / pointsBefore.length);

  console.log(`[PIVOT-VALIDATE] RMS error: ${(rms * 1000).toFixed(4)}mm over ${pointsBefore.length} points`);

  return rms;
}

/**
 * Compute radius of rotation for a point.
 *
 * Distance from pivot to point, projected onto plane perpendicular to axis.
 *
 * @param point - Point in 3D space
 * @param pivot - Pivot point
 * @param axis - Rotation axis
 * @returns Radius in meters
 */
export function computeRotationRadius(
  point: Vec3,
  pivot: Vec3,
  axis: Vec3
): number {
  // Vector from pivot to point
  const r = vecSub(point, pivot);

  // Component along axis (to be removed)
  const axialComponent = vecDot(r, axis);
  const axialVector = vecScale(axis, axialComponent);

  // Radial component (perpendicular to axis)
  const radialVector = vecSub(r, axialVector);

  return vecLength(radialVector);
}
