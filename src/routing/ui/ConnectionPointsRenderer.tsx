// Connection Points Renderer - Renders visual indicators for all connection points
// Owner: Routing System Team

import { useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { ConnectionManager } from '../core/ConnectionManager';
import { ConnectionPoint } from '../core/ConnectionPoint';
import { SceneManager } from '../../scene/SceneManager';
import { userToBabylon } from '../../core/CoordinateSystem';

// Debug flag for A/B testing - set to true to disable connection points rendering
const DEBUG_DISABLE_CONNECTION_POINTS = false;

/**
 * Renders sphere indicators for all connection points in the scene
 * Updates automatically when connection points are added/removed
 * 
 * PERFORMANCE: Uses incremental batch processing to avoid main thread blocking.
 * Processes a few points per frame instead of all at once, and reuses existing meshes.
 * Only enqueues NEW connection points, not existing ones.
 */
export const ConnectionPointsRenderer = () => {
  if (DEBUG_DISABLE_CONNECTION_POINTS) {
    return null;
  }
  useEffect(() => {
    let disposed = false;
    let retryCount = 0;
    const maxRetries = 50; // ~5 seconds at 100ms intervals
    let cleanup: (() => void) | undefined;

    const tryInitialize = () => {
      if (disposed) return;

      const scene = SceneManager.getInstance().getScene();
      if (!scene) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(tryInitialize, 100);
          return;
        }
        console.warn('[ConnectionPointsRenderer] Scene not available after retries');
        return;
      }

      // Scene is ready, initialize renderer
      cleanup = initializeRenderer(scene);
    };

    // Start trying to initialize
    tryInitialize();

    return () => {
      disposed = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const initializeRenderer = (scene: BABYLON.Scene) => {
    const connectionManager = ConnectionManager.getInstance();
    const meshes = new Map<string, BABYLON.Mesh>();
    const materialCache = new Map<string, BABYLON.StandardMaterial>();
    
    // Batch processing state
    let pendingPoints: Array<{ id: string; point: ConnectionPoint }> = [];
    let processingIndex = 0;
    const BATCH_SIZE = 5; // Process 5 points per frame
    let rafId: number | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    // Color mapping for connection point types
    const getTypeColor = (type: string): BABYLON.Color3 => {
      const typeColors: Record<string, BABYLON.Color3> = {
        pipe: new BABYLON.Color3(0.2, 0.6, 0.9), // Blue
        electrical: new BABYLON.Color3(1.0, 0.8, 0.0), // Yellow
        cable_tray: new BABYLON.Color3(0.1, 0.8, 0.5), // Green
        conduit: new BABYLON.Color3(0.6, 0.3, 0.9), // Purple
      };
      return typeColors[type] || new BABYLON.Color3(1, 1, 1);
    };

    // Create or get material for a connection point type
    const getMaterial = (type: string): BABYLON.StandardMaterial => {
      if (materialCache.has(type)) {
        return materialCache.get(type)!;
      }

      const material = new BABYLON.StandardMaterial(`conn_mat_${type}`, scene);
      const color = getTypeColor(type);
      
      material.emissiveColor = color;
      material.diffuseColor = color;
      material.specularColor = new BABYLON.Color3(0, 0, 0);
      material.alpha = 0.9;
      
      materialCache.set(type, material);
      return material;
    };

    // Create or update a single connection point indicator
    const createOrUpdateIndicator = (point: ConnectionPoint, id: string): void => {
      // Reuse existing mesh if available
      if (meshes.has(id)) {
        const existingMesh = meshes.get(id)!;
        const position = point.getPosition();
        const babylonPos = userToBabylon(new BABYLON.Vector3(position.x, position.y, position.z));
        
        // Update position if changed
        if (!existingMesh.position.equals(babylonPos)) {
          existingMesh.position.copyFrom(babylonPos);
        }
        
        // Update material if type changed
        const pointType = point.getType();
        const expectedMaterial = getMaterial(pointType);
        if (existingMesh.material !== expectedMaterial) {
          existingMesh.material = expectedMaterial;
        }
        
        return;
      }

      // Create new mesh
      const sphere = BABYLON.MeshBuilder.CreateSphere(
        `conn_indicator_${id}`,
        {
          diameter: 0.05, // 50mm - proportional to pipes, still easily clickable
          segments: 16,
        },
        scene
      );

      const position = point.getPosition();
      const babylonPos = userToBabylon(new BABYLON.Vector3(position.x, position.y, position.z));
      sphere.position.copyFrom(babylonPos);

      const pointType = point.getType();
      sphere.material = getMaterial(pointType);

      sphere.isPickable = true;
      sphere.metadata = {
        connectionPointId: id,
        isConnectionPoint: true,
      };

      meshes.set(id, sphere);
    };

    // Process a batch of pending points
    const processBatch = (): void => {
      if (pendingPoints.length === 0) {
        rafId = null;
        return;
      }

      const endIndex = Math.min(processingIndex + BATCH_SIZE, pendingPoints.length);
      
      for (let i = processingIndex; i < endIndex; i++) {
        const { id, point } = pendingPoints[i];
        createOrUpdateIndicator(point, id);
      }

      processingIndex = endIndex;

      // If more points remain, schedule next batch
      if (processingIndex < pendingPoints.length) {
        rafId = requestAnimationFrame(processBatch);
        return;
      }

      // Batch complete, reset for next update cycle
      processingIndex = 0;
      pendingPoints = [];
      rafId = null;
    };

    // Update indicators incrementally - only enqueue NEW points
    const updateIndicators = (): void => {
      const points = connectionManager.getAllConnectionPoints();
      const currentIds = new Set<string>();

      if (!points || points.length === 0) {
        // Dispose all if any exist
        if (meshes.size > 0) {
          meshes.forEach((mesh) => mesh.dispose());
          meshes.clear();
        }
        pendingPoints = [];
        return;
      }

      // Scan all points - only enqueue NEW ones
      points.forEach((point) => {
        const id = point.getId();
        currentIds.add(id);

        // If mesh already exists, skip (already rendered)
        if (meshes.has(id)) {
          return;
        }

        // New point - enqueue for batched creation
        pendingPoints.push({ id, point });
      });

      // Remove meshes for deleted points
      meshes.forEach((mesh, id) => {
        if (currentIds.has(id)) {
          return;
        }
        mesh.dispose();
        meshes.delete(id);
      });

      // Start processing batch if there are new points and no active batch
      if (pendingPoints.length > 0 && rafId === null) {
        rafId = requestAnimationFrame(processBatch);
      }
    };

    // Initial render
    updateIndicators();

    // Update periodically to catch new points (slower interval to reduce overhead)
    intervalId = setInterval(updateIndicators, 250); // 4x per second instead of 10x

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      meshes.forEach(m => m.dispose());
      meshes.clear();
      materialCache.forEach(m => m.dispose());
      materialCache.clear();
    };
  };

  return null; // Renders to Babylon scene, not DOM
};
