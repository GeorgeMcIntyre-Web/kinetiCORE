// @ts-nocheck - Work in progress: Missing methods in KinematicsManager/KinematicChain
/**
 * RRT-Connect Path Planner
 * Bidirectional rapidly-exploring random tree for fast path planning
 *
 * Algorithm from: "RRT-Connect: An Efficient Approach to Single-Query Path Planning"
 * by Kuffner & LaValle (2000)
 */

import * as BABYLON from '@babylonjs/core';
import { IPathPlanner } from './IPathPlanner';
import { JointAngles, PathPlanResult, PathPlanningOptions } from './types';
import { ConfigurationSampler, JointLimits } from './ConfigurationSampler';
import { RRTTree } from './RRTTree';
import { KinematicsManager } from '../kinematics/KinematicsManager';

export class RRTConnectPlanner implements IPathPlanner {
  private kinematicsManager: KinematicsManager;
  private sampler: ConfigurationSampler;
  private robotChainId: string;
  private robotMeshes: BABYLON.Mesh[];

  constructor(
    kinematicsManager: KinematicsManager,
    robotChainId: string,
    robotMeshes: BABYLON.Mesh[],
    jointLimits: JointLimits[]
  ) {
    this.kinematicsManager = kinematicsManager;
    this.robotChainId = robotChainId;
    this.robotMeshes = robotMeshes;
    this.sampler = new ConfigurationSampler(jointLimits);
  }

  /**
   * Plan collision-free path using RRT-Connect
   */
  async plan(
    startConfig: JointAngles,
    goalConfig: JointAngles,
    obstacles: BABYLON.Mesh[],
    options?: PathPlanningOptions
  ): Promise<PathPlanResult> {
    const startTime = performance.now();

    // Default options
    const maxIterations = options?.maxIterations ?? 2000;
    const stepSize = options?.stepSize ?? 0.5; // Joint space step size (radians)
    const goalBias = options?.goalBias ?? 0.15;

    // Validate start and goal
    if (this.checkCollision(startConfig, obstacles)) {
      return {
        success: false,
        path: [],
        iterations: 0,
        planningTime: performance.now() - startTime,
        pathLength: 0
      };
    }

    if (this.checkCollision(goalConfig, obstacles)) {
      return {
        success: false,
        path: [],
        iterations: 0,
        planningTime: performance.now() - startTime,
        pathLength: 0
      };
    }

    // Initialize trees
    let treeA = new RRTTree(startConfig, this.sampler);
    let treeB = new RRTTree(goalConfig, this.sampler);

    // Main RRT-Connect loop
    for (let i = 0; i < maxIterations; i++) {
      // Sample random configuration
      const qRand = this.sampler.sampleWithGoalBias(goalConfig, goalBias);

      // Extend tree A toward sample
      const nearestA = treeA.findNearest(qRand);
      const qNew = this.sampler.extend(nearestA.config, qRand, stepSize);

      // Check if extension is valid
      if (!this.sampler.isValid(qNew)) {
        continue;
      }

      // Check if path to new config is collision-free
      if (!this.checkPathCollisionFree(nearestA.config, qNew, obstacles)) {
        continue;
      }

      // Add new node to tree A
      const newNode = treeA.addNode(qNew, nearestA);

      // Try to connect tree B to new node
      const connectResult = this.tryConnect(treeB, qNew, stepSize, obstacles);

      if (connectResult.success) {
        // Path found! Extract path from both trees
        const pathA = treeA.extractPath(newNode);
        const pathB = treeB.extractPath(connectResult.node!).reverse();

        // Combine paths
        const fullPath = [...pathA, ...pathB];

        // Calculate path length
        const pathLength = this.calculatePathLength(fullPath);

        return {
          success: true,
          path: fullPath,
          iterations: i + 1,
          planningTime: performance.now() - startTime,
          pathLength
        };
      }

      // Swap trees (bidirectional search)
      [treeA, treeB] = [treeB, treeA];
    }

    // Failed to find path
    return {
      success: false,
      path: [],
      iterations: maxIterations,
      planningTime: performance.now() - startTime,
      pathLength: 0
    };
  }

  /**
   * Try to connect a tree to a target configuration
   */
  private tryConnect(
    tree: RRTTree,
    target: JointAngles,
    stepSize: number,
    obstacles: BABYLON.Mesh[]
  ): { success: boolean; node?: any } {
    let current = tree.findNearest(target);

    // Keep extending until we reach target or hit obstacle
    while (true) {
      const dist = this.sampler.distance(current.config, target);

      if (dist < stepSize) {
        // Check final segment
        if (this.checkPathCollisionFree(current.config, target, obstacles)) {
          const finalNode = tree.addNode(target, current);
          return { success: true, node: finalNode };
        } else {
          return { success: false };
        }
      }

      // Extend toward target
      const qNew = this.sampler.extend(current.config, target, stepSize);

      // Check validity
      if (!this.sampler.isValid(qNew)) {
        return { success: false };
      }

      // Check collision
      if (!this.checkPathCollisionFree(current.config, qNew, obstacles)) {
        return { success: false };
      }

      // Add new node and continue
      current = tree.addNode(qNew, current);
    }
  }

  /**
   * Check if a configuration causes collision
   */
  checkCollision(config: JointAngles, obstacles: BABYLON.Mesh[]): boolean {
    // Update robot to this configuration
    this.updateRobotConfiguration(config);

    // Check all robot meshes against obstacles
    for (const robotMesh of this.robotMeshes) {
      for (const obstacle of obstacles) {
        if (robotMesh.intersectsMesh(obstacle, true)) {
          return true; // Collision detected
        }
      }
    }

    return false; // Collision-free
  }

  /**
   * Check if path segment between two configurations is collision-free
   */
  checkPathCollisionFree(
    startConfig: JointAngles,
    endConfig: JointAngles,
    obstacles: BABYLON.Mesh[]
  ): boolean {
    const steps = 10; // Number of intermediate checks

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const config = this.sampler.interpolate(startConfig, endConfig, t);

      if (this.checkCollision(config, obstacles)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update robot to a joint configuration using FK
   *
   * IMPLEMENTATION NOTE: This method requires KinematicsManager enhancements:
   * 1. Add getAllJoints() helper method to KinematicChain interface
   * 2. Add updateJointAngles() method to KinematicsManager
   *
   * Current workaround uses chain.joints directly.
   */
  private updateRobotConfiguration(config: JointAngles): void {
    const chain = this.kinematicsManager.getChain(this.robotChainId);
    if (!chain) return;

    // Build joint angle map from configuration array
    const jointMap = new Map<string, number>();
    chain.joints.forEach((joint, i) => {
      if (i < config.length) {
        jointMap.set(joint.id, config[i]);
      }
    });

    // TODO: Implement KinematicsManager.updateJointAngles() to apply these angles
    // this.kinematicsManager.updateJointAngles(this.robotChainId, jointMap);
    console.warn('[RRTConnectPlanner] updateRobotConfiguration() awaiting KinematicsManager API', {
      robotChain: this.robotChainId,
      jointCount: jointMap.size
    });
  }

  /**
   * Calculate total path length in joint space
   */
  private calculatePathLength(path: JointAngles[]): number {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      length += this.sampler.distance(path[i - 1], path[i]);
    }
    return length;
  }
}
