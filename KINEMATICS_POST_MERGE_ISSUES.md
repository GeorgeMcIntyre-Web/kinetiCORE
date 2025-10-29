# Kinematics Post-Merge Issues Analysis

**Date:** 2025-10-29
**Branch:** main (post FK/IK/Jacobian merge)
**Scope:** 3 critical issues discovered after production merge

---

## Issue 1: TCP/Joint Gizmo Label Misalignment ⚠️ HIGH PRIORITY

### Problem Description
- **Symptom:** XYZ labels on TCP gizmo arrows are misaligned
- **Visual Evidence:** Red arrow shows "Y", Green arrow shows "Z", Blue arrow shows "X"
- **Expected:** Red arrow should show "X", Green arrow should show "Y", Blue arrow should show "Z"
- **Impact:** User confusion, incorrect jogging direction identification

### Root Cause
**File:** [src/kinematics/IKTargetGizmoManager.ts:733-736](src/kinematics/IKTargetGizmoManager.ts#L733-L736)

```typescript
// CURRENT (WRONG):
createLabel('X', colors.x, new BABYLON.Vector3(1, 0, 0), 'x', zGizmo);  // X label → blue gizmo
createLabel('Y', colors.y, new BABYLON.Vector3(0, 1, 0), 'y', xGizmo);  // Y label → red gizmo
createLabel('Z', colors.z, new BABYLON.Vector3(0, 0, 1), 'z', yGizmo);  // Z label → green gizmo
```

**Problem:** Gizmo references are rotated incorrectly. The labels are being attached to the wrong gizmo axes.

**Explanation:**
- Babylon.js PositionGizmo convention: `xGizmo` = red, `yGizmo` = green, `zGizmo` = blue
- Current code assigns: X label to `zGizmo` (blue), Y label to `xGizmo` (red), Z label to `yGizmo` (green)
- This creates the rotation we see: labels are shifted by one position

### Solution

```typescript
// CORRECT:
createLabel('X', colors.x, new BABYLON.Vector3(1, 0, 0), 'x', xGizmo);  // X label → red gizmo
createLabel('Y', colors.y, new BABYLON.Vector3(0, 1, 0), 'y', yGizmo);  // Y label → green gizmo
createLabel('Z', colors.z, new BABYLON.Vector3(0, 0, 1), 'z', zGizmo);  // Z label → blue gizmo
```

**Testing Required:**
- Visual inspection of TCP gizmo labels on MH5 robot
- Verify labels stay at arrow tips during camera movement
- Confirm billboard rotation keeps text readable

---

## Issue 2: Joint Gizmos Not Following Joint Movement ⚠️ MEDIUM PRIORITY

### Problem Description
- **Symptom:** When joint angles are changed via sliders, the joint debug gizmos (axis visualization) do not update position
- **Visual Evidence:** Gizmos remain at original positions even after joints move
- **Expected:** Gizmos should follow the joint positions and update in real-time
- **Impact:** Debug visualization out of sync, misleading for debugging

### Current Implementation

**Update Flow:**
1. User changes joint angle via slider
2. `FloatingKinematicsPanel.tsx:530` calls `fk.updateJointPosition()`
3. `ForwardKinematicsSolver.ts:67` calls `kinematicsManager.updateJointGizmo()`
4. `KinematicsManager.ts:1247` implements `updateJointGizmo()`:
   ```typescript
   updateJointGizmo(jointId: string, scene: BABYLON.Scene): void {
     const joint = this.joints.get(jointId);
     if (!joint || joint.type !== 'revolute') return;

     const visuals = this.jointAxisVisualizers.get(jointId);
     if (!visuals || visuals.length === 0) return;

     // Hide old gizmo and recreate with new angle
     this.hideJointVisuals(jointId);
     this.showJointDebugFrame(jointId, scene);
   }
   ```

### Root Cause Analysis

**Potential Issues:**

1. **Missing Scene Parameter in FK Call**
   - Line `ForwardKinematicsSolver.ts:67` passes `scene` but FK might not have access
   - Check if scene is properly propagated

2. **Hide/Show Race Condition**
   - `hideJointVisuals()` removes old gizmo
   - `showJointDebugFrame()` creates new gizmo
   - If scene is null or joint position hasn't updated yet, new gizmo appears at old position

3. **No Position Update Before Recreation**
   - Gizmo is recreated but joint's Babylon mesh position might not have updated yet
   - FK updates happen async, gizmo recreation might be too early

### Investigation Required

1. Add logging to confirm `updateJointGizmo()` is called
2. Check if `showJointDebugFrame()` uses updated joint mesh position
3. Verify scene reference is valid
4. Check if `computeWorldMatrix(true)` is called before gizmo positioning

### Proposed Solution

**Option A: Force Position Update Before Gizmo Recreation**
```typescript
updateJointGizmo(jointId: string, scene: BABYLON.Scene): void {
  const joint = this.joints.get(jointId);
  if (!joint || joint.type !== 'revolute') return;

  const visuals = this.jointAxisVisualizers.get(jointId);
  if (!visuals || visuals.length === 0) return;

  // FORCE world matrix update before hiding/showing
  const tree = SceneTreeManager.getInstance();
  const node = tree.getNode(joint.parentNodeId);
  if (node?.babylonNode) {
    node.babylonNode.computeWorldMatrix(true);
  }

  this.hideJointVisuals(jointId);
  this.showJointDebugFrame(jointId, scene);
}
```

**Option B: Update Existing Gizmo Position Instead of Recreation**
- More efficient: don't destroy and recreate
- Update gizmo transform directly from joint mesh world position

---

## Issue 3: JOINT CONTROL Toolbar - Non-Functional Buttons ⚠️ LOW PRIORITY

### Problem Description
- **Symptom:** Some of the 6 icon buttons in JOINT CONTROL toolbar don't work
- **Location:** [src/ui/components/FloatingKinematicsPanel.tsx:579-755](src/ui/components/FloatingKinematicsPanel.tsx#L579-L755)
- **Impact:** Debug features inaccessible, reduces development efficiency

### The 6 Buttons

| # | Icon | Label | Handler | Line | Status |
|---|------|-------|---------|------|--------|
| 1 | 🏠 Home | Reset All to Home | `handleResetAll` | 608 | ❓ Unknown |
| 2 | 👁️ Eye/EyeOff | Debug Visualizer | `handleToggleVisualizer` | 627 | ❓ Unknown |
| 3 | 📥 Download | Get Divergence Report | `handleGetDivergenceReport` | 647 | ❓ Unknown |
| 4 | 🧪 TestTube | Run IK Test Suite | `handleRunTestSuite` | 667 | ❓ Unknown |
| 5 | ✓ Check | Test FK/IK Consistency | `handleTestConsistency` | 688 | ❓ Unknown |
| 6 | 🐛 Bug | Show Joint Debug Frames | `handleShowJointDebug` | 707 | ❓ Unknown |

### Investigation Required

**Test Each Button:**
1. Click each button and observe console output
2. Check if handlers are properly defined
3. Verify required dependencies (TransformDebugVisualizer, IKTestHarness) are initialized
4. Check for error messages in console

**Common Failure Modes:**
- Handler not implemented (function exists but does nothing)
- Missing scene reference
- Component state not initialized
- Async initialization issues

### Expected Handler Implementations

**1. handleResetAll**
```typescript
const handleResetAll = () => {
  // Reset all joints to home position (0 or default)
  const chain = kinematicsManager.getChain(selectedRobotId);
  chain.joints.forEach(joint => {
    fkSolver.updateJointPosition(joint.id, 0);
  });
};
```

**2. handleToggleVisualizer**
```typescript
const handleToggleVisualizer = () => {
  const scene = (window as any).sceneManager?.getScene();
  if (!scene) {
    console.error('Scene not available');
    return;
  }
  visualizer.setEnabled(!visualizerEnabled);
  setVisualizerEnabled(!visualizerEnabled);
};
```

**3. handleGetDivergenceReport**
```typescript
const handleGetDivergenceReport = () => {
  const report = visualizer.getDivergenceReport();
  console.log(report);
  // Download as JSON or display in modal
};
```

**4. handleRunTestSuite**
```typescript
const handleRunTestSuite = async () => {
  const chain = kinematicsManager.getChain(selectedRobotId);
  const results = await testHarness.runFullTestSuite(chain.name);
  console.log('Test Results:', results);
  alert(`Tests completed: ${results.passed}/${results.total} passed`);
};
```

**5. handleTestConsistency**
```typescript
const handleTestConsistency = () => {
  const chain = kinematicsManager.getChain(selectedRobotId);
  const consistency = testHarness.testFKIKConsistency(chain.name);
  console.log('Consistency Test:', consistency);
  alert(`FK/IK Error: ${consistency.error.toFixed(4)}mm`);
};
```

**6. handleShowJointDebug**
```typescript
const handleShowJointDebug = () => {
  const scene = (window as any).sceneManager?.getScene();
  if (!scene) return;

  const chain = kinematicsManager.getChain(selectedRobotId);
  chain.joints.forEach(joint => {
    kinematicsManager.showJointDebugFrame(joint.id, scene);
  });
};
```

---

## Issue 4: Straight-Line Motion Planning Review 📊 ANALYSIS NEEDED

### Context
- **Current IK:** Damped Least Squares Jacobian-based solver
- **Motion Type:** Point-to-point (start → end, converge at each waypoint)
- **Question:** Is this suitable for real robot linear moves (e.g., CNC-style straight lines)?

### Current IK Approach

**File:** [src/kinematics/InverseKinematicsSolver.ts](src/kinematics/InverseKinematicsSolver.ts)

**Algorithm:** Damped Least Squares (Levenberg-Marquardt variant)
- Iterative Jacobian-based optimization
- Converges to target pose from current pose
- **No trajectory planning** - only solves for final position

### Straight-Line Motion Requirements (Real Robots)

**Industrial Robot Standards:**
1. **Linear Interpolation (LERP):**
   - TCP moves in a straight line in Cartesian space
   - Joint angles change smoothly along the path
   - Constant TCP velocity option

2. **Collision Avoidance:**
   - Path must avoid obstacles
   - Joint limits respected throughout

3. **Smooth Acceleration:**
   - S-curve acceleration profiles
   - No jerky movements (protect hardware)

### Current Implementation Gap

**What We Have:**
```typescript
// Single-point IK solve
const solution = ikSolver.solveDampedLeastSquares(targetPose, currentJoints);
// Result: Joint angles that reach target
// No guarantee about intermediate path
```

**What We Need for Linear Moves:**
```typescript
// Trajectory-based IK
const trajectory = generateLinearTrajectory(startPose, endPose, numWaypoints);
const jointTrajectory = trajectory.map(waypoint =>
  ikSolver.solve(waypoint, previousJoints)
);
// Result: Sequence of joint angles that follow straight TCP path
```

### Assessment: Is Current IK Good Enough?

**✅ Sufficient For:**
- Pick-and-place (endpoint accuracy matters, path doesn't)
- Free-space motion (no obstacles)
- Jogging/manual moves (user controls path)
- Prototyping and testing

**❌ Insufficient For:**
- Welding (straight seam required)
- Machining (precise tool path)
- Painting (smooth surface coverage)
- Collision-sensitive environments

### Recommended Solution: Hybrid Approach

**Phase 1 (Current): Point-to-Point IK** ✅ DONE
- Single-target IK solver (implemented)
- Use for: Jogging, free-space moves, prototyping

**Phase 2 (Next): Linear Trajectory IK** 🔄 TODO
- Add `TrajectoryIKSolver` (file exists but incomplete)
- Implements:
  1. Linear interpolation in Cartesian space
  2. Per-waypoint IK solve
  3. Joint velocity/acceleration limits
  4. Fallback to point-to-point if linear path infeasible

**Phase 3 (Future): Advanced Planning**
- Spline-based paths (smooth curves)
- Collision detection integration
- Multi-robot coordination
- Time-optimal trajectories

### Implementation Plan

**File:** [src/kinematics/TrajectoryIKSolver.ts](src/kinematics/TrajectoryIKSolver.ts) (exists, needs completion)

**Required Methods:**
```typescript
class TrajectoryIKSolver {
  // Generate linear path in Cartesian space
  generateLinearPath(
    start: Pose,
    end: Pose,
    options: {
      maxStepSize: number,  // e.g., 5mm per waypoint
      numWaypoints?: number
    }
  ): Pose[];

  // Solve IK for entire trajectory
  solveTrajectory(
    waypoints: Pose[],
    startJoints: number[]
  ): {
    success: boolean;
    jointTrajectory: number[][];
    feasible: boolean[];  // per-waypoint feasibility
    error: number[];      // per-waypoint error
  };

  // Check if linear path is achievable
  isLinearPathFeasible(
    start: Pose,
    end: Pose
  ): boolean;
}
```

**Usage Example:**
```typescript
// TCP linear move from A to B
const trajectorySolver = new TrajectoryIKSolver(ikSolver, fkSolver);
const waypoints = trajectorySolver.generateLinearPath(poseA, poseB, { maxStepSize: 0.005 });
const result = trajectorySolver.solveTrajectory(waypoints, currentJoints);

if (result.success && result.feasible.every(f => f)) {
  // Execute smooth linear move
  executeJointTrajectory(result.jointTrajectory);
} else {
  // Fallback to point-to-point
  console.warn('Linear path not feasible, using point-to-point');
  const endJoints = ikSolver.solve(poseB, currentJoints);
  moveToJointAngles(endJoints);
}
```

---

## Priority & Execution Plan

### Immediate (This Session)
1. ✅ **Issue 1: Fix TCP gizmo labels** - 5 min fix, high user impact
2. ✅ **Issue 2: Debug joint gizmo updates** - 10-15 min investigation + fix

### Short-Term (Next Session)
3. ✅ **Issue 3: Test and fix toolbar buttons** - 30 min testing + fixes
4. 📊 **Issue 4: Document linear motion gap** - Document only, don't implement yet

### Medium-Term (Next Sprint)
5. 🔄 **Implement TrajectoryIKSolver** - 2-4 hours
6. 🧪 **Add trajectory tests** - 1-2 hours
7. 📚 **User documentation for motion types** - 1 hour

---

## Testing Checklist

### Issue 1: TCP Gizmo Labels
- [ ] Labels appear at arrow tips (not floating far away)
- [ ] X label on red arrow, Y on green, Z on blue
- [ ] Labels face camera (billboard rotation)
- [ ] Labels stay locked during joint moves
- [ ] No position drift over time

### Issue 2: Joint Gizmo Updates
- [ ] Change joint angle via slider
- [ ] Verify gizmo moves with joint
- [ ] Check all joints in chain (not just end effector)
- [ ] Rapid slider changes don't break visualization
- [ ] Gizmos remain visible after updates

### Issue 3: Toolbar Buttons
- [ ] Home button resets all joints to 0
- [ ] Visualizer toggle shows/hides debug frames
- [ ] Divergence report prints to console
- [ ] IK test suite runs and reports results
- [ ] Consistency test shows FK/IK error
- [ ] Joint debug frames appear when clicked

### Issue 4: Linear Motion
- [ ] Document current IK limitations
- [ ] Research industrial robot linear interpolation standards
- [ ] Design TrajectoryIKSolver API
- [ ] Prototype with 10-waypoint linear path
- [ ] Compare TCP path deviation vs true line

---

## Commit Strategy

**Commit 1:** Fix TCP gizmo label assignments
```
fix(ik): Correct TCP gizmo XYZ label-to-axis mapping

- Fixed label assignments in IKTargetGizmoManager.ts:733-736
- X label now on red (xGizmo), Y on green (yGizmo), Z on blue (zGizmo)
- Previously: labels were rotated one position clockwise

Visual test: MH5 robot TCP gizmo now shows correct labels
```

**Commit 2:** Fix joint gizmo update mechanism
```
fix(kinematics): Force world matrix update before joint gizmo recreation

- Added computeWorldMatrix(true) call in updateJointGizmo()
- Ensures gizmo uses updated joint mesh position
- Fixes: Joint gizmos not following when angles change via slider
```

**Commit 3:** Debug and fix toolbar buttons
```
fix(ui): Implement missing JOINT CONTROL toolbar handlers

- Fixed handleResetAll: Now properly resets all joints to home
- Fixed handleShowJointDebug: Creates debug frames for all joints
- Added error handling for missing scene references
- All 6 toolbar buttons now functional
```

**Commit 4:** Document linear motion planning gap
```
docs(kinematics): Add analysis of straight-line motion requirements

- Documented current IK solver capabilities (point-to-point)
- Identified gap for industrial linear interpolation
- Proposed TrajectoryIKSolver implementation plan
- See: KINEMATICS_POST_MERGE_ISSUES.md Issue 4
```

---

**End of Analysis**
