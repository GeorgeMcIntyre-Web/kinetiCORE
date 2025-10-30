import * as BABYLON from '@babylonjs/core';
import { KDTree } from './KDTree';

export interface ICPOptions {
  maxIterations?: number;
  tolerance?: number; // RMS change threshold
  trimFraction?: number; // 0..1 keep best matches
  rejectThreshold?: number; // max correspondence distance (meters)
}

export interface ICPResult {
  success: boolean;
  transform: BABYLON.Matrix; // world-space R|t
  rmsError: number;
  iterations: number;
  correspondences: number;
}

function computeCentroid(points: BABYLON.Vector3[]): BABYLON.Vector3 {
  const c = new BABYLON.Vector3(0, 0, 0);
  if (points.length === 0) return c;
  for (const p of points) c.addInPlace(p);
  return c.scale(1 / points.length);
}

function svdRigidTransform(A: BABYLON.Vector3[], B: BABYLON.Vector3[]): { R: BABYLON.Matrix; t: BABYLON.Vector3 } {
  const ca = computeCentroid(A);
  const cb = computeCentroid(B);
  // Build 3x3 covariance H = Σ (a_i - ca) (b_i - cb)^T
  let h00 = 0, h01 = 0, h02 = 0, h10 = 0, h11 = 0, h12 = 0, h20 = 0, h21 = 0, h22 = 0;
  for (let i = 0; i < A.length; i++) {
    const ax = A[i].x - ca.x, ay = A[i].y - ca.y, az = A[i].z - ca.z;
    const bx = B[i].x - cb.x, by = B[i].y - cb.y, bz = B[i].z - cb.z;
    h00 += ax * bx; h01 += ax * by; h02 += ax * bz;
    h10 += ay * bx; h11 += ay * by; h12 += ay * bz;
    h20 += az * bx; h21 += az * by; h22 += az * bz;
  }
  const H = BABYLON.Matrix.FromArray([
    h00, h01, h02, 0,
    h10, h11, h12, 0,
    h20, h21, h22, 0,
    0,   0,   0,   1,
  ]);
  // Use BABYLON.Matrix to extract rotation via polar decomposition fallback
  // Compute SVD of 3x3: we approximate via Eigen decomposition of H^T H and then build R using UV^T
  const ht = H.clone(); ht.transposeToRef(ht);
  const htH = ht.multiply(H);
  // Extract eigenvectors of htH using a simple power iteration for 3 components
  const eigVecs: BABYLON.Vector3[] = powerIterationEigenvectors3(htH);
  const V = matrixFromCols(eigVecs[0], eigVecs[1], eigVecs[2]);
  const U = H.multiply(V);
  // Orthonormalize U and V
  const Uo = orthonormalize3(U);
  const Vo = orthonormalize3(V);
  const R = Uo.multiply(Vo.transpose());
  // Translation
  const rca3 = BABYLON.Vector3.TransformCoordinates(ca, R);
  const t = new BABYLON.Vector3(cb.x - rca3.x, cb.y - rca3.y, cb.z - rca3.z);
  const Rt = R.clone();
  Rt.setRowFromFloats(0, Rt.m[0], Rt.m[1], Rt.m[2], t.x);
  Rt.setRowFromFloats(1, Rt.m[4], Rt.m[5], Rt.m[6], t.y);
  Rt.setRowFromFloats(2, Rt.m[8], Rt.m[9], Rt.m[10], t.z);
  return { R: Rt, t };
}

function matrixFromCols(a: BABYLON.Vector3, b: BABYLON.Vector3, c: BABYLON.Vector3): BABYLON.Matrix {
  return BABYLON.Matrix.FromArray([
    a.x, b.x, c.x, 0,
    a.y, b.y, c.y, 0,
    a.z, b.z, c.z, 0,
    0,   0,   0,   1,
  ]);
}

function orthonormalize3(M: BABYLON.Matrix): BABYLON.Matrix {
  const x = new BABYLON.Vector3(M.m[0], M.m[4], M.m[8]);
  const y = new BABYLON.Vector3(M.m[1], M.m[5], M.m[9]);
  const xn = x.normalize();
  const yn = y.subtract(xn.scale(BABYLON.Vector3.Dot(xn, y))).normalize();
  const zn = BABYLON.Vector3.Cross(xn, yn).normalize();
  return matrixFromCols(xn, yn, zn);
}

