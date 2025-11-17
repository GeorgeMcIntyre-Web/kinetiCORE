// Shared helper functions for snap strategies
// Extracted from SnappingHelper.ts for reuse across snap modules

import * as BABYLON from '@babylonjs/core';
import { fitPlanePCA, taubinCircle, angularCoverage, quantile } from './circle';
import { SnapCircleConfig, DEFAULT_SNAP_CIRCLE_CONFIG } from './snapConfig';

// ============================================================================
// SCREEN-SPACE BINNING TYPES AND CONSTANTS
// ============================================================================

export type ScreenBin = { indices: number[] };

export type BinnedProjection = {
  frameId: number;
  rw: number;
  rh: number;
  cols: number;
  rows: number;
  bins: ScreenBin[];
  worldVerts: Float32Array;
  mesh: BABYLON.Mesh;
};

export const BIN_COLS = 64;
export const BIN_ROWS = 36;
export const OCCLUSION_PAD_MM = 3; // small cushion for thin shells

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compute bin index for screen coordinates (render pixels)
 * Returns {ix, iy} or {-1, -1} if invalid
 * Y increases downward (Babylon screen space convention)
 */
export function binIndexOf(screenX: number, screenY: number, rw: number, rh: number, bx: number, by: number): { ix: number; iy: number } {
  if (rw <= 0 || rh <= 0) return { ix: -1, iy: -1 };

  const nx = screenX / rw;
  const ny = screenY / rh; // Babylon's screen Y increases downward → this is correct

  if (Number.isNaN(nx) || Number.isNaN(ny)) return { ix: -1, iy: -1 };

  let ix = Math.floor(nx * bx);
  let iy = Math.floor(ny * by);

  if (ix < 0) ix = 0;
  if (iy < 0) iy = 0;
  if (ix >= bx) ix = bx - 1;
  if (iy >= by) iy = by - 1;

  return { ix, iy };
}

/**
 * Snap cache stored in mesh metadata for performance
 */
interface SnapCache {
  vertsWorld?: Float32Array; // x y z triplets in world space
  updateFlag?: number;       // World matrix update flag for invalidation
}

/**
 * Transform local vertex to world space
 * @deprecated Unused - kept for potential future use
 */
// @ts-expect-error - Unused but kept for potential future use
function toWorld(_v: BABYLON.Vector3, _worldMatrix: BABYLON.Matrix): BABYLON.Vector3 {
  if (!_v || !_worldMatrix) return _v;
  return BABYLON.Vector3.TransformCoordinates(_v, _worldMatrix);
}

/**
 * Project world-space vertex to screen space (render pixels)
 * Must match harness projection exactly for parity
 * Input pW is already in world space, so use Identity for worldMatrix
 * @returns Screen position {x, y, z, rw, rh} or null if projection fails
 */
export function projectToScreen(
  worldPos: BABYLON.Vector3,
  scene: BABYLON.Scene,
  camera: BABYLON.Camera
): { x: number; y: number; z: number; rw: number; rh: number } | null {
  if (!worldPos || !scene || !camera) return null;

  const engine = scene.getEngine();
  if (!engine) return null;

  const rw = engine.getRenderWidth();
  const rh = engine.getRenderHeight();
  if (rw <= 0 || rh <= 0) return null;

  // Use viewport.toGlobal(rw, rh) for viewport
  const vp = camera.viewport.toGlobal(rw, rh);
  
  // Use scene.getTransformMatrix() for view-projection
  const viewProj = scene.getTransformMatrix();
  
  // Given a world-space position, use Identity for worldMatrix (already world-space)
  const worldMatrix = BABYLON.Matrix.Identity();
  
  // Project using Vector3.Project with separate view and projection matrices
  // Note: Vector3.Project expects viewProj to be view * projection combined
  const sp = BABYLON.Vector3.Project(worldPos, worldMatrix, viewProj, vp);

  // Validate projection with 2-px tolerant frustum border
  if (!Number.isFinite(sp.x) || !Number.isFinite(sp.y) || !Number.isFinite(sp.z)) {
    return null;
  }

  // Reject if z outside [0, 1]
  if (sp.z < 0 || sp.z > 1) return null;
  
  // Reject if outside viewport with 2-px tolerance
  if (sp.x < -2 || sp.x > rw + 2) return null;
  if (sp.y < -2 || sp.y > rh + 2) return null;

  return { x: sp.x, y: sp.y, z: sp.z, rw, rh };
}

