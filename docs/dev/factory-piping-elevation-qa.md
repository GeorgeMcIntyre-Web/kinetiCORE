# Factory Piping Elevation – QA Overview

## Test Coverage Snapshot

| Layer | File(s) | Focus |
| --- | --- | --- |
| Domain Store | `tests/piping/pipingStore.test.ts` | CRUD, selection, metadata persistence (including `defaultElevation`). |
| Domain Rules | `tests/piping/pipingRules.test.ts` | Elevation math, slope calculations, minimum segment length checks. |
| Serialization & Description | `tests/piping/pipingSerialization.test.ts`, `tests/piping/pipingDescription.test.ts` | Ensures elevation survives round-trips and shows up in generated narratives. |
| Validation | `tests/piping/pipingValidation.test.ts` | Warns for too-short segments, missing insulation, and estimated elevations. |
| Scene Integration | `tests/piping/pipingSceneService.int.test.ts` | Mesh placement sync, node/segment lifecycle, metadata for picking. |
| Workflow | `tests/piping/pipingWorkflowHandler.int.test.ts` | Placement modes (floor vs elevation), Shift+click segments, ESC cancel. |
| UI | `tests/piping/pipingPanel.ui.test.tsx` | Placement tab controls, node/segment counters, elevation form behavior. |
| E2E | `tests/piping/pipingPlacement.e2e.test.ts` | Full smoke of *On Floor*, *At Elevation*, *Snap to Existing* with viewport clicks and warning banners (Agent 1 finalizing assertions). |

> CI runs lint, build, and the full `npm test` suite on branch `integration/factory-piping-elevation`. Re-run locally before publishing QA status.

## Manual QA Checklist (Delta)

1. Toggle Factory Piping mode and confirm the Placement tab mirrors the HUD mode.  
2. Place two nodes in **On Floor** mode; inspector shows Y ≈ floor height.  
3. Switch to **At Elevation**, set 3 m default, place nodes; verify Y matches.  
4. Use **Snap to Existing** on a machine surface; node inherits the mesh height.  
5. Shift+click to create segments; warnings appear if elevation differences create extreme slopes.  
6. Export/import network; elevations stay intact.  
7. Check Route Warnings panel for mirrored piping warnings when exporting to Smart Routing.

## Known Limitations / Non-Goals

- **Floor detection** – Relies on first floor mesh hit; mezzanine levels need manual default elevation adjustments.  
- **Slope guidance** – No automatic rerouting; validation only surfaces warnings.  
- **Snap targets** – Only meshes tagged with `pipingObjectType` or `snap:factory_service` are eligible.  
- **Accessibility** – Screen reader announcements cover mode changes, but viewport snapping feedback is visual only (TODO: add audio cue).  
- **Undo/Redo** – Placement mode toggles are stored in the editor store, not the history stack; switching modes is not undoable.

Update this page whenever new modes, warnings, or test suites land so QA can triage regressions quickly.
