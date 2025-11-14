/**
 * Core rigid clustering and classification logic.
 * 
 * Pure functions for testing - no I/O, minimal dependencies.
 * Used by tooling-rigid-clusters.ts script.
 */

export type BBox = { min: [number, number, number]; max: [number, number, number] };

export type ClusterType = 'base' | 'unit' | 'loose';

export interface InternalCluster {
  id: number;
  meshIds: number[];
  name: string;
  bbox: BBox;
  meshCount: number;
  totalVerts: number;
  height: number;
  areaXY: number;
}

export interface TypedCluster extends InternalCluster {
  type: ClusterType;
  attachedToBaseId: number | null;
}

export interface BaseStack {
  id: number;
  members: number[]; // cluster ids
  topY: number; // maxY of the stack
  bbox: BBox;
}

/**
 * Compute gap between two bounding boxes (minimum distance).
 */
export function bboxGap(a: BBox, b: BBox): number {
  const gapX = Math.max(0, Math.max(a.min[0] - b.max[0], b.min[0] - a.max[0]));
  const gapY = Math.max(0, Math.max(a.min[1] - b.max[1], b.min[1] - a.max[1]));
  const gapZ = Math.max(0, Math.max(a.min[2] - b.max[2], b.min[2] - a.max[2]));
  return Math.sqrt(gapX * gapX + gapY * gapY + gapZ * gapZ);
}

/**
 * Merge multiple bounding boxes into one.
 */
export function mergeBboxes(
  boxes: BBox[]
): BBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  boxes.forEach(b => {
    if (b.min[0] < minX) minX = b.min[0];
    if (b.min[1] < minY) minY = b.min[1];
    if (b.min[2] < minZ) minZ = b.min[2];
    if (b.max[0] > maxX) maxX = b.max[0];
    if (b.max[1] > maxY) maxY = b.max[1];
    if (b.max[2] > maxZ) maxZ = b.max[2];
  });

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
}

/**
 * Compute XY overlap fraction between two bounding boxes.
 * Returns overlap area divided by the smaller box's area.
 */
export function xyOverlapFractionFromBbox(
  a: BBox,
  b: BBox
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

/**
 * Detect floor Y coordinate by finding the most common minY value.
 * Uses a band tolerance to group similar Y values.
 */
export function detectFloorY(clusters: InternalCluster[]): number | null {
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

/**
 * Starting from floor seeds, climb upwards and merge clusters that:
 *  - overlap in XY
 *  - have a small vertical gap
 */
export function growBaseStacks(
  clusters: TypedCluster[],
  seeds: TypedCluster[]
): BaseStack[] {
  const stacks: BaseStack[] = [];
  const used = new Set<number>();

  const verticalGapMax = 0.5; // 500mm (increased to allow pedestal growth)
  const minOverlap = 0.02; // 2% XY overlap (very low to catch any connection)

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
        if (gap < -0.01) return; // below or intersecting stack
        if (gap > verticalGapMax) return; // too far above

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
 */
export function mergeNearbyBaseStacks(stacks: BaseStack[]): BaseStack[] {
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

/**
 * Attach all non-base clusters to the base stack they sit on.
 */
export function attachUnitsToBases(
  clusters: TypedCluster[],
  baseStacks: BaseStack[]
): void {
  const unitOverlapMin = 0.005; // 0.5% (very low - just need any connection)
  const unitGapMin = -0.2; // −200mm (allow penetration)
  const unitGapMax = 2.0; // 2000mm (allow units well above base)

  clusters.forEach(cluster => {
    if (cluster.type === 'base') return;

    let best: BaseStack | undefined;
    let bestScore = 0;

    baseStacks.forEach(stack => {
      const overlap = xyOverlapFractionFromBbox(cluster.bbox, stack.bbox);
      if (overlap < unitOverlapMin) return;

      const gap = cluster.bbox.min[1] - stack.topY;
      if (gap < unitGapMin || gap > unitGapMax) return;

      const score = overlap / Math.max(gap, 0.01);
      if (score <= bestScore) return;

      bestScore = score;
      best = stack;
    });

    if (!best) return;

    cluster.type = 'unit';
    cluster.attachedToBaseId = best.id;
  });
}

/**
 * Classify clusters as base / unit / loose.
 * 
 * This is the main classification function that orchestrates:
 * 1. Floor detection
 * 2. Base stack building
 * 3. Unit attachment
 */
export function classifyClusters(clusters: InternalCluster[]): TypedCluster[] {
  if (clusters.length === 0) return [];

  const floorY = detectFloorY(clusters);
  if (floorY === null) {
    return clusters.map(c => ({ ...c, type: 'loose' as ClusterType, attachedToBaseId: null }));
  }

  const typed: TypedCluster[] = clusters.map(c => ({ ...c, type: 'loose' as ClusterType, attachedToBaseId: null }));

  // 1) Seed: clusters that actually touch the floor
  const floorBand = 0.01; // ±10mm
  const floorSeeds = typed.filter(c => Math.abs(c.bbox.min[1] - floorY) <= floorBand);

  if (floorSeeds.length === 0) {
    return typed;
  }

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
      bestStack.members.push(largeCluster.id);
      bestStack.topY = Math.max(bestStack.topY, largeCluster.bbox.max[1]);
      bestStack.bbox = mergeBboxes([bestStack.bbox, largeCluster.bbox]);
      largeCluster.type = 'base';
    }
  });

  // Mark all members of each stack as base
  baseStacks.forEach(stack => {
    stack.members.forEach(id => {
      const c = typed.find(x => x.id === id);
      if (!c) return;
      c.type = 'base';
    });
  });

  // 3) Attach remaining clusters as units to nearest base stack
  attachUnitsToBases(typed, baseStacks);

  // Fallback: if we still have 0 units, promote tall loose clusters to units
  const unitCount = typed.filter(c => c.type === 'unit').length;
  if (unitCount === 0 && baseStacks.length > 0) {
    const tallThreshold = 0.2; // 200mm tall (lowered to catch more)
    const minFootHeight = floorY - 0.5; // Allow clusters that start below floor

    const tallLoose = typed
      .filter(c => c.type === 'loose')
      .filter(c => c.height >= tallThreshold && c.bbox.min[1] >= minFootHeight)
      .sort((a, b) => b.height - a.height);

    const maxPromote = 12; // hard cap
    const toPromote = tallLoose.slice(0, maxPromote);

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
  }

  return typed;
}

