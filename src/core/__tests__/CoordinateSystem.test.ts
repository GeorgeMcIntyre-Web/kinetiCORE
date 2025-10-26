/**
 * CoordinateSystem.test.ts
 * 
 * Tests for coordinate system conversion utilities
 * Critical for ensuring correct transformations between user space (Z-up, mm)
 * and Babylon space (Y-up, meters)
 */

import { describe, it, expect } from 'vitest';
import * as CoordSystem from '../CoordinateSystem';
import * as BABYLON from '@babylonjs/core';
import { Vector3 } from '../types';

describe('CoordinateSystem', () => {
  describe('Constants', () => {
    it('should define MM_TO_M conversion constant', () => {
      expect(CoordSystem.MM_TO_M).toBe(0.001);
    });

    it('should define M_TO_MM conversion constant', () => {
      expect(CoordSystem.M_TO_MM).toBe(1000);
    });

    it('should have reciprocal conversion constants', () => {
      expect(CoordSystem.MM_TO_M * CoordSystem.M_TO_MM).toBe(1);
    });
  });

  describe('userToBabylon', () => {
    it('should convert user space origin to Babylon origin', () => {
      const userPos: Vector3 = { x: 0, y: 0, z: 0 };
      const babylonPos = CoordSystem.userToBabylon(userPos);

      expect(babylonPos.x).toBe(0);
      expect(babylonPos.y).toBe(0);
      expect(babylonPos.z).toBe(0);
    });

    it('should swap Y and Z axes', () => {
      const userPos: Vector3 = { x: 1000, y: 2000, z: 3000 }; // mm
      const babylonPos = CoordSystem.userToBabylon(userPos);

      expect(babylonPos.x).toBe(1); // X unchanged (1000mm = 1m)
      expect(babylonPos.y).toBe(3); // User Z → Babylon Y (3000mm = 3m)
      expect(babylonPos.z).toBe(2); // User Y → Babylon Z (2000mm = 2m)
    });

    it('should convert millimeters to meters', () => {
      const userPos: Vector3 = { x: 1000, y: 2000, z: 3000 };
      const babylonPos = CoordSystem.userToBabylon(userPos);

      expect(babylonPos.x).toBe(1);
      expect(babylonPos.y).toBe(3);
      expect(babylonPos.z).toBe(2);
    });

    it('should handle negative coordinates', () => {
      const userPos: Vector3 = { x: -1000, y: -2000, z: -3000 };
      const babylonPos = CoordSystem.userToBabylon(userPos);

      expect(babylonPos.x).toBe(-1);
      expect(babylonPos.y).toBe(-3);
      expect(babylonPos.z).toBe(-2);
    });

    it('should handle fractional millimeters', () => {
      const userPos: Vector3 = { x: 123.456, y: 234.567, z: 345.678 };
      const babylonPos = CoordSystem.userToBabylon(userPos);

      expect(babylonPos.x).toBeCloseTo(0.123456, 5);
      expect(babylonPos.y).toBeCloseTo(0.345678, 5);
      expect(babylonPos.z).toBeCloseTo(0.234567, 5);
    });
  });

  describe('babylonToUser', () => {
    it('should convert Babylon origin to user origin', () => {
      const babylonPos = new BABYLON.Vector3(0, 0, 0);
      const userPos = CoordSystem.babylonToUser(babylonPos);

      expect(userPos.x).toBe(0);
      expect(userPos.y).toBe(0);
      expect(userPos.z).toBe(0);
    });

    it('should swap Y and Z axes back', () => {
      const babylonPos = new BABYLON.Vector3(1, 3, 2); // meters
      const userPos = CoordSystem.babylonToUser(babylonPos);

      expect(userPos.x).toBe(1000); // X unchanged (1m = 1000mm)
      expect(userPos.y).toBe(2000); // Babylon Z → User Y (2m = 2000mm)
      expect(userPos.z).toBe(3000); // Babylon Y → User Z (3m = 3000mm)
    });

    it('should convert meters to millimeters', () => {
      const babylonPos = new BABYLON.Vector3(1, 2, 3);
      const userPos = CoordSystem.babylonToUser(babylonPos);

      expect(userPos.x).toBe(1000);
      expect(userPos.y).toBe(3000);
      expect(userPos.z).toBe(2000);
    });

    it('should handle negative coordinates', () => {
      const babylonPos = new BABYLON.Vector3(-1, -2, -3);
      const userPos = CoordSystem.babylonToUser(babylonPos);

      expect(userPos.x).toBe(-1000);
      expect(userPos.y).toBe(-3000);
      expect(userPos.z).toBe(-2000);
    });

    it('should handle fractional meters', () => {
      const babylonPos = new BABYLON.Vector3(0.123, 0.345, 0.234);
      const userPos = CoordSystem.babylonToUser(babylonPos);

      expect(userPos.x).toBeCloseTo(123, 2);
      expect(userPos.y).toBeCloseTo(234, 2);
      expect(userPos.z).toBeCloseTo(345, 2);
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve position through userToBabylon -> babylonToUser', () => {
      const original: Vector3 = { x: 1234, y: 5678, z: 9012 };
      const babylon = CoordSystem.userToBabylon(original);
      const roundTrip = CoordSystem.babylonToUser(babylon);

      expect(roundTrip.x).toBeCloseTo(original.x, 2);
      expect(roundTrip.y).toBeCloseTo(original.y, 2);
      expect(roundTrip.z).toBeCloseTo(original.z, 2);
    });

    it('should preserve position through babylonToUser -> userToBabylon', () => {
      const original = new BABYLON.Vector3(1.234, 5.678, 9.012);
      const user = CoordSystem.babylonToUser(original);
      const roundTrip = CoordSystem.userToBabylon(user);

      expect(roundTrip.x).toBeCloseTo(original.x, 5);
      expect(roundTrip.y).toBeCloseTo(original.y, 5);
      expect(roundTrip.z).toBeCloseTo(original.z, 5);
    });

    it('should preserve zero through round-trip', () => {
      const original: Vector3 = { x: 0, y: 0, z: 0 };
      const babylon = CoordSystem.userToBabylon(original);
      const roundTrip = CoordSystem.babylonToUser(babylon);

      expect(roundTrip.x).toBe(0);
      expect(roundTrip.y).toBe(0);
      expect(roundTrip.z).toBe(0);
    });
  });

  describe('userVectorToBabylon', () => {
    it('should swap Y and Z axes for vectors', () => {
      const userVec: Vector3 = { x: 1, y: 2, z: 3 };
      const babylonVec = CoordSystem.userVectorToBabylon(userVec);

      expect(babylonVec.x).toBe(1); // X unchanged
      expect(babylonVec.y).toBe(3); // User Z → Babylon Y
      expect(babylonVec.z).toBe(2); // User Y → Babylon Z
    });

    it('should NOT apply unit conversion for vectors', () => {
      // Vectors are directions, not positions, so no unit conversion
      const userVec: Vector3 = { x: 1000, y: 2000, z: 3000 };
      const babylonVec = CoordSystem.userVectorToBabylon(userVec);

      expect(babylonVec.x).toBe(1000);
      expect(babylonVec.y).toBe(3000);
      expect(babylonVec.z).toBe(2000);
    });

    it('should preserve vector magnitude (Z-up unit vectors)', () => {
      const userZUp: Vector3 = { x: 0, y: 0, z: 1 };
      const babylonVec = CoordSystem.userVectorToBabylon(userZUp);

      const magnitude = Math.sqrt(
        babylonVec.x * babylonVec.x +
        babylonVec.y * babylonVec.y +
        babylonVec.z * babylonVec.z
      );

      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('should convert Z-up to Y-up', () => {
      const userZUp: Vector3 = { x: 0, y: 0, z: 1 };
      const babylonVec = CoordSystem.userVectorToBabylon(userZUp);

      expect(babylonVec.x).toBe(0);
      expect(babylonVec.y).toBe(1); // User Z → Babylon Y
      expect(babylonVec.z).toBe(0);
    });

    it('should convert Y-forward to Z-forward', () => {
      const userYForward: Vector3 = { x: 0, y: 1, z: 0 };
      const babylonVec = CoordSystem.userVectorToBabylon(userYForward);

      expect(babylonVec.x).toBe(0);
      expect(babylonVec.y).toBe(0);
      expect(babylonVec.z).toBe(1); // User Y → Babylon Z
    });
  });

  describe('createBabylonVector3', () => {
    it('should create Babylon Vector3 from mm values', () => {
      const vec = CoordSystem.createBabylonVector3(1000, 2000, 3000);

      expect(vec.x).toBe(1);
      expect(vec.y).toBe(3); // Z swapped to Y
      expect(vec.z).toBe(2); // Y swapped to Z
    });

    it('should handle zero coordinates', () => {
      const vec = CoordSystem.createBabylonVector3(0, 0, 0);

      expect(vec.x).toBe(0);
      expect(vec.y).toBe(0);
      expect(vec.z).toBe(0);
    });
  });

  describe('formatPositionForDisplay', () => {
    it('should format position with units', () => {
      const pos = new BABYLON.Vector3(1.234567, 3.456789, 2.345678);
      const formatted = CoordSystem.formatPositionForDisplay(pos);

      expect(formatted.x).toContain('1234.6');
      expect(formatted.y).toContain('2345.7');
      expect(formatted.z).toContain('3456.8');
      expect(formatted.x).toContain('mm');
    });

    it('should round to 1 decimal place', () => {
      const pos = new BABYLON.Vector3(0.123456, 0.345678, 0.234567);
      const formatted = CoordSystem.formatPositionForDisplay(pos);

      expect(formatted.x).toContain('123.5');
      expect(formatted.y).toContain('234.6');
      expect(formatted.z).toContain('345.7');
    });
  });

  describe('Edge cases', () => {
    it('should handle very large coordinates', () => {
      const userPos: Vector3 = { x: 1e6, y: 2e6, z: 3e6 };
      const babylonPos = CoordSystem.userToBabylon(userPos);

      expect(babylonPos.x).toBe(1000);
      expect(babylonPos.y).toBe(3000);
      expect(babylonPos.z).toBe(2000);
    });

    it('should handle very small coordinates', () => {
      const userPos: Vector3 = { x: 0.001, y: 0.002, z: 0.003 };
      const babylonPos = CoordSystem.userToBabylon(userPos);

      expect(babylonPos.x).toBeCloseTo(0.000001, 9);
      expect(babylonPos.y).toBeCloseTo(0.000003, 9);
      expect(babylonPos.z).toBeCloseTo(0.000002, 9);
    });

    it('should handle Infinity', () => {
      const userPos: Vector3 = { x: Infinity, y: Infinity, z: Infinity };
      const babylonPos = CoordSystem.userToBabylon(userPos);

      expect(babylonPos.x).toBe(Infinity);
      expect(babylonPos.y).toBe(Infinity);
      expect(babylonPos.z).toBe(Infinity);
    });

    it('should handle NaN', () => {
      const userPos: Vector3 = { x: NaN, y: NaN, z: NaN };
      const babylonPos = CoordSystem.userToBabylon(userPos);

      expect(Number.isNaN(babylonPos.x)).toBe(true);
      expect(Number.isNaN(babylonPos.y)).toBe(true);
      expect(Number.isNaN(babylonPos.z)).toBe(true);
    });
  });

  describe('Real-world scenarios', () => {
    it('should convert robot TCP position (1m above ground)', () => {
      // Robot TCP at 1 meter above ground in user space (Z-up)
      const tcpUserPos: Vector3 = { x: 500, y: 200, z: 1000 }; // mm

      const tcpBabylonPos = CoordSystem.userToBabylon(tcpUserPos);

      expect(tcpBabylonPos.x).toBeCloseTo(0.5, 5); // X = 0.5m
      expect(tcpBabylonPos.y).toBeCloseTo(1.0, 5); // Y = 1.0m (height)
      expect(tcpBabylonPos.z).toBeCloseTo(0.2, 5); // Z = 0.2m (forward)
    });

    it('should convert robot base position (on ground)', () => {
      // Robot base at origin, on ground
      const baseUserPos: Vector3 = { x: 0, y: 0, z: 0 };

      const baseBabylonPos = CoordSystem.userToBabylon(baseUserPos);

      expect(baseBabylonPos.x).toBe(0);
      expect(baseBabylonPos.y).toBe(0); // On ground (Y=0 in Babylon)
      expect(baseBabylonPos.z).toBe(0);
    });

    it('should convert CAD model coordinates (typical industrial part)', () => {
      // CAD part at 500mm x 300mm x 200mm
      const partUserPos: Vector3 = { x: 500, y: 300, z: 200 };

      const partBabylonPos = CoordSystem.userToBabylon(partUserPos);

      expect(partBabylonPos.x).toBeCloseTo(0.5, 5);
      expect(partBabylonPos.y).toBeCloseTo(0.2, 5); // Height
      expect(partBabylonPos.z).toBeCloseTo(0.3, 5); // Depth
    });
  });

  describe('Coordinate system integrity', () => {
    it('should maintain right-handed coordinate system', () => {
      // User space: X (right), Y (forward), Z (up)
      const userX: Vector3 = { x: 1, y: 0, z: 0 };
      const userY: Vector3 = { x: 0, y: 1, z: 0 };
      const userZ: Vector3 = { x: 0, y: 0, z: 1 };

      const babylonX = CoordSystem.userVectorToBabylon(userX);
      const babylonY = CoordSystem.userVectorToBabylon(userY);
      const babylonZ = CoordSystem.userVectorToBabylon(userZ);

      // Check right-handedness: X × Z = Y (in Babylon coords, Y is up, Z is forward)
      // User X (1,0,0) → Babylon X (1,0,0)
      // User Y (0,1,0) → Babylon Z (0,0,1)
      // User Z (0,0,1) → Babylon Y (0,1,0)
      // X × Z = Y in Babylon
      const cross = BABYLON.Vector3.Cross(babylonX, babylonY);

      expect(cross.x).toBeCloseTo(-babylonZ.x, 5);
      expect(cross.y).toBeCloseTo(-babylonZ.y, 5);
      expect(cross.z).toBeCloseTo(-babylonZ.z, 5);
    });

    it('should preserve orthogonality of axes', () => {
      const userX: Vector3 = { x: 1, y: 0, z: 0 };
      const userY: Vector3 = { x: 0, y: 1, z: 0 };
      const userZ: Vector3 = { x: 0, y: 0, z: 1 };

      const babylonX = CoordSystem.userVectorToBabylon(userX);
      const babylonY = CoordSystem.userVectorToBabylon(userY);
      const babylonZ = CoordSystem.userVectorToBabylon(userZ);

      // Check orthogonality: dot product should be 0
      expect(BABYLON.Vector3.Dot(babylonX, babylonY)).toBeCloseTo(0, 5);
      expect(BABYLON.Vector3.Dot(babylonY, babylonZ)).toBeCloseTo(0, 5);
      expect(BABYLON.Vector3.Dot(babylonZ, babylonX)).toBeCloseTo(0, 5);
    });
  });
});
