# CODEX: Browser Testing and Screenshot Capture

**Branch:** `feature/smart-routing-system`
**Time:** 2-3 hours
**MCP Tools:** Chrome DevTools integration available

---

## 🎯 Your Mission

Test all 5 UI polish tasks and capture 10 screenshots of the routing system with debug labels.

**What's Complete:**
- ✅ All UI polish (5 tasks)
- ✅ 4 geometry generators (cable, pipe, cable tray, conduit)
- ✅ 3D debug labels system
- ✅ All code committed and ready

**What You Need to Do:**
1. Test all UI features in browser
2. Test all 4 route geometry types
3. Capture 10 professional screenshots
4. Document any bugs found

---

## 🚀 Setup

**1. Start Dev Server:**
```bash
npm run dev
```

**2. Open Browser:**
http://localhost:5173

**3. MCP DevTools:**
Use `mcp__chrome-devtools__console` to run JavaScript
Use `mcp__chrome-devtools__screenshot` to capture images

---

## Test 1: ExpertModeLayout Quad Viewports (15 min)

**Steps:**
1. Switch to Expert mode (dropdown in header)
2. Verify 4 viewports visible:
   - Top View (Z)
   - Front View (X)
   - Right View (Y)
   - Perspective
3. Click each viewport
4. Check cyan border appears on active viewport
5. Verify grid overlay (20px squares)
6. Verify axis indicators:
   - X axis = Red
   - Y axis = Green
   - Z axis = Blue

**Console Check:**
```javascript
// Run via MCP:
document.querySelectorAll('.grid-overlay').length === 4;
document.querySelectorAll('.axis-indicator').length === 4;
document.querySelector('.viewport-quad.active') !== null;
```

**Screenshot:**
- Capture Expert mode with all 4 viewports
- Click Top viewport to make it active (cyan border)
- Save as: `docs/images/expert-mode-quad-viewports.png`

**Pass Criteria:**
- [ ] 4 viewports visible
- [ ] Grid overlays present
- [ ] Axis labels correct colors
- [ ] Active viewport has cyan border

---

## Test 2: Professional Ribbon Toolbar (10 min)

**Steps:**
1. Switch to Professional mode
2. Locate routing toolbar (ribbon)
3. Hover over toolbar buttons
4. Click a tool button
5. Verify active state

**Console Check:**
```javascript
// Check hover state
const btn = document.querySelector('.tool-btn');
getComputedStyle(btn, ':hover').background.includes('rgba(0, 217, 255');
```

**Screenshot:**
- Hover over a routing tool button (cyan background)
- Save as: `docs/images/professional-ribbon-hover.png`

**Pass Criteria:**
- [ ] Hover shows cyan background
- [ ] Active tool has cyan border
- [ ] Button labels visible
- [ ] Icons render correctly

---

## Test 3: MeasurementTools with Glow (20 min)

**Steps:**
1. Open Measurement Tools panel
2. Click "Distance" tool
3. Click 2 points in the scene
4. Observe:
   - Cyan glowing markers at click points
   - Line connecting them
   - Result panel with measurement

**Console Check:**
```javascript
// Check GlowLayer exists
scene.getGlowLayerByName('measurement-glow') !== null;

// Check marker color
const markers = scene.meshes.filter(m => m.name.includes('marker'));
markers[0].material.emissiveColor.toHexString(); // Should be '#00D9FF'

// Check glow intensity
scene.getGlowLayerByName('measurement-glow').intensity; // Should be 0.8
```

**Screenshot:**
- Distance measurement with 2 cyan glowing markers
- Line visible between points
- Result panel showing distance
- Save as: `docs/images/measurement-tools-glow.png`

**Pass Criteria:**
- [ ] Markers glow cyan
- [ ] Markers diameter ~40mm (0.04m)
- [ ] Line visible and cyan colored
- [ ] Result panel appears with animation
- [ ] Panel has backdrop blur effect

---

## Test 4: ExportDialog Card UI (10 min)

**Steps:**
1. Open Export dialog (button in header)
2. Verify 3 format cards visible
3. Check each card has:
   - Icon (FileJson/Database/Package)
   - Badge ("Fastest"/"Recommended"/"Complete")
   - File size (~500 KB/~2 MB/~5 MB)
   - File extension (.json/.babylon/.kineticore)
4. Click a card
5. Verify selected state (cyan border, glow)

**Console Check:**
```javascript
document.querySelectorAll('.export-format-card').length === 3;
document.querySelectorAll('.format-badge').length === 3;
document.querySelector('.export-format-card.selected') !== null;
```

