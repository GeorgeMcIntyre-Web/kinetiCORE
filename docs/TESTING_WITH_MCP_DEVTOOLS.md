# Testing Smart Routing with MCP Chrome DevTools

**Branch:** `feature/smart-routing-system`
**MCP Integration:** Chrome DevTools for live browser testing

---

## 🔧 Setup

### Prerequisites
- ✅ MCP Chrome DevTools installed and connected
- ✅ Dev server running: `npm run dev`
- ✅ Browser open at http://localhost:5173

### MCP Commands Available
Use MCP to interact with Chrome DevTools directly from this conversation:

```
mcp__chrome-devtools__console - Run JavaScript in browser console
mcp__chrome-devtools__screenshot - Capture screenshots
mcp__chrome-devtools__network - Monitor network requests
mcp__chrome-devtools__performance - Profile performance
```

---

## 🧪 Test Plan

### Test 1: Verify UI Polish (All 5 Tasks)

#### 1.1 ExpertModeLayout Quad Viewports

**Visual Check:**
```javascript
// Run in browser console via MCP:
// Check if grid overlay is present
document.querySelectorAll('.grid-overlay').length === 4;

// Check if axis indicators are present
document.querySelectorAll('.axis-indicator').length === 4;

// Verify active viewport highlighting
document.querySelector('.viewport-quad.active') !== null;
```

**Manual Test:**
- [ ] Switch to Expert mode
- [ ] Click each of 4 viewports
- [ ] Verify cyan border appears on active viewport
- [ ] Check grid overlay is visible (20px squares)
- [ ] Check axis labels (X=red, Y=green, Z=blue)

**Screenshot:** `expert-mode-quad-viewports.png`

---

#### 1.2 Professional Ribbon Toolbar

**Visual Check:**
```javascript
// Check ribbon buttons exist
document.querySelectorAll('.ribbon-btn').length > 0;

// Check hover state CSS
getComputedStyle(document.querySelector('.ribbon-btn:hover')).background;

// Check active tool
document.querySelector('.ribbon-btn.active') !== null;
```

**Manual Test:**
- [ ] Switch to Professional mode
- [ ] Hover over toolbar buttons → cyan background appears
- [ ] Click a tool → active state shows cyan border
- [ ] Verify disabled tools have reduced opacity

**Screenshot:** `professional-ribbon-hover.png`

---

#### 1.3 MeasurementTools with Glow

**Visual Check:**
```javascript
// Check if GlowLayer exists
scene.getGlowLayerByName('measurement-glow') !== null;

// Check marker materials
scene.meshes.filter(m => m.name.includes('marker')).forEach(m => {
  console.log(m.material.emissiveColor); // Should be cyan
});
```

**Manual Test:**
- [ ] Open Measurement Tools panel
- [ ] Click "Distance"
- [ ] Click 2 points in scene
- [ ] Verify markers glow cyan
- [ ] Check measurement line is visible
- [ ] Result panel appears with animation

**Screenshot:** `measurement-tools-glow.png`

**Console Check:**
```javascript
// Verify GlowLayer intensity
const gl = scene.getGlowLayerByName('measurement-glow');
console.log('Glow intensity:', gl?.intensity); // Should be 0.8
```

---

#### 1.4 ExportDialog Card UI

**Visual Check:**
```javascript
// Check export format cards
document.querySelectorAll('.export-format-card').length === 3;

// Check badges
document.querySelectorAll('.format-badge').length === 3;

// Check selected state
document.querySelector('.export-format-card.selected') !== null;
```

**Manual Test:**
- [ ] Open Export dialog
- [ ] Verify 3 cards visible with icons
- [ ] Check badges: "Fastest", "Recommended", "Complete"
- [ ] Click card → selected state with cyan border
- [ ] Hover → subtle cyan background

**Screenshot:** `export-dialog-cards.png`

---

#### 1.5 Mode Switching Transitions

**Visual Check:**
```javascript
// Check mode switcher dropdown
document.querySelectorAll('.keyboard-hint').length === 3;

// Check for Ctrl+1/2/3 hints
Array.from(document.querySelectorAll('.keyboard-hint'))
  .map(el => el.textContent); // ['Ctrl+1', 'Ctrl+2', 'Ctrl+3']
```

