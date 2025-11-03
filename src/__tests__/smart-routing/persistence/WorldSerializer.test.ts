import { beforeEach, describe, expect, it } from 'vitest';
import { ConnectionManager } from '../../../routing/core/ConnectionManager';
import { Route } from '../../../routing/core/Route';
import { useRoutingStore } from '../../../ui/store/routingStore';
import {
  restoreRoutingState,
  serializeRoutingState,
  serializeWorldMetadata,
  type SerializedRoutingState,
} from '../../../scene/WorldSerializer';
import type { ConnectionPointConfig, RouteSegment, SupportPoint } from '../../../routing/core/types';

function resetRoutingState(): void {
  const store = useRoutingStore.getState();
  store.clearConnectionPoints();
  store.clearRoutes();
  store.clearSelection();
  store.clearValidationResults();
  store.setRoutingMode('off');
  store.setCurrentRouteType('pipe');
  store.setOptimizationMode('shortest');
  store.setPreviewRoute(null);
  store.selectRoute(null);
}

function addConnectionPoint(config: Partial<ConnectionPointConfig> = {}) {
  const connectionManager = ConnectionManager.getInstance();
  const point = connectionManager.addConnectionPoint({
    type: 'pipe',
    position: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: 1 },
    specifications: { size: '2"', material: 'Steel' },
    ...config,
  });
  useRoutingStore.getState().addConnectionPoint(point);
  return point;
}

describe('WorldSerializer routing integration', () => {
  beforeEach(() => {
    ConnectionManager.getInstance().clear();
    resetRoutingState();
  });

  it('includes routing data when serializing world metadata', () => {
    const source = addConnectionPoint();
    const destination = addConnectionPoint({ position: { x: 1, y: 0, z: 0 } });

    const segments: RouteSegment[] = [
      {
        id: 'seg-1',
        startPoint: source.getPosition(),
        endPoint: destination.getPosition(),
        segmentType: 'straight',
        length: 1,
      },
    ];

    const supports: SupportPoint[] = [
      {
        id: 'sup-1',
        position: { x: 0.5, y: 0, z: 0 },
        type: 'hanger',
        specification: 'Clamp',
      },
    ];

    const route = new Route(
      source,
      destination,
      segments,
      { name: 'Steel', properties: {} },
      {
        minBendRadius: 0.25,
        supportSpacing: 3,
        clearance: { walls: 0.1, ceiling: 0.2, floor: 0.1, otherInfrastructure: 0.2 },
      }
    );
    supports.forEach((support) => route.addSupport(support));
    useRoutingStore.getState().addRoute(route);
    ConnectionManager.getInstance().createConnection(source.getId(), destination.getId(), route.getId());

    const metadata = serializeWorldMetadata();

    expect(metadata.routing).toBeDefined();
    expect(metadata.routing?.connectors).toHaveLength(2);
    expect(metadata.routing?.routes).toHaveLength(1);
    const serializedRoute = metadata.routing?.routes[0];
    expect(serializedRoute?.sourceId).toBe(source.getId());
    expect(serializedRoute?.destinationId).toBe(destination.getId());
  });

  it('restores routing state from serialized snapshot', () => {
    const source = addConnectionPoint();
    const destination = addConnectionPoint({ position: { x: 2, y: 0, z: 0 } });

    const segments: RouteSegment[] = [
      {
        id: 'seg-1',
        startPoint: source.getPosition(),
        endPoint: destination.getPosition(),
        segmentType: 'straight',
        length: 2,
      },
      {
        id: 'seg-2',
        startPoint: destination.getPosition(),
        endPoint: { x: 2, y: 1, z: 0 },
        segmentType: 'bend',
        length: 1,
      },
    ];

    const route = new Route(
      source,
      destination,
      segments,
      { name: 'Steel', properties: {} },
      {
        minBendRadius: 0.25,
        supportSpacing: 3,
        clearance: { walls: 0.1, ceiling: 0.2, floor: 0.1, otherInfrastructure: 0.2 },
      }
    );
    useRoutingStore.getState().addRoute(route);
    ConnectionManager.getInstance().createConnection(source.getId(), destination.getId(), route.getId());

    const snapshot = serializeRoutingState() as SerializedRoutingState;
    expect(snapshot).toBeDefined();

    ConnectionManager.getInstance().clear();
    resetRoutingState();

    restoreRoutingState(snapshot);

    const store = useRoutingStore.getState();
    expect(store.connectionPoints).toHaveLength(2);
    expect(store.activeRoutes).toHaveLength(1);
    const restoredRoute = store.activeRoutes[0];
    expect(restoredRoute.segments).toHaveLength(2);
    expect(restoredRoute.type).toBe('pipe');
  });
});
