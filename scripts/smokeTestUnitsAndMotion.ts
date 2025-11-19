/**
 * Smoke Test: Units V2 + Motion Joints
 *
 * Tests runUnitsV2Pipeline on 6 GLB fixtures with state-based detection + motion joints.
 * Creates synthetic kinematic snapshots to simulate open/closed states.
 *
 * Usage:
 *   KINETICORE_DATA_ROOT=C:\Users\georgem\source\repos\kinetiCORE_data npm run smoke:units-motion
 */

// Babylon.js polyfills for Node.js (required for GLB loading)
import xhr2 from 'xhr2';
if (!(globalThis as any).XMLHttpRequest) {
  (globalThis as any).XMLHttpRequest = xhr2;
}

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (!(globalThis as any).require) {
  (globalThis as any).require = require;
}

// Draco decoder setup
import path from 'node:path';
const dracoAssetDir = path.resolve(
  process.cwd(),
  'node_modules',
  '@babylonjs',
  'core',
  'assets',
  'Draco'
);
if (!(globalThis as any).__dirname) {
  (globalThis as any).__dirname = dracoAssetDir;
}
if (!(globalThis as any).__filename) {
  (globalThis as any).__filename = path.join(dracoAssetDir, 'draco_wasm_wrapper_gltf.js');
}

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import * as fs from 'node:fs';
import { buildToolingStructureFromScene, buildGeometryIndex } from '../src/domain/tooling/babylonAdapter';
import { runUnitsV2Pipeline } from '../src/domain/tooling/unitsV2Pipeline';
import type { KinematicSnapshot } from '../src/domain/tooling/stateBasedUnitDetection';

// Fixture definitions
interface Fixture {
  name: string;
  relPath: string;
}

const FIXTURES: Fixture[] = [
  {
    name: '8X-140_GEO CI00',
    relPath: 'Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_CI00.glb',
  },
  {
    name: '8X-140_1E1_LH',
    relPath: 'Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_1E1_LH.glb',
  },
  {
    name: '8X-140_1E1_CI00',
    relPath: 'Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_1E1_CI00.glb',
  },
  {
    name: '016ZF_110',
    relPath: 'Tooling/testing_data/016ZF/016ZF_110.glb',
  },
  {
    name: '016ZF_130',
    relPath: 'Tooling/testing_data/016ZF/016ZF_130.glb',
  },
  {
    name: '9X_110_GEO',
    relPath: 'Tooling/testing_data/9X_110_GEO/9X_110_GEO.glb',
  },
];

interface TestResult {
  fixtureName: string;
  success: boolean;
  error?: string;
  structureUnitsCount?: number;
  stateBasedUnitsCount?: number;
  motionJointsCount?: number;
  revoluteCount?: number;
  prismaticCount?: number;
}

/**
 * Generate synthetic kinematic snapshots by manipulating transforms.
 * Creates 2 states: "closed" (identity) and "open" (random small motions).
 */
function generateSyntheticSnapshots(
  scene: BABYLON.Scene,
  rootNode: BABYLON.TransformNode
): KinematicSnapshot[] {
  const allNodes: BABYLON.TransformNode[] = [];

  // Guard: root must exist
  if (!rootNode) {
    return [];
  }

  // Collect all transform nodes
  const traverse = (node: BABYLON.Node) => {
    if (node instanceof BABYLON.TransformNode) {
      allNodes.push(node);
    }
    const children = node.getChildren();
    for (const child of children) {
      traverse(child);
    }
  };

  traverse(rootNode);

  // Guard: must have nodes
  if (allNodes.length === 0) {
    return [];
  }

  // Snapshot 1: Closed state (identity)
  scene.freezeActiveMeshes();
  const closedMatrices = new Map<string, BABYLON.Matrix>();

  for (const node of allNodes) {
    node.computeWorldMatrix(true);
    closedMatrices.set(node.name, node.getWorldMatrix().clone());
  }

  const snapshot1: KinematicSnapshot = {
    stateId: 'closed',
    nodeWorldMatrices: closedMatrices,
  };

  // Snapshot 2: Open state (apply random small motions to simulate opening)
  const openMatrices = new Map<string, BABYLON.Matrix>();

  for (const node of allNodes) {
    // Skip root node (keep it static)
    if (node === rootNode) {
      openMatrices.set(node.name, node.getWorldMatrix().clone());
      continue;
    }

    // Apply small random motion (10% probability)
    const shouldMove = Math.random() < 0.1;
    if (!shouldMove) {
      openMatrices.set(node.name, node.getWorldMatrix().clone());
      continue;
    }

    // Random motion: either translation or rotation
    const isTranslation = Math.random() < 0.5;

    if (isTranslation) {
      // Small translation (0-0.1 units)
      const dx = (Math.random() - 0.5) * 0.1;
      const dy = (Math.random() - 0.5) * 0.1;
      const dz = (Math.random() - 0.5) * 0.1;
      node.position.addInPlace(new BABYLON.Vector3(dx, dy, dz));
    }

    if (!isTranslation) {
      // Small rotation (0-30 degrees around random axis)
      const axis = new BABYLON.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      const angle = (Math.random() * 30 * Math.PI) / 180;
      node.rotateAround(node.position, axis, angle);
    }

    node.computeWorldMatrix(true);
    openMatrices.set(node.name, node.getWorldMatrix().clone());
  }

  const snapshot2: KinematicSnapshot = {
    stateId: 'open',
    nodeWorldMatrices: openMatrices,
  };

  return [snapshot1, snapshot2];
}

