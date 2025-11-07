# 🎨 Skybox Creation Rules for Claude Code (AI Assistant)

## ⚠️ CRITICAL RULE: Scene Background Must Be Transparent

**When creating ANY skybox in Babylon.js, you MUST set the scene background to transparent or the skybox will NOT be visible.**

---

## ✅ Correct Pattern

```typescript
// 1. Create skybox texture
const skyboxTexture = BABYLON.CubeTexture.CreateFromImages(urls, scene);

// 2. Create skybox mesh
const skybox = BABYLON.MeshBuilder.CreateBox('skybox', { size: 1000 }, scene);

// 3. Create skybox material
const material = new BABYLON.StandardMaterial('skybox_mat', scene);
material.reflectionTexture = skyboxTexture;
material.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
material.backFaceCulling = false;
material.disableLighting = true;
material.disableDepthWrite = true;

// 4. Apply material to skybox
skybox.material = material;
skybox.infiniteDistance = true;
skybox.renderingGroupId = 0; // Render first (background)
skybox.isPickable = false;
skybox.setEnabled(true);
skybox.isVisible = true;

// 5. CRITICAL: Set scene background to transparent
// ⚠️ THIS IS REQUIRED - Without this, the skybox will be hidden!
scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // alpha = 0 means transparent
```

---

## ❌ Wrong Pattern (DO NOT USE)

```typescript
// ❌ WRONG - This will hide the skybox!
scene.clearColor = new BABYLON.Color4(0.12, 0.12, 0.14, 1); // alpha=1 covers skybox

// Even if you create the skybox correctly, this background color will cover it
```

---

## 🔍 Why This Happens

In Babylon.js rendering pipeline:

1. **Rendering Groups:** Objects render in order by `renderingGroupId` (0 = first, 1 = second, etc.)
2. **Skybox:** Renders in group 0 (background)
3. **Scene ClearColor:** Renders AFTER all rendering groups
4. **Problem:** If `clearColor.alpha = 1`, it completely covers everything in group 0 (including skybox)

**Solution:** Set `clearColor.alpha = 0` so the background is transparent and skybox shows through.

---

## 📋 Checklist When Creating Skyboxes

Always verify:

- [ ] Skybox mesh created
- [ ] Skybox material created with `reflectionTexture`
- [ ] Texture `coordinatesMode` set to `SKYBOX_MODE`
- [ ] `skybox.infiniteDistance = true`
- [ ] `skybox.renderingGroupId = 0`
- [ ] `material.disableDepthWrite = true`
- [ ] **`scene.clearColor.alpha = 0`** ⚠️ CRITICAL

---

## 🛠️ Alternative: Use Built-in Method

Babylon.js has a built-in skybox method that handles background correctly:

```typescript
// This automatically sets clearColor correctly
const skybox = scene.createDefaultSkybox(
  skyboxTexture,  // Environment texture
  true,           // Create environment
  1000,           // Size
  0.3             // Intensity
);
```

**However:** This method doesn't work with custom procedural textures, so for WarehouseModel we use the manual approach.

---

## 🐛 Debugging

If skybox is not visible, check:

```typescript
// 1. Check if skybox exists
const skybox = scene.getMeshByName('skybox');
console.log('Skybox exists:', !!skybox);
console.log('Skybox visible:', skybox?.isVisible);
console.log('Skybox enabled:', skybox?.isEnabled());

// 2. Check scene clearColor (MOST IMPORTANT)
console.log('Scene clearColor:', scene.clearColor);
console.log('ClearColor alpha:', scene.clearColor.a); // MUST be 0!

// 3. Fix if needed
if (skybox && scene.clearColor.a > 0) {
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
  console.log('✅ Fixed: Set clearColor to transparent');
}
```

---

## 📝 Examples from Codebase

### Correct Implementation (WarehouseModel.ts)

```typescript
private createSkybox(): void {
  // ... create skybox mesh and material ...
  
  this.skybox.material = skyboxMaterial;
  this.skybox.infiniteDistance = true;
  this.skybox.renderingGroupId = 0;
  
  // CRITICAL: Set scene background to transparent
  this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
}
```

### Wrong Implementation (SceneManager.ts - NEEDS FIX)

```typescript
// ❌ This is set in SceneManager.initialize()
this.scene.clearColor = new BABYLON.Color4(0.12, 0.12, 0.14, 1); // Wrong for skybox!
```

**Fix:** WarehouseModel now overrides this when skybox is enabled.

---

## 🎯 Summary

**RULE:** When creating a skybox, ALWAYS set `scene.clearColor = new BABYLON.Color4(0, 0, 0, 0)` after creating the skybox, or it will be invisible.

**Remember:** 
- `clearColor.alpha = 0` → Skybox visible ✅
- `clearColor.alpha = 1` → Skybox hidden ❌

---

**Last Updated:** 2024-12-02  
**Status:** ✅ Rules documented for all AI assistants


