// BVH-based intersection snap engine
// Owner: George
// Manages worker-based edge intersection detection with spatial partitioning

import * as BABYLON from '@babylonjs/core';

interface EdgeData {
  v1: { x: number; y: number; z: number };
  v2: { x: number; y: number; z: number };
  meshId: string;
  meshName: string;
  edgeIndex: number;
}

// IntersectionResult interface removed - unused

/**
 * Manages BVH-based intersection snapping with worker offloading
 */
export class IntersectionSnapEngine {
  private worker: Worker | null = null;
  private workerAvailable = false;
  private bvhBuilt = false;
  private buildingBVH = false;

  // Telemetry
  private lastBuildTimeMs = 0;
  private lastQueryTimeMs = 0;
  private edgeCount = 0;
  private treeDepth = 0;

  constructor() {
    try {
      this.worker = new Worker(
        new URL('./intersectionWorker.ts', import.meta.url),
        { type: 'module' }
      );
      this.workerAvailable = true;
      console.log('[IntersectionSnapEngine] Worker initialized');
    } catch (error) {
      console.warn('[IntersectionSnapEngine] Worker unavailable:', error);
      this.workerAvailable = false;
    }
  }

  /**
   * Build BVH from scene edges (call once when scene changes)
   */
  async buildBVH(scene: BABYLON.Scene, excludeMeshIds: string[] = []): Promise<void> {
    if (!this.workerAvailable || !this.worker || this.buildingBVH) {
      return;
    }

    this.buildingBVH = true;
    this.bvhBuilt = false;

    console.log('[IntersectionSnapEngine] Building BVH from scene edges...');

    // Collect all edges from scene
    const edges: EdgeData[] = [];
    const seenEdges = new Set<string>();

    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snap') ||
        mesh.name.startsWith('marker-')
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (!positions || !indices) continue;

      const worldMatrix = mesh.computeWorldMatrix(true);
      const meshId = mesh.uniqueId.toString();

      let edgeIndex = 0;

      for (let i = 0; i < indices.length; i += 3) {
        const triangleEdges = [
          [indices[i], indices[i + 1]],
          [indices[i + 1], indices[i + 2]],
          [indices[i + 2], indices[i]],
        ];

        for (const [idx1, idx2] of triangleEdges) {
          // Deduplicate edges
          const minIdx = Math.min(idx1, idx2);
          const maxIdx = Math.max(idx1, idx2);
          const edgeKey = `${meshId}:${minIdx}-${maxIdx}`;

          if (seenEdges.has(edgeKey)) continue;
          seenEdges.add(edgeKey);

          const start = idx1 * 3;
          const end = idx2 * 3;

          const v1Local = new BABYLON.Vector3(
            positions[start],
            positions[start + 1],
            positions[start + 2]
          );
          const v2Local = new BABYLON.Vector3(
            positions[end],
            positions[end + 1],
            positions[end + 2]
          );

          const v1 = BABYLON.Vector3.TransformCoordinates(v1Local, worldMatrix);
          const v2 = BABYLON.Vector3.TransformCoordinates(v2Local, worldMatrix);

          edges.push({
            v1: { x: v1.x, y: v1.y, z: v1.z },
            v2: { x: v2.x, y: v2.y, z: v2.z },
            meshId,
            meshName: mesh.name,
            edgeIndex: edgeIndex++,
          });
        }
      }
    }

    console.log(`[IntersectionSnapEngine] Collected ${edges.length} edges`);

    // Send to worker to build BVH
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.buildingBVH = false;
        reject(new Error('BVH build timeout'));
      }, 30000); // 30 second timeout

      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'bvhBuilt') {
          clearTimeout(timeout);
          this.worker!.removeEventListener('message', handleMessage);

          this.bvhBuilt = true;
          this.buildingBVH = false;
          this.edgeCount = event.data.edgeCount || 0;
          this.treeDepth = event.data.treeDepth || 0;
          this.lastBuildTimeMs = event.data.buildTimeMs || 0;

          console.log(
            `[IntersectionSnapEngine] BVH built: ${this.edgeCount} edges, ` +
            `depth ${this.treeDepth}, ${this.lastBuildTimeMs.toFixed(1)}ms`
          );

          resolve();
        }
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({ type: 'buildBVH', edges });
    });
  }

  /**
   * Query intersections near a position
   */
  async queryIntersections(
    position: BABYLON.Vector3,
    maxDistance: number = 0.1, // meters
    budget: number = 16 // milliseconds
  ): Promise<{ position: BABYLON.Vector3; distance: number; meshNames: [string, string] } | null> {
    if (!this.workerAvailable || !this.worker || !this.bvhBuilt) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Intersection query timeout'));
      }, budget * 2);

      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'intersections') {
          clearTimeout(timeout);
          this.worker!.removeEventListener('message', handleMessage);

          this.lastQueryTimeMs = event.data.queryTimeMs || 0;

          const intersections = event.data.intersections || [];
          if (intersections.length === 0) {
            resolve(null);
            return;
          }

          // Return closest intersection
          const closest = intersections[0];
          resolve({
            position: new BABYLON.Vector3(closest.position.x, closest.position.y, closest.position.z),
            distance: closest.distance,
            meshNames: [closest.edge1MeshName, closest.edge2MeshName],
          });
        }
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({
        type: 'queryIntersections',
        queryPosition: { x: position.x, y: position.y, z: position.z },
        maxDistance,
        budget,
      });
    });
  }

  /**
   * Check if BVH is ready for queries
   */
  isReady(): boolean {
    return this.bvhBuilt && !this.buildingBVH;
  }

  /**
   * Get telemetry
   */
  getTelemetry() {
    return {
      edgeCount: this.edgeCount,
      treeDepth: this.treeDepth,
      lastBuildTimeMs: this.lastBuildTimeMs,
      lastQueryTimeMs: this.lastQueryTimeMs,
      ready: this.isReady(),
    };
  }

  /**
   * Dispose worker
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.bvhBuilt = false;
    this.buildingBVH = false;
  }
}
