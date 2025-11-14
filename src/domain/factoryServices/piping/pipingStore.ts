// Factory Piping System - Domain Store
// Owner: Agent 1 (George) - Architecture Lead
// Framework-agnostic state management (can be used with or without React)

import {
  PipingNetwork,
  PipingNode,
  PipingSegment,
  PipingSelection,
  PipingPlacementSettings,
  PipingPlacementMode,
  CreateNetworkConfig,
  CreateNodeConfig,
  CreateSegmentConfig,
} from './pipingTypes';
import {
  PIPING_DEFAULT_PLACEMENT_SETTINGS,
  PIPING_PLACEMENT_STORAGE_KEY,
} from './pipingDefaults';

/**
 * Change listener callback type
 */
type ChangeListener = () => void;

type PlacementSettingsUpdate = Partial<PipingPlacementSettings> & {
  defaultElevation?: number;
};

/**
 * Framework-agnostic piping store
 * Provides CRUD operations and selection state
 * Can be integrated with React, Vue, or used standalone
 */
class PipingStore {
  private networks: Map<string, PipingNetwork> = new Map();
  private selection: PipingSelection = {
    networkId: null,
    nodeId: null,
    segmentId: null,
  };
  private listeners: Set<ChangeListener> = new Set();
  private nextId = 1;
  private placementSettings: PipingPlacementSettings =
    this.loadPlacementSettings();

  // ============================================================================
  // SUBSCRIPTION API
  // ============================================================================

  /**
   * Subscribe to changes in the store
   * @returns Unsubscribe function
   */
  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  // ============================================================================
  // NETWORK CRUD
  // ============================================================================

  /**
   * Create a new piping network
   */
  createNetwork(config: CreateNetworkConfig): PipingNetwork {
    const network: PipingNetwork = {
      id: this.generateId('network'),
      name: config.name,
      serviceType: config.serviceType,
      nodes: [],
      segments: [],
      meta: config.meta,
    };

    this.networks.set(network.id, network);
    this.notify();
    return network;
  }

  /**
   * Get a network by ID
   */
  getNetwork(id: string): PipingNetwork | undefined {
    return this.networks.get(id);
  }

  /**
   * Get all networks
   */
  getAllNetworks(): PipingNetwork[] {
    return Array.from(this.networks.values());
  }

  /**
   * Update a network's properties
   */
  updateNetwork(
    id: string,
    updates: Partial<Pick<PipingNetwork, 'name' | 'serviceType' | 'meta'>>
  ): boolean {
    const network = this.networks.get(id);
    if (network === undefined) {
      return false;
    }

    const updated = { ...network, ...updates };
    this.networks.set(id, updated);
    this.notify();
    return true;
  }

  /**
   * Delete a network and all its nodes and segments
   */
  deleteNetwork(id: string): boolean {
    const existed = this.networks.delete(id);
    if (existed) {
      // Clear selection if this network was selected
      if (this.selection.networkId === id) {
        this.clearSelection();
      }
      this.notify();
    }
    return existed;
  }

  // ============================================================================
  // NODE CRUD
  // ============================================================================

  /**
   * Create a node in a network
   */
  createNode(networkId: string, config: CreateNodeConfig): PipingNode | null {
    const network = this.networks.get(networkId);
    if (network === undefined) {
      return null;
    }

    const node: PipingNode = {
      id: this.generateId('node'),
      name: config.name,
      position: { ...config.position },
      kind: config.kind,
      serviceType: config.serviceType,
      meta: config.meta,
    };

    network.nodes.push(node);
    this.notify();
    return node;
  }

