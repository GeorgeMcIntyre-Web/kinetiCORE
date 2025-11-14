# Circle-Center Snapping Feature - Complete Handoff Document

## Overview
This document provides complete context for implementing circle-center snapping in kinetiCORE. The foundation is complete, and circle fitting logic needs to be added.

---

## Goal
Enable users to snap to the center point of circular features (holes, bolt patterns, cylindrical edges) on 3D models. This is critical for industrial CAD workflows where precise alignment to circle centers is required.

**Snap Types to Support:**
1. **Vertex** - Snap to individual vertices (✅ EXISTING)
2. **Edge Midpoint** - Snap to middle of edges (✅ EXISTING)
3. **Face Center** - Snap to center of faces (✅ EXISTING)
4. **Object Center** - Snap to bounding box center (✅ EXISTING)
5. **Circle Center** - Snap to center of circular features (🚧 IN PROGRESS)

---

## Current Status

### ✅ Completed Foundation
- **File:** `debug/vertex_debug_minimal.html`
- **Purpose:** Standalone test harness for circle detection algorithm
- **Working Features:**
  - Screen-space vertex selection (10px radius)
  - STL duplicate vertex deduplication
  - Orange dot visualization of candidates
  - Async mesh building with race condition prevention
  - Guaranteed sync between displayed dots and logged vertices

### 🚧 Next Step: Circle Fitting
Need to implement the actual circle fitting algorithm that:
1. Takes the candidate vertices
2. Validates they form a circle (not a line/random points)
3. Calculates the circle center in 3D space
4. Returns the snap target position

### ❌ Not Yet Started
- Integration into main application (`src/manipulation/SnappingHelper.ts`)
- UI toggle for circle-center snap mode
- Performance optimization (spatial indexing)
- Multi-mesh support

---

## Technical Architecture

### File Structure
```
debug/
├── vertex_debug_minimal.html      # Test harness (WORKING)
└── DOT_ALIGNMENT_BUG_HANDOFF.md  # Previous bug investigation

src/manipulation/
├── SnappingHelper.ts              # Main snap logic (needs circle integration)
└── snapIndex.ts                   # Snap type definitions

docs/
└── SNAP_DEBUG_IMPLEMENTATION.md   # Earlier documentation
```

### Key Algorithm (from vertex_debug_minimal.html)

**Lines 196-257: Candidate Selection & Deduplication**
```javascript
// 1. Screen-space selection (10px radius)
const PIXEL_RADIUS = 10;
for (const vertex of vertices) {
  const screen = projectToScreen(vertex);
  const dist = Math.sqrt((screen.x - pickX)² + (screen.y - pickY)²);
  if (dist <= PIXEL_RADIUS) {
    candidateVertices.push(vertex);
  }
}

// 2. Deduplicate STL vertices
const EPSILON = 0.0001;
const uniqueVertices = [];
for (const vertex of candidateVertices) {
  const isDuplicate = uniqueVertices.some(v =>
    Math.abs(v.x - vertex.x) < EPSILON &&
    Math.abs(v.y - vertex.y) < EPSILON &&
    Math.abs(v.z - vertex.z) < EPSILON
  );
  if (!isDuplicate) uniqueVertices.push(vertex);
}

// 3. Create orange dots (async)
currentBuildId++;
const pcs = new BABYLON.PointsCloudSystem('candidates', 6, scene);
pcs.addPoints(uniqueVertices.length, (particle, i) => {
  particle.position = uniqueVertices[i];
});
pcs.buildMeshAsync().then(m => {
  if (thisBuildId !== currentBuildId) {
    m.dispose(); // Stale build, discard
    return;
  }
  candidateDots = m;
  displayedCandidates = candidatesSnapshot;
});
```

### Critical Design Decisions

