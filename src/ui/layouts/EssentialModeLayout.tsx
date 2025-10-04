// Essential Mode Layout - Beginner-friendly interface
// Owner: George (Architecture)

import React, { useRef, useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
  Box,
  Circle,
  Cylinder,
  Play,
  Palette,
  Save,
  HelpCircle,
  Upload,
  CheckCircle
} from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { SceneTree } from '../components/SceneTree';
import { KinematicsPanel } from '../components/KinematicsPanel';
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
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const zoomFit = useEditorStore((state) => state.zoomFit);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track action card completion state
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  // Track when user creates their first object
  useEffect(() => {
    if (selectedNodeId && !completedActions.has('create')) {
      setCompletedActions(prev => new Set(prev).add('create'));
    }
  }, [selectedNodeId]);

  const markActionComplete = (actionId: string) => {
    setCompletedActions(prev => new Set(prev).add(actionId));
  };

  const completedCount = completedActions.size;
  const totalActions = 5;

  const handleFileImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && importModel) {
      await importModel(file);
      markActionComplete('import');
    }
    // Reset the input so the same file can be selected again
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleEnableTransform = () => {
    if (selectedNodeId) {
      setTransformMode('translate');
      markActionComplete('move');
    }
  };

  const handleSaveWork = () => {
    saveWorld();
    markActionComplete('save');
  };

  const handleResetView = () => {
    const sceneManager = require('../../scene/SceneManager').SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      // Reset to default camera position
      camera.alpha = -Math.PI / 2;
      camera.beta = Math.PI / 3;
      camera.radius = 10;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleZoomFit = () => {
    zoomFit();
  };

  const actionCards: ActionCard[] = [
    {
      id: 'create',
      title: 'Create Your First Object',
      description: 'Choose a shape to start building',
      icon: <Box size={32} />,
      completed: completedActions.has('create'),
      disabled: false,
    },
    {
      id: 'import',
      title: 'Import Your Model',
      description: 'Load existing 3D models (URDF, STL, OBJ, JT, CATIA)',
      icon: <Upload size={32} />,
      completed: completedActions.has('import'),
      disabled: false,
    },
    {
      id: 'move',
      title: 'Move and Resize Objects',
      description: 'Learn to position and scale your creations',
      icon: <Play size={32} />,
      completed: completedActions.has('move'),
      disabled: !selectedNodeId,
    },
    {
      id: 'color',
      title: 'Change Colors and Organize',
      description: 'Make your scene look great',
      icon: <Palette size={32} />,
      completed: completedActions.has('color'),
      disabled: !selectedNodeId,
    },
    {
      id: 'save',
      title: 'Save Your Work',
      description: 'Keep your progress safe',
      icon: <Save size={32} />,
      completed: completedActions.has('save'),
      disabled: false,
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
              <div className="progress-fill" style={{ width: `${(completedCount / totalActions) * 100}%` }}></div>
            </div>
            <p className="progress-text">{completedCount} of {totalActions} steps completed</p>
          </div>

          {/* Action Cards */}
          <div className="action-cards">
            {actionCards.map((card) => {
              const getCardClickHandler = () => {
                if (card.disabled) return undefined;
                switch (card.id) {
                  case 'import': return handleFileImport;
                  case 'move': return handleEnableTransform;
                  case 'save': return handleSaveWork;
                  default: return undefined;
                }
              };

              return (
                <div
                  key={card.id}
                  className={`action-card ${card.disabled ? 'disabled' : ''} ${
                    card.completed ? 'completed' : ''
                  }`}
                  onClick={getCardClickHandler()}
                  style={!card.disabled && getCardClickHandler() ? { cursor: 'pointer' } : undefined}
                >
                  <div className="card-icon">
                    {card.completed ? <CheckCircle size={32} /> : card.icon}
                  </div>
                  <div className="card-content">
                    <h3>
                      {card.title}
                      {card.completed && ' ✓'}
                    </h3>
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
                    {card.id === 'move' && !card.disabled && (
                      <div className="action-help">
                        <p>✨ Select an object, then click here to enable move/resize mode!</p>
                      </div>
                    )}
                    {card.id === 'save' && !card.disabled && (
                      <div className="action-help">
                        <p>💾 Click to save your world to a file</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
            <button className="control-btn" title="Reset View" onClick={handleResetView}>
              Reset View
            </button>
            <button className="control-btn" title="Zoom to Fit" onClick={handleZoomFit}>
              Zoom Fit
            </button>
          </div>

          {/* Viewport container - SceneCanvas will overlay this */}
          <div id="viewport-essential" className="viewport-canvas"></div>
        </main>

        {/* Right Sidebar - Scene Tree & Kinematics */}
        <aside className="essential-right-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Scene</h3>
            <SceneTree />
          </div>
          <div className="sidebar-section">
            <h3 className="sidebar-title">Kinematics</h3>
            <KinematicsPanel onClose={() => {}} />
          </div>
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
