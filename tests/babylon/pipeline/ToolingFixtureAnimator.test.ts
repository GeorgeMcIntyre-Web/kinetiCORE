import { describe, it, expect, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { ToolingFixtureAnimator } from '../../../src/babylon/pipeline/ToolingFixtureAnimator';
import type { ToolingFileJson } from '../../../src/babylon/io/ToolingJsonAdapter';

/**
 * Test suite for ToolingFixtureAnimator integration helper.
 *
 * Tests the thin integration layer that connects:
 * - Auto-kinematics extraction (GLB → joints JSON)
 * - ValveBank + JointMath (joints JSON → animation)
 */
describe('ToolingFixtureAnimator', () => {
  let scene: BABYLON.Scene;
  let rootNode: BABYLON.TransformNode;

  beforeEach(() => {
    // Create a minimal scene for testing
    const engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
    rootNode = new BABYLON.TransformNode('test_fixture', scene);
  });

  it('should create animator with precomputed tooling JSON', () => {
    const mockToolingJson: ToolingFileJson = [
      {
        UnitName: 'TestUnit',
        Joints: [
          {
            Name: 'C1',
            ElectricalName: 'CLAMP1',
            NodeId: 'test_node',
            Type: 0, // Prismatic
            MaxValue: 0.05,
            MinValue: 0,
            ToVector: { X: 0.05, Y: 0, Z: 0 },
            FromVector: { X: 0, Y: 0, Z: 0 },
            TransformationMatrix: [
              '1 0 0 0',
              '0 1 0 0',
              '0 0 1 0',
              '0 0 0 1',
            ],
          },
        ],
      },
    ];

    const animator = new ToolingFixtureAnimator({
      scene,
      rootNode,
      toolingJson: mockToolingJson,
    });

    expect(animator).toBeDefined();
  });

  it('should prepare animator with precomputed JSON', async () => {
    const mockToolingJson: ToolingFileJson = [
      {
        UnitName: 'TestUnit',
        Joints: [
          {
            Name: 'C1',
            ElectricalName: 'CLAMP1',
            NodeId: 'test_node',
            Type: 0, // Prismatic
            MaxValue: 0.05,
            MinValue: 0,
            ToVector: { X: 0.05, Y: 0, Z: 0 },
            FromVector: { X: 0, Y: 0, Z: 0 },
            TransformationMatrix: [
              '1 0 0 0',
              '0 1 0 0',
              '0 0 1 0',
              '0 0 0 1',
            ],
          },
        ],
      },
    ];

    const animator = new ToolingFixtureAnimator({
      scene,
      rootNode,
      toolingJson: mockToolingJson,
    });

    await animator.prepare();

    const joints = animator.getJoints();
    expect(joints.length).toBeGreaterThan(0);
    expect(joints[0].type).toBe('prismatic');

    const valveBank = animator.getValveBank();
    expect(valveBank).toBeDefined();

    const summary = animator.getSummary();
    expect(summary.jointCount).toBe(1);
    expect(summary.channelCount).toBe(1);
  });

  it('should throw error if no JSON and no states captured', async () => {
    const animator = new ToolingFixtureAnimator({
      scene,
      rootNode,
      // No toolingJson provided
    });

    await expect(animator.prepare()).rejects.toThrow();
  });

  it('should get summary with joint counts', async () => {
    const mockToolingJson: ToolingFileJson = [
      {
        UnitName: 'TestUnit',
        Joints: [
          {
            Name: 'C1',
            ElectricalName: 'CLAMP1',
            NodeId: 'test_node',
            Type: 0,
            MaxValue: 0.05,
            MinValue: 0,
            ToVector: { X: 0.05, Y: 0, Z: 0 },
            FromVector: { X: 0, Y: 0, Z: 0 },
            TransformationMatrix: [
              '1 0 0 0',
              '0 1 0 0',
              '0 0 1 0',
              '0 0 0 1',
            ],
          },
        ],
      },
    ];

    const animator = new ToolingFixtureAnimator({
      scene,
      rootNode,
      toolingJson: mockToolingJson,
    });

    await animator.prepare();

    const summary = animator.getSummary();
    expect(summary).toBeDefined();
    expect(summary.jointCount).toBe(1);
    expect(summary.channelCount).toBe(1);
    expect(Array.isArray(summary.highErrorJoints)).toBe(true);
  });
});
