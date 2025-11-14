// Center (circle) snap strategy - snap to circle centers
// Extracted from SnappingHelper.ts for better organization

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { isSnapExcluded } from '../snapConstants';
import { SnapResult } from './snapTypes';
import { fitCircleToPoints, tryCircleCenter, projectToScreen, OCCLUSION_PAD_MM } from './snapHelpers';
import { DEFAULT_SNAP_CIRCLE_CONFIG } from './snapConfig';
import { DEBUG_SNAP, DEBUG_SNAP_DIAG } from './preview';

export type CenterSnapArgs = {
  position: BABYLON.Vector3;
  snapDistance: number;
  excludeMeshIds: string[];
  camera?: BABYLON.Camera;
  screenSpacePixels?: number;
  pointerScreenX?: number;
  pointerScreenY?: number;
};

/**
 * Snap to circle center (e.g., cylinder end faces)
 * Uses screen-space circle detection when pointer coordinates are available,
 * falls back to legacy mesh-based detection otherwise.
 */
export function snapToCenterStrategy(args: CenterSnapArgs): SnapResult {
  const { position, snapDistance, excludeMeshIds, camera, screenSpacePixels, pointerScreenX, pointerScreenY } = args;
  
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) return { snapped: false, position: position.clone() };

  // Try new screen-space circle detection approach first
  if (camera && screenSpacePixels !== undefined && pointerScreenX !== undefined && pointerScreenY !== undefined) {
    const engine = scene.getEngine();
    if (engine) {
      const dpr = 1 / engine.getHardwareScalingLevel();
      const centerCss = 140; // Default threshold, can be made configurable later
      
      // Collect visible edge midpoints with occlusion gating
      const visiblePts: { w: BABYLON.Vector3; sx: number; sy: number; occluded?: boolean }[] = [];
      
      // Set up occlusion gating (similar to snapToVertex)
      const ray = scene.createPickingRay(pointerScreenX, pointerScreenY, BABYLON.Matrix.Identity(), camera, false);
      let frontDepth = Number.POSITIVE_INFINITY;
      const allMeshes = new Set<BABYLON.Mesh>();
      for (const m of scene.meshes) {
        if (isSnapExcluded(m) || excludeMeshIds.includes(m.uniqueId.toString())) continue;
        if (m instanceof BABYLON.Mesh) allMeshes.add(m);
      }
      const hits = scene.multiPickWithRay(ray, m => allMeshes.has(m as BABYLON.Mesh)) || [];
      for (const h of hits) {
        if (h?.hit && h.distance < frontDepth) frontDepth = h.distance;
      }
      const pad = 0.001 * OCCLUSION_PAD_MM;
      const hasDepthGate = Number.isFinite(frontDepth);
      const _tmp = new BABYLON.Vector3();
      const isOccluded = (worldVertex: BABYLON.Vector3): boolean => {
        if (!hasDepthGate) return false;
        _tmp.copyFrom(worldVertex).subtractInPlace(ray.origin);
        const t = BABYLON.Vector3.Dot(_tmp, ray.direction);
        if (t > frontDepth + pad) return true;
        if (t < 0) return true;
        return false;
      };
      
      // Collect edge midpoints
      const seenEdges = new Set<string>();
      for (const mesh of allMeshes) {
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const indices = mesh.getIndices();
        if (!positions || !indices) continue;
        
        mesh.computeWorldMatrix(true);
        const worldMatrix = mesh.getWorldMatrix();
        const meshId = mesh.uniqueId.toString();
        
        for (let i = 0; i < indices.length; i += 3) {
          const edges = [
            [indices[i], indices[i + 1]],
            [indices[i + 1], indices[i + 2]],
            [indices[i + 2], indices[i]],
          ];
          
          for (const [idx1, idx2] of edges) {
            const minIdx = Math.min(idx1, idx2);
            const maxIdx = Math.max(idx1, idx2);
            const edgeKey = `${meshId}:${minIdx}-${maxIdx}`;
            if (seenEdges.has(edgeKey)) continue;
            seenEdges.add(edgeKey);
            
            const v1 = BABYLON.Vector3.TransformCoordinates(
              new BABYLON.Vector3(positions[idx1 * 3], positions[idx1 * 3 + 1], positions[idx1 * 3 + 2]),
              worldMatrix
            );
            const v2 = BABYLON.Vector3.TransformCoordinates(
              new BABYLON.Vector3(positions[idx2 * 3], positions[idx2 * 3 + 1], positions[idx2 * 3 + 2]),
              worldMatrix
            );
            
            const midpoint = v1.add(v2).scale(0.5);
            if (isOccluded(midpoint)) continue;
            
            const s = projectToScreen(midpoint, scene, camera);
            if (!s) continue;
            
            visiblePts.push({ w: midpoint, sx: s.x, sy: s.y, occluded: false });
          }
        }
      }
      
      // Performance timing
      const startTime = performance.now();
      
      // Try circle detection with config
      const config = DEFAULT_SNAP_CIRCLE_CONFIG;
      const circleResult = tryCircleCenter(scene, visiblePts, pointerScreenX, pointerScreenY, dpr, centerCss, camera, config);
      
      const fitTime = performance.now() - startTime;
      // Performance budget: Circle detection must complete within 3ms per frame to maintain 60fps.
      // This budget ensures circle fitting doesn't cause frame drops on complex scenes.
      // Degraded mode: When over budget, we skip the new circle detection and fall through to the legacy path.
      // The legacy path still returns a valid SnapResult (either a snap or clean "no snap") but may miss some circles.
      const MAX_CIRCLE_FIT_TIME_MS = 3; // 3ms budget per frame
      if (fitTime > MAX_CIRCLE_FIT_TIME_MS) {
        if (scene.getFrameId() % 60 === 0) {
          console.warn(`[SnappingHelper] Circle detection exceeded budget: ${fitTime.toFixed(2)}ms > ${MAX_CIRCLE_FIT_TIME_MS}ms`);
        }
        // Fall through to legacy path
      } else if (circleResult) {
        // Diagnostic logging for parity (every 60 frames)
        if (DEBUG_SNAP_DIAG && scene.getFrameId() % 60 === 0) {
          const annCount = visiblePts.length;
          console.log(`[SnapDiag] O={ann:${annCount}, ok:1} center=(${circleResult.world.x.toFixed(3)},${circleResult.world.y.toFixed(3)},${circleResult.world.z.toFixed(3)}) radius=${circleResult.radius.toFixed(3)} time=${fitTime.toFixed(2)}ms`);
        }
        
        // Create snap point with metadata attached (for backward compatibility with showPreviewDot)
        const snapPoint = circleResult.world.clone() as any;
        snapPoint.circleNormal = circleResult.normal.clone().normalize();
        snapPoint.circleRadius = circleResult.radius;
        snapPoint.circleVertices = circleResult.vertices?.map(v => v.clone()) ?? [];
        
        // Create radius vector for visualFeedback (for backward compatibility)
        const radiusVec = new BABYLON.Vector3(circleResult.radius, 0, 0);
        
        return {
          snapped: true,
          position: snapPoint,
          snapType: 'center',
          targetMeshName: circleResult.meshName,
          visualFeedback: [
            snapPoint.clone(),
            snapPoint.circleNormal.clone(),
            radiusVec,
          ],
          // Set metadata on SnapResult as well (preferred approach)
          circleNormal: snapPoint.circleNormal.clone(),
          circleRadius: circleResult.radius,
          circleVertices: snapPoint.circleVertices.map((v: BABYLON.Vector3) => v.clone()),
        };
      } else if (DEBUG_SNAP_DIAG && scene.getFrameId() % 60 === 0 && visiblePts.length > 0) {
        // Log when we have points but no circle detected
        console.log(`[SnapDiag] O={ann:${visiblePts.length}, ok:0} time=${fitTime.toFixed(2)}ms`);
      }
    }
  }

  // Fall back to old implementation
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
    screenPos = new BABYLON.Vector2(projected.x, projected.y);
  }

  // Track detected circles to avoid duplicates
  const circleMap = new Map<string, { center: BABYLON.Vector3; radius: number; normal: BABYLON.Vector3; meshName: string; vertices?: BABYLON.Vector3[] }>();

  // Check all meshes for circular faces
  for (const mesh of scene.meshes) {
    // Use centralized exclusion predicate + explicit excludeIds
    if (isSnapExcluded(mesh) || excludeMeshIds.includes(mesh.uniqueId.toString())) {
      continue;
    }

    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
    if (!positions || !indices || !normals) continue;

    // PERFORMANCE: Per-mesh complexity cap (replaced global scene gate)
    // Will be replaced with time-boxed worker queries in upcoming refactor
    const faceCount = indices.length / 3;
    const MAX_FACES_PER_MESH = 10000; // Increased from 5000 - only skip extremely complex meshes
    if (faceCount > MAX_FACES_PER_MESH) {
      continue; // Skip only the most complex meshes
    }

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

    // For each group of faces with the same normal, check if vertices form a circle
    // PERFORMANCE: Limit the number of face groups processed per mesh
    const MAX_FACE_GROUPS_PER_MESH = 20; // Process max 20 face groups per mesh
    let processedGroups = 0;
    for (const [, faceIndices] of facesByNormal) {
      if (faceIndices.length < 3) continue; // Need at least 3 faces for a circle
      if (processedGroups >= MAX_FACE_GROUPS_PER_MESH) break; // Skip remaining groups if too many
      processedGroups++;

      // Collect all unique vertices from these faces
      const vertexSet = new Set<number>();
      for (const faceIdx of faceIndices) {
        const baseIdx = faceIdx * 3;
        vertexSet.add(indices[baseIdx]);
        vertexSet.add(indices[baseIdx + 1]);
        vertexSet.add(indices[baseIdx + 2]);
      }

      // Get world positions of vertices, removing duplicates
      const worldVertices: BABYLON.Vector3[] = [];
      const vertexMap = new Map<string, BABYLON.Vector3>();
      const EPSILON = 0.0001; // 0.1mm tolerance for duplicate detection
      
      for (const vIdx of vertexSet) {
        const v = new BABYLON.Vector3(
          positions[vIdx * 3],
          positions[vIdx * 3 + 1],
          positions[vIdx * 3 + 2]
        );
        const worldV = BABYLON.Vector3.TransformCoordinates(v, worldMatrix);
        
        // Create a key for duplicate detection (rounded to 0.1mm)
        const key = `${Math.round(worldV.x / EPSILON)},${Math.round(worldV.y / EPSILON)},${Math.round(worldV.z / EPSILON)}`;
        
        // Only add if we haven't seen this vertex before
        if (!vertexMap.has(key)) {
          vertexMap.set(key, worldV);
          worldVertices.push(worldV);
        }
      }
      
      // CRITICAL FIX: Remove center vertex before circle fitting
      // For circular faces (like cylinder ends), there's often a center vertex at (0,0,0) in local space
      // This center vertex biases the circle fitting and causes incorrect center calculation
      // We need to identify and remove it before fitting the circle
      if (worldVertices.length > 3) {
        // Calculate approximate center of all vertices
        const tempCenter = worldVertices.reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero())
          .scale(1 / worldVertices.length);
        
        // Find distances from temp center
        const distances = worldVertices.map(v => BABYLON.Vector3.Distance(v, tempCenter));
        const sortedDistances = [...distances].sort((a, b) => a - b);
        
        // Use median distance instead of average (more robust to outliers like center vertex)
        const medianDistance = sortedDistances.length % 2 === 0
          ? (sortedDistances[sortedDistances.length / 2 - 1] + sortedDistances[sortedDistances.length / 2]) / 2
          : sortedDistances[Math.floor(sortedDistances.length / 2)];
        
        // Remove vertices that are much closer to center than median (likely the center vertex)
        // Use 20% threshold - center vertex will be at ~0 distance, perimeter vertices at ~medianDistance
        const filteredVertices: BABYLON.Vector3[] = [];
        for (let i = 0; i < worldVertices.length; i++) {
          if (distances[i] >= medianDistance * 0.2) {
            filteredVertices.push(worldVertices[i]);
          }
        }
        
        // Only use filtered vertices if we still have enough (at least 3 for circle fitting)
        if (filteredVertices.length >= 3) {
          worldVertices.length = 0;
          worldVertices.push(...filteredVertices);
        }
      }

      // PERFORMANCE: Skip circle fitting for groups with too many vertices
      // Large vertex groups are unlikely to form perfect circles and waste computation
      const MAX_VERTICES_PER_CIRCLE = 200; // Skip groups with more than 200 vertices
      if (worldVertices.length > MAX_VERTICES_PER_CIRCLE) {
        continue; // Skip this face group
      }
      
      // Fit circle to these vertices
      const circleInfo = fitCircleToPoints(worldVertices);
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
      const viewport = camera.viewport.toGlobal(
        scene.getEngine().getRenderWidth(),
        scene.getEngine().getRenderHeight()
      );
      const projected = BABYLON.Vector3.Project(
        circle.center,
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
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
          const viewport = camera.viewport.toGlobal(
            scene.getEngine().getRenderWidth(),
            scene.getEngine().getRenderHeight()
          );
          const projected = BABYLON.Vector3.Project(
            circle.center,
            BABYLON.Matrix.Identity(),
            scene.getTransformMatrix(),
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
  }
  
  if (closestCenter && closestRadius > 0 && closestNormal) {
    // Debug: log center snap
    // Ensure normal is normalized (fix any floating point errors)
    const finalNormal = closestNormal.clone().normalize();

    // DEBUG: Calculate expected center for cylinders
    if (DEBUG_SNAP) {
      const mesh = scene.getMeshByName(closestMeshName);
      if (mesh) {
        const bbox = mesh.getBoundingInfo().boundingBox;
        const meshCenter = bbox.centerWorld;
        const meshSize = bbox.maximumWorld.subtract(bbox.minimumWorld);
        const expectedTopCenter = meshCenter.add(new BABYLON.Vector3(0, meshSize.y / 2, 0));
        const expectedBottomCenter = meshCenter.subtract(new BABYLON.Vector3(0, meshSize.y / 2, 0));
        
        const distToTop = BABYLON.Vector3.Distance(closestCenter, expectedTopCenter);
        const distToBottom = BABYLON.Vector3.Distance(closestCenter, expectedBottomCenter);
        
        console.log(`[SnappingHelper] 🔍 CENTER SNAP DEBUG:`);
        console.log(`  Mesh: ${closestMeshName}`);
        console.log(`  Mesh position: (${mesh.position.x.toFixed(6)}, ${mesh.position.y.toFixed(6)}, ${mesh.position.z.toFixed(6)})`);
        console.log(`  Mesh bbox center: (${meshCenter.x.toFixed(6)}, ${meshCenter.y.toFixed(6)}, ${meshCenter.z.toFixed(6)})`);
        console.log(`  Mesh size: (${meshSize.x.toFixed(6)}, ${meshSize.y.toFixed(6)}, ${meshSize.z.toFixed(6)})`);
        console.log(`  Expected top center: (${expectedTopCenter.x.toFixed(6)}, ${expectedTopCenter.y.toFixed(6)}, ${expectedTopCenter.z.toFixed(6)})`);
        console.log(`  Expected bottom center: (${expectedBottomCenter.x.toFixed(6)}, ${expectedBottomCenter.y.toFixed(6)}, ${expectedBottomCenter.z.toFixed(6)})`);
        console.log(`  Calculated center: (${closestCenter.x.toFixed(6)}, ${closestCenter.y.toFixed(6)}, ${closestCenter.z.toFixed(6)})`);
        console.log(`  Distance to expected top: ${(distToTop * 1000).toFixed(3)}mm`);
        console.log(`  Distance to expected bottom: ${(distToBottom * 1000).toFixed(3)}mm`);
        console.log(`  Circle radius: ${(closestRadius * 1000).toFixed(3)}mm`);
        console.log(`  Circle normal: (${finalNormal.x.toFixed(6)}, ${finalNormal.y.toFixed(6)}, ${finalNormal.z.toFixed(6)})`);
      }
    }

    // Return circle center with radius and normal for visual feedback
    // visualFeedback: [center, normal (for circle orientation), radius as Vector3(x=radius, y=0, z=0)]
    const radiusVec = new BABYLON.Vector3(closestRadius, 0, 0); // Store radius in x component

    // Create snap point with metadata attached (for backward compatibility with showPreviewDot)
    const snapPoint = closestCenter.clone() as any;
    snapPoint.circleNormal = finalNormal.clone();
    snapPoint.circleRadius = closestRadius;
    snapPoint.circleVertices = closestVertices?.map(v => v.clone()) ?? [];

    return {
      snapped: true,
      position: snapPoint,
      snapType: 'center',
      targetMeshName: closestMeshName,
      visualFeedback: [
        snapPoint.clone(),
        snapPoint.circleNormal.clone(),
        radiusVec,
      ],
      // Set metadata on SnapResult as well (preferred approach)
      circleNormal: snapPoint.circleNormal.clone(),
      circleRadius: closestRadius,
      circleVertices: snapPoint.circleVertices.map((v: BABYLON.Vector3) => v.clone()),
    };
  }
  
  return { snapped: false, position: position.clone() };
}