**Manual Test:**
- [ ] Open mode dropdown
- [ ] Verify keyboard shortcuts visible (Ctrl+1/2/3)
- [ ] Switch modes → smooth fade animation (0.3s)
- [ ] Check translateY animation

**Screenshot:** `mode-switcher-dropdown.png`

---

### Test 2: Geometry Generators with Debug Labels

#### 2.1 Electrical Route (Yellow Wire Bundle)

**Setup Code:**
```javascript
// Run in browser console to create test route
const electricalSpec = {
  voltage: 120,
  current: 15,
  coreCount: 3,
  wireGauge: '14 AWG',
  outerDiameter: 0.008,
  connectorA: { type: 'NEMA-5-15', voltage: 125, current: 15 },
  connectorB: { type: 'IEC-C13', voltage: 250, current: 10 }
};

// Create route (pseudo-code, adapt to your routing API)
// const route = createElectricalRoute(point1, point2);
// const mesh = cableGenerator.generate(route);
// debugLabels.createRouteLabel(route, mesh, electricalSpec);
```

**Visual Verification:**
```javascript
// Check wire bundle exists
scene.meshes.filter(m => m.name.includes('cable')).length > 0;

// Check wire color (yellow/gold)
const cable = scene.getMeshByName('cable_' + routeId);
console.log(cable.material.diffuseColor); // Should be yellow #FFD700

// Check wire diameter
console.log('Wire diameter:', cable.scaling); // Should be ~3mm
```

**Manual Test:**
- [ ] Create electrical route
- [ ] Generate geometry
- [ ] Verify 3 yellow wires bundled together
- [ ] Each wire ~3mm diameter
- [ ] Wires follow route path
- [ ] Material is slightly emissive (glows in dark)

**Debug Label Check:**
- [ ] Label shows: "Electrical Route"
- [ ] Shows: ⚡ 120V / 15A
- [ ] Shows: 3-core 14 AWG
- [ ] Shows: Ø 8.0mm
- [ ] Shows connectors: NEMA-5-15 → IEC-C13
- [ ] Status: ✓ Generated (green)

**Screenshot:** `routing-electrical-with-label.png`

---

#### 2.2 Pipe Route (Blue Cylinders with Elbows)

**Setup Code:**
```javascript
const pipeSpec = {
  nominalSize: '1/2"',
  outerDiameter: 0.04, // 40mm
  material: 'steel',
  fluidType: 'water',
  flowRate: 10, // L/min
  pressureRating: 150 // PSI
};

// Create pipe route with bends
// const route = createPipeRoute(points);
// const mesh = pipeGenerator.generate(route);
// debugLabels.createRouteLabel(route, mesh, pipeSpec);
```

**Visual Verification:**
```javascript
// Check pipe exists
const pipe = scene.getMeshByName('pipe_' + routeId);
console.log('Pipe color:', pipe.material.diffuseColor); // Should be blue #00D9FF

// Check diameter
console.log('Pipe diameter:', pipe.scaling); // Should be 40mm

// Check elbow joints
scene.meshes.filter(m => m.name.includes('elbow')).length > 0;
```

**Manual Test:**
- [ ] Create pipe route with 2+ bends
- [ ] Generate geometry
- [ ] Verify blue cylinder (40mm diameter)
- [ ] Elbow joints at each bend
- [ ] Metallic material (reflective)
- [ ] No gaps between segments

**Debug Label Check:**
- [ ] Label shows: "Pipe Route"
- [ ] Shows: Size 1/2" (steel)
- [ ] Shows: Ø 40.0mm OD / 16.0mm ID
- [ ] Shows: Fluid: water @ 10 L/min
- [ ] Shows: Pressure: 150 PSI
- [ ] Shows length and segments

**Screenshot:** `routing-pipe-with-label.png`

---

#### 2.3 Cable Tray Route (Orange Channel with Rungs)

