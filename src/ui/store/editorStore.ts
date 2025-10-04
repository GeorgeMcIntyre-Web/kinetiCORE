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
import { loadURDFWithMeshes } from '../../loaders/urdf/URDFLoaderWithMeshes';
import { saveWorldToFile, loadWorldFromFile, restoreWorldState } from '../../scene/WorldSerializer';
import { CustomFrameHelper } from '../../scene/CustomFrameHelper';
import { CoordinateFrameWidget } from '../../scene/CoordinateFrameWidget';
import type { NodeType } from '../../scene/SceneTreeNode';
import { toast } from '../components/ToastNotifications';
import { loading } from '../components/LoadingIndicator';
import { CommandManager } from '../../history/CommandManager';
import { DeleteObjectCommand } from '../../history/commands/DeleteObjectCommand';
import { DuplicateObjectCommand } from '../../history/commands/DuplicateObjectCommand';

type ObjectType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane' | 'ground' | 'capsule' | 'disc' | 'torusknot' | 'polyhedron';

interface EditorState {
  // State
  selectedMeshes: BABYLON.Mesh[];
  selectedNodeId: string | null;
  selectedNodeIds: string[]; // Multi-selection support
  transformMode: TransformMode;
  camera: BABYLON.Camera | null;
  isPlaying: boolean;
  customFrameSelectionMode: 'none' | CustomFrameFeatureType;
  customFrame: CustomFrameFeature | null;
  coordinateFrameWidget: CoordinateFrameWidget | null;
  commandManager: CommandManager;

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
  setTransformMode: (mode: TransformMode) => void;
  setCamera: (camera: BABYLON.Camera) => void;
  togglePlayback: () => void;
  createObject: (type: ObjectType) => void;
  importModel: (file: File) => Promise<void>;
  importURDFFolder: (files: File[]) => Promise<void>;
  updateNodePosition: (nodeId: string, position: { x: number; y: number; z: number }) => void;
  updateNodeRotation: (nodeId: string, rotation: { x: number; y: number; z: number }) => void;
  updateNodeScale: (nodeId: string, scale: { x: number; y: number; z: number }) => void;
  setCustomFrameSelectionMode: (mode: 'none' | CustomFrameFeatureType) => void;
  setCustomFrame: (frame: CustomFrameFeature | null) => void;
  handleSceneClickForCustomFrame: (pickInfo: BABYLON.PickingInfo) => void;
  initializeCoordinateFrameWidget: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  selectedMeshes: [],
  selectedNodeId: null,
  selectedNodeIds: [],
  transformMode: DEFAULT_TRANSFORM_MODE,
  camera: null,
  isPlaying: false,
  customFrameSelectionMode: 'none',
  customFrame: null,
  coordinateFrameWidget: null,
  commandManager: new CommandManager(),

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

      // Also select corresponding node in tree
      const tree = SceneTreeManager.getInstance();
      const node = tree.getNodeByBabylonMeshId(mesh.uniqueId.toString());
      if (node) {
        set({ selectedNodeId: node.id });
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

    // If it's a mesh node with babylonMeshId
    if (node && node.babylonMeshId && scene) {
      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
      if (mesh && mesh instanceof BABYLON.Mesh) {
        set({ selectedMeshes: [mesh] });
      }
    }

    // If it's a collection/TransformNode, show coordinate frame at its origin
    if (node && node.type === 'collection' && scene) {
      const transformNode = scene.transformNodes.find(tn => tn.name === node.name);
      if (transformNode && coordinateFrameWidget) {
        // Get world position and orientation of TransformNode
        const worldMatrix = transformNode.computeWorldMatrix(true);
        const position = worldMatrix.getTranslation();

        // Get rotation axes from world matrix (direction vectors, not positions)
        const xAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Right(), worldMatrix).normalize();
        const yAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Up(), worldMatrix).normalize();
        const zAxis = BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Forward(), worldMatrix).normalize();

