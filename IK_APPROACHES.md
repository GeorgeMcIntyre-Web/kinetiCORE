# IK Implementation Approaches - Complete Analysis

**Date:** 2025-10-28
**Status:** Evaluating options after 1 day debugging numerical IK
**Current Decision:** Option B - Deep dive into numerical IK with comprehensive debugging

---

## Overview

This document compares all viable approaches for implementing 6-axis inverse kinematics in kinetiCORE.

---

## Option A: Analytical IK (Closed-Form Solution)

### Description
Use geometric/algebraic equations to compute exact joint angles for a given TCP pose. Standard approach for industrial 6-axis robots with spherical wrists.

### How It Works
1. **Position IK (Joints 1-3):** Geometric solution to reach target position
2. **Orientation IK (Joints 4-6):** Algebraic solution for wrist orientation
3. **Multiple solutions:** Up to 8 valid configurations, pick best

### Pros
- ✅ **Instant solution** - No iterations, no convergence
- ✅ **Industry standard** - Used in production systems (ABB, Fanuc, KUKA)
- ✅ **Always works** - If target reachable, solution exists
- ✅ **Predictable** - No numerical instability
- ✅ **Fast** - Microseconds per solve
- ✅ **Well-documented** - Equations published for common geometries

### Cons
- ❌ **Robot-specific** - Need different equations for different geometries
- ❌ **Math complexity** - Requires understanding of DH parameters
- ❌ **Spherical wrist only** - Doesn't work for all robot types
- ❌ **Initial time investment** - 1-2 days to implement first time
- ❌ **Singularity handling** - Need special cases near singularities

### Requirements
- Robot has spherical wrist (last 3 axes intersect)
- DH parameters from URDF
- Implementation of geometric equations

### Time Estimate
- **Research equations:** 2-3 hours
- **Implementation:** 4-6 hours
- **Testing & debugging:** 2-4 hours
- **Total:** 1-2 days

### Success Probability: 85%

### When To Use
- 6-axis robot with spherical wrist
- Need guaranteed convergence
- Performance critical (many IK solves per second)
- Production deployment

### Resources
- Spong, Hutchinson, Vidyasagar: "Robot Modeling and Control" (Chapter 3)
- Paul: "Robot Manipulators: Mathematics, Programming, and Control"
- Craig: "Introduction to Robotics: Mechanics and Control" (Chapter 4)

---

## Option B: Numerical IK (Jacobian-based) ✅ CURRENT CHOICE

### Description
Iteratively adjust joint angles using Jacobian matrix to minimize error between current and target TCP pose. General solution that works for any robot.

### How It Works
1. Compute current TCP pose using FK
2. Compute error: `e = target - current`
3. Compute Jacobian: `J = ∂pose/∂joints`
4. Update joints: `Δq = J^T * e` (Jacobian transpose)
5. Repeat until error < tolerance

### Pros
- ✅ **General solution** - Works for any robot geometry
- ✅ **Handles redundancy** - Works with >6 DOF
- ✅ **Flexible** - Can add constraints, optimization
- ✅ **Reusable** - Same code for all robots
- ✅ **Educational** - Understand core IK concepts

### Cons
- ❌ **Convergence issues** - May not converge to solution
- ❌ **Slow** - 50-1000 iterations typical
- ❌ **Local minima** - Can get stuck in wrong configuration
- ❌ **Coordinate frame bugs** - Easy to mix up world/local spaces
- ❌ **Singularities** - Jacobian becomes singular
- ❌ **Tuning required** - Step size, damping, tolerance parameters

### Current Issues (Day 1 Debug)
1. ❌ FK/mesh position mismatch (12-118mm errors)
2. ❌ Error not reducing during iterations (stuck at 10mm)
3. ❌ Coordinate space confusion (world vs robot-local)
4. ⚠️ **Orientation not handled** - Critical oversight!
5. ❌ Mesh not updating during iterations

### Requirements
- Correct FK implementation
- Accurate Jacobian computation
- Proper coordinate frame handling
- Robust numerical methods
- Extensive testing framework

### Time Estimate
- **Current status:** 1 day invested, not working
- **Deep debugging:** 1-2 days
- **Orientation implementation:** 0.5-1 day
- **Testing framework:** 0.5-1 day
- **Total remaining:** 2-4 days

### Success Probability: 60%
- High if bugs are identified and fixed
- Risk: underlying design issues may require major refactor

