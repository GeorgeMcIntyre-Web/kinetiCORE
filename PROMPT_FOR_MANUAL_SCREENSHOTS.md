# Manual Screenshot Capture - Geometry + Debug Labels

**Task:** Capture 5 remaining geometry screenshots with debug labels

**Estimated Time:** 20-30 minutes

**Prerequisites:**
- ✅ Debug labels integration complete (commit `093ae2b`)
- ✅ All 4 geometry generators working (Electrical, Pipe, Cable Tray, Conduit)
- ✅ RouteDebugLabels system functional
- ✅ UI polish complete

---

## Setup

### 1. Start Dev Server
```bash
cd c:/Users/George/source/repos/cursor/kinetiCORE
npm run dev
```

### 2. Open Browser
Navigate to: http://localhost:5173

### 3. Switch to Professional Mode
- Click mode dropdown (top right)
- Select "Professional"
- Wait for Professional layout to load

### 4. Enable Debug Labels
**Option A:** Press `D` key
**Option B:** Click Eye icon in Routing toolbar (right side)

---

## Screenshot Captures

### Screenshot 1: Electrical Route with Label

**Steps:**
1. In Professional mode, locate Routing toolbar
2. Select "Electrical" route type
3. Click in viewport to place 2 connection points:
   - Point A: Near origin (0, 0, 0)
   - Point B: ~2 meters away (2, 0.5, 0.5)
4. Click "Generate Route" button
5. Verify:
   - ✅ Yellow/gold wire bundle appears (3 wires, 3mm diameter)
   - ✅ Slight emissive glow on wires
   - ✅ Debug label floating above route showing:
     - Route type: "electrical"
     - Length (e.g., "2.24 m")
     - Segments count
     - Status: ✓ (green checkmark)
6. Position camera for clear view
7. **Capture:** Press Windows+Shift+S or use Snipping Tool
8. **Save as:** `docs/images/routing-electrical-with-label.png`

**Expected Appearance:**
- Wire color: #FFD700 (yellow/gold)
- Material: 30% emissive
- Label: Cyan border, dark background

---

### Screenshot 2: Pipe Route with Label

**Steps:**
1. Clear previous route (delete or create new)
2. Select "Pipe" route type
3. Place 2 connection points (similar positions)
4. Click "Generate Route"
5. Verify:
   - ✅ Blue pipe appears (40mm diameter)
   - ✅ Elbow joints at bends (torus geometry)
   - ✅ Metallic specular highlights
   - ✅ Debug label showing:
     - Route type: "pipe"
     - Diameter or nominal size
     - Length
     - Status: ✓
6. Position camera
7. **Capture:** Screenshot
8. **Save as:** `docs/images/routing-pipe-with-label.png`

**Expected Appearance:**
- Pipe color: #00D9FF (blue/cyan)
- Material: 0.8 specular (metallic)
- Smooth cylindrical geometry

---

### Screenshot 3: Cable Tray Route with Label

**Steps:**
1. Clear previous route
2. Select "Cable Tray" route type
3. Place 2 connection points
4. Click "Generate Route"
5. Verify:
   - ✅ Orange cable tray appears (400mm width)
   - ✅ Ladder-type rungs visible along length
   - ✅ Matte metal finish
   - ✅ Debug label showing:
     - Route type: "cable_tray"
     - Width (400mm)
     - Tray type (ladder)
     - Length
     - Status: ✓
6. Position camera for side/angle view (shows rungs clearly)
7. **Capture:** Screenshot
8. **Save as:** `docs/images/routing-cable-tray-with-label.png`

**Expected Appearance:**
- Tray color: #FF8C00 (orange)
- Material: 0.4 specular (matte metal)
- Rectangular cross-section with rungs

---

### Screenshot 4: Conduit Route with Label

