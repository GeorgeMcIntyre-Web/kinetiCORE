# kinetiCORE

**Web-based 3D Industrial Simulation and Kinematics Platform**

A high-performance robot simulation platform built with React, TypeScript, Babylon.js, and Rapier physics.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open browser at http://localhost:5173
```

---

## 📁 Project Structure

```
kinetiCORE/
├── src/
│   ├── core/               # Core types and constants (George)
│   │   ├── types.ts        # Shared TypeScript interfaces
│   │   └── constants.ts    # Application constants
│   │
│   ├── physics/            # Physics abstraction layer (George)
│   │   ├── IPhysicsEngine.ts        # Physics interface (DO NOT import Rapier elsewhere!)
│   │   └── RapierPhysicsEngine.ts   # Rapier implementation
│   │
│   ├── scene/              # Babylon.js scene management (Cole)
│   │   └── SceneManager.ts # Scene, camera, lighting setup
│   │
│   ├── entities/           # Entity system (Cole)
│   │   ├── SceneEntity.ts      # Unified mesh + physics object
│   │   ├── EntityRegistry.ts   # Central entity manager
│   │   └── index.ts            # Entity exports
│   │
│   ├── manipulation/       # Transform gizmos (Cole + Edwin)
│   │   ├── TransformGizmo.ts   # Move/rotate/scale tools
│   │   └── index.ts
│   │
│   ├── history/            # Command pattern for undo/redo (Edwin)
│   │   ├── Command.ts          # ICommand interface
│   │   └── CommandManager.ts   # Command history manager
│   │
│   ├── ui/                 # React components (Edwin)
│   │   ├── components/
│   │   │   ├── SceneCanvas.tsx  # Babylon.js canvas wrapper
│   │   │   ├── Toolbar.tsx      # Top toolbar
│   │   │   ├── Inspector.tsx    # Right panel properties
│   │   │   ├── Toolbar.css
│   │   │   └── Inspector.css
│   │   └── store/
│   │       └── editorStore.ts   # Zustand state management
│   │
│   ├── utils/              # Shared utilities
│   │   └── math.ts         # Math helper functions
│   │
│   ├── App.tsx             # Root React component
│   ├── App.css
│   ├── main.tsx            # React entry point
│   └── index.css
│
├── public/                 # Static assets
├── docs/                   # Documentation
│
├── .eslintrc.cjs          # ESLint configuration
├── .prettierrc            # Prettier configuration
├── .gitignore
├── tsconfig.json          # TypeScript config
├── vite.config.ts         # Vite bundler config
├── package.json           # Dependencies and scripts
├── CLAUDE.md              # Project context for AI tools
└── README.md              # This file
```

---

## 👥 Team & Ownership

- **George:** Physics abstraction, core architecture
  - `src/core/` - Core types and constants
  - `src/physics/` - Physics abstraction layer

- **Cole:** 3D rendering and scene management
  - `src/scene/` - Babylon.js setup
  - `src/entities/` - Entity system
  - `src/manipulation/` - Gizmo system (shared)

- **Edwin:** UI/UX and React components
  - `src/ui/` - All React components
  - `src/history/` - Command pattern
  - `src/manipulation/` - Gizmo integration (shared)

**⚠️ Shared files** (announce in Slack before editing):
- `src/core/types.ts`
- `package.json`

---

## 🏗️ Architecture Principles

### 1. **Physics Abstraction Layer**
- ✅ **Always** use `IPhysicsEngine` interface
- ❌ **Never** import Rapier directly outside `RapierPhysicsEngine.ts`

```typescript
// ✅ GOOD
import { IPhysicsEngine } from '@physics/IPhysicsEngine';

// ❌ BAD
import RAPIER from '@dimforge/rapier3d-compat';
```

### 2. **Scene Entities**
- Unified objects that sync Babylon meshes ↔ Rapier bodies automatically
- Created via `EntityRegistry.create()`

```typescript
import { EntityRegistry } from '@entities';

const entity = EntityRegistry.getInstance().create({
  mesh: BABYLON.MeshBuilder.CreateBox("box", {size: 1}, scene),
  physics: {
    enabled: true,
    type: 'dynamic',
    shape: 'box',
    mass: 1.0
  }
});
```

### 3. **Command Pattern**
- All user actions wrapped in commands (enables undo/redo)

```typescript
const command = new MoveCommand(entity, oldPos, newPos);
commandManager.execute(command);
```

### 4. **Separate State Layers**
- React state (Zustand) is independent from 3D scene state
- Never `setState` in animation loops - use refs

```typescript
// In component
const selectMesh = useEditorStore(state => state.selectMesh);

