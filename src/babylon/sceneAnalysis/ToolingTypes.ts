/**
 * Tooling Analysis Types
 *
 * Centralized type definitions for tooling fixture analysis and statistical pairing.
 * These types are used across the Auto-Kinematics pipeline.
 */

import type * as BABYLON from '@babylonjs/core';

/**
 * Detected Joint from Tool Analysis
 */
export interface DetectedToolJoint {
  jointId: string;
  unitId: string;
  unitName?: string;  // Human-readable name (e.g., "UNIT_112")
  nodeAId: string;
  nodeBId: string;
  deltaType: 'revolute' | 'prismatic';
  angleDeg?: number;
  axis: BABYLON.Vector3;
  anchor: BABYLON.Vector3;
  confidence: number;
  min?: number;
  max?: number;

  // Additional properties for visualization (used by JointDebugOverlay)
  axisWorld?: BABYLON.Vector3;
  originWorld?: BABYLON.Vector3;
  isPrismatic?: boolean;
  fromVector?: BABYLON.Vector3;
  toVector?: BABYLON.Vector3;
  travelWorld?: number;
  fromCenter?: BABYLON.Vector3;
  toCenter?: BABYLON.Vector3;
}

/**
 * Joint Candidate Debug Information
 */
export interface JointCandidateDebug {
  nodeAId: string;
  nodeBId: string;
  icpError: number;
  transformMagnitude: number;
  detectedType?: 'revolute' | 'prismatic';
  confidence: number;
}

/**
 * Unit Motion Family Debug Information
 */
export interface UnitMotionFamilyDebug {
  unitId: string;
  memberNodeIds: string[];
  jointCandidates: JointCandidateDebug[];
}

/**
 * Analyzer Debug Snapshot
 */
export interface AnalyzerDebugSnapshot {
  timestamp: number;
  sceneNodeCount: number;
  unitCount: number;
  unitMotionFamilies: UnitMotionFamilyDebug[];
  detectedJoints: DetectedToolJoint[];
}
