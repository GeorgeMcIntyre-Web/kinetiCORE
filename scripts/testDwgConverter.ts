/**
 * Test DWG to Babylon Converter
 * Tests the full conversion pipeline including mesh creation
 */

import * as BABYLON from '@babylonjs/core';
import { loadDWGFromFile } from '../src/loaders/dwg/DWGLoader';
import * as fs from 'fs';

async function testDWGConverter() {
  console.log('Creating headless Babylon.js engine...');

  // Create a NullEngine (headless, no WebGL required)
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);

  console.log('Loading DWG file...');
  const dwgPath = 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\Layout\\Dash\\OHP-B-01-9X-0001-26MY-V801-PRO-IMPBASE_20250912.dwg';

  if (!fs.existsSync(dwgPath)) {
    console.error(`File not found: ${dwgPath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(dwgPath);
  const file = new File([fileBuffer], 'test.dwg', { type: 'application/acad' });

  const startTime = performance.now();

  try {
    const result = await loadDWGFromFile(file, scene, {
      unitScale: 0.001, // Convert mm to meters
      onProgress: (progress) => {
        console.log(`Progress: ${progress.percent}% - ${progress.message}`);
      }
    });

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n=== CONVERSION RESULTS ===');
    console.log(`Total time: ${duration}s`);
    console.log(`Meshes created: ${result.meshes.length}`);
    console.log(`Root nodes: ${result.rootNodes.length}`);

    // Analyze mesh types
    const meshTypes = new Map<string, number>();
    result.meshes.forEach(mesh => {
      const type = mesh.name.split('_')[0];
      meshTypes.set(type, (meshTypes.get(type) || 0) + 1);
    });

    console.log('\n=== MESH BREAKDOWN ===');
    meshTypes.forEach((count, type) => {
      console.log(`  ${type}: ${count} meshes`);
    });

    // Check for INSERT placeholder markers
    const insertMarkers = result.meshes.filter(m => m.name.startsWith('BlockMarker'));
    console.log(`\n=== INSERT BLOCKS ===`);
    console.log(`Placeholder markers created: ${insertMarkers.length}`);

    // Calculate total vertices
    let totalVertices = 0;
    result.meshes.forEach(mesh => {
      if (mesh.getTotalVertices) {
        totalVertices += mesh.getTotalVertices();
      }
    });
    console.log(`\n=== GEOMETRY ===`);
    console.log(`Total vertices: ${totalVertices.toLocaleString()}`);

    console.log('\n✓ Test completed successfully');

  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }

  engine.dispose();
}

testDWGConverter();
