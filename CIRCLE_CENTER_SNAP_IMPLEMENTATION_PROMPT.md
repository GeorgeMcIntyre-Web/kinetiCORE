# 🔧 CIRCLE CENTER SNAP IMPLEMENTATION & HARDENING – MASTER PROMPT

You are an expert TypeScript + Babylon.js engineer working in a 3D CAD-style snapping system.

Your main goal: **finish, harden, and optimize "circle-center" snapping + preview**, without breaking any existing snap behavior.

---

You are working in the following files (relative paths may differ):

* `src/manipulation/snapConstants.ts` – layer masks, snap inclusion/exclusion helpers
* `src/manipulation/snapIndex.ts` – `SnapIndex` + `SpatialHash3D` + `queryNearestVertex`
* `src/manipulation/snap/circle.ts` – PCA + Taubin circle fitting and validation utilities
* `src/manipulation/SnappingHelper.ts` – main snap logic + preview rendering
* `src/manipulation/TransformGizmo.ts` – gizmo setup
* `src/manipulation/SnappingGizmoWrapper.ts` – integrates snapping with gizmos
* `src/manipulation/snap/index.ts` – `SnapQueryEngine` worker coordinator for anchors

You must **read these files carefully** before making changes.

---

## 1. High-level architecture

### 1.1 Snap system core

* **SnappingHelper** is the central orchestrator.
  Key methods:

  * `snapPosition(...)` – entry point, decides between simple / smart modes.
  * `smartSnapPosition(...)` – tries multiple snap types (vertex, midpoint, center, edge, face, etc.), then chooses the best candidate using distance + priority.
  * `snapToCenter(...)` – implements circle-center snapping.
  * `showPreviewDot(point, snapType)` – draws preview indicators.
  * `clearPreviewDot()` / `clearSnapIndicators()` – dispose preview + persistent indicators.

* **Snap types** (current priorities in smart mode):

  * `vertex` (highest priority)
  * `midpoint`
  * `center` (circle center)
  * `intersection`
  * `edge`
  * `bboxCorner`
  * `face`
  * `normal`
  * `object`
  * `perpendicular`
  * `tangent`
  * `surface` (lowest)

* **Preview**:

  * There is exactly **one live preview** at a time: `previewIndicator: Mesh | null`.
  * Long-lived "confirmed snap" markers live in `snapIndicators: Mesh[]`.
  * For `center`, preview expects metadata on the `position` vector:

    * `circleNormal: Vector3`
    * `circleRadius: number`
    * `circleVertices?: Vector3[]` (optional, debug dots)

### 1.2 Circle utilities (canonical math)

* `src/manipulation/snap/circle.ts` contains the **canonical** circle detection utilities:

  * PCA plane fitting (`fitPlanePCA`)
  * Projection to local 2D
  * Taubin circle fitting (`taubinCircle`)
  * Angular coverage computation (`angularCoverage`)
  * Quantile helper (`quantile`) for robust outlier removal

These should be treated as the **single source of truth** for circle fitting.

Any older custom circle-fitting logic inside `SnappingHelper` is considered **legacy / fallback only**.

### 1.3 Snap Index (vertex queries)

* `SnapIndex` (in `snapIndex.ts`) precomputes:

  * `vertsWorld: Float32Array` – welded world-space vertices for the mesh
  * `worldUpdateFlag: number` – to detect when world matrix changed
  * `hash: SpatialHash3D` – 3D grid for neighbor lookups
  * `cell: number` – cell size used in the hash

* `ensureSnapIndex(mesh: BABYLON.Mesh)`:

  * Creates or refreshes `mesh.metadata.__snapIndex` when the world matrix changes.

* `queryNearestVertex(mesh, pointerRay, pixelRadius, viewport)`:

  * Uses the `SnapIndex` to find the **closest vertex in screen-space** within a given pixel distance from the pointer.
  * Projections are done via `Vector3.Project` using world-space vertex positions and the scene transform matrix.

### 1.4 Layer masks and snap filtering

* `snapConstants.ts` defines:

  * `LAYER_UI` – for **UI/preview/utility** meshes (must be excluded from snapping & picking).
  * `LAYER_SNAP` – for **snap-eligible** geometry.

* Helpers:

  * `setMeshAsUI(mesh)` – moves a mesh to UI layer, non-pickable, excluded from snapping.
  * `enableSnapForMesh(mesh)` – puts geometry into snap layer and ensures world matrix + normals.

* Central snap filter:

  * `isSnapExcluded(mesh)` – single predicate that defines which meshes are ignored by the snap system (UI meshes, helper markers, etc).

