/**
 * Tests for state-based rigid-group and unit detection.
 */

import { describe, it, expect } from 'vitest';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import {
  detectRigidGroups,
  detectUnitsFromState,
  type StateBasedRigidGroupsInput,
  type StateBasedUnitDetectionInput,
  type KinematicSnapshot,
} from '../../../src/domain/tooling/stateBasedUnitDetection';
import type {
  ToolingNode,
  ToolingStructure,
  ToolingNodeGeometry,
  JointPair,
  Vector3,
} from '../../../src/domain/tooling/types';

/**
 * Helper to create a node.
 */
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

/**
 * Helper to create a matrix from position.
 */
function createMatrix(x: number, y: number, z: number): Matrix {
  return Matrix.Translation(x, y, z);
}

/**
 * Helper to create geometry.
 */
function createGeometry(nodeId: string, pointCount: number): ToolingNodeGeometry {
  const points: Vector3[] = [];
  for (let i = 0; i < pointCount; i++) {
    points.push({ x: i * 0.01, y: 0, z: 0 });
  }

  return {
    nodeId,
    points,
    bbox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: pointCount * 0.01, y: 1, z: 1 },
    },
    centroid: { x: pointCount * 0.005, y: 0.5, z: 0.5 },
  };
}

describe('detectRigidGroups', () => {
  it('should detect single moving group vs static base group', () => {
    const nodeA = createNode('nodeA', 'NodeA', null, []);
    const nodeB = createNode('nodeB', 'NodeB', null, []);
    const nodeC = createNode('nodeC', 'NodeC', null, []);
    const root = createNode('root', 'Root', null, [nodeA, nodeB, nodeC]);

    const nodes = new Map<string, ToolingNode>();
    nodes.set('root', root);
    nodes.set('nodeA', nodeA);
    nodes.set('nodeB', nodeB);
    nodes.set('nodeC', nodeC);

    const structure: ToolingStructure = { root, nodes };

    const geometryIndex = new Map<string, ToolingNodeGeometry>();
    geometryIndex.set('root', createGeometry('root', 0));
    geometryIndex.set('nodeA', createGeometry('nodeA', 100));
    geometryIndex.set('nodeB', createGeometry('nodeB', 100));
    geometryIndex.set('nodeC', createGeometry('nodeC', 50));

    const snapshot1: KinematicSnapshot = {
      stateId: 'open',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeA', createMatrix(0, 0, 0)],
        ['nodeB', createMatrix(0, 0, 0)],
        ['nodeC', createMatrix(0, 0, 0)],
      ]),
    };

    const snapshot2: KinematicSnapshot = {
      stateId: 'closed',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeA', createMatrix(0, 0, 0)],
        ['nodeB', createMatrix(0, 0, 0)],
        ['nodeC', createMatrix(1, 0, 0)],
      ]),
    };

    const input: StateBasedRigidGroupsInput = {
      structure,
      geometryIndex,
      snapshots: [snapshot1, snapshot2],
    };

    const result = detectRigidGroups(input);

    expect(result.rigidGroups.length).toBe(3);

    const staticGroups = result.rigidGroups.filter(g => g.isStatic);
    expect(staticGroups.length).toBe(2);

    const movingGroups = result.rigidGroups.filter(g => !g.isStatic);
    expect(movingGroups.length).toBe(1);

    const baseGroup = result.rigidGroups.find(g => g.id === result.baseGroupId);
    expect(baseGroup).toBeDefined();
    expect(baseGroup?.isStatic).toBe(true);
    expect(baseGroup?.totalPoints).toBeGreaterThanOrEqual(200);
  });

  it('should detect single static group when all nodes static', () => {
    const nodeA = createNode('nodeA', 'NodeA', null, []);
    const nodeB = createNode('nodeB', 'NodeB', null, []);
    const nodeC = createNode('nodeC', 'NodeC', null, []);
    const root = createNode('root', 'Root', null, [nodeA, nodeB, nodeC]);

    const nodes = new Map<string, ToolingNode>();
    nodes.set('root', root);
    nodes.set('nodeA', nodeA);
    nodes.set('nodeB', nodeB);
    nodes.set('nodeC', nodeC);

    const structure: ToolingStructure = { root, nodes };

    const geometryIndex = new Map<string, ToolingNodeGeometry>();
    geometryIndex.set('root', createGeometry('root', 50));
    geometryIndex.set('nodeA', createGeometry('nodeA', 50));
    geometryIndex.set('nodeB', createGeometry('nodeB', 50));
    geometryIndex.set('nodeC', createGeometry('nodeC', 50));

    const snapshot1: KinematicSnapshot = {
      stateId: 'open',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeA', createMatrix(0, 0, 0)],
        ['nodeB', createMatrix(0, 0, 0)],
        ['nodeC', createMatrix(0, 0, 0)],
      ]),
    };

    const snapshot2: KinematicSnapshot = {
      stateId: 'closed',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeA', createMatrix(0, 0, 0)],
        ['nodeB', createMatrix(0, 0, 0)],
        ['nodeC', createMatrix(0, 0, 0)],
      ]),
    };

    const input: StateBasedRigidGroupsInput = {
      structure,
      geometryIndex,
      snapshots: [snapshot1, snapshot2],
    };

    const result = detectRigidGroups(input);

    expect(result.rigidGroups.length).toBe(1);

    const group = result.rigidGroups[0];
    expect(group.isStatic).toBe(true);
    expect(group.nodeIds.length).toBe(4);
    expect(group.totalPoints).toBe(200);

    expect(result.baseGroupId).toBe(group.id);
  });

  it('should return empty result for less than 2 snapshots', () => {
    const root = createNode('root', 'Root', null, []);
    const structure: ToolingStructure = { root, nodes: new Map([['root', root]]) };
    const geometryIndex = new Map<string, ToolingNodeGeometry>();

    const snapshot1: KinematicSnapshot = {
      stateId: 'open',
      nodeWorldMatrices: new Map([['root', createMatrix(0, 0, 0)]]),
    };

    const input: StateBasedRigidGroupsInput = {
      structure,
      geometryIndex,
      snapshots: [snapshot1],
    };

    const result = detectRigidGroups(input);

    expect(result.rigidGroups.length).toBe(0);
    expect(result.baseGroupId).toBe('');
  });

  it('should exclude nodes with missing snapshot data', () => {
    const nodeA = createNode('nodeA', 'NodeA', null, []);
    const nodeB = createNode('nodeB', 'NodeB', null, []);
    const root = createNode('root', 'Root', null, [nodeA, nodeB]);

    const nodes = new Map<string, ToolingNode>();
    nodes.set('root', root);
    nodes.set('nodeA', nodeA);
    nodes.set('nodeB', nodeB);

    const structure: ToolingStructure = { root, nodes };

    const geometryIndex = new Map<string, ToolingNodeGeometry>();
    geometryIndex.set('root', createGeometry('root', 10));
    geometryIndex.set('nodeA', createGeometry('nodeA', 100));
    geometryIndex.set('nodeB', createGeometry('nodeB', 50));

    const snapshot1: KinematicSnapshot = {
      stateId: 'open',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeA', createMatrix(0, 0, 0)],
        ['nodeB', createMatrix(0, 0, 0)],
      ]),
    };

    const snapshot2: KinematicSnapshot = {
      stateId: 'closed',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeA', createMatrix(0, 0, 0)],
      ]),
    };

    const input: StateBasedRigidGroupsInput = {
      structure,
      geometryIndex,
      snapshots: [snapshot1, snapshot2],
    };

    const result = detectRigidGroups(input);

    expect(result.rigidGroups.length).toBe(1);

    const group = result.rigidGroups[0];
    expect(group.nodeIds).toContain('root');
    expect(group.nodeIds).toContain('nodeA');
    expect(group.nodeIds).not.toContain('nodeB');
  });
});

