# Coordinate System Conversion Examples

**Purpose:** Practical examples for converting between USER (Z-up, mm) and BABYLON (Y-up, m) coordinate systems.

**Owner:** George McIntyre (Agent 1)
**Date:** 2025-10-26

---

## Quick Reference

### USER Space (What engineers see)
- **Coordinate System:** Right-handed, Z-up
- **Units:** Millimeters (mm)
- **Axes:** X = Right, Y = Forward, Z = Up

### BABYLON Space (Internal rendering)
- **Coordinate System:** Right-handed, Y-up
- **Units:** Meters (m)
- **Axes:** X = Right, Y = Up, Z = Forward

### Conversion Rules
1. **Position:** Swap Y ↔ Z + convert mm ↔ m
2. **Rotation:** Apply 90° rotation around X axis
3. **Vectors (directions):** Swap Y ↔ Z only (no unit conversion)

---

## Position Conversion Examples

### Example 1: Robot Base Position

**Scenario:** Robot base at X=500mm, Y=300mm, Z=0mm (on ground)

```typescript
import { userToBabylon, babylonToUser } from '@core/CoordinateSystem';

// USER space (what engineer enters in UI)
const userPos = { x: 500, y: 300, z: 0 };

// Convert to BABYLON space for rendering
const babylonPos = userToBabylon(userPos);
// Result: Vector3(0.5, 0, 0.3)
// Explanation:
//   X: 500mm → 0.5m (stays X)
//   Y: 300mm → 0.3m becomes Z
//   Z: 0mm → 0m becomes Y

// Render the mesh
mesh.position = babylonPos;

// Convert back to USER space for display
const displayPos = babylonToUser(babylonPos);
// Result: { x: 500, y: 300, z: 0 }
```

### Example 2: End-Effector Position

**Scenario:** Robot arm tip at X=1200mm, Y=800mm, Z=1500mm

```typescript
const endEffectorUser = { x: 1200, y: 800, z: 1500 };
const endEffectorBabylon = userToBabylon(endEffectorUser);
// Result: Vector3(1.2, 1.5, 0.8)
//   X: 1200mm → 1.2m
//   Y: 800mm → 0.8m (becomes Z in Babylon)
//   Z: 1500mm → 1.5m (becomes Y in Babylon - vertical height)
```

### Example 3: Negative Coordinates

**Scenario:** Object behind robot at X=-200mm, Y=-100mm, Z=500mm

```typescript
const behindRobotUser = { x: -200, y: -100, z: 500 };
const behindRobotBabylon = userToBabylon(behindRobotUser);
// Result: Vector3(-0.2, 0.5, -0.1)
//   X: -200mm → -0.2m (negative X)
//   Y: -100mm → -0.1m (becomes negative Z)
//   Z: 500mm → 0.5m (becomes Y)
```

---

## Vector (Direction) Conversion Examples

### Example 4: Up Direction

**Scenario:** Pointing straight up

```typescript
import { userVectorToBabylon } from '@core/CoordinateSystem';

// USER space: Z-up
const userUpVector = { x: 0, y: 0, z: 1 };

// BABYLON space: Y-up
const babylonUpVector = userVectorToBabylon(userUpVector);
// Result: Vector3(0, 1, 0)
// No unit conversion! Just axis swap
```

### Example 5: Forward Direction

**Scenario:** Robot moving forward (positive Y in USER space)

```typescript
const userForwardVector = { x: 0, y: 1, z: 0 };
const babylonForwardVector = userVectorToBabylon(userForwardVector);
// Result: Vector3(0, 0, 1)
// User Y (forward) → Babylon Z (forward)
```

### Example 6: TCP Jog Delta

**Scenario:** User clicks "+X" button to jog 10mm in X direction

```typescript
// USER space jog: 10mm in positive X
const jogDeltaUser = { x: 10, y: 0, z: 0 };

// Convert to BABYLON space for IK solver
const jogDeltaBabylon = userToBabylon(jogDeltaUser);
// Result: Vector3(0.01, 0, 0)
//   10mm → 0.01m in X direction
```

### Example 7: TCP Jog Z-axis

**Scenario:** User clicks "+Z" button to jog 10mm up

