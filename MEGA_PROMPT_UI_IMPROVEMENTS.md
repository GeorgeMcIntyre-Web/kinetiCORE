# MEGA PROMPT: kinetiCORE UI/UX Improvements

## Project Context
**Application**: kinetiCORE - Web-based 3D industrial simulation and kinematics platform
**Stack**: React + TypeScript + Babylon.js + Rapier physics
**Developer**: Edwin (UI/UX, React components, state management)
**Tool**: Cursor AI Agent

---

## CRITICAL REQUIREMENTS

### Coding Standards
- **TypeScript strict mode** enabled
- **Functional React components only** (no classes)
- Use **Zustand selectors** to minimize re-renders
- Always **dispose 3D resources**: geometries, materials, textures, physics bodies
- **Max line length**: 100 characters
- Use `const` over `let`, never `var`
- **Commit message format**: `feat:`, `fix:`, `refactor:`, `docs:`

### Architecture Principles
1. **Z-up coordinate system** - kinetiCORE uses Z-up (CAD/ROS standard)
2. **Physics abstraction layer** - Never import Rapier directly, always use `IPhysicsEngine`
3. **Scene entities** - Unified objects that sync Babylon meshes ↔ Rapier bodies automatically
4. **Command pattern** - All user actions wrapped in commands (enables undo/redo)
5. **Separate state layers** - React state (Zustand) is independent from 3D scene state
6. **Direct mutation in render loops** - Never `setState` in animation loops, use refs

### Key Files & Locations
```
src/
├── ui/
│   ├── layouts/
│   │   ├── EssentialModeLayout.tsx    # Beginner-friendly interface
│   │   ├── ProfessionalModeLayout.tsx # Advanced user interface
│   │   └── ExpertModeLayout.tsx       # Power user/Enterprise interface
│   ├── components/
│   │   ├── MeasurementTools.tsx       # Distance, angle, volume measurements
│   │   ├── RibbonToolbar.tsx          # Main toolbar component
│   │   └── Header.tsx                 # Application header
│   └── store/
│       └── editorStore.ts             # Main Zustand state store
├── manipulation/
│   ├── SnappingHelper.ts              # Main snapping coordinator
│   ├── TransformGizmo.ts              # Transform gizmo (move/rotate/scale)
│   └── snap/                          # Individual snap strategies
│       ├── snapTypes.ts               # SnapResult interface definition
│       ├── vertexSnap.ts
│       ├── edgeSnap.ts
│       └── faceSnap.ts
└── scene/
    └── BooleanOperations.ts           # CSG2 Boolean operations
```

---

## TASK 1: Verify Snapping Feature Functionality and Coordinate Retrieval

### Current Implementation
**File**: `src/manipulation/SnappingHelper.ts`

The snapping system already provides a `SnapResult` interface:
```typescript
export interface SnapResult {
  snapped: boolean;
  position: BABYLON.Vector3;      // The snapped world position
  normal?: BABYLON.Vector3;       // Surface normal at snap point
  type: SnapType;                 // Type of snap (vertex, edge, face, etc.)
  targetMesh?: BABYLON.Mesh;      // The mesh that was snapped to
  distance?: number;              // Distance from original position to snap
}
```

### Requirements
1. **Add a UI display** to show the snapped coordinates in the bottom-right corner when a snap occurs
2. **Create a reusable SnapCoordinateDisplay component** that shows:
   - Snapped X, Y, Z coordinates (in user coordinates, not Babylon coordinates)
   - Snap type (vertex, edge, face, center, etc.)
   - Target object name (if available)
   - Distance from original position
3. **Add a "Copy Coordinates" button** to copy the snapped coordinates to clipboard
4. **Persist the last snap coordinates** in the editorStore for easy access
5. **Make it toggleable** - add a setting to show/hide the snap coordinate display

