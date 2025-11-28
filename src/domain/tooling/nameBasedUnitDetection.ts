/**
 * Name-based tooling unit detection using tree structure + naming heuristics.
 *
 * Algorithm:
 * 1. Find the "tool root" (top-level assembly node)
 * 2. Collect raw unit candidates based on naming patterns + point counts
 * 3. Score each candidate using structure heuristics (FIXED/MOVING/ORDER/FASTENER)
 * 4. Greedily select largest non-overlapping subtrees
 * 5. Classify side (LH/RH) and symmetry
 *
 * Works for:
 * - FORD 016ZF tools (UNIT_10x with RH/LH structure)
 * - BMW 217453 tools (BASE UNIT, CLAMP UNIT, PIN UNIT, SUPPORT UNIT, RETRACT PIN UNIT)
 */

import type { ToolingNode, ToolingStructure, ToolingNodeGeometry } from './types';

/**
 * Tooling unit kind taxonomy.
 */
export type ToolingUnitKind =
  | 'base'
  | 'clamp'
  | 'pin'
  | 'support'
  | 'retractPin'
  | 'misc';

/**
 * Side designation (LH/RH from structure).
 */
export type Side = 'LH' | 'RH' | 'BOTH' | 'UNKNOWN';

/**
 * Detected tooling unit candidate.
 */
export interface ToolingUnitCandidate {
  id: string;                 // Node id of the subtree root
  pathNames: string[];        // Full name path from tool root to this node
  displayName: string;        // Derived display name (e.g. "UNIT_106 RH", "CLAMP UNIT_240")
  kind: ToolingUnitKind;
  isSymmetric: boolean;       // True if name contains "SYM"
  side: Side;                 // Heuristic from path (LH/RH) where available
  depth: number;              // Tree depth
  points: number;             // Total points at this node
  parentPoints: number | null;
  score: number;              // Computed unit-likeness score
}

/**
 * Configuration for unit detection.
 */
export interface UnitDetectionConfig {
  /** Minimum points ratio relative to tool root. Default: 0.005 (0.5%) */
  minPointsRatio?: number;
  /** Maximum points ratio for base unit. Default: 0.6 (60%) */
  maxBaseUnitRatio?: number;
  /** Minimum score to consider as unit. Default: 2 */
  minScoreForUnit?: number;
  /** Allow misc units (units without clear type). Default: false */
  allowMiscUnits?: boolean;
  /** Maximum depth to search. Default: 20 */
  maxDepth?: number;
}

const DEFAULT_CONFIG: Required<UnitDetectionConfig> = {
  minPointsRatio: 0.005,
  maxBaseUnitRatio: 0.6,
  minScoreForUnit: 2,
  allowMiscUnits: false,
  maxDepth: 20,
};

/**
 * Internal node representation with computed features.
 */
type EnrichedNode = {
  node: ToolingNode;
  pathNames: string[];
  depth: number;
  points: number;
  parentPoints: number | null;
  nameTokens: string[];
};

/**
 * Main entry point: detect tooling units from structure + geometry.
 *
 * @param structure - Tooling structure tree
 * @param geometryIndex - Map of nodeId -> point cloud geometry
 * @param config - Detection configuration
 * @returns List of detected tooling unit candidates
 */
export function selectToolingUnits(
  structure: ToolingStructure,
  geometryIndex: Map<string, ToolingNodeGeometry>,
  config: UnitDetectionConfig = {}
): ToolingUnitCandidate[] {
  if (!structure.root) {
    return [];
  }

  const opts = { ...DEFAULT_CONFIG, ...config };

  // Step 1: Find tool root
  const toolRoot = findToolRoot(structure.root, geometryIndex);
  if (!toolRoot) {
    return [];
  }

  const toolRootGeometry = geometryIndex.get(toolRoot.id);
  if (!toolRootGeometry || toolRootGeometry.points.length === 0) {
    return [];
  }

  // Step 2: Build paths and enrich nodes
  const enrichedNodes = buildEnrichedNodes(toolRoot, [], 0, geometryIndex, opts);

  // Step 3: Collect raw candidates
  const rawCandidates = collectRawUnitCandidates(
    enrichedNodes,
    toolRootGeometry.points.length,
    opts
  );

  // Step 4: Select non-overlapping units
  const selectedUnits = selectNonOverlappingUnits(rawCandidates, structure.nodes);

  // Step 5: Enrich with side information
  return selectedUnits.map(unit => enrichWithSideInfo(unit, structure.nodes));
}

/**
 * Find the "tool root" node.
 * Heuristic: single child with project number pattern, or largest child.
 */
