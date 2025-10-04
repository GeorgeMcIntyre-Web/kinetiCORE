# kinetiCORE - Testing Guide

## 🧪 Quick Test Suite

### Test 1: URDF Auto-Extraction with Fanuc Robot

**Objective:** Verify that URDF files automatically create kinematic joints

**Test Data:**
- **Robot:** Fanuc LRMate200iB (6-DOF industrial arm)
- **Location:** `C:\Users\George\source\repos\kinetiCORE_DATA\urdf_test_robots\urdf_files_dataset\urdf_files\matlab\fanuc_lrmate200ib`

**Steps:**

1. **Start Dev Server**
   ```bash
   npm run dev
   ```

2. **Open Browser**
   ```
   http://localhost:5173
   ```

3. **Import URDF**
   - Click toolbar **Import** button
   - Select **"Import URDF Folder"**
   - Navigate to Fanuc folder
   - Select ALL files (Ctrl+A)
   - Click **Open**

4. **Watch Console Output**
   ```
   Expected console messages:

   Found URDF: fanuc_lrmate200ib.urdf
   Total files: X
   Found 6 joints in URDF                    ← Joint extraction!
   Mapped 7 links to scene nodes              ← Link mapping!
   Grounding base link: base_link             ← Auto-ground!
   Created joint: joint_1 (revolute) ...      ← Joint 1
   Created joint: joint_2 (revolute) ...      ← Joint 2
   Created joint: joint_3 (revolute) ...      ← Joint 3
   Created joint: joint_4 (revolute) ...      ← Joint 4
   Created joint: joint_5 (revolute) ...      ← Joint 5
   Created joint: joint_6 (revolute) ...      ← Joint 6
   ✅ Created 6/6 joints from URDF             ← SUCCESS!
   ```

5. **Verify Toast Notification**
   ```
   ✅ "Imported URDF robot with 8 meshes + kinematics! 🤖"
   ```

6. **Open Kinematics Panel**
   - Click right sidebar **Kinematics** tab
   - Should show **6 joints** in the list
   - Base part should already be grounded (Step 2: complete)
   - Should be on Step 4: "Test Motion"

7. **Test Joint Motion**
   - Move any joint slider
   - Robot arm should move in real-time! ✨
   - Click **▶** to animate joint
   - Click **↺** to reset joint

**Pass Criteria:**
- ✅ All 6 joints created automatically
- ✅ Base link grounded automatically
- ✅ Kinematics panel shows 6 joints
- ✅ Sliders move robot in real-time
- ✅ No console errors

---

### Test 2: WebGPU Detection

**Objective:** Verify WebGPU engine detection and fallback

**Browser Requirements:**
- **WebGPU Supported:** Chrome 113+, Edge 113+, Chrome Canary
- **WebGL Fallback:** Any modern browser

**Steps:**

1. **Open DevTools**
   ```
   Press F12 (Windows) or Cmd+Opt+I (Mac)
   ```

2. **Check Console on Page Load**
   ```
   Expected (WebGPU supported):
   🚀 Initializing WebGPU engine...
   ✅ WebGPU engine ready

   Expected (WebGPU not supported):
   Using WebGL2 engine (WebGPU not supported)
   ```

3. **Verify Engine Type in Console**
   ```javascript
   // Type in console:
   SceneManager.getInstance().getRenderingEngineName()

   Expected output:
   "WebGPU"  // or "WebGL2"
   ```

4. **Check Engine Status**
   ```javascript
   SceneManager.getInstance().isWebGPU()

   Expected output:
   true  // or false
   ```

5. **Force WebGL Mode (Testing Fallback)**
   ```javascript
   // In console:
   localStorage.setItem('preferWebGPU', 'false');
   location.reload();

   Expected console output after reload:
   Using WebGL2 engine (user preference)
   ```

6. **Re-enable WebGPU**
   ```javascript
   localStorage.removeItem('preferWebGPU');
   location.reload();
   ```

**Pass Criteria:**
- ✅ Engine type correctly detected
- ✅ WebGPU works (if browser supports it)
- ✅ WebGL2 fallback works
- ✅ User preference setting works
- ✅ No rendering errors in either mode

---

### Test 3: Forward Kinematics Motion

**Objective:** Verify joint sliders actually move meshes

**Prerequisites:** URDF imported with joints (Test 1)

**Steps:**

1. **Open Kinematics Panel**
   - Right sidebar → Kinematics tab

2. **Navigate to "Test Motion" Step**
   - Should auto-advance after import
   - Or click through workflow steps

3. **Test Each Joint**
   ```
   For each joint (joint_1 through joint_6):

   ✅ Move slider left → Robot part rotates counterclockwise
   ✅ Move slider right → Robot part rotates clockwise
   ✅ Slider shows current angle in degrees (e.g., "45.0°")
   ✅ Motion is smooth (60 FPS)
   ✅ Child joints follow parent motion (kinematic chain)
   ```

4. **Test Reset Button**
   - Click **↺** on any joint
   - Joint should return to 0° instantly

5. **Test Animate Button**
   - Click **▶** on any joint
   - Joint should smoothly animate from current position to limit and back
   - Animation duration: ~2 seconds
   - Motion should have easing (smooth start/stop)

6. **Test Reset All**
   - Move multiple joints to random positions
   - Click **"Reset All to Home"** button
   - All joints should return to 0° simultaneously

7. **Test Joint Limits**
   - Try to move slider beyond limits
   - Slider should clamp to min/max values
   - Joint should not move beyond limits

**Pass Criteria:**
- ✅ All 6 joints move robot parts correctly
- ✅ Kinematic chain updates (parent → child)
- ✅ No mesh jittering or glitches
- ✅ Reset functions work
- ✅ Animate functions work
- ✅ Limits enforced

