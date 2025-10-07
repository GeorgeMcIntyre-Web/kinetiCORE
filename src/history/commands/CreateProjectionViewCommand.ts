// Create Projection View Command - Undo/Redo for projection view creation
// Owner: George (Architecture) / Edwin (History commands)

import * as BABYLON from '@babylonjs/core';
import { Command } from '../Command';
import { ProjectionView, ProjectionViewResult } from '../../scene/ProjectionView';
import { SceneManager } from '../../scene/SceneManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';

export class CreateProjectionViewCommand extends Command {
  description: string;
  private projectionResult: ProjectionViewResult | null = null;
  private projectedMeshName: string = '';
  private entityId: string | null = null;
  private nodeId: string | null = null;

  constructor(
    private readonly sourceMeshName: string,
    private readonly targetPlaneName: string,
    private readonly viewType: 'top' | 'front' | 'side' | 'back' | 'left' | 'right' | 'auto' = 'auto'
  ) {
    super();
    this.description = `Create ${viewType} projection view`;
  }

  execute(): void {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) {
      throw new Error('Scene not initialized');
    }

    // Find source mesh and target plane
    const sourceMesh = scene.getMeshByName(this.sourceMeshName);
    const targetPlane = scene.getMeshByName(this.targetPlaneName);

    if (!sourceMesh || !(sourceMesh instanceof BABYLON.Mesh)) {
      throw new Error(`Source mesh "${this.sourceMeshName}" not found`);
    }

    if (!targetPlane || !(targetPlane instanceof BABYLON.Mesh)) {
      throw new Error(`Target plane "${this.targetPlaneName}" not found`);
    }

    // Create projection view
    if (this.viewType === 'auto') {
      // Auto projection based on plane normal
      this.projectionResult = ProjectionView.create({
        sourceMesh,
        targetPlane,
        projectionDirection: 'auto',
        showEdges: true,
        flattenGeometry: true,
      });
    } else {
      // Orthographic view (top/front/side/etc.)
      this.projectionResult = ProjectionView.createOrthographicView(
        sourceMesh,
        targetPlane,
        this.viewType
      );
    }

    const projectedMesh = this.projectionResult.projectedMesh;
    this.projectedMeshName = projectedMesh.name;

    // Create entity for the projected mesh
    const registry = EntityRegistry.getInstance();
    const entity = registry.create({
      mesh: projectedMesh,
      physics: {
        enabled: false, // Projections don't need physics
      },
      metadata: {
        name: projectedMesh.name,
        type: 'projection',
        tags: ['projection', this.viewType],
        customProperties: {
          sourceMesh: this.sourceMeshName,
          targetPlane: this.targetPlaneName,
          viewType: this.viewType,
        },
      },
    });

    this.entityId = entity.getId();

    // Add to scene tree
    const tree = SceneTreeManager.getInstance();
    const assetsNode = tree.getAssetsNode();

    const node = tree.createNode(
      'mesh',
      projectedMesh.name,
      assetsNode?.id || null,
      {
        x: projectedMesh.position.x * 1000,
        y: projectedMesh.position.y * 1000,
        z: projectedMesh.position.z * 1000,
      }
    );

    node.babylonMeshId = projectedMesh.uniqueId.toString();
    node.entityId = this.entityId;
    this.nodeId = node.id;

    // Notify UI
    window.dispatchEvent(new Event('scenetree-update'));

    this.onExecuted();
  }

  undo(): void {
    const registry = EntityRegistry.getInstance();
    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    // Remove entity (disposes mesh and physics)
    if (this.entityId) {
      registry.remove(this.entityId);
    }

    // Remove scene tree node
    if (this.nodeId) {
      tree.deleteNode(this.nodeId);
    }

    // Clean up projection (disposes material and mesh if still exists)
    if (this.projectionResult) {
      try {
        this.projectionResult.cleanup();
      } catch (error) {
        console.warn('Projection already cleaned up:', error);
      }
      this.projectionResult = null;
    }

    // Clean up any orphaned meshes
    if (scene && this.projectedMeshName) {
      const mesh = scene.getMeshByName(this.projectedMeshName);
      if (mesh) {
        mesh.dispose();
      }
    }

    window.dispatchEvent(new Event('scenetree-update'));
    this.onUndone();
  }
}
