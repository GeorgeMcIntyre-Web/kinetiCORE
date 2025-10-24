# Phase 2 Quick-Start Guide
## For Cursor Agents 6-11

**READ THIS FIRST** before starting your Phase 2 work!

---

## 🚀 Getting Started (First 5 Minutes)

### 1. Verify Your Environment
```bash
# In your workspace root: c:\Users\George\source\repos\kinetiCORE
git status                    # Should be on main branch
npm run type-check            # Should pass (clean TypeScript)
npm run build                 # Should complete successfully
```

### 2. Read Your Assignment
- **Your Brief:** [docs/PHASE2_PROJECT_MANAGER_BRIEF.md](./PHASE2_PROJECT_MANAGER_BRIEF.md)
- **Your Assignment:** [docs/PHASE2_AGENT_ASSIGNMENTS.md](./PHASE2_AGENT_ASSIGNMENTS.md)
- **Phase 1 Summary:** [docs/SPRINT_FINAL_SUMMARY.md](./SPRINT_FINAL_SUMMARY.md)

### 3. Create Your Branch
```bash
git checkout main
git pull origin main
git checkout -b cursor/your-task-name-<random-4-char>
```

**Branch Naming Convention:**
- `cursor/display-current-3d-world-selection-indicator-26c9` ✅ Good
- `cursor/agent-6-work` ❌ Too generic
- `cursor/fix-stuff` ❌ No description

---

## 📋 Phase 1 Accomplishments (Context)

Phase 1 agents completed **17,267+ lines** of production code in 5 days:

✅ **Agent 1:** UnifiedGizmoManager tested and working
✅ **Agent 2:** WorldSaveManager uncommitted changes merged
✅ **Agent 3:** MJCF/URDF kinematics workflows validated
✅ **Agent 4:** 65 demo assets uploaded to cloud library
✅ **Agent 5:** All branches reviewed, 8 uncommitted files merged

**Deployed:** https://main.kineticore-ey1.pages.dev

---

## 🎯 Your Phase 2 Mission

### Agent 6: UI Polish
**Goal:** Add SelectionIndicator + SplashScreen
**Files to Create:**
- `src/ui/components/SelectionIndicator.tsx` (NEW)
- `src/ui/components/SplashScreen.tsx` (NEW)
- `src/hooks/useAppInitialization.ts` (NEW)

**Expected Outcome:** Professional loading experience + clear visual feedback for selection

---

### Agent 7: Integration Testing
**Goal:** End-to-end test suite for critical workflows
**Files to Create:**
- `src/__tests__/integration/RobotLoadAndManipulate.test.ts` (NEW)
- `src/__tests__/integration/ProjectSaveLoad.test.ts` (NEW)
- `src/__tests__/integration/AssetLibraryUpload.test.ts` (NEW)

**Expected Outcome:** 3+ integration tests covering URDF load → manipulate → save

---

### Agent 8: Merge Autosave Feature
**Goal:** Merge `feature/autosave-crash-recovery` → deploy
**Branch to Merge:** `origin/feature/autosave-crash-recovery`

**Process:**
```bash
git checkout feature/autosave-crash-recovery
git pull origin feature/autosave-crash-recovery
git merge main
# Fix conflicts (if any)
npm run lint && npm run type-check && npm test && npm run build
# If passing, merge to main
```

**Expected Outcome:** Autosave every 2 minutes, project recovery on crash

---

### Agent 9: Target Structure Integration
**Goal:** Integrate unified target structure from Agent 3
**Files to Create:**
- `src/kinematics/types/TargetStructure.ts` (NEW)
- `src/kinematics/managers/TargetArrayManager.ts` (NEW)
- `src/kinematics/converters/MJCFToTargetArray.ts` (NEW)
- `src/kinematics/converters/URDFToTargetArray.ts` (NEW)

