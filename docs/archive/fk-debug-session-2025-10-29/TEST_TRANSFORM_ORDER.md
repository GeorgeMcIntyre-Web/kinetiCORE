# Testing Transform Order

The bug is that `Matrix.Compose(scale, rotation, translation)` applies transforms in the wrong order for FK.

## Test this in console:

```javascript
console.clear();

// Test 1: Matrix.Compose (current approach)
const rot45Y = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 1, 0), 45 * Math.PI / 180);
const trans = new BABYLON.Vector3(0.088, 0.131, 0);

const composed = BABYLON.Matrix.Compose(BABYLON.Vector3.One(), rot45Y, trans);
const resultCompose = composed.getTranslation();

console.log('Matrix.Compose result:', resultCompose);
console.log('Expected: X≈0.062, Z≈-0.062 (rotated)');
console.log('Actual: X=' + resultCompose.x.toFixed(3) + ', Z=' + resultCompose.z.toFixed(3));

// Test 2: Manual multiplication (Translation × Rotation)
const rotMat = BABYLON.Matrix.FromQuaternionToRef(rot45Y, new BABYLON.Matrix());
const transMat = BABYLON.Matrix.Translation(trans.x, trans.y, trans.z);

const manual = transMat.multiply(rotMat);
const resultManual = manual.getTranslation();

console.log('\nTranslation × Rotation:', resultManual);
console.log('Expected: X≈0.088, Z≈0 (not rotated)');
console.log('Actual: X=' + resultManual.x.toFixed(3) + ', Z=' + resultManual.z.toFixed(3));

// Test 3: Apply translation to a point, then rotate it
const point = new BABYLON.Vector3(0.088, 0.131, 0);
const rotated = point.applyRotationQuaternion(rot45Y);

console.log('\nPoint rotated by quaternion:', rotated);
console.log('Expected: X≈0.062, Z≈-0.062');
console.log('Actual: X=' + rotated.x.toFixed(3) + ', Z=' + rotated.z.toFixed(3));
```

This will show us which method correctly applies rotation to the translation vector!
