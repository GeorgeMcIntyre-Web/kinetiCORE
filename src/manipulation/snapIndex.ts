// Snap Indexer - Pre-index meshes for fast O(log N) vertex snapping
// Owner: George
// Builds welded vertex sets + spatial hash for reliable nearest-neighbor queries

import * as BABYLON from '@babylonjs/core';

export type SnapIndex = {
  vertsWorld: Float32Array;    // welded world vertices
  worldUpdateFlag: number;     // to know when to recompute
  hash: SpatialHash3D;         // fast neighborhood queries
  cell: number;                // cell size used
};

export class SpatialHash3D {
  private map = new Map<string, number[]>();
  private cell: number;

  constructor(cell: number) {
    this.cell = cell;
  }

  private key(x: number, y: number, z: number): string {
    const i = Math.floor(x / this.cell);
    const j = Math.floor(y / this.cell);
    const k = Math.floor(z / this.cell);
    return `${i},${j},${k}`;
  }

  insert(x: number, y: number, z: number, idx: number): void {
    const key = this.key(x, y, z);
    const bucket = this.map.get(key) ?? [];
    bucket.push(idx);
    this.map.set(key, bucket);
  }

  querySphere(cx: number, cy: number, cz: number, r: number): number[] {
    const minI = Math.floor((cx - r) / this.cell);
    const maxI = Math.floor((cx + r) / this.cell);
    const minJ = Math.floor((cy - r) / this.cell);
    const maxJ = Math.floor((cy + r) / this.cell);
    const minK = Math.floor((cz - r) / this.cell);
    const maxK = Math.floor((cz + r) / this.cell);
    const out: number[] = [];

    for (let i = minI; i <= maxI; i++) {
      for (let j = minJ; j <= maxJ; j++) {
        for (let k = minK; k <= maxK; k++) {
          const b = this.map.get(`${i},${j},${k}`);
          if (b) out.push(...b);
        }
      }
    }

    return out;
  }
}

function getPositionsArray(mesh: BABYLON.AbstractMesh): Float32Array | null {
  const src = (mesh as any).sourceMesh as BABYLON.Mesh | undefined;
  const base = (mesh as BABYLON.Mesh) ?? src;
  if (!base) return null;

  const p = base.getVerticesData(BABYLON.VertexBuffer.PositionKind, false, false) as number[] | Float32Array | null;
  if (!p || p.length === 0) return null;

  return p instanceof Float32Array ? p : new Float32Array(p);
}

