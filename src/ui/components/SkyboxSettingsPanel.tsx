// Skybox Settings Panel - Controls for skybox configuration
// Owner: Skybox System

import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Cloud, RotateCw, Eye, Zap, Grid3x3, Palette, Sun, Moon, Sunset, Sunrise } from 'lucide-react';
import { SkyboxManager, SkyboxConfig, FloorMaterialType } from '../../scene/services/SkyboxManager';
import { SceneManager } from '../../scene/SceneManager';
import './SkyboxSettingsPanel.css';

interface SkyboxSettingsPanelProps {
  onClose?: () => void;
}

export const SkyboxSettingsPanel: React.FC<SkyboxSettingsPanelProps> = ({ onClose: _onClose }) => {
  const skyboxManager = SkyboxManager.getInstance();
  const [config, setConfig] = useState<SkyboxConfig>(skyboxManager.getConfig());

  useEffect(() => {
    // Skybox is already initialized at startup in SceneManager
    // This component only manages the UI for configuration
    // If skybox wasn't created at startup, create it now (shouldn't happen normally)
    const scene = SceneManager.getInstance().getScene();
    if (scene && config.enabled) {
      skyboxManager.initialize(scene);
      // Only create if not already created (check if skybox exists)
      if (!skyboxManager.isReady()) {
        skyboxManager.createSkybox();
        skyboxManager.createGridFloor().catch(err => console.warn('[SkyboxSettingsPanel] Failed to create floor:', err));
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

        {/* Floor Settings Section */}
        <div className="skybox-settings-divider"></div>
        <div className="skybox-setting-group">
          <label className="skybox-setting-label" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            <Grid3x3 size={18} />
            <span>Floor Settings</span>
          </label>
        </div>

        {/* Enable Floor Toggle */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Eye size={16} />
            <span>Enable Floor</span>
          </label>
          <label className="skybox-toggle">
            <input
              type="checkbox"
              checked={config.floor.enabled}
              onChange={(e) => updateConfig({ floor: { ...config.floor, enabled: e.target.checked } })}
            />
            <span className="skybox-toggle-slider"></span>
          </label>
        </div>

        {/* Floor Material Type */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Palette size={16} />
            <span>Floor Material</span>
          </label>
          <select
            value={config.floor.materialType}
            onChange={(e) => {
              const newMaterialType = e.target.value as FloorMaterialType;
              if (config.floor.materialType !== newMaterialType) {
                console.log(`[SkyboxSettingsPanel] Material type changed: ${config.floor.materialType} -> ${newMaterialType}`);
                updateConfig({ floor: { ...config.floor, materialType: newMaterialType } });
              }
            }}
            className="skybox-select"
            disabled={!config.enabled || !config.floor.enabled}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'rgba(30, 30, 35, 0.95)',
              border: '1px solid rgba(80, 80, 85, 0.8)',
              borderRadius: '4px',
              color: '#e0e0e0',
              fontSize: '13px',
              cursor: config.enabled && config.floor.enabled ? 'pointer' : 'not-allowed',
            }}
          >
            <option value="grid">Grid (Default)</option>
            <option value="stone">Stone</option>
            <option value="concrete">Concrete</option>
            <option value="epoxy">Epoxy</option>
          </select>
        </div>

        {/* Floor Size */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Grid3x3 size={16} />
            <span>Floor Size</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: config.enabled && config.floor.enabled ? 'pointer' : 'not-allowed' }}>
              <input
                type="radio"
                name="floorSize"
                checked={config.floor.size === 'infinite'}
                onChange={() => updateConfig({ floor: { ...config.floor, size: 'infinite' } })}
                disabled={!config.enabled || !config.floor.enabled}
              />
              <span>Infinite</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: config.enabled && config.floor.enabled ? 'pointer' : 'not-allowed' }}>
              <input
                type="radio"
                name="floorSize"
                checked={typeof config.floor.size === 'number'}
                onChange={() => {
                  // Preserve current size if it's a number, otherwise default to 1000
                  const newSize = typeof config.floor.size === 'number' ? config.floor.size : 1000;
                  updateConfig({ floor: { ...config.floor, size: newSize } });
                }}
                disabled={!config.enabled || !config.floor.enabled}
              />
              <span>Fixed:</span>
              <input
                type="number"
                min="100"
                max="1000000"
                step="100"
                value={typeof config.floor.size === 'number' ? config.floor.size : 1000}
                onChange={(e) => {
                  const newSize = parseFloat(e.target.value);
                  if (!isNaN(newSize) && newSize >= 100) {
                    updateConfig({ floor: { ...config.floor, size: newSize } });
                  }
                }}
                onBlur={(e) => {
                  const newSize = parseFloat(e.target.value);
                  if (isNaN(newSize) || newSize < 100) {
                    // Reset to valid value if invalid
                    updateConfig({ floor: { ...config.floor, size: 1000 } });
                  }
                }}
                disabled={!config.enabled || !config.floor.enabled || config.floor.size === 'infinite'}
                style={{
                  width: '80px',
                  padding: '4px 6px',
                  background: 'rgba(30, 30, 35, 0.95)',
                  border: '1px solid rgba(80, 80, 85, 0.8)',
                  borderRadius: '3px',
                  color: '#e0e0e0',
                  fontSize: '12px',
                }}
              />
            </label>
          </div>
        </div>

        {/* Grid Settings (only show for grid material type) */}
        {config.floor.materialType === 'grid' && (
          <>
            {/* Major Unit Frequency */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Grid3x3 size={16} />
            <span>Major Grid Spacing</span>
            <span className="skybox-setting-value">{config.floor.majorUnitFrequency}</span>
          </label>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={config.floor.majorUnitFrequency}
            onChange={(e) => updateConfig({ floor: { ...config.floor, majorUnitFrequency: parseInt(e.target.value) } })}
            className="skybox-slider"
            disabled={!config.enabled || !config.floor.enabled}
          />
        </div>

        {/* Minor Unit Visibility */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Grid3x3 size={16} />
            <span>Minor Grid Visibility</span>
            <span className="skybox-setting-value">{config.floor.minorUnitVisibility.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.floor.minorUnitVisibility}
            onChange={(e) => updateConfig({ floor: { ...config.floor, minorUnitVisibility: parseFloat(e.target.value) } })}
            className="skybox-slider"
            disabled={!config.enabled || !config.floor.enabled}
          />
        </div>

        {/* Grid Ratio */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Grid3x3 size={16} />
            <span>Grid Ratio</span>
            <span className="skybox-setting-value">{config.floor.gridRatio.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={config.floor.gridRatio}
            onChange={(e) => updateConfig({ floor: { ...config.floor, gridRatio: parseFloat(e.target.value) } })}
            className="skybox-slider"
            disabled={!config.enabled || !config.floor.enabled}
          />
        </div>

        {/* Floor Opacity */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Eye size={16} />
            <span>Grid Opacity</span>
            <span className="skybox-setting-value">{config.floor.opacity.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.floor.opacity}
            onChange={(e) => updateConfig({ floor: { ...config.floor, opacity: parseFloat(e.target.value) } })}
            className="skybox-slider"
            disabled={!config.enabled || !config.floor.enabled}
          />
        </div>

        {/* Main Color (RGB) */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Palette size={16} />
            <span>Grid Main Color</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.floor.mainColor[0]}
              onChange={(e) => updateConfig({ floor: { ...config.floor, mainColor: [parseFloat(e.target.value), config.floor.mainColor[1], config.floor.mainColor[2]] } })}
              className="skybox-slider"
              style={{ flex: 1 }}
              disabled={!config.enabled || !config.floor.enabled}
              title="Red"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.floor.mainColor[1]}
              onChange={(e) => updateConfig({ floor: { ...config.floor, mainColor: [config.floor.mainColor[0], parseFloat(e.target.value), config.floor.mainColor[2]] } })}
              className="skybox-slider"
              style={{ flex: 1 }}
              disabled={!config.enabled || !config.floor.enabled}
              title="Green"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.floor.mainColor[2]}
              onChange={(e) => updateConfig({ floor: { ...config.floor, mainColor: [config.floor.mainColor[0], config.floor.mainColor[1], parseFloat(e.target.value)] } })}
              className="skybox-slider"
              style={{ flex: 1 }}
              disabled={!config.enabled || !config.floor.enabled}
              title="Blue"
            />
            <div
              style={{
                width: '30px',
                height: '20px',
                backgroundColor: `rgb(${Math.round(config.floor.mainColor[0] * 255)}, ${Math.round(config.floor.mainColor[1] * 255)}, ${Math.round(config.floor.mainColor[2] * 255)})`,
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '3px'
              }}
            />
          </div>
        </div>

        {/* Line Color (RGB) */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Palette size={16} />
            <span>Major Line Color</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.floor.lineColor[0]}
              onChange={(e) => updateConfig({ floor: { ...config.floor, lineColor: [parseFloat(e.target.value), config.floor.lineColor[1], config.floor.lineColor[2]] } })}
              className="skybox-slider"
              style={{ flex: 1 }}
              disabled={!config.enabled || !config.floor.enabled}
              title="Red"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.floor.lineColor[1]}
              onChange={(e) => updateConfig({ floor: { ...config.floor, lineColor: [config.floor.lineColor[0], parseFloat(e.target.value), config.floor.lineColor[2]] } })}
              className="skybox-slider"
              style={{ flex: 1 }}
              disabled={!config.enabled || !config.floor.enabled}
              title="Green"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.floor.lineColor[2]}
              onChange={(e) => updateConfig({ floor: { ...config.floor, lineColor: [config.floor.lineColor[0], config.floor.lineColor[1], parseFloat(e.target.value)] } })}
              className="skybox-slider"
              style={{ flex: 1 }}
              disabled={!config.enabled || !config.floor.enabled}
              title="Blue"
            />
            <div
              style={{
                width: '30px',
                height: '20px',
                backgroundColor: `rgb(${Math.round(config.floor.lineColor[0] * 255)}, ${Math.round(config.floor.lineColor[1] * 255)}, ${Math.round(config.floor.lineColor[2] * 255)})`,
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '3px'
              }}
            />
          </div>
        </div>
          </>
        )}

        {/* Triplanar PBR Settings (only show for material types) */}
        {config.floor.materialType !== 'grid' && config.floor.triplanar && (
          <>
            <div className="skybox-settings-divider"></div>
            <div className="skybox-setting-group">
              <label className="skybox-setting-label" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                <Palette size={18} />
                <span>Triplanar PBR Settings</span>
              </label>
            </div>

            {/* Macro Scale */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3x3 size={16} />
                <span>Macro Scale (m)</span>
                <span className="skybox-setting-value">{config.floor.triplanar.macroScale.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="4"
                max="20"
                step="0.5"
                value={config.floor.triplanar.macroScale}
                onChange={(e) => updateConfig({ floor: { ...config.floor, triplanar: { ...config.floor.triplanar!, macroScale: parseFloat(e.target.value) } } })}
                className="skybox-slider"
                disabled={!config.enabled || !config.floor.enabled}
              />
            </div>

            {/* Micro Scale */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3x3 size={16} />
                <span>Micro Scale</span>
                <span className="skybox-setting-value">{config.floor.triplanar.microScale.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="30"
                max="80"
                step="1"
                value={config.floor.triplanar.microScale}
                onChange={(e) => updateConfig({ floor: { ...config.floor, triplanar: { ...config.floor.triplanar!, microScale: parseFloat(e.target.value) } } })}
                className="skybox-slider"
                disabled={!config.enabled || !config.floor.enabled}
              />
            </div>

            {/* Noise Scale */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3x3 size={16} />
                <span>Noise Scale (m)</span>
                <span className="skybox-setting-value">{config.floor.triplanar.noiseScale.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="8"
                max="20"
                step="0.5"
                value={config.floor.triplanar.noiseScale}
                onChange={(e) => updateConfig({ floor: { ...config.floor, triplanar: { ...config.floor.triplanar!, noiseScale: parseFloat(e.target.value) } } })}
                className="skybox-slider"
                disabled={!config.enabled || !config.floor.enabled}
              />
            </div>

            {/* Anti-Tiling Strength */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3x3 size={16} />
                <span>Anti-Tiling Strength</span>
                <span className="skybox-setting-value">{config.floor.triplanar.noiseStrength.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.floor.triplanar.noiseStrength}
                onChange={(e) => updateConfig({ floor: { ...config.floor, triplanar: { ...config.floor.triplanar!, noiseStrength: parseFloat(e.target.value) } } })}
                className="skybox-slider"
                disabled={!config.enabled || !config.floor.enabled}
              />
            </div>

            {/* Roughness Bias */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Zap size={16} />
                <span>Roughness Bias</span>
                <span className="skybox-setting-value">{config.floor.triplanar.roughnessBias.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="-0.3"
                max="0.3"
                step="0.01"
                value={config.floor.triplanar.roughnessBias}
                onChange={(e) => updateConfig({ floor: { ...config.floor, triplanar: { ...config.floor.triplanar!, roughnessBias: parseFloat(e.target.value) } } })}
                className="skybox-slider"
                disabled={!config.enabled || !config.floor.enabled}
              />
            </div>

            {/* AO Weight */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Eye size={16} />
                <span>AO Weight</span>
                <span className="skybox-setting-value">{config.floor.triplanar.aoWeight.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.floor.triplanar.aoWeight}
                onChange={(e) => updateConfig({ floor: { ...config.floor, triplanar: { ...config.floor.triplanar!, aoWeight: parseFloat(e.target.value) } } })}
                className="skybox-slider"
                disabled={!config.enabled || !config.floor.enabled}
              />
            </div>

            {/* Metallic */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Zap size={16} />
                <span>Metallic</span>
                <span className="skybox-setting-value">{config.floor.triplanar.metallic.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="0.2"
                step="0.01"
                value={config.floor.triplanar.metallic}
                onChange={(e) => updateConfig({ floor: { ...config.floor, triplanar: { ...config.floor.triplanar!, metallic: parseFloat(e.target.value) } } })}
                className="skybox-slider"
                disabled={!config.enabled || !config.floor.enabled}
              />
            </div>

            {/* Normal Strength */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3x3 size={16} />
                <span>Normal Strength</span>
                <span className="skybox-setting-value">{config.floor.triplanar.normalStrength.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={config.floor.triplanar.normalStrength}
                onChange={(e) => updateConfig({ floor: { ...config.floor, triplanar: { ...config.floor.triplanar!, normalStrength: parseFloat(e.target.value) } } })}
                className="skybox-slider"
                disabled={!config.enabled || !config.floor.enabled}
              />
            </div>

            {/* Micro Normal Strength */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3x3 size={16} />
                <span>Micro Normal Strength</span>
                <span className="skybox-setting-value">{config.floor.triplanar.microNormalStrength.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.2"
                step="0.1"
                value={config.floor.triplanar.microNormalStrength}
                onChange={(e) => updateConfig({ floor: { ...config.floor, triplanar: { ...config.floor.triplanar!, microNormalStrength: parseFloat(e.target.value) } } })}
                className="skybox-slider"
                disabled={!config.enabled || !config.floor.enabled}
              />
            </div>
          </>
        )}

        {/* Info Text */}
        <div className="skybox-info">
          <p>Skybox provides a cloudy blue sky environment with a configurable floor. Choose grid for spatial reference, or material types (stone, concrete, epoxy) for realistic triplanar PBR surfaces.</p>
        </div>
      </div>
    </div>
  );
};

