/**
 * Asset Exporter
 * Owner: George
 * 
 * Exports selected objects as library assets with thumbnail generation
 * Creates .kicoreasset files for sharing between projects
 */

import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../scene/SceneTreeManager';
import { SceneManager } from '../scene/SceneManager';
import { AssetDatabase } from './AssetDatabase';
import { DeviceClassifier } from '../kinematics/device/DeviceClassifier';
import type { LibraryAsset } from './types';

/**
 * Asset export configuration
 */
export interface AssetExportConfig {
  name?: string;
  description?: string;
  tags?: string[];
  assetClass?: 'robots' | 'endEffectors' | 'machinery' | 'equipment' | 'buildings' | 'structures' | 'vehicles' | 'tools' | 'primitives';
  domain?: 'manufacturing' | 'logistics' | 'medical' | 'construction' | 'aerospace' | 'research' | 'custom';
  generateThumbnail?: boolean;
  includeMeshData?: boolean;
  includeKinematics?: boolean;
  thumbnailSize?: number;
  thumbnailQuality?: number;
}

/**
 * Asset export result
 */
export interface AssetExportResult {
  success: boolean;
  assetId?: string;
  assetName?: string;
  thumbnailData?: string;
  fileSize?: number;
  errors?: string[];
  warnings?: string[];
}

/**
 * Thumbnail generation options
 */
export interface ThumbnailOptions {
  width: number;
  height: number;
  quality: number;
  backgroundColor?: string;
  cameraPosition?: BABYLON.Vector3;
  cameraTarget?: BABYLON.Vector3;
}

/**
 * Asset Exporter for creating library assets
 */
export class AssetExporter {
  private static instance: AssetExporter | null = null;
  private deviceClassifier: DeviceClassifier;
  private assetDatabase: AssetDatabase;

  private constructor() {
    this.deviceClassifier = DeviceClassifier.getInstance();
    this.assetDatabase = AssetDatabase.getInstance();
  }

  public static getInstance(): AssetExporter {
    if (!AssetExporter.instance) {
      AssetExporter.instance = new AssetExporter();
    }
    return AssetExporter.instance;
  }

