# Forward Kinematics - Quick Reference Card

⚠️ **CRITICAL WARNING:** Do NOT use `Matrix.multiply()` for FK transform accumulation!

---

## The Correct Pattern

```typescript
// ✅ CORRECT - Use this pattern for FK accumulation
let accumulatedPosition = BABYLON.Vector3.Zero();
let accumulatedRotation = BABYLON.Quaternion.Identity();

for (let i = 0; i < joints.length; i++) {
  // 1. Get local translation
  const localTranslation = new BABYLON.Vector3(joint.origin.x, joint.origin.y, joint.origin.z);

  // 2. Transform by accumulated rotation (parent's rotation)
  const worldTranslation = localTranslation.applyRotationQuaternion(accumulatedRotation);

  // 3. Add to accumulated position
  accumulatedPosition.addInPlace(worldTranslation);

  // 4. Build local rotation (origin rotation * joint rotation)
  let localRotation = /* origin rotation quaternion */;
  if (joint.type === 'revolute') {
    const jointRot = BABYLON.Quaternion.RotationAxis(axis, angle);
    localRotation = localRotation.multiply(jointRot);
  }

  // 5. Accumulate rotation
  accumulatedRotation = accumulatedRotation.multiply(localRotation);
}

return { position: accumulatedPosition, rotation: accumulatedRotation };
```

---

## What NOT To Do

```typescript
// ❌ WRONG - This will cause Z=0 bug
let accumulatedTransform = BABYLON.Matrix.Identity();
for (let i = 0; i < joints.length; i++) {
  const linkTransform = /* any matrix */;
  accumulatedTransform = accumulatedTransform.multiply(linkTransform); // DON'T DO THIS!
}
const position = accumulatedTransform.getTranslation(); // Z will be 0!
```

---

## Why This Matters

Babylon's scene graph uses:
```
childWorld = parentPos + (childLocal rotated by parentRot)
```

Matrix multiplication uses different math. **They give different results!**

---

## Quick Test

If FK is working correctly, this should print `0.00mm`:

```javascript
const chains = kinematicsManager.getAllChains();
const joints = kinematicsManager.getActuatedJoints(chains[0].id);
const fkPose = fkSolver.solve(chains[0].name, joints.map(j => j.position));
const meshPose = fkSolver.getNullTCPPose(chains[0].name);
const diff = BABYLON.Vector3.Distance(meshPose.position, fkPose.position);
console.log(`Divergence: ${(diff * 1000).toFixed(2)}mm`);
```

---

## Red Flags

If you see these symptoms, FK is broken:

1. **Z-coordinate is always 0** when joints are rotated
2. **Divergence > 1mm** between FK and mesh positions
3. **Someone used Matrix.multiply()** for transform accumulation

---

## Fix

If FK breaks:

1. Revert to the pattern shown at the top of this card
2. Use `applyRotationQuaternion()` for positions
3. Use `Quaternion.multiply()` for rotations
4. Read [FK_MATRIX_MULTIPLICATION_BUG_REPORT.md](FK_MATRIX_MULTIPLICATION_BUG_REPORT.md) for full details

---

## Files to Check

- [src/kinematics/ForwardKinematicsSolver.ts](src/kinematics/ForwardKinematicsSolver.ts) (lines 506-773)
  - `solve()` method (lines 606-655)
  - `solveUpToJoint()` method (lines 506-554)
  - `computeJacobian()` method (lines 665-773)

---

**Last Updated:** 2025-10-29
**Bug Report:** [FK_MATRIX_MULTIPLICATION_BUG_REPORT.md](FK_MATRIX_MULTIPLICATION_BUG_REPORT.md)
**Full Session:** [MH5_FK_IK_DEBUG_SESSION_COMPLETE_FINAL.md](MH5_FK_IK_DEBUG_SESSION_COMPLETE_FINAL.md)
