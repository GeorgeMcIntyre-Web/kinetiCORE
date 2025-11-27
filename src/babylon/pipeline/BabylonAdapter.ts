
import * as BABYLON from '@babylonjs/core';
import { Scene, SceneNode } from '../../kinematics/statisticalPairing/StatisticalPairingEngine';

/**
 * Adapter to convert BabylonJS scene/nodes to the statistical pairing Scene structure.
 */
export class BabylonAdapter {
    /**
     * Convert a BabylonJS root node (and its descendants) to a statistical Scene.
     */
    static convert(rootNode: BABYLON.Node): Scene {
        const nodes = new Map<string, SceneNode>();

        // Helper to count vertices for a node (mesh)
        const getPointCount = (node: BABYLON.Node): number => {
            if (node instanceof BABYLON.Mesh) {
                return node.getTotalVertices();
            } else if (node instanceof BABYLON.InstancedMesh) {
                return node.sourceMesh.getTotalVertices();
            }
            return 0;
        };

        const processNode = (babylonNode: BABYLON.Node, depth: number, parentId?: string): number => {
            const id = babylonNode.id;
            let pointCount = getPointCount(babylonNode);

            const childrenIds: string[] = [];

            // Process children
            for (const child of babylonNode.getChildren()) {
                childrenIds.push(child.id);
                pointCount += processNode(child, depth + 1, id);
            }

            const sceneNode: SceneNode = {
                id: id,
                parentId: parentId,
                children: childrenIds,
                totalPointCount: pointCount, // Now includes subtree
                depth: depth
            };

            nodes.set(id, sceneNode);
            return pointCount;
        };

        processNode(rootNode, 0);

        return {
            nodes: nodes,
            rootId: rootNode.id
        };
    }
}
