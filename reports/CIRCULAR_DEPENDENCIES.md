# Circular Dependencies Report

**Date:** 2025-10-23  
**Reviewer:** Agent 3  
**Tool:** madge v8.0.0

---

## Summary

**Total Circular Dependencies Found:** 4  
**Severity:** 🔴 CRITICAL  
**Impact:** Build issues, maintenance problems, potential runtime errors

---

## What are Circular Dependencies?

Circular dependencies occur when Module A imports Module B, and Module B imports Module A (directly or indirectly). This creates a dependency cycle that can cause:

- **Build issues** - Bundlers may struggle to resolve order
- **Runtime errors** - Undefined imports at runtime
- **Maintenance problems** - Hard to refactor, test, and understand
- **Memory leaks** - Objects may not be garbage collected

---

## Found Circular Dependencies

### 1. SceneManager ↔ BooleanOperations (CRITICAL)
```
scene/SceneManager.ts → scene/BooleanOperations.ts → scene/SceneManager.ts
```

**Type:** Direct circular dependency  
**Impact:** HIGH - Core scene management cycle

**Analysis:**
- `SceneManager` imports `BooleanOperations`
- `BooleanOperations` imports `SceneManager`
- This is a 2-file cycle (simple to fix)

**Recommendation:**
```typescript
// Option 1: Extract shared interface
// scene/ISceneManager.ts
export interface ISceneManager {
  getScene(): BABYLON.Scene;
  getMeshes(): BABYLON.Mesh[];
}

// scene/SceneManager.ts
import { ISceneManager } from './ISceneManager';
export class SceneManager implements ISceneManager { ... }

// scene/BooleanOperations.ts
import { ISceneManager } from './ISceneManager';
export class BooleanOperations {
  constructor(private sceneManager: ISceneManager) {}
}

// Option 2: Move BooleanOperations to separate module
// scene/operations/BooleanOperations.ts
// (no dependency on SceneManager)
```

---

### 2. SceneManager → BooleanOperations → SceneTreeManager (CRITICAL)
```
scene/SceneManager.ts → scene/BooleanOperations.ts → scene/SceneTreeManager.ts → scene/SceneManager.ts
```

**Type:** 3-file circular dependency chain  
**Impact:** HIGH - Complex dependency cycle

**Analysis:**
- `SceneManager` → `BooleanOperations`
- `BooleanOperations` → `SceneTreeManager`
- `SceneTreeManager` → `SceneManager`
- This is a 3-file cycle (more complex)

**Recommendation:**
```typescript
// Option 1: Dependency injection
// Instead of importing SceneManager, inject it
export class SceneTreeManager {
  constructor(private sceneManager: ISceneManager) {}
}

// Option 2: Event-based communication
// Use event emitter to decouple
export class SceneTreeManager extends EventEmitter {
  updateTree() {
    this.emit('tree-updated');
  }
}

export class SceneManager {
  constructor() {
    this.treeManager.on('tree-updated', () => {
      // Handle update
    });
  }
}
```

---

### 3. KinematicsManager ↔ ActuatorSystem (HIGH PRIORITY)
```
kinematics/KinematicsManager.ts → kinematics/actuation/ActuatorSystem.ts → kinematics/KinematicsManager.ts
```

**Type:** Direct circular dependency  
**Impact:** MEDIUM - Kinematics system cycle

**Analysis:**
- `KinematicsManager` imports `ActuatorSystem`
- `ActuatorSystem` imports `KinematicsManager`
- This affects Agent 1 & 2's IK work

**Recommendation:**
```typescript
// Option 1: Extract interface
// kinematics/IKinematicsManager.ts
export interface IKinematicsManager {
  getJointState(jointId: string): JointState;
  setJointState(jointId: string, state: JointState): void;
}

// kinematics/actuation/ActuatorSystem.ts
import { IKinematicsManager } from '../IKinematicsManager';
export class ActuatorSystem {
  constructor(private kinematicsManager: IKinematicsManager) {}
}

// Option 2: Move ActuatorSystem to separate package
// (ActuatorSystem should not know about KinematicsManager)
```

---

### 4. editorStore ↔ DeleteObjectCommand (MEDIUM PRIORITY)
```
ui/store/editorStore.ts → history/commands/DeleteObjectCommand.ts → ui/store/editorStore.ts
```

