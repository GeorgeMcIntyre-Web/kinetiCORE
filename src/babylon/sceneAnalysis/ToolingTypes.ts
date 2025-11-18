import * as BABYLON from '@babylonjs/core';

/**
 * Detected tool joint from geometry-based analysis.
 * 
 * Represents a kinematic joint detected by StructureBasedToolAnalyzer.
 * All fields are computed from geometry + ICP, no name-based heuristics.
 */
/**
 * Simple 3D vector type for serialization-friendly motion data.
 */
export type Vector3Like = {
  x: number;
  y: number;
  z: number;
};

export type DetectedToolJoint = {
  /** Unit ID this joint belongs to */
  unitId: string;
  /** Geometry family ID this joint belongs to (for deduplication) */
  familyId: string;
  /** Unique joint identifier (unitId + joint index) */
  jointId: string;
  /** Stroke category for diagnostics */
  strokeCategory: 'normal' | 'longStroke';
  /** Translation ratio (translationMag / bodySize) */
  translationRatio: number;
  /** Joint axis in world space (unit vector) */
  axisWorld: BABYLON.Vector3;
  /** Travel distance/angle in world space (meters for prismatic, radians for revolute) */
  travelWorld: number;
  /** Origin/anchor point in world space */
  originWorld: BABYLON.Vector3;
  /** True if prismatic (translation), false if revolute (rotation) */
  isPrismatic: boolean;
  /** ICP error for quality assessment */
  icpError: number;
  /** Body size (world-space bounding box diagonal, meters) - used for deduplication */
  bodySize: number;
  /** Vertex count for state A (geometry point count) */
  vertexCountA: number;
  /** Vertex count for state B (geometry point count) */
  vertexCountB: number;
  /** Vertex similarity score (0-1, where 1 = identical vertex counts) */
  vertexSimilarity: number;
  /** Whether this joint comes from a family with exactly 2 transform states (open/closed clamp) */
  isTwoStateFamily: boolean;
  /** Node IDs for the two states (for reference) */
  nodeAId: string;
  nodeBId: string;
  /** Transform matrices for the two states (for animation) */
  transformA: BABYLON.Matrix;
  transformB: BABYLON.Matrix;
  /** Joint type classification */
  deltaType: 'revolute' | 'prismatic' | 'unknown';
  /** Normalized world-space axis of rotation (for revolute joints) */
  axis?: Vector3Like;
  /** Shortest-arc angle of motion between the two states, in degrees */
  angleDeg?: number;
  /** World-space center of geometry in state A (from pose) */
  fromCenter?: Vector3Like;
  /** World-space center of geometry in state B (to pose) */
  toCenter?: Vector3Like;
  /** Magnitude of translation between centers, in meters */
  translationMagnitude?: number;
};

/**
 * Debug information for a geometry family (rigid body).
 */
export type AnalyzerFamilyDebug = {
  familyId: string;
  memberCount: number;
  stateCount: number;
  pairsCount: number;
};

/**
 * Debug information for a unit.
 */
export type AnalyzerUnitDebug = {
  unitId: string;
  families: AnalyzerFamilyDebug[];
  jointCount: number;
};

/**
 * Debug information for a candidate joint pair (before classification).
 */
export type JointCandidateDebug = {
  unitId: string;
  familyId: string;
  stateAId: string;
  stateBId: string;
  stateAName?: string;
  stateBName?: string;
  stateAAncestorId?: string;
  stateBAncestorId?: string;
  stateAAncestorName?: string;
  stateBAncestorName?: string;
  centerDistance: number;
  bodySize: number;
  icpError?: number;
  rotationDeg?: number;
  translationMagnitude?: number;
  classification?: 'revolute' | 'prismatic' | 'rejected';
  rejectionReason?: string;
  initialRotationDeg?: number;
  initialTranslationMagnitude?: number;
};

/**
 * Debug information for a motion family within a unit.
 * Represents a geometry family (rigid body) that appears in multiple transform states within a unit.
 */
export type UnitMotionFamilyDebug = {
  /** Unit ID this family belongs to */
  unitId: string;
  /** Family ID (unique identifier for this geometry family) */
  familyId: string;
  /** Number of distinct transform states for this geometry in this unit */
  stateCount: number;
  /** Representative vertex count (all states should have similar counts) */
  vertexCount: number;
  /** World-space size of the geometry (bounding box diagonal, meters) */
  bodySize: number;
};

/**
 * Debug snapshot of analyzer state for a fixture.
 * Pure data view of what the analyzer currently thinks.
 */
export type AnalyzerDebugSnapshot = {
  fixtureId: string;
  units: Array<{
    id: string;
    name?: string; // Unit name (e.g., "UNIT_112") for test validation
    worldAabb: { min: BABYLON.Vector3; max: BABYLON.Vector3 };
    childNodeCount: number;
    jointCount: number;
    nodes?: Array<{
      id: string;
      name?: string;
      parentId?: string;
      parentName?: string;
      position?: BABYLON.Vector3;
    }>;
  }>;
  totalUnits: number;
  totalJoints: number;
  /** Unit candidates count before clustering (for debug) */
  unitCandidatesCount?: number;
  /** Per-unit debug information (only populated when debug is enabled) */
  unitDebug?: AnalyzerUnitDebug[];
  /** Candidate pairs before classification (only populated when debug is enabled) */
  candidatePairs?: JointCandidateDebug[];
  /** Per-unit motion families (geometry families with transform states) */
  unitMotionFamilies?: UnitMotionFamilyDebug[];
};

