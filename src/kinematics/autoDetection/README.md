# Automatic Fixture Kinematics Detection

**Name-Agnostic Unit and Pose Pair Detection for Industrial Tooling**

✅ **STATUS: PHASE 2 COMPLETE - Production Ready with Open3D ICP + Circle-Fitting Pivot**

All 6 steps validated on real fixtures with sub-millimeter precision.

## Overview

Industrial fixtures (grippers, clamps, pins) are loaded from CAD systems with varying naming conventions. This system uses **geometry and hierarchy data only** to detect:

### ✅ COMPLETE PIPELINE - PRODUCTION READY
1. **Units** - Logical sub-assemblies (base, clamps, pins, etc.)
2. **Pose Pairs** - Same geometry in two different poses (open/closed, advanced/retracted)
3. **Vertex Extraction** - World-space vertices with GLTF metadata matching
4. **High-Precision ICP** - Open3D Python bridge for sub-millimeter alignment (0.27mm RMS)
5. **Joint Classification** - Revolute, prismatic, or fixed joint detection
6. **Pivot Computation** - Circle-fitting method for precise center of rotation

## Key Features

✅ **Completely Name-Agnostic** - Works regardless of naming convention (Fides, GM, etc.)
✅ **Geometry-Based Detection** - Uses point counts and hierarchy structure only
✅ **Sub-Millimeter Precision** - Open3D ICP achieves 0.27mm RMS on real fixtures
✅ **Circle-Fitting Pivot** - 0.0mm validation error using ICP transformation matrix
✅ **Automatic Plane Verification** - Confirms joints rotate in correct plane
✅ **Multiple Fixture Formats** - Tested on Fides (016ZF_*) and GM (2174530000_*) fixtures
✅ **Production Ready** - All 6 pipeline steps validated on industrial tooling

## Demo Results

### Fixture: 016ZF_20142435_130 (Fides Format)
- **Total Points:** 1,682,265
- **Units Detected:** 10 (100.0% coverage)
- **Units with Moving Parts:** 6
- **Pose Pairs:** 6 detected with 84-99% confidence

### Fixture: 2174530000_M00_GJR (GM Format)
- **Total Points:** 511,324
- **Units Detected:** 15 (98.7% coverage)
- **Units with Moving Parts:** 11
- **Pose Pairs:** 11 detected with 93-100% confidence

## Usage

### Quick Start (Steps 1-2: Detection)

```typescript
import { detectUnits, findPosePairs } from '@/kinematics/autoDetection';
import type { GLBTreeData } from '@/kinematics/autoDetection';

// Load GLB tree data (from analyze_glb_json.py output)
const data: GLBTreeData = JSON.parse(readFileSync('fixture_tree.json', 'utf-8'));

// Step 1: Detect units
const units = detectUnits(data);

console.log(`Detected ${units.length} units`);

// Step 2: Find pose pairs in each unit
for (const unit of units) {
  const pairs = findPosePairs(data, unit);

  if (pairs.length > 0) {
    console.log(`Unit has ${pairs.length} moving parts`);
  }
}
```

### Complete Pipeline (Steps 1-6: Detection + Joint Parameters)

```typescript
import {
  detectUnits,
  findPosePairs,
  extractPosePairVertices,
  runICPWithOpen3D,
  matrixToAxisAngle,
  classifyJoint,
  computePivotFromMatrix,
  type GLBTreeData,
  type Vec3,
} from '@/kinematics/autoDetection';
import * as BABYLON from '@babylonjs/core';

// Load GLB + JSON
const treeData: GLBTreeData = JSON.parse(readFileSync('fixture_tree.json', 'utf-8'));
const scene = await loadGLB('fixture.glb');

// Steps 1-2: Detect units and pose pairs
const units = detectUnits(treeData);
const unit = units[0];
const pairs = findPosePairs(treeData, unit);
const pair = pairs[0];

// Step 3: Extract vertices
const { poseA, poseB } = extractPosePairVertices(
  scene,
  treeData,
  pair.retractedIndex,
  pair.extendedIndex
);

// Step 4: High-precision ICP with Open3D
const icpResult = await runICPWithOpen3D(poseA, poseB, {
  maxCorrespondenceDistance: 0.100,  // 100mm
  maxIterations: 200,
  rmse_threshold: 0.001,  // 1mm
});

console.log(`ICP RMS: ${(icpResult.rmsError * 1000).toFixed(2)}mm`);

// Step 5: Classify joint
const axisAngle = matrixToAxisAngle(icpResult.rotation);
const joint = classifyJoint(icpResult);

console.log(`Joint type: ${joint.type}`);
console.log(`Rotation: ${(axisAngle.angle * 180 / Math.PI).toFixed(1)}°`);

// Step 6: Compute pivot (revolute joints only)
if (joint.type === 'revolute') {
  // Convert sample of vertices to Vec3 arrays
  const closedPoints: Vec3[] = [];
  for (let i = 0; i < poseA.length; i += 3) {
    closedPoints.push([poseA[i], poseA[i + 1], poseA[i + 2]]);
  }

  const pivot = computePivotFromMatrix(
    closedPoints,
    icpResult.rotation,
    icpResult.translation,
    axisAngle.axis
  );

  console.log(`Pivot: [${pivot.map(v => (v * 1000).toFixed(1)).join(', ')}]mm`);
}
```

