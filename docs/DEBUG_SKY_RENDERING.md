# Debug Sky Rendering Issue - Step-by-Step Guide

This guide will help you set up MCP Chrome DevTools and debug the sky rendering problem.

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Configure MCP Chrome DevTools in Cursor

1. **Open Cursor Settings:**
   - Press `Ctrl+,` (Windows) or `Cmd+,` (Mac)
   - Or go to: File → Preferences → Settings

2. **Add MCP Server Configuration:**
   - Search for "MCP" or "Model Context Protocol"
   - Click "Add MCP Server" or edit `settings.json` directly

3. **Add this configuration:**
   ```json
   {
     "mcpServers": {
       "chrome-devtools": {
         "command": "npx",
         "args": ["chrome-devtools-mcp@latest"]
       }
     }
   }
   ```

4. **Restart Cursor** to apply the configuration

### Step 2: Start Chrome with Remote Debugging

**Option A: Use the provided script (Easiest)**
```bash
# Run the script
.\scripts\start-chrome-debug.bat
```

**Option B: Manual command**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-profile-stable"
```

### Step 3: Start Dev Server

In a separate terminal:
```bash
npm run dev
```

### Step 4: Open Application

Navigate to: `http://localhost:5173`

---

## 🔍 Debugging the Sky Issue

### Method 1: Use MCP DevTools Console (Recommended)

Once MCP is set up, you can ask the AI assistant to:

1. **Run the debug script:**
   ```
   Please run the skybox debugging script from scripts/debug-skybox.js in the browser console
   ```

2. **Take a screenshot:**
   ```
   Take a screenshot of the current view to see what's being rendered
   ```

3. **Check console logs:**
   ```
   Check the browser console for any errors related to skybox or WarehouseModel
   ```

### Method 2: Manual Browser Console

1. Open Chrome DevTools (`F12`)
2. Go to Console tab
3. Copy and paste the contents of `scripts/debug-skybox.js`
4. Press Enter to run

### Method 3: Direct Inspection

Run these commands in the browser console:

```javascript
// Check if skybox exists
const scene = window.scene || window.babylonScene;
const skybox = scene?.getMeshByName('warehouse_skybox');
console.log('Skybox:', skybox);
console.log('Skybox visible:', skybox?.isVisible);
console.log('Skybox enabled:', skybox?.isEnabled());

// Check camera settings
const camera = scene?.activeCamera;
console.log('Camera maxZ:', camera?.maxZ);
console.log('Camera position:', camera?.position);

// Check skybox size
if (skybox) {
  const bbox = skybox.getBoundingInfo();
  console.log('Skybox size:', bbox.boundingBox.maximumWorld.subtract(bbox.boundingBox.minimumWorld));
}
```

---

## 🐛 Common Issues and Fixes

### Issue 1: Skybox Not Found

**Symptoms:** Debug script shows "SKYBOX NOT FOUND"

**Possible Causes:**
- WarehouseModel not initialized
- Skybox creation failed silently
- Skybox was disposed

**Fix:**
```javascript
// Check if WarehouseModel is initialized
const warehouseControls = document.querySelector('[data-warehouse-controls]');
// Or check console for "[WarehouseModel]" logs

// Force recreate skybox
// (This would need to be done through the WarehouseControls component)
```

### Issue 2: Skybox Exists But Not Visible

**Symptoms:** Skybox found but `isVisible = false` or `isEnabled() = false`

**Fix:**
```javascript
const skybox = scene.getMeshByName('warehouse_skybox');
skybox.isVisible = true;
skybox.setEnabled(true);
skybox.renderingGroupId = 0;
skybox.infiniteDistance = true;
```

### Issue 3: Camera Can't See Skybox

**Symptoms:** Camera `maxZ` is too small

**Fix:**
```javascript
const camera = scene.activeCamera;
const skybox = scene.getMeshByName('warehouse_skybox');
const skyboxSize = skybox.getBoundingInfo().boundingBox.maximumWorld.y;
camera.maxZ = skyboxSize * 2; // Ensure camera can see beyond skybox
```

