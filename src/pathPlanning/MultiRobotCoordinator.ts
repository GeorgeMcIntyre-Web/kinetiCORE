/**
 * Multi-Robot Coordinator
 * Handles task allocation, zone management, and collision avoidance for multiple robots
 *
 * Features:
 * - Spot allocation to minimize total cycle time
 * - Zone-based collision avoidance
 * - Time-shifted execution scheduling
 */

import * as BABYLON from '@babylonjs/core';
import {
  WeldSpot,
  MultiRobotProgram,
  WeldingProgram,
  // SpotWeldingConfig
} from './types';
import { SpotWeldingPlanner } from './SpotWeldingPlanner';
// import { TSPSolver } from './TSPSolver';

export interface RobotZone {
  robotId: string;
  center: BABYLON.Vector3;
  radius: number;
}

export class MultiRobotCoordinator {
  // private tspSolver: TSPSolver;
  private minSeparation: number = 0.3; // 300mm minimum separation

  constructor() {
    // this.tspSolver = new TSPSolver();
  }

  /**
   * Coordinate multiple robots to weld spots with minimal cycle time
   * @param robotPlanners - Map of robot ID to SpotWeldingPlanner
   * @param spots - All spots to weld
   * @param obstacles - Scene obstacles
   * @param robotHomePositions - Home position for each robot
   */
  async coordinateMultiRobot(
    robotPlanners: Map<string, SpotWeldingPlanner>,
    spots: WeldSpot[],
    obstacles: BABYLON.Mesh[],
    robotHomePositions: Map<string, BABYLON.Vector3>
  ): Promise<MultiRobotProgram> {
    const robotIds = Array.from(robotPlanners.keys());

    console.log(`Coordinating ${robotIds.length} robots for ${spots.length} spots`);

    // Step 1: Allocate spots to robots (greedy nearest-neighbor)
    const allocation = this.allocateSpots(robotIds, spots, robotHomePositions);

    console.log('Spot allocation:');
    allocation.forEach((robotSpots, robotId) => {
      console.log(`  ${robotId}: ${robotSpots.length} spots`);
    });

    // Step 2: Plan path for each robot independently
    const programs: Array<{
      robotId: string;
      program: WeldingProgram;
    }> = [];

    for (const [robotId, planner] of robotPlanners) {
      const robotSpots = allocation.get(robotId) || [];

      if (robotSpots.length === 0) {
        console.warn(`${robotId} has no spots assigned`);
        continue;
      }

      const homePos = robotHomePositions.get(robotId);
      const program = await planner.plan(robotSpots, obstacles, homePos);

      programs.push({ robotId, program });
    }

    // Step 3: Detect inter-robot collisions (simplified zone-based check)
    const collisionsFree = this.checkInterRobotCollisions(programs);

    // Step 4: Calculate total cycle time (makespan)
    const totalCycleTime = Math.max(...programs.map(p => p.program.cycleTime));

    console.log(`Multi-robot coordination complete:`);
    console.log(`  Total cycle time: ${totalCycleTime.toFixed(2)}s`);
    console.log(`  Collisions free: ${collisionsFree}`);

    return {
      robots: programs,
      totalCycleTime,
      collisionsFree
    };
  }

  /**
   * Allocate spots to robots using greedy nearest-neighbor strategy
   * Balances workload while respecting spatial proximity
   */
  private allocateSpots(
    robotIds: string[],
    spots: WeldSpot[],
    homePositions: Map<string, BABYLON.Vector3>
  ): Map<string, WeldSpot[]> {
    const allocation = new Map<string, WeldSpot[]>();
    const assigned = new Set<string>();

    // Initialize empty arrays for each robot
    robotIds.forEach(id => allocation.set(id, []));

    // Current positions (start at home)
    const currentPositions = new Map<string, BABYLON.Vector3>();
    robotIds.forEach(id => {
      const home = homePositions.get(id) || BABYLON.Vector3.Zero();
      currentPositions.set(id, home);
    });

    // Greedy allocation: each robot takes turns picking nearest spot
    while (assigned.size < spots.length) {
      for (const robotId of robotIds) {
        if (assigned.size >= spots.length) break;

        const currentPos = currentPositions.get(robotId)!;

        // Find nearest unassigned spot
        let nearestSpot: WeldSpot | null = null;
        let minDist = Infinity;

        for (const spot of spots) {
          if (assigned.has(spot.id)) continue;

          const dist = BABYLON.Vector3.Distance(currentPos, spot.position);
          if (dist < minDist) {
            minDist = dist;
            nearestSpot = spot;
          }
        }

        // Assign spot to robot
        if (nearestSpot) {
          allocation.get(robotId)!.push(nearestSpot);
          assigned.add(nearestSpot.id);
          currentPositions.set(robotId, nearestSpot.position);
        }
      }
    }

    return allocation;
  }