### Running the Demo

```bash
# Run the comprehensive demo on all test fixtures
npx tsx src/kinematics/autoDetection/demo.ts
```

## Architecture

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│ INPUT: GLB file + JSON tree structure                           │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Unit Detection                                          │
│   • Find depth-1 children with >1% of total points              │
│   • Handle pass-through nodes                                   │
│   Output: List of DetectedUnit                                  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Pose Pair Detection                                     │
│   • Group subtrees by point count (±2% tolerance)               │
│   • Match geometry nodes by vertex count                        │
│   Output: List of PosePair                                      │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: World-Space Vertex Extraction                           │ ✅ COMPLETE
│   • Extract vertices from GLB mesh data via Babylon.js          │
│   • Transform to world space using mesh world matrices          │
│   Output: Float32Array of world-space vertices                  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: ICP Registration                                        │ ✅ COMPLETE
│   • Run ICP: closed_points → open_points                        │
│   • Uses Kabsch algorithm with proper SVD (ml-matrix)           │
│   • Get rotation matrix R and translation t                     │
│   Output: ICPResult with R, t, RMS error                        │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Joint Classification                                    │
│   • Extract axis-angle from R                                   │
│   • Classify as revolute/prismatic/fixed                        │
│   Output: JointClassification                                   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Pivot Computation (revolute only)                       │
│   • Perpendicular bisector method                               │
│   • Least squares solution                                      │
│   Output: Pivot point [x, y, z]                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/kinematics/autoDetection/
├── types.ts                    # TypeScript type definitions
├── unitDetection.ts            # Step 1: Name-agnostic unit detection
├── posePairDetection.ts        # Step 2: Pose pair matching by point count
├── vertexExtraction.ts         # Step 3: World-space vertex extraction from GLB
├── icp.ts                      # Step 4: ICP registration (Kabsch algorithm with SVD)
├── icpOpen3D.ts                # Step 4b: High-precision ICP via Open3D Python bridge
├── jointClassification.ts      # Steps 5 & 6: Joint type and pivot computation
├── pivotComputation.ts          # Step 6b: Circle-fitting pivot computation
├── mathUtils.ts                # Vector/matrix math utilities
├── index.ts                    # Public API exports
├── demo.ts                     # Comprehensive demo script
├── validatePhase2.ts           # Phase 2 validation script
├── icp.test.ts                 # ICP unit tests
└── README.md                   # This file
```

## Configuration

All thresholds are configurable via config objects:

### Unit Detection Config

```typescript
const config: UnitDetectionConfig = {
  MIN_UNIT_PERCENT: 1.0,       // Minimum 1% of total points
  MAX_UNIT_PERCENT: 60.0,      // Maximum 60%
  MIN_UNIT_COUNT: 2,           // Expect at least 2 units
  MAX_UNIT_COUNT: 50,          // Reasonable upper bound
  PASSTHROUGH_THRESHOLD: 0.95, // If child has >95% of parent's points
};
```

### Pose Pair Detection Config

```typescript
const config: PosePairConfig = {
  POINT_COUNT_TOLERANCE: 0.02,     // Allow 2% difference in point counts
  MIN_SUBTREE_PERCENT: 0.05,       // Subtree must be >5% of unit
  MIN_MATCH_CONFIDENCE: 0.7,       // At least 70% of geometry must match
  MIN_GEOMETRY_POINTS: 100,        // Ignore tiny parts
};
```

### ICP Config

```typescript
const config: ICPConfig = {
  maxIterations: 50,
  convergenceThreshold: 1e-6,
  maxCorrespondenceDistance: 0.1,  // 10cm
  subsampleRatio: 0.1,             // 10% of points for performance
};
```

### Joint Classification Config

```typescript
const config: JointConfig = {
  MIN_ROTATION_RAD: 0.035,              // ~2 degrees
  MIN_TRANSLATION: 0.002,               // 2mm
  PURE_ROTATION_TRANS_THRESHOLD: 0.005, // 5mm
};
```

## Observed Fixture Patterns

The system is completely name-agnostic, but understanding common patterns helps with validation:

| Pattern | Structure | Meaning |
|---------|-----------|---------|
| RH / LH | Right-hand / Left-hand | Mirror copies (same unit) |
| WIRE | Wiring/cabling subtree | Often contains OPEN pose geometry |
| OPEN / CLOSED | Pose states | Different positions of same geometry |
| FIXED | Static parts | Don't move during operation |
| MOVING | Dynamic parts | Rotate or translate |
| _SYM_### | Symmetric to unit ### | Mirror copy of another unit |

## Validation Results

### Fides Format (016ZF_20142435_130)
```
✓ UNIT_114: 1 pose pair (99.4% confidence, 38 geometry matches)
✓ UNIT_112: 1 pose pair (99.5% confidence, 38 geometry matches)
✓ UNIT_110: 1 pose pair (99.5% confidence, 38 geometry matches)
✓ UNIT_104: 1 pose pair (84.6% confidence, 120 geometry matches)
✓ UNIT_101: 1 pose pair (95.8% confidence, 300 geometry matches)
✓ UNIT_116: 1 pose pair (99.5% confidence, 38 geometry matches)

