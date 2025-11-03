# Smart Routing - TODO Board (Live Task Tracking)

**Last Updated:** 2025-01-03
**Base Branch:** `feature/smart-routing-system`
**Current Sprint:** Week 1 of 6
**Milestone:** M0 → M1

---

## 📋 How to Use This Board

1. **Check off** tasks as you complete them: `- [ ]` → `- [x]`
2. **Add PR links** next to completed tasks
3. **Add blockers** with `[BLOCKER]` tag
4. **Add dependencies** with `[DEPENDS: Agent N]` tag
5. **Update daily** - This is the single source of truth!

---

## 🚨 Active Blockers

<!-- Add blockers here -->

**None currently** ✅

<!-- Example:
### [BLOCKER] Agent 4 - Missing Validation API
**Issue:** PipeGenerator needs `ValidationResult` type from Agent 2
**Blocked Since:** 2025-01-03 10:00 AM
**Owner:** Agent 2
**Status:** Agent 2 is implementing, ETA 2:00 PM today
-->

---

## 📅 Daily Standups

### 2025-01-03 - Kickoff Day

#### Agent 1 - Graph & Pathfinding
- **Yesterday:** N/A (Starting today)
- **Today:** Setting up search graph structure, implementing basic A* algorithm
- **Tomorrow:** Cost functions and path smoothing
- **Blockers:** None
- **PRs:** None yet

#### Agent 2 - Constraint Validator
- **Yesterday:** N/A (Starting today)
- **Today:** Defining ValidationResult interface, implementing bend radius check
- **Tomorrow:** Clearance and support spacing checks
- **Blockers:** None
- **PRs:** None yet

#### Agent 3 - Specs & Data Contracts
- **Yesterday:** N/A (Starting today)
- **Today:** Creating TECH_SPEC.md, defining specification tables
- **Tomorrow:** Material mappings and export metadata
- **Blockers:** None
- **PRs:** None yet

#### Agent 4 - Pipe Geometry
- **Yesterday:** N/A (Starting today)
- **Today:** ✅ COMPLETED all deliverables! Refactored PipeGenerator for spec-driven sizing, implemented computeBOM(), added material-based colors, created 8 passing unit tests (TC-P1, TC-P2)
- **Tomorrow:** Ready for code review and integration testing
- **Blockers:** None
- **PRs:** #TBD - Ready to open (feature/sr/agent-4-pipe-geo → feature/smart-routing-system)
- **Branch:** feature/sr/agent-4-pipe-geo (pushed and ready)

#### Agent 5 - Cable Tray Geometry
- **Yesterday:** N/A (Starting today)
- **Today:** Designing cable tray geometry structure
- **Tomorrow:** Channel geometry and fittings
- **Blockers:** [DEPENDS: Agent 3] Need CABLE_TRAY_SPECS table
- **PRs:** None yet

#### Agent 6 - Wiring & Conduit Geometry
- **Yesterday:** N/A (Starting today)
- **Today:** Analyzing existing cable/conduit code, planning improvements
- **Tomorrow:** Implementing spec-driven cable bundles
- **Blockers:** [DEPENDS: Agent 3] Need WIRING_SPECS and CONDUIT_SIZES tables
- **PRs:** None yet

#### Agent 7 - Connection Manager
- **Yesterday:** N/A (Starting today)
- **Today:** Reviewing existing ConnectionManager, planning multi-drop fixes
- **Tomorrow:** Implementing duplicate prevention and stable IDs
- **Blockers:** None
- **PRs:** None yet

#### Agent 8 - UI/UX & Scene Tree
- **Yesterday:** N/A (Starting today)
- **Today:** Analyzing scene tree recursion bug, planning fix
- **Tomorrow:** Implementing ID-based selection and auto-resize
- **Blockers:** None (Critical path - needs to unblock others)
- **PRs:** None yet

