/**
 * Test level statistics computation from debug tree rows.
 */

import { describe, it, expect } from 'vitest';
import type { DebugTreeRow } from '../../../src/domain/tooling/debugTree';
import { computeLevelStats, computeParentCoverageStats } from '../../../src/domain/tooling/levelStats';

describe('Level Statistics', () => {
  it('should compute level statistics correctly', () => {
    const rows: DebugTreeRow[] = [
      { nodeId: '1', nodeName: 'root', parentId: null, depth: 0, pointCount: 10000 },
      { nodeId: '2', nodeName: 'unit_a', parentId: '1', depth: 1, pointCount: 5000 },
      { nodeId: '3', nodeName: 'unit_b', parentId: '1', depth: 1, pointCount: 4500 },
      { nodeId: '4', nodeName: 'part_a1', parentId: '2', depth: 2, pointCount: 2500 },
      { nodeId: '5', nodeName: 'part_a2', parentId: '2', depth: 2, pointCount: 2400 },
      { nodeId: '6', nodeName: 'part_b1', parentId: '3', depth: 2, pointCount: 2200 },
    ];

    const stats = computeLevelStats(rows);

    expect(stats).toHaveLength(3);

    // Level 0
    expect(stats[0].depth).toBe(0);
    expect(stats[0].nodeCount).toBe(1);
    expect(stats[0].totalPoints).toBe(10000);
    expect(stats[0].minPoints).toBe(10000);
    expect(stats[0].maxPoints).toBe(10000);
    expect(stats[0].medianPoints).toBe(10000);

    // Level 1
    expect(stats[1].depth).toBe(1);
    expect(stats[1].nodeCount).toBe(2);
    expect(stats[1].totalPoints).toBe(9500);
    expect(stats[1].minPoints).toBe(4500);
    expect(stats[1].maxPoints).toBe(5000);
    expect(stats[1].medianPoints).toBe(4750); // (4500 + 5000) / 2

    // Level 2
    expect(stats[2].depth).toBe(2);
    expect(stats[2].nodeCount).toBe(3);
    expect(stats[2].totalPoints).toBe(7100);
    expect(stats[2].minPoints).toBe(2200);
    expect(stats[2].maxPoints).toBe(2500);
    expect(stats[2].medianPoints).toBe(2400);
  });

  it('should compute parent coverage statistics correctly', () => {
    const rows: DebugTreeRow[] = [
      { nodeId: '1', nodeName: 'root', parentId: null, depth: 0, pointCount: 10000 },
      { nodeId: '2', nodeName: 'unit_a', parentId: '1', depth: 1, pointCount: 5000 },
      { nodeId: '3', nodeName: 'unit_b', parentId: '1', depth: 1, pointCount: 4500 },
      { nodeId: '4', nodeName: 'part_a1', parentId: '2', depth: 2, pointCount: 2500 },
      { nodeId: '5', nodeName: 'part_a2', parentId: '2', depth: 2, pointCount: 2400 },
      { nodeId: '6', nodeName: 'part_b1', parentId: '3', depth: 2, pointCount: 2200 },
    ];

    const stats = computeParentCoverageStats(rows);

    expect(stats).toHaveLength(3); // root, unit_a, unit_b

    // Root node coverage
    const rootCoverage = stats.find(s => s.parentId === '1');
    expect(rootCoverage).toBeDefined();
    expect(rootCoverage!.parentName).toBe('root');
    expect(rootCoverage!.parentPoints).toBe(10000);
    expect(rootCoverage!.childCount).toBe(2);
    expect(rootCoverage!.childTotalPoints).toBe(9500);
    expect(rootCoverage!.coverageRatio).toBeCloseTo(0.95, 2);
    expect(rootCoverage!.childMinPoints).toBe(4500);
    expect(rootCoverage!.childMaxPoints).toBe(5000);

    // Unit A coverage
    const unitACoverage = stats.find(s => s.parentId === '2');
    expect(unitACoverage).toBeDefined();
    expect(unitACoverage!.parentName).toBe('unit_a');
    expect(unitACoverage!.parentPoints).toBe(5000);
    expect(unitACoverage!.childCount).toBe(2);
    expect(unitACoverage!.childTotalPoints).toBe(4900);
    expect(unitACoverage!.coverageRatio).toBeCloseTo(0.98, 2);

    // Unit B coverage
    const unitBCoverage = stats.find(s => s.parentId === '3');
    expect(unitBCoverage).toBeDefined();
    expect(unitBCoverage!.parentName).toBe('unit_b');
    expect(unitBCoverage!.parentPoints).toBe(4500);
    expect(unitBCoverage!.childCount).toBe(1);
    expect(unitBCoverage!.childTotalPoints).toBe(2200);
    expect(unitBCoverage!.coverageRatio).toBeCloseTo(0.49, 2);
  });

  it('should handle empty rows', () => {
    const levelStats = computeLevelStats([]);
    expect(levelStats).toEqual([]);

    const coverageStats = computeParentCoverageStats([]);
    expect(coverageStats).toEqual([]);
  });

  it('should handle single node', () => {
    const rows: DebugTreeRow[] = [
      { nodeId: '1', nodeName: 'root', parentId: null, depth: 0, pointCount: 1000 },
    ];

    const levelStats = computeLevelStats(rows);
    expect(levelStats).toHaveLength(1);
    expect(levelStats[0].nodeCount).toBe(1);
    expect(levelStats[0].totalPoints).toBe(1000);

    const coverageStats = computeParentCoverageStats(rows);
    expect(coverageStats).toHaveLength(0); // No children
  });
});
