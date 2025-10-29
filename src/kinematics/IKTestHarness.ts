/**
 * IKTestHarness.ts
 * Independent test tool for FK/IK verification with Euler angle inputs
 *
 * Purpose: Solve IK from user-friendly Euler inputs (X, Y, Z, RX, RY, RZ)
 * Helps: Understand underlying issues by testing specific poses
 */

import * as BABYLON from '@babylonjs/core';
import type { ForwardKinematicsSolver } from './ForwardKinematicsSolver';
import type { InverseKinematicsSolver } from './InverseKinematicsSolver';
import type { KinematicsManager } from './KinematicsManager';

export interface EulerPose {
  // Position in meters (Babylon Y-up space)
  x: number;
  y: number;
  z: number;
  // Rotation in degrees (Euler XYZ order)
  rx: number;
  ry: number;
  rz: number;
}

export interface IKTestResult {
  success: boolean;
  error: number;
  iterations: number;
  jointAngles: number[];
  jointAnglesDegrees: number[];
  targetPose: EulerPose;
  achievedPose: EulerPose;
  positionError: number;
  orientationErrorDegrees: number;
  convergenceHistory: number[];
}

export class IKTestHarness {
  private static instance: IKTestHarness;
  private fkSolver: ForwardKinematicsSolver | null = null;
  private ikSolver: InverseKinematicsSolver | null = null;
  private kinematicsManager: KinematicsManager | null = null;

  private constructor() {}

  static getInstance(): IKTestHarness {
    if (!IKTestHarness.instance) {
      IKTestHarness.instance = new IKTestHarness();
    }
    return IKTestHarness.instance;
  }

  /**
   * Initialize the test harness
   */
  initialize(
    fkSolver: ForwardKinematicsSolver,
    ikSolver: InverseKinematicsSolver,
    kinematicsManager: KinematicsManager
  ): void {
    this.fkSolver = fkSolver;
    this.ikSolver = ikSolver;
    this.kinematicsManager = kinematicsManager;
    console.log('[IKTestHarness] Initialized');
  }

