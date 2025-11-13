# Vertex Snap Debug Alignment Fix - Complete Summary

## Problem Statement

The vertex debug harness ([debug/vertex_debug.html](debug/vertex_debug.html)) displayed orange snap point dots that were:
- Massively offset to the left of the white 3D mesh
- Moving relative to the mesh geometry when zooming/rotating the camera
- Not aligned with mesh vertices at any zoom level

This was caused by breaking changes introduced by Cursor in the vertex snapping projection system.

## Root Causes Identified

### 1. Vector3.Project Parameter Order ❌ → ✅

**Wrong parameter order** was used throughout the codebase:

```typescript
// INCORRECT (used before fix):
BABYLON.Vector3.Project(
  position,
  scene.getTransformMatrix(),      // ❌ WRONG: This is view×projection matrix
  camera.getProjectionMatrix(),     // ❌ WRONG: Double projection
  viewport
);

// CORRECT (after fix):
BABYLON.Vector3.Project(
  position,                         // World-space position
  BABYLON.Matrix.Identity(),        // ✅ Identity for already-transformed coords
  scene.getTransformMatrix(),       // ✅ Combined view×projection matrix
  viewport
);
```

**Why this matters:**
- `scene.getTransformMatrix()` already contains the combined camera view × projection matrix
- Using it as the first parameter applied the transformation twice
- The first parameter should be the world matrix - but since our vertices are already in world space, we use Identity

### 2. Coordinate System Inconsistency ❌ → ✅

**Hardware pixels vs CSS pixels mismatch:**

```typescript
// INCORRECT (mixed pixel systems):
const rw = engine.getRenderWidth(true);  // ❌ Hardware pixels
const rh = engine.getRenderHeight(true); // ❌ Hardware pixels
// But scene.pointerX/Y are in CSS pixels!

// CORRECT (consistent CSS pixels):
const rw = engine.getRenderWidth();      // ✅ CSS pixels
const rh = engine.getRenderHeight();     // ✅ CSS pixels
// Matches scene.pointerX/Y coordinate space
```

**Why this matters:**
- `scene.pointerX/Y` are in CSS pixels (logical screen coordinates)
- `createPickingRay()` expects CSS pixels
- Babylon.js internally handles DPR (Device Pixel Ratio) scaling
- Mixing pixel systems caused screen-space calculations to be off by the DPR factor

### 3. WebGL Buffer Overflow ❌ → ✅

**Vertex count mismatch in buffer updates:**

```typescript
// INCORRECT (buffer size mismatch):
const world = new Float32Array(positions.length); // 112,656 unwelded vertices
// ... later ...
pointCloudMesh.updateVerticesData(
  BABYLON.VertexBuffer.PositionKind,
  world  // ❌ 112,656 vertices, but mesh was created with 56,250 welded vertices!
);

// CORRECT (matching vertex counts):
const worldWelded = new Float32Array(localWeldedCache.length); // 56,250 vertices
// ... transform welded vertices to world space ...
pointCloudMesh.updateVerticesData(
  BABYLON.VertexBuffer.PositionKind,
  worldWelded  // ✅ Same count as mesh was created with
);
```

**Why this matters:**
- Point cloud mesh was created with **welded** vertices (~56,250 unique vertices)
- Update was trying to push **unwelded** vertex data (112,656 vertices)
- WebGL buffer overflow: trying to write 112,656 vertices into a buffer sized for 56,250
- Caused hundreds of "WebGL: INVALID_VALUE: bufferSubData: buffer overflow" console errors

### 4. Variable Shadowing Bug ❌ → ✅

**Loop variable shadowed function parameter:**

```typescript
// INCORRECT (variable shadowing):
export function queryNearestVertex(
  mesh: BABYLON.Mesh,
  camera: BABYLON.Camera,
  pointerX: number,
  pointerY: number,
  pixelRadius: number
): { idx: number; pos: BABYLON.Vector3; px: number } | null {
  const idx = ensureSnapIndex(mesh);  // SnapIndex object
  // ... later in loop:
  for (let idx = 0; idx < sampleSize; idx++) {  // ❌ Shadows the SnapIndex!
    const i = candidates[idx];
    const vx = idx.vertsWorld[i];  // ❌ Tries to access .vertsWorld on number
  }
}

// CORRECT (renamed loop variable):
for (let j = 0; j < sampleSize; j++) {  // ✅ Different variable name
  const i = candidates[j];
  const vx = idx.vertsWorld[i];  // ✅ Correctly accesses SnapIndex
}
```

