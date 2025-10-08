import * as BABYLON from '@babylonjs/core';
import '@babylonjs/materials/grid';
import { GridMaterial } from '@babylonjs/materials/grid';
import { FloorType } from '../core/types';
import { GROUND_SIZE } from '../core/constants';

/**
 * Manages floor materials for different industrial environments
 * Provides various realistic floor options that users can switch between
 */
export class FloorMaterialManager {
  private scene: BABYLON.Scene;
  private currentMaterial: BABYLON.Material | null = null;
  private gridOverlay: BABYLON.Mesh | null = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Create material for specified floor type
   * @param floorType Type of floor material
   * @param floorWidth Width of floor (for texture scaling), defaults to GROUND_SIZE
   * @param floorDepth Depth of floor (for texture scaling), defaults to floorWidth
   */
  public createFloorMaterial(
    floorType: FloorType,
    floorWidth: number = GROUND_SIZE,
    floorDepth?: number
  ): BABYLON.Material {
    // Dispose old material if exists
    if (this.currentMaterial) {
      this.currentMaterial.dispose();
    }

    const depth = floorDepth ?? floorWidth;
    const avgSize = (floorWidth + depth) / 2;

    let material: BABYLON.Material;

    switch (floorType) {
      case 'concrete-polished':
        material = this.createPolishedConcrete(avgSize);
        break;
      case 'concrete-raw':
        material = this.createRawConcrete(avgSize);
        break;
      case 'epoxy-gray':
        material = this.createEpoxyFloor(new BABYLON.Color3(0.5, 0.5, 0.52), avgSize);
        break;
      case 'epoxy-white':
        material = this.createEpoxyFloor(new BABYLON.Color3(0.9, 0.9, 0.92), avgSize);
        break;
      case 'tiles-ceramic':
        material = this.createCeramicTiles(avgSize);
        break;
      case 'metal-checker':
        material = this.createMetalCheckerPlate(avgSize);
        break;
      case 'asphalt':
        material = this.createAsphalt(avgSize);
        break;
      case 'wood-industrial':
        material = this.createIndustrialWood(avgSize);
        break;
      case 'grid-only':
        material = this.createGridOnly();
        break;
      default:
        material = this.createPolishedConcrete(avgSize);
    }

    this.currentMaterial = material;
    return material;
  }

  /**
   * Create or update grid overlay
   */
  public createGridOverlay(ground: BABYLON.Mesh, visible: boolean = true): BABYLON.Mesh {
    // Remove old overlay if exists
    if (this.gridOverlay) {
      this.gridOverlay.dispose();
      this.gridOverlay = null;
    }

    if (!visible) {
      return ground; // Return ground without overlay
    }

    // Get ground dimensions from the actual ground mesh
    const groundBounds = ground.getBoundingInfo();
    const groundSize = groundBounds.boundingBox.extendSize;
    const groundWidth = groundSize.x * 2;
    const groundDepth = groundSize.z * 2;

    const gridMaterial = new GridMaterial('gridOverlay', this.scene);
    gridMaterial.majorUnitFrequency = 10;
    gridMaterial.minorUnitVisibility = 0.15;
    gridMaterial.gridRatio = 1; // 1m grid
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = new BABYLON.Color3(0.2, 0.2, 0.22); // Darker main color
    gridMaterial.lineColor = new BABYLON.Color3(0.1, 0.1, 0.12); // Darker line color
    gridMaterial.opacity = 0.6; // Increased opacity for more visible lines

    const gridOverlay = BABYLON.MeshBuilder.CreateGround(
      'gridOverlay',
      { width: groundWidth, height: groundDepth },
      this.scene
    );
    gridOverlay.position.y = 0.001; // Slightly above ground to avoid z-fighting
    gridOverlay.material = gridMaterial;
    gridOverlay.renderingGroupId = 1;

    this.gridOverlay = gridOverlay;
    return gridOverlay;
  }

  /**
   * Polished concrete floor (current default)
   */
  private createPolishedConcrete(avgSize: number = GROUND_SIZE): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial(
      'floor-concrete-polished',
      this.scene
    );
    material.baseColor = new BABYLON.Color3(0.42, 0.42, 0.42);
    material.metallic = 0.0;
    material.roughness = 0.7;

    const texture = new BABYLON.Texture(
      'https://www.babylonjs-playground.com/textures/floor.png',
      this.scene
    );
    texture.uScale = avgSize / 5;
    texture.vScale = avgSize / 5;
    material.baseTexture = texture;

