// Professional Mode Layout - Engineer/Designer interface
// Owner: George (Architecture)

import React, { useState, useRef, useEffect } from 'react';
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
  Grab,
  Search,
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
import { Scan, Settings } from 'lucide-react';
import { CreateDropdown } from '../components/CreateDropdown';
import { FloatingSettingsPanel } from '../components/FloatingSettingsPanel';
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

  const [activeWorkspace, setActiveWorkspace] = useState<'modeling' | 'simulation' | 'analysis'>('modeling');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedLayout, setSavedLayout] = useState<any>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [activeMeasurement, setActiveMeasurement] = useState<MeasurementType>(null);
  const [showDebugLabels, setShowDebugLabels] = useState(false);
  const [showKinematicExtractionPanel, setShowKinematicExtractionPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const debugLabelsRef = useRef<RouteDebugLabels | null>(null);
  const routeSelection = useRoutingStore((state) => state.selectedRoute);
  // Auto size the left scene tree based on content (inline to avoid nested hook issues)
  const [leftTreeWidth, setLeftTreeWidth] = useState<number>(240);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.font = `13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

    const getTextWidth = (t: string) => (ctx ? ctx.measureText(t).width : Math.max(120, t.length * 7));
    const PADDING = 16, ICON = 16, ARROW = 14, BADGES = 40, INDENT = 16; const MAX = 800, MIN = 240;

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
    const onTree = () => setTimeout(recalc, 80);
    window.addEventListener('scenetree-update', onTree);
    window.addEventListener('model-import-complete', onTree);
    return () => {
      window.removeEventListener('scenetree-update', onTree);
      window.removeEventListener('model-import-complete', onTree);
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

  return (
    <div className="professional-layout">
      {/* Route Warnings Panel - Top notification bar */}
      <RouteWarningsPanel />

      {/* Header */}
      <header className="professional-header">
        <div className="header-left">
          <h1 className="logo">kinetiCORE</h1>
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
              className={`workspace-tab ${activeWorkspace === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveWorkspace('analysis')}
            >
              Analysis
            </button>
          </div>
          <span className="mode-badge professional">Professional Mode</span>
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
              title={canUndo ? "Undo (Ctrl+Z)" : "Nothing to undo"}
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo size={18} />
            </button>
            <button
              className="action-btn"
              title={canRedo ? "Redo (Ctrl+Y)" : "Nothing to redo"}
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
              title={selectedNodeId ? "Move" : "Select an object first"}
              onClick={() => handleTransformTool('translate')}
            >
              <Move size={18} />
              <span>Move</span>
            </button>
            <button
              className={`tool-btn ${transformMode === 'rotate' && transformGizmoEnabled ? 'active' : ''}`}
              disabled={!selectedNodeId}
              title={selectedNodeId ? "Rotate" : "Select an object first"}
              onClick={() => handleTransformTool('rotate')}
            >
              <RotateCw size={18} />
              <span>Rotate</span>
            </button>
            <button
              className={`tool-btn ${transformMode === 'scale' && transformGizmoEnabled ? 'active' : ''}`}
              disabled={!selectedNodeId}
              title={selectedNodeId ? "Scale" : "Select an object first"}
              onClick={() => handleTransformTool('scale')}
            >
              <Scale size={18} />
              <span>Scale</span>
            </button>
            <button
              className={`tool-btn ${transformGizmoEnabled ? 'active' : ''}`}
              disabled={!selectedNodeId}
              title={selectedNodeId ? (transformGizmoEnabled ? "Disable Transform Gizmo" : "Enable Transform Gizmo") : "Select an object first"}
              onClick={() => setTransformGizmoEnabled(!transformGizmoEnabled)}
            >
              <Grab size={18} />
              <span>Gizmo</span>
            </button>
            <button
              className="tool-btn"
              disabled={!selectedNodeId}
              title={selectedNodeId ? "Duplicate (Ctrl+D)" : "Select an object first"}
              onClick={handleCopy}
            >
              <Copy size={18} />
              <span>Duplicate</span>
            </button>
            <button
              className="tool-btn"
              disabled={!selectedNodeId}
              title={selectedNodeId ? "Quick Move Dialog (Relative/Absolute positioning)" : "Select an object first"}
              onClick={() => setShowMoveDialog(true)}
            >
              <Navigation size={18} />
              <span>Position</span>
            </button>
          </div>
        </div>

        <div className="toolbar-separator"></div>

        {/* Modify Tools */}
        <div className="tool-group">
          <div className="group-label">Modify</div>
          <div className="tool-buttons">
            <button
              className="tool-btn-small"
              title={selectedNodeIds.length === 2 ? "Union - Combine two objects into one" : "Union - Select exactly 2 objects (Ctrl+Click)"}
              disabled={selectedNodeIds.length !== 2}
              onClick={() => handleBooleanOperation('union')}
            >
              Union
            </button>
            <button
              className="tool-btn-small"
              title={selectedNodeIds.length === 2 ? "Subtract - Remove 2nd object from 1st" : "Subtract - Select exactly 2 objects (Ctrl+Click)"}
              disabled={selectedNodeIds.length !== 2}
              onClick={() => handleBooleanOperation('subtract')}
            >
              Subtract
            </button>
            <button
              className="tool-btn-small"
              title={selectedNodeIds.length === 2 ? "Intersect - Keep only overlapping volume" : "Intersect - Select exactly 2 objects (Ctrl+Click)"}
              disabled={selectedNodeIds.length !== 2}
              onClick={() => handleBooleanOperation('intersect')}
            >
              Intersect
            </button>
          </div>
        </div>

        <div className="toolbar-separator"></div>

        {/* Measure Tools */}
        <div className="tool-group">
          <div className="group-label">Measure</div>
          <div className="tool-buttons">
            <button
              className="tool-btn-small"
              title="Measure distance between two points"
              onClick={() => handleMeasurement('distance')}
            >
              Distance
            </button>
            <button
              className="tool-btn-small"
              title="Measure angle between three points"
              onClick={() => handleMeasurement('angle')}
            >
              Angle
            </button>
            <button
              className="tool-btn-small"
              title="Measure volume of selected objects"
              onClick={() => handleMeasurement('volume')}
            >
              Volume
            </button>
          </div>
        </div>

        <div className="toolbar-separator"></div>

        {/* Routing Tools */}
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

        <div className="toolbar-separator"></div>

        {/* Kinematics Tools */}
        <div className="tool-group">
          <div className="group-label">Kinematics</div>
          <div className="tool-buttons">
            <button
              className={`tool-btn ${showKinematicExtractionPanel ? 'active' : ''}`}
              onClick={() => setShowKinematicExtractionPanel(!showKinematicExtractionPanel)}
              title="Auto Kinematic Extraction - Hierarchical BBox Pairing"
            >
              <Scan size={18} />
              <span className="tool-btn-label">Auto Extract</span>
            </button>

          </div>
        </div>
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
              { id: 'warehouse-panel', type: 'warehouse' },
              { id: 'routingControl-panel', type: 'routingControl' },
              { id: 'routeStats-panel', type: 'routeStats' },
              { id: 'inspector-panel', type: 'inspector' },
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
      <MeasurementTools
        measurementType={activeMeasurement}
        onClose={handleCloseMeasurement}
      />


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
    </div>
  );
};

