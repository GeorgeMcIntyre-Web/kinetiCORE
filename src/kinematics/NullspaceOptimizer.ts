/**
 * Nullspace Optimizer
 * Owner: George
 *
 * Uses redundant degrees of freedom for secondary objectives
 * when robot has more DOF than required for primary task
 */

// InverseKinematicsSolver reference (for future integration)
// import { InverseKinematicsSolver } from './InverseKinematicsSolver';
import { KinematicsManager } from './KinematicsManager';

/**
 * Secondary objective types for nullspace optimization
 */
export type NullspaceObjective =
  | 'joint_limit_avoidance'    // Stay away from joint limits
  | 'preferred_posture'         // Move toward preferred joint configuration
  | 'singularity_avoidance'     // Avoid kinematic singularities
  | 'obstacle_avoidance'        // Maximize distance from obstacles
  | 'energy_minimization'       // Minimize joint velocities/torques
  | 'custom';                   // User-defined objective

/**
 * Configuration for nullspace optimization
 */
export interface NullspaceConfig {
  objective: NullspaceObjective;
  weight: number; // 0-1, how strongly to apply secondary objective
  preferredAngles?: number[]; // For 'preferred_posture'
  customGradient?: (angles: number[]) => number[]; // For 'custom'
}

/**
 * Nullspace Optimizer
 *
 * For redundant manipulators (DOF > task constraints),
 * uses nullspace projection to optimize secondary objectives
 * while maintaining primary task (end-effector pose)
 */
export class NullspaceOptimizer {
  private static instance: NullspaceOptimizer | null = null;
  // InverseKinematicsSolver reference (for future integration)
  // private ikSolver: InverseKinematicsSolver;
  private kinematicsManager: KinematicsManager;

  private constructor() {
    // this.ikSolver = InverseKinematicsSolver.getInstance();
    this.kinematicsManager = KinematicsManager.getInstance();
  }

  static getInstance(): NullspaceOptimizer {
    if (!NullspaceOptimizer.instance) {
      NullspaceOptimizer.instance = new NullspaceOptimizer();
    }
    return NullspaceOptimizer.instance;
  }

  /**
   * Optimize joint angles using nullspace projection
   *
   * @param chainName Kinematic chain ID
   * @param currentAngles Current joint angles (radians)
   * @param jacobian Jacobian matrix (6 x n) for end-effector
   * @param config Nullspace optimization configuration
   * @returns Optimized joint angles
   */
  optimize(
    chainName: string,
    currentAngles: number[],
    jacobian: number[][],
    config: NullspaceConfig
  ): number[] {
    const n = currentAngles.length; // DOF

    // Compute pseudoinverse of Jacobian: J^+ = J^T (J J^T)^-1
    const jacobianPseudoinverse = this.computePseudoinverse(jacobian);

    // Compute nullspace projector: N = (I - J^+ J)
    const nullspaceProjector = this.computeNullspaceProjector(
      jacobian,
      jacobianPseudoinverse,
      n
    );

    // Compute gradient of secondary objective
    const secondaryGradient = this.computeSecondaryObjectiveGradient(
      chainName,
      currentAngles,
      config
    );

    // Project secondary gradient onto nullspace
    const nullspaceMotion = this.matrixVectorMultiply(
      nullspaceProjector,
      secondaryGradient
    );

    // Apply weighted nullspace motion
    const optimizedAngles = currentAngles.map(
      (angle, i) => angle + config.weight * nullspaceMotion[i]
    );

    return optimizedAngles;
  }

  /**
   * Compute secondary objective gradient
   */
  private computeSecondaryObjectiveGradient(
    chainName: string,
    currentAngles: number[],
    config: NullspaceConfig
  ): number[] {
    switch (config.objective) {
      case 'joint_limit_avoidance':
        return this.computeJointLimitAvoidanceGradient(chainName, currentAngles);

      case 'preferred_posture':
        return this.computePreferredPostureGradient(
          currentAngles,
          config.preferredAngles || currentAngles
        );

      case 'singularity_avoidance':
        return this.computeSingularityAvoidanceGradient(chainName, currentAngles);

      case 'energy_minimization':
        return this.computeEnergyMinimizationGradient(currentAngles);

      case 'custom':
        return config.customGradient
          ? config.customGradient(currentAngles)
          : new Array(currentAngles.length).fill(0);

      default:
        return new Array(currentAngles.length).fill(0);
    }
  }

