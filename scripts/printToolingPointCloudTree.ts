/**
 * Diagnostic script to print tooling point cloud tree.
 * 
 * Usage:
 *   npx tsx scripts/printToolingPointCloudTree.ts <TOOLING_ID> [--maxDepth=<n>] [--minPoints=<n>]
 * 
 * Examples:
 *   npx tsx scripts/printToolingPointCloudTree.ts 9X_110_GEO
 *   npx tsx scripts/printToolingPointCloudTree.ts 9X_110_GEO --maxDepth=3 --minPoints=500
 */

// Polyfill XMLHttpRequest for Babylon in Node
import xhr2 from 'xhr2';

if (!(globalThis as any).XMLHttpRequest) {
  (globalThis as any).XMLHttpRequest = xhr2;
}

// Node.js shims for Babylon.js Draco decoder (exact copy from tests)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (!(globalThis as any).require) {
  (globalThis as any).require = require;
}

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as path from 'node:path';

const dracoAssetDir = path.resolve(process.cwd(), 'node_modules', '@babylonjs', 'core', 'assets', 'Draco');
if (!(globalThis as any).__dirname) {
  (globalThis as any).__dirname = dracoAssetDir;
}
if (!(globalThis as any).__filename) {
  (globalThis as any).__filename = path.join(dracoAssetDir, 'draco_wasm_wrapper_gltf.js');
}

import * as BABYLON from '@babylonjs/core';
import { NullEngine } from '@babylonjs/core';
import { DracoCompression } from '@babylonjs/core/Meshes/Compression/dracoCompression';

// Polyfill BABYLON.Tools.GetAbsoluteUrl for Node.js (must be before loading)
if (BABYLON.Tools) {
  BABYLON.Tools.GetAbsoluteUrl = (url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
      return url;
    }
    if (path.isAbsolute(url)) {
      return `file:///${url.replace(/\\/g, '/')}`;
    }
    return `file:///${path.resolve(url).replace(/\\/g, '/')}`;
  };
}

// Configure Draco to use local files instead of CDN
try {
  const dracoPath = path.resolve(process.cwd(), 'node_modules', '@babylonjs', 'core', 'assets', 'Draco');
  DracoCompression.Configuration = {
    decoder: {
      wasmUrl: path.join(dracoPath, 'draco_decoder_gltf.wasm'),
      wasmBinaryUrl: path.join(dracoPath, 'draco_decoder_gltf.wasm'),
      fallbackUrl: path.join(dracoPath, 'draco_decoder_gltf.js'),
    },
  };
} catch (e) {
  // Ignore if Draco config fails
}

import '@babylonjs/loaders/glTF'; // Register GLTF/GLB loaders (exact import from test)

import { buildToolingStructureFromScene, buildGeometryIndex } from '../src/domain/tooling/babylonAdapter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type CliOptions = {
  maxDepth?: number;
  minPoints?: number;
};

/**
 * Parse CLI arguments for --maxDepth and --minPoints.
 */
function parseCliOptions(): CliOptions {
  const options: CliOptions = {};

  for (const arg of process.argv) {
    if (arg.startsWith('--maxDepth=')) {
      const value = arg.substring('--maxDepth='.length);
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        options.maxDepth = parsed;
      }
    }

    if (arg.startsWith('--minPoints=')) {
      const value = arg.substring('--minPoints='.length);
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        options.minPoints = parsed;
      }
    }
  }

  return options;
}

async function main() {
  const glbPathArg = process.argv[2];

  if (!glbPathArg) {
    console.error('Usage: tsx scripts/printToolingPointCloudTree.ts <PATH_TO_GLB> [--maxDepth=<n>] [--minPoints=<n>]');
    console.error('Example: tsx scripts/printToolingPointCloudTree.ts "C:\\path\\to\\file.glb"');
    console.error('Example: tsx scripts/printToolingPointCloudTree.ts "C:\\path\\to\\file.glb" --maxDepth=3 --minPoints=500');
    process.exit(1);
  }

  const cliOptions = parseCliOptions();

  // Use the provided path directly
  const fs = await import('fs');
  const glbPath = resolve(glbPathArg);
  
  if (!fs.existsSync(glbPath)) {
    console.error(`GLB file not found: ${glbPath}`);
    process.exit(1);
  }

  // Extract tooling ID from filename
  const toolingId = glbPath.split(/[/\\]/).pop()?.replace(/\.glb$/i, '') || 'tooling';

  // Suppress all console.log during loading
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  const logs: string[] = [];
  console.log = (...args: any[]) => { logs.push(args.join(' ')); };
  console.error = (...args: any[]) => { logs.push('ERROR: ' + args.join(' ')); };
  console.warn = (...args: any[]) => { logs.push('WARN: ' + args.join(' ')); };

  // Create headless Babylon scene
  const engine = new NullEngine({
    deterministicLockstep: false,
    renderHeight: 256,
    renderWidth: 256,
    textureSize: 256,
  });
  const scene = new BABYLON.Scene(engine);

  // Load GLB using Buffer (exact same as test)
  const glbBuffer = fs.readFileSync(glbPath);

  let result;
  try {
    // Use SceneLoader with Buffer directly (exact same as test)
    const importResult = await BABYLON.SceneLoader.ImportMeshAsync(
      undefined,
      '',
      glbBuffer,
      scene,
      undefined,
      '.glb'
    );
    
    if (!importResult || importResult.meshes.length === 0) {
      throw new Error('No meshes loaded from GLB file');
    }

    // Find root nodes
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
      rootNodes.push(...scene.rootNodes.filter(n => n instanceof BABYLON.TransformNode) as BABYLON.TransformNode[]);
    }

    result = {
      success: true,
      rootNodes: rootNodes.length > 0 ? rootNodes : [scene.rootNodes[0] as BABYLON.TransformNode],
      meshes: importResult.meshes,
      errors: [],
      warnings: [],
    };
  } catch (error) {
    result = {
      success: false,
      rootNodes: [],
      meshes: [],
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }

  if (!result.success || result.rootNodes.length === 0) {
    // Restore console before error
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    
    console.error('Failed to load GLB file:', result.errors.join('; '));
    if (result.errors.length === 0) {
      console.error('No error details provided. This might be a Node.js compatibility issue.');
    }
    process.exit(1);
  }

  const rootNode = result.rootNodes[0];

  // Build tooling structure
  const structure = buildToolingStructureFromScene(scene, rootNode);

  if (!structure.root) {
    console.error('No root node found in tooling structure');
    process.exit(1);
  }

  // Build geometry index
  const geometryIndex = await buildGeometryIndex(structure, scene, {
    stride: 10,
    maxPointsPerNode: 5000,
    useWorldSpace: true,
  });

  // Restore console
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;

  // Format and print tree using pure domain function
  const { formatToolingPointTree } = await import('../src/domain/tooling/debugTree');
  const treeText = formatToolingPointTree(structure, geometryIndex, {
    maxDepth: cliOptions.maxDepth,
    minPoints: cliOptions.minPoints,
  });

  // Only output the tree, nothing else
  console.log(treeText);
}


main().catch((err) => {
  console.error('Error while printing tooling point cloud tree:');
  console.error(err);
  process.exit(1);
});

