# 🤖 kinetiCORE Kinematics & WebGPU Roadmap

## 📍 Current Status (January 2025)

### 🏗️ **Architecture:** Local-First MVP (No Cloud Yet)
**Decision:** ✅ Keep client-only for MVP. Add cloud in Week 5-6 ONLY if proven demand.
**Rationale:** Industrial privacy, offline capability, zero backend costs, fast iteration.
**Storage:** Existing `WorldSerializer.ts` (save/load `.kicore` files)
**Details:** See [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md)

### ✅ PHASE 1: MOTION SYSTEM - COMPLETE
**Status:** Production Ready
**Completion:** 100%

#### What's Working:
- ✅ ForwardKinematicsSolver - Real-time joint motion
- ✅ Interactive joint creation UI (click-to-select)
- ✅ Joint sliders with live mesh updates
- ✅ Joint visualization (axis arrows, origin markers, limits)
- ✅ Physics joint constraints (Rapier integration)
- ✅ Animation system (smooth joint motion)
- ✅ Reset to home position
- ✅ Multi-joint kinematic chains

#### Files Created:
- `src/kinematics/ForwardKinematicsSolver.ts` (297 lines)
- `src/loaders/urdf/URDFJointExtractor.ts` (213 lines)

#### Files Enhanced:
- `src/physics/IPhysicsEngine.ts` - Added joint constraint API
- `src/physics/RapierPhysicsEngine.ts` - Implemented Rapier joints
- `src/ui/components/KinematicsPanel.tsx` - Interactive UI
- `src/kinematics/KinematicsManager.ts` - Enhanced visualization
- `src/ui/components/KinematicsPanel.css` - Polished styling

---

## 🎯 PHASE 2: URDF AUTO-EXTRACTION (Week 1-2)

### Objective
**One-click kinematics from URDF files**

### Implementation Tasks

#### 2.1 URDF Joint Parser ✅
- [x] Created `URDFJointExtractor.ts`
- [x] XML parsing for `<joint>` elements
- [x] Extract: name, type, parent/child, origin, axis, limits
- [x] Link name → Scene node ID mapping
- [x] Auto-ground base link detection

#### 2.2 Integration with Model Loader
```typescript
// src/ui/store/editorStore.ts - importURDFFolder()
import { createKinematicsFromURDF } from '../../loaders/urdf/URDFJointExtractor';

// After loading URDF meshes:
if (isURDF) {
  await createKinematicsFromURDF(urdfXML, modelCollection.id);
  toast.success('URDF kinematics loaded automatically! 🤖');
}
```

**File to Modify:**
- [ ] `src/ui/store/editorStore.ts` - Add auto-extraction to `importURDFFolder()`

**Testing:**
- [ ] Test with Fanuc LRMate200iB URDF
- [ ] Test with Fanuc M16iB URDF
- [ ] Verify joint limits from URDF
- [ ] Verify axis directions

#### 2.3 UI Enhancement
- [ ] Add "Auto-detect Joints" button to KinematicsPanel
- [ ] Show joint count after URDF import
- [ ] Display joint hierarchy tree
- [ ] Highlight grounded parts in scene tree

**Deliverable:** Import URDF → Kinematics ready in 1 click ✨

---

## 🎨 PHASE 3: WEBGPU RENDERING (Week 2-3)

### Objective
**High-performance rendering with WebGPU as alternative to WebGL**

### Why WebGPU?
- 🚀 **Performance:** 2-3x faster rendering for complex robots
- 💾 **Compute Shaders:** GPU-accelerated IK solving
- 🔬 **Modern API:** Better debugging, profiling
- 📊 **Large Assemblies:** Handle 1000+ parts efficiently
- 🎮 **Future-proof:** Next-gen web standard

### Implementation Strategy

#### 3.1 Babylon.js WebGPU Engine Integration
```typescript
// src/scene/SceneManager.ts

async initialize(canvas: HTMLCanvasElement): Promise<void> {
  // Try WebGPU first, fallback to WebGL
  if (await BABYLON.WebGPUEngine.IsSupportedAsync) {
    console.log('🚀 Initializing WebGPU engine...');
    const webgpuEngine = new BABYLON.WebGPUEngine(canvas);
    await webgpuEngine.initAsync();
    this.engine = webgpuEngine;
    console.log('✅ WebGPU engine ready');
  } else {
    console.log('⚠️ WebGPU not supported, using WebGL2');
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
  }

  // Rest of initialization...
}
```

