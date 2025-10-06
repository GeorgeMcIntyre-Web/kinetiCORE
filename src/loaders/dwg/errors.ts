/**
 * DWG Loader Error Classes
 * Owner: George
 *
 * Custom error classes for DWG loading failures
 */

import { DWGErrorType } from './types';

/**
 * Base error class for DWG import failures
 * Follows pattern from JTImportError
 */
export class DWGImportError extends Error {
  constructor(
    public type: DWGErrorType,
    message: string,
    public recoverable: boolean = false,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DWGImportError';

    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DWGImportError);
    }
  }

  /**
   * Get user-friendly error message with recovery suggestions
   */
  getUserMessage(): string {
    let message = this.message;

    // Add recovery suggestions based on error type
    switch (this.type) {
      case DWGErrorType.WASMNotLoaded:
        message += '\n\nSuggestion: Refresh the page and try again.';
        break;

      case DWGErrorType.UnsupportedVersion:
        message += '\n\nSuggestion: Try saving the DWG file in an older format ' +
                   '(AutoCAD 2013/R2013 or earlier) and import again.';
        break;

      case DWGErrorType.CorruptedFile:
        message += '\n\nSuggestion: Open the file in AutoCAD and use RECOVER ' +
                   'command, then save and try importing again.';
        break;

      case DWGErrorType.NoEntities:
        message += '\n\nSuggestion: Check if the DWG file contains visible geometry. ' +
                   'Try unfreezing all layers and making them visible.';
        break;

      case DWGErrorType.FileReadError:
        message += '\n\nSuggestion: Check file permissions and ensure the file is ' +
                   'not corrupted or locked by another application.';
        break;
    }

    return message;
  }

  /**
   * Create error from LibreDWG error code
   */
  static fromLibreDWGError(errorCode: number, fileName: string): DWGImportError | null {
    let type: DWGErrorType;
    let message: string;
    let recoverable = false;

    switch (errorCode) {
      case 0:
        return null; // No error

      case 1:
      case 2:
      case 3:
        type = DWGErrorType.CorruptedFile;
        message = `Invalid DWG file: ${fileName}\n` +
                  `The file header or structure is corrupted.`;
        break;

      case 8:
        type = DWGErrorType.UnsupportedVersion;
        message = `Unsupported DWG version: ${fileName}\n` +
                  `LibreDWG cannot read this DWG version.\n` +
                  `Supported versions: AutoCAD R13 (1994) through R2021.`;
        break;

      case 68:
        // Error 68 is common - partially supported version
        type = DWGErrorType.UnsupportedVersion;
        message = `Partially supported DWG version: ${fileName}\n` +
                  `Some features may not load correctly.\n` +
                  `This file may use newer DWG features not fully supported by LibreDWG.`;
        recoverable = true; // Can continue with warnings
        break;

      case 16:
        type = DWGErrorType.Unknown;
        message = `Out of memory while loading: ${fileName}\n` +
                  `The file may be too large or complex.`;
        break;

      case 32:
        type = DWGErrorType.FileReadError;
        message = `Failed to read DWG file: ${fileName}\n` +
                  `Check file permissions and integrity.`;
        break;

      default:
        type = DWGErrorType.Unknown;
        message = `Unknown error loading DWG file: ${fileName}\n` +
                  `LibreDWG error code: ${errorCode}`;
        break;
    }

    return new DWGImportError(type, message, recoverable);
  }
}
