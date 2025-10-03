/**
 * CATIA file loader using PyOpenJt backend conversion service
 * Supports CATPart, CATProduct, CATDrawing, CATProcess → GLTF conversion
 * Reuses JT conversion infrastructure
 */

import * as BABYLON from '@babylonjs/core';
import { JTConversionService, JTConversionError } from '../jt/JTConversionService';
import { JTImportError, JTErrorType } from '../jt/errors';

/**
 * Load CATIA file via PyOpenJt backend conversion to GLTF
 *
 * @param file - CATIA file to load
 * @param scene - Babylon.js scene
 * @returns Promise resolving to loaded meshes and root nodes
 *
 * @throws {JTImportError} When conversion or loading fails
 */
export async function loadCATIAFromFile(
    file: File,
    scene: BABYLON.Scene
): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
    // Reuse JT conversion service (same backend handles both formats)
    const converter = new JTConversionService();

    try {
        // Check if backend is available
        const health = await converter.checkHealth();

        if (health.status === 'unhealthy') {
            throw new JTImportError(
                JTErrorType.WASMNotLoaded,
                `CATIA conversion backend is not available.\n\n` +
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

        console.log(`[CATIA Import] Converting ${file.name} to GLTF...`);

        // Convert CATIA → GLTF (same endpoint handles both JT and CATIA)
        const gltfBlob = await converter.convertToGLB(file, (progress) => {
            console.log(`[CATIA Import] ${progress.message} (${progress.percent}%)`);
        });

        console.log(`[CATIA Import] Conversion complete, loading GLTF...`);

        // Load the converted GLTF file
        const gltfFile = new File([gltfBlob], file.name.replace(/\.(catpart|catproduct|catdrawing|catprocess)$/i, '.gltf'), {
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

        console.log(`[CATIA Import] Loaded ${result.meshes.length} meshes from ${file.name}`);

        // Flatten hierarchy: Move all meshes to root level
        const flattenedMeshes: BABYLON.AbstractMesh[] = [];
        const rootNode = new BABYLON.TransformNode(file.name.replace(/\.(catpart|catproduct|catdrawing|catprocess)$/i, ''), scene);

        result.meshes.forEach(mesh => {
            // Skip root __root__ nodes that Babylon creates
            if (mesh.name === '__root__') {
                return;
            }

            // Bake the transform from the hierarchy
            if (mesh.parent) {
                // Compute world matrix
                mesh.computeWorldMatrix(true);
                const worldMatrix = mesh.getWorldMatrix();

                // Remove from parent
                mesh.setParent(null);

                // Apply the baked transform
                worldMatrix.decompose(mesh.scaling, mesh.rotationQuaternion!, mesh.position);
            }

            // Attach to our flat root node
            mesh.setParent(rootNode);

            // Add CATIA metadata
            if (!mesh.metadata) {
                mesh.metadata = {};
            }
            mesh.metadata.sourceFormat = 'catia';
            mesh.metadata.originalFile = file.name;
            mesh.metadata.convertedVia = 'pyopenjt';

            // Detect CATIA file type from extension
            const extension = file.name.toLowerCase().match(/\.(catpart|catproduct|catdrawing|catprocess)$/)?.[1];
            mesh.metadata.catiaType = extension;

            flattenedMeshes.push(mesh);
        });

        // Clean up old transform nodes
        result.transformNodes.forEach(node => {
            if (node.name !== '__root__' && node !== rootNode) {
                node.dispose();
            }
        });

        console.log(`[CATIA Import] Flattened to ${flattenedMeshes.length} meshes under root node`);

        return {
            meshes: flattenedMeshes,
            rootNodes: [rootNode]
        };

    } catch (error) {
        // Handle conversion errors
        if (error instanceof JTConversionError) {
            const helpfulMessage = JTConversionService.getHelpfulErrorMessage(error);
            throw new JTImportError(
                JTErrorType.CorruptedFile,
                helpfulMessage.replace(/JT/g, 'CATIA'),  // Replace JT with CATIA in error messages
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
            `Failed to import CATIA file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            false
        );
    }
}
