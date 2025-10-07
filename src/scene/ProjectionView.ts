// ProjectionView - Create 2D projections of 3D geometry onto planes
// Owner: George
// Creates "thrown view" functionality for engineering drawings

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Rendering/edgesRenderer';

export interface ProjectionViewOptions {
  sourceMesh: BABYLON.Mesh;
  targetPlane: BABYLON.Mesh;
  projectionDirection?: 'auto' | '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
  showEdges?: boolean;
  edgeColor?: BABYLON.Color3;
  edgeWidth?: number;
  flattenGeometry?: boolean; // If true, creates actual flattened mesh
}

export interface ProjectionViewResult {
  projectedMesh: BABYLON.Mesh;
  cleanup: () => void;
}

/**
 * ProjectionView - Creates 2D orthographic projections of 3D geometry
 *
 * Simple approach: Clone mesh, flatten transform onto target plane, add edge rendering
 * Future: GPU-based depth buffer method for higher quality
 */
export class ProjectionView {
  /**
   * Create a projection view of a mesh onto a plane
   */
  static create(options: ProjectionViewOptions): ProjectionViewResult {
    const {
      sourceMesh,
      targetPlane,
      projectionDirection = 'auto',
      showEdges = true,
      edgeColor = new BABYLON.Color3(0, 0, 0),
      edgeWidth = 2,
      flattenGeometry = true,
    } = options;

    const scene = sourceMesh.getScene();

    // 1. Clone the source mesh
    const projectedMesh = sourceMesh.clone(
      `${sourceMesh.name}_projection`,
      null,
      false,
      false
    );

    if (!projectedMesh) {
      throw new Error('Failed to clone mesh for projection');
    }

    // 2. Calculate projection direction from plane normal
    const planeNormal = this.getPlaneNormal(targetPlane, projectionDirection);
    const planePosition = targetPlane.position.clone();

    // 3. Apply projection transform (flatten mesh onto plane)
    if (flattenGeometry) {
      this.flattenMeshOntoPlane(projectedMesh, planeNormal, planePosition);
    } else {
      // Simple approach: just position at plane
      projectedMesh.position = planePosition.clone();
    }

    // 4. Add edge rendering for technical drawing appearance
    if (showEdges) {
      projectedMesh.enableEdgesRendering();
      projectedMesh.edgesWidth = edgeWidth * 2; // Make edges more visible
      projectedMesh.edgesColor = new BABYLON.Color4(
        edgeColor.r,
        edgeColor.g,
        edgeColor.b,
        1.0
      );
    }

    // 5. Make the mesh transparent to show only edges (technical drawing style)
    const projectionMaterial = new BABYLON.StandardMaterial(
      `${projectedMesh.name}_material`,
      scene
    );
    projectionMaterial.alpha = 0; // Fully transparent - only edges visible
    projectionMaterial.disableLighting = true;
    projectedMesh.material = projectionMaterial;

    // Ensure mesh renders with transparency
    projectedMesh.visibility = 0; // Hide the mesh, show only edges

    // Cleanup function
    const cleanup = () => {
      if (projectedMesh.material) {
        projectedMesh.material.dispose();
      }
      projectedMesh.dispose();
    };

    return {
      projectedMesh,
      cleanup,
    };
  }

  /**
   * Get the normal vector of a plane mesh
   */
  private static getPlaneNormal(
    plane: BABYLON.Mesh,
    direction: ProjectionViewOptions['projectionDirection']
  ): BABYLON.Vector3 {
    // Auto-detect from plane's orientation
    if (direction === 'auto') {
      // Get plane's up vector (local Y-axis transformed to world space)
      const worldMatrix = plane.computeWorldMatrix(true);
      const localUp = new BABYLON.Vector3(0, 1, 0);
      const worldNormal = BABYLON.Vector3.TransformNormal(localUp, worldMatrix);
      return worldNormal.normalize();
    }

    // Manual direction specified
    switch (direction) {
      case '+x': return new BABYLON.Vector3(1, 0, 0);
      case '-x': return new BABYLON.Vector3(-1, 0, 0);
      case '+y': return new BABYLON.Vector3(0, 1, 0);
      case '-y': return new BABYLON.Vector3(0, -1, 0);
      case '+z': return new BABYLON.Vector3(0, 0, 1);
      case '-z': return new BABYLON.Vector3(0, 0, -1);
      default: return new BABYLON.Vector3(0, 1, 0);
    }
  }

  /**
   * Flatten mesh geometry onto a plane by projecting vertices
   */
  private static flattenMeshOntoPlane(
    mesh: BABYLON.Mesh,
    planeNormal: BABYLON.Vector3,
    planePosition: BABYLON.Vector3
  ): void {
    // Get vertex data
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!positions) {
      console.warn('Mesh has no position data, skipping flattening');
      return;
    }

    // Compute world matrix to get world-space vertex positions
    const worldMatrix = mesh.computeWorldMatrix(true);

    // Project each vertex onto the plane
    const newPositions = new Float32Array(positions.length);

    for (let i = 0; i < positions.length; i += 3) {
      // Get vertex in local space
      const localVertex = new BABYLON.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      );

      // Transform to world space
      const worldVertex = BABYLON.Vector3.TransformCoordinates(
        localVertex,
        worldMatrix
      );

      // Project onto plane
      // Formula: projectedPoint = point - dot(point - planePoint, normal) * normal
      const toPoint = worldVertex.subtract(planePosition);
      const distance = BABYLON.Vector3.Dot(toPoint, planeNormal);
      const projectedWorld = worldVertex.subtract(
        planeNormal.scale(distance)
      );

      // For now, keep in local space (since we're modifying the mesh's vertex data)
      // Transform back to local space
      const inverseWorld = worldMatrix.clone().invert();
      const projectedLocal = BABYLON.Vector3.TransformCoordinates(
        projectedWorld,
        inverseWorld
      );

      newPositions[i] = projectedLocal.x;
      newPositions[i + 1] = projectedLocal.y;
      newPositions[i + 2] = projectedLocal.z;
    }

    // Update mesh with flattened vertices
    mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, newPositions);

    // Recalculate normals after flattening
    const indices = mesh.getIndices();
    if (indices) {
      BABYLON.VertexData.ComputeNormals(
        newPositions,
        indices,
        mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind) || []
      );
    }

    // Move mesh to plane position
    mesh.position = planePosition.clone();
  }

  /**
   * Create orthographic projection view (standard engineering views)
   * Convenience method for creating top/front/side views
   */
  static createOrthographicView(
    sourceMesh: BABYLON.Mesh,
    targetPlane: BABYLON.Mesh,
    view: 'top' | 'front' | 'side' | 'back' | 'left' | 'right'
  ): ProjectionViewResult {
    // Map view names to projection directions
    // Note: kinetiCORE uses Y-up internally (Babylon native)
    const directionMap: Record<typeof view, ProjectionViewOptions['projectionDirection']> = {
      top: '-y',      // Top view: project down onto XZ plane
      front: '+z',    // Front view: project forward onto XY plane
      side: '+x',     // Right side view
      back: '-z',     // Back view
      left: '-x',     // Left side view
      right: '+x',    // Right side view
    };

    return this.create({
      sourceMesh,
      targetPlane,
      projectionDirection: directionMap[view],
      showEdges: true,
      edgeColor: new BABYLON.Color3(0, 0, 0),
      edgeWidth: 2,
      flattenGeometry: true,
    });
  }
}
