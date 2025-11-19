// Refactored Scene Manager - Orchestrates scene services
// Owner: Cole

import * as BABYLON from '@babylonjs/core';
// Note: @babylonjs/inspector is dynamically imported in toggleInspector() to avoid build issues
import { GROUND_SIZE } from '../core/constants';
import { FloorType } from '../core/types';
import { FloorMaterialManager, GridOverlayOptions, DEFAULT_GRID_OPTIONS } from './FloorMaterialManager';
import { EngineService } from './services/EngineService';
import { LightingService } from './services/LightingService';
import { CameraService } from './services/CameraService';
import { TargetingWidget } from './TargetingWidget';
import { inspectorService } from '../services/InspectorService';
import { PipingSceneService } from '../services/piping/PipingSceneService';
import { PipingWorkflowHandler } from '../services/piping/PipingWorkflowHandler';

export class SceneManager {
  private static instance: SceneManager | null = null;
  private scene: BABYLON.Scene | null = null;
  private ground: BABYLON.Mesh | null = null;
  private floorMaterialManager: FloorMaterialManager | null = null;
  private gridOverlay: BABYLON.Mesh | null = null;
  private gridOverlayOptions: GridOverlayOptions = { ...DEFAULT_GRID_OPTIONS };
  private gridOverlayVisible: boolean = true;
  private gridOverlayPreference: boolean = true;
  private backgroundColor: BABYLON.Color4 = new BABYLON.Color4(182/255, 199/255, 209/255, 1);
  private currentFloorType: FloorType = 'tiles-ceramic';
  private floorVisible: boolean = true;
  private isInitialized: boolean = false;
  private inspectorModulesPromise: Promise<void> | null = null;
  private targetingWidget: TargetingWidget | null = null;

  // Service dependencies
  private engineService: EngineService;
  private lightingService: LightingService;
  private cameraService: CameraService;
  private pipingSceneService: PipingSceneService | null = null;
  private pipingWorkflowHandler: PipingWorkflowHandler | null = null;

  private constructor() {
    this.engineService = EngineService.getInstance();
    this.lightingService = LightingService.getInstance();
    this.cameraService = CameraService.getInstance();
    
    // Expose for testing (only in dev mode)
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      (window as any).sceneManager = this;
    }
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

    // Ensure Babylon namespace is accessible for tools like the inspector
    if (typeof window !== 'undefined' && !(window as any).BABYLON) {
      (window as any).BABYLON = BABYLON;
    }

    // Create scene
    this.scene = new BABYLON.Scene(this.engineService.getEngine()!);

    // Set scene getter for Inspector service
    inspectorService.setSceneGetter(() => this.scene ?? null);

    // CRITICAL FIX: Keep Babylon default (left-handed, Y-up) for stable coordinate system
    // CAD content will be converted to Y-up during import, not at scene level
    this.scene.useRightHandedSystem = false;

    // Default viewport background (can be customized via settings)
    this.scene.clearColor = this.backgroundColor.clone();
    console.log('🎨 Scene initialized with background color:', this.scene.clearColor);

    // Set scene for debug tools
    if (typeof window !== 'undefined' && (window as any).debugTools) {
      (window as any).debugTools.setScene(this.scene);
      console.log('🔧 Debug tools initialized. Type window.debugTools.help() in console.');
    }

    // Initialize lighting service
    this.lightingService.initialize(this.scene);

