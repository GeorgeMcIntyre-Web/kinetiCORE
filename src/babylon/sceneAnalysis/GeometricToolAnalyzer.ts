import * as BABYLON from '@babylonjs/core';
import { getWorldTransform } from '../utils/WorldSpace';
import type { ToolUnit, ToolGraph, ToolUnitType } from './ToolGraphAnalyzer';

/**
 * Configuration options for geometric-based tool unit analysis.
 */
export interface GeometricAnalyzeOptions {
  /**
   * Minimum bounding box volume (m³) to consider a node as significant.
   * Default: 0.0001 (1 cm³)
   */
  minVolume?: number;

  /**
   * Maximum distance (m) between nodes to group them as a single unit.
   * Default: 0.05 (5 cm)
   */
  clusteringDistance?: number;

  /**
   * Distance threshold (m) from world origin to classify as "fixed infrastructure".
   * Large assemblies near origin are likely fixed bases.
   * Default: 0.5 (50 cm)
   */
  fixedProximityThreshold?: number;

  /**
   * Minimum number of child connections to classify as "fixed infrastructure".
   * Highly connected nodes are likely structural.
   * Default: 3
   */
  fixedConnectivityThreshold?: number;

  /**
   * Geometric similarity threshold (0-1) to identify duplicate geometries.
   * Used to match moving parts with their fixed counterparts.
   * Default: 0.85 (85% similar)
   */
  similarityThreshold?: number;

  /**
   * Minimum distance (m) a node must be able to move to be classified as "moving".
   * Analyzed by comparing bounding box positions across potential states.
   * Default: 0.01 (1 cm)
   */
  minMovementThreshold?: number;
}

const DEFAULT_GEOMETRIC_OPTIONS: Required<GeometricAnalyzeOptions> = {
  minVolume: 0.0001,
  clusteringDistance: 0.05,
  fixedProximityThreshold: 0.5,
  fixedConnectivityThreshold: 3,
  similarityThreshold: 0.95, // Higher threshold for bounding box matching (orientation-invariant)
  minMovementThreshold: 0.01,
};

/**
 * Internal representation of a node cluster with computed geometric metrics.
 */
interface NodeCluster {
  nodes: BABYLON.TransformNode[];
  centroid: BABYLON.Vector3;
  totalVolume: number;
  boundingBox: BABYLON.BoundingBox;
  connectivity: number; // Number of child connections
  type?: ToolUnitType;
  isFixed?: boolean;
}

/**
 * Geometric properties of a mesh for similarity comparison.
 */
interface GeometricSignature {
  volume: number;
  surfaceArea: number;
  boundingBoxDimensions: BABYLON.Vector3;
  vertexCount: number;
  centroid: BABYLON.Vector3;
}

function uuid(): string {
  return 'tool_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
}

function nodeId(node: BABYLON.Node): string {
  // Prefer uniqueId (numerical, consistent) over name (can have duplicates) over id (optional string)
  if (node.uniqueId !== undefined) {
    return String(node.uniqueId);
  }
  if (node.id) {
    return String(node.id);
  }
  return node.name || 'unknown';
}

/**
 * Compute bounding box volume in cubic meters.
 */
function computeVolume(bbox: BABYLON.BoundingBox): number {
  const size = bbox.maximum.subtract(bbox.minimum);
  return Math.abs(size.x * size.y * size.z);
}

/**
 * Compute approximate surface area of bounding box.
 */
function computeSurfaceArea(bbox: BABYLON.BoundingBox): number {
  const size = bbox.maximum.subtract(bbox.minimum);
  return 2 * (size.x * size.y + size.y * size.z + size.z * size.x);
}

/**
 * Extract geometric signature from a mesh for similarity comparison.
 */
function computeGeometricSignature(node: BABYLON.TransformNode): GeometricSignature | null {
  if (!(node instanceof BABYLON.AbstractMesh)) {
    return null;
  }

  const mesh = node as BABYLON.AbstractMesh;
  mesh.computeWorldMatrix(true);
  const bbox = mesh.getBoundingInfo().boundingBox;

  const vertexCount = mesh.getTotalVertices();
  const volume = computeVolume(bbox);
  const surfaceArea = computeSurfaceArea(bbox);
  const dimensions = bbox.maximum.subtract(bbox.minimum);
  const centroid = bbox.center.clone();

  return {
    volume,
    surfaceArea,
    boundingBoxDimensions: dimensions,
    vertexCount,
    centroid,
  };
}

/**
 * Compute aggregate bounding box for a TransformNode (union of all descendant meshes).
 */
function computeAggregateBoundingBox(node: BABYLON.TransformNode): BABYLON.BoundingBox | null {
  const meshes: BABYLON.AbstractMesh[] = [];

  // Collect all descendant meshes
  const descendants = node.getDescendants(true);
  for (const desc of descendants) {
    if (desc instanceof BABYLON.AbstractMesh) {
      meshes.push(desc);
    }
  }

  // Also check if node itself is a mesh
  if (node instanceof BABYLON.AbstractMesh) {
    meshes.push(node);
  }

  if (meshes.length === 0) {
    return null;
  }

  // Compute union bounding box in world space
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    const worldMin = bbox.minimumWorld;
    const worldMax = bbox.maximumWorld;

    minX = Math.min(minX, worldMin.x);
    minY = Math.min(minY, worldMin.y);
    minZ = Math.min(minZ, worldMin.z);
    maxX = Math.max(maxX, worldMax.x);
    maxY = Math.max(maxY, worldMax.y);
    maxZ = Math.max(maxZ, worldMax.z);
  }

  const min = new BABYLON.Vector3(minX, minY, minZ);
  const max = new BABYLON.Vector3(maxX, maxY, maxZ);

  return new BABYLON.BoundingBox(min, max);
}

