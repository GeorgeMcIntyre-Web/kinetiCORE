# U112 Motion Panel GOLD Standard

## Status

✅ **GOLD STANDARD** - Reference implementation for Motion Panel integration with auto-fitted tooling joints.

## Overview

This document defines the canonical expected behavior for the Motion Panel when controlling auto-fitted joints from the U112 fixture. This is the reference implementation that all future tooling fixture motion control must follow.

**Reference Fixture**: `016ZF_20142435_140_1E1_CI00_U112.glb`
- UNIT_101: Fixed gripper frame (base)
- UNIT_112: Moving clamp with revolute joint, 90° stroke

## End-to-End Flow

### Step 1: Auto-Kinematics Fit

1. User opens **Tooling Fixture Animator** panel
2. User loads U112 fixture GLB
3. User follows guided workflow:
   - Analyze → Detects UNIT_101 (fixed) + UNIT_112 (moving)
   - Capture Retracted → Samples point cloud at home position
   - [User moves clamp manually]
   - Capture Extended → Samples point cloud at actuated position
   - Fit Joints → ICP extracts hinge joint parameters

**Expected Result:**
- One hinge joint fitted with ~90° angle
- RMS error < 2mm (typical: 0.5mm)
- Confidence > 0.95
- Joint axis: approximately [0, 1, 0] or [-1, 0, 0] (depends on clamp orientation)

### Step 2: Joint Registration

After successful fit, `ToolingFixtureAnimator` automatically:
1. Calls `ToolingKinematicsAdapter.registerSingleChainFromAnimator()`
2. Registers tooling chain with `KinematicsManager.registerToolingChain()`
3. Displays toast: "Registered 1 joint(s) - open Motion Panel to control"

**Expected Result:**
- `KinematicsManager.getToolingChains()` returns 1 chain
- Chain contains 1 revolute joint
- Joint has valid `parentNodeId` and `childNodeId` pointing to UNIT_101 and UNIT_112

### Step 3: Motion Panel Display

User opens **Motion Panel** → scrolls to **"Tooling Motion"** section:

**Expected UI:**
```
┌─────────────────────────────────────┐
│ Tooling Motion                      │
├─────────────────────────────────────┤
│ Tooling Animator Chain              │
│ ├─ UNIT_112                         │
│ │  [========○==============] 45.0°  │
└─────────────────────────────────────┘
```

**Required Elements:**
- Section titled "Tooling Motion" (only visible if tooling chains exist)
- Chain name displayed (e.g., "Tooling Animator Chain")
- Joint label showing unit name (e.g., "UNIT_112" or "joint_12345")
- Slider with range [0°, 90°] (or joint.limits.lower to joint.limits.upper)
- Numeric display showing current angle in degrees

### Step 4: Real-Time Control

User scrubs slider from 0° → 90°:

**Expected Behavior:**
- **Immediate visual update**: UNIT_112 clamp rotates in scene
- **Smooth motion**: No lag or stuttering (< 16ms frame time)
- **Accurate positioning**: Joint angle matches slider value within ±0.5°
- **No demo conflict**: Demo animation does not interfere with manual control
- **FK solver called**: `ForwardKinematicsSolver.updateJointPosition()` invoked for each slider change

**Scene Transform Validation:**
- At 0°: UNIT_112 in retracted/home position
- At 45°: UNIT_112 halfway between retracted and extended
- At 90°: UNIT_112 in extended/actuated position
- Rotation axis remains consistent (no drift or gimbal lock)

## Invariants for U112 GOLD

These conditions **must always be true** for a successful U112 Motion Panel integration:

### Invariant 1: Joint Registration
```
GIVEN: U112 fixture with successful joint fit (angle ≥ 0.5°)
THEN:
  - KinematicsManager.getAllChains() includes exactly 1 tooling chain
  - toolingChain.joints.length === 1
  - toolingChain.joints[0].type === 'revolute'
  - toolingChain.joints[0].parentNodeId resolves to UNIT_101 node
  - toolingChain.joints[0].childNodeId resolves to UNIT_112 node
```

