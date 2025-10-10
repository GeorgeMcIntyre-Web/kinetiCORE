import * as BABYLON from '@babylonjs/core';
import { JTImportError, JTErrorType } from './errors';
import { JtReaderService, JTConversionError as JtReaderError } from './JtReaderService';

/**
 * Load JT file and convert to Babylon.js meshes
 */
export async function loadJTFromFile(
    file: File,
    scene: BABYLON.Scene
): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
    // Use ONLY JtReader.dll service
    const converter = new JtReaderService();

    try {
        // Check if backend is available with retry logic
        let health: any;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                health = await converter.checkHealth();
                break;
            } catch (error) {
                retryCount++;
                if (retryCount >= maxRetries) {
                    throw error;
                }
                console.warn(`[JT Import] Health check failed (attempt ${retryCount}), retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (health.status !== 'healthy') {
            throw new JTImportError(
                JTErrorType.WASMNotLoaded,
                `JT conversion services are not available. Health check failed: ${health.message}\n\nPlease ensure at least one JT conversion service is running:\n\nNative Service:\n1. Check DLL files in: C:\\Users\\georgem\\source\\repos\\kinetiCORE_JT_Server_Complete\\ls\\lib3\n2. Verify JtReader.dll, Jt951.dll, etc. are present\n\nPython Service:\n1. Start PyOpenJt server: cd C:\\Users\\georgem\\source\\repos\\PyOpenJt\\Server\n2. Run: python JtConversionServer.py\n3. Server should be at http://localhost:8005\n\nSee PyOpenJt_SETUP_GUIDE.md for setup instructions.`,
                false
            );
        }

        console.log(`[JT Import] Converting ${file.name} to GLTF...`);

        const gltfBlob = await converter.convertToGLTF(file, (progress) => {
            console.log(`[JT Import] ${progress.message} (${progress.percent}%)`);
            // TODO: Show progress in UI via LoadingIndicator
        });

        console.log(`[JT Import] Conversion complete, loading GLTF directly...`);

        // JtReaderService already returns a complete GLTF JSON, load it directly
        try {
            // Create a temporary URL for the GLTF blob
            const gltfUrl = URL.createObjectURL(gltfBlob);
            const rootUrl = gltfUrl.substring(0, gltfUrl.lastIndexOf('/') + 1);
            const fileName = gltfUrl.substring(gltfUrl.lastIndexOf('/') + 1);
            
            console.log(`[JT Import] Loading GLTF directly from JtReaderService...`);
            
            // Load the GLTF directly into Babylon.js
            const result = await BABYLON.SceneLoader.AppendAsync(
                rootUrl,
                fileName,
                scene,
                undefined,
                '.gltf'
            );
            
            // Clean up the temporary URL
            URL.revokeObjectURL(gltfUrl);
            
            console.log(`[JT Import] Loaded ${result.meshes.length} meshes, ${result.transformNodes.length} transform nodes from JtReaderService GLTF`);

            // Debug: Log mesh names and details
            result.meshes.forEach((mesh, index) => {
                console.log(`[JT Import] Mesh ${index}: ${mesh.name}, vertices: ${mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)?.length || 0}`);
            });
            
            result.transformNodes.forEach((node, index) => {
                console.log(`[JT Import] TransformNode ${index}: ${node.name}`);
            });

            // Process the loaded meshes
            const processedMeshes: BABYLON.AbstractMesh[] = [];
            const rootNodes: BABYLON.TransformNode[] = [];

            // Add JT metadata to all meshes
            result.meshes.forEach((mesh, index) => {
                if (mesh.name !== '__root__') {
                    // Add JT metadata
                    if (!mesh.metadata) {
                        mesh.metadata = {};
                    }
                    mesh.metadata.sourceFormat = 'jt';
                    mesh.metadata.originalFile = file.name;
                    mesh.metadata.convertedVia = 'JtReader.dll';

                    // Debug mesh properties
                    console.log(`[JT Import] Mesh "${mesh.name}":`, {
                        position: mesh.position,
                        rotation: mesh.rotation,
                        scaling: mesh.scaling,
                        isVisible: mesh.isVisible,
                        isEnabled: mesh.isEnabled,
                        material: mesh.material?.name || 'No material',
                        vertexCount: mesh.getTotalVertices(),
                        boundingInfo: mesh.getBoundingInfo()
                    });

                    processedMeshes.push(mesh);
                }
            });

            // Find root nodes (nodes with no parent or __root__ parent)
            result.transformNodes.forEach(node => {
                if (node.name !== '__root__' && (!node.parent || node.parent.name === '__root__')) {
                    rootNodes.push(node);
                }
            });

            console.log(`[JT Import] Processed JtReaderService GLTF: ${processedMeshes.length} meshes, ${rootNodes.length} root nodes`);

            return { meshes: processedMeshes, rootNodes: rootNodes };

        } catch (gltfError) {
            console.error('[JT Import] GLTF loading failed:', gltfError);
            throw new JTImportError(
                JTErrorType.CorruptedFile,
                `Failed to load GLTF from JtReaderService: ${gltfError instanceof Error ? gltfError.message : 'Unknown error'}`,
                false
            );
        }

    } catch (error) {
        // Handle conversion errors
        if (error instanceof JtReaderError) {
            throw new JTImportError(
                JTErrorType.CorruptedFile,
                `JtReader.dll error: ${error.message}`,
                false
            );
        }

        // Handle other errors
        if (error instanceof JTImportError) {
            throw error;
        }

        // Handle unknown errors
        console.error('[JT Import] Unknown error:', error);
        throw new JTImportError(
            JTErrorType.CorruptedFile,
            `Failed to import JT file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            false
        );
    }
}

export class JTLoader {
    /**
     * Load JT file
     */
    async loadJTFile(file: File, scene: BABYLON.Scene): Promise<BABYLON.AbstractMesh[]> {
        const result = await loadJTFromFile(file, scene);
        return result.meshes;
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        // No resources to dispose
    }
}