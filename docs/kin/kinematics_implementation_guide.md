# KinetiCORE Kinematics System - Complete Implementation Guide

## Overview

This guide covers implementing a progressive kinematics system from simple grounding to complex inverse kinematics, designed for extreme user-friendliness.

## Architecture Philosophy

**Progressive Complexity:**
1. **Phase 1 (Week 1-2):** Grounding & Structure - Get base parts anchored
2. **Phase 2 (Week 3-4):** Joint Creation - Connect moving parts with joints
3. **Phase 3 (Week 5-6):** Forward Kinematics - Manual joint control
4. **Phase 4 (Week 7-8):** Inverse Kinematics - Target-based motion

**Key Design Principles:**
- **Guided Workflow:** Step-by-step wizard preventing mistakes
- **Smart Suggestions:** AI-assisted detection of base parts and joint locations
- **Visual Feedback:** Always show what's happening in 3D
- **Quick Actions:** One-click solutions for common tasks
- **Undo-Friendly:** All actions reversible

---

## Phase 1: Grounding & Structure (Week 1-2)

### User Problem
*"I imported a robot arm GLB - where do I even start?"*

### Solution: Smart Grounding Workflow

**Files Created:**
- `src/kinematics/KinematicsManager.ts` - Core kinematics engine
- `src/ui/components/KinematicsPanel.tsx` - User interface
- `src/ui/components/KinematicsPanel.css` - Styling

**Features:**

#### 1. Auto-Detection of Base Part
```typescript
// Heuristic: Find likely ground part
// - Lowest Z position (closest to ground)
// - Largest volume/mass
// - Typically named "base", "mount", "frame"

suggestGroundNode(rootNodeId: string): string | null {
  // Find all mesh descendants
  const meshNodes = getAllDescendants(rootNodeId)
    .filter(n => n.type === 'mesh');
  
  // Score each by position and volume
  // Lower = better, larger = better
  const scored = meshNodes.map(node => ({
    node,
    score: -node.position.z + estimateVolume(node) * 0.1
  }));
  
  // Return highest score
  return scored.sort((a, b) => b.score - a.score)[0]?.node.id;
}
```

#### 2. Quick Ground Action
User clicks **"Ground Suggested Part"** button:
- Locks part to world coordinates
- Prevents accidental movement
- Visual indicator (anchor icon in tree)
- Undo-able action

#### 3. Manual Ground Selection
If suggestion is wrong:
- User selects different part in scene tree
- Clicks "Ground Selected Part"
- Same locking behavior

**UI Flow:**
```
Import GLB → Select Model → [AI suggests base] → 
  Option A: Quick ground suggested → ✓ Done
  Option B: Pick manually → Ground selected → ✓ Done
```

**Time to Complete:** 10 seconds for simple models

---

## Phase 2: Joint Creation (Week 3-4)

### User Problem
*"I know this arm rotates, but how do I tell the software?"*

### Solution: Click-to-Connect Joint Creation

**Features:**

#### 1. Interactive Joint Wizard
**Step 1: Select Joint Type**
- Revolute (rotation) - Most common
- Prismatic (sliding) - Linear actuators
- Fixed (rigid connection) - Non-moving parts
- Spherical (ball joint) - Complex motion

Visual preview shows motion type with animation

**Step 2: Pick Parent Part**
- Click on fixed/stationary side
- Highlights in yellow
- Shows "This side stays still"

**Step 3: Pick Child Part**
- Click on moving side
- Highlights in green
- Shows "This side moves"

**Step 4: Auto-Detect Joint Axis**
```typescript
// Automatically find rotation axis
// 1. Analyze mesh geometry connection point
// 2. Find common vertices between parts
// 3. Calculate perpendicular to connection surface
// 4. User can adjust if wrong

detectJointAxis(parentMesh, childMesh): Vector3 {
  // Find nearest points between meshes
  const connectionPoint = findNearestPoints(parentMesh, childMesh);
  
  // Get normals at connection
  const parentNormal = getVertexNormal(parentMesh, connectionPoint);
  const childNormal = getVertexNormal(childMesh, connectionPoint);
  
  // Axis is perpendicular to shared surface
  return cross(parentNormal, childNormal).normalize();
}
```

