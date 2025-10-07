/**
 * Path Planning Types for kinetiCORE
 * Defines interfaces for robot path planning, via point generation, and trajectory optimization
 */

import * as BABYLON from '@babylonjs/core';

/**
 * Joint configuration (array of joint angles in radians)
 */
export type JointAngles = number[];

/**
 * Robot pose in 3D space (position + orientation)
 */
export interface RobotPose {
  position: BABYLON.Vector3;
  rotation: BABYLON.Quaternion;
}

/**
 * Weld spot definition with surface normal
 */
export interface WeldSpot {
  id: string;
  position: BABYLON.Vector3;
  normal: BABYLON.Vector3; // Surface normal for perpendicular approach
  metadata?: Record<string, any>;
}

/**
 * Path planning options
 */
export interface PathPlanningOptions {
  maxIterations?: number;      // Max RRT iterations (default: 2000)
  stepSize?: number;            // RRT step size in meters (default: 0.05)
  goalBias?: number;            // Probability of sampling goal (default: 0.15)
  collisionCheckResolution?: number; // Collision check step size (default: 0.01)
}

/**
 * Via point generation options
 */
export interface ViaPointOptions {
  maxViaPoints?: number;        // Maximum via points per transition (default: 3)
  approachDistance?: number;    // Distance for linear approach (default: 0.1m)
  retractDistance?: number;     // Distance for perpendicular retract (default: 0.05m)
  safeHeight?: number;          // Safe height above workspace (default: 0.5m)
  clearanceOffset?: number;     // Offset for midpoint strategy (default: 0.15m)
}

/**
 * Spot welding planner configuration
 */
export interface SpotWeldingConfig {
  robotId: string;
  algorithm?: 'rrt-connect' | 'midpoint' | 'lift-and-move';
  approachDistance?: number;    // Approach distance in meters (default: 0.1)
  retractDistance?: number;     // Retract distance in meters (default: 0.05)
  maxViaPoints?: number;        // Max via points per transition (default: 3)
  optimizeSequence?: boolean;   // Run TSP optimization (default: true)
  optimizeTrajectory?: boolean; // Use quintic splines (default: true)
}

/**
 * Trajectory segment (smooth motion between two poses)
 */
export interface TrajectorySegment {
  startTime: number;            // Start time in seconds
  duration: number;             // Duration in seconds
  jointTrajectories: Array<(t: number) => {
    pos: number;
    vel: number;
    acc: number;
  }>;
}

/**
 * Complete robot trajectory
 */
export interface RobotTrajectory {
  segments: TrajectorySegment[];
  totalDuration: number;
  viaPoints: RobotPose[];
}

/**
 * Welding program result
 */
export interface WeldingProgram {
  robotId: string;
  spots: WeldSpot[];
  trajectory: RobotTrajectory;
  cycleTime: number;
  pathLength: number;
  viaPointCount: number;
}

/**
 * Multi-robot program result
 */
export interface MultiRobotProgram {
  robots: Array<{
    robotId: string;
    program: WeldingProgram;
  }>;
  totalCycleTime: number;       // Makespan (max of all robot cycle times)
  collisionsFree: boolean;
}

/**
 * Collision check result
 */
export interface CollisionInfo {
  hasCollision: boolean;
  time?: number;                // Time of collision (if applicable)
  objects?: string[];           // Colliding object IDs
}

/**
 * RRT tree node
 */
export interface RRTNode {
  config: JointAngles;
  parent: RRTNode | null;
  cost: number;
}

/**
 * Path planning result
 */
export interface PathPlanResult {
  success: boolean;
  path: JointAngles[];
  iterations: number;
  planningTime: number;         // Time in milliseconds
  pathLength: number;           // Path length in joint space
}
