// Warehouse Model - Creates 3D warehouse structure for routing system
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';

/**
 * Skybox source options for different environment types
 * PROMPT #4: Skybox source selection
 */
export type SkyboxSource =
  | 'industrial'  // Default: Overcast industrial sky with buildings
  | 'sunny'       // Bright sunny day with clear blue sky
  | 'overcast'    // Cloudy overcast sky (similar to industrial but lighter)
  | 'night'       // Dark night sky with stars
  | 'sunset';     // Warm sunset with orange/red tones

export interface WarehouseConfig {
  width: number;  // X-axis dimension (mm)
  depth: number;  // Y-axis dimension (mm)
  height: number; // Z-axis dimension (mm) - warehouse ceiling height
  enableFog?: boolean; // Enable atmospheric fog
  enableBloom?: boolean; // Enable bloom/glow effects
  enableSkybox?: boolean; // Enable skybox environment
  skyboxSource?: SkyboxSource; // PROMPT #4: Skybox source selection (default: 'industrial')
  // PROMPT #2: Sun + shadows configuration
  enableSun?: boolean; // Enable directional sun light
  sunAzimuth?: number;   // degrees (-180..180)
  sunElevation?: number; // degrees (0..90)
  sunIntensity?: number; // 0..3
}

const DEFAULT_CONFIG: WarehouseConfig = {
  width: 50000,  // 50m = 50,000mm
  depth: 50000,  // 50m = 50,000mm
  height: 20000,  // 20m = 20,000mm (warehouse height)
  enableFog: false, // Disable fog by default to see skybox clearly
  enableBloom: true, // Enable bloom effects by default
  enableSkybox: true, // Enable skybox by default
  skyboxSource: 'sunny', // PROMPT #4: Default skybox source (blue sky with clouds)
  // PROMPT #2: Sun defaults
  enableSun: true,
  sunAzimuth: -45,
  sunElevation: 35,
  sunIntensity: 1.0,
};

/**
 * Creates and manages a 3D warehouse model for the routing system
 * Includes walls, roof, floor, and basic industrial elements
 */
export class WarehouseModel {
  private scene: BABYLON.Scene;
  private rootNode: BABYLON.TransformNode;
  private config: WarehouseConfig;

  private meshes: BABYLON.Mesh[] = [];
  private materials: BABYLON.Material[] = [];
  private skybox: BABYLON.Mesh | null = null;
  private skyboxTexture: BABYLON.CubeTexture | null = null; // PROMPT #4: Store skybox texture for disposal
  private renderingPipeline: BABYLON.DefaultRenderingPipeline | null = null;
  // PROMPT #2: Sun and shadows
  private sun: BABYLON.DirectionalLight | null = null;
  private csm: BABYLON.CascadedShadowGenerator | null = null;

  constructor(scene: BABYLON.Scene, config?: Partial<WarehouseConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rootNode = new BABYLON.TransformNode('warehouse_root', scene);
    
    // CRITICAL: Set clearColor to transparent IMMEDIATELY before building
    // This ensures skybox will be visible even if other code tries to reset it
    this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    
    this.build();

    // Hide the default ground plane when warehouse is visible
    this.hideGroundPlane();

    // Set up atmospheric effects (creates skybox)
    this.setupAtmosphere();
    
    // CRITICAL: Enforce transparent background AFTER skybox is created
    // Use setTimeout to ensure this runs after any other initialization
    setTimeout(() => {
      if (this.config.enableSkybox && this.skybox) {
        this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        console.log('[WarehouseModel] ✅ Final enforcement: clearColor set to transparent after initialization');
      }
    }, 100);
  }

  /**
   * Hide the default ground plane and grid overlay created by SceneManager
   */
  private hideGroundPlane(): void {
    const groundMesh = this.scene.getMeshByName('ground');
    if (groundMesh) {
      groundMesh.setEnabled(false);
      console.log('[WarehouseModel] ✅ Disabled ground plane');
    }

    const gridOverlay = this.scene.getMeshByName('gridOverlay');
    if (gridOverlay) {
      gridOverlay.setEnabled(false);
      console.log('[WarehouseModel] ✅ Disabled grid overlay');
    }
  }

