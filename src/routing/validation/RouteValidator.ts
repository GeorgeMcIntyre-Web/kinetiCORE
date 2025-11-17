// Route Validator - Comprehensive route validation with visual warnings
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Vector3 } from '../../core/types';
import { Route } from '../core/Route';
import {
  ConstraintViolation,
  ValidationResult,
  RouteConstraints,
  RouteSegment,
} from '../core/types';
import { ConstraintValidator } from '../pathfinding/ConstraintValidator';

const DEFAULT_MIN_NODE_COUNT = 2;
const DEFAULT_MAX_ELEVATION_DELTA = 1.5; // meters
const DEFAULT_MAX_ELEVATION_SPAN = 6; // meters
const DEFAULT_MIN_NODES_FOR_MIXED = 3;
const DEFAULT_FLOOR_SNAP_TOLERANCE = 0.05; // 50mm
const MIN_SEGMENT_LENGTH_TOLERANCE = 0.01; // 10mm
const ORIGIN_VECTOR: Vector3 = { x: 0, y: 0, z: 0 };

/**
 * Enhanced validation result with segment-specific violations
 */
export interface EnhancedValidationResult extends ValidationResult {
  /** Segment-specific violations (segment ID -> violations) */
  segmentViolations: Map<string, ConstraintViolation[]>;
  /** Overall validation status */
  status: 'valid' | 'warning' | 'error';
}

/**
 * RouteValidator provides comprehensive validation for routes
 * Extends ConstraintValidator with additional checks:
 * - Min/max route length
 * - Connection point compatibility
 * - Out of bounds placement
 * - Enhanced visual feedback
 */
export class RouteValidator extends ConstraintValidator {
  /** Minimum route length (meters) */
  private readonly MIN_ROUTE_LENGTH = 0.1;
  /** Maximum route length (meters) - can be overridden by constraints */
  private readonly MAX_ROUTE_LENGTH = 1000;

  /** Scene bounds for out-of-bounds checking (optional) */
  private sceneBounds?: {
    min: Vector3;
    max: Vector3;
  };

  /**
   * Set scene bounds for validation
   */
  setSceneBounds(min: Vector3, max: Vector3): void {
    this.sceneBounds = { min: { ...min }, max: { ...max } };
  }

  /**
   * Comprehensive route validation
   * Returns enhanced validation result with segment-specific violations
   */
  validateRouteEnhanced(
    route: Route,
    obstacles: BABYLON.Mesh[]
  ): EnhancedValidationResult {
    const violations: ConstraintViolation[] = [];
    const segmentViolations = new Map<string, ConstraintViolation[]>();

      // Run base validation
    const baseResult = this.validateRoute(route, obstacles);
    violations.push(...baseResult.violations);

      // Detect degenerate geometry before other checks
      violations.push(...this.checkDegenerateSegments(route, segmentViolations));

    // Check route length
    violations.push(...this.checkRouteLength(route));

      // Check elevation transitions and node counts
      violations.push(...this.checkElevationRules(route));

    // Check connection point compatibility
    violations.push(...this.checkConnectionPoints(route));

    // Check out of bounds
    if (this.sceneBounds) {
      violations.push(...this.checkBounds(route));
    }

    // Check bend radius with more detail
    violations.push(...this.checkBendRadiusDetailed(route.segments, route.constraints, segmentViolations));

    // Check collisions with obstacles
    violations.push(...this.checkCollisions(route, obstacles, segmentViolations));

    // Determine overall status
    const hasErrors = violations.some((v) => v.severity === 'error');
    const hasWarnings = violations.some((v) => v.severity === 'warning');

    const status: 'valid' | 'warning' | 'error' = hasErrors
      ? 'error'
      : hasWarnings
      ? 'warning'
      : 'valid';

    return {
      isValid: violations.length === 0 || !hasErrors,
      violations,
      segmentViolations,
      status,
    };
  }

  private checkDegenerateSegments(
    route: Route,
    segmentViolations: Map<string, ConstraintViolation[]>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const segment of route.segments) {
      if (segment.length > MIN_SEGMENT_LENGTH_TOLERANCE) {
        continue;
      }

      const violation: ConstraintViolation = {
        type: 'topology',
        severity: 'error',
        location: { ...segment.startPoint },
        message: `Segment "${segment.id}" has zero or near-zero length (${segment.length.toFixed(3)}m).`,
      };

      violations.push(violation);
      this.appendSegmentViolation(segmentViolations, segment.id, violation);
    }

