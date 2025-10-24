# Agent 1: IK Target Location Implementation

**Agent:** Agent 1 (Claude Code)  
**Priority:** HIGH - Critical user workflow block  
**Timeline:** 7-10 days (3 phases)  
**Status:** 🚀 Ready to Start

---

## 🎯 Mission

Implement visual target placement system for inverse kinematics with 3D gizmos, robot selection, and automatic kinematic chain discovery.

---

## 📊 Current State Analysis

### What Works ✅
- IK solver backend exists (`src/kinematics/IKSolver.ts`)
- Motion panel UI structure in place (`src/ui/components/MotionPanel.tsx`)
- Entity system supports robots and kinematic chains
- Transform gizmo system available (`src/manipulation/TransformGizmo.ts`)

### What's Missing ❌
- **No visual target placement** - Users can't see or move IK targets in 3D
- **No robot selection UI** - Can't select which robot to control
- **No chain discovery** - Manual chain specification required
- **No target gizmo** - No visual feedback for IK goals
- **No "Plan to Target" button** - Workflow incomplete

### The Problem 🔥
Users need to:
1. Click a robot in the 3D scene
2. See a target gizmo appear at the end effector
3. Move the gizmo to set the goal pose
4. Click "Plan to Target" to solve IK
5. See the robot move to reach the target

**Currently:** None of this exists. It's a critical workflow blocker.

---

## 📋 Implementation Plan

### Phase 1: Robot Selection & Chain Discovery (Days 1-3)
**Goal:** Click robot → Detect chains → Show in UI

**Tasks:**
1. Add click detection for robot entities
2. Implement kinematic chain auto-discovery
3. Add chain selection dropdown to MotionPanel
4. Show chain info (joints, end effector)

**Files to Create/Modify:**
- `src/kinematics/ChainDiscovery.ts` (NEW)
- `src/ui/components/MotionPanel.tsx` (MODIFY)
- `src/ui/stores/kinematicsStore.ts` (MODIFY)

**Success Criteria:**
- Click robot → Chains populate dropdown
- Select chain → End effector highlighted
- Chain info displayed (joint count, end effector name)

---

### Phase 2: Visual Target Placement (Days 4-6)
**Goal:** 3D gizmo for target positioning

**Tasks:**
1. Create IK target gizmo (sphere + axes)
2. Attach gizmo to selected chain's end effector
3. Implement gizmo drag to move target
4. Show target position/rotation in UI
5. Add "Reset to Current Pose" button

**Files to Create/Modify:**
- `src/manipulation/IKTargetGizmo.ts` (NEW)
- `src/ui/components/MotionPanel.tsx` (MODIFY)
- `src/kinematics/IKController.ts` (NEW)

**Success Criteria:**
- Gizmo appears at end effector when chain selected
- Drag gizmo → Target position updates in UI
- "Reset" button → Gizmo snaps to current end effector pose
- Gizmo color matches chain selection

---

### Phase 3: "Plan to Target" Integration (Days 7-10)
**Goal:** Complete IK workflow

**Tasks:**
1. Add "Plan to Target" button to MotionPanel
2. Wire button to IKSolver with current target pose
3. Show solution status (success/failed)
4. Animate robot to solution pose
5. Add error handling (unreachable targets)

**Files to Create/Modify:**
- `src/ui/components/MotionPanel.tsx` (MODIFY)
- `src/kinematics/IKController.ts` (MODIFY)
- `src/scene/AnimationController.ts` (NEW)

**Success Criteria:**
- "Plan to Target" button enabled when target set
- Click button → IK solves and robot moves
- Failed IK → Toast error message
- Successful IK → Smooth animation to target

---

## 🗂️ Key Files Reference

### Primary Files (You'll Work On)
```
src/kinematics/
├── ChainDiscovery.ts          (NEW - Auto-detect kinematic chains)
├── IKController.ts            (NEW - Coordinate IK workflow)
└── IKSolver.ts                (EXISTING - Backend solver)

src/manipulation/
└── IKTargetGizmo.ts           (NEW - 3D target visualization)

src/ui/components/
├── MotionPanel.tsx            (MODIFY - Add UI controls)
└── KinematicsControls.tsx     (NEW - Chain/target controls)

src/scene/
└── AnimationController.ts     (NEW - Smooth robot motion)
```

### Reference Files (Don't Modify, Just Read)
```
src/manipulation/TransformGizmo.ts  (Reference for gizmo implementation)
src/entities/EntityRegistry.ts      (Reference for entity selection)
src/loaders/URDFLoader.ts           (Reference for joint hierarchy)
```

---

## 🛠️ Technical Requirements

### Chain Discovery Algorithm
```typescript
// Pseudo-code for ChainDiscovery.ts
function discoverChains(robotEntity: Entity): KinematicChain[] {
  // 1. Find all leaf joints (no children)
  const leafJoints = findLeafJoints(robotEntity);
  
  // 2. For each leaf, trace back to root
  const chains = leafJoints.map(leaf => {
    const joints = traceToRoot(leaf);
    return {
      name: `${leaf.name}_chain`,
      joints: joints,
      endEffector: leaf
    };
  });
  
  // 3. Filter chains (min 2 joints, max 10 joints)
  return chains.filter(c => c.joints.length >= 2 && c.joints.length <= 10);
}
```

