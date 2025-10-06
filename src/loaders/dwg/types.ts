/**
 * DWG Loader Types and Interfaces
 * Owner: George
 *
 * Type definitions for DWG file loading and parsing using LibreDWG
 */

import { DwgDatabase } from '@mlightcad/libredwg-web';

/**
 * DWG error types following kinetiCORE error pattern
 */
export enum DWGErrorType {
  /** LibreDWG WASM module failed to load */
  WASMNotLoaded = 'WASM_NOT_LOADED',

  /** File could not be read or parsed */
  FileReadError = 'FILE_READ_ERROR',

  /** DWG version not supported by LibreDWG */
  UnsupportedVersion = 'UNSUPPORTED_VERSION',

  /** DWG file is corrupted or invalid */
  CorruptedFile = 'CORRUPTED_FILE',

  /** No valid entities found in DWG */
  NoEntities = 'NO_ENTITIES',

  /** Conversion to Babylon.js meshes failed */
  ConversionError = 'CONVERSION_ERROR',

  /** Unknown error during loading */
  Unknown = 'UNKNOWN'
}

/**
 * DWG loading progress callback
 */
export interface DWGImportProgress {
  /** Progress percentage (0-100) */
  percent: number;

  /** Human-readable message */
  message: string;

  /** Current stage of loading */
  stage: 'parsing' | 'converting' | 'loading';

  /** Number of entities processed */
  entitiesProcessed?: number;

  /** Total number of entities */
  totalEntities?: number;
}

/**
 * DWG file header information
 */
export interface DWGHeader {
  /** DWG version (e.g., "AC1027" for AutoCAD 2013) */
  version?: string;

  /** AutoCAD version string */
  acadVersion?: string;

  /** Code page for text encoding */
  dwgCodePage?: string;

  /** Drawing units */
  units?: string;

  /** Drawing bounds */
  bounds?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

/**
 * DWG entity base interface
 */
export interface DWGEntity {
  /** Entity type (LINE, LWPOLYLINE, CIRCLE, etc.) */
  type: string;

  /** Entity handle (unique ID) */
  handle: string;

  /** Layer name */
  layer: string;

  /** Color index (0-256) */
  colorIndex: number;

  /** Line type */
  lineType: string;

  /** Line weight */
  lineweight: number;

  /** Visibility flag */
  isVisible: boolean;
}

/**
 * DWG layer information
 */
export interface DWGLayer {
  /** Layer name */
  name: string;

  /** Layer color */
  color: number;

  /** Layer is frozen */
  frozen: boolean;

  /** Layer is locked */
  locked: boolean;

  /** Layer is visible */
  visible: boolean;
}

/**
 * DWG parsing result
 */
export interface DWGParseResult {
  /** Parsed database */
  database: DwgDatabase;

  /** Header information */
  header: DWGHeader;

  /** Number of entities */
  entityCount: number;

  /** Entity types found */
  entityTypes: string[];

  /** Layer information */
  layers: Map<string, DWGLayer>;

  /** Warning messages */
  warnings: string[];

  /** Error code from LibreDWG (0 = success) */
  errorCode?: number;
}

/**
 * DWG loader options
 */
export interface DWGLoaderOptions {
  /** Convert to Z-up coordinate system (kinetiCORE standard) */
  convertToZUp?: boolean;

  /** Unit conversion factor (mm to meters) */
  unitScale?: number;

  /** Filter entities by layer */
  layerFilter?: string[];

  /** Filter entities by type */
  entityTypeFilter?: string[];

  /** Simplify geometry for performance */
  simplifyGeometry?: boolean;

  /** Progress callback */
  onProgress?: (progress: DWGImportProgress) => void;
}

/**
 * LibreDWG error codes
 * Reference: https://www.gnu.org/software/libredwg/
 */
export const LIBREDWG_ERROR_CODES: Record<number, string> = {
  0: 'Success',
  1: 'Invalid file header',
  2: 'Invalid file version',
  3: 'Invalid file size',
  4: 'CRC error',
  8: 'Unsupported version',
  16: 'Out of memory',
  32: 'Read error',
  64: 'Write error',
  68: 'Partially supported version or corrupted data',
  128: 'Invalid input',
  256: 'Unknown error'
};
