/**
 * Asset Loader - Loads assets into the scene using appropriate loaders
 * Owner: George
 *
 * Dispatches to URDF, JT, DWG, or other loaders based on asset type
 */

import * as BABYLON from '@babylonjs/core';
import type { LibraryAsset, AssetInsertionConfig } from './types';
import { URDFLoaderWithMeshes } from '../loaders/urdf/URDFLoaderWithMeshes';
import { JTLoader } from '../loaders/jt/JTLoader';
import { DWGLoader } from '../loaders/dwg/DWGLoader';
import { SceneTreeManager } from '../scene/SceneTreeManager';
import { EntityRegistry } from '../entities/EntityRegistry';
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
  private sceneTreeManager: SceneTreeManager;
  private entityRegistry: EntityRegistry;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.sceneTreeManager = SceneTreeManager.getInstance();
    this.entityRegistry = EntityRegistry.getInstance();
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
    asset: LibraryAsset,
    config: AssetInsertionConfig
  ): Promise<LoadResult> {
    const loader = new URDFLoaderWithMeshes(this.scene);

    try {
      const response = await fetch(asset.filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch URDF: ${response.statusText}`);
      }
      const urdfContent = await response.text();

      const robotName = config.name || asset.name;
      const position = this.getInsertionPosition(config);

      const rootNode = await loader.load(urdfContent, robotName, position);

      return {
        success: true,
        rootNode,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Load JT CAD file
   */
  private async loadJT(
    asset: LibraryAsset,
    config: AssetInsertionConfig
  ): Promise<LoadResult> {
    const loader = new JTLoader();

    try {
      const response = await fetch(asset.filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch JT file: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      const options = {
        createPhysics: config.enablePhysics,
        targetLOD: config.targetLOD,
        loadPMI: config.loadPMI,
        loadKinematics: config.loadKinematics,
      };

      const result = await loader.loadFromArrayBuffer(
        this.scene,
        arrayBuffer,
        asset.name
      );

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
    asset: LibraryAsset,
    config: AssetInsertionConfig
  ): Promise<LoadResult> {
    const loader = new DWGLoader();

    try {
      const response = await fetch(asset.filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch DWG file: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      const result = await loader.loadFromArrayBuffer(this.scene, arrayBuffer);

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
        (scene, message) => {
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
        (scene, message) => {
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
