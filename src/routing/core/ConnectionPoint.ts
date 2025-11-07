// Connection Point - Represents a connection location for routes
// Owner: Routing System Team

import { Vector3 } from '../../core/types';
import {
  ConnectionPoint as IConnectionPoint,
  ConnectionPointConfig,
  RouteType,
} from './types';
import { generateId } from './RoutingUtils';

/**
 * ConnectionPoint class manages a connection point in the scene
 * Connection points can connect to compatible points of the same type
 */
export class ConnectionPoint implements IConnectionPoint {
  readonly id: string;
  readonly type: RouteType;
  readonly position: Vector3;
  readonly direction: Vector3;
  readonly specifications: IConnectionPoint['specifications'];
  readonly parentObject?: string;

  constructor(config: ConnectionPointConfig) {
    this.id = generateId();
    this.type = config.type;
    this.position = { ...config.position };
    // Normalize direction vector
    const dirLength = Math.sqrt(
      config.direction.x ** 2 + config.direction.y ** 2 + config.direction.z ** 2
    );
    if (dirLength > 0) {
      this.direction = {
        x: config.direction.x / dirLength,
        y: config.direction.y / dirLength,
        z: config.direction.z / dirLength,
      };
    } else {
      // Default direction is up (Z-up system)
      this.direction = { x: 0, y: 0, z: 1 };
    }
    this.specifications = { ...config.specifications };
    this.parentObject = config.parentObject;
  }

  /**
   * Get the unique identifier for this connection point
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get the position of this connection point
   */
  getPosition(): Vector3 {
    return { ...this.position };
  }

  /**
   * Get the direction vector (normalized) of this connection point
   */
  getDirection(): Vector3 {
    return { ...this.direction };
  }

  /**
   * Get the route type this connection point supports
   */
  getType(): RouteType {
    return this.type;
  }

  /**
   * Check if this connection point can connect to another point
   * Basic compatibility check based on type
   */
  canConnectTo(other: ConnectionPoint): boolean {
    if (!other) return false;
    
    // Must be same type
    if (this.type !== other.type) return false;
    
    // Additional compatibility checks can be added here
    // For example, check specifications match (size, voltage, etc.)
    return true;
  }

  /**
   * Check if this connection point is compatible with another
   * More detailed compatibility check including specifications
   */
  isCompatible(other: ConnectionPoint): boolean {
    if (!this.canConnectTo(other)) return false;

    // Check specifications compatibility
    const thisSpecs = this.specifications;
    const otherSpecs = other.specifications;

    // For pipes: check size matches
    if (this.type === 'pipe') {
      if (thisSpecs.size && otherSpecs.size && thisSpecs.size !== otherSpecs.size) {
        return false;
      }
    }

    // For electrical: check voltage matches
    if (this.type === 'electrical') {
      if (
        thisSpecs.voltage !== undefined &&
        otherSpecs.voltage !== undefined &&
        thisSpecs.voltage !== otherSpecs.voltage
      ) {
        return false;
      }
    }

    // For cable_tray and conduit: check size/material
    if (this.type === 'cable_tray' || this.type === 'conduit') {
      if (thisSpecs.size && otherSpecs.size && thisSpecs.size !== otherSpecs.size) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate distance to another connection point
   */
  distanceTo(other: ConnectionPoint): number {
    const dx = other.position.x - this.position.x;
    const dy = other.position.y - this.position.y;
    const dz = other.position.z - this.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Create a copy of this connection point
   */
  clone(): ConnectionPoint {
    return new ConnectionPoint({
      type: this.type,
      position: { ...this.position },
      direction: { ...this.direction },
      specifications: { ...this.specifications },
      parentObject: this.parentObject,
    });
  }
}

