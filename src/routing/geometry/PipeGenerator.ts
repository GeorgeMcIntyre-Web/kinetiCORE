// Pipe Generator - Generates 3D pipe geometry from routes
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteSegment, SupportPoint, BOMData, FittingCount, SupportCount } from '../core/types';
import { RouteGeometryGenerator } from './RouteGeometryGenerator';
import { PIPE_SIZES } from '../specifications/RouteSpecifications';

/**
 * PipeGenerator creates 3D pipe geometry (cylinders) along route paths
 * Includes elbows at bends and supports/hangers
 */
export class PipeGenerator extends RouteGeometryGenerator {
  /**
   * Get pipe diameter from specifications
   * @param route - Route with size specification
   * @returns Object with outer diameter (od) and inner diameter (id) in meters
   */
  private getPipeDiameter(route: Route): { od: number; id: number } {
    const size = route.source.specifications.size || '1/2"';
    const pipeSpec = PIPE_SIZES[size];
    
    if (!pipeSpec) {
      console.warn(`[PipeGenerator] Unknown pipe size: ${size}, using default 1/2"`);
      return PIPE_SIZES['1/2"'];
    }
    
    return pipeSpec;
  }

  /**
   * Compute bill of materials for this route
   * @param route - Route to compute BOM for
   * @returns BOM data with lengths, fittings, and materials
   */
  computeBOM(route: Route): BOMData {
    const size = route.source.specifications.size || '1/2"';
    const material = route.material.name || 'steel';
    const totalLength = route.getTotalLength();
    
    // Count elbows (bend segments)
    const elbowCount = route.segments.filter(s => s.segmentType === 'bend').length;
    
    // Count supports
    const supportCount = route.supports.length;
    
    const fittings: FittingCount[] = [];
    if (elbowCount > 0) {
      fittings.push({
        type: 'elbow',
        angle: 90,
        count: elbowCount
      });
    }
    
    const supports: SupportCount[] = [];
    if (supportCount > 0) {
      supports.push({
        type: 'hanger',
        spec: `Pipe Hanger ${size}`,
        count: supportCount
      });
    }
    
    return {
      type: 'pipe',
      size,
      material,
      totalLength,
      fittings,
      supports,
      estimatedCost: this.estimateCost(totalLength, material, elbowCount, supportCount)
    };
  }

  /**
   * Estimate cost for pipe route
   * @private
   */
  private estimateCost(
    length: number,
    material: string,
    elbowCount: number,
    supportCount: number
  ): number {
    // Rough cost estimates (in USD)
    const costPerMeter: Record<string, number> = {
      steel: 15,
      stainless: 30,
      copper: 25,
      PVC: 8,
      aluminum: 20
    };
    
    const elbowCost = 12; // per elbow
    const supportCost = 8; // per support
    
    const materialCostPerMeter = costPerMeter[material] || costPerMeter['steel'];
    const pipeCost = length * materialCostPerMeter;
    const fittingsCost = elbowCount * elbowCost;
    const supportsCost = supportCount * supportCost;
    
    return pipeCost + fittingsCost + supportsCost;
  }
  /**
   * Generate pipe geometry from route
   */
  generate(route: Route): BABYLON.Mesh {
    console.log('[PipeGenerator] 🔧 Generating pipe for route:', route.getId());
    console.log('[PipeGenerator] Segments:', route.segments.length, 'Supports:', route.supports.length);

    const meshes: BABYLON.Mesh[] = [];

    // Generate pipe segments
    for (const segment of route.segments) {
      console.log('[PipeGenerator] Processing segment:', segment.segmentType, 'length:', segment.length);
      if (segment.segmentType === 'straight') {
        const tube = this.createTube(segment, route);
        meshes.push(tube);
        console.log('[PipeGenerator] ✅ Created tube:', tube.name);
      } else if (segment.segmentType === 'bend') {
        const elbow = this.createElbow(segment, route.constraints.minBendRadius, route);
        meshes.push(elbow);
        console.log('[PipeGenerator] ✅ Created elbow:', elbow.name);
      }
    }

    // Generate supports
    for (const support of route.supports) {
        const supportMesh = this.createSupport(support, route);
      meshes.push(supportMesh);
      console.log('[PipeGenerator] ✅ Created support:', supportMesh.name);
    }

    console.log('[PipeGenerator] Total meshes created:', meshes.length);

    // Handle empty meshes case
    if (meshes.length === 0) {
      console.error('[PipeGenerator] ❌ No meshes created! Creating fallback cylinder');
      // Create a minimal fallback mesh to prevent errors
      const fallback = BABYLON.MeshBuilder.CreateCylinder(
        `pipe_fallback_${route.getId()}`,
        { height: 1, diameter: 0.04 },
        this.scene
      );
      fallback.isVisible = true;
      const material = this.createMaterial(route.type, `pipe_mat_${route.getId()}`);
      fallback.material = material;
      return fallback;
    }

    // Combine all meshes
    const combined = this.combineMeshes(meshes, `pipe_${route.getId()}`);
    const material = this.createPipeMaterial(route, `pipe_mat_${route.getId()}`);
    combined.material = material;

    console.log('[PipeGenerator] ✅ Combined mesh created:', combined.name);
    return combined;
  }

