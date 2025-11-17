// Piping Scene Service - Babylon.js integration for Factory Piping
// Owner: Agent 1 (George) - Architecture Lead
// Subscribes to piping store and creates/updates/disposes Babylon meshes

import * as BABYLON from '@babylonjs/core';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import { PipingNode, PipingSegment } from '../../domain/factoryServices/piping/pipingTypes';
import { ServiceColors } from '../../scene/materials/serviceMaterials';
import { getSceneUpVector } from '../../core/UpAxis';

/**
 * Service class that manages 3D visualization of piping networks in Babylon.js
 * Subscribes to piping store changes and keeps meshes in sync
 */
export class PipingSceneService {
  private scene: BABYLON.Scene;
  private nodeMeshes: Map<string, BABYLON.Mesh> = new Map();
  private segmentMeshes: Map<string, BABYLON.Mesh> = new Map();
  private unsubscribe: (() => void) | null = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Start the service and subscribe to piping store changes
   */
  start(): void {
    if (this.unsubscribe !== null) {
      return; // Already started
    }

    this.unsubscribe = pipingStore.subscribe(() => {
      this.syncWithStore();
    });

    // Initial sync
    this.syncWithStore();
  }

  /**
   * Stop the service and dispose all meshes
   */
  stop(): void {
    if (this.unsubscribe !== null) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.disposeAllMeshes();
  }

  /**
   * Sync scene meshes with current piping store state
   */
  private syncWithStore(): void {
    const networks = pipingStore.getAllNetworks();

    // Collect all current node and segment IDs from store
    const currentNodeIds = new Set<string>();
    const currentSegmentIds = new Set<string>();

    for (const network of networks) {
      for (const node of network.nodes) {
        currentNodeIds.add(node.id);
      }
      for (const segment of network.segments) {
        currentSegmentIds.add(segment.id);
      }
    }

    // Remove meshes for nodes/segments that no longer exist
    this.removeStaleNodeMeshes(currentNodeIds);
    this.removeStaleSegmentMeshes(currentSegmentIds);

    // Create or update meshes for current nodes and segments
    for (const network of networks) {
      for (const node of network.nodes) {
        this.updateOrCreateNodeMesh(node);
      }
      for (const segment of network.segments) {
        this.updateOrCreateSegmentMesh(segment, network.nodes);
      }
    }
  }

  /**
   * Remove node meshes that no longer exist in store
   */
  private removeStaleNodeMeshes(currentNodeIds: Set<string>): void {
    const meshesToRemove: string[] = [];

    for (const [nodeId, mesh] of this.nodeMeshes.entries()) {
      if (currentNodeIds.has(nodeId) === false) {
        mesh.dispose();
        meshesToRemove.push(nodeId);
      }
    }

    for (const nodeId of meshesToRemove) {
      this.nodeMeshes.delete(nodeId);
    }
  }

  /**
   * Remove segment meshes that no longer exist in store
   */
  private removeStaleSegmentMeshes(currentSegmentIds: Set<string>): void {
    const meshesToRemove: string[] = [];

    for (const [segmentId, mesh] of this.segmentMeshes.entries()) {
      if (currentSegmentIds.has(segmentId) === false) {
        mesh.dispose();
        meshesToRemove.push(segmentId);
      }
    }

    for (const segmentId of meshesToRemove) {
      this.segmentMeshes.delete(segmentId);
    }
  }

  /**
   * Create or update a node mesh
   */
  private updateOrCreateNodeMesh(node: PipingNode): void {
    let mesh = this.nodeMeshes.get(node.id);

    if (mesh === undefined) {
      // Create new node mesh (visible sphere - increased size for usability)
      mesh = BABYLON.MeshBuilder.CreateSphere(
        `piping_node_${node.id}`,
        { diameter: 0.5 }, // Increased from 0.1 to 0.5 meters for better visibility and clicking
        this.scene
      );

      // Create simple material
      const material = new BABYLON.StandardMaterial(
        `piping_node_mat_${node.id}`,
        this.scene
      );
      material.diffuseColor = this.getColorForServiceType(node.serviceType);
      material.emissiveColor = material.diffuseColor.scale(0.2);
      mesh.material = material;

      // Store metadata
      mesh.metadata = {
        pipingNodeId: node.id,
        pipingObjectType: 'node',
      };

      this.nodeMeshes.set(node.id, mesh);
    }

    // Update position
    mesh.position.set(node.position.x, node.position.y, node.position.z);
  }

  /**
   * Create or update a segment mesh
   */
  private updateOrCreateSegmentMesh(
    segment: PipingSegment,
    nodes: PipingNode[]
  ): void {
    const fromNode = nodes.find((n) => n.id === segment.fromNodeId);
    const toNode = nodes.find((n) => n.id === segment.toNodeId);

    if (fromNode === undefined || toNode === undefined) {
      return; // Can't create segment without both nodes
    }

    let mesh = this.segmentMeshes.get(segment.id);
    const needsRecreation = this.segmentNeedsRecreation(mesh, fromNode, toNode, segment);

    if (needsRecreation) {
      // Dispose old mesh if it exists
      if (mesh !== undefined) {
        mesh.dispose();
      }

      // Create new segment mesh
      mesh = this.createSegmentGeometry(segment, fromNode, toNode);
      this.segmentMeshes.set(segment.id, mesh);
    }
  }

