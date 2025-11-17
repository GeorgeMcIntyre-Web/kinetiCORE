// Core types for Smart Routing System
// Owner: Routing System Team

import { Vector3 } from '../../core/types';

/**
 * Route infrastructure type
 */
export type RouteType = 'pipe' | 'electrical' | 'cable_tray' | 'conduit';

/**
 * Connection point specifications
 */
export interface ConnectionSpecifications {
  /** Size specification (e.g., "3/4 inch", "1/2 inch") */
  size?: string;
  /** Voltage for electrical connections (e.g., 480, 120) */
  voltage?: number;
  /** Material type (e.g., "steel", "PVC", "copper") */
  material?: string;
  /** Additional custom properties */
  [key: string]: unknown;
}

/**
 * Connection point in the scene where routes can originate or terminate
 */
export interface ConnectionPoint {
  /** Unique identifier for this connection point */
  id: string;
  /** Type of route this connection supports */
  type: RouteType;
  /** Position in 3D space (Z-up coordinate system) */
  position: Vector3;
  /** Direction vector indicating which way the connection faces (normalized) */
  direction: Vector3;
  /** Specifications for this connection (size, voltage, material, etc.) */
  specifications: ConnectionSpecifications;
  /** Optional parent entity ID if this connection belongs to a device/object */
  parentObject?: string;
}

/**
 * Route segment types
 */
export type SegmentType = 'straight' | 'bend' | 'fitting';

/**
 * A single segment of a route path
 */
export interface RouteSegment {
  /** Unique identifier for this segment */
  id: string;
  /** Start point of the segment (Z-up) */
  startPoint: Vector3;
  /** End point of the segment (Z-up) */
  endPoint: Vector3;
  /** Type of segment */
  segmentType: SegmentType;
  /** Bend radius if this is a bend segment */
  bendRadius?: number;
  /** Length of the segment in scene units */
  length: number;
}

/**
 * Support point types
 */
export type SupportType = 'hanger' | 'clamp' | 'bracket';

/**
 * Support point for routes (hangers, clamps, brackets)
 */
export interface SupportPoint {
  /** Unique identifier for this support */
  id: string;
  /** Position where the support is located (Z-up) */
  position: Vector3;
  /** Type of support */
  type: SupportType;
  /** Specification string for the support (e.g., "Pipe Hanger 3/4 inch") */
  specification: string;
}

/**
 * Material specification for routes
 */
export interface MaterialSpec {
  /** Material name (e.g., "Steel", "PVC", "Copper") */
  name: string;
  /** Material properties (color, roughness, etc.) */
  properties?: Record<string, unknown>;
}

/**
 * Clearance requirements for routes
 */
export interface ClearanceRequirements {
  /** Minimum clearance from walls */
  walls: number;
  /** Minimum clearance from ceiling */
  ceiling: number;
  /** Minimum clearance from floor */
  floor: number;
  /** Minimum clearance from other infrastructure */
  otherInfrastructure: number;
}

/**
 * Constraints that routes must satisfy
 */
export interface RouteConstraints {
  /** Minimum bend radius allowed */
  minBendRadius: number;
  /** Maximum run length before requiring a support (optional) */
  maxRunLength?: number;
  /** Required spacing between supports */
  supportSpacing: number;
  /** Clearance requirements */
  clearance: ClearanceRequirements;
  /** Maximum allowed elevation change between consecutive nodes (meters) */
  maxElevationDelta?: number;
  /** Maximum total elevation span for the route (meters) */
  maxElevationSpan?: number;
  /** Whether mixing floor-level and elevated segments is allowed */
  allowMixedElevation?: boolean;
  /** Minimum waypoint count required when mixing elevations */
  minNodesForMixedElevation?: number;
  /** Minimum waypoint count for a valid route */
  minNodeCount?: number;
  /** Tolerance for determining whether a waypoint is on the floor plane */
  floorSnapTolerance?: number;
}

/**
 * Complete route from source to destination
 */
