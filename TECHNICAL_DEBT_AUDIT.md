# kinetiCORE - Technical Debt & Testing Audit
**Date:** 2025-10-08
**Auditor:** Claude Code
**Status:** TypeScript compilation ✅ PASSING | Tests ❌ MISSING

---

## Executive Summary

The codebase has **126 TypeScript files** with **ZERO unit tests**. Type checking passes cleanly, but there is no test coverage whatsoever. This audit identifies core features vs nice-to-have features, technical debt, and creates a prioritized action plan for cleanup and testing.

---

## 1. Feature Classification

### 🎯 CORE FEATURES (Must Be Rock Solid)

#### A. 3D Scene Management ⭐ PRIORITY 1
**Files:**
- `src/scene/SceneManager.ts` - Central scene orchestration
- `src/scene/ModelLoader.ts` - File import (GLTF, OBJ, STL, DXF, JT, URDF)
- `src/scene/SceneTreeManager.ts` - Hierarchy management
- `src/entities/EntityRegistry.ts` - Entity lifecycle
- `src/entities/SceneEntity.ts` - 3D object abstraction

**Status:** ✅ Core logic implemented
**Technical Debt:**
- No tests for scene initialization
- No tests for model loading workflows
- Scene tree manipulation untested
- Entity disposal/memory leaks not validated

**Test Priority:** 🔴 CRITICAL

---

#### B. Transform Controls & Snapping ⭐ PRIORITY 1
**Files:**
- `src/manipulation/TransformGizmo.ts` - Gizmo system
- `src/manipulation/SnappingHelper.ts` - 13 snap types (NEW - recently added)
- `src/manipulation/SnappingGizmoWrapper.ts` - Integration layer
- `src/ui/components/SnapSettings.tsx` - Snap UI (NEW)
- `src/ui/components/AlignTool.tsx` - Alignment tool (NEW)
- `src/ui/components/TransformSettings.tsx` - Transform settings
- `src/ui/components/TransformHUD.tsx` - Visual feedback
- `src/ui/components/TemporaryOrigin.tsx` - Custom origin (NEW)

**Status:** ⚠️ Recently expanded with comprehensive snapping system
**Technical Debt:**
- **NEW SNAP SYSTEM NOT TESTED** - 13 snap types with complex geometry math
- Snap button workflows untested
- Transform command undo/redo untested
- Gizmo interaction edge cases unknown
- Alignment tool (vertex/edge/face/center) not tested
- Temporary origin feature not validated

**Test Priority:** 🔴 CRITICAL - This is your latest feature and needs thorough testing!

---

#### C. Undo/Redo Command System ⭐ PRIORITY 2
**Files:**
- `src/history/CommandManager.ts` - Command orchestration
- `src/history/commands/TransformCommand.ts` - Move/rotate/scale
- `src/history/commands/CreateObjectCommand.ts` - Object creation
- `src/history/commands/DeleteObjectCommand.ts` - Deletion
- `src/history/commands/DuplicateObjectCommand.ts` - Duplication
- `src/history/commands/BooleanOperationCommand.ts` - CSG operations
- `src/history/commands/CreateProjectionViewCommand.ts` - 2D projections

**Status:** ✅ Architecture solid
**Technical Debt:**
- No tests for command execution
- Undo/redo state integrity untested
- Command serialization untested
- Edge cases (undo after delete, etc.) unknown

**Test Priority:** 🟠 HIGH

---

#### D. State Management (Zustand) ⭐ PRIORITY 2
**Files:**
- `src/ui/store/editorStore.ts` - 500+ lines of complex state
- `src/ui/store/assetLibraryStore.ts` - Asset library state
- `src/ui/store/subscriptionStore.ts` - Subscription state

**Status:** ⚠️ Complex, untested
**Technical Debt:**
- State transitions untested
- Selector performance unknown
- Race conditions possible
- Snap state management (13 flags) not validated

**Test Priority:** 🟠 HIGH

---

#### E. UI Components & Workflows ⭐ PRIORITY 2
**Files:**
- `src/ui/components/SceneCanvas.tsx` - Babylon.js integration
- `src/ui/components/Toolbar.tsx` - Main toolbar
- `src/ui/components/SceneTree.tsx` - Hierarchy view
- `src/ui/components/Inspector.tsx` - Property editor
- `src/ui/components/KeyboardShortcuts.tsx` - Hotkeys
- `src/ui/layouts/*` - 3 layout modes (Essential/Professional/Expert)

**Status:** ✅ Functional but brittle
**Technical Debt:**
- Button click workflows untested
- Keyboard shortcuts not validated
- Layout switching untested
- Toolbar button interactions (especially new snap buttons) untested

