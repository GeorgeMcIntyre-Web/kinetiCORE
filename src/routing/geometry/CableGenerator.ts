// Cable Generator - Generates wire bundle geometry with spec-driven sizing
// Owner: Agent 6 - Wiring & Conduit Geometry

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteGeometryGenerator } from './RouteGeometryGenerator';
import { BOMData, FittingCount, SupportCount } from '../core/types';
import {
  ElectricalSpec,
  AWG_TO_METRIC,
  DEFAULT_ELECTRICAL_SPEC,
  calculateCableDiameter,
} from '../specifications/RouteSpecifications';

/**
 * CableGenerator creates wire bundle geometry with spec-driven sizing and color coding
 * - Reads wire gauge and diameter from specifications
 * - Color-codes cables by voltage
 * - Generates BOM with accurate cable lengths
 */
export class CableGenerator extends RouteGeometryGenerator {
  /**
   * Generate cable bundle geometry from route
   */
  generate(route: Route): BABYLON.Mesh {
    const spec = this.getElectricalSpec(route);
    const meshes: BABYLON.Mesh[] = [];

    // Generate cable bundle along route segments
    for (const segment of route.segments) {
      const cable = this.createCableBundle(segment, spec);
      meshes.push(cable);
    }

    // Combine all meshes
    const combined = this.combineMeshes(meshes, `cable_${route.getId()}`);
    
    // Apply spec-driven material with voltage-based color
    const material = this.createCableMaterial(spec, `cable_mat_${route.getId()}`);
    combined.material = material;

    return combined;
  }

  /**
   * Compute Bill of Materials for cable route
   */
  computeBOM(route: Route): BOMData {
    const spec = this.getElectricalSpec(route);
    const totalLength = route.getTotalLength();

    // Count junction boxes at source and destination (if any)
    const fittings: FittingCount[] = [];
    
    // For cables, junction boxes are typically at connections
    // We'll add 2 connectors (one at each end)
    fittings.push({
      type: 'coupling',
      count: 2, // Source and destination connectors
    });

    // Cables typically don't need intermediate supports unless very long
    const supports: SupportCount[] = [];
    const supportSpacing = route.constraints.supportSpacing || 10.0; // 10m default for cables
    
    if (totalLength > supportSpacing) {
      const supportCount = Math.ceil(totalLength / supportSpacing) - 1;
      if (supportCount > 0) {
        supports.push({
          type: 'clamp',
          spec: `Cable Clamp ${spec.wireGauge}`,
          count: supportCount,
        });
      }
    }

    // Estimated cost: rough approximation ($1-3 per meter for typical cables)
    const costPerMeter = this.getCostPerMeter(spec);
    const estimatedCost = totalLength * costPerMeter;

    return {
      type: 'electrical',
      size: spec.wireGauge,
      material: spec.insulationType,
      totalLength,
      fittings,
      supports,
      estimatedCost,
    };
  }

  /**
   * Get electrical specification from route
   */
  private getElectricalSpec(route: Route): ElectricalSpec {
    // Check if route has spec in source connection
    const connectionSpec = route.source.specifications;
    
    // Build electrical spec from connection specifications
    const voltage = connectionSpec.voltage || DEFAULT_ELECTRICAL_SPEC.voltage;
    const wireGauge = connectionSpec.size || DEFAULT_ELECTRICAL_SPEC.wireGauge;
    
    // Look up wire diameter from gauge
    const wireDiameterData = AWG_TO_METRIC[wireGauge];
    const wireDiameter = wireDiameterData?.diameter || DEFAULT_ELECTRICAL_SPEC.wireDiameter;
    
    // Build full spec
    const spec: ElectricalSpec = {
      ...DEFAULT_ELECTRICAL_SPEC,
      voltage,
      wireGauge,
      wireDiameter,
      outerDiameter: calculateCableDiameter({
        ...DEFAULT_ELECTRICAL_SPEC,
        wireDiameter,
      }),
    };

    return spec;
  }

  /**
   * Create cable bundle (multiple wires bundled together)
   */
  private createCableBundle(segment: any, spec: ElectricalSpec): BABYLON.Mesh {
    const start = this.toBabylonVector(segment.startPoint);
    const end = this.toBabylonVector(segment.endPoint);

    const direction = end.subtract(start);
    const length = direction.length();
    direction.normalize();

    // Number of wires in bundle based on spec
    const wireCount = spec.coreCount;
    const wireDiameter = spec.wireDiameter;
    const bundleDiameter = spec.outerDiameter;

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

      meshes.push(wire);
    }

    // Combine wires
    const combined = BABYLON.Mesh.MergeMeshes(meshes, true, true) || meshes[0];
    return combined;
  }

  /**
   * Create cable material with voltage-based color coding
   */
  private createCableMaterial(spec: ElectricalSpec, name: string): BABYLON.StandardMaterial {
    const material = new BABYLON.StandardMaterial(name, this.scene);

    // Color code by voltage
    // Low voltage (< 50V): White/silver
    // Medium voltage (50-240V): Yellow/gold
    // High voltage (> 240V): Orange/red
    let color: BABYLON.Color3;
    
    if (spec.voltage < 50) {
      color = BABYLON.Color3.FromHexString('#C0C0C0'); // Silver (low voltage)
    } else if (spec.voltage <= 240) {
      color = BABYLON.Color3.FromHexString('#FFD700'); // Yellow/gold (standard AC)
    } else {
      color = BABYLON.Color3.FromHexString('#FF8C00'); // Orange (high voltage)
    }

    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.3); // Slightly emissive for visibility
    material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    return material;
  }

  /**
   * Estimate cost per meter based on spec
   */
  private getCostPerMeter(spec: ElectricalSpec): number {
    // Rough cost estimation based on wire gauge and voltage
    // Thicker wire = more expensive
    // Higher voltage = more expensive insulation
    
    const basePrice = 1.0; // Base price per meter
    
    // Wire gauge multiplier (thicker = more expensive)
    const wireDiameterMM = spec.wireDiameter * 1000;
    const gaugeFactor = wireDiameterMM / 2.5; // Normalized to 14 AWG (2.5mm)
    
    // Voltage multiplier (higher voltage = better insulation)
    const voltageFactor = 1.0 + (spec.voltage / 600); // Normalized to 600V max
    
    // Core count multiplier
    const coreFactor = spec.coreCount / 3; // Normalized to 3-core
    
    return basePrice * gaugeFactor * voltageFactor * coreFactor;
  }
}
