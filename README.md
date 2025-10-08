# kinetiCORE

**Web-based 3D Industrial Simulation and Kinematics Platform**

A high-performance robot simulation platform built with React, TypeScript, Babylon.js, and Rapier physics. Featuring DWG/DXF CAD import, URDF/MJCF robot support, kinematics simulation, and path planning.

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

## ✨ Key Features

### 🤖 **Robot Kinematics**
- URDF/MJCF robot model import and export
- Forward and inverse kinematics (IK) solvers
- Joint control and actuator simulation
- Multi-robot coordination

### 📐 **CAD File Support**
- **DWG import** - AutoCAD files via LibreDWG (R13-R2021)
  - LINE, POLYLINE, CIRCLE, ARC, ELLIPSE, SPLINE
  - INSERT block references with transformations
  - TEXT rendering with MSDF fonts
  - Automatic layer-based batching for performance
- **DXF import** - 2D CAD drawings
- **JT import** - Siemens JT CAD format (via PyOpenJt bridge)
- **GLTF/STL/OBJ** - Standard 3D mesh formats

### 🎯 **Path Planning**
- RRT-Connect bidirectional path planner
- Spot welding path optimization
- Multi-robot task coordination
- Trajectory optimization

### 🎨 **3D Scene**
- WebGPU rendering (fallback to WebGL2)
- Orthographic and perspective cameras
- Multiple floor materials (grid, concrete, epoxy)
- Real-time physics simulation
- Boolean operations (CSG2/Manifold)

### 📚 **Asset Library**
- Hierarchical asset browser
- Quick access to robots, tools, and models
- Drag-and-drop scene insertion
- Custom asset import

### 🎛️ **User Interface**
- Expert mode with dockable panels
- Transform gizmos (move, rotate, scale)
- Object hierarchy tree
- Properties inspector
- Keyboard shortcuts
- Command palette

---

## 📁 Project Structure

