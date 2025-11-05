// RouteConverter - Convert primitive geometry to proper route types
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { useRoutingStore } from '../../ui/store/routingStore';
import { useEditorStore } from '../../ui/store/editorStore';
import { CreateConnectionPointCommand } from '../commands/CreateConnectionPointCommand';
import { ConnectionManager } from '../core/ConnectionManager';
import { RoutingWorkflowHandler } from './RoutingWorkflowHandler';
import { GenerateRouteGeometryCommand } from '../commands/GenerateRouteGeometryCommand';

export type RouteType = 'pipe' | 'electrical' | 'cable_tray' | 'conduit';

/**
 * Convert a primitive mesh to a proper route
 * Detects primitive type and creates route with connection points
 */
export async function convertPrimitiveToRoute(
  mesh: BABYLON.Mesh,
  targetRouteType?: RouteType
): Promise<string | null> {
  try {
    console.log('[RouteConverter] Converting primitive to route:', mesh.name);

    // Get primitive type from metadata or infer from geometry
    let routeType: RouteType;
    
    if (mesh.metadata?.primitiveType) {
      routeType = mesh.metadata.primitiveType as RouteType;
    } else if (targetRouteType) {
      routeType = targetRouteType;
    } else {
      // Infer from geometry
      if (mesh instanceof BABYLON.LinesMesh) {
        routeType = 'electrical'; // Wire
      } else if (mesh.geometry) {
        // Check if it's a cylinder (pipe/conduit) or box (cable tray)
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        if (positions) {
          // Simple heuristic: check bounding box dimensions
          const boundingInfo = mesh.getBoundingInfo();
          const size = boundingInfo.boundingBox.maximum.subtract(boundingInfo.boundingBox.minimum);
          const maxDim = Math.max(size.x, size.y, size.z);
          const minDim = Math.min(size.x, size.y, size.z);
          
          // If one dimension is much smaller, it's likely a cylinder (pipe/conduit)
          if (maxDim / minDim > 5) {
            routeType = 'pipe';
          } else {
            routeType = 'cable_tray';
          }
        } else {
          routeType = 'pipe'; // Default
        }
      } else {
        routeType = 'pipe'; // Default
      }
    }

    // Get start and end points
    let startPoint: BABYLON.Vector3;
    let endPoint: BABYLON.Vector3;

    if (mesh.metadata?.startPoint && mesh.metadata?.endPoint) {
      startPoint = mesh.metadata.startPoint as BABYLON.Vector3;
      endPoint = mesh.metadata.endPoint as BABYLON.Vector3;
    } else {
      // Calculate from mesh bounding box
      const boundingInfo = mesh.getBoundingInfo();
      const center = boundingInfo.boundingBox.center;
      const size = boundingInfo.boundingBox.maximum.subtract(boundingInfo.boundingBox.minimum);
      
      // Get direction from rotation or use longest axis
      const direction = mesh.forward.scale(-1); // Reverse forward (typical for routing)
      const halfLength = Math.max(size.x, size.y, size.z) / 2;
      
      startPoint = center.add(direction.scale(-halfLength));
      endPoint = center.add(direction.scale(halfLength));
    }

    // Convert to Z-up coordinate system (if needed)
    // Babylon.js uses Y-up, but routing uses Z-up
    const start = { x: startPoint.x, y: startPoint.z, z: startPoint.y };
    const end = { x: endPoint.x, y: endPoint.z, z: endPoint.y };

    console.log('[RouteConverter] Route type:', routeType);
    console.log('[RouteConverter] Start point:', start);
    console.log('[RouteConverter] End point:', end);

    // Set route type
    const setType = useRoutingStore.getState().setCurrentRouteType;
    setType(routeType);

    // Create specifications based on route type
    const baseSpecs: any = (() => {
      switch (routeType) {
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
      type: routeType,
      position: start,
      direction,
      specifications: baseSpecs,
    });
    const cmdB = new CreateConnectionPointCommand({
      type: routeType,
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
      console.error('[RouteConverter] Failed to find connection points');
      return null;
    }

    // Create route
    const routeId = await RoutingWorkflowHandler.createRouteBetweenPoints(src.getId(), dst.getId());
    if (!routeId) {
      console.error('[RouteConverter] Failed to create route');
      return null;
    }

    // Generate geometry
    const genCmd = new GenerateRouteGeometryCommand(routeId);
    cmdManager.execute(genCmd);

    // Remove original primitive mesh
    mesh.dispose();

    console.log('[RouteConverter] ✅ Converted primitive to route:', routeId);
    return routeId;
  } catch (error) {
    console.error('[RouteConverter] Error converting primitive:', error);
    return null;
  }
}

/**
 * Check if a mesh is a quick primitive that can be converted
 */
export function isConvertiblePrimitive(mesh: BABYLON.Mesh): boolean {
  return !!(
    mesh.metadata?.isQuickPrimitive ||
    (mesh.name.includes('pipe_') || mesh.name.includes('cable_tray_') || 
     mesh.name.includes('wire_') || mesh.name.includes('conduit_'))
  );
}


