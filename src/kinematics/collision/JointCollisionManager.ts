/**
 * Joint Collision Manager
 * Owner: George
 * 
 * Manages collision detection between joints and provides visual feedback
 * for MJCF-style collision pairs and contact definitions
 */

import * as BABYLON from '@babylonjs/core';
import { KinematicsManager } from '../KinematicsManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { JointConfig } from '../KinematicsManager';

export interface CollisionPair {
  jointA: string;
  jointB: string;
  enabled: boolean;
  clearance: number; // Minimum clearance in mm
  warningDistance: number; // Distance to show warning (mm)
}

export interface CollisionState {
  pair: CollisionPair;
  isColliding: boolean;
  clearance: number;
  warningLevel: 'safe' | 'warning' | 'collision';
  contactPoints: BABYLON.Vector3[];
}

export class JointCollisionManager {
  private static instance: JointCollisionManager | null = null;
  private collisionPairs = new Map<string, CollisionPair>();
  private collisionStates = new Map<string, CollisionState>();
  private visualizers = new Map<string, BABYLON.Mesh[]>();
  private scene: BABYLON.Scene | null = null;
  private kinematicsManager: KinematicsManager;
  private sceneTreeManager: SceneTreeManager;

  private constructor() {
    this.kinematicsManager = KinematicsManager.getInstance();
    this.sceneTreeManager = SceneTreeManager.getInstance();
  }

  static getInstance(): JointCollisionManager {
    if (!JointCollisionManager.instance) {
      JointCollisionManager.instance = new JointCollisionManager();
    }
    return JointCollisionManager.instance;
  }

  /**
   * Initialize with Babylon.js scene
   */
  initialize(scene: BABYLON.Scene): void {
    this.scene = scene;
    console.log('[JointCollisionManager] Initialized');
  }

  /**
   * Add a collision pair between two joints
   */
  addCollisionPair(
    jointA: string,
    jointB: string,
    clearance: number = 5.0,
    warningDistance: number = 10.0
  ): string {
    const pairId = `${jointA}_${jointB}`;
    
    const pair: CollisionPair = {
      jointA,
      jointB,
      enabled: true,
      clearance,
      warningDistance
    };

    this.collisionPairs.set(pairId, pair);
    
    // Initialize collision state
    const state: CollisionState = {
      pair,
      isColliding: false,
      clearance: Infinity,
      warningLevel: 'safe',
      contactPoints: []
    };
    
    this.collisionStates.set(pairId, state);
    
    console.log(`[JointCollisionManager] Added collision pair: ${jointA} <-> ${jointB}`);
    return pairId;
  }

  /**
   * Remove a collision pair
   */
  removeCollisionPair(pairId: string): boolean {
    const removed = this.collisionPairs.delete(pairId);
    this.collisionStates.delete(pairId);
    this.hideCollisionVisuals(pairId);
    
    if (removed) {
      console.log(`[JointCollisionManager] Removed collision pair: ${pairId}`);
    }
    
    return removed;
  }

