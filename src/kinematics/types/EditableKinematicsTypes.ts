/**
 * TypeScript interfaces for editable kinematics system
 * Based on EditableKinematicsSchema.json
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  position: Vector3;
  rotation: Quaternion;
  scale?: Vector3;
}

export interface JointLimits {
  position: {
    lower: number;
    upper: number;
  };
  velocity: {
    max: number;
  };
  effort: {
    max: number;
  };
}

export interface JointState {
  position: number;
  velocity: number;
  effort: number;
  isMoving?: boolean;
  lastUpdate?: string;
}

export interface LinkConstraints {
  minLength?: number;
  maxLength?: number;
  allowedAngles?: number[];
  collisionGroups?: string[];
}

export interface Joint {
  id: string;
  name: string;
  type: 'revolute' | 'prismatic' | 'continuous' | 'fixed' | 'spherical' | 'planar';
  dof: number;
  parentId: string;
  childId: string;
  transform: Transform;
  axis: Vector3;
  limits: JointLimits;
  currentState: JointState;
  isEditable?: boolean;
  isActive?: boolean;
}

export interface Link {
  id: string;
  name: string;
  startJointId: string;
  endJointId: string;
  transform: Transform;
  length: number;
  direction: Vector3;
  thickness?: number;
  style?: 'cylinder' | 'tube' | 'line';
  isEditable?: boolean;
  constraints?: LinkConstraints;
}

export interface Metadata {
  version: string;
  createdAt: string;
  lastModified: string;
  author: string;
  description: string;
  tags?: string[];
}

export interface EditableKinematicsData {
  robotId: string;
  chainId: string;
  joints: Joint[];
  links: Link[];
  metadata: Metadata;
}

export interface JointUpdateData {
  position?: number;
  velocity?: number;
  effort?: number;
  limits?: JointLimits;
}

export interface LinkUpdateData {
  transform?: Transform;
  length?: number;
  direction?: Vector3;
  thickness?: number;
  style?: 'cylinder' | 'tube' | 'line';
}

export interface ValidationResult {
  isValid: boolean;
  clampedPosition?: number;
  message?: string;
}

export interface SkeletonGizmoEditableAPI {
  // Joint operations
  updateJointPosition(robotId: string, jointId: string, position: number): boolean;
  setJointLimit(robotId: string, jointId: string, limits: JointLimits): boolean;
  validateJointLimits(robotId: string, jointId: string, position: number): ValidationResult;
  
  // Link operations
  updateLinkTransform(robotId: string, linkId: string, transform: {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  }): boolean;
  
  // Data operations
  getEditableSkeletonData(robotId: string): EditableKinematicsData | null;
  setEditableSkeletonData(robotId: string, data: {
    joints: Joint[];
    links: Link[];
  }): boolean;
}