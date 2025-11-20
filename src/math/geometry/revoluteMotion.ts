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
 * states of a rotating body (e.g., a clamp jaw in open/closed positions).
 * 
 * Algorithm:
 * 1. Apply transform to closed points to get moved points
 * 2. Sample a subset of points for analysis
 * 3. Estimate rotation axis using displacement vectors
 * 4. Project points onto plane orthogonal to axis
 * 5. Fit circle in 2D to find center
 * 6. Compute angle from point pairs
 * 7. Extract translation magnitude from transform
 * 
 * @param pointsClosed - Point cloud for closed state (source)
 * @param pointsOpen - Point cloud for open state (target)
 * @param transform - 4x4 rigid transform matrix from ICP (pointsOpen ≈ transform * pointsClosed)
 * @returns Revolute motion parameters, or undefined if computation fails
 */
export function computeRevoluteMotionFromPointClouds(
  pointsClosed: BABYLON.Vector3[],
  pointsOpen: BABYLON.Vector3[],
  transform: BABYLON.Matrix
): RevoluteMotion | undefined {
  if (pointsClosed.length === 0 || pointsOpen.length === 0) {
    return undefined;
  }

  // Guard: need at least 3 points for stable computation
  if (pointsClosed.length < 3 || pointsOpen.length < 3) {
    return undefined;
  }

  // Step 1: Apply transform to closed points
  const moved = pointsClosed.map(p => BABYLON.Vector3.TransformCoordinates(p, transform));

  // Step 2: Sample subset of points (use first N, up to 16 for stability)
  const sampleCount = Math.min(16, Math.min(pointsClosed.length, pointsOpen.length));
  const sampledClosed: BABYLON.Vector3[] = [];
  const sampledMoved: BABYLON.Vector3[] = [];
  const sampledOpen: BABYLON.Vector3[] = [];

  for (let i = 0; i < sampleCount; i += 1) {
    sampledClosed.push(pointsClosed[i]);
    sampledMoved.push(moved[i]);
    sampledOpen.push(pointsOpen[i]);
  }

  // Step 3: Compute displacement vectors and estimate axis
  const displacements: BABYLON.Vector3[] = [];
  for (let i = 0; i < sampledClosed.length; i += 1) {
    const d = sampledMoved[i].subtract(sampledClosed[i]);
    if (d.length() > 1e-6) {
      displacements.push(d);
    }
  }

  if (displacements.length < 2) {
    return undefined;
  }

  // Estimate axis using cross products of displacement pairs
  // For a pure rotation, displacements are tangent to circles, so their cross products
  // approximate the rotation axis direction
  const axisCandidates: BABYLON.Vector3[] = [];
  for (let i = 0; i < Math.min(displacements.length, 8); i += 1) {
    for (let j = i + 1; j < Math.min(displacements.length, 8); j += 1) {
      const cross = BABYLON.Vector3.Cross(displacements[i], displacements[j]);
      if (cross.length() > 1e-6) {
        axisCandidates.push(cross.normalize());
      }
    }
  }

  if (axisCandidates.length === 0) {
    return undefined;
  }

  // Average axis candidates (simple approach: take mean direction)
  let axisSum = new BABYLON.Vector3(0, 0, 0);
  for (const candidate of axisCandidates) {
    axisSum = axisSum.add(candidate);
  }
  let axis = axisSum.normalize();

  // Guard: check axis is valid
  if (!Number.isFinite(axis.x) || !Number.isFinite(axis.y) || !Number.isFinite(axis.z)) {
    return undefined;
  }

  // Enforce consistent sign convention (e.g., prefer positive y component)
  if (axis.y < 0) {
    axis = axis.scale(-1);
  }

  // Step 4: Project points onto plane orthogonal to axis
  // Find a point on the axis (use centroid of closed points as reference)
  const centroidClosed = sampledClosed.reduce((sum, p) => sum.add(p), new BABYLON.Vector3(0, 0, 0))
    .scale(1 / sampledClosed.length);

  // Build orthonormal basis for the plane
  // Use axis as z, pick arbitrary x, compute y = z × x
  const xAxis = Math.abs(axis.x) < 0.9
    ? new BABYLON.Vector3(1, 0, 0)
    : new BABYLON.Vector3(0, 1, 0);
  const yAxis = BABYLON.Vector3.Cross(axis, xAxis).normalize();
  const planeX = BABYLON.Vector3.Cross(yAxis, axis).normalize();

  // Project points to 2D plane
  const projectedClosed: Array<{ x: number; y: number; p3d: BABYLON.Vector3 }> = [];
  const projectedMoved: Array<{ x: number; y: number; p3d: BABYLON.Vector3 }> = [];

  for (let i = 0; i < sampledClosed.length; i += 1) {
    const pClosed = sampledClosed[i];
    const pMoved = sampledMoved[i];
    
    const toClosed = pClosed.subtract(centroidClosed);
    const toMoved = pMoved.subtract(centroidClosed);
    
    const xClosed = BABYLON.Vector3.Dot(toClosed, planeX);
    const yClosed = BABYLON.Vector3.Dot(toClosed, yAxis);
    const xMoved = BABYLON.Vector3.Dot(toMoved, planeX);
    const yMoved = BABYLON.Vector3.Dot(toMoved, yAxis);
    
    projectedClosed.push({ x: xClosed, y: yClosed, p3d: pClosed });
    projectedMoved.push({ x: xMoved, y: yMoved, p3d: pMoved });
  }

  // Step 5: Fit circle in 2D (simple least-squares approach)
  // For each projected point, we have: (x - cx)^2 + (y - cy)^2 = r^2
  // Linearize: x^2 + y^2 = 2*cx*x + 2*cy*y + (r^2 - cx^2 - cy^2)
  // Solve for cx, cy using least squares
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  let sumXY = 0;
  let sumX3 = 0;
  let sumY3 = 0;
  let sumXY2 = 0;
  let sumX2Y = 0;
  let sumR2 = 0;

  for (const p of projectedClosed) {
    const x = p.x;
    const y = p.y;
    const r2 = x * x + y * y;
    
    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
    sumXY += x * y;
    sumX3 += x * x * x;
    sumY3 += y * y * y;
    sumXY2 += x * y * y;
    sumX2Y += x * x * y;
    sumR2 += r2;
  }

  const n = projectedClosed.length;
  if (n < 3) {
    return undefined;
  }

  // Solve for circle center using Kåsa method (simplified)
  // A * [cx, cy, c]^T = b, where c = r^2 - cx^2 - cy^2
  const A11 = 2 * sumX2;
  const A12 = 2 * sumXY;
  const A13 = sumX;
  const A21 = 2 * sumXY;
  const A22 = 2 * sumY2;
  const A23 = sumY;
  const A31 = sumX;
  const A32 = sumY;
  const A33 = n;

  const b1 = sumX3 + sumXY2;
  const b2 = sumY3 + sumX2Y;
  const b3 = sumR2;

  // Solve 3x3 system using Cramer's rule (simple for 3x3)
  const det = A11 * (A22 * A33 - A23 * A32) - A12 * (A21 * A33 - A23 * A31) + A13 * (A21 * A32 - A22 * A31);
  
  if (Math.abs(det) < 1e-10) {
    // Degenerate case: use centroid as center
    const cx = sumX / n;
    const cy = sumY / n;
    const center3D = centroidClosed.add(planeX.scale(cx)).add(yAxis.scale(cy));
    
    // Compute angle from point pairs
    let angleSum = 0;
    let angleCount = 0;
    for (let i = 0; i < projectedClosed.length; i += 1) {
      const pClosed = projectedClosed[i];
      const pMoved = projectedMoved[i];
      
      const vClosed = new BABYLON.Vector3(pClosed.x - cx, pClosed.y - cy, 0);
      const vMoved = new BABYLON.Vector3(pMoved.x - cx, pMoved.y - cy, 0);
      
      const lenClosed = vClosed.length();
      const lenMoved = vMoved.length();
      
      if (lenClosed > 1e-6 && lenMoved > 1e-6) {
        const dot = BABYLON.Vector3.Dot(vClosed.normalize(), vMoved.normalize());
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
        angleSum += angle;
        angleCount += 1;
      }
    }
    
    if (angleCount === 0) {
      return undefined;
    }
    
    const angleRad = angleSum / angleCount;
    let angleDeg = angleRad * (180 / Math.PI);
    
    // Enforce shortest arc
    if (angleDeg > 180) {
      angleDeg = 360 - angleDeg;
      axis = axis.scale(-1);
    }
    
    // Extract translation from transform
    const translation = new BABYLON.Vector3();
    transform.getTranslationToRef(translation);
    const translationMagnitude = translation.length();
    
    return {
      axis,
      angleDeg,
      center: center3D,
      translationMagnitude,
    };
  }

  // Solve for center coordinates
  const detX = b1 * (A22 * A33 - A23 * A32) - A12 * (b2 * A33 - A23 * b3) + A13 * (b2 * A32 - A22 * b3);
  const detY = A11 * (b2 * A33 - A23 * b3) - b1 * (A21 * A33 - A23 * A31) + A13 * (A21 * b3 - b2 * A31);

  const cx = detX / det;
  const cy = detY / det;

  // Lift center back to 3D
  const center3D = centroidClosed.add(planeX.scale(cx)).add(yAxis.scale(cy));

  // Step 6: Compute angle from point pairs
  let angleSum = 0;
  let angleCount = 0;
  for (let i = 0; i < projectedClosed.length; i += 1) {
    const pClosed = projectedClosed[i];
    const pMoved = projectedMoved[i];
    
    const vClosed = new BABYLON.Vector3(pClosed.x - cx, pClosed.y - cy, 0);
    const vMoved = new BABYLON.Vector3(pMoved.x - cx, pMoved.y - cy, 0);
    
    const lenClosed = vClosed.length();
    const lenMoved = vMoved.length();
    
    if (lenClosed > 1e-6 && lenMoved > 1e-6) {
      const dot = BABYLON.Vector3.Dot(vClosed.normalize(), vMoved.normalize());
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      
      // Determine sign using cross product (z component in plane)
      const crossZ = vClosed.x * vMoved.y - vClosed.y * vMoved.x;
      const signedAngle = crossZ >= 0 ? angle : -angle;
      
      angleSum += signedAngle;
      angleCount += 1;
    }
  }

  if (angleCount === 0) {
    return undefined;
  }

  let angleRad = angleSum / angleCount;
  let angleDeg = angleRad * (180 / Math.PI);

  // Enforce shortest arc convention
  if (angleDeg > 180) {
    angleDeg = 360 - angleDeg;
    axis = axis.scale(-1);
  } else if (angleDeg < -180) {
    angleDeg = 360 + angleDeg;
    axis = axis.scale(-1);
  }

  // Ensure angle is positive
  if (angleDeg < 0) {
    angleDeg = -angleDeg;
    axis = axis.scale(-1);
  }

  // Step 7: Extract translation magnitude from transform
  const translation = new BABYLON.Vector3();
  transform.getTranslationToRef(translation);
  const translationMagnitude = translation.length();

  // Guard: check all values are valid
  if (!Number.isFinite(angleDeg) || !Number.isFinite(translationMagnitude)) {
    return undefined;
  }

  if (!Number.isFinite(center3D.x) || !Number.isFinite(center3D.y) || !Number.isFinite(center3D.z)) {
    return undefined;
  }

  return {
    axis,
    angleDeg,
    center: center3D,
    translationMagnitude,
  };
}

