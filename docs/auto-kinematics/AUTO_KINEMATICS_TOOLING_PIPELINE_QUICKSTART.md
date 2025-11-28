# Auto Kinematics Tooling Pipeline - Quick Start Guide

**Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Owner:** Cursor Agent (Integration Layer)

---

## Overview

The **ToolingFixtureAnimator** provides a thin integration layer that connects the auto-kinematics extraction pipeline to ValveBank animation. It automates the complete workflow from GLB fixture to animated joints.

**Complete Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    TOOLING FIXTURE ANIMATOR                      │
│                      Complete Pipeline Flow                     │
└─────────────────────────────────────────────────────────────────┘

INPUT: GLB Fixture File (e.g., 9X_110_GEO.glb)
  │
  ├─ Option 1: Precomputed JSON (Workflow A)
  │   └─→ Tooling JSON File (9X_110_GEO.json)
  │       └─→ ToolingFixtureAnimator (with toolingJson)
  │
  └─ Option 2: Extract from States (Workflow B/C)
      └─→ Kinematic Extraction Panel
          ├─→ Analyze Scene (detect tool units)
          ├─→ Capture Retracted States
          ├─→ Capture Extended States (manual positioning)
          ├─→ Fit Joints (ICP alignment, joint extraction)
          └─→ Export to Tooling JSON (optional, for reuse)
              └─→ ToolingFixtureAnimator (with or without toolingJson)

PROCESSING:
  └─→ toolingJsonToJoints() [converts JSON to joint definitions]
      └─→ ValveBank [creates channels for each joint]
          └─→ JointMath [computes kinematics, limits, transforms]

OUTPUT: Animated Fixture
  └─→ Timeline Events (extend/retract/hold commands)
      └─→ ValveBank.runTimeline()
          └─→ Joint transformations applied to scene nodes
              └─→ Visible clamp/pin motion in 3D scene
```

---

## Quick Start

### Using the UI (Recommended)

1. **Load a GLB fixture** in kinetiCORE
2. **Select the fixture root node** in the scene tree (e.g., `9X_110_GEO`)
3. **Open Tooling Fixture Animator Panel:**
   - Click the **"Tooling Animator"** button in the Kinematics section of the ribbon toolbar
   - Or use the panel menu
4. **Click "Auto-fit joints & play demo"**
   - The system will:
     - Run kinematic extraction (if states already captured)
     - Convert to joint definitions
     - Create ValveBank channels
     - Play a simple extend/retract cycle

**Note:** For fully automated extraction, you must first capture states using the **Kinematic Extraction Panel**:
1. Open **Kinematic Extraction Panel** (Scan icon)
2. Analyze scene
3. Capture retracted states
4. Manually position parts in extended state
5. Capture extended states
6. Fit joints
7. Then use **Tooling Fixture Animator** to animate

---

## Complete User Workflow

The ToolingFixtureAnimator pipeline supports three main workflows depending on your situation:

**Quick Decision Tree:**
```
Do you have a tooling JSON file?
├─ YES → Workflow A (Fastest - 30 sec)
└─ NO → Do you want to extract once and reuse?
    ├─ YES → Workflow B (Recommended - 5-10 min once, then 30 sec)
    └─ NO → Workflow C (Full extraction - 5-10 min each time)
```

### Workflow A: You Have Precomputed Tooling JSON (Fastest) ⚡

**Use Case:** You already have a tooling JSON file (e.g., from a previous extraction or external source).

**Steps:**
1. **Load GLB fixture** in kinetiCORE
2. **Select fixture root node** in scene tree (e.g., `9X_110_GEO`)
3. **Open Tooling Fixture Animator Panel**
   - Click "Tooling Animator" button in Kinematics section
4. **Load your tooling JSON file**
   - The panel should allow loading JSON files
   - Or use programmatic API (see below)
5. **Click "Prepare & Play Demo"**
   - System creates joints and channels from JSON
   - Plays extend/retract cycle automatically

**Time:** ~30 seconds (no extraction needed)

**Programmatic:**
```typescript
import { ToolingFixtureAnimator } from './babylon/pipeline/ToolingFixtureAnimator';
import { loadToolingJson } from './babylon/io/ToolingJsonAdapter';

// Load JSON file
const toolingJson = await loadToolingJson('path/to/9X_110_GEO.json');

// Create animator
const animator = new ToolingFixtureAnimator({
  scene,
  rootNode: fixtureRoot,
  toolingJson, // Provide JSON directly
});

