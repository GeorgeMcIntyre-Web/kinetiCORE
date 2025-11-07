# 5-Agent Cursor Testing Prompts for Professional Mode

**Purpose:** Manual browser testing of the completed Professional Mode routing system
**Branch:** `feature/smart-routing-system`
**Status:** Ready for testing (all code fixes complete)

---

## Setup Instructions

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser:**
   Navigate to `http://localhost:5173`

3. **Copy each prompt below into separate Cursor agents**

4. **Run all 5 agents in parallel** for comprehensive testing

---

## 🎯 AGENT 1: Viewport & 3D Rendering Verification

```
TASK: Verify Professional Mode viewport and 3D scene rendering

CONTEXT:
- Fixed z-index layering issue (commit ada8a07)
- DockableLayoutWrapper now uses transparent overlay architecture
- Viewport should be visible behind dockable panels

TEST CHECKLIST:

1. **Launch App & Navigate to Professional Mode**
   - Open http://localhost:5173
   - Verify app starts in Professional Mode by default
   - If not, click mode selector (top-right) and select "Professional"

2. **Verify Viewport Visibility**
   - Check that 3D scene viewport is visible (NOT black screen)
   - Verify grid floor is rendered
   - Verify camera controls work (click + drag to orbit)
   - Screenshot: Take screenshot of visible viewport

3. **Verify Panel Overlays**
   - Open Statistics panel (bottom)
   - Verify viewport STILL VISIBLE behind panel
   - Open Edit panel (right)
   - Verify viewport STILL VISIBLE behind panel
   - Open Templates panel (left)
   - Verify viewport STILL VISIBLE with all panels open

4. **Verify Interactions**
   - Click on viewport (not on panels) - should rotate camera
   - Click on panels - should interact with panel UI
   - Verify pointer-events working correctly (viewport clickable in gaps)

EXPECTED RESULTS:
- ✅ Viewport visible at all times
- ✅ Panels overlay viewport with transparency
- ✅ Camera controls work when clicking viewport
- ✅ Panel interactions work when clicking panels

REPORT FORMAT:
- Screenshot of viewport with all panels open
- Confirm: "Viewport visible: YES/NO"
- Confirm: "Camera controls work: YES/NO"
- Confirm: "Panel interactions work: YES/NO"
- Any visual issues observed

FILES TO CHECK:
- src/ui/layouts/DockableLayoutWrapper.tsx (z-index: 0 and 1)
- src/ui/layouts/DockableLayoutWrapper.css (transparent backgrounds)
```

---

## 🔘 AGENT 2: Quick Preset Buttons & Route Creation

```
TASK: Test Quick Preset buttons in ribbon toolbar

CONTEXT:
- QuickRoutePresets.ts has debug logging (commit 37c2f37)
- 5 preset buttons: Electrical, Pipe, Tray, Conduit, Mixed
- Should create routes with connection points and geometry

TEST CHECKLIST:

1. **Open Browser DevTools**
   - Press F12 to open DevTools
   - Go to Console tab
   - Clear console (Ctrl+L or Clear button)

2. **Test Electrical Preset**
   - Click "Electrical" button in ribbon toolbar
   - Check console for: "[QuickRoutePresets] Creating electrical route"
   - Check console for: "[QuickRoutePresets] Route creation complete!"
   - Verify: Route appears in 3D scene (conduit mesh)
   - Verify: Debug label appears (if labels enabled)

3. **Test Pipe Preset**
   - Click "Pipe" button
   - Check console logs
   - Verify pipe route appears in scene

4. **Test Tray Preset**
   - Click "Tray" button
   - Check console logs
   - Verify cable tray route appears in scene

5. **Test Conduit Preset**
   - Click "Conduit" button
   - Check console logs
   - Verify conduit route appears in scene

6. **Test Mixed Preset**
   - Click "Mixed" button
   - Check console logs
   - Verify multiple routes appear in scene

7. **Capture All Console Output**
   - Copy entire console log
   - Note any errors (red text)
   - Note any warnings (yellow text)

EXPECTED CONSOLE OUTPUT:
For each button click, you should see:
```
[QuickRoutePresets] Creating {type} route from Vector3(...) to Vector3(...)
[QuickRoutePresets] Executing connection point commands...
[QuickRoutePresets] Found connection points, creating route...
[QuickRoutePresets] Generating geometry for route...
[QuickRoutePresets] Route creation complete!
```

ERROR SCENARIOS:
If you see these errors, report them:
- "[QuickRoutePresets] setCurrentRouteType not found"
- "[QuickRoutePresets] commandManager not found"
- "[QuickRoutePresets] Failed to find connection points"
- "[QuickRoutePresets] Error creating preset route: ..."

REPORT FORMAT:
- Full console log (copy/paste)
- For each button: WORKS/BROKEN + screenshot
- Electrical: [status]
- Pipe: [status]
- Tray: [status]
- Conduit: [status]
- Mixed: [status]

FILES TO CHECK:
- src/routing/ui/QuickRoutePresets.ts (debug logging)
```

