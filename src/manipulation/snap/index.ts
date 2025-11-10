// Worker-based snap query coordinator
// Owner: George
// Manages web workers for off-thread snap anchor generation

import * as BABYLON from '@babylonjs/core';
import type { SnapQuery, SnapQueryResult, SnapAnchor, SnapTelemetry } from './types';
import { pickBest, pickTopN } from './scoring';

/**
 * Snap query engine with worker-based offloading
 * Falls back to sync path if workers unavailable
 */
export class SnapQueryEngine {
  private worker: Worker | null = null;
  private workerAvailable = false;

  // Telemetry
  private queryTimes: number[] = [];
  private degradedCount = 0;
  private totalQueries = 0;
  private candidateCounts: number[] = [];

  constructor() {
    // Try to initialize worker
    try {
      // Vite will handle worker bundling via ?worker suffix
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });
      this.workerAvailable = true;
      console.log('[SnapQueryEngine] Web Worker initialized');
    } catch (error) {
      console.warn('[SnapQueryEngine] Web Worker unavailable, using sync fallback:', error);
      this.workerAvailable = false;
    }
  }

  /**
   * Query snap anchors for a scene
   * Uses workers when available, falls back to sync path
   */
  async query(
    scene: BABYLON.Scene,
    queryParams: SnapQuery
  ): Promise<SnapQueryResult> {
    const startTime = performance.now();
    const allAnchors: SnapAnchor[] = [];
    let degraded = false;
    let meshesProcessed = 0;

    // Filter valid meshes
    const validMeshes = scene.meshes.filter((mesh) => {
      if (!mesh.isVisible) return false;
      if (queryParams.excludeMeshIds.includes(mesh.uniqueId.toString())) return false;
      if (mesh.name === 'ground' || mesh.name === 'gridOverlay') return false;
      if (mesh.name.startsWith('snapIndicator')) return false;
      if (mesh.name.startsWith('marker-')) return false;
      return true;
    });

    // Process each mesh
    for (const mesh of validMeshes) {
      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();

      if (!positions) continue;

      // Calculate per-mesh budget based on complexity
      const faceCount = indices ? indices.length / 3 : 0;
      const budgetMs = this.calculateBudget(faceCount, queryParams.budgetPerMesh);

      // Get world matrix
      mesh.computeWorldMatrix(true);
      const worldMatrix = mesh.getWorldMatrix();
      const matrixArray = Array.from(worldMatrix.toArray()) as number[];

      if (this.workerAvailable && this.worker && indices) {
        // Use worker for complex meshes
        try {
          const result = await this.queryWorker(
            mesh,
            positions,
            indices,
            queryParams.position,
            queryParams.maxDistance,
            budgetMs,
            matrixArray
          );

          allAnchors.push(...result.anchors);
          if (result.degraded) degraded = true;
          meshesProcessed++;
        } catch (error) {
          console.warn('[SnapQueryEngine] Worker query failed, skipping mesh:', error);
        }
      } else {
        // Sync fallback
        const result = this.querySyncVertex(
          mesh,
          positions,
          queryParams.position,
          queryParams.maxDistance,
          budgetMs,
          worldMatrix
        );

        allAnchors.push(...result.anchors);
        if (result.degraded) degraded = true;
        meshesProcessed++;
      }

      // Check total query time budget (16ms = 60fps frame)
      if (performance.now() - startTime > 16) {
        degraded = true;
        break;
      }
    }

    const queryTimeMs = performance.now() - startTime;

    // Update telemetry
    this.updateTelemetry(queryTimeMs, allAnchors.length, degraded);

    return {
      anchors: allAnchors,
      degraded,
      queryTimeMs,
      meshesProcessed,
    };
  }

  /**
   * Query using worker
   */
  private queryWorker(
    mesh: BABYLON.AbstractMesh,
    positions: BABYLON.FloatArray,
    indices: BABYLON.IndicesArray,
    queryPosition: { x: number; y: number; z: number },
    maxDistance: number,
    budget: number,
    worldMatrix: number[]
  ): Promise<{ anchors: SnapAnchor[]; degraded: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Worker query timeout'));
      }, budget * 2); // 2x budget timeout

      const handleMessage = (event: MessageEvent) => {
        clearTimeout(timeout);
        this.worker!.removeEventListener('message', handleMessage);

        if (event.data.type === 'result') {
          resolve({
            anchors: event.data.anchors,
            degraded: event.data.degraded,
          });
        } else {
          reject(new Error('Invalid worker response'));
        }
      };

      this.worker.addEventListener('message', handleMessage);

      this.worker.postMessage({
        type: 'query',
        meshId: mesh.uniqueId.toString(),
        meshName: mesh.name,
        positions: positions instanceof Float32Array
          ? positions
          : new Float32Array(Array.from(positions)),
        indices: indices instanceof Uint32Array || indices instanceof Uint16Array
          ? indices
          : new Uint32Array(Array.from(indices)),
        queryPosition,
        maxDistance,
        budget,
        worldMatrix,
      });
    });
  }

  /**
   * Synchronous fallback (vertex-only for speed)
   */
  private querySyncVertex(
    mesh: BABYLON.AbstractMesh,
    positions: BABYLON.FloatArray,
    queryPosition: { x: number; y: number; z: number },
    maxDistance: number,
    budget: number,
    worldMatrix: BABYLON.Matrix
  ): { anchors: SnapAnchor[]; degraded: boolean } {
    const startTime = performance.now();
    const anchors: SnapAnchor[] = [];
    let degraded = false;

    const maxDistanceSq = maxDistance * maxDistance;
    const queryPos = new BABYLON.Vector3(queryPosition.x, queryPosition.y, queryPosition.z);

    const vertexCount = positions.length / 3;
    const vertexDedupe = new Set<string>();

    for (let i = 0; i < vertexCount; i++) {
      if (performance.now() - startTime > budget) {
        degraded = true;
        break;
      }

      const localPos = new BABYLON.Vector3(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );

      const worldPos = BABYLON.Vector3.TransformCoordinates(localPos, worldMatrix);
      const distSq = BABYLON.Vector3.DistanceSquared(worldPos, queryPos);

      if (distSq > maxDistanceSq) continue;

      // Deduplicate
      const key = `${Math.round(worldPos.x * 10000)},${Math.round(worldPos.y * 10000)},${Math.round(worldPos.z * 10000)}`;
      if (vertexDedupe.has(key)) continue;
      vertexDedupe.add(key);

      anchors.push({
        uniqueKey: `${mesh.uniqueId}:${i}:vertex`,
        type: 'vertex',
        position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
        distance: Math.sqrt(distSq),
        meshId: mesh.uniqueId.toString(),
        meshName: mesh.name,
        localIndex: i,
      });
    }

    return { anchors, degraded };
  }

  /**
   * Calculate per-mesh budget based on complexity
   */
  private calculateBudget(faceCount: number, baseBudget: number): number {
    // Simple meshes get less time, complex meshes get more
    if (faceCount < 100) return Math.min(baseBudget * 0.5, 2); // 2ms max
    if (faceCount < 1000) return Math.min(baseBudget, 4); // 4ms max
    return baseBudget; // Use full budget for complex meshes
  }

  /**
   * Update telemetry
   */
  private updateTelemetry(queryTimeMs: number, candidateCount: number, degraded: boolean): void {
    this.totalQueries++;
    this.queryTimes.push(queryTimeMs);
    this.candidateCounts.push(candidateCount);
    if (degraded) this.degradedCount++;

    // Keep last 100 queries
    if (this.queryTimes.length > 100) this.queryTimes.shift();
    if (this.candidateCounts.length > 100) this.candidateCounts.shift();
  }

  /**
   * Get telemetry snapshot
   */
  getTelemetry(): SnapTelemetry {
    const sortedTimes = [...this.queryTimes].sort((a, b) => a - b);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    return {
      avgQueryTimeMs:
        this.queryTimes.length > 0
          ? this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length
          : 0,
      p99QueryTimeMs: sortedTimes[p99Index] || 0,
      totalQueries: this.totalQueries,
      degradedQueries: this.degradedCount,
      avgCandidateCount:
        this.candidateCounts.length > 0
          ? this.candidateCounts.reduce((a, b) => a + b, 0) / this.candidateCounts.length
          : 0,
      lastQueryTimestamp: Date.now(),
    };
  }

  /**
   * Clean up worker
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Export helper functions
export { pickBest, pickTopN };
export type { SnapQuery, SnapQueryResult, SnapAnchor, SnapTelemetry, SnapAnchorType } from './types';
