# FK Diagnostic - Why Complex Config Shows Divergence

The complex configuration (45°, -30°, 60°, -20°, 45°, 30°) shows 31.98mm position divergence and 5° rotation divergence, but simpler configs showed 0.00mm.

Let's diagnose what's happening.

## Diagnostic Script

```javascript
console.clear();

console.log('═══════════════════════════════════════════════════════════════');
console.log('              FK DIAGNOSTIC - COMPLEX CONFIGURATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

const chains = kinematicsManager.getAllChains();
const chain = chains[0];
const joints = kinematicsManager.getActuatedJoints(chain.id);

// Test multiple configurations
const configs = [
  { name: 'Home', angles: [0, 0, 0, 0, 0, 0] },
  { name: 'J0 only', angles: [45, 0, 0, 0, 0, 0] },
  { name: 'J0+J1', angles: [45, 30, 0, 0, 0, 0] },
  { name: 'J0+J1+J2', angles: [45, -30, 60, 0, 0, 0] },
  { name: 'Complex', angles: [45, -30, 60, -20, 45, 30] }
];

for (const config of configs) {
  console.log(`--- Testing: ${config.name} ---`);
  console.log(`Angles: ${config.angles.map(a => `${a}°`).join(', ')}`);

  // Set joints
  const testJointAngles = config.angles.map(deg => deg * Math.PI / 180);
  for (let i = 0; i < joints.length; i++) {
    joints[i].position = testJointAngles[i];
  }

  // Wait for mesh update (give it a frame)
  // Note: We can't actually wait in console, but the mesh should update immediately

  // Get FK and mesh poses
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
  const angleDiffDegrees = 2 * Math.acos(Math.min(1.0, dotProduct)) * (180 / Math.PI);

  console.log(`FK Position:   X=${fkPose.position.x.toFixed(4)}, Y=${fkPose.position.y.toFixed(4)}, Z=${fkPose.position.z.toFixed(4)}`);
  console.log(`Mesh Position: X=${meshPose.position.x.toFixed(4)}, Y=${meshPose.position.y.toFixed(4)}, Z=${meshPose.position.z.toFixed(4)}`);
  console.log(`Position Divergence: ${(positionDiff * 1000).toFixed(2)}mm ${positionDiff < 1 ? '✅' : '❌'}`);
  console.log(`Rotation Divergence: ${angleDiffDegrees.toFixed(4)}° ${angleDiffDegrees < 1.0 ? '✅' : '❌'}`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('                         ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('If divergence increases with more joints:');
console.log('  → FK accumulation might have errors in later joints');
console.log('  → Check joint origin offsets or rotation axes');
console.log('');
console.log('If divergence appears suddenly at a specific joint:');
console.log('  → That joint may have incorrect URDF parameters');
console.log('  → Check joint.origin or joint.axis for that joint');
console.log('');
console.log('If mesh position is drastically different from FK:');
console.log('  → Mesh parent hierarchy might not match kinematic chain');
console.log('  → Check that mesh parent-child relationships are correct');
console.log('');
```

## Check IK Solver Availability

```javascript
console.log('Checking IK Solver availability:');
console.log('ikSolver:', typeof ikSolver);
console.log('ikSolver methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ikSolver || {})));
console.log('');

// If ikSolver doesn't exist or doesn't have solve method:
if (!ikSolver) {
  console.log('❌ ikSolver is undefined!');
  console.log('Checking global scope for IK solver...');
  console.log('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('ik')));
} else if (typeof ikSolver.solve !== 'function') {
  console.log('❌ ikSolver exists but has no solve() method!');
  console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ikSolver)));
}
```

## Per-Joint FK Verification

If the complex config has divergence, let's check FK at each joint:

```javascript
console.clear();
console.log('═══════════════════════════════════════════════════════════════');
console.log('           PER-JOINT FK VERIFICATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

const chains = kinematicsManager.getAllChains();
const chain = chains[0];
const joints = kinematicsManager.getActuatedJoints(chain.id);

// Set to complex configuration
const testAngles = [45, -30, 60, -20, 45, 30].map(deg => deg * Math.PI / 180);
for (let i = 0; i < joints.length; i++) {
  joints[i].position = testAngles[i];
}

console.log('Configuration: J0=45°, J1=-30°, J2=60°, J3=-20°, J4=45°, J5=30°');
console.log('');

// Check FK at each joint
for (let i = 0; i < joints.length; i++) {
  console.log(`--- Joint ${i} (${joints[i].name}) ---`);

  // FK up to this joint
  const fkPoseUpToJoint = fkSolver.solveUpToJoint(chain.name, testAngles, i);

  // Get mesh position at this joint
  const jointMesh = joints[i].mesh;
  const jointMeshWorldPos = jointMesh.getAbsolutePosition();
  const jointMeshWorldRot = jointMesh.absoluteRotationQuaternion;

  console.log(`FK Position:   X=${fkPoseUpToJoint.position.x.toFixed(4)}, Y=${fkPoseUpToJoint.position.y.toFixed(4)}, Z=${fkPoseUpToJoint.position.z.toFixed(4)}`);
  console.log(`Mesh Position: X=${jointMeshWorldPos.x.toFixed(4)}, Y=${jointMeshWorldPos.y.toFixed(4)}, Z=${jointMeshWorldPos.z.toFixed(4)}`);

  const diff = BABYLON.Vector3.Distance(fkPoseUpToJoint.position, jointMeshWorldPos);
  console.log(`Divergence: ${(diff * 1000).toFixed(2)}mm ${diff < 0.01 ? '✅' : '❌'}`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════');
```

---

## Possible Causes

### 1. Mesh Hierarchy Issue
The mesh parent-child relationships might not exactly match the kinematic chain. This would cause divergence that grows with more joints.

### 2. URDF Parameter Issues
Some joint origins or axes might be incorrect in the URDF, especially for joints J2-J5.

### 3. FK solveUpToJoint() Bug
The `solveUpToJoint()` method might have a bug that we didn't catch during the initial fix.

### 4. Base Transform Issue
The base world matrix might not be correctly applied in complex configurations.

---

## Next Steps

1. **Run the diagnostic script** - This will show us which joint starts showing divergence
2. **Check IK solver** - Figure out why `ikSolver.solve` is not a function
3. **Investigate the failing joint** - Once we know which joint has issues, we can fix it

