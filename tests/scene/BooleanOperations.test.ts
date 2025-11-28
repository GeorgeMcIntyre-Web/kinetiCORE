import { describe, it, expect } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { BooleanOperations } from '../../src/scene/BooleanOperations';

const createTestScene = () => {
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);
  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 0, -5), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  return scene;
};

describe('BooleanOperations', () => {
  it('returns error for invalid meshes', async () => {
    const result = await BooleanOperations.performOperation(
      null as unknown as BABYLON.Mesh,
      null as unknown as BABYLON.Mesh,
      'union'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when scene is missing', async () => {
    const scene = createTestScene();
    const box = BABYLON.MeshBuilder.CreateBox('box', { size: 1 }, scene);

    box.dispose();

    const result = await BooleanOperations.performOperation(
      box,
      box,
      'union',
      undefined
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('performs union on overlapping boxes', async () => {
    const scene = createTestScene();
    const boxA = BABYLON.MeshBuilder.CreateBox('boxA', { size: 1 }, scene);
    const boxB = BABYLON.MeshBuilder.CreateBox('boxB', { size: 1 }, scene);

    boxA.position = new BABYLON.Vector3(-0.25, 0, 0);
    boxB.position = new BABYLON.Vector3(0.25, 0, 0);

    const result = await BooleanOperations.performOperation(boxA, boxB, 'union', scene);

    expect(result.success).toBe(true);
    expect(result.resultMesh).toBeDefined();

    const mesh = result.resultMesh!;
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    const size = bbox.maximum.subtract(bbox.minimum);

    expect(size.x).toBeGreaterThan(1);
  });

  it('performs intersect on overlapping boxes', async () => {
    const scene = createTestScene();
    const boxA = BABYLON.MeshBuilder.CreateBox('boxA', { size: 1 }, scene);
    const boxB = BABYLON.MeshBuilder.CreateBox('boxB', { size: 1 }, scene);

    boxA.position = new BABYLON.Vector3(-0.25, 0, 0);
    boxB.position = new BABYLON.Vector3(0.25, 0, 0);

    const result = await BooleanOperations.performOperation(boxA, boxB, 'intersect', scene);

    expect(result.success).toBe(true);
    expect(result.resultMesh).toBeDefined();

    const mesh = result.resultMesh!;
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    const size = bbox.maximum.subtract(bbox.minimum);

    expect(size.x).toBeLessThan(1);
  });

  it('returns empty result for non-overlapping intersect', async () => {
    const scene = createTestScene();
    const boxA = BABYLON.MeshBuilder.CreateBox('boxA', { size: 1 }, scene);
    const boxB = BABYLON.MeshBuilder.CreateBox('boxB', { size: 1 }, scene);

    boxA.position = new BABYLON.Vector3(-5, 0, 0);
    boxB.position = new BABYLON.Vector3(5, 0, 0);

    const result = await BooleanOperations.performOperation(boxA, boxB, 'intersect', scene);

    expect(result.success).toBe(true);
    expect(result.resultMesh).toBeDefined();

    const mesh = result.resultMesh!;
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    const size = bbox.maximum.subtract(bbox.minimum);

    expect(size.x).toBeLessThan(0.1);
  });
});
