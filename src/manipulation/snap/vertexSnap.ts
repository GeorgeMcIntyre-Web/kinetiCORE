// Vertex snap strategy - snap to nearest vertex
// Extracted from SnappingHelper.ts for better organization

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { isSnapExcluded } from '../snapConstants';
import { queryNearestVertex } from '../snapIndex';
import {
  BIN_COLS,
  BIN_ROWS,
  OCCLUSION_PAD_MM,
  BinnedProjection,
  ScreenBin,
  binIndexOf,
  projectToScreen,
  getPositionsArray,
  getWorldVerts,
} from './snapHelpers';
import { SnapResult } from './snapTypes';
import { DEBUG_SNAP, DEBUG_SNAP_DIAG } from './preview';

export type VertexSnapArgs = {
  position: BABYLON.Vector3;
  snapDistance: number;
  excludeMeshIds: string[];
  camera?: BABYLON.Camera;
  screenSpacePixels?: number;
  pointerScreenX?: number;
  pointerScreenY?: number;
  onPreview?: (point: BABYLON.Vector3, snapType: string) => void;
  onClearPreview?: () => void;
};

/**
 * Snap to nearest vertex
 */
export function snapToVertexStrategy(args: VertexSnapArgs): SnapResult {
  const {
    position,
    snapDistance: _snapDistance,
    excludeMeshIds,
    camera,
    screenSpacePixels,
    pointerScreenX,
    pointerScreenY,
    onPreview,
    onClearPreview,
  } = args;

  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) return { snapped: false, position: position.clone() };
  
  // Quick asserts (temporary)
  if (!camera) return { snapped: false, position: position.clone() };
  const engine = scene.getEngine();
  if (!engine) return { snapped: false, position: position.clone() };
  const rw = engine.getRenderWidth();
  const rh = engine.getRenderHeight();
  if (rw <= 0 || rh <= 0) {
    console.warn(`[SnapDiag][Assert] Invalid render dimensions: rw=${rw} rh=${rh}`);
    return { snapped: false, position: position.clone() };
  }
  if (pointerScreenX !== undefined && (pointerScreenX < 0 || pointerScreenX >= rw)) {
    console.warn(`[SnapDiag][Assert] pointerX=${pointerScreenX} out of range [0,${rw})`);
  }
  if (pointerScreenY !== undefined && (pointerScreenY < 0 || pointerScreenY >= rh)) {
    console.warn(`[SnapDiag][Assert] pointerY=${pointerScreenY} out of range [0,${rh})`);
  }
  if (scene.activeCamera !== camera) {
    console.warn(`[SnapDiag][Assert] activeCamera mismatch: using provided camera`);
  }
  
  // Instrument parity logs (every 60 frames)
  const dpr = 1 / engine.getHardwareScalingLevel();
  if (scene.getFrameId() % 60 === 0) {
    if (DEBUG_SNAP_DIAG) {
      console.log(`[SnapDiag][Cfg] rw=${rw} rh=${rh} dpr=${dpr.toFixed(2)} threshPx=${screenSpacePixels ?? 'N/A'}`);
    }
  }

  // Use pointer screen coordinates if provided (accurate), otherwise project position (fallback)
  let screenPos: { x: number; y: number } | null = null;
  if (camera && screenSpacePixels !== undefined) {
    if (pointerScreenX !== undefined && pointerScreenY !== undefined) {
      // PREFERRED: Use actual pointer screen coordinates (avoids ground anchor pollution)
      screenPos = { x: pointerScreenX, y: pointerScreenY };
    } else {
      // FALLBACK: Project world position to screen space (may hit ground/grid)
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
  }
  let closestVertex: BABYLON.Vector3 | null = null;
  let closestDistance = Infinity; // Start with Infinity, not snapDistanceMeters - we want to find the closest regardless
  let closestScreenDistance = Infinity; // Track closest screen-space distance when using screen-space snapping
  let closestMeshName = '';
  
  // Debug: Track statistics
  let meshesChecked = 0;
  let meshesWithVertices = 0;
  let totalVerticesChecked = 0;

  // BOUNDED CANDIDATE SET: Prioritize meshes directly under cursor for performance
  // This is critical for dense geometry (MH5 base with 40k+ vertices)
  const allMeshes = new Set<BABYLON.Mesh>();

  if (camera && pointerScreenX !== undefined && pointerScreenY !== undefined) {
    // A) Existing depth-ordered ray hits (keep)
    const ray = scene.createPickingRay(
      pointerScreenX,
      pointerScreenY,
      BABYLON.Matrix.Identity(),
      camera,
      true
    );
    const hits = scene.multiPickWithRay(ray, (m) => !isSnapExcluded(m)) || [];
    const underCursor: Set<BABYLON.AbstractMesh> = new Set(hits.map(h => h.pickedMesh!).filter(Boolean));

    // B) Thick ray capsule: collect meshes whose AABB center lies within 20-50mm of ray
    const R_MIN = 0.02; // 20mm minimum
    const R_MAX = 0.05; // 50mm maximum
    const R = Math.max(R_MIN, Math.min(R_MAX, (camera as any).radius ? (camera as any).radius * 0.02 : 0.03));
    const rayFrom = ray.origin;
    const rayDir = ray.direction.normalize();
    
    for (const m of scene.meshes) {
      if (underCursor.size >= 32) break; // Cap to 32 meshes
      if (isSnapExcluded(m)) continue;
      if (underCursor.has(m)) continue; // Already added
      const bb = m.getBoundingInfo()?.boundingBox;
      if (!bb) continue;
      
      // Distance from AABB center to ray (cheap heuristic)
      const c = bb.centerWorld;
      const v = c.subtract(rayFrom);
      const t = Math.max(0, BABYLON.Vector3.Dot(v, rayDir));
      const p = rayFrom.add(rayDir.scale(t));
      const d = BABYLON.Vector3.Distance(c, p);
      
      if (d <= R) {
        underCursor.add(m);
      }
    }

    // C) Cap & move to allMeshes
    const seen = new Set<number>();
    let boundedCount = 0;
    for (const m of underCursor) {
      if (!(m instanceof BABYLON.Mesh)) continue;
      if (seen.has(m.uniqueId)) continue;
      seen.add(m.uniqueId);
      allMeshes.add(m);
      boundedCount++;
      if (boundedCount >= 32) break;
    }
  }

  // 2) Fallback to scene.meshes only if we still have zero
  if (allMeshes.size === 0) {
    for (const m of scene.meshes) {
      if (!isSnapExcluded(m) && m instanceof BABYLON.Mesh) {
        allMeshes.add(m);
        if (allMeshes.size >= 32) break;
      }
    }
  }

  // SCREEN-SPACE BINNING: Build binned projections for candidate meshes
  // This provides robust vertex discovery independent of ray hits
  let binningFoundMatch = false;
  let occludedCount = 0; // Global counter for occluded vertices (used in both binning and legacy paths)
  if (camera && screenSpacePixels !== undefined && pointerScreenX !== undefined && pointerScreenY !== undefined) {
    const frameId = scene.getFrameId();
    const engine = scene.getEngine();
    const rw = engine.getRenderWidth(true);
    const rh = engine.getRenderHeight(true);
    // screenSpacePixels is already in render pixels, no need to multiply by dpr
    const screenThresh = screenSpacePixels;

    // Create pointer ray once for depth-gating
    const ray = scene.createPickingRay(pointerScreenX, pointerScreenY, BABYLON.Matrix.Identity(), camera, false);
    
    // Measure front depth across candidate meshes
    let frontDepth = Number.POSITIVE_INFINITY;
    const hits = scene.multiPickWithRay(ray, m => {
      if (!(m instanceof BABYLON.Mesh)) return false;
      return allMeshes.has(m);
    }) || [];
    for (const h of hits) {
      if (!h || !h.hit) continue;
      if (h.distance < frontDepth) frontDepth = h.distance;
    }
    
    // Fallback to nearest general hit so we don't cull everything when ground wins
    if (!Number.isFinite(frontDepth)) {
      const general = scene.pick(pointerScreenX, pointerScreenY);
      if (general && general.hit && general.pickedMesh && !isSnapExcluded(general.pickedMesh)) {
        frontDepth = general.distance;
      }
    }
    
    // Prepare occlusion constants
    const pad = 0.001 * (OCCLUSION_PAD_MM ?? 3); // meters
    const hasDepthGate = Number.isFinite(frontDepth);
    const _tmp = new BABYLON.Vector3(); // Reusable temp vector to avoid GC
    
    // Helper function to check if a vertex is occluded
    const isOccluded = (worldVertex: BABYLON.Vector3): boolean => {
      if (!hasDepthGate) return false;
      _tmp.copyFrom(worldVertex).subtractInPlace(ray.origin);
      const t = BABYLON.Vector3.Dot(_tmp, ray.direction);
      if (t > frontDepth + pad) return true;  // behind first surface
      if (t < 0) return true;                 // behind camera
      return false;
    };
    
    // Use global occludedCount (declared above)

    // Filter meshes to bin (exclude ground/UI)
    const meshesToBin: BABYLON.Mesh[] = [];
    for (const m of allMeshes) {
      if (isSnapExcluded(m) || excludeMeshIds.includes(m.uniqueId.toString())) continue;
      if (m instanceof BABYLON.Mesh) meshesToBin.push(m);
    }

    // Build binned projections
    // For each candidate mesh: computeWorldMatrix(true), get positions from sourceMesh when instanced,
    // project vertices → screen using viewport.toGlobal(rw, rh), bin into 64×36 grid
    const binned: BinnedProjection[] = [];
    for (const mesh of meshesToBin) {
      // Ensure fresh world matrix
      mesh.computeWorldMatrix(true);
      
      // Get positions from sourceMesh when instanced
      const positions = getPositionsArray(mesh);
      if (!positions || positions.length < 3) continue;
      
      // Build world-space vertices
      const worldVerts = getWorldVerts(mesh);
      if (!worldVerts || worldVerts.length < 3) continue;

      // PERFORMANCE: Screen-space binning divides the viewport into a grid (64x36 bins) to limit vertex checks.
      // This prevents worst-case O(n) slowdown on dense BIW/robot scenes by only checking vertices in nearby bins.
      const cols = BIN_COLS;
      const rows = BIN_ROWS;
      const bins: ScreenBin[] = Array.from({ length: cols * rows }, () => ({ indices: [] }));

      const v = new BABYLON.Vector3();
      for (let i = 0; i < worldVerts.length; i += 3) {
        v.set(worldVerts[i], worldVerts[i + 1], worldVerts[i + 2]);
        
        // Depth-gate: skip occluded vertices
        if (isOccluded(v)) {
          occludedCount++;
          continue;
        }
        
        // Project using viewport.toGlobal(rw, rh) - already done in projectToScreen
        const s = projectToScreen(v, scene, camera);
        if (s === null) continue;
        const { ix, iy } = binIndexOf(s.x, s.y, rw, rh, cols, rows);
        if (ix < 0 || iy < 0) continue;
        const bi = iy * cols + ix;
        bins[bi].indices.push(i);
      }

      binned.push({ frameId, rw, rh, cols, rows, bins, worldVerts, mesh });
    }

    // Search pointer's bin neighborhood with spill-out for dead zones
    const SEARCH_RADIUS_BINS = 1; // Start with 3x3 window
    let globalClosestPx = Infinity;
    let best = { mesh: null as BABYLON.Mesh | null, idx: -1, px: Infinity, wx: 0, wy: 0, wz: 0 };
    let binsSearched = 0;
    let totalCandidates = 0;
    let lastRingSearched = 0; // Track which ring was searched
    const binPopulations = new Map<string, number>(); // (bx,by):count

    for (const B of binned) {
      const { rw, rh, cols, rows, bins, worldVerts, mesh } = B;
      const { ix: baseX, iy: baseY } = binIndexOf(pointerScreenX, pointerScreenY, rw, rh, cols, rows);
      if (baseX < 0 || baseY < 0) continue;

      // Onion-layer search: expand outward until we find vertices or hit max radius
      // Run onion search (3×3 → 5×5 → 7×7) centered on the pointer bin
      // Keep expanding until success (foundAny = true) or max radius reached
      let foundAny = false;
      let searchRadius = SEARCH_RADIUS_BINS; // Start with 3×3
      const maxRadius = 3; // Cap at 7×7 window max

      while (!foundAny && searchRadius <= maxRadius) {
        // Generate ring indices for this radius
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            // Only check outer ring if expanding (skip inner rings already checked)
            if (searchRadius > SEARCH_RADIUS_BINS) {
              const innerRadius = searchRadius - 1;
              if (Math.abs(dx) <= innerRadius && Math.abs(dy) <= innerRadius) {
                continue; // Already checked in previous radius
              }
            }
            const cx = baseX + dx;
            const cy = baseY + dy;
            if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
            const bi = cy * cols + cx;
            const bucket = bins[bi].indices;
            if (!bucket || bucket.length === 0) continue;

            // Found vertices in this bin - mark as found and process
            foundAny = true;
            lastRingSearched = Math.max(lastRingSearched, searchRadius);
            binsSearched++;
            const binKey = `(${cx},${cy})`;
            binPopulations.set(binKey, (binPopulations.get(binKey) || 0) + bucket.length);
            totalCandidates += bucket.length;

            // Refine inside the bucket - pick vertex with smallest screen distance to (pointerX, pointerY)
            const tmp = new BABYLON.Vector3();
            for (let k = 0; k < bucket.length; k++) {
              const i = bucket[k];
              tmp.set(worldVerts[i], worldVerts[i + 1], worldVerts[i + 2]);
              const s = projectToScreen(tmp, scene, camera);
              if (s === null) continue;
              const dxp = s.x - pointerScreenX;
              const dyp = s.y - pointerScreenY;
              const dist = Math.hypot(dxp, dyp);
              if (dist < globalClosestPx) {
                globalClosestPx = dist;
                best = { mesh, idx: i, px: dist, wx: tmp.x, wy: tmp.y, wz: tmp.z };
              }
            }
          }
        }
        // Only expand if we haven't found anything yet
        if (!foundAny) searchRadius++;
      }
    }

    // Temporary bin visualization logging
    if (scene.getFrameId() % 60 === 0 && binPopulations.size > 0) {
      const engine = scene.getEngine();
      const rw = engine.getRenderWidth(true);
      const rh = engine.getRenderHeight(true);
      const binIdx = binIndexOf(pointerScreenX, pointerScreenY, rw, rh, BIN_COLS, BIN_ROWS);
      const bx = binIdx.ix;
      const by = binIdx.iy;
      const binEntries = Array.from(binPopulations.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');
      if (DEBUG_SNAP_DIAG) {
        console.log(`[SnapDiag][Bins] pointer=(${bx},${by}) bins={${binEntries}} searched=${binsSearched} candidates=${totalCandidates}`);
      }
    }

    // Final snap decision (screen-space first)
    if (Number.isFinite(globalClosestPx) && globalClosestPx <= screenThresh && best.mesh && best.idx >= 0) {
      closestVertex = new BABYLON.Vector3(best.wx, best.wy, best.wz);
      closestScreenDistance = globalClosestPx;
      closestDistance = BABYLON.Vector3.Distance(position, closestVertex);
      closestMeshName = best.mesh.name;
      binningFoundMatch = true;

      // Telemetry logging (every 60 frames)
      if (scene.getFrameId() % 60 === 0) {
        const inFrustum = binned.reduce((sum, b) => sum + b.bins.reduce((s, bin) => s + bin.indices.length, 0), 0);
        const withinThreshold = binned.reduce((sum, b) => {
          return sum + b.bins.reduce((s, bin) => {
            // Count vertices in this bin that are within threshold
            let count = 0;
            const tmp = new BABYLON.Vector3();
            for (const i of bin.indices) {
              tmp.set(b.worldVerts[i], b.worldVerts[i + 1], b.worldVerts[i + 2]);
              const s = projectToScreen(tmp, scene, camera);
              if (s === null) continue;
              const dxp = s.x - pointerScreenX;
              const dyp = s.y - pointerScreenY;
              const dist = Math.hypot(dxp, dyp);
              if (dist <= screenThresh) count++;
            }
            return s + count;
          }, 0);
        }, 0);
        const usedBins = binPopulations.size;
        const dpr = 1 / scene.getEngine().getHardwareScalingLevel();
        
        // Store for comparison
        if (typeof window !== 'undefined') {
          (window as any).__lastMinPx = globalClosestPx;
          (window as any).__lastNear = withinThreshold;
        }
        
        if (DEBUG_SNAP_DIAG) {
          console.log(`[SnapDiag] inFrustum=${inFrustum} near=${withinThreshold} minPx=${globalClosestPx.toFixed(1)} occluded=${occludedCount} bins.used=${usedBins} bins.ring=${lastRingSearched} rw=${rw} rh=${rh} px=${pointerScreenX} py=${pointerScreenY} dpr=${dpr.toFixed(2)}`);
        }
      }

      // Binning found a match - skip legacy scan
      // Continue to snap decision logic below
    } else if (binned.length > 0 && scene.getFrameId() % 60 === 0) {
      // Log when binning ran but found nothing
      const inFrustum = binned.reduce((sum, b) => sum + b.bins.reduce((s, bin) => s + bin.indices.length, 0), 0);
      const camTarget = (camera as any).target || camera.position;
      const camDist = BABYLON.Vector3.Distance(camera.globalPosition || camera.position, camTarget);
      const meshCount = meshesToBin.length;
      const dpr = 1 / scene.getEngine().getHardwareScalingLevel();
      if (DEBUG_SNAP_DIAG) {
        console.log(`[SnapDiag] inFrustum=${inFrustum} near=0 minPx=${globalClosestPx !== Infinity ? globalClosestPx.toFixed(1) : 'INF'} occluded=${occludedCount} dpr=${dpr.toFixed(2)} camDist=${camDist.toFixed(3)} mesh=NONE bins=${binned.length} searched=${binsSearched} meshes=${meshCount} (no match)`);
      }
      
      // Debug exclusion reasons if near==0 but harness shows near>0
      // Print per-mesh exclusion reasons for all candidate meshes
      if (DEBUG_SNAP_DIAG) {
        console.log(`[SnapDiag][Exclusions] Checking ${allMeshes.size} candidate meshes (near=0 but harness may show near>0):`);
      }
      for (const m of allMeshes) {
        if (m instanceof BABYLON.Mesh) {
          const excluded = isSnapExcluded(m);
          const inExcludeList = excludeMeshIds.includes(m.uniqueId.toString());
          const layerMask = m.layerMask;
          const isPickable = m.isPickable;
          const metadata = m.metadata || {};
          const hasVerts = m.getVerticesData(BABYLON.VertexBuffer.PositionKind) !== null;
          if (DEBUG_SNAP_DIAG) {
            console.log(`[SnapDiag][Exclusions] ${m.name}: excluded=${excluded} excludeList=${inExcludeList} layerMask=${layerMask} isPickable=${isPickable} hasVerts=${hasVerts} metadataKeys=${JSON.stringify(Object.keys(metadata))}`);
          }
        }
      }
    }
  }

  // FALLBACK: Legacy per-vertex scan (only if binning didn't find a match)
  // Priority order: 1) Bin vertices (primary), 2) Snap index (secondary), 3) Legacy scan (fallback)
  if (!binningFoundMatch) {
    for (const mesh of allMeshes) {
      // Use centralized exclusion predicate + explicit excludeIds (opt-out model)
      if (isSnapExcluded(mesh) || excludeMeshIds.includes(mesh.uniqueId.toString())) {
        continue;
      }

      meshesChecked++;

      // PREFERRED: Use snap index if available (fast O(log N) lookup for STL meshes)
      if (camera && screenSpacePixels !== undefined && pointerScreenX !== undefined && pointerScreenY !== undefined) {
        const idxHit = queryNearestVertex(mesh, camera, pointerScreenX, pointerScreenY, screenSpacePixels);
        if (idxHit && idxHit.px < closestScreenDistance) {
          closestVertex = idxHit.pos;
          closestScreenDistance = idxHit.px;
          closestDistance = BABYLON.Vector3.Distance(position, idxHit.pos);
          closestMeshName = mesh.name;
          continue; // Index path found a match, skip legacy scan for this mesh
        }
      }

    // FALLBACK: Legacy per-vertex scan (for meshes without index or when index query fails)
    // Get cached world-space vertices (performance optimization)
    const worldVerts = getWorldVerts(mesh);
    if (!worldVerts || worldVerts.length === 0) continue;

    meshesWithVertices++;
    const vertexCount = worldVerts.length / 3;

    // Performance optimization: Skip very large meshes for preview
    const MAX_VERTICES_FOR_PREVIEW = 50000;
    if (vertexCount > MAX_VERTICES_FOR_PREVIEW) {
      continue;
    }


    // ADAPTIVE DECIMATION: For dense STL meshes, use coarse → fine sampling
    // Phase A: Coarse scan with adaptive stride to find approximate closest
    const vertCount = worldVerts.length / 3;
    const targetMax = 30000; // Tighten sampling on dense bases
    const step = Math.max(1, Math.ceil(vertCount / targetMax));

    // Create pointer ray for depth-gating (if not already created in binning path)
    let legacyRay: BABYLON.Ray | null = null;
    let legacyFrontDepth = Number.POSITIVE_INFINITY;
    let legacyHasDepthGate = false;
    let legacyPad = 0;
    const legacyTmp = new BABYLON.Vector3();
    let legacyOccludedCount = 0;
    
    if (camera && pointerScreenX !== undefined && pointerScreenY !== undefined) {
      legacyRay = scene.createPickingRay(pointerScreenX, pointerScreenY, BABYLON.Matrix.Identity(), camera, false);
      const legacyHits = scene.multiPickWithRay(legacyRay, m => {
        if (!(m instanceof BABYLON.Mesh)) return false;
        return allMeshes.has(m);
      }) || [];
      for (const h of legacyHits) {
        if (!h || !h.hit) continue;
        if (h.distance < legacyFrontDepth) legacyFrontDepth = h.distance;
      }
      if (!Number.isFinite(legacyFrontDepth)) {
        const general = scene.pick(pointerScreenX, pointerScreenY);
        if (general && general.hit && general.pickedMesh && !isSnapExcluded(general.pickedMesh)) {
          legacyFrontDepth = general.distance;
        }
      }
      legacyPad = 0.001 * (OCCLUSION_PAD_MM ?? 3);
      legacyHasDepthGate = Number.isFinite(legacyFrontDepth);
    }
    
    // Helper function for legacy path
    const legacyIsOccluded = (worldVertex: BABYLON.Vector3): boolean => {
      if (!legacyHasDepthGate || !legacyRay) return false;
      legacyTmp.copyFrom(worldVertex).subtractInPlace(legacyRay.origin);
      const t = BABYLON.Vector3.Dot(legacyTmp, legacyRay.direction);
      if (t > legacyFrontDepth + legacyPad) return true;
      if (t < 0) return true;
      return false;
    };

    // Coarse pass: Track closest index and pixel distance directly
    let meshClosestIdx = -1;
    let meshClosestPx = Infinity;
    
    for (let i = 0; i < worldVerts.length; i += 3 * step) {
      totalVerticesChecked++;
      const worldVertex = new BABYLON.Vector3(worldVerts[i], worldVerts[i + 1], worldVerts[i + 2]);

      // Depth-gate: skip occluded vertices
      if (legacyIsOccluded(worldVertex)) {
        legacyOccludedCount++;
        continue;
      }

      // Track closest index during coarse pass (for screen-space snapping)
      if (camera && screenSpacePixels !== undefined && screenPos) {
        const screenVertex = projectToScreen(worldVertex, scene, camera);
        if (screenVertex) {
          const dx = screenVertex.x - screenPos.x;
          const dy = screenVertex.y - screenPos.y;
          const px = Math.hypot(dx, dy);
          if (px < meshClosestPx) {
            meshClosestPx = px;
            meshClosestIdx = i;
          }
        }
      }
    }

    // Log coarse pass results
    if (step > 1 && camera && screenSpacePixels !== undefined) {
      if (DEBUG_SNAP_DIAG) {
        console.log(`[Snap] coarse ${mesh.name} step=${step} idx=${meshClosestIdx} px=${meshClosestPx !== Infinity ? meshClosestPx.toFixed(1) : 'N/A'}`);
      }
    }

    // Phase B: Local refinement around the winner for exactness (if stride > 1)
    // Use coarse winner index directly - no float equality search needed
    if (step > 1 && meshClosestIdx >= 0 && camera && screenSpacePixels !== undefined && screenPos) {
      const K = 60 * step; // ~60 neighbors window scaled by stride
      const start = Math.max(0, meshClosestIdx - 3 * K);
      const end = Math.min(worldVerts.length, meshClosestIdx + 3 * K);
      const wp = new BABYLON.Vector3();

      if (DEBUG_SNAP_DIAG) {
        console.log(`[Snap] refine ${mesh.name} win=${(60*step)*2} px=${meshClosestPx.toFixed(1)}`);
      }

      for (let j = start; j < end; j += 3) {
        wp.set(worldVerts[j], worldVerts[j + 1], worldVerts[j + 2]);
        
        // Depth-gate: skip occluded vertices
        if (legacyIsOccluded(wp)) {
          legacyOccludedCount++;
          continue;
        }
        
        const s = projectToScreen(wp, scene, camera);
        if (!s) continue;

        const dx = s.x - screenPos.x;
        const dy = s.y - screenPos.y;
        const px = Math.hypot(dx, dy);
        if (px >= meshClosestPx) continue;

        const wd = BABYLON.Vector3.Distance(wp, position);
        meshClosestPx = px;
        meshClosestIdx = j;
        closestScreenDistance = px;
        closestDistance = wd;
        closestVertex = wp.clone();
        closestMeshName = mesh.name;
      }
    }

    // Update global occluded count from legacy path
    occludedCount += legacyOccludedCount;
    
    // After refine (or if no refine needed), use the coarse/refined winner
    if (meshClosestIdx >= 0 && camera && screenSpacePixels !== undefined && screenPos) {
      // Update global closest if this mesh's winner is better
      if (meshClosestPx < closestScreenDistance) {
        const wp = new BABYLON.Vector3(worldVerts[meshClosestIdx], worldVerts[meshClosestIdx + 1], worldVerts[meshClosestIdx + 2]);
        closestScreenDistance = meshClosestPx;
        closestDistance = BABYLON.Vector3.Distance(wp, position);
        closestVertex = wp;
        closestMeshName = mesh.name;
      }
    } else if (!camera || screenSpacePixels === undefined || !screenPos) {
      // Fallback: Use world-space distance when screen-space unavailable
      if (meshClosestIdx >= 0) {
        const wp = new BABYLON.Vector3(worldVerts[meshClosestIdx], worldVerts[meshClosestIdx + 1], worldVerts[meshClosestIdx + 2]);
        const distance = BABYLON.Vector3.Distance(position, wp);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestVertex = wp;
          closestMeshName = mesh.name;
        }
      }
    }
    }
  }

  // DEBUG: Log search results when very close to camera
  if (DEBUG_SNAP && camera && BABYLON.Vector3.Distance(camera.position, position) < 0.3) {
    console.log(`[SnappingHelper] Vertex search: meshes=${meshesChecked}, meshesWithVerts=${meshesWithVertices}, totalVerts=${totalVerticesChecked}, closest=${closestVertex ? 'YES' : 'NO'}, closestDist=${closestVertex ? (closestDistance * 1000).toFixed(2) + 'mm' : 'N/A'}, closestScreenDist=${closestScreenDistance !== Infinity ? closestScreenDistance.toFixed(1) + 'px' : 'N/A'}`);
  }

  // MAGNETIC OVERRIDE: Final decision (magnetic override)
  // Use screen-space distance for snap decision
  const shouldSnap = (closestScreenDistance <= (screenSpacePixels ?? Infinity));
  
  if (shouldSnap && closestVertex) {
    // Call showPreviewDot with winner world position
    if (onPreview) {
      onPreview(closestVertex, 'vertex');
    }
    // Clone vectors to ensure immutability
    const positionClone = closestVertex.clone();
    return {
      snapped: true,
      position: positionClone,
      snapType: 'vertex',
      targetMeshName: closestMeshName,
      visualFeedback: [positionClone.clone()],
    };
  } else {
    // Clear preview dot if no snap
    if (onClearPreview) {
      onClearPreview();
    }
  }

  return { snapped: false, position: position.clone() };
}

