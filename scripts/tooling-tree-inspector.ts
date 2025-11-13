// tooling-tree-inspector.ts
//
// Usage:
//   npx tsx scripts/tooling-tree-inspector.ts C:/Users/George/source/repos/kinetiCORE_DATA/Tooling/9X_110_GEO.glb
//
// Requires: npm i @gltf-transform/core

import { NodeIO } from '@gltf-transform/core';
import path from 'node:path';

type BBox = { min: [number, number, number]; max: [number, number, number] };

type MeshSummary = {
  name: string;
  verts: number;
  bbox: BBox;
  volume: number;
};

type UnitSummary = {
  name: string;
  meshCount: number;
  totalVerts: number;
  bbox: BBox;
  volume: number;
};

const io = new NodeIO();

const glbPathFromCli = process.argv[2];

if (!glbPathFromCli) {
  console.error('Usage: npx tsx scripts/tooling-tree-inspector.ts <path-to-glb>');
  process.exit(1);
}

(async () => {
  const doc = await io.read(glbPathFromCli);
  const scene = doc.getRoot().getDefaultScene();

  if (!scene) {
    console.error('No default scene in GLB');
    process.exit(1);
  }

  const sceneNodes = scene.listChildren();
  if (sceneNodes.length === 0) {
    console.error('Scene has no children');
    process.exit(1);
  }

  // Heuristic: fixture root = first child with children
  const fixtureRoot = sceneNodes.find(n => n.listChildren().length > 0) ?? sceneNodes[0];

  console.log('===========================================================');
  console.log(' GLB TREE INSPECTOR (STANDALONE)');
  console.log('===========================================================');
  console.log('File :', path.resolve(glbPathFromCli));
  console.log('Scene:', scene.getName() || '(unnamed)');
  console.log('Root :', fixtureRoot.getName() || '(unnamed)');
  console.log('');

  const unitNodes = fixtureRoot.listChildren();

  const units: UnitSummary[] = unitNodes.map(unitNode => {
    const meshes: MeshSummary[] = collectMeshSummaries(unitNode);
    return summarizeUnit(unitNode.getName() || '(unit)', meshes);
  });

  printUnitTable(units);
  console.log('');
  unitNodes.forEach((unitNode, index) => {
    const meshes = collectMeshSummaries(unitNode);
    printUnitTree(unitNode, meshes, index + 1);
  });
})().catch(err => {
  console.error('Error while reading GLB:', err);
  process.exit(1);
});

function collectMeshSummaries(rootNode: import('@gltf-transform/core').Node): MeshSummary[] {
  const meshes: MeshSummary[] = [];

  const stack: import('@gltf-transform/core').Node[] = [rootNode];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    const mesh = node.getMesh();
    if (mesh) {
      mesh.listPrimitives().forEach(prim => {
        const pos = prim.getAttribute('POSITION');
        if (!pos) return;

        const verts = pos.getCount();
        const bbox = computeBBox(pos.getArray() as Float32Array);
        const volume = bboxVolume(bbox);

        meshes.push({
          name: node.getName() || '(mesh)',
          verts,
          bbox,
          volume,
        });
      });
    }

    node.listChildren().forEach(child => stack.push(child));
  }

  return meshes;
}

function computeBBox(positions: Float32Array): BBox {
  if (positions.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }

  const min: [number, number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: [number, number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i + 0];
    const y = positions[i + 1];
    const z = positions[i + 2];

    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }

  return { min, max };
}

function bboxVolume(b: BBox): number {
  const dx = Math.max(0, b.max[0] - b.min[0]);
  const dy = Math.max(0, b.max[1] - b.min[1]);
  const dz = Math.max(0, b.max[2] - b.min[2]);
  return dx * dy * dz;
}

function mergeBBox(a: BBox | null, b: BBox): BBox {
  if (!a) return { min: [...b.min], max: [...b.max] } as BBox;

  const min: [number, number, number] = [
    Math.min(a.min[0], b.min[0]),
    Math.min(a.min[1], b.min[1]),
    Math.min(a.min[2], b.min[2]),
  ];
  const max: [number, number, number] = [
    Math.max(a.max[0], b.max[0]),
    Math.max(a.max[1], b.max[1]),
    Math.max(a.max[2], b.max[2]),
  ];
  return { min, max };
}

function summarizeUnit(name: string, meshes: MeshSummary[]): UnitSummary {
  let bbox: BBox | null = null;
  let totalVerts = 0;

  meshes.forEach(m => {
    bbox = mergeBBox(bbox, m.bbox);
    totalVerts += m.verts;
  });

  if (!bbox) {
    bbox = { min: [0, 0, 0], max: [0, 0, 0] };
  }

  return {
    name,
    meshCount: meshes.length,
    totalVerts,
    bbox,
    volume: bboxVolume(bbox),
  };
}

function printUnitTable(units: UnitSummary[]) {
  console.log('Units overview:');
  console.log('-----------------------------------------------------------');
  console.log(
    pad('Unit', 16),
    pad('#Meshes', 8),
    pad('Verts', 10),
    pad('MinY', 8),
    pad('MaxY', 8),
    pad('XY area', 10),
  );
  console.log('-----------------------------------------------------------');

  units.forEach(u => {
    const areaXY = (u.bbox.max[0] - u.bbox.min[0]) * (u.bbox.max[2] - u.bbox.min[2]);
    console.log(
      pad(u.name, 16),
      pad(String(u.meshCount), 8),
      pad(String(u.totalVerts), 10),
      pad(u.bbox.min[1].toFixed(3), 8),
      pad(u.bbox.max[1].toFixed(3), 8),
      pad(areaXY.toFixed(3), 10),
    );
  });

  console.log('-----------------------------------------------------------');
}

function printUnitTree(
  unitNode: import('@gltf-transform/core').Node,
  meshes: MeshSummary[],
  index: number,
) {
  console.log('');
  console.log(`Unit ${index}: ${unitNode.getName() || '(unit)'}`);
  console.log('-----------------------------------------------------------');

  const meshByName = new Map<string, MeshSummary[]>();
  meshes.forEach(m => {
    const list = meshByName.get(m.name) ?? [];
    list.push(m);
    meshByName.set(m.name, list);
  });

  const traverse = (node: import('@gltf-transform/core').Node, depth: number) => {
    const indent = '  '.repeat(depth);
    const name = node.getName() || '(node)';
    const entries = meshByName.get(name);

    if (entries && entries.length > 0) {
      entries.forEach((m, idx) => {
        const dx = m.bbox.max[0] - m.bbox.min[0];
        const dy = m.bbox.max[1] - m.bbox.min[1];
        const dz = m.bbox.max[2] - m.bbox.min[2];
        console.log(
          `${indent}- ${name} [#${idx}] verts:${m.verts} bbox: (${dx.toFixed(3)} x ${dy.toFixed(3)} x ${dz.toFixed(3)})`,
        );
      });
    } else {
      console.log(`${indent}- ${name}`);
    }

    node.listChildren().forEach(child => traverse(child, depth + 1));
  };

  traverse(unitNode, 1);
}

function pad(value: string, width: number): string {
  if (value.length >= width) return value;
  return value + ' '.repeat(width - value.length);
}

