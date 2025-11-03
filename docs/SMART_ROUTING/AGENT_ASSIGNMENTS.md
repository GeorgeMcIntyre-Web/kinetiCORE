# Smart Routing - Agent Assignments & File Ownership

**Version:** 1.0
**Last Updated:** 2025-01-03
**Purpose:** Quick reference for agents to know which files they own and which files require coordination

---

## How to Use This Document

1. **Your Agent Number:** Find your section below
2. **Your Files:** These are the files you OWN and can edit freely
3. **Your Tests:** These are the test files you should create/maintain
4. **Your Dependencies:** These are other agents you depend on
5. **Your Deliverables:** These are what you must complete

**IMPORTANT:** Before editing any file not in your ownership list, post in TODO_BOARD.md and wait 30 minutes for objections.

---

## Agent 1 - Graph & Pathfinding

### Your Identity
- **Name:** Agent 1
- **Role:** Pathfinding & Optimization Lead
- **Epic:** E-A*
- **Branch:** `feature/sr/agent-1-pathfinding`

### Your Files (Full Ownership)

**You own these files completely:**
```
src/routing/pathfinding/SearchGraph.ts           [CREATE NEW]
src/routing/pathfinding/RouteOptimizer.ts        [EDIT EXISTING]
src/routing/pathfinding/CostFunction.ts           [EDIT EXISTING]
tests/routing/Pathfinding.test.ts                [CREATE NEW]
tests/routing/SearchGraph.test.ts                [CREATE NEW]
```

### Your Shared Files (Coordinate Before Editing)

**Announce in TODO_BOARD.md before editing:**
```
src/routing/core/types.ts                        [If adding Graph types]
```

### Your Test Files

**Create these test files:**
```
tests/routing/Agent1-Pathfinding.test.ts
  - TC-A1: Simple pathfinding performance
  - TC-A2: Complex scene pathfinding
  - TC-A3: Cost function variants
```

### Your Dependencies

**You depend on:**
- **Agent 7:** ConnectionManager (provides start/end points)
- **Agent 3:** Specification tables (for clearance requirements)

**Others depend on you:**
- **Agent 2:** Needs your waypoint paths for validation
- **Agents 4, 5, 6:** Need your paths for geometry generation

### Your Acceptance Tests
- TC-A1: Pathfinding <100ms (simple scene)
- TC-A2: Pathfinding <500ms (300+ obstacles)
- TC-A3: Cost functions produce distinct paths

### Your Key Deliverables
1. SearchGraph class with tunable node density
2. A* algorithm with async/cancellation support
3. Three cost functions: shortest, safest, aesthetic
4. Path smoothing algorithm
5. Performance <100ms (simple), <500ms (complex)

---

## Agent 2 - Constraint Validator

### Your Identity
- **Name:** Agent 2
- **Role:** Constraint Validation Lead
- **Epic:** E-CHECK
- **Branch:** `feature/sr/agent-2-validation`

### Your Files (Full Ownership)

**You own these files completely:**
```
src/routing/validation/ConstraintValidator.ts     [EDIT EXISTING]
src/routing/validation/ValidationResult.ts        [CREATE NEW]
tests/routing/ConstraintValidator.test.ts         [CREATE NEW]
```

### Your Shared Files (Coordinate Before Editing)

**Announce in TODO_BOARD.md before editing:**
```
src/routing/core/types.ts                        [If updating ValidationResult types]
```

### Your Test Files

**Create these test files:**
```
tests/routing/Agent2-Validation.test.ts
  - TC-C1: Bend radius violation detection
  - TC-C2: Clearance violation detection
  - TC-C3: Support spacing violation detection
```

### Your Dependencies

**You depend on:**
- **Agent 3:** Constraint rules (bend radius, support spacing, clearance)
- **Agent 1:** Route paths to validate

**Others depend on you:**
- **Agent 8:** Needs ValidationResult for UI warnings

