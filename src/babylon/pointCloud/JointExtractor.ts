import * as BABYLON from '@babylonjs/core';
import type { ICPResult } from './ICP';
import type { JointDefinitionOutput } from '../io/Schemas';
import { decomposeTransform, solvePivotPoint } from '../kinematics/JointMath';


/**
 * Result of joint extraction from ICP transform.
 */
export interface JointFitResult {
  /** Joint type inferred from transform */
  type: 'hinge' | 'prismatic';
  /** Axis of rotation/translation in world space */
  axis: BABYLON.Vector3;
  /** Anchor point in world space */
  anchor: BABYLON.Vector3;
  /** Magnitude of motion (radians for hinge, meters for prismatic) */
  magnitude: number;
  /** Confidence score (0-1) based on transform decomposition quality */
  confidence: number;
  /** Residual error from ICP (meters) */
  residualError: number;
}

/**
 * Configuration for joint extraction heuristics.
 */
export interface JointExtractionOptions {
  /**
   * Minimum translation magnitude (m) to classify as prismatic joint.
   * Below this threshold, pure rotation is assumed.
   * Default: 0.001 (1mm)
   */
  translationThreshold?: number;

  /**
   * Minimum rotation angle (radians) to classify as hinge joint.
   * Below this threshold, pure translation is assumed.
   * Default: 0.05 (≈2.86°)
   */
  rotationThreshold?: number;

  /**
   * Maximum residual error (m) to accept ICP result as valid.
   * Default: 0.01 (1cm)
   */
  maxResidualError?: number;

  /**
   * Anchor point estimation strategy.
   * - 'centroid': Use centroid of moving points
   * - 'closest_to_origin': Use point closest to world origin
   * - 'axis_projection': Project centroid onto rotation axis
   * Default: 'axis_projection'
   */
  anchorStrategy?: 'centroid' | 'closest_to_origin' | 'axis_projection';
}

const DEFAULT_EXTRACTION_OPTIONS: Required<JointExtractionOptions> = {
  translationThreshold: 0.001,
  rotationThreshold: 0.05,
  maxResidualError: 0.01,
  anchorStrategy: 'axis_projection',
};

/**
 * Compute hinge anchor point using Circle Fit algorithm.
 * 
 * Samples high-leverage points (furthest from centroid) and uses least-squares
 * solver to find the true pivot point from perpendicular bisector planes.
 * 
 * @param axis - Normalized rotation axis
 * @param movingPointsCentroid - Centroid of retracted point cloud
 * @param retractedPoints - Full point cloud in retracted state
 * @param transform - ICP transform matrix (retracted → extended)
 * @returns Computed pivot point in world space
 */
function computeHingeAnchor(
  axis: BABYLON.Vector3,
  movingPointsCentroid: BABYLON.Vector3,
  retractedPoints: BABYLON.Vector3[],
  transform: BABYLON.Matrix
): BABYLON.Vector3 {
  // Sample high-leverage points (furthest from centroid for better conditioning)
  const NUM_SAMPLES = Math.min(20, retractedPoints.length);
  const pointsWithDistance = retractedPoints.map(p => ({
    point: p,
    distance: BABYLON.Vector3.Distance(p, movingPointsCentroid)
  }));

  // Sort by distance descending and take top N
  pointsWithDistance.sort((a, b) => b.distance - a.distance);
  const highLeveragePoints = pointsWithDistance.slice(0, NUM_SAMPLES).map(pd => pd.point);

  // Create point pairs: [p_i, p'_i] where p'_i = T * p_i
  const pairs: [BABYLON.Vector3, BABYLON.Vector3][] = highLeveragePoints.map(p => {
    const pPrime = BABYLON.Vector3.TransformCoordinates(p, transform);
    return [p, pPrime];
  });

  // Solve for pivot using Circle Fit algorithm
  return solvePivotPoint(pairs, axis, movingPointsCentroid);
}

