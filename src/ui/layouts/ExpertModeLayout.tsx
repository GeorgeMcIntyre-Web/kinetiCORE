// Expert Mode Layout - Power User/Enterprise interface
// Owner: George (Architecture)

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  LayoutTemplate,
  Search,
  Magnet,
  Play,
  Pause,
  RefreshCw,
  Activity,
  Layers,
  Minus,
  Maximize2,
  Building2,
  Plus,
  Link,
  Info,
  Crosshair,
} from 'lucide-react';
import { Scan, Settings } from 'lucide-react';
import { RotateCcw, Target, CornerDownRight, Square } from 'lucide-react';
import { Rocket } from 'lucide-react';
import { Ruler, Triangle, Box as BoxIcon } from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { useAssetLibraryStore } from '../store/assetLibraryStore';
import { useProjectManagerStore } from '../store/projectManagerStore';
import { useRoutingStore } from '../store/routingStore';
import { DockableLayoutWrapper } from './DockableLayoutWrapper';
import { RouteWarningsPanel } from '../../routing/ui/RouteWarningsPanel';
import { MeasurementTools, MeasurementType } from '../components/MeasurementTools';
import { RouteDebugLabels, setGlobalDebugLabels } from '../../routing/ui/RouteDebugLabels';
import { RouteSelectionVisuals } from '../../routing/ui/RouteSelectionVisuals';
import { RouteTemplatesPanel } from '../../routing/ui/RouteTemplatesPanel';
import { RouteEditPanel } from '../../routing/ui/RouteEditPanel';
import { ConnectionPointsRenderer } from '../../routing/ui/ConnectionPointsRenderer';
import { MoveObjectDialog } from '../components/MoveObjectDialog';
import { ExportDialog } from '../components/ExportDialog';
import { FloatingSettingsPanel } from '../components/FloatingSettingsPanel';
import { FloatingPhysicsPanel } from '../components/FloatingPhysicsPanel';
import { FloatingCollisionPanel } from '../components/FloatingCollisionPanel';
import { FloatingKinematicsPanel } from '../components/FloatingKinematicsPanel';
import { FloatingKinematicsAnalysisPanel } from '../components/FloatingKinematicsAnalysisPanel';
import { FloatingActuatorPanel } from '../components/FloatingActuatorPanel';
import { FloatingComplexIKPanel } from '../components/FloatingComplexIKPanel';
import { WholeBodyIKPanel } from '../components/WholeBodyIKPanel';
import { KinematicExtractionPanel } from '../components/KinematicExtractionPanel';
import { ICPTestPanel } from '../components/ICPTestPanel';
import { AutoKinematicsTestButton } from '../components/AutoKinematicsTestButton';
import { FloatingPanel } from '../components/FloatingPanel/FloatingPanel';
import { PipingPanel } from '../piping/PipingPanel';
import { SnapSetupPopup } from '../components/SnapSetupPopup';
import { CreateDropdown } from '../components/CreateDropdown';
import { ToolbarContainer } from '../components/ToolbarContainer';
import { ViewDropdown } from '../components/ViewDropdown';
import { SelectionLevelDropdown } from '../components/SelectionLevelDropdown';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { CameraService } from '../../scene/services/CameraService';
import { WarehousePanel } from '../../routing/ui/WarehousePanel';
import './ExpertModeLayout.css';
import './ProfessionalModeLayout.css';

type ActiveMeasurement = Exclude<MeasurementType, null>;

