/**
 * Hierarchical point-cloud based unit detection algorithm.
 * 
 * Algorithm:
 * 1. Build point clouds for each node in the structure tree
 * 2. Traverse hierarchy from root downward
 * 3. At each level, identify clusters of nodes that are spatially separated
 * 4. Select maximal subtrees that are not equal to the entire root and not supersets of previously accepted units
 * 5. Return list of detected units
 */

import type {
  ToolingNode,
  ToolingStructure,
  ToolingUnit,
  ToolingNodeGeometry,
  BoundingBox as _BoundingBox,
  Vector3,
} from './types';
import {
  computeBoundingBox,
  computeCentroid,
  computeBboxOverlapRatio,
  computeBboxVolume,
  computeBboxExtents as _computeBboxExtents,
  distance,
} from './pointClouds';

/**
 * Options for unit detection.
 */
export interface UnitDetectionOptions {
  /** Minimum point count per node to consider. Default: 10 */
  minPointsPerNode?: number;
  /** Maximum points to sample per node. Default: 5000 */
  maxPointsPerNode?: number;
  /** Minimum bbox volume (m³) to consider a node. Default: 0.0001 (1 cm³) */
  minVolume?: number;
  /** Maximum depth to search. Default: 20 */
  maxDepth?: number;
  /** Overlap ratio threshold for considering nodes as separate. Default: 0.1 */
  overlapThreshold?: number;
  /** Minimum distance between unit centroids (meters). Default: 0.01 (10mm) */
  minCentroidDistance?: number;
  /** Maximum size ratio for a unit (relative to root). Default: 0.95 */
  maxUnitSizeRatio?: number;
}

const DEFAULT_OPTIONS: Required<UnitDetectionOptions> = {
  minPointsPerNode: 10,
  maxPointsPerNode: 5000,
  minVolume: 0.0001,
  maxDepth: 20,
  overlapThreshold: 0.1,
  minCentroidDistance: 0.01,
  maxUnitSizeRatio: 0.95,
};

/**
 * Internal representation of a node with its point cloud.
 */
type NodeCloud = {
  node: ToolingNode;
  geometry: ToolingNodeGeometry;
  depth: number;
};

/**
 * Detect tooling units using hierarchical point cloud analysis.
 * 
 * @param structure - Tooling structure tree
 * @param geometryIndex - Map of nodeId -> point cloud geometry
 * @param options - Detection options
 * @returns List of detected units
 */
export function detectUnits(
  structure: ToolingStructure,
  geometryIndex: Map<string, ToolingNodeGeometry>,
  options: UnitDetectionOptions = {}
): ToolingUnit[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!structure.root) {
    return [];
  }

  const rootGeometry = geometryIndex.get(structure.root.id);
  if (!rootGeometry || rootGeometry.points.length === 0) {
    return [];
  }

  const rootVolume = computeBboxVolume(rootGeometry.bbox);
  if (rootVolume <= 0) {
    return [];
  }

  const units: ToolingUnit[] = [];
  const acceptedNodeSets = new Set<string>(); // Track accepted node ID sets as strings

  const nodeClouds: NodeCloud[] = [];
  collectNodeClouds(structure.root, 0, geometryIndex, opts, nodeClouds);

  if (nodeClouds.length === 0) {
    return [];
  }

  // Traverse hierarchy level by level
  const maxDepth = Math.max(...nodeClouds.map(nc => nc.depth));
  
  for (let level = 0; level <= maxDepth && level < opts.maxDepth; level++) {
    const nodesAtLevel = nodeClouds.filter(nc => nc.depth === level);
    
    if (nodesAtLevel.length === 0) continue;

    // Find clusters at this level
    const clusters = clusterNodesAtLevel(nodesAtLevel, opts);

    for (const cluster of clusters) {
      const candidateUnit = evaluateCandidateUnit(cluster, rootGeometry, rootVolume, opts);
      
      if (!candidateUnit) continue;

      // Check if this unit is not a duplicate
      const nodeSetKey = candidateUnit.nodeIds.sort().join(',');
      if (acceptedNodeSets.has(nodeSetKey)) continue;

      // Check if this unit is not a superset of an already accepted unit
      if (isSupersetOfAccepted(candidateUnit.nodeIds, units)) continue;

      // Accept this unit
      units.push(candidateUnit);
      acceptedNodeSets.add(nodeSetKey);
    }
  }

  // Sort units by centroid for reproducibility
  units.sort((a, b) => {
    if (Math.abs(a.centroid.x - b.centroid.x) > 1e-6) {
      return a.centroid.x - b.centroid.x;
    }
    if (Math.abs(a.centroid.y - b.centroid.y) > 1e-6) {
      return a.centroid.y - b.centroid.y;
    }
    return a.centroid.z - b.centroid.z;
  });

  return units;
}

