/**
 * MJCF Device Entity - Twin Object Architecture
 * Owner: George
 *
 * Represents an MJCF model as a unified "device entity" with:
 * - 3D visualization (meshes)
 * - Kinematics (joints/actuators)
 * - Keyframes (saved poses)
 * - Real-time state
 * - Physics simulation
 *
 * This is the "digital twin" of a physical device (robot, gripper, valve, etc.)
 */

import { TransformNode } from '@babylonjs/core';
import { KeyframeObject } from '../loaders/mjcf/MJCFKeyframeManager';

export interface MJCFDeviceMetadata {
  /** Unique device ID (usually the MJCF model name) */
  deviceId: string;

  /** Human-readable device name */
  deviceName: string;

  /** Device type/category */
  deviceType: 'robot' | 'gripper' | 'valve' | 'fixture' | 'actuator' | 'sensor' | 'custom';

  /** Original MJCF file name */
  mjcfFileName: string;

  /** Number of joints */
  jointCount: number;

  /** Number of actuators */
  actuatorCount: number;

  /** Number of sensors (if any) */
  sensorCount?: number;

  /** Manufacturer (if specified in MJCF) */
  manufacturer?: string;

  /** Model number (if specified in MJCF) */
  modelNumber?: string;

  /** Available keyframes */
  keyframes: KeyframeObject[];

  /** Current pose/keyframe name */
  currentKeyframe?: string;

  /** Model type detection */
  modelType: {
    isOBJBased: boolean;
    isSTLBased: boolean;
    isMixed: boolean;
  };
}

export interface MJCFDeviceState {
  /** Current joint positions (radians or meters) */
  jointPositions: Record<string, number>;

  /** Current joint velocities */
  jointVelocities: Record<string, number>;

  /** Current joint forces/torques */
  jointForces: Record<string, number>;

  /** Actuator states (enabled/disabled) */
  actuatorStates: Record<string, boolean>;

  /** Error/fault state */
  hasError: boolean;
  errorMessage?: string;

  /** Timestamp of last state update */
  lastUpdateTime: number;
}

/**
 * MJCF Device Entity - The "twin object" that represents an MJCF model
 */
export class MJCFDeviceEntity {
  private metadata: MJCFDeviceMetadata;
  private state: MJCFDeviceState;
  private rootNode: TransformNode;
  private eventListeners: Map<string, Array<(...args: any[]) => void>>;

  constructor(rootNode: TransformNode, metadata: MJCFDeviceMetadata) {
    this.rootNode = rootNode;
    this.metadata = metadata;
    this.eventListeners = new Map();

    // Initialize state
    this.state = {
      jointPositions: {},
      jointVelocities: {},
      jointForces: {},
      actuatorStates: {},
      hasError: false,
      lastUpdateTime: Date.now()
    };

    // Store metadata in root node for easy lookup
    this.rootNode.metadata = {
      ...this.rootNode.metadata,
      mjcfDevice: true,
      deviceId: metadata.deviceId,
      deviceType: metadata.deviceType,
      deviceEntity: this
    };

    console.log(`[MJCFDevice] Created device entity: ${metadata.deviceName} (${metadata.deviceType})`);
  }

  // ===========================
  // Getters
  // ===========================

  getDeviceId(): string {
    return this.metadata.deviceId;
  }

  getDeviceName(): string {
    return this.metadata.deviceName;
  }

  getDeviceType(): MJCFDeviceMetadata['deviceType'] {
    return this.metadata.deviceType;
  }

  getMetadata(): MJCFDeviceMetadata {
    return { ...this.metadata };
  }

  getState(): MJCFDeviceState {
    return { ...this.state };
  }

  getRootNode(): TransformNode {
    return this.rootNode;
  }

  getKeyframes(): KeyframeObject[] {
    return [...this.metadata.keyframes];
  }

  getCurrentKeyframe(): string | undefined {
    return this.metadata.currentKeyframe;
  }

  // ===========================
  // State Updates
  // ===========================

  updateJointPosition(jointId: string, position: number): void {
    this.state.jointPositions[jointId] = position;
    this.state.lastUpdateTime = Date.now();
    this.emit('jointPositionChanged', { jointId, position });
  }

  updateJointVelocity(jointId: string, velocity: number): void {
    this.state.jointVelocities[jointId] = velocity;
    this.state.lastUpdateTime = Date.now();
    this.emit('jointVelocityChanged', { jointId, velocity });
  }

  updateJointForce(jointId: string, force: number): void {
    this.state.jointForces[jointId] = force;
    this.state.lastUpdateTime = Date.now();
    this.emit('jointForceChanged', { jointId, force });
  }

  updateActuatorState(actuatorId: string, enabled: boolean): void {
    this.state.actuatorStates[actuatorId] = enabled;
    this.state.lastUpdateTime = Date.now();
    this.emit('actuatorStateChanged', { actuatorId, enabled });
  }

