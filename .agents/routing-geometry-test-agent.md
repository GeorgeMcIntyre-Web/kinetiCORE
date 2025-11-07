# Routing Geometry Generation Test Agent

**Agent Type**: Worktree + Local
**Priority**: 🔴 Critical
**Estimated Time**: 4-5 hours
**Owner**: Cole (3D) + Edwin (UI verification)

## Context
The smart routing backend generates parametric geometry for different route types. Each type should create appropriate 3D mesh representations. This agent focuses on testing and verifying all 4 route type geometries.

---

## 🎯 Test Objectives

1. **Electrical Routing**: Thin wire mesh bundles
2. **Piping**: Cylindrical pipe meshes with elbows
3. **Cable Tray**: Rectangular channel meshes
4. **Conduit**: Protective tube meshes

Each type should:
- Generate correct geometry shape
- Respect route waypoints
- Show proper bends/elbows at corners
- Apply correct materials/colors
- Be selectable and editable
- Support undo/redo

---

## 📋 Route Type Tests

### Test 1: Electrical Wiring
**Route Type**: `electrical`
**Expected Geometry**: Thin cylindrical wire or bundle of wires

#### Test Procedure
```typescript
// File: src/routing/geometry/ElectricalGeometry.ts
// Expected behavior:

1. Place 2 connectors in scene
2. Create route between them
3. Click "Generate Geometry" in RouteInspector
4. Verify:
   - [x] Wire mesh created (thin cylinder, ~2-5mm diameter)
   - [x] Wire follows waypoints exactly
   - [x] Color: Yellow (#FFD700) or copper color
   - [x] Material: Emissive (visible in dark)
   - [x] Smooth curves at bends (no sharp corners)
   - [x] Mesh name: "electrical_route_{id}"
   - [x] Appears in scene tree under "Routing" collection
```

**Test Cases**:
- [ ] **Simple straight wire**: 2 connectors, straight line
  - Expected: Single cylinder from A to B
  - Wire diameter: 3mm

- [ ] **Wire with bends**: 3+ waypoints, multiple bends
  - Expected: Smooth curved wire following path
  - Bend radius respected (no sharp angles)

- [ ] **Wire bundle**: Multiple wires in same route
  - Expected: Several parallel wires (3-5) bundled together
  - Slight offset between wires for realism

- [ ] **Wire with obstacles**: Route around objects
  - Expected: Wire curves around obstacles smoothly

**Screenshot Targets**:
- `docs/images/routing-electrical-straight.png`
- `docs/images/routing-electrical-curved.png`
- `docs/images/routing-electrical-bundle.png`

---

### Test 2: Piping (Industrial/Water)
**Route Type**: `pipe`
**Expected Geometry**: Cylindrical pipe with elbow joints

#### Test Procedure
```typescript
// File: src/routing/geometry/PipeGeometry.ts
// Expected behavior:

1. Place 2 connectors
2. Set route type to "Pipe"
3. Create route with multiple bends
4. Click "Generate Geometry"
5. Verify:
   - [x] Pipe mesh created (cylinder ~25-50mm diameter)
   - [x] Color: Blue (#00D9FF) for water, gray for industrial
   - [x] Elbow joints at each bend point
   - [x] Pipe segments connect seamlessly
   - [x] Material: Metallic/glossy
   - [x] Supports at regular intervals (optional)
```

**Test Cases**:
- [ ] **Simple pipe run**: Straight pipe between 2 points
  - Expected: Single cylinder, uniform diameter
  - Pipe diameter: 40mm
  - Material: PBR metallic

- [ ] **Pipe with 90° elbow**: 2 segments at right angle
  - Expected: 2 cylinders + 1 elbow joint mesh
  - Elbow follows bend radius constraint
  - Seamless connection (no gaps)

- [ ] **Complex pipe route**: 5+ waypoints, multiple directions
  - Expected: Multiple segments + elbows
  - All joints aligned correctly
  - No mesh interpenetration

- [ ] **Pipe with supports**: Long run with support clamps
  - Expected: Pipe + support brackets every 2m
  - Supports attached to nearby surfaces

