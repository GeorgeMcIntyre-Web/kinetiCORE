/**
 * JT JSON to GLTF Converter
 * Converts JT JSON output from JtDump.exe to GLTF format
 */

import * as BABYLON from '@babylonjs/core';

export interface JTJsonData {
    FileName: string;
    MajorVersion: string;
    MinorVersion: string;
    TocTable?: Array<[string, number, string]>; // [UUID, type, name]
    // Additional JT data structures would go here
}

export interface GLTFData {
    asset: {
        version: string;
        generator: string;
    };
    scene: number;
    scenes: Array<{
        nodes: number[];
    }>;
    nodes: Array<{
        mesh?: number;
        name?: string;
        translation?: [number, number, number];
        rotation?: [number, number, number, number];
        scale?: [number, number, number];
    }>;
    meshes: Array<{
        primitives: Array<{
            attributes: {
                POSITION: number;
                NORMAL?: number;
                TEXCOORD_0?: number;
            };
            indices?: number;
            material?: number;
        }>;
    }>;
    accessors: Array<{
        bufferView: number;
        componentType: number;
        count: number;
        type: string;
        min?: number[];
        max?: number[];
    }>;
    bufferViews: Array<{
        buffer: number;
        byteOffset: number;
        byteLength: number;
    }>;
    buffers: Array<{
        byteLength: number;
        uri?: string;
    }>;
    materials?: Array<{
        name?: string;
        pbrMetallicRoughness?: {
            baseColorFactor?: [number, number, number, number];
            metallicFactor?: number;
            roughnessFactor?: number;
        };
    }>;
}

export class JTJsonToGLTFConverter {
    private scene: BABYLON.Scene;
    
    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * Convert JT JSON to GLTF format
     */
    async convertJTJsonToGLTF(jtJsonData: JTJsonData): Promise<GLTFData> {
        console.log('[JT Converter] Converting JT JSON to GLTF...');
        console.log('[JT Converter] JT JSON data:', jtJsonData);
        
        // Validate input data
        if (!jtJsonData) {
            throw new Error('JT JSON data is null or undefined');
        }
        
        // Extract filename safely
        const fileName = this.extractFileName(jtJsonData.FileName);
        console.log('[JT Converter] Extracted filename:', fileName);
        
        // For now, create a simple GLTF structure
        // In a full implementation, we would parse the JT data and extract:
        // - Mesh geometry (vertices, faces)
        // - Materials and textures
        // - Transform hierarchies
        // - LOD information
        
        // Create buffer data for a simple cube (placeholder for now)
        const { positions, normals, indices } = this.createCubeData();

        // Calculate buffer sizes with proper alignment
        const positionByteLength = positions.byteLength;
        const normalByteLength = normals.byteLength;
        const indexByteLength = indices.byteLength;

        // Align to 4-byte boundaries (GLTF requirement)
        const alignedPositionSize = Math.ceil(positionByteLength / 4) * 4;
        const alignedNormalSize = Math.ceil(normalByteLength / 4) * 4;
        const alignedIndexSize = Math.ceil(indexByteLength / 4) * 4;

        const totalBufferSize = alignedPositionSize + alignedNormalSize + alignedIndexSize;

        console.log('[JT Converter] Buffer calculations:', {
            positionByteLength, normalByteLength, indexByteLength,
            alignedPositionSize, alignedNormalSize, alignedIndexSize,
            totalBufferSize,
            vertexCount: positions.length / 3,
            normalCount: normals.length / 3,
            indexCount: indices.length
        });

        const gltfData: GLTFData = {
            asset: {
                version: "2.0",
                generator: "kinetiCORE JT Converter"
            },
            scene: 0,
            scenes: [{
                nodes: [0]
            }],
            nodes: [{
                mesh: 0,
                name: fileName,
                translation: [0, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1]
            }],
            meshes: [{
                primitives: [{
                    attributes: {
                        POSITION: 0,
                        NORMAL: 1
                    },
                    indices: 2,
                    material: 0
                }]
            }],
            accessors: [
                {
                    bufferView: 0,
                    componentType: 5126, // FLOAT
                    count: positions.length / 3, // Dynamic vertex count
                    type: "VEC3",
                    min: [-0.5, -0.5, -0.5],
                    max: [0.5, 0.5, 0.5]
                },
                {
                    bufferView: 1,
                    componentType: 5126, // FLOAT
                    count: normals.length / 3, // Dynamic normal count
                    type: "VEC3"
                },
                {
                    bufferView: 2,
                    componentType: 5123, // UNSIGNED_SHORT
                    count: indices.length, // Dynamic index count
                    type: "SCALAR"
                }
            ],
            bufferViews: [
                {
                    buffer: 0,
                    byteOffset: 0,
                    byteLength: alignedPositionSize
                },
                {
                    buffer: 0,
                    byteOffset: alignedPositionSize,
                    byteLength: alignedNormalSize
                },
                {
                    buffer: 0,
                    byteOffset: alignedPositionSize + alignedNormalSize,
                    byteLength: alignedIndexSize
                }
            ],
            buffers: [{
                byteLength: totalBufferSize
            }],
            materials: [{
                name: "JT_Material",
                pbrMetallicRoughness: {
                    baseColorFactor: [0.7, 0.7, 0.7, 1.0],
                    metallicFactor: 0.0,
                    roughnessFactor: 0.5
                }
            }]
        };

        console.log('[JT Converter] GLTF structure created');
        return gltfData;
    }

