/**
 * Step 5: Joint Classification
 *
 * Classify joints as revolute, prismatic, or fixed based on ICP results.
 * Extract joint parameters (axis, angle, distance, pivot).
 */

import type { ICPResult, JointClassification, JointConfig, Circle3D } from './types';
import type { Vec3, Mat3 } from './mathUtils';
import {
  vecLength,
  vecNormalize,
  vecSub,
  vecAdd,
  vecScale,
  vecDot,
  vecCross,
  vecMidpoint,
  vecDistance,
  projectToPlane,
  solve3x3,
  mat3ApplyToVec,
} from './mathUtils';
import { matrixToAxisAngle } from './icp';

const DEFAULT_CONFIG: JointConfig = {
  MIN_ROTATION_RAD: 0.035,      // ~2 degrees
  MIN_TRANSLATION: 0.002,       // 2mm
  PURE_ROTATION_TRANS_THRESHOLD: 0.005,  // 5mm
};

/**
 * Classify joint type from ICP result.
 *
 * @param icpResult - ICP registration result
 * @param config - Joint classification config
 * @returns Joint classification with parameters
 */
export function classifyJoint(
  icpResult: ICPResult,
  config: Partial<JointConfig> = {}
): JointClassification {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const { axis, angle } = matrixToAxisAngle(icpResult.rotation);
  const translationMag = vecLength(icpResult.translation);

  console.log(`[JOINT] Rotation: ${(angle * 180 / Math.PI).toFixed(1)}° around [${axis.map(v => v.toFixed(3)).join(', ')}]`);
  console.log(`[JOINT] Translation: ${translationMag.toFixed(4)}m = ${(translationMag * 1000).toFixed(1)}mm`);

  // Case 1: Significant rotation, minimal translation → REVOLUTE
  if (angle >= cfg.MIN_ROTATION_RAD && translationMag < cfg.PURE_ROTATION_TRANS_THRESHOLD) {
    console.log(`[JOINT] Classified as REVOLUTE (pure rotation)`);
    return {
      type: 'revolute',
      axis,
      angle,
      confidence: icpResult.rmsError < 0.001 ? 0.95 : 0.8,
    };
  }

  // Case 2: Significant rotation WITH translation → REVOLUTE (pivot not at origin)
  if (angle >= cfg.MIN_ROTATION_RAD) {
    console.log(`[JOINT] Classified as REVOLUTE (rotation with offset pivot)`);
    return {
      type: 'revolute',
      axis,
      angle,
      confidence: icpResult.rmsError < 0.002 ? 0.9 : 0.7,
    };
  }

  // Case 3: No rotation, significant translation → PRISMATIC
  if (angle < cfg.MIN_ROTATION_RAD && translationMag >= cfg.MIN_TRANSLATION) {
    console.log(`[JOINT] Classified as PRISMATIC`);
    return {
      type: 'prismatic',
      axis: vecNormalize(icpResult.translation),
      distance: translationMag,
      confidence: icpResult.rmsError < 0.001 ? 0.95 : 0.8,
    };
  }

  // Case 4: Neither rotation nor translation → FIXED
  console.log(`[JOINT] Classified as FIXED (no significant motion)`);
  return { type: 'fixed', confidence: 0.5 };
}

/**
 * Compute pivot point for a revolute joint.
 *
 * Uses perpendicular bisector method: for each point pair (p_closed, p_open),
 * the center of rotation lies on a line perpendicular to the chord at its midpoint.
 *
 * @param closedPoints - World-space points in closed pose
 * @param openPoints - Corresponding points in open pose
 * @param rotationAxis - Rotation axis from ICP
 * @param _rotationAngle - Rotation angle (unused in current impl)
 * @returns Pivot point in world space
 */
