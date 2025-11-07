# Smart Routing - Frontend/Backend Integration

**Version:** 1.0
**Last Updated:** 2025-01-03
**Purpose:** Explain how the React UI frontend connects to the routing system backend

---

## Overview

The Smart Routing System is a **full-stack** system running entirely in the browser:

```
┌────────────────────────────────────────────────────────────┐
│                      Browser (Client)                       │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FRONTEND (React + Zustand)                          │  │
│  │  - User Interface (buttons, panels, forms)           │  │
│  │  - State Management (selected items, modes)          │  │
│  │  - Event Handlers (clicks, drags, keyboard)          │  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                             │
│               │ Function Calls (TypeScript)                 │
│               │                                             │
│  ┌────────────▼─────────────────────────────────────────┐  │
│  │  BACKEND (Routing System Core)                       │  │
│  │  - ConnectionManager (data model)                    │  │
│  │  - RouteOptimizer (A* pathfinding)                   │  │
│  │  - ConstraintValidator (physics rules)               │  │
│  │  - GeometryGenerators (3D mesh creation)             │  │
│  │  - Babylon.js Scene (rendering)                      │  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                             │
│               │ Mesh Updates, State Changes                 │
│               │                                             │
│  ┌────────────▼─────────────────────────────────────────┐  │
│  │  GPU Rendering (WebGL/WebGPU)                        │  │
│  │  - 3D viewport displays routes, connectors, warnings │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Key Point:** There is NO separate backend server. Everything runs client-side in TypeScript.

---

## Architecture Layers

### Layer 1: React UI (Frontend)

**Location:** `src/ui/`, `src/routing/ui/`

**Responsibilities:**
- Display buttons, panels, forms
- Handle user input (clicks, keyboard)
- Manage UI state (Zustand stores)
- Trigger backend operations via commands

**Key Files:**
- `RoutingControlPanel.tsx` - Main routing UI
- `SceneTree.tsx` - Scene hierarchy display
- `editorStore.ts` - Global editor state
- `routingStore.ts` - Routing-specific state

**Technologies:**
- React (components)
- Zustand (state management)
- Tailwind CSS (styling)
- Lucide React (icons)

---

### Layer 2: Command Layer (Glue)

**Location:** `src/routing/commands/`

**Responsibilities:**
- Connect UI actions to backend operations
- Implement undo/redo functionality
- Ensure atomic operations (all-or-nothing)

**Key Files:**
- `CreateConnectionPointCommand.ts`
- `CreateRouteCommand.ts`
- `GenerateRouteGeometryCommand.ts`
- `EditRouteCommand.ts`

**Pattern: Command Pattern**
```typescript
class CreateRouteCommand implements Command {
  execute(): void {
    // Create route in backend
    // Update stores
    // Refresh UI
  }

