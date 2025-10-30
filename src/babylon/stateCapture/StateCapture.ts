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

    for (const id of ref.nodeIds) {
      const node = scene.getNodeById(id) || scene.getTransformNodeByID(id) || scene.getNodeByName(id);
      if (!node) continue;
      const wt = getWorldTransform(node);
      nodeTransforms[id] = wt;

      if (options.samplePoints) {
        if ((node as BABYLON.AbstractMesh).getVerticesData) {
          const mesh = node as BABYLON.AbstractMesh;
          const pts = WorldSpace.sampleMeshWorldPoints(mesh, {
            stride: options.stride,
            maxPoints: options.maxPoints,
          });
          for (const p of pts) pointCloud.push(p);
        }
      }
    }

    return { unitId, state: which, nodeTransforms, pointCloud };
  }
}


