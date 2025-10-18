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

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.initialize();
  }

  private initialize(): void {
    // Create gizmo manager
    this.gizmoManager = new BABYLON.GizmoManager(this.scene);
    this.gizmoManager.usePointerToAttachGizmos = false;

    // Initialize snapping wrapper for real-time snapping
    this.snappingWrapper = new SnappingGizmoWrapper(this.scene, this.gizmoManager);

    // Set initial mode
    this.setMode('translate');

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
   * Dispose gizmo manager
   */
  dispose(): void {
    // TODO: Re-enable when snapping wrapper is fixed
    // this.snappingWrapper?.dispose();
    this.gizmoManager?.dispose();
    this.gizmoManager = null;
    // this.snappingWrapper = null;
  }
}