  /**
   * Enable/disable a collision pair
   */
  setCollisionPairEnabled(pairId: string, enabled: boolean): void {
    const pair = this.collisionPairs.get(pairId);
    if (pair) {
      pair.enabled = enabled;
      console.log(`[JointCollisionManager] Collision pair ${pairId}: ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Update collision detection for all pairs
   * Call this every frame or when joints move
   */
  updateCollisions(): void {
    for (const [pairId, pair] of this.collisionPairs) {
      if (!pair.enabled) continue;
      
      this.checkCollisionPair(pairId, pair);
    }
  }

  /**
   * Check collision for a specific pair
   */
  private checkCollisionPair(pairId: string, pair: CollisionPair): void {
    const jointA = this.kinematicsManager.getJoint(pair.jointA);
    const jointB = this.kinematicsManager.getJoint(pair.jointB);
    
    if (!jointA || !jointB) return;

    // Get the meshes associated with these joints
    const meshA = this.getJointMesh(jointA);
    const meshB = this.getJointMesh(jointB);
    
    if (!meshA || !meshB) return;

    // Calculate distance between joint meshes
    const distance = BABYLON.Vector3.Distance(meshA.absolutePosition, meshB.absolutePosition);
    const clearanceMM = distance * 1000; // Convert to mm

    // Determine warning level
    let warningLevel: 'safe' | 'warning' | 'collision';
    if (clearanceMM <= pair.clearance) {
      warningLevel = 'collision';
    } else if (clearanceMM <= pair.warningDistance) {
      warningLevel = 'warning';
    } else {
      warningLevel = 'safe';
    }

    // Update collision state
    const state = this.collisionStates.get(pairId);
    if (state) {
      state.clearance = clearanceMM;
      state.warningLevel = warningLevel;
      state.isColliding = warningLevel === 'collision';
      
      // Update visual feedback
      this.updateCollisionVisuals(pairId, state);
    }
  }

  /**
   * Get the mesh associated with a joint
   */
  private getJointMesh(joint: JointConfig): BABYLON.Mesh | null {
    const childNode = this.sceneTreeManager.getNode(joint.childNodeId);
    if (!childNode || !childNode.babylonMeshId) return null;

    const mesh = this.scene!.getMeshByUniqueId(parseInt(childNode.babylonMeshId)) as BABYLON.Mesh;
    return mesh;
  }

  /**
   * Update visual feedback for collision state
   */
  private updateCollisionVisuals(pairId: string, state: CollisionState): void {
    // Hide existing visuals
    this.hideCollisionVisuals(pairId);

    if (!this.scene) return;

    const visuals: BABYLON.Mesh[] = [];

    // Create visual indicators based on warning level
    switch (state.warningLevel) {
      case 'collision':
        // Red highlight for collision
        visuals.push(...this.createCollisionHighlight(state.pair.jointA, 'red'));
        visuals.push(...this.createCollisionHighlight(state.pair.jointB, 'red'));
        break;
        
      case 'warning':
        // Yellow highlight for warning
        visuals.push(...this.createCollisionHighlight(state.pair.jointA, 'yellow'));
        visuals.push(...this.createCollisionHighlight(state.pair.jointB, 'yellow'));
        break;
        
      case 'safe':
        // No visual feedback for safe state
        break;
    }

    // Add distance label if in warning or collision state
    if (state.warningLevel !== 'safe') {
      const distanceLabel = this.createDistanceLabel(state);
      if (distanceLabel) {
        visuals.push(distanceLabel);
      }
    }

    this.visualizers.set(pairId, visuals);
  }

  /**
   * Create collision highlight for a joint
   */
  private createCollisionHighlight(jointId: string, color: 'red' | 'yellow'): BABYLON.Mesh[] {
    const joint = this.kinematicsManager.getJoint(jointId);
    if (!joint) return [];

    const mesh = this.getJointMesh(joint);
    if (!mesh) return [];

    const visuals: BABYLON.Mesh[] = [];

    // Create a wireframe box around the mesh
    const boundingBox = mesh.getBoundingInfo().boundingBox;
    const size = boundingBox.maximum.subtract(boundingBox.minimum);
    
    const highlightBox = BABYLON.MeshBuilder.CreateBox(
      `collision_highlight_${jointId}`,
      {
        width: size.x + 0.01,
        height: size.y + 0.01,
        depth: size.z + 0.01
      },
      this.scene!
    );

    highlightBox.position.copyFrom(mesh.absolutePosition);
    highlightBox.isPickable = false;
    highlightBox.parent = mesh;

    // Create material
    const material = new BABYLON.StandardMaterial(`collision_mat_${jointId}`, this.scene!);
    material.wireframe = true;
    material.emissiveColor = color === 'red' ? new BABYLON.Color3(1, 0, 0) : new BABYLON.Color3(1, 1, 0);
    material.alpha = 0.8;
    highlightBox.material = material;

    visuals.push(highlightBox);
    return visuals;
  }

  /**
   * Create distance label between joints
   */
  private createDistanceLabel(state: CollisionState): BABYLON.Mesh | null {
    const jointA = this.kinematicsManager.getJoint(state.pair.jointA);
    const jointB = this.kinematicsManager.getJoint(state.pair.jointB);
    
    if (!jointA || !jointB) return null;

    const meshA = this.getJointMesh(jointA);
    const meshB = this.getJointMesh(jointB);
    
    if (!meshA || !meshB) return null;

    // Create text plane
    const textPlane = BABYLON.MeshBuilder.CreatePlane(
      `distance_label_${state.pair.jointA}_${state.pair.jointB}`,
      { size: 0.2 },
      this.scene!
    );

    // Position between the two meshes
    const midPoint = BABYLON.Vector3.Center(meshA.absolutePosition, meshB.absolutePosition);
    textPlane.position.copyFrom(midPoint);
    textPlane.isPickable = false;

    // Create dynamic texture with distance text
    const texture = new BABYLON.DynamicTexture(
      `distance_texture_${state.pair.jointA}_${state.pair.jointB}`,
      { width: 256, height: 128 },
      this.scene!
    );

    const context = texture.getContext();
    context.fillStyle = state.warningLevel === 'collision' ? '#ff0000' : '#ffff00';
    context.fillRect(0, 0, 256, 128);
    context.fillStyle = '#000000';
    context.font = '24px Arial';
    (context as any).textAlign = 'center';
    context.fillText(`${state.clearance.toFixed(1)}mm`, 128, 64);

    texture.update();

    const material = new BABYLON.StandardMaterial(`distance_mat_${state.pair.jointA}_${state.pair.jointB}`, this.scene!);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    textPlane.material = material;

    return textPlane;
  }

  /**
   * Hide collision visuals for a pair
   */
  private hideCollisionVisuals(pairId: string): void {
    const visuals = this.visualizers.get(pairId);
    if (visuals) {
      visuals.forEach(visual => visual.dispose());
      this.visualizers.delete(pairId);
    }
  }

  /**
   * Get collision state for a pair
   */
  getCollisionState(pairId: string): CollisionState | undefined {
    return this.collisionStates.get(pairId);
  }

  /**
   * Get all collision states
   */
  getAllCollisionStates(): CollisionState[] {
    return Array.from(this.collisionStates.values());
  }

  /**
   * Get all collision pairs
   */
  getAllCollisionPairs(): CollisionPair[] {
    return Array.from(this.collisionPairs.values());
  }

  /**
   * Clear all collision pairs and visuals
   */
  clear(): void {
    this.collisionPairs.clear();
    this.collisionStates.clear();
    
    // Dispose all visuals
    this.visualizers.forEach(visuals => {
      visuals.forEach(visual => visual.dispose());
    });
    this.visualizers.clear();
    
    console.log('[JointCollisionManager] Cleared all collision pairs');
  }

  /**
   * Dispose the manager and clean up resources
   */
  dispose(): void {
    this.clear();
    JointCollisionManager.instance = null;
  }
}
