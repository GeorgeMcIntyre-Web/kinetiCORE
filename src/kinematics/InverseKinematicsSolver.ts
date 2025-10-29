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
      stepSize = 0.5, // Increased from 0.2 for faster convergence (line-search ensures stability)
      positionWeight = 1.0,
      orientationWeight = 0.5,
      damping = 0.1, // Reduced from 0.2 for better convergence speed (line-search provides stability)
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
      // === COORDINATE SPACE DEBUG (Iteration 0 only) ===
      if (iteration === 0) {
        // Get actual TCP from mesh (WORLD space)
        const nullTCPPose = this.fkSolver.getNullTCPPose(chainName);
        if (nullTCPPose) {
          console.log(`[IK DEBUG] === Iteration 0 Coordinate Space Analysis ===`);
          console.log(`[IK DEBUG] nullTCPPose from mesh (WORLD): ${nullTCPPose.position.toString()}`);
        }
      }

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

      // === COORDINATE SPACE DEBUG (Iteration 0 only) ===
      if (iteration === 0) {
        console.log(`[IK DEBUG] FK solve input jointAngles (radians): [${jointAngles.map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK DEBUG] FK solve input jointAngles (degrees): [${jointAngles.map(v => (v * 180 / Math.PI).toFixed(1)).join(', ')}]°`);
        console.log(`[IK DEBUG] FK solve result (ROBOT-LOCAL): ${currentPoseLocal.position.toString()}`);
        console.log(`[IK DEBUG] Base world matrix translation: ${baseWorldMatrix.getTranslation().toString()}`);
        console.log(`[IK DEBUG] Base is identity: ${baseWorldMatrix.equals(BABYLON.Matrix.Identity())}`);
        console.log(`[IK DEBUG] FK transformed to WORLD: ${currentPosWorld.toString()}`);

        // Verify: FK→World should match mesh position
        const nullTCPPose = this.fkSolver.getNullTCPPose(chainName);
        if (nullTCPPose) {
          const diff = currentPosWorld.subtract(nullTCPPose.position).length();
          console.log(`[IK DEBUG] ✓ FK→World vs Mesh diff: ${diff.toFixed(6)}m (should be ~0.000m)`);
          console.log(`[IK DEBUG] Mesh position (WORLD): ${nullTCPPose.position.toString()}`);
        }

        // Check for suspicious angles that might be degrees stored as radians
        const suspiciousAngles = jointAngles.filter(v => Math.abs(v) > Math.PI * 2);
        if (suspiciousAngles.length > 0) {
          console.error(`[IK DEBUG] ⚠️ UNIT MISMATCH: Joint angles > 2π radians detected! Possible degrees stored as radians!`);
          console.error(`[IK DEBUG] Suspicious values (rad): [${suspiciousAngles.map(v => v.toFixed(4)).join(', ')}]`);
        }
      }

      // Compute position error (both in WORLD space)
      const positionError = target.position.subtract(currentPosWorld);
      const positionErrorMagnitude = positionError.length();

      // Helper function to compute orientation error vector
      const computeOrientationError = (rot: BABYLON.Quaternion): BABYLON.Vector3 => {
        if (!target.rotation) return new BABYLON.Vector3(0, 0, 0);
        
        // Compute quaternion error: q_error = q_target * q_current^-1
        const rotationError = target.rotation.multiply(BABYLON.Quaternion.Inverse(rot));

        // Ensure shortest path (quaternion double-cover issue)
        const normalizedError = rotationError.w < 0
          ? new BABYLON.Quaternion(
              -rotationError.x, -rotationError.y, -rotationError.z, -rotationError.w
            )
          : rotationError;

        // Convert quaternion error to axis-angle representation
        const angle = 2 * Math.acos(Math.min(1, Math.abs(normalizedError.w)));
        const axis = new BABYLON.Vector3(
          normalizedError.x, normalizedError.y, normalizedError.z
        );
        const axisLength = axis.length();

        // Convert to angular velocity error (axis-angle vector)
        if (axisLength > 0.0001 && angle > 0.0001) {
          return axis.scale(angle / axisLength);
        }
        return new BABYLON.Vector3(0, 0, 0);
      };

      // Compute orientation error (if target rotation specified)
      const orientationError = computeOrientationError(currentRotWorld);

      // Total error (used for convergence checking)
      error = positionErrorMagnitude * positionWeight +
              orientationError.length() * orientationWeight;

      // === COORDINATE SPACE DEBUG (Iteration 0 only) ===
      if (iteration === 0) {
        console.log(`[IK DEBUG] Target position (WORLD): ${target.position.toString()}`);
        console.log(`[IK DEBUG] Position error (WORLD): ${positionError.toString()}, magnitude=${positionErrorMagnitude.toFixed(4)}m`);

        // === ORIENTATION DEBUG ===
        console.log(`[IK DEBUG] === Orientation Analysis ===`);
        console.log(`[IK DEBUG] Target rotation defined: ${target.rotation !== undefined}`);
        if (target.rotation) {
          console.log(`[IK DEBUG] Current rotation: ${currentRotWorld.toString()}`);
          console.log(`[IK DEBUG] Target rotation:  ${target.rotation.toString()}`);

          // Compute angle difference
          const dot = BABYLON.Quaternion.Dot(currentRotWorld, target.rotation);
          const angleDiff = 2 * Math.acos(Math.min(1, Math.abs(dot)));
          console.log(`[IK DEBUG] Orientation difference: ${(angleDiff * 180 / Math.PI).toFixed(3)}° (should be ~0° for pure translation)`);
          console.log(`[IK DEBUG] Orientation error magnitude: ${orientationError.length().toFixed(6)} rad`);
        } else {
          console.warn(`[IK DEBUG] ⚠️ Target rotation NOT defined - orientation will drift!`);
        }
      }

      // DEBUG: Log first 3 iterations and every 100 iterations
      if (iteration < 3 || iteration % 100 === 0) {
        console.log(`[IK Jacobian] Iter ${iteration}: error=${positionErrorMagnitude.toFixed(4)}m, currentPos=${currentPosWorld.toString()}, targetPos=${target.position.toString()}`);
      }

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
        console.log(`[IK DEBUG] Error vector (6D): [${errorVector.map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK DEBUG] Jacobian (6×${jointAngles.length}) - WORLD SPACE:`);
        console.log(`[IK DEBUG]   Row 0 (dx/dq): [${jacobian[0].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK DEBUG]   Row 1 (dy/dq): [${jacobian[1].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK DEBUG]   Row 2 (dz/dq): [${jacobian[2].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK DEBUG]   Row 3 (ωx/dq): [${jacobian[3].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK DEBUG]   Row 4 (ωy/dq): [${jacobian[4].map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK DEBUG]   Row 5 (ωz/dq): [${jacobian[5].map(v => v.toFixed(4)).join(', ')}]`);

        // Verify Jacobian makes physical sense for Joint 0 (base rotation)
        if (jointAngles.length > 0) {
          console.log(`[IK DEBUG] ✓ Joint 0 Jacobian check (should show large XY motion for base rotation):`);
          console.log(`[IK DEBUG]   Linear:  [${jacobian[0][0].toFixed(3)}, ${jacobian[1][0].toFixed(3)}, ${jacobian[2][0].toFixed(3)}]`);
          console.log(`[IK DEBUG]   Angular: [${jacobian[3][0].toFixed(3)}, ${jacobian[4][0].toFixed(3)}, ${jacobian[5][0].toFixed(3)}]`);
        }

        // === WRIST JOINTS ANALYSIS (Joints 4-6 for orientation control) ===
        if (jointAngles.length >= 6) {
          console.log(`[IK DEBUG] === Wrist Joints (4-6) Analysis ===`);
          console.log(`[IK DEBUG] J4 (wrist roll):`);
          console.log(`[IK DEBUG]   Position: [${jacobian[0][3].toFixed(4)}, ${jacobian[1][3].toFixed(4)}, ${jacobian[2][3].toFixed(4)}]`);
          console.log(`[IK DEBUG]   Angular:  [${jacobian[3][3].toFixed(4)}, ${jacobian[4][3].toFixed(4)}, ${jacobian[5][3].toFixed(4)}]`);
          console.log(`[IK DEBUG] J5 (wrist bend):`);
          console.log(`[IK DEBUG]   Position: [${jacobian[0][4].toFixed(4)}, ${jacobian[1][4].toFixed(4)}, ${jacobian[2][4].toFixed(4)}]`);
          console.log(`[IK DEBUG]   Angular:  [${jacobian[3][4].toFixed(4)}, ${jacobian[4][4].toFixed(4)}, ${jacobian[5][4].toFixed(4)}]`);
          console.log(`[IK DEBUG] J6 (tool rotation):`);
          console.log(`[IK DEBUG]   Position: [${jacobian[0][5].toFixed(4)}, ${jacobian[1][5].toFixed(4)}, ${jacobian[2][5].toFixed(4)}]`);
          console.log(`[IK DEBUG]   Angular:  [${jacobian[3][5].toFixed(4)}, ${jacobian[4][5].toFixed(4)}, ${jacobian[5][5].toFixed(4)}]`);
        }
      }

      // Compute joint angle deltas using Levenberg-Marquardt (damped least squares)
      // For 6-DOF: Δθ = (J^T * J + λ²I)^-1 * J^T * e
      // Or equivalently: Δθ = J^T * (J * J^T + λ²I)^-1 * e (more stable for m < n)
      // Since we have 6 rows (Cartesian) and n joints, use second form
      const deltaAngles: number[] = Array(jointAngles.length).fill(0);

      // Compute J * J^T (6x6 matrix)
      const JJT: number[][] = Array(6).fill(0).map(() => Array(6).fill(0));
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          for (let k = 0; k < jointAngles.length; k++) {
            JJT[i][j] += jacobian[i][k] * jacobian[j][k];
          }
        }
      }

      // Add damping: (J * J^T + λ²I)
      // Use total error (or orientation error if position is zero) for damping to handle pure orientation moves
      const errorForDamping = positionErrorMagnitude > 1e-6 
        ? positionErrorMagnitude 
        : (orientationError.length() * 0.1); // Scale orientation error for damping (rad ~0.1m equivalent)
      const lambda = damping * errorForDamping;
      for (let i = 0; i < 6; i++) {
        JJT[i][i] += lambda * lambda;
      }

      // Invert 6x6 matrix (small enough to compute directly)
      const JJTInv = this.invert6x6Matrix(JJT);
      if (!JJTInv) {
        // Fallback to simple transpose if inversion fails
        for (let i = 0; i < jointAngles.length; i++) {
          let delta = 0;
          for (let j = 0; j < 6; j++) {
            delta += jacobian[j][i] * errorVector[j];
          }
          deltaAngles[i] = -delta * stepSize;
        }
      } else {
        // Compute (J * J^T + λ²I)^-1 * e
        const dampedError: number[] = Array(6).fill(0);
        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 6; j++) {
            dampedError[i] += JJTInv[i][j] * errorVector[j];
          }
        }

        // Compute Δθ = -J^T * dampedError (negative for descent)
        for (let i = 0; i < jointAngles.length; i++) {
          let delta = 0;
          for (let j = 0; j < 6; j++) {
            delta += jacobian[j][i] * dampedError[j];
          }
          deltaAngles[i] = -delta; // Negative for error descent
        }
      }

      // Adaptive step size with more aggressive scaling
      // Scale step by TOTAL error magnitude (position + orientation) to push through plateaus
      // Use orientation error magnitude for pure rotation moves
      const totalErrorMagnitude = positionErrorMagnitude > 1e-6 
        ? positionErrorMagnitude 
        : (orientationError.length() * 0.1); // Scale orientation error for step size (rad ~0.1m equivalent)
      const adaptiveStep = totalErrorMagnitude < 0.01
        ? stepSize * 3.0  // Triple when very close (line-search protects)
        : totalErrorMagnitude < 0.02
        ? stepSize * 2.0  // Double when close
        : Math.min(1.0, 0.2 / Math.max(totalErrorMagnitude, 0.01)) * stepSize;

      // DEBUG: Log first iteration details
      if (iteration === 0) {
        console.log(`[IK Jacobian] Iter 0 adaptiveStep=${adaptiveStep.toFixed(4)}, deltaAngles: [${deltaAngles.map(v => v.toFixed(4)).join(', ')}]`);
        console.log(`[IK Jacobian] Iter 0 jointAngles BEFORE: [${jointAngles.map(v => (v * 180 / Math.PI).toFixed(1)).join(', ')}]°`);
        console.log(`[IK DEBUG] Line-search starting: current TOTAL error=${error.toFixed(6)} (pos: ${positionErrorMagnitude.toFixed(6)}m, orient: ${orientationError.length().toFixed(6)}rad)`);
      }

      // Tentative update with line-search that checks actual TOTAL error reduction (position + orientation)
      let step = adaptiveStep;
      let improved = false;
      let candidateAngles = jointAngles.slice();
      let bestErr = error; // Use total error (position + orientation)
      let bestAngles = jointAngles.slice();

      // Try progressive step sizes, keeping the best
      for (let attempt = 0; attempt < 8; attempt++) {
        // Apply step to candidate
        for (let i = 0; i < candidateAngles.length; i++) {
          candidateAngles[i] = jointAngles[i] + step * deltaAngles[i];
        }

        // Clamp to limits
        for (let i = 0; i < candidateAngles.length; i++) {
          candidateAngles[i] = Math.max(
            joints[i].limits.lower,
            Math.min(joints[i].limits.upper, candidateAngles[i])
          );
        }

        // Evaluate new TOTAL error (position + orientation) using FK → WORLD
        const poseLocal = this.fkSolver.solve(chainName, candidateAngles);
        if (!poseLocal) {
          step *= 0.5;
          candidateAngles = jointAngles.slice();
          continue;
        }
        const baseWorldMatrixLS = this.kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
        const posWorldLS = BABYLON.Vector3.TransformCoordinates(poseLocal.position, baseWorldMatrixLS);
        const baseRotLS = BABYLON.Quaternion.FromRotationMatrix(baseWorldMatrixLS.getRotationMatrix());
        const rotWorldLS = baseRotLS.multiply(poseLocal.rotation);
        
        // Compute total error (position + orientation)
        const posErrLS = target.position.subtract(posWorldLS).length();
        const orientErrLS = computeOrientationError(rotWorldLS);
        const newTotalErr = posErrLS * positionWeight + orientErrLS.length() * orientationWeight;

        // Keep track of best candidate (lowest total error)
        if (newTotalErr < bestErr) {
          bestErr = newTotalErr;
          bestAngles = candidateAngles.slice();
          improved = true;
        }

        // If we found an improvement (at least 0.1% reduction), accept it (don't continue searching)
        if (newTotalErr <= error * 0.999) {
          improved = true;
          jointAngles = candidateAngles;
          break;
        }

        // Reduce step and retry
        step *= 0.5;
        candidateAngles = jointAngles.slice();
      }

      // Use best candidate found, or if none improved, use smallest step
      if (improved) {
        jointAngles = bestAngles;
        if (iteration === 0) {
          console.log(`[IK DEBUG] Line-search: improved TOTAL error from ${error.toFixed(6)} to ${bestErr.toFixed(6)} (pos+orient weighted)`);
        }
      } else {
        // If no improvement, try NEGATING the step direction (might be sign error)
        if (iteration === 0) {
          console.log(`[IK DEBUG] Line-search: NO improvement found. Best TOTAL error: ${bestErr.toFixed(6)} (worse than ${error.toFixed(6)}). Trying NEGATED step...`);
        }
        for (let i = 0; i < candidateAngles.length; i++) {
          candidateAngles[i] = jointAngles[i] - (adaptiveStep * 0.1) * deltaAngles[i];
        }
        for (let i = 0; i < candidateAngles.length; i++) {
          candidateAngles[i] = Math.max(
            joints[i].limits.lower,
            Math.min(joints[i].limits.upper, candidateAngles[i])
          );
        }
        const poseLocalNeg = this.fkSolver.solve(chainName, candidateAngles);
        if (poseLocalNeg) {
          const baseWorldMatrixNeg = this.kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
          const posWorldNeg = BABYLON.Vector3.TransformCoordinates(poseLocalNeg.position, baseWorldMatrixNeg);
          const baseRotNeg = BABYLON.Quaternion.FromRotationMatrix(baseWorldMatrixNeg.getRotationMatrix());
          const rotWorldNeg = baseRotNeg.multiply(poseLocalNeg.rotation);
          
          // Compute total error for negated step
          const posErrNeg = target.position.subtract(posWorldNeg).length();
          const orientErrNeg = computeOrientationError(rotWorldNeg);
          const negTotalErr = posErrNeg * positionWeight + orientErrNeg.length() * orientationWeight;
          
          if (negTotalErr < error) {
            jointAngles = candidateAngles;
            if (iteration === 0) {
              console.log(`[IK DEBUG] ✓ NEGATED step improved! TOTAL error: ${negTotalErr.toFixed(6)} (this may indicate a sign issue)`);
            }
          } else {
            // Last resort: tiny step in original direction
            if (iteration === 0) {
              console.log(`[IK DEBUG] ⚠️ Even negated step didn't help (total error: ${negTotalErr.toFixed(6)}). Using tiny step as last resort.`);
            }
            for (let i = 0; i < jointAngles.length; i++) {
              jointAngles[i] += (adaptiveStep * 0.01) * deltaAngles[i];
            }
          }
        } else {
          // Last resort: tiny step in original direction
          if (iteration === 0) {
            console.log(`[IK DEBUG] ⚠️ Negated step FK solve failed. Using tiny step.`);
          }
          for (let i = 0; i < jointAngles.length; i++) {
            jointAngles[i] += (adaptiveStep * 0.01) * deltaAngles[i];
          }
        }
      }

      // DEBUG: Log first iteration joint update
      if (iteration === 0) {
        console.log(`[IK DEBUG] Joint angles AFTER update: [${jointAngles.map(v => (v * 180 / Math.PI).toFixed(1)).join(', ')}]°`);

        // === WRIST JOINT ACTIVITY ANALYSIS ===
        if (jointAngles.length >= 6) {
          const armDelta = Math.sqrt(
            deltaAngles.slice(0, 3).reduce((sum, v) => sum + v * v, 0)
          );
          const wristDelta = Math.sqrt(
            deltaAngles.slice(3, 6).reduce((sum, v) => sum + v * v, 0)
          );

          console.log(`[IK DEBUG] === Joint Activity Analysis ===`);
          console.log(`[IK DEBUG] Arm joints (1-3) delta magnitude:   ${(armDelta * 180 / Math.PI).toFixed(3)}°`);
          console.log(`[IK DEBUG] Wrist joints (4-6) delta magnitude: ${(wristDelta * 180 / Math.PI).toFixed(3)}°`);

          if (wristDelta < 0.0001) {
            console.warn(`[IK DEBUG] ⚠️ WRIST JOINTS NOT MOVING! Orientation may not be controlled.`);
          }

          console.log(`[IK DEBUG] Individual deltas (degrees):`);
          console.log(`[IK DEBUG]   Arm:   J1=${(deltaAngles[0] * 180 / Math.PI).toFixed(3)}°, J2=${(deltaAngles[1] * 180 / Math.PI).toFixed(3)}°, J3=${(deltaAngles[2] * 180 / Math.PI).toFixed(3)}°`);
          console.log(`[IK DEBUG]   Wrist: J4=${(deltaAngles[3] * 180 / Math.PI).toFixed(3)}°, J5=${(deltaAngles[4] * 180 / Math.PI).toFixed(3)}°, J6=${(deltaAngles[5] * 180 / Math.PI).toFixed(3)}°`);
        }

        // Check if any joints are approaching limits
        for (let i = 0; i < jointAngles.length; i++) {
          const limitMargin = Math.min(
            jointAngles[i] - joints[i].limits.lower,
            joints[i].limits.upper - jointAngles[i]
          );
          if (limitMargin < 0.1) { // Within 5.7 degrees of limit
            console.warn(`[IK DEBUG] ⚠ Joint ${i} near limit: ${(jointAngles[i] * 180 / Math.PI).toFixed(1)}° (limits: [${(joints[i].limits.lower * 180 / Math.PI).toFixed(1)}°, ${(joints[i].limits.upper * 180 / Math.PI).toFixed(1)}°])`);
          }
        }
        console.log(`[IK DEBUG] === End Iteration 0 Analysis ===\n`);
      }
    }

    // Clamp final joint angles to limits
    for (let i = 0; i < jointAngles.length; i++) {
      const unclamped = jointAngles[i];
      jointAngles[i] = Math.max(
        joints[i].limits.lower,
        Math.min(joints[i].limits.upper, jointAngles[i])
      );
      if (Math.abs(unclamped - jointAngles[i]) > 0.001) {
        console.warn(`[IK DEBUG] ⚠ Joint ${i} clamped: ${(unclamped * 180 / Math.PI).toFixed(1)}° → ${(jointAngles[i] * 180 / Math.PI).toFixed(1)}°`);
      }
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

      // Iterate through joints from null TCP to base
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

        // Get current null TCP position in world space (last joint transformation)
        const nullTCPPose = this.fkSolver.getEndEffectorPose(chainName);
        if (!nullTCPPose) continue;

        // Find the joint's index in the full joint array
        const jointIndexInFullArray = allJoints.findIndex(j => j.id === joint.id);
        if (jointIndexInFullArray < 0) continue;

        // Get joint position (solve FK up to this joint using full joint angles)
        const jointPose = this.fkSolver.solveUpToJoint(chainName, jointAngles, jointIndexInFullArray);
        if (!jointPose) continue;

        const jointPosition = jointPose.position;
        const nullTCPPosition = nullTCPPose.position;

        // Vectors from joint to null TCP and target
        const toNullTCP = nullTCPPosition.subtract(jointPosition);
        const toTarget = target.position.subtract(jointPosition);

        // Normalize vectors
        const toNullTCPNorm = toNullTCP.normalize();
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
        const dot = BABYLON.Vector3.Dot(toNullTCPNorm, toTargetNorm);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

        // Determine rotation direction using cross product
        const cross = BABYLON.Vector3.Cross(toNullTCPNorm, toTargetNorm);
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
    // First attempt: requested method
    let solution = method === 'jacobian'
      ? this.solveJacobianTranspose(chainName, target)
      : this.solveCCD(chainName, target);

    // Fallback: if Jacobian fails, try CCD which is often more robust near singularities
    if (!solution.success && method === 'jacobian') {
      console.warn(
        `IK failed with Jacobian (error=${solution.error.toFixed(4)}, iterations=${solution.iterations}). ` +
        `Falling back to CCD...`
      );
      const ccdSolution = this.solveCCD(chainName, target);
      if (ccdSolution.success) {
        solution = ccdSolution;
      } else {
        console.warn(
          `IK fallback CCD also failed: error=${ccdSolution.error.toFixed(4)}, ` +
          `iterations=${ccdSolution.iterations}`
        );
        return false;
      }
    } else if (!solution.success) {
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

    // Get actual TCP world position from mesh (getNullTCPPose)
    const nullTCPPose = this.fkSolver.getNullTCPPose(chainName);
    if (!nullTCPPose) {
      console.error('[IK rotateTCP] Could not get null TCP pose');
      return false;
    }
    const currentPosWorld = nullTCPPose.position;
    const currentRotWorld = nullTCPPose.rotation;

    // Compute new target rotation (apply delta rotation)
    const targetRotation = rotationDelta.multiply(currentRotWorld);

    // Solve IK for new rotation (maintain position)
    // For pure orientation moves, prioritize orientation accuracy with higher orientationWeight
    const solution = method === 'jacobian'
      ? this.solveJacobianTranspose(
          chainName,
          {
            position: currentPosWorld,
            rotation: targetRotation,
          },
          undefined, // No initial angles override, use current
          {
            orientationWeight: 2.0, // Higher weight for orientation accuracy in pure rotation moves
            positionWeight: 1.0,     // Maintain position (prevent drift)
            tolerance: 0.001,        // Tighter tolerance for orientation (weighted error)
          }
        )
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

    // Get actual TCP world position from mesh (getNullTCPPose)
    const nullTCPPose = this.fkSolver.getNullTCPPose(chainName);
    if (!nullTCPPose) {
      console.error('[IK moveTCP] Could not get null TCP pose');
      return false;
    }
    const currentPoseWorld = nullTCPPose.position;
    const currentRotWorld = nullTCPPose.rotation;

    console.log(`[IK moveTCP] Current TCP (from mesh): ${currentPoseWorld.toString()}, delta: ${positionDelta.toString()}`);

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

    // For pure translation moves, use low orientation weight to prioritize position
    // This reduces unwanted Y/Z drift and allows more accurate X movement
    if (method === 'jacobian') {
      const solution = this.solveJacobianTranspose(chainName, {
        position: targetPosition,
        rotation: currentRotWorld, // Maintain current orientation (world space)
      }, undefined, {
        maxIterations: 1000,
        tolerance: 0.005,
        stepSize: 0.5,
        positionWeight: 1.0,
        orientationWeight: 0.01, // Very low - prioritize position for translation
        damping: 0.1,
      });

      if (!solution.success) {
        return false;
      }

      // Apply joint angles
      const chain = this.kinematicsManager.getChain(chainName);
      if (!chain) return false;
      const joints = this.kinematicsManager.getActuatedJoints(chain.id);
      for (let i = 0; i < joints.length; i++) {
        this.fkSolver.updateJointPosition(joints[i].id, solution.jointAngles[i]);
      }
      return true;
    }

    // For CCD, use standard solveAndApply
    return this.solveAndApply(
      chainName,
      {
        position: targetPosition,
        rotation: currentRotWorld, // Maintain current orientation (world space)
      },
      method
    );
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

    // Add null TCP position (last joint transformation)
    const nullTCPPose = this.fkSolver.solve(chainName, initialAngles);
    if (!nullTCPPose) {
      return { jointAngles: [], success: false, error: Infinity, iterations: 0 };
    }
    jointPositions.push(nullTCPPose.position.clone());

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
   * Invert a 6x6 matrix using Gaussian elimination with partial pivoting
   * Returns null if matrix is singular (non-invertible)
   */
  private invert6x6Matrix(matrix: number[][]): number[][] | null {
    const n = 6;
    // Create augmented matrix [A | I]
    const augmented: number[][] = Array(n).fill(0).map(() => Array(2 * n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        augmented[i][j] = matrix[i][j];
      }
      augmented[i][n + i] = 1.0; // Identity matrix
    }

    // Gauss-Jordan elimination with partial pivoting (eliminates both above and below)
    for (let i = 0; i < n; i++) {
      // Find pivot (largest element in column i from row i onwards)
      let maxRow = i;
      let maxVal = Math.abs(augmented[i][i]);
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > maxVal) {
          maxVal = Math.abs(augmented[k][i]);
          maxRow = k;
        }
      }

      // Check for singularity
      if (maxVal < 1e-10) {
        return null; // Singular matrix
      }

      // Swap rows
      if (maxRow !== i) {
        const temp = augmented[i];
        augmented[i] = augmented[maxRow];
        augmented[maxRow] = temp;
      }

      // Normalize pivot row (divide by pivot so pivot becomes 1)
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }

      // Eliminate column i in all other rows (both above and below)
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    // Extract inverse (right half of augmented matrix)
    const inverse: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        inverse[i][j] = augmented[i][n + j];
      }
    }

    return inverse;
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
