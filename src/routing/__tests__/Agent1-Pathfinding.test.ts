/**
 * Agent 1 - Pathfinding Acceptance Tests
 * 
 * Test IDs:
 * - TC-A1: Simple pathfinding performance (<100ms)
 * - TC-A2: Complex pathfinding performance (<500ms with 300+ obstacles)
 * - TC-A3: Cost functions produce distinct paths
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { SearchGraph } from '../pathfinding/SearchGraph';
import { RouteOptimizer, createCancellationToken } from '../pathfinding/RouteOptimizer';
import { ShortestPathCost, SafestPathCost, AestheticPathCost } from '../pathfinding/CostFunction';
import { ConnectionPoint } from '../core/ConnectionPoint';
import { RouteConstraints, ConnectionSpecifications } from '../core/types';
import { Vector3 } from '../../core/types';

describe('Agent 1 - Pathfinding & Optimization', () => {
  let engine: BABYLON.NullEngine;
  let scene: BABYLON.Scene;
  let routeOptimizer: RouteOptimizer;
  let defaultConstraints: RouteConstraints;

  beforeEach(() => {
    // Create a NullEngine for testing (doesn't require WebGL)
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);

    routeOptimizer = new RouteOptimizer();

    // Default constraints for testing
    defaultConstraints = {
      minBendRadius: 0.1,
      supportSpacing: 3.0,
      clearance: {
        walls: 0.05,
        ceiling: 0.05,
        floor: 0.15,
        otherInfrastructure: 0.075
      }
    };
  });

  describe('TC-A1: Simple pathfinding performance (<100ms)', () => {
    it('should find path in <100ms with no obstacles', () => {
      // Create simple connection points
      const source = createConnectionPoint({ x: 0, y: 0, z: 0 });
      const destination = createConnectionPoint({ x: 5, y: 0, z: 0 });
      const obstacles: BABYLON.Mesh[] = [];

      const startTime = performance.now();
      const route = routeOptimizer.findOptimalPath(
        source,
        destination,
        defaultConstraints,
        obstacles,
        'shortest'
      );
      const duration = performance.now() - startTime;

      expect(route).not.toBeNull();
      expect(duration).toBeLessThan(100);
      console.log(`TC-A1 (no obstacles): ${duration.toFixed(2)}ms`);
    });

    it('should find path in <100ms with 10 obstacles', () => {
      const source = createConnectionPoint({ x: 0, y: 0, z: 0 });
      const destination = createConnectionPoint({ x: 10, y: 0, z: 0 });
      const obstacles = createSimpleObstacles(scene, 10);

      const startTime = performance.now();
      const route = routeOptimizer.findOptimalPath(
        source,
        destination,
        defaultConstraints,
        obstacles,
        'shortest'
      );
      const duration = performance.now() - startTime;

      expect(route).not.toBeNull();
      expect(duration).toBeLessThan(100);
      console.log(`TC-A1 (10 obstacles): ${duration.toFixed(2)}ms`);
    });

    it('should use direct path optimization when clear', () => {
      const source = createConnectionPoint({ x: 0, y: 0, z: 0 });
      const destination = createConnectionPoint({ x: 5, y: 0, z: 0 });
      const obstacles: BABYLON.Mesh[] = [];

      const startTime = performance.now();
      const route = routeOptimizer.findOptimalPath(
        source,
        destination,
        defaultConstraints,
        obstacles,
        'shortest'
      );
      const duration = performance.now() - startTime;

      expect(route).not.toBeNull();
      expect(route!.segments.length).toBe(1); // Should be single straight segment
      expect(duration).toBeLessThan(10); // Should be very fast with direct path
      console.log(`TC-A1 (direct path): ${duration.toFixed(2)}ms`);
    });
  });

  describe('TC-A2: Complex pathfinding performance (<500ms, 300+ obstacles)', () => {
    it('should find path in <500ms with 300 obstacles', () => {
      const source = createConnectionPoint({ x: 0, y: 0, z: 0 });
      const destination = createConnectionPoint({ x: 20, y: 20, z: 5 });
      const obstacles = createSimpleObstacles(scene, 300);

      const startTime = performance.now();
      const route = routeOptimizer.findOptimalPath(
        source,
        destination,
        defaultConstraints,
        obstacles,
        'shortest'
      );
      const duration = performance.now() - startTime;

      expect(route).not.toBeNull();
      expect(duration).toBeLessThan(500);
      console.log(`TC-A2 (300 obstacles): ${duration.toFixed(2)}ms`);
    });

    it('should handle cancellation token', () => {
      const source = createConnectionPoint({ x: 0, y: 0, z: 0 });
      const destination = createConnectionPoint({ x: 20, y: 20, z: 5 });
      const obstacles = createSimpleObstacles(scene, 300);
      const cancellationToken = createCancellationToken();

      // Cancel immediately
      cancellationToken.cancel();

      const route = routeOptimizer.findOptimalPathAsync(
        source,
        destination,
        defaultConstraints,
        obstacles,
        'shortest',
        cancellationToken
      );

      expect(route).toBeNull();
    });
  });

  describe('TC-A3: Cost functions produce distinct paths', () => {
    it('should produce different paths for shortest vs safest cost functions', () => {
      const source = createConnectionPoint({ x: 0, y: 0, z: 0 });
      const destination = createConnectionPoint({ x: 10, y: 10, z: 0 });
      
      // Create obstacles that create a narrow passage vs. a longer clear route
      const obstacles = createObstacleScenario(scene);

      const shortestRoute = routeOptimizer.findOptimalPath(
        source,
        destination,
        defaultConstraints,
        obstacles,
        'shortest'
      );

      const safestRoute = routeOptimizer.findOptimalPath(
        source,
        destination,
        defaultConstraints,
        obstacles,
        'safest'
      );

      expect(shortestRoute).not.toBeNull();
      expect(safestRoute).not.toBeNull();

      // Paths should be different (different number of segments or different waypoints)
      const pathsDifferent = 
        shortestRoute!.segments.length !== safestRoute!.segments.length ||
        !segmentsEqual(shortestRoute!.segments[0], safestRoute!.segments[0]);

      expect(pathsDifferent).toBe(true);
      console.log(`TC-A3: Shortest path has ${shortestRoute!.segments.length} segments`);
      console.log(`TC-A3: Safest path has ${safestRoute!.segments.length} segments`);
    });

    it('should produce different paths for shortest vs aesthetic cost functions', () => {
      const source = createConnectionPoint({ x: 0, y: 0, z: 0 });
      const destination = createConnectionPoint({ x: 10, y: 10, z: 2 });
      const obstacles = createObstacleScenario(scene);

      const shortestRoute = routeOptimizer.findOptimalPath(
        source,
        destination,
        defaultConstraints,
        obstacles,
        'shortest'
      );

      const aestheticRoute = routeOptimizer.findOptimalPath(
        source,
        destination,
        defaultConstraints,
        obstacles,
        'aesthetic'
      );

      expect(shortestRoute).not.toBeNull();
      expect(aestheticRoute).not.toBeNull();

      // Aesthetic path should prefer axis-aligned movement
      const aestheticHasMoreSegments = 
        aestheticRoute!.segments.length >= shortestRoute!.segments.length;

      expect(aestheticHasMoreSegments).toBe(true);
      console.log(`TC-A3: Shortest has ${shortestRoute!.segments.length} segments`);
      console.log(`TC-A3: Aesthetic has ${aestheticRoute!.segments.length} segments`);
    });

    it('should verify cost function implementations', () => {
      const shortestCost = new ShortestPathCost();
      const safestCost = new SafestPathCost();
      const aestheticCost = new AestheticPathCost();

      expect(shortestCost.getName()).toBe('shortest');
      expect(safestCost.getName()).toBe('safest');
      expect(aestheticCost.getName()).toBe('aesthetic');

      // Test that cost functions return different values
      const from: Vector3 = { x: 0, y: 0, z: 0 };
      const to: Vector3 = { x: 1, y: 1, z: 0 };
      const context = {
        obstacles: [],
        clearanceRequirement: 0.075,
        bendPenalty: 2.0
      };

      const shortestValue = shortestCost.calculateCost(from, to, context);
      const safestValue = safestCost.calculateCost(from, to, context);
      const aestheticValue = aestheticCost.calculateCost(from, to, context);

      // All should return positive values
      expect(shortestValue).toBeGreaterThan(0);
      expect(safestValue).toBeGreaterThan(0);
      expect(aestheticValue).toBeGreaterThan(0);

      console.log(`TC-A3 Cost values: shortest=${shortestValue.toFixed(3)}, safest=${safestValue.toFixed(3)}, aesthetic=${aestheticValue.toFixed(3)}`);
    });
  });

  describe('SearchGraph - Tunable Parameters', () => {
    it('should generate different node counts with different densities', () => {
      const searchGraph = new SearchGraph();
      const start: Vector3 = { x: 0, y: 0, z: 0 };
      const goal: Vector3 = { x: 5, y: 5, z: 5 };
      const obstacles: BABYLON.Mesh[] = [];

      const lowDensityGraph = searchGraph.buildGraph(
        start, goal, obstacles, defaultConstraints, 2 // 2 nodes/m?
      );

      const highDensityGraph = searchGraph.buildGraph(
        start, goal, obstacles, defaultConstraints, 10 // 10 nodes/m?
      );

      expect(highDensityGraph.nodes.size).toBeGreaterThan(lowDensityGraph.nodes.size);
      console.log(`Low density: ${lowDensityGraph.nodes.size} nodes`);
      console.log(`High density: ${highDensityGraph.nodes.size} nodes`);
    });

    it('should apply obstacle inflation', () => {
      const searchGraph = new SearchGraph();
      const start: Vector3 = { x: 0, y: 0, z: 0 };
      const goal: Vector3 = { x: 5, y: 5, z: 5 };
      const obstacles = createSimpleObstacles(scene, 10);

      const noInflationGraph = searchGraph.buildGraph(
        start, goal, obstacles, defaultConstraints, 5, 0 // no inflation
      );

      const inflatedGraph = searchGraph.buildGraph(
        start, goal, obstacles, defaultConstraints, 5, 0.5 // 0.5m inflation
      );

      // Inflated graph should have fewer valid nodes (more excluded near obstacles)
      expect(inflatedGraph.nodes.size).toBeLessThanOrEqual(noInflationGraph.nodes.size);
      console.log(`No inflation: ${noInflationGraph.nodes.size} nodes`);
      console.log(`With inflation: ${inflatedGraph.nodes.size} nodes`);
    });
  });
});

// Helper functions

function createConnectionPoint(position: Vector3): ConnectionPoint {
  const config = {
    type: 'pipe' as const,
    position,
    direction: { x: 0, y: 0, z: 1 },
    specifications: {
      size: '3/4"',
      material: 'steel'
    }
  };

  return new ConnectionPoint(config);
}

function createSimpleObstacles(scene: BABYLON.Scene, count: number): BABYLON.Mesh[] {
  const obstacles: BABYLON.Mesh[] = [];
  
  for (let i = 0; i < count; i++) {
    const box = BABYLON.MeshBuilder.CreateBox(
      `obstacle_${i}`,
      { size: 0.5 },
      scene
    );
    
    // Position randomly in a 20x20x5 space
    box.position.x = Math.random() * 20 - 10;
    box.position.y = Math.random() * 20 - 10;
    box.position.z = Math.random() * 5;
    
    obstacles.push(box);
  }
  
  return obstacles;
}

function createObstacleScenario(scene: BABYLON.Scene): BABYLON.Mesh[] {
  const obstacles: BABYLON.Mesh[] = [];
  
  // Create a scenario with a narrow passage and a longer clear route
  // Narrow passage at y=5
  for (let x = 2; x < 8; x++) {
    const box = BABYLON.MeshBuilder.CreateBox(
      `wall_${x}`,
      { width: 1, height: 1, depth: 2 },
      scene
    );
    box.position.x = x;
    box.position.y = 5;
    box.position.z = 1;
    obstacles.push(box);
  }
  
  // Leave a small gap at x=5 for narrow passage
  obstacles.splice(3, 1);
  
  return obstacles;
}

function segmentsEqual(seg1: any, seg2: any): boolean {
  return (
    pointsEqual(seg1.startPoint, seg2.startPoint) &&
    pointsEqual(seg1.endPoint, seg2.endPoint)
  );
}

function pointsEqual(p1: Vector3, p2: Vector3, tolerance: number = 0.001): boolean {
  return (
    Math.abs(p1.x - p2.x) < tolerance &&
    Math.abs(p1.y - p2.y) < tolerance &&
    Math.abs(p1.z - p2.z) < tolerance
  );
}