### Implementation Steps
```typescript
// Step 1: Add to editorStore.ts
interface EditorState {
  // ... existing state
  lastSnapResult: SnapResult | null;
  setLastSnapResult: (result: SnapResult | null) => void;
  showSnapCoordinates: boolean;
  setShowSnapCoordinates: (show: boolean) => void;
}

// Step 2: Create new component src/ui/components/SnapCoordinateDisplay.tsx
// - Display snapped coordinates in user-friendly format
// - Show snap type and target object
// - Include "Copy" button
// - Position: bottom-right corner, above version display

// Step 3: Update SnappingHelper.ts to publish snap results to store
// When a snap occurs, call: useEditorStore.getState().setLastSnapResult(snapResult)

// Step 4: Add toggle in FloatingSettingsPanel.tsx
// Add checkbox: "Show Snap Coordinates"

// Step 5: Integrate into EssentialModeLayout.tsx and ProfessionalModeLayout.tsx
// Add <SnapCoordinateDisplay /> component
```

### Acceptance Criteria
- [ ] Snap coordinates display in bottom-right corner when snap occurs
- [ ] Coordinates shown in user coordinate system (mm, Z-up)
- [ ] Display shows snap type (vertex, edge, face, center, etc.)
- [ ] "Copy Coordinates" button copies to clipboard as JSON
- [ ] Display can be toggled on/off in settings
- [ ] Last snap result persists in store and can be retrieved programmatically

---

## TASK 2: Test and Improve Boolean Operations (Union, Subtract, Intersect)

### Current Implementation
**File**: `src/scene/BooleanOperations.ts`

Uses Babylon.js CSG2 library with Manifold backend. Operations already implemented:
```typescript
static async performOperation(
  meshA: BABYLON.Mesh,
  meshB: BABYLON.Mesh,
  operation: BooleanOperationType, // 'union' | 'subtract' | 'intersect'
  scene?: BABYLON.Scene
): Promise<BooleanOperationResult>
```

### Requirements
1. **Create a comprehensive test suite** for Boolean operations:
   - Test union: Overlapping cubes should merge correctly
   - Test subtract: Subtract sphere from cube should create hole
   - Test intersect: Intersection of cube and sphere
   - Test edge cases: Non-overlapping meshes, identical meshes
   - Test performance: Measure operation time for complex meshes
2. **Add visual feedback** during operations (loading indicator)
3. **Improve error handling** and user feedback
4. **Add undo/redo support** for Boolean operations
5. **Create UI shortcuts** in the ribbon toolbar for quick access

### Implementation Steps
```typescript
// Step 1: Create test file tests/scene/BooleanOperations.test.ts
// - Test all three operations with various primitive combinations
// - Test error cases (null meshes, non-manifold geometry)
// - Performance benchmarks

// Step 2: Create BooleanOperationCommand.ts (already exists, verify it works)
// - Implement ICommand interface
// - Store original meshes for undo
// - Execute operation and track result

// Step 3: Update EssentialModeLayout.tsx ribbon
// Add Boolean operation buttons to "Modeling" section:
// - Union icon
// - Subtract icon
// - Intersect icon
// Require 2 selected objects to enable

// Step 4: Add visual feedback
// - Show loading indicator during operation
// - Show success/error toast notification
// - Highlight result mesh after operation

// Step 5: Add keyboard shortcuts
// - Ctrl+U: Union
// - Ctrl+Shift+U: Subtract
// - Ctrl+I: Intersect
```

### Test Cases to Implement
```typescript
describe('BooleanOperations', () => {
  test('Union: Two overlapping cubes', async () => {
    // Create two cubes with 50% overlap
    // Perform union
    // Verify result is single mesh
    // Verify volume is correct
  });

  test('Subtract: Sphere from cube', async () => {
    // Create cube and sphere
    // Subtract sphere from cube
    // Verify hole is created
    // Verify volume decreased
  });

  test('Intersect: Cube and sphere', async () => {
    // Create cube and sphere with partial overlap
    // Intersect them
    // Verify only overlapping region remains
  });

  test('Error handling: Non-overlapping meshes', async () => {
    // Create two non-overlapping cubes
    // Attempt intersect
    // Verify graceful error handling
  });
});
```

