# Auto-Kinematics Pipeline Documentation

---

## ⚠️ PROTECTED PIPELINE – DO NOT MODIFY WITHOUT RUNNING U112 GOLD TESTS ⚠️

This pipeline defines the canonical expected behavior for all kinetiCORE tooling fixtures.
It is validated against the **U112 Gold Standard** reference fixture:

**Fixture**: `016ZF_20142435_140_1E1_CI00_U112.glb`
- UNIT_101: Fixed gripper frame
- UNIT_112: Revolute joint, 90° stroke

**Before modifying ANY pipeline logic:**
1. Run gold tests: `npm test -- --run tests/gold/u112-gold.test.ts`
2. Verify 34 unit tests pass: `npm test -- --run --testNamePattern="ToolingFixtureAnimator"`
3. Review: [`fixtures/gold/u112/DOCS/reference_notes.md`](../../fixtures/gold/u112/DOCS/reference_notes.md)

**Status**: ✅ PASSING (34 unit tests)

**Protected Files**:
- `src/babylon/pipeline/ToolingFixtureAnimator.ts`
- `src/babylon/pipeline/KinematicExtractionPipeline.ts`
- `src/babylon/sceneAnalysis/StructureBasedToolAnalyzer.ts`
- `src/kinematics/toolingKinematicsAdapter.ts`
- `src/math/icp/IcpFitter.ts`

---

## Overview

The Auto-Kinematics Pipeline automatically extracts kinematic joint definitions from tooling fixture GLB files by analyzing two physical states (retracted and extended) and using ICP (Iterative Closest Point) fitting to determine joint parameters.

**Key Files:**
- [`src/babylon/pipeline/ToolingFixtureAnimator.ts`](../../src/babylon/pipeline/ToolingFixtureAnimator.ts) - Orchestration layer
- [`src/babylon/pipeline/KinematicExtractionPipeline.ts`](../../src/babylon/pipeline/KinematicExtractionPipeline.ts) - Core pipeline
- [`src/ui/components/ToolingFixtureAnimatorPanel.tsx`](../../src/ui/components/ToolingFixtureAnimatorPanel.tsx) - UI integration

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ToolingFixtureAnimator                           │
│                    (Orchestration Layer)                            │
├─────────────────────────────────────────────────────────────────────┤
│  Step 1: analyzeFixture()                                           │
│    └─> Detects UNIT_* nodes, classifies fixed vs moving             │
│                                                                     │
│  Step 2a: captureRetractedState()                                   │
│    └─> Samples point clouds in home position                        │
│                                                                     │
│  Step 2b: captureExtendedState()                                    │
│    └─> Samples point clouds in actuated position                    │
│                                                                     │
│  Step 3: fitJoints()                                                │
│    └─> ICP aligns point clouds, extracts rotation/pivot             │
│                                                                     │
│  Step 4: setupAnimation()                                           │
│    └─> Converts joints to ValveBank channels                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                KinematicExtractionPipeline                          │
│                (Core Processing Engine)                             │
├─────────────────────────────────────────────────────────────────────┤
│  • Structure-based unit detection (vs name-based)                   │
│  • Point cloud sampling from mesh geometry                          │
│  • ICP rigid body alignment                                         │
│  • Rotation decomposition: θ = arccos((trace(R) - 1) / 2)           │
│  • Pivot solve: (I - R)c = t                                        │
│  • Legacy JSON export for compatibility                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Workflow States

```
idle ──▶ analyzed ──▶ retracted_captured ──▶ extended_captured ──▶ joints_fitted ──▶ ready_to_play
```

| State | Description | Next Action |
|-------|-------------|-------------|
| `idle` | Initial state | Call `analyzeFixture()` |
| `analyzed` | Units detected | Call `captureRetractedState()` |
| `retracted_captured` | Home position captured | **Manually** move parts in 3D viewport (gizmo or Motion Panel slider), then call `captureExtendedState()` |
| `extended_captured` | Both states captured | Call `fitJoints()` |
| `joints_fitted` | Joints extracted | Call `setupAnimation()` |
| `ready_to_play` | ValveBank configured | Call `playDemoCycle()` |

## Usage

### Guided Workflow (Recommended)

