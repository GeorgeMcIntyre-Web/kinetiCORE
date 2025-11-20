/**
 * Joint pair detection within tooling units.
 * 
 * Algorithm:
 * 1. For each unit, compute features for all nodes (centroid, bbox, level coord, main axis)
 * 2. Find candidate pairs at the same level with overlapping footprints
 * 3. Score pairs based on gap, overlap, orientation, and size similarity
 * 4. Filter and rank pairs, keeping only top candidates per unit
 */

import type {
  ToolingUnit,
  ToolingNodeGeometry,
  ToolingStructure,
  JointPair,
  NodeCloudFeatures,
  Vector3,
  PrecomputedNodeFeatures,
} from './types';
import {
  computeBboxExtents,
  findLongestAxis,
  normalize,
  dot,
  distance as _distance,
  compute2DOverlapRatio,
  computeBboxOverlapRatio as _computeBboxOverlapRatio,
} from './pointClouds';

/**
 * Options for joint pair detection.
 */
export interface JointPairDetectionOptions {
  /** Level axis (default: Z-up). Default: { x: 0, y: 0, z: 1 } */
  levelAxis?: Vector3;
  /** Maximum level difference (fraction of unit height). Default: 0.1 */
  maxLevelDifference?: number;
  /** Minimum 2D overlap ratio. Default: 0.3 */
  minOverlapRatio?: number;
  /** Minimum gap along axis (meters). Default: 0.001 (1mm) */
  minGap?: number;
  /** Maximum gap along axis (meters). Default: 0.1 (100mm) */
  maxGap?: number;
  /** Minimum node size (meters, bbox diagonal). Default: 0.005 (5mm) */
  minNodeSize?: number;
  /** Maximum size ratio between nodes in a pair. Default: 50 */
  maxSizeRatio?: number;
  /** Minimum score threshold. Default: 0.3 */
  minScore?: number;
  /** Maximum pairs per unit. Default: 4 */
  maxPairsPerUnit?: number;
  /** Weight for overlap in scoring. Default: 0.4 */
  weightOverlap?: number;
  /** Weight for gap in scoring. Default: 0.3 */
  weightGap?: number;
  /** Weight for size similarity in scoring. Default: 0.2 */
  weightSize?: number;
  /** Weight for orientation in scoring. Default: 0.1 */
  weightOrientation?: number;
}

const DEFAULT_OPTIONS: Required<JointPairDetectionOptions> = {
  levelAxis: { x: 0, y: 0, z: 1 },
  maxLevelDifference: 0.1,
  minOverlapRatio: 0.3,
  minGap: 0.001,
  maxGap: 0.1,
  minNodeSize: 0.005,
  maxSizeRatio: 50,
  minScore: 0.3,
  maxPairsPerUnit: 4,
  weightOverlap: 0.4,
  weightGap: 0.3,
  weightSize: 0.2,
  weightOrientation: 0.1,
};

/**
 * Find joint pairs for all units.
 * 
 * @param units - Detected tooling units
 * @param geometryIndex - Map of nodeId -> point cloud geometry
 * @param structure - Tooling structure
 * @param options - Detection options
 * @param precomputedFeatures - Optional precomputed features (from external tools)
 * @returns List of detected joint pairs
 */
export function findJointPairsForUnits(
  units: ToolingUnit[],
  geometryIndex: Map<string, ToolingNodeGeometry>,
  structure: ToolingStructure,
  options: JointPairDetectionOptions = {},
  precomputedFeatures?: Map<string, PrecomputedNodeFeatures>
): JointPair[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allPairs: JointPair[] = [];

  for (const unit of units) {
    const unitPairs = findJointPairsForUnit(
      unit,
      geometryIndex,
      structure,
      opts,
      precomputedFeatures
    );
    allPairs.push(...unitPairs);
  }

  return allPairs;
}

/**
 * Find joint pairs for a single unit.
 */
