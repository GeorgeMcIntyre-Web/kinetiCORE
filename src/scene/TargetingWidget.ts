// TargetingWidget - Visual feedback for object picking
// Owner: George

import * as BABYLON from '@babylonjs/core';

export interface TargetingWidgetOptions {
  /** Size of the targeting reticle (default: 0.1) */
  size?: number;
  /** Color of the targeting reticle (default: cyan) */
  color?: BABYLON.Color3;
  /** Duration of the animation in milliseconds (default: 500) */
  duration?: number;
  /** Whether to show a pulse animation (default: true) */
  showPulse?: boolean;
}

/**
 * Targeting widget that provides visual feedback when picking objects
 */
export class TargetingWidget {
  private scene: BABYLON.Scene;
  private rootNode: BABYLON.Mesh | null = null; // Changed to Mesh to support billboard mode
  private reticleLines: BABYLON.Mesh[] = []; // Changed to Mesh[] (using planes instead of lines)
  private centerDot: BABYLON.Mesh | null = null;
  private pulseRing: BABYLON.Mesh | null = null;
  private options: Required<TargetingWidgetOptions>;
  private animationStartTime: number = 0;
  private isAnimating: boolean = false;

  constructor(scene: BABYLON.Scene, options: TargetingWidgetOptions = {}) {
    this.scene = scene;
    this.options = {
      size: options.size ?? 0.1,
      color: options.color ?? new BABYLON.Color3(1, 0.4, 0), // Deep distinct orange
      duration: options.duration ?? 500,
      showPulse: options.showPulse ?? true,
    };
  }

  /**
   * Show targeting widget at specified position
   * Note: normal parameter is ignored - widget always billboards to camera
   */
  show(position: BABYLON.Vector3, _normal?: BABYLON.Vector3): void {
    // Clean up existing widget
    this.hide();

    // Create root node as a Mesh (allows billboard mode)
    // Use a tiny invisible sphere as the root
    const root = BABYLON.MeshBuilder.CreateSphere(
      'targetingWidget',
      { diameter: 0.001 },
      this.scene
    );
    root.position = position;
    root.isVisible = false;
    root.isPickable = false;

    // Apply billboard mode to root node so entire widget faces camera as one unit
    root.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    // Calculate scale based on distance to picked point (adaptive sizing)
    // Closer picks = smaller targeter, farther picks = larger targeter
    const camera = this.scene.activeCamera;
    let scale = 1.0;
    if (camera) {
      // Use actual distance from camera to pick point for adaptive sizing
      const distanceToPoint = BABYLON.Vector3.Distance(camera.position, position);

      // Natural adaptive scaling that feels right at all zoom levels
      // Uses a percentage of screen space rather than absolute size
      let targetSize = distanceToPoint * 0.08; // Natural multiplier for screen-relative size
      const MIN_SIZE = 0.015;  // Very small for extreme close-ups
      const MAX_SIZE = 0.5;    // Reasonable maximum to prevent oversized targeter
      targetSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, targetSize));