### Your Acceptance Tests
- TC-C1: Bend radius flagged correctly
- TC-C2: Clearance flagged with measured distance
- TC-C3: Support spacing flagged with actual/required values

### Your Key Deliverables
1. ValidationResult type with violations array
2. Bend radius checker
3. Clearance checker (obstacles, walls)
4. Support spacing checker
5. Slope checker (optional, for drainage)
6. Batch validation API

---

## Agent 3 - Specs & Data Contracts

### Your Identity
- **Name:** Agent 3
- **Role:** Specifications & Technical Spec Lead
- **Epic:** E-SPEC
- **Branch:** `feature/sr/agent-3-specs`

### Your Files (Full Ownership)

**You own these files completely:**
```
src/routing/specifications/PipeSpecifications.ts      [CREATE NEW]
src/routing/specifications/CableTraySpecifications.ts [CREATE NEW]
src/routing/specifications/WiringSpecifications.ts    [CREATE NEW]
src/routing/specifications/ConduitSpecifications.ts   [CREATE NEW]
docs/SMART_ROUTING/TECH_SPEC.md                      [MAINTAIN]
tests/routing/Specifications.test.ts                 [CREATE NEW]
```

### Your Shared Files (Coordinate Before Editing)

**You MAINTAIN the shared TECH_SPEC.md:**
- Other agents contribute their sections
- You ensure consistency and format
- You resolve conflicts in data contracts

**Announce before editing:**
```
src/routing/specifications/RouteSpecifications.ts    [EDIT EXISTING - has some specs already]
```

### Your Test Files

**Create these test files:**
```
tests/routing/Agent3-Specs.test.ts
  - TC-SPECS1: Pipe sizes match specification table
  - TC-SPECS2: Bend/support rules returned correctly
```

### Your Dependencies

**You depend on:**
- **No dependencies** - You are the foundation!

**Others depend on you:**
- **Agent 2:** Needs constraint rules
- **Agents 4, 5, 6:** Need sizing and material specs
- **Agent 9:** Needs BOM metadata schemas

### Your Acceptance Tests
- TC-SPECS1: Geometry reads OD from PIPE_SIZES correctly
- TC-SPECS2: Rules returned without code duplication

### Your Key Deliverables
1. PIPE_SIZES table (complete and accurate)
2. CABLE_TRAY_SPECS table
3. WIRING_SPECS and AWG_TO_METRIC tables
4. CONDUIT_SIZES table
5. getConstraintRules() API
6. Material mapping tables
7. TECH_SPEC.md (complete and up-to-date)
8. BOM export schema

**CRITICAL:** Your work unblocks Agents 2, 4, 5, 6! Prioritize getting spec tables done ASAP.

---

## Agent 4 - Pipe Geometry

### Your Identity
- **Name:** Agent 4
- **Role:** Pipe Geometry Generator Lead
- **Epic:** E-GEO-PIPE
- **Branch:** `feature/sr/agent-4-pipe-geo`

### Your Files (Full Ownership)

**You own these files completely:**
```
src/routing/geometry/PipeGenerator.ts             [EDIT EXISTING]
tests/routing/PipeGenerator.test.ts               [CREATE NEW]
```

### Your Shared Files (Coordinate Before Editing)

**Announce in TODO_BOARD.md before editing:**
```
src/routing/geometry/GeometryGeneratorFactory.ts  [Register your generator]
```

### Your Test Files

**Create these test files:**
```
tests/routing/Agent4-PipeGeometry.test.ts
  - TC-P1: Pipe OD matches spec
  - TC-P2: BOM calculation correct
```

### Your Dependencies

**You depend on:**
- **Agent 3:** PIPE_SIZES table, material mappings (BLOCKING)
- **Agent 1:** Route path waypoints

**Others depend on you:**
- **Agent 9:** Needs computeBOM() implementation

### Your Acceptance Tests
- TC-P1: Pipe sizing from specifications
- TC-P2: BOM length ±1%, elbows counted correctly

