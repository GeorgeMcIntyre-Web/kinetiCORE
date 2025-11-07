# Professional Mode - Comprehensive Functional Test Plan

**Test Date:** 2025-11-02
**Tester:** Claude Code (Agent 1) + Codex (Agent 1)
**Branch:** `feature/smart-routing-system`
**Environment:** Local Development (http://localhost:5173)

---

## 🎯 Test Objectives

1. **Verify all UI features are connected and functional**
2. **Test all buttons trigger correct actions**
3. **Monitor DevTools Console for proper logging**
4. **Validate viewport visibility and 3D rendering**
5. **Ensure all panels are interactive and responsive**
6. **Document detailed findings for Codex Agent 1**

---

## 📋 Pre-Test Setup

### 1. Start Development Server
```bash
npm run dev
# Expected: Server starts on http://localhost:5173
```

### 2. Open Browser with DevTools
```bash
# Open in Chrome/Edge
# Press F12 to open DevTools
# Select Console tab
# Clear console (Ctrl+L)
```

### 3. Verify Initial State
- [ ] Application loads without errors
- [ ] Professional Mode is active by default
- [ ] Viewport (3D canvas) is visible
- [ ] All 4 panels are docked correctly
- [ ] Quick Route Presets ribbon is visible at top

---

## 🧪 Test Cases

### Test Group 1: Quick Route Preset Buttons

**Location:** Top ribbon bar, 5 buttons
**Expected Console Logs:** `[QuickRoutePresets]` messages

#### Test 1.1: Electrical Route Button
**Steps:**
1. Clear DevTools console (Ctrl+L)
2. Click "Electrical" button in ribbon
3. Monitor console output

**Expected Console Output:**
```
[QuickRoutePresets] Creating electrical route from Vector3(...) to Vector3(...)
[QuickRoutePresets] Executing connection point commands...
[QuickRoutePresets] Found connection points, creating route...
[QuickRoutePresets] Generating geometry for route...
[QuickRoutePresets] Route creation complete!
```

**Expected Visual Output:**
- [ ] Yellow cylinder appears in viewport (electrical conduit)
- [ ] Two green spheres at endpoints (connection points)
- [ ] Debug label appears above route showing specifications
- [ ] No errors in console (red text)

**Details to Record:**
- Route position: `_________`
- Route color: `_________`
- Diameter: `_________`
- Debug label text: `_________`

---

#### Test 1.2: Pipe Route Button
**Steps:**
1. Clear DevTools console
2. Click "Pipe" button in ribbon
3. Monitor console output

**Expected Console Output:**
```
[QuickRoutePresets] Creating pipe route from Vector3(...) to Vector3(...)
[QuickRoutePresets] Executing connection point commands...
[QuickRoutePresets] Found connection points, creating route...
[QuickRoutePresets] Generating geometry for route...
[QuickRoutePresets] Route creation complete!
```

**Expected Visual Output:**
- [ ] Gray tube appears in viewport (pipe)
- [ ] Two connection points (green spheres)
- [ ] Debug label with pipe specifications
- [ ] No console errors

**Details to Record:**
- Pipe schedule: `_________`
- Material: `_________`
- Pressure rating: `_________`

---

#### Test 1.3: Cable Tray Button
**Steps:**
1. Clear console
2. Click "Cable Tray" button
3. Monitor output

**Expected Console Output:**
```
[QuickRoutePresets] Creating cable_tray route from Vector3(...) to Vector3(...)
[QuickRoutePresets] Executing connection point commands...
[QuickRoutePresets] Found connection points, creating route...
[QuickRoutePresets] Generating geometry for route...
[QuickRoutePresets] Route creation complete!
```

**Expected Visual Output:**
- [ ] Metallic box-shaped tray appears
- [ ] Connection points visible
- [ ] Debug label shows dimensions (width × height)
- [ ] No errors

**Details to Record:**
- Tray dimensions: `_________`
- Load capacity: `_________`
- Material: `_________`

---

#### Test 1.4: Conduit Button
**Steps:**
1. Clear console
2. Click "Conduit" button
3. Monitor output

**Expected Console Output:**
```
[QuickRoutePresets] Creating conduit route from Vector3(...) to Vector3(...)
[QuickRoutePresets] Executing connection point commands...
[QuickRoutePresets] Found connection points, creating route...
[QuickRoutePresets] Generating geometry for route...
[QuickRoutePresets] Route creation complete!
```

**Expected Visual Output:**
- [ ] Orange cylinder appears (EMT conduit)
- [ ] Connection points
- [ ] Debug label with trade size
- [ ] No errors

**Details to Record:**
- Trade size: `_________`
- Fill ratio: `_________`
- Material: `_________`

---

#### Test 1.5: Mixed Sample Button
**Steps:**
1. Clear console
2. Click "Mixed Sample" button
3. Monitor output
4. Count routes created

**Expected Console Output:**
```
[QuickRoutePresets] Creating electrical route from Vector3(...) to Vector3(...)
...
[QuickRoutePresets] Route creation complete!
[QuickRoutePresets] Creating pipe route from Vector3(...) to Vector3(...)
...
[QuickRoutePresets] Route creation complete!
[QuickRoutePresets] Creating cable_tray route from Vector3(...) to Vector3(...)
...
[QuickRoutePresets] Route creation complete!
[QuickRoutePresets] Creating conduit route from Vector3(...) to Vector3(...)
...
[QuickRoutePresets] Route creation complete!
```

**Expected Visual Output:**
- [ ] 4 different routes visible (yellow, gray, metallic, orange)
- [ ] All connection points visible (8 total - 2 per route)
- [ ] 4 debug labels
- [ ] No errors

**Details to Record:**
- Total routes created: `_________`
- Total connection points: `_________`
- Scene performance (FPS): `_________`

---

### Test Group 2: Panel Functionality

**Location:** Docked panels around viewport
**DevTools Tab:** Console + Elements

#### Test 2.1: Route Editing Panel (Right Side)
**Steps:**
1. Click "Electrical" preset to create a route
2. Locate Route Editing Panel (right side)
3. Inspect panel contents

**Expected Panel Contents:**
- [ ] Route type selector dropdown
- [ ] Specification inputs (voltage, current, wire gauge, etc.)
- [ ] "Create Route" button
- [ ] "Update Route" button
- [ ] "Delete Route" button

**Interaction Tests:**
1. **Change Route Type:**
   - Select "Pipe" from dropdown
   - Expected: Specification fields update to pipe specs

2. **Update Specifications:**
   - Modify voltage value (e.g., 240V)
   - Click "Update Route"
   - Expected: Route updates, console logs update command

3. **Delete Route:**
   - Click "Delete Route"
   - Expected: Route disappears from viewport

**Details to Record:**
- Panel visible: `YES / NO`
- Dropdown functional: `YES / NO`
- Inputs editable: `YES / NO`
- Buttons clickable: `YES / NO`
- Console logs on update: `_________`

---

#### Test 2.2: Templates Library Panel (Left Side)
**Steps:**
1. Locate Templates Library Panel (left side)
2. Inspect available templates

**Expected Panel Contents:**
- [ ] Template categories (Electrical, Mechanical, HVAC, Industrial)
- [ ] Template list with names
- [ ] "Apply Template" buttons
- [ ] Template preview/description

**Interaction Tests:**
1. **Browse Templates:**
   - Click different categories
   - Expected: Template list updates

2. **Apply Template:**
   - Click "Apply" on a template
   - Expected: Route created based on template specs

**Details to Record:**
- Panel visible: `YES / NO`
- Template count: `_________`
- Categories visible: `_________`
- Apply button functional: `YES / NO`

---

#### Test 2.3: Statistics Dashboard (Bottom Panel)
**Steps:**
1. Create multiple routes (use Mixed Sample)
2. Locate Statistics Dashboard (bottom)
3. Monitor statistics updates

**Expected Panel Contents:**
- [ ] Total routes count
- [ ] Route type breakdown (pie chart or list)
- [ ] Total length calculation
- [ ] Material usage summary
- [ ] Cost estimation

**Expected Updates:**
- [ ] Statistics update after each route creation
- [ ] Counts are accurate
- [ ] Length calculations correct

**Details to Record:**
- Panel visible: `YES / NO`
- Total routes shown: `_________`
- Updates in real-time: `YES / NO`
- Cost estimation visible: `YES / NO`

---

#### Test 2.4: Validation & Warnings Panel (Top Bar)
**Steps:**
1. Create overlapping routes (if possible)
2. Locate Validation & Warnings panel
3. Check for warnings

**Expected Panel Contents:**
- [ ] Validation status indicators
- [ ] Warning messages (if any)
- [ ] Error highlights
- [ ] Suggested fixes

**Test Scenarios:**
1. **Valid Route:**
   - Create single route
   - Expected: Green checkmark or "No issues"

2. **Invalid Configuration:**
   - Attempt incompatible connection
   - Expected: Warning message displayed

**Details to Record:**
- Panel visible: `YES / NO`
- Warnings displayed correctly: `YES / NO`
- Error messages clear: `YES / NO`

---

### Test Group 3: Mode Selector & UI Layout

#### Test 3.1: Mode Selector Dropdown
**Steps:**
1. Locate mode selector in header (top-right)
2. Click dropdown
3. Test mode switching

**Expected Behavior:**
- [ ] Dropdown appears aligned to right (not left)
- [ ] Shows 3 modes: Essential, Professional, Advanced
- [ ] Professional is selected by default
- [ ] Switching modes changes UI layout

**Interaction Tests:**
1. **Switch to Essential:**
   - Click "Essential Mode"
   - Expected: UI simplifies, some panels hide

2. **Switch to Advanced:**
   - Click "Advanced Mode"
   - Expected: More panels/options appear

3. **Return to Professional:**
   - Click "Professional Mode"
   - Expected: 4-panel layout restored

**Details to Record:**
- Dropdown position: `LEFT / RIGHT / CENTER`
- Default mode: `_________`
- Mode switching works: `YES / NO`
- Layout changes correctly: `YES / NO`

---

#### Test 3.2: Viewport Visibility
**Steps:**
1. Ensure Professional Mode active
2. Check 3D viewport visibility
3. Test camera controls

**Expected Viewport State:**
- [ ] Babylon.js canvas visible (not black)
- [ ] Grid visible
- [ ] Camera responds to mouse (orbit, pan, zoom)
- [ ] Routes render correctly
- [ ] No z-index issues (panels don't cover viewport)

**Camera Control Tests:**
1. **Orbit:** Left-click drag
2. **Pan:** Middle-click drag or Right-click drag
3. **Zoom:** Scroll wheel

**DevTools Performance Check:**
1. Open Performance tab
2. Record for 5 seconds while orbiting camera
3. Check FPS (should be ~60)

**Details to Record:**
- Viewport visible: `YES / NO`
- Canvas color: `_________`
- Grid visible: `YES / NO`
- Camera controls work: `YES / NO`
- FPS: `_________`
- Frame drops: `YES / NO`

---

#### Test 3.3: Panel Docking & Resizing
**Steps:**
1. Test panel drag/drop
2. Test panel resize
3. Test panel minimize/maximize

**Expected Docking Behaviors:**
- [ ] Panels can be dragged by title bar
- [ ] Panels can be docked to different positions
- [ ] Panels can be resized by dragging edges
- [ ] Panels can be minimized
- [ ] Panels can be floating

**Interaction Tests:**
1. **Drag Panel:**
   - Drag Route Editing panel to left
   - Expected: Panel moves, docking indicators appear

2. **Resize Panel:**
   - Drag panel edge to resize
   - Expected: Panel resizes smoothly

3. **Float Panel:**
   - Drag panel out of docking area
   - Expected: Panel becomes floating window

**Details to Record:**
- Drag works: `YES / NO`
- Resize works: `YES / NO`
- Float works: `YES / NO`
- Docking indicators visible: `YES / NO`

---

### Test Group 4: Integration & Workflow

#### Test 4.1: Complete Routing Workflow
**Steps (10-Step Workflow):**

1. **Start Fresh:**
   - Refresh page (F5)
   - Verify Professional Mode active
   - Clear console

2. **Create Connection Point A:**
   - (If manual creation available)
   - Position: (0, 0, 0)
   - Type: Source

3. **Create Connection Point B:**
   - Position: (5, 0, 0)
   - Type: Destination

4. **Select Route Type:**
   - Open Route Editing panel
   - Select "Electrical"

5. **Set Specifications:**
   - Voltage: 120V
   - Current: 20A
   - Wire Gauge: AWG 12

6. **Create Route:**
   - Click "Create Route"
   - Expected: Console logs route creation

7. **Generate Geometry:**
   - (Should happen automatically)
   - Expected: Yellow cylinder appears

8. **Verify Route:**
   - Check Statistics panel (count = 1)
   - Check Validation panel (no warnings)

9. **Update Route:**
   - Change voltage to 240V
   - Click "Update Route"
   - Expected: Route updates, console logs

10. **Delete Route:**
    - Click "Delete Route"
    - Expected: Route removed, stats update

**Details to Record:**
- All steps completed: `YES / NO`
- Console logs at each step: `YES / NO`
- Visual feedback correct: `YES / NO`
- Statistics updated: `YES / NO`
- Undo/redo available: `YES / NO`

---

#### Test 4.2: Undo/Redo Functionality
**Steps:**
1. Create a route (Electrical preset)
2. Press Ctrl+Z (Undo)
3. Press Ctrl+Y or Ctrl+Shift+Z (Redo)

**Expected Behavior:**
- [ ] Undo removes route from viewport
- [ ] Undo removes route from stats
- [ ] Redo restores route
- [ ] Console logs undo/redo commands

**Details to Record:**
- Undo works: `YES / NO`
- Redo works: `YES / NO`
- Keyboard shortcuts: `WORKING / NOT WORKING`

---

## 🔍 DevTools Monitoring Checklist

### Console Tab
- [ ] No red errors on page load
- [ ] `[QuickRoutePresets]` logs appear on button clicks
- [ ] `[RouteValidator]` logs appear (if validation runs)
- [ ] Command execution logs visible
- [ ] No warnings about missing dependencies

### Network Tab
- [ ] All assets load successfully (no 404s)
- [ ] No failed API requests
- [ ] Babylon.js libraries loaded
- [ ] Rapier physics loaded

### Performance Tab
- [ ] FPS stays at ~60 during camera movement
- [ ] No long tasks (>50ms)
- [ ] Memory usage stable (no leaks)
- [ ] CPU usage reasonable (<50%)

### Elements Tab
- [ ] Viewport canvas element visible
- [ ] Panels have correct z-index layering
- [ ] CSS classes applied correctly
- [ ] No overlapping elements

---

## 📊 Test Results Template

### Overall Status
- **Total Tests Planned:** 25
- **Tests Passed:** `___ / 25`
- **Tests Failed:** `___ / 25`
- **Tests Skipped:** `___ / 25`

### Critical Issues Found
1. `_________________________________________`
2. `_________________________________________`
3. `_________________________________________`

### Minor Issues Found
1. `_________________________________________`
2. `_________________________________________`
3. `_________________________________________`

### Performance Metrics
- **Average FPS:** `_________`
- **Page Load Time:** `_________`
- **Route Creation Time:** `_________`
- **Memory Usage:** `_________`

### Feature Completion
- **Quick Presets:** `WORKING / PARTIAL / NOT WORKING`
- **Route Editing Panel:** `WORKING / PARTIAL / NOT WORKING`
- **Templates Panel:** `WORKING / PARTIAL / NOT WORKING`
- **Statistics Panel:** `WORKING / PARTIAL / NOT WORKING`
- **Validation Panel:** `WORKING / PARTIAL / NOT WORKING`
- **Mode Selector:** `WORKING / PARTIAL / NOT WORKING`
- **Viewport Rendering:** `WORKING / PARTIAL / NOT WORKING`
- **Panel Docking:** `WORKING / PARTIAL / NOT WORKING`
- **Undo/Redo:** `WORKING / PARTIAL / NOT WORKING`

---

## 🎯 Success Criteria

### Must Have (Blocking Issues):
- [ ] All 5 Quick Preset buttons create routes
- [ ] Viewport is visible (not black)
- [ ] Console shows proper logging
- [ ] No critical errors in console
- [ ] At least 3 of 4 panels are functional

### Should Have (Important but not blocking):
- [ ] All 4 panels fully functional
- [ ] Statistics update in real-time
- [ ] Undo/redo works
- [ ] Mode selector switches modes
- [ ] Panel docking/resizing works

### Nice to Have (Enhancement):
- [ ] Smooth animations
- [ ] Consistent styling
- [ ] Helpful tooltips
- [ ] Keyboard shortcuts documented

---

## 📝 Detailed Findings Report

### Finding #1: [ISSUE TITLE]
**Severity:** `CRITICAL / MAJOR / MINOR / COSMETIC`
**Component:** `_________`
**Steps to Reproduce:**
1. `_________`
2. `_________`
3. `_________`

**Expected Behavior:** `_________`
**Actual Behavior:** `_________`
**Console Output:**
```
[Paste console output here]
```

**Screenshot:** `[Attach if available]`
**Suggested Fix:** `_________`

---

### Finding #2: [ISSUE TITLE]
**Severity:** `CRITICAL / MAJOR / MINOR / COSMETIC`
**Component:** `_________`
**Steps to Reproduce:**
1. `_________`
2. `_________`

**Expected Behavior:** `_________`
**Actual Behavior:** `_________`
**Console Output:**
```
[Paste console output here]
```

---

## 🚀 Next Steps After Testing

### If All Tests Pass:
1. Document test results
2. Create final test report
3. Prepare for merge to main
4. Deploy to production

### If Tests Fail:
1. Prioritize issues (Critical → Major → Minor)
2. Create bug fix tasks
3. Assign to appropriate agent
4. Retest after fixes

---

## 📞 Reporting

**Report To:** George (Architecture Lead)
**Format:** Detailed findings with console logs and screenshots
**Timeline:** Complete testing within 2 hours
**Follow-up:** Address critical issues immediately

---

**Tester Signature:** Claude Code (Agent 1) + Codex (Agent 1)
**Test Start Time:** `_________`
**Test End Time:** `_________`
**Total Duration:** `_________`

---

*This test plan ensures comprehensive validation of all Professional Mode features with proper DevTools monitoring.*
