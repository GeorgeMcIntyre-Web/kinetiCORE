/**
 * Canonical mechanical model types for universal kinematics pipeline.
 * 
 * These types are the single source of truth for all tooling scripts and debug scenes.
 * They are OEM-agnostic and naming-free - no kinematic logic depends on string patterns.
 */

export interface MechanicalNode {
  nodeId: string; // GLB node index or path, stable within the model
  parentId?: string;
  worldMatrix: number[]; // 16 numbers, column-major
  meshIds: string[];
}

export interface MeshStats {
  meshId: string;
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  vertexCount: number;
}

export interface RigidCluster {
  id: string;
  nodeIds: string[];
  meshIds: string[];
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  meshCount: number;
  totalVerts: number;
}

export type JointType = 'revolute' | 'prismatic' | 'fixed';

export interface KinematicJoint {
  id: string;
  type: JointType;
  parentClusterId: string;
  childClusterId: string;
  axis: [number, number, number]; // world-space unit vector
  origin: [number, number, number]; // world-space point
  min: number; // degrees or mm depending on type
  max: number;
}

export interface Link {
  id: string;
  clusterIds: string[]; // union of one or more rigid clusters
}

export interface MechanicalModel {
  nodes: MechanicalNode[];
  meshes: MeshStats[];
  clusters: RigidCluster[];
  links: Link[];
  joints: KinematicJoint[];
}

export interface KinematicUnit {
  id: string;
  primaryLinkId: string; // link that performs the main motion
  baseLinkId: string; // usually link_0 or a sub-base link
  jointIds: string[]; // joints belonging to this unit
  clusterIds: string[]; // geometry belonging to this unit
}

export interface UnitFeatures {
  unitId: string;
  // Geometric features
  height: number;
  extentX: number;
  extentY: number;
  extentZ: number;
  volumeApprox: number;
  slendernessY: number;
  // Contact / layout features
  distanceFromBasePlane: number;
  contactAreaWithBase: number;
  // Joint features
  jointCount: number;
  revoluteCount: number;
  prismaticCount: number;
  maxStrokeOrAngle: number;
}