  /**
   * Create material for pipe based on material specification
   * Overrides base createMaterial to support material-specific colors
   */
  private createPipeMaterial(route: Route, name: string): BABYLON.StandardMaterial {
    const material = new BABYLON.StandardMaterial(name, this.scene);
    const materialName = (route.material.name || 'steel').toLowerCase();

    // Material-specific colors
    const materialColors: Record<string, BABYLON.Color3> = {
      steel: BABYLON.Color3.Gray(),
      stainless: BABYLON.Color3.FromHexString('#C0C0C0'), // Silver
      pvc: BABYLON.Color3.White(),
      copper: BABYLON.Color3.FromHexString('#B87333'), // Copper color
      aluminum: BABYLON.Color3.FromHexString('#A8A9AD'), // Light gray
    };

    const color = materialColors[materialName] || materialColors['steel'];
    material.diffuseColor = color;

    // Metallic materials have more specular reflection
    if (['steel', 'stainless', 'aluminum', 'copper'].includes(materialName)) {
      material.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
      material.specularPower = 64;
    } else {
      // PVC and other plastics
      material.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
      material.specularPower = 32;
    }

    return material;
  }

  /**
   * Create a tube (cylinder) along a straight segment
   */
  private createTube(segment: RouteSegment, route?: Route): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    // Calculate direction and length
    const direction = end.subtract(start);
    const length = direction.length();
    direction.normalize();

    // Get diameter from specifications (route is passed as parameter)
    const { od } = route ? this.getPipeDiameter(route) : { od: 0.04 };
    const diameter = od;

    // Create cylinder with proper tessellation for smooth appearance
    const cylinder = BABYLON.MeshBuilder.CreateCylinder(
      `tube_${segment.id}`,
      {
        height: length,
        diameter,
        tessellation: 24, // Higher tessellation for smoother pipes
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
  private createElbow(segment: RouteSegment, minBendRadius: number, route?: Route): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    // Use bend radius from segment or default to minBendRadius
    const bendRadius = segment.bendRadius || minBendRadius;

    // Get diameter from specifications (route is passed as parameter)
    const { od } = route ? this.getPipeDiameter(route) : { od: 0.04 };
    const diameter = od;

    // Create a torus segment to represent the elbow
    const elbow = BABYLON.MeshBuilder.CreateTorus(
      `elbow_${segment.id}`,
      {
        diameter: bendRadius * 2,
        thickness: diameter,
        tessellation: 32, // Higher tessellation for smoother elbows
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
  private createSupport(support: SupportPoint, _route?: Route): BABYLON.Mesh {
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

