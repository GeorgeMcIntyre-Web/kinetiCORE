// Route Visual Warnings - Visual indicators for route validation issues
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { EnhancedValidationResult } from './RouteValidator';
import { Vector3 } from '../../core/types';

/**
 * Visual warning indicators for routes
 * Creates red segments, warning icons, and tooltips for validation issues
 */
export class RouteVisualWarnings {
  private scene: BABYLON.Scene;
  private warningMeshes: Map<string, BABYLON.Mesh[]> = new Map();
  private warningLabels: Map<string, BABYLON.TransformNode[]> = new Map();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Apply visual warnings to a route based on validation results
   */
  applyWarnings(route: Route, validationResult: EnhancedValidationResult): void {
    // Remove existing warnings for this route
    this.clearWarnings(route.getId());

    if (!validationResult || validationResult.violations.length === 0) {
      return;
    }

    const warningMeshes: BABYLON.Mesh[] = [];
    const warningLabels: BABYLON.TransformNode[] = [];

    // Highlight invalid segments in red
    for (const [segmentId, violations] of validationResult.segmentViolations.entries()) {
      const segment = route.segments.find((s) => s.id === segmentId);
      if (segment) {
        // Create red highlight for invalid segment
        const highlightMesh = this.createInvalidSegmentHighlight(segment, violations);
        if (highlightMesh) {
          warningMeshes.push(highlightMesh);
        }

        // Create warning icon at violation location
        for (const violation of violations) {
          const icon = this.createWarningIcon(violation);
          if (icon) {
            warningLabels.push(icon);
          }
        }
      }
    }

    // Add point markers for violations that don't have segment associations
    for (const violation of validationResult.violations) {
      const hasSegmentViolation = Array.from(validationResult.segmentViolations.values())
        .some((vios) => vios.some((v) => 
          Math.abs(v.location.x - violation.location.x) < 0.001 &&
          Math.abs(v.location.y - violation.location.y) < 0.001 &&
          Math.abs(v.location.z - violation.location.z) < 0.001
        ));

      if (!hasSegmentViolation) {
        const icon = this.createWarningIcon(violation);
        if (icon) {
          warningLabels.push(icon);
        }
      }
    }

    this.warningMeshes.set(route.getId(), warningMeshes);
    this.warningLabels.set(route.getId(), warningLabels);
  }

  /**
   * Create red highlight mesh for invalid segment
   */
  private createInvalidSegmentHighlight(
    segment: { startPoint: Vector3; endPoint: Vector3 },
    violations: any[]
  ): BABYLON.Mesh | null {
    try {
      // Create a red tube/sphere along the segment to indicate it's invalid
      const start = new BABYLON.Vector3(
        segment.startPoint.x,
        segment.startPoint.z,
        -segment.startPoint.y
      );
      const end = new BABYLON.Vector3(
        segment.endPoint.x,
        segment.endPoint.z,
        -segment.endPoint.y
      );

      const direction = end.subtract(start);
      const length = direction.length();
      direction.normalize();

      // Create a cylinder to highlight the segment
      const highlight = BABYLON.MeshBuilder.CreateCylinder(
        `warning_segment_${Date.now()}`,
        {
          height: length,
          diameter: 0.1, // Small diameter for warning indicator
        },
        this.scene
      );

      // Position and orient the cylinder
      highlight.position = start.add(direction.scale(length / 2));
      
      // Orient cylinder along the segment direction
      highlight.lookAt(end, 0, Math.PI / 2, 0);

      // Make it red and semi-transparent
      const material = new BABYLON.StandardMaterial(`warning_material_${Date.now()}`, this.scene);
      material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red
      material.emissiveColor = new BABYLON.Color3(0.5, 0, 0);
      material.alpha = 0.6;
      highlight.material = material;

      // Make it pickable so tooltips can work
      highlight.isPickable = true;
      highlight.metadata = {
        type: 'route_warning',
        violations: violations.map((v) => v.message),
      };

      return highlight;
    } catch (error) {
      console.warn('Failed to create invalid segment highlight:', error);
      return null;
    }
  }

  /**
   * Create warning icon at violation location
   */
  private createWarningIcon(violation: any): BABYLON.TransformNode | null {
    try {
      const position = new BABYLON.Vector3(
        violation.location.x,
        violation.location.z,
        -violation.location.y
      );

      // Create a sphere to mark the violation location
      const marker = BABYLON.MeshBuilder.CreateSphere(
        `warning_icon_${Date.now()}`,
        {
          diameter: 0.15,
          segments: 16,
        },
        this.scene
      );

      marker.position = position;

      // Color based on severity
      const material = new BABYLON.StandardMaterial(`warning_icon_material_${Date.now()}`, this.scene);
      if (violation.severity === 'error') {
        material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red
        material.emissiveColor = new BABYLON.Color3(0.8, 0, 0);
      } else {
        material.diffuseColor = new BABYLON.Color3(1, 0.75, 0); // Yellow/Orange
        material.emissiveColor = new BABYLON.Color3(0.6, 0.45, 0);
      }
      
      marker.material = material;
      marker.isPickable = true;
      marker.metadata = {
        type: 'route_warning_icon',
        violation: violation.message,
        severity: violation.severity,
      };

      // Add pulsing animation
      const animation = new BABYLON.Animation(
        'warningPulse',
        'scaling',
        30,
        BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
        BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
      );

      const keys = [
        { frame: 0, value: new BABYLON.Vector3(1, 1, 1) },
        { frame: 15, value: new BABYLON.Vector3(1.2, 1.2, 1.2) },
        { frame: 30, value: new BABYLON.Vector3(1, 1, 1) },
      ];

      animation.setKeys(keys);
      marker.animations.push(animation);
      this.scene.beginAnimation(marker, 0, 30, true);

      return marker;
    } catch (error) {
      console.warn('Failed to create warning icon:', error);
      return null;
    }
  }

  /**
   * Clear warnings for a route
   */
  clearWarnings(routeId: string): void {
    const meshes = this.warningMeshes.get(routeId);
    if (meshes) {
      meshes.forEach((mesh) => mesh.dispose());
      this.warningMeshes.delete(routeId);
    }

    const labels = this.warningLabels.get(routeId);
    if (labels) {
      labels.forEach((label) => label.dispose());
      this.warningLabels.delete(routeId);
    }
  }

  /**
   * Clear all warnings
   */
  clearAll(): void {
    this.warningMeshes.forEach((meshes) => {
      meshes.forEach((mesh) => mesh.dispose());
    });
    this.warningMeshes.clear();

    this.warningLabels.forEach((labels) => {
      labels.forEach((label) => label.dispose());
    });
    this.warningLabels.clear();
  }

  /**
   * Get tooltip text for a warning mesh
   */
  static getTooltipText(mesh: BABYLON.Mesh): string | null {
    if (mesh.metadata?.type === 'route_warning') {
      const violations = mesh.metadata.violations || [];
      return violations.join('\n');
    } else if (mesh.metadata?.type === 'route_warning_icon') {
      return mesh.metadata.violation || null;
    }
    return null;
  }
}

