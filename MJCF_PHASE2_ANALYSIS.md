# MJCF Loader - Phase 2 Analysis
**Date:** 2025-10-16
**Agent:** Agent 2 (Architecture & Integration)

## Executive Summary

**Status:** `importVisualMesh()` is already **well-refactored** by Agent 1!

The mesh loading function correctly loads all mesh types (GLB/STL/OBJ) and returns them in a neutral state without applying orientation transforms. The only remaining work is in **Phase 4** (keyframe application).

---

## Current `importVisualMesh()` Analysis

**Location:** `src/loaders/mjcf/MJCFLoader.ts` lines 267-348

### ✅ What's Already Correct

1. **Clean separation of concerns:**
   - GLB files: Handled by specialized `GLBLoader` (lines 274-296)
   - OBJ/STL files: Handled by standard `SceneLoader` (lines 298-336)
   - Both return meshes with `scaling.set(1, 1, 1)` (neutral state)

2. **No orientation assumptions:**
   - Function returns meshes "as-is" from the loader
   - No OBJ upright rotation applied here
   - No STL-specific transforms applied here
   - Meshes are loaded in their native orientation

3. **Proper resource management:**
   - Creates blob URLs for ZIP-extracted files
   - Properly revokes URLs after loading
   - Handles errors gracefully

4. **Scaling handled correctly:**
   - All meshes get `scaling.set(1, 1, 1)` on lines 324, 346, 506, 887
   - This ensures no scale accumulation
   - Actual scale is applied at parent nodes (geomNode, bodyNode)

### 🔍 Minor Observations (Not Blockers)

1. **Plugin extension detection (lines 305-307):**
   ```typescript
   const isObj = file.toLowerCase().endsWith('.obj');
   const isStl = file.toLowerCase().endsWith('.stl');
   const pluginExt = isObj ? '.obj' : isStl ? '.stl' : '';
   ```
   - This is just for SceneLoader plugin hint
   - **Not** used for conditional transforms
   - ✅ Acceptable

2. **GLB loader uses different code path:**
   - GLB needs specialized loader with options
   - OBJ/STL use generic SceneLoader
   - This is **correct** - GLB has embedded materials/animations

### ❌ What Doesn't Need Changing

**DO NOT refactor** `importVisualMesh()` - it's already correct!

The function follows the correct pattern:
```
Load mesh → Set neutral scale → Return to caller
```

Orientation/transforms are applied **later** in the hierarchy, which is architecturally correct.

---

## Phase 2 Status: ✅ COMPLETE

**Agent 1 already completed Phase 2!**

The `importVisualMesh()` function loads all mesh types without orientation assumptions. Meshes are returned in their native state, which is exactly what we want.

---

## Next Steps: Move to Phase 3 & 4

### Phase 3: Kinematic Hierarchy Integrity ✅ LOOKS GOOD

**Review of current hierarchy code (lines 384-527):**

```typescript
const buildBodies = async (...) => {
  const root = new TransformNode("mjcf_root", scene);
  root.scaling.set(1, 1, 1);
  // No global rotation - coordinate conversion handled by position mapping ✅

  const visit = async (bodyEl: Element, parent: TransformNode) => {
    const bodyNode = new TransformNode(name, scene);
    bodyNode.parent = parent; // ✅ Correct parent-child relationship
    bodyNode.scaling.set(1, 1, 1); // ✅ Neutral scale

    // Position conversion ✅
    if (bodyPos !== null && bodyPos.length >= 3) {
      bodyNode.position = convertPosition([bodyPos[0], bodyPos[1], bodyPos[2]]);
    }

    // Quaternion conversion ✅
    if (bodyQuat !== null && bodyQuat.length >= 4) {
      bodyNode.rotationQuaternion = transformQuaternionZupToYup(bodyQuat);
    }

    // Geom node (visual mesh container)
    const geomNode = new TransformNode(`${name}__geom_${meshRef}`, scene);
    geomNode.parent = bodyNode; // ✅ Correct hierarchy
    geomNode.scaling.set(1, 1, 1);

    // Load meshes
    const meshes = await importVisualMesh(scene, rootUrl, def.file, meshFilesMap);
    meshes.forEach(m => {
      m.parent = geomNode; // ✅ Meshes attached to geomNode
      m.scaling.set(1, 1, 1);
    });

    // Recurse to children
    const children = Array.from(bodyEl.querySelectorAll(":scope > body"));
    for (const child of children) await visit(child, bodyNode); // ✅ Recursive hierarchy
  };
}
```

