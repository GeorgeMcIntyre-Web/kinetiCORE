// Core shared types for kinetiCORE
// ⚠️ IMPORTANT: This file is shared by all team members
// Announce in Slack before making changes!

import * as BABYLON from '@babylonjs/core';

/**
 * 3D Vector (position, rotation, scale)
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Quaternion rotation
 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Transform (position, rotation, scale)
 */
export interface Transform {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

/**
 * Entity metadata
 */
export interface EntityMetadata {
  id: string;
  name: string;
  type: string;
  tags?: string[];
  customProperties?: Record<string, unknown>;
}

/**
 * Physics body types
 */
export type PhysicsBodyType = 'static' | 'dynamic' | 'kinematic';

/**
 * Collider shapes
 */
export type ColliderShape = 'box' | 'sphere' | 'cylinder' | 'capsule' | 'convexHull' | 'trimesh';

/**
 * Physics body descriptor
 */
export interface BodyDescriptor {
  type: PhysicsBodyType;
  position: Vector3;
  rotation?: Quaternion;
  shape: ColliderShape;
  dimensions?: Vector3; // For box, cylinder, etc.
  radius?: number; // For sphere, capsule
  height?: number; // For capsule, cylinder
  mass?: number;
}

/**
 * Raycast result
 */
export interface RaycastHit {
  hit: boolean;
  point?: Vector3;
  normal?: Vector3;
  distance?: number;
  colliderHandle?: string;
}

/**
 * Collision query result
 */
export interface CollisionResult {
  isColliding: boolean;
  collidingWith?: string[];
  penetrationDepth?: number;
}

/**
 * Transform mode for gizmos
 */
export type TransformMode = 'translate' | 'rotate' | 'scale';

/**
 * Editor state (for Zustand)
 */
export interface EditorState {
  selectedMeshes: BABYLON.Mesh[];
  transformMode: TransformMode;
  camera: BABYLON.Camera | null;
  isPlaying: boolean;
  
  // Actions
  selectMesh: (mesh: BABYLON.Mesh) => void;
  deselectMesh: (mesh: BABYLON.Mesh) => void;
  clearSelection: () => void;
  setTransformMode: (mode: TransformMode) => void;
  setCamera: (camera: BABYLON.Camera) => void;
  togglePlayback: () => void;
}

/**
 * Command interface for undo/redo
 */
export interface ICommand {
  execute(): void;
  undo(): void;
  canExecute(): boolean;
  description: string;
}