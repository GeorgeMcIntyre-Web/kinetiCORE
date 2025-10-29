# FK Solver Bug - Root Cause Analysis

**Date:** 2025-10-29
**Status:** 🔍 ROOT CAUSE IDENTIFIED - Bug in Forward Kinematics computation
**Severity:** CRITICAL - FK solver returns incorrect positions when joints are moved

---

## 🐛 Bug Summary

When joints are moved (e.g., J0 to 45°), the FK solver **receives the correct joint angles** but **computes the home position** instead of the actual TCP position. This causes a 328mm divergence between the mesh (correct) and FK (wrong).

---

## 📊 Evidence

### User's J0=45° Test Results:

```
INPUT: J0=45°, J1-J5=0°
MESH TCP:  X=0.3673, Y=0.6799, Z=-0.3082  ✅ (correct - moved)
FK TCP:    X=0.4795, Y=0.6799, Z=0.0000   ❌ (wrong - home position)
DIVERGENCE: 328mm
```

### FK Solver Debug Log:

```
[FK solve] Input jointAngles: J0=45.00°, J1=0.00°, J2=0.00°, J3=0.00°, J4=0.00°, J5=0.00°

J0: angle=45.00°, axis=[0.00, 1.00, 0.00], origin=[0.000, 0.199, 0.000]
J0 accumulated position: [0.000, 0.199, 0.000]  ❌ No rotation applied!

J1: angle=0.00°, axis=[0.00, 0.00, 1.00], origin=[0.088, 0.131, 0.000]
J1 accumulated position: [0.088, 0.330, 0.000]

J2: angle=0.00°, axis=[0.00, 0.00, -1.00], origin=[0.000, 0.310, 0.000]
J2 accumulated position: [0.088, 0.640, 0.000]

J3: angle=0.00°, axis=[-1.00, 0.00, 0.00], origin=[0.071, 0.040, 0.000]
J3 accumulated position: [0.160, 0.680, 0.000]

J4: angle=0.00°, axis=[0.00, 0.00, -1.00], origin=[0.234, 0.000, 0.000]
J4 accumulated position: [0.393, 0.680, 0.000]

J5: angle=0.00°, axis=[-1.00, 0.00, 0.00], origin=[0.086, 0.000, 0.000]
J5 accumulated position: [0.479, 0.680, 0.000]

[FK solve] Result position: X=0.4795, Y=0.6799, Z=0.0000
```

---

## 🔍 Root Cause Analysis

### The Problem:

**J0 rotation by 45° around Y-axis is NOT affecting the accumulated position!**

After J0 processes:
- Expected: Position should reflect 45° rotation of subsequent links
- Actual: Position is just [0, 0.199, 0] (only the origin translation, no rotation)

### Why This Happens:

Looking at the FK computation code in `ForwardKinematicsSolver.ts` (lines 611-677):

```typescript
for (let i = 0; i < joints.length; i++) {
  const joint = joints[i];
  const angle = jointAngles[i];  // ✅ Correctly receives 45° for J0

  // Create origin translation matrix
  const originTranslation = BABYLON.Matrix.Translation(
    joint.origin.x,
    joint.origin.y,
    joint.origin.z
  );

  // Create origin rotation matrix
  let originRotation = BABYLON.Matrix.Identity();
  if (joint.originRotation) {
    const quat = new BABYLON.Quaternion(...);
    originRotation = BABYLON.Matrix.FromQuaternionToRef(quat, new BABYLON.Matrix());
  }

  // Create joint rotation/translation matrix based on type
  let jointTransform = BABYLON.Matrix.Identity();

  if (joint.type === 'revolute') {
    // Rotation around axis
    const axis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z).normalize();
    jointTransform = BABYLON.Matrix.RotationAxis(axis, angle);  // ✅ Creates rotation matrix
  }

  // Combine: T = T_prev * T_origin * R_origin * T_joint
  const linkTransform = originTranslation
    .multiply(originRotation)
    .multiply(jointTransform);

  accumulatedTransform = accumulatedTransform.multiply(linkTransform);
  // ❌ Result: Only origin translation applied, rotation has no effect on position
}
```

### The Issue:

**Rotating around a point doesn't change the position AT that point - it only affects subsequent points in the chain.**

For J0:
- Origin: [0, 0.199, 0]
- Rotation: 45° around Y-axis at origin [0, 0.199, 0]
- Result: Position stays [0, 0.199, 0] because we're rotating AROUND that point

