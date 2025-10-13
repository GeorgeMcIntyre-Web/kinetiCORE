/**
 * Gripper Controller
 * Owner: George
 * 
 * Controls gripper devices with finger synchronization and grasp detection
 */

import { ActuatorSystem } from '../actuation/ActuatorSystem';
import { KinematicsManager } from '../KinematicsManager';
import type { HardwareActuator } from '../device/UnifiedDeviceDefinition';

export type GripperState = 'open' | 'closing' | 'grasping' | 'closed' | 'error';

export interface GripperConfig {
  id: string;
  name: string;
  fingerJoints: string[];
  actuatorId: string;
  maxOpening: number; // Maximum opening distance in mm
  minOpening: number; // Minimum opening distance in mm
  graspForce: number; // Maximum grasp force in N
  speed: number; // Opening/closing speed (0-1)
}

export interface GraspInfo {
  state: GripperState;
  openingPercent: number; // 0-100%
  graspForce: number; // Current force in N
  fingerPositions: number[]; // Individual finger positions
  isGrasping: boolean;
}

export class GripperController {
  private actuatorSystem: ActuatorSystem;
  private kinematicsManager: KinematicsManager;
  private config: GripperConfig;
  private currentState: GripperState = 'open';
  private targetPosition: number = 0; // 0 = open, 1 = closed
  private _isMoving: boolean = false;

  constructor(config: GripperConfig) {
    this.config = config;
    this.actuatorSystem = new ActuatorSystem();
    this.kinematicsManager = KinematicsManager.getInstance();
    
    console.log(`[GripperController] Initialized: ${config.name}`);
  }

  /**
   * Open the gripper
   */
  async open(speed: number = 1.0): Promise<void> {
    console.log(`[GripperController] Opening ${this.config.name} at speed ${speed}`);
    
    this.isMoving = true;
    this.currentState = 'closing'; // Closing = opening in this context
    
    // Set actuator to open position
    const success = this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'set_value',
      value: 0 // 0 = fully open
    });

    if (success) {
      this.targetPosition = 0;
      // Simulate movement time based on speed
      setTimeout(() => {
        this.currentState = 'open';
        this.isMoving = false;
        console.log(`[GripperController] ${this.config.name} opened`);
      }, this.calculateMovementTime(0, speed));
    } else {
      this.currentState = 'error';
      this.isMoving = false;
    }
  }

  /**
   * Close the gripper
   */
  async close(force: number = 10.0): Promise<void> {
    console.log(`[GripperController] Closing ${this.config.name} with force ${force}N`);
    
    this.isMoving = true;
    this.currentState = 'closing';
    
    // Set actuator to closed position
    const success = this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'set_value',
      value: 1 // 1 = fully closed
    });

    if (success) {
      this.targetPosition = 1;
      
      // Simulate grasp detection
      setTimeout(() => {
        this.currentState = 'grasping';
        console.log(`[GripperController] ${this.config.name} grasping with ${force}N`);
        
        // After grasp, transition to closed
        setTimeout(() => {
          this.currentState = 'closed';
          this.isMoving = false;
          console.log(`[GripperController] ${this.config.name} closed`);
        }, 500);
      }, this.calculateMovementTime(1, this.config.speed));
    } else {
      this.currentState = 'error';
      this.isMoving = false;
    }
  }

  /**
   * Set gripper position (0-100%)
   */
  async setPosition(percent: number): Promise<void> {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const position = clampedPercent / 100; // Convert to 0-1 range
    
    console.log(`[GripperController] Setting ${this.config.name} to ${clampedPercent}%`);
    
    this.isMoving = true;
    this.currentState = 'closing';
    
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
          this.currentState = 'closed';
        } else {
          this.currentState = 'grasping';
        }
        this.isMoving = false;
        console.log(`[GripperController] ${this.config.name} moved to ${clampedPercent}%`);
      }, this.calculateMovementTime(position, this.config.speed));
    } else {
      this.currentState = 'error';
      this.isMoving = false;
    }
  }

  /**
   * Emergency stop - immediately stop movement
   */
  emergencyStop(): void {
    console.log(`[GripperController] Emergency stop for ${this.config.name}`);
    
    this.isMoving = false;
    this.currentState = 'error';
    
    // Disable actuator
    this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'disable'
    });
  }

  /**
   * Reset gripper to home position
   */
  async home(): Promise<void> {
    console.log(`[GripperController] Homing ${this.config.name}`);
    
    const success = this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'home'
    });

    if (success) {
      this.currentState = 'open';
      this.targetPosition = 0;
      this.isMoving = false;
    }
  }

  /**
   * Get current gripper state and information
   */
  getGraspState(): GraspInfo {
    const actuator = this.actuatorSystem.getActuator(this.config.actuatorId);
    const currentValue = actuator?.state.value || 0;
    
    // Calculate finger positions
    const fingerPositions: number[] = [];
    for (const jointId of this.config.fingerJoints) {
      const joint = this.kinematicsManager.getJoint(jointId);
      fingerPositions.push(joint?.position || 0);
    }

    // Calculate opening percentage
    const openingPercent = (1 - currentValue) * 100;
    
    // Calculate grasp force (simulated)
    const graspForce = this.currentState === 'grasping' || this.currentState === 'closed' 
      ? this.config.graspForce * currentValue 
      : 0;

    return {
      state: this.currentState,
      openingPercent,
      graspForce,
      fingerPositions,
      isGrasping: this.currentState === 'grasping' || this.currentState === 'closed'
    };
  }

  /**
   * Check if gripper is currently moving
   */
  isMoving(): boolean {
    return this._isMoving;
  }

  /**
   * Get gripper configuration
   */
  getConfig(): GripperConfig {
    return { ...this.config };
  }

  /**
   * Update gripper configuration
   */
  updateConfig(updates: Partial<GripperConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log(`[GripperController] Updated config for ${this.config.name}`);
  }

  /**
   * Calculate movement time based on distance and speed
   */
  private calculateMovementTime(targetPosition: number, speed: number): number {
    const distance = Math.abs(targetPosition - this.targetPosition);
    const baseTime = 1000; // 1 second base time
    const speedFactor = Math.max(0.1, Math.min(1.0, speed));
    return (baseTime * distance) / speedFactor;
  }

  /**
   * Create a gripper controller from MJCF actuator
   */
  static fromMJCFActuator(
    actuator: HardwareActuator,
    fingerJoints: string[],
    config: Partial<GripperConfig> = {}
  ): GripperController {
    const gripperConfig: GripperConfig = {
      id: actuator.id,
      name: actuator.name,
      fingerJoints,
      actuatorId: actuator.id,
      maxOpening: 100, // Default 100mm
      minOpening: 0,    // Default 0mm
      graspForce: 50,   // Default 50N
      speed: 1.0,       // Default full speed
      ...config
    };

    return new GripperController(gripperConfig);
  }

  /**
   * Dispose the controller
   */
  dispose(): void {
    this.emergencyStop();
    console.log(`[GripperController] Disposed: ${this.config.name}`);
  }
}
