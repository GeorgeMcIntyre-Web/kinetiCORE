// Lighting Service - Handles scene lighting setup
// Owner: Cole

import * as BABYLON from '@babylonjs/core';

export class LightingService {
  private static instance: LightingService | null = null;
  private hemisphericLight: BABYLON.HemisphericLight | null = null;
  private directionalLight: BABYLON.DirectionalLight | null = null;

  private constructor() {}

  static getInstance(): LightingService {
    if (!LightingService.instance) {
      LightingService.instance = new LightingService();
    }
    return LightingService.instance;
  }

  /**
   * Initialize lighting for the scene
   */
  initialize(scene: BABYLON.Scene): void {

    // Create realistic environment with HDR lighting
    const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
      'https://playground.babylonjs.com/textures/environment.env',
      scene
    );
    scene.environmentTexture = hdrTexture;
    // Disable skybox for transparent background
    // scene.createDefaultSkybox(hdrTexture, true, 1000, 0.3);

    // Setup realistic lighting (Y-up: light points down from above)
    this.hemisphericLight = new BABYLON.HemisphericLight(
      'hemisphericLight',
      new BABYLON.Vector3(0, 1, 0), // Y-up: light from above
      scene
    );
    this.hemisphericLight.intensity = 0.5;
    this.hemisphericLight.groundColor = new BABYLON.Color3(0.3, 0.3, 0.35);

    // Directional light with shadows (Y-up: comes from above-side)
    this.directionalLight = new BABYLON.DirectionalLight(
      'directionalLight',
      new BABYLON.Vector3(-1, -2, -1), // Y-up: direction from above
      scene
    );
    this.directionalLight.position = new BABYLON.Vector3(10, 20, 10); // Y-up: positioned above
    this.directionalLight.intensity = 0.8;
    this.directionalLight.shadowMinZ = 1;
    this.directionalLight.shadowMaxZ = 100;
  }

  /**
   * Update lighting intensity
   */
  setIntensity(intensity: number): void {
    if (this.hemisphericLight) {
      this.hemisphericLight.intensity = intensity * 0.5;
    }
    if (this.directionalLight) {
      this.directionalLight.intensity = intensity * 0.8;
    }
  }

  /**
   * Toggle shadows
   */
  setShadowsEnabled(enabled: boolean): void {
    if (this.directionalLight) {
      this.directionalLight.shadowEnabled = enabled;
    }
  }

  dispose(): void {
    this.hemisphericLight?.dispose();
    this.directionalLight?.dispose();
    this.hemisphericLight = null;
    this.directionalLight = null;
  }
}
