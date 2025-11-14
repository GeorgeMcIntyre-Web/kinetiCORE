# Factory Piping Elevation – Developer Notes

This guide captures the Phase 0 implementation so Agents can extend the feature without re-reading every source file.

---

## Architecture Snapshot

| Area | Files | Notes |
| --- | --- | --- |
| Domain Types | `src/domain/factoryServices/piping/pipingTypes.ts` | Defines `PipingPlacementMode` (`'on_floor' | 'fixed_height'`) and the `PipingPlacementSettings` bag alongside the core network/node/segment types. |
| Store | `src/domain/factoryServices/piping/pipingStore.ts` | Single source of truth for placement settings + CRUD. Default `defaultElevation` is 1 m, clamped to ≥0. All setters use guard clauses so no React/Babylon references leak into the domain. |
| Workflow | `src/services/piping/PipingWorkflowHandler.ts` | Reads placement settings on every click, runs `computeNodePositionFromHit`, then persists nodes/segments via the store. ESC + Shift modifiers are handled here. |
| Scene Sync | `src/services/piping/PipingSceneService.ts` | Subscribes to the store, re-creates node spheres/cylinders, and exposes `handlePick` so the workflow can detect Shift-clicked nodes. |
| UI | `src/ui/piping/PipingPanel.tsx` | Surfaces placement mode radio buttons, default elevation input, and preset buttons. Talks to the domain through the exported store singleton. |
| Validation | `src/domain/factoryServices/piping/pipingValidation.ts` | Emits warnings for too-short segments and steam pipes without insulation. No elevation-specific rules currently exist. |

---

## Domain & Store Details

- Placement settings live on the store instance:
  ```ts
  private placementSettings: PipingPlacementSettings = {
    mode: 'on_floor',
    defaultElevation: 1,
  };
  ```
- `getPlacementSettings()` always returns a copy to avoid accidental mutation. Anytime you add new fields, update `createDefaultPlacementSettings`.
- `setPlacementMode`/`setDefaultElevation` are defensive: they exit early when the value is unchanged or invalid. Keep that pattern when adding setters (e.g., for future snap tolerances).
- Tests live at `tests/piping/pipingStore.test.ts`. Extend them whenever the placement state shape changes (initial defaults, setters, clear/reset behaviour).

---

## Workflow & Scene Integration

1. `PipingWorkflowHandler.initialize(scene, sceneService)` wires Babylon pointer + keyboard listeners. No React dependencies are introduced.
2. On every standard click the handler:
   - Ensures piping mode is enabled via `useEditorStore`.
   - Reads the placement settings from the store.
   - Calls `computeNodePositionFromHit` (the helper respects the Z-up axis constant and only adjusts `y` when mode === `fixed_height`).
   - Creates or fetches a network and persists the node.
3. `PipingSceneService` listens for store changes, re-creates meshes, and exposes `handlePick`. Shift-click logic in the workflow relies on this metadata to start segments.
4. Segment creation (Shift+Click) still uses defaults from `pipingRules` (diameter, insulation) and is independent of elevation.

To keep this chain predictable:
- Avoid importing Babylon into the domain.
- Keep guard clauses in the handler (early returns on missing pick info, disabled mode, duplicates, etc.).
- Prefer logging internally (`console.warn`) rather than throwing—scene workflows run inside Babylon event loops.

---

## Validation Hooks

- Domain validation currently focuses on:
  - `computeApproxSegmentLength` vs `isSegmentTooShort`
  - Steam pipes lacking insulation
- There is no RouteValidator integration yet. When adding elevation-specific rules:
  - Implement them in `pipingValidation.ts` so both UI badges and future exporters can reuse them.
  - Only call into those helpers from the workflow (or from future command handlers), keeping Babylon objects away from domain code.
  - If RouteValidator needs to understand piping nodes, add an adapter that converts store data into the validator’s DTOs instead of importing Babylon meshes.

---

## Adding a New Placement Mode

1. Extend `PipingPlacementMode` in `pipingTypes.ts` and update `PipingPlacementSettings`.
2. Update the store default + setter tests.
3. Teach `computeNodePositionFromHit` how to interpret the new mode (use guard clauses; avoid `else if` cascades).
4. Expose UI controls in `PipingPanel` (and any other panels) with proper labels/ARIA.
5. Add workflow tests in `tests/piping/pipingWorkflowHandler.int.test.ts` to prove the mode affects the stored `position.y`.

When you eventually implement “Snap to Existing,” this is the checklist you’ll follow.

---

## Debug Overlay Ideas

A lightweight overlay helps verify elevations without digging into the inspector:

1. Create `src/services/piping/debug/PipingPlacementOverlay.ts`.
2. Subscribe to the store and `useEditorStore` to track placement mode/elevation.
3. Render Babylon helpers (ground disc, vertical rulers, etc.) in the overlay scene. Keep construction/destruction symmetrical to avoid leaks.
4. Mount the overlay next to `PipingSceneService` inside `SceneManager` so they share lifecycle events.
5. Gate everything behind an editor-store flag (e.g., `debugFlags.pipingPlacement`) so production builds remain clean.

---

## Migration Checklist

- [ ] Confirm `pipingStore` exports cover every UI requirement (mode, default elevation, future snap fields).
- [ ] When changing the placement state, update serialization/import paths so saves stay forward-compatible.
- [ ] Extend tests (domain + workflow + UI) before wiring new Babylon behaviour.
- [ ] Document the new mode/rule in both this file and the user-facing guide.