    return violations;
  }

  private appendSegmentViolation(
    segmentViolations: Map<string, ConstraintViolation[]>,
    segmentId: string,
    violation: ConstraintViolation
  ): void {
    if (!segmentViolations.has(segmentId)) {
      segmentViolations.set(segmentId, []);
    }
    segmentViolations.get(segmentId)!.push(violation);
  }

  private checkElevationRules(route: Route): ConstraintViolation[] {
    const waypoints = route.getWaypoints();
    const options = this.getElevationRuleOptions(route);
    const result = evaluateElevationProfile(waypoints, options);
    return result.violations;
  }

  private getElevationRuleOptions(route: Route): ElevationRuleOptions {
    const constraints = route.constraints ?? ({} as RouteConstraints);
    return {
      maxElevationDelta: constraints.maxElevationDelta,
      maxElevationSpan: constraints.maxElevationSpan,
      allowMixedElevation: constraints.allowMixedElevation ?? true,
      minNodesForMixedElevation: constraints.minNodesForMixedElevation,
      minNodeCount: constraints.minNodeCount,
      floorSnapTolerance: constraints.floorSnapTolerance,
    };
  }

    /**
   * Check if route length is within valid range
   */
  private checkRouteLength(route: Route): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const totalLength = route.getTotalLength();

    // Check minimum length
    if (totalLength < this.MIN_ROUTE_LENGTH) {
      violations.push({
        type: 'length',
        severity: 'error',
        location: { ...route.source.position },
        message: `Route length ${totalLength.toFixed(2)}m is below minimum ${this.MIN_ROUTE_LENGTH}m`,
      });
    }

    // Check maximum length (use constraint if available, otherwise default)
    const maxLength = route.constraints.maxRunLength || this.MAX_ROUTE_LENGTH;
    if (totalLength > maxLength) {
      violations.push({
        type: 'length',
        severity: 'warning',
        location: { ...route.source.position },
        message: `Route length ${totalLength.toFixed(2)}m exceeds maximum ${maxLength.toFixed(2)}m`,
      });
    }

    return violations;
  }

  /**
   * Check if connection points are compatible
   */
  private checkConnectionPoints(route: Route): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Check if source and destination are compatible
    if (!route.source.canConnectTo(route.destination)) {
      violations.push({
        type: 'clearance',
        severity: 'error',
        location: { ...route.source.position },
        message: `Source and destination connection points are incompatible (${route.source.getType()} vs ${route.destination.getType()})`,
      });
    }

    // Check if route type matches connection point types
    if (route.type !== route.source.getType()) {
      violations.push({
        type: 'clearance',
        severity: 'error',
        location: { ...route.source.position },
        message: `Route type ${route.type} does not match source connection point type ${route.source.getType()}`,
      });
    }

    if (route.type !== route.destination.getType()) {
      violations.push({
        type: 'clearance',
        severity: 'error',
        location: { ...route.destination.position },
        message: `Route type ${route.type} does not match destination connection point type ${route.destination.getType()}`,
      });
    }

    return violations;
  }

  /**
   * Check if route is within scene bounds
   */
  private checkBounds(route: Route): ConstraintViolation[] {
    if (!this.sceneBounds) return [];

    const violations: ConstraintViolation[] = [];

    // Check all waypoints
    const waypoints = route.getWaypoints();
    for (const waypoint of waypoints) {
      const outOfBounds = this.isOutOfBounds(waypoint);
      if (outOfBounds) {
        violations.push({
          type: 'clearance',
          severity: 'error',
          location: { ...waypoint },
          message: `Route waypoint is out of bounds (${waypoint.x.toFixed(2)}, ${waypoint.y.toFixed(2)}, ${waypoint.z.toFixed(2)})`,
        });
      }
    }

    return violations;
  }

  /**
   * Check if a point is out of bounds
   */
  private isOutOfBounds(point: Vector3): boolean {
    if (!this.sceneBounds) return false;

    return (
      point.x < this.sceneBounds.min.x ||
      point.x > this.sceneBounds.max.x ||
      point.y < this.sceneBounds.min.y ||
      point.y > this.sceneBounds.max.y ||
      point.z < this.sceneBounds.min.z ||
      point.z > this.sceneBounds.max.z
    );
  }

  /**
   * Detailed bend radius check with segment mapping
   */
  private checkBendRadiusDetailed(
    segments: RouteSegment[],
    constraints: RouteConstraints,
    segmentViolations: Map<string, ConstraintViolation[]>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (let i = 1; i < segments.length; i++) {
      const prevSegment = segments[i - 1];
      const currSegment = segments[i];

      // Check if there's a bend between segments
      if (prevSegment.segmentType === 'bend' || currSegment.segmentType === 'bend') {
        const bendRadius = currSegment.bendRadius || prevSegment.bendRadius;

        if (bendRadius && bendRadius < constraints.minBendRadius) {
          const violation: ConstraintViolation = {
            type: 'bend_radius',
            severity: 'error',
            location: { ...currSegment.startPoint },
            message: `Bend radius ${bendRadius.toFixed(2)}m is less than minimum ${constraints.minBendRadius.toFixed(2)}m`,
          };

          violations.push(violation);

          // Add to segment violations
          const segId = currSegment.id;
          if (!segmentViolations.has(segId)) {
            segmentViolations.set(segId, []);
          }
          segmentViolations.get(segId)!.push(violation);
        }
      }
    }

    return violations;
  }

  /**
   * Check for collisions with obstacles
   */
  private checkCollisions(
    route: Route,
    obstacles: BABYLON.Mesh[],
    segmentViolations: Map<string, ConstraintViolation[]>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const requiredClearance = route.constraints.clearance.otherInfrastructure;

    // Check each segment for collisions
    for (const segment of route.segments) {
      const segmentCollisions: ConstraintViolation[] = [];

      for (const obstacle of obstacles) {
        // Check start point
        const startDistance = this.calculateDistanceToMesh(segment.startPoint, obstacle);
        if (startDistance < requiredClearance) {
          const violation: ConstraintViolation = {
            type: 'clearance',
            severity: 'error',
            location: { ...segment.startPoint },
            message: `Collision detected with obstacle "${obstacle.name}" (clearance: ${startDistance.toFixed(2)}m < required: ${requiredClearance.toFixed(2)}m)`,
          };
          segmentCollisions.push(violation);
        }

        // Check end point
        const endDistance = this.calculateDistanceToMesh(segment.endPoint, obstacle);
        if (endDistance < requiredClearance) {
          const violation: ConstraintViolation = {
            type: 'clearance',
            severity: 'error',
            location: { ...segment.endPoint },
            message: `Collision detected with obstacle "${obstacle.name}" (clearance: ${endDistance.toFixed(2)}m < required: ${requiredClearance.toFixed(2)}m)`,
          };
          segmentCollisions.push(violation);
        }
      }

      if (segmentCollisions.length > 0) {
        violations.push(...segmentCollisions);

        // Add to segment violations
        if (!segmentViolations.has(segment.id)) {
          segmentViolations.set(segment.id, []);
        }
        segmentViolations.get(segment.id)!.push(...segmentCollisions);
      }
    }

    return violations;
  }

  /**
   * Get suggested fixes for validation issues
   */
  getSuggestedFixes(validationResult: EnhancedValidationResult): string[] {
    const suggestions: string[] = [];

    for (const violation of validationResult.violations) {
      switch (violation.type) {
        case 'bend_radius':
          suggestions.push(
            `Increase bend radius at (${violation.location.x.toFixed(2)}, ${violation.location.y.toFixed(2)}, ${violation.location.z.toFixed(2)})`
          );
          break;

        case 'clearance':
          if (violation.message.includes('Collision')) {
            suggestions.push(
              `Adjust route path to avoid collision at (${violation.location.x.toFixed(2)}, ${violation.location.y.toFixed(2)}, ${violation.location.z.toFixed(2)})`
            );
          } else if (violation.message.includes('out of bounds')) {
            suggestions.push(
              `Move route waypoint back within scene bounds at (${violation.location.x.toFixed(2)}, ${violation.location.y.toFixed(2)}, ${violation.location.z.toFixed(2)})`
            );
          }
          break;

        case 'length':
          if (violation.message.includes('below minimum')) {
            suggestions.push('Route is too short - check connection points are correctly placed');
          } else if (violation.message.includes('exceeds maximum')) {
            suggestions.push('Consider adding intermediate connection points or supports');
          }
          break;

        case 'support_spacing':
          suggestions.push(
            `Add support points between segments exceeding ${validationResult.violations.find((v) => v.type === 'support_spacing')?.message.split(' ')[3] || 'maximum'} spacing`
          );
          break;
        case 'elevation':
          suggestions.push('Review elevation transitions to keep risers within allowable range.');
          break;
        case 'topology':
          suggestions.push('Remove overlapping or zero-length segments from the route definition.');
          break;
      }
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Inherit distance calculation from base class
   */
  private calculateDistanceToMesh(point: Vector3, mesh: BABYLON.Mesh): number {
    const boundingInfo = mesh.getBoundingInfo();
    const boundingBox = boundingInfo.boundingBox;

    const min = boundingBox.minimumWorld;
    const max = boundingBox.maximumWorld;

    const closestPoint = {
      x: Math.max(min.x, Math.min(point.x, max.x)),
      y: Math.max(min.y, Math.min(point.y, max.y)),
      z: Math.max(min.z, Math.min(point.z, max.z)),
    };

    const dx = point.x - closestPoint.x;
    const dy = point.y - closestPoint.y;
    const dz = point.z - closestPoint.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

export type ElevationValidationStatus = 'VALID' | 'WARNING' | 'ERROR';

export interface ElevationRuleOptions {
  maxElevationDelta?: number;
  maxElevationSpan?: number;
  allowMixedElevation?: boolean;
  minNodesForMixedElevation?: number;
  minNodeCount?: number;
  floorSnapTolerance?: number;
}

export interface ElevationValidationResult {
  status: ElevationValidationStatus;
  violations: ConstraintViolation[];
}

export function evaluateElevationProfile(
  points: Vector3[],
  options?: ElevationRuleOptions
): ElevationValidationResult {
  const violations: ConstraintViolation[] = [];
  const sanitizedPoints = filterFinitePoints(points);

  if (sanitizedPoints.length === 0) {
    violations.push({
      type: 'elevation',
      severity: 'error',
      location: ORIGIN_VECTOR,
      message: 'Route contains no valid waypoint positions.',
    });
    return finalizeElevationResult(violations);
  }

  if (sanitizedPoints.length !== points.length) {
    violations.push({
      type: 'elevation',
      severity: 'warning',
      location: { ...sanitizedPoints[0] },
      message: 'One or more waypoints had invalid coordinates and were ignored during validation.',
    });
  }

  const minNodeCount = options?.minNodeCount ?? DEFAULT_MIN_NODE_COUNT;
  if (sanitizedPoints.length < minNodeCount) {
    violations.push({
      type: 'elevation',
      severity: 'error',
      location: { ...sanitizedPoints[0] },
      message: `Route requires at least ${minNodeCount} nodes but only ${sanitizedPoints.length} provided.`,
    });
    return finalizeElevationResult(violations);
  }

  const maxElevationDelta = options?.maxElevationDelta ?? DEFAULT_MAX_ELEVATION_DELTA;
  for (let i = 1; i < sanitizedPoints.length; i++) {
    const prev = sanitizedPoints[i - 1];
    const current = sanitizedPoints[i];
    const delta = Math.abs(current.z - prev.z);

    if (delta <= maxElevationDelta) {
      continue;
    }

    violations.push({
      type: 'elevation',
      severity: 'error',
      location: { ...current },
      message: `Elevation change of ${delta.toFixed(2)}m exceeds maximum of ${maxElevationDelta.toFixed(
        2
      )}m between nodes ${i} and ${i + 1}.`,
    });
  }

  const elevations = sanitizedPoints.map((point) => point.z);
  const minZ = Math.min(...elevations);
  const maxZ = Math.max(...elevations);
  const span = maxZ - minZ;
  const maxElevationSpan = options?.maxElevationSpan ?? DEFAULT_MAX_ELEVATION_SPAN;

  if (span > maxElevationSpan) {
    violations.push({
      type: 'elevation',
      severity: 'warning',
      location: { ...sanitizedPoints[0] },
      message: `Total elevation span ${span.toFixed(2)}m exceeds recommended maximum ${maxElevationSpan.toFixed(
        2
      )}m.`,
    });
  }

  const floorSnapTolerance = options?.floorSnapTolerance ?? DEFAULT_FLOOR_SNAP_TOLERANCE;
  const floorContact = sanitizedPoints.filter(
    (point) => Math.abs(point.z - minZ) <= floorSnapTolerance
  ).length;
  const elevatedCount = sanitizedPoints.length - floorContact;
  const allowMixedElevation = options?.allowMixedElevation ?? true;
  const minNodesForMixedElevation =
    options?.minNodesForMixedElevation ?? DEFAULT_MIN_NODES_FOR_MIXED;
  const hasMixedElevation = floorContact > 0 && elevatedCount > 0;

  if (hasMixedElevation && !allowMixedElevation) {
    violations.push({
      type: 'elevation',
      severity: 'error',
      location: { ...sanitizedPoints[0] },
      message: 'Route mixes floor and elevated sections but mixed profiles are not allowed.',
    });
    return finalizeElevationResult(violations);
  }

  if (hasMixedElevation && allowMixedElevation && sanitizedPoints.length < minNodesForMixedElevation) {
    violations.push({
      type: 'elevation',
      severity: 'warning',
      location: { ...sanitizedPoints[0] },
      message: `Mixed elevation routes require at least ${minNodesForMixedElevation} nodes for stable risers.`,
    });
  }

  return finalizeElevationResult(violations);
}

function filterFinitePoints(points: Vector3[]): Vector3[] {
  return points
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.z)
    )
    .map((point) => ({ ...point }));
}

function finalizeElevationResult(
  violations: ConstraintViolation[]
): ElevationValidationResult {
  const hasError = violations.some((violation) => violation.severity === 'error');
  if (hasError) {
    return { status: 'ERROR', violations };
  }

  const hasWarning = violations.some((violation) => violation.severity === 'warning');
  if (hasWarning) {
    return { status: 'WARNING', violations };
  }

  return { status: 'VALID', violations };
}