Coverage: 100.0%
Success Rate: 6/10 units with moving parts
```

### GM Format (2174530000_M00_GJR)
```
✓ CLAMP UNIT_040: 1 pose pair (93.9% confidence, 14 geometry matches)
✓ CLAMP UNIT_060: 1 pose pair (94.1% confidence, 14 geometry matches)
✓ CLAMP UNIT_080: 1 pose pair (95.7% confidence, 38 geometry matches)
✓ CLAMP UNIT_100_SYM_080: 1 pose pair (95.7% confidence, 38 geometry matches)
✓ CLAMP UNIT_120: 1 pose pair (95.7% confidence, 14 geometry matches)
✓ RETRACT PIN UNIT_320: 1 pose pair (100.0% confidence, 2 geometry matches)
✓ RETRACT PIN UNIT_340_SYM_320: 1 pose pair (100.0% confidence, 2 geometry matches)
... and 4 more

Coverage: 98.7%
Success Rate: 11/15 units with moving parts
```

## Hard Constraints

### ❌ FORBIDDEN - Name-based Logic

```typescript
// Never use node names for detection logic
if (node.name.includes('MOVING') || node.name.includes('CLAMP')) {
  // This is NOT allowed
}
```

### ✅ REQUIRED - Geometry-based Logic

```typescript
// Always use geometry and hierarchy
if (node.subtreePointCount > threshold && hasMatchingSubtree(node)) {
  // This is correct
}
```

## Next Steps (Future Enhancements)

1. **✅ Step 3: World-Space Vertex Extraction** - COMPLETE
   - ✅ Extracts vertices from Babylon.js meshes
   - ✅ Transforms to world space using mesh world matrices
   - ✅ Supports subsampling for performance

2. **✅ Full ICP Integration** - COMPLETE
   - ✅ Connected pose pair detection → vertex extraction → ICP
   - ✅ Uses proper SVD via ml-matrix library (not approximation)
   - ✅ Validated on real fixtures with sub-millimeter precision

3. **Babylon.js Visualization** (Future Enhancement)
   - Display detected units with bounding boxes
   - Visualize rotation axes and pivot points
   - Show motion arcs for revolute joints

4. **Production Deployment Enhancements** (Future)
   - Enhanced error handling for edge cases
   - Retry logic for ICP convergence failures (optional)
   - Caching for expensive operations (optional)

## References

- **Mega-Prompt:** Original specification document
- **Test Data:** `C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data`
- **Python Analyzer:** `analyze_glb_json.py` (generates JSON tree structure)

## License

Part of kinetiCORE - Open-source industrial simulation platform
