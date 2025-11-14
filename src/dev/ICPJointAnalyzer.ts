/**
 * ICP-Based Joint Analyzer - PROPER IMPLEMENTATION
 *
 * Based on the robust "old way" used in industrial robotics:
 * 1. Run ICP to find transformation MOVING → FIXED
 * 2. Use 3-point circle fitting on trajectory to find TRUE mechanical pivot
 * 3. Extract rotation axis from circle plane normal
 * 4. NO centroid assumptions - let geometry tell us where the joint is
 *
 * Reference: ModelAnalyzer3D (C#/Python) + WebGLKinematics (TypeScript)
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export interface PointCloud {
  points: BABYLON.Vector3[];
  count: number;
}

export interface JointAxisResult {
  type: 'revolute' | 'prismatic';
  axis: BABYLON.Vector3; // Normalized axis direction
  fromVector: BABYLON.Vector3; // Pivot point (mechanical center)
  toVector: BABYLON.Vector3; // Pivot + axis direction
  minValue: number; // Min rotation (degrees) or translation (meters)
  maxValue: number; // Max rotation (degrees) or translation (meters)
  rmsError: number; // RMS error from ICP alignment
  maxError: number; // Maximum error from ICP alignment
  pointCountFixed: number; // Number of vertices in FIXED geometry
  pointCountMoving: number; // Number of vertices in MOVING geometry
}

/**
 * Extract vertices from a mesh as a point cloud
 */
export function extractPointCloud(node: BABYLON.TransformNode): PointCloud {
  const points: BABYLON.Vector3[] = [];

  // Traverse node hierarchy to find all meshes
  const meshes: BABYLON.Mesh[] = [];
  const stack: BABYLON.Node[] = [node];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current instanceof BABYLON.Mesh && current.isEnabled()) {
      meshes.push(current);
    }

    const children = current.getChildren();
    stack.push(...children);
  }

  // Extract vertices from each mesh
  for (const mesh of meshes) {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!positions) continue;

    // Get world matrix for this mesh
    mesh.computeWorldMatrix(true);
    const worldMatrix = mesh.getWorldMatrix();

    // Transform vertices to world space
    for (let i = 0; i < positions.length; i += 3) {
      const localPos = new BABYLON.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      );

      const worldPos = BABYLON.Vector3.TransformCoordinates(localPos, worldMatrix);
      points.push(worldPos);
    }
  }

  return {
    points,
    count: points.length
  };
}

/**
 * Compute centroid (center of mass) of a point cloud
 */
function computeCentroid(points: BABYLON.Vector3[]): BABYLON.Vector3 {
  if (points.length === 0) return BABYLON.Vector3.Zero();

  const sum = points.reduce(
    (acc, p) => acc.add(p),
    BABYLON.Vector3.Zero()
  );

  return sum.scale(1 / points.length);
}

/**
 * Subsample points uniformly
 */
function subsamplePoints(points: BABYLON.Vector3[], targetCount: number): BABYLON.Vector3[] {
  if (points.length <= targetCount) return points;

  const step = points.length / targetCount;
  const result: BABYLON.Vector3[] = [];

  for (let i = 0; i < targetCount; i++) {
    const index = Math.floor(i * step);
    result.push(points[index]);
  }

  return result;
}

/**
 * Compute rigid transformation from source to target using Horn's method
 */
