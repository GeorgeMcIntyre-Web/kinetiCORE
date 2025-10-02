// Zustand store for editor state
// Owner: Edwin

import { create } from 'zustand';
import * as BABYLON from '@babylonjs/core';
import { TransformMode } from '../../core/types';
import { DEFAULT_TRANSFORM_MODE } from '../../core/constants';

interface EditorState {
  // State
  selectedMeshes: BABYLON.Mesh[];
  transformMode: TransformMode;
  camera: BABYLON.Camera | null;
  isPlaying: boolean;

  // Actions
  selectMesh: (mesh: BABYLON.Mesh) => void;
  deselectMesh: (mesh: BABYLON.Mesh) => void;
  clearSelection: () => void;
  toggleMeshSelection: (mesh: BABYLON.Mesh) => void;
  setTransformMode: (mode: TransformMode) => void;
  setCamera: (camera: BABYLON.Camera) => void;
  togglePlayback: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  selectedMeshes: [],
  transformMode: DEFAULT_TRANSFORM_MODE,
  camera: null,
  isPlaying: false,

  // Selection actions
  selectMesh: (mesh) => {
    const { selectedMeshes } = get();
    if (!selectedMeshes.includes(mesh)) {
      set({ selectedMeshes: [...selectedMeshes, mesh] });
    }
  },

  deselectMesh: (mesh) => {
    set({
      selectedMeshes: get().selectedMeshes.filter((m) => m !== mesh),
    });
  },

  clearSelection: () => {
    set({ selectedMeshes: [] });
  },

  toggleMeshSelection: (mesh) => {
    const { selectedMeshes } = get();
    if (selectedMeshes.includes(mesh)) {
      get().deselectMesh(mesh);
    } else {
      get().selectMesh(mesh);
    }
  },

  // Transform actions
  setTransformMode: (mode) => set({ transformMode: mode }),

  // Camera actions
  setCamera: (camera) => set({ camera }),

  // Playback actions
  togglePlayback: () => set({ isPlaying: !get().isPlaying }),
}));