  /**
   * Check if segment mesh needs to be recreated
   */
  private segmentNeedsRecreation(
    mesh: BABYLON.Mesh | undefined,
    _fromNode: PipingNode,
    _toNode: PipingNode,
    _segment: PipingSegment
  ): boolean {
    if (mesh === undefined) {
      return true; // Doesn't exist yet
    }

    // For now, always recreate (simple approach)
    // In future, could be smarter about detecting when geometry actually changed
    return true;
  }

  /**
   * Create cylinder mesh for a pipe segment
   */
  private createSegmentGeometry(
    segment: PipingSegment,
    fromNode: PipingNode,
    toNode: PipingNode
  ): BABYLON.Mesh {
    const fromPos = new BABYLON.Vector3(
      fromNode.position.x,
      fromNode.position.y,
      fromNode.position.z
    );
    const toPos = new BABYLON.Vector3(
      toNode.position.x,
      toNode.position.y,
      toNode.position.z
    );

    // Calculate distance and direction
    const direction = toPos.subtract(fromPos);
    const length = direction.length();
    const center = BABYLON.Vector3.Lerp(fromPos, toPos, 0.5);

    // Radius from diameter (convert mm to meters, assuming scene units = meters)
    const radius = segment.nominalDiameterMm / 2000;

    // Create cylinder
    const mesh = BABYLON.MeshBuilder.CreateCylinder(
      `piping_segment_${segment.id}`,
      {
        height: length,
        diameter: radius * 2,
        tessellation: 16,
      },
      this.scene
    );

    // Position at center
    mesh.position = center;

    // Rotate to align with direction using the centralized up-axis
    const upVector = getSceneUpVector();
    const normalizedDirection = direction.normalize();
    const axis = BABYLON.Vector3.Cross(upVector, normalizedDirection);
    const angle = Math.acos(BABYLON.Vector3.Dot(upVector, normalizedDirection));

    if (axis.length() > 0.001) {
      mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
    }

    // Create material
    const material = new BABYLON.StandardMaterial(
      `piping_segment_mat_${segment.id}`,
      this.scene
    );

    // For now, use simple colored material
    // In future, could use PBR materials from serviceMaterials.ts
    const color = this.getColorForServiceType(fromNode.serviceType);
    material.diffuseColor = color;
    material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    // Add insulation effect
    if (segment.hasInsulation) {
      material.emissiveColor = color.scale(0.1);
    }

    mesh.material = material;

    // Store metadata
    mesh.metadata = {
      pipingSegmentId: segment.id,
      pipingObjectType: 'segment',
    };

    return mesh;
  }

  /**
   * Get Babylon color for a service type
   */
  private getColorForServiceType(serviceType: string): BABYLON.Color3 {
    switch (serviceType) {
      case 'water':
        return ServiceColors.water;
      case 'air':
        return ServiceColors.compressedAir;
      case 'steam':
        return ServiceColors.steam;
      case 'vacuum':
        return BABYLON.Color3.Purple();
      case 'electrical':
        return ServiceColors.electricity;
      case 'cable_tray':
        return BABYLON.Color3.Gray();
      case 'custom':
        return BABYLON.Color3.White();
      default:
        return BABYLON.Color3.White();
    }
  }

  /**
   * Dispose all meshes and clear internal state
   */
  private disposeAllMeshes(): void {
    for (const [, mesh] of this.nodeMeshes.entries()) {
      mesh.dispose();
    }
    this.nodeMeshes.clear();

    for (const [, mesh] of this.segmentMeshes.entries()) {
      mesh.dispose();
    }
    this.segmentMeshes.clear();
  }

  /**
   * Get the mesh for a given node ID (useful for picking/selection)
   */
  getNodeMesh(nodeId: string): BABYLON.Mesh | undefined {
    return this.nodeMeshes.get(nodeId);
  }

  /**
   * Get the mesh for a given segment ID (useful for picking/selection)
   */
  getSegmentMesh(segmentId: string): BABYLON.Mesh | undefined {
    return this.segmentMeshes.get(segmentId);
  }

  /**
   * Handle mesh picking - returns node or segment ID if picked
   */
  handlePick(pickedMesh: BABYLON.AbstractMesh | null): {
    type: 'node' | 'segment' | null;
    id: string | null;
  } {
    if (pickedMesh === null) {
      return { type: null, id: null };
    }

    if (pickedMesh.metadata === null || pickedMesh.metadata === undefined) {
      return { type: null, id: null };
    }

    const metadata = pickedMesh.metadata as Record<string, unknown>;

    if (metadata.pipingObjectType === 'node') {
      return {
        type: 'node',
        id: metadata.pipingNodeId as string,
      };
    }

    if (metadata.pipingObjectType === 'segment') {
      return {
        type: 'segment',
        id: metadata.pipingSegmentId as string,
      };
    }

    return { type: null, id: null };
  }
}
