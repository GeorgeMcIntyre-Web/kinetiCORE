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
    const generator = this.createGenerator(route.type, scene);
    return generator.generate(route);
  }
}

