// Factory Piping System - Validation Helpers
// Owner: Agent 1 (George) - Architecture Lead
// Pure helper functions for validation - no Babylon dependencies

import {
  PipingSegment,
  PipingNode,
} from './pipingTypes';
import {
  computeApproxSegmentLength,
  isSegmentTooShort,
} from './pipingRules';

/**
 * Warning types for piping segments
 */
export type PipingWarningType = 'too_short' | 'no_insulation_steam';

/**
 * A validation warning for a piping element
 */
export interface PipingValidationWarning {
  /** Type of warning */
  type: PipingWarningType;
  /** Human-readable message */
  message: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'error';
}

/**
 * Get validation warnings for a segment
 *
 * @param segment - The segment to validate
 * @param nodes - All nodes in the network (to look up positions)
 * @returns Array of warnings (empty if no issues)
 */
export function getSegmentWarnings(
  segment: PipingSegment,
  nodes: PipingNode[]
): PipingValidationWarning[] {
  const warnings: PipingValidationWarning[] = [];

  // Find the nodes for this segment
  const fromNode = nodes.find((n) => n.id === segment.fromNodeId);
  const toNode = nodes.find((n) => n.id === segment.toNodeId);

  // Guard: Can't validate if nodes are missing
  if (fromNode === undefined || toNode === undefined) {
    return warnings;
  }

  // Check if segment is too short
  const length = computeApproxSegmentLength(segment, nodes);
  const tooShort = isSegmentTooShort(length, segment.nominalDiameterMm);

  if (tooShort) {
    warnings.push({
      type: 'too_short',
      message: `Segment is very short (${length.toFixed(2)}m). Consider increasing length or diameter.`,
      severity: 'warning',
    });
  }

  // Check steam pipes without insulation
  if (fromNode.serviceType === 'steam' && !segment.hasInsulation) {
    warnings.push({
      type: 'no_insulation_steam',
      message: 'Steam pipe without insulation. Consider adding insulation to prevent heat loss and burns.',
      severity: 'warning',
    });
  }

  return warnings;
}

/**
 * Get all warnings for all segments in a network
 *
 * @param segments - All segments to validate
 * @param nodes - All nodes in the network
 * @returns Map of segment ID to warnings
 */
export function getAllSegmentWarnings(
  segments: PipingSegment[],
  nodes: PipingNode[]
): Map<string, PipingValidationWarning[]> {
  const warningsMap = new Map<string, PipingValidationWarning[]>();

  for (const segment of segments) {
    const warnings = getSegmentWarnings(segment, nodes);

    if (warnings.length === 0) {
      continue;
    }

    warningsMap.set(segment.id, warnings);
  }

  return warningsMap;
}
