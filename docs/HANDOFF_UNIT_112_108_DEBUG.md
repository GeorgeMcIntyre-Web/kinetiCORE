# HANDOFF: UNIT_112 & UNIT_108 Joint Debugging

**Date:** 2025-11-03 3:00 PM
**From:** Agent 1 (Claude Code - George)
**To:** Next Developer
**Branch:** `feature/auto-kinematics-hierarchical-bbox-pairing`
**Status:** Ready for Testing

---

## 🎯 Mission

Debug and validate auto-kinematics for two specific units:

1. **UNIT_112** - 2 revolute (hinge) joints (LH + RH clamp jaws)
2. **UNIT_108** - 2 prismatic (linear) joints

**Test Files:**
- `public/9X_110_GEO_112x.glb` - UNIT_112 isolated
- `public/9X_110_GEO_108x.glb` - UNIT_108 isolated

---

## 🚨 CRITICAL: Container Node Fallacy (CNF)

### What is CNF?

**The #1 mistake** when working with GLB hierarchies:

❌ **WRONG (CNF):**
```typescript
const fixed = unit.getChild('FIXED');
const moving = unit.getChild('MOVING');
const bbox1 = fixed.getBoundingInfo(); // ← EMPTY! 0 meshes!
```

✅ **CORRECT:**
```typescript
const fixed = unit.getChild('FIXED');
const meshes = fixed.getChildMeshes(true); // ← Get ALL descendant meshes!
const bbox1 = calculateBoundingBox(meshes);
```

### Why CNF Happens

Nodes like "FIXED", "MOVING", "LH", "RH" are **organizational containers**, NOT data nodes:

```
UNIT_112/
├── LH/              ← Container (0 meshes)
│   ├── FIXED/       ← Container (0 meshes)
│   │   └── Pin/     ← Container (0 meshes)
│   │       └── mesh ← ACTUAL GEOMETRY (6454 vertices)
│   ├── MOVING/      ← Container (0 meshes)
│   │   └── Jaw/     ← Container (0 meshes)
│   │       └── mesh ← ACTUAL GEOMETRY (2436 vertices)
```

**The trap:** Names suggest they're meaningful, but they're just empty folders!

**If I catch you using CNF, I'll just say "CNF" and you'll know what you did wrong.**

---

## 🔍 Understanding UNIT_112 Structure

### The Real Joint Pairs (NOT what you expect!)

❌ **WRONG ASSUMPTION:**
> "Pairs are FIXED (stationary) vs MOVING (actuated)"

✅ **ACTUAL STRUCTURE:**
> "Pairs are BOTH called 'MOVING' at different positions"

#### Joint 1 (RH):
- **State 1:** `UNIT_112/RH/MOVING` (2430 vertices)
- **State 2:** `UNIT_112/WIRE/OPEN_RH/MOVING` (2424 vertices)
- **Type:** Revolute (rotating clamp jaw)
- **What FIXED is:** `UNIT_112/RH/FIXED` (6404 vertices) = actuator body (NOT part of joint pair!)

#### Joint 2 (LH):
- **State 1:** `UNIT_112/LH/MOVING` (2436 vertices)
- **State 2:** `UNIT_112/WIRE/OPEN_LH/MOVING` (2426 vertices)
- **Type:** Revolute (rotating clamp jaw)
- **What FIXED is:** `UNIT_112/LH/FIXED` (6454 vertices) = actuator body (NOT part of joint pair!)

### Key Insight

**BOTH nodes in a pair are called "MOVING"** because they represent the SAME PHYSICAL PART (the jaw) in TWO DIFFERENT POSITIONS:
- One is retracted/closed position
- Other is extended/open position
- Names don't tell you which is which - geometry and position do!

---

## 🛠️ Tools Created for You

### 1. Unit112Debugger (`src/dev/Unit112Debugger.ts`)

**Purpose:** Deep structure analysis without assumptions

**Usage:**
```javascript
window.debugTools.debugUnit112()
```

