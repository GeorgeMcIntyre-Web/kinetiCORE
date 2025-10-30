# Cursor Agent Quick-Start Guide
## Project Manager Coordination Tasks

**READ THIS FIRST:** See [PROJECT_MANAGER_BRIEF.md](./PROJECT_MANAGER_BRIEF.md) for comprehensive details.

---

## 🎯 Your Mission

You are one of 5 Cursor agents coordinated by Claude Code (Agent 1 - Project Manager). Your goal is to complete a comprehensive code review, eliminate technical debt, and ensure all current features are production-ready.

---

## 🚦 Quick Status

- ✅ **Build Status:** TypeScript compilation passing
- ⚠️ **Technical Debt:** 72 TODOs across 39 files
- ⚠️ **Uncommitted Changes:** 8 files modified
- 🔴 **Missing Features:** Splash screen, demo assets

---

## 📋 Agent Assignments

### Agent 1: Device Manipulation & Gizmo System
**Focus:** URDF/MJCF device movement with UnifiedGizmoManager

**Files to Review:**
```
src/kinematics/UnifiedGizmoManager.ts ⚠️ (uncommitted)
src/loaders/mjcf/MJCFLoader.ts
src/loaders/urdf/URDFLoader.ts
src/ui/components/RobotJoggingPanelWithGizmo.tsx ⚠️ (uncommitted)
```

**Tasks:**
1. Review uncommitted changes in UnifiedGizmoManager.ts
2. Test MJCF device selection → gizmo attaches correctly
3. Test URDF device selection → gizmo attaches correctly
4. Verify joint visualization during manipulation
5. Document any bugs or edge cases

**Test Cases:**
- Load FANUC robot (URDF) → Click on link → Gizmo should attach
- Load humanoid (MJCF) → Click on limb → Gizmo should attach
- Move device with gizmo → Kinematic chain should update

---

### Agent 2: Project Save/Load & World Manager
**Focus:** WorldSaveManager reliability and ProjectDatabase TODOs

**Files to Review:**
```
src/scene/WorldSaveManager.ts ⚠️ (uncommitted)
src/project/ProjectManager.ts (2 TODOs)
src/project/ProjectDatabase.ts (8 TODOs - CRITICAL)
src/project/AssetInstanceManager.ts
```

**Critical TODOs to Resolve:**
```typescript
// ProjectDatabase.ts
- TODO: Implement autosave (every 2 minutes)
- TODO: Add project recovery on crash
- TODO: Implement project versioning
- TODO: Add project collaboration features
```

**Tasks:**
1. Review uncommitted changes in WorldSaveManager.ts
2. Resolve P0 TODOs in ProjectDatabase (autosave, recovery)
3. Test project save with 10+ assets → verify no data loss
4. Test project load → verify all assets reload correctly
5. Document project data schema

---

### Agent 3: Kinematics End-to-End Testing
**Focus:** Complete kinematics workflow from backend to frontend

**Files to Review:**
```
src/kinematics/ForwardKinematicsSolver.ts (3 TODOs)
src/kinematics/InverseKinematicsSolver.ts
src/kinematics/KinematicsManager.ts
src/loaders/mjcf/MJCFActuatorIntegration.ts
src/ui/components/WholeBodyIKPanel.tsx
src/ui/components/ActuatorControlPanel.tsx
```

**Test Scenarios:**
1. **6-axis robot (FANUC):**
   - Load URDF → Move end-effector with gizmo → Verify joints update (IK)
   - Adjust joints in panel → Verify end-effector moves (FK)

2. **Humanoid (FullBody IK):**
   - Load MJCF → Place target gizmos for hands/feet → Verify IK solver

3. **Quadruped (Spot):**
   - Load MJCF → Test leg kinematics → Verify foot placement

**Performance Requirements:**
- FK solver: <16ms per frame (60 FPS)
- IK solver: Converge within 100 iterations
- Joint limits: Respected from MJCF/URDF

---

### Agent 4: Asset Library & Demo Data
**Focus:** Populate asset library with 50+ demo assets

**Files to Review:**
```
src/library/AssetUploadService.ts ⚠️ (uncommitted)
src/library/AssetLoader.ts (5 TODOs)
src/library/UserAwareAssetManager.ts (4 TODOs)
src/ui/components/AssetLibrary/AssetLibraryPanelV2.tsx ⚠️ (uncommitted)
```

**Demo Assets Needed (Minimum 50):**
```
Robots (20):
- Industrial: FANUC, ABB, KUKA, Yaskawa (URDF/JT)
- Collaborative: UR10, Franka Emika (URDF)
- Mobile: Boston Dynamics Spot, Unitree Go1 (MJCF)
- Humanoid: Generic humanoid for IK testing (MJCF)

Grippers (10):
- Schunk, Robotiq, OnRobot (URDF)

Conveyors (5):
- Belt, roller, chain conveyors (various lengths)

Factory Fixtures (15):
- Safety fencing, worktables, tool racks, part bins
```

**Tasks:**
1. Audit existing assets in library (count available)
2. Create asset seeding script or process
3. Test user asset upload for all formats (URDF, MJCF, JT, STL, glTF, USD)
4. Verify asset thumbnails generate correctly
5. Test search and filter functionality

---

### Agent 5: Branch Management & Documentation
**Focus:** Synchronize branches and create documentation

