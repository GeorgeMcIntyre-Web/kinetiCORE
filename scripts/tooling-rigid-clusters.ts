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
import { classifyClusters, bboxGap, detectFloorY, type InternalCluster } from '../src/dev/tooling/RigidClusterCore';
import { checkRigidClustersInvariants, assertInvariants } from '../src/dev/tooling/PipelineInvariants';

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

// Note: gltf-transform doesn't support Draco compression directly
// GLB files with Draco compression need to be decompressed first
const io = new NodeIO();

const glbPath = process.argv[2];

if (glbPath === undefined) {
  console.error('Usage: npx tsx scripts/tooling-rigid-clusters.ts <path-to-glb>');
  process.exit(1);
}

run().catch(err => {
  if (err?.message?.includes('KHR_draco_mesh_compression')) {
    console.error('Rigid cluster analysis failed: GLB uses Draco compression.');
    console.error('To fix this, install the Draco extension:');
    console.error('  npm install @gltf-transform/draco');
    console.error('');
    console.error('Alternatively, decompress the GLB file using gltf-transform:');
    console.error('  npx @gltf-transform/cli draco <input.glb> <output.glb>');
  } else {
    console.error('Rigid cluster analysis failed:', err);
  }
  process.exit(1);
});

async function run() {
  // Debug: log the received path to help diagnose path issues
  if (process.env.DEBUG_PATHS) {
    console.log('[DEBUG] Received GLB path:', JSON.stringify(glbPath));
    console.log('[DEBUG] Path length:', glbPath.length);
  }
  
  if (!fs.existsSync(glbPath)) {
    console.error('GLB not found:', glbPath);
    console.error('Path length:', glbPath.length);
    console.error('Please check that the path is correct and the file exists.');
    process.exit(1);
  }

  // Try to read the GLB - if it fails due to Draco compression, decompress it first
  let doc;
  let tempGlbPath: string | null = null;
  
  try {
    doc = await io.read(glbPath);
  } catch (err: any) {
    if (err?.message?.includes('KHR_draco_mesh_compression')) {
      console.log('GLB uses Draco compression. Decompressing...');
      
      // Create a temporary decompressed GLB file
      const tempDir = path.join(path.dirname(glbPath), '.temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const glbName = path.basename(glbPath, '.glb');
      tempGlbPath = path.join(tempDir, `${glbName}_decompressed.glb`);
      
      // Use gltf-transform copy to decompress (copy without compression = decompress)
      // Quote paths to handle spaces
      const { spawn } = await import('node:child_process');
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('npx', ['@gltf-transform/cli', 'copy', `"${glbPath}"`, `"${tempGlbPath}"`], {
          stdio: 'inherit',
          shell: true,
        });
        
        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Decompression failed with code ${code}`));
          }
        });
        
        proc.on('error', (err) => {
          reject(err);
        });
      });
      
      console.log('Decompression complete. Processing decompressed GLB...');
      doc = await io.read(tempGlbPath);
    } else {
      throw err;
    }
  }
  const scene = doc.getRoot().getDefaultScene();

  if (scene === null || scene === undefined) {
    console.error('GLB has no default scene');
    process.exit(1);
    return;
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

  // Use extracted classifyClusters function
  const typedClusters = classifyClusters(clusters);
  
  const floorY = detectFloorY(clusters);
  if (floorY !== null) {
    console.log(`Detected floor Y: ${floorY.toFixed(4)}`);
  }
  
  const baseCount = typedClusters.filter(c => c.type === 'base').length;
  const unitCount = typedClusters.filter(c => c.type === 'unit').length;
  const looseCount = typedClusters.filter(c => c.type === 'loose').length;
  console.log(`Classified: ${baseCount} base, ${unitCount} unit, ${looseCount} loose`);

  // Runtime invariant checks
  const violations = checkRigidClustersInvariants(typedClusters);
  if (violations.length > 0) {
    console.error('Invariant violations detected:');
    violations.forEach(v => console.error(`  [${v.step}] ${v.message}`));
    assertInvariants(violations);
  }

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
  
  // Clean up temporary decompressed GLB if it was created
  if (tempGlbPath && fs.existsSync(tempGlbPath)) {
    try {
      fs.unlinkSync(tempGlbPath);
      console.log('Cleaned up temporary decompressed GLB');
    } catch (err) {
      console.warn('Failed to clean up temporary GLB:', err);
    }
  }
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
        if (pos === null || pos === undefined) return;

        const array = pos.getArray();
        if (array === null || array === undefined) return;

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

// InternalCluster type is now imported from RigidClusterCore

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
  };
}

/* ------------------------------------------------------------------ */
/* Classification: base / unit / loose                                */
/* ------------------------------------------------------------------ */
/* NOTE: Classification functions are now imported from RigidClusterCore.ts */
/* The old function definitions below are kept for reference but are unused. */

type TypedCluster = InternalCluster & {
  type: ClusterType;
  attachedToBaseId: number | null;
};

// OLD - Now using imported classifyClusters from RigidClusterCore
// Keeping for reference - can be removed later
/*
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

interface BaseStack {
  id: number;
  members: number[];          // cluster ids
  topY: number;               // maxY of the stack
  bbox: { min: [number, number, number]; max: [number, number, number] };
}

function classifyClusters(clusters: InternalCluster[]): TypedCluster[] {
  if (clusters.length === 0) return [];

  const floorY = detectFloorY(clusters);
  if (floorY === null) {
    console.log('Floor detection failed, marking all as loose');
    return clusters.map(c => ({ ...c, type: 'loose' as ClusterType, attachedToBaseId: null }));
  }

  console.log(`Detected floor Y: ${floorY.toFixed(4)}`);

  const typed: TypedCluster[] = clusters.map(c => ({ ...c, type: 'loose' as ClusterType, attachedToBaseId: null }));

  // 1) Seed: clusters that actually touch the floor
  const floorBand = 0.01; // ±10mm
  const floorSeeds = typed.filter(c => Math.abs(c.bbox.min[1] - floorY) <= floorBand);

  if (floorSeeds.length === 0) {
    console.log('No floor-touching clusters found');
    return typed;
  }

  console.log(`Found ${floorSeeds.length} floor seed clusters`);

  // 2) Grow base stacks upwards from each seed
  let baseStacks = growBaseStacks(typed, floorSeeds);
  
  // 2a) Merge base stacks that are close together (within reasonable XY distance)
  baseStacks = mergeNearbyBaseStacks(baseStacks);
  
  // 2b) Also merge large, flat clusters near the floor into base stacks
  const maxArea = Math.max(...clusters.map(c => c.areaXY));
  const largeClusterThreshold = maxArea * 0.2; // 20% of max area
  const nearFloorThreshold = 0.5; // 500mm above floor
  
  const largeNearFloor = typed.filter(c => {
    if (c.type !== 'loose') return false;
    const isLarge = c.areaXY >= largeClusterThreshold;
    // Check if cluster spans the floor (minY below or near floor, or intersects floor band)
    const spansFloor = c.bbox.min[1] <= floorY + 0.1 || 
                       (c.bbox.min[1] <= floorY + nearFloorThreshold && c.bbox.max[1] >= floorY - 0.1);
    return isLarge && spansFloor;
  });
  
  console.log(`Found ${largeNearFloor.length} large clusters near floor (area >= ${largeClusterThreshold.toFixed(4)}, minY <= ${(floorY + nearFloorThreshold).toFixed(4)})`);
  
  // Try to merge large near-floor clusters into existing base stacks
  largeNearFloor.forEach(largeCluster => {
    let bestStack: BaseStack | undefined;
    let bestScore = 0;
    
    baseStacks.forEach(stack => {
      // Check if cluster spans the base stack vertically (cluster minY <= stack topY + tolerance)
      // or sits on top (cluster minY >= stack topY - small tolerance)
      const clusterBottom = largeCluster.bbox.min[1];
      const stackTop = stack.topY;
      const verticalOverlap = clusterBottom <= stackTop + 0.1 || 
                              (clusterBottom >= stackTop - 0.1 && clusterBottom <= stackTop + 1.0);
      if (!verticalOverlap) return;
      
      // Check if large cluster contains base stack in XY, or vice versa, or they overlap
      const overlap = xyOverlapFractionFromBbox(largeCluster.bbox, stack.bbox);
      
      // Also check if one contains the other (even if overlap fraction is small due to size difference)
      const largeContainsBase = 
        largeCluster.bbox.min[0] <= stack.bbox.min[0] &&
        largeCluster.bbox.max[0] >= stack.bbox.max[0] &&
        largeCluster.bbox.min[2] <= stack.bbox.min[2] &&
        largeCluster.bbox.max[2] >= stack.bbox.max[2];
      
      const baseContainsLarge = 
        stack.bbox.min[0] <= largeCluster.bbox.min[0] &&
        stack.bbox.max[0] >= largeCluster.bbox.max[0] &&
        stack.bbox.min[2] <= largeCluster.bbox.min[2] &&
        stack.bbox.max[2] >= largeCluster.bbox.max[2];
      
      const score = overlap > 0 ? overlap : (largeContainsBase || baseContainsLarge ? 0.5 : 0);
      
      if (score > bestScore && (overlap >= 0.005 || largeContainsBase || baseContainsLarge)) {
        bestScore = score;
        bestStack = stack;
      }
    });
    
    if (bestStack) {
      console.log(`  Merged large cluster ${largeCluster.id} (area=${largeCluster.areaXY.toFixed(4)}, minY=${largeCluster.bbox.min[1].toFixed(4)}) into base stack ${bestStack.id} (score=${bestScore.toFixed(4)})`);
      bestStack.members.push(largeCluster.id);
      bestStack.topY = Math.max(bestStack.topY, largeCluster.bbox.max[1]);
      bestStack.bbox = mergeBboxes([bestStack.bbox, largeCluster.bbox]);
      largeCluster.type = 'base';
    } else {
      console.log(`  Could not merge large cluster ${largeCluster.id} (area=${largeCluster.areaXY.toFixed(4)}, minY=${largeCluster.bbox.min[1].toFixed(4)}) - no overlapping base stack`);
    }
  });
  
  // Debug: show stack sizes
  baseStacks.forEach((stack, idx) => {
    console.log(`  Base stack ${idx + 1}: ${stack.members.length} clusters, topY=${stack.topY.toFixed(4)}`);
  });

  // Mark all members of each stack as base
  baseStacks.forEach(stack => {
    stack.members.forEach(id => {
      const c = typed.find(x => x.id === id);
      if (!c) return;
      c.type = 'base';
    });
  });

  console.log(`Built ${baseStacks.length} base stacks with ${baseStacks.reduce((sum, s) => sum + s.members.length, 0)} total clusters`);

  // 3) Attach remaining clusters as units to nearest base stack
  const looseBefore = typed.filter(c => c.type === 'loose').length;
  console.log(`Before unit attachment: ${looseBefore} loose clusters`);
  attachUnitsToBases(typed, baseStacks);

  let unitCount = typed.filter(c => c.type === 'unit').length;
  let baseCount = typed.filter(c => c.type === 'base').length;
  let looseCount = typed.filter(c => c.type === 'loose').length;
  console.log(`After attachUnitsToBases: ${baseCount} base, ${unitCount} unit, ${looseCount} loose`);

  // Fallback: if we still have 0 units, promote tall loose clusters to units
  if (unitCount === 0 && baseStacks.length > 0) {
    const tallThreshold = 0.2;          // 200mm tall (lowered to catch more)
    const minFootHeight = floorY - 0.5; // Allow clusters that start below floor

    const tallLoose = typed
      .filter(c => c.type === 'loose')
      .filter(c => c.height >= tallThreshold && c.bbox.min[1] >= minFootHeight)
      .sort((a, b) => b.height - a.height);

    const maxPromote = 12;              // hard cap
    const toPromote = tallLoose.slice(0, maxPromote);

    console.log(`Fallback: Promoting ${toPromote.length} tall loose clusters to units`);

    toPromote.forEach(c => {
      // Attach to nearest base stack horizontally
      let best: BaseStack | undefined;
      let bestDist = Number.POSITIVE_INFINITY;

      const cx = (c.bbox.min[0] + c.bbox.max[0]) * 0.5;
      const cz = (c.bbox.min[2] + c.bbox.max[2]) * 0.5;

      baseStacks.forEach(stack => {
        const sx = (stack.bbox.min[0] + stack.bbox.max[0]) * 0.5;
        const sz = (stack.bbox.min[2] + stack.bbox.max[2]) * 0.5;
        const dx = cx - sx;
        const dz = cz - sz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist >= bestDist) return;
        bestDist = dist;
        best = stack;
      });

      if (!best) return;

      c.type = 'unit';
      c.attachedToBaseId = best.id;
    });

    unitCount = typed.filter(c => c.type === 'unit').length;
    baseCount = typed.filter(c => c.type === 'base').length;
    looseCount = typed.filter(c => c.type === 'loose').length;
    console.log(
      `Fallback promotion: ${unitCount} unit, ${baseCount} base, ${looseCount} loose`
    );
  }

  const finalUnitCount = typed.filter(c => c.type === 'unit').length;
  const finalBaseCount = typed.filter(c => c.type === 'base').length;
  const finalLooseCount = typed.filter(c => c.type === 'loose').length;
  console.log(`Final classification: ${finalBaseCount} base, ${finalUnitCount} unit, ${finalLooseCount} loose`);

  return typed;
}

/**
 * Starting from floor seeds, climb upwards and merge clusters that:
 *  - overlap in XY
 *  - have a small vertical gap
 */
function growBaseStacks(
  clusters: TypedCluster[],
  seeds: TypedCluster[]
): BaseStack[] {
  const stacks: BaseStack[] = [];
  const used = new Set<number>();

  const verticalGapMax = 0.5; // 500mm (increased to allow pedestal growth)
  const minOverlap = 0.02;      // 2% XY overlap (very low to catch any connection)

  seeds.forEach(seed => {
    if (used.has(seed.id)) return;

    const stackMembers = new Set<number>();
    stackMembers.add(seed.id);
    used.add(seed.id);

    let stackTopY = seed.bbox.max[1];
    let stackBbox = { ...seed.bbox };
    let changed = true;

    while (changed) {
      changed = false;

      clusters.forEach(candidate => {
        if (used.has(candidate.id)) return;

        const gap = candidate.bbox.min[1] - stackTopY;
        if (gap < -0.01) return;              // below or intersecting stack
        if (gap > verticalGapMax) return;     // too far above

        // Compare with the growing stack's merged bbox, not just the seed
        const overlap = xyOverlapFractionFromBbox(candidate.bbox, stackBbox);
        if (overlap < minOverlap) return;

        stackMembers.add(candidate.id);
        used.add(candidate.id);
        stackTopY = Math.max(stackTopY, candidate.bbox.max[1]);
        // Update stack bbox to include the new member
        stackBbox = mergeBboxes([stackBbox, candidate.bbox]);
        changed = true;
      });
    }

    if (stackMembers.size === 0) return;

    stacks.push({
      id: seed.id,
      members: Array.from(stackMembers),
      topY: stackTopY,
      bbox: stackBbox
    });
  });

  return stacks;
}

/**
 * Merge base stacks that are close together in XY to create larger base areas.
 * This helps the large plate cluster overlap with the combined base.
 */
function mergeNearbyBaseStacks(stacks: BaseStack[]): BaseStack[] {
  if (stacks.length <= 1) return stacks;
  
  const mergeDistance = 1.0; // 1m - merge stacks within this XY distance
  const merged = new Set<number>();
  const result: BaseStack[] = [];
  
  stacks.forEach((stack, i) => {
    if (merged.has(i)) return;
    
    const combined = { ...stack };
    merged.add(i);
    
    // Find nearby stacks to merge
    stacks.forEach((other, j) => {
      if (i === j || merged.has(j)) return;
      
      const centerA = [
        (combined.bbox.min[0] + combined.bbox.max[0]) / 2,
        (combined.bbox.min[2] + combined.bbox.max[2]) / 2
      ];
      const centerB = [
        (other.bbox.min[0] + other.bbox.max[0]) / 2,
        (other.bbox.min[2] + other.bbox.max[2]) / 2
      ];
      
      const dx = centerA[0] - centerB[0];
      const dz = centerA[1] - centerB[1];
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist <= mergeDistance) {
        // Merge other into combined
        combined.members.push(...other.members);
        combined.topY = Math.max(combined.topY, other.topY);
        combined.bbox = mergeBboxes([combined.bbox, other.bbox]);
        merged.add(j);
      }
    });
    
    result.push(combined);
  });
  
  return result;
}

/** Attach all non-base clusters to the base stack they sit on. */
function attachUnitsToBases(
  clusters: TypedCluster[],
  baseStacks: BaseStack[]
): void {
  const unitOverlapMin = 0.005;       // 0.5% (very low - just need any connection)
  const unitGapMin = -0.2;            // −200mm (allow penetration)
  const unitGapMax = 2.0;             // 2000mm (allow units well above base)

  let attachedCount = 0;
  let skippedOverlap = 0;
  let skippedGap = 0;

  clusters.forEach(cluster => {
    if (cluster.type === 'base') return;

    let best: BaseStack | undefined;
    let bestScore = 0;
    let bestOverlap = 0;
    let bestGap = 0;

    baseStacks.forEach(stack => {
      const overlap = xyOverlapFractionFromBbox(cluster.bbox, stack.bbox);
      if (overlap < unitOverlapMin) {
        skippedOverlap++;
        return;
      }

      const gap = cluster.bbox.min[1] - stack.topY;
      if (gap < unitGapMin || gap > unitGapMax) {
        skippedGap++;
        return;
      }

      const score = overlap / Math.max(gap, 0.01);
      if (score <= bestScore) return;

      bestScore = score;
      bestOverlap = overlap;
      bestGap = gap;
      best = stack;
    });

    if (!best) return;

    cluster.type = 'unit';
    cluster.attachedToBaseId = best.id;
    attachedCount++;
  });

  console.log(`  Attached ${attachedCount} units (skipped ${skippedOverlap} for overlap, ${skippedGap} for gap)`);
}
*/

// Imported helper functions are now used from RigidClusterCore
// Keeping local geometry helpers that are still used by buildRigidClusters
/*
function xyOverlapFractionFromBbox(
  a: { min: [number, number, number]; max: [number, number, number] },
  b: { min: [number, number, number]; max: [number, number, number] }
): number {
  const axMin = a.min[0];
  const axMax = a.max[0];
  const azMin = a.min[2];
  const azMax = a.max[2];

  const bxMin = b.min[0];
  const bxMax = b.max[0];
  const bzMin = b.min[2];
  const bzMax = b.max[2];

  const xOverlap = Math.max(0, Math.min(axMax, bxMax) - Math.max(axMin, bxMin));
  const zOverlap = Math.max(0, Math.min(azMax, bzMax) - Math.max(azMin, bzMin));
  const overlapArea = xOverlap * zOverlap;

  if (overlapArea <= 0) return 0;

  const areaA = (axMax - axMin) * (azMax - azMin);
  const areaB = (bxMax - bxMin) * (bzMax - bzMin);
  const minArea = Math.max(Math.min(areaA, areaB), 1e-6);

  return overlapArea / minArea;
}
*/

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

