// Edge snap strategy - snap to nearest point on an edge
// Extracted from SnappingHelper.ts for better organization

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { isSnapExcluded } from '../snapConstants';
import { SnapResult } from './snapTypes';

export type EdgeSnapArgs = {
  position: BABYLON.Vector3;
  snapDistance: number;
  excludeMeshIds: string[];
  camera?: BABYLON.Camera;
  screenSpacePixels?: number;
};

/**
 * Snap to nearest point on an edge
 */
export function snapToEdgeStrategy(args: EdgeSnapArgs): SnapResult {
  const { position, snapDistance, excludeMeshIds, camera, screenSpacePixels } = args;
  
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) return { snapped: false, position: position.clone() };

  const snapDistanceMeters = snapDistance / 1000;

  // Convert position to screen space if camera provided
  let screenPos: { x: number; y: number } | null = null;
  if (camera && screenSpacePixels !== undefined) {
    const viewport = camera.viewport.toGlobal(
      scene.getEngine().getRenderWidth(),
      scene.getEngine().getRenderHeight()
    );
    // Use Identity for world matrix (position is already in world space)
    // Use scene transform matrix (view * projection combined) as second parameter
    const projected = BABYLON.Vector3.Project(
      position,
      BABYLON.Matrix.Identity(),
      scene.getTransformMatrix(),
      viewport
    );
    screenPos = { x: projected.x, y: projected.y };
  }

  let closestPoint: BABYLON.Vector3 | null = null;
  let closestDistance = Infinity; // Find true closest first
  let closestMeshName = '';

  // Edge deduplication
  const seenEdges = new Set<string>();

  // Check all meshes in the scene
  for (const mesh of scene.meshes) {
    // Use centralized exclusion predicate + explicit excludeIds
    if (isSnapExcluded(mesh) || excludeMeshIds.includes(mesh.uniqueId.toString())) {
      continue;
    }

    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices) continue;

    const worldMatrix = mesh.computeWorldMatrix(true);
    const meshId = mesh.uniqueId.toString();

    // Check each edge (triangle edge)
    for (let i = 0; i < indices.length; i += 3) {
      const edges = [
        [indices[i], indices[i + 1]],
        [indices[i + 1], indices[i + 2]],
        [indices[i + 2], indices[i]],
      ];

      for (const [idx1, idx2] of edges) {
        // Deduplicate edges
        const minIdx = Math.min(idx1, idx2);
        const maxIdx = Math.max(idx1, idx2);
        const edgeKey = `${meshId}:${minIdx}-${maxIdx}`;

        if (seenEdges.has(edgeKey)) {
          continue;
        }
        seenEdges.add(edgeKey);

        const start = idx1 * 3;
        const end = idx2 * 3;

        const v1 = BABYLON.Vector3.TransformCoordinates(
          new BABYLON.Vector3(positions[start], positions[start + 1], positions[start + 2]),
          worldMatrix
        );
        const v2 = BABYLON.Vector3.TransformCoordinates(
          new BABYLON.Vector3(positions[end], positions[end + 1], positions[end + 2]),
          worldMatrix
        );

        // Filter out very short edges (< 5mm)
        const edgeLength = BABYLON.Vector3.Distance(v1, v2);
        if (edgeLength < 0.005) {
          continue;
        }

        // Find closest point on edge
        const edgeDir = v2.subtract(v1);
        edgeDir.normalize();

        const toPoint = position.subtract(v1);
        const t = BABYLON.Vector3.Dot(toPoint, edgeDir);
        const clampedT = Math.max(0, Math.min(edgeLength, t));

        const closestOnEdge = v1.add(edgeDir.scale(clampedT));
        const distance = BABYLON.Vector3.Distance(position, closestOnEdge);

        // Filter out edge snaps when the snap point is very close to a vertex endpoint
        // This prevents edge snap from triggering when you're actually near a vertex
        const distToV1 = BABYLON.Vector3.Distance(closestOnEdge, v1);
        const distToV2 = BABYLON.Vector3.Distance(closestOnEdge, v2);
        const vertexProximityThreshold = 0.002; // 2mm - if within 2mm of vertex, skip edge snap
        
        if (distToV1 < vertexProximityThreshold || distToV2 < vertexProximityThreshold) {
          continue; // Skip this edge - too close to a vertex, vertex snap should handle it
        }

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = closestOnEdge;
          closestMeshName = mesh.name;
        }
      }
    }
  }

  // Determine if we should snap
  let shouldSnap = false;
  if (closestPoint) {
    if (camera && screenSpacePixels !== undefined && screenPos) {
      // Check screen-space distance for preview
      const viewport = camera.viewport.toGlobal(
        scene.getEngine().getRenderWidth(),
        scene.getEngine().getRenderHeight()
      );
      const projected = BABYLON.Vector3.Project(
        closestPoint,
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
        viewport
      );
      const screenDist = Math.sqrt(
        Math.pow(projected.x - screenPos.x, 2) +
        Math.pow(projected.y - screenPos.y, 2)
      );
      shouldSnap = screenDist <= screenSpacePixels;
    } else {
      // Check world-space distance for actual snapping
      shouldSnap = closestDistance <= snapDistanceMeters;
    }
  }

  if (closestPoint && shouldSnap) {
    // Clone vectors to ensure immutability
    const positionClone = closestPoint.clone();
    return {
      snapped: true,
      position: positionClone,
      snapType: 'edge',
      targetMeshName: closestMeshName,
      visualFeedback: [positionClone.clone()],
    };
  }

  return { snapped: false, position: position.clone() };
}