  /**
   * Get a node by ID across all networks
   */
  getNode(nodeId: string): PipingNode | undefined {
    const networks = Array.from(this.networks.values());
    for (const network of networks) {
      const node = network.nodes.find((n) => n.id === nodeId);
      if (node !== undefined) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Update a node's properties
   */
  updateNode(
    nodeId: string,
    updates: Partial<
      Pick<PipingNode, 'name' | 'position' | 'kind' | 'serviceType' | 'meta'>
    >
  ): boolean {
    const networks = Array.from(this.networks.values());
    for (const network of networks) {
      const nodeIndex = network.nodes.findIndex((n) => n.id === nodeId);
      if (nodeIndex !== -1) {
        network.nodes[nodeIndex] = { ...network.nodes[nodeIndex], ...updates };
        this.notify();
        return true;
      }
    }
    return false;
  }

  /**
   * Delete a node from a network
   * Also deletes all segments connected to this node
   */
  deleteNode(nodeId: string): boolean {
    const networks = Array.from(this.networks.values());
    for (const network of networks) {
      const nodeIndex = network.nodes.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) {
        continue;
      }

      // Remove the node
      network.nodes.splice(nodeIndex, 1);

      // Remove all segments connected to this node
      network.segments = network.segments.filter(
        (seg) => seg.fromNodeId !== nodeId && seg.toNodeId !== nodeId
      );

      // Clear selection if this node was selected
      if (this.selection.nodeId === nodeId) {
        this.selection.nodeId = null;
      }

      this.notify();
      return true;
    }
    return false;
  }

  // ============================================================================
  // SEGMENT CRUD
  // ============================================================================

  /**
   * Create a segment in a network
   */
  createSegment(
    networkId: string,
    config: CreateSegmentConfig
  ): PipingSegment | null {
    const network = this.networks.get(networkId);
    if (network === undefined) {
      return null;
    }

    // Validate that both nodes exist
    const fromNode = network.nodes.find((n) => n.id === config.fromNodeId);
    const toNode = network.nodes.find((n) => n.id === config.toNodeId);

    if (fromNode === undefined || toNode === undefined) {
      return null;
    }

    const segment: PipingSegment = {
      id: this.generateId('segment'),
      fromNodeId: config.fromNodeId,
      toNodeId: config.toNodeId,
      nominalDiameterMm: config.nominalDiameterMm,
      schedule: config.schedule,
      hasInsulation: config.hasInsulation ?? false,
      slopePerMille: config.slopePerMille,
      fittingHints: config.fittingHints,
    };

    network.segments.push(segment);
    this.notify();
    return segment;
  }

  /**
   * Get a segment by ID across all networks
   */
  getSegment(segmentId: string): PipingSegment | undefined {
    const networks = Array.from(this.networks.values());
    for (const network of networks) {
      const segment = network.segments.find((s) => s.id === segmentId);
      if (segment !== undefined) {
        return segment;
      }
    }
    return undefined;
  }

  /**
   * Update a segment's properties
   */
  updateSegment(
    segmentId: string,
    updates: Partial<
      Pick<
        PipingSegment,
        | 'nominalDiameterMm'
        | 'schedule'
        | 'hasInsulation'
        | 'slopePerMille'
        | 'fittingHints'
      >
    >
  ): boolean {
    const networks = Array.from(this.networks.values());
    for (const network of networks) {
      const segmentIndex = network.segments.findIndex(
        (s) => s.id === segmentId
      );
      if (segmentIndex !== -1) {
        network.segments[segmentIndex] = {
          ...network.segments[segmentIndex],
          ...updates,
        };
        this.notify();
        return true;
      }
    }
    return false;
  }

  /**
   * Delete a segment from a network
   */
  deleteSegment(segmentId: string): boolean {
    const networks = Array.from(this.networks.values());
    for (const network of networks) {
      const segmentIndex = network.segments.findIndex(
        (s) => s.id === segmentId
      );
      if (segmentIndex === -1) {
        continue;
      }

      network.segments.splice(segmentIndex, 1);

      // Clear selection if this segment was selected
      if (this.selection.segmentId === segmentId) {
        this.selection.segmentId = null;
      }

      this.notify();
      return true;
    }
    return false;
  }

  // ============================================================================
  // SELECTION API
  // ============================================================================

  /**
   * Set the active network
   */
  setActiveNetwork(networkId: string | null): void {
    this.selection.networkId = networkId;
    this.notify();
  }

  /**
   * Set the selected node
   */
  setSelectedNode(nodeId: string | null): void {
    this.selection.nodeId = nodeId;
    this.notify();
  }

  /**
   * Set the selected segment
   */
  setSelectedSegment(segmentId: string | null): void {
    this.selection.segmentId = segmentId;
    this.notify();
  }

  /**
   * Get current selection
   */
  getSelection(): PipingSelection {
    return { ...this.selection };
  }

  /**
   * Clear all selection
   */
  clearSelection(): void {
    this.selection = {
      networkId: null,
      nodeId: null,
      segmentId: null,
    };
    this.notify();
  }

  // ============================================================================
  // PLACEMENT SETTINGS
  // ============================================================================

  /**
   * Get the current placement settings
   */
  getPlacementSettings(): PipingPlacementSettings {
    return { ...this.placementSettings };
  }

  /**
   * Convenience selector for placement mode
   */
  getPlacementMode(): PipingPlacementMode {
    return selectCurrentPlacementMode(this.placementSettings);
  }

  /**
   * Convenience selector for default elevation along Z
   */
  getDefaultElevationZ(): number {
    return selectDefaultElevationZ(this.placementSettings);
  }

  /**
   * Resolve the elevation that should be used for the next placement
   */
  getEffectivePlacementElevation(floorZ: number | null): number {
    return selectEffectiveElevationZ(this.placementSettings, floorZ);
  }

  /**
   * Expose current snap reference Z (mostly for debugging/tests)
   */
  getSnapReferenceZ(): number | null {
    return this.placementSettings.snapReferenceZ;
  }

  /**
   * Set placement mode with validation
   */
  setPlacementMode(mode: PipingPlacementMode): void {
    if (this.isValidPlacementMode(mode) === false) {
      return;
    }

    this.applyPlacementSettings({ mode });
  }

  /**
   * Set the default elevation used by elevation modes
   */
  setDefaultElevationZ(elevationZ: number): void {
    if (Number.isFinite(elevationZ) === false) {
      return;
    }

    const clamped = Math.max(0, elevationZ);
    this.applyPlacementSettings({ defaultElevationZ: clamped });
  }

  /**
   * Set or clear the snap reference elevation
   */
  setSnapReferenceZ(z: number | null): void {
    if (z === null) {
      this.applyPlacementSettings({ snapReferenceZ: null });
      return;
    }

    if (Number.isFinite(z) === false) {
      return;
    }

    this.applyPlacementSettings({ snapReferenceZ: z });
  }

  /**
   * Reset placement settings back to defaults
   */
  resetPlacementSettings(): void {
    this.applyPlacementSettings(this.cloneDefaultPlacementSettings());
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get the network containing a specific node
   */
  getNetworkForNode(nodeId: string): PipingNetwork | undefined {
    const networks = Array.from(this.networks.values());
    for (const network of networks) {
      if (network.nodes.some((n) => n.id === nodeId)) {
        return network;
      }
    }
    return undefined;
  }

  /**
   * Get the network containing a specific segment
   */
  getNetworkForSegment(segmentId: string): PipingNetwork | undefined {
    const networks = Array.from(this.networks.values());
    for (const network of networks) {
      if (network.segments.some((s) => s.id === segmentId)) {
        return network;
      }
    }
    return undefined;
  }

  /**
   * Get all segments connected to a node
   */
  getConnectedSegments(nodeId: string): PipingSegment[] {
    const segments: PipingSegment[] = [];
    const networks = Array.from(this.networks.values());
    for (const network of networks) {
      const connectedSegments = network.segments.filter(
        (s) => s.fromNodeId === nodeId || s.toNodeId === nodeId
      );
      segments.push(...connectedSegments);
    }
    return segments;
  }

  /**
   * Clear all data (useful for testing or reset)
   */
  clear(): void {
    this.networks.clear();
    this.selection = {
      networkId: null,
      nodeId: null,
      segmentId: null,
    };
    this.placementSettings = this.cloneDefaultPlacementSettings();
    this.persistPlacementSettings(this.placementSettings);
    this.notify();
  }

  private generateId(prefix: string): string {
    return `${prefix}_${this.nextId++}_${Date.now()}`;
  }

  private applyPlacementSettings(update: PlacementSettingsUpdate): void {
    const next = this.normalizePlacementSettings({
      ...this.placementSettings,
      ...update,
    });

    if (this.havePlacementSettingsChanged(next) === false) {
      return;
    }

    this.placementSettings = next;
    this.persistPlacementSettings(next);
    this.notify();
  }

  private cloneDefaultPlacementSettings(): PipingPlacementSettings {
    return { ...PIPING_DEFAULT_PLACEMENT_SETTINGS };
  }

  private loadPlacementSettings(): PipingPlacementSettings {
    const stored = this.readPlacementSettingsFromStorage();
    if (stored !== null) {
      return stored;
    }

    return this.cloneDefaultPlacementSettings();
  }

  private readPlacementSettingsFromStorage(): PipingPlacementSettings | null {
    const storage = this.getStorage();
    if (storage === null) {
      return null;
    }

    const raw = storage.getItem(PIPING_PLACEMENT_STORAGE_KEY);
    if (raw === null) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PlacementSettingsUpdate;
      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }

      return this.normalizePlacementSettings({
        ...PIPING_DEFAULT_PLACEMENT_SETTINGS,
        ...parsed,
      });
    } catch {
      return null;
    }
  }

