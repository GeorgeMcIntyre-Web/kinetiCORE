// Skybox Manager - Single-source environment, prevents overwrite bug
// Owner: Skybox System
// Supports intensity/rotation/blur controls

import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../SceneManager';
import { FloorType } from '../../core/types';
import { GROUND_SIZE } from '../../core/constants';

export type FloorMaterialType = 'grid' | 'stone' | 'concrete' | 'epoxy';

export interface TriplanarFloorConfig {
  macroScale: number; // meters per tile (6-16)
  microScale: number; // fine detail (30-80)
  noiseScale: number; // anti-tiling cell size (8-20)
  noiseStrength: number; // 0-1
  roughnessBias: number; // -0.2 to +0.2
  aoWeight: number; // 0-1
  metallic: number; // 0-0.2
  normalStrength: number; // 0.5-1.5
  microNormalStrength: number; // 0.5-1.2
}

export interface FloorConfig {
  enabled: boolean;
  materialType: FloorMaterialType; // Floor material type
  size: 'infinite' | number; // 'infinite' or size in units
  // Grid settings
  majorUnitFrequency: number; // Major grid lines every N units (for grid type)
  minorUnitVisibility: number; // 0-1, visibility of minor grid lines (for grid type)
  gridRatio: number; // Grid spacing ratio (for grid type)
  mainColor: [number, number, number]; // RGB color for main grid (0-1) (for grid type)
  lineColor: [number, number, number]; // RGB color for major lines (0-1) (for grid type)
  opacity: number; // 0-1, grid opacity (for grid type)
  // Triplanar PBR settings (for stone/concrete/epoxy)
  triplanar?: TriplanarFloorConfig;
  textureUrls?: {
    baseColorUrl?: string;
    normalUrl?: string;
    roughAoUrl?: string;
    microNormalUrl?: string;
    noiseUrl?: string;
  };
}

export type SkyPreset = 'day' | 'night' | 'sunset' | 'sunrise';

export interface SkyboxConfig {
  enabled: boolean;
  skyPreset: SkyPreset; // Sky time preset
  intensity: number; // 0-1
  rotation: number; // degrees (0-360)
  blur: number; // 0-1
  textureScale: number; // Scale factor for texture (affects tiling)
  floor: FloorConfig;
}

const DEFAULT_TRIPLANAR_CONFIG: TriplanarFloorConfig = {
  macroScale: 10.0,
  microScale: 48.0,
  noiseScale: 14.0,
  noiseStrength: 0.55,
  roughnessBias: 0.05, // Epoxy-ish; 0.0 for plain concrete
  aoWeight: 0.6,
  metallic: 0.03,
  normalStrength: 1.0,
  microNormalStrength: 0.9,
};

const DEFAULT_FLOOR_CONFIG: FloorConfig = {
  enabled: false,
  materialType: 'grid',
  size: 'infinite',
  majorUnitFrequency: 10,
  minorUnitVisibility: 0.3,
  gridRatio: 0.5,
  mainColor: [0.2, 0.2, 0.2],
  lineColor: [0.4, 0.4, 0.4],
  opacity: 0.8,
  triplanar: { ...DEFAULT_TRIPLANAR_CONFIG },
  textureUrls: {
    baseColorUrl: '/assets/warehouse_floor_ultra/baseColor.jpg',
    normalUrl: '/assets/warehouse_floor_ultra/normal.jpg',
    roughAoUrl: '/assets/warehouse_floor_ultra/roughAo.jpg',
    microNormalUrl: '/assets/warehouse_floor_ultra/microNormal.jpg',
    noiseUrl: '/assets/warehouse_floor_ultra/noise.png',
  },
};

const DEFAULT_CONFIG: SkyboxConfig = {
  enabled: false,
  skyPreset: 'day',
  intensity: 1.0,
  rotation: 0,
  blur: 0,
  textureScale: 1.0,
  floor: { ...DEFAULT_FLOOR_CONFIG },
};

