// Scene Entity - Unified object that syncs Babylon mesh <-> Rapier body
// Owner: Cole
// This is the core abstraction that links 3D rendering with physics

import * as BABYLON from '@babylonjs/core';
import { IPhysicsEngine } from '../physics/IPhysicsEngine';
import { EntityMetadata, Transform } from '../core/types';

export interface SceneEntityConfig {
  mesh: any;
  physics?: {
    enabled: boolean;
    type?: 'static' | 'dynamic' | 'kinematic';
    shape?: 'box' | 'sphere' | 'cylinder' | 'capsule' | 'convexHull' | 'trimesh' | 'compound';
    mass?: number;
    // Shape-specific parameters
    dimensions?: { x: number; y: number; z: number }; // For box
    radius?: number; // For sphere, cylinder, capsule
    height?: number; // For cylinder, capsule
  };
  metadata?: Partial<EntityMetadata>;
}

/**
 * SceneEntity represents a unified 3D object with synchronized mesh and physics
 */
export class SceneEntity {
  private mesh: any;
  private physicsHandle: string | null = null;
  private physicsEngine: IPhysicsEngine | null = null;
  private metadata: EntityMetadata;
  private physicsConfig: SceneEntityConfig['physics'] | null = null;
  private physicsEnabled: boolean = false;

  constructor(config: SceneEntityConfig) {
    this.mesh = config.mesh;

    // Store physics config for later use
    this.physicsConfig = config.physics || null;

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
    if (this.physicsEnabled) return; // Already enabled

    this.physicsEngine = physicsEngine;
    this.physicsEnabled = true;

    // Compute world matrix to get accurate bounds
    this.mesh.computeWorldMatrix(true);

    const position = this.mesh.position;
    const rotation = this.mesh.rotationQuaternion || BABYLON.Quaternion.Identity();

    // Build body descriptor
    const bodyDescriptor: any = {
      type: config.type || 'dynamic',
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      shape: config.shape || 'box',
      mass: config.mass || 1.0,
    };

    // Add shape-specific parameters
    if (config.dimensions) {
      bodyDescriptor.dimensions = config.dimensions;
    } else if (config.shape === 'box') {
      // Fall back to bounding box for box shapes
      const boundingInfo = this.mesh.getBoundingInfo();
      const dimensions = boundingInfo.boundingBox.extendSize.scale(2);
      bodyDescriptor.dimensions = { x: dimensions.x, y: dimensions.y, z: dimensions.z };
    }

    if (config.radius !== undefined) {
      bodyDescriptor.radius = config.radius;
    }

    if (config.height !== undefined) {
      bodyDescriptor.height = config.height;
    }

    // Create appropriate collider based on shape
    switch (bodyDescriptor.shape) {
      case 'trimesh':
        this.physicsHandle = (physicsEngine as any).createTriMeshCollider(this.mesh, bodyDescriptor);
        break;
      case 'convexHull':
        this.physicsHandle = (physicsEngine as any).createConvexHullCollider(this.mesh, bodyDescriptor);
        break;
      case 'compound':
        this.physicsHandle = (physicsEngine as any).createCompoundConvexCollider(this.mesh, bodyDescriptor, (config as any).maxConvexHulls || 32);
        break;
      default:
        this.physicsHandle = physicsEngine.createRigidBody(bodyDescriptor);
    }
  }

  /**
   * Disable physics for this entity
   */
  disablePhysics(): void {
    if (!this.physicsEnabled) return;

    if (this.physicsEngine && this.physicsHandle) {
      this.physicsEngine.removeRigidBody(this.physicsHandle);
      this.physicsHandle = null;
    }

    this.physicsEnabled = false;
  }

  /**
   * Toggle physics on/off
   */
  togglePhysics(): boolean {
    if (this.physicsEnabled) {
      this.disablePhysics();
    } else if (this.physicsConfig && this.physicsEngine) {
      // Re-enable with stored config
      const configWithEnabled = { ...this.physicsConfig, enabled: true };
      this.enablePhysics(this.physicsEngine, configWithEnabled);
    }
    return this.physicsEnabled;
  }

  /**
   * Check if physics is enabled
   */
  isPhysicsEnabled(): boolean {
    return this.physicsEnabled;
  }

  /**
   * Set physics engine (required before enabling physics)
   */
  setPhysicsEngine(engine: IPhysicsEngine): void {
    this.physicsEngine = engine;
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

  getMesh(): any {
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
