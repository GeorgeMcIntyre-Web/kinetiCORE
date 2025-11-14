// Pure geometry math helpers for snap calculations
// Extracted for testability and reuse

import * as BABYLON from '@babylonjs/core';

/**
 * Triangle data structure for area-weighted centroid calculation
 */
export interface Triangle {
  v0: BABYLON.Vector3;
  v1: BABYLON.Vector3;
  v2: BABYLON.Vector3;
}

/**
 * Compute area-weighted centroid of triangles
 * Formula: centroid = Σ(area_i * center_i) / Σ(area_i)
 * where area_i = 0.5 * |(v1 - v0) × (v2 - v0)|
 * 
 * @param triangles - Array of triangles (each with v0, v1, v2 vertices)
 * @returns Area-weighted centroid or null if no valid triangles
 */
export function computeAreaWeightedCentroid(
  triangles: Triangle[]
): BABYLON.Vector3 | null {
  if (triangles.length === 0) {
    return null;
  }

  let totalArea = 0;
  const weightedSum = BABYLON.Vector3.Zero();

  for (const tri of triangles) {
    const edge1 = tri.v1.subtract(tri.v0);
    const edge2 = tri.v2.subtract(tri.v0);
    const cross = BABYLON.Vector3.Cross(edge1, edge2);
    const area = 0.5 * cross.length();

    // Skip degenerate triangles (zero or near-zero area)
    if (area < 1e-10) {
      continue;
    }

    const center = tri.v0.add(tri.v1).add(tri.v2).scale(1 / 3);
    weightedSum.addInPlace(center.scale(area));
    totalArea += area;
  }

  if (totalArea < 1e-10) {
    return null;
  }

  return weightedSum.scale(1 / totalArea);
}

