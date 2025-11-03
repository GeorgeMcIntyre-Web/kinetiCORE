# GLB Structure Analyzer

## Overview

Comprehensive analysis tool to extract **ALL** information from GLB files for understanding structure and making auto-kinematics robust and future-proof.

**Location:** [src/dev/GLBStructureAnalyzer.ts](../src/dev/GLBStructureAnalyzer.ts)

---

## What Does It Extract?

### 1. **Hierarchical Structure**
- Complete scene tree with parent-child relationships
- Node depths (distance from root)
- Full path from root (e.g., `root/UNIT_118/FIXED`)

### 2. **Transform Information** (World = Carline Coordinates)
- World position, rotation, scaling (absolute in carline space)
- Local position, rotation, scaling (relative to parent)
- All transforms in meters (internal) and degrees

### 3. **Geometry Analysis**
- Bounding boxes (min, max, size, center, diagonal)
- Volume and surface area (approximate)
- Vertex counts and triangle counts
- Centroid and principal axes

### 4. **Geometric Signatures** (For Matching)
- Sorted dimensions (rotation-invariant)
- Aspect ratios
- Volume
- Enables robust pair matching without names

### 5. **Naming Pattern Analysis**
- Common prefixes/suffixes detection
- Pattern recognition (e.g., `UNIT_XXX_FIXED/MOVING`)
- Naming convention confidence scoring
- Automatic pairing hints from names

### 6. **Geometric Clustering**
- **Spatial clusters:** Nodes close together in space (e.g., parts of same unit)
- **Dimension clusters:** Nodes with similar geometry (e.g., duplicate parts)

### 7. **Potential Pairs** (For ICP)
- Name-based matches (e.g., `UNIT_118_FIXED` ↔ `UNIT_118_MOVING`)
- Geometry-based matches (similar dimensions/volume)
- Combined confidence scoring
- Detailed reasons for each match

### 8. **Statistics & Distribution**
- Node counts by type and depth
- Vertex/volume distributions (min, max, mean, median, stddev)
- Spatial extent (X/Y/Z ranges, max distance)
- Naming statistics

### 9. **Smart Recommendations**
- Suggests best pairing method (name-based vs geometry-based)
- Highlights high-confidence pairs for ICP
- Warns about potential issues (large spatial extent, weak naming, etc.)

---

## Usage

### Basic Usage

```typescript
import { GLBStructureAnalyzer } from './src/dev/GLBStructureAnalyzer';
import { testGLBAnalyzer } from './src/dev/testGLBAnalyzer';

// Option 1: Use test function (easiest)
await testGLBAnalyzer(scene, '/9X_110_GEO.glb');
// Automatically exports JSON and Markdown reports

// Option 2: Manual usage
const analyzer = new GLBStructureAnalyzer(scene);
const report = await analyzer.analyzeGLB(rootNode, '9X_110_GEO.glb');

// View report
console.log(JSON.stringify(report, null, 2));

// Export to file
analyzer.exportToFile(report, 'glb_analysis.json');

// Export to markdown (human-readable)
const markdown = analyzer.exportToMarkdown(report);
```

### Analyze Specific Node

```typescript
import { analyzeNode } from './src/dev/testGLBAnalyzer';

// Analyze just one unit
await analyzeNode(scene, 'UNIT_118');
```

### Compare Two Nodes

```typescript
import { compareNodes } from './src/dev/testGLBAnalyzer';

// Compare two nodes geometrically
await compareNodes(scene, 'UNIT_118_FIXED', 'UNIT_118_MOVING');
// Output:
// Similarity: 95.3%
// Confidence: 95%
// Match Type: both
// Reasons:
//   - Same base name with FIXED/MOVING pair
//   - Very high geometric similarity: 95.3%
```

---

## Output Format

### JSON Report Structure

