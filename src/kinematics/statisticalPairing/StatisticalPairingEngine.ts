/**
 * Statistical Pairing Module
 *
 * A pure TypeScript module for preparing node pairs for ICP using only tree structure + point counts.
 *
 * CORE PRINCIPLE: Detect moving units purely from GEOMETRY, not naming conventions.
 *
 * How it works:
 * 1. Load two GLB states (open & closed) of the same fixture
 * 2. Compare point counts (vertex counts) between states
 * 3. Units are "islands of geometry" with stable point counts (±0.2%)
 * 4. Pair nodes by point count similarity → feed to ICP for precise transform
 *
 * Key invariants:
 * - ✅ NAME AGNOSTIC: Renaming all nodes to GUIDs changes nothing
 * - ✅ TREE STRUCTURE AGNOSTIC: Inserting/removing wrapper nodes doesn't break detection
 * - ✅ PURELY STATISTICAL: Decisions based only on:
 *     - totalPointCount (recursive vertex sum)
 *     - Parent-child relationships (for aggregation)
 *     - Ratio thresholds (2-60% for units, 0.2% debris filter)
 *
 * Why this works:
 * - Industrial fixtures = discrete mechanical units (base, clamps, pins)
 * - Each unit = 10k-300k vertices (significant point mass)
 * - Point counts are STABLE across poses (rigid body assumption)
 * - Junk nodes (wrappers, metadata) = < 2% of fixture → filtered out
 *
 * See: docs/STATISTICAL_PAIRING_OVERVIEW.md for full technical details
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

/**
 * 3.2 Find Unit candidates by point-mass bands
 *
 * STATISTICAL CRITERION #1: Point Mass Filtering
 *
 * A node is a candidate UNIT if:
 *   UNIT_MIN_RATIO ≤ (N_total(node) / N_total(fixture)) ≤ UNIT_MAX_RATIO
 *
 * Where:
 *   UNIT_MIN_RATIO = 0.02 (2% of fixture)
 *     → Filters out debris/fasteners (typically < 2,000 vertices)
 *   UNIT_MAX_RATIO = 0.60 (60% of fixture)
 *     → Filters out root/container nodes that encompass entire fixture
 *
 * Rationale:
 *   - Industrial units (clamps, pins) = 10k-300k vertices = 5-40% of fixture
 *   - Junk nodes (metadata wrappers) = < 2,000 vertices = < 1% of fixture
 *   - Size gap is orders of magnitude → clear statistical separation
 *
 * Name-agnostic: This decision uses ONLY point counts, not node.id
 * Tree-agnostic: Ratio is invariant under wrapper node insertion
 */
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

/**
 * 3.3 Select final Units (disjoint cover)
 *
 * STATISTICAL CRITERION #2: Non-Overlapping Selection
 *
 * From candidates, select a **disjoint cover** (non-overlapping units):
 *
 * Algorithm:
 *   1. Sort candidates by:
 *      a. totalPoints DESC (prefer larger assemblies)
 *      b. depth ASC (prefer shallower nodes as tiebreaker)
 *   2. Greedy selection:
 *      - For each candidate in sorted order:
 *        - If not already blocked:
 *          - Add to selected units
 *          - Block entire subtree (all descendants)
 *
 * Rationale:
 *   - Larger point mass = more significant assembly
 *   - Shallower depth = higher-level grouping (structural vs. decorative)
 *   - Disjoint guarantee prevents double-counting geometry
 *
 * Name-agnostic: Sorting uses totalPoints (numeric) and depth (structural)
 * Tree-agnostic: Works regardless of wrapper node depth variations
 *
 * Example:
 *   Candidates: [UNIT_A (150k pts, depth 2), SUB_B (80k pts, depth 3)]
 *   If SUB_B is child of UNIT_A:
 *     → Select UNIT_A (larger)
 *     → Block SUB_B (descendant)
 *   Result: Non-overlapping coverage
 */
export function selectUnits(
    candidates: FlatNode[],
    scene: Scene
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

    return units;
}

/**
 * 3.4 Pair Units between open and closed
 *
 * STATISTICAL CRITERION #3: Point Count Stability
 *
 * Match units between two states using point count similarity:
 *
 * For each unit U_open, find U_closed where:
 *   |N_total(U_open) - N_total(U_closed)| ≤ ABS_TOL
 *   OR
 *   |N_total(U_open) - N_total(U_closed)| / max(...) ≤ REL_TOL
 *
 * Where:
 *   ABS_TOL = 50 vertices (absolute tolerance)
 *   REL_TOL = 0.0012 (0.12% relative tolerance)
 *
 * Rationale:
 *   - Rigid body assumption: Moving a unit doesn't change vertex count
 *   - Small tolerances account for floating-point export precision
 *   - Greedy matching via sorted merge ensures stable pairing
 *
 * Name-agnostic: Matching uses ONLY point counts, not unit IDs
 * Tree-agnostic: Point count is invariant under tree restructuring
 */
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

/**
 * 4.2 Filter debris
 *
 * STATISTICAL CRITERION #4: Node Significance Filter
 *
 * Within a unit, filter out insignificant nodes:
 *
 * Keep node if:
 *   (N_total(node) / N_total(unit)) ≥ NODE_MIN_RATIO
 *
 * Where:
 *   NODE_MIN_RATIO = 0.002 (0.2% of unit)
 *
 * Rationale:
 *   - Fasteners/screws = < 500 vertices = < 0.2% of typical unit
 *   - Significant subassemblies = > 1,000 vertices = > 0.5% of unit
 *   - Filtering debris improves ICP performance (fewer outliers)
 *
 * Name-agnostic: Uses only point count ratios
 * Tree-agnostic: Ratio is preserved under wrapper nodes
 */
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
