// Unit tests for piping rules
// Owner: Agent 1 (George)

import {
  getDefaultDiameter,
  getMinBendRadius,
  calculateDistance,
  computeApproxSegmentLength,
  validateBendRadius,
  getStandardSizes,
  isSegmentTooShort,
  calculateElevationChange,
  calculateSegmentSlope,
  estimateSupportsNeeded,
} from '../../src/domain/factoryServices/piping/pipingRules';
import { PipingNode, PipingSegment } from '../../src/domain/factoryServices/piping/pipingTypes';

describe('Piping Rules', () => {
  describe('getDefaultDiameter', () => {
    it('should return sensible defaults for each service type', () => {
      expect(getDefaultDiameter('water')).toBe(40);
      expect(getDefaultDiameter('air')).toBe(25);
      expect(getDefaultDiameter('steam')).toBe(50);
      expect(getDefaultDiameter('vacuum')).toBe(40);
      expect(getDefaultDiameter('cable_tray')).toBe(100);
      expect(getDefaultDiameter('electrical')).toBe(25);
      expect(getDefaultDiameter('custom')).toBe(40);
    });
  });

  describe('getMinBendRadius', () => {
    it('should calculate minimum bend radius as 3× diameter', () => {
      expect(getMinBendRadius(25)).toBe(75);
      expect(getMinBendRadius(40)).toBe(120);
      expect(getMinBendRadius(50)).toBe(150);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 3, y: 4, z: 0 };
      expect(calculateDistance(p1, p2)).toBe(5);
    });

    it('should handle 3D distances', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 1, y: 1, z: 1 };
      expect(calculateDistance(p1, p2)).toBeCloseTo(Math.sqrt(3), 5);
    });
  });

  describe('computeApproxSegmentLength', () => {
    it('should compute segment length correctly', () => {
      const nodes: PipingNode[] = [
        {
          id: 'n1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
        {
          id: 'n2',
          position: { x: 10, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segment: PipingSegment = {
        id: 's1',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        nominalDiameterMm: 40,
        hasInsulation: false,
      };

      expect(computeApproxSegmentLength(segment, nodes)).toBe(10);
    });

    it('should return 0 if nodes are not found', () => {
      const segment: PipingSegment = {
        id: 's1',
        fromNodeId: 'nonexistent1',
        toNodeId: 'nonexistent2',
        nominalDiameterMm: 40,
        hasInsulation: false,
      };

      expect(computeApproxSegmentLength(segment, [])).toBe(0);
    });
  });

  describe('validateBendRadius', () => {
    it('should validate bend radius against minimum', () => {
      expect(validateBendRadius(120, 40)).toBe(true); // 3× diameter
      expect(validateBendRadius(150, 40)).toBe(true); // > 3× diameter
      expect(validateBendRadius(100, 40)).toBe(false); // < 3× diameter
    });
  });

  describe('getStandardSizes', () => {
    it('should return standard sizes for water', () => {
      const sizes = getStandardSizes('water');
      expect(sizes).toContain(25);
      expect(sizes).toContain(40);
      expect(sizes).toContain(50);
    });

    it('should return standard sizes for air', () => {
      const sizes = getStandardSizes('air');
      expect(sizes).toContain(25);
      expect(sizes).toContain(32);
    });
  });

  describe('isSegmentTooShort', () => {
    it('should detect segments that are too short', () => {
      expect(isSegmentTooShort(0.05, 40)).toBe(true); // 50mm < 80mm (2×40mm)
      expect(isSegmentTooShort(0.1, 40)).toBe(false); // 100mm > 80mm
    });
  });

  describe('calculateElevationChange', () => {
    it('should calculate elevation change (Z-up)', () => {
      const node1: PipingNode = {
        id: 'n1',
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      };

      const node2: PipingNode = {
        id: 'n2',
        position: { x: 10, y: 0, z: 5 },
        kind: 'endpoint',
        serviceType: 'water',
      };

      expect(calculateElevationChange(node1, node2)).toBe(5);
      expect(calculateElevationChange(node2, node1)).toBe(-5);
    });
  });

  describe('calculateSegmentSlope', () => {
    it('should calculate slope in per-mille', () => {
      const nodes: PipingNode[] = [
        {
          id: 'n1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
        {
          id: 'n2',
          position: { x: 10, y: 0, z: 0.1 }, // 100mm rise over 10m
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segment: PipingSegment = {
        id: 's1',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        nominalDiameterMm: 40,
        hasInsulation: false,
      };

      const slope = calculateSegmentSlope(segment, nodes);
      expect(slope).toBeCloseTo(10, 1); // 10‰ (1% slope)
    });

    it('should return null for vertical pipes', () => {
      const nodes: PipingNode[] = [
        {
          id: 'n1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
        {
          id: 'n2',
          position: { x: 0, y: 0, z: 5 }, // Pure vertical
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segment: PipingSegment = {
        id: 's1',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        nominalDiameterMm: 40,
        hasInsulation: false,
      };

      const slope = calculateSegmentSlope(segment, nodes);
      expect(slope).toBeNull();
    });
  });

  describe('estimateSupportsNeeded', () => {
    it('should estimate supports based on pipe size', () => {
      // Small pipe (40mm): support every 2.5m
      expect(estimateSupportsNeeded(5, 40)).toBe(2);
      expect(estimateSupportsNeeded(10, 40)).toBe(4);

      // Large pipe (100mm): support every 4.5m
      expect(estimateSupportsNeeded(10, 100)).toBe(3);
    });

    it('should always need at least one support', () => {
      expect(estimateSupportsNeeded(0.5, 40)).toBe(1);
    });
  });
});
