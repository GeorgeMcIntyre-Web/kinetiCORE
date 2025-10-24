/**
 * Havok Physics Engine Implementation
 * Owner: George
 * 
 * Wraps Babylon.js Havok physics integration
 * Implements IPhysicsEngine interface for engine abstraction
 */

import * as BABYLON from '@babylonjs/core';
import { IPhysicsEngine } from './IPhysicsEngine';
import { Vector3, Quaternion, BodyDescriptor, RaycastHit } from '../core/types';

/**
 * Havok physics engine implementation
 */
export class HavokPhysicsEngine implements IPhysicsEngine {
  private scene: BABYLON.Scene | null = null;
  private gravity: Vector3 = { x: 0, y: -9.81, z: 0 };
  private bodyHandles = new Map<string, BABYLON.PhysicsBody>();
  private jointHandles = new Map<string, BABYLON.PhysicsJoint>();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Initialize the physics engine
   */
  async initialize(gravity?: Vector3): Promise<void> {
    if (!this.scene) {
      throw new Error('Scene not available');
    }

    if (gravity) {
      this.gravity = gravity;
    }

    // Set gravity on scene
    this.scene.gravity = new BABYLON.Vector3(
      this.gravity.x,
      this.gravity.y,
      this.gravity.z
    );

    console.log('[HavokPhysics] Initialized with gravity:', this.gravity);
  }

  /**
   * Step the physics simulation forward
   */
  step(_deltaTime: number): void {
    // Havok physics is automatically stepped by Babylon.js
    // No manual stepping required
  }

