import { describe, it, expect } from 'vitest';
import {
    collectSubtree,
    findUnitCandidates,
    selectUnits,
    pairUnits,
    getNodePairsForUnit,
    Scene,
    FlatNode,
    UnitPair,
    NodePair
} from '../StatisticalPairingEngine';
import { createMockFixture, createMockUnit112 } from '../fixtures/mockFixtureData';

describe('Statistical Pairing Engine', () => {

    describe('Fixture-level: Unit detection + pairing', () => {
        const { openScene, closedScene } = createMockFixture();

        it('should flatten subtree correctly', () => {
            const flat = collectSubtree(openScene, openScene.rootId);
            // Root + 3 units = 4 nodes
            expect(flat.length).toBe(4);
            expect(flat[0].id).toBe('FIXTURE_OPEN_ROOT');
            expect(flat[0].totalPoints).toBe(120000);
        });

        it('should find unit candidates', () => {
            const flat = collectSubtree(openScene, openScene.rootId);
            const fixtureTotal = 120000;
            const candidates = findUnitCandidates(flat, fixtureTotal);

            // Should find the 3 units (40k each is ~33%)
            // Root is 100% (excluded by MAX_RATIO 0.60)
            expect(candidates.length).toBe(3);
            const ids = candidates.map(c => c.id).sort();
            expect(ids).toEqual(['UNIT_101_OPEN', 'UNIT_112_LH_OPEN', 'UNIT_113_RH_OPEN']);
        });

        it('should select disjoint units', () => {
            const flat = collectSubtree(openScene, openScene.rootId);
            const fixtureTotal = 120000;
            const candidates = findUnitCandidates(flat, fixtureTotal);
            const selected = selectUnits(candidates, openScene, fixtureTotal);

            expect(selected.length).toBe(3);
            const ids = selected.sort();
            expect(ids).toEqual(['UNIT_101_OPEN', 'UNIT_112_LH_OPEN', 'UNIT_113_RH_OPEN']);
        });

        it('should pair units between open and closed', () => {
            const openFlat = collectSubtree(openScene, openScene.rootId);
            const closedFlat = collectSubtree(closedScene, closedScene.rootId);
            const fixtureTotal = 120000;

            const openCandidates = findUnitCandidates(openFlat, fixtureTotal);
            const closedCandidates = findUnitCandidates(closedFlat, fixtureTotal);

            const openUnits = selectUnits(openCandidates, openScene, fixtureTotal);
            const closedUnits = selectUnits(closedCandidates, closedScene, fixtureTotal);

            const pairs = pairUnits(openScene, closedScene, openUnits, closedUnits);

            expect(pairs.length).toBe(3);

            // Verify pairings
            const pairMap = new Map<string, string>();
            pairs.forEach(p => pairMap.set(p.openUnitId, p.closedUnitId));

            expect(pairMap.get('UNIT_101_OPEN')).toBe('UNIT_101_CLOSED');
            expect(pairMap.get('UNIT_112_LH_OPEN')).toBe('UNIT_112_LH_CLOSED');
            expect(pairMap.get('UNIT_113_RH_OPEN')).toBe('UNIT_113_RH_CLOSED');
        });
    });

    describe('Unit-level: Node pairing (UNIT_112)', () => {
        const { openScene, closedScene } = createMockUnit112();
        const unitPair: UnitPair = {
            openUnitId: 'UNIT_112_LH_OPEN',
            closedUnitId: 'UNIT_112_LH_CLOSED'
        };

        it('should pair nodes correctly based on point counts', () => {
            const pairs = getNodePairsForUnit(openScene, closedScene, unitPair);

            const pairMap = new Map<string, string>();
            pairs.forEach(p => pairMap.set(p.openNodeId, p.closedNodeId));

            // Expected pairings
            expect(pairMap.get('UNIT_112_LH_OPEN')).toBe('UNIT_112_LH_CLOSED'); // 40000
            expect(pairMap.get('U112_BASE_OPEN')).toBe('U112_BASE_CLOSED'); // 24000
            expect(pairMap.get('U112_MOVING_ROOT_OPEN')).toBe('U112_LH_GROUP_CLOSED'); // 14000
            expect(pairMap.get('U112_ARM_OPEN')).toBe('U112_ARM_CLOSED'); // 8002 vs 8014
            expect(pairMap.get('U112_CYL_BODY_OPEN')).toBe('U112_CYL_BODY_CLOSED'); // 3000 vs 2990
            expect(pairMap.get('U112_CLEVIS_OPEN')).toBe('U112_CLEVIS_CLOSED'); // 2998 vs 2996
            expect(pairMap.get('U112_JUNK_OPEN')).toBe('U112_WIRE_JUNK_CLOSED'); // 2000

            // Ensure no unexpected pairings
            expect(pairs.length).toBe(7);
        });
    });
});
