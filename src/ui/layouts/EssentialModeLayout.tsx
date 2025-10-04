// Essential Mode Layout - Beginner-friendly interface
// Owner: George (Architecture)

import React, { useRef } from 'react';
import {
  Box,
  Circle,
  Cylinder,
  Play,
  Palette,
  Save,
  HelpCircle,
  Upload
} from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import './EssentialModeLayout.css';

interface ActionCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  disabled: boolean;
}

export const EssentialModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const importModel = useEditorStore((state) => state.importModel);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && importModel) {
      importModel(file);
    }
    // Reset the input so the same file can be selected again
    if (event.target) {
      event.target.value = '';
    }
  };

  const actionCards: ActionCard[] = [
    {
      id: 'create',
      title: 'Create Your First Object',
      description: 'Choose a shape to start building',
      icon: <Box size={32} />,
      completed: false,
      disabled: false,
    },
    {
      id: 'import',
      title: 'Import Your Model',
      description: 'Load existing 3D models (URDF, STL, OBJ, JT, CATIA)',
      icon: <Upload size={32} />,
      completed: false,
      disabled: false,
    },
    {
      id: 'move',
      title: 'Move and Resize Objects',
      description: 'Learn to position and scale your creations',
      icon: <Play size={32} />,
      completed: false,
      disabled: true,
    },
    {
      id: 'color',
      title: 'Change Colors and Organize',
      description: 'Make your scene look great',
      icon: <Palette size={32} />,
      completed: false,
      disabled: true,
    },
    {
      id: 'save',
      title: 'Save Your Work',
      description: 'Keep your progress safe',
      icon: <Save size={32} />,
      completed: false,
      disabled: true,
    },
  ];

  return (
    <div className="essential-layout">
      {/* Header */}
      <header className="essential-header">
        <div className="header-left">
          <h1 className="logo">kinetiCORE</h1>
          <span className="mode-badge learning">Learning Mode</span>
        </div>
        <div className="header-right">
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

      {/* Main Content */}
      <div className="essential-content">
        {/* Left Sidebar - Learning Panel */}
        <aside className="essential-sidebar">
          {/* Welcome Section */}
          <div className="welcome-section">
            <h2>Welcome to kinetiCORE!</h2>
            <p className="welcome-text">
              Let's build something amazing together. Follow these steps to get started.
            </p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '0%' }}></div>
            </div>
            <p className="progress-text">0 of 5 steps completed</p>
          </div>

          {/* Action Cards */}
          <div className="action-cards">
            {actionCards.map((card) => (
              <div
                key={card.id}
                className={`action-card ${card.disabled ? 'disabled' : ''} ${
                  card.completed ? 'completed' : ''
                }`}
                onClick={card.id === 'import' && !card.disabled ? handleFileImport : undefined}
                style={card.id === 'import' && !card.disabled ? { cursor: 'pointer' } : undefined}
              >
                <div className="card-icon">{card.icon}</div>
                <div className="card-content">
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  {card.id === 'create' && !card.disabled && (
                    <div className="shape-gallery">
                      <button
                        className="shape-btn"
                        title="Create Box"
                        onClick={() => createObject('box')}
                      >
                        <Box size={24} />
                        <span>Box</span>
                      </button>
                      <button
                        className="shape-btn"
                        title="Create Sphere"
                        onClick={() => createObject('sphere')}
                      >
                        <Circle size={24} />
                        <span>Sphere</span>
                      </button>
                      <button
                        className="shape-btn"
                        title="Create Cylinder"
                        onClick={() => createObject('cylinder')}
                      >
                        <Cylinder size={24} />
                        <span>Cylinder</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Help Panel */}
          <div className="help-panel">
            <div className="help-header">
              <HelpCircle size={20} />
              <h3>Beginner Tips</h3>
            </div>
            <ul className="help-tips">
              <li>Click and drag to rotate the view</li>
              <li>Scroll to zoom in and out</li>
              <li>Select an object to see its properties</li>
              <li>Press Ctrl+Z to undo</li>
            </ul>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="essential-viewport">
          {/* Viewport Controls */}
          <div className="viewport-controls">
            <button className="control-btn" title="Reset View" disabled>
              Reset View
            </button>
            <button className="control-btn" title="Zoom to Fit" disabled>
              Zoom Fit
            </button>
          </div>

          {/* Getting Started Message */}
          <div className="getting-started">
            <div className="starter-message">
              <h2>Let's Create Something!</h2>
              <p>Choose a shape from the left panel to begin</p>
              <div className="starter-arrow">←</div>
            </div>
          </div>

          {/* Viewport container - SceneCanvas will overlay this */}
          <div id="viewport-essential" className="viewport-canvas"></div>
        </main>
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
