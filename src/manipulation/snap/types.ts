// Snap subsystem type definitions
// Owner: George

/**
 * Anchor types for snapping, in priority order (higher = more precise)
 */
export type SnapAnchorType =
  | 'vertex'       // Mesh vertices (highest priority)
  | 'edgeMid'      // Edge midpoints
  | 'faceCenter'   // Face centers (or circle centers for circular faces)
  | 'bbox'         // Bounding box corners/center
  | 'object';      // Object center (lowest priority)

/**
 * Represents a candidate snap point on a mesh
 */
export interface SnapAnchor {
  /** Unique identifier for deduplication: meshId:localIndex:type */
  uniqueKey: string;

  /** Type of snap anchor */
  type: SnapAnchorType;

  /** World-space position */
  position: { x: number; y: number; z: number };

  /** Distance from query point (meters) */
  distance: number;

  /** Mesh unique ID this anchor belongs to */
  meshId: string;

  /** Mesh name for debugging */
  meshName: string;

  /** Local vertex/face/edge index (for deduplication) */
  localIndex: number;

  /** Optional: surface normal at this point */
  normal?: { x: number; y: number; z: number };
}

/**
 * Query parameters for snap anchor generation
 */
export interface SnapQuery {
  /** World-space query position */
  position: { x: number; y: number; z: number };

  /** Maximum distance to consider (meters) */
  maxDistance: number;

  /** Time budget per mesh (milliseconds) */
  budgetPerMesh: number;

  /** Mesh IDs to exclude from query */
  excludeMeshIds: string[];
}

/**
 * Result from snap query
 */
export interface SnapQueryResult {
  /** All candidate anchors found */
  anchors: SnapAnchor[];

  /** True if query hit time budget and some anchors were skipped */
  degraded: boolean;

  /** Total query time (milliseconds) */
  queryTimeMs: number;

  /** Number of meshes processed */
  meshesProcessed: number;
}

/**
 * Performance telemetry for snap queries
 */
export interface SnapTelemetry {
  /** Average query time over last N queries (ms) */
  avgQueryTimeMs: number;

  /** 99th percentile query time (ms) */
  p99QueryTimeMs: number;

  /** Total number of queries */
  totalQueries: number;

  /** Number of degraded queries (hit budget) */
  degradedQueries: number;

  /** Average number of candidate anchors per query */
  avgCandidateCount: number;

  /** Last query timestamp */
  lastQueryTimestamp: number;
}
