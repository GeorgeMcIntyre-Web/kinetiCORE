/**
 * Physics Manager
 * Owner: George
 * 
 * Manages physics engine selection and hot-swapping
 * Provides runtime engine switching with state preservation
 */

import { IPhysicsEngine } from './IPhysicsEngine';
import { HavokPhysicsEngine } from './HavokPhysicsEngine';
import { RapierPhysicsEngine } from './RapierPhysicsEngine';
import { Vector3, Quaternion, BodyDescriptor, RaycastHit } from '../core/types';

/**
 * Supported physics engines
 */
export type PhysicsEngineType = 'havok' | 'rapier';

/**
 * Physics engine configuration
 */
export interface PhysicsEngineConfig {
  type: PhysicsEngineType;
  gravity: Vector3;
  enableWasm?: boolean;
  solverIterations?: number;
  enableSleeping?: boolean;
  enableCCD?: boolean; // Continuous Collision Detection
}

/**
 * Physics state snapshot for engine switching
 */
export interface PhysicsStateSnapshot {
  bodies: Array<{
    handle: string;
    descriptor: BodyDescriptor;
    transform: { position: Vector3; rotation: Quaternion };
  }>;
  joints: Array<{
    handle: string;
    type: 'revolute' | 'prismatic' | 'fixed';
    bodyA: string;
    bodyB: string;
    anchor: Vector3;
    axis?: Vector3;
    limits?: { lower: number; upper: number };
    motor?: { velocity: number; force: number };
  }>;
  gravity: Vector3;
}

/**
 * Performance metrics
 */
export interface PhysicsMetrics {
  stepTime: number;
  bodyCount: number;
  jointCount: number;
  collisionCount: number;
  memoryUsage: number;
}

/**
 * Physics Manager for engine abstraction and management
 */
export class PhysicsManager {
  private static instance: PhysicsManager | null = null;
  private currentEngine: IPhysicsEngine | null = null;
  private engineType: PhysicsEngineType = 'rapier';
  private config: PhysicsEngineConfig;
  private metrics: PhysicsMetrics = {
    stepTime: 0,
    bodyCount: 0,
    jointCount: 0,
    collisionCount: 0,
    memoryUsage: 0
  };
  private performanceHistory: PhysicsMetrics[] = [];
  private maxHistorySize = 100;

  private constructor() {
    this.config = {
      type: 'rapier',
      gravity: { x: 0, y: -9.81, z: 0 },
      enableWasm: true,
      solverIterations: 8,
      enableSleeping: true,
      enableCCD: false
    };
  }

  public static getInstance(): PhysicsManager {
    if (!PhysicsManager.instance) {
      PhysicsManager.instance = new PhysicsManager();
    }
    return PhysicsManager.instance;
  }

  /**
   * Initialize the physics manager with specified engine
   */
  async initialize(config: Partial<PhysicsEngineConfig> = {}): Promise<void> {
    this.config = { ...this.config, ...config };
    this.engineType = this.config.type;

    console.log(`[PhysicsManager] Initializing ${this.engineType} physics engine...`);

    // Create engine instance
    switch (this.engineType) {
      case 'havok':
        // For Havok, we need a Babylon scene - this would need to be injected
        throw new Error('Havok engine requires Babylon scene - use initializeWithScene()');
        
      case 'rapier':
        this.currentEngine = new RapierPhysicsEngine();
        break;
        
      default:
        throw new Error(`Unsupported physics engine: ${this.engineType}`);
    }

    // Initialize the engine
    await this.currentEngine.initialize(this.config.gravity);
    
    console.log(`[PhysicsManager] ${this.engineType} physics engine initialized`);
  }

  /**
   * Initialize with Babylon scene (for Havok)
   */
  async initializeWithScene(scene: any, config: Partial<PhysicsEngineConfig> = {}): Promise<void> {
    this.config = { ...this.config, ...config };
    this.engineType = this.config.type;

    console.log(`[PhysicsManager] Initializing ${this.engineType} physics engine with scene...`);

    // Create engine instance
    switch (this.engineType) {
      case 'havok':
        this.currentEngine = new HavokPhysicsEngine(scene);
        break;
        
      case 'rapier':
        this.currentEngine = new RapierPhysicsEngine();
        break;
        
      default:
        throw new Error(`Unsupported physics engine: ${this.engineType}`);
    }

    // Initialize the engine
    await this.currentEngine.initialize(this.config.gravity);
    
    console.log(`[PhysicsManager] ${this.engineType} physics engine initialized with scene`);
  }

  /**
   * Switch physics engine at runtime
   */
  async switchEngine(newEngineType: PhysicsEngineType, scene?: any): Promise<void> {
    if (this.engineType === newEngineType) {
      console.log(`[PhysicsManager] Already using ${newEngineType} engine`);
      return;
    }

    console.log(`[PhysicsManager] Switching from ${this.engineType} to ${newEngineType}...`);

    // Create state snapshot
    const snapshot = await this.createStateSnapshot();

    // Dispose current engine
    if (this.currentEngine) {
      this.currentEngine.dispose();
    }

    // Create new engine
    let newEngine: IPhysicsEngine;
    switch (newEngineType) {
      case 'havok':
        if (!scene) {
          throw new Error('Havok engine requires Babylon scene');
        }
        newEngine = new HavokPhysicsEngine(scene);
        break;
        
      case 'rapier':
        newEngine = new RapierPhysicsEngine();
        break;
        
      default:
        throw new Error(`Unsupported physics engine: ${newEngineType}`);
    }

    // Initialize new engine
    await newEngine.initialize(this.config.gravity);

    // Restore state
    await this.restoreStateSnapshot(snapshot, newEngine);

    // Update references
    this.currentEngine = newEngine;
    this.engineType = newEngineType;

    console.log(`[PhysicsManager] Successfully switched to ${newEngineType} engine`);
  }

