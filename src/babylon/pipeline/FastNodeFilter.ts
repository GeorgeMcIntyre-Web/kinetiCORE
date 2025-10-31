/**
 * FastNodeFilter - Multi-stage ICP-based node filtering
 * Owner: George
 *
 * Progressive filtering pipeline that kicks out bad node pairs early:
 * Stage 1: Geometric pre-filtering (< 1ms) - No ICP
 * Stage 2: Coarse ICP test (10-20ms) - Downsampled points
 * Stage 3: Full ICP refinement (100-200ms) - Full point cloud
 * Stage 4: Confidence scoring
 *
 * Goal: Fast identification of valid FIXED/MOVING node pairs
 */

import * as BABYLON from '@babylonjs/core';
import { PCLICPSolver } from '../pointCloud/PCLICPSolver';

export interface NodePair {
  fixedNodeId: string;
  movingNodeId: string;
  fixedPoints: BABYLON.Vector3[];
  movingPoints: BABYLON.Vector3[];
}

export interface FilterResult {
  nodeId: string;
  stage: 'prefilter' | 'coarse' | 'full' | 'confidence';
  passed: boolean;
  reason: string;
  metrics?: {
    error?: number;
    translationMagnitude?: number;
    rotationMagnitude?: number;
    confidence?: number;
    timeMs?: number;
  };
}

export interface FilterOptions {
  /** Minimum points required for ICP */
  minPoints?: number;
  /** Maximum centroid distance (meters) */
  maxCentroidDistance?: number;
  /** Minimum centroid distance (meters) to consider motion */
  minCentroidDistance?: number;
  /** BYPASS Stage 1 geometric filtering (for testing static GLB files) */
  bypassGeometricFilter?: boolean;
  /** Coarse ICP: number of points to downsample to */
  coarsePointCount?: number;
  /** Coarse ICP: max iterations */
  coarseMaxIterations?: number;
  /** Coarse ICP: error thresholds */
  coarseErrorMin?: number; // Below this = no motion
  coarseErrorMax?: number; // Above this = bad correspondence
  /** Full ICP: max iterations */
  fullMaxIterations?: number;
  /** Full ICP: error tolerance */
  fullErrorTolerance?: number;
  /** Valid translation range (meters) */
  translationRange?: { min: number; max: number };
  /** Valid rotation range (degrees) */
  rotationRange?: { min: number; max: number };
  /** Enable detailed logging */
  enableDebug?: boolean;
}

const DEFAULT_OPTIONS: Required<FilterOptions> = {
  minPoints: 50,
  maxCentroidDistance: 2.0, // 2m for automotive tooling
  minCentroidDistance: 0.001, // 1mm
  bypassGeometricFilter: false, // Normal mode: use geometric filtering
  coarsePointCount: 100,
  coarseMaxIterations: 20,
  coarseErrorMin: 0.001, // Below = no motion
  coarseErrorMax: 0.5, // Above = bad correspondence
  fullMaxIterations: 200,
  fullErrorTolerance: 1e-7,
  translationRange: { min: 0.01, max: 2.0 }, // 10mm - 2m
  rotationRange: { min: 1.0, max: 180.0 }, // 1° - 180°
  enableDebug: true,
};

export class FastNodeFilter {
  /**
   * Filter a batch of node pairs through multi-stage pipeline
   */
  static async filterBatch(
    nodePairs: NodePair[],
    options: FilterOptions = {}
  ): Promise<Map<string, FilterResult>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const results = new Map<string, FilterResult>();

    if (opts.enableDebug) {
      console.log('[FastFilter] ===== BATCH FILTERING =====');
      console.log('[FastFilter] Input node pairs:', nodePairs.length);
    }

    const startTime = performance.now();

    // Stage 1: Geometric pre-filtering (parallel, fast)
    const stage1Start = performance.now();
    const prefiltered: NodePair[] = [];

