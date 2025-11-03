// Route - Represents a complete routing path from source to destination
// Owner: Routing System Team

import { Vector3 } from '../../core/types';
import {
  Route as IRoute,
  RouteSegment,
  SupportPoint,
  MaterialSpec,
  RouteConstraints,
  RouteType,
} from './types';
import { ConnectionPoint } from './ConnectionPoint';
import { generateId } from './RoutingUtils';

/**
 * Route class represents a complete routing path between two connection points
 */
export class Route implements IRoute {
  readonly id: string;
  readonly type: RouteType;
  readonly source: ConnectionPoint;
  readonly destination: ConnectionPoint;
  segments: RouteSegment[];
  supports: SupportPoint[];
  readonly material: MaterialSpec;
  readonly constraints: RouteConstraints;
  generated: boolean;

  constructor(
    source: ConnectionPoint,
    destination: ConnectionPoint,
    segments: RouteSegment[],
    material: MaterialSpec,
    constraints: RouteConstraints
  ) {
    this.id = generateId();
    this.type = source.getType();
    console.log(`[Route constructor] 🏗️ Creating route ${this.id}`);
    console.log(`[Route constructor]   Source type: ${source.getType()}`);
    console.log(`[Route constructor]   Dest type: ${destination.getType()}`);
    console.log(`[Route constructor]   Route type set to: ${this.type}`);
    this.source = source;
    this.destination = destination;
    this.segments = [...segments];
    this.supports = [];
    this.material = { ...material };
    this.constraints = { ...constraints };
    this.generated = false;
  }

  /**
   * Create a route with explicit type (for EditRouteCommand)
   */
  static createWithType(
    id: string,
    source: ConnectionPoint,
    destination: ConnectionPoint,
    type: RouteType,
    segments: RouteSegment[],
    supports: SupportPoint[],
    material: MaterialSpec,
    constraints: RouteConstraints
  ): Route {
    const route = new Route(source, destination, segments, material, constraints);
    (route as any).id = id;
    (route as any).type = type;
    route.supports = [...supports];
    return route;
  }

  /**
   * Get the unique identifier for this route
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get the total length of the route
   */
  getTotalLength(): number {
    return this.segments.reduce((sum, segment) => sum + segment.length, 0);
  }

  /**
   * Add a support point to the route
   */
  addSupport(support: SupportPoint): void {
    this.supports.push(support);
    // Sort supports by position along route
    this.sortSupports();
  }

  /**
   * Remove a support point by ID
   */
  removeSupport(supportId: string): boolean {
    const index = this.supports.findIndex((s) => s.id === supportId);
    if (index >= 0) {
      this.supports.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add a segment to the route
   */
  addSegment(segment: RouteSegment): void {
    this.segments.push(segment);
  }

  /**
   * Remove a segment by ID
   */
  removeSegment(segmentId: string): boolean {
    const index = this.segments.findIndex((s) => s.id === segmentId);
    if (index >= 0) {
      this.segments.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update a waypoint position and recompute affected segments
   */
  updateWaypoint(waypointIndex: number, newPosition: Vector3): void {
    const waypoints = this.getWaypoints();
    if (waypointIndex < 0 || waypointIndex >= waypoints.length) return;

    // Update the waypoint
    waypoints[waypointIndex] = { ...newPosition };

    // Rebuild segments from updated waypoints
    if (waypoints.length < 2) return;

    const newSegments: RouteSegment[] = [];

    // First segment from source to first waypoint
    if (waypoints.length > 0) {
      const firstSegment = this.createSegmentFromPoints(
        this.source.position,
        waypoints[0]
      );
      newSegments.push(firstSegment);
    }

    // Segments between waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
      const segment = this.createSegmentFromPoints(waypoints[i], waypoints[i + 1]);
      newSegments.push(segment);
    }

    // Last segment to destination
    const lastWaypoint = waypoints[waypoints.length - 1];
    const lastSegment = this.createSegmentFromPoints(
      lastWaypoint,
      this.destination.position
    );
    newSegments.push(lastSegment);

    // Mark bends
    this.markBends(newSegments);

    // Update segments
    this.segments = newSegments;
  }

  /**
   * Create a segment from two points
   */
  private createSegmentFromPoints(start: Vector3, end: Vector3): RouteSegment {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

      return {
      id: generateId(),
      startPoint: { ...start },
      endPoint: { ...end },
      segmentType: 'straight',
      length,
    };
  }

  /**
   * Mark bends in segments based on angle changes
   */
  private markBends(segments: RouteSegment[]): void {
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      const curr = segments[i];

      const dir1 = {
        x: prev.endPoint.x - prev.startPoint.x,
        y: prev.endPoint.y - prev.startPoint.y,
        z: prev.endPoint.z - prev.startPoint.z,
      };
      const dir2 = {
        x: curr.endPoint.x - curr.startPoint.x,
        y: curr.endPoint.y - curr.startPoint.y,
        z: curr.endPoint.z - curr.startPoint.z,
      };

      const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y + dir1.z * dir1.z);
      const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y + dir2.z * dir2.z);

      if (len1 > 0.001 && len2 > 0.001) {
        const dot = (dir1.x * dir2.x + dir1.y * dir2.y + dir1.z * dir2.z) / (len1 * len2);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

        // Mark as bend if angle > 10 degrees
        if (angle > (10 * Math.PI) / 180) {
          curr.segmentType = 'bend';
        }
      }
    }
  }

  /**
   * Get all waypoints along the route path
   */
  getWaypoints(): Vector3[] {
    const waypoints: Vector3[] = [];
    if (this.segments.length === 0) return waypoints;

    // Add start point from first segment
    waypoints.push({ ...this.segments[0].startPoint });

    // Add end point of each segment
    for (const segment of this.segments) {
      waypoints.push({ ...segment.endPoint });
    }

    return waypoints;
  }

  /**
   * Mark the route as having generated geometry
   */
  markAsGenerated(): void {
    this.generated = true;
  }

  /**
   * Mark the route as not having generated geometry
   */
  markAsNotGenerated(): void {
    this.generated = false;
  }

  /**
   * Sort supports by position along route
   */
  private sortSupports(): void {
    // Sort by distance from route start
    this.supports.sort((a, b) => {
      const distA = this.distanceToPoint(a.position);
      const distB = this.distanceToPoint(b.position);
      return distA - distB;
    });
  }

  /**
   * Calculate distance from route start to a point
   */
  private distanceToPoint(position: Vector3): number {
    const sourcePos = this.source.position;
    const dx = position.x - sourcePos.x;
    const dy = position.y - sourcePos.y;
    const dz = position.z - sourcePos.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
