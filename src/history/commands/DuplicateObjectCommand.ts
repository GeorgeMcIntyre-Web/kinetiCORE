// Duplicate Object Command - Copy objects with undo support
// Owner: George (Architecture)

import * as BABYLON from '@babylonjs/core';
import { Command } from '../Command';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import { babylonToUser } from '../../core/CoordinateSystem';

export class DuplicateObjectCommand extends Command {
  description: string;
  private duplicatedNodeId: string | null = null;
  private duplicatedEntityId: string | null = null;

  constructor(private readonly sourceNodeId: string) {
    super();
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(sourceNodeId);
    this.description = `Duplicate ${node?.name || 'object'}`;
  }

  execute(): void {
    const tree = SceneTreeManager.getInstance();
    const registry = EntityRegistry.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    const sourceNode = tree.getNode(this.sourceNodeId);
    if (!sourceNode || !scene) {
      throw new Error('Source node or scene not found');
    }

    // Only duplicate mesh nodes (not collections)
    if (sourceNode.type === 'collection' || !sourceNode.babylonMeshId) {
      throw new Error('Can only duplicate mesh objects');
    }

    const sourceMesh = scene.getMeshByUniqueId(parseInt(sourceNode.babylonMeshId));
    if (!sourceMesh || !(sourceMesh instanceof BABYLON.Mesh)) {
      throw new Error('Source mesh not found');
    }

    // Clone the mesh
    const newMeshName = `${sourceNode.name}_copy`;
    const clonedMesh = sourceMesh.clone(newMeshName, null, false, false);
    if (!clonedMesh) {
      throw new Error('Failed to clone mesh');
    }

    // Offset position slightly so duplicate is visible
    const offset = new BABYLON.Vector3(0.5, 0, 0.5); // 500mm offset in user space
    clonedMesh.position = sourceMesh.position.add(offset);

    // Clone material if it exists
    if (sourceMesh.material) {
      const sourceMaterial = sourceMesh.material as BABYLON.StandardMaterial;
      const newMaterial = sourceMaterial.clone(`mat_${newMeshName}`);
      clonedMesh.material = newMaterial;
    }

    // Get physics configuration from source entity
    const sourceEntity = sourceNode.entityId ? registry.get(sourceNode.entityId) : null;
    let physicsConfig: any = {
      enabled: false,
      type: 'dynamic' as const,
      mass: 1.0,
      shape: 'box' as const,
      dimensions: { x: 1, y: 1, z: 1 },
    };

    if (sourceEntity) {
      // Copy physics settings (simplified - full implementation would need entity introspection)
      physicsConfig = {
        enabled: false, // Disabled by default for duplicates
        type: 'dynamic' as const,
        mass: 1.0,
        shape: 'box' as const, // Default to box
        dimensions: { x: 1, y: 1, z: 1 },
      };
    }

    // Create entity for the cloned mesh
    const entity = registry.create({
      mesh: clonedMesh,
      physics: physicsConfig,
      metadata: {
        name: newMeshName,
        type: sourceNode.type || 'mesh',
      },
    });

    this.duplicatedEntityId = entity.getId();

    // Create scene tree node
    const assetsNode = tree.getAssetsNode();
    const nodeType = sourceNode.type as any;
    const newNode = tree.createNode(
      nodeType,
      newMeshName,
      assetsNode?.id || null,
      babylonToUser(clonedMesh.position)
    );

    newNode.babylonMeshId = clonedMesh.uniqueId.toString();
    newNode.entityId = entity.getId();

    this.duplicatedNodeId = newNode.id;

    window.dispatchEvent(new Event('scenetree-update'));
    this.onExecuted();
  }

  undo(): void {
    const registry = EntityRegistry.getInstance();
    const tree = SceneTreeManager.getInstance();

    // Remove the duplicated entity and node
    if (this.duplicatedEntityId) {
      registry.remove(this.duplicatedEntityId);
    }

    if (this.duplicatedNodeId) {
      tree.deleteNode(this.duplicatedNodeId);
    }

    window.dispatchEvent(new Event('scenetree-update'));
    this.onUndone();
  }

  // Return the ID of the duplicated node for selection
  getDuplicatedNodeId(): string | null {
    return this.duplicatedNodeId;
  }
}
