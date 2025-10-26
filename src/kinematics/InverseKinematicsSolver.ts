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

export interface FABRIKOptions {
  maxIterations?: number;
  tolerance?: number;
  maintainOrientation?: boolean;
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
        // Compute quaternion error: q_error = q_target * q_current^-1
        const rotationError = target.rotation.multiply(
          BABYLON.Quaternion.Inverse(currentPose.rotation)
        );

        // Ensure shortest path (quaternion double-cover issue)
        // If w < 0, negate to get shortest rotation
        const normalizedError = rotationError.w < 0
          ? new BABYLON.Quaternion(
              -rotationError.x,
              -rotationError.y,
              -rotationError.z,
              -rotationError.w
            )
          : rotationError;

        // Convert quaternion error to axis-angle representation
        // angle = 2 * acos(w), axis = (x, y, z) / sin(angle/2)
        const angle = 2 * Math.acos(Math.min(1, Math.abs(normalizedError.w)));
        const axis = new BABYLON.Vector3(
          normalizedError.x,
          normalizedError.y,
          normalizedError.z
        );
        const axisLength = axis.length();

        // Convert to angular velocity error (axis-angle vector)
        if (axisLength > 0.0001 && angle > 0.0001) {
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

        // Only process revolute and spherical joints
        // Note: Spherical joints are currently treated as single-axis revolute
        // TODO: Full 3-DOF spherical joint support requires multi-value joint positions
        if (joint.type !== 'revolute' && joint.type !== 'spherical') {
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
   * Rotate end-effector by delta (incremental rotation)
   * Useful for rotary jogging in Cartesian space
   */
  rotateEndEffector(
    chainName: string,
    rotationDelta: BABYLON.Quaternion,
    method: 'jacobian' | 'fabrik' = 'jacobian'
  ): boolean {
    // Get current end-effector pose
    const currentPose = this.fkSolver.getEndEffectorPose(chainName);
    if (!currentPose) {
      console.error('[IK] Failed to get current end-effector pose');
      return false;
    }

    // Compute new target rotation (apply delta rotation)
    const targetRotation = rotationDelta.multiply(currentPose.rotation);

    // Solve IK for new rotation (maintain position)
    const solution = method === 'jacobian'
      ? this.solveJacobianTranspose(chainName, {
          position: currentPose.position,
          rotation: targetRotation,
        })
      : this.solveFABRIK(chainName, {
          position: currentPose.position,
          rotation: targetRotation,
        });

    if (!solution.success) {
      console.warn('[IK Rotate] Failed to solve for rotation delta');
      return false;
    }

    // Apply joint angles
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return false;
    const joints = this.kinematicsManager.getChainJoints(chain.id);

    for (let i = 0; i < joints.length; i++) {
      this.fkSolver.updateJointPosition(joints[i].id, solution.jointAngles[i]);
    }

    return true;
  }

  /**
   * Move end-effector by delta (incremental motion)
   * Useful for jogging in Cartesian space
   */
  moveEndEffector(
    chainName: string,
    positionDelta: BABYLON.Vector3,
    method: 'jacobian' | 'ccd' | 'fabrik' = 'jacobian'
  ): boolean {
    console.log(`[IK moveEndEffector] Chain: ${chainName}, Method: ${method}`);
    console.log(`[IK moveEndEffector] Delta:`, positionDelta);

    // Get current end-effector pose
    const currentPose = this.fkSolver.getEndEffectorPose(chainName);
    if (!currentPose) {
      console.error('[IK moveEndEffector] Failed to get current end-effector pose');
      console.error('[IK moveEndEffector] Available chains:', this.kinematicsManager.getAllChains().map(c => c.name));
      return false;
    }

    console.log(`[IK moveEndEffector] Current position:`, currentPose.position);

    // Compute new target position
    const targetPosition = currentPose.position.add(positionDelta);
    console.log(`[IK moveEndEffector] Target position:`, targetPosition);

    // Solve IK for new position
    if (method === 'fabrik') {
      console.log('[IK moveEndEffector] Using FABRIK method');
      const solution = this.solveFABRIK(chainName, { position: targetPosition });
      if (!solution.success) {
        console.error('[IK moveEndEffector] FABRIK failed:', solution);
        return false;
      }

      const chain = this.kinematicsManager.getChain(chainName);
      if (!chain) {
        console.error('[IK moveEndEffector] Chain not found:', chainName);
        return false;
      }
      const joints = this.kinematicsManager.getChainJoints(chain.id);
      for (let i = 0; i < joints.length; i++) {
        this.fkSolver.updateJointPosition(joints[i].id, solution.jointAngles[i]);
      }
      console.log('[IK moveEndEffector] ✅ FABRIK succeeded');
      return true;
    }

    console.log(`[IK moveEndEffector] Using ${method} method via solveAndApply`);
    const result = this.solveAndApply(
      chainName,
      {
        position: targetPosition,
        rotation: currentPose.rotation, // Maintain current orientation
      },
      method
    );

    if (result) {
      console.log('[IK moveEndEffector] ✅ Success');
    } else {
      console.error('[IK moveEndEffector] ❌ Failed');
    }

    return result;
  }

  /**
   * Solve IK using FABRIK (Forward And Backward Reaching Inverse Kinematics)
   * Excellent for humanoid limbs - fast, intuitive, natural motion
   * Best for serial chains (arms, legs)
   */
  solveFABRIK(
    chainName: string,
    target: IKTarget,
    options: FABRIKOptions = {}
  ): IKSolution {
    const {
      maxIterations = 100, // FABRIK converges faster than Jacobian/CCD
      tolerance = 0.001, // 1mm tolerance
    } = options;

    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      return { jointAngles: [], success: false, error: Infinity, iterations: 0 };
    }

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    const initialAngles = joints.map((j: JointConfig) => j.position);

    // Get link lengths (distance between consecutive joints)
    const linkLengths: number[] = [];
    const jointPositions: BABYLON.Vector3[] = [];

    // Compute initial joint positions in world space
    for (let i = 0; i < joints.length; i++) {
      const pose = this.fkSolver.solveUpToJoint(chainName, initialAngles, i);
      if (!pose) {
        console.error('[IK FABRIK] Failed to compute initial joint positions');
        return { jointAngles: [], success: false, error: Infinity, iterations: 0 };
      }
      jointPositions.push(pose.position.clone());
    }

    // Add end-effector position
    const endEffectorPose = this.fkSolver.solve(chainName, initialAngles);
    if (!endEffectorPose) {
      return { jointAngles: [], success: false, error: Infinity, iterations: 0 };
    }
    jointPositions.push(endEffectorPose.position.clone());

    // Calculate link lengths
    for (let i = 0; i < jointPositions.length - 1; i++) {
      const length = jointPositions[i + 1].subtract(jointPositions[i]).length();
      linkLengths.push(length);
    }

    // Store base position (should not move)
    const basePosition = jointPositions[0].clone();

    // Check if target is reachable
    const totalLength = linkLengths.reduce((sum, len) => sum + len, 0);
    const distanceToTarget = target.position.subtract(basePosition).length();

    if (distanceToTarget > totalLength * 0.99) {
      // Target unreachable - stretch toward it
      const direction = target.position.subtract(basePosition).normalize();
      for (let i = 1; i < jointPositions.length; i++) {
        jointPositions[i] = jointPositions[i - 1].add(
          direction.scale(linkLengths[i - 1])
        );
      }

      // Convert positions to angles
      const resultAngles = this.convertPositionsToAngles(
        chainName,
        jointPositions.slice(0, -1),
        joints,
        initialAngles
      );

      return {
        jointAngles: resultAngles,
        success: false,
        error: distanceToTarget - totalLength,
        iterations: 0,
      };
    }

    let iteration = 0;
    let error = Infinity;

    // FABRIK iteration
    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Check convergence
      error = jointPositions[jointPositions.length - 1]
        .subtract(target.position)
        .length();

      if (error < tolerance) {
        break;
      }

      // BACKWARD PASS: From end-effector to base
      jointPositions[jointPositions.length - 1] = target.position.clone();

      for (let i = jointPositions.length - 2; i >= 0; i--) {
        const direction = jointPositions[i]
          .subtract(jointPositions[i + 1])
          .normalize();
        jointPositions[i] = jointPositions[i + 1].add(
          direction.scale(linkLengths[i])
        );
      }

      // FORWARD PASS: From base to end-effector
      jointPositions[0] = basePosition.clone(); // Restore base position

      for (let i = 0; i < jointPositions.length - 1; i++) {
        const direction = jointPositions[i + 1]
          .subtract(jointPositions[i])
          .normalize();
        jointPositions[i + 1] = jointPositions[i].add(
          direction.scale(linkLengths[i])
        );
      }
    }

    // Apply joint limits by converting positions to angles
    const resultAngles = this.convertPositionsToAngles(
      chainName,
      jointPositions.slice(0, -1), // Exclude end-effector position
      joints,
      initialAngles
    );

    // Clamp to joint limits
    for (let i = 0; i < resultAngles.length; i++) {
      resultAngles[i] = Math.max(
        joints[i].limits.lower,
        Math.min(joints[i].limits.upper, resultAngles[i])
      );
    }

    return {
      jointAngles: resultAngles,
      success: error < tolerance,
      error,
      iterations: iteration + 1,
    };
  }

