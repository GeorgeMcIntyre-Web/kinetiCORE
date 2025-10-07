/**
 * Spot Welding Planner
 * High-level interface for automated spot welding path planning
 *
 * Features:
 * - Automatic via point generation
 * - Spot sequence optimization (TSP)
 * - Smooth trajectory generation
 * - Approach/retract patterns
 */

import * as BABYLON from '@babylonjs/core';
import {
  WeldSpot,
  RobotPose,
  WeldingProgram,
  SpotWeldingConfig,
  ViaPointOptions
} from './types';
import { ViaPointGenerator } from './ViaPointGenerator';
import { TrajectoryOptimizer } from './TrajectoryOptimizer';
import { TSPSolver } from './TSPSolver';
import { KinematicsManager } from '../kinematics/KinematicsManager';

export class SpotWeldingPlanner {
  private config: SpotWeldingConfig;
  private viaPointGenerator: ViaPointGenerator;
  private trajectoryOptimizer: TrajectoryOptimizer;
  private tspSolver: TSPSolver;
  private kinematicsManager: KinematicsManager;

  constructor(
    config: SpotWeldingConfig,
    viaPointGenerator: ViaPointGenerator,
    trajectoryOptimizer: TrajectoryOptimizer,
    kinematicsManager: KinematicsManager
  ) {
    this.config = config;
    this.viaPointGenerator = viaPointGenerator;
    this.trajectoryOptimizer = trajectoryOptimizer;
    this.tspSolver = new TSPSolver();
    this.kinematicsManager = kinematicsManager;
  }

  /**
   * Plan complete welding program for a set of spots
   * @param spots - Array of weld spots
   * @param obstacles - Scene meshes to avoid
   * @param homePosition - Robot home position
   */
  async plan(
    spots: WeldSpot[],
    obstacles: BABYLON.Mesh[],
    homePosition?: BABYLON.Vector3
  ): Promise<WeldingProgram> {
    const startTime = performance.now();

    // Step 1: Optimize spot sequence (if enabled)
    let orderedSpots = spots;
    if (this.config.optimizeSequence) {
      orderedSpots = this.tspSolver.solveTSP(spots, homePosition);
      console.log('TSP optimization complete');
    }

    // Step 2: Generate approach/retract poses for each spot
    const allPoses: RobotPose[] = [];
    const viaPointCounts: number[] = [];

    for (let i = 0; i < orderedSpots.length; i++) {
      const spot = orderedSpots[i];
      const prevSpot = i > 0 ? orderedSpots[i - 1] : null;

      // Add retract pose from previous spot
      if (prevSpot) {
        const retractPose = this.createRetractPose(prevSpot);
        allPoses.push(retractPose);
      }

      // Generate via points between previous retract and current approach
      if (prevSpot) {
        const prevRetract = this.createRetractPose(prevSpot);
        const currentApproach = this.createApproachPose(spot);

        const viaPoints = await this.viaPointGenerator.generateViaPoints(
          prevRetract,
          currentApproach,
          obstacles,
          {
            maxViaPoints: this.config.maxViaPoints,
            approachDistance: this.config.approachDistance,
            retractDistance: this.config.retractDistance
          }
        );

        viaPointCounts.push(viaPoints.length);
        allPoses.push(...viaPoints);
      }

      // Add approach and weld poses
      const approachPose = this.createApproachPose(spot);
      const weldPose = this.createWeldPose(spot);

      allPoses.push(approachPose);
      allPoses.push(weldPose);
    }

    // Add return to start (closed loop)
    if (orderedSpots.length > 0) {
      const firstSpot = orderedSpots[0];
      const lastSpot = orderedSpots[orderedSpots.length - 1];

      const lastRetract = this.createRetractPose(lastSpot);
      const firstApproach = this.createApproachPose(firstSpot);

      const returnViaPoints = await this.viaPointGenerator.generateViaPoints(
        lastRetract,
        firstApproach,
        obstacles,
        {
          maxViaPoints: this.config.maxViaPoints
        }
      );

      allPoses.push(lastRetract);
      allPoses.push(...returnViaPoints);
      allPoses.push(firstApproach);
    }

    // Step 3: Generate smooth trajectory
    let trajectory = null;

    if (this.config.optimizeTrajectory) {
      // Estimate durations for each segment
      const durations = allPoses.slice(0, -1).map((pose, i) => {
        return this.trajectoryOptimizer.estimateSegmentDuration(
          pose,
          allPoses[i + 1],
          1.0 // max velocity rad/s
        );
      });

      trajectory = this.trajectoryOptimizer.generateSmoothTrajectory(
        allPoses,
        durations
      );
    }

    // Step 4: Calculate metrics
    const cycleTime = trajectory ? trajectory.totalDuration : 0;
    const pathLength = this.trajectoryOptimizer.calculateCartesianLength(allPoses);
    const totalViaPoints = viaPointCounts.reduce((sum, count) => sum + count, 0);

    const planningTime = performance.now() - startTime;
    console.log(`Planning completed in ${planningTime.toFixed(2)}ms`);
    console.log(`Cycle time: ${cycleTime.toFixed(2)}s`);
    console.log(`Path length: ${pathLength.toFixed(2)}m`);
    console.log(`Via points added: ${totalViaPoints}`);

    return {
      robotId: this.config.robotId,
      spots: orderedSpots,
      trajectory: trajectory!,
      cycleTime,
      pathLength,
      viaPointCount: totalViaPoints
    };
  }