---

## 2. Current circle-center flow (what exists today)

### 2.1 Entry path from tools

* During gizmo drag:

  * `TransformGizmo` owns a `GizmoManager`.
  * `SnappingGizmoWrapper` listens to gizmo drag events, and calls:

    * `SnappingHelper.snapPosition(...)` with:

      * current position
      * `SnapSettings`
      * pointer screen coordinates (`pointerScreenX`, `pointerScreenY`)
      * active camera

  * The result is applied to the gizmo target and, if snapped, `showPreviewDot` / `snapIndicators` handle visual feedback.

### 2.2 smartSnapPosition → snapToCenter

* `snapPosition(...)` calls `smartSnapPosition(...)` when `settings.smartSelect === true`.

* `smartSnapPosition(...)`:

  * Computes priority table for snap types.
  * For each enabled snap type, calls its `snapToX` and, if `snapped`, pushes `{ result, distance, priority }` into `candidates`.
  * Finally picks the best candidate by:

    * smallest distance
    * if tie, lowest priority

* For circle centers:

  ```ts
  if (snapToCenter) {
    const result = this.snapToCenter(
      position,
      settings.snapDistance,
      excludeMeshIds,
      camera,
      screenSpacePixels,
      pointerScreenX,
      pointerScreenY
    );
    if (result.snapped) {
      const distance = BABYLON.Vector3.Distance(position, result.position);
      candidates.push({ result, distance, priority: priorities.center || 999 });
    }
  }
  ```

So in **smart mode**, `snapToCenter` now receives `pointerScreenX` and `pointerScreenY`.

### 2.3 snapToCenter internal behavior

* **New path** (preferred):

  * Guarded by:

    ```ts
    if (camera && screenSpacePixels !== undefined && pointerScreenX !== undefined && pointerScreenY !== undefined) {
      // NEW screen-space annulus + circle.ts pipeline
    }
    ```

  * Rough behavior:

    * Builds a list of **edge midpoints** from nearby meshes in front of the pointer (using indices / positions).
    * Projects these midpoints to screen space.
    * Applies an **annulus filter**: midpoints must lie between `innerPx` and `outerPx` from the pointer, where:

      * `innerPx ≈ 0.6 * baseRadius`
      * `outerPx ≈ 1.4 * baseRadius`
      * `baseRadius` is based on DPI (`dpr`) and a target pixel scale.

    * Applies occlusion gating using a depth ray (`frontDepth + OCCLUSION_PAD_MM`).
    * Deduplicates / filters outliers via residual quantiles.
    * Calls `fitPlanePCA`, `projectToPlane`, `taubinCircle`, `angularCoverage` to obtain:

      * `centerWorld: Vector3`
      * `normalWorld: Vector3`
      * `radius: number`
      * `coverage: number`
      * `rms` and relative RMS

    * Applies hard thresholds (for now):

      * min point counts (`front >= 16`, `keep >= 24`)
      * minimum angular coverage (≈ two hundred ten degrees)
      * maximum relative RMS (≈ eight percent)

    * If all checks pass, returns a circle result.

* **Metadata attachment (new path)**:

  * On success, we construct a `snapPoint = centerWorld.clone()` and attach:

    ```ts
    (snapPoint as any).circleNormal = normalWorld.clone().normalize();
    (snapPoint as any).circleRadius = radius;
    (snapPoint as any).circleVertices = /* chosen world-space vertices used for the fit */;
    ```

  * We then return a `SnapResult`:

    ```ts
    return {
      snapped: true,
      position: snapPoint,
      snapType: 'center',
      targetMeshName: maybeMeshName,
      visualFeedback: [snapPoint, (snapPoint as any).circleNormal, new BABYLON.Vector3(radius, 0, 0)]
    };
    ```

* **Old path** (fallback / legacy):

  * Runs when the new screen-space path preconditions are not met or when it fails.
  * Uses an older world-space face-grouping + circle fit routine (`fitCircleToPoints`).
  * Now also attaches `circleNormal` and `circleRadius` to the snap point, along with `circleVertices`.

### 2.4 showPreviewDot for center snaps

* `showPreviewDot(point, 'center')` expects:

  * `point.circleNormal: Vector3`
  * `point.circleRadius: number`
  * `point.circleVertices?: Vector3[]` (optional debug dots)

