// Camera Service - Handles camera setup and controls
// Owner: Cole

import * as BABYLON from '@babylonjs/core';
import {
  CAMERA_MIN_RADIUS,
  CAMERA_MAX_RADIUS,
  CAMERA_WHEEL_PRECISION,
  CAMERA_WHEEL_DELTA_PERCENT,
  CAMERA_PINCH_DELTA_PERCENT,
  CAMERA_INERTIA,
  CAMERA_DEFAULT_ALPHA,
  CAMERA_DEFAULT_BETA,
  CAMERA_DEFAULT_RADIUS,
  CAMERA_PANNING_SENSIBILITY,
  CAMERA_PANNING_INERTIA,
  CAMERA_LOWER_BETA_LIMIT,
  CAMERA_UPPER_BETA_LIMIT,
  CAMERA_MIN_Z,
  CAMERA_MAX_Z,
  CAMERA_DEFAULT_MODE,
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

    // Camera controls
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;
    this.camera.upperRadiusLimit = CAMERA_MAX_RADIUS;
    // Prefer percent-based zoom if available; otherwise use precision fallback
    if ((this.camera as any).wheelDeltaPercentage !== undefined) {
      (this.camera as any).wheelDeltaPercentage = CAMERA_WHEEL_DELTA_PERCENT;
    } else {
      this.camera.wheelPrecision = CAMERA_WHEEL_PRECISION;
    }
    if ((this.camera as any).pinchDeltaPercentage !== undefined) {
      (this.camera as any).pinchDeltaPercentage = CAMERA_PINCH_DELTA_PERCENT;
    }
    this.camera.inertia = CAMERA_INERTIA;

    // Panning settings for large worlds
    this.camera.panningSensibility = CAMERA_PANNING_SENSIBILITY;
    this.camera.panningInertia = CAMERA_PANNING_INERTIA;
    this.camera.panningDistanceLimit = null; // No distance limit for panning

    // Allow full rotation range (no limits)
    this.camera.lowerBetaLimit = CAMERA_LOWER_BETA_LIMIT;
    this.camera.upperBetaLimit = CAMERA_UPPER_BETA_LIMIT;
    this.camera.lowerAlphaLimit = null; // No limit on horizontal rotation
    this.camera.upperAlphaLimit = null; // No limit on horizontal rotation

    // Disable camera collisions for large scenes
    this.camera.checkCollisions = false;

    // Set camera up vector to Y-up (Babylon native)
    this.camera.upVector = new BABYLON.Vector3(0, 1, 0);

    // Set camera projection mode
    this.camera.mode = CAMERA_DEFAULT_MODE === 'orthographic'
      ? BABYLON.Camera.ORTHOGRAPHIC_CAMERA
      : BABYLON.Camera.PERSPECTIVE_CAMERA;

    // If orthographic, set initial viewport from default radius
    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      const orthoSize = CAMERA_DEFAULT_RADIUS;
      const aspectRatio = this.engine.getRenderWidth() / this.engine.getRenderHeight();
      this.camera.orthoLeft = -orthoSize * aspectRatio;
      this.camera.orthoRight = orthoSize * aspectRatio;
      this.camera.orthoTop = orthoSize;
      this.camera.orthoBottom = -orthoSize;
    }

    // Set clipping planes to handle large range (0.01m to 20km)
    this.camera.minZ = CAMERA_MIN_Z;
    this.camera.maxZ = CAMERA_MAX_Z;
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

  /**
   * Zoom camera in by decreasing radius
   */
  zoomIn(): void {
    if (!this.camera) return;

    const zoomFactor = 0.9; // Zoom in by 10%
    const newRadius = Math.max(
      this.camera.radius * zoomFactor,
      CAMERA_MIN_RADIUS
    );

    BABYLON.Animation.CreateAndStartAnimation(
      'zoomIn',
      this.camera,
      'radius',
      60,
      10,
      this.camera.radius,
      newRadius,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  /**
   * Zoom camera out by increasing radius
   */
  zoomOut(): void {
    if (!this.camera) return;

    const zoomFactor = 1.1; // Zoom out by 10%
    const newRadius = Math.min(
      this.camera.radius * zoomFactor,
      CAMERA_MAX_RADIUS
    );

    BABYLON.Animation.CreateAndStartAnimation(
      'zoomOut',
      this.camera,
      'radius',
      60,
      10,
      this.camera.radius,
      newRadius,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  /**
   * Toggle camera mode between orthographic and perspective
   */
  toggleCameraMode(): void {
    if (!this.camera || !this.engine) return;

    // Toggle mode
    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      // Switch to perspective
      this.camera.mode = BABYLON.Camera.PERSPECTIVE_CAMERA;
      console.log('[CameraService] Switched to Perspective mode');
    } else {
      // Switch to orthographic
      this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

      // Update orthographic viewport based on current radius
      const orthoSize = this.camera.radius;
      const aspectRatio = this.engine.getRenderWidth() / this.engine.getRenderHeight();
      this.camera.orthoLeft = -orthoSize * aspectRatio;
      this.camera.orthoRight = orthoSize * aspectRatio;
      this.camera.orthoTop = orthoSize;
      this.camera.orthoBottom = -orthoSize;

      console.log('[CameraService] Switched to Orthographic mode');
    }
  }

  /**
   * Get current camera mode
   */
  getCameraMode(): 'orthographic' | 'perspective' | null {
    if (!this.camera) return null;
    return this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA ? 'orthographic' : 'perspective';
  }

  /**
   * Adjust camera clipping planes dynamically based on selected object size
   * This provides optimal clipping for both small and large objects
   */
  adjustClippingPlanesForObject(mesh: BABYLON.AbstractMesh | null): void {
    if (!this.camera) return;

    if (!mesh) {
      // Reset to default clipping planes when no object selected
      this.camera.minZ = CAMERA_MIN_Z;
      this.camera.maxZ = CAMERA_MAX_Z;
      console.log('[CameraService] Reset clipping planes to defaults:', { minZ: CAMERA_MIN_Z, maxZ: CAMERA_MAX_Z });
      return;
    }

    // Get object bounding box
    const boundingInfo = mesh.getBoundingInfo();
    const boundingBox = boundingInfo.boundingBox;
    const size = boundingBox.extendSizeWorld;
    const maxDimension = Math.max(size.x, size.y, size.z) * 2;

    // Calculate optimal clipping planes based on object size
    // Near plane: 1% of object size (min 0.0001m = 0.1mm for very small objects)
    const nearClip = Math.max(maxDimension * 0.01, 0.0001);

    // Far plane: 100x object size (ensures we can see the whole object from any angle)
    const farClip = Math.min(maxDimension * 100, CAMERA_MAX_Z);

    // Apply new clipping planes
    this.camera.minZ = nearClip;
    this.camera.maxZ = farClip;

    console.log('[CameraService] Adjusted clipping planes for object:', {
      objectSize: maxDimension.toFixed(3),
      minZ: nearClip.toFixed(6),
      maxZ: farClip.toFixed(1)
    });
  }

  /**
   * Reset clipping planes to defaults
   */
  resetClippingPlanes(): void {
    if (!this.camera) return;
    this.camera.minZ = CAMERA_MIN_Z;
    this.camera.maxZ = CAMERA_MAX_Z;
    console.log('[CameraService] Reset clipping planes to defaults');
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
