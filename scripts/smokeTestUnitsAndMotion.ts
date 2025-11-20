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
import { ToolingKinematicsAdapter, type KinematicsAdapterContext } from '../src/kinematics/toolingKinematicsAdapter';

// --- Types ---

type FixtureExpectations = {
  minUnits?: number;
  maxUnits?: number;
  minMotionJoints?: number;
  maxMotionJoints?: number;
};

type FixtureConfig = {
  id: string;
  relPath: string;
  expectations?: FixtureExpectations;
};

type FixtureResultStatus = 'ok' | 'failed' | 'skipped';

type FixtureSummary = {
  id: string;
  status: FixtureResultStatus;
  reason?: string; // for skipped / failed
  unitsCount?: number;
  motionJointCount?: number;
  chainCount?: number;
  warnings: string[];
};

// --- Configuration ---

const FIXTURES: FixtureConfig[] = [
  {
    id: '016ZF_140_CI00',
    relPath: 'Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_CI00.glb',
    expectations: { minUnits: 2, minMotionJoints: 1 },
  },
  {
    id: '8X_140_1E1_LH',
    relPath: 'Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_1E1_LH.glb',
  },
  {
    id: '8X_140_2E1_RH',
    relPath: 'Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_2E1_CI00.glb',
  },
  {
    id: '016ZF_130',
    relPath: 'Tooling/testing_data/016ZF/016ZF_130.glb',
  },
  {
    id: '016ZF_110',
    relPath: 'Tooling/testing_data/016ZF/016ZF_110.glb',
  },
  {
    id: '2174530000_CM030',
    relPath: 'Tooling/testing_data/2174530000_M00_GJR_RR FLR_CM030_T01/2174530000_M00_GJR_RR FLR_CM030_T01.glb',
  },
];

// --- Helpers ---

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

function checkExpectations(
  summary: Partial<FixtureSummary>,
  expectations?: FixtureExpectations
): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!expectations) {
    return { passed: true, warnings };
  }

  if (
    expectations.minUnits !== undefined &&
    (summary.unitsCount === undefined || summary.unitsCount < expectations.minUnits)
  ) {
    warnings.push(`Expected minUnits >= ${expectations.minUnits}, got ${summary.unitsCount}`);
  }

  if (
    expectations.maxUnits !== undefined &&
    (summary.unitsCount !== undefined && summary.unitsCount > expectations.maxUnits)
  ) {
    warnings.push(`Expected maxUnits <= ${expectations.maxUnits}, got ${summary.unitsCount}`);
  }

  if (
    expectations.minMotionJoints !== undefined &&
    (summary.motionJointCount === undefined || summary.motionJointCount < expectations.minMotionJoints)
  ) {
    warnings.push(`Expected minMotionJoints >= ${expectations.minMotionJoints}, got ${summary.motionJointCount}`);
  }

  if (
    expectations.maxMotionJoints !== undefined &&
    (summary.motionJointCount !== undefined && summary.motionJointCount > expectations.maxMotionJoints)
  ) {
    warnings.push(`Expected maxMotionJoints <= ${expectations.maxMotionJoints}, got ${summary.motionJointCount}`);
  }

  return { passed: warnings.length === 0, warnings };
}

/**
 * Test a single GLB fixture.
 */
