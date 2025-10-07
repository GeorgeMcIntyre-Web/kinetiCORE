/**
 * DWG Loader - Main entry point for loading AutoCAD DWG files
 * Owner: George
 *
 * Loads DWG files using LibreDWG (open source) and converts to Babylon.js meshes
 * Follows kinetiCORE Z-up coordinate system standard
 *
 * IMPORTANT: Coordinate System
 * ===========================
 * DWG files use XY plane for 2D drawings (Z=0 by default)
 * kinetiCORE uses Z-up (CAD/ROS standard)
 * No coordinate conversion needed - DWG is already compatible
 *
 * Supported DWG Versions:
 * - AutoCAD R13 (1994) through R2021
 * - Partial support for newer versions (may show warnings)
 *
 * Supported Entities:
 * - LINE, LWPOLYLINE, POLYLINE
 * - CIRCLE, ARC, ELLIPSE
 * - SPLINE
 * - TEXT, MTEXT (placeholder boxes for now)
 *
 * Not Yet Supported:
 * - INSERT (blocks) - needs block definition system
 * - HATCH - complex pattern fills
 * - DIMENSION - needs dimension rendering
 * - 3DFACE, 3DSOLID - 3D entities
 */

import * as BABYLON from '@babylonjs/core';
import { DWGParserService } from './DWGParserService';
import { DWGDatabaseParser } from './DWGDatabaseParser';
import { DWGToBabylonConverter } from './DWGToBabylonConverter';
import { DWGDatabaseToBabylonConverter } from './DWGDatabaseToBabylonConverter';
import { DWGImportError } from './errors';
import { DWGLoaderOptions, DWGImportProgress } from './types';

// Singleton parser instances (WASM module is expensive to initialize)
let parserInstance: DWGParserService | null = null;
let databaseParserInstance: DWGDatabaseParser | null = null;

/**
 * Get or create DWG parser instance (legacy)
 */
function getParser(): DWGParserService {
  if (!parserInstance) {
    parserInstance = new DWGParserService();
  }
  return parserInstance;
}

/**
 * Get or create DWG database parser instance (new - with block support)
 */
function getDatabaseParser(): DWGDatabaseParser {
  if (!databaseParserInstance) {
    databaseParserInstance = new DWGDatabaseParser();
  }
  return databaseParserInstance;
}

/**
 * Load DWG file and convert to Babylon.js meshes
 *
 * @param file - DWG file to load
 * @param scene - Babylon.js scene
 * @param options - Loader options
 * @returns Promise resolving to loaded meshes and root nodes
 *
 * @throws {DWGImportError} When loading fails
 *
 * @example
 * ```typescript
 * const result = await loadDWGFromFile(file, scene, {
 *   unitScale: 0.001, // mm to meters
 *   onProgress: (progress) => {
 *     console.log(`${progress.message} (${progress.percent}%)`);
 *   }
 * });
 * ```
 */
export async function loadDWGFromFile(
  file: File,
  scene: BABYLON.Scene,
  options: DWGLoaderOptions = {}
): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
  const totalStartTime = performance.now();
  console.log(`[DWG Loader] Loading ${file.name}...`);

  const onProgress = options.onProgress || ((progress: DWGImportProgress) => {
    console.log(`[DWG Loader] ${progress.message} (${progress.percent}%)`);
  });

  try {
    // Use new database parser with block support
    const parseStartTime = performance.now();
    const parser = getDatabaseParser();
    const parseResult = await parser.parseDWG(file, onProgress);
    const parseTime = performance.now() - parseStartTime;

    // Log warnings if any
    if (parseResult.warnings.length > 0) {
      console.warn('[DWG Loader] Warnings:', parseResult.warnings);
    }

    // Log summary
    console.log('[DWG Loader] Parse result:', {
      entities: parseResult.entityCount,
      types: parseResult.entityTypes,
      blocks: parseResult.blockCount,
      blockNames: parseResult.blockNames,
      layers: parseResult.layers.size,
      warnings: parseResult.warnings.length
    });

    // Convert to Babylon meshes using new database converter
    const converter = new DWGDatabaseToBabylonConverter({
      scene,
      unitScale: options.unitScale || 0.001,
      batchByColor: true,
      expandBlocks: true,
      debugLogging: true
    });

    onProgress?.({
      percent: 75,
      message: 'Converting geometry to 3D meshes...',
      stage: 'converting'
    });

    const conversionResult = await converter.convert(parseResult.database);

    onProgress?.({
      percent: 100,
      message: 'Complete',
      stage: 'converting'
    });

    const totalTime = performance.now() - totalStartTime;

    console.log(`\n========== DWG LOAD PERFORMANCE ==========`);
    console.log(`File: ${file.name}`);
    console.log(`Parse time: ${parseTime.toFixed(2)}ms`);
    console.log(`Conversion time: ${conversionResult.conversionTime.toFixed(2)}ms`);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`Entities processed: ${conversionResult.entityCount}`);
    console.log(`Meshes created: ${conversionResult.meshes.length}`);
    console.log(`Block instances: ${conversionResult.blockInstanceCount}`);
    console.log(`==========================================\n`);

    // Create root node for organization
    const rootNode = new BABYLON.TransformNode(`dwg_${file.name}`, scene);
    conversionResult.meshes.forEach(mesh => {
      mesh.parent = rootNode;
    });

    // DWG files use Z-up coordinate system, rotate to Y-up (Babylon standard)
    // Rotate -90 degrees around X axis to make Z-up become Y-up
    rootNode.rotation.x = -Math.PI / 2;

    return {
      meshes: conversionResult.meshes,
      rootNodes: [rootNode]
    };
  } catch (error) {
    if (error instanceof DWGImportError) {
      console.error('[DWG Loader] Import failed:', error.getUserMessage());
      throw error;
    }

    console.error('[DWG Loader] Unexpected error:', error);
    throw error;
  }
}

/**
 * Check if DWG loader is available (LibreDWG WASM loaded)
 */
export async function isDWGLoaderAvailable(): Promise<boolean> {
  try {
    const parser = getParser();
    await parser.initialize();
    return true;
  } catch (error) {
    console.error('[DWG Loader] Not available:', error);
    return false;
  }
}

/**
 * Pre-initialize DWG loader (loads WASM module in background)
 * Call this early in app startup to reduce first load time
 */
export async function preInitializeDWGLoader(): Promise<void> {
  try {
    const parser = getParser();
    await parser.initialize();
    console.log('[DWG Loader] Pre-initialized successfully');
  } catch (error) {
    console.warn('[DWG Loader] Pre-initialization failed:', error);
    // Don't throw - this is optional optimization
  }
}

/**
 * Dispose DWG loader resources
 */
export function disposeDWGLoader(): void {
  if (parserInstance) {
    parserInstance.dispose();
    parserInstance = null;
  }
}
