/**
 * Step 2: Pose Pair Detection
 *
 * Within each unit, find pairs of geometry that represent the same rigid
 * body in two different poses (open/closed, advanced/retracted).
 *
 * Uses point count matching - same geometry should have identical vertex counts.
 */

import type {
  GLBTreeData,
  FlatNode,
  DetectedUnit,
  PosePair,
  GeometryMatch,
  PosePairConfig,
} from './types';
import { getAllDescendants, getGeometryNodes } from './unitDetection';

const DEFAULT_CONFIG: PosePairConfig = {
  POINT_COUNT_TOLERANCE: 0.02,     // Allow 2% difference
  MIN_SUBTREE_PERCENT: 0.05,       // Subtree must be >5% of unit
  MIN_MATCH_CONFIDENCE: 0.7,       // At least 70% of geometry must match
  MIN_GEOMETRY_POINTS: 100,        // Ignore tiny parts
};

/**
 * Find pose pairs within a unit.
 *
 * Algorithm:
 * 1. Get all significant subtrees within the unit
 * 2. Group subtrees by approximate point count
 * 3. For each group with exactly 2 members, check if they're pose pairs
 * 4. Match geometry nodes by point count
 * 5. Calculate confidence based on matched geometry
 *
 * @param data - GLB tree data
 * @param unit - Detected unit to analyze
 * @param config - Optional configuration overrides
 * @returns Array of pose pairs found
 */
