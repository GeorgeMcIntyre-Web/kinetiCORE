# MH5 Debug - Quick Start (You Are Here!)

**Status:** Robot loaded ✅, Debug tools need initialization ⏳

---

## 🚨 Current Situation

From your screenshot:
- ✅ MH5 robot is loaded and visible
- ✅ Robot appears in cyan/teal color
- ✅ Base coordinate frame visible (RGB axes at base)
- ❌ Console shows `TransformDebugVisualizer is not defined`
- ❌ Debug tools need initialization

---

## ⚡ Quick Fix (3 Commands)

Refresh the page to load the new code, then paste these 3 commands in console:

### Command 1: Check Robot Status
```javascript
const km = KinematicsManager.getInstance();
const fk = ForwardKinematicsSolver.getInstance();
const ik = InverseKinematicsSolver.getInstance();
const chains = km.getAllChains();

console.log('=== Robot Status ===');
console.log('Chains found:', chains.length);
chains.forEach(c => {
  console.log(`  - ${c.name}: ${c.joints.length} joints`);
});
```

**Expected output:**
```
=== Robot Status ===
Chains found: 1
  - motoman_mh5: 6 joints
```

### Command 2: Initialize Visual Debugger
```javascript
const scene = sceneManager.getScene();
const viz = TransformDebugVisualizer.getInstance();
viz.initialize(scene, fk, km);
viz.setEnabled(true, {
  showMeshFrames: true,
  showFKFrames: true,
  showDivergence: true,
  frameSize: 0.15  // 15cm - good size for MH5
});
viz.update();

console.log('✅ Visual debugger enabled! Look at TCP for colored axes.');
```

**Expected result:**
- RGB axes appear at TCP (Red=X, Green=Y, Blue=Z)
- CMY axes appear at TCP (Cyan=X, Magenta=Y, Yellow=Z)
- If they overlap: ✅ Transforms are good!
- If red line appears: ❌ Divergence detected!

### Command 3: Initialize Test Harness
```javascript
const harness = IKTestHarness.getInstance();
harness.initialize(fk, ik, km);

// Test current pose + 10mm in X
const chainName = chains[0].name;
const currentPose = harness.getCurrentEulerPose(chainName);

console.log('=== Current TCP Pose ===');
console.log(`X: ${currentPose.x.toFixed(4)}m`);
console.log(`Y: ${currentPose.y.toFixed(4)}m`);
console.log(`Z: ${currentPose.z.toFixed(4)}m`);
console.log(`RX: ${currentPose.rx.toFixed(1)}°`);
console.log(`RY: ${currentPose.ry.toFixed(1)}°`);
console.log(`RZ: ${currentPose.rz.toFixed(1)}°`);

// Test +10mm in X
const testPose = { ...currentPose, x: currentPose.x + 0.010 };
console.log('\n=== Testing +10mm X movement ===');
harness.testEulerPose(chainName, testPose);
```

**Expected output:**
```
=== Current TCP Pose ===
X: 0.5234m
Y: 0.3120m
Z: 0.2456m
RX: 12.3°
RY: 5.7°
RZ: -8.2°

=== Testing +10mm X movement ===
╔════════════════════════════════════════════════════════════════╗
║          IK Test Harness - Euler Pose Input                    ║
╚════════════════════════════════════════════════════════════════╝
[IKTestHarness] IK Result:
  Success: ✅
  Error: 0.004123m
  Position error: 4.12mm
  ✅ EXCELLENT
```

---

## 🎯 What to Look For

### Visual Check (In 3D Viewport)
1. **Look at the TCP (tool tip)** - you should see:
   - **RGB axes** (bright red, green, blue) = Mesh position
   - **CMY axes** (cyan, magenta, yellow) = FK computed position

2. **Check alignment:**
   - ✅ **Axes overlap** = Transforms are correct!
   - ❌ **Red line between axes** = Divergence detected!

### Console Check
1. **Chain found:** Should show `motoman_mh5: 6 joints`
2. **Current pose:** Should show reasonable numbers (not NaN or Infinity)
3. **IK test result:** Should show `Success: ✅` and `error < 10mm`

---

## 🐛 Troubleshooting

### Problem 1: "KinematicsManager is not defined"

**Fix:** These are already exposed globally. After refresh:
```javascript
// These should work:
window.kinematicsManager
window.fkSolver
window.sceneManager
```

