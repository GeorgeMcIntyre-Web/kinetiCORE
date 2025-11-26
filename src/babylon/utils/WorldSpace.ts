import * as BABYLON from '@babylonjs/core';

/**
 * World-space helpers. Everything returns/accepts world-space values.
 * Never assume local authoring frames.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace WorldSpace {
  export function getWorldMatrix(node: BABYLON.Node): BABYLON.Matrix {
    // Force update world matrix for correctness
    if ((node as any).computeWorldMatrix) {
      (node as any).computeWorldMatrix(true);
    }
    return (node as any).getWorldMatrix(true);
  }

  export function getWorldPosition(node: BABYLON.Node): BABYLON.Vector3 {
    const m = getWorldMatrix(node);
    return BABYLON.Vector3.FromArray([m.m[12], m.m[13], m.m[14]]);
  }

  export function getWorldRotationQuaternion(node: BABYLON.Node): BABYLON.Quaternion {
    const wm = getWorldMatrix(node);
    const s = new BABYLON.Vector3();
    const r = new BABYLON.Quaternion();
    const t = new BABYLON.Vector3();
    wm.decompose(s, r, t);
    return r;
  }

  export function decomposeWorld(node: BABYLON.Node): {
    scale: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
    translation: BABYLON.Vector3;
  } {
    const wm = getWorldMatrix(node);
    const scale = new BABYLON.Vector3();
    const rotation = new BABYLON.Quaternion();
    const translation = new BABYLON.Vector3();
    wm.decompose(scale, rotation, translation);
    return { scale, rotation, translation };
  }

  /**
   * Sample world-space points from a mesh's vertices (optionally strided) for point-cloud operations.
   */
  export function sampleMeshWorldPoints(
    mesh: BABYLON.AbstractMesh,
    options: { stride?: number; maxPoints?: number } = {}
  ): BABYLON.Vector3[] {
    const stride = Math.max(1, options.stride ?? 1);
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!positions || positions.length === 0) return [];

    const wm = getWorldMatrix(mesh);
    const points: BABYLON.Vector3[] = [];
    for (let i = 0; i < positions.length; i += 3 * stride) {
      const p = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]),
        wm
      );
      points.push(p);
      if (options.maxPoints && points.length >= options.maxPoints) break;
    }
    return points;
  }

  /**
   * Sample local-space points from a mesh's vertices (optionally strided).
   * Returns points in the mesh's own coordinate system (no world transform applied).
   * Use this for ICP geometry matching where parts need to be compared in their local frame.
   */
  export function sampleMeshLocalPoints(
    mesh: BABYLON.AbstractMesh,
    options: { stride?: number; maxPoints?: number } = {}
  ): BABYLON.Vector3[] {
    const stride = Math.max(1, options.stride ?? 1);
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!positions || positions.length === 0) return [];

    const points: BABYLON.Vector3[] = [];
    for (let i = 0; i < positions.length; i += 3 * stride) {
      const p = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
      points.push(p);
      if (options.maxPoints && points.length >= options.maxPoints) break;
    }
    return points;
  }

  /**
   * Returns true if a node has a tag that matches the query string (Babylon Tags).
   */
  export function nodeHasTag(node: BABYLON.Node, query: string): boolean {
    return BABYLON.Tags && BABYLON.Tags.MatchesQuery(node, query);
  }
}

export type WorldTransform = {
  matrix: BABYLON.Matrix;
  rotation: BABYLON.Quaternion;
  position: BABYLON.Vector3;
  scale: BABYLON.Vector3;
};

export function getWorldTransform(node: BABYLON.Node): WorldTransform {
  const matrix = WorldSpace.getWorldMatrix(node);
  const scale = new BABYLON.Vector3();
  const rotation = new BABYLON.Quaternion();
  const position = new BABYLON.Vector3();
  matrix.decompose(scale, rotation, position);
  return { matrix, rotation, position, scale };
}






