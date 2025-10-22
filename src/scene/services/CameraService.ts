// Camera Service - Handles camera setup and controls
// Owner: Cole

import * as BABYLON from '@babylonjs/core';
import {
  CAMERA_MIN_RADIUS,
  CAMERA_MAX_RADIUS,
  CAMERA_WHEEL_PRECISION,
  CAMERA_INERTIA,
  CAMERA_DEFAULT_ALPHA,
  CAMERA_DEFAULT_BETA,
  CAMERA_DEFAULT_RADIUS,
} from '../../core/constants';

export class CameraService {
  private static instance: CameraService | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private engine: BABYLON.Engine | BABYLON.WebGPUEngine | null = null;

  private constructor() {}

  static getInstance(): CameraService {
    if (!CameraService.instance) {
      CameraService.instance = new CameraService();
    }
    return CameraService.instance;
  }

  /**
   * Initialize camera for the scene
   */
  initialize(scene: BABYLON.Scene, canvas: HTMLCanvasElement, engine: BABYLON.Engine | BABYLON.WebGPUEngine): void {
    this.engine = engine;

    // Create default camera (Y-up Babylon native)
    // Note: User sees Z-up via CoordinateSystem.ts conversions
    this.camera = new BABYLON.ArcRotateCamera(
      'camera',
      CAMERA_DEFAULT_ALPHA, // Rotation around Y-axis
      CAMERA_DEFAULT_BETA,  // Angle from Y-axis
      CAMERA_DEFAULT_RADIUS,
      BABYLON.Vector3.Zero(),
      scene
    );

    // Camera controls - use Babylon.js defaults
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

    // Set clipping planes to handle large range (0.01m to 20km)
    this.camera.minZ = CAMERA_MIN_RADIUS; // Match minimum radius
    this.camera.maxZ = 20000; // 20km far plane
  }

  /**
   * Start render loop with orthographic updates
   */
  startRenderLoop(scene: BABYLON.Scene): void {
    if (!this.engine || !this.camera) return;

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
      scene.render();
    });
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

    // Calculate bounding box size
    const size = boundingBox.extendSizeWorld;
    const maxDimension = Math.max(size.x, size.y, size.z) * 2;

    // Calculate appropriate radius to fit the object
    const targetRadius = Math.max(maxDimension * 0.6, CAMERA_MIN_RADIUS);

    // Animate both target and radius
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

    BABYLON.Animation.CreateAndStartAnimation(
      'setCameraRadius',
      this.camera,
      'radius',
      60,
      30,
      this.camera.radius,
      targetRadius,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  /**
   * Zoom camera to focus on a TransformNode and all its visible children
   */
  zoomToNode(node: BABYLON.TransformNode): void {
    if (!this.camera) return;

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
    const maxDimension = Math.max(sizeX, sizeY, sizeZ);

    // Calculate appropriate radius to fit the object
    const targetRadius = Math.max(maxDimension * 0.6, CAMERA_MIN_RADIUS);

    // Animate both target and radius
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

    BABYLON.Animation.CreateAndStartAnimation(
      'setCameraRadius',
      this.camera,
      'radius',
      60,
      30,
      this.camera.radius,
      targetRadius,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  getCamera(): BABYLON.ArcRotateCamera | null {
    return this.camera;
  }

  dispose(): void {
    this.camera?.dispose();
    this.camera = null;
    this.engine = null;
  }
}
