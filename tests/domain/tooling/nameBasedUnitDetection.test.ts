/**
 * Tests for name-based tooling unit detection.
 */

import { describe, it, expect } from 'vitest';
import {
  selectToolingUnits,
  findToolRoot,
  type ToolingUnitCandidate,
  type UnitDetectionConfig,
} from '../../../src/domain/tooling/nameBasedUnitDetection';
import type {
  ToolingNode,
  ToolingStructure,
  ToolingNodeGeometry,
  Vector3,
} from '../../../src/domain/tooling/types';

// ==================== Test Fixtures ====================

/**
 * Helper to create a simple vector.
 */
function vec3(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
}

/**
 * Helper to create tooling node.
 */
function createNode(
  id: string,
  name: string,
  parentId: string | null,
  children: ToolingNode[] = []
): ToolingNode {
  return {
    id,
    name,
    parentId,
    children,
  };
}

/**
 * Helper to create geometry with point count.
 */
function createGeometry(nodeId: string, pointCount: number): ToolingNodeGeometry {
  // Generate dummy points
  const points: Vector3[] = [];
  for (let i = 0; i < pointCount; i++) {
    points.push(vec3(i * 0.01, 0, 0));
  }

  return {
    nodeId,
    points,
    bbox: {
      min: vec3(0, 0, 0),
      max: vec3(pointCount * 0.01, 1, 1),
    },
    centroid: vec3(pointCount * 0.005, 0.5, 0.5),
  };
}

/**
 * FORD 016ZF_20142452_110 fixture (simplified).
 * Structure:
 * - __root__ (100) :: 165,783 points
 *   - 016ZF_20142452_110 (101) :: 165,783 points
 *     - UNIT_101 (102) :: 49,054 points
 *       - RH (103) :: 49,054 points
 *         - FIXED (104) :: 25,000 points
 *         - MOVING (105) :: 20,000 points
 *         - FASTENER (106) :: 2,000 points
 *         - ORDER (107) :: 2,054 points
 *     - UNIT_102 (108) :: 12,104 points
 *       - LH (109) :: 12,104 points
 *         - FIXED (110) :: 6,000 points
 *         - MOVING (111) :: 5,000 points
 *         - FASTENER (112) :: 604 points
 *         - ORDER (113) :: 500 points
 *     - UNIT_106 (114) :: 38,921 points
 *       - RH (115) :: 38,921 points
 *         - FIXED (116) :: 20,000 points
 *         - MOVING (117) :: 15,000 points
 *         - WIRE (118) :: 2,921 points
 *         - ORDER (119) :: 1,000 points
 */
