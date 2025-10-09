/**
 * JT file loader using PyOpenJt backend conversion service
 * Supports JT versions 8.0, 9.0, and 10.x via JT → GLB conversion
 *
 * IMPORTANT: Tree Structure Preservation
 * ======================================
 * This loader preserves the full hierarchical tree structure from JT files.
 * The assembly hierarchy (Parts, Subassemblies, Components) is maintained
 * exactly as authored in the CAD system.
 *
 * Tree structure example from JT file:
 *   9X_200_2E1_TEST
 *   ├─ 9X_200_2E1
 *   │  ├─ UNIT_104
 *   │  │  └─ RH
 *   │  │     └─ FIXED
 *   │  ├─ UNIT_102
 *   │  │  ├─ RH
 *   │  │  │  ├─ MOVING
 *   │  │  │  ├─ FIXED
 *   │  │  │  └─ CoSys
 *   │  │  └─ WIRE
 *   │  │     └─ OPEN
 *   │  └─ UNIT_106...
 *
 * All transform nodes and their parent-child relationships are preserved.
 */

import * as BABYLON from '@babylonjs/core';
import { JTImportProgress, JTPart, JTHeader } from './types';
import { JTImportError } from './errors';
import { JTErrorType } from './types';
import { convertJTToBabylonCoordinates, reverseTriangleWinding } from './coordinateConversion';
import { JTConversionService, JTConversionError } from './JTConversionService';
import { JTJsonToGLTFConverter } from './JTJsonToGLTFConverter';

/**
 * Check if blob content is JSON
 */
