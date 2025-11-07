# Routing System Diagnostic Test Script

**Purpose:** Comprehensive diagnostic to identify what's working and what's broken
**Browser:** Chrome/Edge with DevTools
**Server:** http://localhost:5176

---

## Step 1: Open Browser and DevTools

1. Open Chrome/Edge
2. Navigate to `http://localhost:5176`
3. Press `F12` to open DevTools
4. Go to **Console** tab
5. Clear console (`Ctrl+L` or click Clear button)

---

## Step 2: Run Initial Diagnostics

Copy and paste this into the browser console:

```javascript
// ===== DIAGNOSTIC SCRIPT =====
console.clear();
console.log("🔍 Starting kinetiCORE Routing Diagnostics...\n");

// Test 1: Check if stores are initialized
console.log("📦 TEST 1: Store Initialization");
try {
  const { useEditorStore } = await import('./src/ui/store/editorStore');
  const { useRoutingStore } = await import('./src/ui/store/routingStore');

  const editorState = useEditorStore.getState();
  const routingState = useRoutingStore.getState();

  console.log("✅ editorStore exists:", !!editorState);
  console.log("✅ routingStore exists:", !!routingState);
  console.log("✅ commandManager exists:", !!editorState.commandManager);
  console.log("✅ currentRouteType:", routingState.currentRouteType);
  console.log("✅ activeRoutes count:", routingState.activeRoutes.length);
  console.log("✅ connectionPoints count:", routingState.connectionPoints.length);
  console.log("");
} catch (error) {
  console.error("❌ Store initialization failed:", error);
}

// Test 2: Check ConnectionManager
console.log("🔗 TEST 2: ConnectionManager");
try {
  const { ConnectionManager } = await import('./src/routing/core/ConnectionManager');
  const cm = ConnectionManager.getInstance();

  console.log("✅ ConnectionManager singleton exists:", !!cm);
  console.log("✅ Connection points count:", cm.getConnectionPointCount());
  console.log("✅ Connections count:", cm.getConnectionCount());
  console.log("");
} catch (error) {
  console.error("❌ ConnectionManager failed:", error);
}

// Test 3: Check Scene
console.log("🎬 TEST 3: Babylon.js Scene");
try {
  const { SceneManager } = await import('./src/scene/SceneManager');
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();

  console.log("✅ SceneManager exists:", !!sceneManager);
  console.log("✅ Scene exists:", !!scene);
  console.log("✅ Scene ready:", scene?.isReady());
  console.log("✅ Meshes in scene:", scene?.meshes.length);
  console.log("✅ Camera exists:", !!scene?.activeCamera);
  console.log("");

  // List all meshes
  if (scene) {
    console.log("📋 Meshes in scene:");
    scene.meshes.forEach((mesh, i) => {
      console.log(`  ${i + 1}. ${mesh.name} (visible: ${mesh.isVisible}, enabled: ${mesh.isEnabled()})`);
      if (mesh.metadata?.isRoute) {
        console.log(`     ⚠️ This is a ROUTE mesh! RouteID: ${mesh.metadata.routeId}`);
      }
    });
    console.log("");
  }
} catch (error) {
  console.error("❌ Scene check failed:", error);
}

// Test 4: Check if Professional Mode is active
console.log("🏢 TEST 4: Professional Mode Status");
try {
  const header = document.querySelector('[class*="mode-selector"]') || document.querySelector('header');
  console.log("✅ Header element exists:", !!header);

  const ribbonToolbar = document.querySelector('[class*="ribbon-toolbar"]');
  console.log("✅ Ribbon toolbar exists:", !!ribbonToolbar);

  const dockableWrapper = document.querySelector('[class*="dockable"]');
  console.log("✅ Dockable layout wrapper exists:", !!dockableWrapper);
  console.log("");
} catch (error) {
  console.error("❌ UI check failed:", error);
}

console.log("✅ Diagnostics complete!\n");
console.log("📝 Next step: Run Quick Preset Test (see below)");
```

---

## Step 3: Analyze Diagnostic Results

Look for these patterns:

### ✅ ALL GREEN (Working)
```
✅ editorStore exists: true
✅ routingStore exists: true
✅ commandManager exists: true
✅ ConnectionManager singleton exists: true
✅ SceneManager exists: true
✅ Scene exists: true
```