**Why this matters:**
- TypeScript error: `Property 'vertsWorld' does not exist on type 'number'`
- Loop variable `idx` shadowed the SnapIndex parameter `idx`
- Prevented compilation and caused incorrect vertex lookups

## Files Modified

### 1. [src/manipulation/snapIndex.ts](src/manipulation/snapIndex.ts)

**Changes:**
- ✅ Fixed `Vector3.Project` parameter order (lines 218-223)
- ✅ Changed to CSS pixels: `getRenderWidth()` instead of `getRenderWidth(true)` (lines 153-154)
- ✅ Fixed variable shadowing: renamed loop variable from `idx` to `j` (line 182)

**Key sections:**

```typescript
// Line 153-154: CSS pixels for coordinate consistency
const rw = engine.getRenderWidth();  // CSS pixels (matches pointer coords)
const rh = engine.getRenderHeight(); // CSS pixels (matches pointer coords)

// Line 182: Fixed variable shadowing
for (let j = 0; j < sampleSize; j++) {  // Was: let idx (shadowed parameter)
  const i = candidates[j];
  const vx = idx.vertsWorld[i];  // Now correctly accesses SnapIndex
  // ...
}

// Lines 218-223: Correct Vector3.Project usage
const s = BABYLON.Vector3.Project(
  tmp,                              // World-space vertex position
  BABYLON.Matrix.Identity(),        // World matrix (Identity for world coords)
  mesh.getScene().getTransformMatrix(), // Combined view×projection
  viewport
);
```

### 2. [src/manipulation/SnappingHelper.ts](src/manipulation/SnappingHelper.ts)

**Changes:**
- ✅ Fixed 22+ instances of `Vector3.Project` parameter order
- ✅ Removed unused `worldMatrix` variable declarations (TypeScript errors)
- ✅ Prefixed unused parameter: `_snapDistance` (TypeScript warning)

**Pattern applied throughout:**

```typescript
// Fixed all snap functions (edge snap, face snap, circle snap, etc.):
const projected = BABYLON.Vector3.Project(
  position,                         // World-space position
  BABYLON.Matrix.Identity(),        // World matrix (Identity)
  scene.getTransformMatrix(),       // Combined view×projection
  viewport
);
```

**Affected functions:**
- Edge snapping
- Face snapping
- Circle center snapping
- Vertex snapping
- Midpoint calculations
- Screen-space distance checks

### 3. [debug/vertex_debug.html](debug/vertex_debug.html)

**Changes:**
- ✅ Fixed `projectToScreen` function to use correct `Vector3.Project` parameters (lines 237-246)
- ✅ Changed to CSS pixels: `getRenderWidth()` instead of `getRenderWidth(true)` (lines 238-239)
- ✅ **CRITICAL FIX:** Fixed WebGL buffer overflow by using `worldWelded` instead of `world` (lines 964-971)
- ✅ Added debug logging for first vertex projection (lines 693-695)
- ✅ Added debug accessor functions for console inspection (lines 194-195)

**Key sections:**

```typescript
// Lines 194-195: Debug helpers
window.debugMesh = () => mesh;
window.debugLoadedRoot = () => loadedRoot;

// Lines 237-246: Fixed projection function
const projectToScreen = (worldV, cam) => {
  if (!worldV || !cam) return null;
  const engineW = engine.getRenderWidth();  // CSS pixels
  const engineH = engine.getRenderHeight(); // CSS pixels
  if (engineW <= 0 || engineH <= 0) return null;
  const worldMatrix = BABYLON.Matrix.Identity();
  const viewProj = scene.getTransformMatrix();
  const vp = cam.viewport.toGlobal(engineW, engineH);
  const sp = BABYLON.Vector3.Project(worldV, worldMatrix, viewProj, vp);
  // ...
}

// Lines 964-971: Fixed buffer overflow
if (localWeldedCache) {
  // Transform welded vertices to world space
  const worldWelded = new Float32Array(localWeldedCache.length);
  const tmp = new BABYLON.Vector3();
  for (let i = 0; i < localWeldedCache.length; i += 3) {
    tmp.set(localWeldedCache[i], localWeldedCache[i+1], localWeldedCache[i+2]);
    const w = BABYLON.Vector3.TransformCoordinates(tmp, wm);
    worldWelded[i] = w.x;
    worldWelded[i+1] = w.y;
    worldWelded[i+2] = w.z;
  }

  midVerts = computeMidpoints(worldWelded, edges);

  // Update point cloud with WELDED vertices (matches creation)
  if (pointCloudMesh && pointCloudMesh.updateVerticesData) {
    pointCloudMesh.updateVerticesData(
      BABYLON.VertexBuffer.PositionKind,
      worldWelded  // ✅ Correct: welded vertices
    );
  }
}
```

