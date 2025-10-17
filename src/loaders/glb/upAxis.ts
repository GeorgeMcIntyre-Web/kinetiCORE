// GLB Up-Axis Auto-Detection & Fix Utility
// Owner: George (Architecture)
// Purpose: Detect Z-up vs Y-up geometry and normalize to Y-up (Babylon standard)
// Strategy: PCA + AABB heuristics + rotation analysis

import {
  Mesh,
  TransformNode,
  Vector3,
  Quaternion,
  VertexBuffer,
  Angle
} from '@babylonjs/core';

export type UpAxis = 'Y' | 'Z' | 'Unknown';

export interface UpAxisDetectionResult {
  detectedAxis: UpAxis;
  confidence: number; // 0.0 - 1.0
  method: 'PCA' | 'AABB' | 'Rotation' | 'Combined';
  applied: boolean;
}

export interface UpAxisOptions {
  bake?: boolean;
  verbose?: boolean;
  confidenceThreshold?: number;
  autoFix?: boolean;
}

/**
 * Auto-detect and optionally fix up-axis orientation of a GLB model
 * Guard rail: Comprehensive detection with multiple fallback strategies
 */
export function autoFixUpAxis(
  root: TransformNode,
  opts?: UpAxisOptions
): UpAxisDetectionResult {
  const defaultOpts: Required<UpAxisOptions> = {
    bake: true,
    verbose: false,
    confidenceThreshold: 0.6,
    autoFix: true,
    ...opts
  };

  const meshes = root.getChildMeshes() as Mesh[];

  // Guard: No meshes to analyze
  if (meshes.length === 0) {
    return createResult('Unknown', 0, 'PCA', false);
  }

  const positions = collectWorldPositions(meshes);

  // Guard: Insufficient vertex data
  if (positions.length < 3) {
    return createResult('Unknown', 0, 'PCA', false);
  }

  // Strategy 1: Principal Component Analysis
  const pcaResult = detectViaPCA(positions);

  // Guard: High confidence from PCA
  if (pcaResult.confidence >= defaultOpts.confidenceThreshold) {
    return applyFix(root, pcaResult, defaultOpts);
  }

  // Strategy 2: AABB extent ratio analysis
  const aabbResult = detectViaAABB(positions);

  // Guard: High confidence from AABB
  if (aabbResult.confidence >= defaultOpts.confidenceThreshold) {
    return applyFix(root, aabbResult, defaultOpts);
  }

  // Guard: AABB detected something (even weak) - trust it for flat objects
  if (aabbResult.detectedAxis !== 'Unknown') {
    console.log(`[UpAxis] Using AABB result (${aabbResult.detectedAxis}-up) - PCA was ambiguous`);
    return applyFix(root, aabbResult, defaultOpts);
  }

  // Strategy 3: Root rotation analysis (only if AABB failed)
  const rotationResult = detectViaRotation(root);

  // Guard: High confidence from rotation
  if (rotationResult.confidence >= defaultOpts.confidenceThreshold) {
    return applyFix(root, rotationResult, defaultOpts);
  }

  // Strategy 4: Combined weighted decision (last resort)
  const combinedResult = combineDetectionResults([pcaResult, aabbResult, rotationResult]);

  return applyFix(root, combinedResult, defaultOpts);
}

/**
 * Collect world-space vertex positions from all meshes
 * Guard rail: Handles missing vertex data gracefully
 */
function collectWorldPositions(meshes: Mesh[]): Vector3[] {
  const positions: Vector3[] = [];

  for (const mesh of meshes) {
    // Guard: Skip meshes without position data
    const posData = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (posData === null) {
      continue;
    }

    const worldMatrix = mesh.getWorldMatrix();

    // Sample vertices (use all for small meshes, sample for large ones)
    const stride = posData.length > 30000 ? 9 : 3; // Sample every 3rd vertex for large meshes

    for (let i = 0; i < posData.length; i += stride) {
      const localPos = new Vector3(posData[i], posData[i + 1], posData[i + 2]);
      const worldPos = Vector3.TransformCoordinates(localPos, worldMatrix);
      positions.push(worldPos);
    }
  }

  return positions;
}

/**
 * Detect up-axis using Principal Component Analysis
 * Returns the dominant geometric direction
 */
