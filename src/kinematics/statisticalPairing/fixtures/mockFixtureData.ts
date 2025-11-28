import { Scene, SceneNode } from '../StatisticalPairingEngine';

// Helper to create a node
function createNode(
    id: string,
    totalPointCount: number,
    depth: number,
    children: string[] = []
): SceneNode {
    return { id, totalPointCount, depth, children };
}

// --- 5.1 Fixture: three Units, 40k each (total 120k) ---

export function createMockFixture(): { openScene: Scene; closedScene: Scene } {
    // OPEN
    const openNodes = new Map<string, SceneNode>();
    openNodes.set('FIXTURE_OPEN_ROOT', createNode('FIXTURE_OPEN_ROOT', 120000, 0, ['UNIT_101_OPEN', 'UNIT_112_LH_OPEN', 'UNIT_113_RH_OPEN']));
    openNodes.set('UNIT_101_OPEN', createNode('UNIT_101_OPEN', 40000, 1));
    openNodes.set('UNIT_112_LH_OPEN', createNode('UNIT_112_LH_OPEN', 40000, 1));
    openNodes.set('UNIT_113_RH_OPEN', createNode('UNIT_113_RH_OPEN', 40000, 1));

    const openScene: Scene = { nodes: openNodes, rootId: 'FIXTURE_OPEN_ROOT' };

    // CLOSED
    const closedNodes = new Map<string, SceneNode>();
    closedNodes.set('FIXTURE_CLOSED_ROOT', createNode('FIXTURE_CLOSED_ROOT', 120000, 0, ['UNIT_101_CLOSED', 'UNIT_112_LH_CLOSED', 'UNIT_113_RH_CLOSED']));
    closedNodes.set('UNIT_101_CLOSED', createNode('UNIT_101_CLOSED', 40000, 1));
    closedNodes.set('UNIT_112_LH_CLOSED', createNode('UNIT_112_LH_CLOSED', 40000, 1));
    closedNodes.set('UNIT_113_RH_CLOSED', createNode('UNIT_113_RH_CLOSED', 40000, 1));

    const closedScene: Scene = { nodes: closedNodes, rootId: 'FIXTURE_CLOSED_ROOT' };

    return { openScene, closedScene };
}

// --- 5.2 Detailed UNIT_112 mock (open vs closed) ---

export function createMockUnit112(): { openScene: Scene; closedScene: Scene } {
    // OPEN
    const openNodes = new Map<string, SceneNode>();
    // Root for context (optional, but good for completeness)
    openNodes.set('FIXTURE_OPEN_ROOT', createNode('FIXTURE_OPEN_ROOT', 120000, 0, ['UNIT_112_LH_OPEN']));

    openNodes.set('UNIT_112_LH_OPEN', createNode('UNIT_112_LH_OPEN', 40000, 1, ['U112_BASE_OPEN', 'U112_MOVING_ROOT_OPEN', 'U112_JUNK_OPEN']));

    openNodes.set('U112_BASE_OPEN', createNode('U112_BASE_OPEN', 24000, 2));

    openNodes.set('U112_MOVING_ROOT_OPEN', createNode('U112_MOVING_ROOT_OPEN', 14000, 2, ['U112_ARM_OPEN', 'U112_CYL_BODY_OPEN', 'U112_CLEVIS_OPEN']));
    openNodes.set('U112_ARM_OPEN', createNode('U112_ARM_OPEN', 8002, 3));
    openNodes.set('U112_CYL_BODY_OPEN', createNode('U112_CYL_BODY_OPEN', 3000, 3));
    openNodes.set('U112_CLEVIS_OPEN', createNode('U112_CLEVIS_OPEN', 2998, 3));

    openNodes.set('U112_JUNK_OPEN', createNode('U112_JUNK_OPEN', 2000, 2));

    const openScene: Scene = { nodes: openNodes, rootId: 'FIXTURE_OPEN_ROOT' };

    // CLOSED
    const closedNodes = new Map<string, SceneNode>();
    closedNodes.set('FIXTURE_CLOSED_ROOT', createNode('FIXTURE_CLOSED_ROOT', 120000, 0, ['UNIT_112_LH_CLOSED']));

    closedNodes.set('UNIT_112_LH_CLOSED', createNode('UNIT_112_LH_CLOSED', 40000, 1, ['U112_BASE_CLOSED', 'U112_WIRE_CLOSED']));

    closedNodes.set('U112_BASE_CLOSED', createNode('U112_BASE_CLOSED', 24000, 2));

    closedNodes.set('U112_WIRE_CLOSED', createNode('U112_WIRE_CLOSED', 16000, 2, ['U112_LH_GROUP_CLOSED', 'U112_WIRE_JUNK_CLOSED']));

    closedNodes.set('U112_LH_GROUP_CLOSED', createNode('U112_LH_GROUP_CLOSED', 14000, 3, ['U112_ARM_CLOSED', 'U112_CYL_BODY_CLOSED', 'U112_CLEVIS_CLOSED']));
    closedNodes.set('U112_ARM_CLOSED', createNode('U112_ARM_CLOSED', 8014, 4));
    closedNodes.set('U112_CYL_BODY_CLOSED', createNode('U112_CYL_BODY_CLOSED', 2990, 4));
    closedNodes.set('U112_CLEVIS_CLOSED', createNode('U112_CLEVIS_CLOSED', 2996, 4));

    closedNodes.set('U112_WIRE_JUNK_CLOSED', createNode('U112_WIRE_JUNK_CLOSED', 2000, 3));

    const closedScene: Scene = { nodes: closedNodes, rootId: 'FIXTURE_CLOSED_ROOT' };

    return { openScene, closedScene };
}
