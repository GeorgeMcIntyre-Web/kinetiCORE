# MJCF End-to-End Testing Guide - Essential Mode Only

**Purpose:** Fast development setup for visual review and functional testing
**Scope:** Essential mode ONLY (Professional/Expert modes excluded)
**Focus:** MJCF import → Kinematics Panel → Keyframe Playback → Joint Jogging

---

## Prerequisites

### Development Environment
```bash
# 1. Start dev server
npm run dev

# 2. Open browser
http://localhost:5173

# 3. Confirm Essential mode is active
# Check top-right header shows "Essential" badge
```

### Test Files Required
- [ ] **MJCF ZIP file** with:
  - `*.xml` - MuJoCo model definition
  - `*.glb` - 3D mesh geometry
  - Keyframe data embedded in XML

Example test files location:
```
c:\Users\George\source\repos\kinetiCORE_data\mjcf\
```

---

## Test Workflow Checklist

### Phase 1: Initial Load & UI Verification ✓
**Goal:** Verify Essential mode UI is functional

- [ ] **1.1** Browser loads without console errors
- [ ] **1.2** Header displays "kinetiCORE" + "Essential" badge
- [ ] **1.3** Left sidebar shows "Scene Tree" (empty initially)
- [ ] **1.4** Main viewport shows 3D canvas with grid/floor
- [ ] **1.5** Floating toolbar visible with all buttons
- [ ] **1.6** No error boundaries triggered

**Expected State:**
```
✅ Clean UI, no errors
✅ Scene tree empty except for "Assets" root
✅ 3D viewport rendering
✅ Toolbar buttons responsive
```

---

### Phase 2: MJCF Import Workflow ✓
**Goal:** Import MJCF ZIP and verify model loads correctly

#### 2.1 File Selection
- [ ] Click **Upload** button (toolbar)
- [ ] File dialog opens
- [ ] Select MJCF `.zip` file
- [ ] File dialog accepts selection

**Console Check:**
```javascript
[File Selection] ========================================
[File Selection] Selected 1 file(s):
[File Selection]   1. yourmodel.zip (XXX KB)
[File Selection] Detected 1 MJCF file(s), initializing batch processing
```

#### 2.2 MJCF Loading Status Popup
- [ ] **MJCFLoadingStatusPopup** appears (modal overlay)
- [ ] Shows "Loading MJCF Models" header
- [ ] Lists file name with status: "Loading..."
- [ ] Progress updates in real-time

**Expected Progression:**
```
yourmodel.zip → "Loading..." → "Extracting..." → "Building hierarchy..." → "Complete ✓"
```

#### 2.3 Model Appears in Scene
- [ ] 3D model renders in viewport (correct geometry)
- [ ] Model has correct orientation (Z-up coordinate system)
- [ ] No visual artifacts (flipped normals, missing meshes)
- [ ] Lighting/materials applied correctly

#### 2.4 Scene Tree Updates
- [ ] Scene tree shows new collection node (model name)
- [ ] Expand collection → shows body hierarchy
- [ ] Joint names visible as child nodes
- [ ] Collection node selectable

**Console Check:**
```javascript
[MJCF Loader] ✅ Successfully loaded MJCF model: yourmodel
[MJCF Keyframe] Registered X keyframes for model 'yourmodel'
```

**Visual Verification:**
- [ ] Robot/device appears in 3D space
- [ ] Default pose matches "home" keyframe (if defined)
- [ ] No floating/misplaced parts
- [ ] Joints visually connected to bodies

---

### Phase 3: Kinematics Panel Activation ✓
**Goal:** Verify Kinematics Panel discovers robot and displays correctly

#### 3.1 Open Kinematics Panel
- [ ] Click **Kinematics** button (Cog icon, toolbar)
- [ ] Kinematics Panel opens (floating modal)
- [ ] Panel header shows "Kinematics"
- [ ] Close button (×) visible

#### 3.2 Robot Auto-Discovery
**Wait 1-2 seconds for discovery interval**

- [ ] Panel discovers imported robot automatically
- [ ] Shows robot name in header
- [ ] Shows joint count (e.g., "6 joints")
- [ ] Pin button available (unpinned by default)

