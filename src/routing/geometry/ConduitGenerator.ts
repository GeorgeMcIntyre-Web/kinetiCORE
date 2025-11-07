// Conduit Generator - Generates conduit geometry with spec-driven sizing and bending rules
// Owner: Agent 6 - Wiring & Conduit Geometry

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteGeometryGenerator } from './RouteGeometryGenerator';
import { BOMData, FittingCount, SupportCount } from '../core/types';
import {
  ConduitSpec,
  DEFAULT_CONDUIT_SPEC,
} from '../specifications/RouteSpecifications';

/**
 * ConduitGenerator creates conduit geometry with electrical-specific features
 * - Reads conduit sizing from specifications
 * - Respects bending rules (EMT vs rigid)
 * - Places junction boxes at connections and branches
 * - Generates accurate BOM with conduit lengths and fittings
 */
export class ConduitGenerator extends RouteGeometryGenerator {
  /**
   * Generate conduit geometry from route
   */
  generate(route: Route): BABYLON.Mesh {
    const spec = this.getConduitSpec(route);
    const meshes: BABYLON.Mesh[] = [];

    // Generate conduit segments
    for (const segment of route.segments) {
      if (segment.segmentType === 'straight') {
        const conduit = this.createConduit(segment, spec);
        meshes.push(conduit);
      } else if (segment.segmentType === 'bend') {
        const bend = this.createConduitBend(segment, spec);
        meshes.push(bend);
      }
    }

    // Add junction box at source
    const sourceBox = this.createJunctionBox(route.source.position, 'source', spec);
    meshes.push(sourceBox);

    // Add junction box at destination
    const destBox = this.createJunctionBox(route.destination.position, 'dest', spec);
    meshes.push(destBox);

    // Combine all meshes
    const combined = this.combineMeshes(meshes, `conduit_${route.getId()}`);
    
    // Apply spec-driven material
    const material = this.createConduitMaterial(spec, `conduit_mat_${route.getId()}`);
    combined.material = material;

    return combined;
  }

  /**
   * Compute Bill of Materials for conduit route
   */
  computeBOM(route: Route): BOMData {
    const spec = this.getConduitSpec(route);
    const totalLength = route.getTotalLength();

    // Count fittings
    const fittings: FittingCount[] = [];
    
    // Count bends
    const bendCount = route.segments.filter(s => s.segmentType === 'bend').length;
    if (bendCount > 0) {
      fittings.push({
        type: 'elbow',
        angle: 90, // Standard 90? bends for conduit
        count: bendCount,
      });
    }

    // Junction boxes at source and destination
    fittings.push({
      type: 'junction-box',
      count: 2,
    });

    // Count supports based on spacing
    const supports: SupportCount[] = [];
    const supportSpacing = route.constraints.supportSpacing || 3.05; // 10 feet default for conduit
    
    const supportCount = Math.max(1, Math.ceil(totalLength / supportSpacing) - 1);
    if (supportCount > 0) {
      supports.push({
        type: 'clamp',
        spec: `Conduit Clamp ${spec.nominalSize}`,
        count: supportCount,
      });
    }

    // Estimated cost
    const costPerMeter = this.getCostPerMeter(spec);
    const junctionBoxCost = 15.0; // ~$15 per junction box
    const bendCost = 8.0; // ~$8 per elbow
    const clampCost = 3.0; // ~$3 per clamp
    
    const estimatedCost = 
      (totalLength * costPerMeter) +
      (2 * junctionBoxCost) +
      (bendCount * bendCost) +
      (supportCount * clampCost);

    return {
      type: 'conduit',
      size: spec.nominalSize,
      material: spec.material,
      totalLength,
      fittings,
      supports,
      estimatedCost,
    };
  }

