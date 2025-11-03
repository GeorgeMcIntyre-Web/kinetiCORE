# Auto-Kinematics System - README

## Quick Start

This folder contains complete documentation for the ICP-based auto-kinematics system.

---

## 🚨 IMPORTANT: Container Node Fallacy (CNF)

**READ THIS FIRST** to avoid the #1 mistake when working with GLB hierarchies!

❌ **WRONG (CNF):**
```typescript
const fixed = unit.getChild('FIXED');
const bbox = fixed.getBoundingInfo(); // ← EMPTY! 0 meshes!
```

✅ **CORRECT:**
```typescript
const fixed = unit.getChild('FIXED');
const meshes = fixed.getChildMeshes(true); // ← Get ALL descendants!
const bbox = calculateBoundingBox(meshes);
```

**Why:** Nodes like "FIXED", "MOVING", "LH", "RH" are organizational containers with 0 meshes. Real geometry is nested deeper.

**See:** [HANDOFF_UNIT_112_108_DEBUG.md](HANDOFF_UNIT_112_108_DEBUG.md) for detailed CNF explanation.

---

## 📚 Documentation Index

### 0. **[HANDOFF_UNIT_112_108_DEBUG.md](HANDOFF_UNIT_112_108_DEBUG.md)** 🆕 UNIT_112 & 108 TESTING
   **Comprehensive guide for debugging specific units**

   **Contents:**
   - Container Node Fallacy (CNF) explained
   - UNIT_112 structure analysis (2 revolute joints)
   - UNIT_108 testing workflow (2 prismatic joints)
   - Tool usage: Unit112Debugger, Unit112PairFinder
   - Integration with joint-extraction.ts
   - Complete testing checklist
   - Known issues and fixes

   **Who should read:** Anyone testing UNIT_112 or UNIT_108, or debugging pair finding

   **Usage:**
   ```javascript
   window.debugTools.debugUnit112()       // Structure analysis
   window.debugTools.findUnit112Pairs()   // Geometry-based pairing
   ```

### 1. **[AUTO_KINEMATICS_COMPLETE_PLAN.md](AUTO_KINEMATICS_COMPLETE_PLAN.md)** ⭐ START HERE
   **Complete technical specification and implementation plan**

   **Contents:**
   - Five-stage algorithm walkthrough (hierarchical pairing → ICP → joint extraction)
   - Mathematical formulas (ICP rigid transform, 3-point circle fitting, rotation decomposition)
   - Coordinate system clarification (world = carline)
   - Joint gizmo placement in parent's local frame
   - Geometric improvements (multi-state ICP, coarse-to-fine, validation)
   - 5-week implementation roadmap
   - Testing strategy
   - Known limitations and future work

   **Who should read:** Anyone implementing or debugging auto-kinematics

---

### 2. **[GLB_ANALYSIS_TOOL.md](GLB_ANALYSIS_TOOL.md)** 🔍 ANALYSIS TOOL
   **GLB Structure Analyzer - Extract everything from a GLB file**

   **Contents:**
   - Comprehensive GLB analysis (hierarchy, geometry, naming, clustering)
   - Automatic pair detection (name-based + geometry-based)
   - Confidence scoring and recommendations
   - JSON/Markdown export
   - Integration with auto-kinematics pipeline

   **Who should read:** Anyone working with new GLB files or debugging pairing issues

   **Usage:**
   ```typescript
   import { testGLBAnalyzer } from './src/dev/testGLBAnalyzer';
   await testGLBAnalyzer(scene, '/9X_110_GEO.glb');
   ```

---

### 3. **[COORDINATE_SYSTEM.md](../COORDINATE_SYSTEM.md)** 📐 COORDINATE REFERENCE
   **kinetiCORE coordinate system standard**

   **Contents:**
   - Z-up (user) vs Y-up (internal) conversion
   - Unit conversion (mm ↔ m)
   - Loader guidelines

   **Who should read:** Anyone adding new loaders or working with transforms

---

## 🚀 Quick Links to Code

### Core Algorithm
- **[ICPJointAnalyzer.ts](../src/dev/ICPJointAnalyzer.ts)** - ICP + 3-point circle fitting
- **[KinematicExtractionPipeline.ts](../src/babylon/pipeline/KinematicExtractionPipeline.ts)** - Full pipeline orchestrator
- **[ICP.ts](../src/babylon/pointCloud/ICP.ts)** - Core ICP algorithm

### Analysis Tools
- **[GLBStructureAnalyzer.ts](../src/dev/GLBStructureAnalyzer.ts)** - Comprehensive GLB analysis
- **[testGLBAnalyzer.ts](../src/dev/testGLBAnalyzer.ts)** - Test harness

