// Floating Settings Panel - Comprehensive settings management
// Owner: George
// Floating panel with tabs for all application settings

import React, { useState } from 'react';
import { 
  Settings, 
  User, 
  Move, 
  Crosshair, 
  Zap, 
  Eye, 
  Folder,
  Save,
  Palette,
  Grid3X3,
  Camera,
  Target,
  Sliders,
  Database,
  Cloud,
} from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { useEditorStore } from '../store/editorStore';
import { useUserLevel } from '../core/UserLevelContext';
import { AdminPanel } from './Admin/AdminPanel';
import { SkyboxSettingsPanel } from './SkyboxSettingsPanel';
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
  
  // Get settings from store
  const {
    positionIncrement,
    rotationIncrement,
    snapEnabled,
    snapToGrid,
    snapToVertex,
    snapToEdge,
    snapToFace,
    snapToCenter,
    snapToObject,
    snapToMidpoint,
    snapToIntersection,
    snapToPerpendicular,
    snapToTangent,
    snapAlong,
    snapToNormal,
    gridSize,
    snapDistance,
    setPositionIncrement,
    setRotationIncrement,
    setSnapEnabled,
    setSnapToGrid,
    setSnapToVertex,
    setSnapToEdge,
    setSnapToFace,
    setSnapToCenter,
    setSnapToObject,
    setSnapToMidpoint,
    setSnapToIntersection,
    setSnapToPerpendicular,
    setSnapToTangent,
    setSnapAlong,
    setSnapToNormal,
    setGridSize,
    setSnapDistance,
  } = useEditorStore();

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

      <div className="settings-group">
        <h4 className="settings-group-title">
          <Grid3X3 size={16} />
          Grid Settings
        </h4>
        <div className="settings-option">
          <label className="settings-label">Grid size (mm)</label>
          <input
            type="number"
            className="settings-input"
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
            min="1"
            max="10000"
            step="1"
          />
        </div>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input type="checkbox" defaultChecked />
            <span className="checkmark"></span>
            Show grid
          </label>
        </div>
      </div>
    </div>
  );

  // Snap Settings Component
  const SnapSettings = () => (
    <div className="settings-section">
      <div className="settings-group">
        <h4 className="settings-group-title">
          <Crosshair size={16} />
          Snap Configuration
        </h4>
        <div className="settings-option">
          <label className="settings-checkbox">
            <input 
              type="checkbox" 
              checked={snapEnabled}
              onChange={(e) => setSnapEnabled(e.target.checked)}
            />
            <span className="checkmark"></span>
            Enable snapping
          </label>
        </div>
        <div className="settings-option">
          <label className="settings-label">Snap distance (mm)</label>
          <input
            type="number"
            className="settings-input"
            value={snapDistance}
            onChange={(e) => setSnapDistance(Number(e.target.value))}
            min="1"
            max="100"
            step="1"
          />
        </div>
      </div>

      <div className="settings-group">
        <h4 className="settings-group-title">
          <Target size={16} />
          Snap Types
        </h4>
        <div className="settings-grid">
          {[
            { key: 'snapToGrid', label: 'Grid', setter: setSnapToGrid, getter: snapToGrid },
            { key: 'snapToVertex', label: 'Vertex', setter: setSnapToVertex, getter: snapToVertex },
            { key: 'snapToEdge', label: 'Edge', setter: setSnapToEdge, getter: snapToEdge },
            { key: 'snapToFace', label: 'Face', setter: setSnapToFace, getter: snapToFace },
            { key: 'snapToCenter', label: 'Center', setter: setSnapToCenter, getter: snapToCenter },
            { key: 'snapToObject', label: 'Object', setter: setSnapToObject, getter: snapToObject },
            { key: 'snapToMidpoint', label: 'Midpoint', setter: setSnapToMidpoint, getter: snapToMidpoint },
            { key: 'snapToIntersection', label: 'Intersection', setter: setSnapToIntersection, getter: snapToIntersection },
            { key: 'snapToPerpendicular', label: 'Perpendicular', setter: setSnapToPerpendicular, getter: snapToPerpendicular },
            { key: 'snapToTangent', label: 'Tangent', setter: setSnapToTangent, getter: snapToTangent },
            { key: 'snapAlong', label: 'Along', setter: setSnapAlong, getter: snapAlong },
            { key: 'snapToNormal', label: 'Normal', setter: setSnapToNormal, getter: snapToNormal },
          ].map(({ key, label, setter, getter }) => (
            <label key={key} className="settings-checkbox">
              <input 
                type="checkbox" 
                checked={getter}
                onChange={(e) => setter(e.target.checked)}
              />
              <span className="checkmark"></span>
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

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
    { id: 'skybox', label: 'Skybox', icon: <Cloud size={16} />, component: <SkyboxSettingsPanel /> },
    { id: 'transform', label: 'Transform', icon: <Move size={16} />, component: <TransformSettings /> },
    { id: 'snap', label: 'Snap', icon: <Crosshair size={16} />, component: <SnapSettings /> },
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
        <div className="settings-content">
          {tabs.find(tab => tab.id === activeTab)?.component}
        </div>

        {/* Action Buttons */}
        <div className="settings-actions">
          <button className="settings-btn settings-btn-secondary">
            Reset to Defaults
          </button>
          <button className="settings-btn settings-btn-primary">
            Save Settings
          </button>
        </div>
      </div>
    </FloatingPanel>
  );
};