/**
 * Compute sorted dimensions (orientation-invariant) for bounding box matching.
 * Returns [small, medium, large] dimensions.
 */
function getSortedDimensions(bbox: BABYLON.BoundingBox): [number, number, number] {
  const size = bbox.maximum.subtract(bbox.minimum);
  const dims = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)];
  dims.sort((a, b) => a - b);
  return [dims[0], dims[1], dims[2]];
}

/**
 * Compute dimension similarity between two bounding boxes (orientation-invariant).
 * Returns 0-1 score (1 = identical dimensions, 0 = completely different).
 */
function computeDimensionSimilarity(bbox1: BABYLON.BoundingBox, bbox2: BABYLON.BoundingBox): number {
  const dims1 = getSortedDimensions(bbox1);
  const dims2 = getSortedDimensions(bbox2);

  // Compute relative difference for each dimension
  const diff0 = Math.abs(dims1[0] - dims2[0]) / Math.max(dims1[0], dims2[0], 0.001);
  const diff1 = Math.abs(dims1[1] - dims2[1]) / Math.max(dims1[1], dims2[1], 0.001);
  const diff2 = Math.abs(dims1[2] - dims2[2]) / Math.max(dims1[2], dims2[2], 0.001);

  // Weighted average (larger dimensions are more important)
  const weightedDiff = (diff0 * 0.2 + diff1 * 0.3 + diff2 * 0.5);

  return Math.max(0, 1 - weightedDiff);
}

/**
 * Compute geometric similarity score (0-1) between two signatures.
 * Returns 1 for identical geometries, 0 for completely different.
 */
function computeSimilarity(sig1: GeometricSignature, sig2: GeometricSignature): number {
  // Volume similarity
  const volumeRatio = Math.min(sig1.volume, sig2.volume) / Math.max(sig1.volume, sig2.volume);

  // Surface area similarity
  const areaRatio = Math.min(sig1.surfaceArea, sig2.surfaceArea) / Math.max(sig1.surfaceArea, sig2.surfaceArea);

  // Bounding box dimension similarity (shape)
  const d1 = sig1.boundingBoxDimensions;
  const d2 = sig2.boundingBoxDimensions;
  const dimDiff = Math.abs(d1.x - d2.x) + Math.abs(d1.y - d2.y) + Math.abs(d1.z - d2.z);
  const dimSum = d1.x + d1.y + d1.z + d2.x + d2.y + d2.z;
  const dimSimilarity = dimSum > 0 ? 1 - (dimDiff / dimSum) : 0;

  // Vertex count similarity (complexity)
  const vertexRatio = Math.min(sig1.vertexCount, sig2.vertexCount) / Math.max(sig1.vertexCount, sig2.vertexCount);

  // Weighted average (shape is most important, then volume)
  return (dimSimilarity * 0.4) + (volumeRatio * 0.3) + (areaRatio * 0.2) + (vertexRatio * 0.1);
}

/**
 * Group spatially close nodes into clusters using simple proximity-based clustering.
 */
function clusterBySpatialProximity(
  nodes: BABYLON.TransformNode[],
  maxDistance: number
): NodeCluster[] {
  const clusters: NodeCluster[] = [];
  const assigned = new Set<BABYLON.TransformNode>();

  for (const node of nodes) {
    if (assigned.has(node)) continue;

    node.computeWorldMatrix(true);
    const nodePos = node.getAbsolutePosition();

    // Find all nodes within maxDistance
    const clusterNodes: BABYLON.TransformNode[] = [node];
    assigned.add(node);

    for (const other of nodes) {
      if (assigned.has(other)) continue;

      other.computeWorldMatrix(true);
      const otherPos = other.getAbsolutePosition();
      const distance = BABYLON.Vector3.Distance(nodePos, otherPos);

      if (distance <= maxDistance) {
        clusterNodes.push(other);
        assigned.add(other);
      }
    }

    // Compute cluster metrics
    const positions = clusterNodes.map(n => {
      n.computeWorldMatrix(true);
      return n.getAbsolutePosition();
    });

    const centroid = positions.reduce(
      (sum, p) => sum.add(p),
      BABYLON.Vector3.Zero()
    ).scale(1 / positions.length);

    // Compute combined bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const n of clusterNodes) {
      if (!(n instanceof BABYLON.AbstractMesh)) continue;
      const mesh = n as BABYLON.AbstractMesh;
      mesh.computeWorldMatrix(true);
      const bbox = mesh.getBoundingInfo().boundingBox;

      minX = Math.min(minX, bbox.minimum.x);
      minY = Math.min(minY, bbox.minimum.y);
      minZ = Math.min(minZ, bbox.minimum.z);
      maxX = Math.max(maxX, bbox.maximum.x);
      maxY = Math.max(maxY, bbox.maximum.y);
      maxZ = Math.max(maxZ, bbox.maximum.z);
    }

    const boundingBox = new BABYLON.BoundingBox(
      new BABYLON.Vector3(minX, minY, minZ),
      new BABYLON.Vector3(maxX, maxY, maxZ)
    );

    const totalVolume = computeVolume(boundingBox);
    const connectivity = clusterNodes.reduce((sum, n) => {
      const children = (n as any).getChildren ? (n as any).getChildren() as BABYLON.Node[] : [];
      return sum + children.length;
    }, 0);

    clusters.push({
      nodes: clusterNodes,
      centroid,
      totalVolume,
      boundingBox,
      connectivity,
    });
  }

  return clusters;
}

/**
 * Classify cluster as fixed or moving based on geometric heuristics.
 */
