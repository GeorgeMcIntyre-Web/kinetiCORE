# Phase 2 Agent Assignment Cards
## Copy/Paste These Into Each Cursor Instance

---

## 🤖 Agent 6 Assignment

```
You are Agent 6 in Phase 2 of a coordinated 6-agent sprint.

YOUR ROLE: UI Polish & Selection Indicator

READ THESE FILES FIRST:
1. docs/PHASE2_PROJECT_MANAGER_BRIEF.md (comprehensive details)
2. docs/PHASE2_AGENT_ASSIGNMENTS.md (this file - your section)
3. AGENT6_SELECTION_INDICATOR_PROJECT.md (detailed spec)

YOUR PRIMARY TASKS:
1. Create world selection indicator (always-visible selection name)
2. Implement splash screen with cycling messages (deferred from Phase 1)
3. Add loading states and progress indicators
4. Polish UI animations and transitions
5. Improve tooltips and user feedback

YOUR FILES TO CREATE:
- src/ui/components/SelectionIndicator.tsx (NEW)
- src/ui/components/SplashScreen.tsx (NEW)
- src/ui/components/LoadingStates.tsx (NEW)

YOUR FILES TO MODIFY:
- src/ui/layouts/EssentialModeLayout.tsx (add selection indicator)
- src/App.tsx (add splash screen)

SELECTION INDICATOR REQUIREMENTS:
- Position: Top-left corner (10px from edges)
- Size: Compact (200px wide, 30px tall max)
- Background: Semi-transparent dark (rgba(0, 0, 0, 0.7))
- Text: White, 12px font
- Always visible, updates in real-time
- Shows "No selection" when nothing selected
- Shows object name when one selected
- Shows "X objects selected" when multiple selected

SPLASH SCREEN REQUIREMENTS:
- Shows on app load
- Cycling messages every 3 seconds:
  1. "Welcome to kinetiCORE - The Future of Robot Simulation"
  2. "Loading 3D Physics Engine..."
  3. "Preparing Kinematics Solver..."
  4. "Initializing Asset Library..."
  5. "Connecting to Cloud Storage..."
  6. "Almost Ready..."
- Smooth fade-out when app loads
- Professional branding

START HERE: Create SelectionIndicator component first

REFERENCE FILES:
- src/ui/store/editorStore.ts (selection state)
- src/scene/SceneTreeManager.ts (object names)
- src/ui/components/FloatingPanel/ (UI styling reference)

When you complete a task, update docs/SPRINT_PROGRESS_TRACKER.md

Begin work now.
```

---

## 🤖 Agent 7 Assignment

