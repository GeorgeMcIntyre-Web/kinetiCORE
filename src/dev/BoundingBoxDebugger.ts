/**
 * Bounding Box Debugger
 *
 * Visualizes bounding boxes and compares them between nodes
 * to help debug geometric matching.
 *
 * Owner: George (Agent 1 - Claude Code)
 */

import * as BABYLON from '@babylonjs/core';

export interface BoundingBoxComparison {
  node1: {
    name: string;
    bbox: {
      min: BABYLON.Vector3;
      max: BABYLON.Vector3;
      size: BABYLON.Vector3;
      center: BABYLON.Vector3;
    };
    sortedDimensions: [number, number, number];
    volume: number;
  };
  node2: {
    name: string;
    bbox: {
      min: BABYLON.Vector3;
      max: BABYLON.Vector3;
      size: BABYLON.Vector3;
      center: BABYLON.Vector3;
    };
    sortedDimensions: [number, number, number];
    volume: number;
  };
  similarity: number; // 0-1
  dimensionDifferences: [number, number, number]; // Absolute differences in sorted dimensions
  volumeDifference: number; // Absolute difference in volume
  centerDistance: number; // Distance between centers
  match: boolean; // true if similarity >= threshold
}

export class BoundingBoxDebugger {
  private scene: BABYLON.Scene;
  private debugMeshes: BABYLON.Mesh[] = [];

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Show bounding box for a node
   */
  showBoundingBox(
    nodeName: string,
    color: BABYLON.Color3 = BABYLON.Color3.Green(),
    label: string = ''
  ): void {
    const node = this.scene.getTransformNodeByName(nodeName);
    if (!node) {
      console.error(`[BBoxDebug] Node not found: ${nodeName}`);
      return;
    }

    const bbox = this.computeBoundingBox(node);
    if (!bbox) {
      console.error(`[BBoxDebug] No geometry found for node: ${nodeName}`);
      return;
    }

    // Create bounding box wireframe
    const boxMesh = BABYLON.MeshBuilder.CreateBox(
      `bbox_${nodeName}`,
      {
        width: bbox.size.x,
        height: bbox.size.y,
        depth: bbox.size.z,
      },
      this.scene
    );

    boxMesh.position = bbox.center;
    boxMesh.isPickable = false;

    // Create wireframe material
    const material = new BABYLON.StandardMaterial(`bbox_mat_${nodeName}`, this.scene);
    material.wireframe = true;
    material.emissiveColor = color;
    material.disableLighting = true;
    boxMesh.material = material;

    this.debugMeshes.push(boxMesh);

    // Add label
    if (label || nodeName) {
      const textLabel = label || nodeName;
      console.log(`[BBoxDebug] ${textLabel}:`);
      console.log(`  Center: (${bbox.center.x.toFixed(3)}, ${bbox.center.y.toFixed(3)}, ${bbox.center.z.toFixed(3)})`);
      console.log(`  Size: (${bbox.size.x.toFixed(3)}, ${bbox.size.y.toFixed(3)}, ${bbox.size.z.toFixed(3)})`);
      console.log(`  Volume: ${(bbox.size.x * bbox.size.y * bbox.size.z).toFixed(6)} m³`);
    }
  }