async function isJsonContent(blob: Blob): Promise<boolean> {
    try {
        const text = await blob.text();
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Load JT file via PyOpenJt backend conversion to GLTF
 *
 * @param file - JT file to load
 * @param scene - Babylon.js scene
 * @returns Promise resolving to loaded meshes and root nodes
 *
 * @throws {JTImportError} When conversion or loading fails
 */
export async function loadJTFromFile(
    file: File,
    scene: BABYLON.Scene
): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
    const converter = new JTConversionService();

    try {
        // Check if backend is available with retry logic
        let health;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                health = await converter.checkHealth();
                break;
            } catch (error) {
                retryCount++;
                if (retryCount < maxRetries) {
                    console.warn(`[JT Import] Backend health check failed (attempt ${retryCount}/${maxRetries}), retrying in 1s...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    throw error;
                }
            }
        }

        if (health.status === 'unhealthy') {
            throw new JTImportError(
                JTErrorType.WASMNotLoaded,
                `JT conversion backend is not available.\n\n` +
                `${health.message}\n\n` +
                `Please start the PyOpenJt server:\n` +
                `1. Open PowerShell/Command Prompt\n` +
                `2. cd C:\\Users\\George\\source\\repos\\PyOpenJt\\Server\n` +
                `3. python JtConversionServer.py\n\n` +
                `Server should be running at http://localhost:8000\n\n` +
                `See PyOpenJt_SETUP_GUIDE.md for setup instructions.`,
                false
            );
        }

        if (!health.pyopenjt_built) {
            throw new JTImportError(
                JTErrorType.WASMNotLoaded,
                `PyOpenJt is not built yet.\n\n` +
                `${health.message}\n\n` +
                `Please build PyOpenJt:\n` +
                `1. Install VCPKG and CMake\n` +
                `2. cd C:\\Users\\George\\source\\repos\\PyOpenJt\n` +
                `3. .\\Setup.bat\n` +
                `4. Open WinBuild\\PyOpenJt.sln in Visual Studio\n` +
                `5. Build in Release mode\n\n` +
                `See PyOpenJt_SETUP_GUIDE.md for detailed instructions.`,
                false
            );
        }

        console.log(`[JT Import] Converting ${file.name} to GLTF...`);

        // Convert JT → GLTF
        const gltfBlob = await converter.convertToGLTF(file, (progress) => {
            console.log(`[JT Import] ${progress.message} (${progress.percent}%)`);
            // TODO: Show progress in UI via LoadingIndicator
        });

        console.log(`[JT Import] Conversion complete, loading GLTF...`);

        // Check if we got JSON or GLTF based on content type
        const contentType = gltfBlob.type || '';
        const isJson = contentType.includes('application/json') || 
                      (gltfBlob.size < 10000 && await isJsonContent(gltfBlob));

        if (isJson) {
            console.log(`[JT Import] Received JSON file, converting to GLTF...`);
            
            try {
                // Parse JSON data
                const jsonText = await gltfBlob.text();
                const jtJsonData = JSON.parse(jsonText);
                
                // Convert JSON to GLTF
                const converter = new JTJsonToGLTFConverter(scene);
                const gltfData = await converter.convertJTJsonToGLTF(jtJsonData);
                const convertedGLTFBlob = await converter.createGLTFFile(gltfData);
                
                console.log(`[JT Import] JSON converted to GLTF, loading...`);
                
                // Load the converted GLTF
                const gltfFile = new File([convertedGLTFBlob], file.name.replace('.jt', '.gltf'), {
                    type: 'model/gltf+json'
                });

                const result = await BABYLON.SceneLoader.ImportMeshAsync(
                    '',  // Load all meshes
                    '',
                    gltfFile,
                    scene,
                    undefined,
                    '.gltf'
                );

                console.log(
                    `[JT Import] Loaded ${result.meshes.length} meshes, ` +
                    `${result.transformNodes.length} transform nodes from converted JT JSON`
                );

                // Continue with normal processing...
                return await processLoadedMeshes(result, file.name, scene);
                
            } catch (error) {
                console.warn(`[JT Import] JSON conversion failed, creating placeholder:`, error);
                
                // Fallback to placeholder mesh
                const placeholderMesh = BABYLON.MeshBuilder.CreateBox(
                    file.name.replace('.jt', '_placeholder'),
                    { size: 1 },
                    scene
                );
                placeholderMesh.metadata = {
                    sourceFormat: 'jt',
                    originalFile: file.name,
                    conversionStatus: 'json-conversion-failed'
                };
                
                console.log(`[JT Import] Created placeholder mesh for failed JSON conversion`);
                return {
                    meshes: [placeholderMesh],
                    rootNodes: [placeholderMesh as BABYLON.TransformNode]
                };
            }
        }

        // Load the converted GLTF file
        const gltfFile = new File([gltfBlob], file.name.replace('.jt', '.gltf'), {
            type: 'model/gltf+json'
        });

        // Use BABYLON.js GLTF loader
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            '',  // Load all meshes
            '',
            gltfFile,
            scene,
            undefined,
            '.gltf'
        );

        console.log(
            `[JT Import] Loaded ${result.meshes.length} meshes, ` +
            `${result.transformNodes.length} transform nodes from ${file.name}`
        );

        // Validate that we have content to load
        if (result.meshes.length === 0 && result.transformNodes.length === 0) {
            throw new JTImportError(
                JTErrorType.MissingGeometry,
                'JT file contains no geometry or structure data',
                false
            );
        }

        // Preserve hierarchical tree structure
        // Previous implementation flattened all meshes to root level, losing assembly structure
        // New approach: Keep all parent-child relationships intact for CAD assembly workflows
        const processedMeshes: BABYLON.AbstractMesh[] = [];
        const rootNodes: BABYLON.TransformNode[] = [];

        // Create a single root node for the entire JT assembly
        const assemblyRoot = new BABYLON.TransformNode(
            file.name.replace('.jt', ''),
            scene
        );

        // Find actual root nodes (nodes with no parent or __root__ parent)
        const findRootNodes = () => {
            const roots: BABYLON.Node[] = [];

            // Collect all meshes and transform nodes
            const allNodes = [...result.meshes, ...result.transformNodes];

            for (const node of allNodes) {
                // Check if this is a root-level node
                const isRootLevel = !node.parent ||
                                  node.parent.name === '__root__' ||
                                  !node.parent.name;

                const isNotRootNode = node.name !== '__root__';

                if (isRootLevel && isNotRootNode) {
                    roots.push(node);
                }
            }

            return roots;
        };

        const roots = findRootNodes();

        // Enhanced root node detection for complex JT hierarchies
        if (roots.length === 0) {
            console.warn('[JT Import] No root nodes found, analyzing hierarchy...');
            
            // Strategy 1: Find nodes with no parent references
            const allNodes = [...result.meshes, ...result.transformNodes];
            const orphanNodes = allNodes.filter(n => 
                n.name !== '__root__' && 
                (!n.parent || n.parent.name === '__root__' || n.parent.name === '')
            );
            
            if (orphanNodes.length > 0) {
                console.log(`[JT Import] Found ${orphanNodes.length} orphan nodes, using as roots`);
                roots.push(...orphanNodes);
            } else {
                // Strategy 2: Find top-level nodes by analyzing parent-child relationships
                const nodeMap = new Map<string, BABYLON.Node>();
                allNodes.forEach(node => {
                    if (node.name !== '__root__') {
                        nodeMap.set(node.name, node);
                    }
                });

                // Find nodes that are not children of any other node
                const potentialRoots = allNodes.filter(node => {
                    if (node.name === '__root__') return false;
                    
                    // Check if this node is a child of any other node
                    const isChild = allNodes.some(otherNode => 
                        otherNode !== node && 
                        otherNode.name !== '__root__' &&
                        otherNode.getChildren().includes(node)
                    );
                    
                    return !isChild;
                });

                if (potentialRoots.length > 0) {
                    console.log(`[JT Import] Found ${potentialRoots.length} top-level nodes by hierarchy analysis`);
                    roots.push(...potentialRoots);
                } else {
                    // Strategy 3: Use all non-root nodes as fallback
                    console.warn('[JT Import] Using all non-root nodes as fallback');
                    roots.push(...allNodes.filter(n => n.name !== '__root__'));
                }
            }
        }

        // Reparent root nodes to our assembly root
        roots.forEach(rootNode => {
            if (rootNode instanceof BABYLON.TransformNode || rootNode instanceof BABYLON.Mesh) {
                rootNode.setParent(assemblyRoot);
            }
        });

        // Add JT metadata to all meshes and preserve hierarchy
        result.meshes.forEach(mesh => {
            if (mesh.name !== '__root__') {
                // Add JT metadata
                if (!mesh.metadata) {
                    mesh.metadata = {};
                }
                mesh.metadata.sourceFormat = 'jt';
                mesh.metadata.originalFile = file.name;
                mesh.metadata.convertedVia = 'pyopenjt';

                processedMeshes.push(mesh);
            }
        });

        // Add metadata to transform nodes as well
        result.transformNodes.forEach(node => {
            if (node.name !== '__root__' && node !== assemblyRoot) {
                if (!node.metadata) {
                    node.metadata = {};
                }
                node.metadata.sourceFormat = 'jt';
                node.metadata.originalFile = file.name;
                node.metadata.convertedVia = 'pyopenjt';
            }
        });

        // Clean up only the __root__ node if it exists
        const babylonRoot = result.meshes.find(m => m.name === '__root__');
        if (babylonRoot) {
            babylonRoot.dispose();
        }

        console.log(
            `[JT Import] Preserved hierarchy: ${processedMeshes.length} meshes, ` +
            `${result.transformNodes.length} transform nodes under assembly root`
        );

        // Log tree structure for debugging
        logTreeStructure(assemblyRoot, 0);

        rootNodes.push(assemblyRoot);

        return {
            meshes: processedMeshes,
            rootNodes: rootNodes
        };

    } catch (error) {
        // Handle conversion errors
        if (error instanceof JTConversionError) {
            const helpfulMessage = JTConversionService.getHelpfulErrorMessage(error);
            throw new JTImportError(
                JTErrorType.CorruptedFile,
                helpfulMessage,
                false
            );
        }

        // Re-throw JTImportError as-is
        if (error instanceof JTImportError) {
            throw error;
        }

        // Wrap unexpected errors
        throw new JTImportError(
            JTErrorType.CorruptedFile,
            `Failed to import JT file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            false
        );
    }
}

export class JTLoader {
    private jtModule: any = null;

    /**
     * Initialize the JT Open Toolkit WASM module
     */
    async initialize(): Promise<void> {
        if (this.jtModule) return;

        // In production, this would load the actual JT Open Toolkit WASM module
        // For now, this is a placeholder for the interface
        throw new Error('JT Open Toolkit WASM module not yet implemented. ' +
            'Please compile JT Open Toolkit with Emscripten first.');
    }

    /**
     * Load a JT file with progress tracking
     */
    async load(
        file: File,
        progressCallback?: (progress: JTImportProgress) => void
    ): Promise<BABYLON.Mesh[]> {

        const updateProgress = (stage: string, current: number, total: number) => {
            if (progressCallback) {
                progressCallback({
                    stage: stage as any,
                    partsProcessed: current,
                    totalParts: total,
                    percentComplete: Math.floor((current / total) * 100)
                });
            }
        };

        try {
            // Stage 1: Loading
            updateProgress('loading', 0, 100);
            const buffer = await file.arrayBuffer();

            // Stage 2: Parsing
            updateProgress('parsing', 0, 100);
            await this.initialize();

            // Validate file header
            const header = await this.readJTHeader(buffer);
            this.validateVersion(header);

            // Load file into JT reader
            const reader = this.createReader(buffer);
            const assembly = reader.getSceneGraph();

            if (!assembly.parts || assembly.parts.length === 0) {
                throw new JTImportError(
                    JTErrorType.MissingGeometry,
                    'JT file contains no geometry data',
                    false
                );
            }

            const totalParts = assembly.parts.length;

            // Stage 3: Geometry extraction
            const meshes: BABYLON.Mesh[] = [];
            const errors: string[] = [];

            for (let i = 0; i < assembly.parts.length; i++) {
                const part = assembly.parts[i];
                updateProgress('geometry', i, totalParts);

                try {
                    await this.processPartAsync(part, meshes);
                } catch (e: any) {
                    errors.push(`Failed to process part ${part.name}: ${e.message}`);
                }
            }

            if (meshes.length === 0) {
                throw new JTImportError(
                    JTErrorType.MissingGeometry,
                    `No parts could be imported. Errors: ${errors.join(', ')}`,
                    false
                );
            }

            if (errors.length > 0) {
                console.warn(`Partial JT import: ${errors.length} parts failed`, errors);
            }

            // Stage 4: Complete
            updateProgress('complete', totalParts, totalParts);
            return meshes;

        } catch (error) {
            if (error instanceof JTImportError) {
                throw error;
            }
            throw new JTImportError(
                JTErrorType.CorruptedFile,
                `Unexpected error: ${(error as Error).message}`,
                false
            );
        }
    }

    /**
     * Read JT file header to check version
     */
    private async readJTHeader(_buffer: ArrayBuffer): Promise<JTHeader> {
        // Placeholder - actual implementation would parse JT header
        // JT files have a specific header structure with version info
        return {
            version: 10.0,
            formatVersion: '10.0'
        };
    }

    /**
     * Validate JT version is supported
     */
    private validateVersion(header: JTHeader): void {
        if (header.version < 8.0) {
            throw new JTImportError(
                JTErrorType.UnsupportedVersion,
                `JT version ${header.version} not supported. Minimum version: 8.0`,
                false
            );
        }
    }

    /**
     * Create JT reader from buffer
     */
    private createReader(_buffer: ArrayBuffer): any {
        // Placeholder - would use actual JT Open Toolkit
        throw new Error('JT reader not yet implemented');
    }

    /**
     * Process a single JT part asynchronously to avoid blocking UI
     */
    private processPartAsync(part: JTPart, meshes: BABYLON.Mesh[]): Promise<void> {
        return new Promise((resolve) => {
            const callback = (typeof requestIdleCallback !== 'undefined')
                ? requestIdleCallback
                : (cb: any) => setTimeout(cb, 0);

            callback(() => {
                try {
                    const mesh = this.createMeshFromPart(part);
                    meshes.push(mesh);
                    resolve();
                } catch (e) {
                    console.error(`Failed to create mesh from part ${part.name}:`, e);
                    resolve(); // Continue with other parts
                }
            });
        });
    }

    /**
     * Create Babylon.js mesh from JT part
     */
    private createMeshFromPart(part: JTPart): BABYLON.Mesh {
        // Get highest quality LOD
        const lod0 = part.getLOD(0);

        const babylonMesh = new BABYLON.Mesh(part.name);

        // Convert JT tessellation to Babylon.js geometry
        const vertexData = new BABYLON.VertexData();

        // Apply coordinate conversion from JT (right-handed) to Babylon (left-handed)
        vertexData.positions = convertJTToBabylonCoordinates(lod0.vertices);
        vertexData.indices = reverseTriangleWinding(lod0.indices);

        // Compute or convert normals
        if (lod0.normals) {
            vertexData.normals = convertJTToBabylonCoordinates(lod0.normals);
        } else {
            const normals: number[] = [];
            BABYLON.VertexData.ComputeNormals(
                vertexData.positions,
                vertexData.indices,
                normals
            );
            vertexData.normals = normals;
        }

        if (lod0.uvs) {
            vertexData.uvs = lod0.uvs;
        }

        vertexData.applyToMesh(babylonMesh);

        // Store JT metadata
        babylonMesh.metadata = {
            jtPartId: part.id,
            lodLevels: part.lodCount,
            pmi: part.getPMI(),
            sourceFormat: 'jt'
        };

        return babylonMesh;
    }
}

/**
 * Log hierarchical tree structure for debugging
 * @param node - Root node to start logging from
 * @param depth - Current depth level
 * @param prefix - Prefix for tree visualization
 */
function logTreeStructure(
    node: BABYLON.Node,
    depth: number = 0,
    prefix: string = ''
): void {
    const indent = '  '.repeat(depth);
    const nodeType = node instanceof BABYLON.Mesh ? 'Mesh' :
                    node instanceof BABYLON.TransformNode ? 'Transform' : 'Node';

    console.log(
        `${indent}${prefix}${node.name} [${nodeType}] ` +
        `(children: ${node.getChildren().length})`
    );

    // Recursively log children
    const children = node.getChildren();
    children.forEach((child, index) => {
        const isLast = index === children.length - 1;
        const childPrefix = isLast ? '└─ ' : '├─ ';
        logTreeStructure(child, depth + 1, childPrefix);
    });
}
