/**
 * Whole-Body Inverse Kinematics Solver
 * Owner: George
 * Solves IK for multiple kinematic chains simultaneously with constraints
 */

import * as BABYLON from '@babylonjs/core';
import { InverseKinematicsSolver, IKTarget } from './InverseKinematicsSolver';
import { ForwardKinematicsSolver } from './ForwardKinematicsSolver';
import { KinematicsManager } from './KinematicsManager';
import type {
  IKConstraint,
} from './constraints/IKConstraint';
import {
  BalanceConstraint,
  CollisionAvoidanceConstraint,
} from './constraints/IKConstraint';

/**
 * Configuration for multi-target IK solving
 */
export interface WholeBodyIKConfig {
  // Target poses for each kinematic chain
  targets: Map<string, IKTarget>; // chainName → target

  // Priority weights for each chain (higher = more important)
  // Default priority is 1.0 for all chains
  priorities?: Map<string, number>;

  // Constraints to enforce
  constraints?: IKConstraint[];

  // Solver options
  maxIterations?: number; // Default: 100
  tolerance?: number; // Default: 0.001 (1mm)
  stepSize?: number; // Default: 0.1
  constraintTolerance?: number; // Default: 0.01
}

/**
 * Result of whole-body IK solving
 */
export interface WholeBodyIKSolution {
  // Joint angles for all chains
  jointAngles: Map<string, number[]>; // chainName → joint angles

  // Success status
  success: boolean;

  // Final error for each target
  errors: Map<string, number>; // chainName → error

  // Constraint violations
  constraintViolations: Map<string, number>; // constraintType → violation

  // Number of iterations performed
  iterations: number;

  // Total error (weighted sum of target errors + constraint violations)
  totalError: number;
}

/**
 * Whole-Body IK Solver
 * Solves inverse kinematics for multiple chains simultaneously
 * with support for constraints (balance, collision avoidance, etc.)
 */
export class WholeBodyIKSolver {
  private static instance: WholeBodyIKSolver | null = null;
  private ikSolver: InverseKinematicsSolver;
  private fkSolver: ForwardKinematicsSolver;
  private kinematicsManager: KinematicsManager;

  private constructor() {
    this.ikSolver = InverseKinematicsSolver.getInstance();
    this.fkSolver = ForwardKinematicsSolver.getInstance();
    this.kinematicsManager = KinematicsManager.getInstance();
  }

  static getInstance(): WholeBodyIKSolver {
    if (!WholeBodyIKSolver.instance) {
      WholeBodyIKSolver.instance = new WholeBodyIKSolver();
    }
    return WholeBodyIKSolver.instance;
  }

  /**
   * Solve whole-body IK with multiple targets and constraints
   * Uses iterative gradient-based optimization
   */
  solve(config: WholeBodyIKConfig): WholeBodyIKSolution {
    const {
      targets,
      priorities = new Map(),
      constraints = [],
      maxIterations = 100,
      tolerance = 0.001,
      stepSize = 0.1,
      constraintTolerance = 0.01,
    } = config;

    // Initialize joint angles for all chains
    const jointAngles = new Map<string, number[]>();
    targets.forEach((_, chainName) => {
      const chain = this.kinematicsManager.getChain(chainName);
      if (chain) {
        const joints = this.kinematicsManager.getChainJoints(chain.id);
        jointAngles.set(
          chainName,
          joints.map((j) => j.position)
        );
      }
    });

    let iteration = 0;
    let totalError = Infinity;
    const errors = new Map<string, number>();
    const constraintViolations = new Map<string, number>();

    // Main optimization loop
    for (iteration = 0; iteration < maxIterations; iteration++) {
      totalError = 0;

      // Step 1: Solve individual chain IK with priorities
      targets.forEach((target, chainName) => {
        const priority = priorities.get(chainName) || 1.0;
        const currentAngles = jointAngles.get(chainName);
        if (!currentAngles) return;

        // Solve IK for this chain
        const solution = this.ikSolver.solveJacobianTranspose(
          chainName,
          target,
          currentAngles,
          {
            maxIterations: 10, // Inner iterations
            tolerance: tolerance * priority, // Stricter tolerance for high priority
            stepSize: stepSize * priority,
          }
        );

        // Update joint angles
        jointAngles.set(chainName, solution.jointAngles);
        errors.set(chainName, solution.error);
        totalError += solution.error * priority;
      });

      // Step 2: Apply constraints
      let constraintError = 0;
      constraints.forEach((constraint) => {
        if (!constraint.enabled) return;

        const violation = constraint.evaluate(jointAngles);
        constraintViolations.set(constraint.type, violation);
        constraintError += violation * constraint.weight;

        // Apply constraint gradient
        if (violation > constraintTolerance) {
          const gradient = constraint.computeGradient(jointAngles);
          this.applyConstraintGradient(jointAngles, gradient, stepSize);
        }
      });

      totalError += constraintError;

      // Check convergence
      if (totalError < tolerance) {
        break;
      }
    }

    // Apply final joint angles to robot
    this.applyJointAngles(jointAngles);

    return {
      jointAngles,
      success: totalError < tolerance,
      errors,
      constraintViolations,
      iterations: iteration + 1,
      totalError,
    };
  }

