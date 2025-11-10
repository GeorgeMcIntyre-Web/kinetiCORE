// Zustand store for editor state
// Owner: Edwin

import { create } from 'zustand';
import * as BABYLON from '@babylonjs/core';
import { TransformMode, CustomFrameFeature, CustomFrameFeatureType } from '../../core/types';
import { DEFAULT_TRANSFORM_MODE } from '../../core/constants';
import { SceneManager } from '../../scene/SceneManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SnappingHelper } from '../../manipulation/SnappingHelper';
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
type SnapMode = 'point-to-point' | 'frame-to-frame';

interface SnapPoint {
  x: number;
  y: number;
  z: number;
}

interface SnapFrameObject {
  nodeId: string; // Scene tree node ID
  mesh: BABYLON.Mesh | BABYLON.TransformNode; // The actual frame object
  name: string; // Display name
}

interface EditorState {
  // State
  selectedMeshes: BABYLON.Mesh[];
  selectedNodeId: string | null;
  selectedNodeIds: string[]; // Multi-selection support
  selectedCollectionNodeId: string | null; // For collection node selection
  selectedCollectionTransformNode: BABYLON.TransformNode | null; // Babylon TransformNode for collection
  transformMode: TransformMode;
  transformGizmoEnabled: boolean;
  setTransformGizmoEnabled: (enabled: boolean) => void;
  camera: BABYLON.Camera | null;
  isPlaying: boolean;
  customFrameSelectionMode: 'none' | CustomFrameFeatureType;
  customFrame: CustomFrameFeature | null;
  coordinateFrameWidget: CoordinateFrameWidget | null;
  commandManager: CommandManager;
  panelLayout: any | null; // Dockview panel layout state
  
  // Visualization overlays (Motion Panel)
  skeletonEnabled: boolean;
  skeletonStyle: 'cylinder' | 'tube' | 'line' | 'bone';
  skeletonThicknessMm: number; // visual thickness in mm
  skeletonAnimationSpeed: number; // 0.1 - 3.0 UI range
  skeletonHighlightActiveJoint: boolean;
  showCoordinateOverlay: boolean; // Corner XYZ compass
  showJointAxesOverlay: boolean; // Per-joint axis debug frames
  showLinkLengthLabels: boolean;
  showOrientationLabels: boolean;

  // Feature flags
  editableKinematicsFlag: boolean;

  // Edit mode state
  editModeEnabled: boolean;
  attachedJointId: string | null;
  
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

  // Selection level state
  selectionLevel: 'object' | 'component' | 'mesh';
  setSelectionLevel: (level: 'object' | 'component' | 'mesh') => void;

  // Snap dialog state
  snapMode: SnapMode;
  snapFromPoint: SnapPoint;
  snapToPoint: SnapPoint;
  isPickingSnapPoint: 'from' | 'to' | null; // Track which point is being picked
  snapFromFrame: { rootNode: BABYLON.TransformNode; originPoint: BABYLON.Vector3; baseSize: number } | null; // Visual frame at "from" point
  snapToFrame: { rootNode: BABYLON.TransformNode; originPoint: BABYLON.Vector3; baseSize: number } | null; // Visual frame at "to" point
  // Frame-to-frame snapping state
  snapFromFrameObject: SnapFrameObject | null; // Source frame object for frame-to-frame snapping
  snapToFrameObject: SnapFrameObject | null; // Target frame object for frame-to-frame snapping
  isPickingSnapFrame: 'from' | 'to' | null; // Track which frame is being picked
  savedSelectionDuringFramePick: { nodeId: string | null; meshes: BABYLON.Mesh[] } | null; // Preserve selection during frame picking
  setSnapMode: (mode: SnapMode) => void;
  setSnapFromPoint: (point: SnapPoint) => void;
  setSnapToPoint: (point: SnapPoint) => void;
  setIsPickingSnapPoint: (mode: 'from' | 'to' | null) => void;
  setSnapFromFrameObject: (frame: SnapFrameObject | null) => void;
  setSnapToFrameObject: (frame: SnapFrameObject | null) => void;
  setIsPickingSnapFrame: (mode: 'from' | 'to' | null) => void;
  applySnapSettings: (settings: { mode?: SnapMode; from?: SnapPoint; to?: SnapPoint }) => void;
  clearSnapFrames: () => void; // Clear temporary snap frames

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

  // Point pick state - visual axis frames at clicked points
  pointPickMode: boolean;
  pointPickMarkers: BABYLON.Mesh[];
  pointPickFrameWidgets: CoordinateFrameWidget[];
  pointPickFrameData: { pickPoint: BABYLON.Vector3; frame: CustomFrameFeature; baseSize: number } | null;

  // Snap tool state - two-click snap: first point (source), second point (target)
  snapToolActive: boolean;
  snapFirstPoint: {
    mesh: BABYLON.Mesh;
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion; // Orientation at the clicked point
  } | null;

  // Object origin frame state - visual axis frame at selected object's origin
  objectOriginFrameWidget: CoordinateFrameWidget | null;
  objectOriginFrameData: { originPoint: BABYLON.Vector3; frame: CustomFrameFeature; baseSize: number } | null;

  // Permanent frames state - frames that persist in the scene with dynamic scaling
  permanentFrames: Array<{ rootNode: BABYLON.TransformNode; originPoint: BABYLON.Vector3; baseSize: number }>;

  // Last picked point - for coordinate display
  lastPickedPoint: BABYLON.Vector3 | null;
  setLastPickedPoint: (point: BABYLON.Vector3 | null) => void;

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
  zoomIn: () => void; // Zoom camera in
  zoomOut: () => void; // Zoom camera out
  toggleCameraMode: () => void; // Toggle between orthographic and perspective
  toggleInspector: () => void; // Toggle Babylon.js inspector
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

  // Visualization overlay setters
  setSkeletonEnabled: (enabled: boolean) => void;
  setSkeletonStyle: (style: 'cylinder' | 'tube' | 'line') => void;
  setSkeletonThicknessMm: (mm: number) => void;
  setSkeletonAnimationSpeed: (speed: number) => void;
  setSkeletonHighlightActiveJoint: (enabled: boolean) => void;
  setShowCoordinateOverlay: (visible: boolean) => void;
  setShowJointAxesOverlay: (visible: boolean) => void;
  setShowLinkLengthLabels: (visible: boolean) => void;
  setShowOrientationLabels: (visible: boolean) => void;

  // Feature flags setters
  setEditableKinematicsFlag: (enabled: boolean) => void;

  // Edit mode actions
  setEditModeEnabled: (enabled: boolean) => void;
  attachJoint: (jointId: string | null) => void;

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

  // Snap tool actions
  setSnapToolActive: (enabled: boolean) => void;
  setSnapFirstPoint: (point: {
    mesh: BABYLON.Mesh;
    position: BABYLON.Vector3;
    rotation: BABYLON.Quaternion;
  } | null) => void;
  handleSnapClick: (pickInfo: BABYLON.PickingInfo) => void;
  cancelSnap: () => void;

  // Point pick actions
  setPointPickMode: (enabled: boolean) => void;
  handlePointPick: (pickInfo: BABYLON.PickingInfo) => void;
  clearPointPickMarkers: () => void;
  showObjectOriginFrame: (mesh: BABYLON.Mesh | BABYLON.TransformNode) => void;
  clearObjectOriginFrame: () => void;
  addPermanentFrame: () => void;
  cleanupDisposedFrames: () => void;

  // URDF loading helper
  loadURDFWithMeshes: (urdfFile: File, meshFiles: File[], scene: BABYLON.Scene, tree: any, assetsNode: any, registry: any) => Promise<void>;
}

/**
 * Helper function to create a standard coordinate frame for snap points
 * Uses the same visual style as the "Add Frame" button
 * Returns an object with rootNode, originPoint, and baseSize for dynamic scaling
 */
const createSnapFrame = (
  scene: BABYLON.Scene,
  position: BABYLON.Vector3,
  name: string,
  _color: BABYLON.Color3 // Unused - we use standard RGB colors for XYZ
): { rootNode: BABYLON.TransformNode; originPoint: BABYLON.Vector3; baseSize: number } => {
  const frameRoot = new BABYLON.TransformNode(name, scene);
  frameRoot.position = position;

  // Standard axis vectors
  const xAxis = new BABYLON.Vector3(1, 0, 0);
  const yAxis = new BABYLON.Vector3(0, 1, 0);
  const zAxis = new BABYLON.Vector3(0, 0, 1);

  const axisLength = 0.05; // Small frame size (5cm)

  // Create axis line
  const createAxisLine = (start: BABYLON.Vector3, end: BABYLON.Vector3, color: BABYLON.Color3, lineName: string) => {
    const line = BABYLON.MeshBuilder.CreateLines(lineName, { points: [start, end] }, scene);
    line.color = color;
    line.isPickable = false;
    line.parent = frameRoot;
    return line;
  };

  // Create arrow head at end of axis
  const createArrowHead = (position: BABYLON.Vector3, direction: BABYLON.Vector3, color: BABYLON.Color3, arrowName: string) => {
    const cone = BABYLON.MeshBuilder.CreateCylinder(
      arrowName,
      { height: 0.008, diameterTop: 0, diameterBottom: 0.004, tessellation: 8 },
      scene
    );

    cone.position = position;

    const up = new BABYLON.Vector3(0, 1, 0);
    const angle = Math.acos(BABYLON.Vector3.Dot(up, direction));
    const axis = BABYLON.Vector3.Cross(up, direction);
    if (axis.length() > 0.0001) {
      cone.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
    }

    const mat = new BABYLON.StandardMaterial(`${arrowName}_mat`, scene);
    mat.diffuseColor = color;
    mat.emissiveColor = color;
    mat.disableLighting = true;
    cone.material = mat;
    cone.isPickable = false;
    cone.parent = frameRoot;
    return cone;
  };

  // Create text label
  const createLabel = (position: BABYLON.Vector3, text: string, color: BABYLON.Color3, labelName: string) => {
    const plane = BABYLON.MeshBuilder.CreatePlane(labelName, { size: 0.025 }, scene);
    plane.position = position;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const dynamicTexture = new BABYLON.DynamicTexture(
      `${labelName}_texture`,
      { width: 256, height: 256 },
      scene,
      false
    );

    dynamicTexture.drawText(
      text,
      null,
      null,
      'bold 180px Arial',
      `rgb(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)})`,
      'transparent',
      true,
      true
    );

    const material = new BABYLON.StandardMaterial(`${labelName}_mat`, scene);
    material.diffuseTexture = dynamicTexture;
    material.emissiveColor = color;
    material.disableLighting = true;
    material.opacityTexture = dynamicTexture;
    material.backFaceCulling = false;

    plane.material = material;
    plane.isPickable = false;
    plane.parent = frameRoot;
    return plane;
  };

  // Create X axis (red)
  createAxisLine(BABYLON.Vector3.Zero(), xAxis.scale(axisLength), new BABYLON.Color3(1, 0, 0), `${name}_X_axis`);
  createArrowHead(xAxis.scale(axisLength), xAxis, new BABYLON.Color3(1, 0, 0), `${name}_X_arrow`);
  createLabel(xAxis.scale(axisLength * 1.2), 'X', new BABYLON.Color3(1, 0, 0), `${name}_X_label`);

  // Create Y axis (green)
  createAxisLine(BABYLON.Vector3.Zero(), yAxis.scale(axisLength), new BABYLON.Color3(0, 1, 0), `${name}_Y_axis`);
  createArrowHead(yAxis.scale(axisLength), yAxis, new BABYLON.Color3(0, 1, 0), `${name}_Y_arrow`);
  createLabel(yAxis.scale(axisLength * 1.2), 'Y', new BABYLON.Color3(0, 1, 0), `${name}_Y_label`);

  // Create Z axis (blue)
  createAxisLine(BABYLON.Vector3.Zero(), zAxis.scale(axisLength), new BABYLON.Color3(0, 0, 1), `${name}_Z_axis`);
  createArrowHead(zAxis.scale(axisLength), zAxis, new BABYLON.Color3(0, 0, 1), `${name}_Z_arrow`);
  createLabel(zAxis.scale(axisLength * 1.2), 'Z', new BABYLON.Color3(0, 0, 1), `${name}_Z_label`);

  // Apply camera-based scaling
  const BASE_SIZE = 0.05;
  const camera = scene.activeCamera;
  let initialScale = 1.0;
  if (camera) {
    const distanceToPoint = BABYLON.Vector3.Distance(camera.position, position);
    let frameSize = distanceToPoint * 0.08; // Slightly smaller multiplier for snap frames
    const MIN_SIZE = 0.03;
    const MAX_SIZE = 0.15;
    frameSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, frameSize));
    initialScale = frameSize / BASE_SIZE;
  }

  frameRoot.scaling = new BABYLON.Vector3(initialScale, initialScale, initialScale);

  // Return object with same structure as permanent frames
  return {
    rootNode: frameRoot,
    originPoint: position.clone(),
    baseSize: BASE_SIZE
  };
};

