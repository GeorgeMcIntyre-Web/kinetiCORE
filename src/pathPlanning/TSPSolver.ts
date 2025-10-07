/**
 * Traveling Salesman Problem (TSP) Solver
 * Optimizes spot welding sequence to minimize cycle time
 *
 * Uses 2-opt local search heuristic for closed-loop tours
 */

import * as BABYLON from '@babylonjs/core';
import { WeldSpot } from './types';

export class TSPSolver {
  /**
   * Solve TSP for spot sequence (closed loop)
   * Returns optimized spot order that minimizes total travel distance
   *
   * @param spots - Array of weld spots
   * @param startPosition - Robot home/start position
   * @returns Optimized spot sequence
   */
  solveTSP(spots: WeldSpot[], startPosition?: BABYLON.Vector3): WeldSpot[] {
    if (spots.length <= 2) {
      return spots; // Nothing to optimize
    }

    // Initialize with greedy nearest-neighbor
    let tour = this.greedyNearestNeighbor(spots, startPosition);

    // Improve with 2-opt
    tour = this.twoOpt(tour);

    return tour;
  }

  /**
   * Greedy nearest-neighbor construction heuristic
   * Builds initial tour by always visiting nearest unvisited spot
   */
  private greedyNearestNeighbor(
    spots: WeldSpot[],
    startPosition?: BABYLON.Vector3
  ): WeldSpot[] {
    const tour: WeldSpot[] = [];
    const unvisited = new Set(spots);
    let current = startPosition || spots[0].position;

    while (unvisited.size > 0) {
      let nearest: WeldSpot | null = null;
      let minDist = Infinity;

      for (const spot of unvisited) {
        const dist = BABYLON.Vector3.Distance(current, spot.position);
        if (dist < minDist) {
          minDist = dist;
          nearest = spot;
        }
      }

      if (nearest) {
        tour.push(nearest);
        unvisited.delete(nearest);
        current = nearest.position;
      }
    }

    return tour;
  }

  /**
   * 2-opt improvement heuristic
   * Iteratively swaps edge pairs to reduce tour length
   */
  private twoOpt(tour: WeldSpot[]): WeldSpot[] {
    let improved = true;
    let bestTour = [...tour];

    while (improved) {
      improved = false;

      for (let i = 0; i < bestTour.length - 1; i++) {
        for (let j = i + 2; j < bestTour.length; j++) {
          // Calculate current edge distances
          const currentDist =
            this.distance(bestTour[i], bestTour[i + 1]) +
            this.distance(bestTour[j], bestTour[(j + 1) % bestTour.length]);

          // Calculate distances if we reverse segment [i+1, j]
          const newDist =
            this.distance(bestTour[i], bestTour[j]) +
            this.distance(bestTour[i + 1], bestTour[(j + 1) % bestTour.length]);

          if (newDist < currentDist) {
            // Improvement found - reverse segment
            bestTour = [
              ...bestTour.slice(0, i + 1),
              ...bestTour.slice(i + 1, j + 1).reverse(),
              ...bestTour.slice(j + 1)
            ];
            improved = true;
          }
        }
      }
    }

    return bestTour;
  }

  /**
   * Calculate Euclidean distance between two spots
   */
  private distance(spot1: WeldSpot, spot2: WeldSpot): number {
    return BABYLON.Vector3.Distance(spot1.position, spot2.position);
  }

  /**
   * Calculate total tour length
   */
  calculateTourLength(tour: WeldSpot[]): number {
    let length = 0;

    for (let i = 0; i < tour.length - 1; i++) {
      length += this.distance(tour[i], tour[i + 1]);
    }

    // Add distance back to start (closed loop)
    if (tour.length > 0) {
      length += this.distance(tour[tour.length - 1], tour[0]);
    }

    return length;
  }

  /**
   * Calculate improvement percentage from original order
   */
  calculateImprovement(
    originalTour: WeldSpot[],
    optimizedTour: WeldSpot[]
  ): number {
    const originalLength = this.calculateTourLength(originalTour);
    const optimizedLength = this.calculateTourLength(optimizedTour);

    return ((originalLength - optimizedLength) / originalLength) * 100;
  }
}