```
You are Agent 7 in Phase 2 of a coordinated 6-agent sprint.

YOUR ROLE: Integration Testing & E2E Validation

READ THESE FILES FIRST:
1. docs/PHASE2_PROJECT_MANAGER_BRIEF.md (comprehensive details)
2. docs/PHASE2_AGENT_ASSIGNMENTS.md (this file - your section)
3. docs/SPRINT_FINAL_SUMMARY.md (Phase 1 results)

YOUR PRIMARY TASKS:
1. Test Agent 2's autosave with 10+ assets (coordinate with Agent 8)
2. Test Agent 3's target structure with IK solvers
3. Test Agent 4's asset library workflows (upload, load, cache)
4. Test ROS2 integration (connect, send trajectory, export)
5. Test cloud asset storage
6. Create comprehensive E2E test suite

YOUR FILES TO CREATE:
- src/__tests__/integration/AutosaveIntegration.test.ts (NEW)
- src/__tests__/integration/TargetStructureIntegration.test.ts (NEW)
- src/__tests__/integration/AssetLibraryIntegration.test.ts (NEW)
- src/__tests__/integration/ROS2Integration.test.ts (NEW)
- src/__tests__/e2e/FullWorkflow.test.ts (NEW)
- docs/TESTING_REPORT_PHASE2.md (NEW)

TEST SCENARIOS:
1. Autosave Test:
   - Load scene
   - Add 10 assets
   - Modify scene
   - Wait 2 minutes (autosave should trigger)
   - Simulate crash (close without saving)
   - Reload app
   - Verify recovery prompt appears
   - Accept recovery
   - Verify all assets restored

2. Target Structure Test:
   - Load humanoid MJCF model
   - Create IK targets for hands and feet
   - Place targets in new positions
   - Run IK solver
   - Verify joints update correctly
   - Save project
   - Reload project
   - Verify targets persist

3. Asset Library Test:
   - Upload new asset (URDF file)
   - Verify asset appears in library
   - Load asset from cloud
   - Verify caching works (second load faster)
   - Search for asset
   - Filter by type

4. ROS2 Integration Test:
   - Connect to ROS bridge (mock server)
   - Send joint trajectory
   - Export to ROS2 launch file
   - Verify launch file format

5. Full Workflow Test:
   - Load project from cloud
   - Add robot from asset library
   - Configure kinematics
   - Create IK targets
   - Save project
   - Reload project
   - Verify everything restored
   - Export to ROS2

START HERE: Setup test infrastructure, coordinate with Agent 8 for autosave testing

CRITICAL: Work closely with Agent 8 on autosave testing BEFORE merge

When you complete a task, update docs/SPRINT_PROGRESS_TRACKER.md

Begin work now.
```

---

## 🤖 Agent 8 Assignment

```
You are Agent 8 in Phase 2 of a coordinated 6-agent sprint.

YOUR ROLE: Merge & Deploy Autosave Feature

READ THESE FILES FIRST:
1. docs/PHASE2_PROJECT_MANAGER_BRIEF.md (comprehensive details)
2. docs/PHASE2_AGENT_ASSIGNMENTS.md (this file - your section)
3. docs/AGENT2_COMPLETION_REPORT.md (autosave implementation details)
4. docs/AUTOSAVE_AND_RECOVERY.md (usage guide)

YOUR PRIMARY TASKS:
1. Review feature/autosave-crash-recovery branch
2. Test autosave with 10+ assets (coordinate with Agent 7)
3. Test crash recovery simulation
4. Fix any issues found during testing
5. Merge to main
6. Deploy to production
7. Monitor for issues

YOUR BRANCH TO REVIEW:
feature/autosave-crash-recovery

FILES TO REVIEW:
- src/project/ProjectManager.ts (autosave logic)
- src/scene/WorldSaveManager.ts (restoration logic)
- docs/AUTOSAVE_AND_RECOVERY.md (user guide)

MERGE PROCESS:
```bash
# 1. Review branch
git checkout feature/autosave-crash-recovery
git pull origin feature/autosave-crash-recovery
npm run type-check
npm run lint

# 2. Test with Agent 7
# Run Agent 7's autosave integration tests
npm run test

# 3. Merge to main
git checkout main
git pull origin main
git merge feature/autosave-crash-recovery

# If conflicts, resolve them
# Then run tests again
npm run type-check
npm run test
npm run build

# 4. Push
git push origin main

# 5. Deploy
npm run build
npx wrangler pages deploy dist --project-name=kineticore

# 6. Monitor
# Check Cloudflare dashboard for errors
# Monitor for 24 hours
```

TESTING CHECKLIST:
- [ ] Autosave triggers after 2 minutes
- [ ] Autosave detects changes (doesn't save if no changes)
- [ ] Crash recovery saves to localStorage
- [ ] Recovery prompt appears on reload
- [ ] Accepting recovery restores full scene
- [ ] Works with 10+ assets
- [ ] Works with complex scenes
- [ ] No memory leaks
- [ ] No performance impact

START HERE: Checkout branch, review code, coordinate testing with Agent 7

CRITICAL: Do NOT merge until Agent 7 completes testing and gives approval

When you complete a task, update docs/SPRINT_PROGRESS_TRACKER.md

Begin work now.
```