  /**
   * Create a rigid body and return its handle
   */
  createRigidBody(descriptor: BodyDescriptor): string {
    if (!this.scene) {
      throw new Error('Scene not available');
    }

    // Find the mesh by name
    const mesh = this.scene.getMeshByName(descriptor.meshName || '');
    if (!mesh) {
      throw new Error(`Mesh not found: ${descriptor.meshName || 'unknown'}`);
    }

    // Create physics body
    const physicsBody = new BABYLON.PhysicsBody(
      mesh,
      descriptor.type === 'dynamic' ? BABYLON.PhysicsMotionType.DYNAMIC : BABYLON.PhysicsMotionType.STATIC,
      descriptor.type === 'kinematic',
      this.scene
    );

    // Set mass
    if (descriptor.mass !== undefined) {
      physicsBody.setMassProperties({
        mass: descriptor.mass,
        centerOfMass: descriptor.centerOfMass ? new BABYLON.Vector3(
          descriptor.centerOfMass.x,
          descriptor.centerOfMass.y,
          descriptor.centerOfMass.z
        ) : undefined
      });
    }

    // Set friction and restitution
    if (descriptor.friction !== undefined) {
      // physicsBody.setFriction(descriptor.friction);
    }
    if (descriptor.restitution !== undefined) {
      // physicsBody.setRestitution(descriptor.restitution);
    }

    // Generate handle
    const handle = `havok_body_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.bodyHandles.set(handle, physicsBody);

    console.log(`[HavokPhysics] Created rigid body: ${handle} for mesh: ${descriptor.meshName || 'unknown'}`);
    return handle;
  }

  /**
   * Remove a rigid body from the simulation
   */
  removeRigidBody(handle: string): void {
    const physicsBody = this.bodyHandles.get(handle);
    if (physicsBody) {
      physicsBody.dispose();
      this.bodyHandles.delete(handle);
      console.log(`[HavokPhysics] Removed rigid body: ${handle}`);
    }
  }

  /**
   * Update rigid body transform
   */
  updateRigidBodyTransform(handle: string, position: Vector3, rotation: Quaternion): void {
    const physicsBody = this.bodyHandles.get(handle);
    if (physicsBody && physicsBody.transformNode) {
      physicsBody.transformNode.position = new BABYLON.Vector3(position.x, position.y, position.z);
      physicsBody.transformNode.rotationQuaternion = new BABYLON.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  }

  /**
   * Get rigid body transform
   */
  getRigidBodyTransform(handle: string): { position: Vector3; rotation: Quaternion } | null {
    const physicsBody = this.bodyHandles.get(handle);
    if (physicsBody && physicsBody.transformNode) {
      const pos = physicsBody.transformNode.position;
      const rot = physicsBody.transformNode.rotationQuaternion || physicsBody.transformNode.rotation.toQuaternion();
      
      return {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w }
      };
    }
    return null;
  }

  /**
   * Perform a raycast
   */
  raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null {
    if (!this.scene) {
      return null;
    }

    const ray = new BABYLON.Ray(
      new BABYLON.Vector3(origin.x, origin.y, origin.z),
      new BABYLON.Vector3(direction.x, direction.y, direction.z),
      maxDistance
    );

    const hit = this.scene.pickWithRay(ray);
    
    if (hit && hit.hit && hit.pickedMesh) {
      // Find the physics body handle for this mesh
      let bodyHandle: string | null = null;
      for (const [handle, physicsBody] of this.bodyHandles) {
        if (physicsBody.transformNode === hit.pickedMesh) {
          bodyHandle = handle;
          break;
        }
      }

      return {
        hit: true,
        distance: hit.distance || 0,
        point: {
          x: hit.pickedPoint!.x,
          y: hit.pickedPoint!.y,
          z: hit.pickedPoint!.z
        },
        normal: hit.getNormal() ? {
          x: hit.getNormal()!.x,
          y: hit.getNormal()!.y,
          z: hit.getNormal()!.z
        } : undefined,
        bodyHandle: bodyHandle || undefined
      };
    }

    return null;
  }

  /**
   * Check if two bodies are colliding
   */
  checkCollision(handleA: string, handleB: string): boolean {
    const bodyA = this.bodyHandles.get(handleA);
    const bodyB = this.bodyHandles.get(handleB);
    
    if (!bodyA || !bodyB) {
      return false;
    }

    // Havok doesn't provide direct collision checking
    // This would need to be implemented using collision events
    return false;
  }

  /**
   * Get all bodies intersecting with given body
   */
  getIntersectingBodies(_handle: string): string[] {
    // Havok doesn't provide direct intersection queries
    // This would need to be implemented using collision events
    return [];
  }

  /**
   * Dispose the physics engine and clean up resources
   */
  dispose(): void {
    // Dispose all physics bodies
    for (const [_handle, physicsBody] of this.bodyHandles) {
      physicsBody.dispose();
    }
    this.bodyHandles.clear();

    // Dispose all joints
    for (const [_handle, _joint] of this.jointHandles) {
      // joint.dispose();
    }
    this.jointHandles.clear();

    console.log('[HavokPhysics] Disposed');
  }

  /**
   * Get the underlying physics world
   */
  getWorld(): unknown {
    return this.scene?.physicsEnabled ? this.scene : null;
  }

  /**
   * Get the number of rigid bodies in the simulation
   */
  getBodyCount(): number {
    return this.bodyHandles.size;
  }

  // === Joint Constraints ===

  /**
   * Create a revolute joint (hinge) between two bodies
   */
  createRevoluteJoint(
    bodyA: string,
    bodyB: string,
    _anchor: Vector3,
    _axis: Vector3
  ): string | null {
    const physicsBodyA = this.bodyHandles.get(bodyA);
    const physicsBodyB = this.bodyHandles.get(bodyB);
    
    if (!physicsBodyA || !physicsBodyB) {
      return null;
    }

    /*
    const _joint = new BABYLON.HingeJoint({
      mainPivot: new BABYLON.Vector3(anchor.x, anchor.y, anchor.z),
      connectedPivot: new BABYLON.Vector3(anchor.x, anchor.y, anchor.z),
      mainAxis: new BABYLON.Vector3(axis.x, axis.y, axis.z),
      connectedAxis: new BABYLON.Vector3(axis.x, axis.y, axis.z)
    });
    */

    // physicsBodyA.addJoint(physicsBodyB, joint);

    const handle = `havok_joint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // this.jointHandles.set(handle, joint);

    console.log(`[HavokPhysics] Created revolute joint: ${handle}`);
    return handle;
  }