**Test Priority:** 🟡 MEDIUM

---

### 🚀 ADVANCED FEATURES (Important But Secondary)

#### F. Kinematics System
**Files:**
- `src/kinematics/KinematicsManager.ts`
- `src/kinematics/ForwardKinematicsSolver.ts`
- `src/kinematics/InverseKinematicsSolver.ts`
- `src/kinematics/actuation/ActuatorSystem.ts`
- `src/kinematics/device/UnifiedDeviceDefinition.ts`
- `src/kinematics/exporters/URDFExporter.ts`
- `src/kinematics/exporters/MJCFExporter.ts`
- `src/loaders/urdf/*` - URDF loader (4 files)

**Status:** ⚠️ Complex, example-only testing
**Technical Debt:**
- FK/IK solvers have example code but no unit tests
- URDF import/export untested
- Actuator coordination logic untested
- Has `USAGE_EXAMPLE.ts` but no real tests

**Test Priority:** 🟡 MEDIUM (core for robotics workflows)

---

#### G. CAD File Loaders
**Files:**
- `src/loaders/jt/*` - JT loader (9 files, ~1500 LOC)
- `src/loaders/dwg/*` - DWG/DXF loader (8 files)
- `src/loaders/catia/CATIALoader.ts` - CATIA stub
- `src/dxf/*` - DXF parser (5 files)

**Status:** ⚠️ JT loader complex, DWG experimental
**Technical Debt:**
- JT LOD management untested
- DWG parsing fragile (marked with TODOs)
- Coordinate conversion untested
- Memory management (large files) unknown

**Test Priority:** 🟡 MEDIUM

---

### 🔮 EXPERIMENTAL/FUTURE FEATURES

#### H. Path Planning (Not Used)
**Files:**
- `src/pathPlanning/RRTConnectPlanner.ts`
- `src/pathPlanning/MultiRobotCoordinator.ts`
- `src/pathPlanning/SpotWeldingPlanner.ts`
- `src/pathPlanning/TrajectoryOptimizer.ts`
- `src/pathPlanning/ViaPointGenerator.ts`
- `src/pathPlanning/TSPSolver.ts`
- `src/pathPlanning/ConfigurationSampler.ts`
- `src/pathPlanning/RRTTree.ts`

**Status:** ❌ Not integrated, skeleton implementations
**Technical Debt:**
- Entire module appears unused
- Not wired into UI
- Contains TODOs and placeholders

**Recommendation:** 🔴 **CONSIDER REMOVING** or clearly mark as "future work"

---

#### I. Physics Engine (Rapier)
**Files:**
- `src/physics/RapierPhysicsEngine.ts`
- `src/physics/IPhysicsEngine.ts`

**Status:** ⚠️ Abstraction layer exists, limited usage
**Technical Debt:**
- Physics integration unclear
- Not tested
- May be premature abstraction

**Test Priority:** ⚪ LOW (if not actively used)

---

#### J. Boolean Operations (CSG)
**Files:**
- `src/scene/BooleanOperations.ts`

**Status:** ⚠️ Uses manifold-3d library
**Technical Debt:**
- Complex geometry operations untested
- Error handling unknown

**Test Priority:** 🟡 MEDIUM (if used)

---

#### K. Monetization/Subscription
**Files:**
- `src/config/stripe.ts`
- `src/config/pricing.ts`
- `src/ui/components/PricingPage.tsx`

**Status:** ❌ Appears to be future work
**Recommendation:** Move to `future/` folder if not actively developed

---

## 2. Test Coverage Analysis

### Current State: ❌ ZERO TESTS

```bash
npm run test
# Result: "No test files found"
```

**No files matching:**
- `**/*.test.ts`
- `**/*.test.tsx`
- `**/*.spec.ts`
- `**/*.spec.tsx`

---

## 3. Technical Debt Breakdown

### 🔴 Critical Issues

1. **No Unit Tests** - 126 files, 0 tests
2. **New Snapping System Untested** - 13 snap types, complex geometry calculations
3. **Snap Button Workflows Untested** - UI interactions with snap toggles
4. **Align Tool Untested** - 2-click alignment workflow
5. **Transform Commands Untested** - Undo/redo integrity unknown
6. **State Management Untested** - Zustand store with 13+ snap flags
7. **Memory Leaks Possible** - No disposal validation for 3D objects
8. **Scene Tree Integrity** - Hierarchy manipulation untested

### 🟠 High Priority Issues

