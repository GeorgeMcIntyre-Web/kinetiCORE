/**
 * Cable Tray Generator Tests
 * Owner: Agent 5 (Cable Tray Geometry)
 * 
 * Acceptance Tests:
 * - TC-TRAY1: Tray width/height match specs
 * - TC-TRAY2: Fittings at junctions, supports every 12 feet
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { CableTrayGenerator } from '../../src/routing/geometry/CableTrayGenerator';
import { Route } from '../../src/routing/core/Route';
import { ConnectionPoint } from '../../src/routing/core/ConnectionPoint';
import { RouteSegment, MaterialSpec, RouteConstraints } from '../../src/routing/core/types';

describe('Agent5-CableTrayGeometry', () => {
  let scene: BABYLON.Scene;
  let engine: BABYLON.Engine;
  let generator: CableTrayGenerator;

  beforeEach(() => {
    // Create a mock canvas for Babylon.js
    const canvas = document.createElement('canvas');
    engine = new BABYLON.Engine(canvas, false, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    scene = new BABYLON.Scene(engine);
    generator = new CableTrayGenerator(scene);
  });

  describe('TC-TRAY1: Tray sizing from specifications', () => {
    it('should generate cable tray with correct dimensions', () => {
      // Create route with custom dimensions
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        { width: 0.4, height: 0.075 } // 400mm x 75mm
      );
      const destination = new ConnectionPoint(
        { x: 10, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        { width: 0.4, height: 0.075 }
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 10, y: 0, z: 0 },
          segmentType: 'straight',
          length: 10,
        },
      ];

      const material: MaterialSpec = { name: 'aluminum' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.3,
        supportSpacing: 3.66,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);
      const bom = generator.computeBOM(route);

      // Verify dimensions match spec
      expect(bom.width).toBe(0.4);
      expect(bom.height).toBe(0.075);
      expect(bom.type).toBe('cable_tray');
    });
  });

  describe('TC-TRAY2: Support placement every 12 feet', () => {
    it('should place supports at correct spacing', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        {}
      );
      const destination = new ConnectionPoint(
        { x: 15, y: 0, z: 0 }, // 15 meters
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        {}
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 15, y: 0, z: 0 },
          segmentType: 'straight',
          length: 15,
        },
      ];

      const material: MaterialSpec = { name: 'aluminum' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.3,
        supportSpacing: 3.66, // 12 feet
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);
      
      // Generate geometry (adds supports)
      generator.generate(route);

      // Expected: 15m / 3.66m ≈ 4 supports
      const expectedSupports = Math.floor(15 / 3.66);
      expect(route.supports.length).toBeGreaterThanOrEqual(expectedSupports - 1);
      expect(route.supports.length).toBeLessThanOrEqual(expectedSupports + 1);
    });
  });
});
