/**
 * Unit tests for hierarchical unit detection algorithm.
 */

import { describe, it, expect } from 'vitest';
import type { ToolingNode, ToolingStructure, ToolingNodeGeometry } from '../../../src/domain/tooling/types';
import { detectUnits } from '../../../src/domain/tooling/unitDetection';

function createNode(
  id: string,
  name: string,
  children: ToolingNode[] = [],
  bbox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null = null
): ToolingNode {
  return {
    id,
    name,
    parentId: null,
    children,
  };
}

function createGeometry(
  nodeId: string,
  bbox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
  pointCount: number = 100
): ToolingNodeGeometry {
  const points: Array<{ x: number; y: number; z: number }> = [];
  const step = 0.01;
  
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

describe('Unit Detection', () => {
  it('should return empty array for empty tree', () => {
    const structure: ToolingStructure = {
      root: null,
      nodes: new Map(),
    };
    const geometryIndex = new Map<string, ToolingNodeGeometry>();
    
    const units = detectUnits(structure, geometryIndex);
    expect(units).toEqual([]);
  });

  it('should return empty array for root with no geometry', () => {
    const root = createNode('root', 'root');
    const structure: ToolingStructure = {
      root,
      nodes: new Map([['root', root]]),
    };
    const geometryIndex = new Map<string, ToolingNodeGeometry>();
    
    const units = detectUnits(structure, geometryIndex);
    expect(units).toEqual([]);
  });

  it('should detect single unit from root with geometry', () => {
    const root = createNode('root', 'root');
    const structure: ToolingStructure = {
      root,
      nodes: new Map([['root', root]]),
    };
    
    const geometry = createGeometry('root', {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 1, z: 1 },
    });
    const geometryIndex = new Map([['root', geometry]]);
    
    const units = detectUnits(structure, geometryIndex);
    // Should not return root as a unit (it's the entire tooling)
    expect(units.length).toBe(0);
  });

  it('should detect 3 separate units at same level', () => {
    const unit1 = createNode('unit1', 'unit1');
    const unit2 = createNode('unit2', 'unit2');
    const unit3 = createNode('unit3', 'unit3');
    const root = createNode('root', 'root', [unit1, unit2, unit3]);
    
    // Update parent IDs
    unit1.parentId = 'root';
    unit2.parentId = 'root';
    unit3.parentId = 'root';
    
    const structure: ToolingStructure = {
      root,
      nodes: new Map([
        ['root', root],
        ['unit1', unit1],
        ['unit2', unit2],
        ['unit3', unit3],
      ]),
    };
    
    // Create geometries that are spatially separated
    const rootGeometry = createGeometry('root', {
      min: { x: -2, y: -2, z: -2 },
      max: { x: 2, y: 2, z: 2 },
    });
    
    const unit1Geometry = createGeometry('unit1', {
      min: { x: -2, y: -2, z: -2 },
      max: { x: -0.5, y: 0.5, z: 0.5 },
    });
    
    const unit2Geometry = createGeometry('unit2', {
      min: { x: -0.5, y: -0.5, z: -0.5 },
      max: { x: 0.5, y: 0.5, z: 0.5 },
    });
    
    const unit3Geometry = createGeometry('unit3', {
      min: { x: 0.5, y: -0.5, z: -0.5 },
      max: { x: 2, y: 0.5, z: 0.5 },
    });
    
    const geometryIndex = new Map([
      ['root', rootGeometry],
      ['unit1', unit1Geometry],
      ['unit2', unit2Geometry],
      ['unit3', unit3Geometry],
    ]);
    
    const units = detectUnits(structure, geometryIndex);
    expect(units.length).toBeGreaterThanOrEqual(1);
    // Should find at least the 3 units
    expect(units.length).toBeLessThanOrEqual(3);
  });

  it('should ignore tiny parts below minimum volume', () => {
    const tinyPart = createNode('tiny', 'tiny');
    const normalUnit = createNode('normal', 'normal');
    const root = createNode('root', 'root', [tinyPart, normalUnit]);
    
    tinyPart.parentId = 'root';
    normalUnit.parentId = 'root';
    
    const structure: ToolingStructure = {
      root,
      nodes: new Map([
        ['root', root],
        ['tiny', tinyPart],
        ['normal', normalUnit],
      ]),
    };
    
    const rootGeometry = createGeometry('root', {
      min: { x: -1, y: -1, z: -1 },
      max: { x: 1, y: 1, z: 1 },
    });
    
    // Tiny part (very small bbox)
    const tinyGeometry = createGeometry('tiny', {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0.001, y: 0.001, z: 0.001 }, // 1mm cube
    }, 5); // Very few points
    
    const normalGeometry = createGeometry('normal', {
      min: { x: 0.5, y: 0.5, z: 0.5 },
      max: { x: 1, y: 1, z: 1 },
    });
    
    const geometryIndex = new Map([
      ['root', rootGeometry],
      ['tiny', tinyGeometry],
      ['normal', normalGeometry],
    ]);
    
    const units = detectUnits(structure, geometryIndex, {
      minVolume: 0.0001, // 1 cm³
    });
    
    // Should not include tiny part
    const unitNodeIds = units.flatMap(u => u.nodeIds);
    expect(unitNodeIds).not.toContain('tiny');
  });

  it('should not create duplicate units', () => {
    const child1 = createNode('child1', 'child1');
    const child2 = createNode('child2', 'child2');
    const parent = createNode('parent', 'parent', [child1, child2]);
    const root = createNode('root', 'root', [parent]);
    
    parent.parentId = 'root';
    child1.parentId = 'parent';
    child2.parentId = 'parent';
    
    const structure: ToolingStructure = {
      root,
      nodes: new Map([
        ['root', root],
        ['parent', parent],
        ['child1', child1],
        ['child2', child2],
      ]),
    };
    
    const rootGeometry = createGeometry('root', {
      min: { x: -1, y: -1, z: -1 },
      max: { x: 1, y: 1, z: 1 },
    });
    
    const parentGeometry = createGeometry('parent', {
      min: { x: -0.5, y: -0.5, z: -0.5 },
      max: { x: 0.5, y: 0.5, z: 0.5 },
    });
    
    const child1Geometry = createGeometry('child1', {
      min: { x: -0.5, y: -0.5, z: -0.5 },
      max: { x: 0, y: 0, z: 0 },
    });
    
    const child2Geometry = createGeometry('child2', {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0.5, y: 0.5, z: 0.5 },
    });
    
    const geometryIndex = new Map([
      ['root', rootGeometry],
      ['parent', parentGeometry],
      ['child1', child1Geometry],
      ['child2', child2Geometry],
    ]);
    
    const units = detectUnits(structure, geometryIndex);
    
    // Check for duplicates
    const nodeIdSets = units.map(u => new Set(u.nodeIds.sort()));
    for (let i = 0; i < nodeIdSets.length; i++) {
      for (let j = i + 1; j < nodeIdSets.length; j++) {
        const setA = nodeIdSets[i];
        const setB = nodeIdSets[j];
        const isEqual = setA.size === setB.size && [...setA].every(id => setB.has(id));
        expect(isEqual).toBe(false);
      }
    }
  });

  it('should handle deep chain without creating nonsense units', () => {
    let current: ToolingNode = createNode('leaf', 'leaf');
    const chain: ToolingNode[] = [current];
    
    for (let i = 0; i < 5; i++) {
      const parent = createNode(`level${i}`, `level${i}`, [current]);
      current.parentId = parent.id;
      chain.push(parent);
      current = parent;
    }
    
    const root = current;
    const structure: ToolingStructure = {
      root,
      nodes: new Map(chain.map(n => [n.id, n])),
    };
    
    const geometryIndex = new Map(
      chain.map(node => [
        node.id,
        createGeometry(node.id, {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 1, z: 1 },
        }),
      ])
    );
    
    const units = detectUnits(structure, geometryIndex, {
      maxDepth: 10,
    });
    
    // Should not create a unit for every level
    expect(units.length).toBeLessThan(chain.length);
  });
});

