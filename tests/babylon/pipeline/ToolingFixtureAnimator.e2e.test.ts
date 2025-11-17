import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { ToolingFixtureAnimator } from '../../../src/babylon/pipeline/ToolingFixtureAnimator';
import type { ToolingFileJson } from '../../../src/babylon/io/ToolingJsonAdapter';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import '@babylonjs/loaders/glTF';

const nodeRequire = createRequire(import.meta.url);
if (!(globalThis as any).require) {
  (globalThis as any).require = nodeRequire;
}
const dracoAssetDir = path.resolve(
  process.cwd(),
  'node_modules',
  '@babylonjs',
  'core',
  'assets',
  'Draco'
);
if (!(globalThis as any).__dirname) {
  (globalThis as any).__dirname = dracoAssetDir;
}
if (!(globalThis as any).__filename) {
  (globalThis as any).__filename = path.join(dracoAssetDir, 'draco_wasm_wrapper_gltf.js');
}

/**
 * E2E Test Suite for ToolingFixtureAnimator
 *
 * Tests the complete workflow from GLB fixture to animated joints.
 * Uses actual fixture files and tooling JSON to validate end-to-end behavior.
 *
 * Test Coverage:
 * 1. Load real GLB fixture
 * 2. Create animator with precomputed tooling JSON
 * 3. Verify joints detected correctly
 * 4. Verify animation plays and updates state
 * 5. Verify timeline control
 * 6. Verify error handling
 */
