// Skybox Manager - Single-source environment, prevents overwrite bug
// Owner: Skybox System
// Supports intensity/rotation/blur controls

import * as BABYLON from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';

export interface SkyboxConfig {
  enabled: boolean;
  intensity: number; // 0-1
  rotation: number; // degrees (0-360)
  blur: number; // 0-1
  textureScale: number; // Scale factor for texture (affects tiling)
}

const DEFAULT_CONFIG: SkyboxConfig = {
  enabled: true,
  intensity: 1.0,
  rotation: 0,
  blur: 0,
  textureScale: 1.0,
};

export class SkyboxManager {
  private static instance: SkyboxManager | null = null;
  private scene: BABYLON.Scene | null = null;
  private skybox: BABYLON.Mesh | null = null;
  private skyboxTexture: BABYLON.CubeTexture | null = null;
  private config: SkyboxConfig = { ...DEFAULT_CONFIG };
  private groundGrid: BABYLON.Mesh | null = null;

  private constructor() {}

  static getInstance(): SkyboxManager {
    if (!SkyboxManager.instance) {
      SkyboxManager.instance = new SkyboxManager();
    }
    return SkyboxManager.instance;
  }

  /**
   * Initialize skybox manager with scene
   */
  initialize(scene: BABYLON.Scene): void {
    this.scene = scene;
    console.log('[SkyboxManager] ✅ Initialized');
  }

  /**
   * Create skybox with cloudy blue sky
   * All faces are the same cloudy blue sky
   */
  createSkybox(): void {
    if (!this.scene) {
      console.warn('[SkyboxManager] ⚠️ Scene not initialized');
      return;
    }

    try {
      // Dispose existing skybox if present
      this.disposeSkybox();

      // Make skybox massive to prevent corner visibility
      const skyboxSize = 50000; // 50km

      // Create skybox mesh using Box with BACKSIDE orientation
      this.skybox = BABYLON.MeshBuilder.CreateBox(
        'skybox',
        {
          size: skyboxSize,
          sideOrientation: BABYLON.Mesh.BACKSIDE,
        },
        this.scene
      );

      // Create cloudy blue sky texture (all faces the same)
      this.skyboxTexture = this.createCloudyBlueSkyTexture();

      // Create material
      const skyboxMaterial = new BABYLON.BackgroundMaterial('skybox_mat', this.scene);
      skyboxMaterial.reflectionTexture = this.skyboxTexture;
      skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
      skyboxMaterial.reflectionBlur = this.config.blur;
      skyboxMaterial.disableDepthWrite = true;

      // Apply material
      this.skybox.material = skyboxMaterial;

      // Configure skybox
      this.skybox.infiniteDistance = true;
      this.skybox.renderingGroupId = 0;
      this.skybox.applyFog = false;
      this.skybox.isPickable = false;
      this.skybox.setEnabled(true);
      this.skybox.isVisible = true;
      this.skybox.position = new BABYLON.Vector3(0, 0, 0);

      // Set scene environment texture for PBR reflections
      this.scene.environmentTexture = this.skyboxTexture;

      // CRITICAL: Set scene background to transparent
      this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

      // Apply config
      this.updateSkyboxConfig();

      console.log('[SkyboxManager] ✅ Created cloudy blue skybox');
    } catch (error) {
      console.warn('[SkyboxManager] ⚠️ Failed to create skybox:', error);
    }
  }

  /**
   * Create cloudy blue sky texture (all faces the same)
   * Texture scale is adjusted based on world size
   */
  private createCloudyBlueSkyTexture(): BABYLON.CubeTexture {
    const size = 512;
    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const canvases: Record<string, HTMLCanvasElement> = {};

    // Cloudy blue sky colors
    const skyBlue = '#87CEEB'; // Sky blue
    const brightBlue = '#B0E0E6'; // Powder blue (lighter)
    const cloudWhite = 'rgba(255, 255, 255, 0.8)';

    faces.forEach((face) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Create gradient sky background
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, brightBlue); // Top (zenith)
      gradient.addColorStop(0.5, skyBlue); // Middle
      gradient.addColorStop(1, skyBlue); // Bottom (horizon)
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Add fluffy white clouds across the entire face
      // Cloud distribution is uniform across all faces for consistent look
      const cloudCount = 20;
      for (let i = 0; i < cloudCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() * 15 + 10; // 10-25px clouds

        // Create soft cloud gradient
        const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        cloudGradient.addColorStop(0, cloudWhite);
        cloudGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        cloudGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = cloudGradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }

      // For bottom face (ny), make it match the gray grid floor
      // This creates seamless horizon effect
      if (face === 'ny') {
        // Bottom face is DARK GRAY to match the grid floor
        const groundColor = '#2a2a2a'; // Dark gray to match grid
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, 0, size, size);

        // Add subtle texture variation for realism
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 10;
          const baseGray = 42; // #2a2a2a = 42,42,42 in RGB
          data[i] = Math.max(0, Math.min(255, baseGray + noise));     // R
          data[i + 1] = Math.max(0, Math.min(255, baseGray + noise)); // G
          data[i + 2] = Math.max(0, Math.min(255, baseGray + noise)); // B
        }
        ctx.putImageData(imageData, 0, 0);

