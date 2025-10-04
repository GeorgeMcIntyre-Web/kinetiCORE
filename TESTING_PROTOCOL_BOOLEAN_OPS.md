# Boolean Operations Testing Protocol

**Date:** 2025-10-04
**Feature:** CSG Boolean Operations with Undo/Redo
**Tester:** George (with Claude Code)
**Build Status:** ✅ Type-check passed, Build succeeded

---

## Test Environment Setup

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Browser:** Open http://localhost:5173

3. **Initial scene setup:**
   - Switch to **Professional Mode** (Essential → Professional)
   - Verify Professional Mode UI loads correctly
   - Check that Boolean operation buttons are visible in ribbon toolbar

---

## Test Cases

### Test 1: Multi-Selection with Ctrl+Click
**Objective:** Verify Ctrl+Click multi-selection works in SceneTree

**Steps:**
1. Create two primitive objects (e.g., two boxes or sphere + box)
2. Open SceneTree panel
3. Click first object in tree → should select (highlight)
4. Hold Ctrl and click second object → both should be highlighted
5. Verify selectedNodeIds array contains both IDs (check React DevTools or console)

**Expected Result:**
- ✅ Both nodes show selection highlight
- ✅ selectedNodeIds contains exactly 2 IDs
- ✅ No errors in console

**Actual Result:**
_[To be filled during testing]_

---

### Test 2: Boolean Union Operation
**Objective:** Verify union (add) operation creates correct result mesh

**Steps:**
1. Create Box A at position (0, 1, 0), size 1
2. Create Box B at position (0.5, 1, 0), size 1 (overlapping with A)
3. Ctrl+Click to select both boxes in SceneTree
4. Click "Union" button in Boolean Operations section
5. Wait for loading indicator
6. Observe result

**Expected Result:**
- ✅ Loading indicator appears with "Performing union operation..."
- ✅ Result mesh created (combined volume of both boxes)
- ✅ Source boxes A and B deleted from scene
- ✅ New node "union_result" appears in SceneTree
- ✅ Toast notification: "Boolean union completed successfully"
- ✅ Result mesh has material from first selected object

**Actual Result:**
_[To be filled during testing]_

---

### Test 3: Boolean Subtract Operation
**Objective:** Verify subtract operation removes volume correctly

**Steps:**
1. Create Box A at (0, 1, 0), size 2
2. Create Box B at (0.5, 1, 0), size 1 (partially inside A)
3. Ctrl+Click select Box A first, then Box B
4. Click "Subtract" button
5. Observe result

**Expected Result:**
- ✅ Loading indicator appears
- ✅ Result mesh shows Box A with Box B volume removed
- ✅ Source meshes deleted
- ✅ New node "subtract_result" in SceneTree
- ✅ Success toast notification

**Actual Result:**
_[To be filled during testing]_

---

### Test 4: Boolean Intersect Operation
**Objective:** Verify intersect operation keeps only overlapping volume

**Steps:**
1. Create Sphere at (0, 1, 0), diameter 2
2. Create Box at (0.5, 1, 0), size 1.5 (overlapping with sphere)
3. Ctrl+Click select both
4. Click "Intersect" button
5. Observe result

**Expected Result:**
- ✅ Loading indicator appears
- ✅ Result mesh shows only the overlapping volume
- ✅ Source meshes deleted
- ✅ New node "intersect_result" in SceneTree
- ✅ Success toast notification

**Actual Result:**
_[To be filled during testing]_

---

### Test 5: Undo Boolean Operation
**Objective:** Verify undo restores original meshes with correct properties

**Steps:**
1. Perform any Boolean operation (e.g., Union from Test 2)
2. After operation completes, press Ctrl+Z (or click Undo button)
3. Observe scene

**Expected Result:**
- ✅ Result mesh deleted from scene
- ✅ Original source meshes restored at exact positions
- ✅ Original meshes have correct materials
- ✅ Original meshes have correct vertex data (geometry intact)
- ✅ SceneTree shows original nodes restored
- ✅ No errors in console

**Actual Result:**
_[To be filled during testing]_

---

### Test 6: Redo Boolean Operation
**Objective:** Verify redo re-performs the operation

