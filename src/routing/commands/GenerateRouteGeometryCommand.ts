// Generate Route Geometry Command - Undo/redo for route geometry generation
// Owner: Routing System Team

import { Command } from '../../history/Command';
import { GeometryGeneratorFactory } from '../geometry/GeometryGeneratorFactory';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import { useRoutingStore } from '../../ui/store/routingStore';
import { getGlobalDebugLabels } from '../ui/RouteDebugLabels';
import { RouteValidator } from '../validation/RouteValidator';
import { RouteVisualWarnings } from '../validation/RouteVisualWarnings';
import { getObstacles } from '../core/RoutingUtils';
import {
  DEFAULT_CABLE_TRAY_SPEC,
  DEFAULT_CONDUIT_SPEC,
  DEFAULT_ELECTRICAL_SPEC,
  DEFAULT_PIPE_SPEC,
} from '../specifications/RouteSpecifications';

/**
 * Command for generating 3D geometry for a route
 */
export class GenerateRouteGeometryCommand extends Command {
  description = 'Generate Route Geometry';

  private routeId: string;
  private meshId?: string;
  private entityId?: string;
  private nodeId?: string;
  private wasGenerated: boolean;

  constructor(routeId: string) {
    super();
    this.routeId = routeId;
    this.wasGenerated = false;
  }

  execute(): void {
    console.log('[GenerateRouteGeometryCommand] 🎬 Execute called for route:', this.routeId);

    const store = useRoutingStore.getState();
    const route = store.activeRoutes.find((r) => r.getId() === this.routeId);

    if (!route) {
      console.error('[GenerateRouteGeometryCommand] ❌ Route not found:', this.routeId);
      console.log('[GenerateRouteGeometryCommand] Available routes:', store.activeRoutes.map(r => r.getId()));
      return;
    }
    console.log('[GenerateRouteGeometryCommand] ✅ Route found:', route.getId());

    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      console.error('[GenerateRouteGeometryCommand] ❌ Scene not available');
      return;
    }
    console.log('[GenerateRouteGeometryCommand] ✅ Scene available');

    // Check if already generated
    if (route.generated) {
      // Already generated, just mark as executed
      console.log('[GenerateRouteGeometryCommand] ⚠️ Route already generated, skipping');
      this.onExecuted();
      return;
    }

    this.wasGenerated = route.generated;

    // Validate route before generation
    console.log('[GenerateRouteGeometryCommand] 🔍 Validating route...');
    const validator = new RouteValidator();
    const obstacles = getObstacles(scene);
    const validationResult = validator.validateRouteEnhanced(route, obstacles);

    // Check for critical errors - if there are errors, warn but allow generation
    // (UI can show blocking dialog if needed)
    const hasErrors = validationResult.violations.some((v) => v.severity === 'error');
    console.log('[GenerateRouteGeometryCommand] Validation result:', {
      hasErrors,
      violationCount: validationResult.violations.length
    });

    // Generate geometry
    console.log('[GenerateRouteGeometryCommand] 🏗️ Generating geometry...');
    const mesh = GeometryGeneratorFactory.generateGeometry(route, scene);
    console.log('[GenerateRouteGeometryCommand] ✅ Geometry generated:', mesh.name);

    // Ensure mesh is visible
    mesh.isVisible = true;
    mesh.setEnabled(true);
    console.log('[GenerateRouteGeometryCommand] Visibility settings:', {
      isVisible: mesh.isVisible,
      isEnabled: mesh.isEnabled(),
      renderingGroupId: mesh.renderingGroupId,
      position: mesh.position.toString(),
      material: mesh.material?.name || 'none'
    });

    // Store route ID in mesh metadata for easy route identification
    if (!mesh.metadata) {
      mesh.metadata = {};
    }
    mesh.metadata.routeId = route.getId();
    mesh.metadata.isRoute = true;

    route.markAsGenerated();

    // Create entity
    const registry = EntityRegistry.getInstance();
    const entity = registry.create({
      mesh,
      metadata: {
        name: `Route_${route.getId().substring(0, 8)}`,
        type: 'route',
      },
    });
    this.entityId = entity.getId();

