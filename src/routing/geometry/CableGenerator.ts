// Cable Generator - Generates wire bundle geometry
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteGeometryGenerator } from './RouteGeometryGenerator';

/**
 * CableGenerator creates wire bundle geometry with multiple wires bundled together
 */
export class CableGenerator extends RouteGeometryGenerator {
  /**
   * Generate cable bundle geometry from route
   */
  generate(route: Route): BABYLON.Mesh {
    const meshes: BABYLON.Mesh[] = [];

    // Generate cable bundle along route segments
    for (const segment of route.segments) {
      const cable = this.createCableBundle(segment);
      meshes.push(cable);
    }

    // Combine all meshes
    const combined = this.combineMeshes(meshes, `cable_${route.getId()}`);
    const material = this.createMaterial(route.type, `cable_mat_${route.getId()}`);
    combined.material = material;

    return combined;
  }

  /**
   * Create cable bundle (multiple wires bundled together)
   */
  private createCableBundle(segment: any): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    const direction = end.subtract(start);
    const length = direction.length();
    direction.normalize();

    // Number of wires in bundle (default 3)
    const wireCount = 3;
    const wireDiameter = 0.02; // 20mm per wire
    const bundleDiameter = wireDiameter * 2.5; // Bundle is larger than individual wires

    const meshes: BABYLON.Mesh[] = [];

    // Create individual wires arranged in bundle
    for (let i = 0; i < wireCount; i++) {
      const angle = (i / wireCount) * Math.PI * 2;
      const offsetX = Math.cos(angle) * bundleDiameter * 0.3;
      const offsetZ = Math.sin(angle) * bundleDiameter * 0.3;

      const wire = BABYLON.MeshBuilder.CreateCylinder(
        `wire_${segment.id}_${i}`,
        {
          height: length,
          diameter: wireDiameter,
          tessellation: 12,
        },
        this.scene
      );

      const midPoint = start.add(end).scale(0.5);
      wire.position = midPoint.add(new BABYLON.Vector3(offsetX, 0, offsetZ));

      // Rotate to align with direction
      if (Math.abs(direction.y) < 0.99) {
        const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), direction);
        const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), direction));
        if (axis.length() > 0.001) {
          wire.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
        }
      }

      // Color wires differently (in a real implementation, use voltage/material)
      const wireMaterial = new BABYLON.StandardMaterial(`wire_mat_${i}`, this.scene);
      wireMaterial.diffuseColor = new BABYLON.Color3(
        0.8 + Math.random() * 0.2,
        0.8 + Math.random() * 0.2,
        0.8 + Math.random() * 0.2
      );
      wire.material = wireMaterial;

      meshes.push(wire);
    }

    // Combine wires
    const combined = BABYLON.Mesh.MergeMeshes(meshes, true, true) || meshes[0];
    return combined;
  }
}

