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
 * Cancellation token for async pathfinding
 */
export interface CancellationToken {
  isCancelled: boolean;
  cancel(): void;
}

/**
 * Create a new cancellation token
 */
export function createCancellationToken(): CancellationToken {
  return {
    isCancelled: false,
    cancel() {
      this.isCancelled = true;
    }
  };
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
   * Find optimal path between two connection points (synchronous)
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
    optimizationMode: OptimizationMode = 'shortest'
  ): Route | null {
    return this.findOptimalPathAsync(
      source, 
      destination, 
      constraints, 
      obstacles, 
      optimizationMode,
      undefined
    );
  }

  /**
   * Find optimal path between two connection points (async with cancellation)
   * @param source Source connection point
   * @param destination Destination connection point
   * @param constraints Route constraints
   * @param obstacles Array of meshes that act as obstacles
   * @param optimizationMode Optimization mode (shortest, safest, aesthetic)
   * @param cancellationToken Optional token to cancel pathfinding
   */
  findOptimalPathAsync(
    source: ConnectionPoint,
    destination: ConnectionPoint,
    constraints: RouteConstraints,
    obstacles: BABYLON.Mesh[],
    _optimizationMode: OptimizationMode = 'shortest',
    cancellationToken?: CancellationToken
  ): Route | null {
    const startPos = source.getPosition();
    const goalPos = destination.getPosition();

    // Check for cancellation
    if (cancellationToken?.isCancelled) {
      return null;
    }

    // Fast path: Check if direct line of sight exists
    if (this.hasDirectPath(startPos, goalPos, obstacles, constraints)) {
      console.log('[RouteOptimizer] Direct path available, skipping A*');
      return this.createDirectRoute(source, destination, constraints);
    }

    console.log('[RouteOptimizer] Building graph...');
    // Build search graph with tunable parameters
    const nodeDensity = 5; // Default 5 nodes per cubic meter
    const obstacleInflation = 0; // No inflation by default
    const layerSnapping = false; // No layer snapping by default
    
    const graph = this.searchGraph.buildGraph(
      startPos, 
      goalPos, 
      obstacles, 
      constraints,
      nodeDensity,
      obstacleInflation,
      layerSnapping
    );
    console.log('[RouteOptimizer] Graph built:', { nodes: graph.nodes.size, edges: graph.edges.length });

    // Find closest nodes to start and goal
    const startNode = this.findClosestNode(startPos, graph);
    const goalNode = this.findClosestNode(goalPos, graph);

    if (!startNode || !goalNode) {
      console.error('[RouteOptimizer] Failed to find start/goal nodes:', { startNode, goalNode });
      return null; // Could not find valid nodes
    }

    // Check for cancellation
    if (cancellationToken?.isCancelled) {
      return null;
    }

    console.log('[RouteOptimizer] Running A* search...');
    // Run A* search with cancellation support
    let pathNodes = this.aStarSearch(graph, startNode, goalNode, cancellationToken);

    // Fallback: If A* fails, create a simple direct path
    if (pathNodes.length === 0) {
      console.warn('[RouteOptimizer] A* failed, using direct path fallback');
      pathNodes = [startPos, goalPos];
    }

    console.log('[RouteOptimizer] Path found with', pathNodes.length, 'waypoints');

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
   * Check if a direct path exists between two points (no obstacles)
   * @returns true if direct path is clear
   */
  hasDirectPath(
    start: Vector3,
    goal: Vector3,
    obstacles: BABYLON.Mesh[],
    constraints: RouteConstraints
  ): boolean {
    const requiredClearance = constraints.clearance.otherInfrastructure;
    const numSamples = 10; // Check 10 points along the line
    
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const point: Vector3 = {
        x: start.x + (goal.x - start.x) * t,
        y: start.y + (goal.y - start.y) * t,
        z: start.z + (goal.z - start.z) * t
      };
      
      // Check clearance from all obstacles
      for (const obstacle of obstacles) {
        const boundingInfo = obstacle.getBoundingInfo();
        const boundingBox = boundingInfo.boundingBox;
        const min = boundingBox.minimumWorld;
        const max = boundingBox.maximumWorld;
        
        const closestPoint = {
          x: Math.max(min.x, Math.min(point.x, max.x)),
          y: Math.max(min.y, Math.min(point.y, max.y)),
          z: Math.max(min.z, Math.min(point.z, max.z))
        };
        
        const dx = point.x - closestPoint.x;
        const dy = point.y - closestPoint.y;
        const dz = point.z - closestPoint.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance < requiredClearance) {
          return false; // Obstacle too close
        }
      }
    }
    
    return true; // Clear path
  }

  /**
   * Create a direct route (straight line)
   */
  private createDirectRoute(
    source: ConnectionPoint,
    destination: ConnectionPoint,
    constraints: RouteConstraints
  ): Route {
    const startPos = source.getPosition();
    const goalPos = destination.getPosition();
    
    const segment = this.createSegment(startPos, goalPos, 'straight');
    const material: MaterialSpec = {
      name: this.getDefaultMaterial(source.getType()),
      properties: {},
    };
    
    return new Route(source, destination, [segment], material, constraints);
  }

  /**
   * A* pathfinding algorithm with cancellation support
   * @param cancellationToken Optional token to cancel the search
   */
  private aStarSearch(
    graph: Graph,
    start: GraphNode,
    goal: GraphNode,
    cancellationToken?: CancellationToken
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
      // Check for cancellation
      if (cancellationToken?.isCancelled) {
        return []; // Return empty path if cancelled
      }

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
   * Smooth path to reduce sharp turns using Chaikin's algorithm
   * @param segments Original route segments
   * @param iterations Number of smoothing iterations (default 2)
   * @returns Smoothed segments
   */
  private smoothPath(segments: RouteSegment[], iterations: number = 2): RouteSegment[] {
    if (segments.length <= 2) return segments;

    // Extract waypoints from segments
    const waypoints: Vector3[] = [segments[0].startPoint];
    for (const segment of segments) {
      waypoints.push(segment.endPoint);
    }

    // Apply Chaikin smoothing
    let smoothedPoints = this.chaikinSmoothing(waypoints, iterations);

    // Remove nearly collinear points to simplify path
    smoothedPoints = this.removeCollinearPoints(smoothedPoints, 0.1); // 0.1 radian tolerance

    // Convert back to segments
    const smoothedSegments: RouteSegment[] = [];
    for (let i = 0; i < smoothedPoints.length - 1; i++) {
      smoothedSegments.push(
        this.createSegment(smoothedPoints[i], smoothedPoints[i + 1], 'straight')
      );
    }

    // Mark bends in the smoothed path
    this.markBends(smoothedSegments);

    return smoothedSegments;
  }

  /**
   * Chaikin's corner-cutting algorithm for curve smoothing
   * Each iteration replaces each line segment with two smaller segments
   * @param points Original waypoints
   * @param iterations Number of smoothing iterations
   * @returns Smoothed waypoints
   */
  private chaikinSmoothing(points: Vector3[], iterations: number): Vector3[] {
    if (points.length < 3) return points;

    let currentPoints = points;

    for (let iter = 0; iter < iterations; iter++) {
      const newPoints: Vector3[] = [];
      
      // Keep first point
      newPoints.push({ ...currentPoints[0] });

      // Apply corner cutting to interior segments
      for (let i = 0; i < currentPoints.length - 1; i++) {
        const p1 = currentPoints[i];
        const p2 = currentPoints[i + 1];

        // Create two new points at 1/4 and 3/4 along the segment
        const q: Vector3 = {
          x: 0.75 * p1.x + 0.25 * p2.x,
          y: 0.75 * p1.y + 0.25 * p2.y,
          z: 0.75 * p1.z + 0.25 * p2.z
        };

        const r: Vector3 = {
          x: 0.25 * p1.x + 0.75 * p2.x,
          y: 0.25 * p1.y + 0.75 * p2.y,
          z: 0.25 * p1.z + 0.75 * p2.z
        };

        newPoints.push(q, r);
      }

      // Keep last point
      newPoints.push({ ...currentPoints[currentPoints.length - 1] });

      currentPoints = newPoints;
    }

    return currentPoints;
  }

  /**
   * Remove nearly collinear points to simplify the path
   * @param points Waypoints
   * @param angleTolerance Maximum angle deviation in radians to consider collinear
   * @returns Simplified waypoints
   */
  private removeCollinearPoints(points: Vector3[], angleTolerance: number): Vector3[] {
    if (points.length <= 2) return points;

    const simplified: Vector3[] = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const v1 = this.vectorSubtract(curr, prev);
      const v2 = this.vectorSubtract(next, curr);

      const angle = this.angleBetweenVectors(v1, v2);

      // If angle is NOT close to 180 degrees, keep this point
      if (Math.abs(Math.PI - angle) > angleTolerance) {
        simplified.push(curr);
      }
    }

    // Always keep last point
    simplified.push(points[points.length - 1]);

    return simplified;
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