#### Agent 9 - Persistence & Exports
- **Yesterday:** N/A (Starting today)
- **Today:** Reviewing WorldSerializer, planning route serialization
- **Tomorrow:** Implementing save/load for connectors and routes
- **Blockers:** [DEPENDS: Agents 4,5,6] Need BOM APIs from geometry generators
- **PRs:** None yet

#### Agent 10 - QA, Perf, Release
- **Yesterday:** N/A (Starting today)
- **Today:** Setting up acceptance test harness, creating demo scenes
- **Tomorrow:** Writing first acceptance tests (TC-UI1, TC-A1)
- **Blockers:** None
- **PRs:** None yet

---

## 🎯 Phase 0 - Enablement (Day 0-1)

**Goal:** Get all agents set up with docs, branches, and baseline understanding

### Documentation Setup
- [x] Create COLLABORATION.md (PM)
- [x] Create TODO_BOARD.md (PM)
- [ ] Create ACCEPTANCE_TESTS.md (Agent 10 + PM)
- [ ] Create TECH_SPEC.md (Agent 3)
- [ ] Create PERF_HARNESS.md (Agent 10)

### Branch Setup
- [ ] Create base branch `feature/smart-routing-system` (PM)
- [ ] Each agent creates their working branch (All Agents)
  - [ ] Agent 1: `feature/sr/agent-1-pathfinding`
  - [ ] Agent 2: `feature/sr/agent-2-validation`
  - [ ] Agent 3: `feature/sr/agent-3-specs`
  - [ ] Agent 4: `feature/sr/agent-4-pipe-geo`
  - [ ] Agent 5: `feature/sr/agent-5-tray-geo`
  - [ ] Agent 6: `feature/sr/agent-6-wire-conduit-geo`
  - [ ] Agent 7: `feature/sr/agent-7-connections`
  - [ ] Agent 8: `feature/sr/agent-8-ui-fixes`
  - [ ] Agent 9: `feature/sr/agent-9-persistence`
  - [ ] Agent 10: `feature/sr/agent-10-qa-perf`

### Demo Scenes
- [ ] Create `scenes/demo/simple-two-points.json` (Agent 10)
- [ ] Create `scenes/demo/boxes-300.json` (Agent 10)
- [ ] Create `scenes/demo/factory-slice.json` (Agent 10)

### Baseline Tests
- [ ] Run existing build and capture baseline (Agent 10)
- [ ] Document current known issues (Agent 10)

**Exit Criteria:** All docs created, branches ready, demo scenes loadable

---

## 🔍 Phase 1 - Pathfinding + Constraints (Day 1-4)

**Goal:** Routes can be found between two connectors and validated

### Agent 1 - Graph & Pathfinding Tasks

#### Core Search Graph
- [ ] Create `SearchGraph.ts` with tunable node density
- [ ] Implement obstacle inflation from scene AABB
- [ ] Add layer snapping (floor/ceiling alignment)
- [ ] Write unit tests for graph generation
- **PR:** TBD

#### A* Implementation
- [ ] Implement A* algorithm with priority queue
- [ ] Add deterministic seeding for reproducible tests
- [ ] Implement direct-path fast path (no obstacles)
- [ ] Write unit tests for pathfinding
- **PR:** TBD

#### Cost Functions
- [ ] Implement shortest path cost function
- [ ] Implement safest path cost function (clearance priority)
- [ ] Implement aesthetic path cost function (follows structure)
- [ ] Add custom cost function support
- [ ] Write unit tests for each cost function
- **PR:** TBD

#### Path Smoothing
- [ ] Implement Chaikin curve smoothing or polyline beveling
- [ ] Add minimum bend radius hints to smoother
- [ ] Write unit tests for smoothing
- **PR:** TBD

#### Performance
- [ ] Add async API with cancellation token
- [ ] Optimize for 300+ obstacles (<500ms budget)
- [ ] Add performance logging/metrics
- **PR:** TBD

**Acceptance Tests:** TC-A1, TC-A2, TC-A3