/**
 * Safely get positions array from mesh, handling instances and sourceMesh fallback
 * STLs can be instanced by importers; always read from sourceMesh if available
 * Matches harness pattern for parity
 * @returns Float32Array of positions or null
 */
export function getPositionsArray(mesh: BABYLON.AbstractMesh): Float32Array | null {
  if (!mesh) return null;

  // Normalize: always read from sourceMesh if it exists (for instances)
  const m = (mesh as any).sourceMesh ?? (mesh as BABYLON.Mesh);
  if (!m) return null;

  const data = m.getVerticesData(BABYLON.VertexBuffer.PositionKind, false, false) as Float32Array | null;
  if (!data || data.length < 3) return null;

  return data instanceof Float32Array ? data : new Float32Array(data);
}

/**
 * Get cached world-space vertices for a mesh
 * Caches results and invalidates on world matrix changes
 * @returns Float32Array of world vertices (x,y,z triplets) or null
 */
export function getWorldVerts(mesh: BABYLON.Mesh): Float32Array | null {
  if (!mesh.metadata) mesh.metadata = {};

  const cache = (mesh.metadata.__snap as SnapCache) ?? (mesh.metadata.__snap = {});
  
  // Ensure world matrix is fresh before building/caching world-space vertices
  mesh.computeWorldMatrix(true);
  const worldMatrix = mesh.getWorldMatrix();
  const currentFlag = worldMatrix.updateFlag;

  // Return cached vertices if world matrix hasn't changed
  if (cache.vertsWorld && cache.updateFlag === currentFlag) {
    return cache.vertsWorld;
  }

  // Get local vertices using robust helper that handles instances/sourceMesh
  const positions = getPositionsArray(mesh);
  if (!positions || positions.length === 0) return null;

  // Transform all vertices to world space
  const worldVerts = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const localVertex = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
    const worldVertex = BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix);
    worldVerts[i] = worldVertex.x;
    worldVerts[i + 1] = worldVertex.y;
    worldVerts[i + 2] = worldVertex.z;
  }

  // Cache for next frame
  cache.vertsWorld = worldVerts;
  cache.updateFlag = currentFlag;

  return worldVerts;
}

/**
 * Helper: Fit a circle to a set of points and return center, radius, and normal
 * Returns null if points don't form a circle (too much variance)
 * Handles triangulated circles (like cylinder ends) by filtering out center vertices
 */
const fitCircleWarningSuppression = new Map<string, number>();
const WARNING_SUPPRESSION_MS = 5000; // Suppress same warning for 5 seconds

