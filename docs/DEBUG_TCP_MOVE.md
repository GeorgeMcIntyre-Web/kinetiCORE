# Debugging TCP Move (Cartesian Jogging)

**Issue:** TCP Move (Cartesian jogging) not functional
**Status:** Debug logging added, pending user testing
**Date:** 2025-10-26
**Owner:** George McIntyre (Agent 1)

---

## Problem Description

Joint jogging works perfectly, but TCP (Tool Center Point) jogging in Cartesian space (X, Y, Z, RX, RY, RZ) does not move the robot.

**Expected Behavior:**
- User clicks TCP mode jog buttons (+X, -X, +Y, -Y, +Z, -Z, +RX, etc.)
- IK solver computes joint angles to achieve desired end-effector position/orientation
- Robot moves smoothly in Cartesian space

**Actual Behavior:**
- Buttons click but robot doesn't move
- No visible errors in console (previously)
- Joint mode works perfectly

---

## Debug Logging Added

### Files Modified:
1. **[src/kinematics/InverseKinematicsSolver.ts](../src/kinematics/InverseKinematicsSolver.ts)**
   - Added comprehensive logging to `moveEndEffector` method
   - Shows: chain name, method, delta, current/target positions
   - Reports success/failure with detailed error info

2. **[src/ui/components/RobotJoggingPanel.tsx](../src/ui/components/RobotJoggingPanel.tsx)**
   - Added logging to `handleJogTcp` method
   - Shows: axis, direction, robot ID, available chains
   - Reports IK solver success/failure

### Log Output Examples:

**Successful TCP Jog:**
```
[RobotJoggingPanel] TCP Jog: X +
[RobotJoggingPanel] Robot ID: collection_xxx
[RobotJoggingPanel] Available chains: [{name: "robot_chain", id: "...", joints: 6}]
[RobotJoggingPanel] Using chain: robot_chain (6 joints)
[RobotJoggingPanel] Position delta (Babylon space): Vector3(0.01, 0, 0)
[RobotJoggingPanel] Attempting CCD IK...
[IK moveEndEffector] Chain: robot_chain, Method: ccd
[IK moveEndEffector] Delta: Vector3(0.01, 0, 0)
[IK moveEndEffector] Current position: Vector3(0.5, 0.3, 0.2)
[IK moveEndEffector] Target position: Vector3(0.51, 0.3, 0.2)
[IK moveEndEffector] Using ccd method via solveAndApply
IK solved: error=0.0005, iterations=12
[IK moveEndEffector] ✅ Success
[RobotJoggingPanel] ✅ TCP jog successful: X +
```

**Failed TCP Jog:**
```
[RobotJoggingPanel] TCP Jog: X +
[RobotJoggingPanel] Robot ID: collection_xxx
[RobotJoggingPanel] No kinematic chain found for this robot
[RobotJoggingPanel] Looking for robotId: collection_xxx
[RobotJoggingPanel] Available joint IDs: [[...]]
```

Or:

```
[IK moveEndEffector] Failed to get current end-effector pose
[IK moveEndEffector] Available chains: ["robot_chain"]
[IK moveEndEffector] ❌ Failed
[RobotJoggingPanel] ❌ IK failed for TCP jog: X +
```

---

## Testing Instructions

### Step 1: Load a Robot
1. Start dev server: `npm run dev`
2. Open browser: `http://localhost:5173`
3. Import a URDF robot (or JT-converted robot)
4. Open Kinematics Panel

### Step 2: Test Joint Mode (Baseline)
1. Select "Joint" mode
2. Click +/- buttons for each joint
3. **Expected:** Robot joints move ✅

### Step 3: Test TCP Mode (Debug)
1. Select "TCP" mode
2. Open browser console (F12 → Console tab)
3. Click +X button
4. **Check console output** for debug logs

### Step 4: Analyze Console Output

Look for these key indicators:

**✅ Good Signs:**
- `[RobotJoggingPanel] Using chain: ...`
- `[IK moveEndEffector] Current position: ...`
- `[IK moveEndEffector] Target position: ...`
- `IK solved: error=0.00XX, iterations=XX`
- `[IK moveEndEffector] ✅ Success`

**❌ Problem Signs:**
- `No kinematic chains available`
- `No kinematic chain found for this robot`
- `Failed to get current end-effector pose`
- `IK failed: error=XX, iterations=XX`
- `[IK moveEndEffector] ❌ Failed`

---

## Potential Root Causes

### 1. Chain Not Found
**Symptom:** `No kinematic chain found for this robot`

**Cause:** Robot ID mismatch between jogging panel and kinematic chain

