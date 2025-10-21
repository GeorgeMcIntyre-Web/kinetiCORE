/**
 * Project Manager Store
 * Owner: Edwin (UI stores)
 *
 * Global state for project manager panel - Three-pane engineering UI
 */

import { create } from 'zustand';
import type { Project, ProjectFilters, ProjectSave } from '../../project/types';

interface ProjectManagerStore {
  // Visibility
  isVisible: boolean;
  toggleVisibility: () => void;
  show: () => void;
  hide: () => void;

  // Three-pane state
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  selectedSave: ProjectSave | null;
  setSelectedSave: (save: ProjectSave | null) => void;

  // Filters
  filters: ProjectFilters;
  setFilter: <K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K]) => void;
  resetFilters: () => void;

  // View mode
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;

  // Category expansion (for tree view)
  expandedCategories: Set<string>;
  toggleCategory: (category: string) => void;

  // Current project state
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}

const defaultFilters: ProjectFilters = {
  search: undefined,
  status: undefined,
  category: undefined,
  visibility: undefined,
  tags: undefined,
};

export const useProjectManagerStore = create<ProjectManagerStore>((set) => ({
  // Visibility
  isVisible: false,
  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
  show: () => set({ isVisible: true }),
  hide: () => set({ isVisible: false }),

  // Three-pane state
  selectedProject: null,
  setSelectedProject: (project) => set({ selectedProject: project }),
  selectedSave: null,
  setSelectedSave: (save) => set({ selectedSave: save }),

  // Filters
  filters: defaultFilters,
  setFilter: (key, value) => set((state) => ({
    filters: { ...state.filters, [key]: value }
  })),
  resetFilters: () => set({ filters: defaultFilters }),

  // View mode
  viewMode: 'grid',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Category expansion
  expandedCategories: new Set(['simulation', 'layout', 'prototype']),
  toggleCategory: (category) => set((state) => {
    const newExpanded = new Set(state.expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    return { expandedCategories: newExpanded };
  }),

  // Current project state
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),
}));
