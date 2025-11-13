// Circle detection utilities for circle-center snapping
// Uses PCA plane fitting + Taubin circle fitting with robust validation

import * as BABYLON from "@babylonjs/core";

export type UV = { u: number; v: number; w?: BABYLON.Vector3 };
export type PlaneBasis = { origin: BABYLON.Vector3; u: BABYLON.Vector3; v: BABYLON.Vector3; n: BABYLON.Vector3 };
export type CircleFit = { cx: number; cy: number; r: number; rms: number; ok: boolean };

/**
 * Configuration for circle-center snap detection
 * Centralized thresholds for tuning circle detection behavior
 */
export type SnapCircleConfig = {
  minFrontPoints: number;
  minKeptPoints: number;
  minCoverageRad: number;
  maxRelRms: number;
  minRadiusMeters: number;
  innerRadiusFactor: number;
  outerRadiusFactor: number;
};

export const DEFAULT_SNAP_CIRCLE_CONFIG: SnapCircleConfig = {
  minFrontPoints: 16,
  minKeptPoints: 24,
  minCoverageRad: 7 * Math.PI / 6, // ~210°
  maxRelRms: 0.08,
  minRadiusMeters: 1e-3,
  innerRadiusFactor: 0.6,
  outerRadiusFactor: 1.4,
};

/**
 * Simple 3x3 symmetric eigen decomposition (power iteration for smallest eigenvalue)
 * Returns eigenvector for smallest eigenvalue (normal direction)
 */
function eigenSym3(M: number[][]): { v: number[][]; lambda: number[] } | null {
  if (!M || M.length !== 3) return null;
  
  // Power iteration for smallest eigenvalue (normal)
  let nx = 1, ny = 0, nz = 0;
  for (let iter = 0; iter < 10; iter++) {
    const tx = M[0][0] * nx + M[0][1] * ny + M[0][2] * nz;
    const ty = M[1][0] * nx + M[1][1] * ny + M[1][2] * nz;
    const tz = M[2][0] * nx + M[2][1] * ny + M[2][2] * nz;
    const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (len < 1e-10) break;
    nx = tx / len;
    ny = ty / len;
    nz = tz / len;
  }
  
  return {
    v: [[nx], [ny], [nz]],
    lambda: [0] // Not computed, only need direction
  };
}

/**
 * Fit plane to 3D points using PCA
 * Returns orthonormal basis {origin, u, v, n} where n is the plane normal
 */
export function fitPlanePCA(points: BABYLON.Vector3[]): PlaneBasis | null {
  if (!points?.length || points.length < 3) return null;
  
  const n = points.length;
  const c = points.reduce((a, p) => a.addInPlace(p), new BABYLON.Vector3()).scale(1 / n);
  
  // Covariance matrix
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const p of points) {
    const q = p.subtract(c);
    xx += q.x * q.x;
    xy += q.x * q.y;
    xz += q.x * q.z;
    yy += q.y * q.y;
    yz += q.y * q.z;
    zz += q.z * q.z;
  }
  
  const invN = 1 / n;
  xx *= invN;
  xy *= invN;
  xz *= invN;
  yy *= invN;
  yz *= invN;
  zz *= invN;
  
  // Symmetric covariance matrix
  const M = [
    [xx, xy, xz],
    [xy, yy, yz],
    [xz, yz, zz],
  ];
  
  const ev = eigenSym3(M);
  if (!ev) return null;
  
  const nrm = new BABYLON.Vector3(ev.v[0][0], ev.v[1][0], ev.v[2][0]).normalize();
  
  // Build orthonormal basis
  const u0 = Math.abs(nrm.x) < 0.9 ? new BABYLON.Vector3(1, 0, 0) : new BABYLON.Vector3(0, 1, 0);
  const u = BABYLON.Vector3.Cross(nrm, u0).normalize();
  const v = BABYLON.Vector3.Cross(nrm, u).normalize();
  
  return { origin: c, u, v, n: nrm };
}

/**
 * Taubin circle fit (2D)
 * Fits circle to points in 2D plane using Taubin's method
 */
export function taubinCircle(pts: { u: number; v: number }[]): CircleFit | null {
  if (!pts?.length || pts.length < 6) return null;
  
  let meanU = 0, meanV = 0;
  for (const p of pts) {
    meanU += p.u;
    meanV += p.v;
  }
  meanU /= pts.length;
  meanV /= pts.length;
  
  let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (const p of pts) {
    const u = p.u - meanU;
    const v = p.v - meanV;
    Suu += u * u;
    Svv += v * v;
    Suv += u * v;
    Suuu += u * u * u;
    Svvv += v * v * v;
    Suvv += u * v * v;
    Svuu += v * u * u;
  }
  
  const invN = 1 / pts.length;
  Suu *= invN;
  Svv *= invN;
  Suv *= invN;
  Suuu *= invN;
  Svvv *= invN;
  Suvv *= invN;
  Svuu *= invN;
  
  const A = [
    [2 * (Suu - meanU * meanU), 2 * (Suv - meanU * meanV)],
    [2 * (Suv - meanU * meanV), 2 * (Svv - meanV * meanV)],
  ];
  const B = [
    (Suuu + Suvv) / 2 - meanU * (Suu + Svv),
    (Svvv + Svuu) / 2 - meanV * (Suu + Svv),
  ];
  
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  if (Math.abs(det) < 1e-12) {
    return { cx: 0, cy: 0, r: 0, rms: Infinity, ok: false };
  }
  
  const cx = ((B[0] * A[1][1] - B[1] * A[0][1]) / det) + meanU;
  const cy = ((-B[0] * A[1][0] + B[1] * A[0][0]) / det) + meanV;
  
  let r2 = 0;
  for (const p of pts) {
    const du = p.u - cx;
    const dv = p.v - cy;
    r2 += du * du + dv * dv;
  }
  const r = Math.sqrt(r2 / pts.length);
  
  let rms = 0;
  for (const p of pts) {
    const du = p.u - cx;
    const dv = p.v - cy;
    rms += Math.abs(Math.hypot(du, dv) - r);
  }
  rms /= pts.length;
  
  return { cx, cy, r, rms, ok: r > 0 && Number.isFinite(r) && Number.isFinite(rms) };
}

/**
 * Compute angular coverage of points around a center
 * Returns coverage in radians [0, 2π]
 */
export function angularCoverage(pts: { u: number; v: number }[], cx: number, cy: number): number {
  if (!pts?.length || pts.length < 2) return 0;
  
  const ang = pts.map(p => Math.atan2(p.v - cy, p.u - cx)).sort((a, b) => a - b);
  
  let maxGap = 0;
  for (let i = 1; i < ang.length; i++) {
    const gap = ang[i] - ang[i - 1];
    if (gap > maxGap) maxGap = gap;
  }
  
  // Check wrap-around gap
  const wrap = (ang[0] + 2 * Math.PI) - ang[ang.length - 1];
  maxGap = Math.max(maxGap, wrap);
  
  return Math.min(2 * Math.PI - maxGap, 2 * Math.PI);
}

/**
 * Quantile helper for outlier rejection
 */
export function quantile(arr: number[], q: number): number {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * q);
  return sorted[idx];
}

