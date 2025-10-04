// Boolean Operation Command - Undo/Redo for CSG operations
// Owner: George (Architecture)

import { Command } from '../Command';
import { BooleanOperations, BooleanOperationType } from '../../scene/BooleanOperations';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import * as BABYLON from '@babylonjs/core';
import { babylonToUser } from '../../core/CoordinateSystem';

interface MeshSnapshot {
  nodeId: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scaling: { x: number; y: number; z: number };
  materialColor?: { r: number; g: number; b: number };
  meshData: string; // Serialized mesh data for restoration
}

export class BooleanOperationCommand extends Command {
  description: string;
  private sourceSnapshots: MeshSnapshot[] = [];
  private resultNodeId: string | null = null;
  private resultEntityId: string | null = null;

  constructor(
    private readonly nodeIdA: string,
    private readonly nodeIdB: string,
    private readonly operation: BooleanOperationType
  ) {
    super();
    this.description = `Boolean ${operation}`;
  }

  async execute(): Promise<void> {
    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    if (!scene) {
      throw new Error('Scene not initialized');
    }

    // Create snapshots of source meshes before operation
    for (const nodeId of [this.nodeIdA, this.nodeIdB]) {
      const node = tree.getNode(nodeId);
      if (node && node.babylonMeshId) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh && mesh instanceof BABYLON.Mesh) {
          const material = mesh.material as BABYLON.StandardMaterial;

          this.sourceSnapshots.push({
            nodeId,
            name: mesh.name,
            position: babylonToUser(mesh.position),
            rotation: {
              x: (mesh.rotation.x * 180) / Math.PI,
              y: (mesh.rotation.y * 180) / Math.PI,
              z: (mesh.rotation.z * 180) / Math.PI,
            },
            scaling: { x: mesh.scaling.x, y: mesh.scaling.y, z: mesh.scaling.z },
            materialColor: material?.diffuseColor
              ? {
                  r: material.diffuseColor.r,
                  g: material.diffuseColor.g,
                  b: material.diffuseColor.b,
                }
              : undefined,
            meshData: JSON.stringify({
              // Store essential mesh data for recreation
              positions: mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind),
              indices: mesh.getIndices(),
              normals: mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind),
            }),
          });
        }
      }
    }

    // Perform Boolean operation
    const result = await BooleanOperations.performOperationOnNodes(
      this.nodeIdA,
      this.nodeIdB,
      this.operation
    );

    if (!result.success || !result.resultMesh) {
      throw new Error(result.error || 'Boolean operation failed');
    }

    // Store result IDs
    const resultNode = tree.getNodeByBabylonMeshId(result.resultMesh.uniqueId.toString());
    if (resultNode) {
      this.resultNodeId = resultNode.id;
      this.resultEntityId = resultNode.entityId || null;
    }

    // Delete source nodes
    const registry = EntityRegistry.getInstance();
    for (const nodeId of [this.nodeIdA, this.nodeIdB]) {
      const node = tree.getNode(nodeId);
      if (node) {
        if (node.entityId) {
          registry.remove(node.entityId);
        }
        tree.deleteNode(nodeId);
      }
    }

    window.dispatchEvent(new Event('scenetree-update'));
    this.onExecuted();
  }

  undo(): void {
    const registry = EntityRegistry.getInstance();
    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    if (!scene) return;

    // Remove result mesh
    if (this.resultEntityId) {
      registry.remove(this.resultEntityId);
    }
    if (this.resultNodeId) {
      tree.deleteNode(this.resultNodeId);
    }

    // Restore source meshes
    for (const snapshot of this.sourceSnapshots) {
      try {
        const meshData = JSON.parse(snapshot.meshData);

        // Recreate mesh
        const mesh = new BABYLON.Mesh(snapshot.name, scene);
        mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, meshData.positions);
        mesh.setIndices(meshData.indices);
        if (meshData.normals) {
          mesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, meshData.normals);
        } else {
          mesh.createNormals(true);
        }

        // Restore material
        if (snapshot.materialColor) {
          const mat = new BABYLON.StandardMaterial(`mat_${snapshot.name}`, scene);
          mat.diffuseColor = new BABYLON.Color3(
            snapshot.materialColor.r,
            snapshot.materialColor.g,
            snapshot.materialColor.b
          );
          mesh.material = mat;
        }

        // Create entity
        const entity = registry.create({
          mesh,
          physics: {
            enabled: false,
            type: 'dynamic',
            mass: 1.0,
            shape: 'box',
            dimensions: { x: 1, y: 1, z: 1 },
          },
          metadata: {
            name: snapshot.name,
            type: 'mesh',
          },
        });

        // Create scene tree node
        const assetsNode = tree.getAssetsNode();
        const newNode = tree.createNode(
          'mesh',
          snapshot.name,
          assetsNode?.id || null,
          snapshot.position
        );

        newNode.babylonMeshId = mesh.uniqueId.toString();
        newNode.entityId = entity.getId();

        // Restore transform
        const { useEditorStore } = require('../../ui/store/editorStore');
        const { updateNodePosition, updateNodeRotation, updateNodeScale } = useEditorStore.getState();
        updateNodePosition(newNode.id, snapshot.position);
        updateNodeRotation(newNode.id, snapshot.rotation);
        updateNodeScale(newNode.id, snapshot.scaling);
      } catch (error) {
        console.error('Failed to restore mesh:', error);
      }
    }

    window.dispatchEvent(new Event('scenetree-update'));
    this.onUndone();
  }
}
