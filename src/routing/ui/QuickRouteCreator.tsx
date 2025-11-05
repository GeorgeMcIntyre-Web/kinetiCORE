// QuickRouteCreator - Direct route creation without connection points
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { useRoutingStore } from '../../ui/store/routingStore';
import { useEditorStore } from '../../ui/store/editorStore';
import { CreateConnectionPointCommand } from '../commands/CreateConnectionPointCommand';
import { ConnectionManager } from '../core/ConnectionManager';
import { RoutingWorkflowHandler } from './RoutingWorkflowHandler';
import { GenerateRouteGeometryCommand } from '../commands/GenerateRouteGeometryCommand';

export type RouteType = 'pipe' | 'electrical' | 'cable_tray' | 'conduit';

interface RouteCreationState {
  active: boolean;
  type: RouteType | null;
  startPoint: BABYLON.Vector3 | null;
  endPoint: BABYLON.Vector3 | null;
  previewMesh: BABYLON.Mesh | null;
}

/**
 * Direct route creation handler
 * Creates routes directly by clicking two points in viewport
 */
export class QuickRouteCreator {
  private scene: BABYLON.Scene;
  private state: RouteCreationState = {
    active: false,
    type: null,
    startPoint: null,
    endPoint: null,
    previewMesh: null,
  };
  private pointerDownHandler: ((evt: PointerEvent) => void) | null = null;
  private pointerMoveHandler: ((evt: PointerEvent) => void) | null = null;
  private keyDownHandler: ((evt: KeyboardEvent) => void) | null = null;
  private renderLoopObserver: BABYLON.Observer<BABYLON.Scene> | null = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Start quick route creation mode
   */
  startQuickRoute(type: RouteType): void {
    if (this.state.active) {
      this.cancelQuickRoute();
    }

    this.state = {
      active: true,
      type,
      startPoint: null,
      endPoint: null,
      previewMesh: null,
    };

    this.setupPicking();
    this.setupPreview();
    console.log(`[QuickRouteCreator] Started ${type} quick route mode - Click start point`);
  }

  /**
   * Cancel quick route creation
   */
  cancelQuickRoute(): void {
    this.removeEventListeners();
    this.cleanupPreview();
    this.state = {
      active: false,
      type: null,
      startPoint: null,
      endPoint: null,
      previewMesh: null,
    };
    console.log('[QuickRouteCreator] Cancelled quick route creation');
  }

  /**
   * Setup viewport picking
   */
  private setupPicking(): void {
    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (!canvas) return;

    this.pointerDownHandler = (evt: PointerEvent) => {
      if (evt.button !== 0) return; // Only left click

      // Use pick with predicate to allow picking on non-pickable meshes (like warehouse floor)
      const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, () => {
        // Allow picking on all meshes including warehouse floor
        return true;
      }, false, this.scene.activeCamera);
      
      if (pickResult?.hit && pickResult.pickedPoint) {
        this.handlePointPick(pickResult.pickedPoint);
        evt.stopPropagation();
        evt.preventDefault();
      }
    };

    // Add mouse move handler for preview updates
    this.pointerMoveHandler = () => {
      if (this.state.active && this.state.startPoint) {
        this.updatePreview();
      }
    };

