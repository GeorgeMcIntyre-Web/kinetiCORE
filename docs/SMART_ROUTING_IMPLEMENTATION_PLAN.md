# Smart Routing System - Implementation Plan
**Feature:** Intelligent Piping, Wiring & Cable Tray Routing
**Branch:** `feature/smart-routing-system`
**Status:** 📐 Planning Phase
**Date:** 2025-01-XX

---

## 📋 Overview

This document outlines the detailed implementation plan for the Smart Routing System, breaking down the work into manageable phases with specific tasks, file structure, and technical decisions.

---

## 🏗️ Architecture Overview

### Core Components

```
src/routing/
├── core/
│   ├── types.ts                    # Route, ConnectionPoint, RouteSegment types
│   ├── ConnectionPoint.ts          # Connection point class
│   ├── ConnectionManager.ts        # Manages connection network
│   └── Route.ts                    # Route class (contains segments)
├── pathfinding/
│   ├── RouteOptimizer.ts           # A* pathfinding with constraints
│   ├── ConstraintValidator.ts      # Validates routes against constraints
│   ├── SearchGraph.ts              # Navigation graph for pathfinding
│   └── CostFunction.ts             # Path cost calculation
├── geometry/
│   ├── RouteGeometryGenerator.ts   # Generates 3D meshes from routes
│   ├── PipeGenerator.ts           # Pipe-specific geometry
│   ├── CableGenerator.ts           # Cable bundle geometry
│   ├── CableTrayGenerator.ts       # Cable tray geometry
│   └── ConduitGenerator.ts         # Conduit geometry
├── ui/
│   ├── RoutingToolbar.tsx          # Routing tools in toolbar
│   ├── ConnectionPointIndicator.tsx # Visual indicators for connections
│   ├── RoutePreview.tsx            # Preview path while routing
│   ├── RouteInspector.tsx          # Inspector panel for routes
│   └── ConnectionManagerPanel.tsx  # Network view
└── commands/
    ├── CreateRouteCommand.ts       # Undo/redo for route creation
    ├── EditRouteCommand.ts         # Undo/redo for route editing
    └── DeleteRouteCommand.ts       # Undo/redo for route deletion
```

---

## 🎯 Phase 1: Foundation & Core Types (Week 1)

**Goal:** Set up data structures and basic connection system

### Tasks

#### 1.1 Core Types Definition
**File:** `src/routing/core/types.ts`

**Define interfaces:**
```typescript
// Connection Point
interface ConnectionPoint {
  id: string;
  type: 'pipe' | 'electrical' | 'cable_tray' | 'conduit';
  position: Vector3;
  direction: Vector3;
  specifications: ConnectionSpecifications;
  parentObject?: string;
}

// Route Segment
interface RouteSegment {
  id: string;
  startPoint: Vector3;
  endPoint: Vector3;
  segmentType: 'straight' | 'bend' | 'fitting';
  bendRadius?: number;
  length: number;
}

// Route (Complete Path)
interface Route {
  id: string;
  type: RouteType;
  source: ConnectionPoint;
  destination: ConnectionPoint;
  segments: RouteSegment[];
  supports: SupportPoint[];
  material: MaterialSpec;
  constraints: RouteConstraints;
  generated: boolean;
}
```

**Acceptance Criteria:**
- ✅ All types defined with proper TypeScript interfaces
- ✅ Types exported from module
- ✅ Types documented with JSDoc comments

**Estimate:** 2-3 hours

---

#### 1.2 ConnectionPoint Class
**File:** `src/routing/core/ConnectionPoint.ts`

**Responsibilities:**
- Store connection point data
- Validate connection compatibility
- Provide position/direction helpers

**Methods:**
```typescript
class ConnectionPoint {
  constructor(config: ConnectionPointConfig)
  getId(): string
  getPosition(): Vector3
  getDirection(): Vector3
  getType(): RouteType
  canConnectTo(other: ConnectionPoint): boolean
  isCompatible(other: ConnectionPoint): boolean
}
```

**Acceptance Criteria:**
- ✅ ConnectionPoint class implemented
- ✅ Type checking for compatibility
- ✅ Unit tests written (basic cases)

**Estimate:** 3-4 hours

---

#### 1.3 ConnectionManager Class
**File:** `src/routing/core/ConnectionManager.ts`