// Prepare and animate
await animator.prepare();
await animator.playDemoCycle();
```

---

### Workflow B: Extract Once, Animate Many Times (Recommended) 🔄

**Use Case:** You want to extract joints once, then iterate on animation quickly.

**Phase 1: Extract Joints (One Time)**
1. **Load GLB fixture** in kinetiCORE
2. **Open Kinematic Extraction Panel** (Scan icon in toolbar)
3. **Analyze scene**
   - Click "Analyze Scene" to detect tool units
4. **Capture retracted states**
   - Parts should be in closed/retracted position
   - Click "Capture Retracted States"
5. **Manually position parts to extended state**
   - Use transform tools to move clamps/pins to open position
   - Ensure significant movement (>1cm) for good ICP alignment
6. **Capture extended states**
   - Click "Capture Extended States"
7. **Fit joints**
   - Click "Fit Joints" to run ICP alignment and joint extraction
   - Review RMS errors (should be <1cm for good quality)
8. **Export to tooling JSON**
   - Save the extracted JSON file for reuse
   - File format matches `9X_110_GEO.json` structure

**Phase 2: Animate (Many Times)**
1. **Load the same GLB fixture** (or reload if needed)
2. **Select fixture root node**
3. **Open Tooling Fixture Animator Panel**
4. **Load the saved tooling JSON** from Phase 1
5. **Click "Prepare & Play Demo"**
   - Fast setup (no extraction needed)
   - Iterate on animation timing, sequences, etc.

**Time:** 
- Phase 1: ~5-10 minutes (one-time setup)
- Phase 2: ~30 seconds per iteration

---

### Workflow C: Full Automated Extraction (Most Flexible) 🎯

**Use Case:** You want fully automated extraction without pre-saved JSON.

**Steps:**
1. **Load GLB fixture** in kinetiCORE
2. **Open Kinematic Extraction Panel** (Scan icon)
3. **Analyze scene** → Click "Analyze Scene"
4. **Capture retracted states** → Click "Capture Retracted States"
5. **Manually position parts to extended state**
   - Move clamps/pins to open position using transform tools
6. **Capture extended states** → Click "Capture Extended States"
7. **Fit joints** → Click "Fit Joints"
   - Review RMS errors in console/logs
8. **Open Tooling Fixture Animator Panel**
9. **Click "Auto-fit joints & play demo"**
   - System uses captured states to extract joints
   - Creates ValveBank channels
   - Plays demo cycle

**Time:** ~5-10 minutes (extraction happens each time)

**Note:** This workflow requires states to be captured before using ToolingFixtureAnimator. The animator will automatically use the captured states if no `toolingJson` is provided.

---

## Workflow Comparison

| Workflow | Setup Time | Best For | Requires |
|----------|------------|----------|----------|
| **A: Precomputed JSON** | 30 sec | Quick demos, known fixtures | Tooling JSON file |
| **B: Extract Once** | 5-10 min (once) | Development, iteration | State capture (once) |
| **C: Full Extraction** | 5-10 min (each) | New fixtures, exploration | State capture (each time) |

**Recommendation:** Use **Workflow B** for development - extract once, animate many times.

---

## Using Precomputed Tooling JSON

If you already have a tooling JSON file (e.g., `9X_110_GEO.json`), you can skip extraction:

```typescript
import { ToolingFixtureAnimator } from './babylon/pipeline/ToolingFixtureAnimator';
import type { ToolingFileJson } from './babylon/io/ToolingJsonAdapter';

// Load your JSON
const toolingJson: ToolingFileJson = await loadToolingJson('9X_110_GEO.json');

// Create animator with precomputed JSON
const animator = new ToolingFixtureAnimator({
  scene,
  rootNode: fixtureRoot,
  toolingJson, // Skip extraction
});

// Prepare and play
await animator.prepare();
await animator.playDemoCycle();
```

---

## API Reference

### `ToolingFixtureAnimator`

**Constructor:**
```typescript
const animator = new ToolingFixtureAnimator({
  scene: BABYLON.Scene,
  rootNode: BABYLON.TransformNode,
  toolingJson?: ToolingFileJson,  // Optional: skip extraction if provided
  pipelineOptions?: PipelineOptions,  // Optional: extraction options
});
```

**Methods:**

#### `prepare(): Promise<void>`
Runs extraction (if needed) and sets up ValveBank. Must be called before animation.

```typescript
await animator.prepare();
```

**Throws:** Error if no tooling JSON provided and no states captured.

#### `playDemoCycle(): Promise<void>`
Plays a simple extend/retract cycle for all joints:
- `t=0ms`: Extend all channels
- `t=1500ms`: Retract all channels

```typescript
await animator.playDemoCycle();
```

#### `getValveBank(): ValveBank`
Get the ValveBank instance for custom timeline control.

```typescript
const bank = animator.getValveBank();
const events: TimelineEvent[] = [
  { tMs: 0, cmd: 'extend', channelId: 'joint1' },
  { tMs: 1000, cmd: 'retract', channelId: 'joint1' },
];
await bank.runTimeline(events);
```

#### `getJoints(): JointDefinitionOutput[]`
Get all joint definitions.

```typescript
const joints = animator.getJoints();
console.log(`Found ${joints.length} joints`);
```

#### `getSummary(): Summary`
Get summary statistics.

```typescript
const summary = animator.getSummary();
console.log(`Joints: ${summary.jointCount}`);
console.log(`Channels: ${summary.channelCount}`);
console.log(`High error joints: ${summary.highErrorJoints.length}`);
```

---

## Complete Example

```typescript
import * as BABYLON from '@babylonjs/core';
import { ToolingFixtureAnimator } from './babylon/pipeline/ToolingFixtureAnimator';
import { SceneManager } from './scene/SceneManager';

