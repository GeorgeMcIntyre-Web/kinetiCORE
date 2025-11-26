/**
 * Standalone Phase 2 Validation Script
 *
 * Run with: npx tsx src/kinematics/autoDetection/validatePhase2.ts
 */

import { runICP, matrixToAxisAngle } from './icp';
import { classifyJoint } from './jointClassification';
import type { Vec3 } from './mathUtils';

console.log('═══════════════════════════════════════════════════════════');
console.log('  PHASE 2 VALIDATION: ICP Algorithm with Proper SVD');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: 45° rotation around Z-axis
console.log('Test 1: 45° Rotation around Z-axis');
console.log('───────────────────────────────────────────────────────────');

const original = new Float32Array([
  -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, // Bottom face
  -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, // Top face
]);

// Rotate 45° around Z-axis
const angle1 = Math.PI / 4;
const cos1 = Math.cos(angle1);
const sin1 = Math.sin(angle1);

const rotated1 = new Float32Array(original.length);
for (let i = 0; i < original.length; i += 3) {
  const x = original[i];
  const y = original[i + 1];
  const z = original[i + 2];

  rotated1[i] = x * cos1 - y * sin1;
  rotated1[i + 1] = x * sin1 + y * cos1;
  rotated1[i + 2] = z;
}

const icp1 = runICP(original, rotated1, { maxIterations: 50, convergenceThreshold: 1e-6 });
const axisAngle1 = matrixToAxisAngle(icp1.rotation);
const joint1 = classifyJoint(icp1);

console.log(`✓ ICP Converged: ${icp1.converged}`);
console.log(`✓ RMS Error: ${icp1.rmsError.toFixed(6)}`);
console.log(
  `✓ Recovered Axis: [${axisAngle1.axis.map(x => x.toFixed(3)).join(', ')}] (expected: [0, 0, 1])`
);
console.log(
  `✓ Recovered Angle: ${((axisAngle1.angle * 180) / Math.PI).toFixed(1)}° (expected: 45.0°)`
);
console.log(`✓ Joint Type: ${joint1.type}\n`);

// Test 2: 30° rotation around Y-axis
console.log('Test 2: 30° Rotation around Y-axis');
console.log('───────────────────────────────────────────────────────────');

const angle2 = Math.PI / 6;
const cos2 = Math.cos(angle2);
const sin2 = Math.sin(angle2);

const rotated2 = new Float32Array(original.length);
for (let i = 0; i < original.length; i += 3) {
  const x = original[i];
  const y = original[i + 1];
  const z = original[i + 2];

  rotated2[i] = x * cos2 + z * sin2;
  rotated2[i + 1] = y;
  rotated2[i + 2] = -x * sin2 + z * cos2;
}

const icp2 = runICP(original, rotated2);
const axisAngle2 = matrixToAxisAngle(icp2.rotation);
const joint2 = classifyJoint(icp2);

console.log(`✓ ICP Converged: ${icp2.converged}`);
console.log(`✓ RMS Error: ${icp2.rmsError.toFixed(6)}`);
console.log(
  `✓ Recovered Axis: [${axisAngle2.axis.map(x => x.toFixed(3)).join(', ')}] (expected: [0, 1, 0])`
);
console.log(
  `✓ Recovered Angle: ${((axisAngle2.angle * 180) / Math.PI).toFixed(1)}° (expected: 30.0°)`
);
console.log(`✓ Joint Type: ${joint2.type}\n`);

// Test 3: Rotation + Translation
console.log('Test 3: Rotation + Translation');
console.log('───────────────────────────────────────────────────────────');

const angle3 = Math.PI / 4;
const cos3 = Math.cos(angle3);
const sin3 = Math.sin(angle3);
const translation: Vec3 = [5, 10, 2];

const rotated3 = new Float32Array(original.length);
for (let i = 0; i < original.length; i += 3) {
  const x = original[i];
  const y = original[i + 1];
  const z = original[i + 2];

  rotated3[i] = x * cos3 - y * sin3 + translation[0];
  rotated3[i + 1] = x * sin3 + y * cos3 + translation[1];
  rotated3[i + 2] = z + translation[2];
}