export function fitCircleToPoints(
  points: BABYLON.Vector3[],
  tolerance: number = 0.001, // 1mm tolerance for circle detection
  debugSnap: boolean = false
): { center: BABYLON.Vector3; radius: number; normal: BABYLON.Vector3 } | null {
  if (points.length < 3) {
    // Suppress frequent warnings - only log once per 5 seconds
    const warningKey = 'not_enough_points';
    const lastWarning = fitCircleWarningSuppression.get(warningKey) || 0;
    if (Date.now() - lastWarning > WARNING_SUPPRESSION_MS) {
      console.warn(`[SnappingHelper] fitCircleToPoints: Not enough points (${points.length} < 3)`);
      fitCircleWarningSuppression.set(warningKey, Date.now());
    }
    return null;
  }

  // Calculate plane normal more robustly by trying multiple point combinations
  // This handles cases where the first 3 points might be nearly collinear
  let normal: BABYLON.Vector3 | null = null;
  const maxAttempts = Math.min(10, Math.floor(points.length / 3));
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const i0 = attempt % points.length;
    const i1 = (attempt + Math.floor(points.length / 3)) % points.length;
    const i2 = (attempt + Math.floor(points.length * 2 / 3)) % points.length;
    
    const v1 = points[i1].subtract(points[i0]);
    const v2 = points[i2].subtract(points[i0]);
    const cross = BABYLON.Vector3.Cross(v1, v2);
    
    if (cross.lengthSquared() > 0.0001) {
      normal = cross.normalize();
      break;
    }
  }
  
  // If still no good normal found, try averaging multiple cross products
  if (!normal) {
    const normals: BABYLON.Vector3[] = [];
    for (let i = 0; i < Math.min(20, points.length - 2); i++) {
      const i0 = i % points.length;
      const i1 = (i + 1) % points.length;
      const i2 = (i + 2) % points.length;
      
      const v1 = points[i1].subtract(points[i0]);
      const v2 = points[i2].subtract(points[i0]);
      const cross = BABYLON.Vector3.Cross(v1, v2);
      
      if (cross.lengthSquared() > 0.00001) {
        normals.push(cross.normalize());
      }
    }
    
    if (normals.length > 0) {
      // Average the normals (they should all point in similar directions for a circle)
      const avgNormal = normals.reduce((sum, n) => sum.add(n), BABYLON.Vector3.Zero())
        .scale(1 / normals.length);
      if (avgNormal.lengthSquared() > 0.0001) {
        normal = avgNormal.normalize();
      }
    }
  }
  
  if (!normal) {
    // Last resort: If all points are nearly coplanar with a coordinate plane, use that plane's normal
    // Check if points are mostly flat in XY, XZ, or YZ plane
    const bounds = {
      minX: Math.min(...points.map(p => p.x)),
      maxX: Math.max(...points.map(p => p.x)),
      minY: Math.min(...points.map(p => p.y)),
      maxY: Math.max(...points.map(p => p.y)),
      minZ: Math.min(...points.map(p => p.z)),
      maxZ: Math.max(...points.map(p => p.z))
    };
    const xExtent = bounds.maxX - bounds.minX;
    const yExtent = bounds.maxY - bounds.minY;
    const zExtent = bounds.maxZ - bounds.minZ;

    // If one dimension is much smaller than the others, use that as the normal
    const minExtent = Math.min(xExtent, yExtent, zExtent);
    const maxExtent = Math.max(xExtent, yExtent, zExtent);

    if (maxExtent > 0.001 && minExtent / maxExtent < 0.05) {
      // Points are roughly planar
      if (minExtent === zExtent) {
        normal = BABYLON.Vector3.Up(); // XY plane -> Z normal
      } else if (minExtent === yExtent) {
        normal = BABYLON.Vector3.Up(); // XZ plane -> Y normal (use Y for now)
      } else {
        normal = BABYLON.Vector3.Right(); // YZ plane -> X normal
      }
      if (debugSnap) {
        console.log(`[SnappingHelper] fitCircleToPoints: Using coordinate-aligned normal for ${points.length} coplanar points`);
      }
    } else {
      // Suppress frequent warnings - only log once per 5 seconds per point count
      const warningKey = `no_normal_${points.length}`;
      const lastWarning = fitCircleWarningSuppression.get(warningKey) || 0;
      if (Date.now() - lastWarning > WARNING_SUPPRESSION_MS) {
        console.warn(`[SnappingHelper] fitCircleToPoints: Could not determine plane normal from ${points.length} points`);
        fitCircleWarningSuppression.set(warningKey, Date.now());
      }
      return null;
    }
  }

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
  // Since we already removed center vertices before calling this function, use a more lenient threshold
  // Keep points that are within 30% of average radius (perimeter points)
  // This is more lenient because center vertices should already be removed
  const minRadius = avgRadius * 0.3; // More lenient: 30% instead of 50%
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

  // Use robust circle fitting with outlier rejection
  // Method: Iteratively refine center by rejecting outliers based on radius variance
  let center = initialCenter;
  
  // Multiple passes with increasingly strict filtering
  for (let pass = 0; pass < 3; pass++) {
    const radii: number[] = [];
    for (const p of perimeterPoints) {
      radii.push(BABYLON.Vector3.Distance(p, center));
    }
    
    // Calculate median radius (more robust than mean for outlier rejection)
    const sortedRadii = [...radii].sort((a, b) => a - b);
    const medianRadius = sortedRadii.length % 2 === 0
      ? (sortedRadii[sortedRadii.length / 2 - 1] + sortedRadii[sortedRadii.length / 2]) / 2
      : sortedRadii[Math.floor(sortedRadii.length / 2)];
    
    // Calculate MAD (Median Absolute Deviation) for robust outlier detection
    const deviations = radii.map(r => Math.abs(r - medianRadius));
    const sortedDeviations = [...deviations].sort((a, b) => a - b);
    const mad = sortedDeviations.length % 2 === 0
      ? (sortedDeviations[sortedDeviations.length / 2 - 1] + sortedDeviations[sortedDeviations.length / 2]) / 2
      : sortedDeviations[Math.floor(sortedDeviations.length / 2)];
    
    // Use tighter tolerance on later passes
    // Since center vertices are already removed, use more lenient tolerances
    const toleranceFactor = pass === 0 ? 0.3 : (pass === 1 ? 0.2 : 0.1); // 30%, 20%, 10% (more lenient)
    const radiusTolerance = Math.max(mad * 3, medianRadius * toleranceFactor); // Use 3*MAD or percentage, whichever is larger
    
    // Filter to only points that are on the circle (within tolerance of median radius)
    const inliers: BABYLON.Vector3[] = [];
    for (let i = 0; i < perimeterPoints.length; i++) {
      if (Math.abs(radii[i] - medianRadius) <= radiusTolerance) {
        inliers.push(perimeterPoints[i]);
      }
    }
    
    // Need at least 3 inliers
    if (inliers.length < 3) {
      // If too many points were filtered, use all perimeter points
      inliers.length = 0;
      inliers.push(...perimeterPoints);
    }
    
    // Recalculate center using least-squares circle fitting (more accurate than simple average)
    // For a circle, the center minimizes sum of (distance(p, center) - radius)^2
    // We use an iterative approach: calculate center as weighted average, where weights favor points closer to current radius estimate
    if (inliers.length >= 3) {
      // Calculate weighted center based on how close each point is to the median radius
      const weightedSum = BABYLON.Vector3.Zero();
      let totalWeight = 0;
      
      for (const p of inliers) {
        const dist = BABYLON.Vector3.Distance(p, center);
        const error = Math.abs(dist - medianRadius);
        // Weight inversely proportional to error (points closer to circle get higher weight)
        const weight = 1.0 / (1.0 + error * 1000); // Scale error to reasonable range
        weightedSum.addInPlace(p.scale(weight));
        totalWeight += weight;
      }
      
      if (totalWeight > 0) {
        center = weightedSum.scale(1 / totalWeight);
      } else {
        // Fallback to simple average
        center = inliers.reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero())
          .scale(1 / inliers.length);
      }
    }
  }

  // Calculate final radii and statistics using the refined center
  // Get final inliers (points on the circle) for accurate radius calculation
  const finalRadii: number[] = [];
  const finalInliers: BABYLON.Vector3[] = [];
  
  const tempRadii: number[] = [];
  for (const p of perimeterPoints) {
    tempRadii.push(BABYLON.Vector3.Distance(p, center));
  }
  
  // Use median radius for final filtering (more robust)
  const sortedFinalRadii = [...tempRadii].sort((a, b) => a - b);
  const finalMedianRadius = sortedFinalRadii.length % 2 === 0
    ? (sortedFinalRadii[sortedFinalRadii.length / 2 - 1] + sortedFinalRadii[sortedFinalRadii.length / 2]) / 2
    : sortedFinalRadii[Math.floor(sortedFinalRadii.length / 2)];
  
  // Final pass: filter to only points that are on the circle (within tight tolerance)
  // Since center vertices are already removed, use more lenient tolerance
  const finalRadiusTolerance = finalMedianRadius * 0.15; // 15% tolerance for final filtering (more lenient)
  
  for (let i = 0; i < perimeterPoints.length; i++) {
    if (Math.abs(tempRadii[i] - finalMedianRadius) <= finalRadiusTolerance) {
      finalInliers.push(perimeterPoints[i]);
      finalRadii.push(tempRadii[i]);
    }
  }
  
  // Use filtered inliers if we have enough, otherwise use all perimeter points
  const radiiForFinal = finalInliers.length >= 3 ? finalRadii : tempRadii;
  
  // Use median radius for final calculation (more robust than mean)
  const sortedRadiiForFinal = [...radiiForFinal].sort((a, b) => a - b);
  const finalAvgRadius = sortedRadiiForFinal.length % 2 === 0
    ? (sortedRadiiForFinal[sortedRadiiForFinal.length / 2 - 1] + sortedRadiiForFinal[sortedRadiiForFinal.length / 2]) / 2
    : sortedRadiiForFinal[Math.floor(sortedRadiiForFinal.length / 2)];
  
  // Find max radius for visualization (use maximum to encompass all vertices)
  const maxRadiusValue = radiiForFinal.length > 0 ? Math.max(...radiiForFinal) : finalAvgRadius;

  // Check if all perimeter points are approximately equidistant from center (circle check)
  const radiusVariance = radiiForFinal.reduce((sum, r) => sum + Math.pow(r - finalAvgRadius, 2), 0) / radiiForFinal.length;
  const radiusStdDev = Math.sqrt(radiusVariance);
  const relativeError = finalAvgRadius > 0 ? radiusStdDev / finalAvgRadius : Infinity;

  // If relative error is too high, it's not a circle
  // Use strict 5% tolerance to avoid false positives on coarse geometry
  if (relativeError > 0.05 || finalAvgRadius < tolerance) { // 5% tolerance, minimum 1mm radius
    // Suppress frequent warnings - only log in debug mode or once per 5 seconds
    const warningKey = `circle_fit_failed`;
    const lastWarning = fitCircleWarningSuppression.get(warningKey) || 0;
    if (Date.now() - lastWarning > WARNING_SUPPRESSION_MS) {
      // Only log detailed debug info if explicitly enabled
      // console.warn(`[SnappingHelper] ⚠️ fitCircleToPoints failed: relativeError=${(relativeError * 100).toFixed(2)}%, finalAvgRadius=${(finalAvgRadius * 1000).toFixed(3)}mm, tolerance=${(tolerance * 1000).toFixed(3)}mm`);
      fitCircleWarningSuppression.set(warningKey, Date.now());
    }
    return null;
  }

  // Ensure normal is properly normalized (fix any floating point errors)
  const finalNormal = normal.clone().normalize();

  // For visualization purposes, use the maximum radius so the ring encompasses all vertices
  // (The average radius would make the ring smaller than some vertices)
  return { center, radius: maxRadiusValue, normal: finalNormal };
}