// In render loop (outside React)
const selected = useEditorStore.getState().selectedMeshes;
```

---

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Lint TypeScript files
npm run lint:fix     # Fix linting issues
npm run type-check   # TypeScript type checking
npm run test         # Run unit tests
npm run test:coverage # Run tests with coverage
npm run format       # Format code with Prettier
```

---

## 🔧 Development Workflow

### Daily Routine

```bash
# Morning sync
git checkout main
git pull origin main
git checkout feature/your-branch
git rebase main

# During work
git add .
git commit -m "feat: descriptive message"
git push origin feature/your-branch

# Before PR
npm run lint
npm run type-check
npm run build
```

### Commit Message Format

```
feat: add new feature
fix: bug fix
refactor: code restructuring
docs: documentation changes
```

### Creating a PR

1. Push your branch
2. Create PR to `main`
3. Get 1 approval
4. Merge (never force push to main)

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `@babylonjs/core` | 3D rendering engine |
| `@dimforge/rapier3d-compat` | Physics simulation |
| `react` + `react-dom` | UI framework |
| `zustand` | State management |
| `vite` | Build tool |
| `typescript` | Type safety |

---

## ⚙️ Configuration Files

- **TypeScript:** `tsconfig.json` - Strict mode enabled
- **ESLint:** `.eslintrc.cjs` - Code quality rules
- **Prettier:** `.prettierrc` - Code formatting (100 char line length)
- **Vite:** `vite.config.ts` - Path aliases (`@core`, `@physics`, etc.)

### Path Aliases

```typescript
import { IPhysicsEngine } from '@physics/IPhysicsEngine';
import { SceneEntity } from '@entities/SceneEntity';
import { useEditorStore } from '@ui/store/editorStore';
```

---

## 🎯 Core Concepts

### SceneEntity
Represents a unified 3D object with synchronized mesh and physics body.

```typescript
entity.syncFromPhysics();  // Update mesh from physics (in render loop)
entity.syncToPhysics();     // Update physics from mesh (after user input)
entity.setTransform({ position: {x: 0, y: 5, z: 0} });
```

### EntityRegistry
Central manager for all scene entities (singleton).

```typescript
const registry = EntityRegistry.getInstance();
registry.setPhysicsEngine(physicsEngine);
const entity = registry.create(config);
registry.syncAllFromPhysics(); // Call in render loop
```

### TransformGizmo
Interactive 3D manipulation tools.

```typescript
const gizmo = new TransformGizmo(scene);
gizmo.setMode('translate'); // 'translate' | 'rotate' | 'scale'
gizmo.attachToMesh(selectedMesh);
```

---

## 🚧 Known Issues & Gotchas

1. **Coordinate Systems**
   - Babylon.js: Left-handed Y-up
   - Rapier: Right-handed Y-up
   - ⚠️ Conversion handled in `RapierAdapter` - negate Z

2. **Disposal Order**
   - ✅ Always dispose physics bodies BEFORE Babylon meshes

3. **World Matrix**
   - Call `mesh.computeWorldMatrix(true)` before reading bounds

4. **localStorage**
   - Not supported in artifacts - use in-memory state only

---

## 📚 Documentation

- **CLAUDE.md** - Full project context for AI tools
- **Babylon.js Docs:** https://doc.babylonjs.com
- **Rapier Docs:** https://rapier.rs/docs/
- **Zustand Docs:** https://docs.pmnd.rs/zustand/

---

## 🧪 Testing

```bash
npm run test           # Run unit tests
npm run test:coverage  # Coverage report
```

---

## 🐛 Troubleshooting

### Build fails with type errors
```bash
npm run type-check
```

### Linting errors
```bash
npm run lint:fix
```

### Physics not working
- Check `EntityRegistry.setPhysicsEngine()` was called
- Verify physics is initialized with `await physicsEngine.initialize()`

### Gizmo not appearing
- Ensure mesh is selected in `editorStore`
- Call `gizmo.attachToMesh(mesh)`

---

## 📊 Project Status

**Week 1: Foundation** ✅
- ✅ Physics abstraction layer functional
- ✅ Babylon scene rendering
- ✅ React UI shell with state
- ✅ Entity system implemented
- ✅ All modules structured and building

**Next Steps:**
- Integration of physics + entities + UI
- Object creation from toolbar
- Transform gizmo integration
- Command pattern implementation

---

## 📧 Contact

If blocked >1 hour, post in `#dev-blockers` Slack channel

---

## 📄 License

MIT

---

**Built with ❤️ by George, Cole, and Edwin**