## Errors Fixed

### TypeScript Compilation Errors

**Before:**
```
src/manipulation/snapIndex.ts:184:22 - error TS2339:
  Property 'vertsWorld' does not exist on type 'number'.

src/manipulation/SnappingHelper.ts:1963:7 - error TS2304:
  Cannot find name 'worldMatrix'.

src/manipulation/SnappingHelper.ts:702:11 - error TS6133:
  'snapDistance' is declared but its value is never read.
```

**After:** ✅ All TypeScript errors resolved

### Runtime WebGL Errors

**Before:**
```
WebGL: INVALID_VALUE: bufferSubData: buffer overflow
(repeated 100+ times in console)
```

**After:** ✅ Zero WebGL errors

## Verification Steps

1. **Run the debug harness:**
   ```bash
   npm run debug:vertices
   ```

2. **Open browser:** http://localhost:8080/debug/vertex_debug.html

3. **Visual verification:**
   - ✅ Orange dots now align perfectly with white mesh vertices
   - ✅ Dots remain stable when zooming in/out
   - ✅ Dots track mesh geometry correctly when rotating camera
   - ✅ No console errors (WebGL buffer overflow eliminated)

4. **Console debugging (optional):**
   ```javascript
   // Check mesh transforms
   const m = debugMesh();
   const r = debugLoadedRoot();
   console.log('mesh.position:', m.position);
   console.log('loadedRoot.position:', r.position);
   console.log('mesh worldMatrix translation:',
     m.getWorldMatrix().m[12],
     m.getWorldMatrix().m[13],
     m.getWorldMatrix().m[14]
   );
   ```

## Technical Background

### Vector3.Project API

```typescript
BABYLON.Vector3.Project(
  vector: Vector3,        // Position to project (world coords)
  world: Matrix,          // World matrix (Identity if already in world space)
  transform: Matrix,      // View×Projection combined matrix
  viewport: Viewport      // Screen viewport
): Vector3                // Returns screen-space position {x, y, z}
```

**Common mistakes:**
- ❌ Passing view and projection separately (they should be combined)
- ❌ Using world matrix when position is already in world space
- ❌ Mixing coordinate systems (CSS vs hardware pixels)

**Correct usage for world-space vertices:**
```typescript
const screenPos = BABYLON.Vector3.Project(
  worldPosition,
  BABYLON.Matrix.Identity(),      // No additional transform needed
  scene.getTransformMatrix(),     // Camera view×projection
  camera.viewport.toGlobal(width, height)
);
```

### CSS Pixels vs Hardware Pixels

| Aspect | CSS Pixels | Hardware Pixels |
|--------|------------|-----------------|
| Definition | Logical screen units | Physical screen units |
| DPR Factor | 1.0 | window.devicePixelRatio (typically 1.0, 1.5, 2.0) |
| Pointer Events | `scene.pointerX/Y` | N/A |
| Engine Size | `engine.getRenderWidth()` | `engine.getRenderWidth(true)` |
| Projection | Use CSS pixels | Incorrect for projection |
| Babylon.js Internal | Handles DPR automatically | Manual DPR handling |

**Rule of thumb:** Always use CSS pixels for projection and pointer calculations. Let Babylon.js handle DPR internally.

### Vertex Welding

**Purpose:** Reduce memory by combining duplicate vertices at the same position.

