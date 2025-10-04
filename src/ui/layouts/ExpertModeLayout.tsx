// Expert Mode Layout - Power User/Enterprise interface
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
  Code,
  Command,
  Layout,
  Terminal,
  GitBranch,
  Save,
  Upload,
  Download,
  Play,
  Pause,
} from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { Inspector } from '../components/Inspector';
import { SceneTree } from '../components/SceneTree';
import './ExpertModeLayout.css';

export const ExpertModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const importModel = useEditorStore((state) => state.importModel);
  const saveWorld = useEditorStore((state) => state.saveWorld);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
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

  const handleCommandPaletteToggle = () => {
    setCommandPaletteOpen(!commandPaletteOpen);
    setCommandQuery('');
  };

  // Keyboard shortcut for command palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleCommandPaletteToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen]);

  return (
    <div className="expert-layout">
      {/* Header */}
      <header className="expert-header">
        <div className="header-left">
          <h1 className="logo">kinetiCORE</h1>
          <div className="custom-workspace-tabs">
            <button className="workspace-tab active">Workspace 1</button>
            <button className="workspace-tab" disabled>
              Workspace 2
            </button>
            <button className="workspace-tab" disabled>
              + New
            </button>
          </div>
          <span className="mode-badge expert">Expert Mode</span>
        </div>
        <div className="header-center">
          <div className="command-palette">
            <Command size={16} />
            <input
              type="text"
              placeholder="Command Palette (Ctrl+K)"
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              onFocus={() => setCommandPaletteOpen(true)}
              onBlur={() => setTimeout(() => setCommandPaletteOpen(false), 200)}
            />
          </div>
        </div>
        <div className="header-right">
          <button className="macro-btn" title="Macro Recorder (Coming Soon)" disabled>
            <Code size={16} />
          </button>
          <button className="macro-btn" title="Script Editor (Coming Soon)" disabled>
            <Terminal size={16} />
          </button>
          <button className="macro-btn" title="Layout Manager (Coming Soon)" disabled>
            <Layout size={16} />
          </button>
          <div className="separator"></div>
          <button className="action-btn" title="Save" onClick={saveWorld}>
            <Save size={16} />
          </button>
          <button className="action-btn" title="Import" onClick={handleImport}>
            <Upload size={16} />
          </button>
          <button className="action-btn" title="Export" onClick={saveWorld}>
            <Download size={16} />
          </button>
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

      {/* Custom Ribbon */}
      <div className="expert-ribbon">
        <div className="ribbon-section">
          <span className="ribbon-label">Creation</span>
          <div className="ribbon-tools">
            <button
              className="ribbon-btn"
              onClick={() => createObject('box')}
              title="Create Box"
            >
              <Box size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('sphere')}
              title="Create Sphere"
            >
              <Circle size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('cylinder')}
              title="Create Cylinder"
            >
              <Cylinder size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('cone')}
              title="Create Cone"
            >
              <Cone size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('torus')}
              title="Create Torus"
            >
              <Circle size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('plane')}
              title="Create Plane"
            >
              <Square size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('ground')}
              title="Create Ground"
            >
              <Square size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('capsule')}
              title="Create Capsule"
            >
              <Pill size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('disc')}
              title="Create Disc"
            >
              <Disc size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('torusknot')}
              title="Create Torus Knot"
            >
              <Circle size={18} />
            </button>
            <button
              className="ribbon-btn"
              onClick={() => createObject('polyhedron')}
              title="Create Polyhedron"
            >
              <Diamond size={18} />
            </button>
          </div>
        </div>
        <div className="ribbon-section">
          <span className="ribbon-label">Transform</span>
          <div className="ribbon-tools">
            <button className="ribbon-btn" disabled>
              Move
            </button>
            <button className="ribbon-btn" disabled>
              Rotate
            </button>
            <button className="ribbon-btn" disabled>
              Scale
            </button>
          </div>
        </div>
        <div className="ribbon-section">
          <span className="ribbon-label">Analysis</span>
          <div className="ribbon-tools">
            <button className="ribbon-btn" disabled>
              FEA
            </button>
            <button className="ribbon-btn" disabled>
              CFD
            </button>
            <button className="ribbon-btn" disabled>
              Motion
            </button>
          </div>
        </div>
        <div className="ribbon-section">
          <span className="ribbon-label">Manufacturing</span>
          <div className="ribbon-tools">
            <button className="ribbon-btn" disabled>
              Toolpath
            </button>
            <button className="ribbon-btn" disabled>
              Simulate
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="expert-content">
        {/* Left Panel */}
        <aside className="expert-left-panel">
          {/* Tabbed Panels */}
          <div className="panel-tabs">
            <button className="panel-tab active">Scene</button>
            <button className="panel-tab" disabled>
              Plugins
            </button>
            <button className="panel-tab" disabled>
              Scripts
            </button>
          </div>

          <div className="panel-content">
            {/* Scene Tree */}
            <SceneTree />

            {/* Script Editor Preview */}
            <div className="script-editor-preview">
              <div className="editor-header">
                <Code size={14} />
                <span>Script Editor</span>
              </div>
              <div className="editor-content">
                <pre>
                  <code className="disabled-text">
                    {`// Python Script
def create_array():
    # Coming soon
    pass`}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </aside>

        {/* Center - Quad Viewport */}
        <main className="expert-center">
          <div className="quad-viewport">
            <div className="viewport-quad">
              <div className="viewport-label">Top View</div>
              <div className="viewport-content disabled">
                <div className="viewport-placeholder">Top</div>
              </div>
            </div>
            <div className="viewport-quad">
              <div className="viewport-label">Front View</div>
              <div className="viewport-content disabled">
                <div className="viewport-placeholder">Front</div>
              </div>
            </div>
            <div className="viewport-quad">
              <div className="viewport-label">Right View</div>
              <div className="viewport-content disabled">
                <div className="viewport-placeholder">Right</div>
              </div>
            </div>
            <div className="viewport-quad active">
              <div className="viewport-label">Perspective</div>
              <div id="viewport-expert" className="viewport-content"></div>
            </div>
          </div>
        </main>

        {/* Right Panel */}
        <aside className="expert-right-panel">
          {/* Tabbed Panels */}
          <div className="panel-tabs">
            <button className="panel-tab active">Properties</button>
            <button className="panel-tab" disabled>
              Console
            </button>
            <button className="panel-tab" disabled>
              Version
            </button>
          </div>

          <div className="panel-content">
            {/* Inspector */}
            <Inspector />

            {/* Version Control Preview */}
            <div className="version-control-preview">
              <div className="vc-header">
                <GitBranch size={14} />
                <span>Version Control</span>
              </div>
              <div className="vc-content disabled-text">
                <p>Git integration coming soon</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Panel - Timeline/Console */}
      <div className="expert-bottom-panel">
        <div className="bottom-tabs">
          <button className="bottom-tab active">Timeline</button>
          <button className="bottom-tab" disabled>
            Console
          </button>
          <button className="bottom-tab" disabled>
            Results
          </button>
        </div>
        <div className="bottom-content">
          <div className="timeline-controls">
            <button className="timeline-btn" disabled>
              <Play size={16} />
            </button>
            <button className="timeline-btn" disabled>
              <Pause size={16} />
            </button>
            <div className="timeline-scrubber">
              <input type="range" min="0" max="100" value="0" disabled />
            </div>
            <span className="timeline-time disabled-text">0:00 / 0:00</span>
          </div>
        </div>
      </div>

      {/* Hidden file input for importing models */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.jt,.catpart,.catproduct,.catdrawing"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};
