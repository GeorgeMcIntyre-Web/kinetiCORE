# Coordinate System Reference

## Overview

kinetiCORE uses multiple coordinate systems that must be properly converted between:

1. **User/CAD Space** - What engineers see in UI
2. **URDF Files** - ROS robot description standard
3. **Babylon.js** - 3D rendering engine
4. **Rapier Physics** - Physics simulation engine

## Coordinate System Specifications

### User/CAD Space
- **Handedness:** Right-handed
- **Up Axis:** Z-axis points UP
- **Units:** Millimeters (mm)
- **Axes:**
  - X = Right
  - Y = Forward
  - Z = Up
- **Why:** Industry standard for CAD/CAM software (SolidWorks, CATIA, etc.)

### URDF Files (ROS Standard)
- **Handedness:** Right-handed
- **Up Axis:** Z-axis points UP
- **Units:** Meters (m)
- **Axes:**
  - X = Forward (ROS convention)
  - Y = Left
  - Z = Up
- **Why:** Standard Robot Operating System (ROS) convention

### Babylon.js Internal
- **Handedness:** Right-handed (configured via `scene.useRightHandedSystem = true`)
- **Up Axis:** Y-axis points UP
- **Units:** Meters (m)
- **Axes:**
  - X = Right
  - Y = Up
  - Z = Forward
- **Why:** Default 3D graphics convention (matches OpenGL, WebGL)

### Rapier Physics
- **Handedness:** Right-handed
- **Up Axis:** Y-axis points UP
- **Units:** Meters (m)
- **Axes:** Same as Babylon.js
- **Why:** Physics engine matches rendering engine for simplicity

## Conversion Rules

### User Space ↔ Babylon Space

**Position Conversion:**
```typescript
// User (Z-up, mm) → Babylon (Y-up, m)
babylonPos = {
  x: userPos.x * 0.001,  // mm → m, X stays X
  y: userPos.z * 0.001,  // User Z (up) → Babylon Y (up)
  z: userPos.y * 0.001   // User Y (forward) → Babylon Z (forward)
}

// Babylon (Y-up, m) → User (Z-up, mm)
userPos = {
  x: babylonPos.x * 1000,  // m → mm, X stays X
  y: babylonPos.z * 1000,  // Babylon Z (forward) → User Y (forward)
  z: babylonPos.y * 1000   // Babylon Y (up) → User Z (up)
}
```

**Rotation Conversion:**
```typescript
// User → Babylon: Apply 90° rotation around X-axis
const axisSwap = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, Math.PI / 2);
babylonQuat = axisSwap.multiply(userQuat);

// Babylon → User: Apply -90° rotation around X-axis
const axisSwap = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, -Math.PI / 2);
userQuat = axisSwap.multiply(babylonQuat);
```

**Vector Conversion (no scaling):**
```typescript
// User → Babylon
babylonVec = { x: userVec.x, y: userVec.z, z: userVec.y }

// Babylon → User
userVec = { x: babylonVec.x, y: babylonVec.z, z: babylonVec.y }
```

### URDF ↔ Babylon Space

**Position Conversion:**
```typescript
// URDF (Z-up, m) → Babylon (Y-up, m)
babylonPos = {
  x: urdfPos[0],  // X stays X
  y: urdfPos[2],  // URDF Z (up) → Babylon Y (up)
  z: urdfPos[1]   // URDF Y (forward) → Babylon Z (forward)
}
```

**Axis Conversion:**
```typescript
// URDF axis → Babylon axis (same as position)
babylonAxis = {
  x: urdfAxis[0],
  y: urdfAxis[2],
  z: urdfAxis[1]
}
```

**RPY (Roll-Pitch-Yaw) Rotation:**
```typescript
// Convert URDF RPY to quaternion, then swap Y/Z components
const quat = rpyToQuaternion(rpy);  // In URDF frame
babylonQuat = new BABYLON.Quaternion(quat.x, quat.z, quat.y, quat.w);
```

### Babylon ↔ Rapier (No Conversion!)

Since both use Y-up, right-handed, meters:
```typescript
// Direct copy - NO conversion needed
rapierPos = { x: babylonPos.x, y: babylonPos.y, z: babylonPos.z }
babylonPos = { x: rapierPos.x, y: rapierPos.y, z: rapierPos.z }
```

## Implementation Files

### Core Conversion Utilities
- **[src/core/CoordinateSystem.ts](src/core/CoordinateSystem.ts)** - User ↔ Babylon conversions
  - `userToBabylon()`
  - `babylonToUser()`
  - `userRotationToBabylon()`
  - `babylonRotationToUser()`
  - `userVectorToBabylon()`

