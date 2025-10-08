/**
 * Via Point Generator
 * Generates intermediate waypoints for spot welding with multiple fallback strategies
 *
 * Strategies (in order of complexity):
 * 1. Direct path (no via points needed)
 * 2. Lift-and-move (simple, guaranteed safe)
 * 3. Midpoint + offset (heuristic)
 * 4. RRT-Connect (full path planning)
 */

import * as BABYLON from '@babylonjs/core';
import { RobotPose, ViaPointOptions, JointAngles } from './types';
import { RRTConnectPlanner } from './RRTConnectPlanner';
import { KinematicsManager } from '../kinematics/KinematicsManager';
import { InverseKinematicsSolver } from '../kinematics/InverseKinematicsSolver';

export class ViaPointGenerator {
  private kinematicsManager: KinematicsManager;
  private ikSolver: InverseKinematicsSolver;
  private rrtPlanner: RRTConnectPlanner | null = null;
  private robotChainId: string;

  constructor(
    kinematicsManager: KinematicsManager,
    ikSolver: InverseKinematicsSolver,
    robotChainId: string,
    rrtPlanner?: RRTConnectPlanner
  ) {
    this.kinematicsManager = kinematicsManager;
    this.ikSolver = ikSolver;
    this.robotChainId = robotChainId;
    this.rrtPlanner = rrtPlanner || null;
  }

  /**
   * Generate via points between two weld spots
   */
  async generateViaPoints(
    start: RobotPose,
    goal: RobotPose,
    obstacles: BABYLON.Mesh[],
    options?: ViaPointOptions
  ): Promise<RobotPose[]> {
    const maxViaPoints = options?.maxViaPoints ?? 3;
    const safeHeight = options?.safeHeight ?? 0.5;
    const clearanceOffset = options?.clearanceOffset ?? 0.15;

    // Get joint configurations for start and goal
    const startIK = this.ikSolver.solveJacobianTranspose(
      this.robotChainId,
      { position: start.position, rotation: start.rotation }
    );
    const goalIK = this.ikSolver.solveJacobianTranspose(
      this.robotChainId,
      { position: goal.position, rotation: goal.rotation }
    );

    if (!startIK.success || !goalIK.success) {
      console.warn('IK failed for start or goal pose');
      return [];
    }

    // Strategy 1: Try direct path (no via points)
    if (this.rrtPlanner?.checkPathCollisionFree(
      startIK.jointAngles,
      goalIK.jointAngles,
      obstacles
    )) {
      return []; // No via points needed
    }

    // Strategy 2: Try lift-and-move pattern
    const liftViaPoints = await this.tryLiftAndMove(
      start,
      goal,
      startIK.jointAngles,
      goalIK.jointAngles,
      obstacles,
      safeHeight
    );
    if (liftViaPoints) {
      return liftViaPoints;
    }

    // Strategy 3: Try midpoint + offset
    const midpointViaPoints = await this.tryMidpointOffset(
      start,
      goal,
      startIK.jointAngles,
      goalIK.jointAngles,
      obstacles,
      clearanceOffset
    );
    if (midpointViaPoints) {
      return midpointViaPoints;
    }

    // Strategy 4: Use RRT-Connect for complex paths
    if (this.rrtPlanner) {
      const rrtViaPoints = await this.tryRRTConnect(
        start,
        goal,
        startIK.jointAngles,
        goalIK.jointAngles,
        obstacles,
        maxViaPoints
      );
      if (rrtViaPoints) {
        return rrtViaPoints;
      }
    }

    // All strategies failed - return empty (user will need manual intervention)
    console.warn('All via point generation strategies failed');
    return [];
  }

  /**
   * Strategy 1: Lift-and-move pattern
   * - Lift to safe height
   * - Move horizontally
   * - Descend to goal
   */
  private async tryLiftAndMove(
    start: RobotPose,
    goal: RobotPose,
    startConfig: JointAngles,
    goalConfig: JointAngles,
    obstacles: BABYLON.Mesh[],
    safeHeight: number
  ): Promise<RobotPose[] | null> {
    // Via point 1: Lift from start
    const liftStart = new BABYLON.Vector3(
      start.position.x,
      start.position.y,
      start.position.z + safeHeight
    );

    // Via point 2: Above goal
    const liftGoal = new BABYLON.Vector3(
      goal.position.x,
      goal.position.y,
      goal.position.z + safeHeight
    );

    // Check IK for via points
    const liftStartIK = this.ikSolver.solveJacobianTranspose(
      this.robotChainId,
      { position: liftStart, rotation: start.rotation }
    );
    const liftGoalIK = this.ikSolver.solveJacobianTranspose(
      this.robotChainId,
      { position: liftGoal, rotation: goal.rotation }
    );

    if (!liftStartIK.success || !liftGoalIK.success) {
      return null;
    }

    // Check collisions for all segments
    if (!this.rrtPlanner) return null;

    const segment1Free = this.rrtPlanner.checkPathCollisionFree(
      startConfig,
      liftStartIK.jointAngles,
      obstacles
    );
    const segment2Free = this.rrtPlanner.checkPathCollisionFree(
      liftStartIK.jointAngles,
      liftGoalIK.jointAngles,
      obstacles
    );
    const segment3Free = this.rrtPlanner.checkPathCollisionFree(
      liftGoalIK.jointAngles,
      goalConfig,
      obstacles
    );

    if (segment1Free && segment2Free && segment3Free) {
      return [
        { position: liftStart, rotation: start.rotation },
        { position: liftGoal, rotation: goal.rotation }
      ];
    }

    return null;
  }