function powerIterationEigenvectors3(M: BABYLON.Matrix): BABYLON.Vector3[] {
  const vectors: BABYLON.Vector3[] = [];
  let B = M.clone();
  for (let k = 0; k < 3; k++) {
    let v = new BABYLON.Vector3(Math.random(), Math.random(), Math.random()).normalize();
    for (let i = 0; i < 16; i++) {
      const mv = multiplyMat3Vec(B, v); // 3x3 part
      v = mv.normalize();
    }
    vectors.push(v);
    // Deflate (simple Gram-Schmidt to remove found direction)
    const col = v;
    const P = outer(col, col);
    const I = BABYLON.Matrix.Identity();
    const D = I.subtract(P);
    B = D.multiply(B).multiply(D);
  }
  return vectors;
}

function multiplyMat3Vec(M: BABYLON.Matrix, v: BABYLON.Vector3): BABYLON.Vector3 {
  return new BABYLON.Vector3(
    M.m[0] * v.x + M.m[1] * v.y + M.m[2] * v.z,
    M.m[4] * v.x + M.m[5] * v.y + M.m[6] * v.z,
    M.m[8] * v.x + M.m[9] * v.y + M.m[10] * v.z
  );
}

function outer(a: BABYLON.Vector3, b: BABYLON.Vector3): BABYLON.Matrix {
  return BABYLON.Matrix.FromArray([
    a.x * b.x, a.x * b.y, a.x * b.z, 0,
    a.y * b.x, a.y * b.y, a.y * b.z, 0,
    a.z * b.x, a.z * b.y, a.z * b.z, 0,
    0, 0, 0, 1,
  ]);
}

export class ICP {
  static align(
    sourcePointsWorld: BABYLON.Vector3[],
    targetPointsWorld: BABYLON.Vector3[],
    options: ICPOptions = {}
  ): ICPResult {
    const maxIterations = options.maxIterations ?? 50;
    const tolerance = options.tolerance ?? 1e-5;
    const trim = Math.min(1, Math.max(0.2, options.trimFraction ?? 0.8));
    const reject = options.rejectThreshold ?? 0.05; // 5cm default

    if (sourcePointsWorld.length === 0 || targetPointsWorld.length === 0) {
      return { success: false, transform: BABYLON.Matrix.Identity(), rmsError: Infinity, iterations: 0, correspondences: 0 };
    }

    const targetTree = new KDTree(targetPointsWorld);
    let T = BABYLON.Matrix.Identity();
    let lastRMS = Number.POSITIVE_INFINITY;

    for (let iter = 0; iter < maxIterations; iter++) {
      // 1) Transform source by current T
      const srcT: BABYLON.Vector3[] = sourcePointsWorld.map(p => BABYLON.Vector3.TransformCoordinates(p, T));
      // 2) Find correspondences
      const pairs: Array<{ a: BABYLON.Vector3; b: BABYLON.Vector3; d2: number }> = [];
      for (const p of srcT) {
        const nn = targetTree.nearest(p);
        if (!nn) continue;
        const d = Math.sqrt(nn.dist2);
        if (d <= reject) pairs.push({ a: p, b: nn.point, d2: nn.dist2 });
      }
      if (pairs.length < 3) {
        return { success: false, transform: T, rmsError: lastRMS, iterations: iter, correspondences: pairs.length };
      }
      // 3) Trim outliers by distance
      const sorted = pairs.sort((x, y) => x.d2 - y.d2);
      const keep = Math.max(3, Math.floor(sorted.length * trim));
      const kept = sorted.slice(0, keep);
      const A = kept.map(p => p.a);
      const B = kept.map(p => p.b);
      // 4) Solve for rigid transform
      const { R } = svdRigidTransform(A, B);
      // 5) Update T: compose R with previous
      T = R.multiply(T);
      // 6) Compute RMS
      const err = Math.sqrt(kept.reduce((acc, k) => acc + k.d2, 0) / kept.length);
      if (Math.abs(lastRMS - err) < tolerance) {
        return { success: true, transform: T, rmsError: err, iterations: iter + 1, correspondences: kept.length };
      }
      lastRMS = err;
    }
    return { success: true, transform: T, rmsError: lastRMS, iterations: maxIterations, correspondences: 0 };
  }
}


