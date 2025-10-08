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
      <div
        className="transform-settings-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Transform Settings"
      >
        <Settings size={18} />
      </div>

      {isExpanded && (
        <div className="transform-settings-content">
          {/* Position Increment - Icon buttons only */}
          <div className="setting-icon-row">
            <Move size={14} className="setting-icon" title="Position (mm)" />
            {posPresets.map((val) => (
              <button
                key={val}
                className={`icon-btn ${positionIncrement === val ? 'active' : ''}`}
                onClick={() => setPositionIncrement(val)}
                title={`${val}mm`}
              >
                {val}
              </button>
            ))}
          </div>

          {/* Rotation Increment - Icon buttons only */}
          <div className="setting-icon-row">
            <RotateCw size={14} className="setting-icon" title="Rotation (°)" />
            {rotPresets.map((val) => (
              <button
                key={val}
                className={`icon-btn ${rotationIncrement === val ? 'active' : ''}`}
                onClick={() => setRotationIncrement(val)}
                title={`${val}°`}
              >
                {val}
              </button>
            ))}
          </div>

          {/* Snap Toggle - Single icon button */}
          <div className="setting-icon-row">
            <button
              className={`icon-btn snap-toggle ${snapEnabled ? 'active' : ''}`}
              onClick={() => setSnapEnabled(!snapEnabled)}
              title="Toggle Snapping"
            >
              <Target size={14} />
            </button>
          </div>

          {/* Snap Types - Icon only */}
          {snapEnabled && (
            <div className="setting-icon-row">
              <button
                className={`icon-btn ${snapToGrid ? 'active' : ''}`}
                onClick={() => setSnapToGrid(!snapToGrid)}
                title="Snap to Grid"
              >
                <Grid3x3 size={14} />
              </button>
              <button
                className={`icon-btn ${snapToVertex ? 'active' : ''}`}
                onClick={() => setSnapToVertex(!snapToVertex)}
                title="Snap to Vertex"
              >
                <Circle size={14} />
              </button>
              <button
                className={`icon-btn ${snapToEdge ? 'active' : ''}`}
                onClick={() => setSnapToEdge(!snapToEdge)}
                title="Snap to Edge"
              >
                <Target size={14} />
              </button>
              <button
                className={`icon-btn ${snapToFace ? 'active' : ''}`}
                onClick={() => setSnapToFace(!snapToFace)}
                title="Snap to Face"
              >
                <Box size={14} />
              </button>
              <button
                className={`icon-btn ${snapToCenter ? 'active' : ''}`}
                onClick={() => setSnapToCenter(!snapToCenter)}
                title="Snap to Center"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