**Output:**
- Complete tree with emoji markers (📦 = has geometry, 📁 = empty container)
- Mesh counts and vertex totals for EVERY node
- Bounding boxes from actual geometry
- Geometric similarity analysis

**When to use:**
- First time analyzing a unit
- When pairs aren't found
- When you need to understand hierarchy

### 2. Unit112PairFinder (`src/dev/Unit112PairFinder.ts`)

**Purpose:** Geometry-based pair finding (CNF-proof!)

**Usage:**
```javascript
window.debugTools.findUnit112Pairs()
```

**Algorithm:**
1. Scans ALL nodes under UNIT_112
2. Collects nodes with ≥1000 vertices
3. Compares ALL pairs using:
   - Bounding box dimensions (rotation-invariant)
   - Vertex counts
   - Spatial positions
4. Filters for probable joints:
   - Similarity >90%
   - Vertex count diff <10%
   - Distance >1cm (different positions)
   - Distance <1m (same workspace)
5. Classifies by side (LH/RH based on Z position)

**Output:**
```
Found 6 nodes with geometry:
  UNIT_112/RH/FIXED (6404 vertices)
  UNIT_112/RH/MOVING (2430 vertices)
  UNIT_112/WIRE/OPEN_RH/MOVING (2424 vertices)
  ... (LH similar)

PROBABLE JOINT PAIRS:
  Joint Pair Found (99.7% similarity):
    Node 1: UNIT_112/RH/MOVING
    Node 2: UNIT_112/WIRE/OPEN_RH/MOVING
    Geometric Similarity: 99.7%
    Center Distance: 0.050 m

JOINT CLASSIFICATION:
  RH (Right Hand) - Revolute (Rotating)
    State 1: UNIT_112/RH/MOVING
    State 2: UNIT_112/WIRE/OPEN_RH/MOVING
    Confidence: 99.7%
```

**When to use:**
- To automatically find joint pairs
- To validate geometry-based approach
- Before running ICP pipeline

### 3. Joint Extraction (`C:\Users\georgem\source\repos\kinetiCORE_data\joint-extraction.ts`)

**Purpose:** Decompose ICP transformation into joint definition

**Usage:**
```typescript
import { extractJoint } from './joint-extraction';

const joint = extractJoint(icpResult, movingCentroid, {
  translationThreshold: 0.001,  // 1mm
  rotationThreshold: 0.05,      // ~2.86°
  anchorStrategy: 'axis_projection'
});

// Returns:
// {
//   type: 'hinge' | 'prismatic',
//   axis: Vector3,
//   anchor: Vector3,
//   magnitude: number
// }
```

**Thresholds:**
- **Prismatic:** Translation >1mm
- **Revolute:** Rotation >0.05 rad (~2.86°)
- **Mixed:** Picks dominant motion

**When to use:**
- After ICP gives you transformation matrix
- To classify joint type automatically
- To extract axis and pivot for gizmo placement

---

## 📋 Testing Workflow

### Phase 1: Validate UNIT_112 (Revolute Joints)

#### Step 1: Load GLB
```javascript
// Load 9X_110_GEO_112x.glb in UI
// Then in console:
window.debugTools.setScene(scene)
```

#### Step 2: Debug Structure
```javascript
window.debugTools.debugUnit112()

// VERIFY:
// ✓ RH/MOVING has ~2430 vertices
// ✓ WIRE/OPEN_RH/MOVING has ~2424 vertices
// ✓ LH/MOVING has ~2436 vertices
// ✓ WIRE/OPEN_LH/MOVING has ~2426 vertices
// ✓ FIXED nodes have ~6400 vertices
```

#### Step 3: Find Pairs
```javascript
window.debugTools.findUnit112Pairs()

// VERIFY:
// ✓ Finds exactly 2 pairs
// ✓ RH pair: RH/MOVING ↔ WIRE/OPEN_RH/MOVING
// ✓ LH pair: LH/MOVING ↔ WIRE/OPEN_LH/MOVING
// ✓ Similarity >90% for both
// ✓ Classified as "Revolute (Rotating)"
```

