/**
 * Hybrid JT Conversion Service - Combines native DLL and Python backend approaches
 * 
 * This service provides the best of both worlds:
 * 1. Native DLL conversion for maximum performance and reliability
 * 2. Python backend fallback for compatibility and advanced features
 * 3. Automatic failover between methods
 */

import { JTConversionService, ConversionProgress } from './JTConversionService';
import { NativeJTConversionService, NativeConversionProgress } from './NativeJTConversionService';

export interface HybridConversionProgress {
    stage: 'initializing' | 'uploading' | 'converting' | 'downloading' | 'complete' | 'error';
    percent: number;
    message: string;
    method?: 'native' | 'python' | 'fallback';
    details?: string;
}

export interface HybridHealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    nativeAvailable: boolean;
    pythonAvailable: boolean;
    preferredMethod: 'native' | 'python';
    message: string;
}

export class HybridJTConversionError extends Error {
    constructor(
        public code: number,
        message: string,
        public details?: string,
        public method?: 'native' | 'python' | 'fallback'
    ) {
        super(message);
        this.name = 'HybridJTConversionError';
    }
}

export class HybridJTConversionService {
    private nativeService: NativeJTConversionService;
    private pythonService: JTConversionService;
    private healthCheckCache: { status: HybridHealthStatus; timestamp: number } | null = null;
    private readonly HEALTH_CACHE_MS = 30000; // Cache health check for 30 seconds

    constructor(
        nativeDllPath?: string,
        pythonApiUrl?: string
    ) {
        this.nativeService = new NativeJTConversionService(nativeDllPath);
        this.pythonService = new JTConversionService(pythonApiUrl);
    }

