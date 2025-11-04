// Routing Control Panel - Main control center for routing operations
// Owner: Routing System Team

import React, { useState } from 'react';
import { Network, Trash2, Eye, EyeOff } from 'lucide-react';
import { useEditorStore } from '../../ui/store/editorStore';
import { useRoutingStore } from '../../ui/store/routingStore';
import { ConnectionManager } from '../core/ConnectionManager';
import { RoutingWorkflowHandler } from './RoutingWorkflowHandler';
import './RoutingControlPanel.css';

interface RoutingControlPanelProps {
  onClose?: () => void;
}

/**
 * Main control panel for routing operations
 * Provides workflow for:
 * 1. Selecting route type
 * 2. Placing connection points
 * 3. Creating routes
 * 4. Managing active routes
 */
export const RoutingControlPanel: React.FC<RoutingControlPanelProps> = ({ onClose }) => {
  const currentRouteType = useRoutingStore((state) => state.currentRouteType);
  const setCurrentRouteType = useRoutingStore((state) => state.setCurrentRouteType);
  const routingMode = useRoutingStore((state) => state.routingMode);
  const setRoutingMode = useRoutingStore((state) => state.setRoutingMode);
  const activeRoutes = useRoutingStore((state) => state.activeRoutes);
  const selectedRoute = useRoutingStore((state) => state.selectedRoute);
  const selectRoute = useRoutingStore((state) => state.selectRoute);
  const removeRoute = useRoutingStore((state) => state.removeRoute);

  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>([]);
  const [showRoutes, setShowRoutes] = useState(true);

  // Get all connection points
  const connectionManager = ConnectionManager.getInstance();
  const allConnectors = connectionManager.getAllConnectionPoints();

  // Handle placing connector mode
  const handlePlaceConnector = () => {
    if (routingMode === 'placing_connector') {
      setRoutingMode('off');
    } else {
      setRoutingMode('placing_connector');
    }
  };

  // Handle connector selection for routing
  const handleConnectorClick = async (connectorId: string) => {
    console.log('[RoutingControlPanel] Connector clicked:', connectorId);

    if (selectedConnectorIds.length === 0) {
      console.log('[RoutingControlPanel] Selected first connector');
      setSelectedConnectorIds([connectorId]);
    } else if (selectedConnectorIds.length === 1) {
      // Create route between two points
      const [sourceId] = selectedConnectorIds;
      console.log('[RoutingControlPanel] Creating route between', sourceId, 'and', connectorId);

      const routeId = await RoutingWorkflowHandler.createRouteBetweenPoints(sourceId, connectorId);

      if (routeId) {
        console.log('[RoutingControlPanel] Route created, generating geometry...');
        // Automatically generate geometry
        const { GenerateRouteGeometryCommand } = await import('../commands/GenerateRouteGeometryCommand');
        const cmdManager = useEditorStore.getState().commandManager;
        const genCmd = new GenerateRouteGeometryCommand(routeId);
        cmdManager.execute(genCmd);
      }

      setSelectedConnectorIds([]);
    }
  };

  // Handle route selection
  const handleRouteClick = (routeId: string) => {
    const route = activeRoutes.find((r) => r.getId() === routeId);
    if (route) {
      selectRoute(route);
    }
  };

  // Handle route deletion
  const handleDeleteRoute = (routeId: string) => {
    removeRoute(routeId);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedConnectorIds([]);
    setRoutingMode('off');
  };

  return (
    <div className="routing-control-panel">
      {/* Header */}
      <div className="panel-header">
        <h3>Routing Control</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {/* Route Type Selector - Compact */}
      <div className="section">
        <div className="section-header">
          <h4>Route Type</h4>
          <div className="route-type-indicator">{currentRouteType}</div>
        </div>
        <div className="route-type-buttons">
          <button
            className={`type-btn ${currentRouteType === 'pipe' ? 'active' : ''}`}
            onClick={() => setCurrentRouteType('pipe')}
            title="Pipe"
          >
            P
          </button>
          <button
            className={`type-btn ${currentRouteType === 'electrical' ? 'active' : ''}`}
            onClick={() => setCurrentRouteType('electrical')}
            title="Electrical"
          >
            E
          </button>
          <button
            className={`type-btn ${currentRouteType === 'cable_tray' ? 'active' : ''}`}
            onClick={() => setCurrentRouteType('cable_tray')}
            title="Cable Tray"
          >
            T
          </button>
          <button
            className={`type-btn ${currentRouteType === 'conduit' ? 'active' : ''}`}
            onClick={() => setCurrentRouteType('conduit')}
            title="Conduit"
          >
            C
          </button>
        </div>
      </div>

      {/* Quick Actions */}
        {selectedConnectorIds.length === 2 && (
          <button className="secondary-btn" onClick={async () => {
            const [a,b] = selectedConnectorIds;
            const routeId = await RoutingWorkflowHandler.createRouteBetweenPoints(a,b);
            if (routeId) {
              const { GenerateRouteGeometryCommand } = await import("../commands/GenerateRouteGeometryCommand");
              const { useEditorStore } = await import("../../ui/store/editorStore");
              const cmdManager = useEditorStore.getState().commandManager;
              cmdManager.execute(new GenerateRouteGeometryCommand(routeId));
              setSelectedConnectorIds([]);
            }
          }}>Create Route from 2 Selected</button>
        )}
      <div className="section">
        <button
          className={`primary-btn ${routingMode === 'placing_connector' ? 'active' : ''}`}
          onClick={handlePlaceConnector}
          title={routingMode === 'placing_connector' ? 'Stop Placing Connectors (Esc)' : 'Place Connectors - Click geometry in 3D viewport'}
        >
          <Network size={18} />
          {routingMode === 'placing_connector' && <span>Stop</span>}
        </button>
        {routingMode === 'placing_connector' && (
          <>
            <div className="hint-box">
              👆 Click in 3D viewport to place connection points
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="secondary-btn" onClick={() => setRoutingMode("off")}>
                Finish Placing
              </button>
            </div>
          </>
        )}
        {selectedConnectorIds.length > 0 && (
          <div className="hint-box">
            {selectedConnectorIds.length === 1
              ? '✓ Start selected. Click another connector below.'
              : '✓ Creating route...'}
            <button className="clear-link" onClick={handleClearSelection}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Connection Points List */}
      <div className="section">
        <div className="section-header">
          <h4>Connection Points</h4>
          <span className="count-badge">{allConnectors.length}</span>
        </div>
        <div className="connector-list">
          {allConnectors.length === 0 ? (
            <div className="empty-state">No connection points yet</div>
          ) : (
            allConnectors.map((connector) => {
              const pos = connector.getPosition();
              const isSelected = selectedConnectorIds.includes(connector.getId());
              return (
                <div
                  key={connector.getId()}
                  className={`connector-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleConnectorClick(connector.getId())}
                >
                  <div className={`connector-type-dot ${connector.getType()}`} />
                  <div className="connector-info">
                    <div className="connector-name">{connector.getType()}</div>
                    <div className="connector-pos">
                      ({pos.x.toFixed(2)}, {pos.y.toFixed(2)}, {pos.z.toFixed(2)})
                    </div>
                  </div>
                  {isSelected && <div className="selected-indicator">✓</div>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Routes List */}
      <div className="section">
        <div className="section-header">
          <h4>Active Routes</h4>
          <div className="header-actions">
            <span className="count-badge">{activeRoutes.length}</span>
            <button
              className="icon-btn"
              onClick={() => setShowRoutes(!showRoutes)}
              title={showRoutes ? 'Hide all routes' : 'Show all routes'}
            >
              {showRoutes ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
        </div>
        <div className="route-list">
          {activeRoutes.length === 0 ? (
            <div className="empty-state">No routes created yet</div>
          ) : (
            activeRoutes.map((route) => {
              const isSelected = selectedRoute?.getId() === route.getId();
              const validationResult = useRoutingStore.getState().validationResults.get(route.getId());
              const hasErrors = validationResult?.violations.some((v) => v.severity === 'error');
              const hasWarnings = validationResult?.violations.some((v) => v.severity === 'warning');

              return (
                <div
                  key={route.getId()}
                  className={`route-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleRouteClick(route.getId())}
                >
                  <div className={`route-type-dot ${route.type}`} />
                  <div className="route-info">
                    <div className="route-name">
                      {route.type} Route
                      {hasErrors && <span className="status-badge error">⚠ Error</span>}
                      {!hasErrors && hasWarnings && (
                        <span className="status-badge warning">⚠ Warning</span>
                      )}
                      {!hasErrors && !hasWarnings && (
                        <span className="status-badge valid">✓ Valid</span>
                      )}
                    </div>
                    <div className="route-details">
                      {route.segments.length} segments, {(route.getTotalLength() / 1000).toFixed(2)}m
                    </div>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRoute(route.getId());
                    }}
                    title="Delete route"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};