  undo(): void {
    // Remove route from backend
    // Update stores
    // Refresh UI
  }
}
```

---

### Layer 3: Routing Core (Backend)

**Location:** `src/routing/core/`, `src/routing/pathfinding/`, `src/routing/geometry/`, `src/routing/validation/`

**Responsibilities:**
- Store data models (ConnectionPoint, Route)
- Run algorithms (A*, constraint validation)
- Generate 3D geometry
- Manage Babylon.js scene objects

**Key Files:**
- `ConnectionManager.ts` - Data storage
- `RouteOptimizer.ts` - Pathfinding
- `ConstraintValidator.ts` - Physics validation
- `PipeGenerator.ts` - 3D mesh creation

**Technologies:**
- TypeScript (logic)
- Babylon.js (3D scene)
- Rapier (physics - future)
- Pure algorithms (A*, math)

---

### Layer 4: Babylon.js Scene (Rendering)

**Location:** `src/scene/`, Babylon.js internals

**Responsibilities:**
- Render 3D meshes to viewport
- Handle camera, lights, materials
- Picking/raycasting for selection
- GPU-accelerated rendering

---

## Data Flow: Complete Example

### User Action: "Create Route Between Two Connectors"

**Step-by-Step Flow:**

#### 1. User Interaction (Frontend)
```tsx
// RoutingControlPanel.tsx
const handleConnectorClick = async (connectorId: string) => {
  if (selectedConnectorIds.length === 1) {
    const [sourceId] = selectedConnectorIds;

    // Call backend via Command
    const routeId = await RoutingWorkflowHandler.createRouteBetweenPoints(
      sourceId,
      connectorId
    );

    if (routeId) {
      // Trigger geometry generation
      const cmdManager = useEditorStore.getState().commandManager;
      const genCmd = new GenerateRouteGeometryCommand(routeId);
      cmdManager.execute(genCmd);
    }
  }
};
```

#### 2. Command Execution (Glue Layer)
```typescript
// CreateRouteCommand.ts
class CreateRouteCommand implements Command {
  execute(): void {
    // Get connection manager (backend)
    const connectionManager = ConnectionManager.getInstance();
    const source = connectionManager.getConnectionPoint(this.sourceId);
    const dest = connectionManager.getConnectionPoint(this.destId);

    // Get obstacles from scene (backend)
    const obstacles = getObstacles(this.scene);

    // Build search graph (backend - Agent 1)
    const graph = SearchGraph.buildGraph(obstacles, nodeDensity, layerSnapping);

    // Find path (backend - Agent 1)
    const waypoints = RouteOptimizer.findPath(
      source.position,
      dest.position,
      graph,
      costFunction
    );

    // Create route object (backend)
    const segments = createSegmentsFromWaypoints(waypoints);
    const route = new Route(source, dest, segments, material, constraints);

    // Validate constraints (backend - Agent 2)
    const validation = ConstraintValidator.validate(route);

    // Store route (backend)
    const routingStore = useRoutingStore.getState();
    routingStore.addRoute(route);

    // Update UI (frontend)
    routingStore.selectRoute(route);
  }
}
```

#### 3. Pathfinding (Backend - Agent 1)
```typescript
// RouteOptimizer.ts
class RouteOptimizer {
  findPath(start: Vector3, goal: Vector3, graph: Graph): Vector3[] {
    // A* algorithm implementation
    const openSet = new PriorityQueue<GraphNode>();
    // ... pathfinding logic ...
    return waypoints; // Array of Vector3 positions
  }
}
```

#### 4. Constraint Validation (Backend - Agent 2)
```typescript
// ConstraintValidator.ts
class ConstraintValidator {
  validate(route: Route): ValidationResult {
    const violations: ConstraintViolation[] = [];

    // Check bend radius
    route.segments.forEach(segment => {
      const bendRadius = calculateBendRadius(segment);
      if (bendRadius < route.constraints.minBendRadius) {
        violations.push({
          type: 'bend_radius',
          severity: 'error',
          message: `Bend too tight: ${bendRadius}m actual, ${route.constraints.minBendRadius}m required`
        });
      }
    });

    return {
      isValid: violations.length === 0,
      violations
    };
  }
}
```

#### 5. Geometry Generation (Backend - Agent 4)
```typescript
// PipeGenerator.ts
class PipeGenerator {
  generate(route: Route, scene: BABYLON.Scene): GeneratedGeometry {
    // Get pipe size from spec table (Agent 3)
    const spec = PIPE_SIZES[route.source.specifications.size];
    const outerDiameter = spec.od;

    // Create tube mesh
    const path = route.segments.map(s => new BABYLON.Vector3(s.startPoint.x, s.startPoint.y, s.startPoint.z));
    const tube = BABYLON.MeshBuilder.CreateTube('pipe', {
      path,
      radius: outerDiameter / 2,
      tessellation: 16
    }, scene);

    // Create elbows at bends
    const elbows = this.generateElbows(route, scene);

    // Apply material
    const material = new BABYLON.StandardMaterial('steel', scene);
    material.diffuseColor = BABYLON.Color3.Gray();
    tube.material = material;

    return { mesh: tube, fittings: elbows, supports: [] };
  }
}
```

#### 6. Scene Update (Babylon.js)
```typescript
// Babylon.js automatically renders updated scene
scene.render(); // Called every frame (60 FPS)
```

#### 7. UI Update (Frontend)
```typescript
// routingStore.ts (Zustand)
addRoute: (route: Route) => {
  set(state => ({
    activeRoutes: [...state.activeRoutes, route]
  }));
},

