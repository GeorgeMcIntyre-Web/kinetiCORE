/**
 * Enhanced Thumbnail Generation Service
 * Owner: George
 * 
 * Automatic thumbnail generation from 3D models using headless Babylon.js rendering
 * Supports multiple formats, camera angles, and quality settings
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/loaders/glTF';

/**
 * Thumbnail generation configuration
 */
export interface ThumbnailGenerationConfig {
  width: number;
  height: number;
  quality: number;
  backgroundColor?: string;
  cameraAngle?: 'isometric' | 'front' | 'side' | 'top' | 'custom';
  customCameraPosition?: BABYLON.Vector3;
  customCameraTarget?: BABYLON.Vector3;
  lighting?: 'studio' | 'natural' | 'minimal';
  shadows?: boolean;
  antialiasing?: boolean;
  format?: 'png' | 'jpeg' | 'webp';
}

/**
 * Thumbnail generation result
 */
export interface ThumbnailGenerationResult {
  success: boolean;
  thumbnailData?: string; // Base64 encoded image
  thumbnailUrl?: string; // CDN URL if uploaded
  metadata?: {
    width: number;
    height: number;
    format: string;
    fileSize: number;
    generationTime: number;
  };
  error?: string;
}

// Model loading configuration for thumbnails (for future use)
// interface ModelLoadConfig {
//   url: string;
//   format: 'glb' | 'gltf' | 'obj' | 'stl';
//   scale?: number;
//   centerModel?: boolean;
//   enablePhysics?: boolean;
// }

/**
 * Enhanced Thumbnail Generation Service
 */
export class ThumbnailGenerationService {
  private static instance: ThumbnailGenerationService | null = null;
  private readonly API_BASE_URL = '/api/thumbnail-generation';
  
  private constructor() {}

  public static getInstance(): ThumbnailGenerationService {
    if (!ThumbnailGenerationService.instance) {
      ThumbnailGenerationService.instance = new ThumbnailGenerationService();
    }
    return ThumbnailGenerationService.instance;
  }

