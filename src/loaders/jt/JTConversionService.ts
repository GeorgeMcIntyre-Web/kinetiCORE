/**
 * JT Conversion Service - Frontend client for C++ JT Wrapper backend
 * Handles JT to GLB conversion via HTTP API using lineSim JT libraries
 */

export interface ConversionProgress {
    stage: 'uploading' | 'converting' | 'downloading' | 'complete' | 'error';
    percent: number;
    message: string;
}

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    wrapper_available: boolean;
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
                wrapper_available: data.wrapper_available || false,
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
                wrapper_available: false,
                message: `Backend not reachable: ${error instanceof Error ? error.message : 'Unknown error'}`
            };

            return errorStatus;
        }
    }

    /**
     * Convert JT file to GLTF format
     *
     * @param file - JT file to convert
     * @param onProgress - Optional progress callback
     * @returns Promise resolving to GLTF blob
     * @throws {JTConversionError} If conversion fails
     */
    async convertToGLTF(
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
                message: 'Converting JT to GLTF...'
            });

            if (!response.ok) {
                let errorMessage = `Conversion failed: ${response.status} ${response.statusText}`;
                let errorDetails: string | undefined;

                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        errorDetails = errorData.detail;
                        errorMessage = errorDetails || errorMessage;
                    }
                } catch {
                    // If error response is not JSON, use status text
                    errorDetails = await response.text();
                }

                throw new JTConversionError(response.status, errorMessage, errorDetails || '');
            }

            // Stage 3: Downloading
            onProgress?.({
                stage: 'downloading',
                percent: 75,
                message: 'Downloading GLTF...'
            });

            const gltfBlob = await response.blob();
            
            // Preserve content type from response
            const contentType = response.headers.get('content-type') || '';
            if (contentType) {
                Object.defineProperty(gltfBlob, 'type', {
                    value: contentType,
                    writable: false
                });
            }

            // Validate blob
            if (gltfBlob.size === 0) {
                throw new JTConversionError(
                    500,
                    'Conversion produced empty file',
                    'The converted file has zero size'
                );
            }

            // Stage 4: Complete
            onProgress?.({
                stage: 'complete',
                percent: 100,
                message: 'Conversion complete!'
            });

            return gltfBlob;

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
                `Please ensure the C++ JT Wrapper server is running:\n` +
                `1. Build the wrapper: run build.bat\n` +
                `2. Start the server: python jt_conversion_server.py\n` +
                `3. The server should start at http://localhost:8000\n\n` +
                `See README.md for detailed setup instructions.`;
        }

        if (error.code === 503) {
            return `JT Converter Wrapper is not available.\n\n` +
                `Please build the C++ wrapper first:\n` +
                `1. Install Visual Studio 2019/2022 with C++ tools\n` +
                `2. Install CMake 3.20+\n` +
                `3. Ensure JT libraries are in C:\\Users\\George\\source\\repos\\lineSim\\lib3\\\n` +
                `4. Run: build.bat\n` +
                `5. Start server: python jt_conversion_server.py\n\n` +
                `See README.md for detailed setup instructions.`;
        }

        return error.message + (error.details ? `\n\nDetails: ${error.details}` : '');
    }
}
