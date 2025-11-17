// End-to-End Tests for Factory Piping System
// Owner: Agent 1 (George) - E2E Test Validator
// Tests complete user workflows from UI → Store → Scene

import { pipingStore } from '../../src/domain/factoryServices/piping/pipingStore';
import { PipingNetwork, PipingNode, PipingSegment } from '../../src/domain/factoryServices/piping/pipingTypes';
import { getDefaultDiameter } from '../../src/domain/factoryServices/piping/pipingRules';
import { getSegmentWarnings, getAllSegmentWarnings } from '../../src/domain/factoryServices/piping/pipingValidation';
import { describePipingNetwork } from '../../src/domain/factoryServices/piping/pipingDescription';

/**
 * E2E Test Suite: Complete Factory Piping Workflows
 *
 * This suite tests the entire piping system end-to-end, simulating
 * real user interactions from creation to validation.
 */
describe('Factory Piping System - End-to-End', () => {
  beforeEach(() => {
    pipingStore.clear();
  });

  describe('Scenario 1: Basic Water Network Creation', () => {
    it('should create a complete water network with nodes and segments', () => {
      // Step 1: User creates a new water network
      const network = pipingStore.createNetwork({
        name: 'Main Water Supply',
        serviceType: 'water',
      });

      expect(network).toBeDefined();
      expect(network!.name).toBe('Main Water Supply');
      expect(network!.serviceType).toBe('water');
      expect(network!.nodes).toHaveLength(0);
      expect(network!.segments).toHaveLength(0);

      // Step 2: User places first node (water inlet)
      const node1 = pipingStore.createNode(network!.id, {
        position: { x: 0, y: 0, z: 1.5 }, // 1.5m elevation
        kind: 'endpoint',
        serviceType: 'water',
        name: 'Water Inlet',
      });

      expect(node1).toBeDefined();
      expect(node1!.position.z).toBe(1.5);
      expect(pipingStore.getAllNetworks()[0].nodes).toHaveLength(1);

      // Step 3: User places second node (water outlet)
      const node2 = pipingStore.createNode(network!.id, {
        position: { x: 10, y: 0, z: 1.5 }, // Same elevation
        kind: 'endpoint',
        serviceType: 'water',
        name: 'Water Outlet',
      });

      expect(node2).toBeDefined();
      expect(pipingStore.getAllNetworks()[0].nodes).toHaveLength(2);

      // Step 4: User creates segment connecting nodes (Shift+click workflow)
      const segment = pipingStore.createSegment(network!.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: getDefaultDiameter('water'),
        hasInsulation: false,
      });

      expect(segment).toBeDefined();
      expect(segment!.fromNodeId).toBe(node1!.id);
      expect(segment!.toNodeId).toBe(node2!.id);
      expect(segment!.nominalDiameterMm).toBe(40); // Default water diameter
      expect(pipingStore.getAllNetworks()[0].segments).toHaveLength(1);

      // Step 5: Verify network is valid
      const finalNetwork = pipingStore.getAllNetworks()[0];
      const warningsMap = getAllSegmentWarnings(finalNetwork.segments, finalNetwork.nodes);
      expect(warningsMap.size).toBe(0);

      // Step 6: Verify network description
      const description = describePipingNetwork(finalNetwork);
      const descriptionText = description.join(' ');
      expect(descriptionText).toContain('Main Water Supply');
      expect(descriptionText).toContain('water');
      expect(descriptionText).toContain('2 nodes');
      expect(descriptionText).toContain('1 segment');
    });
  });

  describe('Scenario 2: Elevation-Aware Node Placement', () => {
    it('should place nodes at correct elevations using placement settings', () => {
      const network = pipingStore.createNetwork({
        name: 'Elevated Water Network',
        serviceType: 'water',
      });

      // User sets placement mode to "on_floor"
      pipingStore.setPlacementMode('on_floor');

      // User clicks on floor (y = 0)
      const floorHit = { x: 0, y: 0, z: 0 };
      const floorElevation = pipingStore.getEffectivePlacementElevation(floorHit.y);

      const node1 = pipingStore.createNode(network!.id, {
        position: { x: floorHit.x, y: floorElevation, z: floorHit.z },
        kind: 'endpoint',
        serviceType: 'water',
      });

      // Should snap to floor with default elevation offset
      expect(node1!.position.y).toBeGreaterThanOrEqual(0);

      // User switches to "at_elevation" mode with fixed height
      pipingStore.setPlacementMode('at_elevation');
      pipingStore.setDefaultElevationZ(2.5); // 2.5m elevation

      const elevatedHit = { x: 5, y: 0, z: 0 };
      const elevatedHeight = pipingStore.getEffectivePlacementElevation(elevatedHit.y);

      const node2 = pipingStore.createNode(network!.id, {
        position: { x: elevatedHit.x, y: elevatedHeight, z: elevatedHit.z },
        kind: 'endpoint',
        serviceType: 'water',
      });

      // Should be at fixed elevation
      expect(node2!.position.y).toBe(2.5);

      // Nodes should be at different elevations
      expect(node2!.position.y).toBeGreaterThan(node1!.position.y);
    });
  });

  describe('Scenario 3: Multi-Service Network Management', () => {
    it('should manage separate networks for water, air, and steam', () => {
      // User creates multiple service type networks
      const waterNetwork = pipingStore.createNetwork({
        name: 'Water Supply',
        serviceType: 'water',
      });

      const airNetwork = pipingStore.createNetwork({
        name: 'Compressed Air',
        serviceType: 'air',
      });

      const steamNetwork = pipingStore.createNetwork({
        name: 'Steam Distribution',
        serviceType: 'steam',
      });

      expect(pipingStore.getAllNetworks()).toHaveLength(3);

      // User adds nodes to each network
      const waterNode = pipingStore.createNode(waterNetwork!.id, {
        position: { x: 0, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const airNode = pipingStore.createNode(airNetwork!.id, {
        position: { x: 1, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'air',
      });

      const steamNode = pipingStore.createNode(steamNetwork!.id, {
        position: { x: 2, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'steam',
      });

      // Verify each node is in correct network
      expect(pipingStore.getNetworkForNode(waterNode!.id)!.serviceType).toBe('water');
      expect(pipingStore.getNetworkForNode(airNode!.id)!.serviceType).toBe('air');
      expect(pipingStore.getNetworkForNode(steamNode!.id)!.serviceType).toBe('steam');

      // Verify correct default diameters
      const waterSegment = pipingStore.createSegment(waterNetwork!.id, {
        fromNodeId: waterNode!.id,
        toNodeId: pipingStore.createNode(waterNetwork!.id, {
          position: { x: 5, y: 0, z: 1 },
          kind: 'endpoint',
          serviceType: 'water',
        })!.id,
        nominalDiameterMm: getDefaultDiameter('water'),
        hasInsulation: false,
      });

      const steamSegment = pipingStore.createSegment(steamNetwork!.id, {
        fromNodeId: steamNode!.id,
        toNodeId: pipingStore.createNode(steamNetwork!.id, {
          position: { x: 7, y: 0, z: 1 },
          kind: 'endpoint',
          serviceType: 'steam',
        })!.id,
        nominalDiameterMm: getDefaultDiameter('steam'),
        hasInsulation: false,
      });

      expect(waterSegment!.nominalDiameterMm).toBe(40); // Water default
      expect(steamSegment!.nominalDiameterMm).toBe(50); // Steam default
    });
  });

  describe('Scenario 4: Complex Network with Branches', () => {
    it('should create a branched network with multiple connection points', () => {
      const network = pipingStore.createNetwork({
        name: 'Branched Water Network',
        serviceType: 'water',
      });

      // Main line: A → B → C
      const nodeA = pipingStore.createNode(network!.id, {
        position: { x: 0, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
        name: 'Main Inlet',
      });

      const nodeB = pipingStore.createNode(network!.id, {
        position: { x: 5, y: 0, z: 1 },
        kind: 'branch',
        serviceType: 'water',
        name: 'Branch Point',
      });

      const nodeC = pipingStore.createNode(network!.id, {
        position: { x: 10, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
        name: 'Main Outlet',
      });

      // Branch: B → D
      const nodeD = pipingStore.createNode(network!.id, {
        position: { x: 5, y: 5, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
        name: 'Branch Outlet',
      });

      // Create segments
      const segmentAB = pipingStore.createSegment(network!.id, {
        fromNodeId: nodeA!.id,
        toNodeId: nodeB!.id,
        nominalDiameterMm: 50,
        hasInsulation: false,
      });

      const segmentBC = pipingStore.createSegment(network!.id, {
        fromNodeId: nodeB!.id,
        toNodeId: nodeC!.id,
        nominalDiameterMm: 40,
        hasInsulation: false,
      });

      const segmentBD = pipingStore.createSegment(network!.id, {
        fromNodeId: nodeB!.id,
        toNodeId: nodeD!.id,
        nominalDiameterMm: 25,
        hasInsulation: false,
      });

      // Verify network structure
      const finalNetwork = pipingStore.getAllNetworks()[0];
      expect(finalNetwork.nodes).toHaveLength(4);
      expect(finalNetwork.segments).toHaveLength(3);

      // Verify branch point has multiple connections
      const branchConnections = finalNetwork.segments.filter(
        s => s.fromNodeId === nodeB!.id || s.toNodeId === nodeB!.id
      );
      expect(branchConnections).toHaveLength(3); // AB (to), BC (from), BD (from)

      // Verify network is valid
      const warningsMap = getAllSegmentWarnings(finalNetwork.segments, finalNetwork.nodes);
      expect(warningsMap.size).toBe(0);
    });
  });

  describe('Scenario 5: Validation and Error Detection', () => {
    it('should detect and report validation issues', () => {
      const network = pipingStore.createNetwork({
        name: 'Test Network',
        serviceType: 'steam',
      });

      const node1 = pipingStore.createNode(network!.id, {
        position: { x: 0, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'steam',
      });

      const node2 = pipingStore.createNode(network!.id, {
        position: { x: 0.01, y: 0, z: 1 }, // Very close to node1 (< 0.1m)
        kind: 'endpoint',
        serviceType: 'steam',
      });

      // Create segment with potential issues
      const segment = pipingStore.createSegment(network!.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 50,
        hasInsulation: false, // Steam without insulation - warning
      });

      // Validate segment
      const segmentWarnings = getSegmentWarnings(segment!, [node1!, node2!]);

      // Should have warnings about:
      // 1. Very short segment length
      // 2. Steam without insulation
      expect(segmentWarnings.length).toBeGreaterThan(0);

      const hasLengthWarning = segmentWarnings.some(warning =>
        warning.message.toLowerCase().includes('length') ||
        warning.message.toLowerCase().includes('short')
      );
      const hasInsulationWarning = segmentWarnings.some(warning =>
        warning.message.toLowerCase().includes('insulation')
      );

      expect(hasLengthWarning).toBe(true);
      expect(hasInsulationWarning).toBe(true);
    });
  });

  describe('Scenario 6: Network Serialization and Description', () => {
    it('should serialize and describe complex networks accurately', () => {
      const network = pipingStore.createNetwork({
        name: 'Production Water Network',
        serviceType: 'water',
        meta: { location: 'Building A', floor: '2' },
      });

      // Create nodes
      const nodes = [
        pipingStore.createNode(network!.id, {
          position: { x: 0, y: 0, z: 1.5 },
          kind: 'endpoint',
          serviceType: 'water',
          name: 'Supply',
        }),
        pipingStore.createNode(network!.id, {
          position: { x: 5, y: 0, z: 1.5 },
          kind: 'branch',
          serviceType: 'water',
          name: 'Junction',
        }),
        pipingStore.createNode(network!.id, {
          position: { x: 10, y: 0, z: 1.5 },
          kind: 'endpoint',
          serviceType: 'water',
          name: 'Outlet 1',
        }),
      ];

      // Create segments
      pipingStore.createSegment(network!.id, {
        fromNodeId: nodes[0]!.id,
        toNodeId: nodes[1]!.id,
        nominalDiameterMm: 40,
        hasInsulation: false,
      });

      pipingStore.createSegment(network!.id, {
        fromNodeId: nodes[1]!.id,
        toNodeId: nodes[2]!.id,
        nominalDiameterMm: 40,
        hasInsulation: false,
      });

      // Get final network
      const finalNetwork = pipingStore.getAllNetworks()[0];

      // Test description
      const description = describePipingNetwork(finalNetwork);
      const descriptionText = description.join(' ');
      expect(descriptionText).toContain('Production Water Network');
      expect(descriptionText).toContain('water');
      expect(descriptionText).toContain('3 nodes');
      expect(descriptionText).toContain('2 segments');

      // Verify network can be serialized
      expect(finalNetwork.id).toBeTruthy();
      expect(finalNetwork.nodes).toHaveLength(3);
      expect(finalNetwork.segments).toHaveLength(2);
      expect(finalNetwork.meta).toEqual({ location: 'Building A', floor: '2' });
    });
  });

  describe('Scenario 7: Node Selection and Inspection', () => {
    it('should track selection state for UI inspection', () => {
      const network = pipingStore.createNetwork({
        name: 'Test Network',
        serviceType: 'water',
      });

      const node1 = pipingStore.createNode(network!.id, {
        position: { x: 0, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const node2 = pipingStore.createNode(network!.id, {
        position: { x: 5, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const segment = pipingStore.createSegment(network!.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
        hasInsulation: false,
      });

      // Verify we can retrieve individual entities
      const retrievedNode = pipingStore.getNode(node1!.id);
      expect(retrievedNode).toEqual(node1);

      const retrievedSegment = pipingStore.getSegment(segment!.id);
      expect(retrievedSegment).toEqual(segment);

      const parentNetwork = pipingStore.getNetworkForNode(node1!.id);
      expect(parentNetwork).toEqual(network);
    });
  });

  describe('Scenario 8: Network Modification and Updates', () => {
    it('should support updating networks, nodes, and segments', () => {
      const network = pipingStore.createNetwork({
        name: 'Original Name',
        serviceType: 'water',
      });

      const node = pipingStore.createNode(network!.id, {
        position: { x: 0, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      // Update network name
      pipingStore.updateNetwork(network!.id, { name: 'Updated Name' });
      expect(pipingStore.getAllNetworks()[0].name).toBe('Updated Name');

      // Update node position
      pipingStore.updateNode(node!.id, { position: { x: 5, y: 0, z: 1 } });
      const updatedNode = pipingStore.getNode(node!.id);
      expect(updatedNode!.position.x).toBe(5);

      // Add another node and segment
      const node2 = pipingStore.createNode(network!.id, {
        position: { x: 10, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const segment = pipingStore.createSegment(network!.id, {
        fromNodeId: node!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
        hasInsulation: false,
      });

      // Update segment diameter
      pipingStore.updateSegment(segment!.id, { nominalDiameterMm: 50 });
      const updatedSegment = pipingStore.getSegment(segment!.id);
      expect(updatedSegment!.nominalDiameterMm).toBe(50);
    });
  });

  describe('Scenario 9: Network Deletion and Cleanup', () => {
    it('should clean up nodes and segments when deleting network', () => {
      const network = pipingStore.createNetwork({
        name: 'Temporary Network',
        serviceType: 'water',
      });

      const node1 = pipingStore.createNode(network!.id, {
        position: { x: 0, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const node2 = pipingStore.createNode(network!.id, {
        position: { x: 5, y: 0, z: 1 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      pipingStore.createSegment(network!.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
        hasInsulation: false,
      });

      expect(pipingStore.getAllNetworks()).toHaveLength(1);

      // Delete network
      pipingStore.deleteNetwork(network!.id);

      expect(pipingStore.getAllNetworks()).toHaveLength(0);
      expect(pipingStore.getNode(node1!.id)).toBeUndefined();
      expect(pipingStore.getNode(node2!.id)).toBeUndefined();
    });
  });

  describe('Scenario 10: Placement Settings Persistence', () => {
    it('should maintain placement settings across node creation', () => {
      const network = pipingStore.createNetwork({
        name: 'Test Network',
        serviceType: 'water',
      });

      // Set specific placement mode
      pipingStore.setPlacementMode('at_elevation');
      pipingStore.setDefaultElevationZ(2.0);

      // Get settings
      const settings1 = pipingStore.getPlacementSettings();
      expect(settings1.mode).toBe('at_elevation');
      expect(settings1.defaultElevationZ).toBe(2.0);

      // Create node using settings
      const elevation1 = pipingStore.getEffectivePlacementElevation(0);
      const node1 = pipingStore.createNode(network!.id, {
        position: { x: 0, y: elevation1, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      expect(node1!.position.y).toBe(2.0);

      // Change settings
      pipingStore.setDefaultElevationZ(3.0);

      const elevation2 = pipingStore.getEffectivePlacementElevation(0);
      const node2 = pipingStore.createNode(network!.id, {
        position: { x: 5, y: elevation2, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      expect(node2!.position.y).toBe(3.0);

      // First node should keep original elevation
      const node1Retrieved = pipingStore.getNode(node1!.id);
      expect(node1Retrieved!.position.y).toBe(2.0);
    });
  });
});
