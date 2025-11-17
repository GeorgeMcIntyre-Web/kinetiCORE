# Factory Piping Elevation-Aware Placement - Test Matrix

**Purpose:** Comprehensive test coverage checklist for Agents 1 (E2E) and 7 (QA)
**Integration Branch:** `integration/factory-piping-elevation`
**Baseline:** Phase 0 complete @ commit `4966c45`

---

## Core Functional Flows

| # | Flow | Unit Tests | Integration Tests | E2E Tests | Manual Smoke | Owner | Status |
|---|------|------------|-------------------|-----------|--------------|-------|--------|
| 1 | Floor placement (on_floor mode) | ✅ pipingStore.test.ts | ✅ pipingWorkflowHandler.int.test.ts | ⏸️ Pending | ⏸️ Pending | Agent 1 | Phase 3 |
| 2 | Elevation placement (fixed_height mode) | ✅ pipingStore.test.ts | ✅ pipingWorkflowHandler.int.test.ts | ⏸️ Pending | ⏸️ Pending | Agent 1 | Phase 3 |
| 3 | Mode switching (floor ↔ elevation) | ✅ pipingPanel.ui.test.tsx | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 1 | Phase 3 |
| 4 | Custom elevation input | ✅ pipingPanel.ui.test.tsx | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 1 | Phase 3 |
| 5 | Preset elevation buttons (0.5m, 1m, 2m) | ✅ pipingPanel.ui.test.tsx | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 1 | Phase 3 |
| 6 | Undo/redo with elevation | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 1 | Phase 3 |
| 7 | Store synchronization (UI ↔ domain) | ✅ pipingPanel.ui.test.tsx | ✅ pipingSceneService.int.test.ts | ⏸️ Pending | ⏸️ Pending | Agent 1 | Phase 3 |
| 8 | 3D mesh rendering at elevation | ✅ pipingSceneService.int.test.ts | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 1 | Phase 3 |

---

## Edge Cases & Error Handling

| # | Scenario | Unit Tests | Integration Tests | E2E Tests | Manual Smoke | Owner | Status |
|---|----------|------------|-------------------|-----------|--------------|-------|--------|
| 9 | Negative elevation input (should clamp to 0) | ✅ pipingStore.test.ts | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 5 | Phase 2 |
| 10 | NaN elevation input (should ignore) | ✅ pipingStore.test.ts | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 5 | Phase 2 |
| 11 | Empty elevation field behavior | ✅ pipingPanel.ui.test.tsx | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 5 | Phase 2 |
| 12 | No floor in scene (free-space placement) | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 5 | Phase 2 |
| 13 | Sloped floor (not horizontal) | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 5 | Phase 2 |
| 14 | Multiple floors at different heights | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 5 | Phase 2 |
| 15 | Very large elevation values (>1000m) | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 5 | Phase 2 |
| 16 | Rapid mode switching (performance) | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | ⏸️ Pending | Agent 5 | Phase 2 |

---

## Coordinate System & Axis Awareness

| # | Test | UP_AXIS | Expected Behavior | Unit Tests | Integration Tests | Owner | Status |
|---|------|---------|-------------------|------------|-------------------|-------|--------|
| 17 | Y-up placement (current) | `'y'` | Elevation affects `position.y` | ✅ pipingWorkflowHandler.int.test.ts | ⏸️ Pending | Agent 8 | Phase 0 ✅ |
| 18 | Z-up placement (future) | `'z'` | Elevation affects `position.z` | ⏸️ Configurable | ⏸️ Configurable | Agent 3 | Phase 2 |
| 19 | Coordinate conversion accuracy | Both | Floor + offset = final position | ✅ pipingWorkflowHandler.int.test.ts | ⏸️ Pending | Agent 8 | Phase 0 ✅ |

**Note:** kinetiCORE uses **Z-up** as the global standard (per COORDINATE_SYSTEM.md), but current Babylon scene may use Y-up. The `UP_AXIS` constant in PipingWorkflowHandler handles this. Agent 3 should add debug overlay showing which axis is active.

---

## Accessibility & UX

