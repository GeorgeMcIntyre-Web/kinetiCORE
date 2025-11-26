/**
 * Test Matrix-Based Pivot Computation vs Bisector Method
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import * as fs from 'fs';
import * as path from 'path';

import {
  extractPosePairVertices,
  matrixToAxisAngle,
  type GLBTreeData,
  type Vec3,
} from '../src/kinematics/autoDetection';

import { runICPWithOpen3D } from '../src/kinematics/autoDetection/icpOpen3D';
import { computePivotPoint } from '../src/kinematics/autoDetection/jointClassification';
import { computePivotFromMatrix, validatePivot, computeRotationRadius } from '../src/kinematics/autoDetection/pivotComputation';

BABYLON.DracoCompression.DefaultNumWorkers = 0;

const FIXTURES_BASE = 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling';

const TEST_FIXTURE = {
  id: '8X-140-1E1_LH',
  glbPath: path.join(FIXTURES_BASE, 'testing_data/8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00_draco_off.glb'),
  jsonPath: path.join(FIXTURES_BASE, 'testing_data/8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00_tree.json'),
};

const POSE_PAIRS = [
  { unit: 'UNIT_112', retractedIndex: 157, extendedIndex: 250 },
];

async function loadGLBFile(glbPath: string): Promise<{ scene: BABYLON.Scene; engine: BABYLON.NullEngine }> {
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);

  scene.skipPointerMovePicking = true;
  scene.skipPointerDownPicking = true;
  scene.skipPointerUpPicking = true;
  scene.skipFrustumClipping = true;
  scene.blockMaterialDirtyMechanism = true;

  const fileBuffer = fs.readFileSync(glbPath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );

  await BABYLON.SceneLoader.ImportMeshAsync('', '', new Uint8Array(arrayBuffer), scene, undefined, '.glb');

  scene.materials.forEach(material => {
    material.freeze();
    material.doNotSerialize = true;
  });

  return { scene, engine };
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  PIVOT COMPUTATION COMPARISON');
  console.log('  Matrix Method vs Bisector Method');
  console.log('══════════════════════════════════════════════════════════\n');

  const treeData: GLBTreeData = JSON.parse(fs.readFileSync(TEST_FIXTURE.jsonPath, 'utf-8'));
  const { scene, engine } = await loadGLBFile(TEST_FIXTURE.glbPath);

  console.log(`Testing on ${POSE_PAIRS.length} pose pair(s)...\n`);

  for (const pair of POSE_PAIRS) {
    console.log(`\n      ════════════════════════════════════════════════════════`);
    console.log(`      ${pair.unit}`);
    console.log(`      ════════════════════════════════════════════════════════`);

    // Extract vertices
    const { poseA, poseB } = extractPosePairVertices(
      scene,
      treeData,
      pair.retractedIndex,
      pair.extendedIndex,
      { subsampleRatio: 1.0 }
    );

    console.log(`        → Vertices: ${poseA.length / 3} (retracted), ${poseB.length / 3} (extended)\n`);

    // Run Open3D ICP
    const icpResult = await runICPWithOpen3D(poseA, poseB, {
      maxCorrespondenceDistance: 0.100,
      maxIterations: 200,
      rmse_threshold: 0.001
    });

    const axisAngle = matrixToAxisAngle(icpResult.rotation);
    const angleDeg = (axisAngle.angle * 180) / Math.PI;

    console.log(`        ICP Results:`);
    console.log(`          Rotation: ${angleDeg.toFixed(3)}° around [${axisAngle.axis.map(x => x.toFixed(3)).join(', ')}]`);
    console.log(`          RMS Error: ${(icpResult.rmsError * 1000).toFixed(4)}mm\n`);

    // Convert Float32Arrays to Vec3 arrays for pivot computation
    const closedPoints: Vec3[] = [];
    const sampleCount = Math.min(100, poseA.length / 3);
    const step = Math.floor((poseA.length / 3) / sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const idx = i * step * 3;
      closedPoints.push([poseA[idx], poseA[idx + 1], poseA[idx + 2]]);
    }

    // Apply ICP transformation to get the "after" points
    const transformedPoints: Vec3[] = [];
    for (const p of closedPoints) {
      const rotated: Vec3 = [
        icpResult.rotation[0][0] * p[0] + icpResult.rotation[0][1] * p[1] + icpResult.rotation[0][2] * p[2],
        icpResult.rotation[1][0] * p[0] + icpResult.rotation[1][1] * p[1] + icpResult.rotation[1][2] * p[2],
        icpResult.rotation[2][0] * p[0] + icpResult.rotation[2][1] * p[1] + icpResult.rotation[2][2] * p[2],
      ];
      transformedPoints.push([
        rotated[0] + icpResult.translation[0],
        rotated[1] + icpResult.translation[1],
        rotated[2] + icpResult.translation[2],
      ]);
    }

    console.log(`        ─────────────────────────────────────────────────────────`);
    console.log(`        METHOD 1: Circle-Fitting Method (ICP Transform + Circle Center)\n`);

    const pivotMatrix = computePivotFromMatrix(
      closedPoints,
      icpResult.rotation,
      icpResult.translation,
      axisAngle.axis
    );

    console.log(`          Pivot: [${pivotMatrix.map(v => v.toFixed(6)).join(', ')}] meters`);

    const rmsMatrix = validatePivot(closedPoints, transformedPoints, icpResult.rotation, pivotMatrix);
    console.log(`          Validation RMS: ${(rmsMatrix * 1000).toFixed(4)}mm`);

    // Compute rotation radius for a sample point
    const samplePoint = closedPoints[0];
    const radius = computeRotationRadius(samplePoint, pivotMatrix, axisAngle.axis);
    console.log(`          Sample point radius: ${(radius * 1000).toFixed(2)}mm\n`);

    console.log(`        ─────────────────────────────────────────────────────────`);
    console.log(`        METHOD 2: Perpendicular Bisector Method\n`);

    const pivotBisector = computePivotPoint(
      closedPoints,
      transformedPoints,
      axisAngle.axis,
      axisAngle.angle
    );

    console.log(`          Pivot: [${pivotBisector.map(v => v.toFixed(6)).join(', ')}] meters`);

    const rmsBisector = validatePivot(closedPoints, transformedPoints, icpResult.rotation, pivotBisector);
    console.log(`          Validation RMS: ${(rmsBisector * 1000).toFixed(4)}mm`);

    const radiusBisector = computeRotationRadius(samplePoint, pivotBisector, axisAngle.axis);
    console.log(`          Sample point radius: ${(radiusBisector * 1000).toFixed(2)}mm\n`);

    console.log(`        ─────────────────────────────────────────────────────────`);
    console.log(`        COMPARISON:\n`);

    const pivotDiff = Math.sqrt(
      Math.pow(pivotMatrix[0] - pivotBisector[0], 2) +
      Math.pow(pivotMatrix[1] - pivotBisector[1], 2) +
      Math.pow(pivotMatrix[2] - pivotBisector[2], 2)
    );

    console.log(`          Pivot position difference: ${(pivotDiff * 1000).toFixed(4)}mm`);
    console.log(`          RMS improvement: ${((rmsBisector - rmsMatrix) * 1000).toFixed(4)}mm`);

    if (rmsMatrix < rmsBisector) {
      console.log(`          ✓ Matrix method is MORE ACCURATE`);
    } else if (rmsBisector < rmsMatrix) {
      console.log(`          ✓ Bisector method is MORE ACCURATE`);
    } else {
      console.log(`          ≈ Both methods have equal accuracy`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════\n');

  scene.dispose();
  engine.dispose();
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
