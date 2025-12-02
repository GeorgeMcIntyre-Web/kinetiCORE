// Rapier Physics Engine Implementation
// Owner: George
// This is the ONLY file that should import Rapier directly

import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, Quaternion, BodyDescriptor, RaycastHit } from '../core/types';
import { IPhysicsEngine } from './IPhysicsEngine';
import { DEFAULT_GRAVITY } from '../core/constants';

export class RapierPhysicsEngine implements IPhysicsEngine {
  private RAPIER: typeof RAPIER | null = null;
  private world: RAPIER.World | null = null;
  private bodies = new Map<string, RAPIER.RigidBody>();
  private colliders = new Map<string, RAPIER.Collider>();
  private joints = new Map<string, RAPIER.ImpulseJoint>();
  // Performance optimization: reverse mapping for O(1) collider lookup
  private colliderToHandle = new Map<RAPIER.Collider, string>();
  private eventQueue: RAPIER.EventQueue | null = null;
  private activeCollisions = new Map<string, { bodyA: string; bodyB: string }>();

  async initialize(gravity: Vector3 = DEFAULT_GRAVITY): Promise<void> {
    // Skip re-initialization if already initialized
    if (this.world && this.RAPIER) {
      return;
    }

    // Initialize Rapier WASM
    await RAPIER.init();
    this.RAPIER = RAPIER;

    // Create physics world
    this.world = new RAPIER.World(new RAPIER.Vector3(gravity.x, gravity.y, gravity.z));
    this.eventQueue = new this.RAPIER.EventQueue(true);
  }

  step(_deltaTime: number): void {
    if (!this.world) {
      console.error('Physics world not initialized');
      return;
    }
    this.world.step(this.eventQueue ?? undefined);
    this.processCollisionEvents();
  }

  createRigidBody(descriptor: BodyDescriptor): string {
    if (!this.world || !this.RAPIER) {
      throw new Error('Physics engine not initialized');
    }

    const handle = crypto.randomUUID();

    // Create rigid body descriptor
    let rigidBodyDesc: RAPIER.RigidBodyDesc;

    switch (descriptor.type) {
      case 'dynamic':
        rigidBodyDesc = this.RAPIER.RigidBodyDesc.dynamic();
        break;
      case 'kinematic':
        rigidBodyDesc = this.RAPIER.RigidBodyDesc.kinematicPositionBased();
        break;
      case 'static':
      default:
        rigidBodyDesc = this.RAPIER.RigidBodyDesc.fixed();
        break;
    }

    // Set position
    rigidBodyDesc.setTranslation(descriptor.position.x, descriptor.position.y, descriptor.position.z);

    // Set rotation if provided
    if (descriptor.rotation) {
      rigidBodyDesc.setRotation({
        x: descriptor.rotation.x,
        y: descriptor.rotation.y,
        z: descriptor.rotation.z,
        w: descriptor.rotation.w,
      });
    }

    // Create rigid body
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Create collider descriptor based on shape
    let colliderDesc: RAPIER.ColliderDesc;

    switch (descriptor.shape) {
      case 'box':
        if (!descriptor.dimensions) {
          throw new Error('Box shape requires dimensions');
        }
        colliderDesc = this.RAPIER.ColliderDesc.cuboid(
          descriptor.dimensions.x / 2,
          descriptor.dimensions.y / 2,
          descriptor.dimensions.z / 2
        );
        break;

      case 'sphere':
        if (!descriptor.radius) {
          throw new Error('Sphere shape requires radius');
        }
        colliderDesc = this.RAPIER.ColliderDesc.ball(descriptor.radius);
        break;

      case 'cylinder':
        if (!descriptor.radius || !descriptor.height) {
          throw new Error('Cylinder shape requires radius and height');
        }
        colliderDesc = this.RAPIER.ColliderDesc.cylinder(descriptor.height / 2, descriptor.radius);
        break;

      case 'capsule':
        if (!descriptor.radius || !descriptor.height) {
          throw new Error('Capsule shape requires radius and height');
        }
        colliderDesc = this.RAPIER.ColliderDesc.capsule(descriptor.height / 2, descriptor.radius);
        break;

      case 'convexHull': {
        if (!descriptor.vertices) {
          throw new Error('Convex hull shape requires vertices');
        }
        const vertices = descriptor.vertices instanceof Float32Array
          ? descriptor.vertices
          : new Float32Array(descriptor.vertices);
        const hullDesc = this.RAPIER.ColliderDesc.convexHull(vertices);
        if (!hullDesc) {
          throw new Error('Failed to create convex hull collider');
        }
        colliderDesc = hullDesc;
        break;
      }

      case 'trimesh': {
        if (!descriptor.vertices || !descriptor.indices) {
          throw new Error('Trimesh shape requires vertices and indices');
        }
        const vertices = descriptor.vertices instanceof Float32Array
          ? descriptor.vertices
          : new Float32Array(descriptor.vertices);
        const indices = descriptor.indices instanceof Uint32Array
          ? descriptor.indices
          : new Uint32Array(descriptor.indices);
        colliderDesc = this.RAPIER.ColliderDesc.trimesh(vertices, indices);
        break;
      }

      default:
        throw new Error(`Unsupported collider shape: ${descriptor.shape}`);
    }

    // Set mass for dynamic bodies
    if (descriptor.type === 'dynamic' && descriptor.mass) {
      colliderDesc.setDensity(descriptor.mass);
    }

    // Create collider
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    // Store references
    this.bodies.set(handle, rigidBody);
    this.colliders.set(handle, collider);
    this.colliderToHandle.set(collider, handle);

    return handle;
  }

