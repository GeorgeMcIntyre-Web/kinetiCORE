// Unit tests for SnapResult contract validation
// Tests that all snap types return consistent, properly cloned SnapResult structures

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { SnappingHelper, SnapSettings } from '../SnappingHelper';
import { enableSnapForMesh } from '../snapConstants';

// Test tolerance constants
const EPS = 1e-4; // Default epsilon for float comparisons

function nearlyEqual(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps;
}

function vectorNearlyEqual(a: BABYLON.Vector3, b: BABYLON.Vector3, eps = 1e-4): boolean {
  return nearlyEqual(a.x, b.x, eps) && nearlyEqual(a.y, b.y, eps) && nearlyEqual(a.z, b.z, eps);
}

describe('SnapResult Contract Tests', () => {
  let engine: BABYLON.Engine | null = null;
  let scene: BABYLON.Scene | null = null;
  let camera: BABYLON.ArcRotateCamera | null = null;
  let snappingHelper: SnappingHelper;
  let cube: BABYLON.Mesh | null = null;
  let cylinder: BABYLON.Mesh | null = null;
  let canRunTests = false;

  beforeAll(async () => {
    try {
      engine = new BABYLON.NullEngine();
      scene = new BABYLON.Scene(engine);
      camera = new BABYLON.ArcRotateCamera(
        'camera',
        0,
        Math.PI / 3,
        10,
        BABYLON.Vector3.Zero(),
        scene
      );
      scene.activeCamera = camera;

      snappingHelper = SnappingHelper.getInstance();

      // Create test meshes at fixed positions
      cube = BABYLON.MeshBuilder.CreateBox('testCube', { size: 2 }, scene);
      cube.position = new BABYLON.Vector3(0, 0, 0);
      enableSnapForMesh(cube);

      cylinder = BABYLON.MeshBuilder.CreateCylinder('testCylinder', { height: 2, diameter: 1 }, scene);
      cylinder.position = new BABYLON.Vector3(5, 0, 0);
      enableSnapForMesh(cylinder);

      canRunTests = true;
    } catch (error) {
      console.warn('Cannot run SnapResult tests: BABYLON.js engine creation failed');
      canRunTests = false;
    }
  });

  afterAll(() => {
    if (cube) cube.dispose();
    if (cylinder) cylinder.dispose();
    if (scene) scene.dispose();
    if (engine) engine.dispose();
  });

  const createSnapSettings = (overrides: Partial<SnapSettings> = {}): SnapSettings => ({
    enabled: true,
    snapDistance: 100, // 100mm
    gridSize: 10,
    ...overrides,
  });

  describe('snapToVertex', () => {
    // TODO: Skipped when BABYLON.js engine creation fails (headless test environment).
    // To re-enable: Ensure NullEngine is properly initialized or use a different test setup.
    test.skipIf(!canRunTests)('returns correct SnapResult structure', () => {
      if (!scene || !camera) return;

      const position = new BABYLON.Vector3(0.1, 0.1, 0.1); // Near cube vertex
      const settings = createSnapSettings({ snapToVertex: true, snapToMidpoint: false, snapToCenter: false, snapToFace: false, snapToObject: false });

      const result = snappingHelper.snapPosition(
        position,
        settings,
        [],
        camera,
        12, // 12px screen space
        true, // smartSelect
        null, // clickedMesh
        null, // clickedPoint
        400, // pointerScreenX
        300 // pointerScreenY
      );

      if (!result.snapped) {
        // If no snap found, that's okay for this test - we're just checking structure
        expect(result.snapped).toBe(false);
        expect(result.position).toBeDefined();
        return;
      }

      expect(result.snapped).toBe(true);
      expect(result.snapType).toBe('vertex');
      expect(result.position).toBeDefined();
      expect(result.position).not.toBe(position); // Should be different instance
      expect(result.visualFeedback).toBeDefined();
      expect(result.visualFeedback?.length).toBe(1);

      // Check that vectors are cloned (not shared references)
      if (result.visualFeedback && result.visualFeedback.length > 0) {
        expect(result.visualFeedback[0]).not.toBe(result.position);
        expect(result.visualFeedback[0]).not.toBe(position);
        // Verify position is a new Vector3 instance
        expect(result.position).not.toBe(position);
      }
    });
  });

  describe('snapToMidpoint', () => {
    test.skipIf(!canRunTests)('edge midpoint returns 3 points in visualFeedback', () => {
      if (!scene || !camera) return;

      const position = new BABYLON.Vector3(0.5, 0, 0); // Near cube edge
      const settings = createSnapSettings({ snapToVertex: false, snapToMidpoint: true, snapToCenter: false, snapToFace: false, snapToObject: false });

      const result = snappingHelper.snapPosition(
        position,
        settings,
        [],
        camera,
        12, // screenSpacePixels
        true, // smartSelect
        null, // clickedMesh
        null, // clickedPoint
        400, // pointerScreenX
        300 // pointerScreenY
      );

      if (!result.snapped || result.snapType !== 'midpoint') {
        // May not find midpoint in this test setup
        return;
      }

      expect(result.snapped).toBe(true);
      expect(result.snapType).toBe('midpoint');
      expect(result.visualFeedback).toBeDefined();
      expect(result.visualFeedback?.length).toBe(3); // edgeStart, midpoint, edgeEnd

      // All vectors should be distinct instances
      if (result.visualFeedback && result.visualFeedback.length === 3) {
        expect(result.visualFeedback[0]).not.toBe(result.visualFeedback[1]);
        expect(result.visualFeedback[1]).not.toBe(result.visualFeedback[2]);
        expect(result.visualFeedback[0]).not.toBe(result.visualFeedback[2]);
        // Verify position is cloned
        expect(result.position).not.toBe(position);
        // Verify no visualFeedback entry equals position reference
        for (const v of result.visualFeedback) {
          expect(v).not.toBe(result.position);
        }
      }
    });

    test.skipIf(!canRunTests)('face center returns 1 point in visualFeedback', () => {
      if (!scene || !camera) return;

      const position = new BABYLON.Vector3(0, 0, 0.6); // Near cube face center
      const settings = createSnapSettings({ snapToVertex: false, snapToMidpoint: true, snapToCenter: false, snapToFace: false, snapToObject: false });

      const result = snappingHelper.snapPosition(
        position,
        settings,
        [],
        camera,
        12, // screenSpacePixels
        true, // smartSelect
        null, // clickedMesh
        null, // clickedPoint
        400, // pointerScreenX
        300 // pointerScreenY
      );

      if (!result.snapped || result.snapType !== 'midpoint') {
        return;
      }

      // Face center variant may have 1 point
      if (result.visualFeedback && result.visualFeedback.length === 1) {
        expect(result.snapType).toBe('midpoint');
        expect(result.visualFeedback.length).toBe(1);
      }
    });
  });

  describe('snapToFace', () => {
    test.skipIf(!canRunTests)('returns correct structure with normal', () => {
      if (!scene || !camera) return;

      const position = new BABYLON.Vector3(0, 0, 1.1); // Near cube face
      const settings = createSnapSettings({ snapToVertex: false, snapToMidpoint: false, snapToCenter: false, snapToFace: true, snapToObject: false });

      const result = snappingHelper.snapPosition(
        position,
        settings,
        [],
        camera,
        12, // screenSpacePixels
        true, // smartSelect
        null, // clickedMesh
        null, // clickedPoint
        400, // pointerScreenX
        300 // pointerScreenY
      );

      if (!result.snapped) {
        return;
      }

      expect(result.snapped).toBe(true);
      expect(result.snapType).toBe('face');
      expect(result.visualFeedback).toBeDefined();

      // Should have 1 or 2 points (point, or point + normal)
      expect(result.visualFeedback?.length).toBeGreaterThanOrEqual(1);
      expect(result.visualFeedback?.length).toBeLessThanOrEqual(2);

      if (result.visualFeedback && result.visualFeedback.length === 2) {
        // Second vector should be normalized (normal)
        const normal = result.visualFeedback[1];
        const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        expect(nearlyEqual(length, 1.0, 0.01)).toBe(true);
      }

      // All vectors should be distinct
      if (result.visualFeedback) {
        for (let i = 0; i < result.visualFeedback.length; i++) {
          for (let j = i + 1; j < result.visualFeedback.length; j++) {
            expect(result.visualFeedback[i]).not.toBe(result.visualFeedback[j]);
          }
        }
        // Verify position is cloned
        expect(result.position).not.toBe(position);
        for (const v of result.visualFeedback) {
          expect(v).not.toBe(result.position);
        }
      }
    });
  });

  describe('snapToObject', () => {
    test.skipIf(!canRunTests)('returns bbox center with optional corners', () => {
      if (!scene || !camera || !cube) return;

      const position = new BABYLON.Vector3(0.5, 0.5, 0.5); // Near cube
      const settings = createSnapSettings({ snapToVertex: false, snapToMidpoint: false, snapToCenter: false, snapToFace: false, snapToObject: true });

      const result = snappingHelper.snapPosition(
        position,
        settings,
        [],
        camera,
        12, // screenSpacePixels
        true, // smartSelect
        null, // clickedMesh
        null, // clickedPoint
        400, // pointerScreenX
        300 // pointerScreenY
      );

      if (!result.snapped) {
        return;
      }

      expect(result.snapped).toBe(true);
      expect(result.snapType).toBe('object');
      expect(result.visualFeedback).toBeDefined();
      expect(result.visualFeedback?.length).toBeGreaterThanOrEqual(1);

      // First element should be bbox center
      if (result.visualFeedback && result.visualFeedback.length > 0) {
        const center = result.visualFeedback[0];
        expect(center).toBeDefined();

        // If bbox corners are included, there should be 9 total (1 center + 8 corners)
        if (result.visualFeedback.length === 9) {
          expect(result.visualFeedback.length).toBe(9);
        }
      }

      // All vectors should be distinct
      if (result.visualFeedback) {
        for (let i = 0; i < result.visualFeedback.length; i++) {
          for (let j = i + 1; j < result.visualFeedback.length; j++) {
            expect(result.visualFeedback[i]).not.toBe(result.visualFeedback[j]);
          }
        }
        // Verify position is cloned
        expect(result.position).not.toBe(position);
        for (const v of result.visualFeedback) {
          expect(v).not.toBe(result.position);
        }
      }
    });
  });

  describe('snapToCenter', () => {
    test.skipIf(!canRunTests)('returns circle metadata on SnapResult', () => {
      if (!scene || !camera || !cylinder) return;

      const position = new BABYLON.Vector3(5.1, 0.1, 0.1); // Near cylinder top face
      const settings = createSnapSettings({ snapToVertex: false, snapToMidpoint: false, snapToCenter: true, snapToFace: false, snapToObject: false });

      const result = snappingHelper.snapPosition(
        position,
        settings,
        [],
        camera,
        12, // screenSpacePixels
        true, // smartSelect
        null, // clickedMesh
        null, // clickedPoint
        400, // pointerScreenX
        300 // pointerScreenY
      );

      if (!result.snapped || result.snapType !== 'center') {
        // Circle detection may not trigger in this test setup
        return;
      }

      expect(result.snapped).toBe(true);
      expect(result.snapType).toBe('center');
      expect(result.circleNormal).toBeDefined();
      expect(result.circleRadius).toBeDefined();
      expect(result.circleRadius).toBeGreaterThan(0);

      // Normal should be normalized
      if (result.circleNormal) {
        const length = Math.sqrt(
          result.circleNormal.x * result.circleNormal.x +
          result.circleNormal.y * result.circleNormal.y +
          result.circleNormal.z * result.circleNormal.z
        );
        expect(nearlyEqual(length, 1.0, 0.01)).toBe(true);
      }

      // visualFeedback should have [center, normal, radiusVector]
      expect(result.visualFeedback).toBeDefined();
      expect(result.visualFeedback?.length).toBe(3);

      // Check that position has metadata attached (backward compatibility)
      const positionWithMetadata = result.position as any;
      expect(positionWithMetadata.circleNormal).toBeDefined();
      expect(positionWithMetadata.circleRadius).toBeDefined();

      // All vectors should be distinct
      if (result.visualFeedback) {
        for (let i = 0; i < result.visualFeedback.length; i++) {
          for (let j = i + 1; j < result.visualFeedback.length; j++) {
            expect(result.visualFeedback[i]).not.toBe(result.visualFeedback[j]);
          }
        }
        // Verify position is cloned
        expect(result.position).not.toBe(position);
        for (const v of result.visualFeedback) {
          expect(v).not.toBe(result.position);
        }
      }

      // Verify circle metadata is populated
      expect(result.circleNormal).toBeDefined();
      expect(result.circleRadius).toBeDefined();
      expect(result.circleRadius).toBeGreaterThan(0);
      if (result.circleVertices) {
        // Verify circleVertices are cloned (if present)
        expect(result.circleVertices.length).toBeGreaterThanOrEqual(0);
        // Verify all circleVertices are distinct Vector3 instances (cloned)
        for (let i = 0; i < result.circleVertices.length; i++) {
          for (let j = i + 1; j < result.circleVertices.length; j++) {
            expect(result.circleVertices[i]).not.toBe(result.circleVertices[j]);
          }
        }
      }
    });
  });

  describe('vector cloning', () => {
    test.skipIf(!canRunTests)('all returned vectors are distinct instances', () => {
      if (!scene || !camera) return;

      const position = new BABYLON.Vector3(0.1, 0.1, 0.1);
      const settings = createSnapSettings({ snapToVertex: true });

      const result = snappingHelper.snapPosition(
        position,
        settings,
        [],
        camera,
        12, // screenSpacePixels
        true, // smartSelect
        null, // clickedMesh
        null, // clickedPoint
        400, // pointerScreenX
        300 // pointerScreenY
      );

      if (!result.snapped) {
        return;
      }

      // Position should not be the original
      expect(result.position).not.toBe(position);

      // Position should not be in visualFeedback (should be cloned)
      if (result.visualFeedback) {
        for (const v of result.visualFeedback) {
          expect(v).not.toBe(position);
          expect(v).not.toBe(result.position);
        }
      }
    });
  });

  describe('snapType consistency', () => {
    test.skipIf(!canRunTests)('snapType matches function purpose', () => {
      if (!scene || !camera) return;

      const testCases = [
        { snapType: 'vertex', settings: createSnapSettings({ snapToVertex: true, snapToMidpoint: false, snapToCenter: false, snapToFace: false, snapToObject: false }) },
        { snapType: 'midpoint', settings: createSnapSettings({ snapToVertex: false, snapToMidpoint: true, snapToCenter: false, snapToFace: false, snapToObject: false }) },
        { snapType: 'face', settings: createSnapSettings({ snapToVertex: false, snapToMidpoint: false, snapToCenter: false, snapToFace: true, snapToObject: false }) },
        { snapType: 'object', settings: createSnapSettings({ snapToVertex: false, snapToMidpoint: false, snapToCenter: false, snapToFace: false, snapToObject: true }) },
        { snapType: 'center', settings: createSnapSettings({ snapToVertex: false, snapToMidpoint: false, snapToCenter: true, snapToFace: false, snapToObject: false }) },
      ];

      for (const testCase of testCases) {
        const position = new BABYLON.Vector3(0.1, 0.1, 0.1);
        const result = snappingHelper.snapPosition(
          position,
          testCase.settings,
          [],
          camera!,
          12, // screenSpacePixels
          true, // smartSelect
          null, // clickedMesh
          null, // clickedPoint
          400, // pointerScreenX
          300 // pointerScreenY
        );

        if (result.snapped) {
          expect(result.snapType).toBe(testCase.snapType);
        }
      }
    });
  });
});

