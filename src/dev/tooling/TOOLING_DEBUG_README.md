# 9X_110_GEO Tooling Explorer & Attachment Analyzer

## Overview

This directory contains developer tools to analyze the large fixture model `9X_110_GEO.glb` together with its fitted-joints file `9X_110_GEO.json`. The tools provide:

1. **Scene Structure Analysis**: Inspect meshes, rigid clusters, and unit candidates
2. **Joint Visualization**: Overlay joints from JSON onto the 3D scene
3. **Geometric Attachment Discovery**: Find unit-to-base attachments using pure geometry (no name-based logic)

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

## Running the Debug Page

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the debug page in your browser:
   ```
   http://localhost:5173/debug/9x-110-tooling-debug.html
   ```
   (Adjust port/URL based on your Vite configuration)

3. The page will automatically load the GLB model and log an overview to the console.

## Console Commands

Once the page is loaded, you can use these commands in the browser console:

### `toolingDebug.logOverview()`
Logs a summary of the scene structure:
- Total mesh count
- Base clusters detected
- Unit candidates with cluster counts and volumes

### `await toolingDebug.overlayJoints()`
Loads joints from the JSON file and creates visual gizmos:
- **Green spheres + lines**: Prismatic joints
- **Red spheres + lines**: Hinge joints
- Spheres are placed at `FromVector`, lines extend to `ToVector`

To remove the overlay:
```js
toolingDebugOverlay.dispose();
```

### `toolingDebug.analyzeAttachments()`
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

- `ToolingConfig.ts`: Configuration with file paths
- `ToolingSceneExplorer.ts`: Scene structure analysis
- `ToolingJointOverlay.ts`: Joint visualization
- `UnitAttachmentAnalyzer.ts`: Geometric attachment discovery
- `debug/9x-110-tooling-debug.html`: Debug page HTML
- `debug/9x-110-tooling-debug.ts`: Debug page TypeScript