### Scene Analysis
- **[GeometricToolAnalyzer.ts](../src/babylon/sceneAnalysis/GeometricToolAnalyzer.ts)** - Bounding box matching
- **[NameBasedToolAnalyzer.ts](../src/babylon/sceneAnalysis/NameBasedToolAnalyzer.ts)** - Name pattern matching

### Testing
- **[AutoKinematicsFullPipelineTest.ts](../src/babylon/pipeline/AutoKinematicsFullPipelineTest.ts)** - Complete pipeline test

---

## 🎯 Common Tasks

### Task 1: Analyze a New GLB File

```typescript
import { testGLBAnalyzer } from './src/dev/testGLBAnalyzer';

// Analyze structure
await testGLBAnalyzer(scene, '/new_fixture.glb');

// Check console output:
// - Recommendations (name-based vs geometry-based)
// - High-confidence pairs
// - Naming patterns detected
// - Spatial/dimension clusters

// JSON and Markdown reports auto-exported
```

**Output files:**
- `glb_analysis_YYYY-MM-DD.json` - Full structured report
- `glb_analysis_YYYY-MM-DD.md` - Human-readable summary

---

### Task 2: Run Auto-Kinematics Pipeline

```typescript
import { KinematicExtractionPipeline } from './src/babylon/pipeline/KinematicExtractionPipeline';

const pipeline = new KinematicExtractionPipeline(scene);

// Step 1: Analyze scene
await pipeline.analyzeScene({ analysisMethod: 'name-based' }, rootNode);

// Step 2: Capture retracted state
await pipeline.captureRetractedStates();

// Step 3: User moves parts manually or via API

// Step 4: Capture extended state
await pipeline.captureExtendedStates();

// Step 5: Fit joints
await pipeline.fitJoints();

// Step 6: Export JSON
const model = pipeline.exportToJSON();
console.log(`Extracted ${model.joints.length} joints`);
```

---

### Task 3: Compare Two Nodes

```typescript
import { compareNodes } from './src/dev/testGLBAnalyzer';

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

### Task 4: Debug Failed Pairing

**Symptoms:** Pipeline can't find any pairs.

**Debug steps:**

1. **Analyze GLB structure:**
   ```typescript
   const analyzer = new GLBStructureAnalyzer(scene);
   const report = await analyzer.analyzeGLB(rootNode, 'fixture.glb');
   console.log(report.recommendations);
   ```

2. **Check naming convention:**
   ```typescript
   console.log(report.statistics.namingStats.namingConventionConfidence);
   // > 0.5 = good naming, use name-based
   // < 0.5 = bad naming, use geometry-based
   ```

3. **Check potential pairs:**
   ```typescript
   console.log(report.potentialPairs.length);
   // 0 = no pairs found, check geometry similarity threshold
   // >0 = pairs found, check why pipeline rejected them
   ```

4. **Inspect individual nodes:**
   ```typescript
   console.log(report.nodes.map(n => ({
     name: n.name,
     hasGeometry: n.geometry.hasMeshes,
     volume: n.geometry.volume,
     dimensions: n.geometricSignature.dimensions
   })));
   ```

5. **Adjust strategy:**
   ```typescript
   // If naming is weak, use geometry-based
   await pipeline.analyzeScene({ analysisMethod: 'geometry-based' }, rootNode);

   // Or lower similarity threshold
   await pipeline.analyzeScene({
     analysisMethod: 'geometric',
     geometric: { similarityThreshold: 0.75 } // default 0.90
   }, rootNode);
   ```

---

## 📊 Understanding the Algorithm

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. LOAD GLB                                                  │
│    - Babylon loads geometry in world/carline coordinates    │
│    - All positions are absolute in carline space            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ANALYZE STRUCTURE (GLBStructureAnalyzer)                 │
│    - Build hierarchy tree                                    │
│    - Compute geometric signatures                           │
│    - Detect naming patterns                                 │
│    - Find potential pairs                                   │
│    Output: Report with recommendations                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. PAIR NODES (KinematicExtractionPipeline)                │
│    Method A: Name-based (UNIT_XXX_FIXED ↔ UNIT_XXX_MOVING) │
│    Method B: Geometry-based (similar bounding boxes)        │
│    Output: List of (FIXED, MOVING) pairs                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. EXTRACT POINT CLOUDS                                     │
│    - Sample mesh vertices (world coordinates)               │
│    - Subsample for performance (stride=10)                  │
│    - Must have >50 points for reliable ICP                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. RUN ICP (Iterative Closest Point)                       │
│    - Find transformation MOVING → FIXED                     │
│    - Use Horn's method (SVD rigid transform)                │
│    - Output: 4x4 transformation matrix                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. DECOMPOSE TRANSFORM                                      │
│    - Check if prismatic (translation) or revolute (rotation)│
│    - Extract axis direction                                 │
│    - For revolute: Use 3-point circle fitting to find pivot │
│    Output: Joint type, axis, anchor, limits                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. PLACE JOINT GIZMO                                        │
│    - Transform from world/carline coords to parent's local  │
│    - Create visual gizmo (axis line + pivot sphere)         │
│    - Attach to parent node in hierarchy                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Insights

### 1. World = Carline Coordinates

**Important:** When you load a GLB, **world coordinates ARE carline coordinates**.

```
❌ WRONG: Thinking there are two separate coordinate systems
  - "World space" at (0,0,0)
  - "Carline space" at (5000mm, 2000mm, 1000mm)

