// Model Loader - Import 3D files in various formats
// Owner: Cole
// Supports: glTF, GLB, OBJ, STL, Babylon, DXF, DWG, JT, CATIA, URDF

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import '@babylonjs/loaders/STL';

// Import Draco decoder for compressed GLB files
import { DracoCompression } from '@babylonjs/core/Meshes/Compression/dracoCompression';

// Import URDF loader
import { loadURDFFromFile } from '../loaders/urdf/URDFLoader';

// Import JT loader
import { loadJTFromFile } from '../loaders/jt/JTLoader';

// Import CATIA loader
import { loadCATIAFromFile } from '../loaders/catia/CATIALoader';

// Import DXF loader
import { DXFController } from '../dxf/DXFController';

// Import DWG loader
import { loadDWGFromFile } from '../loaders/dwg/DWGLoader';

// Import MJCF loader
import { loadMJCFFromFile } from '../loaders/mjcf/MJCFLoader';

// Import GLB loader
import { loadGLBFromFile } from '../loaders/glb/GLBLoader';

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
  DXF: '.dxf',
  DWG: '.dwg',
  JT: '.jt',
  CATPART: '.catpart',
  CATPRODUCT: '.catproduct',
  CATDRAWING: '.catdrawing',
  CATPROCESS: '.catprocess',
  URDF: '.urdf',
  MJCF: '.xml',
  ZIP: '.zip',
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
    '.dxf': 'application/dxf',
    '.dwg': 'application/dwg',
    '.jt': 'application/jt',
    '.catpart': 'application/catia',
    '.catproduct': 'application/catia',
    '.catdrawing': 'application/catia',
    '.catprocess': 'application/catia',
    '.urdf': 'application/xml',
    '.zip': 'application/zip',
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
  scene: BABYLON.Scene,
  meshFiles?: File[]
): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
  const extension = getFileExtension(file.name);

  if (!isSupportedFormat(file.name)) {
    throw new Error(`Unsupported file format: ${extension}`);
  }

  // Handle URDF files specially (they need XML parsing)
  if (extension === '.urdf') {
    return loadURDFFromFile(file, scene);
  }

      // Handle MJCF files (MuJoCo XML) and ZIP archives
      if (extension === '.xml' || extension === '.zip') {
        console.log('[ModelLoader] Detected MJCF file:', file.name);

        // Convert meshFiles array to Map for MJCF loader
        let meshFilesMap: Map<string, File> | undefined;
        if (meshFiles && meshFiles.length > 0) {
          meshFilesMap = new Map();
          meshFiles.forEach(f => {
            meshFilesMap!.set(f.name, f);
          });
          console.log('[ModelLoader] Converted', meshFiles.length, 'mesh files to map');
        }

        try {
          const result = await loadMJCFFromFile(file, scene);
          console.log('[ModelLoader] MJCF import result:', result);
          
          // Debug: Check if meshes are actually in the scene
          console.log('[ModelLoader] MJCF Debug - Scene mesh count:', scene.meshes.length);
          console.log('[ModelLoader] MJCF Debug - Scene transform node count:', scene.transformNodes.length);
          
          // Check if our meshes are in the scene
          result.meshes.forEach((mesh, index) => {
            const inScene = scene.meshes.includes(mesh);
            console.log(`[ModelLoader] MJCF Debug - Mesh ${index} (${mesh.name}) in scene:`, inScene);
            if (!inScene) {
              console.log(`[ModelLoader] MJCF Debug - Mesh ${mesh.name} NOT in scene! Adding manually...`);
              scene.meshes.push(mesh);
            }
          });
          
          // Fit camera to imported meshes if bounds are available
          if (result.bounds && result.meshes.length > 0) {
            console.log('[ModelLoader] Fitting camera to MJCF bounds:', result.bounds);
            // This will be handled by the scene manager
            (result as any).cameraBounds = result.bounds;
          }
          
          return {
            meshes: result.meshes,
            rootNodes: result.rootNodes || []
          };
        } catch (error) {
          console.error('[ModelLoader] MJCF import failed:', error);
          throw error;
        }
      }

  // Handle GLB files with MJCF-compatible interface
  if (extension === '.glb') {
    console.log('[ModelLoader] Detected GLB file:', file.name);
    
    try {
      // Load GLB with comprehensive error handling and guard rails
      const result = await loadGLBFromFile(file, scene, {
        enableProgressCallback: true,
        enableBoundsCalculation: true,
        enableMetadataExtraction: true,
        fallbackToBasicLoader: true,
        onProgress: (progress, message) => {
          console.log(`[ModelLoader] GLB Progress: ${progress}% - ${message}`);
        }
      });

      console.log('[ModelLoader] GLB import result:', result);
      
      // Guard rail: Validate result structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid GLB load result structure');
      }

      // Guard rail: Check for critical errors
      if (result.errors && result.errors.length > 0) {
        console.warn('[ModelLoader] GLB load completed with errors:', result.errors);
      }

      // Guard rail: Ensure meshes are in scene
      if (result.meshes && result.meshes.length > 0) {
        result.meshes.forEach((mesh, index) => {
          const inScene = scene.meshes.includes(mesh);
          if (!inScene) {
            console.log(`[ModelLoader] GLB Debug - Mesh ${index} (${mesh.name}) not in scene, adding manually...`);
            scene.meshes.push(mesh);
          }
        });
      }

      // Guard rail: Handle bounds for camera fitting
      if (result.bounds && result.meshes && result.meshes.length > 0) {
        console.log('[ModelLoader] Fitting camera to GLB bounds:', result.bounds);
        (result as any).cameraBounds = result.bounds;
      }

      // Guard rail: Log warnings for user awareness
      if (result.warnings && result.warnings.length > 0) {
        console.warn('[ModelLoader] GLB load warnings:', result.warnings);
      }

      // Return MJCF-compatible structure
      return {
        meshes: result.meshes || [],
        rootNodes: result.rootNodes || []
      };

    } catch (error) {
      console.error('[ModelLoader] GLB import failed:', error);
      
      // Guard rail: Provide fallback error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown GLB loading error';
      throw new Error(`GLB import failed: ${errorMessage}`);
    }
  }

  // Handle DXF files
  if (extension === '.dxf') {
    return loadDXFFromFile(file, scene);
  }

  // Handle DWG files with millimeter to meter conversion
  if (extension === '.dwg') {
    return loadDWGFromFile(file, scene, {
      unitScale: 0.001, // Convert mm to meters
      onProgress: (progress) => console.log(`DWG Import: ${progress.message}`),
      // Uncomment to limit entities for testing: maxEntities: 500
    });
  }

  // Handle JT files
  if (extension === '.jt') {
    return loadJTFromFile(file, scene);
  }

  // Handle CATIA files
  if (extension === '.catpart' || extension === '.catproduct' ||
      extension === '.catdrawing' || extension === '.catprocess') {
    return loadCATIAFromFile(file, scene);
  }

  // Standard Babylon.js loader for other formats
  return new Promise((resolve, reject) => {
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
        (meshes, _particleSystems, _skeletons, _animationGroups, transformNodes) => {
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

          // Find root nodes (nodes with no parent or parent not in the loaded set)
          const allNodes = [...transformNodes, ...meshes];
          const nodeSet = new Set(allNodes);
          const rootNodes = allNodes.filter(node => {
            if (!node.parent) return true;
            if (!nodeSet.has(node.parent as BABYLON.TransformNode)) return true;
            return false;
          }) as BABYLON.TransformNode[];

          resolve({ meshes, rootNodes });
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
 * Load DXF file using DXF Controller
 */
async function loadDXFFromFile(file: File, scene: BABYLON.Scene): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
  const controller = new DXFController(scene);

  const result = await controller.importFile(file, {}, {
    mergeByLayer: true,
    extrusionThickness: 0.1,
  });

  // Get all meshes from the result
  const meshes: BABYLON.AbstractMesh[] = [];
  Object.values(result.layerGroups).forEach(layerGroup => {
    meshes.push(...layerGroup.meshes);
  });

  // The root node is the parent of layer groups if it exists
  const rootNodes: BABYLON.TransformNode[] = [];
  if (meshes.length > 0 && meshes[0].parent) {
    const parent = meshes[0].parent;
    if (parent instanceof BABYLON.TransformNode && !rootNodes.includes(parent)) {
      rootNodes.push(parent);
    }
  }

  // If no parent, treat individual meshes as root nodes
  if (rootNodes.length === 0) {
    rootNodes.push(...meshes.filter(m => !m.parent));
  }

  return { meshes, rootNodes };
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
  return 'glTF (.gltf, .glb), Wavefront (.obj), STL (.stl), Babylon (.babylon), DXF (.dxf), DWG (.dwg), JT (.jt), URDF (.urdf), ZIP (.zip)';
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

/**
 * Get all children (TransformNodes and Meshes)
 * Only returns DIRECT children, filtering out duplicates
 */
export function getAllChildren(node: BABYLON.TransformNode): BABYLON.TransformNode[] {
  const allChildren = node.getChildren((child): child is BABYLON.TransformNode => {
    return child instanceof BABYLON.TransformNode;
  }, false);

  // Filter out duplicates: keep only nodes whose direct parent is the current node
  return allChildren.filter(child => child.parent === node);
}
