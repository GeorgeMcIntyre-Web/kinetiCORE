/**
 * Unit Tests: ICP Algorithm with Proper SVD
 *
 * Validates that the ICP implementation with ml-matrix SVD correctly
 * recovers rotations and translations from point clouds.
 */

import { describe, it, expect } from 'vitest';
import { runICP, matrixToAxisAngle } from './icp';
import type { Vec3 } from './mathUtils';

describe('ICP Algorithm with Proper SVD', () => {
  it('should recover 45° rotation around Z-axis', () => {
    // Create synthetic test: rotate a cube 45° around Z-axis

    // Original cube vertices (±1 on all axes)
    const original = new Float32Array([
      -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, // Bottom face
      -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, // Top face
    ]);

    // Rotate 45° around Z-axis
    const angle = Math.PI / 4; // 45 degrees
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const rotated = new Float32Array(original.length);
    for (let i = 0; i < original.length; i += 3) {
      const x = original[i];
      const y = original[i + 1];
      const z = original[i + 2];

      rotated[i] = x * cos - y * sin;
      rotated[i + 1] = x * sin + y * cos;
      rotated[i + 2] = z;
    }

    // Run ICP
    const icpResult = runICP(original, rotated, {
      maxIterations: 50,
      convergenceThreshold: 1e-6,
    });

    expect(icpResult.converged).toBe(true);
    expect(icpResult.rmsError).toBeLessThan(0.001); // Very low error for synthetic test

    // Verify rotation axis is Z-axis
    const axisAngle = matrixToAxisAngle(icpResult.rotation);
    const expectedAxis: Vec3 = [0, 0, 1];

    // Allow for sign flip (rotation can be in either direction)
    const dotProduct = Math.abs(
      axisAngle.axis[0] * expectedAxis[0] +
        axisAngle.axis[1] * expectedAxis[1] +
        axisAngle.axis[2] * expectedAxis[2]
    );

    expect(dotProduct).toBeGreaterThan(0.99); // Nearly parallel

    // Verify angle is 45° (allow for sign flip)
    const recoveredAngleDeg = Math.abs((axisAngle.angle * 180) / Math.PI);
    expect(recoveredAngleDeg).toBeCloseTo(45, 0);

    console.log(`[ICP Test] 45° Z-rotation recovered:`);
    console.log(`  Axis: [${axisAngle.axis.map(x => x.toFixed(3)).join(', ')}]`);
    console.log(`  Angle: ${recoveredAngleDeg.toFixed(1)}°`);
    console.log(`  RMS Error: ${icpResult.rmsError.toFixed(6)}`);
  });

  it('should recover 30° rotation around Y-axis', () => {
    // Test rotation around different axis
    const original = new Float32Array([
      -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    ]);

    // Rotate 30° around Y-axis
    const angle = Math.PI / 6; // 30 degrees
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const rotated = new Float32Array(original.length);
    for (let i = 0; i < original.length; i += 3) {
      const x = original[i];
      const y = original[i + 1];
      const z = original[i + 2];

      rotated[i] = x * cos + z * sin;
      rotated[i + 1] = y;
      rotated[i + 2] = -x * sin + z * cos;
    }

    const icpResult = runICP(original, rotated);

    expect(icpResult.converged).toBe(true);
    expect(icpResult.rmsError).toBeLessThan(0.001);

    const axisAngle = matrixToAxisAngle(icpResult.rotation);
    const expectedAxis: Vec3 = [0, 1, 0];

    const dotProduct = Math.abs(
      axisAngle.axis[0] * expectedAxis[0] +
        axisAngle.axis[1] * expectedAxis[1] +
        axisAngle.axis[2] * expectedAxis[2]
    );

    expect(dotProduct).toBeGreaterThan(0.99);

    const recoveredAngleDeg = Math.abs((axisAngle.angle * 180) / Math.PI);
    expect(recoveredAngleDeg).toBeCloseTo(30, 0);

    console.log(`[ICP Test] 30° Y-rotation recovered:`);
    console.log(`  Axis: [${axisAngle.axis.map(x => x.toFixed(3)).join(', ')}]`);
    console.log(`  Angle: ${recoveredAngleDeg.toFixed(1)}°`);
  });

  it('should recover rotation with translation', () => {
    // Test rotation + translation together
    const original = new Float32Array([
      -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    ]);

    // Rotate 45° around Z and translate by [5, 10, 2]
    const angle = Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const translation: Vec3 = [5, 10, 2];

    const rotated = new Float32Array(original.length);
    for (let i = 0; i < original.length; i += 3) {
      const x = original[i];
      const y = original[i + 1];
      const z = original[i + 2];

      rotated[i] = x * cos - y * sin + translation[0];
      rotated[i + 1] = x * sin + y * cos + translation[1];
      rotated[i + 2] = z + translation[2];
    }

    const icpResult = runICP(original, rotated);

    expect(icpResult.converged).toBe(true);
    expect(icpResult.rmsError).toBeLessThan(0.001);

    // Verify translation
    const recoveredTranslation = icpResult.translation;
    expect(Math.abs(recoveredTranslation[0] - translation[0])).toBeLessThan(0.01);
    expect(Math.abs(recoveredTranslation[1] - translation[1])).toBeLessThan(0.01);
    expect(Math.abs(recoveredTranslation[2] - translation[2])).toBeLessThan(0.01);

    console.log(`[ICP Test] Rotation + translation recovered:`);
    console.log(
      `  Translation: [${recoveredTranslation.map(x => x.toFixed(3)).join(', ')}]`
    );
    console.log(`  Expected:    [${translation.map(x => x.toFixed(3)).join(', ')}]`);
  });

  it('should handle noisy data', () => {
    // Create cube with added noise
    const original = new Float32Array([
      -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    ]);

    // Rotate 30° and add random noise
    const angle = Math.PI / 6; // 30 degrees
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const noiseLevel = 0.05; // 5% noise

    const rotated = new Float32Array(original.length);
    for (let i = 0; i < original.length; i += 3) {
      const x = original[i];
      const y = original[i + 1];
      const z = original[i + 2];

      rotated[i] = x * cos - y * sin + (Math.random() - 0.5) * noiseLevel;
      rotated[i + 1] = x * sin + y * cos + (Math.random() - 0.5) * noiseLevel;
      rotated[i + 2] = z + (Math.random() - 0.5) * noiseLevel;
    }

    const icpResult = runICP(original, rotated);

    expect(icpResult.converged).toBe(true);
    expect(icpResult.rmsError).toBeLessThan(noiseLevel * 2); // Error proportional to noise

    const axisAngle = matrixToAxisAngle(icpResult.rotation);
    const recoveredAngleDeg = Math.abs((axisAngle.angle * 180) / Math.PI);

    console.log(`[ICP Test] Noisy data handled:`);
    console.log(`  Angle: ${recoveredAngleDeg.toFixed(1)}° (expected: 30.0°)`);
    console.log(`  RMS Error: ${icpResult.rmsError.toFixed(6)}`);

    // Should still recover angle within reasonable tolerance
    expect(Math.abs(recoveredAngleDeg - 30)).toBeLessThan(5); // Within 5 degrees
  });

  it('should handle identity transform (no rotation/translation)', () => {
    const original = new Float32Array([
      -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    ]);

    // Same points (identity transform)
    const identical = new Float32Array(original);

    const icpResult = runICP(original, identical);

    expect(icpResult.converged).toBe(true);
    expect(icpResult.rmsError).toBeLessThan(1e-6); // Nearly zero error

    // Verify rotation is identity (angle ~0)
    const axisAngle = matrixToAxisAngle(icpResult.rotation);
    expect(axisAngle.angle).toBeLessThan(0.01); // Angle < 0.5°

    // Verify translation is near zero
    const t = icpResult.translation;
    expect(Math.sqrt(t[0] * t[0] + t[1] * t[1] + t[2] * t[2])).toBeLessThan(1e-6);

    console.log(`[ICP Test] Identity transform detected:`);
    console.log(`  Angle: ${((axisAngle.angle * 180) / Math.PI).toFixed(3)}°`);
    console.log(`  RMS Error: ${icpResult.rmsError.toFixed(9)}`);
  });

  it('should converge for 90° rotation', () => {
    // Test large rotation
    const original = new Float32Array([
      -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    ]);

    // Rotate 90° around Z-axis
    const angle = Math.PI / 2; // 90 degrees
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const rotated = new Float32Array(original.length);
    for (let i = 0; i < original.length; i += 3) {
      const x = original[i];
      const y = original[i + 1];
      const z = original[i + 2];

      rotated[i] = x * cos - y * sin;
      rotated[i + 1] = x * sin + y * cos;
      rotated[i + 2] = z;
    }

    const icpResult = runICP(original, rotated);

    expect(icpResult.converged).toBe(true);
    expect(icpResult.rmsError).toBeLessThan(0.001);

    const axisAngle = matrixToAxisAngle(icpResult.rotation);
    const recoveredAngleDeg = Math.abs((axisAngle.angle * 180) / Math.PI);
    expect(recoveredAngleDeg).toBeCloseTo(90, 0);

    console.log(`[ICP Test] 90° rotation recovered:`);
    console.log(`  Angle: ${recoveredAngleDeg.toFixed(1)}°`);
  });
});