**Step 5: Set Limits**
- Slider shows motion range
- Default: ±180° for revolute, ±100mm for prismatic
- Live preview in 3D viewport
- Soft limits (visual warning) vs hard limits (stops motion)

#### 2. Joint Visualization
- Yellow line showing rotation axis
- Cone showing motion range
- Real-time preview when dragging limits
- Toggle visibility per joint

#### 3. Quick Joint Presets
Common robot configurations:
- **Shoulder:** Revolute, ±90°, Z-axis
- **Elbow:** Revolute, 0° to 150°, Y-axis
- **Gripper:** Prismatic, 0-50mm, Z-axis
- **Wrist:** Spherical, ±45° all axes

**UI Flow:**
```
Click "Create Joint" → Pick Type → 
  Click Parent Part → Click Child Part → 
  [AI suggests axis] → Adjust limits → 
  Preview motion → Confirm → ✓ Joint created
```

**Time to Create Joint:** 30 seconds per joint

---

## Phase 3: Forward Kinematics (Week 5-6)

### User Problem
*"I've defined joints - now how do I actually move them?"*

### Solution: Interactive Joint Control Panel

**Features:**

#### 1. Live Joint Sliders
```typescript
// Real-time joint position control
<div className="joint-control">
  <label>Shoulder Joint</label>
  <input 
    type="range"
    min={joint.limits.lower}
    max={joint.limits.upper}
    value={joint.position}
    onChange={(e) => updateJointPosition(joint.id, e.target.value)}
  />
  <span>{joint.position}°</span>
</div>
```

Each slider:
- Shows current angle/position
- Color-coded limits (green=safe, yellow=near limit, red=at limit)
- Smooth animation in 3D
- Keyboard shortcuts: Arrow keys for fine control

#### 2. Forward Kinematics Solver
```typescript
// Update all child transforms when joint moves
updateJointPosition(jointId: string, newPosition: number) {
  const joint = this.joints.get(jointId);
  
  // Update joint state
  joint.position = clamp(newPosition, joint.limits.lower, joint.limits.upper);
  
  // Calculate new transform for child
  const transform = calculateJointTransform(joint);
  
  // Apply to child mesh
  updateChildTransform(joint.childNodeId, transform);
  
  // Recursively update descendants
  updateDescendantChain(joint.childNodeId);
}

function calculateJointTransform(joint: JointConfig): Matrix4 {
  // Build transformation matrix based on joint type
  if (joint.type === 'revolute') {
    return Matrix4.rotation(joint.axis, joint.position);
  } else if (joint.type === 'prismatic') {
    return Matrix4.translation(joint.axis * joint.position);
  }
  // ... other types
}
```

#### 3. Joint Grouping
Create "Pose" presets:
- **Home Position:** All joints at 0
- **Rest Position:** Comfortable middle position
- **Custom Poses:** Save current configuration
- One-click pose recall

#### 4. Motion Recording
- Record joint positions over time
- Playback as animation
- Export as animation clip
- Looping and speed control

**UI Flow:**
```
Test Motion → Drag joint sliders → 
  See real-time movement → Save pose → 
  Record motion sequence → Playback → ✓ Working!
```

**Time to Test Motion:** 2 minutes per joint chain

---

## Phase 4: Inverse Kinematics (Week 7-8)

### User Problem
*"I want the gripper to reach this point - why do I have to manually adjust 6 joints?"*

### Solution: Target-Based IK with CCD Solver

**Features:**

#### 1. Target Placement
```typescript
// Click in 3D space to place target
// OR enter coordinates manually
// OR select existing object as target

class IKTarget {
  position: Vector3;
  rotation?: Quaternion; // Optional orientation constraint
  visualMarker: Mesh; // Sphere or axis widget
}

// Create target at mouse click
createIKTarget(pickPoint: Vector3): IKTarget {
  const target = new IKTarget();
  target.position = pickPoint;
  
  // Visual marker (semi-transparent sphere)
  target.visualMarker = createSphere(0.02, pickPoint);
  target.visualMarker.material.alpha = 0.5;
  target.visualMarker.material.emissiveColor = Color3.Green();
  
  return target;
}
```

#### 2. CCD IK Solver (Cyclic Coordinate Descent)
Fast, stable, works well for robot arms:

