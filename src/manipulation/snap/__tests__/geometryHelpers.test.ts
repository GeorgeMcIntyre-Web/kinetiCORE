// Tests for pure geometry math helpers

import { describe, it, expect } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { computeAreaWeightedCentroid, Triangle } from '../geometryHelpers';

describe('computeAreaWeightedCentroid', () => {
  it('should return null for empty triangle array', () => {
    const result = computeAreaWeightedCentroid([]);
    expect(result).toBeNull();
  });

  it('should return null for all degenerate triangles', () => {
    const triangles: Triangle[] = [
      {
        v0: new BABYLON.Vector3(0, 0, 0),
        v1: new BABYLON.Vector3(0, 0, 0),
        v2: new BABYLON.Vector3(0, 0, 0),
      },
    ];
    const result = computeAreaWeightedCentroid(triangles);
    expect(result).toBeNull();
  });

  it('should compute centroid for single triangle', () => {
    const triangles: Triangle[] = [
      {
        v0: new BABYLON.Vector3(0, 0, 0),
        v1: new BABYLON.Vector3(1, 0, 0),
        v2: new BABYLON.Vector3(0, 1, 0),
      },
    ];
    const result = computeAreaWeightedCentroid(triangles);
    expect(result).not.toBeNull();
    if (result) {
      // Centroid of triangle is average of vertices
      expect(result.x).toBeCloseTo(1 / 3, 6);
      expect(result.y).toBeCloseTo(1 / 3, 6);
      expect(result.z).toBeCloseTo(0, 6);
    }
  });

  it('should compute area-weighted centroid for multiple triangles', () => {
    // Two triangles: one small, one large
    const triangles: Triangle[] = [
      // Small triangle (area = 0.5)
      {
        v0: new BABYLON.Vector3(0, 0, 0),
        v1: new BABYLON.Vector3(1, 0, 0),
        v2: new BABYLON.Vector3(0, 1, 0),
      },
      // Large triangle (area = 2.0)
      {
        v0: new BABYLON.Vector3(0, 0, 0),
        v1: new BABYLON.Vector3(2, 0, 0),
        v2: new BABYLON.Vector3(0, 2, 0),
      },
    ];
    const result = computeAreaWeightedCentroid(triangles);
    expect(result).not.toBeNull();
    if (result) {
      // Small triangle center: (1/3, 1/3, 0), area: 0.5
      // Large triangle center: (2/3, 2/3, 0), area: 2.0
      // Weighted: (0.5 * (1/3, 1/3, 0) + 2.0 * (2/3, 2/3, 0)) / (0.5 + 2.0)
      // = ((1/6, 1/6, 0) + (4/3, 4/3, 0)) / 2.5
      // = (9/6, 9/6, 0) / 2.5 = (3/5, 3/5, 0)
      expect(result.x).toBeCloseTo(0.6, 6);
      expect(result.y).toBeCloseTo(0.6, 6);
      expect(result.z).toBeCloseTo(0, 6);
    }
  });

  it('should handle triangles in XY plane', () => {
    const triangles: Triangle[] = [
      {
        v0: new BABYLON.Vector3(0, 0, 0),
        v1: new BABYLON.Vector3(1, 0, 0),
        v2: new BABYLON.Vector3(0, 1, 0),
      },
    ];
    const result = computeAreaWeightedCentroid(triangles);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.z).toBeCloseTo(0, 6);
    }
  });

  it('should handle triangles in YZ plane', () => {
    const triangles: Triangle[] = [
      {
        v0: new BABYLON.Vector3(0, 0, 0),
        v1: new BABYLON.Vector3(0, 1, 0),
        v2: new BABYLON.Vector3(0, 0, 1),
      },
    ];
    const result = computeAreaWeightedCentroid(triangles);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.x).toBeCloseTo(0, 6);
    }
  });

  it('should handle triangles in arbitrary plane', () => {
    const triangles: Triangle[] = [
      {
        v0: new BABYLON.Vector3(0, 0, 0),
        v1: new BABYLON.Vector3(1, 1, 0),
        v2: new BABYLON.Vector3(0, 1, 1),
      },
    ];
    const result = computeAreaWeightedCentroid(triangles);
    expect(result).not.toBeNull();
    if (result) {
      // Centroid is average of vertices
      expect(result.x).toBeCloseTo(1 / 3, 6);
      expect(result.y).toBeCloseTo(2 / 3, 6);
      expect(result.z).toBeCloseTo(1 / 3, 6);
    }
  });

  it('should skip degenerate triangles and compute from valid ones', () => {
    const triangles: Triangle[] = [
      // Degenerate triangle
      {
        v0: new BABYLON.Vector3(0, 0, 0),
        v1: new BABYLON.Vector3(0, 0, 0),
        v2: new BABYLON.Vector3(0, 0, 0),
      },
      // Valid triangle
      {
        v0: new BABYLON.Vector3(0, 0, 0),
        v1: new BABYLON.Vector3(1, 0, 0),
        v2: new BABYLON.Vector3(0, 1, 0),
      },
    ];
    const result = computeAreaWeightedCentroid(triangles);
    expect(result).not.toBeNull();
    if (result) {
      // Should match the valid triangle's centroid
      expect(result.x).toBeCloseTo(1 / 3, 6);
      expect(result.y).toBeCloseTo(1 / 3, 6);
      expect(result.z).toBeCloseTo(0, 6);
    }
  });
});

