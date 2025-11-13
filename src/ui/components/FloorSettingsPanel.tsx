// Floor Settings Panel - Controls floor material and grid independent of skybox
// Owner: Skybox System

import React, { useEffect, useState } from 'react';
import { Eye, Grid3X3, Palette } from 'lucide-react';
import {
  SkyboxManager,
  FloorConfig,
  FloorMaterialType,
} from '../../scene/services/SkyboxManager';
import { SceneManager } from '../../scene/SceneManager';
import './SkyboxSettingsPanel.css';

export const FloorSettingsPanel: React.FC = () => {
  const skyboxManager = SkyboxManager.getInstance();
  const [floorConfig, setFloorConfig] = useState<FloorConfig>(
    skyboxManager.getFloorConfig()
  );

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
    };

    attachScene();
    return () => {
      canceled = true;
    };
  }, [skyboxManager]);

  const updateFloorConfig = (updates: Partial<FloorConfig>) => {
    const next = { ...floorConfig, ...updates };
    setFloorConfig(next);
    skyboxManager.updateFloorConfig(updates);
  };

  const updateTriplanar = (updates: Partial<NonNullable<FloorConfig['triplanar']>>) => {
    if (!floorConfig.triplanar) return;
    const nextTriplanar = { ...floorConfig.triplanar, ...updates };
    updateFloorConfig({ triplanar: nextTriplanar });
  };

  const isGridFloorActive =
    floorConfig.enabled && floorConfig.materialType === 'grid';
  const gridControlsDisabled = !isGridFloorActive;

  const fixedSizeValue =
    typeof floorConfig.size === 'number' ? floorConfig.size : 1000;

  return (
    <div className="skybox-settings-panel">
      <div className="skybox-settings-header">
        <Grid3X3 size={20} />
        <h3>Floor Settings</h3>
      </div>

      <div className="skybox-settings-content">
        {/* Enable Floor Toggle */}
        <div className="skybox-setting-group">
          <label className="skybox-setting-label">
            <Eye size={16} />
            <span>Enable Floor</span>
          </label>
          <label className="skybox-toggle">
            <input
              type="checkbox"
              checked={floorConfig.enabled}
              onChange={(e) => updateFloorConfig({ enabled: e.target.checked })}
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
            value={floorConfig.materialType}
            onChange={(e) => {
              const newMaterialType = e.target.value as FloorMaterialType;
              if (floorConfig.materialType !== newMaterialType) {
                updateFloorConfig({ materialType: newMaterialType });
              }
            }}
            className="skybox-select"
            disabled={!floorConfig.enabled}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'rgba(30, 30, 35, 0.95)',
              border: '1px solid rgba(80, 80, 85, 0.8)',
              borderRadius: '4px',
              color: '#e0e0e0',
              fontSize: '13px',
              cursor: floorConfig.enabled ? 'pointer' : 'not-allowed',
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
            <Grid3X3 size={16} />
            <span>Floor Size</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: floorConfig.enabled ? 'pointer' : 'not-allowed',
              }}
            >
              <input
                type="radio"
                name="floorSize"
                checked={floorConfig.size === 'infinite'}
                onChange={() => updateFloorConfig({ size: 'infinite' })}
                disabled={!floorConfig.enabled}
              />
              <span>Infinite</span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: floorConfig.enabled ? 'pointer' : 'not-allowed',
              }}
            >
              <input
                type="radio"
                name="floorSize"
                checked={typeof floorConfig.size === 'number'}
                onChange={() =>
                  updateFloorConfig({
                    size: typeof floorConfig.size === 'number' ? floorConfig.size : 1000,
                  })
                }
                disabled={!floorConfig.enabled}
              />
              <span>Fixed:</span>
              <input
                type="number"
                min="100"
                max="1000000"
                step="100"
                value={fixedSizeValue}
                onChange={(e) => {
                  const newSize = parseFloat(e.target.value);
                  if (!isNaN(newSize) && newSize >= 100) {
                    updateFloorConfig({ size: newSize });
                  }
                }}
                onBlur={(e) => {
                  const newSize = parseFloat(e.target.value);
                  if (isNaN(newSize) || newSize < 100) {
                    updateFloorConfig({ size: 1000 });
                  }
                }}
                disabled={!floorConfig.enabled || floorConfig.size === 'infinite'}
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

        {/* Grid Settings */}
        {floorConfig.materialType === 'grid' && (
          <>
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3X3 size={16} />
                <span>Major Grid Spacing</span>
                <span className="skybox-setting-value">{floorConfig.majorUnitFrequency}</span>
              </label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={floorConfig.majorUnitFrequency}
                onChange={(e) =>
                  updateFloorConfig({ majorUnitFrequency: parseInt(e.target.value, 10) })
                }
                className="skybox-slider"
                disabled={gridControlsDisabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3X3 size={16} />
                <span>Minor Grid Visibility</span>
                <span className="skybox-setting-value">
                  {floorConfig.minorUnitVisibility.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={floorConfig.minorUnitVisibility}
                onChange={(e) =>
                  updateFloorConfig({ minorUnitVisibility: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={gridControlsDisabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3X3 size={16} />
                <span>Grid Ratio</span>
                <span className="skybox-setting-value">
                  {floorConfig.gridRatio.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={floorConfig.gridRatio}
                onChange={(e) =>
                  updateFloorConfig({ gridRatio: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={gridControlsDisabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Eye size={16} />
                <span>Grid Opacity</span>
                <span className="skybox-setting-value">{floorConfig.opacity.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={floorConfig.opacity}
                onChange={(e) =>
                  updateFloorConfig({ opacity: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={gridControlsDisabled}
              />
            </div>

            {/* Main Color */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Palette size={16} />
                <span>Grid Main Color</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {floorConfig.mainColor.map((value, index) => (
                  <input
                    key={`main-${index}`}
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={value}
                    onChange={(e) => {
                      const next = [...floorConfig.mainColor] as [number, number, number];
                      next[index] = parseFloat(e.target.value);
                      updateFloorConfig({ mainColor: next });
                    }}
                    className="skybox-slider"
                    style={{ flex: 1 }}
                    disabled={gridControlsDisabled}
                    title={['Red', 'Green', 'Blue'][index]}
                  />
                ))}
                <div
                  style={{
                    width: '30px',
                    height: '20px',
                    backgroundColor: `rgb(${Math.round(floorConfig.mainColor[0] * 255)}, ${Math.round(floorConfig.mainColor[1] * 255)}, ${Math.round(floorConfig.mainColor[2] * 255)})`,
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '3px',
                  }}
                />
              </div>
            </div>

            {/* Line Color */}
            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Palette size={16} />
                <span>Major Line Color</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {floorConfig.lineColor.map((value, index) => (
                  <input
                    key={`line-${index}`}
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={value}
                    onChange={(e) => {
                      const next = [...floorConfig.lineColor] as [number, number, number];
                      next[index] = parseFloat(e.target.value);
                      updateFloorConfig({ lineColor: next });
                    }}
                    className="skybox-slider"
                    style={{ flex: 1 }}
                    disabled={gridControlsDisabled}
                    title={['Red', 'Green', 'Blue'][index]}
                  />
                ))}
                <div
                  style={{
                    width: '30px',
                    height: '20px',
                    backgroundColor: `rgb(${Math.round(floorConfig.lineColor[0] * 255)}, ${Math.round(floorConfig.lineColor[1] * 255)}, ${Math.round(floorConfig.lineColor[2] * 255)})`,
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '3px',
                  }}
                />
              </div>
            </div>
          </>
        )}

        {/* Triplanar Section */}
        {floorConfig.materialType !== 'grid' && floorConfig.triplanar && (
          <>
            <div className="skybox-settings-divider"></div>
            <div className="skybox-setting-group">
              <label
                className="skybox-setting-label"
                style={{ fontWeight: 'bold', marginBottom: '8px' }}
              >
                <Palette size={18} />
                <span>Triplanar PBR Settings</span>
              </label>
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3X3 size={16} />
                <span>Macro Scale (m)</span>
                <span className="skybox-setting-value">
                  {floorConfig.triplanar.macroScale.toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                min="4"
                max="20"
                step="0.5"
                value={floorConfig.triplanar.macroScale}
                onChange={(e) =>
                  updateTriplanar({ macroScale: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={!floorConfig.enabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3X3 size={16} />
                <span>Micro Scale</span>
                <span className="skybox-setting-value">
                  {floorConfig.triplanar.microScale.toFixed(0)}
                </span>
              </label>
              <input
                type="range"
                min="20"
                max="100"
                step="1"
                value={floorConfig.triplanar.microScale}
                onChange={(e) =>
                  updateTriplanar({ microScale: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={!floorConfig.enabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Grid3X3 size={16} />
                <span>Noise Scale</span>
                <span className="skybox-setting-value">
                  {floorConfig.triplanar.noiseScale.toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                min="6"
                max="24"
                step="0.5"
                value={floorConfig.triplanar.noiseScale}
                onChange={(e) =>
                  updateTriplanar({ noiseScale: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={!floorConfig.enabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Eye size={16} />
                <span>Noise Strength</span>
                <span className="skybox-setting-value">
                  {floorConfig.triplanar.noiseStrength.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={floorConfig.triplanar.noiseStrength}
                onChange={(e) =>
                  updateTriplanar({ noiseStrength: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={!floorConfig.enabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Palette size={16} />
                <span>Roughness Bias</span>
                <span className="skybox-setting-value">
                  {floorConfig.triplanar.roughnessBias.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="-0.2"
                max="0.2"
                step="0.01"
                value={floorConfig.triplanar.roughnessBias}
                onChange={(e) =>
                  updateTriplanar({ roughnessBias: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={!floorConfig.enabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Eye size={16} />
                <span>AO Weight</span>
                <span className="skybox-setting-value">
                  {floorConfig.triplanar.aoWeight.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={floorConfig.triplanar.aoWeight}
                onChange={(e) =>
                  updateTriplanar({ aoWeight: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={!floorConfig.enabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Palette size={16} />
                <span>Metallic</span>
                <span className="skybox-setting-value">
                  {floorConfig.triplanar.metallic.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="0.4"
                step="0.01"
                value={floorConfig.triplanar.metallic}
                onChange={(e) =>
                  updateTriplanar({ metallic: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={!floorConfig.enabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Palette size={16} />
                <span>Normal Strength</span>
                <span className="skybox-setting-value">
                  {floorConfig.triplanar.normalStrength.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0.2"
                max="2"
                step="0.05"
                value={floorConfig.triplanar.normalStrength}
                onChange={(e) =>
                  updateTriplanar({ normalStrength: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={!floorConfig.enabled}
              />
            </div>

            <div className="skybox-setting-group">
              <label className="skybox-setting-label">
                <Palette size={16} />
                <span>Micro Normal Strength</span>
                <span className="skybox-setting-value">
                  {floorConfig.triplanar.microNormalStrength.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0.2"
                max="2"
                step="0.05"
                value={floorConfig.triplanar.microNormalStrength}
                onChange={(e) =>
                  updateTriplanar({ microNormalStrength: parseFloat(e.target.value) })
                }
                className="skybox-slider"
                disabled={!floorConfig.enabled}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