**Responsibilities:**
- Track all connection points in scene
- Manage connection graph (what connects to what)
- Find connections by proximity/type
- Auto-detect connections on devices

**Methods:**
```typescript
class ConnectionManager {
  addConnectionPoint(point: ConnectionPoint): void
  removeConnectionPoint(id: string): void
  getConnectionPoint(id: string): ConnectionPoint | null
  findNearbyConnections(position: Vector3, radius: number): ConnectionPoint[]
  findCompatibleConnections(point: ConnectionPoint): ConnectionPoint[]
  createConnection(from: string, to: string): Connection
  getConnectionGraph(): ConnectionGraph
}
```

**Acceptance Criteria:**
- ✅ ConnectionManager implemented
- ✅ Graph structure maintains connections
- ✅ Proximity search works
- ✅ Type compatibility checking works

**Estimate:** 4-5 hours

---

#### 1.4 Integration with Entity System
**Files:** 
- `src/routing/core/ConnectionPoint.ts`
- `src/entities/SceneEntity.ts` (modify)

**Tasks:**
- Add connection point detection to SceneEntity
- When entity selected, show available connection points
- Connection points appear as visual indicators

**Acceptance Criteria:**
- ✅ Entities can have connection points attached
- ✅ Connection points visible in scene
- ✅ Inspector shows connection points for selected entity

**Estimate:** 3-4 hours

---

**Phase 1 Total Estimate:** 12-16 hours (1.5-2 days)

---

## 🗺️ Phase 2: Pathfinding System (Week 2)

**Goal:** Implement A* pathfinding with constraint validation

### Tasks

#### 2.1 Search Graph Builder
**File:** `src/routing/pathfinding/SearchGraph.ts`

**Responsibilities:**
- Build navigation graph from scene obstacles
- Create waypoint network respecting constraints
- Support grid-based and navmesh approaches

**Methods:**
```typescript
class SearchGraph {
  buildGraph(start: Vector3, goal: Vector3, obstacles: Mesh[]): Graph
  getNeighbors(node: GraphNode): GraphNode[]
  getDistance(node1: GraphNode, node2: GraphNode): number
  validateEdge(from: GraphNode, to: GraphNode, constraints: RouteConstraints): boolean
}
```

**Acceptance Criteria:**
- ✅ Graph builds from scene geometry
- Obstacles correctly represented
- Graph respects clearance constraints

**Estimate:** 6-8 hours

---

#### 2.2 Route Optimizer (A* Algorithm)
**File:** `src/routing/pathfinding/RouteOptimizer.ts`

**Responsibilities:**
- Implement A* pathfinding algorithm
- Apply cost function (distance, bends, clearance)
- Return optimal path as RouteSegment array

**Methods:**
```typescript
class RouteOptimizer {
  findOptimalPath(
    source: ConnectionPoint,
    destination: ConnectionPoint,
    constraints: RouteConstraints,
    obstacles: Mesh[]
  ): Route | null
  
  private aStarSearch(graph: SearchGraph, start: Vector3, goal: Vector3): Vector3[]
  private calculateCost(path: Vector3[], constraints: RouteConstraints): number
}
```

**Acceptance Criteria:**
- ✅ A* finds path between two points
- ✅ Path respects obstacles
- ✅ Path minimizes cost (length + bends)
- ✅ Performance: <100ms for typical routes

**Estimate:** 8-10 hours

---

#### 2.3 Constraint Validator
**File:** `src/routing/pathfinding/ConstraintValidator.ts`

**Responsibilities:**
- Validate route against all constraints
- Check bend radius, clearance, support spacing
- Return detailed violation report

**Methods:**
```typescript
class ConstraintValidator {
  validateRoute(route: Route, obstacles: Mesh[]): ValidationResult
  checkBendRadius(segments: RouteSegment[], minRadius: number): Violation[]
  checkClearance(route: Route, obstacles: Mesh[], required: number): Violation[]
  checkSupportSpacing(route: Route, maxSpacing: number): Violation[]
}
```

**Acceptance Criteria:**
- ✅ All constraints validated
- ✅ Violations clearly identified
- ✅ Validation results usable for UI feedback

**Estimate:** 4-6 hours

---

#### 2.4 Cost Function
**File:** `src/routing/pathfinding/CostFunction.ts`

