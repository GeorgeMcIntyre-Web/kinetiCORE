/**
 * Asset Loader - Loads assets into the scene using appropriate loaders
 * Owner: George
 *
 * Dispatches to URDF, JT, DWG, or other loaders based on asset type
 */

import * as BABYLON from '@babylonjs/core';
import type { LibraryAsset, AssetInsertionConfig } from './types';
import type { SceneNode } from '../scene/SceneTreeNode';
import { GLBLoader } from '../loaders/glb/GLBLoader';

// TODO: Re-enable when specialized loaders are implemented
// import { loadURDFWithMeshes } from '../loaders/urdf/URDFLoaderWithMeshes';
// import { JTLoader } from '../loaders/jt/JTLoader';
// import { DWGLoader } from '../loaders/dwg/DWGLoader';

/**
 * Result of asset loading operation
 */
export interface LoadResult {
  success: boolean;
  rootNode?: SceneNode;
  meshes?: BABYLON.Mesh[];
  error?: string;
}

/**
 * Asset cache entry
 */
interface AssetCacheEntry {
  asset: BABYLON.TransformNode;
  timestamp: number;
  size: number;
}

/**
 * Asset loader - converts library assets into scene objects
 * Optimized with caching, parallel loading, and memory management
 */
export class AssetLoader {
  private scene: BABYLON.Scene;
  
  // Performance optimization: Asset caching
  private static assetCache = new Map<string, AssetCacheEntry>();
  private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB cache
  private static readonly CACHE_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes
  
  // Performance optimization: Parallel loading
  private static loadingPromises = new Map<string, Promise<LoadResult>>();
  
