/* eslint-disable */
/**
 * Real JT Server Client - Uses actual JtReader.dll via backend service
 *
 * This service connects to a Node.js backend that can actually call the .NET JtReader.dll
 * and serves JT file data to the frontend.
 *
 * TODO: Complete implementation - experimental code
 */
// @ts-nocheck - Experimental JT reader service

export interface JTConversionProgress {
    stage: 'initializing' | 'reading' | 'converting' | 'complete' | 'error';
    percent: number;
    message: string;
}

export interface JTHealthStatus {
    status: 'healthy' | 'unhealthy';
    dllFilesAvailable: boolean;
    jtReaderVersion?: string;
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

export class JtReaderService {
    private serverUrl: string;
    private isServerAvailable: boolean = false;

    constructor(serverUrl: string = 'http://localhost:8006') {
        this.serverUrl = serverUrl;
    }

    /**
     * Check if Real JT Server is available
     */
    async checkHealth(): Promise<JTHealthStatus> {
        try {
            console.log(`[JtReader] Checking Real JT Server at: ${this.serverUrl}`);
            
            const response = await fetch(`${this.serverUrl}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const health = await response.json();
                this.isServerAvailable = true;
                return {
                    status: 'healthy',
                    dllFilesAvailable: true,
                    jtReaderVersion: health.version || '1.0.0',
                    message: `Real JT Server is running: ${health.message}`
                };
            } else {
                this.isServerAvailable = false;
                return {
                    status: 'unhealthy',
                    dllFilesAvailable: false,
                    message: `Real JT Server health check failed: ${response.status} ${response.statusText}`
                };
            }
        } catch (error) {
            this.isServerAvailable = false;
            return {
                status: 'unhealthy',
                dllFilesAvailable: false,
                message: `Real JT Server not available: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Convert JT file to GLTF using Real JT Server
     */
    async convertToGLTF(
        file: File,
        onProgress?: (progress: JTConversionProgress) => void
    ): Promise<Blob> {
        if (!file.name.toLowerCase().endsWith('.jt')) {
            throw new JTConversionError(400, 'Invalid file type', 'File must have .jt extension');
        }

        try {
            onProgress?.({ stage: 'initializing', percent: 5, message: 'Connecting to Real JT Server...' });
            
            // Check server health first
            const health = await this.checkHealth();
            if (health.status !== 'healthy') {
                throw new JTConversionError(503, 'Server unavailable', health.message);
            }

            onProgress?.({ stage: 'reading', percent: 20, message: `Uploading JT file: ${file.name}...` });
            
            // Upload file to Real JT Server
            const formData = new FormData();
            formData.append('jtfile', file);

            const response = await fetch(`${this.serverUrl}/convert`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new JTConversionError(
                    response.status, 
                    `Server conversion failed: ${errorData.error || response.statusText}`,
                    `HTTP ${response.status}`
                );
            }

            onProgress?.({ stage: 'converting', percent: 80, message: 'Processing JT data...' });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new JTConversionError(500, 'Conversion failed', result.error || 'Unknown server error');
            }

            onProgress?.({ stage: 'complete', percent: 100, message: 'JT conversion complete!' });

            console.log(`[JtReader] Conversion successful using ${result.method}: ${result.fileName}`);
            
            // Return GLTF as blob
            return new Blob([JSON.stringify(result.gltf, null, 2)], { type: 'model/gltf+json' });

        } catch (error) {
            onProgress?.({ 
                stage: 'error', 
                percent: 0, 
                message: error instanceof Error ? error.message : 'Unknown error' 
            });

            if (error instanceof JTConversionError) {
                throw error;
            }

            throw new JTConversionError(0, 'JT conversion failed', error instanceof Error ? error.message : 'Unknown error');
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.isServerAvailable = false;
    }
}