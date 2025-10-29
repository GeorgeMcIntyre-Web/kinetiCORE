# Forward Kinematics Rotation Verification Test

Run this test to verify that FK rotation matches the mesh rotation exactly.

## Test Script

Copy and paste this into the browser console:

```javascript
console.clear();

// Get the kinematic chain
const chains = kinematicsManager.getAllChains();
const chain = chains[0];
const joints = kinematicsManager.getActuatedJoints(chain.id);

// Get FK and mesh poses
const jointAngles = joints.map(j => j.position);
const fkPose = fkSolver.solve(chain.name, jointAngles);
const meshPose = fkSolver.getNullTCPPose(chain.name);

// Calculate position divergence (we already know this is 0.00mm)
const positionDiff = BABYLON.Vector3.Distance(meshPose.position, fkPose.position);

// Calculate rotation divergence
// Method 1: Quaternion dot product (measures angular similarity)
const fkQuat = fkPose.rotation;
const meshQuat = meshPose.rotation;

// Normalize quaternions
const fkNorm = fkQuat.normalize();
const meshNorm = meshQuat.normalize();

// Dot product (should be 1.0 for identical rotations, -1.0 for opposite, 0 for perpendicular)
const dotProduct = Math.abs(
  fkNorm.x * meshNorm.x +
  fkNorm.y * meshNorm.y +
  fkNorm.z * meshNorm.z +
  fkNorm.w * meshNorm.w
);

// Method 2: Calculate angle difference
// For quaternions q1 and q2, angle difference = 2 * arccos(|q1 · q2|)
const angleDiffRadians = 2 * Math.acos(Math.min(1.0, dotProduct));
const angleDiffDegrees = angleDiffRadians * (180 / Math.PI);

// Method 3: Convert to Euler angles and compare
const fkEuler = fkQuat.toEulerAngles();
const meshEuler = meshQuat.toEulerAngles();

const eulerDiffX = Math.abs(fkEuler.x - meshEuler.x) * (180 / Math.PI);
const eulerDiffY = Math.abs(fkEuler.y - meshEuler.y) * (180 / Math.PI);
const eulerDiffZ = Math.abs(fkEuler.z - meshEuler.z) * (180 / Math.PI);

// Print results
console.log('=== FK ROTATION VERIFICATION ===');
console.log('');
console.log('Joint Angles:', jointAngles.map(a => `${(a * 180 / Math.PI).toFixed(2)}°`).join(', '));
console.log('');
console.log('--- POSITION DIVERGENCE ---');
console.log(`Position divergence: ${(positionDiff * 1000).toFixed(2)}mm`);
console.log('');
console.log('--- ROTATION DIVERGENCE ---');
console.log(`Quaternion dot product: ${dotProduct.toFixed(6)} (1.0 = perfect match)`);
console.log(`Angular difference: ${angleDiffDegrees.toFixed(4)}° (0° = perfect match)`);
console.log('');
console.log('--- EULER ANGLE COMPARISON ---');
console.log('FK Euler (deg):',
  `X=${(fkEuler.x * 180 / Math.PI).toFixed(2)}°`,
  `Y=${(fkEuler.y * 180 / Math.PI).toFixed(2)}°`,
  `Z=${(fkEuler.z * 180 / Math.PI).toFixed(2)}°`
);
console.log('Mesh Euler (deg):',
  `X=${(meshEuler.x * 180 / Math.PI).toFixed(2)}°`,
  `Y=${(meshEuler.y * 180 / Math.PI).toFixed(2)}°`,
  `Z=${(meshEuler.z * 180 / Math.PI).toFixed(2)}°`
);
console.log('Euler differences:',
  `ΔX=${eulerDiffX.toFixed(4)}°`,
  `ΔY=${eulerDiffY.toFixed(4)}°`,
  `ΔZ=${eulerDiffZ.toFixed(4)}°`
);
console.log('');
console.log('--- QUATERNION RAW VALUES ---');
console.log('FK Quaternion:',
  `x=${fkQuat.x.toFixed(6)}`,
  `y=${fkQuat.y.toFixed(6)}`,
  `z=${fkQuat.z.toFixed(6)}`,
  `w=${fkQuat.w.toFixed(6)}`
);
console.log('Mesh Quaternion:',
  `x=${meshQuat.x.toFixed(6)}`,
  `y=${meshQuat.y.toFixed(6)}`,
  `z=${meshQuat.z.toFixed(6)}`,
  `w=${meshQuat.w.toFixed(6)}`
);
console.log('');

// Final verdict
if (positionDiff < 0.001 && angleDiffDegrees < 0.01) {
  console.log('✅ RESULT: PERFECT MATCH! Position and rotation are identical.');
} else if (positionDiff < 0.001 && angleDiffDegrees < 0.1) {
  console.log('✅ RESULT: EXCELLENT! Position perfect, rotation within 0.1°.');
} else if (positionDiff < 0.001 && angleDiffDegrees < 1.0) {
  console.log('⚠️ RESULT: GOOD. Position perfect, rotation within 1°.');
} else {
  console.log('❌ RESULT: DIVERGENCE DETECTED!');
  if (positionDiff >= 0.001) {
    console.log(`   Position divergence: ${(positionDiff * 1000).toFixed(2)}mm`);
  }
  if (angleDiffDegrees >= 1.0) {
    console.log(`   Rotation divergence: ${angleDiffDegrees.toFixed(4)}°`);
  }
}
```