  /**
   * Compare bounding boxes of two nodes
   */
  compareBoundingBoxes(
    nodeName1: string,
    nodeName2: string,
    similarityThreshold: number = 0.90
  ): BoundingBoxComparison | null {
    const node1 = this.scene.getTransformNodeByName(nodeName1);
    const node2 = this.scene.getTransformNodeByName(nodeName2);

    if (!node1 || !node2) {
      console.error(`[BBoxDebug] One or both nodes not found: ${nodeName1}, ${nodeName2}`);
      return null;
    }

    const bbox1 = this.computeBoundingBox(node1);
    const bbox2 = this.computeBoundingBox(node2);

    if (!bbox1 || !bbox2) {
      console.error(`[BBoxDebug] No geometry found for one or both nodes`);
      return null;
    }

    // Compute sorted dimensions (rotation-invariant)
    const dims1 = [bbox1.size.x, bbox1.size.y, bbox1.size.z].sort((a, b) => a - b) as [number, number, number];
    const dims2 = [bbox2.size.x, bbox2.size.y, bbox2.size.z].sort((a, b) => a - b) as [number, number, number];

    const vol1 = bbox1.size.x * bbox1.size.y * bbox1.size.z;
    const vol2 = bbox2.size.x * bbox2.size.y * bbox2.size.z;

    // Compute similarity
    const dimSimilarity =
      (1.0 - Math.abs(dims1[0] - dims2[0]) / Math.max(dims1[0], dims2[0], 1e-6)) *
      (1.0 - Math.abs(dims1[1] - dims2[1]) / Math.max(dims1[1], dims2[1], 1e-6)) *
      (1.0 - Math.abs(dims1[2] - dims2[2]) / Math.max(dims1[2], dims2[2], 1e-6));

    const volSimilarity = 1.0 - Math.abs(vol1 - vol2) / Math.max(vol1, vol2, 1e-6);

    const similarity = 0.8 * dimSimilarity + 0.2 * volSimilarity;

    const comparison: BoundingBoxComparison = {
      node1: {
        name: nodeName1,
        bbox: {
          min: bbox1.min,
          max: bbox1.max,
          size: bbox1.size,
          center: bbox1.center,
        },
        sortedDimensions: dims1,
        volume: vol1,
      },
      node2: {
        name: nodeName2,
        bbox: {
          min: bbox2.min,
          max: bbox2.max,
          size: bbox2.size,
          center: bbox2.center,
        },
        sortedDimensions: dims2,
        volume: vol2,
      },
      similarity,
      dimensionDifferences: [
        Math.abs(dims1[0] - dims2[0]),
        Math.abs(dims1[1] - dims2[1]),
        Math.abs(dims1[2] - dims2[2]),
      ],
      volumeDifference: Math.abs(vol1 - vol2),
      centerDistance: BABYLON.Vector3.Distance(bbox1.center, bbox2.center),
      match: similarity >= similarityThreshold,
    };

    // Log comparison
    console.log('\n========================================');
    console.log(`BOUNDING BOX COMPARISON`);
    console.log('========================================');
    console.log(`Node 1: ${nodeName1}`);
    console.log(`  Sorted Dims: [${dims1.map(d => (d * 1000).toFixed(1)).join(', ')}] mm`);
    console.log(`  Volume: ${(vol1 * 1e9).toFixed(1)} mm³`);
    console.log(`  Center: (${bbox1.center.x.toFixed(3)}, ${bbox1.center.y.toFixed(3)}, ${bbox1.center.z.toFixed(3)}) m`);
    console.log('');
    console.log(`Node 2: ${nodeName2}`);
    console.log(`  Sorted Dims: [${dims2.map(d => (d * 1000).toFixed(1)).join(', ')}] mm`);
    console.log(`  Volume: ${(vol2 * 1e9).toFixed(1)} mm³`);
    console.log(`  Center: (${bbox2.center.x.toFixed(3)}, ${bbox2.center.y.toFixed(3)}, ${bbox2.center.z.toFixed(3)}) m`);
    console.log('');
    console.log('Differences:');
    console.log(`  Dim Diffs: [${comparison.dimensionDifferences.map(d => (d * 1000).toFixed(1)).join(', ')}] mm`);
    console.log(`  Vol Diff: ${(comparison.volumeDifference * 1e9).toFixed(1)} mm³`);
    console.log(`  Center Distance: ${(comparison.centerDistance * 1000).toFixed(1)} mm`);
    console.log('');
    console.log(`Similarity: ${(similarity * 100).toFixed(1)}%`);
    console.log(`Match (threshold ${(similarityThreshold * 100).toFixed(0)}%): ${comparison.match ? '✅ YES' : '❌ NO'}`);
    console.log('========================================\n');

    // Show bounding boxes
    this.showBoundingBox(nodeName1, BABYLON.Color3.Green(), 'Node 1 (Green)');
    this.showBoundingBox(nodeName2, BABYLON.Color3.Red(), 'Node 2 (Red)');

    return comparison;
  }

