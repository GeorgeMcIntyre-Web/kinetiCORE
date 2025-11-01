// Search Graph - Builds navigation graph from scene obstacles for pathfinding
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import { Vector3 } from '../../core/types';
import { Graph, GraphNode, GraphEdge, RouteConstraints } from '../core/types';

/**
 * SearchGraph builds a navigation graph from scene geometry
 * Supports grid-based approach for MVP (can be extended to navmesh)
 */
export class SearchGraph {
  private gridSize: number = 0.5; // 0.5 unit grid spacing
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
   */
  buildGraph(
    start: Vector3,
    goal: Vector3,
    obstacles: BABYLON.Mesh[],
    constraints: RouteConstraints
  ): Graph {
    // Determine grid bounds
    this.calculateGridBounds(start, goal, constraints);

    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Create grid of nodes
    const nodeMap = this.createGridNodes(constraints);

    // Validate nodes against obstacles
    const validNodes = this.validateNodesAgainstObstacles(nodeMap, obstacles, constraints);

    // Add valid nodes to graph
    for (const node of validNodes) {
      nodes.set(node.id, node);
    }

    // Create edges between neighboring nodes
    this.createEdges(validNodes, constraints, edges);

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
   */
  private createGridNodes(_constraints: RouteConstraints): GraphNode[] {
    if (!this.gridBounds) return [];

    const nodes: GraphNode[] = [];

    // Create nodes in 3D grid
    for (
      let x = this.gridBounds.minX;
      x <= this.gridBounds.maxX;
      x += this.gridSize
    ) {
      for (
        let y = this.gridBounds.minY;
        y <= this.gridBounds.maxY;
        y += this.gridSize
      ) {
        for (
          let z = this.gridBounds.minZ;
          z <= this.gridBounds.maxZ;
          z += this.gridSize
        ) {
          nodes.push({
            id: this.getNodeId(x, y, z),
            position: { x, y, z },
          });
        }
      }
    }

    return nodes;
  }

  /**
   * Validate nodes against obstacles and constraints
   */
  private validateNodesAgainstObstacles(
    nodes: GraphNode[],
    obstacles: BABYLON.Mesh[],
    constraints: RouteConstraints
  ): GraphNode[] {
    const validNodes: GraphNode[] = [];
    const requiredClearance = constraints.clearance.otherInfrastructure;

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

      // Check clearance from walls/floor/ceiling if needed
      // This would require scene bounds information

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
   */
  private createEdges(
    nodes: GraphNode[],
    _constraints: RouteConstraints,
    edges: GraphEdge[]
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
          x: node.position.x + offset[0] * this.gridSize,
          y: node.position.y + offset[1] * this.gridSize,
          z: node.position.z + offset[2] * this.gridSize,
        };

        const neighborId = this.getNodeId(neighborPos.x, neighborPos.y, neighborPos.z);
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
   */
  private getNodeId(x: number, y: number, z: number): string {
    // Round to grid precision
    const gx = Math.round(x / this.gridSize) * this.gridSize;
    const gy = Math.round(y / this.gridSize) * this.gridSize;
    const gz = Math.round(z / this.gridSize) * this.gridSize;
    return `node_${gx.toFixed(2)}_${gy.toFixed(2)}_${gz.toFixed(2)}`;
  }
}