### ❌ RED FLAGS (Broken)
```
❌ commandManager exists: false  → CommandManager not initialized
❌ Scene exists: false           → Babylon.js not loading
❌ Ribbon toolbar exists: false  → Professional Mode not rendering
```

---

## Step 4: Test Quick Preset Creation

If Step 2 passed, run this next:

```javascript
// ===== QUICK PRESET TEST =====
console.clear();
console.log("🚀 Testing Quick Preset Route Creation...\n");

async function testQuickPreset() {
  try {
    // Import required modules
    const { createPresetRoute } = await import('./src/routing/ui/QuickRoutePresets');

    console.log("📍 Creating test pipe route...");
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 2, y: 0, z: 0 };

    console.log(`Start: (${start.x}, ${start.y}, ${start.z})`);
    console.log(`End: (${end.x}, ${end.y}, ${end.z})`);
    console.log("");

    // Create preset route
    await createPresetRoute('pipe', start, end);

    console.log("\n✅ Test completed! Check for:");
    console.log("  1. Gray pipe mesh in 3D viewport");
    console.log("  2. Console logs showing creation steps");
    console.log("  3. Statistics panel updated");
    console.log("  4. Debug label (if labels enabled)");

  } catch (error) {
    console.error("❌ Quick preset test failed:", error);
    console.error("Stack trace:", error.stack);
  }
}

testQuickPreset();
```

### Expected Console Output:
```
[QuickRoutePresets] Creating pipe route from {x: 0, y: 0, z: 0} to {x: 2, y: 0, z: 0}
[QuickRoutePresets] Executing connection point commands...
[QuickRoutePresets] Found connection points, creating route...
[RoutingWorkflowHandler] Creating route between points...
[QuickRoutePresets] Generating geometry for route: route_xxxxx
[GeometryGeneratorFactory] 🏭 Creating generator for type: pipe
[PipeGenerator] 🔧 Generating pipe for route: route_xxxxx
[PipeGenerator] Processing segment: straight length: 2
[PipeGenerator] ✅ Created tube: tube_seg_xxxxx
[PipeGenerator] Total meshes created: 1
[PipeGenerator] ✅ Combined mesh created: pipe_route_xxxxx
[GenerateRouteGeometryCommand] ✅ Geometry generated: pipe_route_xxxxx
[QuickRoutePresets] Route creation complete!
```

### Common Errors:

#### Error 1: `setCurrentRouteType not found`
```
❌ Cause: routingStore not initialized
Fix: Check App.tsx initializes routingStore
```

#### Error 2: `Failed to find connection points`
```
❌ Cause: ConnectionManager.findNearbyConnections returns empty array
Debug:
  - Check connection points were created
  - Check search radius (0.05)
  - Check position coordinates
```

#### Error 3: `Scene not available`
```
❌ Cause: Babylon.js scene not initialized
Fix: Check SceneCanvas component rendering
      Check SceneManager.getInstance().getScene() returns scene
```

---

## Step 5: Manual Route Creation Test

Test creating a route manually (without presets):