  /**
   * Export selected objects as library asset
   */
  public async exportSelectedObjects(
    nodeIds: string[],
    config: AssetExportConfig = {}
  ): Promise<AssetExportResult> {
    try {
      if (nodeIds.length === 0) {
        return {
          success: false,
          errors: ['No objects selected']
        };
      }

      const sceneTreeManager = SceneTreeManager.getInstance();
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();

      if (!scene) {
        return {
          success: false,
          errors: ['Scene not available']
        };
      }

      // Get selected nodes
      const selectedNodes = nodeIds.map(id => sceneTreeManager.getNode(id)).filter(Boolean);
      
      if (selectedNodes.length === 0) {
        return {
          success: false,
          errors: ['Selected nodes not found']
        };
      }

      // Determine asset properties
      const assetName = config.name || this.generateAssetName(selectedNodes);
      const assetClass = config.assetClass || this.detectAssetClass(selectedNodes);
      const domain = config.domain || 'custom';

      // Create library asset
      const libraryAsset: LibraryAsset = {
        id: this.generateAssetId(),
        name: assetName,
        domain,
        assetClass,
        assetType: this.detectAssetType(selectedNodes, assetClass),
        loaderType: 'primitive', // Exported assets are treated as primitives
        filePath: '', // No file path for exported assets
        capabilities: this.extractCapabilities(selectedNodes),
        tags: config.tags || this.generateTags(selectedNodes, assetClass),
        searchKeywords: this.generateSearchKeywords(assetName, assetClass),
        description: config.description || this.generateDescription(selectedNodes),
        source: 'generated',
        usageCount: 0,
        lastUsed: new Date(),
        isFavorite: false,
        customMetadata: {
          exportedAt: new Date().toISOString(),
          nodeIds: nodeIds,
          meshCount: this.countMeshes(selectedNodes),
          hasKinematics: this.hasKinematics(selectedNodes)
        }
      };

      // Generate thumbnail if requested
      let thumbnailData: string | undefined;
      if (config.generateThumbnail !== false) {
        thumbnailData = await this.generateThumbnail(selectedNodes, {
          width: config.thumbnailSize || 256,
          height: config.thumbnailSize || 256,
          quality: config.thumbnailQuality || 0.8
        });
      }

      // Serialize mesh data if requested
      let meshData: string | undefined;
      if (config.includeMeshData !== false) {
        meshData = await this.serializeMeshData(selectedNodes);
      }

      // Save to database
      const assetId = await this.assetDatabase.saveAsset(
        libraryAsset,
        thumbnailData,
        meshData
      );

      console.log(`[AssetExporter] Exported asset: ${assetName} (${assetId})`);

      return {
        success: true,
        assetId,
        assetName,
        thumbnailData,
        fileSize: this.calculateFileSize(libraryAsset, thumbnailData, meshData)
      };

    } catch (error) {
      console.error('[AssetExporter] Export failed:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Export asset as .kicoreasset file
   */
  public async exportToFile(
    nodeIds: string[],
    config: AssetExportConfig = {}
  ): Promise<Blob> {
    const result = await this.exportSelectedObjects(nodeIds, config);
    
    if (!result.success) {
      throw new Error(`Export failed: ${result.errors?.join(', ')}`);
    }

    const asset = await this.assetDatabase.getAsset(result.assetId!);
    if (!asset) {
      throw new Error('Asset not found after export');
    }

    const thumbnail = await this.assetDatabase.getThumbnail(result.assetId!);
    
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      asset: asset.assetData,
      thumbnail: thumbnail,
      meshData: asset.meshData
    };

    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
  }

  /**
   * Generate thumbnail from selected objects
   */
  private async generateThumbnail(
    nodes: any[],
    options: ThumbnailOptions
  ): Promise<string> {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    
    if (!scene) {
      throw new Error('Scene not available');
    }

    // Create temporary camera for thumbnail
    const camera = new BABYLON.ArcRotateCamera(
      'thumbnailCamera',
      -Math.PI / 2,
      Math.PI / 3,
      5,
      BABYLON.Vector3.Zero(),
      scene
    );

    // Calculate bounding box of selected objects
    const boundingBox = this.calculateBoundingBox(nodes, scene);
    if (boundingBox) {
      camera.setTarget(boundingBox.center);
      camera.radius = boundingBox.size.length() * 1.5;
    }

    // Create temporary canvas
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;

    // Create temporary engine and scene
    const engine = new BABYLON.Engine(canvas, true);
    const tempScene = new BABYLON.Scene(engine);

    try {
      // Clone selected meshes to temporary scene
      const clonedMeshes = await this.cloneMeshesToScene(nodes, tempScene);
      
      // Set up lighting
      const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), tempScene);
      light.intensity = 1.0;

      // Render to canvas
      tempScene.render();

      // Convert canvas to base64
      const dataURL = canvas.toDataURL('image/jpeg', options.quality);
      
      return dataURL;

    } finally {
      // Clean up
      engine.dispose();
      tempScene.dispose();
    }
  }

