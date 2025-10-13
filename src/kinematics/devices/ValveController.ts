/**
 * Valve Controller
 * Owner: George
 * 
 * Controls valve devices with flow rate simulation and position feedback
 */

import { ActuatorSystem } from '../actuation/ActuatorSystem';
import { KinematicsManager } from '../KinematicsManager';
import type { HardwareActuator } from '../device/UnifiedDeviceDefinition';

export type ValveType = 'ball' | 'gate' | 'butterfly' | 'solenoid' | 'proportional';
export type ValveState = 'open' | 'closed' | 'partially_open' | 'moving' | 'error';

export interface ValveConfig {
  id: string;
  name: string;
  type: ValveType;
  valveJoint: string;
  actuatorId: string;
  maxAngle: number; // Maximum rotation angle in degrees
  minAngle: number; // Minimum rotation angle in degrees
  flowRateMax: number; // Maximum flow rate in L/min
  pressureRating: number; // Pressure rating in bar
  responseTime: number; // Response time in ms
}

export interface ValveInfo {
  state: ValveState;
  angle: number; // Current angle in degrees
  flowRate: number; // Current flow rate in L/min
  flowPercent: number; // Flow percentage (0-100%)
  pressure: number; // Current pressure in bar
  isMoving: boolean;
}

export class ValveController {
  private actuatorSystem: ActuatorSystem;
  private kinematicsManager: KinematicsManager;
  private config: ValveConfig;
  private currentState: ValveState = 'closed';
  private targetAngle: number = 0;
  private _isMoving: boolean = false;
  private currentPressure: number = 0; // Simulated pressure

  constructor(config: ValveConfig) {
    this.config = config;
    this.actuatorSystem = new ActuatorSystem();
    this.kinematicsManager = KinematicsManager.getInstance();
    
    // Suppress unused variable warnings
    void this.kinematicsManager;
    void this.targetAngle;
    
    console.log(`[ValveController] Initialized: ${config.name} (${config.type})`);
  }