/**
 * Collect all node clouds from the tree.
 */
function collectNodeClouds(
  node: ToolingNode,
  depth: number,
  geometryIndex: Map<string, ToolingNodeGeometry>,
  opts: Required<UnitDetectionOptions>,
  result: NodeCloud[]
): void {
  const geometry = geometryIndex.get(node.id);
  
  if (!geometry) return;
  if (geometry.points.length < opts.minPointsPerNode) return;
  
  const volume = computeBboxVolume(geometry.bbox);
  if (volume < opts.minVolume) return;

  result.push({
    node,
    geometry,
    depth,
  });

  if (depth >= opts.maxDepth) return;
  if (!node.children || node.children.length === 0) return;

  for (const child of node.children) {
    collectNodeClouds(child, depth + 1, geometryIndex, opts, result);
  }
}

/**
 * Cluster nodes at the same level based on spatial relationships.
 */
function clusterNodesAtLevel(
  nodesAtLevel: NodeCloud[],
  opts: Required<UnitDetectionOptions>
): NodeCloud[][] {
  if (nodesAtLevel.length === 0) return [];
  if (nodesAtLevel.length === 1) return [[nodesAtLevel[0]]];

  const clusters: NodeCloud[][] = [];
  const assigned = new Set<string>();

  for (const nodeCloud of nodesAtLevel) {
    if (assigned.has(nodeCloud.node.id)) continue;

    const cluster: NodeCloud[] = [nodeCloud];
    assigned.add(nodeCloud.node.id);

    // Find nodes that overlap or are close to this one
    for (const other of nodesAtLevel) {
      if (assigned.has(other.node.id)) continue;
      if (nodeCloud.node.id === other.node.id) continue;

      const overlap = computeBboxOverlapRatio(nodeCloud.geometry.bbox, other.geometry.bbox);
      const centroidDist = distance(nodeCloud.geometry.centroid, other.geometry.centroid);

      if (overlap > opts.overlapThreshold || centroidDist < opts.minCentroidDistance) {
        cluster.push(other);
        assigned.add(other.node.id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Evaluate if a cluster is a valid candidate unit.
 */
function evaluateCandidateUnit(
  cluster: NodeCloud[],
  _rootGeometry: ToolingNodeGeometry,
  rootVolume: number,
  opts: Required<UnitDetectionOptions>
): ToolingUnit | null {
  if (cluster.length === 0) return null;

  // Collect all node IDs in this cluster
  const nodeIds: string[] = [];
  const allPoints: Vector3[] = [];
  
  for (const nc of cluster) {
    nodeIds.push(nc.node.id);
    allPoints.push(...nc.geometry.points);
  }

  if (nodeIds.length === 0) return null;

  // Compute combined bbox and centroid
  const combinedBbox = computeBoundingBox(allPoints);
  if (!combinedBbox) return null;

  const combinedCentroid = computeCentroid(allPoints);
  if (!combinedCentroid) return null;

  // Guard: unit must not be equal to the entire root
  const combinedVolume = computeBboxVolume(combinedBbox);
  const volumeRatio = combinedVolume / rootVolume;
  
  if (volumeRatio >= opts.maxUnitSizeRatio) return null;

  // Guard: unit must have reasonable size
  if (combinedVolume < opts.minVolume) return null;

  // Generate unit ID
  const unitId = `unit_${nodeIds[0]}`;

  return {
    unitId,
    nodeIds,
    bbox: combinedBbox,
    centroid: combinedCentroid,
  };
}

/**
 * Check if a node set is a superset of any already accepted unit.
 */
function isSupersetOfAccepted(nodeIds: string[], acceptedUnits: ToolingUnit[]): boolean {
  const nodeSet = new Set(nodeIds);

  for (const unit of acceptedUnits) {
    // Check if unit is a subset of nodeIds
    let isSubset = true;
    for (const id of unit.nodeIds) {
      if (!nodeSet.has(id)) {
        isSubset = false;
        break;
      }
    }

    if (isSubset && unit.nodeIds.length < nodeIds.length) {
      return true; // nodeIds is a superset of this unit
    }
  }

  return false;
}