function weld(positions: Float32Array, eps: number): Float32Array {
  const inv = 1.0 / eps;
  const map = new Map<string, [number, number, number]>();

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const k = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`;

    if (map.has(k)) continue;
    map.set(k, [x, y, z]);
  }

  const out = new Float32Array(map.size * 3);
  let p = 0;
  for (const v of map.values()) {
    out[p++] = v[0];
    out[p++] = v[1];
    out[p++] = v[2];
  }

  return out;
}

export function buildSnapIndex(mesh: BABYLON.Mesh, epsRatio = 1e-5): SnapIndex | null {
  const pos = getPositionsArray(mesh);
  if (!pos) return null;

  mesh.computeWorldMatrix(true);
  const wm = mesh.getWorldMatrix();
  const bb = mesh.getBoundingInfo()?.boundingBox;
  const diag = bb ? BABYLON.Vector3.Distance(bb.minimumWorld, bb.maximumWorld) : 1.0;
  const eps = Math.max(diag * epsRatio, 1e-6);

  const weldedLocal = weld(pos, eps);
  const vertsWorld = new Float32Array(weldedLocal.length);
  const tmp = new BABYLON.Vector3();

  for (let i = 0; i < weldedLocal.length; i += 3) {
    tmp.set(weldedLocal[i], weldedLocal[i + 1], weldedLocal[i + 2]);
    const w = BABYLON.Vector3.TransformCoordinates(tmp, wm);
    vertsWorld[i] = w.x;
    vertsWorld[i + 1] = w.y;
    vertsWorld[i + 2] = w.z;
  }

  const cell = Math.max(eps * 4, diag * 1e-4);
  const hash = new SpatialHash3D(cell);

  for (let i = 0; i < vertsWorld.length; i += 3) {
    hash.insert(vertsWorld[i], vertsWorld[i + 1], vertsWorld[i + 2], i);
  }

  return { vertsWorld, worldUpdateFlag: wm.updateFlag, hash, cell };
}

export function ensureSnapIndex(mesh: BABYLON.Mesh): SnapIndex | null {
  const md = (mesh.metadata ??= {});
  const idx = md.__snapIndex as SnapIndex | undefined;
  mesh.computeWorldMatrix(true);
  const flag = mesh.getWorldMatrix().updateFlag;

  if (idx && idx.worldUpdateFlag === flag) return idx;

  const built = buildSnapIndex(mesh);
  if (!built) return null;
  md.__snapIndex = built;

  return built;
}

// Query by pointer ray + pixel radius projected to world radius at depth
export function queryNearestVertex(
  mesh: BABYLON.Mesh,
  camera: BABYLON.Camera,
  pointerX: number,
  pointerY: number,
  pixelRadius: number
): { idx: number; pos: BABYLON.Vector3; px: number } | null {
  const idx = ensureSnapIndex(mesh);
  if (!idx) return null;

  const engine = mesh.getScene().getEngine();
  const rw = engine.getRenderWidth();
  const rh = engine.getRenderHeight();
  const ray = mesh.getScene().createPickingRay(pointerX, pointerY, BABYLON.Matrix.Identity(), camera, true);

  // Approximate world radius from pixel radius using depth at ray origin + focal length
  const meshCenter = mesh.getBoundingInfo()?.boundingBox.centerWorld ?? ray.origin;
  const cameraPos = (camera as any).globalPosition ?? camera.position;
  const depth = BABYLON.Vector3.Distance(cameraPos, meshCenter);
  const fov = camera.fov ?? Math.PI / 4;
  const focalPx = 0.5 * rh / Math.tan(fov * 0.5);
  const worldR = Math.max((pixelRadius * depth) / focalPx, idx.cell);

  let bestIdx = -1;
  let bestPx = Infinity;
  const c = ray.origin;
  const d = ray.direction.normalize();
  
  // Limit search radius to reasonable size (prevent querying entire mesh)
  // Use a much smaller radius - just enough for the pixel radius at depth
  // With very small cell sizes, we need to be very conservative
  const searchRadius = Math.min(worldR * 3, 0.05, depth * 0.05); // Cap at 5cm or 5% of depth
  const candidates = idx.hash.querySphere(c.x, c.y, c.z, searchRadius); // broad phase
  
  // Aggressive limit - only process top 500 candidates max (reduced from 1000)
  if (candidates.length > 500) {
    // Quick distance sort - only take closest 500
    // Use a more efficient approach: only compute distances for first 2000, then sort top 500
    const sampleSize = Math.min(candidates.length, 2000);
    const withDist = new Array(sampleSize);
    for (let idx = 0; idx < sampleSize; idx++) {
      const i = candidates[idx];
      const vx = idx.vertsWorld[i];
      const vy = idx.vertsWorld[i + 1];
      const vz = idx.vertsWorld[i + 2];
      const dx = vx - c.x;
      const dy = vy - c.y;
      const dz = vz - c.z;
      withDist[idx] = { i, distSq: dx * dx + dy * dy + dz * dz };
    }
    // Sort and take top 500
    withDist.sort((a, b) => a.distSq - b.distSq);
    candidates.splice(0, candidates.length, ...withDist.slice(0, 500).map(s => s.i));
  }

  const tmp = new BABYLON.Vector3();
  const viewport = camera.viewport.toGlobal(rw, rh);
  const MAX_ITERATIONS = 500; // Safety limit - process max 500 candidates

  for (let k = 0; k < Math.min(candidates.length, MAX_ITERATIONS); k++) {
    const i = candidates[k];
    const x = idx.vertsWorld[i];
    const y = idx.vertsWorld[i + 1];
    const z = idx.vertsWorld[i + 2];

    // Distance to ray line (reject far points quickly)
    const v = new BABYLON.Vector3(x - c.x, y - c.y, z - c.z);
    const t = Math.max(0, BABYLON.Vector3.Dot(v, d));
    const p = c.add(d.scale(t));
    const lineDist = BABYLON.Vector3.Distance(p, new BABYLON.Vector3(x, y, z));
    if (lineDist > worldR) continue;

    // Screen px distance to pointer
    tmp.set(x, y, z);
    const s = BABYLON.Vector3.Project(
      tmp,
      mesh.getScene().getTransformMatrix(),
      camera.getProjectionMatrix(),
      viewport
    );

    if (s.z < 0 || s.z > 1) continue;
    const pad = 2;
    if (s.x < -pad || s.x > rw + pad) continue;
    if (s.y < -pad || s.y > rh + pad) continue;

    const px = Math.hypot(s.x - pointerX, s.y - pointerY);
    if (px >= bestPx) continue;

    bestPx = px;
    bestIdx = i;
  }

  if (bestIdx < 0) return null;

  return {
    idx: bestIdx,
    pos: new BABYLON.Vector3(
      idx.vertsWorld[bestIdx],
      idx.vertsWorld[bestIdx + 1],
      idx.vertsWorld[bestIdx + 2]
    ),
    px: bestPx,
  };
}

