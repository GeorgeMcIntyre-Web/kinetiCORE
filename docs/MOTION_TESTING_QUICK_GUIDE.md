# 6-Axis Robot Motion - Quick Testing Guide

**Goal:** Test joint & linear motion with new compact icon-only UI  
**Time:** 15-20 minutes

---

## Pre-Test: Load Robot

1. Load a 6-axis robot (Fanuc/ABB)
2. Open Motion Panel
3. Verify 6 joints visible

---

## Test 1: Joint Motion (5 min)

**Actions:**
1. Move each joint slider (J1-J6)
2. Use + / - buttons
3. Click Home button (house icon)

**Verify:**
- ✅ Joints move smoothly
- ✅ TCP gizmo follows (real-time tracking)
- ✅ Home button instant response (<100ms)
- ✅ Console clean (no spam)

---

## Test 2: TCP/Linear Motion (5 min)

**Actions:**
1. Switch to TCP mode
2. Use X/Y/Z + / - buttons (10mm steps)
3. Try RX/RY/RZ rotation (5° steps)
4. Drag TCP gizmo

**Verify:**
- ✅ Linear motion in straight lines
- ✅ IK solves successfully
- ✅ Gizmo drag works
- ✅ Position display updates

---

## Test 3: Target Save/Load (5 min)

**Actions:**
1. Move robot to position
2. Type name, click Save (floppy icon - 16px)
3. Move robot elsewhere
4. Click Load (play icon - 14px)
5. Click Delete (trash icon - 12px)

**Verify:**
- ✅ Save button: icon-only, 16px, tooltip works
- ✅ Load button: icon-only, 14px, loads position
- ✅ Delete button: icon-only, 12px, removes target
- ✅ NO TEXT on any button (icons only!)

---

## UI/UX Check

**All buttons must be:**
- ✅ Icon-only (NO text like "Save Current" or "Load")
- ✅ Compact (Save:16px, Load:14px, Delete:12px)
- ✅ Tooltips present (hover shows description)

**If buttons still have text:**
- Hard refresh browser (Ctrl+F5)
- Check version 0.2.0
- Report as bug

---

## Quick Pass/Fail

**PASS if:**
- All 3 tests complete successfully
- Buttons are icon-only and compact
- No console errors

**FAIL if:**
- Any button shows text
- Gizmo doesn't track joints
- IK fails on simple moves
- Targets don't save/load

---

**Status:** ⬜ Pass / ⬜ Fail  
**Issues Found:** ___________________  
**Time Taken:** _____ minutes
