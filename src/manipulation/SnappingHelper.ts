// Snapping Helper - Provides comprehensive snapping functionality
// Owner: George (core logic) + Cole (3D integration)
// Handles grid, vertex, edge, face, and center snapping

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../scene/SceneManager';
import { isSnapExcluded } from './snapConstants';
import { DEBUG_SNAP as DEBUG_SNAP_FLAG, showPreviewDot, clearPreviewDot, PreviewState } from './snap/preview';
import { snapToObjectStrategy } from './snap/objectSnap';
import { snapToVertexStrategy } from './snap/vertexSnap';
import { snapToMidpointStrategy } from './snap/midpointSnap';
import { snapToEdgeStrategy } from './snap/edgeSnap';
import { snapToFaceStrategy } from './snap/faceSnap';
import { snapToCenterStrategy } from './snap/centerSnap';

// ============================================================================
// SCREEN-SPACE BINNING: Fast vertex discovery via screen-space grid
// ============================================================================


// ============================================================================
// SNAP INTERFACES
// ============================================================================

import { SnapType, SnapResult } from './snap/snapTypes';

export type { SnapType, SnapResult };

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

  // Preview state managed by SnappingHelper (owner of preview lifecycle)
  private previewState: PreviewState = {
    previewIndicator: null,
    setPreviewIndicator: (mesh: BABYLON.Mesh | null) => {
      this.previewIndicator = mesh;
      this.previewState.previewIndicator = mesh;
    }
  };

  // Debug flags for verbose logging (set to true only during development/debugging)
  // Use imported constants from preview module
  private static get DEBUG_SNAP() { return DEBUG_SNAP_FLAG; }

  private constructor() {
    // Initialize preview state
    this.previewState.previewIndicator = this.previewIndicator;
  }

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
   * @param pointerScreenX - Optional pointer screen X coordinate (render pixels)
   * @param pointerScreenY - Optional pointer screen Y coordinate (render pixels)
   */
  private smartSnapPosition(
    position: BABYLON.Vector3,
    settings: SnapSettings,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number,
    clickedMesh?: BABYLON.AbstractMesh | null,
    clickedPoint?: BABYLON.Vector3 | null,
    pointerScreenX?: number,
    pointerScreenY?: number
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
      const result = this.snapToVertex(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels, pointerScreenX, pointerScreenY);
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
      const result = this.snapToCenter(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels, pointerScreenX, pointerScreenY);
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
      const result = this.snapToFace(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels, clickedMesh, clickedPoint);
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
    // Special handling for center vs midpoint: prefer center for circular faces, midpoint for edge midpoints
    filteredCandidates.sort((a, b) => {
      const distDiff = a.distance - b.distance;
      
      // Special case: Center vs Midpoint
      // If center snap detects a circular face center and midpoint detects a face center (bounding box),
      // prefer center snap as it's more geometrically accurate for circular geometry
      const isCenterVsMidpoint = 
        (a.result.snapType === 'center' && b.result.snapType === 'midpoint') ||
        (a.result.snapType === 'midpoint' && b.result.snapType === 'center');
      
      if (isCenterVsMidpoint) {
        const centerCandidate = a.result.snapType === 'center' ? a : b;
        const midpointCandidate = a.result.snapType === 'midpoint' ? a : b;
        
        // Check if center snap detected a circle (has radius in visualFeedback)
        // Center snap stores radius as visualFeedback[2].x when a circle is detected
        const centerHasCircle = centerCandidate.result.visualFeedback && 
                               centerCandidate.result.visualFeedback.length >= 3 &&
                               centerCandidate.result.visualFeedback[2] instanceof BABYLON.Vector3 &&
                               (centerCandidate.result.visualFeedback[2] as BABYLON.Vector3).x > 0;
        
        // Check if they're detecting the same or very close positions (within 5mm)
        const posDiff = BABYLON.Vector3.Distance(
          centerCandidate.result.position,
          midpointCandidate.result.position
        );
        
        if (posDiff < 0.005) { // Within 5mm - likely the same logical point
          // If center snap detected a circle, always prefer it over midpoint
          // Circle fitting is more accurate than bounding box center for circular faces
          if (centerHasCircle) {
            // Center wins for circular faces (more accurate geometric calculation)
            return a.result.snapType === 'center' ? -1 : 1;
          }
          
          // If center didn't detect a circle, check if midpoint is a face center vs edge midpoint
          // Face centers have visualFeedback.length === 1, edge midpoints have length === 3
          const midpointHasEdges = midpointCandidate.result.visualFeedback && 
                                   midpointCandidate.result.visualFeedback.length >= 3;
          
          // If midpoint is a face center (no edges), both are detecting centers
          // Prefer center snap as it might be more accurate even if not a perfect circle
          if (!midpointHasEdges) {
            // Center wins for geometric centers (more accurate than bounding box)
            return a.result.snapType === 'center' ? -1 : 1;
          } else {
            // Midpoint has edges, so it's an actual edge midpoint - prefer midpoint
            // Edge midpoints are more specific than general centers
            return a.result.snapType === 'midpoint' ? -1 : 1;
          }
        }
        
        // If positions are different (> 5mm apart), prefer the closer one
        // This handles cases where center finds a circle center and midpoint finds a different edge midpoint
        // Distance comparison will handle this in the default case below
      }
      
      // Default: If distances are within 3mm (very close), use priority to prefer more precise snaps
      // This gives higher priority snaps (vertex, midpoint) a better chance to win
      if (Math.abs(distDiff) < 0.003) { // 3mm threshold
        return a.priority - b.priority;
      }
      return distDiff;
    });

    // Return the best candidate
    const best = filteredCandidates[0];
    
    // DEBUG: Compare face and center snap results when both are candidates
    if (best.result.snapType === 'center' || best.result.snapType === 'face') {
      const faceCandidate = filteredCandidates.find(c => c.result.snapType === 'face');
      const centerCandidate = filteredCandidates.find(c => c.result.snapType === 'center');
      
      if (faceCandidate && centerCandidate && faceCandidate.result.targetMeshName === centerCandidate.result.targetMeshName) {
        const facePos = faceCandidate.result.position;
        const centerPos = centerCandidate.result.position;
        const posDiff = BABYLON.Vector3.Distance(facePos, centerPos);
        
        if (SnappingHelper.DEBUG_SNAP) {
          console.log(`[SnappingHelper] 🔍 COMPARING FACE vs CENTER SNAP:`);
          console.log(`  Mesh: ${faceCandidate.result.targetMeshName}`);
          console.log(`  Face snap position: (${facePos.x.toFixed(6)}, ${facePos.y.toFixed(6)}, ${facePos.z.toFixed(6)})`);
          console.log(`  Center snap position: (${centerPos.x.toFixed(6)}, ${centerPos.y.toFixed(6)}, ${centerPos.z.toFixed(6)})`);
          console.log(`  Position difference: ${(posDiff * 1000).toFixed(3)}mm`);
          console.log(`  Selected snap type: ${best.result.snapType} (priority: ${best.priority})`);
        }
        
        if (posDiff > 0.0001) { // > 0.1mm difference
          console.warn(`[SnappingHelper] ⚠️ WARNING: Face and center snap positions differ by ${(posDiff * 1000).toFixed(3)}mm!`);
        } else {
          if (SnappingHelper.DEBUG_SNAP) {
            console.log(`[SnappingHelper] ✅ Face and center snap positions match (within 0.1mm)`);
          }
        }
      }
    }
    
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
   * @param pointerScreenX - Optional pointer screen X coordinate (render pixels) for accurate snap detection
   * @param pointerScreenY - Optional pointer screen Y coordinate (render pixels) for accurate snap detection
   */
  snapPosition(
    position: BABYLON.Vector3,
    settings: SnapSettings,
    excludeMeshIds: string[] = [],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number,
    smartSelect: boolean = true,
    clickedMesh?: BABYLON.AbstractMesh | null,
    clickedPoint?: BABYLON.Vector3 | null,
    pointerScreenX?: number,
    pointerScreenY?: number
  ): SnapResult {
    if (!settings.enabled) {
      return { snapped: false, position: position.clone() };
    }

    // SMART SNAP SELECTOR: Try all enabled snap types and return the closest
    // This provides a better UX - users don't need to manually toggle snap types
    if (smartSelect) {
      return this.smartSnapPosition(position, settings, excludeMeshIds, camera, screenSpacePixels, clickedMesh, clickedPoint, pointerScreenX, pointerScreenY);
    }

    // LEGACY MODE: Try snapping in order of priority (first match wins)
    let result: SnapResult | null = null;

    // 1. Vertex snapping (highest priority - most precise)
    if (settings.snapToVertex) {
      result = this.snapToVertex(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels, pointerScreenX, pointerScreenY);
      if (result.snapped) return result;
    }

    // 2. Midpoint snapping
    if (settings.snapToMidpoint) {
      result = this.snapToMidpoint(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) {
        if (SnappingHelper.DEBUG_SNAP) {
          console.log(`[SnappingHelper] MIDPOINT SNAP: result.snapped=${result.snapped}, visualFeedback.length=${result.visualFeedback?.length || 0}, snapType=${result.snapType}`);
        }
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
      result = this.snapToFace(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels, clickedMesh, clickedPoint);
      if (result.snapped) return result;
    }

    // 6. Normal snapping
    if (settings.snapToNormal) {
      result = this.snapToNormal(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels);
      if (result.snapped) return result;
    }

    // 7. Center snapping (circle centers)
    if (settings.snapToCenter) {
      result = this.snapToCenter(position, settings.snapDistance, excludeMeshIds, camera, screenSpacePixels, pointerScreenX, pointerScreenY);
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
   * @param pointerScreenX - Optional pointer screen X coordinate (render pixels) for accurate snap detection
   * @param pointerScreenY - Optional pointer screen Y coordinate (render pixels) for accurate snap detection
   */
  private snapToVertex(
    position: BABYLON.Vector3,
    _snapDistance: number,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number,
    pointerScreenX?: number,
    pointerScreenY?: number
  ): SnapResult {
    return snapToVertexStrategy({
      position,
      snapDistance: _snapDistance,
      excludeMeshIds,
      camera,
      screenSpacePixels,
      pointerScreenX,
      pointerScreenY,
      onPreview: (point, snapType) => {
        // Attach edge endpoints to point for midpoint preview (if available from visualFeedback)
        // The preview system expects edgeStart/edgeEnd on the point for midpoint snaps
        showPreviewDot(point, snapType, this.previewState);
      },
      onClearPreview: () => clearPreviewDot(this.previewState),
    });
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
    return snapToEdgeStrategy({
      position,
      snapDistance,
      excludeMeshIds,
      camera,
      screenSpacePixels,
    });
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
    return snapToFaceStrategy({
      position,
      snapDistance,
      excludeMeshIds,
      camera,
      screenSpacePixels,
      clickedMesh,
      clickedPoint,
    });
  }

  /**
   * Snap to circle center (e.g., cylinder end faces)
   */
  private snapToCenter(
    position: BABYLON.Vector3,
    snapDistance: number,
    excludeMeshIds: string[],
    camera?: BABYLON.Camera,
    screenSpacePixels?: number,
    pointerScreenX?: number,
    pointerScreenY?: number
  ): SnapResult {
    return snapToCenterStrategy({
      position,
      snapDistance,
      excludeMeshIds,
      camera,
      screenSpacePixels,
      pointerScreenX,
      pointerScreenY,
    });
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
    return snapToObjectStrategy({
      position,
      snapDistance,
      excludeMeshIds,
      camera,
      screenSpacePixels,
    });
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
   * Clear all snap indicators
   */
  clearSnapIndicators(): void {
    for (const indicator of this.snapIndicators) {
      indicator.dispose();
    }
    this.snapIndicators = [];
  }

  /**
   * Show preview dot at a position with optional snap type for different visuals
   * Delegates to centralized preview system in preview.ts
   * 
   * @param point - Position to show preview (may have metadata attached: edgeStart/edgeEnd for midpoint, circleNormal/circleRadius for center, faceNormal for face)
   * @param snapType - Type of snap (vertex, midpoint, center, face, etc.) for different visuals
   */
  showPreviewDot(point: BABYLON.Vector3, snapType?: string): void {
    showPreviewDot(point, snapType, this.previewState);
  }

  /**
   * Clear preview dot and all child meshes (lines, rings, etc.)
   * Delegates to centralized preview system in preview.ts
   */
  clearPreviewDot(): void {
    clearPreviewDot(this.previewState);
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
    return snapToMidpointStrategy({
      position,
      snapDistance,
      excludeMeshIds,
      camera,
      screenSpacePixels,
    });
  }

  /**
   * Snap to edge intersection points
   */
  private snapToIntersection(
    position: BABYLON.Vector3,
    _snapDistance: number,
    _excludeMeshIds: string[],
    _camera?: BABYLON.Camera,
    _screenSpacePixels?: number
  ): SnapResult {
    // 🚨 DISABLED: Intersection snapping has O(n²) complexity and causes lock-up on complex models
    // Re-enable after implementing spatial partitioning (BVH/octree) or worker-based queries
    return { snapped: false, position: position.clone() };
  }

  /**
   * Find closest points between two line segments
   * @deprecated Used only by disabled intersection snapping
   */
  // @ts-ignore - Unused but kept for when intersection snapping is re-enabled
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
      const viewport = camera.viewport.toGlobal(
        scene.getEngine().getRenderWidth(),
        scene.getEngine().getRenderHeight()
      );
      // Use Identity for world matrix (position is already in world space)
      // Use scene transform matrix (view * projection combined) as second parameter
      const projected = BABYLON.Vector3.Project(
        position,
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
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
          !mesh.name.startsWith('snapIndicator') &&
          !mesh.name.startsWith('snapPreviewDot') &&
          !mesh.name.startsWith('snapPreviewCircle') &&
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
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestPoint,
          BABYLON.Matrix.Identity(),
          scene.getTransformMatrix(),
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
      const viewport = camera.viewport.toGlobal(
        scene.getEngine().getRenderWidth(),
        scene.getEngine().getRenderHeight()
      );
      // Use Identity for world matrix (position is already in world space)
      // Use scene transform matrix (view * projection combined) as second parameter
      const projected = BABYLON.Vector3.Project(
        position,
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
        viewport
      );
      screenPos = { x: projected.x, y: projected.y };
    }

    const snapDistanceMeters = snapDistance / 1000;
    let closestCorner: BABYLON.Vector3 | null = null;
    let closestDistance = Infinity;
    let closestMeshName = '';

    for (const mesh of scene.meshes) {
      // Use centralized exclusion predicate + explicit excludeIds
      if (isSnapExcluded(mesh) || excludeMeshIds.includes(mesh.uniqueId.toString())) {
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
        const viewport = camera.viewport.toGlobal(
          scene.getEngine().getRenderWidth(),
          scene.getEngine().getRenderHeight()
        );
        const projected = BABYLON.Vector3.Project(
          closestCorner,
          BABYLON.Matrix.Identity(),
          scene.getTransformMatrix(),
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
