import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../../scene/SceneTreeManager';

export interface TreeReport {
  rootName: string;
  rootId: string | number | undefined;
  totalTransformNodes: number;
  totalMeshes: number;
  depth: number;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
    volume: number;
  } | null;
  samplePaths: string[]; // up to 50 sample node paths
  perChildren?: Array<{
    name: string;
    meshCount: number;
    depth: number;
    hasTransform: boolean;
  }>;
}

function buildPath(node: BABYLON.Node): string {
  const names: string[] = [];
  let cur: BABYLON.Node | null = node;
  while (cur) {
    names.push(cur.name || String(cur.id ?? cur.uniqueId ?? ''));
    cur = cur.parent as any;
  }
  names.reverse();
  return names.join('/');
}

export function generateTreeReport(root: BABYLON.Node): TreeReport {
  const all: BABYLON.Node[] = (root as any).getDescendants
    ? (root as any).getDescendants(true) as BABYLON.Node[]
    : [];

  const nodes: BABYLON.Node[] = [root, ...all];
  let transformCount = 0;
  let meshCount = 0;
  let maxDepth = 0;

  // Bounding box across all meshes
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let hasBBox = false;

  const samples: string[] = [];

  for (const n of nodes) {
    // depth by walking parents
    let d = 0;
    let p = n.parent as any as BABYLON.Node | null;
    while (p) { d++; p = p.parent as any; }
    if (d > maxDepth) maxDepth = d;

    if (n instanceof BABYLON.AbstractMesh) {
      meshCount++;
      const m = n as BABYLON.AbstractMesh;
      m.computeWorldMatrix(true);
      const bbox = m.getBoundingInfo().boundingBox;
      minX = Math.min(minX, bbox.minimum.x);
      minY = Math.min(minY, bbox.minimum.y);
      minZ = Math.min(minZ, bbox.minimum.z);
      maxX = Math.max(maxX, bbox.maximum.x);
      maxY = Math.max(maxY, bbox.maximum.y);
      maxZ = Math.max(maxZ, bbox.maximum.z);
      hasBBox = true;
    } else if (n instanceof BABYLON.TransformNode) {
      transformCount++;
    }

    if (samples.length < 50) {
      samples.push(buildPath(n));
    }
  }

  // Fallback: some importers attach meshes at scene root with names prefixed by the logical path
  if (!hasBBox) {
    try {
      const scene = root.getScene?.();
      if (scene) {
        const name = root.name || String(root.id ?? root.uniqueId ?? '');
        const pref = `${name}/`;
        for (const m of scene.meshes as BABYLON.AbstractMesh[]) {
          const nm = m.name || '';
          if (nm === name || nm.startsWith(pref) || nm.includes(`/${name}/`)) {
            meshCount++;
            m.computeWorldMatrix(true);
            const bbox = m.getBoundingInfo().boundingBox;
            minX = Math.min(minX, bbox.minimum.x);
            minY = Math.min(minY, bbox.minimum.y);
            minZ = Math.min(minZ, bbox.minimum.z);
            maxX = Math.max(maxX, bbox.maximum.x);
            maxY = Math.max(maxY, bbox.maximum.y);
            maxZ = Math.max(maxZ, bbox.maximum.z);
            hasBBox = true;
          }
        }
      }
    } catch {}
  }

  const bbox = hasBBox
    ? {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
        size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
        volume: Math.max(0, (maxX - minX) * (maxY - minY) * (maxZ - minZ)),
      }
    : null;

  return {
    rootName: root.name || String(root.id ?? root.uniqueId ?? ''),
    rootId: (root as any).uniqueId ?? root.id,
    totalTransformNodes: transformCount,
    totalMeshes: meshCount,
    depth: maxDepth,
    boundingBox: bbox,
    samplePaths: samples,
  };
}

export function downloadTreeReport(root: BABYLON.Node): void {
  const report = generateTreeReport(root);
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (report.rootName || 'tree').replace(/[^a-z0-9_\-]+/gi, '_');
  a.href = url;
  a.download = `${safeName}_tree_report.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Fallback: when SceneTree nodes don't carry Babylon IDs, try to map
// by matching TransformNode names for each child under a selected
// SceneTree node, and compute per-child mesh counts.
export function downloadMappedSceneTreeReport(scene: BABYLON.Scene, sceneTreeNodeId: string): void {
  const tree = SceneTreeManager.getInstance();
  const node = tree.getNode(sceneTreeNodeId);
  if (!node) return;

  const children = node.childIds
    .map((id) => tree.getNode(id))
    .filter(Boolean) as any[];

  const perChildren: TreeReport['perChildren'] = [];

  let totalMeshes = 0;
  let totalTransforms = 0;
  let maxDepth = 0;

  for (const c of children) {
    const tnId = c.babylonTransformNodeId ?? c.babylonNodeId;
    let root: BABYLON.Node | null = null as any;
    if (tnId) {
      const uid = parseInt(String(tnId));
      root = scene.transformNodes.find((n) => (n as any).uniqueId === uid) || null;
    }
    if (!root) {
      root = scene.getTransformNodeByName(c.name) as any;
    }
    let count = 0;
    let depth = 0;
    let hasTransform = !!root;
    if (root) {
      const nodes: BABYLON.Node[] = [root, ...(((root as any).getDescendants?.(true)) as BABYLON.Node[] || [])];
      for (const n of nodes) {
        if (n instanceof BABYLON.AbstractMesh) count++;
        if (n instanceof BABYLON.TransformNode) totalTransforms++;
        let d = 0; let p = n.parent as any as BABYLON.Node | null; while (p) { d++; p = p.parent as any; }
        if (d > depth) depth = d;
      }
    }
    totalMeshes += count;
    if (depth > maxDepth) maxDepth = depth;
    perChildren!.push({ name: c.name, meshCount: count, depth, hasTransform });
  }

  const report: TreeReport = {
    rootName: node.name,
    rootId: node.id,
    totalTransformNodes: totalTransforms,
    totalMeshes,
    depth: maxDepth,
    boundingBox: null,
    samplePaths: children.map((c) => `${node.name}/${c.name}`),
    perChildren,
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (report.rootName || 'tree').replace(/[^a-z0-9_\-]+/gi, '_');
  a.href = url;
  a.download = `${safeName}_mapped_tree_report.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


