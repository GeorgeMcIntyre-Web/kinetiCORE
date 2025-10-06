// Inverse Kinematics Solver
// Owner: George
// Computes joint angles to reach desired end-effector pose

import * as BABYLON from '@babylonjs/core';
import { KinematicsManager } from './KinematicsManager';
import type { JointConfig } from './KinematicsManager';
import { ForwardKinematicsSolver } from './ForwardKinematicsSolver';

export interface IKSolution {
  jointAngles: number[];
  success: boolean;
  error: number;
  iterations: number;
}

export interface IKTarget {
  position: BABYLON.Vector3;
  rotation?: BABYLON.Quaternion;
}

/**
 * Inverse Kinematics Solver
 * Multiple algorithms: Jacobian transpose, CCD, FABRIK
 */
export class InverseKinematicsSolver {
  private static instance: InverseKinematicsSolver | null = null;
  private kinematicsManager: KinematicsManager;
  private fkSolver: ForwardKinematicsSolver;

  private constructor() {
    this.kinematicsManager = KinematicsManager.getInstance();
    this.fkSolver = ForwardKinematicsSolver.getInstance();
  }

  static getInstance(): InverseKinematicsSolver {
    if (!InverseKinematicsSolver.instance) {
      InverseKinematicsSolver.instance = new InverseKinematicsSolver();
    }
    return InverseKinematicsSolver.instance;
  }

  /**
   * Solve IK using Jacobian transpose method
   * Simple but effective for many cases
   */
  solveJacobianTranspose(
    chainName: string,
    target: IKTarget,
    initialAngles?: number[],
    options: {
      maxIterations?: number;
      tolerance?: number;
      stepSize?: number;
      positionWeight?: number;
      orientationWeight?: number;
      damping?: number;
    } = {}
  ): IKSolution {
    const {
      maxIterations = 300,
      tolerance = 0.001, // 1mm tolerance - tighter than jog step
      stepSize = 0.5,
      positionWeight = 1.0,
      orientationWeight = 0.5,
      damping = 0.01,
    } = options;

    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      return { jointAngles: [], success: false, error: Infinity, iterations: 0 };
    }

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    // eslint-disable-next-line prefer-const -- array elements are mutated in loop (line 149)
    let jointAngles = initialAngles || joints.map((j: JointConfig) => j.position);

    let iteration = 0;
    let error = Infinity;

    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Compute current end-effector pose
      const currentPose = this.fkSolver.solve(chainName, jointAngles);
      if (!currentPose) {
        console.error('[IK Jacobian] FK solve failed at iteration', iteration);
        break;
      }

      // Compute position error
      const positionError = target.position.subtract(currentPose.position);
      const positionErrorMagnitude = positionError.length();

      // Compute orientation error (if target rotation specified)
      let orientationError = new BABYLON.Vector3(0, 0, 0);
      if (target.rotation) {
        const rotationError = target.rotation.multiply(
          BABYLON.Quaternion.Inverse(currentPose.rotation)
        );
        // Convert quaternion error to axis-angle
        const angle = 2 * Math.acos(Math.min(1, Math.abs(rotationError.w)));
        const axis = new BABYLON.Vector3(
          rotationError.x,
          rotationError.y,
          rotationError.z
        );
        const axisLength = axis.length();
        if (axisLength > 0.0001) {
          orientationError = axis.scale(angle / axisLength);
        }
      }

      // Total error
      error = positionErrorMagnitude * positionWeight +
              orientationError.length() * orientationWeight;

      if (error < tolerance) {
        // Clamp joint angles to limits
        for (let i = 0; i < jointAngles.length; i++) {
          jointAngles[i] = Math.max(
            joints[i].limits.lower,
            Math.min(joints[i].limits.upper, jointAngles[i])
          );
        }
        return { jointAngles, success: true, error, iterations: iteration + 1 };
      }

      // Compute Jacobian
      const jacobian = this.fkSolver.computeJacobian(chainName, jointAngles);
      if (!jacobian) break;

      // Compute error vector (6D: 3 position + 3 orientation)
      const errorVector = [
        positionError.x * positionWeight,
        positionError.y * positionWeight,
        positionError.z * positionWeight,
        orientationError.x * orientationWeight,
        orientationError.y * orientationWeight,
        orientationError.z * orientationWeight,
      ];

      // Compute joint angle deltas using damped Jacobian transpose
      // Δθ = α * J^T * (J*J^T + λ²I)^-1 * e (simplified: α * J^T * e with damping)
      const deltaAngles: number[] = Array(jointAngles.length).fill(0);

      for (let i = 0; i < jointAngles.length; i++) {
        let delta = 0;
        for (let j = 0; j < 6; j++) {
          delta += jacobian[j][i] * errorVector[j];
        }
        // Apply damping to prevent overshoot
        const dampingFactor = 1.0 / (1.0 + damping * Math.abs(delta));
        deltaAngles[i] = stepSize * delta * dampingFactor;
      }

      // Adaptive step size based on error magnitude
      const adaptiveStep = Math.min(1.0, error / 0.1) * stepSize;

