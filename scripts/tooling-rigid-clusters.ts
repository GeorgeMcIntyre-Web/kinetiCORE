// scripts/tooling-rigid-clusters.ts
//
// Usage:
//   npx tsx scripts/tooling-rigid-clusters.ts "C:/path/to/9X_110_GEO.glb"
//
// Output:
//   <glbName>.rigid-clusters.json  (in same folder)
//
// Requires:
//   npm i @gltf-transform/core

import { NodeIO, type Node, type Primitive } from '@gltf-transform/core';
import fs from 'node:fs';
import path from 'node:path';

type BBox = { min: [number, number, number]; max: [number, number, number] };

type MeshNodeInfo = {
  id: number;
  name: string;
  node: Node;
  verts: number;
  bbox: BBox;
};

type Cluster = {
  id: number;
  meshIds: number[];
  name: string;
  bbox: BBox;
  meshCount: number;
  totalVerts: number;
  height: number;
  areaXY: number;
};

type ClusterType = 'base' | 'unit' | 'loose';

type ClusterJson = {
  id: number;
  name: string;
  type: ClusterType;
  attachedToBaseId: number | null;
  bbox: BBox;
  stats: {
    meshCount: number;
    totalVerts: number;
    height: number;
    areaXY: number;
  };
  meshNames: string[];
};

const io = new NodeIO();

const glbPath = process.argv[2];

if (glbPath === undefined) {
  console.error('Usage: npx tsx scripts/tooling-rigid-clusters.ts <path-to-glb>');
  process.exit(1);
}

run().catch(err => {
  console.error('Rigid cluster analysis failed:', err);
  process.exit(1);
});

async function run() {
  if (!fs.existsSync(glbPath)) {
    console.error('GLB not found:', glbPath);
    process.exit(1);
  }

  const doc = await io.read(glbPath);
  const scene = doc.getRoot().getDefaultScene();

  if (scene === undefined) {
    console.error('GLB has no default scene');
    process.exit(1);
  }

  const sceneChildren = scene.listChildren();
  if (sceneChildren.length === 0) {
    console.error('Scene has no children');
    process.exit(1);
  }

  const fixtureRoot =
    sceneChildren.find(n => n.listChildren().length > 0) ?? sceneChildren[0];

  const fixtureName = fixtureRoot.getName() || '(fixture-root)';

  console.log('Fixture root:', fixtureName);

  const meshInfos = collectMeshInfos(fixtureRoot);
  if (meshInfos.length === 0) {
    console.error('No meshes found under fixture root');
    process.exit(1);
  }

  console.log(`Collected ${meshInfos.length} meshes`);

  const clusters = buildRigidClusters(meshInfos);
  console.log(`Built ${clusters.length} rigid clusters`);

  const typedClusters = classifyClusters(clusters);
  console.log(`Classified: ${typedClusters.filter(c => c.type === 'base').length} base, ${typedClusters.filter(c => c.type === 'unit').length} unit, ${typedClusters.filter(c => c.type === 'loose').length} loose`);

  const meshNameById = new Map<number, string>();
  meshInfos.forEach(info => {
    meshNameById.set(info.id, info.name);
  });

  const json: ClusterJson[] = typedClusters.map(c => {
    const meshNames = c.meshIds.map(id => meshNameById.get(id) ?? '(mesh)');
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      attachedToBaseId: c.attachedToBaseId,
      bbox: c.bbox,
      stats: {
        meshCount: c.meshCount,
        totalVerts: c.totalVerts,
        height: c.height,
        areaXY: c.areaXY,
      },
      meshNames,
    };
  });

  const outPath = makeOutputPath(glbPath);
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2), 'utf8');

  console.log('Rigid cluster JSON written to:', outPath);
}

/* ------------------------------------------------------------------ */
/* Mesh collection                                                     */
/* ------------------------------------------------------------------ */

