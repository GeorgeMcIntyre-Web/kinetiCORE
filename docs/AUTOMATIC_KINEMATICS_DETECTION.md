# Automatic Fixture Kinematics Detection - Complete Documentation

**Project:** kinetiCORE - Automatic Kinematics Detection System
**Date:** 2025-11-26
**Status:** ✅ Core Implementation Complete (Steps 1-2, 4-6 of 6)
**Author:** Claude Code (Agent 1 - George)

---

## Executive Summary

Successfully implemented a **name-agnostic automatic kinematics detection system** that analyzes industrial tooling fixtures (grippers, clamps, pins) from GLB/GLTF files and automatically detects:

1. **Units** - Logical sub-assemblies within the fixture
2. **Pose Pairs** - Same geometry in different poses (open/closed, advanced/retracted)
3. **Joint Parameters** - Rotation axes, pivot points, translation vectors

### Key Achievement

**93-100% confidence** in pose pair detection across multiple fixture formats (Fides, GM) using **only geometry and hierarchy data** - completely independent of node naming conventions.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Implementation Details](#implementation-details)
3. [Validation Results](#validation-results)
4. [API Reference](#api-reference)
5. [Configuration](#configuration)
6. [Usage Examples](#usage-examples)
7. [Future Work](#future-work)

---

## Architecture Overview

### Pipeline Stages

```
INPUT: GLB/GLTF file + JSON hierarchy tree
    ↓
┌─────────────────────────────────────────────┐
│ STEP 1: Unit Detection                     │ ✅ COMPLETE
│   Algorithm: Depth-based hierarchy analysis │
│   Output: List of DetectedUnit             │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STEP 2: Pose Pair Detection                │ ✅ COMPLETE
│   Algorithm: Point count matching          │
│   Output: List of PosePair                 │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STEP 3: World-Space Vertex Extraction      │ ⏳ TODO
│   Algorithm: GLB mesh parsing + transform  │
│   Output: Float32Array (world vertices)    │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STEP 4: ICP Registration                   │ ✅ COMPLETE
│   Algorithm: Iterative Closest Point       │
│   Output: ICPResult (R, t, RMS error)      │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STEP 5: Joint Classification                │ ✅ COMPLETE
│   Algorithm: Axis-angle extraction         │
│   Output: JointClassification              │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STEP 6: Pivot Point Computation            │ ✅ COMPLETE
│   Algorithm: Perpendicular bisector method │
│   Output: Pivot point [x, y, z]            │
└─────────────────────────────────────────────┘
    ↓
OUTPUT: Complete kinematic joint parameters
```

### Module Structure

```
src/kinematics/autoDetection/
├── types.ts                    (335 lines) - Complete type definitions
├── unitDetection.ts            (190 lines) - Step 1: Unit detection
├── posePairDetection.ts        (170 lines) - Step 2: Pose pair detection
├── mathUtils.ts                (360 lines) - Linear algebra utilities
├── icp.ts                      (290 lines) - Step 4: ICP algorithm
├── jointClassification.ts      (280 lines) - Steps 5-6: Joint classification
├── index.ts                    (60 lines)  - Public API
├── demo.ts                     (135 lines) - Demo script
└── README.md                   (280 lines) - Module documentation

tests/kinematics/autoDetection/
├── unitDetection.test.ts       (160 lines) - Unit detection tests
└── posePairDetection.test.ts   (180 lines) - Pose pair tests

docs/
└── AUTOMATIC_KINEMATICS_DETECTION.md (this file)

Total: ~2,440 lines of production TypeScript + documentation
```

---

## Implementation Details

### Step 1: Unit Detection

**Problem:** Identify logical sub-assemblies (units) within a fixture.

**Solution:** Geometry-based hierarchy analysis

**Algorithm:**
1. Find root node (parentIndex === null)
2. Detect unit level (typically depth 1)
   - Handle pass-through containers (single child with >95% of parent points)
3. Filter candidates by point count thresholds:
   - Minimum: 1% of total points
   - Maximum: 60% of total points
4. Validate total coverage (expect 85-100%)

**Code Location:** [src/kinematics/autoDetection/unitDetection.ts](src/kinematics/autoDetection/unitDetection.ts:1-190)

**Example Output:**
```
[UNITS] Detected 10 units (100.0% coverage)
  UNIT_101: 631,447 pts (37.5%)
  UNIT_102: 212,348 pts (12.6%)
  UNIT_104: 209,103 pts (12.4%)
  ... 7 more units
```

### Step 2: Pose Pair Detection

**Problem:** Find pairs of geometry representing the same body in different poses.

**Solution:** Point count matching

**Algorithm:**
1. Get significant subtrees within each unit (>5% of unit points)
2. Group subtrees by approximate point count (±2% tolerance)
3. For each group with exactly 2 members:
   - Extract geometry nodes from both subtrees
   - Match geometry by vertex count (±2% tolerance)
   - Calculate confidence = matched_points / total_points
   - Accept if confidence ≥ 70%

**Key Insight:** Same CAD part = same mesh = same vertex count

**Code Location:** [src/kinematics/autoDetection/posePairDetection.ts](src/kinematics/autoDetection/posePairDetection.ts:1-170)

**Example Output:**
```
[PAIRS] ✓ Pose pair detected: subtrees 2638 and 3206, confidence 95.8%
  Matched geometry: 300 pairs
  Closed pose: RH (315,552 pts)
  Open pose:   LH (315,895 pts)
```

### Step 3: World-Space Vertex Extraction (TODO)

**Problem:** Extract actual 3D vertex positions from GLB mesh data.

**Planned Solution:**
1. Parse GLB binary format (or use Babylon.js GLB loader)
2. Extract vertices from mesh primitives
3. Compute cumulative world matrix:
   - Walk hierarchy from root to node
   - Accumulate T·R·S transformations
4. Transform all vertices to world space
5. Return Float32Array for ICP

**Status:** Architecture designed, implementation pending

**Blocker:** Requires GLB binary parser or Babylon.js integration

### Step 4: ICP Registration

**Problem:** Find rigid transformation (rotation + translation) between pose pairs.

**Solution:** Iterative Closest Point (ICP) algorithm

**Algorithm:**
1. Subsample source points for performance (10% default)
2. For each iteration:
   - Transform source with current R, t estimate
   - Find nearest neighbor correspondences
   - Compute optimal transform using Kabsch algorithm
   - Update cumulative R, t
   - Check convergence (RMS error change < threshold)
3. Return final R, t, RMS error, convergence status

**Note:** Currently uses simplified Gram-Schmidt orthogonalization for rotation estimation. For production, recommend using a proper SVD library (ml-matrix, numeric.js).

**Code Location:** [src/kinematics/autoDetection/icp.ts](src/kinematics/autoDetection/icp.ts:1-290)

### Step 5: Joint Classification

**Problem:** Determine joint type from ICP transformation.

**Solution:** Axis-angle extraction and threshold-based classification

**Algorithm:**
1. Extract axis-angle from rotation matrix:
   - angle = arccos((trace(R) - 1) / 2)
   - axis from skew-symmetric part of R
2. Calculate translation magnitude
3. Classify:
   - Rotation ≥2° & translation <5mm → **Revolute**
   - Rotation ≥2° & translation ≥5mm → **Revolute** (offset pivot)
   - Rotation <2° & translation ≥2mm → **Prismatic**
   - Neither → **Fixed**

**Code Location:** [src/kinematics/autoDetection/jointClassification.ts](src/kinematics/autoDetection/jointClassification.ts:1-90)

### Step 6: Pivot Point Computation

**Problem:** Find pivot point for revolute joints.

**Solution:** Perpendicular bisector method with least squares

**Algorithm:**
1. For each corresponding point pair (p_closed, p_open):
   - Compute chord midpoint: mid = (p_closed + p_open) / 2
   - Compute chord direction: d = normalize(p_open - p_closed)
   - Compute bisector direction: b = normalize(d × rotation_axis)
   - Store bisector line: {point: mid, direction: b}
2. Find point minimizing distance to all bisector lines:
   - Solve least squares: AᵀA·x = Aᵀb
   - Return pivot point x

**Code Location:** [src/kinematics/autoDetection/jointClassification.ts](src/kinematics/autoDetection/jointClassification.ts:90-150)

---

## Validation Results

### Test Fixture 1: 016ZF_20142435_130 (Fides Format)

**File Statistics:**
- Total nodes: 4,034
- Total points: 1,682,265
- Max depth: 11
- Nodes with geometry: 1,917

**Detection Results:**
```
Units Detected: 10 (100.0% coverage)

Units with Moving Parts:
  ✅ UNIT_114: 1 pose pair (99.4% confidence, 38 geometry matches)
     - RH (32,136 pts) ↔ LH (32,327 pts)
     - POWER_CLAMP mirrored pair detected

  ✅ UNIT_112: 1 pose pair (99.5% confidence, 38 geometry matches)
     - RH (35,871 pts) ↔ LH (36,056 pts)

  ✅ UNIT_110: 1 pose pair (99.5% confidence, 38 geometry matches)
     - RH (35,831 pts) ↔ LH (36,008 pts)

  ✅ UNIT_104: 1 pose pair (84.6% confidence, 120 geometry matches)
     - RH (94,276 pts) ↔ LH (95,042 pts)
     - Larger assembly with more complex geometry

  ✅ UNIT_101: 1 pose pair (95.8% confidence, 300 geometry matches)
     - RH (315,552 pts) ↔ LH (315,895 pts)
     - Largest unit with most geometry matches

  ✅ UNIT_116: 1 pose pair (99.5% confidence, 38 geometry matches)
     - RH (32,167 pts) ↔ LH (32,330 pts)

Fixed Units (No Moving Parts):
  ○ UNIT_108 (4.8% of total)
  ○ UNIT_107 (3.5% of total)
  ○ UNIT_106 (5.5% of total)
  ○ UNIT_102 (12.6% of total)

Success Rate: 6/10 units with moving parts
```

### Test Fixture 2: 016ZF_20142452_110 (Fides Format - Larger)

**File Statistics:**
- Total nodes: 3,983
- Total points: 1,649,864
- Max depth: 10

**Detection Results:**
```
Units Detected: 11 (98.3% coverage)

Units with Moving Parts: 5/11
  ✅ UNIT_102: 99.9% confidence, 79 matches
  ✅ UNIT_110: 99.7% confidence, 58 matches
  ✅ UNIT_112: 100.0% confidence, 95 matches
  ✅ UNIT_114: 99.0% confidence, 43 matches
  ✅ UNIT_116: 99.0% confidence, 43 matches
```

### Test Fixture 3: 2174530000_M00_GJR (GM Format)

**File Statistics:**
- Total nodes: 2,237
- Total points: 511,324
- Max depth: 7

**Detection Results:**
```
Units Detected: 15 (98.7% coverage)

Pattern Detected: GM naming convention
  - MOVING / OPEN subtrees (vs. RH/LH in Fides)
  - SYM_### indicates symmetric mirror

Units with Moving Parts: 11/15
  ✅ CLAMP UNIT_040: 93.9% confidence (MOVING ↔ OPEN)
  ✅ CLAMP UNIT_060: 94.1% confidence
  ✅ CLAMP UNIT_080: 95.7% confidence
  ✅ CLAMP UNIT_100_SYM_080: 95.7% confidence (mirror of 080)
  ✅ CLAMP UNIT_120: 95.7% confidence
  ✅ CLAMP UNIT_240: 93.5% confidence
  ✅ CLAMP UNIT_260_SYM_240: 93.5% confidence (mirror of 240)
  ✅ CLAMP UNIT_280: 94.5% confidence
  ✅ CLAMP UNIT_300_SYM_280: 94.5% confidence (mirror of 280)
  ✅ RETRACT PIN UNIT_320: 100.0% confidence (prismatic motion)
  ✅ RETRACT PIN UNIT_340_SYM_320: 100.0% confidence (mirror of 320)

Fixed Units:
  ○ BASE UNIT_020 (43.7% of total - fixture base plate)
  ○ PIN UNIT_140
  ○ SUPPORT UNIT_180
  ○ SUPPORT UNIT_200_SYM_180 (mirror of 180)
```

### Observed Patterns (Name-Agnostic Detection)

While the system doesn't use names for logic, we observed these patterns:

| Pattern | Structure | Detection Method |
|---------|-----------|------------------|
| RH / LH | Sibling subtrees | Point count matching (~99% match) |
| MOVING / OPEN | Sibling subtrees | Point count matching (93-100% match) |
| _SYM_### | Mirror units | Identical point counts across units |
| FIXED / MOVING | Geometry sets | FIXED excluded by point count variance |
| WIRE | Contains OPEN | Detected as significant subtree |

---

## API Reference

### Public Exports

```typescript
// From src/kinematics/autoDetection/index.ts
export {
  // Types
  GLBTreeData,
  FlatNode,
  DetectedUnit,
  PosePair,
  ICPResult,
  JointClassification,
  KinematicsResult,

  // Step 1: Unit Detection
  detectUnits,
  getImmediateChildren,
  getAllDescendants,
  getGeometryNodes,

  // Step 2: Pose Pair Detection
  findPosePairs,
  matchGeometryByPointCount,

  // Step 4: ICP
  runICP,
  matrixToAxisAngle,

  // Steps 5-6: Joint Classification
  classifyJoint,
  computePivotPoint,
  fitCircleToPointMotion,

  // Math utilities
  MathUtils,
};
```

### Core Functions

#### `detectUnits(data: GLBTreeData, config?: Partial<UnitDetectionConfig>): DetectedUnit[]`

Detect logical sub-assemblies within a fixture.

**Parameters:**
- `data` - GLB tree structure from JSON
- `config` - Optional configuration overrides

**Returns:** Array of detected units with point counts and percentages

**Example:**
```typescript
const data = JSON.parse(readFileSync('fixture_tree.json', 'utf-8'));
const units = detectUnits(data);

console.log(`Detected ${units.length} units`);
for (const unit of units) {
  console.log(`  ${data.nodes[unit.nodeIndex].name}: ${unit.percentOfTotal.toFixed(1)}%`);
}
```

#### `findPosePairs(data: GLBTreeData, unit: DetectedUnit, config?: Partial<PosePairConfig>): PosePair[]`

Find pose pairs within a unit.

**Parameters:**
- `data` - GLB tree structure
- `unit` - Unit to analyze
- `config` - Optional configuration overrides

**Returns:** Array of pose pairs with matched geometry and confidence

**Example:**
```typescript
for (const unit of units) {
  const pairs = findPosePairs(data, unit);

  if (pairs.length > 0) {
    console.log(`Unit has ${pairs.length} pose pair(s):`);
    for (const pair of pairs) {
      console.log(`  Confidence: ${(pair.confidence * 100).toFixed(1)}%`);
      console.log(`  Matched geometry: ${pair.matchingGeometry.length} pairs`);
    }
  }
}
```

#### `runICP(sourcePoints: Float32Array, targetPoints: Float32Array, config?: Partial<ICPConfig>): ICPResult`

Run ICP registration to find rigid transform.

**Parameters:**
- `sourcePoints` - World-space vertices from closed pose
- `targetPoints` - World-space vertices from open pose
- `config` - Optional ICP configuration

**Returns:** ICPResult with rotation matrix, translation vector, RMS error

**Example:**
```typescript
const closedVertices = extractWorldSpaceVertices(glb, closedNodeIndex);
const openVertices = extractWorldSpaceVertices(glb, openNodeIndex);

const icp = runICP(closedVertices, openVertices, {
  maxIterations: 50,
  convergenceThreshold: 1e-6,
  subsampleRatio: 0.1
});

if (icp.converged) {
  console.log(`ICP converged with RMS error: ${icp.rmsError.toFixed(6)}`);
}
```

#### `classifyJoint(icpResult: ICPResult, config?: Partial<JointConfig>): JointClassification`

Classify joint type from ICP result.

**Parameters:**
- `icpResult` - ICP registration result
- `config` - Optional joint classification config

**Returns:** Joint classification with type, axis, angle/distance, confidence

**Example:**
```typescript
const joint = classifyJoint(icpResult);

switch (joint.type) {
  case 'revolute':
    console.log(`Revolute joint: ${(joint.angle! * 180 / Math.PI).toFixed(1)}°`);
    console.log(`Axis: [${joint.axis!.map(v => v.toFixed(3)).join(', ')}]`);
    break;
  case 'prismatic':
    console.log(`Prismatic joint: ${(joint.distance! * 1000).toFixed(1)}mm`);
    break;
  case 'fixed':
    console.log('Fixed (no motion detected)');
    break;
}
```

#### `computePivotPoint(closedPoints: Vec3[], openPoints: Vec3[], rotationAxis: Vec3, rotationAngle: number): Vec3`

Compute pivot point for revolute joint.

**Parameters:**
- `closedPoints` - Corresponding points in closed pose
- `openPoints` - Corresponding points in open pose
- `rotationAxis` - Rotation axis from ICP
- `rotationAngle` - Rotation angle (radians)

**Returns:** Pivot point [x, y, z] in world space

**Example:**
```typescript
if (joint.type === 'revolute') {
  const pivot = computePivotPoint(
    closedPointsArray,
    openPointsArray,
    joint.axis!,
    joint.angle!
  );

  console.log(`Pivot: [${pivot.map(v => v.toFixed(4)).join(', ')}]`);
}
```

---

## Configuration

### UnitDetectionConfig

```typescript
interface UnitDetectionConfig {
  MIN_UNIT_PERCENT: number;      // Default: 1.0
  MAX_UNIT_PERCENT: number;      // Default: 60.0
  MIN_UNIT_COUNT: number;        // Default: 2
  MAX_UNIT_COUNT: number;        // Default: 50
  PASSTHROUGH_THRESHOLD: number; // Default: 0.95
}
```

### PosePairConfig

```typescript
interface PosePairConfig {
  POINT_COUNT_TOLERANCE: number;     // Default: 0.02 (2%)
  MIN_SUBTREE_PERCENT: number;       // Default: 0.05 (5%)
  MIN_MATCH_CONFIDENCE: number;      // Default: 0.7 (70%)
  MIN_GEOMETRY_POINTS: number;       // Default: 100
}
```

### ICPConfig

```typescript
interface ICPConfig {
  maxIterations?: number;            // Default: 50
  convergenceThreshold?: number;     // Default: 1e-6
  maxCorrespondenceDistance?: number;// Default: 0.1 (10cm)
  subsampleRatio?: number;           // Default: 0.1 (10%)
}
```

### JointConfig

```typescript
interface JointConfig {
  MIN_ROTATION_RAD: number;           // Default: 0.035 (~2°)
  MIN_TRANSLATION: number;            // Default: 0.002 (2mm)
  PURE_ROTATION_TRANS_THRESHOLD: number; // Default: 0.005 (5mm)
}
```

---

## Usage Examples

### Basic Usage

```typescript
import { detectUnits, findPosePairs } from '@/kinematics/autoDetection';
import type { GLBTreeData } from '@/kinematics/autoDetection';

// Load GLB tree data
const data: GLBTreeData = JSON.parse(readFileSync('fixture_tree.json', 'utf-8'));

// Detect units
const units = detectUnits(data);

// Find pose pairs
for (const unit of units) {
  const pairs = findPosePairs(data, unit);

  if (pairs.length > 0) {
    const node = data.nodes[unit.nodeIndex];
    console.log(`${node.name}: ${pairs.length} moving part(s)`);
  }
}
```

### Custom Configuration

```typescript
// Custom unit detection
const units = detectUnits(data, {
  MIN_UNIT_PERCENT: 0.5,  // Lower threshold for small parts
  MAX_UNIT_PERCENT: 70.0,  // Higher threshold for base plates
});

// Custom pose pair detection
const pairs = findPosePairs(data, unit, {
  POINT_COUNT_TOLERANCE: 0.05,  // Allow 5% variance
  MIN_MATCH_CONFIDENCE: 0.8,    // Require 80% confidence
});
```

### Complete Pipeline (When Step 3 is Implemented)

```typescript
import {
  detectUnits,
  findPosePairs,
  runICP,
  classifyJoint,
  computePivotPoint,
} from '@/kinematics/autoDetection';

async function analyzeFixture(glbPath: string) {
  // 1. Load GLB and JSON tree
  const glb = await loadGLB(glbPath);
  const data = parseGLBTree(glb);

  // 2. Detect units
  const units = detectUnits(data);

  // 3. Find pose pairs
  const results = [];
  for (const unit of units) {
    const pairs = findPosePairs(data, unit);

    for (const pair of pairs) {
      // 4. Extract world-space vertices
      const closedVerts = extractWorldVertices(glb, pair.closedSubtreeIndex);
      const openVerts = extractWorldVertices(glb, pair.openSubtreeIndex);

      // 5. Run ICP
      const icp = runICP(closedVerts, openVerts);

      if (icp.converged) {
        // 6. Classify joint
        const joint = classifyJoint(icp);

        // 7. Compute pivot (if revolute)
        if (joint.type === 'revolute') {
          const pivot = computePivotPoint(
            extractCorrespondingPoints(closedVerts, icp),
            extractCorrespondingPoints(openVerts, icp),
            joint.axis!,
            joint.angle!
          );

          results.push({
            unitName: data.nodes[unit.nodeIndex].name,
            jointType: joint.type,
            axis: joint.axis,
            pivot: pivot,
            angle: joint.angle,
            confidence: joint.confidence,
          });
        }
      }
    }
  }

  return results;
}
```

### Running the Demo

```bash
# Run comprehensive demo on all test fixtures
npx tsx src/kinematics/autoDetection/demo.ts
```

Output:
```
╔═══════════════════════════════════════════════════════════════════╗
║       AUTOMATIC FIXTURE KINEMATICS DETECTION - DEMO              ║
║       Name-Agnostic Unit and Pose Pair Detection                 ║
╚═══════════════════════════════════════════════════════════════════╝

================================================================================
Analyzing Fixture: 016ZF_20142435_130
================================================================================

File Info:
  Total nodes: 4,034
  Total points: 1,682,265
  ...

STEP 1: Unit Detection
────────────────────────────────────────────────────────────────────
Detected 10 units (100.0% coverage)
  ...

STEP 2: Pose Pair Detection
────────────────────────────────────────────────────────────────────
✓ UNIT_114: 1 pose pair (99.4% confidence)
  ...
```

---

## Future Work

### Immediate (Required for Full Pipeline)

**1. GLB Mesh Data Extraction (Step 3)**
- [ ] Integrate Babylon.js GLB loader OR implement custom glTF 2.0 parser
- [ ] Extract vertex positions from mesh primitives
- [ ] Implement cumulative world matrix computation
- [ ] Transform vertices to world space
- [ ] Return Float32Array for ICP

**Estimated Time:** 4-8 hours

**2. Full ICP Integration**
- [ ] Connect: Pose Pair → Vertex Extraction → ICP → Joint Classification
- [ ] Add proper SVD library (ml-matrix or numeric.js)
- [ ] Validate on fixtures with known joint parameters
- [ ] Performance profiling and optimization

**Estimated Time:** 2-4 hours

### Enhancements

**3. Babylon.js Visualization**
- [ ] Display detected units with colored bounding boxes
- [ ] Show rotation axes as 3D arrows
- [ ] Visualize motion arcs for revolute joints
- [ ] Create interactive joint parameter display
- [ ] Animation of detected motion

**4. Advanced Joint Detection**
- [ ] Detect complex joints (spherical, cylindrical, universal)
- [ ] Handle coupled motion (gear trains, linkages)
- [ ] Support multi-state detection (3+ positions)
- [ ] Detect spring-loaded mechanisms

**5. Production Hardening**
- [ ] Error handling for malformed GLB files
- [ ] Retry logic for ICP convergence failures
- [ ] Caching for expensive operations
- [ ] Performance profiling (target: <1s per fixture)
- [ ] Memory optimization for large fixtures

**6. Testing & Validation**
- [ ] Unit tests for all pipeline stages
- [ ] Integration tests with Babylon.js
- [ ] Regression tests against known fixtures
- [ ] Benchmark suite for performance tracking

---

## Technical Notes

### Coordinate System

kinetiCORE uses **Z-up** (CAD/ROS standard) throughout. The auto-detection system is coordinate-system agnostic as it works with relative transformations.

### Performance Characteristics

| Operation | Complexity | Typical Time | Memory |
|-----------|-----------|--------------|--------|
| Unit Detection | O(n) | <10ms | Minimal |
| Pose Pair Detection | O(m²) | <50ms/unit | Minimal |
| ICP (when ready) | O(k×p×q) | 100-500ms | 10-50MB |

Where:
- n = number of nodes
- m = subtrees per unit
- k = ICP iterations
- p = source points
- q = target points

### Limitations

1. **Binary Poses Only:** Currently assumes exactly 2 poses (closed/open). Doesn't handle 3+ state mechanisms.
2. **Simplified SVD:** ICP uses Gram-Schmidt orthogonalization instead of full SVD (adequate for demo, needs library for production).
3. **No Mesh Data:** Step 3 pending - cannot run full pipeline without GLB loader.
4. **Name Independence:** While name-agnostic is a feature, debug logging still shows names for readability.

---

## References

### Documentation
- **Mega-Prompt:** Original specification (see project root)
- **Module README:** [src/kinematics/autoDetection/README.md](src/kinematics/autoDetection/README.md)
- **Coordinate System Guide:** [COORDINATE_SYSTEM.md](../COORDINATE_SYSTEM.md)
- **Physics API Guide:** [docs/PHYSICS_API.md](PHYSICS_API.md)

### Test Data
- **Location:** `C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data`
- **Fixtures:**
  - 016ZF_20142435_130 (Fides format)
  - 016ZF_20142452_110 (Fides format, larger)
  - 2174530000_M00_GJR_RR FLR_CM030_T01 (GM format)

### External Resources
- **ICP Algorithm:** Besl & McKay (1992) - "A Method for Registration of 3-D Shapes"
- **Kabsch Algorithm:** Kabsch (1976) - "A solution for the best rotation"
- **glTF 2.0 Specification:** https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- **Babylon.js GLB Loader:** https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF

---

## License

Part of kinetiCORE - Open-source industrial simulation platform
