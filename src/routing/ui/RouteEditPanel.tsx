// Route Edit Panel - UI for editing route properties
// Owner: Routing System Team

import React, { useState, useEffect } from 'react';
import { Route } from '../core/Route';
import { RouteType, ConnectionSpecifications } from '../core/types';
import { useRoutingStore } from '../../ui/store/routingStore';
import { EditRouteCommand } from '../commands/EditRouteCommand';
import { useEditorStore } from '../../ui/store/editorStore';
import { Save, X } from 'lucide-react';
import './routing.css';

interface RouteEditPanelProps {
  route: Route;
  onClose?: () => void;
}

/**
 * RouteEditPanel provides UI for editing route properties
 */
export const RouteEditPanel: React.FC<RouteEditPanelProps> = ({ route, onClose }) => {
  const commandManager = useEditorStore((state) => state.commandManager);
  const connectionPoints = useRoutingStore((state) => state.connectionPoints);
  
  // Local state for editing
  const [routeType, setRouteType] = useState<RouteType>(route.type);
  const [sourcePointId, setSourcePointId] = useState<string>(route.source.getId());
  const [destPointId, setDestPointId] = useState<string>(route.destination.getId());
  const [specifications, setSpecifications] = useState<ConnectionSpecifications>({
    ...route.source.specifications,
  });

  // Get current specifications from source connection point
  useEffect(() => {
    const sourcePoint = connectionPoints.find((p) => p.getId() === route.source.getId());
    if (sourcePoint) {
      setSpecifications({ ...sourcePoint.specifications });
    }
  }, [route, connectionPoints]);

  const handleUpdate = async () => {
    // Find new source and destination points if changed
    const newSource = connectionPoints.find((p) => p.getId() === sourcePointId) || route.source;
    const newDest = connectionPoints.find((p) => p.getId() === destPointId) || route.destination;

    // Create updated route with new type if changed
    // For now, we preserve segments/supports but allow type and connection point changes
    const updatedSegments = route.segments.map((s) => ({ ...s }));
    const updatedSupports = route.supports.map((s) => ({ ...s }));

    // If connection points changed, we need to potentially regenerate segments
    // For simplicity, preserve existing segments if only type/specs changed
    const needsRegeneration = 
      newSource.getId() !== route.source.getId() || 
      newDest.getId() !== route.destination.getId();

    if (needsRegeneration) {
      // If connection points changed, create new route segments
      // This is simplified - in production, you'd want to regenerate via optimizer
      const newSegments = [
        {
          id: `seg_${Date.now()}`,
          startPoint: { ...newSource.position },
          endPoint: { ...newDest.position },
          segmentType: 'straight' as const,
          length: Math.sqrt(
            Math.pow(newDest.position.x - newSource.position.x, 2) +
            Math.pow(newDest.position.y - newSource.position.y, 2) +
            Math.pow(newDest.position.z - newSource.position.z, 2)
          ),
        },
      ];

      // Create command with updated route
      const beforeSegments = route.segments.map((s) => ({ ...s }));
      const beforeSupports = route.supports.map((s) => ({ ...s }));

      // Create new route instance via EditRouteCommand
      // Note: EditRouteCommand currently only handles segments/supports
      // For type changes, we'll need to regenerate geometry separately
      const command = new EditRouteCommand(
        route.getId(),
        beforeSegments,
        newSegments,
        beforeSupports,
        updatedSupports
      );

      commandManager.execute(command);
    } else {
      // Just update segments/supports with existing connection points
      const beforeSegments = route.segments.map((s) => ({ ...s }));
      const beforeSupports = route.supports.map((s) => ({ ...s }));

      const command = new EditRouteCommand(
        route.getId(),
        beforeSegments,
        updatedSegments,
        beforeSupports,
        updatedSupports
      );

      commandManager.execute(command);
      
      // Update debug label after command execution
      const { getGlobalDebugLabels } = await import('./RouteDebugLabels');
      const debugLabels = getGlobalDebugLabels();
      if (debugLabels) {
        const routingStore = useRoutingStore.getState();
        const updatedRoute = routingStore.activeRoutes.find((r: Route) => r.getId() === route.getId());
        if (updatedRoute && updatedRoute.generated) {
          debugLabels.updateLabel(updatedRoute);
        }
      }
    }

    // Update route type if changed (requires geometry regeneration)
    if (routeType !== route.type) {
      // Note: Type changes require full route regeneration
      const store = useRoutingStore.getState();
      const routes = store.activeRoutes;
      const routeIndex = routes.findIndex((r) => r.getId() === route.getId());
      
      if (routeIndex >= 0) {
        // If geometry was generated, dispose old mesh first
        if (route.generated) {
          const scene = (await import('../../scene/SceneManager')).SceneManager.getInstance().getScene();
          if (scene) {
            const routeMesh = scene.meshes.find((m) => 
              m.metadata && 
              m.metadata.isRoute && 
              m.metadata.routeId === route.getId()
            );
            if (routeMesh) {
              routeMesh.dispose();
            }
            
            // Remove debug label if exists
            const { getGlobalDebugLabels } = await import('./RouteDebugLabels');
            const debugLabels = getGlobalDebugLabels();
            if (debugLabels) {
              debugLabels.removeLabel(route.getId());
            }
          }
        }
        
        // Create new route with updated type
        const updatedRoute = Route.createWithType(
          route.getId(),
          newSource,
          newDest,
          routeType,
          updatedSegments,
          updatedSupports,
          route.material,
          route.constraints
        );
        
        const updatedRoutes = [...routes];
        updatedRoutes[routeIndex] = updatedRoute;
        store.activeRoutes = updatedRoutes;
        
        // Mark as not generated - user will need to regenerate geometry
        updatedRoute.markAsNotGenerated();
      }
    }

    // Close panel if callback provided
    if (onClose) {
      onClose();
    }
  };

  // Get available connection points for dropdowns
  const availablePoints = connectionPoints.filter((p) => {
    // Filter by type compatibility
    if (routeType !== p.getType()) return false;
    return true;
  });

  return (
    <div className="route-edit-panel">
      <div className="route-edit-header">
        <h3>Edit Route</h3>
        {onClose && (
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="route-edit-content">
        {/* Route Type */}
        <div className="route-edit-field">
          <label>Route Type:</label>
          <select
            value={routeType}
            onChange={(e) => setRouteType(e.target.value as RouteType)}
            className="route-edit-input"
          >
            <option value="pipe">Pipe</option>
            <option value="electrical">Electrical</option>
            <option value="cable_tray">Cable Tray</option>
            <option value="conduit">Conduit</option>
          </select>
        </div>

        {/* Source Connection Point */}
        <div className="route-edit-field">
          <label>Source Point:</label>
          <select
            value={sourcePointId}
            onChange={(e) => setSourcePointId(e.target.value)}
            className="route-edit-input"
          >
            {availablePoints.map((point) => (
              <option key={point.getId()} value={point.getId()}>
                {point.getId().substring(0, 8)} - ({point.position.x.toFixed(1)}, {point.position.y.toFixed(1)}, {point.position.z.toFixed(1)})
              </option>
            ))}
          </select>
        </div>

        {/* Destination Connection Point */}
        <div className="route-edit-field">
          <label>Destination Point:</label>
          <select
            value={destPointId}
            onChange={(e) => setDestPointId(e.target.value)}
            className="route-edit-input"
          >
            {availablePoints.map((point) => (
              <option key={point.getId()} value={point.getId()}>
                {point.getId().substring(0, 8)} - ({point.position.x.toFixed(1)}, {point.position.y.toFixed(1)}, {point.position.z.toFixed(1)})
              </option>
            ))}
          </select>
        </div>

        {/* Specifications */}
        <div className="route-edit-field">
          <label>Specifications:</label>
          <div className="route-edit-specs">
            {routeType === 'electrical' && (
              <div className="route-edit-spec-item">
                <label>Voltage:</label>
                <input
                  type="number"
                  value={specifications.voltage || ''}
                  onChange={(e) =>
                    setSpecifications({ ...specifications, voltage: parseFloat(e.target.value) || undefined })
                  }
                  className="route-edit-input"
                  placeholder="e.g., 480"
                />
              </div>
            )}
            {(routeType === 'pipe' || routeType === 'cable_tray' || routeType === 'conduit') && (
              <div className="route-edit-spec-item">
                <label>Size:</label>
                <input
                  type="text"
                  value={specifications.size || ''}
                  onChange={(e) =>
                    setSpecifications({ ...specifications, size: e.target.value || undefined })
                  }
                  className="route-edit-input"
                  placeholder="e.g., 3/4 inch"
                />
              </div>
            )}
            <div className="route-edit-spec-item">
              <label>Material:</label>
              <input
                type="text"
                value={specifications.material || ''}
                onChange={(e) =>
                  setSpecifications({ ...specifications, material: e.target.value || undefined })
                }
                className="route-edit-input"
                placeholder="e.g., Steel, PVC"
              />
            </div>
          </div>
        </div>

        {/* Route Info (Read-only) */}
        <div className="route-edit-info">
          <div className="route-edit-info-item">
            <span>Total Length:</span>
            <span>{route.getTotalLength().toFixed(2)} units</span>
          </div>
          <div className="route-edit-info-item">
            <span>Segments:</span>
            <span>{route.segments.length}</span>
          </div>
          <div className="route-edit-info-item">
            <span>Material:</span>
            <span>{route.material.name}</span>
          </div>
        </div>

        {/* Update Button */}
        <div className="route-edit-actions">
          <button className="btn-primary" onClick={handleUpdate}>
            <Save size={16} />
            Update Route
          </button>
        </div>
      </div>
    </div>
  );
};

