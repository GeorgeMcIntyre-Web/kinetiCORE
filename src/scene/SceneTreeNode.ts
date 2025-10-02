// Scene Tree Node - Data structure for hierarchical scene organization
// Owner: Cole

import * as BABYLON from '@babylonjs/core';

/**
 * All possible node types in the scene tree
 */
export type NodeType =
  // Container nodes (organizational)
  | 'world'
  | 'scene'
  | 'system'
  | 'collection'
  // Geometry nodes (static objects)
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'mesh'
  // Kinematic device nodes
  | 'robot'
  | 'gripper'
  | 'actuator'
  // Kinematic component nodes
  | 'link'
  | 'joint'
  // System nodes
  | 'camera'
  | 'light';

/**
 * Joint types for kinematic devices
 */
export type JointType = 'revolute' | 'prismatic' | 'fixed';

/**
 * Device types for kinematic assemblies
 */
export type DeviceType = 'robot' | 'gripper' | 'actuator' | 'conveyor';

/**
 * Vector3 in user space (Z-up, mm)
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Joint-specific data
 */
export interface JointData {
  jointType: JointType;
  axis: Vec3; // Rotation/translation axis in local space
  limits: {
    min: number; // degrees for revolute, mm for prismatic
    max: number;
  };
  currentValue: number; // Current angle (deg) or position (mm)
  velocity?: number;
  effort?: number;
}

/**
 * Link-specific data
 */
export interface LinkData {
  mass: number; // kg
  inertia?: Vec3;
  collision: boolean; // Has collision geometry
}

/**
 * Device-specific data (robots, grippers, actuators)
 */
export interface DeviceData {
  deviceType: DeviceType;
  dof: number; // Degrees of freedom
  homePosition?: number[]; // Joint values for home position
  attachedTo?: string; // Node ID of parent device (for grippers attached to robots)
  mountFrame?: string; // Frame name for attachment point
}

/**
 * Scene tree node - represents any object in the hierarchy
 */
export interface SceneNode {
  // === Identity ===
  id: string;
  name: string; // Clean name without decorations
  type: NodeType;

  // === Hierarchy ===
  parentId: string | null;
  childIds: string[];

  // === Transform (Local Space - relative to parent) ===
  // Stored in user space (Z-up, mm)
  position: Vec3;
  rotation: Vec3; // Euler angles in degrees (X, Y, Z)
  scale: Vec3;

  // === UI State ===
  expanded: boolean; // Is tree node expanded to show children
  visible: boolean; // Is object visible in 3D view
  locked: boolean; // Is object locked from editing

  // === 3D Object References ===
  babylonMeshId?: string; // Reference to Babylon.Mesh.uniqueId
  entityId?: string; // Reference to SceneEntity in EntityRegistry

  // === Type-Specific Data ===
  jointData?: JointData;
  linkData?: LinkData;
  deviceData?: DeviceData;

  // === Metadata ===
  tags?: string[];
  userData?: Record<string, unknown>; // Custom user data
}

/**
 * Helper to create default Vec3
 */
export function createVec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

/**
 * Helper to create default SceneNode
 */
export function createSceneNode(
  type: NodeType,
  name: string,
  parentId: string | null = null
): SceneNode {
  return {
    id: generateNodeId(type),
    name,
    type,
    parentId,
    childIds: [],
    position: createVec3(),
    rotation: createVec3(),
    scale: createVec3(1, 1, 1),
    expanded: type === 'world' || type === 'scene' || type === 'system', // Auto-expand top levels
    visible: true,
    locked: type === 'world' || type === 'scene' || type === 'system', // Lock system nodes
  };
}

/**
 * Generate unique node ID
 */
function generateNodeId(type: NodeType): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${type}_${timestamp}_${random}`;
}

/**
 * Convert Babylon Vector3 to user space Vec3 (Y-up meters → Z-up mm)
 */
export function babylonToVec3(babylonVec: BABYLON.Vector3): Vec3 {
  const M_TO_MM = 1000;
  return {
    x: babylonVec.x * M_TO_MM, // X stays X
    y: babylonVec.z * M_TO_MM, // Babylon Z (forward) → User Y (forward)
    z: babylonVec.y * M_TO_MM, // Babylon Y (up) → User Z (up)
  };
}

/**
 * Convert user space Vec3 to Babylon Vector3 (Z-up mm → Y-up meters)
 */
export function vec3ToBabylon(userVec: Vec3): BABYLON.Vector3 {
  const MM_TO_M = 0.001;
  return new BABYLON.Vector3(
    userVec.x * MM_TO_M, // X stays X
    userVec.z * MM_TO_M, // User Z (up) → Babylon Y (up)
    userVec.y * MM_TO_M  // User Y (forward) → Babylon Z (forward)
  );
}

/**
 * Check if node type is a container (can have children)
 */
export function isContainerType(type: NodeType): boolean {
  return ['world', 'scene', 'system', 'collection', 'robot', 'gripper', 'actuator', 'mesh'].includes(type);
}

/**
 * Check if node type is a 3D object (has mesh/geometry)
 */
export function is3DObjectType(type: NodeType): boolean {
  return ['box', 'sphere', 'cylinder', 'mesh', 'link'].includes(type);
}

/**
 * Check if node type is a kinematic component
 */
export function isKinematicType(type: NodeType): boolean {
  return ['robot', 'gripper', 'actuator', 'link', 'joint'].includes(type);
}
