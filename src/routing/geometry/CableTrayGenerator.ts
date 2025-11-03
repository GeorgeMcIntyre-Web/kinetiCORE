// Cable Tray Generator - Generates cable tray channel geometry with spec-driven sizing
// Owner: Agent 5 (Cable Tray Geometry)

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteGeometryGenerator } from './RouteGeometryGenerator';
import {
  CableTraySpec,
  DEFAULT_CABLE_TRAY_SPEC,
} from '../specifications/RouteSpecifications';
import { Vector3 } from '../../core/types';
import { SupportPoint } from '../core/types';
import { generateId } from '../core/RoutingUtils';

/**
 * BOM data for cable tray export
 */
export interface CableTrayBOMData {
  type: 'cable_tray';
  width: number;
  height: number;
  trayType: string;
  material: string;
  totalLength: number;
  fittings: Array<{ type: string; angle?: number; count: number }>;
  supports: Array<{ type: string; specification: string; count: number }>;
  estimatedCost?: number;
}

/**
 * CableTrayGenerator creates cable tray channel geometry with supports and fittings
 * Reads dimensions from CableTraySpec for spec-driven sizing
 */
export class CableTrayGenerator extends RouteGeometryGenerator {
  /**
   * Generate cable tray geometry from route
   */
  generate(route: Route): BABYLON.Mesh {
    const meshes: BABYLON.Mesh[] = [];
    const spec = this.getCableTraySpec(route);

    // Generate tray segments
    for (const segment of route.segments) {
      if (segment.segmentType === 'straight') {
        const tray = this.createTraySegment(segment, spec);
        meshes.push(tray);
      } else if (segment.segmentType === 'bend') {
        // Create elbow fitting at bend
        const elbow = this.createElbowFitting(segment, spec);
        meshes.push(elbow);
      }
    }

    // Generate supports at spacing intervals
    this.generateSupports(route, meshes, spec);

    // Combine all meshes
    const combined = this.combineMeshes(meshes, `cable_tray_${route.getId()}`);
    const material = this.createCableTrayMaterial(spec, `cable_tray_mat_${route.getId()}`);
    combined.material = material;

    return combined;
  }

  /**
   * Compute Bill of Materials for cable tray route
   */
  computeBOM(route: Route): CableTrayBOMData {
    const spec = this.getCableTraySpec(route);
    const totalLength = route.getTotalLength();

    // Count fittings by type
    const fittingCounts = new Map<string, number>();
    for (const segment of route.segments) {
      if (segment.segmentType === 'bend') {
        const angle = this.calculateBendAngle(segment);
        const fittingType = angle > 60 ? '90? elbow' : '45? elbow';
        fittingCounts.set(fittingType, (fittingCounts.get(fittingType) || 0) + 1);
      }
    }

    // Convert to array
    const fittings = Array.from(fittingCounts.entries()).map(([type, count]) => ({
      type,
      angle: type.includes('90?') ? 90 : 45,
      count,
    }));

    // Count supports
    const supportCount = route.supports.length;
    const supports = [
      {
        type: 'bracket',
        specification: `Cable Tray Bracket ${spec.width * 1000}mm`,
        count: supportCount,
      },
    ];

    // Estimate cost (rough approximation)
    // Cable tray: $30-50 per meter depending on size
    const costPerMeter = 30 + (spec.width / 0.6) * 20; // Larger trays cost more
    const straightCost = totalLength * costPerMeter;
    const fittingCost = fittings.reduce((sum, f) => sum + f.count * 50, 0); // $50 per fitting
    const supportCost = supportCount * 25; // $25 per support
    const estimatedCost = straightCost + fittingCost + supportCost;

    return {
      type: 'cable_tray',
      width: spec.width,
      height: spec.height,
      trayType: spec.trayType,
      material: spec.material,
      totalLength,
      fittings,
      supports,
      estimatedCost,
    };
  }

