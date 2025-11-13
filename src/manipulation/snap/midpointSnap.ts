// Midpoint snap strategy - snap to edge midpoint or face center
// Extracted from SnappingHelper.ts for better organization

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { isSnapExcluded } from '../snapConstants';
import { SnapResult } from './snapTypes';

export type MidpointSnapArgs = {
  position: BABYLON.Vector3;
  snapDistance: number;
  excludeMeshIds: string[];
  camera?: BABYLON.Camera;
  screenSpacePixels?: number;
};

/**
 * Snap to edge midpoint
 */
export function snapToMidpointStrategy(args: MidpointSnapArgs): SnapResult {
  const { position, snapDistance, excludeMeshIds, camera, screenSpacePixels } = args;
  
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) return { snapped: false, position: position.clone() };

  const snapDistanceMeters = snapDistance / 1000;

  // Convert position to screen space if camera and screen-space threshold provided
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

  let closestMidpoint: BABYLON.Vector3 | null = null;
  let closestEdgeStart: BABYLON.Vector3 | null = null;
  let closestEdgeEnd: BABYLON.Vector3 | null = null;
  let closestDistance = Infinity; // Start with Infinity to find true closest, like vertex snapping
  let closestMeshName = '';
  let isFaceCenter = false; // Track if this is a face center (not edge midpoint)
  
  // Track face center separately so we can compare with edge midpoints
  let faceCenterMidpoint: BABYLON.Vector3 | null = null;
  let faceCenterDistance = Infinity;
  let faceCenterMeshName = '';

  // First, check for object centers (bounding box centers) when clicking on faces
  // This allows center-to-center measurements on boxes using midpoint snap
  // But we'll compare with edge midpoints later to prefer edges when clicking near them
  for (const mesh of scene.meshes) {
    // Use centralized exclusion predicate + explicit excludeIds
    if (isSnapExcluded(mesh) || excludeMeshIds.includes(mesh.uniqueId.toString())) {
      continue;
    }

    // Get bounding box center - this is the center for boxes
    mesh.computeWorldMatrix(true);
    const boundingInfo = mesh.getBoundingInfo();
    const boundingBox = boundingInfo.boundingBox;
    const objectCenter = boundingBox.centerWorld;
    
    // Check if the clicked position is within the bounding box bounds
    // This means we're clicking on the object itself
    const min = boundingBox.minimumWorld;
    const max = boundingBox.maximumWorld;
    
    // Add a small tolerance (5mm) to account for floating point precision
    const tolerance = 0.005;
    const isWithinBounds = 
      position.x >= min.x - tolerance && position.x <= max.x + tolerance &&
      position.y >= min.y - tolerance && position.y <= max.y + tolerance &&
      position.z >= min.z - tolerance && position.z <= max.z + tolerance;
    
    if (isWithinBounds) {
      // If clicking within the bounding box, store the object center for later comparison
      // We'll prefer edge midpoints if they're close, but use face center as fallback
      const distanceToCenter = BABYLON.Vector3.Distance(position, objectCenter);
      if (distanceToCenter < faceCenterDistance) {
        faceCenterDistance = distanceToCenter;
        faceCenterMidpoint = objectCenter;
        faceCenterMeshName = mesh.name;
      }
    }
  }

  let meshesChecked = 0;

  // Edge deduplication: Track seen edges to avoid processing duplicates
  // Key format: "meshId:minIdx-maxIdx" where minIdx < maxIdx
  const seenEdges = new Set<string>();

  // PERFORMANCE: Limit edge processing to prevent slowdown on complex models.
  // This cap prevents worst-case O(n²) slowdown on dense BIW/robot scenes with thousands of edges.
  // When the limit is reached, we stop processing remaining edges but still return the best snap found so far.
  const MAX_EDGE_CHECKS = 3000; // Process max 3000 edges per query
  let edgesProcessed = 0;

  // Now check edge midpoints (only if we haven't found a face center, or if edge is closer)
  for (const mesh of scene.meshes) {
    // Use centralized exclusion predicate + explicit excludeIds
    if (isSnapExcluded(mesh) || excludeMeshIds.includes(mesh.uniqueId.toString())) {
      continue;
    }

    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices) continue;

    meshesChecked++;
    const worldMatrix = mesh.computeWorldMatrix(true);
    const meshId = mesh.uniqueId.toString();

    // Check each edge midpoint
    for (let i = 0; i < indices.length; i += 3) {
      // Budget check
      if (edgesProcessed >= MAX_EDGE_CHECKS) {
        break; // Stop processing this mesh if we hit the limit
      }

      const edges = [
        [indices[i], indices[i + 1]],
        [indices[i + 1], indices[i + 2]],
        [indices[i + 2], indices[i]],
      ];

      for (const [idx1, idx2] of edges) {
        // Budget check
        if (edgesProcessed >= MAX_EDGE_CHECKS) {
          break; // Stop processing edges if we hit the limit
        }

        // Deduplicate edges: create consistent key regardless of vertex order
        const minIdx = Math.min(idx1, idx2);
        const maxIdx = Math.max(idx1, idx2);
        const edgeKey = `${meshId}:${minIdx}-${maxIdx}`;

        if (seenEdges.has(edgeKey)) {
          continue; // Skip duplicate edge
        }
        seenEdges.add(edgeKey);
        edgesProcessed++;

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

        // Filter out very short edges (< 5mm) - likely triangulation artifacts
        const edgeLength = BABYLON.Vector3.Distance(v1, v2);
        if (edgeLength < 0.005) {
          continue;
        }

        const midpoint = v1.add(v2).scale(0.5);
        const distance = BABYLON.Vector3.Distance(position, midpoint);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestMidpoint = midpoint;
          closestEdgeStart = v1.clone();
          closestEdgeEnd = v2.clone();
          closestMeshName = mesh.name;
        }
      }
    }
  }

  // After checking all edges, compare with face center
  // Prefer edge midpoints when found, but use face center as fallback if no edge is close
  // IMPORTANT: Only use face center if we don't have an edge midpoint with endpoints
  if (faceCenterMidpoint && !closestMidpoint) {
    // No edge midpoint found at all - use face center as fallback
    closestMidpoint = faceCenterMidpoint;
    closestDistance = faceCenterDistance;
    closestMeshName = faceCenterMeshName;
    isFaceCenter = true;
    closestEdgeStart = null;
    closestEdgeEnd = null;
  }

  // Determine if we should snap based on the method used
  let shouldSnap = false;
  if (closestMidpoint) {
    // Check if we have edge endpoints (for edge midpoints) or not (for face centers)
    if (closestEdgeStart && closestEdgeEnd) {
      // Edge midpoint - check distance
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Check screen-space distance for preview
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestMidpoint,
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
    } else if (isFaceCenter) {
      // Face center - check distance
      if (camera && screenSpacePixels !== undefined && screenPos) {
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestMidpoint,
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
        shouldSnap = closestDistance <= snapDistanceMeters;
      }
    }
  }
  
  // Check if we found a midpoint within snap distance
  if (!closestMidpoint || !shouldSnap) {
    return { snapped: false, position: position.clone() };
  }

  // If it's a face center, return it (for center-to-center measurements)
  if (isFaceCenter) {
    // Face center doesn't have edge endpoints - preview will show just a dot
    return {
      snapped: true,
      position: closestMidpoint.clone(),
      snapType: 'midpoint',
      targetMeshName: closestMeshName,
      visualFeedback: [closestMidpoint.clone()], // Face center doesn't need edge endpoints
    };
  }
  
  // Otherwise, it's an edge midpoint - must have edge endpoints
  if (!closestEdgeStart || !closestEdgeEnd) {
    return { snapped: false, position: position.clone() };
  }

  // Attach edge endpoints to position for preview system (similar to center snap's circleNormal)
  const snapPoint = closestMidpoint.clone() as any;
  snapPoint.edgeStart = closestEdgeStart.clone();
  snapPoint.edgeEnd = closestEdgeEnd.clone();

  return {
    snapped: true,
    position: snapPoint,
    snapType: 'midpoint',
    targetMeshName: closestMeshName,
    visualFeedback: [
      closestEdgeStart.clone(),
      closestMidpoint.clone(),
      closestEdgeEnd.clone(),
    ],
  };
}

