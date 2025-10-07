/**
 * Asset Library Store
 * Owner: Edwin (UI stores)
 *
 * Global state for asset library panel visibility
 */

import { create } from 'zustand';

interface AssetLibraryStore {
  isVisible: boolean;
  toggleVisibility: () => void;
  show: () => void;
  hide: () => void;
}

export const useAssetLibraryStore = create<AssetLibraryStore>((set) => ({
  isVisible: false,
  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
  show: () => set({ isVisible: true }),
  hide: () => set({ isVisible: false }),
}));