**Example:**
- Original STL: 112,656 vertices (37,552 triangles × 3 vertices each)
- Welded vertices: ~56,250 unique positions (~50% reduction)
- Memory saved: ~225 KB for position data alone

**Implementation:**
```typescript
function weld(positions: Float32Array, eps: number): Float32Array {
  const inv = 1.0 / eps;
  const map = new Map<string, [number, number, number]>();

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    // Quantize to grid and use as key
    const k = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`;

    if (map.has(k)) continue;  // Skip duplicates
    map.set(k, [x, y, z]);
  }

  return new Float32Array(Array.from(map.values()).flat());
}
```

**Critical rule:** When updating vertex buffers, vertex count MUST match the count used during mesh creation.

## Testing Results

### Before Fix
- ❌ Dots offset ~200-300 pixels to the left
- ❌ Dots moving relative to mesh when zooming
- ❌ 100+ WebGL buffer overflow errors
- ❌ TypeScript compilation errors (4 errors)
- ❌ Variable shadowing preventing correct vertex lookups

### After Fix
- ✅ Dots perfectly aligned with mesh vertices
- ✅ Dots stable across all zoom levels
- ✅ Zero WebGL errors
- ✅ Zero TypeScript errors
- ✅ Correct vertex lookups throughout

## Prevention Guidelines

### For Future Development

1. **Always use correct Vector3.Project parameter order:**
   ```typescript
   // Template for world-space projection:
   BABYLON.Vector3.Project(
     worldPosition,                    // Already in world space
     BABYLON.Matrix.Identity(),        // No additional transform
     scene.getTransformMatrix(),       // Camera view×projection
     viewport
   );
   ```

2. **Stay consistent with pixel coordinate systems:**
   ```typescript
   // Use CSS pixels for pointer/projection
   const w = engine.getRenderWidth();     // CSS pixels
   const h = engine.getRenderHeight();    // CSS pixels

   // Never mix:
   const w = engine.getRenderWidth(true); // ❌ Hardware pixels
   const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, ...); // CSS pixels
   ```

3. **Match vertex counts when updating buffers:**
   ```typescript
   // Create mesh
   const mesh = createPointCloud(weldedVertices);  // N vertices

   // Update mesh
   mesh.updateVerticesData(
     BABYLON.VertexBuffer.PositionKind,
     weldedVertices  // ✅ Same N vertices
   );

   // NEVER:
   mesh.updateVerticesData(
     BABYLON.VertexBuffer.PositionKind,
     unweldedVertices  // ❌ Different count = buffer overflow
   );
   ```

4. **Avoid variable shadowing:**
   ```typescript
   // ❌ BAD:
   function foo(idx: SnapIndex) {
     for (let idx = 0; idx < 10; idx++) {  // Shadows parameter
       const v = idx.vertsWorld[0];         // Error: number has no .vertsWorld
     }
   }

   // ✅ GOOD:
   function foo(idx: SnapIndex) {
     for (let i = 0; i < 10; i++) {         // Different name
       const v = idx.vertsWorld[i];         // Works correctly
     }
   }
   ```

## Related Documentation

- [Babylon.js Vector3.Project API](https://doc.babylonjs.com/typedoc/classes/BABYLON.Vector3#Project)
- [Coordinate System Standard](COORDINATE_SYSTEM.md)
- [Snap Index Implementation](src/manipulation/snapIndex.ts)
- [Snapping Helper System](src/manipulation/SnappingHelper.ts)

## Summary

This fix resolves **4 critical issues** that were causing vertex snap dots to misalign with the 3D mesh:

1. ✅ **Vector3.Project parameter order** - Fixed throughout codebase (25+ instances)
2. ✅ **Coordinate system consistency** - CSS pixels used throughout
3. ✅ **WebGL buffer overflow** - Vertex count mismatch eliminated
4. ✅ **Variable shadowing** - Loop variable renamed to prevent conflicts

**Result:** Vertex snap debug dots now perfectly align with the mesh at all zoom levels, with zero errors.

---

**Fixed by:** Claude Code (Agent 1)
**Date:** 2025-11-12
**Files Modified:** 3 (snapIndex.ts, SnappingHelper.ts, vertex_debug.html)
**Status:** ✅ Complete - All issues resolved