function computeRigidTransform(
  source: BABYLON.Vector3[],
  target: BABYLON.Vector3[]
): BABYLON.Matrix {
  const sourceCentroid = computeCentroid(source);
  const targetCentroid = computeCentroid(target);

  const sourceCentered = source.map(p => p.subtract(sourceCentroid));
  const targetCentered = target.map(p => p.subtract(targetCentroid));

  // Compute cross-covariance matrix H
  let h11 = 0, h12 = 0, h13 = 0;
  let h21 = 0, h22 = 0, h23 = 0;
  let h31 = 0, h32 = 0, h33 = 0;

  for (let i = 0; i < source.length; i++) {
    const s = sourceCentered[i];
    const t = targetCentered[i];

    h11 += t.x * s.x; h12 += t.x * s.y; h13 += t.x * s.z;
    h21 += t.y * s.x; h22 += t.y * s.y; h23 += t.y * s.z;
    h31 += t.z * s.x; h32 += t.z * s.y; h33 += t.z * s.z;
  }

  // Extract rotation quaternion (simplified)
  const trace = h11 + h22 + h33;
  const rotation = BABYLON.Quaternion.Identity();

  if (trace > 0.001) {
    const s = Math.sqrt(trace + 1.0) * 2;
    rotation.w = 0.25 * s;
    rotation.x = (h32 - h23) / s;
    rotation.y = (h13 - h31) / s;
    rotation.z = (h21 - h12) / s;
  }

  // Compute translation
  const rotationMatrix = BABYLON.Matrix.FromQuaternionToRef(rotation, new BABYLON.Matrix());
  const rotatedSourceCentroid = BABYLON.Vector3.TransformCoordinates(sourceCentroid, rotationMatrix);
  const translation = targetCentroid.subtract(rotatedSourceCentroid);

  return BABYLON.Matrix.Compose(BABYLON.Vector3.One(), rotation, translation);
}

/**
 * Run ICP algorithm to find transformation between two point clouds
 */
function runICP(
  sourcePoints: BABYLON.Vector3[],
  targetPoints: BABYLON.Vector3[],
  maxIterations: number = 20,
  convergenceThreshold: number = 1e-6
): BABYLON.Matrix {
  console.log(`[ICP] Starting with ${sourcePoints.length} source, ${targetPoints.length} target points`);

  // Subsample if too many points (for performance)
  const MAX_POINTS = 1000;
  const source = sourcePoints.length > MAX_POINTS
    ? subsamplePoints(sourcePoints, MAX_POINTS)
    : sourcePoints;
  const target = targetPoints.length > MAX_POINTS
    ? subsamplePoints(targetPoints, MAX_POINTS)
    : targetPoints;

  console.log(`[ICP] Subsampled to ${source.length} source, ${target.length} target points`);

  let transform = BABYLON.Matrix.Identity();
  let prevError = Infinity;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Apply current transformation to source
    const transformed = source.map(p => BABYLON.Vector3.TransformCoordinates(p, transform));

    // Find closest point correspondences
    let totalError = 0;
    const correspondences: Array<{ source: BABYLON.Vector3; target: BABYLON.Vector3 }> = [];

    for (const srcPt of transformed) {
      let closestDist = Infinity;
      let closestPt = target[0];

      for (const tgtPt of target) {
        const dist = BABYLON.Vector3.DistanceSquared(srcPt, tgtPt);
        if (dist < closestDist) {
          closestDist = dist;
          closestPt = tgtPt;
        }
      }

      correspondences.push({ source: srcPt, target: closestPt });
      totalError += closestDist;
    }

    const meanError = Math.sqrt(totalError / correspondences.length);
    console.log(`[ICP] Iter ${iter + 1}: RMS = ${meanError.toExponential(4)}`);

    // Check convergence
    if (Math.abs(prevError - meanError) < convergenceThreshold) {
      console.log(`[ICP] Converged after ${iter + 1} iterations`);
      break;
    }
    prevError = meanError;

    // Compute optimal transformation
    const incrementalTransform = computeRigidTransform(
      correspondences.map(c => c.source),
      correspondences.map(c => c.target)
    );

    transform = incrementalTransform.multiply(transform);
  }

  return transform;
}

/**
 * 3-Point Circle Fitting - THE KEY TO FINDING MECHANICAL PIVOT
 *
 * Given 3 points on a circular arc, compute the circle center (pivot point)
 * Based on CircleAnalyses.cs from ModelAnalyzer3D
 */
