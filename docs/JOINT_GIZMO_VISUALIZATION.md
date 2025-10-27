# Joint Gizmo Visualization for 6-Axis Robots

**Date:** 2025-10-27
**Owner:** George (Claude Code Agent 1)
**Status:** ✅ COMPLETE

## Overview

Implemented 3D joint gizmo visualization for revolute joints in URDF-loaded robots. Each joint displays:
1. **Fixed red half-circle arc** - Shows rotation plane (180° arc, constant size)
2. **Red arrow at arc end** - Indicates positive rotation direction
3. **Red normal vector arrow** - Shows joint rotation axis

All gizmos automatically appear when the Motion Panel opens and use `renderingGroupId=2` to render on top of the robot mesh.

## Implementation Details

### Architecture

The implementation uses a **parent-space coordinate system** approach:
- Joint origin and axis are defined in **parent link's local space** (per URDF spec)
- Transforms to world space using parent node's world matrix
- Gizmos update in real-time via ForwardKinematicsSolver integration

### Key Components

#### 1. KinematicsManager.showJointDebugFrame()
**Location:** `src/kinematics/KinematicsManager.ts` (lines 617-862)

Creates 3D mesh-based gizmo visualization:

```typescript
// Get parent node (joint is in parent's local space)
const parentNode = tree.getNode(joint.parentNodeId);
const parentBabylonNode = /* get Babylon TransformNode */;
parentBabylonNode.computeWorldMatrix(true);
const parentWorldMatrix = parentBabylonNode.getWorldMatrix();

// Transform joint origin to world space
const jointOriginLocal = new BABYLON.Vector3(
  joint.origin.x, joint.origin.y, joint.origin.z
);
const jointOriginWorld = BABYLON.Vector3.TransformCoordinates(
  jointOriginLocal, parentWorldMatrix
);

// Transform joint axis to world space
const localAxis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z);
const worldAxis = BABYLON.Vector3.TransformNormal(localAxis, parentWorldMatrix);
```

**Arc Generation:**
- Fixed 180° half-circle arc (π radians)
- Arc plane perpendicular to rotation axis
- 90° rotation applied to arc plane to fix orientation
- Created using `CreateTube()` with 2mm thickness

**Arrow Positioning:**
- Arrowhead placed at -90° position on arc
- Points tangentially in positive rotation direction
- Zero-length shaft (just cone visible)
- Tangent direction: `arcU.scale(sin(θ)).add(arcV.scale(-cos(θ)))`

**Rendering:**
- All meshes use `renderingGroupId = 2` (renders on top)
- Red color with self-illumination (`emissiveColor`)
- `disableLighting = true` for consistent brightness
- `isPickable = false` to prevent selection

#### 2. Real-Time Updates
**Location:** `src/kinematics/ForwardKinematicsSolver.ts` (lines 63-67)

Integrated into FK solver to update gizmos when joints move:

```typescript
updateJointPosition(jointId: string, position: number): void {
  // ... update joint position ...

  // Update joint gizmo if it exists
  const scene = this.sceneManager.getScene();
  if (scene) {
    this.kinematicsManager.updateJointGizmo(jointId, scene);
  }
}
```

**Update Mechanism:**
`updateJointGizmo()` disposes old gizmo and recreates it with current angle (lines 905-916)

#### 3. Auto-Show on Motion Panel Open
**Location:** `src/ui/components/RobotJoggingPanelWithGizmo.tsx` (lines 84-103)

React `useEffect` hook triggers gizmo display:

```typescript
useEffect(() => {
  const kinematicsManager = KinematicsManager.getInstance();
  const sceneManager = (window as any).sceneManager as SceneManager;
  if (sceneManager && kinematicsManager && robotId) {
    const scene = sceneManager.getScene();
    if (scene) {
      const chains = kinematicsManager.getAllChains();
      const robotChain = chains.find(chain =>
        chain.joints.some((joint: any) => joint.id.startsWith(robotId))
      );
      if (robotChain) {
        kinematicsManager.showAllJointDebugFrames(robotChain.id, scene);
      }
    }
  }
}, [robotId]);
```

### Camera Sensitivity Adjustments

