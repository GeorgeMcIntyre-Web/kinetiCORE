# 3-Person Team Roadmap: AI-Accelerated 3D Industrial Simulator
## George, Cole & Edwin | Using Claude Code + Cursor

---

## EXECUTIVE SUMMARY

**Timeline: 4-6 weeks to working MVP** (vs 14-21 weeks solo)

**Team acceleration factor with AI:** 3-4x faster than traditional development
- AI handles boilerplate, setup, and repetitive code (50% time savings)
- Parallel development with clear module boundaries (40% time savings)
- Instant code reviews and debugging via Claude (30% time savings)

**Key insight:** With 3 developers + AI tools, you can parallelize Phase 0-2 simultaneously by splitting into well-defined modules with minimal dependencies. The critical path is establishing the physics abstraction layer first, then building on top.

---

## TEAM STRUCTURE & ROLE ASSIGNMENT

### **George - Architecture Lead & Integration**
**Specialization:** Core systems, physics abstraction, integration
**AI Tool Focus:** Claude Code (CLI/terminal work, system-level tasks)
**Primary Responsibilities:**
- Phase 0: Physics abstraction layer design & implementation
- Integration work (Babylon + Rapier coordination)
- Git workflow management and merge conflict resolution
- Architecture decisions and code reviews

### **Cole - 3D Engine & Rendering**
**Specialization:** Babylon.js, scene management, camera systems
**AI Tool Focus:** Cursor (IDE-based, visual feedback)
**Primary Responsibilities:**
- Phase 1: Core 3D rendering and camera controls
- Scene graph implementation
- Asset loading and management
- Visual feedback systems (selection, highlighting)

### **Edwin - UI/UX & State Management**
**Specialization:** React, user interaction, state
**AI Tool Focus:** Cursor (component development, UI work)
**Primary Responsibilities:**
- Phase 2: React UI components and panels
- State management (Zustand setup)
- Transform gizmos integration
- Undo/redo system implementation

---

## GIT WORKFLOW: GITHUB FLOW (SIMPLIFIED FOR SMALL TEAM)

**Strategy choice:** GitHub Flow over Git Flow
- **Why:** 3-person team doesn't need complex branching
- **Benefits:** Faster merges, less overhead, continuous integration
- **Trade-off:** Requires good CI/CD and testing discipline

### Branch Structure

```
main (protected, production-ready)
├── feature/george-physics-abstraction
├── feature/cole-babylon-scene
├── feature/edwin-ui-foundation
└── feature/integration-sprint-1
```

### Daily Workflow Rules

**Morning (9:00 AM):**
1. Pull latest `main` and rebase your feature branch
2. Daily 15-min standup (async on Slack if remote)
3. Declare what you're working on today (avoid conflicts)

**During Development:**
1. Commit frequently to your feature branch (every 30-60 min)
2. Write descriptive commit messages: `feat: add raycast selection` or `fix: memory leak in mesh disposal`
3. Push to remote feature branch 2-3x daily (backup + visibility)

**Before Merging (Pre-commit Checklist):**
```bash
# Run this before creating PR
npm run lint          # Fix code style issues
npm run test          # Ensure tests pass
npm run build         # Verify it compiles
git pull origin main  # Get latest changes
git rebase main       # Apply your changes on top
# Resolve conflicts if any, then force push
git push origin feature/your-branch --force-with-lease
```

