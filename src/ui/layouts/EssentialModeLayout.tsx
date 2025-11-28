// Essential Mode Layout - Beginner-friendly interface
// Owner: George (Architecture)

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
  Move,
  RotateCw,
  Scale,
  Copy,
  Save,
  Upload,
  Download,
  Undo,
  Redo,
  Navigation,
  Eye,
  EyeOff,
  Crosshair,
  CornerDownRight,
  Magnet,
  Play,
  Pause,
  RefreshCw,
  Layers,
  Minus,
  Maximize2,
  Box,
  Settings,
  LayoutTemplate,
  Square,
  Target,
  Rocket,
  Calculator,
  GitBranch,
  Network,
  TestTube,
  Zap,
  Home,
  Bug,
  Edit,
  Scan,
} from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { useAssetLibraryStore } from '../store/assetLibraryStore';
import { SceneTree } from '../components/SceneTree';
import { SceneCanvas } from '../components/SceneCanvas';
import { SelectionIndicator } from '../components/SelectionIndicator';
import { FloatingKinematicsPanel } from '../components/FloatingKinematicsPanel';
import { FloatingKinematicsAnalysisPanel } from '../components/FloatingKinematicsAnalysisPanel';
import { FloatingActuatorPanel } from '../components/FloatingActuatorPanel';
import { FloatingComplexIKPanel } from '../components/FloatingComplexIKPanel';
import { WholeBodyIKPanel } from '../components/WholeBodyIKPanel';
import { KinematicExtractionPanel } from '../components/KinematicExtractionPanel';
import { ICPTestPanel } from '../components/ICPTestPanel';
import { FloatingPhysicsPanel } from '../components/FloatingPhysicsPanel';
import { FloatingCollisionPanel } from '../components/FloatingCollisionPanel';
import { FloatingSettingsPanel } from '../components/FloatingSettingsPanel';
import { PipingPanel } from '../piping/PipingPanel';
import { MoveObjectDialog } from '../components/MoveObjectDialog';
import { SnapSettingsDialog } from '../components/SnapSettingsDialog';
import { SnapSetupPopup } from '../components/SnapSetupPopup';
import { ProjectManagerPanelV2 } from '../components/ProjectManager/ProjectManagerPanelV2';
import { ProjectSaveDialog } from '../components/ProjectSaveDialog';
import { WarehousePanel } from '../../routing/ui/WarehousePanel';
import { useProjectManagerStore } from '../store/projectManagerStore';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { babylonToUser } from '../../core/CoordinateSystem';
import { CreateProjectionViewCommand } from '../../history/commands/CreateProjectionViewCommand';
import { toast } from '../components/ToastNotifications';
import { useTreeAutoResize } from '../hooks/useTreeAutoResize';
import { PerformanceMonitor, usePerformanceMonitor } from '../components/debug/PerformanceMonitor';
import { VersionDisplay } from '../components/VersionDisplay';
import { ToolbarContainer } from '../components/ToolbarContainer';
import { CreateDropdown } from '../components/CreateDropdown';
import { SelectionLevelDropdown } from '../components/SelectionLevelDropdown';
import { ViewOptionsDropdown } from '../components/ViewOptionsDropdown';
import { MeasurementTools, MeasurementType } from '../components/MeasurementTools';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { TransformDebugVisualizer } from '../../kinematics/TransformDebugVisualizer';
import { RobotJoggingPanelWithGizmo } from '../components/RobotJoggingPanelWithGizmo';
import { FloatingPanel } from '../components/FloatingPanel/FloatingPanel';
import './EssentialModeLayout.css';
import './ProfessionalModeLayout.css';

