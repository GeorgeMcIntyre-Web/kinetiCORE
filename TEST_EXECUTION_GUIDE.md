# Professional Mode - Test Execution Guide

**🚀 Dev Server Running:** http://localhost:5176
**👥 Testers:** Claude Code (Agent 1) + Codex (Agent 1)
**📅 Date:** 2025-11-02

---

## ✅ Server Status

```
✅ VITE Dev Server: http://localhost:5176 (READY)
✅ USD Converter: http://127.0.0.1:5001 (RUNNING)
✅ Status: ALL SYSTEMS GO
```

---

## 🎯 Quick Test Execution (For Codex Agent 1)

### Step 1: Open Application
```
1. Open browser: http://localhost:5176
2. Press F12 to open DevTools
3. Click Console tab
4. Clear console (Ctrl+L or click 🚫)
```

### Step 2: Verify Initial State
**Check these immediately:**
- [ ] Professional Mode badge visible in header
- [ ] 3D viewport visible (not black screen)
- [ ] 5 Quick Preset buttons visible at top
- [ ] 4 panels docked (Right, Left, Bottom, Top bar)
- [ ] No red errors in console

**Take Screenshot #1:** "Initial Professional Mode Layout"

---

### Step 3: Test Quick Preset Buttons (PRIORITY 1)

#### 🔴 Test 1: Electrical Button
```
1. Clear console (Ctrl+L)
2. Click "Electrical" button (yellow lightning icon)
3. Watch console for logs
4. Check viewport for yellow cylinder
```

**Expected Console Output:**
```
[QuickRoutePresets] Creating electrical route from Vector3(...) to Vector3(...)
[QuickRoutePresets] Executing connection point commands...
[QuickRoutePresets] Found connection points, creating route...
[QuickRoutePresets] Generating geometry for route...
[QuickRoutePresets] Route creation complete!
```

**Expected Visual:**
- Yellow cylinder in viewport (electrical conduit)
- 2 green spheres (connection points)
- Floating label above route

**✅ PASS if:** Console shows all 5 log lines + yellow cylinder visible
**❌ FAIL if:** Console errors OR no geometry appears

**Take Screenshot #2:** "Electrical Route Created"

---

#### 🔵 Test 2: Pipe Button
```
1. Clear console
2. Click "Pipe" button
3. Monitor console + viewport
```

**Expected:**
- Gray tube appears
- Same console log pattern
- No errors

**Take Screenshot #3:** "Pipe Route Created"

---

#### 🟢 Test 3: Cable Tray Button
```
1. Clear console
2. Click "Cable Tray" button
3. Monitor output
```

**Expected:**
- Metallic box-shaped tray
- Console logs
- No errors

**Take Screenshot #4:** "Cable Tray Route Created"

---

#### 🟠 Test 4: Conduit Button
```
1. Clear console
2. Click "Conduit" button
3. Monitor output
```

**Expected:**
- Orange cylinder
- Console logs
- No errors

**Take Screenshot #5:** "Conduit Route Created"

---

#### 🌈 Test 5: Mixed Sample Button
```
1. Refresh page (F5) to clear scene
2. Clear console
3. Click "Mixed Sample" button
4. COUNT routes created
```

**Expected:**
- 4 routes appear (yellow, gray, metallic, orange)
- 8 connection points total
- 4 debug labels
- Console shows 4 complete creation sequences

**Take Screenshot #6:** "Mixed Sample - All 4 Routes"

**📊 Record:**
- Routes created: _____ (should be 4)
- Connection points: _____ (should be 8)
- Console errors: _____ (should be 0)

---

### Step 4: Test Panels (PRIORITY 2)

#### 📌 Right Panel: Route Editing
```
1. Locate panel on right side
2. Check contents visible
3. Try clicking dropdown
```

**Expected Contents:**
- Route type dropdown
- Specification inputs
- Create/Update/Delete buttons

**Test Interaction:**
1. Click route type dropdown
2. Select different type (e.g., Pipe)
3. Verify input fields change

**✅ PASS if:** Dropdown works + fields update
**❌ FAIL if:** Panel not visible OR dropdown broken

**Take Screenshot #7:** "Route Editing Panel"

---

#### 📌 Left Panel: Templates Library
```
1. Locate panel on left side
2. Check for template list
3. Look for categories
```

**Expected:**
- Template categories (Electrical, Mechanical, etc.)
- List of templates
- Apply buttons

**Take Screenshot #8:** "Templates Library Panel"

---

#### 📌 Bottom Panel: Statistics Dashboard
```
1. After creating Mixed Sample (4 routes)
2. Locate bottom panel
3. Check statistics display
```

**Expected:**
- Total routes: 4
- Route type breakdown
- Length calculations
- Material summary

**✅ PASS if:** Statistics show correct counts
**❌ FAIL if:** Panel shows 0 routes or wrong counts

**Take Screenshot #9:** "Statistics Dashboard"

---

#### 📌 Top Bar: Validation & Warnings
```
1. Check top bar area
2. Look for validation status
3. Check for warnings/errors
```

**Expected:**
- Validation indicator (green checkmark if no issues)
- Warning messages (if any)

**Take Screenshot #10:** "Validation & Warnings Panel"

---

### Step 5: Mode Selector Test (PRIORITY 3)

```
1. Locate dropdown in header (TOP-RIGHT corner)
2. Click to open
3. Verify 3 modes listed
4. Test switching
```

**Expected Dropdown Position:** RIGHT-ALIGNED (not left)
**Expected Modes:** Essential, Professional, Advanced
**Default Selected:** Professional

