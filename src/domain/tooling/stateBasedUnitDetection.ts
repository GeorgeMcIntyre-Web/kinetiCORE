/**
 * State-based tooling unit detection using kinematic snapshots.
 *
 * Algorithm:
 * 1. Detect rigid groups from transform consistency across snapshots
 * 2. Select base group (static + largest point count)
 * 3. Build rigid-group graph from joints
 * 4. Detect units from connected components
 *
 * NO node name dependencies. NO OEM/job-specific logic.
 */

import type { Matrix } from '@babylonjs/core/Maths/math.vector';
import type { ToolingStructure, ToolingNode, ToolingNodeGeometry, JointPair } from './types';

/**
 * Kinematic snapshot: world transforms for all nodes at a given state.
 */
export interface KinematicSnapshot {
  stateId: string;
  nodeWorldMatrices: Map<string, Matrix>;
}

/**
 * Configuration for state-based detection.
 */
export interface StateBasedUnitDetectionConfig {
  transformEpsilon: number;
  minGroupPoints: number;
  maxDepth: number;
}

export const DEFAULT_STATE_BASED_UNIT_DETECTION_CONFIG: StateBasedUnitDetectionConfig = {
  transformEpsilon: 1e-3,
  minGroupPoints: 10,
  maxDepth: 50,
};

export type RigidGroupId = string;

/**
 * Rigid group: nodes that move together as a rigid body across all snapshots.
 */
export interface RigidGroup {
  id: RigidGroupId;
  nodeIds: string[];
  isStatic: boolean;
  totalPoints: number;
}

/**
 * Result of rigid-group detection.
 */
export interface StateBasedRigidGroupsResult {
  rigidGroups: RigidGroup[];
  baseGroupId: RigidGroupId;
}

/**
 * Input for rigid-group detection.
 */
export interface StateBasedRigidGroupsInput {
  structure: ToolingStructure;
  geometryIndex: Map<string, ToolingNodeGeometry>;
  snapshots: KinematicSnapshot[];
}

/**
 * Unit kind classification.
 */
export type UnitKind = 'base' | 'actuated' | 'unknown';

/**
 * Detected unit from rigid groups.
 */
export interface DetectedUnit {
  id: string;
  rigidGroupIds: RigidGroupId[];
  type: UnitKind;
  baseGroupId?: RigidGroupId;
  movingGroupIds: RigidGroupId[];
  jointIds: string[];
}

/**
 * Result of state-based unit detection.
 */
export interface StateBasedUnitDetectionResult {
  rigidGroups: RigidGroup[];
  baseGroupId: RigidGroupId;
  units: DetectedUnit[];
}

/**
 * Input for state-based unit detection.
 */
export interface StateBasedUnitDetectionInput extends StateBasedRigidGroupsInput {
  joints: JointPair[];
}

/**
 * Detect rigid groups from kinematic snapshots.
 *
 * @param input - Structure, geometry, and snapshots
 * @param config - Detection configuration
 * @returns Rigid groups and base group ID
 */
export function detectRigidGroups(
  input: StateBasedRigidGroupsInput,
  config?: Partial<StateBasedUnitDetectionConfig>
): StateBasedRigidGroupsResult {
  const opts = { ...DEFAULT_STATE_BASED_UNIT_DETECTION_CONFIG, ...config };

  if (input.snapshots.length < 2) {
    return { rigidGroups: [], baseGroupId: '' };
  }

  if (!input.structure.root) {
    return { rigidGroups: [], baseGroupId: '' };
  }

  const allNodeIds = collectNodeIds(input.structure.root, opts.maxDepth);

  if (allNodeIds.length === 0) {
    return { rigidGroups: [], baseGroupId: '' };
  }

  const nodeTransformHistories = buildTransformHistories(
    allNodeIds,
    input.snapshots
  );

  const rigidGroups = clusterRigidGroups(
    nodeTransformHistories,
    input.geometryIndex,
    opts.transformEpsilon
  );

  const baseGroupId = selectBaseGroup(rigidGroups);

  return { rigidGroups, baseGroupId };
}