  /**
   * Generate thumbnail from 3D model URL
   */
  public async generateThumbnailFromUrl(
    modelUrl: string,
    config: ThumbnailGenerationConfig
  ): Promise<ThumbnailGenerationResult> {
    const startTime = performance.now();
    
    try {
      // Create temporary canvas
      const canvas = document.createElement('canvas');
      canvas.width = config.width;
      canvas.height = config.height;

      // Create engine and scene
      const engine = new BABYLON.Engine(canvas, true, {
        antialias: config.antialiasing !== false,
        alpha: false,
        powerPreference: 'high-performance'
      });

      const scene = new BABYLON.Scene(engine);

      try {
        // Load the model
        const model = await this.loadModel(scene, modelUrl);
        if (!model) {
          throw new Error('Failed to load model');
        }

        // Set up camera
        this.setupCamera(scene, model, config);

        // Set up lighting
        this.setupLighting(scene, config);

        // Set up environment
        this.setupEnvironment(scene, config);

        // Render the scene
        scene.render();

        // Convert to image
        const thumbnailData = await this.canvasToImage(canvas, config);

        const generationTime = performance.now() - startTime;

        return {
          success: true,
          thumbnailData,
          metadata: {
            width: config.width,
            height: config.height,
            format: config.format || 'png',
            fileSize: this.calculateImageSize(thumbnailData),
            generationTime
          }
        };

      } finally {
        // Clean up
        scene.dispose();
        engine.dispose();
      }

    } catch (error) {
      console.error('[ThumbnailGeneration] Generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate thumbnail from scene nodes
   */
  public async generateThumbnailFromNodes(
    nodeIds: string[],
    config: ThumbnailGenerationConfig
  ): Promise<ThumbnailGenerationResult> {
    const startTime = performance.now();
    
    try {
      // Create temporary canvas
      const canvas = document.createElement('canvas');
      canvas.width = config.width;
      canvas.height = config.height;

      // Create engine and scene
      const engine = new BABYLON.Engine(canvas, true, {
        antialias: config.antialiasing !== false,
        alpha: false,
        powerPreference: 'high-performance'
      });

      const scene = new BABYLON.Scene(engine);

      try {
        // Clone nodes to temporary scene
        const clonedNodes = await this.cloneNodesToScene(nodeIds, scene);
        if (clonedNodes.length === 0) {
          throw new Error('No valid nodes found');
        }

        // Set up camera
        this.setupCamera(scene, clonedNodes, config);

        // Set up lighting
        this.setupLighting(scene, config);

        // Set up environment
        this.setupEnvironment(scene, config);

        // Render the scene
        scene.render();

        // Convert to image
        const thumbnailData = await this.canvasToImage(canvas, config);

        const generationTime = performance.now() - startTime;

        return {
          success: true,
          thumbnailData,
          metadata: {
            width: config.width,
            height: config.height,
            format: config.format || 'png',
            fileSize: this.calculateImageSize(thumbnailData),
            generationTime
          }
        };

      } finally {
        // Clean up
        scene.dispose();
        engine.dispose();
      }

    } catch (error) {
      console.error('[ThumbnailGeneration] Generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate multiple thumbnails with different angles
   */
  public async generateMultiAngleThumbnails(
    modelUrl: string,
    baseConfig: ThumbnailGenerationConfig
  ): Promise<Record<string, ThumbnailGenerationResult>> {
    const angles = ['isometric', 'front', 'side', 'top'] as const;
    const results: Record<string, ThumbnailGenerationResult> = {};

    for (const angle of angles) {
      const config = { ...baseConfig, cameraAngle: angle };
      results[angle] = await this.generateThumbnailFromUrl(modelUrl, config);
    }

    return results;
  }

  /**
   * Upload thumbnail to CDN
   */
  public async uploadThumbnail(
    thumbnailData: string,
    assetId: string
  ): Promise<string> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thumbnailData,
          assetId,
          format: 'png'
        })
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.thumbnailUrl;
    } catch (error) {
      console.error('[ThumbnailGeneration] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Load 3D model into scene
   */
  private async loadModel(_scene: BABYLON.Scene, modelUrl: string): Promise<BABYLON.TransformNode[]> {
    return new Promise((resolve, reject) => {
      BABYLON.SceneLoader.ImportMesh(
        '',
        '',
        modelUrl,
        _scene,
        (meshes, _particleSystems, _skeletons, _animationGroups, transformNodes) => {
          const allNodes = [...transformNodes, ...meshes];
          resolve(allNodes as BABYLON.TransformNode[]);
        },
        null,
        (_sceneError, message) => {
          reject(new Error(`Failed to load model: ${message}`));
        }
      );
    });
  }

  /**
   * Clone nodes from main scene to thumbnail scene
   */
  private async cloneNodesToScene(_nodeIds: string[], _scene: BABYLON.Scene): Promise<BABYLON.TransformNode[]> {
    // This would require access to the main scene and SceneTreeManager
    // For now, return empty array - this would be implemented with proper scene access
    return [];
  }

  /**
   * Set up camera for thumbnail generation
   */
  private setupCamera(
    scene: BABYLON.Scene,
    target: BABYLON.TransformNode[] | BABYLON.TransformNode,
    config: ThumbnailGenerationConfig
  ): BABYLON.ArcRotateCamera {
    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(target);
    
    let cameraPosition: BABYLON.Vector3;
    let cameraTarget: BABYLON.Vector3;

    if (config.customCameraPosition && config.customCameraTarget) {
      cameraPosition = config.customCameraPosition;
      cameraTarget = config.customCameraTarget;
    } else {
      cameraTarget = boundingBox ? boundingBox.center : BABYLON.Vector3.Zero();
      
      // Set camera position based on angle
      const radius = boundingBox ? (boundingBox.maximum.subtract(boundingBox.minimum)).length() * 2 : 5;
      
      switch (config.cameraAngle) {
        case 'front':
          cameraPosition = new BABYLON.Vector3(0, 0, radius);
          break;
        case 'side':
          cameraPosition = new BABYLON.Vector3(radius, 0, 0);
          break;
        case 'top':
          cameraPosition = new BABYLON.Vector3(0, radius, 0);
          break;
        case 'isometric':
        default:
          cameraPosition = new BABYLON.Vector3(
            radius * 0.7,
            radius * 0.7,
            radius * 0.7
          );
          break;
      }
    }

    const camera = new BABYLON.ArcRotateCamera(
      'thumbnailCamera',
      Math.atan2(cameraPosition.z, cameraPosition.x),
      Math.acos(cameraPosition.y / cameraPosition.length()),
      cameraPosition.length(),
      cameraTarget,
      scene
    );

    // Set camera limits
    camera.setTarget(cameraTarget);
    // Camera controls are disabled by not attaching them

    return camera;
  }

  /**
   * Set up lighting for thumbnail generation
   */
  private setupLighting(scene: BABYLON.Scene, config: ThumbnailGenerationConfig): void {
    switch (config.lighting) {
      case 'studio':
        // Studio lighting setup
        const keyLight = new BABYLON.DirectionalLight('keyLight', new BABYLON.Vector3(-1, -1, -1), scene);
        keyLight.intensity = 1.0;
        keyLight.diffuse = new BABYLON.Color3(1, 0.95, 0.8);

        const fillLight = new BABYLON.DirectionalLight('fillLight', new BABYLON.Vector3(1, -0.5, -0.5), scene);
        fillLight.intensity = 0.3;
        fillLight.diffuse = new BABYLON.Color3(0.8, 0.9, 1);

        const rimLight = new BABYLON.DirectionalLight('rimLight', new BABYLON.Vector3(0, 1, 1), scene);
        rimLight.intensity = 0.5;
        rimLight.diffuse = new BABYLON.Color3(1, 1, 0.9);
        break;

      case 'natural':
        // Natural lighting setup
        const sunLight = new BABYLON.DirectionalLight('sunLight', new BABYLON.Vector3(-1, -1, -1), scene);
        sunLight.intensity = 1.2;
        sunLight.diffuse = new BABYLON.Color3(1, 0.95, 0.8);

        const ambientLight = new BABYLON.HemisphericLight('ambientLight', new BABYLON.Vector3(0, 1, 0), scene);
        ambientLight.intensity = 0.4;
        ambientLight.diffuse = new BABYLON.Color3(0.8, 0.9, 1);
        break;

      case 'minimal':
      default:
        // Minimal lighting setup
        const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 1.0;
        break;
    }

    // Add shadows if requested
    if (config.shadows) {
      // Shadow generation would be implemented here
      // const shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
    }
  }

  /**
   * Set up environment (background, etc.)
   */
  private setupEnvironment(scene: BABYLON.Scene, config: ThumbnailGenerationConfig): void {
    // Set background color
    if (config.backgroundColor) {
      scene.clearColor = BABYLON.Color4.FromHexString(config.backgroundColor);
    } else {
      scene.clearColor = new BABYLON.Color4(0.95, 0.95, 0.95, 1); // Light gray
    }

    // Add subtle ground plane for context
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, scene);
    ground.position.y = -2;
    
    const groundMaterial = new BABYLON.StandardMaterial('groundMaterial', scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = groundMaterial;
  }

  /**
   * Calculate bounding box of target objects
   */
  private calculateBoundingBox(target: BABYLON.TransformNode[] | BABYLON.TransformNode): BABYLON.BoundingBox | null {
    const nodes = Array.isArray(target) ? target : [target];
    
    if (nodes.length === 0) return null;

    let min = new BABYLON.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new BABYLON.Vector3(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);

    for (const node of nodes) {
      if (node instanceof BABYLON.Mesh) {
        const boundingInfo = node.getBoundingInfo();
        const nodeMin = boundingInfo.minimum;
        const nodeMax = boundingInfo.maximum;

        min = BABYLON.Vector3.Minimize(min, nodeMin);
        max = BABYLON.Vector3.Maximize(max, nodeMax);
      }
    }

    return new BABYLON.BoundingBox(min, max);
  }

  /**
   * Convert canvas to image data
   */
  private async canvasToImage(canvas: HTMLCanvasElement, config: ThumbnailGenerationConfig): Promise<string> {
    const format = config.format || 'png';
    const quality = config.quality || 0.9;
    
    if (format === 'png') {
      return canvas.toDataURL('image/png');
    } else if (format === 'jpeg') {
      return canvas.toDataURL('image/jpeg', quality);
    } else if (format === 'webp') {
      return canvas.toDataURL('image/webp', quality);
    }
    
    return canvas.toDataURL('image/png');
  }

  /**
   * Calculate image file size from base64 data
   */
  private calculateImageSize(dataUrl: string): number {
    // Remove data URL prefix
    const base64Data = dataUrl.split(',')[1];
    // Calculate size in bytes
    return Math.round((base64Data.length * 3) / 4);
  }
}
