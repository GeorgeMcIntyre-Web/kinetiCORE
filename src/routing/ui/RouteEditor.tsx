// Route Editor - Visual editing of route paths
// Owner: Routing System Team

import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { SceneManager } from '../../scene/SceneManager';
import { babylonToUser } from '../../core/CoordinateSystem';

interface RouteEditorProps {
  route: Route;
  onRouteChanged: (route: Route) => void;
  visible?: boolean;
}

/**
 * RouteEditor provides visual editing of route paths with draggable control points
 */
export const RouteEditor: React.FC<RouteEditorProps> = ({ route, onRouteChanged, visible = true }) => {
  const controlPointRefs = useRef<Map<string, BABYLON.Mesh>>(new Map());
  const observerRefs = useRef<Map<string, BABYLON.Observer<BABYLON.PointerInfo>>> (new Map());
  const dragStateRef = useRef<Map<string, { isDragging: boolean; dragPlane: BABYLON.Plane | null }>>(new Map());
  const scene = SceneManager.getInstance().getScene();

  useEffect(() => {
    if (!visible || !scene || !route) {
      // Cleanup when not visible
      controlPointRefs.current.forEach((mesh) => mesh.dispose());
      controlPointRefs.current.clear();
      observerRefs.current.forEach((obs) => {
        if (obs && typeof obs.remove === 'function') {
          obs.remove();
        }
      });
      observerRefs.current.clear();
      dragStateRef.current.clear();
      return;
    }

    // Create control points for waypoints
    const waypoints = route.getWaypoints();

    waypoints.forEach((waypoint, idx) => {
      const pointId = `control_${route.getId()}_${idx}`;
      
      // Remove existing if any
      const existing = controlPointRefs.current.get(pointId);
      if (existing) {
        existing.dispose();
        controlPointRefs.current.delete(pointId);
      }

      // Remove existing observer
      const existingObserver = observerRefs.current.get(pointId);
      if (existingObserver) {
        existingObserver.remove();
        observerRefs.current.delete(pointId);
      }

      // Create sphere control point
      const sphere = BABYLON.MeshBuilder.CreateSphere(
        pointId,
        {
          diameter: 0.15,
          segments: 16,
        },
        scene
      );

      // Convert Z-up to Y-up
      sphere.position.set(waypoint.x, waypoint.z, -waypoint.y);

      // Material for control point
      const material = new BABYLON.StandardMaterial(`control_mat_${pointId}`, scene);
      material.emissiveColor = new BABYLON.Color3(0.2, 0.8, 1.0); // Cyan
      material.emissiveColor.scaleToRef(0.8, material.emissiveColor);
      material.disableLighting = true;
      sphere.material = material;

      // Make draggable
      sphere.isPickable = true;
      sphere.enablePointerMoveEvents = true;

      // Initialize drag state
      dragStateRef.current.set(pointId, { isDragging: false, dragPlane: null });

      // Set up dragging with proper observer management
      const observer = scene.onPointerObservable.add((pointerInfo) => {
        const dragState = dragStateRef.current.get(pointId);
        if (!dragState) return;

        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
          const pick = pointerInfo.pickInfo;
          if (pick?.hit && pick.pickedMesh === sphere) {
            dragState.isDragging = true;
            // Create drag plane perpendicular to camera
            const camera = scene.activeCamera;
            if (camera && camera.getForwardRay) {
              dragState.dragPlane = BABYLON.Plane.FromPositionAndNormal(
                sphere.position,
                camera.getForwardRay().direction
              );
            }
          }
        }

        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE && dragState.isDragging) {
          const pick = pointerInfo.pickInfo;
          if (pick && pick.ray && dragState.dragPlane) {
            // Calculate intersection with drag plane
            const d = dragState.dragPlane.d;
            const normal = dragState.dragPlane.normal;
            const denominator = BABYLON.Vector3.Dot(normal, pick.ray.direction);
            if (Math.abs(denominator) > 0.0001) {
              const t = -(BABYLON.Vector3.Dot(normal, pick.ray.origin) + d) / denominator;
              const projected = pick.ray.origin.add(pick.ray.direction.scale(t));
              sphere.position.copyFrom(projected);

              // Convert back to user space (Z-up)
              const userPos = babylonToUser(projected);
              
              // Update route waypoint and segments
              route.updateWaypoint(idx, userPos);
              
              // Notify change
              onRouteChanged(route);
            }
          }
        }

        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
          dragState.isDragging = false;
          dragState.dragPlane = null;
        }
      });

      controlPointRefs.current.set(pointId, sphere);
      observerRefs.current.set(pointId, observer as BABYLON.Observer<BABYLON.PointerInfo>);
    });

    // Cleanup function
    return () => {
      controlPointRefs.current.forEach((mesh) => mesh.dispose());
      controlPointRefs.current.clear();
      observerRefs.current.forEach((obs) => {
        if (obs && typeof obs.remove === 'function') {
          obs.remove();
        }
      });
      observerRefs.current.clear();
      dragStateRef.current.clear();
    };
  }, [route, scene, visible, onRouteChanged]);

  return null; // Component renders to scene, not DOM
};