async function animateFixture() {
  const scene = SceneManager.getInstance().getScene();
  if (!scene) throw new Error('No scene');

  // Get fixture root node (from selection or scene tree)
  const rootNode = scene.getTransformNodeByID('9X_110_GEO') || scene.getRootMesh();
  if (!rootNode) throw new Error('No root node found');

  // Create animator
  const animator = new ToolingFixtureAnimator({
    scene,
    rootNode,
    // Option 1: Provide precomputed JSON
    // toolingJson: await loadToolingJson('9X_110_GEO.json'),
    
    // Option 2: Use extraction pipeline (requires states captured first)
    // pipelineOptions: { analysisMethod: 'geometry-based' },
  });

  // Prepare (runs extraction if needed)
  await animator.prepare();

  // Get summary
  const summary = animator.getSummary();
  console.log(`Setup complete: ${summary.jointCount} joints`);

  if (summary.highErrorJoints.length > 0) {
    console.warn('High RMS errors detected:', summary.highErrorJoints);
  }

  // Play demo cycle
  await animator.playDemoCycle();

  // Or use custom timeline
  const bank = animator.getValveBank();
  const customEvents = [
    { tMs: 0, cmd: 'extend' as const, channelId: 'joint1' },
    { tMs: 500, cmd: 'extend' as const, channelId: 'joint2' },
    { tMs: 1000, cmd: 'retract' as const, channelId: 'joint1' },
    { tMs: 1500, cmd: 'retract' as const, channelId: 'joint2' },
  ];
  await bank.runTimeline(customEvents);
}
```

---

## Workflow Options

### Option 1: Precomputed JSON (Fastest)
- ✅ Use existing tooling JSON file
- ✅ No extraction needed
- ✅ Instant animation setup

```typescript
const animator = new ToolingFixtureAnimator({
  scene,
  rootNode,
  toolingJson: myJson, // Provide JSON directly
});
await animator.prepare();
```

### Option 2: Full Extraction Pipeline (Most Flexible)
- ✅ Automatic joint detection
- ✅ Handles any GLB structure
- ⚠️ Requires manual state capture first

**Steps:**
1. Use **Kinematic Extraction Panel** to:
   - Analyze scene
   - Capture retracted states
   - Capture extended states
   - Fit joints
2. Then use **Tooling Fixture Animator** to animate

### Option 3: Hybrid (Recommended for Development)
- ✅ Extract once, reuse JSON
- ✅ Fast iteration on animation
- ✅ No re-extraction needed

```typescript
// Step 1: Extract once (save JSON)
const pipeline = new KinematicExtractionPipeline(scene);
// ... (capture states, fit joints)
const json = pipeline.exportToLegacyJSON();
saveJSON('my_fixture.json', json);

