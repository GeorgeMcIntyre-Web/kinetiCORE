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
  enableFog: true, // Enable atmospheric fog by default
  enableBloom: true, // Enable bloom effects by default
  enableSkybox: true, // Enable skybox by default
  skyboxSource: 'industrial', // PROMPT #4: Default skybox source
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
    this.build();

    // Hide the default ground plane when warehouse is visible
    this.hideGroundPlane();

    // Set up atmospheric effects
    this.setupAtmosphere();
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

    // Create materials
    const wallMaterial = this.createWallMaterial();
    this.createFloorMaterial(); // Material created but not used yet (floor is handled by SceneManager)
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

    // Ensure root node is enabled and visible
    this.rootNode.setEnabled(true);

    // Add interior lighting for better visibility
    this.addInteriorLighting();

    // PROMPT #1: Defensive visibility assertions to prevent grey-out
    if (!this.rootNode.isEnabled()) {
      console.error('[WarehouseModel] ❌ Root node failed to enable!');
      this.rootNode.setEnabled(true);
    }

    const invisibleMeshes = this.meshes.filter(m => !m.isVisible);
    if (invisibleMeshes.length > 0) {
      console.warn(`[WarehouseModel] ⚠️ Found ${invisibleMeshes.length} invisible meshes, forcing visible`);
      invisibleMeshes.forEach(m => {
        m.isVisible = true;
        m.setEnabled(true);
      });
    }

    console.log(`[WarehouseModel] ✅ Built warehouse: ${widthM}m × ${depthM}m × ${heightM}m`);
    console.log(`[WarehouseModel] Created ${this.meshes.length} meshes (walls, roof, columns, beams)`);
    console.log(`[WarehouseModel] Root node enabled: ${this.rootNode.isEnabled()}`);
    console.log(`[WarehouseModel] All meshes visible: ${this.meshes.every(m => m.isVisible)}`);
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

    // Create texture from data URL and configure properly
    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene, false, true);
    texture.hasAlpha = false;
    texture.getAlphaFromRGB = false;
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

    console.log('[WarehouseModel] ✅ Created DARK concrete texture');
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
    material.baseTexture = texture;

    material._environmentIntensity = 0.4;
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

    // Create texture from data URL and configure properly
    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene, false, true);
    texture.hasAlpha = false;
    texture.getAlphaFromRGB = false;
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

    console.log('[WarehouseModel] ✅ Created DARK steel texture');
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
        } catch (skyboxError) {
          console.warn('[WarehouseModel] ⚠️ Failed to create skybox, continuing:', skyboxError);
        }
      } else {
        console.warn('[WarehouseModel] ⚠️ Skybox is DISABLED in config!');
      }

      // Set up atmospheric fog if enabled
      if (this.config.enableFog) {
        try {
          this.setupFog();
        } catch (fogError) {
          console.warn('[WarehouseModel] ⚠️ Failed to setup fog, continuing:', fogError);
        }
      }

      // Set up Default Rendering Pipeline if enabled
      if (this.config.enableBloom) {
        try {
          this.setupRenderingPipeline();
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
        // Horizon color - lighter
        const horizonColor = '#9aa8b8';
        // Ground color (bottom) - darker
        const groundColor = '#4a5258';

        if (face === 'py') {
          // +Y face (top/sky) - overcast sky with subtle clouds
          const gradient = ctx.createLinearGradient(0, 0, 0, size);
          gradient.addColorStop(0, '#8a9aae');
          gradient.addColorStop(1, skyColor);
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
          // Side faces (horizon) - gradient from sky to ground
          const gradient = ctx.createLinearGradient(0, 0, 0, size);
          gradient.addColorStop(0, skyColor);
          gradient.addColorStop(0.5, horizonColor);
          gradient.addColorStop(1, groundColor);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, size, size);

          // Add distant building silhouettes for industrial feel
          ctx.fillStyle = 'rgba(40, 45, 50, 0.3)';
          for (let i = 0; i < 5; i++) {
            const buildingX = Math.random() * size;
            const buildingWidth = Math.random() * 60 + 40;
            const buildingHeight = Math.random() * 150 + 100;
            ctx.fillRect(buildingX, size - buildingHeight, buildingWidth, buildingHeight);
          }
        }

        canvases[face] = canvas;
      });

      // Create CubeTexture from canvas data URLs
      const urls = faces.map(face => canvases[face].toDataURL());

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
   */
  private createSkybox(): void {
    try {
      const widthM = this.config.width / 1000;
      const depthM = this.config.depth / 1000;
      const heightM = this.config.height / 1000;

      // CRITICAL FIX: Make skybox HUGE (1000x warehouse size) so it appears infinite
      const skyboxSize = Math.max(widthM, depthM, heightM) * 1000;

      // Dispose existing skybox if present
      if (this.skybox) {
        this.skybox.dispose();
        this.skybox = null;
      }
      if (this.skyboxTexture) {
        this.skyboxTexture.dispose();
        this.skyboxTexture = null;
      }

      // Create skybox mesh
      this.skybox = BABYLON.MeshBuilder.CreateBox(
        'warehouse_skybox',
        { size: skyboxSize },
        this.scene
      );

      // Create skybox material
      const skyboxMaterial = new BABYLON.StandardMaterial('warehouse_skybox_mat', this.scene);
      skyboxMaterial.backFaceCulling = false;
      skyboxMaterial.disableLighting = true;
      skyboxMaterial.disableDepthWrite = true; // CRITICAL: Don't write to depth buffer

      // Generate skybox texture based on selected source
      const skyboxSource = this.config.skyboxSource || 'industrial';
      const skyboxEnvTexture = this.createSkyboxTexture(skyboxSource);

      if (skyboxEnvTexture) {
        this.skyboxTexture = skyboxEnvTexture;
        skyboxMaterial.reflectionTexture = skyboxEnvTexture;
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

        // Also update scene environment texture for PBR reflections
        this.scene.environmentTexture = skyboxEnvTexture;
      } else if (this.scene.environmentTexture) {
        // Fallback to existing environment texture
        skyboxMaterial.reflectionTexture = this.scene.environmentTexture;
        if (skyboxMaterial.reflectionTexture) {
          skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        }
      }

      this.skybox.material = skyboxMaterial;
      this.skybox.infiniteDistance = true;
      this.skybox.renderingGroupId = 0; // CRITICAL: Render skybox first (background)
      this.skybox.isPickable = false;
      this.skybox.setEnabled(true);
      this.skybox.isVisible = true;

      // DEBUGGING: Log everything about the skybox
      console.log(`[WarehouseModel] ✅ Created skybox with source: ${skyboxSource}, size: ${skyboxSize}m`);
      console.log(`[WarehouseModel] 🔍 Skybox DEBUG:`);
      console.log(`  - Enabled: ${this.skybox.isEnabled()}`);
      console.log(`  - Visible: ${this.skybox.isVisible}`);
      console.log(`  - Position: (${this.skybox.position.x}, ${this.skybox.position.y}, ${this.skybox.position.z})`);
      console.log(`  - RenderingGroupId: ${this.skybox.renderingGroupId}`);
      console.log(`  - InfiniteDistance: ${this.skybox.infiniteDistance}`);
      console.log(`  - Material: ${this.skybox.material ? 'YES' : 'NO'}`);
      console.log(`  - Texture: ${skyboxMaterial.reflectionTexture ? 'YES' : 'NO'}`);

      // DEBUGGING: Log camera settings
      const camera = this.scene.activeCamera;
      if (camera instanceof BABYLON.ArcRotateCamera) {
        console.log(`[WarehouseModel] 📷 Camera DEBUG:`);
        console.log(`  - minZ: ${camera.minZ}`);
        console.log(`  - maxZ: ${camera.maxZ}`);
        console.log(`  - Position: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`);
        console.log(`  - Target: (${camera.target.x.toFixed(1)}, ${camera.target.y.toFixed(1)}, ${camera.target.z.toFixed(1)})`);
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
      const horizonColor = '#E0F6FF'; // Very light blue
      const groundColor = '#8B7355'; // Tan/brown ground

      if (face === 'py') {
        // Top face - bright sunny sky
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, brightSkyColor);
        gradient.addColorStop(1, skyColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add sun (bright white/yellow circle)
        const sunX = size * 0.6;
        const sunY = size * 0.3;
        const sunRadius = 60;
        const sunGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
        sunGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        sunGradient.addColorStop(0.5, 'rgba(255, 255, 200, 0.6)');
        sunGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = sunGradient;
        ctx.fillRect(sunX - sunRadius, sunY - sunRadius, sunRadius * 2, sunRadius * 2);

        // Add fluffy white clouds
        for (let i = 0; i < 30; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size * 0.6; // Upper portion
          const radius = Math.random() * 30 + 20;
          const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          cloudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          cloudGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = cloudGradient;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
      } else if (face === 'ny') {
        // Bottom face - ground
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
        // Side faces - gradient from bright sky to ground
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, skyColor);
        gradient.addColorStop(0.3, brightSkyColor);
        gradient.addColorStop(0.5, horizonColor);
        gradient.addColorStop(1, groundColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      }

      canvases[face] = canvas;
    });

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
      const horizonColor = '#b8c5d0'; // Lighter gray
      const groundColor = '#6a7378'; // Dark gray ground

      if (face === 'py') {
        // Top face - overcast sky
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, '#b0bcc8');
        gradient.addColorStop(1, skyColor);
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
        // Side faces - gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, skyColor);
        gradient.addColorStop(0.5, horizonColor);
        gradient.addColorStop(1, groundColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      }

      canvases[face] = canvas;
    });

    const urls = faces.map(face => canvases[face].toDataURL());
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

        // Add moon (bright white circle)
        const moonX = size * 0.7;
        const moonY = size * 0.25;
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
        // Side faces - dark gradient with stars
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, skyColor);
        gradient.addColorStop(0.5, horizonColor);
        gradient.addColorStop(1, groundColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add stars on side faces
        for (let i = 0; i < 200; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size * 0.6; // Upper portion
          const brightness = Math.random();
          ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.6})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }

      canvases[face] = canvas;
    });

    const urls = faces.map(face => canvases[face].toDataURL());
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
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, brightSkyColor);
        gradient.addColorStop(0.5, skyColor);
        gradient.addColorStop(1, '#FF4500'); // Deep orange-red
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add sun (bright orange/yellow circle)
        const sunX = size * 0.5;
        const sunY = size * 0.4;
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
        // Side faces - sunset gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, brightSkyColor);
        gradient.addColorStop(0.3, skyColor);
        gradient.addColorStop(0.5, horizonColor);
        gradient.addColorStop(1, groundColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Add cloud silhouettes
        ctx.fillStyle = 'rgba(200, 100, 50, 0.4)';
        for (let i = 0; i < 10; i++) {
          const x = Math.random() * size;
          const y = size * 0.3 + Math.random() * size * 0.2;
          const width = Math.random() * 80 + 40;
          const height = Math.random() * 30 + 20;
          ctx.fillRect(x, y, width, height);
        }
      }

      canvases[face] = canvas;
    });

    const urls = faces.map(face => canvases[face].toDataURL());
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
      this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;

      // Fog color - match overcast sky
      this.scene.fogColor = new BABYLON.Color3(0.58, 0.62, 0.66); // Cool gray fog

      // Fog starts at 20% of max dimension, ends at 80%
      this.scene.fogStart = maxDim * 0.2;
      this.scene.fogEnd = maxDim * 0.8;

      console.log('[WarehouseModel] ✅ Set up atmospheric fog (start: ${this.scene.fogStart.toFixed(1)}m, end: ${this.scene.fogEnd.toFixed(1)}m)');
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
    this.config = { ...this.config, ...config };
    this.build();

    // Rebuild atmospheric effects if size or skybox source changed
    if (config.width !== undefined || config.depth !== undefined || config.height !== undefined || skyboxSourceChanged) {
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