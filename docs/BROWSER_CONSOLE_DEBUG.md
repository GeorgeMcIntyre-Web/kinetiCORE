# Browser Console Debugging Guide

## Quick Start

After loading a GLB file in kinetiCORE, open the browser console (F12) and use these commands:

### 0. Auto-Kinematics: Find Unit Pairs (⭐ RECOMMENDED FOR AUTO-KINEMATICS)

```javascript
// Find all UNIT_xxx nodes and their FIXED/MOVING pairs
window.debugTools.findUnitPairs()
```

**This is the PRIMARY tool for auto-kinematics setup!** It will:
- Scan for all UNIT_xxx nodes in the scene
- Find their FIXED/MOVING children using multiple strategies
- Calculate geometric similarity to validate pairs
- Export detailed JSON and Markdown reports

**Output Example:**
```
========================================
UNIT PAIR ANALYSIS
========================================
Total Units: 14
Units with Valid Pairs: 12
Units without Pairs: 2

PAIRS:
  ✅ UNIT_102: FIXED=FIXED, MOVING=MOVING (100%)
  ✅ UNIT_104: FIXED=FIXED, MOVING=MOVING (85%)
  ⚠️ UNIT_108: FIXED=PLATE, MOVING=NONE (50%)
  ❌ UNIT_128: FIXED=NONE, MOVING=NONE (0%)
========================================

✅ Exported: unit_pairs_2025-11-03T10-15-30.json
✅ Exported: unit_pairs_2025-11-03T10-15-30.md
```

**Then analyze specific units:**
```javascript
// Deep dive into a specific unit
window.debugTools.analyzeUnit('UNIT_118')
```

### 1. Show Help

```javascript
window.debugTools.help()
```

### 2. List All Nodes

```javascript
// List all nodes
window.debugTools.listNodes()

// Filter by pattern
window.debugTools.listNodes('UNIT')
```

### 3. Show Bounding Box

```javascript
// Show single node
window.debugTools.showBBox('UNIT_118_FIXED', 'green')

// Show multiple patterns
window.debugTools.showAllBBoxes('UNIT')

// Clear visualizations
window.debugTools.clearBBoxes()
```

### 4. Compare Two Nodes

```javascript
// Compare bounding boxes
window.debugTools.compareBBoxes('UNIT_118_FIXED', 'UNIT_118_MOVING')

// With custom threshold (90% default)
window.debugTools.compareBBoxes('UNIT_118_FIXED', 'UNIT_118_MOVING', 0.85)
```

Output:
```
========================================
BOUNDING BOX COMPARISON
========================================
Node 1: UNIT_118_FIXED
  Sorted Dims: [50.0, 100.0, 200.0] mm
  Volume: 1000000.0 mm³
  Center: (5.100, 2.050, 1.020) m

Node 2: UNIT_118_MOVING
  Sorted Dims: [50.0, 100.0, 200.0] mm
  Volume: 1000000.0 mm³
  Center: (5.250, 2.050, 1.020) m

Differences:
  Dim Diffs: [0.0, 0.0, 0.0] mm
  Vol Diff: 0.0 mm³
  Center Distance: 150.0 mm

Similarity: 100.0%
Match (threshold 90%): ✅ YES
========================================
```

### 5. Find All Pairs

```javascript
// Find all pairs with 90% similarity
window.debugTools.findPairs(0.90)

// More permissive (85% threshold)
window.debugTools.findPairs(0.85)
```

Output:
```
[BBoxDebug] Found 8 pairs with similarity >= 90%
  UNIT_118_FIXED ↔ UNIT_118_MOVING: 100.0%
  UNIT_112_FIXED ↔ UNIT_112_MOVING: 98.5%
  UNIT_124_RETRACTED ↔ UNIT_124_EXTENDED: 97.2%
  ...
```

### 6. Full GLB Analysis

```javascript
// Analyze entire GLB structure
await window.debugTools.analyzeGLB()
```

This will:
- Analyze all nodes and hierarchy
- Find potential pairs (name + geometry)
- Generate confidence scores
- Export JSON and Markdown reports
- Show recommendations

Output:
```
========================================
GLB ANALYSIS COMPLETE
========================================
Total Nodes: 150
Total Meshes: 75
Potential Pairs: 8

RECOMMENDATIONS:
  ✅ Strong naming convention detected (80% confidence). Recommend using NAME-BASED pairing.
  ✅ Found 8 high-confidence pairs (≥80%). These are excellent candidates for ICP.
  📍 Found 5 spatial clusters.
  📏 Found 4 dimension clusters.

TOP PAIRS:
  UNIT_118_FIXED ↔ UNIT_118_MOVING
    Confidence: 95%, Type: both
  UNIT_112_FIXED ↔ UNIT_112_MOVING
    Confidence: 90%, Type: both
========================================

✅ Exported: glb_analysis_2025-11-03T10-30-00.json
✅ Exported: glb_analysis_2025-11-03T10-30-00.md
```

