# Auto-Kinematics Pipeline - Complete File Reference

## Overview
This document lists every file used in the automatic kinematics detection pipeline for the **8X-140-1E1_LH** fixture validation.

---

## Input Data Files

### 1. GLB File (3D Geometry)
**Path**: `C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00.glb`
- **Size**: 14 MB
- **Format**: Binary GLB (GLTF 2.0)
- **Contents**: 3D meshes, materials, textures
- **Nodes**: 1,541 transform nodes
- **Used by**: Babylon.js SceneLoader → vertex extraction (Step 3)

### 2. JSON Tree File (Pre-processed Hierarchy)
**Path**: `C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00_tree.json`
- **Size**: 198,739 lines
- **Format**: JSON
- **Contents**:
  - Node hierarchy (parent/child relationships)
  - Point counts per node
  - Bounding box data
- **Total Points**: 517,612 vertices
- **Used by**: Unit detection (Step 1), Pose pair detection (Step 2)

---

## Pipeline Source Files

### Core Auto-Detection Module (`src/kinematics/autoDetection/`)

#### 3. `index.ts` - Main Entry Point
**Role**: Exports all pipeline functions
```typescript
export { detectUnits } from './unitDetection.js';
export { findPosePairs } from './posePairDetection.js';
export { extractPosePairVertices } from './vertexExtraction.js';
export { runICP } from './icp.js';
export { classifyJoint } from './jointClassification.js';
export { computePivotPoint, matrixToAxisAngle } from './mathUtils.js';
export * from './types.js';
```

#### 4. `types.ts` - Type Definitions
**Role**: TypeScript interfaces for all pipeline data structures
- `GLBTreeData` - JSON tree structure
- `DetectedUnit` - Output from Step 1
- `PosePair` - Output from Step 2
- `ICPResult` - Output from Step 4
- `JointDefinition` - Final output
- `Vec3`, `Mat4` - Math primitives

#### 5. `unitDetection.ts` - STEP 1: Unit Detection
**Function**: `detectUnits(treeData: GLBTreeData): DetectedUnit[]`

**Algorithm**:
1. Find node depth with maximum total points (usually depth 1)
2. Get all nodes at that depth as unit candidates
3. Filter out nodes with < 1% of total geometry
4. Return units sorted by point count

**Output for 8X-140-1E1_LH**: 9 units
- UNIT_114: 42,253 pts (8.2%)
- UNIT_112: 48,853 pts (9.4%)
- UNIT_110: 49,683 pts (9.6%)
- UNIT_108: 6,592 pts (1.3%)
- UNIT_106: 15,361 pts (3.0%)
- UNIT_104: 15,461 pts (3.0%)
- UNIT_102: 61,209 pts (11.8%)
- UNIT_101: 229,623 pts (44.4%)
- UNIT_116: 48,577 pts (9.4%)

**Key Feature**: **Name-agnostic** - uses only geometry size, not node names

#### 6. `posePairDetection.ts` - STEP 2: Pose Pair Detection
**Function**: `findPosePairs(treeData: GLBTreeData, unit: DetectedUnit): PosePair[]`

**Algorithm**:
1. Find all child subtrees with significant geometry (> 5% of unit)
2. Group subtrees by point count (tolerance: ±5%)
3. For each group with 2 members:
   - Check if geometry nodes match (same point counts)
   - Compute confidence score
   - Return as pose pair if confidence > 80%

**Output**: Pairs of OPEN ↔ CLOSED poses

**Key Feature**: **Name-agnostic** - matches by point count, not naming conventions like "_OPEN" or "_CLOSED"

#### 7. `vertexExtraction.ts` - STEP 3: Vertex Extraction
**Function**: `extractPosePairVertices(scene: Scene, treeData: GLBTreeData, subtreeA: number, subtreeB: number): { poseA: Float32Array, poseB: Float32Array }`

**Algorithm**:
1. Traverse subtree A, collect all mesh vertices → poseA
2. Traverse subtree B, collect all mesh vertices → poseB
3. Optionally subsample (e.g., 10% for performance)
4. Return as Float32Arrays for ICP

**Dependencies**: Requires Babylon.js Scene with loaded GLB

#### 8. `icp.ts` - STEP 4: ICP Registration
**Function**: `runICP(sourcePoints: Float32Array, targetPoints: Float32Array): ICPResult`

**Algorithm**: Iterative Closest Point
1. Initialize: identity transform
2. Loop (max 50 iterations):
   - Find nearest neighbors (source → target)
   - Compute optimal rigid transform via SVD
   - Apply transform to source points
   - Calculate RMS error
   - Check convergence (< 1e-6 threshold)
3. Return: `{ transform: Mat4, rmsError: number, converged: boolean }`

**Output**: Rigid transformation matrix (retracted → extended)

#### 9. `jointClassification.ts` - STEP 5: Joint Classification
**Function**: `classifyJoint(icpResult: ICPResult): JointDefinition`

**Algorithm**:
1. Decompose transform → rotation + translation
2. Check rotation magnitude:
   - If `|rotation| > 1°` → **revolute (hinge)**
   - If `|rotation| < 1°` AND `|translation| > 5mm` → **prismatic**
   - Otherwise → **fixed** (noise)
3. Extract axis (rotation axis or translation direction)
4. Return joint type + axis + magnitude

**Thresholds**:
- MIN_ROTATION = 0.0175 rad (≈1°)
- MIN_TRANSLATION = 0.005 m (5mm)

#### 10. `mathUtils.ts` - STEP 6: Pivot Computation
**Functions**:
- `computePivotPoint(closedPts: Vec3[], openPts: Vec3[], axis: Vec3, angle: number): Vec3`
- `matrixToAxisAngle(matrix: Mat4): { axis: Vec3, angle: number }`