    /**
     * Create a GLTF file from the data structure
     */
    async createGLTFFile(gltfData: GLTFData): Promise<Blob> {
        console.log('[JT Converter] Creating GLTF file...');
        
        // Create binary data for the buffer
        const bufferData = this.createBufferData();
        
        // Create a data URI with embedded binary data
        const base64Data = this.arrayBufferToBase64(bufferData);
        const dataUri = `data:application/octet-stream;base64,${base64Data}`;
        
        // Update the buffer to include the actual data URI
        if (gltfData.buffers && gltfData.buffers.length > 0) {
            gltfData.buffers[0].uri = dataUri;
            gltfData.buffers[0].byteLength = bufferData.byteLength;
        }
        
        // Create GLTF JSON
        const gltfJson = JSON.stringify(gltfData, null, 2);
        
        const gltfBlob = new Blob([gltfJson], { type: 'model/gltf+json' });
        
        console.log('[JT Converter] GLTF file created with embedded binary data');
        console.log('[JT Converter] Buffer URI length:', dataUri.length);
        return gltfBlob;
    }

    /**
     * Convert ArrayBuffer to Base64 string
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Extract filename from full path
     */
    private extractFileName(filePath: string): string {
        if (!filePath) {
            return 'unknown_jt_file';
        }
        const parts = filePath.split('/');
        return parts[parts.length - 1].replace('.jt', '');
    }

    /**
     * Create cube data arrays
     */
    private createCubeData() {
        // Simple cube vertices (8 vertices)
        const positions = new Float32Array([
            // Front face
            -0.5, -0.5,  0.5,
             0.5, -0.5,  0.5,
             0.5,  0.5,  0.5,
            -0.5,  0.5,  0.5,
            // Back face
            -0.5, -0.5, -0.5,
             0.5, -0.5, -0.5,
             0.5,  0.5, -0.5,
            -0.5,  0.5, -0.5
        ]);

        // Simple cube normals
        const normals = new Float32Array([
            // Front face
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
            // Back face
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
             0,  0, -1
        ]);

        // Simple cube indices (12 triangles)
        const indices = new Uint16Array([
            0, 1, 2,  0, 2, 3,  // Front
            4, 6, 5,  4, 7, 6,  // Back
            0, 4, 5,  0, 5, 1,  // Bottom
            2, 6, 7,  2, 7, 3,  // Top
            0, 3, 7,  0, 7, 4,  // Left
            1, 5, 6,  1, 6, 2   // Right
        ]);

        return { positions, normals, indices };
    }

    /**
     * Create buffer data for a simple cube
     */
    private createBufferData(): ArrayBuffer {
        const { positions, normals, indices } = this.createCubeData();

        // Calculate total buffer size with proper alignment
        const vertexSize = positions.byteLength;
        const normalSize = normals.byteLength;
        const indexSize = indices.byteLength;
        
        // Align to 4-byte boundaries
        const alignedVertexSize = Math.ceil(vertexSize / 4) * 4;
        const alignedNormalSize = Math.ceil(normalSize / 4) * 4;
        const alignedIndexSize = Math.ceil(indexSize / 4) * 4;
        
        const totalSize = alignedVertexSize + alignedNormalSize + alignedIndexSize;
        
        console.log('[JT Converter] Buffer sizes:', {
            vertexSize, normalSize, indexSize,
            alignedVertexSize, alignedNormalSize, alignedIndexSize,
            totalSize
        });

        // Create buffer with proper alignment
        const buffer = new ArrayBuffer(totalSize);
        const view = new Uint8Array(buffer);
        
        let offset = 0;
        
        // Copy vertices
        view.set(new Uint8Array(positions.buffer), offset);
        offset += alignedVertexSize;
        
        // Copy normals
        view.set(new Uint8Array(normals.buffer), offset);
        offset += alignedNormalSize;
        
        // Copy indices
        view.set(new Uint8Array(indices.buffer), offset);
        
        return buffer;
    }

    /**
     * Parse JT JSON and extract mesh information
     */
    private parseJTMeshData(jtJsonData: JTJsonData): any {
        // This would parse the actual JT data structure
        // For now, return placeholder data
        return {
            vertices: [],
            faces: [],
            materials: []
        };
    }
}