```
kinetiCORE/
├── src/
│   ├── __tests__/          # Unit tests
│   │
│   ├── config/             # Configuration files
│   │   └── panelConfig.ts  # Panel layout configurations
│   │
│   ├── core/               # Core types and constants (George)
│   │   ├── types.ts        # Shared TypeScript interfaces
│   │   └── constants.ts    # Application constants
│   │
│   ├── dxf/                # DXF CAD file loader (George)
│   │   ├── DXFParser.ts    # DXF file parsing
│   │   └── DXFLoader.ts    # DXF to Babylon converter
│   │
│   ├── entities/           # Entity system (Cole)
│   │   ├── SceneEntity.ts      # Unified mesh + physics object
│   │   ├── EntityRegistry.ts   # Central entity manager
│   │   └── index.ts            # Entity exports
│   │
│   ├── history/            # Command pattern for undo/redo (Edwin)
│   │   ├── Command.ts          # ICommand interface
│   │   └── CommandManager.ts   # Command history manager
│   │
│   ├── kinematics/         # Robot kinematics system (George)
│   │   ├── device/                  # Unified device definitions
│   │   │   └── UnifiedDeviceDefinition.ts
│   │   ├── exporters/               # URDF/MJCF exporters
│   │   │   ├── URDFExporter.ts      # Export to ROS URDF
│   │   │   └── MJCFExporter.ts      # Export to MuJoCo MJCF
│   │   ├── actuation/               # Actuator control
│   │   │   ├── ActuatorSystem.ts    # Actuator management
│   │   │   └── ActuatorLibrary.ts   # Hardware actuator database
│   │   ├── solvers/                 # IK/FK solvers
│   │   │   ├── ForwardKinematics.ts
│   │   │   ├── InverseKinematics.ts
│   │   │   └── JacobianIK.ts
│   │   ├── KinematicsManager.ts     # Main kinematics orchestrator
│   │   └── KinematicChain.ts        # Kinematic chain representation
│   │
│   ├── library/            # Asset library system (George)
│   │   ├── LibraryManager.ts    # Asset database manager
│   │   ├── AssetLoader.ts       # Multi-format asset loader
│   │   └── types.ts             # Library type definitions
│   │
│   ├── loaders/            # File format loaders (George)
│   │   ├── dwg/                     # AutoCAD DWG loader
│   │   │   ├── DWGLoader.ts         # Main DWG loader
│   │   │   ├── DWGDatabaseParser.ts # LibreDWG database parser
│   │   │   ├── DWGDatabaseToBabylonConverter.ts
│   │   │   ├── DWGTextRenderer.ts   # MSDF text rendering
│   │   │   ├── errors.ts            # DWG error types
│   │   │   └── types.ts             # DWG type definitions
│   │   ├── jt/                      # Siemens JT loader
│   │   │   ├── JTLoader.ts          # JT file loader
│   │   │   └── JTParserBridge.ts    # Python bridge
│   │   ├── urdf/                    # URDF robot loader
│   │   │   └── URDFLoaderWithMeshes.ts
│   │   └── gltf/                    # GLTF loader utilities
│   │
│   ├── manipulation/       # Transform gizmos (Cole + Edwin)
│   │   ├── TransformGizmo.ts   # Move/rotate/scale tools
│   │   └── index.ts
│   │
│   ├── pathPlanning/       # Path planning algorithms (George)
│   │   ├── RRTConnectPlanner.ts     # RRT-Connect algorithm
│   │   ├── SpotWeldingPlanner.ts    # Welding path optimizer
│   │   ├── MultiRobotCoordinator.ts # Multi-robot scheduling
│   │   ├── TrajectoryOptimizer.ts   # Trajectory smoothing
│   │   ├── ViaPointGenerator.ts     # Via point generation
│   │   ├── ConfigurationSampler.ts  # C-space sampling
│   │   ├── RRTTree.ts               # RRT tree structure
│   │   └── types.ts                 # Path planning types
│   │
│   ├── physics/            # Physics abstraction layer (George)
│   │   ├── IPhysicsEngine.ts        # Physics interface (DO NOT import Rapier elsewhere!)
│   │   └── RapierPhysicsEngine.ts   # Rapier implementation
│   │
│   ├── scene/              # Babylon.js scene management (Cole)
│   │   ├── SceneManager.ts          # Scene, camera, lighting setup
│   │   ├── FloorMaterialManager.ts  # Floor material system
│   │   ├── BooleanOperations.ts     # CSG2 Boolean operations
│   │   ├── SceneTreeNode.ts         # Scene hierarchy
│   │   └── CoordinateSystem.ts      # Z-up coordinate handling
│   │
│   ├── ui/                 # React components (Edwin)
│   │   ├── components/
│   │   │   ├── SceneCanvas.tsx           # Babylon.js canvas wrapper
│   │   │   ├── Toolbar.tsx               # Top toolbar
│   │   │   ├── Inspector.tsx             # Properties panel
│   │   │   ├── ObjectHierarchy.tsx       # Scene tree view
│   │   │   ├── KinematicsPanel.tsx       # Robot control
│   │   │   ├── ActuatorControlPanel.tsx  # Actuator UI
│   │   │   ├── CameraViewControls.tsx    # Camera presets
│   │   │   ├── ContextMenu.tsx           # Right-click menu
│   │   │   ├── AssetLibrary/             # Asset browser
│   │   │   │   ├── AssetLibraryPanel.tsx
│   │   │   │   └── AssetCard.tsx
│   │   │   └── ...
│   │   ├── store/
│   │   │   └── editorStore.ts       # Zustand state management
│   │   ├── layouts/
│   │   │   ├── ExpertModeLayout.tsx # Dockable panel layout
│   │   │   └── PanelRegistry.tsx    # Panel configuration
│   │   └── core/
│   │       └── UserLevelContext.tsx # User mode management
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
│   ├── wasm/              # WASM modules (LibreDWG)
│   └── fonts/             # MSDF font atlases
│
├── docs/                   # Documentation
│   ├── architecture.md
│   ├── team_roadmap_3person_ai.md
│   └── COORDINATE_SYSTEM.md
│
├── scripts/                # Build and utility scripts
│   └── readDwg.ts         # DWG file inspector
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

- **George:** Physics abstraction, core architecture, file loaders
  - `src/core/` - Core types and constants
  - `src/physics/` - Physics abstraction layer
  - `src/kinematics/` - Robot kinematics system
  - `src/loaders/` - DWG, DXF, JT, URDF loaders
  - `src/pathPlanning/` - Path planning algorithms
  - `src/library/` - Asset management

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
- `CLAUDE.md`

---

## 🏗️ Architecture Principles

### 1. **Z-up Coordinate System**
- kinetiCORE uses **Z-up** (CAD/ROS standard) throughout
- See `docs/COORDINATE_SYSTEM.md` for details
- **When adding loaders:** Load geometry as-is, NO coordinate conversion
- **Unit conversion only:** Use `CoordinateSystem.ts` for mm ↔ m

### 2. **Physics Abstraction Layer**
- ✅ **Always** use `IPhysicsEngine` interface
- ❌ **Never** import Rapier directly outside `RapierPhysicsEngine.ts`

```typescript
// ✅ GOOD
import { IPhysicsEngine } from '@physics/IPhysicsEngine';

// ❌ BAD
import RAPIER from '@dimforge/rapier3d-compat';
```

### 3. **Scene Entities**
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

### 4. **Command Pattern**
- All user actions wrapped in commands (enables undo/redo)

```typescript
const command = new MoveCommand(entity, oldPos, newPos);
commandManager.execute(command);
```

### 5. **Separate State Layers**
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
npm run dev          # Start development server (Vite)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Lint TypeScript files
npm run lint:fix     # Auto-fix linting issues
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
| `@mlightcad/libredwg-web` | DWG file parsing (WASM) |
| `@mlightcad/libredwg-converter` | DWG to database converter |
| `react` + `react-dom` | UI framework |
| `zustand` | State management |
| `rc-dock` | Dockable panel system |
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
import { KinematicsManager } from '@kinematics/KinematicsManager';
import { loadDWGFromFile } from '@loaders/dwg/DWGLoader';
```