### Agent 2 - Constraint Validator Tasks

#### Validator Core
- [ ] Create `ValidationResult.ts` with violations array
- [ ] Define `ValidationSeverity` enum (error, warning, info)
- [ ] Create `ConstraintValidator.ts` base class
- [ ] Write unit tests for validator structure
- **PR:** TBD

#### Bend Radius Validation
- [ ] Implement bend radius checker
- [ ] Calculate actual vs required radius
- [ ] Add detailed violation messages
- [ ] Write unit tests for bend radius
- **PR:** TBD

#### Clearance Validation
- [ ] Implement clearance checker (obstacles, walls)
- [ ] Calculate measured distance from obstacles
- [ ] Add detailed violation messages
- [ ] Write unit tests for clearance
- **PR:** TBD

#### Support Spacing Validation
- [ ] Implement support spacing checker
- [ ] Calculate actual vs required spacing
- [ ] Add detailed violation messages
- [ ] Write unit tests for support spacing
- **PR:** TBD

#### Slope Validation (Optional)
- [ ] Implement slope checker for drainage routes
- [ ] Calculate actual slope
- [ ] Add detailed violation messages
- [ ] Write unit tests for slope
- **PR:** TBD

#### Batch Validation
- [ ] Implement batch validation for multiple routes
- [ ] Add progress reporting
- [ ] Optimize for performance
- **PR:** TBD

**Acceptance Tests:** TC-C1, TC-C2, TC-C3

### Agent 3 - Specs & Data Contracts Tasks

#### Technical Spec Document
- [ ] Create TECH_SPEC.md with architecture overview
- [ ] Document data contracts (Connector, Route, RouteSegment)
- [ ] Document integration points between agents
- [ ] Add sequence diagrams for workflows
- **PR:** TBD

#### Pipe Specifications
- [ ] Create `PipeSpecifications.ts` with PIPE_SIZES table
- [ ] Add material mappings (stainless, carbon, PVC)
- [ ] Add bend radius formulas by material
- [ ] Add support spacing rules by size
- [ ] Write unit tests for spec lookups
- **PR:** TBD [UNBLOCKS: Agent 4]

#### Cable Tray Specifications
- [ ] Create `CableTraySpecifications.ts` with size/width table
- [ ] Add material mappings (aluminum, steel, fiberglass)
- [ ] Add support spacing rules by width/load
- [ ] Add fitting specifications (90°, 45°, tee)
- [ ] Write unit tests for spec lookups
- **PR:** TBD [UNBLOCKS: Agent 5]

#### Wiring Specifications
- [ ] Create `WiringSpecifications.ts` with cable types
- [ ] Add voltage-to-diameter mappings
- [ ] Add color codes by voltage/type
- [ ] Add bend radius rules by cable type
- [ ] Write unit tests for spec lookups
- **PR:** TBD [UNBLOCKS: Agent 6]

#### Conduit Specifications
- [ ] Create `ConduitSpecifications.ts` with CONDUIT_SIZES table
- [ ] Add material mappings (EMT, rigid, PVC)
- [ ] Add bending rules by material
- [ ] Add junction box spacing rules
- [ ] Write unit tests for spec lookups
- **PR:** TBD [UNBLOCKS: Agent 6]

#### Export Metadata
- [ ] Define BOM export schema (lengths, fittings, materials)
- [ ] Define glTF/GLB export metadata schema
- [ ] Document export format in TECH_SPEC.md
- **PR:** TBD [UNBLOCKS: Agent 9]

**Acceptance Tests:** TC-SPECS1, TC-SPECS2

---

## 🎨 Phase 2 - Geometry (Day 3-7, overlaps Phase 1)

**Goal:** 3D geometry generates correctly with spec-driven sizes and fittings

### Agent 4 - Pipe Geometry Tasks

