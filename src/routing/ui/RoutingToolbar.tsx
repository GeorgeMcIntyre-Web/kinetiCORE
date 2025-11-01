// Routing Toolbar - Toolbar buttons for routing workflow
// Owner: Routing System Team

import React from 'react';
import { Network, Zap, GitBranch, Wrench } from 'lucide-react';
import { useRoutingStore } from '../../ui/store/routingStore';

interface RoutingToolbarProps {
  onAddConnector?: () => void;
  onRouteBetweenPoints?: () => void;
  onAutoRouteAll?: () => void;
  onEditRoute?: () => void;
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
}) => {
  const currentRouteType = useRoutingStore((state) => state.currentRouteType);
  const setCurrentRouteType = useRoutingStore((state) => state.setCurrentRouteType);
  const routingMode = useRoutingStore((state) => state.routingMode);
  const setRoutingMode = useRoutingStore((state) => state.setRoutingMode);

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

  return (
    <div className="routing-toolbar-container">
      <div className="routing-buttons-row">
        <button
          className={`ribbon-btn ${routingMode === 'placing_connector' ? 'active' : ''}`}
          onClick={handleAddConnector}
          title="Add Connection Point"
        >
          <Network size={32} />
        </button>

        <button
          className={`ribbon-btn ${routingMode === 'selecting_source' || routingMode === 'selecting_dest' ? 'active' : ''}`}
          onClick={handleRouteBetweenPoints}
          title="Route Between Points"
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

        <select
          className="ribbon-select"
          value={currentRouteType}
          onChange={(e) =>
            setCurrentRouteType(e.target.value as 'pipe' | 'electrical' | 'cable_tray' | 'conduit')
          }
          title="Route Type"
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

