/**
 * Target Array Manager
 * Owner: George (Agent 1 - Project Manager)
 * 
 * CRUD operations for kinematic target arrays
 * Manages target collections for all robot types
 */

import * as BABYLON from '@babylonjs/core';
import {
  TargetArray,
  KinematicTarget,
  RobotKeyframe,
  validateTargetArray,
  cloneTargetArray,
  // mergeTargetArrays,
  // transformToBabylon,
  // babylonToTransform,
} from '../types/TargetStructure';
// import { KinematicsManager } from '../KinematicsManager';

/**
 * Target Array Manager
 * Central system for managing kinematic targets across all robots
 */
export class TargetArrayManager {
  private static instance: TargetArrayManager | null = null;
  
  // Storage: robotId → TargetArray
  private targetArrays = new Map<string, TargetArray>();
  
  // Active targets (currently being used for IK solving)
  private activeRobotId: string | null = null;
  
  // Change listeners for UI updates
  private changeListeners = new Set<(robotId: string) => void>();

  private constructor() {}

  static getInstance(): TargetArrayManager {
    if (!TargetArrayManager.instance) {
      TargetArrayManager.instance = new TargetArrayManager();
    }
    return TargetArrayManager.instance;
  }

  /**
   * Create a new target array for a robot
   */
  createTargetArray(targetArray: TargetArray): boolean {
    // Validate schema
    const validation = validateTargetArray(targetArray);
    if (!validation.valid) {
      console.error('[Target Array Manager] Validation failed:', validation.errors);
      return false;
    }

    // Check for duplicates
    if (this.targetArrays.has(targetArray.robotId)) {
      console.warn(`[Target Array Manager] Target array for robot ${targetArray.robotId} already exists`);
      return false;
    }

    // Store target array
    this.targetArrays.set(targetArray.robotId, cloneTargetArray(targetArray));
    
    console.log(`[Target Array Manager] Created target array for robot: ${targetArray.robotName} (${targetArray.robotId})`);
    this.notifyChangeListeners(targetArray.robotId);
    
    return true;
  }

  /**
   * Get target array for a robot
   */
  getTargetArray(robotId: string): TargetArray | null {
    const targetArray = this.targetArrays.get(robotId);
    return targetArray ? cloneTargetArray(targetArray) : null;
  }

  /**
   * Get all target arrays
   */
  getAllTargetArrays(): TargetArray[] {
    return Array.from(this.targetArrays.values()).map(ta => cloneTargetArray(ta));
  }

  /**
   * Update an existing target array
   */
  updateTargetArray(robotId: string, updates: Partial<TargetArray>): boolean {
    const existing = this.targetArrays.get(robotId);
    if (!existing) {
      console.error(`[Target Array Manager] Target array for robot ${robotId} not found`);
      return false;
    }

    // Merge updates
    const updated: TargetArray = {
      ...existing,
      ...updates,
      robotId: existing.robotId, // Never allow robotId to change
      metadata: {
        ...existing.metadata,
        ...(updates.metadata || {}),
        updatedAt: new Date(),
      },
    };

    // Validate merged result
    const validation = validateTargetArray(updated);
    if (!validation.valid) {
      console.error('[Target Array Manager] Update validation failed:', validation.errors);
      return false;
    }

    this.targetArrays.set(robotId, updated);
    
    console.log(`[Target Array Manager] Updated target array for robot: ${robotId}`);
    this.notifyChangeListeners(robotId);
    
    return true;
  }

  /**
   * Delete a target array
   */
  deleteTargetArray(robotId: string): boolean {
    const deleted = this.targetArrays.delete(robotId);
    
    if (deleted) {
      console.log(`[Target Array Manager] Deleted target array for robot: ${robotId}`);
      
      // Clear active robot if deleted
      if (this.activeRobotId === robotId) {
        this.activeRobotId = null;
      }
      
      this.notifyChangeListeners(robotId);
    }
    
    return deleted;
  }

  /**
   * Add a target to a robot's target array
   */
  addTarget(robotId: string, target: KinematicTarget): boolean {
    const targetArray = this.targetArrays.get(robotId);
    if (!targetArray) {
      console.error(`[Target Array Manager] Target array for robot ${robotId} not found`);
      return false;
    }

    // Check for duplicate target ID
    if (targetArray.targets.some(t => t.id === target.id)) {
      console.error(`[Target Array Manager] Target with ID ${target.id} already exists`);
      return false;
    }

    // Add target
    targetArray.targets.push(target);
    targetArray.metadata.updatedAt = new Date();
    
    console.log(`[Target Array Manager] Added target ${target.id} to robot ${robotId}`);
    this.notifyChangeListeners(robotId);
    
    return true;
  }

