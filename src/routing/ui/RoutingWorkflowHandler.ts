// Routing Workflow Handler - Handles routing workflow interactions
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { ConnectionManager } from '../core/ConnectionManager';
import { useRoutingStore } from '../../ui/store/routingStore';
import { CreateConnectionPointCommand } from '../commands/CreateConnectionPointCommand';
import { useEditorStore } from '../../ui/store/editorStore';
import { babylonToUser } from '../../core/CoordinateSystem';
import { getDefaultConstraints, getObstacles } from '../core/RoutingUtils';
import type { RouteType } from '../core/types';

/**
 * RoutingWorkflowHandler manages the routing workflow interactions
 */
export class RoutingWorkflowHandler {
  private scene: BABYLON.Scene | null = null;

  /**
   * Initialize the handler with scene
   */
  initialize(scene: BABYLON.Scene): void {
    this.scene = scene;
    this.setupSceneListeners();
  }

  /**
   * Setup scene click listeners for routing workflow
   */
  private setupSceneListeners(): void {
    if (!this.scene) return;

    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;

      const routingMode = useRoutingStore.getState().routingMode;
      if (routingMode === 'placing_connector') {
        this.handlePlaceConnectionPoint(pointerInfo);
      } else if (routingMode === 'placing_template') {
        this.handlePlaceTemplate(pointerInfo);
      }
    });
  }

  /**
   * Handle placing a connection point in the scene
   */
  private handlePlaceConnectionPoint(pointerInfo: BABYLON.PointerInfo): void {
    if (!pointerInfo.pickInfo?.pickedPoint || !this.scene) return;

    const pickedPoint = pointerInfo.pickInfo.pickedPoint;
    const pickedMesh = pointerInfo.pickInfo.pickedMesh;

    // Convert Y-up to Z-up
    const babylonPos = new BABYLON.Vector3(pickedPoint.x, pickedPoint.y, pickedPoint.z);
    const position = babylonToUser(babylonPos);

    // Get direction (could be based on mesh normal, camera direction, or default up)
    const direction = { x: 0, y: 0, z: 1 }; // Default Z-up

    // If we clicked on a mesh, use its normal for direction
    if (pickedMesh && pickedMesh instanceof BABYLON.Mesh && pointerInfo.pickInfo.faceId !== undefined && pointerInfo.pickInfo.faceId !== null) {
      const normal = pickedMesh.getFacetNormal(pointerInfo.pickInfo.faceId);
      if (normal) {
        // Use normal as direction (convert Y-up to Z-up)
        direction.x = normal.x;
        direction.y = normal.z; // Swap Y/Z
        direction.z = -normal.y;
      }
    }

    const currentRouteType = useRoutingStore.getState().currentRouteType;
    const entityId = pickedMesh?.metadata?.entityId;

    // Create connection point configuration
    const config = {
      type: currentRouteType,
      position,
      direction,
      specifications: RoutingWorkflowHandler.getDefaultSpecifications(currentRouteType),
    };

    // Execute command
    const commandManager = useEditorStore.getState().commandManager;
    const command = new CreateConnectionPointCommand(config, entityId);
    commandManager.execute(command);

    // Exit placing mode
    // keep placing active; exit via UI toggle
  }

  /**
   * Handle placing a template in the scene
   */
  private handlePlaceTemplate(pointerInfo: BABYLON.PointerInfo): void {
    if (!pointerInfo.pickInfo?.pickedPoint || !this.scene) return;

    const pickedPoint = pointerInfo.pickInfo.pickedPoint;
    const babylonPos = new BABYLON.Vector3(pickedPoint.x, pickedPoint.y, pickedPoint.z);
    const position = babylonToUser(babylonPos);

    // Dispatch custom event for template placement
    // The RouteTemplatesPanel will listen for this and handle placement
    window.dispatchEvent(new CustomEvent('route-template-place', {
      detail: { position }
    }));

    // Exit placing mode after a short delay to allow the event to be handled
    setTimeout(() => {
      // keep placing active; exit via UI toggle
    }, 100);
  }

  /**
   * Get default specifications for route type
   */
  private static getDefaultSpecifications(routeType: string) {
    switch (routeType) {
      case 'pipe':
        return { size: '3/4"', material: 'steel' }; // Use format matching PIPE_SIZES table
      case 'electrical':
        return { voltage: 480, material: 'copper' };
      case 'cable_tray':
        return { size: '150mm', material: 'aluminum' };
      case 'conduit':
        return { size: '50mm', material: 'PVC' };
      default:
        return {};
    }
  }

  /**
   * Handle route creation between two points
   */
  static async createRouteBetweenPoints(sourceId: string, destId: string): Promise<string | null> {
    console.log('[RoutingWorkflowHandler] 🚀 Creating route between:', sourceId, 'and', destId);

    const connectionManager = ConnectionManager.getInstance();
    const source = connectionManager.getConnectionPoint(sourceId);
    const dest = connectionManager.getConnectionPoint(destId);

    if (!source || !dest) {
      console.error('[RoutingWorkflowHandler] ❌ Invalid connection points:', {
        sourceId,
        destId,
        sourceFound: !!source,
        destFound: !!dest
      });
      return null;
    }
    console.log('[RoutingWorkflowHandler] ✅ Connection points found');

    // Import routing modules dynamically
    const { RouteOptimizer } = await import('../pathfinding/RouteOptimizer');
    const { SceneManager } = await import('../../scene/SceneManager');
    const { CreateRouteCommand } = await import('../commands/CreateRouteCommand');
    const { useEditorStore } = await import('../../ui/store/editorStore');

    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      console.error('[RoutingWorkflowHandler] No scene available');
      return null;
    }

    const state = useRoutingStore.getState();
    const optimizer = new RouteOptimizer();
    const constraints = RoutingWorkflowHandler.getDefaultConstraints(state.currentRouteType);
    const obstacles = RoutingWorkflowHandler.getObstacles(scene);

    console.log('[RoutingWorkflowHandler] Finding path:', {
      sourcePos: source.getPosition(),
      destPos: dest.getPosition(),
      constraints,
      obstacleCount: obstacles.length,
      optimizationMode: state.optimizationMode
    });

    const route = optimizer.findOptimalPath(
      source,
      dest,
      constraints,
      obstacles,
      state.optimizationMode
    );

    if (route) {
      console.log('[RoutingWorkflowHandler] ✅ Route object created by optimizer:', route.getId());
      console.log('[RoutingWorkflowHandler] Route has', route.segments.length, 'segments');

      // Note: Route is already added to store by CreateRouteCommand
      // Don't add it manually here to avoid duplicate addition
      // state.addRoute(route);

      // Connection will be created by CreateRouteCommand
      // connectionManager.createConnection(sourceId, destId, route.getId());

      // Execute command - this will add the route AND create the connection
      const commandManager = useEditorStore.getState().commandManager;
      const command = new CreateRouteCommand(route);
      commandManager.execute(command);
      console.log('[RoutingWorkflowHandler] ✅ CreateRouteCommand executed');

      console.log('[RoutingWorkflowHandler] 🎉 Route created successfully:', route.getId());
      return route.getId();
    }

    console.error('[RoutingWorkflowHandler] ❌ RouteOptimizer returned null - no path found');
    return null;
  }

  /**
   * Get default constraints for route type
   */
  static getDefaultConstraints(routeType: string) {
    return getDefaultConstraints(routeType as RouteType);
  }

  /**
   * Get obstacles from scene
   */
  static getObstacles(scene: BABYLON.Scene): BABYLON.Mesh[] {
    return getObstacles(scene);
  }
}


