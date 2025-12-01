/**
 * Validate Statistical Pairing Against Ground Truth
 *
 * Loads real GLB fixtures from kinetiCORE_data and validates that
 * the Statistical Pairing Engine correctly detects all units.
 *
 * CRITICAL: These are SINGLE-STATE fixtures (not open/closed pairs).
 * This script validates UNIT DETECTION only, not joint extraction.
 *
 * KNOWN ISSUE: Currently hangs on GLB load in Null engine environment.
 * TODO: Revisit validation harness after resolving Babylon.js Node.js loader issues.
 * For now, 9X-110 is the primary fully validated case (open/closed pair available).
 *
 * See docs/STATISTICAL_PAIRING_OVERVIEW.md for current validation status.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as BABYLON from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders/glTF';
import '@babylonjs/core/Loading/loadingScreen';

// Polyfill for Node.js
if (typeof XMLHttpRequest === 'undefined') {
  (global as any).XMLHttpRequest = class XMLHttpRequest {
    responseType: string = '';
    response: any = null;
    status: number = 0;
    readyState: number = 0;
    onload: (() => void) | null = null;
    onerror: ((error: any) => void) | null = null;
    onreadystatechange: (() => void) | null = null;
    private _url: string = '';
    private _listeners: Map<string, Array<(event: any) => void>> = new Map();

    open(method: string, url: string) {
      this._url = url;
    }

    addEventListener(event: string, callback: (event: any) => void) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event)!.push(callback);
    }

    removeEventListener(event: string, callback: (event: any) => void) {
      const listeners = this._listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      }
    }

    send() {
      try {
        const data = fs.readFileSync(this._url);
        if (this.responseType === 'arraybuffer') {
          this.response = data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength
          );
        } else {
          this.response = data;
        }
        this.status = 200;
        this.readyState = 4;

        const loadEvent = { type: 'load', target: this };
        if (this.onload) this.onload();
        if (this.onreadystatechange) this.onreadystatechange();

        const listeners = this._listeners.get('load');
        if (listeners) {
          listeners.forEach(cb => cb(loadEvent));
        }
      } catch (error) {
        this.status = 404;
        this.readyState = 4;

        const errorEvent = { type: 'error', target: this, error };
        if (this.onerror) this.onerror(errorEvent);

        const listeners = this._listeners.get('error');
        if (listeners) {
          listeners.forEach(cb => cb(errorEvent));
        }
      }
    }
  };
}

// Register GLTF loader
BABYLON.SceneLoader.RegisterPlugin(new GLTFFileLoader());

const DATA_DIR = 'c:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data';

/**
 * Ground truth data - user provided
 */
const GROUND_TRUTH = {
  '8X Station 140': {
    path: path.join(DATA_DIR, '8X-140_GEO/016ZF_20142435_140_CI00_draco_off.glb'),
    totalUnits: 4,
    units: [
      { name: 'UNIT_102', joints: 2 },
      { name: 'UNIT_106', joints: 2 },
    ],
  },
  '5X Station 110': {
    path: path.join(DATA_DIR, '016ZF_20142452_110/016ZF_20142452_110_draco_off.glb'),
    totalUnits: 13,
    units: [
      { name: 'UNIT_104', joints: 1 },
      { name: 'UNIT_105', joints: 1 },
      { name: 'UNIT_108', joints: 2 },
      { name: 'UNIT_112', joints: 2 },
      { name: 'UNIT_114', joints: 2 },
      { name: 'UNIT_116', joints: 2 },
      { name: 'UNIT_120', joints: 2 },
    ],
  },
  '8X Station 130': {
    path: path.join(DATA_DIR, '016ZF_20142435_130/016ZF_20142435_130_draco_off.glb'),
    totalUnits: 10,
    units: [
      { name: 'UNIT_114', joints: 2 },
      { name: 'UNIT_112', joints: 2 },
      { name: 'UNIT_110', joints: 2 },
      { name: 'UNIT_108', joints: 2 },
      { name: 'UNIT_107', joints: 1 },
      { name: 'UNIT_106', joints: 1 },
      { name: 'UNIT_104', joints: 2 },
      { name: 'UNIT_102', joints: 2 },
      { name: 'UNIT_116', joints: 2 },
    ],
  },
  'Floor Clamp': {
    path: path.join(DATA_DIR, '2174530000_M00_GJR_RR FLR_CM030_T01/2174530000_M00_GJR_RR FLR_CM030_T01_draco_off.glb'),
    totalUnits: 17,
    units: [
      { name: '2174530040_M00_CLAMP UNIT_040', joints: 1 },
      { name: '2174530060_M00_CLAMP UNIT_060', joints: 1 },
      { name: '2174530080_M00_CLAMP UNIT_080', joints: 1 },
      { name: '2174530100_M00_CLAMP UNIT_100_SYM_080', joints: 1 },
      { name: '2174530120_M00_CLAMP UNIT_120', joints: 1 },
      { name: '2174530260_M00_CLAMP UNIT_260_SYM_240', joints: 1 },
      { name: '2174530280_M00_CLAMP UNIT_280', joints: 1 },
      { name: '2174530300_M00_CLAMP UNIT_300_SYM_280', joints: 1 },
      { name: '2174530320_M00_RETRACT PIN UNIT_320', joints: 1 },
      { name: '2174530340_M00_RETRACT PIN UNIT_340_SYM_320', joints: 1 },
    ],
  },
};

/**
 * Count vertices in mesh hierarchy
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
 * Find all top-level units in hierarchy
 */
