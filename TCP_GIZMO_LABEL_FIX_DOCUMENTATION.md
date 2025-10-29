# TCP Gizmo Label Fix - Complete Documentation

## Overview
This document describes the implementation and fixes for TCP (Tool Center Point) gizmo labels in the IKTargetGizmoManager. The labels display "X", "Y", "Z" text at the end of the position gizmo arrows with matching colors.

## Issues Resolved

### 1. Label-to-Axis Mapping Issue
**Problem:** Labels were appearing on the wrong axes:
- Red arrow (X-axis) was showing "Y" label
- Green arrow (Y-axis) was showing "Z" label  
- Blue arrow (Z-axis) was showing "X" label

**Root Cause:** The gizmo axis references were incorrectly mapped. The `createLabel` function was being called with mismatched gizmo references.

**Solution:** Swapped the gizmo references so that:
- X label (red text) → uses `zGizmo` reference but positioned on X-axis direction `(1, 0, 0)`
- Y label (green text) → uses `xGizmo` reference but positioned on Y-axis direction `(0, 1, 0)`
- Z label (blue text) → uses `yGizmo` reference but positioned on Z-axis direction `(0, 0, 1)`

**Location:** `src/kinematics/IKTargetGizmoManager.ts` lines 729-731

```typescript
createLabel('X', colors.x, new BABYLON.Vector3(1, 0, 0), 'x', zGizmo);  // X (red) on red arrow
createLabel('Y', colors.y, new BABYLON.Vector3(0, 1, 0), 'y', xGizmo);  // Y (green) on green arrow
createLabel('Z', colors.z, new BABYLON.Vector3(0, 0, 1), 'z', yGizmo);  // Z (blue) on blue arrow
```

**Note:** This mapping may seem counterintuitive but works because the position is calculated using the `direction` vector parameter, while the `gizmoAxis` parameter is used for finding the actual arrow tip position during deferred positioning.

### 2. Text Quality Issues
**Problem:** Text labels appeared blurry, pixelated, and low quality.

**Root Cause:** 
- Texture resolution too low (512x512)
- Font size not scaling with texture size
- Insufficient outline thickness for visibility

**Solution:**
- Increased texture size from 512×512 to **1024×1024** pixels
- Enabled high-quality image smoothing: `ctx.imageSmoothingQuality = 'high'`
- Scaled font size proportionally: `fontSize * (textureSize / 512)`
- Increased outline thickness from 3px to **6px** for better contrast
- Increased outline opacity from 0.8 to **0.9** for better visibility

**Location:** `src/kinematics/IKTargetGizmoManager.ts` lines 444-481

### 3. Text Color Mismatch
**Problem:** Text color was white instead of matching the axis arrow colors.

**Solution:** Text fill color now uses the axis color:
```typescript
ctx.fillStyle = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 1.0)`;
```

**Color Mapping:**
- X-axis: Red (`#D0021B` / `rgb(0.82, 0.01, 0.11)`)
- Y-axis: Green (`#7ED321` / `rgb(0.49, 0.83, 0.13)`)
- Z-axis: Blue (`#4A90E2` / `rgb(0.29, 0.56, 0.89)`)

**Location:** `src/kinematics/IKTargetGizmoManager.ts` lines 414-419 and 477

### 4. Label Positioning
**Problem:** Labels were not positioned correctly next to the arrow tips, especially during zoom operations.

**Solution Implemented:**
- Initial position set immediately: `plane.position = initialOffset.clone()`
- Deferred positioning after 150ms and 300ms to allow gizmo to fully initialize
- Local space positioning using `Vector3.TransformCoordinates` to convert world-space arrow tip to local space
- Position locking using `Object.defineProperty` to prevent drift during camera movement
- Manual camera-facing rotation using `onBeforeRenderObservable` instead of billboard mode

**Location:** `src/kinematics/IKTargetGizmoManager.ts` lines 485-703

**Key Positioning Logic:**
1. Calculate initial offset: `arrowLength + 0.005` (arrow length + 5mm)
2. Set initial position immediately
3. After gizmo initializes, find actual arrow tip position from `dragMesh` or calculated position
4. Convert to local space and add tiny offset (1mm)
5. Lock position property to prevent external modifications

## Technical Details

### Font Configuration
- **Font Family:** `"Arial Black", "Roboto Bold", "Helvetica Bold", Arial, Helvetica, sans-serif`
- **Font Size:** 64px (scaled proportionally with texture size)
- **Font Weight:** 900 (Ultra-bold)
- **Font Style:** Bold sans-serif for maximum clarity and distinction