### IK Target Gizmo Design
```typescript
// Pseudo-code for IKTargetGizmo.ts
class IKTargetGizmo {
  private sphere: BABYLON.Mesh;      // Visual target
  private axes: BABYLON.LineSystem;  // Orientation axes
  private dragBehavior: PointerDragBehavior;
  
  show(position: Vector3, rotation: Quaternion) {
    this.sphere.position = position;
    this.sphere.rotationQuaternion = rotation;
    this.sphere.setEnabled(true);
  }
  
  onPositionChanged(callback: (pos: Vector3, rot: Quaternion) => void) {
    this.dragBehavior.onDragObservable.add(() => {
      callback(this.sphere.position, this.sphere.rotationQuaternion);
    });
  }
}
```

### Motion Panel Integration
```typescript
// Pseudo-code for MotionPanel.tsx updates
function MotionPanel() {
  const [selectedChain, setSelectedChain] = useState<KinematicChain | null>(null);
  const [targetPose, setTargetPose] = useState<Pose | null>(null);
  
  return (
    <div>
      {/* Chain Selection */}
      <select onChange={(e) => setSelectedChain(chains[e.target.value])}>
        {chains.map(c => <option>{c.name}</option>)}
      </select>
      
      {/* Target Position Display */}
      {targetPose && (
        <div>
          <label>Target Position:</label>
          <input value={targetPose.position.x} readOnly />
          <input value={targetPose.position.y} readOnly />
          <input value={targetPose.position.z} readOnly />
        </div>
      )}
      
      {/* Plan Button */}
      <button onClick={handlePlanToTarget} disabled={!targetPose}>
        Plan to Target
      </button>
    </div>
  );
}
```

---

## 📏 Success Metrics

### Phase 1 Success
- [ ] Click robot → Chains auto-discovered
- [ ] Dropdown shows all valid chains
- [ ] Chain info displayed correctly
- [ ] End effector highlighted when chain selected

### Phase 2 Success
- [ ] Target gizmo visible at end effector
- [ ] Gizmo draggable in 3D scene
- [ ] Target position updates in UI during drag
- [ ] Reset button works

### Phase 3 Success
- [ ] "Plan to Target" button functional
- [ ] IK solves and animates robot
- [ ] Error handling for unreachable targets
- [ ] Smooth animation (not instant jump)

### Overall Success
- [ ] Complete workflow: Click robot → Move target → Plan → Robot moves
- [ ] No TypeScript errors
- [ ] No linter warnings
- [ ] Tests pass (if applicable)
- [ ] Documentation updated

---

## 🚀 Getting Started

### Step 1: Read Current Code
```bash
# Read existing IK solver
cat src/kinematics/IKSolver.ts

# Read motion panel UI
cat src/ui/components/MotionPanel.tsx

# Read transform gizmo for reference
cat src/manipulation/TransformGizmo.ts
```

### Step 2: Create Phase 1 Files
```bash
# Create chain discovery
touch src/kinematics/ChainDiscovery.ts

# Update motion panel
code src/ui/components/MotionPanel.tsx
```

### Step 3: Test Chain Discovery
```typescript
// Test in browser console
const robot = entityRegistry.getEntityByName('ur5');
const chains = ChainDiscovery.discoverChains(robot);
console.log('Discovered chains:', chains);
```

---

## 🤝 Coordination with Other Agents

### Agent 2 Dependencies
- Agent 2 is building Full Body IK (multi-chain coordination)
- **Your work:** Single-chain target placement
- **Their work:** Multi-chain constraint system
- **Handoff:** Your IKController will be extended by Agent 2

### Agent 3 Code Review
- Agent 3 will review your code for quality
- Follow TypeScript strict mode
- Add JSDoc comments
- Write clean, modular code

### Agent 4 Performance Testing
- Agent 4 will benchmark IK solver performance
- Optimize chain discovery (cache results)
- Avoid creating gizmos in render loop

---

## 📚 Resources

### Documentation
- IK Solver API: `docs/IK_SOLVER_API.md`
- Entity System: `docs/ENTITY_SYSTEM.md`
- Gizmo System: `docs/MANIPULATION_GIZMOS.md`

### External References
- Babylon.js Gizmos: https://doc.babylonjs.com/features/featuresDeepDive/mesh/gizmo
- IK Algorithms: https://www.cs.cmu.edu/~15464-s13/lectures/lecture6/IK.pdf

---

## ❓ Questions or Blockers?

Post in `#dev-blockers` Slack channel if stuck >1 hour.

**Common Issues:**
- **Chain discovery too slow?** → Cache results in EntityRegistry
- **Gizmo not dragging?** → Check pointer event capture
- **IK not solving?** → Verify joint limits in URDF

---

**Status: READY TO START! 🚀**

Go read `src/kinematics/IKSolver.ts` and start Phase 1: Chain Discovery.
