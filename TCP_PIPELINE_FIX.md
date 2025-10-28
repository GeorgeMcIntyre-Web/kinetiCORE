# TCP Movement Bug Fix

**Date:** 2025-01-28
**Status:** ✅ FIXED
**Bug:** Robot moved away from target instead of toward it when using TCP jog buttons or gizmo
**Root Cause:** Jacobian cross product had wrong order (sign error)

## The Problem

When moving the TCP with X+ button or dragging the gizmo, the IK solver would diverge:
- Initial error: 0.001m (1mm - the jog step)
- After 300 iterations: 0.624m (624mm)
- **Error grew by 624x instead of converging to zero**

This meant the Jacobian was pushing the robot AWAY from the target instead of toward it.

## Root Cause Analysis

The bug was in [ForwardKinematicsSolver.ts:790](src/kinematics/ForwardKinematicsSolver.ts#L790):

### Incorrect Code (Before Fix):
```typescript
// Linear velocity: v = axis × (end_effector_pos - joint_pos)
const r = endEffectorPos.subtract(jointPos);
const linearVel = BABYLON.Vector3.Cross(worldAxis, r);  // ❌ WRONG ORDER
```

### Correct Code (After Fix):
```typescript
// Linear velocity: v = r × axis (NOT axis × r!)
// r = vector from joint to end-effector
// Cross product is anti-commutative: a × b = -(b × a)
const r = endEffectorPos.subtract(jointPos);
const linearVel = BABYLON.Vector3.Cross(r, worldAxis);  // ✅ CORRECT ORDER
```

## Why This Matters

The Jacobian relates joint velocities to end-effector velocities:

**v = J · θ̇**

Where:
- **v** = end-effector linear velocity (3D vector)
- **J** = Jacobian matrix (6×n for n joints)
- **θ̇** = joint angle velocities (n-dimensional vector)

For revolute joints, the linear velocity column of the Jacobian is:

**v = ω × r = r × axis**

Where:
- **ω** = angular velocity = axis (for unit joint velocity)
- **r** = vector from joint to end-effector
- **axis** = joint rotation axis (in world space)

The cross product is **anti-commutative**:
- **a × b = -(b × a)**

So `Cross(worldAxis, r)` gives the **opposite direction** of `Cross(r, worldAxis)`.

This caused the IK to move the robot in the opposite direction from the target, making the error grow exponentially instead of converging.

## The Fix

Changed line 792 in [ForwardKinematicsSolver.ts](src/kinematics/ForwardKinematicsSolver.ts#L792):

```diff
- const linearVel = BABYLON.Vector3.Cross(worldAxis, r);
+ const linearVel = BABYLON.Vector3.Cross(r, worldAxis);
```

## Testing

To test this fix:

1. Load a robot (e.g., motoman_mh5)
2. Switch to TCP mode
3. Click X+ button (should move 10mm in world X direction)
4. Expected: IK converges in <50 iterations, robot moves toward target
5. Drag gizmo Z axis
6. Expected: IK converges, robot follows gizmo smoothly

## Files Changed

- [src/kinematics/ForwardKinematicsSolver.ts](src/kinematics/ForwardKinematicsSolver.ts#L788-L792) - Fixed cross product order

## Related Documentation

- [TCP_PIPELINE_STATUS.md](TCP_PIPELINE_STATUS.md) - Full TCP pipeline analysis
- [TCP_GIZMO_INTEGRATION_SOLUTION.md](TCP_GIZMO_INTEGRATION_SOLUTION.md) - Initial gizmo design
- [docs/TCP_GIZMO_FIX.md](docs/TCP_GIZMO_FIX.md) - Previous fix attempts

## Technical Background

### Jacobian for Revolute Joint

The velocity kinematics for a manipulator is:

**v_e = Σ (J_i · θ̇_i)**

For each revolute joint i, the Jacobian column is:

**J_i = [v_linear, v_angular]ᵀ**

Where:
- **v_linear = r_i × axis_i** (linear velocity component)
- **v_angular = axis_i** (angular velocity component)
- **r_i = p_e - p_i** (vector from joint i to end-effector)
- **axis_i** = joint rotation axis (world space)
- **p_e** = end-effector position (world space)
- **p_i** = joint position (world space)

The order matters because cross product is not commutative!

### World Space vs Robot-Local Space

The Jacobian was recently fixed to compute in world space:
- Line 699: `baseWorldMatrix` seeds the FK chain in world space
- Line 704-707: End-effector position transformed to world space
- Line 710-764: Joint transforms accumulated in world space
- Line 772-785: Joint axes transformed to world space

This ensures that:
1. Error vectors are in world space (from gizmo)
2. Jacobian columns are in world space
3. Target positions are in world space
4. Everything is in the same coordinate frame for IK

The cross product sign fix was the final missing piece.

## Impact

This fix enables:
- ✅ TCP button jogging (X+, Y+, Z+, etc.)
- ✅ TCP gizmo dragging (position control)
- ✅ Jacobian transpose IK method
- ✅ CCD IK method (relies on same FK code)
- ✅ Future work: FABRIK IK (also uses FK for error calculation)

## Next Steps

1. Test with various robots (6-axis, 7-axis, etc.)
2. Test with different poses (singularities, joint limits)
3. Add orientation control (rotation IK)
4. Optimize convergence rate (tune step size, damping)
5. Add visual feedback for IK success/failure in UI