function detectViaPCA(points: Vector3[]): UpAxisDetectionResult {
  const mean = computeCentroid(points);

  // Compute covariance matrix elements
  let xx = 0, xy = 0, xz = 0;
  let yy = 0, yz = 0, zz = 0;

  for (const p of points) {
    const dx = p.x - mean.x;
    const dy = p.y - mean.y;
    const dz = p.z - mean.z;

    xx += dx * dx;
    xy += dx * dy;
    xz += dx * dz;
    yy += dy * dy;
    yz += dy * dz;
    zz += dz * dz;
  }

  // Power iteration to find dominant eigenvector
  const principal = computeDominantEigenvector(xx, xy, xz, yy, yz, zz);

  // Compare principal direction to world Y and Z axes
  const yDot = Math.abs(Vector3.Dot(principal, Vector3.Up()));
  const zDot = Math.abs(Vector3.Dot(principal, new Vector3(0, 0, 1)));

  const diff = Math.abs(zDot - yDot);

  console.log(`[UpAxis] PCA Analysis:`, {
    principalDir: `(${principal.x.toFixed(3)}, ${principal.y.toFixed(3)}, ${principal.z.toFixed(3)})`,
    yDot: yDot.toFixed(3),
    zDot: zDot.toFixed(3),
    diff: diff.toFixed(3)
  });

  // Guard: Clear Z-up detection
  if (zDot > yDot && diff > 0.2) {
    console.log(`[UpAxis] PCA detected Z-up (Z-dot: ${zDot.toFixed(3)} > Y-dot: ${yDot.toFixed(3)})`);
    return createResult('Z', Math.min(diff * 2, 1.0), 'PCA', false);
  }

  // Guard: Clear Y-up detection
  if (yDot > zDot && diff > 0.2) {
    console.log(`[UpAxis] PCA detected Y-up (Y-dot: ${yDot.toFixed(3)} > Z-dot: ${zDot.toFixed(3)})`);
    return createResult('Y', Math.min(diff * 2, 1.0), 'PCA', false);
  }

  // Ambiguous result
  console.log(`[UpAxis] PCA ambiguous (diff: ${diff.toFixed(3)} < 0.2)`);
  return createResult('Unknown', diff, 'PCA', false);
}

/**
 * Detect up-axis using AABB extent ratios
 * Assumes tall objects are oriented along up-axis
 */
function detectViaAABB(points: Vector3[]): UpAxisDetectionResult {
  const extents = computeAABBExtents(points);

  const yToZ = extents.y / Math.max(extents.z, 1e-6);
  const zToY = extents.z / Math.max(extents.y, 1e-6);

  console.log(`[UpAxis] AABB Analysis:`, {
    extentX: extents.x.toFixed(3),
    extentY: extents.y.toFixed(3),
    extentZ: extents.z.toFixed(3),
    yToZ: yToZ.toFixed(3),
    zToY: zToY.toFixed(3)
  });

  // Guard: Strong Z-up detection (high confidence)
  if (zToY > 1.6) {
    const confidence = Math.min((zToY - 1.0) / 2.0, 1.0);
    console.log(`[UpAxis] AABB detected Z-up (strong) (Z/Y ratio: ${zToY.toFixed(2)} > 1.6)`);
    return createResult('Z', confidence, 'AABB', false);
  }

  // Guard: Strong Y-up detection (high confidence)
  if (yToZ > 1.6) {
    const confidence = Math.min((yToZ - 1.0) / 2.0, 1.0);
    console.log(`[UpAxis] AABB detected Y-up (strong) (Y/Z ratio: ${yToZ.toFixed(2)} > 1.6)`);
    return createResult('Y', confidence, 'AABB', false);
  }

  // Guard: Weak Z-up detection (lower threshold for flat parts)
  if (zToY > 1.05 && zToY > yToZ) {
    const confidence = Math.min((zToY - 1.0) / 1.0, 0.6);
    console.log(`[UpAxis] AABB detected Z-up (weak) (Z/Y ratio: ${zToY.toFixed(2)} > 1.05)`);
    return createResult('Z', confidence, 'AABB', false);
  }

  // Guard: Weak Y-up detection (lower threshold for flat parts)
  if (yToZ > 1.05 && yToZ > zToY) {
    const confidence = Math.min((yToZ - 1.0) / 1.0, 0.6);
    console.log(`[UpAxis] AABB detected Y-up (weak) (Y/Z ratio: ${yToZ.toFixed(2)} > 1.05)`);
    return createResult('Y', confidence, 'AABB', false);
  }

  // Similar extents - truly ambiguous
  console.log(`[UpAxis] AABB ambiguous (ratios too close: Y/Z=${yToZ.toFixed(2)}, Z/Y=${zToY.toFixed(2)})`);
  return createResult('Unknown', 0.3, 'AABB', false);
}

