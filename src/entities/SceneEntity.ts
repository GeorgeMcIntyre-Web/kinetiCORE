// Scene Entity - Unified object that syncs Babylon mesh <-> Rapier body
// Owner: Cole
// This is the core abstraction that links 3D rendering with physics

import * as BABYLON from '@babylonjs/core';
import { IPhysicsEngine } from '../physics/IPhysicsEngine';
import { EntityMetadata, Transform } from '../core/types';

export interface SceneEntityConfig {
  mesh: BABYLON.Mesh;
  physics?: {
    enabled: boolean;
    type?: 'static' | 'dynamic' | 'kinematic';
    shape?: 'box' | 'sphere' | 'cylinder' | 'capsule';
    mass?: number;
  };
  metadata?: Partial<EntityMetadata>;
}

/**
 * SceneEntity represents a unified 3D object with synchronized mesh and physics
 */
export class SceneEntity {
  private mesh: BABYLON.Mesh;
  private physicsHandle: string | null = null;
  private physicsEngine: IPhysicsEngine | null = null;
  private metadata: EntityMetadata;

  constructor(config: SceneEntityConfig) {
    this.mesh = config.mesh;

    // Initialize metadata
    this.metadata = {
      id: crypto.randomUUID(),
      name: config.metadata?.name || this.mesh.name,
      type: config.metadata?.type || 'object',
      tags: config.metadata?.tags || [],
      customProperties: config.metadata?.customProperties || {},
    };

    // Store metadata on mesh for easy access
    this.mesh.metadata = { entityId: this.metadata.id };
  }

  /**
   * Enable physics for this entity
   */
  enablePhysics(physicsEngine: IPhysicsEngine, config: SceneEntityConfig['physics']): void {
    if (!config?.enabled) return;

    this.physicsEngine = physicsEngine;

    // Compute world matrix to get accurate bounds
    this.mesh.computeWorldMatrix(true);

    // Get mesh dimensions from bounding box
    const boundingInfo = this.mesh.getBoundingInfo();
    const dimensions = boundingInfo.boundingBox.extendSize.scale(2);

    const position = this.mesh.position;
    const rotation = this.mesh.rotationQuaternion || BABYLON.Quaternion.Identity();

    // Create physics body
    this.physicsHandle = physicsEngine.createRigidBody({
      type: config.type || 'dynamic',
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      shape: config.shape || 'box',
      dimensions: { x: dimensions.x, y: dimensions.y, z: dimensions.z },
      mass: config.mass || 1.0,
    });
  }

  /**
   * Update mesh transform from physics (called in render loop)
   */
  syncFromPhysics(): void {
    if (!this.physicsEngine || !this.physicsHandle) return;

    const transform = this.physicsEngine.getRigidBodyTransform(this.physicsHandle);
    if (!transform) return;

    // Update mesh position
    this.mesh.position.set(transform.position.x, transform.position.y, transform.position.z);

    // Update mesh rotation
    if (!this.mesh.rotationQuaternion) {
      this.mesh.rotationQuaternion = new BABYLON.Quaternion();
    }
    this.mesh.rotationQuaternion.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
      transform.rotation.w
    );
  }

  /**
   * Update physics from mesh transform (called when user moves object)
   */
  syncToPhysics(): void {
    if (!this.physicsEngine || !this.physicsHandle) return;

    const position = this.mesh.position;
    const rotation = this.mesh.rotationQuaternion || BABYLON.Quaternion.Identity();

    this.physicsEngine.updateRigidBodyTransform(
      this.physicsHandle,
      { x: position.x, y: position.y, z: position.z },
      { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }
    );
  }

  /**
   * Get current transform
   */
  getTransform(): Transform {
    const position = this.mesh.position;
    const rotation = this.mesh.rotationQuaternion || BABYLON.Quaternion.Identity();
    const scale = this.mesh.scaling;

    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      scale: { x: scale.x, y: scale.y, z: scale.z },
    };
  }

  /**
   * Set transform (updates both mesh and physics)
   */
  setTransform(transform: Partial<Transform>): void {
    if (transform.position) {
      this.mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
    }

    if (transform.rotation) {
      if (!this.mesh.rotationQuaternion) {
        this.mesh.rotationQuaternion = new BABYLON.Quaternion();
      }
      this.mesh.rotationQuaternion.set(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z,
        transform.rotation.w
      );
    }

    if (transform.scale) {
      this.mesh.scaling.set(transform.scale.x, transform.scale.y, transform.scale.z);
    }

    // Sync to physics
    this.syncToPhysics();
  }

  getMesh(): BABYLON.Mesh {
    return this.mesh;
  }

  getMetadata(): EntityMetadata {
    return this.metadata;
  }

  getId(): string {
    return this.metadata.id;
  }

  /**
   * Dispose entity and clean up resources
   */
  dispose(): void {
    // Dispose physics first
    if (this.physicsEngine && this.physicsHandle) {
      this.physicsEngine.removeRigidBody(this.physicsHandle);
      this.physicsHandle = null;
    }

    // Then dispose mesh
    this.mesh.dispose();
  }
}
