// Floor Selector Component - Allows users to change floor materials
// Owner: Edwin

import React from 'react';
import { FloorType } from '../../core/types';
import { SceneManager } from '../../scene/SceneManager';
import './FloorSelector.css';

interface FloorOption {
  value: FloorType;
  label: string;
  description: string;
}

const FLOOR_OPTIONS: FloorOption[] = [
  { value: 'concrete-polished', label: 'Polished Concrete', description: 'Smooth concrete floor' },
  { value: 'concrete-raw', label: 'Raw Concrete', description: 'Rough concrete texture' },
  { value: 'epoxy-gray', label: 'Epoxy Gray', description: 'Smooth gray epoxy coating' },
  { value: 'epoxy-white', label: 'Epoxy White', description: 'Smooth white epoxy coating' },
  { value: 'tiles-ceramic', label: 'Ceramic Tiles', description: 'Glossy tile floor' },
  { value: 'metal-checker', label: 'Metal Checker', description: 'Diamond plate metal' },
  { value: 'asphalt', label: 'Asphalt', description: 'Dark asphalt surface' },
  { value: 'wood-industrial', label: 'Industrial Wood', description: 'Wood flooring' },
  { value: 'grid-only', label: 'Grid Only', description: 'Transparent with grid' },
];

export const FloorSelector: React.FC = () => {
  const sceneManager = SceneManager.getInstance();
  const [currentFloor, setCurrentFloor] = React.useState<FloorType>(sceneManager.getFloorType());
  const [showGrid, setShowGrid] = React.useState(sceneManager.isGridOverlayVisible());

  const handleFloorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newFloor = event.target.value as FloorType;
    setCurrentFloor(newFloor);

    sceneManager.setFloorType(newFloor);
  };

  const handleGridToggle = () => {
    const newShowGrid = !showGrid;
    setShowGrid(newShowGrid);

    sceneManager.setGridOverlayVisible(newShowGrid);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      padding: '2px 4px',
      background: 'rgba(40, 40, 45, 0.95)',
      borderRadius: '3px',
      border: '1px solid rgba(60, 60, 65, 0.8)',
      fontSize: '9px',
    }}>
      <label style={{ color: '#e0e0e0', fontSize: '9px', whiteSpace: 'nowrap' }}>
        Floor:
      </label>
      <select
        value={currentFloor}
        onChange={handleFloorChange}
        title="Select floor material"
        style={{
          background: 'rgba(30, 30, 35, 0.95)',
          border: '1px solid rgba(80, 80, 85, 0.8)',
          borderRadius: '3px',
          color: '#e0e0e0',
          padding: '2px 4px',
          fontSize: '9px',
          cursor: 'pointer',
          outline: 'none',
          width: '75px',
        }}
      >
        {FLOOR_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div style={{ borderLeft: '1px solid rgba(80, 80, 85, 0.5)', paddingLeft: '3px', display: 'flex', alignItems: 'center', gap: '2px' }}>
        <input
          type="checkbox"
          checked={showGrid}
          onChange={handleGridToggle}
          style={{ width: '11px', height: '11px', cursor: 'pointer', accentColor: '#4a9eff' }}
        />
        <span style={{ fontSize: '9px', color: '#e0e0e0' }}>Grid</span>
      </div>
    </div>
  );
};