        console.log('[SkyboxManager] ✅ Bottom face (ny) set to DARK GRAY ground (#2a2a2a) to match grid floor');
      }

      canvases[face] = canvas;
    });

    const urls = faces.map((face) => canvases[face].toDataURL());
    return BABYLON.CubeTexture.CreateFromImages(urls, this.scene!, false);
  }

  /**
   * Create standard BabylonJS grid floor that extends to horizon
   */
  createGridFloor(): void {
    if (!this.scene) {
      console.warn('[SkyboxManager] ⚠️ Scene not initialized');
      return;
    }

    try {
      // Dispose existing grid floor if present
      if (this.groundGrid) {
        this.groundGrid.dispose();
        this.groundGrid = null;
      }

      // Create a very large ground plane that extends to horizon
      // Using a large size so it appears infinite
      const groundSize = 100000; // 100km - large enough to appear infinite

      this.groundGrid = BABYLON.MeshBuilder.CreateGround(
        'skybox_grid_floor',
        {
          width: groundSize,
          height: groundSize,
          subdivisions: 200, // High subdivisions for detailed grid
        },
        this.scene
      );

      // Create grid material
      const gridMaterial = new GridMaterial('grid_mat', this.scene);
      gridMaterial.majorUnitFrequency = 10; // Major grid lines every 10 units
      gridMaterial.minorUnitVisibility = 0.3; // Minor grid lines visibility
      gridMaterial.gridRatio = 0.5; // Grid ratio
      gridMaterial.mainColor = new BABYLON.Color3(0.2, 0.2, 0.2); // Dark gray grid lines
      gridMaterial.lineColor = new BABYLON.Color3(0.4, 0.4, 0.4); // Lighter gray for major lines
      gridMaterial.opacity = 0.8;
      // Note: maxGridSize property doesn't exist on GridMaterial

      this.groundGrid.material = gridMaterial;
      this.groundGrid.position = new BABYLON.Vector3(0, 0, 0);
      this.groundGrid.receiveShadows = true;
      this.groundGrid.isPickable = false;

      console.log('[SkyboxManager] ✅ Created grid floor');
    } catch (error) {
      console.warn('[SkyboxManager] ⚠️ Failed to create grid floor:', error);
    }
  }

  /**
   * Update skybox configuration
   */
  updateConfig(config: Partial<SkyboxConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateSkyboxConfig();

    // If skybox is being enabled, create it
    if (this.config.enabled && !this.skybox && this.scene) {
      this.createSkybox();
      this.createGridFloor();
    } else if (!this.config.enabled && this.skybox) {
      this.disposeSkybox();
      if (this.groundGrid) {
        this.groundGrid.dispose();
        this.groundGrid = null;
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SkyboxConfig {
    return { ...this.config };
  }

  /**
   * Update skybox material properties based on config
   */
  private updateSkyboxConfig(): void {
    if (!this.skybox || !this.skybox.material) return;

    const material = this.skybox.material as BABYLON.BackgroundMaterial;
    
    // Apply intensity (affects overall brightness)
    if (material.reflectionTexture) {
      material.reflectionTexture.level = this.config.intensity;
    }

    // Apply rotation (rotate skybox mesh)
    if (this.skybox) {
      this.skybox.rotation.y = (this.config.rotation * Math.PI) / 180;
    }

    // Apply blur
    material.reflectionBlur = this.config.blur;
  }

  /**
   * Dispose skybox
   */
  private disposeSkybox(): void {
    if (this.skybox) {
      this.skybox.dispose();
      this.skybox = null;
    }
    if (this.skyboxTexture) {
      this.skyboxTexture.dispose();
      this.skyboxTexture = null;
    }
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.disposeSkybox();
    if (this.groundGrid) {
      this.groundGrid.dispose();
      this.groundGrid = null;
    }
    this.scene = null;
  }

  /**
   * Check if skybox is ready
   */
  isReady(): boolean {
    return this.config.enabled && this.skybox !== null && this.skybox.isVisible;
  }
}

