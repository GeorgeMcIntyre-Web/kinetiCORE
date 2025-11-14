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
  RoutePlacementOptions,
} from '../core/types';
import { ConstraintValidator } from '../pathfinding/ConstraintValidator';

const MIN_SEGMENT_LENGTH = 0.001;
const MIN_WAYPOINT_COUNT = 2;
const DEFAULT_ELEVATION_TOLERANCE = 0.01;
const DEFAULT_SLOPE_WARNING_DELTA = 0.05;
const DEFAULT_SLOPE_ERROR_DELTA = 0.3;

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

    violations.push(...this.checkDegenerateSegments(route, segmentViolations));

    // Check route length
    violations.push(...this.checkRouteLength(route));

    // Check connection point compatibility
    violations.push(...this.checkConnectionPoints(route));

    // Check out of bounds
    if (this.sceneBounds) {
      violations.push(...this.checkBounds(route));
    }

    // Check bend radius with more detail
    violations.push(...this.checkBendRadiusDetailed(route.segments, route.constraints, segmentViolations));

    violations.push(...this.checkElevationConstraints(route));

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
      if (segment.length >= MIN_SEGMENT_LENGTH) {
        continue;
      }

      const violation: ConstraintViolation = {
        type: 'topology',
        severity: 'error',
        location: { ...segment.startPoint },
        message: `Segment "${segment.id}" has near-zero length (${segment.length.toFixed(4)}m).`,
      };

      violations.push(violation);
      this.appendSegmentViolation(segmentViolations, segment.id, violation);
    }

    return violations;
  }

  private checkElevationConstraints(route: Route): ConstraintViolation[] {
    const placement = route.constraints.placement;
    if (!placement) {
      return [];
    }

    const waypoints = route.getWaypoints();
    if (waypoints.length === 0) {
      return [];
    }

    const evaluation = evaluateElevationProfile(waypoints, placement);
    return evaluation.violations;
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

      if (segmentCollisions.length === 0) {
        continue;
      }

      violations.push(...segmentCollisions);
      this.appendSegmentViolationList(segmentViolations, segment.id, segmentCollisions);
    }

    return violations;
  }

  private appendSegmentViolationList(
    segmentViolations: Map<string, ConstraintViolation[]>,
    segmentId: string,
    violations: ConstraintViolation[]
  ): void {
    if (!segmentViolations.has(segmentId)) {
      segmentViolations.set(segmentId, []);
    }
    segmentViolations.get(segmentId)!.push(...violations);
  }

  private appendSegmentViolation(
    segmentViolations: Map<string, ConstraintViolation[]>,
    segmentId: string,
    violation: ConstraintViolation
  ): void {
    this.appendSegmentViolationList(segmentViolations, segmentId, [violation]);
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
          suggestions.push('Adjust node elevations to match the active placement mode.');
          break;
        case 'topology':
          suggestions.push('Remove overlapping or zero-length segments before generating geometry.');
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

export type ElevationValidationStatus = 'valid' | 'warning' | 'error';

export interface ElevationRuleOptions extends RoutePlacementOptions {}

export interface ElevationValidationResult {
  status: ElevationValidationStatus;
  violations: ConstraintViolation[];
}

export function evaluateElevationProfile(
  waypoints: Vector3[],
  options?: ElevationRuleOptions
): ElevationValidationResult {
  if (!options) {
    return { status: 'valid', violations: [] };
  }

  const violations: ConstraintViolation[] = [];
  const sanitized = filterFiniteWaypoints(waypoints);

  if (sanitized.length === 0) {
    violations.push(createElevationViolation('Route has no valid waypoints.', 'error'));
    return finalizeElevationValidation(violations);
  }

  if (sanitized.length < MIN_WAYPOINT_COUNT) {
    violations.push(createElevationViolation('Route must contain at least two waypoints.', 'error', sanitized[0]));
    return finalizeElevationValidation(violations);
  }

  if (options.mode === 'fixed_height') {
    violations.push(
      ...validateFixedElevation(sanitized, options.defaultElevation, options.floorSnapTolerance)
    );
    return finalizeElevationValidation(violations);
  }

  violations.push(
    ...validateFloorElevation(
      sanitized,
      options.floorSnapTolerance,
      options.maxElevationDelta,
      options.allowMixedElevation
    )
  );

  return finalizeElevationValidation(violations);
}

function validateFloorElevation(
  points: Vector3[],
  tolerance?: number,
  maxDelta?: number,
  allowMixed?: boolean
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const snapTolerance = tolerance ?? DEFAULT_ELEVATION_TOLERANCE;
  const maxStepDelta = maxDelta ?? DEFAULT_SLOPE_ERROR_DELTA;
  const warningDelta = Math.min(maxStepDelta, DEFAULT_SLOPE_WARNING_DELTA);
  const baseline = points[0].z;

  for (const point of points) {
    const delta = Math.abs(point.z - baseline);
    if (delta <= snapTolerance) {
      continue;
    }

    if (delta <= warningDelta) {
      violations.push(
        createElevationViolation(
          `Slope detected at (${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(
            2
          )}) - verify platform grade.`,
          allowMixed ? 'warning' : 'error',
          point
        )
      );
      continue;
    }

    if (delta <= maxStepDelta && allowMixed) {
      violations.push(
        createElevationViolation(
          `Mixed elevation segment detected (${delta.toFixed(2)}m). Ensure riser nodes are intentional.`,
          'warning',
          point
        )
      );
      continue;
    }

    violations.push(
      createElevationViolation(
        `Elevation delta ${delta.toFixed(2)}m exceeds allowed floor tolerance.`,
        'error',
        point
      )
    );
  }

  return violations;
}

function validateFixedElevation(
  points: Vector3[],
  targetElevation: number,
  tolerance?: number
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  if (!Number.isFinite(targetElevation)) {
    violations.push(createElevationViolation('Fixed-height placement requires a valid elevation.', 'error'));
    return violations;
  }

  const elevationTolerance = tolerance ?? DEFAULT_ELEVATION_TOLERANCE;

  for (const point of points) {
    const delta = Math.abs(point.z - targetElevation);
    if (delta <= elevationTolerance) {
      continue;
    }

    violations.push(
      createElevationViolation(
        `Waypoint at (${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(
          2
        )}) deviates ${delta.toFixed(2)}m from fixed elevation ${targetElevation.toFixed(2)}m.`,
        'error',
        point
      )
    );
  }

  return violations;
}

function filterFiniteWaypoints(points: Vector3[]): Vector3[] {
  return points
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.z)
    )
    .map((point) => ({ ...point }));
}

function createElevationViolation(
  message: string,
  severity: 'error' | 'warning',
  location?: Vector3
): ConstraintViolation {
  return {
    type: 'elevation',
    severity,
    location: location ? { ...location } : { x: 0, y: 0, z: 0 },
    message,
  };
}

function finalizeElevationValidation(
  violations: ConstraintViolation[]
): ElevationValidationResult {
  if (violations.some((violation) => violation.severity === 'error')) {
    return { status: 'error', violations };
  }

  if (violations.some((violation) => violation.severity === 'warning')) {
    return { status: 'warning', violations };
  }

  return { status: 'valid', violations };
}




