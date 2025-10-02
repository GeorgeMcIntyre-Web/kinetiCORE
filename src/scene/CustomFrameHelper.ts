// CustomFrameHelper - Detects mesh features and calculates coordinate frames
// Owner: George

import * as BABYLON from '@babylonjs/core';
import type { CustomFrameFeature, CustomFrameFeatureType } from '../core/types';
import { babylonToUser, userToBabylon } from '../core/CoordinateSystem';

export class CustomFrameHelper {
  /**
   * Calculate coordinate frame for object origin
   */
  static calculateObjectFrame(mesh: BABYLON.Mesh, nodeId: string): CustomFrameFeature {
    const worldMatrix = mesh.computeWorldMatrix(true);
    const position = BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Zero(), worldMatrix);

    // Get rotation from world matrix
    const rotation = new BABYLON.Quaternion();
    worldMatrix.decompose(undefined, rotation, undefined);

    const xAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Right(), worldMatrix).normalize();
    const yAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Up(), worldMatrix).normalize();
    const zAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Forward(), worldMatrix).normalize();

    return {
      featureType: 'object',
      nodeId,
      origin: babylonToUser(position),
      xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
      yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
      zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z },
    };
  }

  /**
   * Calculate coordinate frame for a face
   * Origin: face center
   * Z-axis: face normal
   * X/Y-axis: tangent to face
   */
  static calculateFaceFrame(
    mesh: BABYLON.Mesh,
    nodeId: string,
    faceIndex: number
  ): CustomFrameFeature | null {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);

    if (!positions || !indices || !normals || faceIndex * 3 + 2 >= indices.length) {
      return null;
    }

    const worldMatrix = mesh.computeWorldMatrix(true);

    // Get triangle vertices
    const i0 = indices[faceIndex * 3];
    const i1 = indices[faceIndex * 3 + 1];
    const i2 = indices[faceIndex * 3 + 2];

    const v0 = new BABYLON.Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const v1 = new BABYLON.Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const v2 = new BABYLON.Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

    // Calculate face center
    const center = v0.add(v1).add(v2).scale(1 / 3);
    const worldCenter = BABYLON.Vector3.TransformCoordinates(center, worldMatrix);

    // Get face normal (average of vertex normals)
    const n0 = new BABYLON.Vector3(normals[i0 * 3], normals[i0 * 3 + 1], normals[i0 * 3 + 2]);
    const n1 = new BABYLON.Vector3(normals[i1 * 3], normals[i1 * 3 + 1], normals[i1 * 3 + 2]);
    const n2 = new BABYLON.Vector3(normals[i2 * 3], normals[i2 * 3 + 1], normals[i2 * 3 + 2]);
    const normal = n0.add(n1).add(n2).scale(1 / 3).normalize();

    // Transform normal to world space
    const worldNormal = BABYLON.Vector3.TransformNormal(normal, worldMatrix).normalize();

    // Create tangent axes
    const edge1 = v1.subtract(v0).normalize();
    const worldEdge1 = BABYLON.Vector3.TransformNormal(edge1, worldMatrix).normalize();

    // X-axis along first edge (projected onto face plane)
    const xAxis = worldEdge1.subtract(worldNormal.scale(BABYLON.Vector3.Dot(worldEdge1, worldNormal)))
      .normalize();

    // Y-axis perpendicular to both
    const yAxis = BABYLON.Vector3.Cross(worldNormal, xAxis).normalize();

    return {
      featureType: 'face',
      nodeId,
      faceIndex,
      origin: babylonToUser(worldCenter),
      xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
      yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
      zAxis: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
    };
  }

  /**
   * Calculate coordinate frame for an edge
   * Origin: edge midpoint
   * X-axis: along edge
   * Z-axis: average of adjacent face normals
   * Y-axis: perpendicular
   */
  static calculateEdgeFrame(
    mesh: BABYLON.Mesh,
    nodeId: string,
    vertexIndex1: number,
    vertexIndex2: number
  ): CustomFrameFeature | null {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);

    if (!positions || !normals) return null;

    const worldMatrix = mesh.computeWorldMatrix(true);

    // Get edge vertices
    const v1 = new BABYLON.Vector3(
      positions[vertexIndex1 * 3],
      positions[vertexIndex1 * 3 + 1],
      positions[vertexIndex1 * 3 + 2]
    );
    const v2 = new BABYLON.Vector3(
      positions[vertexIndex2 * 3],
      positions[vertexIndex2 * 3 + 1],
      positions[vertexIndex2 * 3 + 2]
    );

    // Edge midpoint
    const midpoint = v1.add(v2).scale(0.5);
    const worldMidpoint = BABYLON.Vector3.TransformCoordinates(midpoint, worldMatrix);

    // X-axis along edge
    const edgeDir = v2.subtract(v1).normalize();
    const worldEdgeDir = BABYLON.Vector3.TransformNormal(edgeDir, worldMatrix).normalize();

    // Z-axis from average of vertex normals
    const n1 = new BABYLON.Vector3(
      normals[vertexIndex1 * 3],
      normals[vertexIndex1 * 3 + 1],
      normals[vertexIndex1 * 3 + 2]
    );
    const n2 = new BABYLON.Vector3(
      normals[vertexIndex2 * 3],
      normals[vertexIndex2 * 3 + 1],
      normals[vertexIndex2 * 3 + 2]
    );
    const avgNormal = n1.add(n2).scale(0.5).normalize();
    const worldNormal = BABYLON.Vector3.TransformNormal(avgNormal, worldMatrix).normalize();

    // Y-axis perpendicular
    const yAxis = BABYLON.Vector3.Cross(worldNormal, worldEdgeDir).normalize();

    return {
      featureType: 'edge',
      nodeId,
      edgeVertices: [vertexIndex1, vertexIndex2],
      origin: babylonToUser(worldMidpoint),
      xAxis: { x: worldEdgeDir.x, y: worldEdgeDir.y, z: worldEdgeDir.z },
      yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
      zAxis: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
    };
  }

  /**
   * Calculate coordinate frame for a vertex/corner
   * Origin: vertex position
   * Z-axis: vertex normal
   * X/Y-axis: tangent to surface
   */
  static calculateVertexFrame(
    mesh: BABYLON.Mesh,
    nodeId: string,
    vertexIndex: number
  ): CustomFrameFeature | null {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);

    if (!positions || !normals) return null;

    const worldMatrix = mesh.computeWorldMatrix(true);

    // Get vertex position
    const vertex = new BABYLON.Vector3(
      positions[vertexIndex * 3],
      positions[vertexIndex * 3 + 1],
      positions[vertexIndex * 3 + 2]
    );
    const worldVertex = BABYLON.Vector3.TransformCoordinates(vertex, worldMatrix);

    // Get vertex normal
    const normal = new BABYLON.Vector3(
      normals[vertexIndex * 3],
      normals[vertexIndex * 3 + 1],
      normals[vertexIndex * 3 + 2]
    ).normalize();
    const worldNormal = BABYLON.Vector3.TransformNormal(normal, worldMatrix).normalize();

    // Create arbitrary perpendicular axes
    let xAxis: BABYLON.Vector3;
    if (Math.abs(worldNormal.x) < 0.9) {
      xAxis = BABYLON.Vector3.Cross(worldNormal, BABYLON.Vector3.Right()).normalize();
    } else {
      xAxis = BABYLON.Vector3.Cross(worldNormal, BABYLON.Vector3.Up()).normalize();
    }

    const yAxis = BABYLON.Vector3.Cross(worldNormal, xAxis).normalize();

    return {
      featureType: 'vertex',
      nodeId,
      vertexIndex,
      origin: babylonToUser(worldVertex),
      xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
      yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
      zAxis: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
    };
  }

  /**
   * Find closest face to a pick point on mesh
   */
  static findClosestFace(mesh: BABYLON.Mesh, pickPoint: BABYLON.Vector3): number | null {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();

    if (!positions || !indices) return null;

    const worldMatrix = mesh.computeWorldMatrix(true);
    let closestFaceIndex = -1;
    let closestDistance = Infinity;

    const faceCount = indices.length / 3;
    for (let i = 0; i < faceCount; i++) {
      const i0 = indices[i * 3];
      const i1 = indices[i * 3 + 1];
      const i2 = indices[i * 3 + 2];

      const v0 = new BABYLON.Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
      const v1 = new BABYLON.Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
      const v2 = new BABYLON.Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

      const center = v0.add(v1).add(v2).scale(1 / 3);
      const worldCenter = BABYLON.Vector3.TransformCoordinates(center, worldMatrix);

      const distance = BABYLON.Vector3.Distance(worldCenter, pickPoint);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestFaceIndex = i;
      }
    }

    return closestFaceIndex >= 0 ? closestFaceIndex : null;
  }

  /**
   * Find closest edge to a pick point on mesh
   */
  static findClosestEdge(
    mesh: BABYLON.Mesh,
    pickPoint: BABYLON.Vector3
  ): [number, number] | null {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();

    if (!positions || !indices) return null;

    const worldMatrix = mesh.computeWorldMatrix(true);
    let closestEdge: [number, number] | null = null;
    let closestDistance = Infinity;

    const edges = new Map<string, [number, number]>();

    // Build edge list (avoiding duplicates)
    const faceCount = indices.length / 3;
    for (let i = 0; i < faceCount; i++) {
      const i0 = indices[i * 3];
      const i1 = indices[i * 3 + 1];
      const i2 = indices[i * 3 + 2];

      const addEdge = (a: number, b: number) => {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!edges.has(key)) {
          edges.set(key, [a, b]);
        }
      };

      addEdge(i0, i1);
      addEdge(i1, i2);
      addEdge(i2, i0);
    }

    // Find closest edge
    edges.forEach(([v1, v2]) => {
      const p1 = new BABYLON.Vector3(positions[v1 * 3], positions[v1 * 3 + 1], positions[v1 * 3 + 2]);
      const p2 = new BABYLON.Vector3(positions[v2 * 3], positions[v2 * 3 + 1], positions[v2 * 3 + 2]);

      const worldP1 = BABYLON.Vector3.TransformCoordinates(p1, worldMatrix);
      const worldP2 = BABYLON.Vector3.TransformCoordinates(p2, worldMatrix);

      const midpoint = worldP1.add(worldP2).scale(0.5);
      const distance = BABYLON.Vector3.Distance(midpoint, pickPoint);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestEdge = [v1, v2];
      }
    });

    return closestEdge;
  }

  /**
   * Find closest vertex to a pick point on mesh
   */
  static findClosestVertex(mesh: BABYLON.Mesh, pickPoint: BABYLON.Vector3): number | null {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

    if (!positions) return null;

    const worldMatrix = mesh.computeWorldMatrix(true);
    let closestVertexIndex = -1;
    let closestDistance = Infinity;

    const vertexCount = positions.length / 3;
    for (let i = 0; i < vertexCount; i++) {
      const vertex = new BABYLON.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      const worldVertex = BABYLON.Vector3.TransformCoordinates(vertex, worldMatrix);

      const distance = BABYLON.Vector3.Distance(worldVertex, pickPoint);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestVertexIndex = i;
      }
    }

    return closestVertexIndex >= 0 ? closestVertexIndex : null;
  }
}
