// Floor & Grid Settings Panel - controls floor material and a single grid overlay
// Owner: Scene/Rendering Team

import React, { useEffect, useState } from 'react';
import { Eye, Grid3X3, Palette } from 'lucide-react';
import { FloorType } from '../../core/types';
import { SceneManager } from '../../scene/SceneManager';
import { GridOverlayOptions } from '../../scene/FloorMaterialManager';
import './FloorSettingsPanel.css';

type GridSettings = Required<GridOverlayOptions> & { visible: boolean };
type NumericGridOptionKey = 'majorUnitFrequency' | 'minorUnitVisibility' | 'gridRatio' | 'opacity';

const FLOOR_OPTIONS: { value: FloorType; label: string; description: string }[] = [
  { value: 'concrete-polished', label: 'Polished Concrete', description: 'Smooth concrete floor' },
  { value: 'concrete-raw', label: 'Raw Concrete', description: 'Rough concrete texture' },
  { value: 'epoxy-gray', label: 'Epoxy Gray', description: 'Smooth gray epoxy coating' },
  { value: 'epoxy-white', label: 'Epoxy White', description: 'Smooth white epoxy coating' },
  { value: 'tiles-ceramic', label: 'Ceramic Tiles', description: 'Glossy tile floor' },
  { value: 'metal-checker', label: 'Metal Checker', description: 'Diamond plate metal' },
  { value: 'asphalt', label: 'Asphalt', description: 'Dark asphalt surface' },
  { value: 'wood-industrial', label: 'Industrial Wood', description: 'Wood flooring' },
  { value: 'grid-only', label: 'Grid Only', description: 'Transparent floor with grid' },
];

