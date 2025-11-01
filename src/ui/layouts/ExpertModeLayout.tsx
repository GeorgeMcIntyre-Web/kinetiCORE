// Expert Mode Layout - Power User/Enterprise interface
// Owner: George (Architecture)

import React, { useState, useRef, useEffect } from 'react';
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
  Save,
  Upload,
  Download,
} from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { DockableLayoutWrapper } from './DockableLayoutWrapper';
import { ExportDialog } from '../components/ExportDialog';
import { SelectionIndicator } from '../components/SelectionIndicator';
import './ExpertModeLayout.css';

export const ExpertModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const importModel = useEditorStore((state) => state.importModel);
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const savePanelLayout = useEditorStore((state) => state.savePanelLayout);
  const loadPanelLayout = useEditorStore((state) => state.loadPanelLayout);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedLayout, setSavedLayout] = useState<any>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Load saved panel layout on mount
  useEffect(() => {
    const layout = loadPanelLayout();
    if (layout) {
      setSavedLayout(layout);
    }
  }, [loadPanelLayout]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandPaletteOpen]);

  return (
    <div className="expert-layout">
      {/* Selection Indicator - Always visible */}
      <SelectionIndicator selectedNodeIds={selectedNodeIds} />

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
          <button className="action-btn" title="Export" onClick={() => setShowExportDialog(true)}>
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

      {/* Main Content with Dockable Panels */}
      <div className="expert-content">
        <DockableLayoutWrapper
          config={{
            leftPanels: [
              { id: 'sceneTree-expert', type: 'sceneTree', title: 'Scene' },
            ],
            rightPanels: [
              { id: 'inspector-expert', type: 'inspector', title: 'Properties' },
            ],
            bottomPanels: [
              { id: 'kinematics-expert', type: 'kinematics', title: 'Timeline/Kinematics' },
            ],
            mainContent: (
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
            ),
          }}
          onLayoutChange={savePanelLayout}
          savedLayout={savedLayout}
        />
      </div>

      {/* Hidden file input for importing models */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.dxf,.dwg,.jt,.catpart,.catproduct,.catdrawing,.zip"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Export Dialog */}
      <ExportDialog isOpen={showExportDialog} onClose={() => setShowExportDialog(false)} />
    </div>
  );
};
