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

/**
 * Test suite for the Guided Workflow methods:
 * - analyzeFixture()
 * - captureRetractedState()
 * - captureExtendedState()
 * - fitJoints()
 * - setupAnimation()
 *
 * These tests use mock scene structures to validate the workflow state machine
 * and error handling without requiring actual GLB files.
 */
describe('ToolingFixtureAnimator - Guided Workflow', () => {
  let engine: BABYLON.NullEngine;
  let scene: BABYLON.Scene;
  let rootNode: BABYLON.TransformNode;

  beforeEach(() => {
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
    rootNode = new BABYLON.TransformNode('016ZF_FIXTURE', scene);
  });

  describe('Workflow State Machine', () => {
    it('should start in idle state', () => {
      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      expect(animator.getWorkflowState()).toBe('idle');
    });

    it('should transition from idle to analyzed after analyzeFixture()', async () => {
      // Setup: Create a fixture with UNIT_* children
      const unit101 = new BABYLON.TransformNode('UNIT_101', scene);
      unit101.parent = rootNode;
      const unit112 = new BABYLON.TransformNode('UNIT_112', scene);
      unit112.parent = rootNode;

      // Add meshes to units for detection
      const mesh101 = BABYLON.MeshBuilder.CreateBox('mesh_101', { size: 1 }, scene);
      mesh101.parent = unit101;
      const mesh112 = BABYLON.MeshBuilder.CreateBox('mesh_112', { size: 1 }, scene);
      mesh112.parent = unit112;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      const result = await animator.analyzeFixture();

      expect(result.success).toBe(true);
      expect(animator.getWorkflowState()).toBe('analyzed');
    });

    it('should fail captureRetractedState() if called before analyzeFixture()', async () => {
      const animator = new ToolingFixtureAnimator({ scene, rootNode });

      const result = await animator.captureRetractedState();

      expect(result.success).toBe(false);
      expect(result.error).toContain('analyzeFixture');
    });

    it('should fail captureExtendedState() if called before captureRetractedState()', async () => {
      // Setup minimal fixture structure
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('mesh', { size: 1 }, scene);
      mesh.parent = unit;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();

      const result = await animator.captureExtendedState();

      expect(result.success).toBe(false);
      expect(result.error).toContain('retracted state');
    });

    it('should fail fitJoints() if called before both states captured', async () => {
      // Setup minimal fixture structure
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('mesh', { size: 1 }, scene);
      mesh.parent = unit;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();

      // Skip extended capture - should fail
      const result = await animator.fitJoints();

      expect(result.success).toBe(false);
      expect(result.error).toContain('extended');
    });

    it('should throw from setupAnimation() if called before fitJoints()', async () => {
      const animator = new ToolingFixtureAnimator({ scene, rootNode });

      expect(() => animator.setupAnimation()).toThrow('fit joints');
    });
  });

  describe('analyzeFixture() Result Types', () => {
    it('should return error when no units found', async () => {
      // Empty root node - no UNIT_* children
      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      const result = await animator.analyzeFixture();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No units detected');
      expect(result.fixedUnits).toEqual([]);
      expect(result.movingUnits).toEqual([]);
    });

    it('should return fixedUnits and movingUnits arrays', async () => {
      // Create fixture with two units
      const unit101 = new BABYLON.TransformNode('UNIT_101', scene);
      unit101.parent = rootNode;
      const unit112 = new BABYLON.TransformNode('UNIT_112', scene);
      unit112.parent = rootNode;

      // Add meshes
      const mesh101 = BABYLON.MeshBuilder.CreateBox('mesh_101', { size: 1 }, scene);
      mesh101.parent = unit101;
      const mesh112 = BABYLON.MeshBuilder.CreateBox('mesh_112', { size: 1 }, scene);
      mesh112.parent = unit112;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      const result = await animator.analyzeFixture();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.fixedUnits)).toBe(true);
      expect(Array.isArray(result.movingUnits)).toBe(true);
      // At least one of these should have entries
      expect(result.fixedUnits.length + result.movingUnits.length).toBeGreaterThan(0);
    });
  });

  describe('CaptureResult Types', () => {
    it('captureRetractedState should return pointCounts per unit', async () => {
      // Setup fixture with geometry
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.1 }, scene);
      mesh.parent = unit;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();

      const result = await animator.captureRetractedState();

      // Should capture points (may be 0 if sampling fails, but structure should be valid)
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('pointCounts');
      expect(result).toHaveProperty('totalPoints');
      expect(typeof result.totalPoints).toBe('number');
    });

    it('captureExtendedState should return pointCounts per unit', async () => {
      // Setup fixture with geometry
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.1 }, scene);
      mesh.parent = unit;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();

      const result = await animator.captureExtendedState();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('pointCounts');
      expect(result).toHaveProperty('totalPoints');
    });
  });

  describe('FitJointsResult Types', () => {
    it('should return details array with per-unit results', async () => {
      // Setup fixture with geometry
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.1 }, scene);
      mesh.parent = unit;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();

      // Move the mesh to simulate motion before extended capture
      mesh.position.y += 0.05;
      await animator.captureExtendedState();

      const result = await animator.fitJoints();

      // Verify structure regardless of success
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('jointCount');
      expect(result).toHaveProperty('joints');
      expect(result).toHaveProperty('details');
      expect(Array.isArray(result.details)).toBe(true);
    });

    it('should include failure reason when unit has no motion', async () => {
      // Setup fixture with geometry
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.1 }, scene);
      mesh.parent = unit;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();
      // Don't move the mesh - same position for both states
      await animator.captureExtendedState();

      const result = await animator.fitJoints();

      // Should have a detail entry
      if (result.details.length > 0) {
        const detail = result.details[0];
        expect(detail).toHaveProperty('unitId');
        expect(detail).toHaveProperty('unitName');
        expect(detail).toHaveProperty('success');
        // If no motion detected, should have reason
        if (!detail.success) {
          expect(detail.reason).toBeDefined();
        }
      }
    });
  });

  describe('getMovingUnitsInfo()', () => {
    it('should return empty array before analysis', () => {
      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      const info = animator.getMovingUnitsInfo();
      expect(info).toEqual([]);
    });

    it('should return unit info after analysis', async () => {
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.1 }, scene);
      mesh.parent = unit;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();

      const info = animator.getMovingUnitsInfo();
      expect(Array.isArray(info)).toBe(true);
      // Should have at least one moving unit
      if (info.length > 0) {
        expect(info[0]).toHaveProperty('id');
        expect(info[0]).toHaveProperty('name');
        expect(info[0]).toHaveProperty('hasRetractedState');
        expect(info[0]).toHaveProperty('hasExtendedState');
        expect(info[0]).toHaveProperty('retractedPointCount');
        expect(info[0]).toHaveProperty('extendedPointCount');
      }
    });
  });
});