✅ RIGHT: World space = Carline space
  - GLB is exported in carline coordinates
  - When loaded, world origin = carline origin
  - Fixture might be at (5000, 2000, 1000) in world/carline space
```

### 2. Joint Gizmo Placement

**Problem:** ICP gives you joint pivot in world/carline coordinates. But gizmo must be placed relative to parent.

**Solution:**
```typescript
// ICP gives world/carline position
const worldAnchor = new Vector3(5100, 2050, 1020);

// Transform to parent's local frame
const parentWorldMatrix = parentNode.getWorldMatrix();
const parentWorldMatrixInv = parentWorldMatrix.invert();
const localAnchor = Vector3.TransformCoordinates(worldAnchor, parentWorldMatrixInv);

// Place gizmo
gizmo.position = localAnchor;  // relative to parent
gizmo.parent = parentNode;     // attached to parent
```

### 3. Point Cloud Extraction Must Use World Coordinates

**Critical:** Always extract vertices in **world space** for ICP.

```typescript
// ❌ WRONG: Using local coordinates
const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
for (let i = 0; i < positions.length; i += 3) {
  points.push(new Vector3(positions[i], positions[i+1], positions[i+2]));
}

// ✅ RIGHT: Transform to world coordinates
mesh.computeWorldMatrix(true);  // ← CRITICAL!
const worldMatrix = mesh.getWorldMatrix();
for (let i = 0; i < positions.length; i += 3) {
  const localPos = new Vector3(positions[i], positions[i+1], positions[i+2]);
  const worldPos = Vector3.TransformCoordinates(localPos, worldMatrix);
  points.push(worldPos);
}
```

### 4. The Secret to Revolute Joints: 3-Point Circle Fitting

**Why it works:**
1. ICP gives transformation from state A → state B
2. Apply transformation repeatedly: `p1 → p2 → p3` traces a circular arc
3. Any 3 points on a circle uniquely define that circle
4. **Circle center = mechanical pivot** (NOT the centroid!)
5. **Circle normal = rotation axis** (NOT the decomposed axis!)

```typescript
// Take 3 points on the trajectory
const p1 = samplePoint;
const p2 = Vector3.TransformCoordinates(p1, icpTransform);
const p3 = Vector3.TransformCoordinates(p2, icpTransform);

// Fit circle
const circle = fitCircleFrom3Points(p1, p2, p3);

// Circle center IS the pivot!
const jointAnchor = circle.center;
const jointAxis = circle.normal;
```

---

## 🧪 Testing

### Run Full Pipeline Test

```typescript
import { runAutoKinematicsFullTest } from './src/babylon/pipeline/AutoKinematicsFullPipelineTest';

const report = await runAutoKinematicsFullTest();

// Outputs detailed report with:
// - Stage 0: Setup
// - Stage 1: Load GLB
// - Stage 2: Analyze Scene
// - Stage 3: Validate SceneTree
// - Stage 4: Capture Retracted
// - Stage 5: Capture Extended
// - Stage 6: Fit Joints (ICP)
// - Stage 7: Export JSON
// - Stage 8: Validate Output

