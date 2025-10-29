# TCP Gizmo vs Transform Gizmo - Visual Distinction Ideas

## Problem
Since both TCP gizmo and Transform gizmo use Babylon.js standard PositionGizmo and RotationGizmo, they look identical (both use standard RGB colors for axes). Users need a way to distinguish which gizmo is which.

## Current Implementation
- **TCP Gizmo**: Created via `IKTargetGizmoManager.createTarget()` → uses `BABYLON.PositionGizmo` and `BABYLON.RotationGizmo`
- **Transform Gizmo**: Created via `TransformGizmo` class → uses `GizmoManager.gizmos.positionGizmo` and `GizmoManager.gizmos.rotationGizmo`
- Both use standard axis colors (Red=X, Green=Y, Blue=Z)

## Recommended Solutions (In Order of Preference)

### Option 1: **Add a Label Above the TCP Gizmo** ⭐ **BEST**
**Implementation**: Add a 3D text label or GUI text block above the TCP gizmo.

**Pros:**
- Clear and unambiguous
- Non-intrusive
- Easy to implement (code already has label field, just commented out)
- Works at all zoom levels

**Code Location**: `src/kinematics/IKTargetGizmoManager.ts` line 175 (currently `label: GUI.TextBlock | null = null`)

**Implementation Example:**
```typescript
// Create 3D text label for TCP gizmo
const label = GUI.TextBlock.CreateSimple(`${config.chainName} TCP`);
label.color = "#00ff88"; // Cyan color
label.fontSize = 24;
label.alpha = 0.9;
// Position above gizmo using Billboard mode or 3D positioning
```

---

### Option 2: **Add a Colored Sphere at TCP Gizmo Center** ⭐ **GOOD**
**Implementation**: Add a small colored sphere (or other shape) at the center of the TCP gizmo.

**Pros:**
- Highly visible
- Can be color-coded per chain/robot
- Doesn't interfere with gizmo controls

**Cons:**
- May slightly obscure center handles
- Requires positioning logic

**Code Location**: `src/kinematics/IKTargetGizmoManager.ts` line 181 (currently `marker: null`)

**Implementation Example:**
```typescript
// Create a small sphere marker at TCP position
const marker = BABYLON.MeshBuilder.CreateSphere(
  `tcp_marker_${config.targetId}`,
  { diameter: 0.05 }, // 5cm sphere
  this.scene
);
marker.position = transformNode.position.clone();
const material = new BABYLON.StandardMaterial(`tcp_marker_mat_${config.targetId}`, this.scene);
material.diffuseColor = new BABYLON.Color3(0, 1, 0.5); // Cyan-green
material.emissiveColor = new BABYLON.Color3(0, 0.5, 0.25);
material.alpha = 0.7;
marker.material = material;
marker.parent = transformNode;
```

---

### Option 3: **Make TCP Gizmo Slightly Larger** ⭐ **OK**
**Implementation**: Set TCP gizmo `scaleRatio` to 1.2 or 1.3 (currently 1.0).

**Pros:**
- Simple change
- Easy to spot difference

**Cons:**
- Not as clear as a label
- May interfere with other visuals

**Code Location**: `src/kinematics/IKTargetGizmoManager.ts` lines 120, 150

---

### Option 4: **Add Pulsing/Glow Animation to TCP Gizmo**
**Implementation**: Add an animated glow effect or pulsing to the TCP gizmo.

**Pros:**
- Eye-catching
- Clearly indicates active/grabable object

**Cons:**
- Can be distracting
- More complex implementation
- Performance impact

**Implementation Example:**
```typescript
// Add emissive glow animation
const pulseAnimation = new BABYLON.Animation(
  "tcpPulse",
  "material.emissiveIntensity",
  30,
  BABYLON.Animation.ANIMATIONTYPE_FLOAT,
  BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
);
const keys = [
  { frame: 0, value: 0.5 },
  { frame: 30, value: 1.0 },
  { frame: 60, value: 0.5 }
];
pulseAnimation.setKeys(keys);
// Apply to marker or gizmo materials
```

---

### Option 5: **Add Outline/Bounding Box**
**Implementation**: Add a wireframe bounding box or outline around the TCP gizmo.

**Pros:**
- Distinctive shape
- Clear boundary

**Cons:**
- Can clutter the view
- May obscure robot parts

---

## Recommended Combination

**Best Approach**: **Combine Option 1 (Label) + Option 2 (Marker Sphere)**

1. **Label**: Shows "TCP" or chain name above the gizmo - provides text clarity
2. **Small cyan sphere**: Visual indicator at center - provides color distinction

This gives users two ways to identify the TCP gizmo:
- Text label for explicit identification
- Colored marker for quick visual recognition

## Implementation Notes

1. **TCP Gizmo Context**: Only show TCP gizmo when Motion Panel is active (`activePanel === 'motion'`)
2. **Transform Gizmo Context**: Transform gizmo appears when objects are selected in the scene
3. **Size Difference**: Consider making TCP gizmo 10-20% larger than transform gizmo for additional distinction

## Next Steps

1. Implement Option 1 (Label) in `IKTargetGizmoManager.createTarget()`
2. Implement Option 2 (Marker) in `IKTargetGizmoManager.createTarget()`
3. Test visibility at different zoom levels and camera angles
4. Consider adding a toggle in Motion Panel to show/hide TCP label if it becomes too cluttered