**Responsibilities:**
- Calculate path cost for optimization
- Weighted factors: distance, bends, clearance, supports
- Configurable optimization modes

**Methods:**
```typescript
class CostFunction {
  calculate(path: Vector3[], constraints: RouteConstraints, mode: OptimizationMode): number
  setWeights(distance: number, bends: number, clearance: number): void
}
```

**Acceptance Criteria:**
- ✅ Cost function produces reasonable costs
- ✅ Optimization modes work (shortest, safest, aesthetic)
- ✅ Weights configurable

**Estimate:** 3-4 hours

---

**Phase 2 Total Estimate:** 21-28 hours (3-4 days)

---

## 🎨 Phase 3: Visual Preview System (Week 3)

**Goal:** Visual feedback during routing workflow

### Tasks

#### 3.1 Connection Point Indicators
**File:** `src/routing/ui/ConnectionPointIndicator.tsx`

**Responsibilities:**
- Render visual indicators at connection points
- Color-coded by type and state
- Hover/select feedback
- Show connection type icons

**Components:**
```typescript
<ConnectionPointIndicator
  point={ConnectionPoint}
  state={'available' | 'selected' | 'connected'}
  onClick={handler}
  onHover={handler}
/>
```

**Acceptance Criteria:**
- ✅ Indicators visible at connection points
- ✅ Colors indicate state (green=available, yellow=selected, blue=connected)
- ✅ Icons show connection type
- ✅ Click detection works

**Estimate:** 4-5 hours

---

#### 3.2 Route Preview Component
**File:** `src/routing/ui/RoutePreview.tsx`

**Responsibilities:**
- Show preview path while routing
- Color-code by validation state
- Show constraint violations
- Update in real-time as user adjusts

**Components:**
```typescript
<RoutePreview
  route={Route | null}
  validation={ValidationResult}
  obstacles={Mesh[]}
  visible={boolean}
/>
```

**Acceptance Criteria:**
- ✅ Preview shows path as line/geometry
- ✅ Colors: green=valid, yellow=warning, red=invalid
- ✅ Violations highlighted
- ✅ Performance: smooth at 60fps

**Estimate:** 6-8 hours

---

#### 3.3 Routing Mode State Management
**File:** `src/ui/store/routingStore.ts`

**Responsibilities:**
- Manage routing workflow state
- Track selected connection points
- Store preview routes
- Integration with editorStore

**State:**
```typescript
interface RoutingState {
  routingMode: 'off' | 'placing_connector' | 'selecting_source' | 'selecting_dest' | 'editing';
  selectedSource: ConnectionPoint | null;
  selectedDest: ConnectionPoint | null;
  previewRoute: Route | null;
  connectionPoints: ConnectionPoint[];
}
```

**Acceptance Criteria:**
- ✅ State manages routing workflow
- ✅ Integrates with editorStore
- ✅ Undo/redo support ready

**Estimate:** 3-4 hours

---

**Phase 3 Total Estimate:** 13-17 hours (2 days)

---

## 🛠️ Phase 4: Geometry Generation (Week 4)

**Goal:** Generate 3D meshes from route paths

### Tasks

#### 4.1 Base Route Geometry Generator
**File:** `src/routing/geometry/RouteGeometryGenerator.ts`

**Responsibilities:**
- Base class for all geometry generators
- Common utilities (curve creation, segment conversion)
- Material management

**Methods:**
```typescript
abstract class RouteGeometryGenerator {
  abstract generate(route: Route): Mesh
  
  protected createCurveFromSegments(segments: RouteSegment[]): Curve3
  protected createMaterial(type: RouteType): Material
  protected combineMeshes(meshes: Mesh[]): Mesh
}
```

**Acceptance Criteria:**
- ✅ Base class structure
- ✅ Common utilities work
- ✅ Material system integrated

**Estimate:** 3-4 hours

---

#### 4.2 Pipe Generator
**File:** `src/routing/geometry/PipeGenerator.ts`

**Responsibilities:**
- Generate pipe geometry (cylinders)
- Add fittings (elbows, tees, reducers)
- Generate supports/hangers
- Apply materials (steel, PVC, etc.)

