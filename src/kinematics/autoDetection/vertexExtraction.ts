/**
 * Step 3: World-Space Vertex Extraction from GLB Files
 *
 * Extracts vertex positions from Babylon.js meshes and transforms them to world space.
 * This is the critical missing piece that enables ICP registration (Step 4).
 */

import * as BABYLON from '@babylonjs/core';
import type { GLBTreeData } from './types';

export interface VertexExtractionConfig {
  maxVerticesPerMesh?: number;  // Limit for performance
  subsampleRatio?: number;      // 0.1 = use 10% of vertices
  verbose?: boolean;
}

const DEFAULT_CONFIG: Required<VertexExtractionConfig> = {
  maxVerticesPerMesh: 50000,
  subsampleRatio: 1.0,  // Use all vertices by default
  verbose: false,
};

/**
 * Extract world-space vertices for a subtree (node and all descendants).
 *
 * This function:
 * 1. Finds all meshes in the subtree using Babylon scene
 * 2. Extracts vertex positions from each mesh
 * 3. Transforms vertices to world space using node transforms
 * 4. Combines into a single Float32Array
 *
 * @param scene - Babylon scene containing the loaded GLB
 * @param data - GLB tree data with node hierarchy
 * @param nodeIndex - Root node of subtree to extract
 * @param config - Extraction configuration
 * @returns Float32Array of world-space vertices [x1,y1,z1, x2,y2,z2, ...]
 */
