# 🎯 Final Merge Strategy - ChatGPT Approved
**Based on:** ChatGPT Strategic Review + PM_STATUS_REPORT.md
**Date:** November 14, 2025
**Status:** READY FOR EXECUTION

---

## 📋 Executive Summary

**Approved Merge Order:** `Phase 0 → Phase 1 (4→2) → Phase 2 (5→3) → Phase 3 (7+1‖6)`

**Key Changes from Original:**
1. Added **Phase 0** - Baseline gate (lint/test/build clean)
2. Clarified **Phase 1 conflict resolution** (Agent 4 UX + Agent 2 domain)
3. Made **Phase 3 parallel** (Agent 7 + Agent 1 can merge together)
4. Defined **contract-first approach** for `pipingStore.ts`

---

## 🚦 Phase 0 - Baseline Gate (Agent 8 - Claude Code)

**Branch:** `integration/factory-piping-elevation` (create from main)

**Gate Criteria:**
```bash
✅ npm run lint       # MUST be clean (0 errors, <20 warnings)
✅ npm run test       # MUST pass (245+ tests passing)
✅ npm run build      # MUST succeed
```

**Actions:**
1. Create integration branch from main
2. Fix remaining ~112 lint errors
3. Run full test suite
4. Run production build
5. **All agents rebase on this branch** before Phase 1

**Deliverable:** Clean baseline branch for all agents to merge into

---

## 🎨 Phase 1 - UX Baseline + Domain Alignment (Agents 4 & 2)

**Sequence:** `Agent 4 → Agent 2` (with conflict resolution)

### Step 1.1 - Merge Agent 4 (UX Baseline)
**Why First:** Agent 4 has active changes (+21 -5) and sets UX patterns

**Files:**
- `src/ui/piping/PipingPanel.tsx`
- `src/ui/piping/PipingInspector.tsx`
- `src/domain/factoryServices/piping/pipingStore.ts` (partial)

**Merge Command:**
```bash
git checkout integration/factory-piping-elevation
git merge --no-ff feature/agent4-ux-accessibility
npm run lint && npm run test  # Verify clean
```

### Step 1.2 - Rebase & Merge Agent 2 (Domain Canonical)
**Dependency:** Requires Agent 4 merged first

**Files:**
- `src/domain/factoryServices/piping/pipingStore.ts`
- `src/domain/factoryServices/piping/pipingTypes.ts`
- `src/ui/piping/PipingPanel.tsx` (wire to store)

**Conflict Resolution Strategy:**

**For `pipingStore.ts` conflicts:**
```typescript
// KEEP Agent 2 (domain canonical):
- Type definitions: PlacementMode, PipingPlacementSettings
- Store fields: placementMode, defaultElevationZ
- Selectors: getCurrentElevationZ(), isFloorPlacement()
- Actions: setPlacementMode(), setDefaultElevation()

// KEEP Agent 4 (UX canonical):
- UI field exposure patterns
- Action naming that UI calls
- Label/grouping for UI consumption
```

**For `PipingPanel.tsx` conflicts:**
```typescript
// KEEP Agent 4:
- Layout structure
- Accessibility attributes (aria-*, tabIndex)
- Keyboard shortcuts

// KEEP Agent 2:
- Store hooks (useStore(state => state.placementMode))
- Wire-up to domain actions
```

**Merge Command:**
```bash
git checkout feature/agent2-settings
git rebase integration/factory-piping-elevation
# Resolve conflicts per strategy above
git checkout integration/factory-piping-elevation
git merge --no-ff feature/agent2-settings
npm run lint && npm run test
```

**Phase 1 Invariants (MUST HOLD):**
- ✅ Store has final elevation-aware model
- ✅ UI compiles and uses store fields correctly
- ✅ No `any` types in piping domain
- ✅ Z-up coordinate system used consistently
- ✅ Tests pass

---

## 🔧 Phase 2 - Workflow & Validation (Agents 5 & 3)

**Sequence:** `Agent 5 → Agent 3` (validation before workflow)