### When To Use
- Non-standard robot geometry
- Redundant manipulators (>6 DOF)
- Learning/research project
- Need to handle constraints

### Resources
- Modern Robotics (Lynch & Park): Chapter 6 - Inverse Kinematics
- Siciliano: "Robotics: Modelling, Planning and Control" (Chapter 3)
- Our implementation: `src/kinematics/InverseKinematicsSolver.ts`

---

## Option C: Numerical IK (CCD - Cyclic Coordinate Descent)

### Description
Iteratively adjust one joint at a time to move TCP toward target. Simpler than Jacobian but less efficient.

### How It Works
1. Start from end effector, work back to base
2. For each joint: rotate to align TCP toward target
3. Repeat until error < tolerance

### Pros
- ✅ **Simple** - Easy to understand and implement
- ✅ **No Jacobian** - Just geometric calculations
- ✅ **Intuitive** - Mimics human problem-solving
- ✅ **General** - Works for any chain

### Cons
- ❌ **Slower convergence** - More iterations than Jacobian
- ❌ **Position only** - Hard to control orientation
- ❌ **Oscillation** - Can ping-pong between solutions
- ❌ **Same issues as Jacobian** - Coordinate frames, convergence

### Status
- Implemented in `solveCCD()` but has same bugs as Jacobian
- Not currently working

### Time Estimate
- **Fix existing:** 1-2 days (same issues as Jacobian)

### Success Probability: 40%
- Worse than Jacobian for 6-axis robots
- Position-only limiting

---

## Option D: Numerical IK (FABRIK)

### Description
Forward And Backward Reaching Inverse Kinematics. Modern algorithm for human-like motion.

### How It Works
1. **Backward pass:** Move end effector to target, adjust chain backward
2. **Forward pass:** Restore base position, adjust chain forward
3. Repeat until converged

### Pros
- ✅ **Fast convergence** - Typically <10 iterations
- ✅ **Natural motion** - Good for animation/humanoids
- ✅ **Simple** - No Jacobian computation
- ✅ **Stable** - Rarely diverges

### Cons
- ❌ **Position only** - Very hard to control orientation
- ❌ **Not standard** - Less common in industrial robotics
- ❌ **Joint limits** - Harder to enforce
- ❌ **Same coordinate issues** - Still need correct transforms

### Status
- Implemented in `solveFABRIK()` but has same coordinate bugs
- Not recommended for 6-axis industrial robots

### Time Estimate
- **Fix existing:** 1-2 days

### Success Probability: 35%
- Not ideal for industrial robots with orientation requirements

---

## Option E: Python Bridge (IKPy / KDL)

### Description
Run Python IK library as microservice, call from TypeScript.

### How It Works
1. TypeScript sends target pose to Python service
2. Python (IKPy) solves IK
3. Returns joint angles to TypeScript
4. TypeScript applies to robot

### Pros
- ✅ **Mature libraries** - IKPy supports URDF directly
- ✅ **Tested** - Used in ROS community
- ✅ **Multiple algorithms** - Numerical + analytical options
- ✅ **Fast development** - No need to implement

### Cons
- ❌ **Deployment complexity** - Need Python server
- ❌ **Network latency** - 5-20ms per call
- ❌ **Dependencies** - Python, numpy, scipy
- ❌ **Still numerical** - IKPy uses Jacobian (same issues?)
- ❌ **Debugging harder** - Cross-language debugging
- ❌ **Maintenance** - Two codebases to maintain

### Requirements
- Python server with IKPy
- REST or WebSocket API
- TypeScript client
- Deployment infrastructure

### Time Estimate
- **Setup microservice:** 4-6 hours
- **Integration:** 2-4 hours
- **Testing:** 4-6 hours
- **Deployment:** 2-4 hours
- **Total:** 2-3 days

### Success Probability: 70%
- High if IKPy works out-of-the-box
- Risk: May still have same numerical IK issues

### When To Use
- Need quick solution with mature library
- OK with Python dependency
- Don't need microsecond performance
- Want analytical option (ikfast via OpenRAVE)

---

## Option F: IKFast (Analytical Code Generation)

### Description
OpenRAVE generates optimized C++ code for specific robot geometry. Can compile to WASM.

### How It Works
1. Feed URDF to OpenRAVE's IKFast
2. Generates C++ analytical solver
3. Compile to WASM
4. Call from TypeScript