**Phase 3 Assessment:** ✅ **COMPLETE**
- Hierarchy is preserved correctly
- Parent-child relationships are strict
- No flattening
- Scale isolation is correct

### Phase 4: Keyframe Application ⚠️ NEEDS WORK

**Problem Area:** Lines 148-358 (`applyKeyframeData` function)

**Issues Found:**

1. **Conditional OBJ/STL logic** (lines 188-204, 207-229, 232-293):
   ```typescript
   const isOBJBasedModel = hasOBJFiles && (!hasSTLFiles || objCount >= stlCount);
   const isSTLBasedModel = hasSTLFiles && !hasOBJFiles;

   if (isOBJBasedModel) {
     // OBJ-specific keyframe logic
     const uprightRotation = Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2);
     rootBody.rotationQuaternion = uprightRotation.multiply(keyframeQuat);
   } else {
     // STL-specific keyframe logic
     rootBody.rotationQuaternion = transformQuaternionZupToYup(kBaseQuat);
   }
   ```
   ❌ **This violates the unified coordinate system principle!**

2. **Mirror fix heuristics** (lines 272-280):
   ```typescript
   // Mirror fix for right-side legs in OBJ-based models
   if (isOBJBasedModel) {
     const isRightSide = /^(FR_|RR_)/i.test(jointName);
     const isThighOrCalf = /(thigh_joint|calf_joint)/i.test(jointName);
     if (isRightSide && isThighOrCalf && isYAxisSrc) {
       axis = axis.scale(-1);
     }
   }
   ```
   ❌ **Model-specific hacks - should be removed!**

3. **Double application guard has OBJ exception** (lines 157-164):
   ```typescript
   const isPureOBJModel = isOBJBasedModel && !hasSTLFiles;
   if (!isPureOBJModel && rootNode.metadata && rootNode.metadata.keyframesApplied) {
     console.log('[MJCF Keyframe] Keyframes already applied, skipping');
     return;
   }
   ```
   ❌ **Should apply to ALL models!**

---

## Recommended Next Actions for Agent 2

### ✅ Phases 1-3: Complete (Agent 1 did excellent work!)

### 🔧 Phase 4: Refactor `applyKeyframeData()`

**Goal:** Remove ALL conditional OBJ/STL logic from keyframe application.

**Strategy:**
1. Use `MJCFModelTypeDetector` to identify model type
2. Apply **unified coordinate conversion** for all keyframe data
3. Use model type **only** to determine if upright rotation is needed
4. Remove mirror fix heuristics
5. Implement strict idempotence for all models

**Example refactored code:**
```typescript
const applyKeyframeData = (
  rootNode: TransformNode,
  keyframes: Record<string, number[]>,
  jointMap: Record<string, string>,
  jointAxes: Record<string, number[]>,
  meshFilesMap?: Map<string, File>
) => {
  // Use model type detector instead of manual detection
  const modelAnalysis = MJCFModelTypeDetector.analyzeModel(meshFilesMap || new Map());

  // Strict idempotence - no exceptions
  const keyframeManager = MJCFKeyframeManager.getInstance();
  const modelId = rootNode.name;

  for (const [keyframeName, qposValues] of Object.entries(keyframes)) {
    // Check if already applied
    if (keyframeManager.hasBeenApplied(modelId, keyframeName)) {
      console.log(`[MJCF Keyframe] Already applied: ${keyframeName}`);
      continue;
    }

    const rootBody = rootNode.getChildren().find(child =>
      child.name === "pelvis" || child.name === "base_link"
    ) as TransformNode;

    if (!rootBody) continue;

    // Apply base pose using UNIFIED coordinate conversion
    const kBasePos = [qposValues[0] || 0, qposValues[1] || 0, qposValues[2] || 0];
    const kBaseQuat = [qposValues[3] || 1, qposValues[4] || 0, qposValues[5] || 0, qposValues[6] || 0];

    // Convert position (same for all models)
    rootBody.position = convertPosition(kBasePos);

    // Convert quaternion (same for all models)
    let finalQuat = convertQuaternion(kBaseQuat);

    // Apply upright rotation ONLY if model type requires it
    if (modelAnalysis.requiresUprightRotation) {
      const uprightRotation = Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2);
      finalQuat = uprightRotation.multiply(finalQuat);
    }

    rootBody.rotationQuaternion = finalQuat;

    // Apply joint rotations (UNIFIED for all models)
    for (let i = 0; i < Object.keys(jointMap).length; i++) {
      const jointName = Object.keys(jointMap)[i];
      const jointValue = qposValues[7 + i] || 0;
      const bodyName = jointMap[jointName];

      if (bodyName && bodyName !== 'NONE') {
        const bodyNode = rootNode.getChildTransformNodes(false).find(n => n.name === bodyName);
        if (bodyNode) {
          const axisSrc = jointAxes[jointName] || [1, 0, 0];
          const axis = convertAxis(axisSrc); // Use unified conversion
          const q = Quaternion.RotationAxis(axis, jointValue);
          bodyNode.rotationQuaternion = q;
        }
      }
    }

    // Mark as applied
    keyframeManager.markAsApplied(modelId, rootNode.id, keyframeName, Object.keys(jointMap).length);
    break; // Only apply first keyframe
  }
};
```