**Geometry Requirements**:
```typescript
// Pipe segment
const pipeRadius = 0.02; // 20mm (40mm diameter)
const pipe = BABYLON.MeshBuilder.CreateCylinder('pipe-segment', {
  height: segmentLength,
  diameter: pipeRadius * 2,
  tessellation: 24
}, scene);

// Elbow joint (90° bend)
const elbow = BABYLON.MeshBuilder.CreateTorus('pipe-elbow', {
  diameter: pipeRadius * 2,
  thickness: pipeRadius,
  tessellation: 16
}, scene);

// Material
const pipeMat = new BABYLON.PBRMaterial('pipe-material', scene);
pipeMat.metallic = 0.9;
pipeMat.roughness = 0.3;
pipeMat.albedoColor = BABYLON.Color3.FromHexString('#00D9FF');
```

**Screenshot Targets**:
- `docs/images/routing-pipe-straight.png`
- `docs/images/routing-pipe-elbow.png`
- `docs/images/routing-pipe-complex.png`

---

### Test 3: Cable Tray
**Route Type**: `cable_tray`
**Expected Geometry**: Rectangular channel/ladder mesh

#### Test Procedure
```typescript
// File: src/routing/geometry/CableTrayGeometry.ts
// Expected behavior:

1. Place connectors for cable tray route
2. Set route type to "Cable Tray"
3. Create elevated route (cable trays usually overhead)
4. Click "Generate Geometry"
5. Verify:
   - [x] Rectangular channel mesh (U-shape or ladder)
   - [x] Color: Orange (#FF8C00) or galvanized steel
   - [x] Rungs/crossbars visible (ladder style)
   - [x] Width: 300-600mm (standard sizes)
   - [x] Height: 50-100mm sides
   - [x] Corner transitions smooth
```

**Test Cases**:
- [ ] **Straight tray run**: Simple straight section
  - Expected: Rectangular channel mesh
  - Width: 400mm, Height: 75mm
  - Rungs every 200mm (ladder style)

- [ ] **Tray with vertical riser**: Goes from floor to ceiling
  - Expected: Horizontal + vertical sections connected
  - Smooth transition at corner (90° fitting)

- [ ] **Tray with reducer**: Changes width mid-run
  - Expected: Gradual taper between sections
  - No sudden width changes

- [ ] **Tray junction**: T-junction or cross
  - Expected: Special junction fitting mesh
  - All 3/4 directions connected properly

**Geometry Requirements**:
```typescript
// Cable tray segment (ladder type)
const trayWidth = 0.4; // 400mm
const trayHeight = 0.075; // 75mm
const rungSpacing = 0.2; // 200mm

// Create U-shaped channel
const leftSide = BABYLON.MeshBuilder.CreateBox('tray-left', {
  width: 0.01, height: trayHeight, depth: segmentLength
}, scene);

const rightSide = BABYLON.MeshBuilder.CreateBox('tray-right', {
  width: 0.01, height: trayHeight, depth: segmentLength
}, scene);

const bottom = BABYLON.MeshBuilder.CreateBox('tray-bottom', {
  width: trayWidth, height: 0.01, depth: segmentLength
}, scene);

// Add rungs
for (let i = 0; i < segmentLength; i += rungSpacing) {
  const rung = BABYLON.MeshBuilder.CreateBox('tray-rung', {
    width: trayWidth, height: 0.01, depth: 0.01
  }, scene);
  rung.position.z = i;
}

// Merge into single mesh
const tray = BABYLON.Mesh.MergeMeshes([leftSide, rightSide, bottom, ...rungs]);
```

**Screenshot Targets**:
- `docs/images/routing-cable-tray-straight.png`
- `docs/images/routing-cable-tray-riser.png`
- `docs/images/routing-cable-tray-junction.png`

---

### Test 4: Conduit
**Route Type**: `conduit`
**Expected Geometry**: Protective tube mesh (similar to pipe but thinner)

#### Test Procedure
```typescript
// File: src/routing/geometry/ConduitGeometry.ts
// Expected behavior:

1. Place connectors for conduit route
2. Set route type to "Conduit"
3. Create route (often wall/floor mounted)
4. Click "Generate Geometry"
5. Verify:
   - [x] Tube mesh created (20-30mm diameter)
   - [x] Color: Green (#00FF00) or gray
   - [x] Smooth bends (EMT/IMC style)
   - [x] Junction boxes at connection points
   - [x] Material: Metallic or PVC
```

