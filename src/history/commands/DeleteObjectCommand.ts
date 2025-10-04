// Delete Object Command - Undo/Redo for object deletion
// Owner: George (Architecture)

import * as BABYLON from '@babylonjs/core';
import { Command } from '../Command';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import { babylonToUser } from '../../core/CoordinateSystem';

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

  constructor(private readonly nodeId: string) {
    super();
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    this.description = `Delete ${node?.name || 'object'}`;
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

    // Perform deletion
    if (node.entityId) {
      registry.remove(node.entityId);
    }
    tree.deleteNode(this.nodeId);
    window.dispatchEvent(new Event('scenetree-update'));

    this.onExecuted();
  }

  undo(): void {
    if (!this.snapshot) {
      console.warn('Cannot undo delete: no snapshot available');
      return;
    }

    // Recreate the object using editorStore
    const { useEditorStore } = require('../../ui/store/editorStore');
    const createObject = useEditorStore.getState().createObject;

    // This will create a new object - we'll need to update its properties
    createObject(this.snapshot.meshData.type as any);

    // Wait for next tick to ensure object is created
    setTimeout(() => {
      const tree = SceneTreeManager.getInstance();
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();

      if (!scene || !this.snapshot) return;

      // Find the newly created mesh by name pattern
      const newMesh = scene.meshes.find(
        m => m.name.startsWith(this.snapshot!.meshData.type.charAt(0).toUpperCase() + this.snapshot!.meshData.type.slice(1))
      );

      if (newMesh && newMesh instanceof BABYLON.Mesh) {
        // Restore properties
        const { updateNodePosition, updateNodeRotation, updateNodeScale } = useEditorStore.getState();
        const node = tree.getNodeByBabylonMeshId(newMesh.uniqueId.toString());

        if (node) {
          updateNodePosition(node.id, this.snapshot.meshData.position);
          updateNodeRotation(node.id, this.snapshot.meshData.rotation);
          updateNodeScale(node.id, this.snapshot.meshData.scaling);

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
