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
import { CoordinateFrameWidget } from './CoordinateFrameWidget';

export class SceneManager {
  private static instance: SceneManager | null = null;
  private engine: BABYLON.Engine | BABYLON.WebGPUEngine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private ground: BABYLON.Mesh | null = null;
  private coordWidget: CoordinateFrameWidget | null = null;

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
    // Try to create WebGPU engine first, fallback to WebGL2
    const webGPUSupported = await BABYLON.WebGPUEngine.IsSupportedAsync;

    if (webGPUSupported) {
      const webGPUEngine = new BABYLON.WebGPUEngine(canvas, {
        antialias: true,
        stencil: true,
      });
      await webGPUEngine.initAsync();
      this.engine = webGPUEngine;
    } else {
      // Fallback to WebGL2
      this.engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
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

    // Create coordinate frame widget in corner
    this.coordWidget = new CoordinateFrameWidget(this.scene);
    this.coordWidget.setViewport(0, 0, 0.15, 0.15); // Bottom-left corner, 15% size

    // Update widget when camera moves
    this.camera.onViewMatrixChangedObservable.add(() => {
      this.coordWidget?.updateOrientation();
    });

    // Render loop
    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine?.resize();
    });
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

  dispose(): void {
    this.coordWidget?.dispose();
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
    this.camera = null;
    this.ground = null;
    this.coordWidget = null;
  }
}