9. **Command System Untested** - 7 command types, no validation
10. **Keyboard Shortcuts Untested** - Hotkey conflicts possible
11. **File Loader Error Handling** - Import failures not validated
12. **Kinematics System Untested** - FK/IK solvers, URDF export
13. **Boolean Operations Untested** - CSG geometry edge cases

### 🟡 Medium Priority Issues

14. **Path Planning Module Unused** - 8 files, possibly dead code
15. **JT Loader LOD System** - Complex but untested
16. **DWG Parsing Fragile** - Marked with TODOs
17. **Layout Switching** - 3 modes, no transition tests
18. **Asset Library** - Drag/drop workflows untested

### ⚪ Low Priority

19. **Subscription System** - Future feature
20. **CATIA Loader** - Stub only
21. **Physics Engine** - Limited usage

---

## 4. Code Quality Metrics

### ✅ Positive Indicators
- TypeScript strict mode **enabled**
- ESLint configured (max 20 warnings)
- Prettier formatting
- Git hooks (husky + lint-staged)
- Clean compilation (no type errors)
- Good file organization
- Ownership documented in comments

### ⚠️ Concerns
- **32 files with TODO/FIXME/HACK comments**
- **16 files with "deprecated" or "unused" references**
- No test infrastructure beyond Vitest configuration
- Some modules appear isolated (pathPlanning, physics)

---

## 5. Recommended Action Plan

### Phase 1: Critical Testing (Week 1) 🔴

#### Priority A: Snapping System Tests
**NEW FEATURE - MUST BE TESTED FIRST**

```typescript
// src/manipulation/__tests__/SnappingHelper.test.ts
describe('SnappingHelper', () => {
  describe('snapToVertex', () => {
    it('should snap to closest vertex within snap distance')
    it('should not snap when no vertices nearby')
    it('should exclude specified meshes')
    it('should handle world space transformations')
  })

  describe('snapToEdge', () => {
    it('should snap to closest point on edge')
    it('should handle triangle edges correctly')
  })

  describe('snapToGrid', () => {
    it('should snap position to grid increments')
    it('should handle mm to meter conversion')
  })

  // Test all 13 snap types:
  // - snapToVertex, snapToEdge, snapToFace, snapToCenter
  // - snapToMidpoint, snapToIntersection, snapToNormal
  // - snapToObject, snapToSurface, snapObjectToVertex
  // - snapBBoxCorner, snapPointOnEdge, snapToGrid
})
```

#### Priority B: Snap Button Workflows
```typescript
// src/ui/components/__tests__/SnapSettings.test.tsx
describe('SnapSettings', () => {
  it('should toggle snap button state on click')
  it('should update editorStore snap flags')
  it('should show active state visually')
  it('should only open one popup at a time')
  it('should display last-used icon in group header')
})
```

#### Priority C: Align Tool Workflow
```typescript
// src/ui/components/__tests__/AlignTool.test.tsx
describe('AlignTool', () => {
  it('should enter alignment mode on button click')
  it('should capture first point on click')
  it('should capture second point and execute alignment')
  it('should cancel on ESC key')
  it('should restart on R key')
  it('should show status messages correctly')
})
```

#### Priority D: Transform Command Tests
```typescript
// src/history/commands/__tests__/TransformCommand.test.ts
describe('TransformCommand', () => {
  it('should execute position transform')
  it('should undo transform correctly')
  it('should redo transform correctly')
  it('should handle multiple meshes')
})
```

#### Priority E: Core Scene Tests
```typescript
// src/scene/__tests__/SceneManager.test.ts
describe('SceneManager', () => {
  it('should initialize scene correctly')
  it('should dispose resources on cleanup')
  it('should handle camera switching')
})

// src/entities/__tests__/EntityRegistry.test.ts
describe('EntityRegistry', () => {
  it('should create entity with mesh and physics')
  it('should dispose entity resources')
  it('should update entity registry')
})
```

---

### Phase 2: High Priority Testing (Week 2) 🟠

1. **Command System**
   - Test all 7 command types
   - Test undo/redo stack integrity
   - Test command serialization

2. **State Management**
   - Test editorStore selectors
   - Test snap state management (13 flags)
   - Test state transitions

3. **File Loaders**
   - Test GLTF/OBJ/STL import
   - Test URDF import
   - Test error handling for corrupt files

4. **Kinematics**
   - Test FK solver accuracy
   - Test IK solver convergence
   - Test URDF export format

---

### Phase 3: Medium Priority Testing (Week 3) 🟡

1. **UI Components**
   - Test toolbar button interactions
   - Test keyboard shortcuts
   - Test layout switching

2. **JT Loader**
   - Test LOD management
   - Test memory efficiency

3. **Boolean Operations**
   - Test union/intersection/difference
   - Test edge cases

