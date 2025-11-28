# Tooling Units V2 Algorithm

**Version:** 2.0.0  
**Last Updated:** 2025-01-XX  
**Algorithm:** Hierarchical Point-Cloud Based Unit Detection

---

## Overview

The Tooling Units V2 pipeline automatically detects **tooling units** (coherent subassemblies) and **joint pairs** within those units using hierarchical point cloud analysis. This is a geometry-driven approach that does not rely on naming conventions or external metadata.

---

## Algorithm Description

### Phase 1: Unit Detection

The unit detection algorithm uses a **hierarchical traversal** approach:

1. **Point Cloud Generation**
   - For each node in the tooling structure tree, generate a sparse point cloud
   - Sample mesh vertices (with configurable stride and max points)
   - Compute bounding box and centroid for each node

2. **Hierarchical Traversal**
   - Traverse the structure tree from root downward, level by level
   - At each level, identify clusters of nodes based on spatial relationships
   - Nodes are clustered if they:
     - Have overlapping bounding boxes (overlap ratio > threshold)
     - Have centroids within minimum distance threshold

3. **Unit Candidate Selection**
   - A cluster becomes a candidate unit if:
     - It is not equal to the entire root assembly
     - It is not a strict superset of an already accepted unit
     - It has sufficient volume (above minimum threshold)
     - It is compact (size ratio < maxUnitSizeRatio relative to root)

4. **Output**
   - List of detected units, each with:
     - Unit ID
     - List of node IDs belonging to the unit
     - Bounding box and centroid for debugging

### Phase 2: Joint Pair Detection

Within each detected unit, the algorithm identifies **joint pairs** (moving node + mate):

1. **Feature Computation**
   - For each node in the unit, compute:
     - Centroid
     - Bounding box
     - Level coordinate (projection along level axis, default Z-up)
     - Main axis (longest bbox dimension or precomputed)

2. **Candidate Pair Generation**
   - For each unordered pair of nodes:
     - Check level difference (must be < threshold)
     - Check 2D overlap in plane perpendicular to level axis
     - Reject if overlap is too low

3. **Pair Scoring**
   - For each candidate pair, compute:
     - **Gap along axis**: Distance between point clouds along estimated clamp axis
     - **2D Overlap**: Projected overlap in plane perpendicular to axis
     - **Orientation compatibility**: How well main axes align with clamp axis
     - **Size similarity**: Ratio of node sizes
   - Combine into a single score using weighted sum

4. **Filtering & Ranking**
   - Reject pairs with:
     - Gap outside acceptable range
     - One node too small (tiny bolts/screws)
     - Size ratio too large
   - Sort by score and keep top N pairs per unit

---

## Configuration Parameters

### Unit Detection Options

- `minPointsPerNode`: Minimum point count per node (default: 10)
- `maxPointsPerNode`: Maximum points to sample per node (default: 5000)
- `minVolume`: Minimum bbox volume in m³ (default: 0.0001 = 1 cm³)
- `maxDepth`: Maximum tree depth to search (default: 20)
- `overlapThreshold`: Overlap ratio for clustering (default: 0.1)
- `minCentroidDistance`: Minimum distance between unit centroids in meters (default: 0.01 = 10mm)
- `maxUnitSizeRatio`: Maximum size ratio relative to root (default: 0.95)

### Joint Pair Detection Options

- `levelAxis`: Level axis vector (default: Z-up `{x: 0, y: 0, z: 1}`)
- `maxLevelDifference`: Maximum level difference as fraction of unit height (default: 0.1)
- `minOverlapRatio`: Minimum 2D overlap ratio (default: 0.3)
- `minGap`: Minimum gap along axis in meters (default: 0.001 = 1mm)
- `maxGap`: Maximum gap along axis in meters (default: 0.1 = 100mm)
- `minNodeSize`: Minimum node size (bbox diagonal) in meters (default: 0.005 = 5mm)
- `maxSizeRatio`: Maximum size ratio between nodes in a pair (default: 50)
- `minScore`: Minimum score threshold (default: 0.3)
- `maxPairsPerUnit`: Maximum pairs to return per unit (default: 4)

