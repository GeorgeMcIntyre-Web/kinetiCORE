import { SceneTreeManager } from './SceneTreeManager';
import { SceneNode } from './SceneTreeNode';
import { ToolUnit } from '../babylon/sceneAnalysis/ToolGraphAnalyzer';

export type SceneTreeMappingStrategy =
    | 'transform-uid'
    | 'mesh-uid'
    | 'root-node'
    | 'name-match'
    | 'not-found';

export interface SceneTreeMappingResult {
    node: SceneNode | null;
    strategy: SceneTreeMappingStrategy;
    details?: string;
}

/**
 * Robustly finds the SceneTree node corresponding to a ToolUnit.
 * 
 * Strategy Order:
 * 1. Transform Node UID (Preferred, most robust)
 * 2. Mesh UID (Fallback for mesh-based units)
 * 3. Root Node ID (Legacy/String match)
 * 4. Name Match (Last resort, brittle)
 */
export function findSceneTreeNodeForToolUnit(
    tree: SceneTreeManager,
    unit: ToolUnit
): SceneTreeMappingResult {
    // 1. Try Transform Node UID
    if (unit.babylonUniqueId !== undefined) {
        const uidStr = unit.babylonUniqueId.toString();
        const transformNode = tree.getNodeByBabylonTransformNodeId(uidStr);
        if (transformNode) {
            return {
                node: transformNode,
                strategy: 'transform-uid',
                details: `uid=${uidStr}`
            };
        }
    }

    // 2. Try Mesh UID
    if (unit.babylonUniqueId !== undefined) {
        const uidStr = unit.babylonUniqueId.toString();
        const meshNode = tree.getNodeByBabylonMeshId(uidStr);
        if (meshNode) {
            return {
                node: meshNode,
                strategy: 'mesh-uid',
                details: `uid=${uidStr}`
            };
        }
    }

    // 3. Try Root Node ID (Legacy)
    const rootNode = tree.getNode(unit.root);
    if (rootNode) {
        return {
            node: rootNode,
            strategy: 'root-node',
            details: `root=${unit.root}`
        };
    }

    // 4. Try Name Match (Last Resort)
    // TODO: Remove this fallback once IDs are fully stable
    const allNodes = tree.getAllNodes();
    const nameMatchNode = allNodes.find(n => n.name === unit.name);
    if (nameMatchNode) {
        return {
            node: nameMatchNode,
            strategy: 'name-match',
            details: `name="${unit.name}"`
        };
    }

    // 5. Not Found
    return {
        node: null,
        strategy: 'not-found',
        details: `uid=${unit.babylonUniqueId}, root=${unit.root}, name="${unit.name}"`
    };
}
