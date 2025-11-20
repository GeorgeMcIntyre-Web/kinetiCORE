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
  similarityThreshold: 0.85,
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

    // Fallback: if no candidates found under hierarchy, try name-prefix match across entire scene
    if (significantNodes.length === 0 && rootNode) {
      const name = rootNode.name || String((rootNode as any).id ?? (rootNode as any).uniqueId ?? '');
      const pref = `${name}/`;
      for (const m of scene.meshes as BABYLON.AbstractMesh[]) {
        const nm = m.name || '';
        if (nm === name || nm.startsWith(pref) || nm.includes(`/${name}/`)) {
          m.computeWorldMatrix(true);
          const bbox = m.getBoundingInfo().boundingBox;
          const volume = computeVolume(bbox);
          if (volume >= opts.minVolume) {
            significantNodes.push(m as any);
          }
        }
      }
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

    for (const cluster of clusters) {
      const id = uuid();
      const root = cluster.nodes[0];
      const nodeIds = cluster.nodes.flatMap(n => collectDescendantIds(n));
      const wt = getWorldTransform(root);

      console.log(`[GeometricToolAnalyzer] Creating ToolUnit: ${root.name || id}`);
      console.log(`  - Root node: ${nodeId(root)}`);
      console.log(`  - Cluster nodes: ${cluster.nodes.length}`);
      console.log(`  - Total collected node IDs: ${nodeIds.length}`);
      console.log(`  - Is fixed: ${cluster.isFixed ?? false}`);
      console.log(`  - Type: ${cluster.type || 'unknown'}`);

      units.push({
        id,
        name: root.name || id,
        root: nodeId(root),
        babylonUniqueId: root.uniqueId,
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
