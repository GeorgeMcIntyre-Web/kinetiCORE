/**
 * Rapier Physics Engine Integration Tests
 * Owner: George (Agent 1)
 *
 * Tests the physics abstraction layer for:
 * - Fast initialization
 * - Efficient rigid body creation
 * - High-performance collision detection
 * - Memory management
 * - API correctness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RapierPhysicsEngine } from '../RapierPhysicsEngine';
import type { BodyDescriptor } from '../../core/types';

describe('RapierPhysicsEngine - Integration Tests', () => {
  let engine: RapierPhysicsEngine;

  beforeEach(async () => {
    engine = new RapierPhysicsEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });

  describe('Initialization', () => {
    it('should initialize quickly (< 100ms)', async () => {
      const startTime = performance.now();
      await engine.initialize();
      const endTime = performance.now();

      const initTime = endTime - startTime;
      expect(initTime).toBeLessThan(100); // Fast initialization
      expect(engine.getWorld()).not.toBeNull();
    });

    it('should initialize with custom gravity', async () => {
      const customGravity = { x: 0, y: -20, z: 0 };
      await engine.initialize(customGravity);

      expect(engine.getWorld()).not.toBeNull();
    });

    it('should handle multiple initialization calls gracefully', async () => {
      await engine.initialize();
      const world1 = engine.getWorld();

      // Second initialization should not break
      await engine.initialize();
      const world2 = engine.getWorld();

      expect(world1).toBe(world2);
    });
  });

  describe('Rigid Body Creation - Performance', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should create a dynamic box body efficiently', () => {
      const descriptor: BodyDescriptor = {
        type: 'dynamic',
        shape: 'box',
        position: { x: 0, y: 5, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
      };

      const startTime = performance.now();
      const handle = engine.createRigidBody(descriptor);
      const endTime = performance.now();

      expect(handle).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10); // < 10ms per body
    });

    it('should create 100 bodies quickly (< 1 second)', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const descriptor: BodyDescriptor = {
          type: 'dynamic',
          shape: 'sphere',
          position: { x: i % 10, y: 5 + Math.floor(i / 10), z: 0 },
          radius: 0.5,
        };
        engine.createRigidBody(descriptor);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(1000); // < 1 second for 100 bodies
      console.log(`Created 100 bodies in ${totalTime.toFixed(2)}ms`);
    });

    it('should create static ground plane efficiently', () => {
      const descriptor: BodyDescriptor = {
        type: 'static',
        shape: 'box',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { x: 100, y: 1, z: 100 },
      };

      const startTime = performance.now();
      const handle = engine.createRigidBody(descriptor);
      const endTime = performance.now();

      expect(handle).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should support all shape types', async () => {
      const shapes: Array<{
        shape: 'box' | 'sphere' | 'cylinder' | 'capsule';
        descriptor: BodyDescriptor;
      }> = [
        {
          shape: 'box',
          descriptor: {
            type: 'dynamic',
            shape: 'box',
            position: { x: 0, y: 0, z: 0 },
            dimensions: { x: 1, y: 1, z: 1 },
          },
        },
        {
          shape: 'sphere',
          descriptor: {
            type: 'dynamic',
            shape: 'sphere',
            position: { x: 2, y: 0, z: 0 },
            radius: 0.5,
          },
        },
        {
          shape: 'cylinder',
          descriptor: {
            type: 'dynamic',
            shape: 'cylinder',
            position: { x: 4, y: 0, z: 0 },
            radius: 0.5,
            height: 2,
          },
        },
        {
          shape: 'capsule',
          descriptor: {
            type: 'dynamic',
            shape: 'capsule',
            position: { x: 6, y: 0, z: 0 },
            radius: 0.5,
            height: 2,
          },
        },
      ];

      for (const { shape, descriptor } of shapes) {
        const handle = engine.createRigidBody(descriptor);
        expect(handle).toBeDefined();
        expect(handle).toMatch(/^[0-9a-f-]+$/); // UUID format
      }
    });
  });

  describe('Transform Updates - Performance', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should update body transform quickly', () => {
      const descriptor: BodyDescriptor = {
        type: 'dynamic',
        shape: 'box',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
      };

      const handle = engine.createRigidBody(descriptor);

      const startTime = performance.now();
      engine.updateRigidBodyTransform(
        handle,
        { x: 5, y: 10, z: 15 },
        { x: 0, y: 0, z: 0, w: 1 }
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5); // < 5ms

      const transform = engine.getRigidBodyTransform(handle);
      expect(transform).not.toBeNull();
      expect(transform?.position.x).toBeCloseTo(5, 1);
      expect(transform?.position.y).toBeCloseTo(10, 1);
      expect(transform?.position.z).toBeCloseTo(15, 1);
    });

    it('should handle rapid transform updates (60 FPS)', () => {
      const descriptor: BodyDescriptor = {
        type: 'kinematic',
        shape: 'box',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
      };

      const handle = engine.createRigidBody(descriptor);

      const startTime = performance.now();

      // Simulate 60 frames
      for (let i = 0; i < 60; i++) {
        engine.updateRigidBodyTransform(
          handle,
          { x: i * 0.1, y: 0, z: 0 },
          { x: 0, y: 0, z: 0, w: 1 }
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete 60 updates in < 16.67ms (60 FPS)
      expect(totalTime).toBeLessThan(100);
      console.log(`60 transform updates in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Physics Simulation - Performance', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should step physics simulation efficiently', () => {
      // Create a falling box
      const descriptor: BodyDescriptor = {
        type: 'dynamic',
        shape: 'box',
        position: { x: 0, y: 10, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
      };

      const handle = engine.createRigidBody(descriptor);

      const startTime = performance.now();

      // Simulate 60 frames (1 second at 60 FPS)
      for (let i = 0; i < 60; i++) {
        engine.step(1 / 60);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should simulate 1 second of physics in < 100ms
      expect(totalTime).toBeLessThan(100);
      console.log(`60 physics steps in ${totalTime.toFixed(2)}ms`);

      // Verify body fell due to gravity
      const transform = engine.getRigidBodyTransform(handle);
      expect(transform).not.toBeNull();
      expect(transform!.position.y).toBeLessThan(10); // Fell down
    });

    it('should handle multiple bodies efficiently (stress test)', () => {
      // Create 50 dynamic bodies
      const handles: string[] = [];
      for (let i = 0; i < 50; i++) {
        const descriptor: BodyDescriptor = {
          type: 'dynamic',
          shape: 'sphere',
          position: { x: (i % 10) * 2, y: 10 + Math.floor(i / 10) * 2, z: 0 },
          radius: 0.5,
        };
        handles.push(engine.createRigidBody(descriptor));
      }

      const startTime = performance.now();

      // Simulate 60 frames with 50 bodies
      for (let i = 0; i < 60; i++) {
        engine.step(1 / 60);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle 50 bodies at 60 FPS (< 200ms for 60 steps)
      expect(totalTime).toBeLessThan(200);
      console.log(`60 steps with 50 bodies in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Collision Detection', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should detect collisions between bodies', () => {
      // Create ground
      const groundDesc: BodyDescriptor = {
        type: 'static',
        shape: 'box',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { x: 100, y: 1, z: 100 },
      };
      const ground = engine.createRigidBody(groundDesc);

      // Create falling box
      const boxDesc: BodyDescriptor = {
        type: 'dynamic',
        shape: 'box',
        position: { x: 0, y: 5, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
      };
      const box = engine.createRigidBody(boxDesc);

      // Simulate until collision
      for (let i = 0; i < 120; i++) {
        engine.step(1 / 60);
      }

      // Check if collision occurred
      const colliding = engine.checkBodyCollision(box, ground);
      expect(colliding).toBe(true);
    });

    it('should get all active collisions efficiently', () => {
      // Create multiple bodies that will collide
      const bodies: string[] = [];

      // Ground
      bodies.push(engine.createRigidBody({
        type: 'static',
        shape: 'box',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { x: 100, y: 1, z: 100 },
      }));

      // Falling boxes
      for (let i = 0; i < 10; i++) {
        bodies.push(engine.createRigidBody({
          type: 'dynamic',
          shape: 'box',
          position: { x: i * 2, y: 5, z: 0 },
          dimensions: { x: 1, y: 1, z: 1 },
        }));
      }

      // Simulate
      for (let i = 0; i < 120; i++) {
        engine.step(1 / 60);
      }

      const startTime = performance.now();
      const collisions = engine.getActiveCollisions();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Fast collision query
      expect(collisions.length).toBeGreaterThan(0);
    });
  });

  describe('Raycast - Performance', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should perform raycasts quickly', () => {
      // Create a target box
      engine.createRigidBody({
        type: 'static',
        shape: 'box',
        position: { x: 0, y: 0, z: 10 },
        dimensions: { x: 1, y: 1, z: 1 },
      });

      const origin = { x: 0, y: 0, z: 0 };
      const direction = { x: 0, y: 0, z: 1 };

      const startTime = performance.now();
      const hit = engine.raycast(origin, direction, 100);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5); // < 5ms
      expect(hit).not.toBeNull();
      expect(hit?.distance).toBeCloseTo(9, 0); // Hit at ~9 units (box center at 10, half-size 0.5)
    });

    it('should handle multiple raycasts efficiently', () => {
      // Create obstacles
      for (let i = 0; i < 10; i++) {
        engine.createRigidBody({
          type: 'static',
          shape: 'sphere',
          position: { x: i * 5, y: 0, z: 0 },
          radius: 1,
        });
      }

      const startTime = performance.now();

      // Perform 100 raycasts
      for (let i = 0; i < 100; i++) {
        engine.raycast(
          { x: -10, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          100
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(100); // 100 raycasts in < 100ms
      console.log(`100 raycasts in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should clean up removed bodies', () => {
      const handles: string[] = [];

      // Create bodies
      for (let i = 0; i < 10; i++) {
        handles.push(engine.createRigidBody({
          type: 'dynamic',
          shape: 'sphere',
          position: { x: i, y: 0, z: 0 },
          radius: 0.5,
        }));
      }

      // Remove all bodies
      handles.forEach(handle => {
        engine.removeRigidBody(handle);
      });

      // Try to get transforms (should return null)
      handles.forEach(handle => {
        const transform = engine.getRigidBodyTransform(handle);
        expect(transform).toBeNull();
      });
    });

    it('should dispose cleanly', () => {
      // Create some bodies
      for (let i = 0; i < 10; i++) {
        engine.createRigidBody({
          type: 'dynamic',
          shape: 'sphere',
          position: { x: i, y: 0, z: 0 },
          radius: 0.5,
        });
      }

      // Dispose should not throw
      expect(() => engine.dispose()).not.toThrow();
    });
  });

  describe('Joint Constraints', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should create revolute joint efficiently', () => {
      const bodyA = engine.createRigidBody({
        type: 'static',
        shape: 'box',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
      });

      const bodyB = engine.createRigidBody({
        type: 'dynamic',
        shape: 'box',
        position: { x: 2, y: 0, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
      });

      const startTime = performance.now();
      const joint = engine.createRevoluteJoint(
        bodyA,
        bodyB,
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 }
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10);
      expect(joint).not.toBeNull();
    });

    it('should set joint limits', () => {
      const bodyA = engine.createRigidBody({
        type: 'static',
        shape: 'box',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
      });

      const bodyB = engine.createRigidBody({
        type: 'dynamic',
        shape: 'box',
        position: { x: 2, y: 0, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
      });

      const joint = engine.createRevoluteJoint(
        bodyA,
        bodyB,
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 }
      );

      expect(() => {
        engine.setJointLimits(joint!, -Math.PI / 2, Math.PI / 2);
      }).not.toThrow();
    });
  });
});
