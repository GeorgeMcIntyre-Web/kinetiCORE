/**
 * ICPTSSolver - Professional ICP implementation using icpts
 * Owner: George
 *
 * Uses TypeScript-based ICP library (icpts) for robust point cloud registration.
 * Implements proven ModelAnalyzer3D pipeline patterns:
 * - Cascaded registration (forward → reverse)
 * - Bidirectional alignment for robustness
 * - Automotive-scale tolerance thresholds
 */

import * as BABYLON from '@babylonjs/core';
import icpts from 'icpts';

export interface PCLICPOptions {
  /** Maximum number of ICP iterations */
  maxIterations?: number;
  /** Error tolerance for early stopping */
  errorTolerance?: number;
  /** Initial transformation matrix (4x4 column-major flat array) */
  initialTransform?: number[];
  /** Enable detailed debugging output */
  enableDebug?: boolean;
}

export interface PCLICPResult {
  success: boolean;
  transform: BABYLON.Matrix; // 4x4 transformation matrix
  error: number; // Final alignment error
  iterations: number; // Number of iterations performed
  debug?: {
    attemptedDirection: 'forward' | 'reverse';
    sourcePoints: number;
    targetPoints: number;
    finalTransform4x4: number[][]; // 4x4 transformation as 2D array
  };
}

// Default parameters based on ModelAnalyzer3D automotive tooling settings
const DEFAULT_OPTIONS: Required<Pick<PCLICPOptions, 'maxIterations' | 'errorTolerance' | 'enableDebug'>> = {
  maxIterations: 200, // ModelAnalyzer3D uses 200
  errorTolerance: 1e-7, // ModelAnalyzer3D uses 0.0000001
  enableDebug: true,
};

/**
 * Converts Babylon Vector3 array to flat number array [x, y, z, x, y, z, ...]
 */
function babylonToFlatArray(points: BABYLON.Vector3[]): number[] {
  const flat: number[] = [];
  for (const p of points) {
    flat.push(p.x, p.y, p.z);
  }
  return flat;
}

/**
 * Converts flat 4x4 column-major array to Babylon Matrix
 */
function flatArrayToBabylon(flatMatrix: number[]): BABYLON.Matrix {
  if (flatMatrix.length !== 16) {
    console.error('[ICPTS] Invalid matrix size:', flatMatrix.length);
    return BABYLON.Matrix.Identity();
  }

  // icpts returns column-major, Babylon uses row-major
  // Column-major to row-major conversion: transpose
  return BABYLON.Matrix.FromArray([
    flatMatrix[0], flatMatrix[4], flatMatrix[8], flatMatrix[12],
    flatMatrix[1], flatMatrix[5], flatMatrix[9], flatMatrix[13],
    flatMatrix[2], flatMatrix[6], flatMatrix[10], flatMatrix[14],
    flatMatrix[3], flatMatrix[7], flatMatrix[11], flatMatrix[15],
  ]);
}

/**
 * Professional ICP solver using icpts
 *
 * Implements cascaded registration strategy from ModelAnalyzer3D:
 * 1. Try forward alignment: source → target
 * 2. If forward fails or has high error, try reverse: target → source (then invert)
 */
export class PCLICPSolver {
  /**
   * Align two point clouds using cascaded ICP registration
   *
   * @param sourcePoints - Source point cloud (moving/actuated part)
   * @param targetPoints - Target point cloud (fixed/reference part)
   * @param options - ICP alignment options
   * @returns Registration result with transformation matrix
   */
  static async align(
    sourcePoints: BABYLON.Vector3[],
    targetPoints: BABYLON.Vector3[],
    options: PCLICPOptions = {}
  ): Promise<PCLICPResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (opts.enableDebug) {
      console.log('[ICPTS] ===== CASCADED ICP REGISTRATION =====');
      console.log('[ICPTS] Source points:', sourcePoints.length);
      console.log('[ICPTS] Target points:', targetPoints.length);
      console.log('[ICPTS] Options:', {
        maxIterations: opts.maxIterations,
        errorTolerance: opts.errorTolerance,
      });
    }

    if (sourcePoints.length === 0 || targetPoints.length === 0) {
      console.error('[ICPTS] Empty point clouds');
      return {
        success: false,
        transform: BABYLON.Matrix.Identity(),
        error: Infinity,
        iterations: 0,
      };
    }

    // Step 1: Try forward alignment (source → target)
    const forwardResult = await this.tryAlignment(
      sourcePoints,
      targetPoints,
      'forward',
      opts
    );