---

### Test 4: Visual Joint Indicators

**Objective:** Verify joint axis visualization

**Prerequisites:** URDF imported with joints

**Steps:**

1. **Enable Joint Visualization** (Future Feature)
   - Currently: Joint axes auto-shown on creation
   - Visual: Orange sphere at joint origin
   - Visual: Yellow arrow showing rotation axis
   - Visual: Cyan arc showing joint limits

2. **Verify Visuals**
   ```
   For each joint:
   ✅ Orange sphere visible at joint location
   ✅ Yellow arrow points along rotation axis
   ✅ Arrow length proportional to robot size
   ✅ Visuals update when joint moves
   ```

**Pass Criteria:**
- ✅ Joint origin markers visible
- ✅ Axis arrows visible
- ✅ Correct orientation
- ✅ No visual artifacts

---

### Test 5: Save/Load World

**Objective:** Verify local file persistence

**Steps:**

1. **Create a Scene**
   - Import URDF robot
   - Move some joints to non-zero positions
   - Add a primitive object (box, sphere, etc.)

2. **Save World**
   - Toolbar → **Save** (or future menu)
   - Browser downloads `robot_scene_<timestamp>.kicore`
   - Check file size (should be ~50-500 KB)

3. **Modify Scene**
   - Delete an object
   - Move joints to different positions

4. **Load World**
   - Toolbar → **Load** (or drag file into browser)
   - Select the `.kicore` file from Downloads
   - Scene should restore to saved state

5. **Verify Restoration**
   ```
   ✅ Robot model restored
   ✅ All joints restored to saved positions
   ✅ Added objects restored
   ✅ Deleted objects NOT present (before load)
   ✅ Kinematics state preserved
   ```

**Pass Criteria:**
- ✅ File saves successfully
- ✅ File loads successfully
- ✅ All state restored correctly
- ✅ No data loss

---

### Test 6: Multi-Selection & Boolean Operations

**Objective:** Verify existing features still work with kinematics

**Steps:**

1. **Multi-Select**
   - Hold Ctrl (Windows) or Cmd (Mac)
   - Click multiple objects in scene tree
   - All selected objects highlighted in 3D view

2. **Boolean Union** (with kinematics)
   - Select 2 robot links
   - Toolbar → **Union** operation
   - Result: Single merged mesh
   - Verify joint motion still works

3. **Undo/Redo**
   - Perform Boolean operation
   - Ctrl+Z to undo
   - Ctrl+Y to redo
   - State should restore correctly

**Pass Criteria:**
- ✅ Multi-selection works
- ✅ Boolean operations work
- ✅ Undo/redo works
- ✅ Kinematics preserved after operations

---

## 🐛 Known Issues & Workarounds

### Issue 1: URDF Meshes Not Found
**Symptom:** URDF loads but shows placeholder boxes

**Cause:** Mesh files (.stl, .dae) not in same folder as .urdf

**Fix:**
1. Select ENTIRE URDF folder (including meshes subfolder)
2. Or use "Import URDF Folder" (not single file)

### Issue 2: WebGPU Black Screen
**Symptom:** Scene is black after WebGPU init

**Cause:** Driver issue or unsupported GPU

**Fix:**
```javascript
localStorage.setItem('preferWebGPU', 'false');
location.reload();
```

### Issue 3: Joint Sliders Not Moving Robot
**Symptom:** Sliders move but robot doesn't

**Cause:** ForwardKinematicsSolver not initialized

**Fix:** Refresh page and re-import URDF

### Issue 4: Console Errors During Import
**Symptom:** Red errors in console during URDF import

**Common Causes:**
- URDF XML syntax error → Check URDF file validity
- Missing mesh files → Ensure meshes folder included
- Unsupported joint type → Check console for specific type

---

## 📊 Performance Benchmarks

### Target Performance (60 FPS)

| Scenario | WebGL2 | WebGPU | Status |
|----------|--------|--------|--------|
| **Single robot (6 DOF)** | 60 FPS | 60 FPS | ✅ Pass |
| **10 primitives** | 60 FPS | 60 FPS | ✅ Pass |
| **100 primitives** | 45 FPS | 55 FPS | ⚠️ Acceptable |
| **500 primitives** | 20 FPS | 50 FPS | 🚀 WebGPU wins |
| **1000 primitives** | 10 FPS | 35 FPS | 🚀 WebGPU wins |

**How to Test:**
```javascript
// Create 100 random boxes
for (let i = 0; i < 100; i++) {
  editorStore.getState().createObject('box');
}

// Check FPS in browser DevTools:
// Rendering tab → Frame rate
```

---

## 🎯 Regression Test Checklist

**Before each release, verify:**

- [ ] URDF import works
- [ ] Joints auto-created
- [ ] Base auto-grounded
- [ ] Joint motion works
- [ ] Visual indicators visible
- [ ] Save/load works
- [ ] WebGPU detection works
- [ ] WebGL fallback works
- [ ] Multi-selection works
- [ ] Boolean operations work
- [ ] Undo/redo works
- [ ] No console errors
- [ ] 60 FPS with single robot

**Pass rate required:** 12/12 (100%)

---

## 🚀 Next Testing Phase

### When Cloud Storage Added (Week 5-6):

**Additional Tests:**
- [ ] Cloud save works
- [ ] Cloud load works
- [ ] Auth (Google OAuth) works
- [ ] Auth (Email/Password) works
- [ ] Anonymous mode works
- [ ] Row-level security enforced
- [ ] Version history works
- [ ] Auto-save works

---

*Last Updated: January 2025*
*Owner: George (Architecture Lead) + QA Team*
