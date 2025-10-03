// Scene Canvas component - renders Babylon.js scene
// Owner: Edwin/Cole

import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { CollisionVisualizer } from '../../scene/CollisionVisualizer';
import { CollisionAnalyzer } from '../../scene/CollisionAnalyzer';
import { RapierPhysicsEngine } from '../../physics/RapierPhysicsEngine';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { TransformGizmo } from '../../manipulation/TransformGizmo';
import { useEditorStore } from '../store/editorStore';
import { CoordinateFrame } from './CoordinateFrame';

export const SceneCanvas = () => {
  const canvasRef = useRef(null as any);
  const setCamera = (useEditorStore as any)((state: any) => state.setCamera);
  const camera = (useEditorStore as any)((state: any) => state.camera);
  const selectedMeshes = (useEditorStore as any)((state: any) => state.selectedMeshes);
  const transformMode = (useEditorStore as any)((state: any) => state.transformMode);
  const selectMesh = (useEditorStore as any)((state: any) => state.selectMesh);
  const clearSelection = (useEditorStore as any)((state: any) => state.clearSelection);
  const initializeCoordinateFrameWidget = (useEditorStore as any)((state: any) => state.initializeCoordinateFrameWidget);
  const gizmoRef = useRef(null as any);
  const visualizerRef = useRef(null as any);

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
        scene.onPointerDown = (evt: any, pickResult: any) => {
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
          }
        };

        // Physics update loop
        const engine = sceneManager.getEngine();
        engine?.runRenderLoop(() => {
          // Step physics (fixed 60 FPS timestep)
          physicsEngine.step(1 / 60);

          // Sync all entities from physics to meshes
          registry.syncAllFromPhysics();

          // Visualize collisions
          const manifolds = (physicsEngine as any).getAllCollisions?.() || [];
          const contacts = manifolds.flatMap((m: any) => m.contacts);
          if (!visualizerRef.current) {
            visualizerRef.current = new CollisionVisualizer(scene);
          }
          visualizerRef.current.update(contacts, manifolds);

          // Optional: periodic analysis log
          if (Math.random() < 0.016) {
            const analysis = CollisionAnalyzer.analyze(contacts, manifolds);
            if (analysis.totalContacts > 0) {
              console.log(CollisionAnalyzer.generateReport(analysis));
            }
          }

          // Render scene
          scene.render();
        });
      }
    });

    // Cleanup on unmount
    return () => {
      gizmoRef.current?.dispose();
      visualizerRef.current?.dispose();
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          outline: 'none',
        }}
      />
      {camera && <CoordinateFrame camera={camera as any} />}
    </div>
  );
};
