# Factory Piping Elevation Migration Guide

This note documents the internal changes required to support elevation-aware node placement, helping developers understand the new responsibilities across the domain, workflow, scene, and validation layers.

## Overview of Changes

| Area | Files | Highlights |
| --- | --- | --- |
| Domain | `src/domain/factoryServices/piping/pipingTypes.ts`, `pipingStore.ts`, `pipingRules.ts`, `pipingSerialization.ts`, `pipingDescription.ts`, `pipingValidation.ts` | Nodes always store explicit `position.y`, store metadata keeps placement defaults per network, serialization/descriptions include elevation, validation exposes warnings when elevation data is missing or inconsistent. |
| Workflow | `src/services/piping/PipingWorkflowHandler.ts` | Node placement path now routes through a placement strategy (on-floor, fixed elevation, snap-to-existing) before calling `pipingStore.createNode`. Handler pushes placements through validation hooks before deferring to `PipingSceneService`. |
| Scene | `src/services/piping/PipingSceneService.ts` | Mesh sync uses the precise node elevation, ensuring Babylon geometry matches the domain. Snap mode reuses the service for hit-testing existing nodes/segments. |
| Validation | `src/domain/factoryServices/piping/pipingValidation.ts`, `src/routing/validation/RouteValidator.ts` | Elevation deltas feed into slope checks, and `RouteValidator` can mirror warnings when piping networks are exported into routing contexts. |

## Old vs New Behavior

| Capability | Before | Now |
| --- | --- | --- |
| Default placement | Nodes inherited the raw Babylon pick result; users manually edited elevation afterward. | Placement strategies normalize clicks, so floor placements hug Y = 0, elevated runs auto-offset, and snaps honor existing geometry. |
| Serialization | Elevation was implicit and sometimes rounded out. | JSON exports always carry the stored `position.y` plus `defaultElevation` hints for each network. |
| Description UX | Text summaries skipped height. | `pipingDescription` includes “Elevation: 3.10 m” lines so QA can verify without opening the scene. |
| Validation | Only diameter/insulation checks. | Elevation gaps trigger warnings (e.g., “Node stored with estimated elevation”) and RouteValidator can surface them alongside routing issues. |

## Adding a Placement Mode

1. **Define mode metadata** in `pipingTypes.ts` (`PlacementMode = 'on_floor' | 'fixed_height' | 'snap_existing' | 'your_mode'`) and extend `pipingStore.meta` with any defaults you require.
2. **Implement a strategy** inside `PipingWorkflowHandler.handleNodePlacement`. Follow the guard-clause style: detect mode, call a dedicated helper (e.g., `applyRackOffset()`), and bail early when prerequisites (floor hit, snap target) are missing.
3. **Expose UI controls** in `src/ui/piping/PipingPanel.tsx` so users can switch modes. Keep state in the editor store; the handler reads from `useEditorStore.getState()`.
4. **Update tests** under `tests/piping` (unit + integration) so each mode has coverage for elevation math and failure states.

## Workflow + Validation Integration

- `PipingWorkflowHandler.initialize(scene, pipingSceneService)` wires Babylon pointer + keyboard listeners once per scene.  
- Every placement funnels through `resolvePlacementMode()` (internal helper) which:  
  1. Reads `useEditorStore.getState().pipingPlacementMode`.  
  2. Consults `pipingStore` to fetch the active network + default elevation metadata.  
  3. Calls the relevant placement strategy (`projectToFloor`, `applyFixedElevation`, `snapToExistingMesh`).  
  4. Passes the resolved world coordinates to `pipingValidation.getSegmentWarnings` when segments are created so slope and insulation issues surface immediately.  
- The handler then calls into `pipingStore` to persist the node/segment, triggering store listeners. `PipingSceneService` is already subscribed and rebuilds meshes with the same Y coordinate, keeping the viewport in sync.  
- For undo/redo, only the command layer writes into the store. The workflow handler avoids side effects (no React state) so future history commands can wrap placement actions.

## Extending Validation Rules

- **Domain warnings**  
  Edit `pipingValidation.ts` to add new warning types (e.g., `stair_step_exceeds_limit`). Use guard clauses to skip missing nodes.  
  Return structured warnings so UI badges render correctly.

- **Workflow safeguards**  
  If the rule depends on placement input (e.g., min rack height), enforce it in `PipingWorkflowHandler` before creating the node, showing a toast or HUD message when the rule fails.

- **Routing parity**  
  When the piping data is exported to Smart Routing, invoke `RouteValidator` with the same thresholds so mixed-mode projects see consistent results. `RouteValidator` already exposes `registerCustomRule('factory_piping', fn)`; reuse it to surface piping warnings inside routing dashboards.

## Adding a Debug Overlay

1. Create a lightweight helper (e.g., `PipingPlacementOverlay`) under `src/services/piping/debug/`. Keep it Babylon-only.  
2. Subscribe to `pipingStore` and read `useEditorStore.getState().pipingPlacementMode` to determine what to render (floor projection disc, elevation ruler, snap indicator).  
3. Update `SceneManager` to instantiate the overlay next to `PipingSceneService` so both share the same lifecycle hooks.  
4. Gate overlays behind `editorStore.debugFlags.pipingPlacement`. The workflow handler already emits events (`onPlacementPreviewChanged`) you can tap into without mutating store data.  
5. Document any new debug flag in `docs/DEBUG_FLOOR.md` and add snapshot tests if the overlay affects serialized scene state.

## Hooking into `pipingStore` for Future Features

- **Subscriptions** – Use `pipingStore.subscribe()` to keep services in sync. Unsubscribe on dispose to avoid leaking Babylon meshes or React listeners.
- **Metadata** – Each network’s `meta` bag can store settings like `defaultElevation`, `placementMode`, or service-specific parameters. Use plain objects so serialization stays stable.
- **Selections** – Rely on `pipingStore.setSelectedNode/Segment` to drive UI highlights; don’t duplicate selection state in component-level hooks.
- **Resets** – Call `pipingStore.clear()` in test setups or when importing new layouts to guarantee placement defaults reset as well.

## QA & Testing Notes

- **Unit** – `tests/piping/pipingStore.test.ts`, `pipingRules.test.ts`, `pipingSerialization.test.ts`, `pipingDescription.test.ts`, `pipingValidation.test.ts`.
- **Integration** – `tests/piping/pipingSceneService.int.test.ts`, `tests/piping/pipingWorkflowHandler.int.test.ts`.
- **UI** – `tests/piping/pipingPanel.ui.test.tsx`.
- **E2E** – `tests/piping/pipingPlacement.e2e.test.ts` verifies on-floor vs fixed-height clicks and snap-to-existing workflows.

Known limitations are tracked in `docs/dev/factory-piping-elevation-qa.md`; ensure new work keeps that list up to date.
