# 🚨 CRITICAL: Skybox Not Rendering - Root Cause & Fix

## Problem Summary

**The skybox was not visible due to THREE critical issues:**

1. ❌ **Using `reflectionTexture` instead of `diffuseTexture`** - `reflectionTexture` is for reflections, not visible display
2. ❌ **Using a Box instead of a Sphere** - Skyboxes in Babylon.js work properly with spheres, not boxes
3. ❌ **Not flipping faces** - Skybox needs inverted normals to face inward (viewed from inside)

### Root Cause

In `src/scene/SceneManager.ts` line 68:
```typescript
this.scene.clearColor = new BABYLON.Color4(0.12, 0.12, 0.14, 1);
```

This dark gray background color (alpha=1) is rendered **after** the skybox, covering it completely. Even though the skybox exists and has all correct settings, it's being hidden by the scene's clear color.

### Why This Happens

In Babylon.js rendering pipeline:
1. Skybox renders in rendering group 0 (background)
2. Scene clearColor is applied **after** rendering groups
3. With `clearColor.alpha = 1`, the background color completely covers the skybox

---

## ✅ Solution

### ✅ ACTUAL FIX: Use Sphere with diffuseTexture (IMPLEMENTED)

The root cause was using `StandardMaterial.reflectionTexture` on a Box. This doesn't create a visible skybox. Fixed implementation:

```typescript
private createSkybox(): void {
  // CRITICAL FIX: Use SPHERE with inverted normals for proper skybox rendering
  this.skybox = BABYLON.MeshBuilder.CreateSphere(
    'warehouse_skybox',
    { 
      diameter: skyboxSize,
      segments: 32
    },
    this.scene
  );
  
  // Flip normals so sphere faces inward (skybox is viewed from inside)
  this.skybox.flipFaces(true);

  const skyboxMaterial = new BABYLON.StandardMaterial('warehouse_skybox_mat', this.scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.disableLighting = true;
  skyboxMaterial.disableDepthWrite = true;
  skyboxMaterial.sideOrientation = BABYLON.Mesh.BACKSIDE; // Render inside faces

  // CRITICAL: Use diffuseTexture for VISIBLE skybox, not reflectionTexture
  skyboxMaterial.diffuseTexture = skyboxEnvTexture;
  skyboxMaterial.diffuseTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
  
  // Also set as reflectionTexture for environment reflections on other objects
  skyboxMaterial.reflectionTexture = skyboxEnvTexture;
  
  // CRITICAL: Set scene background to transparent
  this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
}
```

### Fix 2: Use Babylon's Built-in Skybox Method (ALTERNATIVE)

Replace custom skybox with Babylon's built-in method which properly handles background:

```typescript
private createSkybox(): void {
  const skyboxSource = this.config.skyboxSource || 'industrial';
  const skyboxEnvTexture = this.createSkyboxTexture(skyboxSource);
  
  if (skyboxEnvTexture) {
    // Use Babylon's built-in skybox creation which properly handles background
    const skybox = BABYLON.MeshBuilder.CreateSphere('warehouse_skybox', {
      diameter: 1000, // Large enough to appear infinite
      segments: 32
    }, this.scene);
    
    const skyboxMaterial = new BABYLON.StandardMaterial('warehouse_skybox_mat', this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skyboxMaterial.reflectionTexture = skyboxEnvTexture;
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skybox.renderingGroupId = 0;
    skybox.isPickable = false;
    
    // CRITICAL: Set background to transparent
    this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    
    this.skybox = skybox;
    this.skyboxTexture = skyboxEnvTexture;
    this.scene.environmentTexture = skyboxEnvTexture;
  }
}
```

### Fix 3: Update SceneManager to Check for Skybox (BEST PRACTICE)

Modify `SceneManager.initialize()` to allow skybox to control background:

