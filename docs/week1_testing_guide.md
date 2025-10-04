# Week 1 Testing Guide: UserLevel Implementation

## 🎯 Testing Objective

Verify that the UserLevel system correctly implements progressive disclosure across Essential, Professional, and Expert modes without breaking existing functionality.

---

## 🚀 Quick Start

### **1. Start the Application**
```bash
cd c:\Users\George\source\repos\kinetiCORE
npm run dev
```

Open browser to: **http://localhost:5174**

### **2. Locate the User Level Switcher**
- Look in the **top-right corner** of the screen
- You'll see a dropdown labeled "User Level:"
- Default mode: **Essential**

---

## 📋 Test Plan

### **Test 1: Essential Mode (Default)**

**Purpose:** Verify simplified interface for beginners

**Steps:**
1. Ensure dropdown shows "Essential"
2. Create a box (Toolbar → Objects → Box)
3. Select the box in the 3D viewport
4. Observe the Inspector panel (right sidebar)

**Expected Results:**
- ✅ Object info displayed (name, type)
- ✅ Position controls (X, Y, Z) visible
- ✅ Rotation controls (X, Y, Z) visible
- ✅ Scale controls (X, Y, Z) visible
- ✅ ONE button under Position: "Reset"
- ❌ NO "Center" button
- ❌ NO "Snap" button
- ❌ NO "Quick angles" section
- ✅ Reference frame shows: "Local" and "World" only
- ❌ NO "Custom" button
- ❌ NO "Physics" section

**Visual Check:**
- Inspector should feel clean and uncluttered
- Only essential transform controls visible
- Approximately 11 UI elements total

---

### **Test 2: Professional Mode**

**Purpose:** Verify additional tools for engineers

**Steps:**
1. Select "Professional" from User Level dropdown
2. Box should still be selected
3. Observe Inspector panel changes

**Expected Results:**
- ✅ All Essential features still visible
- ✅ THREE buttons under Position: "Reset", "Center", "Snap"
- ✅ "Quick angles" section appears with 4 buttons (0°, 45°, 90°, 180°)
- ✅ Reference frame still shows only "Local" and "World"
- ❌ NO "Custom" button yet
- ✅ "Physics" section appears at bottom
- ✅ Physics toggle button visible

**Interaction Tests:**
1. Click "Center" button → Box moves to world origin (0,0,0)
2. Change Position Z to 1000mm
3. Click "Snap" button → Position rounds to nearest 100mm
4. Click "90°" quick angle → Box rotates 90° on Z axis
5. Toggle Physics "Enable" → Button turns green
6. Toggle Physics "Disable" → Button turns gray

**Visual Check:**
- Inspector has more options but still organized
- Approximately 16 UI elements total
- All buttons functional

---

### **Test 3: Expert Mode**

**Purpose:** Verify full advanced features

**Steps:**
1. Select "Expert" from User Level dropdown
2. Box should still be selected
3. Observe Inspector panel

**Expected Results:**
- ✅ All Professional features visible
- ✅ Reference frame shows THREE buttons: "Local", "World", "Custom"
- ✅ Custom frame section accessible

**Custom Frame Test:**
1. Click "Custom" button in Reference Frame
2. "Select Feature Type" UI should appear
3. Four options visible: "Object", "Face", "Edge", "Vertex"
4. Click "Face" button
5. Instruction text: "Click on a face in the 3D viewport"
6. Click on a face of the box in viewport
7. Coordinate frame widget appears on selected face
8. Custom frame info shows: "Frame: face (face 0)"
9. "Clear" button visible

**Visual Check:**
- Inspector shows maximum detail
- Approximately 18 UI elements total
- Custom frame UI is clear and intuitive

---

### **Test 4: Level Switching Behavior**

**Purpose:** Verify smooth transitions between modes

**Steps:**
1. Start in Expert mode with custom frame set
2. Switch to Professional mode
3. Switch to Essential mode
4. Switch back to Expert mode

**Expected Results:**

**Expert → Professional:**
- ✅ Custom frame button disappears
- ✅ Custom frame automatically clears
- ✅ Coordinate mode switches to "Local"
- ✅ No console errors