If not, add them manually:
```javascript
const km = (window as any).kinematicsManager;
const fk = (window as any).fkSolver;
```

### Problem 2: "chains.length is 0"

**Cause:** Robot not properly imported with kinematic chain

**Fix:** Re-import robot:
1. Delete current robot from scene
2. Import URDF again: Manufacturing → Motoman MH5
3. Wait for import to complete
4. Run Command 1 again

### Problem 3: "Visual debugger shows nothing"

**Possible causes:**
1. Scene not initialized
2. Chain not found
3. TCP mesh not available

**Fix:**
```javascript
// Check scene
console.log('Scene:', sceneManager.getScene());

// Check TCP mesh
const tcpPose = fk.getNullTCPPose(chains[0].name);
console.log('TCP Pose:', tcpPose);

// If null, robot kinematics not set up
```

### Problem 4: "TypeError: Cannot read property 'position'"

**Cause:** TCP pose is null (FK not set up)

**Fix:**
```javascript
// Check if FK is initialized
const joints = km.getActuatedJoints(chains[0].id);
console.log('Joints:', joints.length);

// If 0, chain not properly registered
```

---

## 📊 Success Checklist

Once commands run successfully:

### Visual Success
- [ ] RGB axes visible at TCP
- [ ] CMY axes visible at TCP
- [ ] Axes overlap (no red divergence line)
- [ ] Axes move when you jog joints

### Console Success
- [ ] Chain found: `motoman_mh5: 6 joints`
- [ ] Current pose shows valid numbers
- [ ] IK test shows `Success: ✅`
- [ ] Position error < 10mm
- [ ] No error messages

---

## 🎓 Next Steps After Success

### Test TCP Jogging
1. Open **Kinematics Panel** (right sidebar)
2. Switch to **TCP** mode
3. Click **X+** button
4. Watch:
   - Robot should move
   - Axes should follow TCP
   - Console should show IK debug output

### Run Full Test Suite
```javascript
harness.runTestSuite(chains[0].name);
```

### Get Divergence Report
```javascript
viz.getDivergenceReport();
```

### Use UI Panel
1. Scroll to **🔬 Transform Debug & IK Testing**
2. Click **"Enabled"** to turn on visualizer
3. Click **"Load Current Pose"**
4. Adjust X by +0.010
5. Click **"Test This Pose"**

---

## 🆘 Still Stuck?

**Paste this diagnostic script:**
```javascript
console.log('=== FULL DIAGNOSTIC ===');

// 1. Check globals
console.log('window.kinematicsManager:', !!window.kinematicsManager);
console.log('window.fkSolver:', !!window.fkSolver);
console.log('window.sceneManager:', !!window.sceneManager);
console.log('TransformDebugVisualizer:', typeof TransformDebugVisualizer);
console.log('IKTestHarness:', typeof IKTestHarness);

// 2. Check chains
try {
  const km = KinematicsManager.getInstance();
  const chains = km.getAllChains();
  console.log('Chains:', chains.length);
  chains.forEach(c => console.log(`  ${c.name}: ${c.joints.length} joints`));
} catch(e) {
  console.error('KinematicsManager error:', e);
}

// 3. Check scene
try {
  const scene = sceneManager.getScene();
  console.log('Scene meshes:', scene.meshes.length);
} catch(e) {
  console.error('Scene error:', e);
}

// 4. Check FK
try {
  const fk = ForwardKinematicsSolver.getInstance();
  const chains = KinematicsManager.getInstance().getAllChains();
  if (chains.length > 0) {
    const tcpPose = fk.getNullTCPPose(chains[0].name);
    console.log('TCP Pose:', tcpPose ? 'Found' : 'NULL');
  }
} catch(e) {
  console.error('FK error:', e);
}

console.log('=== END DIAGNOSTIC ===');
```

**Copy the output and we'll debug from there!**

---

## 🎉 Visual Guide

### What You Should See:

```
         TCP (Tool Tip)
              │
              ▼
         ┌────┴────┐
         │  ╱ │ ╲  │
         │ ╱  │  ╲ │  ← RGB axes (mesh)
         │    │    │  ← CMY axes (FK)
         └─────────┘
              │
         (Wrist Joint)
```

**If aligned:** Axes overlap perfectly ✅
**If diverged:** Red line connects RGB to CMY ❌

---

**Current Step:** Refresh page, run Command 1, 2, 3 ⏳

