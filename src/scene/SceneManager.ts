// Scene Manager - Babylon.js scene setup
// Owner: Cole

import * as BABYLON from '@babylonjs/core';
import {
  GROUND_SIZE,
  AXIS_LENGTH,
  CAMERA_MIN_RADIUS,
  CAMERA_MAX_RADIUS,
  CAMERA_WHEEL_PRECISION,
  CAMERA_INERTIA,
} from '../core/constants';

export class SceneManager {
  private static instance: SceneManager | null = null;
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;

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

    // Create engine with WebGL2
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    // Create scene
    this.scene = new BABYLON.Scene(this.engine);

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
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: GROUND_SIZE, height: GROUND_SIZE },
      this.scene
    );

    const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = groundMaterial;
    ground.receiveShadows = true;

    // Freeze ground world matrix for performance
    ground.freezeWorldMatrix();

    // Create coordinate axes (X=red, Y=green, Z=blue)
    this.createCoordinateAxes();

    // Create default camera
    this.camera = new BABYLON.ArcRotateCamera(
      'camera',
      Math.PI / 2,
      Math.PI / 3,
      10,
      BABYLON.Vector3.Zero(),
      this.scene
    );

    // Camera controls
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;
    this.camera.upperRadiusLimit = CAMERA_MAX_RADIUS;
    this.camera.wheelPrecision = CAMERA_WHEEL_PRECISION;
    this.camera.inertia = CAMERA_INERTIA;

    // Render loop
    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine?.resize();
    });
  }

  /**
   * Create RGB coordinate axes for reference
   */
  private createCoordinateAxes(): void {
    if (!this.scene) return;

    // X-axis (Red)
    const axisX = BABYLON.MeshBuilder.CreateLines(
      'axisX',
      {
        points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(AXIS_LENGTH, 0, 0)],
      },
      this.scene
    );
    axisX.color = new BABYLON.Color3(1, 0, 0);

    // Y-axis (Green)
    const axisY = BABYLON.MeshBuilder.CreateLines(
      'axisY',
      {
        points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, AXIS_LENGTH, 0)],
      },
      this.scene
    );
    axisY.color = new BABYLON.Color3(0, 1, 0);

    // Z-axis (Blue)
    const axisZ = BABYLON.MeshBuilder.CreateLines(
      'axisZ',
      {
        points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, 0, AXIS_LENGTH)],
      },
      this.scene
    );
    axisZ.color = new BABYLON.Color3(0, 0, 1);
  }

  getScene(): BABYLON.Scene | null {
    return this.scene;
  }

  getEngine(): BABYLON.Engine | null {
    return this.engine;
  }

  getCamera(): BABYLON.ArcRotateCamera | null {
    return this.camera;
  }

  dispose(): void {
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
    this.camera = null;
  }
}
