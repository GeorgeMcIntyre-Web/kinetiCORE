// Entity Registry - Central manager for all scene entities
// Owner: Cole

import { SceneEntity, SceneEntityConfig } from './SceneEntity';
import { IPhysicsEngine } from '../physics/IPhysicsEngine';

/**
 * EntityRegistry manages all scene entities
 * Singleton pattern ensures only one registry exists
 */
export class EntityRegistry {
  private static instance: EntityRegistry | null = null;
  private entities = new Map<string, SceneEntity>();
  private physicsEngine: IPhysicsEngine | null = null;

  private constructor() {}

  static getInstance(): EntityRegistry {
    if (!EntityRegistry.instance) {
      EntityRegistry.instance = new EntityRegistry();
    }
    return EntityRegistry.instance;
  }

  /**
   * Set the physics engine (must be called during initialization)
   */
  setPhysicsEngine(engine: IPhysicsEngine): void {
    this.physicsEngine = engine;
  }

  /**
   * Create a new entity
   */
  create(config: SceneEntityConfig): SceneEntity {
    const entity = new SceneEntity(config);

    // Enable physics if configured
    if (config.physics?.enabled && this.physicsEngine) {
      entity.enablePhysics(this.physicsEngine, config.physics);
    }

    // Register entity
    this.entities.set(entity.getId(), entity);

    return entity;
  }

  /**
   * Get entity by ID
   */
  get(id: string): SceneEntity | undefined {
    return this.entities.get(id);
  }

  /**
   * Get entity by mesh name
   */
  getByName(name: string): SceneEntity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.getMetadata().name === name) {
        return entity;
      }
    }
    return undefined;
  }

  /**
   * Get all entities
   */
  getAll(): SceneEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get entities by tag
   */
  getByTag(tag: string): SceneEntity[] {
    return this.getAll().filter((entity) => entity.getMetadata().tags?.includes(tag));
  }

  /**
   * Remove and dispose entity
   */
  remove(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.dispose();
      this.entities.delete(id);
    }
  }

  /**
   * Remove all entities
   */
  clear(): void {
    for (const entity of this.entities.values()) {
      entity.dispose();
    }
    this.entities.clear();
  }

  /**
   * Sync all entities from physics (call in render loop)
   */
  syncAllFromPhysics(): void {
    for (const entity of this.entities.values()) {
      entity.syncFromPhysics();
    }
  }

  /**
   * Get entity count
   */
  count(): number {
    return this.entities.size;
  }
}
