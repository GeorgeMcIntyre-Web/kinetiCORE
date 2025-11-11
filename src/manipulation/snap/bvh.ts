// Bounding Volume Hierarchy for spatial partitioning
// Owner: George
// Enables fast edge-to-edge intersection queries for snap system

import * as BABYLON from '@babylonjs/core';

/**
 * Axis-aligned bounding box
 */
export interface AABB {
  min: BABYLON.Vector3;
  max: BABYLON.Vector3;
}

/**
 * Edge representation for BVH
 */
export interface Edge {
  v1: BABYLON.Vector3;
  v2: BABYLON.Vector3;
  meshId: string;
  meshName: string;
  edgeIndex: number; // For deduplication
}

/**
 * BVH node (internal or leaf)
 */
interface BVHNode {
  bounds: AABB;
  left?: BVHNode;
  right?: BVHNode;
  edges?: Edge[]; // Only in leaf nodes
}

/**
 * Expand AABB by a radius
 */
function expandAABB(bounds: AABB, radius: number): AABB {
  return {
    min: bounds.min.subtract(new BABYLON.Vector3(radius, radius, radius)),
    max: bounds.max.add(new BABYLON.Vector3(radius, radius, radius)),
  };
}

/**
 * Check if two AABBs intersect
 */
function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.min.x <= b.max.x && a.max.x >= b.min.x &&
    a.min.y <= b.max.y && a.max.y >= b.min.y &&
    a.min.z <= b.max.z && a.max.z >= b.min.z
  );
}

/**
 * Calculate AABB for an edge
 */
function edgeBounds(edge: Edge): AABB {
  return {
    min: BABYLON.Vector3.Minimize(edge.v1, edge.v2),
    max: BABYLON.Vector3.Maximize(edge.v1, edge.v2),
  };
}

/**
 * Calculate AABB for multiple edges
 */
function calculateBounds(edges: Edge[]): AABB {
  if (edges.length === 0) {
    return { min: BABYLON.Vector3.Zero(), max: BABYLON.Vector3.Zero() };
  }

  const bounds = edgeBounds(edges[0]);
  for (let i = 1; i < edges.length; i++) {
    const eb = edgeBounds(edges[i]);
    bounds.min = BABYLON.Vector3.Minimize(bounds.min, eb.min);
    bounds.max = BABYLON.Vector3.Maximize(bounds.max, eb.max);
  }
  return bounds;
}

/**
 * BVH tree for fast spatial edge queries
 * Reduces edge-to-edge intersection from O(n²) to O(n log n)
 */
export class EdgeBVH {
  private root: BVHNode | null = null;
  private readonly maxLeafSize = 8; // Max edges per leaf node

  constructor(edges: Edge[]) {
    if (edges.length > 0) {
      this.root = this.buildNode(edges, 0);
    }
  }

  /**
   * Build BVH node recursively (O(n log n))
   */
  private buildNode(edges: Edge[], depth: number): BVHNode {
    const bounds = calculateBounds(edges);

    // Leaf node: few edges
    if (edges.length <= this.maxLeafSize) {
      return { bounds, edges };
    }

    // Internal node: split along longest axis
    const size = bounds.max.subtract(bounds.min);
    const axis = size.x > size.y
      ? (size.x > size.z ? 'x' : 'z')
      : (size.y > size.z ? 'y' : 'z');

    // Sort edges by centroid along split axis
    const sorted = [...edges].sort((a, b) => {
      const ca = a.v1.add(a.v2).scale(0.5)[axis];
      const cb = b.v1.add(b.v2).scale(0.5)[axis];
      return ca - cb;
    });

    // Split at median
    const mid = Math.floor(sorted.length / 2);
    const leftEdges = sorted.slice(0, mid);
    const rightEdges = sorted.slice(mid);

    return {
      bounds,
      left: this.buildNode(leftEdges, depth + 1),
      right: this.buildNode(rightEdges, depth + 1),
    };
  }

  /**
   * Query edges near a given edge (for intersection testing)
   * Returns candidates that might intersect - caller must perform actual intersection test
   */
  queryNearby(edge: Edge, maxDistance: number): Edge[] {
    if (!this.root) return [];

    const edgeBound = edgeBounds(edge);
    const queryBounds = expandAABB(edgeBound, maxDistance);

    const results: Edge[] = [];
    this.queryNode(this.root, queryBounds, results);
    return results;
  }