  /**
   * Step physics simulation
   */
  step(deltaTime: number): void {
    if (!this.currentEngine) {
      console.warn('[PhysicsManager] No physics engine initialized');
      return;
    }

    const startTime = performance.now();
    
    this.currentEngine.step(deltaTime);
    
    const endTime = performance.now();
    this.metrics.stepTime = endTime - startTime;
    
    // Update metrics
    this.updateMetrics();
  }

  /**
   * Get current physics engine
   */
  getCurrentEngine(): IPhysicsEngine | null {
    return this.currentEngine;
  }

  /**
   * Get current engine type
   */
  getCurrentEngineType(): PhysicsEngineType {
    return this.engineType;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PhysicsMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): PhysicsMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PhysicsEngineConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Apply gravity change immediately
    if (config.gravity && this.currentEngine) {
      // Note: Most engines don't support runtime gravity changes
      // This would require engine reinitialization
      console.warn('[PhysicsManager] Gravity changes require engine restart');
    }
  }

  /**
   * Get configuration
   */
  getConfig(): PhysicsEngineConfig {
    return { ...this.config };
  }

  /**
   * Dispose physics manager
   */
  dispose(): void {
    if (this.currentEngine) {
      this.currentEngine.dispose();
      this.currentEngine = null;
    }
    
    this.performanceHistory = [];
    console.log('[PhysicsManager] Disposed');
  }

  /**
   * Create state snapshot for engine switching
   */
  private async createStateSnapshot(): Promise<PhysicsStateSnapshot> {
    if (!this.currentEngine) {
      return { bodies: [], joints: [], gravity: this.config.gravity };
    }

    const snapshot: PhysicsStateSnapshot = {
      bodies: [],
      joints: [],
      gravity: this.config.gravity
    };

    // Note: This is a simplified implementation
    // Full implementation would require tracking all bodies and joints
    // and extracting their current state from the physics engine

    return snapshot;
  }

  /**
   * Restore state snapshot after engine switch
   */
  private async restoreStateSnapshot(snapshot: PhysicsStateSnapshot, engine: IPhysicsEngine): Promise<void> {
    // Restore bodies
    for (const bodyData of snapshot.bodies) {
      try {
        engine.createRigidBody(bodyData.descriptor);
        engine.updateRigidBodyTransform(
          bodyData.descriptor.meshName, // Using mesh name as handle
          bodyData.transform.position,
          bodyData.transform.rotation
        );
      } catch (error) {
        console.warn('[PhysicsManager] Failed to restore body:', error);
      }
    }

    // Restore joints
    for (const jointData of snapshot.joints) {
      try {
        let jointHandle: string | null = null;
        
        switch (jointData.type) {
          case 'revolute':
            jointHandle = engine.createRevoluteJoint(
              jointData.bodyA,
              jointData.bodyB,
              jointData.anchor,
              jointData.axis || { x: 0, y: 0, z: 1 }
            );
            break;
            
          case 'prismatic':
            jointHandle = engine.createPrismaticJoint(
              jointData.bodyA,
              jointData.bodyB,
              jointData.anchor,
              jointData.axis || { x: 0, y: 0, z: 1 }
            );
            break;
            
          case 'fixed':
            jointHandle = engine.createFixedJoint(
              jointData.bodyA,
              jointData.bodyB,
              jointData.anchor
            );
            break;
        }

        // Restore joint properties
        if (jointHandle && jointData.limits) {
          engine.setJointLimits(jointHandle, jointData.limits.lower, jointData.limits.upper);
        }
        
        if (jointHandle && jointData.motor) {
          engine.setJointMotor(jointHandle, jointData.motor.velocity, jointData.motor.force);
        }
      } catch (error) {
        console.warn('[PhysicsManager] Failed to restore joint:', error);
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    // Update body and joint counts
    this.metrics.bodyCount = this.getBodyCount();
    this.metrics.jointCount = this.getJointCount();
    
    // Update memory usage
    this.metrics.memoryUsage = this.getMemoryUsage();
    
    // Add to history
    this.performanceHistory.push({ ...this.metrics });
    
    // Trim history
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Get body count (simplified)
   */
  private getBodyCount(): number {
    // This would need to be implemented based on the current engine
    // For now, return a placeholder
    return 0;
  }

  /**
   * Get joint count (simplified)
   */
  private getJointCount(): number {
    // This would need to be implemented based on the current engine
    // For now, return a placeholder
    return 0;
  }

  /**
   * Get memory usage (simplified)
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory?.usedJSHeapSize || 0;
    }
    return 0;
  }
}