## Expected Output

If rotation is working correctly, you should see:

```
=== FK ROTATION VERIFICATION ===

Joint Angles: 0.00°, 0.00°, 0.00°, 0.00°, 0.00°, 0.00°

--- POSITION DIVERGENCE ---
Position divergence: 0.00mm

--- ROTATION DIVERGENCE ---
Quaternion dot product: 1.000000 (1.0 = perfect match)
Angular difference: 0.0000° (0° = perfect match)

--- EULER ANGLE COMPARISON ---
FK Euler (deg): X=0.00° Y=0.00° Z=0.00°
Mesh Euler (deg): X=0.00° Y=0.00° Z=0.00°
Euler differences: ΔX=0.0000° ΔY=0.0000° ΔZ=0.0000°

--- QUATERNION RAW VALUES ---
FK Quaternion: x=0.000000 y=0.000000 z=0.000000 w=1.000000
Mesh Quaternion: x=0.000000 y=0.000000 z=0.000000 w=1.000000

✅ RESULT: PERFECT MATCH! Position and rotation are identical.
```

## Test Multiple Configurations

Run the test with different joint angles:

```javascript
// Test 1: Home position
// (Already tested above - should be perfect)

// Test 2: J0 = 45°
joints[0].position = 45 * Math.PI / 180;
// ... run test script ...

// Test 3: J0 = 45°, J1 = 30°
joints[0].position = 45 * Math.PI / 180;
joints[1].position = 30 * Math.PI / 180;
// ... run test script ...

// Test 4: All joints at various angles
joints[0].position = 45 * Math.PI / 180;
joints[1].position = -30 * Math.PI / 180;
joints[2].position = 60 * Math.PI / 180;
joints[3].position = -45 * Math.PI / 180;
joints[4].position = 90 * Math.PI / 180;
joints[5].position = 0 * Math.PI / 180;
// ... run test script ...
```

## Understanding the Metrics

### Quaternion Dot Product
- **1.0** = Perfect match (quaternions identical or opposite sign)
- **0.9-0.99** = Very close (< 20° difference)
- **< 0.9** = Significant divergence

### Angular Difference
- **< 0.01°** = Perfect match (within numerical precision)
- **< 0.1°** = Excellent (acceptable for most applications)
- **< 1.0°** = Good (may be acceptable depending on use case)
- **> 1.0°** = Problem! Rotation divergence detected

### Euler Angle Differences
- Shows per-axis rotation differences
- Useful for debugging which rotation axis has issues
- **Note:** Euler angles can be ambiguous (gimbal lock), so quaternion comparison is more reliable

## Why Rotation Might Be Working

The fix we implemented uses **`Quaternion.multiply()`** for rotation accumulation, which is mathematically correct for composing rotations:

```typescript
// Accumulate rotation (parent * local)
accumulatedRotation = accumulatedRotation.multiply(localRotation);
```

Unlike matrix multiplication for positions (which was broken), **quaternion multiplication correctly composes rotations**. This is because:

1. Quaternions are designed specifically for representing rotations
2. `Quaternion.multiply()` implements the correct mathematical operation for composing rotations
3. Babylon's scene graph ALSO uses quaternion multiplication for rotations internally

So rotation should be working correctly! But let's verify with the test above.

## Potential Issues to Watch For

If rotation divergence IS detected, it could be caused by:

1. **Origin rotation not applied correctly** - Check lines 606-612 in ForwardKinematicsSolver.ts
2. **Joint rotation axis incorrect** - Check that `joint.axis` is correct in URDF
3. **Rotation order issues** - Check that we multiply `originRotation * jointRotation` (lines 617-618)
4. **Mesh parent transforms** - Check that mesh hierarchy matches kinematic chain

## Next Steps

1. Run the test script above
2. Report the results
3. If rotation is perfect (< 0.01°), we can confirm the entire FK solver is working correctly!
4. If rotation has divergence, we'll need to investigate further

---

**Created:** 2025-10-29
**Purpose:** Verify FK rotation accuracy to complement position accuracy verification
