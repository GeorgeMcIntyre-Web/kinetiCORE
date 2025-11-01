// Routing Utilities - Shared utilities for routing system
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { RouteType, RouteConstraints } from './types';

/**
 * Get default constraints for a route type
 */
export function getDefaultConstraints(_routeType: RouteType): RouteConstraints {
  return {
    minBendRadius: 0.5, // 500mm default
    maxRunLength: 50, // 50 units max
    supportSpacing: 3, // 3 units between supports
    clearance: {
      walls: 0.1,
      ceiling: 0.2,
      floor: 0.1,
      otherInfrastructure: 0.2,
    },
  };
}

/**
 * Get obstacles from scene (all meshes except routing-related)
 */
export function getObstacles(scene: BABYLON.Scene): BABYLON.Mesh[] {
  return scene.meshes.filter((mesh) => {
    return (
      !mesh.name.includes('conn_indicator_') &&
      !mesh.name.includes('route_preview_') &&
      !mesh.name.includes('violation_') &&
      !mesh.name.includes('control_')
    );
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