  /**
   * Update a specific target
   */
  updateTarget(robotId: string, targetId: string, updates: Partial<KinematicTarget>): boolean {
    const targetArray = this.targetArrays.get(robotId);
    if (!targetArray) {
      console.error(`[Target Array Manager] Target array for robot ${robotId} not found`);
      return false;
    }

    const targetIndex = targetArray.targets.findIndex(t => t.id === targetId);
    if (targetIndex === -1) {
      console.error(`[Target Array Manager] Target ${targetId} not found in robot ${robotId}`);
      return false;
    }

    // Merge updates
    targetArray.targets[targetIndex] = {
      ...targetArray.targets[targetIndex],
      ...updates,
      id: targetArray.targets[targetIndex].id, // Never allow ID to change
    };
    
    targetArray.metadata.updatedAt = new Date();
    
    console.log(`[Target Array Manager] Updated target ${targetId} in robot ${robotId}`);
    this.notifyChangeListeners(robotId);
    
    return true;
  }

  /**
   * Remove a target from a robot's target array
   */
  removeTarget(robotId: string, targetId: string): boolean {
    const targetArray = this.targetArrays.get(robotId);
    if (!targetArray) {
      console.error(`[Target Array Manager] Target array for robot ${robotId} not found`);
      return false;
    }

    const initialLength = targetArray.targets.length;
    targetArray.targets = targetArray.targets.filter(t => t.id !== targetId);
    
    const removed = targetArray.targets.length < initialLength;
    
    if (removed) {
      targetArray.metadata.updatedAt = new Date();
      console.log(`[Target Array Manager] Removed target ${targetId} from robot ${robotId}`);
      this.notifyChangeListeners(robotId);
    }
    
    return removed;
  }

  /**
   * Get a specific target
   */
  getTarget(robotId: string, targetId: string): KinematicTarget | null {
    const targetArray = this.targetArrays.get(robotId);
    if (!targetArray) {
      return null;
    }

    return targetArray.targets.find(t => t.id === targetId) || null;
  }

  /**
   * Get all targets for a robot
   */
  getTargets(robotId: string): KinematicTarget[] {
    const targetArray = this.targetArrays.get(robotId);
    return targetArray ? [...targetArray.targets] : [];
  }

  /**
   * Update target position (convenience method)
   */
  updateTargetPosition(
    robotId: string, 
    targetId: string, 
    position: BABYLON.Vector3
  ): boolean {
    const target = this.getTarget(robotId, targetId);
    if (!target) {
      return false;
    }

    return this.updateTarget(robotId, targetId, {
      transform: {
        ...target.transform,
        position: [position.x, position.y, position.z],
      },
    });
  }

  /**
   * Update target rotation (convenience method)
   */
  updateTargetRotation(
    robotId: string,
    targetId: string,
    rotation: BABYLON.Quaternion
  ): boolean {
    const target = this.getTarget(robotId, targetId);
    if (!target) {
      return false;
    }

    return this.updateTarget(robotId, targetId, {
      transform: {
        ...target.transform,
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
      },
    });
  }

  /**
   * Set active robot (for IK solving)
   */
  setActiveRobot(robotId: string | null): void {
    if (robotId && !this.targetArrays.has(robotId)) {
      console.error(`[Target Array Manager] Cannot set active robot: ${robotId} not found`);
      return;
    }

    this.activeRobotId = robotId;
    console.log(`[Target Array Manager] Active robot set to: ${robotId || 'none'}`);
  }

  /**
   * Get active robot ID
   */
  getActiveRobotId(): string | null {
    return this.activeRobotId;
  }

  /**
   * Get active robot's target array
   */
  getActiveTargetArray(): TargetArray | null {
    return this.activeRobotId ? this.getTargetArray(this.activeRobotId) : null;
  }

