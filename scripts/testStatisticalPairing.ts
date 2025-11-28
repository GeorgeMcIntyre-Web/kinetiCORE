/**
 * Test Statistical Pairing Engine on Real GLB Files
 *
 * This script loads real fixture GLB files and tests the statistical pairing engine
 * to show unit pairs and node pairs in a readable format.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { GLTFFileLoader } from '@babylonjs/loaders/glTF';
import * as BABYLON from '@babylonjs/core';
import type {
  Scene as StatScene,
  SceneNode,
  UnitPair,
  NodePair,
} from '../src/kinematics/statisticalPairing/StatisticalPairingEngine.js';
import {
  collectSubtree,
  findUnitCandidates,
  selectUnits,
  pairUnits,
  getNodePairsForUnit,
} from '../src/kinematics/statisticalPairing/StatisticalPairingEngine.js';

// Register GLTF loader
BABYLON.SceneLoader.RegisterPlugin(new GLTFFileLoader());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fixture paths (relative to project root)
const FIXTURES_DIR = path.join(__dirname, '..', 'public', 'assets', 'fixtures');

const FIXTURES = [
  { name: '8X140', open: '8X140-open.glb', closed: '8X140-closed.glb' },
  { name: 'U112', open: 'U112-open.glb', closed: 'U112-closed.glb' },
  { name: '5X110', open: '5X110-open.glb', closed: '5X110-closed.glb' },
];

/**
 * Count total vertices in a mesh hierarchy
 */
function countVertices(mesh: BABYLON.AbstractMesh): number {
  let total = 0;

  if (mesh instanceof BABYLON.Mesh && mesh.getTotalVertices) {
    total += mesh.getTotalVertices();
  }

  for (const child of mesh.getChildMeshes()) {
    total += countVertices(child);
  }

  return total;
}

/**
 * Build Statistical Scene from Babylon mesh hierarchy
 */
function buildStatScene(rootMesh: BABYLON.AbstractMesh): StatScene {
  const nodes = new Map<string, SceneNode>();

  const visit = (mesh: BABYLON.AbstractMesh, depth: number) => {
    const id = mesh.uniqueId.toString();
    const parentId = mesh.parent ? mesh.parent.uniqueId.toString() : undefined;
    const children = mesh.getChildMeshes().map(c => c.uniqueId.toString());
    const totalPointCount = countVertices(mesh);

    nodes.set(id, {
      id,
      parentId,
      children,
      totalPointCount,
      depth,
    });

    for (const child of mesh.getChildMeshes()) {
      visit(child, depth + 1);
    }
  };

  visit(rootMesh, 0);

  return {
    nodes,
    rootId: rootMesh.uniqueId.toString(),
  };
}

/**
 * Load GLB file and return root mesh
 */
async function loadGLB(filePath: string, scene: BABYLON.Scene): Promise<BABYLON.AbstractMesh> {
  return new Promise((resolve, reject) => {
    BABYLON.SceneLoader.ImportMesh(
      '',
      path.dirname(filePath) + '/',
      path.basename(filePath),
      scene,
      (meshes) => {
        if (meshes.length === 0) {
          reject(new Error('No meshes loaded'));
          return;
        }

        // Find root (mesh with no parent)
        const root = meshes.find(m => m.parent === null);
        if (!root) {
          reject(new Error('No root mesh found'));
          return;
        }

        resolve(root);
      },
      undefined,
      (scene, message, exception) => {
        reject(new Error(`Failed to load: ${message}`));
      }
    );
  });
}

/**
 * Get mesh name by ID from scene
 */
function getMeshName(scene: StatScene, nodeId: string, babylonScene: BABYLON.Scene): string {
  const uid = parseInt(nodeId, 10);
  const mesh = babylonScene.getMeshByUniqueId(uid);
  return mesh ? mesh.name : `Node_${nodeId}`;
}

/**
 * Format point count with thousands separator
 */
function formatPoints(count: number): string {
  return count.toLocaleString('en-US');
}

/**
 * Print unit pairs in readable format
 */
function printUnitPairs(
  fixture: string,
  unitPairs: UnitPair[],
  openScene: StatScene,
  closedScene: StatScene,
  openBabylon: BABYLON.Scene,
  closedBabylon: BABYLON.Scene
) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`FIXTURE: ${fixture}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`\nFound ${unitPairs.length} unit pair(s):\n`);

  unitPairs.forEach((pair, index) => {
    const openNode = openScene.nodes.get(pair.openUnitId);
    const closedNode = closedScene.nodes.get(pair.closedUnitId);

    const openName = getMeshName(openScene, pair.openUnitId, openBabylon);
    const closedName = getMeshName(closedScene, pair.closedUnitId, closedBabylon);

    const openPoints = openNode?.totalPointCount ?? 0;
    const closedPoints = closedNode?.totalPointCount ?? 0;

    console.log(`Unit Pair #${index + 1}:`);
    console.log(`  Open:   ${openName.padEnd(40)} (${formatPoints(openPoints)} points)`);
    console.log(`  Closed: ${closedName.padEnd(40)} (${formatPoints(closedPoints)} points)`);
    console.log(`  Point difference: ${Math.abs(openPoints - closedPoints)} points\n`);
  });
}