### Pros
- ✅ **Analytical solution** - Fast, reliable
- ✅ **Auto-generated** - Don't write equations
- ✅ **Optimized** - Faster than hand-coded
- ✅ **Industry standard** - Used in ROS MoveIt

### Cons
- ❌ **Complex toolchain** - OpenRAVE, WASM compilation
- ❌ **Long generation** - Can take hours for complex robots
- ❌ **May fail** - Not all geometries solvable
- ❌ **Build complexity** - C++ → WASM pipeline
- ❌ **Large binary** - Generated code can be huge

### Time Estimate
- **Setup OpenRAVE:** 4-8 hours (Docker recommended)
- **Generate IK:** 2-8 hours (depends on robot)
- **WASM compilation:** 2-4 hours
- **Integration:** 4-6 hours
- **Total:** 2-4 days

### Success Probability: 65%
- High if robot geometry is standard
- Risk: Generation may fail for unusual geometries

---

## Decision Matrix

| Option | Time | Success % | Performance | Maintainability | Learning Value |
|--------|------|-----------|-------------|-----------------|----------------|
| A: Analytical | 1-2d | 85% | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| B: Jacobian | 2-4d | 60% | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| C: CCD | 1-2d | 40% | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| D: FABRIK | 1-2d | 35% | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| E: Python | 2-3d | 70% | ⭐⭐ | ⭐⭐ | ⭐⭐ |
| F: IKFast | 2-4d | 65% | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

---

## Current Decision: Option B (Deep Dive Numerical IK)

### Rationale
1. Already invested 1 day
2. General solution needed
3. Educational value
4. **Critical oversight identified:** Orientation not handled
5. Need robust testing framework anyway

### Success Criteria
- FK verification tests pass
- Orientation properly handled in IK
- Error reduces to <1mm within 100 iterations
- Works reliably for 10+ consecutive jogs

### Kill Switch
If not working after **2 more days** (Oct 30), switch to:
- **1st choice:** Option A (Analytical IK)
- **2nd choice:** Option E (Python/IKPy bridge)

---

## Deep Dive Plan for Option B

### Phase 1: Independent FK Verification (Day 1 AM)
**Goal:** Prove FK is 100% correct in isolation

1. **Create test suite:**
   - Known DH parameters → Expected pose
   - Test each joint independently
   - Test combined joint angles
   - Verify in both local and world space

2. **Test cases:**
   ```typescript
   // Test 1: Home position (all zeros)
   FK([0,0,0,0,0,0]) = { pos: [x,y,z], rot: [qw,qx,qy,qz] }

   // Test 2: Single joint rotations
   FK([π/2,0,0,0,0,0]) = expected_pose_j1_90deg
   FK([0,π/2,0,0,0,0]) = expected_pose_j2_90deg

   // Test 3: Known configurations
   FK([0,π/4,π/4,0,0,0]) = expected_pose_elbow_up
   ```

3. **Validate against:**
   - Hand calculations
   - External tool (Python robotics library)
   - Visual inspection (does mesh match calculated position?)

**Success:** FK matches expected values within 0.1mm, 0.1° for all test cases

---

### Phase 2: Coordinate Space Verification (Day 1 PM)
**Goal:** Prove all coordinate transforms are correct

1. **Test roundtrip transforms:**
   ```typescript
   // Local → World → Local should be identity
   poseLocal = FK.solve(angles)
   poseWorld = transformToWorld(poseLocal)
   poseLocal2 = transformToLocal(poseWorld)
   assert(poseLocal ≈ poseLocal2)
   ```

2. **Test Jacobian computation:**
   ```typescript
   // Numerical differentiation check
   J_computed = FK.computeJacobian(angles)
   J_numerical = numericalJacobian(angles, ε=0.0001)
   assert(J_computed ≈ J_numerical)
   ```

3. **Test mesh position matches FK:**
   ```typescript
   // Apply joint angles to mesh
   updateAllJoints(angles)
   meshPose = getNullTCPPose()
   fkPose = FK.solve(angles)
   assert(meshPose ≈ fkPose)  // Should be ~0mm diff
   ```

**Success:** All transforms verified, mesh matches FK within 0.1mm

---

### Phase 3: Orientation Handling (Day 2 AM)
**Goal:** Implement proper orientation in IK solver

