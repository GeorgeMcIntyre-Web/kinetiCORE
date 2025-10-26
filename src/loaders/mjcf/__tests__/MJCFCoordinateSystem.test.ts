import { Vector3, Quaternion } from "@babylonjs/core";
import {
  convertPosition,
  convertQuaternion,
  convertAxis,
  convertScale,
  convertPositionToMuJoCo,
  convertQuaternionToMuJoCo,
  convertAxisToMuJoCo,
  validateConversion,
  runCoordinateSystemTests
} from "../MJCFCoordinateSystem";

describe("MJCF Coordinate System Conversion", () => {
  
  describe("Position Conversion", () => {
    test("converts unit vectors correctly", () => {
      // Unit X vector (right) - should remain unchanged
      expect(convertPosition([1, 0, 0])).toEqual(new Vector3(1, 0, 0));
      
      // Unit Y vector (forward in MuJoCo) - should become Z in Babylon
      expect(convertPosition([0, 1, 0])).toEqual(new Vector3(0, 0, 1));
      
      // Unit Z vector (up in MuJoCo) - should become Y in Babylon
      expect(convertPosition([0, 0, 1])).toEqual(new Vector3(0, 1, 0));
    });

    test("converts complex positions correctly", () => {
      const mujocoPos: [number, number, number] = [2, 3, 4];
      const expected = new Vector3(2, 4, 3); // Swap Y and Z
      
      expect(convertPosition(mujocoPos)).toEqual(expected);
    });

    test("handles negative values", () => {
      const mujocoPos: [number, number, number] = [-1, -2, -3];
      const expected = new Vector3(-1, -3, -2); // Swap Y and Z
      
      expect(convertPosition(mujocoPos)).toEqual(expected);
    });

    test("throws error for invalid input", () => {
      expect(() => convertPosition([1, 2])).toThrow("Invalid MuJoCo position");
      expect(() => convertPosition([])).toThrow("Invalid MuJoCo position");
      expect(() => convertPosition(null as any)).toThrow("Invalid MuJoCo position");
    });
  });

  describe("Quaternion Conversion", () => {
    test("converts identity quaternion", () => {
      const mujocoQuat: [number, number, number, number] = [1, 0, 0, 0];
      const expected = new Quaternion(0, 0, 0, 1);
      
      expect(convertQuaternion(mujocoQuat)).toEqual(expected);
    });

    test("converts 90 degree rotation around Z axis", () => {
      const mujocoQuat: [number, number, number, number] = [0.7071, 0, 0, 0.7071];
      // MuJoCo [w, x, y, z] -> Babylon (x, z, y, w)
      // [0.7071, 0, 0, 0.7071] -> (0, 0.7071, 0, 0.7071)
      const expected = new Quaternion(0, 0.7071, 0, 0.7071);

      const result = convertQuaternion(mujocoQuat);
      expect(result.x).toBeCloseTo(expected.x, 4);
      expect(result.y).toBeCloseTo(expected.y, 4);
      expect(result.z).toBeCloseTo(expected.z, 4);
      expect(result.w).toBeCloseTo(expected.w, 4);
    });

    test("converts arbitrary quaternion", () => {
      const mujocoQuat: [number, number, number, number] = [0.8, 0.1, 0.2, 0.3];
      // MuJoCo [w, x, y, z] -> Babylon (x, z, y, w)
      // [0.8, 0.1, 0.2, 0.3] -> (0.1, 0.3, 0.2, 0.8) - swaps y and z
      const expected = new Quaternion(0.1, 0.3, 0.2, 0.8);

      expect(convertQuaternion(mujocoQuat)).toEqual(expected);
    });

    test("throws error for invalid input", () => {
      expect(() => convertQuaternion([1, 2, 3])).toThrow("Invalid MuJoCo quaternion");
      expect(() => convertQuaternion([])).toThrow("Invalid MuJoCo quaternion");
      expect(() => convertQuaternion(null as any)).toThrow("Invalid MuJoCo quaternion");
    });
  });

  describe("Axis Conversion", () => {
    test("converts unit axis vectors", () => {
      // X axis - should remain unchanged
      expect(convertAxis([1, 0, 0])).toEqual(new Vector3(1, 0, 0));
      
      // Y axis (forward in MuJoCo) - should become Z in Babylon
      expect(convertAxis([0, 1, 0])).toEqual(new Vector3(0, 0, 1));
      
      // Z axis (up in MuJoCo) - should become Y in Babylon
      expect(convertAxis([0, 0, 1])).toEqual(new Vector3(0, 1, 0));
    });

    test("converts joint axes correctly", () => {
      // Common joint axis patterns
      const hipAxis: [number, number, number] = [0, 1, 0]; // Forward rotation
      const expectedHip = new Vector3(0, 0, 1); // Should become Z-axis in Babylon
      
      expect(convertAxis(hipAxis)).toEqual(expectedHip);
    });

    test("handles normalized axes", () => {
      const normalizedAxis: [number, number, number] = [0.7071, 0.7071, 0];
      const expected = new Vector3(0.7071, 0, 0.7071); // Swap Y and Z
      
      expect(convertAxis(normalizedAxis)).toEqual(expected);
    });
  });

  describe("Scale Conversion", () => {
    test("scale remains unchanged (no coordinate system transformation)", () => {
      const mujocoScale: [number, number, number] = [2, 3, 4];
      const expected = new Vector3(2, 3, 4); // No change for scale
      
      expect(convertScale(mujocoScale)).toEqual(expected);
    });

    test("handles uniform scaling", () => {
      const uniformScale: [number, number, number] = [0.5, 0.5, 0.5];
      const expected = new Vector3(0.5, 0.5, 0.5);
      
      expect(convertScale(uniformScale)).toEqual(expected);
    });

    test("handles negative scaling", () => {
      const negativeScale: [number, number, number] = [-1, 1, -1];
      const expected = new Vector3(-1, 1, -1);
      
      expect(convertScale(negativeScale)).toEqual(expected);
    });
  });

  describe("Round-trip Conversion", () => {
    test("position round-trip preserves values", () => {
      const originalPos: [number, number, number] = [1.5, 2.5, 3.5];
      const convertedPos = convertPosition(originalPos);
      const backToMuJoCo = convertPositionToMuJoCo(convertedPos);
      
      expect(backToMuJoCo[0]).toBeCloseTo(originalPos[0], 6);
      expect(backToMuJoCo[1]).toBeCloseTo(originalPos[1], 6);
      expect(backToMuJoCo[2]).toBeCloseTo(originalPos[2], 6);
    });

    test("quaternion round-trip preserves values", () => {
      const originalQuat: [number, number, number, number] = [0.8, 0.1, 0.2, 0.3];
      const convertedQuat = convertQuaternion(originalQuat);
      const backToMuJoCo = convertQuaternionToMuJoCo(convertedQuat);
      
      expect(backToMuJoCo[0]).toBeCloseTo(originalQuat[0], 6);
      expect(backToMuJoCo[1]).toBeCloseTo(originalQuat[1], 6);
      expect(backToMuJoCo[2]).toBeCloseTo(originalQuat[2], 6);
      expect(backToMuJoCo[3]).toBeCloseTo(originalQuat[3], 6);
    });

    test("axis round-trip preserves values", () => {
      const originalAxis: [number, number, number] = [0.6, 0.8, 0];
      const convertedAxis = convertAxis(originalAxis);
      const backToMuJoCo = convertAxisToMuJoCo(convertedAxis);
      
      expect(backToMuJoCo[0]).toBeCloseTo(originalAxis[0], 6);
      expect(backToMuJoCo[1]).toBeCloseTo(originalAxis[1], 6);
      expect(backToMuJoCo[2]).toBeCloseTo(originalAxis[2], 6);
    });
  });

  describe("Validation Function", () => {
    test("validates correct conversions", () => {
      const result = validateConversion(
        "Test Position",
        [1, 2, 3],
        new Vector3(1, 3, 2)
      );
      
      expect(result).toBe(true);
    });

    test("reports incorrect conversions", () => {
      const result = validateConversion(
        "Test Position",
        [1, 2, 3],
        new Vector3(1, 2, 3) // Wrong - should be (1, 3, 2)
      );
      
      expect(result).toBe(false);
    });

    test("handles quaternion validation", () => {
      const result = validateConversion(
        "Test Quaternion",
        [1, 0, 0, 0],
        new Quaternion(0, 0, 0, 1)
      );
      
      expect(result).toBe(true);
    });
  });

  describe("Test Suite Runner", () => {
    test("runCoordinateSystemTests passes all tests", () => {
      const result = runCoordinateSystemTests();
      expect(result).toBe(true);
    });
  });

  describe("Real-world Test Cases", () => {
    test("MuJoCo robot base position conversion", () => {
      // Typical robot base position in MuJoCo
      const basePos: [number, number, number] = [0, 0, 0.1]; // 10cm above ground
      const converted = convertPosition(basePos);
      
      // Should be at Y=0.1 in Babylon (10cm above ground in Y-up)
      expect(converted).toEqual(new Vector3(0, 0.1, 0));
    });

    test("MuJoCo joint axis conversion", () => {
      // Hip joint typically rotates around Y-axis (forward) in MuJoCo
      const hipAxis: [number, number, number] = [0, 1, 0];
      const converted = convertAxis(hipAxis);
      
      // Should rotate around Z-axis (forward) in Babylon
      expect(converted).toEqual(new Vector3(0, 0, 1));
    });

    test("MuJoCo orientation quaternion conversion", () => {
      // Robot standing upright in MuJoCo (identity quaternion)
      const uprightQuat: [number, number, number, number] = [1, 0, 0, 0];
      const converted = convertQuaternion(uprightQuat);
      
      // Should still be upright in Babylon
      expect(converted).toEqual(new Quaternion(0, 0, 0, 1));
    });

    test("MuJoCo scale conversion", () => {
      // Mesh scale in MuJoCo assets
      const meshScale: [number, number, number] = [0.001, 0.001, 0.001]; // mm to m
      const converted = convertScale(meshScale);
      
      // Scale should remain unchanged
      expect(converted).toEqual(new Vector3(0.001, 0.001, 0.001));
    });
  });

  describe("Edge Cases", () => {
    test("handles zero vectors", () => {
      expect(convertPosition([0, 0, 0])).toEqual(new Vector3(0, 0, 0));
      expect(convertAxis([0, 0, 0])).toEqual(new Vector3(0, 0, 0));
      expect(convertScale([0, 0, 0])).toEqual(new Vector3(0, 0, 0));
    });

    test("handles very small values", () => {
      const smallPos: [number, number, number] = [1e-10, 2e-10, 3e-10];
      const converted = convertPosition(smallPos);
      
      expect(converted.x).toBeCloseTo(1e-10, 15);
      expect(converted.y).toBeCloseTo(3e-10, 15);
      expect(converted.z).toBeCloseTo(2e-10, 15);
    });

    test("handles very large values", () => {
      const largePos: [number, number, number] = [1e10, 2e10, 3e10];
      const converted = convertPosition(largePos);
      
      expect(converted.x).toBeCloseTo(1e10, 0);
      expect(converted.y).toBeCloseTo(3e10, 0);
      expect(converted.z).toBeCloseTo(2e10, 0);
    });
  });
});