export function findToolRoot(
  root: ToolingNode,
  geometryIndex: Map<string, ToolingNodeGeometry>
): ToolingNode | null {
  if (!root) {
    return null;
  }

  // If root has no children, it IS the tool root
  if (!root.children || root.children.length === 0) {
    return root;
  }

  // If root has exactly one child, use that child
  if (root.children.length === 1) {
    return root.children[0];
  }

  // Find child with project number pattern (alphanumeric codes like 016ZF_, 217453000, etc.)
  const projectPatterns = [
    /\d{3,}[A-Z]/i,        // e.g., 016ZF, 2174530000
    /[A-Z]{2,}\d{3,}/i,    // e.g., CM030, GJR
  ];
  for (const child of root.children) {
    if (!child.name) continue;

    for (const pattern of projectPatterns) {
      if (pattern.test(child.name)) {
        return child;
      }
    }
  }

  // Fallback: use child with maximum points
  let maxChild = root.children[0];
  let maxPoints = geometryIndex.get(maxChild.id)?.points.length ?? 0;

  for (const child of root.children) {
    const childPoints = geometryIndex.get(child.id)?.points.length ?? 0;
    if (childPoints > maxPoints) {
      maxPoints = childPoints;
      maxChild = child;
    }
  }

  return maxChild;
}

/**
 * Build enriched node representations with paths and point counts.
 */
function buildEnrichedNodes(
  node: ToolingNode,
  pathNames: string[],
  depth: number,
  geometryIndex: Map<string, ToolingNodeGeometry>,
  config: Required<UnitDetectionConfig>
): EnrichedNode[] {
  if (depth > config.maxDepth) {
    return [];
  }

  const geometry = geometryIndex.get(node.id);
  const points = geometry?.points.length ?? 0;

  const nodeName = node.name || node.id;
  const currentPath = [...pathNames, nodeName];
  const nameTokens = tokenizeName(nodeName);

  const enriched: EnrichedNode = {
    node,
    pathNames: currentPath,
    depth,
    points,
    parentPoints: null, // Will be set by parent if needed
    nameTokens,
  };

  const result: EnrichedNode[] = [enriched];

  if (!node.children || node.children.length === 0) {
    return result;
  }

  for (const child of node.children) {
    const childNodes = buildEnrichedNodes(child, currentPath, depth + 1, geometryIndex, config);

    // Set parent points for immediate children
    for (const childNode of childNodes) {
      if (childNode.depth === depth + 1) {
        childNode.parentPoints = points;
      }
    }

    result.push(...childNodes);
  }

  return result;
}

/**
 * Tokenize a name into searchable tokens.
 * Splits on: _, space, hyphen
 */
function tokenizeName(name: string): string[] {
  if (!name) {
    return [];
  }

  return name
    .split(/[_\s\-]+/)
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);
}

/**
 * Collect raw unit candidates based on naming + structure heuristics.
 */
function collectRawUnitCandidates(
  enrichedNodes: EnrichedNode[],
  toolRootPoints: number,
  config: Required<UnitDetectionConfig>
): ToolingUnitCandidate[] {
  const candidates: ToolingUnitCandidate[] = [];

  for (const enriched of enrichedNodes) {
    // Guard: ignore nodes with zero points
    if (enriched.points <= 0) {
      continue;
    }

    // Guard: ignore tiny nodes relative to root
    const pointsRatio = enriched.points / toolRootPoints;
    if (pointsRatio < config.minPointsRatio) {
      continue;
    }

    // Compute features
    const features = computeNodeFeatures(enriched);

    // Guard: ignore construction nodes
    if (features.isConstruction) {
      continue;
    }

    // Classify kind
    const kind = classifyUnitKind(features);

    // Guard: skip misc units if not allowed
    if (kind === 'misc' && !config.allowMiscUnits) {
      continue;
    }

    // Compute score
    const score = scoreUnitCandidate(features, enriched, toolRootPoints, config);

    // Guard: skip low-scoring candidates
    if (score < config.minScoreForUnit) {
      continue;
    }

    // Guard: base units must not be too large
    if (kind === 'base' && pointsRatio > config.maxBaseUnitRatio) {
      continue;
    }

    // Build candidate
    const displayName = deriveDisplayName(enriched, features);

    candidates.push({
      id: enriched.node.id,
      pathNames: enriched.pathNames,
      displayName,
      kind,
      isSymmetric: features.isSymmetric,
      side: 'UNKNOWN', // Will be enriched later
      depth: enriched.depth,
      points: enriched.points,
      parentPoints: enriched.parentPoints,
      score,
    });
  }

  return candidates;
}

/**
 * Node features computed for classification.
 */