1. **Current bug:**
   - `moveTCP()` only passes position to IK
   - Orientation weight = 0.5 but target rotation often undefined
   - Wrist joints (4-6) not contributing to solution

2. **Fix:**
   ```typescript
   moveTCP(positionDelta: Vector3) {
     const currentPose = getNullTCPPose()
     const targetPosition = currentPose.position.add(positionDelta)
     const targetRotation = currentPose.rotation  // KEEP orientation!

     solveJacobianTranspose({
       position: targetPosition,
       rotation: targetRotation  // ← Must be defined!
     })
   }
   ```

3. **Test orientation:**
   - Move TCP +X while maintaining orientation
   - Rotate TCP while maintaining position
   - Move + rotate simultaneously

**Success:** Wrist joints (4-6) actively contribute to IK solution

---

### Phase 4: IK Iteration Loop Fix (Day 2 PM)
**Goal:** Make error actually reduce during iterations

1. **Root cause:**
   - Mesh doesn't update during iterations
   - Using mesh position → error never changes
   - Using FK from proposed angles → may have bugs

2. **Solution options:**
   - **A:** Update mesh during iterations (expensive)
   - **B:** Use FK from proposed angles (must verify FK is perfect)
   - **C:** Hybrid: FK for iterations, verify with mesh at end

3. **Implement & test:**
   ```typescript
   for (iteration = 0; iteration < maxIterations; iteration++) {
     // Compute where robot WOULD be with proposed angles
     currentPose = FK.solve(jointAngles)  // Robot-local
     currentPoseWorld = transformToWorld(currentPose)

     error = target - currentPoseWorld

     if (error < tolerance) break

     // Update proposed angles
     jacobian = computeJacobian(jointAngles)
     deltaAngles = jacobianTranspose(jacobian, error)
     jointAngles += stepSize * deltaAngles
   }

   // After convergence: Apply to actual robot
   applyJointAngles(jointAngles)
   ```

**Success:** Error reduces monotonically from 10mm → <1mm

---

### Phase 5: Edge Cases & Robustness (Day 3)
**Goal:** Handle singularities, limits, unreachable targets

1. **Joint limits:**
   - Clamp during iterations (not just at end)
   - Detect when limits prevent solution

2. **Singularities:**
   - Detect singular Jacobian (det(J*J^T) ≈ 0)
   - Use damped least squares near singularities
   - Warn user when in singular configuration

3. **Unreachable targets:**
   - Check if target beyond workspace
   - Return best effort + error amount
   - Don't apply if error > threshold

**Success:** IK handles edge cases gracefully

---

## Debugging Tools Needed

### 1. FK Verification Test Suite
- `test-fk-verification.ts`
- Known angles → Expected poses
- Automated pass/fail

### 2. Coordinate Transform Validator
- `test-coordinate-transforms.ts`
- Roundtrip tests
- Jacobian numerical check

### 3. IK Iteration Visualizer
- Log every iteration to file
- Plot error over time
- Show joint angle evolution

### 4. Interactive Debug Mode
- Step through IK iteration by iteration
- Visualize Jacobian columns as arrows
- Show error vector in 3D

---

## Success Metrics

### Must Have (Minimum Viable)
- ✅ FK matches mesh position within 0.1mm
- ✅ IK converges for simple 10mm X movement
- ✅ Error reduces monotonically
- ✅ Orientation maintained during position moves

### Should Have (Production Quality)
- ✅ Converges in <100 iterations (typical)
- ✅ Works for 20+ consecutive jogs
- ✅ Handles near-singularities
- ✅ Respects joint limits

### Nice To Have (Polish)
- ✅ <1mm final error
- ✅ <50 iterations typical
- ✅ Multiple solution strategies (Jacobian/CCD/FABRIK)
- ✅ User feedback on unreachable targets

---

## Fallback Plan

**If Option B fails by Oct 30:**

### Immediate: Switch to Option A (Analytical IK)
- 1 day to implement
- High confidence
- Production quality

### If pressed for time: Option E (Python Bridge)
- Use IKPy with URDF
- 2 days to deploy
- Good enough solution

---

## Conclusion

**Current path:** Option B with rigorous testing and orientation fix
**Time budget:** 2 days (until Oct 30)
**Kill switch:** If not working by Oct 30, switch to Analytical IK
**Key insight:** Orientation handling was overlooked - this may be the root cause

**Next immediate action:** Create FK verification test suite