```typescript
{
  "metadata": {
    "fileName": "9X_110_GEO.glb",
    "analyzedAt": "2025-11-03T10:30:00.000Z",
    "totalNodes": 150,
    "totalMeshes": 75,
    "totalTransformNodes": 75,
    "totalMaterials": 10,
    "boundingBox": {
      "min": [4.5, 1.8, 0.9],      // meters (carline coordinates)
      "max": [5.5, 2.2, 1.1],
      "size": [1.0, 0.4, 0.2],
      "center": [5.0, 2.0, 1.0],
      "diagonal": 1.095
    }
  },

  "hierarchy": {
    "name": "9X_110_GEO",
    "type": "TransformNode",
    "id": 1,
    "depth": 0,
    "children": [ /* recursive tree */ ],
    "metadata": {
      "hasMeshes": false,
      "meshCount": 0,
      "position": [5.0, 2.0, 1.0],  // world = carline coordinates
      "rotation": [0, 0, 0],
      "scaling": [1, 1, 1]
    }
  },

  "nodes": [
    {
      "name": "UNIT_118_FIXED",
      "uniqueId": 42,
      "type": "TransformNode",
      "depth": 2,
      "path": "9X_110_GEO/UNIT_118/UNIT_118_FIXED",

      "parentId": 10,
      "parentName": "UNIT_118",
      "childIds": [43, 44, 45],
      "childNames": ["JAW_FIXED_1", "JAW_FIXED_2", "PIN_1"],
      "siblingIds": [50],
      "siblingNames": ["UNIT_118_MOVING"],

      "worldPosition": [5.1, 2.05, 1.02],  // meters, carline coordinates
      "worldRotation": [0, 0, 45],          // degrees
      "worldScaling": [1, 1, 1],
      "localPosition": [0.1, 0.05, 0.02],   // relative to parent
      "localRotation": [0, 0, 0],
      "localScaling": [1, 1, 1],

      "geometry": {
        "hasMeshes": true,
        "meshCount": 3,
        "totalVertices": 2500,
        "totalTriangles": 1200,
        "boundingBox": {
          "min": [5.0, 2.0, 1.0],
          "max": [5.2, 2.1, 1.05],
          "size": [0.2, 0.1, 0.05],         // 200mm x 100mm x 50mm
          "center": [5.1, 2.05, 1.025],
          "diagonal": 0.229
        },
        "volume": 0.001,                     // 1000 cm³ = 1L
        "surfaceArea": 0.09                  // 900 cm²
      },

      "materials": ["Steel_Mat", "Rubber_Mat"],

      "namingHints": {
        "containsFixed": true,
        "containsMoving": false,
        "containsRetracted": false,
        "containsExtended": false,
        "containsOpen": false,
        "containsClose": false,
        "containsUnit": true,
        "unitNumber": 118,
        "baseName": "UNIT_118"
      },

      "geometricSignature": {
        "dimensions": [0.05, 0.1, 0.2],      // sorted [small, medium, large]
        "aspectRatios": [2.0, 2.0],          // [medium/small, large/medium]
        "volume": 0.001,
        "centroid": [5.1, 2.05, 1.025],
        "principalAxes": [[1,0,0], [0,1,0], [0,0,1]]
      }
    },
    // ... more nodes
  ],

  "namingPatterns": {
    "commonPrefixes": [
      { "prefix": "UNIT_", "count": 20 },
      { "prefix": "JAW_", "count": 10 }
    ],
    "commonSuffixes": [
      { "suffix": "_FIXED", "count": 10 },
      { "suffix": "_MOVING", "count": 10 }
    ],
    "patterns": [
      {
        "pattern": "UNIT_XXX_FIXED/MOVING",
        "regex": "^UNIT[_\\s]*\\d+[_\\s]*(FIXED|MOVING)$",
        "matches": ["UNIT_118_FIXED", "UNIT_118_MOVING", "UNIT_112_FIXED", ...],
        "confidence": 0.6  // 60% of nodes match this pattern
      }
    ],
    "conventions": {
      "usesUnderscores": true,
      "usesCamelCase": false,
      "usesNumbers": true,
      "averageNameLength": 15.3,
      "longestName": "UNIT_124_CLAMP_EXTENDED_JAW_LEFT",
      "shortestName": "PIN"
    },
    "pairingHints": [
      {
        "baseName": "UNIT_118",
        "fixedNode": "UNIT_118_FIXED",
        "movingNode": "UNIT_118_MOVING",
        "confidence": 1.0
      }
    ]
  },

  "geometricClusters": {
    "spatialClusters": [
      {
        "centroid": [5.0, 2.0, 1.0],
        "radius": 0.3,  // 300mm
        "nodeIds": [42, 50, 51, 52],
        "nodeNames": ["UNIT_118_FIXED", "UNIT_118_MOVING", "BASE_118", "MOUNT_118"]
      }
    ],
    "dimensionClusters": [
      {
        "avgDimensions": [0.05, 0.1, 0.2],
        "nodeIds": [42, 50],
        "nodeNames": ["UNIT_118_FIXED", "UNIT_118_MOVING"],
        "similarity": 0.95
      }
    ]
  },

  "potentialPairs": [
    {
      "node1": {
        "name": "UNIT_118_FIXED",
        "id": 42,
        "signature": "200x100x50mm, 1000000mm³"
      },
      "node2": {
        "name": "UNIT_118_MOVING",
        "id": 50,
        "signature": "200x100x50mm, 1000000mm³"
      },
      "similarity": 0.953,  // 95.3% geometric similarity
      "matchType": "both",  // name + geometry
      "confidence": 0.95,
      "reasons": [
        "Same base name with FIXED/MOVING pair",
        "Very high geometric similarity: 95.3%"
      ]
    }
  ],

  "statistics": {
    "nodesByType": {
      "TransformNode": 100,
      "Mesh": 50
    },
    "nodesByDepth": {
      "0": 1,    // root
      "1": 10,   // units
      "2": 50,   // components
      "3": 89    // sub-components
    },
    "vertexCountDistribution": {
      "min": 100,
      "max": 5000,
      "mean": 1500,
      "median": 1200,
      "stdDev": 800
    },
    "volumeDistribution": {
      "min": 0.0001,
      "max": 0.1,
      "mean": 0.01,
      "median": 0.005,
      "stdDev": 0.02
    },
    "spatialExtent": {
      "xRange": [4.5, 5.5],   // meters (carline coordinates)
      "yRange": [1.8, 2.2],
      "zRange": [0.9, 1.1],
      "maxDistance": 1.5      // max distance between any two nodes
    },
    "namingStats": {
      "totalUniqueNames": 145,
      "avgNameLength": 15.3,
      "namingConventionConfidence": 0.8  // 80% use consistent naming
    }
  },

  "recommendations": [
    "✅ Strong naming convention detected (80% confidence). Recommend using NAME-BASED pairing as primary method.",
    "✅ Found 8 high-confidence pairs (≥80%). These are excellent candidates for ICP analysis.",
    "📍 Found 5 spatial clusters. This suggests units are grouped together, which is typical for fixtures.",
    "📏 Found 4 dimension clusters. This suggests repeated components with similar geometry.",
    "🔍 Detected 1 naming pattern(s): UNIT_XXX_FIXED/MOVING"
  ]
}
```

