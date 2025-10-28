/**
 * Trajectory IK Solver
 * Owner: George
 *
 * Solves IK for motion paths (not just single targets)
 * with velocity and acceleration constraints
 */

import * as BABYLON from '@babylonjs/core';
import { InverseKinematicsSolver, IKTarget } from './InverseKinematicsSolver';
// KinematicsManager reference (for future integration)
// import { KinematicsManager } from './KinematicsManager';

/**
 * Waypoint in trajectory with time and constraints
 */
export interface TrajectoryWaypoint {
  time: number; // Time in seconds
  position: BABYLON.Vector3;
  orientation?: BABYLON.Quaternion;
  velocity?: BABYLON.Vector3; // Optional velocity constraint
  acceleration?: BABYLON.Vector3; // Optional acceleration constraint
}

/**
 * Trajectory configuration
 */
export interface TrajectoryConfig {
  waypoints: TrajectoryWaypoint[];
  maxVelocity?: number; // m/s
  maxAcceleration?: number; // m/s²
  interpolation?: 'linear' | 'cubic' | 'quintic';
  smoothing?: number; // 0-1, how much to smooth trajectory
}

/**
 * Solved trajectory with joint angles over time
 */
export interface SolvedTrajectory {
  chainName: string;
  success: boolean;
  timesteps: number[];
  jointAngles: number[][]; // [timestep][joint]
  nullTCPPositions: BABYLON.Vector3[];
  velocities?: number[][]; // Joint velocities
  accelerations?: number[][]; // Joint accelerations
  maxError: number;
  avgError: number;
}

/**
 * Trajectory IK Solver
 *
 * Solves IK for smooth motion paths with time parameterization
 */
export class TrajectoryIKSolver {
  private static instance: TrajectoryIKSolver | null = null;
  private ikSolver: InverseKinematicsSolver;
  // KinematicsManager reference (for future integration)
  // private kinematicsManager: KinematicsManager;

  private constructor() {
    this.ikSolver = InverseKinematicsSolver.getInstance();
    // this.kinematicsManager = KinematicsManager.getInstance();
  }

  static getInstance(): TrajectoryIKSolver {
    if (!TrajectoryIKSolver.instance) {
      TrajectoryIKSolver.instance = new TrajectoryIKSolver();
    }
    return TrajectoryIKSolver.instance;
  }

  /**
   * Solve IK for entire trajectory
   *
   * @param chainName Kinematic chain ID
   * @param config Trajectory configuration
   * @param timestep Time resolution (seconds)
   * @returns Solved trajectory with joint angles over time
   */
  solveTrajectory(
    chainName: string,
    config: TrajectoryConfig,
    timestep: number = 0.01 // 10ms default
  ): SolvedTrajectory {
    const { waypoints, interpolation = 'cubic' } = config;

    // Sort waypoints by time
    const sortedWaypoints = [...waypoints].sort((a, b) => a.time - b.time);

    // Generate time samples
    const startTime = sortedWaypoints[0].time;
    const endTime = sortedWaypoints[sortedWaypoints.length - 1].time;
    const timesteps: number[] = [];
    for (let t = startTime; t <= endTime; t += timestep) {
      timesteps.push(t);
    }

    // Interpolate waypoints to get target poses at each timestep
    const targets: IKTarget[] = timesteps.map((t) =>
      this.interpolateWaypoint(t, sortedWaypoints, interpolation)
    );

    // Solve IK for each timestep
    const jointAngles: number[][] = [];
    const nullTCPPositions: BABYLON.Vector3[] = [];
    const errors: number[] = [];

    let previousAngles: number[] | null = null;

    targets.forEach((target) => {
      const solution = this.ikSolver.solveJacobianTranspose(
        chainName,
        target,
        previousAngles || undefined,
        {
          maxIterations: 50,
          tolerance: 0.001,
          stepSize: 0.1,
        }
      );

      jointAngles.push(solution.jointAngles);
      nullTCPPositions.push(target.position);
      errors.push(solution.error);

      previousAngles = solution.jointAngles;
    });

    // Smooth trajectory if requested
    if (config.smoothing && config.smoothing > 0) {
      this.smoothTrajectory(jointAngles, config.smoothing);
    }

    // Enforce velocity/acceleration limits
    if (config.maxVelocity || config.maxAcceleration) {
      this.enforceKinematicLimits(
        jointAngles,
        timestep,
        config.maxVelocity,
        config.maxAcceleration
      );
    }

    // Compute velocities and accelerations
    const velocities = this.computeVelocities(jointAngles, timestep);
    const accelerations = this.computeAccelerations(velocities, timestep);

    const maxError = Math.max(...errors);
    const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length;

    return {
      chainName,
      success: maxError < 0.01, // 1cm tolerance
      timesteps,
      jointAngles,
      nullTCPPositions,
      velocities,
      accelerations,
      maxError,
      avgError,
    };
  }