#### Spec Integration
- [x] Refactor PipeGenerator to read from PIPE_SIZES table
- [x] Add material-based mesh appearance  
- [x] Write unit tests for size lookups
- **PR:** #TBD (feature/sr/agent-4-pipe-geo) ✅ READY

#### Tube Geometry
- [ ] Generate tube geometry along route path
- [ ] Handle diameter from specifications
- [ ] Optimize mesh generation (merge segments)
- [ ] Write unit tests for tube generation
- **PR:** TBD

#### Elbow Generation
- [ ] Generate elbows at bend points
- [ ] Respect minimum bend radius from specs
- [ ] Handle 90°, 45°, and custom angles
- [ ] Write unit tests for elbow generation
- **PR:** TBD

#### Fittings Library
- [ ] Add tee fittings at branch points
- [ ] Add reducer fittings at size changes
- [ ] Add coupling fittings at connections
- [ ] Write unit tests for fittings
- **PR:** TBD

#### BOM Computation
- [x] Implement `computeBOM()` method
- [x] Calculate total pipe length
- [x] Count elbows, tees, reducers
- [x] Add material and size metadata
- [x] Write unit tests for BOM calculation
- **PR:** #TBD (feature/sr/agent-4-pipe-geo) ✅ READY [UNBLOCKS: Agent 9]

#### Material Appearance
- [ ] Create material presets (stainless, carbon, PVC)
- [ ] Apply materials based on spec
- [ ] Ensure materials export correctly
- **PR:** TBD

**Acceptance Tests:** TC-P1, TC-P2

### Agent 5 - Cable Tray Geometry Tasks

#### Spec Integration
- [ ] Create CableTrayGenerator reading from CABLE_TRAY_SPECS
- [ ] Add size/width/height from specifications
- [ ] Write unit tests for size lookups
- **PR:** TBD [DEPENDS: Agent 3]

#### Channel Geometry
- [ ] Generate channel/trough geometry along path
- [ ] Handle width and height from specs
- [ ] Create ladder, mesh, or solid bottom variants
- [ ] Write unit tests for channel generation
- **PR:** TBD

#### Fittings
- [ ] Add 90° elbow fittings
- [ ] Add 45° elbow fittings
- [ ] Add tee fittings at branch points
- [ ] Add cross fittings (optional)
- [ ] Write unit tests for fittings
- **PR:** TBD

#### Support Placement
- [ ] Calculate support positions from spacing rules
- [ ] Generate support geometry (hangers, brackets)
- [ ] Visualize supports in scene
- [ ] Write unit tests for support placement
- **PR:** TBD

#### BOM Computation
- [ ] Implement `computeBOM()` method
- [ ] Calculate total tray length by segment
- [ ] Count fittings by type
- [ ] Count supports
- [ ] Write unit tests for BOM calculation
- **PR:** TBD [UNBLOCKS: Agent 9]

**Acceptance Tests:** TC-TRAY1, TC-TRAY2

### Agent 6 - Wiring & Conduit Geometry Tasks

#### Cable Bundle Geometry
- [ ] Create CableGenerator reading from WIRING_SPECS
- [ ] Generate cable bundle geometry (multiple conductors)
- [ ] Apply color coding by voltage/type
- [ ] Handle diameter from specifications
- [ ] Write unit tests for cable generation
- **PR:** TBD [DEPENDS: Agent 3]

#### Cable BOM
- [ ] Implement `computeBOM()` for cables
- [ ] Calculate total cable length
- [ ] Add voltage and type metadata
- **PR:** TBD [UNBLOCKS: Agent 9]

#### Conduit Geometry
- [ ] Create ConduitGenerator reading from CONDUIT_SIZES
- [ ] Generate conduit tube geometry
- [ ] Handle bending rules (EMT vs rigid)
- [ ] Add junction boxes at branch points
- [ ] Write unit tests for conduit generation
- **PR:** TBD [DEPENDS: Agent 3]