#### Why 10px Screen-Space Radius?
- Started at 100px → selected multiple circles
- Reduced to 20px → still too many
- **Current: 10px** → selects ~5-20 vertices from one circle
- **Adjustable:** Change `PIXEL_RADIUS` constant (line 198)

#### Why Deduplication is Essential
STL files store vertices per-triangle without sharing:
```
Triangle 1: (0, 0, 0), (1, 0, 0), (1, 1, 0)
Triangle 2: (1, 0, 0), (1, 1, 0), (2, 1, 0)  // Duplicates (1,0,0) and (1,1,0)
```
Without deduplication:
- **Visible:** 10 orange dots
- **Logged:** 50+ vertices (mostly duplicates)

With deduplication:
- **Visible:** 10 orange dots
- **Logged:** 10 unique vertices ✅

#### Race Condition Prevention
**Problem:** User moves mouse rapidly
```
t=0ms:  Mouse at A → Start building dots for A (async)
t=10ms: Mouse at B → Start building dots for B (async)
t=20ms: A completes → Shows wrong dots
t=30ms: B completes → Shows correct dots
```

**Solution:** Build ID tracking
```javascript
let currentBuildId = 0;

// On mouse move
currentBuildId++;
const thisBuildId = currentBuildId;

// In async callback
if (thisBuildId !== currentBuildId) {
  m.dispose(); // This build is stale
  return;
}
```

---

## Integration Plan

### Phase 1: Circle Fitting Algorithm (NEXT TASK)
**File to Edit:** `debug/vertex_debug_minimal.html`

Add after line 295 (click handler):
```javascript
function fitCircle(vertices) {
  // 1. Validate input
  if (vertices.length < 3) {
    return { valid: false, reason: 'Too few points' };
  }

  // 2. Project to 2D plane (find best-fit plane using SVD/PCA)
  const plane = fitPlane(vertices);
  const points2D = vertices.map(v => projectToPlane(v, plane));

  // 3. Fit circle using least-squares
  // Minimize: Σ(||p_i - center|| - radius)²
  const circle2D = leastSquaresCircle(points2D);

  // 4. Validate circularity
  const residuals = points2D.map(p =>
    Math.abs(distance(p, circle2D.center) - circle2D.radius)
  );
  const avgResidual = mean(residuals);
  const maxResidual = max(residuals);

  if (maxResidual > 0.01 * circle2D.radius) {
    return { valid: false, reason: 'Points do not form a circle' };
  }

  // 5. Convert 2D circle center back to 3D
  const center3D = unprojectFromPlane(circle2D.center, plane);

  return {
    valid: true,
    center: center3D,
    radius: circle2D.radius,
    normal: plane.normal,
    residual: avgResidual
  };
}
```

**Required Math Functions:**
- `fitPlane(points)` - SVD or PCA to find best-fit plane
- `projectToPlane(point, plane)` - 3D → 2D projection
- `leastSquaresCircle(points2D)` - Algebraic circle fit
- `unprojectFromPlane(point2D, plane)` - 2D → 3D back-projection

**Libraries to Consider:**
- `numeric.js` - SVD implementation
- `ml-matrix` - Matrix operations for PCA
- Or implement simple covariance-based PCA

### Phase 2: Visual Feedback
Add after circle fitting:
```javascript
// Show fitted circle as red wireframe
const circlePoints = [];
for (let i = 0; i <= 32; i++) {
  const angle = (i / 32) * 2 * Math.PI;
  const p2D = {
    x: circle2D.center.x + circle2D.radius * Math.cos(angle),
    y: circle2D.center.y + circle2D.radius * Math.sin(angle)
  };
  const p3D = unprojectFromPlane(p2D, plane);
  circlePoints.push(p3D);
}
const circleMesh = BABYLON.MeshBuilder.CreateLines('fittedCircle', {
  points: circlePoints
}, scene);
circleMesh.color = new BABYLON.Color3(1, 0, 0); // Red

// Show center as green sphere
const centerMesh = BABYLON.MeshBuilder.CreateSphere('center', {
  diameter: 0.01
}, scene);
centerMesh.position = circle.center;
centerMesh.material = greenMaterial;
```

