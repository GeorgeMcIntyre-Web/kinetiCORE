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
  const [currentFloor, setCurrentFloor] = React.useState<FloorType>('concrete-polished');
  const [showGrid, setShowGrid] = React.useState(true);

  const handleFloorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newFloor = event.target.value as FloorType;
    setCurrentFloor(newFloor);

    const sceneManager = SceneManager.getInstance();
    sceneManager.setFloorType(newFloor);
  };

  const handleGridToggle = () => {
    const newShowGrid = !showGrid;
    setShowGrid(newShowGrid);

    const sceneManager = SceneManager.getInstance();
    sceneManager.setGridOverlayVisible(newShowGrid);
  };

  return (
    <div className="floor-selector">
      <div className="floor-selector-dropdown">
        <label htmlFor="floor-type" className="floor-label">
          Floor:
        </label>
        <select
          id="floor-type"
          value={currentFloor}
          onChange={handleFloorChange}
          className="floor-select"
          title="Select floor material"
        >
          {FLOOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid-toggle">
        <label className="grid-checkbox-label">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={handleGridToggle}
            className="grid-checkbox"
          />
          <span className="grid-label-text">Grid</span>
        </label>
      </div>
    </div>
  );
};