function createFordFixture(): { structure: ToolingStructure; geometryIndex: Map<string, ToolingNodeGeometry> } {
  // Build tree
  const fastener106 = createNode('106', 'FASTENER', '103', []);
  const order107 = createNode('107', 'ORDER', '103', []);
  const fixed104 = createNode('104', 'FIXED', '103', []);
  const moving105 = createNode('105', 'MOVING', '103', []);
  const rh103 = createNode('103', 'RH', '102', [fixed104, moving105, fastener106, order107]);

  const fastener112 = createNode('112', 'FASTENER', '109', []);
  const order113 = createNode('113', 'ORDER', '109', []);
  const fixed110 = createNode('110', 'FIXED', '109', []);
  const moving111 = createNode('111', 'MOVING', '109', []);
  const lh109 = createNode('109', 'LH', '108', [fixed110, moving111, fastener112, order113]);

  const wire118 = createNode('118', 'WIRE', '115', []);
  const order119 = createNode('119', 'ORDER', '115', []);
  const fixed116 = createNode('116', 'FIXED', '115', []);
  const moving117 = createNode('117', 'MOVING', '115', []);
  const rh115 = createNode('115', 'RH', '114', [fixed116, moving117, wire118, order119]);

  const unit101 = createNode('102', 'UNIT_101', '101', [rh103]);
  const unit102 = createNode('108', 'UNIT_102', '101', [lh109]);
  const unit106 = createNode('114', 'UNIT_106', '101', [rh115]);

  const toolRoot = createNode('101', '016ZF_20142452_110', '100', [unit101, unit102, unit106]);
  const root = createNode('100', '__root__', null, [toolRoot]);

  // Build node map
  const nodes = new Map<string, ToolingNode>();
  const allNodes = [
    root, toolRoot,
    unit101, rh103, fixed104, moving105, fastener106, order107,
    unit102, lh109, fixed110, moving111, fastener112, order113,
    unit106, rh115, fixed116, moving117, wire118, order119,
  ];
  for (const node of allNodes) {
    nodes.set(node.id, node);
  }

  const structure: ToolingStructure = { root, nodes };

  // Build geometry index
  const geometryIndex = new Map<string, ToolingNodeGeometry>();
  geometryIndex.set('100', createGeometry('100', 165783));
  geometryIndex.set('101', createGeometry('101', 165783));
  geometryIndex.set('102', createGeometry('102', 49054));
  geometryIndex.set('103', createGeometry('103', 49054));
  geometryIndex.set('104', createGeometry('104', 25000));
  geometryIndex.set('105', createGeometry('105', 20000));
  geometryIndex.set('106', createGeometry('106', 2000));
  geometryIndex.set('107', createGeometry('107', 2054));
  geometryIndex.set('108', createGeometry('108', 12104));
  geometryIndex.set('109', createGeometry('109', 12104));
  geometryIndex.set('110', createGeometry('110', 6000));
  geometryIndex.set('111', createGeometry('111', 5000));
  geometryIndex.set('112', createGeometry('112', 604));
  geometryIndex.set('113', createGeometry('113', 500));
  geometryIndex.set('114', createGeometry('114', 38921));
  geometryIndex.set('115', createGeometry('115', 38921));
  geometryIndex.set('116', createGeometry('116', 20000));
  geometryIndex.set('117', createGeometry('117', 15000));
  geometryIndex.set('118', createGeometry('118', 2921));
  geometryIndex.set('119', createGeometry('119', 1000));

  return { structure, geometryIndex };
}

/**
 * BMW 2174530000 fixture (simplified).
 * Structure:
 * - __root__ (200) :: 51,434 points
 *   - 2174530000_M00_GJR_RR_FLR_CM030_T01 (201) :: 51,434 points
 *     - 2174530020_M00_BASE UNIT_020 (202) :: 22,441 points
 *       - 2174530020_FIXED (203) :: 20,000 points
 *       - AUTOMATION (204) :: 2,441 points
 *     - 2174530040_M00_CLAMP UNIT_040 (205) :: 1,848 points
 *       - 2174530040_FIXED (206) :: 1,000 points
 *       - 2174530040_MOVING (207) :: 848 points
 *     - 2174530140_M00_PIN UNIT_140 (208) :: 702 points
 *       - 2174530140_FIXED (209) :: 702 points
 *     - 2174530180_M00_SUPPORT UNIT_180 (210) :: 675 points
 *       - 2174530180_FIXED (211) :: 675 points
 *     - 2174530200_M00_SUPPORT UNIT_200_SYM_180 (212) :: 675 points
 *       - 2174530200_FIXED (213) :: 675 points
 *     - 2174530240_M00_CLAMP UNIT_240 (214) :: 1,873 points
 *       - 2174530240_FIXED (215) :: 1,000 points
 *       - 2174530240_MOVING (216) :: 873 points
 *     - 2174530260_M00_CLAMP UNIT_260_SYM_240 (217) :: 1,873 points
 *       - 2174530260_FIXED (218) :: 1,000 points
 *       - 2174530260_MOVING (219) :: 873 points
 *     - 2174530320_M00_RETRACT PIN UNIT_320 (220) :: 3,786 points
 *       - 2174530320_FIXED (221) :: 2,000 points
 *       - 2174530320_MOVING (222) :: 1,786 points
 *     - 2174530340_M00_RETRACT PIN UNIT_340_SYM_320 (223) :: 3,786 points
 *       - 2174530340_FIXED (224) :: 2,000 points
 *       - 2174530340_MOVING (225) :: 1,786 points
 *     - 2174530CST_M00_CONSTRUCTION (226) :: 0 points
 */
