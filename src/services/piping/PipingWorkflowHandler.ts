// Piping Workflow Handler - Handles viewport interactions for Factory Piping
// Owner: Agent 1 (George) - Architecture Lead
// Manages click-to-place nodes and Shift+click segment creation

import * as BABYLON from '@babylonjs/core';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import { getDefaultDiameter } from '../../domain/factoryServices/piping/pipingRules';
import { useEditorStore } from '../../ui/store/editorStore';
import { PipingSceneService } from './PipingSceneService';
import { isPipingDebugElevationEnabled, logPipingDebug } from './pipingDebug';
import { computePlacementPosition } from '../../domain/factoryServices/piping/pipingPlacement';
import { PipingNode, Position3D } from '../../domain/factoryServices/piping/pipingTypes';
import { babylonToDomainPosition, domainToBabylonVector } from './pipingCoordinates';

/**
 * Handles piping workflow interactions in the viewport
 */
export class PipingWorkflowHandler {
  private scene: BABYLON.Scene | null = null;
  private pipingSceneService: PipingSceneService | null = null;
  private pendingSourceNodeId: string | null = null;
  private static readonly SNAP_DISTANCE_METERS = 0.25;

  /**
   * Initialize the handler with scene and piping scene service
   */
  initialize(scene: BABYLON.Scene, pipingSceneService: PipingSceneService): void {
    this.scene = scene;
    this.pipingSceneService = pipingSceneService;
    this.setupSceneListeners();
    this.setupKeyboardListeners();
  }

  /**
   * Stop the handler and clean up
   */
  dispose(): void {
    this.pendingSourceNodeId = null;
    this.clearElevationDebugOverlay();
    // Note: Scene listeners are automatically cleaned up when scene is disposed
  }

  /**
   * Setup scene pointer listeners
   */
  private setupSceneListeners(): void {
    if (!this.scene) {
      return;
    }

    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) {
        return;
      }

      const pipingModeEnabled = useEditorStore.getState().pipingModeEnabled;
      if (!pipingModeEnabled) {
        return;
      }

      // Check if shift is pressed
      const shiftPressed = pointerInfo.event.shiftKey;

      if (shiftPressed) {
        this.handleShiftClick(pointerInfo);
        return;
      }

      // Normal click - either create node or complete segment
      if (this.pendingSourceNodeId !== null) {
        this.handleSegmentDestinationClick(pointerInfo);
        return;
      }