---

## 📊 AGENT 3: Panel Functionality & UI Interactions

```
TASK: Test all dockable panels and UI controls

CONTEXT:
- 4 panels implemented by agents 2-5
- RouteEditPanel (right), RouteTemplatesPanel (left), RouteStatsPanel (bottom), RouteWarningsPanel (top)
- All panels should open/close, drag, resize

TEST CHECKLIST:

1. **Test Edit Panel (Right Side)**
   - Click "Edit" button in ribbon OR existing Edit panel tab
   - Verify panel opens on right side
   - Check panel contents:
     - ✅ Route type dropdown (Electrical, Pipe, Cable Tray, Conduit)
     - ✅ Connector specs section
     - ✅ Material selection
     - ✅ Pre-order length display
     - ✅ Delete route button
   - Try changing route type - verify dropdown works
   - Screenshot of Edit panel

2. **Test Templates Panel (Left Side)**
   - Click "Templates" button in ribbon
   - Verify panel opens on left side
   - Check panel contents:
     - ✅ Template categories (Electrical, Piping, Structured)
     - ✅ Apply template button
     - ✅ Template previews/list
   - Try clicking a template - note behavior
   - Screenshot of Templates panel

3. **Test Statistics Panel (Bottom)**
   - Click "Statistics" button or check if already open
   - Verify panel opens at bottom
   - Check panel contents:
     - ✅ Total routes count
     - ✅ Total length calculation
     - ✅ Active warnings count
     - ✅ Routes by type breakdown
   - Create a route using Quick Preset
   - Verify stats update in real-time
   - Screenshot of Statistics panel

4. **Test Warnings Panel (Top Bar)**
   - Create a route with missing connector specs
   - Verify warning appears in top bar
   - Check warning indicators (⚠️ icons)
   - Click warning to see details
   - Screenshot of Warnings panel

5. **Test Panel Drag & Resize**
   - Drag Edit panel tab to different position
   - Verify panel moves
   - Resize panel by dragging edge
   - Verify panel resizes
   - Close panel and reopen - verify it works

6. **Test Labels Toggle**
   - Click Eye icon in ribbon toolbar
   - Verify 3D debug labels appear/disappear
   - Labels should show route specs

EXPECTED RESULTS:
- ✅ All panels open/close correctly
- ✅ Panel contents render properly
- ✅ Real-time updates work (Statistics)
- ✅ Drag and resize functional
- ✅ Labels toggle works

REPORT FORMAT:
For each panel:
- Screenshot
- Opens: YES/NO
- Contents correct: YES/NO
- Interactions work: YES/NO
- Any bugs or issues

FILES TO CHECK:
- src/routing/ui/RouteEditPanel.tsx
- src/routing/ui/RouteTemplatesPanel.tsx
- src/routing/ui/RouteStatsPanel.tsx
- src/routing/ui/RouteWarningsPanel.tsx
```