  /**
   * Interpolate waypoint at specific time
   */
  private interpolateWaypoint(
    time: number,
    waypoints: TrajectoryWaypoint[],
    method: 'linear' | 'cubic' | 'quintic'
  ): IKTarget {
    // Find surrounding waypoints
    let prev: TrajectoryWaypoint | null = null;
    let next: TrajectoryWaypoint | null = null;

    for (let i = 0; i < waypoints.length - 1; i++) {
      if (waypoints[i].time <= time && waypoints[i + 1].time >= time) {
        prev = waypoints[i];
        next = waypoints[i + 1];
        break;
      }
    }

    if (!prev || !next) {
      // Outside range, use closest waypoint
      const closest =
        time < waypoints[0].time
          ? waypoints[0]
          : waypoints[waypoints.length - 1];
      return {
        position: closest.position,
        rotation: closest.orientation,
      };
    }

    // Interpolation parameter
    const t = (time - prev.time) / (next.time - prev.time);

    // Interpolate based on method
    switch (method) {
      case 'linear':
        return this.linearInterpolation(prev, next, t);
      case 'cubic':
        return this.cubicInterpolation(prev, next, t);
      case 'quintic':
        return this.quinticInterpolation(prev, next, t);
      default:
        return this.linearInterpolation(prev, next, t);
    }
  }

  private linearInterpolation(
    prev: TrajectoryWaypoint,
    next: TrajectoryWaypoint,
    t: number
  ): IKTarget {
    const position = BABYLON.Vector3.Lerp(prev.position, next.position, t);

    let rotation: BABYLON.Quaternion | undefined;
    if (prev.orientation && next.orientation) {
      rotation = BABYLON.Quaternion.Slerp(
        prev.orientation,
        next.orientation,
        t
      );
    }

    return { position, rotation };
  }

  private cubicInterpolation(
    prev: TrajectoryWaypoint,
    next: TrajectoryWaypoint,
    t: number
  ): IKTarget {
    // Cubic Hermite interpolation (smooth velocity)
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const velocity0 = prev.velocity || BABYLON.Vector3.Zero();
    const velocity1 = next.velocity || BABYLON.Vector3.Zero();

    const position = prev.position
      .scale(h00)
      .add(velocity0.scale(h10))
      .add(next.position.scale(h01))
      .add(velocity1.scale(h11));

    let rotation: BABYLON.Quaternion | undefined;
    if (prev.orientation && next.orientation) {
      rotation = BABYLON.Quaternion.Slerp(
        prev.orientation,
        next.orientation,
        t
      );
    }

    return { position, rotation };
  }

  private quinticInterpolation(
    prev: TrajectoryWaypoint,
    next: TrajectoryWaypoint,
    t: number
  ): IKTarget {
    // Quintic polynomial (smooth acceleration)
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    const h0 = 1 - 10 * t3 + 15 * t4 - 6 * t5;
    const h1 = 10 * t3 - 15 * t4 + 6 * t5;

    const position = prev.position.scale(h0).add(next.position.scale(h1));

    let rotation: BABYLON.Quaternion | undefined;
    if (prev.orientation && next.orientation) {
      rotation = BABYLON.Quaternion.Slerp(
        prev.orientation,
        next.orientation,
        t
      );
    }

    return { position, rotation };
  }

