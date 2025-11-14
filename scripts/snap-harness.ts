// Snap Index Test Harness - Test MH5 base STL offline without full scene
// Owner: George
// Tests snap index building and querying on STL files directly

import fs from 'node:fs';
import * as BABYLON from '@babylonjs/core';
import { buildSnapIndex, queryNearestVertex } from '../src/manipulation/snapIndex';

/**
 * Minimal binary STL parser
 * Reads binary STL format (80-byte header, 4-byte triangle count, then triangles)
 */
function parseBinarySTL(buffer: Buffer): { positions: Float32Array; count: number } {
  // Skip 80-byte header
  let offset = 80;
  
  // Read triangle count (uint32, little-endian)
  const triangleCount = buffer.readUInt32LE(offset);
  offset += 4;
  
  // Each triangle: 12 floats (normal xyz + 3 vertices xyz) + 2-byte attribute = 50 bytes
  const positions = new Float32Array(triangleCount * 9); // 3 vertices * 3 coords per triangle
  let posIdx = 0;
  
  for (let i = 0; i < triangleCount; i++) {
    // Skip normal (3 floats = 12 bytes)
    offset += 12;
    
    // Read 3 vertices (9 floats = 36 bytes)
    for (let v = 0; v < 3; v++) {
      positions[posIdx++] = buffer.readFloatLE(offset);
      positions[posIdx++] = buffer.readFloatLE(offset + 4);
      positions[posIdx++] = buffer.readFloatLE(offset + 8);
      offset += 12;
    }
    
    // Skip attribute (2 bytes)
    offset += 2;
  }
  
  return { positions, count: triangleCount };
}

/**
 * Create a mock BABYLON.Mesh from positions
 */
function createMockMesh(name: string, positions: Float32Array, scene: BABYLON.Scene): BABYLON.Mesh {
  const mesh = new BABYLON.Mesh(name, scene);
  
  // Create vertex buffer
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = Array.from(positions);
  vertexData.applyToMesh(mesh);
  
  // Set up bounding info
  mesh.refreshBoundingInfo();
  
  // Set identity world matrix
  mesh.computeWorldMatrix(true);
  
  return mesh;
}

/**
 * Create a mock camera for testing
 */
function createMockCamera(scene: BABYLON.Scene): BABYLON.ArcRotateCamera {
  const camera = new BABYLON.ArcRotateCamera(
    'testCamera',
    Math.PI / 4, // alpha
    Math.PI / 4, // beta
    1.0, // radius
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.fov = Math.PI / 4;
  return camera;
}

/**
 * Main test function
 */
async function main() {
  const stlPath = process.argv[2] || 'public/library/manufacturing/models/motoman/mh5/meshes/mh5/visual/MH5_BASE_AXIS.stl';
  
  if (!fs.existsSync(stlPath)) {
    console.error(`STL file not found: ${stlPath}`);
    console.error('Usage: npm run snap:harness [path/to/file.stl]');
    process.exit(1);
  }
  
  console.log(`[Snap Harness] Loading STL: ${stlPath}`);
  const buffer = fs.readFileSync(stlPath);
  
  // Parse STL
  const { positions, count } = parseBinarySTL(buffer);
  console.log(`[Snap Harness] Parsed ${count} triangles, ${positions.length / 3} vertices`);
  
  // Create minimal scene (headless)
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);
  
  // Create mock mesh
  const mesh = createMockMesh('MH5_BASE_AXIS', positions, scene);
  console.log(`[Snap Harness] Created mesh with ${mesh.getTotalVertices()} vertices`);
  
  // Build snap index
  console.log(`[Snap Harness] Building snap index...`);
  const index = buildSnapIndex(mesh);
  
  if (!index) {
    console.error('[Snap Harness] Failed to build snap index');
    process.exit(1);
  }
  
  const weldedCount = index.vertsWorld.length / 3;
  console.log(`[Snap Harness] Index built: ${weldedCount} welded vertices, cell size=${index.cell.toFixed(6)}`);
  console.log(`[Snap Harness] Reduction: ${((positions.length / 3 - weldedCount) / (positions.length / 3) * 100).toFixed(1)}%`);
  
  // Create mock camera
  const camera = createMockCamera(scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  
  // Set up engine dimensions (for projection)
  engine.setSize(1920, 1080);
  
  // Test queries: sweep pointer pixels over a grid (reduced for faster testing)
  console.log(`[Snap Harness] Testing queries over 3x3 grid (minimal test)...`);
  const gridSize = 3;
  let hitCount = 0;
  let minPx = Infinity;
  let maxPx = 0;
  let totalPx = 0;
  const overallStart = Date.now();
  
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const pointerX = (x / gridSize) * 1920;
      const pointerY = (y / gridSize) * 1080;
      const pixelRadius = 50; // 50px threshold
      
      try {
        // Run query with timing
        const queryStart = Date.now();
        let result: ReturnType<typeof queryNearestVertex> | null = null;
        let queryError: Error | null = null;
        
        try {
          result = queryNearestVertex(mesh, camera, pointerX, pointerY, pixelRadius);
          const elapsed = Date.now() - queryStart;
          if (elapsed > 1000) {
            console.warn(`\n[Snap Harness] ⚠️ Slow query at (${x}, ${y}): ${elapsed}ms`);
          }
        } catch (err) {
          queryError = err as Error;
          console.error(`\n[Snap Harness] Query error at (${x}, ${y}):`, err);
        }
        
        if (queryError) {
          throw queryError;
        }
        
        if (result) {
          hitCount++;
          minPx = Math.min(minPx, result.px);
          maxPx = Math.max(maxPx, result.px);
          totalPx += result.px;
        }
        
        // Progress indicator - show every query
        const progress = x * gridSize + y + 1;
        const total = gridSize * gridSize;
        const elapsed = Date.now() - overallStart;
        const avgTime = elapsed / progress;
        process.stdout.write(`\r[Snap Harness] Query ${progress}/${total} (${hitCount} hits, ${avgTime.toFixed(0)}ms avg)...`);
      } catch (err) {
        console.error(`\n[Snap Harness] Error at query (${x}, ${y}):`, err);
        console.error(`[Snap Harness] Aborting test due to timeout/error`);
        throw err;
      }
    }
  }
  console.log(''); // New line after progress
  
  const hitRate = (hitCount / (gridSize * gridSize)) * 100;
  const avgPx = hitCount > 0 ? totalPx / hitCount : 0;
  
  console.log(`[Snap Harness] Results:`);
  console.log(`  Hit rate: ${hitRate.toFixed(1)}% (${hitCount}/${gridSize * gridSize})`);
  console.log(`  Min px: ${minPx !== Infinity ? minPx.toFixed(1) : 'N/A'}`);
  console.log(`  Max px: ${maxPx.toFixed(1)}`);
  console.log(`  Avg px: ${avgPx.toFixed(1)}`);
  
  if (hitRate < 50) {
    console.warn(`[Snap Harness] ⚠️ Low hit rate - may indicate issues with base geometry`);
  } else {
    console.log(`[Snap Harness] ✅ Good hit rate - index is working correctly`);
  }
  
  // Cleanup
  scene.dispose();
  engine.dispose();
}

// Run if called directly
main().catch(err => {
  console.error('[Snap Harness] Error:', err);
  process.exit(1);
});