function createBMWFixture(): { structure: ToolingStructure; geometryIndex: Map<string, ToolingNodeGeometry> } {
  // Build tree
  const base_fixed = createNode('203', '2174530020_FIXED', '202', []);
  const base_automation = createNode('204', 'AUTOMATION', '202', []);
  const base_unit = createNode('202', '2174530020_M00_BASE UNIT_020', '201', [base_fixed, base_automation]);

  const clamp40_fixed = createNode('206', '2174530040_FIXED', '205', []);
  const clamp40_moving = createNode('207', '2174530040_MOVING', '205', []);
  const clamp_unit_40 = createNode('205', '2174530040_M00_CLAMP UNIT_040', '201', [clamp40_fixed, clamp40_moving]);

  const pin140_fixed = createNode('209', '2174530140_FIXED', '208', []);
  const pin_unit_140 = createNode('208', '2174530140_M00_PIN UNIT_140', '201', [pin140_fixed]);

  const support180_fixed = createNode('211', '2174530180_FIXED', '210', []);
  const support_unit_180 = createNode('210', '2174530180_M00_SUPPORT UNIT_180', '201', [support180_fixed]);

  const support200_fixed = createNode('213', '2174530200_FIXED', '212', []);
  const support_unit_200 = createNode('212', '2174530200_M00_SUPPORT UNIT_200_SYM_180', '201', [support200_fixed]);

  const clamp240_fixed = createNode('215', '2174530240_FIXED', '214', []);
  const clamp240_moving = createNode('216', '2174530240_MOVING', '214', []);
  const clamp_unit_240 = createNode('214', '2174530240_M00_CLAMP UNIT_240', '201', [clamp240_fixed, clamp240_moving]);

  const clamp260_fixed = createNode('218', '2174530260_FIXED', '217', []);
  const clamp260_moving = createNode('219', '2174530260_MOVING', '217', []);
  const clamp_unit_260 = createNode('217', '2174530260_M00_CLAMP UNIT_260_SYM_240', '201', [clamp260_fixed, clamp260_moving]);

  const retract320_fixed = createNode('221', '2174530320_FIXED', '220', []);
  const retract320_moving = createNode('222', '2174530320_MOVING', '220', []);
  const retract_unit_320 = createNode('220', '2174530320_M00_RETRACT PIN UNIT_320', '201', [retract320_fixed, retract320_moving]);

  const retract340_fixed = createNode('224', '2174530340_FIXED', '223', []);
  const retract340_moving = createNode('225', '2174530340_MOVING', '223', []);
  const retract_unit_340 = createNode('223', '2174530340_M00_RETRACT PIN UNIT_340_SYM_320', '201', [retract340_fixed, retract340_moving]);

  const construction = createNode('226', '2174530CST_M00_CONSTRUCTION', '201', []);

  const toolRoot = createNode(
    '201',
    '2174530000_M00_GJR_RR_FLR_CM030_T01',
    '200',
    [
      base_unit,
      clamp_unit_40,
      pin_unit_140,
      support_unit_180,
      support_unit_200,
      clamp_unit_240,
      clamp_unit_260,
      retract_unit_320,
      retract_unit_340,
      construction,
    ]
  );

  const root = createNode('200', '__root__', null, [toolRoot]);

  // Build node map
  const nodes = new Map<string, ToolingNode>();
  const allNodes = [
    root, toolRoot,
    base_unit, base_fixed, base_automation,
    clamp_unit_40, clamp40_fixed, clamp40_moving,
    pin_unit_140, pin140_fixed,
    support_unit_180, support180_fixed,
    support_unit_200, support200_fixed,
    clamp_unit_240, clamp240_fixed, clamp240_moving,
    clamp_unit_260, clamp260_fixed, clamp260_moving,
    retract_unit_320, retract320_fixed, retract320_moving,
    retract_unit_340, retract340_fixed, retract340_moving,
    construction,
  ];
  for (const node of allNodes) {
    nodes.set(node.id, node);
  }

  const structure: ToolingStructure = { root, nodes };

  // Build geometry index
  const geometryIndex = new Map<string, ToolingNodeGeometry>();
  geometryIndex.set('200', createGeometry('200', 51434));
  geometryIndex.set('201', createGeometry('201', 51434));
  geometryIndex.set('202', createGeometry('202', 22441));
  geometryIndex.set('203', createGeometry('203', 20000));
  geometryIndex.set('204', createGeometry('204', 2441));
  geometryIndex.set('205', createGeometry('205', 1848));
  geometryIndex.set('206', createGeometry('206', 1000));
  geometryIndex.set('207', createGeometry('207', 848));
  geometryIndex.set('208', createGeometry('208', 702));
  geometryIndex.set('209', createGeometry('209', 702));
  geometryIndex.set('210', createGeometry('210', 675));
  geometryIndex.set('211', createGeometry('211', 675));
  geometryIndex.set('212', createGeometry('212', 675));
  geometryIndex.set('213', createGeometry('213', 675));
  geometryIndex.set('214', createGeometry('214', 1873));
  geometryIndex.set('215', createGeometry('215', 1000));
  geometryIndex.set('216', createGeometry('216', 873));
  geometryIndex.set('217', createGeometry('217', 1873));
  geometryIndex.set('218', createGeometry('218', 1000));
  geometryIndex.set('219', createGeometry('219', 873));
  geometryIndex.set('220', createGeometry('220', 3786));
  geometryIndex.set('221', createGeometry('221', 2000));
  geometryIndex.set('222', createGeometry('222', 1786));
  geometryIndex.set('223', createGeometry('223', 3786));
  geometryIndex.set('224', createGeometry('224', 2000));
  geometryIndex.set('225', createGeometry('225', 1786));
  geometryIndex.set('226', createGeometry('226', 0)); // Construction with 0 points

  return { structure, geometryIndex };
}