/**
 * Detect units from rigid groups + joints.
 *
 * @param input - Structure, geometry, snapshots, and joints
 * @param config - Detection configuration
 * @returns Rigid groups, base group, and detected units
 */
export function detectUnitsFromState(
  input: StateBasedUnitDetectionInput,
  config?: Partial<StateBasedUnitDetectionConfig>
): StateBasedUnitDetectionResult {
  const { rigidGroups, baseGroupId } = detectRigidGroups(input, config);

  if (rigidGroups.length === 0) {
    return { rigidGroups: [], baseGroupId: '', units: [] };
  }

  const edges = buildRigidGroupEdges(rigidGroups, input.joints);
  const units = buildUnitsFromGraph(rigidGroups, baseGroupId, edges);

  return { rigidGroups, baseGroupId, units };
}

/**
 * Collect all node IDs from the structure tree.
 */
function collectNodeIds(root: ToolingNode, maxDepth: number): string[] {
  const result: string[] = [];
  collectNodeIdsRecursive(root, 0, maxDepth, result);
  return result;
}

function collectNodeIdsRecursive(
  node: ToolingNode,
  depth: number,
  maxDepth: number,
  result: string[]
): void {
  if (depth > maxDepth) {
    return;
  }

  result.push(node.id);

  if (!node.children || node.children.length === 0) {
    return;
  }

  for (const child of node.children) {
    collectNodeIdsRecursive(child, depth + 1, maxDepth, result);
  }
}

/**
 * Transform history for a node across all snapshots.
 */
type TransformHistory = Matrix[];

/**
 * Build transform histories for all nodes.
 * Nodes with missing snapshots are excluded.
 */
function buildTransformHistories(
  nodeIds: string[],
  snapshots: KinematicSnapshot[]
): Map<string, TransformHistory> {
  const histories = new Map<string, TransformHistory>();

  for (const nodeId of nodeIds) {
    const history: TransformHistory = [];

    for (const snapshot of snapshots) {
      const matrix = snapshot.nodeWorldMatrices.get(nodeId);

      if (!matrix) {
        break;
      }

      history.push(matrix);
    }

    if (history.length === snapshots.length) {
      histories.set(nodeId, history);
    }
  }

  return histories;
}

/**
 * Cluster nodes into rigid groups based on transform consistency.
 */
function clusterRigidGroups(
  nodeTransformHistories: Map<string, TransformHistory>,
  geometryIndex: Map<string, ToolingNodeGeometry>,
  epsilon: number
): RigidGroup[] {
  const groups: RigidGroup[] = [];
  const assigned = new Set<string>();

  for (const [nodeId, history] of Array.from(nodeTransformHistories)) {
    if (assigned.has(nodeId)) {
      continue;
    }

    const groupNodeIds: string[] = [nodeId];
    assigned.add(nodeId);

    for (const [otherId, otherHistory] of Array.from(nodeTransformHistories)) {
      if (assigned.has(otherId)) {
        continue;
      }

      if (areHistoriesEqual(history, otherHistory, epsilon)) {
        groupNodeIds.push(otherId);
        assigned.add(otherId);
      }
    }

    const isStatic = isHistoryStatic(history, epsilon);
    const totalPoints = computeTotalPoints(groupNodeIds, geometryIndex);
    const id = `group_${groups.length}`;

    groups.push({
      id,
      nodeIds: groupNodeIds,
      isStatic,
      totalPoints,
    });
  }

  return groups;
}

/**
 * Check if two transform histories are equal across all snapshots.
 */