    if (opts.bypassGeometricFilter) {
      // BYPASS: Skip geometric filtering for testing static GLB files
      if (opts.enableDebug) {
        console.log('[FastFilter] Stage 1 (Geometric): BYPASSED for testing');
      }
      prefiltered.push(...nodePairs);

      // Still record results for tracking
      for (const pair of nodePairs) {
        results.set(pair.movingNodeId, {
          nodeId: pair.movingNodeId,
          stage: 'prefilter',
          passed: true,
          reason: 'Geometric filter bypassed',
        });
      }
    } else {
      for (const pair of nodePairs) {
        const result = this.geometricPrefilter(pair, opts);
        results.set(pair.movingNodeId, result);

        if (result.passed) {
          prefiltered.push(pair);
        }
      }
    }

    const stage1Time = performance.now() - stage1Start;

    if (opts.enableDebug && !opts.bypassGeometricFilter) {
      console.log(`[FastFilter] Stage 1 (Geometric): ${nodePairs.length} → ${prefiltered.length} (${stage1Time.toFixed(1)}ms)`);
    }

    // Stage 2: Coarse ICP test (sequential, moderate speed)
    const stage2Start = performance.now();
    const coarseFiltered: NodePair[] = [];

    for (const pair of prefiltered) {
      const result = await this.coarseICPTest(pair, opts);
      results.set(pair.movingNodeId, result);

      if (result.passed) {
        coarseFiltered.push(pair);
      }
    }

    const stage2Time = performance.now() - stage2Start;

    if (opts.enableDebug) {
      console.log(`[FastFilter] Stage 2 (Coarse ICP): ${prefiltered.length} → ${coarseFiltered.length} (${stage2Time.toFixed(1)}ms)`);
    }

    // Stage 3: Full ICP refinement (sequential, slower)
    const stage3Start = performance.now();
    const fullFiltered: Array<{ pair: NodePair; icpResult: any }> = [];

    for (const pair of coarseFiltered) {
      const result = await this.fullICPRefinement(pair, opts);
      results.set(pair.movingNodeId, result);

      if (result.passed && result.metrics) {
        fullFiltered.push({ pair, icpResult: result.metrics });
      }
    }

    const stage3Time = performance.now() - stage3Start;

    if (opts.enableDebug) {
      console.log(`[FastFilter] Stage 3 (Full ICP): ${coarseFiltered.length} → ${fullFiltered.length} (${stage3Time.toFixed(1)}ms)`);
    }

    // Stage 4: Confidence scoring
    const stage4Start = performance.now();

    for (const { pair, icpResult } of fullFiltered) {
      const result = this.confidenceScoring(pair, icpResult, opts);
      results.set(pair.movingNodeId, result);
    }

    const stage4Time = performance.now() - stage4Start;
    const totalTime = performance.now() - startTime;

    if (opts.enableDebug) {
      console.log(`[FastFilter] Stage 4 (Confidence): Scored ${fullFiltered.length} nodes (${stage4Time.toFixed(1)}ms)`);
      console.log(`[FastFilter] ===== TOTAL TIME: ${totalTime.toFixed(1)}ms =====`);
      console.log(`[FastFilter] Final valid nodes: ${fullFiltered.length}/${nodePairs.length}`);
    }

