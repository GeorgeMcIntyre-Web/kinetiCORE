// Unit tests for ConnectionPoint class
// Owner: Routing System Team

import { describe, it, expect } from 'vitest';
import { ConnectionPoint } from '../ConnectionPoint';
import { ConnectionPointConfig } from '../types';

describe('ConnectionPoint', () => {
  describe('constructor', () => {
    it('should create a connection point with valid config', () => {
      const config: ConnectionPointConfig = {
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { size: '3/4 inch' },
      };

      const point = new ConnectionPoint(config);

      expect(point.getId()).toBeDefined();
      expect(point.getType()).toBe('pipe');
      expect(point.getPosition()).toEqual({ x: 0, y: 0, z: 0 });
      expect(point.specifications.size).toBe('3/4 inch');
    });

    it('should normalize direction vector', () => {
      const config: ConnectionPointConfig = {
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 2, y: 0, z: 0 }, // Not normalized
        specifications: {},
      };

      const point = new ConnectionPoint(config);
      const dir = point.getDirection();

      const length = Math.sqrt(dir.x ** 2 + dir.y ** 2 + dir.z ** 2);
      expect(length).toBeCloseTo(1, 5);
    });

    it('should default to Z-up direction if direction is zero', () => {
      const config: ConnectionPointConfig = {
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 0 },
        specifications: {},
      };

      const point = new ConnectionPoint(config);
      const dir = point.getDirection();

      expect(dir).toEqual({ x: 0, y: 0, z: 1 });
    });
  });

  describe('canConnectTo', () => {
    it('should allow connection between same type points', () => {
      const point1 = new ConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const point2 = new ConnectionPoint({
        type: 'pipe',
        position: { x: 10, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      expect(point1.canConnectTo(point2)).toBe(true);
    });

    it('should reject connection between different types', () => {
      const point1 = new ConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const point2 = new ConnectionPoint({
        type: 'electrical',
        position: { x: 10, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      expect(point1.canConnectTo(point2)).toBe(false);
    });

    it('should reject connection to null/undefined', () => {
      const point = new ConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      expect(point.canConnectTo(null as any)).toBe(false);
      expect(point.canConnectTo(undefined as any)).toBe(false);
    });
  });

  describe('isCompatible', () => {
    it('should check pipe size compatibility', () => {
      const point1 = new ConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { size: '3/4 inch' },
      });

      const point2 = new ConnectionPoint({
        type: 'pipe',
        position: { x: 10, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { size: '3/4 inch' },
      });

      const point3 = new ConnectionPoint({
        type: 'pipe',
        position: { x: 20, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { size: '1/2 inch' },
      });

      expect(point1.isCompatible(point2)).toBe(true);
      expect(point1.isCompatible(point3)).toBe(false);
    });

    it('should check electrical voltage compatibility', () => {
      const point1 = new ConnectionPoint({
        type: 'electrical',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { voltage: 480 },
      });

      const point2 = new ConnectionPoint({
        type: 'electrical',
        position: { x: 10, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { voltage: 480 },
      });

      const point3 = new ConnectionPoint({
        type: 'electrical',
        position: { x: 20, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { voltage: 120 },
      });

      expect(point1.isCompatible(point2)).toBe(true);
      expect(point1.isCompatible(point3)).toBe(false);
    });
  });

  describe('distanceTo', () => {
    it('should calculate distance correctly', () => {
      const point1 = new ConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      const point2 = new ConnectionPoint({
        type: 'pipe',
        position: { x: 3, y: 4, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: {},
      });

      expect(point1.distanceTo(point2)).toBeCloseTo(5, 5);
    });
  });

  describe('clone', () => {
    it('should create an independent copy', () => {
      const original = new ConnectionPoint({
        type: 'pipe',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        specifications: { size: '3/4 inch' },
      });

      const clone = original.clone();

      expect(clone.getType()).toBe(original.getType());
      expect(clone.getPosition()).toEqual(original.getPosition());
      expect(clone.getId()).not.toBe(original.getId()); // Different IDs
    });
  });
});