**Steps:**
1. Clear previous route
2. Select "Conduit" route type
3. Place 2 connection points
4. Click "Generate Route"
5. Verify:
   - ✅ Green conduit appears (25mm diameter)
   - ✅ Semi-glossy finish
   - ✅ Smooth tube geometry
   - ✅ Debug label showing:
     - Route type: "conduit"
     - Nominal size (1/2")
     - Conduit type (EMT)
     - Length
     - Status: ✓
6. Position camera
7. **Capture:** Screenshot
8. **Save as:** `docs/images/routing-conduit-with-label.png`

**Expected Appearance:**
- Conduit color: #00FF00 (green)
- Material: 0.6 specular (semi-glossy)
- Thin cylindrical tube

---

### Screenshot 5: Mixed Route Types with Labels

**Steps:**
1. Create all 4 route types sequentially:
   - Electrical route (yellow)
   - Pipe route (blue)
   - Cable Tray route (orange)
   - Conduit route (green)
2. Position routes so they're all visible but not overlapping:
   - Arrange in parallel or slightly offset
   - Spread labels vertically to avoid overlap
3. Verify all 4 routes visible with labels:
   - ✅ 4 different colored routes
   - ✅ 4 debug labels (each with matching border color)
   - ✅ Labels showing different specifications
4. Zoom out for overview showing all routes
5. **Capture:** Screenshot
6. **Save as:** `docs/images/routing-mixed-with-labels.png`

**Expected Appearance:**
- 4 distinct route colors (yellow, blue, orange, green)
- 4 labels with color-coded borders
- Clear visual distinction between route types

---

## Quality Checklist

Before saving each screenshot, verify:
- [ ] Debug labels are visible (not hidden)
- [ ] Label text is readable (not too small)
- [ ] Route geometry is clearly visible
- [ ] Colors match specification (yellow/blue/orange/green)
- [ ] No UI elements blocking view (close panels if needed)
- [ ] Camera angle shows route and label together
- [ ] Screenshot is PNG format
- [ ] File saved to `docs/images/` directory
- [ ] Filename matches specification exactly

---

## Troubleshooting

**Issue:** Debug labels not appearing
- **Fix:** Press `D` key to toggle visibility
- **Check:** Eye icon in Routing toolbar should be highlighted

**Issue:** Routes not generating
- **Fix:** Ensure 2 connection points are created first
- **Check:** Connection points panel shows 2 points

**Issue:** Wrong colors
- **Fix:** Check route type selector before generating
- **Expected:**
  - Electrical: Yellow (#FFD700)
  - Pipe: Blue (#00D9FF)
  - Cable Tray: Orange (#FF8C00)
  - Conduit: Green (#00FF00)

**Issue:** Labels overlap in mixed screenshot
- **Fix:** Space routes further apart (2-3m between each)
- **Alternative:** Adjust camera angle for better label distribution

---

## After Capture

### 1. Verify Screenshots
```bash
ls -lh docs/images/routing-*.png
# Should show 10 files total:
# - 5 UI polish (already captured)
# - 5 geometry (newly captured)
```

### 2. Commit Screenshots
```bash
git add docs/images/routing-*.png
git commit -m "docs: add geometry screenshots with debug labels

Manually captured 5 geometry screenshots:
- Electrical route with yellow wires + label
- Pipe route with blue tubes + label
- Cable tray with orange ladder + label
- Conduit with green tube + label
- Mixed routes showing all 4 types + labels

All 10 screenshots now complete for smart routing system.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 3. Update Test Summary
Mark geometry tests as "Manual PASS" in documentation

### 4. Create Pull Request
All visual documentation complete → Ready for PR

---

## Expected Deliverables

**5 PNG Files:**
1. `routing-electrical-with-label.png` (~50-100KB)
2. `routing-pipe-with-label.png` (~50-100KB)
3. `routing-cable-tray-with-label.png` (~50-100KB)
4. `routing-conduit-with-label.png` (~50-100KB)
5. `routing-mixed-with-labels.png` (~100-150KB)

**Total:** ~300-500KB for all 5 images

---

## Success Criteria

- ✅ All 5 geometry types captured
- ✅ Debug labels visible on all routes
- ✅ Colors match specification
- ✅ Labels show correct information
- ✅ High quality, clear screenshots
- ✅ All files saved to correct location
- ✅ Files committed to git

**Estimated Total Time:** 20-30 minutes
