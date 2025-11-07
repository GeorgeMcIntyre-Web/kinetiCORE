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
  private rootNode: BABYLON.TransformNode | null = null;
  private reticleLines: BABYLON.LinesMesh[] = [];
  private centerDot: BABYLON.Mesh | null = null;
  private pulseRing: BABYLON.Mesh | null = null;
  private options: Required<TargetingWidgetOptions>;
  private animationStartTime: number = 0;
  private isAnimating: boolean = false;

  constructor(scene: BABYLON.Scene, options: TargetingWidgetOptions = {}) {
    this.scene = scene;
    this.options = {
      size: options.size ?? 0.1,
      color: options.color ?? new BABYLON.Color3(0, 1, 1), // Cyan
      duration: options.duration ?? 500,
      showPulse: options.showPulse ?? true,
    };
  }

  /**
   * Show targeting widget at specified position
   */
  show(position: BABYLON.Vector3, normal?: BABYLON.Vector3): void {
    // Clean up existing widget
    this.hide();

    // Create root node
    this.rootNode = new BABYLON.TransformNode('targetingWidget', this.scene);
    this.rootNode.position = position;

    // Orient to surface normal if provided
    if (normal) {
      const up = BABYLON.Vector3.Up();
      const angle = Math.acos(BABYLON.Vector3.Dot(up, normal));
      const axis = BABYLON.Vector3.Cross(up, normal);
      if (axis.length() > 0.001) {
        this.rootNode.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
      }
    }

    // Create reticle (crosshair with 4 lines)
    this.createReticle();

    // Create center dot
    this.createCenterDot();

    // Create pulse ring if enabled
    if (this.options.showPulse) {
      this.createPulseRing();
    }

    // Start animation
    this.startAnimation();
  }

  /**
   * Create crosshair reticle
   */
  private createReticle(): void {
    if (!this.rootNode) return;

    const size = this.options.size;
    const gap = size * 0.3; // Gap in the center
    const lineLength = size * 0.35;
    const color = this.options.color;

    // Create 4 lines forming a crosshair
    const lines = [
      // Top line
      [
        new BABYLON.Vector3(0, gap, 0),
        new BABYLON.Vector3(0, gap + lineLength, 0)
      ],
      // Bottom line
      [
        new BABYLON.Vector3(0, -gap, 0),
        new BABYLON.Vector3(0, -gap - lineLength, 0)
      ],
      // Right line
      [
        new BABYLON.Vector3(gap, 0, 0),
        new BABYLON.Vector3(gap + lineLength, 0, 0)
      ],
      // Left line
      [
        new BABYLON.Vector3(-gap, 0, 0),
        new BABYLON.Vector3(-gap - lineLength, 0, 0)
      ],
    ];

    lines.forEach((points, index) => {
      const line = BABYLON.MeshBuilder.CreateLines(
        `reticleLine_${index}`,
        { points, updatable: true },
        this.scene
      );
      line.color = color;
      line.parent = this.rootNode;
      line.isPickable = false;
      line.renderingGroupId = 3; // Render on top
      this.reticleLines.push(line);
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
   * Create pulse ring animation
   */
  private createPulseRing(): void {
    if (!this.rootNode) return;

    const ring = BABYLON.MeshBuilder.CreateTorus(
      'pulseRing',
      {
        diameter: this.options.size,
        thickness: this.options.size * 0.02,
        tessellation: 32
      },
      this.scene
    );

    const material = new BABYLON.StandardMaterial('pulseRingMaterial', this.scene);
    material.emissiveColor = this.options.color;
    material.disableLighting = true;
    material.alpha = 0.8;
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

        // Apply alpha to all components
        this.reticleLines.forEach(line => {
          line.alpha = alpha;
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