function collectMeshInfos(root: Node): MeshNodeInfo[] {
  const result: MeshNodeInfo[] = [];
  let nextId = 0;

  const stack: Node[] = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) continue;

    const mesh = node.getMesh();
    if (mesh) {
      mesh.listPrimitives().forEach((prim: Primitive) => {
        const pos = prim.getAttribute('POSITION');
        if (pos === undefined) return;

        const array = pos.getArray();
        if (array === undefined) return;

        const verts = pos.getCount();
        const bbox = computeBBox(array as Float32Array);
        const name = node.getName() || '(mesh-node)';

        result.push({
          id: nextId++,
          name,
          node,
          verts,
          bbox,
        });
      });
    }

    node.listChildren().forEach(child => stack.push(child));
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Clustering by bbox adjacency                                       */
/* ------------------------------------------------------------------ */

type InternalCluster = Cluster & { meshIds: number[] };

function buildRigidClusters(meshInfos: MeshNodeInfo[]): InternalCluster[] {
  const n = meshInfos.length;
  const adjacency: number[][] = Array.from({ length: n }, () => []);

  const gapTolerance = 0.001; // ~1mm if units are metres

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = meshInfos[i].bbox;
      const b = meshInfos[j].bbox;

      const gap = bboxGap(a, b);
      if (gap <= gapTolerance) {
        adjacency[i].push(j);
        adjacency[j].push(i);
      }
    }
  }

  const visited = new Array<boolean>(n).fill(false);
  const clusters: InternalCluster[] = [];
  let clusterId = 0;

  for (let i = 0; i < n; i += 1) {
    if (visited[i]) continue;

    const ids: number[] = [];
    const stack: number[] = [i];

    visited[i] = true;

    while (stack.length > 0) {
      const idx = stack.pop();
      if (idx === undefined) continue;

      ids.push(idx);

      adjacency[idx].forEach(nei => {
        if (visited[nei]) return;
        visited[nei] = true;
        stack.push(nei);
      });
    }

    const cluster = summarizeCluster(clusterId, ids, meshInfos);
    clusters.push(cluster);
    clusterId += 1;
  }

  return clusters;
}

function summarizeCluster(
  id: number,
  meshIds: number[],
  infos: MeshNodeInfo[],
): InternalCluster {
  let bbox: BBox | undefined;
  let meshCount = 0;
  let totalVerts = 0;

  meshIds.forEach(idx => {
    const info = infos[idx];

    bbox = mergeBBox(bbox, info.bbox);
    meshCount += 1;
    totalVerts += info.verts;
  });

  if (bbox === undefined) {
    bbox = { min: [0, 0, 0], max: [0, 0, 0] };
  }

  const dx = bbox.max[0] - bbox.min[0];
  const dy = bbox.max[1] - bbox.min[1];
  const dz = bbox.max[2] - bbox.min[2];

  const height = dy;
  const areaXY = Math.max(dx, 0) * Math.max(dz, 0);

  // Name: most common mesh name in the cluster
  const nameCounts = new Map<string, number>();
  meshIds.forEach(idx => {
    const nm = infos[idx].name;
    const prev = nameCounts.get(nm) ?? 0;
    nameCounts.set(nm, prev + 1);
  });

  let bestName = '(cluster)';
  let bestCount = -1;
  nameCounts.forEach((count, nm) => {
    if (count > bestCount) {
      bestCount = count;
      bestName = nm;
    }
  });

  return {
    id,
    meshIds,
    name: bestName,
    bbox,
    meshCount,
    totalVerts,
    height,
    areaXY,
    volume: dx * dy * dz,
  };
}

/* ------------------------------------------------------------------ */
/* Classification: base / unit / loose                                */
/* ------------------------------------------------------------------ */

type TypedCluster = InternalCluster & {
  type: ClusterType;
  attachedToBaseId: number | null;
};

