import * as BABYLON from '@babylonjs/core';

type Point = BABYLON.Vector3;

class KDNode {
  point: Point;
  axis: number;
  left: KDNode | null;
  right: KDNode | null;
  constructor(point: Point, axis: number) {
    this.point = point;
    this.axis = axis;
    this.left = null;
    this.right = null;
  }
}

export class KDTree {
  private root: KDNode | null = null;

  constructor(points: Point[]) {
    this.root = KDTree.build(points, 0);
  }

  private static build(points: Point[], depth: number): KDNode | null {
    if (points.length === 0) return null;
    const axis = depth % 3;
    const sorted = points.slice().sort((a, b) => (axis === 0 ? a.x - b.x : axis === 1 ? a.y - b.y : a.z - b.z));
    const median = Math.floor(sorted.length / 2);
    const node = new KDNode(sorted[median], axis);
    node.left = KDTree.build(sorted.slice(0, median), depth + 1);
    node.right = KDTree.build(sorted.slice(median + 1), depth + 1);
    return node;
  }

  nearest(point: Point): { point: Point; dist2: number } | null {
    let best: { point: Point; dist2: number } | null = null;
    const search = (node: KDNode | null) => {
      if (!node) return;
      const d2 = KDTree.dist2(point, node.point);
      if (!best || d2 < best.dist2) best = { point: node.point, dist2: d2 };
      const axis = node.axis;
      const delta = axis === 0 ? point.x - node.point.x : axis === 1 ? point.y - node.point.y : point.z - node.point.z;
      const first = delta < 0 ? node.left : node.right;
      const second = delta < 0 ? node.right : node.left;
      search(first);
      if (!best || delta * delta < best.dist2) search(second);
    };
    search(this.root);
    return best;
  }

  private static dist2(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }
}






