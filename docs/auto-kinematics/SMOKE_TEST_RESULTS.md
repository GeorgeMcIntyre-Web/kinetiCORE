# Smoke Test: Units V2 + Motion Joints

This document describes how to run smoke tests for the Units V2 pipeline with state-based unit detection and motion joints.

## Overview

The smoke test runner (`scripts/smokeTestUnitsAndMotion.ts`) validates the complete Units V2 pipeline on real GLB fixtures:

1. **Loads GLB fixtures** using Babylon.js in headless mode (Node.js)
2. **Generates synthetic kinematic snapshots** (closed and open states)
3. **Runs `runUnitsV2Pipeline`** with state-based detection and motion joints enabled
4. **Reports results** for each fixture

## Test Fixtures

The smoke test runs on 6 production GLB fixtures:

| Fixture Name | Path |
|--------------|------|
| 8X-140_GEO CI00 | `Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_CI00.glb` |
| 8X-140_1E1_LH | `Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_1E1_LH.glb` |
| 8X-140_1E1_CI00 | `Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_1E1_CI00.glb` |
| 016ZF_110 | `Tooling/testing_data/016ZF/016ZF_110.glb` |
| 016ZF_130 | `Tooling/testing_data/016ZF/016ZF_130.glb` |
| 9X_110_GEO | `Tooling/testing_data/9X_110_GEO/9X_110_GEO.glb` |

## Running the Smoke Test

### Prerequisites

1. Set the `KINETICORE_DATA_ROOT` environment variable to point to your local data directory
2. Ensure all test GLB files exist at the expected paths

### Command

```bash
# Windows (PowerShell)
$env:KINETICORE_DATA_ROOT="C:\Users\georgem\source\repos\kinetiCORE_data"
npm run smoke:units-motion

# Windows (CMD)
set KINETICORE_DATA_ROOT=C:\Users\georgem\source\repos\kinetiCORE_data
npm run smoke:units-motion

# Linux/Mac
export KINETICORE_DATA_ROOT=/path/to/kinetiCORE_data
npm run smoke:units-motion
```

## Expected Output

The smoke test produces a human-readable summary for each fixture:

```
=== Units V2 + Motion Joints Smoke Test ===

Data root: C:\Users\georgem\source\repos\kinetiCORE_data

Testing: 8X-140_GEO CI00
  Path: C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data\8X-140_GEO\016ZF_20142435_140_CI00.glb
  ✓ Success
    Structure units: 15
    State-based units: 8
    Motion joints: 5
      - Revolute: 3
      - Prismatic: 2

Testing: 8X-140_1E1_LH
  Path: C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data\8X-140_GEO\016ZF_20142435_140_1E1_LH.glb
  ✓ Success
    Structure units: 12
    State-based units: 6
    Motion joints: 4
      - Revolute: 2
      - Prismatic: 2

...

=== Summary ===
Total fixtures: 6
Success: 6
Failed: 0

✓ All tests passed
```

## Configuration

The smoke test uses the following pipeline configuration:

```typescript
runUnitsV2Pipeline(structure, geometryIndex, {
  includeJointPairs: true,
  snapshots,                    // 2 synthetic snapshots (closed, open)
  includeDebug: true,           // Include diagnostic metadata
  includeMotionJoints: true,    // Enable motion joint detection
  stateBasedDetection: {
    minMovingGroupPoints: 20    // Minimum points for moving groups
  },
  motionBuildOptions: {
    minAngularMotionDeg: 1.5,   // Min rotation to detect revolute joint
    minLinearMotion: 0.5        // Min translation to detect prismatic joint
  },
});
```

## Snapshot Generation

The smoke test generates **synthetic kinematic snapshots** by:

1. **Snapshot 1 (Closed)**: Captures all node transforms in their loaded state (identity)
2. **Snapshot 2 (Open)**: Applies random small motions to ~10% of nodes:
   - **Translation**: Random vector (0-0.1 units)
   - **Rotation**: Random axis, 0-30 degrees

This synthetic approach simulates open/closed states without requiring pre-recorded animation data or multiple GLB files per fixture.

## Interpreting Results

### Structure Units
Units detected from the hierarchical tree structure using point cloud analysis. This is the "name-free" hierarchical detection algorithm.

### State-Based Units
Units detected from kinematic snapshots using rigid group analysis. This is the new state-based detection algorithm that analyzes motion patterns.

### Motion Joints
Joints detected from transform deltas between snapshots:
- **Revolute**: Rotation-dominant motion (hinges, rotary clamps)
- **Prismatic**: Translation-dominant motion (linear slides, cylinders)

### Expected Relationships
- **State-based units ≤ Structure units**: State-based detection is more conservative (requires actual motion evidence)
- **Motion joints ≤ State-based units**: Not all units have detectable joints (e.g., static assemblies)
- **Non-zero motion joints**: Confirms that synthetic snapshot generation is working

## Troubleshooting

### "KINETICORE_DATA_ROOT environment variable not set"
Set the environment variable before running the test (see command examples above).

### "File not found: ..."
Verify that the GLB files exist at the expected paths relative to `KINETICORE_DATA_ROOT`.

### "No meshes found in GLB"
The GLB file may be corrupted or not a valid Babylon.js compatible format.

### All fixtures report 0 motion joints
Check that:
1. Synthetic snapshot generation is working (inspect `generateSyntheticSnapshots`)
2. Motion detection thresholds are not too high (`minAngularMotionDeg`, `minLinearMotion`)

## Integration with CI/CD

To integrate the smoke test into CI/CD:

```yaml
# .github/workflows/ci.yml
- name: Download test fixtures
  run: |
    # Download or mount test fixtures
    export KINETICORE_DATA_ROOT=/path/to/fixtures

- name: Run smoke tests
  run: npm run smoke:units-motion
```

**Note**: The test fixtures are NOT checked into Git due to size. You must provision them separately in CI (e.g., artifact download, S3, network share).

## Related Documentation

- [State-Based Unit Detection](./STATE_BASED_UNIT_DETECTION.md) - Algorithm overview
- [Tooling Units V2 Algorithm](./TOOLING_UNITS_V2_ALGO.md) - Structure-based detection
- [Name-Based Unit Detection](./NAME_BASED_UNIT_DETECTION.md) - Legacy name-based approach

## Next Steps

For production use:

1. **Real Animation Data**: Replace synthetic snapshots with actual recorded animations
2. **Multiple States**: Test with >2 states (open, closed, intermediate positions)
3. **Fixture Coverage**: Expand test set to cover more tooling types (grippers, rotary tables, etc.)
4. **Regression Testing**: Track results over time to detect algorithm degradation