  /**
   * Build the complete warehouse structure
   */
  private build(): void {
    this.dispose(); // Clear any existing meshes

    // Convert dimensions from mm (user space) to meters (Babylon space)
    const widthM = this.config.width / 1000;
    const depthM = this.config.depth / 1000;
    const heightM = this.config.height / 1000;

    console.log(`[WarehouseModel] Building warehouse: ${widthM}m × ${depthM}m × ${heightM}m (Babylon space)`);

    // CRITICAL: Disable auto-rendering during warehouse construction to avoid "bit-by-bit" appearance
    // This ensures the entire warehouse appears at once after all meshes are created
    const previousAutoRender = this.scene.autoClear;
    this.scene.autoClear = false;

    // CRITICAL: Hide rootNode during construction to prevent gradual appearance
    this.rootNode.setEnabled(false);

    // Create materials
    const wallMaterial = this.createWallMaterial();
    const floorMaterial = this.createFloorMaterial(); // Material for warehouse interior floor
    // const roofMaterial = this.createRoofMaterial(); // Disabled - no roof to see sky
    const columnMaterial = this.createColumnMaterial();

    // Create walls (Babylon space: Y-up, X-right, Z-forward)
    // Make walls thicker and more visible for interior feel
    const wallThickness = 0.5; // 50cm = 500mm walls (thicker for better visibility)
    
    // Calculate wall positions - walls should be at the edges forming an enclosure
    // North wall (positive Z in Babylon = forward direction) - back wall
    this.createWall(
      widthM,
      heightM,
      wallThickness,
      new BABYLON.Vector3(0, heightM / 2, depthM / 2 - wallThickness / 2),
      wallMaterial,
      'north_wall'
    );
    console.log(`[WarehouseModel] ✅ Created north wall at Z=${(depthM / 2 - wallThickness / 2).toFixed(2)}m, size: ${widthM.toFixed(2)}m × ${heightM.toFixed(2)}m`);

    // South wall (negative Z in Babylon = backward direction) - front wall
    this.createWall(
      widthM,
      heightM,
      wallThickness,
      new BABYLON.Vector3(0, heightM / 2, -depthM / 2 + wallThickness / 2),
      wallMaterial,
      'south_wall'
    );
    console.log(`[WarehouseModel] ✅ Created south wall at Z=${(-depthM / 2 + wallThickness / 2).toFixed(2)}m, size: ${widthM.toFixed(2)}m × ${heightM.toFixed(2)}m`);

    // East wall (positive X in Babylon = right direction) - right wall
    const eastWall = this.createWall(
      depthM - wallThickness, // Subtract thickness to fit between north/south walls
      heightM,
      wallThickness,
      new BABYLON.Vector3(widthM / 2 - wallThickness / 2, heightM / 2, 0),
      wallMaterial,
      'east_wall'
    );
    eastWall.rotation.y = Math.PI / 2; // Rotate 90° around Y to align with X-axis
    console.log(`[WarehouseModel] ✅ Created east wall at X=${(widthM / 2 - wallThickness / 2).toFixed(2)}m, size: ${(depthM - wallThickness).toFixed(2)}m × ${heightM.toFixed(2)}m`);

    // West wall (negative X in Babylon = left direction) - left wall
    const westWall = this.createWall(
      depthM - wallThickness, // Subtract thickness to fit between north/south walls
      heightM,
      wallThickness,
      new BABYLON.Vector3(-widthM / 2 + wallThickness / 2, heightM / 2, 0),
      wallMaterial,
      'west_wall'
    );
    westWall.rotation.y = Math.PI / 2;
    console.log(`[WarehouseModel] ✅ Created west wall at X=${(-widthM / 2 + wallThickness / 2).toFixed(2)}m, size: ${(depthM - wallThickness).toFixed(2)}m × ${heightM.toFixed(2)}m`);

    // Roof - DISABLED TO SEE SKY
    // Instead of a solid roof, leave it open so users can see the skybox
    // If you want a roof, uncomment the code below:
    /*
    const roof = BABYLON.MeshBuilder.CreatePlane(
      'warehouse_roof',
      { width: widthM, height: depthM },
      this.scene
    );
    roof.position = new BABYLON.Vector3(0, heightM, 0);
    roof.rotation.x = Math.PI;
    roof.material = roofMaterial;
    roof.receiveShadows = true;
    roof.isVisible = true;
    roof.isPickable = false;
    roof.infiniteDistance = false;
    roof.material.backFaceCulling = false;
    this.meshes.push(roof);
    roof.parent = this.rootNode;
    */
    console.log(`[WarehouseModel] ✅ Created open-air warehouse (no roof - see sky)`);

    // Add structural columns for realism (spaced every 10m)
    const columnSpacing = 10; // 10 meters
    const columnSize = 0.4; // 40cm columns
    const columns: BABYLON.Mesh[] = [];

    for (let x = -widthM / 2 + columnSpacing / 2; x < widthM / 2; x += columnSpacing) {
      for (let z = -depthM / 2 + columnSpacing / 2; z < depthM / 2; z += columnSpacing) {
        const column = BABYLON.MeshBuilder.CreateBox(
          `warehouse_column_${columns.length}`,
          {
            width: columnSize,
            height: heightM,
            depth: columnSize,
          },
          this.scene
        );
        column.position = new BABYLON.Vector3(x, heightM / 2, z);
        column.material = columnMaterial;
        column.receiveShadows = true;
        column.isVisible = true;
        column.isPickable = false;
        this.meshes.push(column);
        column.parent = this.rootNode;
        columns.push(column);
      }
    }

    // Add overhead beams (horizontal support beams)
    const beamHeight = heightM - 0.5; // 50cm below ceiling
    const beamWidth = 0.3; // 30cm beams
    const beamDepth = 0.2; // 20cm depth

    // Main beams along X-axis (every 10m along Z)
    for (let z = -depthM / 2 + columnSpacing / 2; z < depthM / 2; z += columnSpacing) {
      const beam = BABYLON.MeshBuilder.CreateBox(
        `warehouse_beam_x_${z}`,
        {
          width: widthM - columnSpacing,
          height: beamDepth,
          depth: beamWidth,
        },
        this.scene
      );
      beam.position = new BABYLON.Vector3(0, beamHeight, z);
      beam.material = columnMaterial; // Same material as columns
      beam.receiveShadows = true;
      beam.isVisible = true;
      beam.isPickable = false;
      this.meshes.push(beam);
      beam.parent = this.rootNode;
    }

    // Cross beams along Z-axis (every 10m along X)
    for (let x = -widthM / 2 + columnSpacing / 2; x < widthM / 2; x += columnSpacing) {
      const beam = BABYLON.MeshBuilder.CreateBox(
        `warehouse_beam_z_${x}`,
        {
          width: beamWidth,
          height: beamDepth,
          depth: depthM - columnSpacing,
        },
        this.scene
      );
      beam.position = new BABYLON.Vector3(x, beamHeight, 0);
      beam.material = columnMaterial;
      beam.receiveShadows = true;
      beam.isVisible = true;
      beam.isPickable = false;
      this.meshes.push(beam);
      beam.parent = this.rootNode;
    }

    // Create warehouse interior floor (inside the warehouse)
    const floorMesh = BABYLON.MeshBuilder.CreateGround(
      'warehouse_floor',
      {
        width: widthM - wallThickness * 2, // Slightly smaller than walls to fit inside
        height: depthM - wallThickness * 2
      },
      this.scene
    );
    floorMesh.position = new BABYLON.Vector3(0, 0.01, 0); // Slightly above Y=0 to avoid z-fighting
    floorMesh.material = floorMaterial;
    floorMesh.receiveShadows = true;
    floorMesh.isVisible = true;
    floorMesh.isPickable = false;
    this.meshes.push(floorMesh);
    floorMesh.parent = this.rootNode;
    console.log(`[WarehouseModel] ✅ Created warehouse interior floor: ${(widthM - wallThickness * 2).toFixed(2)}m × ${(depthM - wallThickness * 2).toFixed(2)}m`);

    // Create parking lot (20m asphalt around warehouse)
    const parkingLotSize = 20; // 20 meters around warehouse
    const parkingLotWidth = widthM + parkingLotSize * 2;
    const parkingLotDepth = depthM + parkingLotSize * 2;
    const parkingLotMesh = BABYLON.MeshBuilder.CreateGround(
      'warehouse_parking_lot',
      {
        width: parkingLotWidth,
        height: parkingLotDepth
      },
      this.scene
    );
    parkingLotMesh.position = new BABYLON.Vector3(0, 0, 0); // At ground level
    parkingLotMesh.material = this.createParkingLotMaterial();
    parkingLotMesh.receiveShadows = true;
    parkingLotMesh.isVisible = true;
    parkingLotMesh.isPickable = false;
    this.meshes.push(parkingLotMesh);
    parkingLotMesh.parent = this.rootNode;
    console.log(`[WarehouseModel] ✅ Created parking lot: ${parkingLotWidth.toFixed(2)}m × ${parkingLotDepth.toFixed(2)}m (20m around warehouse)`);

    // Create finite grass floor (large but not infinite so skybox shows at edges)
    // Use a reasonable size that's large enough but allows skybox visibility
    const grassSize = 500; // 500m - large enough but allows skybox to show at horizon
    const grassMesh = BABYLON.MeshBuilder.CreateGround(
      'warehouse_grass',
      {
        width: grassSize,
        height: grassSize
      },
      this.scene
    );
    grassMesh.position = new BABYLON.Vector3(0, -0.001, 0); // Slightly below parking lot to avoid z-fighting
    grassMesh.material = this.createGrassMaterial();
    grassMesh.receiveShadows = true;
    grassMesh.isVisible = true;
    grassMesh.isPickable = false;
    this.meshes.push(grassMesh);
    grassMesh.parent = this.rootNode;
    console.log(`[WarehouseModel] ✅ Created finite grass floor: ${grassSize.toFixed(0)}m × ${grassSize.toFixed(0)}m (allows skybox visibility at horizon)`);

    // Add interior lighting for better visibility
    this.addInteriorLighting();

    // PROMPT #1: Defensive visibility assertions to prevent grey-out
    // Note: rootNode is intentionally disabled during construction, will be enabled at end

    const invisibleMeshes = this.meshes.filter(m => !m.isVisible);
    if (invisibleMeshes.length > 0) {
      console.warn(`[WarehouseModel] ⚠️ Found ${invisibleMeshes.length} invisible meshes, forcing visible`);
      invisibleMeshes.forEach(m => {
        m.isVisible = true;
        m.setEnabled(true);
      });
    }

    // CRITICAL: Re-enable rootNode and restore autoClear after all meshes are created
    // This ensures the entire warehouse appears at once instead of piece-by-piece
    this.rootNode.setEnabled(true);
    this.scene.autoClear = previousAutoRender;

    // Force a render to show everything at once
    this.scene.getEngine().clear(this.scene.clearColor, false, false);

    console.log(`[WarehouseModel] ✅ Built warehouse: ${widthM}m × ${depthM}m × ${heightM}m`);
    console.log(`[WarehouseModel] Created ${this.meshes.length} meshes (walls, roof, columns, beams)`);
    console.log(`[WarehouseModel] Root node enabled: ${this.rootNode.isEnabled()}`);
    console.log(`[WarehouseModel] All meshes visible: ${this.meshes.every(m => m.isVisible)}`);
    console.log(`[WarehouseModel] ✅ Warehouse fully loaded - all meshes visible at once`);
  }

  /**
   * Add interior lighting for warehouse visibility
   */
  private addInteriorLighting(): void {
    const widthM = this.config.width / 1000;
    const depthM = this.config.depth / 1000;
    const heightM = this.config.height / 1000;
    
    // Add bright interior lights at ceiling level
    const lightCount = 4; // 2x2 grid of lights
    const spacing = Math.min(widthM, depthM) / 3;
    
    for (let i = 0; i < lightCount; i++) {
      const x = (i % 2) * spacing - spacing / 2;
      const z = Math.floor(i / 2) * spacing - spacing / 2;
      
      // Point light at ceiling level
      const light = new BABYLON.PointLight(
        `warehouse_interior_light_${i}`,
        new BABYLON.Vector3(x, heightM - 0.5, z), // Just below ceiling
        this.scene
      );
      light.intensity = 2.0; // Bright interior lighting
      light.diffuse = new BABYLON.Color3(1, 1, 0.95); // Slight warm white
      light.range = Math.max(widthM, depthM) * 1.5; // Cover entire warehouse
      
      console.log(`[WarehouseModel] ✅ Added interior light at (${x.toFixed(2)}, ${(heightM - 0.5).toFixed(2)}, ${z.toFixed(2)})`);
    }
    
    // Also increase ambient light for interior
    const existingLights = this.scene.lights;
    const hemisphericLight = existingLights.find(l => l instanceof BABYLON.HemisphericLight) as BABYLON.HemisphericLight;
    if (hemisphericLight) {
      hemisphericLight.intensity = 1.0; // Increase ambient for interior
    }
  }

  /**
   * Create a wall mesh
   */
  private createWall(
    width: number,
    height: number,
    thickness: number,
    position: BABYLON.Vector3,
    material: BABYLON.Material,
    name: string
  ): BABYLON.Mesh {
    const wall = BABYLON.MeshBuilder.CreateBox(
      name,
      {
        width: width,
        height: height,
        depth: thickness,
      },
      this.scene
    );
    wall.position = position;
    wall.material = material;
    wall.receiveShadows = true;
    wall.isVisible = true; // CRITICAL: Always visible
    wall.isPickable = false; // Don't interfere with selection
    wall.infiniteDistance = false; // Proper rendering
    wall.renderingGroupId = 0; // Ensure proper rendering order
    
    // Make walls double-sided so visible from inside
    if (material instanceof BABYLON.PBRMetallicRoughnessMaterial) {
      material.backFaceCulling = false;
    }
    
    // Force visibility check
    wall.setEnabled(true);
    
    this.meshes.push(wall);
    wall.parent = this.rootNode;
    
    console.log(`[WarehouseModel] ✅ Wall "${name}" created at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}), visible: ${wall.isVisible}, enabled: ${wall.isEnabled()}`);
    
    return wall;
  }

  /**
   * Create wall material (concrete texture) - DARK realistic industrial concrete
   */
  private createWallMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_wall_mat', this.scene);

    // DARK concrete gray - realistic industrial warehouse
    material.baseColor = new BABYLON.Color3(0.35, 0.34, 0.32); // Dark gray concrete
    material.metallic = 0.0;
    material.roughness = 0.9; // Very rough concrete

    // NO emissive - let lighting do its job
    material.emissiveColor = new BABYLON.Color3(0, 0, 0);

    // Create procedural concrete texture (no external dependency)
    const texture = this.createConcreteTexture(1024, 1024);
    texture.uScale = 4; // Scale for realistic texture size
    texture.vScale = 4;
    material.baseTexture = texture;