* It:

  * Clears previous preview (`clearPreviewDot`).
  * Computes a **world-space size** for the marker (dot + ring) using a **pixel-based target size**:

    * Uses a `worldToPixelDistance` helper (in `snapConstants.ts`) to convert between world distances and pixel distances based on camera and depth.

  * Draws:

    * A center dot (small sphere)
    * A torus ring oriented with `circleNormal` and sized to `circleRadius`
    * Optional cyan spheres at `circleVertices` for debugging

  * Sets:

    * `mesh.layerMask = LAYER_UI`
    * `isPickable = false`
    * Adds meshes to a dedicated glow layer (`snap-preview-glow`)

---

## 3. Real-world data problems the implementation must handle

You must design and tune the system for **real BIW / robot-cell geometry**, not just toy cylinders.

Key issues:

1. **Duplicate vertices (STL and others)**

   * Many formats repeat vertices per triangle → same point appears multiple times.
   * The test harness and `SnapIndex` already deduplicate with an epsilon (≈ `1e-4` in world space).
   * Preserve and respect this welding behavior to avoid over-weighting certain regions.

2. **Screen-space, not world-space, selection**

   * The UX is defined in **pixels**: "snap when the pointer is within N pixels of the feature."
   * Circle detection must:

     * Select candidate points in **screen-space**.
     * Keep thresholds stable across zoom, FOV, and resolution.

   * Any "optimization" that uses only world-distance thresholds is likely wrong.

3. **Noisy / polluted candidate sets**

   * The pixel radius can grab:

     * Vertices from multiple meshes behind/in front.
     * Edges and ribs around the hole.

   * The circle fit must:

     * Tolerate noise.
     * Use **robust outlier rejection** (quantiles or similar).
     * Reject degenerate cases (near-colinear points, very small circles, etc).

4. **Partial arcs, chamfers, ellipses**

   * Holes may be:

     * Partially visible (occluded).
     * Chamfered (two concentric circles).
     * Slightly elliptical or low-poly approximations of circles.

   * You must:

     * Use `angularCoverage` + RMS thresholds to distinguish "good enough circle" from noise.
     * Handle partial arcs gracefully (possibly with slightly relaxed coverage if RMS is excellent).
     * For multiple concentric rings, pick the best candidate deterministically.

5. **Occlusion correctness**

   * Vertices behind other geometry should usually be excluded.
   * The current system:

     * Shoots a ray from the pointer to get `frontDepth`.
     * Treats points with projection-depth significantly beyond `frontDepth + pad` as occluded.

   * Preserve / refine this behavior.

6. **Performance & degraded mode**

   * Large production scenes (full robot + tooling + car body) can have millions of vertices.
   * Circle-center snap must:

     * Respect **per-frame and per-mesh budgets**.
     * Degrade gracefully:

       * Skip circle detection when over budget.
       * Fall back to simpler snaps (vertex, midpoint) rather than freezing the app.

---

## 4. Hard constraints and invariants (do NOT break)

1. **No regression on existing snap types**

   * `vertex`, `midpoint`, `edge`, `face`, `object`, etc. must behave exactly as before.
   * Smart snapping must still prefer vertex → midpoint → center → others using the priority table.

2. **Preview must never lie**

   * If the preview shows a circle-center ring, the **final snapped position must be that center**.
   * If no valid circle is found, there must be:

     * No circle preview ring.
     * Either no preview or a different snap type's preview.

3. **Layer masks & pickability**

   * All preview and indicator meshes must:

     * Use `LAYER_UI`.
     * Have `isPickable = false`.
     * Snap queries **must not** see these meshes as candidates.

4. **Pointer-driven circle detection**

   * `snapToCenter` in *smart mode* must use the `pointerScreenX` / `pointerScreenY` parameters.
   * Do **not** revert back to the old behavior of ignoring pointer coordinates in smart mode.

5. **Coding style (for new/modified code)**

   * Prefer **guard clauses** at the top; avoid deep nesting.
   * Avoid `else` / `elseif` where reasonable; early returns are preferred.
   * Keep functions small, readable, and explicit.
   * Avoid 3+ levels of nesting.

---

## 5. Specific tasks for you

### P0 – Stabilize the circle-center pipeline and metadata flow

1. **Confirm metadata contract from `snapToCenter` to `showPreviewDot`:**

   * Ensure *every* successful center snap sets on the `position` vector:

     * `circleNormal: Vector3` (normalized, world-space)
     * `circleRadius: number`
     * `circleVertices?: Vector3[]` (optional, but recommended for debug builds)

2. **Ensure smartSnapPosition always uses the correct path:**

   * In `smartSnapPosition`, verify that center snapping uses:

     ```ts
     this.snapToCenter(
       position,
       settings.snapDistance,
       excludeMeshIds,
       camera,
       screenSpacePixels,
       pointerScreenX,
       pointerScreenY
     );
     ```

   * Confirm this is compiled source, not just TS that gets stripped.