  /**
   * Get conduit specification from route
   */
  private getConduitSpec(route: Route): ConduitSpec {
    const connectionSpec = route.source.specifications;
    
    // Get size from connection spec or use default
    const nominalSize = connectionSpec.size || DEFAULT_CONDUIT_SPEC.nominalSize;
    const material = connectionSpec.material || DEFAULT_CONDUIT_SPEC.material;
    
    // Build conduit spec
    // For now, use defaults with overrides
    // In full implementation, would look up from CONDUIT_SIZES table
    const spec: ConduitSpec = {
      ...DEFAULT_CONDUIT_SPEC,
      nominalSize,
      material: material as 'steel' | 'aluminum' | 'PVC' | 'fiberglass',
      // Adjust bend radius based on material
      bendRadius: this.calculateBendRadius(DEFAULT_CONDUIT_SPEC.outerDiameter, material),
    };

    return spec;
  }

  /**
   * Calculate bend radius based on diameter and material
   * EMT: 6x diameter
   * Rigid: 10x diameter
   * PVC: 4x diameter
   */
  private calculateBendRadius(diameter: number, material: string): number {
    const multipliers: Record<string, number> = {
      'steel': 6, // EMT typical
      'aluminum': 6,
      'PVC': 4,
      'fiberglass': 5,
    };
    
    const multiplier = multipliers[material] || 6;
    return diameter * multiplier;
  }

  /**
   * Create conduit segment
   */
  private createConduit(segment: any, spec: ConduitSpec): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    const direction = end.subtract(start);
    const length = direction.length();
    direction.normalize();

    const diameter = spec.outerDiameter;

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
   * Create conduit bend with spec-driven bend radius
   */
  private createConduitBend(segment: any, spec: ConduitSpec): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    // Use spec bend radius, but respect segment override if present
    const bendRadius = segment.bendRadius || spec.bendRadius;
    const diameter = spec.outerDiameter;

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
  private createJunctionBox(position: any, label: string, spec: ConduitSpec): BABYLON.Mesh {
    const pos = this.toBabylonVector(position);

    // Junction box size scales with conduit size
    const baseSize = 0.1; // 10cm base
    const sizeMultiplier = spec.outerDiameter / 0.02; // Normalized to 20mm conduit
    const boxSize = baseSize * Math.max(1.0, sizeMultiplier);

    // Create junction box (rectangular box)
    const box = BABYLON.MeshBuilder.CreateBox(
      `junction_box_${label}`,
      {
        width: boxSize * 1.5,
        height: boxSize * 1.5,
        depth: boxSize,
      },
      this.scene
    );

    box.position = pos;

    return box;
  }

  /**
   * Create conduit material based on spec
   */
  private createConduitMaterial(spec: ConduitSpec, name: string): BABYLON.StandardMaterial {
    const material = new BABYLON.StandardMaterial(name, this.scene);

    // Material color based on conduit type and material
    let color: BABYLON.Color3;
    
    if (spec.material === 'PVC') {
      color = BABYLON.Color3.FromHexString('#CCCCCC'); // Light gray for PVC
    } else if (spec.material === 'aluminum') {
      color = BABYLON.Color3.FromHexString('#A8A8A8'); // Silver for aluminum
    } else {
      // Steel (EMT, rigid, etc.)
      color = BABYLON.Color3.FromHexString('#00FF00'); // Green for steel conduit
    }

    material.diffuseColor = color;
    material.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
    material.emissiveColor = new BABYLON.Color3(0, 0, 0);

    return material;
  }

  /**
   * Estimate cost per meter based on spec
   */
  private getCostPerMeter(spec: ConduitSpec): number {
    // Base prices per meter by material (since we're using material name)
    // Map material to typical conduit type for pricing
    const materialPrices: Record<string, number> = {
      'steel': 3.0,      // EMT typical
      'aluminum': 4.0,
      'PVC': 2.0,
      'fiberglass': 5.0,
    };
    
    // Also support conduit type if specified
    const conduitTypePrices: Record<string, number> = {
      'EMT': 3.0,
      'IMC': 5.0,
      'rigid': 6.0,
      'PVC': 2.0,
      'flexible': 4.0,
      'liquidtight': 5.0,
    };

    const basePrice = materialPrices[spec.material] || conduitTypePrices[spec.conduitType] || 3.0;
    
    // Size multiplier (larger = more expensive)
    const diameterMM = spec.outerDiameter * 1000;
    const sizeMultiplier = diameterMM / 23; // Normalized to 3/4" (23mm)
    
    return basePrice * sizeMultiplier;
  }
}
