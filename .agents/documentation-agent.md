# Documentation & Demo Agent

**Agent Type**: Cloud (can work async)
**Priority**: Medium
**Estimated Time**: 2 hours
**Owner**: Any team member (Edwin/Cole/George)

## Context
Smart routing feature is functional but needs user-facing documentation, screenshots, and demo materials for README and docs.

## Tasks

### 1. Create Feature Screenshots
**Tools**: Browser, Snipping Tool, OBS Studio

**Required Screenshots**:
- [ ] **Essential Mode** - Clean beginner UI
  - Filename: `docs/images/essential-mode-overview.png`
  - Resolution: 1920x1080
  - Show: Header, scene tree, viewport, floating panels

- [ ] **Professional Mode** - Full ribbon toolbar
  - Filename: `docs/images/professional-mode-toolbar.png`
  - Resolution: 1920x1080
  - Show: Ribbon with all tool categories visible
  - Highlight: Routing category

- [ ] **Expert Mode** - Quad viewport
  - Filename: `docs/images/expert-mode-quad-viewport.png`
  - Resolution: 1920x1080
  - Show: All 4 viewports (3 orthographic + 1 perspective)

- [ ] **Mode Switcher** - Header dropdown
  - Filename: `docs/images/mode-switcher-dropdown.png`
  - Show: Dropdown menu open with all 3 modes

- [ ] **Export Dialog** - Format selection
  - Filename: `docs/images/export-dialog.png`
  - Show: Dialog with all 3 formats visible

- [ ] **Measurement Tools** - Active measurement
  - Filename: `docs/images/measurement-distance.png`
  - Show: Distance measurement in progress with 2 points marked

- [ ] **Routing Workflow** - Full process
  - `docs/images/routing-step1-add-connector.png`
  - `docs/images/routing-step2-route-preview.png`
  - `docs/images/routing-step3-generated-geometry.png`

---

### 2. Create Animated GIFs
**Tools**: ScreenToGif, LICEcap, or Kap

**Required GIFs** (keep under 5 MB each):
- [ ] **Mode Switching**
  - Filename: `docs/gifs/mode-switching.gif`
  - Duration: 10 seconds
  - Show: Switch from Essential → Professional → Expert → back to Essential
  - Framerate: 15 fps

- [ ] **Export Workflow**
  - Filename: `docs/gifs/export-workflow.gif`
  - Duration: 8 seconds
  - Show: Open export dialog → Select format → Click export → File downloads

- [ ] **Measurement Tool**
  - Filename: `docs/gifs/measurement-tool.gif`
  - Duration: 12 seconds
  - Show: Click distance → Pick point 1 → Pick point 2 → See result → Close

- [ ] **Smart Routing**
  - Filename: `docs/gifs/smart-routing.gif`
  - Duration: 20 seconds
  - Show: Full workflow from placing connectors to generating geometry

---

### 3. Update README.md
**File**: [README.md](../README.md)

**Add Section** (after current features):

```markdown
## 🎨 User Interface Modes

kinetiCORE adapts to your skill level with three distinct interface modes:

### Essential Mode (Beginner-Friendly)
<img src="docs/images/essential-mode-overview.png" width="600" alt="Essential Mode">

- Clean, uncluttered interface
- Horizontal ribbon with core tools
- Ideal for learning and simple projects

### Professional Mode (Engineer/Designer)
<img src="docs/images/professional-mode-toolbar.png" width="600" alt="Professional Mode">

- Full ribbon toolbar with advanced tools
- Measurement tools (distance, angle, volume)
- **Smart Routing System** for pipes, cables, and conduits
- Boolean operations and advanced modeling

### Expert Mode (Power User)
<img src="docs/images/expert-mode-quad-viewport.png" width="600" alt="Expert Mode">

- Quad viewport (Top, Front, Right, Perspective)
- Command palette (Ctrl+K)
- Macro recorder and scripting (coming soon)
- Maximum control and customization

**Switch modes anytime** via the header dropdown or keyboard shortcuts (Ctrl+1/2/3).

---

## 🔧 Smart Routing System

Create intelligent pipe, cable, and conduit routes with automatic pathfinding and constraint validation.

![Smart Routing Demo](docs/gifs/smart-routing.gif)

**Features**:
- 🎯 Point-and-click connector placement
- 🚀 Automatic pathfinding around obstacles
- ✅ Real-time constraint validation (bend radius, clearance, supports)
- 🎨 Parametric geometry generation
- ↩️ Fully undoable workflow

**Supported Route Types**:
- Pipe (industrial piping)
- Electrical (wiring harnesses)
- Cable Tray (cable management)
- Conduit (protective tubing)

See [docs/SMART_ROUTING_QUICK_START.md](docs/SMART_ROUTING_QUICK_START.md) for full guide.

---

## 📊 Measurement Tools

![Measurement Tools](docs/gifs/measurement-tool.gif)

Professional mode includes precision measurement tools:
- **Distance**: Click 2 points to measure (mm)
- **Angle**: Click 3 points to measure angle (degrees)
- **Volume**: Select objects to calculate volume (cm³)

---

## 💾 Export Formats

![Export Dialog](docs/images/export-dialog.png)

Export your scenes in multiple formats:
- **Basic JSON**: Scene tree and metadata (~500 KB)
- **Babylon Scene**: Full Babylon.js scene data (~2 MB)
- **Comprehensive**: Everything including physics and kinematics (~5 MB)
```

