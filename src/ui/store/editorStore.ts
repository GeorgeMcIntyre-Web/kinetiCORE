// Zustand store for editor state
// Owner: Edwin

import { create } from 'zustand';
import * as BABYLON from '@babylonjs/core';
import { TransformMode, CustomFrameFeature, CustomFrameFeatureType } from '../../core/types';
import { DEFAULT_TRANSFORM_MODE } from '../../core/constants';
import { SceneManager } from '../../scene/SceneManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { userToBabylon, babylonToUser } from '../../core/CoordinateSystem';
import { loadModelFromFile, getAllChildren } from '../../scene/ModelLoader';
import { createKinematicsFromURDF } from '../../loaders/urdf/URDFJointExtractor';
import {
  saveWorldToFile,
  loadWorldFromFile,
  restoreWorldState,
  saveBabylonWorldToFile,
  loadBabylonWorldFromFile,
  restoreBabylonWorld,
  saveComprehensiveWorldToFile,
  loadComprehensiveWorldFromFile,
  restoreComprehensiveWorld
} from '../../scene/WorldSerializer';
import { CustomFrameHelper } from '../../scene/CustomFrameHelper';
import { CoordinateFrameWidget } from '../../scene/CoordinateFrameWidget';
import type { NodeType } from '../../scene/SceneTreeNode';
import { toast } from '../components/ToastNotifications';
import { loading } from '../components/LoadingIndicator';
import { CommandManager } from '../../history/CommandManager';
import { DeleteObjectCommand } from '../../history/commands/DeleteObjectCommand';
import { DuplicateObjectCommand } from '../../history/commands/DuplicateObjectCommand';
import { ProjectManager } from '../../project/ProjectManager';
import { ProjectWorldLoader } from '../../project/ProjectWorldLoader';
import type { Project, ProjectSave, AssetInstance } from '../../project/types';

type ObjectType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane' | 'ground' | 'capsule' | 'disc' | 'torusknot' | 'polyhedron';

interface EditorState {
  // State
  selectedMeshes: BABYLON.Mesh[];
  selectedNodeId: string | null;
  selectedNodeIds: string[]; // Multi-selection support
  selectedCollectionNodeId: string | null; // For collection node selection
  selectedCollectionTransformNode: BABYLON.TransformNode | null; // Babylon TransformNode for collection
  transformMode: TransformMode;
  camera: BABYLON.Camera | null;
  isPlaying: boolean;
  customFrameSelectionMode: 'none' | CustomFrameFeatureType;
  customFrame: CustomFrameFeature | null;
  coordinateFrameWidget: CoordinateFrameWidget | null;
  commandManager: CommandManager;
  panelLayout: any | null; // Dockview panel layout state
  
  // Project Manager Integration
  projectManager: ProjectManager;
  worldLoader: ProjectWorldLoader;
  currentProject: Project | null;
  assetInstances: AssetInstance[];

  // UI state - which toolbar popup is currently open (only one at a time)
  openToolbarPopup: 'transform-settings' | 'snap-geometric' | 'snap-object' | 'snap-auxiliary' | null;
  setOpenToolbarPopup: (popup: 'transform-settings' | 'snap-geometric' | 'snap-object' | 'snap-auxiliary' | null) => void;
  
  // Camera view state
  currentView: 'front' | 'right' | 'top' | 'iso';
  setCurrentView: (view: 'front' | 'right' | 'top' | 'iso') => void;

  // Project Management Methods
  createProject: (config: {
    name: string;
    description?: string;
    category: 'simulation' | 'layout' | 'prototype' | 'production' | 'training' | 'research';
    visibility: 'private' | 'team' | 'public';
    tags?: string[];
  }) => Promise<Project>;
  loadProject: (projectId: string) => Promise<void>;
  saveProject: (config: {
    name: string;
    description?: string;
    isAutoSave?: boolean;
    includeComments?: boolean;
    includeAnnotations?: boolean;
  }) => Promise<ProjectSave>;
  loadProjectSave: (projectId: string, saveId: string) => Promise<void>;
  exportCurrentWorldToProject: (projectId: string, saveName: string) => Promise<ProjectSave>;
  
  // File system state - track last used directory for better UX
  lastUsedDirectory: string | null;
  setLastUsedDirectory: (directory: string | null) => void;

  // Transform settings
  positionIncrement: number; // mm
  rotationIncrement: number; // degrees
  snapEnabled: boolean;
  snapToGrid: boolean;
  snapToVertex: boolean;
  snapToEdge: boolean;
  snapToFace: boolean;
  snapToCenter: boolean;
  snapToObject: boolean;
  snapToMidpoint: boolean;
  snapToIntersection: boolean;
  snapToPerpendicular: boolean;
  snapToTangent: boolean;
  snapAlong: boolean;
  snapToNormal: boolean;
  snapToPlane: boolean;
  snapToAxis: boolean;
  snapToCurve: boolean;
  snapToSurface: boolean;
  snapObjectToVertex: boolean;
  snapPointOnEdge: boolean;
  snapBBoxCorner: boolean;
  gridSize: number; // mm
  snapDistance: number; // mm - how close to snap
  temporaryOrigin: { x: number; y: number; z: number } | null;

  // Button Management System
  buttonStates: {
    [buttonId: string]: any;
  };
  buttonActions: {
    [buttonId: string]: (value: any) => void;
  };

  // Align tool state
  alignMode: 'vertex' | 'edge' | 'face' | 'center' | null;
  alignFirstPoint: {
    mesh: BABYLON.Mesh;
    position: BABYLON.Vector3;
    vertexIndex?: number;
    frame?: { xAxis: BABYLON.Vector3; yAxis: BABYLON.Vector3; zAxis: BABYLON.Vector3 };
  } | null;
  alignMarkers: BABYLON.Mesh[];
  alignFrameWidgets: CoordinateFrameWidget[];

  // Actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  selectMesh: (mesh: BABYLON.Mesh) => void;
  selectNode: (nodeId: string) => void;
  addToSelection: (nodeId: string) => void; // Add node to multi-selection
  removeFromSelection: (nodeId: string) => void; // Remove from multi-selection
  toggleNodeSelection: (nodeId: string) => void; // Toggle node in multi-selection
  zoomToNode: (nodeId: string) => void;
  zoomFit: () => void; // Zoom to fit all visible objects
  deselectMesh: (mesh: BABYLON.Mesh) => void;
  clearSelection: () => void;
  toggleMeshSelection: (mesh: BABYLON.Mesh) => void;
  togglePhysics: (nodeId: string) => void;
  createCollection: (name?: string) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  renameNode: (nodeId: string, newName: string) => void;
  moveNode: (nodeId: string, newParentId: string | null) => void;
  saveWorld: () => void;
  loadWorld: (file: File) => Promise<void>;
  saveBabylonWorld: () => void;
  loadBabylonWorld: (file: File) => Promise<void>;
  saveComprehensiveWorld: () => Promise<void>;
  loadComprehensiveWorld: (file: File) => Promise<void>;
  clearWorld: () => void;
  setTransformMode: (mode: TransformMode) => void;
  setCamera: (camera: BABYLON.Camera) => void;
  togglePlayback: () => void;
  createObject: (type: ObjectType) => void;
  importModel: (file: File, meshFiles?: File[], fileHandle?: any) => Promise<void>;
  importURDFFolder: (files: File[]) => Promise<void>;
  updateNodePosition: (nodeId: string, position: { x: number; y: number; z: number }) => void;
  updateNodeRotation: (nodeId: string, rotation: { x: number; y: number; z: number }) => void;
  updateNodeScale: (nodeId: string, scale: { x: number; y: number; z: number }) => void;
  setCustomFrameSelectionMode: (mode: 'none' | CustomFrameFeatureType) => void;
  setCustomFrame: (frame: CustomFrameFeature | null) => void;
  handleSceneClickForCustomFrame: (pickInfo: BABYLON.PickingInfo) => void;
  initializeCoordinateFrameWidget: () => void;
  savePanelLayout: (layout: any) => void;
  loadPanelLayout: () => any | null;

  // Transform settings actions
  setPositionIncrement: (value: number) => void;
  setRotationIncrement: (value: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setSnapToVertex: (enabled: boolean) => void;
  setSnapToEdge: (enabled: boolean) => void;
  setSnapToFace: (enabled: boolean) => void;
  setSnapToCenter: (enabled: boolean) => void;
  setSnapToObject: (enabled: boolean) => void;
  setSnapToMidpoint: (enabled: boolean) => void;
  setSnapToIntersection: (enabled: boolean) => void;
  setSnapToPerpendicular: (enabled: boolean) => void;
  setSnapToTangent: (enabled: boolean) => void;
  setSnapAlong: (enabled: boolean) => void;
  setSnapToNormal: (enabled: boolean) => void;
  setSnapToPlane: (enabled: boolean) => void;
  setSnapToAxis: (enabled: boolean) => void;
  setSnapToCurve: (enabled: boolean) => void;
  setSnapToSurface: (enabled: boolean) => void;
  setSnapObjectToVertex: (enabled: boolean) => void;
  setSnapPointOnEdge: (enabled: boolean) => void;
  setSnapBBoxCorner: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setSnapDistance: (distance: number) => void;
  setTemporaryOrigin: (origin: { x: number; y: number; z: number } | null) => void;
  clearTemporaryOrigin: () => void;

  // Button Management System
  setButtonState: (buttonId: string, value: any) => void;
  getButtonState: (buttonId: string) => any;
  registerButtonAction: (buttonId: string, action: (value: any) => void) => void;
  executeButtonAction: (buttonId: string, value?: any) => void;
  
  // Backend Communication
  syncButtonState: (buttonId: string) => Promise<void>;
  syncAllButtonStates: () => Promise<void>;
  buttonService: any; // ButtonService instance

  // Align tool actions
  setAlignMode: (mode: 'vertex' | 'edge' | 'face' | 'center' | null) => void;
  setAlignFirstPoint: (point: {
    mesh: BABYLON.Mesh;
    position: BABYLON.Vector3;
    vertexIndex?: number;
    frame?: { xAxis: BABYLON.Vector3; yAxis: BABYLON.Vector3; zAxis: BABYLON.Vector3 };
  } | null) => void;
  handleAlignClick: (pickInfo: BABYLON.PickingInfo) => void;
  cancelAlignment: () => void;

  // URDF loading helper
  loadURDFWithMeshes: (urdfFile: File, meshFiles: File[], scene: BABYLON.Scene, tree: any, assetsNode: any, registry: any) => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  selectedMeshes: [],
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedCollectionNodeId: null,
  selectedCollectionTransformNode: null,
  transformMode: DEFAULT_TRANSFORM_MODE,
  camera: null,
  isPlaying: false,
  customFrameSelectionMode: 'none',
  customFrame: null,
  coordinateFrameWidget: null,
  commandManager: new CommandManager(),
  panelLayout: null,

  // Project Manager Integration
  projectManager: ProjectManager.getInstance(),
  worldLoader: ProjectWorldLoader.getInstance(),
  currentProject: null,
  assetInstances: [],

  // UI state defaults
  openToolbarPopup: null,
  setOpenToolbarPopup: (popup) => set({ openToolbarPopup: popup }),
  
  // Camera view state defaults
  currentView: 'front',
  setCurrentView: (view) => set({ currentView: view }),
  
  // File system state defaults
  lastUsedDirectory: null,
  setLastUsedDirectory: (directory) => set({ lastUsedDirectory: directory }),

  // Transform settings defaults
  positionIncrement: 10, // 10mm default
  rotationIncrement: 15, // 15 degrees default
  snapEnabled: false,
  snapToGrid: false,
  snapToVertex: false,
  snapToEdge: false,
  snapToFace: false,
  snapToCenter: false,
  snapToObject: false,
  snapToMidpoint: false,
  snapToIntersection: false,
  snapToPerpendicular: false,
  snapToTangent: false,
  snapAlong: false,
  snapToNormal: false,
  snapToPlane: false,
  snapToAxis: false,
  snapToCurve: false,
  snapToSurface: false,
  snapObjectToVertex: false,
  snapPointOnEdge: false,
  snapBBoxCorner: false,
  gridSize: 100, // 100mm grid
  snapDistance: 10, // 10mm snap threshold
  temporaryOrigin: null,

  // Button Management System defaults
  buttonStates: {},
  buttonActions: {},
  buttonService: null, // Will be initialized when needed

  // Align tool defaults
  alignMode: null,
  alignFirstPoint: null,
  alignMarkers: [],
  alignFrameWidgets: [],

  // Undo/Redo actions
  undo: () => {
    const { commandManager } = get();
    if (commandManager.undo()) {
      toast.info('Undo successful');
    }
  },

  redo: () => {
    const { commandManager } = get();
    if (commandManager.redo()) {
      toast.info('Redo successful');
    }
  },

  canUndo: () => {
    return get().commandManager.canUndo();
  },

  canRedo: () => {
    return get().commandManager.canRedo();
  },

  // Selection actions
  selectMesh: (mesh) => {
    const { selectedMeshes } = get();
    if (!selectedMeshes.includes(mesh)) {
      set({ selectedMeshes: [...selectedMeshes, mesh] });

      // Check if this is a device root mesh (ending in _device_root)
      if (mesh.name.endsWith('_device_root')) {
        // For device root meshes, find and select the parent collection node instead
        const tree = SceneTreeManager.getInstance();
        const meshNode = tree.getNodeByBabylonMeshId(mesh.uniqueId.toString());
        
        if (meshNode && meshNode.parentId) {
          const parentNode = tree.getNode(meshNode.parentId);
          if (parentNode && parentNode.type === 'collection') {
            // Select the parent collection node instead of the device root mesh
            set({ selectedNodeId: parentNode.id });
            return; // Exit early, don't select the mesh node
          }
        }
      }

      // For all other meshes, select corresponding node in tree
      const tree = SceneTreeManager.getInstance();
      const node = tree.getNodeByBabylonMeshId(mesh.uniqueId.toString());
      if (node) {
        set({ selectedNodeId: node.id });
        // Expand tree to reveal the selected node
        tree.expandToNode(node.id);
        window.dispatchEvent(new Event('scenetree-update'));
      }
    }
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId, selectedNodeIds: [nodeId] });

    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const { coordinateFrameWidget } = get();

