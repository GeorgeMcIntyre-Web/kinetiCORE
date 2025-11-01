// Route Optimizer - A* pathfinding algorithm for optimal routing
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Vector3 } from '../../core/types';
import { ConnectionPoint } from '../core/ConnectionPoint';
import { Route } from '../core/Route';
import {
  RouteConstraints,
  RouteSegment,
  MaterialSpec,
  OptimizationMode,
  Graph,
  GraphNode,
} from '../core/types';
import { SearchGraph } from './SearchGraph';
import { ConstraintValidator } from './ConstraintValidator';
import { generateId } from '../core/RoutingUtils';

/**
 * A* pathfinding node with cost tracking
 */
interface AStarNode {
  node: GraphNode;
  g: number; // Cost from start
  h: number; // Heuristic cost to goal
  f: number; // Total cost (g + h)
  parent: AStarNode | null;
}

/**
 * RouteOptimizer finds optimal paths between connection points using A* algorithm
 */
export class RouteOptimizer {
  private searchGraph: SearchGraph;
  private constraintValidator: ConstraintValidator;

  constructor() {
    this.searchGraph = new SearchGraph();
    this.constraintValidator = new ConstraintValidator();
  }

  /**
   * Find optimal path between two connection points
   * @param source Source connection point
   * @param destination Destination connection point
   * @param constraints Route constraints
   * @param obstacles Array of meshes that act as obstacles
   * @param optimizationMode Optimization mode (shortest, safest, aesthetic)
   */
  findOptimalPath(
    source: ConnectionPoint,
    destination: ConnectionPoint,
    constraints: RouteConstraints,
    obstacles: BABYLON.Mesh[],
    _optimizationMode: OptimizationMode = 'shortest'
  ): Route | null {
    const startPos = source.getPosition();
    const goalPos = destination.getPosition();

    // Build search graph
    const graph = this.searchGraph.buildGraph(startPos, goalPos, obstacles, constraints);

    // Find closest nodes to start and goal
    const startNode = this.findClosestNode(startPos, graph);
    const goalNode = this.findClosestNode(goalPos, graph);

    if (!startNode || !goalNode) {
      return null; // Could not find valid nodes
    }

    // Run A* search
    const pathNodes = this.aStarSearch(graph, startNode, goalNode);

    if (pathNodes.length === 0) {
      return null; // No path found
    }

    // Convert path nodes to route segments
    const segments = this.createSegmentsFromPath(
      pathNodes,
      startPos,
      goalPos,
      constraints
    );

    // Create material spec
    const material: MaterialSpec = {
      name: this.getDefaultMaterial(source.getType()),
      properties: {},
    };

    // Create route
    const route = new Route(source, destination, segments, material, constraints);

    // Validate route
    const validation = this.constraintValidator.validateRoute(route, obstacles);
    if (!validation.isValid && validation.violations.some((v) => v.severity === 'error')) {
      // If there are critical errors, try to smooth the path
      const smoothedSegments = this.smoothPath(segments);
      return new Route(source, destination, smoothedSegments, material, constraints);
    }

    return route;
  }

  /**
   * A* pathfinding algorithm
   */
  private aStarSearch(
    graph: Graph,
    start: GraphNode,
    goal: GraphNode
  ): Vector3[] {
    const openSet: AStarNode[] = [];
    const closedSet = new Set<string>();

    // Create start node
    const startNode: AStarNode = {
      node: start,
      g: 0,
      h: this.heuristic(start, goal),
      f: this.heuristic(start, goal),
      parent: null,
    };

    openSet.push(startNode);

    while (openSet.length > 0) {
      // Get node with lowest f score
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;

      if (current.node.id === goal.id) {
        // Reconstruct path
        return this.reconstructPath(current);
      }

      closedSet.add(current.node.id);

      // Check neighbors
      const neighbors = this.searchGraph.getNeighbors(current.node.id, graph);
      for (const neighborNode of neighbors) {
        if (closedSet.has(neighborNode.id)) continue;

        const edge = graph.edges.find(
          (e) => e.from === current.node.id && e.to === neighborNode.id && e.valid
        );
        if (!edge) continue;

        const tentativeG = current.g + edge.weight;

        // Find if neighbor is already in open set
        const existingNode = openSet.find((n) => n.node.id === neighborNode.id);

        if (!existingNode) {
          // Add to open set
          const neighborAStar: AStarNode = {
            node: neighborNode,
            g: tentativeG,
            h: this.heuristic(neighborNode, goal),
            f: tentativeG + this.heuristic(neighborNode, goal),
            parent: current,
          };
          openSet.push(neighborAStar);
        } else if (tentativeG < existingNode.g) {
          // Found better path
          existingNode.g = tentativeG;
          existingNode.f = tentativeG + existingNode.h;
          existingNode.parent = current;
        }
      }

      // Safety: limit iterations to prevent infinite loops
      if (closedSet.size > 10000) {
        break;
      }
    }

    return []; // No path found
  }

  /**
   * Reconstruct path from A* search result
   */
  private reconstructPath(endNode: AStarNode): Vector3[] {
    const path: Vector3[] = [];
    let current: AStarNode | null = endNode;

    while (current) {
      path.unshift({ ...current.node.position });
      current = current.parent;
    }

    return path;
  }

