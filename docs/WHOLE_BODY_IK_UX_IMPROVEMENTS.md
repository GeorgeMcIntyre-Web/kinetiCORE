# Whole-Body IK UX Improvements

**Status:** Proposal / Implementation Needed
**Owner:** George (Agent 1) + Edwin (Agent 3 for visual gizmos)
**Priority:** HIGH - Current panel is not usable for real workflows
**Created:** 2025-01-23

## Problem Statement

The current Whole-Body IK panel has a **critical usability gap**: it shows controls but doesn't connect to robots in the scene or provide visual feedback. Users cannot:

1. Select which robot to control
2. See which kinematic chains are available
3. Visually place target positions (must type X/Y/Z coordinates)
4. Preview the IK solution before applying it
5. Actually apply the solution to move the robot
6. Get visual feedback about success/failure

**Current State:** Panel opens → User stares at empty inputs → Confused 🤔

**Desired State:** Panel opens → Shows active robot → User drags target gizmos in 3D → Sees preview → Clicks Apply → Robot moves ✅

---

## Complete User Workflow (Required)

### Phase 1: Robot Selection & Chain Discovery ⭐ CRITICAL

**What's Missing:**
```tsx
// At top of panel, BEFORE any targets
<div style={{ marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
  <h4>Robot Selection</h4>

  {/* Robot dropdown */}
  <label style={{ display: 'block', marginBottom: '10px' }}>
    Active Robot:
    <select value={selectedRobotId} onChange={handleRobotChange}>
      <option value="">-- Select Robot --</option>
      {availableRobots.map(robot => (
        <option key={robot.id} value={robot.id}>{robot.name}</option>
      ))}
    </select>
  </label>

  {/* Show available chains for selected robot */}
  {selectedRobotId && (
    <div style={{ fontSize: '12px', color: '#999' }}>
      <strong>Available Chains:</strong>{' '}
      {availableChains.map(chain => chain.name).join(', ')}
    </div>
  )}
</div>
```

**Implementation:**
1. On panel mount, call `KinematicsManager.getAllChains()`
2. Group chains by robot (detect by joint ID prefixes or metadata)
3. Show dropdown of robots
4. When robot selected, populate available chain names
5. Auto-populate chain name dropdowns in target configs

**Data Sources:**
- `KinematicsManager.getInstance().getAllChains()` - returns all chains
- `chain.name` - e.g., "left_arm", "right_arm", "torso"
- `chain.joints` - array of joints in chain

---

### Phase 2: Visual Target Placement 🎯 HIGH PRIORITY

**What's Missing:**

Instead of typing coordinates, users should:
1. Click "+ Add Target" → Creates 3D gizmo sphere in scene
2. Select chain from dropdown (now populated with available chains)
3. Drag gizmo sphere to desired end-effector position
4. Gizmo position ↔ Panel coordinates stay synced

**3D Gizmo Requirements:**
```typescript
// Target gizmo in scene
class TargetGizmo {
  position: BABYLON.Vector3;        // 3D position
  mesh: BABYLON.Mesh;               // Visible sphere
  chainName: string;                // Which chain this targets
  isActive: boolean;                // Currently being dragged?

  // Visual feedback
  color: BABYLON.Color3;            // Green = reachable, Red = unreachable
  showDistanceLabel: boolean;       // Show distance to current EE position

  // Interaction
  isDraggable: boolean;
  onPositionChange: (pos: Vector3) => void;  // Update panel
}
```

**Panel Changes:**
```tsx
// Instead of manual X/Y/Z inputs
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
  <label>Position: {formatPosition(target.position)}</label>
  <button onClick={() => activateGizmo(index)}>
    📍 Place in Scene
  </button>
  <button onClick={() => setFromCurrentEE(index)}>
    📐 Use Current Pose
  </button>
</div>
```

**Owner:** Edwin (3D gizmo interaction) + George (panel integration)

---

### Phase 3: Current Pose Display & Comparison 📊

**What's Missing:**

Show users where the robot currently is vs where they want it to be:

```tsx
{targets.map((target, index) => (
  <div key={index} style={{ /* ... */ }}>
    <h5>{target.chainName || `Target ${index + 1}`}</h5>

    {/* Current vs Target comparison */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
      <div>
        <strong>Current:</strong><br/>
        {formatPosition(getCurrentEEPosition(target.chainName))}
      </div>
      <div>
        <strong>Target:</strong><br/>
        {formatPosition(target.position)}
        <div style={{ color: distanceColor }}>
          Distance: {calculateDistance(target.chainName, target.position).toFixed(3)}m
        </div>
      </div>
    </div>

    {/* ... rest of controls */}
  </div>
))}
```