  /**
   * Get cable tray specification from route or use default
   */
  private getCableTraySpec(route: Route): CableTraySpec {
    // Try to get spec from route source specifications
    const sourceSpec = route.source.specifications as Partial<CableTraySpec>;

    // Build spec from available data or use defaults
    const spec: CableTraySpec = {
      width: (sourceSpec.width as number) || DEFAULT_CABLE_TRAY_SPEC.width,
      height: (sourceSpec.height as number) || DEFAULT_CABLE_TRAY_SPEC.height,
      trayType: sourceSpec.trayType || DEFAULT_CABLE_TRAY_SPEC.trayType,
      rungSpacing: (sourceSpec.rungSpacing as number) || DEFAULT_CABLE_TRAY_SPEC.rungSpacing,
      material: (sourceSpec.material as typeof DEFAULT_CABLE_TRAY_SPEC.material) || DEFAULT_CABLE_TRAY_SPEC.material,
      finish: sourceSpec.finish || DEFAULT_CABLE_TRAY_SPEC.finish,
      loadRating: (sourceSpec.loadRating as number) || DEFAULT_CABLE_TRAY_SPEC.loadRating,
      maxCables: (sourceSpec.maxCables as number) || DEFAULT_CABLE_TRAY_SPEC.maxCables,
      color: sourceSpec.color || DEFAULT_CABLE_TRAY_SPEC.color,
    };

    return spec;
  }

  /**
   * Create tray segment (U-shaped channel or ladder)
   */
  private createTraySegment(segment: any, spec: CableTraySpec): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    const direction = end.subtract(start);
    const length = direction.length();
    direction.normalize();

    // Use spec dimensions
    const width = spec.width;
    const depth = spec.height;
    const sideThickness = 0.01; // 10mm side thickness
    const meshes: BABYLON.Mesh[] = [];

    // Create based on tray type
    if (spec.trayType === 'ladder') {
      meshes.push(...this.createLadderTray(segment.id, width, depth, length, spec.rungSpacing));
    } else if (spec.trayType === 'solid-bottom') {
      meshes.push(...this.createSolidBottomTray(segment.id, width, depth, length, sideThickness));
    } else if (spec.trayType === 'ventilated') {
      meshes.push(
        ...this.createVentilatedTray(segment.id, width, depth, length, sideThickness)
      );
    } else if (spec.trayType === 'wire-mesh') {
      meshes.push(...this.createWireMeshTray(segment.id, width, depth, length));
    } else {
      // Default to ladder type
      meshes.push(...this.createLadderTray(segment.id, width, depth, length, spec.rungSpacing));
    }

    // Combine into single mesh
    const combined = BABYLON.Mesh.MergeMeshes(meshes, true, true);
    if (!combined) {
      // Fallback: return first mesh if merge fails
      meshes[0].name = `tray_${segment.id}`;
      return meshes[0];
    }

    combined.name = `tray_${segment.id}`;
    const midPoint = start.add(end).scale(0.5);
    combined.position = midPoint;

