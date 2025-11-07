// Search Graph - Builds navigation graph from scene obstacles for pathfinding
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Vector3 } from '../../core/types';
import { Graph, GraphNode, GraphEdge, RouteConstraints } from '../core/types';

/**
 * SearchGraph builds a navigation graph from scene geometry
 * Supports tunable grid-based approach with obstacle inflation and layer snapping
 */
export class SearchGraph {
  private gridBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  } | null = null;

  /**
   * Build a navigation graph from start to goal position
   * @param start Starting position
   * @param goal Goal position
   * @param obstacles Array of Babylon meshes that act as obstacles
   * @param constraints Route constraints for clearance checking
   * @param nodeDensity Nodes per cubic meter (default 5, higher = more nodes but slower)
   * @param obstacleInflation Inflate obstacles by this distance in meters (default 0)
   * @param layerSnapping Snap nodes to floor/ceiling layers if true (default false)
   */
  buildGraph(
    start: Vector3,
    goal: Vector3,
    obstacles: BABYLON.Mesh[],
    constraints: RouteConstraints,
    nodeDensity: number = 5,
    obstacleInflation: number = 0,
    layerSnapping: boolean = false
  ): Graph {
    // Calculate grid size from node density
    // nodeDensity = nodes per cubic meter
    // gridSize = cube root of (1 / nodeDensity)
    const gridSize = Math.pow(1 / nodeDensity, 1/3);
    // Determine grid bounds
    this.calculateGridBounds(start, goal, constraints);

    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Create grid of nodes
    const nodeMap = this.createGridNodes(gridSize, layerSnapping);

    // Validate nodes against obstacles with inflation
    const validNodes = this.validateNodesAgainstObstacles(
      nodeMap, 
      obstacles, 
      constraints, 
      obstacleInflation
    );

    // Add valid nodes to graph
    for (const node of validNodes) {
      nodes.set(node.id, node);
    }

    // Create edges between neighboring nodes
    this.createEdges(validNodes, constraints, edges, gridSize);

    return { nodes, edges };
  }

  /**
   * Get neighboring nodes for a given node
   */
  getNeighbors(nodeId: string, graph: Graph): GraphNode[] {
    const neighbors: GraphNode[] = [];
    const node = graph.nodes.get(nodeId);
    if (!node) return neighbors;

    for (const edge of graph.edges) {
      if (edge.from === nodeId && edge.valid) {
        const neighbor = graph.nodes.get(edge.to);
        if (neighbor) {
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  /**
   * Get distance between two nodes (edge weight)
   */
  getDistance(node1: GraphNode, node2: GraphNode): number {
    const dx = node2.position.x - node1.position.x;
    const dy = node2.position.y - node1.position.y;
    const dz = node2.position.z - node1.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Validate if an edge between two nodes satisfies constraints
   */
  validateEdge(
    from: GraphNode,
    to: GraphNode,
    constraints: RouteConstraints
  ): boolean {
    // Check minimum distance for bend radius
    const distance = this.getDistance(from, to);
    if (distance < constraints.minBendRadius * 0.1) {
      return false; // Too close, would violate bend radius
    }

    // Additional constraint checks can be added here
    return true;
  }

  /**
   * Calculate grid bounds based on start, goal, and constraints
   */
  private calculateGridBounds(
    start: Vector3,
    goal: Vector3,
    constraints: RouteConstraints
  ): void {
    const padding = constraints.clearance.otherInfrastructure * 2;

    this.gridBounds = {
      minX: Math.min(start.x, goal.x) - padding,
      maxX: Math.max(start.x, goal.x) + padding,
      minY: Math.min(start.y, goal.y) - padding,
      maxY: Math.max(start.y, goal.y) + padding,
      minZ: Math.min(start.z, goal.z) - padding,
      maxZ: Math.max(start.z, goal.z) + padding,
    };
  }

  /**
   * Create grid of nodes within bounds
   * @param gridSize Size of grid cells
   * @param layerSnapping If true, snap nodes to common infrastructure layers (floor, ceiling)
   */
  private createGridNodes(gridSize: number, layerSnapping: boolean): GraphNode[] {
    if (!this.gridBounds) return [];

    const nodes: GraphNode[] = [];
    const layers: number[] = layerSnapping 
      ? this.calculateInfrastructureLayers(gridSize)
      : [];

    // Create nodes in 3D grid
    for (
      let x = this.gridBounds.minX;
      x <= this.gridBounds.maxX;
      x += gridSize
    ) {
      for (
        let y = this.gridBounds.minY;
        y <= this.gridBounds.maxY;
        y += gridSize
      ) {
        const zPositions = layerSnapping && layers.length > 0
          ? layers // Use infrastructure layers
          : this.generateZPositions(gridSize); // Use regular grid

        for (const z of zPositions) {
          nodes.push({
            id: this.getNodeId(x, y, z, gridSize),
            position: { x, y, z },
          });
        }
      }
    }

    return nodes;
  }

  /**
   * Calculate common infrastructure layers (floor, mid, ceiling)
   */
  private calculateInfrastructureLayers(gridSize: number): number[] {
    if (!this.gridBounds) return [];
    
    const layers: number[] = [];
    const { minZ, maxZ } = this.gridBounds;
    
    // Floor layer
    layers.push(minZ);
    
    // Mid layers (every 2 meters typical ceiling height)
    const layerHeight = Math.max(2.0, gridSize * 4);
    for (let z = minZ + layerHeight; z < maxZ; z += layerHeight) {
      layers.push(z);
    }
    
    // Ceiling layer
    if (maxZ - layers[layers.length - 1] > gridSize) {
      layers.push(maxZ);
    }
    
    return layers;
  }

  /**
   * Generate regular Z positions for grid
   */
  private generateZPositions(gridSize: number): number[] {
    if (!this.gridBounds) return [];
    
    const positions: number[] = [];
    for (
      let z = this.gridBounds.minZ;
      z <= this.gridBounds.maxZ;
      z += gridSize
    ) {
      positions.push(z);
    }
    return positions;
  }

  /**
   * Validate nodes against obstacles and constraints
   * @param obstacleInflation Additional clearance beyond constraints (meters)
   */
  private validateNodesAgainstObstacles(
    nodes: GraphNode[],
    obstacles: BABYLON.Mesh[],
    constraints: RouteConstraints,
    obstacleInflation: number = 0
  ): GraphNode[] {
    const validNodes: GraphNode[] = [];
    const requiredClearance = constraints.clearance.otherInfrastructure + obstacleInflation;

    for (const node of nodes) {
      let isValid = true;

      // Check clearance from obstacles
      for (const obstacle of obstacles) {
        const distance = this.distanceToMesh(node.position, obstacle);
        if (distance < requiredClearance) {
          isValid = false;
          break;
        }
      }

      // Check clearance from scene boundaries if available
      if (isValid && this.gridBounds) {
        const { minX, maxX, minY, maxY, minZ, maxZ } = this.gridBounds;
        const wallClearance = constraints.clearance.walls;
        const floorClearance = constraints.clearance.floor;
        const ceilingClearance = constraints.clearance.ceiling;

        // Check walls (X and Y boundaries)
        if (node.position.x - minX < wallClearance || 
            maxX - node.position.x < wallClearance ||
            node.position.y - minY < wallClearance || 
            maxY - node.position.y < wallClearance) {
          isValid = false;
        }

        // Check floor and ceiling (Z boundaries)
        if (node.position.z - minZ < floorClearance || 
            maxZ - node.position.z < ceilingClearance) {
          isValid = false;
        }
      }

      if (isValid) {
        validNodes.push(node);
      }
    }

    return validNodes;
  }

  /**
   * Calculate distance from point to mesh bounding box
   */
  private distanceToMesh(point: Vector3, mesh: BABYLON.Mesh): number {
    const boundingInfo = mesh.getBoundingInfo();
    const boundingBox = boundingInfo.boundingBox;

    // Simple bounding box distance calculation
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

  /**
   * Create edges between neighboring nodes
   * @param gridSize Size of grid cells for neighbor detection
   */
  private createEdges(
    nodes: GraphNode[],
    _constraints: RouteConstraints,
    edges: GraphEdge[],
    gridSize: number
  ): void {
    // Create edges to 26-connected neighbors (3D grid)
    const neighborOffsets = [
      // Face neighbors (6)
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
      // Edge neighbors (12)
      [1, 1, 0],
      [1, -1, 0],
      [-1, 1, 0],
      [-1, -1, 0],
      [1, 0, 1],
      [1, 0, -1],
      [-1, 0, 1],
      [-1, 0, -1],
      [0, 1, 1],
      [0, 1, -1],
      [0, -1, 1],
      [0, -1, -1],
      // Vertex neighbors (8)
      [1, 1, 1],
      [1, 1, -1],
      [1, -1, 1],
      [1, -1, -1],
      [-1, 1, 1],
      [-1, 1, -1],
      [-1, -1, 1],
      [-1, -1, -1],
    ];

    const nodeMap = new Map<string, GraphNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    for (const node of nodes) {
      for (const offset of neighborOffsets) {
        const neighborPos = {
          x: node.position.x + offset[0] * gridSize,
          y: node.position.y + offset[1] * gridSize,
          z: node.position.z + offset[2] * gridSize,
        };

        const neighborId = this.getNodeId(neighborPos.x, neighborPos.y, neighborPos.z, gridSize);
        const neighbor = nodeMap.get(neighborId);

        if (neighbor) {
          const distance = this.getDistance(node, neighbor);
          const valid = this.validateEdge(node, neighbor, _constraints);

          edges.push({
            from: node.id,
            to: neighbor.id,
            weight: distance,
            valid,
          });
        }
      }
    }
  }

  /**
   * Generate unique node ID from position
   * @param gridSize Grid cell size for rounding precision
   */
  private getNodeId(x: number, y: number, z: number, gridSize: number): string {
    // Round to grid precision
    const gx = Math.round(x / gridSize) * gridSize;
    const gy = Math.round(y / gridSize) * gridSize;
    const gz = Math.round(z / gridSize) * gridSize;
    return `node_${gx.toFixed(3)}_${gy.toFixed(3)}_${gz.toFixed(3)}`;
  }
}