**Steps:**
1. Perform Boolean operation
2. Undo (Ctrl+Z)
3. Redo (Ctrl+Y or click Redo button)
4. Observe scene

**Expected Result:**
- ✅ Loading indicator appears again
- ✅ Result mesh recreated
- ✅ Source meshes deleted again
- ✅ Result identical to original operation
- ✅ No errors in console

**Actual Result:**
_[To be filled during testing]_

---

### Test 7: Error - Wrong Number of Selections
**Objective:** Verify error handling when selection count ≠ 2

**Test 7a: Zero selections**
1. Clear selection (Esc key)
2. Click any Boolean operation button

**Expected Result:**
- ✅ Warning toast: "Please select exactly two objects for Boolean operations (Ctrl+Click to multi-select)"
- ✅ No loading indicator
- ✅ No operation performed

**Test 7b: One selection**
1. Select single object
2. Click Boolean operation button

**Expected Result:**
- ✅ Same warning toast as 7a
- ✅ No operation performed

**Test 7c: Three selections**
1. Create 3 objects
2. Ctrl+Click select all 3
3. Click Boolean operation button

**Expected Result:**
- ✅ Same warning toast as 7a
- ✅ No operation performed

**Actual Result:**
_[To be filled during testing]_

---

### Test 8: Error - CSG Initialization Failure
**Objective:** Verify graceful handling if CSG2 fails to initialize

**Steps:**
1. Check console for CSG2 initialization message
2. If CSG2 failed to initialize, attempt Boolean operation
3. Observe error handling

**Expected Result:**
- ✅ Error toast displayed with meaningful message
- ✅ Scene remains stable (no crashes)
- ✅ Error logged to console

**Actual Result:**
_[To be filled during testing]_

---

### Test 9: Loading Indicator Behavior
**Objective:** Verify loading UI during async Boolean operations

**Steps:**
1. Perform Boolean operation on complex meshes (if available)
2. Observe loading indicator throughout operation

**Expected Result:**
- ✅ Loading indicator appears immediately when button clicked
- ✅ Message shows "Performing [operation] operation..."
- ✅ Type is "processing" (shows processing icon)
- ✅ Loading indicator disappears after operation completes
- ✅ No flickering or UI glitches

**Actual Result:**
_[To be filled during testing]_

---

### Test 10: Multiple Undo/Redo Cycles
**Objective:** Verify stability with repeated undo/redo

**Steps:**
1. Perform Boolean Union operation
2. Undo (Ctrl+Z)
3. Redo (Ctrl+Y)
4. Undo again
5. Redo again
6. Repeat 2-3 more times
7. Check for memory leaks or performance degradation

**Expected Result:**
- ✅ All cycles complete successfully
- ✅ Meshes consistently restored/removed
- ✅ No duplicate meshes created
- ✅ No memory leaks (check browser DevTools Performance/Memory)
- ✅ Console shows no errors

**Actual Result:**
_[To be filled during testing]_

---

### Test 11: Keyboard Shortcuts
**Objective:** Verify all keyboard shortcuts work

**Steps:**
1. Perform Boolean operation
2. Test undo: Ctrl+Z
3. Test redo: Ctrl+Y
4. Test duplicate: Select object, Ctrl+D

**Expected Result:**
- ✅ Ctrl+Z undoes Boolean operation
- ✅ Ctrl+Y redoes Boolean operation
- ✅ Ctrl+D duplicates selected object (creates copy with offset)

**Actual Result:**
_[To be filled during testing]_

---

## Performance Tests

### Test 12: Boolean Operations on Complex Meshes
**Objective:** Verify performance with high polygon count meshes

**Steps:**
1. Create or import two complex meshes (>10k triangles each)
2. Perform Boolean Union
3. Measure operation time
4. Check for lag or freezing