    // Check if this is a device root mesh node (ending in _device_root)
    if (node && node.name.endsWith('_device_root') && node.type === 'mesh') {
      // Redirect to parent collection node instead
      if (node.parentId) {
        const parentNode = tree.getNode(node.parentId);
        if (parentNode && parentNode.type === 'collection') {
          // Recursively call selectNode with the parent collection ID
          get().selectNode(parentNode.id);
          return; // Exit early
        }
      }
    }

    // If it's a collection/TransformNode, show coordinate frame at its origin
    if (node && node.type === 'collection' && scene) {
      let transformNode: BABYLON.TransformNode | undefined;
      
      // Use uniqueId lookup first for reliability, fallback to name lookup
      if (node.babylonTransformNodeId) {
        const uniqueId = parseInt(node.babylonTransformNodeId, 10);
        const foundNode = scene.getTransformNodeByUniqueId(uniqueId);
        transformNode = foundNode ? foundNode : undefined;
      } else {
        // Fallback to name lookup (legacy support for nodes without unique ID)
        transformNode = scene.transformNodes.find(tn => tn.name === node.name);
      }
      
      if (transformNode) {
        // For collection nodes, we need to trigger gizmo activation
        // by setting a special flag that SceneCanvas can detect
        // Clear any existing mesh selection to avoid conflicts
        set({ 
          selectedMeshes: [], // Clear mesh selection
          selectedCollectionNodeId: nodeId,
          selectedCollectionTransformNode: transformNode 
        });

      }
    } else {
      // Hide coordinate frame widget if not a collection
      if (coordinateFrameWidget && !get().customFrame) {
        coordinateFrameWidget.hide();
      }
    }
  },

  addToSelection: (nodeId: string) => {
    const { selectedNodeIds } = get();
    if (!selectedNodeIds.includes(nodeId)) {
      const newSelection = [...selectedNodeIds, nodeId];
      set({
        selectedNodeIds: newSelection,
        selectedNodeId: newSelection[newSelection.length - 1] // Last selected is primary
      });
    }
  },

  removeFromSelection: (nodeId: string) => {
    const { selectedNodeIds } = get();
    const newSelection = selectedNodeIds.filter(id => id !== nodeId);
    set({
      selectedNodeIds: newSelection,
      selectedNodeId: newSelection.length > 0 ? newSelection[newSelection.length - 1] : null
    });
  },

  toggleNodeSelection: (nodeId: string) => {
    const { selectedNodeIds } = get();
    if (selectedNodeIds.includes(nodeId)) {
      get().removeFromSelection(nodeId);
    } else {
      get().addToSelection(nodeId);
    }
  },

  zoomToNode: (nodeId) => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node) return;

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // If it's a mesh node, zoom to the specific mesh
    if (node.type === 'mesh' && node.babylonMeshId) {
      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
      if (mesh) {
        sceneManager.zoomToMesh(mesh);
      }
    }
    // If it's a collection/TransformNode, find by unique ID and zoom to all children
    else if (node.type === 'collection') {
      // Use unique ID instead of name lookup for reliability
      if (node.babylonTransformNodeId) {
        const transformNode = scene.getTransformNodeByUniqueId(
          parseInt(node.babylonTransformNodeId, 10)
        );
        if (transformNode) {
          sceneManager.zoomToNode(transformNode);
        }
      } else {
        // Fallback to name lookup (legacy support for nodes without unique ID)
        const transformNode = scene.transformNodes.find(tn => tn.name === node.name);
        if (transformNode) {
          sceneManager.zoomToNode(transformNode);
        }
      }
    }
    // Handle mesh/entity selection for non-collection nodes
    else {
      // Check if this node has an entity ID (device or link entity)
      if (node && node.entityId) {
        const registry = EntityRegistry.getInstance();
        const entity = registry.get(node.entityId);

        if (entity) {
          // If it's a device entity, select the device mesh (triggers device highlighting)
          if (entity.getIsDevice()) {
            set({ 
              selectedMeshes: [entity.getMesh()],
              selectedCollectionNodeId: null, // Clear collection selection
              selectedCollectionTransformNode: null
            });
          } else {
            // Check if this entity is a child of a device (it's a link)
            // For links, select the link mesh directly
            set({ 
              selectedMeshes: [entity.getMesh()],
              selectedCollectionNodeId: null, // Clear collection selection
              selectedCollectionTransformNode: null
            });
          }
        }
      }
      // If it's a mesh node with babylonMeshId (legacy/non-device meshes)
      else if (node && node.babylonMeshId && scene) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
        if (mesh && mesh instanceof BABYLON.Mesh) {
          set({ 
            selectedMeshes: [mesh],
            selectedCollectionNodeId: null, // Clear collection selection
            selectedCollectionTransformNode: null
          });
        }
      }
    }
  },

  zoomFit: () => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const camera = get().camera;

    if (!scene || !camera || !(camera instanceof BABYLON.ArcRotateCamera)) return;

    // Get all visible meshes (excluding ground and grid overlay)
    const meshes = scene.meshes.filter((m: BABYLON.AbstractMesh) =>
      m.isVisible && m.name !== 'ground' && m.name !== 'gridOverlay'
    );

    if (meshes.length === 0) return;

    // Calculate bounding box of all meshes
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    meshes.forEach((mesh: BABYLON.AbstractMesh) => {
      mesh.computeWorldMatrix(true);
      const boundingBox = mesh.getBoundingInfo().boundingBox;
      const min = boundingBox.minimumWorld;
      const max = boundingBox.maximumWorld;

      minX = Math.min(minX, min.x);
      minY = Math.min(minY, min.y);
      minZ = Math.min(minZ, min.z);
      maxX = Math.max(maxX, max.x);
      maxY = Math.max(maxY, max.y);
      maxZ = Math.max(maxZ, max.z);
    });

    // Calculate diagonal to determine zoom distance
    const diagonal = Math.sqrt(
      (maxX - minX) ** 2 + (maxY - minY) ** 2 + (maxZ - minZ) ** 2
    );

    // Set camera to frame all objects
    camera.radius = diagonal * 1.5;
    camera.target = new BABYLON.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );
  },

  deselectMesh: (mesh) => {
    set({
      selectedMeshes: get().selectedMeshes.filter((m) => m !== mesh),
    });
  },

  clearSelection: () => {
    const { coordinateFrameWidget, customFrame } = get();

    // Hide coordinate frame widget if not showing a custom frame
    if (coordinateFrameWidget && !customFrame) {
      coordinateFrameWidget.hide();
    }

    set({ 
      selectedMeshes: [], 
      selectedNodeId: null, 
      selectedNodeIds: [],
      selectedCollectionNodeId: null,
      selectedCollectionTransformNode: null
    });
  },

  toggleMeshSelection: (mesh) => {
    const { selectedMeshes } = get();
    if (selectedMeshes.includes(mesh)) {
      get().deselectMesh(mesh);
    } else {
      get().selectMesh(mesh);
    }
  },

  // Physics toggle
  togglePhysics: (nodeId: string) => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node?.entityId) return;

    const registry = EntityRegistry.getInstance();
    const entity = registry.get(node.entityId);
    if (!entity) return;

    entity.togglePhysics();
  },

  // Collection/folder creation
  createCollection: (name?: string) => {
    const tree = SceneTreeManager.getInstance();
    const selectedNodeId = get().selectedNodeId;

    // If a node is selected, create under it; otherwise create under Assets
    const parentId = selectedNodeId || tree.getAssetsNode()?.id || null;

    const collectionName = name || `Collection_${Date.now()}`;
    const node = tree.createNode('collection', collectionName, parentId);

    window.dispatchEvent(new Event('scenetree-update'));

    // Select the new collection
    get().clearSelection();
    get().selectNode(node.id);
  },

  // Delete node
  deleteNode: (nodeId: string) => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node) return;

    // Don't allow deleting system nodes
    if (node.type === 'world' || node.type === 'scene' || node.type === 'system') {
      return;
    }

    const nodeName = node.name;

    // Clear selection if deleted node was selected
    if (get().selectedNodeId === nodeId) {
      get().clearSelection();
    }

    // Execute delete command (supports undo)
    const { commandManager } = get();
    const command = new DeleteObjectCommand(nodeId);
    commandManager.execute(command);

    toast.success(`Deleted "${nodeName}"`);
  },

  // Duplicate node
  duplicateNode: (nodeId: string) => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node) {
      toast.error('Cannot duplicate: node not found');
      return;
    }

    // Don't allow duplicating system nodes or collections
    if (node.type === 'world' || node.type === 'scene' || node.type === 'system' || node.type === 'collection') {
      toast.warning('Can only duplicate mesh objects');
      return;
    }

    try {
      // Execute duplicate command (supports undo)
      const { commandManager } = get();
      const command = new DuplicateObjectCommand(nodeId);
      commandManager.execute(command);

      // Select the duplicated object
      const duplicatedNodeId = command.getDuplicatedNodeId();
      if (duplicatedNodeId) {
        get().clearSelection();
        get().selectNode(duplicatedNodeId);
      }

      toast.success(`Duplicated "${node.name}"`);
    } catch (error) {
      console.error('Failed to duplicate node:', error);
      toast.error(`Failed to duplicate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Rename node
  renameNode: (nodeId: string, newName: string) => {
    const tree = SceneTreeManager.getInstance();
    tree.renameNode(nodeId, newName);
    window.dispatchEvent(new Event('scenetree-update'));
  },

  // Move node (for drag-and-drop)
  moveNode: (nodeId: string, newParentId: string | null) => {
    const tree = SceneTreeManager.getInstance();
    tree.moveNode(nodeId, newParentId);
    window.dispatchEvent(new Event('scenetree-update'));
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
    const tree = SceneTreeManager.getInstance();
    let mesh: BABYLON.Mesh | undefined;

    // Create mesh based on type
    switch (type) {
      case 'box':
        mesh = BABYLON.MeshBuilder.CreateBox(
          `Box_${Date.now()}`,
          { size: 2 },
          scene
        );
        break;
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere(
          `Sphere_${Date.now()}`,
          { diameter: 2 },
          scene
        );
        break;
      case 'cylinder':
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          `Cylinder_${Date.now()}`,
          { height: 2, diameter: 1 },
          scene
        );
        break;
      case 'cone':
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          `Cone_${Date.now()}`,
          { height: 2, diameterTop: 0, diameterBottom: 1 },
          scene
        );
        break;
      case 'torus':
        mesh = BABYLON.MeshBuilder.CreateTorus(
          `Torus_${Date.now()}`,
          { diameter: 2, thickness: 0.5, tessellation: 32 },
          scene
        );
        break;
      case 'plane':
        mesh = BABYLON.MeshBuilder.CreatePlane(
          `Plane_${Date.now()}`,
          { size: 2 },
          scene
        );
        break;
      case 'ground':
        mesh = BABYLON.MeshBuilder.CreateGround(
          `Ground_${Date.now()}`,
          { width: 5, height: 5 },
          scene
        );
        break;
      case 'capsule':
        mesh = BABYLON.MeshBuilder.CreateCapsule(
          `Capsule_${Date.now()}`,
          { height: 2, radius: 0.5 },
          scene
        );
        break;
      case 'disc':
        mesh = BABYLON.MeshBuilder.CreateDisc(
          `Disc_${Date.now()}`,
          { radius: 1, tessellation: 32 },
          scene
        );
        break;
      case 'torusknot':
        mesh = BABYLON.MeshBuilder.CreateTorusKnot(
          `TorusKnot_${Date.now()}`,
          { radius: 1, tube: 0.3, radialSegments: 64, tubularSegments: 16 },
          scene
        );
        break;
      case 'polyhedron':
        mesh = BABYLON.MeshBuilder.CreatePolyhedron(
          `Polyhedron_${Date.now()}`,
          { type: 0, size: 1 },
          scene
        );
        break;
      default:
        console.error('Unknown object type:', type);
        return;
    }

    if (!mesh) {
      console.error('Failed to create mesh for type:', type);
      return;
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

    // Map visual shape to physics shape (some complex shapes approximate to simpler ones)
    const getPhysicsShape = (visualType: ObjectType): 'box' | 'sphere' | 'cylinder' => {
      switch (visualType) {
        case 'box':
          return 'box';
        case 'sphere':
        case 'torus':
        case 'torusknot':
        case 'polyhedron':
          return 'sphere';
        case 'cylinder':
        case 'cone':
        case 'capsule':
        case 'disc':
          return 'cylinder';
        case 'plane':
        case 'ground':
          return 'box'; // Thin box for planes
        default:
          return 'box';
      }
    };

    // Get physics shape dimensions based on visual shape
    const getPhysicsParams = (visualType: ObjectType) => {
      const physicsShape = getPhysicsShape(visualType);

      switch (visualType) {
        case 'box':
          return { shape: physicsShape, dimensions: { x: 2, y: 2, z: 2 } };
        case 'sphere':
          return { shape: physicsShape, radius: 1 };
        case 'cylinder':
          return { shape: physicsShape, radius: 0.5, height: 2 };
        case 'cone':
          return { shape: physicsShape, radius: 0.5, height: 2 };
        case 'torus':
          return { shape: physicsShape, radius: 1.25 }; // diameter 2 + thickness 0.5
        case 'plane':
          return { shape: physicsShape, dimensions: { x: 2, y: 2, z: 0.01 } };
        case 'ground':
          return { shape: physicsShape, dimensions: { x: 5, y: 5, z: 0.01 } };
        case 'capsule':
          return { shape: physicsShape, radius: 0.5, height: 2 };
        case 'disc':
          return { shape: physicsShape, radius: 1, height: 0.01 };
        case 'torusknot':
          return { shape: physicsShape, radius: 1.3 }; // approximate bounding sphere
        case 'polyhedron':
          return { shape: physicsShape, radius: 1 };
        default:
          return { shape: 'box' as const, dimensions: { x: 1, y: 1, z: 1 } };
      }
    };

    const physicsParams = getPhysicsParams(type);

    // Create entity with physics disabled by default
    const entity = registry.create({
      mesh,
      physics: {
        enabled: false, // Disabled by default
        type: 'dynamic',
        mass: 1.0,
        ...physicsParams,
      },
      metadata: {
        name: mesh.name,
        type: type,
      },
    });

    // Create node in scene tree under Assets collection
    const assetsNode = tree.getAssetsNode();

    const nodeType: NodeType = type as NodeType;
    const node = tree.createNode(
      nodeType,
      mesh.name,
      assetsNode?.id || null,
      babylonToUser(mesh.position) // Store in user space (Z-up, mm)
    );

    // Link node to Babylon mesh and entity
    node.babylonMeshId = mesh.uniqueId.toString();
    node.entityId = entity.getId();

    // Select the newly created object
    get().clearSelection();
    get().selectNode(node.id);

    // Notify tree to update
    window.dispatchEvent(new Event('scenetree-update'));

    // Show success toast
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} created`);
  },

  // Helper function to load URDF with mesh files
  loadURDFWithMeshes: async (urdfFile: File, meshFiles: File[], scene: BABYLON.Scene, tree: any, assetsNode: any, registry: any) => {
    loading.update('Loading URDF with meshes...', 50);
    
    try {
      // Load URDF as device entity
      const { meshes, rootNodes, deviceEntity } = await (await import('../../loaders/urdf/URDFLoaderWithMeshes')).loadURDFAsDeviceEntity(
        urdfFile,
        meshFiles,
        scene,
        registry
      );
      
      loading.update('Processing geometry...', 70);
      
      // Get the model name from the file
      const modelName = urdfFile.name.substring(0, urdfFile.name.lastIndexOf('.')) || urdfFile.name;
      
      // Create a collection for this model
      const modelCollection = tree.createNode(
        'collection',
        modelName,
        assetsNode?.id || null
      );
      
      // Link device entity to tree node
      if (deviceEntity) {
        modelCollection.entityId = deviceEntity.getId();
      }
      
      // Build tree structure for all nodes
      const buildTreeForNode = (node: BABYLON.TransformNode, parentNodeId: string | null, depth: number = 0): void => {
        const isMesh = node instanceof BABYLON.Mesh;
        const children = getAllChildren(node);
        
        // Skip synthetic root nodes and duplicate filename nodes
        // This ensures synthetic containers don't appear in the tree UI
        if (node.name === '__root__' ||
            node.name.startsWith('__root') ||
            node.name === 'mjcf_root' ||
            node.name.startsWith('mjcf_root') ||
            node.name === modelName) {
          for (const child of children) {
            buildTreeForNode(child, parentNodeId, depth);
          }
          return;
        }
        
        // Create tree node
        const isURDF = node.metadata?.isURDFMesh ||
                       node.metadata?.coordinateSystem === 'urdf-converted' ||
                       node.metadata?.coordinateSystem === 'babylon-native';
        const worldPosition = node.getAbsolutePosition();
        
        const nodeType = isMesh ? 'mesh' : 'collection';
        console.log(`[URDF Loader] Creating tree node: ${node.name} (${nodeType}) under parent ${parentNodeId}`);
        
        const treeNode = tree.createNode(
          nodeType,
          node.name,
          parentNodeId
        );
        
        treeNode.babylonMeshId = isMesh ? (node as BABYLON.Mesh).uniqueId.toString() : null;
        treeNode.babylonNodeId = node.uniqueId.toString();
        treeNode.position = babylonToUser(worldPosition);
        treeNode.isURDF = isURDF;
        
        console.log(`[URDF Loader] Created tree node: ${treeNode.id} (${treeNode.name})`);
        
        // Process children
        for (const child of children) {
          buildTreeForNode(child, treeNode.id, depth + 1);
        }
      };
      
      // Build tree for all root nodes
      console.log(`[URDF Loader] Building tree for ${rootNodes.length} root nodes`);
      for (const rootNode of rootNodes) {
        console.log(`[URDF Loader] Processing root node: ${rootNode.name}`);
        buildTreeForNode(rootNode, modelCollection.id);
      }
      
      // Debug: Check tree state after building
      console.log(`[URDF Loader] Tree now has ${tree.getAllNodes().length} nodes`);
      console.log(`[URDF Loader] Model collection has ${tree.getChildren(modelCollection.id).length} children`);
      
      loading.update('Extracting kinematics...', 85);
      
      // Extract kinematics from URDF
      try {
        const urdfContent = await urdfFile.text();
        await createKinematicsFromURDF(urdfContent, modelCollection.id);
        console.log('✅ Kinematics extracted from URDF');
      } catch (kinematicsError) {
        console.warn('⚠️ Could not extract kinematics:', kinematicsError);
      }
      
      loading.update('Finalizing...', 95);
      
      // Update tree - dispatch event to window for SceneTree component
      console.log('[URDF Loader] Dispatching scenetree-update event');
      window.dispatchEvent(new CustomEvent('scenetree-update'));
      
      // Notify that model import is complete for auto-resize
      setTimeout(() => {
        window.dispatchEvent(new Event('model-import-complete'));
      }, 100);
      
      loading.end();
      toast.success(`Loaded ${modelName} with ${meshes.length} meshes`);
      
    } catch (error) {
      console.error('[URDF Loader] Error loading URDF with meshes:', error);
      loading.end();
      toast.error(`Failed to load URDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  },

  // Import 3D model from file
  importModel: async (file: File, meshFiles?: File[], fileHandle?: any) => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    const tree = SceneTreeManager.getInstance();
    const assetsNode = tree.getAssetsNode();
    const registry = EntityRegistry.getInstance();

    // Check if this is a zip file
    const { isZipFile, loadURDFFromZip } = await import('../../loaders/urdf/ZipURDFLoader');

    if (isZipFile(file)) {
      console.log(`[File Import] Zip file detected: ${file.name}`);
      loading.start('Extracting zip file...', 'uploading');

      try {
        // Try URDF first
        const urdfResult = await loadURDFFromZip(file);

        if (urdfResult.success && urdfResult.urdfFile) {
          console.log(`[File Import] Successfully extracted URDF and ${urdfResult.meshFiles.length} mesh files from zip`);

          // Load the URDF with the extracted mesh files
          await get().loadURDFWithMeshes(urdfResult.urdfFile, urdfResult.meshFiles, scene, tree, assetsNode, registry);
          return;
        }

        // No URDF found, try MJCF
        console.log(`[File Import] No URDF found in ZIP, trying MJCF...`);

        // Import MJCF loader
        const { loadMJCFFromFile } = await import('../../loaders/mjcf/MJCFLoader');

        try {
          // MJCF loader will handle ZIP extraction internally
          const mjcfResult = await loadMJCFFromFile(file, scene);

          if (mjcfResult.success) {
            console.log(`[File Import] Successfully loaded MJCF from ZIP: ${mjcfResult.meshes.length} meshes`);

            // Get the model name from the file
            const modelName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

            // Create a collection for this model
            const modelCollection = tree.createNode(
              'collection',
              modelName,
              assetsNode?.id || null
            );

            // Build tree structure for all nodes using the same logic as URDF
            const buildTreeForNode = (node: BABYLON.TransformNode, parentNodeId: string | null, depth: number = 0): void => {
              const isMesh = node instanceof BABYLON.Mesh;
              const children = getAllChildren(node);

              // Skip synthetic root nodes and duplicate filename nodes - process children directly
              // This ensures synthetic containers don't appear in the tree UI
              // For MJCF: Only skip the synthetic container (mjcf_root_<modelname>), not the actual body nodes
              const isMJCFSyntheticContainer = node.name === uniqueRootName || node.name === `mjcf_root_${modelName}`;
              const isGenericSyntheticRoot = node.name === '__root__' || node.name.startsWith('__root');
              const isDuplicateFilename = node.name === modelName && node.metadata?.sourceFormat !== 'mjcf';

              if (isMJCFSyntheticContainer || isGenericSyntheticRoot || isDuplicateFilename) {
                for (const child of children) {
                  buildTreeForNode(child, parentNodeId, depth);
                }
                return;
              }

              // Create tree node
              const worldPosition = node.getAbsolutePosition();
              const position = babylonToUser(worldPosition);  // Full conversion with axis swap

              const treeNode = tree.createNode(
                isMesh ? 'mesh' : 'collection',
                node.name || 'Unnamed',
                parentNodeId,
                position
              );

              // Link to mesh if applicable
              if (isMesh) {
                treeNode.babylonMeshId = node.uniqueId.toString();
              } else {
                // Link to TransformNode for collections
                treeNode.babylonTransformNodeId = node.uniqueId.toString();
              }

              // Recursively process all children
              for (const child of children) {
                buildTreeForNode(child, treeNode.id, depth + 1);
              }
            };

            // Special handling for MJCF: Create a unique root TransformNode for this model
            // This ensures each model has its own transform node for proper gizmo selection
            const uniqueRootName = `mjcf_root_${modelName}`;
            let mjcfRootNode = scene.transformNodes.find(tn => tn.name === uniqueRootName);
            
            if (!mjcfRootNode) {
              // Create a new unique root TransformNode for this model
              mjcfRootNode = new BABYLON.TransformNode(uniqueRootName, scene);
              mjcfRootNode.scaling.set(1, 1, 1);
              console.log('[EditorStore] Created unique MJCF root TransformNode:', uniqueRootName, 'with uniqueId:', mjcfRootNode.uniqueId);
              
              // Reparent all the MJCF root nodes to this unique root
              // This ensures each model has its own transform hierarchy
              for (const rootNode of mjcfResult.rootNodes) {
                if (rootNode.parent !== mjcfRootNode) {
                  rootNode.parent = mjcfRootNode;
                  console.log('[EditorStore] Reparented MJCF root node:', rootNode.name, 'to unique root:', uniqueRootName);
                }
              }
            }
            
            // Link the model collection to this unique root TransformNode
            modelCollection.babylonTransformNodeId = mjcfRootNode.uniqueId.toString();
            console.log('[EditorStore] Linked MJCF model collection to unique root TransformNode:', mjcfRootNode.uniqueId);

            // Build tree starting from root nodes
            for (const rootNode of mjcfResult.rootNodes) {
              buildTreeForNode(rootNode, modelCollection.id);
            }

            // Select the model collection
            get().clearSelection();
            get().selectNode(modelCollection.id);

            // Expand Assets node if not already expanded
            if (assetsNode && !assetsNode.expanded) {
              tree.toggleExpanded(assetsNode.id);
              window.dispatchEvent(new Event('scenetree-update'));
            }

            // Expand the collection to show contents
            tree.toggleExpanded(modelCollection.id);

            // Notify tree to update
            window.dispatchEvent(new Event('scenetree-update'));

            loading.end();
            toast.success(`Loaded ${mjcfResult.meshes.length} meshes from MJCF`);
            return;
          }
        } catch (mjcfError) {
          console.log(`[File Import] MJCF loading failed:`, mjcfError);
          // Continue to throw the generic error below
        }

        throw new Error('No valid URDF or MJCF found in ZIP archive');

      } catch (error) {
        console.error('[File Import] Error loading zip file:', error);
        loading.end();
        toast.error(`Failed to load zip file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }
    }

    // Track the directory of the selected file for better UX
    // Extract directory from file path if available (webkitRelativePath)
    const filePath = file.webkitRelativePath || file.name;
    const directory = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : null;
    if (directory) {
      get().setLastUsedDirectory(directory);
      console.log(`[File Import] Tracked directory: ${directory}`);
    } else {
      console.log(`[File Import] Could not extract directory from file: ${file.name}`);
      console.log(`[File Import] webkitRelativePath: ${file.webkitRelativePath || 'not available'}`);
      
      // If we have a file handle, try to get directory information
      if (fileHandle) {
        console.log(`[File Import] File handle available, but directory info not accessible due to security restrictions`);
      }
    }

    loading.start('Loading model...', 'uploading');

    try {
      // For URDF files, try to automatically find mesh files
      const isURDF = file.name.endsWith('.urdf');
      let meshFilesToUse: File[] = [];

      if (isURDF) {
        loading.update('Searching for STL mesh files...', 25);
        const { findMeshFilesForURDF } = await import('../../loaders/urdf/URDFMeshFinder');
        meshFilesToUse = await findMeshFilesForURDF(file, get().lastUsedDirectory);

        if (meshFilesToUse.length > 0) {
          loading.update(`Found ${meshFilesToUse.length} mesh files, loading...`, 40);
          console.log(`[Auto-discovered ${meshFilesToUse.length} mesh files for URDF]`);
        } else {
          loading.update('No mesh files found, using placeholders...', 40);
          console.log('[No mesh files found - placeholders will be used]');
        }
      }

      // Load model - now returns both meshes and root nodes
      let meshes: BABYLON.AbstractMesh[];
      let rootNodes: BABYLON.TransformNode[];
      let deviceEntity: any = null;

      if (isURDF && meshFilesToUse.length > 0) {
        // Load URDF as device entity
        const urdfLoader = await import('../../loaders/urdf/URDFLoaderWithMeshes');
        const result = await urdfLoader.loadURDFAsDeviceEntity(file, meshFilesToUse, scene, registry);
        meshes = result.meshes;
        rootNodes = result.rootNodes;
        deviceEntity = result.deviceEntity;
      } else {
      console.log('[EditorStore] Loading file with loadModelFromFile:', file.name, 'Extension:', file.name.substring(file.name.lastIndexOf('.')));
      if (meshFiles && meshFiles.length > 0) {
        console.log('[EditorStore] Passing', meshFiles.length, 'mesh files to loader');
      }
      const result = await loadModelFromFile(file, scene, meshFiles);
      console.log('[EditorStore] loadModelFromFile result:', result);
      console.log('[EditorStore] Meshes count:', result.meshes.length);
      console.log('[EditorStore] Root nodes count:', result.rootNodes.length);
      
      // Debug: Log mesh details for MJCF files
      if (file.name.endsWith('.xml')) {
        console.log('[EditorStore] MJCF Debug - Mesh Details:');
        result.meshes.forEach((mesh, index) => {
          console.log(`[EditorStore] Mesh ${index}:`, {
            name: mesh.name,
            enabled: mesh.isEnabled(),
            visible: mesh.isVisible,
            position: `(${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`,
            parent: mesh.parent ? mesh.parent.name : 'none',
            material: mesh.material ? mesh.material.name : 'none',
            uniqueId: mesh.uniqueId,
            verticesCount: mesh.getTotalVertices(),
            boundingInfo: mesh.getBoundingInfo() ? 'exists' : 'missing',
            metadata: mesh.metadata
          });
        });
        
        console.log('[EditorStore] MJCF Debug - Root Node Details:');
        result.rootNodes.forEach((node, index) => {
          console.log(`[EditorStore] Root Node ${index}:`, {
            name: node.name,
            enabled: node.isEnabled(),
            position: `(${node.position.x.toFixed(2)}, ${node.position.y.toFixed(2)}, ${node.position.z.toFixed(2)})`,
            childrenCount: node.getChildren().length,
            uniqueId: node.uniqueId,
            metadata: node.metadata
          });
        });
      }
      
      // Debug: Log mesh details for GLB files
      if (file.name.endsWith('.glb')) {
        console.log('[EditorStore] GLB Debug - Mesh Details:');
        result.meshes.forEach((mesh, index) => {
          console.log(`[EditorStore] GLB Mesh ${index}:`, {
            name: mesh.name,
            enabled: mesh.isEnabled(),
            visible: mesh.isVisible,
            position: `(${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`,
            parent: mesh.parent ? mesh.parent.name : 'none',
            material: mesh.material ? mesh.material.name : 'none',
            uniqueId: mesh.uniqueId,
            verticesCount: mesh.getTotalVertices(),
            boundingInfo: mesh.getBoundingInfo() ? 'exists' : 'missing',
            metadata: mesh.metadata
          });
        });
        
        console.log('[EditorStore] GLB Debug - Root Node Details:');
        result.rootNodes.forEach((node, index) => {
          console.log(`[EditorStore] GLB Root Node ${index}:`, {
            name: node.name,
            enabled: node.isEnabled(),
            position: `(${node.position.x.toFixed(2)}, ${node.position.y.toFixed(2)}, ${node.position.z.toFixed(2)})`,
            childrenCount: node.getChildren().length,
            uniqueId: node.uniqueId,
            metadata: node.metadata
          });
        });
        
        // GLB-specific user messaging
        console.warn('[EditorStore] GLB file loaded - visual model only');
        console.warn('[EditorStore] No kinematic controls available for GLB files');
        console.warn('[EditorStore] Use MJCF format for robot functionality');
      }
      
      meshes = result.meshes;
      rootNodes = result.rootNodes;
      }

      loading.update('Processing geometry...', 50);

      // Check if this is a URDF robot with missing meshes
      if (isURDF && rootNodes.length > 0) {
        const robotRoot = rootNodes[0];
        const requiredMeshes = robotRoot.metadata?.requiredMeshFiles;

        if (requiredMeshes && requiredMeshes.length > 0) {
          toast.warning(
            `URDF loaded with ${requiredMeshes.length} placeholder(s). ` +
            `Check console for mesh file paths.`
          );
        }
      }

      // Get the model name from the file
      const modelName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

      // Create a collection for this model (or device node for URDF)
      const nodeType = deviceEntity ? 'collection' : 'collection'; // Use 'device' type when available
      const modelCollection = tree.createNode(
        nodeType,
        modelName,
        assetsNode?.id || null
      );

      // Link device entity to tree node
      if (deviceEntity) {
        modelCollection.entityId = deviceEntity.getId();
      }

      // Recursive function - creates tree nodes for all nodes (TransformNodes and Meshes)
      const buildTreeForNode = (node: BABYLON.TransformNode, parentNodeId: string | null, depth: number = 0): void => {
        const isMesh = node instanceof BABYLON.Mesh;
        const children = getAllChildren(node);

        // Skip __root__ and duplicate filename nodes - process children directly
        // But don't skip MJCF root nodes as they contain the actual geometry
        if (node.name === '__root__' ||
            node.name.startsWith('__root') ||
            node.name === 'mjcf_root' ||
            node.name.startsWith('mjcf_root') ||
            (node.name === modelName && node.metadata?.sourceFormat !== 'mjcf')) {
          for (const child of children) {
            buildTreeForNode(child, parentNodeId, depth);
          }
          return;
        }

        // Create tree node
        // Check if this is a URDF object (already converted to Babylon Y-up)
        const isURDF = node.metadata?.isURDFMesh ||
                       node.metadata?.coordinateSystem === 'urdf-converted' ||
                       node.metadata?.coordinateSystem === 'babylon-native';
        const worldPosition = node.getAbsolutePosition();
        const position = isURDF
          ? { x: worldPosition.x * 1000, y: worldPosition.y * 1000, z: worldPosition.z * 1000 }  // Just convert meters to mm
          : babylonToUser(worldPosition);  // Full conversion with axis swap

        const treeNode = tree.createNode(
          isMesh ? 'mesh' : 'collection',
          node.name || 'Unnamed',
          parentNodeId,
          position
        );

        // Link to mesh if applicable
        if (isMesh) {
          treeNode.babylonMeshId = node.uniqueId.toString();

          // If this is a device entity, link to the corresponding link entity
          if (deviceEntity) {
            const linkEntity = deviceEntity.getChildren().find((child: any) => {
              const childMesh = child.getMesh();
              return childMesh && childMesh.uniqueId === node.uniqueId;
            });
            if (linkEntity) {
              treeNode.entityId = linkEntity.getId();
            }
          }
        } else {
          // Link to TransformNode for collections (URDF links)
          treeNode.babylonTransformNodeId = node.uniqueId.toString();
        }

        // Recursively process all children
        for (const child of children) {
          buildTreeForNode(child, treeNode.id, depth + 1);
        }
      };

      // Build tree starting from root nodes
      for (const rootNode of rootNodes) {
        buildTreeForNode(rootNode, modelCollection.id);
      }

      // Select the model collection
      get().clearSelection();
      get().selectNode(modelCollection.id);

      // Expand Assets node if not already expanded
      if (assetsNode && !assetsNode.expanded) {
        tree.toggleExpanded(assetsNode.id);
        window.dispatchEvent(new Event('scenetree-update'));
      }

      // Expand the collection to show contents
      tree.toggleExpanded(modelCollection.id);

      // Notify tree to update
      window.dispatchEvent(new Event('scenetree-update'));
      
      // Notify that model import is complete for auto-resize
      setTimeout(() => {
        window.dispatchEvent(new Event('model-import-complete'));
      }, 100);

      // Auto-extract kinematics from URDF (single file import)
      if (isURDF) {
        loading.update('Extracting kinematics...', 75);
        try {
          const urdfXML = await file.text();
          await createKinematicsFromURDF(urdfXML, modelCollection.id);
          loading.update('Finalizing...', 90);
          loading.end();
          toast.success(`Imported ${meshes.length} meshes from ${file.name} + kinematics! 🤖`);
          console.log(`Imported ${meshes.length} meshes with kinematics auto-extracted`);
        } catch (error) {
          console.warn('Failed to auto-extract kinematics:', error);
          loading.update('Finalizing...', 90);
          loading.end();
          toast.success(`Imported ${meshes.length} meshes from ${file.name}`);
        }
      } else {
        loading.update('Finalizing...', 90);

        // Auto-resize floor for DWG files (common for large layouts)
        if (file.name.toLowerCase().endsWith('.dwg')) {
          // Calculate bounding box of all imported meshes
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const mesh of meshes) {
            mesh.computeWorldMatrix(true);
            const boundingInfo = mesh.getBoundingInfo();
            const min = boundingInfo.minimum;
            const max = boundingInfo.maximum;

            minX = Math.min(minX, min.x);
            minY = Math.min(minY, min.y);
            maxX = Math.max(maxX, max.x);
            maxY = Math.max(maxY, max.y);
          }

          // Resize floor to fit the layout with 20% margin
          const width = maxX - minX;
          const depth = maxY - minY;
          const margin = 1.2; // 20% margin for comfortable navigation

          if (isFinite(width) && isFinite(depth) && width > 10 && depth > 10) {
            const floorWidth = width * margin;
            const floorDepth = depth * margin;
            sceneManager.resizeFloor(floorWidth, floorDepth);
            console.log(`Auto-resized floor to ${floorWidth.toFixed(1)}m × ${floorDepth.toFixed(1)}m for DWG layout`);
          }
        }

        // Zoom camera to fit imported DWG geometry
        if (file.name.toLowerCase().endsWith('.dwg')) {
          console.log('[DWG Import] Zooming to fit imported geometry...');
          get().zoomFit();
        }

        loading.end();
        toast.success(`Imported ${meshes.length} meshes from ${file.name}`);
        console.log(`Imported ${meshes.length} meshes with ${rootNodes.length} root nodes`);
        
        // Final notification that model import is complete
        setTimeout(() => {
          window.dispatchEvent(new Event('model-import-complete'));
        }, 200);
      }
    } catch (error) {
      loading.end();
      console.error('Failed to import model:', error);
      toast.error(`Failed to import ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Import URDF folder with mesh files
  importURDFFolder: async (files: File[]) => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    const tree = SceneTreeManager.getInstance();
    const assetsNode = tree.getAssetsNode();
    const registry = EntityRegistry.getInstance();

    // Track the directory of the selected folder for better UX
    // Extract directory from the first file's path if available
    if (files.length > 0) {
      const firstFile = files[0];
      const filePath = firstFile.webkitRelativePath || firstFile.name;
      const directory = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : null;
      if (directory) {
        get().setLastUsedDirectory(directory);
        console.log(`[URDF Folder Import] Tracked directory: ${directory}`);
      }
    }

    loading.start('Loading URDF folder...', 'uploading');

    try {
      // Find the URDF file
      const urdfFile = files.find(f => f.name.endsWith('.urdf'));
      if (!urdfFile) {
        throw new Error('No URDF file found in selected folder');
      }

      console.log(`Found URDF: ${urdfFile.name}`);
      console.log(`Total files: ${files.length}`);

      // Load URDF as device entity
      const { meshes, rootNodes, deviceEntity } = await (await import('../../loaders/urdf/URDFLoaderWithMeshes')).loadURDFAsDeviceEntity(
        urdfFile,
        files,
        scene,
        registry
      );
      loading.update('Processing geometry...', 50);

      // Get the model name from the file
      const modelName = urdfFile.name.substring(0, urdfFile.name.lastIndexOf('.')) || urdfFile.name;

      // Create a collection for this model
      const modelCollection = tree.createNode(
        'collection',
        modelName,
        assetsNode?.id || null
      );

      // Link device entity to tree node
      if (deviceEntity) {
        modelCollection.entityId = deviceEntity.getId();
      }

      // Recursive function - creates tree nodes for all nodes (TransformNodes and Meshes)
      const buildTreeForNode = (node: BABYLON.TransformNode, parentNodeId: string | null, depth: number = 0): void => {
        const isMesh = node instanceof BABYLON.Mesh;
        const children = getAllChildren(node);

        // Skip __root__ and duplicate filename nodes - process children directly
        // But don't skip MJCF root nodes as they contain the actual geometry
        if (node.name === '__root__' ||
            node.name.startsWith('__root') ||
            node.name === 'mjcf_root' ||
            node.name.startsWith('mjcf_root') ||
            (node.name === modelName && node.metadata?.sourceFormat !== 'mjcf')) {
          for (const child of children) {
            buildTreeForNode(child, parentNodeId, depth);
          }
          return;
        }

        // Create tree node
        // Check if this is a URDF object (already converted to Babylon Y-up)
        const isURDF = node.metadata?.isURDFMesh ||
                       node.metadata?.coordinateSystem === 'urdf-converted' ||
                       node.metadata?.coordinateSystem === 'babylon-native';
        const worldPosition = node.getAbsolutePosition();
        const position = isURDF
          ? { x: worldPosition.x * 1000, y: worldPosition.y * 1000, z: worldPosition.z * 1000 }  // Just convert meters to mm
          : babylonToUser(worldPosition);  // Full conversion with axis swap

        const treeNode = tree.createNode(
          isMesh ? 'mesh' : 'collection',
          node.name || 'Unnamed',
          parentNodeId,
          position
        );

        // Link to mesh if applicable
        if (isMesh) {
          treeNode.babylonMeshId = node.uniqueId.toString();

          // If this is a device entity, link to the corresponding link entity
          if (deviceEntity) {
            const linkEntity = deviceEntity.getChildren().find((child: any) => {
              const childMesh = child.getMesh();
              return childMesh && childMesh.uniqueId === node.uniqueId;
            });
            if (linkEntity) {
              treeNode.entityId = linkEntity.getId();
            }
          }
        } else {
          // Link to TransformNode for collections (URDF links)
          treeNode.babylonTransformNodeId = node.uniqueId.toString();
        }

        // Recursively process all children
        for (const child of children) {
          buildTreeForNode(child, treeNode.id, depth + 1);
        }
      };

      // Build tree starting from root nodes
      for (const rootNode of rootNodes) {
        buildTreeForNode(rootNode, modelCollection.id);
      }

      // Select the model collection
      get().clearSelection();
      get().selectNode(modelCollection.id);

      // Expand Assets node if not already expanded
      if (assetsNode && !assetsNode.expanded) {
        tree.toggleExpanded(assetsNode.id);
        window.dispatchEvent(new Event('scenetree-update'));
      }

      // Expand the collection to show contents
      tree.toggleExpanded(modelCollection.id);

      // Notify tree to update
      window.dispatchEvent(new Event('scenetree-update'));

      loading.update('Extracting kinematics...', 75);

      // Auto-extract kinematics from URDF
      try {
        const urdfXML = await urdfFile.text();
        await createKinematicsFromURDF(urdfXML, modelCollection.id);
        loading.update('Finalizing...', 90);
        loading.end();
        toast.success(`Imported URDF robot with ${meshes.length} meshes + kinematics! 🤖`);
        console.log(`Imported ${meshes.length} meshes with kinematics auto-extracted`);
      } catch (error) {
        console.warn('Failed to auto-extract kinematics:', error);
        loading.update('Finalizing...', 90);
        loading.end();
        toast.success(`Imported ${meshes.length} meshes (kinematics extraction skipped)`);
      }
    } catch (error) {
      loading.end();
      console.error('Failed to import URDF folder:', error);
      toast.error(`Failed to import URDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Save world to file
  saveWorld: () => {
    try {
      saveWorldToFile();
      console.log('World saved successfully');
    } catch (error) {
      console.error('Failed to save world:', error);
      alert('Failed to save world. Check console for details.');
    }
  },

  // Load world from file (metadata only - lightweight)
  loadWorld: async (file: File) => {
    try {
      const worldData = await loadWorldFromFile(file);
      if (!worldData) {
        toast.error('Failed to load world file. Invalid format.');
        return;
      }

      // Restore world state
      const success = restoreWorldState(worldData);
      if (success) {
        console.log('World loaded successfully');
        toast.success('World metadata loaded');
        window.dispatchEvent(new Event('scenetree-update'));
      } else {
        toast.error('Failed to restore world state.');
      }
    } catch (error) {
      console.error('Failed to load world:', error);
      toast.error('Failed to load world. Check console for details.');
    }
  },

  // Save complete Babylon scene (geometry + materials + metadata)
  saveBabylonWorld: () => {
    try {
      saveBabylonWorldToFile();
      toast.success('Babylon world saved successfully');
    } catch (error) {
      console.error('Failed to save Babylon world:', error);
      toast.error('Failed to save Babylon world. Check console for details.');
    }
  },

  // Load complete Babylon world from .babylon file
  loadBabylonWorld: async (file: File) => {
    try {
      loading.start('Loading Babylon world...', 'loading');
      const babylonData = await loadBabylonWorldFromFile(file);
      if (!babylonData) {
        toast.error('Failed to load Babylon world file. Invalid format.');
        loading.end();
        return;
      }

      // Restore complete scene
      const success = await restoreBabylonWorld(babylonData);
      loading.end();

      if (success) {
        toast.success('Babylon world loaded successfully');
        window.dispatchEvent(new Event('scenetree-update'));
      } else {
        toast.error('Failed to restore Babylon world.');
      }
    } catch (error) {
      console.error('Failed to load Babylon world:', error);
      loading.end();
      toast.error('Failed to load Babylon world. Check console for details.');
    }
  },

  // Save comprehensive world (includes all assets and data)
  saveComprehensiveWorld: async () => {
    try {
      loading.start('Saving comprehensive world...', 'processing');
      await saveComprehensiveWorldToFile();
      loading.end();
    } catch (error) {
      console.error('Failed to save comprehensive world:', error);
      loading.end();
      toast.error('Failed to save comprehensive world. Check console for details.');
    }
  },

  // Load comprehensive world (includes all assets and data)
  loadComprehensiveWorld: async (file: File) => {
    try {
      loading.start('Loading comprehensive world...', 'loading');
      const comprehensiveData = await loadComprehensiveWorldFromFile(file);
      if (!comprehensiveData) {
        toast.error('Failed to load comprehensive world file. Invalid format.');
        loading.end();
        return;
      }

      // Restore comprehensive scene
      const success = await restoreComprehensiveWorld(comprehensiveData);
      loading.end();

      if (success) {
        window.dispatchEvent(new Event('scenetree-update'));
      } else {
        toast.error('Failed to restore comprehensive world.');
      }
    } catch (error) {
      console.error('Failed to load comprehensive world:', error);
      loading.end();
      toast.error('Failed to load comprehensive world. Check console for details.');
    }
  },

  // Clear all objects from world
  clearWorld: () => {
    const tree = SceneTreeManager.getInstance();
    const registry = EntityRegistry.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    // Clear selection first
    get().clearSelection();

    // Get all user-created nodes (under Assets)
    const assetsNode = tree.getAssetsNode();
    if (!assetsNode) {
      toast.warning('No assets to clear');
      return;
    }

    // Get all children of Assets (copy array to avoid modification during iteration)
    const childrenToDelete = assetsNode.childIds ? [...assetsNode.childIds] : [];

    if (childrenToDelete.length === 0) {
      toast.info('World is already empty');
      return;
    }

    let deletedCount = 0;

    // Delete all children of Assets recursively
    const deleteNodeRecursively = (nodeId: string) => {
      const node = tree.getNode(nodeId);
      if (!node) return;

      // First delete all children
      const children = [...(node.childIds || [])];
      children.forEach(childId => deleteNodeRecursively(childId));

      // Delete entity and Babylon mesh if it exists
      if (node.entityId) {
        const entity = registry.get(node.entityId);
        if (entity) {
          entity.dispose();
          registry.remove(node.entityId);
        }
      }

      // Also dispose Babylon mesh directly if it exists
      if (node.babylonMeshId && scene) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
        if (mesh) {
          mesh.dispose();
        }
      }

      // Dispose TransformNode if it exists
      if (node.babylonTransformNodeId && scene) {
        const transformNode = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId, 10));
        if (transformNode) {
          transformNode.dispose();
        }
      }

      // Delete from tree
      tree.deleteNode(nodeId);
      deletedCount++;
    };

    // Delete all top-level children of Assets
    childrenToDelete.forEach(childId => deleteNodeRecursively(childId));

    // Reset the tree structure to ensure fresh start with zero counts
    // This will recreate the basic World -> Scene -> Assets structure
    tree.reset();

    // Also dispose any orphaned meshes in the scene (safety cleanup)
    if (scene) {
      const meshesToDispose = scene.meshes.filter(
        mesh => mesh.name !== 'ground' && mesh.name !== '__root__' && mesh.name !== 'mjcf_root' && !mesh.name.startsWith('grid')
      );
      meshesToDispose.forEach(mesh => {
        try {
          mesh.dispose();
        } catch (error) {
          console.error(`Failed to dispose mesh ${mesh.name}:`, error);
        }
      });

      // Also dispose orphaned transform nodes
      const transformNodesToDispose = scene.transformNodes.filter(
        node => node.name !== '__root__' && !node.name.startsWith('__root') && 
                node.name !== 'mjcf_root' && !node.name.startsWith('mjcf_root')
      );
      transformNodesToDispose.forEach(node => {
        try {
          node.dispose();
        } catch (error) {
          console.error(`Failed to dispose transform node ${node.name}:`, error);
        }
      });
    }

    // Clear command history
    get().commandManager.clear();

    // Force multiple UI updates to ensure tree refreshes
    window.dispatchEvent(new Event('scenetree-update'));
    setTimeout(() => window.dispatchEvent(new Event('scenetree-update')), 0);
    setTimeout(() => window.dispatchEvent(new Event('scenetree-update')), 100);

    toast.success(`Cleared ${deletedCount} object(s)`);
  },

  // Transform update actions
  updateNodePosition: (nodeId: string, position: { x: number; y: number; z: number }) => {
    console.log('🔧 updateNodePosition called:', { nodeId, position });
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node) {
      console.log('❌ Node not found in tree:', nodeId);
      return;
    }

    // Update local position in tree
    tree.setLocalPosition(nodeId, position);

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) {
      console.log('❌ No scene');
      return;
    }

    const babylonPos = userToBabylon(position);
    console.log('🔄 Converted to Babylon coords:', babylonPos);

    // Update Babylon node (Mesh or TransformNode)
    let babylonNode: BABYLON.TransformNode | null = null;
    if (node.babylonMeshId) {
      // It's a mesh
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
    } else if (node.type === 'collection') {
      // It's a collection/TransformNode - find by name
      babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
    }

    if (babylonNode) {
      console.log('✅ Found Babylon node, setting position from', babylonNode.position, 'to', babylonPos);
      babylonNode.position.copyFrom(babylonPos);
      console.log('✅ Position set, new value:', babylonNode.position);

      // Sync to physics if entity exists (only for meshes)
      if (node.entityId) {
        const registry = EntityRegistry.getInstance();
        const entity = registry.get(node.entityId);
        entity?.syncToPhysics();
      }
    } else {
      console.log('❌ Babylon node not found');
    }

    window.dispatchEvent(new Event('scenetree-update'));
  },

  updateNodeRotation: (nodeId: string, rotation: { x: number; y: number; z: number }) => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node) return;

    // Update local rotation in tree
    tree.setLocalRotation(nodeId, rotation);

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // Convert degrees to radians
    const radiansX = (rotation.x * Math.PI) / 180;
    const radiansY = (rotation.y * Math.PI) / 180;
    const radiansZ = (rotation.z * Math.PI) / 180;

    // Update Babylon node (Mesh or TransformNode)
    let babylonNode: BABYLON.TransformNode | null = null;
    if (node.babylonMeshId) {
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
    } else if (node.type === 'collection') {
      babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
    }

    if (babylonNode) {
      // IMPORTANT: If rotationQuaternion exists, it takes precedence over rotation
      // We need to either clear it or convert our Euler angles to quaternion
      if (babylonNode.rotationQuaternion) {
        // Convert Euler angles to quaternion
        babylonNode.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(
          radiansY, // yaw
          radiansX, // pitch
          radiansZ  // roll
        );
      } else {
        // No quaternion, just set rotation directly
        babylonNode.rotation.set(radiansX, radiansY, radiansZ);
      }

      // Sync to physics if entity exists (only for meshes)
      if (node.entityId) {
        const registry = EntityRegistry.getInstance();
        const entity = registry.get(node.entityId);
        entity?.syncToPhysics();
      }
    }

    window.dispatchEvent(new Event('scenetree-update'));
  },

  updateNodeScale: (nodeId: string, scale: { x: number; y: number; z: number }) => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node) return;

    // Update local scale in tree
    tree.setScale(nodeId, scale);

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // Update Babylon node (Mesh or TransformNode)
    let babylonNode: BABYLON.TransformNode | null = null;
    if (node.babylonMeshId) {
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
    } else if (node.type === 'collection') {
      babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
    }

    if (babylonNode) {
      babylonNode.scaling.set(scale.x, scale.y, scale.z);
      // Note: Scaling doesn't sync to physics as it would require recreating the collider
    }

    window.dispatchEvent(new Event('scenetree-update'));
  },

  // Custom frame actions
  setCustomFrameSelectionMode: (mode) => {
    set({ customFrameSelectionMode: mode });
  },

  setCustomFrame: (frame) => {
    const { coordinateFrameWidget } = get();

    if (frame) {
      // Show visual axes widget
      if (coordinateFrameWidget) {
        coordinateFrameWidget.show(frame, 0.1);
      }
    } else {
      // Hide visual axes widget
      if (coordinateFrameWidget) {
        coordinateFrameWidget.hide();
      }
    }

    set({ customFrame: frame });
  },

  initializeCoordinateFrameWidget: () => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    if (scene) {
      const widget = new CoordinateFrameWidget(scene);
      set({ coordinateFrameWidget: widget });
    }
  },

  handleSceneClickForCustomFrame: (pickInfo) => {
    const { customFrameSelectionMode, selectedNodeId } = get();

    if (customFrameSelectionMode === 'none' || !pickInfo.hit || !pickInfo.pickedMesh) {
      return;
    }

    const mesh = pickInfo.pickedMesh as BABYLON.Mesh;
    const pickPoint = pickInfo.pickedPoint;

    if (!pickPoint) return;

    let frame: CustomFrameFeature | null = null;

    try {
      switch (customFrameSelectionMode) {
        case 'object': {
          frame = CustomFrameHelper.calculateObjectFrame(mesh, selectedNodeId || mesh.uniqueId.toString());
          break;
        }

        case 'face': {
          const faceIndex = CustomFrameHelper.findClosestFace(mesh, pickPoint);
          if (faceIndex !== null) {
            frame = CustomFrameHelper.calculateFaceFrame(
              mesh,
              selectedNodeId || mesh.uniqueId.toString(),
              faceIndex
            );
          }
          break;
        }

        case 'edge': {
          const edge = CustomFrameHelper.findClosestEdge(mesh, pickPoint);
          if (edge) {
            frame = CustomFrameHelper.calculateEdgeFrame(
              mesh,
              selectedNodeId || mesh.uniqueId.toString(),
              edge[0],
              edge[1]
            );
          }
          break;
        }

        case 'vertex': {
          const vertexIndex = CustomFrameHelper.findClosestVertex(mesh, pickPoint);
          if (vertexIndex !== null) {
            frame = CustomFrameHelper.calculateVertexFrame(
              mesh,
              selectedNodeId || mesh.uniqueId.toString(),
              vertexIndex
            );
          }
          break;
        }
      }

      if (frame) {
        get().setCustomFrame(frame);
        get().setCustomFrameSelectionMode('none');
        console.log('Custom frame set:', frame);
      }
    } catch (error) {
      console.error('Error calculating custom frame:', error);
    }
  },

  // Panel layout persistence
  savePanelLayout: (layout) => {
    try {
      localStorage.setItem('kineticore-panel-layout', JSON.stringify(layout));
      set({ panelLayout: layout });
    } catch (error) {
      console.error('Failed to save panel layout:', error);
    }
  },

  loadPanelLayout: () => {
    try {
      const saved = localStorage.getItem('kineticore-panel-layout');
      if (saved) {
        const layout = JSON.parse(saved);
        set({ panelLayout: layout });
        return layout;
      }
    } catch (error) {
      console.error('Failed to load panel layout:', error);
    }
    return null;
  },

  // Transform settings setters
  setPositionIncrement: (value: number) => set({ positionIncrement: value }),
  setRotationIncrement: (value: number) => set({ rotationIncrement: value }),
  setSnapEnabled: (enabled: boolean) => set({ snapEnabled: enabled }),
  setSnapToGrid: (enabled: boolean) => set({ snapToGrid: enabled }),
  setSnapToVertex: (enabled: boolean) => set({ snapToVertex: enabled }),
  setSnapToEdge: (enabled: boolean) => set({ snapToEdge: enabled }),
  setSnapToFace: (enabled: boolean) => set({ snapToFace: enabled }),
  setSnapToCenter: (enabled: boolean) => set({ snapToCenter: enabled }),
  setSnapToObject: (enabled: boolean) => set({ snapToObject: enabled }),
  setSnapToMidpoint: (enabled: boolean) => set({ snapToMidpoint: enabled }),
  setSnapToIntersection: (enabled: boolean) => set({ snapToIntersection: enabled }),
  setSnapToPerpendicular: (enabled: boolean) => set({ snapToPerpendicular: enabled }),
  setSnapToTangent: (enabled: boolean) => set({ snapToTangent: enabled }),
  setSnapAlong: (enabled: boolean) => set({ snapAlong: enabled }),
  setSnapToNormal: (enabled: boolean) => set({ snapToNormal: enabled }),
  setSnapToPlane: (enabled: boolean) => set({ snapToPlane: enabled }),
  setSnapToAxis: (enabled: boolean) => set({ snapToAxis: enabled }),
  setSnapToCurve: (enabled: boolean) => set({ snapToCurve: enabled }),
  setSnapToSurface: (enabled: boolean) => set({ snapToSurface: enabled }),
  setSnapObjectToVertex: (enabled: boolean) => set({ snapObjectToVertex: enabled }),
  setSnapPointOnEdge: (enabled: boolean) => set({ snapPointOnEdge: enabled }),
  setSnapBBoxCorner: (enabled: boolean) => set({ snapBBoxCorner: enabled }),
  setGridSize: (size: number) => set({ gridSize: size }),
  setSnapDistance: (distance: number) => set({ snapDistance: distance }),
  setTemporaryOrigin: (origin: { x: number; y: number; z: number } | null) =>
    set({ temporaryOrigin: origin }),
  clearTemporaryOrigin: () => set({ temporaryOrigin: null }),

  // Button Management System Implementation
  setButtonState: (buttonId: string, value: any) => {
    console.log(`[EditorStore] Setting button state: ${buttonId} =`, value);
    set(state => ({
      buttonStates: {
        ...state.buttonStates,
        [buttonId]: value
      }
    }));
  },
  
  getButtonState: (buttonId: string) => {
    const state = get();
    const value = state.buttonStates[buttonId];
    console.log(`[EditorStore] Getting button state: ${buttonId} =`, value);
    return value;
  },
  
  registerButtonAction: (buttonId: string, action: (value: any) => void) => {
    console.log(`[EditorStore] Registering button action: ${buttonId}`);
    set(state => ({
      buttonActions: {
        ...state.buttonActions,
        [buttonId]: action
      }
    }));
  },
  
  executeButtonAction: (buttonId: string, value?: any) => {
    const state = get();
    const action = state.buttonActions[buttonId];
    if (action) {
      console.log(`[EditorStore] Executing button action: ${buttonId} with value:`, value);
      action(value);
    } else {
      console.warn(`[EditorStore] No action registered for button: ${buttonId}`);
    }
  },

  // Backend Communication Implementation
  syncButtonState: async (buttonId: string) => {
    try {
      const state = get();
      if (state.buttonService) {
        const backendState = await state.buttonService.getButtonState(buttonId);
        if (backendState) {
          set(state => ({
            buttonStates: {
              ...state.buttonStates,
              [buttonId]: backendState.value
            }
          }));
          console.log(`[EditorStore] Synced button state from backend: ${buttonId} = ${backendState.value}`);
        }
      }
    } catch (error) {
      console.error(`[EditorStore] Failed to sync button state ${buttonId}:`, error);
    }
  },

  syncAllButtonStates: async () => {
    try {
      const state = get();
      if (state.buttonService) {
        const backendStates = await state.buttonService.getAllButtonStates();
        const newStates: { [key: string]: any } = {};
        
        backendStates.forEach((backendState: any) => {
          newStates[backendState.id] = backendState.value;
        });
        
        set(state => ({
          buttonStates: {
            ...state.buttonStates,
            ...newStates
          }
        }));
        
        console.log(`[EditorStore] Synced ${backendStates.length} button states from backend`);
      }
    } catch (error) {
      console.error('[EditorStore] Failed to sync all button states:', error);
    }
  },

  // Align tool setters
  setAlignMode: (mode) => {
    // Clear existing markers and frame widgets
    const { alignMarkers, alignFrameWidgets } = get();
    alignMarkers.forEach(marker => marker.dispose());
    alignFrameWidgets.forEach(widget => widget.dispose());
    set({ alignMode: mode, alignFirstPoint: null, alignMarkers: [], alignFrameWidgets: [] });
  },

  setAlignFirstPoint: (point) => {
    // When clearing the first point (restart), also clear markers and widgets
    if (point === null) {
      const { alignMarkers, alignFrameWidgets } = get();
      alignMarkers.forEach(marker => marker.dispose());
      alignFrameWidgets.forEach(widget => widget.dispose());
      set({ alignFirstPoint: null, alignMarkers: [], alignFrameWidgets: [] });
    } else {
      set({ alignFirstPoint: point });
    }
  },

  cancelAlignment: () => {
    // Clear markers and frame widgets when canceling
    const { alignMarkers, alignFrameWidgets } = get();
    alignMarkers.forEach(marker => marker.dispose());
    alignFrameWidgets.forEach(widget => widget.dispose());
    set({ alignMode: null, alignFirstPoint: null, alignMarkers: [], alignFrameWidgets: [] });
  },

  handleAlignClick: (pickInfo) => {
    const { alignMode, alignFirstPoint, alignMarkers, alignFrameWidgets } = get();

    if (!alignMode || !pickInfo.hit || !pickInfo.pickedMesh || !pickInfo.pickedPoint) {
      return;
    }

    const pickedMesh = pickInfo.pickedMesh as BABYLON.Mesh;
    const pickPoint = pickInfo.pickedPoint;

    // Ignore ground and grid overlay
    if (pickedMesh.name === 'ground' || pickedMesh.name === 'gridOverlay') {
      return;
    }

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // First click - select source vertex/edge/face/center
    if (!alignFirstPoint) {
      let firstPoint: { mesh: BABYLON.Mesh; position: BABYLON.Vector3; vertexIndex?: number; frame?: { xAxis: BABYLON.Vector3; yAxis: BABYLON.Vector3; zAxis: BABYLON.Vector3 } } | null = null;

      switch (alignMode) {
        case 'vertex': {
          // Find closest vertex
          const positions = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
          if (!positions) break;

          const worldMatrix = pickedMesh.computeWorldMatrix(true);
          let closestVertex: BABYLON.Vector3 | null = null;
          let closestDistance = Infinity;
          let closestIndex = -1;

          for (let i = 0; i < positions.length; i += 3) {
            const localVertex = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const worldVertex = BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix);
            const distance = BABYLON.Vector3.Distance(pickPoint, worldVertex);

            if (distance < closestDistance) {
              closestDistance = distance;
              closestVertex = worldVertex;
              closestIndex = i / 3;
            }
          }

          if (closestVertex) {
            // Create visual marker for first vertex (green)
            const marker = BABYLON.MeshBuilder.CreateSphere(
              'alignMarker1',
              { diameter: 0.05 },
              scene
            );
            marker.position = closestVertex.clone();
            const mat = new BABYLON.StandardMaterial('alignMarkerMat1', scene);
            mat.emissiveColor = new BABYLON.Color3(0, 1, 0); // Green
            mat.disableLighting = true;
            marker.material = mat;

            firstPoint = { mesh: pickedMesh, position: closestVertex, vertexIndex: closestIndex };
            set({ alignMarkers: [marker] });
            toast.info('First vertex selected. Click target vertex...');
          }
          break;
        }

        case 'center': {
          const worldPos = pickedMesh.getAbsolutePosition();
          const worldRotation = pickedMesh.rotationQuaternion || BABYLON.Quaternion.FromEulerAngles(
            pickedMesh.rotation.x,
            pickedMesh.rotation.y,
            pickedMesh.rotation.z
          );

          // Calculate frame axes from mesh rotation
          const rotMatrix = BABYLON.Matrix.Identity();
          worldRotation.toRotationMatrix(rotMatrix);
          const xAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Right(), rotMatrix);
          const yAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Up(), rotMatrix);
          const zAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Forward(), rotMatrix);

          // Create coordinate frame widget for first center
          const frameWidget = new CoordinateFrameWidget(scene);
          const registry = EntityRegistry.getInstance();
          const entity = registry.getByMesh(pickedMesh);
          const frame: CustomFrameFeature = {
            featureType: 'object',
            nodeId: entity?.getId() || 'temp',
            origin: babylonToUser(worldPos),
            xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
            yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
            zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z }
          };
          frameWidget.show(frame, 0.15); // 150mm axes

          firstPoint = { mesh: pickedMesh, position: worldPos, frame: { xAxis, yAxis, zAxis } };
          set({ alignFrameWidgets: [frameWidget] });
          toast.info('First center selected. Click target center...');
          break;
        }

        case 'edge': {
          // For edge alignment, find the two closest vertices to define the edge
          const positions = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
          if (!positions) break;

          const worldMatrix = pickedMesh.computeWorldMatrix(true);
          const vertices: BABYLON.Vector3[] = [];

          for (let i = 0; i < positions.length; i += 3) {
            const localVertex = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            vertices.push(BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix));
          }

          // Find two closest vertices to click point
          const sorted = vertices
            .map((v, i) => ({ v, d: BABYLON.Vector3.Distance(pickPoint, v), i }))
            .sort((a, b) => a.d - b.d);

          if (sorted.length >= 2) {
            const v1 = sorted[0].v;
            const v2 = sorted[1].v;
            const edgeCenter = v1.add(v2).scale(0.5);
            const edgeDir = v2.subtract(v1).normalize();

            // Create coordinate frame: Z along edge, X/Y perpendicular
            const zAxis = edgeDir;
            const xAxis = Math.abs(zAxis.y) < 0.9
              ? BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), zAxis).normalize()
              : BABYLON.Vector3.Cross(BABYLON.Vector3.Right(), zAxis).normalize();
            const yAxis = BABYLON.Vector3.Cross(zAxis, xAxis).normalize();

            const frameWidget = new CoordinateFrameWidget(scene);
            const registry = EntityRegistry.getInstance();
            const entity = registry.getByMesh(pickedMesh);
            const frame: CustomFrameFeature = {
              featureType: 'edge',
              nodeId: entity?.getId() || 'temp',
              origin: babylonToUser(edgeCenter),
              xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
              yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
              zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z }
            };
            frameWidget.show(frame, 0.15);

            firstPoint = { mesh: pickedMesh, position: edgeCenter, frame: { xAxis, yAxis, zAxis } };
            set({ alignFrameWidgets: [frameWidget] });
            toast.info('First edge selected. Click target edge...');
          }
          break;
        }

        case 'face': {
          // For face alignment, use the picked face normal from the ray
          if (!pickInfo.getNormal(true)) break;

          const faceNormal = pickInfo.getNormal(true)!.normalize();
          const faceCenter = pickPoint;

          // Create coordinate frame: Z along normal, X/Y in plane
          const zAxis = faceNormal;
          const xAxis = Math.abs(zAxis.y) < 0.9
            ? BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), zAxis).normalize()
            : BABYLON.Vector3.Cross(BABYLON.Vector3.Right(), zAxis).normalize();
          const yAxis = BABYLON.Vector3.Cross(zAxis, xAxis).normalize();

          const frameWidget = new CoordinateFrameWidget(scene);
          const registry = EntityRegistry.getInstance();
          const entity = registry.getByMesh(pickedMesh);
          const frame: CustomFrameFeature = {
            featureType: 'face',
            nodeId: entity?.getId() || 'temp',
            origin: babylonToUser(faceCenter),
            xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
            yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
            zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z }
          };
          frameWidget.show(frame, 0.15);

          firstPoint = { mesh: pickedMesh, position: faceCenter, frame: { xAxis, yAxis, zAxis } };
          set({ alignFrameWidgets: [frameWidget] });
          toast.info('First face selected. Click target face...');
          break;
        }

        default:
          toast.warning(`${alignMode} alignment not yet implemented`);
          get().cancelAlignment();
          return;
      }

      if (firstPoint) {
        set({ alignFirstPoint: firstPoint });
      }
      return;
    }

    // Second click - select target and perform alignment
    let targetPoint: BABYLON.Vector3 | null = null;

    switch (alignMode) {
      case 'vertex': {
        // Find closest vertex on target mesh
        const positions = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        if (!positions) break;

        const worldMatrix = pickedMesh.computeWorldMatrix(true);
        let closestVertex: BABYLON.Vector3 | null = null;
        let closestDistance = Infinity;

        for (let i = 0; i < positions.length; i += 3) {
          const localVertex = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
          const worldVertex = BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix);
          const distance = BABYLON.Vector3.Distance(pickPoint, worldVertex);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestVertex = worldVertex;
          }
        }

        if (closestVertex) {
          // Create visual marker for target vertex (blue)
          const marker = BABYLON.MeshBuilder.CreateSphere(
            'alignMarker2',
            { diameter: 0.05 },
            scene
          );
          marker.position = closestVertex.clone();
          const mat = new BABYLON.StandardMaterial('alignMarkerMat2', scene);
          mat.emissiveColor = new BABYLON.Color3(0, 0.5, 1); // Blue
          mat.disableLighting = true;
          marker.material = mat;

          set({ alignMarkers: [...alignMarkers, marker] });
          targetPoint = closestVertex;
        }
        break;
      }

      case 'edge': {
        // For edge alignment, find the two closest vertices to define the edge
        const positions = pickedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        if (!positions) break;

        const worldMatrix = pickedMesh.computeWorldMatrix(true);
        const vertices: BABYLON.Vector3[] = [];

        for (let i = 0; i < positions.length; i += 3) {
          const localVertex = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
          vertices.push(BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix));
        }

        // Find two closest vertices to click point
        const sorted = vertices
          .map((v, i) => ({ v, d: BABYLON.Vector3.Distance(pickPoint, v), i }))
          .sort((a, b) => a.d - b.d);

        if (sorted.length >= 2) {
          const v1 = sorted[0].v;
          const v2 = sorted[1].v;
          const edgeCenter = v1.add(v2).scale(0.5);
          const edgeDir = v2.subtract(v1).normalize();

          // Create coordinate frame: Z along edge, X/Y perpendicular
          const zAxis = edgeDir;
          const xAxis = Math.abs(zAxis.y) < 0.9
            ? BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), zAxis).normalize()
            : BABYLON.Vector3.Cross(BABYLON.Vector3.Right(), zAxis).normalize();
          const yAxis = BABYLON.Vector3.Cross(zAxis, xAxis).normalize();

          const frameWidget = new CoordinateFrameWidget(scene);
          const registry = EntityRegistry.getInstance();
          const entity = registry.getByMesh(pickedMesh);
          const frame: CustomFrameFeature = {
            featureType: 'edge',
            nodeId: entity?.getId() || 'temp',
            origin: babylonToUser(edgeCenter),
            xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
            yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
            zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z }
          };
          frameWidget.show(frame, 0.15);

          set({ alignFrameWidgets: [...alignFrameWidgets, frameWidget] });
          targetPoint = edgeCenter;
        }
        break;
      }

      case 'face': {
        // For face alignment, use the picked face normal from the ray
        if (!pickInfo.getNormal(true)) break;

        const faceNormal = pickInfo.getNormal(true)!.normalize();
        const faceCenter = pickPoint;

        // Create coordinate frame: Z along normal, X/Y in plane
        const zAxis = faceNormal;
        const xAxis = Math.abs(zAxis.y) < 0.9
          ? BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), zAxis).normalize()
          : BABYLON.Vector3.Cross(BABYLON.Vector3.Right(), zAxis).normalize();
        const yAxis = BABYLON.Vector3.Cross(zAxis, xAxis).normalize();

        const frameWidget = new CoordinateFrameWidget(scene);
        const registry = EntityRegistry.getInstance();
        const entity = registry.getByMesh(pickedMesh);
        const frame: CustomFrameFeature = {
          featureType: 'face',
          nodeId: entity?.getId() || 'temp',
          origin: babylonToUser(faceCenter),
          xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
          yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
          zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z }
        };
        frameWidget.show(frame, 0.15);

        set({ alignFrameWidgets: [...alignFrameWidgets, frameWidget] });
        targetPoint = faceCenter;
        break;
      }

      case 'center': {
        const worldPos = pickedMesh.getAbsolutePosition();
        const worldRotation = pickedMesh.rotationQuaternion || BABYLON.Quaternion.FromEulerAngles(
          pickedMesh.rotation.x,
          pickedMesh.rotation.y,
          pickedMesh.rotation.z
        );

        // Calculate frame axes from mesh rotation
        const rotMatrix = BABYLON.Matrix.Identity();
        worldRotation.toRotationMatrix(rotMatrix);
        const xAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Right(), rotMatrix);
        const yAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Up(), rotMatrix);
        const zAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Forward(), rotMatrix);

        // Create coordinate frame widget for target center
        const frameWidget = new CoordinateFrameWidget(scene);
        const registry = EntityRegistry.getInstance();
        const entity = registry.getByMesh(pickedMesh);
        const frame: CustomFrameFeature = {
          featureType: 'object',
          nodeId: entity?.getId() || 'temp',
          origin: babylonToUser(worldPos),
          xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
          yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
          zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z }
        };
        frameWidget.show(frame, 0.15); // 150mm axes

        set({ alignFrameWidgets: [...alignFrameWidgets, frameWidget] });
        targetPoint = worldPos;
        break;
      }
    }

    if (targetPoint) {
      // Calculate offset needed to align first point to target point
      const offset = targetPoint.subtract(alignFirstPoint.position);

      const meshToMove = alignFirstPoint.mesh;
      const registry = EntityRegistry.getInstance();
      const tree = SceneTreeManager.getInstance();

      // Check if this mesh belongs to a device entity
      const deviceEntity = registry.getDeviceByMesh(meshToMove);

      if (deviceEntity) {
        // Move the entire device by moving its root transform node
        const rootNode = deviceEntity.getRootTransformNode();
        if (rootNode) {
          rootNode.position.addInPlace(offset);

          // Update scene tree for the device root node
          const treeNode = tree.getNodeByEntityId(deviceEntity.getId());
          if (treeNode) {
            const newPos = babylonToUser(rootNode.position);
            tree.setLocalPosition(treeNode.id, newPos);
          }

          // Sync all child link entities to physics
          const linkEntities = deviceEntity.getChildren();
          linkEntities.forEach(linkEntity => {
            linkEntity.syncToPhysics();
          });

          toast.success(`Device ${alignMode} aligned successfully!`);
        }
      } else {
        // Regular mesh - move just this mesh
        meshToMove.position.addInPlace(offset);

        // Sync to scene tree and physics
        const node = tree.getNodeByBabylonMeshId(meshToMove.uniqueId.toString());
        if (node) {
          const newPos = babylonToUser(meshToMove.position);
          tree.setLocalPosition(node.id, newPos);

          // Sync to physics if entity exists
          if (node.entityId) {
            const entity = registry.get(node.entityId);
            entity?.syncToPhysics();
          }
        }

        toast.success(`${alignMode} aligned successfully!`);
      }

      window.dispatchEvent(new Event('scenetree-update'));
    }

    // Clear markers after a short delay to show the result
    setTimeout(() => {
      get().cancelAlignment();
    }, 1500);
  },

  // ============================================================================
  // Project Management Methods
  // ============================================================================

  createProject: async (config) => {
    const { projectManager } = get();
    const project = await projectManager.createProject(config);
    set({ currentProject: project });
    toast.success(`Project "${project.name}" created successfully`);
    return project;
  },

  loadProject: async (projectId) => {
    const { projectManager } = get();
    await projectManager.setCurrentProject(projectId);
    const project = projectManager.getCurrentProject();
    set({ 
      currentProject: project,
      assetInstances: project?.assetInstances || []
    });
    toast.success(`Project "${project?.name}" loaded successfully`);
  },

  saveProject: async (config) => {
    const { projectManager, currentProject } = get();
    if (!currentProject) {
      throw new Error('No project selected');
    }
    
    try {
      loading.start('Saving project...', 'processing');
      const save = await projectManager.saveProject(currentProject.id, config);
      loading.end();
      toast.success(`Project saved: "${save.name}"`);
      return save;
    } catch (error) {
      loading.end();
      console.error('Failed to save project:', error);
      toast.error('Failed to save project. Check console for details.');
      throw error;
    }
  },

  loadProjectSave: async (projectId, saveId) => {
    const { projectManager, worldLoader } = get();
    
    try {
      loading.start('Loading project save...', 'loading');
      await worldLoader.loadProjectSave(projectId, saveId);
      loading.end();
      
      // Update current project state
      const project = projectManager.getCurrentProject();
      set({ 
        currentProject: project,
        assetInstances: project?.assetInstances || []
      });
      
      toast.success('Project save loaded successfully');
      window.dispatchEvent(new Event('scenetree-update'));
    } catch (error) {
      loading.end();
      console.error('Failed to load project save:', error);
      toast.error('Failed to load project save. Check console for details.');
      throw error;
    }
  },

  exportCurrentWorldToProject: async (projectId, saveName) => {
    const { worldLoader } = get();
    
    try {
      loading.start('Exporting world to project...', 'processing');
      const save = await worldLoader.exportCurrentWorldToSave(projectId, saveName);
      loading.end();
      toast.success(`World exported to project save: "${save.name}"`);
      return save;
    } catch (error) {
      loading.end();
      console.error('Failed to export world to project:', error);
      toast.error('Failed to export world to project. Check console for details.');
      throw error;
    }
  },
}));
