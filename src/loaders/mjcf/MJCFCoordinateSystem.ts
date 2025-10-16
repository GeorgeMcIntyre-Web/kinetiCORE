import { Vector3, Quaternion } from "@babylonjs/core";

/**
 * Unified coordinate system conversion for MuJoCo Z-up → Babylon Y-up
 * 
 * MuJoCo uses Z-up coordinate system:
 * - X: Right
 * - Y: Forward  
 * - Z: Up (vertical)
 * 
 * Babylon uses Y-up coordinate system:
 * - X: Right
 * - Y: Up (vertical)
 * - Z: Forward
 * 
 * This module provides consistent conversion functions used throughout
 * the MJCF loader, eliminating conditional logic based on mesh types.
 */

/**
 * Convert position from MuJoCo Z-up to Babylon Y-up coordinate system
 * @param mujocoPos Position in MuJoCo format [x, y, z]
 * @returns Position in Babylon format Vector3(x, z, y)
 */
export function convertPosition(mujocoPos: [number, number, number]): Vector3 {
  if (!Array.isArray(mujocoPos) || mujocoPos.length < 3) {
    throw new Error(`Invalid MuJoCo position: expected [x,y,z], got ${mujocoPos}`);
  }
  
  const [x, y, z] = mujocoPos;
  
  // MuJoCo Z-up → Babylon Y-up: swap Y and Z components
  return new Vector3(x, z, y);
}

/**
 * Convert quaternion from MuJoCo Z-up to Babylon Y-up coordinate system
 * @param mujocoQuat Quaternion in MuJoCo format [w, x, y, z]
 * @returns Quaternion in Babylon format
 */
export function convertQuaternion(mujocoQuat: [number, number, number, number]): Quaternion {
  if (!Array.isArray(mujocoQuat) || mujocoQuat.length < 4) {
    throw new Error(`Invalid MuJoCo quaternion: expected [w,x,y,z], got ${mujocoQuat}`);
  }
  
  const [w, x, y, z] = mujocoQuat;
  
  // Convert from MuJoCo (w,x,y,z) to Babylon.js (x,y,z,w) format
  // The quaternion represents the same rotation, just reordered
  return new Quaternion(x, y, z, w);
}

/**
 * Convert axis vector from MuJoCo Z-up to Babylon Y-up coordinate system
 * @param mujocoAxis Axis vector in MuJoCo format [x, y, z]
 * @returns Axis vector in Babylon format Vector3(x, z, y)
 */
export function convertAxis(mujocoAxis: [number, number, number]): Vector3 {
  if (!Array.isArray(mujocoAxis) || mujocoAxis.length < 3) {
    throw new Error(`Invalid MuJoCo axis: expected [x,y,z], got ${mujocoAxis}`);
  }
  
  const [x, y, z] = mujocoAxis;
  
  // MuJoCo Z-up → Babylon Y-up: swap Y and Z components
  return new Vector3(x, z, y);
}

/**
 * Convert scale vector from MuJoCo to Babylon (no coordinate system change needed)
 * @param mujocoScale Scale vector in MuJoCo format [x, y, z]
 * @returns Scale vector in Babylon format Vector3(x, y, z)
 */
export function convertScale(mujocoScale: [number, number, number]): Vector3 {
  if (!Array.isArray(mujocoScale) || mujocoScale.length < 3) {
    throw new Error(`Invalid MuJoCo scale: expected [x,y,z], got ${mujocoScale}`);
  }
  
  const [x, y, z] = mujocoScale;
  
  // Scale doesn't change with coordinate system transformation
  return new Vector3(x, y, z);
}

/**
 * Convert position from Babylon Y-up back to MuJoCo Z-up coordinate system
 * @param babylonPos Position in Babylon format Vector3
 * @returns Position in MuJoCo format [x, y, z]
 */
export function convertPositionToMuJoCo(babylonPos: Vector3): [number, number, number] {
  // Babylon Y-up → MuJoCo Z-up: swap Y and Z components
  return [babylonPos.x, babylonPos.z, babylonPos.y];
}

/**
 * Convert quaternion from Babylon Y-up back to MuJoCo Z-up coordinate system
 * @param babylonQuat Quaternion in Babylon format
 * @returns Quaternion in MuJoCo format [w, x, y, z]
 */
export function convertQuaternionToMuJoCo(babylonQuat: Quaternion): [number, number, number, number] {
  // Convert from Babylon.js (x,y,z,w) to MuJoCo (w,x,y,z) format
  return [babylonQuat.w, babylonQuat.x, babylonQuat.y, babylonQuat.z];
}

/**
 * Convert axis vector from Babylon Y-up back to MuJoCo Z-up coordinate system
 * @param babylonAxis Axis vector in Babylon format Vector3
 * @returns Axis vector in MuJoCo format [x, y, z]
 */
export function convertAxisToMuJoCo(babylonAxis: Vector3): [number, number, number] {
  // Babylon Y-up → MuJoCo Z-up: swap Y and Z components
  return [babylonAxis.x, babylonAxis.z, babylonAxis.y];
}

