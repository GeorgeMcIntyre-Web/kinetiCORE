// Scene Canvas component - renders Babylon.js scene
// Owner: Edwin/Cole

import { useEffect, useRef, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { RapierPhysicsEngine } from '../../physics/RapierPhysicsEngine';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { TransformGizmo } from '../../manipulation/TransformGizmo';
import { useEditorStore } from '../store/editorStore';
import { useUserLevel } from '../core/UserLevelContext';
import { CoordinateFrame } from './CoordinateFrame';
import { RoutingIntegration } from '../../routing/ui/RoutingIntegration';
import { isZoomableObject, isSelectableObject } from '../../scene/SceneUtils';
import { performanceMetrics } from '../../core/PerformanceMetrics';
import { SceneManager } from '../../scene/SceneManager';
import { SnappingHelper } from '../../manipulation/SnappingHelper';

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
  const hoverPointerStateRef = useRef<{ x: number; y: number }>({ x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY });
  const hoverRafRef = useRef<number | null>(null);
  const lastHoverPickTimeRef = useRef<number>(0);
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
      const state = useEditorStore.getState();
      if (state.alignMode || state.customFrameSelectionMode !== 'none') {
        return;
      }

      const alreadySelected = state.selectedMeshes.some(
        (selectedMesh) => selectedMesh.uniqueId === mesh.uniqueId
      );
      if (alreadySelected) {
        return;
      }

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

      const hoverColor = new BABYLON.Color3(0.0, 1.0, 0.8);
      hoverHighlightLayerRef.current.addMesh(mesh as unknown as BABYLON.Mesh, hoverColor);
      scene.hoverCursor = 'pointer';
      hoveredMeshRef.current = mesh;
    },
    [clearHoverHighlight]
  );

  // Capture Ctrl/Cmd + Shift + I to toggle Babylon inspector before the browser opens devtools
  useEffect(() => {
    const handleInspectorHotkey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key.toLowerCase() !== 'i') {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      SceneManager.getInstance().toggleInspector();
    };

    window.addEventListener('keydown', handleInspectorHotkey, true);
    return () => window.removeEventListener('keydown', handleInspectorHotkey, true);
  }, []);


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
              console.log('[SceneCanvas] 🎯 Mesh clicked:', mesh.name, 'metadata:', mesh.metadata);

              // Check if this is a connection point sphere
              if (mesh.metadata && mesh.metadata.isConnectionPoint && mesh.metadata.connectionPointId) {
                console.log('[SceneCanvas] 🔵 Connection point clicked:', mesh.metadata.connectionPointId);

                // Connection point click - handle route creation workflow
                import('../../routing/ui/RoutingWorkflowHandler').then(({ RoutingWorkflowHandler }) => {
                  import('../../routing/commands/GenerateRouteGeometryCommand').then(({ GenerateRouteGeometryCommand }) => {
                    import('../../ui/store/routingStore').then(async ({ useRoutingStore }) => {
                      const routingStore = useRoutingStore.getState();
                      const connectorId = mesh.metadata.connectionPointId;

                      // Get current routing mode
                      const routingMode = routingStore.routingMode;
                      console.log('[SceneCanvas] Current routing mode:', routingMode);

                      // Only handle clicks if in placement mode or selecting
                      if (routingMode === 'off') {
                        // Auto-start selection mode
                        routingStore.setRoutingMode('selecting_source');
                        console.log('[SceneCanvas] Auto-started selection mode');
                      }

                      // Check if we have a source selected
                      const selectedSource = routingStore.selectedSource;
                      console.log('[SceneCanvas] Selected source:', selectedSource?.getId() || 'none');

                      if (!selectedSource) {
                        // First click - select as source
                        const connectionManager = await import('../../routing/core/ConnectionManager').then(m => m.ConnectionManager.getInstance());
                        const point = connectionManager.getAllConnectionPoints().find(p => p.getId() === connectorId);
                        if (point) {
                          routingStore.selectSource(point);
                          console.log('[SceneCanvas] ✅ Selected source connection point:', connectorId);
                        } else {
                          console.error('[SceneCanvas] ❌ Could not find connection point:', connectorId);
                        }
                      } else if (selectedSource.getId() === connectorId) {
                        // Clicking the same point - deselect
                        routingStore.clearSelection();
                        console.log('[SceneCanvas] ⚪ Deselected connection point');
                      } else {
                        // Second click - create route
                        console.log('[SceneCanvas] 🚀 Creating route from', selectedSource.getId(), 'to', connectorId);

                        const routeId = await RoutingWorkflowHandler.createRouteBetweenPoints(selectedSource.getId(), connectorId);
                        console.log('[SceneCanvas] Route creation result:', routeId || 'FAILED');

                        if (routeId) {
                          console.log('[SceneCanvas] ⚙️ Generating geometry for route:', routeId);
                          const cmdManager = useEditorStore.getState().commandManager;
                          const genCmd = new GenerateRouteGeometryCommand(routeId);
                          console.log('[SceneCanvas] Executing GenerateRouteGeometryCommand...');
                          cmdManager.execute(genCmd);
                          console.log('[SceneCanvas] ✅ Command executed');

                          // Clear selection
                          routingStore.clearSelection();
                        } else {
                          console.error('[SceneCanvas] ❌ Failed to create route');
                        }
                      }
                    });
                  });
                });
                return; // Don't process as regular selection
              }

              // Check if this is a route mesh (has routeId in metadata)
              if (mesh.metadata && mesh.metadata.isRoute && mesh.metadata.routeId) {
                // Route selection - handle separately
                import('../../ui/store/routingStore').then(({ useRoutingStore }) => {
                  const routingStore = useRoutingStore.getState();
                  const activeRoutes = routingStore.activeRoutes;
                  const route = activeRoutes.find((r) => r.getId() === mesh.metadata.routeId);

                  if (route) {
                    // Select the route in routing store
                    routingStore.selectRoute(route);
                    // Also select the mesh for visual feedback
                    if (mesh instanceof BABYLON.Mesh) {
                      selectMesh(mesh);
                    }
                  }
                });
                return; // Don't process as regular selection
              }

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

        const movementThresholdSq = 196; // 14px movement threshold
        const pickIntervalMs = 48; // limit to ~20 picks/sec

        const scheduleHoverPick = (pointerEvent: PointerEvent) => {
          const { x: lastX, y: lastY } = hoverPointerStateRef.current;
          const dx = pointerEvent.clientX - lastX;
          const dy = pointerEvent.clientY - lastY;
          if (dx * dx + dy * dy < movementThresholdSq && hoverRafRef.current === null) {
            return;
          }

          hoverPointerStateRef.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };

          if (hoverRafRef.current !== null) {
            return;
          }

          const now = performance.now();
          if (now - lastHoverPickTimeRef.current < pickIntervalMs) {
            return;
          }
          lastHoverPickTimeRef.current = now;

          hoverRafRef.current = window.requestAnimationFrame(() => {
            hoverRafRef.current = null;

            if (!scene.activeCamera) {
              return;
            }

            const state = useEditorStore.getState();
            if (state.alignMode || state.customFrameSelectionMode !== 'none') {
              clearHoverHighlight();
              scene.hoverCursor = 'default';
              return;
            }

            if ((pointerEvent.buttons & 1) === 1) {
              clearHoverHighlight();
              scene.hoverCursor = 'default';
              return;
            }

            const predicate = (mesh: BABYLON.AbstractMesh) => {
              if (!isSelectableObject(mesh)) return false;
              return !state.selectedMeshes.some((selectedMesh) => selectedMesh.uniqueId === mesh.uniqueId);
            };

            // First, do a general pick to get the 3D position (for snap preview)
            // Use pick with predicate that allows all meshes (including ground) for better snap detection
            const generalPick = scene.pick(
              scene.pointerX,
              scene.pointerY,
              (mesh) => {
                // Allow picking on all visible meshes except UI elements
                return mesh.isVisible && 
                       mesh.name !== 'gridOverlay' &&
                       !mesh.name.startsWith('snapIndicator') &&
                       !mesh.name.startsWith('snapPreviewDot');
              },
              false, // Don't use fast check
              scene.activeCamera
            );
            
            // Show preview dot if snapping is enabled and we have a picked point
            const snappingHelper = SnappingHelper.getInstance();
            if (state.snapEnabled && generalPick?.hit && generalPick.pickedPoint) {
              // Advanced: Use screen-space distance for preview (more accurate than world-space)
              // This makes the "magnetic" distance feel consistent at any zoom level
              const camera = scene.activeCamera;
              const screenSpacePixels = 12; // 12 pixels feels good for magnetic snap
              let previewSnapDistance = 50; // Default: 50mm (fallback if screen-space not available)
              
              if (camera) {
                // Calculate world-space distance for fallback (but we'll use screen-space for actual check)
                // Convert screen-space distance (pixels) to world-space distance
                // Target: ~10-15 pixels of "magnetic" distance feels natural
                
                // Calculate world-space distance that corresponds to screen pixels
                // Use the distance from camera to picked point as reference
                const cameraToPoint = BABYLON.Vector3.Distance(camera.position, generalPick.pickedPoint);
                const canvas = scene.getEngine().getRenderingCanvas();
                
                if (canvas && camera instanceof BABYLON.ArcRotateCamera) {
                  // For perspective camera: convert pixels to world units
                  // Formula: worldDistance = (pixelDistance / canvasHeight) * 2 * distance * tan(fov/2)
                  const canvasHeight = canvas.height;
                  const fov = camera.fov || (Math.PI / 4); // Default FOV
                  const worldDistanceAtPoint = (screenSpacePixels / canvasHeight) * 2 * cameraToPoint * Math.tan(fov / 2);
                  previewSnapDistance = worldDistanceAtPoint * 1000; // Convert to mm
                  
                  // Clamp to reasonable range: 5mm minimum, 200mm maximum
                  previewSnapDistance = Math.max(5, Math.min(200, previewSnapDistance));
                } else if (camera instanceof BABYLON.OrthographicCamera) {
                  // For orthographic camera: use ortho size
                  const orthoSize = (camera as any).orthoLeft ? 
                    Math.abs((camera as any).orthoRight - (camera as any).orthoLeft) : 10;
                  const canvasHeight = canvas?.height || 800;
                  const worldDistanceAtPoint = (screenSpacePixels / canvasHeight) * orthoSize;
                  previewSnapDistance = worldDistanceAtPoint * 1000; // Convert to mm
                  previewSnapDistance = Math.max(5, Math.min(200, previewSnapDistance));
                }
              }
              
              // The actual snap during drag will still use 0.1mm for precision
              // This preview distance is just for the "magnetic" hover effect
              
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
                snapDistance: previewSnapDistance, // Use larger distance for preview
              };
              
              // Check for snap point near the picked point
              // Use screen-space distance for preview (more accurate than world-space)
              const snapResult = snappingHelper.snapPosition(
                generalPick.pickedPoint,
                snapSettings,
                [], // Don't exclude any meshes for preview
                camera, // Pass camera for screen-space calculation
                screenSpacePixels // Pass screen-space pixel threshold
              );
              
              
              if (snapResult.snapped && snapResult.visualFeedback && snapResult.visualFeedback.length > 0) {
                snappingHelper.showPreviewDot(snapResult.visualFeedback[0]);
              } else {
                snappingHelper.clearPreviewDot();
              }
            } else {
              snappingHelper.clearPreviewDot();
            }

            // Now do the selective pick for hover highlighting (only selectable objects)
            const pickInfo = scene.pick(
              scene.pointerX,
              scene.pointerY,
              (mesh) => predicate(mesh as BABYLON.AbstractMesh)
            );

            if (pickInfo?.hit && pickInfo.pickedMesh instanceof BABYLON.AbstractMesh) {
              applyHoverHighlight(pickInfo.pickedMesh, scene);
              return;
            }

            clearHoverHighlight();
            scene.hoverCursor = 'default';
          });
        };

        scene.onPointerMove = (evt) => {
          const pointerEvt = evt as unknown as PointerEvent;
          scheduleHoverPick(pointerEvt);
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
        if (scene) {
          scene.onPointerMove = () => {};
          scene.hoverCursor = 'default';
        }
        if (hoverRafRef.current !== null) {
          window.cancelAnimationFrame(hoverRafRef.current);
          hoverRafRef.current = null;
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
      const meshWithMeta = mesh as BABYLON.AbstractMesh & { __kcOriginalMaterial?: BABYLON.Material | null };
      const storedMaterial = originalMaterials.has(meshId)
        ? originalMaterials.get(meshId) ?? null
        : meshWithMeta.__kcOriginalMaterial ?? null;
      if (originalMaterials.has(meshId)) {
        originalMaterials.delete(meshId);
      }
      if (meshWithMeta.__kcOriginalMaterial !== undefined) {
        delete meshWithMeta.__kcOriginalMaterial;
      }
      mesh.material = storedMaterial;
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
        (mesh as BABYLON.AbstractMesh & { __kcOriginalMaterial?: BABYLON.Material | null }).__kcOriginalMaterial =
          mesh.material ?? null;
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

  // Handle canvas resize when container changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      // Trigger engine resize to match container dimensions
      const sceneManager = SceneManager.getInstance();
      const engine = sceneManager.getEngine();
      if (engine) {
        engine.resize();
      }
    };

    // Initial sizing
    updateSize();

    // Watch for window resize
    window.addEventListener('resize', updateSize);

    // Use ResizeObserver to track container changes
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, []);


  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
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

      {/* Routing Integration - Professional+ only */}
      {userLevel !== 'essential' && <RoutingIntegration />}
    </div>
  );
};