### Issue 4: Skybox Texture Not Loading

**Symptoms:** Skybox has no texture or texture is null

**Fix:**
```javascript
const skybox = scene.getMeshByName('warehouse_skybox');
const material = skybox.material;
const texture = material.reflectionTexture;

if (!texture) {
  console.error('Skybox texture missing!');
  // Check WarehouseModel.createSkyboxTexture() for errors
}
```

### Issue 5: Skybox Occluded by Other Objects

**Symptoms:** Skybox exists and is visible but can't see it

**Fix:**
```javascript
// Check rendering order
const skybox = scene.getMeshByName('warehouse_skybox');
skybox.renderingGroupId = 0; // Render first (background)

// Ensure material doesn't write to depth
const material = skybox.material;
material.disableDepthWrite = true;
```

### Issue 6: Scene Clear Color Hiding Skybox

**Symptoms:** Skybox renders but background color covers it

**Fix:**
```javascript
// Make scene background transparent or match skybox
scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // Transparent
// Or match skybox color
scene.clearColor = new BABYLON.Color4(0.48, 0.54, 0.62, 1); // Industrial sky color
```

---

## 📊 Diagnostic Checklist

Run through this checklist to identify the issue:

- [ ] MCP Chrome DevTools is configured and connected
- [ ] Chrome is running with `--remote-debugging-port=9222`
- [ ] Dev server is running (`npm run dev`)
- [ ] Application is open at `http://localhost:5173`
- [ ] WarehouseModel is initialized (check console for `[WarehouseModel]` logs)
- [ ] Skybox mesh exists (`scene.getMeshByName('warehouse_skybox')`)
- [ ] Skybox is enabled (`skybox.isEnabled() === true`)
- [ ] Skybox is visible (`skybox.isVisible === true`)
- [ ] Skybox has material (`skybox.material !== null`)
- [ ] Skybox has texture (`skybox.material.reflectionTexture !== null`)
- [ ] Camera can see skybox (`camera.maxZ > skybox size`)
- [ ] Skybox renderingGroupId is 0 (renders first)
- [ ] Skybox infiniteDistance is true
- [ ] Material disableDepthWrite is true
- [ ] No other meshes are occluding the skybox
- [ ] Scene clearColor allows skybox to be visible

---

## 🔧 Quick Fix Script

Run this in the browser console to apply all common fixes:

```javascript
(function fixSkybox() {
  const scene = window.scene || window.babylonScene;
  if (!scene) {
    console.error('No scene found!');
    return;
  }
  
  const skybox = scene.getMeshByName('warehouse_skybox');
  if (!skybox) {
    console.error('Skybox not found!');
    return;
  }
  
  // Apply all fixes
  skybox.isVisible = true;
  skybox.setEnabled(true);
  skybox.renderingGroupId = 0;
  skybox.infiniteDistance = true;
  
  const material = skybox.material;
  if (material) {
    material.disableDepthWrite = true;
    material.disableLighting = true;
  }
  
  const camera = scene.activeCamera;
  if (camera) {
    const bbox = skybox.getBoundingInfo();
    camera.maxZ = bbox.boundingBox.maximumWorld.y * 2;
  }
  
  console.log('✅ Skybox fixes applied!');
})();
```

---

## 📝 Next Steps

After running diagnostics:

1. **Share the results** with the debugging output
2. **Take screenshots** showing what you see vs. what you expect
3. **Check console logs** for any errors or warnings
4. **Verify WarehouseModel initialization** is happening correctly

---

## 🆘 Still Having Issues?

If the skybox still doesn't render:

1. Check `src/routing/core/WarehouseModel.ts` line 842 (`createSkybox()` method)
2. Verify `enableSkybox` is `true` in the config
3. Check if `createSkyboxTexture()` is returning a valid texture
4. Look for any errors in the browser console
5. Verify the scene is using the correct coordinate system

---

**Last Updated:** Based on WarehouseModel implementation in `feature/smart-routing-system` branch



