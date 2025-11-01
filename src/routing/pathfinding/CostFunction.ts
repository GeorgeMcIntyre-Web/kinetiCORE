// Cost Function - Calculates path cost for optimization
// Owner: Routing System Team

import { Vector3 } from '../../core/types';
import { RouteConstraints, OptimizationMode } from '../core/types';

/**
 * CostFunction calculates the cost of a path for optimization
 * Supports different optimization modes (shortest, safest, aesthetic)
 */
export class CostFunction {
  private distanceWeight: number = 1.0;
  private bendsWeight: number = 2.0;
  private clearanceWeight: number = 1.5;
  private supportsWeight: number = 0.5;

  /**
   * Calculate total cost for a path
   * @param path Array of waypoints
   * @param constraints Route constraints
   * @param mode Optimization mode
   */
  calculate(
    path: Vector3[],
    constraints: RouteConstraints,
    mode: OptimizationMode = 'shortest'
  ): number {
    if (path.length < 2) return 0;

    // Base distance cost
    const distanceCost = this.calculateDistanceCost(path);

    // Bends cost (penalize sharp turns)
    const bendsCost = this.calculateBendsCost(path, constraints);

    // Clearance cost (reward paths with good clearance)
    const clearanceCost = this.calculateClearanceCost(path, constraints);

    // Supports cost (estimate number of supports needed)
    const supportsCost = this.calculateSupportsCost(path, constraints);

    // Apply mode-specific weights
    const weights = this.getWeightsForMode(mode);

    return (
      distanceCost * weights.distance +
      bendsCost * weights.bends +
      clearanceCost * weights.clearance +
      supportsCost * weights.supports
    );
  }

  /**
   * Set custom weights for cost calculation
   */
  setWeights(
    distance: number,
    bends: number,
    clearance: number,
    supports?: number
  ): void {
    this.distanceWeight = distance;
    this.bendsWeight = bends;
    this.clearanceWeight = clearance;
    if (supports !== undefined) {
      this.supportsWeight = supports;
    }
  }

  /**
   * Calculate distance cost (total path length)
   */
  private calculateDistanceCost(path: Vector3[]): number {
    let totalDistance = 0;

    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      const dz = path[i].z - path[i - 1].z;
      totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return totalDistance;
  }

  /**
   * Calculate bends cost (penalize sharp turns)
   */
  private calculateBendsCost(path: Vector3[], constraints: RouteConstraints): number {
    if (path.length < 3) return 0;

    let bendsCost = 0;

    for (let i = 1; i < path.length - 1; i++) {
      const v1 = this.vectorSubtract(path[i], path[i - 1]);
      const v2 = this.vectorSubtract(path[i + 1], path[i]);

      const angle = this.angleBetweenVectors(v1, v2);

      // Penalize sharp bends (angles close to 180 degrees = straight, close to 0 = sharp turn)
      const bendPenalty = Math.abs(Math.PI - angle);

      // Extra penalty if bend radius would be violated
      if (this.wouldViolateBendRadius(path[i - 1], path[i], path[i + 1], constraints.minBendRadius)) {
        bendsCost += bendPenalty * 10; // Heavy penalty
      } else {
        bendsCost += bendPenalty;
      }
    }

    return bendsCost;
  }

  /**
   * Calculate clearance cost (reward paths with good clearance from obstacles)
   */
  private calculateClearanceCost(_path: Vector3[], constraints: RouteConstraints): number {
    // For now, return a constant cost
    // This would be calculated based on actual obstacle distances in full implementation
    const minClearance = Math.min(
      constraints.clearance.walls,
      constraints.clearance.ceiling,
      constraints.clearance.floor,
      constraints.clearance.otherInfrastructure
    );

    // Reward paths that maintain good clearance
    return 1.0 / (minClearance + 0.1); // Inverse relationship (higher clearance = lower cost)
  }

  /**
   * Calculate supports cost (estimate number of supports needed)
   */
  private calculateSupportsCost(path: Vector3[], constraints: RouteConstraints): number {
    const totalLength = this.calculateDistanceCost(path);
    const numSupports = Math.ceil(totalLength / constraints.supportSpacing);
    return numSupports;
  }

  /**
   * Get weights for optimization mode
   */
  private getWeightsForMode(mode: OptimizationMode): {
    distance: number;
    bends: number;
    clearance: number;
    supports: number;
  } {
    switch (mode) {
      case 'shortest':
        return {
          distance: 1.0,
          bends: 0.5,
          clearance: 0.3,
          supports: 0.2,
        };

      case 'safest':
        return {
          distance: 0.5,
          bends: 1.0,
          clearance: 2.0,
          supports: 0.3,
        };

      case 'aesthetic':
        return {
          distance: 0.7,
          bends: 1.5,
          clearance: 1.0,
          supports: 0.1,
        };

      default:
        return {
          distance: this.distanceWeight,
          bends: this.bendsWeight,
          clearance: this.clearanceWeight,
          supports: this.supportsWeight,
        };
    }
  }

  /**
   * Check if three points would violate bend radius
   */
  private wouldViolateBendRadius(
    p1: Vector3,
    p2: Vector3,
    p3: Vector3,
    minBendRadius: number
  ): boolean {
    // Simplified check: calculate approximate bend radius
    const v1 = this.vectorSubtract(p2, p1);
    const v2 = this.vectorSubtract(p3, p2);

    const angle = this.angleBetweenVectors(v1, v2);
    const len1 = this.vectorLength(v1);
    const len2 = this.vectorLength(v2);

    // Approximate bend radius (for small angles)
    const bendRadius = (len1 + len2) / (2 * Math.sin(angle / 2));

    return bendRadius < minBendRadius;
  }

  /**
   * Vector subtraction
   */
  private vectorSubtract(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  /**
   * Vector length
   */
  private vectorLength(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Angle between two vectors in radians
   */
  private angleBetweenVectors(v1: Vector3, v2: Vector3): number {
    const len1 = this.vectorLength(v1);
    const len2 = this.vectorLength(v2);

    if (len1 === 0 || len2 === 0) return 0;

    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const cosAngle = dot / (len1 * len2);
    const clamped = Math.max(-1, Math.min(1, cosAngle)); // Clamp to [-1, 1]
    return Math.acos(clamped);
  }
}