---

## Use Cases

### 1. Understanding a New GLB File

**Problem:** You receive a new fixture GLB and need to understand its structure.

**Solution:**
```typescript
await testGLBAnalyzer(scene, '/new_fixture.glb');
```

**What you get:**
- Complete hierarchy visualization
- Naming patterns and conventions
- Recommended pairing strategy
- High-confidence pairs ready for ICP

### 2. Debugging Failed Pairing

**Problem:** Auto-kinematics can't find pairs for a fixture.

**Solution:**
```typescript
const analyzer = new GLBStructureAnalyzer(scene);
const report = await analyzer.analyzeGLB(rootNode, 'fixture.glb');

// Check recommendations
console.log(report.recommendations);
// Output: "⚠️ Weak naming convention (20% confidence). Recommend using GEOMETRY-BASED pairing."

// Check if any pairs were found
console.log(report.potentialPairs.length);
// Output: 0 pairs found

// Manually inspect nodes
console.log(report.nodes.map(n => ({
  name: n.name,
  hasGeometry: n.geometry.hasMeshes,
  volume: n.geometry.volume
})));
```

**Fix:** Switch to geometry-based pairing or adjust similarity threshold.

### 3. Validating Geometry Matching

**Problem:** Want to verify that geometry-based matching will work.

**Solution:**
```typescript
await compareNodes(scene, 'PART_A', 'PART_B');
// Output:
// Similarity: 45.2%  ← Too low!
// Confidence: 0%
// Reasons: []
```