---

## 🤖 Agent 9 Assignment

```
You are Agent 9 in Phase 2 of a coordinated 6-agent sprint.

YOUR ROLE: Target Structure Integration

READ THESE FILES FIRST:
1. docs/PHASE2_PROJECT_MANAGER_BRIEF.md (comprehensive details)
2. docs/PHASE2_AGENT_ASSIGNMENTS.md (this file - your section)
3. docs/AGENT3_WORK_SUMMARY.md (target structure design)
4. docs/PROJECT_MANAGER_BRIEF.md (section 6 - target structure design)

YOUR PRIMARY TASKS:
1. Integrate target structure with UnifiedGizmoManager (Agent 1's work)
2. Integrate with Project save/load (Agent 2's work)
3. Integrate with Asset library (Agent 4's work)
4. Integrate with WholeBodyIKPanel
5. Create converters (MJCF→TargetArray, URDF→TargetArray)
6. Write unit tests for all components

YOUR FILES (EXISTS):
- docs/AGENT3_WORK_SUMMARY.md (design specification)

YOUR FILES TO CREATE:
- src/kinematics/types/TargetStructure.ts (implement the types from design)
- src/kinematics/managers/TargetArrayManager.ts (NEW - CRUD operations)
- src/kinematics/converters/MJCFToTargetArray.ts (NEW)
- src/kinematics/converters/URDFToTargetArray.ts (NEW)
- src/__tests__/kinematics/TargetStructure.test.ts (NEW)
- src/__tests__/kinematics/TargetArrayManager.test.ts (NEW)
- docs/TARGET_STRUCTURE_INTEGRATION.md (NEW)

YOUR FILES TO MODIFY:
- src/kinematics/UnifiedGizmoManager.ts (add attachToTarget method)
- src/scene/WorldSaveManager.ts (save/load targets)
- src/ui/components/WholeBodyIKPanel.tsx (use targets)
- src/library/AssetLibraryManager.ts (default targets)

INTEGRATION POINTS:

1. Gizmo Manager Integration:
```typescript
// Add to UnifiedGizmoManager.ts
public attachToTarget(target: KinematicTarget): void {
  // Create 3D gizmo at target position
  // Update gizmo when target moves
}
```

2. Save/Load Integration:
```typescript
// Add to WorldSaveManager.ts
private saveTargets(): TargetArray {
  // Serialize all kinematic targets
}

private loadTargets(data: TargetArray): void {
  // Deserialize and restore targets
}
```

3. IK Solver Integration:
```typescript
// Update WholeBodyIKSolver.ts
public solve(targets: KinematicTarget[]): void {
  // Use target structure for IK solving
}
```

4. Asset Library Integration:
```typescript
// Add to AssetLibraryManager.ts
public getDefaultTargets(robotType: RobotType): TargetArray {
  // Return default targets for robot type
}
```

CONVERTERS TO IMPLEMENT:

MJCFToTargetArray:
- Parse MJCF file
- Detect robot type (humanoid, quadruped, etc.)
- Extract joint information
- Create appropriate targets for robot type

URDFToTargetArray:
- Parse URDF file
- Detect robot type (6-axis, collaborative, etc.)
- Extract link/joint information
- Create end-effector target

START HERE: Study Agent 3's design document, implement TypeScript types

REFERENCE FILES:
- src/kinematics/InverseKinematicsSolver.ts (IK solver interface)
- src/kinematics/ForwardKinematicsSolver.ts (FK solver interface)
- src/loaders/mjcf/MJCFKinematicExtractor.ts (MJCF parsing)
- src/loaders/urdf/URDFLoader.ts (URDF parsing)

When you complete a task, update docs/SPRINT_PROGRESS_TRACKER.md

Begin work now.
```

---

## 🤖 Agent 10 Assignment