// React component re-renders automatically (Zustand subscription)
const activeRoutes = useRoutingStore(state => state.activeRoutes);
```

---

## State Management: Frontend ↔ Backend Sync

### Frontend State (Zustand Stores)

**editorStore.ts** (Global):
```typescript
interface EditorStore {
  selectedMeshes: BABYLON.AbstractMesh[];      // Selected 3D objects
  commandManager: CommandManager;               // Undo/redo
  scene: BABYLON.Scene | null;                  // 3D scene reference
}
```

**routingStore.ts** (Routing-specific):
```typescript
interface RoutingStore {
  routingMode: 'off' | 'placing_connector' | 'placing_template';
  currentRouteType: RouteType;
  activeRoutes: Route[];                        // All routes in scene
  selectedRoute: Route | null;                  // Currently selected route
}
```

### Backend State (Singleton Managers)

**ConnectionManager** (Agent 7):
```typescript
class ConnectionManager {
  private connectionPoints: Map<string, ConnectionPoint>; // All connectors
  private connections: Map<string, Connection[]>;         // Graph structure
}
```

**Route Objects** (Agent 1):
```typescript
class Route {
  id: string;
  segments: RouteSegment[];     // Path waypoints
  supports: SupportPoint[];     // Hangers, brackets
  generated: boolean;           // Has 3D geometry been created?
}
```

### Synchronization Rules

**Rule 1:** Frontend state is **derived** from backend state
```typescript
// GOOD: Frontend reads from backend
const connectors = ConnectionManager.getInstance().getAllConnectionPoints();
useRoutingStore.setState({ connectors });

// BAD: Frontend stores duplicate data
const connectors = [/* copied data */];  // OUT OF SYNC!
```

**Rule 2:** Backend updates trigger frontend re-renders
```typescript
// Backend operation
connectionManager.addConnectionPoint(config);

// Frontend listens via Zustand
const connectors = useRoutingStore(state => state.connectors);  // Auto-updates
```

**Rule 3:** UI actions go through Commands (never direct backend calls)
```typescript
// GOOD: Use Command pattern
const cmd = new CreateConnectionPointCommand(config);
commandManager.execute(cmd);  // Enables undo/redo

// BAD: Direct backend call
connectionManager.addConnectionPoint(config);  // No undo!
```

---

## API Reference: Frontend → Backend

### Connection Management

```typescript
// Frontend calls
const connectionManager = ConnectionManager.getInstance();

// Add connector
const connector = connectionManager.addConnectionPoint({
  type: 'pipe',
  position: { x: 0, y: 0, z: 1 },
  direction: { x: 0, y: 0, z: 1 },
  specifications: { size: '3/4"', material: 'steel' }
});

// Get all connectors
const allConnectors = connectionManager.getAllConnectionPoints();

// Remove connector
connectionManager.removeConnectionPoint(connectorId);
```

### Route Creation

```typescript
// Frontend calls (via Command)
const cmd = new CreateRouteCommand(sourceId, destId, routeType);
commandManager.execute(cmd);

// Backend creates Route object
const route = new Route(source, dest, segments, material, constraints);
useRoutingStore.getState().addRoute(route);
```

### Geometry Generation

```typescript
// Frontend calls (via Command)
const cmd = new GenerateRouteGeometryCommand(routeId);
commandManager.execute(cmd);

// Backend generates meshes
const generator = GeometryGeneratorFactory.create(route.type);
const geometry = generator.generate(route, scene);

// Meshes automatically appear in viewport (Babylon.js)
```

### Validation

```typescript
// Frontend calls
const validator = new ConstraintValidator();
const result = validator.validate(route);

// Display warnings in UI
if (!result.isValid) {
  result.violations.forEach(v => {
    showWarning(v.message, v.location, v.severity);
  });
}
```

---

## Event Handling: User Input Flow

### Mouse Click in Viewport

```
User clicks in 3D viewport
    ↓
Babylon.js PointerObservable fires
    ↓
RoutingWorkflowHandler.handlePlaceConnectionPoint()
    ↓
Check routing mode (placing_connector?)
    ↓
Create CreateConnectionPointCommand
    ↓
CommandManager.execute(command)
    ↓
ConnectionManager.addConnectionPoint()
    ↓
Zustand store updated
    ↓
React components re-render
    ↓
Connector sphere appears in viewport
```

**Code:**
```typescript
// RoutingWorkflowHandler.ts
scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;

  const routingMode = useRoutingStore.getState().routingMode;
  if (routingMode === 'placing_connector') {
    this.handlePlaceConnectionPoint(pointerInfo);
  }
});