  setError(errorMessage: string): void {
    this.state.hasError = true;
    this.state.errorMessage = errorMessage;
    this.state.lastUpdateTime = Date.now();
    this.emit('error', { message: errorMessage });
    console.error(`[MJCFDevice] ${this.metadata.deviceName} error: ${errorMessage}`);
  }

  clearError(): void {
    this.state.hasError = false;
    this.state.errorMessage = undefined;
    this.state.lastUpdateTime = Date.now();
    this.emit('errorCleared', {});
  }

  // ===========================
  // Keyframe Operations
  // ===========================

  setCurrentKeyframe(keyframeName: string): void {
    const keyframe = this.metadata.keyframes.find(k => k.name === keyframeName);
    if (!keyframe) {
      console.warn(`[MJCFDevice] Keyframe '${keyframeName}' not found`);
      return;
    }

    this.metadata.currentKeyframe = keyframeName;
    this.emit('keyframeChanged', { keyframeName, keyframe });
    console.log(`[MJCFDevice] Set current keyframe to '${keyframeName}'`);
  }

  // ===========================
  // Event System
  // ===========================

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // ===========================
  // Utility Methods
  // ===========================

  isRobot(): boolean {
    return this.metadata.deviceType === 'robot';
  }

  isGripper(): boolean {
    return this.metadata.deviceType === 'gripper';
  }

  hasKeyframes(): boolean {
    return this.metadata.keyframes.length > 0;
  }

  getJointCount(): number {
    return this.metadata.jointCount;
  }

  getActuatorCount(): number {
    return this.metadata.actuatorCount;
  }

  // ===========================
  // Lifecycle
  // ===========================

  dispose(): void {
    console.log(`[MJCFDevice] Disposing device entity: ${this.metadata.deviceName}`);

    // Clear all event listeners
    this.eventListeners.clear();

    // Clear metadata reference
    if (this.rootNode.metadata) {
      this.rootNode.metadata.deviceEntity = undefined;
    }

    // Note: We don't dispose the rootNode here - that's handled by EntityRegistry
  }
}

/**
 * Global registry for MJCF device entities
 * Allows lookup of device entities by ID or root node
 */
export class MJCFDeviceRegistry {
  private static instance: MJCFDeviceRegistry;
  private devices: Map<string, MJCFDeviceEntity>;
  private nodeToDevice: Map<TransformNode, MJCFDeviceEntity>;

  private constructor() {
    this.devices = new Map();
    this.nodeToDevice = new Map();
  }

  static getInstance(): MJCFDeviceRegistry {
    if (!this.instance) {
      this.instance = new MJCFDeviceRegistry();
    }
    return this.instance;
  }

  /**
   * Register a new MJCF device
   */
  register(device: MJCFDeviceEntity): void {
    const deviceId = device.getDeviceId();
    const rootNode = device.getRootNode();

    if (this.devices.has(deviceId)) {
      console.warn(`[MJCFDeviceRegistry] Device '${deviceId}' already registered, replacing`);
    }

    this.devices.set(deviceId, device);
    this.nodeToDevice.set(rootNode, device);

    console.log(`[MJCFDeviceRegistry] Registered device: ${deviceId} (${device.getDeviceName()})`);
  }

  /**
   * Unregister a device
   */
  unregister(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      this.nodeToDevice.delete(device.getRootNode());
      this.devices.delete(deviceId);
      device.dispose();
      console.log(`[MJCFDeviceRegistry] Unregistered device: ${deviceId}`);
    }
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): MJCFDeviceEntity | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Get device by root node
   */
  getDeviceByNode(node: TransformNode): MJCFDeviceEntity | undefined {
    return this.nodeToDevice.get(node);
  }

  /**
   * Get all devices
   */
  getAllDevices(): MJCFDeviceEntity[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get devices by type
   */
  getDevicesByType(deviceType: MJCFDeviceMetadata['deviceType']): MJCFDeviceEntity[] {
    return this.getAllDevices().filter(d => d.getDeviceType() === deviceType);
  }

  /**
   * Get all robots
   */
  getRobots(): MJCFDeviceEntity[] {
    return this.getDevicesByType('robot');
  }

  /**
   * Get all grippers
   */
  getGrippers(): MJCFDeviceEntity[] {
    return this.getDevicesByType('gripper');
  }

  /**
   * Check if a device exists
   */
  hasDevice(deviceId: string): boolean {
    return this.devices.has(deviceId);
  }

  /**
   * Clear all devices
   */
  clear(): void {
    this.devices.forEach(device => device.dispose());
    this.devices.clear();
    this.nodeToDevice.clear();
    console.log('[MJCFDeviceRegistry] Cleared all devices');
  }
}
