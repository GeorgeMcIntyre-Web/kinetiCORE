// Scene Manager - Babylon.js scene setup
// Owner: Cole

import * as BABYLON from '@babylonjs/core';
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

export class SceneManager {
  private static instance: SceneManager | null = null;
  private engine: BABYLON.Engine | BABYLON.WebGPUEngine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private ground: BABYLON.Mesh | null = null;
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

    // Setup basic lighting
    const hemisphericLight = new BABYLON.HemisphericLight(
      'hemisphericLight',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    hemisphericLight.intensity = 0.7;

    // Directional light with shadows
    const directionalLight = new BABYLON.DirectionalLight(
      'directionalLight',
      new BABYLON.Vector3(-1, -2, -1),
      this.scene
    );
    directionalLight.position = new BABYLON.Vector3(10, 20, 10);
    directionalLight.intensity = 0.5;

    // Create ground plane
    this.ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: GROUND_SIZE, height: GROUND_SIZE },
      this.scene
    );

    const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    this.ground.material = groundMaterial;
    this.ground.receiveShadows = true;

    // Freeze ground world matrix for performance
    this.ground.freezeWorldMatrix();

    // Create default camera
    // Note: In Babylon's Y-up space, camera looks down from above
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

    // Set camera up vector to match Babylon's Y-up
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
    const size = boundingBox.extendSizeWorld;

    // Calculate required radius to fit the object
    const maxDimension = Math.max(size.x, size.y, size.z) * 2;
    const targetRadius = Math.max(maxDimension * 1.5, CAMERA_MIN_RADIUS);

    // Animate camera to new position
    BABYLON.Animation.CreateAndStartAnimation(
      'zoomToMesh',
      this.camera,
      'radius',
      60,
      30,
      this.camera.radius,
      Math.min(targetRadius, CAMERA_MAX_RADIUS),
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    BABYLON.Animation.CreateAndStartAnimation(
      'panToMesh',
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

    // Calculate center and size
    const center = new BABYLON.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;

    // Calculate required radius to fit all objects
    const maxDimension = Math.max(sizeX, sizeY, sizeZ) * 2;
    const targetRadius = Math.max(maxDimension * 1.5, CAMERA_MIN_RADIUS);

    // Animate camera to new position
    BABYLON.Animation.CreateAndStartAnimation(
      'zoomToNode',
      this.camera,
      'radius',
      60,
      30,
      this.camera.radius,
      Math.min(targetRadius, CAMERA_MAX_RADIUS),
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    BABYLON.Animation.CreateAndStartAnimation(
      'panToNode',
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