---

## 🎨 AGENT 4: Mode Selector & UI Layout

```
TASK: Verify mode selector dropdown and layout fixes

CONTEXT:
- Fixed dropdown positioning (commit 87527be)
- Changed from left-0 to right-0 positioning
- Fixed ribbon compactness (commit 1693cae)

TEST CHECKLIST:

1. **Test Mode Selector Visibility**
   - Click mode selector button (top-right corner)
   - Verify dropdown appears
   - Verify dropdown does NOT cut off at screen edge
   - Verify dropdown appears on RIGHT side (not left)
   - Screenshot of dropdown open

2. **Test Mode Switching**
   - Click "Essential" mode
   - Verify UI switches to Essential layout
   - Click mode selector again
   - Click "Professional" mode
   - Verify UI switches back to Professional layout
   - Click "Expert" mode (if available)
   - Verify UI switches to Expert layout

3. **Test Ribbon Toolbar Compactness**
   - Measure ribbon height (should be 64px, not 80px)
   - Check all buttons visible (no overflow)
   - Verify button sizes:
     - Icon size: 18px
     - Font size: 10px
     - Padding: 6px 10px
   - Verify separator lines (48px height)
   - Screenshot of ribbon toolbar

4. **Test Responsive Behavior**
   - Resize browser window to smaller size
   - Verify mode selector still visible
   - Verify ribbon buttons don't overflow
   - Test at different resolutions:
     - 1920x1080 (full screen)
     - 1366x768 (laptop)
     - 1280x720 (smaller laptop)

5. **Test Default Mode**
   - Refresh browser (Ctrl+R or F5)
   - Verify app starts in Professional mode by default
   - Should NOT start in Essential mode

EXPECTED RESULTS:
- ✅ Dropdown visible on right side
- ✅ All modes switch correctly
- ✅ Ribbon compact (64px height)
- ✅ All buttons visible and functional
- ✅ App starts in Professional mode

REPORT FORMAT:
- Screenshot of mode selector dropdown
- Screenshot of ribbon toolbar with measurements
- Confirm: "Dropdown position: RIGHT/LEFT"
- Confirm: "Ribbon height: 64px/OTHER"
- Confirm: "Default mode: PROFESSIONAL/OTHER"
- Any layout issues

FILES TO CHECK:
- src/ui/components/Header.tsx (line 148 dropdown positioning)
- src/ui/layouts/ProfessionalModeLayout.css (ribbon styles)
- src/App.tsx (line 138 defaultLevel prop)
```

---

## 🔄 AGENT 5: End-to-End Routing Workflow