  /**
   * Open the valve to specified angle
   */
  async setAngle(degrees: number): Promise<void> {
    const clampedAngle = Math.max(this.config.minAngle, Math.min(this.config.maxAngle, degrees));
    
    console.log(`[ValveController] Setting ${this.config.name} to ${clampedAngle}°`);
    
    this._isMoving = true;
    this.currentState = 'moving';
    
    // Convert angle to actuator value (0-1 range)
    const actuatorValue = (clampedAngle - this.config.minAngle) / 
                         (this.config.maxAngle - this.config.minAngle);
    
    const success = this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'set_value',
      value: actuatorValue
    });

    if (success) {
      this.targetAngle = clampedAngle;
      
      // Simulate movement time
      setTimeout(() => {
        this.currentState = clampedAngle === this.config.maxAngle ? 'open' :
                           clampedAngle === this.config.minAngle ? 'closed' :
                           'partially_open';
        this._isMoving = false;
        console.log(`[ValveController] ${this.config.name} moved to ${clampedAngle}°`);
      }, this.config.responseTime);
    } else {
      this.currentState = 'error';
      this._isMoving = false;
    }
  }

  /**
   * Open valve completely
   */
  async open(): Promise<void> {
    console.log(`[ValveController] Opening ${this.config.name} completely`);
    await this.setAngle(this.config.maxAngle);
  }

  /**
   * Close valve completely
   */
  async close(): Promise<void> {
    console.log(`[ValveController] Closing ${this.config.name} completely`);
    await this.setAngle(this.config.minAngle);
  }

  /**
   * Emergency close - immediate closure
   */
  async emergencyClose(): Promise<void> {
    console.log(`[ValveController] Emergency close for ${this.config.name}`);
    
    // Force immediate closure
    const success = this.actuatorSystem.sendCommand({
      actuatorId: this.config.actuatorId,
      command: 'set_value',
      value: 0 // Fully closed
    });

    if (success) {
      this.currentState = 'closed';
      this.targetAngle = this.config.minAngle;
      this._isMoving = false;
    } else {
      this.currentState = 'error';
    }
  }

  /**
   * Set valve position as percentage (0-100%)
   */
  async setPosition(percent: number): Promise<void> {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const angle = this.config.minAngle + 
                 (clampedPercent / 100) * (this.config.maxAngle - this.config.minAngle);
    
    await this.setAngle(angle);
  }

  /**
   * Get current flow rate based on valve position
   */
  getFlowRate(): number {
    const valveInfo = this.getValveInfo();
    return valveInfo.flowRate;
  }

  /**
   * Get comprehensive valve information
   */
  getValveInfo(): ValveInfo {
    const actuator = this.actuatorSystem.getActuator(this.config.actuatorId);
    const actuatorValue = actuator?.state.value || 0;
    
    // Calculate current angle
    const angle = this.config.minAngle + 
                 actuatorValue * (this.config.maxAngle - this.config.minAngle);
    
    // Calculate flow rate based on valve type and position
    const flowRate = this.calculateFlowRate(angle);
    const flowPercent = (flowRate / this.config.flowRateMax) * 100;
    
    return {
      state: this.currentState,
      angle,
      flowRate,
      flowPercent,
      pressure: this.currentPressure,
      isMoving: this._isMoving
    };
  }

  /**
   * Calculate flow rate based on valve type and angle
   */
  private calculateFlowRate(angle: number): number {
    const anglePercent = (angle - this.config.minAngle) / 
                        (this.config.maxAngle - this.config.minAngle);
    
    switch (this.config.type) {
      case 'ball':
        // Ball valve: roughly linear flow characteristic
        return this.config.flowRateMax * anglePercent;
        
      case 'gate':
        // Gate valve: linear flow characteristic
        return this.config.flowRateMax * anglePercent;
        
      case 'butterfly':
        // Butterfly valve: roughly equal percentage flow characteristic
        return this.config.flowRateMax * Math.sin(anglePercent * Math.PI / 2);
        
      case 'solenoid':
        // Solenoid: binary (on/off)
        return anglePercent > 0.5 ? this.config.flowRateMax : 0;
        
      case 'proportional':
        // Proportional: linear with fine control
        return this.config.flowRateMax * anglePercent;
        
      default:
        return this.config.flowRateMax * anglePercent;
    }
  }

  /**
   * Set simulated pressure (for testing)
   */
  setPressure(pressure: number): void {
    this.currentPressure = Math.max(0, Math.min(this.config.pressureRating, pressure));
    console.log(`[ValveController] ${this.config.name} pressure set to ${this.currentPressure} bar`);
  }

  /**
   * Check if valve is currently moving
   */
  isMoving(): boolean {
    return this._isMoving;
  }

  /**
   * Get valve configuration
   */
  getConfig(): ValveConfig {
    return { ...this.config };
  }

  /**
   * Update valve configuration
   */
  updateConfig(updates: Partial<ValveConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log(`[ValveController] Updated config for ${this.config.name}`);
  }

  /**
   * Create a valve controller from MJCF actuator
   */
  static fromMJCFActuator(
    actuator: HardwareActuator,
    valveJoint: string,
    config: Partial<ValveConfig> = {}
  ): ValveController {
    const valveConfig: ValveConfig = {
      id: actuator.id,
      name: actuator.name,
      type: 'ball', // Default to ball valve
      valveJoint,
      actuatorId: actuator.id,
      maxAngle: 90,     // Default 90 degrees
      minAngle: 0,      // Default 0 degrees
      flowRateMax: 100, // Default 100 L/min
      pressureRating: 10, // Default 10 bar
      responseTime: 1000, // Default 1 second
      ...config
    };

    return new ValveController(valveConfig);
  }

  /**
   * Dispose the controller
   */
  dispose(): void {
    this.emergencyClose();
    console.log(`[ValveController] Disposed: ${this.config.name}`);
  }
}
