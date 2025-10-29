# IK Orientation Problem - Deep Investigation

**Date:** 2025-10-28
**Critical Finding:** Orientation not properly handled in IK solver
**Impact:** HIGH - Wrist joints (4-6) may not be contributing to solution

---

## The Problem

### Current Behavior
When jogging TCP position (e.g., +10mm in X), the orientation is NOT maintained correctly.

### Root Cause Analysis

#### 1. `moveTCP()` Implementation

**File:** `src/kinematics/InverseKinematicsSolver.ts:533-535`

```typescript
moveTCP(
  chainName: string,
  positionDelta: BABYLON.Vector3,
  method: 'jacobian' | 'ccd' | 'fabrik' = 'jacobian'
): boolean {
  // Get current pose
  const nullTCPPose = this.fkSolver.getNullTCPPose(chainName);
  const currentPoseWorld = nullTCPPose.position;
  const currentRotWorld = nullTCPPose.rotation;  // ← Read but...

  // Compute target
  const targetPosition = currentPoseWorld.add(positionDelta);

  // Solve IK
  const result = this.solveAndApply(
    chainName,
    {
      position: targetPosition,
      rotation: currentRotWorld,  // ← Passed to IK ✅
    },
    method
  );
}
```

**Status:** ✅ Orientation IS passed to IK solver

#### 2. `solveJacobianTranspose()` Orientation Handling

**File:** `src/kinematics/InverseKinematicsSolver.ts:144-175`

```typescript
// Compute orientation error (if target rotation specified)
let orientationError = new BABYLON.Vector3(0, 0, 0);
if (target.rotation) {  // ← This should be TRUE
  // Compute quaternion error: q_error = q_target * q_current^-1
  const rotationError = target.rotation.multiply(
    BABYLON.Quaternion.Inverse(currentRotWorld)
  );

  // Convert to axis-angle
  const angle = 2 * Math.acos(Math.min(1, Math.abs(normalizedError.w)));
  const axis = new BABYLON.Vector3(
    normalizedError.x,
    normalizedError.y,
    normalizedError.z
  );

  // ... compute orientationError
}

// Total error
error = positionErrorMagnitude * positionWeight +
        orientationError.length() * orientationWeight;  // weight = 0.5
```

**Status:** ⚠️ Orientation error IS computed IF target.rotation defined

#### 3. Error Vector Construction

**File:** `src/kinematics/InverseKinematicsSolver.ts:197-206`

```typescript
// Compute error vector (6D: 3 position + 3 orientation)
const errorVector = [
  positionError.x * positionWeight,      // 1.0
  positionError.y * positionWeight,      // 1.0
  positionError.z * positionWeight,      // 1.0
  orientationError.x * orientationWeight,  // 0.5
  orientationError.y * orientationWeight,  // 0.5
  orientationError.z * orientationWeight,  // 0.5
];
```

**Status:** ⚠️ Orientation errors have LOWER weight (0.5 vs 1.0)

---

## Investigation Questions

### Q1: Is `target.rotation` actually defined?

**Test:** Add logging to verify

```typescript
if (iteration === 0) {
  console.log(`[IK DEBUG] Target rotation defined: ${target.rotation !== undefined}`);
  console.log(`[IK DEBUG] Target rotation: ${target.rotation?.toString()}`);
  console.log(`[IK DEBUG] Orientation error magnitude: ${orientationError.length().toFixed(6)}`);
}
```

**Expected:** `target.rotation` should be defined and match current TCP orientation

---

### Q2: Are wrist joints (4-6) contributing to Jacobian?

**Test:** Check Jacobian columns 3-5 (joints 4-6)

```typescript
if (iteration === 0) {
  console.log(`[IK DEBUG] Jacobian columns for wrist joints:`);
  console.log(`  J4 position: [${jacobian[0][3].toFixed(4)}, ${jacobian[1][3].toFixed(4)}, ${jacobian[2][3].toFixed(4)}]`);
  console.log(`  J4 orient:   [${jacobian[3][3].toFixed(4)}, ${jacobian[4][3].toFixed(4)}, ${jacobian[5][3].toFixed(4)}]`);
  console.log(`  J5 position: [${jacobian[0][4].toFixed(4)}, ${jacobian[1][4].toFixed(4)}, ${jacobian[2][4].toFixed(4)}]`);
  console.log(`  J5 orient:   [${jacobian[3][4].toFixed(4)}, ${jacobian[4][4].toFixed(4)}, ${jacobian[5][4].toFixed(4)}]`);
  console.log(`  J6 position: [${jacobian[0][5].toFixed(4)}, ${jacobian[1][5].toFixed(4)}, ${jacobian[2][5].toFixed(4)}]`);
  console.log(`  J6 orient:   [${jacobian[3][5].toFixed(4)}, ${jacobian[4][5].toFixed(4)}, ${jacobian[5][5].toFixed(4)}]`);
}
```