```typescript
import { ToolingFixtureAnimator } from '@/babylon/pipeline/ToolingFixtureAnimator';

const animator = new ToolingFixtureAnimator({
  scene,
  rootNode: fixtureRoot,  // The UNIT_* containing transform node
});

// Step 1: Analyze fixture structure
const analysis = await animator.analyzeFixture();
if (!analysis.success) {
  console.error('Analysis failed:', analysis.error);
  return;
}
console.log('Fixed units:', analysis.fixedUnits.map(u => u.name));
console.log('Moving units:', analysis.movingUnits.map(u => u.name));

// Step 2a: Capture retracted state (parts at home position)
const retracted = await animator.captureRetractedState();
if (!retracted.success) {
  console.error('Retract capture failed:', retracted.error);
  return;
}

// [User MANUALLY moves parts to extended position in 3D viewport using transform gizmo]
// NOTE: No auto-rotation is provided. The user must physically move the clamp geometry.

// Step 2b: Capture extended state (parts actuated)
const extended = await animator.captureExtendedState();
if (!extended.success) {
  console.error('Extend capture failed:', extended.error);
  return;
}

// Step 3: Fit joints via ICP
const fit = await animator.fitJoints();
if (!fit.success) {
  console.error('Joint fitting failed:', fit.error);
  return;
}

// Inspect individual joint results
for (const detail of fit.details) {
  if (detail.success) {
    console.log(`✓ ${detail.unitName}: ${detail.jointType}, ${detail.angleDeg.toFixed(1)}°`);
  } else {
    console.warn(`✗ ${detail.unitName}: ${detail.reason}`);
  }
}

// Step 4: Setup animation
animator.setupAnimation();

// Play demo cycle
await animator.playDemoCycle();
```

### Precomputed JSON Workflow

```typescript
import { ToolingFixtureAnimator } from '@/babylon/pipeline/ToolingFixtureAnimator';

// Use precomputed tooling JSON (skips extraction)
const animator = new ToolingFixtureAnimator({
  scene,
  rootNode: fixtureRoot,
  toolingJson: loadedToolingJson,  // From .json file
});

await animator.prepare();
await animator.playDemoCycle();
```

## Result Types

### AnalysisResult
```typescript
interface AnalysisResult {
  success: boolean;
  fixedUnits: ToolUnit[];   // Units that don't move (bases, frames)
  movingUnits: ToolUnit[];  // Units that move (clamps, grippers)
  error?: string;           // Failure reason if !success
}
```

### CaptureResult
```typescript
interface CaptureResult {
  success: boolean;
  pointCounts: Record<string, number>;  // Points per unit
  totalPoints: number;                   // Total sampled points
  error?: string;
}
```

### FitJointsResult
```typescript
interface FitJointsResult {
  success: boolean;
  jointCount: number;
  joints: JointDefinitionOutput[];
  details: JointFitResultInfo[];  // Per-unit fitting details
  error?: string;
}
```

### JointFitResultInfo
```typescript
interface JointFitResultInfo {
  unitId: string;
  unitName: string;
  success: boolean;
  jointType: 'hinge' | 'prismatic' | 'none';
  angleDeg: number;         // Rotation magnitude in degrees
  angleRad: number;         // Rotation magnitude in radians
  axis: { x, y, z };        // Rotation axis (unit vector)
  pivot: { x, y, z };       // Pivot point in world space
  confidence: number;       // 0-1 confidence score
  rmsErrorMm: number;       // ICP RMS error in millimeters
  reason?: string;          // Failure reason if !success
}
```

## Error Handling

The pipeline uses **structured result types** instead of thrown exceptions. Each method returns a result object with:
- `success: boolean` - Whether the operation succeeded
- `error?: string` - Human-readable failure reason if `!success`

### Common Failure Scenarios

| Error | Cause | Solution |
|-------|-------|----------|
| "No units detected" | Root node doesn't contain `UNIT_*` children | Check GLB structure |
| "No points captured" | Mesh has no geometry or is empty | Verify mesh data |
| "No motion detected" | Points didn't move between states | Move parts further |
| "Below MIN_ROTATION" | Angle < 0.5° threshold | Ensure sufficient rotation |

### Guard Clause Pattern

All methods use early-return guard clauses:

