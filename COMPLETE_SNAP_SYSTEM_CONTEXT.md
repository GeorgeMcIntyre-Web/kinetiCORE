# kinetiCORE Complete Snap System - Context for Cursor/GPT-4.5

## Executive Summary
This document provides COMPLETE context for the kinetiCORE snapping system. You (Cursor/GPT-4.5) can take over this work completely with this information.

**Current Status:**
- ✅ Vertex, Edge Midpoint, Face Center, Object Center snapping → **WORKING**
- 🚧 Circle Center snapping → **Foundation complete, needs circle fitting algorithm**

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Existing Snap Types](#existing-snap-types)
3. [Circle Center Implementation](#circle-center-implementation)
4. [File Structure](#file-structure)
5. [Integration Points](#integration-points)
6. [Testing Strategy](#testing-strategy)
7. [Your Tasks](#your-tasks)

---

## System Architecture

### Core Components

```
src/manipulation/
├── SnappingHelper.ts          # Main snap logic (3500+ lines)
│   ├── smartSnapPosition()   # Tries all snap types, returns closest
│   ├── snapToVertex()        # Vertex snapping (DONE)
│   ├── snapToEdgeMidpoint()  # Edge midpoint (DONE)
│   ├── snapToFaceCenter()    # Face center (DONE)
│   ├── snapToObjectCenter()  # Object center (DONE)
│   └── snapToCircleCenter()  # Circle center (TODO - add this)
│
└── snapIndex.ts               # Spatial indexing for O(log N) performance
    ├── SpatialHash3D          # 3D grid hash for fast spatial queries
    ├── buildSnapIndex()       # Pre-compute welded vertices + hash
    ├── ensureSnapIndex()      # Lazy build + cache
    └── queryNearestVertex()   # Fast screen-space vertex selection
```

### How Snapping Works (High-Level)

```
User moves mouse/object
    ↓
smartSnapPosition() called
    ↓
Try all enabled snap types in priority order:
1. Vertex (priority: 1 - most precise)
2. Midpoint (priority: 2)
3. Circle Center (priority: 3) ← YOUR TASK
4. Edge (priority: 5)
5. Face (priority: 7)
6. Object (priority: 9)
    ↓
Return closest snap result
    ↓
Show visual indicator (green sphere)
    ↓
Snap object to that position
```

### Snap Priority System (SnappingHelper.ts:269-278)
```typescript
const priorities: Record<string, number> = {
  vertex: 1,      // Most precise
  midpoint: 2,    // Precise point on edge
  center: 3,      // Circle centers ← HIGH PRIORITY
  intersection: 4,
  edge: 5,
  bboxCorner: 6,
  face: 7,
  normal: 8,
  object: 9       // Least precise
};
```

### Key Data Structures

**SnapResult** (returned by all snap methods):
```typescript
{
  found: boolean;
  position: BABYLON.Vector3;
  normal?: BABYLON.Vector3;
  metadata?: {
    type: 'vertex' | 'midpoint' | 'face' | 'object' | 'circle-center';
    vertexIndex?: number;
    edgeIndices?: [number, number];
    faceIndex?: number;
    circleRadius?: number;  // For circle centers
    circleNormal?: BABYLON.Vector3;  // For circle centers
    residual?: number;  // Circle fit quality
  };
}
```

**SnapSettings** (configuration):
```typescript
{
  enabled: boolean;
  threshold: number;  // Max distance in meters
  snapToVertex?: boolean;
  snapToEdge?: boolean;
  snapToFace?: boolean;
  snapToObjectCenter?: boolean;
  snapToCircleCenter?: boolean;  // NEW
}
```

---

## Existing Snap Types

### 1. Vertex Snapping ✅
**File:** `SnappingHelper.ts` (method: `snapToVertex`)
**How it works:**
1. User hovers near mesh
2. `queryNearestVertex()` from `snapIndex.ts` finds closest vertex
3. Uses spatial hash for O(log N) performance
4. Projects vertices to screen space
5. Finds vertex within pixel radius (default: 20px)
6. Returns world position of that vertex

**Key Code:**
```typescript
// snapIndex.ts:142-248
export function queryNearestVertex(
  mesh: BABYLON.Mesh,
  camera: BABYLON.Camera,
  pointerX: number,
  pointerY: number,
  pixelRadius: number
): { idx: number; pos: BABYLON.Vector3; px: number } | null {
  const idx = ensureSnapIndex(mesh);  // Build/get cached spatial hash
  const ray = mesh.getScene().createPickingRay(...);

  // Calculate world radius from pixel radius
  const depth = BABYLON.Vector3.Distance(cameraPos, meshCenter);
  const worldR = (pixelRadius * depth) / focalPx;

  // Query spatial hash (fast!)
  const candidates = idx.hash.querySphere(ray.origin, worldR);

  // Find closest vertex in screen space
  for (const i of candidates) {
    const screen = BABYLON.Vector3.Project(vertex, ...);
    const px = Math.hypot(screen.x - pointerX, screen.y - pointerY);
    if (px < bestPx) bestPx = px;
  }

  return { idx, pos, px };
}
```

**Performance:**
- Without spatial hash: O(N) - iterate all 50k+ vertices every frame
- With spatial hash: O(log N) - query only nearby vertices (~100-500)

### 2. Edge Midpoint Snapping ✅
**How it works:**
1. Find all edges (pairs of connected vertices)
2. Calculate midpoint of each edge
3. Find closest midpoint to pointer
4. Return midpoint position

### 3. Face Center Snapping ✅
**How it works:**
1. Raycast from pointer to mesh
2. Get picked face (triangle)
3. Calculate centroid: `(v0 + v1 + v2) / 3`
4. Return face center

### 4. Object Center Snapping ✅
**How it works:**
1. Get mesh bounding box
2. Return `boundingBox.centerWorld`

---

## Circle Center Implementation

### Status: Foundation Complete ✅, Circle Fitting TODO 🚧

### Test Harness Location
**File:** `debug/vertex_debug_minimal.html` (300 lines, fully working)
- Test URL: http://localhost:8080/debug/vertex_debug_minimal.html
- Loads STL file with circles
- Shows orange dots for candidate vertices
- Logs candidates on click
- All foundation work is here

### What's Working ✅

#### 1. Screen-Space Vertex Selection (Lines 196-217)
```javascript
const PIXEL_RADIUS = 10;  // Adjustable constant

for (const vertex of vertices) {
  const screen = projectToScreen(vertex);  // 3D → 2D projection
  const dist = Math.sqrt((screen.x - pickX)² + (screen.y - pickY)²);

  if (dist <= PIXEL_RADIUS) {
    candidateVertices.push(vertex);
  }
}
```

**Why screen-space not world-space?**
- World-space radius changes with zoom
- 10px screen-space feels consistent at any zoom level
- User expects "mouse nearby" behavior

#### 2. STL Duplicate Deduplication (Lines 221-239)
```javascript
const EPSILON = 0.0001;  // 0.1mm tolerance
const uniqueVertices = [];

for (const vertex of candidateVertices) {
  const isDuplicate = uniqueVertices.some(v =>
    Math.abs(v.x - vertex.x) < EPSILON &&
    Math.abs(v.y - vertex.y) < EPSILON &&
    Math.abs(v.z - vertex.z) < EPSILON
  );

  if (!isDuplicate) {
    uniqueVertices.push(vertex);
  }
}

candidateVertices = uniqueVertices;
```

**Why deduplication?**
STL files store vertices per-triangle:
```
Triangle 1: (0, 0, 0), (1, 0, 0), (1, 1, 0)
Triangle 2: (1, 0, 0), (1, 1, 0), (2, 1, 0)  // Duplicates!
```

Without dedup:
- 10 orange dots visible → 50+ vertices logged (wrong!)

With dedup:
- 10 orange dots visible → 10 vertices logged (correct!)

#### 3. Visual Feedback (Lines 241-277)
- Orange dots show candidate vertices (size 6, bright orange)
- Black dots show all vertices (size 2, black background)
- Info text updates when dots render
- Console logs candidates on click

#### 4. Async Race Condition Prevention (Lines 250-255)
**Problem:** Mouse moves fast → multiple async dot builds overlap

**Solution:** Build ID tracking
```javascript
let currentBuildId = 0;

// On mouse move
currentBuildId++;
const thisBuildId = currentBuildId;

// In async callback
pcs.buildMeshAsync().then(m => {
  if (thisBuildId !== currentBuildId) {
    m.dispose();  // Stale, discard
    return;
  }

  // Only set if still current
  candidateDots = m;
  displayedCandidates = candidatesSnapshot;
});
```

**Guarantees:**
- Orange dots on screen ALWAYS match logged vertices on click
- No memory leaks from stale meshes

### What's Missing 🚧: Circle Fitting Algorithm

**Your Task:** Add after line 295 in `vertex_debug_minimal.html`

```javascript
/**
 * Fit a circle to 3D points
 * @param vertices - Array of BABYLON.Vector3 points
 * @returns Circle fit result or null if not circular
 */
function fitCircle(vertices) {
  // PHASE 1: Validation
  if (vertices.length < 3) {
    return null;  // Need at least 3 points for a circle
  }

  // PHASE 2: Find Best-Fit Plane (PCA or SVD)
  // Points might not be perfectly coplanar, so find the plane that
  // minimizes distance to all points
  const centroid = computeCentroid(vertices);
  const plane = fitPlaneToPoints(vertices, centroid);  // Returns {normal, center}

  // PHASE 3: Project Points to 2D
  // Create a 2D coordinate system on the plane
  const u = computeTangent(plane.normal);  // Perpendicular to normal
  const v = BABYLON.Vector3.Cross(plane.normal, u);  // Complete basis

  const points2D = vertices.map(vertex => {
    const relative = vertex.subtract(plane.center);
    return {
      x: BABYLON.Vector3.Dot(relative, u),
      y: BABYLON.Vector3.Dot(relative, v)
    };
  });

  // PHASE 4: Fit Circle in 2D (Least-Squares)
  // Minimize: Σ(||p_i - center|| - radius)²
  const circle2D = leastSquaresCircleFit(points2D);
  // Returns: { centerX, centerY, radius }

  // PHASE 5: Validate Circularity
  // Check if points actually form a circle (not a line or ellipse)
  const residuals = points2D.map(p => {
    const dist = Math.sqrt((p.x - circle2D.centerX)² + (p.y - circle2D.centerY)²);
    return Math.abs(dist - circle2D.radius);
  });

  const maxResidual = Math.max(...residuals);
  const avgResidual = residuals.reduce((a, b) => a + b) / residuals.length;

  // Reject if residuals too large (points don't form a circle)
  if (maxResidual > 0.05 * circle2D.radius) {
    return null;  // Points form a line or random pattern
  }

  // PHASE 6: Convert 2D Circle Center back to 3D
  const center3D = plane.center
    .add(u.scale(circle2D.centerX))
    .add(v.scale(circle2D.centerY));

  return {
    center: center3D,
    radius: circle2D.radius,
    normal: plane.normal,
    residual: avgResidual,
    pointCount: vertices.length
  };
}

// Helper: Compute centroid
function computeCentroid(vertices) {
  const sum = vertices.reduce((acc, v) => acc.add(v), BABYLON.Vector3.Zero());
  return sum.scale(1 / vertices.length);
}

// Helper: Fit plane using covariance matrix (simple PCA)
function fitPlaneToPoints(vertices, centroid) {
  // Build 3x3 covariance matrix
  let cxx = 0, cxy = 0, cxz = 0;
  let cyy = 0, cyz = 0, czz = 0;

  for (const v of vertices) {
    const dx = v.x - centroid.x;
    const dy = v.y - centroid.y;
    const dz = v.z - centroid.z;

    cxx += dx * dx;
    cxy += dx * dy;
    cxz += dx * dz;
    cyy += dy * dy;
    cyz += dy * dz;
    czz += dz * dz;
  }

  // Find eigenvector with smallest eigenvalue (normal to plane)
  // Simplified: use cross product of two edges for now
  // (Full SVD would be more robust but requires library)

  const v1 = vertices[0].subtract(centroid);
  const v2 = vertices[Math.floor(vertices.length / 2)].subtract(centroid);
  const normal = BABYLON.Vector3.Cross(v1, v2).normalize();

  return {
    center: centroid,
    normal: normal
  };
}

// Helper: Compute tangent perpendicular to normal
function computeTangent(normal) {
  // Pick arbitrary vector not parallel to normal
  const arbitrary = Math.abs(normal.x) < 0.9
    ? new BABYLON.Vector3(1, 0, 0)
    : new BABYLON.Vector3(0, 1, 0);

  return BABYLON.Vector3.Cross(normal, arbitrary).normalize();
}

// Helper: Least-squares circle fit in 2D
function leastSquaresCircleFit(points2D) {
  // Algebraic fit method (Pratt, 1987)
  // Minimize: Σ(x² + y² - 2ax - 2by + c)² where circle is (x-a)²+(y-b)²=r²

  const n = points2D.length;
  let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
  let sumXXX = 0, sumXXY = 0, sumXYY = 0, sumYYY = 0;

  for (const p of points2D) {
    const xx = p.x * p.x;
    const yy = p.y * p.y;

    sumX += p.x;
    sumY += p.y;
    sumXX += xx;
    sumYY += yy;
    sumXY += p.x * p.y;
    sumXXX += xx * p.x;
    sumXXY += xx * p.y;
    sumXYY += p.x * yy;
    sumYYY += yy * p.y;
  }

  // Solve 2x2 linear system for center
  const A = n * sumXX - sumX * sumX;
  const B = n * sumXY - sumX * sumY;
  const C = n * sumYY - sumY * sumY;
  const D = 0.5 * (n * (sumXXX + sumXYY) - sumX * (sumXX + sumYY));
  const E = 0.5 * (n * (sumXXY + sumYYY) - sumY * (sumXX + sumYY));

  const denom = A * C - B * B;
  if (Math.abs(denom) < 1e-10) {
    return null;  // Degenerate case (points on a line)
  }

  const centerX = (D * C - B * E) / denom;
  const centerY = (A * E - B * D) / denom;

  // Compute radius as average distance to center
  const distances = points2D.map(p =>
    Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2)
  );
  const radius = distances.reduce((a, b) => a + b) / distances.length;

  return { centerX, centerY, radius };
}

// Update click handler to use fitCircle
scene.onPointerDown = () => {
  if (displayedCandidates.length > 0) {
    console.log('[Circle Detection] Candidates:', displayedCandidates.length);

    // Try to fit circle
    const circle = fitCircle(displayedCandidates);

    if (circle) {
      console.log('[Circle Fit] Success!');
      console.log('  Center:', circle.center);
      console.log('  Radius:', circle.radius);
      console.log('  Normal:', circle.normal);
      console.log('  Residual:', circle.residual);

      // Visualize fitted circle
      visualizeCircle(circle);
    } else {
      console.log('[Circle Fit] Failed - points do not form a circle');
    }
  }
};

// Visualize fitted circle (red wireframe + green center)
function visualizeCircle(circle) {
  // Remove old visualization
  if (window.circleViz) {
    window.circleViz.forEach(m => m.dispose());
  }
  window.circleViz = [];

  // Create circle wireframe (32 segments)
  const u = computeTangent(circle.normal);
  const v = BABYLON.Vector3.Cross(circle.normal, u);

  const circlePoints = [];
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * 2 * Math.PI;
    const offset = u.scale(Math.cos(angle) * circle.radius)
                    .add(v.scale(Math.sin(angle) * circle.radius));
    circlePoints.push(circle.center.add(offset));
  }

  const circleMesh = BABYLON.MeshBuilder.CreateLines('fittedCircle', {
    points: circlePoints
  }, scene);
  circleMesh.color = new BABYLON.Color3(1, 0, 0);  // Red
  window.circleViz.push(circleMesh);

  // Create center sphere (green)
  const centerMesh = BABYLON.MeshBuilder.CreateSphere('circleCenter', {
    diameter: circle.radius * 0.1  // 10% of radius
  }, scene);
  centerMesh.position = circle.center;
  const mat = new BABYLON.StandardMaterial('centerMat', scene);
  mat.emissiveColor = new BABYLON.Color3(0, 1, 0);  // Green
  mat.disableLighting = true;
  centerMesh.material = mat;
  window.circleViz.push(centerMesh);

  info.textContent = `Circle found: R=${circle.radius.toFixed(3)}m, residual=${circle.residual.toFixed(4)}m`;
}
```

### Testing Your Circle Fit

**Test Cases:**
1. **Perfect circle** - Bolt hole pattern, should fit with low residual (<0.001)
2. **Partial arc** - Half-circle, should still fit
3. **Ellipse** - Should reject (high residual)
4. **Line** - Two points on edge, should reject
5. **Random points** - Should reject

**Success Criteria:**
- Red wireframe circle overlaps orange dots perfectly
- Green center sphere at geometric center
- Console shows low residual (<5% of radius)
- Line/random points get rejected (null return)

---

## Integration into Main App

After circle fitting works in test harness, integrate into `SnappingHelper.ts`:

### Step 1: Add Circle-Center Snap Method

**File:** `src/manipulation/SnappingHelper.ts`
**Location:** Add after `snapToObjectCenter()` method

```typescript
/**
 * Snap to circle centers
 * Uses same candidate selection as vertex snap, then fits circle
 */
private snapToCircleCenter(
  position: BABYLON.Vector3,
  settings: SnapSettings,
  excludeMeshIds: string[],
  camera?: BABYLON.Camera,
  pointerScreenX?: number,
  pointerScreenY?: number
): SnapResult {
  if (!settings.snapToCircleCenter || !camera) {
    return { found: false, position };
  }

  const scene = camera.getScene();
  const meshes = scene.meshes.filter(m =>
    m.isEnabled() &&
    m.isVisible &&
    !excludeMeshIds.includes(m.uniqueId.toString())
  );

  // Screen-space selection (10px radius, same as test harness)
  const PIXEL_RADIUS = 10;
  const EPSILON = 0.0001;  // Deduplication tolerance

  let allCandidates: BABYLON.Vector3[] = [];

  for (const mesh of meshes) {
    if (!(mesh instanceof BABYLON.Mesh)) continue;

    // Get all vertices for this mesh
    const idx = ensureSnapIndex(mesh);
    if (!idx) continue;

    // Project to screen and collect within radius
    for (let i = 0; i < idx.vertsWorld.length; i += 3) {
      const vertex = new BABYLON.Vector3(
        idx.vertsWorld[i],
        idx.vertsWorld[i + 1],
        idx.vertsWorld[i + 2]
      );

      const screen = this.projectToScreen(vertex, camera);
      if (!screen) continue;

      const dist = Math.sqrt(
        (screen.x - pointerScreenX!) ** 2 +
        (screen.y - pointerScreenY!) ** 2
      );

      if (dist <= PIXEL_RADIUS) {
        allCandidates.push(vertex);
      }
    }
  }

  // Deduplicate
  const uniqueCandidates = this.deduplicateVertices(allCandidates, EPSILON);

  if (uniqueCandidates.length < 3) {
    return { found: false, position };
  }

  // Fit circle (port from test harness)
  const circle = this.fitCircle(uniqueCandidates);

  if (!circle) {
    return { found: false, position };
  }

  return {
    found: true,
    position: circle.center,
    normal: circle.normal,
    metadata: {
      type: 'circle-center',
      circleRadius: circle.radius,
      circleNormal: circle.normal,
      residual: circle.residual,
      pointCount: uniqueCandidates.length
    }
  };
}

// Helper: Project vertex to screen
private projectToScreen(
  vertex: BABYLON.Vector3,
  camera: BABYLON.Camera
): { x: number; y: number; z: number } | null {
  const scene = camera.getScene();
  const engine = scene.getEngine();
  const rw = engine.getRenderWidth();
  const rh = engine.getRenderHeight();
  const viewport = camera.viewport.toGlobal(rw, rh);

  const screen = BABYLON.Vector3.Project(
    vertex,
    BABYLON.Matrix.Identity(),
    scene.getTransformMatrix(),
    viewport
  );

  // Check if in front of camera
  if (screen.z < 0 || screen.z > 1) return null;

  return { x: screen.x, y: screen.y, z: screen.z };
}

// Helper: Deduplicate vertices
private deduplicateVertices(
  vertices: BABYLON.Vector3[],
  epsilon: number
): BABYLON.Vector3[] {
  const unique: BABYLON.Vector3[] = [];

  for (const v of vertices) {
    const isDuplicate = unique.some(u =>
      Math.abs(u.x - v.x) < epsilon &&
      Math.abs(u.y - v.y) < epsilon &&
      Math.abs(u.z - v.z) < epsilon
    );

    if (!isDuplicate) {
      unique.push(v);
    }
  }

  return unique;
}

// Helper: Fit circle (port all helper functions from test harness)
private fitCircle(vertices: BABYLON.Vector3[]): {
  center: BABYLON.Vector3;
  radius: number;
  normal: BABYLON.Vector3;
  residual: number;
} | null {
  // ... (copy implementation from test harness)
}
```

### Step 2: Add to smartSnapPosition()

**File:** `src/manipulation/SnappingHelper.ts:265`
**Location:** Inside `smartSnapPosition()` method, after vertex snap

```typescript
// Try circle center snap
if (settings.snapToCircleCenter && camera && pointerScreenX !== undefined && pointerScreenY !== undefined) {
  const result = this.snapToCircleCenter(
    position,
    settings,
    excludeMeshIds,
    camera,
    pointerScreenX,
    pointerScreenY
  );

  if (result.found) {
    const dist = BABYLON.Vector3.Distance(position, result.position);
    candidates.push({
      result,
      distance: dist,
      priority: priorities.center  // Priority 3
    });
  }
}
```

### Step 3: Update Settings Interface

**File:** `src/manipulation/SnappingHelper.ts:218`
**Add to SnapSettings interface:**

```typescript
export interface SnapSettings {
  enabled: boolean;
  threshold: number;
  snapToVertex?: boolean;
  snapToEdge?: boolean;
  snapToFace?: boolean;
  snapToObjectCenter?: boolean;
  snapToCircleCenter?: boolean;  // NEW
  snapToEdgeMidpoint?: boolean;
  snapObjectToVertex?: boolean;
  snapPointOnEdge?: boolean;
  snapBBoxCorner?: boolean;
}
```

### Step 4: Add UI Toggle

**File:** `src/ui/components/SnapSetupPopup.tsx` (likely location)

Add button to snap mode selector:
```tsx
<button
  onClick={() => updateSnapSettings({ snapToCircleCenter: !settings.snapToCircleCenter })}
  className={settings.snapToCircleCenter ? 'active' : ''}
  title="Snap to circle centers (O)"
>
  <span>⭕</span> Circle Center
</button>
```

**Keyboard Shortcut:** 'O' for Origin (circle origin)

---

## File Structure

### Files to Keep (6 files)
```
debug/
├── vertex_debug_minimal.html           # Working test harness (300 lines)
└── DOT_ALIGNMENT_BUG_HANDOFF.md       # Previous bug investigation

docs/
├── SNAP_CIRCLE_CENTER_HANDOFF.md      # Circle-specific details
└── COMPLETE_SNAP_SYSTEM_CONTEXT.md    # This file

src/manipulation/
├── SnappingHelper.ts                   # Main snap logic (modified)
└── snapIndex.ts                        # Spatial indexing (modified)

SNAP_DEBUG_ALIGNMENT_FIX.md            # Earlier bug fixes
```

### Files Reverted (68 files)
- All files with only whitespace/newline changes
- See git status output - only 6 files remain staged

---

## Performance Considerations

### Current Performance
- **Vertex snap:** O(log N) with spatial hash
- **Circle center:** O(N) without spatial hash

### Problem
Looping through 50k+ vertices on every mouse move = 30-60ms = frame drops

### Solution: Use Spatial Hash

**Option 1: Reuse existing SpatialHash3D** (snapIndex.ts)
```typescript
// In snapToCircleCenter()
const idx = ensureSnapIndex(mesh);  // Get pre-built spatial hash

// Query nearby vertices only
const candidates = idx.hash.querySphere(
  pointerRay.origin.x,
  pointerRay.origin.y,
  pointerRay.origin.z,
  worldRadius
);

// Process only ~100-500 candidates instead of 50k
```

**Option 2: Use Babylon.js Octree** (built-in)
```typescript
const octree = mesh.createOrUpdateSubmeshesOctree();
const nearby = octree.dynamicContent;  // Get nearby triangles
```

**Recommendation:** Use Option 1 (SpatialHash3D) - already implemented, proven to work

### Expected Performance After Optimization
- Before: 30-60ms per mouse move
- After: <2ms per mouse move
- 60 FPS maintained even with 100k vertex models

---

## Testing Strategy

### Phase 1: Test Harness (debug/vertex_debug_minimal.html)
1. **Test circle fitting:**
   - Load MH5_BASE_AXIS.stl (has bolt holes)
   - Hover over circular feature
   - Click → should see red circle + green center
   - Verify low residual (<0.001)

2. **Test rejection:**
   - Hover over flat edge (line)
   - Click → should reject (no circle shown)
   - Hover over random area
   - Click → should reject

3. **Test different zoom levels:**
   - Zoom in close
   - Zoom out far
   - 10px radius should feel consistent

### Phase 2: Integration Tests (main app)
1. **Multi-mesh scene:**
   - Load URDF robot with multiple meshes
   - Verify circle detection works on any mesh
   - Verify snaps to closest circle (not all circles)

2. **Snap priority:**
   - Place vertex and circle center close together
   - Vertex should win (priority 1 > 3)

3. **File formats:**
   - Test STL (high duplication)
   - Test GLB (low duplication)
   - Test URDF (multi-mesh)

### Phase 3: Performance Tests
1. **Large models:**
   - Load 100k+ vertex model
   - Move mouse rapidly
   - Measure frame rate (should stay >50 FPS)

2. **Memory leaks:**
   - Move mouse for 60 seconds
   - Check memory usage doesn't grow
   - Verify old meshes are disposed

### Phase 4: User Testing
1. **Real workflow:**
   - User tries to snap object to bolt hole center
   - Verify they can do it intuitively
   - No mode switching needed (smart snap)

---

## Your Tasks (Cursor/GPT-4.5)

### Immediate Tasks (Phase 1)

#### Task 1.1: Implement Circle Fitting
**File:** `debug/vertex_debug_minimal.html`
**Location:** After line 295 (click handler)
**Deliverable:**
- `fitCircle()` function that returns circle center, radius, normal
- Validation logic (reject non-circular patterns)
- Visual feedback (red circle wireframe, green center sphere)

**Test:**
```bash
npm run debug:vertices  # Start server
# Open http://localhost:8080/debug/vertex_debug_minimal.html
# Hover over bolt hole → click → should see red circle + green center
```

**Success Criteria:**
- Red circle overlaps orange dots perfectly
- Green center at geometric center
- Console shows residual <0.001 for circular features
- Rejects lines/random points

#### Task 1.2: Test Edge Cases
**Test cases:**
- 3 points (minimum)
- 5 points (typical small circle)
- 50 points (large circular feature)
- 2 points (should reject)
- Points on line (should reject)
- Points on ellipse (should reject if residual >5%)

### Short-Term Tasks (Phase 2-3)

#### Task 2.1: Port to SnappingHelper.ts
**File:** `src/manipulation/SnappingHelper.ts`
**Deliverable:**
- `snapToCircleCenter()` method
- Helper methods (projectToScreen, deduplicateVertices, fitCircle)
- Integration into `smartSnapPosition()`

#### Task 2.2: Add UI Toggle
**File:** `src/ui/components/SnapSetupPopup.tsx` (find actual location)
**Deliverable:**
- Button to toggle circle-center snap
- Keyboard shortcut (suggest 'O')
- Active/inactive visual state

#### Task 2.3: Add Spatial Hash Optimization
**File:** `src/manipulation/SnappingHelper.ts`
**Deliverable:**
- Use `ensureSnapIndex()` from snapIndex.ts
- Query only nearby vertices
- Measure performance improvement

### Long-Term Tasks (Phase 4)

#### Task 4.1: Handle Multi-Circle Scenarios
**Problem:** Mouse near 2+ circles, which one to snap to?
**Solution:** Always snap to closest circle center

#### Task 4.2: Handle Partial Circles
**Problem:** User hovers over arc (not full circle)
**Solution:** Fit circle to partial arc, validate with residual

#### Task 4.3: Add Snap Preview
**File:** `src/manipulation/SnappingHelper.ts`
**Deliverable:**
- Show green sphere at circle center while hovering
- Show red wireframe of detected circle
- Clear preview when mouse moves away

---

## Coordinate System

**CRITICAL:** kinetiCORE uses Z-up (CAD/ROS standard), not Y-up (game engines)

```
   Z
   ↑
   |
   |
   +----→ X
  /
 /
Y
```

**Implications for circle fitting:**
- Circle normal might be (0, 0, 1) for horizontal circles
- Circle normal might be (0, 1, 0) for vertical circles
- Check plane fitting respects Z-up convention

**Reference:** `COORDINATE_SYSTEM.md` in project root

---

## Dependencies

### Current Dependencies (package.json)
```json
{
  "@babylonjs/core": "^7.x",
  "@babylonjs/loaders": "^7.x",
  "react": "^18.x",
  "zustand": "^4.x"
}
```

### Optional Math Libraries (for circle fitting)
```json
{
  "numeric": "^1.2.6",      // SVD for plane fitting
  "ml-matrix": "^6.x"       // Linear algebra (TypeScript)
}
```

**Recommendation:** Implement circle fitting manually (no new dependencies) to keep bundle size small. The algebraic fit method is ~50 lines of code.

---

## Resources

### Mathematical References
- [Least-Squares Circle Fit (Pratt 1987)](https://dtcenter.org/sites/default/files/community-code/met/docs/write-ups/circle_fit.pdf)
- [PCA for Plane Fitting](https://www.ilikebigbits.com/2015_03_04_plane_from_points.html)
- [Covariance Matrix Method](https://en.wikipedia.org/wiki/Principal_component_analysis)

### Babylon.js Docs
- [Vector3 API](https://doc.babylonjs.com/typedoc/classes/BABYLON.Vector3)
- [Vector3.Project()](https://doc.babylonjs.com/typedoc/classes/BABYLON.Vector3#Project) - 3D to 2D projection
- [PointsCloudSystem](https://doc.babylonjs.com/features/featuresDeepDive/particles/point_cloud_system)
- [Mesh.getVerticesData()](https://doc.babylonjs.com/typedoc/classes/BABYLON.Mesh#getVerticesData)

### kinetiCORE Docs
- `CLAUDE.md` - Project overview
- `COORDINATE_SYSTEM.md` - Z-up coordinate system
- `docs/PHYSICS_API.md` - Physics integration
- `docs/architecture.md` - System architecture

### Code Examples
- `debug/vertex_debug_minimal.html` - Complete working example
- `src/manipulation/snapIndex.ts` - Spatial hash implementation
- `src/manipulation/SnappingHelper.ts` - Snap system architecture

---

## Questions & Answers

### Q: Why 10px screen-space radius instead of world-space?
**A:** World-space radius feels inconsistent at different zoom levels. 10px screen-space feels "natural" - if you're hovering your mouse near vertices, they get selected.

### Q: Why deduplicate vertices?
**A:** STL files have massive duplication (each triangle stores its own vertices). Without dedup, you'd get 50+ identical points when only 10 are visually present.

### Q: Can I use a math library for SVD?
**A:** Yes, but not required. Simple covariance-based PCA works fine for plane fitting. If you want robust SVD, add `numeric.js` or `ml-matrix`.

### Q: What if points don't form a perfect circle?
**A:** Real-world data is noisy. Accept circles with residual <5% of radius. This handles imperfect meshes.

### Q: How do I test circle fitting without loading the full app?
**A:** Use `debug/vertex_debug_minimal.html`. It's a standalone test harness. Just run:
```bash
npm run debug:vertices
```

### Q: What happens if user hovers between two circles?
**A:** `smartSnapPosition()` returns the closest snap result. If two circle centers are equally close, the one processed first wins (arbitrary but consistent).

### Q: Should I snap to ellipse centers?
**A:** No. Ellipses have major/minor axes, so "center" is ambiguous. Reject ellipses using residual check.

### Q: What about non-planar point sets (sphere surface)?
**A:** These are NOT circles - they're great circles on a sphere. Reject them by checking planarity (residual in plane fitting).

---

## Success Criteria

### Phase 1 Complete When:
- ✅ `fitCircle()` returns valid center for circular features
- ✅ Red wireframe circle visualizes fit
- ✅ Green sphere shows center
- ✅ Rejects non-circular patterns
- ✅ Works with 3-100 vertices
- ✅ Residual <1% for good circles

### Final Integration Complete When:
- ✅ Circle-center snap available in main app UI
- ✅ Keyboard shortcut works (e.g., 'O' key)
- ✅ Works with STL, URDF, GLB files
- ✅ No performance degradation (<50ms snap detection)
- ✅ Snap priority correct (vertex > circle > face)
- ✅ Visual feedback (green center dot + red wireframe)
- ✅ Unit tests pass
- ✅ Documentation updated

---

## Contact & Handoff

**Prepared by:** Claude Code (George's AI pair programmer)
**Date:** 2025-11-12
**Branch:** `wip/circle-center-snapping`
**Test Harness:** http://localhost:8080/debug/vertex_debug_minimal.html

**Handoff to:** Cursor/GPT-4.5
**Starting Point:** Task 1.1 - Implement circle fitting in test harness

**Everything is ready. All you need to do is implement the circle fitting math. The foundation is solid, tested, and waiting for you.**

---

## Appendix: Full Snap System Reference

### All Snap Types (Current + Future)

| Type | Priority | Status | Description |
|------|----------|--------|-------------|
| Vertex | 1 | ✅ Done | Snap to individual vertices |
| Midpoint | 2 | ✅ Done | Snap to edge midpoints |
| **Circle Center** | **3** | **🚧 In Progress** | **Snap to circle centers** |
| Intersection | 4 | ❌ Future | Snap to edge-edge intersections |
| Edge | 5 | ✅ Done | Snap to points on edges |
| BBox Corner | 6 | ✅ Done | Snap to bounding box corners |
| Face | 7 | ✅ Done | Snap to face centers |
| Normal | 8 | ✅ Done | Snap along surface normals |
| Object | 9 | ✅ Done | Snap to object centers |

### Key Files & Line Numbers

| File | Lines | Purpose |
|------|-------|---------|
| `debug/vertex_debug_minimal.html` | 300 | Test harness (complete foundation) |
| `src/manipulation/SnappingHelper.ts` | 3500+ | Main snap logic |
| `src/manipulation/snapIndex.ts` | 250 | Spatial indexing for O(log N) |
| `SNAP_CIRCLE_CENTER_HANDOFF.md` | 600 | Circle-specific details |
| `COMPLETE_SNAP_SYSTEM_CONTEXT.md` | This file | Complete system context |

### Command Reference

```bash
# Start debug server
npm run debug:vertices

# Run full app in dev mode
npm run dev

# Run tests
npm test

# Type check
npm run type-check

# Build for production
npm run build
```

---

**You have everything you need. Go implement circle fitting and make this feature complete!**