type NodeFeatures = {
  hasUnitToken: boolean;
  isBaseUnitName: boolean;
  hasClampToken: boolean;
  hasPinToken: boolean;
  hasSupportToken: boolean;
  hasRetractToken: boolean;
  isSymmetric: boolean;
  isConstruction: boolean;
  hasSideToken: boolean;
  hasFixedMovingOpenWire: boolean;
  hasFastenerChild: boolean;
  hasOrderChild: boolean;
  hasActuationVendor: boolean;
};

/**
 * Compute structural features for a node.
 */
function computeNodeFeatures(enriched: EnrichedNode): NodeFeatures {
  const tokens = enriched.nameTokens;
  const childNames = enriched.node.children.map(c => c.name || c.id).map(n => n.toUpperCase());

  return {
    hasUnitToken: tokens.includes('UNIT'),
    isBaseUnitName: tokens.includes('BASE') && tokens.includes('UNIT'),
    hasClampToken: tokens.includes('CLAMP'),
    hasPinToken: tokens.includes('PIN'),
    hasSupportToken: tokens.includes('SUPPORT'),
    hasRetractToken: tokens.includes('RETRACT'),
    isSymmetric: tokens.includes('SYM') || enriched.pathNames.some(p => p.includes('SYM')),
    isConstruction: tokens.includes('CONSTRUCTION'),
    hasSideToken: tokens.includes('LH') || tokens.includes('RH') ||
                  enriched.pathNames.some(p => /\b(LH|RH)\b/i.test(p)),
    hasFixedMovingOpenWire: hasDescendantsNamed(enriched.node, ['FIXED', 'MOVING', 'OPEN', 'WIRE']),
    hasFastenerChild: childNames.some(n => n.includes('FASTENER')),
    hasOrderChild: childNames.some(n => n.includes('ORDER')),
    hasActuationVendor: tokens.some(t =>
      ['DESTACO', 'TUENKERS', 'POWER', 'CLAMP', 'SCHUNK'].includes(t)
    ),
  };
}

/**
 * Check if node has descendants with specific names.
 */
function hasDescendantsNamed(node: ToolingNode, names: string[]): boolean {
  if (!node.children || node.children.length === 0) {
    return false;
  }

  const childNames = node.children.map(c => (c.name || c.id).toUpperCase());
  const hasAny = names.some(name => childNames.some(cn => cn.includes(name)));

  if (hasAny) {
    return true;
  }

  for (const child of node.children) {
    if (hasDescendantsNamed(child, names)) {
      return true;
    }
  }

  return false;
}

/**
 * Classify unit kind based on features.
 */
function classifyUnitKind(features: NodeFeatures): ToolingUnitKind {
  if (features.isBaseUnitName) {
    return 'base';
  }

  if (features.hasRetractToken && features.hasPinToken) {
    return 'retractPin';
  }

  if (features.hasPinToken && features.hasUnitToken) {
    return 'pin';
  }

  if (features.hasSupportToken && features.hasUnitToken) {
    return 'support';
  }

  if (features.hasClampToken && features.hasUnitToken) {
    return 'clamp';
  }

  // FORD-style UNIT_10x with FIXED/MOVING structure
  if (features.hasUnitToken && features.hasFixedMovingOpenWire) {
    return 'clamp';
  }

  if (features.hasUnitToken) {
    return 'misc';
  }

  return 'misc';
}

/**
 * Score a unit candidate based on structural evidence.
 */
function scoreUnitCandidate(
  features: NodeFeatures,
  enriched: EnrichedNode,
  toolRootPoints: number,
  _config: Required<UnitDetectionConfig>
): number {
  let score = 0;

  // Strong evidence
  if (features.hasUnitToken) {
    score += 3;
  }

  if (features.hasFixedMovingOpenWire) {
    score += 2;
  }

  if (features.hasFastenerChild && features.hasOrderChild) {
    score += 2;
  }

  // Moderate evidence
  if (features.hasActuationVendor) {
    score += 1;
  }

  if (features.hasSideToken) {
    score += 1;
  }

  // Point ratio bonus (units typically 2-50% of tool)
  const pointsRatio = enriched.points / toolRootPoints;
  if (pointsRatio >= 0.02 && pointsRatio <= 0.5) {
    score += 1;
  }

  // Penalties
  if (features.isConstruction) {
    score -= 5;
  }

  return score;
}

/**
 * Derive a display name for the unit.
 */
function deriveDisplayName(enriched: EnrichedNode, features: NodeFeatures): string {
  const nodeName = enriched.node.name || enriched.node.id;

  // BMW-style: "CLAMP UNIT_240"
  if (features.hasClampToken || features.hasPinToken || features.hasSupportToken) {
    return nodeName;
  }

  // FORD-style: "UNIT_106 RH"
  if (features.hasUnitToken && features.hasSideToken) {
    const sideToken = enriched.pathNames.find(p => /\b(LH|RH)\b/i.test(p));
    if (sideToken) {
      const match = sideToken.match(/\b(LH|RH)\b/i);
      if (match) {
        return `${nodeName} ${match[1].toUpperCase()}`;
      }
    }
  }

  return nodeName;
}