### Acceptance Criteria
- [ ] All Boolean operations (union, subtract, intersect) tested and working
- [ ] Test suite with minimum 80% code coverage
- [ ] Loading indicator shown during operations
- [ ] Error messages are user-friendly and actionable
- [ ] Undo/redo works correctly for Boolean operations
- [ ] Ribbon toolbar has Boolean operation buttons
- [ ] Keyboard shortcuts implemented and documented
- [ ] Performance is acceptable (<500ms for simple primitives)

---

## TASK 3: Add Billboard Labels to Distance Measurement Feature

### Current Implementation
**File**: `src/ui/components/MeasurementTools.tsx`

Currently creates:
- Measurement spheres at pick points
- Line connecting points
- Distance calculation

**ISSUE**: Lines are NOT deleted when measurement feature is turned off!

### Requirements
1. **Add billboard labels** that always face the camera showing:
   - Distance value (in mm and meters)
   - Point coordinates (X, Y, Z)
   - Midpoint label showing total distance
2. **Fix disposal issue**: Ensure ALL measurement artifacts are deleted when feature is turned off
3. **Improve visual styling**: Use modern, clean design for labels
4. **Add measurement history**: Keep a log of all measurements taken in session

### Implementation Steps
```typescript
// Step 1: Create billboard label helper function
const createBillboardLabel = (
  text: string,
  position: BABYLON.Vector3,
  scene: BABYLON.Scene
): BABYLON.Mesh => {
  // Create a plane mesh
  const plane = BABYLON.MeshBuilder.CreatePlane("label", {
    size: 0.1
  }, scene);

  // Make it always face camera (billboard mode)
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  // Create dynamic texture for text
  const texture = new BABYLON.DynamicTexture(
    "labelTexture",
    { width: 512, height: 256 },
    scene
  );

  // Draw text on texture
  const ctx = texture.getContext();
  ctx.font = "bold 72px Arial";
  ctx.fillStyle = "white";
  ctx.fillText(text, 10, 150);
  texture.update();

  // Create material
  const material = new BABYLON.StandardMaterial("labelMat", scene);
  material.diffuseTexture = texture;
  material.emissiveColor = new BABYLON.Color3(1, 1, 1);
  material.backFaceCulling = false;

  plane.material = material;
  plane.position = position;

  return plane;
};

// Step 2: Update MeasurementTools.tsx state
interface MeasurementState {
  type: MeasurementType;
  points: BABYLON.Vector3[];
  nodes: string[];
  result: string | null;
  helperMeshes: BABYLON.Mesh[];
  billboardLabels: BABYLON.Mesh[]; // ADD THIS
  measurementLines: BABYLON.Mesh[]; // ADD THIS for explicit tracking
}

// Step 3: Create labels when measurement is complete
const createMeasurementLabels = (
  points: BABYLON.Vector3[],
  distance: number,
  scene: BABYLON.Scene
): BABYLON.Mesh[] => {
  const labels: BABYLON.Mesh[] = [];

  // Label at point A
  const pointALabel = createBillboardLabel(
    `Point A\nX: ${points[0].x.toFixed(2)}mm\nY: ${points[0].y.toFixed(2)}mm\nZ: ${points[0].z.toFixed(2)}mm`,
    points[0].add(new BABYLON.Vector3(0, 0.05, 0)),
    scene
  );
  labels.push(pointALabel);

  // Label at point B
  const pointBLabel = createBillboardLabel(
    `Point B\nX: ${points[1].x.toFixed(2)}mm\nY: ${points[1].y.toFixed(2)}mm\nZ: ${points[1].z.toFixed(2)}mm`,
    points[1].add(new BABYLON.Vector3(0, 0.05, 0)),
    scene
  );
  labels.push(pointBLabel);

  // Midpoint label showing distance
  const midpoint = BABYLON.Vector3.Center(points[0], points[1]);
  const distanceLabel = createBillboardLabel(
    `Distance: ${distance.toFixed(2)}mm (${(distance / 1000).toFixed(3)}m)`,
    midpoint.add(new BABYLON.Vector3(0, 0.05, 0)),
    scene
  );
  labels.push(distanceLabel);

  return labels;
};

// Step 4: Fix disposal - ensure cleanup on close
const cleanup = () => {
  // Dispose all helper meshes
  state.helperMeshes.forEach(mesh => mesh.dispose());

  // Dispose all billboard labels
  state.billboardLabels?.forEach(label => {
    if (label.material) {
      if (label.material.diffuseTexture) {
        label.material.diffuseTexture.dispose();
      }
      label.material.dispose();
    }
    label.dispose();
  });

  // Dispose all measurement lines
  state.measurementLines?.forEach(line => line.dispose());

  // Reset state
  setState({
    type: null,
    points: [],
    nodes: [],
    result: null,
    helperMeshes: [],
    billboardLabels: [],
    measurementLines: []
  });
};

// Step 5: Add measurement history to editorStore
interface EditorState {
  measurementHistory: Array<{
    timestamp: Date;
    type: 'distance' | 'angle' | 'volume';
    result: string;
    points: { x: number; y: number; z: number }[];
  }>;
  addMeasurement: (measurement: MeasurementHistoryItem) => void;
  clearMeasurementHistory: () => void;
}
```

