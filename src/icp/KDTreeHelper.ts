/**
 * KD-Tree helper for efficient nearest neighbor search.
 * 
 * Wraps kd-tree-javascript library for point cloud operations.
 */

import { Point3D, PointCloud } from './types';
import { PointCloudHelper } from './PointCloudHelper';
import { SpatialGrid } from './SpatialGrid';

// Interface for nearest neighbor search (supports both KD-tree and SpatialGrid)
export interface NearestNeighborSearch {
  nearestRaw(x: number, y: number, z: number): { point: Point3D; distance: number };
}

// Simple KD-Tree implementation for 3D points
export class KDTree3D implements NearestNeighborSearch {
  private points: Point3D[];
  private root: KDNode | null = null;

  constructor(points: Point3D[]) {
    this.points = points;
    this.root = this.buildTree(points, 0);
  }

  /**
   * Find nearest neighbor to a point using branch-and-bound search.
   */
  nearest(point: Point3D): { point: Point3D; distance: number } {
    return this.nearestRaw(point.x, point.y, point.z);
  }

  /**
   * Find nearest neighbor using raw coordinates (avoids Point3D object creation).
   */
  nearestRaw(x: number, y: number, z: number): { point: Point3D; distance: number } {
    if (!this.root || this.points.length === 0) {
      throw new Error('KD-Tree is empty');
    }

    let bestPoint: Point3D | null = null;
    let bestDistSq = Infinity;

    // Iterative search using explicit pre-allocated stack
    interface SearchTask {
      node: KDNode;
      depth: number;
    }

    const maxSearchStackSize = Math.ceil(Math.log2(this.points.length + 1)) * 3; // Depth * 3 for worst case
    const stack: SearchTask[] = new Array(maxSearchStackSize);
    let stackPointer = 0;

    stack[stackPointer++] = { node: this.root, depth: 0 };

    while (stackPointer > 0) {
      const task = stack[--stackPointer];
      const node = task.node;
      const depth = task.depth;

      // Compute distance squared directly (avoid function call overhead)
      const dx = x - node.point.x;
      const dy = y - node.point.y;
      const dz = z - node.point.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestPoint = node.point;
      }

      const axis = depth % 3;
      const nodeVal = axis === 0 ? node.point.x : axis === 1 ? node.point.y : node.point.z;
      const pointVal = axis === 0 ? x : axis === 1 ? y : z;

      const nextBranch = pointVal < nodeVal ? node.left : node.right;
      const oppositeBranch = pointVal < nodeVal ? node.right : node.left;

      // Check if we need to search opposite branch
      const diff = pointVal - nodeVal;
      const needOpposite = oppositeBranch && diff * diff < bestDistSq;

      // Push branches (opposite first, then next, so next is processed first)
      if (needOpposite) {
        stack[stackPointer++] = { node: oppositeBranch!, depth: depth + 1 };
      }
      if (nextBranch) {
        stack[stackPointer++] = { node: nextBranch, depth: depth + 1 };
      }
    }

    if (!bestPoint) {
      throw new Error('No nearest neighbor found');
    }

