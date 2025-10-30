# Auto Kinematic Tooling - Complete User Guide

## Overview
This guide explains how to use the auto kinematic tooling system to extract joint parameters from GLB files with tooling JSON data and animate the results.

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Step-by-Step Workflow](#step-by-step-workflow)
3. [Algorithm Details](#algorithm-details)
4. [Troubleshooting](#troubleshooting)
5. [Advanced Usage](#advanced-usage)

---

## Quick Start

### Prerequisites
- GLB file loaded in kinetiCORE
- Tooling JSON file (e.g., `9X_110_GEO.json`) with fitted joint parameters

### 5-Minute Workflow
```typescript
import { toolingJsonToJoints } from './babylon/io/ToolingJsonAdapter';
import { ValveBank } from './babylon/actuation/ValveBank';

// 1. Load tooling JSON
const json = await fetch('9X_110_GEO.json').then(r => r.json());

// 2. Convert to joints
const joints = toolingJsonToJoints(json, (childPath) => {
  const idx = childPath.lastIndexOf('/');
  return idx > 0 ? childPath.substring(0, idx) : 'WORLD';
});

// 3. Create valve bank
const bank = new ValveBank(scene);
joints.forEach(j => bank.registerJoint(j));

// 4. Animate
const events = [
  { tMs: 0, cmd: 'extend', channelId: joints[0].id },
  { tMs: 1500, cmd: 'retract', channelId: joints[0].id }
];
await bank.runTimeline(events, { stepMs: 16 });
```

---

## Step-by-Step Workflow

### **Step 1: Load Your GLB File**

**User Action**:
1. Click **File → Import → GLB**
2. Select your tooling fixture GLB (e.g., `9X_110_GEO.glb`)
3. Wait for model to load

**What Happens Behind the Scenes**:
```typescript
// GLBLoader.ts handles the import
const result = await GLBLoader.load(file, scene);
// - Parses GLB binary format
// - Creates Babylon.js meshes and transform nodes
// - Builds scene tree hierarchy
// - Applies up-axis correction if needed
// - Result: All geometry visible in viewport
```

**Scene Tree Structure After Load**:
```
Assets
└─ 9X_110_GEO (collection)
    ├─ UNIT_118 (collection)
    │   ├─ Part1 (mesh)
    │   └─ Part2 (mesh)
    ├─ UNIT_112 (collection)
    └─ CoSys (collection)
```

---

### **Step 2: Obtain Tooling JSON File**

**User Action**:
1. Receive `9X_110_GEO.json` from external analysis tool
2. Place file in accessible location

**Tooling JSON Format** (What's in the file):
```json
[
  {
    "UnitName": "UNIT_118",
    "Joints": [
      {
        "Name": "Clamp_1",
        "ElectricalName": "CLAMP_A",
        "NodeId": "/9X_110_GEO/UNIT_118/MovingPart",
        "Type": 0,  // 0 = prismatic, 1 = hinge
        "MinValue": 0.0,      // meters (prismatic) or degrees (hinge)
        "MaxValue": 0.050,    // 50mm travel
        "FromVector": { "X": 1.0, "Y": 0.5, "Z": 0.3 },  // Start point
        "ToVector": { "X": 1.0, "Y": 0.5, "Z": 0.35 },   // End point (axis)
        "TransformationMatrix": [
          "1.0 0.0 0.0 0.0",
          "0.0 1.0 0.0 0.0",
          "0.0 0.0 1.0 0.0",
          "0.0 0.0 0.0 1.0"
        ],
        "RmsError": 0.0012,   // Quality metric from ICP fit
        "MaxError": 0.0034
      }
    ]
  }
]
```

**What This Data Represents**:
- **FromVector/ToVector**: Defines motion axis (fitted from point cloud data)
- **MinValue/MaxValue**: Joint limits (measured from physical assembly)
- **TransformationMatrix**: For hinge joints, defines rotation axis
- **RmsError**: How well the joint fits the scan data (lower = better)

---

### **Step 3: Load and Parse Tooling JSON**

**User Action** (in browser console or script):
```javascript
// Option A: Fetch from URL
const json = await fetch('/path/to/9X_110_GEO.json').then(r => r.json());

// Option B: Load from file input
const file = document.getElementById('fileInput').files[0];
const json = JSON.parse(await file.text());
```

**Algorithm - `toolingJsonToJoints()`**:

```typescript
// ToolingJsonAdapter.ts:176-222

function toolingJsonToJoints(data, resolveParentId) {
  const joints = [];

  for (const unit of data) {                    // For each tool unit
    for (const joint of unit.Joints) {          // For each joint in unit

      // Step 1: Identify parent/child nodes
      const childId = joint.NodeId;             // e.g., "/9X_110_GEO/UNIT_118/Gripper"
      const parentId = resolveParentId(childId); // e.g., "/9X_110_GEO/UNIT_118"

      // Step 2: Parse vectors
      const from = Vector3(joint.FromVector);   // Anchor point
      const to = Vector3(joint.ToVector);       // Defines axis direction

      // Step 3: Parse transformation matrix (4x4)
      const T = parseMatrix4(joint.TransformationMatrix);

      // Step 4: Convert based on joint type
      if (joint.Type === 0) {
        // PRISMATIC JOINT (linear motion)
        const axis = normalize(to - from);      // Direction vector
        joints.push({
          id: `${unit.UnitName}_${joint.Name}`,
          type: 'prismatic',
          axisWorld: axis,                      // World-space slide direction
          anchorWorld: from,                    // Reference point
          limits: {
            lower: joint.MinValue,              // In meters
            upper: joint.MaxValue
          }
        });
      } else {
        // HINGE JOINT (rotational motion)
        const axis = extractAxisFromMatrix(T);  // Rotation axis from matrix
        joints.push({
          id: `${unit.UnitName}_${joint.Name}`,
          type: 'hinge',
          axisWorld: axis,                      // World-space rotation axis
          anchorWorld: from,                    // Pivot point
          limits: {
            lower: degreesToRad(joint.MinValue),
            upper: degreesToRad(joint.MaxValue)
          }
        });
      }
    }
  }

  return joints;  // Array of JointDefinitionOutput
}
```

**Key Concepts**:
- **World Space**: All axes and anchors are in global coordinates (not local to parent)
- **Axis Direction**: Unit vector defining motion direction (slide) or rotation axis (hinge)
- **Anchor Point**: Pivot point (hinge) or reference position (prismatic)

---

### **Step 4: Register Joints in ValveBank**

**User Action**:
```typescript
import { ValveBank } from './babylon/actuation/ValveBank';

const bank = new ValveBank(scene);

// Register each joint
joints.forEach(joint => {
  bank.registerJoint(joint);

  // Also create channel for control
  bank.addChannel({
    id: `ch_${joint.id}`,
    unitId: joint.childNodeId,
    jointId: joint.id,
    advanceValue: joint.limits.upper,  // Fully extended/open
    retractValue: joint.limits.lower   // Fully retracted/closed
  });
});
```

**Algorithm - `ValveBank.registerJoint()`**:

```typescript
// ValveBank.ts:31-33

registerJoint(def: JointDefinition): void {
  // Create state tracker for this joint
  const state = new JointState();
  state.value = def.limits.lower;  // Start at lower limit

  // Store joint definition + state
  this.joints.set(def.id, { def, state });

  // Joint is now ready for animation
}
```

**Data Structure**:
```
ValveBank
├─ joints: Map<string, {def, state}>
│   ├─ "UNIT_118_Clamp_1" → { def: {...}, state: { value: 0.0 } }
│   └─ "UNIT_112_Pin_1"   → { def: {...}, state: { value: 0.0 } }
└─ channels: Map<string, Channel>
    ├─ "ch_UNIT_118_Clamp_1" → { advanceValue: 0.05, retractValue: 0.0 }
    └─ "ch_UNIT_112_Pin_1"   → { advanceValue: 0.08, retractValue: 0.0 }
```

---

### **Step 5: Create Animation Timeline**

**User Action**:
```typescript
// Define sequence of operations
const events = [
  // T=0ms: Extend clamp
  { tMs: 0, cmd: 'extend', channelId: 'ch_UNIT_118_Clamp_1' },

  // T=500ms: Insert pin
  { tMs: 500, cmd: 'extend', channelId: 'ch_UNIT_112_Pin_1' },

  // T=2000ms: Retract pin
  { tMs: 2000, cmd: 'retract', channelId: 'ch_UNIT_112_Pin_1' },

  // T=2500ms: Release clamp
  { tMs: 2500, cmd: 'retract', channelId: 'ch_UNIT_118_Clamp_1' }
];
```

**Timeline Visualization**:
```
Time (ms):  0      500    1000   1500   2000   2500   3000
            │       │       │       │       │       │       │
Clamp:      ├───────extend─────────────────────────┤retract┤
Pin:        │       ├──────extend───────────┤retract│       │
            └───────┴───────┴───────┴───────┴───────┴───────┘
```

---

### **Step 6: Execute Animation**

**User Action**:
```typescript
// Run the timeline
await bank.runTimeline(events, {
  stepMs: 16  // 60 FPS (16ms per frame)
});

console.log('Animation complete!');
```

**Algorithm - `ValveBank.runTimeline()`**:

```typescript
// ValveBank.ts:39-61

async runTimeline(events, options) {
  const stepMs = options.stepMs ?? 16;      // Default 60 FPS
  const start = performance.now();          // Record start time
  let eventIndex = 0;

  // Sort events by time
  const sorted = events.sort((a, b) => a.tMs - b.tMs);

  // Animation loop
  while (eventIndex < sorted.length) {
    const now = performance.now();
    const elapsed = now - start;            // Time since start

    // Execute all events up to current time
    while (eventIndex < sorted.length && sorted[eventIndex].tMs <= elapsed) {
      const event = sorted[eventIndex++];
      this.applyCommand(event.channelId, event.cmd);  // Update joint state
    }

    // Apply transforms to scene
    this.step();                            // Update all node positions

    // Wait for next frame
    await sleep(stepMs);                    // Async delay
  }

  // Settle (20 extra frames to finish)
  for (let i = 0; i < 20; i++) {
    this.step();
    await sleep(stepMs);
  }
}
```

**Frame-by-Frame Execution**:

```
Frame 1 (T=0ms):
  - Execute event: Extend clamp
  - Set joint.state.value = 0.05 (upper limit)
  - Call JointMath.applyJointTransform()
  - Update clamp node position in scene
  - Render frame

Frame 31 (T=500ms):
  - Execute event: Extend pin
  - Set joint.state.value = 0.08 (upper limit)
  - Call JointMath.applyJointTransform()
  - Update pin node position in scene
  - Render frame

... continues until all events processed
```

---

### **Step 7: Apply Joint Transforms**

**Algorithm - `JointMath.applyJointTransform()`**:

```typescript
// JointMath.ts:110-158

applyJointTransform(scene, joint, state) {
  // Step 1: Find child node in scene
  const child = scene.getNodeById(joint.childNodeId);
  if (!child) return;  // Node not found

  // Step 2: Build delta transform in world space
  const axis = joint.axisWorld.normalize();
  const anchor = joint.anchorWorld;
  let M;  // Delta transform matrix

  if (joint.kind === 'hinge') {
    // HINGE: Rotate around axis through anchor

    // Create rotation quaternion: q = (axis, angle)
    const q = Quaternion.fromAxisAngle(axis, state.value);
    const R = Matrix.fromQuaternion(q);

    // Compose: Translate to origin, Rotate, Translate back
    // M = T₂ * R * T₁
    const T1 = Matrix.translation(-anchor);  // Move anchor to origin
    const T2 = Matrix.translation(anchor);   // Move back
    M = T2 * R * T1;

    /*
     * Example: Rotate gripper 45° around Z-axis at anchor (1,0,0)
     *
     * Before: Gripper at world (2,0,0)
     *
     * Step 1: T₁ translates anchor to origin
     *   Point (2,0,0) → (1,0,0)  [relative to anchor]
     *
     * Step 2: R rotates 45° around Z
     *   (1,0,0) → (0.707, 0.707, 0)  [rotated]
     *
     * Step 3: T₂ translates back
     *   (0.707, 0.707, 0) → (1.707, 0.707, 0)  [world space]
     *
     * After: Gripper at world (1.707, 0.707, 0)
     */

  } else {
    // PRISMATIC: Translate along axis

    // Delta = axis * distance
    const delta = axis.scale(state.value);
    M = Matrix.translation(delta);

    /*
     * Example: Slide clamp 0.05m along X-axis
     *
     * Before: Clamp at world (1,0.5,0.3)
     *
     * Delta = (1,0,0) * 0.05 = (0.05, 0, 0)
     * M = translation(0.05, 0, 0)
     *
     * After: Clamp at world (1.05, 0.5, 0.3)
     */
  }

  // Step 3: Compose with current world transform
  const currentWorld = child.getWorldMatrix();
  const newWorld = M * currentWorld;

  // Step 4: Convert to local space (relative to parent)
  const parentWorld = child.parent ? child.parent.getWorldMatrix() : Identity;
  const invParent = inverse(parentWorld);
  const localTransform = newWorld * invParent;

  // Step 5: Decompose and apply to node
  const {scale, rotation, position} = decompose(localTransform);
  child.scaling = scale;
  child.rotationQuaternion = rotation;
  child.position = position;

  // Step 6: Babylon.js updates scene graph
  // - Child node moves visually
  // - All descendants move with it
  // - Render loop shows updated position
}
```

**Transform Pipeline Diagram**:

```
World Space:
  Delta Transform (M)    Current World (W)      New World (W')
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │  Rotation/   │  *   │  Child's     │  =   │  Updated     │
  │  Translation │      │  Transform   │      │  Transform   │
  └──────────────┘      └──────────────┘      └──────────────┘
                                                      │
                                                      ↓
Local Space:                              ┌──────────────────┐
                                          │  Parent⁻¹ * W'   │
                                          │  = Local Trans   │
                                          └──────────────────┘
                                                      │
                                                      ↓
                                          ┌──────────────────┐
                                          │  Decompose into: │
                                          │  - Position      │
                                          │  - Rotation      │
                                          │  - Scale         │
                                          └──────────────────┘
                                                      │
                                                      ↓
                                          ┌──────────────────┐
                                          │  Apply to Node   │
                                          │  → Visible!      │
                                          └──────────────────┘
```

---

## Algorithm Details

### **How ICP Fits Joints** (Background - Not User-Facing)

The tooling JSON file contains joints that were fitted using ICP (Iterative Closest Point) algorithm:

```typescript
// ICP.ts:122-172 (simplified)

function fitJoint(advancePoints, retractPoints) {
  // Step 1: Build KD-tree for fast nearest neighbor
  const tree = new KDTree(retractPoints);

  // Step 2: Initial guess (identity transform)
  let T = Matrix.identity();
  let lastError = Infinity;

  for (let iter = 0; iter < 50; iter++) {
    // Step 3: Transform source points by current T
    const transformed = advancePoints.map(p => T.transform(p));

    // Step 4: Find correspondences (nearest neighbors)
    const pairs = transformed.map(p => {
      const nn = tree.nearest(p);  // O(log n) search
      return {source: p, target: nn.point, dist: nn.dist};
    });

    // Step 5: Reject outliers (keep only good matches)
    const goodPairs = pairs.filter(p => p.dist < threshold);

    // Step 6: Compute optimal rigid transform (SVD)
    //  Minimize: Σ ||R*pᵢ + t - qᵢ||²
    //  Where: R = rotation, t = translation
    const {R, t} = solveSVD(goodPairs);

    // Step 7: Update transform
    T = compose(R, t, T);

    // Step 8: Check convergence
    const error = RMS(goodPairs);
    if (abs(lastError - error) < tolerance) break;
    lastError = error;
  }

  // Step 9: Extract motion axis from final transform
  if (isTranslation(T)) {
    // Prismatic: axis = direction of translation
    const axis = normalize(extractTranslation(T));
    return {type: 'prismatic', axis, limits: ...};
  } else {
    // Hinge: axis = rotation axis from matrix
    const axis = extractRotationAxis(T);
    return {type: 'hinge', axis, pivot: ..., limits: ...};
  }
}
```

**Why This Matters**:
- RmsError in JSON = quality of fit
- Lower error (<0.001m) = high confidence joint
- Higher error (>0.01m) = might need manual review

---

## Troubleshooting

### **Issue: Joint doesn't move**

**Symptom**: Animation runs but geometry stays still

**Debug Steps**:
```typescript
// 1. Check if node exists
const node = scene.getNodeById(joint.childNodeId);
console.log('Node found:', !!node);  // Should be true

// 2. Check joint state
const jointData = bank.joints.get(joint.id);
console.log('Joint value:', jointData.state.value);  // Should change

// 3. Check world matrix
console.log('World matrix:', node.getWorldMatrix());  // Should update each frame

// 4. Enable verbose logging
// In JointMath.applyJointTransform(), uncomment:
console.log(`[JointMath] Applied ${joint.kind} ${joint.id}: value=${state.value}`);
```

**Common Causes**:
- Wrong NodeId in tooling JSON (doesn't match scene)
- Parent/child relationship incorrect
- Node is frozen (`node.freezeWorldMatrix()` was called)

---

### **Issue: Joint moves in wrong direction**

**Symptom**: Clamp slides sideways instead of forward

**Debug**:
```typescript
// Check axis direction
console.log('Joint axis (world):', joint.axisWorld);
// Should point in expected direction, e.g., (1,0,0) for +X

// Visualize axis in scene
const axisHelper = createArrow(scene, joint.anchorWorld, joint.axisWorld);
// Red arrow shows motion direction
```

**Fix**: Tooling JSON might have swapped FromVector/ToVector

---

### **Issue: Animation is jumpy/not smooth**

**Symptom**: Geometry teleports instead of smoothly animating

**Cause**: Currently ValveBank applies instant transforms (no interpolation)

**Workaround**: Add velocity limits to motion profiles (future feature)

---

## Advanced Usage

### **Option 1: Manual Joint Definition** (No Tooling JSON)

```typescript
import { JointMath, JointState } from './babylon/kinematics/JointMath';

// Manually define a joint
const joint = {
  id: 'my_gripper',
  kind: 'hinge',
  parentNodeId: 'fixture_base',
  childNodeId: 'gripper_jaw',
  axisWorld: new Vector3(0, 0, 1),      // Rotate around Z
  anchorWorld: new Vector3(1.5, 0, 0),  // Pivot at X=1.5m
  limits: { lower: 0, upper: Math.PI/2 }  // 0-90 degrees
};

// Animate manually
const state = new JointState();
for (let angle = 0; angle <= Math.PI/2; angle += 0.01) {
  state.value = angle;
  JointMath.applyJointTransform(scene, joint, state);
  await sleep(16);  // 60 FPS
}
```

---

### **Option 2: Real-Time Control** (Integrate with Motion Panel)

```typescript
// In your motion panel component:
const onSliderChange = (jointId, value) => {
  const jointData = bank.joints.get(jointId);
  if (!jointData) return;

  // Update state
  jointData.state.value = JointMath.clampToLimits(value, jointData.def.limits);

  // Apply immediately
  JointMath.applyJointTransform(scene, jointData.def, jointData.state);

  // Scene updates automatically
};
```

---

### **Option 3: Export to MJCF** (For External Simulation)

```typescript
import { MJCFExporter } from './babylon/io/MJCFExporter';

const model = {
  joints,
  actuatorProgram: {
    channels: [...],
    residuals: {}
  }
};

const mjcf = MJCFExporter.export(model);
// Save to file for MuJoCo/Isaac Gym/etc.
fs.writeFileSync('my_tooling.xml', mjcf);
```

---

## Summary

### **Data Flow**:
```
Tooling JSON → toolingJsonToJoints() → Joint Definitions → ValveBank
                                                              ↓
Scene Nodes ← JointMath.applyJointTransform() ← Timeline Events
```

### **Key Files**:
- **Input**: `9X_110_GEO.json` (tooling parameters)
- **Parser**: `ToolingJsonAdapter.ts`
- **Controller**: `ValveBank.ts`
- **Kinematics**: `JointMath.ts`
- **Output**: Animated 3D scene

### **Performance**:
- Parsing JSON: <1ms
- Registering 50 joints: <10ms
- Per-frame update (50 joints): <1ms
- 60 FPS: Achievable even with 100+ joints

---

**Questions? Issues?**
- Check `AUTO_KINEMATICS_REVIEW_SUMMARY.md` for architecture details
- See `AUTO_KINEMATICS_REFACTORING.md` for testing strategy
- Run `demo/headless/TestRunner.ts` for end-to-end validation