/**
 * Tests for JointFitResultInfo detail structure validation.
 */
describe('ToolingFixtureAnimator - JointFitResultInfo', () => {
  let engine: BABYLON.NullEngine;
  let scene: BABYLON.Scene;
  let rootNode: BABYLON.TransformNode;

  beforeEach(() => {
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
    rootNode = new BABYLON.TransformNode('TEST_FIXTURE', scene);
  });

  it('should have correct structure for successful hinge fit', async () => {
    // Setup fixture with geometry that will move
    const unit = new BABYLON.TransformNode('UNIT_112', scene);
    unit.parent = rootNode;
    const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.1 }, scene);
    mesh.parent = unit;
    mesh.position = new BABYLON.Vector3(1, 0, 0);

    const animator = new ToolingFixtureAnimator({ scene, rootNode });
    await animator.analyzeFixture();
    await animator.captureRetractedState();

    // Rotate mesh around Z axis to simulate hinge motion
    mesh.rotation.z = Math.PI / 4; // 45 degrees
    await animator.captureExtendedState();

    const result = await animator.fitJoints();

    // Check details structure
    for (const detail of result.details) {
      expect(detail).toHaveProperty('unitId');
      expect(detail).toHaveProperty('unitName');
      expect(detail).toHaveProperty('success');
      expect(detail).toHaveProperty('jointType');
      expect(detail).toHaveProperty('angleDeg');
      expect(detail).toHaveProperty('angleRad');
      expect(detail).toHaveProperty('axis');
      expect(detail).toHaveProperty('pivot');
      expect(detail).toHaveProperty('confidence');
      expect(detail).toHaveProperty('rmsErrorMm');

      // Axis should have x, y, z
      expect(detail.axis).toHaveProperty('x');
      expect(detail.axis).toHaveProperty('y');
      expect(detail.axis).toHaveProperty('z');

      // Pivot should have x, y, z
      expect(detail.pivot).toHaveProperty('x');
      expect(detail.pivot).toHaveProperty('y');
      expect(detail.pivot).toHaveProperty('z');
    }
  });

  it('should have reason field for failed fits', async () => {
    // Setup fixture with geometry that won't move
    const unit = new BABYLON.TransformNode('UNIT_112', scene);
    unit.parent = rootNode;
    const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.1 }, scene);
    mesh.parent = unit;

    const animator = new ToolingFixtureAnimator({ scene, rootNode });
    await animator.analyzeFixture();
    await animator.captureRetractedState();
    // No motion - same state
    await animator.captureExtendedState();

    const result = await animator.fitJoints();

    // Check for failed fits - they should have reason
    const failedDetails = result.details.filter((d) => !d.success);
    for (const detail of failedDetails) {
      expect(detail.reason).toBeDefined();
      expect(typeof detail.reason).toBe('string');
      expect(detail.reason!.length).toBeGreaterThan(0);
    }
  });
});