**Pull Request Protocol:**
1. Create PR when feature is 80%+ complete (don't wait for perfect)
2. Use PR template (see below)
3. Tag 1 reviewer (rotate: George→Cole→Edwin→George)
4. Reviewer has 2 hours to review or auto-merge
5. Use "Squash and Merge" to keep main history clean

### PR Template (`.github/pull_request_template.md`)

```markdown
## What does this PR do?
Brief description of the feature/fix

## AI Tools Used
- [ ] Claude Code for [specific tasks]
- [ ] Cursor for [specific tasks]

## Testing Done
- [ ] Manual testing: [describe]
- [ ] Unit tests added/passing
- [ ] No console errors

## Screenshots (if UI changes)
[Attach before/after images]

## Blockers/Dependencies
List any blocking issues or PRs this depends on

## Reviewer Notes
Anything specific the reviewer should focus on
```

### Conflict Resolution Strategy

**Minimize conflicts proactively:**
- Each person "owns" specific files/folders (see module boundaries below)
- Communicate before touching shared files (like `package.json` or core types)
- Use feature flags for partially-complete features

**When conflicts occur:**
1. Use VS Code merge tool or GitKraken (visual diff)
2. Always test after resolving conflicts
3. Ask Claude Code to help resolve complex conflicts:
   ```bash
   claude code "help resolve merge conflict in src/core/scene.ts, 
   keeping both babylon scene updates and physics sync"
   ```

---

## PARALLEL MODULE ARCHITECTURE

**Critical insight:** To enable true parallelization, modules must have **minimal shared dependencies**. Here's how we split the codebase:

```
src/
├── core/                 👤 GEORGE (Week 1-2)
│   ├── types.ts         # Shared TypeScript interfaces (locked after Day 2)
│   └── engine.ts        # Main engine init
│
├── physics/             👤 GEORGE (Week 1-2, PRIORITY #1)
│   ├── IPhysicsEngine.ts       # Abstract interface
│   ├── RapierAdapter.ts        # Implementation
│   └── CollisionManager.ts     # Query optimization
│
├── scene/               👤 COLE (Week 1-2)
│   ├── SceneManager.ts         # Babylon scene setup
│   ├── CameraController.ts     # ArcRotateCamera
│   ├── LightingSetup.ts        # Lighting configs
│   └── AssetLoader.ts          # GLTF loading
│
├── entities/            👤 COLE (Week 2-3)
│   ├── SceneEntity.ts          # Unified object representation
│   ├── EntityRegistry.ts       # Object tracking
│   └── SelectionManager.ts     # Pick/select logic
│
├── ui/                  👤 EDWIN (Week 1-3)
│   ├── components/
│   │   ├── Toolbar.tsx
│   │   ├── SceneTree.tsx
│   │   └── PropertiesPanel.tsx
│   ├── store/
│   │   └── editorStore.ts      # Zustand state
│   └── hooks/
│       └── useEditorState.ts
│
├── manipulation/        👤 EDWIN + COLE (Week 2-3, COLLAB)
│   ├── TransformGizmo.ts       # Babylon GizmoManager wrapper
│   └── SnapSystem.ts           # Grid snap logic
│
└── history/             👤 EDWIN (Week 2-3)
    ├── Command.ts              # Command pattern base
    ├── CommandManager.ts       # Undo/redo stack
    └── commands/               # Specific command implementations
```

### Dependency Flow

```
          core/types.ts (Day 1, ALL)
                 ↓
        physics/ (George) ← Week 1 Priority
                 ↓
    ┌────────────┴────────────┐
    ↓                         ↓
scene/ (Cole)          ui/ (Edwin)
    ↓                         ↓
entities/ (Cole)       history/ (Edwin)
    ↓                         ↓
    └────→ manipulation/ ←────┘
           (Cole + Edwin collaborate)
```

**Key:** Physics layer must be done first (George, Week 1). Then Cole and Edwin work in parallel with zero dependencies.

---

## ACCELERATED 4-WEEK TIMELINE

### 🚀 WEEK 1: FOUNDATION (All parallel after Day 2)

**Day 1 (Monday) - ALL TOGETHER**
- Morning: Architecture review session (1 hour)
- Define shared types in `core/types.ts` (2 hours, George leads)
- Initialize project structure (George: Vite + TypeScript + Babylon + Rapier)
- Set up Git repo, branch protection, CI/CD basics
- Create `CLAUDE.md` onboarding doc for AI (see template below)
- **AI Usage:** Claude Code to scaffold project, Cursor to validate structure
- **End-of-day:** Everyone can `npm install` and see a spinning cube

**Day 2-5 (Tue-Fri) - PARALLEL DEVELOPMENT**

**👤 George: Physics Abstraction (CRITICAL PATH)**
```bash
Tasks:
- Design IPhysicsEngine interface (Day 2)
- Implement RapierAdapter with coordinate conversion (Day 2-3)
- Add collision queries (raycast, overlap tests) (Day 4)
- Write unit tests with mock physics (Day 5)
- Document API for Cole/Edwin

AI Prompts:
"Create TypeScript interface for physics engine abstraction supporting 
Rapier, with methods for createRigidBody, raycast, and batch collision queries"

"Implement RapierAdapter converting Babylon left-handed Y-up to Rapier 
right-handed, with proper quaternion conversions"

"Write Jest tests for physics adapter using mock Rapier world"
```

**👤 Cole: Babylon Scene Setup**
```bash
Tasks:
- Initialize Babylon engine with WebGL2 (Day 2)
- Implement ArcRotateCamera with standard controls (Day 2-3)
- Set up lighting (HemisphericLight + DirectionalLight) (Day 3)
- Create AssetLoader for GLTF models (Day 4)
- Add basic ground plane and coordinate axes (Day 5)

AI Prompts:
"Set up Babylon.js scene with ArcRotateCamera, proper camera limits, 
and smooth inertia following industry standards"

"Create asset loading system with progress tracking, error handling, 
and automatic model centering using Babylon.js"

"Implement professional lighting setup: ambient + directional with 
shadows, optimized for industrial models"
```

**👤 Edwin: React UI Foundation**
```bash
Tasks:
- Set up React + Vite integration (Day 2)
- Create Zustand store for editor state (Day 2-3)
- Build basic toolbar component (Day 3-4)
- Implement status bar with FPS counter (Day 4)
- Create responsive layout (3D viewport + side panels) (Day 5)

AI Prompts:
"Create Zustand store for 3D editor with selectedObjects, camera, 
transformMode state, following React best practices"

"Build React toolbar component with mode selection (translate/rotate/scale) 
using Tailwind CSS, professional UI design"

"Implement FPS counter hook using requestAnimationFrame without 
triggering React re-renders"
```

**End of Week 1 Milestone:**
- ✅ Physics abstraction layer complete and tested
- ✅ Empty Babylon scene with camera controls
- ✅ Basic React UI shell with state management
- **Friday 4 PM:** Integration session (2 hours) - merge all features

---

### 🏗️ WEEK 2: OBJECT MANIPULATION (Parallel with integration points)

**👤 George: Integration & Babylon-Physics Bridge**
```bash
Tasks:
- Create SceneEntity class syncing Babylon ↔ Rapier (Mon-Tue)
- Implement EntityRegistry (Wed)
- Add performance monitoring (FPS, triangle count) (Thu)
- Code reviews for Cole/Edwin's PRs (Throughout week)

AI Prompts:
"Create SceneEntity class that synchronizes Babylon.js mesh transforms 
with Rapier rigid body, handling disposal and memory management"

"Implement entity registry with efficient lookup (Map), tracking all 
scene objects with metadata and physics handles"
```

**👤 Cole: Selection & Scene Graph**
```bash
Tasks:
- Implement raycasting selection system (Mon-Tue)
- Add visual selection highlighting (Wed)
- Build multi-select support (Shift+Click, box select) (Thu-Fri)
- Create scene hierarchy traversal helpers (Fri)

AI Prompts:
"Implement mouse-based raycasting selection in Babylon.js with 
bounding volume optimization for performance"

"Add selection highlighting using Babylon HighlightLayer, supporting 
pre-selection (yellow) and active selection (orange)"

"Create multi-select system with Shift+Click accumulation and 
Ctrl+Click toggle, storing in Zustand"
```

**👤 Edwin: UI Components + Undo/Redo**
```bash
Tasks:
- Build scene tree component (outliner) (Mon-Tue)
- Create properties panel with transform inputs (Wed)
- Implement command pattern base classes (Thu)
- Add undo/redo stack with Ctrl+Z shortcuts (Fri)

AI Prompts:
"Create React scene tree component with drag-drop reparenting, 
show/hide toggles, using react-dnd library"

"Build properties panel with numeric inputs for position/rotation/scale 
with live updates to Zustand"

"Implement command pattern for undo/redo: base Command class, 
MoveCommand, RotateCommand, with CommandManager stack"
```

**Thursday Integration:** Cole & Edwin collaborate on transform gizmo integration (4 hours pair programming via Cursor collab or screen share)

**End of Week 2 Milestone:**
- ✅ Can select objects with mouse
- ✅ Scene tree shows all objects
- ✅ Properties panel displays transforms
- ✅ Undo/redo for basic operations

---

### 🎨 WEEK 3: TRANSFORM MANIPULATION (Heavy collaboration)

**Monday-Tuesday: ALL TOGETHER (Transform Gizmos)**
```bash
Mob programming session - rotate driver every 30 min:
- Integrate Babylon GizmoManager
- Connect gizmos to selection state
- Hook up undo/redo for transforms
- Add keyboard shortcuts (G/R/S for modes)

AI Usage (shared session):
"Integrate Babylon.js GizmoManager with our Zustand selection state, 
disabling camera controls during gizmo drag"

"Implement transform commands that capture before/after state for 
undo, executed when gizmo drag ends"
```

**Wednesday-Friday: PARALLEL POLISH**

**👤 George:**
- Optimize physics queries for future path planning
- Add collision detection visualization (debug mode)
- Memory leak hunting (disposal patterns)
- Performance profiling and optimization

**👤 Cole:**
- Asset library (load multiple models)
- Material system basics
- Lighting controls
- Camera presets (top, front, side views)

**👤 Edwin:**
- Snap-to-grid system
- Keyboard shortcuts reference panel
- Save/load scene to JSON
- Error handling and user feedback

**End of Week 3 Milestone:**
- ✅ Full transform manipulation (move, rotate, scale)
- ✅ Scene persistence (save/load)
- ✅ Professional UX (shortcuts, feedback, smooth interactions)
- ✅ No major bugs or memory leaks

---

### 🚢 WEEK 4: POLISH & MVP VALIDATION

**Monday-Wednesday: Bug Bash & Polish**
- Each person tests others' features
- Fix critical bugs
- Add loading states and error messages
- Write basic documentation

**Thursday: User Testing**
- Invite 5-10 target users (industrial engineers, robotics folks)
- Watch them use the tool (don't help!)
- Take notes on confusion points
- **Goal:** Can they load a model, move it around, and save?

**Friday: Iteration & Planning**
- Fix top 3 UX issues from testing
- Sprint retrospective (what went well, what to improve)
- Plan Phase 3 (Kinematics) for Weeks 5-8

**End of Week 4: SHIPPABLE MVP**
- ✅ 10 users successfully manipulate 3D scenes
- ✅ Core features working reliably
- ✅ Ready to add kinematics (Phase 3)

---

## AI TOOL USAGE PATTERNS

### Claude Code (CLI/Terminal) - George's Primary Tool

**Best for:**
- System-wide refactoring
- Multi-file changes
- CI/CD automation
- Architecture-level tasks
- Background long-running tasks

**George's workflow:**
```bash
# Morning: sync and review
claude code "review changes in main since yesterday, 
summarize what Cole and Edwin added"

# Architecture work
claude code "refactor physics abstraction to support 
multiple collider shapes per body"

# Integration testing
claude code "write integration test: create box, move it, 
verify physics body moves, dispose properly"

# CI/CD
claude code "create GitHub Action for running tests and 
visual regression on PRs"
```

**Pro tips for George:**
- Use `CLAUDE.md` in root for project context
- Use `.claude/commands/` for reusable macros
- Run Claude Code in separate terminal, keep Cursor for quick edits
- Use for documentation updates (README, API docs)

### Cursor (IDE) - Cole & Edwin's Primary Tool

**Best for:**
- Fast iteration on features
- Visual component development
- Inline code suggestions
- Real-time debugging
- UI/UX work

**Cole's workflow:**
```javascript
// In Cursor chat (Cmd+L):
"Add mesh outline on hover using HighlightLayer, 
remove when mouse leaves"

// Inline autocomplete for repetitive patterns:
// Type comment, let Cursor complete:
// Create material with PBR settings for industrial metal
const material = // Cursor suggests full implementation

// Debug with Claude in editor:
"Why is camera jumping when I click gizmo? 
[paste gizmo attachment code]"
```

**Edwin's workflow:**
```javascript
// Component generation:
"Create React component for scene tree with recursive rendering, 
each node shows name + visibility toggle"

// State management help:
"Refactor this component to use Zustand selectors to 
prevent unnecessary re-renders"

// Styling assistance:
"Make this toolbar look like Blender's toolbar - dark theme, 
icon buttons with tooltips, Tailwind CSS"
```

**Pro tips for Cole & Edwin:**
- Use Cmd+K for quick inline edits
- Use Cmd+L for chat-based help
- Paste screenshots of UI bugs/mockups (Claude reads images!)
- Use Cursor's auto-complete during repetitive work
- Set up `.cursorrules` file for project-specific coding standards

### Hybrid Approach: Best of Both Worlds

**When to use Claude Code (even if you prefer Cursor):**
- Need to process multiple files at once
- Long-running refactoring (background agents)
- Analyzing entire codebase for patterns
- Writing comprehensive tests
- Generating documentation from code

**When to use Cursor (even if you prefer CLI):**
- Quick fixes during active coding
- Visual feedback needed (UI changes)
- Debugging with inline code inspection
- Pair programming with screen sharing
- Learning new APIs (Cursor shows docs inline)

---

## SHARED PROJECT CONTEXT: `CLAUDE.md`

Create this file in your repo root so both Claude Code and Cursor understand your project:

```markdown
# 3D Industrial Simulator - Project Context

## Project Overview
Web-based 3D industrial simulation and kinematics platform for robot simulation.
Stack: React + TypeScript + Babylon.js + Rapier physics

## Architecture Principles
1. Physics abstraction layer (IPhysicsEngine) - never import Rapier directly
2. Scene entities sync between Babylon and physics automatically
3. Command pattern for all user actions (enables undo/redo)
4. React state (Zustand) is separate from 3D scene state
5. Never setState in animation loops - use refs and direct mutation

## Coding Standards
- TypeScript strict mode enabled
- Functional React components only (no classes)
- Use Zustand selectors to minimize re-renders
- Always dispose 3D resources: geometries, materials, textures, physics bodies
- Commit messages: `feat:`, `fix:`, `refactor:`, `docs:`
- Max line length: 100 characters
- Use `const` over `let`, avoid `var`

## Project Structure
See /docs/architecture.md for module boundaries

## Common Patterns

### Creating a 3D object with physics:
```typescript
const entity = entityRegistry.create({
  mesh: BABYLON.MeshBuilder.CreateBox("box", {size: 1}, scene),
  physics: {
    type: 'dynamic',
    shape: 'box'
  }
});
```

### Adding a command:
```typescript
const command = new MoveCommand(entity, oldPos, newPos);
commandManager.execute(command); // Auto-adds to undo stack
```

## Known Issues
- Babylon left-handed, Rapier right-handed - conversion in RapierAdapter
- Dispose physics bodies BEFORE Babylon meshes
- Don't use localStorage (not supported in artifacts)

## Current Sprint
Week 2: Object manipulation and selection systems
Focus: Selection, gizmos, undo/redo

## Team
- George: Physics & integration
- Cole: 3D rendering & scene
- Edwin: UI & state management
```

### Nested Context for Modules

Create `.claude/` folders in subdirectories:

**`src/physics/CLAUDE.md`:**
```markdown
# Physics Module

Owner: George

## Purpose
Abstraction layer over Rapier physics engine. Provides coordinate 
system conversion and unified API.

## Key Files
- `IPhysicsEngine.ts`: Abstract interface (DO NOT MODIFY without team approval)
- `RapierAdapter.ts`: Rapier implementation
- `CollisionManager.ts`: Batch query optimization

## Coordinate Systems
Babylon: Left-handed, Y-up
Rapier: Right-handed, Y-up
Conversion: Negate Z when transferring positions

## Adding New Collider Type
1. Add to `IPhysicsEngine.ColliderShape` enum
2. Implement in `RapierAdapter._createCollider()`
3. Add tests in `__tests__/RapierAdapter.test.ts`
```

---

## CONFLICT PREVENTION STRATEGIES

### File Ownership (Minimize Overlaps)

| File/Folder | Primary Owner | Can Edit? | Requires PR Review? |
|-------------|--------------|-----------|---------------------|
| `core/types.ts` | George | All (with caution) | YES (always) |
| `physics/*` | George | George only | NO |
| `scene/*` | Cole | Cole + George | Only if George edits |
| `entities/*` | Cole | Cole only | NO |
| `ui/components/*` | Edwin | Edwin only | NO |
| `ui/store/*` | Edwin | Edwin + George | Only if George edits |
| `manipulation/*` | Cole + Edwin | Both | YES (cross-review) |
| `package.json` | George | All (with sync) | YES (always) |

### Shared File Change Protocol

**For `core/types.ts` (shared interfaces):**
1. Announce in Slack: "Adding `SceneEntity` type to core/types.ts"
2. Make change in small, focused commit
3. Notify team: "types.ts updated, please pull and check your code"
4. Others pull immediately and fix any TypeScript errors

**For `package.json` (dependencies):**
1. Add dependency in your branch
2. Announce: "Adding `react-dnd` for drag-drop, will cause merge conflict"
3. Last person to merge rebases and resolves conflict

### Communication Channels

**Slack Channels:**
- `#dev-daily`: Daily progress updates (morning & EOD)
- `#dev-blockers`: Immediate blockers that need help
- `#dev-prs`: Automated PR notifications
- `#dev-wins`: Celebrate merged features!

**Daily Standups (Async in Slack):**
```
**Today's focus:**
- What I'm working on: [feature]
- Files I'll be editing: [list]
- Blockers: [none/list]

**Yesterday recap:**
- Completed: [list]
- PRs opened: [links]
```

---

## PAIR PROGRAMMING SESSIONS (AI-Enhanced)

### When to Pair Program
- Complex integrations (Cole + George: Babylon + Physics)
- Challenging bugs (whoever hits it + 1 other)
- Learning new concepts (mentor + mentee)
- High-risk changes (George + anyone for core changes)

### Pair Programming with AI

**Driver-Navigator Pattern + AI:**
- **Driver:** Writes code in Cursor/VS Code
- **Navigator:** Reviews, suggests architecture, uses Claude Code separately
- **AI:** Third "pair partner" for boilerplate and quick lookups

**Example session (Cole + Edwin on transform gizmos):**
1. Cole drives, Edwin navigates
2. Cole: "Let me add the gizmo attachment code" [writes code]
3. Edwin: "Ask Claude how to disable camera during drag"
4. Cole (in Cursor): "How disable ArcRotateCamera when gizmo is active?"
5. Claude suggests `camera.detachControl()`
6. Edwin: "Don't forget undo/redo for this"
7. Cole: "Right, creating `TransformCommand`..." [AI autocompletes]
8. Switch after 25 min (Pomodoro technique)

### Remote Pair Programming Tools
- **VS Code Live Share:** Best for Cursor users
- **Screen sharing + voice:** Zoom/Discord
- **Cursor multiplayer** (if available in your version)

---

## TESTING & QUALITY ASSURANCE

### Automated Testing (CI/CD)

**GitHub Actions Workflow (`.github/workflows/ci.yml`):**
```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build
      
      # Visual regression (if time)
      - name: Playwright tests
        run: npx playwright test
        if: github.event_name == 'pull_request'
```

**Pre-commit Hooks (Husky + lint-staged):**
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run type-check"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### Manual Testing Checklist (Before PR)

**Functional Tests:**
- [ ] Load test model (robot.glb)
- [ ] Select object with mouse click
- [ ] Move object with gizmo (all axes)
- [ ] Undo last action (Ctrl+Z)
- [ ] Save scene to JSON
- [ ] Reload page and load scene
- [ ] No console errors

**Performance Tests:**
- [ ] FPS stays above 40 with 10+ objects
- [ ] No memory leaks (reload 5x, check DevTools memory)
- [ ] Smooth camera rotation
- [ ] Fast asset loading (<3 sec for 10MB model)

**Cross-Browser (Spot Check):**
- [ ] Chrome (primary)
- [ ] Firefox (secondary)
- [ ] Safari (if on Mac)

---

## WEEK 5-8 PREVIEW: ADDING KINEMATICS

**After MVP (Week 4), sprint into Phase 3:**

### Week 5-6: Forward Kinematics
**George:** Joint system architecture, kinematic chain representation
**Cole:** Visual representation of joints (debug overlays, axis indicators)
**Edwin:** Joint control sliders, pose library UI

### Week 7-8: Inverse Kinematics (CCD)
**George:** CCD solver implementation with joint limits
**Cole:** End-effector target gizmo, IK visual feedback
**Edwin:** IK controls panel, solve on/off toggle, quality indicators

**By Week 8:** Full robot arm manipulation with IK

---

## EMERGENCY PROCEDURES

### Major Merge Conflict
1. **Don't panic** - conflicts are normal
2. Create backup branch: `git branch backup-before-merge`
3. Use visual merge tool: GitKraken or VS Code
4. Ask Claude Code: "Help resolve merge conflict in [file]"
5. Test thoroughly after resolving
6. If stuck >30 min, revert and ask team for help

### Broken `main` Branch
1. Immediately revert the breaking PR:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```
2. Notify team in Slack immediately
3. Fix in separate branch, re-test extensively
4. Post-mortem: Why did it break? Update CI/CD

### Team Member Blocked
1. Post in `#dev-blockers` with:
   - What you're trying to do
   - What's not working (error messages, screenshots)
   - What you've tried
2. Other team members help within 1 hour
3. If no resolution, schedule pairing session

### AI Tool Producing Bad Code
1. **Stop and review** - don't blindly accept AI suggestions
2. Ask AI to explain its reasoning
3. Simplify your prompt and try again
4. If stuck, switch to manual coding or ask teammate
5. Remember: **You're the architect, AI is the assistant**

---

## SUCCESS METRICS

### Week 1
- ✅ All 3 modules (physics, scene, UI) independently functional
- ✅ Zero merge conflicts
- ✅ Code review turnaround <2 hours

### Week 2
- ✅ Can select and inspect any object
- ✅ Scene tree accurately reflects 3D scene
- ✅ 80% unit test coverage on core modules

### Week 3
- ✅ Full transform manipulation working
- ✅ Undo/redo for all actions
- ✅ Scene save/load reliable

### Week 4 (MVP)
- ✅ 10 users complete core workflow without help
- ✅ No critical bugs
- ✅ <50ms input latency
- ✅ 60 FPS with 50 objects

---

## LESSONS FROM SUCCESSFUL 3-PERSON TEAMS

### From GitHub Flow Adopters:
- "Deploy small, deploy often" - merge PRs same day they're opened
- "Two reviewers optimal" - but with 3 people, rotate so everyone learns
- "Branch lifespan <3 days" - keeps merge conflicts minimal

### From AI-First Development Teams:
- "Treat AI like a junior developer" - review everything it produces
- "Use AI for boilerplate, human judgment for architecture" - don't let AI drive design decisions
- "Claude Code for boring tasks, Cursor for creative work" - plays to each tool's strengths

### From Startup Speed:
- "Perfect is the enemy of shipped" - get to MVP, then iterate
- "User testing on Week 4, not Week 12" - fail fast, learn early
- "If you're not embarrassed by v1, you shipped too late"

---

## FINAL CHECKLIST: ARE WE READY TO START?

**Before Day 1:**
- [ ] GitHub repo created with branch protection on `main`
- [ ] All team members have Cursor + Claude Code set up
- [ ] Slack channels created
- [ ] Project management tool set up (GitHub Projects or Linear)
- [ ] Architecture review meeting scheduled (Day 1, 9 AM)
- [ ] Everyone read this roadmap and Phase 0-2 technical details
- [ ] `CLAUDE.md` file created in repo root

**Week 1 Readiness:**
- [ ] George understands physics abstraction requirements
- [ ] Cole familiar with Babylon.js basics (read docs over weekend)
- [ ] Edwin comfortable with Zustand (watch 30-min tutorial)
- [ ] All agree on coding standards (ESLint config)
- [ ] CI/CD pipeline basics understood

---

## ANTI-PATTERNS TO AVOID

**🚫 DON'T:**
- **Work on `main` branch directly** → Always use feature branches
- **Let PR sit >24 hours** → Quick reviews keep momentum
- **Merge without testing** → 5 min of testing saves hours of debugging
- **Blindly accept AI code** → Always review and understand
- **Scope creep in MVP** → Defer nice-to-haves to Week 5+
- **Forget to pull before starting work** → Causes painful merge conflicts
- **Edit same files simultaneously without communication** → Announce in Slack first
- **Accumulate technical debt** → Fix as you go, or schedule debt-reduction sprints

**✅ DO:**
- **Communicate obsessively** → Over-communicate is better than under
- **Review each other's PRs** → Learn from each other's code
- **Celebrate small wins** → Merged PR? Slack emoji reaction!
- **Ask for help early** → Stuck >1 hour? Ask team
- **Use AI strategically** → For boilerplate, not architecture
- **Test incrementally** → Don't wait until "everything is done"
- **Refactor continuously** → Leave code better than you found it
- **Document decisions** → Why did we choose X over Y? Write it down

---

## YOUR COMPETITIVE ADVANTAGE

**Traditional 3D web app timeline:** 6-12 months
**Your timeline with this roadmap:** 4-6 weeks to MVP, 8 weeks to differentiated product

**Why you'll win:**
1. **AI acceleration** - 3-4x faster development with Claude + Cursor
2. **Parallel architecture** - 3 devs working simultaneously with minimal conflicts
3. **Modern stack** - Babylon.js + Rapier = best-in-class performance
4. **User-focused** - Validating with real users at Week 4, not Month 6
5. **Team synergy** - Clear roles, good communication, shared tools

**Go build something amazing! 🚀**

---

## APPENDIX: QUICK REFERENCE

### Git Commands Cheat Sheet
```bash
# Morning routine
git checkout main
git pull origin main
git checkout -b feature/my-new-feature
git push -u origin feature/my-new-feature

# During development
git add .
git commit -m "feat: add selection highlighting"
git push origin feature/my-new-feature

# Before creating PR
git fetch origin
git rebase origin/main
# Fix conflicts if any
git push origin feature/my-new-feature --force-with-lease

# After PR merged
git checkout main
git pull origin main
git branch -d feature/my-new-feature
```

### AI Prompting Tips
```bash
# ✅ Good prompts (specific, with context)
"Refactor RapierAdapter to cache rigid body lookups using Map instead of 
array search, maintaining same API"

"Add error boundary to React components that catches Babylon.js errors 
and displays friendly message"

# ❌ Bad prompts (vague, no context)
"Make it faster"
"Fix the bug"
"Add physics"
```

### Useful VS Code Extensions
- **Cursor** (AI pair programmer)
- **Claude Code** (terminal AI)
- **Error Lens** (inline error display)
- **Git Graph** (visualize git history)
- **Pretty TypeScript Errors** (readable errors)
- **ES7+ React snippets** (fast component creation)

### Resource Links
- Babylon.js Docs: https://doc.babylonjs.com
- Rapier Docs: https://rapier.rs/docs/
- Zustand Docs: https://docs.pmnd.rs/zustand/
- GitHub Flow: https://githubflow.github.io/

---

**Remember:** This roadmap is your guide, not gospel. Adapt based on what works for your team. The best plan is the one you actually follow!

**Now go forth and build! You've got this. 💪**