// Unit tests for type guards
// Owner: George

import { describe, test, expect } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { isQuaternionLike, ensureQuaternion, isVector3Like, ensureVector3 } from './typeGuards';

describe('Quaternion Type Guards', () => {
  test('isQuaternionLike recognizes Quaternion instance', () => {
    const quat = new BABYLON.Quaternion(0, 0, 0.707, 0.707);
    expect(isQuaternionLike(quat)).toBe(true);
  });

  test('isQuaternionLike recognizes serialized quaternion', () => {
    const serialized = { x: 0, y: 0, z: 0.707, w: 0.707 };
    expect(isQuaternionLike(serialized)).toBe(true);
  });

  test('isQuaternionLike recognizes serialized quaternion with underscored properties', () => {
    const serialized = { _x: 0, _y: 0, _z: 0.707, _w: 0.707 };
    expect(isQuaternionLike(serialized)).toBe(true);
  });

  test('isQuaternionLike rejects invalid objects', () => {
    expect(isQuaternionLike(null)).toBe(false);
    expect(isQuaternionLike(undefined)).toBe(false);
    expect(isQuaternionLike({})).toBe(false);
    expect(isQuaternionLike({ x: 0, y: 0 })).toBe(false); // Missing z, w
    expect(isQuaternionLike('not a quaternion')).toBe(false);
  });

  test('ensureQuaternion clones Quaternion instance', () => {
    const original = new BABYLON.Quaternion(0, 0, 0.707, 0.707);
    const result = ensureQuaternion(original);

    expect(result).toBeInstanceOf(BABYLON.Quaternion);
    expect(result.x).toBe(original.x);
    expect(result.y).toBe(original.y);
    expect(result.z).toBe(original.z);
    expect(result.w).toBe(original.w);

    // Ensure it's a clone, not the same reference
    expect(result).not.toBe(original);
  });

  test('ensureQuaternion reconstructs from serialized quaternion', () => {
    const serialized = { x: 0.5, y: 0.5, z: 0.5, w: 0.5 };
    const result = ensureQuaternion(serialized);

    expect(result).toBeInstanceOf(BABYLON.Quaternion);
    expect(result.x).toBe(0.5);
    expect(result.y).toBe(0.5);
    expect(result.z).toBe(0.5);
    expect(result.w).toBe(0.5);
  });

  test('ensureQuaternion handles Zustand JSON serialization round-trip', () => {
    // Simulate Zustand store serialization
    const original = new BABYLON.Quaternion(0, 0, 0.707, 0.707);
    const serialized = JSON.parse(JSON.stringify(original));
    const restored = ensureQuaternion(serialized);

    expect(restored).toBeInstanceOf(BABYLON.Quaternion);
    expect(restored.x).toBeCloseTo(original.x, 5);
    expect(restored.y).toBeCloseTo(original.y, 5);
    expect(restored.z).toBeCloseTo(original.z, 5);
    expect(restored.w).toBeCloseTo(original.w, 5);

    // Verify rotation equivalence
    expect(restored.equals(original)).toBe(true);
  });

  test('ensureQuaternion returns identity for null/undefined', () => {
    const resultNull = ensureQuaternion(null);
    const resultUndefined = ensureQuaternion(undefined);

    expect(resultNull).toBeInstanceOf(BABYLON.Quaternion);
    expect(resultNull.x).toBe(0);
    expect(resultNull.y).toBe(0);
    expect(resultNull.z).toBe(0);
    expect(resultNull.w).toBe(1);

    expect(resultUndefined.equals(BABYLON.Quaternion.Identity())).toBe(true);
  });

  test('ensureQuaternion returns identity for invalid input', () => {
    const result = ensureQuaternion('not a quaternion');

    expect(result).toBeInstanceOf(BABYLON.Quaternion);
    expect(result.equals(BABYLON.Quaternion.Identity())).toBe(true);
  });
});

