// Create Route Command - Undo/redo for route creation
// Owner: Routing System Team

import { Command } from '../../history/Command';
import { ConnectionManager } from '../core/ConnectionManager';
import { Route } from '../core/Route';
import { useRoutingStore } from '../../ui/store/routingStore';

/**
 * Command for creating a route
 */
export class CreateRouteCommand extends Command {
  description = 'Create Route';

  private route: Route;
  private connectionId: string | null = null;

  constructor(route: Route) {
    super();
    this.route = route;
  }

  execute(): void {
    // Add route to store
    const addRoute = useRoutingStore.getState().addRoute;
    addRoute(this.route);

    // Create connection between source and destination
    const connectionManager = ConnectionManager.getInstance();
    this.connectionId =
      connectionManager
        .createConnection(
          this.route.source.getId(),
          this.route.destination.getId(),
          this.route.getId()
        )?.id || null;

    this.onExecuted();
  }

  undo(): void {
    // Remove route from store
    const removeRoute = useRoutingStore.getState().removeRoute;
    removeRoute(this.route.getId());

    // Remove connection
    if (this.connectionId) {
      const connectionManager = ConnectionManager.getInstance();
      connectionManager.removeConnection(this.connectionId);
    }

    this.onUndone();
  }
}

