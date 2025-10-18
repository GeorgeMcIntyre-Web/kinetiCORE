// Test script for GLB up-axis auto-detection
// Tests UNIT_102_1.glb and UNIT_102_2.glb

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { loadGLBFromFile } from './GLBLoader';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test GLB up-axis detection with two sample files
 */
async function testUpAxisDetection(): Promise<void> {
  console.log('='.repeat(80));
  console.log('GLB Up-Axis Detection Test');
  console.log('='.repeat(80));

  // Create a headless Babylon.js scene
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);

  const testFiles = [
    'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\Tooling\\UNIT_102_1.glb',
    'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\Tooling\\UNIT_102_2.glb'
  ];

  for (const filePath of testFiles) {
    console.log('\n' + '-'.repeat(80));
    console.log(`Testing: ${path.basename(filePath)}`);
    console.log('-'.repeat(80));

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        continue;
      }

      // Read file as Buffer and convert to File object
      const buffer = fs.readFileSync(filePath);
      const blob = new Blob([buffer]);
      const file = new File([blob], path.basename(filePath), {
        type: 'model/gltf-binary'
      });

      // Load GLB with up-axis detection enabled
      const result = await loadGLBFromFile(file, scene, {
        enableUpAxisDetection: true,
        upAxisBake: true,
        upAxisVerbose: true,
        enableProgressCallback: true,
        onProgress: (progress, message) => {
          console.log(`  [${progress}%] ${message}`);
        }
      });

      // Display results
      console.log('\nLoad Result:');
      console.log(`  Success: ${result.success ? '✅' : '❌'}`);
      console.log(`  Meshes: ${result.meshes.length}`);
      console.log(`  Root Nodes: ${result.rootNodes.length}`);

      if (result.upAxisDetection) {
        console.log('\nUp-Axis Detection:');
        console.log(`  Detected Axis: ${result.upAxisDetection.detected}`);
        console.log(`  Confidence: ${(result.upAxisDetection.confidence * 100).toFixed(1)}%`);
        console.log(`  Method: ${result.upAxisDetection.method}`);
        console.log(`  Fix Applied: ${result.upAxisDetection.applied ? '✅' : '❌'}`);
      } else {
        console.log('\nUp-Axis Detection: Not performed');
      }

      if (result.bounds) {
        const min = result.bounds.minimum;
        const max = result.bounds.maximum;
        const extents = max.subtract(min);

        console.log('\nBounds:');
        console.log(`  Min: (${min.x.toFixed(2)}, ${min.y.toFixed(2)}, ${min.z.toFixed(2)})`);
        console.log(`  Max: (${max.x.toFixed(2)}, ${max.y.toFixed(2)}, ${max.z.toFixed(2)})`);
        console.log(`  Extents: X=${extents.x.toFixed(2)}, Y=${extents.y.toFixed(2)}, Z=${extents.z.toFixed(2)}`);
        console.log(`  Y/Z Ratio: ${(extents.y / extents.z).toFixed(2)}`);
        console.log(`  Z/Y Ratio: ${(extents.z / extents.y).toFixed(2)}`);
      }

      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
      }

      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(e => console.log(`  ❌ ${e}`));
      }

      // Clean up scene for next test
      scene.dispose();
      const newScene = new BABYLON.Scene(engine);
      Object.assign(scene, newScene);

    } catch (error) {
      console.error(`❌ Error loading ${path.basename(filePath)}:`, error);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Test Complete');
  console.log('='.repeat(80));

  engine.dispose();
}

// Run tests
if (require.main === module) {
  testUpAxisDetection()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testUpAxisDetection };