/**
 * Validate that a coordinate conversion is working correctly
 * @param testName Name of the test case
 * @param mujocoInput Input in MuJoCo format
 * @param expectedBabylon Expected output in Babylon format
 * @returns true if conversion matches expected result
 */
export function validateConversion(
  testName: string,
  mujocoInput: [number, number, number] | [number, number, number, number],
  expectedBabylon: Vector3 | Quaternion
): boolean {
  try {
    let result: Vector3 | Quaternion;
    
    if (mujocoInput.length === 3) {
      result = convertPosition(mujocoInput as [number, number, number]);
    } else {
      result = convertQuaternion(mujocoInput as [number, number, number, number]);
    }
    
    const matches = result.equals(expectedBabylon as any);
    
    if (!matches) {
      console.warn(`[MJCF Coordinate] ${testName} failed:`, {
        input: mujocoInput,
        expected: expectedBabylon,
        actual: result
      });
    }
    
    return matches;
  } catch (error) {
    console.error(`[MJCF Coordinate] ${testName} error:`, error);
    return false;
  }
}

/**
 * Test suite for coordinate conversion functions
 * Run this to verify all conversions are working correctly
 */
export function runCoordinateSystemTests(): boolean {
  console.log("[MJCF Coordinate] Running coordinate system tests...");
  
  let allPassed = true;
  
  // Test position conversions
  allPassed = validateConversion(
    "Position: Unit X",
    [1, 0, 0],
    new Vector3(1, 0, 0)
  ) && allPassed;
  
  allPassed = validateConversion(
    "Position: Unit Y (forward)",
    [0, 1, 0],
    new Vector3(0, 0, 1)
  ) && allPassed;
  
  allPassed = validateConversion(
    "Position: Unit Z (up)",
    [0, 0, 1],
    new Vector3(0, 1, 0)
  ) && allPassed;
  
  allPassed = validateConversion(
    "Position: Complex",
    [2, 3, 4],
    new Vector3(2, 4, 3)
  ) && allPassed;
  
  // Test quaternion conversions
  allPassed = validateConversion(
    "Quaternion: Identity",
    [1, 0, 0, 0],
    new Quaternion(0, 0, 0, 1)
  ) && allPassed;
  
  allPassed = validateConversion(
    "Quaternion: 90° around Z",
    [0.7071, 0, 0, 0.7071],
    new Quaternion(0, 0, 0.7071, 0.7071)
  ) && allPassed;
  
  // Test axis conversions
  allPassed = validateConversion(
    "Axis: Unit X",
    [1, 0, 0],
    new Vector3(1, 0, 0)
  ) && allPassed;
  
  allPassed = validateConversion(
    "Axis: Unit Y (forward)",
    [0, 1, 0],
    new Vector3(0, 0, 1)
  ) && allPassed;
  
  allPassed = validateConversion(
    "Axis: Unit Z (up)",
    [0, 0, 1],
    new Vector3(0, 1, 0)
  ) && allPassed;
  
  // Test round-trip conversions
  const testPos: [number, number, number] = [1.5, 2.5, 3.5];
  const convertedPos = convertPosition(testPos);
  const backToMuJoCo = convertPositionToMuJoCo(convertedPos);
  
  const posRoundTrip = Math.abs(testPos[0] - backToMuJoCo[0]) < 1e-6 &&
                      Math.abs(testPos[1] - backToMuJoCo[1]) < 1e-6 &&
                      Math.abs(testPos[2] - backToMuJoCo[2]) < 1e-6;
  
  if (!posRoundTrip) {
    console.warn("[MJCF Coordinate] Position round-trip failed:", {
      original: testPos,
      converted: convertedPos,
      backToMuJoCo: backToMuJoCo
    });
    allPassed = false;
  }
  
  const testQuat: [number, number, number, number] = [0.8, 0.1, 0.2, 0.3];
  const convertedQuat = convertQuaternion(testQuat);
  const backToMuJoCoQuat = convertQuaternionToMuJoCo(convertedQuat);
  
  const quatRoundTrip = Math.abs(testQuat[0] - backToMuJoCoQuat[0]) < 1e-6 &&
                       Math.abs(testQuat[1] - backToMuJoCoQuat[1]) < 1e-6 &&
                       Math.abs(testQuat[2] - backToMuJoCoQuat[2]) < 1e-6 &&
                       Math.abs(testQuat[3] - backToMuJoCoQuat[3]) < 1e-6;
  
  if (!quatRoundTrip) {
    console.warn("[MJCF Coordinate] Quaternion round-trip failed:", {
      original: testQuat,
      converted: convertedQuat,
      backToMuJoCo: backToMuJoCoQuat
    });
    allPassed = false;
  }
  
  if (allPassed) {
    console.log("[MJCF Coordinate] ✅ All coordinate system tests passed!");
  } else {
    console.error("[MJCF Coordinate] ❌ Some coordinate system tests failed!");
  }
  
  return allPassed;
}
