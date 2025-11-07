# Smart Piping, Wiring & Cable Tray System
**Feature Name:** Intelligent Infrastructure Routing System
**Date:** 2025-01-XX
**Status:** 📐 Design Phase
**Priority:** High

---

## 🎯 Overview

A fast and user-friendly system for creating 3D models representing real-world infrastructure: **pipes, electrical wiring, cable trays, conduits, and similar routing systems**. The system intelligently understands connections between items, automatically calculates optimal paths, and allows users to fine-tune the results.

**Core Value Proposition:** 
- **Smart Auto-Routing** - Automatically finds best path between connection points
- **Real-world Constraints** - Respects physical limitations (bend radius, support spacing, clearance)
- **Fast Workflow** - Create complex routing systems in minutes, not hours
- **User-Friendly** - Intuitive tools with visual feedback and easy editing

---

## 💡 Problem Statement

### Current Pain Points in Factory Design

1. **Manual Routing is Time-Consuming**
   - Engineers spend hours/days manually placing pipes, cables, conduits
   - Requires deep knowledge of routing best practices
   - Error-prone: easy to create invalid paths (too tight bends, interference)

2. **Lack of Smart Tools**
   - CAD software requires manual point-by-point placement
   - No automatic path optimization
   - No real-time constraint checking

3. **Connection Management is Difficult**
   - Hard to see what connects to what
   - Changes break connections
   - No visual feedback on routing quality

### Solution

Create an intelligent routing system that:
- ✅ Understands **connection points** (connectors, junctions, devices)
- ✅ **Auto-routes** optimal paths respecting constraints
- ✅ Allows **user refinement** of auto-generated paths
- ✅ Provides **visual feedback** (path quality, constraints, conflicts)
- ✅ Supports **multiple types** of infrastructure (pipes, wires, cable trays)

---

## 🏗️ System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Smart Routing System                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐    ┌──────────────────┐                  │
│  │ Connection      │    │ Path Optimizer  │                  │
│  │ Manager        │───▶│                 │                  │
│  │                │    │ • A* Algorithm   │                  │
│  │ • Connectors   │    │ • Constraint     │                  │
│  │ • Junctions    │    │   Validation     │                  │
│  │ • Devices      │    │ • Cost Function  │                  │
│  └─────────────────┘    └──────────────────┘                  │
│           │                      │                             │
│           │                      ▼                             │
│           │              ┌──────────────────┐                  │
│           │              │ Geometry         │                  │
│           │              │ Generator        │                  │
│           │              │                  │                  │
│           │              │ • Pipes          │                  │
│           │              │ • Cables         │                  │
│           │              │ • Cable Trays    │                  │
│           │              │ • Conduits        │                  │
│           └──────────────▶└──────────────────┘                  │
│                                 │                             │
│                                 ▼                             │
│                        ┌──────────────────┐                   │
│                        │ Scene Integration│                   │
│                        │                  │                   │
│                        │ • Entity System  │                   │
│                        │ • Physics        │                   │
│                        │ • Visuals        │                   │
│                        └──────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 Connection System

### Connection Points

**Types of Connection Points:**

1. **Connectors**
   - Input/output ports on devices (motors, sensors, control panels)
   - Have type: `'pipe'`, `'electrical'`, `'cable_tray'`, etc.
   - Have size/specification (e.g., `'3/4" pipe'`, `'480V 3-phase'`)
   - Position in 3D space
   - Direction vector (which way connection faces)

2. **Junctions**
   - T-joints, elbows, splitters
   - Multiple connection points (inputs/outputs)
   - Type-specific (pipe junction, electrical junction box)

3. **Devices**
   - Objects that need connections (robots, machines, panels)
   - Can have multiple connection points
   - Smart detection: "This robot needs power and air"

### Connection Detection

**Smart Connection Recognition:**
- **Auto-detect compatible connections** when user clicks two points
- **Type matching:** Pipes connect to pipe connectors, not electrical
- **Size matching:** Warns if sizes don't match (3/4" pipe to 1/2" pipe)
- **Visual indicators:** Show available connection points with icons

**Connection Graph:**
- Maintains network of connections
- Tracks: source → destination relationships
- Supports branching (multiple devices from one source)

---

## 🗺️ Path Optimization

### Path Finding Algorithm

**Primary Algorithm: A* (A-Star) with Constraints**