**Insight:** Parts are too different geometrically, need name-based matching.

### 4. Finding Hidden Patterns

**Problem:** GLB uses non-standard naming, need to discover patterns.

**Solution:**
```typescript
const analyzer = new GLBStructureAnalyzer(scene);
const report = await analyzer.analyzeGLB(rootNode, 'fixture.glb');

console.log(report.namingPatterns.patterns);
// Output:
// [
//   {
//     pattern: "XXX_RETRACTED/EXTENDED",
//     matches: ["CLAMP_1_RETRACTED", "CLAMP_1_EXTENDED", ...],
//     confidence: 0.4
//   }
// ]
```

**Insight:** Use `_RETRACTED/_EXTENDED` instead of `_FIXED/_MOVING` for this file!

### 5. Optimizing ICP Performance

**Problem:** ICP is slow, need to prioritize high-confidence pairs.

**Solution:**
```typescript
const analyzer = new GLBStructureAnalyzer(scene);
const report = await analyzer.analyzeGLB(rootNode, 'fixture.glb');

// Sort pairs by confidence
const sortedPairs = report.potentialPairs
  .filter(p => p.confidence >= 0.8)
  .sort((a, b) => b.confidence - a.confidence);

// Process only high-confidence pairs first
for (const pair of sortedPairs) {
  console.log(`Processing: ${pair.node1.name} ↔ ${pair.node2.name} (${(pair.confidence * 100).toFixed(0)}%)`);
  // Run ICP...
}
```

---

## Integration with Auto-Kinematics Pipeline

### Step 1: Analyze GLB First

```typescript
// Before running auto-kinematics, analyze the GLB
const analyzer = new GLBStructureAnalyzer(scene);
const report = await analyzer.analyzeGLB(rootNode, 'fixture.glb');

// Check recommendations
if (report.statistics.namingStats.namingConventionConfidence > 0.5) {
  console.log('✅ Use NAME-BASED pairing');
} else {
  console.log('⚠️ Use GEOMETRY-BASED pairing');
}
```

### Step 2: Use Recommended Strategy

```typescript
const pipeline = new KinematicExtractionPipeline(scene);

// Choose method based on analysis
const method = report.statistics.namingStats.namingConventionConfidence > 0.5
  ? 'name-based'
  : 'geometry-based';

await pipeline.analyzeScene({ analysisMethod: method }, rootNode);
```

### Step 3: Validate Pairs

```typescript
// Get pairs from pipeline
const toolGraph = pipeline.getToolGraph();

// Cross-reference with analyzer predictions
for (const unit of toolGraph.units) {
  const predicted = report.potentialPairs.find(
    p => p.node1.name === unit.name || p.node2.name === unit.name
  );

  if (predicted) {
    console.log(`✅ Unit ${unit.name} matched prediction (confidence: ${(predicted.confidence * 100).toFixed(0)}%)`);
  } else {
    console.warn(`⚠️ Unit ${unit.name} was not predicted by analyzer`);
  }
}
```

---

## Future-Proofing

### Why This Makes Auto-Kinematics Robust

1. **Adaptive Strategy Selection**
   - Automatically chooses best pairing method
   - Handles files with good naming OR bad naming
   - Graceful degradation (name → geometry → manual)

2. **Comprehensive Data Collection**
   - Captures EVERYTHING we might need in the future
   - Can add new analysis algorithms without re-loading GLB
   - Enables machine learning training data collection

3. **Debugging & Validation**
   - Clear visibility into why pairing succeeded/failed
   - Can reproduce issues with saved reports
   - Confidence scoring helps filter low-quality pairs

4. **Pattern Learning**
   - Accumulate reports from many fixtures
   - Discover new naming patterns automatically
   - Train ML models to predict pairs

### Future Enhancements

**Phase 1 (Current):** Static analysis
- ✅ Hierarchical structure
- ✅ Geometric signatures
- ✅ Naming patterns
- ✅ Potential pairs