**Expected Result:**
- ✅ Operation completes within reasonable time (<5 seconds)
- ✅ Loading indicator stays visible throughout
- ✅ UI remains responsive (doesn't freeze browser)
- ✅ Result mesh renders correctly

**Actual Result:**
_[To be filled during testing]_

---

## Edge Cases

### Test 13: Non-Overlapping Meshes
**Objective:** Test Boolean operations on meshes that don't overlap

**Steps:**
1. Create Box A at (0, 1, 0)
2. Create Box B at (5, 1, 0) (no overlap)
3. Perform Subtract operation

**Expected Result:**
- ✅ Operation completes (may produce unexpected geometry)
- ✅ OR error message if CSG2 detects invalid operation
- ✅ No crash or hang

**Actual Result:**
_[To be filled during testing]_

---

### Test 14: Identical Meshes
**Objective:** Test Boolean operations on perfectly overlapping meshes

**Steps:**
1. Create Box A at (0, 1, 0)
2. Duplicate Box A (Ctrl+D), move duplicate to exact same position
3. Perform Intersect operation

**Expected Result:**
- ✅ Operation completes
- ✅ Result mesh identical to original
- ✅ No errors

**Actual Result:**
_[To be filled during testing]_

---

## Integration Tests

### Test 15: Boolean Operation + Transform
**Objective:** Verify result mesh can be transformed

**Steps:**
1. Perform Boolean Union
2. Select result mesh
3. Use transform tools (Move, Rotate, Scale)
4. Verify transformations work

**Expected Result:**
- ✅ Result mesh can be moved
- ✅ Result mesh can be rotated
- ✅ Result mesh can be scaled
- ✅ Transform gizmos work correctly

**Actual Result:**
_[To be filled during testing]_

---

### Test 16: Save/Load Scene with Boolean Results
**Objective:** Verify Boolean result meshes persist

**Steps:**
1. Perform Boolean operation
2. Export scene (if export is implemented)
3. Clear scene
4. Import saved scene
5. Verify result mesh appears

**Expected Result:**
- ✅ Result mesh exported correctly
- ✅ Result mesh imported correctly
- ✅ Geometry preserved

**Actual Result:**
_[To be filled during testing - may be N/A if save/load not implemented]_

---

## Regression Tests

### Test 17: Essential Mode Still Works
**Objective:** Verify Essential Mode unaffected by Boolean operation changes

**Steps:**
1. Switch to Essential Mode
2. Test action cards
3. Test viewport controls
4. Switch back to Professional Mode

**Expected Result:**
- ✅ Essential Mode renders correctly
- ✅ Action cards work
- ✅ No errors from Boolean operation code

**Actual Result:**
_[To be filled during testing]_

---

### Test 18: Expert Mode Still Works
**Objective:** Verify Expert Mode unaffected

**Steps:**
1. Switch to Expert Mode
2. Test command palette (Ctrl+K)
3. Verify all panels render

**Expected Result:**
- ✅ Expert Mode renders correctly
- ✅ Command palette works
- ✅ No regressions

**Actual Result:**
_[To be filled during testing]_

---

## Test Summary

**Total Tests:** 18
**Passed:** _[To be filled]_
**Failed:** _[To be filled]_
**Skipped:** _[To be filled]_

**Critical Bugs Found:**
_[To be filled]_

**Non-Critical Issues:**
_[To be filled]_

**Performance Notes:**
_[To be filled]_

**Recommended Next Steps:**
_[To be filled]_

---

## Automated Test Candidates

The following manual tests should be converted to automated tests:

1. **Unit Tests Needed:**
   - BooleanOperationCommand.execute()
   - BooleanOperationCommand.undo()
   - BooleanOperations.performOperation()
   - Multi-selection state management (editorStore)

2. **Integration Tests Needed:**
   - Complete Boolean workflow (select → execute → verify result)
   - Undo/redo cycles
   - Error handling paths

3. **E2E Tests Needed:**
   - User workflow from UI button click to result mesh visible
   - Keyboard shortcuts
   - Multi-mode switching with Boolean operations active

---

## Manual Testing Instructions

**To execute this test protocol:**

1. Start dev server: `npm run dev`
2. Open browser DevTools (F12) - keep Console tab visible
3. Work through each test case in order
4. Fill in "Actual Result" sections
5. Take screenshots of any bugs/issues
6. Note performance metrics (operation times, FPS drops, etc.)
7. Fill in Test Summary section at end
8. Report critical bugs immediately
9. Create GitHub issues for non-critical bugs

**Testing Checklist:**
- [ ] All 18 test cases executed
- [ ] Results documented
- [ ] Screenshots captured
- [ ] Performance metrics recorded
- [ ] Bugs logged
- [ ] Test summary completed
