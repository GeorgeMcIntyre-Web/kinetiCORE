# 🚀 START HERE - MH5 Debug (Updated Commands)

**Status:** Code updated, ready to test! ✅

---

## ⚡ Quick Commands (Copy-Paste)

After refreshing the browser, these variables are now globally available:
- `window.kinematicsManager` or just `kinematicsManager`
- `window.fkSolver` or just `fkSolver`
- `window.ikSolver` or just `ikSolver`
- `window.sceneManager` or just `sceneManager`
- `TransformDebugVisualizer` (class)
- `IKTestHarness` (class)

---

## 📋 Step-by-Step Commands

### Step 0: Refresh Browser
Press `F5` or `Ctrl+R` to load the updated code

### Step 1: Check Robot Status ✅
```javascript
const km = kinematicsManager;
const fk = fkSolver;
const ik = ikSolver;
const chains = km.getAllChains();

console.log('╔═══════════════════════════════════════╗');
console.log('║      MH5 Robot Status Check           ║');
console.log('╚═══════════════════════════════════════╝');
console.log('Chains found:', chains.length);
chains.forEach(c => {
  console.log(`  - ${c.name}`);
  console.log(`    Joints: ${c.joints.length}`);
  console.log(`    Type: ${c.type || 'serial'}`);
});

if (chains.length === 0) {
  console.error('❌ No chains found! Robot not loaded properly.');
} else {
  console.log('✅ Robot detected!');
}
```

**Expected Output:**
```
╔═══════════════════════════════════════╗
║      MH5 Robot Status Check           ║
╚═══════════════════════════════════════╝
Chains found: 1
  - motoman_mh5
    Joints: 6
    Type: serial
✅ Robot detected!
```

---

### Step 2: Enable Visual Debugger 🎨
```javascript
const scene = sceneManager.getScene();
const viz = TransformDebugVisualizer.getInstance();

// Initialize
viz.initialize(scene, fk, km);

// Enable with options
viz.setEnabled(true, {
  showMeshFrames: true,      // RGB axes (actual mesh)
  showFKFrames: true,        // CMY axes (computed)
  showDivergence: true,      // Red line if >1mm
  showBaseFrame: true,       // Gray axes at base
  showTCPFrame: true,        // Orange axes at TCP
  frameSize: 0.15,           // 15cm arrows (good for MH5)
  divergenceThreshold: 0.001 // 1mm threshold
});

// Update visualization
viz.update();

console.log('✅ Visual debugger enabled!');
console.log('👀 Look at robot TCP for colored axes:');
console.log('   - RGB (Red/Green/Blue) = Mesh position');
console.log('   - CMY (Cyan/Magenta/Yellow) = FK computed');
console.log('   - Red line = Divergence >1mm');
```

**Expected Result:**
- Look at robot's tool tip (TCP)
- You should see **colored XYZ axes**
- If RGB and CMY overlap: ✅ Transforms are correct!
- If red line appears: ❌ Divergence detected!

---

### Step 3: Get Current TCP Pose 📍
```javascript
const chainName = chains[0].name;
const tcpPose = fk.getNullTCPPose(chainName);

if (!tcpPose) {
  console.error('❌ TCP pose is null! FK not initialized.');
} else {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║        Current TCP Pose               ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('Position (Babylon Y-up, meters):');
  console.log(`  X: ${tcpPose.position.x.toFixed(4)}m`);
  console.log(`  Y: ${tcpPose.position.y.toFixed(4)}m`);
  console.log(`  Z: ${tcpPose.position.z.toFixed(4)}m`);

  const euler = tcpPose.rotation.toEulerAngles();
  console.log('Rotation (Euler angles, degrees):');
  console.log(`  RX: ${(euler.x * 180 / Math.PI).toFixed(1)}°`);
  console.log(`  RY: ${(euler.y * 180 / Math.PI).toFixed(1)}°`);
  console.log(`  RZ: ${(euler.z * 180 / Math.PI).toFixed(1)}°`);
}
```

---

### Step 4: Initialize Test Harness 🧪
```javascript
const harness = IKTestHarness.getInstance();
harness.initialize(fk, ik, km);

console.log('✅ IK Test Harness initialized!');
```

---