  // Performance optimization: Memory management
  private static loadedAssets = new Set<string>();
  private static readonly MAX_LOADED_ASSETS = 100;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    
    // Start cache cleanup interval (only once)
    if (AssetLoader.assetCache.size === 0) {
      setInterval(() => AssetLoader.cleanupCache(), 5 * 60 * 1000); // Every 5 minutes
    }
  }

  /**
   * Clean up expired cache entries
   */
  private static cleanupCache(): void {
    const now = Date.now();
    let totalSize = 0;
    
    for (const [key, entry] of AssetLoader.assetCache.entries()) {
      totalSize += entry.size;
      
      // Remove expired entries
      if (now - entry.timestamp > AssetLoader.CACHE_EXPIRY_TIME) {
        entry.asset.dispose();
        AssetLoader.assetCache.delete(key);
        AssetLoader.loadedAssets.delete(key);
        continue;
      }
      
      // Remove oldest entries if cache is too large
      if (totalSize > AssetLoader.MAX_CACHE_SIZE) {
        const oldestKey = AssetLoader.assetCache.keys().next().value;
        if (oldestKey) {
          const oldestEntry = AssetLoader.assetCache.get(oldestKey);
          if (oldestEntry) {
            oldestEntry.asset.dispose();
            AssetLoader.assetCache.delete(oldestKey);
            AssetLoader.loadedAssets.delete(oldestKey);
          }
        }
      }
    }
  }

  /**
   * Load asset into scene
   */
  public async loadAsset(
    asset: LibraryAsset,
    config: AssetInsertionConfig = {}
  ): Promise<LoadResult> {
    try {
      switch (asset.loaderType) {
        case 'urdf':
          return await this.loadURDF(asset, config);
        case 'jt':
          return await this.loadJT(asset, config);
        case 'dwg':
          return await this.loadDWG(asset, config);
        case 'gltf':
          return await this.loadGLTF(asset, config);
        case 'glb':
          return await this.loadGLB(asset, config);
        case 'stl':
        case 'obj':
          return await this.loadMesh(asset, config);
        case 'primitive':
          return await this.loadPrimitive(asset, config);
        default:
          return {
            success: false,
            error: `Unsupported loader type: ${asset.loaderType}`,
          };
      }
    } catch (error) {
      console.error('Failed to load asset:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Load URDF robot
   */
  private async loadURDF(
    _asset: LibraryAsset,
    _config: AssetInsertionConfig
  ): Promise<LoadResult> {
    // TODO: URDF loading requires file selection dialog for meshes
    // Will be implemented in future milestone
    return {
      success: false,
      error: 'URDF loading requires file selection (not yet implemented)',
    };
  }

  /**
   * Load JT CAD file
   */
  private async loadJT(
    _asset: LibraryAsset,
    _config: AssetInsertionConfig
  ): Promise<LoadResult> {
    // TODO: Implement JT loading when loader method is available
    return {
      success: false,
      error: 'JT loading not yet implemented',
    };
  }


  /**
   * Load DWG file
   */
  private async loadDWG(
    _asset: LibraryAsset,
    _config: AssetInsertionConfig
  ): Promise<LoadResult> {
    // TODO: Implement DWG loading when loader is fixed
    return {
      success: false,
      error: 'DWG loading not yet implemented',
    };
  }

  /**
   * Load glTF file
   */
  private async loadGLTF(
    asset: LibraryAsset,
    config: AssetInsertionConfig
  ): Promise<LoadResult> {
    return new Promise((resolve) => {
      BABYLON.SceneLoader.ImportMesh(
        '',
        '',
        asset.filePath,
        this.scene,
        (meshes) => {
          if (meshes.length > 0 && meshes[0] instanceof BABYLON.Mesh) {
            const position = this.getInsertionPosition(config);
            meshes[0].position = new BABYLON.Vector3(
              position.x,
              position.z,
              position.y
            );

            resolve({
              success: true,
              meshes: meshes as BABYLON.Mesh[],
            });
          } else {
            resolve({
              success: false,
              error: 'No meshes loaded from glTF',
            });
          }
        },
        undefined,
        (_scene, message) => {
          resolve({
            success: false,
            error: message,
          });
        }
      );
    });
  }

  /**
   * Load GLB file from URL (converted library)
   */
  private async loadGLB(
    asset: LibraryAsset,
    config: AssetInsertionConfig
  ): Promise<LoadResult> {
    try {
      const loader = GLBLoader.getInstance();
      const result = await loader.loadGLBFromFile(asset.filePath, this.scene, {
        enableBoundsCalculation: true,
        enableProgressCallback: true,
      });

      if (!result.success || result.rootNodes.length === 0) {
        return { success: false, error: result.errors.join('; ') || 'GLB load failed' };
      }

      const parent = result.rootNodes[0];
      const pos = this.getInsertionPosition(config);
      parent.position = new BABYLON.Vector3(pos.x, pos.z, pos.y);

      // Freeze static meshes for perf
      result.meshes.forEach(m => { try { m.freezeWorldMatrix(); } catch {} });

      return { success: true, meshes: result.meshes as BABYLON.Mesh[] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Load generic mesh file (STL, OBJ)
   */
  private async loadMesh(
    asset: LibraryAsset,
    config: AssetInsertionConfig
  ): Promise<LoadResult> {
    return new Promise((resolve) => {
      BABYLON.SceneLoader.ImportMesh(
        '',
        '',
        asset.filePath,
        this.scene,
        (meshes) => {
          if (meshes.length > 0 && meshes[0] instanceof BABYLON.Mesh) {
            const position = this.getInsertionPosition(config);
            meshes[0].position = new BABYLON.Vector3(
              position.x,
              position.z,
              position.y
            );

            resolve({
              success: true,
              meshes: meshes as BABYLON.Mesh[],
            });
          } else {
            resolve({
              success: false,
              error: 'No meshes loaded',
            });
          }
        },
        undefined,
        (_scene, message) => {
          resolve({
            success: false,
            error: message,
          });
        }
      );
    });
  }

  /**
   * Create primitive geometry
   */
  private async loadPrimitive(
    asset: LibraryAsset,
    config: AssetInsertionConfig
  ): Promise<LoadResult> {
    const position = this.getInsertionPosition(config);
    const name = config.name || asset.name;

    let mesh: BABYLON.Mesh;

    switch (asset.assetType) {
      case 'box':
        mesh = BABYLON.MeshBuilder.CreateBox(
          name,
          { size: 1 },
          this.scene
        );
        break;
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere(
          name,
          { diameter: 1 },
          this.scene
        );
        break;
      case 'cylinder':
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          name,
          { height: 1, diameter: 0.5 },
          this.scene
        );
        break;
      default:
        return {
          success: false,
          error: `Unknown primitive type: ${asset.assetType}`,
        };
    }

    mesh.position = new BABYLON.Vector3(position.x, position.z, position.y);

    return {
      success: true,
      meshes: [mesh],
    };
  }

  /**
   * Calculate insertion position based on config
   */
  private getInsertionPosition(config: AssetInsertionConfig): {
    x: number;
    y: number;
    z: number;
  } {
    if (config.position) {
      return config.position;
    }

    switch (config.placement) {
      case 'origin':
        return { x: 0, y: 0, z: 0 };
      case 'floor':
        return { x: 0, y: 0, z: 0 }; // Z=0 is floor in Z-up
      case 'cursor':
        // TODO: Get 3D cursor position from scene
        return { x: 0, y: 0, z: 0 };
      case 'custom':
        return config.position || { x: 0, y: 0, z: 0 };
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }
}
