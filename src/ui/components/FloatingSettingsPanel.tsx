// Floating Settings Panel - Comprehensive settings management
// Owner: George
// Floating panel with tabs for all application settings

import React, { useState } from 'react';
import {
  Settings,
  User,
  Move,
  Zap,
  Eye,
  Folder,
  Save,
  Palette,
  Grid3X3,
  Camera,
  Sliders,
  Database,
  HelpCircle,
  Book,
  ExternalLink,
} from 'lucide-react';
import { toast } from './ToastNotifications';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { useEditorStore } from '../store/editorStore';
import { useUserLevel } from '../core/UserLevelContext';
import { AdminPanel } from './Admin/AdminPanel';
import { FloorSettingsPanel } from './FloorSettingsPanel';
import { SceneManager } from '../../scene/SceneManager';
import './FloatingSettingsPanel.css';

interface FloatingSettingsPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
  zIndex?: number;
}

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

export const FloatingSettingsPanel: React.FC<FloatingSettingsPanelProps> = ({
  onClose,
  isVisible = true,
  zIndex = 1004,
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const { userLevel, setUserLevel } = useUserLevel();
  const sceneManager = SceneManager.getInstance();
  const colorToHex = (color: { r: number; g: number; b: number }) =>
    `#${[color.r, color.g, color.b]
      .map((component) => {
        const v = Math.round(component * 255);
        return v.toString(16).padStart(2, '0');
      })
      .join('')}`;
  const hexToColor = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
    a: 1,
  });
  const DEFAULT_BACKGROUND_HEX = '#FFFFFF';
  const [backgroundColorHex, setBackgroundColorHex] = useState<string>(() =>
    colorToHex(sceneManager.getBackgroundColor())
  );
  
  // Get settings from store (only the ones we actually use)
  const {
    positionIncrement,
    rotationIncrement,
    setPositionIncrement,
    setRotationIncrement,
  } = useEditorStore();

  const handleBackgroundColorChange = (hex: string) => {
    setBackgroundColorHex(hex);
    const color = hexToColor(hex);
    sceneManager.setBackgroundColor(color);
  };

  // General Settings Component
  const GeneralSettings = () => (
    <div className="settings-section">
      <div className="settings-grid">
        <div className="settings-compact-group">
          <h4 className="settings-group-title">
            <User size={16} />
            User Experience Level
          </h4>
          <div className="settings-option">
            <label className="settings-label">Interface Mode</label>
            <div className="settings-radio-group">
              {[
                { value: 'essential', label: 'Essential', description: 'Simplified interface for beginners' },
                { value: 'professional', label: 'Professional', description: 'Full feature set for engineers' },
                { value: 'expert', label: 'Expert', description: 'Advanced features for power users' }
              ].map(({ value, label, description }) => (
                <label key={value} className="settings-radio-option">
                  <input
                    type="radio"
                    name="userLevel"
                    value={value}
                    checked={userLevel === value}
                    onChange={() => setUserLevel(value as any)}
                  />
                  <div className="radio-content">
                    <span className="radio-label">{label}</span>
                    <span className="radio-description">{description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-compact-group">
          <h4 className="settings-group-title">
            <Palette size={16} />
            Appearance
          </h4>
          <div className="settings-compact-option">
            <label className="settings-compact-label">Theme</label>
            <select className="settings-select settings-compact-control" defaultValue="dark">
              <option value="dark">Dark Theme</option>
              <option value="light">Light Theme</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>
          <div className="settings-compact-option">
            <label className="settings-compact-label">Viewport Background</label>
            <div className="settings-color-row">
              <input
                type="color"
                value={backgroundColorHex}
                onChange={(e) => handleBackgroundColorChange(e.target.value)}
                className="settings-color-input"
                aria-label="Viewport background color"
              />
              <button
                type="button"
                className="settings-btn settings-btn-secondary settings-color-reset"
                onClick={() => handleBackgroundColorChange(DEFAULT_BACKGROUND_HEX)}
              >
                Reset
              </button>
            </div>
            <p className="settings-hint">Applies instantly to the 3D viewport.</p>
          </div>
          <div className="settings-compact-option">
            <label className="settings-compact-label">Language</label>
            <select className="settings-select settings-compact-control" defaultValue="en">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="zh">中文</option>
            </select>
          </div>
        </div>
        <div className="settings-compact-group">
          <h4 className="settings-group-title">
            <HelpCircle size={16} />
            Help & Documentation
          </h4>
          <div className="help-card">
            <div className="help-card-header">
              <Book size={18} />
              <div className="help-card-text">
                <div className="help-card-title">Explore the docs</div>
                <div className="help-card-subtitle">Guides, tutorials, and API references</div>
              </div>
            </div>
            <div className="help-card-actions">
              <button
                className="settings-btn settings-btn-primary help-card-btn"
                onClick={() => {
                  try {
                    window.open('https://docs.kineticore.app', '_blank', 'noopener,noreferrer');
                  } catch {
                    toast.info('Help documentation coming soon');
                  }
                }}
                title="Open Documentation"
              >
                Open Docs
                <ExternalLink size={14} style={{ marginLeft: 8 }} />
              </button>
              <button
                className="settings-btn settings-btn-secondary help-card-btn"
                onClick={() => toast.info('Keyboard shortcuts coming soon')}
                title="View Keyboard Shortcuts"
              >
                Shortcuts
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h4 className="settings-group-title">
          <Save size={16} />
          Auto-Save
        </h4>
        <div className="settings-compact-option">
          <label className="settings-checkbox">
            <input type="checkbox" defaultChecked />
            <span className="checkmark"></span>
            Enable auto-save
          </label>
        </div>
        <div className="settings-compact-option">
          <label className="settings-compact-label">Auto-save interval</label>
          <select className="settings-select settings-compact-control" defaultValue="5">
            <option value="1">Every 1 minute</option>
            <option value="5">Every 5 minutes</option>
            <option value="10">Every 10 minutes</option>
            <option value="30">Every 30 minutes</option>
          </select>
        </div>
      </div>
    </div>
  );

  // Transform Settings Component
  const TransformSettings = () => (
    <div className="settings-section">
      <div className="settings-group">
        <h4 className="settings-group-title">
          <Move size={16} />
          Transform Increments
        </h4>
        <div className="settings-option">
          <label className="settings-label">Position increment (mm)</label>
          <input
            type="number"
            className="settings-input"
            value={positionIncrement}
            onChange={(e) => setPositionIncrement(Number(e.target.value))}
            min="1"
            max="1000"
            step="1"
          />
        </div>
        <div className="settings-option">
          <label className="settings-label">Rotation increment (degrees)</label>
          <input
            type="number"
            className="settings-input"
            value={rotationIncrement}
            onChange={(e) => setRotationIncrement(Number(e.target.value))}
            min="1"
            max="180"
            step="1"
          />
        </div>
      </div>

    </div>
  );

  // Snap Settings Component
  
  // Physics Settings Component
  const PhysicsSettings = () => (
    <div className="settings-section">
      <div className="settings-group">
        <h4 className="settings-group-title">
          <Zap size={16} />
          Physics Engine
        </h4>
        <div className="settings-option">
          <label className="settings-label">Physics Engine</label>
          <select className="settings-select" defaultValue="rapier">
            <option value="rapier">Rapier (Recommended)</option>
            <option value="havok">Havok (Advanced)</option>
          </select>
        </div>
        <div className="settings-option">
          <label className="settings-label">Gravity (m/s²)</label>
          <div className="settings-input-group">
            <input type="number" className="settings-input" defaultValue="0" placeholder="X" />
            <input type="number" className="settings-input" defaultValue="-9.81" placeholder="Y" />
            <input type="number" className="settings-input" defaultValue="0" placeholder="Z" />
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h4 className="settings-group-title">
          <Sliders size={16} />
          Simulation Parameters
        </h4>
        <div className="settings-option">
          <label className="settings-label">Iterations per frame</label>
          <input type="number" className="settings-input" defaultValue="10" min="1" max="50" />
        </div>
        <div className="settings-option">
          <label className="settings-label">Time step (ms)</label>
          <input type="number" className="settings-input" defaultValue="16" min="1" max="100" />
        </div>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" defaultChecked />
            <span className="checkmark"></span>
            Enable sleeping bodies
          </label>
        </div>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" defaultChecked />
            <span className="checkmark"></span>
            Continuous collision detection
          </label>
        </div>
      </div>
    </div>
  );

  // View Settings Component
  const ViewSettings = () => (
    <div className="settings-section">
      <div className="settings-group">
        <h4 className="settings-group-title">
          <Camera size={16} />
          Camera Settings
        </h4>
        <div className="settings-option">
          <label className="settings-label">Default camera speed</label>
          <input type="range" className="settings-range" defaultValue="1" min="0.1" max="5" step="0.1" />
        </div>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" defaultChecked />
            <span className="checkmark"></span>
            Invert mouse Y-axis
          </label>
        </div>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" />
            <span className="checkmark"></span>
            Smooth camera transitions
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h4 className="settings-group-title">
          <Eye size={16} />
          Viewport Display
        </h4>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" defaultChecked />
            <span className="checkmark"></span>
            Show coordinate frame
          </label>
        </div>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" defaultChecked />
            <span className="checkmark"></span>
            Show selection outlines
          </label>
        </div>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" />
            <span className="checkmark"></span>
            Show wireframes
          </label>
        </div>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" />
            <span className="checkmark"></span>
            Show bounding boxes
          </label>
        </div>
      </div>
    </div>
  );

  // Project Settings Component
  const ProjectSettings = () => (
    <div className="settings-section">
      <div className="settings-group">
        <h4 className="settings-group-title">
          <Folder size={16} />
          Default Project Settings
        </h4>
        <div className="settings-option">
          <label className="settings-label">Default project template</label>
          <select className="settings-select" defaultValue="blank">
            <option value="blank">Blank Project</option>
            <option value="industrial">Industrial Template</option>
            <option value="robotics">Robotics Template</option>
            <option value="manufacturing">Manufacturing Template</option>
          </select>
        </div>
        <div className="settings-option">
          <label className="settings-label">Units</label>
          <select className="settings-select" defaultValue="mm">
            <option value="mm">Millimeters</option>
            <option value="cm">Centimeters</option>
            <option value="m">Meters</option>
            <option value="in">Inches</option>
            <option value="ft">Feet</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h4 className="settings-group-title">
          <Save size={16} />
          Export Settings
        </h4>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" defaultChecked />
            <span className="checkmark"></span>
            Include metadata in exports
          </label>
        </div>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" />
            <span className="checkmark"></span>
            Compress exported files
          </label>
        </div>
        <div className="settings-option">
          <label className="settings-label">Default export format</label>
          <select className="settings-select" defaultValue="gltf">
            <option value="gltf">GLTF</option>
            <option value="glb">GLB</option>
            <option value="obj">OBJ</option>
            <option value="stl">STL</option>
            <option value="usd">USD</option>
          </select>
        </div>
      </div>
    </div>
  );

  const tabs: SettingsTab[] = [
    { id: 'general', label: 'General', icon: <User size={16} />, component: <GeneralSettings /> },
    { id: 'floor', label: 'Floor', icon: <Grid3X3 size={16} />, component: <FloorSettingsPanel /> },
    { id: 'transform', label: 'Transform', icon: <Move size={16} />, component: <TransformSettings /> },
    { id: 'physics', label: 'Physics', icon: <Zap size={16} />, component: <PhysicsSettings /> },
    { id: 'view', label: 'View', icon: <Eye size={16} />, component: <ViewSettings /> },
    { id: 'project', label: 'Project', icon: <Folder size={16} />, component: <ProjectSettings /> },
    { id: 'admin', label: 'Asset Admin', icon: <Database size={16} />, component: <AdminPanel /> },
  ];

  return (
    <FloatingPanel
      title="Settings"
      icon={<Settings size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 800, height: 700 }}
      minWidth={600}
      minHeight={500}
      maxWidth={1200}
      maxHeight={900}
      className="floating-settings-panel"
    >
      <div className="settings-panel-content">
        {/* Tab Navigation */}
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div
          className={`settings-content ${activeTab === 'general' ? 'general-active' : ''} ${
            activeTab === 'floor' ? 'floor-active' : ''
          } ${activeTab === 'transform' ? 'transform-active' : ''} ${
            activeTab === 'physics' ? 'physics-active' : ''
          } ${activeTab === 'view' ? 'view-active' : ''} ${
            activeTab === 'project' ? 'project-active' : ''
          } ${activeTab === 'admin' ? 'admin-active' : ''}`}
        >
          {tabs.find(tab => tab.id === activeTab)?.component}
        </div>

        {/* Action Buttons */}
        <div className="settings-actions">
          <button
            className="settings-btn settings-btn-secondary"
            onClick={() => {
              console.log('[Settings] Reset to defaults - snap settings handled via Snap Setup button');
            }}
          >
            Reset to Defaults
          </button>
          <button
            className="settings-btn settings-btn-primary"
            onClick={() => {
              // Settings are automatically saved via Zustand store
              // Just close the panel
              if (onClose) {
                onClose();
              }
              console.log('[Settings] Saved and closed');
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </FloatingPanel>
  );
};