**Data Source:**
- `fkSolver.getEndEffectorPose(chainName)` - current EE position
- Compare with `target.position` to show distance

---

### Phase 4: Solution Preview 👁️ MEDIUM PRIORITY

**What's Missing:**

Before applying, show what the solution will look like:

**Options:**

**Option A: Ghost Robot (Easier)**
```typescript
// Create transparent copy of robot meshes
const ghostMeshes = robot.meshes.map(mesh => {
  const ghost = mesh.clone();
  ghost.material = ghostMaterial; // 50% transparent, blue tint
  return ghost;
});

// Apply IK solution joint angles to ghost
solution.jointAngles.forEach((angles, chainName) => {
  applyJointAnglesToGhost(chainName, angles, ghostMeshes);
});

// User sees: Original robot (current) + Ghost robot (preview)
```

**Option B: Live Preview (Harder, Better UX)**
```typescript
// As user drags target gizmo, solve IK in real-time (throttled)
const handleGizmoDrag = debounce((position: Vector3) => {
  const solution = wholeBodySolver.solve({
    targets: new Map([[chainName, { position }]]),
    maxIterations: 20, // Fast, less accurate for preview
  });

  if (solution.success) {
    updateGhostRobot(solution.jointAngles);
  }
}, 100); // Update every 100ms
```

**Owner:** Edwin (ghost mesh rendering) + George (IK integration)

---

### Phase 5: Apply & Reset 🎬 CRITICAL

**What's Missing:**

Currently solve() just logs to console. Need actual robot control:

```tsx
<div style={{
  display: 'flex',
  gap: '10px',
  marginTop: '20px',
  paddingTop: '20px',
  borderTop: '2px solid #555'
}}>
  <button
    onClick={handleApplySolution}
    disabled={!lastSolution || !lastSolution.success}
    style={{
      flex: 1,
      padding: '12px',
      fontSize: '16px',
      fontWeight: 'bold',
      backgroundColor: lastSolution?.success ? '#28a745' : '#666',
      cursor: lastSolution?.success ? 'pointer' : 'not-allowed'
    }}
  >
    ✅ Apply Solution
  </button>

  <button
    onClick={handleReset}
    style={{ padding: '12px' }}
  >
    ↶ Reset to Current
  </button>

  <button
    onClick={handleSaveKeyframe}
    disabled={!lastSolution?.success}
    style={{ padding: '12px' }}
  >
    💾 Save Pose
  </button>
</div>
```

**Implementation:**
```typescript
const handleApplySolution = () => {
  if (!lastSolution || !lastSolution.success) return;

  // Apply joint angles to actual robot
  lastSolution.jointAngles.forEach((angles, chainName) => {
    const chain = kinematicsManager.getChain(chainName);
    if (!chain) return;

    chain.joints.forEach((joint, i) => {
      if (joint.mesh) {
        // Rotate joint mesh to target angle
        const angle = angles[i];
        joint.mesh.rotation[joint.axis] = angle;
      }
    });
  });

  // Update FK solver with new angles
  fkSolver.updateJointAngles(lastSolution.jointAngles);

  // Show success feedback
  showNotification('✅ Pose applied successfully', 'success');
};
```

**Data Flow:**
1. User clicks "Solve Whole-Body IK"
2. Store result in `lastSolution` state
3. Show preview (ghost robot or visual feedback)
4. User clicks "Apply Solution"
5. Actually move the robot joints
6. Update forward kinematics
7. Clear target gizmos or keep for refinement

---

### Phase 6: Visual Feedback & Status 📡 HIGH PRIORITY

**What's Missing:**

Users don't see what's happening. Add real-time feedback:

```tsx
{/* Status banner at top of panel */}
{solverStatus && (
  <div style={{
    padding: '10px',
    marginBottom: '20px',
    borderRadius: '4px',
    backgroundColor: solverStatus.type === 'success' ? '#1a4d2e' :
                     solverStatus.type === 'error' ? '#4d1a1a' : '#4d4d1a',
    borderLeft: `4px solid ${solverStatus.type === 'success' ? '#28a745' :
                              solverStatus.type === 'error' ? '#dc3545' : '#ffc107'}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {solverStatus.type === 'solving' && <Spinner size={16} />}
      {solverStatus.type === 'success' && '✅'}
      {solverStatus.type === 'error' && '❌'}
      <div>
        <strong>{solverStatus.message}</strong>
        {solverStatus.details && (
          <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
            {solverStatus.details}
          </div>
        )}
      </div>
    </div>
  </div>
)}
```

**Status Examples:**
- **Solving:** "Solving IK... (iteration 23/100)"
- **Success:** "✅ Solution found in 42 iterations | Total error: 0.0023m"
- **Failed:** "❌ Failed to converge | Final error: 0.157m (tolerance: 0.001m)"
- **Warning:** "⚠️ Solution found but constraint violated: Balance constraint"

**3D Visual Feedback:**
- Target gizmos change color: 🟢 Green = reached, 🔴 Red = unreachable
- Show distance label above gizmo
- Animate gizmo when solving (pulsing)
- Draw line from current EE to target position

---

### Phase 7: Constraint Visualization 🚧 MEDIUM PRIORITY

**What's Missing:**

Constraints are invisible - users don't understand why solutions fail:

**Balance Constraint:**
```typescript
// Draw support polygon on ground
const supportPolygonMesh = BABYLON.MeshBuilder.CreatePolygon(
  'supportPolygon',
  { shape: supportPolygonPoints },
  scene
);
supportPolygonMesh.material = transparentGreenMaterial;

// Draw COM projection
const comProjection = BABYLON.MeshBuilder.CreateSphere(
  'comProjection',
  { diameter: 0.05 },
  scene
);
// Position at center of mass projection on ground
```

**Collision Avoidance:**
```typescript
// Draw collision spheres around robot
robot.links.forEach(link => {
  const collisionSphere = BABYLON.MeshBuilder.CreateSphere(
    `collision_${link.id}`,
    { diameter: link.collisionRadius * 2 },
    scene
  );
  collisionSphere.material = transparentRedMaterial;
  collisionSphere.isPickable = false;
});
```

**Owner:** Edwin (3D visualization)

---

## Implementation Priority

### 🔴 Phase 1: Must Have (MVP)
1. ✅ Robot Selection dropdown
2. ✅ Chain discovery & population
3. ✅ Apply Solution button (actually moves robot)
4. ✅ Status feedback in panel

**Estimated Effort:** 4-6 hours
**Blocking:** Panel is not usable without this

### 🟡 Phase 2: Should Have (Usable)
5. 📍 Visual target gizmos (draggable spheres)
6. 📊 Current vs Target pose display
7. 📡 3D visual feedback (gizmo colors)

**Estimated Effort:** 6-8 hours
**Impact:** Massive UX improvement

### 🟢 Phase 3: Nice to Have (Polished)
8. 👁️ Ghost robot preview
9. 🚧 Constraint visualization
10. 💾 Save pose to keyframe system
11. ⚡ Real-time preview while dragging

**Estimated Effort:** 8-12 hours
**Impact:** Professional-grade tool

---

## Technical Architecture

### Data Flow

```
User Action → Panel UI → WholeBodyIKSolver → IK Solution → Visual Preview → Apply → Robot Moves
     ↓                         ↓                                ↓              ↓
  Target Gizmos      KinematicsManager                  Ghost Meshes     Joint Rotations
     ↓                         ↓                                ↓              ↓
  Scene Interaction    Chain Discovery                 3D Feedback      FK Update
```

### Component Responsibilities

**WholeBodyIKPanel.tsx (George):**
- Robot selection logic
- Chain discovery
- IK solving
- Apply/reset logic
- Status management
- Panel UI

**TargetGizmoManager.ts (Edwin):**
- Create/destroy target gizmos
- Handle gizmo dragging
- Sync gizmo ↔ panel coordinates
- Visual feedback (colors, labels)

**GhostRobotPreview.ts (Edwin):**
- Create transparent robot copy
- Apply IK solution to ghost
- Toggle preview on/off

**IKStatusManager.ts (George):**
- Track solver status
- Format error messages
- Calculate metrics
- Emit events for UI updates

---

## API Extensions Needed

### KinematicsManager

```typescript
// Need to add grouping/filtering by robot
interface KinematicsManager {
  // NEW: Get chains grouped by robot
  getChainsByRobot(): Map<string, KinematicChain[]>;