    // Rotate to align with direction
    if (Math.abs(direction.y) < 0.99) {
      const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), direction);
      const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), direction));
      if (axis.length() > 0.001) {
        combined.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
      }
    }

    return combined;
  }

  /**
   * Create ladder-style tray (rungs between sides)
   */
  private createLadderTray(
    segmentId: string,
    width: number,
    depth: number,
    length: number,
    rungSpacing: number
  ): BABYLON.Mesh[] {
    const meshes: BABYLON.Mesh[] = [];
    const sideThickness = 0.01;
    const rungThickness = 0.01;

    // Left side
    const leftSide = BABYLON.MeshBuilder.CreateBox(
      `tray_left_${segmentId}`,
      {
        width: sideThickness,
        height: depth,
        depth: length,
      },
      this.scene
    );
    leftSide.position = new BABYLON.Vector3(-width / 2 + sideThickness / 2, depth / 2, 0);
    meshes.push(leftSide);

    // Right side
    const rightSide = BABYLON.MeshBuilder.CreateBox(
      `tray_right_${segmentId}`,
      {
        width: sideThickness,
        height: depth,
        depth: length,
      },
      this.scene
    );
    rightSide.position = new BABYLON.Vector3(width / 2 - sideThickness / 2, depth / 2, 0);
    meshes.push(rightSide);

    // Add rungs along the length
    const numRungs = Math.floor(length / rungSpacing);
    for (let i = 0; i <= numRungs; i++) {
      const rungZ = -length / 2 + i * rungSpacing;
      const rung = BABYLON.MeshBuilder.CreateBox(
        `tray_rung_${segmentId}_${i}`,
        {
          width: width,
          height: rungThickness,
          depth: rungThickness,
        },
        this.scene
      );
      rung.position = new BABYLON.Vector3(0, 0, rungZ);
      meshes.push(rung);
    }

    return meshes;
  }

  /**
   * Create solid-bottom tray
   */
  private createSolidBottomTray(
    segmentId: string,
    width: number,
    depth: number,
    length: number,
    sideThickness: number
  ): BABYLON.Mesh[] {
    const meshes: BABYLON.Mesh[] = [];

    // Left side
    const leftSide = BABYLON.MeshBuilder.CreateBox(
      `tray_left_${segmentId}`,
      {
        width: sideThickness,
        height: depth,
        depth: length,
      },
      this.scene
    );
    leftSide.position = new BABYLON.Vector3(-width / 2 + sideThickness / 2, depth / 2, 0);
    meshes.push(leftSide);

    // Right side
    const rightSide = BABYLON.MeshBuilder.CreateBox(
      `tray_right_${segmentId}`,
      {
        width: sideThickness,
        height: depth,
        depth: length,
      },
      this.scene
    );
    rightSide.position = new BABYLON.Vector3(width / 2 - sideThickness / 2, depth / 2, 0);
    meshes.push(rightSide);

    // Solid bottom
    const bottom = BABYLON.MeshBuilder.CreateBox(
      `tray_bottom_${segmentId}`,
      {
        width: width,
        height: sideThickness,
        depth: length,
      },
      this.scene
    );
    bottom.position = new BABYLON.Vector3(0, 0, 0);
    meshes.push(bottom);

    return meshes;
  }

  /**
   * Create ventilated tray (solid bottom with holes)
   */
  private createVentilatedTray(
    segmentId: string,
    width: number,
    depth: number,
    length: number,
    sideThickness: number
  ): BABYLON.Mesh[] {
    // For simplicity, same as solid-bottom (would need CSG for actual holes)
    // In production, would use CSG to cut ventilation holes
    return this.createSolidBottomTray(segmentId, width, depth, length, sideThickness);
  }

  /**
   * Create wire-mesh tray
   */
  private createWireMeshTray(
    segmentId: string,
    width: number,
    _depth: number,
    length: number
  ): BABYLON.Mesh[] {
    const meshes: BABYLON.Mesh[] = [];
    const wireThickness = 0.005; // 5mm wire
    // const meshSpacing = 0.05; // 50mm mesh spacing (for future mesh grid implementation)

    // Create wire frame outline
    // Simplified: just create the outer frame
    // In production, would create full mesh grid

    // Left rail
    const leftRail = BABYLON.MeshBuilder.CreateCylinder(
      `tray_left_rail_${segmentId}`,
      {
        height: length,
        diameter: wireThickness,
      },
      this.scene
    );
    leftRail.rotation.x = Math.PI / 2;
    leftRail.position = new BABYLON.Vector3(-width / 2, 0, 0);
    meshes.push(leftRail);

    // Right rail
    const rightRail = BABYLON.MeshBuilder.CreateCylinder(
      `tray_right_rail_${segmentId}`,
      {
        height: length,
        diameter: wireThickness,
      },
      this.scene
    );
    rightRail.rotation.x = Math.PI / 2;
    rightRail.position = new BABYLON.Vector3(width / 2, 0, 0);
    meshes.push(rightRail);

    return meshes;
  }

  /**
   * Create elbow fitting at bend point
   */
  private createElbowFitting(segment: any, spec: CableTraySpec): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);
    const midPoint = start.add(end).scale(0.5);

    // const angle = this.calculateBendAngle(segment);
    // const isNinetyDegree = angle > 60; // Consider > 60? as 90? (for future bend optimization)

    // Create elbow as a bent channel
    const width = spec.width;
    const depth = spec.height;
    const elbowLength = width * 1.5; // Elbow length proportional to width

    // Simplified elbow: create a box representing the fitting
    const elbow = BABYLON.MeshBuilder.CreateBox(
      `tray_elbow_${segment.id}`,
      {
        width: width,
        height: depth,
        depth: elbowLength,
      },
      this.scene
    );
    elbow.position = midPoint;

    return elbow;
  }

  /**
   * Create tee fitting at branch point
   * Note: Currently routes don't support branching (Phase 2 feature)
   * This method is provided for future integration
   */
  createTeeFitting(position: Vector3, spec: CableTraySpec): BABYLON.Mesh {
    const pos = this.toBabylonVector(position);

    const width = spec.width;
    const depth = spec.height;
    const teeLength = width * 2;

    // Simplified tee: three-way junction
    const tee = BABYLON.MeshBuilder.CreateBox(
      `tray_tee_${Date.now()}`,
      {
        width: width,
        height: depth,
        depth: teeLength,
      },
      this.scene
    );
    tee.position = pos;

    return tee;
  }

  /**
   * Calculate bend angle from segment
   */
  private calculateBendAngle(_segment: any): number {
    // Simplified: return default 90? for now
    // In production, would calculate actual angle from adjacent segments
    return 90;
  }

  /**
   * Generate supports at spacing intervals
   */
  private generateSupports(route: Route, meshes: BABYLON.Mesh[], spec: CableTraySpec): void {
    const supportSpacing = route.constraints.supportSpacing;
    const waypoints = route.getWaypoints();

    // Clear existing supports
    route.supports = [];

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
        const supportPos: Vector3 = {
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
          z: start.z + (end.z - start.z) * t,
        };

        // Create support mesh
        const support = this.createTraySupport(supportPos, spec);
        meshes.push(support);

        // Add to route supports
        const supportPoint: SupportPoint = {
          id: generateId(),
          position: supportPos,
          type: 'bracket',
          specification: `Cable Tray Bracket ${spec.width * 1000}mm`,
        };
        route.supports.push(supportPoint);
      }
    }
  }

  /**
   * Create tray support (bracket/hanger)
   */
  private createTraySupport(position: Vector3, _spec: CableTraySpec): BABYLON.Mesh {
    const pos = this.toBabylonVector(position);

    // Create support bracket
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

  /**
   * Create material for cable tray based on material spec
   */
  private createCableTrayMaterial(spec: CableTraySpec, name: string): BABYLON.StandardMaterial {
    const material = new BABYLON.StandardMaterial(name, this.scene);

    // Material colors based on spec material
    const materialColors: Record<string, BABYLON.Color3> = {
      'galvanized-steel': BABYLON.Color3.Gray(),
      aluminum: BABYLON.Color3.FromHexString('#C0C0C0'), // Silver
      stainless: BABYLON.Color3.FromHexString('#E8E8E8'), // Bright silver
      fiberglass: BABYLON.Color3.White(),
    };

    // Use spec color or default to material-based color
    if (spec.color === 'orange') {
      material.diffuseColor = BABYLON.Color3.FromHexString('#FF8C00');
    } else if (spec.color === 'silver') {
      material.diffuseColor = BABYLON.Color3.FromHexString('#C0C0C0');
    } else if (spec.color === 'yellow') {
      material.diffuseColor = BABYLON.Color3.Yellow();
    } else if (spec.color === 'white') {
      material.diffuseColor = BABYLON.Color3.White();
    } else {
      // Default to material-based color
      material.diffuseColor = materialColors[spec.material] || BABYLON.Color3.Gray();
    }

    // Metallic appearance for steel/aluminum
    if (spec.material === 'galvanized-steel' || spec.material === 'aluminum') {
      material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
      material.specularPower = 64;
    } else if (spec.material === 'stainless') {
      material.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
      material.specularPower = 128;
    } else {
      // Fiberglass or other: matte finish
      material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
      material.specularPower = 32;
    }

    return material;
  }
}
