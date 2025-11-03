// Connection Points Renderer - Renders visual indicators for all connection points
// Owner: Routing System Team

import { useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { ConnectionManager } from '../core/ConnectionManager';
import { SceneManager } from '../../scene/SceneManager';
import { userToBabylon } from '../../core/CoordinateSystem';

/**
 * Renders sphere indicators for all connection points in the scene
 * Updates automatically when connection points are added/removed
 */
export const ConnectionPointsRenderer = () => {
  useEffect(() => {
    // Wait for scene to be ready
    let scene = SceneManager.getInstance().getScene();
    if (!scene) {
      console.warn('[ConnectionPointsRenderer] Scene not ready yet, waiting...');
      // Retry after a short delay
      const retryTimeout = setTimeout(() => {
        scene = SceneManager.getInstance().getScene();
        if (!scene) {
          console.error('[ConnectionPointsRenderer] Scene still not available after retry');
          return;
        }
        initializeRenderer(scene);
      }, 500);
      return () => clearTimeout(retryTimeout);
    }

    return initializeRenderer(scene);
  }, []);

  const initializeRenderer = (scene: BABYLON.Scene) => {
    const connectionManager = ConnectionManager.getInstance();
    const meshes = new Map<string, BABYLON.Mesh>();

    // Function to create/update indicators
    const updateIndicators = () => {
      const points = connectionManager.getAllConnectionPoints();
      const currentIds = new Set<string>();

      points.forEach((point) => {
        const id = point.getId();
        currentIds.add(id);

        // Skip if already exists
        if (meshes.has(id)) return;

        const sphere = BABYLON.MeshBuilder.CreateSphere(
          `conn_indicator_${id}`,
          {
            diameter: 1.0, // Much larger for easy clicking (1 meter)
            segments: 16,
          },
          scene
        );

        const position = point.getPosition();
        // Convert Z-up (user space) to Y-up (Babylon space)
        const babylonPos = userToBabylon(new BABYLON.Vector3(position.x, position.y, position.z));
        sphere.position.copyFrom(babylonPos);

        console.log(`[ConnectionPointsRenderer] Creating sphere at user:(${position.x}, ${position.y}, ${position.z}) babylon:(${babylonPos.x}, ${babylonPos.y}, ${babylonPos.z})`);

        // Create glowing material
        const material = new BABYLON.StandardMaterial(`conn_mat_${id}`, scene);

        // Color by type
        const typeColors: Record<string, BABYLON.Color3> = {
          pipe: new BABYLON.Color3(0.2, 0.6, 0.9), // Blue
          electrical: new BABYLON.Color3(1.0, 0.8, 0.0), // Yellow
          cable_tray: new BABYLON.Color3(0.1, 0.8, 0.5), // Green
          conduit: new BABYLON.Color3(0.6, 0.3, 0.9), // Purple
        };

        const color = typeColors[point.getType()] || new BABYLON.Color3(1, 1, 1);

        material.emissiveColor = color;
        material.diffuseColor = color;
        material.specularColor = new BABYLON.Color3(0, 0, 0);
        material.alpha = 0.9;
        sphere.material = material;

        // Make pickable
        sphere.isPickable = true;
        sphere.metadata = {
          connectionPointId: id,
          isConnectionPoint: true,
        };

        meshes.set(id, sphere);
      });

      // Remove meshes for deleted points
      meshes.forEach((mesh, id) => {
        if (!currentIds.has(id)) {
          mesh.dispose();
          meshes.delete(id);
        }
      });

      if (points.length > 0) {
        console.log(`[ConnectionPointsRenderer] Rendered ${meshes.size} connection points`);
      }
    };

    // Initial render
    updateIndicators();

    // Update frequently to catch new points quickly
    const interval = setInterval(updateIndicators, 100); // 10x per second

    return () => {
      clearInterval(interval);
      meshes.forEach(m => m.dispose());
      meshes.clear();
    };
  };

  return null; // Renders to Babylon scene, not DOM
};