  /**
   * Query edges within an AABB
   */
  private queryNode(node: BVHNode, queryBounds: AABB, results: Edge[]): void {
    // Check if query bounds intersect node bounds
    if (!aabbIntersects(node.bounds, queryBounds)) {
      return;
    }

    // Leaf node: add edges
    if (node.edges) {
      results.push(...node.edges);
      return;
    }

    // Internal node: recurse
    if (node.left) this.queryNode(node.left, queryBounds, results);
    if (node.right) this.queryNode(node.right, queryBounds, results);
  }

  /**
   * Get total number of edges in tree
   */
  getEdgeCount(): number {
    if (!this.root) return 0;
    return this.countEdges(this.root);
  }

  private countEdges(node: BVHNode): number {
    if (node.edges) return node.edges.length;
    return (
      (node.left ? this.countEdges(node.left) : 0) +
      (node.right ? this.countEdges(node.right) : 0)
    );
  }

  /**
   * Get tree depth (for debugging)
   */
  getDepth(): number {
    if (!this.root) return 0;
    return this.getNodeDepth(this.root);
  }

  private getNodeDepth(node: BVHNode): number {
    if (node.edges) return 1;
    return 1 + Math.max(
      node.left ? this.getNodeDepth(node.left) : 0,
      node.right ? this.getNodeDepth(node.right) : 0
    );
  }
}

/**
 * Calculate closest point on line segment to a point
 */
export function closestPointOnSegment(
  p: BABYLON.Vector3,
  a: BABYLON.Vector3,
  b: BABYLON.Vector3
): BABYLON.Vector3 {
  const ab = b.subtract(a);
  const ap = p.subtract(a);
  const t = Math.max(0, Math.min(1, BABYLON.Vector3.Dot(ap, ab) / ab.lengthSquared()));
  return a.add(ab.scale(t));
}

/**
 * Calculate minimum distance between two line segments
 * Returns { point1, point2, distance } where point1 is on segment1, point2 is on segment2
 */
export function segmentToSegmentDistance(
  a1: BABYLON.Vector3,
  a2: BABYLON.Vector3,
  b1: BABYLON.Vector3,
  b2: BABYLON.Vector3
): { point1: BABYLON.Vector3; point2: BABYLON.Vector3; distance: number } {
  const d1 = a2.subtract(a1);
  const d2 = b2.subtract(b1);
  const r = a1.subtract(b1);

  const a = d1.lengthSquared();
  const e = d2.lengthSquared();
  const f = BABYLON.Vector3.Dot(d2, r);

  // Check if either or both segments degenerate into points
  const epsilon = 0.0001;

  if (a <= epsilon && e <= epsilon) {
    // Both segments are points
    return { point1: a1, point2: b1, distance: BABYLON.Vector3.Distance(a1, b1) };
  }

  if (a <= epsilon) {
    // First segment is a point
    // s = 0 (point1 is at a1)
    const t = Math.max(0, Math.min(1, f / e));
    const point2 = b1.add(d2.scale(t));
    return { point1: a1, point2, distance: BABYLON.Vector3.Distance(a1, point2) };
  }

  const c = BABYLON.Vector3.Dot(d1, r);

  if (e <= epsilon) {
    // Second segment is a point
    // t = 0 (point2 is at b1)
    const s = Math.max(0, Math.min(1, -c / a));
    const point1 = a1.add(d1.scale(s));
    return { point1, point2: b1, distance: BABYLON.Vector3.Distance(point1, b1) };
  }

  // General case
  const b = BABYLON.Vector3.Dot(d1, d2);
  const denom = a * e - b * b;

  let s = denom !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
  let t = (b * s + f) / e;

  // Clamp t
  if (t < 0) {
    t = 0;
    s = Math.max(0, Math.min(1, -c / a));
  } else if (t > 1) {
    t = 1;
    s = Math.max(0, Math.min(1, (b - c) / a));
  }

  const point1 = a1.add(d1.scale(s));
  const point2 = b1.add(d2.scale(t));

  return { point1, point2, distance: BABYLON.Vector3.Distance(point1, point2) };
}
