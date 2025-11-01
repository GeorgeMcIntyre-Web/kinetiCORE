// Generate Route Geometry Command - Undo/redo for route geometry generation
// Owner: Routing System Team

import { Command } from '../../history/Command';
import { GeometryGeneratorFactory } from '../geometry/GeometryGeneratorFactory';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import { useRoutingStore } from '../../ui/store/routingStore';

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
    const store = useRoutingStore.getState();
    const route = store.activeRoutes.find((r) => r.getId() === this.routeId);
    if (!route) return;

    const scene = SceneManager.getInstance().getScene();
    if (!scene) return;

    // Check if already generated
    if (route.generated) {
      // Already generated, just mark as executed
      this.onExecuted();
      return;
    }

    this.wasGenerated = route.generated;

    // Generate geometry
    const mesh = GeometryGeneratorFactory.generateGeometry(route, scene);
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

    window.dispatchEvent(new Event('scenetree-update'));
    this.onUndone();
  }
}