export function findPosePairs(
  data: GLBTreeData,
  unit: DetectedUnit,
  config: Partial<PosePairConfig> = {}
): PosePair[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const unitNode = data.nodes[unit.nodeIndex];
  const unitPoints = unit.subtreePointCount;
  const nodeLookup = new Map<number, FlatNode>();
  for (const node of data.nodes) {
    nodeLookup.set(node.index, node);
  }

  console.log(`[PAIRS] Analyzing unit ${unitNode.name} (index ${unit.nodeIndex}), total points: ${unitPoints.toLocaleString()}`);

  const topLevelChildren = unitNode.childrenIndices?.map(idx => nodeLookup.get(idx)).filter(Boolean) as FlatNode[] || [];
  console.log(`[PAIRS] Top-level children: ${topLevelChildren.length} (${topLevelChildren.map(c => `${c.name}(${c.subtreePointCount.toLocaleString()})`).join(', ')})`);
  
  const significantBuckets = topLevelChildren.filter(child =>
    child.subtreePointCount >= unitPoints * cfg.MIN_SUBTREE_PERCENT
  );
  
  console.log(`[PAIRS] Significant buckets (>=${(cfg.MIN_SUBTREE_PERCENT * 100).toFixed(1)}%): ${significantBuckets.length} (${significantBuckets.map(c => `${c.name}(${c.subtreePointCount.toLocaleString()})`).join(', ')})`);

  if (significantBuckets.length < 2) {
    console.log(`[PAIRS] Unit ${unitNode.name} has fewer than 2 significant top-level buckets; treating as fixed.`);
    return [];
  }

  // Get all significant subtrees within this unit
  const subtrees = getSignificantSubtrees(data.nodes, unit, cfg.MIN_SUBTREE_PERCENT);
  console.log(`[PAIRS] Found ${subtrees.length} significant subtrees (${subtrees.map(s => `${s.name}(${s.subtreePointCount.toLocaleString()})`).join(', ')})`);

  if (subtrees.length < 2) {
    console.log(`[PAIRS] Not enough subtrees for pose pair detection`);
    return [];
  }

  // Group subtrees by approximate point count
  const groups = groupByPointCount(subtrees, cfg.POINT_COUNT_TOLERANCE);
  console.log(`[PAIRS] Grouped into ${groups.length} point-count groups`);
  

  const posePairs: PosePair[] = [];

  // For each group, find pairs (handling groups with 2+ members)
  for (const group of groups) {
    if (group.length < 2) {
      console.log(`[PAIRS] Skipping group with ${group.length} members (need at least 2)`);
      continue;
    }
    
    // If group has more than 2 members, filter out parent-child/ancestor-descendant duplicates
    // (e.g., WIRE and OPEN both at 8002 pts - keep the deeper OPEN)
    // Strategy: Keep only the deepest nodes (nodes that are not ancestors of any other node in the group)
    let cleanedGroup = group;
    if (group.length > 2) {
      console.log(`[PAIRS] Filtering group with ${group.length} members: ${group.map(n => `${n.name}(${n.index})`).join(', ')}`);
      
      // Build a map of which nodes are ancestors of which
      const ancestorMap = new Map<number, Set<number>>(); // nodeIndex -> set of descendant indices
      for (const node of group) {
        for (const other of group) {
          if (other.index !== node.index && isDescendantOf(data.nodes, other.index, node.index)) {
            if (!ancestorMap.has(node.index)) {
              ancestorMap.set(node.index, new Set());
            }
            ancestorMap.get(node.index)!.add(other.index);
          }
        }
      }
      
      // Filter: keep only nodes that are NOT ancestors of any other node
      cleanedGroup = group.filter(node => {
        const isAncestor = ancestorMap.has(node.index);
        if (isAncestor) {
          const descendants = Array.from(ancestorMap.get(node.index)!);
          console.log(`[PAIRS]   Removing ${node.name} (${node.index}) - it's an ancestor of: ${descendants.map(idx => {
            const n = data.nodes.find(nd => nd.index === idx);
            return n ? `${n.name}(${idx})` : `unknown(${idx})`;
          }).join(', ')}`);
        }
        return !isAncestor;
      });
      console.log(`[PAIRS] Filtered group from ${group.length} to ${cleanedGroup.length} members: ${cleanedGroup.map(n => `${n.name}(${n.index})`).join(', ')}`);
      
      // If still more than 2, use bucket-based selection to find nodes in different buckets
      if (cleanedGroup.length > 2) {
        console.log(`[PAIRS] Still ${cleanedGroup.length} members after filtering: ${cleanedGroup.map(n => `${n.name}(${n.index})`).join(', ')}`);
        
        // Group by bucket
        const buckets = new Map<number, FlatNode[]>();
        for (const node of cleanedGroup) {
          const bucket = getUnitBucketIndex(nodeLookup, node.index, unit.nodeIndex);
          if (bucket !== null) {
            if (!buckets.has(bucket)) {
              buckets.set(bucket, []);
            }
            buckets.get(bucket)!.push(node);
          }
        }
        
        console.log(`[PAIRS]   Buckets: ${buckets.size} (${Array.from(buckets.entries()).map(([b, nodes]) => `bucket ${b}: ${nodes.length} nodes`).join(', ')})`);
        
        // If we have exactly 2 buckets with nodes, use one node from each bucket
        if (buckets.size === 2) {
          const bucketNodes = Array.from(buckets.values());
          cleanedGroup = [bucketNodes[0][0], bucketNodes[1][0]];
          console.log(`[PAIRS] ✓ Found pair from different buckets: ${cleanedGroup[0].name} (${cleanedGroup[0].index}, bucket ${getUnitBucketIndex(nodeLookup, cleanedGroup[0].index, unit.nodeIndex)}) and ${cleanedGroup[1].name} (${cleanedGroup[1].index}, bucket ${getUnitBucketIndex(nodeLookup, cleanedGroup[1].index, unit.nodeIndex)})`);
        }
      }
    }

    if (cleanedGroup.length !== 2) {
      console.log(`[PAIRS] Skipping group with ${cleanedGroup.length} members after filtering (need exactly 2)`);
      continue;
    }

    const [subtreeA, subtreeB] = cleanedGroup;

    console.log(`[PAIRS] Checking potential pair: ${subtreeA.name} (${subtreeA.subtreePointCount} pts) vs ${subtreeB.name} (${subtreeB.subtreePointCount} pts)`);

    const bucketA = getUnitBucketIndex(nodeLookup, subtreeA.index, unit.nodeIndex);
    const bucketB = getUnitBucketIndex(nodeLookup, subtreeB.index, unit.nodeIndex);

    if (bucketA === null || bucketB === null) {
      console.log(`[PAIRS]   Skipping pair: unable to determine unit bucket (bucketA=${bucketA}, bucketB=${bucketB})`);
      continue;
    }

    if (bucketA === bucketB) {
      console.log(`[PAIRS]   Skipping pair: both nodes share the same top-level unit bucket (${bucketA})`);
      continue;
    }

    // Get geometry nodes in each subtree
    const geomA = getGeometryNodes(data.nodes, subtreeA.index);
    const geomB = getGeometryNodes(data.nodes, subtreeB.index);

    console.log(`[PAIRS]   Geometry nodes: ${geomA.length} vs ${geomB.length}`);
    console.log(`[PAIRS]   Subtree A (${subtreeA.name}) point counts: A=${subtreeA.subtreePointCount}, B=${subtreeB.subtreePointCount}`);

    // Match geometry by point count
    const matches = matchGeometryByPointCount(
      geomA,
      geomB,
      cfg.POINT_COUNT_TOLERANCE,
      cfg.MIN_GEOMETRY_POINTS
    );

    console.log(`[PAIRS]   Matched ${matches.length} geometry pairs`);

    if (matches.length === 0) {
      // If no geometry matches but subtrees have identical point counts, accept based on subtree match alone
      const pointCountDiff = Math.abs(subtreeA.subtreePointCount - subtreeB.subtreePointCount);
      const avgCount = (subtreeA.subtreePointCount + subtreeB.subtreePointCount) / 2;
      const percentDiff = avgCount > 0 ? pointCountDiff / avgCount : 1;
      
      if (percentDiff <= cfg.POINT_COUNT_TOLERANCE && avgCount > 0) {
        console.log(`[PAIRS]   No geometry matches, but subtrees have matching point counts (${percentDiff * 100 < 1 ? 'identical' : `${(percentDiff * 100).toFixed(2)}% diff`}), accepting as pose pair`);
        // Create a synthetic match based on subtree point count
        const syntheticMatches: typeof matches = [{
          closedNodeIndex: subtreeA.index,
          openNodeIndex: subtreeB.index,
          pointCount: Math.round(avgCount),
          closedTransform: {
            translation: subtreeA.translation || null,
            rotation: subtreeA.rotation || null,
          },
          openTransform: {
            translation: subtreeB.translation || null,
            rotation: subtreeB.rotation || null,
          },
        }];
        
        // Use subtree point count for confidence calculation
        const confidence = 0.95; // High confidence since point counts match exactly
        console.log(`[PAIRS]   Using synthetic match with ${(confidence * 100).toFixed(1)}% confidence based on subtree point count match`);
        
        posePairs.push({
          unitIndex: unit.nodeIndex,
          closedSubtreeIndex: subtreeA.index,
          openSubtreeIndex: subtreeB.index,
          matchingGeometry: syntheticMatches,
          confidence,
        });
        
        console.log(`[PAIRS] ✓ Pose pair detected (no geometry, subtree match): subtrees ${subtreeA.index} and ${subtreeB.index}, confidence ${(confidence * 100).toFixed(1)}%`);
        continue;
      }
      continue;
    }

    // Calculate confidence based on how much geometry matched
    const matchedPoints = matches.reduce((sum, m) => sum + m.pointCount, 0);
    const totalGeomPoints = Math.max(
      geomA.reduce((sum, n) => sum + n.pointCount, 0),
      geomB.reduce((sum, n) => sum + n.pointCount, 0)
    );
    const confidence = totalGeomPoints > 0 ? matchedPoints / totalGeomPoints : 0;

    console.log(`[PAIRS]   Confidence: ${(confidence * 100).toFixed(1)}% (${matchedPoints} / ${totalGeomPoints} pts matched)`);

    if (confidence >= cfg.MIN_MATCH_CONFIDENCE) {
      posePairs.push({
        unitIndex: unit.nodeIndex,
        closedSubtreeIndex: subtreeA.index,  // Arbitrary assignment for now
        openSubtreeIndex: subtreeB.index,
        matchingGeometry: matches,
        confidence,
      });

      console.log(`[PAIRS] ✓ Pose pair detected: subtrees ${subtreeA.index} and ${subtreeB.index}, confidence ${(confidence * 100).toFixed(1)}%`);
    }
  }

  return posePairs;
}

