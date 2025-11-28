import * as BABYLON from '@babylonjs/core';
import type { ICPResult } from './ICP';
import type { JointDefinitionOutput } from '../io/Schemas';
import { decomposeTransform, solveOrbitBasedPivot } from '../kinematics/JointMath';


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
  /** From vector for visualization (pivot → start, projected to plane) - hinge only */
  fromVector?: BABYLON.Vector3;
  /** To vector for visualization (pivot → end, projected to plane) - hinge only */
  toVector?: BABYLON.Vector3;
}

/**
 * Configuration for joint extraction heuristics.
 */
export interface JointExtractionOptions {
  /**
   * Minimum translation magnitude (m) to classify as prismatic joint.
   * Below this threshold, pure rotation is assumed.
   * Default: 0.005 (5mm)
   */
  translationThreshold?: number;

  /**
   * Minimum rotation angle (radians) to classify as hinge joint.
   * Below this threshold, pure translation is assumed.
   * Default: 0.0175 (≈1°)
   */
  rotationThreshold?: number;

  /**
   * Maximum residual error (m) to accept ICP result as valid.
   * Default: 0.01 (1cm)
   */
  maxResidualError?: number;
}

const DEFAULT_EXTRACTION_OPTIONS: Required<JointExtractionOptions> = {
  translationThreshold: 0.005, // 5mm - spec says MIN_TRANSLATION ≈ 5mm
  rotationThreshold: 0.0175,   // ~1 degree - spec says MIN_ROTATION ≈ 1°
  maxResidualError: 0.01,
};

/**
 * Extract joint definition from ICP alignment result.
 *
 * **ORBIT-BASED CIRCLE FIT ALGORITHM (NO CENTROID ANCHORING)**
 *
 * Algorithm:
 * 1. Decompose ICP transform into translation + rotation (for classification only)
 * 2. Classify joint type based on thresholds:
 *    - rotation > MIN_ROTATION → candidate revolute
 *    - no rotation + translation > MIN_TRANSLATION → candidate prismatic
 *    - otherwise → fixed/noise
 * 3. For revolute joints:
 *    - Generate orbits by repeatedly applying T_icp to sample points
 *    - Fit 2D circle to each orbit via PCA plane + Kåsa method
 *    - Combine pivot estimates with weighted average
 *    - Compute fromVector/toVector for visualization
 * 4. For prismatic joints:
 *    - Use translation direction as axis
 *    - Compute mean of retracted points as anchor
 *
 * NO CENTROID ANCHORING for revolute pivots - all geometry from orbits.
 *
 * @param icpResult - Result from ICP alignment (retracted → extended)
 * @param retractedPoints - Point cloud in retracted state
 * @param options - Configuration for joint extraction heuristics
 * @returns Joint fit result with type, axis, anchor, fromVector, toVector
 */
export function extractJointFromTransform(
  icpResult: ICPResult,
  retractedPoints: BABYLON.Vector3[],
  options: JointExtractionOptions = {}
): JointFitResult | null {
  const opts = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };

  // Guard: need minimum points
  if (retractedPoints.length < 3) {
    console.warn('[JointExtractor] Insufficient points for joint extraction');
    return null;
  }

  // Decompose transform for classification
  const { translation, axis: rotationAxis, angle: rotationAngle } = decomposeTransform(icpResult.transform);

  const translationMagnitude = translation.length();
  const rotationMagnitude = Math.abs(rotationAngle);

  // Classification thresholds (from spec)
  const isRotating = rotationMagnitude > opts.rotationThreshold;

  // For hinges, only parallel-to-axis translation counts as "real" translation
  let effectiveTranslation = translationMagnitude;
  if (isRotating && translationMagnitude > 1e-6) {
    const normalizedAxis = rotationAxis.normalize();
    const parallelComponent = Math.abs(BABYLON.Vector3.Dot(translation, normalizedAxis));
    effectiveTranslation = parallelComponent;
  }

  const isTranslating = effectiveTranslation > opts.translationThreshold;

  // Classification logic
  if (!isRotating && !isTranslating) {
    console.warn('[JointExtractor] No significant motion detected, treating as fixed');
    return null;
  }

  // PRISMATIC: no rotation + translation
  if (!isRotating && isTranslating) {
    const mean = retractedPoints.reduce((acc, p) => acc.add(p), BABYLON.Vector3.Zero())
      .scale(1 / retractedPoints.length);

    return {
      type: 'prismatic',
      axis: translation.normalize(),
      anchor: mean,
      magnitude: translationMagnitude,
      confidence: 0.9,
      residualError: icpResult.rmsError,
    };
  }

  // REVOLUTE: rotation present - use orbit-based solver
  const orbitResult = solveOrbitBasedPivot(
    retractedPoints,
    icpResult.transform,
    rotationAxis,
    rotationAngle
  );

  if (!orbitResult) {
    console.warn('[JointExtractor] Orbit-based pivot solving failed');
    return null;
  }

  // Adjust confidence based on ICP residual error
  let confidence = orbitResult.confidence;
  if (icpResult.rmsError > opts.maxResidualError) {
    confidence *= 0.5;
    console.warn(`[JointExtractor] High ICP error: ${icpResult.rmsError.toFixed(4)}m`);
  }

  // Mixed motion warning (screw joint)
  if (isRotating && isTranslating) {
    confidence *= 0.7;
    console.warn('[JointExtractor] Mixed rotation+translation detected (screw-like), choosing revolute');
  }

  return {
    type: 'hinge',
    axis: orbitResult.axis,
    anchor: orbitResult.pivot,
    magnitude: orbitResult.angle,
    confidence,
    residualError: icpResult.rmsError,
    fromVector: orbitResult.fromVector,
    toVector: orbitResult.toVector,
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
 * @param icpResults - Array of ICP results with metadata
 * @param options - Joint extraction options
 * @returns Array of joint definitions
 */
export function batchExtractJoints(
  icpResults: Array<{
    icpResult: ICPResult;
    retractedPoints: BABYLON.Vector3[];
    jointId: string;
    parentId: string;
    childId: string;
  }>,
  options: JointExtractionOptions = {}
): JointDefinitionOutput[] {
  const joints: JointDefinitionOutput[] = [];

  for (const { icpResult, retractedPoints, jointId, parentId, childId } of icpResults) {
    if (!icpResult.success) {
      console.warn(`[JointExtractor] Skipping failed ICP for joint ${jointId}`);
      continue;
    }

    const fitResult = extractJointFromTransform(icpResult, retractedPoints, options);

    if (!fitResult) {
      console.warn(`[JointExtractor] No joint detected for ${jointId}, skipping`);
      continue;
    }

    if (fitResult.confidence < 0.3) {
      console.warn(`[JointExtractor] Low confidence for joint ${jointId}, skipping`);
      continue;
    }

    const jointDef = convertToJointDefinition(fitResult, jointId, parentId, childId);
    joints.push(jointDef);

    console.log(
      `[JointExtractor] Extracted ${fitResult.type} joint '${jointId}': ` +
      `magnitude=${fitResult.magnitude.toFixed(4)}, confidence=${fitResult.confidence.toFixed(2)}`
    );
  }

  return joints;
}
