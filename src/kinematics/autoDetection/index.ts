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

// Step 4b: High-Precision ICP with Open3D (Recommended)
export {
  runICPWithOpen3D,
} from './icpOpen3D';
export type { Open3DICPConfig } from './icpOpen3D';

// Step 5: Joint Classification
export {
  classifyJoint,
  fitCircleToPointMotion,
} from './jointClassification';

// Step 6: Pivot Point Computation
// Legacy bisector method (still exported for compatibility)
export {
  computePivotPoint,
} from './jointClassification';

// Step 6b: Circle-Fitting Pivot Computation (Recommended)
export {
  computePivotFromMatrix,
  validatePivot,
  computeRotationRadius,
} from './pivotComputation';

// Math utilities
export type { Vec3, Quat, Mat3, Mat4 } from './mathUtils';
export * as MathUtils from './mathUtils';
