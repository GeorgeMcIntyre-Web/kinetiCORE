/**
 * Type definitions for point cloud registration.
 * 
 * These types mirror the Python implementation for consistency.
 */

/**
 * 3D point coordinates.
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Point cloud data structure.
 * Uses flat Float32Array for performance: [x1,y1,z1, x2,y2,z2, ...]
 */
export interface PointCloud {
  /** Flat array of coordinates: [x1,y1,z1, x2,y2,z2, ...] */
  points: Float32Array;
  /** Number of points */
  count: number;
}

/**
 * 4x4 transformation matrix.
 */
export interface Transform4x4 {
  /** 4x4 matrix as nested array */
  matrix: number[][];
}

/**
 * Result from point cloud fitting/registration.
 */
export interface FitResult {
  /** 4x4 transformation matrix */
  transformation: Transform4x4;
  /** Inlier RMSE (Root Mean Square Error) */
  inlierRmse: number;
  /** Maximum error */
  maxError: number;
  /** RMSE threshold for success */
  rmseThreshold: number;
  /** Whether registration succeeded */
  isSuccess: boolean;
}

/**
 * Registration options/configuration.
 */
export interface RegistrationOptions {
  /** RMSE threshold for success */
  rmseThreshold: number;
  /** Maximum ICP iterations */
  maxIterations: number;
  /** Convergence tolerance */
  tolerance: number;
  /** Maximum correspondence distance for ICP */
  maxCorrespondenceDistance?: number;
  /** Relative fitness threshold */
  relativeFitness?: number;
  /** Relative RMSE threshold */
  relativeRmse?: number;
}

/**
 * Registration metrics.
 */
export interface Metrics {
  /** Transformation matrix */
  transformation: number[][];
  /** Root Mean Square Error */
  rmse: number;
  /** Maximum error */
  maxError: number;
  /** Mean error */
  meanError: number;
  /** Median error */
  medianError: number;
}

/**
 * ICP refinement result.
 */
export interface ICPResult {
  /** Final transformation matrix */
  transform: Transform4x4;
  /** Number of iterations performed */
  iterations: number;
  /** Final error value */
  error: number;
}