function areHistoriesEqual(
  a: TransformHistory,
  b: TransformHistory,
  epsilon: number
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (!areTransformsEqual(a[i], b[i], epsilon)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a transform history is static (all transforms equal).
 */
function isHistoryStatic(history: TransformHistory, epsilon: number): boolean {
  if (history.length < 2) {
    return true;
  }

  const first = history[0];

  for (let i = 1; i < history.length; i++) {
    if (!areTransformsEqual(first, history[i], epsilon)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two transforms are equal within epsilon.
 */
function areTransformsEqual(a: Matrix, b: Matrix, epsilon: number): boolean {
  const aPos = a.getTranslation();
  const bPos = b.getTranslation();

  const posDiff = Math.sqrt(
    Math.pow(aPos.x - bPos.x, 2) +
    Math.pow(aPos.y - bPos.y, 2) +
    Math.pow(aPos.z - bPos.z, 2)
  );

  if (posDiff > epsilon) {
    return false;
  }

  const aRot = a.getRotationMatrix();
  const bRot = b.getRotationMatrix();

  const rotDiff = Math.sqrt(
    Math.pow(aRot.m[0] - bRot.m[0], 2) +
    Math.pow(aRot.m[1] - bRot.m[1], 2) +
    Math.pow(aRot.m[2] - bRot.m[2], 2) +
    Math.pow(aRot.m[4] - bRot.m[4], 2) +
    Math.pow(aRot.m[5] - bRot.m[5], 2) +
    Math.pow(aRot.m[6] - bRot.m[6], 2) +
    Math.pow(aRot.m[8] - bRot.m[8], 2) +
    Math.pow(aRot.m[9] - bRot.m[9], 2) +
    Math.pow(aRot.m[10] - bRot.m[10], 2)
  );

  if (rotDiff > epsilon) {
    return false;
  }

  return true;
}

/**
 * Compute total points for a group of nodes.
 */
function computeTotalPoints(
  nodeIds: string[],
  geometryIndex: Map<string, ToolingNodeGeometry>
): number {
  let total = 0;

  for (const nodeId of nodeIds) {
    const geometry = geometryIndex.get(nodeId);

    if (geometry) {
      total += geometry.points.length;
    }
  }

  return total;
}

/**
 * Select base group: static + largest point count.
 */
function selectBaseGroup(groups: RigidGroup[]): RigidGroupId {
  if (groups.length === 0) {
    return '';
  }

  const staticGroups = groups.filter(g => g.isStatic);

  if (staticGroups.length > 0) {
    const sorted = [...staticGroups].sort((a, b) => b.totalPoints - a.totalPoints);
    return sorted[0].id;
  }

  const sorted = [...groups].sort((a, b) => b.totalPoints - a.totalPoints);
  return sorted[0].id;
}

/**
 * Rigid group edge: joint connecting two rigid groups.
 */
interface RigidGroupEdge {
  jointId: string;
  fromGroupId: RigidGroupId;
  toGroupId: RigidGroupId;
}

/**
 * Build edges between rigid groups from joints.
 */
function buildRigidGroupEdges(
  rigidGroups: RigidGroup[],
  joints: JointPair[]
): RigidGroupEdge[] {
  const nodeToGroup = new Map<string, RigidGroupId>();

  for (const group of rigidGroups) {
    for (const nodeId of group.nodeIds) {
      nodeToGroup.set(nodeId, group.id);
    }
  }

  const edges: RigidGroupEdge[] = [];

  for (const joint of joints) {
    const fromGroupId = nodeToGroup.get(joint.nodeAId);
    const toGroupId = nodeToGroup.get(joint.nodeBId);

    if (!fromGroupId || !toGroupId) {
      continue;
    }

    if (fromGroupId === toGroupId) {
      continue;
    }

    edges.push({
      jointId: `${joint.nodeAId}_${joint.nodeBId}`,
      fromGroupId,
      toGroupId,
    });
  }

  return edges;
}

/**
 * Build units from rigid group graph.
 * Strategy: Each moving group attached to the base becomes its own unit.
 */
function buildUnitsFromGraph(
  rigidGroups: RigidGroup[],
  globalBaseGroupId: RigidGroupId,
  edges: RigidGroupEdge[]
): DetectedUnit[] {
  const adjacency = buildAdjacency(edges);
  const groupMap = new Map<RigidGroupId, RigidGroup>();

  for (const group of rigidGroups) {
    groupMap.set(group.id, group);
  }

  const visited = new Set<RigidGroupId>();
  const baseComponent = findConnectedComponent(globalBaseGroupId, adjacency, visited);

  if (baseComponent.groupIds.length === 0) {
    return [];
  }

  const units: DetectedUnit[] = [];
  const componentGroups = baseComponent.groupIds
    .map(id => groupMap.get(id))
    .filter((g): g is RigidGroup => g !== undefined);

  const movingGroups = componentGroups.filter(g => !g.isStatic);

  for (const movingGroup of movingGroups) {
    const path = findShortestPath(globalBaseGroupId, movingGroup.id, adjacency);

    if (path.groupIds.length === 0) {
      continue;
    }

    units.push({
      id: `unit_${units.length}`,
      rigidGroupIds: path.groupIds,
      type: 'actuated',
      baseGroupId: globalBaseGroupId,
      movingGroupIds: [movingGroup.id],
      jointIds: path.jointIds,
    });
  }

  return units;
}

/**
 * Build adjacency map from edges.
 */
function buildAdjacency(
  edges: RigidGroupEdge[]
): Map<RigidGroupId, RigidGroupEdge[]> {
  const adjacency = new Map<RigidGroupId, RigidGroupEdge[]>();

  for (const edge of edges) {
    if (!adjacency.has(edge.fromGroupId)) {
      adjacency.set(edge.fromGroupId, []);
    }

    if (!adjacency.has(edge.toGroupId)) {
      adjacency.set(edge.toGroupId, []);
    }

    adjacency.get(edge.fromGroupId)!.push(edge);
    adjacency.get(edge.toGroupId)!.push(edge);
  }

  return adjacency;
}

/**
 * Component: connected set of rigid groups.
 */
interface Component {
  groupIds: RigidGroupId[];
  jointIds: string[];
}

/**
 * Find connected component starting from a group.
 */
function findConnectedComponent(
  startGroupId: RigidGroupId,
  adjacency: Map<RigidGroupId, RigidGroupEdge[]>,
  visited: Set<RigidGroupId>
): Component {
  const groupIds: RigidGroupId[] = [];
  const jointIds: string[] = [];
  const queue: RigidGroupId[] = [startGroupId];

  visited.add(startGroupId);
  groupIds.push(startGroupId);

  while (queue.length > 0) {
    const currentGroupId = queue.shift()!;
    const neighbors = adjacency.get(currentGroupId) || [];

    for (const edge of neighbors) {
      const neighborId = edge.fromGroupId === currentGroupId
        ? edge.toGroupId
        : edge.fromGroupId;

      if (visited.has(neighborId)) {
        continue;
      }

      visited.add(neighborId);
      groupIds.push(neighborId);
      jointIds.push(edge.jointId);
      queue.push(neighborId);
    }
  }

  return { groupIds, jointIds };
}

/**
 * Find shortest path between two groups in the adjacency graph.
 */
function findShortestPath(
  startGroupId: RigidGroupId,
  endGroupId: RigidGroupId,
  adjacency: Map<RigidGroupId, RigidGroupEdge[]>
): Component {
  if (startGroupId === endGroupId) {
    return { groupIds: [startGroupId], jointIds: [] };
  }

  const queue: Array<{ groupId: RigidGroupId; path: RigidGroupId[]; joints: string[] }> = [
    { groupId: startGroupId, path: [startGroupId], joints: [] },
  ];
  const visited = new Set<RigidGroupId>();
  visited.add(startGroupId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current.groupId) || [];

    for (const edge of neighbors) {
      const neighborId = edge.fromGroupId === current.groupId
        ? edge.toGroupId
        : edge.fromGroupId;

      if (visited.has(neighborId)) {
        continue;
      }

      visited.add(neighborId);

      const newPath = [...current.path, neighborId];
      const newJoints = [...current.joints, edge.jointId];

      if (neighborId === endGroupId) {
        return { groupIds: newPath, jointIds: newJoints };
      }

      queue.push({
        groupId: neighborId,
        path: newPath,
        joints: newJoints,
      });
    }
  }

  return { groupIds: [], jointIds: [] };
}