  /**
   * Solve for humanoid walking pose
   * Specialized method for bipedal locomotion
   */
  solveHumanoidWalking(config: {
    leftFootTarget: BABYLON.Vector3;
    rightFootTarget: BABYLON.Vector3;
    pelvisTarget?: BABYLON.Vector3;
    leftHandTarget?: BABYLON.Vector3;
    rightHandTarget?: BABYLON.Vector3;
    headLookAt?: BABYLON.Vector3;
    supportPolygon?: BABYLON.Vector3[]; // For balance
  }): WholeBodyIKSolution {
    const targets = new Map<string, IKTarget>();
    const priorities = new Map<string, number>();
    const constraints: IKConstraint[] = [];

    // Feet targets (highest priority for walking)
    targets.set('left_leg', { position: config.leftFootTarget });
    targets.set('right_leg', { position: config.rightFootTarget });
    priorities.set('left_leg', 1.0);
    priorities.set('right_leg', 1.0);

    // Pelvis target (high priority for balance)
    if (config.pelvisTarget) {
      targets.set('torso', { position: config.pelvisTarget });
      priorities.set('torso', 0.9);
    }

    // Hand targets (medium priority)
    if (config.leftHandTarget) {
      targets.set('left_arm', { position: config.leftHandTarget });
      priorities.set('left_arm', 0.6);
    }
    if (config.rightHandTarget) {
      targets.set('right_arm', { position: config.rightHandTarget });
      priorities.set('right_arm', 0.6);
    }

    // Head look-at (low priority)
    if (config.headLookAt) {
      // Would use LookAtConstraint here
      // constraints.push(new LookAtConstraint('head', config.headLookAt));
    }

    // Balance constraint (critical for walking)
    if (config.supportPolygon && config.supportPolygon.length >= 2) {
      const comTarget = this.computeCenterOfMass(targets);
      const balanceConstraint = new BalanceConstraint(
        comTarget,
        config.supportPolygon,
        0.05 // 5cm ZMP tolerance
      );
      constraints.push(balanceConstraint);
    }

    // Collision avoidance (self-collision between limbs)
    const collisionConstraint = new CollisionAvoidanceConstraint(0.01, true, false);
    constraints.push(collisionConstraint);

    return this.solve({
      targets,
      priorities,
      constraints,
      maxIterations: 100,
      tolerance: 0.001,
    });
  }

  /**
   * Solve for quadruped locomotion
   * Specialized method for quadruped robots (e.g., Spot, Unitree Go1)
   */
  solveQuadrupedGait(config: {
    frontLeftTarget: BABYLON.Vector3;
    frontRightTarget: BABYLON.Vector3;
    rearLeftTarget: BABYLON.Vector3;
    rearRightTarget: BABYLON.Vector3;
    bodyTarget?: BABYLON.Vector3;
    bodyOrientation?: BABYLON.Quaternion;
    supportPhase?: 'all' | 'diagonal' | 'trot'; // Gait type
  }): WholeBodyIKSolution {
    const targets = new Map<string, IKTarget>();
    const priorities = new Map<string, number>();
    const constraints: IKConstraint[] = [];

    // Leg targets (all equal priority)
    targets.set('front_left_leg', { position: config.frontLeftTarget });
    targets.set('front_right_leg', { position: config.frontRightTarget });
    targets.set('rear_left_leg', { position: config.rearLeftTarget });
    targets.set('rear_right_leg', { position: config.rearRightTarget });

    // Adjust priorities based on gait phase
    if (config.supportPhase === 'diagonal') {
      // Diagonal gait: FL + RR have priority
      priorities.set('front_left_leg', 1.0);
      priorities.set('rear_right_leg', 1.0);
      priorities.set('front_right_leg', 0.7);
      priorities.set('rear_left_leg', 0.7);
    } else if (config.supportPhase === 'trot') {
      // Trot: Alternating diagonal pairs
      priorities.set('front_left_leg', 1.0);
      priorities.set('rear_right_leg', 1.0);
      priorities.set('front_right_leg', 0.5);
      priorities.set('rear_left_leg', 0.5);
    } else {
      // All legs equal priority
      priorities.set('front_left_leg', 1.0);
      priorities.set('front_right_leg', 1.0);
      priorities.set('rear_left_leg', 1.0);
      priorities.set('rear_right_leg', 1.0);
    }

    // Body target (medium priority)
    if (config.bodyTarget) {
      targets.set('body', {
        position: config.bodyTarget,
        rotation: config.bodyOrientation,
      });
      priorities.set('body', 0.8);
    }

    // Balance constraint (quadruped support polygon)
    const supportPolygon = [
      config.frontLeftTarget,
      config.frontRightTarget,
      config.rearRightTarget,
      config.rearLeftTarget,
    ];
    const comTarget = this.computeCenterOfMass(targets);
    const balanceConstraint = new BalanceConstraint(comTarget, supportPolygon, 0.03);
    constraints.push(balanceConstraint);

    return this.solve({
      targets,
      priorities,
      constraints,
      maxIterations: 100,
      tolerance: 0.001,
    });
  }

