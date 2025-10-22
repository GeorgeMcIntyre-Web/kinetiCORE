/**
 * Gait Generator
 * Owner: George
 *
 * Generates walking/locomotion patterns for humanoid and quadruped robots
 */

import * as BABYLON from '@babylonjs/core';
import { WholeBodyIKSolver } from './WholeBodyIKSolver';
import { TrajectoryWaypoint } from './TrajectoryIKSolver';

/**
 * Gait types
 */
export type GaitType =
  | 'walk'      // Walking (humanoid or quadruped)
  | 'trot'      // Trotting (quadruped diagonal pairs)
  | 'gallop'    // Galloping (quadruped)
  | 'crawl';    // Slow quadruped gait

/**
 * Gait configuration
 */
export interface GaitConfig {
  type: GaitType;
  stepLength: number;     // Length of one step (meters)
  stepHeight: number;     // Height to lift foot (meters)
  stepDuration: number;   // Time for one step (seconds)
  bodyHeight: number;     // Height of body above ground (meters)
  bodyWidth?: number;     // Distance between feet (meters)
}

/**
 * Gait phase (0-1 representing gait cycle)
 */
export interface GaitPhase {
  leftFoot: number;   // 0 = stance, 0.5 = swing
  rightFoot: number;
  leftFrontFoot?: number;  // For quadrupeds
  rightFrontFoot?: number;
}

/**
 * Generated gait trajectory
 */
export interface GaitTrajectory {
  duration: number;
  waypoints: Map<string, TrajectoryWaypoint[]>; // chainName -> waypoints
  supportPolygons: BABYLON.Vector3[][]; // Support polygon at each timestep
  comTargets: BABYLON.Vector3[]; // Desired CoM trajectory
}

/**
 * Gait Generator
 *
 * Generates locomotion patterns with proper foot placement and CoM motion
 */
export class GaitGenerator {
  private static instance: GaitGenerator | null = null;
  private wholeBodySolver: WholeBodyIKSolver;

  private constructor() {
    this.wholeBodySolver = WholeBodyIKSolver.getInstance();
  }

  static getInstance(): GaitGenerator {
    if (!GaitGenerator.instance) {
      GaitGenerator.instance = new GaitGenerator();
    }
    return GaitGenerator.instance;
  }

  /**
   * Generate humanoid walking trajectory
   *
   * @param config Gait configuration
   * @param numSteps Number of steps to generate
   * @param timestep Time resolution (seconds)
   * @returns Generated gait trajectory
   */
  generateHumanoidWalk(
    config: GaitConfig,
    numSteps: number = 4,
    timestep: number = 0.01
  ): GaitTrajectory {
    const { stepLength, stepHeight, stepDuration, bodyHeight, bodyWidth = 0.2 } = config;

    const waypoints = new Map<string, TrajectoryWaypoint[]>();
    const supportPolygons: BABYLON.Vector3[][] = [];
    const comTargets: BABYLON.Vector3[] = [];

    const leftFootWaypoints: TrajectoryWaypoint[] = [];
    const rightFootWaypoints: TrajectoryWaypoint[] = [];

    let time = 0;
    let leftFootX = 0;
    let rightFootX = 0;

    for (let step = 0; step < numSteps; step++) {
      const isLeftStep = step % 2 === 0;

      if (isLeftStep) {
        // Left foot swings forward
        leftFootX += stepLength;

        // Lift phase (first half of step)
        leftFootWaypoints.push({
          time,
          position: new BABYLON.Vector3(-bodyWidth / 2, stepHeight / 2, leftFootX - stepLength / 2),
        });

        leftFootWaypoints.push({
          time: time + stepDuration / 2,
          position: new BABYLON.Vector3(-bodyWidth / 2, stepHeight, leftFootX - stepLength / 4),
        });

        // Lower phase (second half of step)
        leftFootWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, leftFootX),
        });