### Phase 3: Integration into Main App
**File:** `src/manipulation/SnappingHelper.ts`

Current structure:
```typescript
export class SnappingHelper {
  private snapMode: SnapMode = 'vertex'; // vertex | edge | face | object

  public findSnapTarget(
    mousePos: Vector2,
    meshes: Mesh[]
  ): SnapTarget | null {
    switch (this.snapMode) {
      case 'vertex': return this.snapToVertex(mousePos, meshes);
      case 'edge': return this.snapToEdgeMidpoint(mousePos, meshes);
      case 'face': return this.snapToFaceCenter(mousePos, meshes);
      case 'object': return this.snapToObjectCenter(mousePos, meshes);
      default: return null;
    }
  }
}
```

Add circle-center mode:
```typescript
// 1. Update SnapMode type (src/manipulation/snapIndex.ts)
export type SnapMode =
  | 'vertex'
  | 'edge'
  | 'face'
  | 'object'
  | 'circle-center';

// 2. Add method to SnappingHelper
private snapToCircleCenter(
  mousePos: Vector2,
  meshes: Mesh[]
): SnapTarget | null {
  // Port logic from vertex_debug_minimal.html
  const candidates = this.getCandidateVertices(mousePos, meshes, 10);
  const unique = this.deduplicateVertices(candidates, 0.0001);

  if (unique.length < 3) return null;

  const circle = fitCircle(unique);
  if (!circle.valid) return null;

  return {
    position: circle.center,
    type: 'circle-center',
    metadata: {
      radius: circle.radius,
      normal: circle.normal,
      residual: circle.residual,
      pointCount: unique.length
    }
  };
}

// 3. Update switch statement
case 'circle-center':
  return this.snapToCircleCenter(mousePos, meshes);
```

### Phase 4: UI Toggle
**File:** `src/ui/components/SnapSetupPopup.tsx`

Add button to snap mode toolbar:
```tsx
<button
  onClick={() => setSnapMode('circle-center')}
  className={snapMode === 'circle-center' ? 'active' : ''}
  title="Snap to circle centers"
>
  <CircleIcon /> {/* Or "O" text */}
  Circle Center
</button>
```

### Phase 5: Performance Optimization
**Current bottleneck:** Loop through all 50k+ vertices on every mouse move

**Solution:** Spatial indexing (implement ONE of these)

#### Option A: KD-Tree (Already exists!)
```typescript
// File exists: src/babylon/pointCloud/KDTree.ts
import { KDTree } from '../babylon/pointCloud/KDTree';

// Build once at load time
const kdTree = new KDTree(vertices, 3);

// Query on mouse move (fast!)
const candidates = kdTree.kNearest(worldPos, 50, maxDistance);
```

#### Option B: Octree
```typescript
import { Octree } from '@babylonjs/core';

const octree = new Octree(/* config */);
vertices.forEach(v => octree.addItem(v));

// Query
const candidates = octree.findNearby(worldPos, radius);
```

**Performance Impact:**
- Before: O(N) per mouse move (N = 50,000+)
- After: O(log N) per mouse move (~16 comparisons for 50k vertices)

---

## File Format Compatibility