/**
 * Get significant subtrees within a unit (potential pose containers).
 *
 * UPDATED: Now searches ALL descendants recursively, not just direct children.
 * This allows detecting pose pairs at any depth in the hierarchy.
 */
function getSignificantSubtrees(
  nodes: FlatNode[],
  unit: DetectedUnit,
  minPercent: number
): FlatNode[] {
  const minPoints = unit.subtreePointCount * minPercent;
  const maxPoints = unit.subtreePointCount * 0.95; // Not almost the whole unit

  // Get ALL descendants of the unit (recursive search)
  const allDescendants = getAllDescendants(nodes, unit.nodeIndex);

  // Filter by point count threshold
  // This is name-agnostic: uses only subtree point counts
  const candidates = allDescendants.filter(descendant =>
    descendant.subtreePointCount >= minPoints &&
    descendant.subtreePointCount < maxPoints
  );

  // Simple strategy: Return ALL candidates without filtering
  // The grouping phase will handle finding matches by point count
  // If parent and child have same count (e.g., WIRE=8002, OPEN=8002),
  // the grouping logic will prefer the deeper node when forming pairs
  return candidates;
}

/**
 * Check if nodeIndex is a descendant of potentialAncestorIndex
 */
function isDescendantOf(
  nodes: FlatNode[],
  nodeIndex: number,
  potentialAncestorIndex: number
): boolean {
  // Quick check: if they're the same, return false (a node is not its own descendant)
  if (nodeIndex === potentialAncestorIndex) {
    return false;
  }
  
  // Walk up the parent chain from nodeIndex to see if we reach potentialAncestorIndex
  let current: number | null = nodeIndex;
  const visited = new Set<number>();
  
  while (current !== null && current !== undefined && !visited.has(current)) {
    visited.add(current);
    if (current === potentialAncestorIndex) {
      return true;
    }
    const node = nodes[current];
    if (!node) break;
    current = node.parentIndex ?? null;
  }
  
  return false;
}