**Professional → Essential:**
- ✅ Center/Snap buttons disappear
- ✅ Quick angles section disappears
- ✅ Physics section disappears
- ✅ Position/Rotation/Scale still work

**Essential → Expert:**
- ✅ All features reappear
- ✅ Custom frame remains cleared (no stale state)
- ✅ UI renders correctly

---

### **Test 5: Functionality Regression**

**Purpose:** Ensure existing features still work

**Test in ALL three modes:**

**Position Controls:**
1. Select box
2. Change X position to 500mm
3. Box moves in viewport ✅
4. Change via arrows/keyboard ✅
5. Click "Reset" → Returns to 0,0,0 ✅

**Rotation Controls:**
1. Change X rotation to 45°
2. Box rotates in viewport ✅
3. Test Y and Z rotation ✅

**Scale Controls:**
1. Change X scale to 2.0
2. Box stretches horizontally ✅
3. Click "Reset" → Returns to 1,1,1 ✅

**Local/World Coordinates:**
1. Switch between Local and World
2. Position values update correctly ✅
3. Both modes functional ✅

**Multiple Objects:**
1. Create sphere and cylinder
2. Select each in turn
3. Inspector updates correctly ✅
4. All controls work for each object ✅

---

### **Test 6: Edge Cases**

**No Selection:**
1. Deselect all objects
2. Inspector shows "No object selected" ✅
3. Level switcher still works ✅

**Rapid Switching:**
1. Quickly switch: Essential → Pro → Expert → Essential
2. No UI glitches ✅
3. No console errors ✅

**Browser Console:**
1. Open DevTools (F12)
2. Check Console tab
3. Should see NO errors (warnings about JIT are ok)
4. No React errors ✅

---

## 🐛 Known Issues / Expected Warnings

### **Console Warnings (OK):**
- `Warning: Label 'JIT TOTAL' already exists` - Tailwind CSS timing, harmless
- Performance warnings about chunk size - Expected for Babylon.js

### **Not Tested Yet:**
- localStorage persistence (Week 2 feature)
- Workspace-specific level defaults (Week 3 feature)
- Multi-monitor layouts (Week 4 feature)

---

## ✅ Success Criteria

**All tests must pass for Week 1 completion:**

- [ ] Essential mode shows 11 UI elements
- [ ] Professional mode shows 16 UI elements
- [ ] Expert mode shows 18 UI elements
- [ ] All transform controls work in all modes
- [ ] Custom frame only appears in Expert mode
- [ ] Physics only appears in Professional+ modes
- [ ] Level switching is instant (<50ms perceived)
- [ ] No console errors during normal use
- [ ] No regression in existing functionality
- [ ] UI is visually clean and organized in all modes

---

## 📊 Visual Comparison Checklist

Print this checklist and verify each mode:

### Essential Mode Inspector:
```
┌─────────────────────────────┐
│ Inspector                   │
├─────────────────────────────┤
│ Object                      │
│   Name: Box_123456789       │
│   Type: box                 │
├─────────────────────────────┤
│ Transform                   │
│ Position (mm)               │
│   [Reset]                   │ ← Only 1 button
│   X: [input]                │
│   Y: [input]                │
│   Z: [input]                │
│ Rotation (degrees)          │
│   X: [input]                │
│   Y: [input]                │
│   Z: [input]                │
│                             │ ← NO quick angles
│ Scale                       │
│   [Reset]                   │
│   X: [input]                │
│   Y: [input]                │
│   Z: [input]                │
│ [Local] [World]             │ ← Only 2 buttons
│                             │ ← NO Physics section
└─────────────────────────────┘
```

### Professional Mode Inspector:
```
┌─────────────────────────────┐
│ Inspector                   │
├─────────────────────────────┤
│ Object                      │
│   Name: Box_123456789       │
│   Type: box                 │
├─────────────────────────────┤
│ Transform                   │
│ Position (mm)               │
│   [Reset][Center][Snap]     │ ← 3 buttons
│   X: [input]                │
│   Y: [input]                │
│   Z: [input]                │
│ Rotation (degrees)          │
│   X: [input]                │
│   Y: [input]                │
│   Z: [input]                │
│ Quick angles:     [Reset]   │ ← Quick angles visible
│   [0°][45°][90°][180°]      │
│ Scale                       │
│   [Reset]                   │
│   X: [input]                │
│   Y: [input]                │
│   Z: [input]                │
│ [Local] [World]             │ ← Still only 2 buttons
├─────────────────────────────┤
│ Physics                     │ ← Physics section visible
│   Enable Physics [Disabled] │
└─────────────────────────────┘
```

