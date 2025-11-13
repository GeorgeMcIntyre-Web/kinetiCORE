# Dot Alignment Bug - Handoff Document

**Date:** Current  
**Status:** 🔴 **UNRESOLVED - 8th Attempt Failed**  
**Priority:** CRITICAL - Blocks debugging workflow

---

## Problem Statement

The debug harness (`debug/vertex_debug.html`) displays colored dots overlaid on a 3D mesh to visualize vertices (V), midpoints (M), and circle centers (O). **The dots do not align with the mesh geometry** - they appear offset or in wrong positions relative to the actual mesh vertices.

**User's Original Request:**
> "remove all logic now and only have the dots, we fixed this misalignment some time ago!"

This indicates:
1. The alignment was working previously
2. Recent changes broke it
3. The user wants ONLY dots (no circle detection logic)

---

## What Has Been Tried (8 Attempts)

### Attempt 1-2: Initial Fixes
- Fixed typo: `legORes` → `legORms`
- Removed circle detection logic

### Attempt 3: Transform Update Logic
- Added `localWeldedCache` to cache welded local vertices
- Modified transform callback to recompute `midVerts` from welded vertices
- **Issue:** Still using welded vertices while mesh uses unwelded

### Attempt 4: Render Loop Fix
- Changed render loop to use `worldVertsCache` directly instead of `ensureWorldVerts()`
- **Issue:** `ensureWorldVerts()` was rebuilding from unwelded mesh vertices, overwriting welded cache

### Attempt 5: Callback Ordering
- Consolidated multiple transform callbacks into single global callback
- Attempted to ensure transform callback runs before render loop
- **Issue:** Execution order still unreliable

### Attempt 6: Inline Transform Update
- Moved transform update directly into render loop
- Ensured it runs before using vertices
- **Issue:** Still using welded vertices

### Attempt 7: Unwelded Vertices for V
- Changed to use unwelded vertices directly from mesh (like production code)
- Transform unwelded vertices to world space every frame
- Keep welded vertices only for midpoints (M/O)
- **Issue:** Still not working

### Attempt 8: Current State
- Using unwelded vertices for V dots
- Using welded vertices for M/O midpoints
- Transform update runs inline in render loop
- **Status:** Dots still don't match mesh

---

## Current Code State

### Key Files
- `debug/vertex_debug.html` - Main debug harness

### Current Implementation (Lines 937-969)

```javascript
// CRITICAL: Update world vertices from UNWELDED mesh vertices (like production code)
mesh.computeWorldMatrix(true);
const W = mesh.getWorldMatrix();
const local = getPositionsArray(mesh);
if (local && local.length % 3 === 0) {
  // Transform UNWELDED vertices to world space (matches what mesh renders)
  const world = new Float32Array(local.length);
  const v = new BABYLON.Vector3();
  for (let i = 0; i < local.length; i += 3) {
    v.set(local[i], local[i + 1], local[i + 2]);
    BABYLON.Vector3.TransformCoordinatesToRef(v, W, v);
    world[i] = v.x; world[i + 1] = v.y; world[i + 2] = v.z;
  }
  worldVertsCache = world;
  
  // For midpoints, use welded vertices (edges are based on welded)
  if (localWeldedCache) {
    const worldWelded = new Float32Array(localWeldedCache.length);
    for (let i = 0; i < localWeldedCache.length; i += 3) {
      v.set(localWeldedCache[i], localWeldedCache[i + 1], localWeldedCache[i + 2]);
      BABYLON.Vector3.TransformCoordinatesToRef(v, W, v);
      worldWelded[i] = v.x; worldWelded[i + 1] = v.y; worldWelded[i + 2] = v.z;
    }
    midVerts = computeMidpoints(worldWelded, edges);
  }
}
```

### How Dots Are Drawn (Lines 1039-1100)

```javascript
// Process Vertices (V)
if (showV && wv) {  // wv = worldVertsCache
  const temp = new BABYLON.Vector3();
  for (let i = 0; i < wv.length; i += 3) {
    temp.set(wv[i], wv[i+1], wv[i+2]);
    const s = projectToScreen(temp, camera);
    // ... draw dot at s.x, s.y
  }
}
```

---

## Production Code Reference

**File:** `src/manipulation/SnappingHelper.ts`

The production code uses unwelded vertices directly:

```typescript
function getWorldVerts(mesh: BABYLON.Mesh): Float32Array | null {
  mesh.computeWorldMatrix(true);
  const worldMatrix = mesh.getWorldMatrix();
  const positions = getPositionsArray(mesh);  // UNWELDED
  
  const worldVerts = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const localVertex = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
    const worldVertex = toWorld(localVertex, worldMatrix);
    worldVerts[i] = worldVertex.x;
    worldVerts[i + 1] = worldVertex.y;
    worldVerts[i + 2] = worldVertex.z;
  }
  return worldVerts;
}
```

**Key Difference:** Production uses `toWorld()` helper, debug harness uses `BABYLON.Vector3.TransformCoordinatesToRef()`

---

## Potential Root Causes

### 1. **Projection Mismatch**
- `projectToScreen()` function might not match production
- Viewport calculation might be wrong
- DPR (device pixel ratio) handling might be incorrect

**Check:** Compare `projectToScreen()` in debug harness vs production `SnappingHelper.ts`

### 2. **World Matrix Issue**
- Mesh might have parent transforms not accounted for
- `mesh.getWorldMatrix()` might not be the correct matrix to use
- Mesh might be instanced (`mesh.isAnInstance`)

**Check:** 
- Is mesh parented? (Line 610: `m.parent = loadedRoot`)
- Does `loadedRoot` have transforms?
- Is mesh an instance?