function classifyCluster(
  cluster: NodeCluster,
  options: Required<GeometricAnalyzeOptions>
): { isFixed: boolean; type: ToolUnitType } {
  let isFixed = false;
  let type: ToolUnitType = 'unknown';

  // Heuristic 1: Large volume + near origin = fixed base/fixture
  const distanceFromOrigin = cluster.centroid.length();
  if (cluster.totalVolume > options.minVolume * 10 && distanceFromOrigin < options.fixedProximityThreshold) {
    isFixed = true;
    type = 'fixture';
  }

  // Heuristic 2: High connectivity = fixed infrastructure
  if (cluster.connectivity >= options.fixedConnectivityThreshold) {
    isFixed = true;
    if (type === 'unknown') type = 'fixture';
  }

  // Heuristic 3: Small, isolated clusters = moving parts
  if (cluster.connectivity < 2 && cluster.totalVolume < options.minVolume * 5) {
    isFixed = false;
    type = 'gripper'; // Default moving type
  }

  // Heuristic 4: Elongated bounding boxes aligned with single axis = slides
  const dims = cluster.boundingBox.maximum.subtract(cluster.boundingBox.minimum);
  const sorted = [dims.x, dims.y, dims.z].sort((a, b) => b - a);
  if (sorted[0] > sorted[1] * 3) {
    // One dimension much larger than others
    isFixed = false;
    type = 'slide';
  }

  return { isFixed, type };
}

/**
 * Find geometric duplicates (potential fixed/moving pairs) using similarity matching.
 */
function findGeometricDuplicates(
  clusters: NodeCluster[],
  similarityThreshold: number
): Map<NodeCluster, NodeCluster[]> {
  const duplicates = new Map<NodeCluster, NodeCluster[]>();

  for (let i = 0; i < clusters.length; i++) {
    const cluster1 = clusters[i];
    const matches: NodeCluster[] = [];

    for (let j = i + 1; j < clusters.length; j++) {
      const cluster2 = clusters[j];

      // Compare primary nodes of each cluster
      const node1 = cluster1.nodes[0];
      const node2 = cluster2.nodes[0];

      const sig1 = computeGeometricSignature(node1);
      const sig2 = computeGeometricSignature(node2);

      if (!sig1 || !sig2) continue;

      const similarity = computeSimilarity(sig1, sig2);
      if (similarity >= similarityThreshold) {
        matches.push(cluster2);
      }
    }

    if (matches.length > 0) {
      duplicates.set(cluster1, matches);
    }
  }

  return duplicates;
}

function collectDescendantIds(root: BABYLON.Node): string[] {
  const ids: string[] = [];
  const visited = new Set<string>();

  // Add root node ID
  const rootIdStr = nodeId(root);
  ids.push(rootIdStr);
  visited.add(rootIdStr);

  // CRITICAL FIX: Use getChildMeshes() to collect ALL descendant meshes
  // This matches the WebGLKinematicsClaudeCode pattern for reliable mesh collection
  if ((root as any).getChildMeshes) {
    const meshes = (root as any).getChildMeshes() as BABYLON.AbstractMesh[];
    console.log(`[collectDescendantIds] Found ${meshes.length} child meshes for ${root.name || rootIdStr}`);

    for (const mesh of meshes) {
      const meshIdStr = nodeId(mesh);
      if (!visited.has(meshIdStr)) {
        ids.push(meshIdStr);
        visited.add(meshIdStr);
      }
    }
  }

  // Also traverse TransformNode children using getChildren() for completeness
  const stack: BABYLON.Node[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    const nIdStr = nodeId(n);

    if (!visited.has(nIdStr)) {
      ids.push(nIdStr);
      visited.add(nIdStr);
    }

    const children = (n as any).getChildren ? (n as any).getChildren() as BABYLON.Node[] : [];
    for (const c of children) {
      if (!visited.has(nodeId(c))) {
        stack.push(c);
      }
    }
  }

  return ids;
}

/**
 * Geometric-based tool unit analyzer.
 *
 * Replaces string-based detection with spatial clustering, volume analysis,
 * and geometric similarity matching to identify fixed and moving tool units.
 *
 * **Key Advantages:**
 * - No dependency on naming conventions
 * - Handles cases where moving parts are not exact geometric copies
 * - Uses physical properties (volume, connectivity, spatial proximity)
 * - Robust to different file formats and modeling practices
 *
 * @example
 * ```typescript
 * const analyzer = new GeometricToolAnalyzer();
 * const toolGraph = analyzer.analyze(scene, {
 *   clusteringDistance: 0.1,  // 10cm clustering
 *   similarityThreshold: 0.8   // 80% geometric match
 * });
 *
 * console.log(`Found ${toolGraph.units.length} tool units`);
 * const fixed = toolGraph.units.filter(u => u.isFixed);
 * const moving = toolGraph.units.filter(u => !u.isFixed);
 * ```
 */
