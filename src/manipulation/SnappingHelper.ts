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
      result = this.snapToMidpoint(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
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

    // 7. Center snapping (object origins)
    if (settings.snapToCenter) {
      result = this.snapToCenter(position, settings.snapDistance, excludeMeshIds);
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
   * Snap to object center (origin)
   */
  private snapToCenter(
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

    // Check all transform nodes (meshes and collections)
    for (const node of scene.transformNodes) {
      if (excludeMeshIds.includes(node.uniqueId.toString()) || node.name === 'ground' || node.name === 'gridOverlay') {
        continue;
      }

      const worldPos = node.getAbsolutePosition();
      const distance = BABYLON.Vector3.Distance(position, worldPos);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestCenter = worldPos;
        closestMeshName = node.name;
      }
    }

    if (closestCenter) {
      return {
        snapped: true,
        position: closestCenter,
        snapType: 'center',
        targetMeshName: closestMeshName,
        visualFeedback: [closestCenter],
      };
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
   * Show preview dot at a position (yellow dot before selection)
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

    // Check if point is on a selected mesh (for visibility adjustment)
    const isOnSelectedMesh = this.isPointOnSelectedMesh(point, scene);
    
    // Determine shape and color based on snap type
    let preview: BABYLON.Mesh;
    let baseColor: BABYLON.Color3;
    let size: number;
    
    // Debug: log snap type
    if (snapType) {
      console.log(`[SnappingHelper] showPreviewDot called with snapType="${snapType}"`);
    }
    
    if (snapType === 'midpoint') {
      // Midpoint: Show a line along the edge + a dot at the midpoint (same as vertex)
      // Get edge endpoints from point object (attached in SceneCanvas.tsx)
      const edgeStart = (point as any).edgeStart;
      const edgeEnd = (point as any).edgeEnd;
      
      // Create dot at midpoint first (same as vertex dot)
      const diameter = isOnSelectedMesh ? 0.06 : 0.04; // Same size as vertex dot
      preview = BABYLON.MeshBuilder.CreateSphere(
        'snapPreviewDot',
        { diameter },
        scene
      );
      preview.position = point.clone(); // Position dot at midpoint
      
      // Create a line along the edge if we have endpoints
      // Line points need to be relative to the midpoint since line will be parented to dot
      let line: BABYLON.LinesMesh | null = null;
      if (edgeStart && edgeEnd) {
        // Convert edge endpoints to local space relative to midpoint
        const localStart = edgeStart.subtract(point);
        const localEnd = edgeEnd.subtract(point);
        
        line = BABYLON.MeshBuilder.CreateLines(
          'snapPreviewLine',
          {
            points: [localStart, localEnd],
            updatable: false
          },
          scene
        );
        line.color = isOnSelectedMesh 
          ? new BABYLON.Color3(1, 1, 1) // White for selected objects
          : new BABYLON.Color3(1, 0.5, 0); // Orange line for midpoints
        line.renderingGroupId = 1;
        line.isPickable = false;
        line.parent = preview; // Parent line to dot so they move together
      }
      
      baseColor = isOnSelectedMesh 
        ? new BABYLON.Color3(1, 1, 1) // White for selected objects
        : new BABYLON.Color3(1, 0.5, 0); // Orange for midpoints (distinct from yellow vertex)
      size = diameter;
      console.log(`[SnappingHelper] Created midpoint preview: line along edge + orange dot at (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`);
    } else {
      // Vertex (default): Use sphere (solid dot)
      const diameter = isOnSelectedMesh ? 0.06 : 0.04; // 6cm on selected, 4cm normal
      preview = BABYLON.MeshBuilder.CreateSphere(
        'snapPreviewDot',
        { diameter },
        scene
      );
      baseColor = isOnSelectedMesh 
        ? new BABYLON.Color3(1, 1, 1) // White for selected objects
        : new BABYLON.Color3(1, 0.84, 0); // Gold/Yellow for vertices
      size = diameter;
    }
    
    // Position preview (already positioned for midpoint above)
    if (snapType !== 'midpoint') {
      preview.position = point.clone();
    }
    preview.renderingGroupId = 1; // Render on top
    preview.isVisible = true;
    preview.visibility = 1.0;

    const mat = new BABYLON.StandardMaterial('previewMat', scene);
    mat.emissiveColor = baseColor;
    mat.diffuseColor = baseColor;
    mat.disableLighting = true;
    mat.alpha = 1.0; // Fully opaque
    mat.zOffset = -2; // Render in front
    mat.backFaceCulling = false; // Show from all sides
    
    // Add dark outline for contrast (especially on bright cyan backgrounds)
    if (isOnSelectedMesh && snapType !== 'midpoint') {
      // Create outline ring for sphere (vertex) on selected objects
      const outline = BABYLON.MeshBuilder.CreateTorus(
        'snapPreviewDotOutline',
        { diameter: size + 0.01, thickness: 0.002, tessellation: 32 },
        scene
      );
      outline.position = point.clone();
      outline.renderingGroupId = 1;
      outline.rotation.x = Math.PI / 2;
      const outlineMat = new BABYLON.StandardMaterial('previewOutlineMat', scene);
      outlineMat.emissiveColor = new BABYLON.Color3(0, 0, 0); // Black outline
      outlineMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
      outlineMat.disableLighting = true;
      outlineMat.zOffset = -3; // Render behind the dot
      outline.material = outlineMat;
      outline.isPickable = false;
      outline.parent = preview; // Parent to preview so it moves together
    }
    
    preview.material = mat;
    
    // Apply material to child rings if they exist (for midpoint)
    if (snapType === 'midpoint') {
      preview.getChildMeshes().forEach(child => {
        if (child.name.includes('Ring')) {
          const childMat = new BABYLON.StandardMaterial(`childMat_${child.name}`, scene);
          childMat.emissiveColor = baseColor;
          childMat.diffuseColor = baseColor;
          childMat.disableLighting = true;
          childMat.alpha = 1.0;
          childMat.zOffset = -2;
          child.material = childMat;
          console.log(`[SnappingHelper] Applied material to ${child.name}`);
        }
      });
    }

    // Add glow for better visibility (stronger on selected objects)
    let glowLayer = scene.getGlowLayerByName('snap-preview-glow');
    if (!glowLayer) {
      glowLayer = new BABYLON.GlowLayer('snap-preview-glow', scene);
      glowLayer.intensity = 2.0; // Default intensity
    }
    glowLayer.intensity = isOnSelectedMesh ? 3.0 : 2.0; // Stronger glow on selected
    glowLayer.addIncludedOnlyMesh(preview);
    console.log(`[SnappingHelper] Added preview to glow layer, intensity=${glowLayer.intensity}`);
    
    // For midpoint, add the line to glow layer if it exists
    if (snapType === 'midpoint') {
      preview.getChildMeshes().forEach(child => {
        if (child.name.includes('Line')) {
          // Lines don't use glow layer, they use their own color
          // But we can add the dot to glow
        }
      });
    }

    // Make sure it's always visible
    preview.alwaysSelectAsActiveMesh = true;
    preview.isPickable = false; // Don't interfere with picking
    
    // Verify preview is in scene
    if (snapType === 'midpoint') {
      const childCount = preview.getChildMeshes().length;
      console.log(`[SnappingHelper] Midpoint preview created: position=(${preview.position.x.toFixed(3)}, ${preview.position.y.toFixed(3)}, ${preview.position.z.toFixed(3)}), visible=${preview.isVisible}, children=${childCount}`);
    }

    this.previewIndicator = preview;
  }

  /**
   * Check if a point is on a selected mesh
   */
  private isPointOnSelectedMesh(point: BABYLON.Vector3, scene: BABYLON.Scene): boolean {
    // Check if any selected mesh contains this point
    // We'll use a simple distance check to nearby meshes
    const SELECTED_MESH_CHECK_DISTANCE = 0.1; // 10cm tolerance
    
    for (const mesh of scene.meshes) {
      if (!mesh.isVisible || mesh.name.startsWith('snap') || mesh.name === 'ground' || mesh.name === 'gridOverlay') {
        continue;
      }
      
      // Check if mesh has selection metadata or is in selected state
      // For now, we'll check if the point is very close to the mesh bounding box
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();
      if (boundingInfo) {
        const distance = BABYLON.Vector3.Distance(point, boundingInfo.boundingBox.centerWorld);
        const maxDistance = Math.max(
          boundingInfo.boundingBox.extendSizeWorld.x,
          boundingInfo.boundingBox.extendSizeWorld.y,
          boundingInfo.boundingBox.extendSizeWorld.z
        ) + SELECTED_MESH_CHECK_DISTANCE;
        
        if (distance < maxDistance) {
          // Point is near this mesh, check if mesh appears selected (has bright cyan material)
          if (mesh.material && mesh.material instanceof BABYLON.StandardMaterial) {
            const mat = mesh.material as BABYLON.StandardMaterial;
            // Check if material has bright cyan emissive color (selection highlight)
            if (mat.emissiveColor && 
                mat.emissiveColor.r < 0.1 && 
                mat.emissiveColor.g > 0.9 && 
                mat.emissiveColor.b > 0.7) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Clear preview dot
   */
  clearPreviewDot(): void {
    if (this.previewIndicator) {
      // Remove from glow layer first
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      if (scene) {
        const glowLayer = scene.getGlowLayerByName('snap-preview-glow');
        if (glowLayer) {
          glowLayer.removeIncludedOnlyMesh(this.previewIndicator);
        }
      }
      
      // Dispose all child meshes (outlines, rings, etc.)
      const childMeshes = this.previewIndicator.getChildMeshes();
      childMeshes.forEach(child => {
        child.dispose();
      });
      
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
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;
    let closestMidpoint: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity; // Start with Infinity to find true closest
    let closestMeshName = '';
    
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

    let meshesChecked = 0;
    let edgesChecked = 0;
    let midpointsWithinRange = 0;

    // Deduplicate midpoints (same edge shared by multiple triangles)
    // Use 1mm tolerance for deduplication - edges from different triangles should be within this
    const midpointTolerance = 0.001; // 1mm tolerance for deduplication
    const uniqueMidpoints = new Map<string, { point: BABYLON.Vector3; meshName: string; distance: number }>();
    
    // Also track edges by vertex pair to ensure true edge deduplication
    // Store edge endpoints for visual feedback (line along edge)
    const edgeMap = new Map<string, { midpoint: BABYLON.Vector3; meshName: string; distance: number; edgeStart: BABYLON.Vector3; edgeEnd: BABYLON.Vector3 }>();

    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snapIndicator') ||
        mesh.name.startsWith('snapPreviewDot') ||
        mesh.name.startsWith('marker-') || // Measurement tool markers
        mesh.name.startsWith('distance-line') || // Measurement tool lines
        mesh.name.startsWith('angle-line') // Measurement tool lines
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (!positions || !indices) continue;

      meshesChecked++;
      const worldMatrix = mesh.computeWorldMatrix(true);

      // Check each edge midpoint
      for (let i = 0; i < indices.length; i += 3) {
        const edges = [
          [indices[i] * 3, indices[i + 1] * 3],
          [indices[i + 1] * 3, indices[i + 2] * 3],
          [indices[i + 2] * 3, indices[i] * 3],
        ];

        for (const [start, end] of edges) {
          edgesChecked++;
          const v1 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[start], positions[start + 1], positions[start + 2]),
            worldMatrix
          );
          const v2 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[end], positions[end + 1], positions[end + 2]),
            worldMatrix
          );

          const midpoint = BABYLON.Vector3.Center(v1, v2);
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
              midpoint,
              worldMatrix,
              camera.getProjectionMatrix(),
              viewport
            );
            const screenDist = Math.sqrt(
              Math.pow(projected.x - screenPos.x, 2) + 
              Math.pow(projected.y - screenPos.y, 2)
            );
            distance = BABYLON.Vector3.Distance(position, midpoint); // Keep world distance for tracking
            withinRange = screenDist <= screenSpacePixels;
          } else {
            // Use world-space distance for actual snapping
            distance = BABYLON.Vector3.Distance(position, midpoint);
            withinRange = distance < snapDistanceMeters;
          }

          if (withinRange) {
            // Also check world-space distance - don't allow midpoints that are too far even if screen-space is close
            // This prevents selecting midpoints on distant objects
            // For preview mode (screen-space), use a larger world-space cap (50mm = 0.05m)
            // For actual snapping, use the snap distance
            const maxWorldDistance = (camera && screenSpacePixels !== undefined) ? 
              0.05 : // 50mm max for preview (prevents snapping to distant objects)
              snapDistanceMeters; // Use actual snap distance for real snapping
            if (distance > maxWorldDistance) {
              continue; // Skip midpoints that are too far in world space
            }

            // Calculate comparison distance (screen-space for preview, world-space for actual)
            const comparisonDistance = (camera && screenSpacePixels !== undefined && screenPos) ? 
              (() => {
                const worldMatrix = scene.getTransformMatrix();
                const viewport = camera.viewport.toGlobal(
                  scene.getEngine().getRenderWidth(),
                  scene.getEngine().getRenderHeight()
                );
                const projected = BABYLON.Vector3.Project(
                  midpoint,
                  worldMatrix,
                  camera.getProjectionMatrix(),
                  viewport
                );
                return Math.sqrt(
                  Math.pow(projected.x - screenPos.x, 2) + 
                  Math.pow(projected.y - screenPos.y, 2)
                );
              })() : distance;

            // Deduplicate by edge (vertex pair) - this is more accurate than position-based
            // Create a normalized edge key (smaller index first) to identify the same edge
            // Use actual vertex indices from the mesh, not byte offsets
            const v1Idx = Math.floor(start / 3);
            const v2Idx = Math.floor(end / 3);
            const v1Index = Math.min(v1Idx, v2Idx);
            const v2Index = Math.max(v1Idx, v2Idx);
            const edgeKey = `${mesh.uniqueId}_${v1Index}_${v2Index}`;
            
            // Also create position-based key for cross-mesh deduplication
            const keyX = Math.round(midpoint.x / midpointTolerance);
            const keyY = Math.round(midpoint.y / midpointTolerance);
            const keyZ = Math.round(midpoint.z / midpointTolerance);
            const posKey = `${keyX},${keyY},${keyZ}`;
            
            // Use edge-based deduplication first (more accurate), then position-based
            // Store edge endpoints for visual feedback (line along edge)
            if (!edgeMap.has(edgeKey) || comparisonDistance < edgeMap.get(edgeKey)!.distance) {
              edgeMap.set(edgeKey, {
                midpoint: midpoint.clone(),
                meshName: mesh.name,
                distance: comparisonDistance,
                edgeStart: v1.clone(),
                edgeEnd: v2.clone()
              });
            }
            
            // Also track by position for cross-mesh cases
            if (!uniqueMidpoints.has(posKey) || comparisonDistance < uniqueMidpoints.get(posKey)!.distance) {
              uniqueMidpoints.set(posKey, {
                point: midpoint.clone(),
                meshName: mesh.name,
                distance: comparisonDistance
              });
            }
          }
        }
      }
    }

    // Now find the closest unique midpoint
    // Prefer edge-based deduplication results (more accurate), fall back to position-based
    const candidates = Array.from(edgeMap.values());
    
    // Track edge endpoints for visual feedback
    let closestEdgeStart: BABYLON.Vector3 | null = null;
    let closestEdgeEnd: BABYLON.Vector3 | null = null;
    
    // If no edge-based candidates, use position-based
    if (candidates.length === 0) {
      candidates.push(...Array.from(uniqueMidpoints.values()).map(m => ({ midpoint: m.point, meshName: m.meshName, distance: m.distance, edgeStart: null as BABYLON.Vector3 | null, edgeEnd: null as BABYLON.Vector3 | null })));
    }
    
    for (const candidate of candidates) {
      const { midpoint: point, meshName, distance: comparisonDist, edgeStart, edgeEnd } = candidate;
      midpointsWithinRange++;
      
      // For comparison, use the same metric we used for deduplication
      if (comparisonDist < closestDistance) {
        closestDistance = comparisonDist; // Store comparison distance
        closestMidpoint = point;
        closestMeshName = meshName;
        closestEdgeStart = edgeStart || null;
        closestEdgeEnd = edgeEnd || null;
      }
    }

    // Debug logging (log frequently to debug jumping issue)
    if (closestMidpoint && Math.random() < 0.3) {
      const worldDist = BABYLON.Vector3.Distance(position, closestMidpoint);
      const closestDistMM = (camera && screenSpacePixels !== undefined) ? 
        closestDistance.toFixed(2) + 'px' : 
        (closestDistance * 1000).toFixed(2) + 'mm';
      const worldDistMM = (worldDist * 1000).toFixed(2);
      const snapDistMM = (snapDistanceMeters * 1000).toFixed(2);
      const uniqueCount = edgeMap.size > 0 ? edgeMap.size : uniqueMidpoints.size;
      const inputPos = `(${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`;
      const meshInfo = closestMeshName ? `, Mesh="${closestMeshName}"` : '';
      console.log(`[SnappingHelper] MIDPOINT: Input=${inputPos}, Output=(${closestMidpoint.x.toFixed(3)}, ${closestMidpoint.y.toFixed(3)}, ${closestMidpoint.z.toFixed(3)})${meshInfo}, Meshes=${meshesChecked}, Edges=${edgesChecked}, Unique=${uniqueCount}, WithinRange=${midpointsWithinRange}, Closest=${closestDistMM} (world=${worldDistMM}mm), Threshold=${snapDistMM}mm`);
    }

    // Determine if we should snap based on the method used
    let shouldSnap = false;
    if (closestMidpoint) {
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Check screen-space distance for preview
        const worldMatrix = scene.getTransformMatrix();
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestMidpoint,
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

    if (closestMidpoint && shouldSnap) {
      // Always log when snapping to midpoint for verification
      console.log(`[SnappingHelper] ✅ MIDPOINT SNAP: Pos=(${closestMidpoint.x.toFixed(3)}, ${closestMidpoint.y.toFixed(3)}, ${closestMidpoint.z.toFixed(3)}), Mesh="${closestMeshName}", Type=midpoint`);
      
      // Return edge endpoints for visual feedback: [edgeStart, edgeEnd, midpoint]
      // This allows drawing a line along the edge with a dot at the midpoint
      const visualFeedback: BABYLON.Vector3[] = [closestMidpoint];
      if (closestEdgeStart && closestEdgeEnd) {
        visualFeedback.push(closestEdgeStart, closestEdgeEnd);
      }
      
      return {
        snapped: true,
        position: closestMidpoint,
        snapType: 'midpoint',
        targetMeshName: closestMeshName,
        visualFeedback: visualFeedback,
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

