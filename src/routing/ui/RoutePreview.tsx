// Route Preview - Visual preview of route path with validation feedback
// Owner: Routing System Team

import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { ValidationResult } from '../core/types';

interface RoutePreviewProps {
  route: Route | null;
  validation: ValidationResult | null;
  scene: BABYLON.Scene;
  visible?: boolean;
}

/**
 * RoutePreview renders a visual preview of the route path
 * Color-coded by validation state (green=valid, yellow=warning, red=invalid)
 */
export const RoutePreview: React.FC<RoutePreviewProps> = ({ route, validation, scene, visible = true }) => {
  const linesRef = useRef<BABYLON.LinesMesh[]>([]);
  const materialRefs = useRef<BABYLON.StandardMaterial[]>([]);

  useEffect(() => {
    // Clean up previous preview
    linesRef.current.forEach((line) => line.dispose());
    linesRef.current = [];
    materialRefs.current.forEach((mat) => mat.dispose());
    materialRefs.current = [];

    if (!visible || !route) return;

    const waypoints = route.getWaypoints();
    if (waypoints.length < 2) return;

    // Determine color based on validation
    const color = getColorForValidation(validation);

    // Create lines between waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];

      // Convert Z-up to Y-up for Babylon.js
      const points = [
        new BABYLON.Vector3(start.x, start.z, -start.y),
        new BABYLON.Vector3(end.x, end.z, -end.y),
      ];

      const lines = BABYLON.MeshBuilder.CreateLines(
        `route_preview_${route.getId()}_${i}`,
        { points },
        scene
      );

      // Create material
      const material = new BABYLON.StandardMaterial(`route_preview_mat_${route.getId()}_${i}`, scene);
      material.emissiveColor = color;
      material.disableLighting = true;
      lines.color = color;
      lines.material = material; // Assign material to lines

      linesRef.current.push(lines);
      materialRefs.current.push(material);
    }

    // Highlight violations if any
    if (validation && validation.violations.length > 0) {
      validation.violations.forEach((violation, idx) => {
        const pos = violation.location;
        const sphere = BABYLON.MeshBuilder.CreateSphere(
          `violation_${route.getId()}_${idx}`,
          { diameter: 0.15 },
          scene
        );
        // Convert Z-up to Y-up
        sphere.position.set(pos.x, pos.z, -pos.y);

        const material = new BABYLON.StandardMaterial(`violation_mat_${route.getId()}_${idx}`, scene);
        material.emissiveColor = getColorForViolation(violation.severity);
        material.emissiveColor.scaleToRef(1.0, material.emissiveColor);
        material.disableLighting = true;
        sphere.material = material;

        linesRef.current.push(sphere as any);
        materialRefs.current.push(material);
      });
    }

    return () => {
      linesRef.current.forEach((line) => line.dispose());
      materialRefs.current.forEach((mat) => mat.dispose());
      linesRef.current = [];
      materialRefs.current = [];
    };
  }, [route, validation, scene, visible]);

  return null; // Component renders to scene, not DOM
};

/**
 * Get color based on validation result
 */
function getColorForValidation(validation: ValidationResult | null): BABYLON.Color3 {
  if (!validation) {
    return new BABYLON.Color3(0.8, 0.8, 0.8); // Gray (unknown)
  }

  if (validation.isValid) {
    return new BABYLON.Color3(0.2, 1.0, 0.2); // Green (valid)
  }

  // Check severity
  const hasErrors = validation.violations.some((v) => v.severity === 'error');
  const hasWarnings = validation.violations.some((v) => v.severity === 'warning');

  if (hasErrors) {
    return new BABYLON.Color3(1.0, 0.2, 0.2); // Red (errors)
  }

  if (hasWarnings) {
    return new BABYLON.Color3(1.0, 0.8, 0.2); // Yellow (warnings)
  }

  return new BABYLON.Color3(0.8, 0.8, 0.8); // Gray (info only)
}

/**
 * Get color for violation severity
 */
function getColorForViolation(severity: 'error' | 'warning' | 'info'): BABYLON.Color3 {
  switch (severity) {
    case 'error':
      return new BABYLON.Color3(1.0, 0.0, 0.0); // Red
    case 'warning':
      return new BABYLON.Color3(1.0, 0.8, 0.0); // Yellow
    case 'info':
      return new BABYLON.Color3(0.5, 0.5, 1.0); // Blue
  }
}

