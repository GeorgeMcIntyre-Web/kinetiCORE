// Web Worker for BVH-based edge intersection detection
// Owner: George
// Runs off main thread to prevent UI freezes

import { EdgeBVH, Edge, segmentToSegmentDistance } from './bvh';

interface WorkerMessage {
  type: 'buildBVH' | 'queryIntersections';
  edges?: EdgeData[]; // For buildBVH
  queryPosition?: { x: number; y: number; z: number }; // For queryIntersections
  maxDistance?: number;
  budget?: number; // milliseconds
}

interface EdgeData {
  v1: { x: number; y: number; z: number };
  v2: { x: number; y: number; z: number };
  meshId: string;
  meshName: string;
  edgeIndex: number;
}

interface IntersectionResult {
  position: { x: number; y: number; z: number };
  distance: number;
  edge1MeshName: string;
  edge2MeshName: string;
}

interface WorkerResponse {
  type: 'bvhBuilt' | 'intersections';
  edgeCount?: number;
  treeDepth?: number;
  buildTimeMs?: number;
  intersections?: IntersectionResult[];
  degraded?: boolean;
  queryTimeMs?: number;
}

let bvh: EdgeBVH | null = null;
let edges: Edge[] = [];

// Helper: Convert EdgeData to Edge
function toEdge(data: EdgeData): Edge {
  return {
    v1: { x: data.v1.x, y: data.v1.y, z: data.v1.z } as any,
    v2: { x: data.v2.x, y: data.v2.y, z: data.v2.z } as any,
    meshId: data.meshId,
    meshName: data.meshName,
    edgeIndex: data.edgeIndex,
  };
}

// Helper: Vector3-like operations (worker doesn't have Babylon.js)
function vec3Distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  if (type === 'buildBVH') {
    const startTime = performance.now();

    // Convert EdgeData to Edge objects
    edges = (event.data.edges || []).map(toEdge);

    // Build BVH
    bvh = new EdgeBVH(edges);

    const buildTimeMs = performance.now() - startTime;

    const response: WorkerResponse = {
      type: 'bvhBuilt',
      edgeCount: bvh.getEdgeCount(),
      treeDepth: bvh.getDepth(),
      buildTimeMs,
    };

    self.postMessage(response);
  }
  else if (type === 'queryIntersections') {
    const { queryPosition, maxDistance = 0.1, budget = 16 } = event.data;

    if (!bvh || !queryPosition) {
      const response: WorkerResponse = {
        type: 'intersections',
        intersections: [],
        degraded: false,
        queryTimeMs: 0,
      };
      self.postMessage(response);
      return;
    }

    const startTime = performance.now();
    const intersections: IntersectionResult[] = [];
    let degraded = false;

    // Query nearby edges for each edge using BVH
    // This reduces from O(n²) to O(n log n)
    for (let i = 0; i < edges.length && !degraded; i++) {
      // Budget check
      if (performance.now() - startTime > budget) {
        degraded = true;
        break;
      }

      const edge1 = edges[i];

      // Query BVH for nearby edges (fast spatial query)
      const nearby = bvh.queryNearby(edge1, maxDistance);

      // Test intersection with nearby edges only
      for (const edge2 of nearby) {
        // Skip same mesh or same edge
        if (edge1.meshId === edge2.meshId || edge1.edgeIndex === edge2.edgeIndex) {
          continue;
        }

        // Calculate closest points on segments
        const result = segmentToSegmentDistance(
          edge1.v1 as any,
          edge1.v2 as any,
          edge2.v1 as any,
          edge2.v2 as any
        );

        // Check if intersection is close enough
        if (result.distance < 0.001) { // 1mm tolerance
          const midpoint = {
            x: (result.point1.x + result.point2.x) / 2,
            y: (result.point1.y + result.point2.y) / 2,
            z: (result.point1.z + result.point2.z) / 2,
          };

          const distanceToQuery = vec3Distance(midpoint, queryPosition);

          if (distanceToQuery <= maxDistance) {
            intersections.push({
              position: midpoint,
              distance: distanceToQuery,
              edge1MeshName: edge1.meshName,
              edge2MeshName: edge2.meshName,
            });
          }
        }

        // Budget check
        if (performance.now() - startTime > budget) {
          degraded = true;
          break;
        }
      }
    }

    const queryTimeMs = performance.now() - startTime;

    // Sort by distance and return closest
    intersections.sort((a, b) => a.distance - b.distance);

    const response: WorkerResponse = {
      type: 'intersections',
      intersections: intersections.slice(0, 10), // Return top 10
      degraded,
      queryTimeMs,
    };

    self.postMessage(response);
  }
};
