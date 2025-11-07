// Route Selection Visuals - Cyan glow and connection point handles
// Owner: Routing System Team

import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { useRoutingStore } from '../../ui/store/routingStore';
import { ConnectionPointIndicator } from './ConnectionPointIndicator';

/**
 * RouteSelectionVisuals provides visual feedback for selected routes:
 * - Cyan glow on selected route mesh
 * - Connection point handles at source and destination
 */
export const RouteSelectionVisuals: React.FC = () => {
  const selectedRoute = useRoutingStore((state) => state.selectedRoute);
  const highlightLayerRef = useRef<BABYLON.HighlightLayer | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);

  useEffect(() => {
    const scene = SceneManager.getInstance().getScene();
    if (!scene) return;

    sceneRef.current = scene;

    // Create highlight layer for route selection glow
    if (!highlightLayerRef.current) {
      highlightLayerRef.current = new BABYLON.HighlightLayer('route-selection', scene);
      highlightLayerRef.current.innerGlow = false;
      highlightLayerRef.current.outerGlow = true;
    }

    return () => {
      // Cleanup will be handled when route changes
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const highlightLayer = highlightLayerRef.current;

    if (!scene || !highlightLayer) return;

    // Clear previous highlights
    highlightLayer.removeAllMeshes();

    if (!selectedRoute) return;

    // Find the route mesh in the scene
    const routeMesh = scene.meshes.find((mesh) => {
      return (
        mesh.metadata &&
        mesh.metadata.isRoute &&
        mesh.metadata.routeId === selectedRoute.getId()
      );
    });

    if (routeMesh && routeMesh instanceof BABYLON.Mesh) {
      // Add cyan glow to selected route
      highlightLayer.addMesh(routeMesh, BABYLON.Color3.FromHexString('#00D9FF'));
    }
  }, [selectedRoute]);

  if (!selectedRoute) {
    return null;
  }

  const scene = SceneManager.getInstance().getScene();
  if (!scene) return null;

  // Show connection point handles for source and destination
  return (
    <>
      {/* Source connection point indicator */}
      <ConnectionPointIndicator
        point={selectedRoute.source}
        state="selected"
        scene={scene}
        visible={true}
        onClick={() => {}}
        onHover={() => {}}
      />
      {/* Destination connection point indicator */}
      <ConnectionPointIndicator
        point={selectedRoute.destination}
        state="selected"
        scene={scene}
        visible={true}
        onClick={() => {}}
        onHover={() => {}}
      />
    </>
  );
};