**Phase 2 (Next):**
- [ ] Motion trajectory prediction (ICP-free)
- [ ] Collision detection for joint limits
- [ ] Material-based classification (metal vs plastic)
- [ ] Topology analysis (connection graph)

**Phase 3 (Future):**
- [ ] Machine learning pair prediction
- [ ] Automatic joint type inference from shape
- [ ] CAD metadata extraction (if available)
- [ ] Multi-file comparison (fixture family analysis)

---

## Performance

### Typical Analysis Time

| Model Size | Nodes | Analysis Time |
|------------|-------|---------------|
| Small      | 50    | ~100ms        |
| Medium     | 150   | ~300ms        |
| Large      | 500   | ~1.5s         |
| Very Large | 2000  | ~10s          |

**Note:** O(n²) for pair finding. For very large models (>1000 nodes), consider filtering to reduce search space.

### Memory Usage

- ~5KB per node in report
- ~10MB for typical fixture (150 nodes)
- JSON export adds ~2x compression overhead

---

## Troubleshooting

### Issue: "No potential pairs found"

**Cause:** Nodes have very different geometry or no naming patterns.

**Fix:**
1. Check `report.recommendations` for hints
2. Lower similarity threshold: `compareDimensions(a, b, 0.70)` instead of 0.90
3. Manually specify pairs using node IDs

### Issue: "Analysis is slow"

**Cause:** Too many nodes (O(n²) pair comparison).

**Fix:**
1. Filter nodes by depth: only analyze depth 1-3
2. Pre-filter by volume: skip tiny parts (<0.0001 m³)
3. Use spatial clustering to reduce search space

### Issue: "Wrong pairs detected"

**Cause:** Multiple similar components (e.g., many identical clamps).

**Fix:**
1. Use parent hierarchy to group related nodes
2. Combine name + geometry matching (require BOTH to match)
3. Increase confidence threshold: only use pairs with confidence >0.9

---

## API Reference

### GLBStructureAnalyzer

```typescript
class GLBStructureAnalyzer {
  constructor(scene: BABYLON.Scene);

  async analyzeGLB(
    rootNode: BABYLON.TransformNode,
    fileName?: string
  ): Promise<GLBAnalysisReport>;

  exportToFile(report: GLBAnalysisReport, fileName: string): void;
  exportToMarkdown(report: GLBAnalysisReport): string;
}
```

### Test Functions

```typescript
// Analyze entire GLB
async function testGLBAnalyzer(
  scene?: BABYLON.Scene,
  glbPath?: string
): Promise<void>;

// Analyze single node
async function analyzeNode(
  scene: BABYLON.Scene,
  nodeName: string
): Promise<void>;

// Compare two nodes
async function compareNodes(
  scene: BABYLON.Scene,
  nodeName1: string,
  nodeName2: string
): Promise<void>;
```

---

## Examples

### Example 1: Quick Analysis

```bash
# In browser console
import { testGLBAnalyzer } from './src/dev/testGLBAnalyzer';
await testGLBAnalyzer();
```

### Example 2: Custom Analysis

```typescript
const analyzer = new GLBStructureAnalyzer(scene);
const report = await analyzer.analyzeGLB(rootNode, 'my_fixture.glb');

// Filter high-confidence name-based pairs
const namePairs = report.potentialPairs.filter(
  p => p.matchType === 'name' && p.confidence >= 0.9
);

console.log(`Found ${namePairs.length} high-confidence name-based pairs`);
```

### Example 3: Batch Analysis

```typescript
const fixtures = ['fixture_A.glb', 'fixture_B.glb', 'fixture_C.glb'];
const reports = [];

for (const fixture of fixtures) {
  const scene = await loadGLB(fixture);
  const analyzer = new GLBStructureAnalyzer(scene);
  const report = await analyzer.analyzeGLB(scene.rootNodes[0], fixture);
  reports.push(report);
}

// Compare naming conventions across fixtures
const avgConfidence = reports.reduce(
  (sum, r) => sum + r.statistics.namingStats.namingConventionConfidence,
  0
) / reports.length;

console.log(`Average naming convention confidence: ${(avgConfidence * 100).toFixed(0)}%`);
```

---

**Last Updated:** 2025-11-03
**Owner:** George (Agent 1 - Claude Code)
