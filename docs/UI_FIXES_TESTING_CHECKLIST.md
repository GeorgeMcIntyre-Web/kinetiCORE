# UI Fixes Testing Checklist - kinetiCORE

**Date:** October 29, 2025  
**Testing Phase:** Post-Fix Verification (Option 2)  
**Build Status:** ✅ TypeScript passing, production ready

---

## Quick Test Summary

Run these tests to verify all UI fixes are working:

### Critical Tests (6 total - MUST PASS):
1. ⬜ Home button - instant response (<100ms)
2. ⬜ TCP gizmo tracks in Joint mode
3. ⬜ TCP gizmo tracks in TCP mode
4. ⬜ Console clean (no [IK DEBUG] spam)
5. ⬜ Visualization panel stays open
6. ⬜ Gizmo cleanup when panel closes

### Known Issues (4 total - MAY FAIL):
7. ⬜ Floor visible
8. ⬜ No extra red line/frame
9. ⬜ Debug visualizer labels correct
10. ⬜ All toolbar buttons functional

---

## Detailed Test Instructions

### Test 1: Home Button Response ⏱️
**Fix:** Commits 76b93b8, 149aa9b (50ms interval + world matrix)

**Steps:**
1. Load 6-DOF robot
2. Move joints away from home
3. Click Home button (house icon)
4. ✅ **PASS:** TCP gizmo snaps to home instantly (<100ms)
5. ❌ **FAIL:** Visible delay (500ms+)

**Status:** ⬜

---

### Test 2-3: TCP Gizmo Tracking 🎯
**Fix:** Commit 6a1dc11

**Joint Mode:**
1. Open Motion Panel
2. Move any joint slider
3. ✅ **PASS:** Gizmo follows robot smoothly
4. ❌ **FAIL:** Gizmo stays in place or lags

**TCP Mode:**
1. Switch to TCP mode
2. Drag gizmo
3. ✅ **PASS:** Robot follows (IK works)
4. ❌ **FAIL:** Gizmo or IK broken

**Status:** ⬜

---

### Test 4: Console Cleanliness 🧹
**Fix:** Commit c216fcb (59 statements disabled)

**Steps:**
1. Open DevTools Console (F12)
2. Clear console
3. Move TCP gizmo (trigger IK)
4. ✅ **PASS:** No `[IK DEBUG]` or `[DEBUG]` spam
5. ❌ **FAIL:** Console flooded with debug logs

**Status:** ⬜

---

### Test 5: Visualization Panel 🎛️
**Fix:** Commit e8058aa

**Steps:**
1. Click Settings button (gear icon)
2. Click INSIDE panel (toggle checkbox)
3. ✅ **PASS:** Panel stays open
4. Click OUTSIDE panel
5. ✅ **PASS:** Panel closes
6. ❌ **FAIL:** Panel closes when clicking inside

**Status:** ⬜

---

### Test 6: Gizmo Cleanup 🧼
**Fix:** Commit 5a078a3

**Steps:**
1. Open Motion Panel → TCP mode
2. Verify gizmo appears
3. Close panel
4. ✅ **PASS:** Gizmo disappears
5. ❌ **FAIL:** Gizmo persists

**Status:** ⬜

---

### Test 7: Floor Visibility 🏗️
**Fix:** Commit e87e03e (Cursor's fix - untested)

**Steps:**
1. Load scene
2. ✅ **PASS:** Gray/grid floor visible
3. ❌ **FAIL:** No floor visible

**Status:** ⬜

---

### Test 8: Extra Red Line 🔴
**Fix:** NOT YET ADDRESSED

**Steps:**
1. Toggle "Show Axes" ON/OFF
2. ✅ **PASS:** Frames appear/disappear cleanly
3. ❌ **FAIL:** Stray red line/frame visible

**Status:** ⬜

---

### Test 9: Debug Labels 🏷️
**Fix:** Issue 4 status unclear

**Steps:**
1. Toggle "Show Axes" ON
2. ✅ **PASS:** Labels at correct joint positions
3. ❌ **FAIL:** All labels at base0

**Status:** ⬜

---

### Test 10: Toolbar Buttons 🔘
**Fix:** NONE

**Test each button:**
- ✅ Home (should work)
- ⬜ Visualizer toggle
- ⬜ Bug/Test button
- ✅ Settings (should work)
- ⬜ Others (may be placeholders)

**Status:** ⬜

---

## Build Status (Verified by Claude)

✅ **TypeScript:** 0 errors (PASSING)  
⚠️ **ESLint:** 147 errors, 62 warnings (non-blocking)  
✅ **Production Build:** SUCCESS (Cursor verified)

---

## Results Summary

Fill out after testing:

**Critical Tests:** __/6 passing  
**Known Issues:** __/4 passing  
**Overall Status:** ⬜ PASS / ⬜ FAIL

**Deployment Ready:** ⬜ YES / ⬜ NO

**Notes:**
_______________________________________
_______________________________________
_______________________________________

---

**Tester:** George  
**Date:** __________  
**Time:** __________
