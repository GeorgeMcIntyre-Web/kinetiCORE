// Physics Engine Abstraction Interface
// Owner: George
// DO NOT import Rapier directly anywhere else - use this interface!

import { Vector3, Quaternion, BodyDescriptor, RaycastHit } from '@core/types';

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
}