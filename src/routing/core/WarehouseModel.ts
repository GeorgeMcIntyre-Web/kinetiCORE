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
  height: 6000,  // 6m = 6,000mm (typical warehouse height)
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

    // Create materials
    const wallMaterial = this.createWallMaterial();
    this.createFloorMaterial(); // Material created but not used yet (floor is handled by SceneManager)
    const roofMaterial = this.createRoofMaterial();
    const columnMaterial = this.createColumnMaterial();

    // Floor (already exists as ground in SceneManager, but we'll create a separate warehouse floor)
    // Actually, we'll work with the existing ground - just resize it

    // Create walls
    const wallThickness = 0.3; // 30cm = 300mm walls
    
    // North wall (positive Z direction in user space = positive Y in Babylon)
    this.createWall(
      widthM,
      heightM,
      wallThickness,
      new BABYLON.Vector3(0, heightM / 2, depthM / 2 - wallThickness / 2),
      wallMaterial,
      'north_wall'
    );

    // South wall
    this.createWall(
      widthM,
      heightM,
      wallThickness,
      new BABYLON.Vector3(0, heightM / 2, -depthM / 2 + wallThickness / 2),
      wallMaterial,
      'south_wall'
    );

    // East wall (positive X in both spaces)
    const eastWall = this.createWall(
      depthM,
      heightM,
      wallThickness,
      new BABYLON.Vector3(widthM / 2 - wallThickness / 2, heightM / 2, 0),
      wallMaterial,
      'east_wall'
    );
    eastWall.rotation.y = Math.PI / 2; // Rotate 90° to align with X-axis

    // West wall
    const westWall = this.createWall(
      depthM,
      heightM,
      wallThickness,
      new BABYLON.Vector3(-widthM / 2 + wallThickness / 2, heightM / 2, 0),
      wallMaterial,
      'west_wall'
    );
    westWall.rotation.y = Math.PI / 2;

    // Roof
    const roof = BABYLON.MeshBuilder.CreateGround(
      'warehouse_roof',
      { width: widthM, height: depthM },
      this.scene
    );
    roof.position = new BABYLON.Vector3(0, heightM, 0);
    roof.rotation.x = 0; // Flat roof
    roof.material = roofMaterial;
    roof.receiveShadows = true;
    this.meshes.push(roof);
    roof.parent = this.rootNode;

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
      this.meshes.push(beam);
      beam.parent = this.rootNode;
    }

    console.log(`[WarehouseModel] Built warehouse: ${widthM}m × ${depthM}m × ${heightM}m`);
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
    this.meshes.push(wall);
    wall.parent = this.rootNode;
    return wall;
  }

  /**
   * Create wall material (concrete texture)
   */
  private createWallMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_wall_mat', this.scene);
    material.baseColor = new BABYLON.Color3(0.65, 0.65, 0.62); // Light gray concrete
    material.metallic = 0.0;
    material.roughness = 0.85; // Rough concrete

    // Use concrete texture
    const texture = new BABYLON.Texture(
      'https://www.babylonjs-playground.com/textures/rock.png',
      this.scene
    );
    texture.uScale = 5; // Scale for realistic texture size
    texture.vScale = 5;
    material.baseTexture = texture;

    material._environmentIntensity = 0.3;
    this.materials.push(material);
    return material;
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
   * Create roof material (metal/industrial)
   */
  private createRoofMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_roof_mat', this.scene);
    material.baseColor = new BABYLON.Color3(0.7, 0.7, 0.68); // Light gray metal
    material.metallic = 0.3;
    material.roughness = 0.6;
    material._environmentIntensity = 0.5;
    this.materials.push(material);
    return material;
  }

  /**
   * Create column material (steel/concrete)
   */
  private createColumnMaterial(): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial('warehouse_column_mat', this.scene);
    material.baseColor = new BABYLON.Color3(0.55, 0.55, 0.53); // Medium gray
    material.metallic = 0.2; // Slight metallic for steel columns
    material.roughness = 0.7;
    material._environmentIntensity = 0.4;
    this.materials.push(material);
    return material;
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