### Invariant 2: Motion Panel Discovery
```
GIVEN: Tooling chain registered with 1 revolute joint
WHEN: User opens Motion Panel
THEN:
  - "Tooling Motion" section is visible
  - Section displays exactly 1 slider for the hinge joint
  - Slider range: [joint.limits.lower, joint.limits.upper]
  - Slider initial value: joint.position (typically 0)
```

### Invariant 3: Real-Time Control
```
GIVEN: Motion Panel slider visible and user scrubs it
WHEN: Slider value changes from angle A to angle B
THEN:
  - fkSolver.updateJointPosition(jointId, B) is called within 16ms
  - UNIT_112 mesh world transform updates to reflect angle B
  - Joint position stored in joint.position === B
  - No console errors or warnings
  - Scene rendering remains at 60 FPS
```

### Invariant 4: No Silent Failures
```
GIVEN: Any operation in the flow (fit, register, display, control)
WHEN: An error occurs
THEN:
  - Error is logged to console with structured prefix (e.g., "[ToolingFixtureAnimatorPanel]")
  - User sees visible feedback (toast notification or inline error message)
  - Error message is actionable (tells user what to do next)
  - System does NOT fail silently or show generic "unknown error"
```

### Invariant 5: Demo Animation Compatibility
```
GIVEN: User has fitted joints and registered them with Motion Panel
WHEN: User plays demo animation via "4. Play Demo" button
THEN:
  - Demo animation uses the same joint data as Motion Panel
  - Demo completes without errors
  - After demo completes, Motion Panel slider still works
  - Motion Panel slider reflects current joint angle post-demo
```

## Protected Behaviors

These behaviors must never regress:

1. **No silent registration failures**
   - If `registerSingleChainFromAnimator()` returns `null`, user sees toast warning
   - Console logs structured error with reason

2. **No silently missing sliders**
   - If tooling chains exist but no sliders appear, Motion Panel shows clear error:
     - "No actuated joints found in this tooling chain"
     - "Select a fixture root in the scene tree to control its motion"

3. **Errors surface visibly**
   - All guard clauses log with `[MotionPanel]` prefix
   - Error states update panel UI (not just console)
   - Toast notifications use consistent format: `toast.error("Short actionable message")`

## Test References

### Unit Tests

#### KinematicsManager Tests
**Location**: `tests/kinematics/KinematicsManager.toolingChains.test.ts`

**Coverage:**
- Tooling chains are discoverable via `getJoint()`, `getAllChains()`, `getChainById()`, `getChainJoints()`
- Duplicate chain registration is handled (overwrites with same ID)
- Tooling chains do not pollute robot chain queries
- Isolation between robot chains and tooling chains

#### Motion Panel UI Tests
**Location**: `tests/ui/MotionPanel.u112.test.tsx`

**Coverage:**
- Slider appears when tooling joint is registered
- No joints → clear message shown
- No fixture selected → guarded behavior with hint
- Slider onChange calls `fkSolver.updateJointPosition()`

### Integration Tests

#### E2E Test: U112 Full Workflow
**Location**: `tests/gold/u112-motion-panel-gold.test.ts`

**Coverage:**
- Load U112 GLB
- Analyze → Capture → Fit → Register
- Verify Motion Panel displays slider
- Scrub slider programmatically
- Assert UNIT_112 mesh transforms match expected angles

### Manual Validation

**Steps:**
1. Load U112 fixture: `fixtures/gold/u112/016ZF_20142435_140_1E1_CI00_U112.glb`
2. Open Tooling Fixture Animator panel
3. Complete guided workflow (Analyze → Capture Retracted → Move clamp → Capture Extended → Fit Joints)
4. Verify toast: "Registered 1 joint(s) - open Motion Panel to control"
5. Open Motion Panel
6. Scroll to "Tooling Motion" section
7. Verify slider appears with label "UNIT_112" or similar
8. Scrub slider from 0° to 90°
9. Verify UNIT_112 clamp rotates smoothly in real-time
10. Click "4. Play Demo" in Tooling Fixture Animator
11. Verify demo completes without errors
12. Verify Motion Panel slider still works post-demo

