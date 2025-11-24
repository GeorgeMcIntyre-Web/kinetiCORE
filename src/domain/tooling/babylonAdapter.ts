/**
 * Adapter to convert Babylon scene nodes to domain-level tooling structures.
 * This bridges Babylon.js (presentation layer) to pure domain logic.
 */

import * as BABYLON from '@babylonjs/core';
import type { ToolingNode, ToolingStructure, ToolingNodeGeometry, Vector3 } from './types';
import { WorldSpace } from '../../babylon/utils/WorldSpace';
import { computeBoundingBox, computeCentroid } from './pointClouds';

/**
 * Convert Babylon node to domain Vector3.
 */
function babylonToVector3(v: BABYLON.Vector3): Vector3 {
  return { x: v.x, y: v.y, z: v.z };
}

// Global map to cache babylon nodes by their uniqueId (needed for geometry building)
const babylonNodeCache = new Map<string, BABYLON.Node>();

/**
 * Build tooling structure from Babylon scene.
 */
export function buildToolingStructureFromScene(
  scene: BABYLON.Scene,
  rootNode?: BABYLON.Node
): ToolingStructure {
  const nodes = new Map<string, ToolingNode>();
  let root: ToolingNode | null = null;

  // Clear cache for new build
  babylonNodeCache.clear();

  const rootToUse = rootNode || (scene.rootNodes.length > 0 ? scene.rootNodes[0] : null);

  if (!rootToUse) {
    return { root: null, nodes };
  }

  root = buildToolingNode(rootToUse, null, nodes);

  return { root, nodes };
}

/**
 * Recursively build tooling node from Babylon node.
 */
function buildToolingNode(
  babylonNode: BABYLON.Node,
  parentId: string | null,
  nodes: Map<string, ToolingNode>
): ToolingNode {
  const nodeId = String(babylonNode.uniqueId);
  const name = babylonNode.name || undefined;

  const children: ToolingNode[] = [];
  const childNodes = (babylonNode as any).getChildren ? (babylonNode as any).getChildren() as BABYLON.Node[] : [];

  for (const child of childNodes) {
    const childNode = buildToolingNode(child, nodeId, nodes);
    children.push(childNode);
  }

  // Extract transform if available
  let transform: ToolingNode['transform'] | undefined;
  if (babylonNode instanceof BABYLON.TransformNode || babylonNode instanceof BABYLON.AbstractMesh) {
    const pos = WorldSpace.getWorldPosition(babylonNode);
    transform = {
      position: babylonToVector3(pos),
    };
  }

  // Collect mesh references
  const meshRefs: string[] = [];
  if (babylonNode instanceof BABYLON.AbstractMesh) {
    meshRefs.push(String(babylonNode.uniqueId));
  }
  if (babylonNode instanceof BABYLON.TransformNode) {
    const meshes = babylonNode.getChildMeshes(false);
    for (const mesh of meshes) {
      meshRefs.push(String(mesh.uniqueId));
    }
  }

  const node: ToolingNode = {
    id: nodeId,
    name,
    parentId,
    children,
    transform,
    meshRefs: meshRefs.length > 0 ? meshRefs : undefined,
  };

  nodes.set(nodeId, node);

  // Cache the babylon node for later geometry lookup
  babylonNodeCache.set(nodeId, babylonNode);

  return node;
}

/**
 * Build point cloud geometry for a Babylon node.
 */
export function buildPointCloudForNode(
  node: BABYLON.Node,
  options: {
    stride?: number;
    maxPoints?: number;
    useWorldSpace?: boolean;
  } = {}
): ToolingNodeGeometry | null {
  const stride = Math.max(1, options.stride ?? 10);
  const maxPoints = options.maxPoints ?? 5000;
  const useWorldSpace = options.useWorldSpace ?? true;

  const points: BABYLON.Vector3[] = [];

  // Collect meshes
  if (node instanceof BABYLON.AbstractMesh) {
    const meshPoints = useWorldSpace
      ? WorldSpace.sampleMeshWorldPoints(node, { stride, maxPoints })
      : WorldSpace.sampleMeshLocalPoints(node, { stride, maxPoints });
    points.push(...meshPoints);
  }

  if (node instanceof BABYLON.TransformNode) {
    const meshes = node.getChildMeshes(false);
    for (const mesh of meshes) {
      const meshPoints = useWorldSpace
        ? WorldSpace.sampleMeshWorldPoints(mesh, { stride, maxPoints })
        : WorldSpace.sampleMeshLocalPoints(mesh, { stride, maxPoints });
      points.push(...meshPoints);
    }
  }

  if (points.length === 0) {
    return null;
  }

  // Convert to domain Vector3
  const domainPoints: Vector3[] = points.map(p => babylonToVector3(p));

  const bbox = computeBoundingBox(domainPoints);
  if (!bbox) {
    return null;
  }

  const centroid = computeCentroid(domainPoints);
  if (!centroid) {
    return null;
  }

  const nodeId = String(node.uniqueId);
  return {
    nodeId,
    points: domainPoints,
    bbox,
    centroid,
  };
}

/**
 * Build geometry index for all nodes in a structure.
 */
export async function buildGeometryIndex(
  structure: ToolingStructure,
  _scene: BABYLON.Scene,
  options: {
    stride?: number;
    maxPointsPerNode?: number;
    useWorldSpace?: boolean;
  } = {}
): Promise<Map<string, ToolingNodeGeometry>> {
  const geometryIndex = new Map<string, ToolingNodeGeometry>();

  if (!structure.root) {
    return geometryIndex;
  }

  const collectNodes = (node: ToolingNode): void => {
    // Use cached babylon node
    const babylonNode = babylonNodeCache.get(node.id);

    if (babylonNode) {
      const geometry = buildPointCloudForNode(babylonNode, options);
      if (geometry) {
        geometryIndex.set(node.id, geometry);
      }
    }

    for (const child of node.children) {
      collectNodes(child);
    }
  };

  collectNodes(structure.root);
  return geometryIndex;
}


