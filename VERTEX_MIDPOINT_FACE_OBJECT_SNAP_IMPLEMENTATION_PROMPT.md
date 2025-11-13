# 🔧 VERTEX / MIDPOINT / FACE / OBJECT SNAP STANDARDIZATION – MASTER PROMPT

You are an expert TypeScript + Babylon.js engineer working in a 3D CAD-style snapping system.

Your main goal: **standardize and unify the return contracts for vertex, midpoint, face, and object snap types**, ensuring consistent `SnapResult` shapes, proper `visualFeedback` population, and reliable preview rendering.

---

You are working in the following files:

* `src/manipulation/SnappingHelper.ts` – main snap logic + preview rendering
* `src/manipulation/snapConstants.ts` – layer masks, snap inclusion/exclusion helpers
* `src/manipulation/snapIndex.ts` – `SnapIndex` + `SpatialHash3D` + `queryNearestVertex`

You must **read these files carefully** before making changes.

---

## 1. Contract: SnapResult for all snap types

### Current State

The `SnapResult` interface is defined in `SnappingHelper.ts` (lines 188-197):

```ts
export interface SnapResult {
  snapped: boolean;
  position: BABYLON.Vector3;
  snapType?: 'grid' | 'vertex' | 'edge' | 'face' | 'center' | 'object' | 'midpoint' |
             'intersection' | 'perpendicular' | 'tangent' | 'along' | 'normal' |
             'plane' | 'axis' | 'curve' | 'surface' | 'objectToVertex' | 'pointOnEdge' |
             'bboxCorner';
  targetMeshName?: string;
  visualFeedback?: BABYLON.Vector3[]; // Points to visualize snap indicators
}
```

### Required Contract

**Key rule for all snap functions:**

If `snapped: true`, you **must** set:

