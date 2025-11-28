# Batch Fixture Validation Approach

## Overview

The batch validation harness ([scripts/runBatchFixtureValidation.ts](../scripts/runBatchFixtureValidation.ts)) tests the **name-agnostic auto-kinematics detection pipeline** across 9 diverse industrial fixtures to prove robustness and generalizability.

## Validation Goals

1. **Zero Name Dependencies**: Prove detection works purely on geometric structure (point cloud matching via ICP RMS) without relying on naming conventions
2. **Arbitrary Origin Handling**: Validate the Three-Step Pivot Method correctly handles cases where node origins ≠ pivot points
3. **Pivot Offset Verification**: Confirm detected `anchorWorld` (pivot) differs from `childNode.position` (world zero)
4. **Automated Reporting**: Generate comprehensive Markdown summary tables

## Dataset (9 Fixtures)

| Fixture ID | Type | Description |
|------------|------|-------------|
| 2174530000_M00 | GM_Clamp | General Motors clamp fixture |
| 8X-140 | Fides_Clamp | Fides industrial clamp (base model) |
| 8X-140-1E1 | Fides_Clamp_LH | Fides clamp (left-hand variant) |
| 8X-140-2E1 | Fides_Clamp_RH | Fides clamp (right-hand variant) |
| 016ZF_130 | Retract_Pin | Retractable pin fixture (variant 130) |
| 016ZF_110 | Retract_Pin | Retractable pin fixture (variant 110) |
| 2172493000 | Complex_Assy | Complex dashboard assembly BQ010 |
| 2172504000 | Complex_Assy | Complex dashboard assembly BQ020 |
| 2172520000 | Complex_Assy | Complex dashboard assembly BQ040 |

## Pipeline Stages

The validation runs each fixture through the complete 6-step pipeline:

### Step 1: Unit Detection
- Detects rigid clusters (units) using geometry similarity
- No name-based logic

### Step 2: Pose Pair Detection
- Finds matching geometry between two poses (e.g., OPEN vs CLOSED)
- Uses point count matching with tolerance (geometry-based)
- **Critical**: NO node name matching

### Step 3: Vertex Extraction
- Extracts point clouds from detected pose pairs
- Subsamples to 10% for performance

### Step 4: ICP Registration
- Aligns retracted → extended point clouds
- Computes rigid transformation matrix
- Returns RMS error as quality metric

### Step 5: Joint Classification
- Decomposes ICP transform into rotation + translation
- Classifies as:
  - **Hinge**: rotation > threshold (≈1°)
  - **Prismatic**: translation > threshold (≈5mm), no rotation
  - **Fixed**: no significant motion

### Step 6: Pivot Computation
- For **hinge joints**: Uses Orbit-Based Pivot Solver
  - Generates orbits by repeatedly applying T_icp
  - Fits 2D circle to each orbit via PCA plane + Kåsa method
  - Combines pivot estimates with weighted average
- For **prismatic joints**: Uses mean of retracted points as anchor

## Pivot Offset Verification

**Why it matters**: The Three-Step Pivot Method (see [PIVOT_OFFSET_INTEGRATION.md](PIVOT_OFFSET_INTEGRATION.md)) was designed to handle arbitrary node origins that don't coincide with the physical pivot point.

For each detected hinge joint:

```typescript
// 1. Get detected pivot (anchorWorld)
const pivotWorld: Vec3 = [x, y, z];

// 2. Get child node's world origin
const childOrigin = childNode.getAbsolutePosition();

// 3. Calculate offset distance
const offsetDistance = Vector3.Distance(pivotWorld, childOrigin);

// 4. Verify offset is active (> 1cm threshold)
const offsetActive = offsetDistance > 0.01;
```

