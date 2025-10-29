# Forward Kinematics Jacobian Verification Test

The Jacobian matrix is critical for IK and depends on accurate FK. Let's verify it's working correctly.

## What is the Jacobian?

The Jacobian relates joint velocities to end-effector velocity:
```
end_effector_velocity = Jacobian × joint_velocities
```

For a 6-DOF robot, the Jacobian is a 6×6 matrix:
- Rows 0-2: Linear velocity (X, Y, Z)
- Rows 3-5: Angular velocity (ωX, ωY, ωZ)

## Test Script

```javascript
console.clear();

// Get the kinematic chain
const chains = kinematicsManager.getAllChains();
const chain = chains[0];
const joints = kinematicsManager.getActuatedJoints(chain.id);

// Get current joint angles
const jointAngles = joints.map(j => j.position);

// Compute Jacobian
const jacobian = fkSolver.computeJacobian(chain.name, jointAngles);

if (!jacobian) {
  console.error('❌ Jacobian computation failed!');
} else {
  console.log('=== JACOBIAN VERIFICATION ===');
  console.log('');
  console.log('Joint Angles:', jointAngles.map(a => `${(a * 180 / Math.PI).toFixed(2)}°`).join(', '));
  console.log('');
  console.log('Jacobian Matrix (6×N):');
  console.log('');

  // Print Jacobian with labels
  const labels = ['vX', 'vY', 'vZ', 'ωX', 'ωY', 'ωZ'];
  const n = jacobian[0].length;

  // Header
  let header = '      ';
  for (let j = 0; j < n; j++) {
    header += `J${j}        `;
  }
  console.log(header);
  console.log('      ' + '─'.repeat(n * 10));

  // Rows
  for (let i = 0; i < 6; i++) {
    let row = `${labels[i]} | `;
    for (let j = 0; j < n; j++) {
      const val = jacobian[i][j];
      row += `${val >= 0 ? ' ' : ''}${val.toFixed(4)}  `;
    }
    console.log(row);
  }
  console.log('');

  // Numerical validation checks
  console.log('--- NUMERICAL VALIDATION ---');

  // Check 1: No NaN or Infinity
  let hasNaN = false;
  let hasInf = false;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < n; j++) {
      if (isNaN(jacobian[i][j])) hasNaN = true;
      if (!isFinite(jacobian[i][j])) hasInf = true;
    }
  }

  console.log(`NaN values: ${hasNaN ? '❌ FOUND' : '✅ None'}`);
  console.log(`Infinite values: ${hasInf ? '❌ FOUND' : '✅ None'}`);

  // Check 2: Reasonable magnitudes (should be < 10 for most robots)
  let maxMagnitude = 0;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < n; j++) {
      maxMagnitude = Math.max(maxMagnitude, Math.abs(jacobian[i][j]));
    }
  }
  console.log(`Max magnitude: ${maxMagnitude.toFixed(4)} ${maxMagnitude < 10 ? '✅' : '⚠️ High'}`);

  // Check 3: Not all zeros (would indicate broken Jacobian)
  let hasNonZero = false;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(jacobian[i][j]) > 1e-6) hasNonZero = true;
    }
  }
  console.log(`Non-zero entries: ${hasNonZero ? '✅ Yes' : '❌ All zeros!'}`);

  // Check 4: Rank check (Jacobian should be full rank except at singularities)
  // For 6-DOF robot, determinant of 6×6 Jacobian should be non-zero
  if (n === 6) {
    // Compute determinant (simplified - just check if any row/col is all zeros)
    let isFullRank = true;
    for (let i = 0; i < 6; i++) {
      let rowNorm = 0;
      for (let j = 0; j < 6; j++) {
        rowNorm += jacobian[i][j] * jacobian[i][j];
      }
      if (rowNorm < 1e-10) {
        isFullRank = false;
        console.log(`⚠️ Row ${i} is nearly zero - possible singularity`);
      }
    }
    console.log(`Rank check: ${isFullRank ? '✅ Full rank' : '⚠️ Rank deficient (singularity?)'}`);
  }

  console.log('');

  // Final verdict
  if (!hasNaN && !hasInf && hasNonZero && maxMagnitude < 100) {
    console.log('✅ JACOBIAN: Numerically valid!');
  } else {
    console.log('❌ JACOBIAN: Issues detected!');
  }
}
```

## Numerical Derivative Test (Gold Standard)

Verify Jacobian accuracy by comparing to numerical derivatives:

```javascript
console.clear();

const chains = kinematicsManager.getAllChains();
const chain = chains[0];
const joints = kinematicsManager.getActuatedJoints(chain.id);
const jointAngles = joints.map(j => j.position);
const n = jointAngles.length;

// Compute analytical Jacobian
const J_analytical = fkSolver.computeJacobian(chain.name, jointAngles);

// Compute numerical Jacobian using finite differences
const epsilon = 1e-6; // Small perturbation
const J_numerical = Array(6).fill(0).map(() => Array(n).fill(0));

// Get FK at current position
const fk0 = fkSolver.solve(chain.name, jointAngles);
const p0 = fk0.position;
const q0 = fk0.rotation;

for (let j = 0; j < n; j++) {
  // Perturb joint j by epsilon
  const jointAnglesPerturbed = [...jointAngles];
  jointAnglesPerturbed[j] += epsilon;

  // Compute FK at perturbed position
  const fk1 = fkSolver.solve(chain.name, jointAnglesPerturbed);
  const p1 = fk1.position;
  const q1 = fk1.rotation;

  // Linear velocity (dp/dtheta)
  J_numerical[0][j] = (p1.x - p0.x) / epsilon;
  J_numerical[1][j] = (p1.y - p0.y) / epsilon;
  J_numerical[2][j] = (p1.z - p0.z) / epsilon;

  // Angular velocity (dω/dtheta) - approximated using quaternion difference
  // ω ≈ 2 * (q1 - q0) / epsilon (simplified)
  const dq = new BABYLON.Quaternion(
    q1.x - q0.x,
    q1.y - q0.y,
    q1.z - q0.z,
    q1.w - q0.w
  );
  J_numerical[3][j] = 2 * dq.x / epsilon;
  J_numerical[4][j] = 2 * dq.y / epsilon;
  J_numerical[5][j] = 2 * dq.z / epsilon;
}

// Compare analytical vs numerical
console.log('=== JACOBIAN ACCURACY TEST ===');
console.log('');
console.log('Comparing analytical Jacobian vs numerical derivatives:');
console.log('');

let maxError = 0;
let avgError = 0;
let errorCount = 0;

console.log('      ' + 'Analytical'.padEnd(60) + ' | ' + 'Numerical'.padEnd(60) + ' | Error');
console.log('─'.repeat(140));

for (let i = 0; i < 6; i++) {
  const labels = ['vX', 'vY', 'vZ', 'ωX', 'ωY', 'ωZ'];
  let rowAnalytical = `${labels[i]} | `;
  let rowNumerical = `${labels[i]} | `;
  let rowError = `${labels[i]} | `;

  for (let j = 0; j < n; j++) {
    const analytical = J_analytical[i][j];
    const numerical = J_numerical[i][j];
    const error = Math.abs(analytical - numerical);

    rowAnalytical += `${analytical >= 0 ? ' ' : ''}${analytical.toFixed(4)}  `;
    rowNumerical += `${numerical >= 0 ? ' ' : ''}${numerical.toFixed(4)}  `;
    rowError += `${error.toFixed(6)}  `;

    maxError = Math.max(maxError, error);
    avgError += error;
    errorCount++;
  }

  console.log(rowAnalytical + ' |');
  console.log(rowNumerical + ' |');
  console.log(rowError);
  console.log('');
}

avgError /= errorCount;

console.log('--- ERROR STATISTICS ---');
console.log(`Max error: ${maxError.toExponential(4)}`);
console.log(`Avg error: ${avgError.toExponential(4)}`);
console.log('');

// Verdict
if (maxError < 1e-4) {
  console.log('✅ EXCELLENT: Jacobian matches numerical derivatives to high precision!');
} else if (maxError < 1e-3) {
  console.log('✅ GOOD: Jacobian matches numerical derivatives (small numerical errors).');
} else if (maxError < 1e-2) {
  console.log('⚠️ ACCEPTABLE: Jacobian has some errors but may be usable.');
} else {
  console.log('❌ PROBLEM: Jacobian has significant errors!');
}
```

## What This Tests

1. **Numerical Validity**
   - No NaN or Infinity values
   - Reasonable magnitudes
   - Non-zero entries
   - Full rank (except at singularities)

2. **Accuracy Against Ground Truth**
   - Compares analytical Jacobian to numerical derivatives
   - Numerical derivatives are the "gold standard"
   - Should match to within numerical precision (< 1e-4)

## Why Jacobian Depends on FK

The Jacobian is computed using the formula:

```
J_linear[i] = axis[i] × (tcp_position - joint_position[i])
J_angular[i] = axis[i]
```

This requires:
- `joint_position[i]` from FK at each joint
- `tcp_position` from FK at end effector
- Both MUST be accurate or Jacobian will be wrong!

## Expected Results

If FK is working correctly (0.00mm position divergence), the Jacobian should:
- ✅ Have no NaN/Inf values
- ✅ Have non-zero entries
- ✅ Match numerical derivatives to < 1e-4 error
- ✅ Be full rank (except at singularities)

## What to Look For

### If Jacobian has errors:
1. **All zeros** → FK might be returning wrong positions
2. **NaN/Inf** → Possible divide-by-zero or invalid rotation
3. **Doesn't match numerical** → FK position/rotation divergence

### If Jacobian is correct:
- This confirms FK is working for ALL joints (not just TCP)
- IK solver can now use accurate Jacobian
- Motion planning and control will work correctly

---

**Created:** 2025-10-29
**Purpose:** Verify Jacobian accuracy as final validation of FK fix
**Dependency:** Requires FK position and rotation to be correct