* `position` = exact 3D point we are snapping to (world-space)
* `snapType` = one of the `SnapType` union values (must match the function's purpose)
* `targetMeshName` = `.name` of the mesh we are snapping onto (if known)
* `visualFeedback` = array of points that the preview can use to draw rings / lines / corners

**Circle center** already follows this pattern correctly; the other types should match it.

---

## 2. Vertex snap – `snapToVertex`

### Current Implementation

* **Location**: `src/manipulation/SnappingHelper.ts`, method `snapToVertex` (line ~700)
* **Current return** (line ~1283-1289):
  ```ts
  return {
    snapped: true,
    position: closestVertex,
    snapType: 'vertex',
    targetMeshName: closestMeshName,
    visualFeedback: [closestVertex],
  };
  ```

### Requirements

* Uses **screen-space radius** when pointer data is available (`pointerScreenX`, `pointerScreenY`).
* Respects **exclusions** (selected mesh, gizmo, helpers) via `isSnapExcluded()`.
* Avoids "fighting" with edge / midpoint snaps when very close to vertices.
* Returns a **clean `SnapResult`** with `snapType: 'vertex'` and at least **one** point in `visualFeedback` (the vertex itself).

### Standardization Patch

The current return is already correct. **Verify** that:

1. The return statement matches the pattern above exactly.
2. `closestVertex` is a `BABYLON.Vector3` (world-space position).
3. `closestMeshName` is a string (mesh name, not ID).
4. `visualFeedback` always contains at least `[closestVertex]` (can include more points for future enhancements).

**No changes needed** if the return already matches this pattern.

---

## 3. Midpoint snap – `snapToMidpoint`

### Current Implementation

* **Location**: `src/manipulation/SnappingHelper.ts`, method `snapToMidpoint` (line ~3558)
* **Two behaviors**:
  1. **Edge midpoint**: use the closest point on the edge and snap to its midpoint.
  2. **Face "center"** variant: when a face center is available and closer / preferred, snap to that.

### Current Returns

* **Edge midpoint** (line ~3806-3812):
  ```ts
  return {
    snapped: true,
    position: closestMidpoint,
    snapType: 'midpoint',
    targetMeshName: closestMeshName,
    visualFeedback: [closestMidpoint, closestEdgeStart, closestEdgeEnd],
  };
  ```

* **Face center** (line ~3795-3801):
  ```ts
  return {
    snapped: true,
    position: closestMidpoint,
    snapType: 'midpoint',
    targetMeshName: closestMeshName,
    visualFeedback: [closestMidpoint], // Face center doesn't need edge endpoints
  };
  ```

### Standardization Requirements

1. **Edge midpoint return**:
   * `visualFeedback` must contain **3 points**: `[edgeStart, midpoint, edgeEnd]`
   * This allows `showPreviewDot` to render the double-ring preview correctly.

2. **Face-center fallback**:
   * Still use `snapType: 'midpoint'` (not `'face'`) so the preview uses the midpoint visual style.
   * `visualFeedback` can be `[center]` (single point).

### Standardization Patch

**Verify** the return statements match:

```ts
// Edge midpoint (lines ~3806-3812)
if (closestEdgeStart && closestEdgeEnd && closestMidpoint) {
  return {
    snapped: true,
    position: closestMidpoint.clone(),
    snapType: 'midpoint',
    targetMeshName: closestMeshName,
    // 3 points: start, mid, end – used by showPreviewDot midpoint ring logic
    visualFeedback: [
      closestEdgeStart.clone(),
      closestMidpoint.clone(),
      closestEdgeEnd.clone(),
    ],
  };
}

// Face center (lines ~3795-3801)
if (faceCenterMidpoint && shouldUseFaceCenter) {
  return {
    snapped: true,
    position: faceCenterMidpoint.clone(),
    snapType: 'midpoint',           // still treat as midpoint for preview
    targetMeshName: faceCenterMeshName,
    visualFeedback: [faceCenterMidpoint.clone()],
  };
}
```

**Important**: Always use `.clone()` on vectors to avoid reference issues.

---

## 4. Face snap – `snapToFace`

### Current Implementation

* **Location**: `src/manipulation/SnappingHelper.ts`, method `snapToFace` (line ~1466)
* **Current returns** (lines ~2002-2020):
  ```ts
  if (closestPoint && shouldSnap) {
    if (closestNormal) {
      return {
        snapped: true,
        position: closestPoint,
        snapType: 'face',
        targetMeshName: closestMeshName,
        visualFeedback: [closestPoint, closestNormal],
      };
    } else {
      return {
        snapped: true,
        position: closestPoint,
        snapType: 'face',
        targetMeshName: closestMeshName,
        visualFeedback: [closestPoint],
      };
    }
  }
  ```

### Requirements

* Prioritizes the **clicked mesh + clicked point** when available (`clickedMesh`, `clickedPoint` parameters).
* Computes **face centres + normals** when possible.
* Uses both **screen-space** and **world-space** thresholds with generous limits for face centres.
* Face centre: `visualFeedback` carries both the **point** and the **normal** so preview can orient a square / plane.
* Regular face point: `visualFeedback` at least includes the snapped point.

### Standardization Patch

**Refine** the return to use guard clauses (avoid `else` after return):

```ts
if (!closestPoint || !shouldSnap) {
  return { snapped: false, position: position.clone() };
}

const hasNormal = !!closestNormal;

if (hasNormal) {
  return {
    snapped: true,
    position: closestPoint.clone(),
    snapType: 'face',
    targetMeshName: closestMeshName,
    // point + normal – preview can use normal for orientation
    visualFeedback: [closestPoint.clone(), closestNormal.clone()],
  };
}

return {
  snapped: true,
  position: closestPoint.clone(),
  snapType: 'face',
  targetMeshName: closestMeshName,
  visualFeedback: [closestPoint.clone()],
};
```

**Important**: Use `.clone()` on all vectors to avoid reference issues.

---

## 5. Object snap – `snapToObject`

### Current Implementation

* **Location**: `src/manipulation/SnappingHelper.ts`, method `snapToObject` (line ~2847)
* **Current return** (lines ~2929-2936):
  ```ts
  if (closestCenter && shouldSnap) {
    return {
      snapped: true,
      position: closestCenter,
      snapType: 'object',
      targetMeshName: closestMeshName,
      visualFeedback: [closestCenter],
    };
  }
  ```

### Requirements

* Returns closest **bounding box centre** across all meshes.
* `snapType: 'object'`
* `visualFeedback: [closestCenter]` (minimum)

### Enhancement: Enrich `visualFeedback` with bbox corners

**Optional enhancement** (for future preview wireframe):

```ts
if (!closestCenter || !shouldSnap) {
  return { snapped: false, position: position.clone() };
}

let visualFeedback: BABYLON.Vector3[] = [closestCenter.clone()];

// Optional: Include bbox corners for future wireframe preview
const mesh = scene.meshes.find(m => m.name === closestMeshName);
if (mesh) {
  mesh.computeWorldMatrix(true);
  const boundingInfo = mesh.getBoundingInfo();
  const bbox = boundingInfo.boundingBox;
  const corners = bbox.vectorsWorld;
  
  if (corners && corners.length === 8) {
    visualFeedback = [
      closestCenter.clone(),
      ...corners.map(c => c.clone()),
    ];
  }
}

return {
  snapped: true,
  position: closestCenter.clone(),
  snapType: 'object',
  targetMeshName: closestMeshName,
  visualFeedback,
};
```

**Note**: No new behavior is required in `showPreviewDot` right now – it already gives **object** a distinct purple sphere. The extra points are there for future upgrades (such as a bbox wireframe).

---

## 6. Preview: ensuring all four types render correctly

### Current Preview Support

`showPreviewDot` (line ~3029) already supports:

* `vertex` → small yellow diamond (box rotated 45°)
* `midpoint` → specialized double-ring preview (uses 3 points from `visualFeedback`)
* `edge` → cylinder
* `face` → flat square / disc style
* `center` → cyan ring (circle center)
* `normal` → arrow
* `bboxCorner` → box
* `object` → purple sphere

### Preview Expectations

**Documentation comment** to add above `showPreviewDot`:

```ts
/**
 * Snap preview expectations:
 *
 * snapType: 'vertex'
 *   - position: vertex world position
 *   - visualFeedback: [position]
 *
 * snapType: 'midpoint'
 *   - edge midpoint: visualFeedback: [edgeStart, midpoint, edgeEnd]
 *   - face center:   visualFeedback: [center]
 *
 * snapType: 'face'
 *   - visualFeedback: [point] or [center, normal]
 *
 * snapType: 'object'
 *   - visualFeedback: [center, ...optional bbox corners]
 *
 * snapType: 'center'
 *   - position: circle center (with circleNormal, circleRadius attached)
 *   - visualFeedback: [center, normal, radiusVector]
 */
```

**Critical**: For **vertex / face / object**, we always provide at least one point via `visualFeedback` or `position` so `showPreviewDot` can place the preview mesh exactly on the snap point.

For **midpoint**, we pass the **three points** (edge endpoints + midpoint) because the preview uses those children to build the rings.

---

## 7. Smart snap integration sanity-check

### Current Priority Order

In `smartSnapPosition` (line ~255), the order is:

1. **Vertex** (priority 1)
2. **Midpoint** (priority 2)
3. **Center** (priority 3) - circle center
4. **Intersection** (priority 4)
5. **Edge** (priority 5)
6. **BBox Corner** (priority 6)
7. **Face** (priority 7)
8. **Normal** (priority 8)
9. **Object** (priority 9)

### Parameter Passing

**Verify** that all snap methods receive the correct parameters:

* `snapToVertex`: ✅ receives `pointerScreenX`, `pointerScreenY` (line ~297)
* `snapToMidpoint`: ⚠️ does NOT receive `pointerScreenX`, `pointerScreenY` (line ~305) - **consider adding for consistency**
* `snapToFace`: ✅ receives `clickedMesh`, `clickedPoint` (line ~337)
* `snapToObject`: ⚠️ does NOT receive `pointerScreenX`, `pointerScreenY` (line ~361) - **consider adding for consistency**

**Note**: The circle work already fixed the `pointerScreenX / pointerScreenY` path for `snapToCenter`. For consistency, consider adding these parameters to `snapToMidpoint` and `snapToObject` (even if not used immediately).

---

## 8. Code Quality Standards

### Guard Clauses

Prefer guard clauses at the top; avoid deep nesting:

```ts
// ❌ BAD: Deep nesting
if (closestPoint) {
  if (shouldSnap) {
    if (closestNormal) {
      return { ... };
    } else {
      return { ... };
    }
  }
}

// ✅ GOOD: Guard clauses
if (!closestPoint || !shouldSnap) {
  return { snapped: false, position: position.clone() };
}

if (closestNormal) {
  return { ... };
}

return { ... };
```

### Vector Cloning

**Always** use `.clone()` on vectors when adding to `visualFeedback` or returning in `SnapResult`:

```ts
// ❌ BAD: Reference issues
visualFeedback: [closestPoint]

// ✅ GOOD: Safe cloning
visualFeedback: [closestPoint.clone()]
```

### Early Returns

Avoid `else` / `elseif` where reasonable; early returns are preferred:

```ts
// ❌ BAD: Unnecessary else
if (hasNormal) {
  return { ... };
} else {
  return { ... };
}

// ✅ GOOD: Early return
if (hasNormal) {
  return { ... };
}
return { ... };
```

---

## 9. What to ask Cursor / Claude to do next

### Task List

1. **Open `SnappingHelper.ts`** and locate:
   - `snapToVertex` (line ~700)
   - `snapToMidpoint` (line ~3558)
   - `snapToFace` (line ~1466)
   - `snapToObject` (line ~2847)

2. **Verify `SnapResult` return contracts**:
   - Ensure each `snapped: true` branch returns `{ snapped, position, snapType, targetMeshName, visualFeedback }` with the exact shapes described above.
   - Use guard clauses instead of deep nesting.
   - Use `.clone()` on all vectors in `visualFeedback` and `position`.

3. **Standardize return statements**:
   - **Vertex**: Already correct (verify it matches the pattern).
   - **Midpoint**: Verify edge midpoint returns 3 points, face center returns 1 point.
   - **Face**: Refactor to use guard clauses (remove `else` after return).
   - **Object**: Consider enriching `visualFeedback` with bbox corners (optional).

4. **Add documentation comment** above `showPreviewDot`:
   - Document the expected `visualFeedback` shape for each `snapType`.

5. **Test existing behavior**:
   - Do NOT break the existing **circle center** path or primitive-shape tests.
   - Only standardize outputs and preview integration.
   - Verify preview meshes are created at the expected positions for each `snapType`.

6. **Optional enhancements**:
   - Consider adding `pointerScreenX`, `pointerScreenY` parameters to `snapToMidpoint` and `snapToObject` for future screen-space consistency (not required for this task).

---

## 10. Acceptance Criteria

You are done when:

1. **All four snap types return consistent `SnapResult` shapes**:
   - `snapped: boolean`
   - `position: Vector3` (cloned)
   - `snapType: string` (matches function purpose)
   - `targetMeshName?: string`
   - `visualFeedback?: Vector3[]` (all vectors cloned)

2. **Preview rendering works correctly**:
   - Vertex → yellow diamond appears at vertex position
   - Midpoint → double ring appears at edge midpoint (or single point for face center)
   - Face → square/disc appears at face position (oriented with normal if available)
   - Object → purple sphere appears at bbox center

3. **No regressions**:
   - Existing snap behavior unchanged
   - Circle center snap still works
   - Smart snap priority order preserved
   - No performance degradation

4. **Code quality**:
   - Guard clauses used (no deep nesting)
   - Early returns (no unnecessary `else`)
   - All vectors cloned (no reference issues)
   - Documentation comment added above `showPreviewDot`

---

Use this prompt as your full context and **do not ignore any constraint above**.

Your job is to **read the existing code**, adjust it minimally but precisely, and then **document** what you changed, why, and how to test it.

