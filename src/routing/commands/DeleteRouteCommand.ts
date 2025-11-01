// Delete Route Command - Undo/redo for route deletion
// Owner: Routing System Team

import { Command } from '../../history/Command';
import { ConnectionManager } from '../core/ConnectionManager';
import { Route } from '../core/Route';
import { useRoutingStore } from '../../ui/store/routingStore';

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

    this.onUndone();
  }
}

