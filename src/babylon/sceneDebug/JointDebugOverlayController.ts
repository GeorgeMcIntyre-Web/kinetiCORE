import * as BABYLON from '@babylonjs/core';
import { JointDebugOverlay } from '../sceneDebug/JointDebugOverlay';
import type { DetectedToolJoint } from '../sceneAnalysis/ToolingTypes';

/**
 * Joint Debug Overlay Controller
 * 
 * Integration layer for managing JointDebugOverlay in UI contexts.
 * Handles overlay lifecycle, caching joints, and toggling visibility.
 * 
 * NO "car line" concepts - tooling/model origin only.
 */
export class JointDebugOverlayController {
    private overlay: JointDebugOverlay | null = null;
    private scene: BABYLON.Scene | null = null;
    private isEnabled: boolean = false;
    private cachedJoints: DetectedToolJoint[] = [];

    constructor(scene?: BABYLON.Scene) {
        if (scene) {
            this.initialize(scene);
        }
    }

    /**
     * Initialize or reinitialize with a scene.
     */
    initialize(scene: BABYLON.Scene): void {
        // Guard: dispose old overlay if scene changed
        if (this.overlay && this.scene !== scene) {
            this.overlay.dispose();
            this.overlay = null;
        }

        this.scene = scene;
        this.overlay = new JointDebugOverlay(scene);
    }

    /**
     * Update overlay with new joints list.
     * Clears existing glyphs and shows new ones if enabled.
     */
    updateFromJoints(joints: DetectedToolJoint[]): void {
        // Cache joints for later toggle operations
        this.cachedJoints = joints;

        // Guard: no overlay instance
        if (!this.overlay) {
            return;
        }

        // Always clear existing
        this.overlay.clear();

        // Guard: not enabled or empty joints
        if (!this.isEnabled || joints.length === 0) {
            return;
        }

        // Show new glyphs
        this.overlay.showJoints(joints);
    }

    /**
     * Enable or disable the overlay.
     * When enabled, shows cached joints if available.
     * When disabled, clears and hides glyphs.
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;

        // Guard: no overlay
        if (!this.overlay) {
            return;
        }

        if (!enabled) {
            // Disable: clear and hide
            this.overlay.clear();
            this.overlay.setVisible(false);
            return;
        }

        // Enable: show cached joints if available
        if (this.cachedJoints.length > 0) {
            this.overlay.showJoints(this.cachedJoints);
            this.overlay.setVisible(true);
        }
    }

    /**
     * Clear all glyphs from the scene.
     */
    clear(): void {
        if (this.overlay) {
            this.overlay.clear();
        }
        this.cachedJoints = [];
    }

    /**
     * Dispose the overlay and cleanup resources.
     */
    dispose(): void {
        if (this.overlay) {
            this.overlay.dispose();
            this.overlay = null;
        }
        this.scene = null;
        this.cachedJoints = [];
        this.isEnabled = false;
    }

    /**
     * Get current enabled state.
     */
    getEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Get cached joints count.
     */
    getCachedJointsCount(): number {
        return this.cachedJoints.length;
    }
}
