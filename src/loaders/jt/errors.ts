/**
 * Error handling for JT file imports
 * Supports JT versions 8.0 through 10.x
 */

import { JTErrorType } from './types';

// Re-export JTErrorType so other modules can import it from errors.ts
export { JTErrorType };

export class JTImportError extends Error {
    constructor(
        public type: JTErrorType,
        public details: string,
        public recoverable: boolean = false
    ) {
        super(`JT Import Error: ${details}`);
        this.name = 'JTImportError';

        // Maintain proper stack trace for where error was thrown (V8 only)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, JTImportError);
        }
    }

    /**
     * Check if this error is recoverable and import can continue
     */
    isRecoverable(): boolean {
        return this.recoverable;
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage(): string {
        switch (this.type) {
            case JTErrorType.UnsupportedVersion:
                return 'This JT file version is not supported. Please use JT version 8.0 or higher.';
            case JTErrorType.CorruptedFile:
                return 'The JT file appears to be corrupted or invalid.';
            case JTErrorType.MissingGeometry:
                return 'No valid geometry was found in the JT file.';
            case JTErrorType.InvalidLOD:
                return 'The requested LOD level is not available in this file.';
            case JTErrorType.WASMNotLoaded:
                return 'JT import requires JT Open Toolkit WASM module. See documentation for setup instructions.';
            default:
                return 'An unknown error occurred while importing the JT file.';
        }
    }
}
