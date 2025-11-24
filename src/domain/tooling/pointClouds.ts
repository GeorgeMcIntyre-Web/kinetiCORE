/**
 * Point cloud utilities for tooling geometry.
 * Pure domain logic - works with Vector3 arrays.
 */

import type { Vector3, BoundingBox } from './types';

/**
 * Compute bounding box from point cloud.
 */
export function computeBoundingBox(points: Vector3[]): BoundingBox | null {
  if (points.length === 0) return null;

  let minX = points[0].x;
  let minY = points[0].y;
  let minZ = points[0].z;
  let maxX = points[0].x;
  let maxY = points[0].y;
  let maxZ = points[0].z;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

/**
 * Compute centroid from point cloud.
 */
export function computeCentroid(points: Vector3[]): Vector3 | null {
  if (points.length === 0) return null;

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumZ += p.z;
  }

  const n = points.length;
  return {
    x: sumX / n,
    y: sumY / n,
    z: sumZ / n,
  };
}

/**
 * Compute bbox extents (size vector).
 */
export function computeBboxExtents(bbox: BoundingBox): Vector3 {
  return {
    x: bbox.max.x - bbox.min.x,
    y: bbox.max.y - bbox.min.y,
    z: bbox.max.z - bbox.min.z,
  };
}

/**
 * Compute bbox volume estimate.
 */
export function computeBboxVolume(bbox: BoundingBox): number {
  const extents = computeBboxExtents(bbox);
  return extents.x * extents.y * extents.z;
}

/**
 * Compute overlap ratio between two bounding boxes (0-1).
 * Returns the ratio of intersection volume to union volume.
 */
export function computeBboxOverlapRatio(bboxA: BoundingBox, bboxB: BoundingBox): number {
  const intersectMin = {
    x: Math.max(bboxA.min.x, bboxB.min.x),
    y: Math.max(bboxA.min.y, bboxB.min.y),
    z: Math.max(bboxA.min.z, bboxB.min.z),
  };

  const intersectMax = {
    x: Math.min(bboxA.max.x, bboxB.max.x),
    y: Math.min(bboxA.max.y, bboxB.max.y),
    z: Math.min(bboxA.max.z, bboxB.max.z),
  };

  if (intersectMin.x >= intersectMax.x || intersectMin.y >= intersectMax.y || intersectMin.z >= intersectMax.z) {
    return 0;
  }

  const intersectVolume = (intersectMax.x - intersectMin.x) * (intersectMax.y - intersectMin.y) * (intersectMax.z - intersectMin.z);
  const volumeA = computeBboxVolume(bboxA);
  const volumeB = computeBboxVolume(bboxB);
  const unionVolume = volumeA + volumeB - intersectVolume;

  if (unionVolume <= 0) return 0;
  return intersectVolume / unionVolume;
}

/**
 * Compute distance between two points.
 */
export function distance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Normalize a vector.
 */
export function normalize(v: Vector3): Vector3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-10) return { x: 0, y: 0, z: 1 }; // Default to Z-up if zero
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Dot product of two vectors.
 */
export function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Project a point onto a plane perpendicular to an axis.
 * Returns the 2D coordinates in the plane.
 */
export function projectToPlane(point: Vector3, axis: Vector3): { u: number; v: number } {
  const normalizedAxis = normalize(axis);
  
  // Choose two orthogonal vectors in the plane
  // Use a heuristic: if axis is close to Z, use X and Y
  const up = { x: 0, y: 0, z: 1 };
  const dotUp = Math.abs(dot(normalizedAxis, up));
  
  if (dotUp > 0.9) {
    // Axis is close to Z, use X and Y
    return { u: point.x, v: point.y };
  }
  
  // Otherwise, project onto plane using cross product
  const temp = { x: 1, y: 0, z: 0 };
  const uVec = normalize({
    x: temp.x - dot(temp, normalizedAxis) * normalizedAxis.x,
    y: temp.y - dot(temp, normalizedAxis) * normalizedAxis.y,
    z: temp.z - dot(temp, normalizedAxis) * normalizedAxis.z,
  });
  
  const vVec = {
    x: normalizedAxis.y * uVec.z - normalizedAxis.z * uVec.y,
    y: normalizedAxis.z * uVec.x - normalizedAxis.x * uVec.z,
    z: normalizedAxis.x * uVec.y - normalizedAxis.y * uVec.x,
  };
  
  const vVecNorm = normalize(vVec);
  
  return {
    u: dot(point, uVec),
    v: dot(point, vVecNorm),
  };
}

/**
 * Compute 2D bbox overlap ratio in a plane perpendicular to an axis.
 */
export function compute2DOverlapRatio(
  pointsA: Vector3[],
  pointsB: Vector3[],
  axis: Vector3
): number {
  if (pointsA.length === 0 || pointsB.length === 0) return 0;

  const projectedA = pointsA.map(p => projectToPlane(p, axis));
  const projectedB = pointsB.map(p => projectToPlane(p, axis));

  let minUA = projectedA[0].u;
  let maxUA = projectedA[0].u;
  let minVA = projectedA[0].v;
  let maxVA = projectedA[0].v;

  for (const p of projectedA) {
    if (p.u < minUA) minUA = p.u;
    if (p.u > maxUA) maxUA = p.u;
    if (p.v < minVA) minVA = p.v;
    if (p.v > maxVA) maxVA = p.v;
  }

  let minUB = projectedB[0].u;
  let maxUB = projectedB[0].u;
  let minVB = projectedB[0].v;
  let maxVB = projectedB[0].v;

  for (const p of projectedB) {
    if (p.u < minUB) minUB = p.u;
    if (p.u > maxUB) maxUB = p.u;
    if (p.v < minVB) minVB = p.v;
    if (p.v > maxVB) maxVB = p.v;
  }

  const intersectMinU = Math.max(minUA, minUB);
  const intersectMaxU = Math.min(maxUA, maxUB);
  const intersectMinV = Math.max(minVA, minVB);
  const intersectMaxV = Math.min(maxVA, maxVB);

  if (intersectMinU >= intersectMaxU || intersectMinV >= intersectMaxV) {
    return 0;
  }

  const intersectArea = (intersectMaxU - intersectMinU) * (intersectMaxV - intersectMinV);
  const areaA = (maxUA - minUA) * (maxVA - minVA);
  const areaB = (maxUB - minUB) * (maxVB - minVB);
  const unionArea = areaA + areaB - intersectArea;

  if (unionArea <= 0) return 0;
  return intersectArea / unionArea;
}

/**
 * Find the longest dimension of a bounding box (returns axis vector).
 */
export function findLongestAxis(bbox: BoundingBox): Vector3 {
  const extents = computeBboxExtents(bbox);
  
  if (extents.x >= extents.y && extents.x >= extents.z) {
    return { x: 1, y: 0, z: 0 };
  }
  if (extents.y >= extents.z) {
    return { x: 0, y: 1, z: 0 };
  }
  return { x: 0, y: 0, z: 1 };
}


