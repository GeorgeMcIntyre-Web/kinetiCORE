// Cable Tray Generator - Generates cable tray channel geometry
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteGeometryGenerator } from './RouteGeometryGenerator';

/**
 * CableTrayGenerator creates cable tray channel geometry with supports
 */
export class CableTrayGenerator extends RouteGeometryGenerator {
  /**
   * Generate cable tray geometry from route
   */
  generate(route: Route): BABYLON.Mesh {
    const meshes: BABYLON.Mesh[] = [];

    // Generate tray segments
    for (const segment of route.segments) {
      const tray = this.createTraySegment(segment);
      meshes.push(tray);
    }

    // Generate supports at spacing intervals
    this.generateSupports(route, meshes);

    // Combine all meshes
    const combined = this.combineMeshes(meshes, `cable_tray_${route.getId()}`);
    const material = this.createMaterial(route.type, `cable_tray_mat_${route.getId()}`);
    combined.material = material;

    return combined;
  }

  /**
   * Create tray segment (U-shaped channel)
   */
  private createTraySegment(segment: any): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    const direction = end.subtract(start);
    const length = direction.length();
    direction.normalize();

    // Tray dimensions (default 150mm wide, 75mm deep)
    const width = 0.15;
    const depth = 0.075;

    // Create U-shaped channel from box extrusions
    // For MVP, create a simple box (full implementation would create proper U-channel)
    const tray = BABYLON.MeshBuilder.CreateBox(
      `tray_${segment.id}`,
      {
        width: width,
        height: depth,
        depth: length,
      },
      this.scene
    );

    const midPoint = start.add(end).scale(0.5);
    tray.position = midPoint;

    // Rotate to align with direction
    if (Math.abs(direction.y) < 0.99) {
      const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), direction);
      const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), direction));
      if (axis.length() > 0.001) {
        tray.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
      }
    }

    return tray;
  }

  /**
   * Generate supports at spacing intervals
   */
  private generateSupports(route: Route, meshes: BABYLON.Mesh[]): void {
    const supportSpacing = route.constraints.supportSpacing;
    const waypoints = route.getWaypoints();

    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];
      const distance = Math.sqrt(
        (end.x - start.x) ** 2 + (end.y - start.y) ** 2 + (end.z - start.z) ** 2
      );

      // Add supports along segment
      const numSupports = Math.floor(distance / supportSpacing);
      for (let j = 1; j <= numSupports; j++) {
        const t = j / (numSupports + 1);
        const supportPos = {
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
          z: start.z + (end.z - start.z) * t,
        };

        const support = this.createTraySupport(supportPos);
        meshes.push(support);
      }
    }
  }

  /**
   * Create tray support (hanger/bracket)
   */
  private createTraySupport(position: any): BABYLON.Mesh {
    const pos = this.toBabylonVector(position);

    // Create simple support post
    const support = BABYLON.MeshBuilder.CreateCylinder(
      `tray_support_${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      {
        height: 0.2,
        diameter: 0.02,
        tessellation: 8,
      },
      this.scene
    );

    support.position = pos.subtract(new BABYLON.Vector3(0, 0.1, 0));
    return support;
  }
}

