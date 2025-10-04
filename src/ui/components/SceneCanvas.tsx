// Scene Canvas component - renders Babylon.js scene
// Owner: Edwin/Cole

import { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
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
  const transformMode = useEditorStore((state) => state.transformMode);
  const selectMesh = useEditorStore((state) => state.selectMesh);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const createObject = useEditorStore((state) => state.createObject);
  const initializeCoordinateFrameWidget = useEditorStore((state) => state.initializeCoordinateFrameWidget);
  const gizmoRef = useRef<TransformGizmo | null>(null);

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

        // Add click selection
        scene.onPointerDown = (evt, pickResult) => {
          if (evt.button === 0) {
            // Left click
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
                clearSelection();
                selectMesh(mesh);
              }
            } else {
              // Clicked on empty space - clear selection
              clearSelection();
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