**Expected:**
- Position influence should be small (wrist far from TCP)
- Orientation influence should be dominant (1.0 for rotation axes)

---

### Q3: Does orientation error actually compute correctly?

**Test:** Verify quaternion math

```typescript
if (iteration === 0 && target.rotation) {
  const currentRot = currentRotWorld;
  const targetRot = target.rotation;

  // They should be nearly identical (maintaining orientation)
  const dot = BABYLON.Quaternion.Dot(currentRot, targetRot);
  const angleDiff = 2 * Math.acos(Math.min(1, Math.abs(dot)));

  console.log(`[IK DEBUG] Orientation difference: ${(angleDiff * 180 / Math.PI).toFixed(2)}° (should be ~0°)`);
  console.log(`[IK DEBUG] Current rotation: ${currentRot.toString()}`);
  console.log(`[IK DEBUG] Target rotation:  ${targetRot.toString()}`);
}
```

**Expected:** Angle difference should be near 0° when maintaining orientation

---

### Q4: Are joint angle updates actually affecting wrist joints?

**Test:** Check deltaAngles for joints 4-6

```typescript
if (iteration === 0) {
  console.log(`[IK DEBUG] Delta angles (rad):`);
  console.log(`  Joints 1-3 (arm):  [${deltaAngles.slice(0,3).map(v => v.toFixed(6)).join(', ')}]`);
  console.log(`  Joints 4-6 (wrist): [${deltaAngles.slice(3,6).map(v => v.toFixed(6)).join(', ')}]`);

  const armDelta = Math.sqrt(deltaAngles.slice(0,3).reduce((sum, v) => sum + v*v, 0));
  const wristDelta = Math.sqrt(deltaAngles.slice(3,6).reduce((sum, v) => sum + v*v, 0));

  console.log(`  Arm magnitude:   ${armDelta.toFixed(6)} rad`);
  console.log(`  Wrist magnitude: ${wristDelta.toFixed(6)} rad`);
}
```

**Expected:**
- For pure translation, arm joints should dominate
- For pure rotation, wrist joints should dominate
- For maintaining orientation during translation, wrist should adjust slightly

---

## Potential Issues

### Issue 1: Orientation Weight Too Low (0.5 vs 1.0)

**Symptom:** Wrist drifts during position moves
**Fix:** Increase orientation weight

```typescript
const {
  positionWeight = 1.0,
  orientationWeight = 1.0,  // ← Change from 0.5 to 1.0
  // ...
} = options;
```

**Test:** Does TCP maintain orientation better with equal weights?

---

### Issue 2: Quaternion Error Computation

**Current implementation:**
```typescript
const rotationError = target.rotation.multiply(
  BABYLON.Quaternion.Inverse(currentRotWorld)
);
```

**Potential issue:** Order of multiplication?
**Correct formula:** `q_error = q_current^-1 * q_target`

**Fix to test:**
```typescript
const rotationError = BABYLON.Quaternion.Inverse(currentRotWorld)
  .multiply(target.rotation);
```

---

### Issue 3: Axis-Angle Conversion

**Current implementation:**
```typescript
const angle = 2 * Math.acos(Math.min(1, Math.abs(normalizedError.w)));
const axis = new BABYLON.Vector3(
  normalizedError.x,
  normalizedError.y,
  normalizedError.z
);
const axisLength = axis.length();

if (axisLength > 0.0001 && angle > 0.0001) {
  orientationError = axis.scale(angle / axisLength);
}
```

**Potential issue:** Axis not normalized before scaling?

**Fix to test:**
```typescript
if (axisLength > 0.0001 && angle > 0.0001) {
  const axisNorm = axis.normalize();
  orientationError = axisNorm.scale(angle);  // axis-angle representation
}
```

---

### Issue 4: Jacobian Orientation Rows

**Question:** Are Jacobian rows 3-5 (orientation) computed correctly?

