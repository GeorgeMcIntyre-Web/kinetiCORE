// Math utilities for kinetiCORE
import { Vector3 } from '../core/types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

export function approximately(a: number, b: number, epsilon = 0.0001): boolean {
  return Math.abs(a - b) < epsilon;
}

/**
 * Vector3 utilities
 */
export const Vec3 = {
  zero: (): Vector3 => ({ x: 0, y: 0, z: 0 }),
  one: (): Vector3 => ({ x: 1, y: 1, z: 1 }),

  add: (a: Vector3, b: Vector3): Vector3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }),

  subtract: (a: Vector3, b: Vector3): Vector3 => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }),

  multiply: (v: Vector3, scalar: number): Vector3 => ({
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar,
  }),

  dot: (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z,

  cross: (a: Vector3, b: Vector3): Vector3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),

  length: (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),

  normalize: (v: Vector3): Vector3 => {
    const len = Vec3.length(v);
    return len === 0 ? Vec3.zero() : Vec3.multiply(v, 1 / len);
  },

  distance: (a: Vector3, b: Vector3): number => Vec3.length(Vec3.subtract(a, b)),

  lerp: (a: Vector3, b: Vector3, t: number): Vector3 => ({
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  }),

  clone: (v: Vector3): Vector3 => ({ ...v }),
};
