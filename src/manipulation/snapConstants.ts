// Snap Constants - Centralized layer masks and exclusion logic
// Owner: George
// Single source of truth for snap mesh filtering

import * as BABYLON from '@babylonjs/core';

/**
 * Layer masks for snap system
 * Using high bits to avoid conflicts with Babylon defaults
 */
export const LAYER_UI = 1 << 29;      // UI/utility/indicators (excluded from snapping)
export const LAYER_SNAP = 1 << 0;     // Snap-eligible content (opt-in for snapping)

/**
 * Centralized predicate to determine if a mesh should be excluded from snap detection
 * Replaces scattered exclusion checks throughout SnappingHelper
 *
 * @param mesh - Mesh to check
 * @returns true if mesh should be excluded from snap detection
 */
export function isSnapExcluded(mesh: BABYLON.AbstractMesh | null | undefined): boolean {
  if (!mesh) return true;
  if (!mesh.isPickable) return true;

  // Exclude UI layer meshes (preview indicators, measurements, etc.)
  if ((mesh.layerMask & LAYER_UI) !== 0) return true;

  const name = mesh.name ?? '';

  // Exclude snap preview/indicator meshes by name
  if (name.startsWith('snapIndicator')) return true;
  if (name.startsWith('snapPreview')) return true; // Catches all: snapPreviewDot, snapPreviewVertex, snapPreviewCircle, etc.

  // Exclude measurement/annotation meshes
  if (name.startsWith('measurement')) return true;
  if (name.startsWith('transform_label')) return true;
  if (name.startsWith('marker-')) return true;
  if (name.startsWith('distance-line')) return true;
  if (name.startsWith('angle-line')) return true;

  // Exclude debug visualization
  if (name.startsWith('circle')) return true;

  // Exclude infrastructure
  if (name === 'ground') return true;
  if (name === 'gridOverlay') return true;

  // Exclude gizmos via metadata
  if (mesh.metadata?.isGizmo === true) return true;

  // Opt-in model: Require LAYER_SNAP to be set
  // BUT: For backward compatibility during transition, allow meshes without LAYER_UI
  // (Meshes with LAYER_UI are explicitly excluded, others are allowed)
  // TODO: Make this strict opt-in after all loaders are updated
  // if ((mesh.layerMask & LAYER_SNAP) === 0) return true;

  return false;
}

/**
 * Initialize a mesh for snap detection
 * Handles regular meshes, InstancedMesh, and their source meshes
 * Sets proper layer mask and flags
 *
 * @param mesh - Mesh to initialize (Mesh, InstancedMesh, or AbstractMesh)
 */
export function enableSnapForMesh(mesh: BABYLON.AbstractMesh): void {
  if (!mesh) return;

  // Set pickable and layer mask for all mesh types
  mesh.isPickable = true;
  mesh.layerMask = (mesh.layerMask | LAYER_SNAP) & ~LAYER_UI;

  // Handle InstancedMesh - also enable on the source mesh
  if (mesh instanceof BABYLON.InstancedMesh) {
    const sourceMesh = mesh.sourceMesh;
    if (sourceMesh) {
      sourceMesh.isPickable = true;
      sourceMesh.layerMask = (sourceMesh.layerMask | LAYER_SNAP) & ~LAYER_UI;

      // Ensure source mesh has proper data for snap detection
      if (sourceMesh instanceof BABYLON.Mesh) {
        if (!sourceMesh.areNormalsFrozen) {
          sourceMesh.createNormals(false);
        }
        sourceMesh.alwaysSelectAsActiveMesh = true;
        sourceMesh.computeWorldMatrix(true);
      }
    }
  }

  // Handle regular Mesh - ensure facet data and normals
  if (mesh instanceof BABYLON.Mesh) {
    if (!mesh.areNormalsFrozen) {
      mesh.createNormals(false);
    }
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.computeWorldMatrix(true);
  }

  // Note: ThinInstances can't be picked individually by Babylon
  // They will fall back to the source mesh for snapping
}

/**
 * Configure a mesh as UI/indicator (excluded from snap detection)
 *
 * @param mesh - Mesh to configure
 */
export function setMeshAsUI(mesh: BABYLON.AbstractMesh): void {
  mesh.layerMask = LAYER_UI;
  mesh.isPickable = false;
  mesh.renderingGroupId = 1; // Content @ 0, UI @ 1 (prevents z-fighting)
}

/**
 * Calculate pixel distance from a world position to screen coordinates
 * Ensures consistent DPI-aware distance metrics across preview and measurement
 *
 * @param scene - Babylon scene
 * @param worldPos - World space position to project
 * @param screenX - Screen X coordinate (pixels)
 * @param screenY - Screen Y coordinate (pixels)
 * @returns Pixel distance, or Infinity if projection fails
 */
export function calculatePixelDistance(
  scene: BABYLON.Scene,
  worldPos: BABYLON.Vector3,
  screenX: number,
  screenY: number
): number {
  const camera = scene.activeCamera;
  if (!camera) return Number.POSITIVE_INFINITY;

  const engine = scene.getEngine();
  if (!engine) return Number.POSITIVE_INFINITY;

  // Project world position to screen space
  const viewport = camera.viewport.toGlobal(
    engine.getRenderWidth(),
    engine.getRenderHeight()
  );

  const projected = BABYLON.Vector3.Project(
    worldPos,
    BABYLON.Matrix.Identity(),
    scene.getTransformMatrix(),
    viewport
  );

  if (!projected) return Number.POSITIVE_INFINITY;

  // Calculate Euclidean distance in screen space
  const dx = projected.x - screenX;
  const dy = projected.y - screenY;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert world-space distance to pixel distance at a given camera distance
 * Useful for adaptive thresholds that scale with zoom
 *
 * @param scene - Babylon scene
 * @param worldDistance - Distance in world units (meters)
 * @param atWorldPos - World position to measure at (for perspective calculation)
 * @returns Approximate pixel distance
 */
export function worldToPixelDistance(
  scene: BABYLON.Scene,
  worldDistance: number,
  atWorldPos: BABYLON.Vector3
): number {
  const camera = scene.activeCamera;
  if (!camera) return worldDistance * 100; // Fallback: assume ~100px/meter

  const engine = scene.getEngine();
  if (!engine) return worldDistance * 100;

  // For perspective camera: pixel size depends on distance from camera
  if (camera instanceof BABYLON.ArcRotateCamera || camera.mode === BABYLON.Camera.PERSPECTIVE_CAMERA) {
    const cameraToPoint = BABYLON.Vector3.Distance(camera.position, atWorldPos);
    const canvas = engine.getRenderingCanvas();

    if (canvas && camera instanceof BABYLON.ArcRotateCamera) {
      const canvasHeight = canvas.height;
      const fov = camera.fov || (Math.PI / 4);

      // World distance per pixel at this depth
      const worldPerPixel = (2 * cameraToPoint * Math.tan(fov / 2)) / canvasHeight;

      return worldDistance / worldPerPixel;
    }
  }

  // Orthographic camera fallback
  return worldDistance * 100; // Rough estimate
}
