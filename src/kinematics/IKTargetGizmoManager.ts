/**
 * IK Target Gizmo Manager
 * Owner: George (Agent 1)
 * Manages 3D position gizmos for FullBody IK targets
 */

import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export interface IKTargetGizmoConfig {
  targetId: string; // Unique ID for this target
  chainName: string; // Which kinematic chain this targets
  position: BABYLON.Vector3;
  rotation?: BABYLON.Quaternion; // Optional rotation
  enabled: boolean;
  onPositionChange: (targetId: string, position: BABYLON.Vector3) => void;
  onRotationChange?: (targetId: string, rotation: BABYLON.Quaternion) => void; // Optional rotation callback
}

interface TargetGizmoData {
  gizmo: BABYLON.PositionGizmo | BABYLON.Gizmo | null;
  rotationGizmo: BABYLON.RotationGizmo | null; // Rotation gizmo for TCP control
  marker: BABYLON.Mesh | null; // Visual marker (optional, currently not used)
  label: GUI.TextBlock | null; // 3D label showing chain name
  transformNode: BABYLON.TransformNode; // Parent node for gizmo
  config: IKTargetGizmoConfig;
}

/**
 * Chain-specific color palette for visual distinction
 */
const CHAIN_COLORS: Record<string, BABYLON.Color3> = {
  // Humanoid chains
  'left_arm': new BABYLON.Color3(0.3, 0.5, 1.0),      // Blue
  'right_arm': new BABYLON.Color3(1.0, 0.3, 0.3),     // Red
  'left_leg': new BABYLON.Color3(0.3, 1.0, 0.5),      // Green
  'right_leg': new BABYLON.Color3(1.0, 0.7, 0.2),     // Orange
  'torso': new BABYLON.Color3(0.8, 0.3, 1.0),         // Purple
  'head': new BABYLON.Color3(1.0, 1.0, 0.3),          // Yellow
  
  // Quadruped chains
  'front_left_leg': new BABYLON.Color3(0.3, 0.5, 1.0),
  'front_right_leg': new BABYLON.Color3(1.0, 0.3, 0.3),
  'rear_left_leg': new BABYLON.Color3(0.3, 1.0, 0.5),
  'rear_right_leg': new BABYLON.Color3(1.0, 0.7, 0.2),
  'body': new BABYLON.Color3(0.8, 0.3, 1.0),
  
  // Default fallback
  'default': new BABYLON.Color3(0.7, 0.7, 0.7),       // Gray
};

/**
 * IKTargetGizmoManager - Manages interactive 3D gizmos for IK targets
 * Provides visual, draggable targets in the 3D viewport that sync with panel state
 */
export class IKTargetGizmoManager {
  private static instance: IKTargetGizmoManager | null = null;
  private scene: BABYLON.Scene | null = null;
  private targets: Map<string, TargetGizmoData> = new Map();
  private gizmoManager: BABYLON.GizmoManager | null = null;
  private advancedTexture: GUI.AdvancedDynamicTexture | null = null;

  private constructor() {}

  static getInstance(): IKTargetGizmoManager {
    if (!IKTargetGizmoManager.instance) {
      IKTargetGizmoManager.instance = new IKTargetGizmoManager();
    }
    return IKTargetGizmoManager.instance;
  }

  /**
   * Initialize the gizmo manager with a Babylon scene
   */
  initialize(scene: BABYLON.Scene): void {
    this.scene = scene;
    
    // Create gizmo manager for managing multiple gizmos
    this.gizmoManager = new BABYLON.GizmoManager(scene);
    this.gizmoManager.usePointerToAttachGizmos = false;
    
    // Create 2D GUI texture for labels
    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('IKTargetUI', true, scene);
    
    console.log('[IKTargetGizmoManager] Initialized');
  }