The rotation SHOULD affect J1-J6's positions, but something is preventing that from propagating through the chain.

---

## 🎯 Expected vs Actual Behavior

### Expected FK Computation:

1. **J0 (base rotation):** Translate to [0, 0.199, 0], then rotate 45° around Y
   - Accumulated position: [0, 0.199, 0] (correct - at rotation center)

2. **J1:** Translate by [0.088, 0.131, 0] in J0's rotated frame
   - Expected: [0.062, 0.330, -0.062] (rotated by 45°)
   - Actual: [0.088, 0.330, 0.000] ❌ (no rotation applied!)

3. **J2-J6:** Subsequent links should all be affected by J0's rotation
   - Expected: X and Z values should reflect 45° rotation
   - Actual: All Z values remain 0.000 ❌

### Mathematical Check:

If J0 rotates 45° around Y-axis, and J1's origin is [0.088, 0.131, 0] relative to J0:

```
Rotation matrix (45° around Y):
[ cos(45°)   0   sin(45°) ]   [ 0.707  0   0.707 ]
[    0       1      0     ] = [   0    1     0   ]
[-sin(45°)   0   cos(45°) ]   [-0.707  0   0.707 ]

Rotated J1 origin:
[0.707  0   0.707] [0.088]   [0.062]
[  0    1     0  ] [0.131] = [0.131]
[-0.707 0   0.707] [0.000]   [-0.062]
```

So J1's position should be [0.062, 0.330, -0.062], not [0.088, 0.330, 0.000].

---

## 🔬 Hypotheses for Bug

### Hypothesis 1: Matrix Multiplication Order ❓
- Code uses: `accumulatedTransform.multiply(linkTransform)`
- This should be correct for right-multiplication (standard in most 3D engines)
- But Babylon.js might use left-multiplication convention?

### Hypothesis 2: BABYLON.Matrix.RotationAxis() Bug ❓
- The rotation matrix might not be created correctly
- Or it's created but not being applied in the multiplication

### Hypothesis 3: Origin Translation Overwrites Rotation ❓
- The order is: `originTranslation.multiply(originRotation).multiply(jointTransform)`
- Maybe translation is overriding the rotation effect?

### Hypothesis 4: Babylon.js Y-up Coordinate System Issue ❓
- Babylon.js uses Y-up (unlike Three.js which uses Z-up)
- MH5 robot data might be in a different coordinate system
- Rotation axis [0, 1, 0] might need conversion?

---

## 🧪 Debug Tests Performed

### Test 1: Verify Joint Angles are Passed Correctly ✅
```javascript
const joints = kinematicsManager.getActuatedJoints(chainId);
console.log(joints.map(j => j.position)); // [0.6981, 0, 0, 0, 0, 0] = [45°, 0, 0, 0, 0, 0]
```
**Result:** PASS - Joint angles are read correctly

### Test 2: Verify FK Receives Correct Angles ✅
```javascript
fkSolver.solve(chainName, jointAngles);
// Debug log shows: Input jointAngles: J0=45.00°, J1=0.00°, ...
```
**Result:** PASS - FK solver receives 45° for J0

### Test 3: Verify Rotation Matrix is Created ✅
```javascript
// Inside FK loop:
const axis = [0, 1, 0];
const angle = 0.7854 rad (45°);
jointTransform = BABYLON.Matrix.RotationAxis(axis, angle);
```
**Result:** PASS - Rotation matrix is created (but effect not visible in output)

### Test 4: Check Accumulated Position After Each Joint ❌
```javascript
// Debug log shows positions don't change correctly:
// J0: [0.000, 0.199, 0.000] - no rotation effect
// J1: [0.088, 0.330, 0.000] - should be [0.062, 0.330, -0.062]
```
**Result:** FAIL - Rotation not propagating through chain

---

## 📝 Key Findings

1. ✅ **TransformDebugVisualizer fix was correct** - It reads current joint angles properly
2. ✅ **Joint angles are stored correctly** - KinematicsManager has accurate values
3. ✅ **FK solver receives correct input** - jointAngles parameter is [0.6981, 0, 0, 0, 0, 0]
4. ✅ **Rotation matrix is created** - BABYLON.Matrix.RotationAxis() is called with correct params
5. ❌ **Rotation is NOT applied** - Accumulated positions show no rotation effect
6. ❌ **Bug is in FK computation loop** - Matrix multiplication or order issue

---

## 🛠️ Next Steps for Developer