```typescript
async captureRetractedState(): Promise<CaptureResult> {
  // Guard: Must analyze first
  if (this.workflowState === 'idle') {
    const error = 'Must call analyzeFixture() before capturing states';
    console.error('[ToolingFixtureAnimator]', error);
    return { success: false, pointCounts: {}, totalPoints: 0, error };
  }

  // Guard: Pipeline must be initialized
  if (!this.pipeline) {
    const error = 'Pipeline not initialized';
    console.error('[ToolingFixtureAnimator]', error);
    return { success: false, pointCounts: {}, totalPoints: 0, error };
  }

  // ... actual processing
}
```

## ICP Fitting Algorithm

### Math Primer

Given two point clouds P (retracted) and Q (extended), ICP finds the optimal rigid transform `(R, t)` such that:

```
Q ≈ R·P + t
```

**Rotation Extraction:**
```
θ = arccos((trace(R) - 1) / 2)
```

**Axis Extraction:**
From skew-symmetric part of R:
```
axis = [R₃₂ - R₂₃, R₁₃ - R₃₁, R₂₁ - R₁₂] / (2·sin(θ))
```

**Pivot Solve:**
For pure rotation about pivot c:
```
(I - R)·c = t
```
Solve via least squares or SVD.

### Classification

| Condition | Joint Type |
|-----------|------------|
| θ ≥ MIN_ROTATION (0.5°) | `hinge` |
| θ < MIN_ROTATION && ‖t‖ > MIN_TRANSLATION | `prismatic` |
| Otherwise | `none` (no motion) |

## Structured Logging

All operations emit structured logs with the prefix `[ToolingFixtureAnimator]`:

```
[ToolingFixtureAnimator] ========== STEP 1: ANALYZE FIXTURE ==========
[ToolingFixtureAnimator] Root node: { name: "016ZF_...", id: "..." }
[ToolingFixtureAnimator] Analysis Result: { totalUnits: 2, fixedCount: 1, movingCount: 1 }
[ToolingFixtureAnimator] ========== STEP 2a: CAPTURE RETRACTED STATE ==========
[ToolingFixtureAnimator] Captured: { unitName: "UNIT_112", pointCount: 4523 }
```

## Testing

### Unit Tests
Located in [`tests/babylon/pipeline/ToolingFixtureAnimator.test.ts`](../../tests/babylon/pipeline/ToolingFixtureAnimator.test.ts)

Test coverage includes:
- Happy path: hinge joint detection
- Edge case: no motion between states
- Edge case: rotation below MIN_ROTATION threshold
- Error bubbling: invalid workflow state transitions
- Structured result validation

### E2E Tests
Located in [`tests/babylon/pipeline/ToolingFixtureAnimator.e2e.test.ts`](../../tests/babylon/pipeline/ToolingFixtureAnimator.e2e.test.ts)

Tests real GLB loading and animation playback.

### Running Tests

```bash
# Run all ToolingFixtureAnimator tests
npm test -- --testPathPattern="ToolingFixtureAnimator"

# Run with verbose output
npm test -- --testPathPattern="ToolingFixtureAnimator" --verbose
```

## UI Integration

The [`ToolingFixtureAnimatorPanel`](../../src/ui/components/ToolingFixtureAnimatorPanel.tsx) component provides a guided wizard interface:

1. **Analyze** - Shows detected units (fixed vs moving)
2. **Capture Retracted** - Capture home position point clouds
3. **[User moves clamp manually in 3D viewport]** - Instructions displayed between captures
4. **Capture Extended** - Capture actuated position point clouds
5. **Fit Joints** - ICP fitting shows per-joint success/failure with details
6. **Play Animation** - Demo cycle button

**Important:** The UI does **not** provide automatic rotation helpers. Users must manually move clamps using the transform gizmo or Motion Panel slider (once joints are registered).

Error states are displayed inline with specific failure reasons and actionable recovery hints.

## Known Limitations

1. **Single axis rotation only** - Complex multi-DOF joints not supported
2. **MIN_ROTATION threshold** - Very small rotations (< 0.5°) classified as no motion
3. **Point cloud sampling** - Default stride may miss fine details
4. **Structure-based detection** - Requires `UNIT_*` naming convention

## Future Enhancements

- [ ] Support for prismatic + hinge combined joints
- [ ] Confidence-based joint type auto-selection
- [ ] Visual debug overlay for ICP alignment
- [ ] Export to URDF/SDF formats
