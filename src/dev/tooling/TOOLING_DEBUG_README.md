# 9X_110_GEO Tooling Explorer & Kinematics Pipeline

## Overview

This directory contains developer tools to analyze the large fixture model `9X_110_GEO.glb` together with its fitted-joints file `9X_110_GEO.json`. The tools provide:

1. **Scene Structure Analysis**: Inspect meshes, rigid clusters, and unit candidates
2. **Joint Visualization**: Overlay joints from JSON onto the 3D scene
3. **Geometric Attachment Discovery**: Find unit-to-base attachments using pure geometry (no name-based logic)
4. **Universal Kinematics Pipeline**: Naming-free, OEM-agnostic unit building from geometry and joints

## Tooling Pipeline

The tooling analysis follows a 4-step pipeline that is completely **naming-free** - no kinematic decisions depend on string patterns like `CLAMP-UNIT`, `UNIT_101`, etc.

### Step 1: Tree Inspector
```bash
npx tsx scripts/tooling-tree-inspector.ts "C:/path/to/fixture.glb"
```
Outputs: Scene structure overview (mesh counts, node hierarchy)

### Step 2: Rigid Clusters
```bash
npx tsx scripts/tooling-rigid-clusters.ts "C:/path/to/fixture.glb"
```
Outputs: `<fixture>.rigid-clusters.json`

- Detects welded/bolted rigid bodies using geometry adjacency
- Classifies clusters as `base`, `unit`, or `loose`
- Uses floor detection and base stack building (no name patterns)

### Step 3: Joint Segmentation
```bash
npx tsx scripts/tooling-joint-segmentation.ts "C:/path/to/fixture.glb" "C:/path/to/fixture.json"
```
Outputs: `<fixture>.joint-segmentation.json`

- Maps OEM joint data (Ford Fides JSON) to GLB nodes
- Extracts joint axes, origins, types, and limits
- Uses NodeId paths only to locate nodes, not for semantics

### Step 4: Unit Builder (NEW)
```bash
npm run tooling:units "C:/path/to/fixture.glb"
```
Outputs: 
- `<fixture>.units.json` - Links, joints, and kinematic units
- `<fixture>.unit-features.json` - Geometric and joint features per unit

**This is the core naming-free unit builder:**
- Builds link graph from joint connections (no name patterns)
- Groups clusters into kinematic units based on joint topology
- Computes universal features (geometry, contact, joints)
- Works across Ford Fides, TMS/NX, and future OEM formats

## Data Files

The tooling data files are located at:
- **GLB Model**: `C:\Users\George\source\repos\kinetiCORE_DATA\Tooling\9X_110_GEO.glb`
- **JSON Joints**: `C:\Users\George\source\repos\kinetiCORE_DATA\Tooling\9X_110_GEO.json`

The JSON file contains fitted-joints data with:
- `UnitName`: e.g. `UNIT_112`, `UNIT_108`, `UNIT_114`, `UNIT_116`, `UNIT_120`
- Per-joint:
  - `Type`: `0` = prismatic, `1` = hinge
  - `NodeId`: scene path to the **moving** node, e.g. `9X_110_GEO/UNIT_112/LH/MOVING`
  - `HideId`: matching wire/hose node
  - `FromVector` / `ToVector`: axis and anchor in world space
  - `TransformationMatrix`, `RmsError`, `MaxError`, `PointCount*`

## Running the Debug Pages

### Kinematics Debug (Recommended)

