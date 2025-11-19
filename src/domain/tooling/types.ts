/**
 * Domain-level types for tooling unit detection v2.
 * Pure domain logic - no Babylon/WebGPU dependencies.
 */

/**
 * Simple 3D vector type (domain-level, no Babylon dependency).
 */
export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

/**
 * Axis-aligned bounding box.
 */
export type BoundingBox = {
  min: Vector3;
  max: Vector3;
};

/**
 * Tooling node in the structure tree.
 */
export type ToolingNode = {
  id: string;
  name?: string;
  parentId: string | null;
  children: ToolingNode[];
  transform?: {
    position: Vector3;
    rotation?: Vector3; // Euler angles in degrees
    scale?: Vector3;
  };
  meshRefs?: string[]; // References to mesh IDs
};

/**
 * Point cloud geometry for a tooling node.
 */
export type ToolingNodeGeometry = {
  nodeId: string;
  points: Vector3[]; // Sparse point cloud in world or unit space
  bbox: BoundingBox;
  centroid: Vector3;
};

/**
 * Detected tooling unit (coherent subassembly).
 */
export type ToolingUnit = {
  unitId: string;
  nodeIds: string[];
  bbox: BoundingBox;
  centroid: Vector3;
};

/**
 * Complete tooling structure tree.
 */
export type ToolingStructure = {
  root: ToolingNode | null;
  nodes: Map<string, ToolingNode>;
};

/**
 * Joint pair detected within a unit.
 */
export type JointPair = {
  unitId: string;
  nodeAId: string;
  nodeBId: string;
  score: number;
  axis: Vector3; // Estimated joint axis / clamp direction
  gap: number; // Distance between clouds along axis
  overlapRatio: number; // 2D projected overlap in plane ⟂ axis
};

/**
 * Node cloud features computed for joint pair detection.
 */
export type NodeCloudFeatures = {
  nodeId: string;
  centroid: Vector3;
  bbox: BoundingBox;
  levelCoord: number; // Projection of centroid along "level axis"
  mainAxis: Vector3; // Approx. local main axis
  size: Vector3; // Bbox extents
};

/**
 * Optional precomputed features from external tools (JT/Process Simulate).
 */
export type PrecomputedNodeFeatures = {
  nodeId: string;
  massCenter?: Vector3;
  dominantAxes?: Vector3[]; // e.g. X/Y/Z of local frame or PCA
  nominalClampAxis?: Vector3; // If known from process
  contactPatches?: {
    normal: Vector3;
    bbox: BoundingBox;
  }[];
};