```javascript
// ===== MANUAL ROUTE CREATION TEST =====
console.clear();
console.log("🛠️ Testing Manual Route Creation...\n");

async function testManualRoute() {
  try {
    // Import modules
    const { useRoutingStore } = await import('./src/ui/store/routingStore');
    const { useEditorStore } = await import('./src/ui/store/editorStore');
    const { ConnectionManager } = await import('./src/routing/core/ConnectionManager');
    const { CreateConnectionPointCommand } = await import('./src/routing/commands/CreateConnectionPointCommand');
    const { RoutingWorkflowHandler } = await import('./src/routing/ui/RoutingWorkflowHandler');
    const { GenerateRouteGeometryCommand } = await import('./src/routing/commands/GenerateRouteGeometryCommand');

    const routingStore = useRoutingStore.getState();
    const commandManager = useEditorStore.getState().commandManager;
    const cm = ConnectionManager.getInstance();

    // Step 1: Set route type
    console.log("Step 1: Set route type to 'electrical'");
    routingStore.setCurrentRouteType('electrical');
    console.log("✅ Route type set:", routingStore.currentRouteType);

    // Step 2: Create connection point A
    console.log("\nStep 2: Create connection point A");
    const cmdA = new CreateConnectionPointCommand({
      type: 'electrical',
      position: { x: -1, y: 0, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      specifications: { voltage: 120, current: 15 }
    });
    commandManager.execute(cmdA);
    console.log("✅ Connection point A created");
    console.log("   Total connection points:", cm.getConnectionPointCount());

    // Step 3: Create connection point B
    console.log("\nStep 3: Create connection point B");
    const cmdB = new CreateConnectionPointCommand({
      type: 'electrical',
      position: { x: 1, y: 0, z: 0 },
      direction: { x: -1, y: 0, z: 0 },
      specifications: { voltage: 120, current: 15 }
    });
    commandManager.execute(cmdB);
    console.log("✅ Connection point B created");
    console.log("   Total connection points:", cm.getConnectionPointCount());

    // Step 4: Find connection points
    console.log("\nStep 4: Find connection points");
    const pointA = cm.findNearbyConnections({ x: -1, y: 0, z: 0 }, 0.1)[0];
    const pointB = cm.findNearbyConnections({ x: 1, y: 0, z: 0 }, 0.1)[0];
    console.log("✅ Point A found:", !!pointA, pointA?.getId());
    console.log("✅ Point B found:", !!pointB, pointB?.getId());

    if (!pointA || !pointB) {
      throw new Error("Failed to find connection points!");
    }

    // Step 5: Create route
    console.log("\nStep 5: Create route between points");
    const routeId = await RoutingWorkflowHandler.createRouteBetweenPoints(
      pointA.getId(),
      pointB.getId()
    );
    console.log("✅ Route created:", routeId);
    console.log("   Total active routes:", routingStore.activeRoutes.length);

    // Step 6: Generate geometry
    console.log("\nStep 6: Generate geometry");
    const genCmd = new GenerateRouteGeometryCommand(routeId);
    commandManager.execute(genCmd);
    console.log("✅ Geometry generation command executed");

    // Step 7: Verify mesh exists
    console.log("\nStep 7: Verify mesh in scene");
    const { SceneManager } = await import('./src/scene/SceneManager');
    const scene = SceneManager.getInstance().getScene();
    const routeMesh = scene.meshes.find(m => m.metadata?.routeId === routeId);
    console.log("✅ Route mesh found:", !!routeMesh);
    console.log("✅ Mesh name:", routeMesh?.name);
    console.log("✅ Mesh visible:", routeMesh?.isVisible);
    console.log("✅ Mesh enabled:", routeMesh?.isEnabled());
    console.log("✅ Mesh position:", routeMesh?.position);

    console.log("\n✅ Manual route creation test complete!");
    console.log("👀 Look for yellow wire bundle in 3D viewport");

  } catch (error) {
    console.error("❌ Manual route creation failed:", error);
    console.error("Stack trace:", error.stack);
  }
}

testManualRoute();
```

---

## Step 6: Test Panel Visibility

Check if panels are working:

```javascript
// ===== PANEL VISIBILITY TEST =====
console.clear();
console.log("📊 Testing Panel Visibility...\n");

// Check for panel elements
console.log("1. Edit Panel:");
const editPanel = document.querySelector('[class*="route-edit-panel"]') ||
                  document.querySelector('[data-panel="edit"]');
console.log("   Found:", !!editPanel);

console.log("\n2. Statistics Panel:");
const statsPanel = document.querySelector('[class*="route-stats-panel"]') ||
                   document.querySelector('[data-panel="statistics"]');
console.log("   Found:", !!statsPanel);

console.log("\n3. Templates Panel:");
const templatesPanel = document.querySelector('[class*="route-templates-panel"]') ||
                       document.querySelector('[data-panel="templates"]');
console.log("   Found:", !!templatesPanel);

console.log("\n4. Warnings Panel:");
const warningsPanel = document.querySelector('[class*="route-warnings-panel"]') ||
                      document.querySelector('[data-panel="warnings"]');
console.log("   Found:", !!warningsPanel);

console.log("\n5. Ribbon Toolbar:");
const ribbon = document.querySelector('[class*="ribbon-toolbar"]');
console.log("   Found:", !!ribbon);

if (ribbon) {
  const buttons = ribbon.querySelectorAll('button');
  console.log("   Buttons found:", buttons.length);
  buttons.forEach((btn, i) => {
    console.log(`     ${i + 1}. ${btn.textContent || btn.title || 'Icon button'}`);
  });
}

console.log("\n✅ Panel visibility test complete!");
```