/**
 * Detect up-axis by analyzing root node rotation
 * Checks for ~90° rotation about X axis (common Z-up→Y-up conversion)
 */
function detectViaRotation(root: TransformNode): UpAxisDetectionResult {
  const rotation = root.rotation;
  const rotQuat = root.rotationQuaternion;

  // Check Euler rotation
  if (rotation) {
    const xRotDeg = Math.abs(Angle.FromRadians(rotation.x).degrees());

    // Guard: Near 90° or 270° rotation about X
    if (Math.abs(xRotDeg - 90) < 15 || Math.abs(xRotDeg - 270) < 15) {
      const confidence = 1.0 - Math.min(Math.abs(xRotDeg - 90), Math.abs(xRotDeg - 270)) / 15;
      return createResult('Z', confidence, 'Rotation', false);
    }
  }

  // Check quaternion rotation
  if (rotQuat) {
    const euler = rotQuat.toEulerAngles();
    const xRotDeg = Math.abs(Angle.FromRadians(euler.x).degrees());

    if (Math.abs(xRotDeg - 90) < 15 || Math.abs(xRotDeg - 270) < 15) {
      const confidence = 1.0 - Math.min(Math.abs(xRotDeg - 90), Math.abs(xRotDeg - 270)) / 15;
      return createResult('Z', confidence, 'Rotation', false);
    }
  }

  return createResult('Y', 0.5, 'Rotation', false);
}

/**
 * Combine multiple detection results using weighted voting
 */
function combineDetectionResults(results: UpAxisDetectionResult[]): UpAxisDetectionResult {
  let zScore = 0;
  let yScore = 0;

  for (const result of results) {
    if (result.detectedAxis === 'Z') {
      zScore += result.confidence;
    } else if (result.detectedAxis === 'Y') {
      yScore += result.confidence;
    }
  }

  const totalScore = zScore + yScore;

  // Guard: No clear winner
  if (totalScore < 0.1) {
    return createResult('Unknown', 0, 'Combined', false);
  }

  if (zScore > yScore) {
    return createResult('Z', zScore / totalScore, 'Combined', false);
  }

  return createResult('Y', yScore / totalScore, 'Combined', false);
}

/**
 * Apply Z-up to Y-up conversion and optionally bake transforms
 */
function applyFix(
  root: TransformNode,
  result: UpAxisDetectionResult,
  opts: Required<UpAxisOptions>
): UpAxisDetectionResult {
  // Guard: Don't fix if not Z-up
  if (result.detectedAxis !== 'Z') {
    if (opts.verbose) {
      console.log(`[UpAxis] No fix needed - detected as ${result.detectedAxis}-up (${result.method}, confidence: ${result.confidence.toFixed(2)})`);
    }
    return result;
  }

  // Guard: Don't fix if auto-fix disabled
  if (opts.autoFix === false) {
    if (opts.verbose) {
      console.log(`[UpAxis] Z-up detected but auto-fix disabled (${result.method}, confidence: ${result.confidence.toFixed(2)})`);
    }
    return result;
  }

  // Apply Z-up → Y-up rotation (-90° about X)
  rotateZupToYup(root);

  if (opts.verbose) {
    console.log(`[UpAxis] Applied Z→Y fix (${result.method}, confidence: ${result.confidence.toFixed(2)})`);
  }

  // ALWAYS bake transforms when applying up-axis fix to ensure correct positioning
  // This is critical - without baking, meshes appear scattered due to transform inheritance
  bakeHierarchyTransforms(root);

  if (opts.verbose) {
    console.log('[UpAxis] Baked rotation into vertices');
  }

  return { ...result, applied: true };
}

