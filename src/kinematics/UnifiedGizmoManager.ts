// Unified Gizmo Target System
// Handles: Device positioning, TCP control, FullBody IK targets
// Owner: George (Agent 1)

import * as BABYLON from '@babylonjs/core';
import { IKTargetGizmoManager } from './IKTargetGizmoManager';

export type GizmoTargetType = 
  | 'device_base'     // Robot base positioning (when device selected)
  | 'tcp_control'      // TCP/end-effector control (Motion Panel)
  | 'ik_target'        // IK target (FullBody IK Panel)
  | 'multi_target';    // Multiple targets (FullBody IK)

export type ActivePanel = 'none' | 'motion' | 'fullbody_ik' | 'device';

export interface UnifiedGizmoConfig {
  targetId: string;
  targetType: GizmoTargetType;
  chainName?: string;           // For TCP and IK targets
  deviceId?: string;           // For device base targets
  position: BABYLON.Vector3;
  rotation?: BABYLON.Quaternion; // Optional rotation
  enabled: boolean;
  onPositionChange: (targetId: string, position: BABYLON.Vector3) => void;
  onRotationChange?: (targetId: string, rotation: BABYLON.Quaternion) => void; // Optional rotation callback
  onDeviceMove?: (deviceId: string, position: BABYLON.Vector3) => void; // For device positioning
  metadata?: {
    robotId?: string;          // Robot identifier
    jointCount?: number;       // Number of joints
    description?: string;      // Human-readable description
  };
}

export class UnifiedGizmoManager {
  private static instance: UnifiedGizmoManager | null = null;
  private ikGizmoManager: IKTargetGizmoManager;
  private activeTargets: Map<string, UnifiedGizmoConfig> = new Map();
  private activePanel: ActivePanel = 'none';
  // private scene: BABYLON.Scene | null = null; // Removed unused variable

  private constructor() {
    this.ikGizmoManager = IKTargetGizmoManager.getInstance();
  }

  static getInstance(): UnifiedGizmoManager {
    if (!UnifiedGizmoManager.instance) {
      UnifiedGizmoManager.instance = new UnifiedGizmoManager();
    }
    return UnifiedGizmoManager.instance;
  }

  /**
   * Initialize with scene
   */
  initialize(scene: BABYLON.Scene): void {
    this.ikGizmoManager.initialize(scene);
    console.log('[UnifiedGizmo] Initialized with scene');
  }

  /**
   * Set active panel context
   * This determines which gizmos are shown
   */
  setActivePanel(panel: ActivePanel): void {
    console.log(`[UnifiedGizmo] Switching to panel: ${panel}`);
    this.activePanel = panel;
    this.updateGizmoVisibility();
  }

  /**
   * Create or update a gizmo target
   */
  createTarget(config: UnifiedGizmoConfig): void {
    this.activeTargets.set(config.targetId, config);
    
    // Only show gizmo if it matches current panel context
    if (this.shouldShowGizmo(config)) {
      this.showGizmo(config);
    }
    
    console.log(`[UnifiedGizmo] Created target: ${config.targetId} (${config.targetType})`);
  }

  /**
   * Create TCP control gizmo for Motion Panel
   */
  createTcpControl(
    robotId: string, 
    chainName: string, 
    tcpPosition: BABYLON.Vector3, 
    onMove: (pos: BABYLON.Vector3) => void,
    tcpRotation?: BABYLON.Quaternion,
    onRotate?: (rot: BABYLON.Quaternion) => void
  ): void {
    const targetId = `tcp_${robotId}`;
    
    this.createTarget({
      targetId,
      targetType: 'tcp_control',
      chainName,
      position: tcpPosition.clone(),
      rotation: tcpRotation?.clone(),
      enabled: true,
      onPositionChange: (_id, newPos) => {
        console.log(`[UnifiedGizmo] TCP moved to: (${newPos.x.toFixed(3)}, ${newPos.y.toFixed(3)}, ${newPos.z.toFixed(3)})`);
        onMove(newPos);
      },
      onRotationChange: onRotate ? (_id, newRot) => {
        console.log(`[UnifiedGizmo] TCP rotated`);
        onRotate(newRot);
      } : undefined,
      metadata: {
        robotId,
        description: `TCP Control for ${chainName}`
      }
    });
  }