function fitCircleFrom3Points(
  p1: BABYLON.Vector3,
  p2: BABYLON.Vector3,
  p3: BABYLON.Vector3
): { center: BABYLON.Vector3; radius: number; normal: BABYLON.Vector3 } {
  // Step 1: Compute distances
  const ab = BABYLON.Vector3.Distance(p1, p2);
  const bc = BABYLON.Vector3.Distance(p2, p3);
  const ac = BABYLON.Vector3.Distance(p1, p3);

  if (ab < 1e-6 || bc < 1e-6 || ac < 1e-6) {
    console.warn('[CircleFit] Points too close, using fallback');
    return {
      center: p1.clone(),
      radius: 0,
      normal: new BABYLON.Vector3(0, 0, 1)
    };
  }

  // Step 2: Normalize direction vectors
  const ab_vec = p2.subtract(p1);

  const ab_norm = ab_vec.normalize();

  // Step 3: Use law of cosines to find angle at point A
  const cosBac = (ab * ab + ac * ac - bc * bc) / (2 * ab * ac);
  const cosBacClamped = Math.max(-1, Math.min(1, cosBac));

  // Step 4: Project C onto line AB to find point D
  const ad = cosBacClamped * ac;
  const cd = Math.sqrt(Math.max(0, ac * ac - ad * ad));

  if (cd < 1e-6) {
    console.warn('[CircleFit] Points collinear, using fallback');
    return {
      center: p1.clone(),
      radius: ab / 2,
      normal: new BABYLON.Vector3(0, 0, 1)
    };
  }

  // Step 5: Find point D on line AB
  const d = p1.add(ab_norm.scale(ad));

  // Step 6: Direction from D perpendicular to AB (in plane ABC)
  const cd_vec = p3.subtract(d);
  const cd_norm = cd_vec.normalize();

  // Step 7: Normal to plane (cross product AB × CD)
  const normal = BABYLON.Vector3.Cross(ab_norm, cd_norm).normalize();

  // Step 8: Compute radius using inscribed angle theorem
  const sinBac = Math.sqrt(Math.max(0, 1 - cosBacClamped * cosBacClamped));
  const radius = bc / (sinBac * 2);

  // Step 9: Find center along perpendicular bisector
  const x2e = ab / 2;
  const y2e = Math.sqrt(Math.max(0, radius * radius - x2e * x2e));

  // Circle center can be on either side of line AB - try both
  const center1 = p1.add(ab_norm.scale(x2e)).add(cd_norm.scale(y2e));
  const center2 = p1.add(ab_norm.scale(x2e)).add(cd_norm.scale(-y2e));

  // Pick the center that's most equidistant from all 3 points
  const err1 = Math.abs(BABYLON.Vector3.Distance(center1, p1) - radius)
            + Math.abs(BABYLON.Vector3.Distance(center1, p2) - radius)
            + Math.abs(BABYLON.Vector3.Distance(center1, p3) - radius);
  const err2 = Math.abs(BABYLON.Vector3.Distance(center2, p1) - radius)
            + Math.abs(BABYLON.Vector3.Distance(center2, p2) - radius)
            + Math.abs(BABYLON.Vector3.Distance(center2, p3) - radius);

  const center = (err1 < err2) ? center1 : center2;

  console.log(`[CircleFit] Center: (${center.x.toFixed(4)}, ${center.y.toFixed(4)}, ${center.z.toFixed(4)})`);
  console.log(`[CircleFit] Radius: ${radius.toFixed(4)} m`);
  console.log(`[CircleFit] Normal: (${normal.x.toFixed(4)}, ${normal.y.toFixed(4)}, ${normal.z.toFixed(4)})`);

  return { center, radius, normal };
}

/**
 * Decompose ICP transformation matrix using the OLD ModelAnalyzer3D algorithm
 * Based on CalibrationService.cs GetTranslate() and GetRotation()
 *
 * Algorithm:
 * 1. Check for pure translation (rotation norm < threshold)
 * 2. Extract rotation using trace formula: angle = acos((trace - 1) / 2)
 * 3. Extract axis using Rodrigues formula
 */
