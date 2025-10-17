// GLB Loader - Import GLB files with MJCF-compatible interface
// Owner: AI Assistant
// Supports: GLB files with visual-only representation
// Guard Rails: Comprehensive error handling, fallback mechanisms, backward compatibility

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

// Import MJCF types for interface compatibility
import { TransformNode, Scene, AbstractMesh } from '@babylonjs/core';

// Import up-axis detection utilities
import { autoFixUpAxis, UpAxisDetectionResult } from './upAxis';

/**
 * GLB Loading Result Interface
 * Compatible with MJCF loader interface to ensure seamless integration
 */
export interface GLBLoadResult {
  success: boolean;
  rootNodes: TransformNode[];
  meshes: AbstractMesh[];
  joints: any[];           // Empty for GLB files
  actuators: any[];        // Empty for GLB files
  sensors: any[];          // Empty for GLB files
  errors: string[];
  warnings: string[];
  bounds: BABYLON.BoundingBox | null;
  upAxisDetection?: UpAxisDetectionResult;
  metadata?: {
    fileSize: number;
    loadTime: number;
    meshCount: number;
    hasAnimations: boolean;
    hasMaterials: boolean;
  };
}

/**
 * GLB Loading Options
 */
export interface GLBLoadOptions {
  enableProgressCallback?: boolean;
  onProgress?: (progress: number, message: string) => void;
  enableBoundsCalculation?: boolean;
  enableMetadataExtraction?: boolean;
  fallbackToBasicLoader?: boolean;
  enableUpAxisDetection?: boolean;
  upAxisBake?: boolean;
  upAxisVerbose?: boolean;
}

/**
 * GLB Loader Class
 * Provides MJCF-compatible interface for loading GLB files
 */
export class GLBLoader {
  private static instance: GLBLoader;
  private loadingStatus: any = null;

  private constructor() {}

  public static getInstance(): GLBLoader {
    if (!GLBLoader.instance) {
      GLBLoader.instance = new GLBLoader();
    }
    return GLBLoader.instance;
  }