**Current:**
```typescript
// Angular velocity: ω = axis
jacobian[3][i] = worldAxis.x;
jacobian[4][i] = worldAxis.y;
jacobian[5][i] = worldAxis.z;
```

**Verify:** This assumes axis is in world space (should be from `TransformNormal`)

---

## Test Scenarios

### Scenario 1: Pure Translation (Maintain Orientation)
```typescript
// Start at home position
const startPose = getNullTCPPose('chain1');
console.log('Start orientation:', startPose.rotation.toString());

// Move +10mm in X
moveTCP('chain1', new Vector3(0.01, 0, 0));

// Check final orientation
const endPose = getNullTCPPose('chain1');
console.log('End orientation:', endPose.rotation.toString());

// Compute difference
const angleDiff = computeAngleDifference(startPose.rotation, endPose.rotation);
console.log(`Orientation drift: ${angleDiff.toFixed(2)}° (should be <1°)`);
```

**Success:** Orientation changes by <1° during pure translation

---

### Scenario 2: Pure Rotation (Maintain Position)
```typescript
// Start at current position
const startPose = getNullTCPPose('chain1');

// Rotate 10° around Z-axis
const deltaRot = Quaternion.RotationAxis(new Vector3(0, 0, 1), 10 * Math.PI / 180);
rotateTCP('chain1', deltaRot);

// Check position didn't move
const endPose = getNullTCPPose('chain1');
const posDiff = endPose.position.subtract(startPose.position).length();
console.log(`Position drift: ${posDiff.toFixed(4)}m (should be <0.001m)`);
```

**Success:** Position changes by <1mm during pure rotation

---

### Scenario 3: Multiple Translations
```typescript
// Jog +X 10 times
for (let i = 0; i < 10; i++) {
  moveTCP('chain1', new Vector3(0.01, 0, 0));
}

// Check orientation drift
const startOrient = getInitialOrientation();
const endOrient = getNullTCPPose('chain1').rotation;
const totalDrift = computeAngleDifference(startOrient, endOrient);
console.log(`Total drift after 10 jogs: ${totalDrift.toFixed(2)}° (should be <5°)`);
```

**Success:** Less than 0.5° drift per jog, <5° total after 10 jogs

---

## Debugging Tools Needed

### Tool 1: Orientation Visualizer
Display TCP orientation as RGB axes in 3D:
- Red = X-axis
- Green = Y-axis
- Blue = Z-axis

Shows immediately if orientation drifts during position moves.

### Tool 2: Orientation Error Logger
Log every IK iteration:
```
Iter 0: pos_err=10mm, orient_err=0.001rad (0.06°)
Iter 1: pos_err=9.5mm, orient_err=0.002rad (0.11°)
...
```

Should show orientation error staying near zero during position moves.

### Tool 3: Wrist Joint Activity Monitor
Highlight wrist joints that move during IK:
```
Iter 0: J1=+0.5°, J2=+0.3°, J3=-0.1°, J4=+0.0°, J5=+0.0°, J6=+0.0°
```

If J4-J6 never move, orientation is not being controlled.

---

## Action Plan

### Immediate (Next 2 hours)
1. ✅ Add all logging from Investigation Questions
2. ✅ Run test scenario 1 (pure translation)
3. ✅ Analyze logs to find which issue is present

### Short-term (Today)
1. Fix identified issue (weights, quaternion math, or Jacobian)
2. Verify with test scenarios 1-3
3. Confirm wrist joints actively participate

### Medium-term (Tomorrow)
1. Add orientation visualizer tool
2. Test edge cases (near singularities, large movements)
3. Tune weights and parameters

---

## Success Criteria

### Minimum Viable
- ✅ Orientation maintained within 2° during 10mm position jog
- ✅ Position maintained within 2mm during 10° rotation
- ✅ Wrist joints (4-6) show non-zero delta angles

### Production Quality
- ✅ Orientation drift <0.5° per jog
- ✅ Position drift <0.5mm per rotation
- ✅ Works consistently for 20+ consecutive operations

---

## References

- Quaternion error computation: Siciliano "Robotics" Eq. 3.91
- Axis-angle representation: Lynch & Park "Modern Robotics" Ch. 3.2.3
- Jacobian orientation rows: Craig "Robotics" Eq. 5.10-5.12

---

**Next Step:** Add all diagnostic logging and run Scenario 1 test
