/**
 * ROS 2 Trajectory Exporter
 * Converts kinetiCORE trajectories to ROS 2 JointTrajectory messages
 */

import { RobotTrajectory } from '../../pathPlanning/types';
import { TrajectoryOptimizer } from '../../pathPlanning/TrajectoryOptimizer';
import {
  JointTrajectory,
  JointTrajectoryPoint,
  ROSHeader,
  FollowJointTrajectoryGoal
} from '../messages';
import { toROSTime, getCurrentROSTime } from '../utils';

export interface TrajectoryExportOptions {
  /** Sampling rate in Hz (default: 100 Hz) */
  samplingRate?: number;

  /** Frame ID for trajectory header (default: 'world') */
  frameId?: string;

  /** Whether to include velocities (default: true) */
  includeVelocities?: boolean;

  /** Whether to include accelerations (default: true) */
  includeAccelerations?: boolean;

  /** Whether to include efforts (default: false) */
  includeEfforts?: boolean;
}

/**
 * Exports kinetiCORE trajectories to ROS 2 format
 */
export class TrajectoryExporter {
  private optimizer: TrajectoryOptimizer;

  constructor(optimizer: TrajectoryOptimizer) {
    this.optimizer = optimizer;
  }

  /**
   * Convert kinetiCORE trajectory to ROS 2 JointTrajectory message
   * @param trajectory - kinetiCORE trajectory
   * @param jointNames - Names of joints (must match ROS robot description)
   * @param options - Export options
   * @returns ROS 2 JointTrajectory message
   */
  exportToJointTrajectory(
    trajectory: RobotTrajectory,
    jointNames: string[],
    options: TrajectoryExportOptions = {}
  ): JointTrajectory {
    const {
      samplingRate = 100,
      frameId = 'world',
      includeVelocities = true,
      includeAccelerations = true,
      includeEfforts = false
    } = options;

    const dt = 1.0 / samplingRate;
    const points: JointTrajectoryPoint[] = [];

    // Sample trajectory at regular intervals
    for (let t = 0; t <= trajectory.totalDuration; t += dt) {
      const positions = this.optimizer.sampleTrajectory(trajectory, t);

      if (!positions) {
        console.warn(`Failed to sample trajectory at t=${t}`);
        continue;
      }

      const point: JointTrajectoryPoint = {
        positions,
        time_from_start: toROSTime(t)
      };

      // Add velocities if requested
      if (includeVelocities) {
        const velocities = this.optimizer.sampleVelocity(trajectory, t);
        if (velocities) {
          point.velocities = velocities;
        }
      }

      // Add accelerations if requested
      if (includeAccelerations) {
        const accelerations = this.optimizer.sampleAcceleration(trajectory, t);
        if (accelerations) {
          point.accelerations = accelerations;
        }
      }

      // Add efforts if requested (currently zero, could be computed from dynamics)
      if (includeEfforts) {
        point.effort = new Array(jointNames.length).fill(0);
      }

      points.push(point);
    }

    // Ensure we include the final point exactly
    const finalTime = trajectory.totalDuration;
    const lastPoint = points[points.length - 1];
    if (
      !lastPoint ||
      Math.abs(lastPoint.time_from_start.sec + lastPoint.time_from_start.nanosec / 1e9 - finalTime) > 1e-6
    ) {
      const finalPositions = this.optimizer.sampleTrajectory(trajectory, finalTime);
      if (finalPositions) {
        const finalPoint: JointTrajectoryPoint = {
          positions: finalPositions,
          time_from_start: toROSTime(finalTime)
        };

        if (includeVelocities) {
          const velocities = this.optimizer.sampleVelocity(trajectory, finalTime);
          if (velocities) finalPoint.velocities = velocities;
        }

        if (includeAccelerations) {
          const accelerations = this.optimizer.sampleAcceleration(trajectory, finalTime);
          if (accelerations) finalPoint.accelerations = accelerations;
        }

        if (includeEfforts) {
          finalPoint.effort = new Array(jointNames.length).fill(0);
        }

        points.push(finalPoint);
      }
    }

    const header: ROSHeader = {
      stamp: getCurrentROSTime(),
      frame_id: frameId
    };

    return {
      header,
      joint_names: jointNames,
      points
    };
  }

  /**
   * Export as FollowJointTrajectory action goal
   * @param trajectory - kinetiCORE trajectory
   * @param jointNames - Joint names
   * @param options - Export options
   * @returns ROS 2 action goal
   */
  exportAsActionGoal(
    trajectory: RobotTrajectory,
    jointNames: string[],
    options: TrajectoryExportOptions = {}
  ): FollowJointTrajectoryGoal {
    const jointTrajectory = this.exportToJointTrajectory(trajectory, jointNames, options);

    return {
      trajectory: jointTrajectory,
      goal_time_tolerance: toROSTime(1.0) // 1 second tolerance
    };
  }

  /**
   * Export trajectory as JSON string
   * @param trajectory - kinetiCORE trajectory
   * @param jointNames - Joint names
   * @param options - Export options
   * @returns JSON string
   */
  exportAsJSON(
    trajectory: RobotTrajectory,
    jointNames: string[],
    options: TrajectoryExportOptions = {}
  ): string {
    const jointTrajectory = this.exportToJointTrajectory(trajectory, jointNames, options);
    return JSON.stringify(jointTrajectory, null, 2);
  }

  /**
   * Download trajectory as JSON file
   * @param trajectory - kinetiCORE trajectory
   * @param jointNames - Joint names
   * @param filename - Output filename (without extension)
   * @param options - Export options
   */
  downloadAsFile(
    trajectory: RobotTrajectory,
    jointNames: string[],
    filename: string,
    options: TrajectoryExportOptions = {}
  ): void {
    const json = this.exportAsJSON(trajectory, jointNames, options);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
  }

  /**
   * Get trajectory statistics
   * @param trajectory - kinetiCORE trajectory
   * @returns Statistics object
   */
  getTrajectoryStats(trajectory: RobotTrajectory): {
    duration: number;
    numSegments: number;
    numViaPoints: number;
  } {
    return {
      duration: trajectory.totalDuration,
      numSegments: trajectory.segments.length,
      numViaPoints: trajectory.viaPoints.length
    };
  }
}