---

## Phase 5: Model Type Detection Simplification

**Current Issues:**

Lines 405-412, 752-759, 797-804 have **duplicate** mesh inventory logic:
```typescript
const meshInventory = {
  objCount: Array.from(meshFilesMap?.keys() || []).filter(f => f.toLowerCase().endsWith('.obj')).length,
  stlCount: Array.from(meshFilesMap?.keys() || []).filter(f => f.toLowerCase().endsWith('.stl')).length,
  glbCount: Array.from(meshFilesMap?.keys() || []).filter(f => f.toLowerCase().endsWith('.glb')).length,
  total: meshFilesMap?.size || 0
};
```

**Solution:** Use `MJCFModelTypeDetector.analyzeModel()` instead!

Replace all 3 occurrences with:
```typescript
import { MJCFModelTypeDetector } from './MJCFModelTypeDetector';

// After extracting mesh files
const modelAnalysis = MJCFModelTypeDetector.analyzeModel(meshFilesMap);
console.log(`[MJCF Import] Model type: ${modelAnalysis.primary}, confidence: ${modelAnalysis.confidence}`);
console.log(`[MJCF Import] Recommendations:`, modelAnalysis.recommendations);
```

---

## Integration Summary

### Agent 1 Completed:
✅ Phase 1: Unified coordinate conversion system
✅ Phase 2: Clean mesh loading (already correct)
✅ Phase 3: Proper kinematic hierarchy

### Agent 2 To Do:
🔧 Phase 4: Refactor `applyKeyframeData()` to remove conditional logic
🔧 Phase 5: Integrate `MJCFModelTypeDetector` to replace manual detection
🔧 Phase 6: Add validation with `MJCFValidator`
🔧 Phase 6: Add keyframe state management with `MJCFKeyframeManager`

---

## File Changes Needed

### 1. `MJCFLoader.ts` - Refactor `applyKeyframeData()` (lines 148-358)
- Remove OBJ/STL conditional branches
- Use unified coordinate conversion
- Integrate `MJCFKeyframeManager` for idempotence
- Remove mirror fix heuristics

### 2. `MJCFLoader.ts` - Replace mesh inventory (lines 405-412, 752-759, 797-804)
- Replace with `MJCFModelTypeDetector.analyzeModel()`
- Remove duplicate detection logic

### 3. `MJCFLoader.ts` - Add validation (line 974, after keyframe application)
- Integrate `MJCFValidator` to detect issues
- Log warnings/errors

---

## Test Plan

After refactoring, test with:
1. **OBJ-based models:** Unitree B2, GO2, G1 (should stand upright)
2. **STL-based models:** Unitree H1, H1_2 (should be correctly oriented)
3. **GLB-based models:** Any GLB robot models
4. **Mixed models:** Models with both OBJ and STL files
5. **Reload test:** Verify keyframes are not applied twice

---

**Next Step:** Agent 2 should refactor `applyKeyframeData()` function to use unified coordinate system and integrate the 3 utility classes.
