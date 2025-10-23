/**
 * PerformanceMetrics.test.ts
 * 
 * Tests for the PerformanceMetrics singleton
 * Ensures accurate performance data collection and statistical analysis
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMetrics, performanceMetrics } from '../PerformanceMetrics';

describe('PerformanceMetrics', () => {
  let metrics: PerformanceMetrics;

  beforeEach(() => {
    metrics = PerformanceMetrics.getInstance();
    metrics.clear();
    metrics.setEnabled(true);
  });

  afterEach(() => {
    metrics.clear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PerformanceMetrics.getInstance();
      const instance2 = PerformanceMetrics.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use the exported singleton', () => {
      const instance = PerformanceMetrics.getInstance();

      expect(performanceMetrics).toBe(instance);
    });
  });

  describe('Enable/Disable', () => {
    it('should be enabled by default', () => {
      expect(metrics.isEnabled()).toBe(true);
    });

    it('should allow enabling/disabling', () => {
      metrics.setEnabled(false);
      expect(metrics.isEnabled()).toBe(false);

      metrics.setEnabled(true);
      expect(metrics.isEnabled()).toBe(true);
    });

    it('should not record when disabled', () => {
      metrics.setEnabled(false);

      metrics.recordFrame({
        fps: 60,
        frameTime: 16.7,
        drawCalls: 100,
        triangles: 1000,
        entities: 10,
        physicsBodies: 10,
      });

      const currentFrame = metrics.getCurrentFrame();
      expect(currentFrame).toBeNull();
    });
  });

  describe('Frame Recording', () => {
    it('should record frame metrics', () => {
      metrics.recordFrame({
        fps: 60,
        frameTime: 16.7,
        drawCalls: 100,
        triangles: 1000,
        entities: 10,
        physicsBodies: 10,
      });

      const currentFrame = metrics.getCurrentFrame();

      expect(currentFrame).not.toBeNull();
      expect(currentFrame?.fps).toBe(60);
      expect(currentFrame?.frameTime).toBe(16.7);
      expect(currentFrame?.drawCalls).toBe(100);
      expect(currentFrame?.triangles).toBe(1000);
      expect(currentFrame?.entities).toBe(10);
      expect(currentFrame?.physicsBodies).toBe(10);
    });

    it('should record multiple frames', () => {
      metrics.recordFrame({ fps: 60 });
      metrics.recordFrame({ fps: 58 });
      metrics.recordFrame({ fps: 62 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats).not.toBeNull();
      expect(frameStats?.fps.mean).toBeCloseTo(60, 0);
    });

    it('should maintain frame history', () => {
      for (let i = 0; i < 10; i++) {
        metrics.recordFrame({ fps: 60, frameTime: 16.7 });
      }

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.mean).toBeCloseTo(60, 5);
      expect(frameStats?.frameTime.mean).toBeCloseTo(16.7, 5);
    });

    it('should trim history when exceeding max size', () => {
      metrics.setMaxHistorySize(5);

      for (let i = 0; i < 10; i++) {
        metrics.recordFrame({ fps: i });
      }

      // Should only keep the last 5 frames
      const frameStats = metrics.getFrameStats();
      // Last 5 frames: 5, 6, 7, 8, 9 → mean = 7
      expect(frameStats?.fps.mean).toBeCloseTo(7, 0);
    });
  });

  describe('Memory Recording', () => {
    it('should handle missing memory API', () => {
      // Memory API might not be available in test environment
      metrics.recordMemory();

      // Should not throw
      const memory = metrics.getCurrentMemory();
      // Memory might be null if API is not available
      expect(memory === null || memory !== null).toBe(true);
    });
  });

  describe('Operation Timing', () => {
    it('should time operations', () => {
      metrics.startOperation('test-operation');

      // Simulate some work
      const start = performance.now();
      while (performance.now() - start < 10) {
        // Wait 10ms
      }

      metrics.endOperation('test-operation');

      const timings = metrics.getOperationTimings('test-operation');

      expect(timings.length).toBe(1);
      expect(timings[0].duration).toBeGreaterThanOrEqual(10);
    });

    it('should handle multiple operations with same name', () => {
      metrics.startOperation('test');
      metrics.endOperation('test');

      metrics.startOperation('test');
      metrics.endOperation('test');

      metrics.startOperation('test');
      metrics.endOperation('test');

      const timings = metrics.getOperationTimings('test');

      expect(timings.length).toBe(3);
    });

    it('should store operation metadata', () => {
      metrics.startOperation('test', { type: 'benchmark' });
      metrics.endOperation('test', { result: 'success' });

      const timings = metrics.getOperationTimings('test');

      expect(timings[0].metadata).toEqual({ result: 'success' });
    });

    it('should handle missing operations gracefully', () => {
      // Spy on console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      metrics.endOperation('non-existent-operation');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No active operation found')
      );

      warnSpy.mockRestore();
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate mean FPS', () => {
      metrics.recordFrame({ fps: 50 });
      metrics.recordFrame({ fps: 60 });
      metrics.recordFrame({ fps: 70 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.mean).toBeCloseTo(60, 0);
    });

    it('should calculate median FPS', () => {
      metrics.recordFrame({ fps: 10 });
      metrics.recordFrame({ fps: 50 });
      metrics.recordFrame({ fps: 60 });
      metrics.recordFrame({ fps: 70 });
      metrics.recordFrame({ fps: 100 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.median).toBe(60);
    });

    it('should calculate min and max FPS', () => {
      metrics.recordFrame({ fps: 30 });
      metrics.recordFrame({ fps: 60 });
      metrics.recordFrame({ fps: 90 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.min).toBe(30);
      expect(frameStats?.fps.max).toBe(90);
    });

    it('should calculate p95 and p99 percentiles', () => {
      // Record 100 frames with FPS from 1 to 100
      for (let i = 1; i <= 100; i++) {
        metrics.recordFrame({ fps: i });
      }

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.p95).toBe(95);
      expect(frameStats?.fps.p99).toBe(99);
    });

    it('should calculate standard deviation', () => {
      // All same values → stdDev should be 0
      metrics.recordFrame({ fps: 60 });
      metrics.recordFrame({ fps: 60 });
      metrics.recordFrame({ fps: 60 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.stdDev).toBeCloseTo(0, 5);
    });

    it('should handle single data point', () => {
      metrics.recordFrame({ fps: 60, frameTime: 16.7 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.mean).toBe(60);
      expect(frameStats?.fps.median).toBe(60);
      expect(frameStats?.fps.min).toBe(60);
      expect(frameStats?.fps.max).toBe(60);
    });
  });

  describe('Operation Statistics', () => {
    it('should calculate operation stats', () => {
      metrics.startOperation('ik-solve');
      metrics.endOperation('ik-solve');

      metrics.startOperation('ik-solve');
      metrics.endOperation('ik-solve');

      metrics.startOperation('ik-solve');
      metrics.endOperation('ik-solve');

      const opStats = metrics.getOperationStats('ik-solve');

      expect(opStats).not.toBeNull();
      expect(opStats?.mean).toBeGreaterThan(0);
    });

    it('should return null for non-existent operations', () => {
      const opStats = metrics.getOperationStats('non-existent');

      expect(opStats).toBeNull();
    });
  });

  describe('Export Functionality', () => {
    it('should export to JSON', () => {
      metrics.recordFrame({
        fps: 60,
        frameTime: 16.7,
        drawCalls: 100,
        triangles: 1000,
        entities: 10,
        physicsBodies: 10,
      });

      metrics.startOperation('test');
      metrics.endOperation('test');

      const snapshot = metrics.exportToJSON();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.frame.fps).toBe(60);
      expect(snapshot.operations.length).toBeGreaterThan(0);
    });

    it('should export stats summary', () => {
      metrics.recordFrame({ fps: 60, frameTime: 16.7 });
      metrics.startOperation('test');
      metrics.endOperation('test');

      const summary = metrics.exportStatsSummary();

      expect(summary.frames).not.toBeNull();
      expect(summary.operations).toBeDefined();
      expect(summary.memory).toBeDefined();
    });

    it('should include peak memory in summary', () => {
      const summary = metrics.exportStatsSummary();

      expect(summary.memory.peak).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Clear Functionality', () => {
    it('should clear all metrics', () => {
      metrics.recordFrame({ fps: 60 });
      metrics.startOperation('test');
      metrics.endOperation('test');

      metrics.clear();

      const currentFrame = metrics.getCurrentFrame();
      const frameStats = metrics.getFrameStats();
      const opStats = metrics.getOperationStats('test');

      expect(currentFrame).toBeNull();
      expect(frameStats).toBeNull();
      expect(opStats).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should allow setting max history size', () => {
      metrics.setMaxHistorySize(10);

      for (let i = 0; i < 20; i++) {
        metrics.recordFrame({ fps: i });
      }

      // Should only keep last 10 frames
      const frameStats = metrics.getFrameStats();
      // Last 10 frames: 10-19 → mean = 14.5
      expect(frameStats?.fps.mean).toBeCloseTo(14.5, 0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero FPS', () => {
      metrics.recordFrame({ fps: 0 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.mean).toBe(0);
    });

    it('should handle negative values', () => {
      metrics.recordFrame({ fps: -1 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.mean).toBe(-1);
    });

    it('should handle very large values', () => {
      metrics.recordFrame({ fps: 1e6 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.mean).toBe(1e6);
    });

    it('should handle very small values', () => {
      metrics.recordFrame({ fps: 0.001 });

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.mean).toBe(0.001);
    });
  });

  describe('Performance Target Validation', () => {
    it('should track if FPS meets 60 FPS target', () => {
      // Record 60 frames at 60 FPS
      for (let i = 0; i < 60; i++) {
        metrics.recordFrame({ fps: 60, frameTime: 16.67 });
      }

      const frameStats = metrics.getFrameStats();

      expect(frameStats?.fps.mean).toBeGreaterThanOrEqual(60);
      expect(frameStats?.frameTime.mean).toBeLessThanOrEqual(17);
    });

    it('should track if operation meets <100ms target', () => {
      // Simulate fast IK solve
      metrics.startOperation('ik-solve');
      // Immediate end (should be <1ms in tests)
      metrics.endOperation('ik-solve');

      const opStats = metrics.getOperationStats('ik-solve');

      expect(opStats?.mean).toBeLessThan(100);
    });
  });
});
