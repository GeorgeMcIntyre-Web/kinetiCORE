// Boolean Operations - CSG2 implementation using Babylon.js + Manifold
// Owner: George (Architecture)

import * as BABYLON from '@babylonjs/core';
import { CSG2, InitializeCSG2Async } from '@babylonjs/core/Meshes/csg2';
import { SceneManager } from './SceneManager';
import { EntityRegistry } from '../entities/EntityRegistry';
import { SceneTreeManager } from './SceneTreeManager';
import { babylonToUser } from '../core/CoordinateSystem';

export type BooleanOperationType = 'union' | 'subtract' | 'intersect';

export interface BooleanOperationResult {
  success: boolean;
  resultMesh?: BABYLON.Mesh;
  error?: string;
}

// Track CSG2 initialization state
let csg2Initialized = false;
let csg2InitPromise: Promise<void> | null = null;

/**
 * Performs Boolean operations on meshes using Babylon.js CSG2
 */
export class BooleanOperations {
  /**
   * Initialize CSG2 library (must be called before any operations)
   */
  static async initialize(): Promise<boolean> {
    if (csg2Initialized) return true;

    // Return existing initialization promise if already in progress
    if (csg2InitPromise) {
      await csg2InitPromise;
      return csg2Initialized;
    }

    try {
      csg2InitPromise = InitializeCSG2Async();
      await csg2InitPromise;
      csg2Initialized = true;
      console.log('CSG2 initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize CSG2:', error);
      csg2InitPromise = null;
      return false;
    }
  }

  /**
   * Perform a Boolean operation between two meshes
   * @param meshA First mesh (base mesh for subtract/intersect)
   * @param meshB Second mesh (tool mesh)
   * @param operation Type of Boolean operation
   * @returns Result object with success status and resulting mesh
   */
  static async performOperation(
    meshA: BABYLON.Mesh,
    meshB: BABYLON.Mesh,
    operation: BooleanOperationType
  ): Promise<BooleanOperationResult> {
    try {
      // Ensure CSG2 is initialized
      if (!csg2Initialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          return {
            success: false,
            error: 'Failed to initialize CSG2 library',
          };
        }
      }

      // Validate inputs
      if (!meshA || !meshB) {
        return {
          success: false,
          error: 'Invalid input meshes',
        };
      }

      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      if (!scene) {
        return {
          success: false,
          error: 'Scene not initialized',
        };
      }

      // Create CSG2 objects from meshes
      const csgA = CSG2.FromMesh(meshA);
      const csgB = CSG2.FromMesh(meshB);

      let resultCSG: CSG2;

      // Perform the Boolean operation using CSG2
      switch (operation) {
        case 'union':
          resultCSG = csgA.add(csgB); // CSG2 uses 'add' for union
          break;
        case 'subtract':
          resultCSG = csgA.subtract(csgB);
          break;
        case 'intersect':
          resultCSG = csgA.intersect(csgB);
          break;
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
          };
      }

      // Convert CSG2 result back to mesh
      const resultMesh = resultCSG.toMesh(
        `${operation}_result`,
        scene
      );

      // Copy material and transform from source mesh
      if (meshA.material) {
        resultMesh.material = meshA.material;
      }
      resultMesh.position = meshA.position.clone();
      resultMesh.rotation = meshA.rotation.clone();
      resultMesh.scaling = meshA.scaling.clone();

      return {
        success: true,
        resultMesh,
      };
    } catch (error) {
      console.error('Boolean operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Perform Boolean operation using node IDs from scene tree
   * Creates new entity and removes old ones
   */
  static async performOperationOnNodes(
    nodeIdA: string,
    nodeIdB: string,
    operation: BooleanOperationType
  ): Promise<BooleanOperationResult> {
    const tree = SceneTreeManager.getInstance();
    const registry = EntityRegistry.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    if (!scene) {
      return {
        success: false,
        error: 'Scene not initialized',
      };
    }

    // Get nodes
    const nodeA = tree.getNode(nodeIdA);
    const nodeB = tree.getNode(nodeIdB);

    if (!nodeA || !nodeB) {
      return {
        success: false,
        error: 'One or both nodes not found',
      };
    }

    // Get meshes
    if (!nodeA.babylonMeshId || !nodeB.babylonMeshId) {
      return {
        success: false,
        error: 'Nodes must have associated meshes',
      };
    }

    const meshA = scene.getMeshByUniqueId(parseInt(nodeA.babylonMeshId));
    const meshB = scene.getMeshByUniqueId(parseInt(nodeB.babylonMeshId));

    if (!meshA || !meshB || !(meshA instanceof BABYLON.Mesh) || !(meshB instanceof BABYLON.Mesh)) {
      return {
        success: false,
        error: 'Could not retrieve meshes',
      };
    }

    // Perform operation
    const result = await this.performOperation(meshA, meshB, operation);

    if (!result.success || !result.resultMesh) {
      return result;
    }

    // Create entity for result
    const entity = registry.create({
      mesh: result.resultMesh,
      physics: {
        enabled: false,
        type: 'dynamic',
        mass: 1.0,
        shape: 'box', // Default shape
        dimensions: { x: 1, y: 1, z: 1 },
      },
      metadata: {
        name: `${operation}_result`,
        type: 'mesh',
      },
    });

    // Create scene tree node
    const assetsNode = tree.getAssetsNode();
    const newNode = tree.createNode(
      'mesh',
      `${operation}_result`,
      assetsNode?.id || null,
      babylonToUser(result.resultMesh.position)
    );

    newNode.babylonMeshId = result.resultMesh.uniqueId.toString();
    newNode.entityId = entity.getId();

    window.dispatchEvent(new Event('scenetree-update'));

    return {
      success: true,
      resultMesh: result.resultMesh,
    };
  }
}