**Algorithm** (Orbit-Based Pivot Solver):
1. Sample 100 points from closed pose
2. For each point, generate orbit by applying ICP transform repeatedly
3. Project orbit to plane perpendicular to rotation axis
4. Fit 2D circle using Kåsa method → pivot estimate
5. Weighted average of all pivot estimates → final pivot
6. Return pivot point in world coordinates

**Key Feature**: Handles **arbitrary node origins** (Three-Step Pivot Method)

---

## Babylon.js Integration Files

### 11. `src/babylon/pointCloud/ICP.ts`
**Class**: `ICP`

**Methods**:
- `alignPointClouds(source, target)` - Main ICP algorithm
- `findClosestPoints(source, target)` - Nearest neighbor search
- `svdRigidTransform(pairs)` - Optimal transform via SVD
- `applyTransform(points, matrix)` - Matrix application

**Used by**: `icp.ts` (Step 4)

### 12. `src/babylon/pointCloud/JointExtractor.ts`
**Function**: `extractJointFromTransform(icpResult: ICPResult, retractedPoints: Vector3[]): JointFitResult`

**Role**: High-level wrapper that combines:
- Joint classification (Step 5)
- Pivot solving (Step 6)
- Confidence scoring

**Output**: `JointFitResult` with type, axis, anchor, confidence

**Used by**: Batch validation scripts

### 13. `src/babylon/kinematics/JointMath.ts`
**Functions**:
- `solveOrbitBasedPivot()` - Orbit-Based Pivot Solver
- `fitOrbitCircle()` - 2D circle fitting (Kåsa method)
- `decomposeTransform()` - Matrix → rotation + translation
- `fit2DCircle()` - Least-squares circle fit

**Used by**: `JointExtractor.ts`, `mathUtils.ts`

---

## Validation Scripts

### 14. `scripts/runSingleFixtureTest.ts`
**Purpose**: Test complete pipeline on one fixture

**Execution Flow**:
1. Load JSON tree data
2. Load GLB scene (Babylon.js)
3. Run Steps 1-6 on all detected units
4. Output:
   - Unit names + reasons
   - ICP pair node names
   - RMS error values
   - Joint types
   - Pivot points

**Usage**:
```bash
npx tsx scripts/runSingleFixtureTest.ts
```

### 15. `scripts/runBatchFixtureValidation.ts`
**Purpose**: Validate pipeline across 9 diverse fixtures

**Features**:
- Pivot offset verification (Three-Step Pivot Method)
- Name-agnostic detection validation
- Automated Markdown reporting

**Output**: `BATCH_VALIDATION_REPORT.md`

### 16. `scripts/validateRealFixtures.ts`
**Purpose**: Original Phase 2 validation script

**Fixtures Tested**:
- 016ZF_130 (Retract Pin)
- 016ZF_110 (Retract Pin)
- 2174530000_M00 (GM Clamp)

---

## Documentation Files

### 17. `docs/AUTOMATIC_KINEMATICS_DETECTION.md`
Complete pipeline specification with:
- Algorithm details for each step
- Thresholds and tolerances
- Success criteria

### 18. `docs/BATCH_VALIDATION_APPROACH.md`
Batch validation methodology:
- Dataset configuration
- Pivot offset verification logic
- Name-agnostic detection checks

### 19. `docs/PIVOT_OFFSET_INTEGRATION.md`
Three-Step Pivot Method:
- Problem: Arbitrary node origins
- Solution: Orbit-based pivot solving
- Integration with existing pipeline

---

## External Dependencies

### 20. `@babylonjs/core` (v8.35.0)
**Classes Used**:
- `Scene` - 3D scene container
- `Mesh` - Geometry data
- `Vector3` - 3D vector math
- `Matrix` - 4x4 transformation matrices
- `NullEngine` - Headless rendering engine
- `SceneLoader` - GLB file loading

### 21. `@babylonjs/loaders`
**Format Support**:
- GLB (GLTF 2.0 Binary)
- GLTF (JSON)

---

## Data Flow Diagram

```
INPUT FILES
    ↓
[1] JSON Tree
    → unitDetection.ts (Step 1)
        → DetectedUnit[] (9 units)
    → posePairDetection.ts (Step 2)
        → PosePair[] (pose matches)
    ↓
[2] GLB File
    → Babylon SceneLoader
        → Scene (meshes)
    → vertexExtraction.ts (Step 3)
        → poseA, poseB (point clouds)
    ↓
icp.ts (Step 4)
    → ICPResult (transform + RMS error)
    ↓
jointClassification.ts (Step 5)
    → JointDefinition (type + axis)
    ↓
mathUtils.ts (Step 6)
    → Pivot Point (world coordinates)
    ↓
OUTPUT
    → Joint with pivot/anchor
    → Validation reports
```

---

## File Count Summary

- **Input Files**: 2 (GLB + JSON)
- **Core Pipeline**: 8 files (index, types, steps 1-6)
- **Babylon Integration**: 3 files (ICP, JointExtractor, JointMath)
- **Validation Scripts**: 3 files
- **Documentation**: 3 files
- **External Dependencies**: 2 packages (@babylonjs/core, @babylonjs/loaders)

**Total Source Files**: 19 files
**Total LOC**: ~5,000 lines (estimated)

---

## Key Design Principles

1. **Name-Agnostic**: Steps 1-2 use only geometry (point counts), not node names
2. **Modular**: Each step is independent, testable function
3. **Arbitrary Origins**: Pivot solver handles nodes with origins at world zero
4. **Performance**: Subsampling (10%) for large point clouds
5. **Robustness**: Confidence scoring, convergence checks, error handling

---

**Last Updated**: 2025-11-26
**Pipeline Version**: Phase 2 (Complete)
**Status**: Production-Ready ✅
