// Object snap strategy - snap to object bounding box center
// Extracted from SnappingHelper.ts for better organization

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { isSnapExcluded } from '../snapConstants';
import { SnapResult } from './snapTypes';

export type ObjectSnapArgs = {
  position: BABYLON.Vector3;
  snapDistance: number;
  excludeMeshIds: string[];
  camera?: BABYLON.Camera;
  screenSpacePixels?: number;
};

/**
 * Snap to object bounding box center
 */
export function snapToObjectStrategy(args: ObjectSnapArgs): SnapResult {
  const { position, snapDistance, excludeMeshIds, camera, screenSpacePixels } = args;
  
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) return { snapped: false, position: position.clone() };

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

  const snapDistanceMeters = snapDistance / 1000;
  let closestCenter: BABYLON.Vector3 | null = null;
  let closestDistance = Infinity;
  let closestMeshName = '';

  // Check all meshes for their bounding box centers
  for (const mesh of scene.meshes) {
    // Use centralized exclusion predicate + explicit excludeIds
    if (isSnapExcluded(mesh) || excludeMeshIds.includes(mesh.uniqueId.toString())) {
      continue;
    }

    // Get bounding box center in world space
    mesh.computeWorldMatrix(true);
    const boundingInfo = mesh.getBoundingInfo();
    const boundingBox = boundingInfo.boundingBox;
    const center = boundingBox.centerWorld;

    const distance = BABYLON.Vector3.Distance(position, center);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestCenter = center;
      closestMeshName = mesh.name;
    }
  }

  // Determine if we should snap
  let shouldSnap = false;
  if (closestCenter) {
    if (camera && screenSpacePixels !== undefined && screenPos) {
      // Check screen-space distance for preview
      const viewport = camera.viewport.toGlobal(
        scene.getEngine().getRenderWidth(),
        scene.getEngine().getRenderHeight()
      );
      const projected = BABYLON.Vector3.Project(
        closestCenter,
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

  if (!closestCenter || !shouldSnap) {
    return { snapped: false, position: position.clone() };
  }

  let visualFeedback: BABYLON.Vector3[] = [closestCenter.clone()];

  // Optional: Include bbox corners for future wireframe preview
  const mesh = scene.meshes.find(m => m.name === closestMeshName);
  if (mesh) {
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    const corners = bbox.vectorsWorld;

    if (corners && corners.length === 8) {
      visualFeedback = [
        closestCenter.clone(),
        ...corners.map(v => v.clone()),
      ];
    }
  }

  return {
    snapped: true,
    position: closestCenter.clone(),
    snapType: 'object',
    targetMeshName: closestMeshName,
    visualFeedback,
  };
}


