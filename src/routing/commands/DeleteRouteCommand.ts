// Delete Route Command - Undo/redo for route deletion
// Owner: Routing System Team

import { Command } from '../../history/Command';
import { ConnectionManager } from '../core/ConnectionManager';
import { Route } from '../core/Route';
import { useRoutingStore } from '../../ui/store/routingStore';
import { getGlobalDebugLabels } from '../ui/RouteDebugLabels';
import { SceneManager } from '../../scene/SceneManager';
import { Mesh } from '@babylonjs/core';

/**
 * Command for deleting a route
 */
export class DeleteRouteCommand extends Command {
  description = 'Delete Route';

  private route: Route;
  private connectionId: string | null = null;

  constructor(route: Route) {
    super();
    this.route = route;
  }

  execute(): void {
    // Remove debug label before deleting route
    const debugLabels = getGlobalDebugLabels();
    if (debugLabels) {
      debugLabels.removeLabel(this.route.getId());
    }

    // Find connection associated with route
    const connectionManager = ConnectionManager.getInstance();
    const connections = connectionManager.getConnections(this.route.source.getId());
    const connection = connections.find((c) => c.routeId === this.route.getId());
    if (connection) {
      this.connectionId = connection.id;
    }

    // Remove route from store
    const removeRoute = useRoutingStore.getState().removeRoute;
    removeRoute(this.route.getId());

    // Remove connection
    if (this.connectionId) {
      connectionManager.removeConnection(this.connectionId);
    }

    this.onExecuted();
  }

  undo(): void {
    // Restore route to store
    const addRoute = useRoutingStore.getState().addRoute;
    addRoute(this.route);

    // Restore connection
    if (this.connectionId) {
      const connectionManager = ConnectionManager.getInstance();
      connectionManager.createConnection(
        this.route.source.getId(),
        this.route.destination.getId(),
        this.route.getId()
      );
    }

    // Recreate debug label if route has generated geometry
    const debugLabels = getGlobalDebugLabels();
    if (debugLabels && this.route.generated) {
      const scene = SceneManager.getInstance().getScene();
      if (scene) {
        // Try to find mesh by naming convention or unique ID
        const mesh = scene.getMeshByName(`${this.route.type}_${this.route.getId()}`) ||
                     scene.getMeshByName(`Route_${this.route.getId().substring(0, 8)}`);
        if (mesh && mesh.getClassName() === 'Mesh') {
          debugLabels.createRouteLabel(this.route, mesh as Mesh);
        }
      }
    }

    this.onUndone();
  }
}

