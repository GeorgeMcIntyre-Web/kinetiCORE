/**
 * useAssetLibrary Hook
 * Owner: George (integration), Edwin (UI hooks)
 *
 * React hook for managing asset library interactions with the 3D scene
 */

import { useState, useCallback } from 'react';
import { SceneManager } from '../../scene/SceneManager';
import { AssetLoader } from '../../library/AssetLoader';
import type { LibraryAsset, AssetInsertionConfig } from '../../library/types';
import { useToastStore } from '../components/ToastNotifications';
import { SceneManager as SM } from '../../scene/SceneManager';

export function useAssetLibrary() {
  const addToast = useToastStore((state) => state.addToast);
  const scene = SceneManager.getInstance().getScene();
  const [isDraggingAsset, setIsDraggingAsset] = useState(false);
  const [draggedAsset, setDraggedAsset] = useState<LibraryAsset | null>(null);

  /**
   * Handle asset selection (double-click to add)
   */
  const handleAssetSelect = useCallback(
    async (asset: LibraryAsset) => {
      if (!scene) {
        addToast({
          type: 'error',
          message: 'Scene not ready',
        });
        return;
      }

      addToast({
        type: 'info',
        message: `Loading ${asset.name}...`,
      });

      try {
        if (asset.loaderType === 'glb') {
          const sm = SM.getInstance();
          await sm.addModelFromLibrary(asset.filePath);
          addToast({ type: 'success', message: `Loaded ${asset.name}` });
          return;
        }

        const loader = new AssetLoader(scene);
        const config: AssetInsertionConfig = {
          placement: 'floor',
          enablePhysics: false,
          loadKinematics: asset.capabilities?.hasKinematics || false,
        };
        const result = await loader.loadAsset(asset, config);

        if (result.success) {
          addToast({
            type: 'success',
            message: `Added ${asset.name} to scene`,
          });
        } else {
          addToast({
            type: 'error',
            message: `Failed to load ${asset.name}: ${result.error}`,
          });
        }
      } catch (error) {
        addToast({
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
