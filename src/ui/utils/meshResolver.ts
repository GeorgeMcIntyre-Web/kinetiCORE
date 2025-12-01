import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { SceneNode } from '../../scene/SceneTreeNode';

/**
 * Resolve all Babylon mesh uniqueIds for the provided scene-tree node IDs.
 * Uses Babylon scene graph (uniqueId) first, with name fallback, and recurses tree children.
 */
export function resolveMeshUniqueIdsForNodes(nodeIds: string[], scene: BABYLON.Scene): Set<number> {
  const meshIds = new Set<number>();
  const tree = SceneTreeManager.getInstance();

  const addMesh = (mesh: BABYLON.AbstractMesh | null) => {
    if (mesh && mesh.geometry) {
      meshIds.add(mesh.uniqueId);
    }
  };

  const traverseTransform = (transform: BABYLON.TransformNode | null) => {
    if (!transform) return;
    const stack: BABYLON.Node[] = [transform];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      if (current instanceof BABYLON.AbstractMesh) {
        addMesh(current as BABYLON.Mesh);
      }
      current.getChildren().forEach((c) => stack.push(c));
    }
  };

  const collectForNode = (node: SceneNode | undefined) => {
    if (!node) return;

    const targetMeshUid = node.babylonMeshId ? Number(node.babylonMeshId) : null;
    const targetTransformUid = node.babylonTransformNodeId ? Number(node.babylonTransformNodeId) : null;

    if (Number.isFinite(targetMeshUid)) {
      addMesh(scene.getMeshByUniqueId(targetMeshUid!));
    }

    // Preferred: transform by uniqueId
    let foundTransform = false;
    if (Number.isFinite(targetTransformUid)) {
      const t = scene.getTransformNodeByUniqueId(targetTransformUid!);
      if (t) {
        traverseTransform(t);
        foundTransform = true;
      }
    }

    // Name fallback only if no transform uniqueId match
    if (!foundTransform) {
      scene.meshes.forEach((m) => {
        if (m.name === node.name) {
          addMesh(m as BABYLON.Mesh);
        }
      });
      const byNameTransform = scene.transformNodes.find((tn) => tn.name === node.name) || null;
      traverseTransform(byNameTransform);
    }

    // Recurse into tree children
    const children = tree.getChildren(node.id);
    children.forEach(collectForNode);
  };

  nodeIds.forEach((id) => collectForNode(tree.getNode(id)));

  return meshIds;
}
