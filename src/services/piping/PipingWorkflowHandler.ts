// Piping Workflow Handler - Handles viewport interactions for Factory Piping
// Owner: Agent 1 (George) - Architecture Lead
// Manages click-to-place nodes and Shift+click segment creation

import * as BABYLON from '@babylonjs/core';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import { getDefaultDiameter } from '../../domain/factoryServices/piping/pipingRules';
import { useEditorStore } from '../../ui/store/editorStore';
import { PipingSceneService } from './PipingSceneService';
import { isPipingDebugElevationEnabled, logPipingDebug } from './pipingDebug';

/**
 * Handles piping workflow interactions in the viewport
 */
export class PipingWorkflowHandler {
  private scene: BABYLON.Scene | null = null;
  private pipingSceneService: PipingSceneService | null = null;
  private pendingSourceNodeId: string | null = null;

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

    const floorPoint = pickInfo.pickedPoint.clone();
    const nodePosition = this.resolveNodePositionFromHit(floorPoint);

    // Create node at picked point
    const node = pipingStore.createNode(activeNetwork.id, {
      position: {
        x: nodePosition.x,
        y: nodePosition.y,
        z: nodePosition.z,
      },
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

    logPipingDebug('Created piping node', {
      nodeId: node.id,
      networkId: activeNetwork.id,
      floorPoint: this.vectorToLog(floorPoint),
      nodePosition: this.vectorToLog(nodePosition),
    });

    this.publishElevationDebug(floorPoint, nodePosition);
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

  private resolveNodePositionFromHit(hitPoint: BABYLON.Vector3): BABYLON.Vector3 {
    const resolvedPoint = hitPoint.clone();
    logPipingDebug('Applying placement elevation offset', {
      mode: 'direct-hit',
      floorPoint: this.vectorToLog(hitPoint),
      resolvedPoint: this.vectorToLog(resolvedPoint),
    });
    return resolvedPoint;
  }

  private vectorToLog(vec: BABYLON.Vector3): Record<string, number> {
    return {
      x: Number(vec.x.toFixed(3)),
      y: Number(vec.y.toFixed(3)),
      z: Number(vec.z.toFixed(3)),
    };
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
