// Transform Gizmo - 3D manipulation tool
// Owners: Cole + Edwin
// Provides translate, rotate, scale gizmos for selected objects

import * as BABYLON from '@babylonjs/core';
import { TransformMode } from '../core/types';

/**
 * TransformGizmo provides interactive 3D manipulation tools
 */
export class TransformGizmo {
  private gizmoManager: BABYLON.GizmoManager | null = null;
  private scene: BABYLON.Scene;
  private currentMode: TransformMode = 'translate';

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.initialize();
  }

  private initialize(): void {
    // Create gizmo manager
    this.gizmoManager = new BABYLON.GizmoManager(this.scene);
    this.gizmoManager.usePointerToAttachGizmos = false;

    // Set initial mode
    this.setMode('translate');
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
        break;
      case 'rotate':
        this.gizmoManager.rotationGizmoEnabled = true;
        break;
      case 'scale':
        this.gizmoManager.scaleGizmoEnabled = true;
        break;
      case 'combined':
        // Show both translation and rotation gizmos
        this.gizmoManager.positionGizmoEnabled = true;
        this.gizmoManager.rotationGizmoEnabled = true;
        break;
    }
  }

  /**
   * Attach gizmo to a mesh
   */
  attachToMesh(mesh: BABYLON.Mesh | null): void {
    if (!this.gizmoManager) return;

    if (mesh) {
      this.gizmoManager.attachToMesh(mesh);
    } else {
      this.gizmoManager.attachToMesh(null);
    }
  }

  /**
   * Attach gizmo to a transform node (for device entities)
   */
  attachToNode(node: BABYLON.TransformNode | null): void {
    if (!this.gizmoManager) return;

    if (node) {
      this.gizmoManager.attachToNode(node);
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
   * Dispose gizmo manager
   */
  dispose(): void {
    this.gizmoManager?.dispose();
    this.gizmoManager = null;
  }
}
