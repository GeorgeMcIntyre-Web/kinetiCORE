// Geometry Generator Factory - Creates appropriate generator based on route type
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteType } from '../core/types';
import { RouteGeometryGenerator } from './RouteGeometryGenerator';
import { PipeGenerator } from './PipeGenerator';
import { CableGenerator } from './CableGenerator';
import { CableTrayGenerator } from './CableTrayGenerator';
import { ConduitGenerator } from './ConduitGenerator';

/**
 * Factory for creating geometry generators based on route type
 */
export class GeometryGeneratorFactory {
  /**
   * Create the appropriate generator for a route type
   */
  static createGenerator(routeType: RouteType, scene: BABYLON.Scene): RouteGeometryGenerator {
    switch (routeType) {
      case 'pipe':
        return new PipeGenerator(scene);
      case 'electrical':
        return new CableGenerator(scene);
      case 'cable_tray':
        return new CableTrayGenerator(scene);
      case 'conduit':
        return new ConduitGenerator(scene);
      default:
        // Default to pipe generator
        return new PipeGenerator(scene);
    }
  }

  /**
   * Generate geometry for a route using the appropriate generator
   */
  static generateGeometry(route: Route, scene: BABYLON.Scene): BABYLON.Mesh {
    console.log('[GeometryGeneratorFactory] 🏭 Creating generator for type:', route.type);
    const generator = this.createGenerator(route.type, scene);
    console.log('[GeometryGeneratorFactory] Generator created:', generator.constructor.name);

    console.log('[GeometryGeneratorFactory] Calling generate() with route segments:', route.segments?.length || 0);
    const mesh = generator.generate(route);

    console.log('[GeometryGeneratorFactory] ✅ Mesh generated:', {
      name: mesh.name,
      id: mesh.id,
      uniqueId: mesh.uniqueId,
      isVisible: mesh.isVisible,
      isEnabled: mesh.isEnabled(),
      position: mesh.position,
      childMeshes: mesh.getChildMeshes().length,
      totalVertices: mesh.getTotalVertices()
    });

    return mesh;
  }
}

