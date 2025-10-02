// Model Loader - Import 3D files in various formats
// Owner: Cole
// Supports: glTF, GLB, OBJ, STL, Babylon

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import '@babylonjs/loaders/STL';

// Import Draco decoder for compressed GLB files
import { DracoCompression } from '@babylonjs/core/Meshes/Compression/dracoCompression';

// Configure Draco decoder
DracoCompression.Configuration = {
  decoder: {
    wasmUrl: 'https://preview.babylonjs.com/draco_wasm_wrapper_gltf.js',
    wasmBinaryUrl: 'https://preview.babylonjs.com/draco_decoder_gltf.wasm',
    fallbackUrl: 'https://preview.babylonjs.com/draco_decoder_gltf.js',
  },
};

/**
 * Supported 3D file formats
 */
export const SUPPORTED_FORMATS = {
  GLTF: '.gltf',
  GLB: '.glb',
  OBJ: '.obj',
  STL: '.stl',
  BABYLON: '.babylon',
} as const;

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.toLowerCase().substring(filename.lastIndexOf('.'));
}

/**
 * Check if file format is supported
 */
export function isSupportedFormat(filename: string): boolean {
  const ext = getFileExtension(filename);
  return Object.values(SUPPORTED_FORMATS).includes(ext as typeof SUPPORTED_FORMATS[keyof typeof SUPPORTED_FORMATS]);
}

/**
 * Get MIME type for file extension
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.gltf': 'model/gltf+json',
    '.glb': 'model/gltf-binary',
    '.obj': 'text/plain',
    '.stl': 'application/octet-stream',
    '.babylon': 'application/json',
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Load 3D model from file
 *
 * @param file - File object from input element
 * @param scene - Babylon.js scene
 * @returns Promise resolving to loaded meshes
 */
export async function loadModelFromFile(
  file: File,
  scene: BABYLON.Scene
): Promise<BABYLON.AbstractMesh[]> {
  return new Promise((resolve, reject) => {
    const extension = getFileExtension(file.name);

    if (!isSupportedFormat(file.name)) {
      reject(new Error(`Unsupported file format: ${extension}`));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const data = event.target?.result;
      if (!data) {
        reject(new Error('Failed to read file'));
        return;
      }

      // Create blob URL for the file
      const blob = new Blob([data], { type: getMimeType(extension) });
      const url = URL.createObjectURL(blob);

      // Extract filename without extension for use as base name
      const baseName = file.name.substring(0, file.name.lastIndexOf('.'));

      // Load the model using SceneLoader
      BABYLON.SceneLoader.ImportMesh(
        '',           // Import all meshes
        '',           // Root URL (using blob URL instead)
        url,          // Filename (blob URL)
        scene,
        (meshes) => {
          // Clean up blob URL
          URL.revokeObjectURL(url);

          // Set mesh names based on filename
          meshes.forEach((mesh, index) => {
            if (meshes.length === 1) {
              mesh.name = baseName;
            } else {
              mesh.name = mesh.name || `${baseName}_${index}`;
            }
          });

          resolve(meshes);
        },
        null,         // Progress callback (optional)
        (_scene, message) => {
          // Error callback
          URL.revokeObjectURL(url);
          reject(new Error(`Failed to load model: ${message}`));
        },
        extension     // File extension hint
      );
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    // Read file as ArrayBuffer
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get accepted file types string for input element
 */
export function getAcceptedFileTypes(): string {
  return Object.values(SUPPORTED_FORMATS).join(',');
}

/**
 * Get human-readable format description
 */
export function getFormatDescription(): string {
  return 'glTF (.gltf, .glb), Wavefront (.obj), STL (.stl), Babylon (.babylon)';
}

/**
 * Build hierarchical mesh structure
 * Returns root meshes (meshes with no parent, or parent is not another mesh in the list)
 */
export function getRootMeshes(meshes: BABYLON.AbstractMesh[]): BABYLON.AbstractMesh[] {
  const meshSet = new Set(meshes);
  return meshes.filter(mesh => {
    // No parent = root
    if (!mesh.parent) return true;

    // Parent is not a mesh = root (parent is TransformNode, etc.)
    if (!(mesh.parent instanceof BABYLON.AbstractMesh)) return true;

    // Parent is a mesh but not in our imported meshes list = root
    if (!meshSet.has(mesh.parent as BABYLON.AbstractMesh)) return true;

    return false;
  });
}

/**
 * Get direct children of a mesh
 */
export function getChildMeshes(mesh: BABYLON.AbstractMesh): BABYLON.AbstractMesh[] {
  return mesh.getChildren((node): node is BABYLON.AbstractMesh => {
    return node instanceof BABYLON.AbstractMesh;
  }, false);
}