**Test Mode Switch:**
1. Click "Essential Mode"
   - Expected: UI simplifies
2. Click "Professional Mode" to return
   - Expected: 4-panel layout restored

**✅ PASS if:** Dropdown on right + modes switch correctly
**❌ FAIL if:** Dropdown on left OR switching broken

**Take Screenshot #11:** "Mode Selector Dropdown Open"

---

### Step 6: Viewport Visibility Test (PRIORITY 1)

```
1. Create a route (any preset)
2. Test camera controls:
   - Left-click drag: Orbit
   - Right-click drag: Pan
   - Scroll wheel: Zoom
3. Check DevTools Performance tab
```

**Expected:**
- 3D viewport visible (background color visible)
- Grid visible
- Camera responds to mouse
- Route geometry renders correctly

**DevTools Performance Check:**
1. Switch to Performance tab
2. Click Record (⚫)
3. Orbit camera for 5 seconds
4. Stop recording
5. Check FPS (should be ~60)

**✅ PASS if:** Viewport visible + 60 FPS
**❌ FAIL if:** Black screen OR <30 FPS

**Take Screenshot #12:** "Viewport with Camera Controls"

---

### Step 7: Console Log Verification (PRIORITY 1)

**After all tests, review FULL console log:**

**✅ GOOD SIGNS (Expected):**
```
[QuickRoutePresets] Creating ... route
[QuickRoutePresets] Executing connection point commands...
[QuickRoutePresets] Found connection points, creating route...
[QuickRoutePresets] Generating geometry for route...
[QuickRoutePresets] Route creation complete!
```

**❌ BAD SIGNS (Errors):**
```
❌ Uncaught TypeError: ...
❌ Failed to fetch ...
❌ Cannot read property ... of undefined
⚠️ Warning: ...
```

**📊 Count:**
- Total log entries: _____
- `[QuickRoutePresets]` logs: _____
- Errors (red): _____
- Warnings (yellow): _____

**Take Screenshot #13:** "Complete Console Log"

---

## 📊 Test Results Summary

### Quick Checklist
- [ ] 1. Electrical button works
- [ ] 2. Pipe button works
- [ ] 3. Cable Tray button works
- [ ] 4. Conduit button works
- [ ] 5. Mixed Sample button works (creates 4 routes)
- [ ] 6. Route Editing panel visible & functional
- [ ] 7. Templates panel visible
- [ ] 8. Statistics panel shows correct counts
- [ ] 9. Validation panel visible
- [ ] 10. Mode selector dropdown (RIGHT-aligned)
- [ ] 11. Viewport visible (not black)
- [ ] 12. Camera controls work
- [ ] 13. Console shows proper logging
- [ ] 14. No critical errors in console
- [ ] 15. FPS ~60 (Performance tab)

**TOTAL PASSED:** _____ / 15

---

## 🚨 Critical Issues to Report

### Issue #1:
**Component:** _____________________
**Severity:** CRITICAL / MAJOR / MINOR
**Description:** _____________________
**Console Output:**
```
[Paste here]
```

### Issue #2:
**Component:** _____________________
**Severity:** CRITICAL / MAJOR / MINOR
**Description:** _____________________
**Console Output:**
```
[Paste here]
```

### Issue #3:
**Component:** _____________________
**Severity:** CRITICAL / MAJOR / MINOR
**Description:** _____________________
**Console Output:**
```
[Paste here]
```

---

## ✅ Success Criteria

### MUST PASS (Blocking):
- [ ] At least 4 of 5 preset buttons create routes
- [ ] Viewport is visible (not black)
- [ ] Console shows `[QuickRoutePresets]` logs
- [ ] No Uncaught TypeError errors
- [ ] Statistics panel shows correct route counts

### SHOULD PASS (Important):
- [ ] All 5 preset buttons work
- [ ] All 4 panels visible
- [ ] Mode selector on right (not left)
- [ ] FPS ~60

### NICE TO HAVE:
- [ ] Smooth animations
- [ ] Panel docking works
- [ ] Undo/redo available

---

## 📝 Detailed Findings Format

**For each issue found, provide:**

1. **Screenshot** (use browser screenshot tool)
2. **Console output** (copy/paste)
3. **Steps to reproduce** (numbered list)
4. **Expected vs Actual** (clear comparison)
5. **Severity rating** (CRITICAL/MAJOR/MINOR)

---

## 🎯 What Claude Code Needs from Codex Agent 1

### Minimum Required Info:
1. **How many preset buttons work?** (0-5)
2. **Is viewport visible?** (YES/NO)
3. **Console log sample** (copy/paste first 20 lines)
4. **Any red errors?** (YES/NO + error message)
5. **Screenshot of Professional Mode layout**

### Ideal Complete Info:
1. All 13 screenshots (numbered)
2. Full console log output
3. Checklist completed (15 items)
4. Issue descriptions (if any)
5. Performance metrics (FPS)

---

## 🚀 Next Steps After Testing

### If Tests PASS (12+ of 15):
✅ Professional Mode is PRODUCTION READY
- Create final test report
- Merge to main
- Deploy to production

### If Tests FAIL (< 12 of 15):
❌ Critical issues found
- Prioritize fixes (CRITICAL first)
- Create bug fix tasks
- Retest after fixes

---

## 📞 Report Back To

**Claude Code (Agent 1)** via:
- Paste console output in chat
- Share screenshot links
- Fill out checklist above
- Describe any errors found

---

**Test Server:** http://localhost:5176
**Test Duration:** ~15-30 minutes
**Test Status:** 🟢 READY TO START

---

*Let's verify Professional Mode is fully functional! 🚀*