export function computePivotPoint(
  closedPoints: Vec3[],
  openPoints: Vec3[],
  rotationAxis: Vec3,
  _rotationAngle: number
): Vec3 {
  console.log(`[PIVOT] Computing pivot from ${closedPoints.length} point pairs`);

  interface Line3D {
    point: Vec3;
    direction: Vec3;
  }

  const bisectorLines: Line3D[] = [];

  for (let i = 0; i < closedPoints.length; i++) {
    const p1 = closedPoints[i];
    const p2 = openPoints[i];

    // Skip if points are too close (near the axis)
    const chordLength = vecDistance(p1, p2);
    if (chordLength < 0.001) continue;

    // Chord midpoint
    const mid = vecMidpoint(p1, p2);

    // Chord direction
    const chord = vecNormalize(vecSub(p2, p1));

    // Perpendicular bisector direction
    const bisectorDir = vecNormalize(vecCross(chord, rotationAxis));

    if (vecLength(bisectorDir) > 0.001) {
      bisectorLines.push({
        point: mid,
        direction: bisectorDir,
      });
    }
  }

  console.log(`[PIVOT] Found ${bisectorLines.length} bisector lines`);

  if (bisectorLines.length < 2) {
    console.warn('[PIVOT] Not enough bisector lines, using centroid of closed points');
    return computeCentroidVec3(closedPoints);
  }

  // Find point that minimizes distance to all bisector lines (least squares)
  const pivot = findClosestPointToLines(bisectorLines);

  console.log(`[PIVOT] Pivot point: [${pivot.map(v => v.toFixed(4)).join(', ')}]`);

  return pivot;
}

/**
 * Find the point closest to a set of 3D lines (least squares solution)
 */
function findClosestPointToLines(lines: Array<{ point: Vec3; direction: Vec3 }>): Vec3 {
  // Solve Ax = b where we minimize sum of squared distances to lines
  // For each line with point p and direction d:
  // Distance² = ||(x - p) - ((x - p)·d)d||²

  const ATA: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const ATb: Vec3 = [0, 0, 0];

  for (const line of lines) {
    const p = line.point;
    const d = line.direction;

    // Projection matrix onto plane perpendicular to d: I - d*d^T
    const P: Mat3 = [
      [1 - d[0] * d[0], -d[0] * d[1], -d[0] * d[2]],
      [-d[1] * d[0], 1 - d[1] * d[1], -d[1] * d[2]],
      [-d[2] * d[0], -d[2] * d[1], 1 - d[2] * d[2]],
    ];

    // Accumulate P^T * P (= P since P is symmetric) and P^T * (P * p) = P * p
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        ATA[i][j] += P[i][j];
      }
      const Pp = mat3ApplyToVec(P, p);
      ATb[i] += Pp[i];
    }
  }

  // Solve ATA * x = ATb
  try {
    return solve3x3(ATA, ATb);
  } catch (e) {
    console.warn('[PIVOT] Failed to solve least squares, using first line point');
    return lines[0].point;
  }
}

/**
 * Fit a circle to show how a point moves from closed to open position.
 * Useful for visualization and validation.
 *
 * @param closedPoint - Point in closed pose
 * @param openPoint - Point in open pose
 * @param rotationAxis - Rotation axis
 * @param pivot - Pivot point
 * @returns Circle3D for visualization
 */
export function fitCircleToPointMotion(
  closedPoint: Vec3,
  openPoint: Vec3,
  rotationAxis: Vec3,
  pivot: Vec3
): Circle3D {
  // The plane of the circle is perpendicular to the rotation axis
  const normal = rotationAxis;

  // Project both points onto the plane perpendicular to axis, passing through pivot
  const p1Proj = projectToPlane(closedPoint, pivot, normal);
  const p2Proj = projectToPlane(openPoint, pivot, normal);

  // Radius is distance from pivot to projected point (should be same for both)
  const radius1 = vecDistance(p1Proj, pivot);
  const radius2 = vecDistance(p2Proj, pivot);
  const radius = (radius1 + radius2) / 2;

  // Create local coordinate system in the plane
  const p1ToPivot = vecSub(p1Proj, pivot);
  const xAxis: Vec3 = vecLength(p1ToPivot) > 1e-6
    ? vecNormalize(p1ToPivot)
    : [1, 0, 0];  // Fallback
  const yAxis = vecNormalize(vecCross(normal, xAxis));

  // Start angle is 0 by definition (we aligned xAxis with p1)
  const startAngle = 0;

  // End angle from p2's position in this coordinate system
  const p2Local: Vec3 = vecSub(p2Proj, pivot);
  const endAngle = Math.atan2(
    vecDot(p2Local, yAxis),
    vecDot(p2Local, xAxis)
  );

  return {
    center: pivot,
    normal: normal,
    radius: radius,
    startAngle: startAngle,
    endAngle: endAngle,
    sweepAngle: endAngle,  // Since startAngle is 0
  };
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
