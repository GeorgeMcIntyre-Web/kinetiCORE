import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Scene } from '@babylonjs/core';

vi.mock('@babylonjs/serializers/glTF/2.0/glTFExporter', () => {
  return {
    GLTF2Export: {
      GLBAsync: vi.fn(async () => ({
        glTFFiles: {
          'custom.glb': new Blob(['custom']),
          'scene.glb': new Blob(['fallback']),
        },
      })),
    },
  };
});

import { GLTF2Export } from '@babylonjs/serializers/glTF/2.0/glTFExporter';
import { GLBExporter } from '../../../exports/GLBExporter';

const mockedGLBAsync = GLTF2Export.GLBAsync as unknown as ReturnType<typeof vi.fn>;

describe('GLBExporter', () => {
  beforeEach(() => {
    mockedGLBAsync.mockClear();
  });

  it('captures material metadata and environment reference', async () => {
    const fakeScene = {
      materials: [
        {
          name: 'Steel',
          uniqueId: 101,
          getClassName: () => 'StandardMaterial',
          diffuseColor: { r: 0.6, g: 0.6, b: 0.6 },
          alpha: 0.9,
          metadata: { textureUrl: 'steel-albedo.jpg' },
        },
      ],
      environmentTexture: { name: 'studio.env' },
    } as unknown as Scene;

    const result = await GLBExporter.export(fakeScene, { fileName: 'custom', includeEnvironment: true });

    expect(mockedGLBAsync).toHaveBeenCalledWith(fakeScene, 'custom', expect.objectContaining({ shouldExportNode: expect.any(Function) }));
    expect(result.glb).toBeInstanceOf(Blob);
    expect(result.metadata?.version).toBe('1.0.0');
    expect(result.metadata?.materials).toHaveLength(1);
    expect(result.metadata?.materials[0]).toMatchObject({
      name: 'Steel',
      properties: expect.objectContaining({
        diffuseColor: { r: 0.6, g: 0.6, b: 0.6 },
        alpha: 0.9,
        textureUrl: 'steel-albedo.jpg',
      }),
    });
    expect(result.metadata?.environmentTexture).toBe('studio.env');
  });

  it('omits metadata when disabled', async () => {
    const fakeScene = { materials: [], environmentTexture: null } as unknown as Scene;

    const result = await GLBExporter.export(fakeScene, { embedMaterialMetadata: false });

    expect(result.metadata).toBeUndefined();
  });
});