private handlePlaceConnectionPoint(pointerInfo: BABYLON.PointerInfo): void {
  const position = pointerInfo.pickInfo?.pickedPoint;
  if (!position) return;

  const config = {
    type: useRoutingStore.getState().currentRouteType,
    position: babylonToUser(position),  // Y-up → Z-up conversion
    direction: { x: 0, y: 0, z: 1 },
    specifications: getDefaultSpecifications(type)
  };

  const commandManager = useEditorStore.getState().commandManager;
  const command = new CreateConnectionPointCommand(config);
  commandManager.execute(command);
}
```

### Button Click in UI Panel

```
User clicks "Create Route" button
    ↓
React onClick handler fires
    ↓
RoutingControlPanel.handleCreateRoute()
    ↓
Get selected connector IDs from Zustand
    ↓
Create CreateRouteCommand
    ↓
CommandManager.execute(command)
    ↓
Backend: RouteOptimizer.findPath()
    ↓
Backend: ConstraintValidator.validate()
    ↓
Backend: Route object created
    ↓
Zustand store updated
    ↓
React components re-render
    ↓
Route path appears in viewport
```

**Code:**
```tsx
// RoutingControlPanel.tsx
const handleCreateRoute = async () => {
  const [sourceId, destId] = selectedConnectorIds;

  const routeId = await RoutingWorkflowHandler.createRouteBetweenPoints(
    sourceId,
    destId
  );

  if (routeId) {
    // Auto-generate geometry
    const cmdManager = useEditorStore.getState().commandManager;
    const genCmd = new GenerateRouteGeometryCommand(routeId);
    cmdManager.execute(genCmd);
  }
};
```

---

## Performance Considerations

### Frontend Performance

**Rule:** Never setState in render loops
```typescript
// BAD: Causes infinite render loop
useEffect(() => {
  scene.onBeforeRenderObservable.add(() => {
    setFrameCount(c => c + 1);  // Re-render every frame!
  });
}, []);

// GOOD: Use refs for render loop state
const frameCountRef = useRef(0);
scene.onBeforeRenderObservable.add(() => {
  frameCountRef.current++;  // No re-render
});
```

**Rule:** Use Zustand selectors to minimize re-renders
```typescript
// BAD: Component re-renders on any store change
const store = useRoutingStore();

// GOOD: Only re-renders when activeRoutes changes
const activeRoutes = useRoutingStore(state => state.activeRoutes);
```

### Backend Performance

**Rule:** Batch operations when possible
```typescript
// BAD: Generate geometry one at a time
routes.forEach(route => generator.generate(route, scene));

// GOOD: Batch generate
const allGeometry = routes.map(route => generator.generate(route, scene));
// Merge meshes to reduce draw calls
const merged = BABYLON.Mesh.MergeMeshes(allGeometry.map(g => g.mesh));
```

**Rule:** Cache expensive computations
```typescript
// BAD: Rebuild graph every time
const graph = SearchGraph.buildGraph(obstacles);

// GOOD: Cache graph, rebuild only when obstacles change
if (this.graphCache === null || obstaclesChanged) {
  this.graphCache = SearchGraph.buildGraph(obstacles);
}
```

---

## Testing: Frontend + Backend Integration

### Unit Tests (Backend Only)

Test backend classes in isolation:
```typescript
// tests/routing/RouteOptimizer.test.ts
test('finds shortest path between two points', () => {
  const optimizer = new RouteOptimizer();
  const graph = createMockGraph();

  const path = optimizer.findPath(
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    graph,
    ShortestPathCost
  );

  expect(path).not.toBeNull();
  expect(path!.length).toBeGreaterThan(0);
});
```

### Integration Tests (Frontend + Backend)

Test full workflow:
```typescript
// tests/acceptance/TC-UI5.test.ts
test('quick action creates route when 2 connectors selected', async () => {
  // Setup: Render UI component
  render(<RoutingControlPanel />);

  // Create 2 connectors (backend)
  const connMgr = ConnectionManager.getInstance();
  const conn1 = connMgr.addConnectionPoint(config1);
  const conn2 = connMgr.addConnectionPoint(config2);

  // Select connectors (frontend)
  useRoutingStore.setState({ selectedConnectorIds: [conn1.id, conn2.id] });

  // Verify quick action button appears
  const btn = screen.getByText('Create Route');
  expect(btn).toBeInTheDocument();

  // Click button
  await userEvent.click(btn);

  // Verify route created (backend)
  const routes = useRoutingStore.getState().activeRoutes;
  expect(routes.length).toBe(1);

  // Verify geometry generated (backend)
  expect(routes[0].generated).toBe(true);
});
```

### End-to-End Tests (Full Stack)

Test with real Babylon.js scene:
```typescript
// tests/e2e/SmartRoutingWorkflow.test.ts
test('complete routing workflow', async () => {
  // 1. Initialize scene
  const engine = new BABYLON.Engine(canvas);
  const scene = new BABYLON.Scene(engine);

  // 2. Place connectors
  const cmd1 = new CreateConnectionPointCommand(config1);
  commandManager.execute(cmd1);

  const cmd2 = new CreateConnectionPointCommand(config2);
  commandManager.execute(cmd2);

  // 3. Create route
  const routeCmd = new CreateRouteCommand(conn1.id, conn2.id, 'pipe');
  commandManager.execute(routeCmd);

  // 4. Verify route exists
  const routes = useRoutingStore.getState().activeRoutes;
  expect(routes.length).toBe(1);

  // 5. Generate geometry
  const genCmd = new GenerateRouteGeometryCommand(routes[0].id);
  commandManager.execute(genCmd);

  // 6. Verify meshes in scene
  const pipeMeshes = scene.meshes.filter(m => m.name.startsWith('pipe'));
  expect(pipeMeshes.length).toBeGreaterThan(0);
});
```

---

## Debugging Tips

### Frontend Debugging

**Zustand DevTools:**
```typescript
// Enable Zustand DevTools
import { devtools } from 'zustand/middleware';

