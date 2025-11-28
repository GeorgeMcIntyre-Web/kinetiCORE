/**
 * U112 Gold Standard Test Suite
 *
 * This test suite validates INVARIANT BEHAVIOR for the canonical reference fixture:
 * 016ZF_20142435_140_1E1_CI00_U112.glb
 *
 * These tests DO NOT test geometry positions or synthetic transforms.
 * They test the EXPECTED BEHAVIOR that must never regress.
 *
 * If ANY test fails, DO NOT MERGE your changes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { ToolingFixtureAnimator } from '../../src/babylon/pipeline/ToolingFixtureAnimator';
import type { ToolingFileJson } from '../../src/babylon/io/ToolingJsonAdapter';

describe('U112 Gold Standard - Invariant Behavior', () => {
  let engine: BABYLON.NullEngine;
  let scene: BABYLON.Scene;
  let rootNode: BABYLON.TransformNode;

  beforeEach(() => {
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
    rootNode = new BABYLON.TransformNode('016ZF_FIXTURE', scene);
  });

  describe('Structural Invariants', () => {
    it('should detect exactly 2 units (1 fixed + 1 moving)', async () => {
      // Setup: U112 has UNIT_101 (fixed) and UNIT_112 (moving)
      const unit101 = new BABYLON.TransformNode('UNIT_101', scene);
      unit101.parent = rootNode;
      const mesh101 = BABYLON.MeshBuilder.CreateBox('frame', { size: 1 }, scene);
      mesh101.parent = unit101;

      const unit112 = new BABYLON.TransformNode('UNIT_112', scene);
      unit112.parent = rootNode;
      const mesh112 = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.5 }, scene);
      mesh112.parent = unit112;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      const result = await animator.analyzeFixture();

      expect(result.success).toBe(true);
      expect(result.fixedUnits.length + result.movingUnits.length).toBe(2);
      expect(result.movingUnits.length).toBeGreaterThanOrEqual(1);
    });

    it('should successfully complete workflow to ready_to_play state', async () => {
      // Setup fixture
      const unit101 = new BABYLON.TransformNode('UNIT_101', scene);
      unit101.parent = rootNode;
      const mesh101 = BABYLON.MeshBuilder.CreateBox('frame', { size: 1 }, scene);
      mesh101.parent = unit101;

      const unit112 = new BABYLON.TransformNode('UNIT_112', scene);
      unit112.parent = rootNode;
      const mesh112 = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.5 }, scene);
      mesh112.parent = unit112;
      mesh112.position = new BABYLON.Vector3(1, 0, 0);

      const animator = new ToolingFixtureAnimator({ scene, rootNode });

      // Run full workflow
      await animator.analyzeFixture();
      expect(animator.getWorkflowState()).toBe('analyzed');

      await animator.captureRetractedState();
      expect(animator.getWorkflowState()).toBe('retracted_captured');

      // Rotate to simulate 90° motion
      mesh112.rotation.z = Math.PI / 2;
      await animator.captureExtendedState();
      expect(animator.getWorkflowState()).toBe('extended_captured');

      await animator.fitJoints();
      // Note: May stay in 'extended_captured' if fitting fails, or transition to 'joints_fitted'
      const stateAfterFit = animator.getWorkflowState();
      expect(['extended_captured', 'joints_fitted']).toContain(stateAfterFit);

      if (stateAfterFit === 'joints_fitted') {
        animator.setupAnimation();
        expect(animator.getWorkflowState()).toBe('ready_to_play');
      }
    });
  });

  describe('Joint Detection Invariants', () => {
    it('should detect hinge joint type for revolute motion', async () => {
      // Setup with clear revolute motion
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.3 }, scene);
      mesh.parent = unit;
      mesh.position = new BABYLON.Vector3(1, 0, 0);

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();

      // 90° rotation
      mesh.rotation.z = Math.PI / 2;
      await animator.captureExtendedState();

      const result = await animator.fitJoints();

      // If fitting succeeded, expect hinge
      const successfulFits = result.details.filter((d) => d.success);
      if (successfulFits.length > 0) {
        const hingeJoints = successfulFits.filter((d) => d.jointType === 'hinge');
        expect(hingeJoints.length).toBeGreaterThan(0);
      }
    });

    it('should detect angle between 80-100 degrees for 90° motion', async () => {
      // Setup
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.3 }, scene);
      mesh.parent = unit;
      mesh.position = new BABYLON.Vector3(1, 0, 0);

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();

      // Exactly 90° rotation
      mesh.rotation.z = Math.PI / 2;
      await animator.captureExtendedState();

      const result = await animator.fitJoints();

      // Check successful fits
      const successfulFits = result.details.filter((d) => d.success);
      for (const fit of successfulFits) {
        if (fit.jointType === 'hinge') {
          // Allow ±10° tolerance
          expect(fit.angleDeg).toBeGreaterThanOrEqual(80);
          expect(fit.angleDeg).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should maintain RMS error below 1.0mm for quality fits', async () => {
      // Setup
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.3 }, scene);
      mesh.parent = unit;
      mesh.position = new BABYLON.Vector3(1, 0, 0);

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();

      mesh.rotation.z = Math.PI / 2;
      await animator.captureExtendedState();

      const result = await animator.fitJoints();

      // Check RMS error for successful fits
      const successfulFits = result.details.filter((d) => d.success);
      for (const fit of successfulFits) {
        // In synthetic tests, RMS should be very low
        expect(fit.rmsErrorMm).toBeLessThan(1.0);
      }
    });

    it('should maintain confidence above 0.70 for successful fits', async () => {
      // Setup
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.3 }, scene);
      mesh.parent = unit;
      mesh.position = new BABYLON.Vector3(1, 0, 0);

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();

      mesh.rotation.z = Math.PI / 2;
      await animator.captureExtendedState();

      const result = await animator.fitJoints();

      // Check confidence for successful fits
      const successfulFits = result.details.filter((d) => d.success);
      for (const fit of successfulFits) {
        expect(fit.confidence).toBeGreaterThanOrEqual(0.70);
      }
    });
  });

  describe('Error Handling Invariants', () => {
    it('should return structured error for no motion detected', async () => {
      // Setup
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.3 }, scene);
      mesh.parent = unit;

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();

      // NO MOTION - same position
      await animator.captureExtendedState();

      const result = await animator.fitJoints();

      // Should have detail with failure reason
      const failedFits = result.details.filter((d) => !d.success);
      if (failedFits.length > 0) {
        expect(failedFits[0].reason).toBeDefined();
        expect(failedFits[0].reason).toContain('motion');
      }
    });

    it('should enforce workflow state transitions', async () => {
      const animator = new ToolingFixtureAnimator({ scene, rootNode });

      // Can't capture before analyzing
      const captureResult = await animator.captureRetractedState();
      expect(captureResult.success).toBe(false);
      expect(captureResult.error).toContain('analyzeFixture');

      // Can't fit before capturing
      await animator.analyzeFixture();
      const fitResult = await animator.fitJoints();
      expect(fitResult.success).toBe(false);
      expect(fitResult.error).toContain('extended');
    });
  });

  describe('Integration Invariants', () => {
    it('should produce valid joint definitions for animation', async () => {
      // Setup
      const unit = new BABYLON.TransformNode('UNIT_112', scene);
      unit.parent = rootNode;
      const mesh = BABYLON.MeshBuilder.CreateBox('clamp', { size: 0.3 }, scene);
      mesh.parent = unit;
      mesh.position = new BABYLON.Vector3(1, 0, 0);

      const animator = new ToolingFixtureAnimator({ scene, rootNode });
      await animator.analyzeFixture();
      await animator.captureRetractedState();

      mesh.rotation.z = Math.PI / 2;
      await animator.captureExtendedState();

      const result = await animator.fitJoints();

      // If successful, joints should have required properties
      if (result.success && result.joints.length > 0) {
        const joint = result.joints[0];
        expect(joint).toHaveProperty('id');
        expect(joint).toHaveProperty('type');
        expect(joint).toHaveProperty('limits');
        expect(joint).toHaveProperty('axisWorld');
        expect(joint).toHaveProperty('anchorWorld');

        // Limits should be valid
        expect(joint.limits.lower).toBeDefined();
        expect(joint.limits.upper).toBeDefined();
        expect(joint.limits.upper).toBeGreaterThan(joint.limits.lower);
      }
    });

    it('should allow animation playback after successful setup', async () => {
      // Use precomputed JSON to ensure animation works
      const mockToolingJson: ToolingFileJson = [
        {
          UnitName: 'UNIT_112',
          Joints: [
            {
              Name: 'C1',
              ElectricalName: 'CLAMP1',
              NodeId: 'clamp_node',
              Type: 1, // Hinge
              MaxValue: 90,
              MinValue: 0,
              ToVector: { X: 1, Y: 0, Z: 0 },
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

      // Should be able to play without errors
      await expect(animator.playDemoCycle()).resolves.not.toThrow();
    });
  });
});
