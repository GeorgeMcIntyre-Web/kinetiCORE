/**
 * Statistical Pairing Module
 * 
 * A pure TypeScript module for preparing node pairs for ACP using only tree structure + point counts.
 * 
 * Key invariants:
 * - No reliance on names.
 * - Tree structure agnostic.
 * - Driven purely by statistics.
 */

export type SceneNode = {
    id: string;
    parentId?: string;
    children: string[];
    totalPointCount: number;
    depth: number;
};

export type Scene = {
    nodes: Map<string, SceneNode>;
    rootId: string;
};

export type FlatNode = {
    id: string;
    totalPoints: number;
    depth: number;
};

export type UnitPair = {
    openUnitId: string;
    closedUnitId: string;
};

export type NodePair = {
    openNodeId: string;
    closedNodeId: string;
};

// --- 3. Fixture-level: Unit detection + pairing ---

// 3.1 Flatten subtree
export function collectSubtree(scene: Scene, rootId: string): FlatNode[] {
    const result: FlatNode[] = [];

    const visit = (id: string, depth: number) => {
        const node = scene.nodes.get(id);
        if (node === undefined) return;

        result.push({ id, totalPoints: node.totalPointCount, depth });

        if (node.children.length === 0) return;

        for (const childId of node.children) {
            visit(childId, depth + 1);
        }
    };

    visit(rootId, 0);
    return result;
}

// 3.2 Find Unit candidates by point-mass bands
const UNIT_MIN_RATIO = 0.02;
const UNIT_MAX_RATIO = 0.60;

export function findUnitCandidates(flat: FlatNode[], fixtureTotal: number): FlatNode[] {
    return flat.filter(node => {
        const ratio = node.totalPoints / fixtureTotal;
        if (ratio < UNIT_MIN_RATIO) return false;
        if (ratio > UNIT_MAX_RATIO) return false;
        return true;
    });
}

// 3.3 Select final Units (disjoint cover)
export function selectUnits(
    candidates: FlatNode[],
    scene: Scene,
    fixtureTotal: number
): string[] {
    const sorted = [...candidates].sort((a, b) => {
        if (a.totalPoints > b.totalPoints) return -1;
        if (a.totalPoints < b.totalPoints) return 1;
        if (a.depth < b.depth) return -1;
        if (a.depth > b.depth) return 1;
        return 0;
    });

    const units: string[] = [];
    const blocked = new Set<string>();

    const blockSubtree = (id: string) => {
        if (blocked.has(id)) return;

        blocked.add(id);
        const node = scene.nodes.get(id);
        if (node === undefined) return;

        if (node.children.length === 0) return;

        for (const childId of node.children) {
            blockSubtree(childId);
        }
    };

    for (const cand of sorted) {
        if (blocked.has(cand.id)) continue;

        units.push(cand.id);
        blockSubtree(cand.id);
    }

    // Optional: Check ratio sum here if needed, but per prompt we just return units.
    return units;
}

// 3.4 Pair Units between open and closed
const UNIT_ABS_TOL = 50;
const UNIT_REL_TOL = 0.0012;

type UnitSig = { id: string; points: number };

export function pairUnits(
    openScene: Scene,
    closedScene: Scene,
    openUnitIds: string[],
    closedUnitIds: string[]
): UnitPair[] {
    const open: UnitSig[] = openUnitIds.map(id => {
        const node = openScene.nodes.get(id);
        const points = node?.totalPointCount ?? 0;
        return { id, points };
    });

    const closed: UnitSig[] = closedUnitIds.map(id => {
        const node = closedScene.nodes.get(id);
        const points = node?.totalPointCount ?? 0;
        return { id, points };
    });

    open.sort((a, b) => a.points - b.points);
    closed.sort((a, b) => a.points - b.points);

    const pairs: UnitPair[] = [];
    let i = 0;
    let j = 0;

    while (i < open.length && j < closed.length) {
        const a = open[i];
        const b = closed[j];

        const diff = Math.abs(a.points - b.points);
        const maxPoints = Math.max(a.points, b.points);
        const rel = maxPoints === 0 ? 0 : diff / maxPoints;

        const match = diff <= UNIT_ABS_TOL || rel <= UNIT_REL_TOL;

        if (match) {
            pairs.push({ openUnitId: a.id, closedUnitId: b.id });
            i += 1;
            j += 1;
            continue;
        }

        if (a.points < b.points) {
            i += 1;
            continue;
        }

        j += 1;
    }

    return pairs;
}