**Fix:** Verify robot collection ID matches joint IDs in chain

**Debug:**
```typescript
// Check robot ID
console.log('Robot ID:', robotId);

// Check chain joint IDs
const chains = kinematicsManager.getAllChains();
chains.forEach(chain => {
  console.log('Chain:', chain.name);
  chain.joints.forEach(j => console.log('  Joint:', j.id));
});
```

### 2. FK Solver Returns Null Pose
**Symptom:** `Failed to get current end-effector pose`

**Cause:** FK solver not initialized or chain configuration invalid

**Fix:** Verify FK solver has correct chain setup

**Debug:**
```typescript
// Check FK solver
const pose = fkSolver.getEndEffectorPose(chainName);
console.log('End effector pose:', pose);
```

### 3. IK Solver Fails to Converge
**Symptom:** `IK failed: error=0.XXXX, iterations=300`

**Cause:** Target position unreachable or robot in singularity

**Possible Reasons:**
- Target outside workspace
- Joint limits prevent solution
- Robot in singular configuration
- Step size too large (try smaller steps)

**Fix:** Reduce jog step size or improve IK solver parameters

### 4. Coordinate System Mismatch
**Symptom:** Robot moves incorrectly or unpredictably

**Cause:** USER (Z-up, mm) ↔ BABYLON (Y-up, m) conversion error

**Debug:**
```typescript
// Check coordinate conversion
const userDelta = { x: 10, y: 0, z: 0 }; // 10mm in X
const babylonDelta = userToBabylon(userDelta);
console.log('User delta:', userDelta);
console.log('Babylon delta:', babylonDelta); // Should be (0.01, 0, 0)
```

---

## IK Solver Methods

### CCD (Cyclic Coordinate Descent)
- **Pros:** More robust, handles singularities better
- **Cons:** Slower convergence
- **Used:** Default for linear TCP motion

### Jacobian Transpose
- **Pros:** Fast, smooth motion
- **Cons:** Can fail near singularities
- **Used:** Fallback for linear motion, primary for rotation

### FABRIK (Forward And Backward Reaching IK)
- **Pros:** Very fast, natural motion
- **Cons:** Position-only (no orientation control)
- **Used:** Available but not default

---

## Next Steps

### Immediate (User Testing)
1. Run kinetiCORE locally
2. Load a robot (URDF or JT-converted)
3. Test TCP mode jogging
4. Capture console output
5. Report findings

### If Chain Not Found:
- Check robot loading code
- Verify kinematic chain registration
- Fix robot ID matching logic

### If IK Fails:
- Reduce jog step size (10mm → 5mm)
- Try different IK method (CCD → Jacobian → FABRIK)
- Check joint limits
- Verify robot not in singularity

### If Coordinate Issues:
- Review `CoordinateSystem.ts`
- Verify `userToBabylon` conversion
- Check unit conversion (mm → m)

---

## Code References

### IK Solver
- [InverseKinematicsSolver.ts:413](../src/kinematics/InverseKinematicsSolver.ts#L413) - `moveEndEffector` method
- [InverseKinematicsSolver.ts:327](../src/kinematics/InverseKinematicsSolver.ts#L327) - `solveAndApply` method
- [InverseKinematicsSolver.ts:52](../src/kinematics/InverseKinematicsSolver.ts#L52) - `solveJacobianTranspose` method
- [InverseKinematicsSolver.ts:196](../src/kinematics/InverseKinematicsSolver.ts#L196) - `solveCCD` method

### Jogging Panel
- [RobotJoggingPanel.tsx:123](../src/ui/components/RobotJoggingPanel.tsx#L123) - `handleJogTcp` method
- [RobotJoggingPanel.tsx:110](../src/ui/components/RobotJoggingPanel.tsx#L110) - `handleJogJoint` method (working baseline)

### Coordinate System
- [CoordinateSystem.ts](../src/core/CoordinateSystem.ts) - Z-up ↔ Y-up conversions
- [COORDINATE_SYSTEM.md](../COORDINATE_SYSTEM.md) - Coordinate system documentation

---

## Success Criteria

TCP move debugging is complete when:
1. ✅ Console shows detailed debug logs for every TCP jog attempt
2. ✅ User can identify why TCP jog fails (chain not found, IK failed, etc.)
3. ✅ Fix is identified and implemented
4. ✅ TCP jogging works smoothly in all axes (X, Y, Z, RX, RY, RZ)
5. ✅ Debug logging removed or made conditional (dev mode only)

---

**Status:** Debug logging complete, awaiting user testing

**Next:** Run locally, test TCP mode, analyze console output, implement fix