**Console Check:**
```javascript
[KinematicsPanel] Auto-grounding robot: yourmodel node: collection_xxx
[KinematicsPanel] Discovered X joints for robot
```

#### 3.3 Robot Selection (Auto-select)
- [ ] Click on robot node in scene tree
- [ ] Kinematics Panel updates to show robot details
- [ ] Panel header shows robot name + joint count
- [ ] "PINNED" badge does NOT appear (unless manually pinned)

#### 3.4 Pin/Unpin Functionality
- [ ] Click **Pin** button (unpinned state)
- [ ] Badge changes to "PINNED" (blue background)
- [ ] Click elsewhere in scene tree
- [ ] Kinematics Panel stays on pinned robot (does NOT switch)
- [ ] Click **Unpin** button
- [ ] Badge disappears
- [ ] Selecting different node updates panel

**Expected Behavior:**
```
Unpinned: Panel follows scene tree selection
Pinned:   Panel stays locked to current robot
```

---

### Phase 4: Keyframe Playback Panel Testing ✓
**Goal:** Verify keyframe poses load, display, and apply correctly

#### 4.1 Keyframe List Display
**Kinematics Panel → Keyframe Playback Section**

- [ ] Section header: "Keyframe Poses"
- [ ] Badge shows keyframe count (e.g., "5 poses")
- [ ] List of keyframes visible (scrollable if many)
- [ ] Each keyframe shows:
  - Name (e.g., "home", "pose1", "reach")
  - Description (if available)
  - Checkmark icon on selected keyframe

**If No Keyframes:**
- [ ] Shows "No keyframes available" message
- [ ] Shows hint: "Import an MJCF model with keyframe data"

#### 4.2 Keyframe Selection
- [ ] Click on first keyframe in list
- [ ] Item highlights (active state)
- [ ] Checkmark icon appears
- [ ] "Current Pose" info panel updates below:
  - Name: [keyframe name]
  - Description: [description if present]
  - Joints: [number of joint values]

#### 4.3 Apply Pose Button
- [ ] Click **"Apply Pose"** button
- [ ] Robot animates/snaps to selected pose
- [ ] Visual changes match expected keyframe
- [ ] No console errors

**Console Check:**
```javascript
[KeyframePlayback] Applying keyframe: home to yourmodel
[KeyframePlayback] ✅ Applied keyframe 'home' with X joint values
```

**Anti-Pattern Check (IMPORTANT):**
- [ ] Click "Apply Pose" again on SAME keyframe
- [ ] Console shows: "Keyframe 'home' already applied, skipping"
- [ ] Robot does NOT re-apply (idempotent behavior)

#### 4.4 Playback Controls
- [ ] **Previous (⏮)** button:
  - Cycles to previous keyframe
  - Robot pose updates
  - List selection updates

- [ ] **Play (▶)** button:
  - Starts automatic playback
  - Icon changes to Pause (⏸)
  - Keyframes advance every 2 seconds (default speed)

- [ ] **Pause (⏸)** button:
  - Stops playback
  - Icon changes back to Play
  - Current keyframe stays selected

- [ ] **Next (⏭)** button:
  - Cycles to next keyframe
  - Robot pose updates
  - List selection updates

#### 4.5 Playback Options
- [ ] **Loop checkbox**:
  - Enable loop
  - Play through all keyframes
  - Automatically restarts at beginning
  - Disable loop → playback stops at last keyframe

- [ ] **Speed dropdown**:
  - Select 0.5x → slower playback (4 sec/keyframe)
  - Select 1.0x → normal playback (2 sec/keyframe)
  - Select 1.5x → faster playback (1.33 sec/keyframe)
  - Select 2.0x → fastest playback (1 sec/keyframe)

#### 4.6 Reset to Home
- [ ] Move robot to arbitrary pose (apply different keyframe)
- [ ] Click **"Reset to Home"** button (🔄 icon)
- [ ] Robot returns to:
  - "home" keyframe (if exists), OR
  - First keyframe in list, OR
  - All joints to zero (if no keyframes)

**Visual Verification:**
- [ ] All joint movements smooth (no jittering)
- [ ] No body parts detaching/floating
- [ ] Coordinate system correct (Z-up)
- [ ] End effector reaches expected positions

---

