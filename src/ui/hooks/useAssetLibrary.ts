/**
 * useAssetLibrary Hook
 * Owner: George (integration), Edwin (UI hooks)
 *
 * React hook for managing asset library interactions with the 3D scene
 */

import { useState, useCallback } from 'react';
import { useSceneContext } from '../core/SceneContext';
import { AssetLoader } from '../../library/AssetLoader';
import type { LibraryAsset, AssetInsertionConfig } from '../../library/types';
import { useToast } from '../store/toastStore';

export function useAssetLibrary() {
  const { scene } = useSceneContext();
  const { addToast } = useToast();
  const [isDraggingAsset, setIsDraggingAsset] = useState(false);
  const [draggedAsset, setDraggedAsset] = useState<LibraryAsset | null>(null);

  /**
   * Handle asset selection (double-click to add)
   */
  const handleAssetSelect = useCallback(
    async (asset: LibraryAsset) => {
      if (!scene) {
        addToast({
          id: Date.now().toString(),
          type: 'error',
          message: 'Scene not ready',
        });
        return;
      }

      addToast({
        id: Date.now().toString(),
        type: 'info',
        message: `Loading ${asset.name}...`,
      });

      const loader = new AssetLoader(scene);
      const config: AssetInsertionConfig = {
        placement: 'floor',
        enablePhysics: false,
        loadKinematics: asset.capabilities?.hasKinematics || false,
      };

      try {
        const result = await loader.loadAsset(asset, config);

        if (result.success) {
          addToast({
            id: Date.now().toString(),
            type: 'success',
            message: `Added ${asset.name} to scene`,
          });
        } else {
          addToast({
            id: Date.now().toString(),
            type: 'error',
            message: `Failed to load ${asset.name}: ${result.error}`,
          });
        }
      } catch (error) {
        addToast({
          id: Date.now().toString(),
          type: 'error',
          message: `Error loading ${asset.name}`,
        });
        console.error('Asset loading error:', error);
      }
    },
    [scene, addToast]
  );

  /**
   * Handle drag start
   */
  const handleAssetDragStart = useCallback((asset: LibraryAsset) => {
    setIsDraggingAsset(true);
    setDraggedAsset(asset);
  }, []);

  /**
   * Handle drag end
   */
  const handleAssetDragEnd = useCallback(() => {
    setIsDraggingAsset(false);
    setDraggedAsset(null);
  }, []);

  /**
   * Handle drop on viewport
   */
  const handleAssetDrop = useCallback(
    async (position?: { x: number; y: number; z: number }) => {
      if (!draggedAsset || !scene) return;

      const loader = new AssetLoader(scene);
      const config: AssetInsertionConfig = {
        placement: position ? 'custom' : 'floor',
        position,
        enablePhysics: false,
        loadKinematics: draggedAsset.capabilities?.hasKinematics || false,
      };

      try {
        const result = await loader.loadAsset(draggedAsset, config);

        if (result.success) {
          addToast({
            id: Date.now().toString(),
            type: 'success',
            message: `Added ${draggedAsset.name}`,
          });
        }
      } catch (error) {
        console.error('Drop error:', error);
      } finally {
        handleAssetDragEnd();
      }
    },
    [draggedAsset, scene, addToast, handleAssetDragEnd]
  );

  return {
    isDraggingAsset,
    draggedAsset,
    handleAssetSelect,
    handleAssetDragStart,
    handleAssetDragEnd,
    handleAssetDrop,
  };
}
