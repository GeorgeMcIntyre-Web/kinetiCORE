// Transform Gizmo - 3D manipulation tool
// Owners: Cole + Edwin
// Provides translate, rotate, scale gizmos for selected objects

import * as BABYLON from '@babylonjs/core';
import { TransformMode } from '../core/types';
import { SnapSettings } from './SnappingHelper';
import { SnappingGizmoWrapper } from './SnappingGizmoWrapper';

/**
 * TransformGizmo provides interactive 3D manipulation tools
 */
export class TransformGizmo {
  private gizmoManager: BABYLON.GizmoManager | null = null;
  private scene: BABYLON.Scene;
  private currentMode: TransformMode = 'translate';
  private snappingWrapper: SnappingGizmoWrapper | null = null;
  private axisLabels: BABYLON.Mesh[] = []; // Store axis label meshes

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.initialize();
  }

  private initialize(): void {
    // Create gizmo manager
    this.gizmoManager = new BABYLON.GizmoManager(this.scene);
    this.gizmoManager.usePointerToAttachGizmos = false;

    // Set gizmo scale to 30% larger than default (0.5 * 1.3 = 0.65)
    if (this.gizmoManager.gizmos.positionGizmo) {
      this.gizmoManager.gizmos.positionGizmo.scaleRatio = 0.65;
    }
    if (this.gizmoManager.gizmos.rotationGizmo) {
      this.gizmoManager.gizmos.rotationGizmo.scaleRatio = 0.65;
    }
    if (this.gizmoManager.gizmos.scaleGizmo) {
      this.gizmoManager.gizmos.scaleGizmo.scaleRatio = 0.65;
    }

    // Initialize snapping wrapper for real-time snapping
    this.snappingWrapper = new SnappingGizmoWrapper(this.scene, this.gizmoManager);

    // Set initial mode (disabled by default)
    this.setMode('translate');
    // Disable gizmos by default
    this.gizmoManager.positionGizmoEnabled = false;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;

    // Add drag end handlers to update Inspector when gizmo moves objects
    this.setupGizmoHandlers();
  }

  /**
   * Set the transform mode (translate, rotate, scale, or combined)
   */
  setMode(mode: TransformMode | 'combined'): void {
    if (!this.gizmoManager) return;

    this.currentMode = mode === 'combined' ? 'translate' : mode;

    // Disable all gizmos first
    this.gizmoManager.positionGizmoEnabled = false;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;

    // Enable the selected gizmo(s)
    switch (mode) {
      case 'translate':
        this.gizmoManager.positionGizmoEnabled = true;
        if (this.gizmoManager.gizmos.positionGizmo) {
          this.gizmoManager.gizmos.positionGizmo.scaleRatio = 0.65;
        }
        break;
      case 'rotate':
        this.gizmoManager.rotationGizmoEnabled = true;
        if (this.gizmoManager.gizmos.rotationGizmo) {
          this.gizmoManager.gizmos.rotationGizmo.scaleRatio = 0.65;
        }
        break;
      case 'scale':
        this.gizmoManager.scaleGizmoEnabled = true;
        if (this.gizmoManager.gizmos.scaleGizmo) {
          this.gizmoManager.gizmos.scaleGizmo.scaleRatio = 0.65;
        }
        break;
      case 'combined':
        // Show both translation and rotation gizmos
        this.gizmoManager.positionGizmoEnabled = true;
        this.gizmoManager.rotationGizmoEnabled = true;
        if (this.gizmoManager.gizmos.positionGizmo) {
          this.gizmoManager.gizmos.positionGizmo.scaleRatio = 0.65;
        }
        if (this.gizmoManager.gizmos.rotationGizmo) {
          this.gizmoManager.gizmos.rotationGizmo.scaleRatio = 0.65;
        }
        break;
    }
  }

  /**
   * Attach gizmo to a mesh
   */
  attachToMesh(mesh: BABYLON.Mesh | null): void {
    if (!this.gizmoManager) return;

    // Remove existing labels
    this.removeAxisLabels();

    if (mesh) {
      this.gizmoManager.attachToMesh(mesh);
      // Add axis labels after attachment
      this.addAxisLabels(mesh);
    } else {
      this.gizmoManager.attachToMesh(null);
    }
  }

  /**
   * Attach gizmo to a transform node (for device entities)
   */
  attachToNode(node: BABYLON.TransformNode | null): void {
    if (!this.gizmoManager) return;

    // Remove existing labels
    this.removeAxisLabels();

    if (node) {
      this.gizmoManager.attachToNode(node);
      // Add axis labels after attachment
      this.addAxisLabels(node);
    } else {
      this.gizmoManager.attachToNode(null);
    }
  }

  /**
   * Get current mode
   */
  getMode(): TransformMode {
    return this.currentMode;
  }

  /**
   * Set up drag end handlers to notify editorStore when transforms change
   */
  private setupGizmoHandlers(): void {
    if (!this.gizmoManager) return;

    // Position gizmo drag end
    this.gizmoManager.gizmos.positionGizmo?.onDragEndObservable.add(() => {
      this.notifyTransformChange();
    });

    // Rotation gizmo drag end
    this.gizmoManager.gizmos.rotationGizmo?.onDragEndObservable.add(() => {
      this.notifyTransformChange();
    });

    // Scale gizmo drag end
    this.gizmoManager.gizmos.scaleGizmo?.onDragEndObservable.add(() => {
      this.notifyTransformChange();
    });
  }

  /**
   * Notify editorStore that a transform has changed (updates Inspector)
   */
  private notifyTransformChange(): void {
    // Trigger a scene tree update event to refresh Inspector
    window.dispatchEvent(new Event('scenetree-update'));
  }

  /**
   * Enable/disable gizmo
   */
  setEnabled(enabled: boolean): void {
    if (!this.gizmoManager) return;

    if (enabled) {
      this.setMode(this.currentMode);
    } else {
      this.gizmoManager.positionGizmoEnabled = false;
      this.gizmoManager.rotationGizmoEnabled = false;
      this.gizmoManager.scaleGizmoEnabled = false;
    }
  }

  /**
   * Update snap settings
   */
  updateSnapSettings(settings: Partial<SnapSettings>): void {
    if (this.snappingWrapper) {
      this.snappingWrapper.updateSnapSettings(settings);
    }
  }

  /**
   * Enable/disable snapping
   */
  setSnappingEnabled(enabled: boolean): void {
    if (this.snappingWrapper) {
      this.snappingWrapper.setSnappingEnabled(enabled);
    }
  }

  /**
   * Add X, Y, Z text labels at the end of gizmo axes
   * Uses same font and colors as the corner transform display
   */
  private addAxisLabels(attachedNode: BABYLON.Mesh | BABYLON.TransformNode): void {
    if (!this.gizmoManager?.gizmos.positionGizmo) return;

    const gizmo = this.gizmoManager.gizmos.positionGizmo;
    const scaleRatio = gizmo.scaleRatio || 0.65;
    const axisLength = scaleRatio * 0.5;

    // Use a bold, readable font that will pop on screen
    const fontFamily = '"Arial Black", "Arial Bold", "Roboto Bold", Arial, Helvetica, sans-serif';
    const fontSize = 16; // Larger for better readability
    const fontWeight = '900'; // Ultra-bold for maximum visibility
    
    // Colors matching corner display (bright for visibility)
    const colors = {
      x: new BABYLON.Color3(0.29, 0.56, 0.89), // #4A90E2 (blue)
      y: new BABYLON.Color3(0.49, 0.83, 0.13), // #7ED321 (green)
      z: new BABYLON.Color3(0.82, 0.01, 0.11), // #D0021B (red)
    };

    // Position labels very close to arrow tip (98% of axis length)
    const adjustedAxisLength = axisLength * 0.98;

    // Create label helper
    const createLabel = (text: string, color: BABYLON.Color3, offset: BABYLON.Vector3, name: string) => {
      const textureSize = 128; // Larger texture for better quality
      const texture = new BABYLON.DynamicTexture(
        `transform_label_${name}`,
        { width: textureSize, height: textureSize },
        this.scene,
        false
      );
      
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      
      // Ensure canvas has proper alpha channel support
      // First, clear everything to fully transparent
      ctx.clearRect(0, 0, textureSize, textureSize);
      
      // Create transparent background by drawing nothing (already transparent by default)
      
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const x = textureSize / 2;
      const y = textureSize / 2;
      
      // Save context state
      ctx.save();
      
      // Draw text with white outline for maximum readability (stroke first, then fill)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; // White outline with high opacity
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; // Also set fill for stroke
      ctx.lineWidth = 4; // Thicker outline for better visibility
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(text, x, y);
      
      // Draw text fill in axis color (on top of outline)
      ctx.fillStyle = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 1.0)`;
      ctx.fillText(text, x, y);
      
      // Restore context
      ctx.restore();
      
      // Force update with alpha channel - this ensures transparency is preserved
      texture.update(true);
      
      const plane = BABYLON.MeshBuilder.CreatePlane(`transform_label_plane_${name}`, { size: 0.025 }, this.scene);
      
      // Position relative to attached node's world position (use adjusted length)
      const adjustedOffset = offset.normalize().scale(adjustedAxisLength);
      const worldMatrix = attachedNode.getWorldMatrix();
      const worldPos = BABYLON.Vector3.TransformCoordinates(adjustedOffset, worldMatrix);
      plane.position = worldPos;
      plane.parent = attachedNode;
      
      const material = new BABYLON.StandardMaterial(`transform_label_mat_${name}`, this.scene);
      
      // Configure texture for proper alpha channel
      if (texture) {
        texture.hasAlpha = true; // Explicitly enable alpha channel on texture
      }
      
      material.diffuseTexture = texture;
      material.emissiveTexture = texture;
      material.disableLighting = true;
      // Enable alpha channel from texture for full transparency
      material.useAlphaFromDiffuseTexture = true;
      material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; // Enable alpha blending
      material.alpha = 1.0; // Full opacity (transparency comes from texture alpha channel)
      material.separateCullingPass = false;
      material.backFaceCulling = false;
      material.sideOrientation = BABYLON.Mesh.DOUBLESIDE; // Show from both sides
      
      plane.material = material;
      plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      
      this.axisLabels.push(plane);
    };

    // Create labels at end of each axis (using unit vectors, adjusted length applied in createLabel)
    createLabel('X', colors.x, new BABYLON.Vector3(1, 0, 0), 'x');
    createLabel('Y', colors.y, new BABYLON.Vector3(0, 1, 0), 'y');
    createLabel('Z', colors.z, new BABYLON.Vector3(0, 0, 1), 'z');
  }

  /**
   * Remove axis labels
   */
  private removeAxisLabels(): void {
    this.axisLabels.forEach(label => {
      if (label.material) {
        const texture = (label.material as BABYLON.StandardMaterial).diffuseTexture;
        if (texture) texture.dispose();
        label.material.dispose();
      }
      label.dispose();
    });
    this.axisLabels = [];
  }

  /**
   * Dispose gizmo manager
   */
  dispose(): void {
    this.removeAxisLabels();
    // TODO: Re-enable when snapping wrapper is fixed
    // this.snappingWrapper?.dispose();
    this.gizmoManager?.dispose();
    this.gizmoManager = null;
    // this.snappingWrapper = null;
  }
}
