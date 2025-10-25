// OBJ Loader for kinetiCORE
// Loads Wavefront OBJ files with coordinate system conversion
// Supports both direct .obj files and .zip files containing OBJ + MTL
// Owner: George (Agent 3 - Frontend Integration)

import * as BABYLON from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/OBJ'; // OBJ loader plugin
import JSZip from 'jszip';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';

export interface OBJLoadResult {
  success: boolean;
  meshes: BABYLON.AbstractMesh[];
  errorMessage?: string;
}

/**
 * Extract OBJ and MTL files from a ZIP archive
 */
async function extractOBJFromZip(file: File): Promise<{ objFile: File; mtlFile?: File; modelName: string }> {
  const zip = new JSZip();
  const zipData = await zip.loadAsync(file);

  let objFile: File | null = null;
  let mtlFile: File | null = null;
  let modelName = '';

  // Find OBJ and MTL files in the ZIP
  for (const [path, zipEntry] of Object.entries(zipData.files)) {
    if (zipEntry.dir) continue;

    const fileName = path.split('/').pop() || '';

    if (fileName.toLowerCase().endsWith('.obj')) {
      const blob = await zipEntry.async('blob');
      objFile = new File([blob], fileName, { type: 'model/obj' });
      modelName = fileName.replace(/\.(obj|OBJ)$/, '');
      console.log(`[OBJ Loader] Found OBJ file in ZIP: ${fileName}`);
    } else if (fileName.toLowerCase().endsWith('.mtl')) {
      const blob = await zipEntry.async('blob');
      mtlFile = new File([blob], fileName, { type: 'model/mtl' });
      console.log(`[OBJ Loader] Found MTL file in ZIP: ${fileName}`);
    }
  }

  if (!objFile) {
    throw new Error('No OBJ file found in ZIP archive');
  }

  return { objFile, mtlFile: mtlFile || undefined, modelName };
}

/**
 * Loads an OBJ file into the Babylon scene with proper coordinate conversion
 * kinetiCORE uses Z-up internally (matching CAD/ROS), OBJ files are typically Z-up
 *
 * @param file - The OBJ file or ZIP file containing OBJ to load
 * @param scene - The Babylon scene to load into
 * @returns Promise with load result
 */