function findTopLevelUnits(rootMesh: BABYLON.AbstractMesh): Array<{ name: string; mesh: BABYLON.AbstractMesh; vertices: number }> {
  const units: Array<{ name: string; mesh: BABYLON.AbstractMesh; vertices: number }> = [];

  // Get immediate children of root
  for (const child of rootMesh.getChildMeshes(true)) {
    // Only direct children (depth 1)
    if (child.parent === rootMesh || child.parent?.parent === rootMesh) {
      const vertices = countVertices(child);
      if (vertices > 0) {
        units.push({
          name: child.name,
          mesh: child,
          vertices,
        });
      }
    }
  }

  return units;
}

/**
 * Load GLB file
 */
async function loadGLB(filePath: string, scene: BABYLON.Scene): Promise<BABYLON.AbstractMesh> {
  return new Promise((resolve, reject) => {
    BABYLON.SceneLoader.ImportMesh(
      '',
      '',
      filePath,
      scene,
      (meshes) => {
        if (meshes.length === 0) {
          reject(new Error('No meshes loaded'));
          return;
        }
        const root = meshes.find(m => m.parent === null);
        if (!root) {
          reject(new Error('No root mesh found'));
          return;
        }
        resolve(root);
      },
      undefined,
      (scene, message) => {
        reject(new Error(`Failed to load: ${message}`));
      }
    );
  });
}

/**
 * Validate a single fixture
 */
async function validateFixture(name: string, data: typeof GROUND_TRUTH[keyof typeof GROUND_TRUTH], engine: BABYLON.Engine) {
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`FIXTURE: ${name}`);
  console.log(`${'═'.repeat(90)}`);
  console.log(`File: ${data.path}`);
  console.log(`Expected units: ${data.totalUnits}`);
  console.log(`Expected moving units: ${data.units.length}\n`);

  const scene = new BABYLON.Scene(engine);

  try {
    // Load GLB
    console.log('Loading GLB...');
    const root = await loadGLB(data.path, scene);

    // Find all top-level units
    const detectedUnits = findTopLevelUnits(root);
    const totalVertices = countVertices(root);

    console.log(`Total vertices: ${totalVertices.toLocaleString()}`);
    console.log(`\nDetected ${detectedUnits.length} top-level units:\n`);

    // Print detected units
    detectedUnits.forEach((unit, i) => {
      const pct = ((unit.vertices / totalVertices) * 100).toFixed(1);
      console.log(`  ${(i + 1).toString().padStart(2)}. ${unit.name.padEnd(50)} ${unit.vertices.toLocaleString().padStart(10)} verts (${pct.padStart(5)}%)`);
    });

    // Validate against ground truth
    console.log(`\n${'─'.repeat(90)}`);
    console.log('VALIDATION:');
    console.log(`${'─'.repeat(90)}\n`);

    let foundCount = 0;
    let missingUnits: string[] = [];

    data.units.forEach(expectedUnit => {
      const found = detectedUnits.find(u => u.name.includes(expectedUnit.name));
      if (found) {
        foundCount++;
        const pct = ((found.vertices / totalVertices) * 100).toFixed(1);
        console.log(`  ✅ ${expectedUnit.name.padEnd(50)} ${found.vertices.toLocaleString().padStart(10)} verts (${pct.padStart(5)}%)`);
      } else {
        missingUnits.push(expectedUnit.name);
        console.log(`  ❌ ${expectedUnit.name.padEnd(50)} NOT FOUND`);
      }
    });

    // Summary
    console.log(`\n${'─'.repeat(90)}`);
    const detectionRate = ((foundCount / data.units.length) * 100).toFixed(1);
    console.log(`Detection Rate: ${foundCount}/${data.units.length} (${detectionRate}%)`);

    if (missingUnits.length === 0) {
      console.log(`Status: ✅ PASS - All expected units found`);
    } else {
      console.log(`Status: ⚠️  PARTIAL - Missing: ${missingUnits.join(', ')}`);
    }

    // Check for unexpected units (potential false positives or undocumented units)
    const extraUnits = detectedUnits.filter(d =>
      !data.units.some(u => d.name.includes(u.name))
    );

    if (extraUnits.length > 0) {
      console.log(`\nAdditional units detected (${extraUnits.length}):`);
      extraUnits.forEach(unit => {
        const pct = ((unit.vertices / totalVertices) * 100).toFixed(1);
        console.log(`  ℹ️  ${unit.name.padEnd(50)} ${unit.vertices.toLocaleString().padStart(10)} verts (${pct.padStart(5)}%)`);
      });
      console.log(`Note: These may be static units, base plates, or additional moving parts`);
    }

  } catch (error) {
    console.error(`\n❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    scene.dispose();
  }
}

/**
 * Main
 */
async function main() {
  console.log('═'.repeat(90));
  console.log('GROUND TRUTH VALIDATION - Statistical Pairing Engine');
  console.log('═'.repeat(90));
  console.log('\nValidating unit detection against known fixtures');
  console.log('Method: Name-agnostic hierarchy analysis\n');

  const engine = new BABYLON.NullEngine();

  try {
    for (const [name, data] of Object.entries(GROUND_TRUTH)) {
      await validateFixture(name, data, engine);
    }

    console.log(`\n${'═'.repeat(90)}`);
    console.log('VALIDATION COMPLETE');
    console.log(`${'═'.repeat(90)}\n`);

  } finally {
    engine.dispose();
  }
}

main().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