function detectFloorY(clusters: InternalCluster[]): number | null {
  if (clusters.length === 0) return null;

  const mins = clusters.map(c => c.bbox.min[1]).sort((a, b) => a - b);

  const bandTolerance = 0.005; // 5 mm in metres

  let bestStart = mins[0];
  let bestCount = 1;

  let currentStart = mins[0];
  let currentCount = 1;

  for (let i = 1; i < mins.length; i++) {
    const y = mins[i];
    const inBand = y - currentStart <= bandTolerance;

    if (inBand) {
      currentCount += 1;
      continue;
    }

    const betterBand = currentCount > bestCount;
    if (betterBand) {
      bestStart = currentStart;
      bestCount = currentCount;
    }

    currentStart = y;
    currentCount = 1;
  }

  const tailBetter = currentCount > bestCount;
  if (tailBetter) bestStart = currentStart;

  return bestStart;
}

function classifyClusters(clusters: InternalCluster[]): TypedCluster[] {
  if (clusters.length === 0) return [];

  const floorY = detectFloorY(clusters);
  if (floorY === null) {
    console.log('Floor detection failed, marking all as loose');
    return clusters.map(c => ({ ...c, type: 'loose' as ClusterType, attachedToBaseId: null }));
  }

  console.log(`Detected floor Y: ${floorY.toFixed(4)}`);

  const floorBand = 0.01; // ±10 mm
  const areas = clusters.map(c => c.areaXY).sort((a, b) => a - b);
  const maxArea = areas[areas.length - 1];
  const baseAreaThreshold = maxArea * 0.3; // bases are the biggest footprints

  const heights = clusters.map(c => c.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)];
  const flatHeightThreshold = medianHeight * 0.7;

  const typed: TypedCluster[] = clusters.map(c => {
    const minY = c.bbox.min[1];
    const height = c.height;
    const areaXY = c.areaXY;

    const isOnFloor = Math.abs(minY - floorY) <= floorBand;
    const isFlat = height <= flatHeightThreshold;
    const isBigFootprint = areaXY >= baseAreaThreshold;

    const isBase = isOnFloor && isFlat && isBigFootprint;

    if (isBase) {
      return { ...c, type: 'base' as ClusterType, attachedToBaseId: null };
    }

    return { ...c, type: 'loose' as ClusterType, attachedToBaseId: null };
  });

  const bases = typed.filter(c => c.type === 'base');

  // Fallback: if no bases found, pick largest floor-touching clusters
  if (bases.length === 0) {
    const floorTouching = clusters.filter(c => Math.abs(c.bbox.min[1] - floorY) <= floorBand);
    if (floorTouching.length > 0) {
      const sortedByArea = [...floorTouching].sort((a, b) => b.areaXY - a.areaXY);
      const fallbackBases = sortedByArea.slice(0, Math.min(3, sortedByArea.length));
      
      fallbackBases.forEach(c => {
        const cluster = typed.find(t => t.id === c.id);
        if (cluster) {
          cluster.type = 'base';
        }
      });
      
      console.log(`Fallback: Selected ${fallbackBases.length} largest floor-touching clusters as bases`);
    }
  }

  const finalBases = typed.filter(c => c.type === 'base');
  if (finalBases.length === 0) {
    console.log('No base clusters found even with fallback');
    return typed;
  }

  console.log(`Found ${finalBases.length} base clusters`);

  // Attach loose clusters to nearest overlapping base → mark as units
  typed.forEach(cluster => {
    if (cluster.type !== 'loose') return;

    let bestBase: TypedCluster | undefined;
    let bestScore = 0;

    finalBases.forEach(base => {
      const overlap = xyOverlapFractionCluster(cluster, base);
      if (overlap <= 0.1) return; // need at least ten percent overlap

      const verticalGap = cluster.bbox.min[1] - base.bbox.max[1];
      const isGapReasonable = verticalGap >= -0.01 && verticalGap <= 0.25; // −10mm..250mm

      if (!isGapReasonable) return;

      const score = overlap / Math.max(verticalGap, 0.01);
      if (score > bestScore) {
        bestScore = score;
        bestBase = base;
      }
    });

    if (bestBase === undefined) return;

    cluster.type = 'unit';
    cluster.attachedToBaseId = bestBase.id;
  });

  const unitCount = typed.filter(c => c.type === 'unit').length;
  console.log(`Attached ${unitCount} clusters as units to bases`);

  return typed;
}

