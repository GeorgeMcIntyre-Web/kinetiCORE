/**
 * Asset Library Store
 * Owner: Edwin (UI stores)
 *
 * Global state for asset library panel - Three-pane engineering UI
 */

import { create } from 'zustand';
import type { LibraryAsset, LibraryFilters } from '../../library/types';

interface AssetLibraryStore {
  // Visibility
  isVisible: boolean;
  toggleVisibility: () => void;
  show: () => void;
  hide: () => void;

  // Three-pane state
  selectedAsset: LibraryAsset | null;
  setSelectedAsset: (asset: LibraryAsset | null) => void;

  // Filters
  filters: LibraryFilters;
  setFilter: <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => void;
  resetFilters: () => void;

  // View mode
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;

  // Category expansion (for tree view)
  expandedCategories: Set<string>;
  toggleCategory: (category: string) => void;
}

const defaultFilters: LibraryFilters = {
  searchQuery: '',
  domains: undefined,
  assetClasses: undefined,
  manufacturers: undefined,
  tags: undefined,
  payloadRange: undefined,
  reachRange: undefined,
  dofRange: undefined,
  hasKinematics: undefined,
  sortBy: 'name',
  sortOrder: 'asc',
};

export const useAssetLibraryStore = create<AssetLibraryStore>((set) => ({
  // Visibility
  isVisible: false,
  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
  show: () => set({ isVisible: true }),
  hide: () => set({ isVisible: false }),

  // Three-pane state
  selectedAsset: null,
  setSelectedAsset: (asset) => set({ selectedAsset: asset }),

  // Filters
  filters: defaultFilters,
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  resetFilters: () => set({ filters: defaultFilters }),

  // View mode
  viewMode: 'grid',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Category expansion
  expandedCategories: new Set(['manufacturing']), // Default expanded
  toggleCategory: (category) =>
    set((state) => {
      const newExpanded = new Set(state.expandedCategories);
      if (newExpanded.has(category)) {
        newExpanded.delete(category);
      } else {
        newExpanded.add(category);
      }
      return { expandedCategories: newExpanded };
    }),
}));
