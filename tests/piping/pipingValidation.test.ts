// Unit tests for piping validation
// Owner: Agent 1 (George)

import {
  getSegmentWarnings,
  getAllSegmentWarnings,
} from '../../src/domain/factoryServices/piping/pipingValidation';
import { PipingNode, PipingSegment } from '../../src/domain/factoryServices/piping/pipingTypes';

describe('PipingValidation', () => {
  describe('getSegmentWarnings', () => {
    it('should return empty array for valid segment', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          name: 'Node 1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
        {
          id: 'node2',
          name: 'Node 2',
          position: { x: 10, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segment: PipingSegment = {
        id: 'seg1',
        fromNodeId: 'node1',
        toNodeId: 'node2',
        nominalDiameterMm: 40,
        hasInsulation: false,
      };

      const warnings = getSegmentWarnings(segment, nodes);
      expect(warnings).toHaveLength(0);
    });

    it('should warn when segment is too short', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          name: 'Node 1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
        {
          id: 'node2',
          name: 'Node 2',
          position: { x: 0.05, y: 0, z: 0 }, // Very close (0.05m)
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segment: PipingSegment = {
        id: 'seg1',
        fromNodeId: 'node1',
        toNodeId: 'node2',
        nominalDiameterMm: 50, // 50mm = 0.05m
        hasInsulation: false,
      };

      // Segment length is 0.05m, diameter is 0.05m
      // Too short if length < 2 * diameter = 0.1m
      const warnings = getSegmentWarnings(segment, nodes);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('too_short');
      expect(warnings[0].severity).toBe('warning');
      expect(warnings[0].message).toContain('very short');
    });

    it('should warn when steam pipe has no insulation', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          name: 'Node 1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'steam',
        },
        {
          id: 'node2',
          name: 'Node 2',
          position: { x: 10, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'steam',
        },
      ];

      const segment: PipingSegment = {
        id: 'seg1',
        fromNodeId: 'node1',
        toNodeId: 'node2',
        nominalDiameterMm: 50,
        hasInsulation: false, // No insulation on steam pipe
      };

      const warnings = getSegmentWarnings(segment, nodes);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('no_insulation_steam');
      expect(warnings[0].severity).toBe('warning');
      expect(warnings[0].message).toContain('Steam');
      expect(warnings[0].message).toContain('insulation');
    });

    it('should return multiple warnings when multiple issues exist', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          name: 'Node 1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'steam',
        },
        {
          id: 'node2',
          name: 'Node 2',
          position: { x: 0.05, y: 0, z: 0 }, // Very close
          kind: 'endpoint',
          serviceType: 'steam',
        },
      ];

      const segment: PipingSegment = {
        id: 'seg1',
        fromNodeId: 'node1',
        toNodeId: 'node2',
        nominalDiameterMm: 50, // Large diameter for short segment
        hasInsulation: false, // No insulation on steam
      };

      const warnings = getSegmentWarnings(segment, nodes);

      expect(warnings).toHaveLength(2);

      const warningTypes = warnings.map((w) => w.type);
      expect(warningTypes).toContain('too_short');
      expect(warningTypes).toContain('no_insulation_steam');
    });

    it('should not warn for steam pipe with insulation', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          name: 'Node 1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'steam',
        },
        {
          id: 'node2',
          name: 'Node 2',
          position: { x: 10, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'steam',
        },
      ];

      const segment: PipingSegment = {
        id: 'seg1',
        fromNodeId: 'node1',
        toNodeId: 'node2',
        nominalDiameterMm: 50,
        hasInsulation: true, // Has insulation
      };

      const warnings = getSegmentWarnings(segment, nodes);
      expect(warnings).toHaveLength(0);
    });

    it('should return empty array when fromNode is missing', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node2',
          name: 'Node 2',
          position: { x: 10, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segment: PipingSegment = {
        id: 'seg1',
        fromNodeId: 'nonexistent',
        toNodeId: 'node2',
        nominalDiameterMm: 40,
        hasInsulation: false,
      };

      // Should not crash, just return empty warnings
      const warnings = getSegmentWarnings(segment, nodes);
      expect(warnings).toHaveLength(0);
    });

    it('should return empty array when toNode is missing', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          name: 'Node 1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segment: PipingSegment = {
        id: 'seg1',
        fromNodeId: 'node1',
        toNodeId: 'nonexistent',
        nominalDiameterMm: 40,
        hasInsulation: false,
      };

      // Should not crash, just return empty warnings
      const warnings = getSegmentWarnings(segment, nodes);
      expect(warnings).toHaveLength(0);
    });

    it('should handle zero-length segment gracefully', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          name: 'Node 1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
        {
          id: 'node2',
          name: 'Node 2',
          position: { x: 0, y: 0, z: 0 }, // Same position
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segment: PipingSegment = {
        id: 'seg1',
        fromNodeId: 'node1',
        toNodeId: 'node2',
        nominalDiameterMm: 40,
        hasInsulation: false,
      };

      // Should produce "too short" warning but not crash
      const warnings = getSegmentWarnings(segment, nodes);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('too_short');
    });

    it('should not warn for non-steam services without insulation', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          name: 'Node 1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
        {
          id: 'node2',
          name: 'Node 2',
          position: { x: 10, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segment: PipingSegment = {
        id: 'seg1',
        fromNodeId: 'node1',
        toNodeId: 'node2',
        nominalDiameterMm: 40,
        hasInsulation: false,
      };

      const warnings = getSegmentWarnings(segment, nodes);

      // Should not have insulation warning
      const insulationWarnings = warnings.filter((w) => w.type === 'no_insulation_steam');
      expect(insulationWarnings).toHaveLength(0);
    });
  });

  describe('getAllSegmentWarnings', () => {
    it('should return warnings map for multiple segments', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'steam',
        },
        {
          id: 'node2',
          position: { x: 0.05, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'steam',
        },
        {
          id: 'node3',
          position: { x: 10, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segments: PipingSegment[] = [
        {
          id: 'seg1',
          fromNodeId: 'node1',
          toNodeId: 'node2',
          nominalDiameterMm: 50,
          hasInsulation: false, // Steam without insulation + too short
        },
        {
          id: 'seg2',
          fromNodeId: 'node2',
          toNodeId: 'node3',
          nominalDiameterMm: 40,
          hasInsulation: false, // Valid segment
        },
      ];

      const warningsMap = getAllSegmentWarnings(segments, nodes);

      expect(warningsMap.size).toBe(1);
      expect(warningsMap.has('seg1')).toBe(true);
      expect(warningsMap.has('seg2')).toBe(false);

      const seg1Warnings = warningsMap.get('seg1');
      expect(seg1Warnings).toBeDefined();
      expect(seg1Warnings!.length).toBeGreaterThan(0);
    });

    it('should return empty map when no warnings exist', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
        {
          id: 'node2',
          position: { x: 10, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segments: PipingSegment[] = [
        {
          id: 'seg1',
          fromNodeId: 'node1',
          toNodeId: 'node2',
          nominalDiameterMm: 40,
          hasInsulation: false,
        },
      ];

      const warningsMap = getAllSegmentWarnings(segments, nodes);
      expect(warningsMap.size).toBe(0);
    });

    it('should handle empty segments array', () => {
      const nodes: PipingNode[] = [
        {
          id: 'node1',
          position: { x: 0, y: 0, z: 0 },
          kind: 'endpoint',
          serviceType: 'water',
        },
      ];

      const segments: PipingSegment[] = [];
      const warningsMap = getAllSegmentWarnings(segments, nodes);

      expect(warningsMap.size).toBe(0);
    });

    it('should handle segments with missing nodes gracefully', () => {
      const nodes: PipingNode[] = [];

      const segments: PipingSegment[] = [
        {
          id: 'seg1',
          fromNodeId: 'nonexistent1',
          toNodeId: 'nonexistent2',
          nominalDiameterMm: 40,
          hasInsulation: false,
        },
      ];

      // Should not crash and should not add warnings for segments with missing nodes
      const warningsMap = getAllSegmentWarnings(segments, nodes);
      expect(warningsMap.size).toBe(0);
    });
  });
});
