// Conduit Generator - Generates conduit geometry similar to pipes but with electrical constraints
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteGeometryGenerator } from './RouteGeometryGenerator';

/**
 * ConduitGenerator creates conduit geometry similar to pipes but with electrical-specific features
 * Includes junction boxes at connections
 */
export class ConduitGenerator extends RouteGeometryGenerator {
  /**
   * Generate conduit geometry from route
   */
  generate(route: Route): BABYLON.Mesh {
    const meshes: BABYLON.Mesh[] = [];

    // Generate conduit segments (similar to pipes)
    for (const segment of route.segments) {
      if (segment.segmentType === 'straight') {
        const conduit = this.createConduit(segment);
        meshes.push(conduit);
      } else if (segment.segmentType === 'bend') {
        const bend = this.createConduitBend(segment, route.constraints.minBendRadius);
        meshes.push(bend);
      }
    }

    // Add junction box at source
    const sourceBox = this.createJunctionBox(route.source.getPosition(), 'source');
    meshes.push(sourceBox);

    // Add junction box at destination
    const destBox = this.createJunctionBox(route.destination.getPosition(), 'dest');
    meshes.push(destBox);

    // Combine all meshes
    const combined = this.combineMeshes(meshes, `conduit_${route.getId()}`);
    const material = this.createMaterial(route.type, `conduit_mat_${route.getId()}`);
    combined.material = material;

    return combined;
  }

  /**
   * Create conduit segment (similar to pipe but with different material/appearance)
   */
  private createConduit(segment: any): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    const direction = end.subtract(start);
    const length = direction.length();
    direction.normalize();

    // Conduit diameter: 25mm (standard EMT/IMC size)
    const diameter = 0.025;

    // Create cylinder
    const conduit = BABYLON.MeshBuilder.CreateCylinder(
      `conduit_${segment.id}`,
      {
        height: length,
        diameter,
        tessellation: 16,
      },
      this.scene
    );

    const midPoint = start.add(end).scale(0.5);
    conduit.position = midPoint;

    // Rotate to align with direction
    if (Math.abs(direction.y) < 0.99) {
      const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), direction);
      const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), direction));
      if (axis.length() > 0.001) {
        conduit.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
      }
    }

    return conduit;
  }

  /**
   * Create conduit bend
   */
  private createConduitBend(segment: any, minBendRadius: number): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    const bendRadius = segment.bendRadius || minBendRadius;
    const diameter = 0.025; // 25mm diameter matching conduit

    // Create torus segment for bend
    const bend = BABYLON.MeshBuilder.CreateTorus(
      `conduit_bend_${segment.id}`,
      {
        diameter: bendRadius * 2,
        thickness: diameter,
        tessellation: 32,
      },
      this.scene
    );

    bend.position = start;

    const direction = end.subtract(start).normalize();
    if (Math.abs(direction.y) < 0.99) {
      const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), direction);
      const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), direction));
      if (axis.length() > 0.001) {
        bend.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
      }
    }

    return bend;
  }

  /**
   * Create junction box at connection point
   */
  private createJunctionBox(position: any, label: string): BABYLON.Mesh {
    const pos = this.toBabylonVector(position);

    // Create junction box (rectangular box)
    const box = BABYLON.MeshBuilder.CreateBox(
      `junction_box_${label}`,
      {
        width: 0.15,
        height: 0.15,
        depth: 0.1,
      },
      this.scene
    );

    box.position = pos;

    // Create material for junction box (gray)
    const material = new BABYLON.StandardMaterial(`junction_mat_${label}`, this.scene);
    material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    box.material = material;

    return box;
  }
}

