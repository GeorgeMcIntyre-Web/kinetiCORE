// Edit Route Command - Undo/redo for route editing
// Owner: Routing System Team

import { Command } from '../../history/Command';
import { RouteSegment, SupportPoint } from '../core/types';
import { useRoutingStore } from '../../ui/store/routingStore';
import { Route } from '../core/Route';

/**
 * Command for editing a route
 * Stores before/after state for undo/redo
 */
export class EditRouteCommand extends Command {
  description = 'Edit Route';

  private routeId: string;
  private beforeSegments: RouteSegment[];
  private afterSegments: RouteSegment[];
  private beforeSupports: SupportPoint[];
  private afterSupports: SupportPoint[];

  constructor(
    routeId: string,
    beforeSegments: RouteSegment[],
    afterSegments: RouteSegment[],
    beforeSupports: SupportPoint[],
    afterSupports: SupportPoint[]
  ) {
    super();
    this.routeId = routeId;
    this.beforeSegments = beforeSegments.map((s) => ({ ...s }));
    this.afterSegments = afterSegments.map((s) => ({ ...s }));
    this.beforeSupports = beforeSupports.map((s) => ({ ...s }));
    this.afterSupports = afterSupports.map((s) => ({ ...s }));
  }

  execute(): void {
    const store = useRoutingStore.getState();
    const routes = store.activeRoutes;
    const route = routes.find((r) => r.getId() === this.routeId);

    if (route) {
      // Create new route instance to trigger Zustand reactivity
      const updatedRoute = Route.createWithType(
        route.getId(),
        route.source,
        route.destination,
        route.type,
        this.afterSegments.map((s) => ({ ...s })),
        this.afterSupports.map((s) => ({ ...s })),
        route.material,
        route.constraints
      );

      // Replace in store
      const updatedRoutes = routes.map((r) => (r.getId() === this.routeId ? updatedRoute : r));
      store.activeRoutes = updatedRoutes;
    }

    this.onExecuted();
  }

  undo(): void {
    const store = useRoutingStore.getState();
    const routes = store.activeRoutes;
    const route = routes.find((r) => r.getId() === this.routeId);

    if (route) {
      // Create new route instance to trigger Zustand reactivity
      const updatedRoute = Route.createWithType(
        route.getId(),
        route.source,
        route.destination,
        route.type,
        this.beforeSegments.map((s) => ({ ...s })),
        this.beforeSupports.map((s) => ({ ...s })),
        route.material,
        route.constraints
      );

      // Replace in store
      const updatedRoutes = routes.map((r) => (r.getId() === this.routeId ? updatedRoute : r));
      store.activeRoutes = updatedRoutes;
    }

    this.onUndone();
  }
}

