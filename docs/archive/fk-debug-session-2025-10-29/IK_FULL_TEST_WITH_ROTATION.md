# Complete IK Test with Position and Rotation Verification

## Test Configurations

Here are 5 different joint configurations to test FK→IK→FK round-trip accuracy:

### Configuration 1: Home Position (Baseline)
```
J0 = 0°
J1 = 0°
J2 = 0°
J3 = 0°
J4 = 0°
J5 = 0°
```

### Configuration 2: Simple Single Joint
```
J0 = 45°
J1 = 0°
J2 = 0°
J3 = 0°
J4 = 0°
J5 = 0°
```

### Configuration 3: Two Joint Rotation
```
J0 = 45°
J1 = 30°
J2 = 0°
J3 = 0°
J4 = 0°
J5 = 0°
```

### Configuration 4: Complex Configuration
```
J0 = 45°
J1 = -30°
J2 = 60°
J3 = -20°
J4 = 45°
J5 = 30°
```

### Configuration 5: Near Singularity
```
J0 = 0°
J1 = 90°
J2 = 0°
J3 = 0°
J4 = 90°
J5 = 0°
```

---

## Complete IK Test Script

This script tests:
1. ✅ FK position accuracy (0.00mm divergence)
2. ✅ FK rotation accuracy (angular divergence)
3. ✅ IK solving (can it reach the target?)
4. ✅ IK position accuracy (after solving, how close?)
5. ✅ IK rotation accuracy (after solving, rotation match?)
6. ✅ Round-trip accuracy (FK→IK→FK preserves pose?)

