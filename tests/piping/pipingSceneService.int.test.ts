// Integration tests for PipingSceneService
// Owner: Agent 1 (George)
// Tests the scene service mesh lifecycle and store reaction

import * as BABYLON from '@babylonjs/core';
import { PipingSceneService } from '../../src/services/piping/PipingSceneService';
import { pipingStore } from '../../src/domain/factoryServices/piping/pipingStore';
import { domainToBabylonVector } from '../../src/services/piping/pipingCoordinates';

describe('PipingSceneService Integration', () => {
  let engine: BABYLON.NullEngine;
  let scene: BABYLON.Scene;
  let service: PipingSceneService;

  beforeEach(() => {
    // Create a null engine for headless testing
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);

    // Clear piping store
    pipingStore.clear();

    // Create service
    service = new PipingSceneService(scene);
  });

  afterEach(() => {
    // Clean up
    service.stop();
    scene.dispose();
    engine.dispose();
  });

  describe('Service Lifecycle', () => {
    it('should start and subscribe to store', () => {
      service.start();

      // Create a network and node
      const network = pipingStore.createNetwork({
        name: 'Test Network',
        serviceType: 'water',
      });

      const node = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      // Service should have created a mesh for the node
      const nodeMesh = service.getNodeMesh(node!.id);
      expect(nodeMesh).toBeDefined();
      expect(nodeMesh?.metadata.pipingNodeId).toBe(node!.id);
    });

    it('should stop and dispose all meshes', () => {
      service.start();

      const network = pipingStore.createNetwork({
        name: 'Test Network',
        serviceType: 'water',
      });

      const node = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const nodeMesh = service.getNodeMesh(node!.id);
      expect(nodeMesh).toBeDefined();

      // Stop service
      service.stop();

      // Mesh should be disposed (checking via scene)
      const meshInScene = scene.getMeshByName(`piping_node_${node!.id}`);
      expect(meshInScene).toBeNull();
    });
  });

  describe('Node Mesh Management', () => {
    beforeEach(() => {
      service.start();
    });

    it('should create mesh for new node', () => {
      const network = pipingStore.createNetwork({
        name: 'Test',
        serviceType: 'water',
      });

      const node = pipingStore.createNode(network.id, {
        position: { x: 1, y: 2, z: 3 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const mesh = service.getNodeMesh(node!.id);
      const expectedPosition = domainToBabylonVector(node!.position);

      expect(mesh).toBeDefined();
      expect(mesh!.position.x).toBe(expectedPosition.x);
      expect(mesh!.position.y).toBe(expectedPosition.y);
      expect(mesh!.position.z).toBe(expectedPosition.z);
    });

    it('should update mesh position when node position changes', () => {
      const network = pipingStore.createNetwork({
        name: 'Test',
        serviceType: 'water',
      });

      const node = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const mesh = service.getNodeMesh(node!.id);
      expect(mesh!.position.x).toBe(domainToBabylonVector(node!.position).x);

      // Update node position
      pipingStore.updateNode(node!.id, {
        position: { x: 10, y: 5, z: 7 },
      });

      // Mesh position should be updated
      const updatedMesh = service.getNodeMesh(node!.id);
      const expectedPosition = domainToBabylonVector({
        x: 10,
        y: 5,
        z: 7,
      });
      expect(updatedMesh!.position.x).toBe(expectedPosition.x);
      expect(updatedMesh!.position.y).toBe(expectedPosition.y);
      expect(updatedMesh!.position.z).toBe(expectedPosition.z);
    });

    it('should dispose mesh when node is deleted', () => {
      const network = pipingStore.createNetwork({
        name: 'Test',
        serviceType: 'water',
      });

      const node = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const nodeId = node!.id;
      const meshBefore = service.getNodeMesh(nodeId);
      expect(meshBefore).toBeDefined();

      // Delete node
      pipingStore.deleteNode(nodeId);

      // Mesh should be removed
      const meshAfter = service.getNodeMesh(nodeId);
      expect(meshAfter).toBeUndefined();
    });
  });

  describe('Segment Mesh Management', () => {
    beforeEach(() => {
      service.start();
    });

    it('should create mesh for new segment', () => {
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

      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
      });

      const mesh = service.getSegmentMesh(segment!.id);
      expect(mesh).toBeDefined();
      expect(mesh!.metadata.pipingSegmentId).toBe(segment!.id);
    });

    it('should dispose mesh when segment is deleted', () => {
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

      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
      });

      const segmentId = segment!.id;
      const meshBefore = service.getSegmentMesh(segmentId);
      expect(meshBefore).toBeDefined();

      // Delete segment
      pipingStore.deleteSegment(segmentId);

      // Mesh should be removed
      const meshAfter = service.getSegmentMesh(segmentId);
      expect(meshAfter).toBeUndefined();
    });

    it('should update segment mesh when diameter changes', () => {
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

      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
      });

      const meshBefore = service.getSegmentMesh(segment!.id);
      expect(meshBefore).toBeDefined();

      // Update diameter
      pipingStore.updateSegment(segment!.id, {
        nominalDiameterMm: 80,
      });

      // Mesh should still exist (might be recreated)
      const meshAfter = service.getSegmentMesh(segment!.id);
      expect(meshAfter).toBeDefined();
    });

    it('should delete segment meshes when node is deleted', () => {
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

      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
      });

      const segmentId = segment!.id;
      expect(service.getSegmentMesh(segmentId)).toBeDefined();

      // Delete node (should cascade delete segment)
      pipingStore.deleteNode(node1!.id);

      // Segment mesh should be removed
      expect(service.getSegmentMesh(segmentId)).toBeUndefined();
    });
  });

  describe('Mesh Picking', () => {
    beforeEach(() => {
      service.start();
    });

    it('should identify picked node mesh', () => {
      const network = pipingStore.createNetwork({
        name: 'Test',
        serviceType: 'water',
      });

      const node = pipingStore.createNode(network.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const mesh = service.getNodeMesh(node!.id);
      const pickResult = service.handlePick(mesh!);

      expect(pickResult.type).toBe('node');
      expect(pickResult.id).toBe(node!.id);
    });

    it('should identify picked segment mesh', () => {
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

      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: node1!.id,
        toNodeId: node2!.id,
        nominalDiameterMm: 40,
      });

      const mesh = service.getSegmentMesh(segment!.id);
      const pickResult = service.handlePick(mesh!);

      expect(pickResult.type).toBe('segment');
      expect(pickResult.id).toBe(segment!.id);
    });

    it('should return null for non-piping mesh', () => {
      const randomMesh = BABYLON.MeshBuilder.CreateBox('random', { size: 1 }, scene);
      const pickResult = service.handlePick(randomMesh);

      expect(pickResult.type).toBeNull();
      expect(pickResult.id).toBeNull();
    });

    it('should handle null pick gracefully', () => {
      const pickResult = service.handlePick(null);

      expect(pickResult.type).toBeNull();
      expect(pickResult.id).toBeNull();
    });
  });

  describe('Multiple Networks', () => {
    beforeEach(() => {
      service.start();
    });

    it('should manage meshes for multiple networks', () => {
      const network1 = pipingStore.createNetwork({
        name: 'Water Network',
        serviceType: 'water',
      });

      const network2 = pipingStore.createNetwork({
        name: 'Air Network',
        serviceType: 'air',
      });

      const node1 = pipingStore.createNode(network1.id, {
        position: { x: 0, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'water',
      });

      const node2 = pipingStore.createNode(network2.id, {
        position: { x: 5, y: 0, z: 0 },
        kind: 'endpoint',
        serviceType: 'air',
      });

      expect(service.getNodeMesh(node1!.id)).toBeDefined();
      expect(service.getNodeMesh(node2!.id)).toBeDefined();
    });
  });
});