// --- 4. Unit-level: Node pairing by point counts ---

// 4.1 Collect nodes inside a Unit
export function collectUnitNodes(scene: Scene, unitId: string): FlatNode[] {
    return collectSubtree(scene, unitId);
}

// 4.2 Filter debris
const NODE_MIN_RATIO = 0.002;

export function filterUnitDebris(
    nodes: FlatNode[],
    unitTotalPoints: number
): FlatNode[] {
    if (unitTotalPoints === 0) return [];

    return nodes.filter(node => {
        const ratio = node.totalPoints / unitTotalPoints;
        if (ratio < NODE_MIN_RATIO) return false;
        return true;
    });
}

// 4.3 Sort by significance
export function sortBySignificance(nodes: FlatNode[]): FlatNode[] {
    const copy = [...nodes];

    copy.sort((a, b) => {
        if (a.totalPoints > b.totalPoints) return -1;
        if (a.totalPoints < b.totalPoints) return 1;
        if (a.depth < b.depth) return -1;
        if (a.depth > b.depth) return 1;
        return 0;
    });

    return copy;
}

// 4.4 Greedy node pairing
const NODE_ABS_TOL = 50;
const NODE_REL_TOL = 0.0012;

export function pairNodesByPoints(
    openNodes: FlatNode[],
    closedNodes: FlatNode[]
): NodePair[] {
    const pairs: NodePair[] = [];
    const usedOpen = new Set<string>();
    const usedClosed = new Set<string>();

    for (const openNode of openNodes) {
        if (usedOpen.has(openNode.id)) continue;

        let bestClosed: FlatNode | undefined;
        let bestDiff = Number.POSITIVE_INFINITY;

        for (const closedNode of closedNodes) {
            if (usedClosed.has(closedNode.id)) continue;

            const diff = Math.abs(openNode.totalPoints - closedNode.totalPoints);
            const maxPoints = Math.max(openNode.totalPoints, closedNode.totalPoints);
            const rel = maxPoints === 0 ? 0 : diff / maxPoints;

            const match = diff <= NODE_ABS_TOL || rel <= NODE_REL_TOL;
            if (!match) continue;

            if (diff >= bestDiff) continue;

            bestDiff = diff;
            bestClosed = closedNode;
        }

        if (bestClosed === undefined) continue;

        pairs.push({ openNodeId: openNode.id, closedNodeId: bestClosed.id });
        usedOpen.add(openNode.id);
        usedClosed.add(bestClosed.id);
    }

    return pairs;
}

// 4.5 Convenience function: analyze one Unit pair
export function getNodePairsForUnit(
    openScene: Scene,
    closedScene: Scene,
    unitPair: UnitPair
): NodePair[] {
    const openUnitNode = openScene.nodes.get(unitPair.openUnitId);
    const closedUnitNode = closedScene.nodes.get(unitPair.closedUnitId);

    if (openUnitNode === undefined) return [];
    if (closedUnitNode === undefined) return [];

    const openFlat = collectUnitNodes(openScene, unitPair.openUnitId);
    const closedFlat = collectUnitNodes(closedScene, unitPair.closedUnitId);

    const openFiltered = filterUnitDebris(openFlat, openUnitNode.totalPointCount);
    const closedFiltered = filterUnitDebris(closedFlat, closedUnitNode.totalPointCount);

    const openSorted = sortBySignificance(openFiltered);
    const closedSorted = sortBySignificance(closedFiltered);

    return pairNodesByPoints(openSorted, closedSorted);
}