**Screenshot:**
- Export dialog with all 3 cards
- Click "Babylon Scene" card (selected with cyan border)
- Save as: `docs/images/export-dialog-cards.png`

**Pass Criteria:**
- [ ] 3 cards visible
- [ ] Icons render correctly
- [ ] Badges show correct text
- [ ] Selected card has cyan border + shadow
- [ ] Hover shows subtle cyan background

---

## Test 5: Mode Switch Transitions (10 min)

**Steps:**
1. Open mode switcher dropdown (header)
2. Verify keyboard shortcuts visible:
   - Essential (Ctrl+1)
   - Professional (Ctrl+2)
   - Expert (Ctrl+3)
3. Switch between modes
4. Observe fade animation (0.3s)

**Console Check:**
```javascript
document.querySelectorAll('.keyboard-hint').length === 3;
Array.from(document.querySelectorAll('.keyboard-hint'))
  .map(el => el.textContent); // ['Ctrl+1', 'Ctrl+2', 'Ctrl+3']
```

**Screenshot:**
- Mode dropdown open showing keyboard hints
- Save as: `docs/images/mode-switcher-dropdown.png`

**Pass Criteria:**
- [ ] Keyboard shortcuts visible
- [ ] Hints styled with monospace font
- [ ] Smooth fade animation when switching
- [ ] Layout changes smoothly

---

## Test 6: Electrical Route with Debug Label (20 min)

**Steps:**
1. In Professional mode, create electrical route:
   - Click "Add Connector" button
   - Place 2 connectors in scene
   - Click "Create Route" button
   - Click connectors to link them
2. Generate geometry:
   - Select route in scene tree
   - Click "Generate Geometry"
3. Enable debug labels:
   - Click "Labels" button (Eye icon) in routing toolbar
4. Observe:
   - Yellow wire bundle (3 wires, ~3mm each)
   - Floating label above route
   - Label shows specifications

**Console Check:**
```javascript
// Check wire bundle exists
scene.meshes.filter(m => m.name.includes('cable')).length > 0;

// Check color is yellow
const cable = scene.getMeshByName('cable_' + routeId);
cable.material.diffuseColor.toHexString(); // '#FFD700'

// Check label exists
debugLabels.getStatistics().totalLabels > 0;
```

**Screenshot:**
- Electrical route with yellow wires
- Debug label showing:
  - "Electrical Route"
  - ⚡ 120V / 15A
  - 3-core 14 AWG
  - Ø 8.0mm
  - Connectors: NEMA-5-15 → IEC-C13
  - Length, segments, status
- Save as: `docs/images/routing-electrical-with-label.png`

**Pass Criteria:**
- [ ] 3 yellow wires visible
- [ ] Wire diameter ~3mm
- [ ] Wires follow route path
- [ ] Material slightly emissive
- [ ] Label floats above route
- [ ] Label shows correct specs

---

## Test 7: Pipe Route with Debug Label (20 min)

**Steps:**
1. Create pipe route with 2+ bends
2. Generate geometry
3. Enable debug labels
4. Observe:
   - Blue pipe (40mm diameter)
   - Elbow joints at bends
   - Floating label

**Console Check:**
```javascript
const pipe = scene.getMeshByName('pipe_' + routeId);
pipe.material.diffuseColor.toHexString(); // '#00D9FF'

// Check elbows exist
scene.meshes.filter(m => m.name.includes('elbow')).length > 0;
```

**Screenshot:**
- Pipe route with blue cylinder and elbows
- Debug label showing:
  - "Pipe Route"
  - Size: 1/2" (steel)
  - Ø 40.0mm OD / 16.0mm ID
  - Fluid: water @ X L/min
  - Pressure rating
- Save as: `docs/images/routing-pipe-with-label.png`

**Pass Criteria:**
- [ ] Blue pipe visible (40mm diameter)
- [ ] Elbow joints at bends
- [ ] Metallic material (reflective)
- [ ] No gaps between segments
- [ ] Label shows pipe specs

---

## Test 8: Cable Tray Route with Debug Label (20 min)

**Steps:**
1. Create cable tray route
2. Generate geometry
3. Enable debug labels
4. Observe:
   - Orange U-shaped channel
   - Ladder rungs (every 200mm)
   - 400mm width

**Console Check:**
```javascript
const tray = scene.getMeshByName('cable_tray_' + routeId);
tray.material.diffuseColor.toHexString(); // '#FF8C00'

// Check rungs
scene.meshes.filter(m => m.name.includes('tray-rung')).length > 0;
```