### Step 2.1 - Merge Agent 5 (Edge Cases & Rules)
**Why First:** Establishes validation rules that workflow must respect

**Files:**
- `src/routing/validation/RouteValidator.ts`
- `src/services/piping/PipingWorkflowHandler.ts` (rules)

**Merge Command:**
```bash
git checkout feature/agent5-edge-cases
git rebase integration/factory-piping-elevation
git checkout integration/factory-piping-elevation
git merge --no-ff feature/agent5-edge-cases
npm run lint && npm run test
```

### Step 2.2 - Merge Agent 3 (Debug & Workflow)
**Dependency:** Requires Agent 5's validation rules

**Files:**
- `src/services/piping/PipingWorkflowHandler.ts` (workflow)
- `src/services/piping/PipingSceneService.ts` (scene)

**Conflict Resolution for `PipingWorkflowHandler.ts`:**
```typescript
// KEEP Agent 5:
- Validation guards (no floor, slope, snapping)
- Edge case handling rules
- Error messages for invalid states

// KEEP Agent 3:
- Workflow orchestration (node placement flow)
- Scene service calls
- Debug overlay creation
- Logging statements
```

**Merge Command:**
```bash
git checkout feature/agent3-debug-overlays
git rebase integration/factory-piping-elevation
# Resolve conflicts - keep BOTH agents' contributions
git checkout integration/factory-piping-elevation
git merge --no-ff feature/agent3-debug-overlays
npm run lint && npm run test
```

**Phase 2 Invariants (MUST HOLD):**
- ✅ Elevation-aware store + UI from Phase 1
- ✅ Workflow respects validation rules
- ✅ Scene service uses Z-up consistently
- ✅ Debug overlays work in all placement modes
- ✅ No NaN or undefined positions

---

## 📚 Phase 3 - Docs, E2E, Integration (Agents 7 + 1 ‖ Agent 6)

**Sequence:** `(Agent 7 + Agent 1 in parallel) → Agent 6`

### Step 3.1 - Parallel Merge: Agent 7 (Docs) + Agent 1 (E2E Tests)
**Why Parallel:** Different file sets, no conflicts

**Agent 7 Files:**
- `docs/factory-piping/elevation-aware-placement.md` (user docs)
- `docs/dev/factory-piping-elevation-migration.md` (dev docs)
- `docs/PIPING_QA_CHECKLIST.md` (updates)
- `CHANGELOG.md` (entry)

**Agent 1 Files:**
- `tests/piping/elevation-placement-e2e.spec.ts`
- `tests/piping/workflow-integration.spec.ts`

**Merge Commands (Parallel):**
```bash
# Agent 7
git merge --no-ff feature/agent7-docs

# Agent 1
git merge --no-ff feature/agent1-e2e-tests

# Verify
npm run lint && npm run test
```

### Step 3.2 - Final Integration: Agent 6
**Dependency:** Requires Agent 7 + Agent 1 merged

**Agent 6 Files:**
- Final integration wiring
- Feature flags (if any)
- Menu entries / UI exposure
- Any cross-module glue code

**Merge Command:**
```bash
git checkout feature/agent6-integration
git rebase integration/factory-piping-elevation
git checkout integration/factory-piping-elevation
git merge --no-ff feature/agent6-integration
npm run lint && npm run test && npm run build
```

**Phase 3 Invariants (MUST HOLD):**
- ✅ All E2E scenarios pass (see test matrix below)
- ✅ Documentation matches behavior
- ✅ Build succeeds
- ✅ No regressions in existing features

---

## 🧪 E2E Test Matrix (Agent 1)

### Core Scenarios

| # | Scenario | Placement Mode | Scene | Expected Behavior |
|---|----------|----------------|-------|-------------------|
| 1 | Floor placement | On Floor | Flat floor | Nodes at floor Z ±0.1mm |
| 2 | Elevated placement | At Elevation (1500mm) | Flat floor | Nodes at Z=1500 ±1mm |
| 3 | Mixed mode route | Switch mid-route | Flat floor | First nodes floor Z, later elevated |
| 4 | No floor fallback | On Floor | Empty scene | Error toast OR auto-switch to elevated |
| 5 | Sloped floor | On Floor | Ramped mesh | Nodes follow slope OR clamp to ref elevation |
| 6 | Snap to existing | Snap mode | Existing piping | New node = exact snapped position |
| 7 | Undo/Redo | Mixed modes | Any | Positions restore exactly |
| 8 | Keyboard shortcuts | Toggle mode | Any | Store updates, scene reflects |

