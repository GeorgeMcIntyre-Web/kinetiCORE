// Professional Mode Layout - Engineer/Designer interface
// Owner: George (Architecture)

import React, { useState, useRef, useEffect } from 'react';
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
  Crosshair,
  Magnet,
  Play,
  Pause,
  RefreshCw,
  Activity,
  Layers,
  Minus,
  Maximize2,
  Box,
  } from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { DockableLayoutWrapper } from './DockableLayoutWrapper';
import { SceneTreeManager } from '../../scene/SceneTreeManager';

import { MoveObjectDialog } from '../components/MoveObjectDialog';
import { ExportDialog } from '../components/ExportDialog';
import { MeasurementTools, MeasurementType } from '../components/MeasurementTools';
import { RouteDebugLabels, setGlobalDebugLabels } from '../../routing/ui/RouteDebugLabels';
import { RouteEditPanel } from '../../routing/ui/RouteEditPanel';
import { RouteSelectionVisuals } from '../../routing/ui/RouteSelectionVisuals';
import { RouteTemplatesPanel } from '../../routing/ui/RouteTemplatesPanel';
import { RouteWarningsPanel } from '../../routing/ui/RouteWarningsPanel';
import { ConnectionPointsRenderer } from '../../routing/ui/ConnectionPointsRenderer';
import { useRoutingStore } from '../store/routingStore';
import { SceneManager } from '../../scene/SceneManager';
import { KinematicExtractionPanel } from '../components/KinematicExtractionPanel';
import { FloatingKinematicsPanel } from '../components/FloatingKinematicsPanel';
import { FloatingKinematicsAnalysisPanel } from '../components/FloatingKinematicsAnalysisPanel';
import { FloatingActuatorPanel } from '../components/FloatingActuatorPanel';
import { FloatingComplexIKPanel } from '../components/FloatingComplexIKPanel';
import { WholeBodyIKPanel } from '../components/WholeBodyIKPanel';
import { ICPTestPanel } from '../components/ICPTestPanel';
import { Scan, Settings } from 'lucide-react';
import { RotateCcw, Target, CornerDownRight, Square } from 'lucide-react';
import { Rocket, Calculator, GitBranch, Network, TestTube, Zap } from 'lucide-react';
import { CreateDropdown } from '../components/CreateDropdown';
import { FloatingSettingsPanel } from '../components/FloatingSettingsPanel';
import { SnapSetupPopup } from '../components/SnapSetupPopup';
import { ToolbarContainer } from '../components/ToolbarContainer';
import { ViewDropdown } from '../components/ViewDropdown';
import { SelectionLevelDropdown } from '../components/SelectionLevelDropdown';
import './ProfessionalModeLayout.css';

