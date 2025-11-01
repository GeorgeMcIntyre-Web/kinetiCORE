// Pipe Generator - Generates 3D pipe geometry from routes
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteSegment, SupportPoint } from '../core/types';
import { RouteGeometryGenerator } from './RouteGeometryGenerator';

/**
 * PipeGenerator creates 3D pipe geometry (cylinders) along route paths
 * Includes elbows at bends and supports/hangers
 */
export class PipeGenerator extends RouteGeometryGenerator {
  /**
   * Generate pipe geometry from route
   */
  generate(route: Route): BABYLON.Mesh {
    const meshes: BABYLON.Mesh[] = [];

    // Generate pipe segments
    for (const segment of route.segments) {
      if (segment.segmentType === 'straight') {
        const tube = this.createTube(segment);
        meshes.push(tube);
      } else if (segment.segmentType === 'bend') {
        const elbow = this.createElbow(segment, route.constraints.minBendRadius);
        meshes.push(elbow);
      }
    }

    // Generate supports
    for (const support of route.supports) {
        const supportMesh = this.createSupport(support);
      meshes.push(supportMesh);
    }

    // Combine all meshes
    const combined = this.combineMeshes(meshes, `pipe_${route.getId()}`);
    const material = this.createMaterial(route.type, `pipe_mat_${route.getId()}`);
    combined.material = material;

    return combined;
  }

  /**
   * Create a tube (cylinder) along a straight segment
   */
  private createTube(segment: RouteSegment): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    // Calculate direction and length
    const direction = end.subtract(start);
    const length = direction.length();
    direction.normalize();

    // Default diameter (could come from specifications)
    const diameter = 0.1; // 100mm default

    // Create cylinder
    const cylinder = BABYLON.MeshBuilder.CreateCylinder(
      `tube_${segment.id}`,
      {
        height: length,
        diameter,
        tessellation: 16,
      },
      this.scene
    );

    // Position and orient cylinder
    const midPoint = start.add(end).scale(0.5);
    cylinder.position = midPoint;

    // Rotate to align with direction
    // Default cylinder axis is Y-up, direction might be any orientation
    if (Math.abs(direction.y) < 0.99) {
      // Not already aligned with Y-axis
      const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), direction);
      const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), direction));
      if (axis.length() > 0.001) {
        cylinder.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
      }
    }

    return cylinder;
  }

  /**
   * Create an elbow (bend fitting) at a bend segment
   */
  private createElbow(segment: RouteSegment, minBendRadius: number): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    // Use bend radius from segment or default to minBendRadius
    const bendRadius = segment.bendRadius || minBendRadius;

    // For MVP, create a simple curved tube
    // Full implementation would create a proper 90-degree elbow mesh
    const diameter = 0.1;

    // Create a torus segment to represent the elbow
    const elbow = BABYLON.MeshBuilder.CreateTorus(
      `elbow_${segment.id}`,
      {
        diameter: bendRadius * 2,
        thickness: diameter,
        tessellation: 32,
      },
      this.scene
    );

    // Position at start point
    elbow.position = start;

    // Orient to match bend direction (simplified)
    // Full implementation would calculate proper rotation
    const direction = end.subtract(start).normalize();
    if (Math.abs(direction.y) < 0.99) {
      const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), direction);
      const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), direction));
      if (axis.length() > 0.001) {
        elbow.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
      }
    }

    return elbow;
  }

  /**
   * Create support/hanger geometry
   */
  private createSupport(support: SupportPoint): BABYLON.Mesh {
    const position = this.toBabylonVector(support.position);

    let supportMesh: BABYLON.Mesh;

    switch (support.type) {
      case 'hanger':
        // Create pipe hanger (U-shaped bracket)
        supportMesh = this.createHanger(position);
        break;
      case 'clamp':
        // Create clamp (cylinder around pipe)
        supportMesh = this.createClamp(position);
        break;
      case 'bracket':
        // Create bracket (L-shaped support)
        supportMesh = this.createBracket(position);
        break;
      default:
        // Default to hanger
        supportMesh = this.createHanger(position);
    }

    supportMesh.name = `support_${support.id}`;
    return supportMesh;
  }

  /**
   * Create pipe hanger (U-shaped bracket)
   */
  private createHanger(position: BABYLON.Vector3): BABYLON.Mesh {
    // Create simple U-shape from cylinders
    const meshes: BABYLON.Mesh[] = [];

    // Vertical support
    const vertical = BABYLON.MeshBuilder.CreateCylinder(
      'hanger_vertical',
      {
        height: 0.2,
        diameter: 0.02,
        tessellation: 8,
      },
      this.scene
    );
    vertical.position = position.subtract(new BABYLON.Vector3(0, 0.1, 0));
    meshes.push(vertical);

    // U-shaped bracket
    const bracket = BABYLON.MeshBuilder.CreateTorus(
      'hanger_bracket',
      {
        diameter: 0.12,
        thickness: 0.015,
        tessellation: 16,
      },
      this.scene
    );
    bracket.position = position;
    bracket.rotation.x = Math.PI / 2;
    meshes.push(bracket);

    const combined = BABYLON.Mesh.MergeMeshes(meshes, true, true) || vertical;
    combined.position = position;
    return combined;
  }

  /**
   * Create clamp (cylinder around pipe)
   */
  private createClamp(position: BABYLON.Vector3): BABYLON.Mesh {
    const clamp = BABYLON.MeshBuilder.CreateCylinder(
      'clamp',
      {
        height: 0.05,
        diameter: 0.12,
        tessellation: 16,
      },
      this.scene
    );
    clamp.position = position;
    return clamp;
  }

  /**
   * Create bracket (L-shaped support)
   */
  private createBracket(position: BABYLON.Vector3): BABYLON.Mesh {
    const meshes: BABYLON.Mesh[] = [];

    // Vertical leg
    const vertical = BABYLON.MeshBuilder.CreateBox(
      'bracket_vertical',
      {
        width: 0.03,
        height: 0.15,
        depth: 0.03,
      },
      this.scene
    );
    vertical.position = position.subtract(new BABYLON.Vector3(0, 0.075, 0));
    meshes.push(vertical);

    // Horizontal leg
    const horizontal = BABYLON.MeshBuilder.CreateBox(
      'bracket_horizontal',
      {
        width: 0.1,
        height: 0.03,
        depth: 0.03,
      },
      this.scene
    );
    horizontal.position = position.subtract(new BABYLON.Vector3(0, 0.015, 0));
    meshes.push(horizontal);

    const combined = BABYLON.Mesh.MergeMeshes(meshes, true, true) || vertical;
    combined.position = position;
    return combined;
  }
}