const useRoutingStore = create<RoutingStore>()(
  devtools(
    (set) => ({
      // ... store implementation
    }),
    { name: 'RoutingStore' }
  )
);
```

**React DevTools:**
- Install React DevTools browser extension
- Inspect component tree and props
- Profile component render performance

### Backend Debugging

**Console Logging:**
```typescript
// Add detailed logs
console.log('[RouteOptimizer] Finding path from', start, 'to', goal);
console.log('[RouteOptimizer] Graph has', graph.nodes.size, 'nodes');
console.log('[RouteOptimizer] Path found with', waypoints.length, 'waypoints');
```

**Babylon.js Inspector:**
```typescript
// Enable in-browser 3D inspector
scene.debugLayer.show();
```

**Performance Profiling:**
```typescript
// Measure operation time
console.time('Pathfinding');
const path = optimizer.findPath(start, goal, graph, costFunc);
console.timeEnd('Pathfinding');  // Logs: "Pathfinding: 45.2ms"
```

---

## Common Integration Issues

### Issue 1: UI Not Updating After Backend Change

**Symptom:** Backend creates route, but UI doesn't show it

**Cause:** Zustand store not updated

**Fix:**
```typescript
// After backend operation, update store
const route = new Route(/* ... */);
useRoutingStore.getState().addRoute(route);  // Triggers re-render
```

### Issue 2: Geometry Not Appearing in Viewport

**Symptom:** Route created, but no 3D mesh visible

**Cause:** Geometry not added to scene, or material issue

**Fix:**
```typescript
// Ensure mesh added to scene
const mesh = BABYLON.MeshBuilder.CreateTube('pipe', { path }, scene);  // scene parameter!

// Check material
if (!mesh.material) {
  mesh.material = new BABYLON.StandardMaterial('default', scene);
}

// Check mesh is visible
mesh.isVisible = true;
mesh.setEnabled(true);
```

### Issue 3: Selection Not Working

**Symptom:** Clicking mesh doesn't select it

**Cause:** Mesh metadata missing, or picking disabled

**Fix:**
```typescript
// Add metadata for selection
mesh.metadata = {
  type: 'route',
  routeId: route.id,
  selectable: true
};

// Enable picking
mesh.isPickable = true;
```

---

## Summary: Key Takeaways

1. **No Separate Server:** Everything runs client-side in TypeScript
2. **Command Pattern:** All UI actions go through Commands for undo/redo
3. **Zustand Sync:** Frontend state derived from backend state
4. **Babylon.js Integration:** Backend creates meshes, Babylon.js renders them
5. **Performance:** Use refs in render loops, batch operations, cache graphs
6. **Testing:** Unit tests for backend, integration tests for frontend+backend
7. **Debugging:** Zustand DevTools, React DevTools, Babylon Inspector

---

**Last Updated:** 2025-01-03
**Version:** 1.0
**Maintained By:** PM (George)
