## kinetiCORE — AI Developer Brief

### Goal of this brief
Give an AI coding agent the exact context needed to make high‑quality, aligned contributions to kinetiCORE without re‑discovering basics.

---

### 1) What kinetiCORE is
- **Web-based industrial robotics simulator** with 3D CAD import, FK/IK kinematics, physics, Boolean ops, and a modern React UI.
- **Vision**: "Figma for Manufacturing Engineering" — collaborative, fast, affordable.
- **Current status**: Production-ready core (selection, transforms, CSG, command system), strong CAD import, robust kinematics foundation, extensive docs and tests.

Primary reference: `README.md` (business + technical overview).

---

### 2) Core tech stack
- **Frontend**: React 18, TypeScript (strict), Babylon.js 8.30, Tailwind, Vite
- **Physics**: Rapier3D (WASM) via abstraction layer
- **State**: Zustand; command/undo-redo pattern for actions
- **CAD/Robotics**: JT, URDF, USD/USDZ, glTF/GLB, STL/OBJ, DXF; IK/FK solvers
- **Backend utilities**: Python Flask USD converter (local dev); Cloudflare Pages for deploy

Key file: `package.json` (scripts, deps). Run locally with `npm run dev` (spawns Vite + USD server).

---

### 3) Repository structure (high-signal)
- `src/`
  - `kinematics/` — FK/IK solvers, managers, tests
  - `loaders/` — Importers: `jt/`, `urdf/`, `usd/`, `glb/`, `dwg/`, etc.
  - `babylon/` — Scene-level helpers (rig builder, math, state capture)
  - `manipulation/` — Transform gizmo & interaction systems
  - `ui/` — React components (panels, toolbar, canvas, layouts)
  - `history/` — Command system (undo/redo)
  - `physics/` — Rapier abstraction
  - `scene/` — Scene tree, camera service, managers
- `server/` — Python USD converter
- `docs/` — Extensive design/implementation status, guides, business context
- `tools/jt_conversion/` — JT pipelines and .NET tools

Start points:
- App bootstrap: `src/main.tsx`
- Canvas + scene: `src/ui/components/SceneCanvas.tsx`, `src/scene/SceneManager.ts`
- Kinematics control: `src/kinematics/KinematicsManager.ts`
- IK/FK solvers: `src/kinematics/ForwardKinematicsSolver.ts`, `src/kinematics/InverseKinematicsSolver.ts`, `src/kinematics/WholeBodyIKSolver.ts`
- Importers: `src/loaders/*`

---

### 4) How to run, build, test
- Dev: `npm run dev` (starts Vite + USD Flask server)
- UI only: `npm run dev:ui`
- Type-check: `npm run type-check`
- Tests: `npm test` or `npm run test:coverage`
- Lint/fix: `npm run lint:fix`
- Build: `npm run build`; Preview: `npm run preview`
- USD server: `npm run usd-server`

Deployment: Cloudflare Pages (`wrangler pages deploy`). See `README.md`.

---

### 5) Coding standards and expectations
- TypeScript strict; no `any` unless justified.
- Follow command pattern for user-facing mutations; ensure undo/redo coverage.
- Keep React state separate from Babylon/scene state; do not couple UI to engine internals.
- Physics via abstraction (`physics/`); avoid importing Rapier directly in features.
- Tests for core math/kinematics and commands; prefer unit tests under `src/**/__tests__`.
- Coordinate system: Z‑up; validate conversions when integrating loaders.

---

### 6) Kinematics domain map (where to work)
- Solvers and utilities:
  - `src/kinematics/ForwardKinematicsSolver.ts`
  - `src/kinematics/InverseKinematicsSolver.ts`
  - `src/kinematics/WholeBodyIKSolver.ts`
  - `src/kinematics/TrajectoryIKSolver.ts`
  - `src/kinematics/IKTargetGizmoManager.ts`
  - `src/kinematics/UnifiedGizmoManager.ts`
  - `src/kinematics/utils/*` (targets, storage, math)
- Scene rigging:
  - `src/babylon/kinematics/KinematicRigBuilder.ts`
  - `src/kinematics/KinematicsManager.ts`
- UI interaction:
  - `src/ui/components/RobotJoggingPanel*.tsx`
  - `src/ui/components/FloatingKinematicsPanel.tsx`

Test anchors:
- `src/kinematics/__tests__/*`
- `src/kinematics/utils/__tests__/*`

---

### 7) CAD import and kinematics extraction
- URDF: `src/loaders/urdf/URDFLoader.ts`, `URDFJointExtractor.ts`
- JT: `src/loaders/jt/RealJtReaderService.ts` and `tools/jt_conversion/*`
- GLB/GLTF: `src/loaders/glb/GLBLoader.ts`, `upAxis.ts`
- USD: Python Flask server converts → glTF; see `server/` and README commands

When adding kinematics from CAD:
- Normalize coordinate systems (Z‑up) and units.
- Preserve joint hierarchy, limits, and names.
- Map CAD joints → internal joint types (revolute/prismatic) and constraints.

---

### 8) Current priorities (from README roadmap)
- Visual joint placement gizmo and axis editing
- More robust IK (EE drag → solve → constraints)
- Collision detection integration and safety limits
- CAD kinematics auto-detection (JT/CATIA → joints)
- Multi-robot coordination support

If choosing tasks, align with Phase 2/3 items and add tests.

---

### 9) Interop with related work (context from WebGL Kinematics project)
- Shared concepts: kinematic units, operation sequences, valve banks, point cloud ICP.
- If porting features: prefer native kinetiCORE abstractions (Zustand state, command system, Rapier abstraction) over direct reuse.
- Keep UI consistent with progressive modes (Essential/Pro/Expert) and unified toolbar.

---

### 10) PR guidelines for the AI agent
- Scope narrowly; 1 feature or bugfix per PR.
- Include: description, rationale, screenshots/gifs if UI, tests, docs updates.
- Maintain performance (60 FPS target) and memory footprint; profile large scenes.
- Validate coordinate transforms and joint limits; add unit tests when touching math.

---

### 11) Common pitfalls
- Mixing UI and engine state; bypassing command system (breaks undo).
- Direct Rapier usage in features; must go through abstraction.
- Ignoring Z‑up conventions during import/export.
- Adding IK features without solver stability tests.

---

### 12) Quick checklist for any new contribution
- [ ] Types added; no unsafe casts
- [ ] Tests added/updated and pass locally
- [ ] Undo/redo works for user-visible actions
- [ ] Docs updated (`docs/` or inline where appropriate)
- [ ] Performance impact evaluated (large scenes)
- [ ] Coordinate frames/units validated

---

### 13) Contacts and ownership
- See `README.md` team section. Default reviewers: Architecture (George), Rendering/Scene (Cole), UI/State (Edwin).

—
This brief should be kept current with roadmap changes in `README.md` and major architecture updates in `ARCHITECTURE_DECISIONS.md`.