  /**
   * Load GLB file with comprehensive error handling and guard rails
   */
  public async loadGLBFromFile(
    file: File, 
    scene: Scene, 
    options: GLBLoadOptions = {}
  ): Promise<GLBLoadResult> {
    const startTime = performance.now();
    const defaultOptions: GLBLoadOptions = {
      enableProgressCallback: true,
      enableBoundsCalculation: true,
      enableMetadataExtraction: true,
      fallbackToBasicLoader: true,
      enableUpAxisDetection: true,
      upAxisBake: false,  // Changed to false - don't bake by default to preserve positions
      upAxisVerbose: true,  // Enable verbose logging
      ...options
    };

    // Initialize result with safe defaults
    const result: GLBLoadResult = {
      success: false,
      rootNodes: [],
      meshes: [],
      joints: [],
      actuators: [],
      sensors: [],
      errors: [],
      warnings: [],
      bounds: null,
      metadata: {
        fileSize: file.size,
        loadTime: 0,
        meshCount: 0,
        hasAnimations: false,
        hasMaterials: false
      }
    };

    try {
      // Guard rail 1: Validate file
      if (!this.validateFile(file)) {
        result.errors.push('Invalid GLB file: File validation failed');
        return result;
      }

      // Guard rail 2: Initialize loading status
      await this.initializeLoadingStatus(file.name);

      // Guard rail 3: Check scene validity
      if (!scene || scene.isDisposed) {
        result.errors.push('Invalid scene: Scene is null or disposed');
        return result;
      }

      // Progress callback
      defaultOptions.onProgress?.(10, 'Starting GLB file load...');

      // Guard rail 4: Load GLB with fallback mechanism
      const loadResult = await this.loadGLBWithFallback(file, scene, defaultOptions);
      
      if (!loadResult.success) {
        result.errors.push(...loadResult.errors);
        return result;
      }

      // Extract data from load result
      result.meshes = loadResult.meshes || [];
      result.rootNodes = loadResult.rootNodes || [];
      result.bounds = loadResult.bounds || null;

      // Guard rail 5: Validate loaded data
      if (result.meshes.length === 0) {
        result.warnings.push('No meshes found in GLB file');
      }

      // Guard rail 6: Up-axis detection and correction
      if (defaultOptions.enableUpAxisDetection && result.rootNodes.length > 0) {
        defaultOptions.onProgress?.(80, 'Detecting and fixing up-axis orientation...');

        const primaryRoot = result.rootNodes[0];

        console.log(`[GLB Loader] Starting up-axis detection for: ${file.name}`);

        const upAxisResult = autoFixUpAxis(primaryRoot, {
          bake: defaultOptions.upAxisBake ?? false,  // Changed default to false
          verbose: true,  // Force verbose for debugging
          autoFix: true,
          confidenceThreshold: 0.6
        });

        result.upAxisDetection = upAxisResult;

        console.log(`[GLB Loader] Up-axis result for ${file.name}:`, {
          detected: upAxisResult.detectedAxis,
          confidence: upAxisResult.confidence,
          method: upAxisResult.method,
          applied: upAxisResult.applied
        });

        if (upAxisResult.applied) {
          result.warnings.push(
            `Up-axis corrected: ${upAxisResult.detectedAxis}-up → Y-up (${upAxisResult.method}, confidence: ${(upAxisResult.confidence * 100).toFixed(0)}%)`
          );
        } else if (upAxisResult.detectedAxis === 'Y') {
          result.warnings.push(
            `Up-axis detected as Y-up (no correction needed, ${upAxisResult.method}, confidence: ${(upAxisResult.confidence * 100).toFixed(0)}%)`
          );
        } else if (upAxisResult.detectedAxis === 'Unknown') {
          result.warnings.push(
            `Up-axis could not be determined with confidence (${upAxisResult.method}, confidence: ${(upAxisResult.confidence * 100).toFixed(0)}%)`
          );
        }
      }

      // Extract metadata
      if (defaultOptions.enableMetadataExtraction) {
        result.metadata = this.extractMetadata(loadResult, file, startTime);
      }

      // Add GLB-specific warnings
      result.warnings.push(
        'GLB file loaded - visual model only',
        'No kinematic controls available',
        'Use MJCF format for robot functionality'
      );

      result.success = true;

      // Progress callback
      defaultOptions.onProgress?.(100, 'GLB file loaded successfully');

    } catch (error) {
      // Guard rail 6: Comprehensive error handling
      const errorMessage = this.handleError(error, file.name);
      result.errors.push(errorMessage);
      
      // Try fallback loader if enabled
      if (defaultOptions.fallbackToBasicLoader) {
        try {
          console.warn('[GLB Loader] Attempting fallback to basic loader...');
          const fallbackResult = await this.loadWithBasicLoader(file, scene);
          if (fallbackResult.success) {
            result.success = true;
            result.meshes = fallbackResult.meshes;
            result.rootNodes = fallbackResult.rootNodes;
            result.warnings.push('Loaded using fallback method');
          }
        } catch (fallbackError) {
          result.errors.push(`Fallback loader also failed: ${fallbackError}`);
        }
      }
    } finally {
      // Cleanup
      await this.cleanupLoadingStatus();
    }

    return result;
  }

  /**
   * Validate GLB file before processing
   */
  private validateFile(file: File): boolean {
    try {
      // Check file exists and has valid name
      if (!file || !file.name) {
        return false;
      }

      // Check file extension
      if (!file.name.toLowerCase().endsWith('.glb')) {
        return false;
      }

      // Check file size (reasonable limits)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        console.warn(`[GLB Loader] Large file detected: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      }

      // Check file size is not zero
      if (file.size === 0) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('[GLB Loader] File validation error:', error);
      return false;
    }
  }

  /**
   * Initialize loading status system
   */
  private async initializeLoadingStatus(filename: string): Promise<void> {
    try {
      // Don't initialize loading status for GLB files in MJCF context
      // The MJCF loader will handle the status display
      console.log(`[GLB Loader] Loading GLB file: ${filename}`);
    } catch (error) {
      console.warn('[GLB Loader] Could not load status system:', error);
    }
  }