export function extractWorldSpaceVertices(
  scene: BABYLON.Scene,
  data: GLBTreeData,
  nodeIndex: number,
  config: Partial<VertexExtractionConfig> = {}
): Float32Array {
  // Input validation
  if (!scene) {
    console.error('[VertexExtraction] Scene is null or undefined');
    return new Float32Array(0);
  }
  if (!data || !data.nodes) {
    console.error('[VertexExtraction] Invalid GLB tree data');
    return new Float32Array(0);
  }
  if (nodeIndex < 0 || nodeIndex >= data.nodes.length) {
    console.error(`[VertexExtraction] Invalid node index: ${nodeIndex} (valid range: 0-${data.nodes.length - 1})`);
    return new Float32Array(0);
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const node = data.nodes[nodeIndex];

  if (cfg.verbose) {
    console.log(`[VertexExtraction] Extracting vertices for node ${nodeIndex}: ${node.name}`);
  }

  // Find all descendant nodes (including this node)
  const subtreeNodes = getSubtreeNodes(data, nodeIndex);

  if (cfg.verbose) {
    console.log(`[VertexExtraction] Found ${subtreeNodes.length} nodes in subtree`);
  }

  // Collect vertices from all meshes in the subtree
  const allVertices: number[] = [];
  let meshCount = 0;

  for (const descendantIndex of subtreeNodes) {
    const descendant = data.nodes[descendantIndex];

    if (descendant.meshIndex !== null && descendant.meshIndex !== undefined) {
      // Find the Babylon mesh by index
      const babylonMesh = findBabylonMeshByIndex(scene, descendant.meshIndex, descendant.name);

      if (babylonMesh) {
        const vertices = extractMeshVertices(babylonMesh, cfg);
        allVertices.push(...vertices);
        meshCount++;

        if (cfg.verbose) {
          console.log(
            `[VertexExtraction]   Node ${descendantIndex} (${descendant.name}): ${vertices.length / 3} vertices`
          );
        }
      } else if (cfg.verbose) {
        console.warn(
          `[VertexExtraction]   Node ${descendantIndex} (${descendant.name}): Mesh not found in scene`
        );
      }
    }
  }

  if (cfg.verbose) {
    console.log(
      `[VertexExtraction] Total: ${allVertices.length / 3} vertices from ${meshCount} meshes`
    );
  }

  return new Float32Array(allVertices);
}

/**
 * Get all nodes in a subtree (node + descendants)
 */
function getSubtreeNodes(data: GLBTreeData, nodeIndex: number): number[] {
  const result: number[] = [nodeIndex];
  const node = data.nodes[nodeIndex];

  for (const childIndex of node.childrenIndices) {
    result.push(...getSubtreeNodes(data, childIndex));
  }

  return result;
}

/**
 * Find Babylon mesh by GLB mesh index.
 *
 * Uses GLTF metadata to correctly map mesh indices.
 * Babylon.js stores the original GLTF pointer in _internalMetadata.gltf.pointers.
 */
function findBabylonMeshByIndex(
  scene: BABYLON.Scene,
  meshIndex: number,
  nodeName: string
): BABYLON.AbstractMesh | null {
  // Strategy 1: Find mesh by GLTF mesh index using internal metadata
  // The pointer format is "/meshes/{meshIndex}/primitives/{primitiveIndex}"
  const targetPointer = `/meshes/${meshIndex}/primitives/0`;

  for (const mesh of scene.meshes) {
    const internalMetadata = (mesh as any)._internalMetadata;
    if (internalMetadata?.gltf?.pointers) {
      const pointers = internalMetadata.gltf.pointers as string[];
      if (pointers.some(p => p === targetPointer)) {
        if (hasVertexData(mesh)) {
          return mesh;
        }
      }
    }
  }

  // Strategy 2 (Fallback): Find mesh with matching name
  const meshByName = scene.meshes.find((m) => m.name === nodeName);
  if (meshByName && hasVertexData(meshByName)) {
    return meshByName;
  }

  // Strategy 3 (Fallback): Find mesh that's a child of a node with matching name
  const transformNode = scene.transformNodes.find((n) => n.name === nodeName);
  if (transformNode) {
    const childMeshes = transformNode.getChildMeshes(false); // Direct children only
    if (childMeshes.length > 0 && hasVertexData(childMeshes[0])) {
      return childMeshes[0];
    }
  }

  return null;
}

/**
 * Check if mesh has vertex data
 */
function hasVertexData(mesh: BABYLON.AbstractMesh): boolean {
  if (!(mesh instanceof BABYLON.Mesh)) return false;

  const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  return positions !== null && positions.length > 0;
}

/**
 * Extract world-space vertices from a Babylon mesh
 */
function extractMeshVertices(
  mesh: BABYLON.AbstractMesh,
  config: Required<VertexExtractionConfig>
): number[] {
  if (!(mesh instanceof BABYLON.Mesh)) {
    return [];
  }

  // Get local-space vertex positions
  const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  if (!positions || positions.length === 0) {
    return [];
  }

  // Ensure world matrix is up to date
  mesh.computeWorldMatrix(true);
  const worldMatrix = mesh.getWorldMatrix();

  // Transform vertices to world space
  const worldVertices: number[] = [];
  const vertexCount = positions.length / 3;

  // Subsample if needed
  const step = Math.max(1, Math.floor(1 / config.subsampleRatio));
  const maxVertices = Math.min(
    vertexCount,
    Math.floor(config.maxVerticesPerMesh * config.subsampleRatio)
  );

  for (let i = 0; i < vertexCount && worldVertices.length / 3 < maxVertices; i += step) {
    const idx = i * 3;
    const localPos = new BABYLON.Vector3(positions[idx], positions[idx + 1], positions[idx + 2]);

    // Transform to world space
    const worldPos = BABYLON.Vector3.TransformCoordinates(localPos, worldMatrix);

    worldVertices.push(worldPos.x, worldPos.y, worldPos.z);
  }

  return worldVertices;
}

/**
 * Helper: Extract vertices for a pose pair (two matching subtrees).
 *
 * Returns vertices for both the "closed" and "open" poses of a moving part.
 *
 * @param scene - Babylon scene
 * @param data - GLB tree data
 * @param poseAIndex - First pose node index
 * @param poseBIndex - Second pose node index
 * @param config - Extraction configuration
 */
export function extractPosePairVertices(
  scene: BABYLON.Scene,
  data: GLBTreeData,
  poseAIndex: number,
  poseBIndex: number,
  config: Partial<VertexExtractionConfig> = {}
): {
  poseA: Float32Array;
  poseB: Float32Array;
} {
  return {
    poseA: extractWorldSpaceVertices(scene, data, poseAIndex, config),
    poseB: extractWorldSpaceVertices(scene, data, poseBIndex, config),
  };
}

/**
 * Debug: Log vertex extraction statistics for a node
 */
export function debugVertexExtraction(
  scene: BABYLON.Scene,
  data: GLBTreeData,
  nodeIndex: number
): void {
  console.group(`🔍 Vertex Extraction Debug: Node ${nodeIndex}`);

  const node = data.nodes[nodeIndex];
  console.log(`Node name: ${node.name}`);
  console.log(`Point count (from JSON): ${node.pointCount}`);
  console.log(`Subtree point count (from JSON): ${node.subtreePointCount}`);

  const vertices = extractWorldSpaceVertices(scene, data, nodeIndex, { verbose: true });
  console.log(`Extracted vertices: ${vertices.length / 3}`);

  if (vertices.length > 0) {
    // Compute bounding box
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
      minX = Math.min(minX, vertices[i]);
      minY = Math.min(minY, vertices[i + 1]);
      minZ = Math.min(minZ, vertices[i + 2]);
      maxX = Math.max(maxX, vertices[i]);
      maxY = Math.max(maxY, vertices[i + 1]);
      maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    console.log(`Bounding box:`);
    console.log(`  X: [${minX.toFixed(3)}, ${maxX.toFixed(3)}]`);
    console.log(`  Y: [${minY.toFixed(3)}, ${maxY.toFixed(3)}]`);
    console.log(`  Z: [${minZ.toFixed(3)}, ${maxZ.toFixed(3)}]`);
  }

  console.groupEnd();
}
