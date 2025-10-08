// Scene Manager - Babylon.js scene setup
// Owner: Cole

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/materials/grid';
import {
  GROUND_SIZE,
  CAMERA_MIN_RADIUS,
  CAMERA_MAX_RADIUS,
  CAMERA_WHEEL_PRECISION,
  CAMERA_INERTIA,
  CAMERA_DEFAULT_ALPHA,
  CAMERA_DEFAULT_BETA,
  CAMERA_DEFAULT_RADIUS,
} from '../core/constants';
import { FloorType } from '../core/types';
import { FloorMaterialManager } from './FloorMaterialManager';

export class SceneManager {
  private static instance: SceneManager | null = null;
  private engine: BABYLON.Engine | BABYLON.WebGPUEngine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private ground: BABYLON.Mesh | null = null;
  private floorMaterialManager: FloorMaterialManager | null = null;
  private gridOverlay: BABYLON.Mesh | null = null;
  private currentFloorType: FloorType = 'grid-only';
  private isInitialized: boolean = false;
  private isUsingWebGPU: boolean = false;

  private constructor() {}

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
    if (this.isInitialized || this.engine) {
      console.log('SceneManager already initialized, skipping...');
      return;
    }

    // Mark as initializing immediately to prevent race conditions
    this.isInitialized = true;

    // Try WebGPU first, fallback to WebGL2
    const useWebGPU = localStorage.getItem('preferWebGPU') !== 'false'; // Default: try WebGPU

    if (useWebGPU && await BABYLON.WebGPUEngine.IsSupportedAsync) {
      try {
        console.log('🚀 Initializing WebGPU engine...');
        const webgpuEngine = new BABYLON.WebGPUEngine(canvas, {
          antialias: true,
          stencil: true,
        });
        await webgpuEngine.initAsync();
        this.engine = webgpuEngine;
        this.isUsingWebGPU = true;
        console.log('✅ WebGPU engine ready');
      } catch (error) {
        console.warn('⚠️ WebGPU initialization failed, falling back to WebGL2:', error);
        this.engine = new BABYLON.Engine(canvas, true, {
          preserveDrawingBuffer: true,
          stencil: true,
        });
        this.isUsingWebGPU = false;
        console.log('Using WebGL2 engine (fallback)');
      }
    } else {
      this.engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      this.isUsingWebGPU = false;
      if (!useWebGPU) {
        console.log('Using WebGL2 engine (user preference)');
      } else {
        console.log('Using WebGL2 engine (WebGPU not supported)');
      }
    }

    // Create scene
    this.scene = new BABYLON.Scene(this.engine);

    // Configure for right-handed coordinate system (matches CAD standards)
    this.scene.useRightHandedSystem = true;

    // Internal: Y-up (Babylon native)
    // User sees: Z-up (converted via CoordinateSystem.ts)

