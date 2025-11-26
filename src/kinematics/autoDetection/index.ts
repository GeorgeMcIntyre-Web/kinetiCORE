/**
 * Automatic Fixture Kinematics Detection
 *
 * Complete pipeline for detecting units, pose pairs, and joint parameters
 * from GLB files in a completely name-agnostic manner.
 *
 * Export all public APIs for external use.
 */

// Types
export type {
  GLBTreeData,
  FlatNode,
  TreeNode,
  DetectedUnit,
  PosePair,
  GeometryMatch,
  ICPResult,
  JointClassification,
  KinematicsResult,
  UnitDetectionConfig,
  PosePairConfig,
  ICPConfig,
  JointConfig,
  Circle3D,
  AxisAngle,
} from './types';

// Step 1: Unit Detection
export {
  detectUnits,
  getImmediateChildren,
  getAllDescendants,
  getGeometryNodes,
} from './unitDetection';

// Step 2: Pose Pair Detection
export {
  findPosePairs,
  matchGeometryByPointCount,
} from './posePairDetection';

// Step 3: Vertex Extraction
export {
  extractWorldSpaceVertices,
  extractPosePairVertices,
  debugVertexExtraction,
} from './vertexExtraction';
export type { VertexExtractionConfig } from './vertexExtraction';

// Step 4: ICP Registration
export {
  runICP,
  matrixToAxisAngle,
} from './icp';

// Step 5 & 6: Joint Classification and Pivot Computation
export {
  classifyJoint,
  computePivotPoint,
  fitCircleToPointMotion,
} from './jointClassification';

// Math utilities
export type { Vec3, Quat, Mat3, Mat4 } from './mathUtils';
export * as MathUtils from './mathUtils';