function getUnitBucketIndex(
  nodeLookup: Map<number, FlatNode>,
  nodeIndex: number,
  unitIndex: number
): number | null {
  const visited = new Set<number>();
  let current: number | null | undefined = nodeIndex;

  while (current !== null && current !== undefined && !visited.has(current)) {
    visited.add(current);
    const parent = nodeLookup.get(current)?.parentIndex;
    if (parent === null || parent === undefined) {
      return null;
    }
    if (parent === unitIndex) {
      return current;
    }
    current = parent;
  }

  return null;
}

/**
 * Group subtrees by approximate point count.
 */
function groupByPointCount(
  subtrees: FlatNode[],
  tolerance: number
): FlatNode[][] {
  const groups: FlatNode[][] = [];

  for (const subtree of subtrees) {
    // Find existing group with similar point count
    let foundGroup = false;

    for (const group of groups) {
      const representative = group[0];
      const diff = Math.abs(subtree.subtreePointCount - representative.subtreePointCount);
      const avgCount = (subtree.subtreePointCount + representative.subtreePointCount) / 2;
      const percentDiff = diff / avgCount;

      console.log(`[PAIRS]   Comparing ${subtree.name} (${subtree.subtreePointCount}) with group [${representative.name} (${representative.subtreePointCount})]: ${(percentDiff * 100).toFixed(2)}% diff (tolerance: ${(tolerance * 100).toFixed(0)}%)`);

      if (percentDiff <= tolerance) {
        console.log(`[PAIRS]     ✓ Match! Adding to group`);
        group.push(subtree);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      console.log(`[PAIRS]   No matching group found, creating new group for ${subtree.name}`);
      groups.push([subtree]);
    }
  }

  return groups;
}

/**
 * Match geometry nodes by point count (same geometry = same vertex count).
 */
export function matchGeometryByPointCount(
  geomA: FlatNode[],
  geomB: FlatNode[],
  tolerance: number,
  minPoints: number
): GeometryMatch[] {
  const matches: GeometryMatch[] = [];
  const usedB = new Set<number>();

  for (const nodeA of geomA) {
    if (nodeA.pointCount < minPoints) continue;

    // Find matching node in B by point count
    for (const nodeB of geomB) {
      if (usedB.has(nodeB.index)) continue;
      if (nodeB.pointCount < minPoints) continue;

      const diff = Math.abs(nodeA.pointCount - nodeB.pointCount);
      const avgCount = (nodeA.pointCount + nodeB.pointCount) / 2;

      if (diff / avgCount <= tolerance) {
        matches.push({
          closedNodeIndex: nodeA.index,
          openNodeIndex: nodeB.index,
          pointCount: nodeA.pointCount,
          closedTransform: {
            translation: nodeA.translation || null,
            rotation: nodeA.rotation || null,
          },
          openTransform: {
            translation: nodeB.translation || null,
            rotation: nodeB.rotation || null,
          },
        });
        usedB.add(nodeB.index);
        break;
      }
    }
  }

  return matches;
}