**Files to Modify:**
- [ ] `src/scene/SceneManager.ts` - Add WebGPU engine detection
- [ ] `src/core/constants.ts` - Add `USE_WEBGPU` flag
- [ ] `src/ui/components/Toolbar.tsx` - Add WebGPU indicator

#### 3.2 Performance Monitoring
```typescript
// New file: src/performance/RenderingMetrics.ts
export class RenderingMetrics {
  trackFPS(): number;
  trackDrawCalls(): number;
  trackGPUMemory(): number;
  compareWebGLvsWebGPU(): ComparisonReport;
}
```

#### 3.3 Feature Compatibility Matrix

| Feature | WebGL2 | WebGPU | Notes |
|---------|--------|--------|-------|
| Basic Rendering | ✅ | ✅ | Both supported |
| Shadows | ✅ | ✅ | WebGPU: Better performance |
| Post-Processing | ✅ | ✅ | WebGPU: Compute shaders |
| Boolean Ops (CSG) | ✅ | ✅ | CPU-side, engine-agnostic |
| Physics (Rapier) | ✅ | ✅ | CPU-side, engine-agnostic |
| Compute IK | ❌ | ✅ | WebGPU exclusive |
| Large Scenes (1000+ parts) | ⚠️ | ✅ | WebGPU: 2-3x faster |

#### 3.4 User Settings
```typescript
// src/ui/components/Settings.tsx
<select value={renderEngine} onChange={handleEngineChange}>
  <option value="auto">Auto-detect (Recommended)</option>
  <option value="webgpu">WebGPU (High Performance)</option>
  <option value="webgl">WebGL2 (Compatible)</option>
</select>
```

**Deliverable:** Automatic WebGPU with seamless WebGL fallback 🎨

---

## 🔍 PHASE 4: VISUAL JOINT PLACEMENT (Week 3-4)

### Objective
**Interactive gizmo for joint axis placement**

### Features
- 🎯 Click on mesh surface → Place joint origin
- 🎨 Drag arrows to set joint axis direction
- 📐 Snap to face/edge/vertex
- 👁️ Real-time preview of joint motion
- 🔄 Smart axis suggestions (detect cylinders → revolute axis)

### Implementation

#### 4.1 Joint Placement Gizmo
```typescript
// New file: src/manipulation/JointPlacementGizmo.ts
export class JointPlacementGizmo {
  // Place joint origin
  placeOrigin(pickInfo: BABYLON.PickingInfo): void;

  // Set joint axis by dragging
  setAxis(direction: BABYLON.Vector3): void;

  // Preview joint motion
  previewMotion(angle: number): void;

  // Smart suggestions
  suggestAxis(geometry: BABYLON.Mesh): BABYLON.Vector3;
}
```

#### 4.2 Geometry Analysis
```typescript
// Auto-detect joint type from geometry
function analyzeJointGeometry(
  parentMesh: BABYLON.Mesh,
  childMesh: BABYLON.Mesh
): {
  suggestedType: JointType;
  suggestedAxis: Vector3;
  suggestedOrigin: Vector3;
} {
  // Detect cylindrical surfaces → revolute joint
  // Detect linear rails → prismatic joint
  // Detect contact points → fixed joint
}
```

#### 4.3 UI Integration
- [ ] Add "Place Joint Visually" button to KinematicsPanel
- [ ] Show 3D gizmo in scene
- [ ] Arrow drag controls for axis
- [ ] Sphere drag control for origin
- [ ] "Confirm" / "Cancel" buttons

**Deliverable:** Visual joint creation without manual axis entry 🎯

---

## 🧮 PHASE 5: INVERSE KINEMATICS (Week 4-5)

### Objective
**Target position → Joint values (end-effector control)**

### Implementation

#### 5.1 IK Solver Core
```typescript
// New file: src/kinematics/InverseKinematicsSolver.ts
export class InverseKinematicsSolver {
  /**
   * Jacobian-based numerical IK
   * Uses damped least squares for stability
   */
  solve(
    chainId: string,
    targetPosition: Vector3,
    targetRotation?: Quaternion
  ): Map<string, number>; // jointId → value

  /**
   * Multi-target IK (parallel mechanisms)
   */
  solveMultiTarget(targets: IKTarget[]): Map<string, number>;

  /**
   * Constraint-aware IK (avoid collisions, respect limits)
   */
  solveWithConstraints(
    chainId: string,
    target: Vector3,
    constraints: IKConstraint[]
  ): Map<string, number>;
}
```