    // Create ground plane (Y-up: XZ plane at Y=0)
    this.ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: GROUND_SIZE, height: GROUND_SIZE },
      this.scene
    );

    // Ensure ground is pickable for point pick feature
    this.ground.isPickable = true;

    // Initialize floor material manager
    this.floorMaterialManager = new FloorMaterialManager(this.scene);

    // Apply default floor material (grid-only drafting view)
    const floorMaterial = this.floorMaterialManager.createFloorMaterial(this.currentFloorType);
    this.ground.material = floorMaterial;
    this.ground.receiveShadows = true;
    this.ground.setEnabled(this.floorVisible);
    this.ground.visibility = this.floorVisible ? 1 : 0;

    // Create grid overlay for spatial reference - always visible by default
    this.gridOverlay = this.floorMaterialManager.createGridOverlay(
      this.ground,
      true,
      this.gridOverlayOptions
    );
    this.gridOverlayVisible = true;
    console.log('🔲 Grid overlay created; default visibility set to:', this.gridOverlay?.isEnabled());

    // Defensive check: Ensure floor and grid are visible (floor should always be visible, grid depends on type)
    // This addresses potential issues where floor might not render due to visibility state
    if (this.ground) {
      this.ground.setEnabled(this.floorVisible);
      this.ground.visibility = this.floorVisible ? 1 : 0;
      if (this.gridOverlay) {
        // Grid overlay visibility is controlled by its enabled state
        console.log(
          '🔲 Floor initialized - Ground visible, Grid overlay enabled:',
          this.gridOverlay.isEnabled()
        );
      }
    }

    // Freeze ground world matrix for performance
    this.ground.freezeWorldMatrix();

    // Initialize camera service
    this.cameraService.initialize(this.scene, canvas, this.engineService.getEngine()!);

    // Initialize targeting widget
    this.targetingWidget = new TargetingWidget(this.scene);

    // Initialize piping scene service and workflow handler
    this.pipingSceneService = new PipingSceneService(this.scene);
    this.pipingSceneService.start();
    this.pipingWorkflowHandler = new PipingWorkflowHandler();
    this.pipingWorkflowHandler.initialize(this.scene, this.pipingSceneService);

    // Start render loop
    this.cameraService.startRenderLoop(this.scene);

    // CRITICAL FIX: Expose scene to browser console for debugging
    // Dev convenience for the browser console
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      (window as any).scene = this.scene;
      console.log('🔧 Scene exposed to window.scene for debugging');
    }

    // Dev hotkey: Alt+I to toggle Inspector (overlay mode)
    if (typeof window !== 'undefined' && import.meta.env.DEV && this.scene) {
      const hotkeyHandler = (e: KeyboardEvent) => {
        if (e.altKey && e.key.toLowerCase() === 'i') {
          if (!this.scene) return;
          try {
            if (this.scene.debugLayer.isVisible()) {
              this.scene.debugLayer.hide();
              console.log('🔧 Inspector hidden (Alt+I)');
            } else {
              this.scene.debugLayer.show({
                embedMode: false,
                overlay: true,
                handleResize: true,
              });
              console.log('🔧 Inspector shown (Alt+I)');
            }
          } catch (err) {
            console.error('🔧 Failed to toggle Inspector:', err);
          }
        }
      };
      window.addEventListener('keydown', hotkeyHandler);
      console.log('🔧 Inspector hotkey: Alt+I to toggle');
    }

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

  /**
   * Load asset from library using AssetLoader
   * This is the main entry point for loading assets from the Asset Library UI
   */
  async loadAssetFromLibrary(
    asset: any,
    config?: any
  ): Promise<{ success: boolean; error?: string; rootNode?: any }> {
    if (!this.scene) {
      return {
        success: false,
        error: 'Scene not initialized',
      };
    }

    try {
      // Import AssetLoader dynamically to avoid circular dependencies
      const { AssetLoader } = await import('../library/AssetLoader');
      const loader = new AssetLoader(this.scene);

      // Load the asset
      const result = await loader.loadAsset(asset, config);

      // If successful and has meshes/nodes, zoom camera to frame the asset
      if (result.success && result.meshes && result.meshes.length > 0) {
        const firstMesh = result.meshes[0];
        if (firstMesh) {
          this.cameraService.zoomToNode(firstMesh as any);
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to load asset from library:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Load a URDF file from user upload
   */
  async loadURDFFromFile(
    file: File,
    asset: any
  ): Promise<{ success: boolean; error?: string; rootNode?: any }> {
    if (!this.scene) {
      return {
        success: false,
        error: 'Scene not initialized',
      };
    }

    try {
      // Import URDFLoader dynamically
      const { URDFLoader } = await import('../loaders/urdf/URDFLoader');
      const loader = new URDFLoader(this.scene);

      // Read file as text
      const urdfContent = await file.text();

      // Load URDF with the content
      const result = await loader.loadFromString(urdfContent, asset);

      // If successful and has meshes/nodes, zoom camera to frame the asset
      if (result.success && result.rootNode) {
        this.cameraService.zoomToNode(result.rootNode as any);
      }

      return result;
    } catch (error) {
      console.error('Failed to load URDF file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Load a URDF file with mesh files from user upload
   */
  async loadURDFWithMeshes(
    urdfFile: File,
    meshFiles: File[],
    asset: any
  ): Promise<{ success: boolean; error?: string; rootNode?: any }> {
    if (!this.scene) {
      return {
        success: false,
        error: 'Scene not initialized',
      };
    }

    try {
      // Import URDFLoader dynamically
      const { URDFLoader } = await import('../loaders/urdf/URDFLoader');
      const loader = new URDFLoader(this.scene);

      // Read URDF file as text
      const urdfContent = await urdfFile.text();

      // Create a map of mesh files by filename
      const meshFileMap = new Map<string, File>();
      for (const meshFile of meshFiles) {
        meshFileMap.set(meshFile.name, meshFile);
      }

      // Load URDF with mesh files
      const result = await loader.loadFromStringWithMeshes(urdfContent, meshFileMap, asset);

      // If successful and has meshes/nodes, zoom camera to frame the asset
      if (result.success && result.rootNode) {
        this.cameraService.zoomToNode(result.rootNode as any);
      }

      return result;
    } catch (error) {
      console.error('Failed to load URDF with meshes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
    this.ground.setEnabled(this.floorVisible);
    this.ground.visibility = this.floorVisible ? 1 : 0;

    // Manage grid overlay visibility based on floor type
    if (floorType === 'grid-only') {
      if (this.gridOverlay) {
        this.gridOverlay.setEnabled(true);
        console.log(`Floor changed to: ${floorType} (grid overlay enabled)`);
      } else {
        this.gridOverlay = this.floorMaterialManager.createGridOverlay(
          this.ground,
          true,
          this.gridOverlayOptions
        );
        console.log(`Floor changed to: ${floorType} (grid overlay created and enabled)`);
      }
      this.gridOverlayVisible = true;
    } else if (this.gridOverlay) {
      this.gridOverlay.setEnabled(false);
      this.gridOverlayVisible = false;
      console.log(`Floor changed to: ${floorType} (grid overlay hidden)`);
    }
  }

  /**
   * Get current floor type
   */
  getFloorType(): FloorType {
    return this.currentFloorType;
  }

  /**
   * Determine if the floor mesh is visible
   */
  isFloorVisible(): boolean {
    return this.floorVisible;
  }

  /**
   * Toggle floor visibility
   */
  setFloorVisible(visible: boolean): void {
    this.floorVisible = visible;
    if (this.ground) {
      this.ground.setEnabled(visible);
      this.ground.visibility = visible ? 1 : 0;
    }
    if (!visible) {
      if (this.gridOverlay) {
        this.gridOverlay.setEnabled(false);
      }
      this.gridOverlayVisible = false;
      return;
    }
    this.setGridOverlayVisible(this.gridOverlayPreference);
    console.log('[SceneManager] Floor visibility set to:', visible);
  }

  /**
   * Get current grid overlay options merged with defaults
   */
  getGridOverlayOptions(): Required<GridOverlayOptions> {
    return { ...DEFAULT_GRID_OPTIONS, ...this.gridOverlayOptions };
  }

  /**
   * Determine if the grid overlay is visible
   */
  isGridOverlayVisible(): boolean {
    return this.gridOverlayVisible;
  }

  /**
   * Get the current solid background color (normalized 0-1 components)
   */
  getBackgroundColor(): { r: number; g: number; b: number; a: number } {
    return {
      r: this.backgroundColor?.r ?? 0,
      g: this.backgroundColor?.g ?? 0,
      b: this.backgroundColor?.b ?? 0,
      a: this.backgroundColor?.a ?? 1,
    };
  }

  /**
   * Update the scene background color
   */
  setBackgroundColor(color: { r: number; g: number; b: number; a?: number }): void {
    const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
    const nextColor = new BABYLON.Color4(
      clamp01(color.r),
      clamp01(color.g),
      clamp01(color.b),
      clamp01(color.a ?? 1)
    );

    this.backgroundColor = nextColor;
    if (this.scene) {
      this.scene.clearColor = nextColor.clone();
    }
    console.log('[SceneManager] Background color updated:', nextColor);
  }

  /**
   * Set background transparency
   * @param transparent If true, makes background transparent. If false, uses default background.
   */
  setBackgroundTransparent(transparent: boolean): void {
    if (!this.scene) {
      console.warn('Scene not initialized');
      return;
    }

    console.log('🎨 Setting background transparent:', transparent);
    console.log('🎨 Current scene clearColor before:', this.scene.clearColor);
    console.log('🔲 Current grid overlay enabled before:', this.gridOverlay?.isEnabled());

    if (transparent) {
      this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
      // Keep grid overlay visible even when background is transparent (for spatial reference)
      if (this.gridOverlay) {
        this.gridOverlay.setEnabled(true);
        this.gridOverlay.isVisible = true;
        this.gridOverlay.visibility = 1.0;
      }
      this.gridOverlayVisible = true;
      console.log('✅ Background set to transparent (grid overlay visible)');
    } else {
      // Reapply the stored solid background color
      this.scene.clearColor = this.backgroundColor.clone();
      // Show grid overlay when background is solid
      if (this.gridOverlay) {
        this.gridOverlay.setEnabled(true);
      }
      this.gridOverlayVisible = true;
      console.log('✅ Background set to solid (grid overlay visible)');
    }

    console.log('🎨 New scene clearColor after:', this.scene.clearColor);
    console.log('🔲 New grid overlay enabled after:', this.gridOverlay?.isEnabled());
  }

  /**
   * Force transparent background and disable grid overlay
   * This should be called after any world loading/restoration
   */
  forceTransparentBackground(): void {
    if (!this.scene) {
      console.warn('Scene not initialized');
      return;
    }

    console.log('🔧 Force setting transparent background...');
    this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

    // Disable grid overlay
    if (this.gridOverlay) {
      this.gridOverlay.setEnabled(false);
    }
    this.gridOverlayVisible = false;

    // Also disable any existing grid overlay by name
    const existingGridOverlay = this.scene.getMeshByName('gridOverlay');
    if (existingGridOverlay) {
      existingGridOverlay.setEnabled(false);
    }

    console.log('✅ Forced transparent background and disabled grid overlay');
  }

  /**
   * Check if background is currently transparent
   */
  isBackgroundTransparent(): boolean {
    if (!this.scene) return false;
    return this.scene.clearColor.a === 0;
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

    // Ensure ground is pickable for point pick feature
    newGround.isPickable = true;

    // Reapply material with proper scaling for large floors
    const material = this.floorMaterialManager!.createFloorMaterial(
      this.currentFloorType,
      width,
      floorDepth
    );
    newGround.material = material;
    newGround.receiveShadows = true;
    newGround.setEnabled(this.floorVisible);
    newGround.visibility = this.floorVisible ? 1 : 0;

    const wasGridVisible = !!this.gridOverlay?.isEnabled();
    if (this.gridOverlay) {
      this.gridOverlay.dispose();
      this.gridOverlay = null;
    }
    if (wasGridVisible) {
      this.gridOverlay = this.floorMaterialManager!.createGridOverlay(
        newGround,
        true,
        this.gridOverlayOptions
      );
    }
    this.gridOverlayVisible = wasGridVisible;

    // Freeze for performance
    newGround.freezeWorldMatrix();

    console.log(`Floor resized to ${width.toFixed(1)}m × ${floorDepth.toFixed(1)}m`);
  }

  /**
   * Toggle grid overlay visibility
   */
  setGridOverlayVisible(visible: boolean): void {
    this.gridOverlayPreference = visible;

    if (!this.floorMaterialManager || !this.ground) {
      console.warn('Floor material manager or ground not initialized');
      this.gridOverlayVisible = visible && this.floorVisible;
      return;
    }

    if (!this.floorVisible) {
      if (this.gridOverlay) {
        this.gridOverlay.setEnabled(false);
      }
      this.gridOverlayVisible = false;
      return;
    }

    if (visible) {
      if (this.gridOverlay) {
        this.gridOverlay.setEnabled(true);
      } else {
        this.gridOverlay = this.floorMaterialManager.createGridOverlay(
          this.ground,
          true,
          this.gridOverlayOptions
        );
      }
    } else if (this.gridOverlay) {
      this.gridOverlay.setEnabled(false);
    }

    this.gridOverlayVisible = visible;
  }

  setGridOverlayOptions(options: GridOverlayOptions): void {
    if (!this.floorMaterialManager || !this.ground) {
      console.warn('Floor material manager or ground not initialized');
      return;
    }

    this.gridOverlayOptions = { ...this.gridOverlayOptions, ...options };

    if (this.gridOverlay) {
      this.floorMaterialManager.updateGridOverlay(this.gridOverlay, this.gridOverlayOptions);
    } else {
      this.gridOverlay = this.floorMaterialManager.createGridOverlay(
        this.ground,
        this.gridOverlayVisible,
        this.gridOverlayOptions
      );
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

  /**
   * Zoom camera in
   */
  zoomIn(): void {
    this.cameraService.zoomIn();
  }

  /**
   * Zoom camera out
   */
  zoomOut(): void {
    this.cameraService.zoomOut();
  }

  /**
   * Toggle camera mode between orthographic and perspective
   */
  toggleCameraMode(): void {
    this.cameraService.toggleCameraMode();
  }

  /**
   * Get current camera mode
   */
  getCameraMode(): 'orthographic' | 'perspective' | null {
    return this.cameraService.getCameraMode();
  }

  /**
   * Adjust camera clipping planes based on selected object
   */
  adjustClippingPlanesForObject(mesh: BABYLON.AbstractMesh | null): void {
    this.cameraService.adjustClippingPlanesForObject(mesh);
  }

  /**
   * Reset camera clipping planes to defaults
   */
  resetClippingPlanes(): void {
    this.cameraService.resetClippingPlanes();
  }

  /**
   * Show targeting widget at specified position
   */
  showTargetingWidget(position: BABYLON.Vector3, normal?: BABYLON.Vector3): void {
    if (this.targetingWidget) {
      this.targetingWidget.show(position, normal);
    }
  }

  /**
   * Get targeting widget instance
   */
  getTargetingWidget(): TargetingWidget | null {
    return this.targetingWidget;
  }

  /**
   * Lazily load Babylon's debug layer and inspector bundles
   * We cache the promise so multiple concurrent toggle requests don't race.
   */
  private async ensureInspectorModulesLoaded(): Promise<void> {
    if (!this.inspectorModulesPromise) {
      console.log('[SceneManager] Loading debug layer and inspector modules...');
      this.inspectorModulesPromise = Promise.all([
        import('@babylonjs/core/Debug/debugLayer.js'),
        import('@babylonjs/inspector'),
      ])
        .then(() => {
          console.log('[SceneManager] Inspector modules ready');
        })
        .catch((error) => {
          this.inspectorModulesPromise = null;
          throw error;
        });
    }
    return this.inspectorModulesPromise;
  }

  /**
   * Toggle Babylon.js inspector (opens in pop-out window)
   */
  async toggleInspector(): Promise<void> {
    console.log('[SceneManager] toggleInspector called');
    if (!this.scene) {
      console.warn('[SceneManager] Scene not initialized');
      throw new Error('Scene not initialized');
    }

    const host = document.querySelector('.babylon-inspector-host') as HTMLElement | null;
    if (host && document.querySelector('.babylon-inspector-host .babylonjsInspector, .babylon-inspector-host #sceneExplorer')) return;

    // Dynamically import inspector only when needed (avoids build issues)
    try {
      await this.ensureInspectorModulesLoaded();
    } catch (error) {
      console.error('[SceneManager] Inspector not available:', error);
      throw error;
    }

    if (this.scene.debugLayer.isVisible()) {
      this.scene.debugLayer.hide();
      console.log('[SceneManager] Inspector hidden');
      return;
    }

    // before showing overlay debug layer anywhere:
    const embedded = document.querySelector('.babylon-inspector-host .babylonjsInspector, .babylon-inspector-host #sceneExplorer');
    if (embedded) return; // embedded already present; do not open overlay

    console.log('[SceneManager] Showing debug layer...');
    const debugLayer = await this.scene.debugLayer
      .show({
        embedMode: false,
        overlay: true,
        handleResize: true,
      })
      .catch((err) => {
        console.error('[SceneManager] Failed to show debug layer:', err);
        throw err;
      });

    console.log('[SceneManager] Debug layer visible:', this.scene.debugLayer.isVisible());

    if (debugLayer && typeof debugLayer.popupSceneExplorer === 'function') {
      try {
        debugLayer.popupSceneExplorer();
        console.log('[SceneManager] Scene explorer popped out');
      } catch (err) {
        console.warn('[SceneManager] Failed to detach scene explorer:', err);
      }
    }

    if (debugLayer && typeof debugLayer.popupInspector === 'function') {
      try {
        debugLayer.popupInspector();
        console.log('[SceneManager] Inspector popped out');
      } catch (err) {
        console.warn('[SceneManager] Failed to detach inspector:', err);
      }
    }
  }

  dispose(): void {
    // Dispose piping workflow handler first
    if (this.pipingWorkflowHandler !== null) {
      this.pipingWorkflowHandler.dispose();
      this.pipingWorkflowHandler = null;
    }

    // Dispose piping scene service
    if (this.pipingSceneService !== null) {
      this.pipingSceneService.stop();
      this.pipingSceneService = null;
    }

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
