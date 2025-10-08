// Transform Settings Panel
// Owner: Edwin (with George's integration)
// Provides UI controls for transform increments and snapping configuration

import { useState } from 'react';
import { Settings, Grid3x3, Circle, Target, Box, Maximize2, Move, RotateCw } from 'lucide-react';
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
      <div className="transform-settings-header" onClick={() => setIsExpanded(!isExpanded)} title="Transform Settings">
        <Settings size={10} />
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="transform-settings-content">
          {/* Position Increment */}
          <div className="setting-group">
            <div className="setting-row">
              <Move size={10} title="Position Increment (mm)" />
              <input
                type="number"
                className="setting-input"
                value={positionIncrement}
                onChange={(e) => setPositionIncrement(parseFloat(e.target.value) || 1)}
                min={0.01}
                step={0.1}
                title="Position Increment (mm)"
              />
            </div>
            <div className="preset-buttons">
              {posPresets.map((val) => (
                <button
                  key={val}
                  className={`preset-btn ${positionIncrement === val ? 'active' : ''}`}
                  onClick={() => setPositionIncrement(val)}
                  title={`${val}mm`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Rotation Increment */}
          <div className="setting-group">
            <div className="setting-row">
              <RotateCw size={10} title="Rotation Increment (°)" />
              <input
                type="number"
                className="setting-input"
                value={rotationIncrement}
                onChange={(e) => setRotationIncrement(parseFloat(e.target.value) || 1)}
                min={0.01}
                step={0.1}
                title="Rotation Increment (°)"
              />
            </div>
            <div className="preset-buttons">
              {rotPresets.map((val) => (
                <button
                  key={val}
                  className={`preset-btn ${rotationIncrement === val ? 'active' : ''}`}
                  onClick={() => setRotationIncrement(val)}
                  title={`${val}°`}
                >
                  {val}°
                </button>
              ))}
            </div>
          </div>

          {/* Snap Toggle */}
          <div className="setting-group">
            <div className="setting-row">
              <Target size={10} title="Enable Snapping" />
              <input
                type="checkbox"
                className="setting-checkbox"
                checked={snapEnabled}
                onChange={(e) => setSnapEnabled(e.target.checked)}
                title="Enable Snapping"
              />
            </div>

            {snapEnabled && (
              <>
                {/* Snap Types - Icon only with checkboxes */}
                <div className="snap-types">
                  <div className="snap-type-row" title="Snap to Grid">
                    <Grid3x3 size={10} />
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                    />
                  </div>
                  <div className="snap-type-row" title="Snap to Vertex">
                    <Circle size={10} />
                    <input
                      type="checkbox"
                      checked={snapToVertex}
                      onChange={(e) => setSnapToVertex(e.target.checked)}
                    />
                  </div>
                  <div className="snap-type-row" title="Snap to Edge">
                    <Target size={10} />
                    <input
                      type="checkbox"
                      checked={snapToEdge}
                      onChange={(e) => setSnapToEdge(e.target.checked)}
                    />
                  </div>
                  <div className="snap-type-row" title="Snap to Face">
                    <Box size={10} />
                    <input
                      type="checkbox"
                      checked={snapToFace}
                      onChange={(e) => setSnapToFace(e.target.checked)}
                    />
                  </div>
                  <div className="snap-type-row" title="Snap to Center">
                    <Maximize2 size={10} />
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
                    <div className="preset-buttons">
                      {gridPresets.map((val) => (
                        <button
                          key={val}
                          className={`preset-btn ${gridSize === val ? 'active' : ''}`}
                          onClick={() => setGridSize(val)}
                          title={`Grid: ${val}mm`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Snap Distance */}
                <div className="setting-subgroup">
                  <input
                    type="number"
                    className="setting-input"
                    value={snapDistance}
                    onChange={(e) => setSnapDistance(parseFloat(e.target.value) || 1)}
                    min={1}
                    step={1}
                    title="Snap Distance (mm)"
                    placeholder="Dist"
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