**Interpretation**:
- ✅ `offsetActive = true` → Pivot logic correctly handled non-zero origin (robust algorithm)
- ⚠️ `offsetActive = false` → Node origin was at/near pivot (easier case, doesn't test full robustness)

## Name-Agnostic Verification

```typescript
function isNameAgnosticDetection(nodeName: string): boolean {
  // Check if name lacks conventional suffixes
  const hasConventionalSuffix = /_OPEN|_MOVING|_CLOSE|_EXTENDED|_RETRACTED/i.test(nodeName);
  return !hasConventionalSuffix;
}
```

If a node lacks standardized naming (e.g., "Part_123" instead of "Clamp_OPEN"), and detection still succeeds, this proves the algorithm is truly name-agnostic.

## Output Metrics

### Summary Table

| Fixture ID | Status | Joints Found | Type(s) | Pivot Conf | Offset Active? | Name-Agnostic? |
|------------|--------|--------------|---------|------------|----------------|----------------|
| 016ZF_130 | ✅ PASS | 1 | 1H | 0.98 | ✅ (1) | ✅ (1/1) |
| ... | ... | ... | ... | ... | ... | ... |

**Legend**:
- **Type(s)**: `nH` = n Hinge joints, `nP` = n Prismatic joints
- **Pivot Conf**: Average confidence score (0-1) from ICP error
- **Offset Active?**: Number of joints with offset > 1cm
- **Name-Agnostic?**: Fraction of joints detected without naming conventions

### Detailed Per-Joint Metrics

For each detected joint:
- Node name
- Joint type (Hinge/Prismatic)
- Pivot confidence
- Offset distance (mm)
- Offset active (YES/NO)
- RMS error from ICP
- Name-agnostic detection (YES/NO)

## Success Criteria

**PASS** if:
1. ✅ All fixtures detect expected joints (no false negatives)
2. ✅ No name-based detection logic used (`/_OPEN|_MOVING/` patterns)
3. ✅ Pivot offset correctly computed for non-zero origins
4. ✅ ICP RMS error < 1cm for all converged joints
5. ✅ Confidence scores > 0.3 for all detected joints

**FAIL** if:
1. ❌ Missing joints due to lack of naming conventions
2. ❌ Name-based logic found in primary detection path
3. ❌ Pivot computation fails for arbitrary origins
4. ❌ High ICP errors (> 1cm RMS)

## Running the Validation

```bash
# Execute batch validation
npx tsx scripts/runBatchFixtureValidation.ts

# Output: BATCH_VALIDATION_REPORT.md
```

## Implementation Notes

### GLB Loading in Node.js

Babylon.js `SceneLoader.AppendAsync` expects browser APIs. For Node.js:

```typescript
// Read GLB file
const glbData = fs.readFileSync(glbPath);
const arrayBuffer = glbData.buffer.slice(glbData.byteOffset, glbData.byteOffset + glbData.byteLength);

// Convert to base64 data URL
const blob = Buffer.from(arrayBuffer).toString('base64');
const dataUrl = `data:model/gltf-binary;base64,${blob}`;

// Load with Babylon NullEngine
await BABYLON.SceneLoader.AppendAsync('', dataUrl, scene, undefined, '.glb');
```

### XMLHttpRequest Polyfill

```typescript
// @ts-ignore
global.XMLHttpRequest = class XMLHttpRequest {
  open() {}
  send() {}
  addEventListener() {}
};
```

## Related Documentation

- [AUTOMATIC_KINEMATICS_DETECTION.md](AUTOMATIC_KINEMATICS_DETECTION.md) - Full pipeline specification
- [PIVOT_OFFSET_INTEGRATION.md](PIVOT_OFFSET_INTEGRATION.md) - Three-Step Pivot Method details
- [PHASE2_REAL_FIXTURE_VALIDATION.md](../PHASE2_REAL_FIXTURE_VALIDATION.md) - Original validation plan

## Future Enhancements

1. **Parallel Processing**: Run fixtures concurrently to reduce total validation time
2. **Visual Diff**: Generate side-by-side images showing detected pivots overlaid on 3D models
3. **Regression Testing**: Add to CI/CD pipeline to catch regressions automatically
4. **Fixture Fingerprinting**: Store expected joint counts per fixture for stricter validation