  private normalizePlacementSettings(
    settings: PlacementSettingsUpdate
  ): PipingPlacementSettings {
    const mode = this.isValidPlacementMode(settings.mode)
      ? settings.mode
      : PIPING_DEFAULT_PLACEMENT_SETTINGS.mode;

    const elevationSource =
      settings.defaultElevationZ ?? settings.defaultElevation;

    const defaultElevationZ = Number.isFinite(elevationSource)
      ? Math.max(0, elevationSource as number)
      : PIPING_DEFAULT_PLACEMENT_SETTINGS.defaultElevationZ;

    const snapCandidate =
      settings.snapReferenceZ === undefined
        ? PIPING_DEFAULT_PLACEMENT_SETTINGS.snapReferenceZ
        : settings.snapReferenceZ;

    const snapReferenceZ =
      typeof snapCandidate === 'number' && Number.isFinite(snapCandidate)
        ? snapCandidate
        : null;

    return {
      mode,
      defaultElevationZ,
      snapReferenceZ,
    };
  }

  private havePlacementSettingsChanged(
    next: PipingPlacementSettings
  ): boolean {
    return (
      next.mode !== this.placementSettings.mode ||
      next.defaultElevationZ !== this.placementSettings.defaultElevationZ ||
      next.snapReferenceZ !== this.placementSettings.snapReferenceZ
    );
  }