#### 5.2 IK Algorithms

**Priority 1: Jacobian (Numerical)**
- ✅ Works for any kinematic structure
- ✅ Handles constraints (joint limits, collisions)
- ⚠️ Iterative (may not converge for extreme poses)

**Priority 2: Analytical (Closed-form)**
- ✅ Instant solution for specific robots (e.g., 6-DOF arms)
- ✅ Deterministic (always converges)
- ⚠️ Only works for known geometries

**Implementation Plan:**
1. Start with Jacobian (universal)
2. Add analytical solvers for common robots (Fanuc, ABB, KUKA)
3. Hybrid: Try analytical first, fallback to Jacobian

#### 5.3 UI Integration
```typescript
// KinematicsPanel.tsx - Add IK mode
<div className="ik-control">
  <h3>Inverse Kinematics</h3>
  <button onClick={enableIKMode}>Enable End-Effector Control</button>

  {ikMode && (
    <>
      <p>Click to set target position</p>
      <TransformGizmo
        mode="translate"
        onDragEnd={(pos) => solveAndApplyIK(pos)}
      />
    </>
  )}
</div>
```

#### 5.4 WebGPU Acceleration (Phase 3 + 5 Integration)
```typescript
// Use WebGPU compute shaders for Jacobian calculation
// 10-100x faster for complex chains (>6 DOF)
const ikComputeShader = `
  @compute @workgroup_size(64)
  fn computeJacobian(
    @builtin(global_invocation_id) id: vec3<u32>
  ) {
    // GPU-parallel Jacobian computation
  }
`;
```

**Deliverable:** Drag end-effector → Robot moves to match 🎮

---

## 💥 PHASE 6: COLLISION DETECTION (Week 5-6)

### Objective
**Prevent invalid joint configurations**

### Implementation

#### 6.1 Collision Predictor
```typescript
// New file: src/kinematics/CollisionPredictor.ts
export class CollisionPredictor {
  /**
   * Predict collisions for joint motion
   */
  predictPath(
    jointId: string,
    startValue: number,
    endValue: number,
    steps: number = 10
  ): CollisionReport[];

  /**
   * Find collision-free path
   */
  findSafePath(
    jointValues: Map<string, number>,
    target: Map<string, number>
  ): Map<string, number>[] | null; // Array of waypoints

  /**
   * Real-time collision checking
   */
  checkConfiguration(
    jointValues: Map<string, number>
  ): CollisionResult;
}
```

#### 6.2 Visual Feedback
- 🔴 Red highlight on colliding parts
- 🟡 Yellow warning for near-collision (<5mm)
- 🟢 Green for safe motion
- 📊 Distance readout (e.g., "12mm clearance")

#### 6.3 Integration with IK
```typescript
// Constraint-aware IK with collision avoidance
const ikResult = ikSolver.solveWithConstraints(chainId, target, [
  new JointLimitConstraint(),
  new CollisionAvoidanceConstraint(minClearance: 10), // 10mm
  new SingularityAvoidanceConstraint()
]);
```

**Deliverable:** Safe motion planning with visual feedback 💥

---

## 🚀 PHASE 7: ADVANCED FEATURES (Week 6+)

### 7.1 Motion Recording & Playback
```typescript
// New file: src/kinematics/MotionRecorder.ts
export class MotionRecorder {
  startRecording(): void;
  stopRecording(): MotionTrajectory;
  playback(trajectory: MotionTrajectory, speed: number): void;
  exportToRobotProgram(format: 'KRL' | 'RAPID' | 'TP'): string;
}
```

### 7.2 CAD Kinematics Auto-Detection
**JT Files:**
```typescript
// src/loaders/jt/JTKinematicsExtractor.ts
- Parse JT assembly constraints
- Detect revolute/prismatic from constraint types
- Extract joint axes from constraint geometry
```

**CATIA Files:**
```typescript
// src/loaders/catia/CATIAKinematicsParser.ts
- Parse Product structure
- Extract constraints (coincident → revolute, distance → prismatic)
- Build kinematic tree
```

### 7.3 Multi-Robot Coordination
```typescript
// Support multiple robots in same scene
export class MultiRobotCoordinator {
  addRobot(robotId: string, chain: KinematicChain): void;
  synchronizeMotion(robots: string[]): void;
  checkInterference(robot1: string, robot2: string): boolean;
}
```

