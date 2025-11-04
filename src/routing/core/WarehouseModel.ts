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
   * Create wall material (concrete texture) - High visibility for interior feel
   */
  private createWallMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_wall_mat', this.scene);
    
    // VERY BRIGHT, visible concrete color for interior warehouse
    material.baseColor = new BABYLON.Color3(0.9, 0.88, 0.85); // Very light beige/cream - highly visible
    material.metallic = 0.0;
    material.roughness = 0.8; // Rough concrete
    
    // Add emissive for interior visibility (walls should glow slightly)
    material.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.15); // Noticeable glow
    
    // Create procedural concrete texture (no external dependency)
    const texture = this.createConcreteTexture(512, 512);
    texture.uScale = 8; // Scale for realistic texture size
    texture.vScale = 8;
    material.baseTexture = texture;

    material._environmentIntensity = 1.0; // Maximum for interior visibility
    material.backFaceCulling = false; // Always visible from inside
    this.materials.push(material);
    return material;
  }

  /**
   * Create realistic procedural concrete texture with proper material detail
   */
  private createConcreteTexture(width: number, height: number): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Base concrete color (light gray/beige)
    ctx.fillStyle = '#e6e4e0';
    ctx.fillRect(0, 0, width, height);
    
    // Add multi-layer noise for realistic concrete texture
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Create multiple noise layers for realistic texture
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Base noise (fine grain)
        const noise1 = (Math.random() - 0.5) * 25;
        
        // Medium scale variation (aggregate pattern)
        const noise2 = (Math.sin(x * 0.1) * Math.cos(y * 0.1) + Math.random() - 0.5) * 20;
        
        // Large scale variation (concrete pours)
        const noise3 = (Math.sin(x * 0.02) * Math.sin(y * 0.02) + Math.random() - 0.5) * 15;
        
        // Combined noise
        const totalNoise = noise1 + noise2 + noise3;
        
        // Apply with slight color variation (warmer/cooler tones)
        const rVariation = totalNoise + (Math.random() - 0.5) * 5;
        const gVariation = totalNoise + (Math.random() - 0.5) * 5;
        const bVariation = totalNoise + (Math.random() - 0.5) * 5;
        
        data[idx] = Math.max(200, Math.min(255, 230 + rVariation));     // R (keep bright)
        data[idx + 1] = Math.max(200, Math.min(255, 228 + gVariation)); // G (keep bright)
        data[idx + 2] = Math.max(195, Math.min(255, 224 + bVariation));  // B (keep bright)
        data[idx + 3] = 255; // Alpha
      }
    }
    
    // Add subtle aggregate spots (dark specks like concrete aggregate)
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 3 + 1;
      const darkness = Math.random() * 30 + 20;
      
      ctx.fillStyle = `rgba(${200 - darkness}, ${200 - darkness}, ${195 - darkness}, 0.8)`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Add subtle cracks/seams (vertical lines from formwork)
    ctx.strokeStyle = 'rgba(180, 180, 175, 0.3)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    return new BABYLON.Texture(canvas.toDataURL(), this.scene);
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
   * Create roof material (metal/industrial) - VERY visible from inside
   */
  private createRoofMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_roof_mat', this.scene);
    
    // VERY BRIGHT for visibility from inside (ceiling should be highly visible)
    material.baseColor = new BABYLON.Color3(0.95, 0.93, 0.90); // Very light gray/white
    material.metallic = 0.1; // Slight metallic feel
    material.roughness = 0.7;
    
    // Strong emissive for interior visibility (ceiling should glow)
    material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2); // Strong glow
    
    // Create procedural metal/ceiling texture
    const texture = this.createCeilingTexture(512, 512);
    texture.uScale = 10;
    texture.vScale = 10;
    material.baseTexture = texture;
    
    material._environmentIntensity = 1.0; // Maximum for interior
    material.backFaceCulling = false; // Always visible from inside
    this.materials.push(material);
    return material;
  }

  /**
   * Create realistic procedural ceiling texture (acoustic tiles/metal panels)
   */
  private createCeilingTexture(width: number, height: number): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Base color (very light gray/white - bright ceiling)
    ctx.fillStyle = '#f5f3f0';
    ctx.fillRect(0, 0, width, height);
    
    // Create tile pattern (like acoustic ceiling tiles)
    const tileSize = 48;
    const tileGap = 2;
    
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        // Tile base
        ctx.fillStyle = '#f8f6f3';
        ctx.fillRect(x + tileGap, y + tileGap, tileSize - tileGap * 2, tileSize - tileGap * 2);
        
        // Add subtle texture to each tile
        const imageData = ctx.getImageData(x + tileGap, y + tileGap, tileSize - tileGap * 2, tileSize - tileGap * 2);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          // Subtle noise for texture
          const noise = (Math.random() - 0.5) * 8;
          data[i] = Math.max(245, Math.min(255, 248 + noise));     // R
          data[i + 1] = Math.max(243, Math.min(255, 246 + noise)); // G
          data[i + 2] = Math.max(240, Math.min(255, 243 + noise));  // B
        }
        
        ctx.putImageData(imageData, x + tileGap, y + tileGap);
        
        // Add subtle grid lines (tile edges)
        ctx.strokeStyle = 'rgba(220, 220, 215, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + tileGap, y + tileGap, tileSize - tileGap * 2, tileSize - tileGap * 2);
      }
    }
    
    // Add subtle perforation pattern (acoustic tile holes)
    ctx.fillStyle = 'rgba(200, 200, 195, 0.15)';
    const holeSpacing = 8;
    const holeSize = 1;
    for (let y = tileGap + 10; y < height - tileGap; y += holeSpacing) {
      for (let x = tileGap + 10; x < width - tileGap; x += holeSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, holeSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    return new BABYLON.Texture(canvas.toDataURL(), this.scene);
  }

  /**
   * Create column material (steel/concrete) - Highly visible with texture
   */
  private createColumnMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_column_mat', this.scene);
    
    // Bright, visible steel gray
    material.baseColor = new BABYLON.Color3(0.75, 0.75, 0.73); // Light gray - visible
    material.metallic = 0.4; // More metallic for steel columns
    material.roughness = 0.5; // Slightly reflective
    
    // Create steel texture
    const texture = this.createSteelTexture(256, 256);
    texture.uScale = 4;
    texture.vScale = 4;
    material.baseTexture = texture;
    
    // Emissive for visibility
    material.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    
    material._environmentIntensity = 0.9; // High for visibility
    this.materials.push(material);
    return material;
  }

  /**
   * Create realistic steel texture for columns and beams
   */
  private createSteelTexture(width: number, height: number): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Base steel color (light gray)
    ctx.fillStyle = '#bfbfbd';
    ctx.fillRect(0, 0, width, height);
    
    // Add subtle metallic grain pattern
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Grain pattern (vertical streaks like rolled steel)
        const grain = Math.sin(y * 0.3) * 5 + (Math.random() - 0.5) * 8;
        
        // Subtle variations
        const variation = (Math.random() - 0.5) * 10;
        
        const total = grain + variation;
        
        data[idx] = Math.max(185, Math.min(200, 191 + total));     // R
        data[idx + 1] = Math.max(185, Math.min(200, 191 + total)); // G
        data[idx + 2] = Math.max(180, Math.min(195, 189 + total));  // B
        data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add subtle weld lines/join patterns (horizontal lines)
    ctx.strokeStyle = 'rgba(160, 160, 155, 0.2)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    return new BABYLON.Texture(canvas.toDataURL(), this.scene);
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