// Singleton reference to prevent multiple skyboxes
let skyboxOnce: BABYLON.Mesh | null = null;

export class SkyboxManager {
  private static instance: SkyboxManager | null = null;
  private scene: BABYLON.Scene | null = null;
  private skybox: BABYLON.Mesh | null = null;
  private skyboxTexture: BABYLON.CubeTexture | null = null;
  private config: SkyboxConfig = { ...DEFAULT_CONFIG };
  private lastFloorSize: 'infinite' | number = 'infinite';

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
   * Guarded to prevent overwrites
   */
  createSkybox(): void {
    if (!this.config.enabled) {
      console.log('[SkyboxManager] Skybox disabled - skipping creation');
      return;
    }
    if (!this.scene) {
      console.warn('[SkyboxManager] ⚠️ Scene not initialized');
      return;
    }

    // Guard: check if skybox already exists and is valid
    const existingSkybox = this.scene.getMeshByName("skybox");
    if (existingSkybox && existingSkybox === skyboxOnce && !existingSkybox.isDisposed()) {
      console.log('[SkyboxManager] Skybox already exists, skipping recreation');
      this.skybox = existingSkybox as BABYLON.Mesh;
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

      // Create sky texture based on preset
      this.skyboxTexture = this.createSkyTexture(this.config.skyPreset);

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
      
      // Set environment intensity for better material separation
      this.scene.environmentIntensity = 1.2;

      // CRITICAL: Set scene background to transparent
      this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

      // Register singleton
      skyboxOnce = this.skybox;

      // Apply config
      this.updateSkyboxConfig();

      console.log(`[SkyboxManager] ✅ Created skybox (${this.config.skyPreset} preset)`);
    } catch (error) {
      console.warn('[SkyboxManager] ⚠️ Failed to create skybox:', error);
    }
  }

  /**
   * Create sky texture based on preset (day, night, sunset, sunrise)
   */
  private createSkyTexture(preset: SkyPreset): BABYLON.CubeTexture {
    switch (preset) {
      case 'day':
        return this.createDaySkyTexture();
      case 'night':
        return this.createNightSkyTexture();
      case 'sunset':
        return this.createSunsetSkyTexture();
      case 'sunrise':
        return this.createSunriseSkyTexture();
      default:
        return this.createDaySkyTexture();
    }
  }