```typescript
// USER space jog: 10mm up (positive Z)
const jogUpUser = { x: 0, y: 0, z: 10 };

// Convert to BABYLON space
const jogUpBabylon = userToBabylon(jogUpUser);
// Result: Vector3(0, 0.01, 0)
//   10mm → 0.01m
//   Z (up) → Y (up) in Babylon
```

---

## Rotation Conversion Examples

### Example 8: No Rotation (Identity)

**Scenario:** Object aligned with world axes

```typescript
import { userRotationToBabylon, babylonRotationToUser } from '@core/CoordinateSystem';
import * as BABYLON from '@babylonjs/core';

// USER space: no rotation
const userIdentity = { x: 0, y: 0, z: 0, w: 1 };

// Convert to BABYLON space
const babylonIdentity = userRotationToBabylon(userIdentity);
// Result: Quaternion with 90° rotation around X applied
// This accounts for Z-up → Y-up coordinate change
```

### Example 9: 90° Rotation Around Z (USER space)

**Scenario:** Robot base rotated 90° counterclockwise (viewed from above)

```typescript
// 90° around Z in USER space
const userQuat = BABYLON.Quaternion.RotationAxis(
  new BABYLON.Vector3(0, 0, 1),
  Math.PI / 2
);

const babylonQuat = userRotationToBabylon({
  x: userQuat.x,
  y: userQuat.y,
  z: userQuat.z,
  w: userQuat.w,
});

// Apply to mesh
mesh.rotationQuaternion = babylonQuat;
```

---

## Display Formatting Examples

### Example 10: Format Position for UI

**Scenario:** Display robot position in UI panel

```typescript
import { formatPositionForDisplay } from '@core/CoordinateSystem';

// Babylon space position (from mesh)
const meshPosition = mesh.position; // Vector3(1.2, 0.8, 0.5)

// Format for display
const displayText = formatPositionForDisplay(meshPosition);
// Result: { x: "1200.0 mm", y: "500.0 mm", z: "800.0 mm" }

// Use in UI
<div>
  <p>X: {displayText.x}</p>
  <p>Y: {displayText.y}</p>
  <p>Z: {displayText.z}</p>
</div>
```

### Example 11: Parse User Input

**Scenario:** User enters position in text field

```typescript
// User enters: "X: 1000, Y: 500, Z: 250"
const userInput = { x: 1000, y: 500, z: 250 }; // mm

// Convert to Babylon space for scene
const scenePosition = userToBabylon(userInput);
// Result: Vector3(1.0, 0.25, 0.5)

// Apply to mesh
mesh.position = scenePosition;
```

---

## Common Mistakes & Solutions

### Mistake 1: Double Conversion

**Wrong:**
```typescript
// ❌ Converting twice
const pos = userToBabylon(userPos);
const finalPos = userToBabylon(pos); // Wrong! Already converted
```

**Correct:**
```typescript
// ✅ Convert once
const babylonPos = userToBabylon(userPos);
mesh.position = babylonPos;
```

### Mistake 2: Using Position Conversion for Vectors

**Wrong:**
```typescript
// ❌ Using userToBabylon for direction vector
const direction = { x: 0, y: 1, z: 0 }; // Forward
const babylonDir = userToBabylon(direction);
// Wrong! This converts units (0mm → 0m), loses direction
```

**Correct:**
```typescript
// ✅ Use userVectorToBabylon for directions
const direction = { x: 0, y: 1, z: 0 }; // Forward
const babylonDir = userVectorToBabylon(direction);
// Correct! Just swaps axes, no unit conversion
```

### Mistake 3: Forgetting Unit Conversion in Calculations

**Wrong:**
```typescript
// ❌ Mixing mm and meters
const userDistance = 100; // 100mm
const babylonPos = new BABYLON.Vector3(1, 0, 0); // 1 meter
const total = babylonPos.x + userDistance; // Wrong! 1m + 100mm = ???
```

**Correct:**
```typescript
// ✅ Convert to same units first
const userDistance = 100; // 100mm
const babylonPos = new BABYLON.Vector3(1, 0, 0); // 1 meter
const userPos = babylonToUser(babylonPos); // Convert to mm
const total = userPos.x + userDistance; // Correct! 1000mm + 100mm = 1100mm
```

---

## Testing Coordinate Conversions

### Unit Test Template

