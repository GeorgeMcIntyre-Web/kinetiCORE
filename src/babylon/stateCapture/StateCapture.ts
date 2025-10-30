import * as BABYLON from '@babylonjs/core';
import { WorldSpace, getWorldTransform, WorldTransform } from '../utils/WorldSpace';

export type ReferenceKind = 'nodes' | 'points';

export interface StateReferenceNodes {
  kind: 'nodes';
  nodeIds: string[]; // Node IDs to snapshot (world transforms and optional sampled vertices)
}

export interface StateReferencePoints {
  kind: 'points';
  points: BABYLON.Vector3[]; // Explicit world-space points
}

export type StateReference = StateReferenceNodes | StateReferencePoints;

export interface CapturedStateSnapshot {
  unitId: string;
  state: 'advance' | 'retract';
  // World-space transform samples per node (if nodes kind)
  nodeTransforms?: Record<string, WorldTransform>;
  // World-space point cloud (aggregated)
  pointCloud: BABYLON.Vector3[];
}

export interface CaptureOptions {
  // For 'nodes' kind, whether to sample mesh vertices to build a cloud
  samplePoints?: boolean;
  stride?: number;
  maxPoints?: number;
}

export class StateCapture {
  /**
   * Capture a snapshot for a unit in a named state using either node references or explicit points.
   * Returns world-space data only.
   */
  capture(
    scene: BABYLON.Scene,
    unitId: string,
    which: 'advance' | 'retract',
    ref: StateReference,
    options: CaptureOptions = {}
  ): CapturedStateSnapshot {
    if (ref.kind === 'points') {
      return {
        unitId,
        state: which,
        pointCloud: ref.points.slice(),
      };
    }

    const nodeTransforms: Record<string, WorldTransform> = {};
    const pointCloud: BABYLON.Vector3[] = [];
    let foundNodes = 0;
    let notFoundNodes = 0;
    let meshesWithVertices = 0;

    for (const id of ref.nodeIds) {
      // Try multiple lookup strategies to find the node
      let node: BABYLON.Node | null = null;

      // Strategy 1: Try as uniqueId (numeric string)
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        // Search by uniqueId in all node types
        node = scene.transformNodes.find(n => n.uniqueId === numericId) as BABYLON.Node ||
               scene.meshes.find(m => m.uniqueId === numericId) as BABYLON.Node ||
               null;
      }

      // Strategy 2: Try standard lookup methods
      if (!node) {
        node = scene.getNodeById(id) ||
               scene.getTransformNodeByID(id) ||
               scene.getMeshByID(id) ||
               scene.getNodeByName(id) ||
               scene.getMeshByName(id);
      }

      if (!node) {
        notFoundNodes++;
        console.warn(`[StateCapture] Node not found: ${id}`);
        continue;
      }

      foundNodes++;
      const wt = getWorldTransform(node);
      nodeTransforms[id] = wt;

      if (options.samplePoints) {
        if ((node as BABYLON.AbstractMesh).getVerticesData) {
          const mesh = node as BABYLON.AbstractMesh;
          const vertexCount = mesh.getTotalVertices();

          if (vertexCount > 0) {
            const pts = WorldSpace.sampleMeshWorldPoints(mesh, {
              stride: options.stride,
              maxPoints: options.maxPoints,
            });
            pointCloud.push(...pts);
            meshesWithVertices++;
            console.log(`[StateCapture] Sampled ${pts.length} points from mesh ${mesh.name || id} (${vertexCount} total vertices)`);
          } else {
            console.warn(`[StateCapture] Mesh ${mesh.name || id} has no vertices`);
          }
        }
      }
    }

    console.log(`[StateCapture] ${which} state for unit ${unitId}:`);
    console.log(`  - Nodes requested: ${ref.nodeIds.length}`);
    console.log(`  - Nodes found: ${foundNodes}`);
    console.log(`  - Nodes not found: ${notFoundNodes}`);
    console.log(`  - Meshes with vertices: ${meshesWithVertices}`);
    console.log(`  - Total points collected: ${pointCloud.length}`);

    // CRITICAL DEBUG: Show sample of collected points
    if (pointCloud.length > 0) {
      const sample = pointCloud.slice(0, Math.min(5, pointCloud.length));
      console.log(`  - Sample points (first ${sample.length}):`, sample.map(p => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`).join(', '));
    } else {
      console.error(`  - ⚠️ WARNING: No points collected! This will cause ICP to fail.`);

      // Debug: Show which nodes were requested
      console.log(`  - Requested node IDs (first 10):`, ref.nodeIds.slice(0, 10));

      // Debug: Try to understand why meshes weren't found
      if (notFoundNodes > 0) {
        console.error(`  - ${notFoundNodes} nodes could not be found in the scene. Check node ID format.`);
      }
      if (foundNodes > 0 && meshesWithVertices === 0) {
        console.error(`  - ${foundNodes} nodes were found but none had mesh vertices. Are these TransformNodes without geometry?`);
      }
    }

    return { unitId, state: which, nodeTransforms, pointCloud };
  }
}