  /**
   * Create day sky texture (cloudy blue sky) - all faces the same
   * Texture scale is adjusted based on world size
   */
  private createDaySkyTexture(): BABYLON.CubeTexture {
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
   * Create night sky texture (dark with stars)
   */
  private createNightSkyTexture(): BABYLON.CubeTexture {
    const size = 512;
    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const canvases: Record<string, HTMLCanvasElement> = {};

    // Night sky colors
    const darkBlue = '#0a0a1a'; // Very dark blue
    const midnightBlue = '#1a1a2e'; // Slightly lighter
    const starColor = '#ffffff'; // White stars

    faces.forEach((face) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Create gradient sky background (darker at horizon)
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, darkBlue); // Top (zenith) - darkest
      gradient.addColorStop(0.5, midnightBlue); // Middle
      gradient.addColorStop(1, '#0f0f1f'); // Bottom (horizon) - slightly lighter
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Add stars (more stars at top, fewer at horizon)
      const starCount = face === 'py' ? 150 : 100; // Top face has more stars
      for (let i = 0; i < starCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const brightness = Math.random();
        const starSize = brightness > 0.7 ? 1.5 : brightness > 0.4 ? 1 : 0.5;
        
        ctx.fillStyle = starColor;
        ctx.globalAlpha = brightness * 0.8 + 0.2;
        ctx.beginPath();
        ctx.arc(x, y, starSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Add twinkle effect for bright stars
        if (brightness > 0.7) {
          ctx.globalAlpha = brightness * 0.3;
          ctx.beginPath();
          ctx.arc(x, y, starSize * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;

      // Bottom face matches ground
      if (face === 'ny') {
        const groundColor = '#1a1a1a'; // Dark gray for night ground
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, 0, size, size);
      }

      canvases[face] = canvas;
    });

    const urls = faces.map((face) => canvases[face].toDataURL());
    return BABYLON.CubeTexture.CreateFromImages(urls, this.scene!, false);
  }

  /**
   * Create sunset sky texture (orange, pink, purple gradient)
   */
  private createSunsetSkyTexture(): BABYLON.CubeTexture {
    const size = 512;
    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const canvases: Record<string, HTMLCanvasElement> = {};

    faces.forEach((face) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Create sunset gradient (orange/pink at horizon, purple at top)
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, '#4a1a5c'); // Top (zenith) - deep purple
      gradient.addColorStop(0.3, '#7a3a8c'); // Upper - purple
      gradient.addColorStop(0.6, '#ff6b6b'); // Mid - coral red
      gradient.addColorStop(0.8, '#ffa500'); // Lower - orange
      gradient.addColorStop(1, '#ff8c42'); // Bottom (horizon) - bright orange
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Add soft cloud wisps
      const cloudCount = 15;
      for (let i = 0; i < cloudCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size * 0.6; // Clouds mainly in upper half
        const radius = Math.random() * 20 + 15;
        
        const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        cloudGradient.addColorStop(0, 'rgba(255, 200, 150, 0.3)');
        cloudGradient.addColorStop(0.5, 'rgba(255, 180, 120, 0.2)');
        cloudGradient.addColorStop(1, 'rgba(255, 150, 100, 0)');
        ctx.fillStyle = cloudGradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }

      // Bottom face matches ground
      if (face === 'ny') {
        const groundColor = '#2a1a1a'; // Dark red-brown for sunset ground
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, 0, size, size);
      }

      canvases[face] = canvas;
    });

