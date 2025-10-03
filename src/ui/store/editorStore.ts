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
import { saveWorldToFile, loadWorldFromFile, restoreWorldState } from '../../scene/WorldSerializer';
import { CustomFrameHelper } from '../../scene/CustomFrameHelper';
import { CoordinateFrameWidget } from '../../scene/CoordinateFrameWidget';
import type { NodeType } from '../../scene/SceneTreeNode';

type ObjectType = 'box' | 'sphere' | 'cylinder';

interface EditorState {
  // State
  selectedMeshes: BABYLON.Mesh[];
  selectedNodeId: string | null;
  transformMode: TransformMode;
  camera: BABYLON.Camera | null;
  isPlaying: boolean;
  customFrameSelectionMode: 'none' | CustomFrameFeatureType;
  customFrame: CustomFrameFeature | null;
  coordinateFrameWidget: CoordinateFrameWidget | null;

  // Actions
  selectMesh: (mesh: BABYLON.Mesh) => void;
  selectNode: (nodeId: string) => void;
  deselectMesh: (mesh: BABYLON.Mesh) => void;
  clearSelection: () => void;
  toggleMeshSelection: (mesh: BABYLON.Mesh) => void;
  togglePhysics: (nodeId: string) => void;
  createCollection: (name?: string) => void;
  deleteNode: (nodeId: string) => void;
  renameNode: (nodeId: string, newName: string) => void;
  moveNode: (nodeId: string, newParentId: string | null) => void;
  saveWorld: () => void;
  loadWorld: (file: File) => Promise<void>;
  setTransformMode: (mode: TransformMode) => void;
  setCamera: (camera: BABYLON.Camera) => void;
  togglePlayback: () => void;
  createObject: (type: ObjectType) => void;
  importModel: (file: File) => Promise<void>;
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
  transformMode: DEFAULT_TRANSFORM_MODE,
  camera: null,
  isPlaying: false,
  customFrameSelectionMode: 'none',
  customFrame: null,
  coordinateFrameWidget: null,

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
    set({ selectedNodeId: nodeId });

    // Also select corresponding mesh
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (node && node.babylonMeshId) {
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      if (scene) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh && mesh instanceof BABYLON.Mesh) {
          set({ selectedMeshes: [mesh] });
        }
      }
    }
  },

  deselectMesh: (mesh) => {
    set({
      selectedMeshes: get().selectedMeshes.filter((m) => m !== mesh),
    });
  },

  clearSelection: () => {
    set({ selectedMeshes: [], selectedNodeId: null });
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

    // If it has an entity, remove it
    if (node.entityId) {
      const registry = EntityRegistry.getInstance();
      registry.remove(node.entityId);
    }

    // Remove from tree (this will also remove all children)
    tree.deleteNode(nodeId);

    // Clear selection if deleted node was selected
    if (get().selectedNodeId === nodeId) {
      get().clearSelection();
    }

    window.dispatchEvent(new Event('scenetree-update'));
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

    // Create entity with physics disabled by default
    const entity = registry.create({
      mesh,
      physics: {
        enabled: false, // Disabled by default
        type: 'dynamic',
        shape: type,
        mass: 1.0,
        // Shape-specific parameters
        ...(type === 'box' && { dimensions: { x: 2, y: 2, z: 2 } }),
        ...(type === 'sphere' && { radius: 1 }), // diameter 2 / 2 = radius 1
        ...(type === 'cylinder' && { radius: 0.5, height: 2 }), // diameter 1 / 2 = radius 0.5
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
  },

  // Import 3D model from file
  importModel: async (file: File) => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    const tree = SceneTreeManager.getInstance();
    const assetsNode = tree.getAssetsNode();

    try {
      // Load model - now returns both meshes and root nodes
      const { meshes, rootNodes } = await loadModelFromFile(file, scene);

      console.log('=== GLB Import Analysis ===');
      console.log(`Total nodes: ${rootNodes.length}`);
      rootNodes.forEach(node => {
        console.log(`Root: ${node.name} (${node.constructor.name})`);
        const children = getAllChildren(node);
        console.log(`  Children: ${children.length}`);
        children.slice(0, 5).forEach(child => {
          console.log(`    - ${child.name} (${child.constructor.name})`);
        });
      });

      // Create a collection for this model
      const modelName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const modelCollection = tree.createNode(
        'collection',
        modelName,
        assetsNode?.id || null
      );

      // Recursive function - creates tree nodes for all nodes (TransformNodes and Meshes)
      const buildTreeForNode = (node: BABYLON.TransformNode, parentNodeId: string | null, depth: number = 0): void => {
        const isMesh = node instanceof BABYLON.Mesh;
        const children = getAllChildren(node);

        console.log(`${'  '.repeat(depth)}${node.name} (${node.constructor.name}) - ${children.length} children`);

        // Skip __root__ container nodes - process children directly
        if (node.name === '__root__' || node.name.startsWith('__root')) {
          for (const child of children) {
            buildTreeForNode(child, parentNodeId, depth);
          }
          return;
        }

        // Create tree node
        const treeNode = tree.createNode(
          isMesh ? 'mesh' : 'collection',
          node.name || 'Unnamed',
          parentNodeId,
          babylonToUser(node.position)
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

      console.log(`Imported ${meshes.length} meshes with ${rootNodes.length} root nodes`);
    } catch (error) {
      console.error('Failed to import model:', error);
      alert(`Failed to import model: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // Update Babylon mesh if it exists
    if (node.babylonMeshId) {
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      if (scene) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh) {
          const babylonPos = userToBabylon(position);
          mesh.position.copyFrom(babylonPos);

          // Sync to physics if entity exists
          if (node.entityId) {
            const registry = EntityRegistry.getInstance();
            const entity = registry.get(node.entityId);
            entity?.syncToPhysics();
          }
        }
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

    // Update Babylon mesh if it exists
    if (node.babylonMeshId) {
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      if (scene) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh instanceof BABYLON.Mesh) {
          // Convert degrees to radians
          const radiansX = (rotation.x * Math.PI) / 180;
          const radiansY = (rotation.y * Math.PI) / 180;
          const radiansZ = (rotation.z * Math.PI) / 180;

          mesh.rotation.set(radiansX, radiansY, radiansZ);

          // Sync to physics if entity exists
          if (node.entityId) {
            const registry = EntityRegistry.getInstance();
            const entity = registry.get(node.entityId);
            entity?.syncToPhysics();
          }
        }
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

    // Update Babylon mesh if it exists
    if (node.babylonMeshId) {
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      if (scene) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh instanceof BABYLON.Mesh) {
          mesh.scaling.set(scale.x, scale.y, scale.z);

          // Note: Scaling doesn't sync to physics as it would require recreating the collider
        }
      }
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
        case 'object':
          frame = CustomFrameHelper.calculateObjectFrame(mesh, selectedNodeId || mesh.uniqueId.toString());
          break;

        case 'face':
          const faceIndex = CustomFrameHelper.findClosestFace(mesh, pickPoint);
          if (faceIndex !== null) {
            frame = CustomFrameHelper.calculateFaceFrame(
              mesh,
              selectedNodeId || mesh.uniqueId.toString(),
              faceIndex
            );
          }
          break;

        case 'edge':
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

        case 'vertex':
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