  /**
   * Create or update a target gizmo
   */
  createTarget(config: IKTargetGizmoConfig): void {
    if (!this.scene) {
      console.warn('[IKTargetGizmoManager] Scene not initialized');
      return;
    }

    // Remove existing target if it exists
    this.removeTarget(config.targetId);

    // Create transform node to hold the gizmo
    const transformNode = new BABYLON.TransformNode(`ikTarget_${config.targetId}`, this.scene);
    transformNode.position = config.position.clone();
    
    // Initialize rotation quaternion if needed
    if (config.rotation) {
      transformNode.rotationQuaternion = config.rotation.clone();
    } else {
      transformNode.rotationQuaternion = BABYLON.Quaternion.Identity();
    }

    // No visual marker - just use the gizmo itself
    // Get color for this chain
    const chainColor = this.getChainColor(config.chainName);

    // Create position gizmo
    const gizmo = new BABYLON.PositionGizmo(new BABYLON.UtilityLayerRenderer(this.scene));
    gizmo.attachedNode = transformNode;
    gizmo.updateGizmoRotationToMatchAttachedMesh = false;
    gizmo.scaleRatio = 1.0; // Standard size
    
    // Color-code gizmo axes with more vibrant colors
    this.applyGizmoColors(gizmo, chainColor);

    // Listen for drag events
    gizmo.onDragStartObservable.add(() => {
      console.log(`[IKTarget] Drag start: ${config.targetId}`);
    });

    gizmo.onDragObservable.add(() => {
      // Real-time position sync during drag
      const newPos = transformNode.position.clone();
      config.onPositionChange(config.targetId, newPos);
    });

    gizmo.onDragEndObservable.add(() => {
      // Final position update
      const newPos = transformNode.position.clone();
      config.onPositionChange(config.targetId, newPos);
      console.log(`[IKTarget] Drag end: ${config.targetId} → (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)})`);
    });

    // Create rotation gizmo if rotation callback is provided
    let rotationGizmo: BABYLON.RotationGizmo | null = null;
    if (config.onRotationChange) {
      rotationGizmo = new BABYLON.RotationGizmo(new BABYLON.UtilityLayerRenderer(this.scene));
      rotationGizmo.attachedNode = transformNode;
      rotationGizmo.updateGizmoRotationToMatchAttachedMesh = true; // IMPORTANT: Must match attached node's rotation
      rotationGizmo.scaleRatio = 1.0; // Standard size
      
      // Apply custom colors to rotation gizmo rings
      this.applyRotationGizmoColors(rotationGizmo);
      
      // Listen for rotation drag events
      rotationGizmo.onDragObservable.add(() => {
        // Real-time rotation sync during drag
        const newRot = transformNode.rotationQuaternion?.clone() || BABYLON.Quaternion.Identity();
        if (config.onRotationChange) {
          config.onRotationChange(config.targetId, newRot);
        }
      });

      rotationGizmo.onDragEndObservable.add(() => {
        const newRot = transformNode.rotationQuaternion?.clone() || BABYLON.Quaternion.Identity();
        console.log(`[IKTarget] Rotation end: ${config.targetId}`);
        if (config.onRotationChange) {
          config.onRotationChange(config.targetId, newRot);
        }
      });
    }

    // Skip label creation for now to avoid linking errors
    // The gizmo itself is visually distinct with the rotation and position controls
    let label: GUI.TextBlock | null = null;

    // Store target data
    this.targets.set(config.targetId, {
      gizmo,
      rotationGizmo,
      marker: null, // No marker, just use gizmo
      label,
      transformNode,
      config,
    });

    console.log(`[IKTargetGizmoManager] Created target: ${config.targetId} (${config.chainName})`);
  }

