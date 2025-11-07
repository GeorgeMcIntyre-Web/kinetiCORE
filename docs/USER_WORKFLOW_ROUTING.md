# User Workflow: Creating 3D Routes

**Last Updated:** 2025-11-03  
**Status:** Production Ready  
**Dev Server:** http://localhost:5176

---

## Overview

This guide explains how to create 3D routing (pipes, cables, conduits, cable trays) by clicking on geometry in the viewport. The system automatically generates 3D models based on your specifications.

---

## Complete Workflow

### Step 1: Select Route Type

1. Open **Professional Mode** (default on startup)
2. Find the **Routing** section in the ribbon toolbar
3. Select route type:
   - **Pipe** - For fluid/steam/gas piping
   - **Electrical** - For power cables
   - **Cable Tray** - For cable management systems
   - **Conduit** - For electrical conduit systems

**What Happens:** Sets `currentRouteType` in routing store. This type will be used for all routes you create until you change it.

---

### Step 2: Configure Specifications (Optional)

Before creating routes, you can set default specifications:

**For Pipes:**
- **Pipe Size**: Select from dropdown (1/4", 3/8", 1/2", 3/4", 1", etc.)
  - Each size maps to actual dimensions:
    - `3/4"` → OD: 27mm (0.027m), ID: 21mm (0.021m)
    - `1"` → OD: 33mm (0.033m), ID: 27mm (0.027m)
    - See [PipeSpecifications.ts](../src/routing/specifications/PipeSpecifications.ts) for full table
- **Material**: Steel, stainless steel, copper, PVC, aluminum
- **Pressure Rating**: Max operating pressure (PSI)

**For Electrical:**
- **Voltage**: 120V, 240V, 480V, etc.
- **Current**: Amperage rating
- **Wire Gauge**: AWG size

**Note:** If you don't configure specifications, defaults are used:
- Pipe: `3/4 inch` size, `steel` material
- Electrical: `480V`, `copper` material

---

### Step 3: Enter "Place Connectors" Mode

1. In the **Routing** toolbar, click **"Place Connectors"** button
2. Button should show **"active"** state (highlighted)
3. Console log: `[RoutingToolbar] Entering placing_connector mode`

**What Happens:** Sets `routingMode = 'placing_connector'`. Now when you click on 3D geometry, connection points will be created.

---

### Step 4: Click on 3D Geometry

1. **Click anywhere on 3D geometry** in the viewport:
   - Ground plane
   - Boxes, spheres, cylinders (any mesh)
   - Surfaces of imported CAD models
   - Any visible mesh in the scene

2. **Connection point created:**
   - Cyan sphere appears at click location
   - Console log: `[CreateConnectionPointCommand] 📍 Creating connection point with type: pipe`
   - Console log: `[ConnectionPointsRenderer] Creating sphere at user:(x, y, z)`

3. **Connection point properties:**
   - Position: 3D coordinates where you clicked
   - Direction: Normal of clicked surface (or Z-up default)
   - Type: Matches `currentRouteType` you selected
   - Specifications: Default specs (or configured specs)

---

### Step 5: Create Second Connection Point

1. **Click another location** on 3D geometry (or same geometry, different spot)
2. **Second connection point created** (another cyan sphere)

**Note:** You can create multiple connection points before creating routes. The system will use the last two points you click.

---

### Step 6: Route Creation

Routes can be created in two ways:

#### Method A: Automatic Route (After 2nd Click)

If routing mode is `selecting_source`/`selecting_dest`:
- Clicking existing connection points automatically creates route
- Console log: `[RoutingWorkflowHandler] 🚀 Creating route between: [id1] and [id2]`

#### Method B: Manual Route Creation

1. Click **"Create Route"** button in toolbar
2. Or use **Route Edit Panel** to select source/dest points
3. System finds optimal path between points (avoiding obstacles)

**What Happens:**
1. `RoutingWorkflowHandler.createRouteBetweenPoints()` called
2. `RouteOptimizer.findOptimalPath()` calculates path
3. Route object created with segments (straight + bends)
4. Route added to routing store

---

### Step 7: Geometry Generation

**Automatic:**
- When route is created, `GenerateRouteGeometryCommand` is executed automatically
- Console log: `[GenerateRouteGeometryCommand] ✅ Geometry generated: pipe_route_[id]`

**Manual (if needed):**
- Select route in 3D viewport
- Click **"Generate Geometry"** button
- Or use Edit Panel → **"Update Geometry"**

**What Gets Created:**

**For Pipes:**
- **Cylinder segments** along route path (OD based on `specifications.size`)
- **Torus elbows** at bends (90° arcs, not full rings)
- **Support brackets** at support points (U-shaped hangers)
- **Material**: Gray metallic (steel), copper-colored (copper), etc.

**For Electrical:**
- **Twisted wire bundle** (3-5 individual wires)
- **Yellow/gold color** (electrical standard)
- **Wire diameter**: Based on AWG gauge (from specifications)

**For Cable Trays:**
- **Ladder frame** (U-shaped channel)
- **Orange color** (galvanized steel)
- **Width/height**: Based on specifications

**For Conduit:**
- **Green tube** (smooth cylinder)
- **Semi-glossy material**
- **Junction boxes** at connection points

---

## Understanding Pipe Sizes

### How Pipe Sizes Work

1. **User specifies**: Nominal size (e.g., `"3/4 inch"` or `"3/4"`)
2. **System looks up**: In `PIPE_SIZES` table (from [PipeSpecifications.ts](../src/routing/specifications/PipeSpecifications.ts))
3. **Gets actual dimensions**:
   ```typescript
   '3/4"': { 
     od: 0.027,  // Outer diameter: 27mm
     id: 0.021,  // Inner diameter: 21mm
     wallThickness: 0.003 // 3mm wall
   }
   ```
4. **Geometry generator uses**: OD to create cylinder diameter

### Available Pipe Sizes

| Nominal Size | OD (mm) | OD (meters) | ID (mm) | Use Case |
|--------------|---------|-------------|---------|----------|
| 1/4" | 13.5 | 0.0135 | 9 | Small lines |
| 3/8" | 17 | 0.017 | 12 | Low flow |
| 1/2" | 21 | 0.021 | 16 | Standard residential |
| **3/4"** | **27** | **0.027** | **21** | **Default, common** |
| 1" | 33 | 0.033 | 27 | Medium flow |
| 1-1/4" | 42 | 0.042 | 36 | Higher capacity |
| 1-1/2" | 48 | 0.048 | 41 | Industrial |
| 2" | 60 | 0.060 | 53 | Main lines |
| 3" | 89 | 0.089 | 78 | Large systems |
| 4" | 114 | 0.114 | 102 | Major distribution |

**Default:** `3/4 inch` (27mm OD) - Most common residential/light commercial size.

---

## Visual Results

### What You Should See

1. **Connection Points**: Cyan spheres at click locations
2. **Route Geometry**: 3D models connecting the points:
   - **Pipe**: Gray cylinder (or copper/stainless colored)
   - **Electrical**: Yellow wire bundle
   - **Cable Tray**: Orange ladder frame
   - **Conduit**: Green tube

3. **Route Labels** (if enabled):
   - Eye icon in toolbar toggles labels
   - Shows route type, length, specifications
   - Example: `"Pipe | 2.5m | 3/4" steel"`

4. **Warnings Panel** (top bar):
   - Shows validation issues (bend radius, clearance)
   - Click to expand details
   - Red = errors, Yellow = warnings

---

## Editing Routes

### Change Pipe Size After Creation

1. **Select route** (click 3D pipe in viewport)
2. **Edit Panel opens** (right side)
3. **Edit specifications**:
   - Change `size` field (e.g., `3/4 inch` → `1 inch`)
   - Change `material` (e.g., `steel` → `copper`)
4. **Click "Update"**
5. **Geometry regenerates** with new size:
   - Old mesh disposed
   - New cylinder created with new diameter
   - Material updated (color changes)

### Change Route Type

1. Select route
2. Edit Panel → **Route Type** dropdown
3. Select new type (e.g., `Pipe` → `Electrical`)
4. Click **"Update"**
5. **Geometry completely regenerates**:
   - Pipe cylinder → Yellow wire bundle
   - Material, diameter, visual style all change

---

## Troubleshooting

### Issue: No Connection Points Created

**Symptom:** Clicking viewport doesn't create spheres

**Solution:**
1. Check routing mode: Should be `placing_connector`
2. Click **"Place Connectors"** button first
3. Button should show **"active"** state
4. Console log should show: `[RoutingToolbar] Entering placing_connector mode`

---

### Issue: Connection Points Created But No Route

**Symptom:** Cyan spheres visible, but no pipe/cable connecting them

**Solution:**
1. Check console for errors:
   ```
   [RoutingWorkflowHandler] 🚀 Creating route between...
   [RouteOptimizer] Finding optimal path...
   [GenerateRouteGeometryCommand] ✅ Geometry generated...
   ```
2. Verify you have **2+ connection points** created
3. Try **manually creating route**:
   - Click "Create Route" button
   - Or select both connection points in Edit Panel

---

### Issue: Pipe Size Wrong

**Symptom:** Pipe looks too thick or too thin

**Diagnosis:**
1. Check connection point specifications:
   ```javascript
   // In browser console:
   const route = routingStore.activeRoutes[0];
   console.log('Pipe size:', route.source.specifications.size);
   console.log('OD:', route.source.specifications.outerDiameter);
   ```
2. Check PipeGenerator mapping:
   - Default uses `'3/4 inch'` but PIPE_SIZES table uses `'3/4"'`
   - May need to normalize size strings

**Fix:**
- Edit route specifications in Edit Panel
- Change size to match PIPE_SIZES table format (e.g., `"3/4"` not `"3/4 inch"`)

---

### Issue: Geometry Not Visible

**Symptom:** Route created but no 3D model appears

**Solution:**
1. Check mesh exists:
   ```javascript
   const scene = SceneManager.getInstance().getScene();
   const routeMeshes = scene.meshes.filter(m => m.metadata?.routeId);
   console.log('Route meshes:', routeMeshes.length);
   ```
2. Check visibility:
   ```javascript
   routeMeshes.forEach(m => {
     console.log(m.name, 'visible:', m.isVisible, 'enabled:', m.isEnabled());
   });
   ```
3. **Force regeneration:**
   - Select route
   - Edit Panel → **"Update Geometry"** button

---

## Example: Creating a 3/4" Steel Pipe

### Step-by-Step

1. **Select "Pipe"** in routing toolbar
2. **Click "Place Connectors"** button (should highlight)
3. **Click on ground plane** at position (0, 0, 0) → Cyan sphere #1 appears
4. **Click on box geometry** at position (2, 0, 1) → Cyan sphere #2 appears
5. **Click "Create Route"** → System calculates path
6. **Route created** → Console: `[RoutingWorkflowHandler] ✅ Route object created`
7. **Geometry generated** → Gray cylinder appears connecting spheres
8. **Result**: 3D pipe visible in viewport (27mm OD, gray steel material)

### Expected Console Output

```
[RoutingToolbar] Entering placing_connector mode
[SceneCanvas] 🎯 Mesh clicked: ground metadata: null
[CreateConnectionPointCommand] 📍 Creating connection point with type: pipe
[CreateConnectionPointCommand] ✅ Connection point created: c123...
[ConnectionPointsRenderer] Creating sphere at user:(0, 0, 0)

[SceneCanvas] 🎯 Mesh clicked: box metadata: {entityId: "box_456"}
[CreateConnectionPointCommand] 📍 Creating connection point with type: pipe
[CreateConnectionPointCommand] ✅ Connection point created: c789...
[ConnectionPointsRenderer] Creating sphere at user:(2, 0, 1)

[RoutingWorkflowHandler] 🚀 Creating route between: c123... and c789...
[RouteOptimizer] Finding optimal path...
[RouteOptimizer] ✅ Path found: 3 segments
[Route constructor] 🏗️ Creating route route_abc...
[Route constructor] Route type set to: pipe

[GenerateRouteGeometryCommand] Generating geometry for route: route_abc...
[GeometryGeneratorFactory] 🏭 Creating generator for type: pipe
[PipeGenerator] 🔧 Generating pipe for route: route_abc...
[PipeGenerator] Pipe size: 3/4 inch → OD: 0.027m
[PipeGenerator] ✅ Created 3 tube segments + 1 elbow + 2 supports
[GenerateRouteGeometryCommand] ✅ Geometry generated: pipe_route_abc...

✅ COMPLETE: Pipe route visible in viewport
```

---

## Advanced: Specifications Configuration

### Setting Pipe Size Before Creation

You can configure default specifications in the routing store:

```typescript
// In browser console (before creating routes):
const routingStore = useRoutingStore.getState();

// Set pipe size for all new routes:
routingStore.setCurrentRouteType('pipe');
// Then create connection points with custom specs
```

**Note:** Connection points inherit specifications when created. Once created, you can edit them in the Edit Panel.

---

## Reference

### Files

- **Workflow Handler**: [src/routing/ui/RoutingWorkflowHandler.ts](../src/routing/ui/RoutingWorkflowHandler.ts)
- **Pipe Generator**: [src/routing/geometry/PipeGenerator.ts](../src/routing/geometry/PipeGenerator.ts)
- **Pipe Specifications**: [src/routing/specifications/PipeSpecifications.ts](../src/routing/specifications/PipeSpecifications.ts)
- **Edit Panel**: [src/routing/ui/RouteEditPanel.tsx](../src/routing/ui/RouteEditPanel.tsx)

### Key Functions

- `RoutingWorkflowHandler.handlePlaceConnectionPoint()` - Creates connection point on click
- `RoutingWorkflowHandler.createRouteBetweenPoints()` - Creates route between two points
- `PipeGenerator.getPipeDiameter()` - Maps size string to OD/ID dimensions
- `GenerateRouteGeometryCommand.execute()` - Generates 3D mesh from route

---

**Ready to create routes!** Follow Steps 1-7 above to create your first 3D pipe/cable. 🎯