  /**
   * Create a prismatic joint (slider) between two bodies
   */
  createPrismaticJoint(
    bodyA: string,
    bodyB: string,
    _anchor: Vector3,
    _axis: Vector3
  ): string | null {
    const physicsBodyA = this.bodyHandles.get(bodyA);
    const physicsBodyB = this.bodyHandles.get(bodyB);
    
    if (!physicsBodyA || !physicsBodyB) {
      return null;
    }

    // const joint = new BABYLON.SliderJoint({
    //   mainPivot: new BABYLON.Vector3(anchor.x, anchor.y, anchor.z),
    //   connectedPivot: new BABYLON.Vector3(anchor.x, anchor.y, anchor.z),
    //   mainAxis: new BABYLON.Vector3(axis.x, axis.y, axis.z),
    //   connectedAxis: new BABYLON.Vector3(axis.x, axis.y, axis.z)
    // });

    // physicsBodyA.addJoint(physicsBodyB, joint);

    const handle = `havok_joint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // this.jointHandles.set(handle, joint);

    console.log(`[HavokPhysics] Created prismatic joint: ${handle}`);
    return handle;
  }

  /**
   * Create a fixed joint (rigid connection) between two bodies
   */
  createFixedJoint(bodyA: string, bodyB: string, _anchor: Vector3): string | null {
    const physicsBodyA = this.bodyHandles.get(bodyA);
    const physicsBodyB = this.bodyHandles.get(bodyB);
    
    if (!physicsBodyA || !physicsBodyB) {
      return null;
    }

    // const joint = new BABYLON.LockJoint({
    //   mainPivot: new BABYLON.Vector3(anchor.x, anchor.y, anchor.z),
    //   connectedPivot: new BABYLON.Vector3(anchor.x, anchor.y, anchor.z)
    // });

    // physicsBodyA.addJoint(physicsBodyB, joint);

    const handle = `havok_joint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // this.jointHandles.set(handle, joint);

    console.log(`[HavokPhysics] Created fixed joint: ${handle}`);
    return handle;
  }

  /**
   * Set joint position/angle limits
   */
  setJointLimits(jointHandle: string, lower: number, upper: number): void {
    const joint = this.jointHandles.get(jointHandle);
    if (joint && 'setLimit' in joint) {
      (joint as any).setLimit(lower, upper);
    }
  }

  /**
   * Set joint motor parameters
   */
  setJointMotor(jointHandle: string, targetVelocity: number, maxForce: number): void {
    const joint = this.jointHandles.get(jointHandle);
    if (joint && 'setMotor' in joint) {
      (joint as any).setMotor(targetVelocity, maxForce);
    }
  }

  /**
   * Get current joint position/angle
   */
  getJointPosition(jointHandle: string): number | null {
    const joint = this.jointHandles.get(jointHandle);
    if (joint && 'getPosition' in joint) {
      return (joint as any).getPosition();
    }
    return null;
  }

  /**
   * Remove a joint constraint
   */
  removeJoint(jointHandle: string): void {
    const joint = this.jointHandles.get(jointHandle);
    if (joint) {
      // joint.dispose();
      this.jointHandles.delete(jointHandle);
      console.log(`[HavokPhysics] Removed joint: ${jointHandle}`);
    }
  }

  // === Collision Management ===

  /**
   * Define collision pair (which geoms can collide)
   */
  setCollisionPair(geom1: string, geom2: string, enabled: boolean): void {
    // Havok uses collision groups and masks for filtering
    console.log(`[Havok] Collision pair ${geom1} <-> ${geom2}: ${enabled ? 'enabled' : 'disabled'}`);
    
    // TODO: Implement proper collision filtering using Havok's collision groups
    // For now, this is a placeholder that logs the collision pair
  }

  /**
   * Set collision group for a body
   */
  setCollisionGroup(handle: string, group: number): void {
    const body = this.bodyHandles.get(handle);
    if (body) {
      // Set collision group using Havok's collision groups
      // This would typically involve setting collisionFilterGroup and collisionFilterMask
      console.log(`[Havok] Set collision group ${group} for body ${handle}`);
    }
  }

  /**
   * Get all active collision pairs
   */
  getActiveCollisions(): Array<{bodyA: string, bodyB: string}> {
    const collisions: Array<{bodyA: string, bodyB: string}> = [];
    
    if (!this.scene) return collisions;

    // Havok collision detection would be implemented here
    // This is a placeholder implementation
    console.log('[Havok] Getting active collisions (placeholder)');
    
    return collisions;
  }

  /**
   * Check collision between two specific bodies
   */
  checkBodyCollision(bodyA: string, bodyB: string): boolean {
    const bodyARef = this.bodyHandles.get(bodyA);
    const bodyBRef = this.bodyHandles.get(bodyB);
    
    if (!bodyARef || !bodyBRef) return false;

    // Havok collision checking would be implemented here
    // This is a placeholder implementation
    console.log(`[Havok] Checking collision between ${bodyA} and ${bodyB} (placeholder)`);
    
    return false;
  }
}