---

## Usage

### Basic Usage

```typescript
import { runUnitsV2Pipeline } from './domain/tooling';
import { buildToolingStructureFromScene, buildGeometryIndex } from './domain/tooling/babylonAdapter';

// Load tooling from GLB
const structure = buildToolingStructureFromScene(scene, rootNode);
const geometryIndex = await buildGeometryIndex(structure, scene);

// Run pipeline
const output = runUnitsV2Pipeline(structure, geometryIndex, {
  unitDetection: {
    minVolume: 0.0001,
    maxDepth: 20,
  },
  jointPairDetection: {
    minOverlapRatio: 0.3,
    maxPairsPerUnit: 4,
  },
  includeJointPairs: true,
});

// Save to JSON
const json = JSON.stringify(output, null, 2);
fs.writeFileSync('9X_110_GEO.units-v2.json', json);
```

### Diagnostic Script

```bash
# Print point cloud tree for a tooling fixture
npx tsx scripts/printToolingPointCloudTree.ts 9X_110_GEO
```

---

## Output Format

The pipeline generates a `units-v2.json` file with the following structure:

```json
{
  "units": [
    {
      "unitId": "unit_node123",
      "nodeIds": ["node123", "node124", "node125"],
      "bbox": {
        "min": { "x": 0, "y": 0, "z": 0 },
        "max": { "x": 1, "y": 1, "z": 1 }
      },
      "centroid": { "x": 0.5, "y": 0.5, "z": 0.5 },
      "jointPairs": [
        {
          "nodeAId": "node123",
          "nodeBId": "node124",
          "score": 0.85,
          "axis": { "x": 1, "y": 0, "z": 0 },
          "gap": 0.005,
          "overlapRatio": 0.75
        }
      ]
    }
  ],
  "metadata": {
    "detectionAlgorithm": "hierarchical-point-cloud-v2",
    "version": "2.0.0",
    "timestamp": "2025-01-XXT..."
  }
}
```

---

## Limitations & Future Improvements

### Current Limitations

1. **Level Axis Assumption**: Defaults to Z-up. Fails if clamp axis is diagonal and we always assume global Z.
2. **Point Cloud Sampling**: Uses simple vertex subsampling. Could benefit from more sophisticated sampling (e.g., surface sampling).
3. **No Motion Detection**: Does not detect actual motion between states. Requires manual state capture or precomputed features.
4. **Threshold Tuning**: Many thresholds are hardcoded defaults. May need tuning for different fixture types.

### Future Improvements

1. **Precomputed Features**: Support for external tool (JT/Process Simulate) precomputed features:
   - Mass centers
   - Dominant axes (PCA)
   - Nominal clamp axes
   - Contact patches

2. **Adaptive Thresholds**: Learn thresholds from training data or fixture metadata.

3. **Motion Integration**: Integrate with state capture to detect actual motion between retracted/extended states.

4. **Nested Units**: Support for nested units (sub-units within units).

5. **Multi-Axis Detection**: Detect clamp axes that are not aligned with global axes.

---

## Testing

Run unit tests:

```bash
npm test -- tooling-units-v2
# or
npm test -- tests/domain/tooling
```

Test files:
- `tests/domain/tooling/unitDetection.test.ts`
- `tests/domain/tooling/jointPairDetection.test.ts`

---

## Code Style

- **Guard clauses**: All functions use early returns for invalid inputs
- **No else/elseif**: Avoided throughout
- **Shallow nesting**: Maximum 2 levels of nesting
- **Pure domain**: No Babylon/WebGPU dependencies in domain layer
- **Composable functions**: Small, focused functions that can be tested independently


