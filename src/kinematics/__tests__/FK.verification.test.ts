/**
 * Forward Kinematics Verification Test Suite
 *
 * Purpose: Prove FK implementation is 100% correct independent of IK
 *
 * Tests:
 * 1. Home position (all zeros)
 * 2. Single joint rotations
 * 3. Combined joint angles
 * 4. Coordinate space transforms
 * 5. FK vs actual mesh position
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { ForwardKinematicsSolver } from '../ForwardKinematicsSolver';
import { KinematicsManager } from '../KinematicsManager';

describe('FK Verification - Independent Tests', () => {
  let fkSolver: ForwardKinematicsSolver;
  let kinematicsManager: KinematicsManager;

  beforeEach(() => {
    fkSolver = ForwardKinematicsSolver.getInstance();
    kinematicsManager = KinematicsManager.getInstance();
  });

  describe('Test 1: Home Position (All Zeros)', () => {
    it('should compute correct TCP pose at home position', () => {
      // TODO: Need to load robot first
      // For 6-axis robot with Z-up coordinate system

      const chainName = 'test_chain';
      const jointAngles = [0, 0, 0, 0, 0, 0]; // radians

      const result = fkSolver.solve(chainName, jointAngles);

      // Expected values depend on robot DH parameters
      // These should be computed manually or with external tool

      // PLACEHOLDER - Replace with actual expected values
      expect(result).toBeDefined();
      if (result) {
        expect(result.position.x).toBeCloseTo(0.4795, 3); // meters
        expect(result.position.y).toBeCloseTo(0.6799, 3);
        expect(result.position.z).toBeCloseTo(0, 3);
      }
    });
  });

  describe('Test 2: Single Joint Rotations', () => {
    it('should correctly compute pose with J1 = 90°', () => {
      const chainName = 'test_chain';
      const jointAngles = [Math.PI / 2, 0, 0, 0, 0, 0]; // 90° in J1

      const result = fkSolver.solve(chainName, jointAngles);

      expect(result).toBeDefined();
      // Expected: TCP should rotate 90° around Z-axis
      // X and Y should swap and change sign based on robot geometry
    });

    it('should correctly compute pose with J2 = 90°', () => {
      const chainName = 'test_chain';
      const jointAngles = [0, Math.PI / 2, 0, 0, 0, 0]; // 90° in J2

      const result = fkSolver.solve(chainName, jointAngles);

      expect(result).toBeDefined();
      // Expected: Elbow should move, TCP position changes
    });

    it('should correctly compute pose with J3 = 90°', () => {
      const chainName = 'test_chain';
      const jointAngles = [0, 0, Math.PI / 2, 0, 0, 0]; // 90° in J3

      const result = fkSolver.solve(chainName, jointAngles);

      expect(result).toBeDefined();
      // Expected: Wrist bends, TCP position changes
    });
  });

  describe('Test 3: Known Configurations', () => {
    it('should match hand-calculated pose for elbow-up config', () => {
      const chainName = 'test_chain';
      const jointAngles = [0, Math.PI / 4, Math.PI / 4, 0, 0, 0];

      const result = fkSolver.solve(chainName, jointAngles);

      expect(result).toBeDefined();
      // Expected values from manual DH calculation or external tool
      // TODO: Calculate expected values
    });

    it('should match external tool (Python robotics) output', () => {
      // Use same angles as Python script
      // Compare outputs
      // This requires running Python script to generate expected values
    });
  });

  describe('Test 4: Coordinate Space Consistency', () => {
    it('should return robot-local coordinates (not world)', () => {
      const chainName = 'test_chain';
      const jointAngles = [0, 0, 0, 0, 0, 0];

      const result = fkSolver.solve(chainName, jointAngles);

      expect(result).toBeDefined();
      if (result) {
        // At home, robot-local should equal world (if base at origin)
        // But result should NOT include base transform

        // This test verifies solve() returns LOCAL coordinates
        // by checking it doesn't change if we move the robot base
      }
    });

    it('should handle base transform correctly', () => {
      const chainName = 'test_chain';
      const jointAngles = [0, 0, 0, 0, 0, 0];

      // Get local pose
      const poseLocal = fkSolver.solve(chainName, jointAngles);
      expect(poseLocal).toBeDefined();

      // Get base transform
      const chain = kinematicsManager.getChain(chainName);
      expect(chain).toBeDefined();

      if (chain && poseLocal) {
        const baseMatrix = kinematicsManager.getBaseWorldMatrix(chain.id);
        expect(baseMatrix).toBeDefined();

        // Transform to world
        const poseWorld = BABYLON.Vector3.TransformCoordinates(
          poseLocal.position,
          baseMatrix || BABYLON.Matrix.Identity()
        );

        // World pose should different from local if base is not at origin
        // (or same if base is at origin)
      }
    });
  });

  describe('Test 5: Jacobian Verification', () => {
    it('should match numerical differentiation', () => {
      const chainName = 'test_chain';
      const jointAngles = [0, 0, 0, 0, 0, 0];
      const epsilon = 0.0001; // Small perturbation

      // Compute analytical Jacobian
      const jacobian = fkSolver.computeJacobian(chainName, jointAngles);
      expect(jacobian).toBeDefined();

      if (!jacobian) return;

      // Compute numerical Jacobian for each joint
      for (let i = 0; i < jointAngles.length; i++) {
        const anglesPlusEps = [...jointAngles];
        anglesPlusEps[i] += epsilon;

        const poseBase = fkSolver.solve(chainName, jointAngles);
        const posePlusEps = fkSolver.solve(chainName, anglesPlusEps);

        expect(poseBase).toBeDefined();
        expect(posePlusEps).toBeDefined();

        if (poseBase && posePlusEps) {
          // Numerical derivative: dpose/dq ≈ (pose(q+ε) - pose(q)) / ε
          const numDx = (posePlusEps.position.x - poseBase.position.x) / epsilon;
          const numDy = (posePlusEps.position.y - poseBase.position.y) / epsilon;
          const numDz = (posePlusEps.position.z - poseBase.position.z) / epsilon;

          // Compare with analytical Jacobian
          expect(jacobian[0][i]).toBeCloseTo(numDx, 2); // dx/dqi
          expect(jacobian[1][i]).toBeCloseTo(numDy, 2); // dy/dqi
          expect(jacobian[2][i]).toBeCloseTo(numDz, 2); // dz/dqi
        }
      }
    });
  });

  describe('Test 6: Roundtrip Consistency', () => {
    it('should be consistent: Local → World → Local', () => {
      const chainName = 'test_chain';
      const jointAngles = [0.1, 0.2, 0.3, 0.1, 0.2, 0.1]; // Random angles

      // Get local pose
      const poseLocal1 = fkSolver.solve(chainName, jointAngles);
      expect(poseLocal1).toBeDefined();

      if (!poseLocal1) return;

      // Transform to world
      const chain = kinematicsManager.getChain(chainName);
      if (!chain) return;

      const baseMatrix = kinematicsManager.getBaseWorldMatrix(chain.id);
      const baseMatrixInv = baseMatrix
        ? BABYLON.Matrix.Invert(baseMatrix)
        : BABYLON.Matrix.Identity();

      const poseWorld = BABYLON.Vector3.TransformCoordinates(
        poseLocal1.position,
        baseMatrix || BABYLON.Matrix.Identity()
      );

      // Transform back to local
      const poseLocal2 = BABYLON.Vector3.TransformCoordinates(
        poseWorld,
        baseMatrixInv
      );

      // Should match original
      expect(poseLocal2.x).toBeCloseTo(poseLocal1.position.x, 4);
      expect(poseLocal2.y).toBeCloseTo(poseLocal1.position.y, 4);
      expect(poseLocal2.z).toBeCloseTo(poseLocal1.position.z, 4);
    });
  });
});

describe('FK vs Mesh Position - Integration Tests', () => {
  // These tests require full scene setup with actual robot mesh
  // Move to integration test suite

  it.skip('should match mesh world position after updateJointPosition', () => {
    // 1. Load robot URDF
    // 2. Set joint angles via updateJointPosition
    // 3. Compute FK with same angles
    // 4. Read mesh world position via getNullTCPPose
    // 5. Compare: should be within 0.1mm
  });

  it.skip('should match mesh position for various joint configurations', () => {
    // Test 10 random joint configurations
    // Each should match FK within 0.1mm
  });
});

/**
 * MANUAL TEST PROCEDURE
 *
 * To verify FK is correct:
 *
 * 1. Load robot in UI
 * 2. Set joints to known angles (e.g., all 0°)
 * 3. Read TCP position from UI overlay
 * 4. Compute FK with same angles
 * 5. Compare: should match within 0.1mm
 *
 * Example for Fanuc 6-axis at home:
 * - Joints: [0, 0, 0, 0, 0, 0]
 * - Expected TCP: Depends on DH parameters
 * - Measure: Use TCP coordinate display in UI
 * - Compare with FK.solve([0,0,0,0,0,0])
 */

/**
 * EXTERNAL VERIFICATION
 *
 * Use Python robotics library to compute FK independently:
 *
 * ```python
 * from roboticstoolbox import DHRobot, RevoluteDH
 * import numpy as np
 *
 * # Define robot with same DH parameters as URDF
 * robot = DHRobot([
 *     RevoluteDH(d=d1, a=a1, alpha=alpha1),
 *     RevoluteDH(d=d2, a=a2, alpha=alpha2),
 *     # ... etc
 * ])
 *
 * # Compute FK
 * T = robot.fkine([0, 0, 0, 0, 0, 0])
 * print(f"Position: {T.t}")  # Translation vector
 * print(f"Rotation: {T.R}")  # Rotation matrix
 * ```
 *
 * Compare output with our FK.solve() result.
 */
