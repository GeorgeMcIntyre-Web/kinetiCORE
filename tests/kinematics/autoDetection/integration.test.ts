/**
 * End-to-End Integration Test: Automatic Kinematics Detection Pipeline
 *
 * Tests the complete pipeline from GLB loading to joint parameter extraction.
 *
 * Test Strategy:
 * 1. Load a real GLB file with known moving parts
 * 2. Run Steps 1-2 (unit detection, pose pair detection)
 * 3. Run Steps 3-6 (vertex extraction, ICP, joint classification)
 * 4. Validate results against expected parameters
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import {
  detectUnits,
  findPosePairs,
  extractPosePairVertices,
  runICP,
  matrixToAxisAngle,
  classifyJoint,
  computePivotPoint,
  type GLBTreeData,
  type Vec3,
} from '@/kinematics/autoDetection';

// Test data path - using 016ZF fixture with known moving parts
const TEST_FIXTURE_JSON =
  'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/016ZF_20142435_130/016ZF_20142435_130_tree.json';

const TEST_FIXTURE_GLB =
  'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/016ZF_20142435_130/016ZF_20142435_130.glb';

describe('Phase 2: End-to-End Pipeline Integration', () => {
  let scene: BABYLON.Scene;
  let engine: BABYLON.NullEngine;
  let treeData: GLBTreeData;

  beforeAll(async () => {
    // Setup Babylon scene for GLB loading
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);

    // Load GLB tree data
    const fs = await import('fs');
    const dataText = fs.readFileSync(TEST_FIXTURE_JSON, 'utf-8');
    treeData = JSON.parse(dataText);

    // Note: In a real test, we would load the GLB file here
    // For now, we'll test with the JSON data only (Steps 1-2)
  });

  it('Step 1: Unit Detection - should find all units', () => {
    const units = detectUnits(treeData, { verbose: false });

    console.log(`\n[Integration Test] Found ${units.length} units`);
    units.forEach((unit, i) => {
      const node = treeData.nodes[unit.nodeIndex];
      console.log(
        `  Unit ${i + 1}: ${node.name} (${unit.subtreePointCount} vertices, ${unit.percentOfTotal.toFixed(1)}%)`
      );
    });

    expect(units.length).toBeGreaterThan(0);
    expect(units.length).toBeLessThanOrEqual(15);

    // Validate coverage
    const totalCoverage = units.reduce((sum, u) => sum + u.percentOfTotal, 0);
    expect(totalCoverage).toBeGreaterThanOrEqual(85); // At least 85% coverage
    expect(totalCoverage).toBeLessThanOrEqual(100);
  });

  it('Step 2: Pose Pair Detection - should find moving parts', () => {
    const units = detectUnits(treeData, { verbose: false });
    let totalPairs = 0;
    let unitsWithMotion = 0;

    console.log(`\n[Integration Test] Analyzing ${units.length} units for moving parts...`);

    for (const unit of units) {
      const pairs = findPosePairs(treeData, unit, { verbose: false });

      if (pairs.length > 0) {
        unitsWithMotion++;
        totalPairs += pairs.length;

        const node = treeData.nodes[unit.nodeIndex];
        console.log(`\n  Unit: ${node.name}`);
        pairs.forEach((pair, i) => {
          const nodeA = treeData.nodes[pair.geometryMatches[0].subtreeA];
          const nodeB = treeData.nodes[pair.geometryMatches[0].subtreeB];
          console.log(
            `    Pair ${i + 1}: ${nodeA.name} ↔ ${nodeB.name} (confidence: ${(pair.confidence * 100).toFixed(1)}%)`
          );
        });
      }
    }

    console.log(
      `\n[Integration Test] Found ${totalPairs} pose pairs in ${unitsWithMotion} units`
    );

    expect(totalPairs).toBeGreaterThan(0); // Should find at least one moving part
    expect(unitsWithMotion).toBeGreaterThan(0);
  });

  it.skip('Step 3-6: Complete Pipeline - vertex extraction, ICP, joint detection', async () => {
    // This test requires loading the actual GLB file
    // Skipped until we implement GLB loading in test environment

    // 1. Detect units and pose pairs
    const units = detectUnits(treeData);
    const unit = units[0];
    const pairs = findPosePairs(treeData, unit);

    if (pairs.length === 0) {
      console.log('[Integration Test] No pose pairs found, skipping pipeline test');
      return;
    }

    const pair = pairs[0];
    const matchA = pair.geometryMatches[0].subtreeA;
    const matchB = pair.geometryMatches[0].subtreeB;

    console.log(`\n[Integration Test] Testing complete pipeline on pose pair:`);
    console.log(`  Node A: ${treeData.nodes[matchA].name}`);
    console.log(`  Node B: ${treeData.nodes[matchB].name}`);

    // 2. Extract vertices (requires Babylon scene with loaded GLB)
    const { poseA, poseB } = extractPosePairVertices(scene, treeData, matchA, matchB, {
      subsampleRatio: 0.1, // Use 10% of vertices for speed
      verbose: true,
    });

    expect(poseA.length).toBeGreaterThan(0);
    expect(poseB.length).toBeGreaterThan(0);

    console.log(`  Extracted ${poseA.length / 3} vertices from pose A`);
    console.log(`  Extracted ${poseB.length / 3} vertices from pose B`);

    // 3. Run ICP
    const icpResult = runICP(poseA, poseB, {
      maxIterations: 50,
      convergenceThreshold: 1e-6,
      subsampleRatio: 0.1,
    });

    expect(icpResult.converged).toBe(true);
    expect(icpResult.rmsError).toBeLessThan(0.01); // Less than 10mm error

    console.log(`  ICP converged: ${icpResult.converged}`);
    console.log(`  RMS error: ${icpResult.rmsError.toFixed(6)}`);
    console.log(`  Correspondences: ${icpResult.correspondences}`);

    // 4. Convert rotation to axis-angle
    const axisAngle = matrixToAxisAngle(icpResult.rotation);

    console.log(
      `  Rotation axis: [${axisAngle.axis.map(x => x.toFixed(3)).join(', ')}]`
    );
    console.log(`  Rotation angle: ${((axisAngle.angle * 180) / Math.PI).toFixed(1)}°`);

    // 5. Classify joint
    const joint = classifyJoint(icpResult);

    expect(['revolute', 'prismatic']).toContain(joint.type);

    console.log(`  Joint type: ${joint.type}`);

    if (joint.type === 'revolute') {
      expect(joint.rotationAxis).toBeDefined();
      expect(joint.rotationAngle).toBeGreaterThan(0);

      console.log(
        `  Revolute axis: [${joint.rotationAxis!.map(x => x.toFixed(3)).join(', ')}]`
      );
      console.log(`  Revolute angle: ${((joint.rotationAngle! * 180) / Math.PI).toFixed(1)}°`);

      // 6. Compute pivot point
      const closedPoints: Vec3[] = [];
      const openPoints: Vec3[] = [];

      // Sample points from vertex arrays
      for (let i = 0; i < Math.min(100, poseA.length / 3); i++) {
        closedPoints.push([poseA[i * 3], poseA[i * 3 + 1], poseA[i * 3 + 2]]);
        openPoints.push([poseB[i * 3], poseB[i * 3 + 1], poseB[i * 3 + 2]]);
      }

      const pivot = computePivotPoint(
        closedPoints,
        openPoints,
        joint.rotationAxis!,
        joint.rotationAngle!
      );

      expect(pivot).toBeDefined();
      console.log(`  Pivot point: [${pivot.map(x => x.toFixed(3)).join(', ')}]`);
    } else if (joint.type === 'prismatic') {
      expect(joint.translationAxis).toBeDefined();
      expect(joint.translationDistance).toBeGreaterThan(0);

      console.log(
        `  Prismatic axis: [${joint.translationAxis!.map(x => x.toFixed(3)).join(', ')}]`
      );
      console.log(`  Translation distance: ${joint.translationDistance!.toFixed(3)}`);
    }
  });

  it('Performance: Steps 1-2 should complete in <1 second', () => {
    const start = performance.now();

    const units = detectUnits(treeData);
    let totalPairs = 0;
    for (const unit of units) {
      const pairs = findPosePairs(treeData, unit);
      totalPairs += pairs.length;
    }

    const elapsed = performance.now() - start;

    console.log(`\n[Performance] Steps 1-2 completed in ${elapsed.toFixed(1)}ms`);
    console.log(`  Units detected: ${units.length}`);
    console.log(`  Pose pairs found: ${totalPairs}`);

    expect(elapsed).toBeLessThan(1000); // Should be fast (no heavy computation)
  });
});

describe('Phase 2: ICP Algorithm Validation', () => {
  it('ICP should recover known rotation (synthetic test)', () => {
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

    console.log(`\n[ICP Synthetic Test] Recovered rotation:`);
    console.log(`  Axis: [${axisAngle.axis.map(x => x.toFixed(3)).join(', ')}]`);
    console.log(`  Angle: ${recoveredAngleDeg.toFixed(1)}°`);
    console.log(`  RMS Error: ${icpResult.rmsError.toFixed(6)}`);
  });

  it('ICP should handle noisy data', () => {
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

    console.log(`\n[ICP Noisy Data Test] Recovered rotation:`);
    console.log(`  Angle: ${recoveredAngleDeg.toFixed(1)}° (expected: 30.0°)`);
    console.log(`  RMS Error: ${icpResult.rmsError.toFixed(6)}`);

    // Should still recover angle within reasonable tolerance
    expect(Math.abs(recoveredAngleDeg - 30)).toBeLessThan(5); // Within 5 degrees
  });
});