      // Calculate scale relative to base size
      scale = targetSize / this.options.size;
    }

    // Apply uniform scale to root node
    root.scaling = new BABYLON.Vector3(scale, scale, scale);

    // Assign to instance variable
    this.rootNode = root;

    // Create reticle (crosshair with 4 lines) - will be billboarded
    this.createReticle();

    // Create center dot - will be billboarded
    this.createCenterDot();

    // Create pulse ring if enabled - will be billboarded
    if (this.options.showPulse) {
      this.createPulseRing();
    }

    // Start animation
    this.startAnimation();
  }

  /**
   * Create crosshair reticle using planes (for billboard support)
   */
  private createReticle(): void {
    if (!this.rootNode) return;

    const size = this.options.size;
    const gap = size * 0.3; // Gap in the center
    const lineLength = size * 0.35;
    const lineWidth = size * 0.02; // Width of crosshair lines
    const color = this.options.color;

    // Create 4 thin rectangles (planes) forming a crosshair
    const lineConfigs = [
      // Top line (vertical)
      { width: lineWidth, height: lineLength, x: 0, y: gap + lineLength / 2 },
      // Bottom line (vertical)
      { width: lineWidth, height: lineLength, x: 0, y: -gap - lineLength / 2 },
      // Right line (horizontal)
      { width: lineLength, height: lineWidth, x: gap + lineLength / 2, y: 0 },
      // Left line (horizontal)
      { width: lineLength, height: lineWidth, x: -gap - lineLength / 2, y: 0 },
    ];

    lineConfigs.forEach((config, index) => {
      const plane = BABYLON.MeshBuilder.CreatePlane(
        `reticleLine_${index}`,
        { width: config.width, height: config.height },
        this.scene
      );

      // Position the plane
      plane.position = new BABYLON.Vector3(config.x, config.y, 0);

      // No individual billboard mode - root handles billboarding for entire widget

      // Create material
      const material = new BABYLON.StandardMaterial(`reticleLineMat_${index}`, this.scene);
      material.emissiveColor = color;
      material.disableLighting = true;
      material.backFaceCulling = false;
      plane.material = material;

      plane.parent = this.rootNode;
      plane.isPickable = false;
      plane.renderingGroupId = 3; // Render on top

      this.reticleLines.push(plane);
    });
  }

  /**
   * Create center dot
   */
  private createCenterDot(): void {
    if (!this.rootNode) return;

    const dot = BABYLON.MeshBuilder.CreateSphere(
      'centerDot',
      { diameter: this.options.size * 0.1 },
      this.scene
    );

    // No individual billboard mode - root handles billboarding for entire widget

    const material = new BABYLON.StandardMaterial('centerDotMaterial', this.scene);
    material.emissiveColor = this.options.color;
    material.disableLighting = true;
    dot.material = material;

    dot.parent = this.rootNode;
    dot.isPickable = false;
    dot.renderingGroupId = 3;
    this.centerDot = dot;
  }

  /**
   * Create pulse ring animation using a disc
   */
  private createPulseRing(): void {
    if (!this.rootNode) return;

    // Create a circular disc for the pulse ring
    const ring = BABYLON.MeshBuilder.CreateDisc(
      'pulseRing',
      {
        radius: this.options.size * 0.5,
        tessellation: 32
      },
      this.scene
    );

    // No individual billboard mode - root handles billboarding for entire widget

    // Create material with a ring pattern using alpha gradient
    const material = new BABYLON.StandardMaterial('pulseRingMaterial', this.scene);
    material.emissiveColor = this.options.color;
    material.disableLighting = true;
    material.alpha = 0.8;
    material.backFaceCulling = false;

    // Create a dynamic texture for the ring pattern
    const dynamicTexture = new BABYLON.DynamicTexture(
      'pulseRingTexture',
      { width: 256, height: 256 },
      this.scene,
      false
    );

    const context = dynamicTexture.getContext();
    const centerX = 128;
    const centerY = 128;
    const outerRadius = 120;
    const innerRadius = 100;

    // Draw ring gradient (deep orange)
    context.clearRect(0, 0, 256, 256);
    const gradient = context.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
    gradient.addColorStop(0, 'rgba(255, 102, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 102, 0, 1)');
    gradient.addColorStop(1, 'rgba(255, 102, 0, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    dynamicTexture.update();

    material.opacityTexture = dynamicTexture;
    material.diffuseTexture = dynamicTexture;
    ring.material = material;

    ring.parent = this.rootNode;
    ring.isPickable = false;
    ring.renderingGroupId = 3;
    this.pulseRing = ring;
  }

  /**
   * Start animation
   */
  private startAnimation(): void {
    this.animationStartTime = Date.now();
    this.isAnimating = true;

    const observer = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.isAnimating || !this.rootNode) {
        this.scene.onBeforeRenderObservable.remove(observer);
        return;
      }

      const elapsed = Date.now() - this.animationStartTime;
      const progress = Math.min(elapsed / this.options.duration, 1);

      // Animate pulse ring
      if (this.pulseRing) {
        const scale = 1 + progress * 2; // Expand from 1x to 3x
        const alpha = 0.8 * (1 - progress); // Fade out
        this.pulseRing.scaling = new BABYLON.Vector3(scale, scale, scale);
        if (this.pulseRing.material && 'alpha' in this.pulseRing.material) {
          this.pulseRing.material.alpha = alpha;
        }
      }

      // Fade out entire widget
      const fadeStart = 0.7; // Start fading at 70% of animation
      if (progress >= fadeStart) {
        const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
        const alpha = 1 - fadeProgress;

        // Apply alpha to all reticle line materials
        this.reticleLines.forEach(line => {
          if (line.material && 'alpha' in line.material) {
            line.material.alpha = alpha;
          }
        });

        if (this.centerDot && this.centerDot.material && 'alpha' in this.centerDot.material) {
          this.centerDot.material.alpha = alpha;
        }
      }

      // Hide when animation complete
      if (progress >= 1) {
        this.isAnimating = false;
        this.hide();
      }
    });
  }

  /**
   * Hide and dispose targeting widget
   */
  hide(): void {
    this.isAnimating = false;

    this.reticleLines.forEach(line => line.dispose());
    this.reticleLines = [];

    if (this.centerDot) {
      this.centerDot.dispose();
      this.centerDot = null;
    }

    if (this.pulseRing) {
      this.pulseRing.dispose();
      this.pulseRing = null;
    }

    if (this.rootNode) {
      this.rootNode.dispose();
      this.rootNode = null;
    }
  }

  /**
   * Check if widget is currently visible
   */
  isVisible(): boolean {
    return this.rootNode !== null;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.hide();
  }
}
