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

  console.log(`[PAIRS] Analyzing unit ${unitNode.name} (index ${unit.nodeIndex})`);

  // Get all significant subtrees within this unit
  const subtrees = getSignificantSubtrees(data.nodes, unit, cfg.MIN_SUBTREE_PERCENT);
  console.log(`[PAIRS] Found ${subtrees.length} significant subtrees`);

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

    // If group has more than 2 members, filter out parent-child duplicates
    // (e.g., WIRE and OPEN both at 8002 pts - keep the deeper OPEN)
    let cleanedGroup = group;
    if (group.length > 2) {
      cleanedGroup = group.filter(node => {
        // Keep this node if it's NOT a parent of another node in the group
        const isParentOfGroupMember = group.some(other =>
          other.index !== node.index &&
          isDescendantOf(data.nodes, other.index, node.index)
        );
        return !isParentOfGroupMember;
      });
      console.log(`[PAIRS] Filtered group from ${group.length} to ${cleanedGroup.length} members (removed parent-child duplicates)`);
    }

    if (cleanedGroup.length !== 2) {
      console.log(`[PAIRS] Skipping group with ${cleanedGroup.length} members after filtering (need exactly 2)`);
      continue;
    }

    const [subtreeA, subtreeB] = cleanedGroup;

    console.log(`[PAIRS] Checking potential pair: ${subtreeA.name} (${subtreeA.subtreePointCount} pts) vs ${subtreeB.name} (${subtreeB.subtreePointCount} pts)`);

    // Get geometry nodes in each subtree
    const geomA = getGeometryNodes(data.nodes, subtreeA.index);
    const geomB = getGeometryNodes(data.nodes, subtreeB.index);

    console.log(`[PAIRS]   Geometry nodes: ${geomA.length} vs ${geomB.length}`);

    // Match geometry by point count
    const matches = matchGeometryByPointCount(
      geomA,
      geomB,
      cfg.POINT_COUNT_TOLERANCE,
      cfg.MIN_GEOMETRY_POINTS
    );

    console.log(`[PAIRS]   Matched ${matches.length} geometry pairs`);

    if (matches.length === 0) continue;

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
  const descendants = getAllDescendants(nodes, potentialAncestorIndex);
  return descendants.some(d => d.index === nodeIndex);
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