### 7.4 Physics-Based Simulation
```typescript
// Gravity, dynamics, contact forces
export class PhysicsSimulator {
  enableGravity(chainId: string): void;
  simulateDynamics(forces: Map<string, Vector3>): void;
  computeTorques(): Map<string, number>;
}
```

---

## 📊 IMPLEMENTATION TIMELINE

### Sprint 1 (Week 1-2): URDF + WebGPU Foundation
- [x] ForwardKinematicsSolver ✅
- [x] URDFJointExtractor ✅
- [ ] URDF auto-extraction integration
- [ ] WebGPU engine detection
- [ ] Performance monitoring

### Sprint 2 (Week 3-4): Visual Tools
- [ ] Joint placement gizmo
- [ ] Geometry analysis for joint suggestions
- [ ] WebGPU compute shader setup
- [ ] Basic IK solver (Jacobian)

### Sprint 3 (Week 5-6): Intelligence
- [ ] Collision detection
- [ ] IK with constraints
- [ ] Motion recording
- [ ] WebGPU-accelerated IK

### Sprint 4 (Week 7-8): CAD Integration
- [ ] JT kinematics extraction
- [ ] CATIA assembly parsing
- [ ] Multi-robot support
- [ ] Physics simulation

---

## 🎯 SUCCESS METRICS

### Performance (WebGPU vs WebGL)
- 📈 **Target:** 60 FPS with 500+ parts (WebGPU)
- 📈 **Target:** 30 FPS with 500+ parts (WebGL)
- 📈 **Target:** <16ms frame time (WebGPU)
- 📈 **Target:** IK solution in <50ms (WebGPU compute)

### User Experience
- ✅ Import URDF → Kinematics ready in 1 click
- ✅ Joint creation in <30 seconds
- ✅ IK target positioning with drag-and-drop
- ✅ Collision warnings before motion
- ✅ Robot program export (KRL, RAPID, TP)

### Technical
- ✅ 100% TypeScript type coverage
- ✅ Zero runtime errors in production
- ✅ <500KB bundle size increase
- ✅ WebGPU fallback to WebGL seamless

---

## 🔬 TESTING PLAN

### Test Robots
1. **Fanuc LRMate200iB** - 6-DOF industrial arm
2. **Fanuc M16iB** - Heavy-duty industrial robot
3. **KUKA iiwa14** - 7-DOF collaborative robot
4. **ABB IRB140** - 6-DOF assembly robot
5. **UR5** - Collaborative robot

### Test Scenarios
- [ ] Import URDF → Auto-create kinematics
- [ ] Forward kinematics (slider control)
- [ ] Inverse kinematics (drag target)
- [ ] Collision detection (self-collision + environment)
- [ ] Motion recording & playback
- [ ] Multi-robot coordination
- [ ] WebGPU performance (1000+ part scenes)

---

## 📚 RESOURCES

### Documentation
- [Babylon.js WebGPU](https://doc.babylonjs.com/setup/support/webGPU)
- [Rapier Physics](https://rapier.rs/docs/)
- [URDF Specification](http://wiki.ros.org/urdf/XML)
- [IK Algorithms](https://www.cs.cmu.edu/~15464-s13/lectures/lecture6/IK.pdf)

### Dependencies
- `@babylonjs/core` - 3D rendering
- `@babylonjs/loaders` - Model import
- `@dimforge/rapier3d-compat` - Physics
- `manifold-3d` - Boolean operations

### Tools
- Chrome Canary - WebGPU testing
- RenderDoc - GPU debugging
- SpectorJS - WebGPU profiling

---

## 🎊 FINAL VISION

**One Year from Now:**

```typescript
// User workflow in 2026:
1. Import robot URDF → Kinematics auto-detected ✨
2. Drag end-effector in 3D → IK solves instantly (WebGPU) 🚀
3. System warns of collision 10mm before impact 💥
4. Record motion → Export to robot controller (KRL/RAPID) 📹
5. Multi-robot cell coordination with interference checking 🤝
6. Physics simulation with gravity + dynamics ⚙️

// All powered by:
- WebGPU rendering (2-3x faster)
- GPU-accelerated IK solving
- Real-time collision detection
- CAD-native kinematics extraction
```

**kinetiCORE: The ultimate robot simulation platform on the web** 🤖✨

---

*Last Updated: January 2025*
*Owner: George (Architecture Lead)*