#### Step 4: Extract Point Clouds
```typescript
// For RH joint
const node1 = scene.getNodeByName('MOVING'); // Under UNIT_112/RH/
const node2 = scene.getNodeByName('MOVING'); // Under UNIT_112/WIRE/OPEN_RH/

// Get ALL descendant meshes (CNF-proof!)
const meshes1 = node1.getChildMeshes(true);
const meshes2 = node2.getChildMeshes(true);

// Extract point clouds in WORLD coordinates
const cloud1 = extractPointCloud(meshes1); // World space!
const cloud2 = extractPointCloud(meshes2); // World space!

// VERIFY:
// ✓ cloud1.length ~= 2430 (or subsampled)
// ✓ cloud2.length ~= 2424 (or subsampled)
// ✓ Points are in world coordinates (not local!)
```

#### Step 5: Run ICP
```typescript
import { alignPointClouds } from './src/babylon/pointCloud/ICP';

const icpResult = alignPointClouds(cloud1, cloud2, {
  maxIterations: 50,
  tolerance: 1e-6
});

// VERIFY:
// ✓ icpResult.converged === true
// ✓ icpResult.rmsError < 0.01 (1cm)
// ✓ icpResult.transform is 4x4 matrix
```

#### Step 6: Extract Joint
```typescript
import { extractJoint } from './joint-extraction';

// Calculate centroid of moving part
const centroid = calculateCentroid(cloud1);

const joint = extractJoint(icpResult, centroid, {
  translationThreshold: 0.001,
  rotationThreshold: 0.05
});

// VERIFY FOR REVOLUTE:
// ✓ joint.type === 'hinge'
// ✓ joint.axis is normalized vector
// ✓ joint.anchor is pivot point
// ✓ joint.magnitude > 0.05 (rotation detected)
```

#### Step 7: Validate Axis
```typescript
// For RH joint, rotation axis should be roughly along Z
// For LH joint, rotation axis should be roughly along Z
// (Both are hinges rotating about Z-axis)

console.log('Joint axis:', joint.axis);
console.log('Magnitude (radians):', joint.magnitude);
console.log('Magnitude (degrees):', joint.magnitude * 180 / Math.PI);

// VERIFY:
// ✓ Axis is unit vector (length ~1.0)
// ✓ Axis direction makes sense (Z-ish for clamp jaws)
// ✓ Magnitude >5° (reasonable jaw rotation)
```

---

### Phase 2: Validate UNIT_108 (Prismatic Joints)

#### Step 1: Load GLB
```javascript
// Load 9X_110_GEO_108x.glb in UI
// Then in console:
window.debugTools.setScene(scene)
```

#### Step 2: Analyze Structure
```javascript
// UNIT_108 structure is unknown, so start with general analysis
window.debugTools.analyzeGLB()

// Look for:
// - Naming patterns (FIXED/MOVING or similar)
// - Vertex counts (similar pairs)
// - Spatial distribution (linear motion expected)
```

#### Step 3: Create Custom Debugger (if needed)
```typescript
// If UNIT_108 has different structure, create Unit108Debugger
// Copy Unit112Debugger.ts → Unit108Debugger.ts
// Change line 37: 'UNIT_112' → 'UNIT_108'
// Change line 50: getTransformNodeByName('UNIT_112') → 'UNIT_108'
```

#### Step 4: Find Pairs (Geometry-Based)
```javascript
// If naming is similar to UNIT_112, use same approach
// Otherwise, use general geometry-based finder
window.debugTools.findUnitPairsV2()
```

#### Step 5: Run ICP (Same as UNIT_112)
```typescript
// Same workflow as UNIT_112 Phase 1 Steps 4-6
```

#### Step 6: Verify Prismatic Joint
```typescript
const joint = extractJoint(icpResult, centroid);

// VERIFY FOR PRISMATIC:
// ✓ joint.type === 'prismatic'
// ✓ joint.axis is normalized direction
// ✓ joint.magnitude > 0.001 (translation >1mm)
// ✓ joint.anchor is on moving part
```

---

## 📁 File Structure

