/**
 * DWG Loader - AutoCAD DWG file import
 * Owner: George
 *
 * Exports all public APIs for DWG loading
 */

// Main loader function
export { loadDWGFromFile, isDWGLoaderAvailable, preInitializeDWGLoader, disposeDWGLoader } from './DWGLoader';

// Types
export type {
  DWGLoaderOptions,
  DWGImportProgress,
  DWGParseResult,
  DWGHeader,
  DWGEntity,
  DWGLayer
} from './types';

export { DWGErrorType, LIBREDWG_ERROR_CODES } from './types';

// Errors
export { DWGImportError } from './errors';

// Services (for advanced usage)
export { DWGParserService } from './DWGParserService';
export { DWGToBabylonConverter } from './DWGToBabylonConverter';
