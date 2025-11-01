// Connection Manager Panel - Shows connection network and allows management
// Owner: Routing System Team

import React, { useState } from 'react';
import { ConnectionManager } from '../core/ConnectionManager';
import { ConnectionPoint } from '../core/ConnectionPoint';
import { useRoutingStore } from '../../ui/store/routingStore';
import { Network, Trash2, Zap, Search } from 'lucide-react';
import './routing.css';

/**
 * ConnectionManagerPanel displays the connection network and allows management
 */
export const ConnectionManagerPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  // Subscribe to store for reactivity
  const connectionPoints = useRoutingStore((state) => state.connectionPoints);
  const removeConnectionPoint = useRoutingStore((state) => state.removeConnectionPoint);
  const connectionManager = ConnectionManager.getInstance();

  // Filter connection points
  const filteredPoints = connectionPoints.filter((point) => {
    const matchesSearch = point.getId().toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || point.getType() === filterType;
    return matchesSearch && matchesType;
  });

  const handleAutoRouteAll = () => {
    // Auto-route all unconnected compatible points
    // This is a simplified implementation
    for (let i = 0; i < filteredPoints.length; i++) {
      for (let j = i + 1; j < filteredPoints.length; j++) {
        const point1 = filteredPoints[i];
        const point2 = filteredPoints[j];

        if (point1.isCompatible(point2)) {
          // Check if connection already exists
          const connections = connectionManager.getConnections(point1.getId());
          const exists = connections.some((c) => c.toId === point2.getId());

          if (!exists) {
            // Create connection (route would be generated separately)
            connectionManager.createConnection(point1.getId(), point2.getId());
          }
        }
      }
    }
  };

  const handleDeletePoint = (pointId: string) => {
    if (confirm('Delete this connection point?')) {
      connectionManager.removeConnectionPoint(pointId);
      removeConnectionPoint(pointId);
    }
  };

  const getConnectionStatus = (point: ConnectionPoint): string => {
    const connections = connectionManager.getConnections(point.getId());
    return connections.length > 0 ? 'connected' : 'unconnected';
  };

  return (
    <div className="connection-manager-panel">
      <div className="panel-header">
        <h3>
          <Network size={20} /> Connection Network
        </h3>
      </div>

      <div className="panel-controls">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search connections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="pipe">Pipe</option>
          <option value="electrical">Electrical</option>
          <option value="cable_tray">Cable Tray</option>
          <option value="conduit">Conduit</option>
        </select>

        <button className="btn-primary" onClick={handleAutoRouteAll}>
          <Zap size={16} /> Auto-Route All
        </button>
      </div>

      <div className="connection-list">
        <div className="connection-stats">
          <span>Total: {connectionPoints.length}</span>
          <span>Filtered: {filteredPoints.length}</span>
        </div>

        <ul className="connection-items">
          {filteredPoints.map((point) => {
            const status = getConnectionStatus(point);
            return (
              <li key={point.getId()} className="connection-item">
                <div className="connection-info">
                  <div className="connection-type">{point.getType()}</div>
                  <div className="connection-id">{point.getId().substring(0, 8)}...</div>
                  <div className={`connection-status ${status.toLowerCase()}`}>{status}</div>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => handleDeletePoint(point.getId())}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>

        {filteredPoints.length === 0 && (
          <div className="empty-state">
            <p>No connection points found</p>
          </div>
        )}
      </div>
    </div>
  );
};

