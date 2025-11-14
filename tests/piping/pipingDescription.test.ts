// Unit tests for piping description generator
// Owner: Agent 1 (George)

import {
  describePipingNetwork,
  summarizePipingNetwork,
  generateTechnicalReport,
} from '../../src/domain/factoryServices/piping/pipingDescription';
import { PipingNetwork } from '../../src/domain/factoryServices/piping/pipingTypes';

describe('Piping Description', () => {
  const createSimpleNetwork = (): PipingNetwork => ({
    id: 'net1',
    name: 'Water Main',
    serviceType: 'water',
    nodes: [
      {
        id: 'n1',
        name: 'Pump Station',
        position: { x: 0, y: 0, z: 0 },
        kind: 'equipment',
        serviceType: 'water',
      },
      {
        id: 'n2',
        name: 'Tank',
        position: { x: 10, y: 0, z: 0 },
        kind: 'equipment',
        serviceType: 'water',
      },
    ],
    segments: [
      {
        id: 's1',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        nominalDiameterMm: 50,
        hasInsulation: true,
        fittingHints: ['elbow_90', 'elbow_90'],
      },
    ],
  });

  const createComplexNetwork = (): PipingNetwork => ({
    id: 'net2',
    name: 'Factory Air System',
    serviceType: 'air',
    nodes: [
      {
        id: 'n1',
        name: 'Compressor',
        position: { x: 0, y: 0, z: 0 },
        kind: 'equipment',
        serviceType: 'air',
      },
      {
        id: 'n2',
        name: 'Junction A',
        position: { x: 10, y: 0, z: 0 },
        kind: 'branch',
        serviceType: 'air',
      },
      {
        id: 'n3',
        name: 'Machine 1',
        position: { x: 15, y: 5, z: 0 },
        kind: 'equipment',
        serviceType: 'air',
      },
      {
        id: 'n4',
        name: 'Machine 2',
        position: { x: 15, y: -5, z: 0 },
        kind: 'equipment',
        serviceType: 'air',
      },
    ],
    segments: [
      {
        id: 's1',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        nominalDiameterMm: 40,
        hasInsulation: false,
        fittingHints: ['elbow_90'],
      },
      {
        id: 's2',
        fromNodeId: 'n2',
        toNodeId: 'n3',
        nominalDiameterMm: 25,
        hasInsulation: false,
        fittingHints: ['tee'],
      },
      {
        id: 's3',
        fromNodeId: 'n2',
        toNodeId: 'n4',
        nominalDiameterMm: 25,
        hasInsulation: false,
        fittingHints: ['tee'],
      },
    ],
  });

  describe('describePipingNetwork', () => {
    it('should generate description for simple network', () => {
      const network = createSimpleNetwork();
      const descriptions = describePipingNetwork(network);

      expect(descriptions).toBeDefined();
      expect(Array.isArray(descriptions)).toBe(true);
      expect(descriptions.length).toBeGreaterThan(0);

      // First line should be overview
      expect(descriptions[0]).toContain('Water Main');
      expect(descriptions[0]).toContain('water');
      expect(descriptions[0]).toContain('2 nodes');
      expect(descriptions[0]).toContain('1 segments');
    });

    it('should describe run details', () => {
      const network = createSimpleNetwork();
      const descriptions = describePipingNetwork(network);

      // Should have at least 2 lines (overview + run)
      expect(descriptions.length).toBeGreaterThanOrEqual(2);

      // Run description should include node names
      const runDesc = descriptions.find((d) => d.includes('Pump Station'));
      expect(runDesc).toBeDefined();
      expect(runDesc).toContain('Tank');
      expect(runDesc).toContain('DN50');
      expect(runDesc).toContain('insulated');
    });

    it('should describe fittings', () => {
      const network = createSimpleNetwork();
      const descriptions = describePipingNetwork(network);

      const runDesc = descriptions.find((d) => d.includes('Pump Station'));
      expect(runDesc).toContain('2 elbow_90s');
    });

    it('should identify branch points', () => {
      const network = createComplexNetwork();
      const descriptions = describePipingNetwork(network);

      const branchDesc = descriptions.find((d) => d.includes('branch point'));
      expect(branchDesc).toBeDefined();
      expect(branchDesc).toContain('Junction A');
    });

    it('should list equipment connections', () => {
      const network = createComplexNetwork();
      const descriptions = describePipingNetwork(network);

      const equipmentDesc = descriptions.find((d) => d.includes('equipment node'));
      expect(equipmentDesc).toBeDefined();
      expect(equipmentDesc).toContain('Compressor');
      expect(equipmentDesc).toContain('Machine 1');
      expect(equipmentDesc).toContain('Machine 2');
    });
  });

  describe('summarizePipingNetwork', () => {
    it('should generate one-line summary', () => {
      const network = createSimpleNetwork();
      const summary = summarizePipingNetwork(network);

      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary).toContain('Water Main');
      expect(summary).toContain('water');
      expect(summary).toContain('2 nodes');
      expect(summary).toContain('1 segments');
    });

    it('should include total length', () => {
      const network = createSimpleNetwork();
      const summary = summarizePipingNetwork(network);

      expect(summary).toMatch(/\d+\.\d+m/); // Match pattern like "10.0m"
    });
  });

  describe('generateTechnicalReport', () => {
    it('should generate detailed technical report', () => {
      const network = createSimpleNetwork();
      const report = generateTechnicalReport(network);

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(100); // Should be substantial

      // Should contain major sections
      expect(report).toContain('PIPING NETWORK TECHNICAL REPORT');
      expect(report).toContain('NODES:');
      expect(report).toContain('SEGMENTS:');
      expect(report).toContain('SUMMARY:');
    });

    it('should include node details', () => {
      const network = createSimpleNetwork();
      const report = generateTechnicalReport(network);

      expect(report).toContain('Pump Station');
      expect(report).toContain('Tank');
      expect(report).toContain('[equipment]');
    });

    it('should include segment details', () => {
      const network = createSimpleNetwork();
      const report = generateTechnicalReport(network);

      expect(report).toContain('Pump Station → Tank');
      expect(report).toContain('DN50');
      expect(report).toContain('insulated');
    });

    it('should include summary statistics', () => {
      const network = createComplexNetwork();
      const report = generateTechnicalReport(network);

      expect(report).toContain('Total Nodes: 4');
      expect(report).toContain('Total Segments: 3');
      expect(report).toContain('Total Length:');
    });

    it('should format with proper separators', () => {
      const network = createSimpleNetwork();
      const report = generateTechnicalReport(network);

      expect(report).toContain('='.repeat(60));
      expect(report).toContain('-'.repeat(60));
    });
  });

  describe('Empty Network Handling', () => {
    it('should handle network with no segments', () => {
      const network: PipingNetwork = {
        id: 'empty',
        name: 'Empty Network',
        serviceType: 'water',
        nodes: [
          {
            id: 'n1',
            position: { x: 0, y: 0, z: 0 },
            kind: 'endpoint',
            serviceType: 'water',
          },
        ],
        segments: [],
      };

      const descriptions = describePipingNetwork(network);
      expect(descriptions).toBeDefined();
      expect(descriptions[0]).toContain('0 segments');

      const summary = summarizePipingNetwork(network);
      expect(summary).toContain('0 segments');

      const report = generateTechnicalReport(network);
      expect(report).toContain('Total Segments: 0');
    });

    it('should handle network with no nodes', () => {
      const network: PipingNetwork = {
        id: 'empty',
        name: 'Empty Network',
        serviceType: 'water',
        nodes: [],
        segments: [],
      };

      const descriptions = describePipingNetwork(network);
      expect(descriptions).toBeDefined();

      const summary = summarizePipingNetwork(network);
      expect(summary).toContain('0 nodes');
    });
  });
});