### Step 5: Test IK (+10mm in X) 🎯
```javascript
const currentPose = harness.getCurrentEulerPose(chainName);

if (!currentPose) {
  console.error('❌ Failed to get current pose!');
} else {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║              Testing IK: +10mm in X                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  // Test moving 10mm in +X direction
  const testPose = {
    ...currentPose,
    x: currentPose.x + 0.010  // Add 10mm = 0.010m
  };

  harness.testEulerPose(chainName, testPose);
}
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════════╗
║          IK Test Harness - Euler Pose Input                    ║
╚════════════════════════════════════════════════════════════════╝

[IKTestHarness] Testing chain: motoman_mh5
[IKTestHarness] Target pose:
  Position: X=0.5334m Y=0.3120m Z=0.2456m
  Rotation: RX=12.3° RY=5.7° RZ=-8.2°

[IKTestHarness] Solving IK...

[IKTestHarness] IK Result:
  Success: ✅
  Error: 0.004123m
  Iterations: 47
  Joint angles (degrees): [12.5, 18.3, -28.7, 2.1, 43.2, -5.8]°

[IKTestHarness] Verification:
  Position error: 4.12mm
  Orientation error: 0.87°

[IKTestHarness] Assessment:
  ✅ EXCELLENT: Position <5mm, Orientation <5°
```

---

### Step 6: Run Full Test Suite 📊
```javascript
console.log('\n🧪 Running full test suite (6 poses)...\n');
harness.runTestSuite(chainName);
```

**This will test:**
1. +X 10mm
2. -X 10mm
3. +Y 10mm
4. +Z 10mm
5. RZ +15°
6. +X 10mm + RZ +10° (combined)

**Expected Summary:**
```
╔═══════════════════════════════════════════════════════════════════╗
║                        Test Suite Summary                         ║
╚═══════════════════════════════════════════════════════════════════╝

Tests passed: 6/6 (100%)

Individual results:
  ✅ Test 1: +X 10mm: error=4.12mm, iter=47
  ✅ Test 2: -X 10mm: error=3.89mm, iter=52
  ✅ Test 3: +Y 10mm: error=4.56mm, iter=61
  ✅ Test 4: +Z 10mm: error=4.23mm, iter=55
  ✅ Test 5: RZ +15°: error=4.89mm, iter=78
  ✅ Test 6: +X 10mm +RZ 10°: error=5.67mm, iter=89
```

---

### Step 7: Get Divergence Report 📋
```javascript
const report = viz.getDivergenceReport();
console.log(report);
```

**Expected Output:**
```
=== Transform Divergence Report ===

✅ motoman_mh5:
  Mesh TCP: Vector3(0.5234, 0.3120, 0.2456)
  FK TCP:   Vector3(0.5233, 0.3121, 0.2457)
  Divergence: 0.123mm
```

---

### Step 8: Test FK/IK Consistency 🔄
```javascript
harness.testForwardBackwardConsistency(chainName);
```

**Expected Output:**
```
╔═══════════════════════════════════════════════════════════════════╗
║           Forward-Backward Consistency Test                       ║
╚═══════════════════════════════════════════════════════════════════╝

[IKTestHarness] Original joint angles (degrees):
  [0.0, 15.0, -30.0, 0.0, 45.0, 0.0]°

[IKTestHarness] Joint angle difference:
  Joint 0: 0.100°
  Joint 1: 0.200°
  Joint 2: 0.200°
  Joint 3: 0.000°
  Joint 4: 0.100°
  Joint 5: 0.100°
  Max difference: 0.200°

  ✅ EXCELLENT: Forward-backward consistency verified
```

---

## 🎯 All-in-One Test Script

Copy-paste this entire block for a complete test:

```javascript
// === MH5 Complete Debug Test ===
console.clear();
console.log('╔═════════════════════════════════════════════════════════╗');
console.log('║         MH5 Robot - Complete Debug Test                ║');
console.log('╚═════════════════════════════════════════════════════════╝\n');

// 1. Get managers
const km = kinematicsManager;
const fk = fkSolver;
const ik = ikSolver;
const scene = sceneManager.getScene();

// 2. Check chains
const chains = km.getAllChains();
console.log('Step 1: Robot Status');
console.log('  Chains:', chains.length);
if (chains.length > 0) {
  console.log(`  ✅ ${chains[0].name} (${chains[0].joints.length} joints)`);
} else {
  console.error('  ❌ No chains found!');
  throw new Error('Robot not loaded');
}

const chainName = chains[0].name;

// 3. Enable visualizer
console.log('\nStep 2: Visual Debugger');
const viz = TransformDebugVisualizer.getInstance();
viz.initialize(scene, fk, km);
viz.setEnabled(true, {
  showMeshFrames: true,
  showFKFrames: true,
  showDivergence: true,
  frameSize: 0.15
});
viz.update();
console.log('  ✅ Visualizer enabled (look at TCP for colored axes)');

// 4. Get current pose
console.log('\nStep 3: Current TCP Pose');
const tcpPose = fk.getNullTCPPose(chainName);
if (tcpPose) {
  console.log(`  Position: (${tcpPose.position.x.toFixed(3)}, ${tcpPose.position.y.toFixed(3)}, ${tcpPose.position.z.toFixed(3)})`);
  console.log('  ✅ TCP pose available');
} else {
  console.error('  ❌ TCP pose is null');
}

// 5. Initialize test harness
console.log('\nStep 4: Initialize Test Harness');
const harness = IKTestHarness.getInstance();
harness.initialize(fk, ik, km);
console.log('  ✅ Test harness ready');

// 6. Test +10mm X
console.log('\nStep 5: Test IK (+10mm X)');
const currentPose = harness.getCurrentEulerPose(chainName);
if (currentPose) {
  const testPose = { ...currentPose, x: currentPose.x + 0.010 };
  console.log(`  Target: X=${testPose.x.toFixed(4)}m (+10mm)`);
  // Detailed test output will follow
  setTimeout(() => harness.testEulerPose(chainName, testPose), 100);
} else {
  console.error('  ❌ Could not get current pose');
}

// 7. Divergence report
console.log('\nStep 6: Divergence Check');
setTimeout(() => {
  const report = viz.getDivergenceReport();
  console.log(report);
}, 500);

console.log('\n✅ Test initiated! Scroll up to see detailed IK results.');
console.log('💡 Tip: Look at robot TCP for colored axes visualization.');
```

