# Floor Debug Instructions

## Problem
Floor/ground plane is not visible in the scene.

## Quick Debug

### Step 1: Check if floor exists
Paste this in browser console (F12):
```javascript
const scene = window.sceneManager?.getScene?.();
if (scene) {
  const ground = scene.getMeshByName('ground');
  console.log('=== FLOOR DEBUG ===');
  console.log('Ground exists:', !!ground);
  if (ground) {
    console.log('Ground visible:', ground.isVisible);
    console.log('Ground enabled:', ground.isEnabled());
    console.log('Ground position:', ground.position);
    console.log('Ground scaling:', ground.scaling);
    console.log('Ground material:', ground.material?.name);
    console.log('Ground parent:', ground.parent?.name);
    console.log('Ground world matrix:', ground.getWorldMatrix());
  }
  console.log('Camera position:', scene.activeCamera?.position);
  console.log('Camera target:', scene.activeCamera?.target);
  console.log('===================');
}
```

### Step 2: Check camera view
```javascript
const scene = window.sceneManager?.getScene?.();
if (scene && scene.activeCamera) {
  const cam = scene.activeCamera;
  console.log('=== CAMERA DEBUG ===');
  console.log('Camera type:', cam.getClassName());
  console.log('Camera position:', cam.position);
  console.log('Camera target:', cam.target || 'N/A');
  console.log('Camera alpha:', cam.alpha);
  console.log('Camera beta:', cam.beta);
  console.log('Camera radius:', cam.radius);
  console.log('===================');
}
```

### Step 3: Try to make floor visible (if it exists)
```javascript
const scene = window.sceneManager?.getScene?.();
if (scene) {
  const ground = scene.getMeshByName('ground');
  if (ground) {
    ground.isVisible = true;
    ground.setEnabled(true);
    ground.position.y = 0;
    ground.scaling = new BABYLON.Vector3(100, 1, 100);
    console.log('Floor visibility forced ON');

    // Try changing material
    const mat = new BABYLON.StandardMaterial('debugFloor', scene);
    mat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    ground.material = mat;
    console.log('Floor material changed to debug gray');
  }
}
```

### Step 4: Check scene hierarchy
```javascript
const scene = window.sceneManager?.getScene?.();
if (scene) {
  console.log('=== SCENE MESHES ===');
  scene.meshes.forEach(m => {
    console.log(`Mesh: ${m.name}, visible: ${m.isVisible}, enabled: ${m.isEnabled()}`);
  });
}
```

## Expected Results

### If floor exists but is hidden:
- Output will show `Ground exists: true` but `Ground visible: false`
- **Fix:** Run Step 3 to make it visible

### If floor doesn't exist:
- Output will show `Ground exists: false`
- **Fix:** Need to check SceneManager initialization

### If camera is looking wrong direction:
- Camera position might be at (0, 0, 0) or very close to floor
- Camera beta might be 0 (looking horizontally)
- **Fix:** Reset camera position

## Known Floor Settings

From SceneManager.ts:
- Floor name: `'ground'`
- Floor size: 100m x 100m (GROUND_SIZE constant)
- Floor position: Y=0 (XZ plane)
- Floor type: Default is 'polished-concrete'
- Shadows: Enabled (`receiveShadows = true`)

## Reset Camera Script

If camera is the problem:
```javascript
const scene = window.sceneManager?.getScene?.();
if (scene && scene.activeCamera) {
  scene.activeCamera.position = new BABYLON.Vector3(5, 5, -10);
  scene.activeCamera.setTarget(BABYLON.Vector3.Zero());
  console.log('Camera reset to default position');
}
```

## Report Back

After running these scripts, report:
1. Does ground exist? (true/false)
2. Is ground visible? (true/false)
3. Camera position and target
4. Did Step 3 make the floor appear?
