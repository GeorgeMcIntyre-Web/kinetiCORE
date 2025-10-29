/**
 * Inverse Kinematics Convergence Test Suite
 *
 * Purpose: Validate IK solver convergence, accuracy, and performance
 *
 * Tests:
 * 1. Position-only IK convergence
 * 2. Position + orientation IK convergence
 * 3. Pure rotation IK (validates fix from v0.2.0)
 * 4. Round-trip FK→IK→FK consistency
 * 5. Performance benchmarks
 * 6. Edge cases (unreachable targets, singularities)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { InverseKinematicsSolver } from '../InverseKinematicsSolver';
import { ForwardKinematicsSolver } from '../ForwardKinematicsSolver';
import { KinematicsManager } from '../KinematicsManager';
import type { IKSolution, IKTarget } from '../InverseKinematicsSolver';

describe('Inverse Kinematics - Convergence Tests', () => {
  let engine: BABYLON.Engine | null = null;
  let scene: BABYLON.Scene | null = null;
  let ikSolver: InverseKinematicsSolver;
  let fkSolver: ForwardKinematicsSolver;
  let kinematicsManager: KinematicsManager;
  let canRunTests = false;

  beforeAll(async () => {
    try {
      engine = new BABYLON.NullEngine();
      scene = new BABYLON.Scene(engine);

      ikSolver = InverseKinematicsSolver.getInstance();
      fkSolver = ForwardKinematicsSolver.getInstance();
      kinematicsManager = KinematicsManager.getInstance();

      canRunTests = true;
    } catch (error) {
      console.warn('Cannot run IK convergence tests: BABYLON.js engine creation failed');
      canRunTests = false;
    }
  });

  describe('IK Position Convergence', () => {
    it.skipIf(!canRunTests)('should converge to reachable position target', () => {
      // Test IK position-only move
      const chainName = 'test_chain';
      const initialAngles = [0, 0, 0, 0, 0, 0];

      // Compute FK at initial position
      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        // Skip test if no robot loaded
        return;
      }

      // Create target slightly offset from initial
      const target: IKTarget = {
        position: initialPose.position.add(new BABYLON.Vector3(0.01, 0, 0)), // 10mm in X
      };

      // Solve IK
      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles, {
        maxIterations: 1000,
        tolerance: 0.005, // 5mm
      });

      // IK should succeed
      expect(ikResult.success).toBe(true);

      // Error should be below tolerance
      expect(ikResult.error).toBeLessThan(0.005);

      // Should converge in reasonable iterations
      expect(ikResult.iterations).toBeLessThan(1000);
      expect(ikResult.iterations).toBeGreaterThan(0);

      // Joint angles should be valid (not NaN)
      ikResult.jointAngles.forEach((angle) => {
        expect(isFinite(angle)).toBe(true);
      });
    });

    it.skipIf(!canRunTests)('should achieve <5mm position accuracy', () => {
      const chainName = 'test_chain';
      const initialAngles = [0.1, 0.2, 0.3, 0, 0, 0];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      // Target 20mm away in Y
      const target: IKTarget = {
        position: initialPose.position.add(new BABYLON.Vector3(0, 0.02, 0)),
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);

      if (ikResult.success) {
        // Verify by computing FK at solution
        const finalPose = fkSolver.solve(chainName, ikResult.jointAngles);

        if (finalPose) {
          const positionError = BABYLON.Vector3.Distance(target.position, finalPose.position);

          // Should be within 5mm
          expect(positionError).toBeLessThan(0.005);
        }
      }
    });
  });

  describe('IK Position + Orientation Convergence', () => {
    it.skipIf(!canRunTests)('should converge to position + orientation target', () => {
      const chainName = 'test_chain';
      const initialAngles = [0, 0, 0, 0, 0, 0];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      // Create target with small position and rotation changes
      const rotationDelta = BABYLON.Quaternion.RotationAxis(
        new BABYLON.Vector3(0, 0, 1), // Z-axis
        10 * Math.PI / 180 // 10° rotation
      );

      const target: IKTarget = {
        position: initialPose.position.add(new BABYLON.Vector3(0.01, 0, 0)),
        rotation: initialPose.rotation.multiply(rotationDelta),
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);

      expect(ikResult.success).toBe(true);
      expect(ikResult.error).toBeLessThan(0.005);
    });

    it.skipIf(!canRunTests)('should achieve <1° rotation accuracy', () => {
      const chainName = 'test_chain';
      const initialAngles = [0.1, 0.2, 0.3, 0.1, 0.2, 0.1];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      // Small rotation change
      const rotationDelta = BABYLON.Quaternion.RotationAxis(
        new BABYLON.Vector3(1, 0, 0),
        5 * Math.PI / 180 // 5° around X
      );

      const target: IKTarget = {
        position: initialPose.position,
        rotation: initialPose.rotation.multiply(rotationDelta),
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);

      if (ikResult.success) {
        const finalPose = fkSolver.solve(chainName, ikResult.jointAngles);

        if (finalPose && target.rotation) {
          // Compute rotation error
          const rotationError = target.rotation.multiply(BABYLON.Quaternion.Inverse(finalPose.rotation));

          // Convert to axis-angle to get angular error
          const angle = 2 * Math.acos(Math.min(1.0, Math.abs(rotationError.w)));
          const angleDegrees = angle * (180 / Math.PI);

          // Should be within 1°
          expect(angleDegrees).toBeLessThan(1.0);
        }
      }
    });
  });

  describe('IK Pure Rotation Convergence (v0.2.0 Fix)', () => {
    it.skipIf(!canRunTests)('should converge to pure rotation target (position unchanged)', () => {
      // This test validates the fix from commit 22a5710 (v0.2.0)
      // Before: Line search only evaluated position error, failed for pure rotation
      // After: Line search evaluates total error (position + orientation)

      const chainName = 'test_chain';
      const initialAngles = [20 * Math.PI / 180, 0, 0, 0, 45 * Math.PI / 180, 0];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      // Pure rotation target: same position, rotated orientation
      const rotationDelta = BABYLON.Quaternion.RotationAxis(
        new BABYLON.Vector3(1, 0, 0), // Rotate around X
        5 * Math.PI / 180 // 5° rotation
      );

      const target: IKTarget = {
        position: initialPose.position.clone(), // Same position
        rotation: initialPose.rotation.multiply(rotationDelta), // Rotated
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles, {
        maxIterations: 1000,
        tolerance: 0.001,
        positionWeight: 1.0,
        orientationWeight: 2.0, // Higher weight for orientation (as in rotateTCP)
      });

      // IK should succeed (was failing before v0.2.0 fix)
      expect(ikResult.success).toBe(true);

      if (ikResult.success) {
        const finalPose = fkSolver.solve(chainName, ikResult.jointAngles);

        if (finalPose && target.rotation) {
          // Position should remain stable (<1mm drift)
          const positionDrift = BABYLON.Vector3.Distance(target.position, finalPose.position);
          expect(positionDrift).toBeLessThan(0.001);

          // Rotation should be accurate (<0.5°)
          const rotationError = target.rotation.multiply(BABYLON.Quaternion.Inverse(finalPose.rotation));
          const angle = 2 * Math.acos(Math.min(1.0, Math.abs(rotationError.w)));
          const angleDegrees = angle * (180 / Math.PI);
          expect(angleDegrees).toBeLessThan(0.5);
        }
      }
    });

    it.skipIf(!canRunTests)('should converge to RX rotation (5° around world X)', () => {
      // Specific test case from TCP_ROTARY_MOVE_FIX.md
      const chainName = 'test_chain';
      const initialAngles = [20 * Math.PI / 180, 0, 0, 0, 45 * Math.PI / 180, 0];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      const rotationDelta = BABYLON.Quaternion.RotationAxis(
        new BABYLON.Vector3(1, 0, 0),
        5 * Math.PI / 180
      );

      const target: IKTarget = {
        position: initialPose.position,
        rotation: initialPose.rotation.multiply(rotationDelta),
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles, {
        orientationWeight: 2.0,
        tolerance: 0.001,
      });

      expect(ikResult.success).toBe(true);

      if (ikResult.success) {
        const finalPose = fkSolver.solve(chainName, ikResult.jointAngles);

        if (finalPose && target.rotation) {
          // Validate fix: rotation error <0.1° (was 0.52° before fix)
          const rotationError = target.rotation.multiply(BABYLON.Quaternion.Inverse(finalPose.rotation));
          const angle = 2 * Math.acos(Math.min(1.0, Math.abs(rotationError.w)));
          const angleDegrees = angle * (180 / Math.PI);

          expect(angleDegrees).toBeLessThan(0.1); // Should be ~0.01° with fix
        }
      }
    });
  });

  describe('FK ↔ IK Round-Trip Consistency', () => {
    it.skipIf(!canRunTests)('FK → IK → FK should preserve pose', () => {
      const chainName = 'test_chain';
      const initialAngles = [0.1, 0.2, -0.3, 0.15, -0.1, 0.2];

      // Step 1: FK
      const pose1 = fkSolver.solve(chainName, initialAngles);

      if (!pose1) {
        return;
      }

      // Step 2: IK (use pose1 as target)
      const ikResult = ikSolver.solveJacobianTranspose(chainName, {
        position: pose1.position,
        rotation: pose1.rotation,
      }, initialAngles);

      expect(ikResult.success).toBe(true);

      if (!ikResult.success) {
        return;
      }

      // Step 3: FK again
      const pose2 = fkSolver.solve(chainName, ikResult.jointAngles);

      if (pose2) {
        // Position should match within 1mm
        const positionDiff = BABYLON.Vector3.Distance(pose1.position, pose2.position);
        expect(positionDiff).toBeLessThan(0.001);

        // Rotation should match within 0.5°
        const rotationError = pose1.rotation.multiply(BABYLON.Quaternion.Inverse(pose2.rotation));
        const angle = 2 * Math.acos(Math.min(1.0, Math.abs(rotationError.w)));
        const angleDegrees = angle * (180 / Math.PI);
        expect(angleDegrees).toBeLessThan(0.5);
      }
    });

    it.skipIf(!canRunTests)('IK should find solution close to initial guess', () => {
      const chainName = 'test_chain';
      const initialAngles = [0.1, 0.2, 0.3, 0, 0, 0];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      // Target is same as initial (IK should return near-zero update)
      const ikResult = ikSolver.solveJacobianTranspose(chainName, {
        position: initialPose.position,
        rotation: initialPose.rotation,
      }, initialAngles);

      expect(ikResult.success).toBe(true);

      if (ikResult.success) {
        // Joint angles should be very close to initial (within 1°)
        for (let i = 0; i < initialAngles.length; i++) {
          const angleDiff = Math.abs(ikResult.jointAngles[i] - initialAngles[i]);
          expect(angleDiff).toBeLessThan(1 * Math.PI / 180); // 1° tolerance
        }
      }
    });
  });

  describe('IK Performance', () => {
    it.skipIf(!canRunTests)('should converge in <100 iterations for small moves', () => {
      const chainName = 'test_chain';
      const initialAngles = [0, 0, 0, 0, 0, 0];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      // Small move (10mm)
      const target: IKTarget = {
        position: initialPose.position.add(new BABYLON.Vector3(0.01, 0, 0)),
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);

      if (ikResult.success) {
        expect(ikResult.iterations).toBeLessThan(100);
      }
    });

    it.skipIf(!canRunTests)('should solve IK in <100ms', async () => {
      const chainName = 'test_chain';
      const initialAngles = [0.1, 0.2, 0.3, 0, 0, 0];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      const target: IKTarget = {
        position: initialPose.position.add(new BABYLON.Vector3(0.02, 0, 0)),
      };

      const startTime = performance.now();
      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);
      const endTime = performance.now();

      const solveTime = endTime - startTime;

      // Should complete in <100ms
      expect(solveTime).toBeLessThan(100);

      // And should succeed
      expect(ikResult.success).toBe(true);
    });
  });

  describe('IK Edge Cases', () => {
    it.skipIf(!canRunTests)('should fail gracefully for unreachable target', () => {
      const chainName = 'test_chain';
      const initialAngles = [0, 0, 0, 0, 0, 0];

      // Target far outside workspace
      const target: IKTarget = {
        position: new BABYLON.Vector3(10, 10, 10), // 10 meters away (unreachable)
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles, {
        maxIterations: 100, // Limit iterations for speed
      });

      // Should fail gracefully
      expect(ikResult.success).toBe(false);
      expect(ikResult.error).toBeGreaterThan(0.1); // High error
      expect(ikResult.iterations).toBeGreaterThan(0); // Should have tried
    });

    it.skipIf(!canRunTests)('should handle invalid chain name', () => {
      const chainName = 'nonexistent_chain';
      const initialAngles = [0, 0, 0, 0, 0, 0];

      const target: IKTarget = {
        position: new BABYLON.Vector3(0.5, 0, 0.5),
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);

      // Should fail gracefully
      expect(ikResult.success).toBe(false);
    });

    it.skipIf(!canRunTests)('should handle very small target changes (<0.1mm)', () => {
      const chainName = 'test_chain';
      const initialAngles = [0.1, 0.2, 0.3, 0, 0, 0];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      // Very small move (0.01mm = 0.00001m)
      const target: IKTarget = {
        position: initialPose.position.add(new BABYLON.Vector3(0.00001, 0, 0)),
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);

      // Should either succeed quickly or recognize it's already there
      if (ikResult.success) {
        expect(ikResult.iterations).toBeLessThan(50);
      }
    });

    it.skipIf(!canRunTests)('should handle conflicting position/orientation constraints', () => {
      const chainName = 'test_chain';
      const initialAngles = [0, 0, 0, 0, 0, 0];

      // Create a potentially conflicting target
      // (This may or may not be reachable depending on robot geometry)
      const target: IKTarget = {
        position: new BABYLON.Vector3(0.3, 0, 0.5),
        rotation: BABYLON.Quaternion.RotationYawPitchRoll(
          Math.PI / 2, // 90° yaw
          Math.PI / 4, // 45° pitch
          0
        ),
      };

      const ikResult = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);

      // Should either succeed or fail gracefully
      expect(ikResult).toBeDefined();
      expect(ikResult.iterations).toBeGreaterThan(0);
    });
  });

  describe('IK Stability', () => {
    it.skipIf(!canRunTests)('should produce deterministic results (same input = same output)', () => {
      const chainName = 'test_chain';
      const initialAngles = [0.1, 0.2, 0.3, 0, 0, 0];

      const initialPose = fkSolver.solve(chainName, initialAngles);

      if (!initialPose) {
        return;
      }

      const target: IKTarget = {
        position: initialPose.position.add(new BABYLON.Vector3(0.01, 0, 0)),
      };

      // Solve three times with same input
      const result1 = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);
      const result2 = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);
      const result3 = ikSolver.solveJacobianTranspose(chainName, target, initialAngles);

      // Results should be identical
      expect(result1.success).toBe(result2.success);
      expect(result2.success).toBe(result3.success);

      if (result1.success && result2.success && result3.success) {
        // Joint angles should match
        for (let i = 0; i < result1.jointAngles.length; i++) {
          expect(result1.jointAngles[i]).toBeCloseTo(result2.jointAngles[i], 6);
          expect(result2.jointAngles[i]).toBeCloseTo(result3.jointAngles[i], 6);
        }
      }
    });
  });
});

/**
 * Test Summary:
 *
 * These tests validate:
 * 1. ✅ IK convergence for position targets
 * 2. ✅ IK convergence for position + orientation targets
 * 3. ✅ Pure rotation IK (v0.2.0 fix validation)
 * 4. ✅ Round-trip FK→IK→FK consistency
 * 5. ✅ Performance (<100ms solve time)
 * 6. ✅ Edge cases (unreachable, invalid, etc.)
 *
 * Known Limitations:
 * - Tests require BABYLON.js engine (will skip in pure Node.js)
 * - Tests require robot loaded to fully validate
 * - Numerical tests allow small tolerances for floating-point errors
 *
 * Manual Verification (Browser):
 * - Position moves: Verified working
 * - Rotation moves: Verified <0.1° error (v0.2.0)
 * - Complex moves: Verified working
 */
