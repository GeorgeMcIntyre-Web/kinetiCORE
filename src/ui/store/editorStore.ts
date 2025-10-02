// Zustand store for editor state
// Owner: Edwin

import { create } from 'zustand';
import * as BABYLON from '@babylonjs/core';
import { TransformMode } from '../../core/types';
import { DEFAULT_TRANSFORM_MODE } from '../../core/constants';
import { SceneManager } from '../../scene/SceneManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { userToBabylon } from '../../core/CoordinateSystem';

type ObjectType = 'box' | 'sphere' | 'cylinder';

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
  createObject: (type: ObjectType) => void;
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

  // Object creation
  createObject: (type) => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    const registry = EntityRegistry.getInstance();
    let mesh: BABYLON.Mesh;

    // Create mesh based on type
    switch (type) {
      case 'box':
        mesh = BABYLON.MeshBuilder.CreateBox(
          `box_${Date.now()}`,
          { size: 2 },
          scene
        );
        break;
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere(
          `sphere_${Date.now()}`,
          { diameter: 2 },
          scene
        );
        break;
      case 'cylinder':
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          `cylinder_${Date.now()}`,
          { height: 2, diameter: 1 },
          scene
        );
        break;
    }

    // Position slightly above ground (user space: 1000mm high = 1m in Z-up)
    // Converts to Babylon space (Y-up, meters)
    mesh.position = userToBabylon({ x: 0, y: 0, z: 1000 });

    // Create material
    const material = new BABYLON.StandardMaterial(`mat_${mesh.name}`, scene);
    material.diffuseColor = new BABYLON.Color3(
      Math.random(),
      Math.random(),
      Math.random()
    );
    mesh.material = material;

    // Create entity with physics
    registry.create({
      mesh,
      physics: {
        enabled: true,
        type: 'dynamic',
        shape: type === 'cylinder' ? 'cylinder' : type === 'sphere' ? 'sphere' : 'box',
        mass: 1.0,
      },
      metadata: {
        name: mesh.name,
        type: type,
      },
    });

    // Select the newly created object
    get().clearSelection();
    get().selectMesh(mesh);
  },
}));