**Files to Update:**
- `src/kinematics/UnifiedGizmoManager.ts` (use TargetArrayManager)
- `src/scene/WorldSaveManager.ts` (serialize target arrays)
- `src/kinematics/InverseKinematicsSolver.ts` (use target arrays)

**Expected Outcome:** All kinematics systems use unified target array

---

### Agent 10: Performance Optimization
**Goal:** Reduce bundle size 20% + maintain 60 FPS
**Tasks:**
1. Analyze bundle with `npm run build -- --stats`
2. Lazy-load heavy imports (Babylon, Rapier)
3. Code-split by route
4. Profile render loops for bottlenecks

**Expected Outcome:** Production bundle <2MB, 60 FPS with 50+ objects

---

### Agent 11: Documentation
**Goal:** User guides + API docs + tutorials
**Files to Create:**
- `docs/USER_GUIDE.md` (NEW)
- `docs/API_REFERENCE.md` (NEW)
- `docs/TUTORIAL_ROBOT_SIMULATION.md` (NEW)
- `docs/TUTORIAL_ASSET_LIBRARY.md` (NEW)

**Expected Outcome:** New user can complete robot simulation in <10 minutes with docs

---

## 🚨 Common Issues & Solutions

### Issue 1: TypeScript Errors After Merge
**Symptom:** `npm run type-check` fails after merging main
**Solution:**
```bash
# Check which files have errors
npm run type-check 2>&1 | grep "error TS"

# Common fixes:
# 1. Unused variables: prefix with underscore or comment out
# 2. Type mismatches: check merged code changed types
# 3. Missing imports: add missing dependencies
```

**Example Fix:**
```typescript
// Before (error TS6133)
const unusedVar = something();

// After
const _unusedVar = something();  // Prefixed
// OR
// const unusedVar = something();  // Commented
```

---

### Issue 2: Build Fails But Type-Check Passes
**Symptom:** `npm run type-check` ✅ but `npm run build` ❌
**Solution:**
```bash
# Check Vite config for issues
cat vite.config.ts

# Common causes:
# 1. Missing environment variables
# 2. Path resolution issues
# 3. Plugin conflicts

# Debug build
npm run build -- --debug
```

---

### Issue 3: Merge Conflicts
**Symptom:** Git reports conflicts when merging main
**Solution:**
```bash
# 1. Understand which files conflict
git status

# 2. For each conflict:
#    - Open file in editor
#    - Look for <<<<<<< HEAD markers
#    - Decide which changes to keep
#    - Remove conflict markers

# 3. Test after resolving
git add .
git merge --continue
npm run lint && npm run type-check && npm test && npm run build
```

**Pro Tip:** If your branch is very old (>1 week), consider rebasing instead:
```bash
git rebase main
# Resolve conflicts one commit at a time
```

---

### Issue 4: Tests Fail After Integration
**Symptom:** Unit tests pass, integration tests fail
**Solution:**
```bash
# Run specific test file
npm test -- src/__tests__/integration/YourTest.test.ts

# Common causes:
# 1. Async timing issues (add await)
# 2. Mock setup incorrect
# 3. Test environment missing dependencies

# Debug with console.log
console.log('State:', store.getState());
```

---

### Issue 5: Deployment Fails
**Symptom:** Cloudflare Pages deployment fails
**Solution:**
```bash
# 1. Ensure build passes locally
npm run build

# 2. Check build output size
ls -lh dist/

# 3. Verify environment variables set in Cloudflare dashboard
# NODE_VERSION=18
# NPM_VERSION=9

# 4. Check deployment logs in Cloudflare dashboard
```

---

## 🔧 Essential Commands

### Development
```bash
npm run dev              # Start dev server (http://localhost:5173)
npm run type-check       # TypeScript compilation check
npm run lint             # ESLint (code quality)
npm test                 # Run unit tests
npm run build            # Production build
```

### Git Workflow
```bash
git status               # Check current state
git add .                # Stage all changes
git commit -m "feat: description"  # Commit with message
git push origin <branch> # Push to remote

# Full CI check before PR
npm run lint && npm run type-check && npm test && npm run build
```