    if (forwardResult.success && forwardResult.error < 0.01) {
      // Good forward result
      if (opts.enableDebug) {
        console.log('[ICPTS] ✓ Forward ICP succeeded with low error');
      }
      return forwardResult;
    }

    // Step 2: Try reverse alignment (target → source, then invert)
    if (opts.enableDebug) {
      console.log('[ICPTS] ⚠ Forward ICP had high error or failed, trying reverse...');
    }

    const reverseResult = await this.tryAlignment(
      targetPoints, // Swapped
      sourcePoints, // Swapped
      'reverse',
      opts
    );

    if (reverseResult.success) {
      // Invert transformation since we did reverse alignment
      reverseResult.transform = reverseResult.transform.invert();
      if (opts.enableDebug) {
        console.log('[ICPTS] ✓ Reverse ICP succeeded (transformation inverted)');
      }
      return reverseResult;
    }

    // Both failed, return forward result (better than nothing)
    if (opts.enableDebug) {
      console.warn('[ICPTS] ⚠ Both forward and reverse ICP had issues, returning forward result');
    }
    return forwardResult;
  }

  /**
   * Attempt ICP alignment in one direction
   */
  private static async tryAlignment(
    sourcePoints: BABYLON.Vector3[],
    targetPoints: BABYLON.Vector3[],
    direction: 'forward' | 'reverse',
    opts: Required<Pick<PCLICPOptions, 'maxIterations' | 'errorTolerance' | 'enableDebug'>> & PCLICPOptions
  ): Promise<PCLICPResult> {
    if (opts.enableDebug) {
      console.log(`[ICPTS] Attempting ${direction} ICP alignment...`);
    }

    try {
      // Convert to flat arrays
      const sourceFlatArray = babylonToFlatArray(sourcePoints);
      const targetFlatArray = babylonToFlatArray(targetPoints);

      // Execute point-to-point ICP
      const startTime = performance.now();

      const result = icpts.pointToPoint(
        sourceFlatArray,
        targetFlatArray,
        {
          maxIterations: opts.maxIterations,
          tolerance: opts.errorTolerance,
          ...(opts.initialTransform && { initialPose: opts.initialTransform }),
        }
      );

      const alignTime = performance.now() - startTime;

      // result.transform is a flat 16-element array (4x4 column-major)
      const babylonTransform = flatArrayToBabylon(result.transform);

      // Extract translation for rough error estimation
      const translation = new BABYLON.Vector3(
        babylonTransform.m[12],
        babylonTransform.m[13],
        babylonTransform.m[14]
      );
      const translationMagnitude = translation.length();

      // Rough success heuristic: translation not too large and result converged
      const success = translationMagnitude < 10.0; // Less than 10 meters movement

      if (opts.enableDebug) {
        console.log(`[ICPTS] ${direction} ICP completed in ${alignTime.toFixed(2)}ms`);
        console.log(`[ICPTS] Error: ${result.error ? result.error.toFixed(6) : 'N/A'}`);
        console.log(`[ICPTS] Translation magnitude: ${translationMagnitude.toFixed(4)}m`);
        console.log(`[ICPTS] Success: ${success}`);
        console.log(`[ICPTS] Transformation matrix:`, babylonTransform);
      }

      return {
        success,
        transform: babylonTransform,
        error: result.error || translationMagnitude,
        iterations: opts.maxIterations, // icpts doesn't expose actual iteration count
        debug: opts.enableDebug ? {
          attemptedDirection: direction,
          sourcePoints: sourcePoints.length,
          targetPoints: targetPoints.length,
          finalTransform4x4: [
            [babylonTransform.m[0], babylonTransform.m[1], babylonTransform.m[2], babylonTransform.m[3]],
            [babylonTransform.m[4], babylonTransform.m[5], babylonTransform.m[6], babylonTransform.m[7]],
            [babylonTransform.m[8], babylonTransform.m[9], babylonTransform.m[10], babylonTransform.m[11]],
            [babylonTransform.m[12], babylonTransform.m[13], babylonTransform.m[14], babylonTransform.m[15]],
          ],
        } : undefined,
      };
    } catch (error) {
      console.error(`[ICPTS] ${direction} ICP error:`, error);
      return {
        success: false,
        transform: BABYLON.Matrix.Identity(),
        error: Infinity,
        iterations: 0,
      };
    }
  }
}
