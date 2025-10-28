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
      maxIterations = 1000, // Increased from 300 - Jacobian transpose converges slowly
      tolerance = 0.005, // Relaxed from 0.001 (5mm tolerance for 10mm jog step)
      stepSize = 0.1, // Reduced from 0.2 to 0.1 for more stable convergence
      positionWeight = 1.0,
      orientationWeight = 0.5,
      damping = 0.2, // Increased from 0.1 for better stability
    } = options;

    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      return { jointAngles: [], success: false, error: Infinity, iterations: 0 };
    }

    const joints = this.kinematicsManager.getActuatedJoints(chain.id);
    // eslint-disable-next-line prefer-const -- array elements are mutated in loop (line 149)
    let jointAngles = initialAngles || joints.map((j: JointConfig) => j.position);

    let iteration = 0;
    let error = Infinity;

    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Compute current end-effector pose in robot-local space
      const currentPoseLocal = this.fkSolver.solve(chainName, jointAngles);
      if (!currentPoseLocal) {
        console.error('[IK Jacobian] FK solve failed at iteration', iteration);
        break;
      }

      // Transform current pose from robot-local to world space
      const baseWorldMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
      const currentPosWorld = BABYLON.Vector3.TransformCoordinates(
        currentPoseLocal.position,
        baseWorldMatrix
      );
      const baseRot = BABYLON.Quaternion.FromRotationMatrix(baseWorldMatrix.getRotationMatrix());
      const currentRotWorld = baseRot.multiply(currentPoseLocal.rotation);

      // Compute position error (both in WORLD space)
      const positionError = target.position.subtract(currentPosWorld);
      const positionErrorMagnitude = positionError.length();

      // DEBUG: Log first 3 iterations and every 100 iterations
      if (iteration < 3 || iteration % 100 === 0) {
        console.log(`[IK Jacobian] Iter ${iteration}: error=${positionErrorMagnitude.toFixed(4)}, currentPos=${currentPosWorld.toString()}, targetPos=${target.position.toString()}`);
      }

      // Compute orientation error (if target rotation specified)
      let orientationError = new BABYLON.Vector3(0, 0, 0);
      if (target.rotation) {
        // Compute quaternion error: q_error = q_target * q_current^-1
        const rotationError = target.rotation.multiply(
          BABYLON.Quaternion.Inverse(currentRotWorld)
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

      // DEBUG: Log error vector and full Jacobian on first iteration
      if (iteration === 0) {
        console.log(`[IK Jacobian] Iter 0 errorVector: [${errorVector.map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK Jacobian] Iter 0 Jacobian (6×${jointAngles.length}):`);
        console.log(`  Row 0 (dx): [${jacobian[0].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`  Row 1 (dy): [${jacobian[1].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`  Row 2 (dz): [${jacobian[2].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`  Row 3 (ωx): [${jacobian[3].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`  Row 4 (ωy): [${jacobian[4].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`  Row 5 (ωz): [${jacobian[5].map(v => v.toFixed(4)).join(', ')}]`);
      }

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
        deltaAngles[i] = delta * dampingFactor;
      }

      // Adaptive step size: smaller steps when error is large, larger steps when error is small
      // This prevents overshoot when far from target
      const adaptiveStep = Math.min(1.0, 0.1 / Math.max(positionErrorMagnitude, 0.01)) * stepSize;

      // DEBUG: Log first iteration details
      if (iteration === 0) {
        console.log(`[IK Jacobian] Iter 0 adaptiveStep=${adaptiveStep.toFixed(4)}, deltaAngles: [${deltaAngles.map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK Jacobian] Iter 0 jointAngles BEFORE: [${jointAngles.map(v => (v * 180 / Math.PI).toFixed(1)).join(', ')}]°`);
      }

      // Update joint angles
      for (let i = 0; i < jointAngles.length; i++) {
        jointAngles[i] += adaptiveStep * deltaAngles[i];
      }

      // DEBUG: Log first iteration joint update
      if (iteration === 0) {
        console.log(`[IK Jacobian] Iter 0 jointAngles AFTER: [${jointAngles.map(v => (v * 180 / Math.PI).toFixed(1)).join(', ')}]°`);
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

    const joints = this.kinematicsManager.getActuatedJoints(chain.id);
    // eslint-disable-next-line prefer-const -- array elements are mutated in loop (line 268)
    let jointAngles = initialAngles || joints.map((j: JointConfig) => j.position);

    let iteration = 0;
    let error = Infinity;

    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Check current error in world space (includes TCP frame)
      const currentPose = this.fkSolver.getEndEffectorPose(chainName);
      if (!currentPose) break;

      const positionError = target.position.subtract(currentPose.position);
      error = positionError.length();

      if (error < tolerance) {
        return { jointAngles, success: true, error, iterations: iteration + 1 };
      }

      // Iterate through joints from end-effector to base
      // Need to get all joints (including fixed) to get correct indices for solveUpToJoint
      const allJoints = this.kinematicsManager.getChainJoints(chain.id);
      
      for (let i = joints.length - 1; i >= 0; i--) {
        const joint = joints[i];

        // Only process revolute and spherical joints
        // Note: Spherical joints are currently treated as single-axis revolute
        // TODO: Full 3-DOF spherical joint support requires multi-value joint positions
        if (joint.type !== 'revolute' && joint.type !== 'spherical') {
          continue;
        }

        // Get current end-effector position in world space (includes TCP)
        const endEffectorPose = this.fkSolver.getEndEffectorPose(chainName);
        if (!endEffectorPose) continue;

        // Find the joint's index in the full joint array
        const jointIndexInFullArray = allJoints.findIndex(j => j.id === joint.id);
        if (jointIndexInFullArray < 0) continue;

        // Get joint position (solve FK up to this joint using full joint angles)
        const jointPose = this.fkSolver.solveUpToJoint(chainName, jointAngles, jointIndexInFullArray);
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

    // Apply joint angles to robot (only actuated joints)
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return false;

    const joints = this.kinematicsManager.getActuatedJoints(chain.id);

    for (let i = 0; i < joints.length; i++) {
      const result = this.fkSolver.updateJointPosition(joints[i].id, solution.jointAngles[i]);
      if (!result) {
        console.error(`[IK solveAndApply] Failed to update joint ${joints[i].id}`);
      }
    }

    // Log result
    console.log(`IK solved: error=${solution.error.toFixed(4)}, iterations=${solution.iterations}`);

    return true;
  }

  /**
   * Rotate TCP by delta (incremental rotation)
   * Useful for rotary jogging in Cartesian space
   */
  rotateTCP(
    chainName: string,
    rotationDelta: BABYLON.Quaternion,
    method: 'jacobian' | 'fabrik' = 'jacobian'
  ): boolean {
    // Get current joint angles and compute FK to get true current TCP pose
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      console.error('[IK rotateTCP] Chain not found:', chainName);
      return false;
    }
    const joints = this.kinematicsManager.getActuatedJoints(chain.id);
    const currentJointAngles = joints.map(j => j.position);

    // Compute current TCP pose using FK with current joint angles (in robot-local space)
    const currentPoseLocal = this.fkSolver.solve(chainName, currentJointAngles);
    if (!currentPoseLocal) {
      console.error('[IK rotateTCP] Failed to solve FK for current pose');
      return false;
    }

    // Transform to world space
    const baseWorldMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
    const currentPosWorld = BABYLON.Vector3.TransformCoordinates(
      currentPoseLocal.position,
      baseWorldMatrix
    );
    const baseRot = BABYLON.Quaternion.FromRotationMatrix(baseWorldMatrix.getRotationMatrix());
    const currentRotWorld = baseRot.multiply(currentPoseLocal.rotation);

    // Compute new target rotation (apply delta rotation)
    const targetRotation = rotationDelta.multiply(currentRotWorld);

    // Solve IK for new rotation (maintain position)
    const solution = method === 'jacobian'
      ? this.solveJacobianTranspose(chainName, {
          position: currentPosWorld,
          rotation: targetRotation,
        })
      : this.solveFABRIK(chainName, {
          position: currentPosWorld,
          rotation: targetRotation,
        });

    if (!solution.success) {
      console.warn('[IK Rotate] Failed to solve for rotation delta');
      return false;
    }

    // Apply joint angles (chain and joints already declared above)
    for (let i = 0; i < joints.length; i++) {
      this.fkSolver.updateJointPosition(joints[i].id, solution.jointAngles[i]);
    }

    return true;
  }

  /**
   * Move TCP by delta (incremental motion)
   * Useful for jogging in Cartesian space
   */
  moveTCP(
    chainName: string,
    positionDelta: BABYLON.Vector3,
    method: 'jacobian' | 'ccd' | 'fabrik' = 'jacobian'
  ): boolean {
    // Get current joint angles and compute FK to get true current TCP pose
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      console.error('[IK moveTCP] Chain not found:', chainName);
      return false;
    }
    const joints = this.kinematicsManager.getActuatedJoints(chain.id);
    const currentJointAngles = joints.map(j => j.position);

    // Compute current TCP pose using FK with current joint angles (in robot-local space)
    const currentPoseLocal = this.fkSolver.solve(chainName, currentJointAngles);
    if (!currentPoseLocal) {
      console.error('[IK moveTCP] Failed to solve FK for current pose');
      return false;
    }

    // Transform to world space
    const baseWorldMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
    const currentPoseWorld = BABYLON.Vector3.TransformCoordinates(
      currentPoseLocal.position,
      baseWorldMatrix
    );
    const baseRot = BABYLON.Quaternion.FromRotationMatrix(baseWorldMatrix.getRotationMatrix());
    const currentRotWorld = baseRot.multiply(currentPoseLocal.rotation);

    console.log(`[IK moveTCP] Current TCP (from FK): ${currentPoseWorld.toString()}, delta: ${positionDelta.toString()}`);

    // Compute new target position in world space
    const targetPosition = currentPoseWorld.add(positionDelta);

    // Solve IK for new position
    if (method === 'fabrik') {
      console.log('[IK moveTCP] Using FABRIK method');
      const solution = this.solveFABRIK(chainName, { position: targetPosition });
      if (!solution.success) {
        console.error('[IK moveTCP] FABRIK failed:', solution);
        return false;
      }

      // chain and joints already declared above
      for (let i = 0; i < joints.length; i++) {
        this.fkSolver.updateJointPosition(joints[i].id, solution.jointAngles[i]);
      }
      console.log('[IK moveTCP] ✅ FABRIK succeeded');
      return true;
    }

    const result = this.solveAndApply(
      chainName,
      {
        position: targetPosition,
        rotation: currentRotWorld, // Maintain current orientation (world space)
      },
      method
    );

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

    const joints = this.kinematicsManager.getActuatedJoints(chain.id);
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

  /**
   * Legacy method name - use rotateTCP() instead
   * @deprecated Use rotateTCP() for clarity
   */
  rotateEndEffector(chainName: string, rotationDelta: BABYLON.Quaternion, method: 'jacobian' | 'fabrik' = 'jacobian'): boolean {
    return this.rotateTCP(chainName, rotationDelta, method);
  }

  /**
   * Legacy method name - use moveTCP() instead
   * @deprecated Use moveTCP() for clarity
   */
  moveEndEffector(chainName: string, positionDelta: BABYLON.Vector3, method: 'jacobian' | 'ccd' | 'fabrik' = 'jacobian'): boolean {
    return this.moveTCP(chainName, positionDelta, method);
  }
}
