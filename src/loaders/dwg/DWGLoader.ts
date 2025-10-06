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
import { DWGToBabylonConverter } from './DWGToBabylonConverter';
import { DWGImportError } from './errors';
import { DWGLoaderOptions, DWGImportProgress } from './types';

// Singleton parser instance (WASM module is expensive to initialize)
let parserInstance: DWGParserService | null = null;

/**
 * Get or create DWG parser instance
 */
function getParser(): DWGParserService {
  if (!parserInstance) {
    parserInstance = new DWGParserService();
  }
  return parserInstance;
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
  console.log(`[DWG Loader] Loading ${file.name}...`);

  const onProgress = options.onProgress || ((progress: DWGImportProgress) => {
    console.log(`[DWG Loader] ${progress.message} (${progress.percent}%)`);
  });

  try {
    // Parse DWG file
    const parser = getParser();
    const parseResult = await parser.parseDWG(file, onProgress);

    // Log warnings if any
    if (parseResult.warnings.length > 0) {
      console.warn('[DWG Loader] Warnings:', parseResult.warnings);
    }

    // Log summary
    console.log('[DWG Loader] Parse result:', {
      entities: parseResult.entityCount,
      types: parseResult.entityTypes,
      layers: parseResult.layers.size,
      warnings: parseResult.warnings.length
    });

    // Convert to Babylon meshes
    const converter = new DWGToBabylonConverter(scene, options);
    const result = await converter.convert(parseResult.database, onProgress);

    console.log(`[DWG Loader] Successfully loaded ${file.name}:`, {
      meshes: result.meshes.length,
      rootNodes: result.rootNodes.length
    });

    return result;
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
