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
  CAMERA_WHEEL_DELTA_PERCENTAGE,
  CAMERA_PINCH_DELTA_PERCENTAGE,
  CAMERA_ZOOM_TO_MOUSE,
  CAMERA_NEAR_PLANE_RATIO,
  CAMERA_NEAR_MIN,
  CAMERA_FAR_MIN,
  CAMERA_FAR_SCENE_MULTIPLIER,
  CAMERA_COLLISION_BUFFER,
} from '../../core/constants';

export class CameraService {
  private static instance: CameraService | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private engine: BABYLON.Engine | BABYLON.WebGPUEngine | null = null;
  private lastBoundsFrameId: number = -1;
  private cachedSceneDiagonal: number = 1000;
  private lastRadiusForClamp: number = -1;

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
    // Distance-proportional zoom for consistent feel near objects
    this.camera.wheelDeltaPercentage = CAMERA_WHEEL_DELTA_PERCENTAGE;
    this.camera.pinchDeltaPercentage = CAMERA_PINCH_DELTA_PERCENTAGE;
    this.camera.zoomToMouseLocation = CAMERA_ZOOM_TO_MOUSE;
    this.camera.inertia = CAMERA_INERTIA;

    // Panning settings for large worlds
    this.camera.panningSensibility = 200; // Higher = slower/less sensitive panning (was 50)
    this.camera.panningInertia = 0.85; // Reduced inertia for less sliding
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

    // Initialize adaptive clipping planes
    this.updateClippingPlanes(scene);

    // Per-frame updates (executed once per render)
    scene.onBeforeRenderObservable.add(() => {
      this.updateOrthographicViewport();
      this.updateClippingPlanes(scene);
      this.updateCollisionAwareLowerRadius(scene);
    });
  }

  /**
   * Start render loop with orthographic updates
   */
  startRenderLoop(scene: BABYLON.Scene): void {
    // Render loop is managed by SceneCanvas; keep for backward compat if needed
    if (!this.engine || !this.camera) return;
    if ((this.engine as any)._renderingQueueLaunched) {
      return;
    }
    this.engine.runRenderLoop(() => {
      this.updateOrthographicViewport();
      scene.render();
    });
  }

  private updateOrthographicViewport(): void {
    if (!this.engine || !this.camera) return;
    if (this.camera.mode !== BABYLON.Camera.ORTHOGRAPHIC_CAMERA) return;
    const orthoSize = this.camera.radius;
    const aspectRatio = this.engine.getRenderWidth() / this.engine.getRenderHeight();
    this.camera.orthoLeft = -orthoSize * aspectRatio;
    this.camera.orthoRight = orthoSize * aspectRatio;
    this.camera.orthoTop = orthoSize;
    this.camera.orthoBottom = -orthoSize;
  }

  private updateClippingPlanes(scene: BABYLON.Scene): void {
    if (!this.camera) return;
    // Near plane scales with radius to reduce clipping when very close
    const dynamicNear = Math.max(CAMERA_NEAR_MIN, this.camera.radius * CAMERA_NEAR_PLANE_RATIO);
    this.camera.minZ = dynamicNear;

    // Update far plane from scene bounds occasionally
    const frameId = scene.getFrameId();
    if (this.lastBoundsFrameId < 0 || frameId - this.lastBoundsFrameId > 30) {
      const bounds = scene.getWorldExtends();
      if (bounds) {
        const size = bounds.max.subtract(bounds.min);
        this.cachedSceneDiagonal = Math.max(1, size.length());
        this.lastBoundsFrameId = frameId;
      }
    }
    const dynamicFar = Math.max(CAMERA_FAR_MIN, this.cachedSceneDiagonal * CAMERA_FAR_SCENE_MULTIPLIER);
    this.camera.maxZ = dynamicFar;
  }

  private updateCollisionAwareLowerRadius(scene: BABYLON.Scene): void {
    if (!this.camera) return;

    // Only recompute when radius meaningfully changes
    const currentRadius = this.camera.radius;
    if (this.lastRadiusForClamp >= 0 && Math.abs(currentRadius - this.lastRadiusForClamp) < 1e-3) {
      return;
    }
    this.lastRadiusForClamp = currentRadius;

    const cameraPosition = this.camera.position;
    const target = this.camera.target;
    const direction = target.subtract(cameraPosition);
    const length = direction.length();
    if (length <= 1e-6) {
      this.camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;
      return;
    }
    const dirNormalized = direction.scale(1 / length);
    const ray = new BABYLON.Ray(cameraPosition, dirNormalized, currentRadius);

    // Fast check: only need the nearest intersection along the path from camera to target
    const pick = scene.pickWithRay(ray, undefined, true);
    if (pick && pick.hit && typeof pick.distance === 'number') {
      // Remaining distance from hit point to target determines the safe minimum radius
      const distanceFromHitToTarget = Math.max(currentRadius - pick.distance, 0);
      const safeMinRadius = Math.max(distanceFromHitToTarget + CAMERA_COLLISION_BUFFER, CAMERA_MIN_RADIUS);
      this.camera.lowerRadiusLimit = Math.min(safeMinRadius, this.camera.upperRadiusLimit ?? Number.POSITIVE_INFINITY);
      // Clamp if currently below
      if (this.camera.radius < this.camera.lowerRadiusLimit) {
        this.camera.radius = this.camera.lowerRadiusLimit;
      }
    } else {
      this.camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;
    }
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