#### Conduit BOM
- [ ] Implement `computeBOM()` for conduits
- [ ] Calculate total conduit length
- [ ] Count junction boxes
- [ ] Add material and size metadata
- **PR:** TBD [UNBLOCKS: Agent 9]

**Acceptance Tests:** TC-WIRE1, TC-COND1

---

## 🖥️ Phase 3 - UI/UX & Layout Stability (Day 5-8)

**Goal:** No hook/stack errors, stable selection, proper layout

### Agent 8 - UI/UX & Scene Tree Tasks

#### Scene Tree Stack Overflow Fix
- [ ] Analyze recursion in SceneTree.tsx
- [ ] Convert recursive rendering to controlled iteration
- [ ] Add memoization for tree nodes
- [ ] Ensure unique keys (no name collisions)
- [ ] Add guard against cyclical data
- [ ] Write unit tests for tree rendering
- **PR:** TBD [CRITICAL - UNBLOCKS OTHERS]

**Acceptance Test:** TC-UI1

#### ID-Based Selection
- [ ] Refactor selection to use unique IDs (not names)
- [ ] Update scene tree to select by ID
- [ ] Update highlighting to work with ID
- [ ] Prevent cross-selection when names match
- [ ] Write unit tests for selection
- **PR:** TBD

**Acceptance Test:** TC-UI2

#### Scene Tree Auto-Resize
- [ ] Measure visible node label widths
- [ ] Calculate required left pane width
- [ ] Wire width into DockableLayoutWrapper
- [ ] Update on tree changes
- [ ] Test at zoom levels 75%-150%
- [ ] Write unit tests for auto-resize
- **PR:** TBD

**Acceptance Test:** TC-UI3

#### Routing Panel Workflow
- [ ] Implement multi-drop "Place Connectors" mode
- [ ] Add "Finish Placing" button
- [ ] Implement "Create Route from 2 Selected" button
- [ ] Add "Generate All Geometry" bulk action
- [ ] Add visual feedback for active mode
- [ ] Write unit tests for workflow
- **PR:** TBD

**Acceptance Test:** TC-UI4

#### Quick Action for 2 Connectors
- [ ] Detect when exactly 2 connectors selected
- [ ] Add "Create Route" quick action button
- [ ] Auto-generate geometry after route creation
- [ ] Add visual feedback (success/error)
- [ ] Write unit tests for quick action
- **PR:** TBD

**Acceptance Test:** TC-UI5

#### Header ResizeObserver Fix
- [ ] Replace optional chain after `new ResizeObserver()`
- [ ] Add safe constructor guard
- [ ] Test in multiple browsers
- **PR:** TBD

#### Pro Layout Hook Fix
- [ ] Ensure all hooks inside components only
- [ ] Move misplaced hooks into components
- [ ] Add ESLint rule to catch future violations
- **PR:** TBD

**Acceptance Test:** TC-UI1 (no hook errors)

---

## 💾 Phase 4 - Persistence & Exports (Day 7-9)

**Goal:** Save/load works, BOM exports, GLB preserves materials

### Agent 7 - Connection Manager Tasks

#### Multi-Drop Placement
- [ ] Implement multi-drop mode (stay active after first drop)
- [ ] Prevent duplicate connectors at same position/type
- [ ] Add visual feedback during placement
- [ ] Write unit tests for placement
- **PR:** TBD

**Acceptance Test:** TC-CM1

#### Connector Deletion
- [ ] Implement safe connector deletion
- [ ] Update dependent routes (warning + detach)
- [ ] Add confirmation dialog for deletion
- [ ] Write unit tests for deletion
- **PR:** TBD

**Acceptance Test:** TC-CM2

#### Stable IDs
- [ ] Ensure connector IDs are globally unique
- [ ] Persist IDs across save/load
- [ ] Add ID generation tests
- **PR:** TBD

#### Device Metadata (Optional - Phase 2)
- [ ] Analyze device geometry for connection points
- [ ] Auto-detect connector positions
- [ ] Add device-to-connector mapping
- **PR:** TBD

