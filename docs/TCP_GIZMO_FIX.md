# TCP Gizmo Position Fix

**Issue:** TCP gizmo appears at world origin (0,0,0) instead of robot's tool center point
**Robot:** m710ic70 (and any other loaded robot)
**Date:** 2025-10-27

---

## Root Cause

The `getEndEffectorPose()` method in [ForwardKinematicsSolver.ts](../src/kinematics/ForwardKinematicsSolver.ts) returns the TCP position in **robot-local space** (relative to the robot's base link), but the gizmo system expects positions in **world space**.

### Current Code (Lines 720-731):

```typescript
getEndEffectorPose(chainName: string): {
  position: BABYLON.Vector3;
  rotation: BABYLON.Quaternion;
} | null {
  const chain = this.kinematicsManager.getChain(chainName);
  if (!chain) return null;

  const joints = this.kinematicsManager.getChainJoints(chain.id);
  const jointAngles = joints.map((j: JointConfig) => j.position);

  return this.solve(chainName, jointAngles);  // ❌ Returns LOCAL space!
}
```

The `solve()` method starts with `BABYLON.Matrix.Identity()` (line 510), which computes FK from the robot's local origin (0,0,0), not its world position.

---

## Fix

Update `getEndEffectorPose()` to transform the TCP position from robot-local space to world space:

### File: `src/kinematics/ForwardKinematicsSolver.ts`

Replace the `getEndEffectorPose` method (lines 716-731) with:

```typescript
/**
 * Get end-effector pose for a kinematic chain
 * Uses current joint positions from KinematicsManager
 * Returns pose in WORLD SPACE (not robot-local space)
 */
getEndEffectorPose(chainName: string): {
  position: BABYLON.Vector3;
  rotation: BABYLON.Quaternion;
} | null {
  const chain = this.kinematicsManager.getChain(chainName);
  if (!chain) return null;

  const joints = this.kinematicsManager.getChainJoints(chain.id);
  if (joints.length === 0) return null;

  const jointAngles = joints.map((j: JointConfig) => j.position);

  // Get TCP in robot-local space
  const localPose = this.solve(chainName, jointAngles);
  if (!localPose) return null;

  // Get robot base node (first joint's parent)
  const firstJoint = joints[0];
  const baseNode = this.sceneTreeManager.getNode(firstJoint.parentNodeId);
  if (!baseNode) {
    console.warn(`[FK Solver] Base node not found for chain ${chainName}`);
    return localPose; // Return local pose if we can't find base
  }

  // Get robot base Babylon node to get world transform
  const scene = this.sceneManager.getScene();
  if (!scene) return localPose;

  const baseBabylonNode = this.getBabylonNode(baseNode.id, scene);
  if (!baseBabylonNode) {
    console.warn(`[FK Solver] Base Babylon node not found for ${baseNode.id}`);
    return localPose;
  }

  // Compute world matrix for base
  baseBabylonNode.computeWorldMatrix(true);
  const baseWorldMatrix = baseBabylonNode.getWorldMatrix();

  // Transform TCP from robot-local to world space
  const worldPosition = BABYLON.Vector3.TransformCoordinates(
    localPose.position,
    baseWorldMatrix
  );

  // Transform rotation to world space
  const baseWorldRotation = BABYLON.Quaternion.FromRotationMatrix(baseWorldMatrix);
  const worldRotation = baseWorldRotation.multiply(localPose.rotation);

  console.log(`[FK Solver] TCP for ${chainName}: Local(${localPose.position.x.toFixed(2)}, ${localPose.position.y.toFixed(2)}, ${localPose.position.z.toFixed(2)}) → World(${worldPosition.x.toFixed(2)}, ${worldPosition.y.toFixed(2)}, ${worldPosition.z.toFixed(2)})`);

  return {
    position: worldPosition,
    rotation: worldRotation,
  };
}
```

---

## What This Fix Does

1. **Computes local TCP:** Still uses `solve()` to get TCP in robot-local coordinates
2. **Finds robot base:** Gets the first joint's parent node (robot base link)
3. **Gets world transform:** Retrieves the base link's world transform matrix
4. **Transforms to world space:** Uses `TransformCoordinates` to convert local TCP to world position
5. **Transforms rotation:** Combines base rotation with TCP rotation

---

## Example

For robot m710ic70 positioned at world coordinates (5000, 0, 0) mm:

**Before Fix:**
- FK computes TCP at (1.2, 0.8, 0.5) meters in local space
- `getEndEffectorPose()` returns (1.2, 0.8, 0.5) meters ❌
- Gizmo appears at (1200, 800, 500) mm in world space (WRONG!)

**After Fix:**
- FK computes TCP at (1.2, 0.8, 0.5) meters in local space
- Base transform is at (5.0, 0, 0) meters
- `getEndEffectorPose()` returns (6.2, 0.8, 0.5) meters ✅
- Gizmo appears at (6200, 800, 500) mm in world space (CORRECT!)

---

## Testing

After applying the fix:

1. Load m710ic70 robot
2. Open Motion panel
3. Click "TCP" tab
4. TCP gizmo should now appear at the robot's end-effector tip ✅
5. Drag gizmo → robot should follow via IK

---

## Alternative: If Robot Base is Always at Origin

If all robots are loaded at world origin (0,0,0), this fix won't change behavior because the base transform is identity. The fix is **safe and future-proof** for when:
- Users move robots around the scene
- Multiple robots are loaded
- Robots are part of larger assemblies

---

## Side Effects

This fix **may affect**:
- IK solver if it was compensating for the wrong TCP position
- TCP position display in UI (should now show correct world coordinates)
- Saved poses/keyframes (positions are still stored correctly)

**Review needed:**
- Check [InverseKinematicsSolver.ts](../src/kinematics/InverseKinematicsSolver.ts) to ensure it handles world-space targets correctly
- Update unit tests if they expect local-space TCP

---

## Files Modified

1. **`src/kinematics/ForwardKinematicsSolver.ts`** - `getEndEffectorPose()` method

---

**Status:** Fix documented, ready to apply
**Priority:** HIGH - Blocks TCP control functionality
**Estimated effort:** 5 minutes
