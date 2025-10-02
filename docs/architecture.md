# kinetiCORE Architecture

## Overview

kinetiCORE is built with a modular architecture that enables parallel development by three developers while minimizing merge conflicts and dependencies.

## Core Principles

1. **Separation of Concerns** - Each module has a single, well-defined responsibility
2. **Physics Abstraction** - Never import Rapier directly; always use `IPhysicsEngine`
3. **State Isolation** - React state (Zustand) is separate from 3D scene state
4. **Command Pattern** - All user actions are reversible commands
5. **Minimal Dependencies** - Modules communicate through well-defined interfaces

## Module Boundaries

### 📦 core/ (Owner: George)
**Responsibility:** Shared types, core engine initialization, global utilities

**Files:**
- `types.ts` - Shared TypeScript interfaces (⚠️ Requires team approval for changes)
- `constants.ts` - Application constants

**Dependencies:** None
**Depended on by:** All modules

**Communication:**
- ⚠️ Changes to `types.ts` require Slack announcement
- All team members must pull immediately after type changes

---

### ⚛️ physics/ (Owner: George) - **CRITICAL PATH**
**Responsibility:** Physics engine abstraction and collision detection

**Files:**
- `IPhysicsEngine.ts` - Abstract physics interface
- `RapierPhysicsEngine.ts` - Rapier implementation with coordinate conversion

**Key Classes:**
```typescript
interface IPhysicsEngine {
  initialize(): Promise<void>;
  createRigidBody(desc: BodyDescriptor): string;
  step(deltaTime: number): void;
  raycast(origin: Vector3, direction: Vector3): RaycastHit;
  dispose(): void;
}
```

**Dependencies:** `core/types.ts`
**Depended on by:** `entities/`, `scene/`

