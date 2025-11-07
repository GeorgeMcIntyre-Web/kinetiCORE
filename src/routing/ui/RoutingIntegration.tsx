// Routing Integration - Integrates routing components into the scene
// Owner: Routing System Team

import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';
import { ConnectionManager } from '../core/ConnectionManager';
import { useRoutingStore } from '../../ui/store/routingStore';
import { ConnectionPointIndicator } from './ConnectionPointIndicator';
import { RoutePreview } from './RoutePreview';
import { RouteOptimizer } from '../pathfinding/RouteOptimizer';
import { ConstraintValidator } from '../pathfinding/ConstraintValidator';
import { RoutingWorkflowHandler } from './RoutingWorkflowHandler';
import type { RoutingMode } from '../../ui/store/routingStore';
import { getDefaultConstraints, getObstacles } from '../core/RoutingUtils';

/**
 * RoutingIntegration component manages routing visualizations and interactions
 * Renders connection point indicators and route previews in the scene
 */
export const RoutingIntegration: React.FC = () => {
  const scene = SceneManager.getInstance().getScene();
  const connectionManager = ConnectionManager.getInstance();
  const routingMode = useRoutingStore((state) => state.routingMode);
  const connectionPoints = useRoutingStore((state) => state.connectionPoints);
  const selectedSource = useRoutingStore((state) => state.selectedSource);
  const selectedDest = useRoutingStore((state) => state.selectedDest);
  const previewRoute = useRoutingStore((state) => state.previewRoute);
  const setPreviewRoute = useRoutingStore((state) => state.setPreviewRoute);
  const currentRouteType = useRoutingStore((state) => state.currentRouteType);
  const optimizationMode = useRoutingStore((state) => state.optimizationMode);

  const validator = useRef(new ConstraintValidator());
  const optimizer = useRef(new RouteOptimizer());
  const workflowHandler = useRef(new RoutingWorkflowHandler());

  const addConnectionPoint = useRoutingStore((state) => state.addConnectionPoint);

  // Sync connection points from ConnectionManager to store on mount
  useEffect(() => {
    const allPoints = connectionManager.getAllConnectionPoints();
    allPoints.forEach((point) => {
      addConnectionPoint(point);
    });
  }, [addConnectionPoint, connectionManager]);

  // Initialize workflow handler
  useEffect(() => {
    if (scene) {
      workflowHandler.current.initialize(scene);
    }
  }, [scene]);

  // Helper to get obstacles from scene
  const getObstaclesForPreview = (): BABYLON.Mesh[] => {
    if (!scene) return [];
    return getObstacles(scene);
  };

  // Update preview route when source/destination changes
  useEffect(() => {
    if (!scene || routingMode !== 'selecting_dest') return;

    if (selectedSource && selectedDest) {
      // Generate route preview
      const constraints = getDefaultConstraints(currentRouteType);
      const obstacles = getObstaclesForPreview();

      const route = optimizer.current.findOptimalPath(
        selectedSource,
        selectedDest,
        constraints,
        obstacles,
        optimizationMode
      );

      if (route) {
        setPreviewRoute(route);
      } else {
        setPreviewRoute(null);
      }
    } else {
      setPreviewRoute(null);
    }
  }, [selectedSource, selectedDest, routingMode, currentRouteType, optimizationMode, scene, setPreviewRoute]);

  if (!scene) return null;

  return (
    <>
      {/* Render connection point indicators */}
      {connectionPoints.map((point) => {
        let state: 'available' | 'selected' | 'connected' = 'available';
        if (point.getId() === selectedSource?.getId() || point.getId() === selectedDest?.getId()) {
          state = 'selected';
        } else {
          const connections = connectionManager.getConnections(point.getId());
          if (connections.length > 0) {
            state = 'connected';
          }
        }

        return (
          <ConnectionPointIndicator
            key={point.getId()}
            point={point}
            state={state}
            scene={scene}
            onClick={() => {
              const setSelectSource = useRoutingStore.getState().selectSource;
              const setSelectDest = useRoutingStore.getState().selectDest;
              const setRoutingMode = useRoutingStore.getState().setRoutingMode;
              const clearSelection = useRoutingStore.getState().clearSelection;
              handleConnectionPointClick(
                point,
                routingMode,
                selectedSource,
                selectedDest,
                setSelectSource,
                setSelectDest,
                setRoutingMode,
                clearSelection
              );
            }}
            onHover={(_hovered) => {
              // Could add hover effects here
            }}
            visible={routingMode !== 'off'}
          />
        );
      })}

      {/* Render route preview */}
      {previewRoute && (
        <RoutePreview
          route={previewRoute}
          validation={validator.current.validateRoute(previewRoute, getObstaclesForPreview())}
          scene={scene}
          visible={true}
        />
      )}
    </>
  );
};

/**
 * Handle connection point click based on routing mode
 */
function handleConnectionPointClick(
  point: any,
  routingMode: RoutingMode,
  selectedSource: any,
  _selectedDest: any,
  selectSource: (p: any) => void,
  selectDest: (p: any) => void,
  setRoutingMode: (mode: RoutingMode) => void,
  clearSelection: () => void
) {
  if (routingMode === 'selecting_source') {
    selectSource(point);
    setRoutingMode('selecting_dest');
  } else if (routingMode === 'selecting_dest') {
    selectDest(point);
    
    // Create route if both source and dest are selected
    if (selectedSource) {
      createRoute(selectedSource, point);
      clearSelection();
      setRoutingMode('off');
    }
  }
}

/**
 * Create a route between two connection points
 */
function createRoute(source: any, dest: any) {
  import('../pathfinding/RouteOptimizer').then(({ RouteOptimizer }) => {
    import('../../scene/SceneManager').then(({ SceneManager }) => {
          import('../core/ConnectionManager').then(() => {
        import('../../ui/store/routingStore').then(({ useRoutingStore }) => {
          import('../commands/CreateRouteCommand').then(({ CreateRouteCommand }) => {
            import('../../ui/store/editorStore').then(({ useEditorStore }) => {
              const state = useRoutingStore.getState();
              const scene = SceneManager.getInstance().getScene();

              if (!scene) return;

              const optimizer = new RouteOptimizer();
              const constraints = getDefaultConstraints(state.currentRouteType);
              const obstacles = getObstacles(scene);

              const route = optimizer.findOptimalPath(
                source,
                dest,
                constraints,
                obstacles,
                state.optimizationMode
              );

              if (route) {
                // Execute command for undo/redo (command will add route and create connection)
                const commandManager = useEditorStore.getState().commandManager;
                const command = new CreateRouteCommand(route);
                commandManager.execute(command);
              }
            });
          });
        });
      });
    });
  }).catch((error) => {
    console.error('Error creating route:', error);
  });
}