Reduced mouse sensitivity for better 3D navigation:

**`src/core/constants.ts`** (lines 29-30):
```typescript
export const CAMERA_WHEEL_PRECISION = 50; // Higher = less sensitive (was 15)
export const CAMERA_INERTIA = 0.85; // Reduced from 0.9
```

**`src/scene/services/CameraService.ts`** (lines 54-55):
```typescript
this.camera.panningSensibility = 200; // Higher = slower (was 50)
this.camera.panningInertia = 0.85; // Reduced from 0.9
```

## Technical Decisions

### 1. Fixed Arc Length
**Decision:** Use fixed 180° arc instead of variable length
**Rationale:** Prevents visual scaling artifacts when joint moves; cleaner visualization

### 2. Parent-Space Coordinates
**Decision:** Use parent node's world matrix for transforms
**Rationale:** Matches URDF specification (joint origin/axis in parent's local space)

### 3. Dispose & Recreate Pattern
**Decision:** Recreate entire gizmo on update instead of moving meshes
**Rationale:** Simpler implementation; performance acceptable for 6 joints

### 4. 90° Arc Plane Rotation
**Decision:** Rotate arc plane by 90° around joint axis
**Rationale:** Fixes visual alignment with joint rotation direction

## Files Modified

1. **`src/kinematics/KinematicsManager.ts`**
   - Rewrote `showJointDebugFrame()` (lines 617-862)
   - Added `updateJointGizmo()` (lines 905-916)
   - Uses parent node instead of child node
   - Fixed arc with tangential arrow

2. **`src/kinematics/ForwardKinematicsSolver.ts`**
   - Integrated gizmo updates (lines 63-67)

3. **`src/ui/components/RobotJoggingPanelWithGizmo.tsx`**
   - Auto-show gizmos on panel open (lines 84-103)

4. **`src/core/constants.ts`**
   - Reduced camera wheel sensitivity (lines 29-30)

5. **`src/scene/services/CameraService.ts`**
   - Reduced panning sensitivity (lines 54-55)

## Known Limitations

1. **Gizmo Update Performance:** Currently recreates entire gizmo mesh on every joint change. For high-frequency updates (>60Hz), consider caching and transforming meshes instead.

2. **Arc Orientation:** Fixed 180° arc may not align perfectly for all joint configurations. Future enhancement could dynamically orient arc based on current joint angle.

3. **Joint Limits Not Visualized:** Arc length is fixed and doesn't show actual joint limits from URDF. Consider adding limit markers.

## Testing Checklist

- [x] Single revolute joint displays gizmo correctly
- [x] 6-axis robot shows all 6 gizmos when motion panel opens
- [x] Gizmos positioned at correct world coordinates
- [x] Rotation axis (normal arrow) points correctly
- [x] Arc arrow indicates positive rotation direction
- [x] Gizmos render on top of robot mesh (renderingGroupId=2)
- [x] Real-time updates work when moving joints via sliders
- [x] Camera sensitivity reduced for better navigation
- [x] No TypeScript compilation errors
- [x] No visual artifacts or scaling issues

## Usage

1. Load a URDF robot with revolute joints
2. Open Motion Panel (click "Motion" button)
3. Gizmos appear automatically on all revolute joints
4. Move joints using sliders - gizmos stay fixed (arrow direction doesn't change)
5. Red arc shows rotation plane
6. Red arrow at arc end shows positive rotation direction
7. Red normal arrow shows rotation axis

## Future Enhancements

1. **Joint Limit Visualization:** Add colored markers at joint limit positions on arc
2. **Current Angle Indicator:** Add moving sphere or line showing current joint position on arc
3. **Configurable Colors:** Allow user to customize gizmo colors per joint
4. **Performance Optimization:** Cache meshes and transform instead of recreating
5. **Toggle Visibility:** Add per-joint visibility controls in Motion Panel

## References

- URDF Specification: http://wiki.ros.org/urdf/XML/joint
- Babylon.js Rendering Groups: https://doc.babylonjs.com/features/featuresDeepDive/mesh/renderingGroups
- kinetiCORE Coordinate System: `docs/COORDINATE_SYSTEM.md`