### Visual Design Specifications
```css
/* Billboard label styling */
- Background: Semi-transparent dark background (rgba(0, 0, 0, 0.75))
- Text color: White (#FFFFFF)
- Font: Bold 16px Arial or system font
- Padding: 8px
- Border radius: 4px
- Border: 1px solid rgba(255, 255, 255, 0.3)
- Shadow: Drop shadow for depth

/* Measurement line styling */
- Color: Cyan (#00D9FF) for high visibility
- Thickness: 2px
- Dashed pattern for distance measurements
- Solid for angle measurements
```

### Acceptance Criteria
- [ ] Billboard labels always face the camera
- [ ] Labels show coordinates and distance in both mm and meters
- [ ] Midpoint label shows total distance
- [ ] ALL measurement artifacts (spheres, lines, labels) are deleted when feature is turned off
- [ ] No memory leaks (all textures, materials, meshes properly disposed)
- [ ] Measurement history is stored and can be viewed
- [ ] Labels use modern, clean visual design
- [ ] Labels are readable at all zoom levels (adaptive sizing)

---

## TASK 4: Turn Off Translation Gizmo by Default

### Current Implementation
**File**: `src/ui/store/editorStore.ts` (line 664)

```typescript
transformGizmoEnabled: true, // Currently enabled by default
```

### Requirements
1. **Change default to `false`** so transform gizmo is hidden until explicitly activated
2. **Update ribbon toolbar** to clearly indicate gizmo state
3. **Add keyboard shortcut** to quickly toggle gizmo (e.g., `T` key)
4. **Add tooltip** explaining how to enable the gizmo
5. **Persist user preference** in localStorage

### Implementation Steps
```typescript
// Step 1: Change default in editorStore.ts
transformGizmoEnabled: false, // Disable by default

// Step 2: Add localStorage persistence
const useEditorStore = create<EditorState>((set, get) => ({
  // ... existing state
  transformGizmoEnabled: (() => {
    try {
      const saved = localStorage.getItem('transformGizmoEnabled');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  })(),

  setTransformGizmoEnabled: (enabled) => {
    set({ transformGizmoEnabled: enabled });
    try {
      localStorage.setItem('transformGizmoEnabled', JSON.stringify(enabled));
    } catch (error) {
      console.warn('Failed to persist gizmo preference:', error);
    }
  },
}));

// Step 3: Add keyboard shortcut to EssentialModeLayout.tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't trigger if typing in input
    if (e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const currentState = useEditorStore.getState().transformGizmoEnabled;
      useEditorStore.getState().setTransformGizmoEnabled(!currentState);
      toast.info(`Transform Gizmo ${!currentState ? 'Enabled' : 'Disabled'}`);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

// Step 4: Update ribbon toolbar buttons to show active state
// In RibbonToolbar.tsx or wherever transform buttons are:
<button
  className={`toolbar-btn ${transformGizmoEnabled ? 'active' : ''}`}
  onClick={() => handleTransformModeChange('translate')}
  title="Move (T to toggle gizmo)"
>
  <Move size={18} />
  {!transformGizmoEnabled && <span className="badge">Off</span>}
</button>
```

