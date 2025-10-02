// Coordinate System Conversion Utilities
// Owner: George
//
// USER SPACE (What engineers see):
//   - Right-handed coordinate system
//   - Z-axis is UP (vertical)
//   - Units in millimeters (mm)
//   - X = Right, Y = Forward, Z = UP
//
// INTERNAL SPACE (Babylon.js / Rapier):
//   - Right-handed coordinate system
//   - Y-axis is UP (Babylon's convention)
//   - Units in meters (m)
//   - X = Right, Y = UP, Z = Forward

import * as BABYLON from '@babylonjs/core';
import { Vector3, Quaternion } from './types';

/**
 * Unit conversion constant: millimeters to meters
 */
export const MM_TO_M = 0.001;
export const M_TO_MM = 1000;

/**
 * Convert user space coordinates (Z-up, mm) to Babylon space (Y-up, meters)
 */
export function userToBabylon(userPos: Vector3): BABYLON.Vector3 {
  return new BABYLON.Vector3(
    userPos.x * MM_TO_M, // X stays X
    userPos.z * MM_TO_M, // User Z (up) → Babylon Y (up)
    userPos.y * MM_TO_M  // User Y (forward) → Babylon Z (forward)
  );
}

/**
 * Convert Babylon space (Y-up, meters) to user space (Z-up, mm)
 */
export function babylonToUser(babylonPos: BABYLON.Vector3): Vector3 {
  return {
    x: babylonPos.x * M_TO_MM, // X stays X
    y: babylonPos.z * M_TO_MM, // Babylon Z (forward) → User Y (forward)
    z: babylonPos.y * M_TO_MM, // Babylon Y (up) → User Z (up)
  };
}

/**
 * Convert user rotation (Z-up) to Babylon rotation (Y-up)
 */
export function userRotationToBabylon(userRot: Quaternion): BABYLON.Quaternion {
  // Rotate the quaternion to account for axis swap
  // This applies a 90° rotation around X to swap Y and Z axes
  const axisSwap = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, Math.PI / 2);
  const userQuat = new BABYLON.Quaternion(userRot.x, userRot.y, userRot.z, userRot.w);
  return axisSwap.multiply(userQuat);
}

/**
 * Convert Babylon rotation (Y-up) to user rotation (Z-up)
 */
export function babylonRotationToUser(babylonRot: BABYLON.Quaternion): Quaternion {
  // Reverse the 90° rotation around X
  const axisSwap = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, -Math.PI / 2);
  const result = axisSwap.multiply(babylonRot);
  return {
    x: result.x,
    y: result.y,
    z: result.z,
    w: result.w,
  };
}

/**
 * Convert user space vector (no scaling, just axis swap)
 */
export function userVectorToBabylon(userVec: Vector3): BABYLON.Vector3 {
  return new BABYLON.Vector3(
    userVec.x, // X stays X
    userVec.z, // User Z → Babylon Y
    userVec.y  // User Y → Babylon Z
  );
}

/**
 * Create a Babylon Vector3 from mm values in user space
 */
export function createBabylonVector3(xMm: number, yMm: number, zMm: number): BABYLON.Vector3 {
  return userToBabylon({ x: xMm, y: yMm, z: zMm });
}

/**
 * Format position for display in UI (mm with proper labels)
 */
export function formatPositionForDisplay(babylonPos: BABYLON.Vector3): {
  x: string;
  y: string;
  z: string;
} {
  const userPos = babylonToUser(babylonPos);
  return {
    x: userPos.x.toFixed(1) + ' mm',
    y: userPos.y.toFixed(1) + ' mm',
    z: userPos.z.toFixed(1) + ' mm',
  };
}
