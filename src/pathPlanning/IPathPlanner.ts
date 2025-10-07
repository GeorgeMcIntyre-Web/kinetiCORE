/**
 * Path Planner Interface
 * Abstraction for different path planning algorithms (RRT, PRM, etc.)
 */

import { JointAngles, PathPlanResult, PathPlanningOptions } from './types';
import * as BABYLON from '@babylonjs/core';

export interface IPathPlanner {
  /**
   * Plan collision-free path between start and goal configurations
   * @param startConfig - Starting joint configuration
   * @param goalConfig - Target joint configuration
   * @param obstacles - Scene meshes to avoid
   * @param options - Planning options
   * @returns Path planning result with joint configurations
   */
  plan(
    startConfig: JointAngles,
    goalConfig: JointAngles,
    obstacles: BABYLON.Mesh[],
    options?: PathPlanningOptions
  ): Promise<PathPlanResult>;

  /**
   * Check if a configuration is collision-free
   * @param config - Joint configuration to check
   * @param obstacles - Scene meshes to check against
   * @returns True if collision-free
   */
  checkCollision(
    config: JointAngles,
    obstacles: BABYLON.Mesh[]
  ): boolean;

  /**
   * Check if a path segment between two configurations is collision-free
   * @param startConfig - Start configuration
   * @param endConfig - End configuration
   * @param obstacles - Scene meshes to check against
   * @returns True if entire segment is collision-free
   */
  checkPathCollisionFree(
    startConfig: JointAngles,
    endConfig: JointAngles,
    obstacles: BABYLON.Mesh[]
  ): boolean;
}