// Check results
console.log(`Overall: ${report.overallSuccess ? 'PASS' : 'FAIL'}`);
console.log(`Stages Passed: ${report.summary.stagesPassed}`);
console.log(`Stages Failed: ${report.summary.stagesFailed}`);
```

---

## 🐛 Common Issues

### Issue 1: "ICP fails to converge"

**Symptoms:** `rmsError` stays high (>0.05m), `iterations` maxes out

**Causes:**
- Initial alignment too far off
- Too few point correspondences (<50 points)
- Degenerate geometry (flat surfaces)

**Solutions:**
1. Check point cloud quality: `pointCount > 50`
2. Increase `maxIterations`: 50 → 100
3. Use coarse-to-fine ICP
4. Manually adjust initial position

---

### Issue 2: "Wrong joint type detected"

**Symptoms:** Prismatic detected as revolute, or vice versa

**Causes:**
- Small motion magnitude (below threshold)
- Mixed motion (translation + rotation)

**Solutions:**
1. Increase motion distance (>10mm for prismatic, >5° for revolute)
2. Adjust thresholds in `decomposeTransformation()`
3. Use multi-state ICP for averaging

---

### Issue 3: "Gizmo appears at wrong location"

**Symptoms:** Joint axis doesn't align with CAD

**Causes:**
- Coordinate transform error
- Parent node not set correctly
- Forgot to transform to local frame

**Solutions:**
1. Verify `computeWorldMatrix(true)` is called
2. Check parent-child hierarchy in scene tree
3. Use `placeJointGizmo()` helper function

---

### Issue 4: "No pairs found"

**Symptoms:** Pipeline reports 0 potential pairs

**Causes:**
- Weak naming convention
- Geometry too dissimilar
- Wrong similarity threshold

**Solutions:**
1. Run `GLBStructureAnalyzer` to diagnose
2. Check `namingConventionConfidence` score
3. Try geometry-based pairing
4. Lower similarity threshold to 0.75

---

## 📈 Performance Tips

### 1. Point Cloud Subsampling

```typescript
// Instead of using ALL vertices (may be 10k+)
const stride = 10;  // Sample every 10th vertex
for (let i = 0; i < positions.length; i += stride * 3) {
  // ...
}
```

**Effect:** 10x faster ICP with minimal accuracy loss

### 2. Early Rejection (Fast Node Filter)

```typescript
// Use multi-stage filtering
const options: PipelineOptions = {
  fastFiltering: {
    minPoints: 50,              // Reject if <50 vertices
    maxCentroidDistance: 2.0,   // Reject if >2m apart
    coarsePointCount: 100,      // Use 100 points for coarse ICP
    coarseMaxIterations: 20,    // Only 20 iterations for coarse
    enableDebug: true
  }
};
```

**Effect:** 5-10x faster pipeline by rejecting bad pairs early

### 3. Prioritize High-Confidence Pairs

```typescript
// Sort pairs by confidence
const sortedPairs = potentialPairs.sort((a, b) => b.confidence - a.confidence);

// Process top 80% first
const topPairs = sortedPairs.filter(p => p.confidence >= 0.8);
```

**Effect:** Get results faster for the most likely-to-succeed pairs

---

## 🔮 Future Work

### Phase 1: Current Capabilities ✅
- Name-based pairing
- Geometry-based pairing
- ICP alignment
- Joint decomposition (prismatic/revolute)
- 3-point circle fitting for pivot
- Confidence scoring

### Phase 2: Planned Improvements 🚧
- [ ] Multi-state ICP (use 3+ states for robustness)
- [ ] Coarse-to-fine ICP (progressive refinement)
- [ ] Hierarchical ICP (consider parent-child chains)
- [ ] Outlier rejection
- [ ] Geometric validation

### Phase 3: Advanced Features 🔬
- [ ] Machine learning pair prediction
- [ ] Motion trajectory prediction (ICP-free)
- [ ] Collision detection for joint limits
- [ ] Topology analysis (connection graph)
- [ ] Multi-DOF joints (spherical, cylindrical)

---

## 📞 Support

### Getting Help

1. **Check recommendations:** Run `GLBStructureAnalyzer` first
2. **Read error messages:** ICP logs detailed debug info
3. **Compare to documentation:** Reference the complete plan
4. **Test with known-good GLB:** Verify setup with `9X_110_GEO.glb`

### Reporting Issues

When reporting issues, include:
- GLB file (or structure analysis JSON)
- Console output with `enableDebug: true`
- Expected vs actual results
- Node names and IDs involved

---

## 📚 Additional Resources

- **Babylon.js Docs:** https://doc.babylonjs.com
- **Rapier Physics:** https://rapier.rs/docs/
- **ICP Algorithm:** Besl & McKay (1992) - "A method for registration of 3-D shapes"
- **Circle Fitting:** Chernov & Lesort (2005) - "Least squares fitting of circles"

---

**Last Updated:** 2025-11-03
**Owner:** George (Agent 1 - Claude Code)
**Version:** 1.0.0
