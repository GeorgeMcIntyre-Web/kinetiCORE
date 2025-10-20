// GLB Loader - Import GLB files with MJCF-compatible interface
// Owner: AI Assistant
// Supports: GLB files with visual-only representation
// Guard Rails: Comprehensive error handling, fallback mechanisms, backward compatibility

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

// Import MJCF types for interface compatibility
import { TransformNode, Scene, AbstractMesh } from '@babylonjs/core';

// Import up-axis detection utilities
import { autoFixUpAxis, UpAxisDetectionResult, clearUpAxisCache, normalizeYawOnGroundPlane } from './upAxis';

/**
 * Create a canonical file key for stable sibling cache
 * Collapses UNIT_104L.glb and UNIT_104L_.glb to the same key
 */
function makeCanonicalFileKey(name: string): string {
  // remove extension (case-insensitive)
  const base = name.replace(/\.[^.]+$/i, "");
  // collapse all non-alphanum, drop trailing underscores/dashes, lower-case
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")   // remove punctuation/underscores/spaces
    .replace(/[_-]+$/g, "");      // just in case
}

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
      // Clear stale cache on first use to ensure new detection logic runs
      clearUpAxisCache();
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
      enableUpAxisDetection: false,  // GLB files are Y-up by spec (glTF 2.0), use presentation layer conversion
      upAxisBake: false,
      upAxisVerbose: false,  // Disable verbose logging since detection is off
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

        // CRITICAL DIAGNOSTIC: Log original positions BEFORE any transformations
        console.group(`🔍 GLB LOAD: ${file.name}`);
        console.log('Root nodes:', result.rootNodes.length);
        result.rootNodes.forEach((root, i) => {
          const pos = root.getAbsolutePosition();
          const isSignificant = pos.length() > 0.1;
          console.log(`  Root ${i}: position (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) ${isSignificant ? '✅ SIGNIFICANT' : '❌ AT ORIGIN'}`);
        });
        console.log('Bounds:', result.bounds);
        console.log('Bounds center:', result.bounds?.center.toString());
        console.groupEnd();

        // Create a single file container for all root nodes to ensure consistent orientation
        const fileContainer = new TransformNode(file.name, scene);
        
        // ALWAYS use bounds center as canonical CAD position - this is the true model position
        let modelWorldPos = new BABYLON.Vector3(0, 0, 0);
        if (result.bounds) {
          modelWorldPos = result.bounds.center.clone();
          console.log(`[GLB] Bounds center: ${modelWorldPos.toString()}`);
        } else {
          // Calculate bounds if not provided
          const meshes = result.rootNodes.flatMap(r => r.getChildMeshes(false));
          if (meshes.length > 0) {
            const tempBounds = this.calculateBounds(meshes);
            modelWorldPos = tempBounds ? tempBounds.center.clone() : new BABYLON.Vector3(0, 0, 0);
          }
        }

        // Store original CAD position before any transformations
        fileContainer.metadata = { originalCADPosition: modelWorldPos.clone() };
        fileContainer.position.copyFrom(modelWorldPos);
        
        console.log(`[GLB] Container positioned at CAD coordinates: ${modelWorldPos.toString()}`);

        // Parent GLB roots under the container, calculating local offsets
        for (const root of result.rootNodes) {
          const worldPos = root.getAbsolutePosition().clone();
          const worldRot = root.absoluteRotationQuaternion?.clone();
          
          // Parent to container
          root.setParent(fileContainer);
          
          // Calculate local offset from container position
          root.position = worldPos.subtract(modelWorldPos);
          if (worldRot) {
            root.rotationQuaternion = worldRot;
          }
        }

        console.log(`[GLB Loader] Starting up-axis detection for: ${file.name}`);
        console.log(`[GLB Loader] Model positioned at original CAD coordinates`);

        // Generate file key for sibling consistency
        const fileKey = makeCanonicalFileKey(file.name);

        // Apply up-axis correction (creates wrapper if needed)
        const upAxisResult = autoFixUpAxis(fileContainer, {
          autoFix: true,
          useWrapper: true,
          verbose: true,
          confidenceThreshold: 0.5, // Lowered from 0.55
          fileKey,
        });

        result.upAxisDetection = upAxisResult;

        // CRITICAL: Restore CAD position after up-axis correction
        // The wrapper may have changed the effective position
        const finalRoot = upAxisResult.applied 
          ? (fileContainer.parent as TransformNode) 
          : fileContainer;

        if (upAxisResult.applied && finalRoot !== fileContainer) {
          // Wrapper was created - set wrapper position to original CAD position
          finalRoot.position.copyFrom(modelWorldPos);
          console.log(`[GLB] Position restored after up-axis correction: ${finalRoot.position.toString()}`);
        }

        // Apply yaw normalization (reuses wrapper)
        const yaw = normalizeYawOnGroundPlane(fileContainer, { fileKey, verbose: true });

        // Update result.rootNodes to return the final root (wrapper or container)
        result.rootNodes = [finalRoot];

        console.log(`[GLB Loader] Up-axis result for ${file.name}:`, {
          detected: upAxisResult.detected,
          confidence: upAxisResult.confidence,
          method: upAxisResult.method,
          applied: upAxisResult.applied,
          fileKey: fileKey
        });

        if (yaw.applied) {
          result.warnings.push(
            `Yaw normalized: rotated ${(yaw.angle * 180 / Math.PI).toFixed(0)}° around Y for consistent orientation`
          );
        }

        if (upAxisResult.applied) {
          result.warnings.push(
            `Up-axis corrected: ${upAxisResult.detected}-up → Y-up (${upAxisResult.method}, confidence: ${(upAxisResult.confidence * 100).toFixed(0)}%)`
          );
        } else if (upAxisResult.detected === 'Y') {
          result.warnings.push(
            `Up-axis detected as Y-up (no correction needed, ${upAxisResult.method}, confidence: ${(upAxisResult.confidence * 100).toFixed(0)}%)`
          );
        } else {
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

/**
 * Manually set the up-axis for specific files before loading
 * Use this if automatic detection fails
 * 
 * Example usage:
 * ```
 * import { setManualUpAxis } from './GLBLoader';
 * 
 * // Before loading files
 * setManualUpAxis('unit101', 'Y'); // Force UNIT_101 files to Y-up
 * setManualUpAxis('unit104l', 'Z'); // Force UNIT_104L files to Z-up
 * ```
 */
export function setManualUpAxis(fileKey: string, axis: 'Y' | 'Z'): void {
  // Access the cache from upAxis module
  const { decisionCache } = require('./upAxis');
  decisionCache.set(fileKey, axis);
  console.log(`[GLB Loader] Manual override set: ${fileKey} -> ${axis}-up`);
}

/**
 * Diagnostic function to analyze loaded GLB files
 * Call this from browser console after loading your files
 */
export function diagnoseAllLoadedFiles(scene: BABYLON.Scene): void {
  console.group('🔍 UP-AXIS DIAGNOSTIC REPORT');
  
  const allNodes = scene.transformNodes;
  const glbFiles = allNodes.filter(node => 
    node.name.endsWith('.glb') || node.name.endsWith('.GLB')
  );
  
  console.log(`Found ${glbFiles.length} GLB file containers\n`);
  
  glbFiles.forEach((container, index) => {
    console.group(`📦 File ${index + 1}: ${container.name}`);
    
    // Get bounds
    const meshes = container.getChildMeshes(false);
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    
    meshes.forEach(mesh => {
      const bounds = mesh.getBoundingInfo();
      const min = bounds.boundingBox.minimumWorld;
      const max = bounds.boundingBox.maximumWorld;
      
      minX = Math.min(minX, min.x);
      maxX = Math.max(maxX, max.x);
      minY = Math.min(minY, min.y);
      maxY = Math.max(maxY, max.y);
      minZ = Math.min(minZ, min.z);
      maxZ = Math.max(maxZ, max.z);
    });
    
    const extX = maxX - minX;
    const extY = maxY - minY;
    const extZ = maxZ - minZ;
    
    console.log('📏 Dimensions:');
    console.log(`   X: ${extX.toFixed(3)} (${minX.toFixed(2)} to ${maxX.toFixed(2)})`);
    console.log(`   Y: ${extY.toFixed(3)} (${minY.toFixed(2)} to ${maxY.toFixed(2)})`);
    console.log(`   Z: ${extZ.toFixed(3)} (${minZ.toFixed(2)} to ${maxZ.toFixed(2)})`);
    
    const tallest = Math.max(extX, extY, extZ);
    let expectedUp = 'UNKNOWN';
    if (tallest === extY) expectedUp = 'Y';
    else if (tallest === extZ) expectedUp = 'Z';
    else expectedUp = 'X';
    
    console.log(`\n🎯 Expected Up-Axis: ${expectedUp}-up (tallest dimension)`);
    
    // Check for wrapper
    const hasWrapper = container.parent && 
                      container.parent.metadata && 
                      container.parent.metadata.__axisWrapper;
    
    if (hasWrapper) {
      console.log('✅ Has axis wrapper (rotation applied)');
      const wrapper = container.parent as BABYLON.TransformNode;
      const rotation = wrapper.rotationQuaternion?.toEulerAngles() || wrapper.rotation;
      console.log(`   Rotation: ${rotation.x.toFixed(2)}, ${rotation.y.toFixed(2)}, ${rotation.z.toFixed(2)}`);
    } else {
      console.log('❌ No axis wrapper found');
    }
    
    // Check metadata
    if (container.metadata) {
      console.log('\n📋 Metadata:', container.metadata);
    }
    
    // Position
    console.log(`\n📍 Position: (${container.position.x.toFixed(2)}, ${container.position.y.toFixed(2)}, ${container.position.z.toFixed(2)})`);
    
    // Recommendation
    if (expectedUp === 'Y' && !hasWrapper) {
      console.log('\n✅ CORRECT: Y-up file with no rotation (as expected)');
    } else if (expectedUp === 'Z' && hasWrapper) {
      console.log('\n✅ CORRECT: Z-up file with rotation applied');
    } else if (expectedUp === 'Y' && hasWrapper) {
      console.log('\n⚠️  WARNING: Y-up file incorrectly rotated!');
    } else if (expectedUp === 'Z' && !hasWrapper) {
      console.log('\n⚠️  WARNING: Z-up file missing rotation!');
    }
    
    console.groupEnd();
    console.log('\n');
  });
  
  console.groupEnd();
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).diagnoseGLBFiles = diagnoseAllLoadedFiles;
}