  /**
   * Smooth trajectory using moving average
   */
  private smoothTrajectory(jointAngles: number[][], smoothing: number): void {
    const windowSize = Math.max(3, Math.floor(smoothing * 10));
    const n = jointAngles.length;
    const numJoints = jointAngles[0]?.length || 0;

    for (let joint = 0; joint < numJoints; joint++) {
      const smoothed: number[] = [];

      for (let i = 0; i < n; i++) {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(n, i + Math.floor(windowSize / 2) + 1);

        let sum = 0;
        let count = 0;

        for (let j = start; j < end; j++) {
          sum += jointAngles[j][joint];
          count++;
        }

        smoothed.push(sum / count);
      }

      // Apply smoothed values
      for (let i = 0; i < n; i++) {
        jointAngles[i][joint] = smoothed[i];
      }
    }
  }

  /**
   * Enforce kinematic limits (velocity/acceleration)
   */
  private enforceKinematicLimits(
    jointAngles: number[][],
    timestep: number,
    maxVelocity?: number,
    maxAcceleration?: number
  ): void {
    const n = jointAngles.length;
    const numJoints = jointAngles[0]?.length || 0;

    for (let joint = 0; joint < numJoints; joint++) {
      for (let i = 1; i < n; i++) {
        const prev = jointAngles[i - 1][joint];
        let current = jointAngles[i][joint];

        // Velocity limiting
        if (maxVelocity) {
          const velocity = (current - prev) / timestep;
          if (Math.abs(velocity) > maxVelocity) {
            const sign = velocity > 0 ? 1 : -1;
            current = prev + sign * maxVelocity * timestep;
          }
        }

        // Acceleration limiting
        if (maxAcceleration && i > 1) {
          const prevPrev = jointAngles[i - 2][joint];
          const vel0 = (prev - prevPrev) / timestep;
          const vel1 = (current - prev) / timestep;
          const accel = (vel1 - vel0) / timestep;

          if (Math.abs(accel) > maxAcceleration) {
            const sign = accel > 0 ? 1 : -1;
            const limitedVel = vel0 + sign * maxAcceleration * timestep;
            current = prev + limitedVel * timestep;
          }
        }

        jointAngles[i][joint] = current;
      }
    }
  }

  /**
   * Compute joint velocities from angles
   */
  private computeVelocities(
    jointAngles: number[][],
    timestep: number
  ): number[][] {
    const velocities: number[][] = [];

    for (let i = 0; i < jointAngles.length; i++) {
      if (i === 0) {
        // Forward difference for first timestep
        velocities.push(
          jointAngles[i].map((angle, j) => (jointAngles[1][j] - angle) / timestep)
        );
      } else if (i === jointAngles.length - 1) {
        // Backward difference for last timestep
        velocities.push(
          jointAngles[i].map(
            (angle, j) => (angle - jointAngles[i - 1][j]) / timestep
          )
        );
      } else {
        // Central difference for middle timesteps
        velocities.push(
          jointAngles[i].map(
            (_, j) =>
              (jointAngles[i + 1][j] - jointAngles[i - 1][j]) / (2 * timestep)
          )
        );
      }
    }

    return velocities;
  }

  /**
   * Compute joint accelerations from velocities
   */
  private computeAccelerations(
    velocities: number[][],
    timestep: number
  ): number[][] {
    const accelerations: number[][] = [];

    for (let i = 0; i < velocities.length; i++) {
      if (i === 0) {
        accelerations.push(
          velocities[i].map((vel, j) => (velocities[1][j] - vel) / timestep)
        );
      } else if (i === velocities.length - 1) {
        accelerations.push(
          velocities[i].map(
            (vel, j) => (vel - velocities[i - 1][j]) / timestep
          )
        );
      } else {
        accelerations.push(
          velocities[i].map(
            (_, j) =>
              (velocities[i + 1][j] - velocities[i - 1][j]) / (2 * timestep)
          )
        );
      }
    }

    return accelerations;
  }
}
