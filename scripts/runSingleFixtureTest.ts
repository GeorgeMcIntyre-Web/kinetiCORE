/**
 * Single Fixture Test - FIXED for Node.js with Draco support
 * Tests the 8X-140-1E1_LH fixture
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import * as fs from 'fs';
import * as path from 'path';

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
} from '../src/kinematics/autoDetection';

// [FIX] Disable Draco workers - Node.js cannot spawn browser Blob workers
BABYLON.DracoCompression.DefaultNumWorkers = 0;

const FIXTURES_BASE = 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling';

const TEST_FIXTURE = {
  id: '8X-140-1E1_LH',
  glbPath: path.join(FIXTURES_BASE, 'testing_data/8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00_draco_off.glb'),
  jsonPath: path.join(FIXTURES_BASE, 'testing_data/8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00_tree.json'),
};

async function loadGLBFile(glbPath: string): Promise<{ scene: BABYLON.Scene; engine: BABYLON.NullEngine }> {
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);

  // Optimization settings
  scene.skipPointerMovePicking = true;
  scene.skipPointerDownPicking = true;
  scene.skipPointerUpPicking = true;
  scene.skipFrustumClipping = true;
  scene.blockMaterialDirtyMechanism = true;

  console.log(`      → Loading GLB from disk: ${glbPath}`);

  // Read file directly as binary buffer
  const fileBuffer = fs.readFileSync(glbPath);

  // Create ArrayBuffer from Node.js Buffer
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );

  try {
    // Load directly from ArrayBuffer (bypasses XHR completely)
    await BABYLON.SceneLoader.ImportMeshAsync(
      '',
      '',
      new Uint8Array(arrayBuffer),
      scene,
      undefined,
      '.glb'
    );
  } catch (e) {
    console.error("      ❌ GLB Load Failed:", e);
    throw e;
  }

  // Freeze materials
  scene.materials.forEach(material => {
    material.freeze();
    material.doNotSerialize = true;
  });

  return { scene, engine };
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  SINGLE FIXTURE TEST: ${TEST_FIXTURE.id}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // 1. Load JSON
  console.log('[1/6] Loading JSON tree data...');
  const treeData: GLBTreeData = JSON.parse(fs.readFileSync(TEST_FIXTURE.jsonPath, 'utf-8'));
  console.log(`      ✓ Loaded: ${treeData.nodes.length} nodes\n`);

  // 2. Load GLB
  console.log('[2/6] Loading GLB scene...');
  const { scene, engine } = await loadGLBFile(TEST_FIXTURE.glbPath);
  console.log(`      ✓ Scene loaded: ${scene.meshes.length} meshes\n`);

  // 3. Detect units
  console.log('[3/6] Detecting units...');
  const units = detectUnits(treeData);
  console.log(`      ✓ Found ${units.length} units`);

  // Print unit names
  console.log('\n      UNIT NAMES:');
  units.forEach((unit, idx) => {
    const node = treeData.nodes[unit.nodeIndex];
    console.log(`      ${idx + 1}. ${node.name}`);
  });
  console.log('');

  // 4. Find pose pairs
  console.log('[4/6] Finding pose pairs...');
  let totalPairs = 0;
  const allPairs = new Map();

  for (const unit of units) {
    const unitPairs = findPosePairs(treeData, unit);
    if (unitPairs.length > 0) {
      totalPairs += unitPairs.length;
      allPairs.set(unit.nodeIndex, unitPairs);
    }
  }
  console.log(`      ✓ Total: ${totalPairs} pose pairs\n`);

  // 5. Process pose pairs
  console.log('[5/6] Processing pose pairs (ICP + Classification)...\n');

  let jointsDetected = 0;
  const rmsValues: Array<{pairName: string, rms: number}> = [];

  for (const [unitIndex, unitPairs] of allPairs.entries()) {
    for (const pair of unitPairs) {
      if (!pair.matchingGeometry || pair.matchingGeometry.length === 0) continue;

      const matchA = pair.closedSubtreeIndex;
      const matchB = pair.openSubtreeIndex;
      const nodeA = treeData.nodes[matchA];
      const nodeB = treeData.nodes[matchB];

      console.log(`\n      ════════════════════════════════════════════════════════`);
      console.log(`      TRANSFORMATION PAIR: "${nodeA.name}" ↔ "${nodeB.name}"`);
      console.log(`      ════════════════════════════════════════════════════════`);

      try {
        const { poseA, poseB } = extractPosePairVertices(scene, treeData, matchA, matchB, {
            subsampleRatio: 0.1,
        });

        if (poseA.length === 0) {
            console.log(`        ⚠️  Skipping: No vertices extracted.`);
            continue;
        }

        console.log(`        → Vertices: ${poseA.length / 3} (A), ${poseB.length / 3} (B)`);

        // Run ICP
        const icpResult = runICP(poseA, poseB, {
            maxIterations: 50,
            convergenceThreshold: 1e-6,
            subsampleRatio: 1.0
        });

        // OUTPUT THE RMS VALUE
        console.log(`        → ICP Converged: ${icpResult.converged ? 'YES' : 'NO'}`);
        console.log(`        → 📊 RMS Error: ${icpResult.rmsError.toFixed(6)} meters`);

        rmsValues.push({
          pairName: `${nodeA.name} ↔ ${nodeB.name}`,
          rms: icpResult.rmsError
        });

        if (icpResult.converged) {
             const joint = classifyJoint(icpResult);
             const axisAngle = matrixToAxisAngle(icpResult.rotation);

             if (joint.type === 'revolute') {
                 jointsDetected++;
                 console.log(`        → Type: HINGE`);
                 console.log(`        → Rotation: ${((axisAngle.angle * 180) / Math.PI).toFixed(1)}°`);

                 // Compute pivot
                 const closedPoints: Vec3[] = [];
                 const openPoints: Vec3[] = [];
                 const sampleCount = Math.min(100, poseA.length / 3);
                 for (let i = 0; i < sampleCount; i++) {
                   const idx = i * 3;
                   closedPoints.push([poseA[idx], poseA[idx + 1], poseA[idx + 2]]);
                   openPoints.push([poseB[idx], poseB[idx + 1], poseB[idx + 2]]);
                 }

                 const pivot = computePivotPoint(
                   closedPoints,
                   openPoints,
                   axisAngle.axis,
                   axisAngle.angle
                 );

                 console.log(`        → Pivot: [${pivot.map(x => x.toFixed(3)).join(', ')}]`);
             } else if (joint.type === 'prismatic') {
                 jointsDetected++;
                 console.log(`        → Type: PRISMATIC`);
             } else {
                 console.log(`        → Type: FIXED (no significant motion)`);
             }
        }

      } catch (error) {
        console.log(`        ❌ Error processing pair: ${error}`);
      }
    }
  }

  console.log('\n[6/6] Summary');
  console.log(`      Joints detected: ${jointsDetected}`);
  console.log('\n      RMS VALUES SUMMARY:');
  rmsValues.forEach((entry, idx) => {
    console.log(`      ${idx + 1}. ${entry.pairName}: ${entry.rms.toFixed(6)} meters`);
  });
  console.log('');

  scene.dispose();
  engine.dispose();

  console.log('══════════════════════════════════════════════════════════');
  console.log(jointsDetected > 0 ? '✅ SUCCESS' : '⚠️  NO JOINTS DETECTED');
  console.log('══════════════════════════════════════════════════════════\n');

  process.exit(jointsDetected > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
