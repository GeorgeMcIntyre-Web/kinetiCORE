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
    // Shape-specific parameters
    dimensions?: { x: number; y: number; z: number }; // For box
    radius?: number; // For sphere, cylinder, capsule
    height?: number; // For cylinder, capsule
  };
  metadata?: Partial<EntityMetadata>;
  // Device-specific config
  isDevice?: boolean;
  rootTransformNode?: BABYLON.TransformNode;
  joints?: any[]; // URDF joint data
}

/**
 * SceneEntity represents a unified 3D object with synchronized mesh and physics
 */
export class SceneEntity {
  private mesh: BABYLON.Mesh;
  private physicsHandle: string | null = null;
  private physicsEngine: IPhysicsEngine | null = null;
  private metadata: EntityMetadata;
  private physicsConfig: SceneEntityConfig['physics'] | null = null;
  private physicsEnabled: boolean = false;

  // Device-specific properties
  private isDevice: boolean = false;
  private rootTransformNode: BABYLON.TransformNode | null = null;
  private children: SceneEntity[] = [];
  private parent: SceneEntity | null = null;
  private joints: any[] = [];

  constructor(config: SceneEntityConfig) {
    this.mesh = config.mesh;

    // Store physics config for later use
    this.physicsConfig = config.physics || null;

    // Device-specific setup
    this.isDevice = config.isDevice || false;
    this.rootTransformNode = config.rootTransformNode || null;
    this.joints = config.joints || [];

    // Initialize metadata
    this.metadata = {
      id: crypto.randomUUID(),
      name: config.metadata?.name || this.mesh.name,
      type: config.metadata?.type || 'object',
      tags: config.metadata?.tags || [],
      customProperties: config.metadata?.customProperties || {},
      isDevice: this.isDevice,
      deviceType: config.metadata?.deviceType,
      urdfPath: config.metadata?.urdfPath,
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

    // Create physics body
    this.physicsHandle = physicsEngine.createRigidBody(bodyDescriptor);
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
   * Device hierarchy methods
   *
   * These methods enable unified device entity selection and manipulation:
   * - Device entities represent complete kinematic assemblies (robots, fixtures, etc.)
   * - Link entities are children of device entities
   * - Clicking any link selects the entire device
   * - Moving a device moves all its children together
   */

  /**
   * Check if this entity is a device (parent entity representing an assembly)
   */
  getIsDevice(): boolean {
    return this.isDevice;
  }

  /**
   * Get the root TransformNode for this device (used for gizmo attachment)
   */
  getRootTransformNode(): BABYLON.TransformNode | null {
    return this.rootTransformNode;
  }

  /**
   * Get all child entities (e.g., link entities for a device)
   */
  getChildren(): SceneEntity[] {
    return this.children;
  }

  /**
   * Get parent entity (e.g., device entity for a link)
   */
  getParent(): SceneEntity | null {
    return this.parent;
  }

  /**
   * Add a child entity (e.g., add link entity to device)
   */
  addChild(child: SceneEntity): void {
    if (!this.children.includes(child)) {
      this.children.push(child);
      child.parent = this;
      // Update child metadata to reference parent device
      if (this.isDevice) {
        child.getMetadata().parentDeviceId = this.metadata.id;
      }
    }
  }

  removeChild(child: SceneEntity): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
      // Clear parent device reference
      if (child.getMetadata().parentDeviceId === this.metadata.id) {
        delete child.getMetadata().parentDeviceId;
      }
    }
  }

  getJoints(): any[] {
    return this.joints;
  }

  /**
   * Get the root device entity (if this is part of a device)
   */
  getRootDevice(): SceneEntity | null {
    if (this.isDevice) return this;
    return this.parent?.getRootDevice() || null;
  }

  /**
   * Connection point support for routing system
   * Connection points are managed by ConnectionManager, we just store references here
   */

  /**
   * Get connection point IDs associated with this entity
   */
  getConnectionPointIds(): string[] {
    const connectionPoints = this.metadata.customProperties?.connectionPoints;
    if (Array.isArray(connectionPoints)) {
      return [...connectionPoints];
    }
    return [];
  }

  /**
   * Add a connection point ID to this entity
   */
  addConnectionPointId(connectionPointId: string): void {
    if (!this.metadata.customProperties) {
      this.metadata.customProperties = {};
    }
    if (!this.metadata.customProperties.connectionPoints) {
      this.metadata.customProperties.connectionPoints = [];
    }
    const connectionPoints = this.metadata.customProperties.connectionPoints as string[];
    if (!connectionPoints.includes(connectionPointId)) {
      connectionPoints.push(connectionPointId);
    }
  }

  /**
   * Remove a connection point ID from this entity
   */
  removeConnectionPointId(connectionPointId: string): boolean {
    const connectionPoints = this.metadata.customProperties?.connectionPoints;
    if (!Array.isArray(connectionPoints)) {
      return false;
    }
    const index = connectionPoints.indexOf(connectionPointId);
    if (index >= 0) {
      connectionPoints.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if this entity has any connection points
   */
  hasConnectionPoints(): boolean {
    const connectionPoints = this.metadata.customProperties?.connectionPoints;
    return Array.isArray(connectionPoints) && connectionPoints.length > 0;
  }

  /**
   * Dispose entity and clean up resources
   */
  dispose(): void {
    // Dispose physics FIRST to avoid Rapier's "recursive use" errors
    // This must happen before disposing children to prevent cascading physics issues
    if (this.physicsEngine && this.physicsHandle) {
      this.physicsEngine.removeRigidBody(this.physicsHandle);
      this.physicsHandle = null;
    }

    // Then dispose children
    for (const child of this.children) {
      child.dispose();
    }
    this.children = [];

    // Dispose root transform node if this is a device
    if (this.rootTransformNode) {
      this.rootTransformNode.dispose();
      this.rootTransformNode = null;
    }

    // Dispose mesh last
    this.mesh.dispose();
  }
}
