/**
 * Tests for tool motion joint detection.
 */

import { describe, it, expect } from 'vitest';
import { Matrix, Vector3 as BabylonVector3 } from '@babylonjs/core/Maths/math.vector';
import {
  buildToolMotionJointsFromState,
} from '../../../src/domain/tooling/toolingMotion';
import type {
  ToolingNode,
  ToolingStructure,
  ToolingNodeGeometry,
  JointPair,
  Vector3,
} from '../../../src/domain/tooling/types';
import type {
  StateBasedUnitDetectionResult,
  KinematicSnapshot,
  RigidGroup,
} from '../../../src/domain/tooling/stateBasedUnitDetection';

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

function createMatrix(x: number, y: number, z: number): Matrix {
  return Matrix.Translation(x, y, z);
}

function createRotationMatrix(axis: BabylonVector3, angleDeg: number): Matrix {
  const angleRad = (angleDeg * Math.PI) / 180;
  return Matrix.RotationAxis(axis, angleRad);
}

describe('buildToolMotionJointsFromState', () => {
  it('should detect revolute motion', () => {
    const nodeBase = createNode('base', 'Base', null, []);
    const nodeMoving = createNode('moving', 'Moving', null, []);
    const root = createNode('root', 'Root', null, [nodeBase, nodeMoving]);

    const structure: ToolingStructure = {
      root,
      nodes: new Map([
        ['root', root],
        ['base', nodeBase],
        ['moving', nodeMoving],
      ]),
    };

    const geometryIndex = new Map<string, ToolingNodeGeometry>([
      ['root', createGeometry('root', 0)],
      ['base', createGeometry('base', 100)],
      ['moving', createGeometry('moving', 50)],
    ]);

    const rigidGroups: RigidGroup[] = [
      {
        id: 'group_0',
        nodeIds: ['base'],
        isStatic: true,
        totalPoints: 100,
      },
      {
        id: 'group_1',
        nodeIds: ['moving'],
        isStatic: false,
        totalPoints: 50,
      },
    ];

    const stateResult: StateBasedUnitDetectionResult = {
      rigidGroups,
      baseGroupId: 'group_0',
      units: [
        {
          id: 'unit_0',
          rigidGroupIds: ['group_0', 'group_1'],
          type: 'actuated',
          baseGroupId: 'group_0',
          movingGroupIds: ['group_1'],
          jointIds: ['joint_1'],
        },
      ],
    };

    const zAxis = new BabylonVector3(0, 0, 1);
    const rot0 = createRotationMatrix(zAxis, 0);
    const rot30 = createRotationMatrix(zAxis, 30);
    const rot60 = createRotationMatrix(zAxis, 60);

    const snapshots: KinematicSnapshot[] = [
      {
        stateId: 'state_0',
        nodeWorldMatrices: new Map([
          ['base', createMatrix(0, 0, 0)],
          ['moving', rot0.multiply(createMatrix(1, 0, 0))],
        ]),
      },
      {
        stateId: 'state_30',
        nodeWorldMatrices: new Map([
          ['base', createMatrix(0, 0, 0)],
          ['moving', rot30.multiply(createMatrix(1, 0, 0))],
        ]),
      },
      {
        stateId: 'state_60',
        nodeWorldMatrices: new Map([
          ['base', createMatrix(0, 0, 0)],
          ['moving', rot60.multiply(createMatrix(1, 0, 0))],
        ]),
      },
    ];

    const jointPairs: JointPair[] = [
      {
        unitId: 'unit_0',
        nodeAId: 'base',
        nodeBId: 'moving',
        score: 0.9,
        axis: { x: 0, y: 0, z: 1 },
        gap: 0.01,
        overlapRatio: 0.8,
      },
    ];

    const motionJoints = buildToolMotionJointsFromState(
      structure,
      geometryIndex,
      stateResult,
      snapshots,
      jointPairs
    );

    expect(motionJoints.length).toBe(1);
    expect(motionJoints[0].motionType).toBe('revolute');
    expect(motionJoints[0].baseNodeId).toBe('base');
    expect(motionJoints[0].movingNodeId).toBe('moving');
    expect(motionJoints[0].rangeMax - motionJoints[0].rangeMin).toBeGreaterThan(30);
  });

  it('should detect prismatic motion', () => {
    const nodeBase = createNode('base', 'Base', null, []);
    const nodeMoving = createNode('moving', 'Moving', null, []);
    const root = createNode('root', 'Root', null, [nodeBase, nodeMoving]);

    const structure: ToolingStructure = {
      root,
      nodes: new Map([
        ['root', root],
        ['base', nodeBase],
        ['moving', nodeMoving],
      ]),
    };

    const geometryIndex = new Map<string, ToolingNodeGeometry>([
      ['root', createGeometry('root', 0)],
      ['base', createGeometry('base', 100)],
      ['moving', createGeometry('moving', 50)],
    ]);

    const rigidGroups: RigidGroup[] = [
      {
        id: 'group_0',
        nodeIds: ['base'],
        isStatic: true,
        totalPoints: 100,
      },
      {
        id: 'group_1',
        nodeIds: ['moving'],
        isStatic: false,
        totalPoints: 50,
      },
    ];

    const stateResult: StateBasedUnitDetectionResult = {
      rigidGroups,
      baseGroupId: 'group_0',
      units: [
        {
          id: 'unit_0',
          rigidGroupIds: ['group_0', 'group_1'],
          type: 'actuated',
          baseGroupId: 'group_0',
          movingGroupIds: ['group_1'],
          jointIds: ['joint_1'],
        },
      ],
    };

    const snapshots: KinematicSnapshot[] = [
      {
        stateId: 'state_0',
        nodeWorldMatrices: new Map([
          ['base', createMatrix(0, 0, 0)],
          ['moving', createMatrix(0, 0, 0)],
        ]),
      },
      {
        stateId: 'state_1',
        nodeWorldMatrices: new Map([
          ['base', createMatrix(0, 0, 0)],
          ['moving', createMatrix(0, 2, 0)],
        ]),
      },
      {
        stateId: 'state_2',
        nodeWorldMatrices: new Map([
          ['base', createMatrix(0, 0, 0)],
          ['moving', createMatrix(0, 4, 0)],
        ]),
      },
    ];

    const jointPairs: JointPair[] = [
      {
        unitId: 'unit_0',
        nodeAId: 'base',
        nodeBId: 'moving',
        score: 0.9,
        axis: { x: 0, y: 1, z: 0 },
        gap: 0.01,
        overlapRatio: 0.8,
      },
    ];

    const motionJoints = buildToolMotionJointsFromState(
      structure,
      geometryIndex,
      stateResult,
      snapshots,
      jointPairs
    );

    expect(motionJoints.length).toBe(1);
    expect(motionJoints[0].motionType).toBe('prismatic');
    expect(motionJoints[0].baseNodeId).toBe('base');
    expect(motionJoints[0].movingNodeId).toBe('moving');
    expect(motionJoints[0].rangeMax - motionJoints[0].rangeMin).toBeGreaterThan(3);
  });

  it('should filter out noise (minimal motion)', () => {
    const nodeBase = createNode('base', 'Base', null, []);
    const nodeMoving = createNode('moving', 'Moving', null, []);
    const root = createNode('root', 'Root', null, [nodeBase, nodeMoving]);

    const structure: ToolingStructure = {
      root,
      nodes: new Map([
        ['root', root],
        ['base', nodeBase],
        ['moving', nodeMoving],
      ]),
    };

    const geometryIndex = new Map<string, ToolingNodeGeometry>([
      ['root', createGeometry('root', 0)],
      ['base', createGeometry('base', 100)],
      ['moving', createGeometry('moving', 50)],
    ]);

    const rigidGroups: RigidGroup[] = [
      {
        id: 'group_0',
        nodeIds: ['base'],
        isStatic: true,
        totalPoints: 100,
      },
      {
        id: 'group_1',
        nodeIds: ['moving'],
        isStatic: false,
        totalPoints: 50,
      },
    ];

    const stateResult: StateBasedUnitDetectionResult = {
      rigidGroups,
      baseGroupId: 'group_0',
      units: [
        {
          id: 'unit_0',
          rigidGroupIds: ['group_0', 'group_1'],
          type: 'actuated',
          baseGroupId: 'group_0',
          movingGroupIds: ['group_1'],
          jointIds: ['joint_1'],
        },
      ],
    };

    const snapshots: KinematicSnapshot[] = [
      {
        stateId: 'state_0',
        nodeWorldMatrices: new Map([
          ['base', createMatrix(0, 0, 0)],
          ['moving', createMatrix(0, 0, 0)],
        ]),
      },
      {
        stateId: 'state_1',
        nodeWorldMatrices: new Map([
          ['base', createMatrix(0, 0, 0)],
          ['moving', createMatrix(0, 0.0001, 0)],
        ]),
      },
    ];

    const jointPairs: JointPair[] = [
      {
        unitId: 'unit_0',
        nodeAId: 'base',
        nodeBId: 'moving',
        score: 0.9,
        axis: { x: 0, y: 1, z: 0 },
        gap: 0.01,
        overlapRatio: 0.8,
      },
    ];

    const motionJoints = buildToolMotionJointsFromState(
      structure,
      geometryIndex,
      stateResult,
      snapshots,
      jointPairs,
      {
        minAngularMotionDeg: 1.5,
        minLinearMotion: 0.5,
      }
    );

    expect(motionJoints.length).toBe(0);
  });
});
