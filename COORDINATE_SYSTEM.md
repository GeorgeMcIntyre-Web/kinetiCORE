# kinetiCORE Coordinate System Standard

## Overview

**kinetiCORE presents Z-up to users while using Y-up internally.**

- **User sees:** Z-up (CAD/ROS standard)
- **Internal (Babylon/Rapier):** Y-up (engine native)
- **Conversion:** Automatic via `CoordinateSystem.ts`

This pragmatic approach gives users the familiar CAD interface while letting Babylon.js work optimally.

## Coordinate Systems

### User Space (Z-up)
```
X: Right
Y: Forward
Z: Up (vertical)
Units: Millimeters
```

### Internal Space (Y-up)
```
X: Right
Y: Up (vertical)
Z: Forward
Units: Meters
```

## Conversion

**Position:** `(x, y, z)_user → (x, z, y)_babylon` + mm→m
**Rotation:** Swap Y/Z quaternion components + 90° X-axis rotation

Use `CoordinateSystem.ts` functions:
- `userToBabylon(pos)` - Convert position
- `babylonToUser(pos)` - Reverse conversion
- `userRotationToBabylon(quat)` - Convert rotation

## For Loader Developers

### **All loaders MUST convert Z-up → Y-up**

Follow the URDF loader pattern:

```typescript
// ✅ CORRECT: Convert position
mesh.position = new BABYLON.Vector3(
  origin.xyz[0],  // X stays X
  origin.xyz[2],  // Z (up) → Y (up)
  origin.xyz[1]   // Y (forward) → Z (forward)
);

// ✅ CORRECT: Rotate STL mesh
const rotation = BABYLON.Quaternion.RotationAxis(
  BABYLON.Vector3.Right(),
  -Math.PI / 2 // -90° around X
);
mesh.rotationQuaternion = rotation;

// ❌ WRONG: Don't load as-is!
mesh.position = new BABYLON.Vector3(x, y, z); // NO!
```

### File Format Reference

| Format | Source Coord | Action Required |
|--------|-------------|-----------------|
| URDF | Z-up | ✅ See URDFLoaderWithMeshes.ts |
| STL | Z-up | ✅ Rotate -90° X + swap pos |
| STEP | Z-up | ✅ Swap Y/Z positions |
| CATIA | Z-up | ✅ Swap Y/Z positions |
| JT | Z-up | ✅ Swap Y/Z positions |

## Babylon.js Configuration

Scene uses **Y-up (Babylon native)**:

```typescript
// Ground in XZ plane (Y=0)
CreateGround(...); // No rotation needed

// Camera Y-up
camera.upVector = new BABYLON.Vector3(0, 1, 0);

// Gravity down Y-axis
gravity = { x: 0, y: -9.81, z: 0 };
```

## Testing Your Loader

1. **Load a cube** - Should appear upright (not rotated)
2. **Check ground contact** - Object at user Z=0 should touch ground
3. **Verify orientation** - Match CAD software display

## Common Mistakes

❌ **Loading Z-up files directly without conversion**
```typescript
// WRONG!
mesh.position = urdfPosition; // Still in Z-up!
```

✅ **Always convert to Y-up internal**
```typescript
// CORRECT
mesh.position = new BABYLON.Vector3(
  urdfPos.x,
  urdfPos.z,  // Swap!
  urdfPos.y
);
```

---

**Last Updated:** 2025-10-06
**Owner:** George (Architecture Lead)

**Reference Implementation:** `src/loaders/urdf/URDFLoaderWithMeshes.ts`
