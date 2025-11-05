// Skybox Manager - Single-source environment, prevents overwrite bug
// Owner: Skybox System
// Supports intensity/rotation/blur controls

import * as BABYLON from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';
import { createTriplanarFloor, TriplanarFloorOptions } from './TriplanarFloorShader';

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
  enabled: true,
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
  enabled: true,
  skyPreset: 'day',
  intensity: 1.0,
  rotation: 0,
  blur: 0,
  textureScale: 1.0,
  floor: { ...DEFAULT_FLOOR_CONFIG },
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

      // CRITICAL: Set scene background to transparent
      this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

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
   * Create floor (grid or material-based)
   */
  async createGridFloor(): Promise<void> {
    if (!this.scene) {
      console.warn('[SkyboxManager] ⚠️ Scene not initialized');
      return;
    }

    // Don't create floor if disabled
    if (!this.config.floor.enabled) {
      if (this.groundGrid) {
        this.groundGrid.dispose();
        this.groundGrid = null;
      }
      return;
    }

    try {
      // Dispose existing floor if present
      if (this.groundGrid) {
        this.groundGrid.dispose();
        this.groundGrid = null;
      }

      const floorConfig = this.config.floor;
      
      // Determine ground size
      const groundSize = floorConfig.size === 'infinite' 
        ? 100000  // 100km - large enough to appear infinite
        : floorConfig.size; // Use specified size

      // Create floor based on material type
      console.log(`[SkyboxManager] Creating floor - materialType: ${floorConfig.materialType}, size: ${groundSize}`);
      if (floorConfig.materialType === 'grid') {
        this.createGridFloorMesh(groundSize);
        console.log('[SkyboxManager] ✅ Created grid floor');
      } else {
        // Create material-based floor (stone, concrete, epoxy)
        await this.createMaterialFloor(floorConfig.materialType, groundSize);
        console.log(`[SkyboxManager] ✅ Created ${floorConfig.materialType} floor`);
      }
      } catch (error) {
        console.warn('[SkyboxManager] ⚠️ Failed to create floor:', error);
      }
    }

  /**
   * Create grid floor mesh
   */
  private createGridFloorMesh(groundSize: number): void {
    this.groundGrid = BABYLON.MeshBuilder.CreateGround(
      'skybox_grid_floor',
      {
        width: groundSize,
        height: groundSize,
        subdivisions: groundSize === 'infinite' || groundSize >= 100000 ? 200 : Math.max(50, Math.floor(groundSize / 500)),
      },
      this.scene!
    );

    // Create grid material with config values
    const gridMaterial = new GridMaterial('grid_mat', this.scene!);
    const floorConfig = this.config.floor;
    gridMaterial.majorUnitFrequency = floorConfig.majorUnitFrequency;
    gridMaterial.minorUnitVisibility = floorConfig.minorUnitVisibility;
    gridMaterial.gridRatio = floorConfig.gridRatio;
    gridMaterial.mainColor = new BABYLON.Color3(floorConfig.mainColor[0], floorConfig.mainColor[1], floorConfig.mainColor[2]);
    gridMaterial.lineColor = new BABYLON.Color3(floorConfig.lineColor[0], floorConfig.lineColor[1], floorConfig.lineColor[2]);
    gridMaterial.opacity = floorConfig.opacity;

    this.groundGrid.material = gridMaterial;
    this.groundGrid.position = new BABYLON.Vector3(0, 0, 0);
    this.groundGrid.receiveShadows = true;
    this.groundGrid.isPickable = false;

    console.log('[SkyboxManager] ✅ Created grid floor');
  }

  /**
   * Create material-based floor (stone, concrete, epoxy) using triplanar PBR shader
   */
  private async createMaterialFloor(materialType: FloorMaterialType, groundSize: number): Promise<void> {
    if (!this.scene) {
      console.warn('[SkyboxManager] ⚠️ Scene not initialized for material floor');
      return;
    }
    
    const floorConfig = this.config.floor;
    const triplanarConfig = floorConfig.triplanar || DEFAULT_TRIPLANAR_CONFIG;
    const textureUrls = floorConfig.textureUrls || {};
    
    console.log(`[SkyboxManager] Creating ${materialType} floor with size ${groundSize}`);

    // Apply material-specific presets
    let materialPreset: Partial<TriplanarFloorConfig> = {};
    switch (materialType) {
      case 'stone':
        materialPreset = { roughnessBias: 0.0, metallic: 0.01 };
        break;
      case 'concrete':
        materialPreset = { roughnessBias: 0.0, metallic: 0.01 };
        break;
      case 'epoxy':
        materialPreset = { roughnessBias: 0.08, metallic: 0.08 };
        break;
    }

    const finalConfig = { ...triplanarConfig, ...materialPreset };

    // Use triplanar shader if textures are available, otherwise fallback to simple PBR
    if (textureUrls.baseColorUrl && textureUrls.normalUrl && textureUrls.roughAoUrl && 
        textureUrls.microNormalUrl && textureUrls.noiseUrl) {
      try {
        const result = await createTriplanarFloor(
          this.scene!,
          {
            baseColorUrl: textureUrls.baseColorUrl,
            normalUrl: textureUrls.normalUrl,
            roughAoUrl: textureUrls.roughAoUrl,
            microNormalUrl: textureUrls.microNormalUrl,
            noiseUrl: textureUrls.noiseUrl,
          },
          {
            size: groundSize,
            ...finalConfig,
          }
        );

        this.groundGrid = result.ground;
        this.groundGrid.position = new BABYLON.Vector3(0, 0, 0);
        this.groundGrid.receiveShadows = true;
        this.groundGrid.isPickable = false;

        console.log(`[SkyboxManager] ✅ Created ${materialType} floor with triplanar PBR shader`);
        return;
      } catch (error) {
        console.warn('[SkyboxManager] ⚠️ Failed to create triplanar floor, falling back to simple PBR:', error);
      }
    }

    // Fallback: simple PBR material
    this.groundGrid = BABYLON.MeshBuilder.CreateGround(
      'skybox_material_floor',
      {
        width: groundSize,
        height: groundSize,
        subdivisions: groundSize >= 100000 ? 200 : Math.max(50, Math.floor(groundSize / 500)),
      },
      this.scene!
    );

    const material = new BABYLON.PBRMetallicRoughnessMaterial(`floor_${materialType}`, this.scene!);
    
    switch (materialType) {
      case 'stone':
        material.baseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        material.metallicFactor = 0.0;
        material.roughnessFactor = 0.8;
        break;
      case 'concrete':
        material.baseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
        material.metallicFactor = 0.0;
        material.roughnessFactor = 0.9;
        break;
      case 'epoxy':
        material.baseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        material.metallicFactor = 0.1;
        material.roughnessFactor = 0.2;
        break;
    }

    this.groundGrid.material = material;
    this.groundGrid.position = new BABYLON.Vector3(0, 0, 0);
    this.groundGrid.receiveShadows = true;
    this.groundGrid.isPickable = false;

    console.log(`[SkyboxManager] ✅ Created ${materialType} floor (simple PBR fallback)`);
  }

  /**
   * Update skybox configuration
   */
  updateConfig(config: Partial<SkyboxConfig>): void {
    // Capture old values before update for change detection
    const oldFloorSize = this.config.floor.size;
    const oldFloorMaterialType = this.config.floor.materialType;
    const oldFloorEnabled = this.config.floor.enabled;
    
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
      if (this.groundGrid) {
        this.groundGrid.dispose();
        this.groundGrid = null;
      }
    }

    // If floor config changed, recreate grid floor
    if (this.config.enabled && this.scene && config.floor !== undefined) {
      // Check if material type changed - compare with old value
      const materialTypeChanged = config.floor.materialType !== undefined && 
                                  config.floor.materialType !== oldFloorMaterialType;
      
      // Check if size actually changed - compare with old value
      const sizeChanged = config.floor.size !== undefined && 
                          config.floor.size !== oldFloorSize;
      
      // Check if enabled changed - compare with old value
      const enabledChanged = config.floor.enabled !== undefined && 
                             config.floor.enabled !== oldFloorEnabled;
      
      if (materialTypeChanged || sizeChanged || enabledChanged) {
        console.log(`[SkyboxManager] Floor config changed - materialType: ${oldFloorMaterialType} -> ${this.config.floor.materialType}, size: ${oldFloorSize} -> ${this.config.floor.size}, enabled: ${oldFloorEnabled} -> ${this.config.floor.enabled}`);
        console.log(`[SkyboxManager] Triggers - materialTypeChanged: ${materialTypeChanged}, sizeChanged: ${sizeChanged}, enabledChanged: ${enabledChanged}`);
        this.createGridFloor().catch(err => {
          console.error('[SkyboxManager] ❌ Failed to recreate floor:', err);
        });
      }
    }

    // Update triplanar shader uniforms if material exists and is a shader material
    if (this.groundGrid && this.groundGrid.material && config.floor?.triplanar) {
      const mat = this.groundGrid.material as any;
      if (mat.setFloat && mat.getClassName && mat.getClassName() === 'ShaderMaterial') {
        const triplanar = { ...this.config.floor.triplanar, ...config.floor.triplanar };
        mat.setFloat('uMacroScale', triplanar.macroScale);
        mat.setFloat('uMicroScale', triplanar.microScale);
        mat.setFloat('uNoiseScale', triplanar.noiseScale);
        mat.setFloat('uNoiseStrength', triplanar.noiseStrength);
        mat.setFloat('uRoughnessBias', triplanar.roughnessBias);
        mat.setFloat('uAOWeight', triplanar.aoWeight);
        mat.setFloat('uMetallic', triplanar.metallic);
        mat.setFloat('uNormalStrength', triplanar.normalStrength);
        mat.setFloat('uMicroNormalStrength', triplanar.microNormalStrength);
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