  /**
   * Test IK by solving for a specific Euler pose
   */
  testEulerPose(chainName: string, targetPose: EulerPose): IKTestResult | null {
    if (!this.fkSolver || !this.ikSolver || !this.kinematicsManager) {
      console.error('[IKTestHarness] Not initialized');
      return null;
    }

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║          IK Test Harness - Euler Pose Input                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n[IKTestHarness] Testing chain: ${chainName}`);
    console.log(`[IKTestHarness] Target pose (Babylon Y-up, meters, degrees):`);
    console.log(`  Position: X=${targetPose.x.toFixed(4)}m Y=${targetPose.y.toFixed(4)}m Z=${targetPose.z.toFixed(4)}m`);
    console.log(`  Rotation: RX=${targetPose.rx.toFixed(1)}° RY=${targetPose.ry.toFixed(1)}° RZ=${targetPose.rz.toFixed(1)}°`);

    // Convert Euler angles to quaternion
    const targetRotation = this.eulerToQuaternion(targetPose.rx, targetPose.ry, targetPose.rz);
    const targetPosition = new BABYLON.Vector3(targetPose.x, targetPose.y, targetPose.z);

    // Get current joint angles as initial guess
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      console.error(`[IKTestHarness] Chain not found: ${chainName}`);
      return null;
    }

    const joints = this.kinematicsManager.getActuatedJoints(chain.id);
    const initialAngles = joints.map(j => j.position);

    console.log(`\n[IKTestHarness] Initial joint angles (degrees): [${initialAngles.map(a => (a * 180 / Math.PI).toFixed(1)).join(', ')}]°`);

    // Solve IK
    console.log(`\n[IKTestHarness] Solving IK...`);
    const solution = this.ikSolver.solveJacobianTranspose(
      chainName,
      {
        position: targetPosition,
        rotation: targetRotation,
      },
      initialAngles,
      {
        maxIterations: 1000,
        tolerance: 0.005,
        stepSize: 0.1,
        damping: 0.2,
      }
    );

    console.log(`\n[IKTestHarness] IK Result:`);
    console.log(`  Success: ${solution.success ? '✅' : '❌'}`);
    console.log(`  Error: ${solution.error.toFixed(6)}m`);
    console.log(`  Iterations: ${solution.iterations}`);
    console.log(`  Joint angles (radians): [${solution.jointAngles.map(a => a.toFixed(4)).join(', ')}]`);
    console.log(`  Joint angles (degrees): [${solution.jointAngles.map(a => (a * 180 / Math.PI).toFixed(1)).join(', ')}]°`);

    // Verify by computing FK with solution
    const achievedPoseLocal = this.fkSolver.solve(chainName, solution.jointAngles);
    if (!achievedPoseLocal) {
      console.error('[IKTestHarness] FK verification failed');
      return null;
    }

    // Transform to world space
    const baseMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
    const achievedPosWorld = BABYLON.Vector3.TransformCoordinates(achievedPoseLocal.position, baseMatrix);
    const baseRot = BABYLON.Quaternion.FromRotationMatrix(baseMatrix.getRotationMatrix());
    const achievedRotWorld = baseRot.multiply(achievedPoseLocal.rotation);

    // Convert achieved rotation to Euler
    const achievedEuler = this.quaternionToEuler(achievedRotWorld);
    const achievedPose: EulerPose = {
      x: achievedPosWorld.x,
      y: achievedPosWorld.y,
      z: achievedPosWorld.z,
      rx: achievedEuler.x,
      ry: achievedEuler.y,
      rz: achievedEuler.z,
    };

    // Compute errors
    const positionError = BABYLON.Vector3.Distance(targetPosition, achievedPosWorld);
    const orientationError = this.computeOrientationError(targetRotation, achievedRotWorld);

    console.log(`\n[IKTestHarness] Verification (FK with solution):`);
    console.log(`  Achieved position: X=${achievedPose.x.toFixed(4)}m Y=${achievedPose.y.toFixed(4)}m Z=${achievedPose.z.toFixed(4)}m`);
    console.log(`  Achieved rotation: RX=${achievedPose.rx.toFixed(1)}° RY=${achievedPose.ry.toFixed(1)}° RZ=${achievedPose.rz.toFixed(1)}°`);
    console.log(`  Position error: ${(positionError * 1000).toFixed(2)}mm`);
    console.log(`  Orientation error: ${orientationError.toFixed(2)}°`);

    const result: IKTestResult = {
      success: solution.success,
      error: solution.error,
      iterations: solution.iterations,
      jointAngles: solution.jointAngles,
      jointAnglesDegrees: solution.jointAngles.map(a => a * 180 / Math.PI),
      targetPose,
      achievedPose,
      positionError,
      orientationErrorDegrees: orientationError,
      convergenceHistory: [], // TODO: Capture from IK solver
    };

    // Overall assessment
    console.log(`\n[IKTestHarness] Assessment:`);
    if (positionError < 0.005 && orientationError < 5.0) {
      console.log('  ✅ EXCELLENT: Position <5mm, Orientation <5°');
    } else if (positionError < 0.010 && orientationError < 10.0) {
      console.log('  ✅ GOOD: Position <10mm, Orientation <10°');
    } else if (positionError < 0.050) {
      console.log('  ⚠️ ACCEPTABLE: Position <50mm but needs tuning');
    } else {
      console.log('  ❌ POOR: Error too large, IK may be broken');
    }

    console.log('\n╚════════════════════════════════════════════════════════════════╝\n');

    return result;
  }

  /**
   * Run a comprehensive test suite
   */
  runTestSuite(chainName: string): void {
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║              IK Test Suite - Multiple Poses                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    // Get current TCP position as reference
    const currentPose = this.getCurrentEulerPose(chainName);
    if (!currentPose) {
      console.error('[IKTestHarness] Failed to get current pose');
      return;
    }

    console.log('[IKTestHarness] Current TCP pose (reference):');
    console.log(`  Position: X=${currentPose.x.toFixed(4)}m Y=${currentPose.y.toFixed(4)}m Z=${currentPose.z.toFixed(4)}m`);
    console.log(`  Rotation: RX=${currentPose.rx.toFixed(1)}° RY=${currentPose.ry.toFixed(1)}° RZ=${currentPose.rz.toFixed(1)}°\n`);

    const tests: Array<{ name: string; pose: EulerPose }> = [
      // Test 1: Small +X translation (10mm)
      {
        name: 'Test 1: +X 10mm',
        pose: { ...currentPose, x: currentPose.x + 0.010 },
      },
      // Test 2: Small -X translation (10mm)
      {
        name: 'Test 2: -X 10mm',
        pose: { ...currentPose, x: currentPose.x - 0.010 },
      },
      // Test 3: Small +Y translation (10mm)
      {
        name: 'Test 3: +Y 10mm',
        pose: { ...currentPose, y: currentPose.y + 0.010 },
      },
      // Test 4: Small +Z translation (10mm)
      {
        name: 'Test 4: +Z 10mm',
        pose: { ...currentPose, z: currentPose.z + 0.010 },
      },
      // Test 5: Rotation around Z (15°)
      {
        name: 'Test 5: RZ +15°',
        pose: { ...currentPose, rz: currentPose.rz + 15 },
      },
      // Test 6: Combined translation + rotation
      {
        name: 'Test 6: +X 10mm +RZ 10°',
        pose: { ...currentPose, x: currentPose.x + 0.010, rz: currentPose.rz + 10 },
      },
    ];

    const results: IKTestResult[] = [];

    for (const test of tests) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(test.name);
      console.log('='.repeat(70));

      const result = this.testEulerPose(chainName, test.pose);
      if (result) {
        results.push(result);
      }

      // Small delay to allow console to flush
      // In browser: await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                        Test Suite Summary                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.success && r.positionError < 0.010).length;
    const total = results.length;

    console.log(`Tests passed: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`);
    console.log('\nIndividual results:');
    results.forEach((result, i) => {
      const status = result.success && result.positionError < 0.010 ? '✅' : '❌';
      console.log(`  ${status} ${tests[i].name}: error=${(result.positionError * 1000).toFixed(2)}mm, iter=${result.iterations}`);
    });

    console.log('\n╚═══════════════════════════════════════════════════════════════════╝\n');
  }

  /**
   * Get current TCP pose as Euler angles
   */
  getCurrentEulerPose(chainName: string): EulerPose | null {
    if (!this.fkSolver) return null;

    const tcpPose = this.fkSolver.getNullTCPPose(chainName);
    if (!tcpPose) return null;

    const euler = this.quaternionToEuler(tcpPose.rotation);

    return {
      x: tcpPose.position.x,
      y: tcpPose.position.y,
      z: tcpPose.position.z,
      rx: euler.x,
      ry: euler.y,
      rz: euler.z,
    };
  }

  /**
   * Convert Euler angles (degrees) to quaternion
   */
  private eulerToQuaternion(rx: number, ry: number, rz: number): BABYLON.Quaternion {
    // Convert degrees to radians
    const rxRad = (rx * Math.PI) / 180;
    const ryRad = (ry * Math.PI) / 180;
    const rzRad = (rz * Math.PI) / 180;

    // Babylon uses YXZ order for Euler angles
    return BABYLON.Quaternion.RotationYawPitchRoll(ryRad, rxRad, rzRad);
  }

  /**
   * Convert quaternion to Euler angles (degrees)
   */
  private quaternionToEuler(q: BABYLON.Quaternion): { x: number; y: number; z: number } {
    const euler = q.toEulerAngles();
    return {
      x: (euler.x * 180) / Math.PI,
      y: (euler.y * 180) / Math.PI,
      z: (euler.z * 180) / Math.PI,
    };
  }

  /**
   * Compute orientation error between two quaternions (in degrees)
   */
  private computeOrientationError(q1: BABYLON.Quaternion, q2: BABYLON.Quaternion): number {
    // Angle between quaternions: θ = 2 * acos(|q1 · q2|)
    const dot = Math.abs(
      q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w
    );
    const angleRad = 2 * Math.acos(Math.min(1, dot));
    return (angleRad * 180) / Math.PI;
  }

  /**
   * Apply joint angles directly (for testing FK)
   */
  applyJointAngles(chainName: string, jointAnglesDegrees: number[]): void {
    if (!this.fkSolver || !this.kinematicsManager) return;

    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return;

    const joints = this.kinematicsManager.getActuatedJoints(chain.id);
    const jointAnglesRad = jointAnglesDegrees.map(deg => (deg * Math.PI) / 180);

    console.log('[IKTestHarness] Applying joint angles:');
    console.log(`  Degrees: [${jointAnglesDegrees.map(d => d.toFixed(1)).join(', ')}]°`);
    console.log(`  Radians: [${jointAnglesRad.map(r => r.toFixed(4)).join(', ')}]`);

    for (let i = 0; i < joints.length && i < jointAnglesRad.length; i++) {
      this.fkSolver.updateJointPosition(joints[i].id, jointAnglesRad[i]);
    }

    // Verify FK result
    const tcpPose = this.fkSolver.getNullTCPPose(chainName);
    if (tcpPose) {
      console.log(`  Resulting TCP: ${tcpPose.position.toString()}`);
    }
  }

  /**
   * Test forward-backward consistency
   * FK(joints) → pose → IK(pose) → joints' should equal original joints
   */
  testForwardBackwardConsistency(chainName: string): void {
    if (!this.fkSolver || !this.ikSolver || !this.kinematicsManager) return;

    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║           Forward-Backward Consistency Test                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return;

    const joints = this.kinematicsManager.getActuatedJoints(chain.id);
    const originalAngles = joints.map(j => j.position);

    console.log('[IKTestHarness] Original joint angles (degrees):');
    console.log(`  [${originalAngles.map(a => (a * 180 / Math.PI).toFixed(1)).join(', ')}]°`);

    // Step 1: FK to get pose
    const poseLocal = this.fkSolver.solve(chainName, originalAngles);
    if (!poseLocal) {
      console.error('[IKTestHarness] FK failed');
      return;
    }

    const baseMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
    const poseWorld = BABYLON.Vector3.TransformCoordinates(poseLocal.position, baseMatrix);
    const baseRot = BABYLON.Quaternion.FromRotationMatrix(baseMatrix.getRotationMatrix());
    const rotWorld = baseRot.multiply(poseLocal.rotation);

    console.log(`\n[IKTestHarness] FK result (world):`);
    console.log(`  Position: ${poseWorld.toString()}`);

    // Step 2: IK to recover joint angles
    const solution = this.ikSolver.solveJacobianTranspose(
      chainName,
      { position: poseWorld, rotation: rotWorld },
      originalAngles
    );

    console.log(`\n[IKTestHarness] IK recovery:`);
    console.log(`  Success: ${solution.success ? '✅' : '❌'}`);
    console.log(`  Recovered joint angles (degrees):`);
    console.log(`  [${solution.jointAngles.map(a => (a * 180 / Math.PI).toFixed(1)).join(', ')}]°`);

    // Step 3: Compare
    const maxDiff = Math.max(
      ...originalAngles.map((orig, i) => Math.abs(orig - solution.jointAngles[i]))
    );

    console.log(`\n[IKTestHarness] Joint angle difference:`);
    for (let i = 0; i < originalAngles.length; i++) {
      const diff = Math.abs(originalAngles[i] - solution.jointAngles[i]) * 180 / Math.PI;
      console.log(`  Joint ${i}: ${diff.toFixed(3)}°`);
    }
    console.log(`  Max difference: ${(maxDiff * 180 / Math.PI).toFixed(3)}°`);

    if (maxDiff < 0.01) { // ~0.5 degrees
      console.log('  ✅ EXCELLENT: Forward-backward consistency verified');
    } else if (maxDiff < 0.1) { // ~5 degrees
      console.log('  ✅ GOOD: Acceptable consistency');
    } else {
      console.log('  ❌ POOR: Large discrepancy detected');
    }

    console.log('\n╚═══════════════════════════════════════════════════════════════════╝\n');
  }
}
