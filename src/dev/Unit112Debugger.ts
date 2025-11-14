/**
 * Unit 112 Debugger
 *
 * Deep analysis tool to understand the ACTUAL structure and geometry
 * of UNIT_112 without making assumptions about node names.
 *
 * Owner: George (Agent 1 - Claude Code)
 */

import * as BABYLON from '@babylonjs/core';

export interface NodeGeometryInfo {
  path: string;
  name: string;
  meshCount: number;
  totalVertices: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
    center: [number, number, number];
  } | null;
  children: NodeGeometryInfo[];
}

export class Unit112Debugger {
  private scene: BABYLON.Scene;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Analyze UNIT_112 completely - no assumptions
   */
  analyzeUnit112(): void {
    const unit112 = this.scene.getTransformNodeByName('UNIT_112');
    if (!unit112) {
      console.error('[Unit112Debugger] UNIT_112 not found in scene');
      return;
    }

    console.log('\n========================================');
    console.log('UNIT_112 COMPLETE ANALYSIS');
    console.log('========================================\n');

    // Get complete tree structure with geometry info
    const tree = this.buildGeometryTree(unit112, 'UNIT_112');

    // Print the tree
    this.printGeometryTree(tree, 0);

    // Find all nodes with geometry
    const nodesWithGeometry = this.findNodesWithGeometry(tree);

    console.log('\n========================================');
    console.log('NODES WITH GEOMETRY (mesh count > 0)');
    console.log('========================================\n');

    for (const node of nodesWithGeometry) {
      console.log(`Path: ${node.path}`);
      console.log(`  Meshes: ${node.meshCount}`);
      console.log(`  Vertices: ${node.totalVertices}`);
      if (node.boundingBox) {
        console.log(`  Center: [${node.boundingBox.center.map(v => v.toFixed(1)).join(', ')}]`);
        console.log(`  Size: [${node.boundingBox.size.map(v => v.toFixed(1)).join(', ')}]`);
      }
      console.log('');
    }

    // Group by geometric similarity
    console.log('\n========================================');
    console.log('GEOMETRIC SIMILARITY ANALYSIS');
    console.log('========================================\n');

    this.findGeometricPairs(nodesWithGeometry);
  }

  /**
   * Build complete tree with geometry information
   */
  private buildGeometryTree(node: BABYLON.Node, path: string): NodeGeometryInfo {
    const meshes = node.getChildMeshes(true);
    const directMeshes = node.getChildMeshes(false);

    let totalVertices = 0;
    let boundingBox = null;

    if (meshes.length > 0) {
      // Calculate total vertices
      for (const mesh of meshes) {
        if (mesh.getTotalVertices) {
          totalVertices += mesh.getTotalVertices();
        }
      }

      // Calculate bounding box
      boundingBox = this.calculateBoundingBox(meshes);
    }

    const children: NodeGeometryInfo[] = [];
    const directChildren = node.getChildren(undefined, false);

    for (const child of directChildren) {
      const childPath = `${path}/${child.name}`;
      children.push(this.buildGeometryTree(child, childPath));
    }

    return {
      path,
      name: node.name,
      meshCount: directMeshes.length,
      totalVertices,
      boundingBox,
      children,
    };
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
   * Print geometry tree with indentation
   */
  private printGeometryTree(node: NodeGeometryInfo, depth: number): void {
    const indent = '  '.repeat(depth);
    const hasGeometry = node.meshCount > 0 || node.totalVertices > 0;
    const marker = hasGeometry ? '📦' : '📁';

    let line = `${indent}${marker} ${node.name}`;

    if (hasGeometry) {
      line += ` [${node.meshCount} meshes, ${node.totalVertices} vertices]`;
    }

    console.log(line);

    for (const child of node.children) {
      this.printGeometryTree(child, depth + 1);
    }
  }

  /**
   * Find all nodes that have geometry
   */
  private findNodesWithGeometry(node: NodeGeometryInfo): NodeGeometryInfo[] {
    const results: NodeGeometryInfo[] = [];

    if (node.totalVertices > 0) {
      results.push(node);
    }

    for (const child of node.children) {
      results.push(...this.findNodesWithGeometry(child));
    }

    return results;
  }

  /**
   * Find pairs based on geometric similarity
   */
  private findGeometricPairs(nodes: NodeGeometryInfo[]): void {
    const pairs: Array<{
      node1: NodeGeometryInfo;
      node2: NodeGeometryInfo;
      similarity: number;
      centerDistance: number;
    }> = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        if (!node1.boundingBox || !node2.boundingBox) continue;

        // Compare bounding box dimensions (rotation-invariant)
        const dims1 = [...node1.boundingBox.size].sort((a, b) => a - b);
        const dims2 = [...node2.boundingBox.size].sort((a, b) => a - b);

        // Dimension similarity
        const dimSim =
          (1.0 - Math.abs(dims1[0] - dims2[0]) / Math.max(dims1[0], dims2[0], 1e-6)) *
          (1.0 - Math.abs(dims1[1] - dims2[1]) / Math.max(dims1[1], dims2[1], 1e-6)) *
          (1.0 - Math.abs(dims1[2] - dims2[2]) / Math.max(dims1[2], dims2[2], 1e-6));

        // Vertex count similarity
        const vertexSim = 1.0 - Math.abs(node1.totalVertices - node2.totalVertices) /
          Math.max(node1.totalVertices, node2.totalVertices, 1);

        // Combined similarity
        const similarity = 0.7 * dimSim + 0.3 * vertexSim;

        // Center distance
        const c1 = node1.boundingBox.center;
        const c2 = node2.boundingBox.center;
        const centerDistance = Math.sqrt(
          Math.pow(c1[0] - c2[0], 2) +
          Math.pow(c1[1] - c2[1], 2) +
          Math.pow(c1[2] - c2[2], 2)
        );

        // Only report high similarity pairs
        if (similarity > 0.80) {
          pairs.push({ node1, node2, similarity, centerDistance });
        }
      }
    }

    // Sort by similarity
    pairs.sort((a, b) => b.similarity - a.similarity);

    console.log(`Found ${pairs.length} potential pairs with >80% similarity:\n`);

    for (const pair of pairs.slice(0, 10)) {
      console.log(`Similarity: ${(pair.similarity * 100).toFixed(1)}%`);
      console.log(`  Node 1: ${pair.node1.path}`);
      console.log(`    Vertices: ${pair.node1.totalVertices}`);
      console.log(`    Center: [${pair.node1.boundingBox!.center.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`  Node 2: ${pair.node2.path}`);
      console.log(`    Vertices: ${pair.node2.totalVertices}`);
      console.log(`    Center: [${pair.node2.boundingBox!.center.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`  Center Distance: ${pair.centerDistance.toFixed(1)} mm`);
      console.log('');
    }
  }
}
