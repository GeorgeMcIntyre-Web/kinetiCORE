/**
 * Asset Instance Manager
 * Owner: George
 * 
 * Manages asset instances within projects, including transforms,
 * joint states, and attachments
 */

import type {
  AssetInstance,
  Attachment,
  AddAssetInstanceConfig,
  Vector3,
  Quaternion,
} from './types';

/**
 * Asset Instance Manager
 */
export class AssetInstanceManager {
  private static instance: AssetInstanceManager | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): AssetInstanceManager {
    if (!AssetInstanceManager.instance) {
      AssetInstanceManager.instance = new AssetInstanceManager();
    }
    return AssetInstanceManager.instance;
  }

  /**
   * Initialize the asset instance manager
   */
  public async initialize(): Promise<void> {
    console.log('[AssetInstanceManager] Initialized');
  }

  /**
   * Create new asset instance
   */
  public async createInstance(config: AddAssetInstanceConfig): Promise<AssetInstance> {
    const instance: AssetInstance = {
      id: this.generateId(),
      assetId: config.assetId,
      name: config.name,
      position: config.position || { x: 0, y: 0, z: 0 },
      rotation: config.rotation || { x: 0, y: 0, z: 0, w: 1 },
      scale: config.scale || { x: 1, y: 1, z: 1 },
      jointStates: config.jointStates || {},
      attachments: [],
      customProperties: config.customProperties || {},
      isVisible: true,
      isLocked: false,
      createdAt: new Date(),
      createdBy: 'current_user', // TODO: Get from auth system
    };

    console.log(`[AssetInstanceManager] Created instance: ${instance.name} (${instance.id})`);
    return instance;
  }

  /**
   * Update asset instance transform
   */
  public async updateTransform(
    instance: AssetInstance,
    position?: Vector3,
    rotation?: Quaternion,
    scale?: Vector3
  ): Promise<AssetInstance> {
    const updatedInstance = { ...instance };
    
    if (position) {
      updatedInstance.position = position;
    }
    if (rotation) {
      updatedInstance.rotation = rotation;
    }
    if (scale) {
      updatedInstance.scale = scale;
    }

    console.log(`[AssetInstanceManager] Updated transform for instance: ${instance.id}`);
    return updatedInstance;
  }

  /**
   * Update joint states for robot instances
   */
  public async updateJointStates(
    instance: AssetInstance,
    jointStates: Record<string, number>
  ): Promise<AssetInstance> {
    const updatedInstance = { ...instance };
    updatedInstance.jointStates = { ...instance.jointStates, ...jointStates };

    console.log(`[AssetInstanceManager] Updated joint states for instance: ${instance.id}`);
    return updatedInstance;
  }

  /**
   * Add attachment to instance
   */
  public async addAttachment(
    instance: AssetInstance,
    attachment: Omit<Attachment, 'id'>
  ): Promise<AssetInstance> {
    const newAttachment: Attachment = {
      ...attachment,
      id: this.generateId(),
    };

    const updatedInstance = { ...instance };
    updatedInstance.attachments = [...instance.attachments, newAttachment];

    console.log(`[AssetInstanceManager] Added attachment to instance: ${instance.id}`);
    return updatedInstance;
  }

  /**
   * Remove attachment from instance
   */
  public async removeAttachment(
    instance: AssetInstance,
    attachmentId: string
  ): Promise<AssetInstance> {
    const updatedInstance = { ...instance };
    updatedInstance.attachments = instance.attachments.filter(a => a.id !== attachmentId);

    console.log(`[AssetInstanceManager] Removed attachment from instance: ${instance.id}`);
    return updatedInstance;
  }

  /**
   * Clone asset instance
   */
  public async cloneInstance(
    instance: AssetInstance,
    newName: string,
    offset?: Vector3
  ): Promise<AssetInstance> {
    const clonedInstance: AssetInstance = {
      ...instance,
      id: this.generateId(),
      name: newName,
      position: offset ? {
        x: instance.position.x + offset.x,
        y: instance.position.y + offset.y,
        z: instance.position.z + offset.z,
      } : instance.position,
      attachments: [], // Don't clone attachments
      createdAt: new Date(),
    };

    console.log(`[AssetInstanceManager] Cloned instance: ${instance.name} -> ${newName}`);
    return clonedInstance;
  }

  /**
   * Get instance bounds (for collision detection, etc.)
   */
  public getInstanceBounds(instance: AssetInstance): {
    min: Vector3;
    max: Vector3;
    center: Vector3;
    size: Vector3;
  } {
    // TODO: Calculate actual bounds based on asset geometry
    // For now, return default bounds
    const center = instance.position;
    const size = instance.scale;
    
    return {
      min: {
        x: center.x - size.x / 2,
        y: center.y - size.y / 2,
        z: center.z - size.z / 2,
      },
      max: {
        x: center.x + size.x / 2,
        y: center.y + size.y / 2,
        z: center.z + size.z / 2,
      },
      center,
      size,
    };
  }

  /**
   * Check if instance intersects with another instance
   */
  public checkIntersection(instance1: AssetInstance, instance2: AssetInstance): boolean {
    const bounds1 = this.getInstanceBounds(instance1);
    const bounds2 = this.getInstanceBounds(instance2);

    return (
      bounds1.min.x <= bounds2.max.x && bounds1.max.x >= bounds2.min.x &&
      bounds1.min.y <= bounds2.max.y && bounds1.max.y >= bounds2.min.y &&
      bounds1.min.z <= bounds2.max.z && bounds1.max.z >= bounds2.min.z
    );
  }

  /**
   * Get all instances within a radius of a point
   */
  public getInstancesInRadius(
    instances: AssetInstance[],
    center: Vector3,
    radius: number
  ): AssetInstance[] {
    return instances.filter(instance => {
      const dx = instance.position.x - center.x;
      const dy = instance.position.y - center.y;
      const dz = instance.position.z - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return distance <= radius;
    });
  }

  /**
   * Validate instance data
   */
  public validateInstance(instance: AssetInstance): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!instance.id) {
      errors.push('Instance ID is required');
    }
    if (!instance.assetId) {
      errors.push('Asset ID is required');
    }
    if (!instance.name) {
      errors.push('Instance name is required');
    }

    // Check position
    if (typeof instance.position.x !== 'number' || 
        typeof instance.position.y !== 'number' || 
        typeof instance.position.z !== 'number') {
      errors.push('Position must have valid x, y, z coordinates');
    }

    // Check rotation (quaternion)
    if (typeof instance.rotation.x !== 'number' || 
        typeof instance.rotation.y !== 'number' || 
        typeof instance.rotation.z !== 'number' || 
        typeof instance.rotation.w !== 'number') {
      errors.push('Rotation must be a valid quaternion');
    }

    // Check scale
    if (typeof instance.scale.x !== 'number' || 
        typeof instance.scale.y !== 'number' || 
        typeof instance.scale.z !== 'number') {
      errors.push('Scale must have valid x, y, z values');
    }

    // Check for negative scale
    if (instance.scale.x <= 0 || instance.scale.y <= 0 || instance.scale.z <= 0) {
      errors.push('Scale values must be positive');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize instance for storage
   */
  public serializeInstance(instance: AssetInstance): string {
    return JSON.stringify(instance, null, 2);
  }

  /**
   * Deserialize instance from storage
   */
  public deserializeInstance(data: string): AssetInstance {
    return JSON.parse(data) as AssetInstance;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    console.log('[AssetInstanceManager] Cleaned up resources');
  }
}
