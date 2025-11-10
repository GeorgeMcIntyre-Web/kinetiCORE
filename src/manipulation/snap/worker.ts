// Web Worker for offloading snap anchor generation
// Owner: George
// Runs off main thread to prevent UI freezes on complex geometry

import type { SnapAnchor } from './types';

interface WorkerMessage {
  type: 'query';
  meshId: string;
  meshName: string;
  positions: Float32Array;
  indices: Uint32Array | Uint16Array;
  queryPosition: { x: number; y: number; z: number };
  maxDistance: number;
  budget: number; // milliseconds
  worldMatrix: number[]; // 16 element array (4x4 matrix)
}

interface WorkerResponse {
  type: 'result';
  anchors: SnapAnchor[];
  degraded: boolean;
  queryTimeMs: number;
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, meshId, meshName, positions, indices, queryPosition, maxDistance, budget, worldMatrix } = event.data;

  if (type !== 'query') {
    console.error('[SnapWorker] Unknown message type:', type);
    return;
  }

  const startTime = performance.now();
  const anchors: SnapAnchor[] = [];
  let degraded = false;

  const maxDistanceSq = maxDistance * maxDistance;
  const qx = queryPosition.x;
  const qy = queryPosition.y;
  const qz = queryPosition.z;

  // Helper: Transform local position to world space using provided matrix
  const transformToWorld = (lx: number, ly: number, lz: number): { x: number; y: number; z: number } => {
    const m = worldMatrix;
    return {
      x: m[0] * lx + m[4] * ly + m[8] * lz + m[12],
      y: m[1] * lx + m[5] * ly + m[9] * lz + m[13],
      z: m[2] * lx + m[6] * ly + m[10] * lz + m[14],
    };
  };

  // Helper: Calculate distance squared
  const distanceSq = (wx: number, wy: number, wz: number): number => {
    const dx = wx - qx;
    const dy = wy - qy;
    const dz = wz - qz;
    return dx * dx + dy * dy + dz * dz;
  };

  // Emit vertex anchors
  const vertexCount = positions.length / 3;
  const vertexDedupe = new Set<string>();

  for (let i = 0; i < vertexCount; i++) {
    // Budget check
    if (performance.now() - startTime > budget) {
      degraded = true;
      break;
    }

    const lx = positions[i * 3];
    const ly = positions[i * 3 + 1];
    const lz = positions[i * 3 + 2];

    const world = transformToWorld(lx, ly, lz);
    const distSq = distanceSq(world.x, world.y, world.z);

    if (distSq > maxDistanceSq) continue;

    // Deduplicate vertices (round to 0.1mm precision)
    const key = `${Math.round(world.x * 10000)},${Math.round(world.y * 10000)},${Math.round(world.z * 10000)}`;
    if (vertexDedupe.has(key)) continue;
    vertexDedupe.add(key);

    anchors.push({
      uniqueKey: `${meshId}:${i}:vertex`,
      type: 'vertex',
      position: world,
      distance: Math.sqrt(distSq),
      meshId,
      meshName,
      localIndex: i,
    });
  }

  // Emit edge midpoint anchors
  if (!degraded && indices) {
    const edgeDedupe = new Set<string>();

    for (let i = 0; i < indices.length; i += 3) {
      // Budget check
      if (performance.now() - startTime > budget) {
        degraded = true;
        break;
      }

      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];

      // Three edges per triangle
      const edges = [
        [i0, i1],
        [i1, i2],
        [i2, i0],
      ];

      for (const [vi0, vi1] of edges) {
        // Canonical edge key (sorted indices)
        const edgeKey = vi0 < vi1 ? `${vi0}-${vi1}` : `${vi1}-${vi0}`;
        if (edgeDedupe.has(edgeKey)) continue;
        edgeDedupe.add(edgeKey);

        // Calculate edge midpoint in local space
        const lx = (positions[vi0 * 3] + positions[vi1 * 3]) / 2;
        const ly = (positions[vi0 * 3 + 1] + positions[vi1 * 3 + 1]) / 2;
        const lz = (positions[vi0 * 3 + 2] + positions[vi1 * 3 + 2]) / 2;

        const world = transformToWorld(lx, ly, lz);
        const distSq = distanceSq(world.x, world.y, world.z);

        if (distSq > maxDistanceSq) continue;

        anchors.push({
          uniqueKey: `${meshId}:${edgeKey}:edgeMid`,
          type: 'edgeMid',
          position: world,
          distance: Math.sqrt(distSq),
          meshId,
          meshName,
          localIndex: i / 3, // Face index
        });
      }
    }
  }

  const queryTimeMs = performance.now() - startTime;

  const response: WorkerResponse = {
    type: 'result',
    anchors,
    degraded,
    queryTimeMs,
  };

  self.postMessage(response);
};