  /**
   * Create approach pose (perpendicular to surface, approach distance away)
   */
  private createApproachPose(spot: WeldSpot): RobotPose {
    const approachDistance = this.config.approachDistance ?? 0.1;

    // Move along surface normal
    const approachPos = spot.position.add(
      spot.normal.scale(approachDistance)
    );

    // Orient tool perpendicular to surface
    const rotation = this.computeOrientationFromNormal(spot.normal);

    return {
      position: approachPos,
      rotation
    };
  }

  /**
   * Create weld pose (at spot location)
   */
  private createWeldPose(spot: WeldSpot): RobotPose {
    const rotation = this.computeOrientationFromNormal(spot.normal);

    return {
      position: spot.position.clone(),
      rotation
    };
  }

  /**
   * Create retract pose (perpendicular to surface, retract distance away)
   */
  private createRetractPose(spot: WeldSpot): RobotPose {
    const retractDistance = this.config.retractDistance ?? 0.05;

    const retractPos = spot.position.add(
      spot.normal.scale(retractDistance)
    );

    const rotation = this.computeOrientationFromNormal(spot.normal);

    return {
      position: retractPos,
      rotation
    };
  }

  /**
   * Compute tool orientation from surface normal
   * Tool should point along negative normal (into surface)
   */
  private computeOrientationFromNormal(normal: BABYLON.Vector3): BABYLON.Quaternion {
    // Tool Z-axis should align with negative normal
    const toolZ = normal.scale(-1);

    // Choose arbitrary X-axis perpendicular to Z
    let toolX = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), toolZ);
    if (toolX.length() < 0.01) {
      toolX = BABYLON.Vector3.Cross(BABYLON.Vector3.Right(), toolZ);
    }
    toolX.normalize();

    // Y-axis completes right-handed frame
    const toolY = BABYLON.Vector3.Cross(toolZ, toolX);

    // Build rotation matrix
    const rotationMatrix = BABYLON.Matrix.Identity();
    rotationMatrix.setRowFromFloats(0, toolX.x, toolX.y, toolX.z, 0);
    rotationMatrix.setRowFromFloats(1, toolY.x, toolY.y, toolY.z, 0);
    rotationMatrix.setRowFromFloats(2, toolZ.x, toolZ.y, toolZ.z, 0);

    return BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);
  }
}
