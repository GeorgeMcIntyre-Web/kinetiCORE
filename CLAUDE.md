# kinetiCORE - Project Context

## Project Overview
Web-based 3D industrial simulation and kinematics platform for robot simulation.
**Stack:** React + TypeScript + Babylon.js + Rapier physics

## Team Structure
- **George:** Architecture lead, physics abstraction, integration (Claude Code)
- **Cole:** 3D rendering, Babylon.js, scene management (Cursor)
- **Edwin:** UI/UX, React components, state management (Cursor)

## Architecture Principles

1. **Z-up coordinate system** - kinetiCORE uses Z-up (CAD/ROS standard). See `COORDINATE_SYSTEM.md`
2. **Physics abstraction layer** - Never import Rapier directly, always use `IPhysicsEngine`
3. **Scene entities** - Unified objects that sync Babylon meshes ↔ Rapier bodies automatically
4. **Command pattern** - All user actions wrapped in commands (enables undo/redo)
5. **Separate state layers** - React state (Zustand) is independent from 3D scene state
6. **Direct mutation in render loops** - Never `setState` in animation loops, use refs

## Coding Standards

- TypeScript strict mode enabled
- Functional React components only (no classes)
- Use Zustand selectors to minimize re-renders
- Always dispose 3D resources: geometries, materials, textures, physics bodies
- Commit messages format: `feat:`, `fix:`, `refactor:`, `docs:`
- Max line length: 100 characters
- Use `const` over `let`, never `var`

## Project Structure

```
src/
├── core/          - Core engine & shared types (George)
├── physics/       - Physics abstraction layer (George)
├── scene/         - Babylon scene management (Cole)
├── entities/      - Scene entity system (Cole)
├── ui/            - React components (Edwin)
├── manipulation/  - Transform gizmos (Cole + Edwin)
└── history/       - Undo/redo commands (Edwin)
```

## Module Ownership

### George owns:
- `src/core/` - Core types and engine
- `src/physics/` - Physics abstraction

### Cole owns:
- `src/scene/` - Babylon scene setup
- `src/entities/` - Entity management

### Edwin owns:
- `src/ui/` - All React components
- `src/history/` - Command pattern

### Shared (requires coordination):
- `src/manipulation/` - Cole + Edwin
- `core/types.ts` - All (announce before editing)
- `package.json` - All (announce before editing)

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

### Adding a command for undo/redo:
```typescript
const command = new MoveCommand(entity, oldPos, newPos);
commandManager.execute(command); // Automatically adds to undo stack
```

### Zustand state update:
```typescript
// In component
const selectMesh = useEditorStore(state => state.selectMesh);
selectMesh(mesh);

// In render loop (outside React)
const selected = useEditorStore.getState().selectedMeshes;
```

## Known Issues & Gotchas

- **Coordinate systems:** kinetiCORE uses Z-up (CAD/ROS standard) throughout
  - See `COORDINATE_SYSTEM.md` for full details
  - **When adding new loaders:** Load geometry as-is, NO coordinate conversion needed
  - **Unit conversion only:** Use `CoordinateSystem.ts` for mm ↔ m conversion
- **Disposal order:** Always dispose physics bodies BEFORE Babylon meshes
- **localStorage:** Not supported in Claude artifacts - use in-memory state only
- **World matrix:** Call `mesh.computeWorldMatrix(true)` before reading bounds for physics
- **Flexbox layouts:** NEVER use `width: 100%; height: 100%` on flex children
  - Use `flex: 1` with `min-width: 0; min-height: 0` instead
  - See `docs/CSS_STYLE_GUIDE.md` for layout patterns
  - Empty flex children will collapse without proper min-dimensions

## Current Sprint

**Week 1: Foundation (Days 1-5)** ✅ COMPLETE
- ✅ George (Agent 1): Physics abstraction layer, TypeScript error fixes
- ✅ Cole: Babylon scene setup & camera
- ✅ Edwin: React UI shell & Zustand store