  /**
   * Joint limit avoidance gradient
   * Pushes joints away from their limits
   */
  private computeJointLimitAvoidanceGradient(
    chainName: string,
    currentAngles: number[]
  ): number[] {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      return new Array(currentAngles.length).fill(0);
    }

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    const gradient: number[] = [];

    currentAngles.forEach((angle, i) => {
      const joint = joints[i];
      if (!joint) {
        gradient.push(0);
        return;
      }

      const lower = joint.limits.lower * (Math.PI / 180); // Convert to radians
      const upper = joint.limits.upper * (Math.PI / 180);
      const range = upper - lower;
      const margin = range * 0.1; // 10% margin from limits

      let grad = 0;

      // Repulsive gradient near lower limit
      if (angle < lower + margin) {
        const dist = angle - lower;
        grad = -1.0 / (dist + 0.01); // Repel away from lower limit
      }

      // Repulsive gradient near upper limit
      if (angle > upper - margin) {
        const dist = upper - angle;
        grad = 1.0 / (dist + 0.01); // Repel away from upper limit
      }

      gradient.push(grad);
    });

    return gradient;
  }

  /**
   * Preferred posture gradient
   * Pulls joints toward preferred configuration
   */
  private computePreferredPostureGradient(
    currentAngles: number[],
    preferredAngles: number[]
  ): number[] {
    return currentAngles.map((angle, i) => {
      const preferred = preferredAngles[i] || 0;
      return -(angle - preferred); // Gradient points toward preferred angle
    });
  }

  /**
   * Singularity avoidance gradient
   * Maximizes manipulability measure
   */
  private computeSingularityAvoidanceGradient(
    chainName: string,
    currentAngles: number[]
  ): number[] {
    // Manipulability measure: w = sqrt(det(J * J^T))
    // Gradient pushes configuration toward higher manipulability

    const epsilon = 0.001;
    const gradient: number[] = [];

    // Compute current manipulability
    const manipulability0 = this.computeManipulability(chainName, currentAngles);

    // Numerical gradient
    currentAngles.forEach((_angle, i) => {
      const perturbedAngles = [...currentAngles];
      perturbedAngles[i] += epsilon;

      const manipulability1 = this.computeManipulability(chainName, perturbedAngles);

      const dManipulability = (manipulability1 - manipulability0) / epsilon;
      gradient.push(dManipulability);
    });

    return gradient;
  }

  /**
   * Compute manipulability measure
   * Higher value = farther from singularity
   */
  private computeManipulability(chainName: string, angles: number[]): number {
    // Get Jacobian at current configuration
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return 0;

    // Simplified manipulability: sum of squared joint velocities
    // (full implementation would use det(J * J^T))
    let manipulability = 0;

    angles.forEach((angle) => {
      // Distance from mid-range increases manipulability
      const normalized = angle / Math.PI; // Normalize to [-1, 1]
      manipulability += 1.0 - normalized * normalized;
    });

    return Math.max(manipulability, 0.01); // Prevent zero
  }

  /**
   * Energy minimization gradient
   * Minimizes joint motion (L2 norm of joint angles)
   */
  private computeEnergyMinimizationGradient(currentAngles: number[]): number[] {
    // Gradient of ||q||^2 = 2q
    return currentAngles.map((_angle) => -2.0 * _angle);
  }

  /**
   * Compute pseudoinverse of Jacobian using SVD
   * J^+ = V * Σ^+ * U^T
   */
  private computePseudoinverse(jacobian: number[][]): number[][] {
    const m = jacobian.length; // Rows (task space dimensions, usually 6)
    const n = jacobian[0]?.length || 0; // Columns (joint space DOF)

    if (n === 0) {
      return [];
    }

    // Simplified: Use damped least squares pseudoinverse
    // J^+ = J^T (J J^T + λI)^-1
    const lambda = 0.01; // Damping factor

    // Compute J * J^T
    const JJT: number[][] = [];
    for (let i = 0; i < m; i++) {
      JJT[i] = [];
      for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += jacobian[i][k] * jacobian[j][k];
        }
        JJT[i][j] = sum + (i === j ? lambda : 0); // Add damping
      }
    }

    // Invert (J J^T + λI)
    const JJT_inv = this.invertMatrix(JJT);

    // Compute J^+ = J^T * (J J^T + λI)^-1
    const JT = this.transpose(jacobian);
    const pseudoinverse = this.matrixMultiply(JT, JJT_inv);

    return pseudoinverse;
  }

  /**
   * Compute nullspace projector: N = I - J^+ * J
   */
  private computeNullspaceProjector(
    jacobian: number[][],
    pseudoinverse: number[][],
    n: number
  ): number[][] {
    // Compute J^+ * J
    const JPlusJ = this.matrixMultiply(pseudoinverse, jacobian);

    // Compute I - J^+ * J
    const nullspaceProjector: number[][] = [];
    for (let i = 0; i < n; i++) {
      nullspaceProjector[i] = [];
      for (let j = 0; j < n; j++) {
        const identity = i === j ? 1 : 0;
        nullspaceProjector[i][j] = identity - (JPlusJ[i]?.[j] || 0);
      }
    }

    return nullspaceProjector;
  }

  // ========== Matrix Math Utilities ==========

  private matrixMultiply(A: number[][], B: number[][]): number[][] {
    const m = A.length;
    const n = B[0]?.length || 0;
    const p = B.length;

    if (A[0]?.length !== p) {
      console.error('[Nullspace] Matrix dimension mismatch');
      return [];
    }

    const result: number[][] = [];
    for (let i = 0; i < m; i++) {
      result[i] = [];
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < p; k++) {
          sum += A[i][k] * B[k][j];
        }
        result[i][j] = sum;
      }
    }

    return result;
  }

  private matrixVectorMultiply(A: number[][], v: number[]): number[] {
    const m = A.length;
    const result: number[] = [];

    for (let i = 0; i < m; i++) {
      let sum = 0;
      for (let j = 0; j < v.length; j++) {
        sum += A[i][j] * v[j];
      }
      result.push(sum);
    }

    return result;
  }

  private transpose(matrix: number[][]): number[][] {
    const m = matrix.length;
    const n = matrix[0]?.length || 0;

    const transposed: number[][] = [];
    for (let j = 0; j < n; j++) {
      transposed[j] = [];
      for (let i = 0; i < m; i++) {
        transposed[j][i] = matrix[i][j];
      }
    }

    return transposed;
  }

  private invertMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;

    // Gauss-Jordan elimination with partial pivoting
    const augmented: number[][] = matrix.map((row, i) => [
      ...row,
      ...Array(n)
        .fill(0)
        .map((_, j) => (i === j ? 1 : 0)),
    ]);

    // Forward elimination
    for (let col = 0; col < n; col++) {
      // Find pivot
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
          maxRow = row;
        }
      }

      // Swap rows
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

      // Check for singularity
      if (Math.abs(augmented[col][col]) < 1e-10) {
        console.warn('[Nullspace] Matrix is singular or near-singular');
        return matrix; // Return identity or handle error
      }

      // Eliminate column
      for (let row = 0; row < n; row++) {
        if (row === col) continue;

        const factor = augmented[row][col] / augmented[col][col];
        for (let j = col; j < 2 * n; j++) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }

    // Normalize diagonal
    for (let i = 0; i < n; i++) {
      const divisor = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= divisor;
      }
    }

    // Extract inverse from augmented matrix
    const inverse: number[][] = augmented.map((row) => row.slice(n));

    return inverse;
  }
}