```javascript
console.clear();

// ============================================================================
// CONFIGURATION - Change these joint angles to test different poses
// ============================================================================

const TEST_JOINT_ANGLES_DEG = [45, -30, 60, -20, 45, 30]; // Configuration 4

// ============================================================================
// TEST EXECUTION
// ============================================================================

console.log('═══════════════════════════════════════════════════════════════');
console.log('    COMPLETE IK TEST WITH POSITION AND ROTATION VERIFICATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Get kinematic chain
const chains = kinematicsManager.getAllChains();
const chain = chains[0];
const joints = kinematicsManager.getActuatedJoints(chain.id);

// Convert to radians
const testJointAngles = TEST_JOINT_ANGLES_DEG.map(deg => deg * Math.PI / 180);

console.log('Test Configuration:');
console.log(`  ${TEST_JOINT_ANGLES_DEG.map((a, i) => `J${i}=${a}°`).join(', ')}`);
console.log('');

// ============================================================================
// STEP 1: Set robot to test configuration
// ============================================================================

console.log('STEP 1: Setting robot to test configuration...');
for (let i = 0; i < joints.length; i++) {
  joints[i].position = testJointAngles[i];
}
console.log('  ✅ Robot moved to test pose');
console.log('');

// ============================================================================
// STEP 2: FK Verification (Position + Rotation)
// ============================================================================

console.log('STEP 2: Forward Kinematics Verification...');

const fkPose = fkSolver.solve(chain.name, testJointAngles);
const meshPose = fkSolver.getNullTCPPose(chain.name);

// Position divergence
const positionDiff = BABYLON.Vector3.Distance(meshPose.position, fkPose.position);

// Rotation divergence
const fkQuat = fkPose.rotation.normalize();
const meshQuat = meshPose.rotation.normalize();

const dotProduct = Math.abs(
  fkQuat.x * meshQuat.x +
  fkQuat.y * meshQuat.y +
  fkQuat.z * meshQuat.z +
  fkQuat.w * meshQuat.w
);

const angleDiffRadians = 2 * Math.acos(Math.min(1.0, dotProduct));
const angleDiffDegrees = angleDiffRadians * (180 / Math.PI);

console.log('  FK Position:');
console.log(`    X=${fkPose.position.x.toFixed(4)}m, Y=${fkPose.position.y.toFixed(4)}m, Z=${fkPose.position.z.toFixed(4)}m`);
console.log('  Mesh Position:');
console.log(`    X=${meshPose.position.x.toFixed(4)}m, Y=${meshPose.position.y.toFixed(4)}m, Z=${meshPose.position.z.toFixed(4)}m`);
console.log(`  Position Divergence: ${(positionDiff * 1000).toFixed(2)}mm ${positionDiff < 0.001 ? '✅' : '❌'}`);
console.log('');

console.log('  FK Rotation (Quaternion):');
console.log(`    x=${fkQuat.x.toFixed(4)}, y=${fkQuat.y.toFixed(4)}, z=${fkQuat.z.toFixed(4)}, w=${fkQuat.w.toFixed(4)}`);
console.log('  Mesh Rotation (Quaternion):');
console.log(`    x=${meshQuat.x.toFixed(4)}, y=${meshQuat.y.toFixed(4)}, z=${meshQuat.z.toFixed(4)}, w=${meshQuat.w.toFixed(4)}`);
console.log(`  Rotation Divergence: ${angleDiffDegrees.toFixed(4)}° ${angleDiffDegrees < 0.1 ? '✅' : '❌'}`);
console.log('');

const fkPassed = positionDiff < 0.001 && angleDiffDegrees < 0.1;
console.log(`  FK Verification: ${fkPassed ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

// ============================================================================
// STEP 3: IK Solving
// ============================================================================

console.log('STEP 3: Inverse Kinematics Solving...');

// Use FK pose as target (should be solvable!)
const targetPosition = fkPose.position.clone();
const targetRotation = fkPose.rotation.clone();

console.log('  Target Position:');
console.log(`    X=${targetPosition.x.toFixed(4)}m, Y=${targetPosition.y.toFixed(4)}m, Z=${targetPosition.z.toFixed(4)}m`);
console.log('  Target Rotation (Quaternion):');
console.log(`    x=${targetRotation.x.toFixed(4)}, y=${targetRotation.y.toFixed(4)}, z=${targetRotation.z.toFixed(4)}, w=${targetRotation.w.toFixed(4)}`);
console.log('');

// Solve IK
const ikResult = ikSolver.solve(
  chain.name,
  targetPosition,
  targetRotation,
  testJointAngles // Use current pose as initial guess
);

console.log(`  IK Converged: ${ikResult.success ? '✅ Yes' : '❌ No'}`);
console.log(`  IK Iterations: ${ikResult.iterations}`);
console.log(`  IK Final Error: ${(ikResult.finalError * 1000).toFixed(2)}mm`);
console.log('');

if (!ikResult.success) {
  console.log('  ⚠️ IK did not converge. This may indicate:');
  console.log('     - Target is unreachable (outside workspace)');
  console.log('     - IK solver has a bug');
  console.log('     - Jacobian is incorrect');
  console.log('');
}

// ============================================================================
// STEP 4: IK Solution Verification (Position + Rotation)
// ============================================================================

console.log('STEP 4: IK Solution Verification...');

// Compute FK at IK solution
const ikSolutionFK = fkSolver.solve(chain.name, ikResult.jointAngles);

// Position error
const ikPositionError = BABYLON.Vector3.Distance(targetPosition, ikSolutionFK.position);

// Rotation error
const ikSolutionQuat = ikSolutionFK.rotation.normalize();
const targetQuat = targetRotation.normalize();

const ikRotDotProduct = Math.abs(
  ikSolutionQuat.x * targetQuat.x +
  ikSolutionQuat.y * targetQuat.y +
  ikSolutionQuat.z * targetQuat.z +
  ikSolutionQuat.w * targetQuat.w
);

const ikRotAngleDiffRadians = 2 * Math.acos(Math.min(1.0, ikRotDotProduct));
const ikRotAngleDiffDegrees = ikRotAngleDiffRadians * (180 / Math.PI);

console.log('  IK Solution Joint Angles:');
console.log(`    ${ikResult.jointAngles.map((a, i) => `J${i}=${(a * 180 / Math.PI).toFixed(2)}°`).join(', ')}`);
console.log('');

console.log('  Achieved Position (FK at IK solution):');
console.log(`    X=${ikSolutionFK.position.x.toFixed(4)}m, Y=${ikSolutionFK.position.y.toFixed(4)}m, Z=${ikSolutionFK.position.z.toFixed(4)}m`);
console.log(`  Position Error: ${(ikPositionError * 1000).toFixed(2)}mm ${ikPositionError < 5 ? '✅' : '❌'}`);
console.log('');

console.log('  Achieved Rotation (FK at IK solution):');
console.log(`    x=${ikSolutionQuat.x.toFixed(4)}, y=${ikSolutionQuat.y.toFixed(4)}, z=${ikSolutionQuat.z.toFixed(4)}, w=${ikSolutionQuat.w.toFixed(4)}`);
console.log(`  Rotation Error: ${ikRotAngleDiffDegrees.toFixed(4)}° ${ikRotAngleDiffDegrees < 1.0 ? '✅' : '❌'}`);
console.log('');

const ikPassed = ikResult.success && ikPositionError < 0.005 && ikRotAngleDiffDegrees < 1.0;
console.log(`  IK Solution Quality: ${ikPassed ? '✅ EXCELLENT' : ikPositionError < 0.010 ? '⚠️ ACCEPTABLE' : '❌ POOR'}`);
console.log('');

// ============================================================================
// STEP 5: Round-Trip Verification
// ============================================================================

console.log('STEP 5: Round-Trip Verification (FK→IK→FK)...');

// Joint angle differences
const jointDiffs = testJointAngles.map((orig, i) => {
  let diff = Math.abs(ikResult.jointAngles[i] - orig);
  // Handle angle wrapping (e.g., 350° vs -10°)
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff * (180 / Math.PI);
});

console.log('  Joint Angle Differences:');
for (let i = 0; i < jointDiffs.length; i++) {
  const status = jointDiffs[i] < 1.0 ? '✅' : jointDiffs[i] < 5.0 ? '⚠️' : '❌';
  console.log(`    J${i}: ${jointDiffs[i].toFixed(2)}° ${status}`);
}
console.log('');

const maxJointDiff = Math.max(...jointDiffs);
const roundTripPassed = maxJointDiff < 5.0; // Allow some variation (multiple solutions)

console.log(`  Max Joint Difference: ${maxJointDiff.toFixed(2)}°`);
console.log(`  Round-Trip Test: ${roundTripPassed ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

// ============================================================================
// FINAL SUMMARY
// ============================================================================

console.log('═══════════════════════════════════════════════════════════════');
console.log('                         FINAL SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

const allTestsPassed = fkPassed && ikPassed && roundTripPassed;

console.log(`FK Position Accuracy:     ${positionDiff < 0.001 ? '✅ PERFECT (< 1mm)' : '❌ FAIL'}`);
console.log(`FK Rotation Accuracy:     ${angleDiffDegrees < 0.1 ? '✅ EXCELLENT (< 0.1°)' : angleDiffDegrees < 1.0 ? '⚠️ GOOD (< 1°)' : '❌ FAIL'}`);
console.log(`IK Convergence:           ${ikResult.success ? '✅ YES' : '❌ NO'}`);
console.log(`IK Position Accuracy:     ${ikPositionError < 0.005 ? '✅ EXCELLENT (< 5mm)' : ikPositionError < 0.010 ? '⚠️ GOOD (< 10mm)' : '❌ POOR'}`);
console.log(`IK Rotation Accuracy:     ${ikRotAngleDiffDegrees < 1.0 ? '✅ EXCELLENT (< 1°)' : ikRotAngleDiffDegrees < 5.0 ? '⚠️ GOOD (< 5°)' : '❌ POOR'}`);
console.log(`Round-Trip Consistency:   ${roundTripPassed ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

if (allTestsPassed) {
  console.log('🎉 OVERALL: ALL TESTS PASSED! FK and IK are working correctly! 🎉');
} else if (fkPassed && ikResult.success) {
  console.log('⚠️ OVERALL: FK working, IK converged but with some error.');
} else if (fkPassed && !ikResult.success) {
  console.log('❌ OVERALL: FK working, but IK failed to converge.');
} else {
  console.log('❌ OVERALL: Tests failed. FK or IK has issues.');
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
```

---

## How to Use

### Test Configuration 1 (Home Position):
```javascript
const TEST_JOINT_ANGLES_DEG = [0, 0, 0, 0, 0, 0];
// Then paste the full test script
```

### Test Configuration 2 (Simple):
```javascript
const TEST_JOINT_ANGLES_DEG = [45, 0, 0, 0, 0, 0];
// Then paste the full test script
```

### Test Configuration 3 (Two Joints):
```javascript
const TEST_JOINT_ANGLES_DEG = [45, 30, 0, 0, 0, 0];
// Then paste the full test script
```

### Test Configuration 4 (Complex):
```javascript
const TEST_JOINT_ANGLES_DEG = [45, -30, 60, -20, 45, 30];
// Then paste the full test script
```

### Test Configuration 5 (Near Singularity):
```javascript
const TEST_JOINT_ANGLES_DEG = [0, 90, 0, 0, 90, 0];
// Then paste the full test script
```

---

## Expected Results

### If Everything Works Perfectly:

```
FK Position Accuracy:     ✅ PERFECT (< 1mm)
FK Rotation Accuracy:     ✅ EXCELLENT (< 0.1°)
IK Convergence:           ✅ YES
IK Position Accuracy:     ✅ EXCELLENT (< 5mm)
IK Rotation Accuracy:     ✅ EXCELLENT (< 1°)
Round-Trip Consistency:   ✅ PASS

🎉 OVERALL: ALL TESTS PASSED! FK and IK are working correctly! 🎉
```

### What Each Test Means:

1. **FK Position Accuracy** - Confirms position fix is working (0.00mm)
2. **FK Rotation Accuracy** - Confirms rotation quaternion multiplication is correct
3. **IK Convergence** - Confirms IK solver can find a solution
4. **IK Position Accuracy** - Confirms IK solution reaches target position
5. **IK Rotation Accuracy** - Confirms IK solution achieves target rotation
6. **Round-Trip Consistency** - Confirms FK→IK→FK preserves the pose

---

## Interpreting Results

### ✅ All Tests Pass:
- FK position and rotation are perfect
- IK solver is working correctly
- Jacobian is accurate
- **System is production-ready!**

### ⚠️ FK Pass, IK Acceptable:
- FK is working (our fix is good!)
- IK converges but with 5-10mm or 1-5° error
- **May need IK tuning** (damping, max iterations)

### ❌ FK Rotation Fails:
- Position is 0.00mm but rotation has > 1° error
- **Need to debug rotation accumulation**
- Check lines 606-622 in ForwardKinematicsSolver.ts

### ❌ IK Doesn't Converge:
- FK is working but IK can't solve
- **Possible Jacobian issue**
- Run [FK_JACOBIAN_TEST.md](FK_JACOBIAN_TEST.md) to verify

---

**Created:** 2025-10-29
**Purpose:** Complete end-to-end test of FK and IK with position AND rotation verification
**Configurations:** 5 test poses from simple to complex
