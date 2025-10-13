// Selection Filter Toolbar Component
// Provides UI controls for configuring selection filtering

import React from 'react';
import { useEditorStore } from '../store/editorStore';

export const SelectionFilterToolbar: React.FC = () => {
  // const selectionFilter = useEditorStore((state) => state.selectionFilter);
  // const setSelectionFilter = useEditorStore((state) => state.setSelectionFilter);
  // const resetSelectionFilter = useEditorStore((state) => state.resetSelectionFilter);
  const setOpenToolbarPopup = useEditorStore((state) => state.setOpenToolbarPopup);

  const handleFilterChange = (key: string, value: boolean) => {
    // setSelectionFilter({ [key]: value });
    console.log(`Filter change: ${key} = ${value}`);
  };

  const handleClose = () => {
    setOpenToolbarPopup(null);
  };

  return (
    <div className="absolute top-16 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 min-w-64">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Selection Filter</h3>
        <button
          onClick={handleClose}
          className="text-gray-500 hover:text-gray-700 text-xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        {/* Floor/Ground Prevention */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Exclude Floor/Ground
          </label>
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => handleFilterChange('excludeFloor', e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        {/* Axis Meshes */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Exclude Axes/Origin
          </label>
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => handleFilterChange('excludeAxes', e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        {/* Widget Elements */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Exclude Widgets/Gizmos
          </label>
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => handleFilterChange('excludeWidgets', e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        {/* Label Elements */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Exclude Labels/Text
          </label>
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => handleFilterChange('excludeLabels', e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        {/* JT Components */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Exclude JT Components
          </label>
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => handleFilterChange('excludeJTComponents', e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        {/* Lighting Elements */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Exclude Lighting
          </label>
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => handleFilterChange('excludeLighting', e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between mt-4 pt-3 border-t border-gray-200">
        <button
          onClick={() => console.log('Reset selection filter')}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
        >
          Reset
        </button>
        <button
          onClick={handleClose}
          className="px-3 py-1 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
        >
          Done
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-3 text-xs text-gray-500">
        <p>Configure which objects can be selected in the 3D viewport.</p>
        <p>Floor/ground prevention is enabled by default for better UX.</p>
        <div className="mt-2 p-2 bg-blue-50 rounded">
          <p className="font-medium text-blue-800">JT Selection Tips:</p>
          <ul className="mt-1 text-blue-700 space-y-1">
            <li>• Regular click: Select component</li>
            <li>• Shift+Click: Select entire assembly</li>
            <li>• Alt+Click: Select individual part</li>
            <li>• Ctrl+Click: Multi-select</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Selection Controls Component - Main toolbar button
export const SelectionControls: React.FC = () => {
  const openToolbarPopup = useEditorStore((state) => state.openToolbarPopup);
  const setOpenToolbarPopup = useEditorStore((state) => state.setOpenToolbarPopup);
  const selectedMeshes = useEditorStore((state) => state.selectedMeshes);
  const clearSelection = useEditorStore((state) => state.clearSelection);

  const handleClick = () => {
    if (openToolbarPopup === 'snap-geometric') {
      setOpenToolbarPopup(null);
    } else {
      // setOpenToolbarPopup('selection-filter');
      console.log('Would open selection filter');
    }
  };

  const handleClearSelection = () => {
    clearSelection();
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleClick}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            false // Always show as inactive for now
              ? 'bg-blue-100 text-blue-700 border border-blue-300'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
          title="Selection Filter Settings"
        >
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
              />
            </svg>
            <span>Filter</span>
          </div>
        </button>

        {selectedMeshes.length > 0 && (
          <>
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-600">
                {selectedMeshes.length} selected
              </span>
              <button
                onClick={handleClearSelection}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                title="Clear Selection"
              >
                Clear
              </button>
            </div>
          </>
        )}
      </div>

      {false && <SelectionFilterToolbar />}
    </>
  );
};