  /**
   * Show bounding boxes for all nodes matching a pattern
   */
  showAllBoundingBoxes(pattern?: string): void {
    const nodes = this.scene.transformNodes.filter(n => {
      if (!pattern) return true;
      return n.name.toLowerCase().includes(pattern.toLowerCase());
    });

    console.log(`[BBoxDebug] Showing bounding boxes for ${nodes.length} nodes`);

    const colors = [
      BABYLON.Color3.Red(),
      BABYLON.Color3.Green(),
      BABYLON.Color3.Blue(),
      BABYLON.Color3.Yellow(),
      BABYLON.Color3.Magenta(),
      new BABYLON.Color3(0, 1, 1), // Cyan
    ];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const color = colors[i % colors.length];
      this.showBoundingBox(node.name, color);
    }
  }

  /**
   * Clear all debug meshes
   */
  clear(): void {
    for (const mesh of this.debugMeshes) {
      mesh.dispose();
    }
    this.debugMeshes = [];
    console.log('[BBoxDebug] Cleared all debug meshes');
  }

  /**
   * Compute combined bounding box for a node and its children
   */
  private computeBoundingBox(node: BABYLON.TransformNode): {
    min: BABYLON.Vector3;
    max: BABYLON.Vector3;
    size: BABYLON.Vector3;
    center: BABYLON.Vector3;
  } | null {
    const meshes = node.getChildMeshes(false) as BABYLON.AbstractMesh[];

    if (meshes.length === 0) {
      return null;
    }

    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const bbox = mesh.getBoundingInfo().boundingBox;

      min = BABYLON.Vector3.Minimize(min, bbox.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bbox.maximumWorld);
    }

    const size = max.subtract(min);
    const center = min.add(max).scale(0.5);

    return { min, max, size, center };
  }

  /**
   * Find all potential pairs by bounding box similarity
   */
  findAllPairs(similarityThreshold: number = 0.90): Array<{
    node1: string;
    node2: string;
    similarity: number;
  }> {
    const nodes = this.scene.transformNodes.filter(n => {
      const meshes = n.getChildMeshes(false);
      return meshes.length > 0;
    });

    const pairs: Array<{ node1: string; node2: string; similarity: number }> = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const comparison = this.compareBoundingBoxesInternal(nodes[i], nodes[j]);
        if (comparison && comparison.similarity >= similarityThreshold) {
          pairs.push({
            node1: nodes[i].name,
            node2: nodes[j].name,
            similarity: comparison.similarity,
          });
        }
      }
    }

    // Sort by similarity (descending)
    pairs.sort((a, b) => b.similarity - a.similarity);

    console.log(`[BBoxDebug] Found ${pairs.length} pairs with similarity >= ${(similarityThreshold * 100).toFixed(0)}%`);
    for (const pair of pairs) {
      console.log(`  ${pair.node1} ↔ ${pair.node2}: ${(pair.similarity * 100).toFixed(1)}%`);
    }

    return pairs;
  }

  /**
   * Internal comparison (no logging)
   */
  private compareBoundingBoxesInternal(
    node1: BABYLON.TransformNode,
    node2: BABYLON.TransformNode
  ): { similarity: number } | null {
    const bbox1 = this.computeBoundingBox(node1);
    const bbox2 = this.computeBoundingBox(node2);

    if (!bbox1 || !bbox2) return null;

    const dims1 = [bbox1.size.x, bbox1.size.y, bbox1.size.z].sort((a, b) => a - b);
    const dims2 = [bbox2.size.x, bbox2.size.y, bbox2.size.z].sort((a, b) => a - b);

    const vol1 = bbox1.size.x * bbox1.size.y * bbox1.size.z;
    const vol2 = bbox2.size.x * bbox2.size.y * bbox2.size.z;

    const dimSimilarity =
      (1.0 - Math.abs(dims1[0] - dims2[0]) / Math.max(dims1[0], dims2[0], 1e-6)) *
      (1.0 - Math.abs(dims1[1] - dims2[1]) / Math.max(dims1[1], dims2[1], 1e-6)) *
      (1.0 - Math.abs(dims1[2] - dims2[2]) / Math.max(dims1[2], dims2[2], 1e-6));

    const volSimilarity = 1.0 - Math.abs(vol1 - vol2) / Math.max(vol1, vol2, 1e-6);

    const similarity = 0.8 * dimSimilarity + 0.2 * volSimilarity;

    return { similarity };
  }
}

// Export for window access
if (typeof window !== 'undefined') {
  (window as any).BoundingBoxDebugger = BoundingBoxDebugger;
}