**Methods:**
```typescript
class PipeGenerator extends RouteGeometryGenerator {
  generate(route: Route): Mesh {
    // Create tube along path
    // Add elbows at bends
    // Add supports at support points
    // Apply material
  }
  
  private createTube(curve: Curve3, diameter: number): Mesh
  private createElbow(angle: number, radius: number, diameter: number): Mesh
  private createSupport(position: Vector3, type: SupportType): Mesh
}
```

**Acceptance Criteria:**
- ✅ Pipes render as cylinders along path
- ✅ Elbows at bends
- ✅ Supports generated at correct positions
- ✅ Materials applied correctly

**Estimate:** 6-8 hours

---

#### 4.3 Cable Generator
**File:** `src/routing/geometry/CableGenerator.ts`

**Responsibilities:**
- Generate wire bundle geometry
- Multiple wires bundled together
- Color coding by voltage/type
- Cable tray integration

**Estimate:** 4-5 hours

---

#### 4.4 Cable Tray Generator
**File:** `src/routing/geometry/CableTrayGenerator.ts`

**Responsibilities:**
- Generate cable tray channel geometry
- Supports at spacing intervals
- Fittings (elbows, tees, crosses)
- Multi-level trays

**Estimate:** 6-8 hours

---

#### 4.5 Conduit Generator
**File:** `src/routing/geometry/ConduitGenerator.ts`

**Responsibilities:**
- Similar to pipes but with electrical constraints
- Junction boxes at connections
- Bending rules (EMT, rigid)

**Estimate:** 4-5 hours

---

**Phase 4 Total Estimate:** 23-30 hours (3-4 days)

---

## 🎮 Phase 5: User Interface (Week 5)

**Goal:** Complete UI for routing workflow

### Tasks

#### 5.1 Routing Toolbar Buttons
**File:** `src/routing/ui/RoutingToolbar.tsx`

**Integration:** Add to `src/ui/components/RibbonToolbar.tsx`

**Buttons:**
- "Add Connector" - Place connection point
- "Route Between Points" - Start routing mode
- "Auto-Route All" - Connect all unconnected points
- "Edit Route" - Edit selected route
- Type selector: Pipe / Electrical / Cable Tray / Conduit

**Acceptance Criteria:**
- ✅ Buttons in toolbar
- ✅ Icons appropriate (lucide-react)
- ✅ Click handlers work
- ✅ Type selector functional

**Estimate:** 4-5 hours

---

#### 5.2 Route Inspector Panel
**File:** `src/routing/ui/RouteInspector.tsx`

**Responsibilities:**
- Show route properties when selected
- Edit route segments
- Show constraints and violations
- Generate geometry button

**Acceptance Criteria:**
- ✅ Panel shows in Inspector when route selected
- ✅ Properties editable
- ✅ Constraint violations visible
- ✅ Generate button works

**Estimate:** 5-6 hours

---

#### 5.3 Connection Manager Panel
**File:** `src/routing/ui/ConnectionManagerPanel.tsx`

**Responsibilities:**
- Show connection network graph
- List all connections
- Auto-route all button
- Connection status indicators

**Acceptance Criteria:**
- ✅ Panel shows connection network
- ✅ Tree/hierarchy view of connections
- ✅ Auto-route works

**Estimate:** 4-5 hours

---

#### 5.4 Route Editing UI
**File:** `src/routing/ui/RouteEditor.tsx`

**Responsibilities:**
- Visual editing of route paths
- Drag control points
- Add/remove segments
- Real-time validation feedback

**Acceptance Criteria:**
- ✅ Control points visible and draggable
- ✅ Real-time path update
- ✅ Validation feedback during editing

**Estimate:** 6-8 hours

---

**Phase 5 Total Estimate:** 19-24 hours (2.5-3 days)

---

## 🔄 Phase 6: Command System Integration (Week 6)

**Goal:** Undo/redo support for all routing operations

### Tasks

#### 6.1 CreateRouteCommand
**File:** `src/routing/commands/CreateRouteCommand.ts`

**Responsibilities:**
- Undo route creation
- Store route state for undo

**Estimate:** 2-3 hours

---

#### 6.2 EditRouteCommand
**File:** `src/routing/commands/EditRouteCommand.ts`

**Responsibilities:**
- Undo route edits
- Store before/after route state

**Estimate:** 3-4 hours

---

#### 6.3 DeleteRouteCommand
**File:** `src/routing/commands/DeleteRouteCommand.ts`

**Responsibilities:**
- Undo route deletion
- Restore route on undo

