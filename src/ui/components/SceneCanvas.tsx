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
import { babylonToUser } from '../../core/CoordinateSystem';
import { toast } from './ToastNotifications';
import { SnappingHelper } from '../../manipulation/SnappingHelper';

export const SceneCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { userLevel } = useUserLevel();
  const isPickingSnapPoint = useEditorStore((state) => state.isPickingSnapPoint);
  const isPickingSnapFrame = useEditorStore((state) => state.isPickingSnapFrame);
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
  const handleSnapClick = useEditorStore((state) => state.handleSnapClick);
  const handleSceneClickForCustomFrame = useEditorStore((state) => state.handleSceneClickForCustomFrame);
  const handlePointPick = useEditorStore((state) => state.handlePointPick);

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

    // Disable edge rendering when clearing hover
    if (currentHover instanceof BABYLON.Mesh) {
      currentHover.disableEdgesRendering();
    }

    if (hoverHighlightLayerRef.current) {
      hoverHighlightLayerRef.current.removeMesh(currentHover as unknown as BABYLON.Mesh);
    }

    hoveredMeshRef.current = null;
  }, []);

  const applyHoverHighlight = useCallback(
    (mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene) => {
      const state = useEditorStore.getState();
      // Allow hover in point pick mode, but not in snap tool, align or custom frame modes
      if (state.snapToolActive || state.alignMode || state.customFrameSelectionMode !== 'none') {
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

      // Show edges instead of glow for hover highlight
      if (mesh instanceof BABYLON.Mesh) {
        mesh.enableEdgesRendering();
        mesh.edgesWidth = 2.0;
        mesh.edgesColor = new BABYLON.Color4(0.0, 1.0, 0.8, 1.0); // Cyan edges
      }

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

      // Expose point pick controls to window for console debugging
      (window as any).enablePointPick = () => {
        useEditorStore.getState().setPointPickMode(true);
        console.log('✅ Point pick mode enabled - click on any object to place axis frames');
      };
      (window as any).disablePointPick = () => {
        useEditorStore.getState().setPointPickMode(false);
        console.log('❌ Point pick mode disabled');
      };
      (window as any).clearPointPickMarkers = () => {
        useEditorStore.getState().clearPointPickMarkers();
        console.log('🗑️ Point pick frame cleared');
      };
      (window as any).listPointPickMarkers = () => {
        const state = useEditorStore.getState();
        console.log('Point Pick Status:');
        console.log('  Mode enabled:', state.pointPickMode);
        console.log('  Frame widgets count:', state.pointPickFrameWidgets.length);
        if (state.pointPickFrameWidgets.length > 0) {
          console.log('  Current frame is visible:', state.pointPickFrameWidgets[0].isVisible());
        } else {
          console.log('  No frame currently displayed');
        }
      };

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
      console.log('✅ Point Pick: ALWAYS ON - click objects to place surface-normal axis frames');
      console.log('   Frame adapts to zoom (5cm-2m). Commands: disablePointPick() | clearPointPickMarkers()');

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

            // Handle snap point picking (if enabled) - takes priority over normal selection
            const isPickingSnapPoint = useEditorStore.getState().isPickingSnapPoint;
            if (isPickingSnapPoint) {
              // Do a custom pick for snap point picking that includes ALL meshes
              const snapPickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
                return mesh.isVisible && mesh.isEnabled() && mesh.isPickable;
              });

              if (snapPickResult.hit && snapPickResult.pickedPoint) {
                // Targeting widget disabled
                // sceneManager.showTargetingWidget(
                //   snapPickResult.pickedPoint,
                //   snapPickResult.getNormal(true) || undefined
                // );

                // Convert picked point to user coordinates (mm)
                const userCoords = babylonToUser(snapPickResult.pickedPoint);
                const snapPoint = {
                  x: userCoords.x,
                  y: userCoords.y,
                  z: userCoords.z
                };

                // Update the appropriate snap point
                if (isPickingSnapPoint === 'from') {
                  useEditorStore.getState().setSnapFromPoint(snapPoint);
                  // Auto-advance to picking "to" point
                  useEditorStore.getState().setIsPickingSnapPoint('to');
                  toast.success('From point set. Now click to set the "To" point.');
                } else {
                  useEditorStore.getState().setSnapToPoint(snapPoint);
                  // Auto-apply the snap transformation
                  useEditorStore.getState().setIsPickingSnapPoint(null);

                  // Get current snap points
                  const state = useEditorStore.getState();
                  const from = state.snapFromPoint;
                  const to = snapPoint;

                  // Apply snap settings immediately
                  useEditorStore.getState().applySnapSettings({
                    mode: 'point-to-point',
                    from,
                    to,
                  });

                  toast.success('Object snapped! Points cleared - ready for next snap.');
                }
              } else {
                toast.error('No point picked. Click on a surface to pick a point.');
              }

              return; // Don't process as normal selection
            }

            // Handle snap frame picking (if enabled) - takes priority over normal selection
            const isPickingSnapFrame = useEditorStore.getState().isPickingSnapFrame;
            if (isPickingSnapFrame && pickResult.hit && pickResult.pickedMesh) {
              let pickedMesh = pickResult.pickedMesh;
              const tree = SceneTreeManager.getInstance();

              console.log('[Frame Picking] Clicked mesh:', pickedMesh.name, 'uniqueId:', pickedMesh.uniqueId);

              // Traverse up the parent hierarchy to find the root mesh that's in the scene tree
              // This ensures we select the entire frame object, not just an axis or label
              let rootMesh: BABYLON.AbstractMesh | null = pickedMesh;
              let node = tree.getNodeByBabylonMeshId(pickedMesh.uniqueId.toString());

              console.log('[Frame Picking] Initial tree lookup:', node ? node.name : 'NOT FOUND');

              // If picked mesh is not in tree, try traversing up the parent hierarchy
              while (!node && rootMesh && rootMesh.parent) {
                console.log('[Frame Picking] Traversing parent:', rootMesh.parent.name);

                if (rootMesh.parent instanceof BABYLON.AbstractMesh || rootMesh.parent instanceof BABYLON.TransformNode) {
                  // Check if parent has a mesh we can use
                  if (rootMesh.parent instanceof BABYLON.AbstractMesh) {
                    rootMesh = rootMesh.parent;
                    node = tree.getNodeByBabylonMeshId(rootMesh.uniqueId.toString());
                    console.log('[Frame Picking] Checking parent mesh:', rootMesh.name, 'found in tree:', !!node);
                  } else {
                    // Parent is a TransformNode, check its children for the main mesh
                    const transformNode = rootMesh.parent as BABYLON.TransformNode;
                    console.log('[Frame Picking] Found TransformNode parent:', transformNode.name, 'children count:', transformNode.getChildren().length);
                    const children = transformNode.getChildren();
                    for (const child of children) {
                      if (child instanceof BABYLON.AbstractMesh) {
                        const childNode = tree.getNodeByBabylonMeshId(child.uniqueId.toString());
                        console.log('[Frame Picking] Checking sibling:', child.name, 'found in tree:', !!childNode);
                        if (childNode) {
                          rootMesh = child;
                          node = childNode;
                          break;
                        }
                      }
                    }
                    break; // Stop traversing if we reached a TransformNode
                  }
                } else {
                  console.log('[Frame Picking] Parent is not mesh or transform node, stopping');
                  break; // Stop if parent is not a mesh or transform node
                }
              }

              console.log('[Frame Picking] Final node:', node ? node.name : 'NONE', 'rootMesh:', rootMesh ? rootMesh.name : 'NONE');

              if (node && rootMesh) {
                const frameObject = {
                  nodeId: node.id,
                  mesh: rootMesh,
                  name: node.name
                };

                console.log('[Frame Picking] ✅ Frame found:', frameObject.name);

                // Update the appropriate snap frame
                if (isPickingSnapFrame === 'from') {
                  useEditorStore.getState().setSnapFromFrameObject(frameObject);
                  // Auto-advance to picking "to" frame
                  useEditorStore.getState().setIsPickingSnapFrame('to');
                  toast.success(`From frame set: ${node.name}. Now select the "To" frame.`);
                } else {
                  useEditorStore.getState().setSnapToFrameObject(frameObject);
                  // Auto-apply the frame-to-frame transformation
                  useEditorStore.getState().setIsPickingSnapFrame(null);

                  // Get current snap frame objects
                  const state = useEditorStore.getState();
                  const fromFrame = state.snapFromFrameObject;
                  const toFrame = frameObject;

                  if (fromFrame) {
                    // Apply frame-to-frame snap transformation
                    useEditorStore.getState().applySnapSettings({
                      mode: 'frame-to-frame',
                    });

                    toast.success(`Object snapped from "${fromFrame.name}" to "${toFrame.name}"!`);
                  }
                }
              } else {
                console.log('[Frame Picking] ❌ Frame NOT found in scene tree');
                toast.error('Selected object is not in the scene tree. Please select a coordinate frame object, not a visual frame overlay.');
              }

              return; // Don't process as normal selection - prevents changing the Object field
            }

            // Handle point pick (if enabled) - runs alongside normal selection
            const currentPointPickMode = useEditorStore.getState().pointPickMode;
            if (currentPointPickMode) {
              // Do a custom pick for point picking that includes ALL meshes (including ground/layout)
              const pointPickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
                // Pick ANY visible mesh including ground
                return mesh.isVisible && mesh.isEnabled() && mesh.isPickable;
              });

              // Targeting widget disabled
              if (pointPickResult.hit && pointPickResult.pickedPoint) {
                // sceneManager.showTargetingWidget(
                //   pointPickResult.pickedPoint,
                //   pointPickResult.getNormal(true) || undefined
                // );
                // Store picked point for coordinate display
                useEditorStore.getState().setLastPickedPoint(pointPickResult.pickedPoint);
              }

              handlePointPick(pointPickResult);
              // Continue to normal selection (don't return)
            }

            // Check if we're in snap tool mode
            const currentSnapToolActive = useEditorStore.getState().snapToolActive;
            if (currentSnapToolActive) {
              // Handle snap clicks
              handleSnapClick(pickResult);
              return; // Don't process as normal selection
            }

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

            // Detect double-click (but don't zoom if snap tool is active - let snap handle it)
            const currentTime = Date.now();
            const isDoubleClick = currentTime - lastClickTime < DOUBLE_CLICK_THRESHOLD;
            lastClickTime = currentTime;

            // Handle double-click to zoom to clicked object (only if snap tool is not active)
            const snapToolActive = useEditorStore.getState().snapToolActive;
            if (isDoubleClick && pickResult.hit && pickResult.pickedPoint && !snapToolActive) {
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

              // Targeting widget disabled
              if (pickResult.pickedPoint) {
                // sceneManager.showTargetingWidget(
                //   pickResult.pickedPoint,
                //   pickResult.getNormal(true) || undefined
                // );
                // Store picked point for coordinate display
                useEditorStore.getState().setLastPickedPoint(pickResult.pickedPoint);
              }

              // Check if clicked mesh is part of a coordinate frame
              if (mesh.metadata && mesh.metadata.isFramePart && mesh.metadata.frameRoot) {
                const frameRoot = mesh.metadata.frameRoot as BABYLON.TransformNode;
                console.log('[Selection] Clicked frame part, selecting parent frame:', frameRoot.name);

                // Find the corresponding scene tree node and select it
                const tree = SceneTreeManager.getInstance();
                const treeNode = tree.getNodeByBabylonTransformNodeId(frameRoot.uniqueId.toString());
                if (treeNode) {
                  const { selectNode } = useEditorStore.getState();
                  selectNode(treeNode.id);
                  toast.success(`Selected coordinate frame: ${frameRoot.name}`);
                } else {
                  console.warn('[Selection] Frame root not found in scene tree:', frameRoot.name);
                  toast.error('Frame not found in scene tree');
                }
                return; // Exit early, don't process as normal selection
              }

              // Check if mesh is selectable (using centralized filtering from SceneUtils.ts)
              if (mesh instanceof BABYLON.Mesh && isSelectableObject(mesh)) {
                // Get current selection level from store
                const currentSelectionLevel = useEditorStore.getState().selectionLevel;

                console.log('[Selection] Level:', currentSelectionLevel, 'Mesh:', mesh.name);

                // Alt+Click overrides selection level to select individual link/mesh
                const selectIndividualLink = evt.altKey;

                // Ctrl+Click for multi-selection
                if (evt.ctrlKey || evt.metaKey) {
                  // For now, just add to mesh selection
                  // TODO: Implement node-based multi-selection from viewport
                  selectMesh(mesh);
                } else {
                  // Regular click - replace selection
                  clearSelection();

                  // Determine what to select based on selection level
                  if (selectIndividualLink) {
                    // Alt+Click always selects the individual mesh (override)
                    selectMesh(mesh);
                  } else if (currentSelectionLevel === 'object') {
                    // Object level: Traverse Babylon hierarchy to find the object root
                    let rootNode: BABYLON.Node = mesh;
                    let previousNode: BABYLON.Node = mesh;

                    console.log('[Selection] Starting from mesh:', mesh.name);

                    // Traverse up the Babylon parent hierarchy
                    // Stop before reaching the scene root (parent should be a Mesh or TransformNode, not Scene)
                    while (rootNode.parent &&
                           rootNode.parent.name !== '__root__' &&
                           rootNode.parent.name !== 'root') {
                      console.log('[Selection] Current:', rootNode.name, '-> Parent:', rootNode.parent.name);
                      previousNode = rootNode;
                      rootNode = rootNode.parent;

                      // Stop if parent is the scene itself
                      if (rootNode.parent instanceof BABYLON.Scene) {
                        console.log('[Selection] Reached scene parent, stopping at:', rootNode.name);
                        break;
                      }
                    }

                    console.log('[Selection] Root found:', rootNode.name);

                    // If rootNode is a Scene or __root__, use the previous node
                    if (rootNode instanceof BABYLON.Scene || rootNode.name === '__root__' || rootNode.name === 'root') {
                      rootNode = previousNode;
                      console.log('[Selection] Using previous node instead:', rootNode.name);
                    }

                    // Select the root node
                    if (rootNode instanceof BABYLON.Mesh) {
                      console.log('[Selection] Selecting root mesh:', rootNode.name);
                      selectMesh(rootNode);
                    } else if (rootNode instanceof BABYLON.TransformNode) {
                      console.log('[Selection] Selecting root TransformNode:', rootNode.name);
                      // Find the corresponding scene tree node and select it
                      const tree = SceneTreeManager.getInstance();
                      const treeNode = tree.getNodeByBabylonTransformNodeId(rootNode.uniqueId.toString());
                      if (treeNode) {
                        const { selectNode } = useEditorStore.getState();
                        selectNode(treeNode.id);
                      } else {
                        // Fallback to selecting the clicked mesh
                        selectMesh(mesh);
                      }
                    } else {
                      // Fallback to selecting the clicked mesh
                      console.log('[Selection] Root is not a mesh or TransformNode, selecting clicked mesh');
                      selectMesh(mesh);
                    }
                  } else if (currentSelectionLevel === 'component') {
                    // Component level: Select the clicked component/mesh
                    selectMesh(mesh);
                  } else if (currentSelectionLevel === 'mesh') {
                    // Mesh level: Always select the individual mesh
                    selectMesh(mesh);
                  } else {
                    // Fallback: select the individual mesh
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
            // Allow hover in point pick mode, but not in align or custom frame modes
            if (state.alignMode || state.customFrameSelectionMode !== 'none') {
              clearHoverHighlight();
              scene.hoverCursor = 'default';
              return;
            }

            // Don't block hover detection when snap tool is active (we want preview even during clicks)
            if ((pointerEvent.buttons & 1) === 1 && !state.snapToolActive) {
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
            // Also show preview when snap tool is active (even if snapEnabled is false, the tool should show previews)
            const snappingHelper = SnappingHelper.getInstance();
            if ((state.snapEnabled || state.snapToolActive) && generalPick?.hit && generalPick.pickedPoint) {
              // Advanced: Use screen-space distance for preview (more accurate than world-space)
              // This makes the "magnetic" distance feel consistent at any zoom level
              const camera = scene.activeCamera;

              // Adaptive screen-space threshold: increase when zoomed in close to small objects
              // When very close (< 100mm), use larger pixel threshold to ensure vertices are detected
              const cameraToPoint = camera ? BABYLON.Vector3.Distance(camera.position, generalPick.pickedPoint) : 1;
              let screenSpacePixels = 12; // Default: 12 pixels for normal viewing
              if (cameraToPoint < 0.1) {
                // Very close (< 100mm): use 500 pixels threshold (needed for cylinder/curved surfaces)
                screenSpacePixels = 500;
              } else if (cameraToPoint < 0.2) {
                // Close (< 200mm): use 250 pixels threshold
                screenSpacePixels = 250;
              } else if (cameraToPoint < 0.5) {
                // Medium close (< 500mm): use 50 pixels threshold
                screenSpacePixels = 50;
              }

              // DEBUG: Log adaptive threshold when very close
              if (cameraToPoint < 0.3) {
                console.log(`[SceneCanvas] Adaptive screen-space threshold: ${screenSpacePixels}px for camera distance ${(cameraToPoint * 1000).toFixed(1)}mm`);
              }

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

                  // DEBUG: Log calculated snap distance when very close
                  if (cameraToPoint < 0.3) {
                    console.log(`[SceneCanvas] Snap distance calc: cameraToPoint=${(cameraToPoint * 1000).toFixed(1)}mm, worldDist=${(worldDistanceAtPoint * 1000).toFixed(2)}mm, before clamp=${previewSnapDistance.toFixed(2)}mm`);
                  }

                  // Clamp to reasonable range: 5mm minimum, 200mm maximum
                  previewSnapDistance = Math.max(5, Math.min(200, previewSnapDistance));

                  // DEBUG: Log final snap distance when very close
                  if (cameraToPoint < 0.3) {
                    console.log(`[SceneCanvas] Final snap distance: ${previewSnapDistance.toFixed(2)}mm`);
                  }
                } else if (camera && camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
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
                // CRITICAL: Use snapResult.position (the actual snap position used in measurements)
                // instead of visualFeedback[0] to ensure preview matches measurement position
                // For center snap, this ensures the ring shows at the exact same position used in measurements
                const center = snapResult.position.clone();
                
                // DEBUG: Compare position vs visualFeedback[0]
                if (snapResult.visualFeedback[0]) {
                  const visualPos = snapResult.visualFeedback[0];
                  const posDiff = BABYLON.Vector3.Distance(center, visualPos);
                  if (posDiff > 0.0001) { // Only log if difference > 0.1mm
                    console.warn(`[SceneCanvas] ⚠️ Position mismatch for ${snapResult.snapType}:`);
                    console.warn(`  snapResult.position: (${center.x.toFixed(6)}, ${center.y.toFixed(6)}, ${center.z.toFixed(6)})`);
                    console.warn(`  visualFeedback[0]: (${visualPos.x.toFixed(6)}, ${visualPos.y.toFixed(6)}, ${visualPos.z.toFixed(6)})`);
                    console.warn(`  Difference: ${(posDiff * 1000).toFixed(3)}mm`);
                  } else {
                    console.log(`[SceneCanvas] ✅ Position match for ${snapResult.snapType}: ${(posDiff * 1000).toFixed(3)}mm difference`);
                  }
                }
                
                // For midpoint, pass edge endpoints
                if (snapResult.snapType === 'midpoint' && snapResult.visualFeedback.length >= 3) {
                  (center as any).edgeStart = snapResult.visualFeedback[1].clone();
                  (center as any).edgeEnd = snapResult.visualFeedback[2].clone();
                }
                
                // For center (circle), pass circle normal and radius
                if (snapResult.snapType === 'center' && snapResult.visualFeedback.length >= 3) {
                  const circleNormal = snapResult.visualFeedback[1].clone();
                  const circleRadius = snapResult.visualFeedback[2].x;
                  
                  // Verify and normalize the normal
                  const normalLength = circleNormal.length();
                  if (Math.abs(normalLength - 1.0) > 0.001) {
                    console.warn(`[SceneCanvas] Circle normal not normalized! Length=${normalLength.toFixed(6)}, normalizing...`);
                    circleNormal.normalize();
                  }
                  
                  (center as any).circleNormal = circleNormal;
                  (center as any).circleRadius = circleRadius;
                }
                
                // For face, pass face normal for orientation
                if (snapResult.snapType === 'face' && snapResult.visualFeedback.length >= 2) {
                  const faceNormal = snapResult.visualFeedback[1].clone();
                  
                  // Verify and normalize the normal
                  const normalLength = faceNormal.length();
                  if (Math.abs(normalLength - 1.0) > 0.001) {
                    faceNormal.normalize();
                  }
                  
                  (center as any).faceNormal = faceNormal;
                }
                
                snappingHelper.showPreviewDot(center, snapResult.snapType);
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

          // Point pick and object origin frame widgets have been removed
          // Visual feedback is now provided by the targeting widget

          // Update permanent and snap frames scale dynamically - all frames use same scale
          const state = useEditorStore.getState();
          const hasPermanentFrames = state.permanentFrames && state.permanentFrames.length > 0;
          const hasSnapFrames = state.snapFromFrame || state.snapToFrame;

          if (hasPermanentFrames || hasSnapFrames) {
            const camera = scene.activeCamera;
            if (camera) {
              // Calculate a single reference distance for uniform scaling
              // Use the camera's radius (distance from target) as reference
              let referenceDistance: number;

              if (camera instanceof BABYLON.ArcRotateCamera) {
                // For arc rotate camera, use the radius (distance to target)
                referenceDistance = camera.radius;
              } else {
                // Fallback: use average distance to all frames (permanent + snap)
                const allFrames = [
                  ...(state.permanentFrames || []),
                  ...(state.snapFromFrame ? [state.snapFromFrame] : []),
                  ...(state.snapToFrame ? [state.snapToFrame] : [])
                ];
                const totalDistance = allFrames.reduce((sum, frameData) => {
                  return sum + BABYLON.Vector3.Distance(camera.position, frameData.originPoint);
                }, 0);
                referenceDistance = totalDistance / allFrames.length;
              }

              // Calculate desired frame size based on reference distance
              let frameSize = referenceDistance * 0.1;
              const MIN_SIZE = 0.05;
              const MAX_SIZE = 2.0;
              frameSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, frameSize));

              // Apply the SAME scale to ALL permanent frames
              if (hasPermanentFrames) {
                state.permanentFrames.forEach((frameData) => {
                  const { rootNode, baseSize } = frameData;
                  if (rootNode && !rootNode.isDisposed()) {
                    const scale = frameSize / baseSize;
                    rootNode.scaling = new BABYLON.Vector3(scale, scale, scale);
                  }
                });
              }

              // Apply the SAME scale to snap frames
              if (state.snapFromFrame) {
                const { rootNode, baseSize } = state.snapFromFrame;
                if (rootNode && !rootNode.isDisposed()) {
                  const scale = frameSize / baseSize;
                  rootNode.scaling = new BABYLON.Vector3(scale, scale, scale);
                }
              }
              if (state.snapToFrame) {
                const { rootNode, baseSize } = state.snapToFrame;
                if (rootNode && !rootNode.isDisposed()) {
                  const scale = frameSize / baseSize;
                  rootNode.scaling = new BABYLON.Vector3(scale, scale, scale);
                }
              }
            }

            // Clean up disposed frames every 60 frames (once per second at 60fps)
            if (scene.getFrameId() % 60 === 0) {
              const cleanupDisposedFrames = useEditorStore.getState().cleanupDisposedFrames;
              cleanupDisposedFrames();
            }
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
            gizmoRef.current.setMode(transformMode);
          }
        } else {
          // Regular mesh - attach directly
          gizmoRef.current.attachToMesh(selectedMesh);
          gizmoRef.current.setMode(transformMode);
        }
      } else if (selectedCollectionTransformNode) {
        // Collection node selected from tree - attach gizmo to TransformNode
        gizmoRef.current.attachToNode(selectedCollectionTransformNode);
        gizmoRef.current.setMode(transformMode);
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

    // Helper function to apply highlight using edges (no material color change)
    const applyHighlightColor = (mesh: BABYLON.AbstractMesh, color: BABYLON.Color3) => {
      // Use edge rendering instead of changing material color
      if (mesh instanceof BABYLON.Mesh) {
        mesh.enableEdgesRendering();
        mesh.edgesWidth = 2.0;
        mesh.edgesColor = new BABYLON.Color4(color.r, color.g, color.b, 1.0);
      }
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
            ? new BABYLON.Color3(0.2, 0.8, 0.2) // Green for primary selection
            : new BABYLON.Color3(1.0, 0.5, 0.0); // Orange for additional selections

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
            ? new BABYLON.Color3(0.2, 0.8, 0.2) // Green for primary selection
            : new BABYLON.Color3(1.0, 0.5, 0.0); // Orange for additional selections
          applyHighlightColor(mesh, color);
          currentlyHighlightedMeshes.add(mesh.uniqueId.toString());
        }
      });
    }

    // Disable edge rendering for meshes that are no longer selected
    scene.meshes.forEach(mesh => {
      const meshId = mesh.uniqueId.toString();
      if (!currentlyHighlightedMeshes.has(meshId)) {
        if (mesh instanceof BABYLON.Mesh) {
          mesh.disableEdgesRendering();
        }
        // Also restore materials if they were changed
        if (originalMaterials.has(meshId)) {
          restoreMaterial(mesh);
        }
      }
    });

    // Cleanup function to restore all materials and disable edge rendering when component unmounts
    return () => {
      scene.meshes.forEach(mesh => {
        const meshId = mesh.uniqueId.toString();
        if (mesh instanceof BABYLON.Mesh) {
          mesh.disableEdgesRendering();
        }
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
          cursor: (isPickingSnapPoint || isPickingSnapFrame) ? 'crosshair' : 'default',
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
