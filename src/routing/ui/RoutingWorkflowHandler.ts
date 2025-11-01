// Routing Workflow Handler - Handles routing workflow interactions
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { ConnectionManager } from '../core/ConnectionManager';
import { useRoutingStore } from '../../ui/store/routingStore';
import { CreateConnectionPointCommand } from '../commands/CreateConnectionPointCommand';
import { useEditorStore } from '../../ui/store/editorStore';
import { babylonToUser } from '../../core/CoordinateSystem';

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
    useRoutingStore.getState().setRoutingMode('off');
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
      useRoutingStore.getState().setRoutingMode('off');
    }, 100);
  }

  /**
   * Get default specifications for route type
   */
  private static getDefaultSpecifications(routeType: string) {
    switch (routeType) {
      case 'pipe':
        return { size: '3/4 inch', material: 'steel' };
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
  static createRouteBetweenPoints(sourceId: string, destId: string): void {
    const connectionManager = ConnectionManager.getInstance();
    const source = connectionManager.getConnectionPoint(sourceId);
    const dest = connectionManager.getConnectionPoint(destId);

    if (!source || !dest) return;

    // Import routing modules dynamically
    import('../pathfinding/RouteOptimizer').then(({ RouteOptimizer }) => {
      import('../../scene/SceneManager').then(({ SceneManager }) => {
        import('../commands/CreateRouteCommand').then(({ CreateRouteCommand }) => {
          import('../../ui/store/editorStore').then(({ useEditorStore }) => {
            const scene = SceneManager.getInstance().getScene();
            if (!scene) return;

            const state = useRoutingStore.getState();
            const optimizer = new RouteOptimizer();
            const constraints = RoutingWorkflowHandler.getDefaultConstraints(state.currentRouteType);
            const obstacles = RoutingWorkflowHandler.getObstacles(scene);

            const route = optimizer.findOptimalPath(
              source,
              dest,
              constraints,
              obstacles,
              state.optimizationMode
            );

            if (route) {
              state.addRoute(route);
              connectionManager.createConnection(sourceId, destId, route.getId());

              const commandManager = useEditorStore.getState().commandManager;
              const command = new CreateRouteCommand(route);
              commandManager.execute(command);
            }
          });
        });
      });
    });
  }

  /**
   * Get default constraints for route type
   */
  static getDefaultConstraints(routeType: string) {
    // Import utilities dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getDefaultConstraints: getDefaults } = require('../core/RoutingUtils');
    return getDefaults(routeType as any);
  }

  /**
   * Get obstacles from scene
   */
  static getObstacles(scene: BABYLON.Scene): BABYLON.Mesh[] {
    // Import utilities dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getObstacles: getObst } = require('../core/RoutingUtils');
    return getObst(scene);
  }
}

