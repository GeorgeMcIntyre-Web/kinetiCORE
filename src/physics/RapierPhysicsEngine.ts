// Rapier Physics Engine Implementation
// Owner: George
// This is the ONLY file that should import Rapier directly

import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, Quaternion, BodyDescriptor, RaycastHit } from '../core/types';
import { IPhysicsEngine, CollisionContact, CollisionManifold } from './IPhysicsEngine';
import { DEFAULT_GRAVITY } from '../core/constants';

export class RapierPhysicsEngine implements IPhysicsEngine {
  private RAPIER: typeof RAPIER | null = null;
  private world: any | null = null;
  private bodies = new Map<string, any>();
  private colliders = new Map<string, any>();
  private collisionContacts = new Map<string, CollisionContact[]>();
  private collisionManifolds: CollisionManifold[] = [];
  private layerInfo = new Map<string, { layer: number; mask: number }>();

  async initialize(gravity: Vector3 = DEFAULT_GRAVITY): Promise<void> {
    // Initialize Rapier WASM
    await RAPIER.init();
    this.RAPIER = RAPIER;

    // Create physics world
    this.world = new (RAPIER as any).World(new (RAPIER as any).Vector3(gravity.x, gravity.y, gravity.z));
  }

  step(_deltaTime: number): void {
    if (!this.world) {
      console.error('Physics world not initialized');
      return;
    }
    this.world.step();
    this.updateCollisions();
  }