### Phase 5: Joint Jogging Panel Testing ✓
**Goal:** Manual joint control for fine-tuning poses

#### 5.1 Joint Jogging Panel Display
**Kinematics Panel → Robot Jogging Section (below Keyframe Playback)**

- [ ] Section header: "Joint Control" or similar
- [ ] List of all movable joints:
  - Joint name
  - Current angle/position value
  - Slider control
  - +/- buttons (optional)

#### 5.2 Joint Slider Control
For each joint:
- [ ] **Drag slider** → robot joint moves in real-time
- [ ] Value display updates (degrees or meters)
- [ ] Joint limits respected (if defined)
- [ ] Visual feedback in 3D viewport

**Console Check:**
```javascript
[FK Solver] Updating joint 'joint_name' to value: X.XX
```

#### 5.3 Joint Limits Validation
- [ ] Try to move joint beyond defined limit
- [ ] Slider stops at limit (does not exceed)
- [ ] OR shows warning if limits not enforced

#### 5.4 Combined Motion Test
- [ ] Move multiple joints simultaneously
- [ ] Robot updates smoothly (no lag)
- [ ] FK solver calculates correct poses
- [ ] No console errors

**Performance Check:**
- [ ] Smooth 60 FPS during jogging
- [ ] No stutter or freeze
- [ ] Responsive input (no input lag)

---

### Phase 6: Coordinate System Verification ✓
**Goal:** Ensure Z-up coordinate system throughout

#### 6.1 Visual Axis Check
- [ ] Z-axis points UP (vertical)
- [ ] X-axis and Y-axis in horizontal plane
- [ ] Grid floor perpendicular to Z-axis
- [ ] Coordinate frame widget shows Z-up (if visible)

#### 6.2 Import Orientation
- [ ] Imported MJCF model upright (not sideways/upside-down)
- [ ] Keyframe poses maintain correct orientation
- [ ] Joint rotations follow right-hand rule

#### 6.3 Transform Display
**Bottom-right Transform Display (when object selected)**

- [ ] Select robot root node
- [ ] Transform display shows:
  - X, Y, Z position (mm)
  - RX, RY, RZ rotation (degrees)
- [ ] Values match expected coordinate system

**Console Check:**
```javascript
[MJCF Coordinate] Converting position: [x, y, z] → [x', y', z']
[MJCF Coordinate] Converting quaternion: [w, x, y, z] → [w', x', y', z']
```

---

### Phase 7: Error Handling & Edge Cases ✓

#### 7.1 Invalid File Import
- [ ] Try importing non-MJCF file (.txt, .jpg)
- [ ] Shows error toast notification
- [ ] Console shows clear error message
- [ ] UI remains stable (no crash)

#### 7.2 Corrupted MJCF File
- [ ] Import incomplete/corrupted ZIP
- [ ] Shows error toast with details
- [ ] Loading status shows "Failed" state
- [ ] Can retry with valid file

#### 7.3 No Keyframes in Model
- [ ] Import MJCF model WITHOUT keyframe data
- [ ] Keyframe Playback Panel shows:
  - "No keyframes available" message
  - Empty state UI
- [ ] Joint jogging still works
- [ ] No console errors

#### 7.4 Empty Scene State
- [ ] Close all models (Clear World)
- [ ] Kinematics Panel shows:
  - "Select a kinematic device from the scene tree"
  - Empty state UI
- [ ] No errors or crashes

#### 7.5 Multi-Robot Scenario
- [ ] Import TWO different MJCF models
- [ ] Kinematics Panel shows list of both robots
- [ ] Can switch between robots
- [ ] Each robot has independent keyframes
- [ ] No cross-contamination of joint states

---

### Phase 8: Type Checking & Build Verification ✓

#### 8.1 TypeScript Type Check
```bash
npm run type-check
```

**Expected Output:**
- [ ] ✅ No TypeScript errors
- [ ] All files compile successfully
- [ ] No `any` type warnings (if strict mode)

**If Errors Found:**
- [ ] Note file paths and line numbers
- [ ] Fix type mismatches
- [ ] Re-run type-check until clean

#### 8.2 Production Build
```bash
npm run build
```

**Expected Output:**
- [ ] ✅ Build completes without errors
- [ ] Vite bundle size reasonable (<5MB for main chunk)
- [ ] No warnings about missing dependencies

