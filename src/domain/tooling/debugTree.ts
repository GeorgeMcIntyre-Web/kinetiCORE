/**
 * Pure domain function to format tooling point cloud tree as text.
 * No dependencies on Babylon, Node, GLB, or any I/O.
 */

import type { ToolingStructure, ToolingNodeGeometry, ToolingNode } from './types';

export type DebugTreeOptions = {
  maxDepth?: number;
  minPoints?: number;
};

export type DebugTreeRow = {
  nodeId: string;
  nodeName: string;   // ALWAYS populated
  parentId: string | null;
  depth: number;
  pointCount: number;
};

/**
 * Format tooling point cloud tree as a multi-line text string.
 * 
 * @param structure - Tooling structure tree
 * @param geometryIndex - Map of nodeId -> point cloud geometry
 * @param options - Formatting options
 * @returns Multi-line string with indented tree structure
 */
export function formatToolingPointTree(
  structure: ToolingStructure,
  geometryIndex: Map<string, ToolingNodeGeometry>,
  options: DebugTreeOptions = {}
): string {
  if (!structure.root) {
    return '';
  }

  const rows: DebugTreeRow[] = [];
  collectRows(structure.root, 0, rows, options, geometryIndex);

  return formatRows(rows);
}

/**
 * Recursively collect tree rows from nodes.
 */
function collectRows(
  node: ToolingNode,
  depth: number,
  rows: DebugTreeRow[],
  options: DebugTreeOptions,
  geometryIndex: Map<string, ToolingNodeGeometry>
): void {
  // Guard: respect maxDepth
  if (options.maxDepth !== undefined && depth > options.maxDepth) {
    return;
  }

  const geometry = geometryIndex.get(node.id);
  const pointCount = geometry?.points.length ?? 0;

  // Guard: respect minPoints (but still recurse into children)
  if (options.minPoints !== undefined && pointCount < options.minPoints) {
    // Still recurse into children even if we skip this node
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        collectRows(child, depth + 1, rows, options, geometryIndex);
      }
    }
    return;
  }

  // ALWAYS populate nodeName - use node.id as fallback if name is missing
  const nodeName = node.name || node.id;

  rows.push({
    nodeId: node.id,
    nodeName,
    parentId: node.parentId,
    depth,
    pointCount,
  });

  if (!node.children || node.children.length === 0) {
    return;
  }

  for (const child of node.children) {
    collectRows(child, depth + 1, rows, options, geometryIndex);
  }
}

/**
 * Format collected rows into a multi-line string.
 * Format: - [L<depth>] <nodeName> (<nodeId>) :: points=<pointCount>
 */
function formatRows(rows: DebugTreeRow[]): string {
  const lines: string[] = [];

  for (const row of rows) {
    const indent = '  '.repeat(row.depth);
    const line = `${indent}- [L${row.depth}] ${row.nodeName} (${row.nodeId}) :: points=${row.pointCount.toLocaleString()}`;
    lines.push(line);
  }

  return lines.join('\n');
}

