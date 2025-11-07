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
    // private _scene: BABYLON.Scene;
    
    constructor(_scene: BABYLON.Scene) {
        // this._scene = scene;
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
        
        // Log what data we have available
        console.log('[JT Converter] Available JT data fields:', Object.keys(jtJsonData));
        console.log('[JT Converter] JT file version:', jtJsonData.MajorVersion, jtJsonData.MinorVersion);
        
        // Initialize LOD groups
        let lodGroups: { [key: string]: any[] } = {};
        let selectedLOD = 'Shape';
        
        // Check if we have actual mesh data
        if (!jtJsonData.TocTable || jtJsonData.TocTable.length === 0) {
            console.warn('[JT Converter] No mesh data found in JT JSON, creating placeholder geometry');
        } else {
            console.log('[JT Converter] Found JT table of contents with', jtJsonData.TocTable.length, 'entries');
            
            // Analyze the mesh data
            const shapeEntries = jtJsonData.TocTable.filter((entry: any) => 
                entry[2] && entry[2].includes('Shape')
            );
            console.log('[JT Converter] Found', shapeEntries.length, 'shape entries');
            
            // Group by LOD level
            lodGroups = {};
            shapeEntries.forEach((entry: any) => {
                const lodLevel = entry[2] || 'Unknown';
                if (!lodGroups[lodLevel]) {
                    lodGroups[lodLevel] = [];
                }
                lodGroups[lodLevel].push(entry);
            });
            
            console.log('[JT Converter] LOD distribution:', Object.keys(lodGroups).map(lod => 
                `${lod}: ${lodGroups[lod].length} shapes`
            ));
            
            // Use the highest quality LOD available
            const lodLevels = ['Shape LOD4', 'Shape LOD3', 'Shape LOD2', 'Shape LOD1', 'Shape LOD0', 'Shape'];
            for (const lod of lodLevels) {
                if (lodGroups[lod] && lodGroups[lod].length > 0) {
                    selectedLOD = lod;
                    break;
                }
            }
            
            console.log('[JT Converter] Using LOD level:', selectedLOD, 'with', lodGroups[selectedLOD]?.length || 0, 'shapes');
        }
        
        // For now, create a simple GLTF structure
        // In a full implementation, we would parse the JT data and extract:
        // - Mesh geometry (vertices, faces)
        // - Materials and textures
        // - Transform hierarchies
        // - LOD information
        
        // TODO: Parse actual JT geometry from TocTable entries
        // For now, create a more realistic placeholder based on the JT data
        
        console.log('[JT Converter] Creating realistic placeholder geometry based on JT data...');
        
        // Create multiple meshes representing the JT hierarchy
        // Based on the LOD analysis, create separate meshes for different components
        
        const selectedLODCount = lodGroups[selectedLOD]?.length || 0;
        const meshCount = Math.min(5, Math.max(1, Math.floor(selectedLODCount / 100))); // Create 1-5 meshes based on shape count
        
        // Create meaningful component names based on JT data
        const componentNames = this.generateComponentNames(jtJsonData, meshCount);
        
        console.log('[JT Converter] Creating', meshCount, 'separate meshes with distinct geometry');
        
        // Create separate buffer data for each mesh to ensure they're treated as distinct objects
        const meshData = this.createSeparateMeshData(meshCount);
        
        console.log('[JT Converter] Created separate mesh data for', meshCount, 'meshes');

        // Calculate buffer sizes with proper alignment
        const positionByteLength = meshData.positions.byteLength;
        const normalByteLength = meshData.normals.byteLength;
        const indexByteLength = meshData.indices.byteLength;

        // Align to 4-byte boundaries (GLTF requirement)
        const alignedPositionSize = Math.ceil(positionByteLength / 4) * 4;
        const alignedNormalSize = Math.ceil(normalByteLength / 4) * 4;
        const alignedIndexSize = Math.ceil(indexByteLength / 4) * 4;

        const totalBufferSize = alignedPositionSize + alignedNormalSize + alignedIndexSize;

        console.log('[JT Converter] Buffer calculations:', {
            positionByteLength, normalByteLength, indexByteLength,
            alignedPositionSize, alignedNormalSize, alignedIndexSize,
            totalBufferSize,
            vertexCount: meshData.positions.length / 3,
            normalCount: meshData.normals.length / 3,
            indexCount: meshData.indices.length
        });

        const gltfData: GLTFData = {
            asset: {
                version: "2.0",
                generator: "kinetiCORE JT Converter"
            },
            scene: 0,
            scenes: [{
                nodes: Array.from({length: meshCount}, (_, i) => i)
            }],
            nodes: Array.from({length: meshCount}, (_, i) => ({
                mesh: i,
                name: componentNames[i] || `Robot_Component_${i}`,
                translation: [0, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1]
            })),
            meshes: Array.from({length: meshCount}, (_, i) => ({
                primitives: [{
                    attributes: {
                        POSITION: i * 3,
                        NORMAL: i * 3 + 1
                    },
                    indices: i * 3 + 2,
                    material: 0
                }]
            })),
            accessors: [],
            bufferViews: [],
            buffers: [{
                byteLength: totalBufferSize
            }],
            materials: [{
                name: "JT_Material",
                pbrMetallicRoughness: {
                    baseColorFactor: [0.2, 0.6, 0.9, 1.0], // Bright blue for visibility
                    metallicFactor: 0.3,
                    roughnessFactor: 0.4
                }
            }]
        };

        // Create accessors and bufferViews for multiple meshes
        const componentSize = meshData.positions.length / 3 / meshCount; // Vertices per component
        const normalSize = meshData.normals.length / 3 / meshCount; // Normals per component
        const indexSize = meshData.indices.length / meshCount; // Indices per component
        
        for (let i = 0; i < meshCount; i++) {
            const positionOffset = i * componentSize * 3 * 4; // 3 components * 4 bytes
            const normalOffset = alignedPositionSize + (i * normalSize * 3 * 4);
            const indexOffset = alignedPositionSize + alignedNormalSize + (i * indexSize * 2); // 2 bytes per index
            
            // Position accessor
            gltfData.accessors.push({
                bufferView: i * 3,
                componentType: 5126, // FLOAT
                count: componentSize,
                type: "VEC3",
                min: [-1, -1, -0.5],
                max: [1, 1, 3.5]
            });
            
            // Normal accessor
            gltfData.accessors.push({
                bufferView: i * 3 + 1,
                componentType: 5126, // FLOAT
                count: normalSize,
                type: "VEC3"
            });
            
            // Index accessor
            gltfData.accessors.push({
                bufferView: i * 3 + 2,
                componentType: 5123, // UNSIGNED_SHORT
                count: indexSize,
                type: "SCALAR"
            });
            
            // Buffer views
            gltfData.bufferViews.push({
                buffer: 0,
                byteOffset: positionOffset,
                byteLength: componentSize * 3 * 4
            });
            
            gltfData.bufferViews.push({
                buffer: 0,
                byteOffset: normalOffset,
                byteLength: normalSize * 3 * 4
            });
            
            gltfData.bufferViews.push({
                buffer: 0,
                byteOffset: indexOffset,
                byteLength: indexSize * 2
            });
        }

        console.log('[JT Converter] GLTF structure created with', meshCount, 'meshes');
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
     * Generate meaningful component names based on JT data
     */
    private generateComponentNames(jtJsonData: JTJsonData, meshCount: number): string[] {
        const names: string[] = [];
        
        // Extract filename for context
        const fileName = this.extractFileName(jtJsonData.FileName);
        
        // Analyze JT data to create meaningful names
        if (jtJsonData.TocTable && jtJsonData.TocTable.length > 0) {
            // Group by LOD level
            const lodGroups: { [key: string]: any[] } = {};
            jtJsonData.TocTable.forEach((entry: any) => {
                const lodLevel = entry[2] || 'Unknown';
                if (!lodGroups[lodLevel]) {
                    lodGroups[lodLevel] = [];
                }
                lodGroups[lodLevel].push(entry);
            });
            
            // Create names based on LOD levels and JT structure
            const lodLevels = ['Shape LOD4', 'Shape LOD3', 'Shape LOD2', 'Shape LOD1', 'Shape LOD0', 'Shape'];
            let componentIndex = 0;
            
            for (const lod of lodLevels) {
                if (lodGroups[lod] && lodGroups[lod].length > 0 && componentIndex < meshCount) {
                    names.push(`${fileName}_${lod.replace('Shape ', '')}`);
                    componentIndex++;
                }
            }
            
            // Fill remaining slots with generic names
            while (componentIndex < meshCount) {
                names.push(`${fileName}_Component_${componentIndex}`);
                componentIndex++;
            }
        } else {
            // Fallback to generic names
            for (let i = 0; i < meshCount; i++) {
                names.push(`${fileName}_Component_${i}`);
            }
        }
        
        return names;
    }

    /**
     * Create separate mesh data for each component to ensure distinct objects
     */
    private createSeparateMeshData(meshCount: number) {
        const allPositions: number[] = [];
        const allNormals: number[] = [];
        const allIndices: number[] = [];
        
        for (let i = 0; i < meshCount; i++) {
            const componentPositions = this.createRobotComponent(i, meshCount);
            const componentNormals = this.createComponentNormals(componentPositions.length / 3);
            const componentIndices = this.createComponentIndices(i, componentPositions.length / 3);
            
            // Offset indices for multiple meshes
            const indexOffset = allPositions.length / 3;
            const offsetIndices = componentIndices.map(idx => idx + indexOffset);
            
            allPositions.push(...componentPositions);
            allNormals.push(...componentNormals);
            allIndices.push(...offsetIndices);
        }
        
        console.log('[JT Converter] Created separate mesh data:', {
            meshCount,
            totalVertices: allPositions.length / 3,
            totalTriangles: allIndices.length / 3,
            components: meshCount
        });
        
        return {
            positions: new Float32Array(allPositions),
            normals: new Float32Array(allNormals),
            indices: new Uint16Array(allIndices)
        };
    }

    /**
     * Create multi-component robot data representing JT hierarchy
     */
    /*
    private _createMultiComponentRobotData(meshCount: number) {
        // Create multiple robot components to represent the JT hierarchy
        // Each component represents a different part of the robot
        
        const allPositions: number[] = [];
        const allNormals: number[] = [];
        const allIndices: number[] = [];
        
        for (let i = 0; i < meshCount; i++) {
            const componentPositions = this.createRobotComponent(i, meshCount);
            const componentNormals = this.createComponentNormals(componentPositions.length / 3);
            const componentIndices = this.createComponentIndices(i, componentPositions.length / 3);
            
            // Offset indices for multiple meshes
            const indexOffset = allPositions.length / 3;
            const offsetIndices = componentIndices.map(idx => idx + indexOffset);
            
            allPositions.push(...componentPositions);
            allNormals.push(...componentNormals);
            allIndices.push(...offsetIndices);
        }
        
        console.log('[JT Converter] Created multi-component robot data:', {
            meshCount,
            totalVertices: allPositions.length / 3,
            totalTriangles: allIndices.length / 3,
            components: meshCount
        });
        
        return {
            positions: new Float32Array(allPositions),
            normals: new Float32Array(allNormals),
            indices: new Uint16Array(allIndices)
        };
    }
    */
    
    /**
     * Create a single robot component
     */
    private createRobotComponent(_componentIndex: number, _totalComponents: number): number[] {
        const positions: number[] = [];
        
        // Create different components based on index
        switch (_componentIndex) {
            case 0: // Base
                positions.push(
                    -1.0, -1.0, -0.5,   1.0, -1.0, -0.5,   1.0, 1.0, -0.5,   -1.0, 1.0, -0.5,
                    -0.8, -0.8, 0.5,    0.8, -0.8, 0.5,    0.8, 0.8, 0.5,    -0.8, 0.8, 0.5
                );
                break;
            case 1: // Lower arm
                positions.push(
                    -0.3, -0.3, 0.5,    0.3, -0.3, 0.5,    0.3, 0.3, 0.5,    -0.3, 0.3, 0.5,
                    -0.2, -0.2, 1.5,    0.2, -0.2, 1.5,    0.2, 0.2, 1.5,    -0.2, 0.2, 1.5
                );
                break;
            case 2: // Upper arm
                positions.push(
                    -0.2, -0.2, 1.5,    0.2, -0.2, 1.5,    0.2, 0.2, 1.5,    -0.2, 0.2, 1.5,
                    -0.15, -0.15, 2.5,  0.15, -0.15, 2.5,  0.15, 0.15, 2.5,  -0.15, 0.15, 2.5
                );
                break;
            case 3: // Wrist
                positions.push(
                    -0.15, -0.15, 2.5,  0.15, -0.15, 2.5,  0.15, 0.15, 2.5,  -0.15, 0.15, 2.5,
                    -0.1, -0.1, 3.0,    0.1, -0.1, 3.0,    0.1, 0.1, 3.0,    -0.1, 0.1, 3.0
                );
                break;
            case 4: // End effector
                positions.push(
                    -0.1, -0.1, 3.0,    0.1, -0.1, 3.0,    0.1, 0.1, 3.0,    -0.1, 0.1, 3.0,
                    -0.05, -0.05, 3.5,  0.05, -0.05, 3.5,  0.05, 0.05, 3.5,  -0.05, 0.05, 3.5
                );
                break;
            default: {
                // Additional components
                const offset = _componentIndex * 0.5;
                positions.push(
                    -0.1, -0.1, 3.0 + offset,    0.1, -0.1, 3.0 + offset,    0.1, 0.1, 3.0 + offset,    -0.1, 0.1, 3.0 + offset,
                    -0.05, -0.05, 3.5 + offset,  0.05, -0.05, 3.5 + offset,  0.05, 0.05, 3.5 + offset,  -0.05, 0.05, 3.5 + offset
                );
            }
        }
        
        return positions;
    }
    
    /**
     * Create normals for a component
     */
    private createComponentNormals(vertexCount: number): number[] {
        const normals: number[] = [];
        const faces = vertexCount / 2; // Each component has 2 faces (top and bottom)
        
        for (let i = 0; i < faces; i++) {
            // Bottom face normals
            normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
            // Top face normals
            normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
        }
        
        return normals;
    }
    
    /**
     * Create indices for a component
     */
    private createComponentIndices(_componentIndex: number, vertexCount: number): number[] {
        const indices: number[] = [];
        const faces = vertexCount / 2;
        
        for (let i = 0; i < faces; i++) {
            const baseIndex = i * 4;
            // Bottom face
            indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
            // Top face
            indices.push(baseIndex + 4, baseIndex + 6, baseIndex + 5, baseIndex + 4, baseIndex + 7, baseIndex + 6);
            // Side faces
            indices.push(
                baseIndex, baseIndex + 4, baseIndex + 5, baseIndex, baseIndex + 5, baseIndex + 1,
                baseIndex + 1, baseIndex + 5, baseIndex + 6, baseIndex + 1, baseIndex + 6, baseIndex + 2,
                baseIndex + 2, baseIndex + 6, baseIndex + 7, baseIndex + 2, baseIndex + 7, baseIndex + 3,
                baseIndex + 3, baseIndex + 7, baseIndex + 4, baseIndex + 3, baseIndex + 4, baseIndex
            );
        }
        
        return indices;
    }

    /**
     * Create robot component data arrays (simplified for stability)
     */
    private createRobotComponentData() {
        // Create a simplified but realistic robot arm geometry
        // Using fewer vertices to ensure proper buffer alignment
        
        const positions = new Float32Array([
            // Base (8 vertices)
            -1.0, -1.0, -0.5,   1.0, -1.0, -0.5,   1.0, 1.0, -0.5,   -1.0, 1.0, -0.5,
            -0.8, -0.8, 0.5,    0.8, -0.8, 0.5,    0.8, 0.8, 0.5,    -0.8, 0.8, 0.5,
            
            // Arm segment (8 vertices)
            -0.3, -0.3, 0.5,    0.3, -0.3, 0.5,    0.3, 0.3, 0.5,    -0.3, 0.3, 0.5,
            -0.2, -0.2, 1.5,    0.2, -0.2, 1.5,    0.2, 0.2, 1.5,    -0.2, 0.2, 1.5,
            
            // End effector (8 vertices)
            -0.1, -0.1, 1.5,    0.1, -0.1, 1.5,    0.1, 0.1, 1.5,    -0.1, 0.1, 1.5,
            -0.05, -0.05, 2.0,  0.05, -0.05, 2.0,  0.05, 0.05, 2.0,  -0.05, 0.05, 2.0
        ]);

        // Simplified normals
        const normals = new Float32Array([
            // Base normals
            0, 0, -1,   0, 0, -1,   0, 0, -1,   0, 0, -1,
            0, 0, 1,    0, 0, 1,    0, 0, 1,    0, 0, 1,
            
            // Arm segment normals
            0, 0, -1,   0, 0, -1,   0, 0, -1,   0, 0, -1,
            0, 0, 1,    0, 0, 1,    0, 0, 1,    0, 0, 1,
            
            // End effector normals
            0, 0, -1,   0, 0, -1,   0, 0, -1,   0, 0, -1,
            0, 0, 1,    0, 0, 1,    0, 0, 1,    0, 0, 1
        ]);

        // Simplified triangle indices
        const indices = new Uint16Array([
            // Base
            0, 1, 2,   0, 2, 3,    // Bottom
            4, 6, 5,   4, 7, 6,    // Top
            0, 4, 5,   0, 5, 1,    // Side 1
            1, 5, 6,   1, 6, 2,    // Side 2
            2, 6, 7,   2, 7, 3,    // Side 3
            3, 7, 4,   3, 4, 0,    // Side 4
            
            // Arm segment
            8, 9, 10,  8, 10, 11,  // Bottom
            12, 14, 13, 12, 15, 14, // Top
            8, 12, 13, 8, 13, 9,   // Side 1
            9, 13, 14, 9, 14, 10,  // Side 2
            10, 14, 15, 10, 15, 11, // Side 3
            11, 15, 12, 11, 12, 8, // Side 4
            
            // End effector
            16, 17, 18, 16, 18, 19, // Bottom
            20, 22, 21, 20, 23, 22, // Top
            16, 20, 21, 16, 21, 17, // Side 1
            17, 21, 22, 17, 22, 18, // Side 2
            18, 22, 23, 18, 23, 19, // Side 3
            19, 23, 20, 19, 20, 16  // Side 4
        ]);

        console.log('[JT Converter] Created simplified robot component geometry:', {
            vertexCount: positions.length / 3,
            normalCount: normals.length / 3,
            triangleCount: indices.length / 3,
            componentCount: 3
        });

        return { positions, normals, indices };
    }

    /**
     * Create cube data arrays with more realistic geometry
     */
    /*
    private _createCubeData() {
        // Create a more detailed cube with proper face normals
        // This represents a typical industrial robot base or component
        const positions = new Float32Array([
            // Front face (Z+)
            -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
            // Back face (Z-)
            -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,   0.5, -0.5, -0.5,
            // Left face (X-)
            -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
            // Right face (X+)
             0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,   0.5, -0.5,  0.5,
            // Top face (Y+)
            -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
            // Bottom face (Y-)
            -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5
        ]);

        // Proper face normals for each vertex
        const normals = new Float32Array([
            // Front face normals
             0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
            // Back face normals
             0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
            // Left face normals
            -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0,
            // Right face normals
             1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,
            // Top face normals
             0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,
            // Bottom face normals
             0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0
        ]);

        // Triangle indices for each face (2 triangles per face)
        const indices = new Uint16Array([
            // Front face
            0, 1, 2,   0, 2, 3,
            // Back face
            4, 5, 6,   4, 6, 7,
            // Left face
            8, 9, 10,  8, 10, 11,
            // Right face
            12, 13, 14, 12, 14, 15,
            // Top face
            16, 17, 18, 16, 18, 19,
            // Bottom face
            20, 21, 22, 20, 22, 23
        ]);

        console.log('[JT Converter] Created detailed cube geometry:', {
            vertexCount: positions.length / 3,
            normalCount: normals.length / 3,
            triangleCount: indices.length / 3,
            faceCount: 6
        });

        return { positions, normals, indices };
    }
    */

    /**
     * Create buffer data for a simple cube
     */
    private createBufferData(): ArrayBuffer {
        const { positions, normals, indices } = this.createRobotComponentData();

        // Calculate total buffer size with proper alignment
        const vertexSize = positions.byteLength;
        const normalSize = normals.byteLength;
        const indexSize = indices.byteLength;
        
        // Align to 4-byte boundaries (GLTF requirement)
        const alignedVertexSize = Math.ceil(vertexSize / 4) * 4;
        const alignedNormalSize = Math.ceil(normalSize / 4) * 4;
        const alignedIndexSize = Math.ceil(indexSize / 4) * 4;
        
        const totalSize = alignedVertexSize + alignedNormalSize + alignedIndexSize;
        
        console.log('[JT Converter] Buffer sizes:', {
            vertexSize, normalSize, indexSize,
            alignedVertexSize, alignedNormalSize, alignedIndexSize,
            totalSize,
            vertexCount: positions.length / 3,
            normalCount: normals.length / 3,
            indexCount: indices.length
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
    /*
    private _parseJTMeshData(_jtJsonData: JTJsonData): any {
        // This would parse the actual JT data structure
        // For now, return placeholder data
        return {
            vertices: [],
            faces: [],
            materials: []
        };
    }
    */
}
