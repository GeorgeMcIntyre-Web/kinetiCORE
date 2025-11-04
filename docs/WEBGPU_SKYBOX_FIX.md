# 🚨 WebGPU Skybox Error Fix

## Problem

**WebGPU Validation Error:**
```
Dimension (TextureViewDimension::Cube) doesn't match the expected dimension (TextureViewDimension::e2D)
```

This error occurs because the `DefaultRenderingPipeline`'s bloom post-processing tries to sample the skybox's cube texture as a 2D texture, which WebGPU doesn't allow.

## Root Cause

1. **Skybox uses CubeTexture** - Created from 6 canvas faces
2. **DefaultRenderingPipeline bloom enabled** - Processes all meshes for highlights extraction
3. **WebGPU validation** - Cube textures cannot be sampled as 2D textures in post-processing shaders

## ✅ Solution

### Fix 1: Exclude Skybox from Post-Processing (CURRENT IMPLEMENTATION)

The skybox is now:
- Created with `renderingGroupId = 0` (renders first, before post-processing)
- Uses `reflectionTexture` only (not `emissiveTexture` to avoid pipeline issues)
- Marked with `doNotSerialize = true` to help pipeline exclusion
- Configured after pipeline creation to ensure proper exclusion

### Fix 2: Use Only reflectionTexture (NO emissiveTexture)

**CRITICAL:** Do NOT use `emissiveTexture` with cube textures when post-processing is enabled. This causes WebGPU errors.

**Correct:**
```typescript
skyboxMaterial.reflectionTexture = skyboxEnvTexture;
skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
skyboxMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1); // Use color, not texture
```

**Wrong:**
```typescript
skyboxMaterial.emissiveTexture = skyboxEnvTexture; // ❌ Causes WebGPU errors!
```

### Fix 3: Ensure Skybox Renders Before Post-Processing

```typescript
skybox.renderingGroupId = 0; // Render first (background)
skybox.infiniteDistance = true;
skybox.doNotSerialize = true; // Helps with pipeline exclusion
```

## 📋 Implementation Checklist

When creating skyboxes with post-processing enabled:

- [ ] Use Sphere (not Box) for skybox mesh
- [ ] Use `reflectionTexture` (not `diffuseTexture`)
- [ ] Do NOT use `emissiveTexture` with cube texture
- [ ] Set `renderingGroupId = 0`
- [ ] Set `scene.clearColor.alpha = 0`
- [ ] Mark skybox with `doNotSerialize = true`
- [ ] Ensure pipeline is created AFTER skybox

## 🐛 Debugging

If WebGPU errors persist:

```javascript
// Check skybox material
const skybox = scene.getMeshByName('warehouse_skybox');
const material = skybox?.material;
console.log('Has emissiveTexture:', !!material?.emissiveTexture); // Should be false
console.log('Has reflectionTexture:', !!material?.reflectionTexture); // Should be true
console.log('RenderingGroupId:', skybox?.renderingGroupId); // Should be 0

// Check pipeline
const pipeline = scene.postProcessRenderPipelineManager.registeredPipelines[0];
console.log('Bloom enabled:', pipeline?.bloomEnabled);
```

## 📝 For All Developers

**CRITICAL RULE:** When using cube textures with post-processing pipelines:
- ✅ Use `reflectionTexture` for cube textures
- ❌ NEVER use `emissiveTexture` with cube textures when bloom is enabled
- ✅ Set `renderingGroupId = 0` to render before post-processing
- ✅ Set `scene.clearColor.alpha = 0` for skybox visibility

---

**Status:** ✅ Fixed  
**Date:** 2024-12-02  
**File:** `src/routing/core/WarehouseModel.ts`