---

## Step 7: Test Camera and Viewport

Check if viewport is working:

```javascript
// ===== VIEWPORT TEST =====
console.clear();
console.log("👁️ Testing Viewport and Camera...\n");

async function testViewport() {
  try {
    const { SceneManager } = await import('./src/scene/SceneManager');
    const scene = SceneManager.getInstance().getScene();

    if (!scene) {
      console.error("❌ Scene not found!");
      return;
    }

    console.log("✅ Scene exists:", !!scene);
    console.log("✅ Scene ready:", scene.isReady());

    const camera = scene.activeCamera;
    console.log("✅ Camera exists:", !!camera);
    console.log("   Camera type:", camera?.getClassName());
    console.log("   Camera position:", camera?.position);
    console.log("   Camera target:", camera?.target || "N/A");

    const canvas = scene.getEngine().getRenderingCanvas();
    console.log("✅ Canvas exists:", !!canvas);
    console.log("   Canvas size:", canvas?.width, "x", canvas?.height);
    console.log("   Canvas visible:", canvas?.style.display !== 'none');

    // Check render loop
    let frameCount = 0;
    const testRender = scene.onBeforeRenderObservable.add(() => {
      frameCount++;
      if (frameCount >= 10) {
        console.log("✅ Render loop active:", frameCount, "frames rendered");
        scene.onBeforeRenderObservable.removeCallback(testRender);
      }
    });

  } catch (error) {
    console.error("❌ Viewport test failed:", error);
  }
}

testViewport();
```

---

## Summary Report Template

After running all tests, fill in this summary:

```
=== kinetiCORE Routing System Diagnostic Report ===
Date: [DATE]
Browser: [Chrome/Edge version]
Dev Server: http://localhost:5176

INITIALIZATION:
[ ] editorStore exists
[ ] routingStore exists
[ ] commandManager exists
[ ] ConnectionManager exists
[ ] SceneManager exists
[ ] Scene ready

UI ELEMENTS:
[ ] Professional Mode active
[ ] Ribbon toolbar visible
[ ] Edit panel available
[ ] Statistics panel available
[ ] Templates panel available
[ ] Warnings panel available

ROUTE CREATION:
[ ] Quick preset (Pipe) works
[ ] Quick preset (Electrical) works
[ ] Quick preset (Tray) works
[ ] Quick preset (Conduit) works
[ ] Manual route creation works

3D VISUALIZATION:
[ ] Viewport visible (not black)
[ ] Camera controls work
[ ] Route meshes appear
[ ] Debug labels work
[ ] Meshes have correct materials

ISSUES FOUND:
1. [Description]
2. [Description]
3. [Description]

CONSOLE ERRORS:
[Paste any error messages here]

SCREENSHOTS:
[Attach screenshots of issues]

=== End Report ===
```

---

## Next Steps After Diagnosis

Based on diagnostic results:

### If Stores Not Initialized:
→ Check `src/App.tsx` store initialization
→ Check if stores are imported correctly
→ Check if Zustand is installed

### If Scene Not Working:
→ Check `src/scene/SceneCanvas.tsx`
→ Check Babylon.js imports
→ Check canvas rendering

### If Quick Presets Fail:
→ Check `src/routing/ui/QuickRoutePresets.ts`
→ Check ConnectionManager functionality
→ Check RoutingWorkflowHandler

### If Geometry Not Visible:
→ Check geometry generators
→ Check material creation
→ Check mesh visibility flags
→ Check coordinate system conversions

### If Panels Not Working:
→ Check Dockview library loaded
→ Check panel components rendering
→ Check CSS styles applied

---

**Contact Information:**
- Report issues to George (Architecture Lead)
- Reference this diagnostic report
- Include console logs and screenshots
