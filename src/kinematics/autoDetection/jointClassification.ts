/**
 * Joint Classification
 * 
 * Classifies joint type (revolute vs prismatic) from ICP results.
 */

import type { ICPResult, JointClassification } from './types';
import { matrixToAxisAngle } from './icp';

/**
 * Classify joint type from ICP result
 * 
 * @param icpResult - ICP alignment result
 * @returns Joint classification with type and parameters
 */
export function classifyJoint(icpResult: ICPResult): JointClassification {
  const MIN_ROTATION_RAD = 0.0175; // ~1 degree
  const MIN_TRANSLATION_M = 0.005; // 5mm

  // Extract rotation and translation
  const axisAngle = matrixToAxisAngle(icpResult.rotation);
  const rotationAngle = Math.abs(axisAngle.angle);
  
  const translationMag = Math.sqrt(
    icpResult.translation[0] ** 2 +
    icpResult.translation[1] ** 2 +
    icpResult.translation[2] ** 2
  );

  // Classification logic
  const isRotating = rotationAngle > MIN_ROTATION_RAD;
  const isTranslating = translationMag > MIN_TRANSLATION_M;

  // If no significant motion, classify as fixed
  if (!isRotating && !isTranslating) {
    return {
      type: 'fixed',
      confidence: 0.5,
    };
  }

  // Prismatic: translation without significant rotation
  if (!isRotating && isTranslating) {
    return {
      type: 'prismatic',
      axis: [
        icpResult.translation[0] / translationMag,
        icpResult.translation[1] / translationMag,
        icpResult.translation[2] / translationMag,
      ] as [number, number, number],
      distance: translationMag,
      confidence: 0.9,
    };
  }

  // Revolute: rotation present
  if (isRotating) {
    return {
      type: 'revolute',
      axis: axisAngle.axis as [number, number, number],
      angle: axisAngle.angle,
      confidence: isTranslating ? 0.8 : 0.95, // Lower confidence if there's also translation (screw joint)
    };
  }

  // Fallback
  return {
    type: 'unknown',
    confidence: 0.5,
  };
}

