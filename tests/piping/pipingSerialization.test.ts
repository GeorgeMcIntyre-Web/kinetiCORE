// Unit tests for piping serialization
// Owner: Agent 1 (George)

import {
  serializePipingNetwork,
  deserializePipingNetwork,
  serializeMultipleNetworks,
  deserializeMultipleNetworks,
} from '../../src/domain/factoryServices/piping/pipingSerialization';
import { PipingNetwork } from '../../src/domain/factoryServices/piping/pipingTypes';

describe('Piping Serialization', () => {
  const createTestNetwork = (): PipingNetwork => ({
    id: 'net1',
    name: 'Test Water Network',
    serviceType: 'water',
    nodes: [
      {
        id: 'n1',
        name: 'Inlet',
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      },
      {
        id: 'n2',
        name: 'Outlet',
        position: { x: 10, y: 5, z: 2 },
        kind: 'endpoint',
        serviceType: 'water',
        meta: { equipment: 'pump' },
      },
    ],
    segments: [
      {
        id: 's1',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        nominalDiameterMm: 50,
        schedule: 'Schedule 40',
        hasInsulation: true,
        slopePerMille: 5,
        fittingHints: ['elbow_90', 'tee'],
      },
    ],
    meta: { facility: 'Factory A' },
  });

  describe('serializePipingNetwork', () => {
    it('should serialize a network to JSON', () => {
      const network = createTestNetwork();
      const serialized = serializePipingNetwork(network);

      expect(serialized).toBeDefined();
      expect(typeof serialized).toBe('object');

      const data = serialized as any;
      expect(data.version).toBe(1);
      expect(data.network).toBeDefined();
      expect(data.network.id).toBe('net1');
      expect(data.network.name).toBe('Test Water Network');
      expect(data.network.serviceType).toBe('water');
      expect(data.network.nodes).toHaveLength(2);
      expect(data.network.segments).toHaveLength(1);
    });

    it('should handle networks without metadata', () => {
      const network: PipingNetwork = {
        id: 'net1',
        name: 'Simple Network',
        serviceType: 'air',
        nodes: [],
        segments: [],
      };

      const serialized = serializePipingNetwork(network);
      const data = serialized as any;

      expect(data.network.meta).toBeUndefined();
    });

    it('should be JSON-stringifiable', () => {
      const network = createTestNetwork();
      const serialized = serializePipingNetwork(network);

      expect(() => JSON.stringify(serialized)).not.toThrow();
    });
  });

  describe('deserializePipingNetwork', () => {
    it('should deserialize a valid network', () => {
      const original = createTestNetwork();
      const serialized = serializePipingNetwork(original);
      const deserialized = deserializePipingNetwork(serialized);

      expect(deserialized.id).toBe(original.id);
      expect(deserialized.name).toBe(original.name);
      expect(deserialized.serviceType).toBe(original.serviceType);
      expect(deserialized.nodes).toHaveLength(2);
      expect(deserialized.segments).toHaveLength(1);

      // Check node details
      expect(deserialized.nodes[0].id).toBe('n1');
      expect(deserialized.nodes[0].name).toBe('Inlet');
      expect(deserialized.nodes[0].position).toEqual({ x: 0, y: 0, z: 0 });

      // Check segment details
      expect(deserialized.segments[0].id).toBe('s1');
      expect(deserialized.segments[0].nominalDiameterMm).toBe(50);
      expect(deserialized.segments[0].hasInsulation).toBe(true);
    });

    it('should handle round-trip serialization', () => {
      const original = createTestNetwork();
      const serialized = serializePipingNetwork(original);
      const json = JSON.stringify(serialized);
      const parsed = JSON.parse(json);
      const deserialized = deserializePipingNetwork(parsed);

      expect(deserialized).toEqual(original);
    });

    it('should throw error for invalid JSON (not an object)', () => {
      expect(() => deserializePipingNetwork(null)).toThrow('Invalid JSON: unexpected null');
      expect(() => deserializePipingNetwork('string')).toThrow('Invalid JSON: expected object');
      expect(() => deserializePipingNetwork(42)).toThrow('Invalid JSON: expected object');
    });

    it('should throw error for missing version', () => {
      const invalidJson = { network: {} };
      expect(() => deserializePipingNetwork(invalidJson)).toThrow(
        'Invalid JSON: missing or invalid version'
      );
    });

    it('should throw error for unsupported version', () => {
      const invalidJson = { version: 999, network: {} };
      expect(() => deserializePipingNetwork(invalidJson)).toThrow('Unsupported version');
    });

    it('should throw error for missing network', () => {
      const invalidJson = { version: 1 };
      expect(() => deserializePipingNetwork(invalidJson)).toThrow(
        'Invalid JSON: missing or invalid network object'
      );
    });

    it('should throw error for invalid network fields', () => {
      const invalidJson = {
        version: 1,
        network: {
          id: 123, // Should be string
          name: 'Test',
          serviceType: 'water',
          nodes: [],
          segments: [],
        },
      };
      expect(() => deserializePipingNetwork(invalidJson)).toThrow(
        'Invalid JSON: network.id must be a string'
      );
    });

    it('should throw error for invalid nodes array', () => {
      const invalidJson = {
        version: 1,
        network: {
          id: 'net1',
          name: 'Test',
          serviceType: 'water',
          nodes: 'not an array',
          segments: [],
        },
      };
      expect(() => deserializePipingNetwork(invalidJson)).toThrow(
        'Invalid JSON: network.nodes must be an array'
      );
    });

    it('should throw error for invalid segments array', () => {
      const invalidJson = {
        version: 1,
        network: {
          id: 'net1',
          name: 'Test',
          serviceType: 'water',
          nodes: [],
          segments: 'not an array',
        },
      };
      expect(() => deserializePipingNetwork(invalidJson)).toThrow(
        'Invalid JSON: network.segments must be an array'
      );
    });

    it('should throw error for invalid node in array', () => {
      const invalidJson = {
        version: 1,
        network: {
          id: 'net1',
          name: 'Test',
          serviceType: 'water',
          nodes: [
            {
              id: 'n1',
              // Missing position
              kind: 'endpoint',
              serviceType: 'water',
            },
          ],
          segments: [],
        },
      };
      expect(() => deserializePipingNetwork(invalidJson)).toThrow(
        'Invalid JSON: network.nodes[0] is invalid'
      );
    });
  });

  describe('Multiple Networks Serialization', () => {
    it('should serialize and deserialize multiple networks', () => {
      const networks: PipingNetwork[] = [
        createTestNetwork(),
        {
          id: 'net2',
          name: 'Air Network',
          serviceType: 'air',
          nodes: [],
          segments: [],
        },
      ];

      const serialized = serializeMultipleNetworks(networks);
      const deserialized = deserializeMultipleNetworks(serialized);

      expect(deserialized).toHaveLength(2);
      expect(deserialized[0].name).toBe('Test Water Network');
      expect(deserialized[1].name).toBe('Air Network');
    });

    it('should handle empty network array', () => {
      const serialized = serializeMultipleNetworks([]);
      const deserialized = deserializeMultipleNetworks(serialized);

      expect(deserialized).toHaveLength(0);
    });

    it('should throw error for invalid networks array', () => {
      const invalidJson = {
        version: 1,
        networks: 'not an array',
      };

      expect(() => deserializeMultipleNetworks(invalidJson)).toThrow(
        'Invalid JSON: networks must be an array'
      );
    });
  });
});