### Your Key Deliverables
1. Refactor PipeGenerator to read from PIPE_SIZES
2. Generate tube geometry with correct OD
3. Generate elbows at bends
4. Generate tees at branches (optional - Phase 2)
5. Generate reducers at size changes (optional - Phase 2)
6. Place supports at correct spacing
7. Apply materials (steel=gray, PVC=white, copper=copper)
8. Implement computeBOM() method
9. Performance <50ms per route

---

## Agent 5 - Cable Tray Geometry

### Your Identity
- **Name:** Agent 5
- **Role:** Cable Tray Geometry Generator Lead
- **Epic:** E-GEO-TRAY
- **Branch:** `feature/sr/agent-5-tray-geo`

### Your Files (Full Ownership)

**You own these files completely:**
```
src/routing/geometry/CableTrayGenerator.ts        [EDIT EXISTING]
tests/routing/CableTrayGenerator.test.ts          [CREATE NEW]
```

### Your Shared Files (Coordinate Before Editing)

**Announce in TODO_BOARD.md before editing:**
```
src/routing/geometry/GeometryGeneratorFactory.ts  [Register your generator]
```

### Your Test Files

**Create these test files:**
```
tests/routing/Agent5-CableTrayGeometry.test.ts
  - TC-TRAY1: Tray sizing correct
  - TC-TRAY2: Fittings and supports placed
```

### Your Dependencies

**You depend on:**
- **Agent 3:** CABLE_TRAY_SPECS table (BLOCKING)
- **Agent 1:** Route path waypoints

**Others depend on you:**
- **Agent 9:** Needs computeBOM() implementation

### Your Acceptance Tests
- TC-TRAY1: Tray width/height match specs
- TC-TRAY2: Fittings at junctions, supports every 12 feet

### Your Key Deliverables
1. Create CableTrayGenerator reading from CABLE_TRAY_SPECS
2. Generate channel/trough geometry
3. Generate 90° and 45° elbow fittings
4. Generate tee fittings at branch points
5. Place supports at correct spacing
6. Apply materials (aluminum=silver, steel=gray)
7. Implement computeBOM() method
8. Performance <50ms per route

---

## Agent 6 - Wiring & Conduit Geometry

### Your Identity
- **Name:** Agent 6
- **Role:** Wiring & Conduit Geometry Generator Lead
- **Epic:** E-GEO-WIRE/COND
- **Branch:** `feature/sr/agent-6-wire-conduit-geo`

### Your Files (Full Ownership)

**You own these files completely:**
```
src/routing/geometry/CableGenerator.ts            [EDIT EXISTING]
src/routing/geometry/ConduitGenerator.ts          [EDIT EXISTING]
tests/routing/CableGenerator.test.ts              [CREATE NEW]
tests/routing/ConduitGenerator.test.ts            [CREATE NEW]
```

### Your Shared Files (Coordinate Before Editing)

**Announce in TODO_BOARD.md before editing:**
```
src/routing/geometry/GeometryGeneratorFactory.ts  [Register your generators]
```

### Your Test Files

**Create these test files:**
```
tests/routing/Agent6-WiringConduit.test.ts
  - TC-WIRE1: Cable diameter and color correct
  - TC-COND1: Conduit bending rules respected
```

### Your Dependencies

**You depend on:**
- **Agent 3:** WIRING_SPECS, AWG_TO_METRIC, CONDUIT_SIZES (BLOCKING)
- **Agent 1:** Route path waypoints

**Others depend on you:**
- **Agent 9:** Needs computeBOM() for both cable and conduit

### Your Acceptance Tests
- TC-WIRE1: Cable diameter from spec, color by voltage
- TC-COND1: Conduit bend limit, junction boxes at branches

### Your Key Deliverables
1. CableGenerator with spec-driven sizing
2. Cable bundle geometry (multiple conductors)
3. Color coding by voltage
4. computeBOM() for cables
5. ConduitGenerator with bending rules
6. Junction box placement at branches
7. computeBOM() for conduits
8. Performance <50ms per route (each generator)