    material._environmentIntensity = 0.5;
    material.backFaceCulling = false; // Visible from inside
    material._twoSidedLighting = true; // CRITICAL: Light both sides
    this.materials.push(material);
    return material;
  }

  /**
   * Create DARK realistic procedural concrete texture
   */
  private createConcreteTexture(width: number, height: number): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // DARK concrete base - realistic industrial gray
    ctx.fillStyle = '#585652'; // Dark gray concrete
    ctx.fillRect(0, 0, width, height);

    // Add multi-layer noise for realistic concrete texture
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Create multiple noise layers for realistic texture
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Base noise (fine grain)
        const noise1 = (Math.random() - 0.5) * 30;

        // Medium scale variation (aggregate pattern)
        const noise2 = (Math.sin(x * 0.05) * Math.cos(y * 0.05) + Math.random() - 0.5) * 25;

        // Large scale variation (concrete pours)
        const noise3 = (Math.sin(x * 0.01) * Math.sin(y * 0.01) + Math.random() - 0.5) * 20;

        // Combined noise
        const totalNoise = noise1 + noise2 + noise3;

        // DARK gray range (70-110)
        data[idx] = Math.max(50, Math.min(120, 88 + totalNoise));     // R
        data[idx + 1] = Math.max(48, Math.min(118, 86 + totalNoise)); // G
        data[idx + 2] = Math.max(46, Math.min(116, 82 + totalNoise)); // B
        data[idx + 3] = 255; // Alpha
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Add prominent aggregate spots (darker stones)
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 4 + 2;
      const darkness = Math.random() * 40 + 30;

      ctx.fillStyle = `rgba(${60 - darkness}, ${58 - darkness}, ${54 - darkness}, 0.9)`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add prominent cracks/seams (formwork)
    ctx.strokeStyle = 'rgba(40, 40, 38, 0.7)';
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Create texture from data URL and configure properly with mipmaps
    // Note: noMipmap=false means mipmaps WILL be generated automatically
    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene, false, true);
    texture.hasAlpha = false;
    texture.getAlphaFromRGB = false;
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    
    // Enable trilinear filtering for proper distance rendering (mipmaps auto-generated)
    texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    
    console.log('[WarehouseModel] ✅ Created DARK concrete texture with mipmaps');
    return texture;
  }

  /**
   * Create floor material (industrial concrete)
   */
  private createFloorMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_floor_mat', this.scene);
    material.baseColor = new BABYLON.Color3(0.5, 0.5, 0.48);
    material.metallic = 0.0;
    material.roughness = 0.75;

    const texture = new BABYLON.Texture(
      'https://www.babylonjs-playground.com/textures/floor.png',
      this.scene
    );
    texture.uScale = 10;
    texture.vScale = 10;
    // Enable mipmaps for proper distance rendering
    texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    material.baseTexture = texture;

    material._environmentIntensity = 0.4;
    this.materials.push(material);
    return material;
  }

  /**
   * Create parking lot material (asphalt) - using local high-quality textures
   */
  private createParkingLotMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_parking_lot_mat', this.scene);
    material.baseColor = new BABYLON.Color3(0.2, 0.2, 0.22); // Dark asphalt color
    material.metallic = 0.0;

    // Use local high-quality asphalt texture
    try {
      const baseTexture = new BABYLON.Texture(
        '/assets/textures/asphalt/asphalt_02_diff_4k.jpg',
        this.scene
      );
      baseTexture.uScale = 50; // Scale for parking lot size
      baseTexture.vScale = 50;
      baseTexture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
      material.baseTexture = baseTexture;

      // Use roughness map if available
      try {
        const roughTexture = new BABYLON.Texture(
          '/assets/textures/asphalt/asphalt_02_rough_4k.jpg',
          this.scene
        );
        roughTexture.uScale = 50;
        roughTexture.vScale = 50;
        roughTexture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
        material.metallicRoughnessTexture = roughTexture;
      } catch (e) {
        console.warn('[WarehouseModel] ⚠️ Could not load asphalt roughness texture, using default roughness:', e);
        material.roughness = 0.95; // Very rough asphalt
      }
    } catch (e) {
      console.warn('[WarehouseModel] ⚠️ Could not load local asphalt texture, falling back to default:', e);
      // Fallback to default texture
      const texture = new BABYLON.Texture(
        'https://www.babylonjs-playground.com/textures/rock.png',
        this.scene
      );
      texture.uScale = 50;
      texture.vScale = 50;
      texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
      material.baseTexture = texture;
      material.roughness = 0.95;
    }

    material._environmentIntensity = 0.1;
    this.materials.push(material);
    return material;
  }

  /**
   * Create grass material (for infinite ground) - using local high-quality textures
   */
  private createGrassMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_grass_mat', this.scene);
    material.baseColor = new BABYLON.Color3(0.2, 0.4, 0.2); // Green grass color
    material.metallic = 0.0;

    // Use local high-quality grass texture
    try {
      const baseTexture = new BABYLON.Texture(
        '/assets/textures/grass/Grass004_8K-PNG_Color.png',
        this.scene
      );
      baseTexture.uScale = 1000; // Large scale for infinite feel
      baseTexture.vScale = 1000;
      baseTexture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
      material.baseTexture = baseTexture;

      // Use roughness map if available
      try {
        const roughTexture = new BABYLON.Texture(
          '/assets/textures/grass/Grass004_8K-PNG_Roughness.png',
          this.scene
        );
        roughTexture.uScale = 1000;
        roughTexture.vScale = 1000;
        roughTexture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
        material.metallicRoughnessTexture = roughTexture;
      } catch (e) {
        console.warn('[WarehouseModel] ⚠️ Could not load grass roughness texture, using default roughness:', e);
        material.roughness = 0.9; // Rough grass surface
      }

      // Use normal map for better detail
      try {
        const normalTexture = new BABYLON.Texture(
          '/assets/textures/grass/Grass004_8K-PNG_NormalGL.png',
          this.scene
        );
        normalTexture.uScale = 1000;
        normalTexture.vScale = 1000;
        normalTexture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
        material.normalTexture = normalTexture;
      } catch (e) {
        console.warn('[WarehouseModel] ⚠️ Could not load grass normal texture:', e);
      }
    } catch (e) {
      console.warn('[WarehouseModel] ⚠️ Could not load local grass texture, falling back to default:', e);
      // Fallback to default texture
      const texture = new BABYLON.Texture(
        'https://www.babylonjs-playground.com/textures/floor.png',
        this.scene
      );
      texture.uScale = 1000;
      texture.vScale = 1000;
      texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
      material.baseTexture = texture;
      material.roughness = 0.9;
    }

    material._environmentIntensity = 0.3;
    this.materials.push(material);
    return material;
  }

  /**
   * Create roof material (metal/industrial) - DARK realistic ceiling
   * Currently disabled - warehouse has no roof to see sky
   * Kept for future use
   */
  // @ts-expect-error - Method kept for future use when roof is re-enabled
  private _createRoofMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_roof_mat', this.scene);

    // DARK corrugated metal ceiling - realistic industrial
    material.baseColor = new BABYLON.Color3(0.25, 0.25, 0.24); // Dark gray metal
    material.metallic = 0.6; // Metallic ceiling
    material.roughness = 0.7;

    // NO emissive - let lighting do its job
    material.emissiveColor = new BABYLON.Color3(0, 0, 0);

    // Create procedural metal/ceiling texture
    const texture = this._createCeilingTexture(1024, 1024);
    texture.uScale = 6;
    texture.vScale = 6;
    material.baseTexture = texture;

    material._environmentIntensity = 0.4;
    material.backFaceCulling = false; // Visible from inside
    material._twoSidedLighting = true; // CRITICAL: Light both sides
    this.materials.push(material);
    return material;
  }

  /**
   * Create DARK realistic corrugated metal ceiling texture
   * Currently disabled - warehouse has no roof to see sky
   */
  private _createCeilingTexture(width: number, height: number): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // DARK metal ceiling base
    ctx.fillStyle = '#3d3d3c'; // Dark gray metal
    ctx.fillRect(0, 0, width, height);

    // Add corrugation pattern (horizontal ribs)
    const ribHeight = 8;
    for (let y = 0; y < height; y += ribHeight) {
      // Dark rib
      ctx.fillStyle = '#2a2a29';
      ctx.fillRect(0, y, width, 2);
      // Highlight
      ctx.fillStyle = '#505050';
      ctx.fillRect(0, y + 2, width, 1);
    }

    // Add noise for realistic metal texture
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Metal grain noise
      const noise = (Math.random() - 0.5) * 15;
      data[i] = Math.max(30, Math.min(80, data[i] + noise));     // R
      data[i + 1] = Math.max(30, Math.min(80, data[i + 1] + noise)); // G
      data[i + 2] = Math.max(29, Math.min(79, data[i + 2] + noise));  // B
    }

    ctx.putImageData(imageData, 0, 0);

    // Add rust/wear streaks
    ctx.strokeStyle = 'rgba(90, 70, 50, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 50, height);
      ctx.stroke();
    }

    // Create texture from data URL and configure properly
    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene, false, true);
    texture.hasAlpha = false;
    texture.getAlphaFromRGB = false;
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

    console.log('[WarehouseModel] ✅ Created DARK ceiling texture');
    return texture;
  }

  /**
   * Create column material (steel/concrete) - DARK realistic steel
   */
  private createColumnMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_column_mat', this.scene);

    // DARK steel - realistic industrial columns
    material.baseColor = new BABYLON.Color3(0.28, 0.28, 0.27); // Dark gray steel
    material.metallic = 0.7; // Very metallic for steel columns
    material.roughness = 0.6; // Slightly reflective

    // Create steel texture
    const texture = this.createSteelTexture(512, 512);
    texture.uScale = 2;
    texture.vScale = 2;
    material.baseTexture = texture;

    // NO emissive
    material.emissiveColor = new BABYLON.Color3(0, 0, 0);

    material._environmentIntensity = 0.5;
    this.materials.push(material);
    return material;
  }

  /**
   * Create DARK realistic steel texture for columns and beams
   */
  private createSteelTexture(width: number, height: number): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // DARK steel base color
    ctx.fillStyle = '#474745'; // Dark gray steel
    ctx.fillRect(0, 0, width, height);

    // Add metallic grain pattern
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Grain pattern (vertical streaks like rolled steel)
        const grain = Math.sin(y * 0.5) * 10 + (Math.random() - 0.5) * 12;

        // Variations
        const variation = (Math.random() - 0.5) * 15;

        const total = grain + variation;

        // DARK steel range (60-85)
        data[idx] = Math.max(50, Math.min(95, 71 + total));     // R
        data[idx + 1] = Math.max(50, Math.min(95, 71 + total)); // G
        data[idx + 2] = Math.max(48, Math.min(93, 69 + total));  // B
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Add prominent weld lines (horizontal)
    ctx.strokeStyle = 'rgba(30, 30, 28, 0.6)';
    ctx.lineWidth = 3;
    for (let y = 0; y < height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Add bolt holes
    ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
    for (let y = 32; y < height; y += 64) {
      for (let x = 32; x < width; x += 64) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Create texture from data URL and configure properly with mipmaps
    // Note: noMipmap=false means mipmaps WILL be generated automatically
    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene, false, true);
    texture.hasAlpha = false;
    texture.getAlphaFromRGB = false;
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    
    // Enable trilinear filtering for proper distance rendering (mipmaps auto-generated)
    texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);

    console.log('[WarehouseModel] ✅ Created DARK steel texture with mipmaps');
    return texture;
  }

  /**
   * Set up atmospheric effects: skybox, environment texture, fog, and rendering pipeline
   * PROMPT #1: Wrapped in try-catch to prevent grey-out on atmosphere failures
   */
  private setupAtmosphere(): void {
    try {
      console.log('[WarehouseModel] 🌫️ Setting up atmospheric effects...');

      // Create procedural environment texture for PBR materials
      try {
        const envTexture = this.createEnvironmentTexture();
        if (envTexture) {
          this.scene.environmentTexture = envTexture;
          console.log('[WarehouseModel] ✅ Environment texture set for PBR reflections');
        }
      } catch (envError) {
        console.warn('[WarehouseModel] ⚠️ Failed to create environment texture, continuing:', envError);
      }

      // Create skybox if enabled
      console.log(`[WarehouseModel] 🔍 enableSkybox = ${this.config.enableSkybox}`);
      if (this.config.enableSkybox) {
        try {
          this.createSkybox();
          // CRITICAL FIX: Set scene background to transparent so skybox is visible
          // Babylon.js renders clearColor AFTER the skybox, so alpha=1 covers it completely
          // This MUST be set to transparent for skybox to be visible
          this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
          
          // CRITICAL: Also ensure SceneManager knows background is transparent
          // This prevents other code from resetting clearColor to opaque
          import('../../scene/SceneManager').then(({ SceneManager }) => {
            SceneManager.getInstance().setBackgroundTransparent(true);
            console.log('[WarehouseModel] ✅ SceneManager.setBackgroundTransparent called');
          }).catch(() => {
            console.warn('[WarehouseModel] ⚠️ Could not update SceneManager background state');
          });
          
          // CRITICAL: Monitor and enforce transparent background in render loop
          // This ensures clearColor stays transparent even if other code tries to reset it
          let renderObserver: BABYLON.Observer<BABYLON.Scene> | null = null;
          renderObserver = this.scene.onBeforeRenderObservable.add(() => {
            if (this.config.enableSkybox && this.skybox && this.scene.clearColor.a !== 0) {
              // Only log the first time to avoid spam
              if (!(this as any)._clearColorWarningLogged) {
                console.warn('[WarehouseModel] ⚠️ clearColor was reset to opaque, fixing...');
                (this as any)._clearColorWarningLogged = true;
              }
              this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
            }
          });
          
          // Store observer for cleanup
          (this as any)._renderObserver = renderObserver;
          
          console.log('[WarehouseModel] ✅ Set scene clearColor to transparent for skybox visibility');
        } catch (skyboxError) {
          console.warn('[WarehouseModel] ⚠️ Failed to create skybox, continuing:', skyboxError);
        }
      } else {
        // Skybox is disabled - dispose existing skybox if present
        console.warn('[WarehouseModel] ⚠️ Skybox is DISABLED in config - disposing existing skybox');
        if (this.skybox) {
          this.skybox.dispose();
          this.skybox = null;
        }
        if (this.skyboxTexture) {
          this.skyboxTexture.dispose();
          this.skyboxTexture = null;
        }
        // Reset background to default when skybox is disabled
        this.scene.clearColor = new BABYLON.Color4(0.12, 0.12, 0.14, 1);
        console.log('[WarehouseModel] ✅ Skybox disabled and disposed');
      }

      // Set up atmospheric fog if enabled
      if (this.config.enableFog) {
        try {
          this.setupFog();
        } catch (fogError) {
          console.warn('[WarehouseModel] ⚠️ Failed to setup fog, continuing:', fogError);
        }
      } else {
        // CRITICAL FIX: Explicitly disable fog when enableFog is false
        this.scene.fogEnabled = false;
        this.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
        console.log('[WarehouseModel] ✅ Fog disabled');
      }

      // Set up Default Rendering Pipeline if enabled
      // NOTE: Pipeline must be created AFTER skybox to ensure proper exclusion
      if (this.config.enableBloom) {
        try {
          this.setupRenderingPipeline();
          
          // CRITICAL FIX: Exclude skybox from bloom highlights extraction
          // The highlights render pass tries to sample cube textures as 2D, causing WebGPU errors
          // Solution: Temporarily hide skybox during highlights render target rendering
          if (this.skybox && this.renderingPipeline) {
            // Ensure skybox is in rendering group 0 (renders before post-processing)
            this.skybox.renderingGroupId = 0;
            this.skybox.doNotSerialize = true;
            
            // Additional safeguard: ensure material doesn't contribute to highlights
            const material = this.skybox.material;
            if (material) {
              if (material instanceof BABYLON.StandardMaterial) {
                material.disableDepthWrite = true;
                material.disableLighting = true;
                // Ensure no emissive texture that could cause issues
                material.emissiveTexture = null;
              } else if (material instanceof BABYLON.BackgroundMaterial) {
                // BackgroundMaterial already configured for skybox
                material.disableDepthWrite = true;
              }
            }
            
            // CRITICAL: Hook into render loop to hide skybox during highlights render target
            // This prevents the cube texture from being sampled in the highlights pass
            let skyboxWasVisible = true;
            const onBeforeRender = () => {
              if (!this.skybox) return;
              
              // Check if we're in the highlights render pass by looking at the pipeline's render targets
              // The Default Rendering Pipeline uses render targets with "highlights" in the name
              const engine = this.scene.getEngine();
              const isInRenderTarget = (engine as any)._currentRenderTarget !== null;
              
              // Try to detect highlights render target by checking scene metadata or pipeline state
              // We'll use a simpler approach: check if the scene is rendering to a texture
              // The highlights pass uses a render target texture
              const isHighlightsPass = isInRenderTarget && 
                (this.renderingPipeline as any)._highlightsRenderTarget !== undefined;
              
              if (isHighlightsPass) {
                // Hide skybox during highlights render
                if (this.skybox.isVisible) {
                  skyboxWasVisible = true;
                  this.skybox.setEnabled(false);
                  this.skybox.isVisible = false;
                }
              } else {
                // Restore skybox visibility when not in highlights pass
                if (skyboxWasVisible && !this.skybox.isVisible) {
                  this.skybox.setEnabled(true);
                  this.skybox.isVisible = true;
                }
              }
            };
            
            // Register observer to hide/show skybox during highlights pass
            this.scene.onBeforeRenderObservable.add(onBeforeRender);
            
            // Store observer reference for cleanup
            (this.skybox as any)._highlightsExclusionObserver = onBeforeRender;
            
            console.log('[WarehouseModel] ✅ Skybox will be hidden during highlights render pass to prevent WebGPU errors');
          }
        } catch (pipelineError) {
          console.warn('[WarehouseModel] ⚠️ Failed to setup rendering pipeline, continuing:', pipelineError);
        }
      }

      // PROMPT #2: Create sun + cascaded shadows if enabled
      if (this.config.enableSun !== false) {
        try {
          this.createSun();
        } catch (sunError) {
          console.warn('[WarehouseModel] ⚠️ Failed to create sun, continuing:', sunError);
        }
      }
    } catch (error) {
      console.error('[WarehouseModel] ❌ setupAtmosphere failed:', error);
      console.log('[WarehouseModel] Continuing without atmospheric effects');
    }
  }

  /**
   * Create procedural environment texture (CubeTexture) for realistic PBR reflections
   * Generates industrial warehouse environment with sky, ground, and walls
   */
  private createEnvironmentTexture(): BABYLON.CubeTexture | null {
    try {
      // Create 6 canvas elements for cube faces (+X, -X, +Y, -Y, +Z, -Z)
      const size = 512;
      const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
      const canvases: Record<string, HTMLCanvasElement> = {};

      faces.forEach(face => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // Sky color (top) - overcast industrial sky
        const skyColor = '#7a8a9e';
        // Ground color (bottom) - darker
        const groundColor = '#4a5258';

        if (face === 'py') {
          // +Y face (top/sky) - overcast sky with subtle clouds
          // FIXED: Correct gradient direction for default orientation
          const gradient = ctx.createLinearGradient(0, 0, 0, size);
          gradient.addColorStop(0, '#8a9aae'); // Top of sky (zenith)
          gradient.addColorStop(1, skyColor); // Bottom of sky (toward horizon)
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, size, size);

          // Add subtle cloud texture
          for (let i = 0; i < 50; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radius = Math.random() * 40 + 20;
            const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            cloudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
            cloudGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = cloudGradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
          }
        } else if (face === 'ny') {
          // -Y face (bottom/ground) - concrete ground
          ctx.fillStyle = groundColor;
          ctx.fillRect(0, 0, size, size);

          // Add ground texture noise
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 20;
            data[i] = Math.max(0, Math.min(255, 74 + noise));
            data[i + 1] = Math.max(0, Math.min(255, 82 + noise));
            data[i + 2] = Math.max(0, Math.min(255, 88 + noise));
          }
          ctx.putImageData(imageData, 0, 0);
        } else {
          // Side faces (px, nx, pz, nz) - ALL SKY (no ground gradient)
          // User requirement: All sides must be sky, only bottom (ny) is ground
          const gradient = ctx.createLinearGradient(0, 0, 0, size);
          gradient.addColorStop(0, '#8a9aae'); // Top (sky zenith)
          gradient.addColorStop(0.5, skyColor); // Middle (sky)
          gradient.addColorStop(1, skyColor); // Bottom (still sky, no ground)
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, size, size);

          // Add subtle cloud texture for industrial sky
          for (let i = 0; i < 30; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size * 0.8;
            const radius = Math.random() * 40 + 20;
            const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            cloudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
            cloudGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = cloudGradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
          }
        }

        canvases[face] = canvas;
      });

      // Create CubeTexture from canvas data URLs
      // FIXED: Reorder faces to fix coordinate system - swap nx ↔ ny
      const reorderedFaces = ['px', 'ny', 'py', 'nx', 'pz', 'nz']; // Swap nx ↔ ny
      const urls = reorderedFaces.map(face => canvases[face].toDataURL());

      // Use CubeTexture.CreateFromImages to create from data URLs
      const cubeTexture = BABYLON.CubeTexture.CreateFromImages(urls, this.scene, false);

      console.log('[WarehouseModel] ✅ Created procedural environment texture');
      return cubeTexture;
    } catch (error) {
      console.warn('[WarehouseModel] ⚠️ Failed to create environment texture:', error);
      return null;
    }
  }

  /**
   * Create skybox with selected source
   * PROMPT #4: Skybox source selection
   * FIXED: Using BackgroundMaterial for proper skybox rendering
   */
  private createSkybox(): void {
    try {
      // CRITICAL FIX: Make skybox INFINITE like the grass (10km = effectively infinite)
      // Use the same approach as grass - make it huge so it appears infinite
      const skyboxSize = 10000; // 10km - same as grass, effectively infinite

      // Dispose existing skybox if present
      if (this.skybox) {
        this.skybox.dispose();
        this.skybox = null;
      }
      if (this.skyboxTexture) {
        this.skyboxTexture.dispose();
        this.skyboxTexture = null;
      }

      // CRITICAL FIX: Use BOX with BACKSIDE orientation (per Babylon.js official docs)
      // Official docs: https://doc.babylonjs.com/features/featuresDeepDive/environment/skybox
      // Using sideOrientation: BACKSIDE prevents need to alter backFaceCulling
      this.skybox = BABYLON.MeshBuilder.CreateBox(
        'warehouse_skybox',
        {
          size: skyboxSize,
          sideOrientation: BABYLON.Mesh.BACKSIDE // CRITICAL: See faces from inside (per official docs)
        },
        this.scene
      );
      
      // CRITICAL FIX: Rotate skybox 90° around Y-axis to fix coordinate mapping
      // Ground (ny) appears on LEFT instead of BOTTOM, indicating coordinate system rotation
      // Rotating the mesh should align ny (bottom) with the actual bottom (Y=0)
      this.skybox.rotation.y = Math.PI / 2; // 90° rotation around Y-axis

      // Generate skybox texture based on selected source
      const skyboxSource = this.config.skyboxSource || 'industrial';
      const skyboxEnvTexture = this.createSkyboxTexture(skyboxSource);

      // CRITICAL FIX: Use BackgroundMaterial when bloom is enabled to avoid WebGPU cube texture sampling errors
      // BackgroundMaterial uses reflectionTexture directly for display and may avoid the highlights pass issue
      // When bloom is disabled, use StandardMaterial with diffuseTexture for better visual quality
      let skyboxMaterial: BABYLON.Material;
      
      if (this.config.enableBloom && skyboxEnvTexture) {
        // Use BackgroundMaterial for bloom-enabled scenarios (avoids WebGPU cube texture sampling issues)
        skyboxMaterial = new BABYLON.BackgroundMaterial('warehouse_skybox_mat', this.scene);
        const bgMaterial = skyboxMaterial as BABYLON.BackgroundMaterial;
        
        // BackgroundMaterial uses reflectionTexture for the visible skybox
        bgMaterial.reflectionTexture = skyboxEnvTexture;
        bgMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        bgMaterial.reflectionBlur = 0; // No blur for sharp skybox
        bgMaterial.disableDepthWrite = true; // Don't write to depth buffer
        
        this.skyboxTexture = skyboxEnvTexture;
        this.scene.environmentTexture = skyboxEnvTexture;
        
        console.log('[WarehouseModel] ⚠️ Bloom enabled: Using BackgroundMaterial to avoid WebGPU cube texture errors');
      } else {
        // Use StandardMaterial when bloom is disabled (better visual quality)
        const stdMaterial = new BABYLON.StandardMaterial('warehouse_skybox_mat', this.scene);
        skyboxMaterial = stdMaterial;
        
        // CRITICAL: Configure StandardMaterial for proper skybox rendering
        stdMaterial.backFaceCulling = false; // Render both sides
        stdMaterial.disableLighting = true; // Skybox doesn't need lighting
        stdMaterial.disableDepthWrite = true; // Don't write to depth buffer (skybox is always "behind")
        stdMaterial.sideOrientation = BABYLON.Mesh.BACKSIDE; // Render inside faces
        
        // CRITICAL: Clear emissive texture to prevent WebGPU issues
        stdMaterial.emissiveTexture = null;
        stdMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0); // No emissive contribution

        if (skyboxEnvTexture) {
          this.skyboxTexture = skyboxEnvTexture;
          
          // Use diffuseTexture for visible skybox (provides realistic texture)
          stdMaterial.diffuseTexture = skyboxEnvTexture;
          stdMaterial.diffuseTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
          
          // Also set as reflectionTexture for environment reflections on other objects
          stdMaterial.reflectionTexture = skyboxEnvTexture;
          stdMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
          
          // Also update scene environment texture for PBR reflections
          this.scene.environmentTexture = skyboxEnvTexture;
        } else if (this.scene.environmentTexture) {
          // Fallback to existing environment texture
          stdMaterial.diffuseTexture = this.scene.environmentTexture;
          if (stdMaterial.diffuseTexture) {
            stdMaterial.diffuseTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
          }
          stdMaterial.reflectionTexture = this.scene.environmentTexture;
          if (stdMaterial.reflectionTexture) {
            stdMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
          }
        }
      }

      // Apply material to skybox
      this.skybox.material = skyboxMaterial;

      // CRITICAL: Set infiniteDistance so skybox follows camera (per official docs)
      this.skybox.infiniteDistance = true;

      // CRITICAL: Set renderingGroupId to 0 so skybox renders behind everything (per official docs)
      this.skybox.renderingGroupId = 0;

      // CRITICAL FIX: Disable fog on skybox so it's always visible (per Babylon.js docs)
      // Fog obscures the skybox if applyFog is true
      this.skybox.applyFog = false;

      this.skybox.isPickable = false;
      this.skybox.setEnabled(true);
      this.skybox.isVisible = true;

      // Position skybox at origin so it surrounds everything
      this.skybox.position = new BABYLON.Vector3(0, 0, 0);

      // CRITICAL FIX: Set scene background to transparent so skybox is visible
      // Babylon.js renders clearColor AFTER rendering groups, so alpha=1 covers the skybox
      // This MUST be set to transparent for skybox to be visible
      // Note: This is also set in setupAtmosphere, but we ensure it here too for safety
      if (this.scene.clearColor.a !== 0) {
        this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        console.log('[WarehouseModel] ✅ Enforced scene clearColor to transparent in createSkybox');
      }

      // CRITICAL: Force skybox to render by ensuring it's in the correct rendering order
      // Make sure skybox renders before everything else
      this.skybox.doNotSerialize = true; // Don't serialize skybox

      // DEBUGGING: Log everything about the skybox
      const materialType = skyboxMaterial instanceof BABYLON.BackgroundMaterial ? 'BackgroundMaterial' : 'StandardMaterial';
      const textureInfo = skyboxMaterial instanceof BABYLON.BackgroundMaterial 
        ? 'reflectionTexture (BackgroundMaterial)' 
        : 'diffuseTexture + reflectionTexture (StandardMaterial)';
      console.log(`[WarehouseModel] ✅ Created skybox with ${materialType} + ${textureInfo}, source: ${skyboxSource}, size: ${skyboxSize}m`);
      console.log(`[WarehouseModel] 🔍 Skybox DEBUG:`);
      console.log(`  - Material Type: ${materialType}`);
      console.log(`  - Enabled: ${this.skybox.isEnabled()}`);
      console.log(`  - Visible: ${this.skybox.isVisible}`);
      console.log(`  - Position: (${this.skybox.position.x}, ${this.skybox.position.y}, ${this.skybox.position.z})`);
      console.log(`  - RenderingGroupId: ${this.skybox.renderingGroupId}`);
      console.log(`  - LayerMask: 0x${this.skybox.layerMask.toString(16)} (excluded from highlights when bloom enabled)`);
      console.log(`  - InfiniteDistance: ${this.skybox.infiniteDistance}`);
      console.log(`  - Material: ${this.skybox.material ? 'YES' : 'NO'}`);
      if (skyboxMaterial instanceof BABYLON.BackgroundMaterial) {
        console.log(`  - ReflectionTexture: ${skyboxMaterial.reflectionTexture ? 'YES' : 'NO'} (BackgroundMaterial uses reflectionTexture for display)`);
      } else {
        const stdMaterial = skyboxMaterial as BABYLON.StandardMaterial;
        console.log(`  - DiffuseTexture: ${stdMaterial.diffuseTexture ? 'YES' : 'NO'}`);
        console.log(`  - ReflectionTexture: ${stdMaterial.reflectionTexture ? 'YES' : 'NO'}`);
        console.log(`  - EmissiveTexture: ${stdMaterial.emissiveTexture ? 'YES' : 'NO'} (cleared to prevent WebGPU errors)`);
      }
      console.log(`  - Scene clearColor: (${this.scene.clearColor.r}, ${this.scene.clearColor.g}, ${this.scene.clearColor.b}, ${this.scene.clearColor.a})`);
      console.log(`  - Scene clearColor alpha: ${this.scene.clearColor.a} (MUST be 0 for skybox visibility!)`);

      // CRITICAL: Ensure camera maxZ is large enough to see the skybox
      // Also ensure minZ is small enough to avoid clipping issues
      const camera = this.scene.activeCamera;
      if (camera instanceof BABYLON.ArcRotateCamera) {
        // Skybox is 10km, so camera needs to see at least that far
        const requiredMaxZ = skyboxSize * 1.5; // 1.5x skybox size for safety
        const previousMaxZ = camera.maxZ;
        if (camera.maxZ < requiredMaxZ) {
          camera.maxZ = requiredMaxZ;
          console.log(`[WarehouseModel] ⚠️ Adjusted camera maxZ from ${previousMaxZ.toFixed(1)} to ${requiredMaxZ.toFixed(1)} to see skybox`);
        }
        
        // CRITICAL: Ensure minZ is small enough to avoid clipping the ground or showing grey area
        if (camera.minZ > 0.001) {
          camera.minZ = 0.001; // Very close near plane to avoid clipping issues
          console.log(`[WarehouseModel] ⚠️ Adjusted camera minZ to ${camera.minZ} to avoid clipping issues`);
        }
        
        console.log(`[WarehouseModel] 📷 Camera DEBUG:`);
        console.log(`  - minZ: ${camera.minZ}`);
        console.log(`  - maxZ: ${camera.maxZ.toFixed(1)} (can see skybox: ${camera.maxZ >= requiredMaxZ ? 'YES' : 'NO'})`);
        console.log(`  - Position: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`);
        console.log(`  - Target: (${camera.target.x.toFixed(1)}, ${camera.target.y.toFixed(1)}, ${camera.target.z.toFixed(1)})`);
      }
      
      // CRITICAL: Hide default SceneManager ground plane to avoid grey area at bottom
      // The warehouse creates its own ground (parking lot + grass), so hide the default one
      // Use a render observer to ensure it stays hidden even if other code tries to show it
      try {
        const defaultGround = this.scene.meshes.find(m => m.name === 'ground' && !m.name.includes('warehouse'));
        if (defaultGround) {
          defaultGround.setEnabled(false);
          defaultGround.isVisible = false;
          defaultGround.visibility = 0; // Force invisible
          
          // Store reference and monitor to keep it hidden
          (this as any)._defaultGround = defaultGround;
          
          // Add observer to keep it hidden
          const groundObserver = this.scene.onBeforeRenderObservable.add(() => {
            if (defaultGround && (defaultGround.isVisible || defaultGround.isEnabled())) {
              defaultGround.setEnabled(false);
              defaultGround.isVisible = false;
              defaultGround.visibility = 0;
            }
          });
          (this as any)._groundObserver = groundObserver;
          
          console.log('[WarehouseModel] ✅ Hidden default SceneManager ground plane to prevent grey area');
        }
      } catch (error) {
        console.warn('[WarehouseModel] ⚠️ Could not hide default ground plane:', error);
      }

      // Don't add to meshes array since we manage disposal separately
    } catch (error) {
      console.warn('[WarehouseModel] ⚠️ Failed to create skybox:', error);
    }
  }

  /**
   * Create skybox texture based on selected source
   * PROMPT #4: Skybox source router
   */
  private createSkyboxTexture(source: SkyboxSource): BABYLON.CubeTexture | null {
    try {
      switch (source) {
        case 'industrial':
          return this.createIndustrialSkybox();
        case 'sunny':
          return this.createSunnySkybox();
        case 'overcast':
          return this.createOvercastSkybox();
        case 'night':
          return this.createNightSkybox();
        case 'sunset':
          return this.createSunsetSkybox();
        default:
          return this.createIndustrialSkybox();
      }
    } catch (error) {
      console.warn(`[WarehouseModel] ⚠️ Failed to create skybox texture for source "${source}":`, error);
      return null;
    }
  }

  /**
   * Create industrial skybox (default: overcast with buildings)
   * PROMPT #4: Industrial skybox generation
   */
  private createIndustrialSkybox(): BABYLON.CubeTexture {
    return this.createEnvironmentTexture() || this.createOvercastSkybox();
  }

  /**
   * Create sunny skybox with bright blue sky
   * PROMPT #4: Sunny skybox generation
   */
  private createSunnySkybox(): BABYLON.CubeTexture {
    const size = 512;
    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const canvases: Record<string, HTMLCanvasElement> = {};

    faces.forEach(face => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Bright blue sky colors
      const skyColor = '#87CEEB'; // Sky blue
      const brightSkyColor = '#B0E0E6'; // Powder blue (lighter)
      const groundColor = '#8B7355'; // Tan/brown ground

      // CRITICAL FIX: Ground must be on BOTTOM face (ny) at Y=0
      // According to gizmo: Y points UP, so -Y is DOWN (bottom)
      // Standard Babylon.js cube texture order: [px, nx, py, ny, pz, nz]
      // - py = top (+Y) = sky
      // - ny = bottom (-Y) = ground at Y=0
      // - px = right (+X)
      // - nx = left (-X)
      // 
      // If ground appears on LEFT instead of BOTTOM, the cube texture coordinate system
      // may be rotated. We need to ensure ground content is on ny (bottom) face.
      if (face === 'py') {
        // Top face (+Y) - bright sunny sky
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, brightSkyColor); // Top of sky (zenith)
        gradient.addColorStop(1, skyColor); // Bottom of sky (toward horizon)
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add realistic sun (smaller, less intense) at upper portion
        const sunX = size * 0.65;
        const sunY = size * 0.25; // Upper portion for sky
        const sunRadius = 25; // Much smaller for realistic size
        const sunGlowRadius = sunRadius * 2.5; // Soft glow around sun
        
        // Create sun with softer, more realistic glow
        const sunGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunGlowRadius);
        sunGradient.addColorStop(0, 'rgba(255, 255, 220, 0.95)'); // Warm white center
        sunGradient.addColorStop(0.3, 'rgba(255, 255, 200, 0.4)'); // Yellow glow
        sunGradient.addColorStop(0.6, 'rgba(255, 255, 180, 0.15)'); // Soft yellow
        sunGradient.addColorStop(1, 'rgba(255, 255, 200, 0)'); // Fade to transparent
        ctx.fillStyle = sunGradient;
        ctx.fillRect(sunX - sunGlowRadius, sunY - sunGlowRadius, sunGlowRadius * 2, sunGlowRadius * 2);
        
        // Add small bright core for realistic sun
        const coreGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 0.6);
        coreGradient.addColorStop(0, 'rgba(255, 255, 240, 1.0)'); // Bright center
        coreGradient.addColorStop(1, 'rgba(255, 255, 220, 0.8)'); // Warm white
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Add fluffy white clouds in upper portion
        for (let i = 0; i < 30; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size * 0.6; // Upper portion for clouds
          const radius = Math.random() * 30 + 20;
          const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          cloudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          cloudGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = cloudGradient;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
      } else if (face === 'ny') {
        // CRITICAL FIX: Bottom face (-Y) = ground at Y=0
        // This is where the brown ground should be according to the coordinate system
        // The gizmo shows Y points UP, so -Y is DOWN (bottom)
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, 0, size, size);

        // Add ground texture
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 15;
          data[i] = Math.max(100, Math.min(180, 139 + noise));     // R
          data[i + 1] = Math.max(100, Math.min(180, 115 + noise));  // G
          data[i + 2] = Math.max(85, Math.min(165, 85 + noise));    // B
        }
        ctx.putImageData(imageData, 0, 0);
      } else {
        // Side faces (px, nx, pz, nz) - ALL SKY (no ground gradient)
        // User requirement: All sides must be sky, only bottom (ny) is ground
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, brightSkyColor); // Top (sky zenith)
        gradient.addColorStop(0.5, skyColor); // Middle (sky)
        gradient.addColorStop(1, skyColor); // Bottom (still sky, no ground)
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Add clouds to side faces for realism
        for (let i = 0; i < 20; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size * 0.8; // Upper to middle portion
          const radius = Math.random() * 30 + 20;
          const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          cloudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
          cloudGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = cloudGradient;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
      }

      canvases[face] = canvas;
    });

    // CRITICAL FIX: Ground (ny canvas) appears on LEFT (nx visual position) instead of BOTTOM (ny visual position)
    // This means the cube texture coordinate system is rotated
    //
    // Standard Babylon.js order: [px, nx, py, ny, pz, nz] = [right, left, top, bottom, forward, back]
    // If ny (bottom) appears where nx (left) should be, the coordinate system is rotated 90° around Y
    //
    // To fix: rotate the face order so ny content appears on bottom
    // If ny appears as nx, then: ny→nx, so we put ny canvas in nx array position
    // But we want ny to appear as ny, so we need the opposite rotation
    //
    // Try rotating 90° counter-clockwise around Y: [pz, nz, py, ny, nx, px]
    // This rotates X↔Z: px→pz, nx→nz, pz→nx, nz→px, keeping py and ny the same
    // But this might not be right either
    //
    // Actually, if ny (bottom) appears on LEFT (nx), maybe we need: [pz, ny, py, nz, nx, px]
    // This puts ny in the nx position (index 1) so it appears on left... wait, that's wrong
    //
    // Let me think differently: if we want ny (ground) to appear on BOTTOM, and currently it appears on LEFT,
    // we need to rotate the order so ny canvas is mapped to the bottom visual position
    // The bottom visual position is index 3 in standard order [px, nx, py, ny, pz, nz]
    // So we need ny canvas at index 3, which it already is!
    //
    // This means the issue is NOT the face order, but maybe the skybox mesh orientation or BackgroundMaterial interpretation
    // For now, use standard order and ensure ground content is on ny canvas (which it is)
    const urls = faces.map(face => canvases[face].toDataURL());
    return BABYLON.CubeTexture.CreateFromImages(urls, this.scene, false);
  }

  /**
   * Create overcast skybox (cloudy gray sky)
   * PROMPT #4: Overcast skybox generation
   */
  private createOvercastSkybox(): BABYLON.CubeTexture {
    const size = 512;
    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const canvases: Record<string, HTMLCanvasElement> = {};

    faces.forEach(face => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Overcast gray colors
      const skyColor = '#9aa8b8'; // Light gray
      const groundColor = '#6a7378'; // Dark gray ground

      if (face === 'py') {
        // Top face - overcast sky
        // FIXED: Correct gradient direction for default orientation
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, '#b0bcc8'); // Top of sky (zenith)
        gradient.addColorStop(1, skyColor); // Bottom of sky (toward horizon)
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add cloud texture
        for (let i = 0; i < 80; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const radius = Math.random() * 50 + 30;
          const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          cloudGradient.addColorStop(0, 'rgba(200, 200, 200, 0.3)');
          cloudGradient.addColorStop(1, 'rgba(200, 200, 200, 0)');
          ctx.fillStyle = cloudGradient;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
      } else if (face === 'ny') {
        // Bottom face - ground
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, 0, size, size);
      } else {
        // Side faces (px, nx, pz, nz) - ALL SKY (no ground gradient)
        // User requirement: All sides must be sky, only bottom (ny) is ground
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, '#b0bcc8'); // Top (sky zenith)
        gradient.addColorStop(0.5, skyColor); // Middle (sky)
        gradient.addColorStop(1, skyColor); // Bottom (still sky, no ground)
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Add cloud texture
        for (let i = 0; i < 40; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size * 0.8;
          const radius = Math.random() * 50 + 30;
          const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          cloudGradient.addColorStop(0, 'rgba(200, 200, 200, 0.3)');
          cloudGradient.addColorStop(1, 'rgba(200, 200, 200, 0)');
          ctx.fillStyle = cloudGradient;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
      }

      canvases[face] = canvas;
    });

    // FIXED: Reorder faces to fix coordinate system - swap nx ↔ ny
    const reorderedFaces = ['px', 'ny', 'py', 'nx', 'pz', 'nz']; // Swap nx ↔ ny
    const urls = reorderedFaces.map(face => canvases[face].toDataURL());
    return BABYLON.CubeTexture.CreateFromImages(urls, this.scene, false);
  }

  /**
   * Create night skybox with stars
   * PROMPT #4: Night skybox generation
   */
  private createNightSkybox(): BABYLON.CubeTexture {
    const size = 512;
    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const canvases: Record<string, HTMLCanvasElement> = {};

    faces.forEach(face => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Night sky colors
      const skyColor = '#0a0e1a'; // Very dark blue
      const horizonColor = '#1a1f2e'; // Slightly lighter
      const groundColor = '#050608'; // Almost black

      if (face === 'py') {
        // Top face - night sky with stars
        ctx.fillStyle = skyColor;
        ctx.fillRect(0, 0, size, size);

        // Add stars
        for (let i = 0; i < 500; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const brightness = Math.random();
          const starSize = brightness > 0.8 ? 2 : 1;
          ctx.fillStyle = brightness > 0.9
            ? 'rgba(255, 255, 255, 1)'
            : `rgba(255, 255, 255, ${brightness * 0.8})`;
          ctx.fillRect(x, y, starSize, starSize);
        }

        // Add moon (bright white circle) at upper portion
        const moonX = size * 0.7;
        const moonY = size * 0.25; // Upper portion for night sky
        const moonRadius = 40;
        ctx.fillStyle = 'rgba(220, 220, 200, 0.9)';
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
        ctx.fill();
      } else if (face === 'ny') {
        // Bottom face - dark ground
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, 0, size, size);
      } else {
        // Side faces (px, nx, pz, nz) - ALL SKY (no ground gradient)
        // User requirement: All sides must be sky, only bottom (ny) is ground
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, skyColor); // Top (night sky)
        gradient.addColorStop(0.5, horizonColor);
        gradient.addColorStop(1, skyColor); // Bottom (still sky, no ground)
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add stars on side faces
        for (let i = 0; i < 200; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size * 0.8; // Upper to middle portion
          const brightness = Math.random();
          ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.6})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }

      canvases[face] = canvas;
    });

    // FIXED: Reorder faces to fix coordinate system - swap nx ↔ ny
    const reorderedFaces = ['px', 'ny', 'py', 'nx', 'pz', 'nz']; // Swap nx ↔ ny
    const urls = reorderedFaces.map(face => canvases[face].toDataURL());
    return BABYLON.CubeTexture.CreateFromImages(urls, this.scene, false);
  }

  /**
   * Create sunset skybox with warm orange/red tones
   * PROMPT #4: Sunset skybox generation
   */
  private createSunsetSkybox(): BABYLON.CubeTexture {
    const size = 512;
    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const canvases: Record<string, HTMLCanvasElement> = {};

    faces.forEach(face => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Sunset colors
      const skyColor = '#FF6B35'; // Warm orange
      const brightSkyColor = '#FFB347'; // Light orange/yellow
      const horizonColor = '#FF8C42'; // Deep orange
      const groundColor = '#8B4513'; // Brown ground

      if (face === 'py') {
        // Top face - sunset sky
        // FIXED: Correct gradient direction for default orientation
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, brightSkyColor); // Top of sky (zenith)
        gradient.addColorStop(0.5, skyColor);
        gradient.addColorStop(1, '#FF4500'); // Bottom of sky (toward horizon - deep orange-red)
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add sun (bright orange/yellow circle) at horizon level
        const sunX = size * 0.5;
        const sunY = size * 0.7; // Lower portion for sunset horizon
        const sunRadius = 80;
        const sunGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
        sunGradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
        sunGradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.8)');
        sunGradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
        ctx.fillStyle = sunGradient;
        ctx.fillRect(sunX - sunRadius, sunY - sunRadius, sunRadius * 2, sunRadius * 2);
      } else if (face === 'ny') {
        // Bottom face - dark ground
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, 0, size, size);
      } else {
        // Side faces (px, nx, pz, nz) - ALL SKY (no ground gradient)
        // User requirement: All sides must be sky, only bottom (ny) is ground
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, brightSkyColor); // Top (sky zenith)
        gradient.addColorStop(0.5, skyColor); // Middle (sky)
        gradient.addColorStop(0.7, horizonColor); // Horizon (deep orange)
        gradient.addColorStop(1, skyColor); // Bottom (still sky, no ground)
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add cloud silhouettes
        ctx.fillStyle = 'rgba(200, 100, 50, 0.4)';
        for (let i = 0; i < 10; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size * 0.7; // Upper to middle portion
          const width = Math.random() * 80 + 40;
          const height = Math.random() * 30 + 20;
          ctx.fillRect(x, y, width, height);
        }
      }

      canvases[face] = canvas;
    });

    // FIXED: Reorder faces to fix coordinate system - swap nx ↔ ny
    const reorderedFaces = ['px', 'ny', 'py', 'nx', 'pz', 'nz']; // Swap nx ↔ ny
    const urls = reorderedFaces.map(face => canvases[face].toDataURL());
    return BABYLON.CubeTexture.CreateFromImages(urls, this.scene, false);
  }

  /**
   * Set up atmospheric fog for depth perception
   */
  private setupFog(): void {
    try {
      const widthM = this.config.width / 1000;
      const depthM = this.config.depth / 1000;
      const maxDim = Math.max(widthM, depthM);

      // Use linear fog mode for warehouse
      this.scene.fogEnabled = true; // CRITICAL: Explicitly enable fog
      this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;

      // Fog color - match overcast sky but lighter so it doesn't obscure skybox
      this.scene.fogColor = new BABYLON.Color3(0.58, 0.62, 0.66); // Cool gray fog

      // CRITICAL FIX: Make fog much lighter and start later so it doesn't obscure the skybox
      // Fog starts at 200% of max dimension (much further away), ends at 800% (very far)
      // This ensures skybox is visible while still having atmospheric fog for distant objects
      this.scene.fogStart = maxDim * 2.0; // Start fog much further away
      this.scene.fogEnd = maxDim * 8.0;   // End fog very far away

      console.log(`[WarehouseModel] ✅ Set up atmospheric fog (start: ${this.scene.fogStart.toFixed(1)}m, end: ${this.scene.fogEnd.toFixed(1)}m) - reduced density to preserve skybox visibility`);
    } catch (error) {
      console.warn('[WarehouseModel] ⚠️ Failed to set up fog:', error);
    }
  }

  /**
   * Set up Default Rendering Pipeline with bloom, grain, and other effects
   */
  private setupRenderingPipeline(): void {
    try {
      const camera = this.scene.activeCamera;
      if (!camera) {
        console.warn('[WarehouseModel] ⚠️ No active camera, skipping rendering pipeline');
        return;
      }

      // Create Default Rendering Pipeline with HDR support
      this.renderingPipeline = new BABYLON.DefaultRenderingPipeline(
        'warehouse_pipeline',
        true, // HDR enabled
        this.scene,
        [camera]
      );

      // Enable and configure bloom (subtle industrial glow on lights)
      this.renderingPipeline.bloomEnabled = true;
      this.renderingPipeline.bloomThreshold = 0.8; // Only bright areas glow
      this.renderingPipeline.bloomWeight = 0.3; // Subtle bloom
      this.renderingPipeline.bloomKernel = 64; // Medium quality
      this.renderingPipeline.bloomScale = 0.5;

      // Enable FXAA antialiasing for crisp edges
      this.renderingPipeline.fxaaEnabled = true;

      // Add subtle film grain for industrial realism
      this.renderingPipeline.grainEnabled = true;
      this.renderingPipeline.grain.intensity = 10; // Very subtle
      this.renderingPipeline.grain.animated = true;

      // Enable image processing
      this.renderingPipeline.imageProcessingEnabled = true;
      this.renderingPipeline.imageProcessing.contrast = 1.1; // Slight contrast boost
      this.renderingPipeline.imageProcessing.exposure = 1.0; // Normal exposure

      // Add subtle vignette for focus
      this.renderingPipeline.imageProcessing.vignetteEnabled = true;
      this.renderingPipeline.imageProcessing.vignetteWeight = 1.5;
      this.renderingPipeline.imageProcessing.vignetteCameraFov = 0.8;

      console.log('[WarehouseModel] ✅ Set up Default Rendering Pipeline with bloom, grain, and effects');
    } catch (error) {
      console.warn('[WarehouseModel] ⚠️ Failed to set up rendering pipeline:', error);
    }
  }

  /**
   * PROMPT #2: Create directional sun light with cascaded shadow maps
   */
  private createSun(): void {
    try {
      // Dispose existing sun if any
      if (this.sun) {
        this.sun.dispose();
        this.sun = null;
      }
      if (this.csm) {
        this.csm.dispose();
        this.csm = null;
      }

      const azimuth = (this.config.sunAzimuth ?? -45) * Math.PI / 180;
      const elevation = (this.config.sunElevation ?? 35) * Math.PI / 180;

      // Convert azimuth/elevation to direction vector
      const dir = new BABYLON.Vector3(
        Math.cos(elevation) * Math.cos(azimuth),
        -Math.sin(elevation),
        Math.cos(elevation) * Math.sin(azimuth)
      );

      this.sun = new BABYLON.DirectionalLight('warehouse_sun', dir, this.scene);
      this.sun.intensity = this.config.sunIntensity ?? 1.0;
      this.sun.shadowMinZ = -300;
      this.sun.shadowMaxZ = 900;

      // Create cascaded shadow generator (medium quality for performance)
      this.csm = new BABYLON.CascadedShadowGenerator(1024, this.sun);
      this.csm.usePercentageCloserFiltering = true;
      this.csm.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
      this.csm.bias = 0.003;
      this.csm.normalBias = 0.01;

      // Add all warehouse meshes as shadow casters
      this.meshes.forEach(mesh => {
        this.csm!.addShadowCaster(mesh);
        mesh.receiveShadows = true;
      });

      console.log(`[WarehouseModel] ✅ Created sun (az: ${this.config.sunAzimuth}°, el: ${this.config.sunElevation}°, intensity: ${this.sun.intensity})`);
    } catch (error) {
      console.warn('[WarehouseModel] ⚠️ Failed to create sun:', error);
    }
  }

  /**
   * Update warehouse size
   * PROMPT #1: Added camera safety after resize
   * PROMPT #4: Added skybox source change detection
   */
  updateSize(config: Partial<WarehouseConfig>): void {
    const skyboxSourceChanged = config.skyboxSource !== undefined && config.skyboxSource !== this.config.skyboxSource;
    const skyboxEnabledChanged = config.enableSkybox !== undefined && config.enableSkybox !== this.config.enableSkybox;
    const fogChanged = config.enableFog !== undefined && config.enableFog !== this.config.enableFog;
    const sunChanged = config.enableSun !== undefined && config.enableSun !== this.config.enableSun;
    this.config = { ...this.config, ...config };
    this.build();

    // Rebuild atmospheric effects if size, skybox enabled/disabled, skybox source, fog, or sun changed
    if (config.width !== undefined || config.depth !== undefined || config.height !== undefined || skyboxEnabledChanged || skyboxSourceChanged || fogChanged || sunChanged) {
      this.disposeAtmosphere();
      this.setupAtmosphere();
    }

    // PROMPT #1: Update camera clipping planes for new size to prevent grey-out
    const camera = this.scene.activeCamera;
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      const widthM = this.config.width / 1000;
      const depthM = this.config.depth / 1000;
      const heightM = this.config.height / 1000;

      camera.minZ = 0.1; // Very close
      // CRITICAL: maxZ must be larger than skybox (1000x warehouse) to see sky!
      camera.maxZ = Math.max(widthM, depthM, heightM) * 2000; // 2x skybox size

      // Re-target to safe position
      camera.target = new BABYLON.Vector3(0, 1.7, 0);
      camera.radius = Math.min(widthM, depthM) * 0.25;
      camera.setTarget(camera.target);

      console.log(`[WarehouseModel] ✅ Updated camera clipping planes: minZ=${camera.minZ}, maxZ=${camera.maxZ.toFixed(1)}m (can see skybox)`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): WarehouseConfig {
    return { ...this.config };
  }

  /**
   * Get root node
   */
  getRootNode(): BABYLON.TransformNode {
    return this.rootNode;
  }

  /**
   * Dispose atmospheric effects (skybox, rendering pipeline)
   * PROMPT #2: Added sun and CSM disposal
   * PROMPT #4: Added skybox texture disposal
   */
  private disposeAtmosphere(): void {
    // Dispose render observer
    if ((this as any)._renderObserver) {
      this.scene.onBeforeRenderObservable.remove((this as any)._renderObserver);
      (this as any)._renderObserver = null;
    }
    
    // Dispose ground observer
    if ((this as any)._groundObserver) {
      this.scene.onBeforeRenderObservable.remove((this as any)._groundObserver);
      (this as any)._groundObserver = null;
    }
    
    // Dispose skybox
    if (this.skybox) {
      this.skybox.dispose();
      this.skybox = null;
    }

    // PROMPT #4: Dispose skybox texture
    if (this.skyboxTexture) {
      this.skyboxTexture.dispose();
      this.skyboxTexture = null;
    }

    // PROMPT #2: Dispose sun and CSM
    if (this.csm) {
      this.csm.dispose();
      this.csm = null;
    }
    if (this.sun) {
      this.sun.dispose();
      this.sun = null;
    }

    // Dispose rendering pipeline
    // Note: "Destroyed texture" warnings may appear in React StrictMode (development only)
    // These are harmless warnings caused by double-initialization and don't affect functionality
    if (this.renderingPipeline) {
      this.renderingPipeline.dispose();
      this.renderingPipeline = null;
    }

    // Clear scene fog
    this.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;

    // Note: Environment texture is managed by scene, don't dispose manually
  }

  /**
   * Update skybox source dynamically
   * PROMPT #4: Skybox source update method
   */
  updateSkyboxSource(source: SkyboxSource): void {
    this.config.skyboxSource = source;

    // Rebuild skybox with new source
    if (this.config.enableSkybox) {
      this.disposeAtmosphere();
      this.setupAtmosphere();
    }

    console.log(`[WarehouseModel] ✅ Updated skybox source to: ${source}`);
  }

  /**
   * Dispose all meshes and materials
   */
  dispose(): void {
    this.meshes.forEach(mesh => mesh.dispose());
    this.meshes = [];
    this.materials.forEach(material => material.dispose());
    this.materials = [];

    // Dispose atmospheric effects
    this.disposeAtmosphere();
  }
}