/**
 * Try circle-center detection using screen-space annulus approach
 * Returns circle center if detected, null otherwise
 */

export function tryCircleCenter(
  scene: BABYLON.Scene,
  visiblePts: { w: BABYLON.Vector3; sx: number; sy: number; occluded?: boolean }[],
  pointerX: number,
  pointerY: number,
  dpr: number,
  centerCss: number,
  camera: BABYLON.Camera,
  config: SnapCircleConfig = DEFAULT_SNAP_CIRCLE_CONFIG
): { world: BABYLON.Vector3; screen: { x: number; y: number; z: number; rw: number; rh: number }; radius: number; normal: BABYLON.Vector3; vertices?: BABYLON.Vector3[]; meshName?: string } | null {
  const engine = scene.getEngine();
  if (!engine) return null;
  const rw = engine.getRenderWidth();
  const rh = engine.getRenderHeight();
  if (rw <= 0 || rh <= 0) return null;

  // Depth-gate: front-visible only
  const front: typeof visiblePts = [];
  for (const p of visiblePts) {
    if (p.occluded === true) continue;
    front.push(p);
  }
  if (front.length < config.minFrontPoints) return null;

  // Screen annulus around pointer
  const px = pointerX;
  const py = pointerY;
  const threshPx = (centerCss ?? 140) * dpr;
  const inner = Math.max(12 * dpr, config.innerRadiusFactor * threshPx);
  const outer = config.outerRadiusFactor * threshPx;

  const ann: typeof front = [];
  for (const p of front) {
    const dx = p.sx - px;
    const dy = p.sy - py;
    const sd = Math.hypot(dx, dy);
    if (sd < inner) continue;
    if (sd > outer) continue;
    ann.push(p);
  }
  if (ann.length < config.minKeptPoints) return null;

  // Plane fit
  const basis = fitPlanePCA(ann.map(a => a.w));
  if (!basis) return null;

  // Get camera forward direction
  let camForward: BABYLON.Vector3;
  if (camera instanceof BABYLON.ArcRotateCamera) {
    camForward = camera.getTarget().clone().subtract(camera.position).normalize();
  } else {
    // For other camera types, use forward ray direction
    const forward = camera.getForwardRay(1).direction;
    camForward = forward.normalize();
  }
  if (BABYLON.Vector3.Dot(basis.n, camForward) > 0) {
    basis.n.scaleInPlace(-1);
    basis.v.scaleInPlace(-1);
  }

  // Project to 2D plane
  const uv: { u: number; v: number }[] = [];
  for (const a of ann) {
    const q = a.w.subtract(basis.origin);
    const u = BABYLON.Vector3.Dot(q, basis.u);
    const v = BABYLON.Vector3.Dot(q, basis.v);
    uv.push({ u, v });
  }

  // Taubin + trimming
  let fit = taubinCircle(uv);
  if (!fit?.ok || fit.r <= 0) return null;
  const rel = fit.rms / Math.max(fit.r, 1e-6);
  if (rel > 0.10) {
    // Trim worst quartile and refit
    const res = uv.map(p => Math.abs(Math.hypot(p.u - fit!.cx, p.v - fit!.cy) - fit!.r));
    const q75 = quantile(res, 0.75);
    const keep: typeof uv = [];
    for (let i = 0; i < uv.length; i++) {
      if (res[i] <= q75) keep.push(uv[i]);
    }
    if (keep.length < config.minKeptPoints) return null;
    const refit = taubinCircle(keep);
    if (!refit?.ok || refit.r <= 0) return null;
    fit = refit;
  }

  // Coverage + residual gates
  const cov = angularCoverage(uv, fit.cx, fit.cy);
  const relRms = fit.rms / Math.max(fit.r, config.minRadiusMeters);
  if (cov < config.minCoverageRad) return null;
  if (relRms > config.maxRelRms) return null;
  if (fit.r < config.minRadiusMeters) return null;

  // Lift center back to world + screen for preview
  const centerW = basis.origin.clone()
    .addInPlace(basis.u.scale(fit.cx))
    .addInPlace(basis.v.scale(fit.cy));
  const s = projectToScreen(centerW, scene, camera);
  if (!s || s.z < 0 || s.z > 1) return null;

  // Extract world-space vertices for debug visualization (optional)
  const worldVertices = ann.map(a => a.w);

  return { world: centerW, screen: s, radius: fit.r, normal: basis.n.clone(), vertices: worldVertices };
}