// ==================== Tests ====================

describe('findToolRoot', () => {
  it('should find single child as tool root', () => {
    const { structure, geometryIndex } = createFordFixture();
    const toolRoot = findToolRoot(structure.root!, geometryIndex);

    expect(toolRoot).toBeDefined();
    expect(toolRoot?.id).toBe('101');
    expect(toolRoot?.name).toBe('016ZF_20142452_110');
  });

  it('should find child with project number pattern', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const toolRoot = findToolRoot(structure.root!, geometryIndex);

    expect(toolRoot).toBeDefined();
    expect(toolRoot?.id).toBe('201');
    expect(toolRoot?.name).toContain('2174530000');
  });

  it('should return null for null root', () => {
    const geometryIndex = new Map<string, ToolingNodeGeometry>();
    const toolRoot = findToolRoot(null as any, geometryIndex);

    expect(toolRoot).toBeNull();
  });
});

describe('selectToolingUnits - FORD fixture', () => {
  it('should detect UNIT_101, UNIT_102, UNIT_106 as clamp units', () => {
    const { structure, geometryIndex } = createFordFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    expect(units.length).toBe(3);

    const unit101 = units.find(u => u.displayName.includes('UNIT_101'));
    expect(unit101).toBeDefined();
    expect(unit101?.kind).toBe('clamp');
    expect(unit101?.side).toBe('RH');
    expect(unit101?.points).toBe(49054);

    const unit102 = units.find(u => u.displayName.includes('UNIT_102'));
    expect(unit102).toBeDefined();
    expect(unit102?.kind).toBe('clamp');
    expect(unit102?.side).toBe('LH');
    expect(unit102?.points).toBe(12104);

    const unit106 = units.find(u => u.displayName.includes('UNIT_106'));
    expect(unit106).toBeDefined();
    expect(unit106?.kind).toBe('clamp');
    expect(unit106?.side).toBe('RH');
    expect(unit106?.points).toBe(38921);
  });

  it('should include side information in display names', () => {
    const { structure, geometryIndex } = createFordFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const rhUnits = units.filter(u => u.side === 'RH');
    expect(rhUnits.length).toBe(2);

    const lhUnits = units.filter(u => u.side === 'LH');
    expect(lhUnits.length).toBe(1);
  });

  it('should not include small fastener/order nodes as separate units', () => {
    const { structure, geometryIndex } = createFordFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const fastenerUnits = units.filter(u => u.displayName.includes('FASTENER'));
    expect(fastenerUnits.length).toBe(0);

    const orderUnits = units.filter(u => u.displayName.includes('ORDER'));
    expect(orderUnits.length).toBe(0);
  });
});

