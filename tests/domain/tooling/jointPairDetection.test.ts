/**
 * Unit tests for joint pair detection algorithm.
 */

import { describe, it, expect } from 'vitest';
import type {
  ToolingUnit,
  ToolingNodeGeometry,
  ToolingStructure,
  JointPair,
} from '../../../src/domain/tooling/types';
import { findJointPairsForUnits } from '../../../src/domain/tooling/jointPairDetection';

function createGeometry(
  nodeId: string,
  bbox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
  pointCount: number = 100
): ToolingNodeGeometry {
  const points: Array<{ x: number; y: number; z: number }> = [];
  
  for (let i = 0; i < pointCount; i++) {
    points.push({
      x: bbox.min.x + Math.random() * (bbox.max.x - bbox.min.x),
      y: bbox.min.y + Math.random() * (bbox.max.y - bbox.min.y),
      z: bbox.min.z + Math.random() * (bbox.max.z - bbox.min.z),
    });
  }

  const centroid = {
    x: (bbox.min.x + bbox.max.x) / 2,
    y: (bbox.min.y + bbox.max.y) / 2,
    z: (bbox.min.z + bbox.max.z) / 2,
  };

  return {
    nodeId,
    points,
    bbox,
    centroid,
  };
}

function createUnit(
  unitId: string,
  nodeIds: string[],
  bbox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }
): ToolingUnit {
  const centroid = {
    x: (bbox.min.x + bbox.max.x) / 2,
    y: (bbox.min.y + bbox.max.y) / 2,
    z: (bbox.min.z + bbox.max.z) / 2,
  };

  return {
    unitId,
    nodeIds,
    bbox,
    centroid,
  };
}

