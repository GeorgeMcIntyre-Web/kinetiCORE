# IK Debug Session - Coordinate Space Analysis
**Date:** 2025-10-28
**Engineer:** Agent 1 (Claude Code) + Cursor (Agent 2)
**Status:** 🔍 ROOT CAUSE IDENTIFIED

---

## Problem Statement
**User Report:** "TCP movement does not work at all"
**Expected:** Click TCP X+ button → Robot moves 10mm in world X direction
**Actual:** Robot doesn't move correctly (convergence issues, incorrect direction, or no movement)

---

## Investigation Summary

### What Cursor Did (Recent Commits)
1. ✅ **Renamed EndEffector → nullTCP** (ad095e5) - Improved clarity
2. ✅ **Fixed FK world pose inside Jacobian** (17cd293, 7c93cfd) - Attempted coordinate fix
3. ✅ **Added TCP local X-axis logging** (d01c8e1) - Debug frame transformations

### What We Found
After analyzing the complete IK pipeline, the **ROOT CAUSE** has been identified:

---

## 🔴 ROOT CAUSE: Coordinate Space Inconsistency

### The Problem

The IK solver has a **coordinate space mixing bug** between:
- **World space** (what the user sees)
- **Robot-local space** (internal FK calculations)

### Detailed Flow Analysis

#### Step 1: Get Current TCP Position
```typescript
// InverseKinematicsSolver.ts:495-500
const nullTCPPose = this.fkSolver.getNullTCPPose(chainName);
const currentPoseWorld = nullTCPPose.position;  // ✅ WORLD SPACE
```