**Remote Branches to Review:**
```
✅ Likely ready to merge:
- feature/cloud-asset-library
- feature/transform-controls-snap-system

⚠️ Needs review:
- GUI_ENHANCEMENT (major UI changes)
- NODE-SELECTION
- feature/jt-import

❌ Consider deleting:
- bug_removal (check if merged)
- bug_resolution_2
- repair-branch
- cursor/* (temporary)
```

**Tasks:**
1. For each branch: checkout → merge main → test build
2. Document merge conflicts and resolution plan
3. Identify abandoned branches for deletion
4. Commit current working directory changes (8 files)
5. Update documentation for completed features

**Branch Review Process:**
```bash
git checkout <branch>
git merge main
npm run lint && npm run type-check && npm test && npm run build

# If passing: recommend merge
# If failing: document issues
# If abandoned: recommend deletion
```

---

## 🚨 Missing Critical Features

### 1. Splash Screen (NOT STARTED)
**Owner:** Agent 1 or 2 (whoever finishes first)

**Requirements:**
- Professional loading animation
- Cycling messages every 3 seconds:
  1. "Welcome to kinetiCORE"
  2. "Loading Physics Engine..."
  3. "Preparing Kinematics Solver..."
  4. "Initializing Asset Library..."
- Smooth fade-out when app loads
- Works on all screen sizes

**New Files:**
```
src/ui/components/SplashScreen.tsx
src/hooks/useAppInitialization.ts
```

---

### 2. Kinematics Target Structure (NEW DESIGN)
**Owner:** Agent 3

**Goal:** Unified transformation array with metadata for all robot types

**See:** [PROJECT_MANAGER_BRIEF.md](./PROJECT_MANAGER_BRIEF.md#6-kinematics-target-structure-design-) for detailed design

**New Files:**
```
src/kinematics/types/TargetStructure.ts
src/kinematics/managers/TargetArrayManager.ts
src/kinematics/converters/MJCFToTargetArray.ts
src/kinematics/converters/URDFToTargetArray.ts
src/kinematics/__tests__/TargetStructure.test.ts
```

---

## 🔧 Priority TODOs by File

### P0 - Critical (Fix This Week)
```
src/project/ProjectDatabase.ts                 8 TODOs
src/kinematics/UnifiedGizmoManager.ts          (uncommitted changes)
src/scene/WorldSaveManager.ts                  (uncommitted changes)
```

### P1 - High (Fix Next Week)
```
src/library/AssetLoader.ts                     5 TODOs
src/library/UserAwareAssetManager.ts           4 TODOs
src/kinematics/device/DeviceClassifier.ts      4 TODOs
src/kinematics/ForwardKinematicsSolver.ts      3 TODOs
```

### P2 - Medium
```
src/loaders/dwg/DWGDatabaseToBabylonConverter.ts  3 TODOs
src/physics/RapierPhysicsEngine.ts                2 TODOs
src/project/ProjectManager.ts                     2 TODOs
```

---

## ✅ Definition of Done

### For Each Task:
- [ ] Code changes tested locally
- [ ] TypeScript compilation passes
- [ ] No ESLint warnings
- [ ] Unit tests written (if applicable)
- [ ] Documentation updated
- [ ] Changes committed with clear message

### For Each Feature:
- [ ] End-to-end workflow tested
- [ ] Edge cases documented
- [ ] Performance verified (60 FPS)
- [ ] User experience validated
- [ ] Integration with other features tested

---

## 📞 Communication

### Daily Updates
Post in coordination channel:
```
Agent X Update:
✅ Completed: [list tasks]
🔄 In Progress: [current task]
🚧 Blocked: [blockers]
📅 Next: [tomorrow's plan]
```

### Blockers
If blocked >2 hours:
1. Post in channel with details
2. Tag relevant agent(s)
3. Escalate to Project Manager (Claude Code)

---

## 🚀 Getting Started

1. **Read:** [PROJECT_MANAGER_BRIEF.md](./PROJECT_MANAGER_BRIEF.md) (full details)
2. **Find your assignment** in this document
3. **Review your files** and create task list
4. **Post initial assessment** in coordination channel
5. **Start working** on P0 tasks first

---

## 📚 Key Resources

### Documentation
- [Architecture](./architecture.md)
- [Physics API](./PHYSICS_API.md)
- [MJCF Kinematic System](./MJCF_KINEMATIC_SYSTEM_GUIDE.md)
- [Asset Management](./ASSET_MANAGEMENT_README.md)

### Testing
- Run tests: `npm test`
- Type check: `npm run type-check`
- Lint: `npm run lint`
- Build: `npm run build`

### Git Workflow
```bash
# Before starting work
git checkout main
git pull origin main
git checkout -b feature/your-task

# During work
git add .
git commit -m "feat: descriptive message"

# Before PR
npm run lint && npm run type-check && npm test && npm run build
```

---

## 🎯 Success Criteria

**You'll know you're done when:**
- ✅ All assigned files reviewed
- ✅ All P0 TODOs in your area resolved
- ✅ All test cases passing
- ✅ Documentation updated
- ✅ Changes committed and pushed
- ✅ Feature works end-to-end

**Remember:** Quality over speed. This is about achieving production-ready code.

---

**Good luck! Let's build something amazing! 🚀**

---

**Document Version:** 1.0
**Last Updated:** 2025-10-23
**Project Manager:** Claude Code (Agent 1)