### CSS for Active State
```css
/* Add to relevant CSS file */
.toolbar-btn.active {
  background: rgba(0, 217, 255, 0.15);
  border-color: rgba(0, 217, 255, 0.5);
}

.toolbar-btn .badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(255, 59, 48, 0.9);
  color: white;
  font-size: 8px;
  padding: 1px 3px;
  border-radius: 2px;
}
```

### Acceptance Criteria
- [ ] Transform gizmo is disabled by default on fresh load
- [ ] User preference persists across sessions (localStorage)
- [ ] `T` key toggles gizmo on/off
- [ ] Toolbar button shows active/inactive state clearly
- [ ] Toast notification confirms state change
- [ ] Tooltip explains how to enable gizmo
- [ ] No regressions in existing transform functionality

---

## TASK 5: Rework Expert Mode to Match Essential and Pro Mode Aesthetics

### Current State Analysis

**Essential Mode** (`EssentialModeLayout.css`):
- Modern dark theme: `background: #1a202c`
- Clean header: `background: #2d3748`
- Integrated Header component with mode switching
- Ribbon toolbar design
- Consistent color scheme (cyan accents: `#00D9FF`)

**Professional Mode** (`ProfessionalModeLayout.tsx`):
- Similar to Essential mode but with more features
- Uses same Header component
- Consistent styling with Essential mode
- Additional dockable panels

**Expert Mode** (`ExpertModeLayout.css` - NEEDS REWORK):
- Different color scheme: `background: #0a0e14` (too dark)
- Different header: `background: #161b22` (GitHub-style, inconsistent)
- Custom workspace tabs instead of standard Header component
- No ribbon toolbar integration
- Purple accent: `rgba(139, 92, 246, 0.9)` (inconsistent with app theme)

### Requirements
1. **Unify visual design** with Essential and Pro modes
2. **Replace custom header** with the standard Header component
3. **Add ribbon toolbar** for consistency
4. **Update color scheme** to match the cyan theme
5. **Improve layout** to match the modern aesthetic
6. **Keep expert-specific features** (command palette, multi-viewport, etc.)

### Implementation Steps

#### Step 1: Update Color Scheme
```css
/* ExpertModeLayout.css - Update colors */
.expert-layout {
  background: #1a202c; /* Match Essential mode */
  color: #e2e8f0; /* Lighter text for readability */
}

.expert-header {
  background: #2d3748; /* Match Essential mode */
  border-bottom: 1px solid #4a5568;
}

/* Replace purple accent with cyan */
.mode-badge.expert {
  background: rgba(0, 217, 255, 0.9); /* Cyan instead of purple */
  color: white;
}

.workspace-tab.active {
  background: rgba(0, 217, 255, 0.15); /* Cyan tint */
  border-bottom: 2px solid #00D9FF; /* Cyan accent */
}
```

#### Step 2: Integrate Header Component
```typescript
// ExpertModeLayout.tsx - Replace custom header
import { Header } from '../components/Header';

// Remove custom header, replace with:
<Header
  currentMode="expert"
  onModeChange={(mode) => setUserLevel(mode)}
  onSettingsClick={() => setShowSettings(true)}
  onHelpClick={() => setShowHelp(true)}
  className="fixed top-0 left-0 right-0 z-50"
  // Expert mode can have custom ribbon items
  ribbonProps={{
    // Add expert-specific tools
    onCommandPaletteClick: () => setCommandPaletteOpen(true),
    // ... other ribbon actions
  }}
/>
```

