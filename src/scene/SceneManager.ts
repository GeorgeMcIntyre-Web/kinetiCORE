// Refactored Scene Manager - Orchestrates scene services
// Owner: Cole

import * as BABYLON from '@babylonjs/core';
import { GROUND_SIZE } from '../core/constants';
import { FloorType } from '../core/types';
import { FloorMaterialManager } from './FloorMaterialManager';
import { EngineService } from './services/EngineService';
import { LightingService } from './services/LightingService';
import { CameraService } from './services/CameraService';

export class SceneManager {
  private static instance: SceneManager | null = null;
  private scene: BABYLON.Scene | null = null;
  private ground: BABYLON.Mesh | null = null;
  private floorMaterialManager: FloorMaterialManager | null = null;
  private gridOverlay: BABYLON.Mesh | null = null;
  private currentFloorType: FloorType = 'grid-only';
  private isInitialized: boolean = false;

  // Service dependencies
  private engineService: EngineService;
  private lightingService: LightingService;
  private cameraService: CameraService;

  private constructor() {
    this.engineService = EngineService.getInstance();
    this.lightingService = LightingService.getInstance();
    this.cameraService = CameraService.getInstance();
  }

  static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  /**
   * Initialize the Babylon.js scene
   */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Prevent double initialization (React StrictMode calls useEffect twice)
    if (this.isInitialized) {
      console.log('SceneManager already initialized, skipping...');
      return;
    }

    // Mark as initializing immediately to prevent race conditions
    this.isInitialized = true;

    // Initialize engine service
    await this.engineService.initialize(canvas);

    // Create scene
    this.scene = new BABYLON.Scene(this.engineService.getEngine()!);

    // Configure for right-handed coordinate system (matches CAD standards)
    this.scene.useRightHandedSystem = true;

    // Initialize lighting service
    this.lightingService.initialize(this.scene);

    // Create ground plane (Y-up: XZ plane at Y=0)
    this.ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: GROUND_SIZE, height: GROUND_SIZE },
      this.scene
    );

    // Initialize floor material manager
    this.floorMaterialManager = new FloorMaterialManager(this.scene);

    // Apply default floor material (polished concrete)
    const floorMaterial = this.floorMaterialManager.createFloorMaterial(
      this.currentFloorType
    );
    this.ground.material = floorMaterial;
    this.ground.receiveShadows = true;

    // Create grid overlay for spatial reference
    this.gridOverlay = this.floorMaterialManager.createGridOverlay(this.ground, true);

    // Freeze ground world matrix for performance
    this.ground.freezeWorldMatrix();

    // Initialize camera service
    this.cameraService.initialize(this.scene, canvas, this.engineService.getEngine()!);

    // Start render loop
    this.cameraService.startRenderLoop(this.scene);

    // Initialize CSG2 for Boolean operations
    try {
      const { BooleanOperations } = await import('./BooleanOperations');
      const csgInitialized = await BooleanOperations.initialize();
      if (csgInitialized) {
        console.log('✅ CSG2 (Manifold) initialized successfully');
      } else {
        console.warn('⚠️ CSG2 initialization failed - Boolean operations will not work');
      }
    } catch (error) {
      console.error('Failed to initialize CSG2:', error);
    }
  }


  /**
   * Load a GLB by URL using ModelLoader helper and attach under scene root
   */
  async addModelFromLibrary(url: string): Promise<BABYLON.TransformNode | null> {
    if (!this.scene) return null;
    const { loadGLB } = await import('./ModelLoader');
    const res = await loadGLB(url, this.scene, { enableBoundsCalculation: true });
    if ((res as any).rootNodes && (res as any).rootNodes.length > 0) {
      const node = (res as any).rootNodes[0] as BABYLON.TransformNode;
      // Frame camera
      this.cameraService.zoomToNode(node);
      return node;
    }
    return null;
  }

  getScene(): BABYLON.Scene | null {
    return this.scene;
  }

  getEngine(): BABYLON.Engine | BABYLON.WebGPUEngine | null {
    return this.engineService.getEngine();
  }

  getCamera(): BABYLON.ArcRotateCamera | null {
    return this.cameraService.getCamera();
  }

  getGround(): BABYLON.Mesh | null {
    return this.ground;
  }

  /**
   * Change the floor material type
   */
  setFloorType(floorType: FloorType): void {
    if (!this.floorMaterialManager || !this.ground) {
      console.warn('Floor material manager or ground not initialized');
      return;
    }

    this.currentFloorType = floorType;
    const material = this.floorMaterialManager.createFloorMaterial(floorType);
    this.ground.material = material;

    console.log(`Floor changed to: ${floorType}`);
  }

  /**
   * Get current floor type
   */
  getFloorType(): FloorType {
    return this.currentFloorType;
  }

  /**
   * Resize the floor to accommodate large layouts (e.g., DWG imports)
   * @param width Floor width (X-axis)
   * @param depth Floor depth (Y-axis), optional - defaults to width for square floor
   */
  resizeFloor(width: number, depth?: number): void {
    if (!this.ground || !this.scene) {
      console.warn('Ground or scene not initialized');
      return;
    }

    const floorDepth = depth ?? width; // Default to square if depth not provided

    // Dispose old ground
    this.ground?.dispose();

    // Create new ground with new size (width = X, height = Y in Babylon ground)
    const newGround = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: width, height: floorDepth },
      this.scene
    );
    this.ground = newGround;

    // Reapply material with proper scaling for large floors
    const material = this.floorMaterialManager!.createFloorMaterial(
      this.currentFloorType,
      width,
      floorDepth
    );
    newGround.material = material;
    newGround.receiveShadows = true;

    // Recreate grid overlay with new size
    if (this.gridOverlay) {
      this.gridOverlay.dispose();
    }
    this.gridOverlay = this.floorMaterialManager!.createGridOverlay(newGround, true);

    // Freeze for performance
    newGround.freezeWorldMatrix();

    console.log(`Floor resized to ${width.toFixed(1)}m × ${floorDepth.toFixed(1)}m`);
  }

  /**
   * Toggle grid overlay visibility
   */
  setGridOverlayVisible(visible: boolean): void {
    if (!this.floorMaterialManager || !this.ground) {
      console.warn('Floor material manager or ground not initialized');
      return;
    }

    if (this.gridOverlay) {
      this.gridOverlay.dispose();
      this.gridOverlay = null;
    }

    if (visible) {
      this.gridOverlay = this.floorMaterialManager.createGridOverlay(this.ground, true);
    }
  }

  /**
   * Check if using WebGPU rendering
   */
  isWebGPU(): boolean {
    return this.engineService.isWebGPU();
  }

  /**
   * Get rendering engine name
   */
  getRenderingEngineName(): string {
    return this.engineService.getRenderingEngineName();
  }

  /**
   * Zoom camera to focus on a specific mesh or node
   */
  zoomToMesh(mesh: BABYLON.AbstractMesh): void {
    this.cameraService.zoomToMesh(mesh);
  }

  /**
   * Zoom camera to focus on a TransformNode and all its visible children
   */
  zoomToNode(node: BABYLON.TransformNode): void {
    this.cameraService.zoomToNode(node);
  }

  dispose(): void {
    this.scene?.dispose();
    this.scene = null;
    this.ground = null;
    this.isInitialized = false;

    // Dispose services
    this.engineService.dispose();
    this.lightingService.dispose();
    this.cameraService.dispose();
  }
}
