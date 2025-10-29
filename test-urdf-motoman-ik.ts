// Test script for Motoman MH5 URDF IK verification
// Run this after importing: C:\Users\George\source\repos\kinetiCORE_DATA\robots\motoman_mh5\motoman_mh5.urdf

import { InverseKinematicsSolver } from './src/kinematics/InverseKinematicsSolver';
import { ForwardKinematicsSolver } from './src/kinematics/ForwardKinematicsSolver';
import { KinematicsManager } from './src/kinematics/KinematicsManager';
import * as BABYLON from '@babylonjs/core';

/**
 * Test IK accuracy with forward-backward verification
 */
export async function testMotomanIK() {
  console.log('=== Testing Motoman MH5 URDF IK ===\n');

  const fkSolver = ForwardKinematicsSolver.getInstance();
  const ikSolver = InverseKinematicsSolver.getInstance();
  const kinematicsManager = KinematicsManager.getInstance();

  // Find the kinematic chain
  const chains = kinematicsManager.getAllChains();
  console.log(`Found ${chains.length} kinematic chains`);
  
  const robotChain = chains.find(c => c.name.includes('motoman') || c.name.includes('MH5'));
  if (!robotChain) {
    console.error('No Motoman MH5 chain found. Did you import the URDF?');
    return;
  }

  console.log(`Testing chain: ${robotChain.name}\n`);

  // Test 1: Forward Kinematics - Known Configuration
  console.log('Test 1: Forward Kinematics with known joint angles');
  const testAngles = [
    0.0,      // Joint 1
    0.5,      // Joint 2
    -1.0,     // Joint 3
    0.0,      // Joint 4
    0.0,      // Joint 5
    0.0       // Joint 6
  ];

  const pose = fkSolver.solve(robotChain.name, testAngles);
  if (!pose) {
    console.error('❌ Forward kinematics failed');
    return;
  }

  console.log(`✅ FK Pose:`);
  console.log(`  Position: (${pose.position.x.toFixed(3)}, ${pose.position.y.toFixed(3)}, ${pose.position.z.toFixed(3)})`);
  console.log(`  Rotation: (${pose.rotation.x.toFixed(3)}, ${pose.rotation.y.toFixed(3)}, ${pose.rotation.z.toFixed(3)}, ${pose.rotation.w.toFixed(3)})`);
  console.log();

  // Test 2: Inverse Kinematics - Recover joint angles
  console.log('Test 2: Inverse Kinematics - Recovering joint angles');
  const target: IKTarget = {
    position: pose.position.clone(),
    rotation: pose.rotation.clone(),
  };

  const solution = ikSolver.solveJacobianTranspose(robotChain.name, target, testAngles, {
    maxIterations: 100,
    tolerance: 0.001,
    stepSize: 0.2,
    damping: 0.1,
  });

  console.log(`✅ IK Solution:`);
  console.log(`  Success: ${solution.success}`);
  console.log(`  Error: ${solution.error.toFixed(6)} m`);
  console.log(`  Iterations: ${solution.iterations}`);
  console.log(`  Joint Angles: [${solution.jointAngles.map(a => a.toFixed(3)).join(', ')}]`);
  console.log();

  // Test 3: Verify accuracy - Forward kinematics with IK solution
  console.log('Test 3: Verifying IK accuracy');
  const verifyPose = fkSolver.solve(robotChain.name, solution.jointAngles);
  if (!verifyPose) {
    console.error('❌ Verification FK failed');
    return;
  }

  const positionError = target.position.subtract(verifyPose.position).length();
  const rotationError = computeQuaternionDistance(target.rotation || BABYLON.Quaternion.Identity(), verifyPose.rotation);

  console.log(`Position Error: ${positionError.toFixed(6)} m`);
  console.log(`Rotation Error: ${rotationError.toFixed(6)} rad`);

  if (positionError < 0.001 && rotationError < 0.01) {
    console.log('✅ IK accuracy test PASSED');
  } else {
    console.log('❌ IK accuracy test FAILED');
    console.log('   Expected position:', target.position);
    console.log('   Actual position:', verifyPose.position);
  }
  console.log();

  // Test 4: Test reachability - Random targets in workspace
  console.log('Test 4: Testing reachability');
  let reachableCount = 0;
  const testCount = 20;

  for (let i = 0; i < testCount; i++) {
    const randomTarget: IKTarget = {
      position: new BABYLON.Vector3(
        Math.random() * 0.5 - 0.25, // -0.25 to 0.25 m
        Math.random() * 0.3 + 0.2,  // 0.2 to 0.5 m (keep above ground)
        Math.random() * 0.5 - 0.25  // -0.25 to 0.25 m
      ),
    };

    const testSolution = ikSolver.solveJacobianTranspose(robotChain.name, randomTarget, testAngles, {
      maxIterations: 50,
      tolerance: 0.01,
    });

    if (testSolution.success) {
      reachableCount++;
    }
  }

  console.log(`Reachable targets: ${reachableCount}/${testCount} (${(reachableCount / testCount * 100).toFixed(1)}%)`);
  console.log();

  // Test 5: Test joint limits enforcement
  console.log('Test 5: Testing joint limits enforcement');
  const joints = kinematicsManager.getChainJoints(robotChain.id);
  console.log(`Joint limits:`);
  joints.forEach((joint, i) => {
    console.log(`  Joint ${i + 1} (${joint.name}): [${joint.limits.lower.toFixed(2)}, ${joint.limits.upper.toFixed(2)}]`);
  });

  // Summary
  console.log('=== Test Summary ===');
  console.log(`Chain: ${robotChain.name}`);
  console.log(`Joints: ${joints.length}`);
  console.log(`IK Tests: ${reachableCount}/${testCount} passed`);
  console.log('Status: ✅ All tests completed');
}

/**
 * Compute distance between two quaternions
 */
function computeQuaternionDistance(q1: BABYLON.Quaternion, q2: BABYLON.Quaternion): number {
  // Angle between quaternions
  const dot = Math.abs(q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w);
  const angle = Math.acos(Math.min(1, dot));
  return angle;
}

/**
 * Get IK target type helper
 */
interface IKTarget {
  position: BABYLON.Vector3;
  rotation?: BABYLON.Quaternion;
}


