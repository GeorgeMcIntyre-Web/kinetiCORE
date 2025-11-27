/**
 * Types for automatic fixture kinematics detection from GLB files.
 * Completely name-agnostic - uses only geometry and hierarchy data.
 */

/**
 * Input JSON structure from analyze_glb_json.py
 */
export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];

export interface GLBTreeData {
  fileInfo: {
    generator: string;
    version: string;
    copyright?: string | null;
  };

  summary: {
    totalNodes: number;
    totalPointCount: number;
    rootCount: number;
    maxDepth: number;
    nodesWithMesh: number;
    nodesWithGeometry: number;
    depthDistribution: Array<{
      depth: number;
      nodeCount: number;
      pointCount: number;
    }>;
    unitCandidates?: Array<{
      index: number;
      name: string;
      nativeName: string | null;
      subtreePointCount: number;
      percentOfTotal: number;
      childCount: number;
    }>;
  };

  tree: TreeNode[];        // Nested hierarchy for visualization
  nodes: FlatNode[];       // Flat array for algorithm processing
}

/**
 * Nested tree structure (for visualization)
 */
export interface TreeNode {
  index: number;
  name: string;
  nativeName: string | null;
  depth: number;
  pointCount: number;
  subtreePointCount: number;
  meshIndex?: number | null;
  translation?: [number, number, number];
  rotation?: [number, number, number, number];  // Quaternion [x, y, z, w]
  scale?: [number, number, number];
  boundingBox?: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  extras?: Record<string, unknown>;
  children?: TreeNode[];
}

/**
 * Flat node representation (for algorithms)
 */
export interface FlatNode {
  index: number;
  name: string;
  nativeName: string | null;
  depth: number;
  parentIndex: number | null;
  childrenIndices: number[];
  meshIndex: number | null;
  pointCount: number;           // Own geometry vertex count
  subtreePointCount: number;    // Total including all descendants
  translation?: [number, number, number];
  rotation?: [number, number, number, number];  // Quaternion [x, y, z, w]
  scale?: [number, number, number];
  boundingBox?: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  extras?: Record<string, unknown>;
}

/**
 * Detected unit (coherent sub-assembly)
 */
export interface DetectedUnit {
  nodeIndex: number;
  depth: number;
  subtreePointCount: number;
  percentOfTotal: number;
  childCount: number;
  hasMovingParts: boolean;  // Determined after pose pair detection
}

/**
 * Rigid transformation (rotation + translation)
 */
export interface RigidTransform {
  rotation: number[][];        // 3x3 rotation matrix
  translation: [number, number, number];
  quaternion?: [number, number, number, number];  // Optional quaternion form
}

/**
 * World-space geometry for ICP
 */
export interface WorldSpaceGeometry {
  nodeIndex: number;
  pointCount: number;
  worldVertices: Float32Array;  // [x0,y0,z0, x1,y1,z1, ...]
  worldCentroid: [number, number, number];
}

/**
 * Geometry match between two poses
 */
export interface GeometryMatch {
  closedNodeIndex: number;
  openNodeIndex: number;
  pointCount: number;
  closedTransform: {
    translation: [number, number, number] | null;
    rotation: [number, number, number, number] | null;
  };
  openTransform: {
    translation: [number, number, number] | null;
    rotation: [number, number, number, number] | null;
  };
}

/**
 * Detected pose pair within a unit
 */
export interface PosePair {
  unitIndex: number;
  closedSubtreeIndex: number;
  openSubtreeIndex: number;
  matchingGeometry: GeometryMatch[];
  confidence: number;  // 0-1 based on percentage of geometry matched
}

/**
 * ICP algorithm result
 */
export interface ICPResult {
  rotation: number[][];              // 3x3 rotation matrix
  translation: [number, number, number];
  rmsError: number;                  // Root mean square error
  correspondences: number;           // Number of point pairs used
  converged: boolean;
}

/**
 * Axis-angle representation of rotation
 */
export interface AxisAngle {
  axis: [number, number, number];    // Unit vector
  angle: number;                      // Radians
}

/**
 * Joint type classification
 */
export type JointType = 'revolute' | 'prismatic' | 'fixed' | 'unknown';

/**
 * Classified joint with parameters
 */
export interface JointClassification {
  type: JointType;
  axis?: [number, number, number];
  pivot?: [number, number, number];
  angle?: number;       // For revolute joints (radians)
  distance?: number;    // For prismatic joints (meters)
  confidence: number;   // 0-1
}

/**
 * 3D circle for visualization
 */
export interface Circle3D {
  center: [number, number, number];
  normal: [number, number, number];
  radius: number;
  startAngle: number;
  endAngle: number;
  sweepAngle: number;
}

/**
 * Complete kinematics detection result for a fixture
 */
export interface KinematicsResult {
  fixtureInfo: {
    fileName: string;
    totalPoints: number;
    unitCount: number;
  };

  units: Array<{
    index: number;
    name: string;
    subtreePoints: number;
    percentOfTotal: number;
    jointType: JointType;
    joint?: JointClassification;
    posePair?: {
      closedSubtreeIndex: number;
      openSubtreeIndex: number;
      matchedGeometryCount: number;
      matchConfidence: number;
    };
  }>;

  diagnostics: {
    unitsDetected: number;
    unitsWithMovingParts: number;
    jointDetectionSuccessRate: number;
    warnings: string[];
  };
}

/**
 * Configuration for unit detection
 */
export interface UnitDetectionConfig {
  MIN_UNIT_PERCENT: number;      // Minimum 1% of total points
  MAX_UNIT_PERCENT: number;      // Maximum 60%
  MIN_UNIT_COUNT: number;        // Expect at least 2 units
  MAX_UNIT_COUNT: number;        // Reasonable upper bound
  PASSTHROUGH_THRESHOLD: number; // If child has >95% of parent's points
}

/**
 * Configuration for pose pair detection
 */
export interface PosePairConfig {
  POINT_COUNT_TOLERANCE: number;     // Allow 2% difference
  MIN_SUBTREE_PERCENT: number;       // Subtree must be >5% of unit
  MIN_MATCH_CONFIDENCE: number;      // At least 70% of geometry must match
  MIN_GEOMETRY_POINTS: number;       // Ignore tiny parts (100 pts)
}

/**
 * Configuration for ICP
 */
export interface ICPConfig {
  maxIterations?: number;
  convergenceThreshold?: number;
  maxCorrespondenceDistance?: number;  // meters
  subsampleRatio?: number;             // 0-1, for performance
}

/**
 * Configuration for joint classification
 */
export interface JointConfig {
  MIN_ROTATION_RAD: number;           // ~2 degrees
  MIN_TRANSLATION: number;            // 2mm
  PURE_ROTATION_TRANS_THRESHOLD: number;  // 5mm
}