### Agent 9 - Persistence & Exports Tasks

#### Save/Load Connectors
- [ ] Extend WorldSerializer to save connectors
- [ ] Implement connector deserialization
- [ ] Add versioning for format changes
- [ ] Write unit tests for connector save/load
- **PR:** TBD

#### Save/Load Routes
- [ ] Extend WorldSerializer to save routes
- [ ] Save waypoints, path, and validation status
- [ ] Implement route deserialization
- [ ] Write unit tests for route save/load
- **PR:** TBD

#### Save/Load Geometry
- [ ] Save generated geometry state
- [ ] Re-attach geometry to routes on load
- [ ] Handle material preservation
- [ ] Write unit tests for geometry save/load
- **PR:** TBD

**Acceptance Test:** TC-S1

#### BOM CSV Export
- [ ] Create BOMExporter class
- [ ] Aggregate BOM data from all geometry generators
- [ ] Format as CSV (lengths, fittings, materials, costs)
- [ ] Add totals and summary rows
- [ ] Write unit tests for BOM export
- **PR:** TBD [DEPENDS: Agents 4,5,6]

**Acceptance Test:** TC-BOM1

#### GLB/glTF Export Fix
- [ ] Fix material serialization in GLBExporter
- [ ] Ensure environment/texture handling preserved
- [ ] Test export → import → render (no white meshes)
- [ ] Write unit tests for export fidelity
- **PR:** TBD

**Acceptance Test:** TC-EXP1

---

## 🚀 Phase 5 - QA, Performance, Release (Day 9-10)

**Goal:** All tests pass, perf budgets met, docs complete, ready to ship

### Agent 10 - QA, Perf, Release Tasks

#### Acceptance Test Harness
- [ ] Create test runner script
- [ ] Implement test logging and reporting
- [ ] Add screenshot capture for visual tests
- [ ] Create test data fixtures
- **PR:** TBD

#### Acceptance Tests - UI
- [ ] Implement TC-UI1 (no hook/stack errors)
- [ ] Implement TC-UI2 (selection by ID)
- [ ] Implement TC-UI3 (tree auto-resize)
- [ ] Implement TC-UI4 (multi-drop workflow)
- [ ] Implement TC-UI5 (quick action for 2 connectors)
- **PR:** TBD

#### Acceptance Tests - Pathfinding
- [ ] Implement TC-A1 (<100ms simple scene)
- [ ] Implement TC-A2 (<500ms 300+ obstacles)
- [ ] Implement TC-A3 (cost function variants)
- **PR:** TBD

#### Acceptance Tests - Constraints
- [ ] Implement TC-C1 (bend radius)
- [ ] Implement TC-C2 (clearance)
- [ ] Implement TC-C3 (support spacing)
- **PR:** TBD

#### Acceptance Tests - Geometry
- [ ] Implement TC-P1 (pipe sizing)
- [ ] Implement TC-P2 (pipe BOM)
- [ ] Implement TC-TRAY1 (tray sizing)
- [ ] Implement TC-TRAY2 (tray supports)
- [ ] Implement TC-WIRE1 (cable diameter)
- [ ] Implement TC-COND1 (conduit bending)
- **PR:** TBD

#### Acceptance Tests - Persistence
- [ ] Implement TC-S1 (save/load parity)
- [ ] Implement TC-BOM1 (BOM correctness)
- [ ] Implement TC-EXP1 (export material fidelity)
- **PR:** TBD

#### Performance Harness
- [ ] Create PERF_HARNESS.md
- [ ] Create perf measurement scripts
- [ ] Test pathfinding with 300+ obstacles
- [ ] Test geometry generation at 60 FPS
- [ ] Create performance regression tests
- **PR:** TBD

**Acceptance Test:** TC-PERF1

#### Documentation
- [ ] Review and update all SMART_ROUTING docs
- [ ] Create user guide (workflow screenshots)
- [ ] Create API documentation (JSDoc → generated HTML)
- [ ] Add code examples to TECH_SPEC.md
- **PR:** TBD

