# Auto Kinematics Tooling Pipeline - Quick Start Guide

**Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Owner:** Cursor Agent (Integration Layer)

---

## Overview

The **ToolingFixtureAnimator** provides a thin integration layer that connects the auto-kinematics extraction pipeline to ValveBank animation. It automates the complete workflow from GLB fixture to animated joints.

**Complete Flow:**
```
GLB fixture
  → Auto kinematics pipeline (ICP, pairing, joint extraction)
  → Tooling JSON (same shape as 9X_110_GEO.json)
  → toolingJsonToJoints()
  → ValveBank + channels
  → ToolingFixtureAnimator timeline
  → visible clamp/pin motion in the scene
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

**Public APIs:**
- `ToolingFixtureAnimator` class (main integration helper)
- `ToolingFixtureAnimatorPanel` React component (UI entry point)

**Key Files:**
- `src/babylon/pipeline/ToolingFixtureAnimator.ts` - Integration helper
- `src/ui/components/ToolingFixtureAnimatorPanel.tsx` - UI component
- `tests/babylon/pipeline/ToolingFixtureAnimator.test.ts` - Unit tests

**Usage Pattern:**
```typescript
const animator = new ToolingFixtureAnimator({ scene, rootNode, toolingJson? });
await animator.prepare();
await animator.playDemoCycle();
```
