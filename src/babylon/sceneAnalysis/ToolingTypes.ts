import * as BABYLON from '@babylonjs/core';

/**
 * Detected tool joint from geometry-based analysis.
 * 
 * Represents a kinematic joint detected by StructureBasedToolAnalyzer.
 * All fields are computed from geometry + ICP, no name-based heuristics.
 */
export type DetectedToolJoint = {
  /** Unit ID this joint belongs to */
  unitId: string;
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
  /** Node IDs for the two states (for reference) */
  nodeAId: string;
  nodeBId: string;
  /** Transform matrices for the two states (for animation) */
  transformA: BABYLON.Matrix;
  transformB: BABYLON.Matrix;
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
  centerDistance: number;
  bodySize: number;
  icpError?: number;
  rotationDeg?: number;
  translationMagnitude?: number;
  classification?: 'revolute' | 'prismatic' | 'rejected';
  rejectionReason?: string;
};

/**
 * Debug snapshot of analyzer state for a fixture.
 * Pure data view of what the analyzer currently thinks.
 */
export type AnalyzerDebugSnapshot = {
  fixtureId: string;
  units: Array<{
    id: string;
    worldAabb: { min: BABYLON.Vector3; max: BABYLON.Vector3 };
    childNodeCount: number;
    jointCount: number;
  }>;
  totalUnits: number;
  totalJoints: number;
  /** Per-unit debug information (only populated when debug is enabled) */
  unitDebug?: AnalyzerUnitDebug[];
  /** Candidate pairs before classification (only populated when debug is enabled) */
  candidatePairs?: JointCandidateDebug[];
};

