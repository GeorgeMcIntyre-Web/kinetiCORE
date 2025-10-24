# Agent Assignment Cards
## Copy/Paste These Into Each Cursor Instance

---

## 🤖 Agent 1 Assignment

```
You are Agent 1 in a coordinated 5-agent sprint.

YOUR ROLE: Device Manipulation & Gizmo System

READ THESE FILES:
1. c:\Users\George\source\repos\kinetiCORE\docs\PROJECT_MANAGER_BRIEF.md
2. c:\Users\George\source\repos\kinetiCORE\docs\CURSOR_AGENT_QUICKSTART.md

YOUR PRIMARY TASKS:
1. Review uncommitted changes in src/kinematics/UnifiedGizmoManager.ts
2. Test MJCF device selection and gizmo attachment
3. Test URDF device selection and gizmo attachment
4. Verify joint visualization during manipulation
5. Implement splash screen (if time permits)

YOUR FILES:
- src/kinematics/UnifiedGizmoManager.ts ⚠️ (uncommitted)
- src/loaders/mjcf/MJCFLoader.ts
- src/loaders/urdf/URDFLoader.ts
- src/ui/components/RobotJoggingPanelWithGizmo.tsx ⚠️ (uncommitted)

START HERE: Review UnifiedGizmoManager.ts uncommitted changes
REPORT TO: Project Manager (Claude Code) when Phase 1 complete

Begin work now.
```

---

## 🤖 Agent 2 Assignment

```
You are Agent 2 in a coordinated 5-agent sprint.

YOUR ROLE: Project Save/Load & World Manager

READ THESE FILES:
1. c:\Users\George\source\repos\kinetiCORE\docs\PROJECT_MANAGER_BRIEF.md
2. c:\Users\George\source\repos\kinetiCORE\docs\CURSOR_AGENT_QUICKSTART.md

YOUR PRIMARY TASKS:
1. Review uncommitted changes in src/scene/WorldSaveManager.ts
2. Resolve 8 CRITICAL TODOs in src/project/ProjectDatabase.ts
3. Implement autosave (every 2 minutes) - PRIORITY 1
4. Implement project recovery on crash - PRIORITY 2
5. Test project save/load with 10+ assets

YOUR FILES:
- src/scene/WorldSaveManager.ts ⚠️ (uncommitted)
- src/project/ProjectManager.ts (2 TODOs)
- src/project/ProjectDatabase.ts (8 TODOs - CRITICAL)
- src/project/AssetInstanceManager.ts

CRITICAL TODOS:
- TODO: Implement autosave (every 2 minutes)
- TODO: Add project recovery on crash
- TODO: Implement project versioning
- TODO: Add project collaboration features

START HERE: Review WorldSaveManager.ts + implement autosave
REPORT TO: Project Manager (Claude Code) when Phase 1 complete

Begin work now.
```

---

## 🤖 Agent 3 Assignment

```
You are Agent 3 in a coordinated 5-agent sprint.

YOUR ROLE: Kinematics End-to-End & Target Structure Design

READ THESE FILES:
1. c:\Users\George\source\repos\kinetiCORE\docs\PROJECT_MANAGER_BRIEF.md
2. c:\Users\George\source\repos\kinetiCORE\docs\CURSOR_AGENT_QUICKSTART.md

YOUR PRIMARY TASKS:
1. Test complete MJCF kinematics workflow (load → move joints → visualize)
2. Test complete URDF kinematics workflow (load → move joints → visualize)
3. Design kinematics target structure with metadata
4. Verify IK solver for 6-axis robots
5. Test FullBody IK with humanoid MJCF model

YOUR FILES:
- src/kinematics/ForwardKinematicsSolver.ts (3 TODOs)
- src/kinematics/InverseKinematicsSolver.ts
- src/kinematics/KinematicsManager.ts
- src/loaders/mjcf/MJCFActuatorIntegration.ts
- src/ui/components/WholeBodyIKPanel.tsx

NEW FILES TO CREATE:
- src/kinematics/types/TargetStructure.ts
- src/kinematics/managers/TargetArrayManager.ts
- src/kinematics/converters/MJCFToTargetArray.ts
- src/kinematics/converters/URDFToTargetArray.ts

TEST SCENARIOS:
1. Load FANUC robot (URDF) → Move end-effector → Verify joints update
2. Load humanoid (MJCF) → Place target gizmos → Verify IK solver
3. Load Boston Dynamics Spot → Test quadruped kinematics

START HERE: Test MJCF kinematics end-to-end workflow
REPORT TO: Project Manager (Claude Code) when Phase 1 complete

Begin work now.
```