#### Step 3: Add Ribbon Toolbar Below Header
```typescript
// Add ribbon section for expert mode tools
<div className="expert-ribbon">
  {/* Quick Actions */}
  <div className="ribbon-section">
    <span className="ribbon-label">Quick Actions</span>
    <button onClick={() => setCommandPaletteOpen(true)} title="Command Palette (Ctrl+K)">
      <Terminal size={16} />
    </button>
    <button onClick={handleSaveLayout} title="Save Layout">
      <Save size={16} />
    </button>
    <button onClick={handleLoadLayout} title="Load Layout">
      <Upload size={16} />
    </button>
  </div>

  {/* Viewport Controls */}
  <div className="ribbon-section">
    <span className="ribbon-label">Viewports</span>
    <button
      className={activeViewport === 'top' ? 'active' : ''}
      onClick={() => setActiveViewport('top')}
    >
      Top
    </button>
    <button
      className={activeViewport === 'front' ? 'active' : ''}
      onClick={() => setActiveViewport('front')}
    >
      Front
    </button>
    <button
      className={activeViewport === 'right' ? 'active' : ''}
      onClick={() => setActiveViewport('right')}
    >
      Right
    </button>
    <button
      className={activeViewport === 'perspective' ? 'active' : ''}
      onClick={() => setActiveViewport('perspective')}
    >
      3D
    </button>
  </div>

  {/* Advanced Tools */}
  <div className="ribbon-section">
    <span className="ribbon-label">Advanced</span>
    {/* Add expert-specific tools here */}
  </div>
</div>
```

#### Step 4: Update Layout Structure
```typescript
// New layout structure matching Essential/Pro modes
return (
  <div className="expert-layout">
    {/* Standard Header */}
    <Header {...headerProps} />

    {/* Expert Ribbon (below header) */}
    <div className="expert-ribbon">
      {/* Ribbon sections as defined above */}
    </div>

    {/* Main content area */}
    <div className="expert-content" style={{
      position: 'fixed',
      top: 'var(--app-header-height, 96px)',
      left: 0,
      right: 0,
      bottom: 0,
    }}>
      {/* Existing expert mode content (dockable panels, viewports, etc.) */}
      <DockableLayoutWrapper {...dockableProps} />
    </div>

    {/* Command Palette (overlay) */}
    {commandPaletteOpen && (
      <CommandPalette
        onClose={() => setCommandPaletteOpen(false)}
        query={commandQuery}
        onQueryChange={setCommandQuery}
      />
    )}

    {/* Version Display */}
    <VersionDisplay mode="footer" showBuildInfo={true} />
  </div>
);
```

#### Step 5: Update CSS for Ribbon
```css
/* ExpertModeLayout.css - Add ribbon styles */
.expert-ribbon {
  background: #2d3748;
  border-bottom: 1px solid #4a5568;
  display: flex;
  gap: 24px;
  padding: 8px 16px;
  align-items: center;
  height: 48px;
}

.ribbon-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.ribbon-section:last-child {
  border-right: none;
}

.ribbon-label {
  font-size: 11px;
  color: #a0aec0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-right: 8px;
  font-weight: 600;
}

.ribbon-section button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.ribbon-section button:hover {
  background: rgba(0, 217, 255, 0.15);
  border-color: rgba(0, 217, 255, 0.5);
}

.ribbon-section button.active {
  background: rgba(0, 217, 255, 0.25);
  border-color: #00D9FF;
  color: #00D9FF;
}

.expert-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}
```

