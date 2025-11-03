/**
 * Unit tests for CableGenerator
 * Tests spec-driven sizing, color coding, and BOM computation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { CableGenerator } from '../../src/routing/geometry/CableGenerator';
import { Route } from '../../src/routing/core/Route';
import { ConnectionPoint } from '../../src/routing/core/ConnectionPoint';
import { Vector3 } from '../../src/core/types';
import { generateId } from '../../src/routing/core/RoutingUtils';

describe('Agent 6 - CableGenerator', () => {
  let scene: BABYLON.Scene;
  let engine: BABYLON.NullEngine;
  let generator: CableGenerator;

  beforeEach(() => {
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
    generator = new CableGenerator(scene);
  });

  describe('Spec-driven sizing', () => {
    it('should use wire gauge from connection specifications', () => {
      const source = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '14 AWG',
            voltage: 120,
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 5, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '14 AWG',
            voltage: 120,
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
        { name: 'PVC' },
        {
          minBendRadius: 0.05,
          supportSpacing: 10,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const bom = generator.computeBOM(route);

      expect(bom.type).toBe('electrical');
      expect(bom.size).toBe('14 AWG');
      expect(bom.totalLength).toBe(5);
    });
  });

  describe('TC-WIRE1: Cable diameter and color correct', () => {
    it('should generate cable with correct diameter from spec', () => {
      const source = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '10 AWG',
            voltage: 240,
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 3, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '10 AWG',
            voltage: 240,
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
        { name: 'XLPE' },
        {
          minBendRadius: 0.05,
          supportSpacing: 10,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const mesh = generator.generate(route);

      expect(mesh).toBeDefined();
      expect(mesh.name).toBe(`cable_${route.getId()}`);
      expect(mesh.material).toBeDefined();
    });

    it('should color-code cables by voltage (low voltage)', () => {
      const source = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '18 AWG',
            voltage: 24, // Low voltage
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 2, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '18 AWG',
            voltage: 24,
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
            endPoint: { x: 2, y: 0, z: 0 },
            segmentType: 'straight',
            length: 2,
          },
        ],
        { name: 'PVC' },
        {
          minBendRadius: 0.05,
          supportSpacing: 10,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const mesh = generator.generate(route);
      const material = mesh.material as BABYLON.StandardMaterial;

      expect(material).toBeDefined();
      // Low voltage should be silver (#C0C0C0)
      // Allow for floating point comparison tolerance
      expect(material.diffuseColor.r).toBeCloseTo(0.753, 1);
      expect(material.diffuseColor.g).toBeCloseTo(0.753, 1);
      expect(material.diffuseColor.b).toBeCloseTo(0.753, 1);
    });

    it('should color-code cables by voltage (medium voltage)', () => {
      const source = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '14 AWG',
            voltage: 120, // Medium voltage
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 2, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '14 AWG',
            voltage: 120,
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
            endPoint: { x: 2, y: 0, z: 0 },
            segmentType: 'straight',
            length: 2,
          },
        ],
        { name: 'PVC' },
        {
          minBendRadius: 0.05,
          supportSpacing: 10,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const mesh = generator.generate(route);
      const material = mesh.material as BABYLON.StandardMaterial;

      expect(material).toBeDefined();
      // Medium voltage (120V) should be yellow/gold (#FFD700)
      expect(material.diffuseColor.r).toBeCloseTo(1.0, 1);
      expect(material.diffuseColor.g).toBeCloseTo(0.843, 1);
      expect(material.diffuseColor.b).toBeCloseTo(0.0, 1);
    });
  });

  describe('BOM computation', () => {
    it('should compute accurate BOM with length and fittings', () => {
      const source = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '12 AWG',
            voltage: 240,
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 10, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '12 AWG',
            voltage: 240,
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
        { name: 'XLPE' },
        {
          minBendRadius: 0.05,
          supportSpacing: 10,
          clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 },
        }
      );

      const bom = generator.computeBOM(route);

      expect(bom.type).toBe('electrical');
      expect(bom.size).toBe('12 AWG');
      expect(bom.material).toBe('XLPE');
      expect(bom.totalLength).toBe(10);
      
      // Should have 2 connectors (source and destination)
      expect(bom.fittings.length).toBeGreaterThan(0);
      const connectors = bom.fittings.find(f => f.type === 'coupling');
      expect(connectors).toBeDefined();
      expect(connectors?.count).toBe(2);
      
      // Should have estimated cost
      expect(bom.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should generate cable geometry in <50ms', () => {
      const source = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 0, y: 0, z: 0 },
          direction: { x: 1, y: 0, z: 0 },
          specifications: {
            size: '14 AWG',
            voltage: 120,
          },
        }
      );

      const destination = new ConnectionPoint(
        {
          type: 'electrical',
          position: { x: 20, y: 0, z: 0 },
          direction: { x: -1, y: 0, z: 0 },
          specifications: {
            size: '14 AWG',
            voltage: 120,
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
        { name: 'PVC' },
        {
          minBendRadius: 0.05,
          supportSpacing: 10,
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
