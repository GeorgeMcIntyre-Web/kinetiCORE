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
  // Simple settings for smart snap selector
  enabled: boolean;
  snapDistance: number; // mm - detection threshold
  gridSize: number; // mm - for grid snapping

  // Advanced: Individual snap type toggles (for power users)
  // With smart selector, these are all enabled by default
  snapToGrid?: boolean;
  snapToVertex?: boolean;
  snapToEdge?: boolean;
  snapToFace?: boolean;
  snapToCenter?: boolean;
  snapToObject?: boolean;
  snapToMidpoint?: boolean;
  snapToIntersection?: boolean;
  snapToPerpendicular?: boolean;
  snapToTangent?: boolean;
  snapAlong?: boolean;
  snapToNormal?: boolean;
  snapToPlane?: boolean;
  snapToAxis?: boolean;
  snapToCurve?: boolean;
  snapToSurface?: boolean;
  snapObjectToVertex?: boolean;
  snapPointOnEdge?: boolean;
  snapBBoxCorner?: boolean;
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
   * SMART SNAP SELECTOR: Try all enabled snap types and return the closest one
   * This provides better UX - users don't need to manually toggle snap types
   * @param position - World space position to snap from
   * @param settings - Snap settings
   * @param excludeMeshIds - Mesh IDs to exclude from snapping
   * @param camera - Optional camera for screen-space distance calculation
   * @param screenSpacePixels - Optional screen-space pixel threshold
   */
  private smartSnapPosition(
    position: BABYLON.Vector3,
    settings: SnapSettings,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    const candidates: Array<{ result: SnapResult; distance: number; priority: number }> = [];

    // Define snap type priorities (lower = higher priority when distances are equal)
    const priorities: Record<string, number> = {
      vertex: 1,      // Most precise
      midpoint: 2,    // Precise point on edge
      center: 3,      // Circle centers are important
      intersection: 4, // Edge intersections
      edge: 5,        // Points on edges
      bboxCorner: 6,  // Bounding box corners
      face: 7,        // Points on faces
      normal: 8,      // Surface normals
      object: 9,      // Object centers
      perpendicular: 10,
      tangent: 11,
      surface: 12,    // Lowest priority
    };

    // Smart selector defaults: all snap types enabled unless explicitly disabled
    const snapToVertex = settings.snapToVertex !== false;
    const snapToMidpoint = settings.snapToMidpoint !== false;
    const snapToCenter = settings.snapToCenter !== false;
    const snapToEdge = settings.snapToEdge !== false;
    const snapToIntersection = settings.snapToIntersection !== false;
    const snapToFace = settings.snapToFace !== false;
    const snapToNormal = settings.snapToNormal !== false;
    const snapBBoxCorner = settings.snapBBoxCorner !== false;
    const snapToObject = settings.snapToObject !== false;

    // Try all enabled snap types and collect candidates
    if (snapToVertex) {
      const result = this.snapToVertex(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        const distance = BABYLON.Vector3.Distance(position, result.position);
        candidates.push({ result, distance, priority: priorities.vertex || 999 });
      }
    }

    if (snapToMidpoint) {
      const result = this.snapToMidpoint(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        const distance = BABYLON.Vector3.Distance(position, result.position);
        candidates.push({ result, distance, priority: priorities.midpoint || 999 });
      }
    }

    if (snapToCenter) {
      const result = this.snapToCenter(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        const distance = BABYLON.Vector3.Distance(position, result.position);
        candidates.push({ result, distance, priority: priorities.center || 999 });
      }
    }

    if (snapToEdge) {
      const result = this.snapToEdge(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        const distance = BABYLON.Vector3.Distance(position, result.position);
        candidates.push({ result, distance, priority: priorities.edge || 999 });
      }
    }

    if (snapToIntersection) {
      const result = this.snapToIntersection(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        const distance = BABYLON.Vector3.Distance(position, result.position);
        candidates.push({ result, distance, priority: priorities.intersection || 999 });
      }
    }

    if (snapToFace) {
      const result = this.snapToFace(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        const distance = BABYLON.Vector3.Distance(position, result.position);
        candidates.push({ result, distance, priority: priorities.face || 999 });
      }
    }

    if (snapToNormal) {
      const result = this.snapToNormal(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        const distance = BABYLON.Vector3.Distance(position, result.position);
        candidates.push({ result, distance, priority: priorities.normal || 999 });
      }
    }

    if (snapBBoxCorner) {
      const result = this.snapBBoxCorner(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        const distance = BABYLON.Vector3.Distance(position, result.position);
        candidates.push({ result, distance, priority: priorities.bboxCorner || 999 });
      }
    }

    if (snapToObject) {
      const result = this.snapToObject(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        const distance = BABYLON.Vector3.Distance(position, result.position);
        candidates.push({ result, distance, priority: priorities.object || 999 });
      }
    }

    // Note: Perpendicular, tangent, and surface don't have camera support yet
    // They can be added here once updated

    // No candidates found
    if (candidates.length === 0) {
      return { snapped: false, position: position.clone() };
    }

    // Filter out invalid candidates
    const filteredCandidates = candidates.filter(c => {
      // Face snaps: Only reject when mouse is EXACTLY on the face AND there's a better snap available
      // This allows face snap to work when hovering near faces, but gives priority to more precise snaps
      if (c.result.snapType === 'face' && c.distance < 0.0001) { // < 0.1mm
        // Only reject if there's a vertex, midpoint, or edge snap available (more precise)
        const hasBetterSnap = candidates.some(cand => 
          cand.result.snapType === 'vertex' || 
          cand.result.snapType === 'midpoint' || 
          cand.result.snapType === 'edge'
        );
        if (hasBetterSnap) {
          return false; // Reject face snap in favor of more precise snap
        }
      }
      
      // Edge snaps: reject when there's a vertex snap candidate nearby (vertex has higher priority)
      // This prevents edge snap from showing up too much when you're near vertices
      if (c.result.snapType === 'edge') {
        const vertexCandidate = candidates.find(cand => cand.result.snapType === 'vertex');
        if (vertexCandidate) {
          // If vertex is within 3mm of the edge snap point, prefer vertex
          const edgeToVertexDist = BABYLON.Vector3.Distance(
            c.result.position,
            vertexCandidate.result.position
          );
          if (edgeToVertexDist < 0.003) { // 3mm threshold
            return false; // Reject edge snap in favor of vertex
          }
        }
      }
      
      return true;
    });

    // No candidates left after filtering
    if (filteredCandidates.length === 0) {
      return { snapped: false, position: position.clone() };
    }

    // Sort by distance first (closest), then by priority (if distances are very similar)
    filteredCandidates.sort((a, b) => {
      const distDiff = a.distance - b.distance;
      // If distances are within 3mm (very close), use priority to prefer more precise snaps
      // This gives higher priority snaps (vertex, midpoint) a better chance to win
      if (Math.abs(distDiff) < 0.003) { // Increased from 1mm to 3mm
        return a.priority - b.priority;
      }
      return distDiff;
    });

    // Return the best candidate (logging removed to reduce console spam)
    const best = filteredCandidates[0];
    return best.result;
  }

  /**
   * Attempt to snap a position based on settings
   * @param position - World space position to snap from
   * @param settings - Snap settings
   * @param excludeMeshIds - Mesh IDs to exclude from snapping
   * @param camera - Optional camera for screen-space distance calculation (for preview)
   * @param screenSpacePixels - Optional screen-space pixel threshold (for preview)
   * @param smartSelect - If true, tries all enabled snap types and returns the closest (default: true for better UX)
   */
  snapPosition(
    position: BABYLON.Vector3,
    settings: SnapSettings,
    excludeMeshIds: string[] = [],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number,
    smartSelect: boolean = true
  ): SnapResult {
    if (!settings.enabled) {
      return { snapped: false, position: position.clone() };
    }

    // SMART SNAP SELECTOR: Try all enabled snap types and return the closest
    // This provides a better UX - users don't need to manually toggle snap types
    if (smartSelect) {
      return this.smartSnapPosition(position, settings, excludeMeshIds, camera, screenSpacePixels);
    }

    // LEGACY MODE: Try snapping in order of priority (first match wins)
    let result: SnapResult | null = null;

    // 1. Vertex snapping (highest priority - most precise)
    if (settings.snapToVertex) {
      result = this.snapToVertex(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) return result;
    }

    // 2. Midpoint snapping
    if (settings.snapToMidpoint) {
      result = this.snapToMidpoint(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        console.log(`[SnappingHelper] MIDPOINT SNAP: result.snapped=${result.snapped}, visualFeedback.length=${result.visualFeedback?.length || 0}, snapType=${result.snapType}`);
        return result;
      }
    }

    // 3. Edge snapping
    if (settings.snapToEdge) {
      result = this.snapToEdge(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) return result;
    }

    // 4. Intersection snapping
    if (settings.snapToIntersection) {
      result = this.snapToIntersection(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
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
      result = this.snapToFace(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) return result;
    }

    // 6. Normal snapping
    if (settings.snapToNormal) {
      result = this.snapToNormal(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) return result;
    }

    // 7. Center snapping (circle centers)
    if (settings.snapToCenter) {
      result = this.snapToCenter(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) return result;
    }

    // 8. BBox corner snapping
    if (settings.snapBBoxCorner) {
      result = this.snapBBoxCorner(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) return result;
    }

    // 9. Object snapping (bounding box centers)
    if (settings.snapToObject) {
      result = this.snapToObject(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
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
    let closestScreenDistance = Infinity; // Track closest screen-space distance when using screen-space snapping
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
        // Also add instances (instances are InstancedMesh, not Mesh, so we skip them for now)
        // Instances share the same geometry as the source mesh, so we can use the source mesh
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
      
      // Check if clicked position is within this mesh's bounding box
      // If so, we should prefer vertices from this mesh (for vertex-to-vertex measurements)
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();
      const boundingBox = boundingInfo.boundingBox;
      const min = boundingBox.minimumWorld.clone(); // Clone to avoid mutation
      const max = boundingBox.maximumWorld.clone(); // Clone to avoid mutation
      const tolerance = 0.005; // 5mm tolerance
      const isClickingOnThisMesh = 
        position.x >= min.x - tolerance && position.x <= max.x + tolerance &&
        position.y >= min.y - tolerance && position.y <= max.y + tolerance &&
        position.z >= min.z - tolerance && position.z <= max.z + tolerance;
      
      // Calculate max extent for this mesh (used in vertex loop)
      const bboxSize = max.subtract(min.clone()); // Clone min to avoid mutation
      const maxExtent = Math.max(bboxSize.x, bboxSize.y, bboxSize.z);
      
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
      
      // Vertex deduplication complete (logging removed to reduce console spam)
      
      for (const worldVertex of uniqueVertices.values()) {
        let distance: number;
        let screenDist: number | null = null;
        let withinRange = false;
        
        // Calculate world-space distance first
        distance = BABYLON.Vector3.Distance(position, worldVertex);
        
        // Use screen-space distance if camera and threshold provided (more accurate for preview and measurements)
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
          screenDist = Math.sqrt(
            Math.pow(projected.x - screenPos.x, 2) + 
            Math.pow(projected.y - screenPos.y, 2)
          );
          withinRange = screenDist <= screenSpacePixels;
        } else {
          // For actual snapping (measurement tool), use a more generous threshold
          // When clicking on a face near a vertex, we want to snap to the vertex
          // If clicking on this mesh's bounding box, use a much larger threshold (up to half the box size)
          // This ensures vertex snap works reliably for vertex-to-vertex measurements
          if (isClickingOnThisMesh) {
            // Allow snapping to vertices within 60% of the box size (covers corner-to-center distance)
            // For a 2m box, this allows up to 1.2m snap distance, which covers any point on the box
            withinRange = distance < maxExtent * 0.6;
          } else {
            // For vertices on other meshes, use 2x snap distance
            withinRange = distance < snapDistanceMeters * 2;
          }
        }
        
        // Track all distances for debugging (limit to avoid spam)
        if (debugDistances.length < 20) {
          debugDistances.push(distance);
        }
        
        if (withinRange) {
          verticesWithinRange++;
        }
        
        // Track the closest vertex - use screen-space distance if available (for measurements),
        // otherwise use world-space distance
        if (screenDist !== null) {
          // When using screen-space snapping, prioritize vertices closest in screen space
          // This ensures we snap to the vertex the user actually clicked on
          if (screenDist < closestScreenDistance) {
            closestScreenDistance = screenDist;
            closestDistance = distance; // Keep world distance for reference
            closestVertex = worldVertex;
            closestMeshName = mesh.name;
          }
        } else {
          // Fall back to world-space distance when screen-space is not available
          if (distance < closestDistance) {
            closestDistance = distance;
            closestVertex = worldVertex;
            closestMeshName = mesh.name;
          }
        }
      }
    }

    // Determine if we should snap based on the method used
    let shouldSnap = false;
    if (closestVertex) {
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Check screen-space distance for magnetic snapping
        // When using screen-space, we've already found the closest vertex in screen space
        // If we found one within the threshold, always snap to it (magnetic behavior)
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
        // Magnetic snap: if vertex is within threshold, always snap to it
        shouldSnap = screenDist <= screenSpacePixels;
      } else {
        // Check world-space distance for actual snapping
        // For measurement tool, we want to be more generous to catch clicks on faces near vertices
        // The withinRange check above already handles this with mesh-aware thresholds
        // Here we just need to check if we found a vertex within a reasonable distance
        // Use a generous threshold (50mm) to ensure vertex snap works for measurements
        shouldSnap = closestDistance <= Math.max(snapDistanceMeters * 2, 0.05); // At least 50mm
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
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;

    // Convert position to screen space if camera provided
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

    let closestPoint: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity; // Find true closest first
    let closestMeshName = '';

    // Edge deduplication
    const seenEdges = new Set<string>();

    // Check all meshes in the scene
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snap') || // Exclude snap preview meshes
        mesh.name.startsWith('circle') || // Exclude debug visualization
        mesh.name.startsWith('measurement') ||
        mesh.name.startsWith('transform_label')
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (!positions || !indices) continue;

      const worldMatrix = mesh.computeWorldMatrix(true);
      const meshId = mesh.uniqueId.toString();

      // Check each edge (triangle edge)
      for (let i = 0; i < indices.length; i += 3) {
        const edges = [
          [indices[i], indices[i + 1]],
          [indices[i + 1], indices[i + 2]],
          [indices[i + 2], indices[i]],
        ];

        for (const [idx1, idx2] of edges) {
          // Deduplicate edges
          const minIdx = Math.min(idx1, idx2);
          const maxIdx = Math.max(idx1, idx2);
          const edgeKey = `${meshId}:${minIdx}-${maxIdx}`;

          if (seenEdges.has(edgeKey)) {
            continue;
          }
          seenEdges.add(edgeKey);

          const start = idx1 * 3;
          const end = idx2 * 3;

          const v1 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[start], positions[start + 1], positions[start + 2]),
            worldMatrix
          );
          const v2 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[end], positions[end + 1], positions[end + 2]),
            worldMatrix
          );

          // Filter out very short edges (< 5mm)
          const edgeLength = BABYLON.Vector3.Distance(v1, v2);
          if (edgeLength < 0.005) {
            continue;
          }

          // Find closest point on edge
          const edgeDir = v2.subtract(v1);
          edgeDir.normalize();

          const toPoint = position.subtract(v1);
          const t = BABYLON.Vector3.Dot(toPoint, edgeDir);
          const clampedT = Math.max(0, Math.min(edgeLength, t));

          const closestOnEdge = v1.add(edgeDir.scale(clampedT));
          const distance = BABYLON.Vector3.Distance(position, closestOnEdge);

          // Filter out edge snaps when the snap point is very close to a vertex endpoint
          // This prevents edge snap from triggering when you're actually near a vertex
          const distToV1 = BABYLON.Vector3.Distance(closestOnEdge, v1);
          const distToV2 = BABYLON.Vector3.Distance(closestOnEdge, v2);
          const vertexProximityThreshold = 0.002; // 2mm - if within 2mm of vertex, skip edge snap
          
          if (distToV1 < vertexProximityThreshold || distToV2 < vertexProximityThreshold) {
            continue; // Skip this edge - too close to a vertex, vertex snap should handle it
          }

          if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = closestOnEdge;
            closestMeshName = mesh.name;
          }
        }
      }
    }

    // Determine if we should snap
    let shouldSnap = false;
    if (closestPoint) {
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Check screen-space distance for preview
        const worldMatrix = scene.getTransformMatrix();
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestPoint,
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

    if (closestPoint && shouldSnap) {
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
   * Option 1: Use actual clicked point if click is on a face (most intuitive)
   * Option 2: Project click point onto nearest face plane
   * Option 3: Snap to face center when clicking on a face
   * Currently using Option 1 - can be changed via faceSnapMode
   */
  private snapToFace(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number,
    clickedMesh?: BABYLON.AbstractMesh | null,
    clickedPoint?: BABYLON.Vector3 | null
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    const snapDistanceMeters = snapDistance / 1000;

    // Convert position to screen space if camera provided
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

    let closestPoint: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity; // Find true closest first
    let closestMeshName = '';
    let closestNormal: BABYLON.Vector3 | null = null; // Store face normal for orientation

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
          mesh.name !== 'gridOverlay' &&
          !mesh.name.startsWith('snap') &&
          !mesh.name.startsWith('circle') &&
          !mesh.name.startsWith('measurement') &&
          !mesh.name.startsWith('transform_label')
        );
      });

      if (pickInfo && pickInfo.hit && pickInfo.pickedPoint && pickInfo.pickedMesh) {
        const mesh = pickInfo.pickedMesh as BABYLON.Mesh;
        const facetId = pickInfo.faceId;
        
        // Get face normal from pickInfo
        let faceNormal: BABYLON.Vector3 | null = null;
        if (pickInfo.getNormal) {
          const normal = pickInfo.getNormal(true); // true = use world space
          if (normal) {
            faceNormal = normal.normalize();
          }
        }
        
        // If getNormal is not available, compute normal from mesh
        if (!faceNormal && mesh.getFacetNormal && facetId !== null && facetId !== undefined) {
          const normal = mesh.getFacetNormal(facetId);
          if (normal) {
            // Transform to world space
            const worldMatrix = mesh.getWorldMatrix();
            faceNormal = BABYLON.Vector3.TransformNormal(normal, worldMatrix).normalize();
          }
        }
        
        // Fallback: compute normal from ray direction (pointing away from face)
        if (!faceNormal) {
          faceNormal = dir.scale(-1).normalize();
        }
        
        // Calculate face center: find all triangles on the SAME FACE (spatially connected, same normal)
        // This is the key for CAD workflow - always snap to face center when face is detected
        let faceCenter: BABYLON.Vector3 | null = null;
        if (faceNormal && facetId !== null && facetId !== undefined) {
          const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
          const indices = mesh.getIndices();
          if (positions && indices) {
            const worldMatrix = mesh.computeWorldMatrix(true);
            const normalTolerance = 0.01; // ~1 degree tolerance for face normal matching
            
            // Get the clicked triangle center as reference point
            const clickedTriIdx0 = indices[facetId * 3];
            const clickedTriIdx1 = indices[facetId * 3 + 1];
            const clickedTriIdx2 = indices[facetId * 3 + 2];
            
            const clickedV0 = new BABYLON.Vector3(positions[clickedTriIdx0 * 3], positions[clickedTriIdx0 * 3 + 1], positions[clickedTriIdx0 * 3 + 2]);
            const clickedV1 = new BABYLON.Vector3(positions[clickedTriIdx1 * 3], positions[clickedTriIdx1 * 3 + 1], positions[clickedTriIdx1 * 3 + 2]);
            const clickedV2 = new BABYLON.Vector3(positions[clickedTriIdx2 * 3], positions[clickedTriIdx2 * 3 + 1], positions[clickedTriIdx2 * 3 + 2]);
            const clickedTriCenter = clickedV0.add(clickedV1).add(clickedV2).scale(1/3);
            const clickedTriCenterWorld = BABYLON.Vector3.TransformCoordinates(clickedTriCenter, worldMatrix);
            
            // Find all triangles on the SAME FACE (same normal AND spatially connected)
            const faceTriangles: BABYLON.Vector3[] = [];
            const triangleCount = indices.length / 3;
            const spatialTolerance = 0.1; // 10cm - triangles must be close to be on same face
            
            for (let i = 0; i < triangleCount; i++) {
              const idx0 = indices[i * 3];
              const idx1 = indices[i * 3 + 1];
              const idx2 = indices[i * 3 + 2];
              
              const v0 = new BABYLON.Vector3(positions[idx0 * 3], positions[idx0 * 3 + 1], positions[idx0 * 3 + 2]);
              const v1 = new BABYLON.Vector3(positions[idx1 * 3], positions[idx1 * 3 + 1], positions[idx1 * 3 + 2]);
              const v2 = new BABYLON.Vector3(positions[idx2 * 3], positions[idx2 * 3 + 1], positions[idx2 * 3 + 2]);
              
              // Calculate triangle normal
              const edge1 = v1.subtract(v0);
              const edge2 = v2.subtract(v0);
              let triNormal = BABYLON.Vector3.Cross(edge1, edge2);
              if (triNormal.length() > 0.0001) {
                triNormal.normalize();
                // Transform to world space
                const worldTriNormal = BABYLON.Vector3.TransformNormal(triNormal, worldMatrix).normalize();
                
                // Check if this triangle has the same normal (same face direction)
                const dot = BABYLON.Vector3.Dot(worldTriNormal, faceNormal);
                if (Math.abs(dot - 1.0) < normalTolerance || Math.abs(dot + 1.0) < normalTolerance) {
                  // Calculate triangle center
                  const triCenter = v0.add(v1).add(v2).scale(1/3);
                  const worldTriCenter = BABYLON.Vector3.TransformCoordinates(triCenter, worldMatrix);
                  
                  // CRITICAL: Also check spatial proximity - triangle must be on the same face plane
                  // Project triangle center onto the face plane (using clicked point as reference)
                  const toTriCenter = worldTriCenter.subtract(clickedTriCenterWorld);
                  const distAlongNormal = BABYLON.Vector3.Dot(toTriCenter, faceNormal);
                  
                  // If triangle is on the same plane (distance along normal is small), include it
                  if (Math.abs(distAlongNormal) < spatialTolerance) {
                    faceTriangles.push(worldTriCenter);
                  }
                }
              }
            }
            
            // Calculate center of all triangles on this face
            if (faceTriangles.length > 0) {
              const sum = BABYLON.Vector3.Zero();
              faceTriangles.forEach(center => sum.addInPlace(center));
              faceCenter = sum.scale(1 / faceTriangles.length);
            } else {
              // Fallback: use center of the clicked triangle
              faceCenter = clickedTriCenterWorld;
            }
          }
        }
        
        // ALWAYS use face center when a face is detected (for CAD workflow)
        // If face center calculation failed, fall back to picked point
        const snapPoint = faceCenter || pickInfo.pickedPoint;
        
        // Distance from hover/click position to snap point
        // For face center, this might be large, but that's OK - we want to snap to center
        const distance = BABYLON.Vector3.Distance(position, snapPoint);
        
        // If we have a face center, prioritize it (use smaller distance for comparison)
        // This ensures face center wins over other snap types when face is detected
        const comparisonDistance = faceCenter ? distance * 0.5 : distance; // Give face center 2x priority
        
        if (comparisonDistance < closestDistance) {
          closestDistance = distance; // Store actual distance, not comparison distance
          closestPoint = snapPoint;
          closestMeshName = mesh.name;
          closestNormal = faceNormal;
        }
      }
    }

    // Determine if we should snap
    // For face center, always snap when face is detected (CAD workflow requirement)
    let shouldSnap = false;
    if (closestPoint) {
      // If we have a face normal, we detected a face - always use its center
      const isFaceCenter = closestNormal !== null;
      
      if (isFaceCenter) {
        // Face center detected - always snap to it (CAD workflow)
        // Only check that we're reasonably close (within 2m) to avoid snapping to faces on other objects
        const maxFaceDistance = 2.0; // 2 meters max distance for face center
        shouldSnap = closestDistance <= maxFaceDistance;
      } else {
        // Regular face snap (no center calculated) - use normal distance check
        if (camera && screenSpacePixels !== undefined && screenPos) {
          const worldMatrix = scene.getTransformMatrix();
          const viewport = camera.viewport.toGlobal(
            scene.getEngine().getRenderWidth(),
            scene.getEngine().getRenderHeight()
          );
          const projected = BABYLON.Vector3.Project(
            closestPoint,
            worldMatrix,
            camera.getProjectionMatrix(),
            viewport
          );
          const screenDist = Math.sqrt(
            Math.pow(projected.x - screenPos.x, 2) +
            Math.pow(projected.y - screenPos.y, 2)
          );
          shouldSnap = screenDist <= screenSpacePixels * 3;
        } else {
          shouldSnap = closestDistance <= snapDistanceMeters * 3;
        }
      }
    }

    if (closestPoint && shouldSnap) {
      // Include face normal in visualFeedback so preview can be oriented correctly
      if (closestNormal) {
        return {
          snapped: true,
          position: closestPoint,
          snapType: 'face',
          targetMeshName: closestMeshName,
          visualFeedback: [closestPoint, closestNormal],
        };
      } else {
        return {
          snapped: true,
          position: closestPoint,
          snapType: 'face',
          targetMeshName: closestMeshName,
          visualFeedback: [closestPoint],
        };
      }
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
    // IMPORTANT: Clone normal before using it to avoid mutating it
    const normalClone = normal.clone();
    const projectedPoints: BABYLON.Vector3[] = [];
    for (const p of points) {
      const toPoint = p.subtract(points[0]);
      const distToPlane = BABYLON.Vector3.Dot(toPoint, normalClone);
      const projected = p.subtract(normalClone.clone().scale(distToPlane));
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

    // Recalculate center from perimeter points using iterative refinement
    // Start with geometric center
    let center = perimeterPoints.reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero())
      .scale(1 / perimeterPoints.length);
    
    // Iteratively refine center to minimize radius variance (simple least-squares approach)
    for (let iter = 0; iter < 3; iter++) {
      const radii: number[] = [];
      for (const p of perimeterPoints) {
        radii.push(BABYLON.Vector3.Distance(p, center));
      }
      const avgRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
      
      // Calculate weighted center (points closer to average radius have more weight)
      let weightedSum = BABYLON.Vector3.Zero();
      let totalWeight = 0;
      for (let i = 0; i < perimeterPoints.length; i++) {
        const radius = radii[i];
        const weight = 1 / (1 + Math.abs(radius - avgRadius) / avgRadius); // Higher weight for points closer to avg radius
        weightedSum.addInPlace(perimeterPoints[i].scale(weight));
        totalWeight += weight;
      }
      if (totalWeight > 0) {
        center = weightedSum.scale(1 / totalWeight);
      }
    }

    // Calculate final radii and statistics
    const perimeterRadii: number[] = [];
    for (const p of perimeterPoints) {
      const radius = BABYLON.Vector3.Distance(p, center);
      perimeterRadii.push(radius);
    }
    const finalAvgRadius = perimeterRadii.reduce((sum, r) => sum + r, 0) / perimeterRadii.length;
    
    // Find max radius for visualization (use maximum to encompass all vertices)
    const maxRadiusValue = Math.max(...perimeterRadii);

    // Check if all perimeter points are approximately equidistant from center (circle check)
    const radiusVariance = perimeterRadii.reduce((sum, r) => sum + Math.pow(r - finalAvgRadius, 2), 0) / perimeterRadii.length;
    const radiusStdDev = Math.sqrt(radiusVariance);
    const relativeError = finalAvgRadius > 0 ? radiusStdDev / finalAvgRadius : Infinity;

    // If relative error is too high, it's not a circle
    // Increased tolerance to 25% for triangulated circles (cylinder ends often have 15-20% error)
    if (relativeError > 0.25 || finalAvgRadius < tolerance) { // 25% tolerance, minimum 1mm radius
      return null;
    }

    // Ensure normal is properly normalized (fix any floating point errors)
    const finalNormal = normal.clone().normalize();

    // For visualization purposes, use the maximum radius so the ring encompasses all vertices
    // (The average radius would make the ring smaller than some vertices)
    return { center, radius: maxRadiusValue, normal: finalNormal };
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
    let closestVertices: BABYLON.Vector3[] | undefined = undefined;

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
    const circleMap = new Map<string, { center: BABYLON.Vector3; radius: number; normal: BABYLON.Vector3; meshName: string; vertices?: BABYLON.Vector3[] }>();

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

      // Face grouping complete (removed debug spam)

      // For each group of faces with the same normal, check if vertices form a circle
      for (const [, faceIndices] of facesByNormal) {
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

        // Fit circle to these vertices
        const circleInfo = this.fitCircleToPoints(worldVertices);
        if (!circleInfo) {
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
            meshName: mesh.name,
            vertices: worldVertices // Store vertices for debugging
          });
        }
      }
    }

    // Now find the closest circle center
    for (const [, circle] of circleMap) {
      let distance: number;
      let withinRange = false;
      let isOnCircularFace = false; // Track if clicked position is on the circular face

      // Check if the clicked position is on or near the circular face
      // Project the clicked position onto the circle's plane
      const toPosition = position.subtract(circle.center);
      const normalClone = circle.normal.clone(); // Clone to avoid mutating
      const distToPlane = BABYLON.Vector3.Dot(toPosition, normalClone);
      // Project position onto the plane: subtract the component along the normal
      const offsetFromPlane = new BABYLON.Vector3(
        normalClone.x * distToPlane,
        normalClone.y * distToPlane,
        normalClone.z * distToPlane
      );
      const projectedOnPlane = position.subtract(offsetFromPlane);
      const distFromCenter = BABYLON.Vector3.Distance(projectedOnPlane, circle.center);
      
      // Check if the projected point is within the circle's radius (with tolerance)
      // This means the user clicked on the circular face
      const radiusTolerance = circle.radius * 0.1; // 10% tolerance for edge cases
      const isWithinCircle = distFromCenter <= (circle.radius + radiusTolerance);
      
      // Also check if we're close to the plane (within a small distance)
      const planeTolerance = 0.005; // 5mm - allow some distance from the plane
      const isNearPlane = Math.abs(distToPlane) < planeTolerance;
      
      isOnCircularFace = isWithinCircle && isNearPlane;

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
        withinRange = screenDist <= centerScreenThreshold || isOnCircularFace;
      } else {
        // Use world-space distance for actual snapping
        distance = BABYLON.Vector3.Distance(position, circle.center);
        // If clicking on the circular face, always allow snapping (for center-to-center measurements)
        // Otherwise, use normal snap distance threshold
        withinRange = isOnCircularFace || distance < snapDistanceMeters;
      }

      // Also check world-space distance - don't allow circles that are too far
      // For preview mode, use a larger world-space cap to allow snapping to circle centers
      // Circle centers can be far from the cursor but still visible on screen
      // If clicking on the circular face, use a much larger max distance (the radius itself)
      const maxWorldDistance = isOnCircularFace ? 
        (circle.radius * 2.0) : // Allow up to 2x radius when clicking on face (covers center-to-edge distance)
        ((camera && screenSpacePixels !== undefined) ?
          1.0 : // 1 meter max for preview (allows snapping to circle centers even if far)
          snapDistanceMeters); // Use actual snap distance for real snapping
      if (distance > maxWorldDistance) {
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

        if (comparisonDistance < closestDistance) {
          closestDistance = comparisonDistance;
          closestCenter = circle.center;
          closestMeshName = circle.meshName;
          closestRadius = circle.radius;
          closestNormal = circle.normal;
          closestVertices = circle.vertices;
        }
      }
      // Removed: debug logging for circles not in range (was causing console spam)
    }

    // Only log when a circle is actually snapped (not just detected)
    // Removed: massive console spam on every mouse move
    
    if (closestCenter && closestRadius > 0 && closestNormal) {
      // Debug: log center snap
      // Ensure normal is normalized (fix any floating point errors)
      const finalNormal = closestNormal.clone().normalize();

      // Return circle center with radius and normal for visual feedback
      // visualFeedback: [center, normal (for circle orientation), radius as Vector3(x=radius, y=0, z=0)]
      const radiusVec = new BABYLON.Vector3(closestRadius, 0, 0); // Store radius in x component

      // Attach vertices to the center point for debugging visualization
      if (closestVertices) {
        (closestCenter as any).circleVertices = closestVertices;
      }

      return {
        snapped: true,
        position: closestCenter,
        snapType: 'center',
        targetMeshName: closestMeshName,
        visualFeedback: [closestCenter, finalNormal, radiusVec],
      };
    }
    
    // No logging for "circles detected but not snapped" - was causing massive console spam

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to object bounding box center
   */
  private snapToObject(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    // Convert position to screen space if camera provided
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

    const snapDistanceMeters = snapDistance / 1000;
    let closestCenter: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity;
    let closestMeshName = '';

    // Check all meshes for their bounding box centers
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snap') || // Exclude snap preview meshes
        mesh.name.startsWith('circle') || // Exclude debug visualization
        mesh.name.startsWith('measurement') ||
        mesh.name.startsWith('transform_label')
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

    // Determine if we should snap
    let shouldSnap = false;
    if (closestCenter) {
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Check screen-space distance for preview
        const worldMatrix = scene.getTransformMatrix();
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestCenter,
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

    if (closestCenter && shouldSnap) {
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

    if (snapType === 'midpoint') {
      // Midpoint: Show a line along the edge + a dot at the midpoint
      const edgeStart = (point as any).edgeStart;
      const edgeEnd = (point as any).edgeEnd;
      
      // Debug: Log if edge endpoints are missing
      if (!edgeStart || !edgeEnd) {
        console.log(`[SnappingHelper] Midpoint snap: edgeStart=${!!edgeStart}, edgeEnd=${!!edgeEnd}, point=(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`);
      }
      
      // Create dot at midpoint first
      const diameter = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewDot', { diameter }, scene);
      preview.position = point.clone();
      
      // Create line along edge if endpoints available
      // Note: Face centers (isFaceCenter=true) don't have edge endpoints, which is expected
      if (edgeStart && edgeEnd) {
        console.log(`[SnappingHelper] Creating midpoint line from (${edgeStart.x.toFixed(3)}, ${edgeStart.y.toFixed(3)}, ${edgeStart.z.toFixed(3)}) to (${edgeEnd.x.toFixed(3)}, ${edgeEnd.y.toFixed(3)}, ${edgeEnd.z.toFixed(3)})`);
        
        // Verify the path is valid (not zero length)
        const pathLength = BABYLON.Vector3.Distance(edgeStart, edgeEnd);
        if (pathLength < 0.001) {
          console.warn(`[SnappingHelper] Invalid line path: length=${pathLength.toFixed(6)}m`);
        }
        
        // Use CreateLines for better visibility and simpler rendering
        // Use unique name to avoid conflicts
        const lineName = `snapPreviewLine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const linePoints = [edgeStart.clone(), edgeEnd.clone()];
        const line = BABYLON.MeshBuilder.CreateLines(lineName, {
          points: linePoints,
          updatable: false
        }, scene);
        
        // Use orange to match the midpoint dot
        const lineColor = isOnSelectedMesh 
          ? new BABYLON.Color3(1, 1, 1)
          : new BABYLON.Color3(1, 0.5, 0); // Orange
        
        line.color = lineColor;
        
        // Create material for LinesMesh - some rendering modes require it
        const lineMaterial = new BABYLON.StandardMaterial(`snapPreviewLineMat_${Date.now()}`, scene);
        lineMaterial.emissiveColor = lineColor;
        lineMaterial.disableLighting = true;
        lineMaterial.alpha = 1.0;
        line.material = lineMaterial;
        
        // LinesMesh rendering settings - don't use renderingGroupId as it might cause issues
        line.isPickable = false;
        line.isVisible = true;
        line.visibility = 1.0;
        line.doNotSyncBoundingInfo = true; // Prevent bounding info updates that might hide it
        
        // Force line to be in the scene's root (not as child of anything)
        if (line.parent) {
          line.parent = null;
        }
        
        // CreateLines automatically adds to scene, but ensure it's visible
        console.log(`[SnappingHelper] Line mesh created: type=${line.constructor.name}, visible=${line.isVisible}, inScene=${scene.meshes.includes(line)}, color=(${lineColor.r}, ${lineColor.g}, ${lineColor.b})`);

        // Store line reference for cleanup
        (preview as any).__snapPreviewLine = line;
        (preview as any).__snapPreviewLineMaterial = lineMaterial;
        
        console.log(`[SnappingHelper] Midpoint line created: visible=${line.isVisible}, renderingGroupId=${line.renderingGroupId}, parent=${line.parent?.name || 'none'}`);
      }
      // No warning needed - face centers don't have edge endpoints, which is expected
      
      baseColor = isOnSelectedMesh 
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(1, 0.5, 0); // Orange
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
        // DEBUG: Visualize circle vertices if available
        const circleVertices = (point as any).circleVertices as BABYLON.Vector3[] | undefined;
        if (circleVertices && circleVertices.length > 0) {
          console.log(`[SnappingHelper] Visualizing ${circleVertices.length} circle vertices`);
          for (const vertex of circleVertices) {
            const dot = BABYLON.MeshBuilder.CreateSphere('circleVertexDebug', { diameter: 0.01 }, scene);
            dot.position = vertex.clone();
            dot.isPickable = false;
            dot.renderingGroupId = 1;
            const dotMat = new BABYLON.StandardMaterial('circleVertexDebugMat', scene);
            dotMat.emissiveColor = new BABYLON.Color3(0, 1, 1); // Cyan for vertex dots
            dotMat.disableLighting = true;
            dot.material = dotMat;
            dot.parent = preview; // Parent to preview so they get disposed together
          }
        }

        const ringThickness = 0.003; // 3mm tube thickness

        // ✅ CONFIRMED via cyan dot visualization: Option C is CORRECT!
        // The cyan dots (actual vertices) show the ring was TOO SMALL with Option B
        //
        // Babylon.js CreateTorus: 'diameter' = major diameter (centerline of tube)
        // - Tube is CENTERED on a circle of diameter D
        // - Tube has thickness T
        // - Outer radius = (D/2) + (T/2)
        //
        // We want: Outer edge aligns with detected circle edge
        // So: (D/2) + (T/2) = circleRadius
        // Therefore: D = (circleRadius * 2) - T
        //
        // This is Option A (the ORIGINAL formula that was working!)
        const torusDiameter = (circleRadius * 2) - ringThickness;

        const torusMinorRadius = ringThickness / 2;
        const torusMajorRadius = torusDiameter / 2;
        const torusOuterRadius = torusMajorRadius + torusMinorRadius;
        const torusInnerRadius = torusMajorRadius - torusMinorRadius;

        console.log(`[SnappingHelper] Torus dimensions: circleRadius=${(circleRadius * 1000).toFixed(3)}mm, diameter=${(torusDiameter * 1000).toFixed(3)}mm, thickness=${(ringThickness * 1000).toFixed(3)}mm`);
        console.log(`[SnappingHelper] Torus radii: major=${(torusMajorRadius * 1000).toFixed(3)}mm, minor=${(torusMinorRadius * 1000).toFixed(3)}mm, outer=${(torusOuterRadius * 1000).toFixed(3)}mm, inner=${(torusInnerRadius * 1000).toFixed(3)}mm`);
        
        const ring = BABYLON.MeshBuilder.CreateTorus('snapPreviewCircle', {
          diameter: torusDiameter,
          thickness: ringThickness,
          tessellation: 64
        }, scene);
        
        // Orient ring to match circle normal
        // Torus in Babylon.js: major circle lies in XZ plane, torus "normal" (through hole) is Y-axis
        // We need to rotate the torus so its Y-axis aligns with the circle normal
        // This will make the torus lie in the plane perpendicular to the circle normal
        
        const targetNormal = circleNormal.clone().normalize();
        const yAxis = new BABYLON.Vector3(0, 1, 0);
        
        // Check if normal is already aligned with Y-axis
        const dotY = BABYLON.Vector3.Dot(targetNormal, yAxis);
        const alignmentCheck = Math.abs(dotY);
        
        if (alignmentCheck > 0.999) {
          // Normal is parallel to Y-axis (within 0.1 degrees)
          if (dotY < 0) {
            // Normal points down (0, -1, 0), rotate torus 180 degrees around X axis to flip Y-axis
            ring.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(1, 0, 0), Math.PI);
            console.log(`[SnappingHelper] Torus rotation: Flipping 180° around X-axis for downward normal`);
          }
          // If dotY > 0, normal points up (0, 1, 0), torus is already correct - no rotation needed
        } else {
          // Normal is not aligned with Y-axis - need to rotate torus
          // Calculate rotation to align Y-axis with targetNormal
          const cross = BABYLON.Vector3.Cross(yAxis, targetNormal);
          const crossLength = cross.length();
          
          if (crossLength > 0.0001) {
            // Normalize the rotation axis
            const axis = cross.normalize();
            
            // Calculate angle between Y-axis and targetNormal
            // Use dotY directly (not abs) to get signed angle
            const angle = Math.acos(Math.max(-1, Math.min(1, dotY)));
            
            // Create rotation quaternion
            ring.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
            
            console.log(`[SnappingHelper] Torus rotation: axis=(${axis.x.toFixed(3)}, ${axis.y.toFixed(3)}, ${axis.z.toFixed(3)}), angle=${(angle * 180 / Math.PI).toFixed(1)}°, dotY=${dotY.toFixed(3)}`);
          } else {
            // Y-axis and targetNormal are parallel (shouldn't happen due to check above, but handle it)
            console.warn(`[SnappingHelper] Torus rotation: cross product too small (${crossLength.toFixed(6)}), using identity rotation`);
          }
        }
        
        ring.position = BABYLON.Vector3.Zero(); // Relative to parent (center dot)
        ring.renderingGroupId = 1;
        ring.isPickable = false;
        ring.parent = preview;
        
        // Verify torus orientation after rotation and parenting
        // Force matrix update to ensure rotation is applied
        ring.computeWorldMatrix(true);
        // Get the local rotation - transform Y-axis using the quaternion directly
        const quat = ring.rotationQuaternion || BABYLON.Quaternion.Identity();
        const rotMatrix = new BABYLON.Matrix();
        BABYLON.Matrix.FromQuaternionToRef(quat, rotMatrix);
        const torusYAxis = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 1, 0), rotMatrix);
        const torusAlignment = BABYLON.Vector3.Dot(torusYAxis.normalize(), targetNormal);
        console.log(`[SnappingHelper] Torus orientation check: torusYAxis=(${torusYAxis.x.toFixed(6)}, ${torusYAxis.y.toFixed(6)}, ${torusYAxis.z.toFixed(6)}), targetNormal=(${targetNormal.x.toFixed(6)}, ${targetNormal.y.toFixed(6)}, ${targetNormal.z.toFixed(6)}), alignment=${torusAlignment.toFixed(6)} (should be ~1.0)`);
        
        if (Math.abs(torusAlignment) < 0.9) {
          console.warn(`[SnappingHelper] WARNING: Torus Y-axis not aligned with circle normal! Alignment=${torusAlignment.toFixed(3)}`);
          // Try to fix: if alignment is close to -1, we're 180 degrees off
          if (torusAlignment < -0.9) {
            console.warn(`[SnappingHelper] Attempting to fix: rotating 180° around X-axis`);
            const currentRot = ring.rotationQuaternion || BABYLON.Quaternion.Identity();
            const flipRot = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(1, 0, 0), Math.PI);
            ring.rotationQuaternion = currentRot.multiply(flipRot);
            ring.computeWorldMatrix(true);
          }
        }
        
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
        
        console.log(`[SnappingHelper] Created center preview: orange circle ring (radius=${(circleRadius * 1000).toFixed(6)}mm, diameter=${(torusDiameter * 1000).toFixed(6)}mm, normal=(${targetNormal.x.toFixed(6)}, ${targetNormal.y.toFixed(6)}, ${targetNormal.z.toFixed(6)})) + orange dot at (${point.x.toFixed(6)}, ${point.y.toFixed(6)}, ${point.z.toFixed(6)})`);
      } else {
        console.warn(`[SnappingHelper] Center preview missing data: radius=${circleRadius}, normal=${!!circleNormal}`);
      }
      
      baseColor = isOnSelectedMesh
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(1, 0.5, 0); // Orange
    } else if (snapType === 'vertex') {
      // Vertex: Yellow diamond shape (box rotated 45°)
      const size = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateBox('snapPreviewVertex', { size }, scene);
      preview.position = point.clone();
      // Rotate to diamond orientation
      preview.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(
        Math.PI / 4, // 45° around Y
        Math.PI / 4, // 45° around X
        0
      );
      baseColor = isOnSelectedMesh
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(1, 0.84, 0); // Gold/Yellow
    } else if (snapType === 'edge') {
      // Edge: Cyan cylinder aligned with edge
      const diameter = isOnSelectedMesh ? 0.06 : 0.04;
      const height = 0.02; // Short cylinder
      preview = BABYLON.MeshBuilder.CreateCylinder('snapPreviewEdge', { diameter, height }, scene);
      preview.position = point.clone();
      baseColor = isOnSelectedMesh
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(0, 1, 1); // Cyan
    } else if (snapType === 'face') {
      // Face: Green square (flat box) lying flat on the face plane
      const size = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateBox('snapPreviewFace', {
        width: size,
        height: size,
        depth: 0.005 // Very thin
      }, scene);
      preview.position = point.clone();
      
      // Orient the square to lie flat on the face plane
      // The box's depth (Z-axis) should align with the face normal
      // so the square lies flat on the face surface
      const faceNormal = (point as any).faceNormal;
      if (faceNormal) {
        const normal = faceNormal.clone().normalize();
        
        // Default box has Z-axis as depth (forward)
        // We want the depth to align with the face normal
        const forward = new BABYLON.Vector3(0, 0, 1); // Box's local Z-axis (depth)
        
        // Calculate rotation to align Z-axis (depth) with face normal
        const dot = BABYLON.Vector3.Dot(forward, normal);
        
        // If normal is already aligned with Z, no rotation needed
        if (Math.abs(dot - 1.0) > 0.001 && Math.abs(dot + 1.0) > 0.001) {
          // Calculate rotation axis and angle
          const rotationAxis = BABYLON.Vector3.Cross(forward, normal);
          if (rotationAxis.length() > 0.0001) {
            rotationAxis.normalize();
            const rotationAngle = Math.acos(BABYLON.Vector3.Dot(forward, normal));
            preview.rotationQuaternion = BABYLON.Quaternion.RotationAxis(rotationAxis, rotationAngle);
          }
        } else if (Math.abs(dot + 1.0) < 0.001) {
          // Normal is opposite to Z, rotate 180 degrees around X or Y
          preview.rotation.x = Math.PI;
        }
      }
      
      baseColor = isOnSelectedMesh
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(0, 1, 0); // Green
    } else if (snapType === 'intersection') {
      // Intersection: Magenta X (two crossed boxes)
      const size = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateBox('snapPreviewIntersection', {
        width: size * 1.5,
        height: 0.005,
        depth: 0.005
      }, scene);
      preview.position = point.clone();

      // Add second bar
      const bar2 = BABYLON.MeshBuilder.CreateBox('snapPreviewIntersectionBar2', {
        width: size * 1.5,
        height: 0.005,
        depth: 0.005
      }, scene);
      bar2.rotation.z = Math.PI / 2; // 90° rotation
      bar2.parent = preview;

      baseColor = isOnSelectedMesh
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(1, 0, 1); // Magenta
    } else if (snapType === 'normal') {
      // Normal: Blue arrow pointing up
      const diameter = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateCylinder('snapPreviewNormal', {
        diameterTop: 0,
        diameterBottom: diameter,
        height: diameter * 2
      }, scene);
      preview.position = point.clone();
      baseColor = isOnSelectedMesh
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(0, 0.5, 1); // Blue
    } else if (snapType === 'bboxCorner') {
      // BBox Corner: White wireframe cube
      const size = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateBox('snapPreviewBBox', { size }, scene);
      preview.position = point.clone();
      baseColor = isOnSelectedMesh
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(0.8, 0.8, 0.8); // Light gray/white
    } else if (snapType === 'object') {
      // Object: Purple sphere (object center)
      const diameter = isOnSelectedMesh ? 0.08 : 0.06; // Slightly larger
      preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewObject', { diameter }, scene);
      preview.position = point.clone();
      baseColor = isOnSelectedMesh
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(0.8, 0, 0.8); // Purple
    } else {
      // Default fallback: Gray sphere
      const diameter = isOnSelectedMesh ? 0.06 : 0.04;
      preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewDot', { diameter }, scene);
      preview.position = point.clone();
      baseColor = isOnSelectedMesh
        ? new BABYLON.Color3(1, 1, 1)
        : new BABYLON.Color3(0.5, 0.5, 0.5); // Gray
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

    // Add glow to preview and all child meshes
    let glowLayer = scene.getGlowLayerByName('snap-preview-glow');
    if (!glowLayer) {
      glowLayer = new BABYLON.GlowLayer('snap-preview-glow', scene);
      glowLayer.intensity = 2.0;
    }
    glowLayer.intensity = isOnSelectedMesh ? 3.0 : 2.0;
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

    // Add all child meshes (ring, debug dots) to glow layer
    const childMeshes = preview.getChildMeshes();
    for (const child of childMeshes) {
      if (child instanceof BABYLON.Mesh) {
        glowLayer.addIncludedOnlyMesh(child);
      }
    }

    // Add midpoint line if it exists (not a child, stored separately)
    const midpointLine = (preview as any).__snapPreviewLine;
    if (midpointLine && midpointLine instanceof BABYLON.Mesh) {
      glowLayer.addIncludedOnlyMesh(midpointLine);
    }

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
        
        // Dispose the midpoint line if it exists (stored separately, not as child)
        const line = (this.previewIndicator as any).__snapPreviewLine;
        const lineMaterial = (this.previewIndicator as any).__snapPreviewLineMaterial;
        if (line) {
          // Remove from snapIndicators array if it's there
          const index = this.snapIndicators.indexOf(line);
          if (index > -1) {
            this.snapIndicators.splice(index, 1);
          }
          if (line.dispose) {
            line.dispose();
          }
        }
        if (lineMaterial && lineMaterial.dispose) {
          lineMaterial.dispose();
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

    let closestMidpoint: BABYLON.Vector3 | null = null;
    let closestEdgeStart: BABYLON.Vector3 | null = null;
    let closestEdgeEnd: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity; // Start with Infinity to find true closest, like vertex snapping
    let closestMeshName = '';
    let isFaceCenter = false; // Track if this is a face center (not edge midpoint)
    
    // Track face center separately so we can compare with edge midpoints
    let faceCenterMidpoint: BABYLON.Vector3 | null = null;
    let faceCenterDistance = Infinity;
    let faceCenterMeshName = '';

    // First, check for object centers (bounding box centers) when clicking on faces
    // This allows center-to-center measurements on boxes using midpoint snap
    // But we'll compare with edge midpoints later to prefer edges when clicking near them
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snap') ||
        mesh.name.startsWith('circle') ||
        mesh.name.startsWith('measurement') ||
        mesh.name.startsWith('transform_label')
      ) {
        continue;
      }

      // Get bounding box center - this is the center for boxes
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();
      const boundingBox = boundingInfo.boundingBox;
      const objectCenter = boundingBox.centerWorld;
      
      // Check if the clicked position is within the bounding box bounds
      // This means we're clicking on the object itself
      const min = boundingBox.minimumWorld;
      const max = boundingBox.maximumWorld;
      
      // Add a small tolerance (5mm) to account for floating point precision
      const tolerance = 0.005;
      const isWithinBounds = 
        position.x >= min.x - tolerance && position.x <= max.x + tolerance &&
        position.y >= min.y - tolerance && position.y <= max.y + tolerance &&
        position.z >= min.z - tolerance && position.z <= max.z + tolerance;
      
      if (isWithinBounds) {
        // If clicking within the bounding box, store the object center for later comparison
        // We'll prefer edge midpoints if they're close, but use face center as fallback
        const distanceToCenter = BABYLON.Vector3.Distance(position, objectCenter);
        if (distanceToCenter < faceCenterDistance) {
          faceCenterDistance = distanceToCenter;
          faceCenterMidpoint = objectCenter;
          faceCenterMeshName = mesh.name;
        }
      }
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

    // Edge deduplication: Track seen edges to avoid processing duplicates
    // Key format: "meshId:minIdx-maxIdx" where minIdx < maxIdx
    const seenEdges = new Set<string>();

    // Now check edge midpoints (only if we haven't found a face center, or if edge is closer)
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snap') || // Exclude snap preview meshes
        mesh.name.startsWith('circle') || // Exclude debug visualization
        mesh.name.startsWith('measurement') ||
        mesh.name.startsWith('transform_label')
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (!positions || !indices) continue;

      meshesChecked++;
      const worldMatrix = mesh.computeWorldMatrix(true);
      const meshId = mesh.uniqueId.toString();

      // Check each edge midpoint
      for (let i = 0; i < indices.length; i += 3) {
        const edges = [
          [indices[i], indices[i + 1]],
          [indices[i + 1], indices[i + 2]],
          [indices[i + 2], indices[i]],
        ];

        for (const [idx1, idx2] of edges) {
          // Deduplicate edges: create consistent key regardless of vertex order
          const minIdx = Math.min(idx1, idx2);
          const maxIdx = Math.max(idx1, idx2);
          const edgeKey = `${meshId}:${minIdx}-${maxIdx}`;

          if (seenEdges.has(edgeKey)) {
            continue; // Skip duplicate edge
          }
          seenEdges.add(edgeKey);

          const start = idx1 * 3;
          const end = idx2 * 3;

          const v1 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[start], positions[start + 1], positions[start + 2]),
            worldMatrix
          );
          const v2 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[end], positions[end + 1], positions[end + 2]),
            worldMatrix
          );

          // Filter out very short edges (< 5mm) - likely triangulation artifacts
          const edgeLength = BABYLON.Vector3.Distance(v1, v2);
          if (edgeLength < 0.005) {
            continue;
          }

          const midpoint = v1.add(v2).scale(0.5);
          const distance = BABYLON.Vector3.Distance(position, midpoint);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestMidpoint = midpoint;
            closestEdgeStart = v1.clone();
            closestEdgeEnd = v2.clone();
            closestMeshName = mesh.name;
          }
        }
      }
    }

    // After checking all edges, compare with face center
    // Prefer edge midpoints when found, but use face center as fallback if no edge is close
    // IMPORTANT: Only use face center if we don't have an edge midpoint with endpoints
    if (faceCenterMidpoint && !closestMidpoint) {
      // No edge midpoint found at all - use face center as fallback
      closestMidpoint = faceCenterMidpoint;
      closestDistance = faceCenterDistance;
      closestMeshName = faceCenterMeshName;
      isFaceCenter = true;
      closestEdgeStart = null;
      closestEdgeEnd = null;
    }

    // Determine if we should snap based on the method used
    let shouldSnap = false;
    if (closestMidpoint) {
      // Check if we have edge endpoints (for edge midpoints) or not (for face centers)
      if (closestEdgeStart && closestEdgeEnd) {
        // Edge midpoint - check distance
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
      } else if (isFaceCenter) {
        // Face center - check distance
        if (camera && screenSpacePixels !== undefined && screenPos) {
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
          shouldSnap = closestDistance <= snapDistanceMeters;
        }
      }
    }
    
    // Check if we found a midpoint within snap distance
    if (closestMidpoint && shouldSnap) {
      // If it's a face center, return it (for center-to-center measurements)
      if (isFaceCenter) {
        return {
          snapped: true,
          position: closestMidpoint,
          snapType: 'midpoint',
          targetMeshName: closestMeshName,
          visualFeedback: [closestMidpoint], // Face center doesn't need edge endpoints
        };
      }
      
      // Otherwise, it's an edge midpoint - must have edge endpoints
      if (closestEdgeStart && closestEdgeEnd) {
        return {
          snapped: true,
          position: closestMidpoint,
          snapType: 'midpoint',
          targetMeshName: closestMeshName,
          visualFeedback: [closestMidpoint, closestEdgeStart, closestEdgeEnd],
        };
      }
    }

    // Debug: log if no midpoint found or if midpoint was too far (less frequently now)
    // No midpoint snap found (logging removed to reduce console spam)

    return { snapped: false, position: position.clone() };
  }

  /**
   * Snap to edge intersection points
   */
  private snapToIntersection(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    // Convert position to screen space if camera provided
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

    const snapDistanceMeters = snapDistance / 1000;
    let closestIntersection: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity;
    let closestScreenDistance = Infinity; // Track closest screen-space distance when using screen-space snapping
    let closestMeshName = '';

    // Collect all edges from all meshes
    const allEdges: Array<{ v1: BABYLON.Vector3; v2: BABYLON.Vector3; meshName: string }> = [];

    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snap') || // Exclude snap preview meshes
        mesh.name.startsWith('circle') || // Exclude debug visualization
        mesh.name.startsWith('measurement') ||
        mesh.name.startsWith('transform_label')
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

    // Find intersections between edges from different meshes
    // Also check edge-to-face intersections for better detection
    for (let i = 0; i < allEdges.length; i++) {
      for (let j = i + 1; j < allEdges.length; j++) {
        const edge1 = allEdges[i];
        const edge2 = allEdges[j];

        // Only check intersections between edges from different meshes
        // (edges from same mesh are already connected at vertices)
        if (edge1.meshName === edge2.meshName) {
          continue;
        }

        // Find closest point between two line segments
        const closestPoints = this.closestPointsBetweenSegments(
          edge1.v1,
          edge1.v2,
          edge2.v1,
          edge2.v2
        );

        if (closestPoints) {
          const { point1, point2, distance: segDistance } = closestPoints;

          // Increased threshold: 5mm (0.005m) to catch more intersections
          // This handles floating point precision issues and slightly non-coplanar edges
          if (segDistance < 0.005) {
            const intersectionPoint = point1.add(point2).scale(0.5);
            
            // Verify the intersection point is actually on both edges (within tolerance)
            const edge1Dir = edge1.v2.subtract(edge1.v1);
            const edge1Len = edge1Dir.length();
            if (edge1Len > 0.0001) {
              edge1Dir.normalize();
              const toIntersection1 = intersectionPoint.subtract(edge1.v1);
              const proj1 = BABYLON.Vector3.Dot(toIntersection1, edge1Dir);
              if (proj1 < -0.001 || proj1 > edge1Len + 0.001) {
                continue; // Intersection point is not on edge1
              }
            }
            
            const edge2Dir = edge2.v2.subtract(edge2.v1);
            const edge2Len = edge2Dir.length();
            if (edge2Len > 0.0001) {
              edge2Dir.normalize();
              const toIntersection2 = intersectionPoint.subtract(edge2.v1);
              const proj2 = BABYLON.Vector3.Dot(toIntersection2, edge2Dir);
              if (proj2 < -0.001 || proj2 > edge2Len + 0.001) {
                continue; // Intersection point is not on edge2
              }
            }
            
            const distance = BABYLON.Vector3.Distance(position, intersectionPoint);
            
            // When using screen-space snapping, prioritize intersections closest in screen space
            if (camera && screenSpacePixels !== undefined && screenPos) {
              const worldMatrix = scene.getTransformMatrix();
              const viewport = camera.viewport.toGlobal(
                scene.getEngine().getRenderWidth(),
                scene.getEngine().getRenderHeight()
              );
              const projected = BABYLON.Vector3.Project(
                intersectionPoint,
                worldMatrix,
                camera.getProjectionMatrix(),
                viewport
              );
              const screenDist = Math.sqrt(
                Math.pow(projected.x - screenPos.x, 2) +
                Math.pow(projected.y - screenPos.y, 2)
              );
              
              if (screenDist < closestScreenDistance) {
                closestScreenDistance = screenDist;
                closestDistance = distance; // Keep world distance for reference
                closestIntersection = intersectionPoint;
                closestMeshName = edge1.meshName;
              }
            } else {
              // Fall back to world-space distance when screen-space is not available
              if (distance < closestDistance) {
                closestDistance = distance;
                closestIntersection = intersectionPoint;
                closestMeshName = edge1.meshName;
              }
            }
          }
        }
      }
    }
    
    // Also check for edge-to-face intersections (edges from one mesh intersecting faces of another)
    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snap') ||
        mesh.name.startsWith('circle') ||
        mesh.name.startsWith('measurement') ||
        mesh.name.startsWith('transform_label')
      ) {
        continue;
      }

      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();
      if (!positions || !indices) continue;

      const worldMatrix = mesh.computeWorldMatrix(true);
      
      // Check each edge from allEdges against faces of this mesh
      for (const edge of allEdges) {
        // Skip if edge is from the same mesh
        if (edge.meshName === mesh.name) continue;
        
        // Check edge against each triangle face
        for (let i = 0; i < indices.length; i += 3) {
          const idx0 = indices[i] * 3;
          const idx1 = indices[i + 1] * 3;
          const idx2 = indices[i + 2] * 3;
          
          const v0 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[idx0], positions[idx0 + 1], positions[idx0 + 2]),
            worldMatrix
          );
          const v1 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[idx1], positions[idx1 + 1], positions[idx1 + 2]),
            worldMatrix
          );
          const v2 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(positions[idx2], positions[idx2 + 1], positions[idx2 + 2]),
            worldMatrix
          );
          
          // Check if edge intersects this triangle face
          const edgeDir = edge.v2.subtract(edge.v1);
          const edgeLen = edgeDir.length();
          if (edgeLen < 0.0001) continue;
          
          const edgeDirNorm = edgeDir.normalize();
          const intersection = this.rayTriangleIntersection(
            edge.v1,
            edgeDirNorm,
            v0,
            v1,
            v2
          );
          
          if (intersection) {
            // Verify intersection is within the edge segment
            const toIntersection = intersection.subtract(edge.v1);
            const proj = BABYLON.Vector3.Dot(toIntersection, edgeDirNorm);
            if (proj >= -0.001 && proj <= edgeLen + 0.001) {
              const distance = BABYLON.Vector3.Distance(position, intersection);
              
              // When using screen-space snapping, prioritize intersections closest in screen space
              if (camera && screenSpacePixels !== undefined && screenPos) {
                const worldMatrix = scene.getTransformMatrix();
                const viewport = camera.viewport.toGlobal(
                  scene.getEngine().getRenderWidth(),
                  scene.getEngine().getRenderHeight()
                );
                const projected = BABYLON.Vector3.Project(
                  intersection,
                  worldMatrix,
                  camera.getProjectionMatrix(),
                  viewport
                );
                const screenDist = Math.sqrt(
                  Math.pow(projected.x - screenPos.x, 2) +
                  Math.pow(projected.y - screenPos.y, 2)
                );
                
                if (screenDist < closestScreenDistance) {
                  closestScreenDistance = screenDist;
                  closestDistance = distance; // Keep world distance for reference
                  closestIntersection = intersection;
                  closestMeshName = mesh.name;
                }
              } else {
                // Fall back to world-space distance when screen-space is not available
                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestIntersection = intersection;
                  closestMeshName = mesh.name;
                }
              }
            }
          }
        }
      }
    }

    // Determine if we should snap
    let shouldSnap = false;
    if (closestIntersection) {
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Use the screen-space distance we already calculated
        shouldSnap = closestScreenDistance <= screenSpacePixels;
      } else {
        // Check world-space distance for actual snapping
        shouldSnap = closestDistance <= snapDistanceMeters;
      }
    }

    if (closestIntersection && shouldSnap) {
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
   * Ray-triangle intersection using Möller-Trumbore algorithm
   * Returns intersection point if ray intersects triangle, null otherwise
   */
  private rayTriangleIntersection(
    rayOrigin: BABYLON.Vector3,
    rayDir: BABYLON.Vector3,
    v0: BABYLON.Vector3,
    v1: BABYLON.Vector3,
    v2: BABYLON.Vector3
  ): BABYLON.Vector3 | null {
    const EPSILON = 0.0000001;
    
    const edge1 = v1.subtract(v0);
    const edge2 = v2.subtract(v0);
    const h = BABYLON.Vector3.Cross(rayDir, edge2);
    const a = BABYLON.Vector3.Dot(edge1, h);
    
    if (a > -EPSILON && a < EPSILON) {
      return null; // Ray is parallel to triangle
    }
    
    const f = 1.0 / a;
    const s = rayOrigin.subtract(v0);
    const u = f * BABYLON.Vector3.Dot(s, h);
    
    if (u < 0.0 || u > 1.0) {
      return null; // Intersection point is outside triangle
    }
    
    const q = BABYLON.Vector3.Cross(s, edge1);
    const v = f * BABYLON.Vector3.Dot(rayDir, q);
    
    if (v < 0.0 || u + v > 1.0) {
      return null; // Intersection point is outside triangle
    }
    
    const t = f * BABYLON.Vector3.Dot(edge2, q);
    
    if (t > EPSILON) {
      // Ray intersection
      return rayOrigin.add(rayDir.scale(t));
    }
    
    return null; // Line intersection but behind ray origin
  }

  /**
   * Snap to face normal direction
   */
  private snapToNormal(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    // Convert position to screen space if camera provided
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
    let closestDistance = Infinity;
    let closestMeshName = '';

    for (const dir of directions) {
      const ray = new BABYLON.Ray(position, dir, snapDistanceMeters);
      const pickInfo = scene.pickWithRay(ray, (mesh) => {
        return (
          mesh.isVisible &&
          !excludeMeshIds.includes(mesh.uniqueId.toString()) &&
          mesh.name !== 'ground' &&
          mesh.name !== 'gridOverlay' &&
          !mesh.name.startsWith('snap') && // Exclude snap preview meshes
          !mesh.name.startsWith('circle') && // Exclude debug visualization
          !mesh.name.startsWith('measurement') &&
          !mesh.name.startsWith('transform_label')
        );
      });

      if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
        const normal = pickInfo.getNormal(true);
        if (normal) {
          // Snap to surface point (no offset - user can drag along normal after snapping)
          const snapPoint = pickInfo.pickedPoint.clone();
          const distance = BABYLON.Vector3.Distance(position, snapPoint);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = snapPoint;
            closestMeshName = pickInfo.pickedMesh?.name || '';
          }
        }
      }
    }

    // Determine if we should snap
    let shouldSnap = false;
    if (closestPoint) {
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Check screen-space distance for preview
        const worldMatrix = scene.getTransformMatrix();
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestPoint,
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

    if (closestPoint && shouldSnap) {
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
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number
  ): SnapResult {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return { snapped: false, position: position.clone() };

    // Convert position to screen space if camera provided
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

    const snapDistanceMeters = snapDistance / 1000;
    let closestCorner: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity;
    let closestMeshName = '';

    for (const mesh of scene.meshes) {
      if (
        !mesh.isVisible ||
        excludeMeshIds.includes(mesh.uniqueId.toString()) ||
        mesh.name === 'ground' ||
        mesh.name === 'gridOverlay' ||
        mesh.name.startsWith('snap') || // Exclude snap preview meshes
        mesh.name.startsWith('circle') || // Exclude debug visualization
        mesh.name.startsWith('measurement') ||
        mesh.name.startsWith('transform_label')
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

    // Determine if we should snap
    let shouldSnap = false;
    if (closestCorner) {
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Check screen-space distance for preview
        const worldMatrix = scene.getTransformMatrix();
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestCorner,
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

    if (closestCorner && shouldSnap) {
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