**Test Cases**:
- [ ] **Simple conduit run**: Straight section
  - Expected: Cylinder mesh (25mm diameter)
  - Material: Metallic (galvanized)

- [ ] **Conduit with bends**: Multiple direction changes
  - Expected: Smooth curved bends (not elbows)
  - Bend radius > 6x conduit diameter

- [ ] **Conduit with junction box**: Connection point
  - Expected: Rectangular junction box mesh at connector
  - Conduit enters/exits box properly

- [ ] **Surface-mounted conduit**: Follows wall/ceiling
  - Expected: Conduit with mounting clips
  - Clips every 1m along run

**Geometry Requirements**:
```typescript
// Conduit tube
const conduitDiameter = 0.025; // 25mm
const conduit = BABYLON.MeshBuilder.CreateCylinder('conduit-segment', {
  height: segmentLength,
  diameter: conduitDiameter,
  tessellation: 16
}, scene);

// Junction box at connector
const jBox = BABYLON.MeshBuilder.CreateBox('junction-box', {
  width: 0.1, height: 0.1, depth: 0.05
}, scene);
jBox.position = connectorPosition;

// Material
const conduitMat = new BABYLON.PBRMaterial('conduit-mat', scene);
conduitMat.metallic = 0.8;
conduitMat.roughness = 0.4;
conduitMat.albedoColor = BABYLON.Color3.Gray();
```

**Screenshot Targets**:
- `docs/images/routing-conduit-straight.png`
- `docs/images/routing-conduit-curved.png`
- `docs/images/routing-conduit-junction.png`

---

## 🔍 Integration Tests

### Test 5: Mixed Route Types in Same Scene
**Objective**: Verify multiple route types coexist without conflicts

**Procedure**:
1. Create 1 electrical route (yellow wire)
2. Create 1 pipe route (blue pipe)
3. Create 1 cable tray route (orange tray)
4. Create 1 conduit route (green tube)
5. Generate geometry for all 4

**Verify**:
- [ ] All 4 types render correctly
- [ ] No mesh conflicts or z-fighting
- [ ] Colors distinguish each type clearly
- [ ] Scene tree shows all routes organized
- [ ] Selecting one route highlights only that route
- [ ] Undo works for each route independently

**Screenshot**: `docs/images/routing-mixed-types.png`

---

### Test 6: Route Editing After Geometry Generation
**Objective**: Verify geometry updates when route is edited

**Procedure**:
1. Create pipe route
2. Generate geometry → See blue pipe
3. Switch to "Edit Route" mode
4. Drag a waypoint to new position
5. Verify geometry updates in real-time

**Verify**:
- [ ] Geometry updates as waypoint moves
- [ ] No duplicate meshes created
- [ ] Pipe segments resize correctly
- [ ] Elbow joints reorient to new angles
- [ ] Material/color preserved
- [ ] Undo reverts geometry changes

---

### Test 7: Route Deletion and Cleanup
**Objective**: Verify proper mesh disposal

**Procedure**:
1. Create route with geometry
2. Delete route via scene tree or command
3. Check scene mesh count (F12 console)

**Verify**:
- [ ] Geometry mesh removed from scene
- [ ] No orphaned meshes in scene tree
- [ ] Memory released (check DevTools memory profiler)
- [ ] Undo restores both route and geometry

---

## 🎨 Visual Quality Checks

### Materials and Lighting
Each route type should look professional:

- [ ] **Electrical**: Slightly emissive (glows in dark)
- [ ] **Pipe**: Metallic PBR material (reflections)
- [ ] **Cable Tray**: Matte metal (galvanized look)
- [ ] **Conduit**: Semi-glossy plastic or metal

### Level of Detail (LOD)
For performance:

- [ ] Simple geometry at distance (low poly)
- [ ] Detailed geometry when close (high poly)
- [ ] Tessellation appropriate (pipes: 24, conduit: 16)

### Shadows and Reflections
- [ ] Pipes cast shadows on ground
- [ ] Metallic materials reflect environment
- [ ] No shadow artifacts or z-fighting

---