    this.keyDownHandler = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        this.cancelQuickRoute();
        evt.stopPropagation();
        evt.preventDefault();
      }
    };

    canvas.addEventListener('pointerdown', this.pointerDownHandler);
    canvas.addEventListener('pointermove', this.pointerMoveHandler);
    window.addEventListener('keydown', this.keyDownHandler);
    canvas.style.cursor = 'crosshair';
  }

  /**
   * Handle point picking
   */
  private async handlePointPick(point: BABYLON.Vector3): Promise<void> {
    if (!this.state.active || !this.state.type) return;

    // Convert to Z-up coordinate system
    const zUpPoint = { x: point.x, y: point.z, z: point.y };

    if (!this.state.startPoint) {
      // First point - set start
      this.state.startPoint = point.clone();
      console.log('[QuickRouteCreator] Start point set:', zUpPoint);
      // Start showing preview after first point
      this.updatePreview();
    } else {
      // Second point - create route
      this.state.endPoint = point.clone();
      this.cleanupPreview();
      await this.createRoute();
      this.cancelQuickRoute();
    }
  }

  /**
   * Create route between two points
   */
  private async createRoute(): Promise<void> {
    if (!this.state.startPoint || !this.state.endPoint || !this.state.type) return;

    const start = { x: this.state.startPoint.x, y: this.state.startPoint.z, z: this.state.startPoint.y };
    const end = { x: this.state.endPoint.x, y: this.state.endPoint.z, z: this.state.endPoint.y };

    console.log('[QuickRouteCreator] Creating route from', start, 'to', end);

    // Set route type
    const setType = useRoutingStore.getState().setCurrentRouteType;
    setType(this.state.type);

    // Create specifications
    const baseSpecs: any = (() => {
      switch (this.state.type) {
        case 'pipe':
          return { size: '40mm', material: 'steel' };
        case 'electrical':
          return { voltage: 120, current: 15 };
        case 'cable_tray':
          return { size: '400mm', trayType: 'ladder' };
        case 'conduit':
          return { nominalSize: '1/2"', conduitType: 'EMT' };
      }
    })();

    const direction = { x: 0, y: 0, z: 1 };

    // Create connection points
    const cmdManager = useEditorStore.getState().commandManager;
    const cmdA = new CreateConnectionPointCommand({
      type: this.state.type,
      position: start,
      direction,
      specifications: baseSpecs,
    });
    const cmdB = new CreateConnectionPointCommand({
      type: this.state.type,
      position: end,
      direction,
      specifications: baseSpecs,
    });

    cmdManager.execute(cmdA);
    cmdManager.execute(cmdB);

    // Find created connection points
    const cm = ConnectionManager.getInstance();
    const src = cm.findNearbyConnections(start, 0.05)[0];
    const dst = cm.findNearbyConnections(end, 0.05)[0];

    if (!src || !dst) {
      console.error('[QuickRouteCreator] Failed to find connection points');
      return;
    }

    // Create route
    const routeId = await RoutingWorkflowHandler.createRouteBetweenPoints(src.getId(), dst.getId());
    if (!routeId) {
      console.error('[QuickRouteCreator] Failed to create route');
      return;
    }

    // Generate geometry
    const genCmd = new GenerateRouteGeometryCommand(routeId);
    cmdManager.execute(genCmd);

    console.log('[QuickRouteCreator] ✅ Created route:', routeId);
  }

  /**
   * Remove event listeners
   */
  /**
   * Setup preview rendering loop
   */
  private setupPreview(): void {
    // Update preview on every frame while active
    this.renderLoopObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.state.active && this.state.startPoint) {
        this.updatePreview();
      }
    });
  }

  /**
   * Update preview mesh based on mouse position
   */
  private updatePreview(): void {
    if (!this.state.startPoint || !this.state.type) {
      this.cleanupPreview();
      return;
    }

    // Get current mouse position - allow picking on all meshes
    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, undefined, false, this.scene.activeCamera);
    if (!pickResult?.hit || !pickResult.pickedPoint) {
      this.cleanupPreview();
      return;
    }

    const end = pickResult.pickedPoint;
    const start = this.state.startPoint.clone();
    const direction = end.subtract(start);
    const length = direction.length();

    if (length < 0.01) {
      this.cleanupPreview();
      return;
    }

    this.cleanupPreview();

    // Create preview based on route type
    let preview: BABYLON.Mesh;
    const normalized = direction.normalize();
    
    switch (this.state.type) {
      case 'pipe': {
        // Default pipe: 40mm (0.04m) - visible size for UX
        const diameter = 0.04; // 40mm pipe
        preview = BABYLON.MeshBuilder.CreateCylinder(
          'quick_route_preview',
          { height: length, diameter, tessellation: 16 },
          this.scene
        );
        
        // Rotate to align with direction
        if (Math.abs(normalized.y) < 0.99) {
          const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), normalized);
          const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), normalized));
          if (axis.length() > 0.001) {
            preview.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
          }
        }
        
        // Position at midpoint
        const offset = normalized.scale(length * 0.5);
        preview.position = start.add(offset);
        break;
      }
      case 'cable_tray': {
        preview = BABYLON.MeshBuilder.CreateBox(
          'quick_route_preview',
          { width: length, height: 0.1, depth: 0.4 },
          this.scene
        );
        if (Math.abs(normalized.y) < 0.99) {
          const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), normalized);
          const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), normalized));
          if (axis.length() > 0.001) {
            preview.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
          }
        }
        const offset = normalized.scale(length * 0.5);
        preview.position = start.add(offset);
        break;
      }
      case 'electrical':
      case 'conduit': {
        const diameter = 0.05; // 50mm for conduit/electrical
        preview = BABYLON.MeshBuilder.CreateCylinder(
          'quick_route_preview',
          { height: length, diameter, tessellation: 16 },
          this.scene
        );
        if (Math.abs(normalized.y) < 0.99) {
          const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), normalized);
          const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), normalized));
          if (axis.length() > 0.001) {
            preview.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
          }
        }
        const offset = normalized.scale(length * 0.5);
        preview.position = start.add(offset);
        break;
      }
      default:
        return;
    }

    // Style preview
    const material = new BABYLON.StandardMaterial('quick_route_preview_mat', this.scene);
    material.diffuseColor = new BABYLON.Color3(0, 0.8, 1); // Cyan
    material.alpha = 0.6;
    material.emissiveColor = new BABYLON.Color3(0, 0.3, 0.4);
    preview.material = material;
    preview.renderingGroupId = 1;
    preview.isPickable = false;
    
    this.state.previewMesh = preview;
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
    if (this.renderLoopObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderLoopObserver);
      this.renderLoopObserver = null;
    }
  }

  /**
   * Check if quick route mode is active
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Check if quick route creator is available (scene ready)
   */
  static isAvailable(): boolean {
    return SceneManager.getInstance().getScene() !== null;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.cancelQuickRoute();
  }
}

// Global instance
let quickRouteCreatorInstance: QuickRouteCreator | null = null;

/**
 * Get or create QuickRouteCreator instance
 * Returns null if scene is not available (lazy initialization)
 */
export function getQuickRouteCreator(): QuickRouteCreator | null {
  if (!quickRouteCreatorInstance) {
    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      return null; // Scene not ready yet
    }
    quickRouteCreatorInstance = new QuickRouteCreator(scene);
  }
  return quickRouteCreatorInstance;
}

