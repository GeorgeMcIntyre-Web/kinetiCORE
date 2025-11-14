// Preview visualization and debug flags for snap system
// Extracted from SnappingHelper.ts for better organization

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { LAYER_UI } from '../snapConstants';

// ============================================================================
// DEBUG FLAGS
// ============================================================================

export const DEBUG_SNAP = false; // Enable verbose snap debugging
export const DEBUG_SNAP_DIAG = false; // Enable diagnostic binning/performance logs

// ============================================================================
// PREVIEW STATE MANAGEMENT
// ============================================================================

/**
 * Preview indicator state (managed externally by SnappingHelper)
 */
export interface PreviewState {
  previewIndicator: BABYLON.Mesh | null;
  setPreviewIndicator: (mesh: BABYLON.Mesh | null) => void;
}

// ============================================================================
// PREVIEW FUNCTIONS
// ============================================================================

/**
 * Calculate dynamic indicator size based on camera distance (screen-space sizing)
 */
export function calculateIndicatorSize(
  point: BABYLON.Vector3,
  scene: BABYLON.Scene,
  baseSize: number = 0.04
): number {
  const camera = scene.activeCamera;
  if (!camera) return baseSize;

  // Calculate distance from camera to point
  const distanceToPoint = BABYLON.Vector3.Distance(camera.position, point);

  // Calculate FOV-based scale factor for screen-space sizing
  let fovFactor = 1.0;
  if (camera instanceof BABYLON.ArcRotateCamera && camera.fov) {
    fovFactor = Math.tan(camera.fov / 2);
  } else if (camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
    // For orthographic, use ortho size
    const orthoSize = (camera as any).orthoLeft ?
      Math.abs((camera as any).orthoRight - (camera as any).orthoLeft) : 10;
    const engine = scene.getEngine();
    const viewportHeight = engine.getRenderHeight();
    // Convert to equivalent FOV for sizing calculation
    fovFactor = (orthoSize / viewportHeight) * 2;
  }

  // Target size as percentage of screen (aims for ~2% of viewport height for small indicators)
  const screenPercentage = 0.02;
  const engine = scene.getEngine();
  const viewportHeight = engine.getRenderHeight();
  const worldSize = (distanceToPoint * fovFactor * screenPercentage * 2) / (viewportHeight / 1000);

  // Adaptive minimum size based on camera distance
  // When zoomed in close (< 200mm), use smaller indicators to avoid near-plane clipping
  // When zoomed out, use larger indicators for visibility
  const MIN_SIZE = distanceToPoint < 0.2 ? 0.0005 : 0.002; // 0.5mm when close, 2mm when far
  const MAX_SIZE = 0.02;  // 20mm
  const targetSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, worldSize));

  return targetSize;
}

/**
 * Clear preview dot and all child meshes (lines, rings, etc.)
 */
export function clearPreviewDot(previewState: PreviewState): void {
  if (previewState.previewIndicator) {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (scene) {
      const glowLayer = scene.getGlowLayerByName('snap-preview-glow');
      if (glowLayer) {
        glowLayer.removeIncludedOnlyMesh(previewState.previewIndicator);
      }
      
      // Dispose the midpoint line if it exists (stored separately, not as child)
      const line = (previewState.previewIndicator as any).__snapPreviewLine;
      const lineMaterial = (previewState.previewIndicator as any).__snapPreviewLineMaterial;
      if (line) {
        if (line.dispose) {
          line.dispose();
        }
      }
      if (lineMaterial && lineMaterial.dispose) {
        lineMaterial.dispose();
      }
      
      // Dispose all child meshes (lines, rings, etc.)
      const childMeshes = previewState.previewIndicator.getChildMeshes();
      childMeshes.forEach(child => {
        if (glowLayer) {
          glowLayer.removeIncludedOnlyMesh(child as BABYLON.Mesh);
        }
        child.dispose();
      });
    }
    
    previewState.previewIndicator.dispose();
    previewState.setPreviewIndicator(null);
  }
}