---

## Complete API

### Setup

```javascript
// Scene is automatically set when SceneManager initializes
// Manual setup (if needed):
window.debugTools.setScene(scene)
```

### GLB Analysis

```javascript
// Analyze entire GLB
await window.debugTools.analyzeGLB('my_fixture.glb')

// Analyze specific node
await window.debugTools.analyzeNode('UNIT_118')
```

### Bounding Box Visualization

```javascript
// Show single box
window.debugTools.showBBox('NodeName', 'green')
// Colors: red, green, blue, yellow, magenta, cyan, white

// Show all matching pattern
window.debugTools.showAllBBoxes('UNIT')

// Compare two nodes
window.debugTools.compareBBoxes('Node1', 'Node2', 0.90)

// Find all pairs
window.debugTools.findPairs(0.90)

// Clear all visualizations
window.debugTools.clearBBoxes()
```

### Utilities

```javascript
// List nodes
window.debugTools.listNodes()          // All nodes
window.debugTools.listNodes('UNIT')    // Filter by pattern

// Get node info
window.debugTools.getNode('UNIT_118')

// Show help
window.debugTools.help()
```

---

## Typical Workflow

### 1. Load GLB File
- Upload GLB via UI
- Wait for loading to complete

### 2. Explore Structure
```javascript
// See what nodes are available
window.debugTools.listNodes()

// List nodes with specific pattern
window.debugTools.listNodes('UNIT')
```

### 3. Visual Inspection
```javascript
// Show bounding boxes for specific units
window.debugTools.showBBox('UNIT_118_FIXED', 'green')
window.debugTools.showBBox('UNIT_118_MOVING', 'red')

// Or show all at once
window.debugTools.showAllBBoxes('UNIT')
```

### 4. Compare Suspected Pairs
```javascript
// Compare two nodes
window.debugTools.compareBBoxes('UNIT_118_FIXED', 'UNIT_118_MOVING')
```

Check the output:
- **Similarity > 90%** → Excellent match, use for ICP
- **Similarity 75-90%** → Good match, may work
- **Similarity < 75%** → Poor match, probably wrong pairing

### 5. Find All Pairs
```javascript
// Automated pair finding
window.debugTools.findPairs(0.90)
```

This will find ALL pairs with geometric similarity ≥ 90%.

### 6. Full Analysis
```javascript
// Complete analysis with recommendations
await window.debugTools.analyzeGLB()
```

Download the exported JSON/Markdown for documentation.

### 7. Clean Up
```javascript
// Clear bounding box visualizations
window.debugTools.clearBBoxes()
```

---

## Understanding Bounding Box Comparison

### Sorted Dimensions
Bounding boxes are compared using **sorted dimensions** (rotation-invariant):

```
Original box: 200mm (X) × 50mm (Y) × 100mm (Z)
Sorted dims:  [50, 100, 200]  ← Always smallest to largest

This allows matching regardless of rotation!
```

### Similarity Score
```
similarity = 0.8 × dimension_similarity + 0.2 × volume_similarity

dimension_similarity =
  (1 - |dim1[0] - dim2[0]| / max(dim1[0], dim2[0])) ×
  (1 - |dim1[1] - dim2[1]| / max(dim1[1], dim2[1])) ×
  (1 - |dim1[2] - dim2[2]| / max(dim1[2], dim2[2]))

volume_similarity = 1 - |vol1 - vol2| / max(vol1, vol2)
```

**Thresholds:**
- **≥ 0.95 (95%)** → Very high confidence, almost identical
- **0.85-0.95 (85-95%)** → High confidence, good match
- **0.75-0.85 (75-85%)** → Moderate confidence, may work
- **< 0.75 (< 75%)** → Low confidence, likely wrong pairing