function fallbackClassification(clusters: InternalCluster[]): TypedCluster[] {
  const maxArea = Math.max(...clusters.map(c => c.areaXY));
  const heights = clusters.map(c => c.height);
  const medianH = median(heights);

  const areaBaseThreshold = maxArea * 0.4;
  const flatFactor = 0.7;

  let baseCandidates = clusters.filter(c => {
    const big = c.areaXY >= areaBaseThreshold;
    const flat = c.height <= medianH * flatFactor;
    if (!big) return false;
    if (!flat) return false;
    return true;
  });

  if (baseCandidates.length === 0) {
    const sortedByArea = [...clusters].sort((a, b) => b.areaXY - a.areaXY);
    baseCandidates = sortedByArea.slice(0, 2);
  }

  const baseIds = new Set<number>(baseCandidates.map(c => c.id));

  const typed: TypedCluster[] = clusters.map(c => {
    const isBase = baseIds.has(c.id);
    const type: ClusterType = isBase ? 'base' : 'loose';
    return {
      ...c,
      type,
      attachedToBaseId: null,
    };
  });

  return typed;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                   */
/* ------------------------------------------------------------------ */

function computeBBox(arr: Float32Array): BBox {
  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];

  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i];
    const y = arr[i + 1];
    const z = arr[i + 2];

    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }

  return { min, max };
}

function mergeBBox(a: BBox | undefined, b: BBox): BBox {
  if (a === undefined) {
    return {
      min: [...b.min] as [number, number, number],
      max: [...b.max] as [number, number, number],
    };
  }

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

function bboxGap(a: BBox, b: BBox): number {
  const gapX = Math.max(0, Math.max(a.min[0] - b.max[0], b.min[0] - a.max[0]));
  const gapY = Math.max(0, Math.max(a.min[1] - b.max[1], b.min[1] - a.max[1]));
  const gapZ = Math.max(0, Math.max(a.min[2] - b.max[2], b.min[2] - a.max[2]));
  return Math.sqrt(gapX * gapX + gapY * gapY + gapZ * gapZ);
}

function xyOverlapFraction(a: BBox, b: BBox): number {
  const minX = Math.max(a.min[0], b.min[0]);
  const maxX = Math.min(a.max[0], b.max[0]);
  const minZ = Math.max(a.min[2], b.min[2]);
  const maxZ = Math.min(a.max[2], b.max[2]);

  if (maxX <= minX || maxZ <= minZ) return 0;

  const overlapArea = (maxX - minX) * (maxZ - minZ);
  const areaA = (a.max[0] - a.min[0]) * (a.max[2] - a.min[2]);
  const areaB = (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]);

  const denom = Math.max(areaA, areaB, 1e-6);
  return overlapArea / denom;
}

function xyOverlapFractionCluster(a: InternalCluster, b: InternalCluster): number {
  const axMin = a.bbox.min[0];
  const axMax = a.bbox.max[0];
  const azMin = a.bbox.min[2];
  const azMax = a.bbox.max[2];

  const bxMin = b.bbox.min[0];
  const bxMax = b.bbox.max[0];
  const bzMin = b.bbox.min[2];
  const bzMax = b.bbox.max[2];

  const xOverlap = Math.max(0, Math.min(axMax, bxMax) - Math.max(axMin, bxMin));
  const zOverlap = Math.max(0, Math.min(azMax, bzMax) - Math.max(azMin, bzMin));
  const overlapArea = xOverlap * zOverlap;

  if (overlapArea <= 0) return 0;

  return overlapArea / Math.min(a.areaXY, b.areaXY);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return 0.5 * (sorted[mid - 1] + sorted[mid]);
  }

  return sorted[mid];
}

/* ------------------------------------------------------------------ */
/* Misc                                                               */
/* ------------------------------------------------------------------ */

function makeOutputPath(glbPathLocal: string): string {
  const dir = path.dirname(glbPathLocal);
  const base = path.basename(glbPathLocal, path.extname(glbPathLocal));
  return path.join(dir, `${base}.rigid-clusters.json`);
}

