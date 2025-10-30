# Auto Kinematics Tooling - Refactoring Plan

## Overview
This document outlines the refactoring and testing strategy for the auto kinematics tooling system added in `src/babylon/`.

## Files Reviewed
- ✅ `kinematics/JointMath.ts` - Improved with JSDoc
- ✅ `io/ToolingJsonAdapter.ts` - Improved with JSDoc
- ⏳ `io/Schemas.ts` - Needs JSDoc
- ⏳ `io/MJCFExporter.ts` - Needs JSDoc
- ⏳ `kinematics/KinematicRigBuilder.ts` - Needs JSDoc
- ⏳ `sceneAnalysis/ToolGraphAnalyzer.ts` - Needs JSDoc and refactoring
- ⏳ `actuation/ValveBank.ts` - Needs JSDoc and error handling
- ⏳ `pointCloud/ICP.ts` - Needs JSDoc
- ⏳ `pointCloud/KDTree.ts` - Needs JSDoc
- ⏳ `stateCapture/StateCapture.ts` - Needs JSDoc
- ⏳ `utils/WorldSpace.ts` - Needs JSDoc

## Key Improvements Needed

### 1. Documentation
- [ ] Add comprehensive JSDoc to all public APIs
- [ ] Add usage examples for main entry points
- [ ] Document coordinate system assumptions (Z-up)
- [ ] Add architecture diagrams

### 2. Error Handling
- [ ] Add input validation to all public methods
- [ ] Consistent error messages with `[ModuleName]` prefix
- [ ] Throw meaningful errors vs silent failures
- [ ] Add error recovery strategies

### 3. Testing Strategy

#### Unit Tests (Simple, Fast)
```
src/babylon/kinematics/__tests__/
├── JointMath.test.ts
├── KinematicRigBuilder.test.ts

src/babylon/io/__tests__/
├── ToolingJsonAdapter.test.ts
├── Schemas.test.ts
├── MJCFExporter.test.ts

src/babylon/sceneAnalysis/__tests__/
└── ToolGraphAnalyzer.test.ts

src/babylon/actuation/__tests__/
└── ValveBank.test.ts

src/babylon/pointCloud/__tests__/
├── KDTree.test.ts
└── ICP.test.ts

src/babylon/stateCapture/__tests__/
└── StateCapture.test.ts

src/babylon/utils/__tests__/
└── WorldSpace.test.ts
```

#### Integration Tests
```
demo/__tests__/
└── end-to-end.test.ts - Full pipeline test
```

### 4. Naming Consistency

#### Current Issues:
- `JointKind` vs `JointType` inconsistency
- `ToolingUnitJson` vs `ToolUnit` naming
- Mix of `World` suffix vs no suffix

#### Proposed Conventions:
- Use `Kind` for enums: `JointKind`, `ToolUnitKind`
- Use `Type` for string unions: `type NodeType = 'mesh' | 'collection'`
- Always use `World` suffix for world-space data: `axisWorld`, `anchorWorld`
- Use `Local` suffix for local-space data: `axisLocal`, `anchorLocal`

### 5. Integration Points

#### With Core kinetiCORE:
```typescript
// src/babylon/adapters/KinematicsIntegration.ts
export class KinematicsIntegration {
  /**
   * Convert babylon/kinematics joints → core KinematicsManager format
   */
  static toBabylonJoints(joints: JointDefinition[]): InternalJointDef[] {
    // Bridge babylon namespace → main kinetiCORE
  }
}
```

### 6. Performance Considerations
- [ ] Profile ICP with large point clouds (>100k points)
- [ ] Test ValveBank with 50+ joints
- [ ] Optimize KDTree construction
- [ ] Add LRU cache for repeated transforms

### 7. Code Quality Metrics

| Metric | Target | Current |
|--------|--------|---------|
| JSDoc Coverage | 100% | ~30% |
| Unit Test Coverage | >80% | 0% |
| Cyclomatic Complexity | <10 | TBD |
| Max Function Length | <50 lines | Some >100 |

## Testing Checklist

### Per-Module Tests

#### JointMath.ts
- [ ] Hinge joint applies correct rotation
- [ ] Prismatic joint applies correct translation
- [ ] Clamp respects joint limits
- [ ] Warns when node not found

#### ToolingJsonAdapter.ts
- [ ] Parses valid tooling JSON
- [ ] Converts Type 0 (prismatic) correctly
- [ ] Converts Type 1 (hinge) correctly
- [ ] Degrees→radians conversion
- [ ] Throws on invalid matrix

#### KDTree.ts
- [ ] Builds balanced tree
- [ ] Finds nearest neighbor correctly
- [ ] Handles edge cases (empty, single point)

#### ICP.ts
- [ ] Aligns identical point clouds (zero error)
- [ ] Aligns rotated point clouds
- [ ] Aligns translated point clouds
- [ ] Handles outliers with trim fraction
- [ ] Respects reject threshold

#### ValveBank.ts
- [ ] Registers joints
- [ ] Applies commands (extend/retract)
- [ ] Runs timeline in correct order
- [ ] Clamps to joint limits

#### ToolGraphAnalyzer.ts
- [ ] Detects units by tags
- [ ] Falls back to children heuristic
- [ ] Classifies fixed vs moving
- [ ] Computes world anchors

### Integration Test
```typescript
describe('Auto Kinematics Pipeline', () => {
  it('loads tooling JSON, builds joints, animates scene', async () => {
    // 1. Load tooling JSON
    const json = loadTestToolingJson();

    // 2. Convert to joints
    const joints = toolingJsonToJoints(json, resolveParent);
    expect(joints.length).toBeGreaterThan(0);

    // 3. Register in ValveBank
    const bank = new ValveBank(scene);
    joints.forEach(j => bank.registerJoint(j));

    // 4. Run animation timeline
    await bank.runTimeline(events);

    // 5. Verify scene state
    // Check node transforms match expected values
  });
});
```

## Priority Order

### Phase 1: Critical Path (This PR)
1. ✅ Add JSDoc to JointMath
2. ✅ Add JSDoc to ToolingJsonAdapter
3. ⏳ Add JSDoc to remaining modules
4. ⏳ Add error handling to all modules
5. ⏳ Create simple unit tests

### Phase 2: Integration (Next PR)
6. Create KinematicsIntegration adapter
7. Add UI hooks (if needed)
8. Add end-to-end test
9. Performance profiling

### Phase 3: Polish (Future)
10. Advanced ICP features
11. Motion planning with velocity/acceleration
12. Real-time visualization of joint axes

## Breaking Changes
None planned - all refactoring is internal improvements.

## Dependencies
- Babylon.js 8.30+ (already satisfied)
- Node 18+ for headless tests (already satisfied)
- Vitest for unit tests (need to add)

## Migration Guide
Not applicable - this is new functionality, no existing code depends on it yet.

## Success Criteria
- [ ] All modules have >80% JSDoc coverage
- [ ] All modules have basic unit tests
- [ ] CI passes with new tests
- [ ] Performance benchmarks documented
- [ ] Integration example in demo/
