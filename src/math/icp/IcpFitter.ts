import * as BABYLON from '@babylonjs/core';
import { ICP, ICPOptions, ICPResult } from '../../babylon/pointCloud/ICP';

export type Point3 = { x: number; y: number; z: number };

export type IcpConfig = {
  maxIterations: number;
  maxCorrespondenceDistance: number; // world units
  relativeRmseThreshold: number; // e.g. 1e-7
  rmseSuccessThreshold: number; // e.g. 0.01
};

export type IcpFitResult = {
  transform: BABYLON.Matrix; // Babylon Matrix
  rmse: number;
  success: boolean;
};

/**
 * ICP Fitter for joint motion detection.
 * Uses point-to-point ICP to find the best rigid transform between two point clouds.
 */
export class IcpFitter {
  constructor(private readonly cfg: IcpConfig) {}

  /**
   * Fit source points to target points using ICP.
   * Tries forward (source→target) first, then reverse (target→source) if needed.
   */
  fit(
    sourcePoints: Point3[],
    targetPoints: Point3[],
    initialGuess?: BABYLON.Matrix
  ): IcpFitResult {
    if (sourcePoints.length === 0 || targetPoints.length === 0) {
      return {
        transform: BABYLON.Matrix.Identity(),
        rmse: Number.POSITIVE_INFINITY,
        success: false,
      };
    }

    const minCorrespondences = 20;
    if (sourcePoints.length < minCorrespondences || targetPoints.length < minCorrespondences) {
      return {
        transform: BABYLON.Matrix.Identity(),
        rmse: Number.POSITIVE_INFINITY,
        success: false,
      };
    }

    // Convert Point3[] to Vector3[]
    const sourceVecs = this.pointsToVectors(sourcePoints);
    const targetVecs = this.pointsToVectors(targetPoints);

    // Apply initial guess if provided
    let transformedSource = sourceVecs;
    if (initialGuess) {
      transformedSource = sourceVecs.map(p =>
        BABYLON.Vector3.TransformCoordinates(p, initialGuess)
      );
    }

    // Try forward ICP: source → target
    const forwardResult = this.runIcp(
      transformedSource,
      targetVecs,
      initialGuess || BABYLON.Matrix.Identity()
    );

    if (forwardResult.success && forwardResult.rmse <= this.cfg.rmseSuccessThreshold) {
      return forwardResult;
    }

    // Try reverse ICP: target → source
    const reverseInitialGuess = initialGuess
      ? initialGuess.clone().invert()
      : BABYLON.Matrix.Identity();
    const reverseResult = this.runIcp(
      targetVecs,
      transformedSource,
      reverseInitialGuess
    );

    if (!reverseResult.success) {
      return forwardResult;
    }

    // Invert the reverse result to get source→target transform
    const invertedTransform = reverseResult.transform.clone().invert();
    const invertedRmse = reverseResult.rmse;

    // Return the better result
    if (invertedRmse < forwardResult.rmse) {
      return {
        transform: invertedTransform,
        rmse: invertedRmse,
        success: invertedRmse <= this.cfg.rmseSuccessThreshold,
      };
    }

    return forwardResult;
  }

  /**
   * Run ICP alignment on two point clouds.
   */
  private runIcp(
    sourcePoints: BABYLON.Vector3[],
    targetPoints: BABYLON.Vector3[],
    initialTransform: BABYLON.Matrix
  ): IcpFitResult {
    const icpOptions: ICPOptions = {
      maxIterations: this.cfg.maxIterations,
      tolerance: this.cfg.relativeRmseThreshold,
      rejectThreshold: this.cfg.maxCorrespondenceDistance,
      trimFraction: 0.8, // Keep best 80% of correspondences
      enableDebug: false,
    };

    // Apply initial transform to source points
    const transformedSource = sourcePoints.map(p =>
      BABYLON.Vector3.TransformCoordinates(p, initialTransform)
    );

    const result: ICPResult = ICP.align(transformedSource, targetPoints, icpOptions);

    // Compose initial transform with ICP result
    const finalTransform = result.transform.multiply(initialTransform);

    return {
      transform: finalTransform,
      rmse: result.rmsError,
      success: result.success && result.rmsError <= this.cfg.rmseSuccessThreshold,
    };
  }

  /**
   * Convert Point3[] to Vector3[].
   */
  private pointsToVectors(points: Point3[]): BABYLON.Vector3[] {
    return points.map(p => new BABYLON.Vector3(p.x, p.y, p.z));
  }
}