```typescript
class CCDIKSolver {
  solve(
    chain: JointConfig[], 
    endEffector: Vector3, 
    target: Vector3,
    maxIterations = 20,
    tolerance = 0.001
  ): boolean {
    for (let iter = 0; iter < maxIterations; iter++) {
      // Iterate backwards through chain
      for (let i = chain.length - 1; i >= 0; i--) {
        const joint = chain[i];
        
        // Get current positions
        const jointPos = getJointWorldPosition(joint);
        const currentEnd = getEndEffectorPosition(chain);
        
        // Vectors from joint to end-effector and target
        const toEnd = currentEnd.subtract(jointPos).normalize();
        const toTarget = target.subtract(jointPos).normalize();
        
        // Calculate rotation needed
        const angle = Math.acos(dot(toEnd, toTarget));
        const axis = cross(toEnd, toTarget).normalize();
        
        // Apply rotation (clamped to joint limits)
        const newAngle = clamp(
          joint.position + angle,
          joint.limits.lower,
          joint.limits.upper
        );
        
        updateJointPosition(joint.id, newAngle);
      }
      
      // Check if we reached target
      const error = distance(getEndEffectorPosition(chain), target);
      if (error < tolerance) return true;
    }
    
    return false; // Couldn't reach target
  }
}
```

#### 3. Visual Feedback During IK
- Target sphere (green when reachable, red when out of reach)
- Ghost preview of final pose
- Line from end-effector to target
- Distance indicator
- "Solving..." animation

#### 4. Reachability Visualization
```typescript
// Show workspace sphere around robot
// Gray = unreachable, green = reachable, yellow = near limit

calculateReachability(chain: JointConfig[]): {
  minReach: number;
  maxReach: number;
  workspace: Vector3[]; // Point cloud
} {
  // Sum of all link lengths
  const maxReach = chain.reduce((sum, joint) => 
    sum + getLinkLength(joint), 0
  );
  
  // Conservative estimate
  const minReach = maxReach * 0.1;
  
  return { minReach, maxReach, workspace: [] };
}

// Draw sphere mesh showing workspace
drawWorkspace(reachability) {
  const sphere = BABYLON.MeshBuilder.CreateSphere(
    'workspace',
    { diameter: reachability.maxReach * 2 },
    scene
  );
  sphere.material.wireframe = true;
  sphere.material.alpha = 0.2;
}
```

**UI Flow:**
```
Enable IK → Click target location → 
  [Solver calculates] → Preview solution → 
  Confirm or adjust → ✓ Arm reaches target!
```

**Time to Reach Target:** Instant (< 100ms solve time)

---

## Advanced Features (Future Enhancements)

### 1. Collision Avoidance
```typescript
// Check if IK solution causes self-collision
function checkSelfCollision(chain: JointConfig[]): boolean {
  for (let i = 0; i < chain.length; i++) {
    for (let j = i + 2; j < chain.length; j++) {
      if (meshesIntersect(chain[i].childMesh, chain[j].childMesh)) {
        return true;
      }
    }
  }
  return false;
}
```

### 2. Multi-Target IK
- Dual-arm robots (two end-effectors)
- Maintain orientation while moving position
- Avoid singular configurations

### 3. Path Planning
- Define waypoints
- Smooth trajectory generation
- Time-optimal motion
- Velocity/acceleration limits

### 4. Simulation Mode
- Real-time physics during motion
- Gravity effects
- Momentum and inertia
- Force/torque feedback

---

## Integration Points

### 1. Add to EditorStore
```typescript
// src/ui/store/editorStore.ts
interface EditorState {
  // ... existing state
  
  // Kinematics
  kinematicsMode: 'off' | 'setup' | 'test' | 'ik';
  activeKinematicChain: string | null;
  ikTarget: Vector3 | null;
}
```

### 2. Add to Toolbar
```typescript
// src/ui/components/Toolbar.tsx
<div className="toolbar-section">
  <h3>Kinematics</h3>
  <button onClick={openKinematicsPanel}>
    Setup Kinematics
  </button>
</div>
```

### 3. Add to Inspector
```typescript
// Show joint controls in Inspector when joint selected
{node.jointData && (
  <div className="joint-controls">
    <h3>Joint Control</h3>
    <input 
      type="range"
      value={node.jointData.currentValue}
      onChange={updateJoint}
    />
  </div>
)}
```

