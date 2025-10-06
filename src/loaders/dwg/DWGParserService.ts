/**
 * DWG Parser Service
 * Owner: George
 *
 * Service for parsing DWG files using LibreDWG WebAssembly
 */

import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import { DWGImportError } from './errors';
import { DWGErrorType, DWGParseResult, DWGImportProgress, LIBREDWG_ERROR_CODES } from './types';

/**
 * Service for parsing DWG files
 */
export class DWGParserService {
  private libredwg: LibreDwg | null = null;
  private isInitialized = false;

  /**
   * Initialize LibreDWG WASM module
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.libredwg) {
      return;
    }

    try {
      console.log('[DWG Parser] Initializing LibreDWG WASM module...');

      // Use explicit path to WASM file in public directory
      // This avoids Vite trying to inline the WASM as base64 data URL
      this.libredwg = await LibreDwg.create('/wasm/');

      this.isInitialized = true;
      console.log('[DWG Parser] LibreDWG initialized successfully');
    } catch (error) {
      console.error('[DWG Parser] Failed to initialize LibreDWG:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new DWGImportError(
        DWGErrorType.WASMNotLoaded,
        'Failed to load LibreDWG WebAssembly module.\n\n' +
        'This is required for reading DWG files.\n\n' +
        `Error: ${errorMsg}`,
        false,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse DWG file
   *
   * @param file - DWG file to parse
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to parsed DWG data
   */
  async parseDWG(
    file: File,
    onProgress?: (progress: DWGImportProgress) => void
  ): Promise<DWGParseResult> {
    // Ensure initialized
    await this.initialize();

    const fileName = file.name;

    try {
      // Report progress: Reading file
      onProgress?.({
        percent: 10,
        message: 'Reading DWG file...',
        stage: 'parsing'
      });

      // Read file as ArrayBuffer
      const fileBuffer = await file.arrayBuffer();

      // Report progress: Parsing
      onProgress?.({
        percent: 30,
        message: 'Parsing DWG structure...',
        stage: 'parsing'
      });

      // Parse DWG file
      console.log(`[DWG Parser] Parsing ${fileName}...`);
      const dwg = this.libredwg!.dwg_read_data(fileBuffer, Dwg_File_Type.DWG);

      // Check for errors
      const errorCode = (dwg as any).error;
      if (errorCode !== undefined && errorCode !== 0) {
        const errorMsg = LIBREDWG_ERROR_CODES[errorCode] || `Unknown error (code ${errorCode})`;
        console.warn(`[DWG Parser] Warning: ${errorMsg}`);

        const error = DWGImportError.fromLibreDWGError(errorCode, fileName);
        if (error && !error.recoverable) {
          throw error;
        }
      }

      // Report progress: Converting
      onProgress?.({
        percent: 50,
        message: 'Converting to database structure...',
        stage: 'converting'
      });

      // Convert to DwgDatabase
      const database = this.libredwg!.convert(dwg as any);

      // Free raw dwg memory
      this.libredwg!.dwg_free(dwg as any);

      // Extract metadata
      const entityCount = database.entities?.length || 0;
      const entityTypes = database.entities
        ? [...new Set(database.entities.map(e => e.type))]
        : [];

      const layers = new Map();
      const dbLayers = (database as any).layers;
      if (dbLayers) {
        for (const [name, layer] of Object.entries(dbLayers)) {
          layers.set(name, {
            name,
            color: (layer as any).color || 0,
            frozen: (layer as any).frozen || false,
            locked: (layer as any).locked || false,
            visible: !(layer as any).off
          });
        }
      }

      const warnings: string[] = [];
      if (errorCode !== undefined && errorCode !== 0) {
        warnings.push(
          `DWG parsing warning (code ${errorCode}): ${LIBREDWG_ERROR_CODES[errorCode]}`
        );
      }

      // Report progress: Complete
      onProgress?.({
        percent: 70,
        message: `Parsed ${entityCount} entities`,
        stage: 'converting',
        entitiesProcessed: entityCount,
        totalEntities: entityCount
      });

      const result: DWGParseResult = {
        database,
        header: {
          version: (database.header as any)?.VERSION,
          acadVersion: (database.header as any)?.ACADVER,
          dwgCodePage: (database.header as any)?.DWGCODEPAGE
        },
        entityCount,
        entityTypes,
        layers,
        warnings,
        errorCode
      };

      console.log(`[DWG Parser] Successfully parsed ${fileName}:`, {
        entities: entityCount,
        types: entityTypes,
        layers: layers.size,
        warnings: warnings.length
      });

      return result;
    } catch (error) {
      if (error instanceof DWGImportError) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[DWG Parser] Parsing failed:', error);
      throw new DWGImportError(
        DWGErrorType.FileReadError,
        `Failed to parse DWG file: ${fileName}\n\n${errorMsg}`,
        false,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.libredwg = null;
    this.isInitialized = false;
  }
}