describe('selectToolingUnits - BMW fixture', () => {
  it('should detect one BASE UNIT', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const baseUnits = units.filter(u => u.kind === 'base');
    expect(baseUnits.length).toBe(1);

    const baseUnit = baseUnits[0];
    expect(baseUnit.displayName).toContain('BASE UNIT');
    expect(baseUnit.points).toBe(22441);
  });

  it('should detect all CLAMP UNITs', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const clampUnits = units.filter(u => u.kind === 'clamp');
    expect(clampUnits.length).toBeGreaterThanOrEqual(3);

    const clamp40 = clampUnits.find(u => u.displayName.includes('040'));
    expect(clamp40).toBeDefined();
    expect(clamp40?.points).toBe(1848);

    const clamp240 = clampUnits.find(u => u.displayName.includes('240'));
    expect(clamp240).toBeDefined();
    expect(clamp240?.points).toBe(1873);
  });

  it('should detect PIN UNITs', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const pinUnits = units.filter(u => u.kind === 'pin');
    expect(pinUnits.length).toBeGreaterThanOrEqual(1);

    const pin140 = pinUnits.find(u => u.displayName.includes('140'));
    expect(pin140).toBeDefined();
    expect(pin140?.points).toBe(702);
  });

  it('should detect SUPPORT UNITs', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const supportUnits = units.filter(u => u.kind === 'support');
    expect(supportUnits.length).toBeGreaterThanOrEqual(2);

    const support180 = supportUnits.find(u => u.displayName.includes('180'));
    expect(support180).toBeDefined();
    expect(support180?.points).toBe(675);

    const support200 = supportUnits.find(u => u.displayName.includes('200'));
    expect(support200).toBeDefined();
    expect(support200?.isSymmetric).toBe(true);
  });

  it('should detect RETRACT PIN UNITs', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const retractPinUnits = units.filter(u => u.kind === 'retractPin');
    expect(retractPinUnits.length).toBeGreaterThanOrEqual(2);

    const retract320 = retractPinUnits.find(u => u.displayName.includes('320'));
    expect(retract320).toBeDefined();
    expect(retract320?.points).toBe(3786);

    const retract340 = retractPinUnits.find(u => u.displayName.includes('340'));
    expect(retract340).toBeDefined();
    expect(retract340?.isSymmetric).toBe(true);
  });

  it('should NOT select CONSTRUCTION node (0 points)', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const constructionUnits = units.filter(u => u.displayName.includes('CONSTRUCTION'));
    expect(constructionUnits.length).toBe(0);
  });

  it('should mark symmetric units correctly', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const symmetricUnits = units.filter(u => u.isSymmetric);
    expect(symmetricUnits.length).toBeGreaterThanOrEqual(4); // 200, 260, 340, etc.

    const sym200 = symmetricUnits.find(u => u.displayName.includes('200'));
    expect(sym200?.displayName).toContain('SYM');

    const sym260 = symmetricUnits.find(u => u.displayName.includes('260'));
    expect(sym260?.displayName).toContain('SYM');
  });

  it('should keep BASE UNIT automation as part of base unit', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    // AUTOMATION should NOT be a separate unit
    const automationUnits = units.filter(u => u.displayName.includes('AUTOMATION'));
    expect(automationUnits.length).toBe(0);

    // It should be included in base unit's subtree
    const baseUnit = units.find(u => u.kind === 'base');
    expect(baseUnit).toBeDefined();
  });
});