### Why This Works
Two states of the same part (FIXED vs MOVING) will have:
- ✅ **Same dimensions** (within manufacturing tolerance)
- ✅ **Same volume**
- ✅ **Different positions** (that's okay, we compare dimensions not positions)

---

## Troubleshooting

### "No scene set" Error
```
[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.
```

**Solution:** Scene should auto-set when SceneManager initializes. If not:
```javascript
const scene = window.BABYLON.EngineStore._LastCreatedScene;
window.debugTools.setScene(scene);
```

### Node Not Found
```
[BBoxDebug] Node not found: UNIT_XXX
```

**Solution:** List all nodes to find correct name:
```javascript
window.debugTools.listNodes('UNIT')
```

### No Geometry
```
[BBoxDebug] No geometry found for node: UNIT_XXX
```

**Cause:** Node has no child meshes (it's a container/folder).

**Solution:** Find the child nodes with actual geometry:
```javascript
window.debugTools.listNodes('UNIT_XXX')
// Look for nodes with 📦 icon (has meshes)
```

### Wrong Pairs Detected
If automated pair finding returns unexpected results:

1. **Check similarity threshold:**
   ```javascript
   window.debugTools.findPairs(0.95)  // More strict
   ```

2. **Manual comparison:**
   ```javascript
   window.debugTools.compareBBoxes('SuspectedNode1', 'SuspectedNode2')
   ```

3. **Visual inspection:**
   ```javascript
   window.debugTools.showAllBBoxes('UNIT')
   // Look at the visualized boxes in the scene
   ```

---

## Advanced Usage

### Get Raw Node Reference
```javascript
const node = window.debugTools.getNode('UNIT_118');
console.log(node);

// Access Babylon properties
console.log(node.position);
console.log(node.getChildMeshes());
```

### Combine with Other Tools
```javascript
// 1. Find pairs
window.debugTools.findPairs(0.90);

// 2. Pick a high-confidence pair
window.debugTools.compareBBoxes('UNIT_118_FIXED', 'UNIT_118_MOVING');

// 3. If good, run full analysis
await window.debugTools.analyzeGLB();

// 4. Run auto-kinematics pipeline
await window.testAutoKinematics();
```

### Batch Testing Multiple Thresholds
```javascript
// Test different thresholds
for (const threshold of [0.95, 0.90, 0.85, 0.80, 0.75]) {
  console.log(`\n=== Threshold: ${threshold} ===`);
  window.debugTools.findPairs(threshold);
}
```

---

## Examples

### Example 1: Quick Pair Check
```javascript
// Load GLB via UI, then:
window.debugTools.listNodes('UNIT');
window.debugTools.compareBBoxes('UNIT_118_FIXED', 'UNIT_118_MOVING');
// Check similarity score in console output
```

### Example 2: Visual Debug
```javascript
// Show all unit bounding boxes in different colors
window.debugTools.showAllBBoxes('UNIT');
// Visually inspect in 3D scene
// Clear when done
window.debugTools.clearBBoxes();
```

### Example 3: Full Analysis Workflow
```javascript
// 1. List all nodes
window.debugTools.listNodes();

// 2. Find pairs automatically
window.debugTools.findPairs(0.90);

// 3. Visual inspection of top pair
window.debugTools.showBBox('UNIT_118_FIXED', 'green');
window.debugTools.showBBox('UNIT_118_MOVING', 'red');

// 4. Detailed comparison
window.debugTools.compareBBoxes('UNIT_118_FIXED', 'UNIT_118_MOVING');

// 5. Full GLB analysis
await window.debugTools.analyzeGLB();

// 6. Clean up
window.debugTools.clearBBoxes();
```

---

## Files Exported

When you run `analyzeGLB()`, two files are auto-downloaded:

### 1. JSON Report
**Filename:** `glb_analysis_YYYY-MM-DDTHH-MM-SS.json`

Contains:
- Complete node hierarchy
- Geometric signatures
- Naming patterns
- Potential pairs with confidence scores
- Statistics
- Recommendations

**Use for:**
- Programmatic processing
- Machine learning training data
- Archival/documentation

### 2. Markdown Report
**Filename:** `glb_analysis_YYYY-MM-DDTHH-MM-SS.md`

Contains:
- Human-readable summary
- Top potential pairs
- Detected naming patterns
- Spatial/dimension clusters
- Recommendations

**Use for:**
- Quick review
- Documentation
- Sharing with team

---

## Integration with Auto-Kinematics

After analysis, use the results to inform pipeline configuration:

```javascript
// 1. Analyze GLB
await window.debugTools.analyzeGLB();

// 2. Check console recommendations
// If "Strong naming convention" → use name-based
// If "Weak naming convention" → use geometry-based

// 3. Run auto-kinematics with recommended method
// (See AUTO_KINEMATICS_README.md for pipeline usage)
```

---

**Last Updated:** 2025-11-03
**Owner:** George (Agent 1 - Claude Code)
