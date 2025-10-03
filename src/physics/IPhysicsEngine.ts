// Physics Engine Abstraction Interface
// Owner: George
// DO NOT import Rapier directly anywhere else - use this interface!

import { Vector3, Quaternion, BodyDescriptor, RaycastHit } from '@core/types';

// Advanced collision types
export interface CollisionContact {
  point: Vector3;
  normal: Vector3;
  depth: number;
  bodyA: string;
  bodyB: string;
  faceIndexA?: number;
  faceIndexB?: number;
  timestamp: number;
}

export interface CollisionManifold {
  bodyA: string;
  bodyB: string;
  contacts: CollisionContact[];
  totalPenetration: number;
  isNewCollision: boolean;
  isPersistent: boolean;
}

export interface ConvexDecomposition {
  hulls: any[];
  hullCount: number;
  sourceVertices: Float32Array;
  sourceIndices: Uint32Array;
}

export interface TriMeshCollider {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  triangleCount: number;
  spatialHash: Map<string, number[]>;
}

/**
 * Abstract physics engine interface
 * Allows swapping physics engines without changing application code
 */
export interface IPhysicsEngine {
  /**
   * Initialize the physics engine
   * Must be called before any other methods
   */
  initialize(gravity?: Vector3): Promise<void>;

  /**
   * Step the physics simulation forward
   * Call this once per frame in the render loop
   */
  step(deltaTime: number): void;

  /**
   * Create a rigid body and return its handle
   */
  createRigidBody(descriptor: BodyDescriptor): string;

  /**
   * Remove a rigid body from the simulation
   */
  removeRigidBody(handle: string): void;

  /**
   * Update rigid body transform
   */
  updateRigidBodyTransform(handle: string, position: Vector3, rotation: Quaternion): void;

  /**
   * Get rigid body transform
   */
  getRigidBodyTransform(handle: string): { position: Vector3; rotation: Quaternion } | null;

  /**
   * Perform a raycast
   */
  raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null;

  /**
   * Check if two bodies are colliding
   */
  checkCollision(handleA: string, handleB: string): boolean;

  /**
   * Get all bodies intersecting with given body
   */
  getIntersectingBodies(handle: string): string[];

  /**
   * Dispose the physics engine and clean up resources
   */
  dispose(): void;

  /**
   * Get the underlying physics world (for advanced use)
   * Use sparingly - prefer using the abstraction methods
   */
  getWorld(): unknown;

  /**
   * Create precise triangle mesh collider from mesh data
   */
  createTriMeshCollider(mesh: any, descriptor: BodyDescriptor): string;

  /**
   * Create convex hull collider (faster than trimesh)
   */
  createConvexHullCollider(mesh: any, descriptor: BodyDescriptor): string;

  /**
   * Decompose concave mesh into multiple convex hulls
   */
  createCompoundConvexCollider(
    mesh: any,
    descriptor: BodyDescriptor,
    maxHulls?: number
  ): string;

  /**
   * Get ALL collision contacts for a body (not just boolean)
   */
  getCollisionContacts(handle: string): CollisionContact[];

  /**
   * Get detailed collision manifold between two specific bodies
   */
  getCollisionManifold(handleA: string, handleB: string): CollisionManifold | null;

  /**
   * Get all active collision pairs in the scene
   */
  getAllCollisions(): CollisionManifold[];

  /**
   * Query for potential collisions using swept volume
   */
  sweepTest(handle: string, direction: Vector3, distance: number): CollisionContact[];

  /**
   * Enable/disable collision between specific body pairs
   */
  setCollisionFilter(handleA: string, handleB: string, enabled: boolean): void;

  /**
   * Set collision layer/mask for selective collision
   */
  setCollisionLayer(handle: string, layer: number, mask: number): void;
}