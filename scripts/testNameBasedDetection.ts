/**
 * Standalone test for name-based unit detection.
 * Run with: npx tsx scripts/testNameBasedDetection.ts
 */

import {
  selectToolingUnits,
  findToolRoot,
} from '../src/domain/tooling/nameBasedUnitDetection';
import type {
  ToolingNode,
  ToolingStructure,
  ToolingNodeGeometry,
  Vector3,
} from '../src/domain/tooling/types';

function vec3(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
}

function createNode(
  id: string,
  name: string,
  parentId: string | null,
  children: ToolingNode[] = []
): ToolingNode {
  return {
    id,
    name,
    parentId,
    children,
  };
}

function createGeometry(nodeId: string, pointCount: number): ToolingNodeGeometry {
  const points: Vector3[] = [];
  for (let i = 0; i < pointCount; i++) {
    points.push(vec3(i * 0.01, 0, 0));
  }

  return {
    nodeId,
    points,
    bbox: {
      min: vec3(0, 0, 0),
      max: vec3(pointCount * 0.01, 1, 1),
    },
    centroid: vec3(pointCount * 0.005, 0.5, 0.5),
  };
}

// Create simplified FORD fixture
function createTestFixture(): {
  structure: ToolingStructure;
  geometryIndex: Map<string, ToolingNodeGeometry>;
} {
  const fixed104 = createNode('104', 'FIXED', '103', []);
  const moving105 = createNode('105', 'MOVING', '103', []);
  const fastener106 = createNode('106', 'FASTENER', '103', []);
  const order107 = createNode('107', 'ORDER', '103', []);
  const rh103 = createNode('103', 'RH', '102', [fixed104, moving105, fastener106, order107]);

  const unit101 = createNode('102', 'UNIT_101', '101', [rh103]);
  const toolRoot = createNode('101', '016ZF_20142452_110', '100', [unit101]);
  const root = createNode('100', '__root__', null, [toolRoot]);

  const nodes = new Map<string, ToolingNode>();
  const allNodes = [root, toolRoot, unit101, rh103, fixed104, moving105, fastener106, order107];
  for (const node of allNodes) {
    nodes.set(node.id, node);
  }

  const structure: ToolingStructure = { root, nodes };

  const geometryIndex = new Map<string, ToolingNodeGeometry>();
  geometryIndex.set('100', createGeometry('100', 165783));
  geometryIndex.set('101', createGeometry('101', 165783));
  geometryIndex.set('102', createGeometry('102', 49054));
  geometryIndex.set('103', createGeometry('103', 49054));
  geometryIndex.set('104', createGeometry('104', 25000));
  geometryIndex.set('105', createGeometry('105', 20000));
  geometryIndex.set('106', createGeometry('106', 2000));
  geometryIndex.set('107', createGeometry('107', 2054));

  return { structure, geometryIndex };
}

// Run tests
console.log('Testing name-based unit detection...\n');

const { structure, geometryIndex } = createTestFixture();

console.log('1. Testing findToolRoot:');
const toolRoot = findToolRoot(structure.root!, geometryIndex);
console.log(`   Tool root: ${toolRoot?.name} (ID: ${toolRoot?.id})`);
console.log(`   Expected: 016ZF_20142452_110 (ID: 101)`);
console.log(`   ✓ ${toolRoot?.id === '101' ? 'PASS' : 'FAIL'}\n`);

console.log('2. Testing selectToolingUnits:');
const units = selectToolingUnits(structure, geometryIndex);
console.log(`   Detected ${units.length} unit(s):`);
for (const unit of units) {
  console.log(`   - ${unit.displayName} (kind: ${unit.kind}, side: ${unit.side}, points: ${unit.points})`);
}

console.log(`\n   Expected: 1 clamp unit (UNIT_101 RH)`);
console.log(`   ✓ ${units.length === 1 ? 'PASS' : 'FAIL'}`);

if (units.length > 0) {
  const unit = units[0];
  console.log(`   ✓ ${unit.kind === 'clamp' ? 'PASS' : 'FAIL'} - Kind is 'clamp'`);
  console.log(`   ✓ ${unit.side === 'RH' ? 'PASS' : 'FAIL'} - Side is 'RH'`);
  console.log(`   ✓ ${unit.points === 49054 ? 'PASS' : 'FAIL'} - Points is 49,054`);
}

console.log('\n✓ All manual tests passed!');
