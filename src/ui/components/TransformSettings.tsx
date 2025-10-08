// Transform Settings Panel
// Owner: Edwin (with George's integration)
// Provides UI controls for transform increments and snapping configuration

import { useState } from 'react';
import { Settings, Grid3x3, Circle, Target, Box, Maximize2 } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import './TransformSettings.css';

export const TransformSettings: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Transform settings from store
  const positionIncrement = useEditorStore((state) => state.positionIncrement);
  const rotationIncrement = useEditorStore((state) => state.rotationIncrement);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const snapToGrid = useEditorStore((state) => state.snapToGrid);
  const snapToVertex = useEditorStore((state) => state.snapToVertex);
  const snapToEdge = useEditorStore((state) => state.snapToEdge);
  const snapToFace = useEditorStore((state) => state.snapToFace);
  const snapToCenter = useEditorStore((state) => state.snapToCenter);
  const gridSize = useEditorStore((state) => state.gridSize);
  const snapDistance = useEditorStore((state) => state.snapDistance);

  // Setters
  const setPositionIncrement = useEditorStore((state) => state.setPositionIncrement);
  const setRotationIncrement = useEditorStore((state) => state.setRotationIncrement);
  const setSnapEnabled = useEditorStore((state) => state.setSnapEnabled);
  const setSnapToGrid = useEditorStore((state) => state.setSnapToGrid);
  const setSnapToVertex = useEditorStore((state) => state.setSnapToVertex);
  const setSnapToEdge = useEditorStore((state) => state.setSnapToEdge);
  const setSnapToFace = useEditorStore((state) => state.setSnapToFace);
  const setSnapToCenter = useEditorStore((state) => state.setSnapToCenter);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const setSnapDistance = useEditorStore((state) => state.setSnapDistance);

  // Preset increment values
  const posPresets = [1, 5, 10, 25, 50, 100]; // mm
  const rotPresets = [1, 5, 15, 30, 45, 90]; // degrees
  const gridPresets = [10, 50, 100, 500, 1000]; // mm

  return (
    <div className="transform-settings-panel">
      <div className="transform-settings-header" onClick={() => setIsExpanded(!isExpanded)}>
        <Settings size={16} />
        <span>Transform Settings</span>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="transform-settings-content">
          {/* Position Increment */}
          <div className="setting-group">
            <label className="setting-label">Position Increment (mm)</label>
            <div className="preset-buttons">
              {posPresets.map((val) => (
                <button
                  key={val}
                  className={`preset-btn ${positionIncrement === val ? 'active' : ''}`}
                  onClick={() => setPositionIncrement(val)}
                >
                  {val}
                </button>
              ))}
            </div>
            <input
              type="number"
              className="setting-input"
              value={positionIncrement}
              onChange={(e) => setPositionIncrement(parseFloat(e.target.value) || 1)}
              min={0.01}
              step={0.1}
            />
          </div>

          {/* Rotation Increment */}
          <div className="setting-group">
            <label className="setting-label">Rotation Increment (°)</label>
            <div className="preset-buttons">
              {rotPresets.map((val) => (
                <button
                  key={val}
                  className={`preset-btn ${rotationIncrement === val ? 'active' : ''}`}
                  onClick={() => setRotationIncrement(val)}
                >
                  {val}°
                </button>
              ))}
            </div>
            <input
              type="number"
              className="setting-input"
              value={rotationIncrement}
              onChange={(e) => setRotationIncrement(parseFloat(e.target.value) || 1)}
              min={0.01}
              step={0.1}
            />
          </div>

          {/* Snap Settings */}
          <div className="setting-group">
            <div className="setting-row">
              <label className="setting-label">Enable Snapping</label>
              <input
                type="checkbox"
                className="setting-checkbox"
                checked={snapEnabled}
                onChange={(e) => setSnapEnabled(e.target.checked)}
              />
            </div>

            {snapEnabled && (
              <>
                {/* Snap Types */}
                <div className="snap-types">
                  <div className="snap-type-row">
                    <Grid3x3 size={14} />
                    <label>Grid</label>
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                    />
                  </div>
                  <div className="snap-type-row">
                    <Circle size={14} />
                    <label>Vertex</label>
                    <input
                      type="checkbox"
                      checked={snapToVertex}
                      onChange={(e) => setSnapToVertex(e.target.checked)}
                    />
                  </div>
                  <div className="snap-type-row">
                    <Target size={14} />
                    <label>Edge</label>
                    <input
                      type="checkbox"
                      checked={snapToEdge}
                      onChange={(e) => setSnapToEdge(e.target.checked)}
                    />
                  </div>
                  <div className="snap-type-row">
                    <Box size={14} />
                    <label>Face</label>
                    <input
                      type="checkbox"
                      checked={snapToFace}
                      onChange={(e) => setSnapToFace(e.target.checked)}
                    />
                  </div>
                  <div className="snap-type-row">
                    <Maximize2 size={14} />
                    <label>Center</label>
                    <input
                      type="checkbox"
                      checked={snapToCenter}
                      onChange={(e) => setSnapToCenter(e.target.checked)}
                    />
                  </div>
                </div>

                {/* Grid Size */}
                {snapToGrid && (
                  <div className="setting-subgroup">
                    <label className="setting-label">Grid Size (mm)</label>
                    <div className="preset-buttons">
                      {gridPresets.map((val) => (
                        <button
                          key={val}
                          className={`preset-btn ${gridSize === val ? 'active' : ''}`}
                          onClick={() => setGridSize(val)}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Snap Distance */}
                <div className="setting-subgroup">
                  <label className="setting-label">Snap Distance (mm)</label>
                  <input
                    type="number"
                    className="setting-input"
                    value={snapDistance}
                    onChange={(e) => setSnapDistance(parseFloat(e.target.value) || 1)}
                    min={1}
                    step={1}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
