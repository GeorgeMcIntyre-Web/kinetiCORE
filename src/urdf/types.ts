/**
 * URDF Type Definitions
 * Types for Unified Robot Description Format integration with kinetiCORE
 */

import * as BABYLON from '@babylonjs/core';

/**
 * URDF joint types supported by kinetiCORE
 */
export type URDFJointType =
  | 'fixed'
  | 'revolute'
  | 'continuous'
  | 'prismatic'
  | 'planar'
  | 'floating';

/**
 * Geometry information for URDF link visual/collision
 */
export interface URDFGeometry {
  type: 'box' | 'cylinder' | 'sphere' | 'mesh';
  size?: BABYLON.Vector3; // For box
  radius?: number; // For cylinder/sphere
  length?: number; // For cylinder
  filename?: string; // For mesh
}

/**
 * Material definition for URDF visual elements
 */
export interface URDFMaterial {
  name: string;
  color?: BABYLON.Color4;
  texture?: string;
}

/**
 * Visual element definition
 */
export interface URDFVisual {
  geometry: URDFGeometry;
  origin?: {
    position: BABYLON.Vector3;
    rotation: BABYLON.Vector3; // RPY (roll, pitch, yaw)
  };
  material?: URDFMaterial;
}

/**
 * Collision element definition
 */
export interface URDFCollision {
  geometry: URDFGeometry;
  origin?: {
    position: BABYLON.Vector3;
    rotation: BABYLON.Vector3;
  };
}

/**
 * Inertial properties
 */
export interface URDFInertial {
  mass: number;
  origin?: {
    position: BABYLON.Vector3;
    rotation: BABYLON.Vector3;
  };
  inertia: {
    ixx: number;
    ixy: number;
    ixz: number;
    iyy: number;
    iyz: number;
    izz: number;
  };
}

/**
 * Joint limit definition
 */
export interface URDFJointLimit {
  lower: number; // Radians for revolute, meters for prismatic
  upper: number;
  effort: number; // Maximum force/torque
  velocity: number; // Maximum velocity
}

/**
 * Joint dynamics properties
 */
export interface URDFJointDynamics {
  damping: number;
  friction: number;
}

/**
 * Joint information extracted from URDF
 */
export interface JointInfo {
  name: string;
  type: URDFJointType;
  parent: string; // Parent link name
  child: string; // Child link name
  origin: {
    position: BABYLON.Vector3;
    rotation: BABYLON.Vector3;
  };
  axis: BABYLON.Vector3;
  limit?: URDFJointLimit;
  dynamics?: URDFJointDynamics;
}

/**
 * Link information extracted from URDF
 */
export interface LinkInfo {
  name: string;
  visual?: URDFVisual[];
  collision?: URDFCollision[];
  inertial?: URDFInertial;
}

/**
 * Complete Babylon robot model created from URDF
 */
export interface BabylonRobotModel {
  root: BABYLON.TransformNode;
  links: Map<string, BABYLON.Mesh>;
  joints: Map<string, JointInfo>;
  linkNodes: Map<string, BABYLON.TransformNode>;
}

/**
 * Robot instance with physics and control
 */
export interface RobotInstance {
  model: BabylonRobotModel;
  controller: URDFJointController;
  dispose: () => void;
}

/**
 * Joint controller interface
 */
export interface URDFJointController {
  setJointAngle(jointName: string, targetAngle: number): void;
  setJointVelocity(jointName: string, velocity: number): void;
  getJointAngle(jointName: string): number;
  getJointVelocity(jointName: string): number;
  setLinkPoseKinematic(
    linkName: string,
    position: BABYLON.Vector3,
    rotation: BABYLON.Quaternion
  ): void;
}

/**
 * URDF loader options
 */
export interface URDFLoaderOptions {
  packages?: Record<string, string>; // Package name -> base path mapping
  loadMeshes?: boolean; // Load external mesh files (default: true)
  loadCollision?: boolean; // Create collision geometry (default: true)
  mergeFixedJoints?: boolean; // Optimize by merging fixed joints (default: false)
  scale?: number; // Global scale factor (default: 1.0)
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * URDF load result
 */
export interface URDFLoadResult {
  robot: BabylonRobotModel;
  links: LinkInfo[];
  joints: JointInfo[];
}
