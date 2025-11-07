// Connection Point Indicator - Visual indicators for connection points
// Owner: Routing System Team

import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { ConnectionPoint } from '../core/ConnectionPoint';
import { RouteType } from '../core/types';

interface ConnectionPointIndicatorProps {
  point: ConnectionPoint;
  state: 'available' | 'selected' | 'connected';
  scene: BABYLON.Scene;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  visible?: boolean;
}

/**
 * ConnectionPointIndicator renders a visual indicator at a connection point
 * Color-coded by type and state, with hover/click feedback
 */
export const ConnectionPointIndicator: React.FC<ConnectionPointIndicatorProps> = ({
  point,
  state,
  scene,
  onClick,
  onHover,
  visible = true,
}) => {
  const meshRef = useRef<BABYLON.Mesh | null>(null);
  const materialRef = useRef<BABYLON.StandardMaterial | null>(null);
  const baseColorRef = useRef<BABYLON.Color3 | null>(null);

  useEffect(() => {
    if (!visible) {
      if (meshRef.current) {
        meshRef.current.dispose();
        meshRef.current = null;
      }
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
      return;
    }

    // Create sphere indicator
    const sphere = BABYLON.MeshBuilder.CreateSphere(
      `conn_indicator_${point.getId()}`,
      {
        diameter: 0.1,
        segments: 16,
      },
      scene
    );

    const position = point.getPosition();
    // Convert Z-up to Y-up for Babylon.js
    sphere.position.set(position.x, position.z, -position.y);

    // Create material with state-based color
    const material = new BABYLON.StandardMaterial(`conn_mat_${point.getId()}`, scene);
    const baseColor = getColorForState(point.getType(), state);
    baseColorRef.current = baseColor.clone();
    
    // Set initial emissive color
    material.emissiveColor = baseColor.clone();
    material.emissiveColor.scaleInPlace(0.8);
    material.disableLighting = true;

    sphere.material = material;

    // Outline rendering could be added here if needed

    // Enable picking
    sphere.isPickable = true;

    // Click handler
    if (onClick) {
      sphere.actionManager = new BABYLON.ActionManager(scene);
      sphere.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
          onClick();
        })
      );
    }

    // Hover handler
    if (onHover) {
      if (!sphere.actionManager) {
        sphere.actionManager = new BABYLON.ActionManager(scene);
      }
      sphere.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
          onHover(true);
          // Set absolute hover color from base
          if (baseColorRef.current) {
            material.emissiveColor = baseColorRef.current.clone();
            material.emissiveColor.scaleInPlace(1.0); // Full brightness on hover
          }
        })
      );
      sphere.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
          onHover(false);
          // Reset to base color
          if (baseColorRef.current) {
            material.emissiveColor = baseColorRef.current.clone();
            material.emissiveColor.scaleInPlace(0.8); // Normal brightness
          }
        })
      );
    }

    meshRef.current = sphere;
    materialRef.current = material;

    return () => {
      if (meshRef.current) {
        meshRef.current.dispose();
      }
      if (materialRef.current) {
        materialRef.current.dispose();
      }
    };
  }, [point, state, scene, visible, onClick, onHover]);

  return null; // Component renders to scene, not DOM
};

/**
 * Get color for connection point based on type and state
 */
function getColorForState(type: RouteType, state: 'available' | 'selected' | 'connected'): BABYLON.Color3 {
  // Base colors by type
  const typeColors: Record<RouteType, BABYLON.Color3> = {
    pipe: new BABYLON.Color3(0.2, 0.6, 0.9), // Blue
    electrical: new BABYLON.Color3(1.0, 0.8, 0.0), // Yellow
    cable_tray: new BABYLON.Color3(0.7, 0.7, 0.7), // Gray
    conduit: new BABYLON.Color3(0.9, 0.6, 0.2), // Orange
  };

  let color = typeColors[type];

  // Modify by state
  switch (state) {
    case 'available':
      // Bright green tint for available
      color = color.scale(1.2).add(new BABYLON.Color3(0.3, 0.5, 0.3));
      break;
    case 'selected':
      // Bright yellow for selected
      color = new BABYLON.Color3(1.0, 1.0, 0.2);
      break;
    case 'connected':
      // Blue tint for connected
      color = new BABYLON.Color3(0.2, 0.5, 1.0);
      break;
  }

  // Clamp to valid range
  return new BABYLON.Color3(
    Math.min(1, Math.max(0, color.r)),
    Math.min(1, Math.max(0, color.g)),
    Math.min(1, Math.max(0, color.b))
  );
}