### Test Implementation
```typescript
// tests/piping/elevation-placement-e2e.spec.ts
describe('Elevation-Aware Placement', () => {
  it('TC-1: places nodes on floor in flat scene', async () => {
    await pipingMode.setMode('on_floor');
    await viewport.click(100, 100); // Floor click
    const node1 = await pipingStore.getLastNode();

    expect(node1.position.z).toBeCloseTo(0, 0.1);
  });

  it('TC-2: places nodes at default elevation', async () => {
    await pipingMode.setMode('at_elevation');
    await pipingMode.setElevation(1500);
    await viewport.click(200, 200);
    const node2 = await pipingStore.getLastNode();

    expect(node2.position.z).toBeCloseTo(1500, 1);
  });

  // ... 6 more scenarios
});
```

---

## 📐 Conflict Resolution: pipingStore.ts Contract

**Single Source of Truth:**

```typescript
// src/domain/factoryServices/piping/pipingTypes.ts

/** Placement mode for new piping nodes */
export type PlacementMode = 'ON_FLOOR' | 'AT_ELEVATION' | 'SNAP_TO_EXISTING';

/** Placement settings for piping workflow */
export interface PipingPlacementSettings {
  mode: PlacementMode;
  defaultElevationZ: number;  // In scene units (mm for Z-up)
  snapDistance: number;        // Max distance for snap (mm)
}

// src/domain/factoryServices/piping/pipingStore.ts

interface PipingState {
  // ... existing fields
  placementSettings: PipingPlacementSettings;
}

const initialState: PipingState = {
  // ... existing fields
  placementSettings: {
    mode: 'ON_FLOOR',
    defaultElevationZ: 0,
    snapDistance: 50,
  },
};

// Actions
const pipingStore = create<PipingState>((set, get) => ({
  // ... existing actions

  setPlacementMode: (mode: PlacementMode) => {
    set(state => ({
      placementSettings: { ...state.placementSettings, mode }
    }));
  },

  setDefaultElevation: (elevationZ: number) => {
    set(state => ({
      placementSettings: { ...state.placementSettings, defaultElevationZ: elevationZ }
    }));
  },

  // Selectors (for UI convenience)
  getCurrentElevationZ: () => {
    const { mode, defaultElevationZ } = get().placementSettings;
    if (mode === 'ON_FLOOR') return 0;
    return defaultElevationZ;
  },

  isFloorPlacement: () => get().placementSettings.mode === 'ON_FLOOR',
}));
```

**Unit Test (Required):**
```typescript
// tests/domain/pipingStore.spec.ts
describe('PipingStore - Placement Settings', () => {
  it('defaults to ON_FLOOR mode', () => {
    const store = usePipingStore.getState();
    expect(store.placementSettings.mode).toBe('ON_FLOOR');
  });

  it('switches mode and updates elevation selector', () => {
    usePipingStore.getState().setPlacementMode('AT_ELEVATION');
    usePipingStore.getState().setDefaultElevation(1500);

    expect(usePipingStore.getState().getCurrentElevationZ()).toBe(1500);
  });

  it('floor mode returns Z=0 regardless of default elevation', () => {
    usePipingStore.getState().setPlacementMode('ON_FLOOR');
    usePipingStore.getState().setDefaultElevation(2000);

    expect(usePipingStore.getState().getCurrentElevationZ()).toBe(0);
  });
});
```

---

## 🚨 Merge Gate Checklist

**Before EACH agent merge, verify:**

- [ ] `npm run lint` passes (0 errors, <20 warnings)
- [ ] `npm run test` passes (all tests green)
- [ ] No new `@ts-nocheck` in piping files
- [ ] No new `any` types in piping domain
- [ ] Z-up coordinate system maintained (no `.y` for elevation)
- [ ] Documentation updated (if behavior changed)