**Expected Results:**
- All steps complete without errors
- Console shows structured logs (no warnings or errors)
- Motion is smooth and accurate
- Slider always reflects current joint angle

## Validation Commands

```bash
# Type-check (must pass)
npm run type-check

# Unit tests (must pass)
npm test -- tests/kinematics/KinematicsManager.toolingChains.test.ts
npm test -- tests/ui/MotionPanel.u112.test.tsx

# Integration tests (must pass)
npm test -- tests/gold/u112-motion-panel-gold.test.ts

# All auto-kinematics tests (must pass)
npm test -- --testPathPattern="ToolingFixtureAnimator|KinematicsManager|MotionPanel"

# Build (must succeed)
npm run build
```

## Error Scenarios and Solutions

### Scenario 1: "No tooling joints registered"

**Symptoms:**
- Tooling Fixture Animator fits joints successfully
- Toast shows "Registered 1 joint(s)"
- Motion Panel "Tooling Motion" section does not appear

**Debug Steps:**
1. Open browser console
2. Check for registration errors:
   ```
   [ToolingFixtureAnimatorPanel] Failed to register animator chain: <reason>
   ```
3. Manually query KinematicsManager:
   ```javascript
   const km = KinematicsManager.getInstance();
   console.log('Tooling chains:', km.getToolingChains());
   ```

**Common Causes:**
- Scene nodes missing valid Babylon references
- Adapter context fails to resolve node IDs
- Joint has invalid `parentNodeId` or `childNodeId`

**Solution:**
- Verify fixture structure: UNIT_* nodes must be proper TransformNodes
- Check console logs for "Registration returned null chainId"
- Ensure fixture GLB is not corrupted

### Scenario 2: "Slider moves but scene doesn't update"

**Symptoms:**
- Motion Panel slider scrubs
- Console shows joint value updates
- UNIT_112 mesh does not move

**Debug Steps:**
1. Check FK solver logs:
   ```
   [ForwardKinematicsSolver] Applying joint transform for joint_12345
   ```
2. Verify node references in Scene Inspector (F12 → Babylon.js Inspector)
3. Check if mesh is frozen:
   ```javascript
   const mesh = scene.getMeshByName("UNIT_112");
   console.log('Frozen:', mesh.freezeWorldMatrix);
   ```

**Common Causes:**
- Invalid `childNodeId` does not resolve to Babylon mesh
- Mesh is marked as `locked` or `freezeWorldMatrix = true`
- Parent-child hierarchy broken in scene graph

**Solution:**
- Verify `joint.childNodeId` maps to correct scene node
- Ensure mesh is not locked during capture workflow
- Re-load fixture if scene graph is corrupted

### Scenario 3: "High RMS error" warning

**Symptoms:**
- Joint fits successfully
- Warning toast: "1 joints have high RMS errors"
- Motion looks choppy or incorrect

**Debug Steps:**
1. Check joint details in Tooling Fixture Animator panel:
   - RMS error should be < 2mm for good fits
   - Typical error: 0.5mm for U112
2. Review ICP logs:
   ```
   [IcpFitter] RMS error: 5.2mm (threshold: 2.0mm)
   ```

**Common Causes:**
- Insufficient motion between retracted and extended captures
- Overlapping geometry interferes with ICP alignment
- Point cloud too sparse (stride too large)

**Solution:**
- Move clamp further (aim for 45°+ rotation)
- Check for geometry collisions during capture
- Lower stride in pipeline options to increase point density

## Related Documentation

- [Auto-Kinematics Pipeline](./AUTO_KINEMATICS_PIPELINE.md) - Core pipeline documentation
- [Motion Panel Integration](./MOTION_PANEL_INTEGRATION.md) - Integration guide
- [U112 Gold Standard](../../fixtures/gold/u112/DOCS/reference_notes.md) - Reference fixture details
- [Tooling Units V2 Algorithm](./TOOLING_UNITS_V2_ALGO.md) - Unit detection algorithm

## Changelog

### 2025-01-XX: Initial GOLD Standard
- Defined U112 Motion Panel invariants
- Documented end-to-end flow with expected results
- Added test references and validation commands
- Established protected behaviors for error handling