### Branch Management
```bash
git branch -r            # List remote branches
git checkout -b <name>   # Create new branch
git merge main           # Merge main into current branch
git rebase main          # Rebase current branch on main
git branch -d <name>     # Delete local branch
```

---

## 📊 Progress Tracking

### Daily Updates
Post in your agent channel or update [docs/PHASE2_PROGRESS_TRACKER.md](./PHASE2_PROGRESS_TRACKER.md):

```markdown
## Agent X - [Date]
✅ Completed:
- Task 1 description
- Task 2 description

🔄 In Progress:
- Current task

🚧 Blocked:
- Blocker description (if any)

📅 Next:
- Tomorrow's plan
```

### Definition of Done
Before marking a task complete:
- [ ] Code changes tested locally
- [ ] TypeScript compilation passes (`npm run type-check`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Unit tests written (if applicable)
- [ ] Integration tested with other features
- [ ] Documentation updated
- [ ] Changes committed with clear message
- [ ] Branch pushed to remote

---

## 🔗 Key Resources

### Documentation
- [Architecture](./architecture.md) - System design
- [Physics API](./PHYSICS_API.md) - Physics abstraction layer
- [MJCF Kinematic System](./MJCF_KINEMATIC_SYSTEM_GUIDE.md) - MJCF loader details
- [Asset Management](./ASSET_MANAGEMENT_README.md) - Cloud asset library
- [Coordinate System](./COORDINATE_SYSTEM.md) - Z-up standard
- [CSS Style Guide](./CSS_STYLE_GUIDE.md) - Flexbox patterns

### External Docs
- [Babylon.js](https://doc.babylonjs.com) - 3D rendering
- [Rapier](https://rapier.rs/docs/) - Physics engine
- [Zustand](https://docs.pmnd.rs/zustand/) - State management
- [Vitest](https://vitest.dev) - Testing framework
- [Cloudflare Pages](https://developers.cloudflare.com/pages/) - Deployment

---

## 🚦 Coordination Protocol

### Dependencies Between Agents

**Agent 6** (UI Polish)
↓ (SelectionIndicator needed by)
**Agent 7** (Integration Testing)

**Agent 8** (Merge Autosave)
↓ (Autosave needed by)
**Agent 9** (Target Structure Integration with save/load)

**Agent 9** (Target Structure)
↓ (Target arrays needed by)
**Agent 7** (Integration Testing - IK tests)

**All Agents**
↓ (Code needed by)
**Agent 10** (Performance - can't optimize until code complete)

**Agent 11** (Documentation)
- Can work in parallel with all agents
- Updates docs as features complete

### Communication
If blocked by another agent:
1. Check [PHASE2_PROGRESS_TRACKER.md](./PHASE2_PROGRESS_TRACKER.md) for their status
2. Post in coordination channel with `@agent-X` mention
3. If blocked >2 hours, escalate to Project Manager (Claude Code)

### Code Reviews
- **Self-review:** Before pushing, review your own diff
- **PR size:** Keep PRs <500 lines for easy review
- **Commit messages:** Use conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`)

---

## 🎯 Success Metrics

### Individual Agent Success
- ✅ All assigned tasks completed
- ✅ TypeScript compilation clean
- ✅ All tests passing
- ✅ Feature works end-to-end
- ✅ Documentation updated
- ✅ Code merged to main

### Team Success (Phase 2)
- ✅ All 6 agents complete within 5-7 days
- ✅ Production deployment live and stable
- ✅ 60 FPS with 50+ objects in scene
- ✅ Bundle size <2MB (20% reduction)
- ✅ New user can complete tutorial in <10 minutes
- ✅ All integration tests passing

---

## 🚀 Getting Unstuck

### If You're Stuck for >30 Minutes
1. **Check Documentation:** Re-read your assignment and related docs
2. **Search Codebase:** Use `grep` or Cursor's search to find similar patterns
3. **Review Phase 1 Work:** See how other agents solved similar problems
4. **Ask for Help:** Post in coordination channel with context

### Debugging Checklist
```bash
# 1. Is TypeScript happy?
npm run type-check

# 2. Are there lint errors?
npm run lint

# 3. Do tests pass?
npm test

# 4. Does it build?
npm run build

# 5. Does it work in dev mode?
npm run dev
# Then test manually in browser
```

### When to Escalate
- Blocked >2 hours despite trying solutions
- Dependency on another agent who is blocked
- Found critical bug affecting multiple agents
- Scope of task larger than expected (>1 day)

---

## 📝 Code Style & Conventions

### TypeScript
```typescript
// ✅ Good: Explicit types
interface RobotConfig {
  name: string;
  jointCount: number;
}

function loadRobot(config: RobotConfig): Robot {
  // Implementation
}

// ❌ Bad: Implicit any
function loadRobot(config) {
  // TypeScript will infer 'any'
}
```

### React Components
```typescript
// ✅ Good: Functional component with typed props
interface Props {
  robotId: string;
  onSelect: (id: string) => void;
}

export function RobotSelector({ robotId, onSelect }: Props) {
  return <div onClick={() => onSelect(robotId)}>...</div>;
}

// ❌ Bad: Class component (deprecated in kinetiCORE)
class RobotSelector extends React.Component {
  // Don't use classes
}
```

### Zustand State
```typescript
// ✅ Good: Selector pattern (minimizes re-renders)
const selectedRobot = useEditorStore(state => state.selectedRobot);

// ❌ Bad: Accessing entire store (causes unnecessary re-renders)
const store = useEditorStore();
const robot = store.selectedRobot;
```

### Babylon.js Resource Disposal
```typescript
// ✅ Good: Always dispose resources
useEffect(() => {
  const mesh = BABYLON.MeshBuilder.CreateBox("box", {}, scene);

  return () => {
    mesh.dispose(); // Cleanup on unmount
  };
}, [scene]);

// ❌ Bad: Memory leak (no disposal)
useEffect(() => {
  const mesh = BABYLON.MeshBuilder.CreateBox("box", {}, scene);
  // Missing cleanup!
}, [scene]);
```

---

## 🎓 Phase 1 Lessons Learned

### What Worked Well
1. **Clear assignment cards** - Agents knew exactly what to do
2. **Parallel work** - No dependencies = fast progress
3. **Autonomous decision-making** - Agents didn't wait for approvals
4. **Comprehensive testing** - TypeScript + lint + test + build before merge

### What to Improve
1. **Better coordination on shared files** - Merge conflicts on UnifiedGizmoManager
2. **Earlier integration testing** - Some features worked in isolation but had edge cases together
3. **Documentation as you go** - Waiting until end made docs harder

### Apply These Learnings
- **Agent 6:** Document SelectionIndicator API immediately after creating
- **Agent 7:** Start integration tests early, don't wait for all features
- **Agent 8:** Communicate autosave merge plan before starting (affects Agent 9)
- **Agent 9:** Coordinate with Agent 7 on target structure tests
- **Agent 10:** Profile performance throughout, not just at end
- **Agent 11:** Write docs incrementally as features complete

---

## 🚀 You're Ready!

You have everything you need:
- ✅ Your assignment is clear
- ✅ Phase 1 foundation is solid (17,267+ lines of working code)
- ✅ Build is passing (TypeScript clean)
- ✅ Production deployment is live
- ✅ This guide has solutions to common issues

**Now go build something amazing!**

Remember: You're not just writing code, you're building a production-ready industrial robot simulation platform. Quality over speed. Test thoroughly. Document clearly.

**Good luck!** 🚀

---

**Document Version:** 1.0
**Last Updated:** 2025-10-23
**Project Manager:** Claude Code
**Phase:** 2 of 2
**Target Completion:** 2025-10-30