  removeRigidBody(handle: string): void {
    if (!this.world) return;

    const rigidBody = this.bodies.get(handle);
    if (rigidBody) {
      this.clearCollisionsForHandle(handle);
      // Remove collider first to avoid Rapier's "recursive use" error
      // Note: this.colliders is Map<string, Collider> (one collider per handle)
      const collider = this.colliders.get(handle);
      if (collider) {
        try {
          this.world.removeCollider(collider, false); // false = don't wake up bodies
        } catch (e) {
          // Ignore errors during cleanup
          console.warn('Error removing collider:', e);
        }
        this.colliders.delete(handle);
        this.colliderToHandle.delete(collider); // Clean up reverse mapping
      }

      // Now remove the rigid body
      try {
        this.world.removeRigidBody(rigidBody);
      } catch (e) {
        // Ignore errors during cleanup
        console.warn('Error removing rigid body:', e);
      }
      this.bodies.delete(handle);
    }
  }

  updateRigidBodyTransform(handle: string, position: Vector3, rotation: Quaternion): void {
    const rigidBody = this.bodies.get(handle);
    if (!rigidBody) return;

    rigidBody.setTranslation(new RAPIER.Vector3(position.x, position.y, position.z), true);
    rigidBody.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }, true);
  }

  getRigidBodyTransform(handle: string): { position: Vector3; rotation: Quaternion } | null {
    const rigidBody = this.bodies.get(handle);
    if (!rigidBody) return null;

    const translation = rigidBody.translation();
    const rotation = rigidBody.rotation();

    return {
      position: { x: translation.x, y: translation.y, z: translation.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
    };
  }

  raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null {
    if (!this.world || !this.RAPIER) return null;

    const ray = new this.RAPIER.Ray(origin, direction);
    const hit = this.world.castRay(ray, maxDistance, true);

    if (!hit) return null;

    const hitPoint = ray.pointAt(hit.toi);

    return {
      hit: true,
      point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
      distance: hit.toi,
    };
  }

  checkCollision(handleA: string, handleB: string): boolean {
    const colliderA = this.colliders.get(handleA);
    const colliderB = this.colliders.get(handleB);

    if (!colliderA || !colliderB || !this.world) return false;

    return this.world.intersectionPair(colliderA, colliderB);
  }

  getIntersectingBodies(handle: string): string[] {
    const collider = this.colliders.get(handle);
    if (!collider || !this.world) return [];

    const intersecting: string[] = [];

    this.world.intersectionsWith(collider, (otherCollider) => {
      // Performance optimization: O(1) lookup instead of O(n) search
      const otherHandle = this.colliderToHandle.get(otherCollider);
      if (otherHandle) {
        intersecting.push(otherHandle);
      }
      return true; // Continue iteration
    });

    return intersecting;
  }

  dispose(): void {
    if (!this.world) return;

    // Properly dispose all rigid bodies and colliders
    for (const [handle, rigidBody] of this.bodies) {
      try {
        // Remove collider first
        const collider = this.colliders.get(handle);
        if (collider) {
          this.world.removeCollider(collider, false);
        }
        
        // Remove rigid body
        this.world.removeRigidBody(rigidBody);
      } catch (e) {
        console.warn(`Error disposing body ${handle}:`, e);
      }
    }

    // Dispose all joints
    for (const [handle, joint] of this.joints) {
      try {
        this.world.removeImpulseJoint(joint, true);
      } catch (e) {
        console.warn(`Error disposing joint ${handle}:`, e);
      }
    }

    // Free the world
    this.world.free();
    this.world = null;

    // Clear all maps
    this.bodies.clear();
    this.colliders.clear();
    this.colliderToHandle.clear();
    this.joints.clear();
    this.RAPIER = null;
  }

  getWorld(): RAPIER.World | null {
    return this.world;
  }

  getBodyCount(): number {
    return this.bodies.size;
  }

  // === Joint Constraint Implementation ===

  createRevoluteJoint(
    bodyA: string,
    bodyB: string,
    anchor: Vector3,
    axis: Vector3
  ): string | null {
    if (!this.world || !this.RAPIER) return null;

    const rigidBodyA = this.bodies.get(bodyA);
    const rigidBodyB = this.bodies.get(bodyB);

    if (!rigidBodyA || !rigidBodyB) {
      console.error('Bodies not found for joint creation');
      return null;
    }

    // Create revolute joint parameters
    const params = this.RAPIER.JointData.revolute(
      { x: anchor.x, y: anchor.y, z: anchor.z }, // Anchor in bodyA's local space
      { x: 0, y: 0, z: 0 }, // Anchor in bodyB's local space (adjust as needed)
      { x: axis.x, y: axis.y, z: axis.z } // Rotation axis
    );

    // Create the joint
    const joint = this.world.createImpulseJoint(params, rigidBodyA, rigidBodyB, true);

    const handle = crypto.randomUUID();
    this.joints.set(handle, joint);

    return handle;
  }

  createPrismaticJoint(
    bodyA: string,
    bodyB: string,
    anchor: Vector3,
    axis: Vector3
  ): string | null {
    if (!this.world || !this.RAPIER) return null;

    const rigidBodyA = this.bodies.get(bodyA);
    const rigidBodyB = this.bodies.get(bodyB);

    if (!rigidBodyA || !rigidBodyB) {
      console.error('Bodies not found for joint creation');
      return null;
    }

    // Create prismatic joint parameters
    const params = this.RAPIER.JointData.prismatic(
      { x: anchor.x, y: anchor.y, z: anchor.z }, // Anchor in bodyA's local space
      { x: 0, y: 0, z: 0 }, // Anchor in bodyB's local space
      { x: axis.x, y: axis.y, z: axis.z } // Translation axis
    );

    // Create the joint
    const joint = this.world.createImpulseJoint(params, rigidBodyA, rigidBodyB, true);

    const handle = crypto.randomUUID();
    this.joints.set(handle, joint);

    return handle;
  }

  createFixedJoint(bodyA: string, bodyB: string, anchor: Vector3): string | null {
    if (!this.world || !this.RAPIER) return null;

    const rigidBodyA = this.bodies.get(bodyA);
    const rigidBodyB = this.bodies.get(bodyB);

    if (!rigidBodyA || !rigidBodyB) {
      console.error('Bodies not found for joint creation');
      return null;
    }

    // Create fixed joint parameters
    const params = this.RAPIER.JointData.fixed(
      { x: anchor.x, y: anchor.y, z: anchor.z }, // Anchor in bodyA's local space
      { x: 0, y: 0, z: 0, w: 1 }, // Rotation (identity quaternion)
      { x: 0, y: 0, z: 0 }, // Anchor in bodyB's local space
      { x: 0, y: 0, z: 0, w: 1 } // Rotation
    );

    // Create the joint
    const joint = this.world.createImpulseJoint(params, rigidBodyA, rigidBodyB, true);

    const handle = crypto.randomUUID();
    this.joints.set(handle, joint);

    return handle;
  }

  setJointLimits(jointHandle: string, _lower: number, _upper: number): void {
    const joint = this.joints.get(jointHandle);
    if (!joint) return;

    // Note: Rapier's ImpulseJoint limit configuration varies by joint type
    // This is a placeholder - full implementation requires tracking joint types
    // and using type-specific methods like:
    // - RevoluteJoint: setLimits(min, max)
    // - PrismaticJoint: setLimits(min, max)
    console.log('setJointLimits called for joint:', jointHandle);
  }

  setJointMotor(jointHandle: string, _targetVelocity: number, _maxForce: number): void {
    const joint = this.joints.get(jointHandle);
    if (!joint) return;

    // Note: Rapier's motor configuration varies by joint type
    // This is a placeholder - full implementation requires tracking joint types
    console.log('setJointMotor called for joint:', jointHandle);
  }

  getJointPosition(jointHandle: string): number | null {
    const joint = this.joints.get(jointHandle);
    if (!joint) return null;

    // Rapier doesn't directly expose joint position in all cases
    // This is a simplified implementation
    // For full implementation, would need to track joint type and calculate from body positions
    return 0; // TODO: Implement proper position reading
  }

  removeJoint(jointHandle: string): void {
    const joint = this.joints.get(jointHandle);
    if (!joint || !this.world) return;

    this.world.removeImpulseJoint(joint, true);
    this.joints.delete(jointHandle);
  }

  // === Collision Management ===

  setCollisionPair(geom1: string, geom2: string, enabled: boolean): void {
    // Rapier uses solver groups for collision filtering
    // This is a simplified implementation - in practice, you'd need to track
    // which colliders correspond to which geoms and set their solver groups
    console.log(`[Rapier] Collision pair ${geom1} <-> ${geom2}: ${enabled ? 'enabled' : 'disabled'}`);
    
    // TODO: Implement proper collision filtering using Rapier's solver groups
    // For now, this is a placeholder that logs the collision pair
  }

  setCollisionGroup(handle: string, group: number): void {
    const body = this.bodies.get(handle);
    if (body) {
      // Set collision group using Rapier's solver groups
      // Group 0 = default, Group 1+ = custom groups
      const collider = body.collider(0);
      if (collider) {
        collider.setSolverGroups(group);
      }
    }
  }

  getActiveCollisions(): Array<{bodyA: string, bodyB: string}> {
    return Array.from(this.activeCollisions.values());
  }

  checkBodyCollision(bodyA: string, bodyB: string): boolean {
    const key = this.getPairKey(bodyA, bodyB);
    if (this.activeCollisions.has(key)) {
      return true;
    }
    return this.checkCollision(bodyA, bodyB);
  }

  private processCollisionEvents(): void {
    if (!this.world || !this.eventQueue) return;

    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      const colliderA = this.world?.getCollider(handle1);
      const colliderB = this.world?.getCollider(handle2);
      if (!colliderA || !colliderB) return;

      const bodyA = this.colliderToHandle.get(colliderA);
      const bodyB = this.colliderToHandle.get(colliderB);
      if (!bodyA || !bodyB) return;

      const key = this.getPairKey(bodyA, bodyB);
      if (started) {
        this.activeCollisions.set(key, { bodyA, bodyB });
      } else {
        this.activeCollisions.delete(key);
      }
    });
  }

  private clearCollisionsForHandle(handle: string): void {
    for (const key of Array.from(this.activeCollisions.keys())) {
      const [bodyA, bodyB] = key.split('|');
      if (bodyA === handle || bodyB === handle) {
        this.activeCollisions.delete(key);
      }
    }
  }

  private getPairKey(bodyA: string, bodyB: string): string {
    return bodyA < bodyB ? `${bodyA}|${bodyB}` : `${bodyB}|${bodyA}`;
  }
}
