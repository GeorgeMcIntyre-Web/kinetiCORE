// Warehouse Model - Creates 3D warehouse structure for routing system
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';

export interface WarehouseConfig {
  width: number;  // X-axis dimension (mm)
  depth: number;  // Y-axis dimension (mm)
  height: number; // Z-axis dimension (mm) - warehouse ceiling height
}

const DEFAULT_CONFIG: WarehouseConfig = {
  width: 50000,  // 50m = 50,000mm
  depth: 50000,  // 50m = 50,000mm
  height: 20000,  // 20m = 20,000mm (warehouse height)
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

  constructor(scene: BABYLON.Scene, config?: Partial<WarehouseConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rootNode = new BABYLON.TransformNode('warehouse_root', scene);
    this.build();

    // Hide the default ground plane when warehouse is visible
    this.hideGroundPlane();
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
    const roofMaterial = this.createRoofMaterial();
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

    // Roof (plane facing down so visible from inside) - CRITICAL: Use CreatePlane, not CreateGround!
    const roof = BABYLON.MeshBuilder.CreatePlane(
      'warehouse_roof',
      { width: widthM, height: depthM },
      this.scene
    );
    // Position at ceiling height, rotate to face downward (visible from inside)
    roof.position = new BABYLON.Vector3(0, heightM, 0);
    roof.rotation.x = Math.PI; // Rotate 180° to face downward (visible from inside)
    roof.material = roofMaterial;
    roof.receiveShadows = true;
    roof.isVisible = true;
    roof.isPickable = false;
    roof.infiniteDistance = false;
    // Make double-sided for visibility
    roof.material.backFaceCulling = false;
    this.meshes.push(roof);
    roof.parent = this.rootNode;
    console.log(`[WarehouseModel] ✅ Created roof at Y=${heightM.toFixed(2)}m, size: ${widthM.toFixed(2)}m × ${depthM.toFixed(2)}m (facing down)`);

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
   */
  private createRoofMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_roof_mat', this.scene);

    // DARK corrugated metal ceiling - realistic industrial
    material.baseColor = new BABYLON.Color3(0.25, 0.25, 0.24); // Dark gray metal
    material.metallic = 0.6; // Metallic ceiling
    material.roughness = 0.7;

    // NO emissive - let lighting do its job
    material.emissiveColor = new BABYLON.Color3(0, 0, 0);

    // Create procedural metal/ceiling texture
    const texture = this.createCeilingTexture(1024, 1024);
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
   */
  private createCeilingTexture(width: number, height: number): BABYLON.Texture {
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
   * Update warehouse size
   */
  updateSize(config: Partial<WarehouseConfig>): void {
    this.config = { ...this.config, ...config };
    this.build();
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
   * Dispose all meshes and materials
   */
  dispose(): void {
    this.meshes.forEach(mesh => mesh.dispose());
    this.meshes = [];
    this.materials.forEach(material => material.dispose());
    this.materials = [];
  }
}