**Setup Code:**
```javascript
const cableTraySpec = {
  width: 0.4, // 400mm
  height: 0.075, // 75mm
  trayType: 'ladder',
  material: 'galvanized-steel',
  loadRating: 50,
  maxCables: 20
};

// Create cable tray route
// const route = createCableTrayRoute(points);
// const mesh = cableTrayGenerator.generate(route);
// debugLabels.createRouteLabel(route, mesh, cableTraySpec);
```

**Visual Verification:**
```javascript
// Check cable tray exists
const tray = scene.getMeshByName('cable_tray_' + routeId);
console.log('Tray color:', tray.material.diffuseColor); // Should be orange #FF8C00

// Check rungs (ladder style)
scene.meshes.filter(m => m.name.includes('tray-rung')).length > 0;
```

**Manual Test:**
- [ ] Create cable tray route
- [ ] Generate geometry
- [ ] Verify orange U-shaped channel
- [ ] Width: 400mm, Height: 75mm
- [ ] Ladder rungs visible (every 200mm)
- [ ] Matte metal material

**Debug Label Check:**
- [ ] Label shows: "Cable Tray Route"
- [ ] Shows: 400mm × 75mm
- [ ] Shows: Type: Ladder (galvanized-steel)
- [ ] Shows: Load: 50 kg/m | Max Cables: 20

**Screenshot:** `routing-cable-tray-with-label.png`

---

#### 2.4 Conduit Route (Green Tube with Junction Boxes)

**Setup Code:**
```javascript
const conduitSpec = {
  nominalSize: '1/2"',
  outerDiameter: 0.025, // 25mm
  conduitType: 'EMT',
  material: 'steel',
  maxWires: 6,
  fillPercentage: 40
};

// Create conduit route
// const route = createConduitRoute(points);
// const mesh = conduitGenerator.generate(route);
// debugLabels.createRouteLabel(route, mesh, conduitSpec);
```

**Visual Verification:**
```javascript
// Check conduit exists
const conduit = scene.getMeshByName('conduit_' + routeId);
console.log('Conduit color:', conduit.material.diffuseColor); // Should be green #00FF00

// Check diameter
console.log('Conduit diameter:', conduit.scaling); // Should be 25mm
```

**Manual Test:**
- [ ] Create conduit route
- [ ] Generate geometry
- [ ] Verify green tube (25mm diameter)
- [ ] Semi-glossy material
- [ ] Smooth bends (not elbows)

**Debug Label Check:**
- [ ] Label shows: "Conduit Route"
- [ ] Shows: Size: 1/2" (EMT)
- [ ] Shows: Ø 25.0mm
- [ ] Shows: Max Wires: 6 (40% fill)

**Screenshot:** `routing-conduit-with-label.png`

---

### Test 3: Mixed Route Types in Same Scene

**Setup Code:**
```javascript
// Create all 4 types
const routes = [
  createElectricalRoute(),
  createPipeRoute(),
  createCableTrayRoute(),
  createConduitRoute()
];

routes.forEach((route, i) => {
  const mesh = generators[i].generate(route);
  debugLabels.createRouteLabel(route, mesh, specs[i]);
});
```

**Visual Verification:**
```javascript
// Check all 4 types exist
const typeCount = {
  electrical: scene.meshes.filter(m => m.name.includes('cable')).length,
  pipe: scene.meshes.filter(m => m.name.includes('pipe')).length,
  cable_tray: scene.meshes.filter(m => m.name.includes('cable_tray')).length,
  conduit: scene.meshes.filter(m => m.name.includes('conduit')).length
};
console.log('Route types:', typeCount);

// Check colors distinguish types
const colors = scene.meshes.map(m => m.material?.diffuseColor);
console.log('Unique colors:', new Set(colors.map(c => c?.toHexString())));
```

**Manual Test:**
- [ ] All 4 types visible in same scene
- [ ] Colors clearly distinguish each type:
  - Yellow (electrical)
  - Blue (pipe)
  - Orange (cable tray)
  - Green (conduit)
- [ ] No z-fighting or overlap issues
- [ ] All labels show correct information
- [ ] Labels don't overlap

**Screenshot:** `routing-mixed-with-labels.png`

---

### Test 4: Performance Testing