    // Add to scene tree
    const tree = SceneTreeManager.getInstance();
    const routeNode = tree.createNode('mesh', `Route ${route.getId().substring(0, 8)}`, 'scene', undefined);
    if (routeNode) {
      routeNode.entityId = entity.getId();
      routeNode.babylonMeshId = mesh.uniqueId.toString();
      this.nodeId = routeNode.id;
    }

    this.meshId = mesh.uniqueId.toString();

    // Apply visual warnings for invalid segments
    const visualWarnings = new RouteVisualWarnings(scene);
    visualWarnings.applyWarnings(route, validationResult);

    // Create debug label if debug labels are enabled
    const debugLabels = getGlobalDebugLabels();
    if (debugLabels) {
      // Extract specifications from route (can be undefined - labels will show basic info)
      const specifications = extractRouteSpecifications(route);
      // Pass validation result to label for visual feedback
      debugLabels.createRouteLabel(route, mesh, specifications, validationResult);
    }

    // Store validation result in routing store for warnings panel
    store.setValidationResult(route.getId(), validationResult);

    // Log warnings for debugging
    if (hasErrors) {
      console.warn(`Route ${route.getId()} has validation errors:`, validationResult.violations);
    } else if (validationResult.violations.length > 0) {
      console.info(`Route ${route.getId()} has validation warnings:`, validationResult.violations);
    }

    window.dispatchEvent(new Event('scenetree-update'));
    this.onExecuted();
  }

  undo(): void {
    const scene = SceneManager.getInstance().getScene();
    if (!scene || !this.meshId) return;

    // Remove mesh from scene
    const mesh = scene.getMeshByUniqueId(parseInt(this.meshId));
    if (mesh) {
      mesh.dispose();
    }

    // Remove entity
    if (this.entityId) {
      const registry = EntityRegistry.getInstance();
      registry.remove(this.entityId);
    }

    // Remove from scene tree
    if (this.nodeId) {
      const tree = SceneTreeManager.getInstance();
      tree.deleteNode(this.nodeId);
    }

    // Mark route as not generated
    const store = useRoutingStore.getState();
    const route = store.activeRoutes.find((r) => r.getId() === this.routeId);
    if (route) {
      if (this.wasGenerated) {
        route.markAsGenerated();
      } else {
        route.markAsNotGenerated();
      }
    }

    // Remove debug label if it exists
    const debugLabels = getGlobalDebugLabels();
    if (debugLabels) {
      debugLabels.removeLabel(this.routeId);
    }

    window.dispatchEvent(new Event('scenetree-update'));
    this.onUndone();
  }
}

/**
 * Helper function to extract specifications from a route
 * Returns undefined if no specifications are available (labels will show basic info)
 */
function extractRouteSpecifications(route: any): any {
  // Provide sensible defaults that match our visual geometry for clearer labels
  switch (route?.type) {
    case 'electrical': {
      return {
        ...DEFAULT_ELECTRICAL_SPEC,
        coreCount: 3,
        wireGauge: '14 AWG',
        wireDiameter: 0.003, // 3mm individual wires (matches visuals)
        outerDiameter: 0.008, // ~8mm bundle
        voltage: 120,
        current: 15,
      };
    }
    case 'pipe': {
      return {
        ...DEFAULT_PIPE_SPEC,
        nominalSize: '40mm',
        outerDiameter: 0.04, // 40mm OD (matches visuals)
        innerDiameter: 0.034, // approximate
        material: 'steel',
        pressureRating: 1000,
        flowRate: 10,
      };
    }
    case 'cable_tray': {
      return {
        ...DEFAULT_CABLE_TRAY_SPEC,
        width: 0.4, // 400mm (matches visuals)
        height: 0.075,
        trayType: 'ladder',
        material: 'galvanized-steel',
        loadRating: 50,
        maxCables: 20,
      };
    }
    case 'conduit': {
      return {
        ...DEFAULT_CONDUIT_SPEC,
        nominalSize: '1/2"', // label-friendly size
        conduitType: 'EMT',
        outerDiameter: 0.025, // 25mm OD (matches visuals)
        innerDiameter: 0.021,
        maxWires: 4,
        fillPercentage: 40,
      };
    }
    default:
      return undefined;
  }
}

