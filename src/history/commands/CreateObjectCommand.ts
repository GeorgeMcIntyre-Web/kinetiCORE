// Create Object Command - Undo/Redo for object creation
// Owner: George (Architecture)

import * as BABYLON from '@babylonjs/core';
import { Command } from '../Command';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';

export class CreateObjectCommand extends Command {
  description: string;
  private entityId: string | null = null;
  private nodeId: string | null = null;
  private meshName: string = '';

  constructor(
    private readonly objectType: string,
    private readonly meshFactory: () => BABYLON.Mesh | null
  ) {
    super();
    this.description = `Create ${objectType}`;
  }

  execute(): void {
    // Create the mesh using the factory
    const mesh = this.meshFactory();
    if (!mesh) {
      throw new Error(`Failed to create mesh for ${this.objectType}`);
    }

    this.meshName = mesh.name;

    // Store entity ID and node ID for undo
    const registry = EntityRegistry.getInstance();
    const tree = SceneTreeManager.getInstance();

    // Find the entity and node that were created
    const entities = registry.getAll();
    const entity = entities.find(e => e.getMesh()?.name === mesh.name);
    if (entity) {
      this.entityId = entity.getId();
    }

    const node = tree.getNodeByBabylonMeshId(mesh.uniqueId.toString());
    if (node) {
      this.nodeId = node.id;
    }

    this.onExecuted();
  }

  undo(): void {
    const registry = EntityRegistry.getInstance();
    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    // Remove entity (this will dispose the mesh and physics body)
    if (this.entityId) {
      registry.remove(this.entityId);
    }

    // Remove scene tree node
    if (this.nodeId) {
      tree.deleteNode(this.nodeId);
    }

    // Clean up any orphaned meshes
    if (scene && this.meshName) {
      const mesh = scene.getMeshByName(this.meshName);
      if (mesh) {
        mesh.dispose();
      }
    }

    window.dispatchEvent(new Event('scenetree-update'));
    this.onUndone();
  }
}