### 3. **Vertex Data Source Mismatch**
- `getPositionsArray()` might return different data than what mesh actually renders
- Mesh might have multiple vertex buffers
- Mesh might be using indices that remap vertices

**Check:**
- Does mesh use indices?
- Are vertices in the same order as rendered?
- Does `getPositionsArray()` handle instances correctly?

### 4. **Timing/Race Condition**
- Transform update might run after mesh has already been rendered
- World matrix might be stale
- Cache might be from previous frame

**Check:**
- When does `onBeforeRenderObservable` run relative to mesh rendering?
- Is world matrix guaranteed fresh?

### 5. **Coordinate System Mismatch**
- Babylon.js coordinate system vs screen space
- Y-axis flip (screen Y increases downward)
- Viewport transformation

**Check:**
- `projectToScreen()` implementation
- Viewport calculation
- Screen space vs render space

---

## Investigation Steps

### Step 1: Verify Projection Function
Compare `projectToScreen()` in debug harness with production code:

**Debug harness (line 237-254):**
```javascript
const projectToScreen = (worldV, cam) => {
  const engineW = engine.getRenderWidth();
  const engineH = engine.getRenderHeight();
  const worldMatrix = BABYLON.Matrix.Identity();
  const viewProj = scene.getTransformMatrix();
  const vp = cam.viewport.toGlobal(engineW, engineH);
  const sp = BABYLON.Vector3.Project(worldV, worldMatrix, viewProj, vp);
  // ...
}
```

**Production (SnappingHelper.ts line 82-110):**
```typescript
function projectToScreen(
  worldPos: BABYLON.Vector3,
  scene: BABYLON.Scene,
  camera: BABYLON.Camera
): { x: number; y: number; z: number; rw: number; rh: number } | null {
  const rw = engine.getRenderWidth();
  const rh = engine.getRenderHeight();
  const vp = camera.viewport.toGlobal(rw, rh);
  const viewProj = scene.getTransformMatrix();
  const worldMatrix = BABYLON.Matrix.Identity();
  const sp = BABYLON.Vector3.Project(worldPos, worldMatrix, viewProj, vp);
  // ...
}
```

**Key Difference:** Production passes `scene, camera` as separate params, debug passes `cam` only. Both use same projection logic.

### Step 2: Add Debug Logging
Add logging to compare:
- First vertex world position from cache
- First vertex world position from mesh directly
- First vertex screen projection
- Mesh's actual rendered position (if possible)

```javascript
// In render loop, after computing worldVertsCache:
const firstWorld = new BABYLON.Vector3(world[0], world[1], world[2]);
const firstScreen = projectToScreen(firstWorld, camera);
console.log('[DEBUG] First vertex:', {
  world: {x: firstWorld.x, y: firstWorld.y, z: firstWorld.z},
  screen: firstScreen ? {x: firstScreen.x, y: firstScreen.y} : null,
  meshWorldMatrix: W.m,
  meshPosition: mesh.position,
  meshParent: mesh.parent?.name
});
```

### Step 3: Test with Simple Mesh
- Load a simple cube/sphere
- Verify dots align
- If they do, issue is mesh-specific
- If they don't, issue is fundamental

### Step 4: Compare with Working Version
- Check git history for when alignment worked
- Compare working version with current
- Look for differences in:
  - Vertex source (welded vs unwelded)
  - Transform calculation
  - Projection function
  - Render loop timing

### Step 5: Verify Mesh State
```javascript
console.log('[DEBUG] Mesh state:', {
  name: mesh.name,
  isInstance: mesh.isAnInstance,
  sourceMesh: mesh.sourceMesh?.name,
  parent: mesh.parent?.name,
  position: mesh.position,
  rotation: mesh.rotation,
  scaling: mesh.scaling,
  worldMatrix: mesh.getWorldMatrix().m
});
```

---

## Key Variables to Monitor

- `worldVertsCache` - World-space vertices used for V dots
- `midVerts` - World-space midpoints used for M/O dots
- `localWeldedCache` - Cached welded local vertices
- `mesh.getWorldMatrix()` - Current mesh world transform
- `projectToScreen()` result - Screen coordinates for dots

---

## Files Modified

- `debug/vertex_debug.html` - All changes in this file

## Git History

Check commits for:
- When alignment last worked
- What changed to break it
- Previous fixes that worked

```bash
git log --oneline --all -- debug/vertex_debug.html
git log -p --all -- debug/vertex_debug.html | grep -A 10 -B 10 "align\|match\|welded\|unweld"
```

---

## Success Criteria

✅ Dots align exactly with mesh vertices  
✅ Dots move correctly when mesh transforms  
✅ Dots match production snapping behavior  
✅ No performance degradation  

---

## Next Steps for Developer

1. **Start with Step 1** - Compare projection functions
2. **Add debug logging** (Step 2) to see actual values
3. **Test with simple mesh** (Step 3) to isolate issue
4. **Check git history** (Step 4) for working version
5. **Verify mesh state** (Step 5) to ensure correct mesh reference

---

## Questions to Answer

1. Does the mesh have a parent transform that's not being accounted for?
2. Is `projectToScreen()` correct compared to production?
3. Are we using the right mesh reference (not an instance)?
4. Is the world matrix calculation correct?
5. Are vertices in the same order as the mesh renders them?

---

## Contact

If you need clarification on any of the attempted fixes or the codebase structure, check:
- `src/manipulation/SnappingHelper.ts` - Production snapping implementation
- `debug/vertex_debug.html` - Current debug harness
- Git history for previous working versions

**Good luck!** 🍀