export class GeometricToolAnalyzer {
  /**
   * Find TransformNode pairs by matching bounding box dimensions (orientation-invariant).
   * This is used to detect FIXED/MOVING pairs without relying on naming conventions.
   *
   * @param containerNode - Parent node to search within (e.g., UNIT_112)
   * @param similarityThreshold - Minimum dimension similarity (0-1) to consider a match
   * @returns Array of [node1, node2] pairs with similar dimensions
   */
  findTransformNodePairsByDimensions(
    containerNode: BABYLON.Node,
    similarityThreshold: number = 0.90
  ): Array<[BABYLON.TransformNode, BABYLON.TransformNode]> {
    const pairs: Array<[BABYLON.TransformNode, BABYLON.TransformNode]> = [];

    // Get all direct children TransformNodes
    const children = containerNode.getChildren();
    const transformNodes: BABYLON.TransformNode[] = [];

    for (const child of children) {
      if (child instanceof BABYLON.TransformNode && !(child instanceof BABYLON.AbstractMesh)) {
        transformNodes.push(child);
      }
    }

    console.log(`[GeometricToolAnalyzer] Finding dimension-matched pairs in '${containerNode.name}':`);
    console.log(`  - Direct TransformNode children: ${transformNodes.length}`);

    // Compute bounding boxes for all TransformNodes
    const bboxMap = new Map<BABYLON.TransformNode, BABYLON.BoundingBox>();

    for (const node of transformNodes) {
      const bbox = computeAggregateBoundingBox(node);
      if (bbox) {
        bboxMap.set(node, bbox);
        const dims = getSortedDimensions(bbox);
        console.log(`  - ${node.name}: dims=[${dims[0].toFixed(3)}, ${dims[1].toFixed(3)}, ${dims[2].toFixed(3)}]m`);
      }
    }

    // Compare all pairs
    const nodes = Array.from(bboxMap.keys());
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        const bbox1 = bboxMap.get(node1)!;
        const bbox2 = bboxMap.get(node2)!;

        const similarity = computeDimensionSimilarity(bbox1, bbox2);

        if (similarity >= similarityThreshold) {
          pairs.push([node1, node2]);
          console.log(`  ✓ MATCH: ${node1.name} ↔ ${node2.name} (similarity: ${similarity.toFixed(3)})`);
        } else {
          console.log(`    ${node1.name} ↔ ${node2.name} (similarity: ${similarity.toFixed(3)}) - below threshold`);
        }
      }
    }

    console.log(`  - Total pairs found: ${pairs.length}`);
    return pairs;
  }

  /**
   * Analyze scene to identify tool units using geometric properties.
   *
   * **Algorithm:**
   * 1. Collect all significant transform nodes (volume > minVolume)
   * 2. Cluster nodes by spatial proximity
   * 3. Compute geometric metrics for each cluster
   * 4. Classify fixed vs moving based on:
   *    - Volume (large = likely fixed)
   *    - Proximity to origin (near origin = likely fixed)
   *    - Connectivity (highly connected = likely fixed)
   *    - Bounding box shape (elongated = likely slide)
   * 5. Find geometric duplicates using similarity matching
   *
   * @param scene - Babylon scene containing tool geometry
   * @param options - Configuration for geometric analysis
   * @returns ToolGraph with classified units and anchor points
   */
  analyze(scene: BABYLON.Scene, options: GeometricAnalyzeOptions = {}, rootNode?: BABYLON.Node): ToolGraph {
    const opts: Required<GeometricAnalyzeOptions> = { ...DEFAULT_GEOMETRIC_OPTIONS, ...options };

    // Name-agnostic: do not rely on string patterns; use geometric heuristics only

    // FAST PATH (Bottom-up mesh-to-container traversal): Start from meshes, traverse up to find meaningful containers
    if (rootNode) {
      try {
        const units: ToolUnit[] = [];
        const anchors: ToolGraph['anchors'] = {};

        // Helper: compute aggregate bounding box and volume for a TransformNode and ALL descendant meshes
        const computeAggregateBBox = (tn: BABYLON.TransformNode): { dims: [number, number, number]; volume: number; pos: BABYLON.Vector3; meshCount: number } | null => {
          tn.computeWorldMatrix(true);
          const allMeshes = tn.getChildMeshes(false) as BABYLON.AbstractMesh[];
          if (allMeshes.length === 0) return null;
          
          let min = new BABYLON.Vector3(+Infinity, +Infinity, +Infinity);
          let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
          
          for (const m of allMeshes) {
            m.computeWorldMatrix(true);
            const bb = m.getBoundingInfo().boundingBox;
            min = BABYLON.Vector3.Minimize(min, bb.minimumWorld);
            max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
          }
          
          const size = max.subtract(min);
          const dims: [number, number, number] = [
            Math.abs(size.x),
            Math.abs(size.y),
            Math.abs(size.z),
          ].sort((a, b) => a - b) as [number, number, number];
          const volume = Math.abs(size.x * size.y * size.z);
          const pos = tn.getAbsolutePosition();
          
          return { dims, volume, pos, meshCount: allMeshes.length };
        };

        // Helper: Find meaningful container node by traversing upward from a mesh
        // A "meaningful" container is one that:
        // 1. Has significant volume (aggregate of all descendant meshes)
        // 2. Has multiple children (indicating it's a container, not just a parent of one mesh)
        // 3. Is at reasonable depth (not too shallow, not too deep)
        const findMeaningfulContainer = (startNode: BABYLON.Node, unitRoot: BABYLON.Node): BABYLON.TransformNode | null => {
          let current: BABYLON.Node | null = startNode;
          let bestContainer: BABYLON.TransformNode | null = null;
          let bestScore = -1;
          let depth = 0;

          // Don't go beyond UNIT root
          while (current && current !== unitRoot && current.parent) {
            depth++;
            current = current.parent;
            
            if (!(current instanceof BABYLON.TransformNode) || current instanceof BABYLON.AbstractMesh) {
              continue;
            }

            // Must be a TransformNode (not mesh)
            const tn = current as BABYLON.TransformNode;
            const bbox = computeAggregateBBox(tn);
            
            if (!bbox) continue;

            // Check if this is a meaningful container
            const children = (tn.getChildren?.() || []) as BABYLON.Node[];
            const childCount = children.length;
            
            // Heuristic: meaningful if:
            // - Has substantial volume (above threshold)
            // - Has multiple children (container, not single mesh parent)
            // - At reasonable depth (2-5 levels from UNIT)
            const volumeScore = bbox.volume >= opts.minVolume * 100 ? 1 : 0; // 10x stricter than minVolume
            const connectivityScore = childCount >= 2 ? 1 : 0;
            const depthScore = depth >= 2 && depth <= 5 ? 1 : 0;
            
            const score = (volumeScore * 0.5 + connectivityScore * 0.3 + depthScore * 0.2);
            
            // Prefer shallower containers with good volume and connectivity
            if (score > bestScore && bbox.volume >= opts.minVolume * 50) {
              bestScore = score;
              bestContainer = tn;
            }
            
            // Stop if we've gone too deep
            if (depth > 6) break;
          }

          return bestContainer;
        };

        // Helper: compute world-space bbox signature for a TransformNode and its descendant meshes
        const signatureOf = (tn: BABYLON.TransformNode) => {
          const bbox = computeAggregateBBox(tn);
          if (!bbox) return null;
          const conn = (tn.getChildren?.() || []).length;
          return { ...bbox, connectivity: conn };
        };

        // Helper: similarity (orientation invariant)
        const dimSimilarity = (a: number[], b: number[]) => {
          const diff = [
            Math.abs(a[0]-b[0]) / Math.max(a[0], b[0], 1e-6),
            Math.abs(a[1]-b[1]) / Math.max(a[1], b[1], 1e-6),
            Math.abs(a[2]-b[2]) / Math.max(a[2], b[2], 1e-6),
          ];
          const w = [0.2,0.3,0.5];
          const d = diff[0]*w[0] + diff[1]*w[1] + diff[2]*w[2];
          return Math.max(0, 1 - d);
        };

        // Auto-detect UNIT_* nodes from rootNode children or use rootNode itself if it's a UNIT
        const children = (rootNode as any).getChildren ? (rootNode as any).getChildren() as BABYLON.Node[] : [];
        let unitNodes: BABYLON.TransformNode[] = [];
        
        if ((rootNode.name || '').match(/^UNIT_\d+/)) {
          // rootNode is a UNIT itself
          unitNodes = [rootNode as BABYLON.TransformNode];
        } else {
          // Find UNIT_* children
          unitNodes = children.filter(n => (n.name || '').match(/^UNIT_\d+/)) as BABYLON.TransformNode[];
        }

        if (unitNodes.length === 0) {
          console.log('[GeometricToolAnalyzer][BB] No UNIT_* nodes found, skipping bottom-up container pairing');
        } else {
          console.log(`[GeometricToolAnalyzer][BB] Processing ${unitNodes.length} UNIT_* node(s) with bottom-up mesh-to-container traversal`);

          for (const unit of unitNodes) {
            // Step 1: Collect all meshes within this UNIT
            const allMeshes: BABYLON.AbstractMesh[] = [];
            const collectMeshes = (node: BABYLON.Node) => {
              if (node instanceof BABYLON.AbstractMesh) {
                allMeshes.push(node);
              }
              const children = (node as any).getChildren ? (node as any).getChildren() as BABYLON.Node[] : [];
              for (const child of children) {
                collectMeshes(child);
              }
            };
            collectMeshes(unit);
            
            console.log(`[GeometricToolAnalyzer][BB] ${unit.name}: Found ${allMeshes.length} meshes`);

            // Step 2: For each mesh, find its meaningful container
            const meshToContainer = new Map<BABYLON.AbstractMesh, BABYLON.TransformNode>();
            for (const mesh of allMeshes) {
              const container = findMeaningfulContainer(mesh, unit);
              if (container) {
                meshToContainer.set(mesh, container);
              }
            }

            // Step 3: Deduplicate containers (multiple meshes map to same container)
            const uniqueContainers = new Set(Array.from(meshToContainer.values()));
            console.log(`[GeometricToolAnalyzer][BB] ${unit.name}: Found ${uniqueContainers.size} unique meaningful containers from ${allMeshes.length} meshes`);

            // Step 4: Convert to signatures and find pairs
            const containerSigs = Array.from(uniqueContainers)
              .map(tn => ({ tn, sig: signatureOf(tn) }))
              .filter((x): x is { tn: BABYLON.TransformNode; sig: NonNullable<ReturnType<typeof signatureOf>> } => 
                x.sig !== null && x.sig.volume >= opts.minVolume * 50
              );

            const foundPairs: Array<{ fixed: BABYLON.TransformNode; moving: BABYLON.TransformNode; sim: number; volume: number }> = [];
            const used = new Set<BABYLON.TransformNode>();

            // Step 5: Compare all container pairs
            for (let i = 0; i < containerSigs.length; i++) {
              if (used.has(containerSigs[i].tn)) continue;
              for (let j = i + 1; j < containerSigs.length; j++) {
                if (used.has(containerSigs[j].tn)) continue;

                const A = containerSigs[i], B = containerSigs[j];
                const vr = A.sig.volume / B.sig.volume;
                if (vr < 0.9 || vr > 1.1) continue;

                const sim = dimSimilarity(A.sig.dims, B.sig.dims);
                if (sim < (opts.similarityThreshold ?? 0.95)) continue;

                // Geometric classification: fixed = closer to origin + higher connectivity
                const distA = A.sig.pos.length();
                const distB = B.sig.pos.length();
                const scoreA = (distA < distB ? 1 : 0) * 0.4 + (A.sig.connectivity > B.sig.connectivity ? 1 : 0) * 0.6;
                const scoreB = (distB < distA ? 1 : 0) * 0.4 + (B.sig.connectivity > A.sig.connectivity ? 1 : 0) * 0.6;

                const fixedTN = scoreA >= scoreB ? A.tn : B.tn;
                const movingTN = scoreA >= scoreB ? B.tn : A.tn;

                foundPairs.push({
                  fixed: fixedTN,
                  moving: movingTN,
                  sim,
                  volume: Math.min(A.sig.volume, B.sig.volume),
                });

                used.add(A.tn);
                used.add(B.tn);
              }
            }

            // Step 6: Sort by volume (larger = more meaningful) and take top pairs
            foundPairs.sort((a, b) => b.volume - a.volume);
            const topPairs = foundPairs.slice(0, 4); // Max 2 joints per unit typically

            console.log(`[GeometricToolAnalyzer][BB] ${unit.name}: Found ${foundPairs.length} pairs, using top ${topPairs.length}`);

            for (const pair of topPairs) {
              const fixedId = uuid();
              const movingId = uuid();
              const fixedNodes = collectDescendantIds(pair.fixed);
              const movingNodes = collectDescendantIds(pair.moving);
              const fixedWT = getWorldTransform(pair.fixed);
              const movingWT = getWorldTransform(pair.moving);

              units.push({
                id: fixedId,
                name: `${unit.name}/FIXED`,
                root: nodeId(pair.fixed),
                type: 'fixture',
                isFixed: true,
                nodes: fixedNodes,
              });
              anchors[fixedId] = { position: fixedWT.position, rotation: fixedWT.rotation };

              units.push({
                id: movingId,
                name: `${unit.name}/MOVING`,
                root: nodeId(pair.moving),
                type: 'gripper',
                isFixed: false,
                nodes: movingNodes,
              });
              anchors[movingId] = { position: movingWT.position, rotation: movingWT.rotation };

              console.log(`[GeometricToolAnalyzer][BB] ${unit.name}: matched '${pair.fixed.name}' ↔ '${pair.moving.name}' (sim=${pair.sim.toFixed(3)}, vol=${pair.volume.toExponential(2)}m³)`);
            }
          }

          if (units.length > 0) {
            console.log(`[GeometricToolAnalyzer][BB] Produced ${units.length} units via bottom-up mesh-to-container pairing.`);
            return { units, anchors };
          }
        }

        // FALLBACK: Depth-level pairing (proven to work when bottom-up finds insufficient pairs)
        if (unitNodes.length > 0 && units.length < 2) {
          console.log(`[GeometricToolAnalyzer][BB] Bottom-up found ${units.length} units, trying depth-level pairing fallback...`);
          
          try {
            // Helper: get all nodes at a specific depth
            const getNodesAtDepth = (unitRoot: BABYLON.Node, targetDepth: number): BABYLON.TransformNode[] => {
              const result: BABYLON.TransformNode[] = [];
              const stack: Array<{ node: BABYLON.Node; depth: number }> = [{ node: unitRoot, depth: 0 }];
              
              while (stack.length) {
                const { node, depth } = stack.pop()!;
                if (depth === targetDepth && node !== unitRoot) {
                  if (node instanceof BABYLON.TransformNode && !(node instanceof BABYLON.AbstractMesh)) {
                    result.push(node);
                  }
                }
                if (depth < targetDepth) {
                  const children = (node as any).getChildren ? (node as any).getChildren() as BABYLON.Node[] : [];
                  for (const child of children) {
                    stack.push({ node: child, depth: depth + 1 });
                  }
                }
              }
              return result;
            };

            // Helper: find max depth
            const findMaxDepth = (node: BABYLON.Node, unitRoot: BABYLON.Node, current = 0): number => {
              let max = current;
              const children = (node as any).getChildren ? (node as any).getChildren() as BABYLON.Node[] : [];
              for (const child of children) {
                max = Math.max(max, findMaxDepth(child, unitRoot, current + 1));
              }
              return max;
            };

            // Use proven thresholds from console testing
            const DEPTH_SIM_THRESHOLD = 0.95;
            const DEPTH_VOL_RATIO_MIN = 0.85;
            const DEPTH_VOL_RATIO_MAX = 1.15;
            const DEPTH_MIN_VOL = opts.minVolume;
            const DEPTH_MAX_DEPTH = 6;

            for (const unit of unitNodes) {
              const maxDepth = Math.min(findMaxDepth(unit, unit), DEPTH_MAX_DEPTH);
              const depthPairs: Array<{ fixed: BABYLON.TransformNode; moving: BABYLON.TransformNode; depth: number; sim: number; volume: number }> = [];
              const used = new Set<BABYLON.TransformNode>();

              for (let d = 1; d <= maxDepth; d++) {
                const levelNodes = getNodesAtDepth(unit, d);
                const levelSigs = levelNodes
                  .filter(tn => !used.has(tn) && (tn.getChildMeshes(false) || []).length > 0)
                  .map(tn => ({ tn, sig: signatureOf(tn) }))
                  .filter((x): x is { tn: BABYLON.TransformNode; sig: NonNullable<ReturnType<typeof signatureOf>> } => 
                    x.sig !== null && x.sig.volume >= DEPTH_MIN_VOL
                  );

                for (let i = 0; i < levelSigs.length; i++) {
                  if (used.has(levelSigs[i].tn)) continue;
                  for (let j = i + 1; j < levelSigs.length; j++) {
                    if (used.has(levelSigs[j].tn)) continue;

                    const A = levelSigs[i], B = levelSigs[j];
                    const vr = A.sig.volume / B.sig.volume;
                    if (vr < DEPTH_VOL_RATIO_MIN || vr > DEPTH_VOL_RATIO_MAX) continue;

                    const sim = dimSimilarity(A.sig.dims, B.sig.dims);
                    if (sim < DEPTH_SIM_THRESHOLD) continue;

                    // Geometric classification
                    const distA = A.sig.pos.length();
                    const distB = B.sig.pos.length();
                    const scoreA = (distA < distB ? 1 : 0) * 0.4 + (A.sig.connectivity > B.sig.connectivity ? 1 : 0) * 0.6;
                    const scoreB = (distB < distA ? 1 : 0) * 0.4 + (B.sig.connectivity > A.sig.connectivity ? 1 : 0) * 0.6;

                    const fixedTN = scoreA >= scoreB ? A.tn : B.tn;
                    const movingTN = scoreA >= scoreB ? B.tn : A.tn;

                    depthPairs.push({
                      fixed: fixedTN,
                      moving: movingTN,
                      depth: d,
                      sim,
                      volume: Math.min(A.sig.volume, B.sig.volume),
                    });

                    used.add(A.tn);
                    used.add(B.tn);
                  }
                }
              }

              // Sort by depth (shallower first) then volume (larger first), take top pairs
              depthPairs.sort((a, b) => {
                if (a.depth !== b.depth) return a.depth - b.depth;
                return b.volume - a.volume;
              });

              // Take top pairs (limit to depth <= 3 for meaningful kinematic units, max 4 pairs = 8 units)
              const topDepthPairs = depthPairs.filter(p => p.depth <= 3).slice(0, 4);

              console.log(`[GeometricToolAnalyzer][BB][Depth] ${unit.name}: Found ${depthPairs.length} depth-level pairs, using top ${topDepthPairs.length}`);

              for (const pair of topDepthPairs) {
                const fixedId = uuid();
                const movingId = uuid();
                const fixedNodes = collectDescendantIds(pair.fixed);
                const movingNodes = collectDescendantIds(pair.moving);
                const fixedWT = getWorldTransform(pair.fixed);
                const movingWT = getWorldTransform(pair.moving);

                units.push({
                  id: fixedId,
                  name: `${unit.name}/FIXED`,
                  root: nodeId(pair.fixed),
                  type: 'fixture',
                  isFixed: true,
                  nodes: fixedNodes,
                });
                anchors[fixedId] = { position: fixedWT.position, rotation: fixedWT.rotation };

                units.push({
                  id: movingId,
                  name: `${unit.name}/MOVING`,
                  root: nodeId(pair.moving),
                  type: 'gripper',
                  isFixed: false,
                  nodes: movingNodes,
                });
                anchors[movingId] = { position: movingWT.position, rotation: movingWT.rotation };

                console.log(`[GeometricToolAnalyzer][BB][Depth] ${unit.name} (depth ${pair.depth}): matched '${pair.fixed.name}' ↔ '${pair.moving.name}' (sim=${pair.sim.toFixed(3)}, vol=${pair.volume.toExponential(2)}m³)`);
              }
            }

            if (units.length > 0) {
              console.log(`[GeometricToolAnalyzer][BB] Produced ${units.length} units via depth-level pairing fallback.`);
              return { units, anchors };
            }
          } catch (e) {
            console.warn('[GeometricToolAnalyzer][BB] Depth-level pairing fallback failed, continuing to clustering.', e);
          }
        }
      } catch (e) {
        console.warn('[GeometricToolAnalyzer][BB] Bottom-up container pairing failed, falling back to clustering.', e);
      }
    }

    // Step 1: Collect significant transform nodes (scoped to subtree if rootNode provided)
    const significantNodes: BABYLON.TransformNode[] = [];
    let totalMeshes = 0;
    let tooSmall = 0;

    // Build candidate iterable: either descendants of rootNode or all scene meshes
    const candidateNodes: BABYLON.Node[] = [];
    if (rootNode) {
      // Include the root and all descendants
      candidateNodes.push(rootNode);
      const descendants = (rootNode as any).getDescendants ? (rootNode as any).getDescendants(true) as BABYLON.Node[] : [];
      candidateNodes.push(...descendants);
      console.log(`[GeometricToolAnalyzer] Scoped analysis to subtree of '${rootNode.name || rootNode.id}' with ${candidateNodes.length} nodes`);
    } else {
      candidateNodes.push(...scene.transformNodes);
      console.log(`[GeometricToolAnalyzer] Scanning scene.transformNodes (${scene.transformNodes.length} total)`);
    }

    console.log(`[GeometricToolAnalyzer] Candidate nodes in scope: ${candidateNodes.length}`);

    for (const node of candidateNodes) {
      if (!(node instanceof BABYLON.AbstractMesh)) continue;

      totalMeshes++;
      const mesh = node as BABYLON.AbstractMesh;
      mesh.computeWorldMatrix(true);
      const bbox = mesh.getBoundingInfo().boundingBox;
      const volume = computeVolume(bbox);

      if (volume >= opts.minVolume) {
        significantNodes.push(node);
        console.log(`[GeometricToolAnalyzer] ✓ Significant node: ${node.name}, volume: ${volume.toExponential(2)}m³`);
      } else {
        tooSmall++;
      }
    }

    // Fallback: if no candidates found under hierarchy, scan all meshes and check parent hierarchy
    if (significantNodes.length === 0 && rootNode) {
      console.log(`[GeometricToolAnalyzer] No meshes found via getDescendants(), trying parent hierarchy scan...`);

      // Helper: Check if a node is a descendant of rootNode
      const isDescendantOf = (node: BABYLON.Node, ancestor: BABYLON.Node): boolean => {
        let current: BABYLON.Node | null = node;
        while (current) {
          if (current === ancestor) return true;
          current = current.parent;
        }
        return false;
      };

      for (const m of scene.meshes as BABYLON.AbstractMesh[]) {
        if (isDescendantOf(m, rootNode)) {
          totalMeshes++;
          m.computeWorldMatrix(true);
          const bbox = m.getBoundingInfo().boundingBox;
          const volume = computeVolume(bbox);

          if (volume >= opts.minVolume) {
            significantNodes.push(m as any);
            console.log(`[GeometricToolAnalyzer] ✓ Significant node (via parent scan): ${m.name}, volume: ${volume.toExponential(2)}m³`);
          } else {
            tooSmall++;
          }
        }
      }

      console.log(`[GeometricToolAnalyzer] Parent hierarchy scan found ${significantNodes.length} significant meshes`);
    }

    console.log(`[GeometricToolAnalyzer] Total meshes scanned: ${totalMeshes}, significant: ${significantNodes.length}, too small: ${tooSmall}`);
    console.log(`[GeometricToolAnalyzer] Min volume threshold: ${opts.minVolume}m³`);

    // Step 2: Cluster by spatial proximity
    const clusters = clusterBySpatialProximity(significantNodes, opts.clusteringDistance);
    console.log(`[GeometricToolAnalyzer] Formed ${clusters.length} spatial clusters (distance <= ${opts.clusteringDistance}m)`);

    // Step 3: Classify each cluster
    for (const cluster of clusters) {
      const { isFixed, type } = classifyCluster(cluster, opts);
      cluster.isFixed = isFixed;
      cluster.type = type;
    }

    const fixedCount = clusters.filter(c => c.isFixed).length;
    const movingCount = clusters.filter(c => !c.isFixed).length;
    console.log(`[GeometricToolAnalyzer] Classified: ${fixedCount} fixed, ${movingCount} moving`);

    // Step 4: Find geometric duplicates (potential fixed/moving pairs)
    const duplicates = findGeometricDuplicates(clusters, opts.similarityThreshold);
    if (duplicates.size > 0) {
      console.log(`[GeometricToolAnalyzer] Found ${duplicates.size} clusters with geometric duplicates (similarity >= ${opts.similarityThreshold})`);

      // Refine classification: if a cluster has duplicates, one is likely fixed, others moving
      for (const [cluster, matches] of duplicates.entries()) {
        // Keep largest/most connected as fixed
        const allCandidates = [cluster, ...matches];
        allCandidates.sort((a, b) => {
          const scoreA = a.totalVolume * a.connectivity;
          const scoreB = b.totalVolume * b.connectivity;
          return scoreB - scoreA;
        });

        allCandidates[0].isFixed = true;
        allCandidates[0].type = 'fixture';
        for (let i = 1; i < allCandidates.length; i++) {
          allCandidates[i].isFixed = false;
          allCandidates[i].type = allCandidates[i].type === 'slide' ? 'slide' : 'gripper';
        }
      }
    }

    // Step 5: Convert clusters to ToolUnits
    const units: ToolUnit[] = [];
    const anchors: ToolGraph['anchors'] = {};

    // Helper: Find the TransformNode parent for a mesh (or return the node if it's already a TransformNode)
    const findTransformNodeParent = (node: BABYLON.Node): BABYLON.Node => {
      // If it's already a TransformNode (not a mesh), use it
      if (node instanceof BABYLON.TransformNode && !(node instanceof BABYLON.AbstractMesh)) {
        return node;
      }

      // If it's a mesh, find the first TransformNode parent
      let current: BABYLON.Node | null = node.parent;
      while (current) {
        if (current instanceof BABYLON.TransformNode && !(current instanceof BABYLON.AbstractMesh)) {
          return current;
        }
        current = current.parent;
      }

      // Fallback: use the node itself (shouldn't happen with our mock structure)
      console.warn(`[GeometricToolAnalyzer] No TransformNode parent found for ${node.name}, using node itself`);
      return node;
    };

    for (const cluster of clusters) {
      const id = uuid();
      // Use TransformNode parent instead of mesh for root
      const rootNode = findTransformNodeParent(cluster.nodes[0]);
      const nodeIds = cluster.nodes.flatMap(n => collectDescendantIds(n));
      const wt = getWorldTransform(rootNode);

      console.log(`[GeometricToolAnalyzer] Creating ToolUnit: ${rootNode.name || id}`);
      console.log(`  - Root node (TransformNode): ${nodeId(rootNode)} (${rootNode.name})`);
      console.log(`  - Original cluster node: ${nodeId(cluster.nodes[0])} (${cluster.nodes[0].name})`);
      console.log(`  - Cluster nodes: ${cluster.nodes.length}`);
      console.log(`  - Total collected node IDs: ${nodeIds.length}`);
      console.log(`  - Is fixed: ${cluster.isFixed ?? false}`);
      console.log(`  - Type: ${cluster.type || 'unknown'}`);

      units.push({
        id,
        name: rootNode.name || id,
        root: nodeId(rootNode),
        type: cluster.type || 'unknown',
        isFixed: cluster.isFixed ?? false,
        nodes: nodeIds,
      });

      anchors[id] = { position: wt.position, rotation: wt.rotation };
    }

    // Post-process: ensure at least one fixed and one moving if possible
    if (units.length >= 2) {
      const anyFixed = units.some(u => u.isFixed);
      const anyMoving = units.some(u => !u.isFixed);

      if (!anyFixed) {
        // Choose the largest (by total volume) as fixed
        let maxIdx = 0;
        for (let i = 1; i < clusters.length; i++) {
          if (clusters[i].totalVolume > clusters[maxIdx].totalVolume) maxIdx = i;
        }
        units[maxIdx].isFixed = true;
        units[maxIdx].type = 'fixture';
        console.log(`[GeometricToolAnalyzer] No fixed units detected, forcing largest unit as fixed: ${units[maxIdx].name}`);
      }

      if (!anyMoving) {
        // Choose a non-fixed candidate as moving (smallest by volume)
        let minIdx = -1;
        for (let i = 0; i < units.length; i++) {
          if (!units[i].isFixed && (minIdx === -1 || clusters[i].totalVolume < clusters[minIdx].totalVolume)) {
            minIdx = i;
          }
        }
        if (minIdx >= 0) {
          units[minIdx].isFixed = false;
          units[minIdx].type = 'gripper';
          console.log(`[GeometricToolAnalyzer] No moving units detected, forcing smallest unit as moving: ${units[minIdx].name}`);
        }
      }
    }

    return { units, anchors };
  }

}
