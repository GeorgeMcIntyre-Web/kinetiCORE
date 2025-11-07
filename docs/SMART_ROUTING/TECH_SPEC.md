# Smart Routing - Technical Specification

**Version:** 2.0
**Last Updated:** 2025-01-03
**Owner:** Agent 3 (Spec Lead), All Agents (Contributors)
**Purpose:** Single source of truth for Smart Routing System architecture, data contracts, and integration points

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Data Contracts](#data-contracts)
4. [Module Specifications](#module-specifications)
5. [Integration Points](#integration-points)
6. [Specifications Tables](#specifications-tables)
7. [Algorithms & Formulas](#algorithms--formulas)
8. [API Reference](#api-reference)
9. [Error Handling](#error-handling)
10. [Performance Requirements](#performance-requirements)

---

## System Overview

### Purpose
The Smart Routing System enables automatic pathfinding and geometry generation for industrial infrastructure: pipes, electrical wiring, cable trays, and conduits.

### Core Capabilities
1. **Auto-Pathfinding:** A* algorithm finds optimal paths between connection points
2. **Constraint Validation:** Real-time validation of bend radius, clearance, support spacing
3. **Geometry Generation:** Spec-driven 3D mesh creation with fittings and supports
4. **Persistence:** Save/load routes, connectors, and geometry
5. **BOM Export:** Bill of materials with lengths, fittings, materials, costs

### Coordinate System
- **Z-up throughout** (CAD/ROS standard, per `COORDINATE_SYSTEM.md`)
- All positions, directions, and transforms use Z-up
- No Y-up ↔ Z-up conversion needed within routing system

### Units
- **Internal:** Meters (SI)
- **Display/UI:** Feet, inches, millimeters (user-selectable)
- **Conversion:** Use `CoordinateSystem.ts` utilities

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Smart Routing System                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  UI Layer (Agent 8)                                          │   │
│  │  - RoutingControlPanel.tsx                                   │   │
│  │  - RoutingWorkflowHandler.ts                                 │   │
│  │  - SceneTree.tsx (selection, visibility)                     │   │
│  └───────────────────┬──────────────────────────────────────────┘   │
│                      │ User Actions (place, create, edit)           │
│                      ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Command Layer (Shared)                                      │   │
│  │  - CreateConnectionPointCommand                              │   │
│  │  - CreateRouteCommand                                        │   │
│  │  - GenerateRouteGeometryCommand                              │   │
│  │  - EditRouteCommand                                          │   │
│  └───────────────────┬──────────────────────────────────────────┘   │
│                      │ Execute Commands                              │
│                      ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Connection Manager (Agent 7)                                │   │
│  │  - Manages ConnectionPoint lifecycle                         │   │
│  │  - Prevents duplicates                                       │   │
│  │  - Tracks connection graph                                   │   │
│  └───────────┬───────────────────┬──────────────────────────────┘   │
│              │                   │                                   │
│              │                   │                                   │
│  ┌───────────▼───────────┐   ┌──▼──────────────────────────────┐   │
│  │  Pathfinding           │   │  Constraint Validator           │   │
│  │  (Agent 1)             │   │  (Agent 2)                      │   │
│  │  - SearchGraph         │   │  - ConstraintValidator.ts       │   │
│  │  - RouteOptimizer      │   │  - ValidationResult types       │   │
│  │  - A* algorithm        │   │  - Severity mapping             │   │
│  │  - Cost functions      │   │  - Violation detection          │   │
│  └────────────┬───────────┘   └──┬──────────────────────────────┘   │
│               │                   │                                  │
│               │ Waypoint Path     │ ValidationResult                 │
│               │                   │                                  │
│  ┌────────────▼───────────────────▼──────────────────────────────┐  │
│  │  Route (Core Model)                                           │  │
│  │  - Stores path, segments, supports                            │  │
│  │  - Links source ↔ destination ConnectionPoints                │  │
│  └────────────┬──────────────────────────────────────────────────┘  │
│               │ Route data                                           │
│               ▼                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Geometry Generators (Agents 4, 5, 6)                        │  │
│  │  ┌──────────────┬───────────────┬──────────────────────────┐ │  │
│  │  │ PipeGenerator│CableTrayGen   │CableGen / ConduitGen     │ │  │
│  │  │ (Agent 4)    │(Agent 5)      │(Agent 6)                 │ │  │
│  │  └──────┬───────┴───────┬───────┴───────┬──────────────────┘ │  │
│  │         │               │               │                     │  │
│  │         │ Read specs    │ Read specs    │ Read specs          │  │
│  │         ▼               ▼               ▼                     │  │
│  │  ┌──────────────────────────────────────────────────────────┐│  │
│  │  │  Specifications (Agent 3)                                ││  │
│  │  │  - PIPE_SIZES, CABLE_TRAY_SPECS, WIRING_SPECS, etc.     ││  │
│  │  │  - Material mappings                                     ││  │
│  │  │  - Bend radius / support spacing rules                   ││  │
│  │  └──────────────────────────────────────────────────────────┘│  │
│  └────────────┬──────────────────────────────────────────────────┘  │
│               │ Babylon.Mesh + BOM data                              │
│               ▼                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Babylon.js Scene Integration                                │  │
│  │  - Meshes rendered in viewport                               │  │
│  │  - Materials applied (colors, textures)                      │  │
│  │  - Selection/highlighting                                    │  │
│  └────────────┬──────────────────────────────────────────────────┘  │
│               │ Scene state                                          │
│               ▼                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Persistence & Export (Agent 9)                              │  │
│  │  - WorldSerializer (save/load)                               │  │
│  │  - BOMExporter (CSV)                                         │  │
│  │  - GLBExporter (3D models)                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Contracts

### Core Types (src/routing/core/types.ts)

All agents MUST use these shared types. Do not create duplicate type definitions.

#### RouteType
```typescript
export type RouteType = 'pipe' | 'electrical' | 'cable_tray' | 'conduit';
```

#### ConnectionPoint
```typescript
export interface ConnectionPoint {
  id: string;                         // UUID, globally unique
  type: RouteType;                    // Infrastructure type
  position: Vector3;                  // Z-up world position (meters)
  direction: Vector3;                 // Z-up normalized direction vector
  specifications: ConnectionSpecifications;
  parentObject?: string;              // Optional parent entity ID
}

export interface ConnectionSpecifications {
  size?: string;                      // e.g., "3/4\"", "12mm"
  voltage?: number;                   // Electrical voltage (V)
  material?: string;                  // e.g., "steel", "PVC"
  [key: string]: unknown;             // Extensible for custom properties
}
```

#### Route
```typescript
export interface Route {
  id: string;                         // UUID, globally unique
  type: RouteType;
  source: ConnectionPoint;
  destination: ConnectionPoint;
  segments: RouteSegment[];           // Path waypoints
  supports: SupportPoint[];           // Hangers, brackets, clamps
  material: MaterialSpec;
  constraints: RouteConstraints;
  generated: boolean;                 // true if 3D geometry exists
}
```

#### RouteSegment
```typescript
export interface RouteSegment {
  id: string;
  startPoint: Vector3;                // Z-up (meters)
  endPoint: Vector3;                  // Z-up (meters)
  segmentType: 'straight' | 'bend' | 'fitting';
  bendRadius?: number;                // Meters (for bends)
  length: number;                     // Meters
}
```

#### ValidationResult
```typescript
export interface ValidationResult {
  isValid: boolean;
  violations: ConstraintViolation[];
}

export interface ConstraintViolation {
  id: string;                         // Unique violation ID
  type: ViolationType;
  severity: ViolationSeverity;
  location: Vector3;                  // Z-up (meters)
  message: string;                    // Human-readable description
  actualValue?: number;               // Measured value (e.g., 1.5" clearance)
  requiredValue?: number;             // Required value (e.g., 2.0" clearance)
  segmentRef?: { from: Vector3; to: Vector3 }; // Affected segment
  obstacleId?: string;                // If clearance violation, obstacle ID
}

export type ViolationType = 'bend_radius' | 'clearance' | 'support_spacing' | 'length';
export type ViolationSeverity = 'error' | 'warning' | 'info';
```

#### RouteConstraints
```typescript
export interface RouteConstraints {
  minBendRadius: number;              // Meters
  maxRunLength?: number;              // Meters (optional)
  supportSpacing: number;             // Meters
  clearance: ClearanceRequirements;
}

export interface ClearanceRequirements {
  walls: number;                      // Meters
  ceiling: number;                    // Meters
  floor: number;                      // Meters
  otherInfrastructure: number;        // Meters
}
```

---

## Module Specifications

### Agent 1 - Pathfinding & Optimization

**Ownership:** `src/routing/pathfinding/`

#### SearchGraph.ts
```typescript
/**
 * Build navigation graph from scene obstacles
 */
export class SearchGraph {
  /**
   * Generate search graph nodes and edges
   * @param obstacles - AABB or mesh obstacles from scene
   * @param nodeDensity - Nodes per cubic meter (tunable, default 5)
   * @param layerSnapping - Snap to floor/ceiling if true
   * @param obstacleInflation - Inflate obstacles by this distance (meters)
   */
  buildGraph(
    obstacles: BABYLON.AbstractMesh[],
    nodeDensity: number,
    layerSnapping: boolean,
    obstacleInflation: number
  ): Graph;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  position: Vector3;  // Z-up (meters)
}

export interface GraphEdge {
  from: string;       // Node ID
  to: string;         // Node ID
  weight: number;     // Cost
  valid: boolean;     // Satisfies constraints
}
```

#### RouteOptimizer.ts
```typescript
/**
 * A* pathfinding with pluggable cost functions
 */
export class RouteOptimizer {
  /**
   * Find optimal path between two points
   * @param start - Start position (Z-up, meters)
   * @param goal - Goal position (Z-up, meters)
   * @param graph - Navigation graph from SearchGraph
   * @param costFunction - Cost function to optimize ('shortest' | 'safest' | 'aesthetic')
   * @param cancellationToken - Optional cancellation token for async
   * @returns Waypoint path or null if no path found
   */
  findPath(
    start: Vector3,
    goal: Vector3,
    graph: Graph,
    costFunction: CostFunction,
    cancellationToken?: CancellationToken
  ): Vector3[] | null;

  /**
   * Direct path check (no obstacles)
   * Fast path optimization: If direct line clear, return [start, goal]
   */
  hasDirectPath(start: Vector3, goal: Vector3, obstacles: BABYLON.AbstractMesh[]): boolean;
}
```

#### CostFunction.ts
```typescript
/**
 * Pluggable cost functions for A*
 */
export interface CostFunction {
  calculateCost(from: Vector3, to: Vector3, context: CostContext): number;
}

export interface CostContext {
  obstacles: BABYLON.AbstractMesh[];
  clearanceRequirement: number;       // Meters
  bendPenalty: number;                // Cost multiplier for bends
}

/**
 * Built-in cost functions
 */
export const ShortestPathCost: CostFunction;  // Minimize distance
export const SafestPathCost: CostFunction;    // Maximize clearance
export const AestheticPathCost: CostFunction; // Follow structure (walls, ceiling)
```

**Performance Targets:**
- Simple scene (10 obstacles): <100ms
- Complex scene (300 obstacles): <500ms
- Direct path check: <5ms

---

### Agent 2 - Constraint Validation

**Ownership:** `src/routing/validation/`

#### ConstraintValidator.ts
```typescript
/**
 * Validates routes against physical constraints
 */
export class ConstraintValidator {
  /**
   * Validate a single route
   * @returns ValidationResult with violations
   */
  validate(route: Route): ValidationResult;

  /**
   * Batch validate multiple routes
   * @returns Map of route ID → ValidationResult
   */
  validateBatch(routes: Route[]): Map<string, ValidationResult>;

  /**
   * Check bend radius constraint
   */
  private checkBendRadius(segment: RouteSegment, minBendRadius: number): ConstraintViolation | null;

  /**
   * Check clearance from obstacles
   */
  private checkClearance(
    segment: RouteSegment,
    obstacles: BABYLON.AbstractMesh[],
    clearanceReq: ClearanceRequirements
  ): ConstraintViolation[];

  /**
   * Check support spacing
   */
  private checkSupportSpacing(
    route: Route,
    maxSpacing: number
  ): ConstraintViolation[];
}
```

**Example Violation:**
```typescript
{
  id: "v-001",
  type: "bend_radius",
  severity: "error",
  location: { x: 5, y: 0, z: 2 },
  message: "Bend radius too tight: 0.05m actual, 0.10m minimum required",
  actualValue: 0.05,
  requiredValue: 0.10,
  segmentRef: { from: [5,0,2], to: [5,1,2] }
}
```

---

### Agent 3 - Specifications & Data Contracts

**Ownership:** `src/routing/specifications/`

#### Specification Tables

**PIPE_SIZES** (from `RouteSpecifications.ts`):
```typescript
export const PIPE_SIZES: Record<string, { od: number; id: number }> = {
  '1/4"': { od: 0.0135, id: 0.009 },  // meters
  '3/8"': { od: 0.017, id: 0.012 },
  '1/2"': { od: 0.021, id: 0.016 },
  '3/4"': { od: 0.027, id: 0.021 },
  '1"': { od: 0.033, id: 0.027 },
  '1-1/4"': { od: 0.042, id: 0.036 },
  '1-1/2"': { od: 0.048, id: 0.041 },
  '2"': { od: 0.060, id: 0.053 },
  '2-1/2"': { od: 0.073, id: 0.063 },
  '3"': { od: 0.089, id: 0.078 },
  '4"': { od: 0.114, id: 0.102 },
};
```

**CABLE_TRAY_SPECS**:
```typescript
export interface CableTraySpec {
  width: number;      // meters (0.1, 0.15, 0.2, 0.3, 0.4, 0.6)
  height: number;     // meters (0.05, 0.075, 0.1)
  trayType: 'ladder' | 'solid-bottom' | 'ventilated' | 'wire-mesh';
  material: 'galvanized-steel' | 'aluminum' | 'stainless' | 'fiberglass';
  loadRating: number; // kg/m
  color: 'orange' | 'silver' | 'yellow' | 'white';
}
```

**WIRING_SPECS**:
```typescript
export interface ElectricalSpec {
  coreCount: number;
  wireGauge: string;      // "14 AWG", "2.5mm²"
  wireDiameter: number;   // meters
  bundleType: 'single' | 'twisted-pair' | 'multi-core' | 'ribbon';
  insulationType: 'PVC' | 'XLPE' | 'rubber' | 'Teflon';
  outerDiameter: number;  // meters
  voltage: number;        // V
  current: number;        // A
  color: 'yellow' | 'copper' | 'silver' | 'black';
}

export const AWG_TO_METRIC: Record<string, { mm2: number; diameter: number }> = {
  '18 AWG': { mm2: 0.75, diameter: 0.001 },
  '16 AWG': { mm2: 1.5, diameter: 0.0015 },
  '14 AWG': { mm2: 2.5, diameter: 0.0025 },
  '12 AWG': { mm2: 4.0, diameter: 0.004 },
  '10 AWG': { mm2: 6.0, diameter: 0.006 },
};
```

**CONDUIT_SIZES**:
```typescript
export interface ConduitSpec {
  nominalSize: string;    // "3/4\"", "20mm"
  outerDiameter: number;  // meters
  innerDiameter: number;  // meters
  conduitType: 'EMT' | 'IMC' | 'rigid' | 'PVC' | 'flexible';
  material: 'steel' | 'aluminum' | 'PVC';
  bendRadius: number;     // meters (typically 6x diameter)
  color: 'green' | 'gray' | 'orange' | 'black';
}
```

#### Constraint Rules API

```typescript
/**
 * Get constraint rules for a given route type and size
 */
export function getConstraintRules(
  routeType: RouteType,
  size: string,
  material: string
): RouteConstraints;

/**
 * Example usage:
 * const rules = getConstraintRules('pipe', '3/4"', 'steel');
 * // Returns:
 * {
 *   minBendRadius: 0.108,  // 4x diameter for steel
 *   supportSpacing: 3.05,  // 10 feet for 3/4" pipe
 *   clearance: { walls: 0.05, ceiling: 0.05, floor: 0.05, otherInfrastructure: 0.075 }
 * }
 */
```

---

### Agent 4 - Pipe Geometry Generator

**Ownership:** `src/routing/geometry/PipeGenerator.ts`

#### API Contract

```typescript
export class PipeGenerator implements RouteGeometryGenerator {
  /**
   * Generate pipe geometry from route
   * @param route - Route with segments and specs
   * @param scene - Babylon scene to add meshes to
   * @returns Generated mesh and BOM data
   */
  generate(route: Route, scene: BABYLON.Scene): GeneratedGeometry;

  /**
   * Compute bill of materials for route
   * @returns BOM with lengths, fittings, material
   */
  computeBOM(route: Route): BOMData;
}

export interface GeneratedGeometry {
  mesh: BABYLON.Mesh;           // Combined pipe mesh
  fittings: BABYLON.Mesh[];     // Elbow/tee/reducer meshes
  supports: BABYLON.Mesh[];     // Hanger/clamp/bracket meshes
}

export interface BOMData {
  type: RouteType;
  size: string;
  material: string;
  totalLength: number;          // meters
  fittings: FittingCount[];
  supports: SupportCount[];
  estimatedCost?: number;       // USD (optional)
}

export interface FittingCount {
  type: 'elbow' | 'tee' | 'reducer' | 'coupling';
  angle?: number;               // For elbows: 90, 45, etc.
  count: number;
}

export interface SupportCount {
  type: 'hanger' | 'clamp' | 'bracket';
  spec: string;                 // e.g., "Pipe Hanger 3/4\""
  count: number;
}
```

#### Geometry Generation Steps

1. **Read Spec:** Look up OD/ID from `PIPE_SIZES[route.source.specifications.size]`
2. **Create Tube:** `BABYLON.MeshBuilder.CreateTube()` along path
3. **Generate Elbows:** At each bend, create elbow fitting with correct radius
4. **Place Supports:** Calculate positions from support spacing, create hanger meshes
5. **Apply Material:** Based on material spec (steel = gray, PVC = white, copper = copper)
6. **Combine Meshes:** Merge segments for performance (reduce draw calls)

**Performance:** <50ms for single route, <500ms for 10 routes

---

### Agent 5 - Cable Tray Geometry Generator

**Ownership:** `src/routing/geometry/CableTrayGenerator.ts`

#### API Contract

```typescript
export class CableTrayGenerator implements RouteGeometryGenerator {
  generate(route: Route, scene: BABYLON.Scene): GeneratedGeometry;
  computeBOM(route: Route): BOMData;
}
```

#### Geometry Generation Steps

1. **Read Spec:** Width, height, tray type from `CABLE_TRAY_SPECS`
2. **Create Channel:** Box or ladder structure along path
3. **Generate Fittings:** 90° elbows, 45° elbows, tees at branches
4. **Place Supports:** Every 12 feet (default), create bracket/hanger meshes
5. **Apply Material:** Aluminum = silver, steel = gray, fiberglass = white

---

### Agent 6 - Wiring & Conduit Geometry Generators

**Ownership:** `src/routing/geometry/CableGenerator.ts`, `ConduitGenerator.ts`

#### CableGenerator API

```typescript
export class CableGenerator implements RouteGeometryGenerator {
  generate(route: Route, scene: BABYLON.Scene): GeneratedGeometry;
  computeBOM(route: Route): BOMData;
}
```

**Geometry:** Cylinder or bundle of cylinders (multi-core), color-coded by voltage

#### ConduitGenerator API

```typescript
export class ConduitGenerator implements RouteGeometryGenerator {
  generate(route: Route, scene: BABYLON.Scene): GeneratedGeometry;
  computeBOM(route: Route): BOMData;
}
```

**Geometry:** Tube along path, junction boxes at branch points

---

### Agent 7 - Connection Manager

**Ownership:** `src/routing/core/ConnectionManager.ts`

#### API Contract

```typescript
export class ConnectionManager {
  /**
   * Singleton instance
   */
  static getInstance(): ConnectionManager;

  /**
   * Add a connection point
   * @returns Created ConnectionPoint with unique ID
   */
  addConnectionPoint(config: ConnectionPointConfig): ConnectionPoint;

  /**
   * Remove connection point
   * @param id - Connection point ID
   * @returns true if removed, false if not found
   */
  removeConnectionPoint(id: string): boolean;

  /**
   * Get all connection points
   */
  getAllConnectionPoints(): ConnectionPoint[];

  /**
   * Get connection point by ID
   */
  getConnectionPoint(id: string): ConnectionPoint | undefined;

  /**
   * Check for duplicate at same position/type
   * @returns Existing connector ID if duplicate, null otherwise
   */
  findDuplicateAt(position: Vector3, type: RouteType, tolerance: number): string | null;
}
```

**Duplicate Prevention:**
```typescript
// Before creating new connector, check:
const existing = connectionManager.findDuplicateAt(position, type, 0.01); // 1cm tolerance
if (existing) {
  console.warn(`Connector already exists at this location: ${existing}`);
  return;
}
```

---

### Agent 8 - UI/UX & Scene Tree

**Ownership:** `src/routing/ui/*`, `src/ui/components/SceneTree.tsx`, `src/ui/layouts/ProfessionalModeLayout.tsx`

#### RoutingControlPanel Workflow

```
User Flow:
1. Click "Place Connectors" → Enter placing mode
2. Click in viewport multiple times → Connectors appear
3. Click "Finish Placing" → Exit placing mode
4. Select 2 connectors in scene tree
5. Click "Create Route" → Route created + geometry generated
6. Route appears in scene
```

**Multi-Drop Placement:**
- Mode stays active until user clicks "Finish Placing"
- Each click creates connector (no mode exit)
- Visual feedback: button highlighted while active

**Quick Action (2 Selected Connectors):**
- Detect when exactly 2 connectors selected
- Show "Create Route" button
- Auto-generate geometry immediately

#### Scene Tree Fixes

**Problem:** Stack overflow from recursive rendering
**Solution:** Convert recursion to controlled iteration with memoization

**Problem:** Cross-selection when names match
**Solution:** Select by unique ID, not name

**Problem:** Tree width doesn't fit long labels
**Solution:** Measure label widths, auto-resize left pane

---

### Agent 9 - Persistence & Export

**Ownership:** `src/scene/WorldSerializer.ts`, `src/exports/BOMExporter.ts`, `src/exports/GLBExporter.ts`

#### WorldSerializer Extensions

```typescript
/**
 * Save connectors, routes, and generated geometry
 */
export interface WorldSerializerExtensions {
  /**
   * Serialize connectors
   */
  serializeConnectors(): SerializedConnector[];

  /**
   * Serialize routes
   */
  serializeRoutes(): SerializedRoute[];

  /**
   * Deserialize connectors
   */
  deserializeConnectors(data: SerializedConnector[]): void;

  /**
   * Deserialize routes
   */
  deserializeRoutes(data: SerializedRoute[]): void;
}

export interface SerializedConnector {
  id: string;
  type: RouteType;
  position: [number, number, number];
  direction: [number, number, number];
  specifications: ConnectionSpecifications;
}

export interface SerializedRoute {
  id: string;
  type: RouteType;
  sourceId: string;              // Reference to connector
  destinationId: string;         // Reference to connector
  segments: SerializedSegment[];
  supports: SerializedSupport[];
  material: MaterialSpec;
  constraints: RouteConstraints;
  generated: boolean;
}
```

#### BOM CSV Export

```typescript
/**
 * Export bill of materials to CSV
 */
export class BOMExporter {
  /**
   * Export BOM for all routes
   */
  exportCSV(routes: Route[]): string;
}
```

**CSV Format:**
```csv
Route Type,Size,Material,Length (ft),Elbows,Tees,Reducers,Supports,Estimated Cost
Pipe,3/4",Steel,20.0,2,0,0,3,$245.50
Cable Tray,12"x4",Aluminum,50.0,3,1,0,5,$1250.00
Conduit,1",EMT,15.0,1,0,0,2,$85.00
TOTALS,,,85.0,6,1,0,10,$1580.50
```

#### GLB Export Material Preservation

**Problem:** Meshes turn white after GLB export/import
**Solution:**
1. Preserve material properties in glTF extensions
2. Save environment map references
3. Re-apply materials on import

---

## Integration Points

### Agent 1 → Agent 2
**Data Flow:** Waypoint path → Constraint validation

```typescript
// Agent 1 finds path
const waypoints = routeOptimizer.findPath(start, goal, graph, costFunc);

// Agent 2 validates segments from waypoints
const segments = createSegmentsFromWaypoints(waypoints);
const route = new Route(source, dest, segments, material, constraints);
const validationResult = constraintValidator.validate(route);
```

### Agent 2 → Agent 8
**Data Flow:** ValidationResult → UI warning display

```typescript
// Agent 8 displays warnings in UI
if (!validationResult.isValid) {
  validationResult.violations.forEach(v => {
    if (v.severity === 'error') {
      // Show red indicator at violation location
      createWarningGizmo(v.location, 'red');
    } else if (v.severity === 'warning') {
      // Show yellow indicator
      createWarningGizmo(v.location, 'yellow');
    }
    // Add to warnings panel
    addToWarningsPanel(v.message);
  });
}
```

### Agent 3 → Agents 2, 4, 5, 6
**Data Flow:** Specifications → Constraint thresholds & geometry sizing

```typescript
// Agent 4 reads spec
const pipeSpec = PIPE_SIZES[route.source.specifications.size];
const outerDiameter = pipeSpec.od;

// Agent 2 reads constraint rules
const rules = getConstraintRules('pipe', size, material);
const minBendRadius = rules.minBendRadius;
```

### Agent 7 → Agents 1, 8
**Data Flow:** ConnectionPoints → Pathfinding start/end & UI selection

```typescript
// Agent 8 gets all connectors for display
const connectors = connectionManager.getAllConnectionPoints();

// Agent 1 uses connector positions as start/goal
const route = await createRoute(sourceConnector, destConnector);
const path = routeOptimizer.findPath(
  sourceConnector.position,
  destConnector.position,
  graph,
  costFunc
);
```

### Agents 4, 5, 6 → Agent 9
**Data Flow:** BOM data → CSV export

```typescript
// Agent 9 aggregates BOM from all geometry generators
const allBOMs: BOMData[] = [];
routes.forEach(route => {
  const generator = GeometryGeneratorFactory.create(route.type);
  const bom = generator.computeBOM(route);
  allBOMs.push(bom);
});
const csv = BOMExporter.exportCSV(allBOMs);
```

---

## Specifications Tables

### Bend Radius Formulas

| Material | Formula | Example (3/4" pipe) |
|----------|---------|---------------------|
| Steel Pipe | 4× OD | 4 × 0.027m = 0.108m (4.25") |
| PVC Pipe | 3× OD | 3 × 0.027m = 0.081m (3.2") |
| Copper Pipe | 2.5× OD | 2.5 × 0.027m = 0.0675m (2.66") |
| Electrical Cable | 6× OD | 6 × 0.008m = 0.048m (1.9") |
| Cable Tray | Fixed angles | 90°, 45° only |
| Conduit EMT | 6× OD | 6 × 0.023m = 0.138m (5.4") |

### Support Spacing Rules

| Size | Material | Max Spacing |
|------|----------|-------------|
| 1/2" pipe | Steel | 8 feet (2.44m) |
| 3/4" pipe | Steel | 10 feet (3.05m) |
| 1" pipe | Steel | 12 feet (3.66m) |
| Cable tray (any) | — | 12 feet (3.66m) |
| Conduit 3/4" | EMT | 10 feet (3.05m) |
| Conduit 1" | EMT | 12 feet (3.66m) |

### Clearance Requirements

| Context | Minimum Clearance |
|---------|-------------------|
| Walls | 2" (0.05m) |
| Ceiling | 2" (0.05m) |
| Floor | 6" (0.15m) |
| Other Infrastructure | 3" (0.075m) |
| High Voltage (>480V) | 12" (0.3m) |

---

## Algorithms & Formulas

### A* Pathfinding

```typescript
function aStar(start: GraphNode, goal: GraphNode, graph: Graph, costFunc: CostFunction): GraphNode[] {
  const openSet: PriorityQueue<GraphNode> = new PriorityQueue();
  const cameFrom: Map<string, string> = new Map();
  const gScore: Map<string, number> = new Map();
  const fScore: Map<string, number> = new Map();

  gScore.set(start.id, 0);
  fScore.set(start.id, heuristic(start, goal));
  openSet.enqueue(start, fScore.get(start.id)!);

  while (!openSet.isEmpty()) {
    const current = openSet.dequeue()!;

    if (current.id === goal.id) {
      return reconstructPath(cameFrom, current);
    }

    for (const neighbor of getNeighbors(current, graph)) {
      const tentativeGScore = gScore.get(current.id)! + costFunc.calculateCost(current.position, neighbor.position, context);

      if (!gScore.has(neighbor.id) || tentativeGScore < gScore.get(neighbor.id)!) {
        cameFrom.set(neighbor.id, current.id);
        gScore.set(neighbor.id, tentativeGScore);
        fScore.set(neighbor.id, tentativeGScore + heuristic(neighbor, goal));

        if (!openSet.contains(neighbor)) {
          openSet.enqueue(neighbor, fScore.get(neighbor.id)!);
        }
      }
    }
  }

  return []; // No path found
}

function heuristic(a: GraphNode, b: GraphNode): number {
  // Euclidean distance in 3D
  return BABYLON.Vector3.Distance(
    new BABYLON.Vector3(a.position.x, a.position.y, a.position.z),
    new BABYLON.Vector3(b.position.x, b.position.y, b.position.z)
  );
}
```

### Bend Radius Calculation

```typescript
function calculateBendRadius(segment1: Vector3, vertex: Vector3, segment2: Vector3): number {
  // Calculate bend angle
  const v1 = BABYLON.Vector3.Normalize(vertex.subtract(segment1));
  const v2 = BABYLON.Vector3.Normalize(segment2.subtract(vertex));
  const angle = Math.acos(BABYLON.Vector3.Dot(v1, v2));

  // For 90° bend with distance d from vertex to arc:
  // radius = d / tan(angle/2)
  // For simplicity, use distance to vertex as approximation
  const distance = BABYLON.Vector3.Distance(segment1, vertex);
  const radius = distance / Math.tan(angle / 2);

  return radius;
}
```

---

## API Reference

### RouteOptimizer Public API

```typescript
findPath(start: Vector3, goal: Vector3, graph: Graph, costFunction: CostFunction): Vector3[] | null;
hasDirectPath(start: Vector3, goal: Vector3, obstacles: BABYLON.AbstractMesh[]): boolean;
```

### ConstraintValidator Public API

```typescript
validate(route: Route): ValidationResult;
validateBatch(routes: Route[]): Map<string, ValidationResult>;
```

### GeometryGeneratorFactory

```typescript
static create(routeType: RouteType): RouteGeometryGenerator;
```

---

## Error Handling

### Pathfinding Errors
- **No Path Found:** Return `null`, UI shows "Cannot route between these points"
- **Timeout:** Throw `PathfindingTimeoutError`, UI shows "Routing taking too long, simplify scene"

### Constraint Violations
- **Error Severity:** Block geometry generation, show red indicator
- **Warning Severity:** Allow generation, show yellow indicator
- **Info Severity:** Allow generation, show blue indicator

### Geometry Generation Errors
- **Missing Spec:** Throw `SpecificationError`, UI shows "Unknown pipe size: {size}"
- **Invalid Mesh:** Throw `GeometryError`, UI shows "Failed to generate geometry"

---

## Performance Requirements

| Operation | Budget | Measurement |
|-----------|--------|-------------|
| Pathfinding (simple) | <100ms | `performance.now()` around `findPath()` |
| Pathfinding (complex) | <500ms | 300+ obstacles scene |
| Geometry generation (1 route) | <50ms | Single pipe route |
| Geometry generation (10 routes) | <500ms | Batch generation |
| Validation (1 route) | <10ms | Single route validation |
| Frame rate (50 routes visible) | 60 FPS | Monitor `scene.getEngine().getFps()` |
| Frame rate (100 routes visible) | 45+ FPS | Acceptable performance |

---

**Last Updated:** 2025-01-03
**Version:** 2.0
**Maintained By:** Agent 3 (structure), All Agents (their sections)