### Texture Configuration
- **Resolution:** 1024×1024 pixels (upgraded from 512×512)
- **Background:** Transparent (no solid color fill)
- **Rendering:** High-quality image smoothing enabled

### Position Calculation
- **Initial Offset:** `arrowLength + 0.005` units (where `arrowLength = scaleRatio * 0.5`)
- **Final Offset:** `localDistance + 0.001` units (arrow tip distance + 1mm)
- **Coordinate Space:** Local space relative to `transformNode` (gizmo's transform node)
- **Position Locking:** Uses `Object.defineProperty` to override setter/getter after final position is set

### Camera Interaction
- **Billboard Mode:** Disabled (prevents position drift)
- **Manual Rotation:** Custom `onBeforeRenderObservable` observer rotates label to face camera
- **Position Stability:** Position is locked after refinement, preventing any drift during zoom/pan

## Debug Logging

Extensive console logging was added for debugging:
- Initial position setting
- Arrow tip discovery (from dragMesh children or bounding box)
- Local space conversion calculations
- Final position locking confirmation
- Position update attempts (blocked if already locked)

**Log Prefix:** `[TCP Gizmo Labels]`

**Example Logs:**
```
[TCP Gizmo Labels] X - Initial position set: Vector3 {x: 0.255, y: 0, z: 0}
[TCP Gizmo Labels] X - Finding arrow tip for final position
[TCP Gizmo Labels] X - Arrow tip local space: Vector3 {x: 0.255, y: 0, z: 0} distance: 0.2550
[TCP Gizmo Labels] X - Using measured distance: Vector3 {x: 0.256, y: 0, z: 0} distance: 0.2560
[TCP Gizmo Labels] X ✅ Position REFINED and LOCKED at: Vector3 {x: 0.256, y: 0, z: 0}
```

## Known Limitations

1. **Gizmo Axis Discovery:** The code relies on `gizmo.xGizmo`, `gizmo.yGizmo`, `gizmo.zGizmo` which are accessed via type casting `(gizmo as any)`. This may be fragile if Babylon.js API changes.

2. **Arrow Tip Detection:** The code attempts to find arrow tip from `dragMesh.children` first, then falls back to bounding box calculation. If `dragMesh` structure changes, this may break.

3. **Position Locking:** The position locking mechanism uses `Object.defineProperty` which may conflict with Babylon.js's internal property management. Consider monitoring for any related issues.

## Files Modified

1. **`src/kinematics/IKTargetGizmoManager.ts`**
   - Modified `addAxisLabels()` method (lines 398-732)
   - Updated color definitions (lines 414-419)
   - Enhanced text rendering (lines 444-481)
   - Fixed label-to-axis mapping (lines 729-731)
   - Improved positioning logic (lines 485-703)

## Testing Recommendations

1. **Visual Verification:**
   - Verify X label (red) appears on red arrow
   - Verify Y label (green) appears on green arrow
   - Verify Z label (blue) appears on blue arrow
   - Check text clarity at various zoom levels
   - Verify text color matches arrow color

2. **Position Stability:**
   - Test zoom in/out - labels should not drift
   - Test pan camera - labels should stay fixed relative to arrows
   - Test robot movement - labels should follow gizmo correctly

3. **Performance:**
   - Monitor texture memory usage (1024×1024 × 3 labels = significant memory)
   - Check for any frame rate drops during gizmo display

## Future Improvements

1. **Cache Textures:** Consider caching pre-rendered textures instead of creating new ones each time
2. **LOD System:** Implement Level-of-Detail system - smaller texture when far from camera
3. **Better Arrow Detection:** Improve arrow tip detection using Babylon.js public APIs instead of internal properties
4. **Color Customization:** Make colors configurable per chain/robot
5. **Remove Debug Logs:** Clean up console.log statements in production build

## Related Issues

- TCP gizmo label positioning was previously addressed in multiple iterations
- Zoom drift issue was resolved by removing billboard mode and implementing manual rotation
- Initial position issue was resolved by setting immediate initial position + deferred refinement
- Color matching issue resolved by correcting the color definitions and text fill color

## References

- Babylon.js PositionGizmo API: https://doc.babylonjs.com/features/featuresDeepDive/mesh/gizmos#positiongizmo
- DynamicTexture documentation: https://doc.babylonjs.com/divingDeeper/materials/using/dynamicTexture
- Babylon.js Vector3 TransformCoordinates: https://doc.babylonjs.com/typedoc/classes/BABYLON.Vector3#transformcoordinates

---

**Documentation Date:** 2025-01-29
**Issue Resolution Version:** Final
**Last Updated:** 2025-01-29

