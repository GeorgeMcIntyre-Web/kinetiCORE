// Base Route Geometry Generator - Abstract base class for geometry generation
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Route } from '../core/Route';
import { RouteSegment, RouteType } from '../core/types';
import { Vector3 } from '../../core/types';

/**
 * Abstract base class for route geometry generators
 * Provides common utilities for creating 3D meshes from routes
 */
export abstract class RouteGeometryGenerator {
  protected scene: BABYLON.Scene;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Generate 3D mesh from route
   * Must be implemented by subclasses
   */
  abstract generate(route: Route): BABYLON.Mesh;

  /**
   * Create a Curve3 from route segments
   * Handles Z-up to Y-up conversion for Babylon.js
   */
  protected createCurveFromSegments(segments: RouteSegment[]): BABYLON.Curve3 {
    const points: BABYLON.Vector3[] = [];

    if (segments.length === 0) {
      const emptyPoints: BABYLON.Vector3[] = [];
      return new BABYLON.Curve3(emptyPoints);
    }

    // Add start point of first segment
    const firstStart = segments[0].startPoint;
    points.push(new BABYLON.Vector3(firstStart.x, firstStart.z, -firstStart.y));

    // Add end points of all segments
    for (const segment of segments) {
      const end = segment.endPoint;
      points.push(new BABYLON.Vector3(end.x, end.z, -end.y));
    }

    // Create curve through points
    // For straight segments, use simple linear interpolation
    // For bends, we could use Catmull-Rom or Hermite splines
    if (points.length < 2) {
      // Return a minimal curve with at least 2 points
      const start = points.length > 0 ? points[0] : new BABYLON.Vector3(0, 0, 0);
      const end = points.length > 0 ? (points[points.length - 1] || start) : start.clone();
      // For simple linear interpolation, just use the points directly
      // Full implementation would use CreateHermiteSpline with proper parameters
      return new BABYLON.Curve3([start, end]);
    }
    // For now, create a simple linear curve through all points
    // Full implementation would use CreateHermiteSpline or CreateCatmullRomSpline
    // with proper tangent calculations for smooth bends
    return new BABYLON.Curve3(points);
  }

  /**
   * Create material for route based on type
   */
  protected createMaterial(type: RouteType, name?: string): BABYLON.StandardMaterial {
    const material = new BABYLON.StandardMaterial(
      name || `route_material_${type}`,
      this.scene
    );

    // Default colors by type - matching design specification
    const typeColors: Record<RouteType, BABYLON.Color3> = {
      pipe: BABYLON.Color3.FromHexString('#00D9FF'), // Blue for water/industrial
      electrical: BABYLON.Color3.FromHexString('#FFD700'), // Yellow/gold for electrical
      cable_tray: BABYLON.Color3.FromHexString('#FF8C00'), // Orange for cable tray
      conduit: BABYLON.Color3.FromHexString('#00FF00'), // Green for conduit
    };

    material.diffuseColor = typeColors[type];
    
    // Material properties based on type
    if (type === 'electrical') {
      // Electrical wires should be slightly emissive (glows in dark)
      material.emissiveColor = typeColors[type].scale(0.3);
      material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    } else if (type === 'pipe') {
      // Pipes should have metallic appearance
      material.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
      material.emissiveColor = new BABYLON.Color3(0, 0, 0);
      // Use PBR material for better metallic look (would need to check if available)
    } else if (type === 'cable_tray') {
      // Cable tray: matte metal (galvanized look)
      material.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
      material.emissiveColor = new BABYLON.Color3(0, 0, 0);
    } else if (type === 'conduit') {
      // Conduit: semi-glossy plastic or metal
      material.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
      material.emissiveColor = new BABYLON.Color3(0, 0, 0);
    } else {
      // Fallback for any other route types
      const fallbackColor = typeColors[type as RouteType] || new BABYLON.Color3(0.5, 0.5, 0.5);
      material.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
      material.emissiveColor = fallbackColor.scale(0.2);
    }

    return material;
  }

  /**
   * Combine multiple meshes into one
   */
  protected combineMeshes(meshes: BABYLON.Mesh[], name: string): BABYLON.Mesh {
    if (meshes.length === 0) {
      throw new Error('Cannot combine empty mesh array');
    }

    if (meshes.length === 1) {
      meshes[0].name = name;
      return meshes[0];
    }

    // Merge meshes
    const merged = BABYLON.Mesh.MergeMeshes(meshes, true, true);
    if (!merged) {
      // Fallback: return first mesh if merge fails
      meshes[0].name = name;
      return meshes[0];
    }

    merged.name = name;
    return merged;
  }

  /**
   * Convert Z-up Vector3 to Babylon.js Y-up Vector3
   */
  protected toBabylonVector(v: Vector3): BABYLON.Vector3 {
    return new BABYLON.Vector3(v.x, v.z, -v.y);
  }

  /**
   * Convert Y-up Babylon Vector3 to Z-up Vector3
   */
  protected fromBabylonVector(v: BABYLON.Vector3): Vector3 {
    return { x: v.x, y: -v.z, z: v.y };
  }
}

