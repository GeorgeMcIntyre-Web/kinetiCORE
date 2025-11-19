/**
 * Pure domain functions to compute statistics from tooling tree rows.
 * Works entirely from DebugTreeRow[] - no Babylon, no GLB, no I/O.
 */

import type { DebugTreeRow } from './debugTree';

export type LevelStats = {
  depth: number;
  nodeCount: number;
  totalPoints: number;
  minPoints: number;
  maxPoints: number;
  medianPoints: number;
};

export type ParentCoverageStats = {
  parentId: string;
  parentName: string;
  parentDepth: number;
  parentPoints: number;
  childDepth: number;
  childCount: number;
  childTotalPoints: number;
  coverageRatio: number; // childTotalPoints / parentPoints
  childMinPoints: number;
  childMaxPoints: number;
};

/**
 * Compute statistics for each depth level in the tree.
 */
export function computeLevelStats(rows: DebugTreeRow[]): LevelStats[] {
  if (rows.length === 0) {
    return [];
  }

  // Group rows by depth
  const nodesByDepth = new Map<number, DebugTreeRow[]>();

  for (const row of rows) {
    const depthNodes = nodesByDepth.get(row.depth);
    if (!depthNodes) {
      nodesByDepth.set(row.depth, [row]);
      continue;
    }
    depthNodes.push(row);
  }

  // Compute stats for each depth
  const stats: LevelStats[] = [];

  for (const [depth, nodes] of nodesByDepth) {
    const pointCounts = nodes.map(n => n.pointCount);
    const sortedCounts = [...pointCounts].sort((a, b) => a - b);

    const totalPoints = pointCounts.reduce((sum, count) => sum + count, 0);
    const minPoints = sortedCounts[0];
    const maxPoints = sortedCounts[sortedCounts.length - 1];

    // Compute median
    const midIndex = Math.floor(sortedCounts.length / 2);
    const medianPoints = sortedCounts.length % 2 === 0
      ? (sortedCounts[midIndex - 1] + sortedCounts[midIndex]) / 2
      : sortedCounts[midIndex];

    stats.push({
      depth,
      nodeCount: nodes.length,
      totalPoints,
      minPoints,
      maxPoints,
      medianPoints,
    });
  }

  // Sort by depth
  stats.sort((a, b) => a.depth - b.depth);

  return stats;
}

/**
 * Compute parent-child coverage statistics.
 * For each parent node, shows how well its children's point counts cover the parent.
 */
export function computeParentCoverageStats(rows: DebugTreeRow[]): ParentCoverageStats[] {
  if (rows.length === 0) {
    return [];
  }

  // Build parent-child relationships
  const nodeMap = new Map<string, DebugTreeRow>();
  const childrenMap = new Map<string, DebugTreeRow[]>();

  for (const row of rows) {
    nodeMap.set(row.nodeId, row);
  }

  for (const row of rows) {
    if (!row.parentId) {
      continue;
    }

    const siblings = childrenMap.get(row.parentId);
    if (!siblings) {
      childrenMap.set(row.parentId, [row]);
      continue;
    }
    siblings.push(row);
  }

  // Compute coverage stats for each parent
  const stats: ParentCoverageStats[] = [];

  for (const [parentId, children] of childrenMap) {
    const parent = nodeMap.get(parentId);
    if (!parent) {
      continue;
    }

    if (children.length === 0) {
      continue;
    }

    const childPointCounts = children.map(c => c.pointCount);
    const childTotalPoints = childPointCounts.reduce((sum, count) => sum + count, 0);
    const childMinPoints = Math.min(...childPointCounts);
    const childMaxPoints = Math.max(...childPointCounts);
    const childDepth = children[0].depth;

    const coverageRatio = parent.pointCount > 0
      ? childTotalPoints / parent.pointCount
      : 0;

    stats.push({
      parentId: parent.nodeId,
      parentName: parent.nodeName,
      parentDepth: parent.depth,
      parentPoints: parent.pointCount,
      childDepth,
      childCount: children.length,
      childTotalPoints,
      coverageRatio,
      childMinPoints,
      childMaxPoints,
    });
  }

  // Sort by parent depth, then by parent name
  stats.sort((a, b) => {
    if (a.parentDepth !== b.parentDepth) {
      return a.parentDepth - b.parentDepth;
    }
    return a.parentName.localeCompare(b.parentName);
  });

  return stats;
}