  /**
   * Update target position programmatically (e.g., from panel input)
   */
  updateTargetPosition(targetId: string, position: BABYLON.Vector3): void {
    const target = this.targets.get(targetId);
    if (!target) return;

    target.transformNode.position = position.clone();
    target.transformNode.computeWorldMatrix(true);
    console.log(`[IKTargetGizmoManager] Updated position: ${targetId} → (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
  }

  /**
   * Update target rotation programmatically
   */
  updateTargetRotation(targetId: string, rotation: BABYLON.Quaternion): void {
    const target = this.targets.get(targetId);
    if (!target) return;

    // Update the transform node's rotation
    target.transformNode.rotationQuaternion = rotation.clone();

    // Force Babylon.js to mark the node as dirty and update its world matrix
    target.transformNode.computeWorldMatrix(true);

    // CRITICAL: Force the rotation gizmo to update by reattaching to the node
    // This is necessary because Babylon.js doesn't automatically detect rotation changes
    if (target.rotationGizmo) {
      const tempNode = target.rotationGizmo.attachedNode;
      target.rotationGizmo.attachedNode = null;
      target.rotationGizmo.attachedNode = tempNode;
    }

    // Debug log to verify rotation
    const euler = rotation.toEulerAngles();
    console.log(`[IKTargetGizmoManager] Updated rotation: ${targetId} → Rx=${(euler.x*180/Math.PI).toFixed(1)}° Ry=${(euler.y*180/Math.PI).toFixed(1)}° Rz=${(euler.z*180/Math.PI).toFixed(1)}°`);
  }

  /**
   * Update target enabled state (visibility)
   */
  updateTargetEnabled(targetId: string, enabled: boolean): void {
    const target = this.targets.get(targetId);
    if (!target) return;

    // Update marker opacity (if marker exists)
    if (target.marker && target.marker.material instanceof BABYLON.StandardMaterial) {
      target.marker.material.alpha = enabled ? 0.8 : 0.3;
      target.marker.material.emissiveColor = enabled 
        ? target.marker.material.diffuseColor.scale(0.5)
        : BABYLON.Color3.Black();
    }

    // Show/hide position gizmo
    if (target.gizmo) {
      target.gizmo.attachedNode = enabled ? target.transformNode : null;
    }
    
    // Show/hide rotation gizmo
    if (target.rotationGizmo) {
      target.rotationGizmo.attachedNode = enabled ? target.transformNode : null;
    }
    
    // Show/hide label
    if (target.label) {
      target.label.alpha = enabled ? 1.0 : 0.3;
    }
    
    console.log(`[IKTargetGizmoManager] ${enabled ? 'Enabled' : 'Disabled'} target: ${targetId}`);
  }

  /**
   * Remove a target gizmo
   */
  removeTarget(targetId: string): void {
    const target = this.targets.get(targetId);
    if (!target) return;

    // Dispose position gizmo
    if (target.gizmo) {
      target.gizmo.dispose();
    }

    // Dispose rotation gizmo if it exists
    if (target.rotationGizmo) {
      target.rotationGizmo.dispose();
    }

    // Dispose marker if it exists
    if (target.marker) {
      target.marker.getChildren().forEach(child => {
        if (child instanceof BABYLON.Mesh) {
          child.dispose();
        }
      });
      target.marker.dispose();
    }

    // Dispose transform node
    target.transformNode.dispose();

    // Remove label if it exists
    if (target.label) {
      this.advancedTexture?.removeControl(target.label);
    }

    this.targets.delete(targetId);
    console.log(`[IKTargetGizmoManager] Removed target: ${targetId}`);
  }

  /**
   * Remove all targets
   */
  clearAll(): void {
    const targetIds = Array.from(this.targets.keys());
    targetIds.forEach(id => this.removeTarget(id));
    console.log('[IKTargetGizmoManager] Cleared all targets');
  }

  /**
   * Get color for a kinematic chain
   */
  private getChainColor(chainName: string): BABYLON.Color3 {
    // Try exact match first
    if (CHAIN_COLORS[chainName]) {
      return CHAIN_COLORS[chainName];
    }

    // Try partial match (e.g., "H1_left_arm" matches "left_arm")
    for (const [key, color] of Object.entries(CHAIN_COLORS)) {
      if (chainName.toLowerCase().includes(key.toLowerCase())) {
        return color;
      }
    }

    // Fallback to default
    return CHAIN_COLORS['default'];
  }

  /**
   * Apply color-coding to gizmo axes
   * Uses standard axis colors (Red=X, Green=Y, Blue=Z) for visual consistency
   */
  private applyGizmoColors(gizmo: BABYLON.PositionGizmo, _baseColor: BABYLON.Color3): void {
    // Apply standard axis colors - X=Red, Y=Green, Z=Blue
    // The Babylon.js gizmo already uses these colors by default
    // We just need to ensure they're properly configured
    
    // X axis - red
    if (gizmo.xGizmo.coloredMaterial) {
      gizmo.xGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red
    }

    // Y axis - green
    if (gizmo.yGizmo.coloredMaterial) {
      gizmo.yGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green
    }

    // Z axis - blue
    if (gizmo.zGizmo.coloredMaterial) {
      gizmo.zGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0, 0, 1); // Blue
    }
  }

  /**
   * Apply color-coding to rotation gizmo rings
   * Uses standard axis colors (Red=X, Green=Y, Blue=Z)
   */
  private applyRotationGizmoColors(gizmo: BABYLON.RotationGizmo): void {
    // The rotation gizmo already uses standard colors (Red/Green/Blue for X/Y/Z rings)
    // Babylon.js handles this automatically, so we don't need to manually set colors
    // The distinctive visual comes from the ring shape itself
    
    // Optional: Access the internal meshes to adjust colors if needed
    // This is a workaround to access the rotation gizmo's internal structure
    try {
      const utilityLayer = (gizmo as any).layerUtilityLayerRenderer;
      if (utilityLayer && utilityLayer.utilityLayerScene) {
        const meshes = utilityLayer.utilityLayerScene.meshes;
        meshes.forEach((mesh: BABYLON.AbstractMesh) => {
          if (mesh.material && mesh.material instanceof BABYLON.StandardMaterial) {
            const material = mesh.material as BABYLON.StandardMaterial;
            // Apply standard axis colors based on mesh name
            if (mesh.name.includes('RotationGizmo') || mesh.name.includes('xCircle')) {
              material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red for X
            } else if (mesh.name.includes('yCircle')) {
              material.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green for Y
            } else if (mesh.name.includes('zCircle')) {
              material.diffuseColor = new BABYLON.Color3(0, 0, 1); // Blue for Z
            }
          }
        });
      }
    } catch (error) {
      // If we can't access the internal structure, use default colors
      console.log('[IKTargetGizmoManager] Using default rotation gizmo colors');
    }
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.clearAll();
    this.gizmoManager?.dispose();
    this.advancedTexture?.dispose();
    this.scene = null;
    this.gizmoManager = null;
    this.advancedTexture = null;
    console.log('[IKTargetGizmoManager] Disposed');
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.scene !== null;
  }
}