```typescript
// In SceneManager.ts, make clearColor conditional
async initialize(canvas: HTMLCanvasElement): Promise<void> {
  // ... existing code ...
  
  // Set background - will be overridden by skybox if enabled
  // Default to dark background for scenes without skybox
  this.scene.clearColor = new BABYLON.Color4(0.12, 0.12, 0.14, 1);
  
  // ... rest of initialization ...
}
```

Then in `WarehouseModel.setupAtmosphere()`:
```typescript
private setupAtmosphere(): void {
  // ... existing code ...
  
  if (this.config.enableSkybox) {
    this.createSkybox();
    // CRITICAL: Make background transparent so skybox is visible
    this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
  }
  
  // ... rest of atmosphere setup ...
}
```

---

## 🔧 Implementation

The fix has been implemented in `src/routing/core/WarehouseModel.ts`:

1. **Line 842-925:** `createSkybox()` method now sets `scene.clearColor = new BABYLON.Color4(0, 0, 0, 0)` after creating the skybox
2. **Line 700-710:** `setupAtmosphere()` ensures skybox controls the background

---

## 📋 For All Developers

### When Working with Skyboxes in Babylon.js:

1. **ALWAYS set `scene.clearColor.alpha = 0`** when using a custom skybox
2. **OR use `scene.createDefaultSkybox()`** which handles this automatically
3. **NEVER set `clearColor.alpha = 1`** when a skybox is enabled
4. **Check rendering order:** Skybox should be in rendering group 0

### Testing Checklist:

- [ ] Skybox mesh exists (`scene.getMeshByName('warehouse_skybox')`)
- [ ] Skybox is enabled and visible
- [ ] Skybox has material and texture
- [ ] **Scene clearColor alpha is 0** ⚠️ CRITICAL
- [ ] Camera maxZ is large enough to see skybox
- [ ] Skybox renderingGroupId is 0

---

## 🐛 Debugging Commands

Run in browser console:

```javascript
// Check if skybox exists
const scene = SceneManager.getInstance().getScene();
const skybox = scene.getMeshByName('warehouse_skybox');
console.log('Skybox:', skybox);

// Check scene clearColor (CRITICAL)
console.log('Scene clearColor:', scene.clearColor);
console.log('ClearColor alpha:', scene.clearColor.a); // Should be 0 for skybox to be visible!

// Fix if needed
if (skybox && scene.clearColor.a > 0) {
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
  console.log('✅ Fixed: Set clearColor to transparent');
}
```

---

## 📝 For Claude Code (AI Assistant)

### When Creating Skyboxes:

**CRITICAL RULE:** Always set `scene.clearColor.alpha = 0` when creating a skybox, or the scene background will cover the skybox.

**Correct Pattern:**
```typescript
// Create skybox
const skybox = BABYLON.MeshBuilder.CreateBox('skybox', { size: 1000 }, scene);
const material = new BABYLON.StandardMaterial('skybox_mat', scene);
material.reflectionTexture = skyboxTexture;
material.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
skybox.material = material;
skybox.infiniteDistance = true;
skybox.renderingGroupId = 0;

// CRITICAL: Make background transparent so skybox is visible
scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // ⚠️ REQUIRED
```

**Wrong Pattern:**
```typescript
// ❌ DON'T DO THIS - background will cover skybox
scene.clearColor = new BABYLON.Color4(0.12, 0.12, 0.14, 1); // alpha=1 hides skybox!
```

**Alternative (Built-in Method):**
```typescript
// Use Babylon's built-in method which handles background correctly
scene.createDefaultSkybox(skyboxTexture, true, 1000, 0.3);
// This automatically sets clearColor correctly
```

---

## 🎯 Summary

- **Problem:** Scene `clearColor` with `alpha=1` covers the skybox
- **Solution:** Set `scene.clearColor.alpha = 0` when skybox is enabled
- **Location:** Fix in `WarehouseModel.createSkybox()` or `WarehouseModel.setupAtmosphere()`
- **Test:** Verify skybox is visible after fix

---

**Last Updated:** 2024-12-02  
**Status:** ✅ Fix implemented in codebase