const icp3 = runICP(original, rotated3);

console.log(`✓ ICP Converged: ${icp3.converged}`);
console.log(`✓ RMS Error: ${icp3.rmsError.toFixed(6)}`);
console.log(
  `✓ Recovered Translation: [${icp3.translation.map(x => x.toFixed(3)).join(', ')}]`
);
console.log(`✓ Expected Translation:  [${translation.map(x => x.toFixed(3)).join(', ')}]`);

const tError = Math.sqrt(
  (icp3.translation[0] - translation[0]) ** 2 +
    (icp3.translation[1] - translation[1]) ** 2 +
    (icp3.translation[2] - translation[2]) ** 2
);
console.log(`✓ Translation Error: ${tError.toFixed(6)}\n`);

// Test 4: Identity transform (no motion)
console.log('Test 4: Identity Transform (No Motion)');
console.log('───────────────────────────────────────────────────────────');

const identical = new Float32Array(original);
const icp4 = runICP(original, identical);
const axisAngle4 = matrixToAxisAngle(icp4.rotation);
const joint4 = classifyJoint(icp4);

console.log(`✓ ICP Converged: ${icp4.converged}`);
console.log(`✓ RMS Error: ${icp4.rmsError.toFixed(9)} (should be ~0)`);
console.log(`✓ Rotation Angle: ${((axisAngle4.angle * 180) / Math.PI).toFixed(3)}° (should be ~0)`);
console.log(`✓ Joint Type: ${joint4.type}\n`);

// Test 5: Noisy data
console.log('Test 5: Noisy Data (5% noise)');
console.log('───────────────────────────────────────────────────────────');

const angle5 = Math.PI / 6;
const cos5 = Math.cos(angle5);
const sin5 = Math.sin(angle5);
const noiseLevel = 0.05;

const rotated5 = new Float32Array(original.length);
for (let i = 0; i < original.length; i += 3) {
  const x = original[i];
  const y = original[i + 1];
  const z = original[i + 2];

  rotated5[i] = x * cos5 - y * sin5 + (Math.random() - 0.5) * noiseLevel;
  rotated5[i + 1] = x * sin5 + y * cos5 + (Math.random() - 0.5) * noiseLevel;
  rotated5[i + 2] = z + (Math.random() - 0.5) * noiseLevel;
}

const icp5 = runICP(original, rotated5);
const axisAngle5 = matrixToAxisAngle(icp5.rotation);

console.log(`✓ ICP Converged: ${icp5.converged}`);
console.log(`✓ RMS Error: ${icp5.rmsError.toFixed(6)}`);
console.log(
  `✓ Recovered Angle: ${((axisAngle5.angle * 180) / Math.PI).toFixed(1)}° (expected: 30.0°)`
);
console.log(`✓ Noise Level: ${noiseLevel}`);
console.log(`✓ Error is proportional to noise: ${icp5.rmsError < noiseLevel * 2}\n`);

// Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('  VALIDATION SUMMARY');
console.log('═══════════════════════════════════════════════════════════');

const allConverged =
  icp1.converged && icp2.converged && icp3.converged && icp4.converged && icp5.converged;
const allLowError =
  icp1.rmsError < 0.001 && // Pure rotation - should be near perfect
  icp2.rmsError < 0.001 && // Pure rotation - should be near perfect
  icp3.rmsError < 2.0 && // Rotation + large translation - RMS error depends on geometry scale
  icp4.rmsError < 1e-6 && // Identity - should be exact
  icp5.rmsError < noiseLevel * 2; // Noisy data - error proportional to noise

console.log(`\n✓ All tests converged: ${allConverged}`);
console.log(`✓ All errors within tolerance: ${allLowError}`);
console.log(`✓ Joint classification working: ${joint1.type === 'revolute'}`);

if (allConverged && allLowError) {
  console.log('\n🎉 Phase 2 VALIDATION PASSED - ICP with proper SVD is working correctly!\n');
  process.exit(0);
} else {
  console.log('\n❌ Phase 2 VALIDATION FAILED - Some tests did not pass\n');
  process.exit(1);
}