  /**
   * Save a keyframe (pose snapshot)
   */
  saveKeyframe(robotId: string, name: string, description?: string): boolean {
    const targetArray = this.targetArrays.get(robotId);
    if (!targetArray) {
      console.error(`[Target Array Manager] Target array for robot ${robotId} not found`);
      return false;
    }

    const keyframe: RobotKeyframe = {
      id: `keyframe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      targets: targetArray.targets.map(t => ({ ...t })), // Deep copy targets
      timestamp: new Date(),
    };

    if (!targetArray.keyframes) {
      targetArray.keyframes = [];
    }

    targetArray.keyframes.push(keyframe);
    targetArray.metadata.updatedAt = new Date();
    
    console.log(`[Target Array Manager] Saved keyframe "${name}" for robot ${robotId}`);
    this.notifyChangeListeners(robotId);
    
    return true;
  }

  /**
   * Load a keyframe (restore pose snapshot)
   */
  loadKeyframe(robotId: string, keyframeId: string): boolean {
    const targetArray = this.targetArrays.get(robotId);
    if (!targetArray || !targetArray.keyframes) {
      console.error(`[Target Array Manager] Target array or keyframes not found for robot ${robotId}`);
      return false;
    }

    const keyframe = targetArray.keyframes.find(kf => kf.id === keyframeId);
    if (!keyframe) {
      console.error(`[Target Array Manager] Keyframe ${keyframeId} not found`);
      return false;
    }

    // Restore targets from keyframe
    targetArray.targets = keyframe.targets.map(t => ({ ...t })); // Deep copy
    targetArray.metadata.updatedAt = new Date();
    
    console.log(`[Target Array Manager] Loaded keyframe "${keyframe.name}" for robot ${robotId}`);
    this.notifyChangeListeners(robotId);
    
    return true;
  }

  /**
   * Get all keyframes for a robot
   */
  getKeyframes(robotId: string): RobotKeyframe[] {
    const targetArray = this.targetArrays.get(robotId);
    return targetArray?.keyframes || [];
  }

  /**
   * Delete a keyframe
   */
  deleteKeyframe(robotId: string, keyframeId: string): boolean {
    const targetArray = this.targetArrays.get(robotId);
    if (!targetArray || !targetArray.keyframes) {
      return false;
    }

    const initialLength = targetArray.keyframes.length;
    targetArray.keyframes = targetArray.keyframes.filter(kf => kf.id !== keyframeId);
    
    const deleted = targetArray.keyframes.length < initialLength;
    
    if (deleted) {
      targetArray.metadata.updatedAt = new Date();
      console.log(`[Target Array Manager] Deleted keyframe ${keyframeId} from robot ${robotId}`);
      this.notifyChangeListeners(robotId);
    }
    
    return deleted;
  }

  /**
   * Register a change listener
   */
  onChange(callback: (robotId: string) => void): void {
    this.changeListeners.add(callback);
  }

  /**
   * Unregister a change listener
   */
  offChange(callback: (robotId: string) => void): void {
    this.changeListeners.delete(callback);
  }

  /**
   * Notify all change listeners
   */
  private notifyChangeListeners(robotId: string): void {
    this.changeListeners.forEach(callback => {
      try {
        callback(robotId);
      } catch (error) {
        console.error('[Target Array Manager] Error in change listener:', error);
      }
    });
  }

  /**
   * Export target array to JSON
   */
  exportToJSON(robotId: string): string | null {
    const targetArray = this.getTargetArray(robotId);
    if (!targetArray) {
      return null;
    }

    return JSON.stringify(targetArray, null, 2);
  }

  /**
   * Import target array from JSON
   */
  importFromJSON(jsonString: string): boolean {
    try {
      const targetArray: TargetArray = JSON.parse(jsonString);
      
      // Restore Date objects
      targetArray.metadata.createdAt = new Date(targetArray.metadata.createdAt);
      targetArray.metadata.updatedAt = new Date(targetArray.metadata.updatedAt);
      
      if (targetArray.keyframes) {
        targetArray.keyframes.forEach(kf => {
          kf.timestamp = new Date(kf.timestamp);
        });
      }
      
      return this.createTargetArray(targetArray);
    } catch (error) {
      console.error('[Target Array Manager] Failed to import from JSON:', error);
      return false;
    }
  }

  /**
   * Clear all target arrays
   */
  clear(): void {
    this.targetArrays.clear();
    this.activeRobotId = null;
    console.log('[Target Array Manager] Cleared all target arrays');
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRobots: number;
    totalTargets: number;
    totalKeyframes: number;
    robotTypes: Record<string, number>;
  } {
    const arrays = Array.from(this.targetArrays.values());
    
    const robotTypes: Record<string, number> = {};
    arrays.forEach(ta => {
      robotTypes[ta.robotType] = (robotTypes[ta.robotType] || 0) + 1;
    });
    
    return {
      totalRobots: arrays.length,
      totalTargets: arrays.reduce((sum, ta) => sum + ta.targets.length, 0),
      totalKeyframes: arrays.reduce((sum, ta) => sum + (ta.keyframes?.length || 0), 0),
      robotTypes,
    };
  }
}
