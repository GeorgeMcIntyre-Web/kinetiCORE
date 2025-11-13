// Face snap strategy - snap to nearest face center
// Extracted from SnappingHelper.ts for better organization

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { isSnapExcluded } from '../snapConstants';
import { SnapResult } from './snapTypes';
import { fitCircleToPoints } from './snapHelpers';
import { DEBUG_SNAP } from './preview';

export type FaceSnapArgs = {
  position: BABYLON.Vector3;
  snapDistance: number;
  excludeMeshIds: string[];
  camera?: BABYLON.Camera;
  screenSpacePixels?: number;
  clickedMesh?: BABYLON.AbstractMesh | null;
  clickedPoint?: BABYLON.Vector3 | null;
};

/**
 * Snap to nearest face center
 * Option 1: Use actual clicked point if click is on a face (most intuitive)
 * Option 2: Project click point onto nearest face plane
 * Option 3: Snap to face center when clicking on a face
 * Currently using Option 1 - can be changed via faceSnapMode
 */
export function snapToFaceStrategy(args: FaceSnapArgs): SnapResult {
  const { position, snapDistance, excludeMeshIds, camera, screenSpacePixels, clickedMesh, clickedPoint } = args;
  
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) return { snapped: false, position: position.clone() };

  const snapDistanceMeters = snapDistance / 1000;

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

  let closestPoint: BABYLON.Vector3 | null = null;
  let closestDistance = Infinity; // Find true closest first
  let closestMeshName = '';
  let closestNormal: BABYLON.Vector3 | null = null; // Store face normal for orientation

  // PRIORITY: If we have a clicked mesh and point, use that first (most accurate)
  // This ensures we use the face the user actually clicked on
  if (clickedMesh && clickedPoint && clickedMesh instanceof BABYLON.Mesh) {
    const mesh = clickedMesh as BABYLON.Mesh;
    // Use scene.pick to find the face at the clicked point
    // We need to convert the world point to screen coordinates for scene.pick
    // But since we don't have screen coords, use a ray from the clicked point in multiple directions
    // to find the face that contains the clicked point
    const directions = [
      new BABYLON.Vector3(0, 0, 1),
      new BABYLON.Vector3(0, 0, -1),
      new BABYLON.Vector3(0, 1, 0),
      new BABYLON.Vector3(0, -1, 0),
      new BABYLON.Vector3(1, 0, 0),
      new BABYLON.Vector3(-1, 0, 0),
    ];
    
    let pickInfo: BABYLON.PickingInfo | null = null;
    for (const dir of directions) {
      const ray = new BABYLON.Ray(clickedPoint, dir, 0.001); // Very short ray
      const testPick = scene.pickWithRay(ray, (m) => m === mesh);
      if (testPick && testPick.hit && testPick.faceId !== null && testPick.faceId !== undefined) {
        pickInfo = testPick;
        break; // Found the face
      }
    }
    
    if (pickInfo && pickInfo.hit && pickInfo.pickedPoint && pickInfo.faceId !== null && pickInfo.faceId !== undefined) {
      // We found the clicked face - calculate its center
      const facetId = pickInfo.faceId;
      
      // Get face normal
      let faceNormal: BABYLON.Vector3 | null = null;
      if (pickInfo.getNormal) {
        const normal = pickInfo.getNormal(true);
        if (normal) {
          faceNormal = normal.normalize();
        }
      }
      
      if (!faceNormal && mesh.getFacetNormal) {
        const normal = mesh.getFacetNormal(facetId);
        if (normal) {
          const worldMatrix = mesh.getWorldMatrix();
          faceNormal = BABYLON.Vector3.TransformNormal(normal, worldMatrix).normalize();
        }
      }
      
      // Calculate face center using the same logic as below
      let faceCenter: BABYLON.Vector3 | null = null;
      if (faceNormal) {
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const indices = mesh.getIndices();
        if (positions && indices) {
          const worldMatrix = mesh.computeWorldMatrix(true);
          const normalTolerance = 0.01;
          const spatialTolerance = 0.1;
          
          // Get clicked triangle center
          const clickedTriIdx0 = indices[facetId * 3];
          const clickedTriIdx1 = indices[facetId * 3 + 1];
          const clickedTriIdx2 = indices[facetId * 3 + 2];
          
          const clickedV0 = new BABYLON.Vector3(positions[clickedTriIdx0 * 3], positions[clickedTriIdx0 * 3 + 1], positions[clickedTriIdx0 * 3 + 2]);
          const clickedV1 = new BABYLON.Vector3(positions[clickedTriIdx1 * 3], positions[clickedTriIdx1 * 3 + 1], positions[clickedTriIdx1 * 3 + 2]);
          const clickedV2 = new BABYLON.Vector3(positions[clickedTriIdx2 * 3], positions[clickedTriIdx2 * 3 + 1], positions[clickedTriIdx2 * 3 + 2]);
          const clickedTriCenter = clickedV0.add(clickedV1).add(clickedV2).scale(1/3);
          const clickedTriCenterWorld = BABYLON.Vector3.TransformCoordinates(clickedTriCenter, worldMatrix);
          
          // Find all triangles on the same face
          const faceTriangles: BABYLON.Vector3[] = [];
          const triangleCount = indices.length / 3;
          
          for (let i = 0; i < triangleCount; i++) {
            const idx0 = indices[i * 3];
            const idx1 = indices[i * 3 + 1];
            const idx2 = indices[i * 3 + 2];
            
            const v0 = new BABYLON.Vector3(positions[idx0 * 3], positions[idx0 * 3 + 1], positions[idx0 * 3 + 2]);
            const v1 = new BABYLON.Vector3(positions[idx1 * 3], positions[idx1 * 3 + 1], positions[idx1 * 3 + 2]);
            const v2 = new BABYLON.Vector3(positions[idx2 * 3], positions[idx2 * 3 + 1], positions[idx2 * 3 + 2]);
            
            const edge1 = v1.subtract(v0);
            const edge2 = v2.subtract(v0);
            let triNormal = BABYLON.Vector3.Cross(edge1, edge2);
            if (triNormal.length() > 0.0001) {
              triNormal.normalize();
              const worldTriNormal = BABYLON.Vector3.TransformNormal(triNormal, worldMatrix).normalize();
              
              const dot = BABYLON.Vector3.Dot(worldTriNormal, faceNormal);
              if (Math.abs(dot - 1.0) < normalTolerance || Math.abs(dot + 1.0) < normalTolerance) {
                const triCenter = v0.add(v1).add(v2).scale(1/3);
                const worldTriCenter = BABYLON.Vector3.TransformCoordinates(triCenter, worldMatrix);
                
                const toTriCenter = worldTriCenter.subtract(clickedTriCenterWorld);
                const distAlongNormal = BABYLON.Vector3.Dot(toTriCenter, faceNormal);
                
                if (Math.abs(distAlongNormal) < spatialTolerance) {
                  faceTriangles.push(worldTriCenter);
                }
              }
            }
          }
          
          if (faceTriangles.length > 0) {
            // For circular faces, use the same vertex-based calculation as center snap
            // This ensures face snap and center snap use the exact same position
            // Collect all unique vertices from triangles on this face
            const vertexSet = new Set<number>();
            for (let i = 0; i < triangleCount; i++) {
              const idx0 = indices[i * 3];
              const idx1 = indices[i * 3 + 1];
              const idx2 = indices[i * 3 + 2];
              
              const v0 = new BABYLON.Vector3(positions[idx0 * 3], positions[idx0 * 3 + 1], positions[idx0 * 3 + 2]);
              const v1 = new BABYLON.Vector3(positions[idx1 * 3], positions[idx1 * 3 + 1], positions[idx1 * 3 + 2]);
              const v2 = new BABYLON.Vector3(positions[idx2 * 3], positions[idx2 * 3 + 1], positions[idx2 * 3 + 2]);
              
              const edge1 = v1.subtract(v0);
              const edge2 = v2.subtract(v0);
              let triNormal = BABYLON.Vector3.Cross(edge1, edge2);
              if (triNormal.length() > 0.0001) {
                triNormal.normalize();
                const worldTriNormal = BABYLON.Vector3.TransformNormal(triNormal, worldMatrix).normalize();
                
                const dot = BABYLON.Vector3.Dot(worldTriNormal, faceNormal);
                if (Math.abs(dot - 1.0) < normalTolerance || Math.abs(dot + 1.0) < normalTolerance) {
                  const triCenter = v0.add(v1).add(v2).scale(1/3);
                  const worldTriCenter = BABYLON.Vector3.TransformCoordinates(triCenter, worldMatrix);
                  
                  const toTriCenter = worldTriCenter.subtract(clickedTriCenterWorld);
                  const distAlongNormal = BABYLON.Vector3.Dot(toTriCenter, faceNormal);
                  
                  if (Math.abs(distAlongNormal) < spatialTolerance) {
                    // This triangle is on the same face - collect its vertices
                    vertexSet.add(idx0);
                    vertexSet.add(idx1);
                    vertexSet.add(idx2);
                  }
                }
              }
            }
            
            // Get world positions of vertices, removing duplicates (same as center snap does)
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
            
            // Fit circle to vertices (same method as center snap)
            const circleInfo = fitCircleToPoints(worldVertices);
            if (circleInfo && circleInfo.radius > 0) {
              // This is a circular face - use the circle center (same as center snap)
              faceCenter = circleInfo.center;
            } else {
              // Not circular - use average of triangle centers
              const sum = BABYLON.Vector3.Zero();
              faceTriangles.forEach(center => sum.addInPlace(center));
              faceCenter = sum.scale(1 / faceTriangles.length);
            }
          } else {
            faceCenter = clickedTriCenterWorld;
          }
        }
      }
      
      if (faceCenter && faceNormal) {
        const distance = BABYLON.Vector3.Distance(position, faceCenter);
        closestPoint = faceCenter;
        closestDistance = distance;
        closestMeshName = mesh.name;
        closestNormal = faceNormal;
        
        // DEBUG: Compare face center with expected cylinder center
        if (DEBUG_SNAP) {
          const bbox = mesh.getBoundingInfo().boundingBox;
          const meshCenter = bbox.centerWorld;
          const meshSize = bbox.maximumWorld.subtract(bbox.minimumWorld);
          const expectedTopCenter = meshCenter.add(new BABYLON.Vector3(0, meshSize.y / 2, 0));
          const expectedBottomCenter = meshCenter.subtract(new BABYLON.Vector3(0, meshSize.y / 2, 0));
          
          const distToTop = BABYLON.Vector3.Distance(faceCenter, expectedTopCenter);
          const distToBottom = BABYLON.Vector3.Distance(faceCenter, expectedBottomCenter);
          
          console.log(`[SnappingHelper] 🔍 FACE SNAP DEBUG (clicked mesh):`);
          console.log(`  Mesh: ${mesh.name}`);
          console.log(`  Mesh position: (${mesh.position.x.toFixed(6)}, ${mesh.position.y.toFixed(6)}, ${mesh.position.z.toFixed(6)})`);
          console.log(`  Mesh bbox center: (${meshCenter.x.toFixed(6)}, ${meshCenter.y.toFixed(6)}, ${meshCenter.z.toFixed(6)})`);
          console.log(`  Mesh size: (${meshSize.x.toFixed(6)}, ${meshSize.y.toFixed(6)}, ${meshSize.z.toFixed(6)})`);
          console.log(`  Expected top center: (${expectedTopCenter.x.toFixed(6)}, ${expectedTopCenter.y.toFixed(6)}, ${expectedTopCenter.z.toFixed(6)})`);
          console.log(`  Expected bottom center: (${expectedBottomCenter.x.toFixed(6)}, ${expectedBottomCenter.y.toFixed(6)}, ${expectedBottomCenter.z.toFixed(6)})`);
          console.log(`  Calculated face center: (${faceCenter.x.toFixed(6)}, ${faceCenter.y.toFixed(6)}, ${faceCenter.z.toFixed(6)})`);
          console.log(`  Distance to expected top: ${(distToTop * 1000).toFixed(3)}mm`);
          console.log(`  Distance to expected bottom: ${(distToBottom * 1000).toFixed(3)}mm`);
          console.log(`  Face normal: (${faceNormal.x.toFixed(6)}, ${faceNormal.y.toFixed(6)}, ${faceNormal.z.toFixed(6)})`);
        }
        
        // Found the clicked face - use it and skip raycasting
        // (we'll check shouldSnap below)
      }
    }
  }

  // If we didn't find a face from the clicked mesh, use raycasting in 6 directions (±X, ±Y, ±Z) to find nearby faces
  if (!closestPoint) {
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
          !mesh.name.startsWith('snapIndicator') &&
          !mesh.name.startsWith('snapPreviewDot') &&
          !mesh.name.startsWith('snapPreviewCircle') &&
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
            // For circular faces, use the same vertex-based calculation as center snap
            // This ensures face snap and center snap use the exact same position
            // Collect all unique vertices from triangles on this face
            const vertexSet = new Set<number>();
            for (let i = 0; i < triangleCount; i++) {
              const idx0 = indices[i * 3];
              const idx1 = indices[i * 3 + 1];
              const idx2 = indices[i * 3 + 2];
              
              const v0 = new BABYLON.Vector3(positions[idx0 * 3], positions[idx0 * 3 + 1], positions[idx0 * 3 + 2]);
              const v1 = new BABYLON.Vector3(positions[idx1 * 3], positions[idx1 * 3 + 1], positions[idx1 * 3 + 2]);
              const v2 = new BABYLON.Vector3(positions[idx2 * 3], positions[idx2 * 3 + 1], positions[idx2 * 3 + 2]);
              
              const edge1 = v1.subtract(v0);
              const edge2 = v2.subtract(v0);
              let triNormal = BABYLON.Vector3.Cross(edge1, edge2);
              if (triNormal.length() > 0.0001) {
                triNormal.normalize();
                const worldTriNormal = BABYLON.Vector3.TransformNormal(triNormal, worldMatrix).normalize();
                
                const dot = BABYLON.Vector3.Dot(worldTriNormal, faceNormal);
                if (Math.abs(dot - 1.0) < normalTolerance || Math.abs(dot + 1.0) < normalTolerance) {
                  const triCenter = v0.add(v1).add(v2).scale(1/3);
                  const worldTriCenter = BABYLON.Vector3.TransformCoordinates(triCenter, worldMatrix);
                  
                  const toTriCenter = worldTriCenter.subtract(clickedTriCenterWorld);
                  const distAlongNormal = BABYLON.Vector3.Dot(toTriCenter, faceNormal);
                  
                  if (Math.abs(distAlongNormal) < spatialTolerance) {
                    // This triangle is on the same face - collect its vertices
                    vertexSet.add(idx0);
                    vertexSet.add(idx1);
                    vertexSet.add(idx2);
                  }
                }
              }
            }
            
            // Get world positions of vertices, removing duplicates (same as center snap does)
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
            
            // Fit circle to vertices (same method as center snap)
            const circleInfo = fitCircleToPoints(worldVertices);
            if (circleInfo && circleInfo.radius > 0) {
              // This is a circular face - use the circle center (same as center snap)
              faceCenter = circleInfo.center;
            } else {
              // Not circular - use average of triangle centers
              const sum = BABYLON.Vector3.Zero();
              faceTriangles.forEach(center => sum.addInPlace(center));
              faceCenter = sum.scale(1 / faceTriangles.length);
            }
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
  }

  // Determine if we should snap
  // For face center, always snap when face is detected (CAD workflow requirement)
  let shouldSnap = false;
  if (closestPoint) {
    // If we have a face normal, we detected a face - always use its center
    const isFaceCenter = closestNormal !== null;
    
    if (isFaceCenter) {
      // Face center detected - always snap to it (CAD workflow)
      // Use screen-space distance if available (for consistency with preview), otherwise use world-space
      if (camera && screenSpacePixels !== undefined && screenPos) {
        // Check screen-space distance to face center
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
        // Use generous screen-space threshold for face centers (5x) since face center might be far from click
        shouldSnap = screenDist <= screenSpacePixels * 5;
      } else {
        // Fallback to world-space distance check
        const maxFaceDistance = 2.0; // 2 meters max distance for face center
        shouldSnap = closestDistance <= maxFaceDistance;
      }
    } else {
      // Regular face snap (no center calculated) - use normal distance check
      if (camera && screenSpacePixels !== undefined && screenPos) {
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
        shouldSnap = screenDist <= screenSpacePixels * 3;
      } else {
        shouldSnap = closestDistance <= snapDistanceMeters * 3;
      }
    }
  }

  if (!closestPoint || !shouldSnap) {
    return { snapped: false, position: position.clone() };
  }

  // Attach face normal to position for preview system (similar to center snap's circleNormal)
  const snapPoint = closestPoint.clone() as any;
  if (closestNormal) {
    snapPoint.faceNormal = closestNormal.clone();
  }

  if (closestNormal) {
    return {
      snapped: true,
      position: snapPoint,
      snapType: 'face',
      targetMeshName: closestMeshName,
      visualFeedback: [
        closestPoint.clone(),
        closestNormal.clone(),
      ],
    };
  }

  return {
    snapped: true,
    position: snapPoint,
    snapType: 'face',
    targetMeshName: closestMeshName,
    visualFeedback: [closestPoint.clone()],
  };
}

