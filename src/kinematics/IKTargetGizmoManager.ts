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
    // Position gizmo must match TCP rotation to align with coordinate axes
    gizmo.updateGizmoRotationToMatchAttachedMesh = true;
    gizmo.scaleRatio = 0.5; // Half size for less visual clutter
    
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
      // Rotation gizmo MUST follow TCP rotation to show correct orientation
      rotationGizmo.updateGizmoRotationToMatchAttachedMesh = true;
      rotationGizmo.scaleRatio = 0.5; // Half size for less visual clutter
      
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

    // Skip marker creation - using text labels on gizmo axes instead
    // No visual marker - just use the gizmo itself with axis labels
    const label: GUI.TextBlock | null = null;

    // Store target data
    this.targets.set(config.targetId, {
      gizmo,
      rotationGizmo,
      marker: null, // No marker - using axis text labels instead
      label,
      transformNode,
      config,
    });
    
    // Add X, Y, Z text labels at the end of gizmo axes
    this.addGizmoAxisLabels(gizmo, transformNode, config.targetId);

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
    
    // Force gizmo to update by refreshing attachment
    // This ensures the gizmo follows the transform node position
    if (target.gizmo) {
      const tempNode = target.gizmo.attachedNode;
      target.gizmo.attachedNode = null;
      target.gizmo.attachedNode = tempNode;
    }
    if (target.rotationGizmo) {
      const tempRotNode = target.rotationGizmo.attachedNode;
      target.rotationGizmo.attachedNode = null;
      target.rotationGizmo.attachedNode = tempRotNode;
    }
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

    // CRITICAL: Force both gizmos to update by reattaching to the node
    // This ensures the rotation gizmo reflects the new orientation
    if (target.gizmo) {
      const tempPos = target.gizmo.attachedNode;
      target.gizmo.attachedNode = null;
      target.gizmo.attachedNode = tempPos;
    }
    if (target.rotationGizmo) {
      const tempRot = target.rotationGizmo.attachedNode;
      target.rotationGizmo.attachedNode = null;
      target.rotationGizmo.attachedNode = tempRot;
    }
  }

  /**
   * Update target enabled state (visibility)
   */
  updateTargetEnabled(targetId: string, enabled: boolean): void {
    const target = this.targets.get(targetId);
    if (!target) return;

    // Update marker (flange ring) opacity
    if (target.marker && target.marker.material instanceof BABYLON.StandardMaterial) {
      target.marker.material.alpha = enabled ? 0.7 : 0.2;
      target.marker.material.emissiveColor = enabled 
        ? target.marker.material.diffuseColor.scale(0.5)
        : BABYLON.Color3.Black();
      target.marker.setEnabled(enabled);
    }
    
    // Update flange disc opacity
    const disc = this.scene?.getMeshByName(`flange_disc_${targetId}`);
    if (disc && disc.material instanceof BABYLON.StandardMaterial) {
      disc.material.alpha = enabled ? 0.5 : 0.15;
      disc.setEnabled(enabled);
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
    
      // Clean up axis label planes
    ['x', 'y', 'z'].forEach(axis => {
      const labelPlane = this.scene?.getMeshByName(`label_plane_${axis}_${targetId}`);
      if (labelPlane) {
        // Clean up rotation observer
        if ((labelPlane as any)._rotationObserver) {
          (labelPlane as any)._rotationObserver.remove();
        }
        labelPlane.dispose();
      }
      const labelTexture = this.scene?.getTextureByName(`label_${axis}_${targetId}`);
      if (labelTexture) {
        labelTexture.dispose();
      }
      const labelMaterial = this.scene?.getMaterialByName(`label_mat_${axis}_${targetId}`);
      if (labelMaterial) {
        labelMaterial.dispose();
      }
    });

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
   * Add X, Y, Z text labels at the end of gizmo axes
   * Uses same font and colors as the corner transform display
   */
  private addGizmoAxisLabels(
    gizmo: BABYLON.PositionGizmo,
    transformNode: BABYLON.TransformNode,
    targetId: string
  ): void {
    if (!this.scene) return;

    // Use clear, bold sans-serif font matching the corner display (NOT Impact - too condensed)
    const fontFamily = '"Arial Black", "Roboto Bold", "Helvetica Bold", Arial, Helvetica, sans-serif';
    const fontSize = 64; // Large for visibility
    const fontWeight = '900'; // Ultra-bold
    
    // Color matching PositionGizmo: X=red, Y=green, Z=blue (standard Babylon.js convention)
    const colors = {
      x: new BABYLON.Color3(0.82, 0.01, 0.11), // #D0021B (red) - matches red X-axis arrow
      y: new BABYLON.Color3(0.49, 0.83, 0.13), // #7ED321 (green) - matches green Y-axis arrow
      z: new BABYLON.Color3(0.29, 0.56, 0.89), // #4A90E2 (blue) - matches blue Z-axis arrow
    };

    // Position labels using a deferred approach - wait for gizmo to fully initialize
    // PositionGizmo default arrow length is 0.5 units, scaled by scaleRatio
    // The arrows consist of a shaft (cylinder) and a head (cone) at the tip
    const scaleRatio = gizmo.scaleRatio || 0.5;
    const defaultArrowLength = 0.5; // PositionGizmo default
    const arrowLength = defaultArrowLength * scaleRatio;
    
    // DEBUG: Log the calculated values
    console.log(`[TCP Gizmo Labels] scaleRatio: ${scaleRatio}, arrowLength: ${arrowLength}`);
    
    // Position labels extremely close to arrow tips - minimal gap
    // Reduced offset to place labels right at arrow tips
    // Use much smaller offset - try 0.005 units (5mm) beyond tip for very close positioning
    const fixedCloseOffset = 0.005; // Fixed small offset in world units (5mm)
    const labelOffset = arrowLength + fixedCloseOffset; // Add small fixed offset instead of percentage
    
    // Access gizmo axes for potential future improvements
    const xGizmo = (gizmo as any).xGizmo;
    const yGizmo = (gizmo as any).yGizmo;
    const zGizmo = (gizmo as any).zGizmo;
    
    // Create text planes for each axis
    const createLabel = (text: string, color: BABYLON.Color3, direction: BABYLON.Vector3, name: string, gizmoAxis: any) => {
      // Use much larger texture for better text quality and crisp rendering
      const textureSize = 1024; // Increased from 512 for better quality
      const texture = new BABYLON.DynamicTexture(`label_${name}_${targetId}`, { width: textureSize, height: textureSize }, this.scene || undefined, false);
      
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      
      // Enable high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.clearRect(0, 0, textureSize, textureSize);
      
      // NO BACKGROUND - transparent background as requested
      
      // Set font with larger size for higher resolution texture
      const scaledFontSize = fontSize * (textureSize / 512); // Scale font size with texture size
      ctx.font = `${fontWeight} ${scaledFontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const x = textureSize / 2;
      const y = textureSize / 2;
      
      ctx.save();
      
      // Draw text with thicker dark outline for better contrast and clarity
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'; // Darker, more opaque outline
      ctx.lineWidth = 6; // Thicker outline for better visibility
      ctx.lineJoin = 'round';
      ctx.miterLimit = 3;
      ctx.strokeText(text, x, y);
      
      // Draw text fill in AXIS COLOR (color inside the letter as requested)
      ctx.fillStyle = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 1.0)`;
      ctx.fillText(text, x, y);
      
      ctx.restore();
      texture.update(true);
      
      // Set initial position immediately based on calculated offset
      // This ensures labels are near arrows from the start, then we refine it
      const initialOffset = direction.scale(labelOffset);
      
      // Create plane mesh with initial position
      const plane = BABYLON.MeshBuilder.CreatePlane(`label_plane_${name}_${targetId}`, { size: 0.18 }, this.scene || undefined);
      plane.parent = transformNode;
      plane.position = initialOffset.clone(); // Set initial position immediately
      
      console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Initial position set:`, plane.position);
      
      // CRITICAL: Lock position updates - we will refine it once, then lock it
      let finalPositionSet = false;
      
      // Find arrow tip and set position ONCE in local space
      const setFinalPosition = () => {
        if (finalPositionSet) {
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Position already locked, skipping update`);
          return; // Already set, don't touch it
        }
        
        console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Finding arrow tip for final position`);
        console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Current position:`, plane.position);
        
        let arrowTipWorldPos: BABYLON.Vector3 | null = null;
        
        // Try to find arrow tip from gizmo axis
        // DEBUG: Verify we have the correct gizmo axis for this label
        if (gizmoAxis) {
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - gizmoAxis name:`, (gizmoAxis as any)?.name || 'unknown');
        }
        
        if (gizmoAxis && (gizmoAxis as any).dragMesh) {
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Checking dragMesh for arrow tip`);
          const dragMesh = (gizmoAxis as any).dragMesh as BABYLON.Mesh;
          if (dragMesh.getChildMeshes) {
            const children = dragMesh.getChildMeshes();
            console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - dragMesh has ${children.length} children`);
            if (children.length > 0) {
              const arrowhead = children.find((child: BABYLON.AbstractMesh) => {
                return child.name && (child.name.includes('cone') || child.name.includes('arrow') || child.name.includes('head'));
              }) || children[children.length - 1];
              
              if (arrowhead instanceof BABYLON.Mesh) {
                arrowhead.computeWorldMatrix(true);
                arrowTipWorldPos = arrowhead.getAbsolutePosition();
                console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Found arrowhead at world pos:`, arrowTipWorldPos);
              }
            }
            
            if (!arrowTipWorldPos && dragMesh) {
              dragMesh.computeWorldMatrix(true);
              const bbox = dragMesh.getBoundingInfo();
              const meshLength = bbox.boundingBox.maximumWorld.subtract(bbox.boundingBox.minimumWorld).length();
              // Get the end point along the direction
              const worldMatrix = dragMesh.getWorldMatrix();
              const directionWorld = BABYLON.Vector3.TransformNormal(direction, worldMatrix);
              const centerWorld = dragMesh.getAbsolutePosition();
              arrowTipWorldPos = centerWorld.add(directionWorld.normalize().scale(meshLength / 2));
              console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Using dragMesh bounding box tip:`, arrowTipWorldPos);
            }
          }
        } else {
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - No dragMesh found, using fallback`);
        }
        
        // Fallback to calculated position (more accurate than initial)
        if (!arrowTipWorldPos) {
          transformNode.computeWorldMatrix(true);
          const transformWorldPos = transformNode.getAbsolutePosition();
          const directionWorld = BABYLON.Vector3.TransformNormal(direction, transformNode.getWorldMatrix());
          // Use the actual calculated offset distance
          arrowTipWorldPos = transformWorldPos.add(directionWorld.normalize().scale(labelOffset));
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Using calculated fallback position:`, arrowTipWorldPos);
        }
        
        if (arrowTipWorldPos) {
          // Convert world position to LOCAL space relative to transformNode
          transformNode.computeWorldMatrix(true);
          const worldMatrixInv = transformNode.getWorldMatrix().clone();
          worldMatrixInv.invert();
          const arrowTipLocal = BABYLON.Vector3.TransformCoordinates(arrowTipWorldPos, worldMatrixInv);
          
          const localDistance = arrowTipLocal.length();
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Arrow tip local space:`, arrowTipLocal, `distance: ${localDistance.toFixed(4)}`);
          
          // Check if the local distance is reasonable (should be around 0.25-0.26)
          // If it's way off (like 1.0+ or 0.0), fallback to simple calculation
          const expectedDistance = labelOffset; // ~0.255
          const tolerance = 0.1; // 10cm tolerance
          
          let finalPos: BABYLON.Vector3;
          
          if (Math.abs(localDistance - expectedDistance) > tolerance || localDistance < 0.01) {
            // Distance calculation seems wrong, use simple calculated offset
            console.warn(`[TCP Gizmo Labels] ${name.toUpperCase()} - Local distance ${localDistance.toFixed(4)} out of range (expected ~${expectedDistance.toFixed(4)}), using simple calculation`);
            const tinyOffset = 0.001; // 1mm
            finalPos = direction.scale(expectedDistance + tinyOffset);
            console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Using simple calculation:`, finalPos, `distance: ${finalPos.length().toFixed(4)}`);
          } else {
            // Distance looks reasonable, use it with tiny offset
            const tinyOffset = 0.001; // 1mm
            if (localDistance > 0.01) {
              const offsetDir = arrowTipLocal.clone().normalize();
              finalPos = offsetDir.scale(localDistance + tinyOffset);
              console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Using measured distance:`, finalPos, `distance: ${finalPos.length().toFixed(4)}`);
            } else {
              // Fallback if normalization fails
              finalPos = direction.scale(expectedDistance + tinyOffset);
              console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Normalization failed, using simple calculation`);
            }
          }
          
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Final position (local):`, finalPos, `distance: ${finalPos.length().toFixed(4)}`);
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Position before update:`, plane.position);
          
          // REFINE POSITION - directly update the position vector components
          plane.position.x = finalPos.x;
          plane.position.y = finalPos.y;
          plane.position.z = finalPos.z;
          
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Position after direct update:`, plane.position);
          
          finalPositionSet = true;
          
          // NOW lock position property - prevent any further changes after this refinement
          const lockedPosRef = finalPos.clone();
          
          // Override position setter/getter to prevent changes
          try {
            Object.defineProperty(plane, 'position', {
              get: function() { 
                return lockedPosRef.clone();
              },
              set: function(_value) {
                // Position is locked - ignore any changes
                console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} - Attempted to change locked position, ignoring`);
                // Don't update _lockedPosition, keep it at lockedPosRef
              },
              configurable: true,
              enumerable: true
            });
          } catch (e) {
            console.warn(`[TCP Gizmo Labels] ${name.toUpperCase()} - Could not lock position property:`, e);
          }

          // Store locked position in a custom property (type-safe)
          (plane as any)._lockedPosition = lockedPosRef.clone();
          console.log(`[TCP Gizmo Labels] ${name.toUpperCase()} ✅ Position REFINED and LOCKED at:`, plane.position);
        } else {
          console.error(`[TCP Gizmo Labels] ${name.toUpperCase()} ❌ Failed to find arrow tip position!`);
        }
      };
      
      // Set position after gizmo initializes - try multiple times if needed
      setTimeout(setFinalPosition, 150);
      setTimeout(setFinalPosition, 300); // Backup attempt
      
      // Create material
      const material = new BABYLON.StandardMaterial(`label_mat_${name}_${targetId}`, this.scene || undefined);
      texture.hasAlpha = true;
      material.diffuseTexture = texture;
      material.emissiveTexture = texture;
      material.disableLighting = true;
      material.useAlphaFromDiffuseTexture = true;
      material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
      material.alpha = 1.0;
      material.backFaceCulling = false;
      material.sideOrientation = BABYLON.Mesh.DOUBLESIDE;
      
      plane.material = material;
      // DISABLE billboard mode completely - it can cause position drift
      // We'll manually update rotation to face camera, but NEVER touch position
      plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
      
      // Manually update rotation each frame to face camera, but NEVER modify position
      if (this.scene) {
        const rotationObserver = this.scene.onBeforeRenderObservable.add(() => {
          if (plane.isDisposed() || !finalPositionSet) return;
          
          const camera = this.scene?.activeCamera;
          if (!camera) return;
          
          // Get plane world position (fixed, never changes)
          plane.computeWorldMatrix(true);
          const planeWorldPos = plane.getAbsolutePosition();
          
          // Calculate rotation to face camera
          const directionToCamera = camera.position.subtract(planeWorldPos);
          if (directionToCamera.lengthSquared() < 0.0001) return;
          
          // Create lookAt rotation matrix
          const forward = directionToCamera.normalize();
          const up = new BABYLON.Vector3(0, 1, 0);
          const right = BABYLON.Vector3.Cross(up, forward).normalize();
          const correctedUp = BABYLON.Vector3.Cross(forward, right).normalize();
          
          // Convert to rotation quaternion
          const rotationMatrix = BABYLON.Matrix.Identity();
          BABYLON.Matrix.FromValuesToRef(
            right.x, right.y, right.z, 0,
            correctedUp.x, correctedUp.y, correctedUp.z, 0,
            forward.x, forward.y, forward.z, 0,
            0, 0, 0, 1,
            rotationMatrix
          );
          
          // Get current position (should be locked)
          const currentPos = plane.position.clone();
          
          // Apply rotation ONLY
          plane.rotationQuaternion = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);
          
          // ENSURE position hasn't changed (defensive check)
          if (!plane.position.equals(currentPos)) {
            console.warn(`[TCP Gizmo Labels] ${name.toUpperCase()} Position was modified! Restoring...`);
            plane.position = currentPos;
          }
        });
        
        // Store observer for cleanup
        (plane as any)._rotationObserver = rotationObserver;
      }
      
      return plane;
    };

    // Create labels at actual arrow tip positions
    // CRITICAL FIX: Based on image, labels are rotated by one position:
    // - Red arrow shows "Y" label → Should show "X" label (red text on red arrow)
    // - Green arrow shows "Z" label → Should show "Y" label (green text on green arrow)  
    // - Blue arrow shows "X" label → Should show "Z" label (blue text on blue arrow)
    //
    // The issue: Labels are being placed on the wrong gizmo axes.
    // Current (WRONG): X→xGizmo, Y→yGizmo, Z→zGizmo
    // But visual shows: X label on zGizmo, Y label on xGizmo, Z label on yGizmo
    //
    // Fix: Rotate the gizmo assignments one position clockwise to match:
    // X label (red) should go on red arrow, but currently Y label is there
    // So we need: X→?, Y→xGizmo (red), Z→yGizmo (green), X→zGizmo (blue)
    // This means: Y→xGizmo, Z→yGizmo, X→zGizmo (rotate labels backwards)
    
    // Actually: If red arrow (xGizmo) shows "Y", that means Y label went to xGizmo
    // So current mapping is: Y→xGizmo, Z→yGizmo, X→zGizmo
    // We want: X→xGizmo, Y→yGizmo, Z→zGizmo
    // So we need to rotate labels forward: X→(where X currently is=zGizmo)→xGizmo
    // Pattern: X label goes to where Y currently goes (xGizmo)
    //         Y label goes to where Z currently goes (yGizmo)
    //         Z label goes to where X currently goes (zGizmo)
    
    // Create labels with correct gizmo assignments:
    // xGizmo = red arrow → should have red "X" label
    // yGizmo = green arrow → should have green "Y" label
    // zGizmo = blue arrow → should have blue "Z" label
    createLabel('X', colors.x, new BABYLON.Vector3(1, 0, 0), 'x', xGizmo);  // X (red) on red arrow
    createLabel('Y', colors.y, new BABYLON.Vector3(0, 1, 0), 'y', yGizmo);  // Y (green) on green arrow
    createLabel('Z', colors.z, new BABYLON.Vector3(0, 0, 1), 'z', zGizmo);  // Z (blue) on blue arrow
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