  createRigidBody(descriptor: BodyDescriptor): string {
    if (!this.world || !this.RAPIER) {
      throw new Error('Physics engine not initialized');
    }

    const handle = crypto.randomUUID();

    // Create rigid body descriptor
    let rigidBodyDesc: any;

    switch (descriptor.type) {
      case 'dynamic':
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.dynamic();
        break;
      case 'kinematic':
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.kinematicPositionBased();
        break;
      case 'static':
      default:
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.fixed();
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
    let colliderDesc: any;

    switch (descriptor.shape) {
      case 'box':
        if (!descriptor.dimensions) {
          throw new Error('Box shape requires dimensions');
        }
        colliderDesc = (this.RAPIER as any).ColliderDesc.cuboid(
          descriptor.dimensions.x / 2,
          descriptor.dimensions.y / 2,
          descriptor.dimensions.z / 2
        );
        break;

      case 'sphere':
        if (!descriptor.radius) {
          throw new Error('Sphere shape requires radius');
        }
        colliderDesc = (this.RAPIER as any).ColliderDesc.ball(descriptor.radius);
        break;

      case 'cylinder':
        if (!descriptor.radius || !descriptor.height) {
          throw new Error('Cylinder shape requires radius and height');
        }
        colliderDesc = (this.RAPIER as any).ColliderDesc.cylinder(descriptor.height / 2, descriptor.radius);
        break;

      case 'capsule':
        if (!descriptor.radius || !descriptor.height) {
          throw new Error('Capsule shape requires radius and height');
        }
        colliderDesc = (this.RAPIER as any).ColliderDesc.capsule(descriptor.height / 2, descriptor.radius);
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
    this.layerInfo.set(handle, { layer: 1, mask: 0xffff });

    return handle;
  }

  /**
   * Create TRIANGLE MESH collider - Most accurate for irregular bodies
   */
  createTriMeshCollider(mesh: any, descriptor: BodyDescriptor): string {
    if (!this.world || !this.RAPIER) {
      throw new Error('Physics engine not initialized');
    }

    const handle = crypto.randomUUID();

    const positions = mesh.getVerticesData((RAPIER as any).VertexBuffer?.PositionKind || 'position');
    const indices = mesh.getIndices();
    if (!positions || !indices) {
      throw new Error('Mesh has no geometry data');
    }

    const vertices = new Float32Array(positions);
    const triangles = new Uint32Array(indices);

    let rigidBodyDesc: any;
    switch (descriptor.type) {
      case 'dynamic':
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.dynamic();
        break;
      case 'kinematic':
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.kinematicPositionBased();
        break;
      case 'static':
      default:
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.fixed();
        break;
    }

    rigidBodyDesc.setTranslation(descriptor.position.x, descriptor.position.y, descriptor.position.z);
    if (descriptor.rotation) {
      rigidBodyDesc.setRotation({ x: descriptor.rotation.x, y: descriptor.rotation.y, z: descriptor.rotation.z, w: descriptor.rotation.w });
    }

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);
    const colliderDesc = (this.RAPIER as any).ColliderDesc.trimesh(vertices, triangles);
    if (descriptor.type === 'dynamic' && descriptor.mass) {
      colliderDesc.setDensity(descriptor.mass);
    }
    colliderDesc.setActiveEvents((this.RAPIER as any).ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    this.bodies.set(handle, rigidBody);
    this.colliders.set(handle, collider);
    this.layerInfo.set(handle, { layer: 1, mask: 0xffff });

    return handle;
  }

  /**
   * Create CONVEX HULL collider
   */
  createConvexHullCollider(mesh: any, descriptor: BodyDescriptor): string {
    if (!this.world || !this.RAPIER) {
      throw new Error('Physics engine not initialized');
    }

    const handle = crypto.randomUUID();
    const positions = mesh.getVerticesData((RAPIER as any).VertexBuffer?.PositionKind || 'position');
    if (!positions) {
      throw new Error('Mesh has no geometry data');
    }
    const vertices = new Float32Array(positions);

    let rigidBodyDesc: any;
    switch (descriptor.type) {
      case 'dynamic':
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.dynamic();
        break;
      case 'kinematic':
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.kinematicPositionBased();
        break;
      case 'static':
      default:
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.fixed();
        break;
    }
    rigidBodyDesc.setTranslation(descriptor.position.x, descriptor.position.y, descriptor.position.z);
    if (descriptor.rotation) {
      rigidBodyDesc.setRotation({ x: descriptor.rotation.x, y: descriptor.rotation.y, z: descriptor.rotation.z, w: descriptor.rotation.w });
    }

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);
    const colliderDesc = (this.RAPIER as any).ColliderDesc.convexHull(vertices);
    if (!colliderDesc) {
      throw new Error('Failed to create convex hull collider');
    }
    if (descriptor.type === 'dynamic' && descriptor.mass) {
      colliderDesc.setDensity(descriptor.mass);
    }
    colliderDesc.setActiveEvents((this.RAPIER as any).ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    this.bodies.set(handle, rigidBody);
    this.colliders.set(handle, collider);
    this.layerInfo.set(handle, { layer: 1, mask: 0xffff });

    return handle;
  }

  /**
   * Create COMPOUND CONVEX collider (approximate)
   */
  createCompoundConvexCollider(mesh: any, descriptor: BodyDescriptor, maxHulls: number = 32): string {
    if (!this.world || !this.RAPIER) {
      throw new Error('Physics engine not initialized');
    }

    const handle = crypto.randomUUID();

    let rigidBodyDesc: any;
    switch (descriptor.type) {
      case 'dynamic':
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.dynamic();
        break;
      case 'kinematic':
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.kinematicPositionBased();
        break;
      case 'static':
      default:
        rigidBodyDesc = (this.RAPIER as any).RigidBodyDesc.fixed();
        break;
    }
    rigidBodyDesc.setTranslation(descriptor.position.x, descriptor.position.y, descriptor.position.z);
    if (descriptor.rotation) {
      rigidBodyDesc.setRotation({ x: descriptor.rotation.x, y: descriptor.rotation.y, z: descriptor.rotation.z, w: descriptor.rotation.w });
    }

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Very simplified decomposition: split vertex array into chunks and create small hulls
    const positions = mesh.getVerticesData('position') || [];
    const chunkSize = Math.max(12, Math.floor(positions.length / Math.max(1, maxHulls)));
    const colliders: any[] = [];
    for (let i = 0; i < positions.length; i += chunkSize) {
      const slice = positions.slice(i, Math.min(i + chunkSize, positions.length));
      if (slice.length < 12) continue;
      const verts = new Float32Array(slice);
      const desc = (this.RAPIER as any).ColliderDesc.convexHull(verts);
      if (!desc) continue;
      desc.setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);
      const col = this.world.createCollider(desc, rigidBody);
      colliders.push(col);
    }
    if (colliders.length === 0) {
      // Fallback to a single convex hull of the whole mesh
      const verts = new Float32Array(positions);
      const desc = (this.RAPIER as any).ColliderDesc.convexHull(verts);
      if (!desc) {
        throw new Error('Failed to create any convex hull for compound collider');
      }
      const col = this.world.createCollider(desc, rigidBody);
      colliders.push(col);
    }

    this.bodies.set(handle, rigidBody);
    this.colliders.set(handle, colliders[0]);
    this.layerInfo.set(handle, { layer: 1, mask: 0xffff });

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

    rigidBody.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
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

    this.world.intersectionsWith(collider, (otherCollider: any) => {
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
    this.collisionContacts.clear();
    this.collisionManifolds = [];
    this.layerInfo.clear();
    this.RAPIER = null;
  }

  getWorld(): any | null {
    return this.world;
  }

  /** Get all contacts for a body */
  getCollisionContacts(handle: string): CollisionContact[] {
    return this.collisionContacts.get(handle) || [];
  }

  /** Get manifold between two bodies */
  getCollisionManifold(handleA: string, handleB: string): CollisionManifold | null {
    return this.collisionManifolds.find(
      (m) => (m.bodyA === handleA && m.bodyB === handleB) || (m.bodyA === handleB && m.bodyB === handleA)
    ) || null;
  }

  /** Get all active collisions */
  getAllCollisions(): CollisionManifold[] {
    return [...this.collisionManifolds];
  }

  /** Sweep test using ray approximation */
  sweepTest(handle: string, direction: Vector3, distance: number): CollisionContact[] {
    if (!this.world || !this.RAPIER) return [];
    const collider = this.colliders.get(handle);
    if (!collider) return [];

    const origin = collider.translation();
    const ray = new this.RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, direction);

    const hits: CollisionContact[] = [];
    // Iterate all ray intersections if available
    if ((this.world as any).intersectionsWithRay) {
      (this.world as any).intersectionsWithRay(ray, distance, true, (hit: any) => {
        hits.push({
          point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
          normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
          depth: hit.toi,
          bodyA: handle,
          bodyB: this.findHandleForCollider(hit.collider) || 'unknown',
          timestamp: Date.now(),
        });
        return true;
      });
    } else {
      const single = this.world.castRay(ray, distance, true);
      if (single) {
        const pt = ray.pointAt(single.toi);
        hits.push({
          point: { x: pt.x, y: pt.y, z: pt.z },
          normal: { x: direction.x, y: direction.y, z: direction.z },
          depth: single.toi,
          bodyA: handle,
          bodyB: 'unknown',
          timestamp: Date.now(),
        });
      }
    }
    return hits;
  }

  /** Enable/disable collision between a pair by adjusting masks */
  setCollisionFilter(handleA: string, handleB: string, enabled: boolean): void {
    const colliderA = this.colliders.get(handleA);
    const colliderB = this.colliders.get(handleB);
    if (!colliderA || !colliderB) return;

    const a = this.layerInfo.get(handleA) || { layer: 1, mask: 0xffff };
    const b = this.layerInfo.get(handleB) || { layer: 1, mask: 0xffff };

    if (enabled) {
      a.mask = a.mask | (1 << (b.layer - 1));
      b.mask = b.mask | (1 << (a.layer - 1));
    } else {
      a.mask = a.mask & ~(1 << (b.layer - 1));
      b.mask = b.mask & ~(1 << (a.layer - 1));
    }

    this.layerInfo.set(handleA, a);
    this.layerInfo.set(handleB, b);
    const groupsA = (a.layer << 16) | (a.mask & 0xffff);
    const groupsB = (b.layer << 16) | (b.mask & 0xffff);
    colliderA.setCollisionGroups(groupsA);
    colliderB.setCollisionGroups(groupsB);
  }

  /** Set collision layer/mask */
  setCollisionLayer(handle: string, layer: number, mask: number): void {
    const collider = this.colliders.get(handle);
    if (!collider) return;
    const info = { layer, mask };
    this.layerInfo.set(handle, info);
    const groups = (layer << 16) | (mask & 0xffff);
    collider.setCollisionGroups(groups);
  }

  /** Update internal collision caches */
  private updateCollisions(): void {
    if (!this.world) return;
    this.collisionContacts.clear();
    const newManifolds: CollisionManifold[] = [];

    const handles = Array.from(this.colliders.keys());
    for (let i = 0; i < handles.length; i++) {
      for (let j = i + 1; j < handles.length; j++) {
        const hA = handles[i];
        const hB = handles[j];
        const cA = this.colliders.get(hA)!;
        const cB = this.colliders.get(hB)!;
        if (!this.world.intersectionPair(cA, cB)) continue;

        const ta = cA.translation();
        const tb = cB.translation();
        const nx = tb.x - ta.x;
        const ny = tb.y - ta.y;
        const nz = tb.z - ta.z;
        const len = Math.hypot(nx, ny, nz) || 1;
        const normal = { x: nx / len, y: ny / len, z: nz / len };
        const point = { x: (ta.x + tb.x) / 2, y: (ta.y + tb.y) / 2, z: (ta.z + tb.z) / 2 };

        const contact: CollisionContact = {
          point,
          normal,
          depth: 0.001,
          bodyA: hA,
          bodyB: hB,
          timestamp: Date.now(),
        };

        if (!this.collisionContacts.has(hA)) this.collisionContacts.set(hA, []);
        if (!this.collisionContacts.has(hB)) this.collisionContacts.set(hB, []);
        this.collisionContacts.get(hA)!.push(contact);
        this.collisionContacts.get(hB)!.push(contact);

        newManifolds.push({
          bodyA: hA,
          bodyB: hB,
          contacts: [contact],
          totalPenetration: contact.depth,
          isNewCollision: !this.collisionManifolds.some(
            (m) => (m.bodyA === hA && m.bodyB === hB) || (m.bodyA === hB && m.bodyB === hA)
          ),
          isPersistent: this.collisionManifolds.some(
            (m) => (m.bodyA === hA && m.bodyB === hB) || (m.bodyA === hB && m.bodyB === hA)
          ),
        });
      }
    }

    this.collisionManifolds = newManifolds;
  }

  private findHandleForCollider(collider: any): string | null {
    for (const [handle, col] of this.colliders.entries()) {
      if (col === collider) return handle;
    }
    return null;
  }
}
