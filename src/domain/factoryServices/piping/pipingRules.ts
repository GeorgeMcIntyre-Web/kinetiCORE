// Factory Piping System - Mechanical Rules
// Owner: Agent 1 (George) - Architecture Lead
// Pure helper functions - no Babylon dependencies

import {
  PipingServiceType,
  PipingSegment,
  PipingNode,
  Position3D,
} from './pipingTypes';

/**
 * Get default pipe diameter for a service type (in millimeters)
 * These are sensible defaults for factory installations
 */
export function getDefaultDiameter(serviceType: PipingServiceType): number {
  switch (serviceType) {
    case 'water':
      return 40; // 1.5" nominal
    case 'air':
      return 25; // 1" nominal
    case 'steam':
      return 50; // 2" nominal
    case 'vacuum':
      return 40; // 1.5" nominal
    case 'cable_tray':
      return 100; // 100mm wide tray
    case 'electrical':
      return 25; // 1" conduit
    case 'custom':
      return 40; // Default medium size
    default:
      return 40;
  }
}

/**
 * Calculate minimum bend radius for a pipe diameter
 * Standard rule: min bend radius = 3 × diameter
 *
 * @param diameterMm - Nominal diameter in millimeters
 * @returns Minimum bend radius in millimeters
 */
export function getMinBendRadius(diameterMm: number): number {
  return 3 * diameterMm;
}

/**
 * Calculate the straight-line distance between two positions
 *
 * @param p1 - First position
 * @param p2 - Second position
 * @returns Distance in scene units (typically meters)
 */
export function calculateDistance(p1: Position3D, p2: Position3D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate approximate length of a segment
 * For now, this is just straight-line distance
 * In future, could account for bends and fittings
 *
 * @param segment - The segment to measure
 * @param nodes - All nodes in the network (to look up positions)
 * @returns Approximate length in scene units
 */
export function computeApproxSegmentLength(
  segment: PipingSegment,
  nodes: PipingNode[]
): number {
  const fromNode = nodes.find((n) => n.id === segment.fromNodeId);
  const toNode = nodes.find((n) => n.id === segment.toNodeId);

  if (fromNode === undefined || toNode === undefined) {
    return 0;
  }

  return calculateDistance(fromNode.position, toNode.position);
}

/**
 * Calculate total length of all segments in a network
 *
 * @param segments - Array of segments
 * @param nodes - Array of nodes
 * @returns Total length in scene units
 */
export function computeTotalNetworkLength(
  segments: PipingSegment[],
  nodes: PipingNode[]
): number {
  return segments.reduce((total, seg) => {
    return total + computeApproxSegmentLength(seg, nodes);
  }, 0);
}

/**
 * Validate if a bend radius is acceptable for a given diameter
 *
 * @param bendRadiusMm - Actual bend radius
 * @param diameterMm - Pipe diameter
 * @returns true if bend radius is acceptable
 */
export function validateBendRadius(
  bendRadiusMm: number,
  diameterMm: number
): boolean {
  const minRadius = getMinBendRadius(diameterMm);
  return bendRadiusMm >= minRadius;
}

/**
 * Suggest standard pipe sizes for a given service type
 * Returns array of common sizes in millimeters
 */
export function getStandardSizes(serviceType: PipingServiceType): number[] {
  switch (serviceType) {
    case 'water':
      return [25, 32, 40, 50, 65, 80]; // DN25 to DN80
    case 'air':
      return [20, 25, 32, 40, 50]; // DN20 to DN50
    case 'steam':
      return [40, 50, 65, 80, 100]; // DN40 to DN100
    case 'vacuum':
      return [32, 40, 50, 65]; // DN32 to DN65
    case 'cable_tray':
      return [100, 150, 200, 300]; // Width in mm
    case 'electrical':
      return [20, 25, 32, 40]; // Conduit sizes
    case 'custom':
      return [25, 40, 50, 80]; // Generic range
    default:
      return [25, 40, 50];
  }
}

/**
 * Check if a segment length is unusually short (might indicate design issue)
 *
 * @param lengthMeters - Segment length in meters
 * @param diameterMm - Pipe diameter in mm
 * @returns true if length seems too short
 */
export function isSegmentTooShort(
  lengthMeters: number,
  diameterMm: number
): boolean {
  // Segment should be at least 2× diameter to be practical
  const minLengthMeters = (2 * diameterMm) / 1000;
  return lengthMeters < minLengthMeters;
}

/**
 * Calculate elevation change between two nodes
 *
 * @param fromNode - Starting node
 * @param toNode - Ending node
 * @returns Elevation change in scene units (positive = upward)
 */
export function calculateElevationChange(
  fromNode: PipingNode,
  toNode: PipingNode
): number {
  // Z-up coordinate system
  return toNode.position.z - fromNode.position.z;
}

/**
 * Calculate slope of a segment in per-mille (‰)
 *
 * @param segment - The segment
 * @param nodes - All nodes in the network
 * @returns Slope in per-mille, or null if calculation fails
 */
export function calculateSegmentSlope(
  segment: PipingSegment,
  nodes: PipingNode[]
): number | null {
  const fromNode = nodes.find((n) => n.id === segment.fromNodeId);
  const toNode = nodes.find((n) => n.id === segment.toNodeId);

  if (fromNode === undefined || toNode === undefined) {
    return null;
  }

  const horizontalDistance = Math.sqrt(
    Math.pow(toNode.position.x - fromNode.position.x, 2) +
      Math.pow(toNode.position.y - fromNode.position.y, 2)
  );

  if (horizontalDistance < 0.001) {
    // Vertical pipe or zero length
    return null;
  }

  const elevationChange = calculateElevationChange(fromNode, toNode);
  const slopePerMille = (elevationChange / horizontalDistance) * 1000;

  return slopePerMille;
}

/**
 * Estimate number of supports needed for a segment
 * Based on typical support spacing rules
 *
 * @param lengthMeters - Segment length
 * @param diameterMm - Pipe diameter
 * @returns Estimated number of supports
 */
export function estimateSupportsNeeded(
  lengthMeters: number,
  diameterMm: number
): number {
  // Typical support spacing rules:
  // - Small pipes (<50mm): support every 2-3m
  // - Medium pipes (50-80mm): support every 3-4m
  // - Large pipes (>80mm): support every 4-5m

  let spacingMeters: number;

  if (diameterMm < 50) {
    spacingMeters = 2.5;
  } else if (diameterMm < 80) {
    spacingMeters = 3.5;
  } else {
    spacingMeters = 4.5;
  }

  const numSupports = Math.ceil(lengthMeters / spacingMeters);

  // Always need at least one support for any segment
  return Math.max(1, numSupports);
}