/**
 * Extract joint definition from ICP alignment result.
 *
 * **Algorithm:**
 * 1. Decompose ICP transform into translation + rotation
 * 2. Classify joint type:
 *    - If translation >> rotation → prismatic
 *    - If rotation >> translation → hinge
 *    - If both significant → screw joint (not supported, fallback to dominant)
 * 3. Extract axis:
 *    - Prismatic: normalized translation vector
 *    - Hinge: rotation axis from quaternion
 * 4. Compute anchor point:
 *    - Prismatic: centroid of moving points
 *    - Hinge: Circle Fit solver (least squares intersection of bisector planes)
 * 5. Estimate limits from magnitude
 *
 * **Limitations:**
 * - Assumes single DOF motion (prismatic OR hinge, not screw)
 * - Does not handle spherical joints or other multi-DOF joints
 *
 * @param icpResult - Result from ICP alignment (retracted → extended)
 * @param movingPointsCentroid - Centroid of moving part point cloud
 * @param retractedPoints - Full point cloud in retracted state (required for Circle Fit)
 * @param options - Configuration for joint extraction heuristics
 * @returns Joint fit result with type, axis, anchor, and confidence
 *
 * @example
 * ```typescript
 * const retractedPoints = capturePointCloud(scene, movingNodeId, 'retracted');
 * const extendedPoints = capturePointCloud(scene, movingNodeId, 'extended');
 * const icpResult = ICP.align(retractedPoints, extendedPoints);
 *
 * const centroid = retractedPoints.reduce((sum, p) => sum.add(p), Vector3.Zero())
 *   .scale(1 / retractedPoints.length);
 *
 * const joint = extractJointFromTransform(icpResult, centroid, retractedPoints);
 * if (joint.confidence > 0.7) {
 *   console.log(`Detected ${joint.type} joint: ${joint.magnitude}m`);
 * }
 * ```
 */
export function extractJointFromTransform(
  icpResult: ICPResult,
  movingPointsCentroid: BABYLON.Vector3,
  retractedPoints: BABYLON.Vector3[],
  options: JointExtractionOptions = {}
): JointFitResult | null {
  const opts = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };

  // Decompose transform using JointMath helper
  const { translation, axis: rotationAxis, angle: rotationAngle } = decomposeTransform(icpResult.transform);

  const translationMagnitude = translation.length();
  const rotationMagnitude = Math.abs(rotationAngle);

  // Classify joint type
  let type: 'hinge' | 'prismatic';
  let axis: BABYLON.Vector3;
  let anchor: BABYLON.Vector3;
  let magnitude: number;
  let confidence: number;

  // For distant hinges, the total translation can be large due to circular motion,
  // but the translation parallel to the rotation axis should be small.
  // We use parallel translation to distinguish screw joints from pure rotations.
  const isHinge = rotationMagnitude > opts.rotationThreshold;
  let effectiveTranslation = translationMagnitude;

  if (isHinge && translationMagnitude > 1e-6) {
    // Calculate translation component parallel to rotation axis
    const normalizedRotationAxis = rotationAxis.normalize();
    const parallelTranslation = BABYLON.Vector3.Dot(translation, normalizedRotationAxis);
    effectiveTranslation = Math.abs(parallelTranslation);
  }

  const isPrismatic = effectiveTranslation > opts.translationThreshold;

  if (isPrismatic && !isHinge) {
    // Pure prismatic motion
    type = 'prismatic';
    axis = translation.normalize();
    anchor = movingPointsCentroid.clone();
    magnitude = translationMagnitude;
    confidence = 0.9; // High confidence for pure translation
  } else if (isHinge && !isPrismatic) {
    // Pure hinge motion
    type = 'hinge';
    axis = rotationAxis.normalize();
    // Use Circle Fit solver
    anchor = computeHingeAnchor(axis, movingPointsCentroid, retractedPoints, icpResult.transform);
    magnitude = rotationAngle;
    confidence = 0.9; // High confidence for pure rotation
  } else if (isPrismatic && isHinge) {
    // Mixed motion (screw joint) - choose dominant component
    if (effectiveTranslation / opts.translationThreshold > rotationMagnitude / opts.rotationThreshold) {
      // Translation dominates
      type = 'prismatic';
      axis = translation.normalize();
      anchor = movingPointsCentroid.clone();
      magnitude = translationMagnitude;
      confidence = 0.6; // Lower confidence due to mixed motion
      console.warn('[JointExtractor] Mixed translation+rotation detected, choosing prismatic (dominant)');
    } else {
      // Rotation dominates
      type = 'hinge';
      axis = rotationAxis.normalize();
      // Use Circle Fit solver
      anchor = computeHingeAnchor(axis, movingPointsCentroid, retractedPoints, icpResult.transform);
      magnitude = rotationAngle;
      confidence = 0.6; // Lower confidence due to mixed motion
      console.warn('[JointExtractor] Mixed translation+rotation detected, choosing hinge (dominant)');
    }
  } else {
    // Neither translation nor rotation significant - this is not a joint, it's a fixed part
    // Return null to indicate no joint should be created
    console.warn('[JointExtractor] No significant motion detected, treating as fixed (no joint)');
    return null;
  }

  // Adjust confidence based on ICP residual error
  if (icpResult.rmsError > opts.maxResidualError) {
    confidence *= 0.5; // Halve confidence if error exceeds threshold
    console.warn(`[JointExtractor] High ICP residual error: ${icpResult.rmsError.toFixed(4)}m (threshold: ${opts.maxResidualError}m)`);
  }

  return {
    type,
    axis,
    anchor,
    magnitude,
    confidence,
    residualError: icpResult.rmsError,
  };
}


