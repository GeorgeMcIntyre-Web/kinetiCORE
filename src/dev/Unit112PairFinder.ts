/**
 * Unit 112 Pair Finder - Geometry-Based Joint Detection
 *
 * Finds joint pairs using ONLY geometric analysis:
 * - Similar vertex counts
 * - Similar bounding box dimensions
 * - Different spatial positions
 *
 * NO assumptions about node names (NO CNF!)
 *
 * Owner: George (Agent 1 - Claude Code)
 */

import * as BABYLON from '@babylonjs/core';

export interface GeometricNode {
  path: string;
  name: string;
  node: BABYLON.Node;
  totalVertices: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
    center: [number, number, number];
  };
}

export interface JointPairCandidate {
  node1: GeometricNode;
  node2: GeometricNode;
  geometricSimilarity: number;
  centerDistance: number;
  vertexCountDiff: number;
  dimensionSimilarity: number;
  isProbableJoint: boolean;
}

export class Unit112PairFinder {
  private scene: BABYLON.Scene;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Find all geometric pairs in UNIT_112 using pure geometry analysis
   */
  findPairs(): void {
    const unit112 = this.scene.getTransformNodeByName('UNIT_112');
    if (!unit112) {
      console.error('[Unit112PairFinder] UNIT_112 not found in scene');
      return;
    }

    console.log('\n========================================');
    console.log('UNIT_112 GEOMETRY-BASED PAIR DETECTION');
    console.log('========================================\n');

    // Step 1: Collect ALL nodes with significant geometry
    const geometricNodes = this.collectGeometricNodes(unit112);

    console.log(`Found ${geometricNodes.length} nodes with geometry:\n`);

    for (const node of geometricNodes) {
      console.log(`  ${node.path}`);
      console.log(`    Vertices: ${node.totalVertices}`);
      console.log(`    Center: [${node.boundingBox.center.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`    Size: [${node.boundingBox.size.map(v => v.toFixed(2)).join(', ')}]`);
      console.log('');
    }

    // Step 2: Compare all pairs for geometric similarity
    console.log('========================================');
    console.log('GEOMETRIC SIMILARITY ANALYSIS');
    console.log('========================================\n');

    const pairs = this.findAllPairs(geometricNodes);

    // Step 3: Filter for probable joints
    console.log('========================================');
    console.log('PROBABLE JOINT PAIRS');
    console.log('========================================\n');

    const probableJoints = pairs.filter(p => p.isProbableJoint);

    if (probableJoints.length === 0) {
      console.warn('No probable joint pairs found!');
      return;
    }

    for (const pair of probableJoints) {
      console.log(`Joint Pair Found (${(pair.geometricSimilarity * 100).toFixed(1)}% similarity):`);
      console.log(`  Node 1: ${pair.node1.path}`);
      console.log(`    Vertices: ${pair.node1.totalVertices}`);
      console.log(`    Center: [${pair.node1.boundingBox.center.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`  Node 2: ${pair.node2.path}`);
      console.log(`    Vertices: ${pair.node2.totalVertices}`);
      console.log(`    Center: [${pair.node2.boundingBox.center.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`  Metrics:`);
      console.log(`    Geometric Similarity: ${(pair.geometricSimilarity * 100).toFixed(1)}%`);
      console.log(`    Dimension Similarity: ${(pair.dimensionSimilarity * 100).toFixed(1)}%`);
      console.log(`    Vertex Count Diff: ${pair.vertexCountDiff}`);
      console.log(`    Center Distance: ${pair.centerDistance.toFixed(3)} m`);
      console.log('');
    }

    // Step 4: Classify by side (LH vs RH) based on position
    this.classifyBySide(probableJoints);
  }

  /**
   * Collect all nodes with significant geometry under UNIT_112
   */
  private collectGeometricNodes(rootNode: BABYLON.Node): GeometricNode[] {
    const results: GeometricNode[] = [];
    const minVertices = 1000; // Filter out small geometry

    this.traverseAndCollect(rootNode, 'UNIT_112', results, minVertices);

    // Sort by vertex count for easier analysis
    results.sort((a, b) => a.totalVertices - b.totalVertices);

    return results;
  }

  /**
   * Recursively traverse tree and collect nodes with geometry
   */
  private traverseAndCollect(
    node: BABYLON.Node,
    path: string,
    results: GeometricNode[],
    minVertices: number
  ): void {
    // Get all meshes under this node
    const meshes = node.getChildMeshes(true);

    if (meshes.length > 0) {
      // Calculate total vertices
      let totalVertices = 0;
      for (const mesh of meshes) {
        if (mesh.getTotalVertices) {
          totalVertices += mesh.getTotalVertices();
        }
      }

      // Only include if significant geometry
      if (totalVertices >= minVertices) {
        const boundingBox = this.calculateBoundingBox(meshes);
        if (boundingBox) {
          results.push({
            path,
            name: node.name,
            node,
            totalVertices,
            boundingBox,
          });
        }
      }
    }

    // Recurse into direct children
    const children = node.getChildren(undefined, false);
    for (const child of children) {
      const childPath = `${path}/${child.name}`;
      this.traverseAndCollect(child, childPath, results, minVertices);
    }
  }

  /**
   * Calculate bounding box from mesh array
   */
  private calculateBoundingBox(meshes: BABYLON.AbstractMesh[]): {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
    center: [number, number, number];
  } | null {
    if (meshes.length === 0) return null;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();
      const vectors = boundingInfo.boundingBox.vectorsWorld;

      for (const v of vectors) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        minZ = Math.min(minZ, v.z);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
        maxZ = Math.max(maxZ, v.z);
      }
    }

    if (minX === Infinity) return null;

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      size: [maxX - minX, maxY - minY, maxZ - minZ],
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    };
  }

  /**
   * Find all pairs and calculate geometric similarity
   */
  private findAllPairs(nodes: GeometricNode[]): JointPairCandidate[] {
    const pairs: JointPairCandidate[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        // Calculate metrics
        const metrics = this.calculatePairMetrics(node1, node2);

        // Criteria for probable joint:
        // 1. High geometric similarity (>90%)
        // 2. Similar vertex counts (<10% difference)
        // 3. Not too close (>0.01m apart - they're at different positions)
        // 4. Not too far (exclude unrelated parts)
        const isProbableJoint =
          metrics.geometricSimilarity > 0.90 &&
          metrics.vertexCountDiff < node1.totalVertices * 0.10 &&
          metrics.centerDistance > 0.01 &&
          metrics.centerDistance < 1.0; // Reasonable workspace size

        pairs.push({
          node1,
          node2,
          geometricSimilarity: metrics.geometricSimilarity,
          centerDistance: metrics.centerDistance,
          vertexCountDiff: metrics.vertexCountDiff,
          dimensionSimilarity: metrics.dimensionSimilarity,
          isProbableJoint,
        });
      }
    }

    // Sort by geometric similarity
    pairs.sort((a, b) => b.geometricSimilarity - a.geometricSimilarity);

    return pairs;
  }

  /**
   * Calculate all metrics for a pair
   */
  private calculatePairMetrics(
    node1: GeometricNode,
    node2: GeometricNode
  ): {
    geometricSimilarity: number;
    dimensionSimilarity: number;
    centerDistance: number;
    vertexCountDiff: number;
  } {
    // Dimension similarity (rotation-invariant)
    const dims1 = [...node1.boundingBox.size].sort((a, b) => a - b);
    const dims2 = [...node2.boundingBox.size].sort((a, b) => a - b);

    const dimSim =
      (1.0 - Math.abs(dims1[0] - dims2[0]) / Math.max(dims1[0], dims2[0], 1e-6)) *
      (1.0 - Math.abs(dims1[1] - dims2[1]) / Math.max(dims1[1], dims2[1], 1e-6)) *
      (1.0 - Math.abs(dims1[2] - dims2[2]) / Math.max(dims1[2], dims2[2], 1e-6));

    // Vertex count similarity
    const vertexDiff = Math.abs(node1.totalVertices - node2.totalVertices);
    const vertexSim =
      1.0 - vertexDiff / Math.max(node1.totalVertices, node2.totalVertices, 1);

    // Combined geometric similarity
    const geometricSimilarity = 0.7 * dimSim + 0.3 * vertexSim;

    // Center distance
    const c1 = node1.boundingBox.center;
    const c2 = node2.boundingBox.center;
    const centerDistance = Math.sqrt(
      Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2) + Math.pow(c1[2] - c2[2], 2)
    );

    return {
      geometricSimilarity,
      dimensionSimilarity: dimSim,
      centerDistance,
      vertexCountDiff: vertexDiff,
    };
  }

  /**
   * Classify pairs by side (LH vs RH) based on Z position
   */
  private classifyBySide(pairs: JointPairCandidate[]): void {
    if (pairs.length === 0) return;

    console.log('========================================');
    console.log('JOINT CLASSIFICATION');
    console.log('========================================\n');

    for (const pair of pairs) {
      const z1 = pair.node1.boundingBox.center[2];
      const z2 = pair.node2.boundingBox.center[2];
      const avgZ = (z1 + z2) / 2;

      const side = avgZ > 0 ? 'LH (Left Hand)' : 'RH (Right Hand)';
      const jointType = 'Revolute (Rotating)';

      console.log(`${side} - ${jointType}`);
      console.log(`  State 1: ${pair.node1.path}`);
      console.log(`  State 2: ${pair.node2.path}`);
      console.log(`  Confidence: ${(pair.geometricSimilarity * 100).toFixed(1)}%`);
      console.log('');
    }
  }
}