---

## ✅ Success Criteria

After running all commands, you should see:

### Visual (in 3D viewport)
- ✅ Colored axes at TCP
- ✅ RGB and CMY axes overlap (no red line)
- ✅ Axes move when joints are jogged

### Console Output
- ✅ `Chains found: 1`
- ✅ `motoman_mh5 (6 joints)`
- ✅ `IK Result: Success: ✅`
- ✅ `Position error: <10mm`
- ✅ `Orientation error: <10°`
- ✅ `Divergence: <5mm`
- ✅ `Test suite: ≥5/6 passed`

---

## 🐛 Troubleshooting

### Problem: "kinematicsManager is not defined"

**Cause:** Page not refreshed after code update

**Fix:**
1. Press `F5` to refresh
2. Wait for scene to load
3. Check console for: `💡 Debug: Kinematics managers available`
4. Try again

### Problem: "chains.length is 0"

**Cause:** Robot not loaded with kinematic chain

**Fix:**
```javascript
// Check if robot meshes exist
const meshes = sceneManager.getScene().meshes;
console.log('Scene meshes:', meshes.length);
console.log('Robot meshes:', meshes.filter(m => m.name.includes('motoman')).length);

// If meshes exist but no chain, re-import robot
```

### Problem: "TCP pose is null"

**Cause:** FK solver not initialized for this chain

**Fix:**
```javascript
// Get joints and force FK update
const joints = km.getActuatedJoints(chains[0].id);
console.log('Joints:', joints.length);

// Try FK solve directly
const jointAngles = joints.map(j => j.position);
const pose = fk.solve(chainName, jointAngles);
console.log('FK solve result:', pose);
```

### Problem: Visual debugger shows nothing

**Cause:** Visualization needs manual update

**Fix:**
```javascript
// Force update
viz.update();

// Check if enabled
console.log('Visualizer enabled:', viz);

// Try recreating
viz.clear();
viz.setEnabled(false);
viz.setEnabled(true);
viz.update();
```

---

## 📊 Interpreting Results

### IK Test Results

| Result | Meaning | Action |
|--------|---------|--------|
| Success: ✅, error <5mm | Perfect! | IK works correctly |
| Success: ✅, error 5-10mm | Good | Acceptable, may tune |
| Success: ✅, error >10mm | Poor | IK converged to wrong solution |
| Success: ❌, iterations=1000 | Failed | IK couldn't converge |

### Divergence Results

| Divergence | Meaning | Action |
|------------|---------|--------|
| <1mm | Excellent | Transforms aligned ✅ |
| 1-5mm | Good | Minor drift, acceptable |
| 5-50mm | Poor | Transform bug likely |
| >50mm | Critical | Coordinate space mismatch |

---

## 🚀 Next Steps

### If All Tests Pass ✅
1. Test TCP jogging in UI (Kinematics Panel → TCP mode → X+ button)
2. Run test suite with different robot poses
3. Test all 12 jog directions (X/Y/Z ±, RX/RY/RZ ±)

### If Tests Fail ❌
1. Note which specific test fails
2. Check divergence report
3. Review console for error messages
4. Refer to [TRANSFORM_DEBUG_GUIDE.md](TRANSFORM_DEBUG_GUIDE.md) for detailed debugging

---

**Ready?** Refresh browser (`F5`) and paste the commands! 🎯

