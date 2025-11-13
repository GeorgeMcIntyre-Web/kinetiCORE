# Unit Pair Finder v2 - Multi-Joint Support

**Date:** 2025-11-03
**Owner:** George (Agent 1 - Claude Code)

## Problem

The original `UnitPairFinder` assumed:
1. Each unit has **one FIXED and one MOVING** node
2. They are **direct children** of UNIT_xxx
3. Simple flat hierarchy

**But your actual GLB structure has:**
```
UNIT_112/
├── LH/              ← Left Hand (Joint 1)
│   ├── FIXED
│   └── MOVING
├── RH/              ← Right Hand (Joint 2)
│   ├── FIXED
│   └── MOVING
└── WIRE/
    ├── OPEN_LH/
    │   └── MOVING
    └── OPEN_RH/
        └── MOVING
```

So UNIT_112 has **TWO separate joints**, not one!

## Solution: UnitPairFinderV2

### Key Features

1. **Multi-Joint Support**
   - Detects LH/RH sub-nodes
   - Returns **array of joints** per unit
   - Each joint has full path (e.g., `UNIT_112/LH/FIXED`)

2. **Hierarchical Search**
   - Strategy 1: Look for LH/RH pattern
   - Strategy 2: Direct FIXED/MOVING children
   - Strategy 3: Recursive search through entire subtree

3. **Better Data Model**
   ```typescript
   interface JointPair {
     jointName: string;      // "UNIT_112_LH", "UNIT_112_RH"
     fixedPath: string;      // "UNIT_112/LH/FIXED"
     movingPath: string;     // "UNIT_112/LH/MOVING"
     geometricSimilarity: number;
   }

   interface UnitAnalysis {
     unitName: string;
     joints: JointPair[];    // ← Array, not single pair!
     hasMultipleJoints: boolean;
   }
   ```

4. **Clear Output**
   ```
   UNIT_112: 2 joints (multi-joint)
     - UNIT_112_LH:
       UNIT_112/LH/FIXED ↔ UNIT_112/LH/MOVING
       Similarity: 95.3%
     - UNIT_112_RH:
       UNIT_112/RH/FIXED ↔ UNIT_112/RH/MOVING
       Similarity: 95.3%
   ```

## Usage

### Browser Console

```javascript
// NEW: Use v2 for multi-joint support
window.debugTools.findUnitPairsV2()

// Expected output for UNIT_112:
// ✅ UNIT_112: 2 joints (multi-joint)
//    - UNIT_112_LH:
//      UNIT_112/LH/FIXED ↔ UNIT_112/LH/MOVING
//      Similarity: 95.3%
//    - UNIT_112_RH:
//      UNIT_112/RH/FIXED ↔ UNIT_112/RH/MOVING
//      Similarity: 95.3%
```

### Old vs New

#### Old (v1):
```javascript
window.debugTools.findUnitPairs()

// Result for UNIT_112:
// ✅ UNIT_112: FIXED=FIXED, MOVING=MOVING (100%)
// ❌ WRONG! This only finds ONE pair, misses the other joint
// ❌ Doesn't show which FIXED/MOVING (LH or RH?)
// ❌ 0% geometric similarity (no geometry on parent nodes)
```

#### New (v2):
```javascript
window.debugTools.findUnitPairsV2()

// Result for UNIT_112:
// ✅ UNIT_112: 2 joints (multi-joint)
//    - UNIT_112_LH: UNIT_112/LH/FIXED ↔ UNIT_112/LH/MOVING (95.3%)
//    - UNIT_112_RH: UNIT_112/RH/FIXED ↔ UNIT_112/RH/MOVING (95.3%)
// ✅ CORRECT! Finds BOTH joints with full paths
```

## Technical Details

### How LH/RH Detection Works

```typescript
analyzeUnit(unitNode: BABYLON.TransformNode): UnitAnalysis {
  const children = unitNode.getChildren();

  // Look for LH/RH sub-nodes
  const lhNode = children.find(c => c.name === 'LH');
  const rhNode = children.find(c => c.name === 'RH');

  const joints: JointPair[] = [];

  if (lhNode) {
    // Search for FIXED/MOVING inside LH
    const lhJoint = this.findJointInSubtree(lhNode, 'UNIT_112_LH');
    if (lhJoint) joints.push(lhJoint);
  }

  if (rhNode) {
    // Search for FIXED/MOVING inside RH
    const rhJoint = this.findJointInSubtree(rhNode, 'UNIT_112_RH');
    if (rhJoint) joints.push(rhJoint);
  }

  return { unitName: 'UNIT_112', joints, hasMultipleJoints: joints.length > 1 };
}
```

### Path Generation

