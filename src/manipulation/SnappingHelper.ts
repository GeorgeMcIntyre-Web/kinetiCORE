// Snapping Helper - Provides comprehensive snapping functionality
// Owner: George (core logic) + Cole (3D integration)
// Handles grid, vertex, edge, face, and center snapping

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../scene/SceneManager';

export interface SnapResult {
  snapped: boolean;
  position: BABYLON.Vector3;
  snapType?: 'grid' | 'vertex' | 'edge' | 'face' | 'center' | 'object' | 'midpoint' |
             'intersection' | 'perpendicular' | 'tangent' | 'along' | 'normal' |
             'plane' | 'axis' | 'curve' | 'surface' | 'objectToVertex' | 'pointOnEdge' |
             'bboxCorner';
  targetMeshName?: string;
  visualFeedback?: BABYLON.Vector3[]; // Points to visualize snap indicators
}

export interface SnapSettings {
  enabled: boolean;
  snapToGrid: boolean;
  snapToVertex: boolean;
  snapToEdge: boolean;
  snapToFace: boolean;
  snapToCenter: boolean;
  snapToObject: boolean;
  snapToMidpoint: boolean;
  snapToIntersection: boolean;
  snapToPerpendicular: boolean;
  snapToTangent: boolean;
  snapAlong: boolean;
  snapToNormal: boolean;
  snapToPlane: boolean;
  snapToAxis: boolean;
  snapToCurve: boolean;
  snapToSurface: boolean;
  snapObjectToVertex: boolean;
  snapPointOnEdge: boolean;
  snapBBoxCorner: boolean;
  gridSize: number; // mm
  snapDistance: number; // mm
}

export class SnappingHelper {
  private static instance: SnappingHelper;
  private snapIndicators: BABYLON.Mesh[] = [];
  private previewIndicator: BABYLON.Mesh | null = null;

  private constructor() {}

  static getInstance(): SnappingHelper {
    if (!SnappingHelper.instance) {
      SnappingHelper.instance = new SnappingHelper();
    }
    return SnappingHelper.instance;
  }

