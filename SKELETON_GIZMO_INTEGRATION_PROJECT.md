# 🦴 Skeleton Gizmo Integration Project

## 📋 Project Overview

Enhance the existing motion panel by adding a robot skeleton visualization layer that connects joint gizmos with link representations (cylinders/lines). This will help visualize the full kinematic chain in real-time during motion playback or joint manipulation.

**Duration:** 4 weeks  
**Owner:** Agent 2 (Cole) + Agent 3 (Edwin)  
**Integration Lead:** Agent 1 (George)  

---

## 🎯 Core Features

### 1. Skeleton Gizmo Layer
- Dynamically draw cylinders (or lines) between joint origins
- Auto-update when joints move
- Toggle visibility with the motion panel

### 2. Floating Coordinate Labels  
- Display XYZ (and optionally RPY) along each link
- Auto-align labels to camera orientation for readability

### 3. Link Data Integration
- Pull joint positions directly from the motion panel's state
- Maintain synchronization between gizmo visuals and robot data

### 4. Visual Customization
- Adjustable opacity, color coding per axis/link type
- Highlight active or moving joints

---

## 🏗️ Architecture Integration Points

### Existing Systems to Leverage
- **`UnifiedGizmoManager`** - Already handles TCP gizmos and IK targets
- **`KinematicsManager`** - Provides joint data and kinematic chains
- **`RobotJoggingPanelWithGizmo`** - Motion panel with existing gizmo integration
- **`IKTargetGizmoManager`** - 3D gizmo rendering system
- **Joint Debug Frames** - Already shows individual joint axes

### New Components to Create
- **`SkeletonGizmoManager`** - Core skeleton visualization system
- **`LinkVisualizationService`** - Handles link geometry generation
- **`CoordinateLabelManager`** - Manages floating coordinate labels
- **Skeleton Toggle Controls** - UI controls in motion panel

---

## 📅 Roadmap & Milestones

### 🏁 Phase 1: Foundation (Week 1)
**Goal:** Integrate base skeleton gizmo system into motion panel

#### Issues & Tasks

**Issue #1: Create SkeletonGizmoManager Core System**
- [ ] Create `src/kinematics/SkeletonGizmoManager.ts`
- [ ] Implement basic joint-to-joint link visualization
- [ ] Use `BABYLON.MeshBuilder.CreateCylinder()` for link meshes
- [ ] Integrate with existing `UnifiedGizmoManager` architecture
- [ ] Add skeleton visibility toggle to motion panel

**Issue #2: Motion Panel Integration**  
- [ ] Add skeleton controls to `RobotJoggingPanelWithGizmo.tsx`
- [ ] Register skeleton manager with motion panel lifecycle
- [ ] Auto-activate when joint widgets appear
- [ ] Ensure skeleton updates with joint movements

**Issue #3: Basic Link Rendering**
- [ ] Implement cylinder generation between consecutive joints
- [ ] Handle joint hierarchy traversal via `KinematicsManager`
- [ ] Apply proper coordinate transformations (Z-up system)
- [ ] Optimize for performance - reuse meshes instead of re-creating

**Deliverables:**
- ✅ Basic skeleton visualization working
- ✅ Motion panel toggle integration
- ✅ Cylinder links between joints

---

### 🔗 Phase 2: Data Binding & Synchronization (Week 2)  
**Goal:** Link gizmo positions to robot's current joint transforms

#### Issues & Tasks

**Issue #4: Real-time Joint Synchronization**
- [ ] Link skeleton positions to robot's current joint transforms
- [ ] Implement event listeners for live joint updates
- [ ] Sync with existing TCP gizmo update cycles (100ms interval)
- [ ] Handle joint angle changes in real-time

**Issue #5: Performance Optimization**
- [ ] Implement mesh reuse instead of recreation
- [ ] Add rendering group optimization (renderingGroupId = 2)
- [ ] Batch skeleton updates to avoid frame drops
- [ ] Add LOD (Level of Detail) for complex robots

**Issue #6: Multi-Robot Support**
- [ ] Handle multiple robots in scene simultaneously
- [ ] Robot-specific skeleton color coding
- [ ] Proper cleanup when robots are removed
- [ ] Chain-specific skeleton management