export const ProfessionalModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const importModel = useEditorStore((state) => state.importModel);
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const transformMode = useEditorStore((state) => state.transformMode);
  const transformGizmoEnabled = useEditorStore((state) => state.transformGizmoEnabled);
  const setTransformGizmoEnabled = useEditorStore((state) => state.setTransformGizmoEnabled);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const duplicateNode = useEditorStore((state) => state.duplicateNode);
  const commandManager = useEditorStore((state) => state.commandManager);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo());
  const canRedo = useEditorStore((state) => state.canRedo());
  const savePanelLayout = useEditorStore((state) => state.savePanelLayout);
  const loadPanelLayout = useEditorStore((state) => state.loadPanelLayout);
  const snapToolActive = useEditorStore((state) => state.snapToolActive);
  const setSnapToolActive = useEditorStore((state) => state.setSnapToolActive);
  const alignMode = useEditorStore((state) => state.alignMode);
  const setAlignMode = useEditorStore((state) => state.setAlignMode);
  const selectionLevel = useEditorStore((state) => state.selectionLevel);
  const setSelectionLevel = useEditorStore((state) => state.setSelectionLevel);
  const currentView = useEditorStore((state) => state.currentView);
  const setCurrentView = useEditorStore((state) => state.setCurrentView);

  const [activeWorkspace, setActiveWorkspace] = useState<'modeling' | 'simulation' | 'analysis' | 'routing'>(
    'modeling'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedLayout, setSavedLayout] = useState<any>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [activeMeasurement, setActiveMeasurement] = useState<MeasurementType>(null);
  const [showDebugLabels, setShowDebugLabels] = useState(false);
  const [showKinematicExtractionPanel, setShowKinematicExtractionPanel] = useState(false);
  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);
  const [showKinematicsAnalysisPanel, setShowKinematicsAnalysisPanel] = useState(false);
  const [showActuatorPanel, setShowActuatorPanel] = useState(false);
  const [showComplexIKPanel, setShowComplexIKPanel] = useState(false);
  const [showWholeBodyIKPanel, setShowWholeBodyIKPanel] = useState(false);
  const [showICPTestPanel, setShowICPTestPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSnapSetupPopup, setShowSnapSetupPopup] = useState(false);
  const debugLabelsRef = useRef<RouteDebugLabels | null>(null);
  const routeSelection = useRoutingStore((state) => state.selectedRoute);
  // Auto size the left scene tree based on content (inline to avoid nested hook issues)
  const [leftTreeWidth, setLeftTreeWidth] = useState<number>(240);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.font = `13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

    const getTextWidth = (t: string) =>
      ctx ? ctx.measureText(t).width : Math.max(120, t.length * 7);
    const PADDING = 16,
      ICON = 16,
      ARROW = 14,
      BADGES = 40,
      INDENT = 16;
    const MAX = 800,
      MIN = 240;

    const calcNodeWidth = (id: string, level = 0): number => {
      const tree = SceneTreeManager.getInstance();
      const node = tree.getNode(id);
      if (!node) return 0;
      const base = level * INDENT + ARROW + ICON + getTextWidth(node.name) + BADGES + PADDING;
      let maxChild = 0;
      if (node.expanded) {
        for (const c of SceneTreeManager.getInstance().getChildren(id)) {
          if (c.showInTree === false) continue;
          maxChild = Math.max(maxChild, calcNodeWidth(c.id, level + 1));
        }
      }
      return Math.max(base, maxChild);
    };

    const recalc = () => {
      const tree = SceneTreeManager.getInstance();
      const root = tree.getRootNode();
      if (!root) return;
      const w = Math.max(MIN, Math.min(MAX, calcNodeWidth(root.id)));
      setLeftTreeWidth(w);
    };

    recalc();

    // Use requestAnimationFrame for fast, smooth resizing
    let rafId: number | null = null;
    let pendingRecalc = false;

    const scheduleRecalc = () => {
      if (pendingRecalc) return;
      pendingRecalc = true;
      rafId = requestAnimationFrame(() => {
        recalc();
        pendingRecalc = false;
        rafId = null;
      });
    };

    const onTree = () => scheduleRecalc();
    window.addEventListener('scenetree-update', onTree);
    window.addEventListener('model-import-complete', onTree);
    return () => {
      window.removeEventListener('scenetree-update', onTree);
      window.removeEventListener('model-import-complete', onTree);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Load saved panel layout on mount
  useEffect(() => {
    const layout = loadPanelLayout();
    if (layout) {
      setSavedLayout(layout);
    }
  }, [loadPanelLayout]);

  // Initialize RouteDebugLabels when scene is available
  useEffect(() => {
    const scene = SceneManager.getInstance().getScene();
    if (scene) {
      debugLabelsRef.current = new RouteDebugLabels(scene);
      // Set global reference for commands to access
      setGlobalDebugLabels(debugLabelsRef.current);
      // Set initial visibility state
      debugLabelsRef.current.setVisible(showDebugLabels);
    }
    return () => {
      debugLabelsRef.current?.clearAll();
      setGlobalDebugLabels(null);
    };
  }, [showDebugLabels]);

  // Update debug labels visibility when state changes
  useEffect(() => {
    debugLabelsRef.current?.setVisible(showDebugLabels);
  }, [showDebugLabels]);

  // Keyboard shortcut for debug labels toggle
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        setShowDebugLabels((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && importModel) {
      for (let i = 0; i < files.length; i++) {
        await importModel(files[i]);
      }
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleExport = () => {
    setShowExportDialog(true);
  };

  const handleTransformTool = (mode: 'translate' | 'rotate' | 'scale') => {
    if (!selectedNodeId) return;

    // If clicking the same mode, toggle gizmo visibility like Essential mode
    if (transformMode === mode) {
      setTransformGizmoEnabled(!transformGizmoEnabled);
      return;
    }

    // Switching modes: ensure gizmo is enabled and set the new mode
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
    const { BooleanOperationCommand } = await import(
      '../../history/commands/BooleanOperationCommand'
    );

    if (selectedNodeIds.length !== 2) {
      toast.warning(
        'Please select exactly two objects for Boolean operations (Ctrl+Click to multi-select)'
      );
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

  const handleMeasurement = (type: 'distance' | 'angle' | 'volume') => {
    setActiveMeasurement(type);
  };

  const handleCloseMeasurement = () => {
    setActiveMeasurement(null);
  };

  const handleToggleBabylonInspector = async () => {
    try {
      const sceneManager = SceneManager.getInstance();
      await sceneManager.toggleInspector();
    } catch (error) {
      console.error('[ProfessionalModeLayout] Failed to toggle inspector:', error);
    }
  };

  // Essentials-parity helpers
  const handleAddFrame = () => {
    const addPermanentFrame = (useEditorStore as any).getState().addPermanentFrame;
    if (typeof addPermanentFrame === 'function') addPermanentFrame();
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
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();
    if (!scene || !camera) return;
    const meshes = scene.meshes.filter(m => m.isVisible && m.getTotalVertices() > 0);
    if (meshes.length === 0) return;
    let min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    let max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    meshes.forEach(m => {
      const bi = m.getBoundingInfo();
      const bmin = bi.boundingBox.minimumWorld;
      const bmax = bi.boundingBox.maximumWorld;
      min = BABYLON.Vector3.Minimize(min, bmin);
      max = BABYLON.Vector3.Maximize(max, bmax);
    });
    const center = min.add(max).scale(0.5);
    const extents = max.subtract(min);
    const radius = Math.max(extents.x, extents.y, extents.z) * 1.2 + 1;
    camera.target = center;
    camera.radius = radius;
  };

  const handleZoomToSelected = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (!camera || !selectedNodeId) return;
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(selectedNodeId);
    if (node && node.position) {
      const pos = new BABYLON.Vector3(node.position.x, node.position.y, node.position.z);
      camera.target = pos;
      camera.radius = Math.max(3, camera.radius * 0.6);
    }
  };

  const handleTopView = () => { setCurrentView && setCurrentView('top'); const cam = SceneManager.getInstance().getCamera(); if (cam) { cam.alpha = -Math.PI / 2; cam.beta = 0.001; } };
  const handleRightView = () => { setCurrentView && setCurrentView('right'); const cam = SceneManager.getInstance().getCamera(); if (cam) { cam.alpha = 0; cam.beta = Math.PI / 2.2; } };
  const handleFrontView = () => { setCurrentView && setCurrentView('front'); const cam = SceneManager.getInstance().getCamera(); if (cam) { cam.alpha = Math.PI; cam.beta = Math.PI / 2.2; } };
  const handleIsoView = () => { setCurrentView && setCurrentView('iso'); const cam = SceneManager.getInstance().getCamera(); if (cam) { cam.alpha = -Math.PI / 4; cam.beta = Math.PI / 4; } };

  return (
    <div className="professional-layout">
      {/* Route Warnings Panel - Top notification bar */}
      <RouteWarningsPanel />

      {/* Header */}
      <header className="professional-header">
        <div className="header-left">
          {/* Match Essentials logo block: icon + gradient text + tagline */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/50">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold">
                <span className="bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">
                  kinetic CORE
                </span>
                {/* Subtle PRO indicator: text-only, brighter green and slightly higher */}
                <span
                  className="ml-1 align-middle inline-flex items-center text-[9px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#22ff7a',
                    position: 'relative',
                    top: '-7px',
                  }}
                  aria-label="Professional Edition"
                >
                  PRO
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
            <button className="action-btn" title="Save" onClick={saveWorld}>
              <Save size={18} />
            </button>
            <button className="action-btn" title="Import Model" onClick={handleImport}>
              <Upload size={18} />
            </button>
            <button className="action-btn" title="Export" onClick={handleExport}>
              <Download size={18} />
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
              if (
                newLevel === 'essential' ||
                newLevel === 'professional' ||
                newLevel === 'expert'
              ) {
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

      {/* Ribbon Toolbar wrapped in experiment container */}
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
            <button className="tool-btn" title="Zoom to Selected" onClick={handleZoomToSelected} disabled={!selectedNodeId}>
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
              onClick={() => setShowSnapSetupPopup(true)}
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

        {/* Routing section moved to Routing tab */}
          </>
        )}

        {activeWorkspace === 'simulation' && (
          <>
            <div className="tool-group">
              <div className="group-label">Simulation</div>
              <div className="tool-buttons">
                <button className="tool-btn" title="Start Simulation">
                  <Play size={18} />
                  <span>Start</span>
                </button>
                <button className="tool-btn" title="Pause Simulation">
                  <Pause size={18} />
                  <span>Pause</span>
                </button>
                <button className="tool-btn" title="Reset Simulation">
                  <RefreshCw size={18} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div className="toolbar-separator"></div>

            {/* Kinematics Tools moved here */}
            <div className="tool-group">
              <div className="group-label">Kinematics</div>
              <div className="tool-buttons">
                <button
                  className="tool-btn"
                  onClick={() => setShowKinematicsPanel(true)}
                  title="Motion Panel"
                >
                  <Rocket size={18} />
                  <span className="tool-btn-label">Motion</span>
                </button>
                <button
                  className="tool-btn"
                  onClick={() => setShowKinematicsAnalysisPanel(true)}
                  title="Kinematics Analysis"
                >
                  <Calculator size={18} />
                  <span className="tool-btn-label">Analysis</span>
                </button>
                <button
                  className="tool-btn"
                  onClick={() => setShowActuatorPanel(true)}
                  title="Actuator Control"
                >
                  <div style={{ position: 'relative', width: 18, height: 18 }}>
                    <Zap size={12} style={{ position: 'absolute', left: 1, top: 1 }} />
                    <Settings size={12} style={{ position: 'absolute', right: 1, bottom: 1 }} />
                  </div>
                  <span className="tool-btn-label">Actuators</span>
                </button>
                <button
                  className="tool-btn"
                  onClick={() => setShowComplexIKPanel(true)}
                  title="Complex IK Systems"
                >
                  <GitBranch size={18} />
                  <span className="tool-btn-label">Complex IK</span>
                </button>
                <button
                  className="tool-btn"
                  onClick={() => setShowWholeBodyIKPanel(true)}
                  title="FullBody IK"
                >
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
                <button
                  className="tool-btn"
                  onClick={() => setShowICPTestPanel(true)}
                  title="ICP Test Tool - Manual FIXED/MOVING Selection"
                >
                  <TestTube size={18} />
                  <span className="tool-btn-label">ICP Test</span>
                </button>
              </div>
            </div>
          </>
        )}

        {activeWorkspace === 'routing' && (
          <>
            {/* Routing Tools moved from Modeling */}
            <div className="tool-group">
              <div className="group-label">Routing</div>
              <div className="tool-buttons">
                <button
                  className={`tool-btn ${showDebugLabels ? 'active' : ''}`}
                  onClick={() => setShowDebugLabels(!showDebugLabels)}
                  title="Toggle Route Debug Labels (D)"
                >
                  {showDebugLabels ? <Eye size={18} /> : <EyeOff size={18} />}
                  <span className="tool-btn-label">Labels</span>
                </button>
                <button
                  className="tool-btn"
                  onClick={handleToggleBabylonInspector}
                  title="Toggle Babylon Scene Inspector (Alt+I)"
                >
                  <Search size={18} />
                  <span className="tool-btn-label">Inspector</span>
                </button>
                <button
                  className={`tool-btn ${showTemplatesPanel ? 'active' : ''}`}
                  onClick={() => setShowTemplatesPanel(!showTemplatesPanel)}
                  title="Open Route Templates Library"
                >
                  <LayoutTemplate size={18} />
                  <span className="tool-btn-label">Templates</span>
                </button>
              </div>
            </div>
          </>
        )}

        {activeWorkspace === 'analysis' && (
          <>
            <div className="tool-group">
              <div className="group-label">Analysis</div>
              <div className="tool-buttons">
                <button className="tool-btn" title="Placeholder">
                  <Search size={18} />
                  <span>Inspect</span>
                </button>
                <button className="tool-btn" title="Placeholder">
                  <Activity size={18} />
                  <span>Metrics</span>
                </button>
                <button className="tool-btn" title="Placeholder">
                  <Download size={18} />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </>
        )}
        </ToolbarContainer>
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
              { id: 'sceneTree-panel', type: 'sceneTree' },
              { id: 'toolPalette-panel', type: 'toolPalette' },
            ],
            rightPanels: [
              { id: 'warehouse-panel', type: 'warehouse', title: 'Factory' },
              { id: 'routingControl-panel', type: 'routingControl', title: 'Route' },
              { id: 'routeStats-panel', type: 'routeStats', title: 'Routing Analyses' },
            ],
            bottomPanels: [],
          }}
          leftGroupWidth={leftTreeWidth}
          onLayoutChange={savePanelLayout}
          savedLayout={savedLayout}
        />
      </div>

      {/* Hidden file input for importing models */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.dae,.gltf,.glb,.dxf,.dwg,.jt,.xml,.usd,.usdz,.zip"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Move Object Dialog */}
      <MoveObjectDialog isOpen={showMoveDialog} onClose={() => setShowMoveDialog(false)} />

      {/* Export Dialog */}
      <ExportDialog isOpen={showExportDialog} onClose={() => setShowExportDialog(false)} />

      {/* Route Templates Panel */}
      <RouteTemplatesPanel
        isOpen={showTemplatesPanel}
        onClose={() => setShowTemplatesPanel(false)}
      />

      {/* Measurement Tools */}
      <MeasurementTools measurementType={activeMeasurement} onClose={handleCloseMeasurement} />

      {/* Route Selection Visuals - Cyan glow and connection handles */}
      <RouteSelectionVisuals />

      {/* Connection Points Renderer - Shows sphere indicators */}
      <ConnectionPointsRenderer />

      {/* Route Edit Panel - Right side panel */}
      {routeSelection && (
        <RouteEditPanel
          route={routeSelection}
          onClose={() => useRoutingStore.getState().selectRoute(null)}
        />
      )}

      {/* Kinematic Extraction Panel - Floating overlay */}
      <KinematicExtractionPanel
        isVisible={showKinematicExtractionPanel}
        onClose={() => setShowKinematicExtractionPanel(false)}
        zIndex={1003}
      />

      {/* Floating Settings Panel - Contains Skybox tab */}
      <FloatingSettingsPanel
        isVisible={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        zIndex={1010}
      />

      {/* Snap Setup Popup - Quick access from ribbon */}

      {/* Kinematics Floating Panels (same components as Essentials) */}
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
      <SnapSetupPopup isOpen={showSnapSetupPopup} onClose={() => setShowSnapSetupPopup(false)} />
    </div>
  );
};
