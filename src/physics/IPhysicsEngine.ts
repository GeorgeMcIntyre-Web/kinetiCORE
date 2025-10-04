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

  // === Joint Constraints ===

  /**
   * Create a revolute joint (hinge) between two bodies
   * @param bodyA Handle of first rigid body
   * @param bodyB Handle of second rigid body
   * @param anchor Anchor point in world space
   * @param axis Rotation axis in world space
   * @returns Joint handle
   */
  createRevoluteJoint(
    bodyA: string,
    bodyB: string,
    anchor: Vector3,
    axis: Vector3
  ): string | null;

  /**
   * Create a prismatic joint (slider) between two bodies
   * @param bodyA Handle of first rigid body
   * @param bodyB Handle of second rigid body
   * @param anchor Anchor point in world space
   * @param axis Translation axis in world space
   * @returns Joint handle
   */
  createPrismaticJoint(
    bodyA: string,
    bodyB: string,
    anchor: Vector3,
    axis: Vector3
  ): string | null;

  /**
   * Create a fixed joint (rigid connection) between two bodies
   * @param bodyA Handle of first rigid body
   * @param bodyB Handle of second rigid body
   * @param anchor Anchor point in world space
   * @returns Joint handle
   */
  createFixedJoint(bodyA: string, bodyB: string, anchor: Vector3): string | null;

  /**
   * Set joint position/angle limits
   * @param jointHandle Handle of the joint
   * @param lower Lower limit (radians for revolute, meters for prismatic)
   * @param upper Upper limit
   */
  setJointLimits(jointHandle: string, lower: number, upper: number): void;

  /**
   * Set joint motor parameters
   * @param jointHandle Handle of the joint
   * @param targetVelocity Target velocity (rad/s or m/s)
   * @param maxForce Maximum force/torque
   */
  setJointMotor(jointHandle: string, targetVelocity: number, maxForce: number): void;

  /**
   * Get current joint position/angle
   * @param jointHandle Handle of the joint
   * @returns Current position/angle, or null if joint not found
   */
  getJointPosition(jointHandle: string): number | null;

  /**
   * Remove a joint constraint
   * @param jointHandle Handle of the joint
   */
  removeJoint(jointHandle: string): void;
}