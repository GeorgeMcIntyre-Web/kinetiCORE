// Scene Canvas component - renders Babylon.js scene
// Owner: Edwin/Cole

import { useEffect, useRef, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { RapierPhysicsEngine } from '../../physics/RapierPhysicsEngine';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { TransformGizmo } from '../../manipulation/TransformGizmo';
import { useEditorStore } from '../store/editorStore';
import { useUserLevel } from '../core/UserLevelContext';
import { CoordinateFrame } from './CoordinateFrame';
import { isZoomableObject, isSelectableObject } from '../../scene/SceneUtils';
import { performanceMetrics } from '../../core/PerformanceMetrics';

export const SceneCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { userLevel } = useUserLevel();
  const setCamera = useEditorStore((state) => state.setCamera);
  const camera = useEditorStore((state) => state.camera);
  const showCoordinateOverlay = useEditorStore((state) => state.showCoordinateOverlay);
  const selectedMeshes = useEditorStore((state) => state.selectedMeshes);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  // const selectedCollectionNodeId = useEditorStore((state) => state.selectedCollectionNodeId);
  const selectedCollectionTransformNode = useEditorStore((state) => state.selectedCollectionTransformNode);
  const transformMode = useEditorStore((state) => state.transformMode);
  const selectMesh = useEditorStore((state) => state.selectMesh);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const initializeCoordinateFrameWidget = useEditorStore((state) => state.initializeCoordinateFrameWidget);
  const handleAlignClick = useEditorStore((state) => state.handleAlignClick);
  const handleSceneClickForCustomFrame = useEditorStore((state) => state.handleSceneClickForCustomFrame);
  
  // Snap settings - ALL 13 snap types
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const snapToGrid = useEditorStore((state) => state.snapToGrid);
  const snapToVertex = useEditorStore((state) => state.snapToVertex);
  const snapToEdge = useEditorStore((state) => state.snapToEdge);
  const snapToFace = useEditorStore((state) => state.snapToFace);
  const snapToCenter = useEditorStore((state) => state.snapToCenter);
  const snapToObject = useEditorStore((state) => state.snapToObject);
  const snapToMidpoint = useEditorStore((state) => state.snapToMidpoint);
  const snapToIntersection = useEditorStore((state) => state.snapToIntersection);
  const snapToPerpendicular = useEditorStore((state) => state.snapToPerpendicular);
  const snapToTangent = useEditorStore((state) => state.snapToTangent);
  const snapAlong = useEditorStore((state) => state.snapAlong);
  const snapToNormal = useEditorStore((state) => state.snapToNormal);
  const snapToPlane = useEditorStore((state) => state.snapToPlane);
  const snapToAxis = useEditorStore((state) => state.snapToAxis);
  const snapToCurve = useEditorStore((state) => state.snapToCurve);
  const snapToSurface = useEditorStore((state) => state.snapToSurface);
  const snapObjectToVertex = useEditorStore((state) => state.snapObjectToVertex);
  const snapPointOnEdge = useEditorStore((state) => state.snapPointOnEdge);
  const snapBBoxCorner = useEditorStore((state) => state.snapBBoxCorner);
  const gridSize = useEditorStore((state) => state.gridSize);
  const snapDistance = useEditorStore((state) => state.snapDistance);
  const gizmoRef = useRef<TransformGizmo | null>(null);
  // const highlightLayerRef = useRef<BABYLON.HighlightLayer | null>(null); // Replaced with direct material color changes
  const originalMaterialsRef = useRef<Map<string, BABYLON.Material | null>>(new Map());
  const hoveredMeshRef = useRef<BABYLON.AbstractMesh | null>(null);
  const hoverHighlightLayerRef = useRef<BABYLON.HighlightLayer | null>(null);
  
  const clearHoverHighlight = useCallback(() => {
    const currentHover = hoveredMeshRef.current;
    if (!currentHover) {
      return;
    }

    if (hoverHighlightLayerRef.current) {
      hoverHighlightLayerRef.current.removeMesh(currentHover as unknown as BABYLON.Mesh);
    }

    hoveredMeshRef.current = null;
  }, []);

  const applyHoverHighlight = useCallback(
    (mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene) => {
      if (hoveredMeshRef.current && hoveredMeshRef.current.uniqueId === mesh.uniqueId) {
        return;
      }

      clearHoverHighlight();

      if (!hoverHighlightLayerRef.current) {
        const hoverLayer = new BABYLON.HighlightLayer('hoverHighlightLayer', scene);
        hoverLayer.innerGlow = false;
        hoverLayer.outerGlow = true;
        hoverLayer.blurHorizontalSize = 1.2;
        hoverLayer.blurVerticalSize = 1.2;
        hoverHighlightLayerRef.current = hoverLayer;
      }

      const hoverColor = new BABYLON.Color3(1.0, 0.95, 0.65);
      hoverHighlightLayerRef.current.addMesh(mesh as unknown as BABYLON.Mesh, hoverColor);
      console.log(
        '[SceneCanvas] Hover highlight applied:',
        mesh.name,
        '(id:',
        mesh.uniqueId,
        ')'
      );
      hoveredMeshRef.current = mesh;
    },
    [clearHoverHighlight]
  );


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

      // Expose managers to window for console debugging
      (window as any).sceneManager = sceneManager;

      // Expose kinematics managers for debug tools
      import('../../kinematics/KinematicsManager').then(({ KinematicsManager }) => {
        (window as any).kinematicsManager = KinematicsManager.getInstance();
        (window as any).KinematicsManager = KinematicsManager;
      });
      import('../../kinematics/ForwardKinematicsSolver').then(({ ForwardKinematicsSolver }) => {
        (window as any).fkSolver = ForwardKinematicsSolver.getInstance();
        (window as any).ForwardKinematicsSolver = ForwardKinematicsSolver;
      });
      import('../../kinematics/InverseKinematicsSolver').then(({ InverseKinematicsSolver }) => {
        (window as any).ikSolver = InverseKinematicsSolver.getInstance();
        (window as any).InverseKinematicsSolver = InverseKinematicsSolver;
      });

      console.log('💡 Tip: Change floor via console with: sceneManager.setFloorType("epoxy-gray")');
      console.log('💡 Tip: Toggle background transparency with: sceneManager.setBackgroundTransparent(true/false)');
      console.log('💡 Tip: Check transparency state with: sceneManager.isBackgroundTransparent()');
      console.log('💡 Tip: Force transparent background with: sceneManager.forceTransparentBackground()');
      console.log('💡 Debug: Kinematics managers available: kinematicsManager, fkSolver, ikSolver');

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

        // Initialize UnifiedGizmoManager for TCP control and IK targets
        import('../../kinematics/UnifiedGizmoManager').then(({ UnifiedGizmoManager }) => {
          const unifiedGizmoManager = UnifiedGizmoManager.getInstance();
          unifiedGizmoManager.initialize(scene);
        });

        // Initialize SkeletonLinkRenderer
        import('../../kinematics/SkeletonLinkRenderer').then(({ SkeletonLinkRenderer }) => {
          const skeletonRenderer = SkeletonLinkRenderer.getInstance();
          skeletonRenderer.initialize(scene);
          (window as any).skeletonLinkRenderer = skeletonRenderer;
          console.log('[SceneCanvas] SkeletonLinkRenderer initialized');
        });

        // Create transform gizmo
        gizmoRef.current = new TransformGizmo(scene);

        // Note: HighlightLayer disabled - using direct material color changes instead
        // highlightLayerRef.current = new BABYLON.HighlightLayer('highlight', scene);
        // highlightLayerRef.current.innerGlow = false;
        // highlightLayerRef.current.outerGlow = true;

        // Double-click detection
        let lastClickTime = 0;
        const DOUBLE_CLICK_THRESHOLD = 300; // ms

        // Mouse wheel zoom is handled by Babylon.js native controls
        // No custom handlers needed - Babylon handles it perfectly with adaptive speed
        // See SceneManager.ts for wheelPrecision configuration (lines 167, 220-229)

        // Add click selection
        scene.onPointerDown = (evt, pickResult) => {
          if (evt.button === 0) {
            clearHoverHighlight();

            // Check if we're in alignment mode
            const currentAlignMode = useEditorStore.getState().alignMode;
            if (currentAlignMode) {
              // Handle alignment clicks
              handleAlignClick(pickResult);
              return; // Don't process as normal selection
            }

            // Check if we're in custom frame selection mode
            const currentCustomFrameMode = useEditorStore.getState().customFrameSelectionMode;
            if (currentCustomFrameMode !== 'none') {
              // Handle custom frame selection clicks
              handleSceneClickForCustomFrame(pickResult);
              return; // Don't process as normal selection
            }

            // Detect double-click
            const currentTime = Date.now();
            const isDoubleClick = currentTime - lastClickTime < DOUBLE_CLICK_THRESHOLD;
            lastClickTime = currentTime;

            // Handle double-click to zoom to clicked object
            if (isDoubleClick && pickResult.hit && pickResult.pickedPoint) {
              const mesh = pickResult.pickedMesh;

              // Check if mesh is zoomable (using centralized filtering from SceneUtils.ts)
              if (mesh && mesh instanceof BABYLON.Mesh && isZoomableObject(mesh)) {
                sceneManager.zoomToMesh(mesh);
              } else if (mesh && mesh instanceof BABYLON.TransformNode && !isZoomableObject(mesh)) {
                // TransformNode (collection) - zoom to all children
                sceneManager.zoomToNode(mesh);
              } else {
                // Empty space or infrastructure - just center camera target
                const pickedPoint = pickResult.pickedPoint.clone();
                if (camera instanceof BABYLON.ArcRotateCamera) {
                  BABYLON.Animation.CreateAndStartAnimation(
                    'setCameraTarget',
                    camera,
                    'target',
                    60,
                    30,
                    camera.target,
                    pickedPoint,
                    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
                  );
                }
              }
              return; // Don't process as selection
            }

            // Single-click selection logic
            if (pickResult.hit && pickResult.pickedMesh) {
              const mesh = pickResult.pickedMesh;

              // Check if mesh is selectable (using centralized filtering from SceneUtils.ts)
              if (mesh instanceof BABYLON.Mesh && isSelectableObject(mesh)) {
                // Check if this mesh belongs to a device entity
                const deviceEntity = registry.getDeviceByMesh(mesh);

                // Alt+Click to select individual link instead of device
                const selectIndividualLink = evt.altKey;

                // Ctrl+Click for multi-selection
                if (evt.ctrlKey || evt.metaKey) {
                  // For now, just add to mesh selection
                  // TODO: Implement node-based multi-selection from viewport
                  selectMesh(mesh);
                } else {
                  // Regular click - replace selection
                  clearSelection();

                  // If part of a device and not Alt+Click, select the device root mesh
                  if (deviceEntity && !selectIndividualLink) {
                    const deviceMesh = deviceEntity.getMesh();
                    selectMesh(deviceMesh);
                  } else {
                    // Select the individual mesh
                    selectMesh(mesh);
                  }
                }
              } else if (mesh instanceof BABYLON.TransformNode) {
                // Handle TransformNode selection - find corresponding tree node
                const tree = SceneTreeManager.getInstance();
                const node = tree.getNodeByBabylonTransformNodeId(mesh.uniqueId.toString());
                if (node) {
                  // Use the store's selectNode function which handles collections properly
                  const { selectNode } = useEditorStore.getState();
                  selectNode(node.id);
                }
              }
            } else {
              // Clicked on empty space - clear selection unless Ctrl is held
              if (!evt.ctrlKey && !evt.metaKey) {
                clearSelection();
              }
            }
          } else if (evt.button === 2) {
            // Right click - prevent context menu
            evt.preventDefault();
            return;
          }
        };

        // Hover highlight interaction
        const resetHover = () => {
          clearHoverHighlight();
          scene.hoverCursor = 'default';
        };

        scene.onPointerMove = (evt, pickResult) => {
          if (evt.buttons === 1) {
            resetHover();
            return;
          }

          const state = useEditorStore.getState();
          if (state.alignMode || state.customFrameSelectionMode !== 'none') {
            resetHover();
            return;
          }

          if (!pickResult || !pickResult.hit) {
            resetHover();
            return;
          }

          const picked = pickResult.pickedMesh;
          if (!picked || !(picked instanceof BABYLON.AbstractMesh)) {
            resetHover();
            return;
          }

          if (!isSelectableObject(picked)) {
            resetHover();
            return;
          }

          const meshIsSelected = state.selectedMeshes.some(
            (selectedMesh) => selectedMesh.uniqueId === picked.uniqueId
          );
          if (meshIsSelected) {
            resetHover();
            return;
          }

          applyHoverHighlight(picked, scene);
          scene.hoverCursor = 'pointer';
        };

        // Physics + metrics via scene observables (avoid a second runRenderLoop)
        const engine = sceneManager.getEngine();

        let frameStartTime = 0;
        const beforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
          frameStartTime = performance.now();
          // Step physics (fixed timestep) and sync entities
          physicsEngine.step(1 / 60);
          registry.syncAllFromPhysics();
        });

        const afterRenderObserver = scene.onAfterRenderObservable.add(() => {
          const frameTime = performance.now() - frameStartTime;
          const fps = engine?.getFps() || 0;

          // Triangles from active indices, draw calls approximated by active meshes
          const triangles = Math.floor(scene.getActiveIndices() / 3);

          performanceMetrics.recordFrame({
            fps,
            frameTime,
            drawCalls: scene.getActiveMeshes().length,
            triangles,
            entities: registry.getAll().length,
            physicsBodies: physicsEngine.getBodyCount(),
          });

          if (scene.getFrameId() % 60 === 0) {
            performanceMetrics.recordMemory();
          }
        });

        // Store observers for cleanup in dev tools if needed
        ;(window as any).__sceneCanvasObservers = { beforeRenderObserver, afterRenderObserver };
      }
    });

    // Cleanup on unmount
    return () => {
      gizmoRef.current?.dispose();
      clearHoverHighlight();
      if (hoverHighlightLayerRef.current) {
        hoverHighlightLayerRef.current.dispose();
        hoverHighlightLayerRef.current = null;
      }
      // Remove scene observers if present
      try {
        const scene = SceneManager.getInstance().getScene();
        const obs = (window as any).__sceneCanvasObservers;
        if (scene && obs) {
          if (obs.beforeRenderObserver) scene.onBeforeRenderObservable.remove(obs.beforeRenderObserver);
          if (obs.afterRenderObserver) scene.onAfterRenderObservable.remove(obs.afterRenderObserver);
        }
      } catch {}

      physicsEngine.dispose();
      registry.clear();
      sceneManager.dispose();
    };
  }, [setCamera, selectMesh, clearSelection, initializeCoordinateFrameWidget, clearHoverHighlight, applyHoverHighlight]);

  const transformGizmoEnabled = useEditorStore((state) => state.transformGizmoEnabled);

  // Update gizmo when selection or mode changes
  useEffect(() => {
    if (!gizmoRef.current) return;
    
    // Check if gizmo should be enabled
    const shouldEnable = transformGizmoEnabled && (selectedMeshes.length > 0 || selectedCollectionTransformNode);
    
    if (shouldEnable) {
      gizmoRef.current.setEnabled(true);
      const registry = EntityRegistry.getInstance();

      if (selectedMeshes.length > 0) {
        const selectedMesh = selectedMeshes[0];
        const entity = registry.getByMesh(selectedMesh);

        // If this is a device entity, attach gizmo to the root transform node
        if (entity && entity.getIsDevice()) {
          const rootNode = entity.getRootTransformNode();
          if (rootNode) {
            gizmoRef.current.attachToNode(rootNode);
            gizmoRef.current.setMode('combined');
          }
        } else {
          // Regular mesh - attach directly
          gizmoRef.current.attachToMesh(selectedMesh);
          gizmoRef.current.setMode('combined');
        }
      } else if (selectedCollectionTransformNode) {
        // Collection node selected from tree - attach gizmo to TransformNode
        gizmoRef.current.attachToNode(selectedCollectionTransformNode);
        gizmoRef.current.setMode('combined');
      }
    } else {
      // Disable and detach gizmo
      gizmoRef.current.attachToMesh(null);
      gizmoRef.current.setEnabled(false);
    }
  }, [selectedMeshes, selectedCollectionTransformNode, transformMode, transformGizmoEnabled]);

  // Update snap settings when they change - ALL 13 snap types
  useEffect(() => {
    if (!gizmoRef.current) return;

    gizmoRef.current.updateSnapSettings({
      enabled: snapEnabled,
      snapToGrid,
      snapToVertex,
      snapToEdge,
      snapToFace,
      snapToCenter,
      snapToObject,
      snapToMidpoint,
      snapToIntersection,
      snapToPerpendicular,
      snapToTangent,
      snapAlong,
      snapToNormal,
      snapToPlane,
      snapToAxis,
      snapToCurve,
      snapToSurface,
      snapObjectToVertex,
      snapPointOnEdge,
      snapBBoxCorner,
      gridSize,
      snapDistance,
    });
  }, [
    snapEnabled,
    snapToGrid,
    snapToVertex,
    snapToEdge,
    snapToFace,
    snapToCenter,
    snapToObject,
    snapToMidpoint,
    snapToIntersection,
    snapToPerpendicular,
    snapToTangent,
    snapAlong,
    snapToNormal,
    snapToPlane,
    snapToAxis,
    snapToCurve,
    snapToSurface,
    snapObjectToVertex,
    snapPointOnEdge,
    snapBBoxCorner,
    gridSize,
    snapDistance,
  ]);

  // Update mesh colors for selection visual feedback
  useEffect(() => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const registry = EntityRegistry.getInstance();
    if (!scene) return;

    const originalMaterials = originalMaterialsRef.current;

    // Helper function to restore original material
    const restoreMaterial = (mesh: BABYLON.AbstractMesh) => {
      const meshId = mesh.uniqueId.toString();
      if (originalMaterials.has(meshId)) {
        mesh.material = originalMaterials.get(meshId) || null;
        originalMaterials.delete(meshId);
      }
    };

    if (hoveredMeshRef.current) {
      const hovered = hoveredMeshRef.current;
      const hoveredSelected = selectedMeshes.some(
        (mesh) => mesh.uniqueId === hovered.uniqueId
      );
      if (hoveredSelected) {
        clearHoverHighlight();
      }
    }

    // Helper function to apply vivid highlight color
    const applyHighlightColor = (mesh: BABYLON.AbstractMesh, color: BABYLON.Color3) => {
      const meshId = mesh.uniqueId.toString();

      // Store original material if not already stored
      if (!originalMaterials.has(meshId)) {
        originalMaterials.set(meshId, mesh.material);
      }

      // Create temporary highlight material
      const highlightMaterial = new BABYLON.StandardMaterial(`highlight_${meshId}`, scene);
      highlightMaterial.diffuseColor = color;
      highlightMaterial.emissiveColor = color.scale(0.3); // Add some glow
      highlightMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
      mesh.material = highlightMaterial;
    };

    // Collect all currently highlighted meshes
    const currentlyHighlightedMeshes = new Set<string>();

    // Apply highlights to selected meshes
    if (selectedMeshes.length > 0) {
      selectedMeshes.forEach((mesh, index) => {
        const entity = registry.getByMesh(mesh);

        // If this is a device entity, highlight all child link entity meshes
        if (entity && typeof entity.getIsDevice === 'function' && entity.getIsDevice()) {
          const linkEntities = typeof entity.getChildren === 'function' ? entity.getChildren() : [];

          const color = index === 0
            ? new BABYLON.Color3(0.0, 1.0, 0.8) // Bright cyan for primary selection
            : new BABYLON.Color3(1.0, 0.0, 0.8); // Bright magenta for additional selections

          linkEntities.forEach(linkEntity => {
            if (typeof linkEntity.getMesh === 'function') {
              const linkMesh = linkEntity.getMesh();
              // Skip invisible meshes and dummy meshes
              if (linkMesh && linkMesh.isVisible &&
                  !linkMesh.name.includes('_dummy')) {
                applyHighlightColor(linkMesh, color);
                currentlyHighlightedMeshes.add(linkMesh.uniqueId.toString());
              }
            }
          });
        } else if (mesh && mesh.isVisible) {
          // Regular mesh - highlight directly
          const color = index === 0
            ? new BABYLON.Color3(0.0, 1.0, 0.8) // Bright cyan for primary selection
            : new BABYLON.Color3(1.0, 0.0, 0.8); // Bright magenta for additional selections
          applyHighlightColor(mesh, color);
          currentlyHighlightedMeshes.add(mesh.uniqueId.toString());
        }
      });
    }

    // Restore materials for meshes that are no longer selected
    scene.meshes.forEach(mesh => {
      const meshId = mesh.uniqueId.toString();
      if (originalMaterials.has(meshId) && !currentlyHighlightedMeshes.has(meshId)) {
        restoreMaterial(mesh);
      }
    });

    // Cleanup function to restore all materials when component unmounts
    return () => {
      scene.meshes.forEach(mesh => {
        const meshId = mesh.uniqueId.toString();
        if (originalMaterials.has(meshId)) {
          restoreMaterial(mesh);
        }
      });
    };
  }, [selectedNodeIds, selectedMeshes, clearHoverHighlight]);

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
      container.style.pointerEvents = 'none';

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
      
      // Remove canvas from viewport on cleanup
      const viewportId = userLevel === 'essential' ? 'viewport-essential' : 
                        userLevel === 'professional' ? 'viewport-professional' : 
                        'viewport-expert';
      const viewportContainer = document.getElementById(viewportId);
      if (viewportContainer && canvasRef.current) {
        try {
          viewportContainer.removeChild(canvasRef.current);
        } catch (e) {
          // Canvas might already be removed
        }
      }
    };
  }, [userLevel]);


  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        pointerEvents: 'none',
      }}
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


      {camera && showCoordinateOverlay && (
        <CoordinateFrame camera={camera as BABYLON.ArcRotateCamera} />
      )}
    </div>
  );
};