#### Demo Content
- [ ] Create demo videos (screen recordings)
- [ ] Create marketing screenshots
- [ ] Write release notes
- **PR:** TBD

#### CI Smoke Tests
- [ ] Add routing tests to CI pipeline
- [ ] Configure build + test + lint checks
- [ ] Add acceptance test subset to CI
- **PR:** TBD

#### Release Checklist
- [ ] All acceptance tests passing
- [ ] Performance budgets met
- [ ] Documentation complete
- [ ] Demo content ready
- [ ] PR to `main` opened
- **PR:** TBD

**Acceptance Test:** TC-QA1

---

## 📊 Milestone Progress Tracking

### M0 - Baseline (Current)
**Status:** ✅ COMPLETE
- [x] Pipes generate via panel
- [x] Connector placement stable
- [x] Scene tree loads
- [x] Pro layout loads

### M1 - Core Routing (End of Week 2)
**Status:** 🟡 IN PROGRESS (Target: 2025-01-17)

**Completed:**
- None yet

**In Progress:**
- Setting up agent branches and docs

**Remaining:**
- All four route types generate geometry
- Constraint validation with warnings
- "Create Route" and "Generate All Geometry" flows
- Basic BOM CSV export

**Acceptance Tests:** TC-G1–G6

### M2 - Advanced Features (End of Week 4)
**Status:** ⚪ NOT STARTED (Target: 2025-01-31)

**Remaining:**
- Advanced fittings (elbow/tee/reducer)
- Support placement
- Presets
- Auto-Route All
- Route editing (move points, regenerate)
- Saved projects round-trip

**Acceptance Tests:** TC-E1–E7

### M3 - Production Ready (End of Week 6)
**Status:** ⚪ NOT STARTED (Target: 2025-02-14)

**Remaining:**
- Performance hardening (100+ routes)
- QA pass
- Docs (user + API)
- Demo content
- Marketing materials
- CI smoke tests

**Acceptance Tests:** TC-Q1–Q6

---

## 📈 Team Velocity Metrics

### Week 1 (Target)
- [ ] 10 PRs merged (1 per agent)
- [ ] 15 acceptance tests passing
- [ ] 0 critical blockers
- [ ] <4 hour average PR review time

### Week 2 (Target)
- [ ] 20 PRs merged cumulative
- [ ] 30 acceptance tests passing
- [ ] M1 milestone complete

---

## 🎯 Quick Actions

### Need Help?
1. Add `[HELP]` tag to your standup
2. PM will respond within 1 hour

### Found a Blocker?
1. Add `[BLOCKER]` section at top of this file
2. @mention affected agents
3. PM will triage immediately

### Ready to Merge?
1. Check all PR checklist items
2. Request review from PM
3. Target <4 hour review time

### Finished Early?
1. Check for `[HELP WANTED]` tasks below
2. Help with code reviews
3. Write additional tests

---

## 🆘 Help Wanted

<!-- Add tasks that any agent can help with -->

**None currently** ✅

<!-- Example:
### [HELP WANTED] Need Code Review
**PR:** #123
**Agent:** Agent 4
**Description:** Pipe geometry refactor, needs fresh eyes
-->

---

## 📝 Notes & Learnings

<!-- Add lessons learned, gotchas, tips for other agents -->

### Tips
- Remember to run `npm run type-check` before opening PR
- Use `git push --force-with-lease` instead of `--force`
- Check TODO_BOARD.md for blockers before starting new work

### Gotchas
- Scene Tree recursion is known issue - Agent 8 fixing
- GLB export materials issue - Agent 9 fixing
- Connector placement mode needs to stay active for multi-drop

---

**Last Updated:** 2025-01-03 (Update this timestamp when you edit!)
**Maintained By:** All Agents (Please keep this up to date!)
**PM:** George (Final authority on priorities and blockers)
