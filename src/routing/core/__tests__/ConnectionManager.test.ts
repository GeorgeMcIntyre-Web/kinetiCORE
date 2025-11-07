// Unit tests for ConnectionManager class
// Owner: Routing System Team

import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionManager } from '../ConnectionManager';
import { ConnectionPointConfig } from '../types';

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    // Reset singleton for each test
    (ConnectionManager as any).instance = null;
    manager = ConnectionManager.getInstance();
    manager.clear();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConnectionManager.getInstance();
      const instance2 = ConnectionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('addConnectionPoint', () => {
    it('should add a connection point', () => {
      const config: ConnectionPointConfig = {
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      };

      const point = manager.addConnectionPoint(config);

      expect(point).toBeDefined();
      expect(manager.getConnectionPoint(point.getId())).toBe(point);
      expect(manager.getConnectionPointCount()).toBe(1);
    });
  });

  describe('removeConnectionPoint', () => {
    it('should remove a connection point', () => {
      const point = manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const removed = manager.removeConnectionPoint(point.getId());

      expect(removed).toBe(true);
      expect(manager.getConnectionPoint(point.getId())).toBeNull();
      expect(manager.getConnectionPointCount()).toBe(0);
    });

    it('should return false for non-existent point', () => {
      expect(manager.removeConnectionPoint('non-existent')).toBe(false);
    });
  });

  describe('findNearbyConnections', () => {
    it('should find connections within radius', () => {
      manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 5, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 15, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const nearby = manager.findNearbyConnections({ x: 0, y: 0, z: 0 }, 10);

      expect(nearby.length).toBe(2); // Self and the one at (5,0,0)
      expect(nearby[0].getPosition().x).toBe(0); // Closest first
    });
  });

  describe('findCompatibleConnections', () => {
    it('should find compatible connections', () => {
      const point1 = manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { size: '3/4 inch' },
      });

      manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 10, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { size: '3/4 inch' },
      });

      manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 20, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { size: '1/2 inch' },
      });

      const compatible = manager.findCompatibleConnections(point1);

      expect(compatible.length).toBe(1);
      expect(compatible[0].getPosition().x).toBe(10);
    });
  });

  describe('createConnection', () => {
    it('should create a connection between two points', () => {
      const point1 = manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const point2 = manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 10, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const connection = manager.createConnection(point1.getId(), point2.getId());

      expect(connection).toBeDefined();
      expect(connection?.fromId).toBe(point1.getId());
      expect(connection?.toId).toBe(point2.getId());

      const connections1 = manager.getConnections(point1.getId());
      expect(connections1.length).toBe(1);
    });

    it('should return null for incompatible types', () => {
      const point1 = manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const point2 = manager.addConnectionPoint({
        type: 'electrical',
        position: { x: 10, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const connection = manager.createConnection(point1.getId(), point2.getId());

      expect(connection).toBeNull();
    });
  });

  describe('getConnectionPointsByType', () => {
    it('should filter points by type', () => {
      manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      manager.addConnectionPoint({
        type: 'electrical',
        position: { x: 10, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      manager.addConnectionPoint({
        type: 'pipe',
        position: { x: 20, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const pipes = manager.getConnectionPointsByType('pipe');
      expect(pipes.length).toBe(2);

      const electrical = manager.getConnectionPointsByType('electrical');
      expect(electrical.length).toBe(1);
    });
  });
});