**Type:** Direct circular dependency  
**Impact:** MEDIUM - UI state management cycle

**Analysis:**
- `editorStore` imports `DeleteObjectCommand`
- `DeleteObjectCommand` imports `editorStore`
- This violates command pattern separation

**Recommendation:**
```typescript
// Option 1: Use dependency injection
// history/commands/DeleteObjectCommand.ts
export class DeleteObjectCommand {
  constructor(
    private objectId: string,
    private getEditorState: () => EditorState  // Inject getter, not store
  ) {}
  
  execute() {
    const state = this.getEditorState();
    // ...
  }
}

// ui/store/editorStore.ts
const command = new DeleteObjectCommand(
  objectId,
  () => useEditorStore.getState()  // Pass function reference
);

// Option 2: Use events
// DeleteObjectCommand emits events, editorStore listens
```

---

## Impact Analysis

### Build Impact
- **Webpack/Vite:** May struggle with module resolution
- **Tree shaking:** Circular deps prevent effective tree shaking
- **Bundle size:** Larger bundles due to inability to optimize

### Runtime Impact
- **Module loading:** Potential undefined imports
- **Hot module reload (HMR):** May not work correctly
- **Testing:** Hard to mock/stub circular dependencies

### Maintenance Impact
- **Refactoring:** Difficult to change without breaking both modules
- **Testing:** Hard to unit test in isolation
- **Understanding:** Developers confused by circular logic

---

## Recommended Fix Priority

### 🔴 CRITICAL (Fix This Week)
1. **SceneManager ↔ BooleanOperations** (2-file cycle)
   - Extract `ISceneManager` interface
   - Use dependency injection

2. **SceneManager → BooleanOperations → SceneTreeManager** (3-file cycle)
   - Same fix as above
   - Inject `ISceneManager` interface

### 🟡 HIGH (Fix This Sprint)
3. **KinematicsManager ↔ ActuatorSystem**
   - Extract `IKinematicsManager` interface
   - Coordinate with Agent 1 & 2

### 🟢 MEDIUM (Fix Next Sprint)
4. **editorStore ↔ DeleteObjectCommand**
   - Use dependency injection pattern
   - Pass getters instead of importing store

---

## How to Prevent Circular Dependencies

### 1. Architecture Rules
```typescript
// ✅ GOOD: Layered architecture
core/ → entities/ → scene/ → ui/
(dependencies flow one direction only)

// ❌ BAD: Bidirectional dependencies
scene/ ↔ ui/
```

### 2. Use Dependency Injection
```typescript
// ❌ BAD
import { SceneManager } from './SceneManager';
export class BooleanOps {
  sceneManager = new SceneManager();
}

// ✅ GOOD
import { ISceneManager } from './ISceneManager';
export class BooleanOps {
  constructor(private sceneManager: ISceneManager) {}
}
```

### 3. Use Events/Observables
```typescript
// ❌ BAD
import { EditorStore } from './editorStore';
export class Command {
  execute() {
    EditorStore.update();
  }
}

// ✅ GOOD
export class Command extends EventEmitter {
  execute() {
    this.emit('executed');
  }
}
```

### 4. Extract Shared Code
```typescript
// ❌ BAD
// A.ts imports B.ts
// B.ts imports A.ts

// ✅ GOOD
// A.ts imports Shared.ts
// B.ts imports Shared.ts
// Shared.ts imports nothing from A or B
```

---

## Verification

After fixing, verify no circular deps:
```bash
npx madge --circular --extensions ts,tsx src
# Should output: No circular dependencies found!
```

Add to CI/CD:
```yaml
# .github/workflows/ci.yml
- name: Check circular dependencies
  run: |
    npx madge --circular --extensions ts,tsx src
    if [ $? -ne 0 ]; then
      echo "❌ Circular dependencies found!"
      exit 1
    fi
```

---

## References

- **madge:** https://github.com/pahen/madge
- **Circular Dependency Antipattern:** https://en.wikipedia.org/wiki/Circular_dependency
- **Dependency Injection:** https://en.wikipedia.org/wiki/Dependency_injection

---

**Status:** 4 circular dependencies identified ⚠️  
**Next Step:** Create GitHub issues and fix CRITICAL ones this week

**Agent 3 - Code Review**  
**Date:** 2025-10-23
