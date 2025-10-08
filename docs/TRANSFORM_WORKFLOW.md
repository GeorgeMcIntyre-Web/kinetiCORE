# Transform Controls & Snapping - User Workflow Guide

## Overview
Complete guide for Essential users to position objects precisely using the new transform system.

---

## 📍 UI Layout

When you **select an object**, these panels appear:

### 1. **Transform HUD** (Bottom-Right)
- Real-time position (X, Y, Z in mm)
- Real-time rotation (Rx, Ry, Rz in degrees)
- **Editable** - click any value to type exact coordinates
- Updates **10 times/second** while gizmo is dragged

### 2. **Transform Settings Panel** (Top-Left, below camera controls)
- **Collapsed by default** - click header to expand
- Configure position/rotation increments
- Enable/disable snapping modes
- Hidden when no object selected

### 3. **Temporary Origin Panel** (Top-Left, below Transform Settings)
- Set custom reference points
- Appears when object selected
- Collapsed by default

---

## 🎯 Workflow 1: Basic Positioning

### Goal: Move an object to exact coordinates

**Steps:**
1. **Select** object in 3D view
2. **Look at Transform HUD** (bottom-right)
3. **Click** on X, Y, or Z value
4. **Type** new coordinate (e.g., `500` for 500mm)
5. **Press Enter** - object moves instantly

**Example:**
```
Current: X: 123.5, Y: 456.2, Z: 0.0
Target:  X: 500.0, Y: 500.0, Z: 100.0

→ Click X field → Type "500" → Enter
→ Click Y field → Type "500" → Enter
→ Click Z field → Type "100" → Enter
```

---

## ⚙️ Workflow 2: Set Custom Increments

### Goal: Move object in 5mm steps instead of default 10mm

**Steps:**
1. **Select** object
2. **Expand** Transform Settings panel (click header)
3. Under **Position Increment**:
   - Click preset button `5` for 5mm steps
   - OR type custom value (e.g., `2.5`)
4. Now **arrow keys** and **mouse wheel** move in 5mm increments
5. Transform HUD inputs also use 5mm steps

**Presets Available:**
- **Position**: 1, 5, 10, 25, 50, 100mm
- **Rotation**: 1, 5, 15, 30, 45, 90 degrees

---

## 🧲 Workflow 3: Snap to Grid

### Goal: Align object to 100mm grid

**Steps:**
1. **Select** object to align
2. **Expand** Transform Settings panel
3. **Enable** "Enable Snapping" checkbox
4. **Check** "Grid" option (enabled by default)
5. **Select** grid size: 10, 50, 100, 500, or 1000mm
6. **Drag** object with gizmo - it snaps to grid automatically

**OR use Inspector Snap button:**
1. Select object
2. Open Inspector (right panel)
3. Click **"Snap" button** under Position
4. Object jumps to nearest 100mm grid point

---

## 📐 Workflow 4: Snap Vertex-to-Vertex

### Goal: Align corner of Box A to corner of Box B

**Steps:**
1. **Select** Box A (object to move)
2. **Expand** Transform Settings
3. **Enable** "Enable Snapping"
4. **Enable** "Vertex" checkbox
5. Set **Snap Distance** to `10mm` (how close to trigger snap)
6. **Drag** Box A near Box B's corner
7. When within 10mm, Box A **snaps to exact vertex**

**Visual Feedback:**
- Small **orange sphere** appears at snap point
- Object "magnetically" pulls to vertex

---

## 🎯 Workflow 5: Temporary Origin

### Goal: Move object 50mm along a specific edge

**Why needed:** Default gizmo moves along world X/Y/Z axes, but you want to move along the object's edge direction.

**Steps:**
1. **Select** object
2. **Expand** Temporary Origin panel
3. Click **"From Selection"** button
   - Sets origin to object's current position
   - Orange sphere + axes appear in 3D view
4. Now **Transform HUD coordinates** are relative to this origin
5. Move object using relative coordinates
6. Click **"Clear Origin"** when done

**Alternative - Snap To Point:**
1. Enable snapping in Transform Settings
2. Click **"Snap To Point"** in Temporary Origin
3. Click on any vertex/edge/face in 3D view
4. That point becomes new origin

---

## 🔧 Workflow 6: Precision Assembly

### Goal: Assemble two parts with exact alignment

**Steps:**
1. **Position Part A roughly** using gizmo
2. **Enable all snap types**:
   - ✅ Vertex
   - ✅ Edge
   - ✅ Face
   - ✅ Center
3. **Drag Part A** near Part B
4. System finds **best snap** in priority order:
   - Vertex (most precise)
   - Edge
   - Face
   - Center