        // Create custom frame feature for visualization
        // NOTE: CoordinateFrameWidget.show() will call userToBabylon on origin, so pass user coords
        const frame: CustomFrameFeature = {
          featureType: 'object',
          nodeId: nodeId,
          origin: babylonToUser(position),
          xAxis: { x: xAxis.x, y: xAxis.y, z: xAxis.z },
          yAxis: { x: yAxis.x, y: yAxis.y, z: yAxis.z },
          zAxis: { x: zAxis.x, y: zAxis.y, z: zAxis.z },
        };

        // Calculate appropriate axis length based on bounding box
        const meshes = transformNode.getChildMeshes(false);
        let axisLength = 0.1; // Default 0.1 Babylon units (100mm)

        if (meshes.length > 0) {
          // Calculate combined bounding box diagonal
          let minX = Infinity, minY = Infinity, minZ = Infinity;
          let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

          meshes.forEach(mesh => {
            if (!mesh.isVisible) return;
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

          const diagonal = Math.sqrt(
            (maxX - minX) ** 2 + (maxY - minY) ** 2 + (maxZ - minZ) ** 2
          );

          // Set axis length to 20% of diagonal (in Babylon units = meters)
          axisLength = diagonal * 0.2;
        }

        coordinateFrameWidget.show(frame, axisLength);
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
      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
      if (mesh) {
        sceneManager.zoomToMesh(mesh);
      }
    }
    // If it's a collection/TransformNode, find by name and zoom to all children
    else if (node.type === 'collection') {
      const transformNode = scene.transformNodes.find(tn => tn.name === node.name);
      if (transformNode) {
        sceneManager.zoomToNode(transformNode);
      }
    }
  },

  zoomFit: () => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const camera = get().camera;

    if (!scene || !camera || !(camera instanceof BABYLON.ArcRotateCamera)) return;