/**
 * Rotate Z-up model to Y-up by applying -90° rotation about X axis
 */
function rotateZupToYup(root: TransformNode): void {
  const rotationQuat = Quaternion.RotationAxis(
    Vector3.Right(),
    Angle.FromDegrees(-90).radians()
  );

  // Guard: Preserve existing rotation
  if (root.rotationQuaternion === null) {
    root.rotationQuaternion = Quaternion.Identity();
  }

  root.rotationQuaternion = rotationQuat.multiply(root.rotationQuaternion);
}

/**
 * Bake root rotation into all child meshes without losing relative positions
 * Guard rail: Only bakes meshes with vertex data
 *
 * Strategy: Apply root rotation to each mesh's vertices in world space,
 * then restore the mesh's local transform. This preserves relative positioning.
 */
function bakeHierarchyTransforms(root: TransformNode): void {
  const meshes = root.getChildMeshes() as Mesh[];

  // Guard: No rotation to bake
  if (root.rotationQuaternion === null || root.rotationQuaternion.equals(Quaternion.Identity())) {
    return;
  }

  const rootRotation = root.rotationQuaternion.clone();

  for (const mesh of meshes) {
    // Guard: Only bake if mesh has vertex data
    if (mesh.getVerticesData(VertexBuffer.PositionKind) === null) {
      continue;
    }

    // Store original local transform
    const originalPosition = mesh.position.clone();
    const originalRotation = mesh.rotation.clone();
    const originalScaling = mesh.scaling.clone();
    const originalRotationQuat = mesh.rotationQuaternion?.clone() || null;

    // Apply root rotation to this mesh
    if (mesh.rotationQuaternion === null) {
      mesh.rotationQuaternion = Quaternion.Identity();
    }
    mesh.rotationQuaternion = rootRotation.multiply(mesh.rotationQuaternion);

    // Bake the combined rotation into vertices
    mesh.bakeCurrentTransformIntoVertices();

    // Restore original local transform (preserves relative position)
    mesh.position = originalPosition;
    mesh.rotation = originalRotation;
    mesh.scaling = originalScaling;
    mesh.rotationQuaternion = originalRotationQuat;
  }

  // Reset root transform to identity (rotation is now baked into all children)
  root.position.set(0, 0, 0);
  root.scaling.set(1, 1, 1);
  root.rotation = Vector3.Zero();
  root.rotationQuaternion = Quaternion.Identity();
}

/**
 * Compute dominant eigenvector via power iteration
 */
function computeDominantEigenvector(
  xx: number, xy: number, xz: number,
  yy: number, yz: number, zz: number
): Vector3 {
  let v = new Vector3(0.0, 1.0, 0.1).normalize(); // Initial seed

  for (let iter = 0; iter < 20; iter++) {
    const nx = xx * v.x + xy * v.y + xz * v.z;
    const ny = xy * v.x + yy * v.y + yz * v.z;
    const nz = xz * v.x + yz * v.y + zz * v.z;

    const nv = new Vector3(nx, ny, nz);
    const len = nv.length();

    // Guard: Degenerate case
    if (len < 1e-9) {
      break;
    }

    const nvNorm = nv.scale(1 / len);

    // Guard: Converged
    if (Vector3.DistanceSquared(nvNorm, v) < 1e-8) {
      break;
    }

    v = nvNorm;
  }

  return v.normalize();
}

/**
 * Compute centroid of point cloud
 */
function computeCentroid(points: Vector3[]): Vector3 {
  let sx = 0, sy = 0, sz = 0;

  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sz += p.z;
  }

  const inv = 1.0 / points.length;
  return new Vector3(sx * inv, sy * inv, sz * inv);
}

/**
 * Compute AABB extents
 */
function computeAABBExtents(points: Vector3[]): { x: number; y: number; z: number } {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }

  return {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ
  };
}

/**
 * Create detection result object
 */
function createResult(
  axis: UpAxis,
  confidence: number,
  method: UpAxisDetectionResult['method'],
  applied: boolean
): UpAxisDetectionResult {
  return {
    detectedAxis: axis,
    confidence: Math.max(0, Math.min(1, confidence)),
    method,
    applied
  };
}
