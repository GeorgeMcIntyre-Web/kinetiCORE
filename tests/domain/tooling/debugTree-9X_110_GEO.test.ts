import { describe, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import '@babylonjs/loaders/glTF';

import { formatToolingPointTree } from '../../../src/domain/tooling/debugTree';
import { buildToolingStructureFromScene, buildGeometryIndex } from '../../../src/domain/tooling/babylonAdapter';

// Node.js shims for Babylon.js Draco decoder in Vitest environment
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

describe('debug tree for 9X_110_GEO', () => {
  it('prints full and filtered trees for 9X_110_GEO', async () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);

    if (!scene) {
      throw new Error('Scene was not created');
    }

    const fixtureGlbPath = path.resolve(process.cwd(), 'test_assets', 'tooling', '9X_110_GEO.glb');

    if (!existsSync(fixtureGlbPath)) {
      console.warn(`[Test] GLB file not found at ${fixtureGlbPath}, skipping test`);
      engine.dispose();
      return;
    }

    const buffer = readFileSync(fixtureGlbPath);

    if (!buffer) {
      throw new Error('Could not load GLB buffer for 9X_110_GEO');
    }

    await SceneLoader.ImportMeshAsync(
      undefined,
      '',
      buffer,
      scene,
      undefined,
      '.glb'
    );

    const structure = buildToolingStructureFromScene(scene);

    if (!structure?.root) {
      throw new Error('Tooling structure has no root');
    }

    const geometryIndex = await buildGeometryIndex(structure, scene);

    const full = formatToolingPointTree(structure, geometryIndex, {});
    const filtered = formatToolingPointTree(structure, geometryIndex, {
      maxDepth: 3,
      minPoints: 500,
    });

    console.log('=== TREE FULL 9X_110_GEO ===');
    console.log(full);
    console.log('=== TREE FILTERED 9X_110_GEO ===');
    console.log(filtered);

    engine.dispose();
  }, 60000);
});