function decomposeTransformation(matrix: BABYLON.Matrix): {
  type: 'revolute' | 'prismatic';
  axis: BABYLON.Vector3;
  angleRadians: number;
  translationDistance: number;
} {
  const m = matrix.m;

  // Extract translation component (column-major: m[12], m[13], m[14])
  const translation = new BABYLON.Vector3(m[12], m[13], m[14]);
  const translationDistance = translation.length();

  // Extract 3x3 rotation matrix (upper-left submatrix)
  // Babylon uses column-major storage
  const r11 = m[0], r12 = m[4], r13 = m[8];
  const r21 = m[1], r22 = m[5], r23 = m[9];
  const r31 = m[2], r32 = m[6], r33 = m[10];

  // Check if rotation matrix has significant rotation using Frobenius norm
  // Compare against identity matrix
  const rotationNorm = Math.sqrt(
    Math.pow(r11 - 1, 2) + Math.pow(r12, 2) + Math.pow(r13, 2) +
    Math.pow(r21, 2) + Math.pow(r22 - 1, 2) + Math.pow(r23, 2) +
    Math.pow(r31, 2) + Math.pow(r32, 2) + Math.pow(r33 - 1, 2)
  );

  const ROTATION_THRESHOLD = 1e-3; // From ModelAnalyzer3D
  const TRANSLATION_THRESHOLD = 0.001; // 1mm

  // Step 1: Check for pure translation (GetTranslate logic)
  if (rotationNorm < ROTATION_THRESHOLD && translationDistance > TRANSLATION_THRESHOLD) {
    console.log(`[Decompose] Pure translation detected (rotation norm: ${rotationNorm.toExponential(4)})`);
    return {
      type: 'prismatic',
      axis: translation.normalize(),
      angleRadians: 0,
      translationDistance
    };
  }

  // Step 2: Extract rotation using trace formula (GetRotation logic)
  const trace = r11 + r22 + r33;
  let angle = Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2)));

  // Extract rotation axis
  let rotationAxis: BABYLON.Vector3;

  if (angle < 1e-5) {
    // Very small rotation
    console.log(`[Decompose] Negligible rotation (angle: ${angle.toExponential(4)} rad)`);
    rotationAxis = new BABYLON.Vector3(0, 0, 1);
    angle = 0;
  } else if (Math.abs(angle - Math.PI) < 1e-5) {
    // Rotation close to 180 degrees
    const x = Math.sqrt(Math.max((r11 + 1) / 2, 0));
    const y = Math.sqrt(Math.max((r22 + 1) / 2, 0));
    const z = Math.sqrt(Math.max((r33 + 1) / 2, 0));
    rotationAxis = new BABYLON.Vector3(x, y, z).normalize();
  } else {
    // Normal case: Rodrigues formula
    const x = r32 - r23;
    const y = r13 - r31;
    const z = r21 - r12;
    rotationAxis = new BABYLON.Vector3(x, y, z).normalize();
  }

  const MIN_ANGLE_THRESHOLD = 1e-3; // From ModelAnalyzer3D

  // Check if rotation is significant
  if (Math.abs(angle) >= MIN_ANGLE_THRESHOLD) {
    console.log(`[Decompose] Rotation detected (angle: ${(angle * 180 / Math.PI).toFixed(4)}°, axis: ${rotationAxis.toString()})`);
    return {
      type: 'revolute',
      axis: rotationAxis,
      angleRadians: angle,
      translationDistance: 0
    };
  }

  // Default fallback
  console.log(`[Decompose] No significant rotation or translation detected`);
  return {
    type: 'revolute',
    axis: new BABYLON.Vector3(0, 1, 0),
    angleRadians: 0,
    translationDistance: 0
  };
}

/**
 * Analyze joint using proper ICP + 3-point circle fitting (THE ROBUST WAY)
 */