---

### Phase 4: Cleanup (Week 4) ⚪

1. **Remove/Archive Unused Code**
   - Decision on `pathPlanning/` module (remove or keep?)
   - Move `config/stripe.ts` to future/ folder
   - Clean up TODOs and FIXMEs

2. **Documentation**
   - Add testing guide
   - Document core workflows
   - Add API documentation

---

## 6. Test Infrastructure Setup

### Install Additional Testing Tools

```bash
npm install --save-dev \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  @vitest/ui \
  happy-dom
```

### Create Test Utilities

```typescript
// src/__tests__/utils/test-utils.tsx
// Babylon.js test mocks
// Zustand store test helpers
// React Testing Library wrappers
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run type-check
      - run: npm run test:coverage
      - run: npm run lint
```

---

## 7. Success Metrics

### Week 1 Goals
- [ ] 50+ tests for snapping system
- [ ] All 13 snap types validated
- [ ] Snap button workflows tested
- [ ] Align tool workflow tested
- [ ] Transform commands tested
- [ ] Coverage: 60% for `manipulation/` folder

### Week 2 Goals
- [ ] 100+ total tests
- [ ] Command system fully tested
- [ ] State management tested
- [ ] Coverage: 50% overall

### Week 3 Goals
- [ ] 150+ total tests
- [ ] All core workflows tested
- [ ] Coverage: 60% overall

### Week 4 Goals
- [ ] 200+ total tests
- [ ] Dead code removed
- [ ] Coverage: 70% overall
- [ ] CI/CD passing

---

## 8. Files Requiring Immediate Attention

### 🔴 Critical (Test First)
1. `src/manipulation/SnappingHelper.ts` - 940 lines, 13 snap types, complex geometry
2. `src/ui/components/SnapSettings.tsx` - NEW snap UI with grouped buttons
3. `src/ui/components/AlignTool.tsx` - NEW 2-click alignment workflow
4. `src/manipulation/TransformGizmo.ts` - Core transform logic
5. `src/history/CommandManager.ts` - Undo/redo orchestration
6. `src/ui/store/editorStore.ts` - 500+ lines of state

### 🟠 High Priority
7. `src/scene/SceneManager.ts` - Scene lifecycle
8. `src/entities/EntityRegistry.ts` - Entity management
9. `src/scene/ModelLoader.ts` - File import
10. `src/history/commands/TransformCommand.ts` - Transform undo/redo

---

## 9. Questions for Team Discussion

1. **Path Planning Module**: Keep or remove? (8 files, unused)
2. **Physics Engine**: Actively used? If not, simplify or remove
3. **Subscription System**: Active development or future work?
4. **Test Coverage Target**: Aim for 70%? 80%?
5. **CI/CD Priority**: Block merges without tests?
6. **Snapping System**: Are all 13 snap types needed, or can we prioritize a subset?

---

## 10. Conclusion

**Current State:** ⚠️ Feature-rich but fragile - no test safety net

**Biggest Risks:**
1. Recent snapping system expansion (13 types) is completely untested
2. New snap buttons and align tool workflows are untested
3. Complex geometry calculations in SnappingHelper could have edge cases
4. No validation of undo/redo integrity
5. State management complexity growing without tests

**Recommendation:**
- **STOP** adding new features temporarily
- **FOCUS** on testing the recently added snapping system first
- **VALIDATE** core workflows (transform, snap, align, undo/redo)
- **REMOVE** unused modules (pathPlanning, potentially physics)
- **ESTABLISH** test-first culture going forward

**Timeline:** 4 weeks to get to 70% coverage and production-ready state

---

## Appendix: File Inventory

**Total Files:** 126 TypeScript files
**Total LOC:** ~15,000+ (estimated)

**By Module:**
- `ui/` - 30 files (components + store)
- `loaders/` - 20 files (JT, DWG, URDF, CATIA)
- `kinematics/` - 12 files
- `scene/` - 10 files
- `manipulation/` - 3 files (SnappingHelper, TransformGizmo, SnappingGizmoWrapper)
- `history/` - 8 files (CommandManager + 7 commands)
- `pathPlanning/` - 8 files ⚠️
- `dxf/` - 5 files
- `entities/` - 3 files
- `core/` - 3 files
- `physics/` - 2 files ⚠️
- `library/` - 3 files
- `config/` - 3 files ⚠️
- `utils/` - 1 file

⚠️ = Potentially unused or experimental

---

**Next Steps:**
1. Review this audit with the team
2. Prioritize testing roadmap
3. Set up test infrastructure
4. Start with snapping system tests (CRITICAL)
5. Establish coverage gates for CI/CD
