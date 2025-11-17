#!/usr/bin/env ts-node

import { NodeIO, Document, Mesh, Node, Primitive, Accessor } from '@gltf-transform/core';

type Vec3 = [number, number, number];

type MeshInfo = {
  vertexCount: number;
  primitiveCount: number;
  bboxMin?: Vec3;
  bboxMax?: Vec3;
};

const DEFAULT_GLB =
  'C:/Users/George/source/repos/kinetiCORE_DATA/Tooling/9X_110_GEO.glb';

async function main() {
  const glbPathArg = process.argv[2];
  const glbPath = glbPathArg && glbPathArg.trim().length > 0 ? glbPathArg : DEFAULT_GLB;

  console.log('===========================================================');
  console.log(' GLB TREE INSPECTOR');
  console.log('===========================================================');
  console.log(`File : ${glbPath}`);
  console.log('');

  const io = new NodeIO();
  let doc: Document;

  try {
    doc = await io.read(glbPath);
  } catch (err) {
    console.error('Failed to load GLB:');
    console.error(err);
    process.exit(1);
    return;
  }

  const root = doc.getRoot();
  const scenes = root.listScenes();

  if (scenes.length === 0) {
    console.log('No scenes found in GLB.');
    return;
  }

  scenes.forEach((scene, index) => {
    const sceneName = scene.getName() || `Scene_${index}`;
    console.log(`Scene ${index}: ${sceneName}`);

    const children = scene.listChildren();
    if (children.length === 0) {
      console.log('  (no root nodes)');
      return;
    }

    children.forEach(child => printNodeRecursive(child, '  '));
  });
}

/**
 * Recursively print node + mesh info.
 */
function printNodeRecursive(node: Node, indent: string) {
  const nodeName = node.getName() || `(node ${node.getIndex()})`;
  const mesh = node.getMesh();

  let meshSuffix = '';
  if (mesh) {
    const info = getMeshInfo(mesh);
    const meshName = mesh.getName() || `mesh_${mesh.getIndex ? mesh.getIndex() : 'unknown'}`;
    meshSuffix =
      `  [mesh: ${meshName} | ` +
      `verts: ${info.vertexCount} | prims: ${info.primitiveCount}` +
      (info.bboxMin && info.bboxMax
        ? ` | bbox: (${info.bboxMin.map(n => n.toFixed(1)).join(', ')}) → (${info.bboxMax
            .map(n => n.toFixed(1))
            .join(', ')})]`
        : ' ]');
  }

  console.log(`${indent}- ${nodeName}${meshSuffix}`);

  const children = node.listChildren();
  if (children.length === 0) {
    return;
  }

  const nextIndent = `${indent}  `;
  children.forEach(child => printNodeRecursive(child, nextIndent));
}

/**
 * Collect vertex / primitive counts and an approximate bounding box
 * from POSITION accessors.
 */
function getMeshInfo(mesh: Mesh): MeshInfo {
  const primitives = mesh.listPrimitives();
  const info: MeshInfo = {
    vertexCount: 0,
    primitiveCount: primitives.length
  };

  let hasBounds = false;
  let minX = 0;
  let minY = 0;
  let minZ = 0;
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;

  primitives.forEach(prim => {
    const vertexCount = getPrimitiveVertexCount(prim);
    info.vertexCount += vertexCount;

    const pos = prim.getAttribute('POSITION');
    if (!pos) {
      return;
    }

    const bounds = getAccessorBounds(pos);
    if (!bounds) {
      return;
    }

    const [pMin, pMax] = bounds;

    if (hasBounds === false) {
      minX = pMin[0];
      minY = pMin[1];
      minZ = pMin[2];
      maxX = pMax[0];
      maxY = pMax[1];
      maxZ = pMax[2];
      hasBounds = true;
      return;
    }

    if (pMin[0] < minX) minX = pMin[0];
    if (pMin[1] < minY) minY = pMin[1];
    if (pMin[2] < minZ) minZ = pMin[2];

    if (pMax[0] > maxX) maxX = pMax[0];
    if (pMax[1] > maxY) maxY = pMax[1];
    if (pMax[2] > maxZ) maxZ = pMax[2];
  });

  if (hasBounds) {
    info.bboxMin = [minX, minY, minZ];
    info.bboxMax = [maxX, maxY, maxZ];
  }

  return info;
}

/**
 * Prefer index count; fall back to POSITION count.
 */
function getPrimitiveVertexCount(prim: Primitive): number {
  const indices = prim.getIndices();
  if (indices) {
    return indices.getCount();
  }

  const pos = prim.getAttribute('POSITION');
  if (pos) {
    return pos.getCount();
  }

  return 0;
}

/**
 * Use accessor min/max as bounding box.
 */
function getAccessorBounds(accessor: Accessor): [Vec3, Vec3] | undefined {
  const minArr: number[] = [];
  const maxArr: number[] = [];

  accessor.getMin(minArr);
  accessor.getMax(maxArr);

  if (minArr.length < 3 || maxArr.length < 3) {
    return undefined;
  }

  const min: Vec3 = [minArr[0], minArr[1], minArr[2]];
  const max: Vec3 = [maxArr[0], maxArr[1], maxArr[2]];

  return [min, max];
}

main().catch(err => {
  console.error('Unexpected error:');
  console.error(err);
  process.exit(1);
});

