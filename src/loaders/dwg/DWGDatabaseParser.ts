/**
 * DWG Database Parser Service
 * Owner: George
 *
 * Service for parsing DWG files using LibreDWG converter with AcDbDatabase API
 * This provides access to block definitions and INSERT entity resolution
 */

import { createModule } from '@mlightcad/libredwg-web';
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter';
import { AcDbDatabase, acdbHostApplicationServices } from '@mlightcad/data-model';
import { DWGImportError } from './errors';
import { DWGErrorType, DWGImportProgress } from './types';

/**
 * Result of DWG database parsing
 */
export interface DWGDatabaseParseResult {
  database: AcDbDatabase;
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
 * Extended database interface with runtime properties not in TypeScript definitions
 * The @mlightcad/data-model types are incomplete, so we extend them here
 */
interface ExtendedAcDbDatabase extends AcDbDatabase {
  tables: {
    blockTable: any;
    layerTable: any;
  };
}

/**
 * Service for parsing DWG files with block definition support
 */
export class DWGDatabaseParser {
  private libredwgModule: any | null = null;
  private converter: AcDbLibreDwgConverter | null = null;
  private isInitialized = false;
  private splineErrorCount = 0;
  private unhandledRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

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

      // Create converter with worker URL configuration
      this.converter = new AcDbLibreDwgConverter({
        parserWorkerUrl: '/libredwg-parser-worker.js'
      });

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

      // Create new database and use converter to populate it
      console.log(`[DWG Database Parser] Converting ${fileName}...`);
      const database = new AcDbDatabase() as ExtendedAcDbDatabase;

      // Set as working database (required by the converter)
      const hostServices = acdbHostApplicationServices();
      let previousWorkingDb: AcDbDatabase | null = null;
      try {
        previousWorkingDb = hostServices.workingDatabase;
      } catch {
        // No working database set yet, that's fine
      }
      hostServices.workingDatabase = database;

      // Track warnings during conversion
      const warnings: string[] = [];

      // Set up global handler for unhandled promise rejections from the converter library
      // The @mlightcad/libredwg-converter throws unhandled rejections for invalid splines
      this.splineErrorCount = 0;
      this.unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
        const error = event.reason;
        const errorMsg = error?.message || String(error);