      // Update joint angles
      for (let i = 0; i < jointAngles.length; i++) {
        jointAngles[i] += adaptiveStep * deltaAngles[i];
      }
    }

    // Clamp final joint angles to limits
    for (let i = 0; i < jointAngles.length; i++) {
      jointAngles[i] = Math.max(
        joints[i].limits.lower,
        Math.min(joints[i].limits.upper, jointAngles[i])
      );
    }

    return {
      jointAngles,
      success: error < tolerance * 10, // Allow 10x tolerance for partial success
      error,
      iterations: iteration,
    };
  }

  /**
   * Solve IK using Cyclic Coordinate Descent (CCD)
   * Fast and intuitive, works well for many robots
   */
  solveCCD(
    chainName: string,
    target: IKTarget,
    initialAngles?: number[],
    options: {
      maxIterations?: number;
      tolerance?: number;
      damping?: number;
    } = {}
  ): IKSolution {
    const {
      maxIterations = 300,
      tolerance = 0.001, // 1mm tolerance - tighter than jog step
      damping = 0.5,
    } = options;

    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      return { jointAngles: [], success: false, error: Infinity, iterations: 0 };
    }

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    // eslint-disable-next-line prefer-const -- array elements are mutated in loop (line 268)
    let jointAngles = initialAngles || joints.map((j: JointConfig) => j.position);

    let iteration = 0;
    let error = Infinity;

    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Check current error
      const currentPose = this.fkSolver.solve(chainName, jointAngles);
      if (!currentPose) break;

      const positionError = target.position.subtract(currentPose.position);
      error = positionError.length();

      if (error < tolerance) {
        return { jointAngles, success: true, error, iterations: iteration + 1 };
      }

      // Iterate through joints from end-effector to base
      for (let i = joints.length - 1; i >= 0; i--) {
        const joint = joints[i];

        // Only process revolute joints
        if (joint.type !== 'revolute') {
          continue;
        }

        // Get current end-effector position
        const endEffectorPose = this.fkSolver.solve(chainName, jointAngles);
        if (!endEffectorPose) continue;

        // Get joint position (solve FK up to this joint using full joint angles)
        const jointPose = this.fkSolver.solveUpToJoint(chainName, jointAngles, i);
        if (!jointPose) continue;

        const jointPosition = jointPose.position;
        const endEffectorPosition = endEffectorPose.position;

        // Vectors from joint to end-effector and target
        const toEndEffector = endEffectorPosition.subtract(jointPosition);
        const toTarget = target.position.subtract(jointPosition);

        // Normalize vectors
        const toEndEffectorNorm = toEndEffector.normalize();
        const toTargetNorm = toTarget.normalize();

        // Get joint axis in world frame
        const localAxis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();

        // Transform axis to world frame (approximate using current rotation)
        let worldAxis = localAxis.clone();
        if (jointPose.rotation) {
          worldAxis = BABYLON.Vector3.TransformNormal(
            localAxis,
            BABYLON.Matrix.FromQuaternionToRef(
              jointPose.rotation,
              new BABYLON.Matrix()
            )
          );
        }

        // Compute rotation angle
        const dot = BABYLON.Vector3.Dot(toEndEffectorNorm, toTargetNorm);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

        // Determine rotation direction using cross product
        const cross = BABYLON.Vector3.Cross(toEndEffectorNorm, toTargetNorm);
        const direction = BABYLON.Vector3.Dot(cross, worldAxis);

        // Update joint angle with damping to prevent oscillation
        const deltaAngle = angle * Math.sign(direction) * damping;
        jointAngles[i] += deltaAngle;

        // Clamp to joint limits
        jointAngles[i] = Math.max(
          joint.limits.lower,
          Math.min(joint.limits.upper, jointAngles[i])
        );
      }
    }

    return {
      jointAngles,
      success: error < tolerance * 10,
      error,
      iterations: iteration,
    };
  }

  /**
   * Solve IK and apply to robot joints
   * Uses Jacobian transpose by default
   */
  solveAndApply(
    chainName: string,
    target: IKTarget,
    method: 'jacobian' | 'ccd' = 'jacobian'
  ): boolean {
    const solution = method === 'jacobian'
      ? this.solveJacobianTranspose(chainName, target)
      : this.solveCCD(chainName, target);

    if (!solution.success) {
      console.warn(
        `IK failed: error=${solution.error.toFixed(4)}, ` +
        `iterations=${solution.iterations}`
      );
      return false;
    }

    // Apply joint angles to robot
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return false;

    const joints = this.kinematicsManager.getChainJoints(chain.id);

    for (let i = 0; i < joints.length; i++) {
      this.fkSolver.updateJointPosition(joints[i].id, solution.jointAngles[i]);
    }

    console.log(
      `IK solved: error=${solution.error.toFixed(4)}, ` +
      `iterations=${solution.iterations}`
    );

    return true;
  }

  /**
   * Move end-effector by delta (incremental motion)
   * Useful for jogging in Cartesian space
   */
  moveEndEffector(
    chainName: string,
    positionDelta: BABYLON.Vector3,
    method: 'jacobian' | 'ccd' = 'jacobian'
  ): boolean {
    // Get current end-effector pose
    const currentPose = this.fkSolver.getEndEffectorPose(chainName);
    if (!currentPose) {
      console.error('[IK] Failed to get current end-effector pose');
      return false;
    }

    // Compute new target position
    const targetPosition = currentPose.position.add(positionDelta);

    // Solve IK for new position
    return this.solveAndApply(
      chainName,
      {
        position: targetPosition,
        rotation: currentPose.rotation, // Maintain current orientation
      },
      method
    );
  }
}
