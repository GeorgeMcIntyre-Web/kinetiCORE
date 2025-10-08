// Snapping Helper - Provides comprehensive snapping functionality
// Owner: George (core logic) + Cole (3D integration)
// Handles grid, vertex, edge, face, and center snapping

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../scene/SceneManager';

export interface SnapResult {
  snapped: boolean;
  position: BABYLON.Vector3;
  snapType?: 'grid' | 'vertex' | 'edge' | 'face' | 'center';
  targetMeshName?: string;
  visualFeedback?: BABYLON.Vector3[]; // Points to visualize snap indicators
}

export interface SnapSettings {
  enabled: boolean;
  snapToGrid: boolean;
  snapToVertex: boolean;
  snapToEdge: boolean;
  snapToFace: boolean;
  snapToCenter: boolean;
  gridSize: number; // mm
  snapDistance: number; // mm
}

export class SnappingHelper {
  private static instance: SnappingHelper;
  private snapIndicators: BABYLON.Mesh[] = [];

  private constructor() {}

  static getInstance(): SnappingHelper {
    if (!SnappingHelper.instance) {
      SnappingHelper.instance = new SnappingHelper();
    }
    return SnappingHelper.instance;
  }

  /**
   * Attempt to snap a position based on settings
   */
  snapPosition(
    position: BABYLON.Vector3,
    settings: SnapSettings,
    excludeMeshIds: string[] = []
  ): SnapResult {
    if (!settings.enabled) {
      return { snapped: false, position: position.clone() };
    }

    // Try snapping in order of priority
    let result: SnapResult | null = null;

    // 1. Vertex snapping (highest priority - most precise)
    if (settings.snapToVertex) {
      result = this.snapToVertex(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 2. Edge snapping
    if (settings.snapToEdge) {
      result = this.snapToEdge(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 3. Face snapping
    if (settings.snapToFace) {
      result = this.snapToFace(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 4. Center snapping (object origins)
    if (settings.snapToCenter) {
      result = this.snapToCenter(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 5. Grid snapping (lowest priority - fallback)
    if (settings.snapToGrid) {
      result = this.snapToGrid(position, settings.gridSize);
      if (result.snapped) return result;
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to grid
   */
  private snapToGrid(position: BABYLON.Vector3, gridSize: number): SnapResult {
    // Convert grid size from mm to meters (Babylon units)
    const gridSizeMeters = gridSize / 1000;

    const snappedPos = new BABYLON.Vector3(
      Math.round(position.x / gridSizeMeters) * gridSizeMeters,
      Math.round(position.y / gridSizeMeters) * gridSizeMeters,
      Math.round(position.z / gridSizeMeters) * gridSizeMeters
    );

    return {
      snapped: true,
      position: snappedPos,
      snapType: 'grid',
    };
  }

  /**
   * Snap to nearest vertex
   */
  private snapToVertex(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestVertex: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    // Check all meshes in the scene
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground'
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (!positions) continue;

      // Transform vertices to world space
      const worldMatrix = mesh.computeWorldMatrix(true);

      for (let i = 0; i < positions.length; i += 3) {
        const localVertex = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        const worldVertex = BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix);

        const distance = BABYLON.Vector3.Distance(position, worldVertex);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestVertex = worldVertex;
          closestMeshName = mesh.name;
        }
      }
    }

    if (closestVertex) {
      return {
        snapped: true,
        position: closestVertex,
        snapType: 'vertex',
        targetMeshName: closestMeshName,
        visualFeedback: [closestVertex],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to nearest edge
   */
  private snapToEdge(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestPoint: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    // Check all meshes in the scene
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground'
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (!positions || !indices) continue;

      const worldMatrix = mesh.computeWorldMatrix(true);

      // Check each edge (triangle edge)
      for (let i = 0; i < indices.length; i += 3) {
        const idx1 = indices[i] * 3;
        const idx2 = indices[i + 1] * 3;
        const idx3 = indices[i + 2] * 3;

        const edges = [
          [idx1, idx2],
          [idx2, idx3],
          [idx3, idx1],
        ];

        for (const [start, end] of edges) {
          const v1 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[start], positions[start + 1], positions[start + 2]),
            worldMatrix
          );
          const v2 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[end], positions[end + 1], positions[end + 2]),
            worldMatrix
          );

          // Find closest point on edge
          const edgeDir = v2.subtract(v1);
          const edgeLength = edgeDir.length();
          edgeDir.normalize();

          const toPoint = position.subtract(v1);
          const t = BABYLON.Vector3.Dot(toPoint, edgeDir);
          const clampedT = Math.max(0, Math.min(edgeLength, t));

          const closestOnEdge = v1.add(edgeDir.scale(clampedT));
          const distance = BABYLON.Vector3.Distance(position, closestOnEdge);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = closestOnEdge;
            closestMeshName = mesh.name;
          }
        }
      }
    }

    if (closestPoint) {
      return {
        snapped: true,
        position: closestPoint,
        snapType: 'edge',
        targetMeshName: closestMeshName,
        visualFeedback: [closestPoint],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to nearest face
   */
  private snapToFace(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestPoint: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    // Use raycasting in 6 directions (±X, ±Y, ±Z) to find nearby faces
    const directions = [
      new BABYLON.Vector3(1, 0, 0),
      new BABYLON.Vector3(-1, 0, 0),
      new BABYLON.Vector3(0, 1, 0),
      new BABYLON.Vector3(0, -1, 0),
      new BABYLON.Vector3(0, 0, 1),
      new BABYLON.Vector3(0, 0, -1),
    ];

    for (const dir of directions) {
      const ray = new BABYLON.Ray(position, dir, snapDistanceMeters);
      const pickInfo = scene.pickWithRay(ray, (mesh) => {
        return (
          mesh.isVisible &&
          !excludeMeshIds.includes(mesh.uniqueId.toString()) &&
          mesh.name !== 'ground'
        );
      });

      if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
        const distance = BABYLON.Vector3.Distance(position, pickInfo.pickedPoint);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = pickInfo.pickedPoint;
          closestMeshName = pickInfo.pickedMesh?.name || '';
        }
      }
    }

    if (closestPoint) {
      return {
        snapped: true,
        position: closestPoint,
        snapType: 'face',
        targetMeshName: closestMeshName,
        visualFeedback: [closestPoint],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to object center (origin)
   */
  private snapToCenter(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestCenter: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    // Check all transform nodes (meshes and collections)
    for (const node of scene.transformNodes) {
      if (excludeMeshIds.includes(node.uniqueId.toString()) || node.name === 'ground') {
        continue;
      }

      const worldPos = node.getAbsolutePosition();
      const distance = BABYLON.Vector3.Distance(position, worldPos);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestCenter = worldPos;
        closestMeshName = node.name;
      }
    }

    if (closestCenter) {
      return {
        snapped: true,
        position: closestCenter,
        snapType: 'center',
        targetMeshName: closestMeshName,
        visualFeedback: [closestCenter],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Show visual feedback for snap point
   */
  showSnapIndicator(point: BABYLON.Vector3, color: BABYLON.Color3): void {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // Clear old indicators
    this.clearSnapIndicators();

    // Create snap point indicator (small sphere)
    const indicator = BABYLON.MeshBuilder.CreateSphere(
      'snapIndicator',
      { diameter: 0.02 },
      scene
    );
    indicator.position = point.clone();

    const mat = new BABYLON.StandardMaterial('snapMat', scene);
    mat.emissiveColor = color;
    mat.disableLighting = true;
    indicator.material = mat;

    this.snapIndicators.push(indicator);
  }

  /**
   * Clear snap indicators
   */
  clearSnapIndicators(): void {
    for (const indicator of this.snapIndicators) {
      indicator.dispose();
    }
    this.snapIndicators = [];
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.clearSnapIndicators();
  }
}
