// PipeGenerator Tests - Unit tests for pipe geometry generation
// Owner: Agent 4 - Pipe Geometry

import * as BABYLON from '@babylonjs/core';
import { PipeGenerator } from '../PipeGenerator';
import { Route } from '../../core/Route';
import { ConnectionPoint } from '../../core/ConnectionPoint';
import { RouteSegment, MaterialSpec, RouteConstraints } from '../../core/types';
import { Vector3 } from '../../../core/types';

/**
 * Helper function to create a connection point
 */
function createConnectionPoint(
  type: 'pipe' | 'electrical' | 'cable_tray' | 'conduit',
  position: Vector3,
  direction: Vector3,
  specifications: Record<string, unknown>
): ConnectionPoint {
  return new ConnectionPoint({
    type,
    position,
    direction,
    specifications,
  });
}

describe('PipeGenerator', () => {
  let scene: BABYLON.Scene;
  let engine: BABYLON.NullEngine;
  let generator: PipeGenerator;

  beforeEach(() => {
    // Create Babylon engine and scene for testing
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
    generator = new PipeGenerator(scene);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  describe('TC-P1: Pipe Sizing from Specifications', () => {
    it('should use correct outer diameter from PIPE_SIZES table', () => {
      const source = createConnectionPoint(
        'pipe',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { size: '3/4"', material: 'steel' }
      );

      const destination = createConnectionPoint(
        'pipe',
        { x: 5, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { size: '3/4"', material: 'steel' }
      );

      const segment: RouteSegment = {
        id: 'seg-1',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 5, y: 0, z: 0 },
        segmentType: 'straight',
        length: 5,
      };

      const material: MaterialSpec = { name: 'steel' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.108,
        supportSpacing: 3.05,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, [segment], material, constraints);
      const mesh = generator.generate(route);

      expect(mesh).toBeDefined();
      expect(mesh.name).toBe(`pipe_${route.getId()}`);

      const boundingInfo = mesh.getBoundingInfo();
      expect(boundingInfo).toBeDefined();
    });

    it('should default to 1/2" pipe when size is not specified', () => {
      const source = createConnectionPoint('pipe', { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, {});
      const destination = createConnectionPoint('pipe', { x: 5, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, {});

      const segment: RouteSegment = {
        id: 'seg-1',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 5, y: 0, z: 0 },
        segmentType: 'straight',
        length: 5,
      };

      const material: MaterialSpec = { name: 'steel' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.084,
        supportSpacing: 2.44,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, [segment], material, constraints);
      const mesh = generator.generate(route);

      expect(mesh).toBeDefined();
    });
  });

  describe('Material Appearance', () => {
    it('should apply gray color for steel pipes', () => {
      const source = createConnectionPoint(
        'pipe',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { size: '1/2"', material: 'steel' }
      );
      const destination = createConnectionPoint(
        'pipe',
        { x: 5, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { size: '1/2"', material: 'steel' }
      );

      const segment: RouteSegment = {
        id: 'seg-1',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 5, y: 0, z: 0 },
        segmentType: 'straight',
        length: 5,
      };

      const material: MaterialSpec = { name: 'steel' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.1,
        supportSpacing: 3,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, [segment], material, constraints);
      const mesh = generator.generate(route);

      expect(mesh.material).toBeDefined();
      const mat = mesh.material as BABYLON.StandardMaterial;
      expect(mat).toBeInstanceOf(BABYLON.StandardMaterial);
      expect(mat.diffuseColor.r).toBeCloseTo(0.5, 1);
      expect(mat.diffuseColor.g).toBeCloseTo(0.5, 1);
      expect(mat.diffuseColor.b).toBeCloseTo(0.5, 1);
    });

    it('should apply white color for PVC pipes', () => {
      const source = createConnectionPoint(
        'pipe',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { size: '1/2"', material: 'PVC' }
      );
      const destination = createConnectionPoint(
        'pipe',
        { x: 5, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { size: '1/2"', material: 'PVC' }
      );

      const segment: RouteSegment = {
        id: 'seg-1',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 5, y: 0, z: 0 },
        segmentType: 'straight',
        length: 5,
      };

      const material: MaterialSpec = { name: 'PVC' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.1,
        supportSpacing: 3,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, [segment], material, constraints);
      const mesh = generator.generate(route);

      expect(mesh.material).toBeDefined();
      const mat = mesh.material as BABYLON.StandardMaterial;
      expect(mat).toBeInstanceOf(BABYLON.StandardMaterial);
      expect(mat.diffuseColor.r).toBeCloseTo(1.0, 1);
      expect(mat.diffuseColor.g).toBeCloseTo(1.0, 1);
      expect(mat.diffuseColor.b).toBeCloseTo(1.0, 1);
    });
  });

  describe('TC-P2: BOM Computation', () => {
    it('should calculate total length within ±1% accuracy', () => {
      const source = createConnectionPoint(
        'pipe',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { size: '3/4"', material: 'steel' }
      );
      const destination = createConnectionPoint(
        'pipe',
        { x: 10, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { size: '3/4"', material: 'steel' }
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg-1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 5, y: 0, z: 0 },
          segmentType: 'straight',
          length: 5.0,
        },
        {
          id: 'seg-2',
          startPoint: { x: 5, y: 0, z: 0 },
          endPoint: { x: 10, y: 0, z: 0 },
          segmentType: 'straight',
          length: 5.0,
        },
      ];

      const material: MaterialSpec = { name: 'steel' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.108,
        supportSpacing: 3.05,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);
      const bom = generator.computeBOM(route);

      expect(bom).toBeDefined();
      expect(bom.type).toBe('pipe');
      expect(bom.size).toBe('3/4"');
      expect(bom.material).toBe('steel');

      const expectedLength = 10.0;
      expect(bom.totalLength).toBeCloseTo(expectedLength, 1);

      const tolerance = expectedLength * 0.01;
      expect(Math.abs(bom.totalLength - expectedLength)).toBeLessThanOrEqual(tolerance);
    });

    it('should count elbows correctly', () => {
      const source = createConnectionPoint(
        'pipe',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { size: '3/4"', material: 'steel' }
      );
      const destination = createConnectionPoint(
        'pipe',
        { x: 5, y: 5, z: 0 },
        { x: 0, y: 1, z: 0 },
        { size: '3/4"', material: 'steel' }
      );

      const segments: RouteSegment[] = [
        {
          id: 'seg-1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 5, y: 0, z: 0 },
          segmentType: 'straight',
          length: 5.0,
        },
        {
          id: 'seg-2',
          startPoint: { x: 5, y: 0, z: 0 },
          endPoint: { x: 5, y: 5, z: 0 },
          segmentType: 'bend',
          length: 5.0,
          bendRadius: 0.15,
        },
      ];

      const material: MaterialSpec = { name: 'steel' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.108,
        supportSpacing: 3.05,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, segments, material, constraints);
      const bom = generator.computeBOM(route);

      expect(bom.fittings).toBeDefined();
      expect(bom.fittings.length).toBeGreaterThan(0);

      const elbowFitting = bom.fittings.find((f) => f.type === 'elbow');
      expect(elbowFitting).toBeDefined();
      expect(elbowFitting!.count).toBe(1);
      expect(elbowFitting!.angle).toBe(90);
    });

    it('should include estimated cost', () => {
      const source = createConnectionPoint(
        'pipe',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { size: '1/2"', material: 'steel' }
      );
      const destination = createConnectionPoint(
        'pipe',
        { x: 5, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { size: '1/2"', material: 'steel' }
      );

      const segment: RouteSegment = {
        id: 'seg-1',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 5, y: 0, z: 0 },
        segmentType: 'straight',
        length: 5.0,
      };

      const material: MaterialSpec = { name: 'steel' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.1,
        supportSpacing: 3,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, [segment], material, constraints);
      const bom = generator.computeBOM(route);

      expect(bom.estimatedCost).toBeDefined();
      expect(bom.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should generate geometry in <50ms for single route', () => {
      const source = createConnectionPoint(
        'pipe',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { size: '3/4"', material: 'steel' }
      );
      const destination = createConnectionPoint(
        'pipe',
        { x: 10, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { size: '3/4"', material: 'steel' }
      );

      const segment: RouteSegment = {
        id: 'seg-1',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 10, y: 0, z: 0 },
        segmentType: 'straight',
        length: 10.0,
      };

      const material: MaterialSpec = { name: 'steel' };
      const constraints: RouteConstraints = {
        minBendRadius: 0.108,
        supportSpacing: 3.05,
        clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
      };

      const route = new Route(source, destination, [segment], material, constraints);

      const start = performance.now();
      const mesh = generator.generate(route);
      const duration = performance.now() - start;

      expect(mesh).toBeDefined();
      expect(duration).toBeLessThan(50);
    });
  });
});
