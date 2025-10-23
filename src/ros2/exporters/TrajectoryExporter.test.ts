/**
 * Unit Tests for Trajectory Exporter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TrajectoryExporter } from './TrajectoryExporter';
import { RobotTrajectory } from '../../pathPlanning/types';

// Mock TrajectoryOptimizer
class MockTrajectoryOptimizer {
  sampleTrajectory(trajectory: RobotTrajectory, time: number): number[] | null {
    // Return mock joint angles
    return [0.1 * time, 0.2 * time, 0.3 * time];
  }

  sampleVelocity(trajectory: RobotTrajectory, time: number): number[] | null {
    return [0.1, 0.2, 0.3];
  }

  sampleAcceleration(trajectory: RobotTrajectory, time: number): number[] | null {
    return [0.01, 0.02, 0.03];
  }
}

describe('TrajectoryExporter', () => {
  let exporter: TrajectoryExporter;
  let mockTrajectory: RobotTrajectory;

  beforeEach(() => {
    const mockOptimizer = new MockTrajectoryOptimizer() as any;
    exporter = new TrajectoryExporter(mockOptimizer);

    mockTrajectory = {
      segments: [],
      totalDuration: 2.0,
      viaPoints: []
    };
  });

  describe('exportToJointTrajectory', () => {
    it('should export trajectory with correct joint names', () => {
      const jointNames = ['joint1', 'joint2', 'joint3'];
      const result = exporter.exportToJointTrajectory(mockTrajectory, jointNames);

      expect(result.joint_names).toEqual(jointNames);
    });

    it('should include header with frame_id', () => {
      const result = exporter.exportToJointTrajectory(
        mockTrajectory,
        ['j1', 'j2', 'j3'],
        { frameId: 'base_link' }
      );

      expect(result.header.frame_id).toBe('base_link');
      expect(result.header.stamp).toBeDefined();
      expect(result.header.stamp.sec).toBeGreaterThan(0);
    });

    it('should sample at correct rate', () => {
      const samplingRate = 10; // 10 Hz
      const result = exporter.exportToJointTrajectory(
        mockTrajectory,
        ['j1', 'j2', 'j3'],
        { samplingRate }
      );

      // Expected points: 2 seconds * 10 Hz + 1 (final point) = 21
      expect(result.points.length).toBeGreaterThanOrEqual(20);
      expect(result.points.length).toBeLessThanOrEqual(22);
    });

    it('should include velocities when requested', () => {
      const result = exporter.exportToJointTrajectory(
        mockTrajectory,
        ['j1', 'j2', 'j3'],
        { includeVelocities: true }
      );

      result.points.forEach((point) => {
        expect(point.velocities).toBeDefined();
        expect(point.velocities!.length).toBe(3);
      });
    });

    it('should include accelerations when requested', () => {
      const result = exporter.exportToJointTrajectory(
        mockTrajectory,
        ['j1', 'j2', 'j3'],
        { includeAccelerations: true }
      );

      result.points.forEach((point) => {
        expect(point.accelerations).toBeDefined();
        expect(point.accelerations!.length).toBe(3);
      });
    });

    it('should not include velocities when not requested', () => {
      const result = exporter.exportToJointTrajectory(
        mockTrajectory,
        ['j1', 'j2', 'j3'],
        { includeVelocities: false }
      );

      result.points.forEach((point) => {
        expect(point.velocities).toBeUndefined();
      });
    });

    it('should include effort array when requested', () => {
      const result = exporter.exportToJointTrajectory(
        mockTrajectory,
        ['j1', 'j2', 'j3'],
        { includeEfforts: true }
      );

      result.points.forEach((point) => {
        expect(point.effort).toBeDefined();
        expect(point.effort!.length).toBe(3);
      });
    });

    it('should have monotonically increasing time_from_start', () => {
      const result = exporter.exportToJointTrajectory(
        mockTrajectory,
        ['j1', 'j2', 'j3']
      );

      for (let i = 1; i < result.points.length; i++) {
        const prevTime = result.points[i - 1].time_from_start;
        const currTime = result.points[i].time_from_start;
        const prevSeconds = prevTime.sec + prevTime.nanosec / 1e9;
        const currSeconds = currTime.sec + currTime.nanosec / 1e9;

        expect(currSeconds).toBeGreaterThan(prevSeconds);
      }
    });
  });

  describe('exportAsJSON', () => {
    it('should export as valid JSON', () => {
      const json = exporter.exportAsJSON(mockTrajectory, ['j1', 'j2', 'j3']);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should be human-readable (formatted)', () => {
      const json = exporter.exportAsJSON(mockTrajectory, ['j1', 'j2', 'j3']);
      expect(json).toContain('\n'); // Should have newlines
      expect(json).toContain('  '); // Should have indentation
    });
  });

  describe('getTrajectoryStats', () => {
    it('should return correct duration', () => {
      const stats = exporter.getTrajectoryStats(mockTrajectory);
      expect(stats.duration).toBe(2.0);
    });

    it('should return segment count', () => {
      mockTrajectory.segments = [{} as any, {} as any];
      const stats = exporter.getTrajectoryStats(mockTrajectory);
      expect(stats.numSegments).toBe(2);
    });

    it('should return via point count', () => {
      mockTrajectory.viaPoints = [{} as any, {} as any, {} as any];
      const stats = exporter.getTrajectoryStats(mockTrajectory);
      expect(stats.numViaPoints).toBe(3);
    });
  });
});
