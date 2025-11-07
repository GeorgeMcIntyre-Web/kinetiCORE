# 🚨 SKYBOX RENDERING FIX - READ THIS FIRST

## Problem

**The skybox is created correctly but not visible because the scene's `clearColor` covers it.**

## Quick Fix

The fix has been applied to `src/routing/core/WarehouseModel.ts`. The skybox should now be visible.

## For Developers

**CRITICAL RULE:** When creating a skybox in Babylon.js, you MUST set:
```typescript
scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // alpha = 0 (transparent)
```

If `clearColor.alpha = 1`, the background color will cover the skybox completely.

## Documentation

- **Full fix details:** `docs/SKYBOX_RENDERING_FIX.md`
- **Rules for AI assistants:** `docs/CLAUDE_CODE_SKYBOX_RULES.md`
- **Debugging guide:** `docs/DEBUG_SKY_RENDERING.md`

## Testing

After the fix, you should see:
- ✅ Skybox visible in the 3D viewport
- ✅ Industrial sky (or selected skybox type) rendered
- ✅ No gray background covering the sky

If the skybox is still not visible, check:
1. Browser console for errors
2. `scene.clearColor.a` should be 0
3. Skybox mesh exists: `scene.getMeshByName('warehouse_skybox')`

---

**Status:** ✅ Fixed  
**Date:** 2024-12-02