const COLOR_CHANNELS = ['R', 'G', 'B'];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const FloorSettingsPanel: React.FC = () => {
  const sceneManager = SceneManager.getInstance();
  const [sceneReady, setSceneReady] = useState<boolean>(() => !!sceneManager.getScene());
  const [floorType, setFloorType] = useState<FloorType>(() => sceneManager.getFloorType());
  const [gridSettings, setGridSettings] = useState<GridSettings>(() => ({
    ...sceneManager.getGridOverlayOptions(),
    visible: sceneManager.isGridOverlayVisible(),
  }));

  useEffect(() => {
    if (sceneReady) {
      return;
    }

    let timeoutId: number | null = null;

    const pollForScene = () => {
      if (sceneManager.getScene()) {
        setSceneReady(true);
        setFloorType(sceneManager.getFloorType());
        setGridSettings({
          ...sceneManager.getGridOverlayOptions(),
          visible: sceneManager.isGridOverlayVisible(),
        });
        return;
      }
      timeoutId = window.setTimeout(pollForScene, 250);
    };

    pollForScene();
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [sceneManager, sceneReady]);

  const updateNumericOption = (key: NumericGridOptionKey, value: number) => {
    if (!sceneReady) return;
    setGridSettings((prev) => ({ ...prev, [key]: value }));
    sceneManager.setGridOverlayOptions({ [key]: value } as GridOverlayOptions);
  };

  const updateColorChannel = (type: 'mainColor' | 'lineColor', index: number, rawValue: number) => {
    if (!sceneReady) return;
    setGridSettings((prev) => {
      const nextColor = [...prev[type]] as [number, number, number];
      nextColor[index] = clamp(rawValue);
      sceneManager.setGridOverlayOptions({ [type]: nextColor } as GridOverlayOptions);
      return { ...prev, [type]: nextColor };
    });
  };

  const handleGridVisibilityChange = (visible: boolean) => {
    if (!sceneReady) return;
    setGridSettings((prev) => ({ ...prev, visible }));
    sceneManager.setGridOverlayVisible(visible);
  };

  const handleFloorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as FloorType;
    if (nextType === floorType || !sceneReady) {
      return;
    }
    setFloorType(nextType);
    sceneManager.setFloorType(nextType);
    if (nextType === 'grid-only' && !gridSettings.visible) {
      handleGridVisibilityChange(true);
    }
  };

  return (
    <div className="floor-settings-panel">
      <div className="floor-settings-header">
        <Grid3X3 size={20} />
        <h3>Floor &amp; Grid Settings</h3>
      </div>

      <div className="floor-settings-content">
        <div className="floor-setting-group">
          <label className="floor-setting-label">
            <Palette size={16} />
            <span>Floor Material</span>
          </label>
          <select
            value={floorType}
            onChange={handleFloorChange}
            disabled={!sceneReady}
            className="floor-select"
          >
            {FLOOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="floor-setting-group">
          <label className="floor-setting-label">
            <Eye size={16} />
            <span>Show Grid Overlay</span>
          </label>
          <label className="floor-toggle">
            <input
              type="checkbox"
              checked={gridSettings.visible}
              onChange={(e) => handleGridVisibilityChange(e.target.checked)}
              disabled={!sceneReady}
            />
            <span className="floor-toggle-slider"></span>
          </label>
        </div>

        <div className="floor-setting-group">
          <label className="floor-setting-label">
            <Grid3X3 size={16} />
            <span>Major Grid Frequency</span>
            <span className="floor-setting-value">{gridSettings.majorUnitFrequency}</span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={gridSettings.majorUnitFrequency}
            onChange={(e) => updateNumericOption('majorUnitFrequency', parseInt(e.target.value, 10))}
            className="floor-slider"
            disabled={!sceneReady}
          />
        </div>

        <div className="floor-setting-group">
          <label className="floor-setting-label">
            <Grid3X3 size={16} />
            <span>Minor Line Visibility</span>
            <span className="floor-setting-value">{gridSettings.minorUnitVisibility.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={gridSettings.minorUnitVisibility}
            onChange={(e) => updateNumericOption('minorUnitVisibility', parseFloat(e.target.value))}
            className="floor-slider"
            disabled={!sceneReady}
          />
        </div>

        <div className="floor-setting-group">
          <label className="floor-setting-label">
            <Grid3X3 size={16} />
            <span>Grid Ratio</span>
            <span className="floor-setting-value">{gridSettings.gridRatio.toFixed(2)} m</span>
          </label>
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.05}
            value={gridSettings.gridRatio}
            onChange={(e) => updateNumericOption('gridRatio', parseFloat(e.target.value))}
            className="floor-slider"
            disabled={!sceneReady}
          />
        </div>

        <div className="floor-setting-group">
          <label className="floor-setting-label">
            <Eye size={16} />
            <span>Grid Opacity</span>
            <span className="floor-setting-value">{gridSettings.opacity.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={gridSettings.opacity}
            onChange={(e) => updateNumericOption('opacity', parseFloat(e.target.value))}
            className="floor-slider"
            disabled={!sceneReady}
          />
        </div>

        <div className="floor-setting-group">
          <label className="floor-setting-label">
            <Palette size={16} />
            <span>Main Grid Color</span>
            <span className="floor-setting-value">
              rgb(
              {gridSettings.mainColor
                .map((value) => Math.round(value * 255))
                .join(', ')}
              )
            </span>
          </label>
          <div
            className="floor-color-preview"
            style={{
              backgroundColor: `rgb(${gridSettings.mainColor
                .map((value) => Math.round(value * 255))
                .join(', ')})`,
            }}
          />
          {gridSettings.mainColor.map((value, index) => (
            <div key={`main-${index}`} className="floor-channel">
              <label className="floor-setting-label">
                <span>{COLOR_CHANNELS[index]}</span>
                <span className="floor-setting-value">{Math.round(value * 255)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={value}
                onChange={(e) => updateColorChannel('mainColor', index, parseFloat(e.target.value))}
                className="floor-slider"
                disabled={!sceneReady}
              />
            </div>
          ))}
        </div>

        <div className="floor-setting-group">
          <label className="floor-setting-label">
            <Palette size={16} />
            <span>Major Line Color</span>
            <span className="floor-setting-value">
              rgb(
              {gridSettings.lineColor
                .map((value) => Math.round(value * 255))
                .join(', ')}
              )
            </span>
          </label>
          <div
            className="floor-color-preview"
            style={{
              backgroundColor: `rgb(${gridSettings.lineColor
                .map((value) => Math.round(value * 255))
                .join(', ')})`,
            }}
          />
          {gridSettings.lineColor.map((value, index) => (
            <div key={`line-${index}`} className="floor-channel">
              <label className="floor-setting-label">
                <span>{COLOR_CHANNELS[index]}</span>
                <span className="floor-setting-value">{Math.round(value * 255)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={value}
                onChange={(e) => updateColorChannel('lineColor', index, parseFloat(e.target.value))}
                className="floor-slider"
                disabled={!sceneReady}
              />
            </div>
          ))}
        </div>

        <div className="floor-settings-info">
          <p>
            Grid controls adjust a single overlay shared by snapping, measurement, and visualization
            tools. Values are in meters and update the grid in real time whenever the grid is
            visible.
          </p>
        </div>
      </div>
    </div>
  );
};