      this.handleNodePlacement(pointerInfo);
    });
  }

  /**
   * Setup keyboard listeners for ESC key to cancel pending operations
   */
  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') {
        return;
      }

      const pipingModeEnabled = useEditorStore.getState().pipingModeEnabled;
      if (!pipingModeEnabled) {
        return;
      }

      this.cancelPendingOperation();
    });
  }

  /**
   * Handle normal click to place a new node
   */
  private handleNodePlacement(pointerInfo: BABYLON.PointerInfo): void {
    const pickInfo = pointerInfo.pickInfo;
    if (!pickInfo) {
      logPipingDebug('Pointer pick info missing; skipping node placement');
      this.clearElevationDebugOverlay();
      return;
    }

    if (!pickInfo.pickedPoint) {
      logPipingDebug('Pointer pick missing hit point', {
        mesh: pickInfo.pickedMesh?.name ?? 'unknown',
      });
      this.clearElevationDebugOverlay();
      return;
    }

    logPipingDebug('Pointer hit recorded for piping placement', {
      mesh: pickInfo.pickedMesh?.name ?? 'unknown',
      point: this.vectorToLog(pickInfo.pickedPoint),
    });

    // Get or create default network
    const networks = pipingStore.getAllNetworks();
    let activeNetwork = networks.length > 0 ? networks[0] : null;

    if (!activeNetwork) {
      // Create default water network
      activeNetwork = pipingStore.createNetwork({
        name: 'Water Network 1',
        serviceType: 'water',
      });

      logPipingDebug('Created fallback piping network for placement', {
        networkId: activeNetwork.id,
        serviceType: activeNetwork.serviceType,
      });
    }

    if (!activeNetwork) {
      console.error('[PipingWorkflowHandler] Failed to create default network');
      logPipingDebug('Failed to create default piping network');
      this.clearElevationDebugOverlay();
      return;
    }

    const surfacePoint = pickInfo.pickedPoint.clone();
    const surfacePointDomain = babylonToDomainPosition(surfacePoint);
    const placementSettings = pipingStore.getPlacementSettings();

    const snapCandidate =
      placementSettings.mode === 'snap'
        ? this.findSnapCandidate(surfacePointDomain, activeNetwork.nodes)
        : null;

    let placementResult;
    try {
      placementResult = computePlacementPosition(placementSettings, {
        floorPoint: surfacePointDomain,
        pointerPoint: surfacePointDomain,
        snapCandidate,
      });
    } catch (error) {
      logPipingDebug('Failed to resolve placement position', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.clearElevationDebugOverlay();
      return;
    }

    const node = pipingStore.createNode(activeNetwork.id, {
      position: placementResult.position,
      kind: 'endpoint',
      serviceType: activeNetwork.serviceType,
    });

    if (!node) {
      logPipingDebug('Piping node creation failed', {
        networkId: activeNetwork.id,
      });
      this.clearElevationDebugOverlay();
      return;
    }

    const floorForOverlay =
      placementResult.floorPoint !== null
        ? domainToBabylonVector(placementResult.floorPoint)
        : surfacePoint;
    const nodeOverlayPoint = domainToBabylonVector(placementResult.position);

    logPipingDebug('Created piping node', {
      nodeId: node.id,
      networkId: activeNetwork.id,
      requestedMode: placementSettings.mode,
      appliedMode: placementResult.appliedMode,
      fallback: placementResult.fallback,
      floorPoint: placementResult.floorPoint
        ? this.positionToLog(placementResult.floorPoint)
        : null,
      nodePosition: this.positionToLog(placementResult.position),
      snappedNodeId: placementResult.snappedNodeId,
    });

    this.publishElevationDebug(floorForOverlay, nodeOverlayPoint);
  }

  /**
   * Handle Shift+click on a node to start segment creation
   */
  private handleShiftClick(pointerInfo: BABYLON.PointerInfo): void {
    if (!pointerInfo.pickInfo?.pickedMesh || !this.pipingSceneService) {
      return;
    }

    // Check if we clicked on a piping node
    const pickResult = this.pipingSceneService.handlePick(pointerInfo.pickInfo.pickedMesh);

    if (pickResult.type !== 'node') {
      // Shift+click on non-node - ignore
      return;
    }

    if (pickResult.id === null) {
      return;
    }

    // Set this node as the pending source
    this.pendingSourceNodeId = pickResult.id;
    logPipingDebug('Selected source node for segment creation', {
      nodeId: pickResult.id,
    });

    // TODO: Show visual feedback that we're in "creating segment" mode
    // Could highlight the source node or show a line preview
  }

  /**
   * Handle click on destination node to complete segment creation
   */
  private handleSegmentDestinationClick(pointerInfo: BABYLON.PointerInfo): void {
    if (!pointerInfo.pickInfo?.pickedMesh || !this.pipingSceneService) {
      return;
    }

    const pickResult = this.pipingSceneService.handlePick(
      pointerInfo.pickInfo.pickedMesh
    );

    if (pickResult.type !== 'node') {
      logPipingDebug('Destination click ignored (not a piping node)', {
        mesh: pointerInfo.pickInfo?.pickedMesh?.name ?? 'unknown',
      });
      this.cancelPendingOperation();
      return;
    }

    if (pickResult.id === null) {
      logPipingDebug('Destination pick missing node id');
      return;
    }

    const sourceNodeId = this.pendingSourceNodeId;
    const destNodeId = pickResult.id;

    if (!sourceNodeId || !destNodeId) {
      return;
    }

    if (sourceNodeId === destNodeId) {
      console.warn('[PipingWorkflowHandler] Cannot create segment to same node');
      this.cancelPendingOperation();
      logPipingDebug('Blocked segment self-loop', { nodeId: sourceNodeId });
      return;
    }

    const network = pipingStore.getNetworkForNode(sourceNodeId);
    if (!network) {
      console.error('[PipingWorkflowHandler] Source node network not found');
      logPipingDebug('Source node network missing', { nodeId: sourceNodeId });
      this.cancelPendingOperation();
      return;
    }

    const sourceNode = pipingStore.getNode(sourceNodeId);
    if (!sourceNode) {
      console.error('[PipingWorkflowHandler] Source node not found');
      logPipingDebug('Source node missing during segment creation', {
        nodeId: sourceNodeId,
      });
      this.cancelPendingOperation();
      return;
    }

    const segment = pipingStore.createSegment(network.id, {
      fromNodeId: sourceNodeId,
      toNodeId: destNodeId,
      nominalDiameterMm: getDefaultDiameter(sourceNode.serviceType),
      hasInsulation: false,
    });

    if (segment) {
      logPipingDebug('Created piping segment', {
        segmentId: segment.id,
        fromNodeId: sourceNodeId,
        toNodeId: destNodeId,
      });
    }

    this.cancelPendingOperation();
  }

  /**
   * Cancel any pending operations (like segment creation)
   */
  private cancelPendingOperation(): void {
    if (this.pendingSourceNodeId === null) {
      return;
    }

    logPipingDebug('Cancelled pending segment creation', {
      nodeId: this.pendingSourceNodeId,
    });
    this.pendingSourceNodeId = null;

    // TODO: Clear visual feedback
  }

  /**
   * Get the current pending source node ID (if any)
   */
  getPendingSourceNodeId(): string | null {
    return this.pendingSourceNodeId;
  }

  private vectorToLog(vec: BABYLON.Vector3): Record<string, number> {
    return {
      x: Number(vec.x.toFixed(3)),
      y: Number(vec.y.toFixed(3)),
      z: Number(vec.z.toFixed(3)),
    };
  }

  private positionToLog(position: Position3D): Record<string, number> {
    return {
      x: Number(position.x.toFixed(3)),
      y: Number(position.y.toFixed(3)),
      z: Number(position.z.toFixed(3)),
    };
  }

  private findSnapCandidate(
    pointerPoint: Position3D,
    nodes: PipingNode[]
  ): PipingNode | null {
    let closestNode: PipingNode | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const node of nodes) {
      const distance = this.getDistance(pointerPoint, node.position);
      if (distance > PipingWorkflowHandler.SNAP_DISTANCE_METERS) {
        continue;
      }

      if (distance >= closestDistance) {
        continue;
      }

      closestNode = node;
      closestDistance = distance;
    }

    return closestNode;
  }

  private getDistance(a: Position3D, b: Position3D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private publishElevationDebug(
    floorPoint: BABYLON.Vector3,
    nodePoint: BABYLON.Vector3
  ): void {
    if (!this.pipingSceneService) {
      return;
    }

    if (isPipingDebugElevationEnabled() === false) {
      return;
    }

    this.pipingSceneService.showElevationDebug(floorPoint, nodePoint);
  }

  private clearElevationDebugOverlay(): void {
    if (!this.pipingSceneService) {
      return;
    }

    this.pipingSceneService.clearElevationDebug();
  }
}