### Current: STL Files ✅
- Vertex source: `mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)`
- Transform: Local → world via `Vector3.TransformCoordinates()`
- Duplication: HIGH (triangles don't share vertices)

### Future: URDF Files
- Same Babylon.js API works
- May need to handle mesh hierarchies (parent transforms)
- Duplication: Varies by internal format

### Future: GLB/GLTF Files
- Same Babylon.js API works
- Duplication: LOWER (indexed geometry)

**Universal Approach (works for all formats):**
```javascript
function loadVertices(babylonMesh) {
  const positions = babylonMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  babylonMesh.computeWorldMatrix(true);
  const worldMatrix = babylonMesh.getWorldMatrix();

  const vertices = [];
  for (let i = 0; i < positions.length; i += 3) {
    const local = new BABYLON.Vector3(positions[i], positions[i+1], positions[i+2]);
    const world = BABYLON.Vector3.TransformCoordinates(local, worldMatrix);
    vertices.push(world);
  }

  return deduplicateVertices(vertices, 0.0001);
}
```

---

## Testing Strategy

### Unit Tests (debug/vertex_debug_minimal.html)
1. **Circle detection** - Load circle.stl, verify center found
2. **Line rejection** - Load line.stl, verify circle not detected
3. **Duplicate handling** - Verify unique vertex count
4. **Zoom independence** - Verify 10px radius at different zoom levels

### Integration Tests (src/manipulation/)
1. **Multi-mesh** - Multiple objects, select circle on one
2. **File formats** - Test STL, URDF, GLB
3. **Edge cases:**
   - Overlapping circles (select closest)
   - Partial circles/arcs (may reject or accept)
   - Ellipses (should reject)
   - Tiny circles (<1mm) at high zoom

### Performance Tests
1. **Large models** - 100k+ vertices, measure frame rate
2. **Rapid mouse movement** - Verify no stuttering
3. **Memory leaks** - Dispose meshes properly

---

## Configuration Reference

### Constants (vertex_debug_minimal.html)
```javascript
PIXEL_RADIUS = 10           // Screen-space selection radius
EPSILON = 0.0001           // Spatial deduplication tolerance (0.1mm)
pointSize = 6              // Orange dot size
buildMeshAsync = true      // Must be async for non-blocking
```

### Snap Mode Keyboard Shortcuts (Future)
```
V - Vertex snap
E - Edge midpoint snap
F - Face center snap
O - Object center snap
C - Circle center snap  ← NEW
```

---

## Known Issues & Gotchas

### 1. STL Coordinate System
kinetiCORE uses **Z-up** (CAD/ROS standard). Verify circle normal is correct in Z-up space.

### 2. Circle vs Ellipse
Current algorithm will fit a circle even to ellipse points. Add eccentricity check:
```javascript
if (circle.residual > 0.05 * circle.radius) {
  return { valid: false, reason: 'Points form ellipse, not circle' };
}
```

### 3. Coplanar Requirement
Points must lie on a plane for circle fitting. If points are from 3D sphere surface, fitting will fail.

### 4. Async Disposal
Always check `buildId` before using async results to prevent memory leaks.

### 5. Performance with Many Circles
If model has 100+ circles, spatial indexing is REQUIRED. Without it, frame rate will drop below 30 FPS.

---

## Git Branch Strategy

**Current branch:** `wip/circle-center-snapping`

**Files to commit:**
- ✅ `debug/vertex_debug_minimal.html` - Working test harness
- ✅ `SNAP_CIRCLE_CENTER_HANDOFF.md` - This document
- ❌ 70+ files with whitespace changes - REVERT THESE

**How to clean up:**
```bash
# Keep only snap-related changes
git add debug/vertex_debug_minimal.html
git add debug/DOT_ALIGNMENT_BUG_HANDOFF.md
git add SNAP_CIRCLE_CENTER_HANDOFF.md
git add SNAP_DEBUG_ALIGNMENT_FIX.md

# Revert whitespace changes in all other files
git checkout -- .

# Re-add the kept files
git add debug/vertex_debug_minimal.html
git add debug/DOT_ALIGNMENT_BUG_HANDOFF.md
git add SNAP_CIRCLE_CENTER_HANDOFF.md
git add SNAP_DEBUG_ALIGNMENT_FIX.md

# Commit clean state
git commit -m "feat: Add circle-center snap candidate selection

- Implement screen-space vertex selection (10px radius)
- Add STL duplicate vertex deduplication
- Create orange dot visualization for candidates
- Prevent async race conditions with build ID tracking
- Foundation ready for circle fitting algorithm integration"
```

---

## Next Developer Tasks

### Immediate (Phase 1)
1. **Implement circle fitting** in `vertex_debug_minimal.html`
   - Add SVD/PCA for plane fitting
   - Add least-squares circle fit
   - Add circularity validation
   - Test with various STL models

### Short-term (Phase 2-3)
2. **Add visual feedback** (red circle, green center dot)
3. **Integrate into SnappingHelper.ts**
4. **Add UI toggle** in SnapSetupPopup.tsx

### Long-term (Phase 4-5)
5. **Performance optimization** (KD-tree integration)
6. **Multi-mesh support**
7. **Comprehensive testing**

---

## Resources

### Mathematical Background
- **Circle Fitting:** [Least-Squares Circle Fit](https://dtcenter.org/sites/default/files/community-code/met/docs/write-ups/circle_fit.pdf)
- **PCA/SVD:** [Principal Component Analysis Tutorial](https://arxiv.org/abs/1404.1100)
- **Plane Fitting:** [Best-Fit Plane Algorithm](https://www.ilikebigbits.com/2015_03_04_plane_from_points.html)

### Libraries
- [numeric.js](http://www.numericjs.com/) - SVD/matrix operations
- [ml-matrix](https://github.com/mljs/matrix) - Linear algebra
- [regression-js](https://github.com/Tom-Alexander/regression-js) - Curve fitting

### Babylon.js Docs
- [PointsCloudSystem](https://doc.babylonjs.com/features/featuresDeepDive/particles/point_cloud_system)
- [Vector3 API](https://doc.babylonjs.com/typedoc/classes/BABYLON.Vector3)
- [Matrix Operations](https://doc.babylonjs.com/typedoc/classes/BABYLON.Matrix)

### kinetiCORE Docs
- `CLAUDE.md` - Project overview
- `COORDINATE_SYSTEM.md` - Z-up coordinate standard
- `docs/PHYSICS_API.md` - Physics integration guide

---

## Questions for Next Developer

1. **Circle fitting library preference?**
   - Option A: Implement from scratch (more control, no dependencies)
   - Option B: Use numeric.js (faster implementation)
   - Option C: Use ml-matrix (TypeScript native)

2. **Snap preview style?**
   - Red circle wireframe + green center dot?
   - Just green center dot?
   - Include radius dimension text?

3. **Keyboard shortcut for circle mode?**
   - 'C' for Circle?
   - 'O' for Origin (circle origin)?
   - Number key (1=vertex, 2=edge, etc.)?

4. **Multi-circle selection behavior?**
   - Always snap to closest circle?
   - Show all nearby circles, let user pick?
   - Increase PIXEL_RADIUS if no circle found?

---

## Success Criteria

### Phase 1 Complete When:
- ✅ `fitCircle()` returns valid center for circular point sets
- ✅ Rejects non-circular patterns (lines, random points)
- ✅ Works with 5-100 vertices
- ✅ Red wireframe circle visualizes fit
- ✅ Green sphere shows center point

### Final Integration Complete When:
- ✅ Circle-center snap available in main app UI
- ✅ Keyboard shortcut toggles mode
- ✅ Works with STL, URDF, GLB files
- ✅ No performance degradation (<50ms snap detection)
- ✅ Unit tests pass
- ✅ Documentation updated

---

## Contact & Handoff

**Prepared by:** Claude Code (Agent 1 - George's team)
**Date:** 2025-11-12
**Branch:** `wip/circle-center-snapping`
**Test URL:** http://localhost:8080/debug/vertex_debug_minimal.html

**Next Agent:** Cursor/GPT-4.5
**Recommended Start:** Phase 1 - Circle fitting implementation

**All foundation work is complete and tested. The path forward is clear.**