// Step 2: Use JSON for animation (fast iteration)
const animator = new ToolingFixtureAnimator({
  scene,
  rootNode,
  toolingJson: json, // Reuse extracted JSON
});
await animator.prepare();
await animator.playDemoCycle();
```

---

## Troubleshooting

### Error: "No tooling JSON provided and no states captured"

**Cause:** Extraction pipeline requires states to be captured first.

**Solution:**
1. Use **Kinematic Extraction Panel** to capture states first, OR
2. Provide precomputed `toolingJson` in options

### Error: "No joints found"

**Cause:** Extraction failed or no valid joints detected.

**Solution:**
1. Check console for extraction errors
2. Verify states were captured correctly
3. Check RMS errors in summary (should be < 1cm)

### Animation doesn't play

**Cause:** Joints not registered or channels not created.

**Solution:**
1. Verify `prepare()` completed successfully
2. Check `getSummary()` for joint count > 0
3. Ensure scene nodes exist (check `childId` in joints)

### High RMS errors

**Cause:** ICP alignment quality is poor.

**Solution:**
1. Check point cloud quality (should have > 100 points)
2. Verify parts moved significantly between states
3. Adjust ICP options in `pipelineOptions`

---

## Assumptions & Limitations

### Assumptions

1. **NodeId naming:** Joint `NodeId` must match scene tree node IDs
2. **Root selection:** User selects correct fixture root node
3. **State capture:** For extraction, states must be captured manually (current workflow)
4. **Joint types:** Only prismatic (Type 0) and hinge (Type 1) supported

### Limitations

1. **Manual state capture:** Full extraction requires user to position parts manually
2. **Single fixture:** One animator per fixture root (create multiple for multiple fixtures)
3. **No dynamics:** Pure kinematic animation (no physics simulation)
4. **Joint limits:** Limits estimated from single state pair (may need refinement)

### TODOs

- [ ] Automatic state capture (physics simulation to find limits)
- [ ] Multi-fixture support (single animator for multiple roots)
- [ ] Joint limit refinement (multiple state samples)
- [ ] Custom motion profiles (velocity/acceleration limits)

---

## Testing

### Unit Tests

Located in `tests/babylon/pipeline/ToolingFixtureAnimator.test.ts`

Tests basic functionality with precomputed JSON:
- Constructor with tooling JSON
- Prepare animator
- Joint/channel creation
- Summary statistics

```bash
npm test -- ToolingFixtureAnimator.test
```

### E2E Tests

Located in `tests/babylon/pipeline/ToolingFixtureAnimator.e2e.test.ts`

Comprehensive end-to-end test coverage:

1. **Precomputed JSON Workflow**
   - Load fixture, prepare animator, verify joints
   - Play demo cycle and verify animation state changes
   - Handle multi-joint fixtures correctly

2. **Custom Timeline Control**
   - Execute custom timeline events in sequence
   - Handle out-of-order timeline events

3. **Error Handling**
   - Throw error when prepare() called without JSON or states
   - Throw error when playDemoCycle() called before prepare()
   - Throw error when getValveBank() called before prepare()
   - Handle empty joints array gracefully

4. **Joint Type Handling**
   - Handle prismatic joints (Type 0)
   - Handle hinge joints (Type 1) with degree conversion

5. **Summary and Diagnostics**
   - Provide accurate summary statistics
   - Get joints array with correct properties
6. **Real Fixture Asset**
   - Load `test_assets/tooling/9X_110_GEO.glb` directly via `SceneLoader.ImportMeshAsync`
   - Run animator against the production `9X_110_GEO.json` tooling file
   - Exercise ValveBank timeline using actual channel IDs

```bash
npm test -- ToolingFixtureAnimator.e2e
```

**Test Coverage:**
- ✅ 15+ E2E test scenarios
- ✅ All joint types (prismatic, hinge)
- ✅ Error handling paths
- ✅ Timeline control
- ✅ Multi-joint fixtures

---

## Related Documentation

- **Auto Kinematics Complete Guide:** `docs/auto-kinematics/AUTO_KINEMATICS_COMPLETE_GUIDE.md`
- **Actual Workflow Analysis:** `docs/auto-kinematics/AUTO_KINEMATICS_ACTUAL_WORKFLOW_ANALYSIS.md`
- **ValveBank API:** `src/babylon/actuation/ValveBank.ts`
- **JointMath API:** `src/babylon/kinematics/JointMath.ts`
- **ToolingJsonAdapter:** `src/babylon/io/ToolingJsonAdapter.ts`

---

## Summary

The **ToolingFixtureAnimator** provides a clean, testable integration layer that:

1. ✅ Connects auto-kinematics extraction to ValveBank animation
2. ✅ Supports both precomputed JSON and full extraction workflows
3. ✅ Provides simple API for demo cycles and custom timelines
4. ✅ Handles joint/channel registration automatically
5. ✅ Includes error handling and summary statistics
6. ✅ Comprehensive test coverage (unit + E2E)

**Public APIs:**
- `ToolingFixtureAnimator` class (main integration helper)
- `ToolingFixtureAnimatorPanel` React component (UI entry point)

**Key Files:**
- `src/babylon/pipeline/ToolingFixtureAnimator.ts` - Integration helper
- `src/ui/components/ToolingFixtureAnimatorPanel.tsx` - UI component
- `tests/babylon/pipeline/ToolingFixtureAnimator.test.ts` - Unit tests
- `tests/babylon/pipeline/ToolingFixtureAnimator.e2e.test.ts` - E2E tests

**Usage Pattern:**
```typescript
const animator = new ToolingFixtureAnimator({ scene, rootNode, toolingJson? });
await animator.prepare();
await animator.playDemoCycle();
```
