/**
 * IK Target Gizmo Manager
 * Owner: George (Agent 1)
 * Manages 3D position gizmos for FullBody IK targets
 */

import * as BABYLON from '@babylonjs/core';

export interface IKTargetGizmoConfig {
  targetId: string; // Unique ID for this target
  chainName: string; // Which kinematic chain this targets
  position: BABYLON.Vector3;
  enabled: boolean;
  onPositionChange: (targetId: string, position: BABYLON.Vector3) => void;
}

interface TargetGizmoData {
  gizmo: BABYLON.PositionGizmo;
  marker: BABYLON.Mesh; // Visual sphere at target position
  label: BABYLON.GUI.TextBlock | null; // 3D label showing chain name
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
  private advancedTexture: BABYLON.GUI.AdvancedDynamicTexture | null = null;

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
    this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('IKTargetUI', true, scene);
    
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

    // Create visual marker (sphere)
    const marker = BABYLON.MeshBuilder.CreateSphere(
      `ikTargetMarker_${config.targetId}`,
      { diameter: 0.12 }, // Slightly larger for better visibility
      this.scene
    );
    marker.parent = transformNode;
    marker.isPickable = false; // Don't interfere with gizmo picking

    // Get color for this chain
    const chainColor = this.getChainColor(config.chainName);
    
    // Create material for marker
    const material = new BABYLON.StandardMaterial(`ikTargetMat_${config.targetId}`, this.scene);
    material.diffuseColor = chainColor;
    material.emissiveColor = chainColor.scale(0.6); // Stronger glow
    material.alpha = config.enabled ? 0.85 : 0.3;
    material.specularColor = chainColor.scale(0.3);
    marker.material = material;

    // Add wireframe overlay for better depth perception
    const wireframe = marker.clone(`ikTargetWireframe_${config.targetId}`);
    wireframe.parent = marker;
    wireframe.scaling = new BABYLON.Vector3(1.05, 1.05, 1.05); // Slightly larger
    const wireframeMat = new BABYLON.StandardMaterial(`ikTargetWireframeMat_${config.targetId}`, this.scene);
    wireframeMat.wireframe = true;
    wireframeMat.emissiveColor = chainColor.scale(0.8);
    wireframeMat.alpha = config.enabled ? 0.6 : 0.2;
    wireframe.material = wireframeMat;

    // Create position gizmo
    const gizmo = new BABYLON.PositionGizmo(new BABYLON.UtilityLayerRenderer(this.scene));
    gizmo.attachedNode = transformNode;
    gizmo.updateGizmoRotationToMatchAttachedNode = false;
    gizmo.scaleRatio = 1.2;
    
    // Color-code gizmo axes
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

    // Create 2D label showing chain name
    let label: BABYLON.GUI.TextBlock | null = null;
    if (this.advancedTexture && config.chainName) {
      label = new BABYLON.GUI.TextBlock();
      label.text = config.chainName;
      label.color = 'white';
      label.fontSize = 14;
      label.fontWeight = 'bold';
      label.outlineWidth = 2;
      label.outlineColor = 'black';
      label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      label.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      
      // Link to 3D position (appears above marker)
      label.linkWithMesh(marker);
      label.linkOffsetY = -30; // Pixels above the marker
      
      this.advancedTexture.addControl(label);
    }

    // Store target data
    this.targets.set(config.targetId, {
      gizmo,
      marker,
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
    console.log(`[IKTargetGizmoManager] Updated position: ${targetId} → (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
  }

  /**
   * Update target enabled state (visibility)
   */
  updateTargetEnabled(targetId: string, enabled: boolean): void {
    const target = this.targets.get(targetId);
    if (!target) return;

    // Update marker opacity
    if (target.marker.material instanceof BABYLON.StandardMaterial) {
      target.marker.material.alpha = enabled ? 0.8 : 0.3;
      target.marker.material.emissiveColor = enabled 
        ? target.marker.material.diffuseColor.scale(0.5)
        : BABYLON.Color3.Black();
    }

    // Show/hide gizmo
    target.gizmo.attachedNode = enabled ? target.transformNode : null;
    
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

    // Dispose gizmo
    target.gizmo.dispose();

    // Dispose marker and its children (including wireframe)
    target.marker.getChildren().forEach(child => {
      if (child instanceof BABYLON.Mesh) {
        child.dispose();
      }
    });
    target.marker.dispose();

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
   */
  private applyGizmoColors(gizmo: BABYLON.PositionGizmo, baseColor: BABYLON.Color3): void {
    // X axis - red tint
    if (gizmo.xGizmo.coloredMaterial) {
      const xColor = baseColor.clone().add(new BABYLON.Color3(0.3, -0.1, -0.1));
      gizmo.xGizmo.coloredMaterial.diffuseColor = xColor;
    }

    // Y axis - green tint
    if (gizmo.yGizmo.coloredMaterial) {
      const yColor = baseColor.clone().add(new BABYLON.Color3(-0.1, 0.3, -0.1));
      gizmo.yGizmo.coloredMaterial.diffuseColor = yColor;
    }

    // Z axis - blue tint
    if (gizmo.zGizmo.coloredMaterial) {
      const zColor = baseColor.clone().add(new BABYLON.Color3(-0.1, -0.1, 0.3));
      gizmo.zGizmo.coloredMaterial.diffuseColor = zColor;
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