describe('Joint Pair Detection', () => {
  it('should return empty array for unit with less than 2 nodes', () => {
    const unit = createUnit('unit1', ['node1'], {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 1, z: 1 },
    });
    
    const geometryIndex = new Map<string, ToolingNodeGeometry>([
      ['node1', createGeometry('node1', {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1, y: 1, z: 1 },
      })],
    ]);
    
    const structure: ToolingStructure = {
      root: null,
      nodes: new Map(),
    };
    
    const pairs = findJointPairsForUnits([unit], geometryIndex, structure);
    expect(pairs).toEqual([]);
  });

  it('should detect pair of blocks at same height', () => {
    const unit = createUnit('unit1', ['nodeA', 'nodeB'], {
      min: { x: -1, y: -1, z: 0 },
      max: { x: 1, y: 1, z: 1 },
    });
    
    // Two blocks facing each other at same Z level
    const geometryA = createGeometry('nodeA', {
      min: { x: -1, y: -0.5, z: 0.4 },
      max: { x: -0.1, y: 0.5, z: 0.6 },
    });
    
    const geometryB = createGeometry('nodeB', {
      min: { x: 0.1, y: -0.5, z: 0.4 },
      max: { x: 1, y: 0.5, z: 0.6 },
    });
    
    const geometryIndex = new Map([
      ['nodeA', geometryA],
      ['nodeB', geometryB],
    ]);
    
    const structure: ToolingStructure = {
      root: null,
      nodes: new Map(),
    };
    
    const pairs = findJointPairsForUnits([unit], geometryIndex, structure, {
      minOverlapRatio: 0.2,
      maxLevelDifference: 0.2,
    });
    
    expect(pairs.length).toBeGreaterThan(0);
    const pair = pairs[0];
    expect(pair.nodeAId).toBe('nodeA');
    expect(pair.nodeBId).toBe('nodeB');
    expect(pair.score).toBeGreaterThan(0);
  });

  it('should reject pairs at different heights', () => {
    const unit = createUnit('unit1', ['nodeA', 'nodeB'], {
      min: { x: -1, y: -1, z: 0 },
      max: { x: 1, y: 1, z: 2 },
    });
    
    // Two blocks at very different Z levels
    const geometryA = createGeometry('nodeA', {
      min: { x: -0.5, y: -0.5, z: 0.1 },
      max: { x: 0.5, y: 0.5, z: 0.2 },
    });
    
    const geometryB = createGeometry('nodeB', {
      min: { x: -0.5, y: -0.5, z: 1.8 },
      max: { x: 0.5, y: 0.5, z: 1.9 },
    });
    
    const geometryIndex = new Map([
      ['nodeA', geometryA],
      ['nodeB', geometryB],
    ]);
    
    const structure: ToolingStructure = {
      root: null,
      nodes: new Map(),
    };
    
    const pairs = findJointPairsForUnits([unit], geometryIndex, structure, {
      maxLevelDifference: 0.1, // Very strict
    });
    
    expect(pairs.length).toBe(0);
  });

  it('should reject pairs with low overlap', () => {
    const unit = createUnit('unit1', ['nodeA', 'nodeB'], {
      min: { x: -2, y: -2, z: 0 },
      max: { x: 2, y: 2, z: 1 },
    });
    
    // Two blocks far apart
    const geometryA = createGeometry('nodeA', {
      min: { x: -2, y: -2, z: 0.4 },
      max: { x: -1, y: -1, z: 0.6 },
    });
    
    const geometryB = createGeometry('nodeB', {
      min: { x: 1, y: 1, z: 0.4 },
      max: { x: 2, y: 2, z: 0.6 },
    });
    
    const geometryIndex = new Map([
      ['nodeA', geometryA],
      ['nodeB', geometryB],
    ]);
    
    const structure: ToolingStructure = {
      root: null,
      nodes: new Map(),
    };
    
    const pairs = findJointPairsForUnits([unit], geometryIndex, structure, {
      minOverlapRatio: 0.3,
    });
    
    expect(pairs.length).toBe(0);
  });

  it('should handle multi-pair scenario (base + left jaw + right jaw)', () => {
    const unit = createUnit('unit1', ['base', 'leftJaw', 'rightJaw'], {
      min: { x: -1, y: -1, z: 0 },
      max: { x: 1, y: 1, z: 1 },
    });
    
    const baseGeometry = createGeometry('base', {
      min: { x: -0.3, y: -0.5, z: 0.4 },
      max: { x: 0.3, y: 0.5, z: 0.6 },
    });
    
    const leftJawGeometry = createGeometry('leftJaw', {
      min: { x: -1, y: -0.5, z: 0.4 },
      max: { x: -0.4, y: 0.5, z: 0.6 },
    });
    
    const rightJawGeometry = createGeometry('rightJaw', {
      min: { x: 0.4, y: -0.5, z: 0.4 },
      max: { x: 1, y: 0.5, z: 0.6 },
    });
    
    const geometryIndex = new Map([
      ['base', baseGeometry],
      ['leftJaw', leftJawGeometry],
      ['rightJaw', rightJawGeometry],
    ]);
    
    const structure: ToolingStructure = {
      root: null,
      nodes: new Map(),
    };
    
    const pairs = findJointPairsForUnits([unit], geometryIndex, structure, {
      minOverlapRatio: 0.2,
      maxPairsPerUnit: 4,
    });
    
    // Should find at least one good pair
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.length).toBeLessThanOrEqual(4);
  });

  it('should reject tiny nodes (bolts)', () => {
    const unit = createUnit('unit1', ['normalPart', 'tinyBolt'], {
      min: { x: -1, y: -1, z: 0 },
      max: { x: 1, y: 1, z: 1 },
    });
    
    const normalGeometry = createGeometry('normalPart', {
      min: { x: -0.5, y: -0.5, z: 0.4 },
      max: { x: 0.5, y: 0.5, z: 0.6 },
    });
    
    // Tiny bolt (very small)
    const tinyGeometry = createGeometry('tinyBolt', {
      min: { x: 0.1, y: 0.1, z: 0.45 },
      max: { x: 0.11, y: 0.11, z: 0.46 }, // 1cm cube
    }, 10);
    
    const geometryIndex = new Map([
      ['normalPart', normalGeometry],
      ['tinyBolt', tinyGeometry],
    ]);
    
    const structure: ToolingStructure = {
      root: null,
      nodes: new Map(),
    };
    
    const pairs = findJointPairsForUnits([unit], geometryIndex, structure, {
      minNodeSize: 0.01, // 1cm minimum
    });
    
    // Should not pair with tiny bolt
    const hasTinyBoltPair = pairs.some(p => p.nodeAId === 'tinyBolt' || p.nodeBId === 'tinyBolt');
    expect(hasTinyBoltPair).toBe(false);
  });

  it('should respect maxPairsPerUnit limit', () => {
    const unit = createUnit('unit1', ['node1', 'node2', 'node3', 'node4', 'node5'], {
      min: { x: -2, y: -2, z: 0 },
      max: { x: 2, y: 2, z: 1 },
    });
    
    const geometries: ToolingNodeGeometry[] = [];
    for (let i = 1; i <= 5; i++) {
      geometries.push(createGeometry(`node${i}`, {
        min: { x: -1 + (i - 1) * 0.4, y: -0.5, z: 0.4 },
        max: { x: -0.6 + (i - 1) * 0.4, y: 0.5, z: 0.6 },
      }));
    }
    
    const geometryIndex = new Map(geometries.map(g => [g.nodeId, g]));
    
    const structure: ToolingStructure = {
      root: null,
      nodes: new Map(),
    };
    
    const pairs = findJointPairsForUnits([unit], geometryIndex, structure, {
      maxPairsPerUnit: 2,
      minOverlapRatio: 0.1,
    });
    
    expect(pairs.length).toBeLessThanOrEqual(2);
  });
});