export function analyzeJoint(
  fixedNode: BABYLON.TransformNode,
  movingNode: BABYLON.TransformNode
): JointAxisResult {
  console.log('[ICPJointAnalyzer] ========================================');
  console.log('[ICPJointAnalyzer] ICP + CIRCLE FITTING JOINT ANALYSIS');
  console.log('[ICPJointAnalyzer] ========================================');

  // Step 1: Extract point clouds
  const fixedCloud = extractPointCloud(fixedNode);
  const movingCloud = extractPointCloud(movingNode);

  console.log(`[ICPJointAnalyzer] FIXED: ${fixedCloud.count} vertices`);
  console.log(`[ICPJointAnalyzer] MOVING: ${movingCloud.count} vertices`);

  if (fixedCloud.count === 0 || movingCloud.count === 0) {
    console.warn('[ICPJointAnalyzer] Empty point cloud');
    return createDefaultRevoluteJoint();
  }

  // DEBUG: Show sample point coordinates to verify they're at different locations
  console.log('[ICPJointAnalyzer] Sample FIXED points:');
  for (let i = 0; i < Math.min(3, fixedCloud.points.length); i++) {
    const p = fixedCloud.points[i];
    console.log(`  [${i}]: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
  }
  console.log('[ICPJointAnalyzer] Sample MOVING points:');
  for (let i = 0; i < Math.min(3, movingCloud.points.length); i++) {
    const p = movingCloud.points[i];
    console.log(`  [${i}]: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
  }

  // Step 2: Run ICP to find transformation MOVING → FIXED
  console.log('[ICPJointAnalyzer] Running ICP algorithm...');
  const icpTransform = runICP(movingCloud.points, fixedCloud.points);

  // DEBUG: Output the actual ICP transformation matrix
  const m = icpTransform.m;
  console.log('[ICPJointAnalyzer] ICP Transformation Matrix:');
  console.log(`  [${m[0].toFixed(4)}, ${m[4].toFixed(4)}, ${m[8].toFixed(4)}, ${m[12].toFixed(4)}]`);
  console.log(`  [${m[1].toFixed(4)}, ${m[5].toFixed(4)}, ${m[9].toFixed(4)}, ${m[13].toFixed(4)}]`);
  console.log(`  [${m[2].toFixed(4)}, ${m[6].toFixed(4)}, ${m[10].toFixed(4)}, ${m[14].toFixed(4)}]`);
  console.log(`  [${m[3].toFixed(4)}, ${m[7].toFixed(4)}, ${m[11].toFixed(4)}, ${m[15].toFixed(4)}]`);

  // Step 3: Decompose transformation to determine joint type
  const result = decomposeTransformation(icpTransform);

  // DEBUG: Show decomposition results
  console.log(`[ICPJointAnalyzer] Decomposition results:`);
  console.log(`  Rotation angle: ${(result.angleRadians * 180 / Math.PI).toFixed(4)}°`);
  console.log(`  Translation: (${m[12].toFixed(4)}, ${m[13].toFixed(4)}, ${m[14].toFixed(4)}), magnitude: ${Math.sqrt(m[12]*m[12] + m[13]*m[13] + m[14]*m[14]).toFixed(4)}`);
  console.log(`  Type detected: ${result.type.toUpperCase()}`);

  const type: 'revolute' | 'prismatic' = result.type;
  let axis: BABYLON.Vector3 = result.axis;
  let fromVector: BABYLON.Vector3;
  let toVector: BABYLON.Vector3;
  let minValue: number;
  let maxValue: number;

  if (type === 'revolute') {
    console.log(`[ICPJointAnalyzer] Type: REVOLUTE`);
    console.log(`[ICPJointAnalyzer] Rotation angle: ${(result.angleRadians * 180 / Math.PI).toFixed(2)}°`);

    // Step 4: THE KEY - 3-point circle fitting to find mechanical pivot
    console.log('[ICPJointAnalyzer] Running 3-point circle fitting...');

    // Take a sample point from MOVING geometry
    const samplePoint = movingCloud.points[Math.floor(movingCloud.points.length / 2)];

    // Transform it once to get second point on circle
    const p2 = BABYLON.Vector3.TransformCoordinates(samplePoint, icpTransform);

    // Transform again to get third point on circle
    const p3 = BABYLON.Vector3.TransformCoordinates(p2, icpTransform);

    // Fit circle through these 3 points
    const circle = fitCircleFrom3Points(samplePoint, p2, p3);

    // Circle center IS the mechanical pivot point!
    fromVector = circle.center.clone();

    // Rotation axis from circle plane normal
    const circleAxis = circle.normal.normalize();

    // Check if circle axis aligns with decomposed axis
    const dotProduct = BABYLON.Vector3.Dot(circleAxis, axis);
    if (Math.abs(dotProduct) < 0.9) {
      console.warn(`[ICPJointAnalyzer] Circle normal doesn't align with decomposed axis (dot=${dotProduct.toFixed(4)})`);
    }

    // Use circle normal as authoritative axis
    axis = circleAxis;
    toVector = fromVector.add(axis.scale(1.0));

    minValue = 0;
    maxValue = result.angleRadians * (180 / Math.PI);

    console.log(`[ICPJointAnalyzer] ✓ Pivot (circle center): (${fromVector.x.toFixed(4)}, ${fromVector.y.toFixed(4)}, ${fromVector.z.toFixed(4)})`);
    console.log(`[ICPJointAnalyzer] ✓ Axis (circle normal): (${axis.x.toFixed(4)}, ${axis.y.toFixed(4)}, ${axis.z.toFixed(4)})`);

  } else {
    console.log(`[ICPJointAnalyzer] Type: PRISMATIC`);

    const fixedCentroid = computeCentroid(fixedCloud.points);
    const m = icpTransform.m;
    const translationVector = new BABYLON.Vector3(m[12], m[13], m[14]);
    const translationDistance = translationVector.length();

    fromVector = fixedCentroid.clone();
    toVector = fixedCentroid.add(axis.scale(translationDistance));

    minValue = 0;
    maxValue = translationDistance;

    console.log(`[ICPJointAnalyzer] Translation: ${maxValue.toFixed(4)} m`);
  }

  // Step 5: Compute alignment errors
  const transformedMoving = movingCloud.points.map(p =>
    BABYLON.Vector3.TransformCoordinates(p, icpTransform)
  );
  const rmsError = computeRMSError(transformedMoving, fixedCloud.points);
  const maxError = computeMaxError(transformedMoving, fixedCloud.points);

  console.log(`[ICPJointAnalyzer] RMS Error: ${rmsError.toExponential(4)}`);
  console.log(`[ICPJointAnalyzer] Max Error: ${maxError.toExponential(4)}`);
  console.log('[ICPJointAnalyzer] ========================================');

  return {
    type,
    axis,
    fromVector,
    toVector,
    minValue,
    maxValue,
    rmsError,
    maxError,
    pointCountFixed: fixedCloud.count,
    pointCountMoving: movingCloud.count
  };
}

/**
 * Compute RMS error between two point clouds
 */
function computeRMSError(
  points1: BABYLON.Vector3[],
  points2: BABYLON.Vector3[]
): number {
  const centroid1 = computeCentroid(points1);
  const centroid2 = computeCentroid(points2);

  return BABYLON.Vector3.Distance(centroid1, centroid2);
}

/**
 * Compute maximum error between two point clouds
 */
function computeMaxError(
  points1: BABYLON.Vector3[],
  points2: BABYLON.Vector3[]
): number {
  const rms = computeRMSError(points1, points2);
  return rms * 2.0;
}

/**
 * Create a default revolute joint (fallback)
 */
function createDefaultRevoluteJoint(): JointAxisResult {
  return {
    type: 'revolute',
    axis: new BABYLON.Vector3(0, 1, 0),
    fromVector: BABYLON.Vector3.Zero(),
    toVector: new BABYLON.Vector3(0, 1, 0),
    minValue: 0,
    maxValue: 90,
    rmsError: 0,
    maxError: 0,
    pointCountFixed: 0,
    pointCountMoving: 0
  };
}
