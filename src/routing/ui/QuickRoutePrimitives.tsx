// QuickRoutePrimitives - Quick primitive creation tools for routing
// Owner: Routing System Team

import { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { useEditorStore } from '../../ui/store/editorStore';

export type PrimitiveType = 'pipe' | 'cable_tray' | 'wire' | 'conduit';

interface PrimitiveCreationState {
  active: boolean;
  type: PrimitiveType | null;
  startPoint: BABYLON.Vector3 | null;
  endPoint: BABYLON.Vector3 | null;
  previewMesh: BABYLON.Mesh | null;
}

/**
 * Quick primitive creation tools for routing
 * Allows users to quickly create primitive geometry (cylinder/box/line) that can be converted to routes
 */
export class QuickRoutePrimitives {
  private scene: BABYLON.Scene;
  private state: PrimitiveCreationState = {
    active: false,
    type: null,
    startPoint: null,
    endPoint: null,
    previewMesh: null,
  };
  private pointerDownHandler: ((evt: PointerEvent) => void) | null = null;
  private keyDownHandler: ((evt: KeyboardEvent) => void) | null = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Start primitive creation mode
   */
  startPrimitiveCreation(type: PrimitiveType): void {
    if (this.state.active) {
      this.cancelPrimitiveCreation();
    }

    this.state = {
      active: true,
      type,
      startPoint: null,
      endPoint: null,
      previewMesh: null,
    };

    this.setupPicking();
    console.log(`[QuickRoutePrimitives] Started ${type} creation mode - Click start point`);
  }

  /**
   * Cancel primitive creation
   */
  cancelPrimitiveCreation(): void {
    this.cleanupPreview();
    this.removeEventListeners();
    this.state = {
      active: false,
      type: null,
      startPoint: null,
      endPoint: null,
      previewMesh: null,
    };
    console.log('[QuickRoutePrimitives] Cancelled primitive creation');
  }

  private pointerMoveHandler: ((evt: PointerEvent) => void) | null = null;
  private renderObserver: BABYLON.Observer<BABYLON.Scene> | null = null;

  /**
   * Setup viewport picking
   */
  private setupPicking(): void {
    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (!canvas) return;

    this.pointerDownHandler = (evt: PointerEvent) => {
      if (evt.button !== 0) return; // Only left click

      const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
      
      if (pickResult?.hit && pickResult.pickedPoint) {
        this.handlePointPick(pickResult.pickedPoint);
        evt.stopPropagation();
        evt.preventDefault();
      }
    };

    this.pointerMoveHandler = () => {
      if (this.state.startPoint && this.state.type) {
        this.updatePreview();
      }
    };

    this.keyDownHandler = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        this.cancelPrimitiveCreation();
        evt.stopPropagation();
        evt.preventDefault();
      }
    };

    // Update preview on mouse move
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.state.startPoint && this.state.type && !this.state.endPoint) {
        this.updatePreview();
      }
    });

    canvas.addEventListener('pointerdown', this.pointerDownHandler);
    canvas.addEventListener('pointermove', this.pointerMoveHandler);
    window.addEventListener('keydown', this.keyDownHandler);
    canvas.style.cursor = 'crosshair';
  }

  /**
   * Handle point picking in viewport
   */
  private handlePointPick(point: BABYLON.Vector3): void {
    if (!this.state.active || !this.state.type) return;

    if (!this.state.startPoint) {
      // First point - set start
      this.state.startPoint = point.clone();
      console.log('[QuickRoutePrimitives] Start point set:', point);
    } else {
      // Second point - create primitive
      this.state.endPoint = point.clone();
      this.createPrimitive();
      this.cancelPrimitiveCreation();
    }
  }

  /**
   * Create primitive geometry based on type
   */
  private createPrimitive(): void {
    if (!this.state.startPoint || !this.state.endPoint || !this.state.type) return;

    const start = this.state.startPoint.clone();
    const end = this.state.endPoint.clone();
    const direction = end.subtract(start);
    const length = direction.length();
    const directionNormalized = direction.normalize();
    const center = start.add(directionNormalized.scale(length * 0.5));

    let mesh: BABYLON.Mesh;

    switch (this.state.type) {
      case 'pipe':
      case 'conduit': {
        // Create cylinder for pipe/conduit
        const diameter = this.state.type === 'pipe' ? 0.04 : 0.05; // 40mm pipe, 50mm conduit
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          `${this.state.type}_${Date.now()}`,
          {
            height: length,
            diameter: diameter,
            tessellation: 32,
          },
          this.scene
        );
        
        // Orient cylinder along direction (Y-up to direction)
        if (length > 0.01) {
          if (Math.abs(directionNormalized.y) < 0.99) {
            const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), directionNormalized);
            const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), directionNormalized));
            if (axis.length() > 0.001) {
              mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
            }
          }
        }
        break;
      }

      case 'cable_tray': {
        // Create box for cable tray
        const width = 0.4; // 400mm width
        const height = 0.1; // 100mm height
        mesh = BABYLON.MeshBuilder.CreateBox(
          `cable_tray_${Date.now()}`,
          {
            width: length,
            height: height,
            depth: width,
          },
          this.scene
        );

        // Orient box along direction
        if (length > 0.01) {
          if (Math.abs(directionNormalized.y) < 0.99) {
            const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), directionNormalized);
            const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), directionNormalized));
            if (axis.length() > 0.001) {
              mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
            }
          }
        }
        break;
      }

      case 'wire': {
        // Create line for wire
        const points = [start, end];
        mesh = BABYLON.MeshBuilder.CreateLines(
          `wire_${Date.now()}`,
          { points },
          this.scene
        );
        // Lines don't need rotation
        break;
      }

      default:
        console.error('[QuickRoutePrimitives] Unknown primitive type:', this.state.type);
        return;
    }

    // Position mesh - for cylinders/boxes, position at start + offset
    if (mesh) {
      if (this.state.type === 'pipe' || this.state.type === 'conduit' || this.state.type === 'cable_tray') {
        // For cylinders and boxes, position at start + half length offset
        const offset = directionNormalized.scale(length * 0.5);
        mesh.position = start.add(offset);
      } else {
        // For lines, position doesn't matter (lines are defined by points)
        mesh.position = center;
      }
      
      // Add metadata for conversion
      mesh.metadata = {
        isQuickPrimitive: true,
        primitiveType: this.state.type,
        startPoint: start,
        endPoint: end,
      };

      // Select the created mesh
      const editorStore = useEditorStore.getState();
      const tree = (window as any).SceneTreeManager?.getInstance?.();
      if (tree) {
        const node = tree.findNodeByMesh(mesh);
        if (node) {
          editorStore.selectNode(node.id);
        }
      }

      console.log(`[QuickRoutePrimitives] ✅ Created ${this.state.type} primitive`);
    }
  }

  /**
   * Update preview mesh
   */
  private updatePreview(): void {
    if (!this.state.startPoint || !this.state.type) return;

    const camera = this.scene.activeCamera;
    if (!camera) return;

    // Create preview at mouse position
    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    if (!pickResult?.hit || !pickResult.pickedPoint) return;

    const end = pickResult.pickedPoint;
    const start = this.state.startPoint;
    const direction = end.subtract(start);
    const length = direction.length();

    if (length < 0.01) return; // Too short

    this.cleanupPreview();

    // Create preview mesh
    let preview: BABYLON.Mesh;
    switch (this.state.type) {
      case 'pipe':
      case 'conduit': {
        const diameter = this.state.type === 'pipe' ? 0.04 : 0.05;
        preview = BABYLON.MeshBuilder.CreateCylinder(
          'quick_preview',
          { height: length, diameter, tessellation: 16 },
          this.scene
        );
        if (direction.length() > 0.01) {
          const normalized = direction.normalize();
          if (Math.abs(normalized.y) < 0.99) {
            const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), normalized);
            const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), normalized));
            if (axis.length() > 0.001) {
              preview.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
            }
          }
        }
        break;
      }
      case 'cable_tray': {
        preview = BABYLON.MeshBuilder.CreateBox(
          'quick_preview',
          { width: length, height: 0.1, depth: 0.4 },
          this.scene
        );
        if (direction.length() > 0.01) {
          const normalized = direction.normalize();
          if (Math.abs(normalized.y) < 0.99) {
            const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), normalized);
            const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), normalized));
            if (axis.length() > 0.001) {
              preview.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
            }
          }
        }
        break;
      }
      case 'wire': {
        preview = BABYLON.MeshBuilder.CreateLines(
          'quick_preview',
          { points: [start, end] },
          this.scene
        );
        break;
      }
      default:
        return;
    }

    if (preview) {
      // Position preview correctly based on type
      if (this.state.type === 'pipe' || this.state.type === 'conduit' || this.state.type === 'cable_tray') {
        const offset = direction.normalize().scale(length * 0.5);
        preview.position = start.add(offset);
      } else {
        preview.position = start.add(direction.scale(0.5));
      }
      
      // Make preview semi-transparent
      const material = new BABYLON.StandardMaterial('preview_mat', this.scene);
      material.diffuseColor = new BABYLON.Color3(0, 0.8, 1); // Cyan
      material.alpha = 0.5;
      material.emissiveColor = new BABYLON.Color3(0, 0.4, 0.5);
      preview.material = material;
      preview.renderingGroupId = 1; // Render on top
      
      this.state.previewMesh = preview;
    }
  }

  /**
   * Cleanup preview mesh
   */
  private cleanupPreview(): void {
    if (this.state.previewMesh) {
      this.state.previewMesh.dispose();
      this.state.previewMesh = null;
    }
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (canvas) {
      if (this.pointerDownHandler) {
        canvas.removeEventListener('pointerdown', this.pointerDownHandler);
      }
      if (this.pointerMoveHandler) {
        canvas.removeEventListener('pointermove', this.pointerMoveHandler);
      }
      canvas.style.cursor = 'default';
    }
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler);
    }
    if (this.renderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = null;
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.cancelPrimitiveCreation();
  }
}