  /**
   * Solve for dual-arm manipulation
   * Both arms work together to manipulate an object
   */
  solveDualArmManipulation(config: {
    leftHandTarget: BABYLON.Vector3;
    rightHandTarget: BABYLON.Vector3;
    leftHandOrientation?: BABYLON.Quaternion;
    rightHandOrientation?: BABYLON.Quaternion;
    objectWidth?: number; // Distance constraint between hands
    avoidSelfCollision?: boolean;
  }): WholeBodyIKSolution {
    const targets = new Map<string, IKTarget>();
    const priorities = new Map<string, number>();
    const constraints: IKConstraint[] = [];

    // Hand targets (equal priority)
    targets.set('left_arm', {
      position: config.leftHandTarget,
      rotation: config.leftHandOrientation,
    });
    targets.set('right_arm', {
      position: config.rightHandTarget,
      rotation: config.rightHandOrientation,
    });
    priorities.set('left_arm', 1.0);
    priorities.set('right_arm', 1.0);

    // Self-collision avoidance (arms shouldn't collide)
    if (config.avoidSelfCollision !== false) {
      const collisionConstraint = new CollisionAvoidanceConstraint(0.02, true, false);
      constraints.push(collisionConstraint);
    }

    return this.solve({
      targets,
      priorities,
      constraints,
      maxIterations: 100,
      tolerance: 0.001,
    });
  }

  /**
   * Apply constraint gradient to joint angles
   */
  private applyConstraintGradient(
    jointAngles: Map<string, number[]>,
    gradient: Map<string, number[]>,
    stepSize: number
  ): void {
    gradient.forEach((adjustments, chainName) => {
      const currentAngles = jointAngles.get(chainName);
      if (!currentAngles) return;

      const newAngles = currentAngles.map((angle, i) => {
        return angle + adjustments[i] * stepSize;
      });

      jointAngles.set(chainName, newAngles);
    });
  }

  /**
   * Apply joint angles to the robot
   */
  private applyJointAngles(jointAngles: Map<string, number[]>): void {
    jointAngles.forEach((angles, chainName) => {
      const chain = this.kinematicsManager.getChain(chainName);
      if (!chain) return;

      const joints = this.kinematicsManager.getChainJoints(chain.id);
      angles.forEach((angle, i) => {
        if (i < joints.length) {
          this.fkSolver.updateJointPosition(joints[i].id, angle);
        }
      });
    });
  }

  /**
   * Compute approximate center of mass from target positions
   * Simplified calculation assuming equal mass distribution
   */
  private computeCenterOfMass(targets: Map<string, IKTarget>): BABYLON.Vector3 {
    const sum = BABYLON.Vector3.Zero();
    let count = 0;

    targets.forEach((target) => {
      sum.addInPlace(target.position);
      count++;
    });

    if (count === 0) {
      return BABYLON.Vector3.Zero();
    }

    return sum.scale(1 / count);
  }

  /**
   * Get current joint angles for a chain
   */
  getCurrentJointAngles(chainName: string): number[] | null {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return null;

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    return joints.map((j) => j.position);
  }

  /**
   * Get current null TCP pose for a chain (last joint transformation)
   */
  getCurrentNullTCPPose(chainName: string): {
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } | null {
    return this.fkSolver.getEndEffectorPose(chainName);
  }
}