## 🧪 Automated Test Suite (Optional)

Create unit tests for geometry generators:

**File**: `src/routing/geometry/__tests__/ElectricalGeometry.test.ts`

```typescript
import { ElectricalGeometryGenerator } from '../ElectricalGeometry';
import * as BABYLON from '@babylonjs/core';

describe('ElectricalGeometryGenerator', () => {
  let scene: BABYLON.Scene;
  let generator: ElectricalGeometryGenerator;

  beforeEach(() => {
    // Setup test scene
    scene = new BABYLON.Scene(new BABYLON.NullEngine());
    generator = new ElectricalGeometryGenerator();
  });

  test('generates wire mesh for straight route', () => {
    const waypoints = [
      new BABYLON.Vector3(0, 0, 0),
      new BABYLON.Vector3(5, 0, 0)
    ];
    const mesh = generator.generate(waypoints, scene);

    expect(mesh).toBeDefined();
    expect(mesh.name).toContain('electrical');
    expect(mesh.getBoundingInfo().diagonalLength).toBeCloseTo(5);
  });

  test('respects bend radius constraints', () => {
    const waypoints = [
      new BABYLON.Vector3(0, 0, 0),
      new BABYLON.Vector3(0, 1, 0), // 90° turn
      new BABYLON.Vector3(1, 1, 0)
    ];
    const mesh = generator.generate(waypoints, scene, { minBendRadius: 0.1 });

    // Verify curve smoothness
    const vertices = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    expect(vertices).toBeDefined();
    // Additional assertions...
  });
});
```

**Similar tests for**:
- `PipeGeometry.test.ts`
- `CableTrayGeometry.test.ts`
- `ConduitGeometry.test.ts`

---

## 📊 Performance Benchmarks

### Target Metrics
- [ ] **Geometry Generation Time**: < 100ms per route
- [ ] **Mesh Polygon Count**: < 10,000 tris per route
- [ ] **Scene FPS**: 60 FPS with 20+ routes rendered
- [ ] **Memory Usage**: < 50 MB for 50 routes

### Profiling
```bash
# Run dev server with profiling
npm run dev

# Open DevTools → Performance
# Record while:
1. Creating 10 routes
2. Generating geometry for all
3. Editing routes
4. Deleting routes

# Check:
- No frame drops during editing
- No memory leaks over time
- GC pauses < 16ms
```

---

## ✅ Success Criteria

### Per Route Type
- [x] Geometry matches expected shape
- [x] Materials look professional
- [x] Colors match design spec
- [x] Editable after generation
- [x] Undo/redo works
- [x] Proper disposal on delete

### Overall System
- [x] All 4 route types work
- [x] Mixed routes in same scene
- [x] Performance acceptable
- [x] No console errors
- [x] Memory stable

---

## 📸 Documentation Outputs

After testing, create:

1. **Screenshot Grid**: All 4 types side-by-side
   - `docs/images/routing-all-types-comparison.png`

2. **Test Report**: [docs/ROUTING_GEOMETRY_TEST_RESULTS.md](../docs/ROUTING_GEOMETRY_TEST_RESULTS.md)
   ```markdown
   # Routing Geometry Test Results

   ## Test Date: 2025-11-01
   ## Tester: Cole

   ### Electrical ✅
   - Straight wire: Pass
   - Curved wire: Pass
   - Wire bundle: Pass

   ### Pipe ✅
   - Simple run: Pass
   - With elbows: Pass
   - Complex route: Pass

   ... (continue)
   ```

3. **Demo Video**: Record 2-3 min video showing all types
   - Upload to `docs/videos/routing-geometry-demo.mp4`

---

## 🐛 Known Issues to Check

From [docs/SMART_ROUTING_LIMITATIONS.md](../docs/SMART_ROUTING_LIMITATIONS.md):

- [ ] Verify Z-up coordinate system correct for all types
- [ ] Check elbow orientation matches direction of travel
- [ ] Ensure no gaps at segment connections
- [ ] Validate bend radius respected for all types

---

## Handoff

When complete:
1. Fill in all checkboxes above
2. Create test results markdown file
3. Commit screenshots to `docs/images/`
4. Update main README with geometry examples
5. Tag George for geometry code review
