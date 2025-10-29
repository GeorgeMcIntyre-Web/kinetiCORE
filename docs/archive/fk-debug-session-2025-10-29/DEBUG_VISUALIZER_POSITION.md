# Debug Visualizer Position Issue

## Problem
Visualizer axes are not showing at the correct TCP position

## Quick Debug Command

Paste this in console after refresh:

```javascript
// Get chain
const km = kinematicsManager;
const fk = fkSolver;
const chains = km.getAllChains();
const chainName = chains[0].name;

console.log('=== Debug Visualizer Position ===');

// 1. Check TCP pose from FK
const tcpPose = fk.getNullTCPPose(chainName);
console.log('1. TCP from FK getNullTCPPose():');
console.log('   Position:', tcpPose.position.toString());
console.log('   Rotation:', tcpPose.rotation.toString());

// 2. Get mesh directly
const scene = sceneManager.getScene();
const tcpMeshes = scene.meshes.filter(m => m.name.includes('link_t') || m.name.includes('link6') || m.name.includes('tcp'));
console.log('2. TCP meshes found:', tcpMeshes.length);
tcpMeshes.forEach(m => {
  console.log(`   - ${m.name}: ${m.getAbsolutePosition().toString()}`);
});

// 3. Check joint positions
const joints = km.getActuatedJoints(chains[0].id);
console.log('3. Joint angles:');
joints.forEach((j, i) => {
  console.log(`   J${i}: ${(j.position * 180 / Math.PI).toFixed(1)}°`);
});

// 4. Test FK solve
const jointAngles = joints.map(j => j.position);
const fkResult = fk.solve(chainName, jointAngles);
console.log('4. FK solve() result (robot-local):');
console.log('   Position:', fkResult.position.toString());

// 5. Transform to world
const baseMatrix = km.getBaseWorldMatrix(chains[0].id) || BABYLON.Matrix.Identity();
const worldPos = BABYLON.Vector3.TransformCoordinates(fkResult.position, baseMatrix);
console.log('5. FK → World transform:');
console.log('   Position:', worldPos.toString());
console.log('   Base is identity:', baseMatrix.equals(BABYLON.Matrix.Identity()));

// 6. Enable visualizer with logging
const viz = TransformDebugVisualizer.getInstance();
const scene2 = sceneManager.getScene();
viz.initialize(scene2, fk, km);
viz.setEnabled(true, {
  showMeshFrames: true,
  showFKFrames: true,
  showDivergence: true,
  showBaseFrame: true,
  frameSize: 0.15
});
viz.update();

console.log('6. Visualizer enabled - check console output above');
console.log('   Look for "[TransformDebugVisualizer] Visualizing X frames"');
console.log('   Check if positions match TCP from step 1');
```

## Expected Output

You should see:
```
=== Debug Visualizer Position ===
1. TCP from FK getNullTCPPose():
   Position: {X: 0.4795 Y: 0.6799 Z: 0.0000}

2. TCP meshes found: 1-2
   - link_t: {X: 0.4795 Y: 0.6799 Z: 0.0000}

3. Joint angles:
   J0: 0.0°
   J1: 0.0°
   ...

4. FK solve() result (robot-local):
   Position: {X: 0.4795 Y: 0.6799 Z: 0.0000}

5. FK → World transform:
   Position: {X: 0.4795 Y: 0.6799 Z: 0.0000}
   Base is identity: true

6. Visualizer enabled
   [TransformDebugVisualizer] Visualizing 4 frames for motoman_mh5...
     - base at position: {X: 0 Y: 0 Z: 0}
     - fk at position: {X: 0.4795 Y: 0.6799 Z: 0.0000}
     - mesh at position: {X: 0.4795 Y: 0.6799 Z: 0.0000}
```

## If Axes Are at Wrong Position

Check if axes are at:
- **Origin (0, 0, 0):** TCP pose is wrong, FK not initialized
- **Far away:** Coordinate scale issue (mm vs m)
- **Different location:** Transform not applied correctly

## Manual Axes Creation Test

If you don't see axes, try creating them manually:

```javascript
// Create test axes at TCP position
const scene = sceneManager.getScene();
const tcpPos = fkSolver.getNullTCPPose(chains[0].name).position;

console.log('Creating test axes at:', tcpPos.toString());

// X-axis (red)
const xLine = BABYLON.MeshBuilder.CreateLines('testX', {
  points: [tcpPos, tcpPos.add(new BABYLON.Vector3(0.1, 0, 0))]
}, scene);
xLine.color = new BABYLON.Color3(1, 0, 0);

// Y-axis (green)
const yLine = BABYLON.MeshBuilder.CreateLines('testY', {
  points: [tcpPos, tcpPos.add(new BABYLON.Vector3(0, 0.1, 0))]
}, scene);
yLine.color = new BABYLON.Color3(0, 1, 0);

// Z-axis (blue)
const zLine = BABYLON.MeshBuilder.CreateLines('testZ', {
  points: [tcpPos, tcpPos.add(new BABYLON.Vector3(0, 0, 0.1))]
}, scene);
zLine.color = new BABYLON.Color3(0, 0, 1);

console.log('✅ Manual test axes created. Do you see them at TCP?');
```

## Next Steps

1. Run the debug command above
2. Check console output
3. Look at 3D viewport - do you see colored axes?
4. If yes: Where are they? (At TCP, at origin, elsewhere?)
5. Report back with console output and description