async function testFixture(fixture: FixtureConfig): Promise<FixtureSummary> {
  const dataRoot = process.env.KINETICORE_DATA_ROOT;

  // Guard: Env var missing
  if (!dataRoot) {
    return {
      id: fixture.id,
      status: 'skipped',
      reason: 'KINETICORE_DATA_ROOT not set',
      warnings: [],
    };
  }

  const glbPath = path.join(dataRoot, fixture.relPath);

  // Guard: File missing
  if (!fs.existsSync(glbPath)) {
    return {
      id: fixture.id,
      status: 'skipped',
      reason: `File not found: ${glbPath}`,
      warnings: [],
    };
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
      return {
        id: fixture.id,
        status: 'failed',
        reason: 'No meshes found in GLB',
        warnings: [],
      };
    }

    // Find root nodes
    const rootNodes: BABYLON.TransformNode[] = [];
    const processedNodes = new Set<string>();

    for (const mesh of importResult.meshes) {
      let node: BABYLON.Node | null = mesh;
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

    if (rootNodes.length === 0 && scene.rootNodes.length > 0) {
      const transformNodes = scene.rootNodes.filter(
        (n) => n instanceof BABYLON.TransformNode
      ) as BABYLON.TransformNode[];
      rootNodes.push(...transformNodes);
    }

    if (rootNodes.length === 0) {
      return {
        id: fixture.id,
        status: 'failed',
        reason: 'No root nodes found',
        warnings: [],
      };
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

    if (snapshots.length < 2) {
      return {
        id: fixture.id,
        status: 'failed',
        reason: 'Failed to generate snapshots',
        warnings: [],
      };
    }

    // Run pipeline
    const pipelineResult = runUnitsV2Pipeline(structure, geometryIndex, {
      includeJointPairs: true,
      snapshots,
      includeDebug: true,
      includeMotionJoints: true,
      stateBasedDetection: { minMovingGroupPoints: 20 },
      motionBuildOptions: { minAngularMotionDeg: 1.5, minLinearMotion: 0.5 },
    });

    // Build chains via adapter
    const adapterContext: KinematicsAdapterContext = {
      getNodeWorldMatrix: (nodeId: string) => {
        const mesh = scene?.getMeshByUniqueId(parseInt(nodeId));
        if (mesh) {
          mesh.computeWorldMatrix(true);
          return mesh.getWorldMatrix();
        }
        const tn = scene?.transformNodes.find(n => String(n.uniqueId) === nodeId);
        if (tn) {
          tn.computeWorldMatrix(true);
          return tn.getWorldMatrix();
        }
        const byName = scene?.getTransformNodeByName(nodeId) || scene?.getMeshByName(nodeId);
        if (byName) {
          byName.computeWorldMatrix(true);
          return byName.getWorldMatrix();
        }
        return null;
      }
    };

    let chainCount = 0;
    try {
      const chains = ToolingKinematicsAdapter.buildChains(pipelineResult, adapterContext);
      chainCount = chains.length;
    } catch (e) {
      console.warn(`[${fixture.id}] Adapter error: ${e}`);
    }

    const summary: FixtureSummary = {
      id: fixture.id,
      status: 'ok',
      unitsCount: pipelineResult.units.length,
      motionJointCount: pipelineResult.motionJoints?.length ?? 0,
      chainCount,
      warnings: [],
    };

    const check = checkExpectations(summary, fixture.expectations);
    summary.warnings = check.warnings;

    return summary;

  } catch (error) {
    return {
      id: fixture.id,
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
      warnings: [],
    };
  } finally {
    if (scene) scene.dispose();
    if (engine) engine.dispose();
  }
}

/**
 * Main runner.
 */
async function main() {
  console.log('=== Units V2 + Motion Joints Smoke Test ===\n');

  const summaries: FixtureSummary[] = [];

  for (const fixture of FIXTURES) {
    const result = await testFixture(fixture);
    summaries.push(result);

    if (result.status === 'ok') {
      console.log(`[${result.id}] OK`);
      console.log(`  units: ${result.unitsCount}`);
      console.log(`  motion joints: ${result.motionJointCount}`);
      console.log(`  chains: ${result.chainCount}`);
      if (result.warnings.length > 0) {
        console.log('  warnings:');
        for (const w of result.warnings) {
          console.log(`    - ${w}`);
        }
      }
    } else if (result.status === 'skipped') {
      console.log(`[${result.id}] SKIPPED – ${result.reason}`);
    } else {
      console.log(`[${result.id}] FAILED – ${result.reason}`);
    }
    console.log('');
  }

  const okCount = summaries.filter(s => s.status === 'ok').length;
  const failedCount = summaries.filter(s => s.status === 'failed').length;
  const skippedCount = summaries.filter(s => s.status === 'skipped').length;
  const warningCount = summaries.reduce((acc, s) => acc + s.warnings.length, 0);

  console.log('==============================');
  console.log(`Fixtures: ${FIXTURES.length}`);
  console.log(`OK: ${okCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Warnings: ${warningCount}`);
  console.log('==============================');

  if (failedCount > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

void main();