  private isValidPlacementMode(mode: string): mode is PipingPlacementMode {
    if (mode === 'on_floor') {
      return true;
    }

    if (mode === 'at_elevation') {
      return true;
    }

    if (mode === 'snap_to_existing') {
      return true;
    }

    return false;
  }

  private persistPlacementSettings(
    settings: PipingPlacementSettings
  ): void {
    const storage = this.getStorage();
    if (storage === null) {
      return;
    }

    try {
      storage.setItem(
        PIPING_PLACEMENT_STORAGE_KEY,
        JSON.stringify(settings)
      );
    } catch {
      // Ignore storage errors (Safari private mode, etc.)
    }
  }

  private getStorage(): Storage | null {
    if (typeof globalThis === 'undefined') {
      return null;
    }

    try {
      const scopedGlobal = globalThis as { localStorage?: Storage };
      return scopedGlobal.localStorage ?? null;
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const pipingStore = new PipingStore();

function selectCurrentPlacementMode(
  settings: PipingPlacementSettings
): PipingPlacementMode {
  return settings.mode;
}

function selectDefaultElevationZ(
  settings: PipingPlacementSettings
): number {
  return settings.defaultElevationZ;
}

function selectEffectiveElevationZ(
  settings: PipingPlacementSettings,
  floorZ: number | null
): number {
  if (settings.mode === 'on_floor') {
    if (isFiniteNumber(floorZ)) {
      return floorZ;
    }
    return 0;
  }

  if (settings.mode === 'at_elevation') {
    return settings.defaultElevationZ;
  }

  if (settings.mode === 'snap_to_existing') {
    if (isFiniteNumber(settings.snapReferenceZ)) {
      return settings.snapReferenceZ;
    }
    if (isFiniteNumber(floorZ)) {
      return floorZ;
    }
    return settings.defaultElevationZ;
  }

  return settings.defaultElevationZ;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export {
  selectCurrentPlacementMode as getCurrentPlacementMode,
  selectDefaultElevationZ as getDefaultElevationZ,
  selectEffectiveElevationZ as getEffectiveElevationZ,
};
