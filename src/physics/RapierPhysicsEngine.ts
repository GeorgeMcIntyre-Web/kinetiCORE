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

  async initialize(gravity: Vector3 = DEFAULT_GRAVITY): Promise<void> {
    // Initialize Rapier WASM
    await RAPIER.init();
    this.RAPIER = RAPIER;

    // Create physics world
    this.world = new RAPIER.World(new RAPIER.Vector3(gravity.x, gravity.y, gravity.z));
  }

  step(_deltaTime: number): void {
    if (!this.world) {
      console.error('Physics world not initialized');
      return;
    }
    this.world.step();
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

    return handle;
  }

  removeRigidBody(handle: string): void {
    if (!this.world) return;

    const rigidBody = this.bodies.get(handle);
    if (rigidBody) {
      this.world.removeRigidBody(rigidBody);
      this.bodies.delete(handle);
      this.colliders.delete(handle);
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
      // Find the handle for this collider
      for (const [otherHandle, otherCol] of this.colliders.entries()) {
        if (otherCol === otherCollider) {
          intersecting.push(otherHandle);
          break;
        }
      }
      return true; // Continue iteration
    });

    return intersecting;
  }

  dispose(): void {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.bodies.clear();
    this.colliders.clear();
    this.RAPIER = null;
  }

  getWorld(): RAPIER.World | null {
    return this.world;
  }
}
