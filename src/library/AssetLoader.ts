/**
 * Asset Loader - Loads assets into the scene using appropriate loaders
 * Owner: George
 *
 * Dispatches to URDF, JT, DWG, or other loaders based on asset type
 */

import * as BABYLON from '@babylonjs/core';
import type { LibraryAsset, AssetInsertionConfig } from './types';
// import { loadURDFWithMeshes } from '../loaders/urdf/URDFLoaderWithMeshes';
// import { JTLoader } from '../loaders/jt/JTLoader';
// import { DWGLoader } from '../loaders/dwg/DWGLoader';
import type { SceneNode } from '../scene/SceneTreeNode';

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
 * Asset loader - converts library assets into scene objects
 */
export class AssetLoader {
  private scene: BABYLON.Scene;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
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
   * Load JT CAD file (old version - disabled)
   */
  // @ts-expect-error - Unused method kept for future implementation
  private async loadJTOld(
    asset: LibraryAsset,
    config: AssetInsertionConfig
  ): Promise<LoadResult> {
    try {
      const response = await fetch(asset.filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch JT file: ${response.statusText}`);
      }
      await response.arrayBuffer();

      const result = { meshes: [], rootMesh: null } as any;

      // Position the loaded meshes
      if (result.rootMesh) {
        const position = this.getInsertionPosition(config);
        result.rootMesh.position = new BABYLON.Vector3(
          position.x,
          position.z, // Z-up to Y-up
          position.y
        );
      }

      return {
        success: true,
        meshes: result.meshes,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