export const useEditorStore = create<EditorState>((set, get) => {
  const normalizeNodeId = (nodeId: string): string => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);

    if (node && node.type === 'mesh' && node.name.endsWith('_device_root') && node.parentId) {
      const parentNode = tree.getNode(node.parentId);
      if (parentNode && parentNode.type === 'collection') {
        return parentNode.id;
      }
    }

    return nodeId;
  };

  const updateSelectionVisuals = (nodeIds: string[]): void => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const tree = SceneTreeManager.getInstance();
    const state = get();
    const coordinateFrameWidget = state.coordinateFrameWidget;

    if (nodeIds.length === 0 || !scene) {
      set({
        selectedMeshes: [],
        selectedCollectionNodeId: null,
        selectedCollectionTransformNode: null,
      });

      if (coordinateFrameWidget && !state.customFrame) {
        coordinateFrameWidget.hide();
      }

      if (nodeIds.length === 0) {
        sceneManager.resetClippingPlanes();
      }
      return;
    }

    const primaryNodeId = nodeIds[nodeIds.length - 1];
    const node = tree.getNode(primaryNodeId);

    if (!node) {
      console.warn('[EditorStore] Node not found for selection:', primaryNodeId);
      return;
    }

    // Update selected meshes array for gizmo and inspector
    const newSelectedMeshes: BABYLON.Mesh[] = [];

    const addMeshAndChildren = (mesh: BABYLON.Mesh | BABYLON.TransformNode) => {
      if (mesh instanceof BABYLON.Mesh) {
        newSelectedMeshes.push(mesh);
      }
      mesh.getChildMeshes(false).forEach((child) => {
        if (child instanceof BABYLON.Mesh) {
          newSelectedMeshes.push(child);
        }
      });
    };

    if (node.type === 'mesh' && node.babylonMeshId) {
      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
      if (mesh) {
        addMeshAndChildren(mesh);
        sceneManager.adjustClippingPlanesForObject(mesh);
      } else {
        console.warn('[EditorStore] Mesh not found for node:', node.name);
      }
    } else if (node.type === 'collection') {
      // For collections, select all visible child meshes
      // Get all descendant nodes and find their meshes
      const getAllDescendants = (nodeId: string): string[] => {
        const descendants: string[] = [];
        const traverse = (id: string) => {
          const n = tree.getNode(id);
          if (!n) return;
          descendants.push(id);
          n.childIds.forEach((childId: string) => traverse(childId));
        };
        traverse(nodeId);
        return descendants;
      };
      
      const descendantIds = getAllDescendants(node.id);
      descendantIds.forEach((nodeId: string) => {
        const descendantNode = tree.getNode(nodeId);
        if (descendantNode?.babylonMeshId) {
          const mesh = scene.getMeshByUniqueId(parseInt(descendantNode.babylonMeshId, 10));
          if (mesh) {
            addMeshAndChildren(mesh);
          }
        }
      });
      sceneManager.adjustClippingPlanesForObject(newSelectedMeshes[0] || null);
    }

    set({
      selectedMeshes: newSelectedMeshes,
      selectedCollectionNodeId: node.type === 'collection' ? node.id : null,
      selectedCollectionTransformNode: node.type === 'collection' ? scene.getTransformNodeByUniqueId(node.babylonTransformNodeId ? parseInt(node.babylonTransformNodeId, 10) : -1) || null : null,
    });

    // Update coordinate frame widget unless a custom frame is active
    if (coordinateFrameWidget && !state.customFrame) {
      if (newSelectedMeshes.length === 1) {
        const mesh = newSelectedMeshes[0];
        const meshWorldMatrix = mesh.getWorldMatrix();
        const origin = mesh.getAbsolutePosition();
        const xAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Right(), meshWorldMatrix).normalize();
        const yAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Up(), meshWorldMatrix).normalize();
        const zAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Forward(), meshWorldMatrix).normalize();

        coordinateFrameWidget.show(
          {
            featureType: 'object',
            nodeId: node.id,
            origin: babylonToUser(origin),
            xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
            yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
            zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z },
          },
          0.1
        );
      } else {
        coordinateFrameWidget.hide();
      }
    }

    // Update entity selection state
    // Note: Entity selection is handled through mesh selection
    // The entity registry doesn't have a setSelected method
  };

  return {
  // Initial state
  selectedMeshes: [],
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedCollectionNodeId: null,
  selectedCollectionTransformNode: null,
  transformMode: DEFAULT_TRANSFORM_MODE,
  transformGizmoEnabled: true, // Enable by default so gizmo appears on selection
  setTransformGizmoEnabled: (enabled) => set({ transformGizmoEnabled: enabled }),
  camera: null,
  isPlaying: false,
  customFrameSelectionMode: 'none',
  customFrame: null,
  coordinateFrameWidget: null,
  commandManager: new CommandManager(),
  panelLayout: null,

  // Visualization overlays defaults
  skeletonEnabled: true, // Default ON for testing visibility (user can toggle off)
  skeletonStyle: 'bone', // Use bone style by default
  skeletonThicknessMm: 20, // Thicker bones for visibility (20mm)
  skeletonAnimationSpeed: 1.0,
  skeletonHighlightActiveJoint: true,
  showCoordinateOverlay: true, // preserve existing behavior
  showJointAxesOverlay: true, // Default ON for testing (shows skeleton via joint debug frames)
  showLinkLengthLabels: false,
  showOrientationLabels: false,

  // Feature flags
  editableKinematicsFlag: true, // Edit Mode enabled for Editable Kinematics prototype

  // Edit mode state
  editModeEnabled: false,
  attachedJointId: null,

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

  // Selection level defaults
  selectionLevel: 'mesh',
  setSelectionLevel: (level) => set({ selectionLevel: level }),

  // Snap dialog defaults
  snapMode: 'point-to-point',
  snapFromPoint: { x: 0, y: 0, z: 0 },
  snapToPoint: { x: 0, y: 0, z: 0 },
  isPickingSnapPoint: null,
  snapFromFrame: null,
  snapToFrame: null,
  snapFromFrameObject: null,
  snapToFrameObject: null,
  isPickingSnapFrame: null,
  savedSelectionDuringFramePick: null,
  setSnapMode: (mode) => set({ snapMode: mode }),
  setSnapFromPoint: (point) => {
    // Clear previous "from" frame
    const { snapFromFrame } = get();
    if (snapFromFrame) {
      snapFromFrame.rootNode.dispose();
    }

    // Only create frame if point is not at origin (0,0,0)
    const isZero = point.x === 0 && point.y === 0 && point.z === 0;
    if (!isZero) {
      const scene = SceneManager.getInstance().getScene();
      if (scene) {
        const framePosition = userToBabylon(new BABYLON.Vector3(point.x, point.y, point.z));
        const frame = createSnapFrame(scene, framePosition, 'snapFrom', new BABYLON.Color3(1, 0, 0)); // Red for "from"
        set({ snapFromPoint: point, snapFromFrame: frame });
        return;
      }
    }

    set({ snapFromPoint: point, snapFromFrame: null });
  },
  setSnapToPoint: (point) => {
    // Clear previous "to" frame
    const { snapToFrame } = get();
    if (snapToFrame) {
      snapToFrame.rootNode.dispose();
    }

    // Only create frame if point is not at origin (0,0,0)
    const isZero = point.x === 0 && point.y === 0 && point.z === 0;
    if (!isZero) {
      const scene = SceneManager.getInstance().getScene();
      if (scene) {
        const framePosition = userToBabylon(new BABYLON.Vector3(point.x, point.y, point.z));
        const frame = createSnapFrame(scene, framePosition, 'snapTo', new BABYLON.Color3(0, 1, 0)); // Green for "to"
        set({ snapToPoint: point, snapToFrame: frame });
        return;
      }
    }

    set({ snapToPoint: point, snapToFrame: null });
  },
  setIsPickingSnapPoint: (mode) => set({ isPickingSnapPoint: mode }),
  setSnapFromFrameObject: (frame) => set({ snapFromFrameObject: frame }),
  setSnapToFrameObject: (frame) => set({ snapToFrameObject: frame }),
  setIsPickingSnapFrame: (mode) => {
    const state = get();

    // When starting frame picking, save the current selection to preserve it
    if (mode === 'from' && !state.savedSelectionDuringFramePick) {
      set({
        isPickingSnapFrame: mode,
        savedSelectionDuringFramePick: {
          nodeId: state.selectedNodeId,
          meshes: [...state.selectedMeshes], // Copy array
        },
      });
    }
    // When finishing/canceling frame picking, restore saved selection
    else if (mode === null && state.savedSelectionDuringFramePick) {
      const savedSelection = state.savedSelectionDuringFramePick;

      // Restore the selection
      set({
        isPickingSnapFrame: mode,
        savedSelectionDuringFramePick: null,
        selectedNodeId: savedSelection.nodeId,
        selectedMeshes: savedSelection.meshes,
      });

      // Update mesh selection states (highlight/gizmos)
      savedSelection.meshes.forEach(mesh => {
        if (mesh.metadata) {
          mesh.metadata.isSelected = true;
        }
      });
    }
    // When finishing without saved selection (shouldn't happen, but handle gracefully)
    else if (mode === null) {
      set({
        isPickingSnapFrame: mode,
        savedSelectionDuringFramePick: null,
      });
    }
    // For 'to' mode, just update the picking mode without changing saved selection
    else {
      set({ isPickingSnapFrame: mode });
    }
  },
  clearSnapFrames: () => {
    const { snapFromFrame, snapToFrame } = get();
    if (snapFromFrame) {
      snapFromFrame.rootNode.dispose();
    }
    if (snapToFrame) {
      snapToFrame.rootNode.dispose();
    }
    set({ snapFromFrame: null, snapToFrame: null });
  },
  applySnapSettings: (settings) => {
    const { snapMode, snapFromPoint, snapToPoint, selectedMeshes, snapFromFrame, snapToFrame, snapFromFrameObject, snapToFrameObject } = get();
    const nextMode = settings.mode ?? snapMode;
    const nextFrom = settings.from ?? snapFromPoint;
    const nextTo = settings.to ?? snapToPoint;

    set({
      snapMode: nextMode,
      snapFromPoint: nextFrom,
      snapToPoint: nextTo,
    });

    // Apply point-to-point transformation if both points are set and object is selected
    if (selectedMeshes.length > 0 && nextMode === 'point-to-point') {
      const mesh = selectedMeshes[0];

      // Convert from user coordinates (mm) to Babylon (meters, Y-up)
      const fromPointBabylon = userToBabylon(new BABYLON.Vector3(nextFrom.x, nextFrom.y, nextFrom.z));
      const toPointBabylon = userToBabylon(new BABYLON.Vector3(nextTo.x, nextTo.y, nextTo.z));

      // Calculate translation vector
      const translation = toPointBabylon.subtract(fromPointBabylon);

      // Apply translation to mesh
      mesh.position.addInPlace(translation);

      // Auto-clear snap frames after successful snap (keep points for reference)
      if (snapFromFrame) {
        snapFromFrame.rootNode.dispose();
      }
      if (snapToFrame) {
        snapToFrame.rootNode.dispose();
      }
      set({ snapFromFrame: null, snapToFrame: null });

      toast.success('Object snapped! Ready for next snap.');
    }
    // Apply frame-to-frame transformation if both frames are set and object is selected
    else if (selectedMeshes.length > 0 && nextMode === 'frame-to-frame' && snapFromFrameObject && snapToFrameObject) {
      const mesh = selectedMeshes[0];
      const fromFrameMesh = snapFromFrameObject.mesh;
      const toFrameMesh = snapToFrameObject.mesh;

      // Ensure world matrices are up to date
      fromFrameMesh.computeWorldMatrix(true);
      toFrameMesh.computeWorldMatrix(true);
      mesh.computeWorldMatrix(true);

      // Get the world transformation matrices
      const fromFrameWorldMatrix = fromFrameMesh.getWorldMatrix();
      const toFrameWorldMatrix = toFrameMesh.getWorldMatrix();

      // Calculate the inverse of the "from" frame for relative transformation
      const fromFrameInverse = BABYLON.Matrix.Invert(fromFrameWorldMatrix);

      // Get the current object's world matrix
      const objectWorldMatrix = mesh.getWorldMatrix();

      // Calculate object's pose relative to "from" frame
      // T_obj_relative = inv(T_from) * T_obj
      const objectRelativeToFrom = fromFrameInverse.multiply(objectWorldMatrix);

      // Apply same relative pose to "to" frame
      // T_obj_new = T_to * T_obj_relative
      const newWorldMatrix = toFrameWorldMatrix.multiply(objectRelativeToFrom);

      // Decompose the new world matrix to get position, rotation, and scale
      const newPosition = new BABYLON.Vector3();
      const newRotation = new BABYLON.Quaternion();
      const newScale = new BABYLON.Vector3();
      newWorldMatrix.decompose(newScale, newRotation, newPosition);

      // Apply the new transformation to the mesh
      // Need to handle parent transformations if mesh has a parent
      if (mesh.parent) {
        // If mesh has a parent, we need to convert world transform to local transform
        const parentWorldMatrix = mesh.parent.getWorldMatrix();
        const parentInverse = BABYLON.Matrix.Invert(parentWorldMatrix);
        const localMatrix = parentInverse.multiply(newWorldMatrix);

        const localPosition = new BABYLON.Vector3();
        const localRotation = new BABYLON.Quaternion();
        const localScale = new BABYLON.Vector3();
        localMatrix.decompose(localScale, localRotation, localPosition);

        mesh.position = localPosition;
        mesh.rotationQuaternion = localRotation;
        mesh.scaling = localScale;
      } else {
        // No parent, directly set world transform
        mesh.position = newPosition;
        mesh.rotationQuaternion = newRotation;
        mesh.scaling = newScale;
      }

      toast.success('Object transformed to target frame!');
    }
    else {
      toast.success('Snap settings updated');
    }
  },
  
  // File system state defaults
  lastUsedDirectory: null,
  setLastUsedDirectory: (directory) => set({ lastUsedDirectory: directory }),

  // Transform settings defaults
  positionIncrement: 10, // 10mm default
  rotationIncrement: 15, // 15 degrees default
  snapEnabled: true, // Enable snapping by default
  snapToGrid: false, // Grid snapping off by default (can be toggled)
  // Smart Snap Selector: Most useful snap types enabled by default
  snapToVertex: true,
  snapToEdge: false, // Disabled by default - less useful than vertex/midpoint/intersection
  snapToFace: true,
  snapToCenter: true,
  snapToObject: true,
  snapToMidpoint: true,
  snapToIntersection: true,
  snapToPerpendicular: false, // Advanced snap types off by default
  snapToTangent: false,
  snapAlong: false,
  snapToNormal: false, // Disabled by default - rarely used, can interfere with other snaps
  snapToPlane: false,
  snapToAxis: false,
  snapToCurve: false,
  snapToSurface: false,
  snapObjectToVertex: false,
  snapPointOnEdge: false,
  snapBBoxCorner: true,
  gridSize: 100, // 100mm grid
  snapDistance: 0.1, // 0.1mm snap threshold (CAD standard)
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

  // Snap tool defaults
  snapToolActive: false,
  snapFirstPoint: null,

  // Point pick defaults
  pointPickMode: true,
  pointPickMarkers: [],
  pointPickFrameWidgets: [],
  pointPickFrameData: null,

  // Object origin frame defaults
  objectOriginFrameWidget: null,
  objectOriginFrameData: null,

  // Permanent frames defaults
  permanentFrames: [],

  // Last picked point defaults
  lastPickedPoint: null,
  setLastPickedPoint: (point) => set({ lastPickedPoint: point }),

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
    const { selectedMeshes, selectionLevel } = get();
    if (!selectedMeshes.includes(mesh)) {
      set({ selectedMeshes: [...selectedMeshes, mesh] });

      const tree = SceneTreeManager.getInstance();

      // Check if this is a device root mesh (ending in _device_root)
      if (mesh.name.endsWith('_device_root')) {
        console.log(`[EditorStore] Device root mesh selected: ${mesh.name}`);

        // Device root meshes are skipped in tree building, so they don't have tree nodes
        // Strategy: Find the model collection by looking up the device entity
        const registry = EntityRegistry.getInstance();
        const entity = registry.getByMesh(mesh);

        if (entity && entity.getIsDevice()) {
          // This is a device entity - find its model collection in the tree
          // The entity ID should be linked to the model collection node
          const allNodes = tree.getAllNodes();
          const modelCollectionNode = allNodes.find(node =>
            node.entityId === entity.getId() && node.type === 'collection'
          );

          if (modelCollectionNode) {
            console.log(`[EditorStore] Found model collection via entity: ${modelCollectionNode.name}`);
            set({ selectedNodeId: modelCollectionNode.id, selectedNodeIds: [modelCollectionNode.id] });
            tree.expandToNode(modelCollectionNode.id);
            window.dispatchEvent(new Event('scenetree-update'));
            return;
          } else {
            console.warn(`[EditorStore] No model collection found for device entity: ${entity.getId()}`);
          }
        } else {
          console.warn(`[EditorStore] Device root mesh has no entity or not a device: ${mesh.name}`);
        }
      }

      // For all other meshes, select corresponding node in tree
      const node = tree.getNodeByBabylonMeshId(mesh.uniqueId.toString());
      if (node) {
        console.log(`[EditorStore] Selecting mesh node: ${node.name}`);
        set({ selectedNodeId: node.id, selectedNodeIds: [node.id] });
        // Expand tree to reveal the selected node
        tree.expandToNode(node.id);
        window.dispatchEvent(new Event('scenetree-update'));
      } else {
        console.warn(`[EditorStore] No tree node found for mesh: ${mesh.name}`);
      }

      if (selectionLevel === 'object') {
        get().showObjectOriginFrame(mesh);
      }
    }
  },

  selectNode: (nodeId) => {
    const normalizedId = normalizeNodeId(nodeId);

    // Check if we're in frame picking mode (for frame-to-frame snapping)
    const { isPickingSnapFrame } = get();
    if (isPickingSnapFrame) {
      const tree = SceneTreeManager.getInstance();
      const node = tree.getNode(normalizedId);
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();

      console.log('[Frame Picking from Tree] Selected node:', node?.name);

      if (node && scene) {
        // Get the mesh for this node
        let mesh: BABYLON.AbstractMesh | null = null;
        const registry = EntityRegistry.getInstance();

        // Prefer entity mesh if available
        if (node.entityId) {
          const entity = registry.get(node.entityId);
          if (entity && typeof entity.getMesh === 'function') {
            mesh = entity.getMesh();
            console.log('[Frame Picking from Tree] Found mesh from entity:', mesh?.name);
          }
        }

        // Fallback to babylonMeshId
        if (!mesh && node.babylonMeshId) {
          mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
          console.log('[Frame Picking from Tree] Found mesh from babylonMeshId:', mesh?.name);
        }

        // Fallback to TransformNode children
        if (!mesh && node.babylonTransformNodeId) {
          const transformNode = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId, 10));
          if (transformNode) {
            const children = transformNode.getChildren();
            console.log('[Frame Picking from Tree] TransformNode has', children.length, 'children');
            for (const child of children) {
              if (child instanceof BABYLON.AbstractMesh) {
                mesh = child;
                console.log('[Frame Picking from Tree] Found mesh from TransformNode child:', mesh.name);
                break;
              }
            }
          }
        }

        if (mesh && node) {
          const frameObject = {
            nodeId: node.id,
            mesh: mesh,
            name: node.name
          };

          console.log('[Frame Picking from Tree] ✅ Frame found:', frameObject.name);

          // Update the appropriate snap frame
          if (isPickingSnapFrame === 'from') {
            get().setSnapFromFrameObject(frameObject);
            get().setIsPickingSnapFrame('to');
            toast.success(`From frame set: ${node.name}. Now select the "To" frame.`);
          } else {
            get().setSnapToFrameObject(frameObject);
            get().setIsPickingSnapFrame(null);

            // Get current snap frame objects
            const state = get();
            const fromFrame = state.snapFromFrameObject;
            const toFrame = frameObject;

            if (fromFrame) {
              // Apply frame-to-frame snap transformation
              get().applySnapSettings({
                mode: 'frame-to-frame',
              });

              toast.success(`Object snapped from "${fromFrame.name}" to "${toFrame.name}"!`);
            }
          }

          return; // Exit early, don't process as normal selection
        } else {
          console.log('[Frame Picking from Tree] ❌ No mesh found for node');
          toast.error('Selected node has no mesh. Please select a frame object with geometry.');
          return; // Exit early
        }
      }
    }

    // Normal selection flow continues below
    set({ selectedNodeId: normalizedId, selectedNodeIds: [normalizedId] });

    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(normalizedId);
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

    // Auto-expand tree to show selected node
    tree.expandToNode(normalizedId);
    window.dispatchEvent(new Event('scenetree-update'));

    // If it's a collection/TransformNode, show coordinate frame at its origin
    if (node && node.type === 'collection' && scene) {
      let transformNode: BABYLON.TransformNode | undefined;
      
      // Use uniqueId lookup first for reliability (canonical field)
      if (node.babylonTransformNodeId) {
        const uniqueId = parseInt(node.babylonTransformNodeId, 10);
        const foundNode = scene.getTransformNodeByUniqueId(uniqueId);
        transformNode = foundNode ? foundNode : undefined;
      } else if ((node as any).babylonNodeId) {
        // Backward compatibility with older saves that used `babylonNodeId`
        const legacyId = parseInt((node as any).babylonNodeId, 10);
        const foundNode = scene.getTransformNodeByUniqueId(legacyId);
        transformNode = foundNode ? foundNode : undefined;
      } else {
        // Final fallback: name lookup (may be ambiguous if names repeat)
        transformNode = scene.transformNodes.find(tn => tn.name === node.name);
      }
      
      if (transformNode) {
        // For collection nodes, we need to trigger gizmo activation
        // by setting a special flag that SceneCanvas can detect
        // Clear any existing mesh selection to avoid conflicts
        // Collect all descendant meshes for highlight
        const meshes: BABYLON.Mesh[] = [];
        const registry = EntityRegistry.getInstance();
        const collectMeshes = (nid: string) => {
          const n = tree.getNode(nid);
          if (!n) return;
          // Prefer entity mesh if available
          if (n.entityId) {
            const ent = registry.get(n.entityId);
            if (ent && typeof ent.getMesh === 'function') {
              const m = ent.getMesh();
              if (m && m instanceof BABYLON.Mesh && m.isVisible) meshes.push(m);
            }
          } else if (n.babylonMeshId) {
            const m = scene.getMeshByUniqueId(parseInt(n.babylonMeshId, 10));
            if (m && m instanceof BABYLON.Mesh && m.isVisible) meshes.push(m);
          }
          // Recurse children
          tree.getChildren(nid).forEach(child => collectMeshes(child.id));
        };
        collectMeshes(normalizedId);

        set({
          selectedMeshes: meshes,
          selectedCollectionNodeId: normalizedId,
          selectedCollectionTransformNode: transformNode 
        });

      }
    } else {
      // For mesh or entity-backed nodes, collect the node's mesh AND all descendant meshes
      if (node && scene) {
        const meshes: BABYLON.Mesh[] = [];
        const registry = EntityRegistry.getInstance();

        // Helper to collect meshes recursively
        const collectMeshes = (nid: string) => {
          const n = tree.getNode(nid);
          if (!n) return;

          // Prefer entity mesh if available
          if (n.entityId) {
            const ent = registry.get(n.entityId);
            if (ent && typeof ent.getMesh === 'function') {
              const m = ent.getMesh();
              if (m && m instanceof BABYLON.Mesh && m.isVisible) meshes.push(m);
            }
          } else if (n.babylonMeshId) {
            const m = scene.getMeshByUniqueId(parseInt(n.babylonMeshId, 10));
            if (m && m instanceof BABYLON.Mesh && m.isVisible) meshes.push(m);
          }

          // Recurse through all children
          tree.getChildren(nid).forEach(child => collectMeshes(child.id));
        };

        // Collect meshes starting from selected node
        collectMeshes(normalizedId);

        if (meshes.length > 0) {
          set({
            selectedMeshes: meshes,
            selectedCollectionNodeId: null,
            selectedCollectionTransformNode: null,
          });
          return;
        }
      }

      // Hide coordinate frame widget if not a collection
      if (coordinateFrameWidget && !get().customFrame) {
        coordinateFrameWidget.hide();
      }
    }
  },

  addToSelection: (nodeId: string) => {
    const normalizedId = normalizeNodeId(nodeId);
    const { selectedNodeIds } = get();
    if (!selectedNodeIds.includes(normalizedId)) {
      const newSelection = [...selectedNodeIds, normalizedId];
      set({
        selectedNodeIds: newSelection,
        selectedNodeId: newSelection[newSelection.length - 1] || null
      });
      updateSelectionVisuals(newSelection);
    }
  },

  removeFromSelection: (nodeId: string) => {
    const normalizedId = normalizeNodeId(nodeId);
    const { selectedNodeIds } = get();
    const newSelection = selectedNodeIds.filter(id => id !== normalizedId);

    set({
      selectedNodeIds: newSelection,
      selectedNodeId: newSelection.length > 0 ? newSelection[newSelection.length - 1] : null
    });

    if (newSelection.length > 0) {
      updateSelectionVisuals(newSelection);
    } else {
      get().clearSelection();
    }
  },

  toggleNodeSelection: (nodeId: string) => {
    const normalizedId = normalizeNodeId(nodeId);
    const { selectedNodeIds } = get();
    if (selectedNodeIds.includes(normalizedId)) {
      get().removeFromSelection(normalizedId);
    } else {
      get().addToSelection(normalizedId);
    }
  },

  zoomToNode: (nodeId) => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node) return;

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // Track if we found a mesh to adjust clipping planes
    let selectedMesh: BABYLON.AbstractMesh | null = null;

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
      } else if ((node as any).babylonNodeId) {
        // Backward compatibility with older saves that used `babylonNodeId`
        const transformNode = scene.getTransformNodeByUniqueId(
          parseInt((node as any).babylonNodeId, 10)
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
          const mesh = entity.getMesh();
          selectedMesh = mesh;

          // If it's a device entity, select the device mesh (triggers device highlighting)
          if (entity.getIsDevice()) {
            set({
              selectedMeshes: [mesh],
              selectedCollectionNodeId: null, // Clear collection selection
              selectedCollectionTransformNode: null
            });
          } else {
            // Check if this entity is a child of a device (it's a link)
            // For links, select the link mesh directly
            set({
              selectedMeshes: [mesh],
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
          selectedMesh = mesh;
          set({
            selectedMeshes: [mesh],
            selectedCollectionNodeId: null, // Clear collection selection
            selectedCollectionTransformNode: null
          });
        }
      }
    }

    // Dynamically adjust camera clipping planes based on selected mesh size
    sceneManager.adjustClippingPlanesForObject(selectedMesh);

    const { selectionLevel } = get();
    if (selectionLevel === 'object') {
      if (node) {
        const scene = sceneManager.getScene();
        if (scene) {
          let babylonNode: BABYLON.Node | null = null;
          if (node.babylonMeshId) {
            babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
          } else if (node.babylonTransformNodeId) {
            babylonNode = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId, 10));
          }

          if (babylonNode && (babylonNode instanceof BABYLON.Mesh || babylonNode instanceof BABYLON.TransformNode)) {
            get().showObjectOriginFrame(babylonNode);
          }
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

  zoomIn: () => {
    const sceneManager = SceneManager.getInstance();
    sceneManager.zoomIn();
  },

  zoomOut: () => {
    const sceneManager = SceneManager.getInstance();
    sceneManager.zoomOut();
  },

  toggleCameraMode: () => {
    const sceneManager = SceneManager.getInstance();
    sceneManager.toggleCameraMode();
  },

  toggleInspector: () => {
    const sceneManager = SceneManager.getInstance();
    sceneManager.toggleInspector();
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

    // Reset camera clipping planes to defaults when nothing selected
    const sceneManager = SceneManager.getInstance();
    sceneManager.resetClippingPlanes();
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
    // Pass callbacks to break circular dependency
    const { commandManager } = get();
    const command = new DeleteObjectCommand(nodeId, {
      createObject: get().createObject,
      updateNodePosition: get().updateNodePosition,
      updateNodeRotation: get().updateNodeRotation,
      updateNodeScale: get().updateNodeScale,
    });
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

    // Trigger Inspector refresh manually (backup in case observables don't fire)
    // The Inspector service should also listen to observables, but this ensures it updates
    setTimeout(() => {
      const host = document.querySelector('.babylon-inspector-host') as HTMLElement | null;
      if (host && (host as any)._inspectorRefresh) {
        (host as any)._inspectorRefresh();
      } else {
        // Fallback: try to trigger refresh via window event
        window.dispatchEvent(new CustomEvent('inspector-refresh-requested'));
      }
    }, 100);

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

        // Skip device_root meshes - these are internal infrastructure
        // They're used for entity system but shouldn't appear in the tree
        if (isMesh && node.name.endsWith('_device_root')) {
          console.log(`[URDF Loader] Skipping device_root mesh (internal infrastructure): ${node.name}`);
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

        // Store stable Babylon identifiers for later lookup.
        // Use mesh uniqueId for meshes and transform uniqueId for collections.
        treeNode.babylonMeshId = isMesh ? (node as BABYLON.Mesh).uniqueId.toString() : undefined;
        // IMPORTANT: Use babylonTransformNodeId (the canonical property used across the app)
        // Some older code used `babylonNodeId`; keep backward compatibility by not removing it here,
        // but make sure the canonical field is populated so lookups do not fall back to name.
        (treeNode as any).babylonNodeId = node.uniqueId.toString();
        treeNode.babylonTransformNodeId = node.uniqueId.toString();
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
        console.log('🔴🔴🔴 EDITOR STORE MJCF IMPORT CODE IS RUNNING - VERSION 2025.01.22.1341 🔴🔴🔴');

        // Import MJCF loader
        const { loadMJCFFromFile } = await import('../../loaders/mjcf/MJCFLoader');

        try {
          // MJCF loader will handle ZIP extraction internally
          const mjcfResult = await loadMJCFFromFile(file, scene);
          console.log('🔴🔴🔴 MJCF LOAD COMPLETE - ABOUT TO CHECK RESULT 🔴🔴🔴');

          if (mjcfResult.success) {
            console.log(`[File Import] Successfully loaded MJCF from ZIP: ${mjcfResult.meshes.length} meshes`);

            // DEBUG: Check what's in mjcfResult
            console.log('[EditorStore] mjcfResult keys:', Object.keys(mjcfResult));
            console.log('[EditorStore] mjcfResult.actuators:', (mjcfResult as any).actuators);
            console.log('[EditorStore] mjcfResult.rootNodes:', mjcfResult.rootNodes);
            console.log('[EditorStore] mjcfResult.keyframes:', (mjcfResult as any).keyframes);

            // Get the model name from the file
            const modelName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

            // DEBUG: Check what's in mjcfResult
            console.log('[EditorStore] MJCF Result keys:', Object.keys(mjcfResult));
            console.log('[EditorStore] MJCF Result.actuators:', (mjcfResult as any).actuators);
            console.log('[EditorStore] MJCF Result.actuators type:', typeof (mjcfResult as any).actuators);
            console.log('[EditorStore] MJCF Result.actuators length:', (mjcfResult as any).actuators?.length);

            // Integrate MJCF actuators with ActuatorSystem (Phase 1)
            if ((mjcfResult as any).actuators && (mjcfResult as any).actuators.length > 0 && mjcfResult.rootNodes.length > 0) {
              console.log(`[EditorStore] Integrating ${(mjcfResult as any).actuators.length} MJCF actuators`);

              try {
                const { registerMJCFActuators } = await import('../../loaders/mjcf/MJCFActuatorIntegration');
                const { KinematicsManager } = await import('../../kinematics/KinematicsManager');

                const kinematicsManager = KinematicsManager.getInstance();
                const actuatorSystem = kinematicsManager.getActuatorSystem();
                const robotRootNodeId = mjcfResult.rootNodes[0].id || mjcfResult.rootNodes[0].uniqueId.toString();

                // For MJCF, we need to use the scene tree node ID, not the TransformNode ID
                // The scene tree node ID is stored in the TransformNode's metadata
                const sceneTreeNodeId = mjcfResult.rootNodes[0].metadata?.sceneTreeNodeId || robotRootNodeId;

                const createdActuators = registerMJCFActuators(
                  (mjcfResult as any).actuators,
                  sceneTreeNodeId,
                  actuatorSystem,
                  kinematicsManager
                );

                console.log(`[EditorStore] ✅ Integrated ${createdActuators.length} MJCF actuators`);
              } catch (error) {
                console.error('[EditorStore] Failed to integrate MJCF actuators:', error);
              }
            }

            // Integrate MJCF keyframes with KinematicsManager (Phase 2)
            if ((mjcfResult as any).keyframes && mjcfResult.rootNodes.length > 0) {
              const keyframes = (mjcfResult as any).keyframes;
              const keyframeCount = Object.keys(keyframes).length;

              if (keyframeCount > 0) {
                console.log(`[EditorStore] Integrating ${keyframeCount} MJCF keyframes`);

                try {
                  const { registerMJCFKeyframes } = await import('../../loaders/mjcf/MJCFKeyframeIntegration');
                  const { KinematicsManager } = await import('../../kinematics/KinematicsManager');

                  const kinematicsManager = KinematicsManager.getInstance();
                  const robotRootNodeId = mjcfResult.rootNodes[0].id || mjcfResult.rootNodes[0].uniqueId.toString();

                  // For MJCF, we need to use the scene tree node ID, not the TransformNode ID
                  const sceneTreeNodeId = mjcfResult.rootNodes[0].metadata?.sceneTreeNodeId || robotRootNodeId;

                  // Find the kinematic chain for this robot
                  const chains = kinematicsManager.getAllChains();
                  let chainId = `${sceneTreeNodeId}_chain`;
                  for (const chain of chains) {
                    if (chain.rootNodeId === sceneTreeNodeId) {
                      chainId = chain.id;
                      break;
                    }
                  }

                  const registeredKeyframes = registerMJCFKeyframes(
                    keyframes,
                    chainId,
                    kinematicsManager
                  );

                  console.log(`[EditorStore] ✅ Integrated ${registeredKeyframes.length} MJCF keyframes`);
                } catch (error) {
                  console.error('[EditorStore] Failed to integrate MJCF keyframes:', error);
                }
              }
            }

            // Create a collection for this model
            const modelCollection = tree.createNode(
              'collection',
              modelName,
              assetsNode?.id || null
            );

            // Link MJCF device entity to tree node (similar to URDF)
            // The MJCF loader creates device entities, but we need to link them to the tree
            if (mjcfResult.rootNodes.length > 0) {
              const rootNode = mjcfResult.rootNodes[0];
              
              // Find the device entity created by the MJCF loader
              // Look for a device entity with a mesh that has the device root pattern
              const deviceEntities = registry.getAll().filter(entity => entity.getIsDevice());
              const mjcfDeviceEntity = deviceEntities.find(entity => {
                const mesh = entity.getMesh();
                return mesh && mesh.name.includes('_device_root') && mesh.parent === rootNode;
              });
              
              if (mjcfDeviceEntity) {
                console.log(`[EditorStore] Linking MJCF device entity ${mjcfDeviceEntity.getId()} to tree node ${modelCollection.id}`);
                modelCollection.entityId = mjcfDeviceEntity.getId();
                
                // Also link the device root mesh to the tree node
                const deviceMesh = mjcfDeviceEntity.getMesh();
                if (deviceMesh) {
                  modelCollection.babylonMeshId = deviceMesh.uniqueId.toString();
                }
              } else {
                console.warn('[EditorStore] No MJCF device entity found - selection highlighting may not work');
              }
            }

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

              // Skip MJCF body nodes - they're already created by the MJCF loader with proper tree structure
              // This prevents duplicate tree nodes and ensures correct parent-child relationships
              // BUT we still need to process mesh children of body nodes
              if (node.metadata?.isMJCFBody) {
                console.log(`[EditorStore] Skipping MJCF body node (already created by loader): ${node.name}`);

                // Find the existing tree node for this body
                const existingBodyTreeNode = tree.getNodeByBabylonTransformNodeId(node.uniqueId.toString());
                if (existingBodyTreeNode) {
                  console.log(`[EditorStore] Found existing tree node for body: ${existingBodyTreeNode.id}`);
                  // Process mesh children and link them to this body's tree node
                  for (const child of children) {
                    buildTreeForNode(child, existingBodyTreeNode.id, depth + 1);
                  }
                }
                return;
              }

              // Skip device_root meshes - these are internal infrastructure
              // They're used for entity system but shouldn't appear in the tree
              if (isMesh && node.name.endsWith('_device_root')) {
                console.log(`[EditorStore] Skipping device_root mesh (internal infrastructure): ${node.name}`);
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

            // Re-parent existing MJCF body nodes to the model collection
            // The MJCF loader already created tree nodes for bodies, but they're parented to the hidden rootSceneNode
            // We need to re-parent them to the modelCollection for proper tree display
            const allTreeNodes = tree.getAllNodes();
            const mjcfBodyNodes = allTreeNodes.filter(node => {
              // Find nodes that are MJCF bodies by checking if their Babylon node has isMJCFBody metadata
              if (node.babylonTransformNodeId) {
                const babylonNode = scene.transformNodes.find(tn => tn.uniqueId.toString() === node.babylonTransformNodeId);
                return babylonNode?.metadata?.isMJCFBody === true;
              }
              return false;
            });

            console.log(`[EditorStore] Found ${mjcfBodyNodes.length} MJCF body nodes to re-parent`);

            // Re-parent top-level body nodes (those with hidden parent) to modelCollection
            for (const bodyNode of mjcfBodyNodes) {
              const parentNode = bodyNode.parentId ? tree.getNode(bodyNode.parentId) : null;

              // If parent is the hidden rootSceneNode, re-parent to modelCollection
              if (parentNode && parentNode.showInTree === false) {
                console.log(`[EditorStore] Re-parenting MJCF body node ${bodyNode.name} from hidden root to modelCollection`);
                tree.moveNode(bodyNode.id, modelCollection.id);
              }
            }

            // Build tree for meshes only (body structure already exists)
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

        // No URDF or MJCF found, try OBJ
        console.log(`[File Import] No URDF or MJCF found in ZIP, trying OBJ...`);
        try {
          const { loadOBJFile } = await import('../../loaders/obj/OBJLoader');
          const objResult = await loadOBJFile(file, scene);
          if (objResult.success) {
            console.log(`[File Import] Successfully loaded OBJ from ZIP: ${objResult.meshes.length} meshes`);
            loading.end();
            toast.success(`Loaded ${objResult.meshes.length} meshes from OBJ`);
            return;
          }
        } catch (objError) {
          console.log(`[File Import] OBJ loading failed:`, objError);
        }

        throw new Error('No valid URDF, MJCF, or OBJ found in ZIP archive');

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

      // CRITICAL: GLBLoader handles its own tree building (lines 301-410 in GLBLoader.ts)
      // Skip duplicate tree building for GLB files to avoid creating duplicate nodes
      const isGLB = file.name.toLowerCase().endsWith('.glb');

      if (isGLB) {
        console.log('[EditorStore] Skipping tree building for GLB file - GLBLoader handles this');
        loading.end();

        // Store loaded meshes for reference
        console.log(`Imported ${meshes.length} meshes with ${rootNodes.length} root nodes`);

        return;
      }

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

        // Skip device_root meshes - these are internal infrastructure
        // They're used for entity system but shouldn't appear in the tree
        if (isMesh && node.name.endsWith('_device_root')) {
          console.log(`[EditorStore] Skipping device_root mesh (internal infrastructure): ${node.name}`);
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

        // Skip device_root meshes - these are internal infrastructure
        // They're used for entity system but shouldn't appear in the tree
        if (isMesh && node.name.endsWith('_device_root')) {
          console.log(`[EditorStore] Skipping device_root mesh (internal infrastructure): ${node.name}`);
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
      // It's a collection/TransformNode - prefer uniqueId over name
      if (node.babylonTransformNodeId) {
        babylonNode = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId, 10));
      } else if ((node as any).babylonNodeId) {
        babylonNode = scene.getTransformNodeByUniqueId(parseInt((node as any).babylonNodeId, 10));
      } else {
        babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
      }
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
      if (node.babylonTransformNodeId) {
        babylonNode = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId, 10));
      } else if ((node as any).babylonNodeId) {
        babylonNode = scene.getTransformNodeByUniqueId(parseInt((node as any).babylonNodeId, 10));
      } else {
        babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
      }
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
      if (node.babylonTransformNodeId) {
        babylonNode = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId, 10));
      } else if ((node as any).babylonNodeId) {
        babylonNode = scene.getTransformNodeByUniqueId(parseInt((node as any).babylonNodeId, 10));
      } else {
        babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
      }
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

  // Visualization overlay setters
  setSkeletonEnabled: (enabled) => set({ skeletonEnabled: enabled }),
  setSkeletonStyle: (style) => set({ skeletonStyle: style }),
  setSkeletonThicknessMm: (mm) => set({ skeletonThicknessMm: Math.max(1, Math.min(100, Math.round(mm))) }),
  setSkeletonAnimationSpeed: (speed) => set({ skeletonAnimationSpeed: Math.max(0.1, Math.min(3.0, speed)) }),
  setSkeletonHighlightActiveJoint: (enabled) => set({ skeletonHighlightActiveJoint: enabled }),
  setShowCoordinateOverlay: (visible) => set({ showCoordinateOverlay: visible }),
  setShowJointAxesOverlay: (visible) => set({ showJointAxesOverlay: visible }),
  setShowLinkLengthLabels: (visible) => set({ showLinkLengthLabels: visible }),
  setShowOrientationLabels: (visible) => set({ showOrientationLabels: visible }),

  // Feature flags setters
  setEditableKinematicsFlag: (enabled) => set({ editableKinematicsFlag: enabled }),

  // Edit mode actions
  setEditModeEnabled: (enabled) => set({ editModeEnabled: enabled }),
  attachJoint: (jointId) => set({ attachedJointId: jointId }),

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

  // Snap tool setters
  setSnapToolActive: (enabled) => {
    if (!enabled) {
      // Clear first point when disabling snap tool
      const { snapFirstPoint } = get();
      if (snapFirstPoint) {
        set({ snapToolActive: false, snapFirstPoint: null });
      } else {
        set({ snapToolActive: false });
      }
    } else {
      set({ snapToolActive: true });
    }
  },

  setSnapFirstPoint: (point) => {
    set({ snapFirstPoint: point });
  },

  cancelSnap: () => {
    set({ snapToolActive: false, snapFirstPoint: null });
  },

  handleSnapClick: (pickInfo) => {
    console.log('[Snap Tool] handleSnapClick called', {
      hit: pickInfo.hit,
      mesh: pickInfo.pickedMesh?.name,
      hasPoint: !!pickInfo.pickedPoint,
    });
    
    const { snapToolActive, snapEnabled, snapFirstPoint } = get();
    
    console.log('[Snap Tool] State:', {
      snapToolActive,
      snapEnabled,
      hasFirstPoint: !!snapFirstPoint,
    });

    if (!snapToolActive || !pickInfo.hit || !pickInfo.pickedMesh || !pickInfo.pickedPoint) {
      console.log('[Snap Tool] Early return - conditions not met');
      return;
    }

    // Check if snapping is enabled
    if (!snapEnabled) {
      toast.error('Please enable snapping in settings first');
      return;
    }

    const pickedMesh = pickInfo.pickedMesh as BABYLON.Mesh;
    const clickedPoint = pickInfo.pickedPoint;

    // Ignore system meshes (ground, grid overlay, snap previews, etc.)
    const systemMeshNames = ['ground', 'gridOverlay'];
    const isSystemMesh = systemMeshNames.includes(pickedMesh.name) || 
                         pickedMesh.name.startsWith('snap') ||
                         pickedMesh.name.startsWith('measurement') ||
                         pickedMesh.name.startsWith('transform_label');
    
    if (isSystemMesh) {
      console.log('[Snap Tool] Ignoring click on system mesh:', pickedMesh.name);
      return;
    }
    
    console.log('[Snap Tool] Valid mesh clicked:', pickedMesh.name);

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    const camera = scene.activeCamera;
    if (!camera) return;

    // Build snap settings from current state
    const state = get();
    const snapSettings = {
      enabled: state.snapEnabled,
      snapToGrid: state.snapToGrid,
      snapToVertex: state.snapToVertex,
      snapToEdge: state.snapToEdge,
      snapToFace: state.snapToFace,
      snapToCenter: state.snapToCenter,
      snapToObject: state.snapToObject,
      snapToMidpoint: state.snapToMidpoint,
      snapToIntersection: state.snapToIntersection,
      snapToPerpendicular: state.snapToPerpendicular,
      snapToTangent: state.snapToTangent,
      snapAlong: state.snapAlong,
      snapToNormal: state.snapToNormal,
      snapToPlane: state.snapToPlane,
      snapToAxis: state.snapToAxis,
      snapToCurve: state.snapToCurve,
      snapToSurface: state.snapToSurface,
      snapObjectToVertex: state.snapObjectToVertex,
      snapPointOnEdge: state.snapPointOnEdge,
      snapBBoxCorner: state.snapBBoxCorner,
      gridSize: state.gridSize,
      snapDistance: state.snapDistance,
    };

    const snappingHelper = SnappingHelper.getInstance();

    // First click - select source point (on object to move)
    if (!snapFirstPoint) {
      console.log('[Snap Tool] First click - finding source point on mesh:', pickedMesh?.name);
      
      // Use snapping to find the best point on the clicked mesh
      const snapResult = snappingHelper.snapPosition(
        clickedPoint,
        snapSettings,
        [], // Don't exclude anything for first point
        camera,
        undefined,
        true, // smartSelect
        pickedMesh,
        clickedPoint
      );

      console.log('[Snap Tool] First click snap result:', {
        snapped: snapResult.snapped,
        snapType: snapResult.snapType,
        position: snapResult.position,
      });

      // If snap failed, try using mesh center as fallback with larger distance
      let sourcePoint = snapResult.snapped ? snapResult.position : clickedPoint;
      
      if (!snapResult.snapped && pickedMesh) {
        console.log('[Snap Tool] First click snap failed, trying fallback strategies');
        pickedMesh.computeWorldMatrix(true);
        const boundingInfo = pickedMesh.getBoundingInfo();
        const meshCenter = boundingInfo.boundingBox.centerWorld;
        
        // Strategy 1: Try snapping from mesh center with normal distance
        let fallbackSnapResult = snappingHelper.snapPosition(
          meshCenter,
          snapSettings,
          [], // Don't exclude anything for first point
          camera,
          undefined,
          true, // smartSelect
          pickedMesh,
          clickedPoint
        );
        
        // Strategy 2: If that fails, try with much larger distance (mesh size)
        if (!fallbackSnapResult.snapped) {
          const min = boundingInfo.boundingBox.minimumWorld;
          const max = boundingInfo.boundingBox.maximumWorld;
          const meshSize = max.subtract(min);
          const maxDimension = Math.max(meshSize.x, meshSize.y, meshSize.z);
          const largeSnapDistance = Math.max(state.snapDistance, maxDimension * 1000 * 2); // Convert to mm and add margin
          
          const largeSnapSettings = { ...snapSettings, snapDistance: largeSnapDistance };
          fallbackSnapResult = snappingHelper.snapPosition(
            meshCenter,
            largeSnapSettings,
            [], // Don't exclude anything for first point
            camera,
            undefined,
            true, // smartSelect
            pickedMesh,
            clickedPoint
          );
        }
        
        if (fallbackSnapResult.snapped) {
          console.log('[Snap Tool] First click fallback snap succeeded:', fallbackSnapResult.snapType);
          sourcePoint = fallbackSnapResult.position;
        } else {
          // Last resort: use mesh center
          console.log('[Snap Tool] Using mesh center as source point (no snap found)');
          sourcePoint = meshCenter;
        }
      }

      // Capture the mesh's current rotation/orientation
      pickedMesh.computeWorldMatrix(true);
      let sourceRotation: BABYLON.Quaternion;
      if (pickedMesh.rotationQuaternion) {
        sourceRotation = pickedMesh.rotationQuaternion.clone();
      } else {
        // Convert Euler angles to quaternion
        sourceRotation = BABYLON.Quaternion.RotationYawPitchRoll(
          pickedMesh.rotation.y, // yaw
          pickedMesh.rotation.x, // pitch
          pickedMesh.rotation.z  // roll
        );
      }
      
      console.log('[Snap Tool] Captured source rotation:', sourceRotation);

      set({
        snapFirstPoint: {
          mesh: pickedMesh,
          position: sourcePoint,
          rotation: sourceRotation,
        },
      });

      // Determine the actual snap type used (from initial snap or fallback)
      const actualSnapType = snapResult.snapped 
        ? snapResult.snapType 
        : (sourcePoint !== clickedPoint ? 'center' : 'point');
      const snapTypeName = actualSnapType || 'point';
      
      toast.info(`First point selected (${snapTypeName}). Click target point.`);
      console.log('[Snap Tool] First point set:', { 
        mesh: pickedMesh?.name, 
        position: sourcePoint,
        snapType: snapTypeName,
        wasSnapped: snapResult.snapped,
      });
      return;
    }

    // Second click - select target point and perform snap
    console.log('[Snap Tool] Second click - finding target point');
    const sourceMesh = snapFirstPoint.mesh;
    const sourcePoint = snapFirstPoint.position;
    
    // Ensure we have a proper Quaternion instance (Zustand might serialize it)
    let sourceRotation: BABYLON.Quaternion;
    if (snapFirstPoint.rotation instanceof BABYLON.Quaternion) {
      sourceRotation = snapFirstPoint.rotation;
    } else {
      // Zustand may have serialized it, so reconstruct from stored values
      const rot = snapFirstPoint.rotation as any;
      sourceRotation = new BABYLON.Quaternion(
        rot.x ?? rot._x ?? 0,
        rot.y ?? rot._y ?? 0,
        rot.z ?? rot._z ?? 0,
        rot.w ?? rot._w ?? 1
      );
    }
    
    console.log('[Snap Tool] Source mesh:', sourceMesh?.name, 'Source point:', sourcePoint);
    console.log('[Snap Tool] Target mesh:', pickedMesh?.name, 'Clicked point:', clickedPoint);

    // Use snapping to find the best point on the target mesh
    const excludeMeshIds = [sourceMesh.uniqueId.toString()];
    
    // Also exclude child meshes if source is a device
    const registry = EntityRegistry.getInstance();
    const sourceEntity = registry.getByMesh(sourceMesh);
    if (sourceEntity && sourceEntity.getIsDevice()) {
      const deviceEntity = sourceEntity as any;
      const linkEntities = deviceEntity.getChildren();
      linkEntities.forEach((linkEntity: any) => {
        const linkMesh = linkEntity.getMesh();
        if (linkMesh) {
          excludeMeshIds.push(linkMesh.uniqueId.toString());
        }
      });
    }

    let snapResult = snappingHelper.snapPosition(
      clickedPoint,
      snapSettings,
      excludeMeshIds,
      camera,
      undefined,
      true, // smartSelect
      pickedMesh,
      clickedPoint
    );

    // If snap failed but we have a valid picked mesh, try using the mesh's bounding box center
    // This handles cases where the clicked point is far from the snap point (e.g., clicking on a face far from midpoint)
    if (!snapResult.snapped && pickedMesh) {
      // Try snapping from the mesh's bounding box center instead
      pickedMesh.computeWorldMatrix(true);
      const boundingInfo = pickedMesh.getBoundingInfo();
      const meshCenter = boundingInfo.boundingBox.centerWorld;
      
      snapResult = snappingHelper.snapPosition(
        meshCenter,
        snapSettings,
        excludeMeshIds,
        camera,
        undefined,
        true, // smartSelect
        pickedMesh,
        clickedPoint
      );
    }

    // If still no snap, try with a much larger distance threshold (mesh bounding box size)
    if (!snapResult.snapped && pickedMesh) {
      pickedMesh.computeWorldMatrix(true);
      const boundingInfo = pickedMesh.getBoundingInfo();
      const meshCenter = boundingInfo.boundingBox.centerWorld;
      const min = boundingInfo.boundingBox.minimumWorld;
      const max = boundingInfo.boundingBox.maximumWorld;
      const meshSize = max.subtract(min);
      const maxDimension = Math.max(meshSize.x, meshSize.y, meshSize.z);
      const largeSnapDistance = Math.max(state.snapDistance, maxDimension * 1000 * 2); // Convert to mm and add margin
      
      const largeSnapSettings = { ...snapSettings, snapDistance: largeSnapDistance };
      snapResult = snappingHelper.snapPosition(
        meshCenter,
        largeSnapSettings,
        excludeMeshIds,
        camera,
        undefined,
        true, // smartSelect
        pickedMesh,
        clickedPoint
      );
    }

    console.log('[Snap Tool] Target snap result:', {
      snapped: snapResult.snapped,
      snapType: snapResult.snapType,
      position: snapResult.position,
    });

    if (!snapResult.snapped) {
      console.error('[Snap Tool] No snap target found!');
      toast.error(`No snap target found within ${state.snapDistance}mm`);
      return;
    }

    const targetPoint = snapResult.position;

    // Get target mesh rotation to match orientation
    pickedMesh.computeWorldMatrix(true);
    let targetRotation: BABYLON.Quaternion;
    
    if (pickedMesh.rotationQuaternion) {
      targetRotation = pickedMesh.rotationQuaternion.clone();
    } else {
      // Convert Euler angles to quaternion
      targetRotation = BABYLON.Quaternion.RotationYawPitchRoll(
        pickedMesh.rotation.y, // yaw
        pickedMesh.rotation.x, // pitch
        pickedMesh.rotation.z  // roll
      );
    }
    
    console.log('[Snap Tool] Target rotation (quaternion):', targetRotation);

    // Convert source point to local space (relative to mesh center)
    sourceMesh.computeWorldMatrix(true);
    const sourceMeshCenter = sourceMesh.getAbsolutePosition();
    const sourcePointLocal = sourcePoint.subtract(sourceMeshCenter);
    
    console.log('[Snap Tool] Source point in local space:', sourcePointLocal);
    console.log('[Snap Tool] Source mesh center:', sourceMeshCenter);
    console.log('[Snap Tool] Source rotation (quaternion):', sourceRotation);
    
    // Calculate the rotation difference needed to go from source rotation to target rotation
    const sourceRotationInverse = sourceRotation.clone().invert();
    const rotationDelta = targetRotation.multiply(sourceRotationInverse);
    
    // Transform the local source point by the rotation delta to get where it will be after rotation
    const rotationMatrix = BABYLON.Matrix.Identity();
    rotationDelta.toRotationMatrix(rotationMatrix);
    const rotatedSourcePointLocal = BABYLON.Vector3.TransformCoordinates(
      sourcePointLocal,
      rotationMatrix
    );
    
    // The new world position of the source point after rotation (but before translation)
    const rotatedSourcePointWorld = rotatedSourcePointLocal.add(sourceMeshCenter);
    
    console.log('[Snap Tool] Source point after rotation (world):', rotatedSourcePointWorld);
    console.log('[Snap Tool] Target point (world):', targetPoint);
    
    // Calculate offset needed to move rotated source point to target point
    const offset = targetPoint.subtract(rotatedSourcePointWorld);
    console.log('[Snap Tool] Calculated offset:', offset);
    console.log('[Snap Tool] Moving rotated source point from', rotatedSourcePointWorld, 'to', targetPoint);

    // Check if source mesh belongs to a device entity
    if (sourceEntity && sourceEntity.getIsDevice()) {
      console.log('[Snap Tool] Moving device entity');
      // Move the entire device by moving its root transform node
      const rootNode = sourceEntity.getRootTransformNode();
      if (rootNode) {
        console.log('[Snap Tool] Device root node position before:', rootNode.position.clone());
        rootNode.position.addInPlace(offset);
        console.log('[Snap Tool] Device root node position after:', rootNode.position.clone());

        // Update scene tree for the device root node
        const tree = SceneTreeManager.getInstance();
        const treeNode = tree.getNodeByEntityId(sourceEntity.getId());
        if (treeNode) {
          const newPos = babylonToUser(rootNode.position);
          tree.setLocalPosition(treeNode.id, newPos);
          
          // Apply target rotation to device root node
          console.log('[Snap Tool] Applying target rotation to device root node');
          if (rootNode.rotationQuaternion) {
            rootNode.rotationQuaternion.copyFrom(targetRotation);
          } else {
            rootNode.rotationQuaternion = targetRotation.clone();
          }
          
          // Update scene tree rotation (convert quaternion to Euler for tree)
          const targetEuler = targetRotation.toEulerAngles();
          const targetRotationDegrees = {
            x: (targetEuler.x * 180) / Math.PI,
            y: (targetEuler.y * 180) / Math.PI,
            z: (targetEuler.z * 180) / Math.PI,
          };
          tree.setLocalRotation(treeNode.id, targetRotationDegrees);
        }

        // Sync all child link entities to physics
        const linkEntities = sourceEntity.getChildren();
        linkEntities.forEach((linkEntity: any) => {
          linkEntity.syncToPhysics();
        });

        toast.success(`Device snapped to ${snapResult.snapType || 'target'}!`);
      } else {
        console.error('[Snap Tool] Device entity has no root transform node!');
      }
    } else {
      console.log('[Snap Tool] Moving regular mesh');
      console.log('[Snap Tool] Mesh position before:', sourceMesh.position.clone());
      sourceMesh.position.addInPlace(offset);
      console.log('[Snap Tool] Mesh position after:', sourceMesh.position.clone());

      // Apply target rotation to source mesh
      console.log('[Snap Tool] Applying target rotation to source mesh');
      if (sourceMesh.rotationQuaternion) {
        sourceMesh.rotationQuaternion.copyFrom(targetRotation);
      } else {
        sourceMesh.rotationQuaternion = targetRotation.clone();
      }

      // Sync to scene tree and physics
      const tree = SceneTreeManager.getInstance();
      const node = tree.getNodeByBabylonMeshId(sourceMesh.uniqueId.toString());
      if (node) {
        const newPos = babylonToUser(sourceMesh.position);
        tree.setLocalPosition(node.id, newPos);

        // Update scene tree rotation (convert quaternion to Euler for tree)
        const targetEuler = targetRotation.toEulerAngles();
        const targetRotationDegrees = {
          x: (targetEuler.x * 180) / Math.PI,
          y: (targetEuler.y * 180) / Math.PI,
          z: (targetEuler.z * 180) / Math.PI,
        };
        tree.setLocalRotation(node.id, targetRotationDegrees);

        // Sync to physics if entity exists
        if (node.entityId) {
          const meshEntity = registry.get(node.entityId);
          meshEntity?.syncToPhysics();
        }
      } else {
        console.warn('[Snap Tool] No scene tree node found for mesh:', sourceMesh.name);
      }

      const snapTypeName = snapResult.snapType || 'target';
      toast.success(`Snapped to ${snapTypeName}!`);
    }

    window.dispatchEvent(new Event('scenetree-update'));

    // Clear first point after successful snap (ready for next snap)
    set({ snapFirstPoint: null });
  },

  // Point pick tool setters
  setPointPickMode: (enabled) => {
    // Clear existing markers and frame widgets when toggling mode
    const { pointPickMarkers, pointPickFrameWidgets } = get();
    if (!enabled) {
      pointPickMarkers.forEach(marker => marker.dispose());
      pointPickFrameWidgets.forEach(widget => widget.dispose());
      set({ pointPickMode: false, pointPickMarkers: [], pointPickFrameWidgets: [] });
    } else {
      set({ pointPickMode: true });
    }
  },

  clearPointPickMarkers: () => {
    const { pointPickFrameWidgets } = get();
    pointPickFrameWidgets.forEach(widget => widget.dispose());
    set({ pointPickMarkers: [], pointPickFrameWidgets: [], pointPickFrameData: null });
  },

  handlePointPick: (pickInfo) => {
    const { pointPickMode, pointPickFrameWidgets } = get();

    console.log('[PointPick Debug] Hit:', pickInfo.hit);
    console.log('[PointPick Debug] Mesh:', pickInfo.pickedMesh?.name);
    console.log('[PointPick Debug] isPickable:', (pickInfo.pickedMesh as any)?.isPickable);

    if (!pointPickMode || !pickInfo.hit || !pickInfo.pickedPoint) {
      return;
    }

    // Remove any legacy frame widgets/data so only the targeting widget remains
    pointPickFrameWidgets.forEach(widget => widget.dispose());
    set({ pointPickFrameWidgets: [], pointPickFrameData: null });

    // Store pick for coordinate readouts (displayed elsewhere)
    get().setLastPickedPoint(pickInfo.pickedPoint.clone());
  },

  // Object origin frame actions
  showObjectOriginFrame: (node: BABYLON.Mesh | BABYLON.TransformNode) => {
    console.log('[ObjectOriginFrame] Frame display disabled - using targeting widget instead');
    console.log('[ObjectOriginFrame] Node:', node.name);

    // Visual feedback provided by targeting widget (SceneCanvas)
  },

  clearObjectOriginFrame: () => {
    const { objectOriginFrameWidget } = get();
    if (objectOriginFrameWidget) {
      objectOriginFrameWidget.dispose();
    }
    set({ objectOriginFrameWidget: null, objectOriginFrameData: null });
  },

  addPermanentFrame: () => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const tree = SceneTreeManager.getInstance();

    if (!scene) {
      toast.error('No scene available');
      return;
    }

    const {
      objectOriginFrameData,
      pointPickFrameData,
      customFrame,
      selectedMeshes,
      selectionLevel,
      lastPickedPoint
    } = get();
    console.log('[AddFrame] selectionLevel:', selectionLevel);
    console.log('[AddFrame] selectedMeshes:', selectedMeshes);
    console.log('[AddFrame] lastPickedPoint:', lastPickedPoint);
    console.log('[AddFrame] objectOriginFrameData:', objectOriginFrameData);
    console.log('[AddFrame] pointPickFrameData:', pointPickFrameData);
    console.log('[AddFrame] customFrame:', customFrame);

    let frameData = objectOriginFrameData || pointPickFrameData;

    if (!frameData && selectionLevel === 'mesh' && customFrame) {
      const origin = userToBabylon(customFrame.origin);
      frameData = {
        pickPoint: origin.clone(),
        frame: customFrame,
        baseSize: 0.1
      };
      console.log('[AddFrame] Using custom frame widget data for permanent frame');
    }

    // If no frame data but mesh is selected and we have a picked point, create frame at picked location
    if (!frameData && selectionLevel === 'mesh' && selectedMeshes.length > 0 && lastPickedPoint) {
      const selectedMesh = selectedMeshes[0];
      console.log('[AddFrame] Creating frame at picked point on mesh:', selectedMesh.name);

      // Use the last picked point as the frame origin
      const pickPoint = lastPickedPoint.clone();

      // Perform a raycast from camera to picked point to get surface normal
      const camera = scene.activeCamera;
      if (!camera) {
        toast.error('No active camera');
        return;
      }

      // Ray from camera through picked point
      const ray = new BABYLON.Ray(camera.position, pickPoint.subtract(camera.position).normalize());
      const pickInfo = scene.pickWithRay(ray, (mesh) => mesh === selectedMesh);

      let zAxis = BABYLON.Vector3.Up(); // Default if no normal found
      if (pickInfo && pickInfo.hit && pickInfo.getNormal) {
        const hitNormal = pickInfo.getNormal(true);
        if (hitNormal && hitNormal.lengthSquared() > 0.000001) {
          zAxis = hitNormal.normalize();
        }
      }

      // Create orthonormal frame from the surface normal (Z-axis)
      // Find a suitable X-axis perpendicular to Z
      let xAxis: BABYLON.Vector3;
      if (Math.abs(BABYLON.Vector3.Dot(zAxis, BABYLON.Vector3.Right())) < 0.9) {
        xAxis = BABYLON.Vector3.Cross(zAxis, BABYLON.Vector3.Right()).normalize();
      } else {
        xAxis = BABYLON.Vector3.Cross(zAxis, BABYLON.Vector3.Up()).normalize();
      }

      // Y-axis completes the right-handed coordinate system
      const yAxis = BABYLON.Vector3.Cross(zAxis, xAxis).normalize();

      // Convert to user coordinates
      const userPos = babylonToUser(pickPoint);

      // Find node ID
      const meshIdString = selectedMesh.uniqueId.toString();
      const node = tree.getNodeByBabylonMeshId(meshIdString);
      const nodeId = node?.id || meshIdString;

      frameData = {
        pickPoint: pickPoint,
        frame: {
          featureType: 'object' as CustomFrameFeatureType,
          nodeId,
          origin: userPos,
          xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
          yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
          zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z }
        },
        baseSize: 0.1
      };
      console.log('[AddFrame] Created frame data at picked point with surface normal:', frameData);
    }

    if (!frameData) {
      console.error('[AddFrame] No frame data available');
      toast.error('No frame to add. Please select a mesh or pick a point first.');
      return;
    }

    console.log('[AddFrame] Using frame data:', frameData);

    const { frame } = frameData;

    try {
      const frameName = `Frame_${Date.now()}`;
      const frameRoot = new BABYLON.TransformNode(frameName, scene);
      const origin = userToBabylon(frame.origin);
      frameRoot.position = origin;

      const xAxis = new BABYLON.Vector3(frame.xAxis.x, frame.xAxis.y, frame.xAxis.z).normalize();
      const yAxis = new BABYLON.Vector3(frame.yAxis.x, frame.yAxis.y, frame.yAxis.z).normalize();
      const zAxis = new BABYLON.Vector3(frame.zAxis.x, frame.zAxis.y, frame.zAxis.z).normalize();

      const axisLength = 0.1;

      const createAxisLine = (start: BABYLON.Vector3, end: BABYLON.Vector3, color: BABYLON.Color3, name: string) => {
        const line = BABYLON.MeshBuilder.CreateLines(name, { points: [start, end] }, scene);
        const mat = new BABYLON.StandardMaterial(`${name}_mat`, scene);
        mat.emissiveColor = color;
        mat.disableLighting = true;
        line.color = color;
        line.isPickable = true; // Make pickable for frame selection
        line.parent = frameRoot;
        line.metadata = { isFramePart: true, frameRoot: frameRoot };
        return line;
      };

      const createArrowHead = (position: BABYLON.Vector3, direction: BABYLON.Vector3, color: BABYLON.Color3, name: string) => {
        const cone = BABYLON.MeshBuilder.CreateCylinder(
          name,
          { height: 0.015, diameterTop: 0, diameterBottom: 0.008, tessellation: 8 },
          scene
        );

        cone.position = position;

        const up = new BABYLON.Vector3(0, 1, 0);
        const angle = Math.acos(BABYLON.Vector3.Dot(up, direction));
        const axis = BABYLON.Vector3.Cross(up, direction);
        if (axis.length() > 0.0001) {
          cone.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
        }

        const mat = new BABYLON.StandardMaterial(`${name}_mat`, scene);
        mat.diffuseColor = color;
        mat.emissiveColor = color;
        mat.disableLighting = true;
        cone.material = mat;
        cone.isPickable = true; // Make pickable for frame selection
        cone.parent = frameRoot;
        cone.metadata = { isFramePart: true, frameRoot: frameRoot };
        return cone;
      };

      const createLabel = (position: BABYLON.Vector3, text: string, color: BABYLON.Color3, name: string) => {
        const plane = BABYLON.MeshBuilder.CreatePlane(name, { size: 0.05 }, scene);
        plane.position = position;
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const dynamicTexture = new BABYLON.DynamicTexture(
          `${name}_texture`,
          { width: 256, height: 256 },
          scene,
          false
        );

        dynamicTexture.drawText(
          text,
          null,
          null,
          'bold 180px Arial',
          `rgb(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)})`,
          'transparent',
          true,
          true
        );

        const material = new BABYLON.StandardMaterial(`${name}_mat`, scene);
        material.diffuseTexture = dynamicTexture;
        material.emissiveColor = color;
        material.disableLighting = true;
        material.opacityTexture = dynamicTexture;
        material.backFaceCulling = false; // Keep visible from both sides

        plane.material = material;
        plane.isPickable = true; // Make pickable for frame selection
        plane.parent = frameRoot;
        plane.metadata = { isFramePart: true, frameRoot: frameRoot };
        return plane;
      };

      createAxisLine(BABYLON.Vector3.Zero(), xAxis.scale(axisLength), new BABYLON.Color3(1, 0, 0), `${frameName}_X_axis`);
      createArrowHead(xAxis.scale(axisLength), xAxis, new BABYLON.Color3(1, 0, 0), `${frameName}_X_arrow`);
      createLabel(xAxis.scale(axisLength * 1.2), 'X', new BABYLON.Color3(1, 0, 0), `${frameName}_X_label`);

      createAxisLine(BABYLON.Vector3.Zero(), yAxis.scale(axisLength), new BABYLON.Color3(0, 1, 0), `${frameName}_Y_axis`);
      createArrowHead(yAxis.scale(axisLength), yAxis, new BABYLON.Color3(0, 1, 0), `${frameName}_Y_arrow`);
      createLabel(yAxis.scale(axisLength * 1.2), 'Y', new BABYLON.Color3(0, 1, 0), `${frameName}_Y_label`);

      createAxisLine(BABYLON.Vector3.Zero(), zAxis.scale(axisLength), new BABYLON.Color3(0, 0, 1), `${frameName}_Z_axis`);
      createArrowHead(zAxis.scale(axisLength), zAxis, new BABYLON.Color3(0, 0, 1), `${frameName}_Z_arrow`);
      createLabel(zAxis.scale(axisLength * 1.2), 'Z', new BABYLON.Color3(0, 0, 1), `${frameName}_Z_label`);

      // Create a small pickable sphere at the origin for direct selection
      const originSphere = BABYLON.MeshBuilder.CreateSphere(
        `${frameName}_origin`,
        { diameter: 0.015 },
        scene
      );
      originSphere.position = BABYLON.Vector3.Zero();
      originSphere.isPickable = true;
      originSphere.parent = frameRoot;

      // Make the sphere semi-transparent white
      const sphereMat = new BABYLON.StandardMaterial(`${frameName}_origin_mat`, scene);
      sphereMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
      sphereMat.emissiveColor = new BABYLON.Color3(0.8, 0.8, 0.8);
      sphereMat.alpha = 0.4;
      sphereMat.disableLighting = true;
      originSphere.material = sphereMat;
      originSphere.metadata = { isFramePart: true, frameRoot: frameRoot };

      const BASE_SIZE = 0.1;
      const camera = scene.activeCamera;
      let initialScale = 1.0;
      if (camera) {
        const distanceToPoint = BABYLON.Vector3.Distance(camera.position, origin);
        let frameSize = distanceToPoint * 0.1;
        const MIN_SIZE = 0.05;
        const MAX_SIZE = 2.0;
        frameSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, frameSize));
        initialScale = frameSize / BASE_SIZE;
      }

      frameRoot.scaling = new BABYLON.Vector3(initialScale, initialScale, initialScale);

      const { permanentFrames } = get();
      set({
        permanentFrames: [...permanentFrames, { rootNode: frameRoot, originPoint: origin, baseSize: BASE_SIZE }]
      });

      const framesCollection = tree.getFramesNode();
      const assetsCollection = tree.getAssetsNode();
      const parentCollectionId = framesCollection?.id ?? assetsCollection?.id ?? null;

      if (parentCollectionId) {
        const frameNode = tree.createNode('collection', frameName, parentCollectionId);
        frameNode.babylonTransformNodeId = frameRoot.uniqueId.toString();
        frameNode.locked = false;
        frameNode.visible = true;
        window.dispatchEvent(new Event('scenetree-update'));
      } else {
        console.warn('[AddFrame] No valid parent collection found for frame node');
      }

      toast.success('Coordinate frame added to scene');
      console.log('[AddFrame] Permanent frame created:', frameName);
    } catch (error) {
      console.error('[AddFrame] Error creating permanent frame:', error);
      toast.error('Failed to create frame');
    }
  },

  cleanupDisposedFrames: () => {
    const { permanentFrames } = get();
    const activeFrames = permanentFrames.filter((frameData) => {
      return frameData.rootNode && !frameData.rootNode.isDisposed();
    });
    set({ permanentFrames: activeFrames });
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
  };
});