```typescript
import { userToBabylon, babylonToUser } from '@core/CoordinateSystem';

describe('Coordinate Conversions', () => {
  it('should convert USER to BABYLON and back', () => {
    const original = { x: 1000, y: 500, z: 250 };
    const babylon = userToBabylon(original);
    const restored = babylonToUser(babylon);

    expect(restored.x).toBeCloseTo(original.x, 1);
    expect(restored.y).toBeCloseTo(original.y, 1);
    expect(restored.z).toBeCloseTo(original.z, 1);
  });

  it('should correctly swap Y and Z axes', () => {
    const user = { x: 100, y: 200, z: 300 };
    const babylon = userToBabylon(user);

    // X stays X (mm → m)
    expect(babylon.x).toBeCloseTo(0.1);
    // User Z (up) → Babylon Y (up)
    expect(babylon.y).toBeCloseTo(0.3);
    // User Y (forward) → Babylon Z (forward)
    expect(babylon.z).toBeCloseTo(0.2);
  });

  it('should preserve direction for vectors', () => {
    const userUp = { x: 0, y: 0, z: 1 };
    const babylonUp = userVectorToBabylon(userUp);

    expect(babylonUp.x).toBe(0);
    expect(babylonUp.y).toBe(1); // Z → Y
    expect(babylonUp.z).toBe(0);
  });
});
```

---

## Quick Lookup Table

| USER Space (mm) | BABYLON Space (m) | Description |
|----------------|-------------------|-------------|
| (1000, 0, 0) | (1, 0, 0) | 1m to the right |
| (0, 1000, 0) | (0, 0, 1) | 1m forward |
| (0, 0, 1000) | (0, 1, 0) | 1m up |
| (500, 500, 500) | (0.5, 0.5, 0.5) | Diagonal |
| (-100, 0, 0) | (-0.1, 0, 0) | 10cm left |
| (0, -100, 0) | (0, 0, -0.1) | 10cm backward |
| (0, 0, -100) | (0, -0.1, 0) | 10cm down |

---

## API Reference Summary

```typescript
// Position conversion (with unit conversion)
userToBabylon(userPos: Vector3): BABYLON.Vector3
babylonToUser(babylonPos: BABYLON.Vector3): Vector3

// Vector conversion (NO unit conversion)
userVectorToBabylon(userVec: Vector3): BABYLON.Vector3

// Rotation conversion
userRotationToBabylon(userRot: Quaternion): BABYLON.Quaternion
babylonRotationToUser(babylonRot: BABYLON.Quaternion): Quaternion

// Display formatting
formatPositionForDisplay(babylonPos: BABYLON.Vector3): { x: string, y: string, z: string }

// Helper
createBabylonVector3(xMm: number, yMm: number, zMm: number): BABYLON.Vector3
```

---

## Real-World Use Cases

### Use Case 1: Robot Jogging
```typescript
// User clicks "+X" to jog 10mm
const jogDelta = userToBabylon({ x: 10, y: 0, z: 0 });
ikSolver.moveEndEffector(chainName, jogDelta, 'ccd');
```

### Use Case 2: Placing Object in Scene
```typescript
// User enters position: X=500, Y=300, Z=100
const userInput = { x: 500, y: 300, z: 100 };
mesh.position = userToBabylon(userInput);
```

### Use Case 3: Reading End-Effector Position
```typescript
const babylonPos = endEffectorMesh.position;
const userPos = babylonToUser(babylonPos);
console.log(`TCP at X:${userPos.x}mm Y:${userPos.y}mm Z:${userPos.z}mm`);
```

### Use Case 4: Setting Tool Direction
```typescript
// Tool pointing down (negative Z in USER space)
const toolDirection = userVectorToBabylon({ x: 0, y: 0, z: -1 });
toolMesh.setDirection(toolDirection);
```

---

## See Also

- [COORDINATE_SYSTEM.md](../COORDINATE_SYSTEM.md) - Full coordinate system specification
- [CoordinateSystem.ts](../src/core/CoordinateSystem.ts) - Source implementation
- [DEBUG_TCP_MOVE.md](DEBUG_TCP_MOVE.md) - TCP jogging coordinate examples

---

**Last Updated:** 2025-10-26
**Maintainer:** George McIntyre (Agent 1)
