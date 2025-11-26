/**
 * Step 1: Name-Agnostic Unit Detection
 *
 * Detects logical sub-assemblies (units) within a fixture using ONLY
 * geometry and hierarchy data - no reliance on node names.
 */

import type {
  GLBTreeData,
  FlatNode,
  DetectedUnit,
  UnitDetectionConfig,
} from './types';

const DEFAULT_CONFIG: UnitDetectionConfig = {
  MIN_UNIT_PERCENT: 1.0,       // Minimum 1% of total points
  MAX_UNIT_PERCENT: 60.0,      // Maximum 60%
  MIN_UNIT_COUNT: 2,           // Expect at least 2 units
  MAX_UNIT_COUNT: 50,          // Reasonable upper bound
  PASSTHROUGH_THRESHOLD: 0.95, // If child has >95% of parent's points
};

/**
 * Detect units within a fixture using geometry-based analysis.
 *
 * Algorithm:
 * 1. Find the "unit level" - the depth where actual units live
 * 2. Handle pass-through container nodes (single child with ~100% points)
 * 3. Filter candidates by point count thresholds
 * 4. Validate total coverage
 *
 * @param data - GLB tree data
 * @param config - Optional configuration overrides
 * @returns Array of detected units
 */
export function detectUnits(
  data: GLBTreeData,
  config: Partial<UnitDetectionConfig> = {}
): DetectedUnit[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const totalPoints = data.summary.totalPointCount;

  console.log(`[UNITS] Analyzing ${data.summary.totalNodes} nodes, ${totalPoints} total points`);

  // Find root node
  const rootNode = data.nodes.find(n => n.parentIndex === null);
  if (!rootNode) {
    console.warn('[UNITS] No root node found');
    return [];
  }

  // Determine the unit level (depth 1 or 2)
  const unitDepth = findUnitLevel(data.nodes, rootNode, cfg, totalPoints);
  console.log(`[UNITS] Unit level determined to be depth ${unitDepth}`);

  // Get candidate units at the detected depth
  const candidates = data.nodes.filter(n =>
    n.depth === unitDepth &&
    n.subtreePointCount > 0
  );

  console.log(`[UNITS] Found ${candidates.length} candidates at depth ${unitDepth}`);

  // Filter by point count thresholds
  const units = candidates
    .filter(n => {
      const percent = (n.subtreePointCount / totalPoints) * 100;
      return percent >= cfg.MIN_UNIT_PERCENT &&
             percent <= cfg.MAX_UNIT_PERCENT;
    })
    .map(n => ({
      nodeIndex: n.index,
      depth: n.depth,
      subtreePointCount: n.subtreePointCount,
      percentOfTotal: (n.subtreePointCount / totalPoints) * 100,
      childCount: n.childrenIndices.length,
      hasMovingParts: false,  // Determined in pose pair detection
    }));

  console.log(`[UNITS] Detected ${units.length} units after filtering`);
  for (const unit of units) {
    const node = data.nodes[unit.nodeIndex];
    console.log(`[UNITS]   ${node.name} (index ${unit.nodeIndex}): ${unit.subtreePointCount.toLocaleString()} pts (${unit.percentOfTotal.toFixed(1)}%)`);
  }

  // Validation
  const totalCoverage = units.reduce((sum, u) => sum + u.subtreePointCount, 0);
  const coveragePercent = (totalCoverage / totalPoints) * 100;
  console.log(`[UNITS] Total coverage: ${coveragePercent.toFixed(1)}%`);

  if (coveragePercent < 85) {
    console.warn(`[UNITS] WARNING: Low coverage (${coveragePercent.toFixed(1)}%), may be missing units`);
  }

  if (units.length < cfg.MIN_UNIT_COUNT) {
    console.warn(`[UNITS] WARNING: Only ${units.length} units detected, expected at least ${cfg.MIN_UNIT_COUNT}`);
  }

  if (units.length > cfg.MAX_UNIT_COUNT) {
    console.warn(`[UNITS] WARNING: ${units.length} units detected, seems high (max expected: ${cfg.MAX_UNIT_COUNT})`);
  }

  return units;
}

/**
 * Find the depth level where actual units are located.
 * Handles pass-through container nodes.
 */
function findUnitLevel(
  nodes: FlatNode[],
  rootNode: FlatNode,
  config: UnitDetectionConfig,
  totalPoints: number
): number {
  // Start by checking depth 1
  const depth1Children = nodes.filter(n => n.depth === 1);

  // Case 1: No depth-1 children - something is wrong
  if (depth1Children.length === 0) {
    console.warn('[UNITS] No depth-1 children found, checking depth 2');
    return 2;
  }

  // Case 2: Single depth-1 child with almost all points - likely a pass-through
  if (depth1Children.length === 1) {
    const child = depth1Children[0];
    const ratio = child.subtreePointCount / totalPoints;

    if (ratio > config.PASSTHROUGH_THRESHOLD) {
      console.log(`[UNITS] Depth-1 has single child with ${(ratio * 100).toFixed(1)}% of points - pass-through detected`);
      return 2;
    }
  }

  // Case 3: Multiple depth-1 children - likely the unit level
  return 1;
}

/**
 * Get immediate children of a node (for analysis).
 */
export function getImmediateChildren(
  nodes: FlatNode[],
  nodeIndex: number
): FlatNode[] {
  const node = nodes[nodeIndex];
  if (!node) return [];

  return node.childrenIndices.map(idx => nodes[idx]).filter(Boolean);
}

/**
 * Get all descendants of a node (for subtree analysis).
 */
export function getAllDescendants(
  nodes: FlatNode[],
  nodeIndex: number
): FlatNode[] {
  const result: FlatNode[] = [];
  const stack = [nodeIndex];

  while (stack.length > 0) {
    const idx = stack.pop()!;
    const node = nodes[idx];

    if (!node) continue;

    result.push(node);
    stack.push(...node.childrenIndices);
  }

  return result;
}

/**
 * Get all nodes with geometry (meshes) in a subtree.
 */
export function getGeometryNodes(
  nodes: FlatNode[],
  subtreeRootIndex: number
): FlatNode[] {
  const descendants = getAllDescendants(nodes, subtreeRootIndex);
  return descendants.filter(n =>
    n.meshIndex !== null &&
    n.pointCount > 0
  );
}
