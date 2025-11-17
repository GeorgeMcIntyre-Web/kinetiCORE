// Piping Workflow Handler - Handles viewport interactions for Factory Piping
// Owner: Agent 1 (George) - Architecture Lead
// Manages click-to-place nodes and Shift+click segment creation

import * as BABYLON from '@babylonjs/core';
import { pipingStore } from '../../domain/factoryServices/piping/pipingStore';
import { getDefaultDiameter } from '../../domain/factoryServices/piping/pipingRules';
import { useEditorStore } from '../../ui/store/editorStore';
import { PipingSceneService } from './PipingSceneService';

/**
 * Handles piping workflow interactions in the viewport
 */
export class PipingWorkflowHandler {
  private scene: BABYLON.Scene | null = null;
  private pipingSceneService: PipingSceneService | null = null;
  private pendingSourceNodeId: string | null = null;
  private ghostPreviewMesh: BABYLON.Mesh | null = null;
  private elevationIndicator: BABYLON.Mesh | null = null;

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

    // Dispose preview meshes
    if (this.ghostPreviewMesh) {
      this.ghostPreviewMesh.dispose();
      this.ghostPreviewMesh = null;
    }
    if (this.elevationIndicator) {
      this.elevationIndicator.dispose();
      this.elevationIndicator = null;
    }

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
      const pipingModeEnabled = useEditorStore.getState().pipingModeEnabled;

      // Handle pointer move for ghost preview
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
        if (pipingModeEnabled && !this.pendingSourceNodeId) {
          this.updateGhostPreview(pointerInfo);
        } else {
          this.hideGhostPreview();
        }
        return;
      }

      if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) {
        return;
      }

      console.log('[PipingWorkflowHandler] Click detected. pipingModeEnabled:', pipingModeEnabled);

      if (!pipingModeEnabled) {
        return;
      }

      // Check if shift is pressed
      const shiftPressed = pointerInfo.event.shiftKey;
      console.log('[PipingWorkflowHandler] Shift pressed:', shiftPressed, 'Picked mesh:', pointerInfo.pickInfo?.pickedMesh?.name);

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
   * Update ghost preview mesh at cursor position
   */
  private updateGhostPreview(pointerInfo: BABYLON.PointerInfo): void {
    if (!this.scene || !pointerInfo.pickInfo?.pickedPoint) {
      this.hideGhostPreview();
      return;
    }

    const pickedPoint = pointerInfo.pickInfo.pickedPoint;
    const floorCandidate = pickedPoint.y;
    const elevation = pipingStore.getEffectivePlacementElevation(floorCandidate);

    // Create ghost preview if it doesn't exist
    if (!this.ghostPreviewMesh) {
      this.ghostPreviewMesh = BABYLON.MeshBuilder.CreateSphere(
        'pipingGhostPreview',
        { diameter: 0.15, segments: 8 },
        this.scene
      );

      const material = new BABYLON.StandardMaterial('ghostMaterial', this.scene);
      material.diffuseColor = new BABYLON.Color3(0.024, 0.714, 0.831); // Cyan
      material.alpha = 0.5;
      material.emissiveColor = new BABYLON.Color3(0.024, 0.714, 0.831);
      this.ghostPreviewMesh.material = material;
      this.ghostPreviewMesh.isPickable = false;
    }

    // Create elevation indicator plane if it doesn't exist
    if (!this.elevationIndicator) {
      this.elevationIndicator = BABYLON.MeshBuilder.CreateDisc(
        'elevationIndicator',
        { radius: 0.2, tessellation: 24 },
        this.scene
      );
      this.elevationIndicator.rotation.x = Math.PI / 2;

      const ringMaterial = new BABYLON.StandardMaterial('elevationRingMaterial', this.scene);
      ringMaterial.diffuseColor = new BABYLON.Color3(0.024, 0.714, 0.831);
      ringMaterial.alpha = 0.3;
      ringMaterial.emissiveColor = new BABYLON.Color3(0.024, 0.714, 0.831);
      this.elevationIndicator.material = ringMaterial;
      this.elevationIndicator.isPickable = false;
    }

    // Update positions
    this.ghostPreviewMesh.position.set(pickedPoint.x, elevation, pickedPoint.z);
    this.elevationIndicator.position.set(pickedPoint.x, elevation, pickedPoint.z);

    // Show the previews
    this.ghostPreviewMesh.setEnabled(true);
    this.elevationIndicator.setEnabled(true);
  }

  /**
   * Hide ghost preview meshes
   */
  private hideGhostPreview(): void {
    if (this.ghostPreviewMesh) {
      this.ghostPreviewMesh.setEnabled(false);
    }
    if (this.elevationIndicator) {
      this.elevationIndicator.setEnabled(false);
    }
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
    if (!pointerInfo.pickInfo?.pickedPoint) {
      return;
    }

    // Get or create default network
    const networks = pipingStore.getAllNetworks();
    let activeNetwork = networks.length > 0 ? networks[0] : null;

    if (!activeNetwork) {
      // Create default water network
      activeNetwork = pipingStore.createNetwork({
        name: 'Water Network 1',
        serviceType: 'water',
      });
    }

    if (!activeNetwork) {
      console.error('[PipingWorkflowHandler] Failed to create default network');
      return;
    }

    const pickedPoint = pointerInfo.pickInfo.pickedPoint;
    const floorCandidate = pickedPoint.y;
    const elevation = pipingStore.getEffectivePlacementElevation(floorCandidate);

    // Create node at picked point
    const node = pipingStore.createNode(activeNetwork.id, {
      position: {
        x: pickedPoint.x,
        y: elevation,
        z: pickedPoint.z,
      },
      kind: 'endpoint',
      serviceType: activeNetwork.serviceType,
    });

    if (node) {
      console.log('[PipingWorkflowHandler] Created node:', node.id, 'at', pickedPoint);
    }
  }

  /**
   * Handle Shift+click on a node to start segment creation
   */
  private handleShiftClick(pointerInfo: BABYLON.PointerInfo): void {
    console.log('[PipingWorkflowHandler] handleShiftClick called');

    if (!pointerInfo.pickInfo?.pickedMesh || !this.pipingSceneService) {
      console.log('[PipingWorkflowHandler] No picked mesh or piping scene service');
      return;
    }

    // Check if we clicked on a piping node
    const pickResult = this.pipingSceneService.handlePick(pointerInfo.pickInfo.pickedMesh);
    console.log('[PipingWorkflowHandler] Pick result:', pickResult);

    if (pickResult.type !== 'node') {
      // Shift+click on non-node - ignore
      console.log('[PipingWorkflowHandler] Shift+click on non-node, ignoring');
      return;
    }

    if (pickResult.id === null) {
      return;
    }

    // Set this node as the pending source
    this.pendingSourceNodeId = pickResult.id;
    console.log('[PipingWorkflowHandler] ✅ Selected source node for segment:', pickResult.id);
    console.log('[PipingWorkflowHandler] 👉 Now click another node (without Shift) to create segment');

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