**Critical Notes:**
- This module MUST be completed Week 1 (George's priority)
- Handles coordinate system conversion (Babylon left-handed ↔ Rapier right-handed)
- All physics queries go through this layer

---

### 🎨 scene/ (Owner: Cole)
**Responsibility:** Babylon.js scene setup, camera, lighting, asset loading

**Files:**
- `SceneManager.ts` - Scene initialization, camera, lighting (singleton pattern)

**Key Classes:**
```typescript
class SceneManager {
  initialize(canvas: HTMLCanvasElement): void;
  dispose(): void;
  getScene(): BABYLON.Scene;
}
```

**Dependencies:** `core/types.ts`
**Depended on by:** `entities/`, `manipulation/`

**Development Notes:**
- Can work in parallel with physics (Week 1)
- Focus on visual quality and smooth camera controls
- No physics dependencies until Week 2

---

### 🎯 entities/ (Owner: Cole)
**Responsibility:** Unified scene entity system, selection, registry

**Files:**
- `SceneEntity.ts` - Unified object (Babylon mesh + Rapier body)
- `EntityRegistry.ts` - Object tracking and lookup (singleton pattern)
- `index.ts` - Entity system exports

**Key Classes:**
```typescript
class SceneEntity {
  mesh: BABYLON.Mesh;
  physicsHandle: string;
  transform: Transform;
  
  syncToPhysics(): void;
  syncFromPhysics(): void;
  dispose(): void;
}
```

**Dependencies:** `core/`, `scene/`, `physics/`
**Depended on by:** `manipulation/`, `ui/`

**Critical Pattern:**
- Entities automatically sync transforms between Babylon and Rapier
- Disposal order: physics body FIRST, then Babylon mesh

---

### 🖼️ ui/ (Owner: Edwin)
**Responsibility:** React components, Zustand state, user interface

**Files:**
- `components/Toolbar.tsx` - Mode selection and object creation
- `components/SceneCanvas.tsx` - Babylon.js canvas wrapper
- `components/Inspector.tsx` - Properties panel with transform inputs
- `store/editorStore.ts` - Zustand global state
- `hooks/` - Custom React hooks (to be added)

**Key State:**
```typescript
interface EditorState {
  selectedMeshes: BABYLON.Mesh[];
  transformMode: 'translate' | 'rotate' | 'scale';
  camera: BABYLON.Camera | null;
  
  selectMesh: (mesh: BABYLON.Mesh) => void;
  setTransformMode: (mode: string) => void;
}
```

**Dependencies:** `core/types.ts`
**Depended on by:** `manipulation/`

**React Best Practices:**
- Never `setState` in animation loops - use refs
- Use Zustand selectors to prevent re-renders
- Keep UI state separate from 3D scene state

---

### ✋ manipulation/ (Owners: Cole + Edwin) - **SHARED MODULE**
**Responsibility:** Transform gizmos, snapping, manipulation logic

**Files:**
- `TransformGizmo.ts` - Babylon GizmoManager wrapper
- `index.ts` - Manipulation exports
- *(Future: SnapSystem.ts - Grid/angle snapping)*

**Dependencies:** `scene/`, `entities/`, `ui/store/`
**Depended on by:** `history/`

**⚠️ Collaboration Zone:**
- Cole: Gizmo visualization and Babylon integration
- Edwin: State updates and React integration
- Requires coordination - schedule pair programming session Week 2

---

### 🔄 history/ (Owner: Edwin)
**Responsibility:** Undo/redo system, command pattern

**Files:**
- `Command.ts` - Abstract command base class
- `CommandManager.ts` - Undo/redo stack
- `commands/MoveCommand.ts` - Move operation
- `commands/RotateCommand.ts` - Rotate operation
- `commands/ScaleCommand.ts` - Scale operation

**Key Pattern:**
```typescript
abstract class Command {
  abstract execute(): void;
  abstract undo(): void;
}

class MoveCommand extends Command {
  constructor(
    private entity: SceneEntity,
    private oldPos: Vector3,
    private newPos: Vector3
  ) {}
  
  execute() { this.entity.position = this.newPos; }
  undo() { this.entity.position = this.oldPos; }
}
```

**Dependencies:** `entities/`, `ui/store/`
**Depended on by:** None

**Implementation Notes:**
- Commands capture before/after state
- Executed via CommandManager for automatic undo stack
- Max undo depth: 50 operations

---

## Dependency Graph

```
                   core/types.ts
                         ↓
           ┌─────────────┼─────────────┐
           ↓             ↓             ↓
      physics/        scene/          ui/
       (George)       (Cole)        (Edwin)
           ↓             ↓             ↓
           └─────→  entities/  ←──────┘
                     (Cole)
                        ↓
                 manipulation/
                (Cole + Edwin)
                        ↓
                   history/
                   (Edwin)
```

## Communication Protocols

### Shared File Changes

**Before editing `core/types.ts`:**
1. Post in `#dev-daily`: "Adding `SceneEntity` interface to types.ts"
2. Make change in focused commit
3. Push immediately
4. Notify: "types.ts updated - please pull now"
5. Others pull and fix TypeScript errors within 30 minutes

**Before editing `package.json`:**
1. Announce: "Adding react-dnd package"
2. Expect merge conflict - last person to merge resolves
3. Always `npm install` after pulling package.json changes

### Cross-Module Integration

**Week 1:** Modules work independently (no cross-dependencies)

**Week 2:** Integration begins
- Thursday morning: Cole + Edwin pair on `manipulation/`
- Friday afternoon: Full team integration session

## File Organization

```
kinetiCORE/
├── src/
│   ├── core/                # George ✅
│   │   ├── types.ts        # Shared (announce before edit) ✅
│   │   └── constants.ts    # ✅
│   │
│   ├── physics/            # George ✅
│   │   ├── IPhysicsEngine.ts          # ✅
│   │   └── RapierPhysicsEngine.ts     # ✅
│   │
│   ├── scene/              # Cole ✅
│   │   └── SceneManager.ts # ✅
│   │
│   ├── entities/           # Cole ✅
│   │   ├── SceneEntity.ts      # ✅
│   │   ├── EntityRegistry.ts   # ✅
│   │   └── index.ts            # ✅
│   │
│   ├── ui/                 # Edwin ✅
│   │   ├── components/
│   │   │   ├── Toolbar.tsx     # ✅
│   │   │   ├── SceneCanvas.tsx # ✅
│   │   │   └── Inspector.tsx   # ✅
│   │   └── store/
│   │       └── editorStore.ts  # ✅
│   │
│   ├── manipulation/       # Cole + Edwin ✅
│   │   ├── TransformGizmo.ts   # ✅
│   │   └── index.ts            # ✅
│   │
│   ├── history/            # Edwin (partially complete)
│   │   ├── Command.ts          # ✅
│   │   ├── CommandManager.ts   # ✅
│   │   └── commands/           # (needs implementation)
│   │
│   └── utils/              # Shared utilities ✅
│       └── math.ts         # ✅
│
├── docs/
│   ├── architecture.md         # This file
│   └── team_roadmap_3person_ai.md
│
├── CLAUDE.md                   # AI context
├── README.md                   # Main documentation
└── package.json
```

## Critical Success Factors

### Week 1 (Foundation)
✅ George completes physics abstraction (unblocks everyone)
✅ Cole gets Babylon scene rendering smoothly
✅ Edwin builds React UI shell with Zustand
✅ Zero merge conflicts (good module separation)

### Week 2 (Integration)
✅ Entities sync Babylon ↔ Rapier correctly
✅ Selection system working
✅ UI components display scene data
✅ Transform gizmos functional (Cole + Edwin collab)

### Week 3 (Manipulation)
✅ Full transform control (move, rotate, scale)
✅ Undo/redo for all operations
✅ Scene save/load
✅ Professional UX polish

## Anti-Patterns to Avoid

❌ **Importing Rapier directly** → Always use `IPhysicsEngine`
❌ **Editing types.ts without announcing** → Causes surprise TypeScript errors
❌ **setState in render loops** → Use refs and direct mutation
❌ **Forgetting to dispose** → Memory leaks (GPU resources persist)
❌ **Working on same file simultaneously** → Announce first

## Questions?

Refer to `/CLAUDE.md` for coding standards and common patterns.
Post in `#dev-blockers` if stuck >1 hour.