**Deliverables:**
- ✅ Real-time skeleton updates
- ✅ Optimized performance for 60fps
- ✅ Multi-robot skeleton support

---

### 🎨 Phase 3: UI/UX Enhancement (Weeks 3-4)
**Goal:** Add coordinate overlays and advanced visualization features

#### Issues & Tasks

**Issue #7: Coordinate Label System**
- [ ] Create `CoordinateLabelManager` for 3D text overlays
- [ ] Display XYZ coordinates along each link
- [ ] Optional RPY (Roll-Pitch-Yaw) display
- [ ] Auto-align labels to camera orientation
- [ ] Use `GUI.AdvancedDynamicTexture` for 3D labels

**Issue #8: Advanced Motion Panel Controls**
- [ ] Add "Show Skeleton" toggle button
- [ ] Add "Show Coordinates" toggle button  
- [ ] Skeleton opacity slider (0-100%)
- [ ] Link thickness adjustment
- [ ] Color scheme selector (chain-based, joint-based, custom)

**Issue #9: Visual Polish & Customization**
- [ ] Implement chain-specific color coding
- [ ] Add highlight for active/moving joints
- [ ] Support depth fade for better 3D perception
- [ ] Add transparency/opacity controls
- [ ] Implement smooth animations for joint movements

**Issue #10: Humanoid Robot Expansion**
- [ ] Detect humanoid vs industrial robot types
- [ ] Specialized skeleton rendering for humanoids
- [ ] Support for branching kinematic trees (arms, legs, torso)
- [ ] Humanoid-specific color schemes

**Deliverables:**
- ✅ Full coordinate overlay system
- ✅ Advanced motion panel controls
- ✅ Polished visual experience
- ✅ Humanoid robot support

---

### 🧪 Phase 4: Testing & Finalization (Week 4)
**Goal:** Validate against real robot data and polish edge cases

#### Issues & Tasks

**Issue #11: Robot Data Validation**
- [ ] Test against actual URDF robot models
- [ ] Validate with MJCF humanoid models
- [ ] Test with JT industrial robot files
- [ ] Verify coordinate system consistency (Z-up)

**Issue #12: Motion Playback Integration**
- [ ] Test skeleton during keyframe playback
- [ ] Validate with pose library loading
- [ ] Ensure smooth skeleton animation
- [ ] Handle rapid joint movements gracefully

**Issue #13: Edge Case Handling**
- [ ] Handle robots with no joints gracefully
- [ ] Support fixed joints in skeleton
- [ ] Handle malformed kinematic chains
- [ ] Proper cleanup on robot deletion

**Issue #14: Documentation & Examples**
- [ ] Create skeleton system documentation
- [ ] Add usage examples to motion panel guide
- [ ] Document performance considerations
- [ ] Create troubleshooting guide

**Deliverables:**
- ✅ Comprehensive testing complete
- ✅ Edge cases handled
- ✅ Documentation complete
- ✅ Production-ready system

---

## 🔮 Future Extensions (Post-MVP)

### Advanced Features
- **Joint Path Tracing** - History trails showing joint movement over time
- **Interactive Joint Selection** - Click skeleton links to select joints
- **Physics-Driven Tendon Visualization** - Show virtual tendons/cables
- **IK/FK Overlay Toggles** - Visual distinction between IK and FK modes
- **Collision Visualization** - Show collision boundaries along skeleton
- **Force/Torque Visualization** - Color-code links based on joint forces

### Integration Opportunities
- **Path Planning Visualization** - Show planned paths along skeleton
- **Simulation Recording** - Record skeleton animations for playback
- **AR/VR Support** - Export skeleton for mixed reality applications
- **Performance Analytics** - Joint usage heatmaps over time

---

## 🛠️ Technical Implementation Details

### File Structure
```
src/
├── kinematics/
│   ├── SkeletonGizmoManager.ts          # Core skeleton system
│   ├── LinkVisualizationService.ts      # Link geometry generation
│   └── CoordinateLabelManager.ts        # 3D coordinate labels
├── ui/components/
│   ├── RobotJoggingPanelWithGizmo.tsx   # Enhanced motion panel
│   └── SkeletonControls.tsx             # Skeleton-specific UI controls
└── manipulation/
    └── SkeletonGizmoWrapper.ts          # Integration with UnifiedGizmoManager
```

