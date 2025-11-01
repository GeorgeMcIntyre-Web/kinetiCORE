// Route Inspector - Inspector panel for route properties
// Owner: Routing System Team

import React from 'react';
import { Route } from '../core/Route';
import { ValidationResult } from '../core/types';
import { useRoutingStore } from '../../ui/store/routingStore';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import './routing.css';

interface RouteInspectorProps {
  route: Route | null;
  validation: ValidationResult | null;
  onGenerateGeometry?: () => void;
  onEditSegments?: () => void;
}

/**
 * RouteInspector displays route properties and allows editing
 */
export const RouteInspector: React.FC<RouteInspectorProps> = ({
  route,
  validation,
  onGenerateGeometry,
  onEditSegments,
}) => {
  const removeRoute = useRoutingStore((state) => state.removeRoute);

  if (!route) {
    return (
      <div className="route-inspector-empty">
        <p>No route selected</p>
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm('Delete this route?')) {
      removeRoute(route.getId());
    }
  };

  return (
    <div className="route-inspector">
      <div className="route-inspector-header">
        <h3>Route Properties</h3>
        <button className="btn-danger" onClick={handleDelete}>
          Delete
        </button>
      </div>

      <div className="route-inspector-section">
        <label>Type:</label>
        <span>{route.type}</span>
      </div>

      <div className="route-inspector-section">
        <label>Total Length:</label>
        <span>{route.getTotalLength().toFixed(2)} units</span>
      </div>

      <div className="route-inspector-section">
        <label>Segments:</label>
        <span>{route.segments.length}</span>
      </div>

      <div className="route-inspector-section">
        <label>Supports:</label>
        <span>{route.supports.length}</span>
      </div>

      <div className="route-inspector-section">
        <label>Material:</label>
        <span>{route.material.name}</span>
      </div>

      <div className="route-inspector-section">
        <label>Status:</label>
        <div className="validation-status">
          {validation?.isValid ? (
            <span className="status-valid">
              <CheckCircle size={16} /> Valid
            </span>
          ) : (
            <span className="status-invalid">
              <AlertCircle size={16} /> Invalid
            </span>
          )}
        </div>
      </div>

      {validation && validation.violations.length > 0 && (
        <div className="route-inspector-violations">
          <h4>Constraint Violations:</h4>
          <ul>
            {validation.violations.map((violation, idx) => (
              <li key={idx} className={`violation-${violation.severity}`}>
                {violation.severity === 'error' && <AlertCircle size={14} />}
                {violation.severity === 'warning' && <AlertTriangle size={14} />}
                {violation.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="route-inspector-actions">
        <button 
          className="btn-primary" 
          onClick={onGenerateGeometry}
          data-testid="generate-geometry-btn"
        >
          Generate Geometry
        </button>
        <button className="btn-secondary" onClick={onEditSegments}>
          Edit Segments
        </button>
      </div>
    </div>
  );
};

