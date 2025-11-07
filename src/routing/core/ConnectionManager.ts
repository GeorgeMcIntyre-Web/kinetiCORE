// Connection Manager - Manages all connection points and their network
// Owner: Routing System Team

import { Vector3 } from '../../core/types';
import { ConnectionPoint } from './ConnectionPoint';
import {
  ConnectionPointConfig,
  Connection,
  ConnectionGraph,
  RouteType,
} from './types';

const DEFAULT_DUPLICATE_TOLERANCE = 0.01; // 1 cm tolerance

/**
 * ConnectionManager manages all connection points in the scene
 * and maintains the graph of connections between them.
 * Singleton pattern ensures only one manager exists.
 */
export class ConnectionManager {
  private static instance: ConnectionManager | null = null;
  private connectionPoints = new Map<string, ConnectionPoint>();
  private connections = new Map<string, Connection[]>();
  private connectionCounter = 0;

  private constructor() {}

  /**
   * Get the singleton instance of ConnectionManager
   */
  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Add a connection point to the manager
   */
  addConnectionPoint(config: ConnectionPointConfig): ConnectionPoint {
    const duplicateId = this.findDuplicateAt(
      config.position,
      config.type,
      DEFAULT_DUPLICATE_TOLERANCE
    );

    if (duplicateId) {
      const existingPoint = this.connectionPoints.get(duplicateId);
      if (existingPoint) {
        console.warn(
          `Connection point already exists at this location (ID: ${duplicateId}). Returning existing point.`
        );
        return existingPoint;
      }
    }

    const point = new ConnectionPoint(config);
    this.connectionPoints.set(point.getId(), point);
    this.connections.set(point.getId(), []);
    return point;
  }

  /**
   * Remove a connection point and all its connections
   */
  removeConnectionPoint(id: string): boolean {
    const point = this.connectionPoints.get(id);
    if (!point) return false;

    // Remove all connections involving this point
    const pointConnections = this.connections.get(id) || [];
    for (const connection of pointConnections) {
      const otherId = connection.fromId === id ? connection.toId : connection.fromId;
      const otherConnections = this.connections.get(otherId);
      if (otherConnections) {
        const index = otherConnections.findIndex((c) => c.id === connection.id);
        if (index >= 0) {
          otherConnections.splice(index, 1);
        }
      }
    }

    this.connectionPoints.delete(id);
    this.connections.delete(id);
    return true;
  }

  /**
   * Get a connection point by ID
   */
  getConnectionPoint(id: string): ConnectionPoint | null {
    return this.connectionPoints.get(id) || null;
  }

  /**
   * Get all connection points
   */
  getAllConnectionPoints(): ConnectionPoint[] {
    return Array.from(this.connectionPoints.values());
  }

  /**
   * Find connection points near a given position
   */
  findNearbyConnections(position: Vector3, radius: number): ConnectionPoint[] {
    const nearby: ConnectionPoint[] = [];
    const radiusSquared = radius * radius;

    for (const point of this.connectionPoints.values()) {
      const dx = point.position.x - position.x;
      const dy = point.position.y - position.y;
      const dz = point.position.z - position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;

      if (distanceSquared <= radiusSquared) {
        nearby.push(point);
      }
    }

    // Sort by distance (closest first)
    nearby.sort((a, b) => {
      const distA =
        (a.position.x - position.x) ** 2 +
        (a.position.y - position.y) ** 2 +
        (a.position.z - position.z) ** 2;
      const distB =
        (b.position.x - position.x) ** 2 +
        (b.position.y - position.y) ** 2 +
        (b.position.z - position.z) ** 2;
      return distA - distB;
    });

    return nearby;
  }

  /**
   * Find connection points compatible with the given point
   */
  findCompatibleConnections(point: ConnectionPoint): ConnectionPoint[] {
    const compatible: ConnectionPoint[] = [];

    for (const other of this.connectionPoints.values()) {
      if (other.getId() !== point.getId() && point.isCompatible(other)) {
        compatible.push(other);
      }
    }

    return compatible;
  }