  // NEW: Get robot metadata
  getRobotInfo(robotId: string): RobotInfo;

  // EXISTING: Already have these ✅
  getAllChains(): KinematicChain[];
  getChain(name: string): KinematicChain | undefined;
}
```

### WholeBodyIKSolver

```typescript
// Already has everything we need! ✅
interface WholeBodyIKSolution {
  jointAngles: Map<string, number[]>;  // For applying to robot
  success: boolean;                     // For UI feedback
  errors: Map<string, number>;          // For per-chain status
  iterations: number;                   // For progress display
  totalError: number;                   // For overall status
}
```

---

## User Stories

### Story 1: Simple Single-Arm Reach
```
As a user,
I want to move a robot's end-effector to a specific position,
So that I can test reachability and plan grasps.

Steps:
1. Load robot URDF (e.g., UR5)
2. Click "Whole-Body IK" button in ribbon
3. Panel opens, shows "UR5" in robot dropdown (auto-selected)
4. I see available chains: "arm"
5. I click "+ Add Target"
6. I select chain: "arm"
7. I click "Place in Scene" → 3D gizmo appears
8. I drag gizmo to desired position (e.g., above a box)
9. I see current EE distance to target: 0.234m
10. I click "Solve Whole-Body IK"
11. Status shows: "✅ Solution found in 18 iterations"
12. Ghost robot appears showing preview pose
13. I click "Apply Solution"
14. Robot arm smoothly moves to target position
15. Gizmo turns green (target reached)
```

### Story 2: Humanoid Walking Pose
```
As a robotics engineer,
I want to create a walking pose for a humanoid robot,
So that I can generate realistic gait animations.

Steps:
1. Load ATLAS humanoid robot
2. Click "Whole-Body IK" → Panel opens
3. Click "Humanoid Walk Pose" quick action
4. Panel auto-populates:
   - Left foot target
   - Right foot target
   - Pelvis target
5. I see 3 gizmos in scene (color-coded)
6. I drag right foot gizmo forward 0.3m
7. As I drag, ghost robot shows live preview (optional)
8. I click "Solve Whole-Body IK"
9. Status: "✅ Solution found with balance constraint satisfied"
10. I click "Apply Solution"
11. Robot assumes walking pose
12. I click "Save Pose" → Added to keyframe timeline
```

---

## Questions to Resolve

1. **Multi-robot scenes:** How do we detect which robot a chain belongs to?
   - Option A: Joint ID prefix (e.g., "robot1_joint_1")
   - Option B: Metadata in URDF
   - Option C: Manual grouping by user

2. **Gizmo persistence:** Do target gizmos stay in scene after applying?
   - Option A: Yes, for iterative refinement
   - Option B: No, clear on apply
   - Option C: User choice (checkbox)

3. **Coordinate system:** Gizmos use Babylon coords (Y-up, meters)?
   - Yes, but display in panel should show user coords (Z-up, mm)
   - Use `CoordinateSystem.babylonToUser()` for display

4. **Undo/redo:** Should Apply Solution be undoable?
   - Yes! Create `WholeBodyIKCommand` for command history
   - Stores: original angles, new angles, chain names

5. **Performance:** Real-time preview while dragging?
   - For simple robots: Yes (throttled to 100ms)
   - For complex robots (>12 DOF): No, solve on release
   - Add checkbox to enable/disable

---

## Next Steps

1. **Decision Point:** User reviews this doc and approves priority
2. **Phase 1 Implementation:** George implements robot selection + apply logic
3. **Phase 2 Implementation:** Edwin creates target gizmos
4. **Integration:** Test with UR5 and ATLAS robots
5. **Documentation:** Update user guide with workflow examples

---

## Files to Modify

- `src/ui/components/WholeBodyIKPanel.tsx` - Add all Phase 1-6 features
- `src/scene/TargetGizmoManager.ts` - **NEW** - 3D target gizmos
- `src/scene/GhostRobotPreview.ts` - **NEW** - Preview system
- `src/kinematics/KinematicsManager.ts` - Add robot grouping
- `src/history/commands/WholeBodyIKCommand.ts` - **NEW** - Undo/redo
- `docs/USER_GUIDE_WHOLE_BODY_IK.md` - **NEW** - User documentation

---

**This is a LOT of work, but absolutely necessary for the panel to be usable!**

What should we tackle first?