---

## Agent 7 - Connection Manager

### Your Identity
- **Name:** Agent 7
- **Role:** Connection Management Lead
- **Epic:** E-CONN
- **Branch:** `feature/sr/agent-7-connections`

### Your Files (Full Ownership)

**You own these files completely:**
```
src/routing/core/ConnectionManager.ts             [EDIT EXISTING]
src/routing/core/ConnectionPoint.ts               [EDIT EXISTING]
tests/routing/ConnectionManager.test.ts           [EDIT EXISTING]
```

### Your Shared Files (Coordinate Before Editing)

**Announce in TODO_BOARD.md before editing:**
```
src/routing/core/types.ts                        [If updating ConnectionPoint types]
src/routing/commands/CreateConnectionPointCommand.ts [If changing signature]
```

### Your Test Files

**Create these test files:**
```
tests/routing/Agent7-Connections.test.ts
  - TC-CM1: Multi-drop placement, duplicate prevention
  - TC-CM2: Connector deletion updates routes
```

### Your Dependencies

**You depend on:**
- **No dependencies** - You are foundational!

**Others depend on you:**
- **Agent 1:** Needs connector positions for pathfinding
- **Agent 8:** Needs connector list for UI display

### Your Acceptance Tests
- TC-CM1: Multi-drop creates unique IDs, prevents duplicates
- TC-CM2: Deleting connector updates dependent routes gracefully

### Your Key Deliverables
1. Stable add/remove/list API
2. Duplicate prevention (same position/type)
3. Unique ID generation
4. Device metadata auto-detection (Phase 2, optional)
5. Graceful deletion (warn about dependent routes)

---

## Agent 8 - UI/UX & Scene Tree

### Your Identity
- **Name:** Agent 8
- **Role:** UI/UX & Layout Stability Lead
- **Epic:** E-UI
- **Branch:** `feature/sr/agent-8-ui-fixes`

### Your Files (Full Ownership)

**You own these files completely:**
```
src/routing/ui/RoutingControlPanel.tsx            [EDIT EXISTING]
src/routing/ui/RoutingWorkflowHandler.ts          [EDIT EXISTING]
src/ui/components/SceneTree.tsx                   [EDIT EXISTING]
src/ui/layouts/ProfessionalModeLayout.tsx         [EDIT EXISTING]
src/ui/layouts/DockableLayoutWrapper.tsx          [EDIT IF NEEDED]
src/ui/components/Header.tsx                      [EDIT IF NEEDED for ResizeObserver]
tests/ui/SceneTree.test.ts                        [CREATE NEW]
tests/ui/RoutingWorkflow.test.ts                  [CREATE NEW]
```

### Your Shared Files (Coordinate Before Editing)

**Announce in TODO_BOARD.md before editing:**
```
src/ui/store/routingStore.ts                     [If adding new state]
src/ui/store/editorStore.ts                      [If changing selection state]
```

### Your Test Files

**Create these test files:**
```
tests/ui/Agent8-UIStability.test.ts
  - TC-UI1: No hook/stack errors
  - TC-UI2: Selection by ID
  - TC-UI3: Tree auto-resize
  - TC-UI4: Multi-drop workflow
  - TC-UI5: Quick action for 2 connectors
```

### Your Dependencies

**You depend on:**
- **Agent 7:** ConnectionManager for connector list
- **Agent 2:** ValidationResult for warnings display
- **All Agents:** No stack overflows or hook errors from your fixes unblock everyone!

**Others depend on you:**
- **ALL AGENTS:** Your bug fixes unblock normal development

### Your Acceptance Tests
- TC-UI1: No hook call or stack overflow errors
- TC-UI2: Selection never cross-selects by name
- TC-UI3: Tree auto-resizes to fit labels at all zoom levels
- TC-UI4: Multi-drop placement works without mode exit
- TC-UI5: Quick action creates route + geometry for 2 selected connectors

