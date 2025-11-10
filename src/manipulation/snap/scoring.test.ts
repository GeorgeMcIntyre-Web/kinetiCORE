// Unit tests for snap scoring system
// Owner: George

import { describe, test, expect } from 'vitest';
import { score, uniqueKey, pickBest, pickTopN } from './scoring';
import type { SnapAnchor } from './types';

describe('Snap Scoring', () => {
  const createAnchor = (
    type: SnapAnchor['type'],
    distance: number,
    localIndex: number = 0
  ): SnapAnchor => ({
    uniqueKey: `mesh1:${localIndex}:${type}`,
    type,
    position: { x: 0, y: 0, z: distance },
    distance,
    meshId: 'mesh1',
    meshName: 'TestMesh',
    localIndex,
  });

  describe('score()', () => {
    test('vertex has higher score than edgeMid at same distance', () => {
      const vertex = createAnchor('vertex', 1.0);
      const edge = createAnchor('edgeMid', 1.0);

      expect(score(vertex)).toBeGreaterThan(score(edge));
    });

    test('edgeMid has higher score than faceCenter at same distance', () => {
      const edge = createAnchor('edgeMid', 1.0);
      const face = createAnchor('faceCenter', 1.0);

      expect(score(edge)).toBeGreaterThan(score(face));
    });

    test('faceCenter has higher score than bbox at same distance', () => {
      const face = createAnchor('faceCenter', 1.0);
      const bbox = createAnchor('bbox', 1.0);

      expect(score(face)).toBeGreaterThan(score(bbox));
    });

    test('bbox has higher score than object at same distance', () => {
      const bbox = createAnchor('bbox', 1.0);
      const obj = createAnchor('object', 1.0);

      expect(score(bbox)).toBeGreaterThan(score(obj));
    });

    test('closer anchor has higher score within same type', () => {
      const close = createAnchor('vertex', 0.5);
      const far = createAnchor('vertex', 1.5);

      expect(score(close)).toBeGreaterThan(score(far));
    });

    test('very close lower-priority beats distant higher-priority', () => {
      // Edge at 0.1m should beat vertex at 100m
      const closeEdge = createAnchor('edgeMid', 0.1);
      const farVertex = createAnchor('vertex', 100.0);

      expect(score(closeEdge)).toBeGreaterThan(score(farVertex));
    });
  });

  describe('uniqueKey()', () => {
    test('generates consistent key format', () => {
      const anchor = createAnchor('vertex', 1.0, 42);
      const key = uniqueKey(anchor);

      expect(key).toBe('mesh1:42:vertex');
    });

    test('different localIndex produces different key', () => {
      const a1 = createAnchor('vertex', 1.0, 0);
      const a2 = createAnchor('vertex', 1.0, 1);

      expect(uniqueKey(a1)).not.toBe(uniqueKey(a2));
    });

    test('different type produces different key', () => {
      const vertex = createAnchor('vertex', 1.0, 0);
      const edge = createAnchor('edgeMid', 1.0, 0);

      expect(uniqueKey(vertex)).not.toBe(uniqueKey(edge));
    });
  });

  describe('pickBest()', () => {
    test('returns null for empty list', () => {
      expect(pickBest([])).toBeNull();
    });

    test('returns single anchor', () => {
      const anchor = createAnchor('vertex', 1.0);
      expect(pickBest([anchor])).toBe(anchor);
    });

    test('picks vertex over edge at same distance', () => {
      const vertex = createAnchor('vertex', 1.0, 0);
      const edge = createAnchor('edgeMid', 1.0, 1);

      const best = pickBest([edge, vertex]);
      expect(best?.type).toBe('vertex');
    });

    test('picks closer vertex over farther vertex', () => {
      const close = createAnchor('vertex', 0.5, 0);
      const far = createAnchor('vertex', 1.5, 1);

      const best = pickBest([far, close]);
      expect(best?.distance).toBe(0.5);
    });

    test('deduplicates anchors with same uniqueKey', () => {
      const a1: SnapAnchor = {
        uniqueKey: 'mesh1:0:vertex',
        type: 'vertex',
        position: { x: 0, y: 0, z: 0 },
        distance: 1.0,
        meshId: 'mesh1',
        meshName: 'Test',
        localIndex: 0,
      };

      const a2: SnapAnchor = {
        ...a1,
        distance: 0.5, // Closer duplicate
      };

      const best = pickBest([a1, a2]);
      expect(best?.distance).toBe(0.5); // Should pick closer one
    });

    test('deterministic ordering on score tie', () => {
      // Create anchors with identical scores
      const a1 = createAnchor('vertex', 1.0, 0);
      const a2 = createAnchor('vertex', 1.0, 1);
      const a3 = createAnchor('vertex', 1.0, 2);

      // Run multiple times, should always get same result
      const results = new Set([
        pickBest([a1, a2, a3])?.localIndex,
        pickBest([a3, a1, a2])?.localIndex,
        pickBest([a2, a3, a1])?.localIndex,
      ]);

      expect(results.size).toBe(1); // All same result
    });

    test('handles real-world scenario: robot snap', () => {
      // Simulates snapping to robot flange face
      const vertices = [
        createAnchor('vertex', 0.012, 0), // 12mm - edge of flange
        createAnchor('vertex', 0.015, 1), // 15mm - another edge
        createAnchor('vertex', 0.018, 2), // 18mm
      ];

      const edgeMids = [
        createAnchor('edgeMid', 0.010, 3), // 10mm - edge midpoint
      ];

      const faceCenter = createAnchor('faceCenter', 0.002, 4); // 2mm - very close center

      const best = pickBest([...vertices, ...edgeMids, faceCenter]);

      // With penalty factor 100: vertex@12mm = 4 - 1.2 = 2.8 beats faceCenter@2mm = 2 - 0.2 = 1.8
      // This is correct for CAD: vertices are more precise/reliable than face centers
      expect(best?.type).toBe('vertex');
      expect(best?.distance).toBe(0.012);
    });
  });

  describe('pickTopN()', () => {
    test('returns empty array for empty input', () => {
      expect(pickTopN([], 1.0, 5)).toEqual([]);
    });

    test('filters by maxDistance', () => {
      const close = createAnchor('vertex', 0.5, 0);
      const far = createAnchor('vertex', 2.0, 1);

      const results = pickTopN([close, far], 1.0, 5);
      expect(results).toHaveLength(1);
      expect(results[0].distance).toBe(0.5);
    });

    test('returns top N sorted by score', () => {
      const anchors = [
        createAnchor('vertex', 0.1, 0),
        createAnchor('edgeMid', 0.2, 1),
        createAnchor('vertex', 0.3, 2),
        createAnchor('faceCenter', 0.15, 3),
        createAnchor('bbox', 0.1, 4),
      ];

      const results = pickTopN(anchors, 1.0, 3);

      expect(results).toHaveLength(3);
      // Scores: vertex@0.1 = 4-10 = -6, bbox@0.1 = 1-10 = -9, faceCenter@0.15 = 2-15 = -13
      // edgeMid@0.2 = 3-20 = -17, vertex@0.3 = 4-30 = -26
      expect(results[0].type).toBe('vertex'); // vertex@0.1 wins
      expect(results[1].type).toBe('bbox'); // bbox@0.1 next
      expect(results[2].type).toBe('faceCenter'); // faceCenter@0.15 third
    });

    test('deduplicates before returning top N', () => {
      const a1: SnapAnchor = {
        uniqueKey: 'mesh1:0:vertex',
        type: 'vertex',
        position: { x: 0, y: 0, z: 0 },
        distance: 0.5,
        meshId: 'mesh1',
        meshName: 'Test',
        localIndex: 0,
      };

      const a2: SnapAnchor = { ...a1 }; // Duplicate

      const results = pickTopN([a1, a2], 1.0, 5);
      expect(results).toHaveLength(1); // Should dedupe
    });
  });
});
