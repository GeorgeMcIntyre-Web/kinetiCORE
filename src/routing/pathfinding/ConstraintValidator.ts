// Constraint Validator - Validates routes against constraints
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Vector3 } from '../../core/types';
import { Route } from '../core/Route';
import {
  RouteSegment,
  ConstraintViolation,
  ValidationResult,
  RouteConstraints,
} from '../core/types';

/**
 * ConstraintValidator validates routes against all constraints
 * Returns detailed violation reports for UI feedback
 */
export class ConstraintValidator {
  /**
   * Validate a complete route against constraints
   */
  validateRoute(route: Route, obstacles: BABYLON.Mesh[]): ValidationResult {
    const violations: ConstraintViolation[] = [];

    // Check bend radius
    violations.push(...this.checkBendRadius(route.segments, route.constraints));

    // Check clearance
    violations.push(...this.checkClearance(route, obstacles, route.constraints));

    // Check support spacing
    violations.push(...this.checkSupportSpacing(route, route.constraints));

    // Check maximum run length
    if (route.constraints.maxRunLength) {
      violations.push(...this.checkMaxRunLength(route, route.constraints));
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * Check bend radius violations
   */
  checkBendRadius(
    segments: RouteSegment[],
    constraints: RouteConstraints
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (let i = 1; i < segments.length; i++) {
      const prevSegment = segments[i - 1];
      const currSegment = segments[i];

      // Check if there's a bend between segments
      if (prevSegment.segmentType === 'bend' || currSegment.segmentType === 'bend') {
        const bendRadius = currSegment.bendRadius || prevSegment.bendRadius;

        if (bendRadius && bendRadius < constraints.minBendRadius) {
          violations.push({
            type: 'bend_radius',
            severity: 'error',
            location: { ...currSegment.startPoint },
            message: `Bend radius ${bendRadius.toFixed(2)} is less than minimum ${constraints.minBendRadius.toFixed(2)}`,
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check clearance violations
   */
  checkClearance(
    route: Route,
    obstacles: BABYLON.Mesh[],
    constraints: RouteConstraints
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const requiredClearance = constraints.clearance.otherInfrastructure;

    // Check clearance from obstacles
    for (const segment of route.segments) {
      for (const obstacle of obstacles) {
        const distance = this.distanceToMesh(segment.startPoint, obstacle);
        if (distance < requiredClearance) {
          violations.push({
            type: 'clearance',
            severity: 'error',
            location: { ...segment.startPoint },
            message: `Clearance ${distance.toFixed(2)} is less than required ${requiredClearance.toFixed(2)}`,
          });
        }
      }
    }

    // Check clearance from walls, floor, ceiling
    // This would require scene bounds information in full implementation

    return violations;
  }

  /**
   * Check support spacing violations
   */
  checkSupportSpacing(route: Route, constraints: RouteConstraints): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const maxSpacing = constraints.supportSpacing;

    // Get all support positions and route waypoints
    const supports = route.supports.map((s) => s.position);
    const waypoints: Vector3[] = [];
    if (route.segments.length > 0) {
      waypoints.push({ ...route.segments[0].startPoint });
      for (const segment of route.segments) {
        waypoints.push({ ...segment.endPoint });
      }
    }

    if (waypoints.length < 2) return violations;

    // Check spacing between supports along route
    for (let i = 0; i < supports.length - 1; i++) {
      const distance = this.distance(supports[i], supports[i + 1]);
      if (distance > maxSpacing) {
        violations.push({
          type: 'support_spacing',
          severity: 'warning',
          location: supports[i],
          message: `Support spacing ${distance.toFixed(2)} exceeds maximum ${maxSpacing.toFixed(2)}`,
        });
      }
    }

    // Check if route segments exceed support spacing
    for (const segment of route.segments) {
      if (segment.length > maxSpacing) {
        violations.push({
          type: 'support_spacing',
          severity: 'warning',
          location: segment.startPoint,
          message: `Segment length ${segment.length.toFixed(2)} exceeds support spacing ${maxSpacing.toFixed(2)}`,
        });
      }
    }

    return violations;
  }

  /**
   * Check maximum run length
   */
  checkMaxRunLength(route: Route, constraints: RouteConstraints): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    if (!constraints.maxRunLength) return violations;

    const totalLength = route.getTotalLength();

    if (totalLength > constraints.maxRunLength) {
      violations.push({
        type: 'length',
        severity: 'warning',
        location: { ...route.source.position },
        message: `Total route length ${totalLength.toFixed(2)} exceeds maximum ${constraints.maxRunLength.toFixed(2)}`,
      });
    }

    return violations;
  }

  /**
   * Calculate distance between two points
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
  private distanceToMesh(point: Vector3, mesh: BABYLON.Mesh): number {
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