describe('selectToolingUnits - configuration', () => {
  it('should respect minPointsRatio threshold', () => {
    const { structure, geometryIndex } = createFordFixture();

    // Increase minPointsRatio to exclude smaller units
    const config: UnitDetectionConfig = {
      minPointsRatio: 0.2, // 20% of tool root
    };

    const units = selectToolingUnits(structure, geometryIndex, config);

    // Only UNIT_101 (49,054 / 165,783 ≈ 30%) should pass
    expect(units.length).toBeLessThan(3);

    const unit101 = units.find(u => u.displayName.includes('UNIT_101'));
    expect(unit101).toBeDefined();
  });

  it('should allow misc units when configured', () => {
    const { structure, geometryIndex } = createFordFixture();

    const config: UnitDetectionConfig = {
      allowMiscUnits: true,
      minScoreForUnit: 0, // Very low threshold
    };

    const units = selectToolingUnits(structure, geometryIndex, config);

    // Should detect more units (possibly including misc ones)
    expect(units.length).toBeGreaterThanOrEqual(3);
  });
});

describe('non-overlapping selection', () => {
  it('should not select ancestor and descendant together', () => {
    const { structure, geometryIndex } = createFordFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    // Check that no unit is an ancestor/descendant of another
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const unitA = units[i];
        const unitB = units[j];

        // Path check: if one path is prefix of another, they overlap
        const pathAStr = unitA.pathNames.join('/');
        const pathBStr = unitB.pathNames.join('/');

        expect(pathAStr.startsWith(pathBStr)).toBe(false);
        expect(pathBStr.startsWith(pathAStr)).toBe(false);
      }
    }
  });

  it('should prioritize base units first', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    // Base unit should be selected even if other units have higher points
    const baseUnit = units.find(u => u.kind === 'base');
    expect(baseUnit).toBeDefined();
  });

  it('should select only one base unit', () => {
    const { structure, geometryIndex } = createBMWFixture();
    const units = selectToolingUnits(structure, geometryIndex);

    const baseUnits = units.filter(u => u.kind === 'base');
    expect(baseUnits.length).toBe(1);
  });
});

describe('edge cases', () => {
  it('should return empty array for null root', () => {
    const structure: ToolingStructure = {
      root: null,
      nodes: new Map(),
    };
    const geometryIndex = new Map<string, ToolingNodeGeometry>();

    const units = selectToolingUnits(structure, geometryIndex);
    expect(units.length).toBe(0);
  });

  it('should return empty array for root with no geometry', () => {
    const root = createNode('1', 'root', null, []);
    const structure: ToolingStructure = {
      root,
      nodes: new Map([['1', root]]),
    };
    const geometryIndex = new Map<string, ToolingNodeGeometry>();

    const units = selectToolingUnits(structure, geometryIndex);
    expect(units.length).toBe(0);
  });

  it('should handle nodes with missing names gracefully', () => {
    const child = createNode('2', '', '1', []);
    child.name = undefined;

    const root = createNode('1', 'root', null, [child]);
    const structure: ToolingStructure = {
      root,
      nodes: new Map([
        ['1', root],
        ['2', child],
      ]),
    };

    const geometryIndex = new Map<string, ToolingNodeGeometry>();
    geometryIndex.set('1', createGeometry('1', 10000));
    geometryIndex.set('2', createGeometry('2', 5000));

    const units = selectToolingUnits(structure, geometryIndex);

    // Should not crash, may find 0 or more units depending on scoring
    expect(Array.isArray(units)).toBe(true);
  });
});