```
TASK: Complete routing workflow from start to finish

CONTEXT:
- Test entire routing workflow end-to-end
- Verify all features work together
- Catch integration issues

TEST CHECKLIST:

1. **Workflow Part 1: Create Connection Points**
   - Click in 3D viewport to create first connection point
   - Verify connection point appears (small sphere/marker)
   - Click in different location for second connection point
   - Verify second connection point appears
   - Screenshot of both connection points

2. **Workflow Part 2: Select Route Type**
   - Open Edit panel (if not already open)
   - Select "Electrical" from route type dropdown
   - Verify selection changes in panel

3. **Workflow Part 3: Create Route**
   - Click connection point A
   - Hold Shift + Click connection point B (or use Create Route button)
   - Verify route line appears between points
   - Verify route geometry generated (conduit mesh for electrical)
   - Screenshot of created route

4. **Workflow Part 4: Verify Debug Labels**
   - If labels not visible, click Eye icon in ribbon
   - Verify debug label appears above route
   - Label should show:
     - Route type (Electrical)
     - Length
     - Connector specs (if defined)
   - Screenshot of route with label

5. **Workflow Part 5: Edit Route**
   - Click on created route to select it
   - Edit panel should show route details
   - Change route type to "Pipe"
   - Verify geometry updates (conduit → pipe mesh)
   - Screenshot of edited route

6. **Workflow Part 6: Check Statistics**
   - Open Statistics panel
   - Verify it shows:
     - Total routes: 1
     - Total length: [calculated value]
     - Routes by type: Pipe: 1
   - Screenshot of statistics

7. **Workflow Part 7: Add More Routes**
   - Use Quick Preset buttons to add 2-3 more routes
   - Verify each route appears correctly
   - Check Statistics panel updates
   - Screenshot of multiple routes

8. **Workflow Part 8: Validation Warnings**
   - Create route with no connector specs
   - Verify warning appears in Warnings panel (top)
   - Click warning to see details
   - Screenshot of validation warning

9. **Workflow Part 9: Template Application**
   - Open Templates panel
   - Select an electrical template
   - Click "Apply Template"
   - Verify route created from template
   - Screenshot of template-created route

10. **Workflow Part 10: Delete Route**
    - Select a route
    - Click "Delete Route" in Edit panel
    - Verify route removed from scene
    - Verify Statistics panel updates

EXPECTED RESULTS:
- ✅ Complete workflow works end-to-end
- ✅ All panels interact correctly
- ✅ Real-time updates across all panels
- ✅ No console errors during workflow
- ✅ Visual feedback at each step

REPORT FORMAT:
- Step-by-step screenshots (10 images)
- For each step: SUCCESS/FAILED
- Full console log
- Overall workflow: WORKING/BROKEN
- Any issues encountered

FILES TO CHECK:
- All routing files in src/routing/
- Connection point creation
- Route geometry generation
- Panel updates and interactions
```

---

## 📋 Coordination Instructions

### How to Use These Prompts

1. **Copy each prompt** into a separate Cursor agent (Agent 1, Agent 2, etc.)
2. **Start all 5 agents simultaneously** for parallel testing
3. **Each agent is independent** - they don't need to wait for each other
4. **Collect results** from all 5 agents
5. **Combine findings** into single testing report

### Expected Timeline

- **Agent 1 (Viewport):** 5-10 minutes
- **Agent 2 (Quick Presets):** 10-15 minutes
- **Agent 3 (Panels):** 15-20 minutes
- **Agent 4 (Mode Selector):** 5-10 minutes
- **Agent 5 (End-to-End):** 20-30 minutes

**Total:** ~30-40 minutes if run in parallel

### Success Criteria

✅ **PASS:** If all 5 agents report SUCCESS on their tasks
⚠️ **PARTIAL:** If 3-4 agents pass, 1-2 have minor issues
❌ **FAIL:** If 2+ agents report major blocking issues

### Reporting Back

Create a summary report with:
- ✅/⚠️/❌ status for each agent
- All screenshots collected
- Full console logs from Agent 2
- Any bugs or issues discovered
- Recommendations for fixes

---

## 🔧 Common Issues & Troubleshooting

### Issue: Viewport Still Black
**Agent:** 1
**Fix:** Check browser console for errors, verify DockableLayoutWrapper loaded

### Issue: Quick Presets Not Working
**Agent:** 2
**Fix:** Check console for specific error messages in debug logging

### Issue: Panels Won't Open
**Agent:** 3
**Fix:** Verify Dockview library loaded, check for React errors in console

### Issue: Dropdown Cuts Off
**Agent:** 4
**Fix:** Verify Header.tsx has `right-0` not `left-0` on line 148

### Issue: Routes Don't Appear
**Agent:** 5
**Fix:** Check ConnectionManager initialized, verify SceneCanvas rendering

---

## 📁 Reference Files

- **Main Status Doc:** `docs/PROFESSIONAL_MODE_STATUS.md`
- **Final Summary:** `docs/PROFESSIONAL_MODE_FINAL_SUMMARY.md`
- **Feature Branch:** `feature/smart-routing-system`
- **Commit History:** See PROFESSIONAL_MODE_FINAL_SUMMARY.md for all 8 commits

---

**Good luck testing! 🚀**
