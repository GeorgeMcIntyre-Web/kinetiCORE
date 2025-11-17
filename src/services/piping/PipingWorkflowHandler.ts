// Piping Workflow Handler - Handles viewport interactions for Factory Piping
// Owner: Agent 1 (George) - Architecture Lead
// Manages click-to-place nodes and Shift+click segment creation

import * as BABYLON from '@babylonjs/core';
import { Vector3 } from '../../core/types';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import { getDefaultDiameter } from '../../domain/factoryServices/piping/pipingRules';
import {
  PipingNetwork,
  PipingNode,
  PipingServiceType,
  Position3D,
} from '../../domain/factoryServices/piping/pipingTypes';
import { useEditorStore } from '../../ui/store/editorStore';
import {
  ElevationRuleOptions,
  ElevationValidationResult,
  evaluateElevationProfile,
} from '../../routing/validation/RouteValidator';
import { PipingSceneService } from './PipingSceneService';
import { resolvePipingHitForPlacement } from './pipingPlacementResolver';

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
   *
   * Multi-floor guidance:
   * - Use the exact mesh hit so sloped or raised surfaces remain accurate.
   * - FUTURE WORK: tag mezzanine meshes with metadata to adjust placementSettings.defaultFloorHeight dynamically.
   * - FUTURE WORK: persist per-network default floor heights for facilities with multiple deck levels.
   */
  private handleNodePlacement(pointerInfo: BABYLON.PointerInfo): void {
    const placementDecision = resolvePipingHitForPlacement({
      pickInfo: pointerInfo.pickInfo ?? null,
      pickResolver: this.pipingSceneService,
      placementSettings: useEditorStore.getState().pipingPlacementSettings,
    });

    if (placementDecision.kind === 'no-placement') {
      console.debug('[PipingWorkflowHandler] Skipped node placement:', placementDecision.reason);
      return;
    }

    if (placementDecision.kind === 'snap-to-node') {
      pipingStore.setSelectedNode(placementDecision.nodeId);
      pipingStore.setSelectedSegment(null);
      console.debug('[PipingWorkflowHandler] Snapped to existing node:', placementDecision.nodeId);
      return;
    }

    const activeNetwork = this.getOrCreateActiveNetwork();
    if (!activeNetwork) {
      console.error('[PipingWorkflowHandler] Unable to resolve active network for placement');
      return;
    }

    this.createNodeAtPosition(activeNetwork, placementDecision.position);
  }

  private getOrCreateActiveNetwork(): PipingNetwork | null {
    const selection = pipingStore.getSelection();
    if (selection.networkId) {
      const selectedNetwork = pipingStore.getNetwork(selection.networkId);
      if (selectedNetwork) {
        return selectedNetwork;
      }
    }

    const networks = pipingStore.getAllNetworks();
    if (networks.length > 0) {
      const firstNetwork = networks[0];
      pipingStore.setActiveNetwork(firstNetwork.id);
      return firstNetwork;
    }

    const createdNetwork = pipingStore.createNetwork({
      name: 'Water Network 1',
      serviceType: 'water',
    });

    if (!createdNetwork) {
      return null;
    }

    pipingStore.setActiveNetwork(createdNetwork.id);
    return createdNetwork;
  }

  private createNodeAtPosition(network: PipingNetwork, position: Position3D): void {
    const node = pipingStore.createNode(network.id, {
      position,
      kind: 'endpoint',
      serviceType: network.serviceType,
    });

    if (!node) {
      console.error('[PipingWorkflowHandler] Failed to create node for network:', network.id);
      return;
    }

    console.log('[PipingWorkflowHandler] Created node:', node.id, 'at', position);
  }

  private validateSegmentElevation(
    sourceNode: PipingNode,
    destinationNode: PipingNode
  ): ElevationValidationResult {
    const options = this.getElevationOptionsForService(sourceNode.serviceType);
    const points: Vector3[] = [{ ...sourceNode.position }, { ...destinationNode.position }];
    return evaluateElevationProfile(points, options);
  }

  private getElevationOptionsForService(serviceType: PipingServiceType): ElevationRuleOptions {
    const baseOptions: ElevationRuleOptions = {
      maxElevationDelta: 2.5,
      maxElevationSpan: 8,
      allowMixedElevation: true,
      minNodeCount: 2,
      minNodesForMixedElevation: 2,
      floorSnapTolerance: 0.05,
    };

    if (serviceType === 'steam') {
      return {
        ...baseOptions,
        maxElevationDelta: 1.25,
        maxElevationSpan: 4,
      };
    }

    if (serviceType === 'cable_tray') {
      return {
        ...baseOptions,
        maxElevationDelta: 1.0,
        maxElevationSpan: 3,
      };
    }

    return baseOptions;
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
    console.log('[PipingWorkflowHandler] Selected source node for segment:', pickResult.id);

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

    const pickResult = this.pipingSceneService.handlePick(pointerInfo.pickInfo.pickedMesh);

    if (pickResult.type !== 'node') {
      // Clicked on non-node while in segment creation mode - cancel
      this.cancelPendingOperation();
      return;
    }

    if (pickResult.id === null) {
      return;
    }

    const sourceNodeId = this.pendingSourceNodeId;
    const destNodeId = pickResult.id;

    if (!sourceNodeId || !destNodeId) {
      return;
    }

    // Don't allow segment to same node
    if (sourceNodeId === destNodeId) {
      console.warn('[PipingWorkflowHandler] Cannot create segment to same node');
      this.cancelPendingOperation();
      return;
    }

    // Find the network containing the source node
    const network = pipingStore.getNetworkForNode(sourceNodeId);
    if (!network) {
      console.error('[PipingWorkflowHandler] Source node network not found');
      this.cancelPendingOperation();
      return;
    }

      // Get source node to determine service type
      const sourceNode = pipingStore.getNode(sourceNodeId);
      if (!sourceNode) {
        console.error('[PipingWorkflowHandler] Source node not found');
        this.cancelPendingOperation();
        return;
      }

      const destinationNode = pipingStore.getNode(destNodeId);
      if (!destinationNode) {
        console.error('[PipingWorkflowHandler] Destination node not found');
        this.cancelPendingOperation();
        return;
      }

      const elevationValidation = this.validateSegmentElevation(sourceNode, destinationNode);
      if (elevationValidation.status === 'ERROR') {
        console.warn(
          '[PipingWorkflowHandler] Segment rejected due to elevation rules:',
          elevationValidation.violations[0]?.message ?? 'Unknown violation'
        );
        this.cancelPendingOperation();
        return;
      }

      if (elevationValidation.status === 'WARNING') {
        console.warn(
          '[PipingWorkflowHandler] Elevation warning:',
          elevationValidation.violations[0]?.message ?? 'Check vertical run'
        );
      }

      // Create segment
      const segment = pipingStore.createSegment(network.id, {
        fromNodeId: sourceNodeId,
        toNodeId: destNodeId,
        nominalDiameterMm: getDefaultDiameter(sourceNode.serviceType),
        hasInsulation: false,
      });

    if (segment) {
      console.log('[PipingWorkflowHandler] Created segment:', segment.id);
    }

    // Clear pending operation
    this.cancelPendingOperation();
  }

  /**
   * Cancel any pending operations (like segment creation)
   */
  private cancelPendingOperation(): void {
    if (this.pendingSourceNodeId === null) {
      return;
    }

    console.log('[PipingWorkflowHandler] Cancelled pending segment creation');
    this.pendingSourceNodeId = null;

    // TODO: Clear visual feedback
  }

  /**
   * Get the current pending source node ID (if any)
   */
  getPendingSourceNodeId(): string | null {
    return this.pendingSourceNodeId;
  }

}