### URDF Import
- **[src/loaders/urdf/URDFJointExtractor.ts](src/loaders/urdf/URDFJointExtractor.ts)** - Joint conversions
  - `urdfToBabylonPosition()`
  - `urdfToBabylonAxis()`
- **[src/loaders/urdf/URDFLoaderWithMeshes.ts](src/loaders/urdf/URDFLoaderWithMeshes.ts)** - Mesh conversions
  - Visual origin position conversion (line 154-158)
  - `applyRPYRotation()` - RPY to Babylon quaternion (line 420-444)

### Scene Configuration
- **[src/scene/SceneManager.ts](src/scene/SceneManager.ts):87** - Configures Babylon to right-handed
  ```typescript
  this.scene.useRightHandedSystem = true;
  ```

## Common Pitfalls

### ❌ DON'T: Apply conversions twice
```typescript
// WRONG - converting already-converted data
const babylonPos = userToBabylon(mesh.position); // mesh.position is already in Babylon space!
```

### ❌ DON'T: Mix coordinate systems
```typescript
// WRONG - using URDF axis directly in Babylon
joint.axis = { x: urdfAxis[0], y: urdfAxis[1], z: urdfAxis[2] };
```

### ❌ DON'T: Forget unit conversion
```typescript
// WRONG - mixing mm and meters
babylonPos.y = userPos.z; // Needs * 0.001 for mm → m
```

### ✅ DO: Use helper functions
```typescript
// CORRECT - always use conversion utilities
import { userToBabylon, babylonToUser } from './core/CoordinateSystem';
const babylonPos = userToBabylon(userInputPos);
```

### ✅ DO: Document coordinate space in comments
```typescript
// Position in user space (Z-up, mm)
const userPos = { x: 100, y: 200, z: 300 };

// Convert to Babylon space (Y-up, m)
const babylonPos = userToBabylon(userPos);
```

## Testing Coordinate Conversions

### Test 1: User Z-up → Babylon Y-up
```typescript
const userPos = { x: 100, y: 0, z: 1000 }; // 100mm right, 1000mm up
const babylonPos = userToBabylon(userPos);
// Expected: { x: 0.1, y: 1.0, z: 0.0 }
```

### Test 2: URDF Z-up → Babylon Y-up
```typescript
const urdfPos = [0.5, 0.0, 1.0]; // 0.5m right, 1.0m up
const babylonPos = urdfToBabylonPosition(urdfPos);
// Expected: { x: 0.5, y: 1.0, z: 0.0 }
```

### Test 3: Round-trip conversion
```typescript
const original = { x: 100, y: 200, z: 300 };
const babylon = userToBabylon(original);
const restored = babylonToUser(babylon);
// Expected: restored ≈ original (within floating point error)
```

## Visual Reference

```
USER/CAD SPACE (Z-up)          BABYLON SPACE (Y-up)
     Z ↑                            Y ↑
       |                              |
       |                              |
       +----→ Y                       +----→ Z
      /                              /
     /                              /
    X                              X

CONVERSION: (x, y, z) → (x, z, y) + unit scaling
```

## When to Convert

| Scenario | Conversion Needed | Use |
|----------|------------------|-----|
| UI displays position | Yes | `babylonToUser()` |
| User inputs position | Yes | `userToBabylon()` |
| Import URDF mesh origin | Yes | `urdfToBabylonPosition()` |
| Import URDF joint axis | Yes | `urdfToBabylonAxis()` |
| Babylon → Rapier sync | No | Direct copy |
| Rapier → Babylon sync | No | Direct copy |
| Babylon mesh parent/child | No | Already same space |
| Calculate world position | No | Internal to Babylon |

## Future Considerations

### Left-Handed JT Files
JT CAD format uses left-handed coordinates and may require Z negation:
```typescript
// JT (right-handed) → Babylon (left-handed if default)
babylonZ = -jtZ; // Negate Z for handedness conversion
```

Currently not needed since we configured Babylon as right-handed.

### Custom User Preferences
Future feature: Allow users to choose UI coordinate system:
- Option 1: Z-up (current, CAD standard)
- Option 2: Y-up (matches Babylon, simpler)
- Option 3: Custom (configurable)

## References

- [Babylon.js Coordinate System](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene#changing-mesh-culling-strategy)
- [ROS URDF Specification](http://wiki.ros.org/urdf/XML/joint)
- [Rapier Physics Documentation](https://rapier.rs/docs/user_guides/javascript/rigid_bodies)
- [CAD Coordinate Systems](https://knowledge.autodesk.com/support/fusion-360/learn-explore/caas/sfdcarticles/sfdcarticles/Coordinate-systems-in-Fusion-360.html)

---

**Last Updated:** 2025-10-04
**Owner:** George
**Status:** ✅ Implemented and documented