function findJointPairsForUnit(
  unit: ToolingUnit,
  geometryIndex: Map<string, ToolingNodeGeometry>,
  structure: ToolingStructure,
  opts: Required<JointPairDetectionOptions>,
  precomputedFeatures?: Map<string, PrecomputedNodeFeatures>
): JointPair[] {
  const unitId = unit.unitId;
  // Compute features for all nodes in this unit
  const features = computeNodeFeatures(unit, geometryIndex, structure, opts, precomputedFeatures);

  if (features.length < 2) return [];

  // Compute unit height along level axis
  const unitHeight = computeUnitHeight(unit, opts.levelAxis);

  // Build candidate pairs at same level
  const candidates: Array<{ nodeA: NodeCloudFeatures; nodeB: NodeCloudFeatures }> = [];

  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const featA = features[i];
      const featB = features[j];

      // Guard: check level difference
      const levelDiff = Math.abs(featA.levelCoord - featB.levelCoord);
      const maxLevelDiff = unitHeight * opts.maxLevelDifference;
      
      if (levelDiff > maxLevelDiff) continue;

      // Guard: check 2D overlap
      const geometryA = geometryIndex.get(featA.nodeId);
      const geometryB = geometryIndex.get(featB.nodeId);
      
      if (!geometryA || !geometryB) continue;

      const overlap2D = compute2DOverlapRatio(geometryA.points, geometryB.points, opts.levelAxis);
      if (overlap2D < opts.minOverlapRatio) continue;

      // Guard: check node sizes
      const sizeA = computeNodeSize(featA);
      const sizeB = computeNodeSize(featB);
      
      if (sizeA < opts.minNodeSize || sizeB < opts.minNodeSize) continue;

      const sizeRatio = Math.max(sizeA, sizeB) / Math.min(sizeA, sizeB);
      if (sizeRatio > opts.maxSizeRatio) continue;

      candidates.push({ nodeA: featA, nodeB: featB });
    }
  }

  // Score and filter candidates
  const scoredPairs: JointPair[] = [];

  for (const { nodeA, nodeB } of candidates) {
    const geometryA = geometryIndex.get(nodeA.nodeId);
    const geometryB = geometryIndex.get(nodeB.nodeId);
    
    if (!geometryA || !geometryB) continue;

    const pair = scoreJointPair(nodeA, nodeB, geometryA, geometryB, unitId, opts);
    
    if (!pair) continue;
    if (pair.score < opts.minScore) continue;

    scoredPairs.push(pair);
  }

  // Sort by score and keep top N
  scoredPairs.sort((a, b) => b.score - a.score);
  
  return scoredPairs.slice(0, opts.maxPairsPerUnit);
}

/**
 * Compute features for all nodes in a unit.
 */
function computeNodeFeatures(
  unit: ToolingUnit,
  geometryIndex: Map<string, ToolingNodeGeometry>,
  _structure: ToolingStructure,
  opts: Required<JointPairDetectionOptions>,
  precomputedFeatures?: Map<string, PrecomputedNodeFeatures>
): NodeCloudFeatures[] {
  const features: NodeCloudFeatures[] = [];

  for (const nodeId of unit.nodeIds) {
    const geometry = geometryIndex.get(nodeId);
    if (!geometry) continue;

    const precomputed = precomputedFeatures?.get(nodeId);
    
    const levelCoord = dot(geometry.centroid, opts.levelAxis);
    const mainAxis = precomputed?.dominantAxes?.[0] || findLongestAxis(geometry.bbox);
    const size = computeBboxExtents(geometry.bbox);

    features.push({
      nodeId,
      centroid: geometry.centroid,
      bbox: geometry.bbox,
      levelCoord,
      mainAxis: normalize(mainAxis),
      size,
    });
  }

  return features;
}

/**
 * Compute unit height along level axis.
 */
function computeUnitHeight(unit: ToolingUnit, levelAxis: Vector3): number {
  const normalizedAxis = normalize(levelAxis);
  
  const minProj = dot(unit.bbox.min, normalizedAxis);
  const maxProj = dot(unit.bbox.max, normalizedAxis);
  
  return Math.abs(maxProj - minProj);
}

/**
 * Compute node size (bbox diagonal).
 */