  /**
   * Strategy 2: Midpoint + offset
   */
  private async tryMidpointOffset(
    start: RobotPose,
    goal: RobotPose,
    startConfig: JointAngles,
    goalConfig: JointAngles,
    obstacles: BABYLON.Mesh[],
    offset: number
  ): Promise<RobotPose[] | null> {
    const midpoint = BABYLON.Vector3.Lerp(start.position, goal.position, 0.5);

    // Try multiple offset directions
    const offsets = [
      new BABYLON.Vector3(0, 0, offset),      // Up
      new BABYLON.Vector3(offset, 0, offset),  // Right-up
      new BABYLON.Vector3(-offset, 0, offset), // Left-up
      new BABYLON.Vector3(0, offset, offset),  // Forward-up
      new BABYLON.Vector3(0, -offset, offset)  // Back-up
    ];

    for (const offsetVec of offsets) {
      const viaPos = midpoint.add(offsetVec);
      const viaRot = BABYLON.Quaternion.Slerp(start.rotation, goal.rotation, 0.5);

      // Check IK
      const viaIK = this.ikSolver.solveJacobianTranspose(
        this.robotChainId,
        { position: viaPos, rotation: viaRot }
      );
      if (!viaIK.success) continue;

      // Check collision for both segments
      if (!this.rrtPlanner) return null;

      const segment1Free = this.rrtPlanner.checkPathCollisionFree(
        startConfig,
        viaIK.jointAngles,
        obstacles
      );
      const segment2Free = this.rrtPlanner.checkPathCollisionFree(
        viaIK.jointAngles,
        goalConfig,
        obstacles
      );

      if (segment1Free && segment2Free) {
        return [{ position: viaPos, rotation: viaRot }];
      }
    }

    return null;
  }

  /**
   * Strategy 3: RRT-Connect for complex paths
   */
  private async tryRRTConnect(
    _start: RobotPose,
    _goal: RobotPose,
    startConfig: JointAngles,
    goalConfig: JointAngles,
    obstacles: BABYLON.Mesh[],
    maxViaPoints: number
  ): Promise<RobotPose[] | null> {
    if (!this.rrtPlanner) return null;

    const result = await this.rrtPlanner.plan(
      startConfig,
      goalConfig,
      obstacles,
      { maxIterations: 2000 }
    );

    if (!result.success) {
      return null;
    }

    // Simplify path to max via points
    const simplifiedPath = this.simplifyPath(result.path, maxViaPoints);

    // Convert joint configurations to poses
    const viaPoints: RobotPose[] = [];
    for (const config of simplifiedPath) {
      const pose = this.jointConfigToPose(config);
      if (pose) {
        viaPoints.push(pose);
      }
    }

    return viaPoints;
  }

  /**
   * Simplify path by removing redundant waypoints
   */
  private simplifyPath(
    path: JointAngles[],
    maxWaypoints: number
  ): JointAngles[] {
    if (path.length <= maxWaypoints + 2) {
      // Remove start and end (already have them)
      return path.slice(1, -1);
    }

    // Sample evenly along path
    const step = (path.length - 1) / (maxWaypoints + 1);
    const simplified: JointAngles[] = [];

    for (let i = 1; i <= maxWaypoints; i++) {
      const index = Math.floor(i * step);
      simplified.push(path[index]);
    }

    return simplified;
  }

  /**
   * Convert joint configuration to Cartesian pose using FK
   *
   * IMPLEMENTATION NOTE: This method requires KinematicsManager enhancements:
   * 1. Add updateJointAngles() method to apply joint configuration
   * 2. Add getEndEffector() method to KinematicChain to retrieve end-effector transform
   *
   * Currently returns placeholder pose. Will use ForwardKinematicsSolver once API is complete.
   */
  private jointConfigToPose(config: JointAngles): RobotPose | null {
    const chain = this.kinematicsManager.getChain(this.robotChainId);
    if (!chain) return null;

    // Build joint angle map from configuration array
    const jointMap = new Map<string, number>();
    chain.joints.forEach((joint, i) => {
      if (i < config.length) {
        jointMap.set(joint.id, config[i]);
      }
    });

    // TODO: Use ForwardKinematicsSolver.solve() to compute end-effector pose
    console.warn('[ViaPointGenerator] jointConfigToPose() awaiting KinematicsManager API', {
      robotChain: this.robotChainId,
      jointCount: jointMap.size
    });

    // Return placeholder pose until FK solver integration is complete
    return {
      position: new BABYLON.Vector3(0, 0, 0),
      rotation: BABYLON.Quaternion.Identity()
    };
  }
}