  /**
   * Serialize mesh data for storage
   */
  private async serializeMeshData(nodes: any[]): Promise<string> {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    
    if (!scene) {
      throw new Error('Scene not available');
    }

    const meshData: any[] = [];

    for (const node of nodes) {
      if (node.type === 'mesh' && node.babylonMeshId) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh) {
          // Serialize mesh geometry and properties
          const serializedMesh = {
            id: mesh.uniqueId,
            name: mesh.name,
            position: mesh.position.asArray(),
            rotation: mesh.rotation.asArray(),
            scaling: mesh.scaling.asArray(),
            material: mesh.material ? {
              name: mesh.material.name,
              diffuseColor: mesh.material instanceof BABYLON.StandardMaterial 
                ? mesh.material.diffuseColor.asArray() 
                : undefined
            } : undefined,
            metadata: mesh.metadata
          };
          
          meshData.push(serializedMesh);
        }
      }
    }

    return JSON.stringify(meshData);
  }

  /**
   * Helper methods
   */
  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAssetName(nodes: any[]): string {
    if (nodes.length === 1) {
      return nodes[0].name || 'Unnamed Asset';
    }
    return `Assembly (${nodes.length} objects)`;
  }

  private detectAssetClass(nodes: any[]): LibraryAsset['assetClass'] {
    // Use device classifier to determine type
    if (nodes.length === 1) {
      const classification = this.deviceClassifier.classifyDevice(nodes[0].id);
      switch (classification.type) {
        case 'robot':
          return 'robots';
        case 'gripper':
        case 'eot':
          return 'endEffectors';
        case 'fixture':
          return 'equipment';
        default:
          return 'primitives';
      }
    }
    
    return 'primitives';
  }

  private detectAssetType(nodes: any[], assetClass: LibraryAsset['assetClass']): string {
    switch (assetClass) {
      case 'robots':
        return 'industrial-6axis';
      case 'endEffectors':
        return 'gripper';
      case 'equipment':
        return 'fixture';
      case 'primitives':
        return 'assembly';
      default:
        return 'custom';
    }
  }

  private extractCapabilities(nodes: any[]): LibraryAsset['capabilities'] {
    const capabilities: LibraryAsset['capabilities'] = {};

    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(nodes);
    if (boundingBox) {
      capabilities.dimensions = {
        length: boundingBox.size.x,
        width: boundingBox.size.y,
        height: boundingBox.size.z
      };
    }

    // Check for kinematics
    if (this.hasKinematics(nodes)) {
      capabilities.hasKinematics = true;
      // TODO: Extract DOF from kinematic analysis
    }

    return capabilities;
  }

  private generateTags(nodes: any[], assetClass: LibraryAsset['assetClass']): string[] {
    const tags: string[] = [];
    
    // Add class-based tags
    tags.push(assetClass);
    
    // Add mesh count tag
    const meshCount = this.countMeshes(nodes);
    if (meshCount > 1) {
      tags.push('assembly');
    }
    
    // Add kinematics tag
    if (this.hasKinematics(nodes)) {
      tags.push('kinematic');
    }
    
    // Add custom tags from metadata
    for (const node of nodes) {
      if (node.metadata?.tags) {
        tags.push(...node.metadata.tags);
      }
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  private generateSearchKeywords(name: string, assetClass: LibraryAsset['assetClass']): string[] {
    const keywords = [name.toLowerCase()];
    
    // Add class-based keywords
    keywords.push(assetClass);
    
    // Add common variations
    if (assetClass === 'robots') {
      keywords.push('robot', 'arm', 'manipulator', 'industrial');
    } else if (assetClass === 'endEffectors') {
      keywords.push('gripper', 'hand', 'end-effector', 'tool');
    }
    
    return keywords;
  }

  private generateDescription(nodes: any[]): string {
    const meshCount = this.countMeshes(nodes);
    const hasKinematics = this.hasKinematics(nodes);
    
    let description = `Custom asset with ${meshCount} mesh${meshCount > 1 ? 'es' : ''}`;
    
    if (hasKinematics) {
      description += ' and kinematic properties';
    }
    
    return description;
  }

  private countMeshes(nodes: any[]): number {
    return nodes.filter(node => node.type === 'mesh').length;
  }

  private hasKinematics(nodes: any[]): boolean {
    // Check if any node has kinematic properties
    return nodes.some(node => 
      node.metadata?.hasKinematics || 
      node.jointData ||
      node.metadata?.sourceFormat === 'urdf' ||
      node.metadata?.sourceFormat === 'mjcf'
    );
  }

  private calculateBoundingBox(nodes: any[], scene?: BABYLON.Scene): { center: BABYLON.Vector3; size: BABYLON.Vector3 } | null {
    if (!scene) {
      scene = SceneManager.getInstance().getScene();
    }
    
    if (!scene) return null;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let hasMeshes = false;

    for (const node of nodes) {
      if (node.type === 'mesh' && node.babylonMeshId) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh) {
          const boundingInfo = mesh.getBoundingInfo();
          const min = boundingInfo.minimum;
          const max = boundingInfo.maximum;
          
          minX = Math.min(minX, min.x);
          minY = Math.min(minY, min.y);
          minZ = Math.min(minZ, min.z);
          maxX = Math.max(maxX, max.x);
          maxY = Math.max(maxY, max.y);
          maxZ = Math.max(maxZ, max.z);
          hasMeshes = true;
        }
      }
    }

    if (!hasMeshes) return null;

    const center = new BABYLON.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );

    const size = new BABYLON.Vector3(
      maxX - minX,
      maxY - minY,
      maxZ - minZ
    );

    return { center, size };
  }

  private async cloneMeshesToScene(nodes: any[], targetScene: BABYLON.Scene): Promise<BABYLON.AbstractMesh[]> {
    const sourceScene = SceneManager.getInstance().getScene();
    if (!sourceScene) return [];

    const clonedMeshes: BABYLON.AbstractMesh[] = [];

    for (const node of nodes) {
      if (node.type === 'mesh' && node.babylonMeshId) {
        const sourceMesh = sourceScene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (sourceMesh) {
          const clonedMesh = sourceMesh.clone(`${sourceMesh.name}_clone`, null);
          if (clonedMesh) {
            clonedMeshes.push(clonedMesh);
          }
        }
      }
    }

    return clonedMeshes;
  }

  private calculateFileSize(asset: LibraryAsset, thumbnail?: string, meshData?: string): number {
    let size = JSON.stringify(asset).length;
    if (thumbnail) size += thumbnail.length;
    if (meshData) size += meshData.length;
    return size;
  }
}