3. **Unify `SnapResult` shape for center snaps:**

   * Both the new (`tryCircleCenter` / `circle.ts`) and old (`fitCircleToPoints`) paths must return a consistent `SnapResult`:

     * `snapped: boolean`
     * `position: Vector3` (with circle metadata attached when `snapType === 'center'`)
     * `snapType: 'center'`
     * `targetMeshName?: string`
     * `visualFeedback?: [center, normal, radiusVector]`

### P1 – Tune thresholds & make them configurable

4. **Extract circle validation thresholds into a config struct**, e.g.:

   ```ts
   export type SnapCircleConfig = {
     minFrontPoints: number;
     minKeptPoints: number;
     minCoverageRad: number;
     maxRelRms: number;
     minRadiusMeters: number;
     basePixelRadius: number;
     innerFactor: number;
     outerFactor: number;
   };
   ```

5. **Provide sane defaults** for BIW / robot-cell scale:

   * e.g. `minFrontPoints = 16`, `minKeptPoints = 24`, `minCoverageRad = 7 * Math.PI / 6`, `maxRelRms = 0.08`, `minRadiusMeters ≈ 1e-3`.

6. **Wire this config into `tryCircleCenter`** and the old path so tuning is centralized (even if you don't yet expose it in UI).

### P1 – Performance & degraded mode

7. **Add lightweight timing to `snapToCenter`:**

   * Measure:

     * candidate collection time
     * circle fit time

   * Aggregate in existing telemetry (if available) or add a small `CircleSnapTelemetry` struct.

8. **Introduce a simple degraded mode for circle centers:**

   * If time spent in circle detection for the current frame exceeds a threshold (e.g. 2–3 ms) or if the number of candidates explodes:

     * Skip circle detection for that frame.
     * Return `snapped: false` for center.

   * Consider hooking into `SnapQueryEngine`'s existing `degraded` flag to coordinate.

### P2 – Consistency with screen-space thresholds

9. **Align center annulus scale with other snap thresholds:**

   * Base the circle annulus radii on `screenSpacePixels` from `SnapSettings` rather than a separate constant.
   * Example:

     * vertex radius = `screenSpacePixels`
     * center inner radius = `k1 * screenSpacePixels`
     * center outer radius = `k2 * screenSpacePixels`

10. **Improve orthographic camera behavior** in `worldToPixelDistance`:

    * Currently it uses a rough fallback; refine it so indicator sizing is stable for ortho cameras.

### P2 – Testing & validation harness

11. **Extend the existing debug harness (or add a new one) to test circle snapping:**

    * Scenarios:

      * Single clean cylinder hole.
      * Partial circle (half covered).
      * Chamfered hole (two rings).
      * Elliptical / low-poly "circle".
      * Very small hole (below `minRadius` threshold).
      * Realistic robot-cell mesh around a hole.

12. **Add at least basic unit tests / integration tests** (where possible) for `circle.ts`:

    * Given synthetic points on a circle + noise, assert:

      * center error below tolerance
      * radius error below tolerance
      * coverage computed correctly
      * RMS and relative RMS thresholds behave as expected.

---

## 6. Acceptance criteria

You are done when:

1. **Circle previews are trustworthy:**

   * Hovering near a circular feature:

     * Shows a stable center dot + ring aligned with the hole.
     * On snap, the object moves exactly to that center.

   * Hovering near non-circular geometry:

     * Does not show a circle ring (no false positives).

2. **Smart snapping remains smooth on large scenes:**

   * With a robot and a dense BIW model loaded:

     * Gizmo drags remain interactive.
     * No noticeable frame spikes from circle detection.
     * In worst-case scenarios, center snaps gracefully drop out (no preview) instead of freezing.

3. **No regressions in other snap modes:**

   * Vertex snaps still take precedence when very close to actual vertices.
   * Midpoints, edges, and faces behave as before.
   * Existing test harness scenarios for primitive shapes still pass.

4. **Code is maintainable:**

   * Circle-fitting logic is centralized in `src/manipulation/snap/circle.ts`.
   * `snapToCenter` is readable and uses guard clauses instead of deep nesting.
   * Thresholds and constants are in a config struct rather than magic numbers scattered across functions.

---

Use this prompt as your full context and **do not ignore any constraint above**.

Your job is to **read the existing code**, adjust it minimally but precisely, and then **document** what you changed, why, and how to test it.