**Before Phase 3 completion (Agent 6 merge):**

- [ ] All 8 E2E scenarios pass
- [ ] User docs match behavior
- [ ] Developer migration guide complete
- [ ] CHANGELOG.md entry added
- [ ] `npm run build` succeeds
- [ ] No regressions in existing piping tests

---

## 🎯 Critical Risks & Mitigations

### Risk 1: Contract Drift in Shared Files
**Files:** `pipingStore.ts`, `PipingWorkflowHandler.ts`
**Mitigation:**
- Define canonical contract FIRST (see above)
- Add 3-5 unit tests around contract
- Enforce in Phase 1 before later agents merge

### Risk 2: Z-up vs Y-up Confusion
**Impact:** Wrong elevation calculations
**Mitigation:**
- Explicitly ban `position.y` in elevation logic
- Add test that fails if `y` used for elevation
- Code review focuses on coordinate system

### Risk 3: Lint/Type Regressions After Merges
**Impact:** Build breaks after agent merge
**Mitigation:**
- Agent 8 enforces gate checklist
- No new `@ts-nocheck` allowed
- CI runs on integration branch

### Risk 4: E2E Flakiness
**Impact:** Real bugs ignored as "flaky tests"
**Mitigation:**
- Keep E2E deterministic
- No network call assertions (WebSocket noise)
- Retry logic only for known infrastructure issues

### Risk 5: Docs Lag Behind Behavior
**Impact:** User confusion, support burden
**Mitigation:**
- Agent 7's docs are **part of definition of done**
- Cannot merge Agent 6 without Agent 7 complete
- QA checklist includes "docs match behavior"

---

## 📊 Agent Status Tracking

| Agent | Area | Branch | Status | Blocks/Needs |
|-------|------|--------|--------|--------------|
| 8 | Lint/Build/PM | `integration/factory-piping-elevation` | 🔄 In Progress | Fixing lint |
| 4 | UX Baseline | `feature/agent4-ux-accessibility` | ⏳ Ready | Merge first |
| 2 | Domain Store | `feature/agent2-settings` | ⏳ Ready | Needs Agent 4 |
| 5 | Validation | `feature/agent5-edge-cases` | ⏳ Ready | Needs Phase 1 |
| 3 | Debug/Workflow | `feature/agent3-debug-overlays` | ⏳ Ready | Needs Agent 5 |
| 7 | Documentation | `feature/agent7-docs` | ⏳ Ready | Needs Phase 2 |
| 1 | E2E Tests | `feature/agent1-e2e-tests` | ⏳ Ready | Needs Phase 2 |
| 6 | Integration | `feature/agent6-integration` | ⏳ Ready | Needs Phase 3.1 |

**Legend:**
- ✅ Complete
- 🔄 In Progress
- ⏳ Ready (waiting for dependencies)
- ❌ Blocked

---

## 🚀 Deployment Path

**After Phase 3 Complete:**

1. Merge `integration/factory-piping-elevation` → `main`
2. GitHub Actions CI runs (lint, test, build)
3. Auto-deploy to Cloudflare Pages
4. Live at https://kinetic-core.com in ~3 minutes

**Rollback Plan:**
```bash
# If issues found in production
git revert <merge-commit-sha>
git push origin main
# CI auto-deploys rollback
```

---

## 📝 Communication Protocol

**Before Each Merge:**
1. Agent posts: "Ready to merge [Agent X] - [files]"
2. Integration Manager (Agent 8) verifies gate checklist
3. Merge happens
4. Integration Manager posts: "Agent X merged ✅ - Phase Y complete"

**If Conflicts:**
1. Agent posts: "Conflict in [file] between Agent X and Agent Y"
2. Integration Manager arbitrates using strategy above
3. Resolution documented in merge commit message

---

**Prepared By:** Claude Code (Agent 8) + ChatGPT Strategic Review
**Approved By:** Project Manager (George)
**Ready for Execution:** YES ✅
