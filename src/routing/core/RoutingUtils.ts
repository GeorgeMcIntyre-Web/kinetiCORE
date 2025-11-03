// Routing Utilities - Shared utilities for routing system
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { RouteType, RouteConstraints } from './types';

/**
 * Get default constraints for a route type
 * Adjusted to realistic industrial standards
 */
export function getDefaultConstraints(routeType: RouteType): RouteConstraints {
  // Type-specific constraints
  const constraintsByType: Record<RouteType, RouteConstraints> = {
    pipe: {
      minBendRadius: 0.15, // 150mm (1.5× typical pipe diameter)
      maxRunLength: 50,
      supportSpacing: 3,
      clearance: {
        walls: 0.10, // 100mm (4 inches)
        ceiling: 0.15,
        floor: 0.10,
        otherInfrastructure: 0.10,
      },
    },
    electrical: {
      minBendRadius: 0.10, // 100mm (NEC code minimum)
      maxRunLength: 50,
      supportSpacing: 2,
      clearance: {
        walls: 0.05, // 50mm (2 inches)
        ceiling: 0.10,
        floor: 0.05,
        otherInfrastructure: 0.05,
      },
    },
    cable_tray: {
      minBendRadius: 0.30, // 300mm (12 inches typical)
      maxRunLength: 50,
      supportSpacing: 4,
      clearance: {
        walls: 0.15, // 150mm (6 inches)
        ceiling: 0.20,
        floor: 0.15,
        otherInfrastructure: 0.15,
      },
    },
    conduit: {
      minBendRadius: 0.15, // 150mm (6 inches typical)
      maxRunLength: 50,
      supportSpacing: 2.5,
      clearance: {
        walls: 0.08, // 80mm (3 inches)
        ceiling: 0.10,
        floor: 0.08,
        otherInfrastructure: 0.08,
      },
    },
  };

  return constraintsByType[routeType] || constraintsByType.pipe;
}

/**
 * Scene infrastructure meshes that should NOT be treated as obstacles
 */
const SCENE_INFRASTRUCTURE = new Set([
  'ground',
  'gridoverlay',
  'grid',
  'floor',
  'skybox',
  'axes',
  'axis',
  'helper',
  'gizmo',
  'light',
  'camera',
]);

/**
 * Get obstacles from scene (all meshes except routing-related and scene infrastructure)
 */
export function getObstacles(scene: BABYLON.Scene): BABYLON.Mesh[] {
  return scene.meshes.filter((mesh) => {
    // Skip routing-related meshes
    if (
      mesh.name.includes('conn_indicator_') ||
      mesh.name.includes('route_preview_') ||
      mesh.name.includes('violation_') ||
      mesh.name.includes('control_')
    ) {
      return false;
    }

    // Skip scene infrastructure (ground, grid, skybox, etc.)
    const nameLower = mesh.name.toLowerCase();
    if (SCENE_INFRASTRUCTURE.has(nameLower)) {
      console.log(`[getObstacles] 🚫 Excluding scene infrastructure: ${mesh.name}`);
      return false;
    }

    // Skip if explicitly marked as scene infrastructure
    if (mesh.metadata?.isSceneInfrastructure) {
      console.log(`[getObstacles] 🚫 Excluding marked infrastructure: ${mesh.name}`);
      return false;
    }

    // Skip if explicitly marked to ignore collisions
    if (mesh.metadata?.ignoreCollision) {
      console.log(`[getObstacles] 🚫 Excluding collision-ignored: ${mesh.name}`);
      return false;
    }

    // Include everything else as potential obstacle
    return true;
  }) as BABYLON.Mesh[];
}

/**
 * Generate a unique ID with fallback for environments without crypto.randomUUID
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`;
}