**If Build Fails:**
- [ ] Check error output carefully
- [ ] Fix import issues (circular dependencies, missing modules)
- [ ] Re-run build until successful

#### 8.3 Build Preview
```bash
npm run preview
```

**Expected Behavior:**
- [ ] Preview server starts on port 4173
- [ ] Application loads correctly
- [ ] Same functionality as dev mode
- [ ] No production-specific errors

---

## Success Criteria Summary

### ✅ PASS Criteria
All of the following must be true:

1. **MJCF Import:**
   - ✅ ZIP file imports without errors
   - ✅ 3D model renders correctly (Z-up)
   - ✅ Scene tree updates with hierarchy
   - ✅ Keyframes registered

2. **Kinematics Panel:**
   - ✅ Auto-discovers robots
   - ✅ Shows robot name + joint count
   - ✅ Pin/unpin works correctly
   - ✅ Updates with scene selection

3. **Keyframe Playback:**
   - ✅ Lists all keyframes
   - ✅ Apply Pose works (idempotent)
   - ✅ Playback controls functional
   - ✅ Loop and speed options work
   - ✅ Reset to Home works

4. **Joint Jogging:**
   - ✅ Sliders update robot pose
   - ✅ Real-time visual feedback
   - ✅ Joint limits respected
   - ✅ Smooth 60 FPS performance

5. **Build Quality:**
   - ✅ Type-check passes
   - ✅ Build completes
   - ✅ No console errors in production

### ❌ FAIL Criteria
Any of the following means test fails:

- ❌ Console errors during normal workflow
- ❌ Visual glitches (missing meshes, wrong orientation)
- ❌ Unresponsive UI (frozen buttons, no feedback)
- ❌ Keyframe double-application (not idempotent)
- ❌ Build failures or type errors
- ❌ Performance issues (<30 FPS during jogging)

---

## Debugging Quick Reference

### Common Issues & Fixes

**Issue:** MJCF model imports but appears sideways
- **Fix:** Check [MJCFCoordinateSystem.ts](../src/loaders/mjcf/MJCFCoordinateSystem.ts)
- **Console:** Look for "Converting position/quaternion" logs

**Issue:** Keyframe Playback Panel empty despite keyframes in XML
- **Fix:** Check [MJCFKeyframeManager.ts](../src/loaders/mjcf/MJCFKeyframeManager.ts) → `registerKeyframes`
- **Console:** Look for "Registered X keyframes" log

**Issue:** Kinematics Panel doesn't discover robot
- **Fix:** Check [KinematicsPanel.tsx](../src/ui/components/KinematicsPanel.tsx) → `discoverRobots` effect
- **Console:** Look for "Auto-grounding robot" log

**Issue:** Joint jogging doesn't move robot
- **Fix:** Check [ForwardKinematicsSolver](../src/kinematics/ForwardKinematicsSolver.ts) → `updateJointPosition`
- **Console:** Look for "FK Solver" logs

**Issue:** Apply Pose button applies keyframe multiple times
- **Fix:** Check [KeyframePlaybackPanel.tsx](../src/ui/components/KeyframePlaybackPanel.tsx) → `hasBeenApplied` logic
- **Console:** Should show "already applied, skipping" on repeat clicks

---

## Testing Frequency

**Pre-Commit:** Run type-check before every commit
**Pre-PR:** Full E2E test before pull request
**Daily:** Quick smoke test during active development
**Release:** Complete E2E + build verification

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Commit changes with clean message
2. Update [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
3. Create PR with test results summary
4. Move to next feature/enhancement

### If Tests Fail ❌
1. Document failure in issue tracker
2. Add console logs for debugging
3. Fix root cause (not symptoms)
4. Re-test from beginning
5. Only proceed when clean

---

## Notes for Future Enhancement

**Not in Scope for Essential Mode:**
- Inverse kinematics (IK solver)
- Path planning/trajectory optimization
- Multi-robot synchronization
- Advanced physics simulation
- Scripting/automation

**These features belong in Professional/Expert modes.**

---

**Last Updated:** 2025-10-18
**Maintainer:** George (Architecture Lead)
**Status:** Active Testing Protocol