| # | Requirement | Implementation | Unit Tests | Manual Smoke | Owner | Status |
|---|-------------|----------------|------------|--------------|-------|--------|
| 20 | Keyboard navigation (Tab, Enter) | PipingPanel.tsx | ⏸️ Pending | ⏸️ Pending | Agent 4 | Phase 1 Step 1 |
| 21 | Screen reader labels (aria-label) | PipingPanel.tsx | ⏸️ Pending | ⏸️ Pending | Agent 4 | Phase 1 Step 1 |
| 22 | Focus indicators | PipingPanel.tsx | ⏸️ Pending | ⏸️ Pending | Agent 4 | Phase 1 Step 1 |
| 23 | Color contrast (WCAG AA) | PipingPanel.tsx | ⏸️ Pending | ⏸️ Pending | Agent 4 | Phase 1 Step 1 |
| 24 | Tooltips/help text for elevation | PipingPanel.tsx | ⏸️ Pending | ⏸️ Pending | Agent 4 | Phase 1 Step 1 |
| 25 | Input validation feedback (visual) | PipingPanel.tsx | ⏸️ Pending | ⏸️ Pending | Agent 4 | Phase 1 Step 1 |

---

## Performance & Regression

| # | Metric | Baseline | Target | Test Method | Owner | Status |
|---|--------|----------|--------|-------------|-------|--------|
| 26 | Time to place 100 nodes (floor mode) | N/A | <500ms | Benchmark test | Agent 1 | Phase 3 |
| 27 | Time to place 100 nodes (elevation mode) | N/A | <500ms | Benchmark test | Agent 1 | Phase 3 |
| 28 | Memory usage (1000 nodes) | N/A | <100MB delta | Manual profiling | Agent 7 | Phase 3 |
| 29 | No regression in existing piping features | N/A | 0 broken tests | CI/CD | Agent 8 | ✅ Ongoing |
| 30 | FPS in scene with elevated piping | N/A | >55 FPS | Manual smoke | Agent 7 | Phase 3 |

---

## Integration with Existing Systems

| # | System | Integration Point | Test Coverage | Owner | Status |
|---|--------|-------------------|---------------|-------|--------|
| 31 | Snapping system | Does elevation affect snap? | ⏸️ Pending | Agent 5 | Phase 2 |
| 32 | Undo/redo commands | Elevation in command history | ⏸️ Pending | Agent 1 | Phase 3 |
| 33 | Network serialization | Elevation in saved/loaded networks | ⏸️ Pending | Agent 1 | Phase 3 |
| 34 | Selection highlighting | Elevated nodes still selectable | ✅ pipingSceneService.int.test.ts | Agent 8 | Phase 0 ✅ |
| 35 | BOM calculation | Elevation doesn't affect length/cost | ⏸️ Pending | Agent 1 | Phase 3 |

---

## Documentation & Help

| # | Document | Content | Owner | Status |
|---|----------|---------|-------|--------|
| 36 | User guide (elevation feature) | How to use modes, presets, custom values | Agent 7 | Phase 3 |
| 37 | API docs (pipingStore) | placement settings methods | Agent 7 | Phase 3 |
| 38 | QA checklist (manual testing) | Step-by-step smoke test procedure | Agent 7 | ✅ Done (PIPING_QA_CHECKLIST.md) |
| 39 | Known issues / limitations | Sloped floors, Z-up migration, etc. | Agent 7 | Phase 3 |
| 40 | Migration guide (for existing networks) | None needed (backwards compatible) | Agent 7 | Phase 3 |

---

## Final Gate Checklist (Agent 6 + Agent 8)

Before merging `integration/factory-piping-elevation` → `main`:

- [ ] All Phase 1-3 agents have merged without conflicts
- [ ] `npm run test` passes (0 failures)
- [ ] `npm run build` succeeds
- [ ] `npm run lint` shows no NEW errors in piping code
- [ ] Manual smoke test: floor + elevation + mode switch + undo
- [ ] All high-priority items in this matrix are ✅
- [ ] PM_STATUS_REPORT.md updated with final summary
- [ ] CHANGELOG.md entry added
- [ ] PR description links to this test matrix

---

## Notes for Agents

**Agent 1 (E2E):** Focus on rows 1-8 and performance tests (26-27). Use Playwright or Vitest browser mode.

**Agent 5 (Edge Cases):** Focus on rows 9-16. Add unit tests for each edge case in `pipingValidation.test.ts`.

**Agent 4 (UX):** Focus on rows 20-25. Ensure accessibility before merge.

**Agent 7 (QA):** Focus on rows 36-40 and manual smoke tests. Update PIPING_QA_CHECKLIST.md with elevation-specific steps.

**Agent 3 (Debug):** Focus on row 18 (Z-up overlay) and add debug logging for elevation calculations.

**Agent 2 (Settings):** Your store implementation (Phase 0 baseline) already covers rows 1-2. Focus on persistence and defaults.

**Agent 6 (Final Gate):** Use this matrix as your gate criteria. No merge until critical items are ✅.

---

**Last Updated:** November 14, 2025 - Phase 0 Complete
**Next Update:** After Phase 1 Step 1 (Agent 4) completes