export async function loadOBJFile(
  file: File,
  scene: BABYLON.Scene
): Promise<OBJLoadResult> {
  try {
    console.log(`[OBJ Loader] Loading file: ${file.name}`);

    let objFile: File = file;
    let modelName: string;

    // Check if it's a ZIP file
    if (file.name.toLowerCase().endsWith('.zip')) {
      console.log('[OBJ Loader] ZIP file detected, extracting...');
      const extracted = await extractOBJFromZip(file);
      objFile = extracted.objFile;
      // Note: mtlFile is intentionally not used - we strip MTL references to avoid blob URL issues
      modelName = extracted.modelName;
    } else {
      modelName = file.name.replace(/\.(obj|OBJ)$/, '');
    }

    // Read OBJ file content to remove MTL reference (causes blob URL issues)
    const objText = await objFile.text();
    const objTextWithoutMTL = objText
      .split('\n')
      .filter(line => !line.trim().startsWith('mtllib'))
      .join('\n');

    // Create blob without MTL reference
    const modifiedObjBlob = new Blob([objTextWithoutMTL], { type: 'text/plain' });
    const objUrl = URL.createObjectURL(modifiedObjBlob);

    try {
      // Load OBJ file using Babylon's built-in loader
      // For blob URLs, pass the full URL as sceneFilename and empty rootUrl
      const result = await SceneLoader.ImportMeshAsync(
        '',              // meshNames (empty = all)
        '',              // rootUrl (empty for blob URLs)
        objUrl,          // sceneFilename (full blob URL)
        scene,
        undefined,       // onProgress
        '.obj'           // pluginExtension
      );

      console.log(`[OBJ Loader] Loaded without MTL to avoid blob URL issues`);

      console.log(`[OBJ Loader] Loaded ${result.meshes.length} meshes from Babylon`);

      // Filter out root/parent nodes
      const actualMeshes = result.meshes.filter(m => m.name !== '__root__');

      console.log(`[OBJ Loader] Actual meshes to process: ${actualMeshes.length}`);
      actualMeshes.forEach(m => {
        console.log(`  - ${m.name}: vertices=${m.getTotalVertices()}, material=${m.material?.name || 'none'}`);
      });

      // Get entity registry and scene tree
      const registry = EntityRegistry.getInstance();
      const tree = SceneTreeManager.getInstance();
      const assetsNode = tree.getAssetsNode();

      // Create a parent node for this model in the scene tree
      const modelNode = tree.createNode(
        'collection',
        modelName,
        assetsNode?.id || null
      );

      // Process each mesh
      actualMeshes.forEach((mesh) => {
        if (!mesh) return;

        const babylonMesh = mesh as BABYLON.Mesh;

        // OBJ files are typically in Z-up, same as kinetiCORE
        // No coordinate conversion needed, but ensure proper world matrix
        babylonMesh.computeWorldMatrix(true);

        // Force recompute normals to fix rendering issues
        // This ensures all faces have proper lighting
        if (babylonMesh.geometry) {
          const positions = babylonMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
          const indices = babylonMesh.getIndices();

          if (positions && indices) {
            // Recompute normals with proper smoothing
            const normals: number[] = [];
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);
            babylonMesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals, true);

            console.log(`[OBJ Loader] Recomputed normals for ${mesh.name}`);
          }
        }

        // Fix materials - ensure they're visible and double-sided
        if (babylonMesh.material) {
          const mat = babylonMesh.material as BABYLON.StandardMaterial;
          if (mat) {
            mat.backFaceCulling = false; // Show both sides
            mat.twoSidedLighting = true; // Light both sides

            // Ensure material is visible (not transparent)
            if (mat.alpha !== undefined && mat.alpha < 1) {
              mat.alpha = 1.0;
            }

            // Force wireframe off
            mat.wireframe = false;

            // Ensure diffuse color exists
            if (!mat.diffuseColor || mat.diffuseColor.r === 0 && mat.diffuseColor.g === 0 && mat.diffuseColor.b === 0) {
              mat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
            }
          }
        } else {
          // No material - create a default one
          const defaultMat = new BABYLON.StandardMaterial(`${mesh.name}_mat`, scene);
          defaultMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
          defaultMat.backFaceCulling = false;
          defaultMat.twoSidedLighting = true;
          babylonMesh.material = defaultMat;

          console.log(`[OBJ Loader] Created default material for ${mesh.name}`);
        }

        // Create entity for this mesh (without physics for now)
        try {
          const entity = registry.create({
            mesh: babylonMesh,
            physics: {
              enabled: false  // Disable physics - just visual geometry
            }
          });

          // Add to scene tree under model node
          if (entity) {
            tree.createNode(
              'mesh',
              mesh.name || 'mesh',
              modelNode.id
            );

            console.log(`[OBJ Loader] Added mesh: ${mesh.name}`);
          }
        } catch (error) {
          console.error(`[OBJ Loader] Failed to register mesh ${mesh.name}:`, error);
        }
      });

      console.log(`[OBJ Loader] Successfully loaded ${actualMeshes.length} meshes from ${modelName}`);

      return {
        success: true,
        meshes: actualMeshes,
      };

    } finally {
      // Clean up object URL
      URL.revokeObjectURL(objUrl);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[OBJ Loader] Load failed:', error);

    return {
      success: false,
      meshes: [],
      errorMessage,
    };
  }
}

/**
 * Check if a file is an OBJ file or ZIP containing OBJ based on extension
 */
export function isOBJFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.obj') || name.endsWith('.zip');
}
