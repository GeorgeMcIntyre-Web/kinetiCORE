/**
 * Test Open3D ICP on the 8X-140-1E1_LH fixture
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import * as fs from 'fs';
import * as path from 'path';

import {
  extractPosePairVertices,
  matrixToAxisAngle,
  classifyJoint,
  type GLBTreeData,
} from '../src/kinematics/autoDetection';

import { runICPWithOpen3D } from '../src/kinematics/autoDetection/icpOpen3D';

BABYLON.DracoCompression.DefaultNumWorkers = 0;

const FIXTURES_BASE = 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling';

const TEST_FIXTURE = {
  id: '8X-140-1E1_LH',
  glbPath: path.join(FIXTURES_BASE, 'testing_data/8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00_draco_off.glb'),
  jsonPath: path.join(FIXTURES_BASE, 'testing_data/8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00_tree.json'),
};

const POSE_PAIRS = [
  { unit: 'UNIT_112', retractedIndex: 157, extendedIndex: 250 },
  { unit: 'UNIT_110', retractedIndex: 270, extendedIndex: 363 },
  { unit: 'UNIT_102', retractedIndex: 626, extendedIndex: 671 },
  { unit: 'UNIT_116', retractedIndex: 1437, extendedIndex: 1527 },
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

  await BABYLON.SceneLoader.ImportMeshAsync(
    '',
    '',
    new Uint8Array(arrayBuffer),
    scene,
    undefined,
    '.glb'
  );

  scene.materials.forEach(material => {
    material.freeze();
    material.doNotSerialize = true;
  });

  return { scene, engine };
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  OPEN3D ICP TEST: ${TEST_FIXTURE.id}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // Load JSON
  console.log('[1/3] Loading JSON tree data...');
  const treeData: GLBTreeData = JSON.parse(fs.readFileSync(TEST_FIXTURE.jsonPath, 'utf-8'));
  console.log(`      ✓ Loaded: ${treeData.nodes.length} nodes\n`);

  // Load GLB
  console.log('[2/3] Loading GLB scene...');
  const { scene, engine } = await loadGLBFile(TEST_FIXTURE.glbPath);
  console.log(`      ✓ Scene loaded: ${scene.meshes.length} meshes\n`);

  console.log('[3/3] Running Open3D ICP on pose pairs...\n');

  for (let i = 0; i < POSE_PAIRS.length; i++) {
    const pair = POSE_PAIRS[i];
    const retractedNode = treeData.nodes[pair.retractedIndex];
    const extendedNode = treeData.nodes[pair.extendedIndex];

    console.log(`\n      ════════════════════════════════════════════════════════`);
    console.log(`      PAIR ${i + 1}: ${pair.unit}`);
    console.log(`      "${retractedNode.name}" ↔ "${extendedNode.name}"`);
    console.log(`      ════════════════════════════════════════════════════════`);

    try {
      // Extract vertices
      const { poseA, poseB } = extractPosePairVertices(
        scene,
        treeData,
        pair.retractedIndex,
        pair.extendedIndex,
        { subsampleRatio: 1.0 }
      );

      if (poseA.length === 0) {
        console.log(`        ⚠️  Skipping: No vertices extracted.`);
        continue;
      }

      console.log(`        → Vertices: ${poseA.length / 3} (retracted), ${poseB.length / 3} (extended)`);

      // Run Open3D ICP
      console.log(`        → Running Open3D ICP...`);
      const icpResult = await runICPWithOpen3D(poseA, poseB, {
        maxCorrespondenceDistance: 0.100,  // 100mm
        maxIterations: 200,
        rmse_threshold: 0.001  // 1mm
      });

      console.log(`        → 📊 RMS Error: ${icpResult.rmsError.toFixed(8)} meters (${(icpResult.rmsError * 1000).toFixed(5)} mm)`);

      const axisAngle = matrixToAxisAngle(icpResult.rotation);
      const angleDeg = (axisAngle.angle * 180) / Math.PI;

      console.log(`        → Rotation: ${angleDeg.toFixed(3)}° around [${axisAngle.axis.map(x => x.toFixed(3)).join(', ')}]`);

      const joint = classifyJoint(icpResult);
      console.log(`        → Joint Type: ${joint.type.toUpperCase()}`);

      if (Math.abs(angleDeg - 90) < 5) {
        console.log(`        ✓ Angle is close to 90° (within 5°)`);
      } else {
        console.log(`        ⚠️  Angle differs from expected 90° by ${Math.abs(angleDeg - 90).toFixed(1)}°`);
      }

      if (icpResult.rmsError < 0.001) {
        console.log(`        ✓ RMS error is EXCELLENT (< 1mm)`);
      } else {
        console.log(`        ⚠️  RMS error is HIGH: ${(icpResult.rmsError * 1000).toFixed(3)}mm`);
      }

    } catch (error) {
      console.log(`        ❌ Error: ${error}`);
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