### Your Key Deliverables (CRITICAL PATH)
1. **Fix scene tree stack overflow** (convert recursion to iteration)
2. **Fix ID-based selection** (no cross-selection)
3. **Fix tree auto-resize** (measure labels, set width)
4. **Implement multi-drop placement** (mode stays active)
5. **Implement "Finish Placing" button**
6. **Implement quick action** (2 connectors → Create Route)
7. **Fix ResizeObserver optional chain** (Header.tsx)
8. **Fix Pro layout hooks** (ensure all inside components)

**YOUR WORK IS BLOCKING OTHERS - HIGHEST PRIORITY!**

---

## Agent 9 - Persistence & Export

### Your Identity
- **Name:** Agent 9
- **Role:** Save/Load & Export Lead
- **Epic:** E-PERSIST
- **Branch:** `feature/sr/agent-9-persistence`

### Your Files (Full Ownership)

**You own these files completely:**
```
src/scene/WorldSerializer.ts                     [EDIT EXISTING - extend for routing]
src/exports/BOMExporter.ts                       [CREATE NEW]
src/exports/GLBExporter.ts                       [EDIT EXISTING - fix materials]
tests/persistence/WorldSerializer.test.ts        [EDIT EXISTING]
tests/exports/BOMExporter.test.ts                [CREATE NEW]
tests/exports/GLBExporter.test.ts                [CREATE NEW]
```

### Your Shared Files (Coordinate Before Editing)

**Announce in TODO_BOARD.md before editing:**
```
src/routing/core/types.ts                        [If adding serialization types]
```

### Your Test Files

**Create these test files:**
```
tests/routing/Agent9-Persistence.test.ts
  - TC-S1: Save/load parity
  - TC-BOM1: BOM export correctness
  - TC-EXP1: GLB material fidelity
```

### Your Dependencies

**You depend on:**
- **Agents 4, 5, 6:** Need computeBOM() implementations (BLOCKING)
- **Agent 3:** Need BOM schema definitions

