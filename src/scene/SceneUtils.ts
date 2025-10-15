// Scene Utilities - Helper functions for scene management
// Owner: George (shared utilities)
//
// This module provides centralized filtering logic for distinguishing between:
// - User-created objects (robots, parts, assemblies)
// - Infrastructure objects (ground, grid, coordinate axes, UI widgets)
//
// Benefits:
// - Single source of truth for filtering logic
// - No scattered hardcoded name checks throughout the codebase
// - Easy to extend with new infrastructure types

import * as BABYLON from '@babylonjs/core';

/**
 * Check if a node is an infrastructure object (ground, grid, axis, etc.)
 * These objects should be excluded from selection, zoom targets, etc.
 *
 * @param node - The Babylon.js node to check
 * @returns true if the node is infrastructure (should be filtered out)
 */
export function isInfrastructureObject(node: BABYLON.Node): boolean {
  // Exact name matches to exclude
  const excludedNames = ['ground', 'gridOverlay', '__root__', 'mjcf_root'];

  // Prefix matches to exclude
  const excludedPrefixes = ['axis', 'widget', 'label', 'grid', '__'];

  // Check exact name match
  if (excludedNames.includes(node.name)) {
    return true;
  }

  // Check prefix match
  if (excludedPrefixes.some(prefix => node.name.startsWith(prefix))) {
    return true;
  }

  return false;
}

/**
 * Check if a mesh should be considered for zoom targeting
 * Excludes infrastructure objects and invisible/disabled meshes
 *
 * @param mesh - The mesh to check
 * @returns true if the mesh is a valid zoom target
 */
export function isZoomableObject(mesh: BABYLON.AbstractMesh): boolean {
  if (isInfrastructureObject(mesh)) {
    return false;
  }

  if (!mesh.isVisible || !mesh.isEnabled()) {
    return false;
  }

  return true;
}

/**
 * Check if a mesh should be selectable by the user
 * Same as isZoomableObject for now, but separated for potential future differences
 *
 * @param mesh - The mesh to check
 * @returns true if the mesh can be selected by clicking
 */
export function isSelectableObject(mesh: BABYLON.AbstractMesh): boolean {
  return isZoomableObject(mesh);
}

/**
 * Get all selectable meshes in the scene
 * Useful for operations that need to iterate over user-created objects
 *
 * @param scene - The Babylon.js scene
 * @returns Array of meshes that can be selected
 */
export function getSelectableMeshes(scene: BABYLON.Scene): BABYLON.AbstractMesh[] {
  return scene.meshes.filter(mesh => isSelectableObject(mesh));
}

/**
 * Get all zoomable meshes in the scene
 * Useful for camera framing operations
 *
 * @param scene - The Babylon.js scene
 * @returns Array of meshes that are valid zoom targets
 */
export function getZoomableMeshes(scene: BABYLON.Scene): BABYLON.AbstractMesh[] {
  return scene.meshes.filter(mesh => isZoomableObject(mesh));
}