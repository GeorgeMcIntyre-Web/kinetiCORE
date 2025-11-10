// Type guards for runtime type checking
// Owner: George (core utilities)

import * as BABYLON from '@babylonjs/core';

/**
 * Type guard to check if an object is a Babylon.js Quaternion instance or a serialized quaternion
 * Handles Zustand store serialization where Quaternion instances become plain objects
 */
export function isQuaternionLike(obj: any): obj is BABYLON.Quaternion | { x: number; y: number; z: number; w: number } {
  if (!obj) return false;

  // Check if it's an actual Quaternion instance
  if (obj instanceof BABYLON.Quaternion) return true;

  // Check if it's a serialized quaternion (plain object with x, y, z, w properties)
  return (
    (typeof obj.x === 'number' || typeof obj._x === 'number') &&
    (typeof obj.y === 'number' || typeof obj._y === 'number') &&
    (typeof obj.z === 'number' || typeof obj._z === 'number') &&
    (typeof obj.w === 'number' || typeof obj._w === 'number')
  );
}

/**
 * Safely reconstructs a Quaternion from various sources:
 * - Actual Quaternion instance (returned as-is)
 * - Serialized quaternion from Zustand (reconstructed)
 * - Invalid input (returns identity quaternion)
 */
export function ensureQuaternion(value: any): BABYLON.Quaternion {
  if (!value) {
    return BABYLON.Quaternion.Identity();
  }

  // Already a Quaternion instance
  if (value instanceof BABYLON.Quaternion) {
    return value.clone();
  }

  // Serialized quaternion - reconstruct
  if (isQuaternionLike(value)) {
    const val = value as any; // Cast to any to access potential _x, _y, _z, _w properties
    return new BABYLON.Quaternion(
      val.x ?? val._x ?? 0,
      val.y ?? val._y ?? 0,
      val.z ?? val._z ?? 0,
      val.w ?? val._w ?? 1
    );
  }

  // Invalid input - return identity
  console.warn('[typeGuards] ensureQuaternion received invalid input:', value);
  return BABYLON.Quaternion.Identity();
}

/**
 * Type guard for Vector3 instances or serialized vectors
 */
export function isVector3Like(obj: any): obj is BABYLON.Vector3 | { x: number; y: number; z: number } {
  if (!obj) return false;

  if (obj instanceof BABYLON.Vector3) return true;

  return (
    (typeof obj.x === 'number' || typeof obj._x === 'number') &&
    (typeof obj.y === 'number' || typeof obj._y === 'number') &&
    (typeof obj.z === 'number' || typeof obj._z === 'number')
  );
}

/**
 * Safely reconstructs a Vector3 from various sources
 */
export function ensureVector3(value: any): BABYLON.Vector3 {
  if (!value) {
    return BABYLON.Vector3.Zero();
  }

  if (value instanceof BABYLON.Vector3) {
    return value.clone();
  }

  if (isVector3Like(value)) {
    const val = value as any; // Cast to any to access potential _x, _y, _z properties
    return new BABYLON.Vector3(
      val.x ?? val._x ?? 0,
      val.y ?? val._y ?? 0,
      val.z ?? val._z ?? 0
    );
  }

  console.warn('[typeGuards] ensureVector3 received invalid input:', value);
  return BABYLON.Vector3.Zero();
}
