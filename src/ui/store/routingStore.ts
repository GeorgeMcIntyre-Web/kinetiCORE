// Routing Store - State management for routing workflow
// Owner: Routing System Team

import { create } from 'zustand';
import { ConnectionPoint } from '../../routing/core/ConnectionPoint';
import { Route } from '../../routing/core/Route';
import { EnhancedValidationResult } from '../../routing/validation/RouteValidator';

/**
 * Routing mode states
 */
export type RoutingMode = 'off' | 'placing_connector' | 'selecting_source' | 'selecting_dest' | 'editing' | 'placing_template';

/**
 * Routing store state interface
 */
interface RoutingState {
  // Routing mode
  routingMode: RoutingMode;
  setRoutingMode: (mode: RoutingMode) => void;

  // Selected connection points
  selectedSource: ConnectionPoint | null;
  selectedDest: ConnectionPoint | null;
  selectSource: (point: ConnectionPoint | null) => void;
  selectDest: (point: ConnectionPoint | null) => void;
  clearSelection: () => void;

  // Preview route
  previewRoute: Route | null;
  setPreviewRoute: (route: Route | null) => void;

  // Connection points list
  connectionPoints: ConnectionPoint[];
  addConnectionPoint: (point: ConnectionPoint) => void;
  removeConnectionPoint: (pointId: string) => void;
  clearConnectionPoints: () => void;

  // Current route type for new routes
  currentRouteType: 'pipe' | 'electrical' | 'cable_tray' | 'conduit';
  setCurrentRouteType: (type: 'pipe' | 'electrical' | 'cable_tray' | 'conduit') => void;

  // Optimization mode
  optimizationMode: 'shortest' | 'safest' | 'aesthetic';
  setOptimizationMode: (mode: 'shortest' | 'safest' | 'aesthetic') => void;

  // Active routes
  activeRoutes: Route[];
  addRoute: (route: Route) => void;
  removeRoute: (routeId: string) => void;
  clearRoutes: () => void;

  // Selected route for editing
  selectedRoute: Route | null;
  selectRoute: (route: Route | null) => void;

  // Validation results
  validationResults: Map<string, EnhancedValidationResult>;
  setValidationResult: (routeId: string, result: EnhancedValidationResult) => void;
  clearValidationResults: () => void;
}

/**
 * Routing store using Zustand
 */
export const useRoutingStore = create<RoutingState>((set, get) => ({
  // Initial state
  routingMode: 'off',
  setRoutingMode: (mode) => set({ routingMode: mode }),

  selectedSource: null,
  selectedDest: null,
  selectSource: (point) => {
    set({ selectedSource: point });
    // If both source and dest are selected, automatically enter routing mode
    if (point && get().selectedDest) {
      set({ routingMode: 'selecting_dest' });
    } else if (point) {
      set({ routingMode: 'selecting_source' });
    }
  },
  selectDest: (point) => {
    set({ selectedDest: point });
    // If both source and dest are selected, automatically enter routing mode
    if (point && get().selectedSource) {
      set({ routingMode: 'selecting_dest' });
    } else if (point) {
      set({ routingMode: 'selecting_dest' });
    }
  },
  clearSelection: () => {
    set({
      selectedSource: null,
      selectedDest: null,
      previewRoute: null,
      routingMode: 'off',
    });
  },

  previewRoute: null,
  setPreviewRoute: (route) => set({ previewRoute: route }),

  connectionPoints: [],
  addConnectionPoint: (point) => {
    const current = get().connectionPoints;
    if (!current.find((p) => p.getId() === point.getId())) {
      set({ connectionPoints: [...current, point] });
    }
  },
  removeConnectionPoint: (pointId) => {
    set({
      connectionPoints: get().connectionPoints.filter((p) => p.getId() !== pointId),
    });
    // Clear selection if removed point was selected
    const state = get();
    if (state.selectedSource?.getId() === pointId) {
      set({ selectedSource: null });
    }
    if (state.selectedDest?.getId() === pointId) {
      set({ selectedDest: null });
    }
  },
  clearConnectionPoints: () => {
    set({
      connectionPoints: [],
      selectedSource: null,
      selectedDest: null,
      previewRoute: null,
    });
  },

  currentRouteType: 'pipe',
  setCurrentRouteType: (type) => set({ currentRouteType: type }),

  optimizationMode: 'shortest',
  setOptimizationMode: (mode) => set({ optimizationMode: mode }),

  activeRoutes: [],
  addRoute: (route) => {
    const current = get().activeRoutes;
    if (!current.find((r) => r.getId() === route.getId())) {
      set({ activeRoutes: [...current, route] });
    }
  },
  removeRoute: (routeId) => {
    set({
      activeRoutes: get().activeRoutes.filter((r) => r.getId() !== routeId),
    });
  },
  clearRoutes: () => {
    set({ activeRoutes: [] });
  },

  // Selected route for editing
  selectedRoute: null,
  selectRoute: (route) => set({ selectedRoute: route }),

  // Validation results
  validationResults: new Map<string, EnhancedValidationResult>(),
  setValidationResult: (routeId, result) => {
    const current = get().validationResults;
    const updated = new Map(current);
    updated.set(routeId, result);
    set({ validationResults: updated });
  },
  clearValidationResults: () => set({ validationResults: new Map() }),
}));