export const EssentialModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const importModel = useEditorStore((state) => state.importModel);
  const loadWorld = useEditorStore((state) => state.loadWorld);
  const loadComprehensiveWorld = useEditorStore((state) => state.loadComprehensiveWorld);
  const zoomFit = useEditorStore((state) => state.zoomFit);
  const zoomToNode = useEditorStore((state) => state.zoomToNode);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const transformMode = useEditorStore((state) => state.transformMode);
  const transformGizmoEnabled = useEditorStore((state) => state.transformGizmoEnabled);
  const setTransformGizmoEnabled = useEditorStore((state) => state.setTransformGizmoEnabled);
  const commandManager = useEditorStore((state) => state.commandManager);
  const duplicateNode = useEditorStore((state) => state.duplicateNode);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo());
  const canRedo = useEditorStore((state) => state.canRedo());
  const snapToolActive = useEditorStore((state) => state.snapToolActive);
  const setSnapToolActive = useEditorStore((state) => state.setSnapToolActive);
  const alignMode = useEditorStore((state) => state.alignMode);
  const setAlignMode = useEditorStore((state) => state.setAlignMode);
  const selectionLevel = useEditorStore((state) => state.selectionLevel);
  const setSelectionLevel = useEditorStore((state) => state.setSelectionLevel);
  const currentView = useEditorStore((state) => state.currentView);
  const editableKinematicsFlag = useEditorStore((state) => state.editableKinematicsFlag);
  const editModeEnabled = useEditorStore((state) => state.editModeEnabled);
  const setEditModeEnabled = useEditorStore((state) => state.setEditModeEnabled);
  const toggleLibrary = useAssetLibraryStore((state) => state.toggleVisibility);
  const showProjectManager = useProjectManagerStore((state) => state.show);

  // Performance monitoring
  const performanceEnabled = usePerformanceMonitor();

  // Project Management
  const saveProject = useEditorStore((state) => state.saveProject);
  const currentProject = useEditorStore((state) => state.currentProject);

  // Picked point coordinates
  const lastPickedPoint = useEditorStore((state) => state.lastPickedPoint);

  const [transform, setTransform] = useState<{
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
  } | null>(null);

  // Coordinate display mode: 'world' (default) or 'local'
  const [coordMode, setCoordMode] = useState<'world' | 'local'>('world');

  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);
  const [showKinematicsAnalysisPanel, setShowKinematicsAnalysisPanel] = useState(false);
  const [showActuatorPanel, setShowActuatorPanel] = useState(false);
  const [showComplexIKPanel, setShowComplexIKPanel] = useState(false);
  const [showWholeBodyIKPanel, setShowWholeBodyIKPanel] = useState(false);
  const [showKinematicExtractionPanel, setShowKinematicExtractionPanel] = useState(false);
  const [showICPTestPanel, setShowICPTestPanel] = useState(false);
  const [showPhysicsSettings, setShowPhysicsSettings] = useState(false);
  const [showCollisionVisualizer, setShowCollisionVisualizer] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showSnapDialog, setShowSnapDialog] = useState(false);
  const [showSnapSetupPopup, setShowSnapSetupPopup] = useState(false);
  const [showJointJogPanel, setShowJointJogPanel] = useState(false);
  const [showRobotJogPanel, setShowRobotJogPanel] = useState(false);
  const [showPosesPanel, setShowPosesPanel] = useState(false);
  const [showWarehousePanel, setShowWarehousePanel] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<
    'modeling' | 'simulation' | 'kinematicsRobot' | 'kinematicsFixture'
  >('modeling');
  const [activeMeasurement, setActiveMeasurement] = useState<MeasurementType>(null);
  // Kinematics inline robot state
  const [kinActiveRobotId, setKinActiveRobotId] = useState<string | null>(null);
  const [kinJoints, setKinJoints] = useState<any[]>([]);
  const [kinActiveRobotMeta, setKinActiveRobotMeta] = useState<{ name: string; jointCount: number } | null>(null);
  const [kinVisualizerEnabled, setKinVisualizerEnabled] = useState(false);
  const kinematicsManagerRef = useRef(KinematicsManager.getInstance());
  const fkSolverRef = useRef(ForwardKinematicsSolver.getInstance());

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const minSidebarWidth = 200; // Minimum width in pixels
  const maxSidebarWidth = 600; // Maximum width in pixels

  // Auto-resize hook for optimal tree width
  const { optimalWidth } = useTreeAutoResize({
    minWidth: minSidebarWidth,
    maxWidth: Math.max(maxSidebarWidth, 800),
    padding: 16,
    fontSize: 13,
    iconWidth: 16,
    arrowWidth: 14,
    badgeWidth: 40
  });

  // Auto-select robot for kinematics actions
  useEffect(() => {
    const resolveRobotFromSelection = () => {
      if (!selectedNodeId) return null;
      const tree = SceneTreeManager.getInstance();
      const chains = kinematicsManagerRef.current.getAllChains();
      let node = tree.getNode(selectedNodeId);
      while (node) {
        const isRobotRoot = chains.some((chain: any) =>
          chain.joints?.some((j: any) => typeof j.id === 'string' && j.id.startsWith(node.id))
        );
        if (isRobotRoot) return node.id;
        if (!node.parentId) break;
        const parent = tree.getNode(node.parentId);
        if (!parent || parent.name === 'Assets') break;
        node = parent;
      }
      return null;
    };

    const updateActive = () => {
      const next = resolveRobotFromSelection();
      setKinActiveRobotId(prev => (prev !== next ? next : prev));
    };

    updateActive();
    const onTree = () => updateActive();
    window.addEventListener('scenetree-update', onTree);
    window.addEventListener('model-import-complete', onTree);
    return () => {
      window.removeEventListener('scenetree-update', onTree);
      window.removeEventListener('model-import-complete', onTree);
    };
  }, [selectedNodeId]);

  useEffect(() => {
    const updateJoints = () => {
      if (!kinActiveRobotId) {
        setKinJoints([]);
        setKinActiveRobotMeta(null);
        return;
      }
      const allJoints = kinematicsManagerRef.current.getAllJoints();
      const jointsForRobot = allJoints.filter((j: any) => j.id.startsWith(kinActiveRobotId));
      setKinJoints(jointsForRobot);
      const tree = SceneTreeManager.getInstance();
      const node = tree.getNode(kinActiveRobotId);
      const name = node?.name || 'Active Robot';
      setKinActiveRobotMeta({ name, jointCount: jointsForRobot.length });
    };
    updateJoints();
    const id = setInterval(updateJoints, 500);
    return () => clearInterval(id);
  }, [kinActiveRobotId]);

  // Update sidebar width when optimal width changes
  useEffect(() => {
    if (!isResizing && optimalWidth && Number.isFinite(optimalWidth)) {
      if (Math.abs(sidebarWidth - optimalWidth) > 2) {
        console.log(`Auto-sizing sidebar to ${optimalWidth}px (from ${sidebarWidth}px)`);
        setSidebarWidth(optimalWidth);
      }
    }
  }, [optimalWidth, isResizing, sidebarWidth]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadFileInputRef = useRef<HTMLInputElement>(null);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log(`[File Selection] ========================================`);
    console.log(`[File Selection] Selected ${files.length} file(s):`);

    // Log all selected files first
    for (let i = 0; i < files.length; i++) {
      console.log(`[File Selection]   ${i + 1}. ${files[i].name} (${(files[i].size / 1024).toFixed(2)} KB)`);
    }

    // Separate files into model files (.zip, .xml, .urdf, .usd, etc.) and mesh files (.stl, .obj, .dae)
    const modelFiles: File[] = [];
    const meshFiles: File[] = [];

    Array.from(files).forEach(f => {
      const ext = f.name.toLowerCase();
      if (ext.endsWith('.xml') || ext.endsWith('.urdf') || ext.endsWith('.gltf') ||
          ext.endsWith('.glb') || ext.endsWith('.obj') || ext.endsWith('.stl') ||
          ext.endsWith('.jt') || ext.endsWith('.dwg') || ext.endsWith('.dxf') ||
          ext.endsWith('.usd') || ext.endsWith('.usdz') || ext.endsWith('.zip')) {
        modelFiles.push(f);
      } else if (ext.endsWith('.stl') || ext.endsWith('.obj') || ext.endsWith('.dae')) {
        meshFiles.push(f);
      }
    });

    // Check if we have MJCF files and initialize batch processing
    const mjcfFiles = modelFiles.filter(f => 
      f.name.toLowerCase().endsWith('.zip') || f.name.toLowerCase().endsWith('.xml')
    );
    
    if (mjcfFiles.length > 0) {
      console.log(`[File Selection] Detected ${mjcfFiles.length} MJCF file(s), initializing batch processing`);
      
      // Import MJCF loading status system
      try {
        const { mjcfLoading } = await import('../components/MJCFLoadingStatus');
        mjcfLoading.startBatch(mjcfFiles.map(f => f.name));
      } catch (error) {
        console.warn('[File Selection] Could not initialize MJCF batch processing:', error);
      }
    }

    // Import each model file sequentially
    if (modelFiles.length > 0 && importModel) {
      for (let i = 0; i < modelFiles.length; i++) {
        const modelFile = modelFiles[i];
        console.log(`[File Selection] ----------------------------------------`);
        console.log(`[File Selection] 🔄 Starting import ${i + 1}/${modelFiles.length}: ${modelFile.name}`);

        try {
          await importModel(modelFile, meshFiles);
          console.log(`[File Selection] ✅ Completed import ${i + 1}/${modelFiles.length}: ${modelFile.name}`);
        } catch (error) {
          console.error(`[File Selection] ❌ Failed import ${i + 1}/${modelFiles.length}: ${modelFile.name}`, error);
        }
      }

      console.log(`[File Selection] ========================================`);
      console.log(`[File Selection] ✅ All ${modelFiles.length} model file(s) processed`);
    }

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleExport = () => {
    setShowSaveDialog(true);
  };

  const handleTransformTool = (mode: 'translate' | 'rotate' | 'scale') => {
    if (!selectedNodeId) return;

    if (transformMode === mode) {
      setTransformGizmoEnabled(!transformGizmoEnabled);
      return;
    }

    setTransformMode(mode);
    if (!transformGizmoEnabled) {
      setTransformGizmoEnabled(true);
    }
  };

  const handleCopy = () => {
    if (selectedNodeId) {
      duplicateNode(selectedNodeId);
    }
  };

  const handleMeasurement = (type: MeasurementType) => {
    setActiveMeasurement(type);
  };

  const handleCloseMeasurement = () => setActiveMeasurement(null);

  const handleAddFrame = () => {
    const addPermanentFrame = (useEditorStore as any).getState().addPermanentFrame;
    if (typeof addPermanentFrame === 'function') {
      addPermanentFrame();
    }
  };

  const handleSimulationAction = (action: 'start' | 'pause' | 'reset') => {
    toast.info(`Simulation ${action} coming soon`);
  };

  const handleBooleanOperation = async (operation: 'union' | 'subtract' | 'intersect') => {
    const { loading } = await import('../components/LoadingIndicator');
    const { BooleanOperationCommand } = await import('../../history/commands/BooleanOperationCommand');

    if (selectedNodeIds.length !== 2) {
      toast.warning('Please select exactly two objects for Boolean operations (Ctrl+Click to multi-select)');
      return;
    }

    try {
      loading.start(`Performing ${operation} operation...`, 'processing');

      const command = new BooleanOperationCommand(
        selectedNodeIds[0],
        selectedNodeIds[1],
        operation
      );

      await commandManager.execute(command);

      loading.end();
      toast.success(`Boolean ${operation} completed successfully`);
    } catch (error) {
      console.error('Boolean operation failed:', error);
      toast.error(
        `Boolean operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleKinematicsReset = () => {
    const kinematicsManager = kinematicsManagerRef.current;
    const fkSolver = fkSolverRef.current;
    if (!kinActiveRobotId) {
      alert('⚠️ Select a robot first (Kinematics tab)');
      return;
    }
    const chain = kinematicsManager.getAllChains().find((c: any) =>
      c.joints.some((j: any) => j.id.startsWith(kinActiveRobotId))
    );
    if (!chain) {
      alert('❌ Robot chain not found for reset');
      return;
    }
    const joints = kinematicsManager.getChainJoints(chain.id);
    joints.forEach((j: any) => {
      if (j.type === 'revolute' || j.type === 'continuous') {
        fkSolver.updateJointPosition(j.id, 0);
      }
    });
    const tcpPose = fkSolver.getNullTCPPose(chain.name);
    if (tcpPose) {
      import('../../kinematics/UnifiedGizmoManager').then(({ UnifiedGizmoManager }) => {
        const unifiedGizmo = UnifiedGizmoManager.getInstance();
        const targetId = `tcp_${kinActiveRobotId}`;
        unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
        unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
      });
    }
  };

  const handleKinematicsVisualizerToggle = () => {
    const next = !kinVisualizerEnabled;
    setKinVisualizerEnabled(next);
    const vis = TransformDebugVisualizer.getInstance();
    if (!kinActiveRobotId) {
      vis.setEnabled(false, {});
      return;
    }
    if (next) {
      vis.setEnabled(true, {
        showJointFrames: false,
        showMeshFrames: true,
        showFKFrames: true,
        showDivergence: true,
        frameSize: 0.1,
        showBaseFrame: true,
        showTCPFrame: true,
        divergenceThreshold: 0.001,
      });
    } else {
      vis.setEnabled(false, {});
    }
  };

  const handleKinematicsVizSettings = () => setShowKinematicsPanel(true);

  const handleKinematicsJointDebug = () => {
    const kinematicsManager = kinematicsManagerRef.current;
    if (!kinActiveRobotId) {
      alert('⚠️ Select a robot first (Kinematics tab)');
      return;
    }
    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      alert('❌ Scene not available');
      return;
    }
    const chain = kinematicsManager.getAllChains().find((c: any) =>
      c.joints.some((j: any) => j.id.startsWith(kinActiveRobotId))
    );
    if (!chain) {
      alert('❌ Robot chain not found for debug');
      return;
    }
    kinematicsManager.showAllJointDebugFrames(chain.id, scene);
    alert(`✅ Debug frames added for ${chain.name}`);
  };

  const handleLoadFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's a comprehensive file by reading the first part
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          // Check if it's a comprehensive file
          if (data.format === 'comprehensive') {
            console.log('🔧 Detected comprehensive file, using comprehensive loader');
            if (loadComprehensiveWorld) {
              await loadComprehensiveWorld(file);
            }
          } else {
            console.log('🔧 Detected regular file, using regular loader');
            if (loadWorld) {
              await loadWorld(file);
            }
          }
        } catch (error) {
          console.error('Error parsing file:', error);
          // Fallback to regular loader
          if (loadWorld) {
            await loadWorld(file);
          }
        }
      };
      reader.readAsText(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleResetView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = -Math.PI / 2;
      camera.beta = Math.PI / 3;
      camera.radius = 10;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleZoomFit = () => {
    zoomFit();
  };

  const handleZoomToSelected = () => {
    if (selectedNodeId) {
      zoomToNode(selectedNodeId);
    }
  };

  // Camera view handlers
  const handleTopView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = 0;
      camera.beta = 0;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleRightView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = Math.PI / 2;
      camera.beta = Math.PI / 2;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleFrontView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = 0;
      camera.beta = Math.PI / 2;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleIsoView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = -Math.PI / 4;
      camera.beta = Math.PI / 3;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  // Project Management Handlers


  const handleSaveProjectConfirm = async (config: {
    name: string;
    description?: string;
    isAutoSave?: boolean;
    includeComments?: boolean;
    includeAnnotations?: boolean;
  }) => {
    try {
      await saveProject(config);
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  const handleCreateProjectionView = () => {
    if (selectedNodeIds.length === 0) {
      toast.warning('Select object(s) to project');
      return;
    }

    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    if (!scene) {
      toast.error('Scene not initialized');
      return;
    }

    let sourceMesh: any = null;
    let targetMesh: any = null;

    if (selectedNodeIds.length === 1) {
      // Single selection: project onto ground
      const node = tree.getNode(selectedNodeIds[0]);
      if (!node) {
        toast.error('Node not found');
        return;
      }

      sourceMesh = node.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node.babylonMeshId)) : null;
      targetMesh = scene.getMeshByName('ground');

      if (!sourceMesh) {
        toast.error('Select a mesh object');
        return;
      }

      if (!targetMesh) {
        toast.error('Ground not found');
        return;
      }
    } else if (selectedNodeIds.length === 2) {
      // Two selections: project first onto second
      const node1 = tree.getNode(selectedNodeIds[0]);
      const node2 = tree.getNode(selectedNodeIds[1]);

      if (!node1 || !node2) {
        toast.error('Nodes not found');
        return;
      }

      sourceMesh = node1.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node1.babylonMeshId)) : null;
      targetMesh = node2.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node2.babylonMeshId)) : null;

      if (!sourceMesh || !targetMesh) {
        toast.error('Select 2 meshes');
        return;
      }
    } else {
      // Multiple selections: project all onto ground
      targetMesh = scene.getMeshByName('ground');
      if (!targetMesh) {
        toast.error('Ground not found');
        return;
      }

      // Project each selected object onto ground
      let successCount = 0;
      for (const nodeId of selectedNodeIds) {
        const node = tree.getNode(nodeId);
        if (!node) continue;

        sourceMesh = node.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node.babylonMeshId)) : null;
        if (!sourceMesh) continue;

        try {
          const command = new CreateProjectionViewCommand(sourceMesh.name, targetMesh.name, 'auto');
          commandManager.execute(command);
          successCount++;
        } catch (error) {
          console.error('Failed to project:', error);
        }
      }

      if (successCount > 0) {
        toast.success(`Created ${successCount} projections!`);
      } else {
        toast.error('No projections created');
      }
      return;
    }

    try {
      const command = new CreateProjectionViewCommand(sourceMesh.name, targetMesh.name, 'auto');
      commandManager.execute(command);
      toast.success('Projection created!');
    } catch (error) {
      console.error('Failed to create projection:', error);
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Sidebar resize handlers
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      // Prevent reducing width below optimal width, but allow increasing
      const effectiveMinWidth = Math.max(minSidebarWidth, optimalWidth);
      
      if (newWidth >= effectiveMinWidth && newWidth <= maxSidebarWidth) {
        setSidebarWidth(newWidth);
      }
    },
    [isResizing, minSidebarWidth, maxSidebarWidth, optimalWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Update transform display when selection or mode changes
  useEffect(() => {
    if (!selectedNodeId) {
      setTransform(null);
      return;
    }

    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    let lastTransform: string | null = null;

    const updateTransform = () => {
      const node = tree.getNode(selectedNodeId);
      if (!node) {
        setTransform(null);
        return;
      }

      let babylonNode: BABYLON.TransformNode | null = null;
      const registry = EntityRegistry.getInstance();

      if (node.babylonMeshId) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh) {
          const entity = registry.getByMesh(mesh);
          if (entity && entity.getIsDevice()) {
            babylonNode = entity.getRootTransformNode();
          } else {
            babylonNode = mesh;
          }
        }
      } else if (node.type === 'collection') {
        babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
      }

      if (babylonNode) {
        // Position (mm) and rotation (deg) in either local or world coordinates
        let posUser: { x: number; y: number; z: number };
        let eulerRad: BABYLON.Vector3;

        if (coordMode === 'world') {
          // WORLD: use absolute/world transform
          babylonNode.computeWorldMatrix(true);
          const worldMatrix = babylonNode.getWorldMatrix();
          const worldTranslation = worldMatrix.getTranslation();
          const worldRotationQuat = new BABYLON.Quaternion();
          worldMatrix.decompose(undefined, worldRotationQuat, undefined);
          posUser = babylonToUser(worldTranslation);
          eulerRad = worldRotationQuat.toEulerAngles();
        } else {
          // LOCAL: use node-local transform
          posUser = babylonToUser(babylonNode.position);
          if (babylonNode.rotationQuaternion) {
            eulerRad = babylonNode.rotationQuaternion.toEulerAngles();
          } else {
            eulerRad = babylonNode.rotation;
          }
        }

        const newTransform = {
          x: Math.round(posUser.x * 10) / 10,
          y: Math.round(posUser.y * 10) / 10,
          z: Math.round(posUser.z * 10) / 10,
          rx: Math.round((eulerRad.x * 180 / Math.PI) * 10) / 10,
          ry: Math.round((eulerRad.y * 180 / Math.PI) * 10) / 10,
          rz: Math.round((eulerRad.z * 180 / Math.PI) * 10) / 10,
        };

        const newTransformStr = JSON.stringify(newTransform);
        if (newTransformStr !== lastTransform) {
          lastTransform = newTransformStr;
          setTransform(newTransform);
        }
      } else {
        setTransform(null);
      }
    };

    updateTransform();

    const handleSceneUpdate = () => updateTransform();
    window.addEventListener('scenetree-update', handleSceneUpdate);

    const observer = scene?.onBeforeRenderObservable.add(() => {
      updateTransform();
    });

    return () => {
      window.removeEventListener('scenetree-update', handleSceneUpdate);
      if (scene && observer) {
        scene.onBeforeRenderObservable.remove(observer);
      }
    };
  }, [selectedNodeId, coordMode]);


  return (
    <div className="professional-layout essential-mode">
      {/* Header */}
      <header className="professional-header">
        <div className="header-left">
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/50">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold">
                <span className="bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">
                  kinetic CORE
                </span>
                <span
                  className="ml-1 align-middle inline-flex items-center text-[9px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#ffd93b',
                    position: 'relative',
                    top: '-7px',
                  }}
                  aria-label="Essential Edition"
                >
                  Essential
                </span>
              </h1>
              <p className="text-xs text-gray-400">The Linux of Manufacturing Simulation</p>
            </div>
          </div>

          <div className="workspace-tabs">
            <button
              className={`workspace-tab ${activeWorkspace === 'modeling' ? 'active' : ''}`}
              onClick={() => setActiveWorkspace('modeling')}
            >
              Modeling
            </button>
            <button
              className={`workspace-tab ${activeWorkspace === 'simulation' ? 'active' : ''}`}
              onClick={() => setActiveWorkspace('simulation')}
            >
              Simulation
            </button>
            <button
              className={`workspace-tab ${activeWorkspace === 'kinematicsRobot' ? 'active' : ''}`}
              onClick={() => setActiveWorkspace('kinematicsRobot')}
            >
              Robot
            </button>
            <button
              className={`workspace-tab ${activeWorkspace === 'kinematicsFixture' ? 'active' : ''}`}
              onClick={() => setActiveWorkspace('kinematicsFixture')}
            >
              Fixture Kinematics
            </button>
          </div>
        </div>
        <div className="header-right">
          <div className="global-actions">
            <button className="action-btn" title="Save Project" onClick={saveProject}>
              <Save size={18} />
            </button>
            <button className="action-btn" title="Import Model" onClick={handleImport}>
              <Upload size={18} />
            </button>
            <button className="action-btn" title="Export Project" onClick={handleExport}>
              <Download size={18} />
            </button>
            <button className="action-btn" title="Project Manager" onClick={showProjectManager}>
              <LayoutTemplate size={18} />
            </button>
            <button className="action-btn" title="Asset Library" onClick={toggleLibrary}>
              <Layers size={18} />
            </button>
            <div className="separator"></div>
            <button
              className="action-btn"
              title={canUndo ? 'Undo (Ctrl+Z)' : 'Nothing to undo'}
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo size={18} />
            </button>
            <button
              className="action-btn"
              title={canRedo ? 'Redo (Ctrl+Y)' : 'Nothing to redo'}
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo size={18} />
            </button>
            <div className="separator"></div>
            <button
              className="action-btn"
              title="Settings"
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            >
              <Settings size={18} />
            </button>
          </div>
          <select
            value={userLevel}
            onChange={(e) => {
              const newLevel = e.target.value;
              if (newLevel === 'essential' || newLevel === 'professional' || newLevel === 'expert') {
                setUserLevel(newLevel);
              }
            }}
            className="user-level-select"
          >
            <option value="essential">Essential</option>
            <option value="professional">Professional</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </header>

      {/* Ribbon Toolbar */}
      <div className="ribbon-toolbar">
        <ToolbarContainer className="compact">
          {activeWorkspace === 'modeling' && (
            <>
              {/* Creation Tools */}
              <div className="tool-group">
                <div className="group-label">Creation</div>
                <div className="tool-buttons">
                  <CreateDropdown
                    onCreateBox={() => createObject('box')}
                    onCreateSphere={() => createObject('sphere')}
                    onCreateCylinder={() => createObject('cylinder')}
                    onCreateCone={() => createObject('cone')}
                    onCreateTorus={() => createObject('torus')}
                    onCreatePlane={() => createObject('plane')}
                    onCreateGround={() => createObject('ground')}
                    onCreateCapsule={() => createObject('capsule')}
                    onCreateDisc={() => createObject('disc')}
                    onCreateTorusKnot={() => createObject('torusknot')}
                    onCreatePolyhedron={() => createObject('polyhedron')}
                  />
                </div>
              </div>

              <div className="toolbar-separator"></div>

              {/* Transform Tools */}
              <div className="tool-group">
                <div className="group-label">Transform</div>
                <div className="tool-buttons">
                  <button
                    className={`tool-btn ${transformMode === 'translate' && transformGizmoEnabled ? 'active' : ''}`}
                    disabled={!selectedNodeId}
                    title={selectedNodeId ? 'Move' : 'Select an object first'}
                    onClick={() => handleTransformTool('translate')}
                  >
                    <Move size={18} />
                    <span>Move</span>
                  </button>
                  <button
                    className={`tool-btn ${transformMode === 'rotate' && transformGizmoEnabled ? 'active' : ''}`}
                    disabled={!selectedNodeId}
                    title={selectedNodeId ? 'Rotate' : 'Select an object first'}
                    onClick={() => handleTransformTool('rotate')}
                  >
                    <RotateCw size={18} />
                    <span>Rotate</span>
                  </button>
                  <button
                    className={`tool-btn ${transformMode === 'scale' && transformGizmoEnabled ? 'active' : ''}`}
                    disabled={!selectedNodeId}
                    title={selectedNodeId ? 'Scale' : 'Select an object first'}
                    onClick={() => handleTransformTool('scale')}
                  >
                    <Scale size={18} />
                    <span>Scale</span>
                  </button>
                  <button
                    className="tool-btn"
                    disabled={!selectedNodeId}
                    title={selectedNodeId ? 'Duplicate (Ctrl+D)' : 'Select an object first'}
                    onClick={handleCopy}
                  >
                    <Copy size={18} />
                    <span>Duplicate</span>
                  </button>
                  <button
                    className="tool-btn"
                    disabled={!selectedNodeId}
                    title={
                      selectedNodeId
                        ? 'Quick Move Dialog (Relative/Absolute positioning)'
                        : 'Select an object first'
                    }
                    onClick={() => setShowMoveDialog(true)}
                  >
                    <Navigation size={18} />
                    <span>Position</span>
                  </button>
                </div>
              </div>

              <div className="toolbar-separator"></div>

              {/* Snap Tools */}
              <div className="tool-group">
                <div className="group-label">Snap</div>
                <div className="tool-buttons">
                  <button
                    className={`tool-btn ${snapToolActive ? 'active' : ''}`}
                    onClick={() => setSnapToolActive(!snapToolActive)}
                    title="Snap - Click first point on source object, then click target point"
                  >
                    <Magnet size={18} />
                    <span>Snap</span>
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => setShowSnapSetupPopup(true)}
                    title="Snap Setup"
                  >
                    <Crosshair size={18} />
                    <span>Setup</span>
                  </button>
                </div>
              </div>

              <div className="toolbar-separator"></div>

              {/* Modify Tools */}
              <div className="tool-group">
                <div className="group-label">Modify</div>
                <div className="tool-buttons">
                  <button
                    className="tool-btn"
                    title={
                      selectedNodeIds.length === 2
                        ? 'Union - Combine two objects into one'
                        : 'Union - Select exactly 2 objects (Ctrl+Click)'
                    }
                    disabled={selectedNodeIds.length !== 2}
                    onClick={() => handleBooleanOperation('union')}
                  >
                    <Layers size={18} />
                    <span>Union</span>
                  </button>
                  <button
                    className="tool-btn"
                    title={
                      selectedNodeIds.length === 2
                        ? 'Subtract - Remove 2nd object from 1st'
                        : 'Subtract - Select exactly 2 objects (Ctrl+Click)'
                    }
                    disabled={selectedNodeIds.length !== 2}
                    onClick={() => handleBooleanOperation('subtract')}
                  >
                    <Minus size={18} />
                    <span>Subtract</span>
                  </button>
                  <button
                    className="tool-btn"
                    title={
                      selectedNodeIds.length === 2
                        ? 'Intersect - Keep only overlapping volume'
                        : 'Intersect - Select exactly 2 objects (Ctrl+Click)'
                    }
                    disabled={selectedNodeIds.length !== 2}
                    onClick={() => handleBooleanOperation('intersect')}
                  >
                    <LayoutTemplate size={18} />
                    <span>Intersect</span>
                  </button>
                </div>
              </div>

              <div className="toolbar-separator"></div>

              {/* Measure Tools */}
              <div className="tool-group">
                <div className="group-label">Measure</div>
                <div className="tool-buttons">
                  <button
                    className="tool-btn"
                    title="Measure distance between two points"
                    onClick={() => handleMeasurement('distance')}
                  >
                    <Maximize2 size={18} />
                    <span>Distance</span>
                  </button>
                  <button
                    className="tool-btn"
                    title="Measure angle between three points"
                    onClick={() => handleMeasurement('angle')}
                  >
                    <RotateCw size={18} />
                    <span>Angle</span>
                  </button>
                  <button
                    className="tool-btn"
                    title="Measure volume of selected objects"
                    onClick={() => handleMeasurement('volume')}
                  >
                    <Box size={18} />
                    <span>Volume</span>
                  </button>
                </div>
              </div>

              <div className="toolbar-separator"></div>

              {/* View Tools */}
              <div className="tool-group">
                <div className="group-label">View</div>
                <div className="tool-buttons">
                  <button className="tool-btn" title="Reset View" onClick={handleResetView}>
                    <RotateCw size={18} />
                    <span>Reset</span>
                  </button>
                  <button className="tool-btn" title="Zoom Fit" onClick={handleZoomFit}>
                    <Maximize2 size={18} />
                    <span>Fit</span>
                  </button>
                  <button
                    className="tool-btn"
                    title="Zoom to Selected"
                    onClick={handleZoomToSelected}
                    disabled={!selectedNodeId}
                  >
                    <Target size={18} />
                    <span>Selected</span>
                  </button>
                  <ViewOptionsDropdown
                    onTopViewClick={handleTopView}
                    onRightViewClick={handleRightView}
                    onFrontViewClick={handleFrontView}
                    onIsoViewClick={handleIsoView}
                    currentView={currentView}
                  />
                </div>
              </div>

              <div className="toolbar-separator"></div>

              {/* Utilities */}
              <div className="tool-group">
                <div className="group-label">Utilities</div>
                <div className="tool-buttons">
                  <SelectionLevelDropdown currentLevel={selectionLevel} onLevelChange={setSelectionLevel} />
                  <button className="tool-btn" title="Add Frame at Selection" onClick={handleAddFrame}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="12" x2="20" y2="12" stroke="#ff0000" strokeWidth="2.5" />
                      <polygon points="20,12 18,11 18,13" fill="#ff0000" />
                      <line x1="12" y1="12" x2="12" y2="4" stroke="#00ff00" strokeWidth="2.5" />
                      <polygon points="12,4 11,6 13,6" fill="#00ff00" />
                      <line x1="12" y1="12" x2="6" y2="18" stroke="#0000ff" strokeWidth="2.5" />
                      <polygon points="6,18 7.5,16.5 8,17.5" fill="#0000ff" />
                    </svg>
                    <span>Frame</span>
                  </button>
                  <button className="tool-btn" title="Create Projection View" onClick={handleCreateProjectionView}>
                    <LayoutTemplate size={18} />
                    <span>Projection</span>
                  </button>
                </div>
              </div>

              <div className="toolbar-separator"></div>

              {/* Align */}
              <div className="tool-group">
                <div className="group-label">Align</div>
                <div className="tool-buttons">
                  <button
                    className={`tool-btn ${alignMode === 'vertex' ? 'active' : ''}`}
                    onClick={() => setAlignMode('vertex')}
                    title="Align Vertex"
                  >
                    <CornerDownRight size={18} />
                    <span>Vertex</span>
                  </button>
                  <button
                    className={`tool-btn ${alignMode === 'edge' ? 'active' : ''}`}
                    onClick={() => setAlignMode('edge')}
                    title="Align Edge"
                  >
                    <Minus size={18} />
                    <span>Edge</span>
                  </button>
                  <button
                    className={`tool-btn ${alignMode === 'face' ? 'active' : ''}`}
                    onClick={() => setAlignMode('face')}
                    title="Align Face"
                  >
                    <Square size={18} />
                    <span>Face</span>
                  </button>
                </div>
              </div>
            </>
          )}
          {activeWorkspace === 'simulation' && (
            <>
              <div className="tool-group">
                <div className="group-label">Simulation</div>
                <div className="tool-buttons">
                  <button className="tool-btn" title="Start Simulation" onClick={() => handleSimulationAction('start')}>
                    <Play size={18} />
                    <span>Start</span>
                  </button>
                  <button className="tool-btn" title="Pause Simulation" onClick={() => handleSimulationAction('pause')}>
                    <Pause size={18} />
                    <span>Pause</span>
                  </button>
                  <button className="tool-btn" title="Reset Simulation" onClick={() => handleSimulationAction('reset')}>
                    <RefreshCw size={18} />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
            </>
          )}
          {(activeWorkspace === 'kinematicsRobot' ||
            activeWorkspace === 'kinematicsFixture') && (
            <>
              {activeWorkspace === 'kinematicsRobot' && (
                <>
                  <div className="tool-group">
                    <div className="group-label">Robot Kinematics</div>
                    <div className="tool-buttons kinematics-inline-controls">
                      <button className="tool-btn" onClick={handleKinematicsReset} title="Home all joints">
                        <Home size={18} />
                        <span>Home</span>
                      </button>

                      <button
                        className="tool-btn"
                        onClick={() => setShowJointJogPanel(true)}
                        title="Open Joint Jog"
                      >
                        <Move size={18} />
                        <span>Joint Jog</span>
                      </button>

                      <button
                        className="tool-btn"
                        onClick={() => setShowRobotJogPanel(true)}
                        title="Open Robot Jog (TCP)"
                      >
                        <Navigation size={18} />
                        <span>Robot Jog</span>
                      </button>

                      <button
                        className="tool-btn"
                        onClick={() => setShowPosesPanel(true)}
                        title="Open Poses Panel"
                      >
                        <Play size={18} />
                        <span>Poses</span>
                      </button>

                      <button
                        className="tool-btn"
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent('dock-open-panel', {
                              detail: {
                                id: 'target-panel',
                                type: 'target',
                                title: 'Target',
                                position: 'left',
                                referencePanel: 'viewport-panel',
                                size: { width: 380 },
                              },
                            })
                          );
                        }}
                        title="Open Target Docked Panel"
                      >
                        <Target size={18} />
                        <span>Target</span>
                      </button>

                      <button
                        className={`tool-btn ${kinVisualizerEnabled ? 'active' : ''}`}
                        onClick={handleKinematicsVisualizerToggle}
                        title={kinVisualizerEnabled ? 'Hide debug visualizer' : 'Show debug visualizer'}
                      >
                        {kinVisualizerEnabled ? <Eye size={18} /> : <EyeOff size={18} />}
                        <span>Visualizer</span>
                      </button>

                      <button className="tool-btn" onClick={handleKinematicsJointDebug} title="Show joint debug frames">
                        <Bug size={18} />
                        <span>Joint Debug</span>
                      </button>

                      {editableKinematicsFlag && (
                        <button
                          className={`tool-btn ${editModeEnabled ? 'active' : ''}`}
                          onClick={() => setEditModeEnabled(!editModeEnabled)}
                          title="Toggle edit mode"
                        >
                          <Edit size={18} />
                          <span>Edit Mode</span>
                        </button>
                      )}

                      <button
                        className="tool-btn"
                        onClick={handleKinematicsVizSettings}
                        title="Open visualization settings"
                      >
                        <Settings size={18} />
                      <span>Viz Settings</span>
                    </button>
                  </div>
                </div>
                </>
              )}

              {activeWorkspace === 'kinematicsFixture' && (
                <div className="tool-group">
                  <div className="group-label">Fixture kinematics</div>
                  <div className="tool-buttons">
                    <button className="tool-btn" onClick={() => setShowKinematicsPanel(true)} title="Motion Panel">
                      <Rocket size={18} />
                      <span className="tool-btn-label">Motion</span>
                    </button>
                    <button className="tool-btn" onClick={() => setShowKinematicsAnalysisPanel(true)} title="Kinematics Analysis">
                      <Calculator size={18} />
                      <span className="tool-btn-label">Analysis</span>
                    </button>
                    <button className="tool-btn" onClick={() => setShowPosesPanel(true)} title="Open Poses Panel">
                      <Play size={18} />
                      <span className="tool-btn-label">Poses</span>
                    </button>
                    <button className="tool-btn" onClick={() => setShowActuatorPanel(true)} title="Actuator Control">
                      <div style={{ position: 'relative', width: 18, height: 18 }}>
                        <Zap size={12} style={{ position: 'absolute', left: 1, top: 1 }} />
                        <Settings size={12} style={{ position: 'absolute', right: 1, bottom: 1 }} />
                      </div>
                      <span className="tool-btn-label">Actuators</span>
                    </button>
                    <button className="tool-btn" onClick={() => setShowComplexIKPanel(true)} title="Complex IK Systems">
                      <GitBranch size={18} />
                      <span className="tool-btn-label">Complex IK</span>
                    </button>
                    <button className="tool-btn" onClick={() => setShowWholeBodyIKPanel(true)} title="FullBody IK">
                      <Network size={18} />
                      <span className="tool-btn-label">FullBody IK</span>
                    </button>
                    <button
                      className={`tool-btn ${showKinematicExtractionPanel ? 'active' : ''}`}
                      onClick={() => setShowKinematicExtractionPanel(!showKinematicExtractionPanel)}
                      title="Auto Kinematic Extraction - Hierarchical BBox Pairing"
                    >
                      <Scan size={18} />
                      <span className="tool-btn-label">Auto Extract</span>
                    </button>
                    <button className="tool-btn" onClick={() => setShowICPTestPanel(true)} title="ICP Test Tool - Manual FIXED/MOVING Selection">
                      <TestTube size={18} />
                      <span className="tool-btn-label">ICP Test</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </ToolbarContainer>
      </div>

      <div className="professional-content essential-content">
        <div className="essential-main-layout">
          <aside
            className="essential-sidebar border-r border-gray-200 bg-white flex-shrink-0 flex flex-col min-h-0 relative"
            style={{ width: `${sidebarWidth}px` }}
          >
            <SceneTree />

            <div
              onMouseDown={handleMouseDown}
              className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-500 transition-colors z-50"
              style={{
                background: isResizing ? 'rgb(59, 130, 246)' : 'transparent',
              }}
            />
          </aside>

          <main className="essential-viewport flex-1 relative bg-gray-100">
            <div id="viewport-essential" className="w-full h-full relative">
              <SceneCanvas />
              <SelectionIndicator selectedNodeIds={selectedNodeIds} />
              <PerformanceMonitor enabled={performanceEnabled} position="top-right" detailed />
            </div>

            {transform && (
              <div
                className="fixed"
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  color: '#fff',
                  boxShadow: 'none',
                  fontWeight: '600',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  minWidth: '280px',
                  marginBottom: '16px',
                  transformOrigin: 'bottom right',
                }}
              >
                <div style={{ transform: 'scale(0.95)', transformOrigin: 'bottom right', padding: '8px 0' }}>
                  <div className="flex justify-end mb-1">
                    <button
                      onClick={() => setCoordMode(coordMode === 'world' ? 'local' : 'world')}
                      title={coordMode === 'world' ? 'Showing World coordinates. Click for Local.' : 'Showing Local coordinates. Click for World.'}
                      style={{
                        background: 'rgba(0,0,0,0.45)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        fontSize: '9px',
                        lineHeight: 1,
                      }}
                    >
                      {coordMode === 'world' ? 'World' : 'Local'}
                    </button>
                  </div>
                  <div className="flex justify-between" style={{ fontSize: '11.5px' }}>
                    <div className="flex space-x-1" style={{ minWidth: '80px' }}>
                      <span style={{ color: '#D0021B', fontWeight: '500' }}>X:</span>
                      <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.x.toFixed(1)}</span>
                    </div>
                    <div className="flex space-x-1" style={{ minWidth: '80px' }}>
                      <span style={{ color: '#7ED321', fontWeight: '500' }}>Y:</span>
                      <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.y.toFixed(1)}</span>
                    </div>
                    <div className="flex space-x-1" style={{ minWidth: '80px' }}>
                      <span style={{ color: '#4A90E2', fontWeight: '500' }}>Z:</span>
                      <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.z.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between mt-1" style={{ fontSize: '11.5px' }}>
                    <div className="flex space-x-1" style={{ minWidth: '80px' }}>
                      <span style={{ color: '#D0021B', fontWeight: '500' }}>RX:</span>
                      <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.rx.toFixed(1)}°</span>
                    </div>
                    <div className="flex space-x-1" style={{ minWidth: '80px' }}>
                      <span style={{ color: '#7ED321', fontWeight: '500' }}>RY:</span>
                      <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.ry.toFixed(1)}°</span>
                    </div>
                    <div className="flex space-x-1" style={{ minWidth: '80px' }}>
                      <span style={{ color: '#4A90E2', fontWeight: '500' }}>RZ:</span>
                      <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.rz.toFixed(1)}°</span>
                    </div>
                  </div>

                  {lastPickedPoint && (() => {
                    const userCoords = babylonToUser(lastPickedPoint);
                    return (
                      <div style={{
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        margin: '6px 0',
                        paddingTop: '6px'
                      }}>
                        <div style={{
                          fontSize: '9px',
                          color: 'rgba(255,255,255,0.5)',
                          marginBottom: '4px',
                          fontWeight: '500'
                        }}>
                          Picked Point:
                        </div>
                        <div className="flex justify-between" style={{ fontSize: '11.5px' }}>
                          <div className="flex space-x-1" style={{ minWidth: '80px' }}>
                            <span style={{ color: '#D0021B', fontWeight: '500' }}>X:</span>
                            <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{userCoords.x.toFixed(3)}</span>
                          </div>
                          <div className="flex space-x-1" style={{ minWidth: '80px' }}>
                            <span style={{ color: '#7ED321', fontWeight: '500' }}>Y:</span>
                            <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{userCoords.y.toFixed(3)}</span>
                          </div>
                          <div className="flex space-x-1" style={{ minWidth: '80px' }}>
                            <span style={{ color: '#4A90E2', fontWeight: '500' }}>Z:</span>
                            <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{userCoords.z.toFixed(3)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Hidden file inputs for ribbon buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.dae,.gltf,.glb,.dxf,.dwg,.jt,.xml,.usd,.usdz,.zip"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={loadFileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleLoadFileChange}
      />

      {/* Floating Panels */}
      <FloatingKinematicsPanel
        isVisible={showKinematicsPanel}
        onClose={() => setShowKinematicsPanel(false)}
        zIndex={1001}
      />

      <FloatingKinematicsAnalysisPanel
        isVisible={showKinematicsAnalysisPanel}
        onClose={() => setShowKinematicsAnalysisPanel(false)}
        zIndex={1002}
      />

      <FloatingActuatorPanel
        isVisible={showActuatorPanel}
        onClose={() => setShowActuatorPanel(false)}
        zIndex={1003}
      />

      <FloatingComplexIKPanel
        isVisible={showComplexIKPanel}
        onClose={() => setShowComplexIKPanel(false)}
        zIndex={1004}
      />

      <WholeBodyIKPanel
        isVisible={showWholeBodyIKPanel}
        onClose={() => setShowWholeBodyIKPanel(false)}
        zIndex={1005}
      />

      <KinematicExtractionPanel
        isVisible={showKinematicExtractionPanel}
        onClose={() => setShowKinematicExtractionPanel(false)}
        zIndex={1006}
      />

      <ICPTestPanel
        isVisible={showICPTestPanel}
        onClose={() => setShowICPTestPanel(false)}
        zIndex={1007}
      />

      <FloatingPhysicsPanel
        isVisible={showPhysicsSettings}
        onClose={() => setShowPhysicsSettings(false)}
        zIndex={1007}
      />

      <FloatingCollisionPanel
        isVisible={showCollisionVisualizer}
        onClose={() => setShowCollisionVisualizer(false)}
        zIndex={1008}
      />

      <FloatingSettingsPanel
        isVisible={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        zIndex={1009}
      />

      <FloatingPanel
        className="joint-jog-panel"
        title="Joint Jog"
        subtitle={kinActiveRobotId ? 'Joint-only jogging' : 'Select a robot to jog'}
        isVisible={showJointJogPanel}
        onClose={() => setShowJointJogPanel(false)}
        defaultSize={{ width: 360, height: 520 }}
        minWidth={320}
        minHeight={420}
        maxWidth={500}
        maxHeight={720}
      >
        {kinActiveRobotId && kinJoints.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(80,166,255,0.25)',
                background:
                  'linear-gradient(135deg, rgba(27,32,44,0.96), rgba(27,32,44,0.92))',
                color: '#eaf4ff',
              }}
            >
              <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.12, opacity: 0.86 }}>
                Jogging
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>
                {kinActiveRobotMeta?.name || 'Active Robot'}
              </div>
              <div style={{ fontSize: 14, color: '#d6e3f7', marginTop: 6 }}>
                {kinActiveRobotMeta?.jointCount ?? kinJoints.length} joints detected
              </div>
            </div>

            <RobotJoggingPanelWithGizmo
              joints={kinJoints}
              fkSolver={fkSolverRef.current}
              robotId={kinActiveRobotId}
              allowedModes={['joint']}
              hideModeSelector
            />
          </div>
        ) : (
          <div style={{ padding: '12px', color: '#cbd5e0', fontSize: 13 }}>
            Select a robot in the scene to jog joints.
          </div>
        )}
      </FloatingPanel>

      <FloatingPanel
        className="joint-jog-panel"
        title="Robot Jog"
        subtitle={kinActiveRobotId ? 'TCP jogging' : 'Select a robot to jog'}
        isVisible={showRobotJogPanel}
        onClose={() => setShowRobotJogPanel(false)}
        defaultSize={{ width: 360, height: 520 }}
        minWidth={320}
        minHeight={420}
        maxWidth={500}
        maxHeight={720}
      >
        {kinActiveRobotId && kinJoints.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(80,166,255,0.25)',
                background:
                  'linear-gradient(135deg, rgba(27,32,44,0.96), rgba(27,32,44,0.92))',
                color: '#eaf4ff',
              }}
            >
              <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.12, opacity: 0.86 }}>
                Robot Jog
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>
                {kinActiveRobotMeta?.name || 'Active Robot'}
              </div>
              <div style={{ fontSize: 14, color: '#d6e3f7', marginTop: 6 }}>
                {kinActiveRobotMeta?.jointCount ?? kinJoints.length} joints detected
              </div>
            </div>

            <RobotJoggingPanelWithGizmo
              joints={kinJoints}
              fkSolver={fkSolverRef.current}
              robotId={kinActiveRobotId}
              allowedModes={['tcp']}
              hideModeSelector
            />
          </div>
        ) : (
          <div style={{ padding: '12px', color: '#cbd5e0', fontSize: 13 }}>
            Select a robot in the scene to jog.
          </div>
        )}
      </FloatingPanel>

      <FloatingPanel
        className="joint-jog-panel"
        title="Poses"
        subtitle={kinActiveRobotId ? 'Pose jogging' : 'Select a robot to jog'}
        isVisible={showPosesPanel}
        onClose={() => setShowPosesPanel(false)}
        defaultSize={{ width: 360, height: 520 }}
        minWidth={320}
        minHeight={420}
        maxWidth={500}
        maxHeight={720}
      >
        {kinActiveRobotId && kinJoints.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(80,166,255,0.25)',
                background:
                  'linear-gradient(135deg, rgba(27,32,44,0.96), rgba(27,32,44,0.92))',
                color: '#eaf4ff',
              }}
            >
              <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.12, opacity: 0.86 }}>
                Poses
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>
                {kinActiveRobotMeta?.name || 'Active Robot'}
              </div>
              <div style={{ fontSize: 14, color: '#d6e3f7', marginTop: 6 }}>
                {kinActiveRobotMeta?.jointCount ?? kinJoints.length} joints detected
              </div>
            </div>

            <RobotJoggingPanelWithGizmo
              joints={kinJoints}
              fkSolver={fkSolverRef.current}
              robotId={kinActiveRobotId}
              allowedModes={['poses']}
              hideModeSelector
            />
          </div>
        ) : (
          <div style={{ padding: '12px', color: '#cbd5e0', fontSize: 13 }}>
            Select a robot in the scene to jog poses.
          </div>
        )}
      </FloatingPanel>

      <PipingPanel
        isVisible={useEditorStore((state) => state.pipingModeEnabled)}
        onClose={() => useEditorStore.getState().setPipingModeEnabled(false)}
      />

      <WarehousePanel
        isVisible={showWarehousePanel}
        onClose={() => setShowWarehousePanel(false)}
        zIndex={1010}
      />

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.dae,.gltf,.glb,.dxf,.dwg,.jt,.xml,.usd,.usdz,.zip"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={loadFileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleLoadFileChange}
      />

      {/* Project Save Dialog */}
      {showSaveDialog && currentProject && (
        <ProjectSaveDialog
          project={currentProject}
          onClose={() => setShowSaveDialog(false)}
          onSave={handleSaveProjectConfirm}
        />
      )}

      {/* Move Object Dialog */}
      <MoveObjectDialog
        isOpen={showMoveDialog}
        onClose={() => setShowMoveDialog(false)}
      />
      <SnapSettingsDialog
        isOpen={showSnapDialog}
        onClose={() => setShowSnapDialog(false)}
      />

      {/* Snap Setup Popup - Quick access from ribbon */}
      <SnapSetupPopup
        isOpen={showSnapSetupPopup}
        onClose={() => setShowSnapSetupPopup(false)}
      />

      <MeasurementTools measurementType={activeMeasurement} onClose={handleCloseMeasurement} />

      {/* Project Manager Panel */}
      <ProjectManagerPanelV2 />

      {/* Version Display - Bottom-right corner */}
      <VersionDisplay mode="footer" showBuildInfo={false} />
    </div>
  );
};



