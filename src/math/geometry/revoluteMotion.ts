import * as BABYLON from '@babylonjs/core';

export type RevoluteMotion = {
  axis: BABYLON.Vector3;
  angleDeg: number;
  center: BABYLON.Vector3;
  translationMagnitude: number;
};

/**
 * Compute revolute motion parameters from two point clouds and their ICP transform.
 * 
 * This function extracts the rotation axis, angle, center of rotation, and translation
 * magnitude from a rigid transform that aligns two point clouds representing different
 * states of a rotating body.
 * 
 * Algorithm (Bisector Intersection):
 * 1. Decompose transform to get rotation axis and angle.
 * 2. Generate point pairs (P, P') where P' = Transform * P.
 * 3. The pivot must lie on the perpendicular bisector plane of every chord P->P'.
 * 4. Construct a least-squares linear system to find the intersection of these planes.
 * 5. Constrain the pivot to be close to the centroid along the rotation axis (to fix sliding).
 * 
 * This approach is extremely robust to remote pivots and works for any rotation angle (including 180°).
 */
export function computeRevoluteMotionFromPointClouds(
  pointsClosed: BABYLON.Vector3[],
  pointsOpen: BABYLON.Vector3[],
  transform: BABYLON.Matrix
): RevoluteMotion | undefined {
  // 1. Decompose Transform to get Rotation Matrix and Translation
  const translation = transform.getTranslation();
  const rotationMatrix = transform.getRotationMatrix();

  // Extract quaternion from rotation matrix
  const q = new BABYLON.Quaternion();
  rotationMatrix.decompose(undefined, q, undefined);
  q.normalize();

  // Extract axis-angle
  let angleRad = 2 * Math.acos(Math.min(1, Math.max(-1, q.w)));
  const s = Math.sin(angleRad / 2);

  const axis = new BABYLON.Vector3();
  if (Math.abs(s) < 1e-6) {
    axis.set(0, 0, 1); // Default axis if no rotation
  } else {
    axis.set(q.x / s, q.y / s, q.z / s);
  }
  axis.normalize();

  if (angleRad < 0) angleRad += 2 * Math.PI;

  // 2. Sample points and create pairs
  // We use a subset of points to keep performance high
  const samplePoints = pointsClosed.slice(0, Math.min(pointsClosed.length, 20)); // Use up to 20 points
  if (samplePoints.length === 0) return undefined;

  const pairs: [BABYLON.Vector3, BABYLON.Vector3][] = [];
  const centroid = new BABYLON.Vector3(0, 0, 0);

  for (const p of samplePoints) {
    const pPrime = BABYLON.Vector3.TransformCoordinates(p, transform);
    pairs.push([p, pPrime]);
    centroid.addInPlace(p);
  }
  centroid.scaleInPlace(1.0 / samplePoints.length);

  // 3. Solve for Pivot using Bisector Planes (Least Squares)
  // System: A * x = b
  // A = sum( w * n * n^T ) + w_axis * axis * axis^T
  // b = sum( w * n * val ) + w_axis * axis * axisVal

  let a00 = 0, a01 = 0, a02 = 0;
  let a10 = 0, a11 = 0, a12 = 0;
  let a20 = 0, a21 = 0, a22 = 0;
  let b0 = 0, b1 = 0, b2 = 0;

  const addEquation = (normal: BABYLON.Vector3, value: number, weight: number) => {
    const nx = normal.x, ny = normal.y, nz = normal.z;
    a00 += weight * nx * nx; a01 += weight * nx * ny; a02 += weight * nx * nz;
    a10 += weight * ny * nx; a11 += weight * ny * ny; a12 += weight * ny * nz;
    a20 += weight * nz * nx; a21 += weight * nz * ny; a22 += weight * nz * nz;
    b0 += weight * nx * value;
    b1 += weight * ny * value;
    b2 += weight * nz * value;
  };

  for (const [p1, p2] of pairs) {
    const midpoint = p1.add(p2).scale(0.5);
    const normal = p2.subtract(p1); // Chord vector is normal to bisector plane
    const len = normal.length();

    if (len < 1e-6) continue;

    normal.normalize();
    const val = BABYLON.Vector3.Dot(midpoint, normal);

    // Weight by chord length (longer chords = better leverage)
    addEquation(normal, val, len);
  }

  // Add axis constraint (pivot must lie on axis passing near centroid)
  // This fixes the degree of freedom along the rotation axis
  const axisWeight = 10.0 + pairs.length;
  const axisVal = BABYLON.Vector3.Dot(centroid, axis);
  addEquation(axis, axisVal, axisWeight);

  // Solve 3x3 system
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

  const center = new BABYLON.Vector3(px, py, pz);

  // 4. Convert Angle to Degrees
  const angleDeg = angleRad * (180 / Math.PI);

  return {
    axis,
    angleDeg,
    center,
    translationMagnitude: translation.length()
  };
}