    // Get all visible meshes (excluding ground)
    const meshes = scene.meshes.filter((m: BABYLON.AbstractMesh) =>
      m.isVisible && m.name !== 'ground'
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

    set({ selectedMeshes: [], selectedNodeId: null, selectedNodeIds: [] });
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

  // Import 3D model from file
  importModel: async (file: File) => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    const tree = SceneTreeManager.getInstance();
    const assetsNode = tree.getAssetsNode();

    loading.start('Loading model...', 'uploading');

    try {
      // Load model - now returns both meshes and root nodes
      const { meshes, rootNodes } = await loadModelFromFile(file, scene);
      loading.update('Processing geometry...', 50);

      // Check if this is a URDF robot with missing meshes
      const isURDF = file.name.endsWith('.urdf');
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

      // Create a collection for this model
      const modelCollection = tree.createNode(
        'collection',
        modelName,
        assetsNode?.id || null
      );

      // Recursive function - creates tree nodes for all nodes (TransformNodes and Meshes)
      const buildTreeForNode = (node: BABYLON.TransformNode, parentNodeId: string | null, depth: number = 0): void => {
        const isMesh = node instanceof BABYLON.Mesh;
        const children = getAllChildren(node);

        // Skip __root__ and duplicate filename nodes - process children directly
        if (node.name === '__root__' ||
            node.name.startsWith('__root') ||
            node.name === modelName) {
          for (const child of children) {
            buildTreeForNode(child, parentNodeId, depth);
          }
          return;
        }

        // Create tree node
        // Check if this is a URDF object (uses Babylon native coordinates)
        const isURDF = node.metadata?.isURDFMesh || node.metadata?.coordinateSystem === 'babylon-native';
        const position = isURDF
          ? { x: node.position.x * 1000, y: node.position.y * 1000, z: node.position.z * 1000 }  // Just convert meters to mm
          : babylonToUser(node.position);  // Full conversion with axis swap

        const treeNode = tree.createNode(
          isMesh ? 'mesh' : 'collection',
          node.name || 'Unnamed',
          parentNodeId,
          position
        );

        // Link to mesh if applicable
        if (isMesh) {
          treeNode.babylonMeshId = node.uniqueId.toString();
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

      // Expand the collection to show contents
      tree.toggleExpanded(modelCollection.id);

      // Notify tree to update
      window.dispatchEvent(new Event('scenetree-update'));

      loading.update('Finalizing...', 90);
      loading.end();
      toast.success(`Imported ${meshes.length} meshes from ${file.name}`);
      console.log(`Imported ${meshes.length} meshes with ${rootNodes.length} root nodes`);
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

    loading.start('Loading URDF folder...', 'uploading');

    try {
      // Find the URDF file
      const urdfFile = files.find(f => f.name.endsWith('.urdf'));
      if (!urdfFile) {
        throw new Error('No URDF file found in selected folder');
      }

      console.log(`Found URDF: ${urdfFile.name}`);
      console.log(`Total files: ${files.length}`);

      // Load URDF with meshes
      const { meshes, rootNodes } = await loadURDFWithMeshes(urdfFile, files, scene);
      loading.update('Processing geometry...', 50);

      // Get the model name from the file
      const modelName = urdfFile.name.substring(0, urdfFile.name.lastIndexOf('.')) || urdfFile.name;

      // Create a collection for this model
      const modelCollection = tree.createNode(
        'collection',
        modelName,
        assetsNode?.id || null
      );

      // Recursive function - creates tree nodes for all nodes (TransformNodes and Meshes)
      const buildTreeForNode = (node: BABYLON.TransformNode, parentNodeId: string | null, depth: number = 0): void => {
        const isMesh = node instanceof BABYLON.Mesh;
        const children = getAllChildren(node);

        // Skip __root__ and duplicate filename nodes - process children directly
        if (node.name === '__root__' ||
            node.name.startsWith('__root') ||
            node.name === modelName) {
          for (const child of children) {
            buildTreeForNode(child, parentNodeId, depth);
          }
          return;
        }

        // Create tree node
        // Check if this is a URDF object (uses Babylon native coordinates)
        const isURDF = node.metadata?.isURDFMesh || node.metadata?.coordinateSystem === 'babylon-native';
        const position = isURDF
          ? { x: node.position.x * 1000, y: node.position.y * 1000, z: node.position.z * 1000 }  // Just convert meters to mm
          : babylonToUser(node.position);  // Full conversion with axis swap

        const treeNode = tree.createNode(
          isMesh ? 'mesh' : 'collection',
          node.name || 'Unnamed',
          parentNodeId,
          position
        );

        // Link to mesh if applicable
        if (isMesh) {
          treeNode.babylonMeshId = node.uniqueId.toString();
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

      // Expand the collection to show contents
      tree.toggleExpanded(modelCollection.id);

      // Notify tree to update
      window.dispatchEvent(new Event('scenetree-update'));

      loading.update('Finalizing...', 90);
      loading.end();
      toast.success(`Imported URDF robot with ${meshes.length} meshes`);
      console.log(`Imported ${meshes.length} meshes with ${rootNodes.length} root nodes`);
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

  // Load world from file
  loadWorld: async (file: File) => {
    try {
      const worldData = await loadWorldFromFile(file);
      if (!worldData) {
        alert('Failed to load world file. Invalid format.');
        return;
      }

      // Restore world state
      const success = restoreWorldState(worldData);
      if (success) {
        console.log('World loaded successfully');
        window.dispatchEvent(new Event('scenetree-update'));
      } else {
        alert('Failed to restore world state.');
      }
    } catch (error) {
      console.error('Failed to load world:', error);
      alert('Failed to load world. Check console for details.');
    }
  },

  // Transform update actions
  updateNodePosition: (nodeId: string, position: { x: number; y: number; z: number }) => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node) return;

    // Update local position in tree
    tree.setLocalPosition(nodeId, position);

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    const babylonPos = userToBabylon(position);

    // Update Babylon node (Mesh or TransformNode)
    let babylonNode: BABYLON.TransformNode | null = null;
    if (node.babylonMeshId) {
      // It's a mesh
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
    } else if (node.type === 'collection') {
      // It's a collection/TransformNode - find by name
      babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
    }

    if (babylonNode) {
      babylonNode.position.copyFrom(babylonPos);

      // Sync to physics if entity exists (only for meshes)
      if (node.entityId) {
        const registry = EntityRegistry.getInstance();
        const entity = registry.get(node.entityId);
        entity?.syncToPhysics();
      }
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
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
    } else if (node.type === 'collection') {
      babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
    }

    if (babylonNode) {
      babylonNode.rotation.set(radiansX, radiansY, radiansZ);

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
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
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
}));
