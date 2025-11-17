# Factory Piping Elevation – QA Overview

## Automated Test Coverage

| Suite | File | What it covers |
| --- | --- | --- |
| Domain types/store | `tests/piping/pipingStore.test.ts` | Placement defaults, setters (mode/elevation), CRUD, selection, reset behaviour. |
| Rules & helpers | `tests/piping/pipingRules.test.ts` | Distance math, diameter defaults, slope helpers used by validation. |
| Serialization | `tests/piping/pipingSerialization.test.ts` | Ensures node/segment data (including positions) round-trip cleanly. |
| Descriptions | `tests/piping/pipingDescription.test.ts` | Verifies human-readable summaries reflect current node coordinates. |
| Validation | `tests/piping/pipingValidation.test.ts` | Too-short segment detection + steam insulation warnings. |
| Scene service | `tests/piping/pipingSceneService.int.test.ts` | Mesh creation/cleanup stays in sync with the store as nodes are added or removed. |
| Workflow handler | `tests/piping/pipingWorkflowHandler.int.test.ts` | Shift-click segment creation, ESC cancel, fixed-height mode adjusting node `y`. |
| UI | `tests/piping/pipingPanel.ui.test.tsx` | Placement panel radio buttons, default elevation input, preset buttons, and tab rendering. |
| (Planned) E2E | `tests/piping/pipingPlacement.e2e.test.ts` | Placeholder for Agent 1 to add full viewport smoke once Phase 3 begins. |

> Remember: lint is already clean for piping files. Keep it that way.

## Manual QA Checklist

1. Toggle Factory Piping mode and open the panel – confirm the Node Placement card reflects the store defaults (On floor + 1 m).
2. Place two nodes on a floor: verify inspector `y` matches the surface height.
3. Switch to Fixed height, set 2 m, place nodes on the same floor: the inspector `y` should be ~2 m higher.
4. Shift+click to create a segment, then press Esc before finishing – pending state should clear without extra nodes.
5. Delete a node; confirm its meshes disappear (scene service sync).
6. Save + reload a network (serialization helper) and ensure placement settings persist.

## Known Limitations / Follow-ups

- Snap-to-existing mode is not implemented yet; documentation calls it out as planned.
- No “no-floor” fallback—clicks without valid hits simply do nothing. Users need proxy meshes when working above voids.
- Validation only covers segment length + steam insulation; elevation-specific guardrails (slope limits, mixed-mode warnings) are deferred to a later phase.
- No HUD/overlay for placement mode, so accessibility relies on the panel + inspector for now.
- Undo/redo is not integrated with placement settings; switching modes or elevations is not undoable.
