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

    // Create coordinate axes (X=red, Y=green, Z=blue)
    this.createCoordinateAxes();

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
   * Create coordinate axes for reference
   * NOTE: These are in Babylon's internal space (Y-up)
   * But represent user space (Z-up) conceptually:
   *   Babylon X (Red) = User X (Right)
   *   Babylon Y (Green) = User Z (Up)
   *   Babylon Z (Blue) = User Y (Forward)
   */
  private createCoordinateAxes(): void {
    if (!this.scene) return;

    const axisLength = AXIS_LENGTH;

    // X-axis (Red) - Same in both spaces (Right)
    const axisX = BABYLON.MeshBuilder.CreateLines(
      'axisX',
      {
        points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(axisLength, 0, 0)],
      },
      this.scene
    );
    axisX.color = new BABYLON.Color3(1, 0, 0);

    // Y-axis (Green) - Babylon Y = User Z (UP)
    const axisY = BABYLON.MeshBuilder.CreateLines(
      'axisY',
      {
        points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, axisLength, 0)],
      },
      this.scene
    );
    axisY.color = new BABYLON.Color3(0, 1, 0);

    // Z-axis (Blue) - Babylon Z = User Y (Forward)
    const axisZ = BABYLON.MeshBuilder.CreateLines(
      'axisZ',
      {
        points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, 0, axisLength)],
      },
      this.scene
    );
    axisZ.color = new BABYLON.Color3(0, 0, 1);

    // Add axis labels for user clarity
    this.createAxisLabel('X', new BABYLON.Vector3(axisLength + 0.5, 0, 0), new BABYLON.Color3(1, 0, 0));
    this.createAxisLabel('Z', new BABYLON.Vector3(0, axisLength + 0.5, 0), new BABYLON.Color3(0, 1, 0)); // User Z (up)
    this.createAxisLabel('Y', new BABYLON.Vector3(0, 0, axisLength + 0.5), new BABYLON.Color3(0, 0, 1)); // User Y (forward)
  }

  /**
   * Create text label for axis
   */
  private createAxisLabel(text: string, position: BABYLON.Vector3, color: BABYLON.Color3): void {
    if (!this.scene) return;

    // Create a simple plane with text (using dynamic texture)
    const plane = BABYLON.MeshBuilder.CreatePlane(`label${text}`, { size: 0.5 }, this.scene);
    plane.position = position;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; // Always face camera

    const texture = new BABYLON.DynamicTexture(`labelTexture${text}`, 256, this.scene);
    const material = new BABYLON.StandardMaterial(`labelMat${text}`, this.scene);
    material.diffuseTexture = texture;
    material.emissiveColor = color;
    material.disableLighting = true;
    plane.material = material;

    // Draw text on texture
    const ctx = texture.getContext();
    const context = ctx as CanvasRenderingContext2D;
    context.fillStyle = `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`;
    context.font = 'bold 120px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 128);
    texture.update();
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
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
    this.camera = null;
    this.ground = null;
  }
}
