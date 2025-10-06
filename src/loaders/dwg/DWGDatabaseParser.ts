/**
 * DWG Database Parser Service
 * Owner: George
 *
 * Service for parsing DWG files using LibreDWG converter with AcDbDatabase API
 * This provides access to block definitions and INSERT entity resolution
 */

import { createModule } from '@mlightcad/libredwg-web';
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter';
import { AcDbDatabaseConverterManager, AcDbFileType } from '@mlightcad/data-model';
import { DWGImportError } from './errors';
import { DWGErrorType, DWGImportProgress, LIBREDWG_ERROR_CODES } from './types';

/**
 * Result of DWG database parsing
 */
export interface DWGDatabaseParseResult {
  database: any; // AcDbDatabase
  header: {
    version?: string;
    acadVersion?: string;
    dwgCodePage?: string;
  };
  entityCount: number;
  entityTypes: string[];
  blockCount: number;
  blockNames: string[];
  layers: Map<string, any>;
  warnings: string[];
  errorCode?: number;
}

/**
 * Service for parsing DWG files with block definition support
 */
export class DWGDatabaseParser {
  private libredwgModule: any | null = null;
  private converter: AcDbLibreDwgConverter | null = null;
  private isInitialized = false;

  /**
   * Initialize LibreDWG WASM module and converter
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.libredwgModule && this.converter) {
      return;
    }

    try {
      console.log('[DWG Database Parser] Initializing LibreDWG converter...');

      // Initialize LibreDWG WASM module using createModule
      this.libredwgModule = await createModule({
        locateFile: (path: string) => {
          if (path.endsWith('.wasm')) {
            return '/wasm/libredwg-web.wasm';
          }
          return path;
        }
      });

      // Create converter
      this.converter = new AcDbLibreDwgConverter(this.libredwgModule);

      // Register converter with manager
      AcDbDatabaseConverterManager.instance.register(AcDbFileType.DWG, this.converter);

      this.isInitialized = true;
      console.log('[DWG Database Parser] Converter initialized successfully');
    } catch (error) {
      console.error('[DWG Database Parser] Failed to initialize converter:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new DWGImportError(
        DWGErrorType.WASMNotLoaded,
        'Failed to load LibreDWG converter.\n\n' +
        'This is required for reading DWG files with block support.\n\n' +
        `Error: ${errorMsg}`,
        false,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse DWG file and return AcDbDatabase with block definitions
   *
   * @param file - DWG file to parse
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to parsed database
   */
  async parseDWG(
    file: File,
    onProgress?: (progress: DWGImportProgress) => void
  ): Promise<DWGDatabaseParseResult> {
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

      // Convert to database using converter manager
      console.log(`[DWG Database Parser] Converting ${fileName}...`);
      const database = await AcDbDatabaseConverterManager.instance.read(
        AcDbFileType.DWG,
        new Uint8Array(fileBuffer)
      );

      // Report progress: Analyzing
      onProgress?.({
        percent: 50,
        message: 'Analyzing database structure...',
        stage: 'converting'
      });

      // Extract entity count from modelspace and paperspace
      let entityCount = 0;
      const entityTypes = new Set<string>();

      // Get modelspace block
      const modelspace = database.modelspace();
      if (modelspace) {
        const msIterator = modelspace.newIterator();
        while (!msIterator.done()) {
          const entity = msIterator.entity();
          if (entity) {
            entityCount++;
            entityTypes.add(entity.isA().name());
          }
          msIterator.step();
        }
      }

      // Get paperspace blocks
      const paperspace = database.paperspace();
      if (paperspace) {
        const psIterator = paperspace.newIterator();
        while (!psIterator.done()) {
          const entity = psIterator.entity();
          if (entity) {
            entityCount++;
            entityTypes.add(entity.isA().name());
          }
          psIterator.step();
        }
      }

      // Get block table and count blocks
      const blockTable = database.blockTable();
      const blockNames: string[] = [];
      let blockCount = 0;

      if (blockTable) {
        const btIterator = blockTable.newIterator();
        while (!btIterator.done()) {
          const blockRecord = btIterator.getRecord();
          if (blockRecord) {
            const blockName = blockRecord.name();
            // Skip system blocks
            if (!blockName.startsWith('*')) {
              blockNames.push(blockName);
              blockCount++;

              // Count entities in this block
              const blockIterator = blockRecord.newIterator();
              while (!blockIterator.done()) {
                const entity = blockIterator.entity();
                if (entity) {
                  entityCount++;
                  entityTypes.add(entity.isA().name());
                }
                blockIterator.step();
              }
            }
          }
          btIterator.step();
        }
      }

      // Extract layers
      const layers = new Map();
      const layerTable = database.layerTable();
      if (layerTable) {
        const ltIterator = layerTable.newIterator();
        while (!ltIterator.done()) {
          const layerRecord = ltIterator.getRecord();
          if (layerRecord) {
            const name = layerRecord.name();
            layers.set(name, {
              name,
              color: layerRecord.color()?.colorIndex() || 0,
              frozen: layerRecord.isFrozen(),
              locked: layerRecord.isLocked(),
              visible: !layerRecord.isOff()
            });
          }
          ltIterator.step();
        }
      }

      // Extract header info
      const header = {
        version: database.header()?.VERSION,
        acadVersion: database.header()?.ACADVER,
        dwgCodePage: database.header()?.DWGCODEPAGE
      };

      // Report progress: Complete
      onProgress?.({
        percent: 70,
        message: `Parsed ${entityCount} entities in ${blockCount} blocks`,
        stage: 'converting',
        entitiesProcessed: entityCount,
        totalEntities: entityCount
      });

      const result: DWGDatabaseParseResult = {
        database,
        header,
        entityCount,
        entityTypes: Array.from(entityTypes),
        blockCount,
        blockNames,
        layers,
        warnings: []
      };

      console.log(`[DWG Database Parser] Successfully parsed ${fileName}:`, {
        entities: entityCount,
        types: Array.from(entityTypes),
        blocks: blockCount,
        layers: layers.size
      });

      return result;
    } catch (error) {
      if (error instanceof DWGImportError) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[DWG Database Parser] Parsing failed:', error);
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
    this.libredwgModule = null;
    this.converter = null;
    this.isInitialized = false;
  }
}