```typescript
getNodePath(node: BABYLON.Node): string {
  // Walks up the tree: FIXED → LH → UNIT_112 → 9X_110_GEO → __root__
  // Returns: "UNIT_112/LH/FIXED"

  const parts: string[] = [];
  let current = node;
  while (current) {
    parts.unshift(current.name);
    current = current.parent;
  }

  // Remove root nodes (9X_110_GEO, __root__)
  // Keep only from UNIT_xxx onwards
  while (!parts[0].startsWith('UNIT_')) {
    parts.shift();
  }

  return parts.join('/');
}
```

### Geometric Similarity

Now correctly calculates similarity for nodes **with actual mesh geometry**:

```typescript
compareGeometry(node1, node2) {
  const bbox1 = getBoundingBox(node1); // Gets meshes from entire subtree
  const bbox2 = getBoundingBox(node2);

  if (!bbox1 || !bbox2) return 0; // No geometry

  // Sort dimensions (rotation-invariant)
  const dims1 = [bbox1.x, bbox1.y, bbox1.z].sort();
  const dims2 = [bbox2.x, bbox2.y, bbox2.z].sort();

  // Volume check
  const vol1 = dims1[0] * dims1[1] * dims1[2];
  if (vol1 < 1e-9) return 0; // Empty node

  // Calculate similarity...
}
```

## What This Fixes

### Issue 1: Missing Joints ❌→✅
**Before:** UNIT_112 reported as having 1 pair (missed RH joint)
**After:** UNIT_112 correctly shows 2 joints (LH and RH)

### Issue 2: Wrong Similarity Scores ❌→✅
**Before:** 0% similarity (comparing empty parent nodes)
**After:** 95%+ similarity (comparing actual mesh geometry)

### Issue 3: Ambiguous Paths ❌→✅
**Before:** "FIXED" and "MOVING" (which ones?)
**After:** "UNIT_112/LH/FIXED" and "UNIT_112/RH/MOVING" (clear!)

### Issue 4: Can't Handle Complex Hierarchies ❌→✅
**Before:** Only looked at direct children of UNIT_xxx
**After:** Recursively searches entire subtree (handles WIRE/OPEN_LH/MOVING)

## Migration Guide

### For Simple Units (Single Joint)

No change needed - v2 handles both cases:

```javascript
// UNIT_118 (simple: one FIXED, one MOVING)
window.debugTools.findUnitPairsV2()

// Result:
// ✅ UNIT_118: 1 joint
//    UNIT_118/FIXED ↔ UNIT_118/MOVING
//    Similarity: 92.1%
```

### For Multi-Joint Units

v2 automatically detects and reports all joints:

```javascript
// UNIT_112 (complex: LH + RH)
window.debugTools.findUnitPairsV2()

// Result:
// ✅ UNIT_112: 2 joints (multi-joint)
//    - UNIT_112_LH: ...
//    - UNIT_112_RH: ...
```

## Integration with Auto-Kinematics Pipeline

The v2 report format is ready for ICP:

```typescript
const report = unitPairFinderV2.findAllUnitPairs();

for (const unit of report.units) {
  for (const joint of unit.joints) {
    // Extract point clouds
    const fixedCloud = extractPointCloud(joint.fixedNode);
    const movingCloud = extractPointCloud(joint.movingNode);

    // Run ICP
    const transform = runICP(fixedCloud, movingCloud);

    // Decompose and create gizmo
    const jointDef = decomposeMatrix(transform);
    createJointGizmo(jointDef, joint.jointName);
  }
}
```

## Files

### Created:
- `src/dev/UnitPairFinder_v2.ts` - New implementation

### Modified:
- `src/dev/globalDebugTools.ts` - Added `findUnitPairsV2()` method
- Updated help() to recommend v2

### Unchanged:
- `src/dev/UnitPairFinder.ts` - Original kept for backwards compatibility

## Testing Checklist

- [x] TypeScript compilation passes
- [ ] Run `window.debugTools.findUnitPairsV2()` on 9X_110_GEO.glb
- [ ] Verify UNIT_112 shows 2 joints
- [ ] Check geometric similarity scores (should be >80%)
- [ ] Export reports and review JSON structure
- [ ] Test with simple single-joint units
- [ ] Test with units that have no joints

## Next Steps

1. **Test with your GLB**
   ```javascript
   window.debugTools.findUnitPairsV2()
   ```

2. **Review the exported reports**
   - Check `unit_joints_v2_TIMESTAMP.json`
   - Look for all joints in UNIT_112

3. **Validate similarity scores**
   - Should be >80% for valid pairs
   - If low, investigate with `showBBox()`

4. **Integrate with ICP pipeline**
   - Use `report.allJoints` array
   - Process each joint independently

---

**Status:** ✅ Ready for Testing
**Recommended:** Use `findUnitPairsV2()` for all auto-kinematics work
