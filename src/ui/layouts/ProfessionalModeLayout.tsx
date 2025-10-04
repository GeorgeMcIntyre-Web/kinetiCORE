// Professional Mode Layout - Engineer/Designer interface
// Owner: George (Architecture)

import React from 'react';
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

  return (
    <div className="professional-layout">
      {/* Header */}
      <header className="professional-header">
        <div className="header-left">
          <h1 className="logo">kinetiCORE</h1>
          <div className="workspace-tabs">
            <button className="workspace-tab active">Modeling</button>
            <button className="workspace-tab" disabled>
              Simulation
            </button>
            <button className="workspace-tab" disabled>
              Analysis
            </button>
          </div>
          <span className="mode-badge professional">Professional Mode</span>
        </div>
        <div className="header-right">
          <div className="global-actions">
            <button className="action-btn" title="Save">
              <Save size={18} />
            </button>
            <button className="action-btn" title="Import" disabled>
              <Upload size={18} />
            </button>
            <button className="action-btn" title="Export" disabled>
              <Download size={18} />
            </button>
            <div className="separator"></div>
            <button className="action-btn" title="Undo" disabled>
              <Undo size={18} />
            </button>
            <button className="action-btn" title="Redo" disabled>
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
            <button className="tool-btn" disabled title="Move">
              <Move size={20} />
              <span>Move</span>
            </button>
            <button className="tool-btn" disabled title="Rotate">
              <RotateCw size={20} />
              <span>Rotate</span>
            </button>
            <button className="tool-btn" disabled title="Scale">
              <Scale size={20} />
              <span>Scale</span>
            </button>
            <button className="tool-btn" disabled title="Copy">
              <Copy size={20} />
              <span>Copy</span>
            </button>
          </div>
        </div>

        <div className="toolbar-separator"></div>

        {/* Modify Tools */}
        <div className="tool-group">
          <div className="group-label">Modify</div>
          <div className="tool-buttons">
            <button className="tool-btn-small" disabled title="Union">
              Union
            </button>
            <button className="tool-btn-small" disabled title="Subtract">
              Subtract
            </button>
            <button className="tool-btn-small" disabled title="Intersect">
              Intersect
            </button>
          </div>
        </div>

        <div className="toolbar-separator"></div>

        {/* Measure Tools */}
        <div className="tool-group">
          <div className="group-label">Measure</div>
          <div className="tool-buttons">
            <button className="tool-btn-small" disabled title="Distance">
              Distance
            </button>
            <button className="tool-btn-small" disabled title="Angle">
              Angle
            </button>
            <button className="tool-btn-small" disabled title="Volume">
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
    </div>
  );
};