---

### 4. Update Smart Routing Documentation
**File**: [docs/SMART_ROUTING_QUICK_START.md](../docs/SMART_ROUTING_QUICK_START.md)

**Add**:
- [ ] Screenshots for each workflow step
- [ ] Troubleshooting section
- [ ] Video tutorial link (YouTube placeholder)
- [ ] FAQ section

**Example Enhancement**:
```markdown
## Step-by-Step Guide

### 1. Enable Routing Tools
Switch to **Professional** or **Expert** mode via the header dropdown.

![Mode Switcher](../docs/images/mode-switcher-dropdown.png)

The **Routing** category will appear in the ribbon toolbar:

![Routing Toolbar](../docs/images/professional-mode-toolbar.png)

### 2. Place Connection Points
Click the **Add Connector** button, then click in the 3D scene to place connectors.

![Add Connector](../docs/images/routing-step1-add-connector.png)

💡 **Tip**: Connectors snap to mesh surfaces if you click on an object.

... (continue with screenshots for each step)
```

---

### 5. Create Video Tutorial (Optional)
**Platform**: YouTube or Loom

**Video Structure** (5-8 minutes):
1. **Intro** (30s): What is kinetiCORE smart routing?
2. **Setup** (1min): Switch to Professional mode, show toolbar
3. **Workflow** (3min): Complete routing example
4. **Features** (2min): Show constraint validation, edit mode, undo/redo
5. **Outro** (30s): Links to docs and GitHub

**Upload**:
- [ ] Upload to YouTube (unlisted or public)
- [ ] Add link to [docs/SMART_ROUTING_QUICK_START.md](../docs/SMART_ROUTING_QUICK_START.md)
- [ ] Add to README.md

---

### 6. Create CHANGELOG Entry
**File**: [CHANGELOG.md](../CHANGELOG.md)

**Add** (unreleased section):
```markdown
## [Unreleased]

### Added
- **Smart Routing System** - Intelligent pipe, cable, and conduit routing with automatic pathfinding
  - Add connection points with single click
  - Auto-route between points with obstacle avoidance
  - Real-time constraint validation (bend radius, clearance, support spacing)
  - Generate parametric geometry for 4 route types (pipe, electrical, cable_tray, conduit)
  - Full undo/redo support
- **Export Dialog** - Multi-format export (Basic JSON, Babylon Scene, Comprehensive)
- **Measurement Tools** - Distance, angle, and volume measurement in Professional mode
- **UI Mode System** - Three distinct modes (Essential, Professional, Expert)
  - Essential: Beginner-friendly simplified interface
  - Professional: Full ribbon toolbar with advanced tools
  - Expert: Quad viewport, command palette, scripting support

### Changed
- ExpertModeLayout now includes Export Dialog instead of direct save
- ProfessionalModeLayout ribbon toolbar reorganized for better workflow

### Fixed
- TypeScript compilation errors in MeasurementTools component
- ESLint warnings for React Hook dependencies
```

---

### 7. Create PR Description Template
**File**: `.github/PULL_REQUEST_TEMPLATE/feature_smart_routing.md`

```markdown
## 🚀 Feature: Smart Routing System

### Summary
Adds intelligent routing system for pipes, cables, and conduits with automatic pathfinding, constraint validation, and parametric geometry generation.

### Demo
![Smart Routing Demo](../docs/gifs/smart-routing.gif)

### Changes
- ✅ Smart routing backend ([src/routing/](../src/routing/))
- ✅ RoutingToolbar integration ([src/routing/ui/RoutingToolbar.tsx](../src/routing/ui/RoutingToolbar.tsx))
- ✅ Export Dialog ([src/ui/components/ExportDialog.tsx](../src/ui/components/ExportDialog.tsx))
- ✅ Measurement Tools ([src/ui/components/MeasurementTools.tsx](../src/ui/components/MeasurementTools.tsx))
- ✅ Professional & Expert layout updates

### Testing
- [x] Type-check passes (`npm run type-check`)
- [x] Lint passes (`npm run lint`)
- [ ] Manual testing completed (see [docs/ROUTING_TEST_RESULTS.md](../docs/ROUTING_TEST_RESULTS.md))
- [ ] Build passes (`npm run build`)
- [ ] End-to-end routing workflow tested

### Documentation
- [x] [SMART_ROUTING_QUICK_START.md](../docs/SMART_ROUTING_QUICK_START.md)
- [x] [SMART_ROUTING_WORKFLOW.md](../docs/SMART_ROUTING_WORKFLOW.md)
- [x] [SMART_ROUTING_LIMITATIONS.md](../docs/SMART_ROUTING_LIMITATIONS.md)
- [ ] Screenshots added
- [ ] GIFs created
- [ ] README.md updated
- [ ] CHANGELOG.md updated

### Breaking Changes
None

### Migration Guide
No migration needed. Feature is additive and feature-gated to Professional/Expert modes.
```

---

## Success Criteria

✅ All screenshots captured at consistent resolution
✅ GIFs under 5 MB each, smooth playback
✅ README.md updated with feature showcase
✅ Documentation has visual examples
✅ Video tutorial published (optional)
✅ CHANGELOG.md entry complete
✅ PR template ready

---

## Handoff

When complete:
1. Create `docs/images/` folder if needed
2. Create `docs/gifs/` folder if needed
3. Commit with message: `docs: add smart routing feature documentation and demos`
4. Tag George for review
