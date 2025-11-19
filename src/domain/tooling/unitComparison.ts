/**
 * Unit comparison logic for state-based vs structure-based unit detection.
 *
 * Compares units detected via kinematic state analysis with those detected
 * via structural/point-cloud analysis.
 */

import type { StateBasedUnitDetectionResult, RigidGroup } from './stateBasedUnitDetection';
import type { ScoredUnitCandidate } from './levelStats';
import { selectNonOverlappingUnits } from './levelStats';
import type { ToolingStructure } from './types';

/**
 * Summary of a unit detected via kinematic state analysis.
 */
export interface StateBasedUnitSummary {
  unitId: string;
  baseGroupId: string;
  movingGroupIds: string[];
  // Flattened list of all node IDs belonging to the moving groups
  movingGroupNodeIds: string[];
}

/**
 * Summary of a unit candidate detected via structural/point-cloud analysis.
 */
export interface StructureUnitSummary {
  nodeId: string;
  score: number;
  coverageRatio: number;
  depth: number;
}

/**
 * Result of comparing the two detection methods.
 */
export interface UnitComparisonResult {
  matches: Array<{
    stateUnit: StateBasedUnitSummary;
    structureUnit: StructureUnitSummary;
    matchReason: 'moving_group_contains_node' | 'base_group_match';
  }>;
  stateOnly: StateBasedUnitSummary[];
  structureOnly: StructureUnitSummary[];
}

/**
 * Convert state-based result to summaries.
 */
export function toStateBasedSummaries(result: StateBasedUnitDetectionResult): StateBasedUnitSummary[] {
  // Guard: no units
  if (result.units.length === 0) {
    return [];
  }

  const groupMap = new Map<string, RigidGroup>();
  for (const group of result.rigidGroups) {
    groupMap.set(group.id, group);
  }

  // Filter only actuated units
  const actuatedUnits = result.units.filter(u => u.type === 'actuated');
  const summaries: StateBasedUnitSummary[] = [];

  for (const unit of actuatedUnits) {
    const nodeIds: string[] = [];

    // Collect all node IDs from all moving groups in this unit
    for (const groupId of unit.movingGroupIds) {
      const group = groupMap.get(groupId);
      if (group) {
        // We push all nodes; in a real scenario we might optimize for 'largest' node
        // but flattening is safest for 'contains' checks.
        for (const nodeId of group.nodeIds) {
          nodeIds.push(nodeId);
        }
      }
    }

    summaries.push({
      unitId: unit.id,
      baseGroupId: unit.baseGroupId || '',
      movingGroupIds: [...unit.movingGroupIds],
      movingGroupNodeIds: nodeIds,
    });
  }

  return summaries;
}

/**
 * Convert structure-based candidates to summaries.
 * Applies non-overlapping selection first.
 */
export function toStructureSummaries(
  candidates: ScoredUnitCandidate[],
  structure: ToolingStructure
): StructureUnitSummary[] {
  if (candidates.length === 0) {
    return [];
  }

  const selected = selectNonOverlappingUnits(candidates, structure);
  const summaries: StructureUnitSummary[] = [];

  for (const cand of selected) {
    summaries.push({
      nodeId: cand.nodeId,
      score: cand.score,
      coverageRatio: cand.coverageRatio,
      depth: cand.depth,
    });
  }

  return summaries;
}

/**
 * Compare state-based units against structure-based candidates.
 */
export function compareUnits(
  stateUnits: StateBasedUnitSummary[],
  structureUnits: StructureUnitSummary[]
): UnitComparisonResult {
  const stateOnly = new Set(stateUnits);
  const structureOnly: StructureUnitSummary[] = [];
  const matches: UnitComparisonResult['matches'] = [];

  // Sort structure units by score descending (greedy matching)
  const sortedStructure = [...structureUnits].sort((a, b) => b.score - a.score);

  for (const structUnit of sortedStructure) {
    let matchedState: StateBasedUnitSummary | undefined;
    let matchReason: 'moving_group_contains_node' | 'base_group_match' | undefined;

    // Find best matching state unit that hasn't been matched yet
    for (const stateUnit of stateOnly) {
      // Check 1: Structure node is inside the moving group nodes
      if (stateUnit.movingGroupNodeIds.includes(structUnit.nodeId)) {
        matchedState = stateUnit;
        matchReason = 'moving_group_contains_node';
        break;
      }

      // Check 2: Structure node is explicitly the base group ID (rare, but per spec)
      // Note: This usually implies the base group ID is named after a node ID
      if (stateUnit.baseGroupId === structUnit.nodeId) {
        matchedState = stateUnit;
        matchReason = 'base_group_match';
        break;
      }
    }

    if (matchedState && matchReason) {
      matches.push({
        stateUnit: matchedState,
        structureUnit: structUnit,
        matchReason,
      });
      stateOnly.delete(matchedState);
    } else {
      structureOnly.push(structUnit);
    }
  }

  return {
    matches,
    stateOnly: Array.from(stateOnly),
    structureOnly,
  };
}
