/**
 * JT Conversion Service - Frontend client for PyOpenJt backend
 * Handles JT to GLB conversion via HTTP API
 */

export interface ConversionProgress {
    stage: 'uploading' | 'converting' | 'downloading' | 'complete' | 'error';
    percent: number;
    message: string;
}

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    pyopenjt_built: boolean;
    message: string;
}

export class JTConversionError extends Error {
    constructor(
        public code: number,
        message: string,
        public details?: string
    ) {
        super(message);
        this.name = 'JTConversionError';
    }
}

export class JTConversionService {
    private apiUrl: string;
    private healthCheckCache: { status: HealthStatus; timestamp: number } | null = null;
    private readonly HEALTH_CACHE_MS = 30000; // Cache health check for 30 seconds

    constructor(apiUrl: string = 'http://localhost:8000') {
        this.apiUrl = apiUrl;
    }

    /**
     * Check if the conversion backend is available and healthy
     */
    async checkHealth(): Promise<HealthStatus> {
        // Return cached result if available and fresh
        const now = Date.now();
        if (this.healthCheckCache && (now - this.healthCheckCache.timestamp) < this.HEALTH_CACHE_MS) {
            return this.healthCheckCache.status;
        }

        try {
            const response = await fetch(`${this.apiUrl}/health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }

            const data = await response.json();
            const status: HealthStatus = {
                status: data.status || 'unhealthy',
                pyopenjt_built: data.pyopenjt_built || false,
                message: data.message || 'Unknown status'
            };

            // Cache the result
            this.healthCheckCache = {
                status,
                timestamp: now
            };

            return status;

        } catch (error) {
            const errorStatus: HealthStatus = {
                status: 'unhealthy',
                pyopenjt_built: false,
                message: `Backend not reachable: ${error instanceof Error ? error.message : 'Unknown error'}`
            };

            return errorStatus;
        }
    }

    /**
     * Convert JT file to GLB format
     *
     * @param file - JT file to convert
     * @param onProgress - Optional progress callback
     * @returns Promise resolving to GLB blob
     * @throws {JTConversionError} If conversion fails
     */
    async convertToGLB(
        file: File,
        onProgress?: (progress: ConversionProgress) => void
    ): Promise<Blob> {
        // Validate file
        if (!file.name.toLowerCase().endsWith('.jt')) {
            throw new JTConversionError(
                400,
                'Invalid file type',
                'File must have .jt extension'
            );
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Stage 1: Uploading
            onProgress?.({
                stage: 'uploading',
                percent: 10,
                message: `Uploading ${file.name}...`
            });

            const response = await fetch(`${this.apiUrl}/convert/jt-to-glb`, {
                method: 'POST',
                body: formData,
            });

            // Stage 2: Converting
            onProgress?.({
                stage: 'converting',
                percent: 50,
                message: 'Converting JT to GLB...'
            });

            if (!response.ok) {
                let errorMessage = `Conversion failed: ${response.status} ${response.statusText}`;
                let errorDetails: string | undefined;

                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        errorDetails = errorData.detail;
                        errorMessage = errorDetails;
                    }
                } catch {
                    // If error response is not JSON, use status text
                    errorDetails = await response.text();
                }

                throw new JTConversionError(response.status, errorMessage, errorDetails);
            }

            // Stage 3: Downloading
            onProgress?.({
                stage: 'downloading',
                percent: 75,
                message: 'Downloading GLB...'
            });

            const glbBlob = await response.blob();

            // Validate blob
            if (glbBlob.size === 0) {
                throw new JTConversionError(
                    500,
                    'Conversion produced empty file',
                    'The converted GLB file has zero size'
                );
            }

            // Stage 4: Complete
            onProgress?.({
                stage: 'complete',
                percent: 100,
                message: 'Conversion complete!'
            });

            return glbBlob;

        } catch (error) {
            // Report error stage
            const errorMessage = error instanceof JTConversionError
                ? error.message
                : error instanceof Error
                    ? error.message
                    : 'Unknown error';

            onProgress?.({
                stage: 'error',
                percent: 0,
                message: errorMessage
            });

            // Re-throw JTConversionError as-is
            if (error instanceof JTConversionError) {
                throw error;
            }

            // Wrap other errors
            throw new JTConversionError(
                0,
                'JT conversion failed',
                errorMessage
            );
        }
    }

    /**
     * Get helpful error message for users
     */
    static getHelpfulErrorMessage(error: JTConversionError): string {
        if (error.code === 0) {
            return `Cannot reach JT conversion server.\n\n` +
                `Please ensure the PyOpenJt backend is running:\n` +
                `1. Open PowerShell/Command Prompt\n` +
                `2. cd C:\\Users\\George\\source\\repos\\PyOpenJt\\Server\n` +
                `3. python JtConversionServer.py\n\n` +
                `The server should start at http://localhost:8000`;
        }

        if (error.code === 503) {
            return `PyOpenJt is not built yet.\n\n` +
                `Please build PyOpenJt first:\n` +
                `1. Install VCPKG and CMake\n` +
                `2. Open PowerShell in Administrator mode\n` +
                `3. cd C:\\Users\\George\\source\\repos\\PyOpenJt\n` +
                `4. .\\Setup.bat\n` +
                `5. Open WinBuild\\PyOpenJt.sln in Visual Studio\n` +
                `6. Build in Release mode\n\n` +
                `See PyOpenJt_SETUP_GUIDE.md for details.`;
        }

        return error.message + (error.details ? `\n\nDetails: ${error.details}` : '');
    }
}
