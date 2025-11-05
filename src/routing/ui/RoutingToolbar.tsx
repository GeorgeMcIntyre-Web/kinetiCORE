// Routing Toolbar - Toolbar buttons for routing workflow
// Owner: Routing System Team

import React, { useEffect } from 'react';
import { Network, Zap, GitBranch, Wrench, FileText, Cylinder, Box, GitCommit } from 'lucide-react';
import { useRoutingStore } from '../../ui/store/routingStore';
import { useQuickRoutePrimitives } from './QuickRoutePrimitives';
import { getQuickRouteCreator } from './QuickRouteCreator';

interface RoutingToolbarProps {
  onAddConnector?: () => void;
  onRouteBetweenPoints?: () => void;
  onAutoRouteAll?: () => void;
  onEditRoute?: () => void;
  onTemplatesClick?: () => void;
}

/**
 * RoutingToolbar provides buttons for routing operations
 * This component is meant to be integrated into the main RibbonToolbar
 */
export const RoutingToolbar: React.FC<RoutingToolbarProps> = ({
  onAddConnector,
  onRouteBetweenPoints,
  onAutoRouteAll,
  onEditRoute,
  onTemplatesClick,
}) => {
  const currentRouteType = useRoutingStore((state) => state.currentRouteType);
  const setCurrentRouteType = useRoutingStore((state) => state.setCurrentRouteType);
  const routingMode = useRoutingStore((state) => state.routingMode);
  const setRoutingMode = useRoutingStore((state) => state.setRoutingMode);
  
  // Quick modeling hooks
  const { startCreation: startPrimitive, cancelCreation: cancelPrimitive, isActive: isPrimitiveActive, activeType } = useQuickRoutePrimitives();

  const handleAddConnector = () => {
    setRoutingMode('placing_connector');
    if (onAddConnector) onAddConnector();
  };

  const handleRouteBetweenPoints = () => {
    setRoutingMode('selecting_source');
    if (onRouteBetweenPoints) onRouteBetweenPoints();
  };

  const handleAutoRouteAll = () => {
    if (onAutoRouteAll) onAutoRouteAll();
  };

  const handleEditRoute = () => {
    setRoutingMode('editing');
    if (onEditRoute) onEditRoute();
  };

  // Quick primitive creation handlers
  const handleQuickPrimitive = (type: 'pipe' | 'cable_tray' | 'wire' | 'conduit') => {
    setRoutingMode('off'); // Disable other routing modes
    startPrimitive(type);
  };

  // Quick route creation handlers (direct route creation)
  const handleQuickRoute = () => {
    setRoutingMode('off'); // Disable other routing modes
    const creator = getQuickRouteCreator();
    if (creator) {
      creator.startQuickRoute(currentRouteType);
    } else {
      console.warn('[RoutingToolbar] Scene not ready for quick route creation');
    }
  };

  // Cancel quick modeling on ESC or when mode changes
  useEffect(() => {
    if (routingMode !== 'off') {
      if (isPrimitiveActive) {
        cancelPrimitive();
      }
      const creator = getQuickRouteCreator();
      if (creator && creator.isActive()) {
        creator.cancelQuickRoute();
      }
    }
  }, [routingMode, isPrimitiveActive, cancelPrimitive]);

  const isQuickRouteActive = (() => {
    try {
      const creator = getQuickRouteCreator();
      return creator ? creator.isActive() : false;
    } catch {
      return false;
    }
  })();

  return (
    <div className="routing-toolbar-container" data-testid="routing-toolbar">
      <div className="routing-buttons-row">
        <button
          className={`ribbon-btn ${routingMode === 'placing_connector' ? 'active' : ''}`}
          onClick={handleAddConnector}
          title="Add Connection Point"
          data-testid="add-connection-point-btn"
        >
          <Network size={32} />
        </button>

        <button
          className={`ribbon-btn ${routingMode === 'selecting_source' || routingMode === 'selecting_dest' ? 'active' : ''}`}
          onClick={handleRouteBetweenPoints}
          title="Route Between Points"
          data-testid="route-between-points-btn"
        >
          <GitBranch size={32} />
        </button>

        <button
          className="ribbon-btn"
          onClick={handleAutoRouteAll}
          title="Auto-Route All Connections"
        >
          <Zap size={32} />
        </button>

        <button
          className={`ribbon-btn ${routingMode === 'editing' ? 'active' : ''}`}
          onClick={handleEditRoute}
          title="Edit Route"
        >
          <Wrench size={32} />
        </button>

        <button
          className={`ribbon-btn ${routingMode === 'placing_template' ? 'active' : ''}`}
          onClick={() => {
            if (onTemplatesClick) onTemplatesClick();
          }}
          title="Route Templates"
        >
          <FileText size={32} />
        </button>

        {/* Quick Modeling Tools */}
        <div style={{ borderLeft: '1px solid #444', marginLeft: '8px', paddingLeft: '8px', display: 'flex', gap: '4px' }}>
          <button
            className={`ribbon-btn ${isPrimitiveActive && activeType === 'pipe' ? 'active' : ''}`}
            onClick={() => handleQuickPrimitive('pipe')}
            title="Quick Pipe (Primitive)"
          >
            <Cylinder size={32} />
          </button>
          <button
            className={`ribbon-btn ${isPrimitiveActive && activeType === 'cable_tray' ? 'active' : ''}`}
            onClick={() => handleQuickPrimitive('cable_tray')}
            title="Quick Cable Tray (Primitive)"
          >
            <Box size={32} />
          </button>
          <button
            className={`ribbon-btn ${isQuickRouteActive ? 'active' : ''}`}
            onClick={handleQuickRoute}
            title="Quick Route (Direct - Click 2 points)"
          >
            <GitCommit size={32} />
          </button>
        </div>

        <select
          className="ribbon-select"
          value={currentRouteType}
          onChange={(e) =>
            setCurrentRouteType(e.target.value as 'pipe' | 'electrical' | 'cable_tray' | 'conduit')
          }
          title="Route Type"
          data-testid="route-type-select"
        >
          <option value="pipe">Pipe</option>
          <option value="electrical">Electrical</option>
          <option value="cable_tray">Cable Tray</option>
          <option value="conduit">Conduit</option>
        </select>
      </div>
    </div>
  );
};