/**
 * Convert joint fit result to full joint definition output.
 *
 * @param fitResult - Joint fit result from extractJointFromTransform
 * @param jointId - Unique identifier for this joint
 * @param parentId - Parent node ID in kinematic tree
 * @param childId - Child node ID (moving part)
 * @param limitMultiplier - Safety factor for joint limits (e.g., 1.2 = 20% margin)
 * @returns Complete joint definition ready for export
 *
 * @example
 * ```typescript
 * const fitResult = extractJointFromTransform(icpResult, centroid);
 * const jointDef = convertToJointDefinition(
 *   fitResult,
 *   'gripper_jaw_1',
 *   'gripper_base',
 *   'gripper_jaw',
 *   1.1  // 10% margin on limits
 * );
 *
 * // Export to JSON
 * const json = JSON.stringify(jointDef, null, 2);
 * ```
 */
export function convertToJointDefinition(
  fitResult: JointFitResult,
  jointId: string,
  parentId: string,
  childId: string,
  limitMultiplier: number = 1.0
): JointDefinitionOutput {
  // Estimate limits from magnitude with safety margin
  const maxLimit = fitResult.magnitude * limitMultiplier;
  const minLimit = 0; // Assume retracted state is zero position

  return {
    id: jointId,
    type: fitResult.type,
    parentId,
    childId,
    axisWorld: fitResult.axis,
    anchorWorld: fitResult.anchor,
    limits: {
      lower: minLimit,
      upper: maxLimit,
    },
  };
}

/**
 * Batch extract joints from multiple ICP results.
 *
 * Useful for processing multiple tool units in parallel.
 *
 * @param icpResults - Array of ICP results with metadata
 * @param options - Joint extraction options
 * @returns Array of joint definitions
 *
 * @example
 * ```typescript
 * const results = [
 *   { icpResult, centroid, jointId: 'clamp1', parentId: 'fixture', childId: 'clamp1_jaw' },
 *   { icpResult: icpResult2, centroid: centroid2, jointId: 'pin1', parentId: 'fixture', childId: 'pin1' }
 * ];
 *
 * const joints = batchExtractJoints(results);
 * console.log(`Extracted ${joints.length} joints`);
 * ```
 */
export function batchExtractJoints(
  icpResults: Array<{
    icpResult: ICPResult;
    centroid: BABYLON.Vector3;
    retractedPoints: BABYLON.Vector3[];
    jointId: string;
    parentId: string;
    childId: string;
  }>,
  options: JointExtractionOptions = {}
): JointDefinitionOutput[] {
  const joints: JointDefinitionOutput[] = [];

  for (const { icpResult, centroid, retractedPoints, jointId, parentId, childId } of icpResults) {
    if (!icpResult.success) {
      console.warn(`[JointExtractor] Skipping failed ICP result for joint ${jointId}`);
      continue;
    }

    const fitResult = extractJointFromTransform(icpResult, centroid, retractedPoints, options);


    if (!fitResult) {
      console.warn(`[JointExtractor] No joint detected for ${jointId} (insufficient motion), skipping`);
      continue;
    }

    if (fitResult.confidence < 0.3) {
      console.warn(`[JointExtractor] Low confidence (${fitResult.confidence.toFixed(2)}) for joint ${jointId}, skipping`);
      continue;
    }

    const jointDef = convertToJointDefinition(fitResult, jointId, parentId, childId);
    joints.push(jointDef);

    console.log(
      `[JointExtractor] Extracted ${fitResult.type} joint '${jointId}': ` +
      `magnitude=${fitResult.magnitude.toFixed(4)}, ` +
      `confidence=${fitResult.confidence.toFixed(2)}, ` +
      `error=${fitResult.residualError.toFixed(4)}m`
    );
  }

  return joints;
}