function computeNodeSize(features: NodeCloudFeatures): number {
  const dx = features.bbox.max.x - features.bbox.min.x;
  const dy = features.bbox.max.y - features.bbox.min.y;
  const dz = features.bbox.max.z - features.bbox.min.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Score a joint pair candidate.
 */
function scoreJointPair(
  featA: NodeCloudFeatures,
  featB: NodeCloudFeatures,
  geometryA: ToolingNodeGeometry,
  geometryB: ToolingNodeGeometry,
  unitId: string,
  opts: Required<JointPairDetectionOptions>
): JointPair | null {
  // Estimate clamp axis
  const axisCandidate = normalize({
    x: featB.centroid.x - featA.centroid.x,
    y: featB.centroid.y - featA.centroid.y,
    z: featB.centroid.z - featA.centroid.z,
  });

  // If axis is parallel to level axis, reject (we want perpendicular)
  const axisDotLevel = Math.abs(dot(axisCandidate, opts.levelAxis));
  if (axisDotLevel > 0.9) return null;

  // Compute gap along axis
  const gap = computeGapAlongAxis(geometryA.points, geometryB.points, axisCandidate);
  
  if (gap < opts.minGap || gap > opts.maxGap) return null;

  // Compute 2D overlap
  const overlap2D = compute2DOverlapRatio(geometryA.points, geometryB.points, axisCandidate);
  if (overlap2D < opts.minOverlapRatio) return null;

  // Compute orientation compatibility
  const orientationScore = computeOrientationScore(featA.mainAxis, featB.mainAxis, axisCandidate);

  // Compute size similarity
  const sizeA = computeNodeSize(featA);
  const sizeB = computeNodeSize(featB);
  const sizeSimilarity = Math.min(sizeA, sizeB) / Math.max(sizeA, sizeB);

  // Compute gap score (normalized, higher is better for reasonable gaps)
  const gapScore = 1.0 - Math.min(1.0, (gap - opts.minGap) / (opts.maxGap - opts.minGap));

  // Combine scores
  const score =
    opts.weightOverlap * overlap2D +
    opts.weightGap * gapScore +
    opts.weightSize * sizeSimilarity +
    opts.weightOrientation * orientationScore;

  return {
    unitId,
    nodeAId: featA.nodeId,
    nodeBId: featB.nodeId,
    score,
    axis: axisCandidate,
    gap,
    overlapRatio: overlap2D,
  };
}

/**
 * Compute gap between two point clouds along an axis.
 */
function computeGapAlongAxis(pointsA: Vector3[], pointsB: Vector3[], axis: Vector3): number {
  if (pointsA.length === 0 || pointsB.length === 0) return Infinity;

  const normalizedAxis = normalize(axis);

  // Project all points onto axis
  const projA: number[] = pointsA.map(p => dot(p, normalizedAxis));
  const projB: number[] = pointsB.map(p => dot(p, normalizedAxis));

  const minA = Math.min(...projA);
  const maxA = Math.max(...projA);
  const minB = Math.min(...projB);
  const maxB = Math.max(...projB);

  // Compute gap (positive = separation, negative = overlap)
  if (maxA < minB) {
    return minB - maxA; // A is before B
  }
  if (maxB < minA) {
    return minA - maxB; // B is before A
  }

  // Overlap case - return negative gap
  const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
  return -overlap;
}

/**
 * Compute orientation compatibility score (0-1).
 */
function computeOrientationScore(
  mainAxisA: Vector3,
  mainAxisB: Vector3,
  clampAxis: Vector3
): number {
  // Check if main axes are compatible with clamp axis
  // For sliders: axes should be parallel to clamp axis
  // For jaw faces: axes should be orthogonal to clamp axis

  const dotA = Math.abs(dot(mainAxisA, clampAxis));
  const dotB = Math.abs(dot(mainAxisB, clampAxis));
  const dotAB = Math.abs(dot(mainAxisA, mainAxisB));

  // Prefer either both parallel or both orthogonal
  const parallelScore = (dotA + dotB) / 2; // Both parallel to clamp
  const orthogonalScore = ((1 - dotA) + (1 - dotB)) / 2; // Both orthogonal to clamp
  const alignmentScore = dotAB; // A and B aligned with each other

  return Math.max(parallelScore, orthogonalScore) * alignmentScore;
}