#### Step 6: Update Multi-Viewport Styling
```css
/* Make viewports match overall theme */
.viewport-container {
  background: #1a202c;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.viewport-container.active {
  border-color: #00D9FF;
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.3);
}

.viewport-label {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #00D9FF;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### Design Mockup Structure
```
┌─────────────────────────────────────────────────────┐
│ HEADER (Standard Header Component)                  │
│ Logo | Mode Badge: Expert | Settings | Help         │
├─────────────────────────────────────────────────────┤
│ RIBBON TOOLBAR                                       │
│ [Quick Actions] [Viewports] [Advanced Tools]        │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┬─────────────┐                      │
│  │   TOP       │   FRONT     │                      │
│  │  Viewport   │  Viewport   │  [Dockable Panels]  │
│  ├─────────────┼─────────────┤                      │
│  │   RIGHT     │ PERSPECTIVE │                      │
│  │  Viewport   │  Viewport   │                      │
│  └─────────────┴─────────────┘                      │
│                                                       │
├─────────────────────────────────────────────────────┤
│ Version Display (bottom-right)                       │
└─────────────────────────────────────────────────────┘
```

### Acceptance Criteria
- [ ] Expert mode uses same color scheme as Essential/Pro modes
- [ ] Standard Header component integrated (no custom header)
- [ ] Ribbon toolbar added below header
- [ ] Cyan accent color (#00D9FF) used throughout
- [ ] Multi-viewport layout preserved and enhanced
- [ ] Command palette still accessible (Ctrl+K)
- [ ] Layout save/load functionality maintained
- [ ] No visual regression in Essential or Pro modes
- [ ] Expert mode feels like a natural progression from Pro mode
- [ ] All expert-specific features still functional

---

## GENERAL IMPLEMENTATION NOTES

### Testing Strategy
1. **Unit tests** for all new functionality
2. **Integration tests** for UI interactions
3. **E2E tests** for critical workflows
4. **Visual regression tests** for layout changes
5. **Performance testing** for Boolean operations

### Git Workflow
```bash
# Create feature branch for each task
git checkout -b feature/snap-coordinates
git checkout -b feature/boolean-improvements
git checkout -b feature/measurement-billboards
git checkout -b feature/gizmo-default-off
git checkout -b feature/expert-mode-redesign

# Commit format
git commit -m "feat: add snap coordinate display component"
git commit -m "fix: cleanup measurement artifacts on close"
git commit -m "refactor: unify expert mode styling with essential/pro"
```

### Code Review Checklist
- [ ] TypeScript strict mode passes
- [ ] No ESLint errors or warnings
- [ ] All tests passing
- [ ] Visual design matches mockups
- [ ] Performance is acceptable
- [ ] Accessibility considerations addressed
- [ ] Documentation updated
- [ ] No memory leaks (all resources disposed)

### Documentation to Update
- [ ] `README.md` - Update features list
- [ ] `docs/UI_COMPONENTS.md` - Document new components
- [ ] `docs/KEYBOARD_SHORTCUTS.md` - Document new shortcuts
- [ ] `docs/TESTING_GUIDE.md` - Add test coverage info
- [ ] JSDoc comments in all new functions

---

## PRIORITY ORDER

1. **TASK 4** (Turn off translation gizmo) - Quick win, immediate UX improvement
2. **TASK 3** (Measurement billboards) - Bug fix required, high visibility
3. **TASK 1** (Snap coordinates) - Feature enhancement, high value
4. **TASK 5** (Expert mode redesign) - Visual consistency, can be done in parallel
5. **TASK 2** (Boolean operations) - Testing and refinement, lower urgency

---

## SUCCESS METRICS

### User Experience
- Reduced clicks to common actions
- Improved visual consistency across modes
- Better discoverability of features
- Reduced cognitive load

### Technical Quality
- Test coverage > 80%
- No memory leaks
- Performance maintained or improved
- Zero ESLint errors

### Adoption
- Users enable snap coordinate display
- Boolean operations used regularly
- Expert mode adopted by power users
- Measurement feature used for validation

---

## FINAL NOTES

**This mega prompt should be used iteratively**. Tackle one task at a time, commit frequently, and test thoroughly. Each task is designed to be independent but they all contribute to a more polished, professional, and consistent user experience.

**Communication**: Update the team Slack channel when starting/completing each task. Tag relevant team members for code review.

**Questions**: If any requirements are unclear or you encounter technical blockers, refer back to:
- `CLAUDE.md` for project context
- `docs/architecture.md` for system design
- Team lead (George) for technical decisions
- Product owner for UX/feature decisions

Good luck! 🚀