  /**
   * Create device base gizmo for device positioning
   */
  createDeviceBase(deviceId: string, devicePosition: BABYLON.Vector3, onMove: (deviceId: string, pos: BABYLON.Vector3) => void): void {
    const targetId = `device_${deviceId}`;
    
    this.createTarget({
      targetId,
      targetType: 'device_base',
      deviceId,
      position: devicePosition.clone(),
      enabled: true,
      onPositionChange: (_id, newPos) => {
        console.log(`[UnifiedGizmo] Device ${deviceId} moved to: (${newPos.x.toFixed(3)}, ${newPos.y.toFixed(3)}, ${newPos.z.toFixed(3)})`);
        onMove(deviceId, newPos);
      },
      metadata: {
        robotId: deviceId,
        description: `Device Base for ${deviceId}`
      }
    });
  }

  /**
   * Create IK target gizmo for FullBody IK Panel
   */
  createIkTarget(targetId: string, chainName: string, targetPosition: BABYLON.Vector3, onMove: (pos: BABYLON.Vector3) => void): void {
    this.createTarget({
      targetId,
      targetType: 'ik_target',
      chainName,
      position: targetPosition.clone(),
      enabled: true,
      onPositionChange: (_id, newPos) => {
        console.log(`[UnifiedGizmo] IK target ${targetId} moved to: (${newPos.x.toFixed(3)}, ${newPos.y.toFixed(3)}, ${newPos.z.toFixed(3)})`);
        onMove(newPos);
      },
      metadata: {
        description: `IK Target for ${chainName}`
      }
    });
  }

  /**
   * Remove a gizmo target
   */
  removeTarget(targetId: string): void {
    this.activeTargets.delete(targetId);
    this.ikGizmoManager.removeTarget(targetId);
  }

  /**
   * Update target position
   */
  updateTargetPosition(targetId: string, position: BABYLON.Vector3): void {
    const config = this.activeTargets.get(targetId);
    if (config) {
      config.position = position.clone();
      if (this.shouldShowGizmo(config)) {
        this.ikGizmoManager.updateTargetPosition(targetId, position);
      }
    }
  }

  /**
   * Update target rotation
   */
  updateTargetRotation(targetId: string, rotation: BABYLON.Quaternion): void {
    const config = this.activeTargets.get(targetId);
    if (config) {
      config.rotation = rotation.clone();
      if (this.shouldShowGizmo(config)) {
        this.ikGizmoManager.updateTargetRotation(targetId, rotation);
      }
    }
  }

  /**
   * Clear all gizmos
   */
  clearAll(): void {
    this.activeTargets.clear();
    this.ikGizmoManager.clearAll();
  }

  /**
   * Determine if gizmo should be shown based on current panel
   */
  private shouldShowGizmo(config: UnifiedGizmoConfig): boolean {
    switch (this.activePanel) {
      case 'motion':
        return config.targetType === 'tcp_control';
      case 'fullbody_ik':
        return config.targetType === 'ik_target' || config.targetType === 'multi_target';
      case 'device':
        return config.targetType === 'device_base';
      case 'none':
      default:
        return false;
    }
  }

  /**
   * Show gizmo for specific target
   */
  private showGizmo(config: UnifiedGizmoConfig): void {
    // Use existing IKTargetGizmoManager for actual gizmo creation
    this.ikGizmoManager.createTarget({
      targetId: config.targetId,
      chainName: config.chainName || 'unknown',
      position: config.position.clone(),
      rotation: config.rotation?.clone(),
      enabled: config.enabled,
      onPositionChange: (id, newPos) => {
        // Handle different target types
        switch (config.targetType) {
          case 'device_base':
            if (config.onDeviceMove && config.deviceId) {
              config.onDeviceMove(config.deviceId, newPos);
            }
            break;
          case 'tcp_control':
          case 'ik_target':
            config.onPositionChange(id, newPos);
            break;
        }
      },
      onRotationChange: config.onRotationChange ? (id, newRot) => {
        // Handle rotation changes for TCP and IK targets
        if (config.onRotationChange) {
          config.onRotationChange(id, newRot);
        }
      } : undefined,
    });
  }

  /**
   * Update gizmo visibility based on current panel
   */
  private updateGizmoVisibility(): void {
    // Clear all current gizmos
    this.ikGizmoManager.clearAll();
    
    // Show appropriate gizmos for current panel
    this.activeTargets.forEach((config) => {
      if (this.shouldShowGizmo(config)) {
        this.showGizmo(config);
      }
    });
  }

  /**
   * Get current active targets for debugging
   */
  getActiveTargets(): Map<string, UnifiedGizmoConfig> {
    return new Map(this.activeTargets);
  }

  /**
   * Get current panel context
   */
  getActivePanel(): string {
    return this.activePanel;
  }
}
