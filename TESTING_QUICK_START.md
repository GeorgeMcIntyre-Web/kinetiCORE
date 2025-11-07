# Quick Testing Guide - Routing System Fixes

**Status:** ✅ Fixes Committed (commit `25d0945`)
**Branch:** `feature/smart-routing-system`
**Dev Server:** http://localhost:5176 (running)

---

## 🎯 Quick Test (5 minutes)

### Step 1: Open Browser & DevTools
1. Navigate to http://localhost:5176
2. Press `F12` to open DevTools
3. Click **Console** tab
4. Clear console (`Ctrl+L` or click Clear button)

### Step 2: Test Pipe Preset
1. Click **"Pipe"** button in routing toolbar
2. Watch console output - you should see:
   ```
   [QuickRoutePresets] 🎯 Creating pipe route from...
   [QuickRoutePresets] Type parameter received: pipe
   [CreateConnectionPointCommand] 📍 Creating connection point with type: pipe
   [Route constructor] 🏗️ Creating route ...
   [Route constructor] Route type set to: pipe
   [getObstacles] 🚫 Excluding scene infrastructure: ground
   [getObstacles] 🚫 Excluding scene infrastructure: gridOverlay
   ```

3. Check **Warning Panel** (top of screen):
   - Should show **"PIPE"** type (not "ELECTRICAL")
   - Should show **5-8 warnings** (not 20+)
   - Should NOT show collision warnings with "ground" or "gridOverlay"

### Step 3: Test Electrical Preset
1. Clear console again
2. Click **"Electrical"** button
3. Verify console shows `type: electrical` throughout
4. Verify warning panel shows **"ELECTRICAL"** type

---

## ✅ Success Criteria

### Console Logs:
- ✅ Shows correct route type at each step
- ✅ Shows connection points created with correct type
- ✅ Shows route constructor receives correct type
- ✅ Shows ground/grid meshes excluded from obstacles

### Warning Panel:
- ✅ Shows correct route type (Pipe/Electrical/etc.)
- ✅ Shows 5-8 warnings (not 20+)
- ✅ No "ground" collision warnings
- ✅ No "gridOverlay" collision warnings
- ✅ Fewer bend radius warnings
- ✅ Fewer clearance warnings

### Visual:
- ✅ Route geometry appears in 3D viewport
- ✅ Route has correct color (Pipe=gray, Electrical=yellow)
- ✅ Warning panel expandable (click to see details)

---

## ❌ Report Issues

If you see any of these, let me know:

### Issue 1: Wrong Route Type
**Symptom:** Console shows `type: pipe` but warning panel shows "ELECTRICAL"
**Action:** Copy full console log and send to me

### Issue 2: Still Too Many Warnings
**Symptom:** Warning panel shows 15+ warnings per route
**Action:** Expand warning panel, take screenshot, send to me

### Issue 3: Ground Collision Still Appears
**Symptom:** Warning says "Collision detected with obstacle 'ground'"
**Action:** Check console - should show exclusion messages
**Possible Cause:** Ground mesh has different name than expected

### Issue 4: Route Not Appearing
**Symptom:** Click preset button, no route visible
**Action:** Check console for errors (red text)
**Possible Cause:** Scene not initialized or geometry generation failed

---

## 📋 Full Console Log Template

When reporting issues, copy the FULL console log in this format:

```
=== TEST REPORT ===
Date: [DATE]
Browser: [Chrome/Edge version]
Issue: [Brief description]

CONSOLE OUTPUT:
[Paste entire console output here]

SCREENSHOTS:
[Attach screenshot of warning panel]
[Attach screenshot of 3D viewport]

STEPS TO REPRODUCE:
1. [What you clicked]
2. [What happened]
3. [What you expected]

===
```

---

## 📚 Detailed Documentation

For comprehensive testing:
- **Full Testing Guide:** [docs/ROUTING_FIXES_APPLIED.md](docs/ROUTING_FIXES_APPLIED.md)
- **Diagnostic Scripts:** [docs/ROUTING_DIAGNOSTIC_TEST.md](docs/ROUTING_DIAGNOSTIC_TEST.md)
- **Workflow Guide:** [docs/ROUTING_WORKFLOW_GUIDE.md](docs/ROUTING_WORKFLOW_GUIDE.md) (not in git, local only)
- **Fix Details:** [docs/ROUTING_FIXES_TODO.md](docs/ROUTING_FIXES_TODO.md)

---

## 🚀 Next Steps

### If Tests Pass:
1. Push commit to remote: `git push origin feature/smart-routing-system`
2. Continue with Phase 2 fixes (if needed)
3. Work on Phase 3 visual improvements

### If Tests Fail:
1. Copy console logs
2. Take screenshots
3. Report findings
4. I'll diagnose and apply targeted fixes

---

## 📊 What Changed

### Files Modified (5):
1. [QuickRoutePresets.ts](src/routing/ui/QuickRoutePresets.ts) - Debug logging
2. [CreateConnectionPointCommand.ts](src/routing/commands/CreateConnectionPointCommand.ts) - Debug logging
3. [Route.ts](src/routing/core/Route.ts) - Debug logging
4. [RouteWarningsPanel.tsx](src/routing/ui/RouteWarningsPanel.tsx) - Deduplication
5. [RoutingUtils.ts](src/routing/core/RoutingUtils.ts) - Ground exclusion + reduced constraints

### Documentation Added (3):
1. ROUTING_DIAGNOSTIC_TEST.md
2. ROUTING_FIXES_APPLIED.md
3. ROUTING_FIXES_TODO.md

### Commit:
- Hash: `25d0945`
- Message: "fix(routing): resolve validation warnings and add debug logging"
- Files: 8 changed, 1556 insertions(+), 26 deletions(-)

---

**Ready to test!** Open http://localhost:5176 and follow Step 1-3 above. 🎯