    /**
     * Check health of both native and Python services
     */
    async checkHealth(): Promise<HybridHealthStatus> {
        // Return cached result if available and fresh
        const now = Date.now();
        if (this.healthCheckCache && (now - this.healthCheckCache.timestamp) < this.HEALTH_CACHE_MS) {
            return this.healthCheckCache.status;
        }

        try {
            // Check both services in parallel
            const [nativeHealth, pythonHealth] = await Promise.allSettled([
                this.nativeService.checkHealth(),
                this.pythonService.checkHealth()
            ]);

            const nativeAvailable = nativeHealth.status === 'fulfilled' && 
                                  nativeHealth.value.status === 'healthy';
            const pythonAvailable = pythonHealth.status === 'fulfilled' && 
                                   pythonHealth.value.status === 'healthy';

            // Determine preferred method
            let preferredMethod: 'native' | 'python' = 'native';
            let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
            let message = '';

            if (nativeAvailable && pythonAvailable) {
                status = 'healthy';
                preferredMethod = 'native'; // Prefer native for performance
                message = 'Both native and Python JT conversion services available';
            } else if (nativeAvailable) {
                status = 'healthy';
                preferredMethod = 'native';
                message = 'Native JT conversion service available (Python service unavailable)';
            } else if (pythonAvailable) {
                status = 'degraded';
                preferredMethod = 'python';
                message = 'Python JT conversion service available (Native service unavailable)';
            } else {
                status = 'unhealthy';
                message = 'No JT conversion services available';
            }

            const healthStatus: HybridHealthStatus = {
                status,
                nativeAvailable,
                pythonAvailable,
                preferredMethod,
                message
            };

            // Cache the result
            this.healthCheckCache = {
                status: healthStatus,
                timestamp: now
            };

            return healthStatus;

        } catch (error) {
            const errorStatus: HybridHealthStatus = {
                status: 'unhealthy',
                nativeAvailable: false,
                pythonAvailable: false,
                preferredMethod: 'python',
                message: `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };

            return errorStatus;
        }
    }

    /**
     * Convert JT file to GLTF format using the best available method
     * 
     * @param file - JT file to convert
     * @param onProgress - Optional progress callback
     * @returns Promise resolving to GLTF blob
     * @throws {HybridJTConversionError} If conversion fails
     */
    async convertToGLTF(
        file: File,
        onProgress?: (progress: HybridConversionProgress) => void
    ): Promise<Blob> {
        // Validate file
        if (!file.name.toLowerCase().endsWith('.jt')) {
            throw new HybridJTConversionError(
                400,
                'Invalid file type',
                'File must have .jt extension'
            );
        }

        try {
            // Stage 1: Initialize and check health
            onProgress?.({
                stage: 'initializing',
                percent: 5,
                message: 'Initializing JT conversion service...'
            });

            const health = await this.checkHealth();
            
            if (health.status === 'unhealthy') {
                throw new HybridJTConversionError(
                    503,
                    'No JT conversion services available',
                    'Both native and Python services are unavailable'
                );
            }

            // Stage 2: Try preferred method first
            const method = health.preferredMethod;
            onProgress?.({
                stage: 'converting',
                percent: 20,
                message: `Converting using ${method} service...`,
                method
            });

            try {
                if (method === 'native' && health.nativeAvailable) {
                    return await this.convertWithNative(file, onProgress);
                } else if (method === 'python' && health.pythonAvailable) {
                    return await this.convertWithPython(file, onProgress);
                } else {
                    throw new Error(`Preferred method ${method} is not available`);
                }
            } catch (primaryError) {
                console.warn(`[Hybrid JT] Primary method ${method} failed, trying fallback:`, primaryError);
                
                // Stage 3: Try fallback method
                onProgress?.({
                    stage: 'converting',
                    percent: 40,
                    message: `Primary method failed, trying fallback...`,
                    method: 'fallback'
                });

                try {
                    if (method === 'native' && health.pythonAvailable) {
                        return await this.convertWithPython(file, onProgress);
                    } else if (method === 'python' && health.nativeAvailable) {
                        return await this.convertWithNative(file, onProgress);
                    } else {
                        throw primaryError; // Re-throw original error if no fallback available
                    }
                } catch (fallbackError) {
                    // Both methods failed
                    throw new HybridJTConversionError(
                        500,
                        'All JT conversion methods failed',
                        `Primary (${method}): ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}. ` +
                        `Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`,
                        'fallback'
                    );
                }
            }

        } catch (error) {
            // Report error stage
            const errorMessage = error instanceof HybridJTConversionError
                ? error.message
                : error instanceof Error
                    ? error.message
                    : 'Unknown error';

            onProgress?.({
                stage: 'error',
                percent: 0,
                message: errorMessage,
                method: error instanceof HybridJTConversionError ? error.method : undefined,
                details: error instanceof HybridJTConversionError ? error.details : undefined
            });

            // Re-throw HybridJTConversionError as-is
            if (error instanceof HybridJTConversionError) {
                throw error;
            }

            // Wrap other errors
            throw new HybridJTConversionError(
                0,
                'Hybrid JT conversion failed',
                errorMessage
            );
        }
    }

    /**
     * Convert using native DLL service
     */
    private async convertWithNative(
        file: File,
        onProgress?: (progress: HybridConversionProgress) => void
    ): Promise<Blob> {
        const nativeProgress = (progress: NativeConversionProgress) => {
            onProgress?.({
                stage: progress.stage === 'initializing' ? 'initializing' : 
                      progress.stage === 'reading' ? 'converting' :
                      progress.stage === 'converting' ? 'converting' :
                      progress.stage === 'processing' ? 'converting' :
                      progress.stage === 'complete' ? 'complete' : 'error',
                percent: progress.percent,
                message: progress.message,
                method: 'native',
                details: progress.details
            });
        };

        return await this.nativeService.convertToGLTF(file, nativeProgress);
    }

    /**
     * Convert using Python backend service
     */
    private async convertWithPython(
        file: File,
        onProgress?: (progress: HybridConversionProgress) => void
    ): Promise<Blob> {
        const pythonProgress = (progress: ConversionProgress) => {
            onProgress?.({
                stage: progress.stage,
                percent: progress.percent,
                message: progress.message,
                method: 'python'
            });
        };

        return await this.pythonService.convertToGLTF(file, pythonProgress);
    }

    /**
     * Set preferred conversion method
     */
    setPreferredMethod(method: 'native' | 'python'): void {
        // Clear cache to force re-evaluation
        this.healthCheckCache = null;
        console.log(`[Hybrid JT] Preferred method set to: ${method}`);
    }

    /**
     * Get helpful error message for users
     */
    static getHelpfulErrorMessage(error: HybridJTConversionError): string {
        if (error.code === 0) {
            return `JT conversion failed.\n\n` +
                `Please ensure at least one JT conversion service is available:\n\n` +
                `Native Service:\n` +
                `1. Check DLL files in: C:\\Users\\georgem\\source\\repos\\kinetiCORE_JT_Server_Complete\\ls\\lib3\n` +
                `2. Verify JtReader.dll, Jt951.dll, etc. are present\n\n` +
                `Python Service:\n` +
                `1. Start PyOpenJt server: cd C:\\Users\\georgem\\source\\repos\\PyOpenJt\\Server\n` +
                `2. Run: python JtConversionServer.py\n` +
                `3. Server should be at http://localhost:8005`;
        }

        if (error.code === 503) {
            return `No JT conversion services available.\n\n` +
                `Please set up at least one service:\n\n` +
                `Option 1 - Native DLL Service:\n` +
                `• Ensure JT DLL files are installed\n` +
                `• Check file permissions\n\n` +
                `Option 2 - Python Backend Service:\n` +
                `• Install PyOpenJt\n` +
                `• Start conversion server\n\n` +
                `See setup guides for detailed instructions.`;
        }

        return error.message + (error.details ? `\n\nDetails: ${error.details}` : '');
    }
}
