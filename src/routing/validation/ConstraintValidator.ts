// ConstraintValidator - Validates routes against physical constraints
// Owner: Agent 2 - Constraint Validator
// Purpose: Real-time validation of bend radius, clearance, support spacing

import * as BABYLON from '@babylonjs/core';
import { Vector3 } from '../../core/types';
import { Route } from '../core/Route';
import type {
  RouteSegment,
  RouteConstraints,
  ClearanceRequirements,
} from '../core/types';
import {
  ValidationResult,
  ConstraintViolation,
  EnhancedValidationResult,
  BatchValidationResult,
  ValidationOptions,
  createViolationId,
  calculateStatistics,
} from './ValidationResult';

/**
 * ConstraintValidator validates routes against all physical constraints
 * Returns detailed violation reports for UI feedback
 * 
 * Key Features:
 * - Bend radius validation
 * - Clearance checking (obstacles, walls, floor, ceiling)
 * - Support spacing validation
 * - Batch validation for multiple routes
 * - Configurable validation options
 */
export class ConstraintValidator {
  /** Cache of obstacle bounding boxes for performance */
  private obstacleCache: Map<string, BABYLON.BoundingBox> = new Map();

  /**
   * Validate a single route against constraints
   * @param route - Route to validate
   * @returns ValidationResult with violations
   */
  validate(route: Route): ValidationResult {
    return this.validateRoute(route, []);
  }

  /**
   * Validate a route with obstacles (full validation)
   * @param route - Route to validate
   * @param obstacles - Scene obstacles to check clearance against
   * @param options - Optional validation configuration
   * @returns ValidationResult with all violations
   */
  validateRoute(
    route: Route,
    obstacles: BABYLON.AbstractMesh[],
    options: ValidationOptions = {}
  ): ValidationResult {
    const violations: ConstraintViolation[] = [];

    // Check bend radius (unless skipped)
    if (!options.skipBendRadius) {
      violations.push(...this.checkBendRadius(route.segments, route.constraints));
    }

    // Check clearance (unless skipped)
    if (!options.skipClearance) {
      violations.push(...this.checkClearance(route, obstacles, route.constraints));
    }

    // Check support spacing (unless skipped)
    if (!options.skipSupportSpacing) {
      violations.push(...this.checkSupportSpacing(route, route.constraints));
    }

    // Apply max violations limit if specified
    const limitedViolations =
      options.maxViolations && options.maxViolations > 0
        ? violations.slice(0, options.maxViolations)
        : violations;

    // In strict mode, treat warnings as errors
    if (options.strictMode) {
      limitedViolations.forEach((v) => {
        if (v.severity === 'warning') {
          v.severity = 'error';
        }
      });
    }

    return {
      isValid: limitedViolations.every((v) => v.severity !== 'error'),
      violations: limitedViolations,
    };
  }

  /**
   * Validate a route with enhanced segment-level detail
   * @param route - Route to validate
   * @param obstacles - Scene obstacles
   * @param options - Validation options
   * @returns EnhancedValidationResult with segment mapping
   */
  validateEnhanced(
    route: Route,
    obstacles: BABYLON.AbstractMesh[],
    options: ValidationOptions = {}
  ): EnhancedValidationResult {
    const segmentViolations = new Map<string, ConstraintViolation[]>();
    const violations: ConstraintViolation[] = [];

    // Check bend radius with segment mapping
    if (!options.skipBendRadius) {
      violations.push(
        ...this.checkBendRadiusWithSegments(route.segments, route.constraints, segmentViolations)
      );
    }

    // Check clearance with segment mapping
    if (!options.skipClearance) {
      violations.push(
        ...this.checkClearanceWithSegments(route, obstacles, route.constraints, segmentViolations)
      );
    }

    // Check support spacing
    if (!options.skipSupportSpacing) {
      violations.push(...this.checkSupportSpacing(route, route.constraints));
    }

    // Determine overall status
    const hasErrors = violations.some((v) => v.severity === 'error');
    const hasWarnings = violations.some((v) => v.severity === 'warning');

    const status: 'valid' | 'warning' | 'error' = hasErrors
      ? 'error'
      : hasWarnings
      ? 'warning'
      : 'valid';

    return {
      isValid: violations.every((v) => v.severity !== 'error'),
      violations,
      segmentViolations,
      status,
      timestamp: Date.now(),
      routeId: route.id,
    };
  }

