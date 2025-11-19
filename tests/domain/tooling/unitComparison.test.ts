/**
 * Tests for unit comparison logic.
 */

import { describe, it, expect } from 'vitest';
import { compareUnits, type StateBasedUnitSummary, type StructureUnitSummary } from '../../../src/domain/tooling/unitComparison';

describe('Unit Comparison Logic', () => {

  it('should match when structure node is inside state moving group nodes', () => {
    const stateUnit: StateBasedUnitSummary = {
      unitId: 'state_u1',
      baseGroupId: 'group_base',
      movingGroupIds: ['group_mov_1'],
      movingGroupNodeIds: ['node_A', 'node_B', 'node_child']
    };

    const structureUnit: StructureUnitSummary = {
      nodeId: 'node_A', // Matches one of the moving nodes
      score: 10,
      coverageRatio: 0.5,
      depth: 2
    };

    const result = compareUnits([stateUnit], [structureUnit]);

    expect(result.matches.length).toBe(1);
    expect(result.matches[0].stateUnit.unitId).toBe('state_u1');
    expect(result.matches[0].structureUnit.nodeId).toBe('node_A');
    expect(result.stateOnly.length).toBe(0);
    expect(result.structureOnly.length).toBe(0);
  });

  it('should report stateOnly when no structure candidate matches', () => {
    const stateUnit: StateBasedUnitSummary = {
      unitId: 'state_u1',
      baseGroupId: 'group_base',
      movingGroupIds: ['group_mov_1'],
      movingGroupNodeIds: ['node_X']
    };

    const structureUnit: StructureUnitSummary = {
      nodeId: 'node_Y', // No overlap
      score: 10,
      coverageRatio: 0.5,
      depth: 2
    };

    const result = compareUnits([stateUnit], [structureUnit]);

    expect(result.matches.length).toBe(0);
    expect(result.stateOnly.length).toBe(1);
    expect(result.stateOnly[0].unitId).toBe('state_u1');
    expect(result.structureOnly.length).toBe(1);
    expect(result.structureOnly[0].nodeId).toBe('node_Y');
  });

  it('should handle greedy matching (highest score structure wins)', () => {
    const stateUnit: StateBasedUnitSummary = {
      unitId: 'state_u1',
      baseGroupId: 'group_base',
      movingGroupIds: ['group_mov_1'],
      movingGroupNodeIds: ['node_Common']
    };

    // Two structure units claiming the same node (unlikely with selectNonOverlapping but possible in raw input logic)
    // Or distinct structure nodes both present in the same state unit (state unit is bigger)
    const struct1: StructureUnitSummary = { nodeId: 'node_Common', score: 20, coverageRatio: 0.1, depth: 2 };
    const struct2: StructureUnitSummary = { nodeId: 'node_Common', score: 10, coverageRatio: 0.1, depth: 2 };

    // Actually compareUnits logic consumes the state unit once matched.
    // If struct1 matches, stateUnit is removed from available set. struct2 then fails to match.

    const result = compareUnits([stateUnit], [struct1, struct2]);

    expect(result.matches.length).toBe(1);
    expect(result.matches[0].structureUnit).toBe(struct1); // Higher score won
    expect(result.structureOnly.length).toBe(1);
    expect(result.structureOnly[0]).toBe(struct2);
  });

  it('should match multiple pairs correctly', () => {
    const s1: StateBasedUnitSummary = { unitId: 's1', baseGroupId: 'b', movingGroupIds: ['m1'], movingGroupNodeIds: ['n1'] };
    const s2: StateBasedUnitSummary = { unitId: 's2', baseGroupId: 'b', movingGroupIds: ['m2'], movingGroupNodeIds: ['n2'] };

    const c1: StructureUnitSummary = { nodeId: 'n1', score: 10, coverageRatio: 0.1, depth: 1 };
    const c2: StructureUnitSummary = { nodeId: 'n2', score: 10, coverageRatio: 0.1, depth: 1 };

    const result = compareUnits([s1, s2], [c1, c2]);

    expect(result.matches.length).toBe(2);
    expect(result.stateOnly.length).toBe(0);
    expect(result.structureOnly.length).toBe(0);
  });
});
