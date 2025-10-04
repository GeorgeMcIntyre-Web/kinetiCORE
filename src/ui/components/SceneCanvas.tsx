// Scene Canvas component - renders Babylon.js scene
// Owner: Edwin/Cole

import { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { RapierPhysicsEngine } from '../../physics/RapierPhysicsEngine';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { TransformGizmo } from '../../manipulation/TransformGizmo';
import { useEditorStore } from '../store/editorStore';
import { useUserLevel } from '../core/UserLevelContext';
import { CoordinateFrame } from './CoordinateFrame';
import { ContextMenu, useViewportContextMenu } from './ContextMenu';
import { CameraViewControls } from './CameraViewControls';

export const SceneCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { userLevel } = useUserLevel();
  const setCamera = useEditorStore((state) => state.setCamera);
  const camera = useEditorStore((state) => state.camera);
  const selectedMeshes = useEditorStore((state) => state.selectedMeshes);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const transformMode = useEditorStore((state) => state.transformMode);
  const selectMesh = useEditorStore((state) => state.selectMesh);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const createObject = useEditorStore((state) => state.createObject);
  const initializeCoordinateFrameWidget = useEditorStore((state) => state.initializeCoordinateFrameWidget);
  const gizmoRef = useRef<TransformGizmo | null>(null);
  const highlightLayerRef = useRef<BABYLON.HighlightLayer | null>(null);

  const { contextMenu, showContextMenu, hideContextMenu } = useViewportContextMenu();
  const [menuItems, setMenuItems] = useState<any[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sceneManager = SceneManager.getInstance();
    const physicsEngine = new RapierPhysicsEngine();
    const registry = EntityRegistry.getInstance();

    // Initialize scene and physics
    Promise.all([sceneManager.initialize(canvas), physicsEngine.initialize()]).then(() => {
      const camera = sceneManager.getCamera();
      const scene = sceneManager.getScene();

      if (camera) {
        setCamera(camera);
      }

      if (scene) {
        // Set up physics engine in registry
        registry.setPhysicsEngine(physicsEngine);

        // Create static physics body for ground
        const ground = sceneManager.getGround();
        if (ground) {
          registry.create({
            mesh: ground,
            physics: {
              enabled: true,
              type: 'static', // Static body - won't move
              shape: 'box',
            },
            metadata: {
              name: 'ground',
              type: 'ground',
            },
          });
        }

        // Initialize coordinate frame widget for TransformNode visualization
        initializeCoordinateFrameWidget();

        // Create transform gizmo
        gizmoRef.current = new TransformGizmo(scene);

        // Create highlight layer for visual selection feedback
        highlightLayerRef.current = new BABYLON.HighlightLayer('highlight', scene);
        highlightLayerRef.current.innerGlow = false;
        highlightLayerRef.current.outerGlow = true;

        // Add click selection
        scene.onPointerDown = (evt, pickResult) => {
          if (evt.button === 0) {
            // Left click - always close context menu
            hideContextMenu();

            if (pickResult.hit && pickResult.pickedMesh) {
              const mesh = pickResult.pickedMesh;

              // Ignore ground, axis meshes, and widget elements
              if (
                mesh.name !== 'ground' &&
                !mesh.name.startsWith('axis') &&
                !mesh.name.startsWith('widget') &&
                !mesh.name.startsWith('label') &&
                mesh instanceof BABYLON.Mesh
              ) {
                // Ctrl+Click for multi-selection
                if (evt.ctrlKey || evt.metaKey) {
                  // Find the node ID for this mesh
                  const tree = SceneTreeManager.getInstance();
                  const registry = EntityRegistry.getInstance();
                  const entity = registry.getEntityByMeshId(mesh.uniqueId);

                  if (entity && entity.sceneNodeId) {
                    const state = useEditorStore.getState();
                    state.toggleNodeSelection(entity.sceneNodeId);
                  }
                } else {
                  // Regular click - replace selection
                  clearSelection();
                  selectMesh(mesh);
                }
              }
            } else {
              // Clicked on empty space - clear selection unless Ctrl is held
              if (!evt.ctrlKey && !evt.metaKey) {
                clearSelection();
              }
            }
          } else if (evt.button === 2) {
            // Right click - context menu handled by onContextMenu prop
            evt.preventDefault();
          }
        };

        // Physics update loop
        const engine = sceneManager.getEngine();
        engine?.runRenderLoop(() => {
          // Step physics (fixed 60 FPS timestep)
          physicsEngine.step(1 / 60);

          // Sync all entities from physics to meshes
          registry.syncAllFromPhysics();

          // Render scene
          scene.render();
        });
      }
    });

    // Cleanup on unmount
    return () => {
      gizmoRef.current?.dispose();
      physicsEngine.dispose();
      registry.clear();
      sceneManager.dispose();
    };
  }, [setCamera, selectMesh, clearSelection, initializeCoordinateFrameWidget]);

  // Update gizmo when selection or mode changes
  useEffect(() => {
    if (!gizmoRef.current) return;

    if (selectedMeshes.length > 0) {
      // Attach gizmo to first selected mesh
      gizmoRef.current.attachToMesh(selectedMeshes[0]);
      gizmoRef.current.setMode(transformMode);
    } else {
      // Detach gizmo when nothing selected
      gizmoRef.current.attachToMesh(null);
    }
  }, [selectedMeshes, transformMode]);

  // Update highlight layer for multi-selection visual feedback
  useEffect(() => {
    if (!highlightLayerRef.current) return;

    const highlightLayer = highlightLayerRef.current;
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // Clear all highlights
    highlightLayer.removeAllMeshes();

    // Get all selected node IDs (includes multi-selection)
    const allSelectedIds = selectedNodeIds.length > 0 ? selectedNodeIds :
                           (selectedMeshes.length > 0 ? [useEditorStore.getState().selectedNodeId].filter(Boolean) : []);

    if (allSelectedIds.length > 0) {
      const registry = EntityRegistry.getInstance();
      const tree = SceneTreeManager.getInstance();

      // Highlight all selected meshes
      allSelectedIds.forEach((nodeId, index) => {
        if (!nodeId) return;
        const node = tree.getNode(nodeId);
        if (!node || node.type !== 'mesh' || !node.babylonMeshId) return;

        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh && mesh instanceof BABYLON.Mesh) {
          // Use different colors for multi-selection: first = green, others = orange
          const color = index === 0
            ? new BABYLON.Color3(0.28, 0.73, 0.47) // Green for primary selection
            : new BABYLON.Color3(1.0, 0.6, 0.0);    // Orange for additional selections

          highlightLayer.addMesh(mesh, color);
        }
      });
    }
  }, [selectedNodeIds, selectedMeshes]);

  // Position canvas to overlay the active viewport div
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Determine viewport ID based on user level
    const viewportId = `viewport-${userLevel}`;

    const updatePosition = () => {
      const viewportElement = document.getElementById(viewportId);
      if (!viewportElement) {
        // Hide canvas if viewport not found
        container.style.display = 'none';
        return;
      }

      const rect = viewportElement.getBoundingClientRect();
      container.style.display = 'block';
      container.style.position = 'fixed';
      container.style.top = `${rect.top}px`;
      container.style.left = `${rect.left}px`;
      container.style.width = `${rect.width}px`;
      container.style.height = `${rect.height}px`;
      container.style.pointerEvents = 'auto';

      // Trigger engine resize to match new dimensions
      const sceneManager = SceneManager.getInstance();
      const engine = sceneManager.getEngine();
      if (engine) {
        engine.resize();
      }
    };

    // Initial positioning
    updatePosition();

    // Watch for window resize
    window.addEventListener('resize', updatePosition);

    // Use ResizeObserver to track viewport changes
    const viewportElement = document.getElementById(viewportId);
    let resizeObserver: ResizeObserver | null = null;

    if (viewportElement) {
      resizeObserver = new ResizeObserver(updatePosition);
      resizeObserver.observe(viewportElement);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', updatePosition);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [userLevel]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const items = showContextMenu(e, (type: string) => {
      if (type === 'box' || type === 'sphere' || type === 'cylinder') {
        createObject(type);
      }
    });
    setMenuItems(items);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        zIndex: 1,
        pointerEvents: 'none',
      }}
      onContextMenu={handleContextMenu}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          outline: 'none',
          pointerEvents: 'auto',
        }}
      />

      {/* Camera view controls */}
      <CameraViewControls />

      {/* Multi-selection indicator */}
      {selectedNodeIds.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2
                        bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg
                        flex items-center gap-2 z-20 pointer-events-none
                        animate-fade-in">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="font-semibold text-sm">
            {selectedNodeIds.length} objects selected
          </span>
          <span className="text-xs opacity-75">
            (Ctrl+Click to deselect)
          </span>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={hideContextMenu}
        />
      )}

      {camera && <CoordinateFrame camera={camera as BABYLON.ArcRotateCamera} />}
    </div>
  );
};
