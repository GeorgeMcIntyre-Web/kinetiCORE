// Factory Piping System - Domain Types
// Owner: Agent 1 (George) - Architecture Lead
// No Babylon dependencies - pure domain model

/**
 * Types of factory services that can be represented by piping networks
 */
export type PipingServiceType =
  | 'water'
  | 'air'
  | 'steam'
  | 'vacuum'
  | 'cable_tray'
  | 'electrical'
  | 'custom';

/**
 * Kinds of nodes in a piping network
 */
export type PipingNodeKind = 'endpoint' | 'support' | 'branch' | 'equipment';

/**
 * 3D position vector (Z-up coordinate system)
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * A control point (node) in a piping network
 * Represents connection points, supports, branches, or equipment
 */
export interface PipingNode {
  /** Unique identifier */
  id: string;

  /** Optional human-readable name */
  name?: string;

  /** Position in world coordinates (Z-up) */
  position: Position3D;

  /** Kind of node (affects behavior and visualization) */
  kind: PipingNodeKind;

  /** Service type this node handles */
  serviceType: PipingServiceType;

  /** Additional metadata (extensible) */
  meta?: Record<string, string>;
}

/**
 * A pipe segment connecting two nodes
 */
export interface PipingSegment {
  /** Unique identifier */
  id: string;

  /** Source node ID */
  fromNodeId: string;

  /** Destination node ID */
  toNodeId: string;

  /** Nominal diameter in millimeters (e.g., 25, 40, 50) */
  nominalDiameterMm: number;

  /** Pipe schedule (e.g., "Schedule 40", "Schedule 80") */
  schedule?: string;

  /** Whether this segment has insulation */
  hasInsulation: boolean;

  /** Slope in per-mille (‰) - for drainage, optional for pressurized lines */
  slopePerMille?: number;

  /** Hints for fittings to be used (e.g., ["elbow_90", "tee"]) */
  fittingHints?: string[];
}

/**
 * A complete piping network consisting of nodes and segments
 */
export interface PipingNetwork {
  /** Unique identifier */
  id: string;

  /** Human-readable network name */
  name: string;

  /** Primary service type for this network */
  serviceType: PipingServiceType;

  /** All nodes in the network */
  nodes: PipingNode[];

  /** All segments connecting nodes */
  segments: PipingSegment[];

  /** Additional network metadata */
  meta?: Record<string, string>;
}

/**
 * Selection state for the piping system
 */
export interface PipingSelection {
  /** Currently selected network ID (null if none) */
  networkId: string | null;

  /** Currently selected node ID (null if none) */
  nodeId: string | null;

  /** Currently selected segment ID (null if none) */
  segmentId: string | null;
}

/**
 * Supported placement modes for node elevation
 */
export type PipingPlacementMode =
  | 'on_floor'
  | 'at_elevation'
  | 'snap_to_existing';

/**
 * Placement settings that govern how new nodes inherit elevation
 */
export interface PipingPlacementSettings {
  /** How elevation is determined during placement */
  mode: PipingPlacementMode;

  /** Target elevation along Z when using elevation-driven modes */
  defaultElevationZ: number;

  /** Cached Z from the last snapped node when using snap mode */
  snapReferenceZ: number | null;
}

/**
 * Configuration for creating a new node
 */
export interface CreateNodeConfig {
  position: Position3D;
  kind: PipingNodeKind;
  serviceType: PipingServiceType;
  name?: string;
  meta?: Record<string, string>;
}

/**
 * Configuration for creating a new segment
 */
export interface CreateSegmentConfig {
  fromNodeId: string;
  toNodeId: string;
  nominalDiameterMm: number;
  schedule?: string;
  hasInsulation?: boolean;
  slopePerMille?: number;
  fittingHints?: string[];
}

/**
 * Configuration for creating a new network
 */
export interface CreateNetworkConfig {
  name: string;
  serviceType: PipingServiceType;
  meta?: Record<string, string>;
}
