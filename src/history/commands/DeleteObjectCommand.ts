// Delete Object Command - Undo/Redo for object deletion
// Owner: George (Architecture)

import * as BABYLON from '@babylonjs/core';
import { Command } from '../Command';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import { babylonToUser } from '../../core/CoordinateSystem';
// Removed editorStore import to break circular dependency - callbacks used instead

interface ObjectSnapshot {
  meshData: {
    name: string;
    type: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scaling: { x: number; y: number; z: number };
    materialColor?: { r: number; g: number; b: number };
  };
  nodeData: {
    name: string;
    type: string;
    parentId: string | null;
  };
  physicsEnabled: boolean;
}

export class DeleteObjectCommand extends Command {
  description: string;
  private snapshot: ObjectSnapshot | null = null;
  private createObjectCallback?: (type: any) => void;
  private updateCallbacks?: {
    updateNodePosition: (nodeId: string, position: any) => void;
    updateNodeRotation: (nodeId: string, rotation: any) => void;
    updateNodeScale: (nodeId: string, scale: any) => void;
  };

  constructor(
    private readonly nodeId: string,
    callbacks?: {
      createObject?: (type: any) => void;
      updateNodePosition?: (nodeId: string, position: any) => void;
      updateNodeRotation?: (nodeId: string, rotation: any) => void;
      updateNodeScale?: (nodeId: string, scale: any) => void;
    }
  ) {
    super();
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    this.description = `Delete ${node?.name || 'object'}`;
    
    // Store callbacks for undo
    this.createObjectCallback = callbacks?.createObject;
    if (callbacks?.updateNodePosition && callbacks?.updateNodeRotation && callbacks?.updateNodeScale) {
      this.updateCallbacks = {
        updateNodePosition: callbacks.updateNodePosition,
        updateNodeRotation: callbacks.updateNodeRotation,
        updateNodeScale: callbacks.updateNodeScale,
      };
    }
  }

  execute(): void {
    const tree = SceneTreeManager.getInstance();
    const registry = EntityRegistry.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    const node = tree.getNode(this.nodeId);
    if (!node || !scene) {
      throw new Error('Node or scene not found');
    }

    // Create snapshot before deletion
    if (node.babylonMeshId) {
      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
      if (mesh && mesh instanceof BABYLON.Mesh) {
        const material = mesh.material as BABYLON.StandardMaterial;

        this.snapshot = {
          meshData: {
            name: mesh.name,
            type: node.type || 'mesh',
            position: babylonToUser(mesh.position),
            rotation: {
              x: (mesh.rotation.x * 180) / Math.PI,
              y: (mesh.rotation.y * 180) / Math.PI,
              z: (mesh.rotation.z * 180) / Math.PI,
            },
            scaling: { x: mesh.scaling.x, y: mesh.scaling.y, z: mesh.scaling.z },
            materialColor: material?.diffuseColor
              ? { r: material.diffuseColor.r, g: material.diffuseColor.g, b: material.diffuseColor.b }
              : undefined,
          },
          nodeData: {
            name: node.name,
            type: node.type || 'mesh',
            parentId: node.parentId,
          },
          physicsEnabled: false, // TODO: Track physics state for undo
        };
      }
    }

    // Recursively delete node and all children (both from tree and scene)
    this.deleteNodeRecursively(this.nodeId, tree, registry, scene);

    window.dispatchEvent(new Event('scenetree-update'));

    this.onExecuted();
  }

  /**
   * Recursively delete a node and all its children from both the tree and scene
   */
  private deleteNodeRecursively(
    nodeId: string,
    tree: SceneTreeManager,
    registry: EntityRegistry,
    scene: BABYLON.Scene
  ): void {
    const node = tree.getNode(nodeId);
    if (!node) return;

    // First, recursively delete all children
    const children = [...node.childIds];
    for (const childId of children) {
      this.deleteNodeRecursively(childId, tree, registry, scene);
    }

    // Dispose entity if it exists
    if (node.entityId) {
      const entity = registry.get(node.entityId);
      if (entity) {
        entity.dispose();
      }
      registry.remove(node.entityId);
    }

    // Dispose Babylon mesh if it exists
    if (node.babylonMeshId) {
      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
      if (mesh) {
        mesh.dispose();
      }
    }

    // Dispose TransformNode if it exists
    if (node.babylonTransformNodeId) {
      const transformNode = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId, 10));
      if (transformNode) {
        transformNode.dispose();
      }
    }

    // Finally, remove from tree (this only removes the tree node, not the Babylon objects)
    tree.deleteNode(nodeId);
  }

  undo(): void {
    if (!this.snapshot) {
      console.warn('Cannot undo delete: no snapshot available');
      return;
    }

    // Recreate the object using callback (breaks circular dependency)
    if (!this.createObjectCallback) {
      console.warn('Cannot undo delete: no createObject callback provided');
      return;
    }

    // This will create a new object - we'll need to update its properties
    this.createObjectCallback(this.snapshot.meshData.type as any);

    // Wait for next tick to ensure object is created
    setTimeout(() => {
      const tree = SceneTreeManager.getInstance();
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();

      if (!scene || !this.snapshot || !this.updateCallbacks) return;

      // Find the newly created mesh by name pattern
      const newMesh = scene.meshes.find(
        m => m.name.startsWith(this.snapshot!.meshData.type.charAt(0).toUpperCase() + this.snapshot!.meshData.type.slice(1))
      );

      if (newMesh && newMesh instanceof BABYLON.Mesh) {
        // Restore properties using callbacks
        const node = tree.getNodeByBabylonMeshId(newMesh.uniqueId.toString());

        if (node) {
          this.updateCallbacks.updateNodePosition(node.id, this.snapshot.meshData.position);
          this.updateCallbacks.updateNodeRotation(node.id, this.snapshot.meshData.rotation);
          this.updateCallbacks.updateNodeScale(node.id, this.snapshot.meshData.scaling);

          // Restore material color
          if (this.snapshot.meshData.materialColor && newMesh.material instanceof BABYLON.StandardMaterial) {
            newMesh.material.diffuseColor = new BABYLON.Color3(
              this.snapshot.meshData.materialColor.r,
              this.snapshot.meshData.materialColor.g,
              this.snapshot.meshData.materialColor.b
            );
          }
        }
      }

      window.dispatchEvent(new Event('scenetree-update'));
      this.onUndone();
    }, 50);
  }
}