    // Create realistic environment with HDR lighting
    const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
      'https://playground.babylonjs.com/textures/environment.env',
      this.scene
    );
    this.scene.environmentTexture = hdrTexture;
    this.scene.createDefaultSkybox(hdrTexture, true, 1000, 0.3);

    // Setup realistic lighting (Y-up: light points down from above)
    const hemisphericLight = new BABYLON.HemisphericLight(
      'hemisphericLight',
      new BABYLON.Vector3(0, 1, 0), // Y-up: light from above
      this.scene
    );
    hemisphericLight.intensity = 0.5;
    hemisphericLight.groundColor = new BABYLON.Color3(0.3, 0.3, 0.35);

    // Directional light with shadows (Y-up: comes from above-side)
    const directionalLight = new BABYLON.DirectionalLight(
      'directionalLight',
      new BABYLON.Vector3(-1, -2, -1), // Y-up: direction from above
      this.scene
    );
    directionalLight.position = new BABYLON.Vector3(10, 20, 10); // Y-up: positioned above
    directionalLight.intensity = 0.8;
    directionalLight.shadowMinZ = 1;
    directionalLight.shadowMaxZ = 100;

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

    // Create default camera (Y-up Babylon native)
    // Note: User sees Z-up via CoordinateSystem.ts conversions
    this.camera = new BABYLON.ArcRotateCamera(
      'camera',
      CAMERA_DEFAULT_ALPHA, // Rotation around Y-axis
      CAMERA_DEFAULT_BETA,  // Angle from Y-axis
      CAMERA_DEFAULT_RADIUS,
      BABYLON.Vector3.Zero(),
      this.scene
    );

    // Camera controls
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;
    this.camera.upperRadiusLimit = CAMERA_MAX_RADIUS;
    this.camera.wheelPrecision = CAMERA_WHEEL_PRECISION;
    this.camera.inertia = CAMERA_INERTIA;

    // Panning settings for large worlds
    this.camera.panningSensibility = 50; // Lower = faster panning
    this.camera.panningInertia = 0.9; // Smooth panning
    this.camera.panningDistanceLimit = null; // No distance limit for panning

    // Allow full rotation range (no limits)
    this.camera.lowerBetaLimit = 0.1; // Nearly straight down (avoid gimbal lock)
    this.camera.upperBetaLimit = Math.PI - 0.1; // Nearly straight up (avoid gimbal lock)
    this.camera.lowerAlphaLimit = null; // No limit on horizontal rotation
    this.camera.upperAlphaLimit = null; // No limit on horizontal rotation

    // Disable camera collisions for large scenes
    this.camera.checkCollisions = false;

    // Set camera up vector to Y-up (Babylon native)
    this.camera.upVector = new BABYLON.Vector3(0, 1, 0);

    // Set camera to orthographic mode by default
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

    // Set orthographic viewport (adjust based on initial radius)
    const orthoSize = CAMERA_DEFAULT_RADIUS;
    const aspectRatio = this.engine.getRenderWidth() / this.engine.getRenderHeight();
    this.camera.orthoLeft = -orthoSize * aspectRatio;
    this.camera.orthoRight = orthoSize * aspectRatio;
    this.camera.orthoTop = orthoSize;
    this.camera.orthoBottom = -orthoSize;

    // Render loop
    this.engine.runRenderLoop(() => {
      // Update orthographic zoom based on camera radius
      if (this.camera && this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
        const orthoSize = this.camera.radius;
        const aspectRatio = this.engine!.getRenderWidth() / this.engine!.getRenderHeight();
        this.camera.orthoLeft = -orthoSize * aspectRatio;
        this.camera.orthoRight = orthoSize * aspectRatio;
        this.camera.orthoTop = orthoSize;
        this.camera.orthoBottom = -orthoSize;
      }
      this.scene?.render();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine?.resize();
    });

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


  getScene(): BABYLON.Scene | null {
    return this.scene;
  }

  getEngine(): BABYLON.Engine | BABYLON.WebGPUEngine | null {
    return this.engine;
  }

  getCamera(): BABYLON.ArcRotateCamera | null {
    return this.camera;
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
    if (!this.ground || !this.scene || !this.floorMaterialManager) {
      console.warn('Ground, scene, or floor material manager not initialized');
      return;
    }

    const floorDepth = depth ?? width; // Default to square if depth not provided

    // Dispose old ground
    if (this.ground) {
      this.ground.dispose();
    }

    // Create new ground with new size (width = X, height = Y in Babylon ground)
    this.ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: width, height: floorDepth },
      this.scene
    );

    // Reapply material with proper scaling for large floors
    const material = this.floorMaterialManager.createFloorMaterial(
      this.currentFloorType,
      width,
      floorDepth
    );
    this.ground.material = material;
    this.ground.receiveShadows = true;

    // Recreate grid overlay with new size
    if (this.gridOverlay) {
      this.gridOverlay.dispose();
    }
    this.gridOverlay = this.floorMaterialManager.createGridOverlay(this.ground, true);

    // Freeze for performance
    this.ground.freezeWorldMatrix();

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
    return this.isUsingWebGPU;
  }

  /**
   * Get rendering engine name
   */
  getRenderingEngineName(): string {
    return this.isUsingWebGPU ? 'WebGPU' : 'WebGL2';
  }

  /**
   * Zoom camera to focus on a specific mesh or node
   */
  zoomToMesh(mesh: BABYLON.AbstractMesh): void {
    if (!this.camera) return;

    // Get mesh bounding box
    const boundingInfo = mesh.getBoundingInfo();
    const boundingBox = boundingInfo.boundingBox;
    const center = boundingBox.centerWorld;

    // Only animate the target (rotation center), not the radius (zoom)
    BABYLON.Animation.CreateAndStartAnimation(
      'setCameraTarget',
      this.camera,
      'target',
      60,
      30,
      this.camera.target,
      center,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  /**
   * Zoom camera to focus on a TransformNode and all its visible children
   */
  zoomToNode(node: BABYLON.TransformNode): void {
    if (!this.camera || !this.scene) return;

    // Get all descendant meshes
    const meshes = node.getChildMeshes(false);

    if (meshes.length === 0) return;

    // Calculate combined bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    meshes.forEach(mesh => {
      if (!mesh.isVisible) return;

      const boundingInfo = mesh.getBoundingInfo();
      const boundingBox = boundingInfo.boundingBox;
      const min = boundingBox.minimumWorld;
      const max = boundingBox.maximumWorld;

      minX = Math.min(minX, min.x);
      minY = Math.min(minY, min.y);
      minZ = Math.min(minZ, min.z);
      maxX = Math.max(maxX, max.x);
      maxY = Math.max(maxY, max.y);
      maxZ = Math.max(maxZ, max.z);
    });

    // Calculate center
    const center = new BABYLON.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );

    // Only animate the target (rotation center), not the radius (zoom)
    BABYLON.Animation.CreateAndStartAnimation(
      'setCameraTarget',
      this.camera,
      'target',
      60,
      30,
      this.camera.target,
      center,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  dispose(): void {
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
    this.camera = null;
    this.ground = null;
    this.isInitialized = false;
  }
}