### Created Files:
```
src/dev/
├── Unit112Debugger.ts           ← Deep structure analysis
├── Unit112PairFinder.ts         ← Geometry-based pair finder
├── globalDebugTools.ts          ← UPDATED: Added debugUnit112(), findUnit112Pairs()

docs/
├── HANDOFF_UNIT_112_108_DEBUG.md ← This file
└── AUTO_KINEMATICS_README.md     ← Main documentation (NEEDS UPDATE)
```

### External Files (Reference):
```
C:\Users\georgem\source\repos\kinetiCORE_data\
└── joint-extraction.ts           ← ICP → Joint decomposition
```

### Test GLBs:
```
public/
├── 9X_110_GEO_112x.glb          ← UNIT_112 isolated (2 revolute joints)
├── 9X_110_GEO_108x.glb          ← UNIT_108 isolated (2 prismatic joints)
└── 9X_110_GEO.glb               ← Full fixture (16 units)
```

---

## 🔧 Integration Points

### 1. Unit112PairFinder → joint-extraction.ts

```typescript
// Step 1: Find pairs (geometry-based)
const pairFinder = new Unit112PairFinder(scene);
const pairs = pairFinder.findPairs(); // Returns probable joint pairs

// Step 2: For each pair, extract point clouds
for (const pair of pairs) {
  const cloud1 = extractPointCloud(pair.node1.node.getChildMeshes(true));
  const cloud2 = extractPointCloud(pair.node2.node.getChildMeshes(true));

  // Step 3: Run ICP
  const icpResult = alignPointClouds(cloud1, cloud2);

  // Step 4: Extract joint
  const centroid = calculateCentroid(cloud1);
  const joint = extractJoint(icpResult, centroid);

  console.log(`Joint found: ${joint.type} at ${joint.anchor}`);
}
```

### 2. Joint Extraction → Gizmo Placement

```typescript
// After extractJoint() returns joint definition
const { type, axis, anchor, magnitude } = joint;

// Create gizmo in world coordinates
const gizmo = createJointGizmo(type, axis, anchor, magnitude);

// Transform to parent's local frame
const parentWorldMatrix = parentNode.getWorldMatrix();
const parentWorldMatrixInv = parentWorldMatrix.invert();
const localAnchor = Vector3.TransformCoordinates(anchor, parentWorldMatrixInv);
const localAxis = Vector3.TransformNormal(axis, parentWorldMatrixInv);

// Place gizmo
gizmo.position = localAnchor;
gizmo.direction = localAxis;
gizmo.parent = parentNode;
```

---

## 🧪 Test Checklist

### UNIT_112 (Revolute) ✅ Expected:
- [ ] Load 9X_110_GEO_112x.glb successfully
- [ ] `debugUnit112()` shows complete tree
- [ ] `findUnit112Pairs()` finds exactly 2 pairs
- [ ] RH pair: `RH/MOVING` ↔ `WIRE/OPEN_RH/MOVING`
- [ ] LH pair: `LH/MOVING` ↔ `WIRE/OPEN_LH/MOVING`
- [ ] Similarity >90% for both pairs
- [ ] Point clouds extracted correctly (world coordinates)
- [ ] ICP converges (rmsError <0.01m)
- [ ] `extractJoint()` returns `type: 'hinge'`
- [ ] Rotation magnitude >0.05 rad (~2.86°)
- [ ] Axis direction reasonable (Z-ish for clamps)

### UNIT_108 (Prismatic) 🔲 Unknown:
- [ ] Load 9X_110_GEO_108x.glb successfully
- [ ] Analyze structure (naming patterns, geometry)
- [ ] Create Unit108Debugger if needed
- [ ] Find 2 joint pairs (geometry-based)
- [ ] Extract point clouds (world coordinates)
- [ ] ICP converges
- [ ] `extractJoint()` returns `type: 'prismatic'`
- [ ] Translation magnitude >0.001m (1mm)
- [ ] Axis direction makes sense for linear motion

---

## 🚩 Known Issues & Gotchas

### Issue 1: "No pairs found"
**Cause:** Similarity threshold too high or wrong nodes compared