**Performance Metrics:**
```javascript
// Use MCP Chrome DevTools performance profiling
// Target: 60 FPS with 20+ routes

// Check polygon count
const totalTris = scene.meshes.reduce((sum, m) =>
  sum + (m.getTotalVertices() || 0), 0
);
console.log('Total triangles:', totalTris);
console.log('Target: < 200,000 for 20 routes');

// Check memory
performance.memory && console.log('Memory:',
  (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB'
);

// Check FPS
scene.onAfterRenderObservable.add(() => {
  console.log('FPS:', engine.getFps().toFixed(0));
});
```

**Benchmarks:**
- [ ] Geometry generation: < 100ms per route
- [ ] Polygon count: < 10,000 tris per route
- [ ] Scene FPS: 60 FPS with 20+ routes
- [ ] Memory usage: < 50 MB for 50 routes

---

## 📸 Screenshot Capture Guide

### Using MCP Chrome DevTools

**Capture Individual Screenshots:**
```
Use mcp__chrome-devtools__screenshot to capture each test result
```

**Naming Convention:**
- `expert-mode-quad-viewports.png`
- `professional-ribbon-hover.png`
- `measurement-tools-glow.png`
- `export-dialog-cards.png`
- `mode-switcher-dropdown.png`
- `routing-electrical-with-label.png`
- `routing-pipe-with-label.png`
- `routing-cable-tray-with-label.png`
- `routing-conduit-with-label.png`
- `routing-mixed-with-labels.png`

**Save Location:** `docs/images/`

---

## 🐛 Debugging with MCP

### Common Issues and Console Checks

**Issue: Labels not appearing**
```javascript
// Check if RouteDebugLabels is initialized
window.debugLabels !== undefined;

// Check if labels are visible
debugLabels?.getStatistics();
// { totalLabels: 4, visibleLabels: 4 }

// Toggle visibility
debugLabels?.setVisible(true);
```

**Issue: Wrong colors**
```javascript
// Check material colors
scene.meshes.forEach(m => {
  if (m.material) {
    console.log(m.name, m.material.diffuseColor.toHexString());
  }
});

// Expected:
// cable_*: #FFD700 (yellow)
// pipe_*: #00D9FF (blue)
// cable_tray_*: #FF8C00 (orange)
// conduit_*: #00FF00 (green)
```

**Issue: Glow not working**
```javascript
// Check GlowLayer
const gl = scene.getGlowLayerByName('measurement-glow');
console.log('GlowLayer exists:', gl !== null);
console.log('GlowLayer intensity:', gl?.intensity);
console.log('Included meshes:', gl?.includedOnlyMeshes.length);
```

**Issue: UI not responding**
```javascript
// Check React state
// (If you've exposed state to window for debugging)
console.log('UI Mode:', window.appState?.uiMode);
console.log('Transform Mode:', window.appState?.transformMode);
console.log('Active Viewport:', window.appState?.activeViewport);
```

---

## ✅ Test Completion Checklist

### UI Polish (5 Tasks)
- [ ] ExpertModeLayout quad viewports tested ✓
- [ ] Professional ribbon toolbar tested ✓
- [ ] MeasurementTools glow effects tested ✓
- [ ] ExportDialog card UI tested ✓
- [ ] Mode switch transitions tested ✓

### Geometry with Debug Labels (4 Types)
- [ ] Electrical route tested ✓
- [ ] Pipe route tested ✓
- [ ] Cable tray route tested ✓
- [ ] Conduit route tested ✓

### Screenshots Captured (10 Required)
- [ ] UI screenshots (5)
- [ ] Geometry screenshots (5)

### Performance
- [ ] FPS benchmark completed ✓
- [ ] Memory profiling completed ✓

---

## 🚀 Next Steps After Testing

1. **If all tests pass:**
   - Commit screenshots to `docs/images/`
   - Update README with new images
   - Create PR

2. **If issues found:**
   - Document in browser console
   - Create bug fix commits
   - Re-test

3. **Performance optimization (if needed):**
   - Reduce polygon count
   - Enable LOD (Level of Detail)
   - Use compact labels mode

---

**Status:** 🟢 Ready for MCP-assisted browser testing
**Estimated Time:** 2-3 hours for complete test suite
