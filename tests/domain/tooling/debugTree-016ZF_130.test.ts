/**
 * Generate tooling point cloud trees for REAL fixture: 016ZF_20142435_130
 *
 * Run this test to generate TWO plain-text trees:
 *   npm test -- tests/domain/tooling/debugTree-016ZF_130.test.ts
 *
 * OUTPUT:
 * 1. FULL TREE - all nodes
 * 2. FILTERED TREE - same tree but with small nodes removed (minPoints=500)
 *
 * Copy the output from console and paste into ChatGPT for analysis.
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import '@babylonjs/loaders/glTF';
import { StructureBasedToolAnalyzer } from '../../../src/babylon/sceneAnalysis/StructureBasedToolAnalyzer';
import { formatToolingPointTree } from '../../../src/domain/tooling/debugTree';
import type { ToolingStructure, ToolingNodeGeometry } from '../../../src/domain/tooling/types';

// Node.js shims for Babylon.js Draco decoder
const nodeRequire = createRequire(import.meta.url);
if (!(globalThis as any).require) {
  (globalThis as any).require = nodeRequire;
}
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

const GLB_PATH = path.resolve(
  process.cwd(),
  '..',
  'kinetiCORE_data',
  'Tooling',
  'testing_data',
  '016ZF_20142435_130',
  '016ZF_20142435_130.glb'
);

describe('Generate Tooling Tree - 016ZF_20142435_130', () => {
  let engine: BABYLON.NullEngine;
  let scene: BABYLON.Scene;

  beforeEach(() => {
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
  });

  afterEach(() => {
    if (scene) {
      scene.dispose();
    }
    if (engine) {
      engine.dispose();
    }
  });

  it('should generate FULL and FILTERED trees for 016ZF_20142435_130', async () => {
    // Check if file exists
    if (!existsSync(GLB_PATH)) {
      console.warn(`[Test] GLB file not found: ${GLB_PATH}`);
      console.warn(`[Test] Skipping test`);
      return;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Test] Loading fixture: 016ZF_20142435_130`);
    console.log(`[Test] Path: ${GLB_PATH}`);
    console.log('='.repeat(80));

    // Load GLB file
    const glbBuffer = readFileSync(GLB_PATH);
    const result = await SceneLoader.ImportMeshAsync(
      undefined,
      '',
      glbBuffer,
      scene,
      undefined,
      '.glb'
    );

    console.log(`[Test] Loaded ${result.meshes.length} meshes`);

    // Find root node
    let rootNode = scene.rootNodes.find(n => n.name.includes('016ZF') || n.name.includes('130')) ||
                   scene.rootNodes[0];

    if (!rootNode) {
      throw new Error('No root node found');
    }

    console.log(`[Test] Root node: ${rootNode.name || rootNode.id}`);

    // Create analyzer and extract structure + geometry
    const analyzer = new StructureBasedToolAnalyzer();

    // We need to access the internal structure and geometry
    // First, run the analysis to build the structure
    console.log(`[Test] Analyzing scene...`);
    await analyzer.analyze(scene, {
      minUnitCount: 2,
      maxDepth: 10,
      minVolume: 0.0001,
      classifyFixedMoving: false,
      detectJointsWithICP: false,
      verbose: false,
    }, rootNode);

    // Access the internal structure and geometry from analyzer
    // @ts-expect-error - accessing private fields for testing
    const structure: ToolingStructure = analyzer.structure;
    // @ts-expect-error - accessing private fields for testing
    const geometryIndex: Map<string, ToolingNodeGeometry> = analyzer.geometryIndex;

    console.log(`[Test] Structure has ${structure.nodes.size} nodes`);
    console.log(`[Test] Geometry index has ${geometryIndex.size} entries`);

    // Generate FULL tree
    console.log(`\n${'='.repeat(80)}`);
    console.log('FULL TREE - ALL NODES');
    console.log('='.repeat(80));
    const fullTree = formatToolingPointTree(structure, geometryIndex);
    console.log(fullTree);

    // Generate FILTERED tree (minPoints=500)
    console.log(`\n${'='.repeat(80)}`);
    console.log('FILTERED TREE - minPoints=500');
    console.log('='.repeat(80));
    const filteredTree = formatToolingPointTree(structure, geometryIndex, {
      minPoints: 500,
    });
    console.log(filteredTree);

    // Write trees to files for easy copy-paste
    const outputDir = path.resolve(process.cwd());
    const fullTreePath = path.join(outputDir, 'tooling-tree-016ZF_130-full.txt');
    const filteredTreePath = path.join(outputDir, 'tooling-tree-016ZF_130-filtered.txt');

    writeFileSync(fullTreePath, fullTree, 'utf-8');
    writeFileSync(filteredTreePath, filteredTree, 'utf-8');

    console.log(`\n${'='.repeat(80)}`);
    console.log('OUTPUT FILES GENERATED');
    console.log('='.repeat(80));
    console.log(`FULL TREE: ${fullTreePath}`);
    console.log(`FILTERED TREE: ${filteredTreePath}`);
    console.log('='.repeat(80));
  }, 120000); // 2 minute timeout
});