**Fix:**
1. Run `debugUnit112()` to see actual structure
2. Check vertex counts are similar (~2400 for jaws)
3. Lower similarity threshold in `findAllPairs()` (line ~165 in Unit112PairFinder.ts)

### Issue 2: "ICP fails to converge"
**Cause:** Initial alignment too far off or not enough points

**Fix:**
1. Verify point clouds in world coordinates
2. Check point count >50
3. Increase `maxIterations` to 100
4. Try coarse-to-fine ICP

### Issue 3: "Wrong joint type detected"
**Cause:** Motion magnitude below threshold or mixed motion

**Fix:**
1. Check threshold values in `extractJoint()`:
   - `translationThreshold: 0.001` (1mm)
   - `rotationThreshold: 0.05` (2.86°)
2. Increase motion distance in GLB (if possible)
3. Use multi-state ICP for better averaging

### Issue 4: "Gizmo appears at wrong location"
**Cause:** Coordinate transform error or parent not set

**Fix:**
1. Verify `computeWorldMatrix(true)` called before extraction
2. Check parent-child hierarchy
3. Transform from world to parent's local frame:
   ```typescript
   const localAnchor = Vector3.TransformCoordinates(
     worldAnchor,
     parentWorldMatrix.invert()
   );
   ```

---

## 📞 Communication

### If Blocked:
1. Check `window.debugTools.help()` for available commands
2. Review CNF section (most common mistake!)
3. Compare output to expected output in this doc
4. Check console for error messages (enable debug mode)

### What to Report Back:
- [ ] UNIT_112 pairs found correctly (2 revolute joints)
- [ ] UNIT_108 pairs found correctly (2 prismatic joints)
- [ ] ICP convergence rates and rmsError values
- [ ] Joint types classified correctly
- [ ] Any issues encountered and how resolved
- [ ] Suggestions for improvement

---

## 🎓 Key Learnings from This Session

### 1. Container Node Fallacy (CNF)
- **Never** use organizational nodes directly
- **Always** use `getChildMeshes(true)` to get descendants
- **Remember:** Names are for humans, not algorithms!

### 2. Pair Detection Reality
- Pairs aren't always "FIXED vs MOVING"
- Can be "MOVING vs MOVING" at different positions
- **Use geometry**, not assumptions!

### 3. Geometry-Based Approach
- Rotation-invariant (sort bounding box dimensions)
- Vertex count validation
- Spatial distance filtering
- Works regardless of naming convention

### 4. World Coordinates
- GLB loads in world/carline space
- ICP requires world coordinates
- Gizmos need local coordinates (transform after)

---

## 🚀 Next Steps After Testing

### If Tests Pass:
1. Generalize Unit112PairFinder → GenericUnitPairFinder
2. Support multiple unit types (112, 108, etc.)
3. Integrate with full auto-kinematics pipeline
4. Add export functionality (JSON tooling format)
5. Create visual gizmos for found joints

### If Tests Fail:
1. Document failure mode
2. Run debug tools to understand why
3. Adjust thresholds or algorithm
4. Iterate until working

---

## 📚 Essential Reading

1. **This file** (you're reading it)
2. [AUTO_KINEMATICS_README.md](AUTO_KINEMATICS_README.md) - Full system overview
3. [GLB_ANALYSIS_TOOL.md](GLB_ANALYSIS_TOOL.md) - Analysis tool guide
4. [COORDINATE_SYSTEM.md](../COORDINATE_SYSTEM.md) - Coordinate conventions

---

## ⏰ Time Estimate

- **UNIT_112 testing:** 1-2 hours
- **UNIT_108 testing:** 2-3 hours (unknown structure)
- **Bug fixing:** 1-2 hours
- **Documentation:** 30 minutes
- **Total:** 5-7 hours

---

**STATUS:** ✅ Ready to Go
**BRANCH:** `feature/auto-kinematics-hierarchical-bbox-pairing`
**LAST UPDATED:** 2025-11-03 3:00 PM

**Good luck! Remember: When in doubt, run the debug tools first. And never, EVER use CNF! 😊**
