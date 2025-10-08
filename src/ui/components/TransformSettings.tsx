// Transform Settings Panel
// Owner: Edwin (with George's integration)
// Provides UI controls for transform increments and snapping configuration

import { Settings, Crosshair, Move, RotateCw } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import './TransformSettings.css';

export const TransformSettings: React.FC = () => {
  // Use shared popup state to manage which toolbar popup is open
  const openToolbarPopup = useEditorStore((state) => state.openToolbarPopup);
  const setOpenToolbarPopup = useEditorStore((state) => state.setOpenToolbarPopup);

  const isExpanded = openToolbarPopup === 'transform-settings';

  // Transform settings from store
  const positionIncrement = useEditorStore((state) => state.positionIncrement);
  const rotationIncrement = useEditorStore((state) => state.rotationIncrement);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);

  // Setters
  const setPositionIncrement = useEditorStore((state) => state.setPositionIncrement);
  const setRotationIncrement = useEditorStore((state) => state.setRotationIncrement);
  const setSnapEnabled = useEditorStore((state) => state.setSnapEnabled);

  const handleToggle = () => {
    setOpenToolbarPopup(isExpanded ? null : 'transform-settings');
  };

  // Preset increment values
  const posPresets = [1, 5, 10, 25, 50, 100]; // mm
  const rotPresets = [1, 5, 15, 30, 45, 90]; // degrees

  return (
    <div className="transform-settings-panel">
      <div
        className="transform-settings-header"
        onClick={handleToggle}
        title="Transform Settings"
      >
        <Settings size={18} />
      </div>

      {isExpanded && (
        <div className="transform-settings-content">
          {/* Position Increment - Icon buttons only */}
          <div className="setting-icon-row" title="Position (mm)">
            <Move size={14} className="setting-icon" />
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
          <div className="setting-icon-row" title="Rotation (°)">
            <RotateCw size={14} className="setting-icon" />
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
              <Crosshair size={14} />
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