---

## Performance Optimization

### 1. Joint Update Throttling
```typescript
// Don't update every frame when dragging slider
const throttledUpdate = throttle((jointId, value) => {
  updateJointPosition(jointId, value);
}, 16); // 60 FPS max
```

### 2. IK Solver Optimization
- Early termination when close enough
- Adaptive iteration count based on chain length
- Caching of forward kinematics calculations

### 3. Visual Update Optimization
- Only update changed meshes
- LOD for joint visualizations
- Hide visualizers when not in kinematics mode

---

## User Testing Checklist

**Phase 1 Test:**
- [ ] Import robot GLB in <10 seconds
- [ ] Suggested ground part is correct >80% of time
- [ ] Manual ground selection works for edge cases
- [ ] Visual feedback (anchor icon) is clear

**Phase 2 Test:**
- [ ] Create joint in <30 seconds
- [ ] Auto-detected axis is correct >70% of time
- [ ] Joint limits are intuitive to set
- [ ] Can see joint axis visualization clearly

**Phase 3 Test:**
- [ ] Joint sliders respond smoothly
- [ ] Motion looks realistic (no jumps or flips)
- [ ] Can control 6-joint arm without confusion
- [ ] Pose presets work as expected

**Phase 4 Test:**
- [ ] IK target placement is intuitive
- [ ] Solver reaches target >95% of reachable poses
- [ ] Solve time <100ms for 6-joint arm
- [ ] Clear feedback when target unreachable

---

## Common Workflows

### Workflow 1: Simple Gripper on Linear Actuator
```
1. Import gripper GLB (2 parts: base + jaw)
2. Ground base → Auto-detected ✓
3. Create prismatic joint: base → jaw
4. Set limits: 0-50mm
5. Test with slider → Opens/closes ✓
Time: 2 minutes
```

### Workflow 2: 6-DOF Robot Arm
```
1. Import arm GLB (7 parts: base + 6 links)
2. Ground base → Auto-detected ✓
3. Create 6 revolute joints:
   - Base → Link1 (shoulder pan)
   - Link1 → Link2 (shoulder tilt)
   - Link2 → Link3 (elbow)
   - Link3 → Link4 (wrist roll)
   - Link4 → Link5 (wrist tilt)
   - Link5 → Link6 (wrist rotate)
4. Use joint presets for standard limits
5. Test each joint individually
6. Enable IK mode
7. Click target location → Arm reaches ✓
Time: 10 minutes
```

### Workflow 3: Conveyor Belt System
```
1. Import conveyor GLB
2. Ground frame → Auto-detected ✓
3. Create prismatic joint: frame → belt
4. Set limits: 0-2000mm (belt length)
5. Set velocity: 100mm/s
6. Animate with "Play" button → Belt moves ✓
Time: 3 minutes
```

---

## Error Handling

### User Mistakes to Catch:
1. **No ground part** → "Please ground a base part first"
2. **Circular joint chain** → "This would create a loop"
3. **Joint with same parent/child** → "Parent and child must be different"
4. **Unreachable IK target** → Show distance, suggest closer target
5. **Singular configuration** → Warning before entering singular pose

### Recovery Actions:
- Undo any kinematics operation
- Reset chain to home position
- Delete all joints and start over
- Auto-save kinematics configuration

---

## File Structure Summary

```
src/
├── kinematics/
│   ├── KinematicsManager.ts          # Core system ✓
│   ├── CCDIKSolver.ts                # IK solver (Phase 4)
│   ├── ForwardKinematics.ts          # FK calculations (Phase 3)
│   └── JointVisualizer.ts            # Axis/limit visuals
│
├── ui/
│   └── components/
│       ├── KinematicsPanel.tsx       # Main UI ✓
│       ├── KinematicsPanel.css       # Styling ✓
│       ├── JointCreator.tsx          # Joint wizard (Phase 2)
│       ├── JointControls.tsx         # Sliders (Phase 3)
│       └── IKTargetPlacer.tsx        # IK UI (Phase 4)
│
└── scene/
    └── SceneTreeNode.ts              # Add jointData field ✓
```

---

## Next Steps for Implementation

**Week 1:**
1. Integrate KinematicsManager.ts into project
2. Add KinematicsPanel to UI
3. Wire up ground/unground actions