  /**
   * Batch validate multiple routes
   * @param routes - Array of routes to validate
   * @param obstacles - Scene obstacles (shared across all routes)
   * @param options - Validation options
   * @returns BatchValidationResult with per-route results and statistics
   */
  validateBatch(
    routes: Route[],
    obstacles: BABYLON.AbstractMesh[] = [],
    options: ValidationOptions = {}
  ): BatchValidationResult {
    const startTime = Date.now();
    const results = new Map<string, ValidationResult>();

    // Validate each route
    for (const route of routes) {
      const result = this.validateRoute(route, obstacles, options);
      results.set(route.id, result);
    }

    const endTime = Date.now();
    const statistics = calculateStatistics(results);

    return {
      results,
      statistics,
      startTime,
      endTime,
    };
  }

  /**
   * Check bend radius constraint
   * @param segments - Route segments to check
   * @param constraints - Route constraints
   * @returns Array of violations
   */
  checkBendRadius(segments: RouteSegment[], constraints: RouteConstraints): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (let i = 1; i < segments.length; i++) {
      const prevSegment = segments[i - 1];
      const currSegment = segments[i];

      // Check if there's a bend between segments
      if (prevSegment.segmentType === 'bend' || currSegment.segmentType === 'bend') {
        const bendRadius = currSegment.bendRadius || prevSegment.bendRadius;

        if (bendRadius && bendRadius < constraints.minBendRadius) {
          violations.push({
            id: createViolationId('bend_radius', currSegment.startPoint),
            type: 'bend_radius',
            severity: 'error',
            location: { ...currSegment.startPoint },
            message: `Bend radius too tight`,
            actualValue: bendRadius,
            requiredValue: constraints.minBendRadius,
            segmentRef: {
              from: { ...prevSegment.endPoint },
              to: { ...currSegment.startPoint },
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check bend radius with segment mapping (for enhanced validation)
   */
  private checkBendRadiusWithSegments(
    segments: RouteSegment[],
    constraints: RouteConstraints,
    segmentViolations: Map<string, ConstraintViolation[]>
  ): ConstraintViolation[] {
    const violations = this.checkBendRadius(segments, constraints);

    // Map violations to segments
    for (let i = 1; i < segments.length; i++) {
      const currSegment = segments[i];
      const relevantViolations = violations.filter(
        (v) =>
          v.location.x === currSegment.startPoint.x &&
          v.location.y === currSegment.startPoint.y &&
          v.location.z === currSegment.startPoint.z
      );

      if (relevantViolations.length > 0) {
        if (!segmentViolations.has(currSegment.id)) {
          segmentViolations.set(currSegment.id, []);
        }
        segmentViolations.get(currSegment.id)!.push(...relevantViolations);
      }
    }

    return violations;
  }

  /**
   * Check clearance from obstacles
   * @param route - Route to check
   * @param obstacles - Scene obstacles
   * @param constraints - Route constraints
   * @returns Array of violations
   */
  checkClearance(
    route: Route,
    obstacles: BABYLON.AbstractMesh[],
    constraints: RouteConstraints
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const requiredClearance = constraints.clearance.otherInfrastructure;

    // Update obstacle cache
    this.updateObstacleCache(obstacles);

    // Check clearance from obstacles
    for (const segment of route.segments) {
      for (const obstacle of obstacles) {
        // Check segment start point
        const startDistance = this.distanceToMesh(segment.startPoint, obstacle);
        if (startDistance < requiredClearance) {
          violations.push({
            id: createViolationId('clearance', segment.startPoint),
            type: 'clearance',
            severity: 'error',
            location: { ...segment.startPoint },
            message: `Insufficient clearance from obstacle "${obstacle.name}"`,
            actualValue: startDistance,
            requiredValue: requiredClearance,
            obstacleId: obstacle.name,
            segmentRef: {
              from: { ...segment.startPoint },
              to: { ...segment.endPoint },
            },
          });
        }

        // Check segment end point
        const endDistance = this.distanceToMesh(segment.endPoint, obstacle);
        if (endDistance < requiredClearance) {
          violations.push({
            id: createViolationId('clearance', segment.endPoint),
            type: 'clearance',
            severity: 'error',
            location: { ...segment.endPoint },
            message: `Insufficient clearance from obstacle "${obstacle.name}"`,
            actualValue: endDistance,
            requiredValue: requiredClearance,
            obstacleId: obstacle.name,
            segmentRef: {
              from: { ...segment.startPoint },
              to: { ...segment.endPoint },
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check clearance with segment mapping (for enhanced validation)
   */
  private checkClearanceWithSegments(
    route: Route,
    obstacles: BABYLON.AbstractMesh[],
    constraints: RouteConstraints,
    segmentViolations: Map<string, ConstraintViolation[]>
  ): ConstraintViolation[] {
    const violations = this.checkClearance(route, obstacles, constraints);

    // Map violations to segments
    for (const segment of route.segments) {
      const relevantViolations = violations.filter(
        (v) =>
          v.segmentRef &&
          v.segmentRef.from.x === segment.startPoint.x &&
          v.segmentRef.from.y === segment.startPoint.y &&
          v.segmentRef.from.z === segment.startPoint.z
      );

      if (relevantViolations.length > 0) {
        if (!segmentViolations.has(segment.id)) {
          segmentViolations.set(segment.id, []);
        }
        segmentViolations.get(segment.id)!.push(...relevantViolations);
      }
    }

    return violations;
  }

  /**
   * Check support spacing constraint
   * @param route - Route to check
   * @param constraints - Route constraints
   * @returns Array of violations
   */
  checkSupportSpacing(route: Route, constraints: RouteConstraints): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const maxSpacing = constraints.supportSpacing;

    // Get all support positions
    const supports = route.supports.map((s) => s.position);

    // Check spacing between consecutive supports
    for (let i = 0; i < supports.length - 1; i++) {
      const distance = this.distance(supports[i], supports[i + 1]);
      if (distance > maxSpacing) {
        violations.push({
          id: createViolationId('support_spacing', supports[i]),
          type: 'support_spacing',
          severity: 'warning',
          location: supports[i],
          message: `Support spacing exceeds maximum`,
          actualValue: distance,
          requiredValue: maxSpacing,
        });
      }
    }

    // Check if route segments exceed support spacing
    for (const segment of route.segments) {
      if (segment.length > maxSpacing) {
        violations.push({
          id: createViolationId('support_spacing', segment.startPoint),
          type: 'support_spacing',
          severity: 'warning',
          location: segment.startPoint,
          message: `Segment length exceeds support spacing`,
          actualValue: segment.length,
          requiredValue: maxSpacing,
          segmentRef: {
            from: { ...segment.startPoint },
            to: { ...segment.endPoint },
          },
        });
      }
    }

    return violations;
  }

  /**
   * Calculate Euclidean distance between two points
   */
  private distance(p1: Vector3, p2: Vector3): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate distance from point to mesh bounding box
   */
  private distanceToMesh(point: Vector3, mesh: BABYLON.AbstractMesh): number {
    const cachedBBox = this.obstacleCache.get(mesh.uniqueId.toString());
    
    if (!cachedBBox) {
      // Fallback: compute if not cached
      const boundingInfo = mesh.getBoundingInfo();
      return this.distanceToBoundingBox(point, boundingInfo.boundingBox);
    }

    return this.distanceToBoundingBox(point, cachedBBox);
  }

  /**
   * Calculate distance from point to bounding box
   */
  private distanceToBoundingBox(point: Vector3, bbox: BABYLON.BoundingBox): number {
    const min = bbox.minimumWorld;
    const max = bbox.maximumWorld;

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

  /**
   * Update obstacle cache for performance
   */
  private updateObstacleCache(obstacles: BABYLON.AbstractMesh[]): void {
    this.obstacleCache.clear();
    
    for (const obstacle of obstacles) {
      const boundingInfo = obstacle.getBoundingInfo();
      this.obstacleCache.set(obstacle.uniqueId.toString(), boundingInfo.boundingBox);
    }
  }

  /**
   * Clear obstacle cache (call when scene changes)
   */
  clearCache(): void {
    this.obstacleCache.clear();
  }
}
