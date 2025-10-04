// Professional Mode Layout - Engineer/Designer interface
// Owner: George (Architecture)

import React, { useState, useRef } from 'react';
import {
  Box,
  Circle,
  Cylinder,
  Cone,
  Square,
  Pill,
  Disc,
  Diamond,
  Move,
  RotateCw,
  Scale,
  Copy,
  Grid3x3,
  Layers,
  Save,
  Upload,
  Download,
  Undo,
  Redo,
} from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { Inspector } from '../components/Inspector';
import { SceneTree } from '../components/SceneTree';
import './ProfessionalModeLayout.css';

export const ProfessionalModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const importModel = useEditorStore((state) => state.importModel);
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const duplicateNode = useEditorStore((state) => state.duplicateNode);
  const commandManager = useEditorStore((state) => state.commandManager);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo());
  const canRedo = useEditorStore((state) => state.canRedo());

  const [activeWorkspace, setActiveWorkspace] = useState<'modeling' | 'simulation' | 'analysis'>('modeling');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && importModel) {
      await importModel(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleExport = () => {
    // TODO: Implement proper export dialog with format selection
    saveWorld();
  };

  const handleTransformTool = (mode: 'translate' | 'rotate' | 'scale') => {
    if (selectedNodeId) {
      setTransformMode(mode);
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
    // TODO: Implement measurement tools
    console.log(`${type} measurement coming soon`);
  };

  return (
    <div className="professional-layout">
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
            <button className="action-btn" title="Import" onClick={handleImport}>
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
            <button
              className="tool-btn"
              title="Box"
              onClick={() => createObject('box')}
            >
              <Box size={20} />
              <span>Box</span>
            </button>
            <button
              className="tool-btn"
              title="Sphere"
              onClick={() => createObject('sphere')}
            >
              <Circle size={20} />
              <span>Sphere</span>
            </button>
            <button
              className="tool-btn"
              title="Cylinder"
              onClick={() => createObject('cylinder')}
            >
              <Cylinder size={20} />
              <span>Cylinder</span>
            </button>
            <button
              className="tool-btn"
              title="Cone"
              onClick={() => createObject('cone')}
            >
              <Cone size={20} />
              <span>Cone</span>
            </button>
            <button
              className="tool-btn"
              title="Torus"
              onClick={() => createObject('torus')}
            >
              <Circle size={20} />
              <span>Torus</span>
            </button>
            <button
              className="tool-btn"
              title="Plane"
              onClick={() => createObject('plane')}
            >
              <Square size={20} />
              <span>Plane</span>
            </button>
            <button
              className="tool-btn"
              title="Ground"
              onClick={() => createObject('ground')}
            >
              <Square size={20} />
              <span>Ground</span>
            </button>
            <button
              className="tool-btn"
              title="Capsule"
              onClick={() => createObject('capsule')}
            >
              <Pill size={20} />
              <span>Capsule</span>
            </button>
            <button
              className="tool-btn"
              title="Disc"
              onClick={() => createObject('disc')}
            >
              <Disc size={20} />
              <span>Disc</span>
            </button>
            <button
              className="tool-btn"
              title="Torus Knot"
              onClick={() => createObject('torusknot')}
            >
              <Circle size={20} />
              <span>TorusKnot</span>
            </button>
            <button
              className="tool-btn"
              title="Polyhedron"
              onClick={() => createObject('polyhedron')}
            >
              <Diamond size={20} />
              <span>Polyhedron</span>
            </button>
          </div>
        </div>

        <div className="toolbar-separator"></div>

        {/* Transform Tools */}
        <div className="tool-group">
          <div className="group-label">Transform</div>
          <div className="tool-buttons">
            <button
              className="tool-btn"
              disabled={!selectedNodeId}
              title={selectedNodeId ? "Move" : "Select an object first"}
              onClick={() => handleTransformTool('translate')}
            >
              <Move size={20} />
              <span>Move</span>
            </button>
            <button
              className="tool-btn"
              disabled={!selectedNodeId}
              title={selectedNodeId ? "Rotate" : "Select an object first"}
              onClick={() => handleTransformTool('rotate')}
            >
              <RotateCw size={20} />
              <span>Rotate</span>
            </button>
            <button
              className="tool-btn"
              disabled={!selectedNodeId}
              title={selectedNodeId ? "Scale" : "Select an object first"}
              onClick={() => handleTransformTool('scale')}
            >
              <Scale size={20} />
              <span>Scale</span>
            </button>
            <button
              className="tool-btn"
              disabled={!selectedNodeId}
              title={selectedNodeId ? "Duplicate (Ctrl+D)" : "Select an object first"}
              onClick={handleCopy}
            >
              <Copy size={20} />
              <span>Duplicate</span>
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
              title="Distance (Coming Soon)"
              onClick={() => handleMeasurement('distance')}
            >
              Distance
            </button>
            <button
              className="tool-btn-small"
              title="Angle (Coming Soon)"
              onClick={() => handleMeasurement('angle')}
            >
              Angle
            </button>
            <button
              className="tool-btn-small"
              title="Volume (Coming Soon)"
              onClick={() => handleMeasurement('volume')}
            >
              Volume
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="professional-content">
        {/* Left Sidebar */}
        <aside className="professional-left-sidebar">
          {/* Scene Tree */}
          <SceneTree />

          {/* Tool Palette */}
          <div className="panel">
            <div className="panel-header">
              <Grid3x3 size={16} />
              <h3>Tool Palette</h3>
            </div>
            <div className="panel-content">
              <div className="palette-category">
                <div className="category-title">Primitives</div>
                <div className="palette-grid">
                  <button
                    className="palette-item"
                    title="Box"
                    onClick={() => createObject('box')}
                  >
                    <Box size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Sphere"
                    onClick={() => createObject('sphere')}
                  >
                    <Circle size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Cylinder"
                    onClick={() => createObject('cylinder')}
                  >
                    <Cylinder size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Cone"
                    onClick={() => createObject('cone')}
                  >
                    <Cone size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Torus"
                    onClick={() => createObject('torus')}
                  >
                    <Circle size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Plane"
                    onClick={() => createObject('plane')}
                  >
                    <Square size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Ground"
                    onClick={() => createObject('ground')}
                  >
                    <Square size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Capsule"
                    onClick={() => createObject('capsule')}
                  >
                    <Pill size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Disc"
                    onClick={() => createObject('disc')}
                  >
                    <Disc size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Torus Knot"
                    onClick={() => createObject('torusknot')}
                  >
                    <Circle size={20} />
                  </button>
                  <button
                    className="palette-item"
                    title="Polyhedron"
                    onClick={() => createObject('polyhedron')}
                  >
                    <Diamond size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Layers Panel */}
          <div className="panel">
            <div className="panel-header">
              <Layers size={16} />
              <h3>Layers</h3>
            </div>
            <div className="panel-content">
              <div className="layer-item active">
                <span className="layer-visibility">👁</span>
                <span className="layer-name">Layer 1</span>
              </div>
              <button className="layer-add" disabled>
                + Add Layer
              </button>
            </div>
          </div>
        </aside>

        {/* Main Viewport - SceneCanvas will overlay this */}
        <main id="viewport-professional" className="professional-viewport"></main>

        {/* Right Sidebar */}
        <aside className="professional-right-sidebar">
          {/* Inspector */}
          <Inspector />
        </aside>
      </div>

      {/* Hidden file input for importing models */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.dxf,.jt,.catpart,.catproduct,.catdrawing"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};