/**
 * Print node pairs for a unit pair
 */
function printNodePairs(
  unitIndex: number,
  nodePairs: NodePair[],
  openScene: StatScene,
  closedScene: StatScene,
  openBabylon: BABYLON.Scene,
  closedBabylon: BABYLON.Scene
) {
  console.log(`\n  Node pairs for Unit #${unitIndex + 1} (${nodePairs.length} pairs):`);
  console.log(`  ${'-'.repeat(76)}`);

  if (nodePairs.length === 0) {
    console.log(`  (No node pairs found)\n`);
    return;
  }

  nodePairs.forEach((pair, idx) => {
    const openNode = openScene.nodes.get(pair.openNodeId);
    const closedNode = closedScene.nodes.get(pair.closedNodeId);

    const openName = getMeshName(openScene, pair.openNodeId, openBabylon);
    const closedName = getMeshName(closedScene, pair.closedNodeId, closedBabylon);

    const openPoints = openNode?.totalPointCount ?? 0;
    const closedPoints = closedNode?.totalPointCount ?? 0;

    console.log(`  ${(idx + 1).toString().padStart(2)}. Open:   ${openName.padEnd(35)} (${formatPoints(openPoints).padStart(8)} pts)`);
    console.log(`      Closed: ${closedName.padEnd(35)} (${formatPoints(closedPoints).padStart(8)} pts)`);
  });

  console.log();
}

/**
 * Test statistical pairing on a single fixture
 */
async function testFixture(
  fixtureName: string,
  openPath: string,
  closedPath: string,
  engine: BABYLON.Engine
): Promise<void> {
  // Create scenes
  const openBabylonScene = new BABYLON.Scene(engine);
  const closedBabylonScene = new BABYLON.Scene(engine);

  try {
    // Load GLB files
    console.log(`\nLoading ${fixtureName}...`);
    const openRoot = await loadGLB(openPath, openBabylonScene);
    const closedRoot = await loadGLB(closedPath, closedBabylonScene);

    // Build statistical scenes
    const openScene = buildStatScene(openRoot);
    const closedScene = buildStatScene(closedRoot);

    // Get fixture totals
    const openTotal = openScene.nodes.get(openScene.rootId)?.totalPointCount ?? 0;
    const closedTotal = closedScene.nodes.get(closedScene.rootId)?.totalPointCount ?? 0;

    console.log(`Open fixture:   ${formatPoints(openTotal)} total points`);
    console.log(`Closed fixture: ${formatPoints(closedTotal)} total points`);

    // Find units
    const openFlat = collectSubtree(openScene, openScene.rootId);
    const closedFlat = collectSubtree(closedScene, closedScene.rootId);

    const openCandidates = findUnitCandidates(openFlat, openTotal);
    const closedCandidates = findUnitCandidates(closedFlat, closedTotal);

    const openUnits = selectUnits(openCandidates, openScene);
    const closedUnits = selectUnits(closedCandidates, closedScene);

    console.log(`\nUnit Detection:`);
    console.log(`  Open candidates:   ${openCandidates.length} → ${openUnits.length} selected`);
    console.log(`  Closed candidates: ${closedCandidates.length} → ${closedUnits.length} selected`);

    // Pair units
    const unitPairs = pairUnits(openScene, closedScene, openUnits, closedUnits);

    // Print results
    printUnitPairs(fixtureName, unitPairs, openScene, closedScene, openBabylonScene, closedBabylonScene);

    // Get node pairs for each unit pair
    unitPairs.forEach((unitPair, index) => {
      const nodePairs = getNodePairsForUnit(openScene, closedScene, unitPair);
      printNodePairs(index, nodePairs, openScene, closedScene, openBabylonScene, closedBabylonScene);
    });

  } finally {
    // Cleanup
    openBabylonScene.dispose();
    closedBabylonScene.dispose();
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('Statistical Pairing Engine - Real Fixture Test\n');
  console.log('Testing on production GLB files from public/assets/fixtures/\n');

  // Create headless engine
  const engine = new BABYLON.NullEngine();

  try {
    for (const fixture of FIXTURES) {
      const openPath = path.join(FIXTURES_DIR, fixture.open);
      const closedPath = path.join(FIXTURES_DIR, fixture.closed);

      // Check if files exist
      if (!fs.existsSync(openPath)) {
        console.log(`\n⚠️  SKIPPING ${fixture.name}: ${fixture.open} not found`);
        continue;
      }
      if (!fs.existsSync(closedPath)) {
        console.log(`\n⚠️  SKIPPING ${fixture.name}: ${fixture.closed} not found`);
        continue;
      }

      await testFixture(fixture.name, openPath, closedPath, engine);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('Test Complete');
    console.log(`${'='.repeat(80)}\n`);

  } finally {
    engine.dispose();
  }
}

// Run tests
main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