  /**
   * Convert joint positions to joint angles
   * Helper for FABRIK algorithm
   */
  private convertPositionsToAngles(
    chainName: string,
    jointPositions: BABYLON.Vector3[],
    joints: JointConfig[],
    initialAngles: number[]
  ): number[] {
    const resultAngles: number[] = [];

    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i];

      if (joint.type === 'revolute' || joint.type === 'spherical') {
        // Get parent and child positions
        // Note: Spherical joints treated as single-axis revolute (1-DOF approximation)
        const parentPos = i === 0
          ? jointPositions[0]
          : jointPositions[i];
        const childPos = i < jointPositions.length - 1
          ? jointPositions[i + 1]
          : jointPositions[jointPositions.length - 1];

        // Compute direction vector
        const direction = childPos.subtract(parentPos).normalize();

        // Get joint axis
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();

        // Project direction onto plane perpendicular to axis
        const axisDot = BABYLON.Vector3.Dot(direction, axis);
        const projectedDir = direction.subtract(axis.scale(axisDot)).normalize();

        // Compute angle from reference orientation
        // Use initial angle as reference
        let angle = initialAngles[i];

        // If we have a valid projected direction, compute angle
        if (projectedDir.length() > 0.001) {
          // Get reference direction at zero angle
          const tempAngles = [...initialAngles];
          tempAngles[i] = 0;
          const zeroPose = this.fkSolver.solveUpToJoint(chainName, tempAngles, i + 1);

          if (zeroPose && i < jointPositions.length - 1) {
            const zeroDir = zeroPose.position
              .subtract(parentPos)
              .normalize();

            const zeroDot = BABYLON.Vector3.Dot(zeroDir, axis);
            const zeroProjected = zeroDir.subtract(axis.scale(zeroDot)).normalize();

            if (zeroProjected.length() > 0.001) {
              // Compute angle between projected directions
              const dot = Math.max(-1, Math.min(1,
                BABYLON.Vector3.Dot(zeroProjected, projectedDir)
              ));
              angle = Math.acos(dot);

              // Determine sign using cross product
              const cross = BABYLON.Vector3.Cross(zeroProjected, projectedDir);
              if (BABYLON.Vector3.Dot(cross, axis) < 0) {
                angle = -angle;
              }
            }
          }
        }

        resultAngles.push(angle);
      } else if (joint.type === 'prismatic') {
        // For prismatic joints, compute distance along axis
        const parentPos = i === 0
          ? jointPositions[0]
          : jointPositions[i];
        const childPos = i < jointPositions.length - 1
          ? jointPositions[i + 1]
          : jointPositions[jointPositions.length - 1];

        const displacement = childPos.subtract(parentPos);
        const axis = new BABYLON.Vector3(
          joint.axis.x,
          joint.axis.y,
          joint.axis.z
        ).normalize();

        const distance = BABYLON.Vector3.Dot(displacement, axis);
        resultAngles.push(distance);
      } else {
        // For other joint types, maintain initial angle
        resultAngles.push(initialAngles[i]);
      }
    }

    return resultAngles;
  }
}
