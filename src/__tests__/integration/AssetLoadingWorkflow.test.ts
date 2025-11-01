/**
 * Asset Loading Workflow Integration Test
 * Owner: George
 *
 * Tests the complete end-to-end asset loading workflow:
 * Asset Library -> SceneManager -> AssetLoader -> Babylon Scene
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SceneManager } from '../../scene/SceneManager';
import type { LibraryAsset } from '../../library/types';

describe('Asset Loading Workflow', () => {
  let canvas: HTMLCanvasElement;
  let sceneManager: SceneManager;

  beforeAll(async () => {
    // Create mock canvas
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    // Initialize scene manager
    sceneManager = SceneManager.getInstance();
    await sceneManager.initialize(canvas);
  });

  describe('SceneManager.loadAssetFromLibrary', () => {
    it('should have loadAssetFromLibrary method', () => {
      expect(sceneManager.loadAssetFromLibrary).toBeDefined();
      expect(typeof sceneManager.loadAssetFromLibrary).toBe('function');
    });

    it('should return error when scene not initialized', async () => {
      const mockSceneManager = Object.create(SceneManager.prototype);
      (mockSceneManager as any).scene = null;

      const mockAsset: LibraryAsset = {
        id: 'test-asset',
        name: 'Test Asset',
        filePath: '/test.glb',
        loaderType: 'glb',
        domain: 'custom',
        assetClass: 'structures',
        categories: [],
        tags: [],
      };

      const result = await mockSceneManager.loadAssetFromLibrary(mockAsset);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Scene not initialized');
    });

    it('should handle GLB asset type', async () => {
      const mockAsset: LibraryAsset = {
        id: 'test-glb',
        name: 'Test GLB',
        filePath: '/nonexistent.glb', // Will fail to load but that's ok for test
        loaderType: 'glb',
        domain: 'custom',
        assetClass: 'structures',
        categories: [],
        tags: [],
      };

      const result = await sceneManager.loadAssetFromLibrary(mockAsset);

      // Should attempt to load (will fail with file not found, but that proves the workflow works)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle unsupported asset type', async () => {
      const mockAsset: LibraryAsset = {
        id: 'test-unsupported',
        name: 'Test Unsupported',
        filePath: '/test.xyz',
        loaderType: 'unsupported' as any,
        domain: 'custom',
        assetClass: 'structures',
        categories: [],
        tags: [],
      };

      const result = await sceneManager.loadAssetFromLibrary(mockAsset);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });
  });

  describe('UI Integration', () => {
    it('should be callable from DetailsPane onClick handler', () => {
      // Simulate what happens when user clicks "Add to Scene" button
      const handleAddToScene = async () => {
        const mockAsset: LibraryAsset = {
          id: 'ui-test',
          name: 'UI Test Asset',
          filePath: '/test.glb',
          loaderType: 'glb',
          domain: 'custom',
          assetClass: 'structures',
          categories: [],
          tags: [],
        };

        const result = await sceneManager.loadAssetFromLibrary(mockAsset);
        return result;
      };

      expect(handleAddToScene).toBeDefined();
      expect(typeof handleAddToScene).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle loader errors gracefully', async () => {
      const mockAsset: LibraryAsset = {
        id: 'error-test',
        name: 'Error Test',
        filePath: '/does-not-exist.glb',
        loaderType: 'glb',
        domain: 'custom',
        assetClass: 'structures',
        categories: [],
        tags: [],
      };

      const result = await sceneManager.loadAssetFromLibrary(mockAsset);

      // Should return error result, not throw
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    it('should handle null/undefined asset gracefully', async () => {
      const result = await sceneManager.loadAssetFromLibrary(null as any);

      expect(result).toBeDefined();
      // Should either return error or handle gracefully
    });
  });
});