**Others depend on you:**
- **No one blocks on you** (you're at the end of the pipeline)

### Your Acceptance Tests
- TC-S1: Scene parity after save/reload (connectors, routes, geometry)
- TC-BOM1: BOM totals match scene within tolerance
- TC-EXP1: GLB export → import preserves materials (no white meshes)

### Your Key Deliverables
1. Extend WorldSerializer for connectors
2. Extend WorldSerializer for routes
3. Extend WorldSerializer for geometry state
4. Versioned format with backward compatibility
5. BOMExporter class with CSV output
6. Fix GLB material serialization
7. Ensure environment/texture preservation
8. Round-trip tests (save → load → verify)

---

## Agent 10 - QA, Perf, Release

### Your Identity
- **Name:** Agent 10
- **Role:** QA, Performance, & Release Lead
- **Epic:** E-QA/PERF
- **Branch:** `feature/sr/agent-10-qa-perf`

### Your Files (Full Ownership)

**You own these files completely:**
```
tests/routing/*.test.ts                          [ALL TEST FILES - review/run]
tests/acceptance/SmartRoutingAcceptance.test.ts  [CREATE NEW]
docs/SMART_ROUTING/ACCEPTANCE_TESTS.md           [MAINTAIN - update with results]
docs/SMART_ROUTING/PERF_HARNESS.md               [CREATE NEW]
scripts/perf/routing-perf.ts                     [CREATE NEW]
scenes/demo/simple-two-points.json               [CREATE NEW]
scenes/demo/boxes-300.json                       [CREATE NEW]
scenes/demo/factory-slice.json                   [CREATE NEW]
```

### Your Shared Files (Coordinate Before Editing)

**You review all files but don't own any core code.**

### Your Test Files

**You create/run ALL acceptance tests:**
```
tests/acceptance/TC-UI*.test.ts
tests/acceptance/TC-A*.test.ts
tests/acceptance/TC-C*.test.ts
tests/acceptance/TC-P*.test.ts
tests/acceptance/TC-TRAY*.test.ts
tests/acceptance/TC-WIRE*.test.ts
tests/acceptance/TC-COND*.test.ts
tests/acceptance/TC-S*.test.ts
tests/acceptance/TC-BOM*.test.ts
tests/acceptance/TC-EXP*.test.ts
tests/acceptance/TC-PERF*.test.ts
```

### Your Dependencies

**You depend on:**
- **ALL AGENTS:** You test everyone's work

**Others depend on you:**
- **PM:** Needs your test results for sign-off

### Your Acceptance Tests
- **TC-QA1:** All acceptance tests executed and passing

### Your Key Deliverables
1. Acceptance test harness and runner
2. All 22 acceptance tests implemented
3. Demo scenes (simple, complex, factory)
4. Performance harness scripts
5. Performance regression tests
6. Documentation (user guide, API docs)
7. Demo videos and screenshots
8. CI smoke tests integration
9. Release checklist completed
10. Test report with evidence (screenshots, videos)

---

## Shared Files Reference

### Core Types (EVERYONE reads, COORDINATE before editing)
```
src/routing/core/types.ts
```

**Rules:**
- Any agent can READ this file
- To EDIT: Post intent in TODO_BOARD.md, wait 30 min
- Add your changes with clear comments
- Run type-check immediately after editing

### Zustand Stores (UI state)
```
src/ui/store/routingStore.ts
src/ui/store/editorStore.ts
```

**Rules:**
- Agent 8 primarily owns these
- Other agents can add state if needed (coordinate first)
- Never mutate state directly (use Zustand setters)

### Command Files (Undo/Redo)
```
src/routing/commands/*.ts
```

**Rules:**
- Each agent can create commands for their features
- Follow Command pattern (execute, undo)
- Add to command manager registration

---

## File Conflict Resolution

### If Two Agents Need Same File

**Example:** Agent 4 and Agent 5 both need to edit `GeometryGeneratorFactory.ts`

**Solution:**
1. First agent to post in TODO_BOARD.md gets priority
2. Second agent waits for first agent's PR to merge
3. Second agent rebases and makes their changes
4. OR: PM coordinates a joint PR with both changes

### If You're Blocked

**If you need a file that's being edited:**
1. Check TODO_BOARD.md for status
2. Find a non-blocked task to work on meanwhile
3. Post in TODO_BOARD.md: `[HELP] Need <file> from Agent X`
4. PM will expedite or find workaround

---

## Quick Reference: Who to Ask

| Question | Ask Agent |
|----------|-----------|
| "What's the specification for 3/4" pipe?" | Agent 3 |
| "How do I create a connector?" | Agent 7 |
| "Why is pathfinding slow?" | Agent 1 |
| "How do I validate bend radius?" | Agent 2 |
| "How do I generate pipe geometry?" | Agent 4 |
| "How do I export BOM?" | Agent 9 |
| "Why is my test failing?" | Agent 10 |
| "Why is the UI crashing?" | Agent 8 |
| "Anything else" | PM (George) |

---

## Integration Timeline

**Week 1 (Days 1-5):**
- **Day 1-2:** Agent 3 publishes specs → unblocks Agents 2, 4, 5, 6
- **Day 2-3:** Agent 8 fixes UI bugs → unblocks everyone
- **Day 3-4:** Agent 1 delivers pathfinding → unblocks Agents 2, 4, 5, 6
- **Day 4-5:** Agents 4, 5, 6 deliver geometry → unblocks Agent 9

**Week 2 (Days 6-10):**
- **Day 6-7:** Agent 2 delivers validation → integrates with Agent 8 UI
- **Day 7-8:** Agent 9 delivers persistence/export
- **Day 9-10:** Agent 10 runs acceptance tests, PM signs off

---

**Last Updated:** 2025-01-03
**Version:** 1.0
**Maintained By:** PM (George)