---

## 🎯 Core Concepts

### DWG Loading
Load AutoCAD files with full block support and TEXT rendering.

```typescript
import { loadDWGFromFile } from '@loaders/dwg/DWGLoader';

const result = await loadDWGFromFile(file, scene, {
  unitScale: 0.001, // mm to meters
  onProgress: (progress) => {
    console.log(`${progress.message} (${progress.percent}%)`);
  }
});
```

### Robot Kinematics
Manage robot models with forward/inverse kinematics.

```typescript
import { KinematicsManager } from '@kinematics/KinematicsManager';

const kinematicsManager = new KinematicsManager(scene);
const chainId = await kinematicsManager.loadURDF(urdfFile);

// Set joint angles (FK)
kinematicsManager.updateJointAngles(chainId, new Map([
  ['joint_1', Math.PI / 4],
  ['joint_2', Math.PI / 2]
]));

// Solve for target position (IK)
const solution = kinematicsManager.solveIK(chainId, targetPosition);
```

### Asset Library
Organize and load assets from hierarchical library.

```typescript
import { LibraryManager } from '@library/LibraryManager';

const libraryManager = LibraryManager.getInstance();
await libraryManager.initialize();

const assets = libraryManager.getAssetsByCategory('robots');
const robot = await libraryManager.loadAsset(assets[0], scene);
```

### SceneEntity
Represents a unified 3D object with synchronized mesh and physics body.

```typescript
entity.syncFromPhysics();  // Update mesh from physics (in render loop)
entity.syncToPhysics();     // Update physics from mesh (after user input)
entity.setTransform({ position: {x: 0, y: 5, z: 0} });
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
   - kinetiCORE uses **Z-up** (CAD/ROS standard) throughout
   - See `docs/COORDINATE_SYSTEM.md` for full details
   - **When adding loaders:** Load geometry as-is, NO coordinate conversion
   - **Unit conversion only:** Use `CoordinateSystem.ts` for mm ↔ m

2. **Disposal Order**
   - ✅ Always dispose physics bodies BEFORE Babylon meshes

3. **World Matrix**
   - Call `mesh.computeWorldMatrix(true)` before reading bounds

4. **localStorage**
   - Not supported in artifacts - use in-memory state only

5. **DWG Performance**
   - Large files (>1M entities) may take 30-60s to parse
   - LibreDWG WASM parsing is CPU-intensive
   - Consider pre-filtering layers or entity types

---

## 📚 Documentation

- **CLAUDE.md** - Full project context for AI tools
- **COORDINATE_SYSTEM.md** - Coordinate system standard
- **Babylon.js Docs:** https://doc.babylonjs.com
- **Rapier Docs:** https://rapier.rs/docs/
- **Zustand Docs:** https://docs.pmnd.rs/zustand/
- **LibreDWG:** https://www.gnu.org/software/libredwg/

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

### DWG import fails
- Check WASM files in `public/wasm/`
- Verify LibreDWG version compatibility (supports R13-R2021)
- Check browser console for detailed error messages

### Gizmo not appearing
- Ensure mesh is selected in `editorStore`
- Call `gizmo.attachToMesh(mesh)`

### WebGPU not working
- Check browser compatibility (Chrome 113+, Edge 113+)
- Fallback to WebGL2 is automatic
- Set `localStorage.setItem('preferWebGPU', 'false')` to force WebGL2

---

## 📊 Project Status

**Current Features** ✅
- ✅ Physics abstraction layer functional
- ✅ Babylon scene rendering (WebGPU + WebGL2)
- ✅ React UI with dockable panels
- ✅ Entity system implemented
- ✅ DWG/DXF CAD file import
- ✅ URDF robot loading
- ✅ Kinematics system (FK/IK)
- ✅ Asset library browser
- ✅ Transform gizmos
- ✅ Command pattern (undo/redo)
- ✅ Path planning (RRT-Connect)

**In Progress** 🚧
- 🚧 Multi-robot coordination
- 🚧 Spot welding planner
- 🚧 MJCF export improvements
- 🚧 JT loader refinement

**Planned** 📋
- 📋 Collision detection visualization
- 📋 Trajectory playback
- 📋 Physics simulation control
- 📋 Advanced IK solvers

---

## 📧 Contact

If blocked >1 hour, post in `#dev-blockers` Slack channel

---

## 📄 License

MIT

---

**Built with ❤️ by George, Cole, and Edwin**
