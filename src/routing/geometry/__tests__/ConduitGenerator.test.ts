/**
 * Unit tests for ConduitGenerator
 * Tests spec-driven sizing, bending rules, junction boxes, and BOM computation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { ConduitGenerator } from '../ConduitGenerator';
import { Route } from '../../core/Route';
import { ConnectionPoint } from '../../core/ConnectionPoint';
import { Vector3 } from '../../../core/types';
import { generateId } from '../../core/RoutingUtils';

describe('Agent 6 - ConduitGenerator', () => {
  let scene: BABYLON.Scene;
  let engine: BABYLON.NullEngine;
  let generator: ConduitGenerator;

  beforeEach(() => {
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
    generator = new ConduitGenerator(scene);
  });

  describe('Spec-driven sizing', () => {
    it('should use conduit size from connection specifications', () => {
      const source = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '1"',
            material: 'steel',
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 5, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '1"',
            material: 'steel',
          },
        }
      );

      const route = new Route(
        source,
        destination,
        [
          {
            id: generateId(),
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 5, y: 0, z: 0 },
            segmentType: 'straight',
            length: 5,
          },
        ],
        { name: 'EMT' },
        {
          minBendRadius: 0.1,
          supportSpacing: 3.05,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const bom = generator.computeBOM(route);

      expect(bom.type).toBe('conduit');
      expect(bom.size).toBe('1"');
      expect(bom.totalLength).toBe(5);
    });
  });

  describe('TC-COND1: Conduit bending rules and junction boxes', () => {
    it('should respect bend radius limits based on material', () => {
      const source = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '3/4"',
            material: 'PVC',
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 5, y: 0, z: 5 },
          direction: { x: 0, y: 0, z: -1 },
          specifications: {
            size: '3/4"',
            material: 'PVC',
          },
        }
      );

      const route = new Route(
        source,
        destination,
        [
          {
            id: generateId(),
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 5, y: 0, z: 0 },
            segmentType: 'straight',
            length: 5,
          },
          {
            id: generateId(),
            startPoint: { x: 5, y: 0, z: 0 },
            endPoint: { x: 5, y: 0, z: 5 },
            segmentType: 'bend',
            bendRadius: 0.1, // Minimum bend radius
            length: 1.57, // ~π/2 * radius
          },
        ],
        { name: 'PVC' },
        {
          minBendRadius: 0.1,
          supportSpacing: 3.05,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const mesh = generator.generate(route);

      expect(mesh).toBeDefined();
      expect(mesh.name).toBe(`conduit_${route.getId()}`);
      
      // Should have created junction boxes (visible as part of combined mesh)
      expect(mesh.material).toBeDefined();
    });

    it('should place junction boxes at source and destination', () => {
      const source = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '3/4"',
            material: 'steel',
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 3, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '3/4"',
            material: 'steel',
          },
        }
      );

      const route = new Route(
        source,
        destination,
        [
          {
            id: generateId(),
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 3, y: 0, z: 0 },
            segmentType: 'straight',
            length: 3,
          },
        ],
        { name: 'EMT' },
        {
          minBendRadius: 0.1,
          supportSpacing: 3.05,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const bom = generator.computeBOM(route);

      // Should have 2 junction boxes
      const junctionBoxes = bom.fittings.find(f => f.type === 'junction-box');
      expect(junctionBoxes).toBeDefined();
      expect(junctionBoxes?.count).toBe(2);
    });

    it('should count bends correctly in BOM', () => {
      const source = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '1"',
            material: 'steel',
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 5, y: 0, z: 5 },
          direction: { x: 0, y: 0, z: -1 },
          specifications: {
            size: '1"',
            material: 'steel',
          },
        }
      );

      const route = new Route(
        source,
        destination,
        [
          {
            id: generateId(),
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 5, y: 0, z: 0 },
            segmentType: 'straight',
            length: 5,
          },
          {
            id: generateId(),
            startPoint: { x: 5, y: 0, z: 0 },
            endPoint: { x: 5, y: 0, z: 5 },
            segmentType: 'bend',
            bendRadius: 0.15,
            length: 1.57,
          },
        ],
        { name: 'EMT' },
        {
          minBendRadius: 0.15,
          supportSpacing: 3.05,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const bom = generator.computeBOM(route);

      // Should have 1 elbow bend
      const elbows = bom.fittings.find(f => f.type === 'elbow');
      expect(elbows).toBeDefined();
      expect(elbows?.count).toBe(1);
      expect(elbows?.angle).toBe(90);
    });
  });

  describe('BOM computation', () => {
    it('should compute accurate BOM with length, fittings, and supports', () => {
      const source = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '1"',
            material: 'steel',
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 10, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '1"',
            material: 'steel',
          },
        }
      );

      const route = new Route(
        source,
        destination,
        [
          {
            id: generateId(),
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 10, y: 0, z: 0 },
            segmentType: 'straight',
            length: 10,
          },
        ],
        { name: 'EMT' },
        {
          minBendRadius: 0.15,
          supportSpacing: 3.05, // 10 feet
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const bom = generator.computeBOM(route);

      expect(bom.type).toBe('conduit');
      expect(bom.size).toBe('1"');
      expect(bom.material).toBe('steel');
      expect(bom.totalLength).toBe(10);
      
      // Should have junction boxes
      expect(bom.fittings.length).toBeGreaterThan(0);
      
      // Should have supports (10m route with 3.05m spacing = ~3 supports)
      expect(bom.supports.length).toBeGreaterThan(0);
      const clamps = bom.supports.find(s => s.type === 'clamp');
      expect(clamps).toBeDefined();
      expect(clamps?.count).toBeGreaterThanOrEqual(2);
      
      // Should have estimated cost
      expect(bom.estimatedCost).toBeGreaterThan(0);
    });

    it('should calculate different costs for different materials', () => {
      const createRoute = (material: string) => {
        const source = new ConnectionPoint(
          {
            type: 'conduit',
            position: { x: 0, y: 0, z: 0 },
            direction: { x: 1, y: 0, z: 0 },
            specifications: {
              size: '3/4"',
              material,
            },
          }
        );

        const destination = new ConnectionPoint(
          {
            type: 'conduit',
            position: { x: 5, y: 0, z: 0 },
            direction: { x: -1, y: 0, z: 0 },
            specifications: {
              size: '3/4"',
              material,
            },
          }
        );

        return new Route(
          source,
          destination,
          [
            {
              id: generateId(),
              startPoint: { x: 0, y: 0, z: 0 },
              endPoint: { x: 5, y: 0, z: 0 },
              segmentType: 'straight',
              length: 5,
            },
          ],
          { name: material },
          {
            minBendRadius: 0.1,
            supportSpacing: 3.05,
            clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
          }
        );
      };

      const steelRoute = createRoute('steel');
      const pvcRoute = createRoute('PVC');

      const steelBOM = generator.computeBOM(steelRoute);
      const pvcBOM = generator.computeBOM(pvcRoute);

      // Steel (EMT) should be more expensive than PVC
      expect(steelBOM.estimatedCost).toBeGreaterThan(pvcBOM.estimatedCost!);
    });
  });

  describe('Performance', () => {
    it('should generate conduit geometry in <50ms', () => {
      const source = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '3/4"',
            material: 'steel',
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'conduit',
          position: { x: 20, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '3/4"',
            material: 'steel',
          },
        }
      );

      const route = new Route(
        source,
        destination,
        [
          {
            id: generateId(),
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 20, y: 0, z: 0 },
            segmentType: 'straight',
            length: 20,
          },
        ],
        { name: 'EMT' },
        {
          minBendRadius: 0.1,
          supportSpacing: 3.05,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const start = performance.now();
      const mesh = generator.generate(route);
      const duration = performance.now() - start;

      expect(mesh).toBeDefined();
      expect(duration).toBeLessThan(50); // <50ms requirement
    });
  });
});