  /**
   * Create a connection between two connection points
   */
  createConnection(fromId: string, toId: string, routeId?: string): Connection | null {
    const from = this.connectionPoints.get(fromId);
    const to = this.connectionPoints.get(toId);

    if (!from || !to) {
      return null;
    }

    if (!from.canConnectTo(to)) {
      return null;
    }

    // Check if connection already exists
    const fromConnections = this.connections.get(fromId) || [];
    const existing = fromConnections.find((c) => c.toId === toId);
    if (existing) {
      return existing;
    }

    // Create new connection
    const connection: Connection = {
      id: `conn_${++this.connectionCounter}`,
      fromId,
      toId,
      routeId,
    };

    // Add to both points' connection lists
    fromConnections.push(connection);
    this.connections.set(fromId, fromConnections);

    const toConnections = this.connections.get(toId) || [];
    toConnections.push({
      ...connection,
      fromId: toId,
      toId: fromId,
    });
    this.connections.set(toId, toConnections);

    return connection;
  }

  /**
   * Remove a connection between two points
   * Removes the bidirectional edge from both endpoints
   */
  removeConnection(connectionId: string): boolean {
    // Find the connection to get both endpoints
    let connection: Connection | null = null;
    for (const [, connections] of this.connections.entries()) {
      const found = connections.find((c) => c.id === connectionId);
      if (found) {
        connection = found;
        break;
      }
    }

    if (!connection) {
      return false;
    }

    // Remove from both endpoints
    const fromConnections = this.connections.get(connection.fromId);
    if (fromConnections) {
      const fromIndex = fromConnections.findIndex((c) => c.id === connectionId);
      if (fromIndex >= 0) {
        fromConnections.splice(fromIndex, 1);
      }
    }

    const toConnections = this.connections.get(connection.toId);
    if (toConnections) {
      // Find the mirrored connection (swapped fromId/toId)
      const toIndex = toConnections.findIndex(
        (c) => c.id === connectionId || (c.fromId === connection.toId && c.toId === connection.fromId)
      );
      if (toIndex >= 0) {
        toConnections.splice(toIndex, 1);
      }
    }

    return true;
  }

  /**
   * Get all connections for a specific connection point
   */
  getConnections(pointId: string): Connection[] {
    return [...(this.connections.get(pointId) || [])];
  }

  /**
   * Get the complete connection graph
   */
  getConnectionGraph(): ConnectionGraph {
    return {
      connections: new Map(this.connections),
      points: new Map(this.connectionPoints),
    };
  }

  /**
   * Get all connection points of a specific type
   */
  getConnectionPointsByType(type: RouteType): ConnectionPoint[] {
    return Array.from(this.connectionPoints.values()).filter((p) => p.getType() === type);
  }

  /**
   * Find an existing connection point at the provided position and type within a tolerance
   */
  findDuplicateAt(
    position: Vector3,
    type: RouteType,
    tolerance = DEFAULT_DUPLICATE_TOLERANCE
  ): string | null {
    const safeTolerance = tolerance < 0 ? DEFAULT_DUPLICATE_TOLERANCE : tolerance;
    const toleranceSquared = safeTolerance * safeTolerance;

    for (const point of this.connectionPoints.values()) {
      if (point.getType() !== type) {
        continue;
      }

      const existingPosition = point.getPosition();
      const dx = existingPosition.x - position.x;
      const dy = existingPosition.y - position.y;
      const dz = existingPosition.z - position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;

      if (distanceSquared <= toleranceSquared) {
        return point.getId();
      }
    }

    return null;
  }

  /**
   * Clear all connection points and connections
   */
  clear(): void {
    this.connectionPoints.clear();
    this.connections.clear();
    this.connectionCounter = 0;
  }

  /**
   * Get count of connection points
   */
  getConnectionPointCount(): number {
    return this.connectionPoints.size;
  }

  /**
   * Get count of connections
   */
  getConnectionCount(): number {
    let count = 0;
    for (const connections of this.connections.values()) {
      count += connections.length;
    }
    // Each connection is stored twice (once for each endpoint)
    return count / 2;
  }
}