1. Run the full pipeline first:
   ```bash
   npx tsx scripts/tooling-rigid-clusters.ts "C:/path/to/fixture.glb"
   npx tsx scripts/tooling-joint-segmentation.ts "C:/path/to/fixture.glb" "C:/path/to/fixture.json"
   npm run tooling:units "C:/path/to/fixture.glb"
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open the kinematics debug page:
   ```
   http://localhost:5173/debug/9x-110-kinematics-debug.html
   ```

4. The page will automatically load:
   - GLB model
   - `*.rigid-clusters.json`
   - `*.units.json` (or falls back to `*.joint-segmentation.json`)
   - `*.unit-features.json` (if available)

### Tooling Explorer (Legacy)

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the tooling debug page:
   ```
   http://localhost:5173/debug/9x-110-tooling-debug.html
   ```
   (Adjust port/URL based on your Vite configuration)

3. The page will automatically load the GLB model and log an overview to the console.

## Console Commands

### Kinematics Debug API (`window.kinDebug`)

Once the kinematics debug page is loaded, use these commands:

#### `kinDebug.listUnits()`
Lists all kinematic units with their joints and features:
```
Units (new format):
  unit_0:
    Joints: 2
    Clusters: 5
    Height: 0.234m
    Extent: 0.123 x 0.234 x 0.456m
    Joints: 1 revolute, 1 prismatic
      - joint_0 (revolute): -45 to 45
      - joint_1 (prismatic): 0 to 100
```

#### `kinDebug.highlightUnit(unitId)`
Highlights a specific unit in yellow:
```js
kinDebug.highlightUnit('unit_0');
// Call again to clear highlight
kinDebug.highlightUnit('unit_0');
```

#### `kinDebug.setJoint(unitId, jointId, value)`
Sets a joint value (applies transformation):
```js
kinDebug.setJoint('unit_0', 'joint_0', 30); // 30 degrees for revolute
kinDebug.setJoint('unit_1', 'joint_1', 50);  // 50mm for prismatic
```

#### `kinDebug.resetAllJoints()`
Resets all joint transforms to zero.

#### `kinDebug.toggleAxes()`
Toggles visibility of joint axis visualizations.

### Tooling Explorer API (`window.toolingDebug`)

#### `toolingDebug.logOverview()`
Logs a summary of the scene structure:
- Total mesh count
- Base clusters detected
- Unit candidates with cluster counts and volumes

#### `await toolingDebug.overlayJoints()`
Loads joints from the JSON file and creates visual gizmos:
- **Green spheres + lines**: Prismatic joints
- **Red spheres + lines**: Hinge joints
- Spheres are placed at `FromVector`, lines extend to `ToVector`

To remove the overlay:
```js
toolingDebugOverlay.dispose();
```

#### `toolingDebug.analyzeAttachments()`
Analyzes geometric attachments between units and base clusters:
- Computes XY projection overlap
- Checks vertical gap between unit bottom and base top
- Returns array of `UnitAttachment` objects with contact area and sample points

Example output:
```js
{
  units: [...],
  attachments: [
    {
      unitId: "UNIT_AUTO_001",
      baseClusterId: "cluster_001",
      contactAreaApprox: 0.123456,
      contactPoints: [Vector3, Vector3, ...]
    },
    ...
  ]
}
```

## Implementation Details

### ToolingSceneExplorer

**Rigid Cluster Detection**:
- Builds connectivity graph where meshes are connected if:
  - They share a non-trivial parent transform node, OR
  - Their bounding boxes overlap or are within 1mm gap
- Connected components become `RigidCluster`s

**Base Cluster Identification**:
- Large volume (top 20% by volume)
- Small height relative to XY extents (height < 30% of max XY dimension)
- Centroid Z close to global minimum (within 5cm tolerance)

**Unit Grouping**:
- Clusters not identified as base are "unit-side"
- Grouped by XY-plane proximity (within 50cm)
- Shared contact with same base cluster (overlap of bbox projections)

### UnitAttachmentAnalyzer

**Attachment Detection**:
- Projects both unit and base bboxes onto XY plane
- Computes overlap area of projected rectangles
- Checks vertical gap (unit bottom - base top)
- **Thresholds**:
  - Minimum overlap area: `0.0001 m²` (1 cm²)
  - Maximum vertical gap: `0.01 m` (1 cm)

**Contact Points**:
- Samples 4 corners + center of overlap region
- Converts to 3D with base top Z coordinate

### ToolingJointOverlay

**Joint Loading**:
- Loads JSON from configured path
- Maps `Type: 0` → `'prismatic'`, `Type: 1` → `'hinge'`
- Parses `FromVector`/`ToVector` into Babylon `Vector3`

**Gizmo Creation**:
- Sphere at `FromVector` (2cm diameter)
- Line from `FromVector` to `ToVector`
- Color-coded by type (green = prismatic, red = hinge)
- Parented to fixture root for proper transformation

## Findings

*Note: Fill these in after running the tools on the actual model*

### Scene Statistics
- **Approximate mesh count under fixture**: _TBD_
- **Number of rigid clusters**: _TBD_
- **Number of base clusters detected**: _TBD_
- **Number of `UnitCandidate`s**: _TBD_

### Example Attachments

Example `UnitAttachment` entries:

```js
// Unit 1
{
  unitId: "UNIT_AUTO_001",
  baseClusterId: "cluster_003",
  contactAreaApprox: 0.0456,
  contactPoints: [...]
}