        // Right foot stays planted
        rightFootWaypoints.push({
          time,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, rightFootX),
        });

        rightFootWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, rightFootX),
        });

        // CoM shifts toward left foot
        comTargets.push(new BABYLON.Vector3(-bodyWidth / 4, bodyHeight, leftFootX - stepLength / 2));

      } else {
        // Right foot swings forward
        rightFootX += stepLength;

        // Lift phase
        rightFootWaypoints.push({
          time,
          position: new BABYLON.Vector3(bodyWidth / 2, stepHeight / 2, rightFootX - stepLength / 2),
        });

        rightFootWaypoints.push({
          time: time + stepDuration / 2,
          position: new BABYLON.Vector3(bodyWidth / 2, stepHeight, rightFootX - stepLength / 4),
        });

        // Lower phase
        rightFootWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, rightFootX),
        });

        // Left foot stays planted
        leftFootWaypoints.push({
          time,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, leftFootX),
        });

        leftFootWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, leftFootX),
        });

        // CoM shifts toward right foot
        comTargets.push(new BABYLON.Vector3(bodyWidth / 4, bodyHeight, rightFootX - stepLength / 2));
      }

      time += stepDuration;

      // Build support polygon (both feet on ground at end of step)
      supportPolygons.push([
        new BABYLON.Vector3(-bodyWidth / 2, 0, leftFootX),
        new BABYLON.Vector3(bodyWidth / 2, 0, rightFootX),
      ]);
    }

    waypoints.set('left_leg', leftFootWaypoints);
    waypoints.set('right_leg', rightFootWaypoints);

    return {
      duration: time,
      waypoints,
      supportPolygons,
      comTargets,
    };
  }

  /**
   * Generate quadruped trot trajectory
   *
   * In trot gait, diagonal pairs of legs move together:
   * - Left-front + Right-rear
   * - Right-front + Left-rear
   */
  generateQuadrupedTrot(
    config: GaitConfig,
    numSteps: number = 4,
    timestep: number = 0.01
  ): GaitTrajectory {
    const { stepLength, stepHeight, stepDuration, bodyHeight, bodyWidth = 0.3 } = config;
    const bodyLength = 0.5; // Typical dog-sized quadruped

    const waypoints = new Map<string, TrajectoryWaypoint[]>();
    const supportPolygons: BABYLON.Vector3[][] = [];
    const comTargets: BABYLON.Vector3[] = [];

    const leftFrontWaypoints: TrajectoryWaypoint[] = [];
    const rightFrontWaypoints: TrajectoryWaypoint[] = [];
    const leftRearWaypoints: TrajectoryWaypoint[] = [];
    const rightRearWaypoints: TrajectoryWaypoint[] = [];

    let time = 0;
    let positionX = 0;

    for (let step = 0; step < numSteps; step++) {
      const isDiagonal1 = step % 2 === 0; // Left-front + Right-rear

      positionX += stepLength;

      if (isDiagonal1) {
        // Lift left-front and right-rear
        leftFrontWaypoints.push({
          time,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, positionX - stepLength + bodyLength / 2),
        });

        leftFrontWaypoints.push({
          time: time + stepDuration / 2,
          position: new BABYLON.Vector3(-bodyWidth / 2, stepHeight, positionX - stepLength / 2 + bodyLength / 2),
        });

        leftFrontWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, positionX + bodyLength / 2),
        });

        rightRearWaypoints.push({
          time,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, positionX - stepLength - bodyLength / 2),
        });

        rightRearWaypoints.push({
          time: time + stepDuration / 2,
          position: new BABYLON.Vector3(bodyWidth / 2, stepHeight, positionX - stepLength / 2 - bodyLength / 2),
        });

        rightRearWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, positionX - bodyLength / 2),
        });

        // Right-front and left-rear stay planted
        rightFrontWaypoints.push({
          time,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, positionX - stepLength + bodyLength / 2),
        });

        rightFrontWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, positionX - stepLength + bodyLength / 2),
        });

        leftRearWaypoints.push({
          time,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, positionX - stepLength - bodyLength / 2),
        });

        leftRearWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, positionX - stepLength - bodyLength / 2),
        });

      } else {
        // Lift right-front and left-rear (opposite diagonal)
        rightFrontWaypoints.push({
          time,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, positionX - stepLength + bodyLength / 2),
        });

        rightFrontWaypoints.push({
          time: time + stepDuration / 2,
          position: new BABYLON.Vector3(bodyWidth / 2, stepHeight, positionX - stepLength / 2 + bodyLength / 2),
        });

        rightFrontWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, positionX + bodyLength / 2),
        });

        leftRearWaypoints.push({
          time,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, positionX - stepLength - bodyLength / 2),
        });

        leftRearWaypoints.push({
          time: time + stepDuration / 2,
          position: new BABYLON.Vector3(-bodyWidth / 2, stepHeight, positionX - stepLength / 2 - bodyLength / 2),
        });

        leftRearWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, positionX - bodyLength / 2),
        });

        // Left-front and right-rear stay planted
        leftFrontWaypoints.push({
          time,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, positionX - stepLength + bodyLength / 2),
        });

        leftFrontWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(-bodyWidth / 2, 0, positionX - stepLength + bodyLength / 2),
        });

        rightRearWaypoints.push({
          time,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, positionX - stepLength - bodyLength / 2),
        });

        rightRearWaypoints.push({
          time: time + stepDuration,
          position: new BABYLON.Vector3(bodyWidth / 2, 0, positionX - stepLength - bodyLength / 2),
        });
      }

      time += stepDuration;

      // Support polygon (two feet on ground)
      const currentLeftFront = leftFrontWaypoints[leftFrontWaypoints.length - 1].position;
      const currentRightFront = rightFrontWaypoints[rightFrontWaypoints.length - 1].position;
      const currentLeftRear = leftRearWaypoints[leftRearWaypoints.length - 1].position;
      const currentRightRear = rightRearWaypoints[rightRearWaypoints.length - 1].position;

      supportPolygons.push([
        currentLeftFront,
        currentRightFront,
        currentRightRear,
        currentLeftRear,
      ]);

      // CoM stays centered
      comTargets.push(new BABYLON.Vector3(0, bodyHeight, positionX));
    }

    waypoints.set('left_front_leg', leftFrontWaypoints);
    waypoints.set('right_front_leg', rightFrontWaypoints);
    waypoints.set('left_rear_leg', leftRearWaypoints);
    waypoints.set('right_rear_leg', rightRearWaypoints);

    return {
      duration: time,
      waypoints,
      supportPolygons,
      comTargets,
    };
  }

  /**
   * Get gait phase at specific time
   */
  getPhaseAtTime(time: number, gaitType: GaitType, stepDuration: number): GaitPhase {
    const cycleTime = stepDuration * 2; // Full gait cycle (both feet)
    const phase = (time % cycleTime) / cycleTime;

    switch (gaitType) {
      case 'walk':
        // Humanoid walk: alternating feet
        return {
          leftFoot: phase < 0.5 ? phase * 2 : 0,
          rightFoot: phase >= 0.5 ? (phase - 0.5) * 2 : 0,
        };

      case 'trot':
        // Quadruped trot: diagonal pairs
        const diagonalPhase = phase < 0.5 ? phase * 2 : 0;
        const oppositeDiagonalPhase = phase >= 0.5 ? (phase - 0.5) * 2 : 0;

        return {
          leftFoot: diagonalPhase,          // Left-front
          rightFoot: oppositeDiagonalPhase, // Right-front
          leftFrontFoot: diagonalPhase,     // Same as left
          rightFrontFoot: oppositeDiagonalPhase, // Same as right
        };

      default:
        return {
          leftFoot: 0,
          rightFoot: 0,
        };
    }
  }
}