    const urls = faces.map((face) => canvases[face].toDataURL());
    return BABYLON.CubeTexture.CreateFromImages(urls, this.scene!, false);
  }

  /**
   * Create sunrise sky texture (soft pink, yellow, light blue gradient)
   */
  private createSunriseSkyTexture(): BABYLON.CubeTexture {
    const size = 512;
    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const canvases: Record<string, HTMLCanvasElement> = {};

    faces.forEach((face) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Create sunrise gradient (pink/yellow at horizon, light blue at top)
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, '#87ceeb'); // Top (zenith) - light sky blue
      gradient.addColorStop(0.4, '#ffb6c1'); // Upper - light pink
      gradient.addColorStop(0.7, '#ffd700'); // Mid - golden yellow
      gradient.addColorStop(0.9, '#ff8c69'); // Lower - salmon
      gradient.addColorStop(1, '#ff6347'); // Bottom (horizon) - tomato red
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Add soft morning clouds
      const cloudCount = 12;
      for (let i = 0; i < cloudCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size * 0.5; // Clouds in upper half
        const radius = Math.random() * 18 + 12;
        
        const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        cloudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        cloudGradient.addColorStop(0.5, 'rgba(255, 240, 200, 0.3)');
        cloudGradient.addColorStop(1, 'rgba(255, 220, 180, 0)');
        ctx.fillStyle = cloudGradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }

      // Bottom face matches ground
      if (face === 'ny') {
        const groundColor = '#2a2a1a'; // Dark yellow-brown for sunrise ground
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, 0, size, size);
      }

      canvases[face] = canvas;
    });

    const urls = faces.map((face) => canvases[face].toDataURL());
    return BABYLON.CubeTexture.CreateFromImages(urls, this.scene!, false);
  }

  /**
   * Create floor (grid or material-based) using the shared SceneManager ground/grid
   */
  async createGridFloor(): Promise<void> {
    const sceneManager = SceneManager.getInstance();
    const ground = sceneManager.getGround();

    if (!ground) {
      console.warn('[SkyboxManager] ⚠️ Scene ground not initialized');
      return;
    }

    const floorConfig = this.config.floor;

    if (!floorConfig.enabled) {
      sceneManager.setGridOverlayVisible(false);
      sceneManager.setFloorType('concrete-polished');
      return;
    }

    // Resize ground if needed
    if (floorConfig.size !== this.lastFloorSize) {
      if (floorConfig.size === 'infinite') {
        sceneManager.resizeFloor(GROUND_SIZE, GROUND_SIZE);
      } else {
        const size = typeof floorConfig.size === 'number' ? floorConfig.size : GROUND_SIZE;
        sceneManager.resizeFloor(size, size);
      }
      this.lastFloorSize = floorConfig.size;
    }

    if (floorConfig.materialType === 'grid') {
      sceneManager.setFloorType('grid-only');
      sceneManager.setGridOverlayOptions({
        majorUnitFrequency: floorConfig.majorUnitFrequency,
        minorUnitVisibility: floorConfig.minorUnitVisibility,
        gridRatio: floorConfig.gridRatio,
        mainColor: floorConfig.mainColor,
        lineColor: floorConfig.lineColor,
        opacity: floorConfig.opacity,
      });
      sceneManager.setGridOverlayVisible(true);
    } else {
      sceneManager.setGridOverlayVisible(false);
      sceneManager.setFloorType(this.mapFloorMaterialToFloorType(floorConfig.materialType));
    }
  }

  private mapFloorMaterialToFloorType(materialType: FloorMaterialType): FloorType {
    switch (materialType) {
      case 'stone':
        return 'tiles-ceramic';
      case 'epoxy':
        return 'epoxy-gray';
      case 'concrete':
        return 'concrete-polished';
      case 'grid':
      default:
        return 'grid-only';
    }
  }

  /**
   * Update skybox configuration
   */
  updateConfig(config: Partial<SkyboxConfig>): void {
    // Capture old values before update for change detection
    const previousFloorConfig: FloorConfig = { ...this.config.floor };
    
    // Handle nested floor config updates
    if (config.floor !== undefined) {
      this.config.floor = { ...this.config.floor, ...config.floor };
    }
    
    // Check if sky preset changed - if so, recreate skybox texture
    const skyPresetChanged = config.skyPreset !== undefined && 
                            config.skyPreset !== this.config.skyPreset;
    
    // Update other skybox config (excluding floor)
    const { floor, ...skyboxConfig } = config;
    this.config = { ...this.config, ...skyboxConfig };
    
    // If sky preset changed and skybox exists, recreate the texture
    if (skyPresetChanged && this.skybox && this.skybox.material && this.scene) {
      // Dispose old texture
      if (this.skyboxTexture) {
        this.skyboxTexture.dispose();
      }
      
      // Create new texture based on preset
      this.skyboxTexture = this.createSkyTexture(this.config.skyPreset);
      
      // Update material with new texture
      const material = this.skybox.material as BABYLON.BackgroundMaterial;
      material.reflectionTexture = this.skyboxTexture;
      material.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
      
      // Update scene environment texture
      this.scene.environmentTexture = this.skyboxTexture;
      
      console.log(`[SkyboxManager] ✅ Sky preset changed to: ${this.config.skyPreset}`);
    }
    
    this.updateSkyboxConfig();

    // If skybox is being enabled, create it
    if (this.config.enabled && !this.skybox && this.scene) {
      this.createSkybox();
      this.createGridFloor().catch(err => console.warn('[SkyboxManager] Failed to create floor:', err));
    } else if (!this.config.enabled && this.skybox) {
      this.disposeSkybox();
      SceneManager.getInstance().setGridOverlayVisible(false);
    }

    // If floor config changed, recreate grid floor
    if (this.scene && config.floor !== undefined) {
      this.handleFloorConfigUpdate(config.floor, previousFloorConfig);
    }
  }

  private didGridSettingsChange(update: Partial<FloorConfig>, previous: FloorConfig): boolean {
    if (
      update.majorUnitFrequency !== undefined &&
      update.majorUnitFrequency !== previous.majorUnitFrequency
    ) {
      return true;
    }
    if (
      update.minorUnitVisibility !== undefined &&
      update.minorUnitVisibility !== previous.minorUnitVisibility
    ) {
      return true;
    }
    if (update.gridRatio !== undefined && update.gridRatio !== previous.gridRatio) {
      return true;
    }
    if (update.opacity !== undefined && update.opacity !== previous.opacity) {
      return true;
    }
    if (
      update.mainColor !== undefined &&
      !this.areColorArraysEqual(update.mainColor, previous.mainColor)
    ) {
      return true;
    }
    if (
      update.lineColor !== undefined &&
      !this.areColorArraysEqual(update.lineColor, previous.lineColor)
    ) {
      return true;
    }
    return false;
  }

  private areColorArraysEqual(
    a?: [number, number, number],
    b?: [number, number, number]
  ): boolean {
    if (!a || !b) {
      return a === b;
    }
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }

  private applyGridOverlaySettings(): void {
    const floorConfig = this.config.floor;
    if (!floorConfig.enabled || floorConfig.materialType !== 'grid') {
      return;
    }

    const sceneManager = SceneManager.getInstance();
    sceneManager.setGridOverlayOptions({
      majorUnitFrequency: floorConfig.majorUnitFrequency,
      minorUnitVisibility: floorConfig.minorUnitVisibility,
      gridRatio: floorConfig.gridRatio,
      mainColor: floorConfig.mainColor,
      lineColor: floorConfig.lineColor,
      opacity: floorConfig.opacity,
    });
    sceneManager.setGridOverlayVisible(true);
  }

  private handleFloorConfigUpdate(update: Partial<FloorConfig>, previous: FloorConfig): void {
    const materialTypeChanged =
      update.materialType !== undefined && update.materialType !== previous.materialType;
    const sizeChanged = update.size !== undefined && update.size !== previous.size;
    const enabledChanged = update.enabled !== undefined && update.enabled !== previous.enabled;
    const gridSettingsChanged = this.didGridSettingsChange(update, previous);

    if (!materialTypeChanged && !sizeChanged && !enabledChanged && !gridSettingsChanged) {
      return;
    }

    if (!this.scene) {
      return;
    }

    if (materialTypeChanged || sizeChanged || enabledChanged) {
      console.log(
        `[SkyboxManager] Floor config changed - materialType: ${previous.materialType} -> ${this.config.floor.materialType}, size: ${previous.size} -> ${this.config.floor.size}, enabled: ${previous.enabled} -> ${this.config.floor.enabled}`
      );
      console.log(
        `[SkyboxManager] Triggers - materialTypeChanged: ${materialTypeChanged}, sizeChanged: ${sizeChanged}, enabledChanged: ${enabledChanged}`
      );
      this.createGridFloor().catch((err) => {
        console.error('[SkyboxManager] ❌ Failed to apply floor settings:', err);
      });
    } else if (gridSettingsChanged) {
      this.applyGridOverlaySettings();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SkyboxConfig {
    return { ...this.config };
  }

  getFloorConfig(): FloorConfig {
    return { ...this.config.floor };
  }

  updateFloorConfig(update: Partial<FloorConfig>): void {
    const previous = { ...this.config.floor };
    this.config.floor = { ...this.config.floor, ...update };
    this.handleFloorConfigUpdate(update, previous);
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
      const wasSingleton = skyboxOnce === this.skybox;
      this.skybox.dispose();
      this.skybox = null;
      if (wasSingleton) {
        skyboxOnce = null;
      }
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
    this.scene = null;
  }

  /**
   * Check if skybox is ready
   */
  isReady(): boolean {
    return this.config.enabled && this.skybox !== null && this.skybox.isVisible;
  }
}

