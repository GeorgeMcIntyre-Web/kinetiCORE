/**
 * Snap Controls Component
 * Owner: George
 * 
 * Essential snap controls using systematic button implementation
 * This replaces the problematic snap buttons with reliable ones
 */

import { SnapTypeButton } from './buttons/SnapTypeButton';
import { ButtonTemplate } from './buttons/ButtonTemplate';

export function SnapControls() {
  return (
    <div className="snap-controls space-y-2">
      {/* Master Snap Toggle */}
      <div className="snap-master-control">
        <ButtonTemplate
          id="snap_master_toggle"
          label="Snap"
          icon="magnet"
          action="Toggle master snapping"
          stateKey="snapEnabled"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="sm"
          ariaLabel="Toggle master snapping on/off"
          keyboardShortcut="s"
          storeMethod="setSnapEnabled"
          callback={(value) => {
            console.log(`[SnapControls] Master snap: ${value}`);
          }}
        />
      </div>

      {/* Geometric Snapping */}
      <div className="snap-geometric-controls">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Geometric</h4>
        <div className="grid grid-cols-2 gap-1">
          <SnapTypeButton snapType="vertex" label="Vertex" icon="circle" />
          <SnapTypeButton snapType="edge" label="Edge" icon="minus" />
          <SnapTypeButton snapType="face" label="Face" icon="square" />
          <SnapTypeButton snapType="center" label="Center" icon="target" />
        </div>
      </div>

      {/* Object Snapping */}
      <div className="snap-object-controls">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Object</h4>
        <div className="grid grid-cols-2 gap-1">
          <SnapTypeButton snapType="object" label="Object" icon="box" />
          <SnapTypeButton snapType="midpoint" label="Midpoint" icon="circle-dot" />
          <SnapTypeButton snapType="intersection" label="Intersection" icon="x" />
          <SnapTypeButton snapType="perpendicular" label="Perpendicular" icon="corner-down-right" />
        </div>
      </div>

      {/* Auxiliary Snapping */}
      <div className="snap-auxiliary-controls">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Auxiliary</h4>
        <div className="grid grid-cols-2 gap-1">
          <SnapTypeButton snapType="tangent" label="Tangent" icon="circle-dot" />
          <SnapTypeButton snapType="along" label="Along" icon="arrow-right" />
          <SnapTypeButton snapType="normal" label="Normal" icon="arrow-up" />
          <SnapTypeButton snapType="plane" label="Plane" icon="square" />
        </div>
      </div>

      {/* Grid Controls */}
      <div className="snap-grid-controls">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Grid</h4>
        <div className="space-y-1">
          <ButtonTemplate
            id="snap_grid_toggle"
            label="Grid"
            icon="grid-3x3"
            action="Toggle grid snapping"
            stateKey="snapToGrid"
            initialState={false}
            stateType="boolean"
            variant="ghost"
            size="sm"
            ariaLabel="Toggle grid snapping"
            keyboardShortcut="g"
            storeMethod="setSnapToGrid"
            callback={(value) => {
              console.log(`[SnapControls] Grid snap: ${value}`);
            }}
          />
          
          <ButtonTemplate
            id="snap_distance_setting"
            label="Distance"
            icon="ruler"
            action="Set snap distance"
            stateKey="snapDistance"
            initialState={10}
            stateType="number"
            variant="ghost"
            size="sm"
            ariaLabel="Set snap distance"
            storeMethod="setSnapDistance"
            callback={(value) => {
              console.log(`[SnapControls] Snap distance: ${value}mm`);
            }}
          />
        </div>
      </div>

      {/* Debug Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="snap-debug-info mt-4 p-2 bg-gray-100 rounded text-xs">
          <h5 className="font-bold mb-1">Debug Info</h5>
          <div className="space-y-1">
            <div>Master Snap: <span className="text-green-600">Enabled</span></div>
            <div>Active Snaps: <span className="text-blue-600">Vertex, Edge</span></div>
            <div>Snap Distance: <span className="text-purple-600">10mm</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