### Expert Mode Inspector:
```
┌─────────────────────────────┐
│ Inspector                   │
├─────────────────────────────┤
│ Object                      │
│   Name: Box_123456789       │
│   Type: box                 │
├─────────────────────────────┤
│ Transform                   │
│ Position (mm)               │
│   [Reset][Center][Snap]     │
│   X: [input]                │
│   Y: [input]                │
│   Z: [input]                │
│ Rotation (degrees)          │
│   X: [input]                │
│   Y: [input]                │
│   Z: [input]                │
│ Quick angles:     [Reset]   │
│   [0°][45°][90°][180°]      │
│ Scale                       │
│   [Reset]                   │
│   X: [input]                │
│   Y: [input]                │
│   Z: [input]                │
│ [Local][World][Custom]      │ ← Custom button visible
│ (Custom frame UI when       │
│  Custom mode active)        │
├─────────────────────────────┤
│ Physics                     │
│   Enable Physics [Disabled] │
└─────────────────────────────┘
```

---

## 📸 Screenshot Locations

**For documentation, capture screenshots:**

1. `docs/screenshots/week1_essential_mode.png`
2. `docs/screenshots/week1_professional_mode.png`
3. `docs/screenshots/week1_expert_mode.png`
4. `docs/screenshots/week1_user_level_switcher.png`
5. `docs/screenshots/week1_custom_frame_active.png`

---

## 🔄 Testing Session Report Template

```markdown
## Testing Session: [Date/Time]

**Tester:** [Name]
**Browser:** [Chrome/Firefox/Edge] [Version]
**OS:** [Windows/Mac/Linux]

### Essential Mode
- [ ] UI elements correct (11 total)
- [ ] Transform controls work
- [ ] Issues: [None / List issues]

### Professional Mode
- [ ] UI elements correct (16 total)
- [ ] New features work (Center, Snap, Quick angles, Physics)
- [ ] Issues: [None / List issues]

### Expert Mode
- [ ] UI elements correct (18 total)
- [ ] Custom frame works
- [ ] Issues: [None / List issues]

### Regression Tests
- [ ] All transform controls work
- [ ] No console errors
- [ ] Level switching smooth
- [ ] Issues: [None / List issues]

### Overall Assessment
**Pass/Fail:** [PASS / FAIL]
**Notes:** [Any observations]
```

---

## 🚀 Next Actions After Testing

**If all tests PASS:**
1. Mark Week 1 as complete
2. Capture screenshots for documentation
3. Begin Week 2 planning (BasePanel implementation)
4. Consider user feedback gathering

**If any tests FAIL:**
1. Document failure details
2. Create bug report with steps to reproduce
3. Fix issues before proceeding to Week 2
4. Re-test after fixes

---

## 📞 Support

**Issues to report:**
- TypeScript compilation errors
- Runtime console errors
- UI rendering glitches
- Functionality regressions
- Performance degradation

**What NOT to report yet:**
- Missing localStorage persistence (Week 2 feature)
- Workspace-specific defaults (Week 3 feature)
- Responsive breakpoints (Week 4 feature)

---

## ✅ Testing Complete Checklist

Before marking Week 1 complete:

- [ ] All 6 test sections completed
- [ ] Visual comparison verified for all 3 modes
- [ ] No critical bugs found
- [ ] Screenshots captured
- [ ] Testing session report filled out
- [ ] Regression tests passed
- [ ] Performance acceptable (60 FPS maintained)
- [ ] Ready for Week 2 implementation

---

**Dev Server:** http://localhost:5174
**Testing Duration:** ~30 minutes for comprehensive testing
**Critical Path:** Test 1 → Test 2 → Test 3 → Test 5 (minimum for approval)