**Estimate:** 2-3 hours

---

#### 6.4 CreateConnectionPointCommand
**File:** `src/routing/commands/CreateConnectionPointCommand.ts`

**Estimate:** 2-3 hours

---

**Phase 6 Total Estimate:** 9-13 hours (1-2 days)

---

## 🧪 Phase 7: Testing & Polish (Week 7)

**Goal:** Comprehensive testing and user experience polish

### Tasks

#### 7.1 Unit Tests
**Files:** `src/routing/**/__tests__/`

**Coverage:**
- ConnectionPoint class
- ConnectionManager
- RouteOptimizer (pathfinding)
- ConstraintValidator
- Geometry generators

**Target:** 80%+ coverage

**Estimate:** 8-10 hours

---

#### 7.2 Integration Tests
**Files:** `tests/integration/routing.test.ts`

**Test scenarios:**
- Complete routing workflow
- Multiple route types
- Constraint validation
- Undo/redo operations

**Estimate:** 4-5 hours

---

#### 7.3 Performance Optimization
**Tasks:**
- Optimize pathfinding performance
- LOD for large route networks
- Efficient geometry generation

**Estimate:** 4-6 hours

---

#### 7.4 Documentation
**Files:**
- User guide for routing system
- API documentation
- Example scenes

**Estimate:** 3-4 hours

---

**Phase 7 Total Estimate:** 19-25 hours (2.5-3 days)

---

## 📊 Total Estimate

**All Phases Combined:**
- Phase 1: 12-16 hours (1.5-2 days)
- Phase 2: 21-28 hours (3-4 days)
- Phase 3: 13-17 hours (2 days)
- Phase 4: 23-30 hours (3-4 days)
- Phase 5: 19-24 hours (2.5-3 days)
- Phase 6: 9-13 hours (1-2 days)
- Phase 7: 19-25 hours (2.5-3 days)

**Total:** 116-153 hours (15-20 days / 3-4 weeks)

---

## 🎯 MVP Scope (Reduced)

**For faster initial release, MVP could include:**

**Phase 1 MVP:**
- ✅ Basic types
- ✅ ConnectionPoint class
- ✅ ConnectionManager (basic)

**Phase 2 MVP:**
- ✅ Simple A* pathfinding (basic obstacles only)
- ✅ Basic constraint validation (bend radius only)

**Phase 3 MVP:**
- ✅ Connection point indicators
- ✅ Simple route preview (line only)

**Phase 4 MVP:**
- ✅ Pipe generator only
- ✅ Basic geometry (no fittings)

**Phase 5 MVP:**
- ✅ Basic toolbar buttons
- ✅ Simple inspector panel

**Phase 6-7 MVP:**
- ✅ Basic commands
- ✅ Minimal testing

**MVP Estimate:** 60-80 hours (8-10 days / 1.5-2 weeks)

---

## 🚀 Getting Started

### Immediate Next Steps

1. **Review this plan** - Make sure scope aligns with goals
2. **Set up project structure** - Create directories in `src/routing/`
3. **Start Phase 1** - Begin with types and ConnectionPoint class
4. **Daily progress tracking** - Update TODO list

### First Task: Create File Structure

```bash
mkdir -p src/routing/{core,pathfinding,geometry,ui,commands}
mkdir -p src/routing/core/__tests__
mkdir -p src/routing/pathfinding/__tests__
```

---

## 📝 Notes & Decisions

### Technical Decisions Needed

1. **Pathfinding Algorithm:**
   - Decision: A* for Phase 1, consider navmesh later
   - Rationale: A* is simpler, navmesh requires more setup

2. **Graph Building:**
   - Decision: Grid-based for MVP, navmesh for future
   - Rationale: Grid is simpler to implement

3. **Geometry Library:**
   - Decision: Use Babylon.js MeshBuilder for basic shapes
   - Consider: Custom geometry generation for complex fittings

4. **State Management:**
   - Decision: New Zustand store (`routingStore.ts`)
   - Rationale: Keeps routing state separate from editor state

### Open Questions

- Should routes be scene entities? **Yes** - enables full integration
- How to handle multi-branch routes? **Future enhancement**
- Support for custom routing zones? **Phase 2+**

---

**Last Updated:** 2025-01-XX
**Next Review:** After Phase 1 completion