```
You are Agent 10 in Phase 2 of a coordinated 6-agent sprint.

YOUR ROLE: Performance Optimization

READ THESE FILES FIRST:
1. docs/PHASE2_PROJECT_MANAGER_BRIEF.md (comprehensive details)
2. docs/PHASE2_AGENT_ASSIGNMENTS.md (this file - your section)
3. docs/SPRINT_FINAL_SUMMARY.md (current bundle sizes)

YOUR PRIMARY TASKS:
1. Bundle size analysis and reduction (target: 20% smaller)
2. Code splitting optimization
3. Asset loading performance
4. Rendering performance (60 FPS with 50 objects)
5. Memory profiling and optimization
6. Database query optimization

YOUR FILES TO ANALYZE:
- vite.config.ts (code splitting configuration)
- src/library/AssetLoader.ts (asset loading)
- src/scene/SceneManager.ts (rendering)
- src/physics/RapierPhysicsEngine.ts (physics)
- src/ui/components/* (React components)

CURRENT STATE (from Phase 1 build):
- vendor-babylon: 6,650KB
- dwg-loader: 9,366KB
- vendor-physics: 1,986KB
- index: 1,453KB
- Total: ~20MB

TARGET STATE:
- Bundle size: <16MB (20% reduction)
- Initial load: <3 seconds
- FPS: 60 with 50+ objects
- Memory: <500MB with complex scenes

OPTIMIZATION STRATEGIES:

1. Code Splitting:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'dwg-loader': ['./src/loaders/dwg/*'],
          'ros2': ['./src/ros2/*'],
          'cloud-assets': ['./src/library/CloudAssetAPI.ts']
        }
      }
    }
  }
});
```

2. Lazy Loading:
```typescript
// Lazy load DWG loader (9.4MB)
const DWGLoader = lazy(() => import('./loaders/dwg/DWGLoader'));

// Lazy load ROS2 module
const ROS2Panel = lazy(() => import('./ui/components/ROS2Panel'));
```

3. Asset Optimization:
- Implement progressive loading
- Use lower-res thumbnails
- Compress textures
- Use WebP format

4. Rendering Optimization:
- Implement level of detail (LOD)
- Occlusion culling
- Frustum culling
- Batch rendering

5. React Optimization:
- Memoize expensive components
- Virtual scrolling for lists
- Debounce state updates
- Use React.memo strategically

YOUR DELIVERABLES:
- docs/PERFORMANCE_AUDIT_REPORT.md (before/after metrics)
- vite.config.ts (optimized configuration)
- Optimized components (with React.memo)
- Performance monitoring dashboard

TESTING REQUIREMENTS:
- Test with 50 objects in scene
- Measure FPS before and after
- Measure bundle size before and after
- Measure initial load time
- Measure memory usage

START HERE: Run bundle analysis, identify biggest chunks

COMMANDS:
```bash
# Bundle analysis
npm run build
npx vite-bundle-visualizer

# Performance testing
npm run dev
# Open browser DevTools
# Measure FPS with 50 objects loaded
```

When you complete a task, update docs/SPRINT_PROGRESS_TRACKER.md

Begin work now.
```

---

## 🤖 Agent 11 Assignment

```
You are Agent 11 in Phase 2 of a coordinated 6-agent sprint.

YOUR ROLE: User Documentation & Guides

READ THESE FILES FIRST:
1. docs/PHASE2_PROJECT_MANAGER_BRIEF.md (comprehensive details)
2. docs/PHASE2_AGENT_ASSIGNMENTS.md (this file - your section)
3. docs/SPRINT_FINAL_SUMMARY.md (features deployed)

YOUR PRIMARY TASKS:
1. Write user guide for new features (autosave, ROS2, cloud assets, targets)
2. Create tutorial scripts/storyboards (5-10 tutorials)
3. Write API documentation
4. Create troubleshooting guide
5. Write FAQ
6. Create release notes for v1.1

YOUR FILES TO CREATE:

User Guides:
- docs/user-guide/GETTING_STARTED.md (NEW)
- docs/user-guide/AUTOSAVE_RECOVERY.md (NEW)
- docs/user-guide/ROS2_INTEGRATION.md (NEW)
- docs/user-guide/CLOUD_ASSETS.md (NEW)
- docs/user-guide/KINEMATICS_TARGETS.md (NEW)

Tutorials:
- docs/tutorials/TUTORIAL_01_BASIC_SETUP.md (NEW)
- docs/tutorials/TUTORIAL_02_LOADING_ROBOTS.md (NEW)
- docs/tutorials/TUTORIAL_03_KINEMATICS.md (NEW)
- docs/tutorials/TUTORIAL_04_ROS2_EXPORT.md (NEW)
- docs/tutorials/TUTORIAL_05_CLOUD_ASSETS.md (NEW)

API Documentation:
- docs/api/KINEMATICS_API.md (NEW)
- docs/api/ASSET_LIBRARY_API.md (NEW)
- docs/api/ROS2_API.md (NEW)
- docs/api/PROJECT_MANAGER_API.md (NEW)

Other:
- docs/TROUBLESHOOTING.md (NEW)
- docs/FAQ.md (NEW)
- RELEASE_NOTES.md (NEW)

DOCUMENTATION STRUCTURE:

Getting Started:
- Installation
- Creating first project
- Loading a robot
- Basic manipulation
- Saving work

Autosave & Recovery:
- How autosave works
- Configuring autosave interval
- Understanding crash recovery
- Recovering from crashes
- Disabling autosave

ROS2 Integration:
- Prerequisites (ROS2 installation)
- Connecting to ROS bridge
- Sending trajectories
- Exporting launch files
- Troubleshooting connection issues

Cloud Assets:
- Browsing asset library
- Filtering and searching
- Loading assets
- Uploading custom assets
- Sharing assets with team
- Managing storage

Kinematics Targets:
- Understanding target structure
- Creating IK targets
- Placing targets
- Running IK solver
- Saving targets with project
- Target types (6-axis, humanoid, quadruped)

TUTORIAL FORMAT:
```markdown
# Tutorial: [Title]

**Duration:** X minutes
**Difficulty:** Beginner/Intermediate/Advanced
**Prerequisites:** [List prerequisites]

## What You'll Learn
- [Learning objective 1]
- [Learning objective 2]

## Step 1: [Action]
[Detailed instructions with screenshots]

## Step 2: [Action]
[Detailed instructions]

...

## Next Steps
[Link to related tutorials]
```

API DOCUMENTATION FORMAT:
```markdown
# [API Name] API

## Overview
[Brief description]

## Classes

### ClassName
[Description]

**Methods:**
- `methodName(param1: type, param2: type): returnType`
  - Description
  - Parameters
  - Returns
  - Example

## Usage Example
```typescript
[Code example]
```
```

START HERE: Outline user guide structure, coordinate with other agents for feature details

REFERENCE FILES:
- All AGENT*_COMPLETION_REPORT.md files (feature details)
- docs/SPRINT_FINAL_SUMMARY.md (deployed features)
- Source code for API documentation

When you complete a task, update docs/SPRINT_PROGRESS_TRACKER.md

Begin work now.
```

---

## 📝 Summary

**6 Agents Ready for Phase 2:**
- Agent 6: UI Polish (2-3 days)
- Agent 7: Integration Testing (3-4 days)
- Agent 8: Merge Autosave (1-2 days)
- Agent 9: Target Integration (3-4 days)
- Agent 10: Performance (2-3 days)
- Agent 11: Documentation (2-3 days)

**Total Phase 2 Duration:** 5-7 days

**Coordination:** High coordination between agents (especially 7↔8, 9↔1/2/4)

**Deployment:** Incremental (autosave Day 3, UI Day 4, etc.)

---

**Ready to launch Phase 2! 🚀**