// Global instance for quick primitives
let quickPrimitivesInstance: QuickRoutePrimitives | null = null;

/**
 * Get or create QuickRoutePrimitives instance
 */
function getQuickPrimitives(): QuickRoutePrimitives {
  if (!quickPrimitivesInstance) {
    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      throw new Error('Scene not available for QuickRoutePrimitives');
    }
    quickPrimitivesInstance = new QuickRoutePrimitives(scene);
  }
  return quickPrimitivesInstance;
}

/**
 * React hook for quick primitive creation
 */
export function useQuickRoutePrimitives() {
  const [isActive, setIsActive] = useState(false);
  const [activeType, setActiveType] = useState<PrimitiveType | null>(null);

  const startCreation = (type: PrimitiveType) => {
    try {
      const manager = getQuickPrimitives();
      manager.startPrimitiveCreation(type);
      setIsActive(true);
      setActiveType(type);
    } catch (error) {
      console.error('[useQuickRoutePrimitives] Failed to start creation:', error);
    }
  };

  const cancelCreation = () => {
    try {
      const manager = getQuickPrimitives();
      manager.cancelPrimitiveCreation();
      setIsActive(false);
      setActiveType(null);
    } catch (error) {
      console.error('[useQuickRoutePrimitives] Failed to cancel:', error);
    }
  };

  return {
    startCreation,
    cancelCreation,
    isActive,
    activeType,
  };
}

