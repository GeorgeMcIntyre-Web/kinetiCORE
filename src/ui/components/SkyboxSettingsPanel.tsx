// Skybox Settings Panel - Controls for skybox configuration
// Owner: Skybox System

import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Cloud, RotateCw, Eye, Zap, Sun, Moon, Sunset, Sunrise } from 'lucide-react';
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
    let canceled = false;

    const attachScene = () => {
      const scene = SceneManager.getInstance().getScene();
      if (!scene) {
        if (!canceled) {
          setTimeout(attachScene, 250);
        }
        return;
      }

      skyboxManager.initialize(scene);

      if (config.enabled && !skyboxManager.isReady()) {
        skyboxManager.createSkybox();
        skyboxManager.createGridFloor().catch(err =>
          console.warn('[SkyboxSettingsPanel] Failed to create floor:', err)
        );
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        SceneManager.getInstance().setBackgroundTransparent(true);
      }
    };

    attachScene();
    return () => {
      canceled = true;
    };
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

        {/* Sky Preset Selection */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Sun size={16} />
            <span>Sky Preset</span>
          </label>
          <div className="skybox-preset-buttons">
            <button
              className={`skybox-preset-btn ${config.skyPreset === 'day' ? 'active' : ''}`}
              onClick={() => updateConfig({ skyPreset: 'day' })}
              disabled={!config.enabled}
              title="Day - Bright blue sky with clouds"
            >
              <Sun size={16} />
              <span>Day</span>
            </button>
            <button
              className={`skybox-preset-btn ${config.skyPreset === 'night' ? 'active' : ''}`}
              onClick={() => updateConfig({ skyPreset: 'night' })}
              disabled={!config.enabled}
              title="Night - Dark sky with stars"
            >
              <Moon size={16} />
              <span>Night</span>
            </button>
            <button
              className={`skybox-preset-btn ${config.skyPreset === 'sunset' ? 'active' : ''}`}
              onClick={() => updateConfig({ skyPreset: 'sunset' })}
              disabled={!config.enabled}
              title="Sunset - Orange, pink, and purple gradient"
            >
              <Sunset size={16} />
              <span>Sunset</span>
            </button>
            <button
              className={`skybox-preset-btn ${config.skyPreset === 'sunrise' ? 'active' : ''}`}
              onClick={() => updateConfig({ skyPreset: 'sunrise' })}
              disabled={!config.enabled}
              title="Sunrise - Soft pink, yellow, and light blue"
            >
              <Sunrise size={16} />
              <span>Sunrise</span>
            </button>
          </div>
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

        {/* Texture Scale Slider */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Cloud size={16} />
            <span>Texture Scale</span>
            <span className="skybox-setting-value">{config.textureScale.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={config.textureScale}
            onChange={(e) => updateConfig({ textureScale: parseFloat(e.target.value) })}
            className="skybox-slider"
            disabled={!config.enabled}
          />
        </div>

        {/* Info Text */}
        <div className="skybox-info">
          <p>
            Skybox provides a cloudy blue sky environment with configurable presets, intensity,
            rotation, blur, and texture scale. Use these controls to match the lighting mood to your scene.
          </p>
        </div>
      </div>
    </div>
  );
};


