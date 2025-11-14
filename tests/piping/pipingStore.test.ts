// Unit tests for piping store
// Owner: Agent 1 (George)

import { pipingStore } from '../../src/domain/factoryServices/piping/pipingStore';
import { PipingNetwork } from '../../src/domain/factoryServices/piping/pipingTypes';

describe('PipingStore', () => {
  beforeEach(() => {
    pipingStore.clear();
  });

  describe('Network CRUD', () => {
    it('should create a network', () => {
      const network = pipingStore.createNetwork({
        name: 'Water Main',
        serviceType: 'water',
      });

      expect(network.id).toBeDefined();
      expect(network.name).toBe('Water Main');
      expect(network.serviceType).toBe('water');
      expect(network.nodes).toEqual([]);
      expect(network.segments).toEqual([]);
    });

    it('should retrieve a network by ID', () => {
      const created = pipingStore.createNetwork({
        name: 'Air Line',
        serviceType: 'air',
      });

      const retrieved = pipingStore.getNetwork(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should get all networks', () => {
      pipingStore.createNetwork({ name: 'Water', serviceType: 'water' });
      pipingStore.createNetwork({ name: 'Air', serviceType: 'air' });

      const all = pipingStore.getAllNetworks();
      expect(all).toHaveLength(2);
    });

    it('should update a network', () => {
      const network = pipingStore.createNetwork({
        name: 'Old Name',
        serviceType: 'water',
      });

      const success = pipingStore.updateNetwork(network.id, {
        name: 'New Name',
      });

      expect(success).toBe(true);
      const updated = pipingStore.getNetwork(network.id);
      expect(updated?.name).toBe('New Name');
    });

    it('should delete a network', () => {
      const network = pipingStore.createNetwork({
        name: 'Test',
        serviceType: 'water',
      });

      const success = pipingStore.deleteNetwork(network.id);
      expect(success).toBe(true);

      const retrieved = pipingStore.getNetwork(network.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Node CRUD', () => {
    let network: PipingNetwork;

    beforeEach(() => {
      network = pipingStore.createNetwork({
        name: 'Test Network',
        serviceType: 'water',
      });
    });

    it('should create a node', () => {
      const node = pipingStore.createNode(network.id, {
        position: { x: 1, y: 2, z: 3 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      expect(node).not.toBeNull();
      expect(node?.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(node?.kind).toBe('endpoint');
    });

    it('should retrieve a node by ID', () => {
      const created = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'support',
        serviceType: 'water',
      });

      const retrieved = pipingStore.getNode(created!.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created?.id);
    });

    it('should update a node', () => {
      const node = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const success = pipingStore.updateNode(node!.id, {
        position: { x: 5, y: 5, z: 5 },
      });

      expect(success).toBe(true);
      const updated = pipingStore.getNode(node!.id);
      expect(updated?.position).toEqual({ x: 5, y: 5, z: 5 });
    });

    it('should delete a node', () => {
      const node = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const success = pipingStore.deleteNode(node!.id);
      expect(success).toBe(true);

      const retrieved = pipingStore.getNode(node!.id);
      expect(retrieved).toBeUndefined();
    });

    it('should delete connected segments when deleting a node', () => {
      const node1 = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const node2 = pipingStore.createNode(network.id, {
        position: { x: 10, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
      });

      pipingStore.deleteNode(node1!.id);

      const retrievedSegment = pipingStore.getSegment(segment!.id);
      expect(retrievedSegment).toBeUndefined();
    });
  });

  describe('Segment CRUD', () => {
    let network: PipingNetwork;
    let node1Id: string;
    let node2Id: string;

    beforeEach(() => {
      network = pipingStore.createNetwork({
        name: 'Test Network',
        serviceType: 'water',
      });

      const n1 = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });
      const n2 = pipingStore.createNode(network.id, {
        position: { x: 10, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      node1Id = n1!.id;
      node2Id = n2!.id;
    });

    it('should create a segment', () => {
      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: node1Id,
        toNodeId: node2Id,
        nominalDiameterMm: 50,
      });

      expect(segment).not.toBeNull();
      expect(segment?.fromNodeId).toBe(node1Id);
      expect(segment?.toNodeId).toBe(node2Id);
      expect(segment?.nominalDiameterMm).toBe(50);
      expect(segment?.hasInsulation).toBe(false);
    });

    it('should not create segment if nodes do not exist', () => {
      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: 'nonexistent1',
        toNodeId: 'nonexistent2',
        nominalDiameterMm: 40,
      });

      expect(segment).toBeNull();
    });

    it('should retrieve a segment by ID', () => {
      const created = pipingStore.createSegment(network.id, {
        fromNodeId: node1Id,
        toNodeId: node2Id,
        nominalDiameterMm: 40,
      });

      const retrieved = pipingStore.getSegment(created!.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created?.id);
    });

    it('should update a segment', () => {
      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: node1Id,
        toNodeId: node2Id,
        nominalDiameterMm: 40,
      });

      const success = pipingStore.updateSegment(segment!.id, {
        nominalDiameterMm: 80,
        hasInsulation: true,
      });

      expect(success).toBe(true);
      const updated = pipingStore.getSegment(segment!.id);
      expect(updated?.nominalDiameterMm).toBe(80);
      expect(updated?.hasInsulation).toBe(true);
    });

    it('should delete a segment', () => {
      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: node1Id,
        toNodeId: node2Id,
        nominalDiameterMm: 40,
      });

      const success = pipingStore.deleteSegment(segment!.id);
      expect(success).toBe(true);

      const retrieved = pipingStore.getSegment(segment!.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Selection API', () => {
    it('should set and get active network', () => {
      const network = pipingStore.createNetwork({
        name: 'Test',
        serviceType: 'water',
      });

      pipingStore.setActiveNetwork(network.id);
      const selection = pipingStore.getSelection();
      expect(selection.networkId).toBe(network.id);
    });

    it('should set and get selected node', () => {
      const network = pipingStore.createNetwork({
        name: 'Test',
        serviceType: 'water',
      });
      const node = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      pipingStore.setSelectedNode(node!.id);
      const selection = pipingStore.getSelection();
      expect(selection.nodeId).toBe(node!.id);
    });

    it('should clear selection', () => {
      const network = pipingStore.createNetwork({
        name: 'Test',
        serviceType: 'water',
      });

      pipingStore.setActiveNetwork(network.id);
      pipingStore.clearSelection();

      const selection = pipingStore.getSelection();
      expect(selection.networkId).toBeNull();
      expect(selection.nodeId).toBeNull();
      expect(selection.segmentId).toBeNull();
    });
  });

  describe('Utility Methods', () => {
    it('should get connected segments for a node', () => {
      const network = pipingStore.createNetwork({
        name: 'Test',
        serviceType: 'water',
      });

      const node1 = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const node2 = pipingStore.createNode(network.id, {
        position: { x: 10, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const node3 = pipingStore.createNode(network.id, {
        position: { x: 20, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      pipingStore.createSegment(network.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
      });

      pipingStore.createSegment(network.id, {
        fromNodeId: node2!.id,
        toNodeId: node3!.id,
        nominalDiameterMm: 40,
      });

      const connectedSegments = pipingStore.getConnectedSegments(node2!.id);
      expect(connectedSegments).toHaveLength(2);
    });
  });
});