/**
 * Greedily select non-overlapping units.
 * Largest units first, ensuring no ancestor/descendant overlap.
 */
function selectNonOverlappingUnits(
  candidates: ToolingUnitCandidate[],
  nodeMap: Map<string, ToolingNode>
): ToolingUnitCandidate[] {
  if (candidates.length === 0) {
    return [];
  }

  // Sort by priority
  const sorted = [...candidates].sort((a, b) => {
    // 1. Kind priority: base > clamp > pin > retractPin > support > misc
    const kindPriority: Record<ToolingUnitKind, number> = {
      base: 0,
      clamp: 1,
      pin: 2,
      retractPin: 3,
      support: 4,
      misc: 5,
    };

    const aPriority = kindPriority[a.kind];
    const bPriority = kindPriority[b.kind];

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // 2. Depth (shallower first)
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }

    // 3. Points (descending)
    return b.points - a.points;
  });

  const selected: ToolingUnitCandidate[] = [];
  const acceptedIds = new Set<string>();

  for (const candidate of sorted) {
    // Guard: skip if already accepted
    if (acceptedIds.has(candidate.id)) {
      continue;
    }

    // Guard: check overlap with accepted units
    if (hasOverlapWithAccepted(candidate, selected, nodeMap)) {
      continue;
    }

    // Special rule: only one base unit
    if (candidate.kind === 'base') {
      const hasBase = selected.some(u => u.kind === 'base');
      if (hasBase) {
        continue;
      }
    }

    // Accept candidate
    selected.push(candidate);
    acceptedIds.add(candidate.id);
  }

  return selected;
}

/**
 * Check if candidate overlaps with any accepted unit (ancestor or descendant).
 */
function hasOverlapWithAccepted(
  candidate: ToolingUnitCandidate,
  accepted: ToolingUnitCandidate[],
  nodeMap: Map<string, ToolingNode>
): boolean {
  for (const acceptedUnit of accepted) {
    if (isAncestorOrDescendant(candidate.id, acceptedUnit.id, nodeMap)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if nodeA is an ancestor or descendant of nodeB.
 */
function isAncestorOrDescendant(
  nodeAId: string,
  nodeBId: string,
  nodeMap: Map<string, ToolingNode>
): boolean {
  if (nodeAId === nodeBId) {
    return true;
  }

  // Check if A is ancestor of B
  if (isAncestorOf(nodeAId, nodeBId, nodeMap)) {
    return true;
  }

  // Check if B is ancestor of A
  if (isAncestorOf(nodeBId, nodeAId, nodeMap)) {
    return true;
  }

  return false;
}

/**
 * Check if ancestorId is an ancestor of descendantId.
 */
function isAncestorOf(
  ancestorId: string,
  descendantId: string,
  nodeMap: Map<string, ToolingNode>
): boolean {
  let current = nodeMap.get(descendantId);

  while (current) {
    if (current.id === ancestorId) {
      return true;
    }

    if (!current.parentId) {
      break;
    }

    current = nodeMap.get(current.parentId);
  }

  return false;
}

/**
 * Enrich unit with side information from path and children.
 */
function enrichWithSideInfo(
  unit: ToolingUnitCandidate,
  nodeMap: Map<string, ToolingNode>
): ToolingUnitCandidate {
  const node = nodeMap.get(unit.id);
  if (!node) {
    return unit;
  }

  // Check path for LH/RH
  const pathSides = unit.pathNames
    .map(p => extractSide(p))
    .filter(s => s !== 'UNKNOWN');

  // Check immediate children for LH/RH
  const childSides = node.children
    .map(c => extractSide(c.name || c.id))
    .filter(s => s !== 'UNKNOWN');

  const allSides = new Set([...pathSides, ...childSides]);

  if (allSides.has('LH') && allSides.has('RH')) {
    return { ...unit, side: 'BOTH' };
  }

  if (allSides.has('LH')) {
    return { ...unit, side: 'LH' };
  }

  if (allSides.has('RH')) {
    return { ...unit, side: 'RH' };
  }

  return { ...unit, side: 'UNKNOWN' };
}

/**
 * Extract side from a name string.
 */
function extractSide(name: string): Side {
  if (!name) {
    return 'UNKNOWN';
  }

  const upper = name.toUpperCase();

  if (/\bLH\b/.test(upper)) {
    return 'LH';
  }

  if (/\bRH\b/.test(upper)) {
    return 'RH';
  }

  return 'UNKNOWN';
}