/**
 * Show preview dot at a position with optional snap type for different visuals
 * 
 * Snap preview expectations:
 *
 * snapType: 'vertex'
 *   - position: vertex world position
 *   - visualFeedback: [position]
 *
 * snapType: 'midpoint'
 *   - edge midpoint: visualFeedback: [edgeStart, midpoint, edgeEnd]
 *   - face center:   visualFeedback: [center]
 *
 * snapType: 'face'
 *   - visualFeedback: [point] or [center, normal]
 *
 * snapType: 'object'
 *   - visualFeedback: [center, ...optional bbox corners]
 *
 * snapType: 'center'
 *   - position: circle center (with circleNormal, circleRadius attached)
 *   - visualFeedback: [center, normal, radiusVector]
 * 
 * @param point - Position to show preview
 * @param snapType - Type of snap (vertex, midpoint, center) for different visuals
 * @param previewState - State object for managing preview indicator
 */
export function showPreviewDot(
  point: BABYLON.Vector3,
  snapType: string | undefined,
  previewState: PreviewState
): void {
  if (DEBUG_SNAP) {
    console.log(`[SnappingHelper] 🔵 showPreviewDot called: snapType=${snapType}, point=(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`);
  }

  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) {
    console.warn('[SnappingHelper] No scene available for preview dot');
    return;
  }

  // Clear old preview
  clearPreviewDot(previewState);

  // Check if point is on a selected mesh (for color/size adjustment)
  // For now, default to false - we can enhance this later if needed
  const isOnSelectedMesh = false;

  // Calculate dynamic indicator size based on camera distance (screen-space sizing)
  const baseIndicatorSize = calculateIndicatorSize(point, scene, 0.04);
  const selectedIndicatorSize = calculateIndicatorSize(point, scene, 0.06);

  let preview: BABYLON.Mesh;
  let baseColor: BABYLON.Color3;

  if (snapType === 'midpoint') {
    // Midpoint: Show a line along the edge + a dot at the midpoint
    const edgeStart = (point as any).edgeStart;
    const edgeEnd = (point as any).edgeEnd;
    
    // Debug: Log if edge endpoints are missing
    if (DEBUG_SNAP && (!edgeStart || !edgeEnd)) {
      console.log(`[SnappingHelper] Midpoint snap: edgeStart=${!!edgeStart}, edgeEnd=${!!edgeEnd}, point=(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`);
    }
    
    // Create dot at midpoint first
    const diameter = isOnSelectedMesh ? selectedIndicatorSize : baseIndicatorSize;
    preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewDot', { diameter }, scene);
    preview.position = point.clone();
    
    // Create line along edge if endpoints available
    // Note: Face centers (isFaceCenter=true) don't have edge endpoints, which is expected
    if (edgeStart && edgeEnd) {
      if (DEBUG_SNAP) {
        console.log(`[SnappingHelper] Creating midpoint line from (${edgeStart.x.toFixed(3)}, ${edgeStart.y.toFixed(3)}, ${edgeStart.z.toFixed(3)}) to (${edgeEnd.x.toFixed(3)}, ${edgeEnd.y.toFixed(3)}, ${edgeEnd.z.toFixed(3)})`);
      }
      
      // Verify the path is valid (not zero length)
      const pathLength = BABYLON.Vector3.Distance(edgeStart, edgeEnd);
      if (pathLength < 0.001 && DEBUG_SNAP) {
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
      if (DEBUG_SNAP) {
        console.log(`[SnappingHelper] Line mesh created: type=${line.constructor.name}, visible=${line.isVisible}, inScene=${scene.meshes.includes(line)}, color=(${lineColor.r}, ${lineColor.g}, ${lineColor.b})`);
      }

      // Store line reference for cleanup
      (preview as any).__snapPreviewLine = line;
      (preview as any).__snapPreviewLineMaterial = lineMaterial;
      
      if (DEBUG_SNAP) {
        console.log(`[SnappingHelper] Midpoint line created: visible=${line.isVisible}, renderingGroupId=${line.renderingGroupId}, parent=${(line.parent as any)?.name || 'none'}`);
      }
    }
    // No warning needed - face centers don't have edge endpoints, which is expected
    
    baseColor = isOnSelectedMesh 
      ? new BABYLON.Color3(1, 1, 1)
      : new BABYLON.Color3(1, 0.5, 0); // Orange
  } else if (snapType === 'center') {
    // Center: Show a circle ring around circumference + a dot at center
    const circleNormal = (point as any).circleNormal;
    const circleRadius = (point as any).circleRadius;
    
    if (DEBUG_SNAP) {
      console.log(`[SnappingHelper] showPreviewDot CENTER: point=(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)}), radius=${circleRadius ? (circleRadius * 1000).toFixed(2) + 'mm' : 'undefined'}, normal=${circleNormal ? `(${circleNormal.x.toFixed(2)}, ${circleNormal.y.toFixed(2)}, ${circleNormal.z.toFixed(2)})` : 'undefined'}`);
    }
    
    // Create dot at circle center
    const dotDiameter = isOnSelectedMesh ? selectedIndicatorSize : baseIndicatorSize;
    preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewDot', { diameter: dotDiameter }, scene);
    preview.position = point.clone();
    
    // Create circle ring if radius and normal available
    if (circleNormal && circleRadius && circleRadius > 0) {
      // DEBUG: Visualize circle vertices if available
      const circleVertices = (point as any).circleVertices as BABYLON.Vector3[] | undefined;
      if (DEBUG_SNAP && circleVertices && circleVertices.length > 0) {
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

      // Ring thickness scales with indicator size, but has min/max limits
      const ringThickness = Math.max(0.001, Math.min(0.005, baseIndicatorSize * 0.075)); // Proportional to indicator size, clamped

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

      if (DEBUG_SNAP) {
        console.log(`[SnappingHelper] Torus dimensions: circleRadius=${(circleRadius * 1000).toFixed(3)}mm, diameter=${(torusDiameter * 1000).toFixed(3)}mm, thickness=${(ringThickness * 1000).toFixed(3)}mm`);
        console.log(`[SnappingHelper] Torus radii: major=${(torusMajorRadius * 1000).toFixed(3)}mm, minor=${(torusMinorRadius * 1000).toFixed(3)}mm, outer=${(torusOuterRadius * 1000).toFixed(3)}mm, inner=${(torusInnerRadius * 1000).toFixed(3)}mm`);
      }
      
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
          if (DEBUG_SNAP) {
            console.log(`[SnappingHelper] Torus rotation: Flipping 180° around X-axis for downward normal`);
          }
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
          
          if (DEBUG_SNAP) {
            console.log(`[SnappingHelper] Torus rotation: axis=(${axis.x.toFixed(3)}, ${axis.y.toFixed(3)}, ${axis.z.toFixed(3)}), angle=${(angle * 180 / Math.PI).toFixed(1)}°, dotY=${dotY.toFixed(3)}`);
          }
        } else {
          // Y-axis and targetNormal are parallel (shouldn't happen due to check above, but handle it)
          if (DEBUG_SNAP) {
            console.warn(`[SnappingHelper] Torus rotation: cross product too small (${crossLength.toFixed(6)}), using identity rotation`);
          }
        }
      }
      
      // Position ring at circle center - use same position as dot to ensure exact alignment
      // Parent to preview for proper cleanup, but position in world space
      ring.position = BABYLON.Vector3.Zero(); // Relative to parent (center dot)
      ring.renderingGroupId = 1;
      ring.isPickable = false;
      ring.parent = preview; // Parent for cleanup
      
      // Verify torus orientation after rotation and parenting
      // Force matrix update to ensure rotation is applied
      ring.computeWorldMatrix(true);
      // Get the local rotation - transform Y-axis using the quaternion directly
      const quat = ring.rotationQuaternion || BABYLON.Quaternion.Identity();
      const rotMatrix = new BABYLON.Matrix();
      BABYLON.Matrix.FromQuaternionToRef(quat, rotMatrix);
      const torusYAxis = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 1, 0), rotMatrix);
      const torusAlignment = BABYLON.Vector3.Dot(torusYAxis.normalize(), targetNormal);
      if (DEBUG_SNAP) {
        console.log(`[SnappingHelper] Torus orientation check: torusYAxis=(${torusYAxis.x.toFixed(6)}, ${torusYAxis.y.toFixed(6)}, ${torusYAxis.z.toFixed(6)}), targetNormal=(${targetNormal.x.toFixed(6)}, ${targetNormal.y.toFixed(6)}, ${targetNormal.z.toFixed(6)}), alignment=${torusAlignment.toFixed(6)} (should be ~1.0)`);
      }
      
      if (Math.abs(torusAlignment) < 0.9) {
        if (DEBUG_SNAP) {
          console.warn(`[SnappingHelper] WARNING: Torus Y-axis not aligned with circle normal! Alignment=${torusAlignment.toFixed(3)}`);
        }
        // Try to fix: if alignment is close to -1, we're 180 degrees off
        if (torusAlignment < -0.9) {
          if (DEBUG_SNAP) {
            console.warn(`[SnappingHelper] Attempting to fix: rotating 180° around X-axis`);
          }
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
      
      if (DEBUG_SNAP) {
        console.log(`[SnappingHelper] Created center preview: orange circle ring (radius=${(circleRadius * 1000).toFixed(6)}mm, diameter=${(torusDiameter * 1000).toFixed(6)}mm, normal=(${targetNormal.x.toFixed(6)}, ${targetNormal.y.toFixed(6)}, ${targetNormal.z.toFixed(6)})) + orange dot at (${point.x.toFixed(6)}, ${point.y.toFixed(6)}, ${point.z.toFixed(6)})`);
      }
    } else {
      if (DEBUG_SNAP) {
        console.warn(`[SnappingHelper] Center preview missing data: radius=${circleRadius}, normal=${!!circleNormal}`);
      }
    }
    
    baseColor = isOnSelectedMesh
      ? new BABYLON.Color3(1, 1, 1)
      : new BABYLON.Color3(1, 0.5, 0); // Orange
  } else if (snapType === 'vertex') {
    // Vertex: Yellow diamond shape (box rotated 45°)
    const size = isOnSelectedMesh ? selectedIndicatorSize : baseIndicatorSize;
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
    const diameter = isOnSelectedMesh ? selectedIndicatorSize : baseIndicatorSize;
    const height = baseIndicatorSize * 0.5; // Short cylinder, proportional to indicator size
    preview = BABYLON.MeshBuilder.CreateCylinder('snapPreviewEdge', { diameter, height }, scene);
    preview.position = point.clone();
    baseColor = isOnSelectedMesh
      ? new BABYLON.Color3(1, 1, 1)
      : new BABYLON.Color3(0, 1, 1); // Cyan
  } else if (snapType === 'face') {
    // Face: Green square (flat box) lying flat on the face plane
    const size = isOnSelectedMesh ? selectedIndicatorSize : baseIndicatorSize;
    preview = BABYLON.MeshBuilder.CreateBox('snapPreviewFace', {
      width: size,
      height: size,
      depth: baseIndicatorSize * 0.125 // Very thin, proportional to indicator size
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
    const size = isOnSelectedMesh ? selectedIndicatorSize : baseIndicatorSize;
    const barThickness = baseIndicatorSize * 0.125; // Proportional thickness
    preview = BABYLON.MeshBuilder.CreateBox('snapPreviewIntersection', {
      width: size * 1.5,
      height: barThickness,
      depth: barThickness
    }, scene);
    preview.position = point.clone();

    // Add second bar
    const bar2 = BABYLON.MeshBuilder.CreateBox('snapPreviewIntersectionBar2', {
      width: size * 1.5,
      height: barThickness,
      depth: barThickness
    }, scene);
    bar2.rotation.z = Math.PI / 2; // 90° rotation
    bar2.parent = preview;

    baseColor = isOnSelectedMesh
      ? new BABYLON.Color3(1, 1, 1)
      : new BABYLON.Color3(1, 0, 1); // Magenta
  } else if (snapType === 'normal') {
    // Normal: Blue arrow pointing up
    const diameter = isOnSelectedMesh ? selectedIndicatorSize : baseIndicatorSize;
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
    const size = isOnSelectedMesh ? selectedIndicatorSize : baseIndicatorSize;
    preview = BABYLON.MeshBuilder.CreateBox('snapPreviewBBox', { size }, scene);
    preview.position = point.clone();
    baseColor = isOnSelectedMesh
      ? new BABYLON.Color3(1, 1, 1)
      : new BABYLON.Color3(0.8, 0.8, 0.8); // Light gray/white
  } else if (snapType === 'object') {
    // Object: Purple sphere (object center) - slightly larger than other indicators
    const objectBaseSize = calculateIndicatorSize(point, scene, 0.06);
    const objectSelectedSize = calculateIndicatorSize(point, scene, 0.08);
    const diameter = isOnSelectedMesh ? objectSelectedSize : objectBaseSize;
    preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewObject', { diameter }, scene);
    preview.position = point.clone();
    baseColor = isOnSelectedMesh
      ? new BABYLON.Color3(1, 1, 1)
      : new BABYLON.Color3(0.8, 0, 0.8); // Purple
  } else {
    // Default fallback: Gray sphere
    const diameter = isOnSelectedMesh ? selectedIndicatorSize : baseIndicatorSize;
    preview = BABYLON.MeshBuilder.CreateSphere('snapPreviewDot', { diameter }, scene);
    preview.position = point.clone();
    baseColor = isOnSelectedMesh
      ? new BABYLON.Color3(1, 1, 1)
      : new BABYLON.Color3(0.5, 0.5, 0.5); // Gray
  }

  preview.renderingGroupId = 1;
  preview.isVisible = true;
  preview.visibility = 1.0;

  // IMPORTANT: Do NOT offset preview.position - it must match the actual snap point exactly
  // for accurate measurements. Use material zOffset and renderingGroupId for z-fighting instead.

  const mat = new BABYLON.StandardMaterial('previewMat', scene);
  mat.emissiveColor = baseColor;
  mat.diffuseColor = baseColor;
  mat.disableLighting = true;
  mat.alpha = 1.0;
  mat.zOffset = -10; // Increased from -2 for better visibility when zoomed close
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
        childMat.zOffset = -10; // Match parent preview zOffset
        child.material = childMat;
        if (DEBUG_SNAP) {
          console.log(`[SnappingHelper] Applied material to ${child.name}`);
        }
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
  if (DEBUG_SNAP) {
    console.log(`[SnappingHelper] Added preview to glow layer, intensity=${glowLayer.intensity}`);
  }
  
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
  preview.isPickable = false; // Not pickable for scene picking
  preview.isVisible = true; // Explicitly ensure visibility
  preview.renderingGroupId = 1; // Render after main scene (prevents z-fighting)

  // Set layer mask to LAYER_UI but keep it visible
  // Note: We don't use setMeshAsUI here because we need custom layer handling
  preview.layerMask = LAYER_UI;

  // Also configure child meshes (lines, rings)
  preview.getChildMeshes().forEach(child => {
    if (child instanceof BABYLON.Mesh) {
      child.isPickable = false;
      child.isVisible = true;
      child.renderingGroupId = 1;
      child.layerMask = LAYER_UI;
    }
  });

  // Configure midpoint line if it exists (stored separately, not as child)
  if (midpointLine instanceof BABYLON.Mesh) {
    midpointLine.isPickable = false;
    midpointLine.isVisible = true;
    midpointLine.renderingGroupId = 1;
    midpointLine.layerMask = LAYER_UI;
  }

  previewState.setPreviewIndicator(preview);

  // Debug: Confirm preview was created and configured
  if (DEBUG_SNAP) {
    console.log(`[SnappingHelper] ✅ Preview created: name=${preview.name}, isVisible=${preview.isVisible}, isEnabled=${preview.isEnabled()}, layerMask=${preview.layerMask}, renderingGroupId=${preview.renderingGroupId}, position=(${preview.position.x.toFixed(3)}, ${preview.position.y.toFixed(3)}, ${preview.position.z.toFixed(3)})`);
  }
}

