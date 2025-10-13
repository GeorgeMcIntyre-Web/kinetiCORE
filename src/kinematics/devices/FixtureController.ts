/**
 * Fixture Controller
 * Owner: George
 * 
 * Controls fixture devices with clamping mechanisms and work piece detection
 */

import { ActuatorSystem } from '../actuation/ActuatorSystem';
import { KinematicsManager } from '../KinematicsManager';
import type { HardwareActuator } from '../device/UnifiedDeviceDefinition';

export type FixtureType = 'clamping' | 'welding' | 'assembly' | 'inspection' | 'custom';
export type FixtureState = 'open' | 'clamping' | 'clamped' | 'releasing' | 'error';

export interface FixtureConfig {
  id: string;
  name: string;
  type: FixtureType;
  clampJoints: string[];
  actuatorId: string;
  maxClampForce: number; // Maximum clamping force in N
  clampStroke: number; // Clamping stroke in mm
  workPieceDetected: boolean; // Whether work piece is detected
  safetyEnabled: boolean; // Safety interlocks enabled
}

export interface FixtureInfo {
  state: FixtureState;
  clampForce: number; // Current clamping force in N
  clampPosition: number; // Clamp position (0-100%)
  workPieceDetected: boolean;
  safetyStatus: 'safe' | 'warning' | 'fault';
  isMoving: boolean;
}

export class FixtureController {
  private actuatorSystem: ActuatorSystem;
  // private kinematicsManager: KinematicsManager;
  private config: FixtureConfig;
  private currentState: FixtureState = 'open';
  private targetPosition: number = 0; // 0 = open, 1 = clamped
  private _isMoving: boolean = false;
  private workPieceDetected: boolean = false;
  private safetyStatus: 'safe' | 'warning' | 'fault' = 'safe';

  constructor(config: FixtureConfig) {
    this.config = config;
    this.actuatorSystem = new ActuatorSystem();
    this.kinematicsManager = KinematicsManager.getInstance();
    
    console.log(`[FixtureController] Initialized: ${config.name} (${config.type})`);
  }

