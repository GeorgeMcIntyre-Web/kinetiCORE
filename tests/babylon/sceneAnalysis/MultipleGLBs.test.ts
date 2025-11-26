import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { StructureBasedToolAnalyzer } from '../../../src/babylon/sceneAnalysis/StructureBasedToolAnalyzer';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import '@babylonjs/loaders/glTF';

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

interface TestGLB {
  name: string;
  path: string;
  expectedUnits?: number;
  expectedJoints?: number;
  unitsWithJoints?: number;
}

const testFiles: TestGLB[] = [
  {
    name: '8X-140_GEO (Original)',
    path: path.resolve(
      process.cwd(),
      '..',
      'kinetiCORE_data',
      'Tooling',
      'testing_data',
      '8X-140_GEO',
      '016ZF_20142435_140_CI00.glb'
    ),
    expectedUnits: 9,
    expectedJoints: 6,
    unitsWithJoints: 4,
  },
  {
    name: '8X-140-1E1_LH',
    path: path.resolve(
      process.cwd(),
      '..',
      'kinetiCORE_data',
      'Tooling',
      'testing_data',
      '8X-140-1E1_LH',
      '016ZF_20142435_140_1E1_CI00.glb'
    ),
  },
  {
    name: '8X-140-2E1_RH',
    path: path.resolve(
      process.cwd(),
      '..',
      'kinetiCORE_data',
      'Tooling',
      'testing_data',
      '8X-140-2E1_RH',
      '016ZF_20142435_140_2E1_CI00.glb'
    ),
  },
  {
    name: '016ZF_20142435_130',
    path: path.resolve(
      process.cwd(),
      '..',
      'kinetiCORE_data',
      'Tooling',
      'testing_data',
      '016ZF_20142435_130',
      '016ZF_20142435_130.glb'
    ),
  },
];

describe('StructureBasedToolAnalyzer - Multiple GLB Files', () => {
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

  testFiles.forEach((testFile) => {
    it(`should analyze ${testFile.name} without hanging`, async () => {
      // Check if file exists
      if (!existsSync(testFile.path)) {
        console.warn(`[Test] GLB file not found: ${testFile.path}`);
        console.warn(`[Test] Skipping test for ${testFile.name}`);
        return;
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log(`[Test] Analyzing: ${testFile.name}`);
      console.log(`[Test] Path: ${testFile.path}`);
      console.log('='.repeat(80));

      // Suppress console warnings during test
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;
      console.warn = () => {};
      console.error = () => {};

      try {
        // Load GLB file
        console.log(`[Test] Loading GLB file...`);
        const glbBuffer = readFileSync(testFile.path);
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
        let rootNode = scene.rootNodes.find(n => n.name.includes('016ZF') || n.name.includes('CI00')) ||
                       scene.rootNodes[0];

        if (!rootNode) {
          throw new Error('No root node found');
        }

        console.log(`[Test] Root node: ${rootNode.name || rootNode.id}`);

        // Create analyzer
        const analyzer = new StructureBasedToolAnalyzer();

        // Run analysis with verbose logging
        const startTime = Date.now();
        const toolGraph = await analyzer.analyze(scene, {
          minUnitCount: 2,
          maxDepth: 10,
          minVolume: 0.0001,
          classifyFixedMoving: true,
          detectJointsWithICP: true,
          icpOptions: {
            maxICPError: 0.15,
            minPoints: 20,
            maxSamplePoints: 500,
            sampleStride: 5,
            minTranslation: 0.01,
            minRotation: 1.0,
            maxTranslation: 2.0,
          },
          verbose: false, // Disable verbose to reduce output
        }, rootNode);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`\n[Test] Analysis complete in ${duration}s`);
        console.log(`[Test] Found ${toolGraph.units.length} units`);

        // Verify results
        const unitsWithJoints = toolGraph.units.filter(u => !u.isFixed);
        const unitsWithoutJoints = toolGraph.units.filter(u => u.isFixed);

        console.log(`[Test] Units with joints (MOVING): ${unitsWithJoints.length}`);
        console.log(`[Test] Units without joints (FIXED): ${unitsWithoutJoints.length}`);

        // Count total joints found
        // Note: This is a simplified count - actual joint pairs may be tracked differently
        console.log(`[Test] Estimated joints: ${unitsWithJoints.length * 1.5} (approximation)`);

        // Log unit details
        console.log(`\n[Test] Unit Details:`);
        for (const unit of toolGraph.units) {
          console.log(
            `  - ${unit.name}: ` +
            `${unit.isFixed ? 'FIXED' : 'MOVING'}, ` +
            `${unit.nodes.length} nodes`
          );
        }

        // Verify expectations if provided
        if (testFile.expectedUnits !== undefined) {
          console.log(`\n[Test] Verifying expectations...`);
          expect(toolGraph.units.length).toBe(testFile.expectedUnits);
          expect(unitsWithJoints.length).toBe(testFile.unitsWithJoints);
          console.log(`[Test] ✅ Expectations met!`);
        }

        // Verify basic sanity checks
        expect(toolGraph.units.length).toBeGreaterThan(0);
        expect(duration).toBeLessThan(60); // Should complete in under 60s

        console.log(`\n[Test] ✅ ${testFile.name} analyzed successfully!`);
        console.log('='.repeat(80));

      } finally {
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
      }
    }, 120000); // 2 minute timeout per file
  });
});