```
Start: Source connection point
Goal: Destination connection point
Constraints:
  - Minimum bend radius
  - Maximum run length
  - Clearance from obstacles
  - Support spacing requirements
  - Elevation changes
Cost Function:
  - Path length (shorter is better)
  - Number of bends (fewer is better)
  - Proximity to obstacles (farther is safer)
  - Support requirements (fewer supports is cheaper)
```

### Constraint System

**Physical Constraints:**

1. **Bend Radius**
   - Pipes: Minimum bend radius based on diameter/material
   - Cables: Minimum bend radius to prevent damage
   - Cable Trays: Fixed radius elbows available

2. **Support Spacing**
   - Pipes: Supports every X feet (depends on size)
   - Cable Trays: Supports every Y feet
   - Hangers, clamps, brackets

3. **Clearance Requirements**
   - Distance from walls, ceiling, floor
   - Clearance from other infrastructure
   - Access space for maintenance

4. **Elevation Constraints**
   - Maximum slope (e.g., pipes can't go too steep)
   - Floor/wall/ceiling mounting options

5. **Material-Specific**
   - Pipe: Supports only at certain points
   - Cable: Can't exceed pull tension
   - Conduit: Bending rules (EMT, rigid, etc.)

### Path Optimization Modes

**1. Shortest Path (Default)**
- Minimizes total length
- Fewest bends
- Best for: Cost optimization

**2. Safest Path**
- Maximizes clearance from obstacles
- Follows designated routing zones
- Best for: Safety-critical systems

**3. Aesthetic Path**
- Follows building structure (along walls, ceiling)
- Parallel to other infrastructure
- Best for: Visible installations

**4. Custom**
- User-defined cost function
- Weighted preferences

---

## 🎨 User Workflow

### Step 1: Define Connection Points

**Method A: Select Existing Objects**
```
1. Click on device (robot, control panel, etc.)
2. System detects available connection points
3. Visual indicators appear (icons at connection points)
4. Click on source connection point
```

**Method B: Place Custom Connectors**
```
1. Toolbar: "Add Connector" button
2. Click in 3D space where connection needed
3. Dialog: Select type (pipe, electrical, cable tray)
4. Set specifications (size, voltage, etc.)
5. Connector appears at location
```

### Step 2: Auto-Route Path

```
1. Click source connection point
2. Click destination connection point
3. System calculates optimal path
4. Preview path appears (semi-transparent)
5. Path shows:
   - Route segments
   - Bends/elbows
   - Support points
   - Constraint violations (if any) - highlighted in red
```

### Step 3: Review & Adjust

```
1. Review auto-generated path
2. Constraint violations highlighted
3. Click on path segment to adjust
4. Drag control points to refine
5. System re-validates constraints in real-time
```

### Step 4: Generate 3D Model

```
1. Click "Generate" button
2. System creates 3D geometry:
   - Pipes: Cylinders with proper diameter
   - Cables: Bundle geometry
   - Cable Trays: Channel geometry with supports
   - Conduits: Pipe-like geometry
3. Materials applied (metal, PVC, etc.)
4. Supports/hangers generated automatically
```

### Step 5: Fine-Tune Details

```
1. Select generated route object
2. Inspector panel shows:
   - Path segments
   - Connection points
   - Constraints
   - Material specifications
3. Edit individual segments
4. Add/remove supports
5. Adjust bend radii
```

---

## 🎯 Supported Infrastructure Types

### 1. **Piping Systems**

**Types:**
- Water pipes (cooling, process water)
- Compressed air lines
- Hydraulic lines
- Steam pipes
- Vacuum lines

**Features:**
- Diameter-based routing (1/4", 1/2", 3/4", 1", etc.)
- Material types (steel, copper, PVC, flexible)
- Fittings: elbows, tees, reducers
- Supports: hangers, clamps
- Insulation visualization

**Constraints:**
- Minimum bend radius (flexible vs. rigid)
- Support spacing (depends on diameter)
- Slope requirements (drainage)
- Thermal expansion considerations

---

### 2. **Electrical Wiring**

**Types:**
- Power cables (480V, 240V, 120V)
- Control wiring (24V, low voltage)
- Communication cables (Ethernet, CAN bus)
- Signal cables

**Features:**
- Wire gauge/size (AWG)
- Voltage rating
- Number of conductors
- Bundling multiple wires
- Cable trays for multi-cable runs

**Constraints:**
- Minimum bend radius (prevents damage)
- Maximum pull tension
- Separation from other systems (code requirements)
- Junction box placement

---

### 3. **Cable Trays**

**Types:**
- Ladder trays
- Wire mesh trays
- Solid bottom trays
- Channel/trough trays

**Features:**
- Width/height specifications
- Support spacing
- Fittings: elbows, tees, crosses
- Dropouts to devices
- Multi-level trays

**Constraints:**
- Support spacing requirements
- Load capacity
- Bend radius (fixed at standard angles)
- Elevation changes

---

### 4. **Conduits**

**Types:**
- EMT (Electrical Metallic Tubing)
- Rigid metal conduit
- PVC conduit
- Flexible conduit

**Features:**
- Diameter-based (1/2", 3/4", 1", etc.)
- Fittings: elbows, connectors, junction boxes
- Supports: straps, clamps
- Multi-conduit runs

**Constraints:**
- Bend radius limits
- Pull box requirements (long runs)
- Support spacing
- Code compliance (NEC for electrical)

---

## 🎨 Visual Feedback System

### Connection Point Indicators

**Visual Cues:**
- **Available:** Green sphere with connection type icon
- **Selected:** Yellow highlight
- **Connected:** Blue (shows it's part of a route)
- **Incompatible:** Red X (can't connect to selected type)

**Hover Information:**
- Connection type
- Specifications (size, rating)
- Existing connections (if any)

---

### Path Preview

**Real-time Path Display:**
- **Semi-transparent** preview while routing
- **Color-coded:**
  - Green: Valid path, good clearance
  - Yellow: Valid path, tight clearance
  - Red: Invalid path (constraint violation)
- **Route segments:** Straight runs shown as lines/cylinders
- **Bends:** Curved segments shown with proper radius
- **Supports:** Small indicators at support locations

**Constraint Violation Indicators:**
- Red highlight on problematic segment
- Tooltip explains violation:
  - "Bend radius too tight (minimum 6")"
  - "Insufficient clearance from wall (minimum 2")"
  - "Support spacing exceeded (max 8 feet)"

---

### Edit Mode

**Path Manipulation:**
- **Control points** at each bend/support
- **Drag control points** to adjust path
- **Add control points** for custom routing
- **Delete control points** to simplify
- **Snap to grid/objects** for alignment

**Visual Editing:**
- Selected segment highlighted
- Adjustment handles visible
- Real-time constraint validation
- Visual feedback on valid/invalid positions

---

## 📐 Technical Implementation

### Data Structures

```typescript
// Connection Point
interface ConnectionPoint {
  id: string;
  type: 'pipe' | 'electrical' | 'cable_tray' | 'conduit';
  position: Vector3;
  direction: Vector3; // Which way connection faces
  specifications: {
    size?: string;      // "3/4 inch"
    voltage?: number;   // 480
    material?: string; // "steel", "PVC"
  };
  parentObject?: string; // Entity ID of device/object
}

// Route Segment
interface RouteSegment {
  id: string;
  startPoint: Vector3;
  endPoint: Vector3;
  segmentType: 'straight' | 'bend' | 'fitting';
  bendRadius?: number;
  length: number;
  constraints: RouteConstraints;
}

// Route (Complete Path)
interface Route {
  id: string;
  type: 'pipe' | 'electrical' | 'cable_tray' | 'conduit';
  source: ConnectionPoint;
  destination: ConnectionPoint;
  segments: RouteSegment[];
  supports: SupportPoint[];
  material: MaterialSpec;
  constraints: RouteConstraints;
  generated: boolean; // Has 3D geometry been created?
}

// Constraints
interface RouteConstraints {
  minBendRadius: number;
  maxRunLength?: number;
  supportSpacing: number;
  clearance: {
    walls: number;
    ceiling: number;
    floor: number;
    otherInfrastructure: number;
  };
}

// Support Point
interface SupportPoint {
  id: string;
  position: Vector3;
  type: 'hanger' | 'clamp' | 'bracket';
  specification: string;
}
```

### Path Finding Algorithm (Pseudo-code)

```typescript
class RouteOptimizer {
  findOptimalPath(
    source: ConnectionPoint,
    destination: ConnectionPoint,
    constraints: RouteConstraints,
    obstacles: Mesh[]
  ): Route {
    // 1. Build search graph
    const graph = this.buildSearchGraph(
      source.position,
      destination.position,
      constraints,
      obstacles
    );

    // 2. A* pathfinding
    const pathNodes = this.aStarSearch(
      graph,
      source.position,
      destination.position
    );

    // 3. Convert nodes to route segments
    const segments = this.nodesToSegments(pathNodes, constraints);

    // 4. Add supports based on spacing requirements
    const supports = this.calculateSupports(segments, constraints);

    // 5. Validate constraints
    const violations = this.validateConstraints(
      segments,
      constraints,
      obstacles
    );

    return {
      source,
      destination,
      segments,
      supports,
      constraints,
      violations
    };
  }

  buildSearchGraph(
    start: Vector3,
    end: Vector3,
    constraints: RouteConstraints,
    obstacles: Mesh[]
  ): SearchGraph {
    // Create navigation mesh or waypoint graph
    // Respects constraints (clearance, bend radius)
    // Avoids obstacles
    // Follows building structure (walls, ceiling, floor)
  }

  aStarSearch(
    graph: SearchGraph,
    start: Vector3,
    goal: Vector3
  ): Vector3[] {
    // Standard A* with custom cost function
    // Cost = distance + bend penalty + clearance penalty
  }
}
```

### Geometry Generation

```typescript
class RouteGeometryGenerator {
  generatePipeGeometry(route: Route): Mesh {
    const tube = new TubeGeometry();
    
    // Create path curve from segments
    const curve = this.createCurveFromSegments(route.segments);
    
    // Create pipe mesh
    const pipe = TubeGeometry.createTube(
      curve,
      route.material.diameter / 2,
      route.material.diameter / 2,
      segments: 32
    );

    // Add fittings (elbows, tees)
    const fittings = this.generateFittings(route);
    
    // Add supports
    const supports = this.generateSupports(route.supports);

    return this.combineMeshes([pipe, ...fittings, ...supports]);
  }

  generateCableTrayGeometry(route: Route): Mesh {
    // Create channel geometry
    // Add supports
    // Add fittings (elbows, tees)
  }

  generateWireBundleGeometry(route: Route): Mesh {
    // Create multiple wire geometries bundled together
    // Color coding by voltage/type
  }
}
```

---

## 🎮 User Interface Components

### Toolbar Buttons

**Primary Actions:**
1. **"Add Connector"** - Place connection point
2. **"Route Between Points"** - Create route from source to destination
3. **"Auto-Route All"** - Connect all unconnected points automatically
4. **"Edit Route"** - Enter edit mode for selected route
5. **"Generate Geometry"** - Create 3D mesh from route path

**Type Selection:**
- Dropdown: Pipe / Electrical / Cable Tray / Conduit
- Sub-types: (e.g., for Pipe: Water / Air / Hydraulic)

---

### Inspector Panel (Route Editing)

**When route is selected:**

```
┌─────────────────────────────────┐
│ Route Properties                 │
├─────────────────────────────────┤
│ Type: [Pipe ▼]                  │
│ Material: [Steel ▼]             │
│ Diameter: [3/4" ▼]              │
│                                 │
│ ┌─ Path Segments ─────────────┐│
│ │ 1. Start → Bend (12")      ││
│ │ 2. Bend → Support (8 ft)    ││
│ │ 3. Support → End (6 ft)     ││
│ └─────────────────────────────┘│
│                                 │
│ ┌─ Constraints ───────────────┐│
│ │ ✓ Bend radius: OK           ││
│ │ ✓ Support spacing: OK        ││
│ │ ⚠ Clearance: Tight (1.5")   ││
│ └─────────────────────────────┘│
│                                 │
│ [Edit Path] [Regenerate]        │
└─────────────────────────────────┘
```

---

### Connection Manager Panel

**Shows connection network:**

```
┌─────────────────────────────────┐
│ Connection Network               │
├─────────────────────────────────┤
│                                  │
│ ┌─ Source: Robot Power Panel    ││
│ │   ├─→ Motor 1 (480V)          ││
│ │   ├─→ Motor 2 (480V)          ││
│ │   └─→ Control Panel (120V)    ││
│ └───────────────────────────────┘│
│                                  │
│ ┌─ Source: Air Compressor        ││
│ │   ├─→ Robot Gripper            ││
│ │   └─→ Pneumatic Valve         ││
│ └───────────────────────────────┘│
│                                  │
│ [Auto-Route All]                │
└─────────────────────────────────┘
```

---

## 🔧 Integration with Existing Systems

### Entity System Integration

**Routes as Scene Entities:**
- Routes are `SceneEntity` objects
- Support undo/redo via command system
- Physics optional (for collision detection)
- Material system integration

### Command System

**Commands for Routes:**
- `CreateRouteCommand` - Create new route
- `EditRouteCommand` - Modify route path
- `DeleteRouteCommand` - Remove route
- `GenerateGeometryCommand` - Create mesh from route

### Selection System

**Route Selection:**
- Click route to select entire path
- Click segment to select individual segment
- Multi-select for bulk operations
- Visual highlighting

---

## 📊 Example Use Cases

### Use Case 1: Robot Work Cell Wiring

**Scenario:**
Engineer needs to wire a robot work cell with:
- Power cables (480V to robot and motors)
- Control wiring (24V signals)
- Compressed air line (3/4" pipe)

**Workflow:**
1. Load robot and work cell into scene
2. System auto-detects connection points on robot
3. Place power panel connector
4. Click robot power connector → Click power panel connector
5. System auto-routes optimal path along ceiling
6. Repeat for control wiring and air line
7. Generate all geometry
8. Review and adjust as needed

**Time Saved:** Hours of manual routing → Minutes

---

### Use Case 2: Factory Floor Cable Tray System

**Scenario:**
Design cable tray system for entire factory floor connecting multiple machines.

**Workflow:**
1. Place connectors at each machine location
2. Use "Auto-Route All" to connect everything
3. System calculates optimal tray network (tree structure)
4. Review network in Connection Manager
5. Generate cable tray geometry with supports
6. Fine-tune specific segments

**Time Saved:** Days of manual design → Hours

---

### Use Case 3: Hydraulic System Routing

**Scenario:**
Design hydraulic lines for robot with multiple actuators.

**Workflow:**
1. Place hydraulic connectors on robot joints
2. Place hydraulic pump connector
3. Route each connection (multiple branches)
4. System enforces bend radius constraints
5. Generates pipe geometry with fittings
6. Adds supports automatically

**Time Saved:** Complex routing in minutes instead of hours

---

## 🚀 Implementation Phases

### Phase 1: Core Routing System (MVP)
**Goal:** Basic pipe routing between two points

- ✅ Connection point system
- ✅ Simple A* pathfinding
- ✅ Basic constraints (bend radius, length)
- ✅ Pipe geometry generation
- ✅ Visual preview

**Timeline:** 2-3 weeks

---

### Phase 2: Multi-Type Support
**Goal:** Support pipes, cables, cable trays

- ✅ Electrical wiring routing
- ✅ Cable tray routing
- ✅ Conduit routing
- ✅ Type-specific constraints
- ✅ Material specifications

**Timeline:** 2-3 weeks

---

### Phase 3: Advanced Features
**Goal:** Professional-grade routing

- ✅ Support auto-generation
- ✅ Fitting placement (elbows, tees)
- ✅ Multi-branch routing
- ✅ Connection manager UI
- ✅ Constraint violation highlighting
- ✅ Path editing tools

**Timeline:** 3-4 weeks

---

### Phase 4: Optimization & Polish
**Goal:** Production-ready

- ✅ Path optimization modes
- ✅ Performance optimization
- ✅ Advanced constraints
- ✅ Export/import routing data
- ✅ Documentation & tutorials

**Timeline:** 2 weeks

---

## 🎯 Success Metrics

**User Satisfaction:**
- Routing time reduced by 80%+
- User feedback: "Easy to use", "Saves hours"

**Technical:**
- Path finding completes in <100ms for typical routes
- Supports 100+ routes per scene
- Real-time constraint validation

**Business:**
- Differentiates from competitors
- Enables new use cases (full factory design)
- Attracts customers in facilities design

---

## 📚 References & Inspiration

**Similar Tools:**
- **Revit MEP** - Building services routing (pipes, ducts, electrical)
- **SolidWorks Electrical** - Cable routing in mechanical design
- **AutoCAD MEP** - Building systems routing

**Algorithms:**
- A* pathfinding (game development)
- Navigation mesh generation
- Constraint-based routing (VLSI design)

---

## ❓ Open Questions

1. **Obstacle Detection:**
   - How to detect existing geometry as obstacles?
   - Use collision detection system?

2. **Multi-Level Routing:**
   - How to handle routing across floors/levels?
   - Elevation change visualization?

3. **Routing Zones:**
   - Pre-defined routing corridors (along walls, ceiling)?
   - User-defined routing zones?

4. **Material Library:**
   - Pre-built material specifications?
   - User-defined materials?

5. **Export Formats:**
   - Export routes to CAD formats?
   - Bill of Materials generation?

---

**Next Steps:**
1. Review and refine this specification
2. Create detailed technical design document
3. Begin Phase 1 implementation
4. User testing and iteration

---

**Last Updated:** 2025-01-XX

