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
import { CableTrayGenerator } from './CableTrayGenerator';
import { Route } from '../core/Route';
import { ConnectionPoint } from '../core/ConnectionPoint';
import { RouteSegment, MaterialSpec, RouteConstraints } from '../core/types';
import { Vector3 } from '../../core/types';

describe('CableTrayGenerator', () => {
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

  describe('Spec-Driven Sizing (TC-TRAY1)', () => {
    it('should use default cable tray spec dimensions', () => {
      // Create route with default specs
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        {}
      );
      const destination = new ConnectionPoint(
        { x: 10, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        {}
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

      const material: MaterialSpec = { name: 'galvanized-steel' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.3,
        supportSpacing: 3.66, // 12 feet
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);

      // Generate geometry
      const mesh = generator.generate(route);

      // Verify mesh was created
      expect(mesh).toBeDefined();
      expect(mesh.name).toContain('cable_tray');
    });

    it('should use custom width from specifications', () => {
      // Create route with custom width
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        { width: 0.6, height: 0.1 } // 600mm wide, 100mm high
      );
      const destination = new ConnectionPoint(
        { x: 10, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        { width: 0.6, height: 0.1 }
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

      // Verify BOM reflects custom dimensions
      expect(bom.width).toBe(0.6);
      expect(bom.height).toBe(0.1);
    });

    it('should support different tray types', () => {
      const trayTypes = ['ladder', 'solid-bottom', 'ventilated', 'wire-mesh'];

      for (const trayType of trayTypes) {
        const source = new ConnectionPoint(
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          'cable_tray',
          { trayType }
        );
        const destination = new ConnectionPoint(
          { x: 5, y: 0, z: 0 },
          { x: -1, y: 0, z: 0 },
          'cable_tray',
          { trayType }
        );

        const segments: RouteSegment[] = [
          {
            id: `seg_${trayType}`,
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 5, y: 0, z: 0 },
            segmentType: 'straight',
            length: 5,
          },
        ];

        const material: MaterialSpec = { name: 'galvanized-steel' };
        const constraints: RouteConstraints = {
          minBendRadius: 0.3,
          supportSpacing: 3.66,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        };

        const route = new Route(source, destination, segments, material, constraints);
        const mesh = generator.generate(route);

        expect(mesh).toBeDefined();
        expect(mesh.name).toContain('cable_tray');
      }
    });
  });

  describe('Material-Based Colors', () => {
    it('should apply aluminum (silver) material color', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        { material: 'aluminum', color: 'silver' }
      );
      const destination = new ConnectionPoint(
        { x: 5, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        { material: 'aluminum', color: 'silver' }
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 5, y: 0, z: 0 },
          segmentType: 'straight',
          length: 5,
        },
      ];

      const material: MaterialSpec = { name: 'aluminum' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.3,
        supportSpacing: 3.66,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);
      const mesh = generator.generate(route);

      expect(mesh.material).toBeDefined();
      const mat = mesh.material as BABYLON.StandardMaterial;
      expect(mat.diffuseColor).toBeDefined();
    });

    it('should apply steel (gray) material color', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        { material: 'galvanized-steel' }
      );
      const destination = new ConnectionPoint(
        { x: 5, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        { material: 'galvanized-steel' }
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 5, y: 0, z: 0 },
          segmentType: 'straight',
          length: 5,
        },
      ];

      const material: MaterialSpec = { name: 'galvanized-steel' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.3,
        supportSpacing: 3.66,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);
      const mesh = generator.generate(route);

      expect(mesh.material).toBeDefined();
    });

    it('should apply fiberglass (white) material color', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        { material: 'fiberglass', color: 'white' }
      );
      const destination = new ConnectionPoint(
        { x: 5, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        { material: 'fiberglass', color: 'white' }
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 5, y: 0, z: 0 },
          segmentType: 'straight',
          length: 5,
        },
      ];

      const material: MaterialSpec = { name: 'fiberglass' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.3,
        supportSpacing: 3.66,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);
      const mesh = generator.generate(route);

      expect(mesh.material).toBeDefined();
    });
  });

  describe('BOM Calculation', () => {
    it('should calculate total length correctly', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        {}
      );
      const destination = new ConnectionPoint(
        { x: 10, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        {}
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 5, y: 0, z: 0 },
          segmentType: 'straight',
          length: 5,
        },
        {
          id: 'seg2',
          startPoint: { x: 5, y: 0, z: 0 },
          endPoint: { x: 10, y: 0, z: 0 },
          segmentType: 'straight',
          length: 5,
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

      expect(bom.totalLength).toBe(10);
      expect(bom.type).toBe('cable_tray');
    });

    it('should count elbow fittings correctly', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        {}
      );
      const destination = new ConnectionPoint(
        { x: 10, y: 5, z: 0 },
        { x: 0, y: 1, z: 0 },
        'cable_tray',
        {}
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 10, y: 0, z: 0 },
          segmentType: 'straight',
          length: 10,
        },
        {
          id: 'seg2',
          startPoint: { x: 10, y: 0, z: 0 },
          endPoint: { x: 10, y: 5, z: 0 },
          segmentType: 'bend',
          length: 5,
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

      // Should count 1 elbow for the bend
      expect(bom.fittings.length).toBeGreaterThan(0);
      const elbowFittings = bom.fittings.filter((f) => f.type.includes('elbow'));
      expect(elbowFittings.length).toBeGreaterThan(0);
    });

    it('should include cost estimation', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        {}
      );
      const destination = new ConnectionPoint(
        { x: 10, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        {}
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

      expect(bom.estimatedCost).toBeDefined();
      expect(bom.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('Support Placement (TC-TRAY2)', () => {
    it('should place supports every 12 feet (3.66m)', () => {
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
      
      // Generate geometry (this should add supports to route)
      generator.generate(route);

      // Expected supports: 15m / 3.66m ? 4.1, so 4 supports
      const expectedSupports = Math.floor(15 / 3.66);
      expect(route.supports.length).toBeGreaterThanOrEqual(expectedSupports - 1);
      expect(route.supports.length).toBeLessThanOrEqual(expectedSupports + 1);
    });

    it('should include support count in BOM', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        {}
      );
      const destination = new ConnectionPoint(
        { x: 20, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        {}
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 20, y: 0, z: 0 },
          segmentType: 'straight',
          length: 20,
        },
      ];

      const material: MaterialSpec = { name: 'aluminum' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.3,
        supportSpacing: 3.66,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);
      
      // Generate geometry first (adds supports)
      generator.generate(route);
      
      // Then compute BOM
      const bom = generator.computeBOM(route);

      expect(bom.supports.length).toBeGreaterThan(0);
      expect(bom.supports[0].count).toBeGreaterThan(0);
    });

    it('should have correct support specifications', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        { width: 0.4 } // 400mm width
      );
      const destination = new ConnectionPoint(
        { x: 10, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        { width: 0.4 }
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
      generator.generate(route);

      // Check support specifications include width
      expect(route.supports.length).toBeGreaterThan(0);
      expect(route.supports[0].specification).toContain('400mm');
    });
  });

  describe('Performance', () => {
    it('should generate geometry in <50ms for single route', () => {
      const source = new ConnectionPoint(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        'cable_tray',
        {}
      );
      const destination = new ConnectionPoint(
        { x: 50, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        'cable_tray',
        {}
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 50, y: 0, z: 0 },
          segmentType: 'straight',
          length: 50,
        },
      ];

      const material: MaterialSpec = { name: 'aluminum' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.3,
        supportSpacing: 3.66,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);

      const start = performance.now();
      generator.generate(route);
      const duration = performance.now() - start;

      // Should generate in less than 50ms
      expect(duration).toBeLessThan(50);
    });
  });
});