**Screenshot:**
- Cable tray with orange channel and rungs
- Debug label showing:
  - "Cable Tray Route"
  - 400mm × 75mm
  - Type: Ladder (galvanized-steel)
  - Load rating
- Save as: `docs/images/routing-cable-tray-with-label.png`

**Pass Criteria:**
- [ ] Orange U-shaped channel
- [ ] Width 400mm, height 75mm
- [ ] Ladder rungs visible
- [ ] Matte metal material
- [ ] Label shows tray specs

---

## Test 9: Conduit Route with Debug Label (20 min)

**Steps:**
1. Create conduit route
2. Generate geometry
3. Enable debug labels
4. Observe:
   - Green tube (25mm diameter)
   - Smooth bends
   - Junction boxes (if implemented)

**Console Check:**
```javascript
const conduit = scene.getMeshByName('conduit_' + routeId);
conduit.material.diffuseColor.toHexString(); // '#00FF00'
```

**Screenshot:**
- Conduit with green tube
- Debug label showing:
  - "Conduit Route"
  - Size: 1/2" (EMT)
  - Ø 25.0mm
  - Max Wires: X (Y% fill)
- Save as: `docs/images/routing-conduit-with-label.png`

**Pass Criteria:**
- [ ] Green tube visible (25mm diameter)
- [ ] Semi-glossy material
- [ ] Smooth bends (not elbows)
- [ ] Label shows conduit specs

---

## Test 10: Mixed Route Types (20 min)

**Steps:**
1. Create all 4 types in same scene:
   - 1 electrical (yellow)
   - 1 pipe (blue)
   - 1 cable tray (orange)
   - 1 conduit (green)
2. Generate geometry for all
3. Enable debug labels
4. Observe:
   - All 4 types visible
   - Colors clearly distinguish types
   - No overlapping labels

**Console Check:**
```javascript
// Count each type
{
  electrical: scene.meshes.filter(m => m.name.includes('cable')).length,
  pipe: scene.meshes.filter(m => m.name.includes('pipe')).length,
  cable_tray: scene.meshes.filter(m => m.name.includes('cable_tray')).length,
  conduit: scene.meshes.filter(m => m.name.includes('conduit')).length
}

// Check label count
debugLabels.getStatistics().totalLabels === 4;
```

**Screenshot:**
- All 4 route types in same scene
- All 4 labels visible
- Colors clearly distinguished
- Save as: `docs/images/routing-mixed-with-labels.png`

**Pass Criteria:**
- [ ] All 4 types visible
- [ ] Colors distinguish types
- [ ] No z-fighting
- [ ] All labels show correct info
- [ ] Labels don't overlap

---

## 🐛 Bug Reporting

**If you find any issues, document:**

1. **Issue Description:**
   - What went wrong?
   - Expected behavior?
   - Actual behavior?

2. **Console Errors:**
   ```javascript
   // Capture any errors
   console.error(...);
   ```

3. **Screenshot:**
   - Capture the issue visually

4. **Steps to Reproduce:**
   - Exact steps to recreate issue

**Report Format:**
```markdown
## Bug: [Short Description]

**Expected:** [What should happen]
**Actual:** [What happened instead]
**Console Error:** [Any error messages]
**Screenshot:** [Link to image]
**Steps:**
1. Step 1
2. Step 2
3. ...
```

---

## ✅ Completion Checklist

### UI Polish Tests (5)
- [ ] ExpertModeLayout quad viewports ✓
- [ ] Professional ribbon toolbar ✓
- [ ] MeasurementTools glow effects ✓
- [ ] ExportDialog card UI ✓
- [ ] Mode switch transitions ✓

### Geometry Tests (5)
- [ ] Electrical with label ✓
- [ ] Pipe with label ✓
- [ ] Cable tray with label ✓
- [ ] Conduit with label ✓
- [ ] Mixed types with labels ✓

### Screenshots (10)
- [ ] All screenshots captured and saved

---

## 📝 Deliverables

When complete, you should have:

1. **10 Screenshots** in `docs/images/`:
   - 5 UI polish screenshots
   - 5 geometry + label screenshots

2. **Bug Report** (if any issues found):
   - Document in GitHub issue or markdown file

3. **Test Summary:**
   - Pass/Fail for each test
   - Any notes or observations

---

## 🚀 Commit Screenshots

```bash
git add docs/images/
git commit -m "docs: add routing feature screenshots

- Captured 5 UI polish screenshots
- Captured 5 geometry with debug label screenshots
- All tests passed successfully"
```

---

**Estimated Time:** 2-3 hours
**Priority:** HIGH - Final step before PR
**Use MCP Chrome DevTools for efficient testing!** 🚀
