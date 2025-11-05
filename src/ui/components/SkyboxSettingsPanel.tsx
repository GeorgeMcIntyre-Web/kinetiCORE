// Skybox Settings Panel - Controls for skybox configuration
// Owner: Skybox System

import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Cloud, RotateCw, Eye, Zap } from 'lucide-react';
import { SkyboxManager, SkyboxConfig } from '../../scene/services/SkyboxManager';
import { SceneManager } from '../../scene/SceneManager';
import './SkyboxSettingsPanel.css';

interface SkyboxSettingsPanelProps {
  onClose?: () => void;
}

export const SkyboxSettingsPanel: React.FC<SkyboxSettingsPanelProps> = ({ onClose: _onClose }) => {
  const skyboxManager = SkyboxManager.getInstance();
  const [config, setConfig] = useState<SkyboxConfig>(skyboxManager.getConfig());

  useEffect(() => {
    // Initialize skybox when component mounts
    const scene = SceneManager.getInstance().getScene();
    if (scene) {
      skyboxManager.initialize(scene);
      // Always create skybox and grid floor on mount (they're enabled by default)
      if (config.enabled) {
        skyboxManager.createSkybox();
        skyboxManager.createGridFloor();
        // Ensure scene background is transparent for skybox visibility
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        SceneManager.getInstance().setBackgroundTransparent(true);
      }
    }
  }, []);

  const updateConfig = (updates: Partial<SkyboxConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    skyboxManager.updateConfig(updates);
  };

  return (
    <div className="skybox-settings-panel">
      <div className="skybox-settings-header">
        <Cloud size={20} />
        <h3>Skybox Settings</h3>
      </div>

      <div className="skybox-settings-content">
        {/* Enable/Disable Toggle */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Eye size={16} />
            <span>Enable Skybox</span>
          </label>
          <label className="skybox-toggle">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => updateConfig({ enabled: e.target.checked })}
            />
            <span className="skybox-toggle-slider"></span>
          </label>
        </div>

        {/* Intensity Slider */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Zap size={16} />
            <span>Intensity</span>
            <span className="skybox-setting-value">{config.intensity.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.intensity}
            onChange={(e) => updateConfig({ intensity: parseFloat(e.target.value) })}
            className="skybox-slider"
            disabled={!config.enabled}
          />
        </div>

        {/* Rotation Slider */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <RotateCw size={16} />
            <span>Rotation</span>
            <span className="skybox-setting-value">{config.rotation.toFixed(0)}°</span>
          </label>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={config.rotation}
            onChange={(e) => updateConfig({ rotation: parseFloat(e.target.value) })}
            className="skybox-slider"
            disabled={!config.enabled}
          />
        </div>

        {/* Blur Slider */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Cloud size={16} />
            <span>Blur</span>
            <span className="skybox-setting-value">{config.blur.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.blur}
            onChange={(e) => updateConfig({ blur: parseFloat(e.target.value) })}
            className="skybox-slider"
            disabled={!config.enabled}
          />
        </div>

        {/* Info Text */}
        <div className="skybox-info">
          <p>Skybox provides a cloudy blue sky environment with a standard grid floor that extends to the horizon.</p>
        </div>
      </div>
    </div>
  );
};