    return { point: bestPoint, distance: Math.sqrt(bestDistSq) };
  }

  /**
   * Find k nearest neighbors.
   * 
   * @param point Query point
   * @param k Number of neighbors
   * @returns Array of nearest points with distances
   */
  nearestK(point: Point3D, k: number): Array<{ point: Point3D; distance: number }> {
    if (!this.root || this.points.length === 0) {
      throw new Error('KD-Tree is empty');
    }

    const candidates: Array<{ point: Point3D; distance: number }> = [];

    this.traverse(this.root, (node) => {
      const dist = this.distance(point, node.point);
      candidates.push({ point: node.point, distance: dist });
    });

    // Sort by distance and return k nearest
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, Math.min(k, candidates.length));
  }

  /**
   * Batch nearest neighbor search for multiple points.
   * More efficient than calling nearest() multiple times.
   * 
   * @param points Array of query points
   * @returns Array of nearest points and distances
   */
  batchNearest(points: Point3D[]): Array<{ point: Point3D; distance: number }> {
    if (!this.root || this.points.length === 0) {
      throw new Error('KD-Tree is empty');
    }

    const results: Array<{ point: Point3D; distance: number }> = [];
    
    for (const point of points) {
      results.push(this.nearest(point));
    }
    
    return results;
  }

  /**
   * Query all points within a radius.
   * 
   * @param point Query point
   * @param radius Search radius
   * @returns Array of points within radius
   */
  withinRadius(point: Point3D, radius: number): Array<{ point: Point3D; distance: number }> {
    if (!this.root || this.points.length === 0) {
      return [];
    }

    const results: Array<{ point: Point3D; distance: number }> = [];
    const radiusSq = radius * radius;

    this.traverse(this.root, (node) => {
      const distSq = this.distanceSquared(point, node.point);
      if (distSq <= radiusSq) {
        results.push({ point: node.point, distance: Math.sqrt(distSq) });
      }
    });

    return results;
  }

  private buildTree(points: Point3D[], depth: number): KDNode | null {
    if (points.length === 0) {
      return null;
    }

    if (points.length === 1) {
      return new KDNode(points[0]);
    }

    // Use iterative approach with explicit stack, working with indices to avoid array copies
    interface BuildTask {
      start: number;
      end: number;
      depth: number;
      parent: KDNode | null;
      isLeft: boolean;
    }

    // Work on a single array, use indices instead of slicing
    const workingArray = [...points]; // Single copy at start

    // Use a pre-allocated stack with maximum possible size to avoid dynamic growth
    const maxStackSize = Math.ceil(Math.log2(points.length + 1)) * 2 + 10; // Depth * 2 branches + buffer
    const stack: BuildTask[] = new Array(maxStackSize);
    let stackPointer = 0;

    stack[stackPointer++] = { start: 0, end: workingArray.length, depth, parent: null, isLeft: false };
    let actualRoot: KDNode | null = null;

    while (stackPointer > 0) {
      const task = stack[--stackPointer];
      const length = task.end - task.start;

      if (length === 0) {
        continue;
      }

      if (length === 1) {
        const node = new KDNode(workingArray[task.start]);
        if (task.parent) {
          if (task.isLeft) {
            task.parent.left = node;
          } else {
            task.parent.right = node;
          }
        } else {
          actualRoot = node;
        }
        continue;
      }

      const axis = task.depth % 3;
      const medianIdx = task.start + Math.floor(length / 2);

      // Use quickselect on the subarray range
      this.quickselect(workingArray, medianIdx, task.start, task.end - 1, axis);

      const node = new KDNode(workingArray[medianIdx]);

      if (task.parent) {
        if (task.isLeft) {
          task.parent.left = node;
        } else {
          task.parent.right = node;
        }
      } else {
        actualRoot = node;
      }

      // Push right child first (will be processed second)
      if (medianIdx + 1 < task.end) {
        stack[stackPointer++] = { start: medianIdx + 1, end: task.end, depth: task.depth + 1, parent: node, isLeft: false };
      }
      // Push left child second (will be processed first)
      if (medianIdx > task.start) {
        stack[stackPointer++] = { start: task.start, end: medianIdx, depth: task.depth + 1, parent: node, isLeft: true };
      }
    }

    return actualRoot;
  }

  private traverse(node: KDNode | null, visit: (node: KDNode) => void): void {
    if (!node) {
      return;
    }
    // Iterative traversal using explicit stack
    const stack: KDNode[] = [node];
    while (stack.length > 0) {
      const current = stack.pop()!;
      visit(current);
      if (current.right) {
        stack.push(current.right);
      }
      if (current.left) {
        stack.push(current.left);
      }
    }
  }

  private distance(p1: Point3D, p2: Point3D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private distanceSquared(p1: Point3D, p2: Point3D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Quickselect algorithm to find k-th smallest element (O(n) average case).
   * Used for efficient median finding in KD-tree construction.
   * Iterative version to avoid stack overflow on large arrays.
   */
  private quickselect(arr: Point3D[], k: number, left: number, right: number, axis: number): void {
    let l = left;
    let r = right;

    while (l < r) {
      const pivotIdx = this.partition(arr, l, r, axis);
      
      if (k === pivotIdx) {
        return;
      } else if (k < pivotIdx) {
        r = pivotIdx - 1;
      } else {
        l = pivotIdx + 1;
      }
    }
  }

  private partition(arr: Point3D[], left: number, right: number, axis: number): number {
    const pivotValue = axis === 0 ? arr[right].x : axis === 1 ? arr[right].y : arr[right].z;
    let i = left;

    for (let j = left; j < right; j++) {
      const jVal = axis === 0 ? arr[j].x : axis === 1 ? arr[j].y : arr[j].z;
      if (jVal < pivotValue) {
        // Swap using temp variable (avoid array destructuring for large arrays)
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
        i++;
      }
    }

    // Swap pivot
    const temp = arr[i];
    arr[i] = arr[right];
    arr[right] = temp;
    return i;
  }
}

class KDNode {
  point: Point3D;
  left: KDNode | null = null;
  right: KDNode | null = null;

  constructor(point: Point3D) {
    this.point = point;
  }
}

/**
 * Create KD-Tree from point cloud.
 * 
 * @param cloud Point cloud
 * @returns KD-Tree instance or SpatialGrid for very large clouds
 */
class SpatialGridAdapter implements NearestNeighborSearch {
  private grid: SpatialGrid;
  
  constructor(grid: SpatialGrid) {
    this.grid = grid;
  }
  
  nearestRaw(x: number, y: number, z: number): { point: Point3D; distance: number } {
    return this.grid.nearest(x, y, z);
  }
}

export function createKDTree(cloud: PointCloud): NearestNeighborSearch {
  // For large clouds (>60k), use SpatialGrid instead of KD-tree
  // toPoints() creates many objects which can cause memory issues for very large clouds
  if (cloud.count > 60000) {
    // Pass PointCloud directly - SpatialGrid works with Float32Array
    const grid = new SpatialGrid(cloud);
    return new SpatialGridAdapter(grid);
  }

  const points = PointCloudHelper.toPoints(cloud);
  return new KDTree3D(points);
}