5. **Fine-tune** using Transform HUD numeric inputs

**Example: Mounting Plate on Robot:**
```
1. Import robot URDF
2. Import plate STL
3. Enable vertex snapping
4. Drag plate near mounting holes
5. Vertices snap perfectly
6. Use Transform HUD to add 2mm offset if needed
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **G** | Switch to Move (translate) mode |
| **R** | Switch to Rotate mode |
| **S** | Switch to Scale mode |
| **↑↓←→** | Move by position increment (uses Transform Settings) |
| **Scroll Wheel** | Rotate by rotation increment |
| **Shift + Scroll** | Fine adjust (1/10th increment) |
| **Tab** | Cycle through Transform HUD fields |

---

## 🐛 Troubleshooting

### "Transform HUD not showing"
→ Select an object first

### "Snapping not working"
→ Check "Enable Snapping" checkbox in Transform Settings
→ Increase "Snap Distance" threshold

### "Can't type in Transform HUD"
→ Click directly on the number value (not the label)
→ Make sure object is selected

### "Increments not changing behavior"
→ Arrow keys and wheel use increments automatically
→ Transform HUD also respects them

### "Temporary origin not visible"
→ Look for small orange sphere with red/green/blue axes
→ May be inside geometry - zoom in

### "Panels covering other UI"
→ They only appear when object selected
→ Collapse them by clicking panel headers
→ Positioned top-left to avoid camera controls

---

## 💡 Pro Tips

1. **Quick Snap to Grid**: Use Inspector "Snap" button for instant grid alignment
2. **Copy Coordinates**: Click Transform HUD value → Ctrl+C → use elsewhere
3. **Relative Positioning**: Set temporary origin, then use offsets in Transform HUD
4. **Multiple Objects**: Select multiple → Transform HUD shows first object
5. **Precision**: Set increment to 0.1mm for ultra-fine control

---

## 🎓 Learning Path

### Beginner (Day 1):
1. Use Transform HUD to enter exact coordinates
2. Try preset increments (5mm, 10mm, 50mm)
3. Enable grid snapping

### Intermediate (Week 1):
1. Use temporary origin for relative moves
2. Experiment with vertex/edge/face snapping
3. Combine snapping modes

### Advanced (Month 1):
1. Custom increments for specific tasks
2. Snap distance optimization
3. Complex assembly workflows
4. Origin-based coordinate systems

---

## 📋 Quick Reference Card

```
┌─────────────────────────────────────────┐
│  TRANSFORM CONTROLS CHEAT SHEET         │
├─────────────────────────────────────────┤
│                                         │
│  Position Entry:                        │
│   • Click HUD value → Type → Enter      │
│                                         │
│  Increments:                            │
│   • Transform Settings → Select preset  │
│   • Arrow keys use increment            │
│                                         │
│  Snapping:                              │
│   • Enable in Transform Settings        │
│   • Priority: Vertex > Edge > Face      │
│   • Adjust snap distance threshold      │
│                                         │
│  Temp Origin:                           │
│   • From Selection = use object origin  │
│   • World Zero = reset to 0,0,0         │
│   • Snap To Point = click to set        │
│                                         │
└─────────────────────────────────────────┘
```

---

## ✅ Verification Tests

After setup, verify features work:

**Test 1: Exact Positioning**
- [ ] Select box
- [ ] Transform HUD shows position
- [ ] Type X=100, Y=100, Z=0
- [ ] Object moves to exact coordinates

**Test 2: Custom Increment**
- [ ] Set position increment to 5mm
- [ ] Press arrow key once
- [ ] Position changes by exactly 5mm

**Test 3: Grid Snap**
- [ ] Enable grid snapping (100mm)
- [ ] Drag object with gizmo
- [ ] Releases on grid lines (0, 100, 200, etc.)

**Test 4: Vertex Snap**
- [ ] Create two boxes
- [ ] Enable vertex snapping
- [ ] Drag Box A near Box B corner
- [ ] Corners align perfectly

**Test 5: Temporary Origin**
- [ ] Select object
- [ ] Set origin "From Selection"
- [ ] Orange marker appears
- [ ] Transform HUD shows 0,0,0

---

## 🆘 Support

If features don't work as described:
1. Check browser console for errors
2. Verify object is selected
3. Try different snap distance values
4. Check coordinate system (Z-up vs Y-up)

For bugs, report at: https://github.com/anthropics/claude-code/issues

---

**Last Updated:** 2025-10-08
**Version:** 1.0.0
**Feature Branch:** `feature/transform-controls-snap-system`