  /**
   * Heuristic function (Euclidean distance)
   */
  private heuristic(node1: GraphNode, node2: GraphNode): number {
    const dx = node2.position.x - node1.position.x;
    const dy = node2.position.y - node1.position.y;
    const dz = node2.position.z - node1.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Find closest graph node to a position
   */
  private findClosestNode(position: Vector3, graph: Graph): GraphNode | null {
    let closest: GraphNode | null = null;
    let minDistance = Infinity;

    for (const node of graph.nodes.values()) {
      const distance = this.distance(position, node.position);
      if (distance < minDistance) {
        minDistance = distance;
        closest = node;
      }
    }

    return closest;
  }

  /**
   * Create route segments from path waypoints
   */
  private createSegmentsFromPath(
    waypoints: Vector3[],
    startPos: Vector3,
    goalPos: Vector3,
    _constraints: RouteConstraints
  ): RouteSegment[] {
    if (waypoints.length < 2) return [];

    const segments: RouteSegment[] = [];

    // First segment from actual start to first waypoint
    if (waypoints.length > 0 && this.distance(startPos, waypoints[0]) > 0.01) {
      segments.push(this.createSegment(startPos, waypoints[0], 'straight'));
    }

    // Segments between waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
      const segment = this.createSegment(
        waypoints[i],
        waypoints[i + 1],
        'straight'
      );
      segments.push(segment);
    }

    // Last segment to actual goal
    const lastWaypoint = waypoints[waypoints.length - 1];
    if (this.distance(lastWaypoint, goalPos) > 0.01) {
      segments.push(this.createSegment(lastWaypoint, goalPos, 'straight'));
    }

    // Detect and mark bends
    this.markBends(segments);

    return segments;
  }

  /**
   * Create a route segment
   */
  private createSegment(
    start: Vector3,
    end: Vector3,
    type: 'straight' | 'bend' | 'fitting'
  ): RouteSegment {
    const length = this.distance(start, end);

    return {
      id: generateId(),
      startPoint: { ...start },
      endPoint: { ...end },
      segmentType: type,
      length,
    };
  }

  /**
   * Mark segments as bends where appropriate
   */
  private markBends(segments: RouteSegment[]): void {
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      const curr = segments[i];

      const v1 = this.vectorSubtract(prev.endPoint, prev.startPoint);
      const v2 = this.vectorSubtract(curr.endPoint, curr.startPoint);

      const angle = this.angleBetweenVectors(v1, v2);

      // If angle is significant, mark as bend
      if (Math.abs(Math.PI - angle) > 0.1) {
        curr.segmentType = 'bend';
        // Estimate bend radius
        const len1 = this.vectorLength(v1);
        const len2 = this.vectorLength(v2);
        curr.bendRadius = (len1 + len2) / (2 * Math.sin(angle / 2));
      }
    }
  }

  /**
   * Smooth path to reduce sharp turns
   */
  private smoothPath(segments: RouteSegment[]): RouteSegment[] {
    // Simple smoothing: remove waypoints that don't significantly change direction
    // Full implementation would use more sophisticated smoothing algorithms

    if (segments.length <= 2) return segments;

    const smoothed: RouteSegment[] = [segments[0]];

    for (let i = 1; i < segments.length - 1; i++) {
      const prev = segments[i - 1];
      const curr = segments[i];
      const next = segments[i + 1];

      const v1 = this.vectorSubtract(curr.startPoint, prev.endPoint);
      const v2 = this.vectorSubtract(next.startPoint, curr.endPoint);

      const angle = this.angleBetweenVectors(v1, v2);

      // If angle is close to 180 degrees (straight), merge segments
      if (Math.abs(Math.PI - angle) < 0.2) {
        // Merge prev and next, skipping curr
        smoothed.pop();
        smoothed.push(this.createSegment(prev.startPoint, next.endPoint, 'straight'));
        i++; // Skip next segment as it's been merged
      } else {
        smoothed.push(curr);
      }
    }

    if (smoothed[smoothed.length - 1].endPoint !== segments[segments.length - 1].endPoint) {
      smoothed.push(segments[segments.length - 1]);
    }

    return smoothed;
  }

  /**
   * Get default material for route type
   */
  private getDefaultMaterial(type: string): string {
    switch (type) {
      case 'pipe':
        return 'steel';
      case 'electrical':
        return 'copper';
      case 'cable_tray':
        return 'aluminum';
      case 'conduit':
        return 'PVC';
      default:
        return 'default';
    }
  }

  /**
   * Calculate distance between two points
   */
  private distance(p1: Vector3, p2: Vector3): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Vector subtraction
   */
  private vectorSubtract(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  /**
   * Vector length
   */
  private vectorLength(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Angle between two vectors in radians
   */
  private angleBetweenVectors(v1: Vector3, v2: Vector3): number {
    const len1 = this.vectorLength(v1);
    const len2 = this.vectorLength(v2);

    if (len1 === 0 || len2 === 0) return 0;

    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const cosAngle = dot / (len1 * len2);
    const clamped = Math.max(-1, Math.min(1, cosAngle));
    return Math.acos(clamped);
  }
}