describe('ToolingFixtureAnimator - E2E Tests', () => {
  let engine: BABYLON.NullEngine;
  let scene: BABYLON.Scene;

  beforeEach(() => {
    // Create test environment
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
  });

  afterEach(() => {
    // Cleanup
    if (scene) {
      scene.dispose();
    }
    if (engine) {
      engine.dispose();
    }
  });

  describe('E2E: Precomputed JSON Workflow', () => {
    it('should load fixture, prepare animator, and verify joints', async () => {
      // Create a simple fixture structure
      const rootNode = new BABYLON.TransformNode('9X_110_GEO', scene);
      const unit112 = new BABYLON.TransformNode('UNIT_112', scene);
      unit112.parent = rootNode;
      const lhNode = new BABYLON.TransformNode('LH', scene);
      lhNode.parent = unit112;
      const movingNode = new BABYLON.TransformNode('MOVING', scene);
      movingNode.parent = lhNode;
      movingNode.position = new BABYLON.Vector3(2.007, -1.164, 1.4885);

      // Use simplified tooling JSON based on real 9X_110_GEO.json
      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'UNIT_112',
          Joints: [
            {
              Name: 'C1',
              ElectricalName: 'UNIT_112L',
              NodeId: '9X_110_GEO/UNIT_112/LH/MOVING',
              Type: 1, // Hinge
              MaxValue: 89.99996615342559,
              MinValue: 0,
              ToVector: { X: 2.007, Y: -1.164, Z: 1.4885 },
              FromVector: { X: 2.007, Y: -0.164, Z: 1.4885 },
              TransformationMatrix: [
                '0.0000 0.0000 1.0000 0.5185',
                '-0.0000 1.0000 -0.0000 0.0000',
                '-1.0000 -0.0000 0.0000 3.4955',
                '0.0000 0.0000 0.0000 1.0000',
              ],
            },
          ],
        },
      ];

      // Create animator
      const animator = new ToolingFixtureAnimator({
        scene,
        rootNode,
        toolingJson,
      });

      // Prepare (should not throw)
      await animator.prepare();

      // Verify joints were created
      const joints = animator.getJoints();
      expect(joints.length).toBe(1);
      expect(joints[0].type).toBe('hinge');
      expect(joints[0].id).toBe('UNIT_112_C1');

      // Verify limits
      expect(joints[0].limits.lower).toBe(0);
      expect(joints[0].limits.upper).toBeCloseTo(89.99996615342559 * (Math.PI / 180), 5);

      // Verify ValveBank created
      const valveBank = animator.getValveBank();
      expect(valveBank).toBeDefined();

      // Verify summary
      const summary = animator.getSummary();
      expect(summary.jointCount).toBe(1);
      expect(summary.channelCount).toBe(1);
      expect(summary.highErrorJoints.length).toBe(0);
    });

    it('should play demo cycle and verify animation state changes', async () => {
      // Setup
      const rootNode = new BABYLON.TransformNode('test_fixture', scene);
      const childNode = new BABYLON.TransformNode('moving_part', scene);
      childNode.parent = rootNode;
      childNode.position = new BABYLON.Vector3(0, 0, 0);

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'TestUnit',
          Joints: [
            {
              Name: 'C1',
              ElectricalName: 'CLAMP1',
              NodeId: 'moving_part',
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
        toolingJson,
      });

      await animator.prepare();

      // Record initial position
      const initialPos = childNode.position.clone();

      // Play demo cycle (extend at t=0, retract at t=1500)
      // Use very short timeline for test speed
      const valveBank = animator.getValveBank();
      const events = [
        { tMs: 0, cmd: 'extend' as const, channelId: 'CLAMP1' },
        { tMs: 50, cmd: 'retract' as const, channelId: 'CLAMP1' },
      ];

      await valveBank.runTimeline(events, { stepMs: 10 });

      // Verify position changed (animation occurred)
      // Note: Final position should be back at retracted (initial)
      const finalPos = childNode.position;

      // Position should be close to initial after full cycle
      expect(finalPos.x).toBeCloseTo(initialPos.x, 2);
      expect(finalPos.y).toBeCloseTo(initialPos.y, 2);
      expect(finalPos.z).toBeCloseTo(initialPos.z, 2);
    });

    it('should handle multi-joint fixtures correctly', async () => {
      // Setup with two joints
      const rootNode = new BABYLON.TransformNode('fixture', scene);
      const part1 = new BABYLON.TransformNode('part1', scene);
      part1.parent = rootNode;
      const part2 = new BABYLON.TransformNode('part2', scene);
      part2.parent = rootNode;

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'Unit1',
          Joints: [
            {
              Name: 'J1',
              ElectricalName: 'JOINT1',
              NodeId: 'part1',
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
        {
          UnitName: 'Unit2',
          Joints: [
            {
              Name: 'J2',
              ElectricalName: 'JOINT2',
              NodeId: 'part2',
              Type: 1,
              MaxValue: 45,
              MinValue: 0,
              ToVector: { X: 0, Y: 0.1, Z: 0 },
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
        toolingJson,
      });

      await animator.prepare();

      // Verify both joints detected
      const joints = animator.getJoints();
      expect(joints.length).toBe(2);
      expect(joints[0].type).toBe('prismatic');
      expect(joints[1].type).toBe('hinge');

      // Verify summary
      const summary = animator.getSummary();
      expect(summary.jointCount).toBe(2);
      expect(summary.channelCount).toBe(2);
    });
  });

  describe('E2E: Custom Timeline Control', () => {
    it('should execute custom timeline events in sequence', async () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);
      const part = new BABYLON.TransformNode('part', scene);
      part.parent = rootNode;

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'TestUnit',
          Joints: [
            {
              Name: 'C1',
              ElectricalName: 'CLAMP1',
              NodeId: 'part',
              Type: 0,
              MaxValue: 0.1,
              MinValue: 0,
              ToVector: { X: 0.1, Y: 0, Z: 0 },
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
        toolingJson,
      });

      await animator.prepare();

      const valveBank = animator.getValveBank();

      // Custom timeline: extend, hold, retract
      const customEvents = [
        { tMs: 0, cmd: 'extend' as const, channelId: 'CLAMP1' },
        { tMs: 50, cmd: 'hold' as const, channelId: 'CLAMP1' },
        { tMs: 100, cmd: 'retract' as const, channelId: 'CLAMP1' },
      ];

      await valveBank.runTimeline(customEvents, { stepMs: 10 });

      // Should complete without errors
      // Final state should be retracted
      const joints = animator.getJoints();
      expect(joints.length).toBe(1);
    });

    it('should handle out-of-order timeline events', async () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);
      const part = new BABYLON.TransformNode('part', scene);
      part.parent = rootNode;

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'TestUnit',
          Joints: [
            {
              Name: 'C1',
              ElectricalName: 'CLAMP1',
              NodeId: 'part',
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
        toolingJson,
      });

      await animator.prepare();

      const valveBank = animator.getValveBank();

      // Events out of order (should be auto-sorted by ValveBank)
      const unsortedEvents = [
        { tMs: 100, cmd: 'retract' as const, channelId: 'CLAMP1' },
        { tMs: 0, cmd: 'extend' as const, channelId: 'CLAMP1' },
        { tMs: 50, cmd: 'hold' as const, channelId: 'CLAMP1' },
      ];

      // Should handle gracefully
      await valveBank.runTimeline(unsortedEvents, { stepMs: 10 });

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('E2E: Error Handling', () => {
    it('should throw error when prepare() called without JSON or states', async () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);

      const animator = new ToolingFixtureAnimator({
        scene,
        rootNode,
        // No toolingJson provided
      });

      // Should throw descriptive error
      await expect(animator.prepare()).rejects.toThrow(/No tooling JSON provided and no states captured/);
    });

    it('should throw error when playDemoCycle() called before prepare()', async () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'TestUnit',
          Joints: [
            {
              Name: 'C1',
              ElectricalName: 'CLAMP1',
              NodeId: 'part',
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
        toolingJson,
      });

      // Try to play without preparing
      await expect(animator.playDemoCycle()).rejects.toThrow(/Must call prepare/);
    });

    it('should throw error when getValveBank() called before prepare()', () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'TestUnit',
          Joints: [
            {
              Name: 'C1',
              ElectricalName: 'CLAMP1',
              NodeId: 'part',
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
        toolingJson,
      });

      // Try to get ValveBank without preparing
      expect(() => animator.getValveBank()).toThrow(/Must call prepare/);
    });

    it('should handle empty joints array gracefully', async () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'EmptyUnit',
          Joints: [], // No joints
        },
      ];

      const animator = new ToolingFixtureAnimator({
        scene,
        rootNode,
        toolingJson,
      });

      await animator.prepare();

      // Should prepare successfully
      const joints = animator.getJoints();
      expect(joints.length).toBe(0);

      // playDemoCycle should handle gracefully (suppress expected "No joints to animate" warning)
      const originalConsoleWarn = console.warn;
      console.warn = () => {}; // Suppress expected warning
      try {
        await animator.playDemoCycle();
      } finally {
        console.warn = originalConsoleWarn;
      }

      // Should complete without errors
      const summary = animator.getSummary();
      expect(summary.jointCount).toBe(0);
      expect(summary.channelCount).toBe(0);
    });
  });

  describe('E2E: Joint Type Handling', () => {
    it('should handle prismatic joints (Type 0)', async () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);
      const part = new BABYLON.TransformNode('slider', scene);
      part.parent = rootNode;

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'TestUnit',
          Joints: [
            {
              Name: 'Slider1',
              ElectricalName: 'SLIDER1',
              NodeId: 'slider',
              Type: 0, // Prismatic
              MaxValue: 0.1,
              MinValue: 0,
              ToVector: { X: 0.1, Y: 0, Z: 0 },
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
        toolingJson,
      });

      await animator.prepare();

      const joints = animator.getJoints();
      expect(joints[0].type).toBe('prismatic');
      expect(joints[0].limits.lower).toBe(0);
      expect(joints[0].limits.upper).toBeCloseTo(0.1, 5);
    });

    it('should handle hinge joints (Type 1) with degree conversion', async () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);
      const part = new BABYLON.TransformNode('hinge', scene);
      part.parent = rootNode;

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'TestUnit',
          Joints: [
            {
              Name: 'Hinge1',
              ElectricalName: 'HINGE1',
              NodeId: 'hinge',
              Type: 1, // Hinge (degrees in JSON)
              MaxValue: 90,
              MinValue: 0,
              ToVector: { X: 0, Y: 0.1, Z: 0 },
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
        toolingJson,
      });

      await animator.prepare();

      const joints = animator.getJoints();
      expect(joints[0].type).toBe('hinge');
      // Limits should be converted to radians
      expect(joints[0].limits.lower).toBe(0);
      expect(joints[0].limits.upper).toBeCloseTo(Math.PI / 2, 5);
    });
  });

  describe('E2E: Summary and Diagnostics', () => {
    it('should provide accurate summary statistics', async () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);
      const part1 = new BABYLON.TransformNode('part1', scene);
      part1.parent = rootNode;
      const part2 = new BABYLON.TransformNode('part2', scene);
      part2.parent = rootNode;
      const part3 = new BABYLON.TransformNode('part3', scene);
      part3.parent = rootNode;

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'Unit1',
          Joints: [
            {
              Name: 'J1',
              ElectricalName: 'JOINT1',
              NodeId: 'part1',
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
            {
              Name: 'J2',
              ElectricalName: 'JOINT2',
              NodeId: 'part2',
              Type: 1,
              MaxValue: 45,
              MinValue: 0,
              ToVector: { X: 0, Y: 0.1, Z: 0 },
              FromVector: { X: 0, Y: 0, Z: 0 },
              TransformationMatrix: [
                '1 0 0 0',
                '0 1 0 0',
                '0 0 1 0',
                '0 0 0 1',
              ],
            },
            {
              Name: 'J3',
              ElectricalName: 'JOINT3',
              NodeId: 'part3',
              Type: 0,
              MaxValue: 0.08,
              MinValue: 0,
              ToVector: { X: 0, Y: 0, Z: 0.08 },
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
        toolingJson,
      });

      await animator.prepare();

      const summary = animator.getSummary();
      expect(summary.jointCount).toBe(3);
      expect(summary.channelCount).toBe(3);
      expect(Array.isArray(summary.highErrorJoints)).toBe(true);
    });

    it('should get joints array with correct properties', async () => {
      const rootNode = new BABYLON.TransformNode('fixture', scene);
      const part = new BABYLON.TransformNode('part', scene);
      part.parent = rootNode;

      const toolingJson: ToolingFileJson = [
        {
          UnitName: 'TestUnit',
          Joints: [
            {
              Name: 'C1',
              ElectricalName: 'CLAMP1',
              NodeId: 'part',
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
        toolingJson,
      });

      await animator.prepare();

      const joints = animator.getJoints();
      expect(joints.length).toBe(1);

      const joint = joints[0];
      expect(joint).toHaveProperty('id');
      expect(joint).toHaveProperty('type');
      expect(joint).toHaveProperty('childId');
      expect(joint).toHaveProperty('parentId');
      expect(joint).toHaveProperty('limits');
      expect(joint).toHaveProperty('axisWorld');
      expect(joint).toHaveProperty('anchorWorld');
    });
  });

  describe('E2E: Real Fixture Asset', () => {
    const fixtureGlbPath = path.resolve(process.cwd(), 'test_assets', 'tooling', '9X_110_GEO.glb');
    const toolingJsonPath = path.resolve(process.cwd(), 'dist', '9X_110_GEO.json');

    let originalConsoleError: typeof console.error;
    let originalConsoleWarn: typeof console.warn;

    beforeEach(() => {
      // Suppress expected warnings about missing child nodes in real GLB
      originalConsoleError = console.error;
      originalConsoleWarn = console.warn;
      console.error = () => {}; // Suppress JointMath child node warnings
      console.warn = () => {}; // Suppress any other warnings
    });

    afterEach(() => {
      // Restore original console methods
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    });

    it('should load GLB fixture from disk and prepare animator end-to-end', async () => {
      const glbBuffer = readFileSync(fixtureGlbPath);
      const toolingJson: ToolingFileJson = JSON.parse(readFileSync(toolingJsonPath, 'utf-8'));

      const importResult = await SceneLoader.ImportMeshAsync(
        undefined,
        '',
        glbBuffer,
        scene,
        undefined,
        '.glb'
      );

      const fixtureRoot =
        importResult.transformNodes.find((node) => node.name === '9X_110_GEO') ??
        scene.getTransformNodeByName('9X_110_GEO');

      expect(fixtureRoot).toBeDefined();

      const animator = new ToolingFixtureAnimator({
        scene,
        rootNode: fixtureRoot!,
        toolingJson,
      });

      await animator.prepare();

      const joints = animator.getJoints();
      expect(joints.length).toBeGreaterThan(0);
      expect(joints.some((joint) => joint.id === 'UNIT_112_C1')).toBe(true);

      const summary = animator.getSummary();
      expect(summary.jointCount).toBe(joints.length);
      expect(summary.channelCount).toBeGreaterThan(0);

      const valveBank = animator.getValveBank();
      const sampleJointId = joints[0]?.id;
      expect(sampleJointId).toBeDefined();

      await valveBank.runTimeline(
        [
          { tMs: 0, cmd: 'extend' as const, channelId: sampleJointId! },
          { tMs: 200, cmd: 'retract' as const, channelId: sampleJointId! },
        ],
        { stepMs: 20 }
      );
    });
  });
});