---

## 🤖 Agent 4 Assignment

```
You are Agent 4 in a coordinated 5-agent sprint.

YOUR ROLE: Asset Library & Demo Data Population

READ THESE FILES:
1. c:\Users\George\source\repos\kinetiCORE\docs\PROJECT_MANAGER_BRIEF.md
2. c:\Users\George\source\repos\kinetiCORE\docs\CURSOR_AGENT_QUICKSTART.md

YOUR PRIMARY TASKS:
1. Audit existing assets in library (count available)
2. Create asset seeding script or process
3. Populate library with 50+ demo assets (target: 20 robots, 10 grippers, 5 conveyors, 15 fixtures)
4. Test user asset upload for all formats (URDF, MJCF, JT, STL, glTF, USD)
5. Verify asset thumbnails and metadata

YOUR FILES:
- src/library/AssetUploadService.ts ⚠️ (uncommitted)
- src/library/AssetLoader.ts (5 TODOs)
- src/library/UserAwareAssetManager.ts (4 TODOs)
- src/ui/components/AssetLibrary/AssetLibraryPanelV2.tsx ⚠️ (uncommitted)

ASSET TARGETS:
- Robots: 20 (industrial, collaborative, mobile, humanoid)
- Grippers: 10 (Schunk, Robotiq, OnRobot)
- Conveyors: 5 (belt, roller, chain)
- Fixtures: 15 (fencing, tables, racks, bins)
TOTAL: 50+ assets

START HERE: Audit existing assets and count what's available
REPORT TO: Project Manager (Claude Code) when Phase 1 complete

Begin work now.
```

---

## 🤖 Agent 5 Assignment

```
You are Agent 5 in a coordinated 5-agent sprint.

YOUR ROLE: Branch Management & Documentation

READ THESE FILES:
1. c:\Users\George\source\repos\kinetiCORE\docs\PROJECT_MANAGER_BRIEF.md
2. c:\Users\George\source\repos\kinetiCORE\docs\CURSOR_AGENT_QUICKSTART.md

YOUR PRIMARY TASKS:
1. Commit or stash 8 uncommitted files in working directory
2. Test all 15 remote branches against main
3. Document merge conflicts and resolution plans
4. Identify abandoned branches for deletion
5. Update documentation for completed features

YOUR FILES (UNCOMMITTED):
- src/kinematics/UnifiedGizmoManager.ts
- src/lib/supabase-client.ts
- src/library/AssetUploadService.ts
- src/library/types.ts
- src/scene/WorldSaveManager.ts
- src/ui/components/AssetLibrary/AssetLibraryPanelV2.tsx
- src/ui/components/AssetLibraryAuth.tsx
- src/ui/components/RobotJoggingPanelWithGizmo.tsx
- src/types/ (untracked directory)

BRANCHES TO REVIEW (15 total):
✅ Likely ready: feature/cloud-asset-library, feature/transform-controls-snap-system
⚠️ Needs review: GUI_ENHANCEMENT, NODE-SELECTION, feature/jt-import
❌ Consider deleting: bug_removal, bug_resolution_2, repair-branch, cursor/*

BRANCH REVIEW PROCESS:
git checkout <branch>
git merge main
npm run lint && npm run type-check && npm test && npm run build

START HERE: Review uncommitted files and create commit strategy
REPORT TO: Project Manager (Claude Code) when Phase 1 complete

Begin work now.
```

---

## 📋 Quick Reference for George

### To Assign an Agent:
1. Open Cursor in `c:\Users\George\source\repos\kinetiCORE`
2. Copy the appropriate agent assignment from above
3. Paste into Cursor chat
4. Agent reads docs and begins work

### To Check Progress:
Ask agent: "What's your status? Update docs/SPRINT_PROGRESS_TRACKER.md"

### To Coordinate:
All agents have read the same brief. They know:
- Their role and responsibilities
- Which files they own
- How to report progress
- When to escalate blockers

---

**Project Manager:** Claude Code (Agent 1)
**Sprint Duration:** 13 days
**Target Completion:** 2025-11-05