  /**
   * Clamp the fixture
   */
  async clamp(force: number = 100.0): Promise<void> {
    if (!this.safetyCheck()) {
      console.warn(`[FixtureController] Safety check failed for ${this.config.name}`);
      return;
    }

    console.log(`[FixtureController] Clamping ${this.config.name} with ${force}N`);
    
    this.isMoving = true;
    this.currentState = 'clamping';
    
    const success = this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'set_value',
      value: 1 // Fully clamped
    });

    if (success) {
      this.targetPosition = 1;
      
      // Simulate clamping sequence
      setTimeout(() => {
        this.currentState = 'clamped';
        this.isMoving = false;
        console.log(`[FixtureController] ${this.config.name} clamped with ${force}N`);
      }, this.calculateClampTime(force));
    } else {
      this.currentState = 'error';
      this.isMoving = false;
    }
  }

  /**
   * Release the fixture
   */
  async release(): Promise<void> {
    console.log(`[FixtureController] Releasing ${this.config.name}`);
    
    this.isMoving = true;
    this.currentState = 'releasing';
    
    const success = this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'set_value',
      value: 0 // Fully open
    });

    if (success) {
      this.targetPosition = 0;
      
      setTimeout(() => {
        this.currentState = 'open';
        this.isMoving = false;
        console.log(`[FixtureController] ${this.config.name} released`);
      }, 500); // Quick release
    } else {
      this.currentState = 'error';
      this.isMoving = false;
    }
  }

  /**
   * Set fixture position (0-100%)
   */
  async setPosition(percent: number): Promise<void> {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const position = clampedPercent / 100;
    
    console.log(`[FixtureController] Setting ${this.config.name} to ${clampedPercent}%`);
    
    this.isMoving = true;
    this.currentState = 'clamping';
    
    const success = this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'set_value',
      value: position
    });

    if (success) {
      this.targetPosition = position;
      
      setTimeout(() => {
        if (position === 0) {
          this.currentState = 'open';
        } else if (position === 1) {
          this.currentState = 'clamped';
        } else {
          this.currentState = 'clamping';
        }
        this.isMoving = false;
        console.log(`[FixtureController] ${this.config.name} moved to ${clampedPercent}%`);
      }, this.calculateClampTime(position * this.config.maxClampForce));
    } else {
      this.currentState = 'error';
      this.isMoving = false;
    }
  }

  /**
   * Emergency release - immediate opening
   */
  async emergencyRelease(): Promise<void> {
    console.log(`[FixtureController] Emergency release for ${this.config.name}`);
    
    const success = this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'set_value',
      value: 0
    });

    if (success) {
      this.currentState = 'open';
      this.targetPosition = 0;
      this.isMoving = false;
      this.safetyStatus = 'safe';
    } else {
      this.currentState = 'error';
      this.safetyStatus = 'fault';
    }
  }

  /**
   * Detect work piece presence
   */
  detectWorkPiece(): boolean {
    // Simulate work piece detection based on fixture type
    switch (this.config.type) {
      case 'clamping':
        // Clamping fixture: detect based on clamp force
        const clampForce = this.getClampForce();
        this.workPieceDetected = clampForce > 10; // 10N threshold
        break;
        
      case 'welding':
        // Welding fixture: always detect (assume work piece is loaded)
        this.workPieceDetected = this.currentState === 'clamped';
        break;
        
      case 'assembly':
        // Assembly fixture: detect based on position sensors (simulated)
        this.workPieceDetected = this.currentState === 'clamped' && 
                                this.targetPosition > 0.5;
        break;
        
      default:
        this.workPieceDetected = this.currentState === 'clamped';
    }
    
    return this.workPieceDetected;
  }

  /**
   * Get comprehensive fixture information
   */
  getFixtureInfo(): FixtureInfo {
    const actuator = this.actuatorSystem.getActuator(this.config.actuatorId);
    const actuatorValue = actuator?.state.value || 0;
    
    const clampForce = this.getClampForce();
    const clampPosition = actuatorValue * 100;
    
    return {
      state: this.currentState,
      clampForce,
      clampPosition,
      workPieceDetected: this.workPieceDetected,
      safetyStatus: this.safetyStatus,
      isMoving: this.isMoving
    };
  }

  /**
   * Get current clamping force
   */
  private getClampForce(): number {
    if (this.currentState !== 'clamped' && this.currentState !== 'clamping') {
      return 0;
    }
    
    const actuator = this.actuatorSystem.getActuator(this.config.actuatorId);
    const actuatorValue = actuator?.state.value || 0;
    
    // Simulate force based on actuator value and work piece resistance
    const baseForce = actuatorValue * this.config.maxClampForce;
    
    // Add some variation based on work piece detection
    const variation = this.workPieceDetected ? 0.8 : 0.2; // Less force if no work piece
    
    return baseForce * variation;
  }

  /**
   * Perform safety check before clamping
   */
  private safetyCheck(): boolean {
    if (!this.config.safetyEnabled) {
      return true;
    }
    
    // Check for safety conditions
    const conditions = [
      this.currentState !== 'error',
      this.safetyStatus !== 'fault',
      // Add more safety conditions as needed
    ];
    
    const allSafe = conditions.every(condition => condition);
    
    if (!allSafe) {
      this.safetyStatus = 'warning';
      console.warn(`[FixtureController] Safety check failed for ${this.config.name}`);
    } else {
      this.safetyStatus = 'safe';
    }
    
    return allSafe;
  }

  /**
   * Calculate clamping time based on force
   */
  private calculateClampTime(force: number): number {
    const baseTime = 1000; // 1 second base time
    const forceFactor = Math.max(0.5, Math.min(2.0, force / this.config.maxClampForce));
    return baseTime * forceFactor;
  }

  /**
   * Check if fixture is currently moving
   */
  isMoving(): boolean {
    return this._isMoving;
  }

  /**
   * Get fixture configuration
   */
  getConfig(): FixtureConfig {
    return { ...this.config };
  }

  /**
   * Update fixture configuration
   */
  updateConfig(updates: Partial<FixtureConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log(`[FixtureController] Updated config for ${this.config.name}`);
  }

  /**
   * Create a fixture controller from MJCF actuator
   */
  static fromMJCFActuator(
    actuator: HardwareActuator,
    clampJoints: string[],
    config: Partial<FixtureConfig> = {}
  ): FixtureController {
    const fixtureConfig: FixtureConfig = {
      id: actuator.id,
      name: actuator.name,
      type: 'clamping', // Default to clamping fixture
      clampJoints,
      actuatorId: actuator.id,
      maxClampForce: 1000, // Default 1000N
      clampStroke: 50,      // Default 50mm
      workPieceDetected: false,
      safetyEnabled: true,
      ...config
    };

    return new FixtureController(fixtureConfig);
  }

  /**
   * Dispose the controller
   */
  dispose(): void {
    this.emergencyRelease();
    console.log(`[FixtureController] Disposed: ${this.config.name}`);
  }
}