**Current Focus: Frontend Testing & Deployment**
- Agent 1 (Claude Code): TypeScript fixes, integration work, CI/CD
  - ✅ TypeScript compilation errors resolved
  - ✅ Custom reference frame integration complete
  - ✅ CI/CD pipeline enhanced (4 parallel jobs)
  - ✅ Comprehensive CI/CD documentation
- Agent 3 (Cursor): Frontend testing readiness, Cloudflare deployment
  - ✅ FloatingPanel reusable component
  - ✅ Header component with mode switching
  - ✅ Design tokens system
  - ✅ EssentialModeLayout Tailwind refactor
  - ✅ USD server error handling
  - ✅ Testing documentation
  - 🔄 Cloudflare Pages deployment workflow

## Development Workflow

### Daily routine:
```bash
# Morning
git checkout main
git pull origin main
git checkout feature/your-branch
git rebase main

# During work
git add .
git commit -m "feat: descriptive message"
git push origin feature/your-branch

# Before PR (CI checks - must pass)
npm run lint              # ESLint checks
npm run type-check        # TypeScript compilation
npm test                  # Unit tests
npm run build             # Production build

# Full CI check locally
npm run lint && npm run type-check && npm test && npm run build
```

### Deployment Workflow (Agent 3 - Cursor):

**Local Testing:**
```bash
# 1. Fix TypeScript build errors
npm run type-check

# 2. Start local development server
npm run dev
# Open http://localhost:5173 to test locally

# 3. Test application works as expected
```

**Cloudflare Pages Deployment:**
```bash
# 1. Fix remaining TypeScript build issues
npm run build

# 2. Create production build
npm run build

# 3. Deploy to Cloudflare Pages
# Agent 3 handles the deployment flow using Cloudflare dashboard or Wrangler CLI
```

**Deployment Checklist:**
- ✅ TypeScript errors preventing build resolved
- ✅ Local development server running successfully
- ✅ Test application locally
- ✅ Fix remaining build issues
- ✅ Create production build
- ✅ Deploy to Cloudflare Pages

### Communication:
- Announce in Slack before editing shared files
- PR review turnaround: 2 hours max
- Daily standup: Async in Slack at 9 AM
- Integration sessions: Friday 4 PM

## AI Tool Usage

### Claude Code (Agent 1 - George):
- System-wide refactoring
- Multi-file architecture changes
- Integration testing
- TypeScript error fixes
- Documentation generation
- Backend architecture

### Cursor (Agent 3 - Cole & Edwin):
- Fast feature iteration
- Component development
- Inline debugging
- Visual UI work
- Real-time suggestions
- Frontend testing
- **Cloudflare deployment workflow**

## Resources

- **Coordinate System Standard:** `COORDINATE_SYSTEM.md` (READ THIS FIRST for loaders!)
- **Physics API Guide:** `docs/PHYSICS_API.md` (Fast & efficient physics integration)
- **CI/CD Pipeline:** `docs/CI_CD.md` (GitHub Actions setup and troubleshooting)
- Babylon.js Docs: https://doc.babylonjs.com
- Rapier Docs: https://rapier.rs/docs/
- Zustand Docs: https://docs.pmnd.rs/zustand/
- Team Roadmap: `/docs/team_roadmap_3person_ai.md`
- Architecture: `/docs/architecture.md`

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
http://localhost:5173
```

## Testing

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:coverage

# Type checking
npm run type-check

# Lint
npm run lint
```

## Git Branch Strategy

**GitHub Flow** (simplified for 3-person team):
- `main` - production-ready code (protected)
- `feature/*` - feature branches (PR required to merge)

Never commit directly to `main`. Always use PRs with 1 approval.

## Success Metrics

**Week 1:**
- ✅ Physics abstraction layer functional
- ✅ Babylon scene rendering
- ✅ React UI shell with state
- ✅ All modules merge without conflicts

**Week 4 (MVP):**
- ✅ 10 users complete workflow without help
- ✅ <50ms input latency
- ✅ 60 FPS with 50 objects
- ✅ No critical bugs

## Emergency Contacts

If blocked >1 hour, post in `#dev-blockers` Slack channel

## Notes

This file is your AI pair programmer's onboarding document. Keep it updated as the project evolves. Both Claude Code and Cursor read this for context.