### Key Integration Points
1. **UnifiedGizmoManager** - Register skeleton as new gizmo type
2. **KinematicsManager** - Source joint data and chain information  
3. **Motion Panel** - UI controls and lifecycle management
4. **Scene Rendering** - Proper rendering order and performance

### Performance Considerations
- **Mesh Reuse** - Cache cylinder meshes, only update transforms
- **Batch Updates** - Update all skeleton links in single frame
- **LOD System** - Simplify skeleton for distant/small robots
- **Rendering Groups** - Use renderingGroupId for proper depth ordering

### Coordinate System Compliance
- **Z-up Consistency** - All skeleton rendering in kinetiCORE Z-up system
- **Unit Conversion** - Handle mm ↔ m conversion via `CoordinateSystem.ts`
- **Transform Chain** - Proper joint origin → world space transformations

---

## 📊 Success Metrics

### Phase 1 Success Criteria
- [ ] Skeleton visualization appears in motion panel
- [ ] Basic cylinder links render between joints
- [ ] Toggle controls work properly
- [ ] No performance degradation (<50ms frame time)

### Phase 2 Success Criteria  
- [ ] Real-time skeleton updates with joint movements
- [ ] Support for 3+ robots simultaneously
- [ ] Maintains 60fps with complex robots (20+ joints)
- [ ] Proper cleanup on robot removal

### Phase 3 Success Criteria
- [ ] Coordinate labels readable and properly oriented
- [ ] Advanced controls functional and intuitive
- [ ] Visual polish meets kinetiCORE design standards
- [ ] Humanoid robots render correctly

### Phase 4 Success Criteria
- [ ] All robot formats supported (URDF, MJCF, JT)
- [ ] No critical bugs in production testing
- [ ] Documentation complete and accurate
- [ ] User feedback positive (>4/5 rating)

---

## 🚀 Getting Started

### Prerequisites
- Existing kinetiCORE development environment
- Understanding of Babylon.js mesh creation
- Familiarity with React component lifecycle
- Knowledge of TypeScript and kinematics concepts

### Quick Start Commands
```bash
# 1. Create feature branch
git checkout -b feature/skeleton-gizmo-integration

# 2. Run development server
npm run dev

# 3. Load a robot with joints (URDF/MJCF)
# 4. Open Motion panel
# 5. Test basic skeleton visualization

# 6. Run tests
npm run test -- --grep "skeleton"

# 7. Check performance
npm run test:performance
```

### Development Workflow
1. **Phase 1:** Focus on core `SkeletonGizmoManager` implementation
2. **Phase 2:** Integrate with motion panel and test real-time updates
3. **Phase 3:** Add UI controls and visual polish
4. **Phase 4:** Comprehensive testing and documentation

### Code Review Process
- All skeleton-related PRs require review from Agent 1 (George)
- Performance-critical changes need benchmarking
- UI changes require UX review from Agent 3 (Edwin)
- Integration changes need architecture review

---

## 📞 Support & Communication

### Team Coordination
- **Daily Standups:** Async in Slack at 9 AM
- **Integration Sessions:** Friday 4 PM  
- **Blocker Escalation:** `#dev-blockers` Slack channel
- **Architecture Questions:** Tag Agent 1 (George)

### Resources
- **Babylon.js Mesh Documentation:** https://doc.babylonjs.com/features/featuresDeepDive/mesh
- **kinetiCORE Coordinate System:** `/workspace/COORDINATE_SYSTEM.md`
- **Motion Panel Architecture:** `/workspace/src/ui/components/RobotJoggingPanelWithGizmo.tsx`
- **Gizmo System Guide:** `/workspace/src/kinematics/UnifiedGizmoManager.ts`

---

*This project plan is designed to integrate seamlessly with your existing kinetiCORE architecture while adding powerful skeleton visualization capabilities to enhance robot motion understanding and debugging.*