export interface Route {
  /** Unique identifier for this route */
  id: string;
  /** Type of route infrastructure */
  type: RouteType;
  /** Source connection point */
  source: ConnectionPoint;
  /** Destination connection point */
  destination: ConnectionPoint;
  /** Segments that make up the route path */
  segments: RouteSegment[];
  /** Support points along the route */
  supports: SupportPoint[];
  /** Material specification */
  material: MaterialSpec;
  /** Constraints this route must satisfy */
  constraints: RouteConstraints;
  /** Whether 3D geometry has been generated for this route */
  generated: boolean;
}

/**
 * Constraint violation types
 */
export type ViolationType =
  | 'bend_radius'
  | 'clearance'
  | 'support_spacing'
  | 'length'
  | 'elevation'
  | 'topology';

/**
 * Severity levels for constraint violations
 */
export type ViolationSeverity = 'error' | 'warning' | 'info';

/**
 * A constraint violation found during route validation
 */
export interface ConstraintViolation {
  /** Type of violation */
  type: ViolationType;
  /** Severity of the violation */
  severity: ViolationSeverity;
  /** Location where the violation occurs */
  location: Vector3;
  /** Human-readable message describing the violation */
  message: string;
}

/**
 * Result of route validation
 */
export interface ValidationResult {
  /** Whether the route is valid */
  isValid: boolean;
  /** List of constraint violations */
  violations: ConstraintViolation[];
}

/**
 * Configuration for creating a connection point
 */
export interface ConnectionPointConfig {
  type: RouteType;
  position: Vector3;
  direction: Vector3;
  specifications: ConnectionSpecifications;
  parentObject?: string;
}

/**
 * Connection between two connection points
 */
export interface Connection {
  /** Unique identifier for this connection */
  id: string;
  /** Source connection point ID */
  fromId: string;
  /** Destination connection point ID */
  toId: string;
  /** Route associated with this connection (if route exists) */
  routeId?: string;
}

/**
 * Connection graph structure for managing the network of connections
 */
export interface ConnectionGraph {
  /** Map of connection point IDs to their connections */
  connections: Map<string, Connection[]>;
  /** All connection points in the graph */
  points: Map<string, ConnectionPoint>;
}

/**
 * Optimization mode for pathfinding
 */
export type OptimizationMode = 'shortest' | 'safest' | 'aesthetic';

/**
 * Graph node for pathfinding
 */
export interface GraphNode {
  /** Unique identifier */
  id: string;
  /** Position in 3D space */
  position: Vector3;
}

/**
 * Graph edge for pathfinding
 */
export interface GraphEdge {
  /** From node ID */
  from: string;
  /** To node ID */
  to: string;
  /** Weight/cost of traversing this edge */
  weight: number;
  /** Whether this edge satisfies constraints */
  valid: boolean;
}

/**
 * Navigation graph for A* pathfinding
 */
export interface Graph {
  /** Nodes in the graph */
  nodes: Map<string, GraphNode>;
  /** Edges connecting nodes */
  edges: GraphEdge[];
}

/**
 * Bill of Materials (BOM) data for a route
 * Used by geometry generators to compute material quantities
 */
export interface BOMData {
  /** Type of route infrastructure */
  type: RouteType;
  /** Size specification */
  size: string;
  /** Material name */
  material: string;
  /** Total length in meters */
  totalLength: number;
  /** Fittings used in the route */
  fittings: FittingCount[];
  /** Supports used in the route */
  supports: SupportCount[];
  /** Estimated cost in USD (optional) */
  estimatedCost?: number;
}

/**
 * Count of fittings by type
 */
export interface FittingCount {
  /** Type of fitting */
  type: 'elbow' | 'tee' | 'reducer' | 'coupling' | 'junction-box';
  /** Angle for elbows (e.g., 90, 45) */
  angle?: number;
  /** Number of fittings */
  count: number;
}

/**
 * Count of supports by type
 */
export interface SupportCount {
  /** Type of support */
  type: 'hanger' | 'clamp' | 'bracket';
  /** Specification string (e.g., "Pipe Hanger 3/4\"") */
  spec: string;
  /** Number of supports */
  count: number;
}

