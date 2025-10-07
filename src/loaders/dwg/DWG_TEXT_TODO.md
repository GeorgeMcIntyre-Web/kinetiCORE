# DWG TEXT Import - Known Issue

## Problem
TEXT entities from DWG files are processed (1781 entities in test file) but **not visible** in the viewport.

## Root Cause
The Babylon.js MSDF `TextRenderer` does **not create scene graph nodes** that can be parented or transformed. It uses an internal buffer-based rendering system that draws directly without creating meshes in `scene.meshes`.

## What We Tried
1. ✅ Extracted TEXT entities successfully (Sa2 entities, 1781 found)
2. ✅ Applied coordinate transformation (Z-up to Y-up via -90° X rotation)
3. ✅ Scaled text height by ~34x based on model size (from 0.1m to ~3.4m)
4. ❌ Could not parent TextRenderer output to DWG root node (no mesh exists)
5. ❌ TextRenderer.addParagraph() doesn't return references we can control

## Current State
- TEXT positions: ✅ Correctly transformed
- TEXT heights: ✅ Scaled appropriately (~34x multiplier)
- TEXT rendering: ❌ Not visible (likely depth buffer or rendering pipeline issue)

## Investigation Needed
1. **Check if TextRenderer is actually rendering** - Use browser dev tools to see if draw calls are happening
2. **Depth buffer issues** - TextRenderer might be behind geometry or depth testing disabled
3. **Billboard mode conflicts** - `isBillboard: true` might not work with transformed coordinates
4. **Alternative approach** - Consider creating individual text meshes using `BABYLON.MeshBuilder.CreateText()` instead of batch TextRenderer

## Code Locations
- [DWGLoader.ts:165-208](src/loaders/dwg/DWGLoader.ts#L165-L208) - TEXT transformation and scaling
- [DWGTextRenderer.ts:87-121](src/loaders/dwg/DWGTextRenderer.ts#L87-L121) - MSDF text rendering
- [DWGDatabaseToBabylonConverter.ts:641-671](src/loaders/dwg/DWGDatabaseToBabylonConverter.ts#L641-L671) - TEXT entity extraction

## Recommended Solution
Replace Babylon MSDF TextRenderer with manual mesh-based text rendering:
```typescript
// Instead of TextRenderer.addParagraph(), create individual meshes:
const textMesh = BABYLON.MeshBuilder.CreateText(
  text.contents,
  {
    font: "Arial",
    size: text.height,
    resolution: 64,
    depth: 0
  },
  scene
);
textMesh.position = text.position;
textMesh.parent = dwgRootNode; // Now we can parent it!
```

## Test File
- **File**: `OHP-B-01-9X-0001-26MY-V801-PRO-IMPBASE_20250912.dwg`
- **TEXT count**: 1781 entities
- **Model size**: 3456m × 3409m
- **Example TEXT**: "LIFT & TILT", "9X-200-2N", "Buffer Stand(4 Parts)"

## Console Output Example
```
[DWG Loader] Model size: 2892.33m, Text scale multiplier: 28.92x
[DWG Loader] TEXT #1: {
  contents: '{\\fArial|b0|i0|c0|p39;LIFT & TILT}',
  originalHeight: 0.1,
  scaledHeight: 2.892,
  transformedPos: '{X: -857.56 Y: -253.51 Z: -0.00}'
}
```

---
**Status**: Blocked - Needs alternative rendering approach
**Priority**: Medium - TEXT is supplementary, not critical for geometry viewing
**Assigned**: Next developer working on DWG import features