    return results;
  }

  /**
   * Stage 1: Geometric pre-filtering (< 1ms per node)
   */
  private static geometricPrefilter(pair: NodePair, opts: Required<FilterOptions>): FilterResult {
    const { fixedPoints, movingPoints, movingNodeId } = pair;

    // Check 1: Point count
    if (fixedPoints.length < opts.minPoints || movingPoints.length < opts.minPoints) {
      return {
        nodeId: movingNodeId,
        stage: 'prefilter',
        passed: false,
        reason: `Insufficient points (fixed=${fixedPoints.length}, moving=${movingPoints.length}, min=${opts.minPoints})`,
      };
    }

    // Check 2: Compute bounding boxes
    const fixedBounds = this.computeBounds(fixedPoints);
    const movingBounds = this.computeBounds(movingPoints);

    // Check 3: Compute centroids
    const fixedCentroid = this.computeCentroid(fixedPoints);
    const movingCentroid = this.computeCentroid(movingPoints);
    const centroidDistance = BABYLON.Vector3.Distance(fixedCentroid, movingCentroid);

    // Check 4: Centroid distance validation
    if (centroidDistance < opts.minCentroidDistance) {
      return {
        nodeId: movingNodeId,
        stage: 'prefilter',
        passed: false,
        reason: `No motion detected (centroid distance: ${(centroidDistance * 1000).toFixed(2)}mm < ${opts.minCentroidDistance * 1000}mm)`,
        metrics: { translationMagnitude: centroidDistance },
      };
    }

    if (centroidDistance > opts.maxCentroidDistance) {
      return {
        nodeId: movingNodeId,
        stage: 'prefilter',
        passed: false,
        reason: `Unrealistic motion (centroid distance: ${centroidDistance.toFixed(3)}m > ${opts.maxCentroidDistance}m)`,
        metrics: { translationMagnitude: centroidDistance },
      };
    }

    // Check 5: Bounding box size similarity (rough check)
    const fixedSize = fixedBounds.size.length();
    const movingSize = movingBounds.size.length();
    const sizeDiff = Math.abs(fixedSize - movingSize) / Math.max(fixedSize, movingSize);

    if (sizeDiff > 0.5) {
      return {
        nodeId: movingNodeId,
        stage: 'prefilter',
        passed: false,
        reason: `Geometry size mismatch (${(sizeDiff * 100).toFixed(1)}% difference)`,
      };
    }

    // Passed all geometric checks
    return {
      nodeId: movingNodeId,
      stage: 'prefilter',
      passed: true,
      reason: 'Passed geometric checks',
      metrics: { translationMagnitude: centroidDistance },
    };
  }

  /**
   * Stage 2: Coarse ICP test with downsampled points (10-20ms per node)
   */
  private static async coarseICPTest(pair: NodePair, opts: Required<FilterOptions>): Promise<FilterResult> {
    const { fixedPoints, movingPoints, movingNodeId } = pair;
    const startTime = performance.now();

    // Downsample point clouds
    const fixedDownsampled = this.downsample(fixedPoints, opts.coarsePointCount);
    const movingDownsampled = this.downsample(movingPoints, opts.coarsePointCount);

    try {
      // Run fast ICP
      const result = await PCLICPSolver.align(movingDownsampled, fixedDownsampled, {
        maxIterations: opts.coarseMaxIterations,
        errorTolerance: 1e-5, // Relaxed for speed
        enableDebug: false, // Disable debug for speed
      });

      const timeMs = performance.now() - startTime;

      // Check error thresholds
      if (result.error < opts.coarseErrorMin) {
        return {
          nodeId: movingNodeId,
          stage: 'coarse',
          passed: false,
          reason: `No motion detected (error: ${(result.error * 1000).toFixed(2)}mm < ${opts.coarseErrorMin * 1000}mm)`,
          metrics: { error: result.error, timeMs },
        };
      }

      if (result.error > opts.coarseErrorMax) {
        return {
          nodeId: movingNodeId,
          stage: 'coarse',
          passed: false,
          reason: `Bad correspondence (error: ${result.error.toFixed(3)}m > ${opts.coarseErrorMax}m)`,
          metrics: { error: result.error, timeMs },
        };
      }

      // Passed coarse ICP
      return {
        nodeId: movingNodeId,
        stage: 'coarse',
        passed: true,
        reason: 'Passed coarse ICP test',
        metrics: { error: result.error, timeMs },
      };
    } catch (error) {
      return {
        nodeId: movingNodeId,
        stage: 'coarse',
        passed: false,
        reason: `Coarse ICP failed: ${error}`,
      };
    }
  }

  /**
   * Stage 3: Full ICP refinement with full point cloud (100-200ms per node)
   */
  private static async fullICPRefinement(pair: NodePair, opts: Required<FilterOptions>): Promise<FilterResult> {
    const { fixedPoints, movingPoints, movingNodeId } = pair;
    const startTime = performance.now();

    try {
      // Run full ICP with cascaded registration
      const result = await PCLICPSolver.align(movingPoints, fixedPoints, {
        maxIterations: opts.fullMaxIterations,
        errorTolerance: opts.fullErrorTolerance,
        enableDebug: opts.enableDebug,
      });

      const timeMs = performance.now() - startTime;

      if (!result.success) {
        return {
          nodeId: movingNodeId,
          stage: 'full',
          passed: false,
          reason: 'Full ICP failed to converge',
          metrics: { error: result.error, timeMs },
        };
      }

      // Extract translation and rotation magnitudes
      const translation = new BABYLON.Vector3(
        result.transform.m[12],
        result.transform.m[13],
        result.transform.m[14]
      );
      const translationMagnitude = translation.length();

      // Rough rotation extraction (sum of off-diagonal elements as proxy)
      const rotationProxy = Math.abs(result.transform.m[1]) + Math.abs(result.transform.m[2]) +
                            Math.abs(result.transform.m[4]) + Math.abs(result.transform.m[6]) +
                            Math.abs(result.transform.m[8]) + Math.abs(result.transform.m[9]);
      const rotationMagnitude = Math.atan2(rotationProxy, 3) * (180 / Math.PI); // Rough estimate in degrees

      // Validate translation range
      if (translationMagnitude < opts.translationRange.min || translationMagnitude > opts.translationRange.max) {
        return {
          nodeId: movingNodeId,
          stage: 'full',
          passed: false,
          reason: `Translation out of range (${translationMagnitude.toFixed(3)}m not in [${opts.translationRange.min}, ${opts.translationRange.max}]m)`,
          metrics: { error: result.error, translationMagnitude, rotationMagnitude, timeMs },
        };
      }

      // Passed full ICP
      return {
        nodeId: movingNodeId,
        stage: 'full',
        passed: true,
        reason: 'Passed full ICP refinement',
        metrics: { error: result.error, translationMagnitude, rotationMagnitude, timeMs },
      };
    } catch (error) {
      return {
        nodeId: movingNodeId,
        stage: 'full',
        passed: false,
        reason: `Full ICP error: ${error}`,
      };
    }
  }

  /**
   * Stage 4: Confidence scoring
   */
  private static confidenceScoring(pair: NodePair, icpMetrics: any, opts: Required<FilterOptions>): FilterResult {
    const { movingNodeId } = pair;

    // Compute confidence score (0-1)
    const errorScore = Math.max(0, 1 - (icpMetrics.error / opts.coarseErrorMax)); // Lower error = higher score
    const translationScore = icpMetrics.translationMagnitude > opts.translationRange.min ? 1 : 0.5;
    const rotationScore = icpMetrics.rotationMagnitude > opts.rotationRange.min ? 1 : 0.5;

    const confidence = (errorScore * 0.5 + translationScore * 0.3 + rotationScore * 0.2);

    return {
      nodeId: movingNodeId,
      stage: 'confidence',
      passed: true,
      reason: `Confidence: ${(confidence * 100).toFixed(1)}%`,
      metrics: {
        ...icpMetrics,
        confidence,
      },
    };
  }

  /**
   * Helper: Compute bounding box
   */
  private static computeBounds(points: BABYLON.Vector3[]): { min: BABYLON.Vector3; max: BABYLON.Vector3; size: BABYLON.Vector3 } {
    if (points.length === 0) {
      const zero = BABYLON.Vector3.Zero();
      return { min: zero, max: zero, size: zero };
    }

    const min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    const max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    for (const p of points) {
      min.x = Math.min(min.x, p.x);
      min.y = Math.min(min.y, p.y);
      min.z = Math.min(min.z, p.z);
      max.x = Math.max(max.x, p.x);
      max.y = Math.max(max.y, p.y);
      max.z = Math.max(max.z, p.z);
    }

    return { min, max, size: max.subtract(min) };
  }

  /**
   * Helper: Compute centroid
   */
  private static computeCentroid(points: BABYLON.Vector3[]): BABYLON.Vector3 {
    if (points.length === 0) return BABYLON.Vector3.Zero();

    const sum = points.reduce((acc, p) => acc.add(p), BABYLON.Vector3.Zero());
    return sum.scale(1 / points.length);
  }

  /**
   * Helper: Downsample point cloud to target count
   */
  private static downsample(points: BABYLON.Vector3[], targetCount: number): BABYLON.Vector3[] {
    if (points.length <= targetCount) return points;

    const stride = Math.floor(points.length / targetCount);
    const downsampled: BABYLON.Vector3[] = [];

    for (let i = 0; i < points.length; i += stride) {
      if (downsampled.length >= targetCount) break;
      downsampled.push(points[i]);
    }

    return downsampled;
  }
}