export const ExpertModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const importModel = useEditorStore((state) => state.importModel);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const duplicateNode = useEditorStore((state) => state.duplicateNode);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo());
  const canRedo = useEditorStore((state) => state.canRedo());
  const currentView = useEditorStore((state) => state.currentView);
  const setCurrentView = useEditorStore((state) => state.setCurrentView);
  const savePanelLayout = useEditorStore((state) => state.savePanelLayout);
  const loadPanelLayout = useEditorStore((state) => state.loadPanelLayout);
  const pipingModeEnabled = useEditorStore((state) => state.pipingModeEnabled);
  const setPipingModeEnabled = useEditorStore((state) => state.setPipingModeEnabled);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const transformMode = useEditorStore((state) => state.transformMode);
  const transformGizmoEnabled = useEditorStore((state) => state.transformGizmoEnabled);
  const setTransformGizmoEnabled = useEditorStore((state) => state.setTransformGizmoEnabled);
  const commandManager = useEditorStore((state) => state.commandManager);
  const snapToolActive = useEditorStore((state) => state.snapToolActive);
  const setSnapToolActive = useEditorStore((state) => state.setSnapToolActive);
  const alignMode = useEditorStore((state) => state.alignMode);
  const setAlignMode = useEditorStore((state) => state.setAlignMode);
  const selectionLevel = useEditorStore((state) => state.selectionLevel);
  const setSelectionLevel = useEditorStore((state) => state.setSelectionLevel);

  const toggleLibrary = useAssetLibraryStore((state) => state.toggleVisibility);
  const showProjectManager = useProjectManagerStore((state) => state.show);
  const routeSelection = useRoutingStore((state) => state.selectedRoute);

  const [leftTreeWidth, setLeftTreeWidth] = useState(260);
  const [activeWorkspace, setActiveWorkspace] = useState<'modeling' | 'simulation' | 'routing' | 'analysis'>('modeling');
  const [pipingQuickMode, setPipingQuickMode] = useState<'none' | 'node' | 'segment'>('none');
  const [savedLayout, setSavedLayout] = useState<any>(null);
  const [activeMeasurement, setActiveMeasurement] = useState<MeasurementType>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSnapSetup, setShowSnapSetup] = useState(false);
  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);
  const [showKinematicsAnalysisPanel, setShowKinematicsAnalysisPanel] = useState(false);
  const [showActuatorPanel, setShowActuatorPanel] = useState(false);
  const [showComplexIKPanel, setShowComplexIKPanel] = useState(false);
  const [showWholeBodyIKPanel, setShowWholeBodyIKPanel] = useState(false);
  const [showKinematicExtractionPanel, setShowKinematicExtractionPanel] = useState(false);
  const [showICPTestPanel, setShowICPTestPanel] = useState(false);
  const [showPhysicsSettings, setShowPhysicsSettings] = useState(false);
  const [showCollisionVisualizer, setShowCollisionVisualizer] = useState(false);
  const [showAutoKinematicsTest, setShowAutoKinematicsTest] = useState(false);
  const [showWarehousePanel, setShowWarehousePanel] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showDebugLabels, setShowDebugLabels] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const debugLabelsRef = useRef<RouteDebugLabels | null>(null);

  useEffect(() => {
    const layout = loadPanelLayout();
    if (layout) {
      setSavedLayout(layout);
    }
  }, [loadPanelLayout]);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    }

    const getTextWidth = (text: string) => (ctx ? ctx.measureText(text).width : text.length * 7);
    const PADDING = 16;
    const ICON = 16;
    const ARROW = 14;
    const BADGES = 40;
    const INDENT = 16;
    const MAX = 800;
    const MIN = 240;

    const calcNodeWidth = (id: string, level = 0): number => {
      const tree = SceneTreeManager.getInstance();
      const node = tree.getNode(id);
      if (!node) return 0;
      const base = level * INDENT + ARROW + ICON + getTextWidth(node.name) + BADGES + PADDING;
      let maxChild = 0;
      if (node.expanded) {
        for (const child of tree.getChildren(id)) {
          if (child.showInTree === false) continue;
          maxChild = Math.max(maxChild, calcNodeWidth(child.id, level + 1));
        }
      }
      return Math.max(base, maxChild);
    };

    const recalc = () => {
      const tree = SceneTreeManager.getInstance();
      const root = tree.getRootNode();
      if (!root) return;
      setLeftTreeWidth(Math.max(MIN, Math.min(MAX, calcNodeWidth(root.id))));
    };

    recalc();

    let rafId: number | null = null;
    let pendingRecalc = false;
    const schedule = () => {
      if (pendingRecalc) return;
      pendingRecalc = true;
      rafId = requestAnimationFrame(() => {
        recalc();
        pendingRecalc = false;
        rafId = null;
      });
    };

    const onTreeChange = () => schedule();
    window.addEventListener('scenetree-update', onTreeChange);
    window.addEventListener('model-import-complete', onTreeChange);

    return () => {
      window.removeEventListener('scenetree-update', onTreeChange);
      window.removeEventListener('model-import-complete', onTreeChange);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    const scene = SceneManager.getInstance().getScene();
    if (scene) {
      debugLabelsRef.current = new RouteDebugLabels(scene);
      setGlobalDebugLabels(debugLabelsRef.current);
      debugLabelsRef.current.setVisible(showDebugLabels);
    }
    return () => {
      debugLabelsRef.current?.clearAll();
      setGlobalDebugLabels(null);
    };
  }, [showDebugLabels]);

  useEffect(() => {
    debugLabelsRef.current?.setVisible(showDebugLabels);
  }, [showDebugLabels]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === 'd' || event.key === 'D') {
        setShowDebugLabels((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleModeChange = (mode: 'essential' | 'professional' | 'expert') => setUserLevel(mode);

  const handleSaveClick = () => {
    if (typeof saveWorld === 'function') {
      saveWorld();
    }
  };

  const handleImport = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && typeof importModel === 'function') {
      for (let i = 0; i < files.length; i++) {
        await importModel(files[i]);
      }
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleExport = () => setShowExportDialog(true);

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

  const handleBooleanOperation = async (operation: 'union' | 'subtract' | 'intersect') => {
    const { toast } = await import('../components/ToastNotifications');
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
      toast.error(`Boolean operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleMeasurement = (type: ActiveMeasurement) => {
    setActiveMeasurement((prev) => (prev === type ? null : type));
  };

  const handleCloseMeasurement = () => setActiveMeasurement(null);
  const handleToggleDebugLabels = () => setShowDebugLabels((prev) => !prev);

  const handleToggleBabylonInspector = useCallback(async () => {
    try {
      const sceneManager = SceneManager.getInstance();
      await sceneManager.toggleInspector();
    } catch (error) {
      console.error('[ExpertModeLayout] Failed to toggle inspector:', error);
    }
  }, []);

  const handleResetView = useCallback(() => {
    setCurrentView?.('iso');
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      camera.alpha = -Math.PI / 2;
      camera.beta = Math.PI / 3;
      camera.radius = 10;
      camera.target = BABYLON.Vector3.Zero();
    }
  }, [setCurrentView]);

  const handleZoomFit = useCallback(() => {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();
    if (!scene || !camera || !(camera instanceof BABYLON.ArcRotateCamera)) return;
    const meshes = scene.meshes.filter((mesh) => mesh.isVisible && mesh.getTotalVertices() > 0);
    if (meshes.length === 0) return;

    let min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    let max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    meshes.forEach((mesh) => {
      const bounds = mesh.getBoundingInfo();
      min = BABYLON.Vector3.Minimize(min, bounds.boundingBox.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bounds.boundingBox.maximumWorld);
    });

    const center = min.add(max).scale(0.5);
    const extents = max.subtract(min);
    const radius = Math.max(extents.x, extents.y, extents.z) * 1.2 + 1;
    camera.target = center;
    camera.radius = radius;
  }, []);

  const handleZoomToSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (!camera || !(camera instanceof BABYLON.ArcRotateCamera)) return;
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(selectedNodeId);
    if (node && node.position) {
      const pos = new BABYLON.Vector3(node.position.x, node.position.y, node.position.z);
      camera.target = pos;
      camera.radius = Math.max(3, camera.radius * 0.6);
    }
  }, [selectedNodeId]);

  const handleTopView = useCallback(() => {
    setCurrentView?.('top');
    const camera = SceneManager.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      camera.alpha = -Math.PI / 2;
      camera.beta = 0.001;
    }
  }, [setCurrentView]);

  const handleRightView = useCallback(() => {
    setCurrentView?.('right');
    const camera = SceneManager.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      camera.alpha = 0;
      camera.beta = Math.PI / 2.2;
    }
  }, [setCurrentView]);

  const handleFrontView = useCallback(() => {
    setCurrentView?.('front');
    const camera = SceneManager.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      camera.alpha = Math.PI;
      camera.beta = Math.PI / 2.2;
    }
  }, [setCurrentView]);

  const handleIsoView = useCallback(() => {
    setCurrentView?.('iso');
    const camera = SceneManager.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      camera.alpha = -Math.PI / 4;
      camera.beta = Math.PI / 4;
    }
  }, [setCurrentView]);

  const handleWarehouseResetCamera = useCallback(() => {
    const camera = CameraService.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      camera.alpha = Math.PI / 4;
      camera.beta = Math.PI / 6;
      camera.radius = 50;
      camera.target = BABYLON.Vector3.Zero();
    }
  }, []);

  const handleWarehouseToggle = useCallback(() => {
    setShowWarehousePanel((prev) => !prev);
  }, []);

  const handlePipingQuickNode = () => {
    if (!pipingModeEnabled) {
      setPipingModeEnabled(true);
    }
    setPipingQuickMode(pipingQuickMode === 'node' ? 'none' : 'node');
  };

  const handlePipingQuickSegment = () => {
    if (!pipingModeEnabled) {
      setPipingModeEnabled(true);
    }
    setPipingQuickMode(pipingQuickMode === 'segment' ? 'none' : 'segment');
  };

  return (
    <div className="expert-layout">
      <RouteWarningsPanel />

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
                    color: '#f472b6',
                    position: 'relative',
                    top: '-7px',
                  }}
                  aria-label="Expert Edition"
                >
                  EXPERT
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
              className={`workspace-tab ${activeWorkspace === 'routing' ? 'active' : ''}`}
              onClick={() => setActiveWorkspace('routing')}
            >
              Routing
            </button>
            <button
              className={`workspace-tab ${activeWorkspace === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveWorkspace('analysis')}
            >
              Analysis
            </button>
          </div>
        </div>
        <div className="header-right">
          <div className="global-actions">
            <button className="action-btn" title="Save" onClick={handleSaveClick}>
              <Save size={18} />
            </button>
            <button className="action-btn" title="Import Model" onClick={handleImport}>
              <Upload size={18} />
            </button>
            <button className="action-btn" title="Export" onClick={handleExport}>
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
            <button
              className="action-btn"
              title="Help"
              onClick={() => setShowHelpPanel(true)}
            >
              <Info size={18} />
            </button>
          </div>
          <select
            value={userLevel}
            onChange={(e) => handleModeChange(e.target.value as 'essential' | 'professional' | 'expert')}
            className="user-level-select"
          >
            <option value="essential">Essential</option>
            <option value="professional">Professional</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </header>

      <div className="professional-toolbar">
        {activeWorkspace === 'modeling' && (
          <ToolbarContainer className="compact">
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
              <div className="group-label center">Transform</div>
              <div className="tool-buttons">
                <button
                  className={`tool-btn ${transformMode === 'translate' && transformGizmoEnabled ? 'active' : ''}`}
                  disabled={!selectedNodeId}
                  title={selectedNodeId ? 'Translate' : 'Select an object first'}
                  onClick={() => handleTransformTool('translate')}
                >
                  <Move size={18} />
                  <span>Translate</span>
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
                  title={selectedNodeId ? 'Quick Move Dialog (Relative/Absolute positioning)' : 'Select an object first'}
                  onClick={() => setShowMoveDialog(true)}
                >
                  <Navigation size={18} />
                  <span>Position</span>
                </button>
              </div>
            </div>

            <div className="toolbar-separator"></div>

            {/* View */}
            <div className="tool-group">
              <div className="group-label">View</div>
              <div className="tool-buttons">
                <button className="tool-btn" title="Reset View" onClick={handleResetView}>
                  <RotateCcw size={18} />
                  <span>Reset</span>
                </button>
                <button className="tool-btn" title="Zoom Fit" onClick={handleZoomFit}>
                  <Maximize2 size={18} />
                  <span>Fit</span>
                </button>
                <button className="tool-btn" title="Zoom to Selected" disabled={!selectedNodeId} onClick={handleZoomToSelected}>
                  <Target size={18} />
                  <span>Selected</span>
                </button>
                <ViewDropdown
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
              </div>
            </div>

            <div className="toolbar-separator"></div>

            {/* Align */}
            <div className="tool-group">
              <div className="group-label">Align</div>
              <div className="tool-buttons">
                <button className={`tool-btn ${alignMode === 'vertex' ? 'active' : ''}`} onClick={() => setAlignMode('vertex')} title="Align Vertex">
                  <CornerDownRight size={18} />
                  <span>Vertex</span>
                </button>
                <button className={`tool-btn ${alignMode === 'edge' ? 'active' : ''}`} onClick={() => setAlignMode('edge')} title="Align Edge">
                  <Minus size={18} />
                  <span>Edge</span>
                </button>
                <button className={`tool-btn ${alignMode === 'face' ? 'active' : ''}`} onClick={() => setAlignMode('face')} title="Align Face">
                  <Square size={18} />
                  <span>Face</span>
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
                  title="Snap - Click first point on source object, then click target point"
                  onClick={() => setSnapToolActive(!snapToolActive)}
                >
                  <Magnet size={18} />
                  <span>Snap</span>
                </button>
                <button
                  className="tool-btn"
                  title="Snap Setup"
                  onClick={() => setShowSnapSetup(true)}
                >
                  <Crosshair size={18} />
                  <span>Snap Setup</span>
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
                  title={selectedNodeIds.length === 2 ? 'Union - Combine two objects into one' : 'Union - Select exactly 2 objects (Ctrl+Click)'}
                  disabled={selectedNodeIds.length !== 2}
                  onClick={() => handleBooleanOperation('union')}
                >
                  <Layers size={18} />
                  <span>Union</span>
                </button>
                <button
                  className="tool-btn"
                  title={selectedNodeIds.length === 2 ? 'Subtract - Remove 2nd object from 1st' : 'Subtract - Select exactly 2 objects (Ctrl+Click)'}
                  disabled={selectedNodeIds.length !== 2}
                  onClick={() => handleBooleanOperation('subtract')}
                >
                  <Minus size={18} />
                  <span>Subtract</span>
                </button>
                <button
                  className="tool-btn"
                  title={selectedNodeIds.length === 2 ? 'Intersect - Keep only overlapping volume' : 'Intersect - Select exactly 2 objects (Ctrl+Click)'}
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
                  className={`tool-btn ${activeMeasurement === 'distance' ? 'active' : ''}`}
                  title="Measure distance between two points"
                  onClick={() => handleMeasurement('distance')}
                >
                  <Ruler size={18} />
                  <span>Distance</span>
                </button>
                <button
                  className={`tool-btn ${activeMeasurement === 'angle' ? 'active' : ''}`}
                  title="Measure angle between three points"
                  onClick={() => handleMeasurement('angle')}
                >
                  <Triangle size={18} />
                  <span>Angle</span>
                </button>
                <button
                  className={`tool-btn ${activeMeasurement === 'volume' ? 'active' : ''}`}
                  title="Measure volume of selected objects"
                  onClick={() => handleMeasurement('volume')}
                >
                  <BoxIcon size={18} />
                  <span>Volume</span>
                </button>
              </div>
            </div>
          </ToolbarContainer>
        )}

        {activeWorkspace === 'simulation' && (
          <ToolbarContainer className="compact">
            <div className="tool-group">
              <div className="group-label">Playback</div>
              <div className="tool-buttons">
                <button className="tool-btn">
                  <Play size={18} />
                  <span>Play</span>
                </button>
                <button className="tool-btn">
                  <Pause size={18} />
                  <span>Pause</span>
                </button>
                <button className="tool-btn">
                  <RefreshCw size={18} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
            <div className="toolbar-separator"></div>
            <div className="tool-group">
              <div className="group-label">Physics</div>
              <div className="tool-buttons">
                <button className="tool-btn" onClick={() => setShowPhysicsSettings(true)}>
                  <Activity size={18} />
                  <span>Settings</span>
                </button>
                <button className="tool-btn" onClick={() => setShowCollisionVisualizer(true)}>
                  <Scan size={18} />
                  <span>Collisions</span>
                </button>
              </div>
            </div>
          </ToolbarContainer>
        )}

        {activeWorkspace === 'routing' && (
          <ToolbarContainer className="compact">
            <div className="tool-group">
              <div className="group-label">Routes</div>
              <div className="tool-buttons">
                <button className="tool-btn" onClick={() => setShowTemplatesPanel(true)}>
                  <LayoutTemplate size={18} />
                  <span>Templates</span>
                </button>
                <button className={`tool-btn ${showDebugLabels ? 'active' : ''}`} onClick={handleToggleDebugLabels}>
                  {showDebugLabels ? <EyeOff size={18} /> : <Eye size={18} />}
                  <span>Labels</span>
                </button>
                <button className="tool-btn" onClick={handleToggleBabylonInspector}>
                  <Search size={18} />
                  <span>Inspector</span>
                </button>
              </div>
            </div>
            <div className="toolbar-separator"></div>
            <div className="tool-group">
              <div className="group-label">Factory Services</div>
              <div className="tool-buttons">
                <button
                  className={`tool-btn ${pipingModeEnabled ? 'active' : ''}`}
                  onClick={() => setPipingModeEnabled(!pipingModeEnabled)}
                >
                  <Building2 size={18} />
                  <span>Piping</span>
                </button>
                <button
                  className={`tool-btn ${pipingQuickMode === 'node' ? 'active' : ''}`}
                  onClick={handlePipingQuickNode}
                >
                  <Plus size={18} />
                  <span>Add Node</span>
                </button>
                <button
                  className={`tool-btn ${pipingQuickMode === 'segment' ? 'active' : ''}`}
                  onClick={handlePipingQuickSegment}
                >
                  <Link size={18} />
                  <span>Add Segment</span>
                </button>
              </div>
            </div>
          </ToolbarContainer>
        )}

        {activeWorkspace === 'analysis' && (
          <ToolbarContainer className="compact">
            <div className="tool-group">
              <div className="group-label">Dashboards</div>
              <div className="tool-buttons">
                <button className="tool-btn">
                  <Activity size={18} />
                  <span>Metrics</span>
                </button>
                <button className="tool-btn">
                  <Rocket size={18} />
                  <span>Optimization</span>
                </button>
              </div>
            </div>
          </ToolbarContainer>
        )}
      </div>

      {/* Main Content with Dockable Panels */}
      <div className="professional-content">
        <DockableLayoutWrapper
          config={{
            centerPanel: {
              id: 'viewport-panel',
              type: 'viewport',
              title: '3D Viewport',
            },
            leftPanels: [
              { id: 'sceneTree-panel', type: 'sceneTree', title: 'Scene Tree' },
              { id: 'toolPalette-panel', type: 'toolPalette', title: 'Tool Palette' },
            ],
            rightPanels: [
              { id: 'inspector-panel', type: 'inspector', title: 'Properties' },
              { id: 'warehouse-panel', type: 'warehouse', title: 'Factory' },
              { id: 'routingControl-panel', type: 'routingControl', title: 'Route' },
              { id: 'routeStats-panel', type: 'routeStats', title: 'Routing Analyses' },
            ],
            bottomPanels: [
              { id: 'kinematics-panel', type: 'kinematics', title: 'Timeline / Kinematics' },
            ],
          }}
          leftGroupWidth={leftTreeWidth}
          onLayoutChange={savePanelLayout}
          savedLayout={savedLayout}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".urdf,.stl,.obj,.dae,.gltf,.glb,.dxf,.dwg,.jt,.xml,.usd,.usdz,.zip"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <MoveObjectDialog isOpen={showMoveDialog} onClose={() => setShowMoveDialog(false)} />
      <ExportDialog isOpen={showExportDialog} onClose={() => setShowExportDialog(false)} />
      <RouteTemplatesPanel isOpen={showTemplatesPanel} onClose={() => setShowTemplatesPanel(false)} />
      <MeasurementTools measurementType={activeMeasurement} onClose={handleCloseMeasurement} />
      <RouteSelectionVisuals />
      <ConnectionPointsRenderer />

      {routeSelection && (
        <RouteEditPanel
          route={routeSelection}
          onClose={() => useRoutingStore.getState().selectRoute(null)}
        />
      )}

      <FloatingSettingsPanel
        isVisible={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        zIndex={1010}
      />
      <FloatingPhysicsPanel
        isVisible={showPhysicsSettings}
        onClose={() => setShowPhysicsSettings(false)}
        zIndex={1009}
      />
      <FloatingCollisionPanel
        isVisible={showCollisionVisualizer}
        onClose={() => setShowCollisionVisualizer(false)}
        zIndex={1008}
      />
      <FloatingKinematicsPanel
        isVisible={showKinematicsPanel}
        onClose={() => setShowKinematicsPanel(false)}
        zIndex={1006}
      />
      <FloatingKinematicsAnalysisPanel
        isVisible={showKinematicsAnalysisPanel}
        onClose={() => setShowKinematicsAnalysisPanel(false)}
        zIndex={1006}
      />
      <FloatingActuatorPanel
        isVisible={showActuatorPanel}
        onClose={() => setShowActuatorPanel(false)}
        zIndex={1006}
      />
      <FloatingComplexIKPanel
        isVisible={showComplexIKPanel}
        onClose={() => setShowComplexIKPanel(false)}
        zIndex={1006}
      />
      <WholeBodyIKPanel
        isVisible={showWholeBodyIKPanel}
        onClose={() => setShowWholeBodyIKPanel(false)}
        zIndex={1006}
      />
      <KinematicExtractionPanel
        isVisible={showKinematicExtractionPanel}
        onClose={() => setShowKinematicExtractionPanel(false)}
        zIndex={1005}
      />
      <ICPTestPanel
        isVisible={showICPTestPanel}
        onClose={() => setShowICPTestPanel(false)}
        zIndex={1005}
      />
      <PipingPanel isVisible={pipingModeEnabled} onClose={() => setPipingModeEnabled(false)} />
      <SnapSetupPopup isOpen={showSnapSetup} onClose={() => setShowSnapSetup(false)} />
      <WarehousePanel
        isVisible={showWarehousePanel}
        onClose={() => setShowWarehousePanel(false)}
        zIndex={1007}
      />

      {showAutoKinematicsTest && (
        <FloatingPanel
          title="Auto Kinematics Test"
          onClose={() => setShowAutoKinematicsTest(false)}
          isVisible={showAutoKinematicsTest}
          defaultSize={{ width: 420, height: 360 }}
          zIndex={1011}
        >
          <AutoKinematicsTestButton />
        </FloatingPanel>
      )}

      {showHelpPanel && (
        <FloatingPanel
          title="Expert Mode Guide"
          onClose={() => setShowHelpPanel(false)}
          isVisible={showHelpPanel}
          defaultSize={{ width: 420, height: 340 }}
          zIndex={1012}
        >
          <div className="space-y-3 text-sm text-gray-200">
            <p>Need a refresher? The ribbon exposes every Expert-only tool.</p>
            <ul className="list-disc pl-4 text-gray-400 space-y-1">
              <li>Use the Project group for save/import/export.</li>
              <li>Routing group controls debug labels, templates, and inspector.</li>
              <li>Measurements stay active until you close them from the HUD.</li>
              <li>Factory services live inside the Warehouse + Piping controls.</li>
            </ul>
          </div>
        </FloatingPanel>
      )}
    </div>
  );
};