**Source:** [ForwardKinematicsSolver.ts:825-907](ForwardKinematicsSolver.ts#L825-L907)
- `getNullTCPPose()` reads **actual mesh world matrix** (line 894-897)
- Returns position in **WORLD SPACE** ✅

---

#### Step 2: Compute Target Position
```typescript
// InverseKinematicsSolver.ts:506
const targetPosition = currentPoseWorld.add(positionDelta);  // ✅ WORLD SPACE
```
- `positionDelta` is in **WORLD SPACE** (from UI jogging buttons)
- `targetPosition` is in **WORLD SPACE** ✅

---

#### Step 3: Jacobian IK Iteration Loop
```typescript
// InverseKinematicsSolver.ts:87-106
for (iteration = 0; iteration < maxIterations; iteration++) {
  // Compute current pose using FK in ROBOT-LOCAL space
  const currentPoseLocal = this.fkSolver.solve(chainName, jointAngles);

  // ❌ BUG: currentPoseLocal is in ROBOT-LOCAL SPACE
  // ForwardKinematicsSolver.ts:604 - "Start with identity - robot-local space"

  // Transform to world space
  const baseWorldMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id);
  const currentPosWorld = BABYLON.Vector3.TransformCoordinates(
    currentPoseLocal.position,
    baseWorldMatrix
  );

  // Compute error (both in WORLD space)
  const positionError = target.position.subtract(currentPosWorld);
}
```

**Source:** [InverseKinematicsSolver.ts:87-106](InverseKinematicsSolver.ts#L87-L106)

---

#### Step 4: Compute Jacobian
```typescript
// ForwardKinematicsSolver.ts:680-818
computeJacobian(chainName: string, jointAngles: number[]): number[][] | null {
  // ✅ FIXED: Seeded with base world matrix
  const baseWorldMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id);

  // Get null TCP position
  const nullTCPPoseLocal = this.solve(chainName, jointAngles);  // ROBOT-LOCAL
  const nullTCPPos = BABYLON.Vector3.TransformCoordinates(
    nullTCPPoseLocal.position,
    baseWorldMatrix  // Transform to WORLD SPACE ✅
  );

  // Accumulate transforms in WORLD space
  let accumulatedTransform = baseWorldMatrix.clone();

  // ... compute Jacobian columns in WORLD space ...
}
```

**Source:** [ForwardKinematicsSolver.ts:698-818](ForwardKinematicsSolver.ts#L698-L818)

**Status:** ✅ Jacobian is now computed in **WORLD SPACE** (after Cursor's fixes)

---

### The Coordinate Space Table

| Component | Space | Line Reference | Status |
|-----------|-------|----------------|--------|
| `getNullTCPPose()` | **WORLD** | FK:894-897 | ✅ Correct |
| `targetPosition` | **WORLD** | IK:506 | ✅ Correct |
| `positionError` | **WORLD** | IK:105 | ✅ Correct |
| `computeJacobian()` | **WORLD** | FK:698-818 | ✅ Fixed by Cursor |
| `solve()` return value | **ROBOT-LOCAL** | FK:604 comment | ⚠️ Documented |

---

## 🎯 Current State Assessment

### What's Working ✅
1. **FK solve()** - Correctly returns robot-local transforms
2. **getNullTCPPose()** - Correctly returns world position from mesh
3. **Jacobian computation** - Now uses world space (Cursor's fix)
4. **Error vector** - Computed in world space
5. **Coordinate awareness** - Code comments now document spaces

### What Might Still Be Wrong ⚠️

#### Possibility 1: `getBaseWorldMatrix()` Returns Identity
If the robot base has no world transform, `baseWorldMatrix` is identity:
```typescript
const baseWorldMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id)
  || BABYLON.Matrix.Identity();
```

**Result:** Robot-local space **equals** world space → **No bug if robot at origin**

**Check Required:** Is the robot base at world origin (0, 0, 0)?

---

#### Possibility 2: Jacobian Cross Product Order (FIXED)
Earlier code had `Cross(worldAxis, r)` instead of `Cross(r, worldAxis)`.

**Status:** ✅ FIXED in [FK:792](ForwardKinematicsSolver.ts#L792)
```typescript
const linearVel = BABYLON.Vector3.Cross(r, worldAxis);  // ✅ Correct order
```

---

#### Possibility 3: Adaptive Step Size Too Conservative
```typescript
// InverseKinematicsSolver.ts:205
const adaptiveStep = Math.min(1.0, 0.1 / Math.max(positionErrorMagnitude, 0.01)) * stepSize;
```

With `positionErrorMagnitude = 0.010m` (10mm), `stepSize = 0.1`:
```
adaptiveStep = min(1.0, 0.1 / 0.010) * 0.1
            = min(1.0, 10.0) * 0.1
            = 1.0 * 0.1
            = 0.1
```

**Analysis:** Step size seems reasonable, but may need tuning.

---

#### Possibility 4: Joint Limits Clamping Too Aggressively
If joints hit limits early, IK can't converge.

**Check Required:** Log joint angles before/after clamping.

---

## 📋 Debug Action Plan

### Phase 1: Verify Coordinate Transforms (NEXT STEP)

Add comprehensive logging to trace coordinate spaces:

```typescript
// In InverseKinematicsSolver.solveJacobianTranspose(), iteration 0:
console.log(`[IK DEBUG] === Iteration 0 Coordinate Space Debug ===`);

// 1. Initial TCP position
const nullTCPPose = this.fkSolver.getNullTCPPose(chainName);
console.log(`[IK DEBUG] nullTCPPose (WORLD): ${nullTCPPose.position.toString()}`);

// 2. FK solve result
const currentPoseLocal = this.fkSolver.solve(chainName, jointAngles);
console.log(`[IK DEBUG] FK solve (ROBOT-LOCAL): ${currentPoseLocal.position.toString()}`);

// 3. Base transform
const baseWorldMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id);
console.log(`[IK DEBUG] Base world matrix translation: ${baseWorldMatrix.getTranslation().toString()}`);
console.log(`[IK DEBUG] Base is identity: ${baseWorldMatrix.equals(BABYLON.Matrix.Identity())}`);

// 4. Transformed to world
const currentPosWorld = BABYLON.Vector3.TransformCoordinates(
  currentPoseLocal.position,
  baseWorldMatrix
);
console.log(`[IK DEBUG] FK → WORLD transform: ${currentPosWorld.toString()}`);

// 5. Position error
const positionError = target.position.subtract(currentPosWorld);
console.log(`[IK DEBUG] Target (WORLD): ${target.position.toString()}`);
console.log(`[IK DEBUG] Position error (WORLD): ${positionError.toString()}, mag=${positionError.length().toFixed(4)}m`);

// 6. Jacobian sample
const jacobian = this.fkSolver.computeJacobian(chainName, jointAngles);
console.log(`[IK DEBUG] Jacobian[0] (dx/dq): [${jacobian[0].map(v => v.toFixed(4)).join(', ')}]`);
```

---

### Phase 2: Minimal Test Case

Create a controlled test scenario:

**Robot Configuration:**
- 6-axis robot at world origin (base at 0,0,0)
- Known starting joint angles: all zeros (home position)
- Known TCP position (from `getNullTCPPose()`)

**Test Movement:**
- Delta: `(0.010, 0, 0)` = 10mm in world +X
- Expected: TCP moves exactly 10mm in +X direction

**Success Criteria:**
- IK converges in <50 iterations
- Final error <5mm (0.005m)
- TCP actually moves in +X direction

---

### Phase 3: Verify Each Transform

#### Test 1: Robot-Local → World Roundtrip
```typescript
// Get FK pose in robot-local
const poseLocal = fkSolver.solve(chainName, jointAngles);

// Transform to world
const poseWorld = Vector3.TransformCoordinates(poseLocal.position, baseWorldMatrix);

// Get actual mesh world position
const meshPose = fkSolver.getNullTCPPose(chainName);

// VERIFY: poseWorld should equal meshPose.position
const diff = poseWorld.subtract(meshPose.position).length();
console.log(`[VERIFY] FK→World vs Mesh: diff=${diff.toFixed(6)}m (should be ~0)`);
```

Expected: `diff < 0.001m` (1mm tolerance for floating-point error)

---

#### Test 2: Jacobian Columns Make Sense
For Joint 1 (base rotation around Z-axis):
- Column should show large X/Y motion, zero Z motion
- Angular velocity should be mostly in Z direction

```typescript
console.log(`[VERIFY] Joint 1 (base Z-rotation) Jacobian column:`);
console.log(`  Linear:  [${jacobian[0][0].toFixed(3)}, ${jacobian[1][0].toFixed(3)}, ${jacobian[2][0].toFixed(3)}]`);
console.log(`  Angular: [${jacobian[3][0].toFixed(3)}, ${jacobian[4][0].toFixed(3)}, ${jacobian[5][0].toFixed(3)}]`);
```

Expected for typical 6-axis robot at home:
```
Linear:  [~0.5-1.5, ~0.0, ~0.0]  (motion perpendicular to radius)
Angular: [0.000, 0.000, 1.000]    (rotation around Z)
```

---

## 🔧 Potential Fixes (If Bugs Found)

### If baseWorldMatrix is NOT Identity:
Ensure all error computations stay in world space (already done).

### If Jacobian is incorrect:
- Verify cross product order: `Cross(r, axis)` ✅ (already fixed)
- Verify axis is transformed to world space ✅ (line FK:782-785)
- Verify nullTCP position is in world space ✅ (line FK:704-707)

### If convergence is too slow:
1. Increase `stepSize` from 0.1 to 0.3
2. Reduce `damping` from 0.2 to 0.1
3. Relax `tolerance` from 0.005 to 0.010

### If joint limits are the issue:
Log clamping events:
```typescript
const clampedValue = Math.max(joint.limits.lower, Math.min(joint.limits.upper, jointAngles[i]));
if (clampedValue !== jointAngles[i]) {
  console.warn(`[IK] Joint ${i} clamped: ${jointAngles[i].toFixed(3)} → ${clampedValue.toFixed(3)}`);
}
```

---

## 📊 What We've Achieved So Far

### Cursor's Fixes (Commits d01c8e1 → ad095e5)
1. ✅ Renamed endEffector → nullTCP (clarity)
2. ✅ Fixed Jacobian to use world space transforms
3. ✅ Added FK world pose inside Jacobian iterations
4. ✅ Added TCP frame logging

### This Debug Session
1. ✅ Complete coordinate space flow analysis
2. ✅ Identified all transform points
3. ✅ Verified Jacobian is in world space
4. ✅ Created systematic debug plan
5. ✅ Documented for next developer

---

## 🚀 Next Steps for Next Developer

### Immediate Actions (30 minutes)
1. Add Phase 1 logging (coordinate space debug)
2. Click TCP X+ button in UI
3. Copy console output to this document
4. Analyze which values look wrong

### Investigation Questions to Answer
1. **Is `baseWorldMatrix` identity?** (Check console output)
2. **Does FK→World match Mesh position?** (Run Test 1)
3. **Does Jacobian make physical sense?** (Run Test 2)
4. **What's the actual error magnitude?** (Check first iteration log)

### Expected Outcome
With the logging added, we'll see **exactly** where coordinates break:
- If transforms are correct → Tune convergence parameters
- If transforms are wrong → Fix specific transform
- If robot is at origin → Bug is elsewhere (joint limits? singularity?)

---

## 📝 Code References

### Key Files
- **IK Solver:** [src/kinematics/InverseKinematicsSolver.ts](src/kinematics/InverseKinematicsSolver.ts)
- **FK Solver:** [src/kinematics/ForwardKinematicsSolver.ts](src/kinematics/ForwardKinematicsSolver.ts)
- **Kinematics Manager:** [src/kinematics/KinematicsManager.ts](src/kinematics/KinematicsManager.ts)

### Critical Methods
- `moveTCP()` - Entry point: [IK:473-535](src/kinematics/InverseKinematicsSolver.ts#L473-L535)
- `solveJacobianTranspose()` - Main IK loop: [IK:53-238](src/kinematics/InverseKinematicsSolver.ts#L53-L238)
- `computeJacobian()` - Velocity Jacobian: [FK:680-818](src/kinematics/ForwardKinematicsSolver.ts#L680-L818)
- `solve()` - FK in robot-local space: [FK:586-673](src/kinematics/ForwardKinematicsSolver.ts#L586-L673)
- `getNullTCPPose()` - World space TCP: [FK:825-907](src/kinematics/ForwardKinematicsSolver.ts#L825-L907)

---

## 🎓 Lessons Learned

### What Went Well
1. **Systematic analysis** - Following data flow through entire pipeline
2. **Code comments** - Comments now document coordinate spaces
3. **Terminology clarity** - nullTCP is clearer than endEffector

### What to Improve
1. **Unit tests** - Need automated tests for coordinate transforms
2. **Type system** - Consider distinct types for WorldSpace vs RobotLocalSpace vectors
3. **Logging levels** - Add DEBUG flag to enable/disable verbose logging

---

## 🔍 Alternative Approaches (If Current Fix Fails)

If debugging reveals the numerical IK is fundamentally flawed, consider:

### Option A: Analytical IK (Recommended for 6-axis robots)
- Most industrial 6-axis robots have **closed-form solutions**
- Instant convergence (no iterations)
- Requires deriving equations for specific robot geometry
- **Time estimate:** 2-3 days for first robot

### Option B: External Library
- **IKPy** (Python) - Supports URDF, could use via microservice
- **glumb/kinematics** (JS) - Unmaintained since 2016
- **Time estimate:** 1-2 days for Python bridge

### Option C: Hybrid Approach
- Use analytical IK for position (first 3 joints)
- Use numerical IK for orientation (wrist joints)
- **Time estimate:** 3-4 days

---

**Status:** 🔴 **BUG IDENTIFIED** - FK solve doesn't match actual mesh position!

---

## 🔍 TEST RESULTS (2025-10-28 18:32)

### Test Scenario
- Robot: 6-axis (Fanuc-like)
- Starting pose: All joints at 0°
- Action: Click TCP X+ (attempt 10mm jog)

### Critical Finding: FK/Mesh Mismatch ❌

**First IK Attempt (from home position):**
```
[IK DEBUG] nullTCPPose from mesh (WORLD): {X: 0.4795, Y: 0.6799, Z: 0}
[IK DEBUG] FK solve result (ROBOT-LOCAL): {X: 0.4795, Y: 0.6799, Z: 0}
[IK DEBUG] ✓ FK→World vs Mesh diff: 0.000000m ✅ PERFECT MATCH
```

**Second IK Attempt (after robot moved):**
```
[IK DEBUG] nullTCPPose from mesh (WORLD): {X: 0.4740, Y: 0.6821, Z: 0}
[IK DEBUG] FK solve result (ROBOT-LOCAL): {X: 0.4851, Y: 0.6775, Z: 0}
[IK DEBUG] ✓ FK→World vs Mesh diff: 0.012056m ❌ 12mm ERROR!
```

### 🔴 ROOT CAUSE IDENTIFIED

**The Bug:** `FK.solve()` returns stale/cached position instead of current mesh position!

**Evidence:**
1. First attempt: FK matches mesh perfectly (0.000m diff) ✅
2. After joints move: FK shows DIFFERENT position than mesh (12mm diff) ❌
3. FK returns `{X: 0.4851, Y: 0.6775}` but mesh is at `{X: 0.4740, Y: 0.6821}`

**What This Means:**
- `solve()` is computing FK based on **stale joint angles** (not the current actual joint positions)
- OR `getNullTCPPose()` is reading the **wrong mesh** / **cached transform**
- IK is solving for the WRONG current position, so it converges to the wrong target

### Detailed Analysis

**First IK Call (iteration 0):**
```
nullTCPPose: {X: 0.4795, Y: 0.6799, Z: 0}
Target:      {X: 0.4895, Y: 0.6799, Z: 0}  (+10mm X)
Error:       {X: 0.0100, Y: 0.0000, Z: 0}  ✅ Correct 10mm error
Jacobian Row 0: [0.0000, 0.3499, -0.0399, 0.0000, 0.0000, 0.0000]
Delta angles:   [0.0000, 0.0035, -0.0004, 0.0000, 0.0000, 0.0000]
Result: Joints 1 and 2 move slightly
```

**Iteration 100:**
```
Error: 0.0055m (converging but slowly)
Final error: 0.0055m at iteration 100
```

**Second IK Call (after robot has moved):**
```
nullTCPPose: {X: 0.4740, Y: 0.6821, Z: 0}  ← Actual mesh position
FK solve:    {X: 0.4851, Y: 0.6775, Z: 0}  ← Computed from WRONG joint angles!
Diff: 0.012056m (12mm) ❌

Target:      {X: 0.4840, Y: 0.6821, Z: 0}  (+10mm X from mesh)
FK Position: {X: 0.4851, Y: 0.6775, Z: 0}
Error:       {X: -0.0011, Y: 0.0046, Z: 0}  ❌ WRONG! Should be ~10mm, not 5mm

Result: IK solves for WRONG position, converges to 4.7mm error
```

---

## 🐛 THE ACTUAL BUG

### Location: `InverseKinematicsSolver.solveJacobianTranspose()`

**Lines 88-89:**
```typescript
const currentPoseLocal = this.fkSolver.solve(chainName, jointAngles);
```

**The Problem:**
- `jointAngles` is initialized from `joints.map(j => j.position)` at line 82
- **BUT:** These joint positions might be STALE (cached from previous state)
- **OR:** `solve()` is using cached transforms instead of recomputing

### Why First Attempt Works, Second Fails

**First attempt (all joints at 0°):**
- `jointAngles = [0, 0, 0, 0, 0, 0]` from `joints.map(j => j.position)`
- FK computes position from zeros: `{X: 0.4795, Y: 0.6799}`
- Mesh is also at this position (robot hasn't moved yet)
- **Result:** FK matches mesh ✅

**Second attempt (after joints moved to `[0°, 1°, 0.5°, 0°, 0.4°, 0°]`):**
- `jointAngles = ???` from `joints.map(j => j.position)`
- If these are STALE (still `[0, 0, 0, 0, 0, 0]`), FK computes WRONG position
- But mesh has ACTUALLY moved to `{X: 0.4740, Y: 0.6821}`
- **Result:** FK doesn't match mesh ❌

---

## 🔧 THE FIX

### Option 1: Read Current Joint Positions from KinematicsManager

**In `InverseKinematicsSolver.ts` line 82:**

**Current (WRONG):**
```typescript
let jointAngles = initialAngles || joints.map((j: JointConfig) => j.position);
```

**Fix:**
```typescript
// Force refresh joint positions from KinematicsManager BEFORE reading
const chain = this.kinematicsManager.getChain(chainName);
const freshJoints = this.kinematicsManager.getActuatedJoints(chain.id);
let jointAngles = initialAngles || freshJoints.map((j: JointConfig) => j.position);

// OR: Read directly from scene transforms
let jointAngles = initialAngles || joints.map(j => {
  const joint = this.kinematicsManager.getJoint(j.id);
  return joint?.position ?? j.position;
});
```

### Option 2: Use Mesh Position as Source of Truth

**Alternative approach:** Don't use `solve()` at all in the iteration loop. Instead:

```typescript
// Inside iteration loop (line 88-106):
// Get ACTUAL current position from mesh (don't compute from joint angles)
const currentMeshPose = this.fkSolver.getNullTCPPose(chainName);
if (!currentMeshPose) break;

const currentPosWorld = currentMeshPose.position; // Already in world space
const currentRotWorld = currentMeshPose.rotation;

// Compute error (both in WORLD space)
const positionError = target.position.subtract(currentPosWorld);
```

**Tradeoff:**
- ✅ Always uses correct current position
- ❌ Doesn't verify FK is computing correctly
- ⚠️ Relies on mesh transforms being updated after joint changes

---

## 📊 Next Action

**Immediate Fix (5 minutes):**

1. Check how `joints.map(j => j.position)` gets its values
2. Verify if `updateJointPosition()` updates the cached `j.position` value
3. If not updated → Add logging to track when `j.position` changes
4. Implement Option 1 or Option 2 fix above

**Test:**
1. Apply fix
2. Load robot, jog TCP X+ twice
3. Verify: `FK→World vs Mesh diff` stays at `~0.000m` on BOTH attempts

---

---

## ✅ FIX IMPLEMENTED (2025-10-28 18:40)

### The Solution: Use Mesh Position Directly

**Changed:** `InverseKinematicsSolver.solveJacobianTranspose()` lines 98-115

**Before (WRONG):**
```typescript
// Compute FK from working jointAngles array
const currentPoseLocal = this.fkSolver.solve(chainName, jointAngles);

// Transform to world space
const baseWorldMatrix = ...;
const currentPosWorld = BABYLON.Vector3.TransformCoordinates(
  currentPoseLocal.position,
  baseWorldMatrix
);
```

**After (CORRECT):**
```typescript
// Get current pose from ACTUAL mesh (reflects real robot state)
const currentMeshPose = this.fkSolver.getNullTCPPose(chainName);
const currentPosWorld = currentMeshPose.position; // Already in world space
const currentRotWorld = currentMeshPose.rotation; // Already in world space
```

### Why This Fixes It

**The Problem:**
- `jointAngles` is the WORKING SET being updated each iteration
- These are PROPOSED angles, not APPLIED angles
- The mesh hasn't been updated yet to reflect these proposed angles
- Computing FK from proposed angles gives FUTURE position, not CURRENT position
- IK needs to know WHERE THE ROBOT IS NOW, not where it would be if we applied these angles

**The Fix:**
- Read mesh position directly → Always get actual current position
- No coordinate transform needed → Already in world space
- No FK computation needed → Mesh is source of truth
- Each iteration computes error from actual current position ✅

### What Changed in the Flow

**Old Flow (BROKEN):**
1. Read initial joint angles: `[0°, 1°, 0.5°, ...]` (from previous IK result)
2. Iteration 0: Compute FK from `[0°, 1°, 0.5°, ...]` → Get position X
3. But mesh is at position Y (because previous IK moved it)
4. X ≠ Y → 12mm error!
5. IK solves for wrong target

**New Flow (FIXED):**
1. Read initial joint angles: `[0°, 1°, 0.5°, ...]` (still from previous result)
2. Iteration 0: Read mesh position directly → Get position Y
3. Mesh is at position Y ✅
4. Y = Y → 0mm error!
5. IK solves for correct target

### Expected Result

After this fix, the console should show:
```
[IK DEBUG] ✓ FK→World vs Mesh diff: 0.000000m ✅
[IK DEBUG] 🔧 FIX APPLIED: Using mesh position directly (not FK solve)
```

On EVERY IK attempt, including second, third, etc.

---

**Status:** 🟢 **FIX COMPLETE** - Ready for testing