  /**
   * Check for collisions between robot paths (simplified zone-based)
   * In production, would use swept volume collision detection
   */
  private checkInterRobotCollisions(
    programs: Array<{ robotId: string; program: WeldingProgram }>
  ): boolean {
    // Simplified check: ensure robots work in separate zones
    // Full implementation would check swept volumes along trajectories

    for (let i = 0; i < programs.length; i++) {
      for (let j = i + 1; j < programs.length; j++) {
        const robot1 = programs[i].program;
        const robot2 = programs[j].program;

        // Check if any spots are too close
        for (const spot1 of robot1.spots) {
          for (const spot2 of robot2.spots) {
            const dist = BABYLON.Vector3.Distance(
              spot1.position,
              spot2.position
            );

            if (dist < this.minSeparation) {
              console.warn(
                `Potential collision: ${programs[i].robotId} and ` +
                `${programs[j].robotId} have spots within ${dist.toFixed(3)}m`
              );
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Define static zones for robots (e.g., left side, right side)
   * Used for pre-allocation before detailed planning
   */
  defineStaticZones(
    robotIds: string[],
    workspaceCenter: BABYLON.Vector3,
    workspaceRadius: number
  ): Map<string, RobotZone> {
    const zones = new Map<string, RobotZone>();

    if (robotIds.length === 2) {
      // Two robots: left and right hemispheres
      zones.set(robotIds[0], {
        robotId: robotIds[0],
        center: workspaceCenter.add(new BABYLON.Vector3(-workspaceRadius / 2, 0, 0)),
        radius: workspaceRadius * 0.6
      });

      zones.set(robotIds[1], {
        robotId: robotIds[1],
        center: workspaceCenter.add(new BABYLON.Vector3(workspaceRadius / 2, 0, 0)),
        radius: workspaceRadius * 0.6
      });
    } else {
      // Multiple robots: divide workspace evenly
      const angleStep = (2 * Math.PI) / robotIds.length;

      robotIds.forEach((id, i) => {
        const angle = i * angleStep;
        const offset = new BABYLON.Vector3(
          Math.cos(angle) * workspaceRadius / 2,
          Math.sin(angle) * workspaceRadius / 2,
          0
        );

        zones.set(id, {
          robotId: id,
          center: workspaceCenter.add(offset),
          radius: workspaceRadius * 0.6
        });
      });
    }

    return zones;
  }

  /**
   * Filter spots by zone (pre-allocation strategy)
   */
  filterSpotsByZone(spots: WeldSpot[], zone: RobotZone): WeldSpot[] {
    return spots.filter(spot => {
      const dist = BABYLON.Vector3.Distance(spot.position, zone.center);
      return dist <= zone.radius;
    });
  }

  /**
   * Calculate load balance metric (0 = perfectly balanced, 1 = worst case)
   */
  calculateLoadBalance(
    allocation: Map<string, WeldSpot[]>
  ): number {
    const spotCounts = Array.from(allocation.values()).map(spots => spots.length);
    const maxSpots = Math.max(...spotCounts);
    const minSpots = Math.min(...spotCounts);
    const avgSpots = spotCounts.reduce((a, b) => a + b, 0) / spotCounts.length;

    if (avgSpots === 0) return 0;

    return (maxSpots - minSpots) / avgSpots;
  }
}