  /**
   * Attempt to snap a position based on settings
   * @param position - World space position to snap from
   * @param settings - Snap settings
   * @param excludeMeshIds - Mesh IDs to exclude from snapping
   * @param camera - Optional camera for screen-space distance calculation (for preview)
   * @param screenSpacePixels - Optional screen-space pixel threshold (for preview)
   */
  snapPosition(
    position: BABYLON.Vector3,
    settings: SnapSettings,
    excludeMeshIds: string[] = [],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    if (!settings.enabled) {
      return { snapped: false, position: position.clone() };
    }

    // Try snapping in order of priority
    let result: SnapResult | null = null;

    // 1. Vertex snapping (highest priority - most precise)
    if (settings.snapToVertex) {
      result = this.snapToVertex(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) return result;
    }

    // 2. Midpoint snapping
    if (settings.snapToMidpoint) {
      result = this.snapToMidpoint(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 3. Edge snapping
    if (settings.snapToEdge) {
      result = this.snapToEdge(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 4. Intersection snapping
    if (settings.snapToIntersection) {
      result = this.snapToIntersection(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 4.5. Perpendicular snapping
    if (settings.snapToPerpendicular) {
      result = this.snapToPerpendicular(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 4.6. Tangent snapping
    if (settings.snapToTangent) {
      result = this.snapToTangent(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 5. Face snapping
    if (settings.snapToFace) {
      result = this.snapToFace(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 6. Normal snapping
    if (settings.snapToNormal) {
      result = this.snapToNormal(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 7. Center snapping (circle centers)
    if (settings.snapToCenter) {
      result = this.snapToCenter(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) return result;
    }

    // 8. BBox corner snapping
    if (settings.snapBBoxCorner) {
      result = this.snapBBoxCorner(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 9. Object snapping (bounding box centers)
    if (settings.snapToObject) {
      result = this.snapToObject(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 10. Surface contact snapping
    if (settings.snapToSurface) {
      result = this.snapToSurface(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 11. Object to vertex snapping
    if (settings.snapObjectToVertex) {
      result = this.snapObjectToVertex(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 12. Point on edge snapping
    if (settings.snapPointOnEdge) {
      result = this.snapPointOnEdge(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 12.5. Along snapping (snap along a direction/axis)
    if (settings.snapAlong) {
      result = this.snapAlong(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 12.6. Plane snapping
    if (settings.snapToPlane) {
      result = this.snapToPlane(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 12.7. Axis snapping
    if (settings.snapToAxis) {
      result = this.snapToAxis(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 12.8. Curve snapping
    if (settings.snapToCurve) {
      result = this.snapToCurve(position, settings.snapDistance, excludeMeshIds);
      if (result.snapped) return result;
    }

    // 13. Grid snapping (lowest priority - fallback)
    if (settings.snapToGrid) {
      result = this.snapToGrid(position, settings.gridSize);
      if (result.snapped) return result;
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to grid
   */
  private snapToGrid(position: BABYLON.Vector3, gridSize: number): SnapResult {
    // Convert grid size from mm to meters (Babylon units)
    const gridSizeMeters = gridSize / 1000;

    const snappedPos = new BABYLON.Vector3(
      Math.round(position.x / gridSizeMeters) * gridSizeMeters,
      Math.round(position.y / gridSizeMeters) * gridSizeMeters,
      Math.round(position.z / gridSizeMeters) * gridSizeMeters
    );

    return {
      snapped: true,
      position: snappedPos,
      snapType: 'grid',
    };
  }

  /**
   * Snap to nearest vertex
   * @param position - World space position to snap from
   * @param snapDistance - Snap distance in mm (world space)
   * @param excludeMeshIds - Mesh IDs to exclude from snapping
   * @param camera - Optional camera for screen-space distance calculation
   * @param screenSpacePixels - Optional screen-space pixel threshold (if provided, uses this instead of world-space distance)
   */
  private snapToVertex(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    
    // Convert position to screen space if camera and screen-space threshold provided
    let screenPos: { x: number; y: number } | null = null;
    if (camera && screenSpacePixels !== undefined) {
      const worldMatrix = scene.getTransformMatrix();
      const viewport = camera.viewport.toGlobal(
        scene.getEngine().getRenderWidth(),
        scene.getEngine().getRenderHeight()
      );
      const projected = BABYLON.Vector3.Project(
        position,
        worldMatrix,
        camera.getProjectionMatrix(),
        viewport
      );
      screenPos = { x: projected.x, y: projected.y };
    }
    let closestVertex: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity; // Start with Infinity, not snapDistanceMeters - we want to find the closest regardless
    let closestMeshName = '';
    
    // Debug: Track statistics
    let meshesChecked = 0;
    let meshesWithVertices = 0;
    let totalVerticesChecked = 0;
    let uniqueVerticesCount = 0;
    let verticesWithinRange = 0;
    const debugDistances: number[] = [];

    // Check all meshes in the scene (including instances)
    // Use getActiveMeshes() to get all visible meshes including instances
    const activeMeshes = scene.getActiveMeshes();
    const allMeshes = new Set<BABYLON.Mesh>();
    
    // Add all scene meshes
    for (const mesh of scene.meshes) {
      if (mesh instanceof BABYLON.Mesh) {
        allMeshes.add(mesh);
        // Also add instances
        if (mesh.instances) {
          for (const instance of mesh.instances) {
            allMeshes.add(instance);
          }
        }
      }
    }
    
    // Also check active meshes
    for (const mesh of activeMeshes.data) {
      if (mesh instanceof BABYLON.Mesh) {
        allMeshes.add(mesh);
      }
    }

    for (const mesh of allMeshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snap') ||
        mesh.name.startsWith('measurement') ||
        mesh.name.startsWith('transform_label')
      ) {
        continue;
      }

      meshesChecked++;
      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (!positions || positions.length === 0) continue;

      meshesWithVertices++;
      const vertexCount = positions.length / 3;

      // Performance optimization: Skip very large meshes for preview (but still check during actual drag)
      // For meshes with > 10,000 vertices, we could use bounding box corners instead
      // But for now, we'll check all vertices - the deduplication helps significantly
      const MAX_VERTICES_FOR_PREVIEW = 50000; // Skip meshes with more than 50k vertices for preview
      if (vertexCount > MAX_VERTICES_FOR_PREVIEW) {
        // For very large meshes, we could use bounding box corners as snap points
        // But for now, skip them in preview to maintain performance
        continue;
      }

      // Transform vertices to world space
      // For instances, use the instance's world matrix
      const worldMatrix = mesh.computeWorldMatrix(true);

      // Deduplicate vertices by position (many meshes have duplicate vertices at same position)
      // Use a Map with position-based keys to avoid checking duplicate positions
      // Tolerance: How close vertices must be to be considered "the same"
      // 0.1mm is very strict (good for precision), but 0.5-1mm is also safe for most CAD models
      // Higher values merge more vertices, which is fine if they're truly at the same geometric position
      const vertexTolerance = 0.0005; // 0.5mm tolerance - safe for most CAD models, handles floating point precision
      const uniqueVertices = new Map<string, BABYLON.Vector3>();
      
      // First pass: collect all vertices and transform to world space
      for (let i = 0; i < positions.length; i += 3) {
        totalVerticesChecked++;
        const localVertex = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        const worldVertex = BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix);
        
        // Create a key based on rounded position to deduplicate
        // Round to 0.1mm precision to group vertices at the same position
        const key = `${Math.round(worldVertex.x / vertexTolerance)},${Math.round(worldVertex.y / vertexTolerance)},${Math.round(worldVertex.z / vertexTolerance)}`;
        
        // Only keep the first vertex at this position (or update if this one is closer to our target)
        if (!uniqueVertices.has(key)) {
          uniqueVertices.set(key, worldVertex);
        } else {
          // If we already have a vertex at this position, keep the one closer to our target
          const existing = uniqueVertices.get(key)!;
          const existingDist = BABYLON.Vector3.Distance(position, existing);
          const currentDist = BABYLON.Vector3.Distance(position, worldVertex);
          if (currentDist < existingDist) {
            uniqueVertices.set(key, worldVertex);
          }
        }
      }
      
      // Second pass: check only unique vertices for snapping
      uniqueVerticesCount += uniqueVertices.size;
      
      // Debug: log first few unique vertices and distances (only occasionally to avoid spam)
      if (meshesChecked === 1 && uniqueVertices.size > 0 && Math.random() < 0.01) {
        const sampleVertices = Array.from(uniqueVertices.values()).slice(0, 8);
        const sampleDistances = sampleVertices.map(v => {
          const dist = BABYLON.Vector3.Distance(position, v);
          return { vertex: `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`, distance: dist.toFixed(4) + 'm (' + (dist * 1000).toFixed(2) + 'mm)' };
        });
        console.log('[SnappingHelper] Sample unique vertices and distances:', sampleDistances);
        console.log('[SnappingHelper] Total unique vertices:', uniqueVertices.size, 'from', positions.length / 3, 'total vertices');
      }
      
      for (const worldVertex of uniqueVertices.values()) {
        let distance: number;
        let withinRange = false;
        
        // Use screen-space distance if camera and threshold provided (more accurate for preview)
        if (camera && screenSpacePixels !== undefined && screenPos) {
          const worldMatrix = scene.getTransformMatrix();
          const viewport = camera.viewport.toGlobal(
            scene.getEngine().getRenderWidth(),
            scene.getEngine().getRenderHeight()
          );
          const projected = BABYLON.Vector3.Project(
            worldVertex,
            worldMatrix,
            camera.getProjectionMatrix(),
            viewport
          );
          const screenDist = Math.sqrt(
            Math.pow(projected.x - screenPos.x, 2) + 
            Math.pow(projected.y - screenPos.y, 2)
          );
          distance = BABYLON.Vector3.Distance(position, worldVertex); // Keep world distance for tracking
          withinRange = screenDist <= screenSpacePixels;
        } else {
          // Use world-space distance (for actual snapping during drag)
          distance = BABYLON.Vector3.Distance(position, worldVertex);
          withinRange = distance < snapDistanceMeters;
        }
        
        // Track all distances for debugging (limit to avoid spam)
        if (debugDistances.length < 20) {
          debugDistances.push(distance);
        }
        
        if (withinRange) {
          verticesWithinRange++;
        }
        
        // Always track the closest vertex, regardless of snap distance
        if (distance < closestDistance) {
          closestDistance = distance;
          closestVertex = worldVertex;
          closestMeshName = mesh.name;
        }
      }
    }

    // Determine if we should snap based on the method used
    let shouldSnap = false;
    if (closestVertex) {
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Check screen-space distance for preview
        const worldMatrix = scene.getTransformMatrix();
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestVertex,
          worldMatrix,
          camera.getProjectionMatrix(),
          viewport
        );
        const screenDist = Math.sqrt(
          Math.pow(projected.x - screenPos.x, 2) + 
          Math.pow(projected.y - screenPos.y, 2)
        );
        shouldSnap = screenDist <= screenSpacePixels;
      } else {
        // Check world-space distance for actual snapping
        shouldSnap = closestDistance <= snapDistanceMeters;
      }
    }
    
    // Debug logging (only when snapping, occasionally)
    if (shouldSnap && closestVertex && Math.random() < 0.1) {
      console.log(`[SnappingHelper] ✅ Snapping to vertex at: (${closestVertex.x.toFixed(3)}, ${closestVertex.y.toFixed(3)}, ${closestVertex.z.toFixed(3)})`);
    }
    
    if (closestVertex && shouldSnap) {
      return {
        snapped: true,
        position: closestVertex,
        snapType: 'vertex',
        targetMeshName: closestMeshName,
        visualFeedback: [closestVertex],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to nearest edge
   */
  private snapToEdge(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestPoint: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    // Check all meshes in the scene
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name === 'gridOverlay'
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (!positions || !indices) continue;

      const worldMatrix = mesh.computeWorldMatrix(true);

      // Check each edge (triangle edge)
      for (let i = 0; i < indices.length; i += 3) {
        const idx1 = indices[i] * 3;
        const idx2 = indices[i + 1] * 3;
        const idx3 = indices[i + 2] * 3;

        const edges = [
          [idx1, idx2],
          [idx2, idx3],
          [idx3, idx1],
        ];

        for (const [start, end] of edges) {
          const v1 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[start], positions[start + 1], positions[start + 2]),
            worldMatrix
          );
          const v2 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[end], positions[end + 1], positions[end + 2]),
            worldMatrix
          );

          // Find closest point on edge
          const edgeDir = v2.subtract(v1);
          const edgeLength = edgeDir.length();
          edgeDir.normalize();

          const toPoint = position.subtract(v1);
          const t = BABYLON.Vector3.Dot(toPoint, edgeDir);
          const clampedT = Math.max(0, Math.min(edgeLength, t));

          const closestOnEdge = v1.add(edgeDir.scale(clampedT));
          const distance = BABYLON.Vector3.Distance(position, closestOnEdge);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = closestOnEdge;
            closestMeshName = mesh.name;
          }
        }
      }
    }

    if (closestPoint) {
      return {
        snapped: true,
        position: closestPoint,
        snapType: 'edge',
        targetMeshName: closestMeshName,
        visualFeedback: [closestPoint],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to nearest face
   */
  private snapToFace(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestPoint: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    // Use raycasting in 6 directions (±X, ±Y, ±Z) to find nearby faces
    const directions = [
      new BABYLON.Vector3(1, 0, 0),
      new BABYLON.Vector3(-1, 0, 0),
      new BABYLON.Vector3(0, 1, 0),
      new BABYLON.Vector3(0, -1, 0),
      new BABYLON.Vector3(0, 0, 1),
      new BABYLON.Vector3(0, 0, -1),
    ];

    for (const dir of directions) {
      const ray = new BABYLON.Ray(position, dir, snapDistanceMeters);
      const pickInfo = scene.pickWithRay(ray, (mesh) => {
        return (
          mesh.isVisible &&
          !excludeMeshIds.includes(mesh.uniqueId.toString()) &&
          mesh.name !== 'ground' &&
          mesh.name !== 'gridOverlay'
        );
      });

      if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
        const distance = BABYLON.Vector3.Distance(position, pickInfo.pickedPoint);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = pickInfo.pickedPoint;
          closestMeshName = pickInfo.pickedMesh?.name || '';
        }
      }
    }

    if (closestPoint) {
      return {
        snapped: true,
        position: closestPoint,
        snapType: 'face',
        targetMeshName: closestMeshName,
        visualFeedback: [closestPoint],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Helper: Fit a circle to a set of points and return center, radius, and normal
   * Returns null if points don't form a circle (too much variance)
   * Handles triangulated circles (like cylinder ends) by filtering out center vertices
   */
  private fitCircleToPoints(
    points: BABYLON.Vector3[],
    tolerance: number = 0.001 // 1mm tolerance for circle detection
  ): { center: BABYLON.Vector3; radius: number; normal: BABYLON.Vector3 } | null {
    if (points.length < 3) return null;

    // Calculate plane normal from first 3 points
    const v1 = points[1].subtract(points[0]);
    const v2 = points[2].subtract(points[0]);
    let normal = BABYLON.Vector3.Cross(v1, v2);
    if (normal.lengthSquared() < 0.0001) return null; // Points are collinear
    normal = normal.normalize();

    // Project all points onto the plane
    const projectedPoints: BABYLON.Vector3[] = [];
    for (const p of points) {
      const toPoint = p.subtract(points[0]);
      const distToPlane = BABYLON.Vector3.Dot(toPoint, normal);
      const projected = p.subtract(normal.scale(distToPlane));
      projectedPoints.push(projected);
    }

    // Calculate geometric center (average of projected points)
    const initialCenter = projectedPoints.reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero())
      .scale(1 / projectedPoints.length);

    // For triangulated circles (like cylinder ends), there might be a center vertex
    // Filter out points that are too close to the center (likely the center vertex)
    const radii: number[] = [];
    const perimeterPoints: BABYLON.Vector3[] = [];
    
    for (const p of projectedPoints) {
      const radius = BABYLON.Vector3.Distance(p, initialCenter);
      radii.push(radius);
    }
    const avgRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
    
    // Filter out points that are much closer to center than average (likely center vertex)
    // Keep points that are within 50% of average radius (perimeter points)
    const minRadius = avgRadius * 0.5;
    for (let i = 0; i < projectedPoints.length; i++) {
      if (radii[i] >= minRadius) {
        perimeterPoints.push(projectedPoints[i]);
      }
    }
    
    // Need at least 3 perimeter points
    if (perimeterPoints.length < 3) {
      // If filtering removed too many, use all points
      perimeterPoints.length = 0;
      perimeterPoints.push(...projectedPoints);
    }

    // Recalculate center from perimeter points only
    const center = perimeterPoints.reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero())
      .scale(1 / perimeterPoints.length);

    // Recalculate radii from perimeter points
    const perimeterRadii: number[] = [];
    for (const p of perimeterPoints) {
      const radius = BABYLON.Vector3.Distance(p, center);
      perimeterRadii.push(radius);
    }
    const finalAvgRadius = perimeterRadii.reduce((sum, r) => sum + r, 0) / perimeterRadii.length;

    // Check if all perimeter points are approximately equidistant from center (circle check)
    const radiusVariance = perimeterRadii.reduce((sum, r) => sum + Math.pow(r - finalAvgRadius, 2), 0) / perimeterRadii.length;
    const radiusStdDev = Math.sqrt(radiusVariance);
    const relativeError = finalAvgRadius > 0 ? radiusStdDev / finalAvgRadius : Infinity;

    // If relative error is too high, it's not a circle
    // Increased tolerance to 25% for triangulated circles (cylinder ends often have 15-20% error)
    if (relativeError > 0.25 || finalAvgRadius < tolerance) { // 25% tolerance, minimum 1mm radius
      return null;
    }

    return { center, radius: finalAvgRadius, normal };
  }

  /**
   * Helper: Detect if a face is approximately circular
   * Returns circle info if face is circular, null otherwise
   */
  private detectCircularFace(
    mesh: BABYLON.Mesh,
    faceIndex: number
  ): { center: BABYLON.Vector3; radius: number; normal: BABYLON.Vector3 } | null {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
    if (!positions || !indices || !normals) return null;

    const worldMatrix = mesh.computeWorldMatrix(true);

    // Get triangle vertices
    const i0 = indices[faceIndex * 3];
    const i1 = indices[faceIndex * 3 + 1];
    const i2 = indices[faceIndex * 3 + 2];

    // Get all vertices that share this face (for more complex faces, we'd need to trace connected faces)
    // For now, check if this triangle's vertices form a circle
    // In practice, for a cylinder's circular face, we need to collect all vertices of that face
    // This is a simplified version - we'll improve it by checking connected faces
    
    const v0 = BABYLON.Vector3.TransformCoordinates(
      new BABYLON.Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]),
      worldMatrix
    );
    const v1 = BABYLON.Vector3.TransformCoordinates(
      new BABYLON.Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]),
      worldMatrix
    );
    const v2 = BABYLON.Vector3.TransformCoordinates(
      new BABYLON.Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]),
      worldMatrix
    );

    // For a single triangle, check if it's approximately equilateral (could be part of a circle)
    // But we need more points - let's collect all vertices of faces that share an edge with this face
    const faceVertices = new Set<number>([i0, i1, i2]);
    const worldVertices: BABYLON.Vector3[] = [v0, v1, v2];

    // Find connected faces that share edges (for circular faces like cylinder ends)
    // This is a simplified approach - in a cylinder, the circular face has many triangles
    // We'll detect by checking if vertices form a circular pattern
    // For now, return null for single triangles - we need a better approach
    
    // Better approach: Check all faces and group by normal, then check if vertices form circles
    return null; // Will implement better detection below
  }

  /**
   * Helper: Detect circular edges (edges that form a circle)
   * Returns circle info if edges form a circle, null otherwise
   */
  private detectCircularEdges(
    mesh: BABYLON.Mesh,
    startEdgeIndex: number
  ): { center: BABYLON.Vector3; radius: number; normal: BABYLON.Vector3 } | null {
    // This would trace connected edges to see if they form a circle
    // For now, we'll use a different approach - detect circles from face vertices
    return null;
  }

  /**
   * Snap to circle center (circular faces and edges)
   * Detects circular faces (like cylinder ends) and circular edges
   */
  private snapToCenter(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestCenter: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity; // Start with Infinity to find true closest
    let closestMeshName = '';
    let closestRadius = 0;
    let closestNormal: BABYLON.Vector3 | null = null;

    // Get screen position for screen-space distance checking
    let screenPos: BABYLON.Vector2 | null = null;
    if (camera && screenSpacePixels !== undefined) {
      const worldMatrix = scene.getTransformMatrix();
      const viewport = camera.viewport.toGlobal(
        scene.getEngine().getRenderWidth(),
        scene.getEngine().getRenderHeight()
      );
      const projected = BABYLON.Vector3.Project(
        position,
        worldMatrix,
        camera.getProjectionMatrix(),
        viewport
      );
      screenPos = new BABYLON.Vector2(projected.x, projected.y);
    }

    // Track detected circles to avoid duplicates
    const circleMap = new Map<string, { center: BABYLON.Vector3; radius: number; normal: BABYLON.Vector3; meshName: string }>();

    // Check all meshes for circular faces
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snapIndicator') ||
        mesh.name.startsWith('snapPreviewDot') ||
        mesh.name.startsWith('snapPreviewCircle') || // Exclude preview ring from detection
        mesh.name.startsWith('marker-') ||
        mesh.name.startsWith('distance-line') ||
        mesh.name.startsWith('angle-line')
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
      if (!positions || !indices || !normals) continue;

      const worldMatrix = mesh.computeWorldMatrix(true);

      // Group faces by normal to find circular faces (e.g., cylinder ends)
      // Faces with the same normal that form a circle
      const facesByNormal = new Map<string, number[]>();
      
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        // Get face normal
        const n0 = new BABYLON.Vector3(normals[i0 * 3], normals[i0 * 3 + 1], normals[i0 * 3 + 2]);
        const n1 = new BABYLON.Vector3(normals[i1 * 3], normals[i1 * 3 + 1], normals[i1 * 3 + 2]);
        const n2 = new BABYLON.Vector3(normals[i2 * 3], normals[i2 * 3 + 1], normals[i2 * 3 + 2]);
        const faceNormal = n0.add(n1).add(n2).scale(1/3).normalize();
        const worldNormal = BABYLON.Vector3.TransformNormal(faceNormal, worldMatrix).normalize();

        // Create a key from normal (rounded to avoid floating point issues)
        // Use coarser rounding (100 instead of 1000) to group similar normals
        const normalKey = `${Math.round(worldNormal.x * 100)},${Math.round(worldNormal.y * 100)},${Math.round(worldNormal.z * 100)}`;
        
        if (!facesByNormal.has(normalKey)) {
          facesByNormal.set(normalKey, []);
        }
        facesByNormal.get(normalKey)!.push(i / 3); // Face index
      }

      // Debug: log face grouping
      if (facesByNormal.size > 0 && Math.random() < 0.1) {
        console.log(`[SnappingHelper] CENTER: Mesh="${mesh.name}", NormalGroups=${facesByNormal.size}, TotalFaces=${indices.length / 3}`);
      }

      // For each group of faces with the same normal, check if vertices form a circle
      for (const [normalKey, faceIndices] of facesByNormal) {
        if (faceIndices.length < 3) continue; // Need at least 3 faces for a circle

        // Collect all unique vertices from these faces
        const vertexSet = new Set<number>();
        for (const faceIdx of faceIndices) {
          const baseIdx = faceIdx * 3;
          vertexSet.add(indices[baseIdx]);
          vertexSet.add(indices[baseIdx + 1]);
          vertexSet.add(indices[baseIdx + 2]);
        }

        // Get world positions of vertices
        const worldVertices: BABYLON.Vector3[] = [];
        for (const vIdx of vertexSet) {
          const v = new BABYLON.Vector3(
            positions[vIdx * 3],
            positions[vIdx * 3 + 1],
            positions[vIdx * 3 + 2]
          );
          worldVertices.push(BABYLON.Vector3.TransformCoordinates(v, worldMatrix));
        }

        // Debug: log vertex collection
        if (worldVertices.length >= 3 && Math.random() < 0.1) {
          console.log(`[SnappingHelper] CENTER: Trying to fit circle: Mesh="${mesh.name}", Vertices=${worldVertices.length}, Faces=${faceIndices.length}, NormalKey=${normalKey}`);
        }

        // Fit circle to these vertices
        const circleInfo = this.fitCircleToPoints(worldVertices);
        if (!circleInfo) {
          // Debug: log why circle fit failed (occasionally)
          if (worldVertices.length >= 3 && Math.random() < 0.05) {
            // Calculate what the fit would have been to see why it failed
            const v1 = worldVertices[1].subtract(worldVertices[0]);
            const v2 = worldVertices[2].subtract(worldVertices[0]);
            let testNormal = BABYLON.Vector3.Cross(v1, v2);
            if (testNormal.lengthSquared() > 0.0001) {
              testNormal = testNormal.normalize();
              const testCenter = worldVertices.reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero()).scale(1 / worldVertices.length);
              const testRadii = worldVertices.map(p => BABYLON.Vector3.Distance(p, testCenter));
              const testAvgRadius = testRadii.reduce((sum, r) => sum + r, 0) / testRadii.length;
              const testVariance = testRadii.reduce((sum, r) => sum + Math.pow(r - testAvgRadius, 2), 0) / testRadii.length;
              const testStdDev = Math.sqrt(testVariance);
              const testRelativeError = testAvgRadius > 0 ? testStdDev / testAvgRadius : Infinity;
              console.log(`[SnappingHelper] CENTER: Circle fit failed: relativeError=${(testRelativeError * 100).toFixed(1)}%, avgRadius=${(testAvgRadius * 1000).toFixed(2)}mm, vertices=${worldVertices.length}`);
            }
          }
          continue;
        }

        // Create a unique key for this circle (by center position, rounded)
        const centerKey = `${Math.round(circleInfo.center.x * 1000)},${Math.round(circleInfo.center.y * 1000)},${Math.round(circleInfo.center.z * 1000)}`;
        
        // Only keep the circle if it's not already detected or if this one is better
        if (!circleMap.has(centerKey) || circleInfo.radius > circleMap.get(centerKey)!.radius) {
          circleMap.set(centerKey, {
            center: circleInfo.center,
            radius: circleInfo.radius,
            normal: circleInfo.normal,
            meshName: mesh.name
          });
          // Debug: log circle detection
          console.log(`[SnappingHelper] CIRCLE DETECTED: Center=(${circleInfo.center.x.toFixed(3)}, ${circleInfo.center.y.toFixed(3)}, ${circleInfo.center.z.toFixed(3)}), Radius=${(circleInfo.radius * 1000).toFixed(2)}mm, Mesh="${mesh.name}", Vertices=${worldVertices.length}, Faces=${faceIndices.length}`);
        }
      }
    }

    // Now find the closest circle center
    for (const [key, circle] of circleMap) {
      let distance: number;
      let withinRange = false;

      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Use screen-space distance for preview
        const worldMatrix = scene.getTransformMatrix();
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          circle.center,
          worldMatrix,
          camera.getProjectionMatrix(),
          viewport
        );
        const screenDist = Math.sqrt(
          Math.pow(projected.x - screenPos.x, 2) + 
          Math.pow(projected.y - screenPos.y, 2)
        );
        distance = BABYLON.Vector3.Distance(position, circle.center); // Keep world distance for tracking
        // For circle centers, use a larger screen-space threshold (30px) since centers can be far from cursor
        // but still visible on screen (the circle itself is large)
        const centerScreenThreshold = screenSpacePixels * 2.5; // 30px for 12px default
        withinRange = screenDist <= centerScreenThreshold;
      } else {
        // Use world-space distance for actual snapping
        distance = BABYLON.Vector3.Distance(position, circle.center);
        withinRange = distance < snapDistanceMeters;
      }

      // Also check world-space distance - don't allow circles that are too far
      // For preview mode, use a larger world-space cap to allow snapping to circle centers
      // Circle centers can be far from the cursor but still visible on screen
      const maxWorldDistance = (camera && screenSpacePixels !== undefined) ? 
        1.0 : // 1 meter max for preview (allows snapping to circle centers even if far)
        snapDistanceMeters; // Use actual snap distance for real snapping
      if (distance > maxWorldDistance) {
        // Debug: log when circle is too far
        if (Math.random() < 0.05) {
          console.log(`[SnappingHelper] CENTER: Circle too far: WorldDist=${(distance * 1000).toFixed(2)}mm, Max=${(maxWorldDistance * 1000).toFixed(2)}mm`);
        }
        continue;
      }

      if (withinRange) {
        const comparisonDistance = (camera && screenSpacePixels !== undefined && screenPos) ? 
          (() => {
            const worldMatrix = scene.getTransformMatrix();
            const viewport = camera.viewport.toGlobal(
              scene.getEngine().getRenderWidth(),
              scene.getEngine().getRenderHeight()
            );
            const projected = BABYLON.Vector3.Project(
              circle.center,
              worldMatrix,
              camera.getProjectionMatrix(),
              viewport
            );
            return Math.sqrt(
              Math.pow(projected.x - screenPos.x, 2) + 
              Math.pow(projected.y - screenPos.y, 2)
            );
          })() : distance;

        // Debug: log when circle is within range
        if (Math.random() < 0.1) {
          const distMM = (distance * 1000).toFixed(2);
          const compDist = (camera && screenSpacePixels !== undefined) ? comparisonDistance.toFixed(2) + 'px' : (comparisonDistance * 1000).toFixed(2) + 'mm';
          console.log(`[SnappingHelper] CENTER: Circle within range: Center=(${circle.center.x.toFixed(3)}, ${circle.center.y.toFixed(3)}, ${circle.center.z.toFixed(3)}), WorldDist=${distMM}mm, CompDist=${compDist}, Closest=${closestDistance === Infinity ? 'Inf' : (closestDistance * 1000).toFixed(2) + 'mm'}`);
        }

        if (comparisonDistance < closestDistance) {
          closestDistance = comparisonDistance;
          closestCenter = circle.center;
          closestMeshName = circle.meshName;
          closestRadius = circle.radius;
          closestNormal = circle.normal;
        }
      } else {
        // Debug: log when circle is NOT within range
        if (Math.random() < 0.05) {
          const distMM = (distance * 1000).toFixed(2);
          const maxDistMM = (maxWorldDistance * 1000).toFixed(2);
          const screenDist = (camera && screenSpacePixels !== undefined && screenPos) ? 
            (() => {
              const worldMatrix = scene.getTransformMatrix();
              const viewport = camera.viewport.toGlobal(
                scene.getEngine().getRenderWidth(),
                scene.getEngine().getRenderHeight()
              );
              const projected = BABYLON.Vector3.Project(
                circle.center,
                worldMatrix,
                camera.getProjectionMatrix(),
                viewport
              );
              return Math.sqrt(
                Math.pow(projected.x - screenPos.x, 2) + 
                Math.pow(projected.y - screenPos.y, 2)
              );
            })() : null;
          console.log(`[SnappingHelper] CENTER: Circle NOT in range: Center=(${circle.center.x.toFixed(3)}, ${circle.center.y.toFixed(3)}, ${circle.center.z.toFixed(3)}), WorldDist=${distMM}mm, MaxWorld=${maxDistMM}mm, ScreenDist=${screenDist ? screenDist.toFixed(2) + 'px' : 'N/A'}, Threshold=${screenSpacePixels || 'N/A'}px`);
        }
      }
    }

    // Debug: log final state
    if (circleMap.size > 0) {
      console.log(`[SnappingHelper] CENTER: Found ${circleMap.size} circles, closestCenter=${!!closestCenter}, closestDistance=${closestDistance === Infinity ? 'Inf' : (closestDistance * 1000).toFixed(2) + 'mm'}`);
    }
    
    if (closestCenter && closestNormal) {
      // Debug: log center snap
      console.log(`[SnappingHelper] ✅ CENTER SNAP: Pos=(${closestCenter.x.toFixed(3)}, ${closestCenter.y.toFixed(3)}, ${closestCenter.z.toFixed(3)}), Radius=${(closestRadius * 1000).toFixed(2)}mm, Mesh="${closestMeshName}", Type=center`);
      
      // Return circle center with radius and normal for visual feedback
      // visualFeedback: [center, normal (for circle orientation), radius as Vector3(x=radius, y=0, z=0)]
      const radiusVec = new BABYLON.Vector3(closestRadius, 0, 0); // Store radius in x component
      return {
        snapped: true,
        position: closestCenter,
        snapType: 'center',
        targetMeshName: closestMeshName,
        visualFeedback: [closestCenter, closestNormal, radiusVec],
      };
    }
    
    // Debug: log if no circles found
    if (circleMap.size === 0 && Math.random() < 0.1) { // Log occasionally to avoid spam
      console.log(`[SnappingHelper] CENTER: No circles detected, Meshes checked, Position=(${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`);
    } else if (circleMap.size > 0 && !closestCenter) {
      // Debug: log if circles found but none within range
      console.log(`[SnappingHelper] CENTER: ${circleMap.size} circles detected but none within range, Position=(${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`);
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to object bounding box center
   */
  private snapToObject(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestCenter: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    // Check all meshes for their bounding box centers
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name === 'gridOverlay'
      ) {
        continue;
      }

      // Get bounding box center in world space
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();
      const boundingBox = boundingInfo.boundingBox;
      const center = boundingBox.centerWorld;

      const distance = BABYLON.Vector3.Distance(position, center);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestCenter = center;
        closestMeshName = mesh.name;
      }
    }

    if (closestCenter) {
      return {
        snapped: true,
        position: closestCenter,
        snapType: 'object',
        targetMeshName: closestMeshName,
        visualFeedback: [closestCenter],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Show visual feedback for snap point
   */
  showSnapIndicator(point: BABYLON.Vector3, color: BABYLON.Color3): void {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // Clear old indicators
    this.clearSnapIndicators();

    // Create snap point indicator (small sphere)
    const indicator = BABYLON.MeshBuilder.CreateSphere(
      'snapIndicator',
      { diameter: 0.02 },
      scene
    );
    indicator.position = point.clone();

    const mat = new BABYLON.StandardMaterial('snapMat', scene);
    mat.emissiveColor = color;
    mat.disableLighting = true;
    indicator.material = mat;

    this.snapIndicators.push(indicator);
  }

  /**
   * Clear snap indicators
   */
  clearSnapIndicators(): void {
    for (const indicator of this.snapIndicators) {
      indicator.dispose();
    }
    this.snapIndicators = [];
  }

  /**
   * Show preview dot at a position with optional snap type for different visuals
   * @param point - Position to show preview
   * @param snapType - Type of snap (vertex, midpoint, center) for different visuals
   */
  showPreviewDot(point: BABYLON.Vector3, snapType?: string): void {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) {
      console.warn('[SnappingHelper] No scene available for preview dot');
      return;
    }

    // Clear old preview
    this.clearPreviewDot();

    // Check if point is on a selected mesh (for color/size adjustment)
    // For now, default to false - we can enhance this later if needed
    const isOnSelectedMesh = false;

    let preview: BABYLON.Mesh;
    let baseColor: BABYLON.Color3;
    let size: number;

    if (snapType === 'midpoint') {
      // Midpoint: Show a line along the edge + a dot at the midpoint
      const edgeStart = (point as any).edgeStart;
      const edgeEnd = (point as any).edgeEnd;
      
      // Create dot at midpoint first
      const diameter = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewDot', { diameter }, scene);
      preview.position = point.clone();
      
      // Create line along edge if endpoints available
      if (edgeStart && edgeEnd) {
        const localStart = edgeStart.subtract(point);
        const localEnd = edgeEnd.subtract(point);
        const line = BABYLON.MeshBuilder.CreateLines('snapPreviewLine', {
          points: [localStart, localEnd],
          updatable: false
        }, scene);
        line.color = isOnSelectedMesh 
          ? new BABYLON.Color3(1, 1, 1)
          : new BABYLON.Color3(1, 0.5, 0); // Orange
        line.renderingGroupId = 1;
        line.isPickable = false;
        line.parent = preview;
      }
      
      baseColor = isOnSelectedMesh 
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(1, 0.5, 0); // Orange
      size = diameter;
    } else if (snapType === 'center') {
      // Center: Show a circle ring around circumference + a dot at center
      const circleNormal = (point as any).circleNormal;
      const circleRadius = (point as any).circleRadius;
      
      console.log(`[SnappingHelper] showPreviewDot CENTER: point=(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)}), radius=${circleRadius ? (circleRadius * 1000).toFixed(2) + 'mm' : 'undefined'}, normal=${circleNormal ? `(${circleNormal.x.toFixed(2)}, ${circleNormal.y.toFixed(2)}, ${circleNormal.z.toFixed(2)})` : 'undefined'}`);
      
      // Create dot at circle center
      const dotDiameter = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewDot', { diameter: dotDiameter }, scene);
      preview.position = point.clone();
      
      // Create circle ring if radius and normal available
      if (circleNormal && circleRadius && circleRadius > 0) {
        const ringThickness = 0.003; // 3mm
        // Torus diameter parameter is the major diameter (outer edge to outer edge)
        // So diameter = radius * 2 is correct
        const ring = BABYLON.MeshBuilder.CreateTorus('snapPreviewCircle', {
          diameter: circleRadius * 2,
          thickness: ringThickness,
          tessellation: 64
        }, scene);
        
        // Orient ring to match circle normal
        // Torus in Babylon.js: major circle lies in XZ plane, torus "normal" (through hole) is Y-axis
        // For a circle with normal (0, -1, 0), we want the ring in XZ plane
        // Default torus is already in XZ plane, but its "normal" is (0, 1, 0)
        // We need to rotate so the ring plane is perpendicular to circle normal
        
        const targetNormal = circleNormal.clone().normalize();
        
        // The ring should lie in the plane perpendicular to targetNormal
        // If targetNormal is (0, -1, 0), ring should be in XZ plane
        // Default torus is in XZ plane, so we just need to ensure it's oriented correctly
        
        // For Y-axis aligned normals, handle specially
        const yAxis = new BABYLON.Vector3(0, 1, 0);
        const dotY = BABYLON.Vector3.Dot(targetNormal, yAxis);
        
        if (Math.abs(Math.abs(dotY) - 1) < 0.001) {
          // Normal is parallel to Y-axis (up or down)
          // Torus default is in XZ plane, which is correct for Y-axis normal
          // No rotation needed - torus is already in the right plane
        } else {
          // Normal is not aligned with Y-axis - need to rotate torus
          // Rotate torus so its plane is perpendicular to targetNormal
          // Find axis perpendicular to both Y-axis and targetNormal
          const axis = BABYLON.Vector3.Cross(yAxis, targetNormal);
          if (axis.lengthSquared() > 0.0001) {
            // Angle between Y-axis and targetNormal
            const angle = Math.acos(Math.max(-1, Math.min(1, Math.abs(dotY))));
            // Rotate 90 degrees minus the angle to align ring plane with targetNormal
            ring.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), Math.PI / 2 - angle);
          }
        }
        
        ring.position = BABYLON.Vector3.Zero(); // Relative to parent (center dot)
        ring.renderingGroupId = 1;
        ring.isPickable = false;
        ring.parent = preview;
        
        const ringColor = isOnSelectedMesh 
          ? new BABYLON.Color3(1, 1, 1)
          : new BABYLON.Color3(1, 0.5, 0); // Orange
        const ringMat = new BABYLON.StandardMaterial('ringMat', scene);
        ringMat.emissiveColor = ringColor;
        ringMat.diffuseColor = ringColor;
        ringMat.disableLighting = true;
        ringMat.alpha = 1.0;
        ringMat.zOffset = -2;
        ring.material = ringMat;
        
        console.log(`[SnappingHelper] Created center preview: orange circle ring (radius=${(circleRadius * 1000).toFixed(2)}mm, normal=(${targetNormal.x.toFixed(2)}, ${targetNormal.y.toFixed(2)}, ${targetNormal.z.toFixed(2)})) + orange dot at (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`);
      } else {
        console.warn(`[SnappingHelper] Center preview missing data: radius=${circleRadius}, normal=${!!circleNormal}`);
      }
      
      baseColor = isOnSelectedMesh 
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(1, 0.5, 0); // Orange
      size = dotDiameter;
    } else {
      // Vertex (default): Yellow dot only
      const diameter = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewDot', { diameter }, scene);
      preview.position = point.clone();
      baseColor = isOnSelectedMesh 
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(1, 0.84, 0); // Gold/Yellow
      size = diameter;
    }

    preview.renderingGroupId = 1;
    preview.isVisible = true;
    preview.visibility = 1.0;

    const mat = new BABYLON.StandardMaterial('previewMat', scene);
    mat.emissiveColor = baseColor;
    mat.diffuseColor = baseColor;
    mat.disableLighting = true;
    mat.alpha = 1.0;
    mat.zOffset = -2;
    mat.backFaceCulling = false;
    preview.material = mat;

    // Add glow
    let glowLayer = scene.getGlowLayerByName('snap-preview-glow');
    if (!glowLayer) {
      glowLayer = new BABYLON.GlowLayer('snap-preview-glow', scene);
      glowLayer.intensity = 2.0;
    }
    glowLayer.intensity = isOnSelectedMesh ? 3.0 : 2.0;
    glowLayer.addIncludedOnlyMesh(preview);

    preview.alwaysSelectAsActiveMesh = true;
    preview.isPickable = false;
    this.previewIndicator = preview;
  }

  /**
   * Clear preview dot and all child meshes (lines, rings, etc.)
   */
  clearPreviewDot(): void {
    if (this.previewIndicator) {
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      if (scene) {
        const glowLayer = scene.getGlowLayerByName('snap-preview-glow');
        if (glowLayer) {
          glowLayer.removeIncludedOnlyMesh(this.previewIndicator);
        }
        
        // Dispose all child meshes (lines, rings, etc.)
        const childMeshes = this.previewIndicator.getChildMeshes();
        childMeshes.forEach(child => {
          if (glowLayer) {
            glowLayer.removeIncludedOnlyMesh(child as BABYLON.Mesh);
          }
          child.dispose();
        });
      }
      
      this.previewIndicator.dispose();
      this.previewIndicator = null;
    }
  }

  /**
   * Snap to edge midpoint
   */
  private snapToMidpoint(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestMidpoint: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name === 'gridOverlay'
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (!positions || !indices) continue;

      const worldMatrix = mesh.computeWorldMatrix(true);

      // Check each edge midpoint
      for (let i = 0; i < indices.length; i += 3) {
        const edges = [
          [indices[i] * 3, indices[i + 1] * 3],
          [indices[i + 1] * 3, indices[i + 2] * 3],
          [indices[i + 2] * 3, indices[i] * 3],
        ];

        for (const [start, end] of edges) {
          const v1 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[start], positions[start + 1], positions[start + 2]),
            worldMatrix
          );
          const v2 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[end], positions[end + 1], positions[end + 2]),
            worldMatrix
          );

          const midpoint = v1.add(v2).scale(0.5);
          const distance = BABYLON.Vector3.Distance(position, midpoint);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestMidpoint = midpoint;
            closestMeshName = mesh.name;
          }
        }
      }
    }

    if (closestMidpoint) {
      return {
        snapped: true,
        position: closestMidpoint,
        snapType: 'midpoint',
        targetMeshName: closestMeshName,
        visualFeedback: [closestMidpoint],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to edge intersection points
   */
  private snapToIntersection(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestIntersection: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    // Collect all edges from all meshes
    const allEdges: Array<{ v1: BABYLON.Vector3; v2: BABYLON.Vector3; meshName: string }> = [];

    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name === 'gridOverlay'
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (!positions || !indices) continue;

      const worldMatrix = mesh.computeWorldMatrix(true);

      for (let i = 0; i < indices.length; i += 3) {
        const edges = [
          [indices[i] * 3, indices[i + 1] * 3],
          [indices[i + 1] * 3, indices[i + 2] * 3],
          [indices[i + 2] * 3, indices[i] * 3],
        ];

        for (const [start, end] of edges) {
          const v1 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[start], positions[start + 1], positions[start + 2]),
            worldMatrix
          );
          const v2 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[end], positions[end + 1], positions[end + 2]),
            worldMatrix
          );

          allEdges.push({ v1, v2, meshName: mesh.name });
        }
      }
    }

    // Find intersections between edges (simplified 3D approach - checking closest approach)
    for (let i = 0; i < allEdges.length; i++) {
      for (let j = i + 1; j < allEdges.length; j++) {
        const edge1 = allEdges[i];
        const edge2 = allEdges[j];

        // Find closest point between two line segments
        const closestPoints = this.closestPointsBetweenSegments(
          edge1.v1,
          edge1.v2,
          edge2.v1,
          edge2.v2
        );

        if (closestPoints) {
          const { point1, point2, distance: segDistance } = closestPoints;

          // If edges are close enough to be considered intersecting
          if (segDistance < 0.001) {
            const intersectionPoint = point1.add(point2).scale(0.5);
            const distance = BABYLON.Vector3.Distance(position, intersectionPoint);

            if (distance < closestDistance) {
              closestDistance = distance;
              closestIntersection = intersectionPoint;
              closestMeshName = edge1.meshName;
            }
          }
        }
      }
    }

    if (closestIntersection) {
      return {
        snapped: true,
        position: closestIntersection,
        snapType: 'intersection',
        targetMeshName: closestMeshName,
        visualFeedback: [closestIntersection],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Find closest points between two line segments
   */
  private closestPointsBetweenSegments(
    a1: BABYLON.Vector3,
    a2: BABYLON.Vector3,
    b1: BABYLON.Vector3,
    b2: BABYLON.Vector3
  ): { point1: BABYLON.Vector3; point2: BABYLON.Vector3; distance: number } | null {
    const da = a2.subtract(a1);
    const db = b2.subtract(b1);
    const dc = b1.subtract(a1);

    const daLenSq = BABYLON.Vector3.Dot(da, da);
    const dbLenSq = BABYLON.Vector3.Dot(db, db);

    if (daLenSq < 0.0001 || dbLenSq < 0.0001) return null;

    const daDotDb = BABYLON.Vector3.Dot(da, db);
    const daDotDc = BABYLON.Vector3.Dot(da, dc);
    const dbDotDc = BABYLON.Vector3.Dot(db, dc);

    const denom = daLenSq * dbLenSq - daDotDb * daDotDb;

    let s = 0;
    let t = 0;

    if (Math.abs(denom) > 0.0001) {
      s = (daDotDb * dbDotDc - dbLenSq * daDotDc) / denom;
      t = (daLenSq * dbDotDc - daDotDb * daDotDc) / denom;
    }

    s = Math.max(0, Math.min(1, s));
    t = Math.max(0, Math.min(1, t));

    const point1 = a1.add(da.scale(s));
    const point2 = b1.add(db.scale(t));
    const distance = BABYLON.Vector3.Distance(point1, point2);

    return { point1, point2, distance };
  }

  /**
   * Snap to face normal direction
   */
  private snapToNormal(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;

    // Cast rays in 6 directions to find nearby faces
    const directions = [
      new BABYLON.Vector3(1, 0, 0),
      new BABYLON.Vector3(-1, 0, 0),
      new BABYLON.Vector3(0, 1, 0),
      new BABYLON.Vector3(0, -1, 0),
      new BABYLON.Vector3(0, 0, 1),
      new BABYLON.Vector3(0, 0, -1),
    ];

    let closestPoint: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    for (const dir of directions) {
      const ray = new BABYLON.Ray(position, dir, snapDistanceMeters);
      const pickInfo = scene.pickWithRay(ray, (mesh) => {
        return (
          mesh.isVisible &&
          !excludeMeshIds.includes(mesh.uniqueId.toString()) &&
          mesh.name !== 'ground' &&
          mesh.name !== 'gridOverlay'
        );
      });

      if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
        const normal = pickInfo.getNormal(true);
        if (normal) {
          // Snap to point along normal
          const snapPoint = pickInfo.pickedPoint.add(normal.scale(0.01)); // 10mm offset
          const distance = BABYLON.Vector3.Distance(position, snapPoint);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = snapPoint;
            closestMeshName = pickInfo.pickedMesh?.name || '';
          }
        }
      }
    }

    if (closestPoint) {
      return {
        snapped: true,
        position: closestPoint,
        snapType: 'normal',
        targetMeshName: closestMeshName,
        visualFeedback: [closestPoint],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to bounding box corners
   */
  private snapBBoxCorner(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestCorner: BABYLON.Vector3 | null = null;
    let closestDistance = snapDistanceMeters;
    let closestMeshName = '';

    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name === 'gridOverlay'
      ) {
        continue;
      }

      mesh.computeWorldMatrix(true);
      const boundingBox = mesh.getBoundingInfo().boundingBox;

      // Get all 8 corners of the bounding box
      const min = boundingBox.minimumWorld;
      const max = boundingBox.maximumWorld;

      const corners = [
        new BABYLON.Vector3(min.x, min.y, min.z),
        new BABYLON.Vector3(max.x, min.y, min.z),
        new BABYLON.Vector3(min.x, max.y, min.z),
        new BABYLON.Vector3(max.x, max.y, min.z),
        new BABYLON.Vector3(min.x, min.y, max.z),
        new BABYLON.Vector3(max.x, min.y, max.z),
        new BABYLON.Vector3(min.x, max.y, max.z),
        new BABYLON.Vector3(max.x, max.y, max.z),
      ];

      for (const corner of corners) {
        const distance = BABYLON.Vector3.Distance(position, corner);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestCorner = corner;
          closestMeshName = mesh.name;
        }
      }
    }

    if (closestCorner) {
      return {
        snapped: true,
        position: closestCorner,
        snapType: 'bboxCorner',
        targetMeshName: closestMeshName,
        visualFeedback: [closestCorner],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap object surface to another surface (contact snap)
   */
  private snapToSurface(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;

    // Find nearest surface below position
    const ray = new BABYLON.Ray(position, new BABYLON.Vector3(0, -1, 0), snapDistanceMeters);
    const pickInfo = scene.pickWithRay(ray, (mesh) => {
      return (
        mesh.isVisible &&
        !excludeMeshIds.includes(mesh.uniqueId.toString()) &&
        mesh.name !== 'ground'
      );
    });

    if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
      return {
        snapped: true,
        position: pickInfo.pickedPoint,
        snapType: 'surface',
        targetMeshName: pickInfo.pickedMesh?.name || '',
        visualFeedback: [pickInfo.pickedPoint],
      };
    }

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap object center to nearest vertex
   */
  private snapObjectToVertex(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    // This is similar to snapToVertex but conceptually for whole object placement
    return this.snapToVertex(position, snapDistance, excludeMeshIds);
  }

  /**
   * Snap to any point along an edge
   */
  private snapPointOnEdge(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    // This is the same as snapToEdge - finds closest point on any edge
    return this.snapToEdge(position, snapDistance, excludeMeshIds);
  }

  /**
   * Snap perpendicular to an edge
   */
  private snapToPerpendicular(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    // For now, use edge snapping as base - perpendicular would require edge direction calculation
    // This is a simplified implementation
    return this.snapToEdge(position, snapDistance, excludeMeshIds);
  }

  /**
   * Snap tangent to a curve/edge
   */
  private snapToTangent(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    // For now, use edge snapping as base - tangent would require curve direction calculation
    return this.snapToEdge(position, snapDistance, excludeMeshIds);
  }

  /**
   * Snap along a direction/axis
   */
  private snapAlong(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    // Snap along the nearest edge direction
    return this.snapToEdge(position, snapDistance, excludeMeshIds);
  }

  /**
   * Snap to a plane
   */
  private snapToPlane(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    // Use face snapping as base - planes are defined by faces
    return this.snapToFace(position, snapDistance, excludeMeshIds);
  }

  /**
   * Snap to an axis (X, Y, or Z axis alignment)
   */
  private snapToAxis(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    // Snap to nearest axis-aligned position (simplified - could be enhanced)
    const snapDistanceMeters = snapDistance / 1000;
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    // Find nearest object center and snap to its axis-aligned position
    return this.snapToCenter(position, snapDistance, excludeMeshIds);
  }

  /**
   * Snap to a curve
   */
  private snapToCurve(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[]
  ): SnapResult {
    // For now, use edge snapping as curves are represented as edges in mesh geometry
    return this.snapToEdge(position, snapDistance, excludeMeshIds);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.clearSnapIndicators();
    this.clearPreviewDot();
  }
}