describe('detectUnitsFromState', () => {
  it('should build one actuated unit from base + one moving group', () => {
    const nodeA = createNode('nodeA', 'NodeA', null, []);
    const nodeB = createNode('nodeB', 'NodeB', null, []);
    const nodeC = createNode('nodeC', 'NodeC', null, []);
    const root = createNode('root', 'Root', null, [nodeA, nodeB, nodeC]);

    const nodes = new Map<string, ToolingNode>();
    nodes.set('root', root);
    nodes.set('nodeA', nodeA);
    nodes.set('nodeB', nodeB);
    nodes.set('nodeC', nodeC);

    const structure: ToolingStructure = { root, nodes };

    const geometryIndex = new Map<string, ToolingNodeGeometry>();
    geometryIndex.set('root', createGeometry('root', 0));
    geometryIndex.set('nodeA', createGeometry('nodeA', 100));
    geometryIndex.set('nodeB', createGeometry('nodeB', 100));
    geometryIndex.set('nodeC', createGeometry('nodeC', 50));

    const snapshot1: KinematicSnapshot = {
      stateId: 'open',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeA', createMatrix(0, 0, 0)],
        ['nodeB', createMatrix(0, 0, 0)],
        ['nodeC', createMatrix(0, 0, 0)],
      ]),
    };

    const snapshot2: KinematicSnapshot = {
      stateId: 'closed',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeA', createMatrix(0, 0, 0)],
        ['nodeB', createMatrix(0, 0, 0)],
        ['nodeC', createMatrix(1, 0, 0)],
      ]),
    };

    const joint: JointPair = {
      unitId: '',
      nodeAId: 'nodeA',
      nodeBId: 'nodeC',
      score: 1.0,
      axis: { x: 1, y: 0, z: 0 },
      gap: 0.05,
      overlapRatio: 0.8,
    };

    const input: StateBasedUnitDetectionInput = {
      structure,
      geometryIndex,
      snapshots: [snapshot1, snapshot2],
      joints: [joint],
    };

    const result = detectUnitsFromState(input);

    expect(result.units.length).toBe(1);

    const unit = result.units[0];
    expect(unit.type).toBe('actuated');
    expect(unit.baseGroupId).toBeDefined();
    expect(unit.movingGroupIds.length).toBe(1);
    expect(unit.jointIds.length).toBe(1);

    const baseGroup = result.rigidGroups.find(g => g.id === unit.baseGroupId);
    expect(baseGroup?.isStatic).toBe(true);
  });

  it('should create two independent actuated units', () => {
    const nodeBase = createNode('nodeBase', 'NodeBase', null, []);
    const nodeMoving1 = createNode('nodeMoving1', 'NodeMoving1', null, []);
    const nodeMoving2 = createNode('nodeMoving2', 'NodeMoving2', null, []);
    const root = createNode('root', 'Root', null, [nodeBase, nodeMoving1, nodeMoving2]);

    const nodes = new Map<string, ToolingNode>();
    nodes.set('root', root);
    nodes.set('nodeBase', nodeBase);
    nodes.set('nodeMoving1', nodeMoving1);
    nodes.set('nodeMoving2', nodeMoving2);

    const structure: ToolingStructure = { root, nodes };

    const geometryIndex = new Map<string, ToolingNodeGeometry>();
    geometryIndex.set('root', createGeometry('root', 0));
    geometryIndex.set('nodeBase', createGeometry('nodeBase', 200));
    geometryIndex.set('nodeMoving1', createGeometry('nodeMoving1', 50));
    geometryIndex.set('nodeMoving2', createGeometry('nodeMoving2', 50));

    const snapshot1: KinematicSnapshot = {
      stateId: 'open',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeBase', createMatrix(0, 0, 0)],
        ['nodeMoving1', createMatrix(0, 0, 0)],
        ['nodeMoving2', createMatrix(0, 0, 0)],
      ]),
    };

    const snapshot2: KinematicSnapshot = {
      stateId: 'closed',
      nodeWorldMatrices: new Map([
        ['root', createMatrix(0, 0, 0)],
        ['nodeBase', createMatrix(0, 0, 0)],
        ['nodeMoving1', createMatrix(1, 0, 0)],
        ['nodeMoving2', createMatrix(-1, 0, 0)],
      ]),
    };

    const joint1: JointPair = {
      unitId: '',
      nodeAId: 'nodeBase',
      nodeBId: 'nodeMoving1',
      score: 1.0,
      axis: { x: 1, y: 0, z: 0 },
      gap: 0.05,
      overlapRatio: 0.8,
    };

    const joint2: JointPair = {
      unitId: '',
      nodeAId: 'nodeBase',
      nodeBId: 'nodeMoving2',
      score: 1.0,
      axis: { x: -1, y: 0, z: 0 },
      gap: 0.05,
      overlapRatio: 0.8,
    };

    const input: StateBasedUnitDetectionInput = {
      structure,
      geometryIndex,
      snapshots: [snapshot1, snapshot2],
      joints: [joint1, joint2],
    };

    const result = detectUnitsFromState(input);

    expect(result.units.length).toBe(2);

    const baseGroupId = result.baseGroupId;

    for (const unit of result.units) {
      expect(unit.type).toBe('actuated');
      expect(unit.baseGroupId).toBe(baseGroupId);
      expect(unit.movingGroupIds.length).toBe(1);
      expect(unit.jointIds.length).toBe(1);

      const baseGroup = result.rigidGroups.find(g => g.id === unit.baseGroupId);
      expect(baseGroup?.isStatic).toBe(true);
      expect(baseGroup?.nodeIds).toContain('nodeBase');

      expect(unit.rigidGroupIds).toContain(baseGroupId);
    }

    const unit1 = result.units.find(u => u.movingGroupIds[0] === result.rigidGroups.find(g => g.nodeIds.includes('nodeMoving1'))?.id);
    const unit2 = result.units.find(u => u.movingGroupIds[0] === result.rigidGroups.find(g => g.nodeIds.includes('nodeMoving2'))?.id);

    expect(unit1).toBeDefined();
    expect(unit2).toBeDefined();
    expect(unit1?.jointIds[0]).toContain('nodeBase');
    expect(unit1?.jointIds[0]).toContain('nodeMoving1');
    expect(unit2?.jointIds[0]).toContain('nodeBase');
    expect(unit2?.jointIds[0]).toContain('nodeMoving2');
  });
});