/**
 * Test a single GLB fixture.
 */
async function testFixture(
  glbPath: string,
  fixtureName: string
): Promise<TestResult> {
  const result: TestResult = {
    fixtureName,
    success: false,
  };

  // Guard: file must exist
  if (!fs.existsSync(glbPath)) {
    result.error = `File not found: ${glbPath}`;
    return result;
  }

  let engine: BABYLON.NullEngine | null = null;
  let scene: BABYLON.Scene | null = null;

  try {
    // Create headless Babylon scene
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);

    // Load GLB
    const glbBuffer = fs.readFileSync(glbPath);
    const importResult = await BABYLON.SceneLoader.ImportMeshAsync(
      undefined,
      '',
      glbBuffer,
      scene,
      undefined,
      '.glb'
    );

    // Guard: must have meshes
    if (importResult.meshes.length === 0) {
      result.error = 'No meshes found in GLB';
      return result;
    }

    // Find root nodes (same pattern as printToolingPointCloudTree.ts)
    const rootNodes: BABYLON.TransformNode[] = [];
    const processedNodes = new Set<string>();

    for (const mesh of importResult.meshes) {
      let node: BABYLON.Node | null = mesh;

      // Walk up to find root
      while (node && node.parent) {
        node = node.parent;
      }

      if (node && node instanceof BABYLON.TransformNode) {
        const nodeId = String(node.uniqueId);
        if (!processedNodes.has(nodeId)) {
          rootNodes.push(node);
          processedNodes.add(nodeId);
        }
      }
    }

    // If no root nodes found, use scene root nodes
    if (rootNodes.length === 0 && scene.rootNodes.length > 0) {
      const transformNodes = scene.rootNodes.filter(
        (n) => n instanceof BABYLON.TransformNode
      ) as BABYLON.TransformNode[];
      rootNodes.push(...transformNodes);
    }

    // Guard: must have at least one root node
    if (rootNodes.length === 0) {
      result.error = 'No root nodes found';
      return result;
    }

    const rootNode = rootNodes[0];

    // Build domain structures
    const structure = buildToolingStructureFromScene(scene, rootNode);
    const geometryIndex = await buildGeometryIndex(structure, scene, {
      stride: 10,
      maxPointsPerNode: 5000,
      useWorldSpace: true,
    });

    // Generate synthetic snapshots
    const snapshots = generateSyntheticSnapshots(scene, rootNode);

    // Guard: must have snapshots
    if (snapshots.length < 2) {
      result.error = 'Failed to generate snapshots';
      return result;
    }

    // Run pipeline with motion joints
    const pipelineResult = runUnitsV2Pipeline(structure, geometryIndex, {
      includeJointPairs: true,
      snapshots,
      includeDebug: true,
      includeMotionJoints: true,
      stateBasedDetection: { minMovingGroupPoints: 20 },
      motionBuildOptions: { minAngularMotionDeg: 1.5, minLinearMotion: 0.5 },
    });

    // Extract results
    result.structureUnitsCount = pipelineResult.units.length;
    result.stateBasedUnitsCount = pipelineResult.stateBasedUnits?.units.length ?? 0;
    result.motionJointsCount = pipelineResult.motionJoints?.length ?? 0;

    // Count motion types
    const motionJoints = pipelineResult.motionJoints ?? [];
    result.revoluteCount = motionJoints.filter((j) => j.motionType === 'revolute').length;
    result.prismaticCount = motionJoints.filter((j) => j.motionType === 'prismatic').length;

    result.success = true;

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    // Cleanup
    if (scene) {
      scene.dispose();
    }
    if (engine) {
      engine.dispose();
    }
  }
}

/**
 * Main smoke test runner.
 */
async function main() {
  console.log('=== Units V2 + Motion Joints Smoke Test ===\n');

  // Get data root from environment
  const dataRoot = process.env.KINETICORE_DATA_ROOT;

  // Guard: data root must be set
  if (!dataRoot) {
    console.error('ERROR: KINETICORE_DATA_ROOT environment variable not set');
    console.error('Usage: KINETICORE_DATA_ROOT=/path/to/data npm run smoke:units-motion');
    process.exit(1);
  }

  // Guard: data root must exist
  if (!fs.existsSync(dataRoot)) {
    console.error(`ERROR: Data root not found: ${dataRoot}`);
    process.exit(1);
  }

  console.log(`Data root: ${dataRoot}\n`);

  const results: TestResult[] = [];

  // Test each fixture
  for (const fixture of FIXTURES) {
    const glbPath = path.join(dataRoot, fixture.relPath);
    console.log(`Testing: ${fixture.name}`);
    console.log(`  Path: ${glbPath}`);

    const result = await testFixture(glbPath, fixture.name);

    results.push(result);

    if (result.success) {
      console.log(`  ✓ Success`);
      console.log(`    Structure units: ${result.structureUnitsCount}`);
      console.log(`    State-based units: ${result.stateBasedUnitsCount}`);
      console.log(`    Motion joints: ${result.motionJointsCount}`);
      console.log(`      - Revolute: ${result.revoluteCount}`);
      console.log(`      - Prismatic: ${result.prismaticCount}`);
    }

    if (!result.success) {
      console.log(`  ✗ Failed: ${result.error}`);
    }

    console.log('');
  }

  // Summary
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log('=== Summary ===');
  console.log(`Total fixtures: ${FIXTURES.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  // Exit with error if any failed
  if (failCount > 0) {
    console.log('\n⚠ Some tests failed');
    process.exit(1);
  }

  console.log('\n✓ All tests passed');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
