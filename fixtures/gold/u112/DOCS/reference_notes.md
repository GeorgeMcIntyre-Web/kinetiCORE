# U112 Gold Standard Reference Fixture

## Overview

This directory contains the **canonical reference fixture** for the kinetiCORE auto-kinematics pipeline. All future tooling fixture implementations must validate against this baseline.

## Fixture Specification

**File**: `016ZF_20142435_140_1E1_CI00_U112.glb`

**Structure**:
- **UNIT_101**: Static gripper frame (fixed base)
- **UNIT_112**: Moving clamp unit with single revolute joint
  - **Joint Type**: Hinge (revolute)
  - **Range**: 90° stroke
  - **Axis**: Parallel to fixture base
  - **Expected Behavior**: Smooth rotation about pivot point

## Validation Criteria

All U112 tests must pass these invariants:

| Property | Expected Value | Tolerance |
|----------|----------------|-----------|
| Units Detected | 2 | Exact |
| Fixed Units | 1 | Exact |
| Moving Units | 1 | Exact |
| Joint Type | `hinge` | Exact |
| Joint Angle | 80-100° | ±10° |
| RMS Error | < 1.0 mm | Max threshold |
| Confidence | > 0.70 | Minimum |
| Workflow State | `ready_to_play` | Final state |

## Usage

### Running Gold Tests

```bash
# Run U112 gold standard tests
npm test -- --run tests/gold/u112-gold.test.ts

# Verify all 34 unit tests pass
npm test -- --run --testNamePattern="ToolingFixtureAnimator"
```

### Expected Console Output

```
[ToolingFixtureAnimator] ========== STEP 1: ANALYZE FIXTURE ==========
[ToolingFixtureAnimator] Analysis Result: { totalUnits: 2, fixedCount: 1, movingCount: 1 }
[ToolingFixtureAnimator] ========== STEP 2a: CAPTURE RETRACTED STATE ==========
[ToolingFixtureAnimator] Captured: { unitName: "UNIT_112", pointCount: 4523 }
[ToolingFixtureAnimator] ========== STEP 2b: CAPTURE EXTENDED STATE ==========
[ToolingFixtureAnimator] Captured: { unitName: "UNIT_112", pointCount: 4523 }
[ToolingFixtureAnimator] ========== STEP 3: FIT JOINTS VIA ICP ==========
[ToolingFixtureAnimator] Joint fit SUCCESS: { jointType: "hinge", angleDeg: 90.0 }
```

## Pipeline Protection Rules

⚠️ **PROTECTED PIPELINE** ⚠️

Before modifying any of the following files, you **MUST** run U112 gold tests:

- `src/babylon/pipeline/ToolingFixtureAnimator.ts`
- `src/babylon/pipeline/KinematicExtractionPipeline.ts`
- `src/babylon/sceneAnalysis/StructureBasedToolAnalyzer.ts`
- `src/kinematics/toolingKinematicsAdapter.ts`
- `src/math/icp/IcpFitter.ts`

**Ask yourself before editing:**
> "HAVE YOU RUN THE U112 GOLD TESTS YET?"

## Extending to New Fixtures

### U113-U120: Single Revolute Joint

New fixtures with similar structure should:
1. Reference U112 test structure
2. Verify same workflow states
3. Maintain angle tolerance
4. Use same ICP parameters

### U121-U130: Multi-Joint Fixtures

Fixtures with 2+ joints must:
1. Validate each joint individually
2. Compare first joint against U112 baseline
3. Document new joint types separately

### U131+: Complex Kinematics

Prismatic, combined, or serial chains require:
1. New test suite (do not modify U112 tests)
2. Documentation in separate gold fixture directory
3. Cross-reference U112 for workflow structure

## Troubleshooting

### Test Failures

If U112 gold tests fail after changes:

1. **Revert immediately** - U112 is the known-good state
2. **Check console logs** - Look for ICP convergence issues
3. **Verify no synthetic transforms** - Only actual captured states allowed
4. **Compare angles** - Use `console.log` to debug joint fitting

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Angle = 0° | No motion detected | Increase rotation between captures |
| RMS > 1mm | Point cloud mismatch | Check stride/sampling parameters |
| Confidence < 0.7 | Poor ICP convergence | Verify point cloud quality |
| Wrong joint type | Threshold misalignment | Review MIN_ROTATION constant |

## Version History

- **v0.9.0-auto-kinematics-u112-gold** - Initial gold standard baseline
  - 34 passing unit tests
  - Comprehensive documentation
  - Structured result types
  - Guard clause error handling

## References

- [Pipeline Documentation](../../../docs/auto-kinematics/AUTO_KINEMATICS_PIPELINE.md)
- [Unit Tests](../../../tests/babylon/pipeline/ToolingFixtureAnimator.test.ts)
- [E2E Tests](../../../tests/babylon/pipeline/ToolingFixtureAnimator.e2e.test.ts)
- [Gold Test Suite](../../../tests/gold/u112-gold.test.ts)