describe('Vector3 Type Guards', () => {
  test('isVector3Like recognizes Vector3 instance', () => {
    const vec = new BABYLON.Vector3(1, 2, 3);
    expect(isVector3Like(vec)).toBe(true);
  });

  test('isVector3Like recognizes serialized vector', () => {
    const serialized = { x: 1, y: 2, z: 3 };
    expect(isVector3Like(serialized)).toBe(true);
  });

  test('isVector3Like recognizes serialized vector with underscored properties', () => {
    const serialized = { _x: 1, _y: 2, _z: 3 };
    expect(isVector3Like(serialized)).toBe(true);
  });

  test('isVector3Like rejects invalid objects', () => {
    expect(isVector3Like(null)).toBe(false);
    expect(isVector3Like(undefined)).toBe(false);
    expect(isVector3Like({})).toBe(false);
    expect(isVector3Like({ x: 1, y: 2 })).toBe(false); // Missing z
    expect(isVector3Like('not a vector')).toBe(false);
  });

  test('ensureVector3 clones Vector3 instance', () => {
    const original = new BABYLON.Vector3(1, 2, 3);
    const result = ensureVector3(original);

    expect(result).toBeInstanceOf(BABYLON.Vector3);
    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
    expect(result.z).toBe(3);

    // Ensure it's a clone
    expect(result).not.toBe(original);
  });

  test('ensureVector3 reconstructs from serialized vector', () => {
    const serialized = { x: 4, y: 5, z: 6 };
    const result = ensureVector3(serialized);

    expect(result).toBeInstanceOf(BABYLON.Vector3);
    expect(result.x).toBe(4);
    expect(result.y).toBe(5);
    expect(result.z).toBe(6);
  });

  test('ensureVector3 handles JSON serialization round-trip', () => {
    const original = new BABYLON.Vector3(1.5, 2.5, 3.5);
    const serialized = JSON.parse(JSON.stringify(original));
    const restored = ensureVector3(serialized);

    expect(restored).toBeInstanceOf(BABYLON.Vector3);
    expect(restored.x).toBe(original.x);
    expect(restored.y).toBe(original.y);
    expect(restored.z).toBe(original.z);
  });

  test('ensureVector3 returns zero vector for null/undefined', () => {
    const resultNull = ensureVector3(null);
    const resultUndefined = ensureVector3(undefined);

    expect(resultNull).toBeInstanceOf(BABYLON.Vector3);
    expect(resultNull.equals(BABYLON.Vector3.Zero())).toBe(true);
    expect(resultUndefined.equals(BABYLON.Vector3.Zero())).toBe(true);
  });

  test('ensureVector3 returns zero vector for invalid input', () => {
    const result = ensureVector3('not a vector');

    expect(result).toBeInstanceOf(BABYLON.Vector3);
    expect(result.equals(BABYLON.Vector3.Zero())).toBe(true);
  });
});

describe('Snap Tool Rotation Matching (Integration)', () => {
  test('snap preserves rotation after store round-trip', () => {
    // This tests the bug fix from commit e8eb81c
    const sourceRotation = new BABYLON.Quaternion(0, 0, 0.707, 0.707); // 90 deg Z rotation

    // Simulate Zustand store serialization/deserialization
    const serialized = JSON.parse(JSON.stringify(sourceRotation));

    // Reconstruct using our type guard
    const restored = ensureQuaternion(serialized);

    // Verify they represent the same rotation
    expect(restored.equals(sourceRotation)).toBe(true);

    // Verify we can call .invert() without "inverse is not a function" error
    expect(() => {
      const inverted = restored.clone().invert();
      expect(inverted).toBeInstanceOf(BABYLON.Quaternion);
    }).not.toThrow();
  });

  test('quaternion multiplication works after reconstruction', () => {
    const q1 = new BABYLON.Quaternion(0, 0, 0.707, 0.707);
    const q2 = new BABYLON.Quaternion(0.707, 0, 0, 0.707);

    // Serialize and restore
    const q1Restored = ensureQuaternion(JSON.parse(JSON.stringify(q1)));
    const q2Restored = ensureQuaternion(JSON.parse(JSON.stringify(q2)));

    // Test multiplication (used in snap rotation matching)
    const result = q1Restored.multiply(q2Restored);

    expect(result).toBeInstanceOf(BABYLON.Quaternion);
    expect(result.x).toBeCloseTo(0.5, 3); // Reduced precision for quaternion multiplication
    expect(result.y).toBeCloseTo(0.5, 3);
    expect(result.z).toBeCloseTo(0.5, 3);
    expect(result.w).toBeCloseTo(0.5, 3);
  });
});