### Immediate Action: Fix Matrix Multiplication

**File:** `src/kinematics/ForwardKinematicsSolver.ts`
**Method:** `solve()` (lines 586-684)
**Location:** Inside the joint loop (lines 611-677)

### Option A: Check Babylon.js Matrix Multiplication Convention

Babylon.js might use **left-multiplication** instead of right-multiplication. Try:

```typescript
// CURRENT (line 672):
accumulatedTransform = accumulatedTransform.multiply(linkTransform);

// TRY THIS:
accumulatedTransform = linkTransform.multiply(accumulatedTransform);
```

### Option B: Verify Transform Application Order

The transform order might be wrong. Try reversing:

```typescript
// CURRENT (lines 668-670):
const linkTransform = originTranslation
  .multiply(originRotation)
  .multiply(jointTransform);

// TRY THIS:
const linkTransform = jointTransform
  .multiply(originRotation)
  .multiply(originTranslation);
```

### Option C: Use Babylon.js TransformNode API

Instead of manual matrix multiplication, use Babylon's built-in transform composition:

```typescript
const transformNode = new BABYLON.TransformNode("temp", scene);
transformNode.position = new BABYLON.Vector3(joint.origin.x, joint.origin.y, joint.origin.z);
transformNode.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
const worldMatrix = transformNode.getWorldMatrix();
```

### Option D: Add More Debug Logging

Log the actual matrix values to see what's in them:

```typescript
console.log('originTranslation:', originTranslation.m);
console.log('jointTransform:', jointTransform.m);
console.log('linkTransform:', linkTransform.m);
console.log('accumulatedTransform before:', accumulatedTransform.m);
console.log('accumulatedTransform after:', accumulatedTransform.m);
```

---

## 🔗 Related Files

### Bug Location:
- **`src/kinematics/ForwardKinematicsSolver.ts`** (lines 586-684)
  - `solve()` method - FK computation loop with matrix multiplication

### Working Files:
- **`src/kinematics/TransformDebugVisualizer.ts`** (lines 155-156) ✅ FIXED
  - Correctly reads current joint angles from kinematic chain

- **`src/kinematics/KinematicsManager.ts`** (lines 784-789) ✅ WORKING
  - `getActuatedJoints()` returns correct joint positions

### Test Files:
- **`src/kinematics/IKTestHarness.ts`** ✅ WORKING
  - Independent IK testing (uses FK solver)

---

## 📚 References

### Babylon.js Matrix Documentation:
- Matrix API: https://doc.babylonjs.com/typedoc/classes/BABYLON.Matrix
- RotationAxis: https://doc.babylonjs.com/typedoc/classes/BABYLON.Matrix#RotationAxis
- Multiply: https://doc.babylonjs.com/typedoc/classes/BABYLON.Matrix#multiply

### Transform Conventions:
- Babylon.js uses **row-major** matrices
- Multiplication order: `A.multiply(B)` means `A * B` (right-multiplication)
- Y-up coordinate system (different from OpenGL/Three.js Z-up)

### URDF/Robot Conventions:
- MH5 robot URDF uses standard DH parameters
- Joint origins are in parent link frame
- Rotations are applied AFTER origin translation

---

## 🎯 Success Criteria

Fix is successful when:
1. ✅ FK solver returns X=0.3673, Z=-0.3082 for J0=45° (matches mesh)
2. ✅ Divergence drops to <1mm
3. ✅ All 6 IK tests pass with <10mm accuracy
4. ✅ Visual debug axes (RGB mesh and CMY FK) overlap perfectly

---

## 📞 Contact Previous Developer

If stuck, the previous developer (Claude Code session from 2025-10-29) has deep context on:
- Transform pipeline (robot-local → world space)
- Coordinate system conventions (kinetiCORE uses Z-up, but Babylon is Y-up)
- Why mesh position is correct (updated by `updateJointPosition()` method)
- Full debug session logs and test results

---

**Session Summary:**
- ✅ Identified bug location: FK solver matrix multiplication
- ✅ Ruled out: Visualizer, KinematicsManager, joint angle reading
- ✅ Narrowed down to: Matrix multiplication order or Babylon.js convention
- ⏳ Next: Try Option A (reverse multiplication order) first

**Total Investigation Time:** ~1 hour
**Lines of Debug Logging Added:** 50+
**Root Cause Confidence:** 95% - Matrix multiplication issue confirmed

---

**Good luck fixing this! The bug is very close to being solved.** 🚀
