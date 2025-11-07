// Cost Function - Pluggable cost functions for A* pathfinding
// Owner: Agent 1 - Pathfinding & Optimization

import * as BABYLON from '@babylonjs/core';
import { Vector3 } from '../../core/types';

/**
 * Context for cost calculation
 */
export interface CostContext {
  /** Obstacles in the scene for clearance calculation */
  obstacles: BABYLON.Mesh[];
  /** Required clearance from obstacles (meters) */
  clearanceRequirement: number;
  /** Cost multiplier for bends (higher = penalize bends more) */
  bendPenalty: number;
}

/**
 * Cost function interface for pathfinding optimization
 */
export interface CostFunction {
  /**
   * Calculate cost from one position to another
   * @param from Starting position
   * @param to Ending position
   * @param context Additional context for cost calculation
   * @returns Cost value (lower is better)
   */
  calculateCost(from: Vector3, to: Vector3, context: CostContext): number;
  
  /**
   * Get the name of this cost function
   */
  getName(): string;
}

/**
 * Shortest path cost function - Minimizes distance
 * Prioritizes direct routes with minimal total length
 */
export class ShortestPathCost implements CostFunction {
  getName(): string {
    return 'shortest';
  }

  calculateCost(from: Vector3, to: Vector3, _context: CostContext): number {
    // Simple Euclidean distance
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

/**
 * Safest path cost function - Maximizes clearance from obstacles
 * Prioritizes routes with maximum distance from obstacles
 */
export class SafestPathCost implements CostFunction {
  getName(): string {
    return 'safest';
  }

  calculateCost(from: Vector3, to: Vector3, context: CostContext): number {
    // Base distance cost (less important for safest)
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Calculate minimum clearance along this edge
    const minClearance = this.calculateMinClearance(from, to, context.obstacles);
    
    // Inverse clearance penalty (lower clearance = higher cost)
    // Add 0.1 to avoid division by zero
    const clearancePenalty = 1.0 / (minClearance + 0.1);
    
    // Combine: distance matters less, clearance matters more
    return distance * 0.3 + clearancePenalty * 2.0;
  }

  /**
   * Calculate minimum clearance from obstacles along an edge
   */
  private calculateMinClearance(from: Vector3, to: Vector3, obstacles: BABYLON.Mesh[]): number {
    let minClearance = Infinity;
    const numSamples = 5; // Sample 5 points along the edge
    
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const point: Vector3 = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        z: from.z + (to.z - from.z) * t
      };
      
      for (const obstacle of obstacles) {
        const clearance = this.distanceToMesh(point, obstacle);
        minClearance = Math.min(minClearance, clearance);
      }
    }
    
    return minClearance;
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
      z: Math.max(min.z, Math.min(point.z, max.z))
    };
    
    const dx = point.x - closestPoint.x;
    const dy = point.y - closestPoint.y;
    const dz = point.z - closestPoint.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

/**
 * Aesthetic path cost function - Follows structure (walls, ceiling)
 * Prioritizes routes that run parallel to walls and follow building structure
 */
export class AestheticPathCost implements CostFunction {
  getName(): string {
    return 'aesthetic';
  }

  calculateCost(from: Vector3, to: Vector3, context: CostContext): number {
    // Base distance cost
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Prefer axis-aligned movement (parallel to walls/structure)
    const alignmentPenalty = this.calculateAlignmentPenalty(from, to);
    
    // Slight bend penalty (smooth curves are better than sharp angles)
    const bendPenalty = context.bendPenalty * 0.5;
    
    // Combine: distance + alignment + bends
    return distance * 0.7 + alignmentPenalty * 1.0 + bendPenalty;
  }

  /**
   * Calculate penalty for non-axis-aligned movement
   * Lower penalty for movement parallel to X, Y, or Z axes
   */
  private calculateAlignmentPenalty(from: Vector3, to: Vector3): number {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const dz = Math.abs(to.z - from.z);
    
    const total = dx + dy + dz;
    if (total === 0) return 0;
    
    // Calculate how "axis-aligned" this movement is
    // Perfect alignment = one component is total, others are 0
    const maxComponent = Math.max(dx, dy, dz);
    const alignmentRatio = maxComponent / total;
    
    // Higher ratio = more aligned = lower penalty
    // alignmentRatio ranges from ~0.33 (diagonal) to 1.0 (axis-aligned)
    // Convert to penalty: 0.33 -> high penalty, 1.0 -> low penalty
    return (1.0 - alignmentRatio) * 2.0;
  }
}

/**
 * Factory function to create cost functions by name
 */
export function createCostFunction(mode: 'shortest' | 'safest' | 'aesthetic'): CostFunction {
  switch (mode) {
    case 'shortest':
      return new ShortestPathCost();
    case 'safest':
      return new SafestPathCost();
    case 'aesthetic':
      return new AestheticPathCost();
    default:
      return new ShortestPathCost();
  }
}