    material._environmentIntensity = 0.4;
    return material;
  }

  /**
   * Raw concrete with rougher texture
   */
  private createRawConcrete(avgSize: number = GROUND_SIZE): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial(
      'floor-concrete-raw',
      this.scene
    );
    material.baseColor = new BABYLON.Color3(0.38, 0.38, 0.36);
    material.metallic = 0.0;
    material.roughness = 0.9;

    // Use rock texture for raw concrete look
    const texture = new BABYLON.Texture(
      'https://www.babylonjs-playground.com/textures/rock.png',
      this.scene
    );
    texture.uScale = avgSize / 3;
    texture.vScale = avgSize / 3;
    material.baseTexture = texture;

    material._environmentIntensity = 0.2;
    return material;
  }

  /**
   * Epoxy coated floor (smooth, reflective)
   */
  private createEpoxyFloor(color: BABYLON.Color3, _avgSize: number = GROUND_SIZE): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial(
      'floor-epoxy',
      this.scene
    );
    material.baseColor = color;
    material.metallic = 0.1; // Slight metallic for reflectivity
    material.roughness = 0.3; // Smooth, glossy finish
    material._environmentIntensity = 0.6; // More reflective

    return material;
  }

  /**
   * Ceramic tile floor
   */
  private createCeramicTiles(avgSize: number = GROUND_SIZE): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial(
      'floor-tiles-ceramic',
      this.scene
    );
    material.baseColor = new BABYLON.Color3(0.85, 0.85, 0.82);
    material.metallic = 0.0;
    material.roughness = 0.4; // Glossy tiles

    // Use floor texture with tighter tiling
    const texture = new BABYLON.Texture(
      'https://www.babylonjs-playground.com/textures/floor.png',
      this.scene
    );
    texture.uScale = avgSize / 2; // Smaller tiles
    texture.vScale = avgSize / 2;
    material.baseTexture = texture;

    material._environmentIntensity = 0.5;
    return material;
  }

  /**
   * Metal checker plate (diamond plate)
   */
  private createMetalCheckerPlate(_avgSize: number = GROUND_SIZE): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial(
      'floor-metal-checker',
      this.scene
    );
    material.baseColor = new BABYLON.Color3(0.6, 0.6, 0.62);
    material.metallic = 0.8; // Very metallic
    material.roughness = 0.4; // Brushed metal

    material._environmentIntensity = 0.7; // Reflective metal
    return material;
  }

  /**
   * Asphalt surface
   */
  private createAsphalt(avgSize: number = GROUND_SIZE): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial(
      'floor-asphalt',
      this.scene
    );
    material.baseColor = new BABYLON.Color3(0.2, 0.2, 0.22);
    material.metallic = 0.0;
    material.roughness = 0.95; // Very rough

    // Use rock texture for asphalt appearance
    const texture = new BABYLON.Texture(
      'https://www.babylonjs-playground.com/textures/rock.png',
      this.scene
    );
    texture.uScale = avgSize / 4;
    texture.vScale = avgSize / 4;
    material.baseTexture = texture;

    material._environmentIntensity = 0.1;
    return material;
  }

  /**
   * Industrial wood flooring
   */
  private createIndustrialWood(avgSize: number = GROUND_SIZE): BABYLON.PBRMetallicRoughnessMaterial {
    const material = new BABYLON.PBRMetallicRoughnessMaterial(
      'floor-wood-industrial',
      this.scene
    );
    material.baseColor = new BABYLON.Color3(0.45, 0.35, 0.25);
    material.metallic = 0.0;
    material.roughness = 0.8;

    // Use floor texture for wood grain appearance
    const texture = new BABYLON.Texture(
      'https://www.babylonjs-playground.com/textures/floor.png',
      this.scene
    );
    texture.uScale = avgSize / 8;
    texture.vScale = avgSize / 8;
    material.baseTexture = texture;

    material._environmentIntensity = 0.3;
    return material;
  }

  /**
   * Grid lines only (transparent floor with visible grid)
   */
  private createGridOnly(): BABYLON.StandardMaterial {
    const material = new BABYLON.StandardMaterial('floor-grid-only', this.scene);
    material.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    material.alpha = 0.05; // Nearly transparent
    material.backFaceCulling = false;
    return material;
  }

  /**
   * Dispose all materials
   */
  public dispose(): void {
    if (this.currentMaterial) {
      this.currentMaterial.dispose();
      this.currentMaterial = null;
    }
    if (this.gridOverlay) {
      this.gridOverlay.dispose();
      this.gridOverlay = null;
    }
  }
}