        if (errorMsg.includes('Invalid knot vector') ||
            errorMsg.includes('Illegal Parameters') ||
            errorMsg.includes('ILLEGAL_PARAMETERS')) {
          // Suppress these specific errors from the converter library
          event.preventDefault();
          this.splineErrorCount++;

          if (this.splineErrorCount <= 3) {
            console.warn(`[DWG Parser] Skipping invalid spline entity (${this.splineErrorCount})`);
          }
        }
      };
      window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);

      // Convert using the converter's read method
      // Note: Some entities (especially complex splines) may fail to convert due to
      // invalid geometry data. We catch these and continue with other entities.
      try {
        await this.converter!.read(
          fileBuffer,
          database,
          100, // minimumChunkSize for batch processing
          async (percentage, stage, stageStatus, _data, error) => {
            // Map converter progress to our progress format
            onProgress?.({
              percent: Math.floor(30 + (percentage * 0.4)), // 30-70% range
              message: `${stage}: ${stageStatus}`,
              stage: 'converting'
            });

            if (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.warn(`[DWG Database Parser] ${stage} warning:`, errorMsg);

              // Track warnings for reporting
              if (errorMsg.includes('Invalid knot vector') ||
                  errorMsg.includes('Illegal Parameters')) {
                warnings.push(`Skipped invalid spline entity (${errorMsg.substring(0, 50)}...)`);
              } else {
                warnings.push(`${stage}: ${errorMsg}`);
              }
            }
          }
        );

        console.log(`[DWG Database Parser] Conversion completed with ${warnings.length} warnings`);

        // Report spline errors if any occurred
        if (this.splineErrorCount > 0) {
          warnings.push(`${this.splineErrorCount} spline entities skipped due to invalid geometry`);
          console.warn(`[DWG Parser] ${this.splineErrorCount} spline entities could not be converted`);
        }
      } catch (conversionError) {
        // Restore previous working database
        if (previousWorkingDb) {
          hostServices.workingDatabase = previousWorkingDb;
        }

        const convMsg = conversionError instanceof Error ?
          conversionError.message : String(conversionError);

        // Check if this is a spline-related error that we can ignore
        if (convMsg.includes('Invalid knot vector') || convMsg.includes('Illegal Parameters')) {
          console.warn(`[DWG Database Parser] Ignoring spline conversion error, continuing...`);
          warnings.push('Some spline entities could not be converted due to invalid geometry');
        } else {
          // This is a fatal error
          throw new DWGImportError(
            DWGErrorType.UnsupportedVersion,
            `Failed to convert DWG file: ${fileName}\n\n${convMsg}\n\n` +
            'The file may be corrupted, use an unsupported DWG version, or have encoding issues.',
            false,
            conversionError instanceof Error ? conversionError : undefined
          );
        }
      }

      // Clean up unhandled rejection handler
      if (this.unhandledRejectionHandler) {
        window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
        this.unhandledRejectionHandler = null;
      }

      // Restore previous working database after successful conversion
      if (previousWorkingDb) {
        hostServices.workingDatabase = previousWorkingDb;
      }

      // Verify database was populated
      if (!database.tables?.blockTable) {
        console.error('[DWG Database Parser] Database structure:', database);
        throw new DWGImportError(
          DWGErrorType.UnsupportedVersion,
          `Failed to initialize DWG database for: ${fileName}\n\n` +
          'The conversion completed but the database is invalid. This may indicate:\n' +
          '- Unsupported DWG version (AC1027/AutoCAD 2013 is supported)\n' +
          '- Corrupted file\n' +
          '- Missing required data structures\n\n' +
          'Error code from parser: Check browser console for details.',
          false
        );
      }

      // Report progress: Analyzing
      onProgress?.({
        percent: 50,
        message: 'Analyzing database structure...',
        stage: 'converting'
      });

      // Extract entity count from modelspace and paperspace
      let entityCount = 0;
      const entityTypes = new Set<string>();

      // Debug: Log database structure
      console.log('[DWG Database Parser] Database structure:', {
        hasTables: !!database.tables,
        hasBlockTable: !!database.tables?.blockTable,
        hasModelSpace: !!database.tables?.blockTable?.modelSpace,
        modelSpaceType: typeof database.tables?.blockTable?.modelSpace,
        modelSpaceKeys: database.tables?.blockTable?.modelSpace
          ? Object.keys(database.tables.blockTable.modelSpace)
          : []
      });

      // Get modelspace block
      const modelSpace = database.tables.blockTable.modelSpace;
      if (modelSpace) {
        console.log('[DWG Database Parser] ModelSpace details:', {
          hasEntities: !!modelSpace.entities,
          entitiesIsArray: Array.isArray(modelSpace.entities),
          entitiesLength: modelSpace.entities?.length,
          modelSpaceProps: Object.keys(modelSpace)
        });

        if (modelSpace.entities && Array.isArray(modelSpace.entities)) {
          for (const entity of modelSpace.entities) {
            entityCount++;
            const typeName = entity.isA().name();
            entityTypes.add(typeName);
          }
        }
      } else {
        console.warn('[DWG Database Parser] ModelSpace is null or undefined');
      }

      // Get paperspace and user-defined blocks
      const blockNames: string[] = [];
      const blockCount = 0;

      // TODO: Implement block iteration using the correct API
      // For now, skip this as we have modelSpace entities
      console.log('[DWG Database Parser] Skipping block iteration - only processing modelSpace');
      warnings.push('Block table iteration not yet implemented - only modelSpace entities counted');

      // Extract layers
      const layers = new Map();
      // TODO: Implement layer iteration using the correct API
      console.log('[DWG Database Parser] Skipping layer iteration');
      warnings.push('Layer table iteration not yet implemented');

      // Extract header info - need to check if header exists and has these properties
      const header = {
        version: undefined as string | undefined,
        acadVersion: undefined as string | undefined,
        dwgCodePage: undefined as string | undefined
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
        warnings: Array.from(new Set(warnings)) // Deduplicate warnings
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