// Unit 2
{
  unitId: "UNIT_AUTO_002",
  baseClusterId: "cluster_001",
  contactAreaApprox: 0.1234,
  contactPoints: [...]
}
```

### Tuned Thresholds

- **Gap threshold for rigid clusters**: `0.001 m` (1mm)
- **Base cluster Z tolerance**: `0.05 m` (5cm)
- **Base cluster height ratio**: `0.3` (height < 30% of max XY)
- **Base cluster volume percentile**: `0.8` (top 20%)
- **Unit proximity threshold**: `0.5 m` (50cm in XY plane)
- **Attachment overlap threshold**: `0.0001 m²` (1 cm²)
- **Attachment vertical gap tolerance**: `0.01 m` (1 cm)

### Known Edge Cases

- **Clamp with pin attached**: Units with small attached components may be grouped together
- **Slide on dump unit**: Units mounted on other units may have multiple base attachments
- **Multi-foot units**: Units with multiple contact points will have multiple `UnitAttachment` entries
- **Floating units**: Units with no base attachments will log a warning

## Code Style

All code follows these conventions:
- Guard clauses and early returns (no `else`/`elseif`)
- Small, shallow functions
- Readability over cleverness
- Pure geometry-based logic (no name-based assumptions)
- Babylon.js types used throughout

## Files

### Core Types
- `MechanicalModel.ts`: Canonical types for universal kinematics (RigidCluster, KinematicJoint, Link, KinematicUnit, UnitFeatures)

### Adapters
- `JointAdapters.ts`: OEM-agnostic joint adapter interface and implementations (FordFidesJointAdapter, TmsNxJointAdapter)

### Scripts
- `scripts/tooling-tree-inspector.ts`: Scene structure inspection
- `scripts/tooling-rigid-clusters.ts`: Rigid cluster detection and classification
- `scripts/tooling-joint-segmentation.ts`: Joint mapping from OEM JSON to GLB
- `scripts/tooling-unit-builder.ts`: **Universal unit builder** (naming-free, graph-based)

### Debug Pages
- `ToolingConfig.ts`: Configuration with file paths
- `ToolingSceneExplorer.ts`: Scene structure analysis
- `ToolingJointOverlay.ts`: Joint visualization
- `UnitAttachmentAnalyzer.ts`: Geometric attachment discovery
- `debug/9x-110-tooling-debug.html`: Legacy tooling explorer
- `debug/9x-110-tooling-debug.ts`: Legacy tooling explorer TypeScript
- `debug/9x-110-kinematics-debug.html`: **Kinematics debug page** (uses units.json)
- `debug/9x-110-kinematics-debug.ts`: **Kinematics debug page TypeScript**

## Naming-Free Constraint

**Critical rule**: All kinematic logic must be naming-free. This means:

✅ **Allowed:**
- Geometry adjacency (bbox overlap, gap detection)
- Joint parent/child relationships
- Graph connectivity (link building)
- Cluster classification by size/position

❌ **Forbidden:**
- Pattern matching on `node.name` (e.g., `/CLAMP-UNIT/`, `/UNIT_\d+/`)
- Using names to decide what moves or how links are built
- Name-based unit grouping

Names are **only** used for:
- UI labels and console output
- Optional consistency checks (e.g., "unit named CLAMP but geometry says PIN")
- Operator navigation

To verify naming-free behavior, the unit builder includes a `--randomize-names` flag (future enhancement) that scrambles all node names and asserts the kinematic structure remains unchanged.