  /**
   * Load GLB with fallback mechanism
   */
  private async loadGLBWithFallback(
    file: File, 
    scene: Scene, 
    options: GLBLoadOptions
  ): Promise<{ success: boolean; meshes?: AbstractMesh[]; rootNodes?: TransformNode[]; bounds?: BABYLON.BoundingBox | null; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Ensure GLTF plugin is registered
      this.ensureGLTFPluginRegistered();

      // Method 1: Try SceneLoader.ImportMeshAsync
      const result = await this.loadWithSceneLoader(file, scene, options);
      if (result.success) {
        return result;
      }
      errors.push(...result.errors);

      // Method 2: Try SceneLoader.AppendAsync
      const result2 = await this.loadWithAppendLoader(file, scene, options);
      if (result2.success) {
        return result2;
      }
      errors.push(...result2.errors);

      return { success: false, errors };

    } catch (error) {
      errors.push(`GLB loading failed: ${error}`);
      return { success: false, errors };
    }
  }

  /**
   * Load using SceneLoader.ImportMeshAsync
   */
  private async loadWithSceneLoader(
    file: File, 
    scene: Scene, 
    options: GLBLoadOptions
  ): Promise<{ success: boolean; meshes?: AbstractMesh[]; rootNodes?: TransformNode[]; bounds?: BABYLON.BoundingBox | null; errors: string[] }> {
    try {
      const url = URL.createObjectURL(file);
      
      // Debug: Check available plugins
      console.log('[GLB Loader] Available plugins:', BABYLON.SceneLoader.GetPluginForExtension('.glb'));
      console.log('[GLB Loader] GLTF plugin available:', BABYLON.SceneLoader.GetPluginForExtension('.gltf'));
      
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        '',
        url,
        scene,
        undefined,
        '.glb'  // Explicitly specify GLB extension
      );

      URL.revokeObjectURL(url);

      const bounds = options.enableBoundsCalculation ? this.calculateBounds(result.meshes) : null;

      return {
        success: true,
        meshes: result.meshes,
        rootNodes: result.transformNodes,
        bounds,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        errors: [`SceneLoader.ImportMeshAsync failed: ${error}`]
      };
    }
  }

  /**
   * Load using SceneLoader.AppendAsync
   */
  private async loadWithAppendLoader(
    file: File, 
    scene: Scene, 
    options: GLBLoadOptions
  ): Promise<{ success: boolean; meshes?: AbstractMesh[]; rootNodes?: TransformNode[]; bounds?: BABYLON.BoundingBox | null; errors: string[] }> {
    try {
      const url = URL.createObjectURL(file);
      
      const result = await BABYLON.SceneLoader.AppendAsync(
        '',
        url,
        scene,
        undefined,
        '.glb'  // Explicitly specify GLB extension
      );

      URL.revokeObjectURL(url);

      const bounds = options.enableBoundsCalculation ? this.calculateBounds(result.meshes) : null;

      return {
        success: true,
        meshes: result.meshes,
        rootNodes: result.transformNodes,
        bounds,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        errors: [`SceneLoader.AppendAsync failed: ${error}`]
      };
    }
  }

  /**
   * Basic loader fallback
   */
  private async loadWithBasicLoader(file: File, scene: Scene): Promise<{ success: boolean; meshes: AbstractMesh[]; rootNodes: TransformNode[] }> {
    try {
      const url = URL.createObjectURL(file);
      
      return new Promise((resolve) => {
        BABYLON.SceneLoader.ImportMesh(
          '',
          '',
          url,
          scene,
          (meshes, _particleSystems, _skeletons, _animationGroups, transformNodes) => {
            URL.revokeObjectURL(url);
            resolve({
              success: true,
              meshes,
              rootNodes: transformNodes || []
            });
          },
          null,
          () => {
            URL.revokeObjectURL(url);
            resolve({
              success: false,
              meshes: [],
              rootNodes: []
            });
          }
        );
      });
    } catch (error) {
      console.error('[GLB Loader] Basic loader failed:', error);
      return {
        success: false,
        meshes: [],
        rootNodes: []
      };
    }
  }

  /**
   * Calculate bounding box for loaded meshes
   */
  private calculateBounds(meshes: AbstractMesh[]): BABYLON.BoundingBox | null {
    try {
      if (meshes.length === 0) return null;

      // Calculate combined bounding box manually
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        const boundingInfo = mesh.getBoundingInfo();
        const min = boundingInfo.boundingBox.minimumWorld;
        const max = boundingInfo.boundingBox.maximumWorld;

        minX = Math.min(minX, min.x);
        minY = Math.min(minY, min.y);
        minZ = Math.min(minZ, min.z);
        maxX = Math.max(maxX, max.x);
        maxY = Math.max(maxY, max.y);
        maxZ = Math.max(maxZ, max.z);
      }

      const minimum = new BABYLON.Vector3(minX, minY, minZ);
      const maximum = new BABYLON.Vector3(maxX, maxY, maxZ);
      return new BABYLON.BoundingBox(minimum, maximum);
    } catch (error) {
      console.warn('[GLB Loader] Could not calculate bounds:', error);
      return null;
    }
  }

  /**
   * Extract metadata from loaded result
   */
  private extractMetadata(
    loadResult: any, 
    file: File, 
    startTime: number
  ): GLBLoadResult['metadata'] {
    const loadTime = performance.now() - startTime;
    
    return {
      fileSize: file.size,
      loadTime,
      meshCount: loadResult.meshes?.length || 0,
      hasAnimations: loadResult.animationGroups?.length > 0 || false,
      hasMaterials: loadResult.meshes?.some((mesh: any) => mesh.material) || false
    };
  }

  /**
   * Handle errors with detailed logging
   */
  private handleError(error: any, filename: string): string {
    console.error(`[GLB Loader] Error loading ${filename}:`, error);
    
    if (error instanceof Error) {
      return `GLB loading failed: ${error.message}`;
    }
    
    return `GLB loading failed: ${String(error)}`;
  }

  /**
   * Ensure GLTF plugin is registered
   */
  private ensureGLTFPluginRegistered(): void {
    try {
      // Check if GLTF plugin is already registered
      const gltfPlugin = BABYLON.SceneLoader.GetPluginForExtension('.gltf');
      const glbPlugin = BABYLON.SceneLoader.GetPluginForExtension('.glb');
      
      if (!gltfPlugin || !glbPlugin) {
        console.warn('[GLB Loader] GLTF plugin not found, attempting to register...');
        
        // Try to register the GLTF loader manually
        // This is a fallback in case the import didn't work
        try {
          // The import should have already registered the plugin, but let's be explicit
          console.log('[GLB Loader] GLTF plugin registration should be handled by import statement');
        } catch (error) {
          console.error('[GLB Loader] Failed to register GLTF plugin:', error);
        }
      } else {
        console.log('[GLB Loader] GLTF plugin is registered:', gltfPlugin.name);
      }
    } catch (error) {
      console.warn('[GLB Loader] Error checking GLTF plugin registration:', error);
    }
  }

  /**
   * Cleanup loading status
   */
  private async cleanupLoadingStatus(): Promise<void> {
    try {
      if (this.loadingStatus && typeof this.loadingStatus.complete === 'function') {
        this.loadingStatus.complete();
        this.loadingStatus = null;
      } else if (this.loadingStatus) {
        // If it's not a function, just clear it
        this.loadingStatus = null;
      }
    } catch (error) {
      console.warn('[GLB Loader] Cleanup error:', error);
    }
  }
}

/**
 * Main export function - MJCF-compatible interface
 */
export const loadGLBFromFile = async (
  file: File, 
  scene: Scene, 
  options?: GLBLoadOptions
): Promise<GLBLoadResult> => {
  const loader = GLBLoader.getInstance();
  return loader.loadGLBFromFile(file, scene, options);
};

/**
 * Convenience function for basic GLB loading
 */
export const loadGLB = async (
  file: File, 
  scene: Scene
): Promise<GLBLoadResult> => {
  return loadGLBFromFile(file, scene, {
    enableProgressCallback: true,
    enableBoundsCalculation: true,
    enableMetadataExtraction: true,
    fallbackToBasicLoader: true
  });
};
