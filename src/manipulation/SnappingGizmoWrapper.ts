// Snapping Gizmo Wrapper - Integrates snapping with Babylon.js gizmos
// Owner: George
// Provides real-time snapping during gizmo manipulation

import * as BABYLON from '@babylonjs/core';
import { SnappingHelper, SnapSettings } from './SnappingHelper';

export class SnappingGizmoWrapper {
  private gizmoManager: BABYLON.GizmoManager;
  private snappingHelper: SnappingHelper;
  private snapSettings: SnapSettings;
  private scene: BABYLON.Scene;
  private isDragging: boolean = false;
  private originalPosition: BABYLON.Vector3 | null = null;
  private currentMesh: BABYLON.Mesh | null = null;
  private currentTransformNode: BABYLON.TransformNode | null = null;

  constructor(scene: BABYLON.Scene, gizmoManager: BABYLON.GizmoManager) {
    this.scene = scene;
    this.gizmoManager = gizmoManager;
    this.snappingHelper = SnappingHelper.getInstance();
    this.snapSettings = {
      enabled: false,
      snapToGrid: true,
      snapToVertex: true,
      snapToEdge: true,
      snapToFace: true,
      snapToCenter: true,
      snapToObject: true,
      snapToMidpoint: false,
      snapToIntersection: false,
      snapToPerpendicular: false,
      snapToTangent: false,
      snapAlong: false,
      snapToNormal: false,
      snapToPlane: false,
      snapToAxis: false,
      snapToCurve: false,
      snapToSurface: false,
      snapObjectToVertex: false,
      snapPointOnEdge: false,
      snapBBoxCorner: false,
      gridSize: 100,
      snapDistance: 10,
    };

    this.setupGizmoEvents();
  }

  private setupGizmoEvents(): void {
    // Hook into gizmo events - check if observables exist
    if ((this.gizmoManager as any).onAttachedToMeshObservable) {
      (this.gizmoManager as any).onAttachedToMeshObservable.add((mesh: BABYLON.Mesh) => {
        this.currentMesh = mesh;
        this.currentTransformNode = null;
      });
    }

    if ((this.gizmoManager as any).onAttachedToNodeObservable) {
      (this.gizmoManager as any).onAttachedToNodeObservable.add((node: BABYLON.TransformNode) => {
        this.currentTransformNode = node;
        this.currentMesh = null;
      });
    }

    // Note: We don't need to monitor pointer events here as the gizmo manager
    // handles drag detection internally. The snapping will be applied during
    // the render loop when objects are being transformed.

    // Monitor for continuous updates during drag
    this.scene.onBeforeRenderObservable.add(() => {
      if (this.isDragging && this.snapSettings.enabled) {
        this.updateSnapping();
      }
    });
  }

  private updateSnapping(): void {
    if (!this.originalPosition) return;

    let currentPosition: BABYLON.Vector3;
    let target: BABYLON.Mesh | BABYLON.TransformNode | null = null;

    if (this.currentMesh) {
      currentPosition = this.currentMesh.position;
      target = this.currentMesh;
    } else if (this.currentTransformNode) {
      currentPosition = this.currentTransformNode.position;
      target = this.currentTransformNode;
    } else {
      return;
    }

    // Get exclude mesh IDs (exclude the currently selected object)
    const excludeMeshIds = target ? [target.uniqueId.toString()] : [];

    // Try to snap the current position
    const snapResult = this.snappingHelper.snapPosition(
      currentPosition,
      this.snapSettings,
      excludeMeshIds
    );

    if (snapResult.snapped) {
      // Apply the snapped position
      if (this.currentMesh) {
        this.currentMesh.position.copyFrom(snapResult.position);
      } else if (this.currentTransformNode) {
        this.currentTransformNode.position.copyFrom(snapResult.position);
      }

      // Show visual feedback
      if (snapResult.visualFeedback && snapResult.visualFeedback.length > 0) {
        const color = this.getSnapColor(snapResult.snapType);
        this.snappingHelper.showSnapIndicator(snapResult.visualFeedback[0], color);
      }
    } else {
      // Clear indicators if no snap
      this.snappingHelper.clearSnapIndicators();
    }
  }

  private getSnapColor(snapType?: string): BABYLON.Color3 {
    switch (snapType) {
      case 'grid':
        return new BABYLON.Color3(0.5, 0.5, 0.5); // Gray
      case 'vertex':
        return new BABYLON.Color3(0, 1, 0); // Green
      case 'edge':
        return new BABYLON.Color3(0, 0.5, 1); // Blue
      case 'face':
        return new BABYLON.Color3(1, 0.5, 0); // Orange
      case 'center':
        return new BABYLON.Color3(1, 1, 0); // Yellow
      case 'object':
        return new BABYLON.Color3(1, 0, 1); // Magenta
      default:
        return new BABYLON.Color3(1, 1, 1); // White
    }
  }

  /**
   * Update snap settings
   */
  updateSnapSettings(settings: Partial<SnapSettings>): void {
    this.snapSettings = { ...this.snapSettings, ...settings };
  }

  /**
   * Enable/disable snapping
   */
  setSnappingEnabled(enabled: boolean): void {
    this.snapSettings.enabled = enabled;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.snappingHelper.clearSnapIndicators();
  }
}
