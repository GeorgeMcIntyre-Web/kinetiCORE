/**
 * Test for tooling point cloud tree formatter.
 * 
 * Run this test to generate a text tree output:
 *   npm test -- tests/domain/tooling/debugTree.test.ts
 * 
 * The output will be printed to console - copy it for analysis.
 */

import { describe, it } from 'vitest';
import type { ToolingNode, ToolingStructure, ToolingNodeGeometry } from '../../../src/domain/tooling/types';
import { formatToolingPointTree } from '../../../src/domain/tooling/debugTree';

function createNode(
  id: string,
  name: string,
  children: ToolingNode[] = []
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
  pointCount: number
): ToolingNodeGeometry {
  const points: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < pointCount; i++) {
    points.push({ x: i * 0.01, y: i * 0.01, z: i * 0.01 });
  }

  return {
    nodeId,
    points,
    bbox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 1, z: 1 },
    },
    centroid: { x: 0.5, y: 0.5, z: 0.5 },
  };
}

describe('Tooling Point Cloud Tree Formatter', () => {
  it('should format a realistic tooling structure tree', () => {
    // Build a realistic tooling structure similar to 9X_110_GEO
    const clampA1 = createNode('clamp_a1', 'CLAMP_A1');
    const clampA2 = createNode('clamp_a2', 'CLAMP_A2');
    const clampBankA = createNode('clamp_bank_a', 'CLAMP_BANK_A', [clampA1, clampA2]);

    const clampB1 = createNode('clamp_b1', 'CLAMP_B1');
    const clampB2 = createNode('clamp_b2', 'CLAMP_B2');
    const clampBankB = createNode('clamp_bank_b', 'CLAMP_BANK_B', [clampB1, clampB2]);

    const frame = createNode('frame', 'BASE_FRAME');
    const root = createNode('root', '9X_110_GEO', [frame, clampBankA, clampBankB]);

    // Update parent IDs
    frame.parentId = 'root';
    clampBankA.parentId = 'root';
    clampBankB.parentId = 'root';
    clampA1.parentId = 'clamp_bank_a';
    clampA2.parentId = 'clamp_bank_a';
    clampB1.parentId = 'clamp_bank_b';
    clampB2.parentId = 'clamp_bank_b';

    const structure: ToolingStructure = {
      root,
      nodes: new Map([
        ['root', root],
        ['frame', frame],
        ['clamp_bank_a', clampBankA],
        ['clamp_bank_b', clampBankB],
        ['clamp_a1', clampA1],
        ['clamp_a2', clampA2],
        ['clamp_b1', clampB1],
        ['clamp_b2', clampB2],
      ]),
    };

    // Create geometry index with realistic point counts
    const geometryIndex = new Map<string, ToolingNodeGeometry>([
      ['root', createGeometry('root', 125430)],
      ['frame', createGeometry('frame', 80420)],
      ['clamp_bank_a', createGeometry('clamp_bank_a', 22100)],
      ['clamp_bank_b', createGeometry('clamp_bank_b', 22800)],
      ['clamp_a1', createGeometry('clamp_a1', 7400)],
      ['clamp_a2', createGeometry('clamp_a2', 7300)],
      ['clamp_b1', createGeometry('clamp_b1', 7500)],
      ['clamp_b2', createGeometry('clamp_b2', 7600)],
    ]);

    // Format full tree
    const fullTree = formatToolingPointTree(structure, geometryIndex);
    console.log('\n=== FULL TREE ===');
    console.log(fullTree);

    // Format filtered tree (maxDepth=3, minPoints=500)
    const filteredTree = formatToolingPointTree(structure, geometryIndex, {
      maxDepth: 3,
      minPoints: 500,
    });
    console.log('\n=== FILTERED TREE (maxDepth=3, minPoints=500) ===');
    console.log(filteredTree);
  });

  it('should handle nodes without names', () => {
    const child = createNode('child1', '');
    const root = createNode('root', 'ROOT', [child]);
    child.parentId = 'root';

    const structure: ToolingStructure = {
      root,
      nodes: new Map([
        ['root', root],
        ['child1', child],
      ]),
    };

    const geometryIndex = new Map<string, ToolingNodeGeometry>([
      ['root', createGeometry('root', 1000)],
      ['child1', createGeometry('child1', 500)],
    ]);

    const tree = formatToolingPointTree(structure, geometryIndex);
    console.log('\n=== TREE WITH UNNAMED NODES ===');
    console.log(tree);
  });
});


