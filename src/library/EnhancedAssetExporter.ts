/**
 * Enhanced Asset Exporter with AI Integration
 * Owner: George
 * 
 * Enhanced asset exporter that integrates with metadata extraction,
 * thumbnail generation, and versioning systems
 */

import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../scene/SceneTreeManager';
import { SceneManager } from '../scene/SceneManager';
import { AssetDatabase } from './AssetDatabase';
import { MetadataExtractionService } from './services/MetadataExtractionService';
import { ThumbnailGenerationService } from './services/ThumbnailGenerationService';
import { AssetVersioningSystem } from './services/AssetVersioningSystem';
import type { LibraryAsset } from './types';

/**
 * Enhanced asset export configuration
 */
export interface EnhancedAssetExportConfig {
  name?: string;
  description?: string;
  tags?: string[];
  assetClass?: 'robots' | 'endEffectors' | 'machinery' | 'equipment' | 'buildings' | 'structures' | 'vehicles' | 'tools' | 'primitives';
  domain?: 'manufacturing' | 'logistics' | 'medical' | 'construction' | 'aerospace' | 'research' | 'custom';
  
  // AI Enhancement options
  extractMetadata?: boolean;
  metadataQuery?: string; // Part number, URL, or product name
  enhanceDescription?: boolean;
  suggestTags?: boolean;
  
  // Thumbnail options
  generateThumbnail?: boolean;
  thumbnailConfig?: {
    width?: number;
    height?: number;
    quality?: number;
    cameraAngle?: 'isometric' | 'front' | 'side' | 'top' | 'custom';
    lighting?: 'studio' | 'natural' | 'minimal';
    shadows?: boolean;
  };
  
  // Versioning options
  createVersion?: boolean;
  versionDescription?: string;
  versionTags?: string[];
  
  // File options
  includeMeshData?: boolean;
  includeKinematics?: boolean;
  optimizeGeometry?: boolean;
  
  // User context
  createdBy?: string;
}

/**
 * Enhanced asset export result
 */
export interface EnhancedAssetExportResult {
  success: boolean;
  assetId?: string;
  assetName?: string;
  thumbnailData?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  versionId?: string;
  metadataExtraction?: {
    success: boolean;
    confidence: 'high' | 'medium' | 'low';
    extractedData: Partial<LibraryAsset>;
  };
  aiEnhancements?: {
    enhancedDescription?: string;
    suggestedTags?: string[];
    suggestedCapabilities?: any;
  };
  errors?: string[];
  warnings?: string[];
}

/**
 * Enhanced Asset Exporter
 */
export class EnhancedAssetExporter {
  private static instance: EnhancedAssetExporter | null = null;
  private assetDatabase: AssetDatabase;
  private metadataService: MetadataExtractionService;
  private thumbnailService: ThumbnailGenerationService;
  private versioningSystem: AssetVersioningSystem;

  private constructor() {
    this.assetDatabase = AssetDatabase.getInstance();
    this.metadataService = MetadataExtractionService.getInstance();
    this.thumbnailService = ThumbnailGenerationService.getInstance();
    this.versioningSystem = AssetVersioningSystem.getInstance();
  }

  public static getInstance(): EnhancedAssetExporter {
    if (!EnhancedAssetExporter.instance) {
      EnhancedAssetExporter.instance = new EnhancedAssetExporter();
    }
    return EnhancedAssetExporter.instance;
  }

  /**
   * Export selected objects with AI enhancements
   */
  public async exportSelectedObjects(
    nodeIds: string[],
    config: EnhancedAssetExportConfig = {}
  ): Promise<EnhancedAssetExportResult> {
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

      // Step 1: Extract metadata if requested
      let metadataExtraction: EnhancedAssetExportResult['metadataExtraction'] = undefined;
      if (config.extractMetadata && config.metadataQuery) {
        try {
          const extractionResult = await this.metadataService.extractMetadata({
            query: config.metadataQuery,
            includeSpecifications: true,
            includeImages: true
          });

          metadataExtraction = {
            success: extractionResult.success,
            confidence: extractionResult.confidence,
            extractedData: extractionResult.data
          };
        } catch (error) {
          console.warn('[EnhancedAssetExporter] Metadata extraction failed:', error);
        }
      }

      // Step 2: Determine asset properties (use extracted metadata if available)
      const assetName = config.name || 
        metadataExtraction?.extractedData?.name || 
        this.generateAssetName(selectedNodes);
      
      const assetClass = (config.assetClass || 
        metadataExtraction?.extractedData?.assetClass || 
        this.detectAssetClass(selectedNodes)) as 'robots' | 'endEffectors' | 'machinery' | 'equipment' | 'buildings' | 'structures' | 'vehicles' | 'tools' | 'primitives';
      
      const domain = config.domain || 
        metadataExtraction?.extractedData?.domain || 
        'custom';

      // Step 3: Create enhanced library asset
      const libraryAsset: LibraryAsset = {
        id: this.generateAssetId(),
        name: assetName,
        domain,
        assetClass,
        assetType: this.detectAssetType(selectedNodes, assetClass),
        loaderType: 'primitive',
        filePath: '',
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
          hasKinematics: this.hasKinematics(selectedNodes),
          enhancedExport: true,
          metadataExtraction: metadataExtraction?.success || false
        }
      };

      // Step 4: Apply AI enhancements
      let aiEnhancements: EnhancedAssetExportResult['aiEnhancements'] = undefined;
      if (config.enhanceDescription || config.suggestTags) {
        aiEnhancements = await this.applyAIEnhancements(libraryAsset, selectedNodes, config);
        
        // Apply enhancements to asset
        if (aiEnhancements?.enhancedDescription) {
          libraryAsset.description = aiEnhancements.enhancedDescription;
        }
        if (aiEnhancements?.suggestedTags) {
          libraryAsset.tags = [...new Set([...libraryAsset.tags, ...aiEnhancements.suggestedTags])];
        }
        if (aiEnhancements?.suggestedCapabilities) {
          libraryAsset.capabilities = { ...libraryAsset.capabilities, ...aiEnhancements.suggestedCapabilities };
        }
      }

      // Step 5: Generate thumbnail
      let thumbnailData: string | undefined;
      let thumbnailUrl: string | undefined;
      if (config.generateThumbnail !== false) {
        try {
          const thumbnailResult = await this.thumbnailService.generateThumbnailFromNodes(nodeIds, {
            width: config.thumbnailConfig?.width || 512,
            height: config.thumbnailConfig?.height || 512,
            quality: config.thumbnailConfig?.quality || 0.9,
            cameraAngle: config.thumbnailConfig?.cameraAngle || 'isometric',
            lighting: config.thumbnailConfig?.lighting || 'studio',
            shadows: config.thumbnailConfig?.shadows || true,
            format: 'png'
          });

          if (thumbnailResult.success) {
            thumbnailData = thumbnailResult.thumbnailData;
            
            // Upload thumbnail to CDN if available
            try {
              if (thumbnailData) {
                thumbnailUrl = await this.thumbnailService.uploadThumbnail(thumbnailData, libraryAsset.id);
              }
            } catch (error) {
              console.warn('[EnhancedAssetExporter] Thumbnail upload failed:', error);
            }
          }
        } catch (error) {
          console.warn('[EnhancedAssetExporter] Thumbnail generation failed:', error);
        }
      }

      // Step 6: Serialize mesh data
      let meshData: string | undefined;
      if (config.includeMeshData !== false) {
        meshData = await this.serializeMeshData(selectedNodes);
      }

      // Step 7: Save to database
      const assetId = await this.assetDatabase.saveAsset(
        libraryAsset,
        thumbnailData,
        meshData
      );

      // Step 8: Create version if requested
      let versionId: string | undefined;
      if (config.createVersion && config.createdBy) {
        try {
          versionId = await this.versioningSystem.createVersion(assetId, libraryAsset, {
            description: config.versionDescription || `Enhanced export of ${assetName}`,
            tags: config.versionTags || ['enhanced-export'],
            includeThumbnail: true,
            includeMeshData: true,
            createdBy: config.createdBy
          });
        } catch (error) {
          console.warn('[EnhancedAssetExporter] Version creation failed:', error);
        }
      }

      console.log(`[EnhancedAssetExporter] Exported enhanced asset: ${assetName} (${assetId})`);

      return {
        success: true,
        assetId,
        assetName,
        thumbnailData,
        thumbnailUrl,
        fileSize: this.calculateFileSize(libraryAsset, thumbnailData, meshData),
        versionId,
        metadataExtraction,
        aiEnhancements
      };

    } catch (error) {
      console.error('[EnhancedAssetExporter] Export failed:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Apply AI enhancements to asset
   */
  private async applyAIEnhancements(
    _asset: LibraryAsset,
    nodes: any[],
    config: EnhancedAssetExportConfig
  ): Promise<EnhancedAssetExportResult['aiEnhancements']> {
    const enhancements: EnhancedAssetExportResult['aiEnhancements'] = {};

    try {
      // Enhance description using AI
      if (config.enhanceDescription) {
        const currentDescription = _asset.description || '';
        const nodeInfo = this.analyzeNodes(nodes);
        
        // Use AI to enhance description
        const enhancedDescription = await this.enhanceDescriptionWithAI(currentDescription, nodeInfo);
        if (enhancedDescription) {
          enhancements.enhancedDescription = enhancedDescription;
        }
      }

      // Suggest tags using AI
      if (config.suggestTags) {
        const suggestedTags = await this.suggestTagsWithAI(_asset, nodes);
        if (suggestedTags.length > 0) {
          enhancements.suggestedTags = suggestedTags;
        }
      }

      // Suggest capabilities
      const suggestedCapabilities = await this.suggestCapabilitiesWithAI(_asset, nodes);
      if (Object.keys(suggestedCapabilities).length > 0) {
        enhancements.suggestedCapabilities = suggestedCapabilities;
      }

    } catch (error) {
      console.warn('[EnhancedAssetExporter] AI enhancements failed:', error);
    }

    return enhancements;
  }

  /**
   * Enhance description using AI
   */
  private async enhanceDescriptionWithAI(currentDescription: string, nodeInfo: any): Promise<string | null> {
    try {
      // This would integrate with an AI service to enhance descriptions
      // For now, return a basic enhancement
      if (currentDescription.length < 50) {
        return `${currentDescription} - A ${nodeInfo.type} component with ${nodeInfo.meshCount} meshes and ${nodeInfo.hasKinematics ? 'kinematic' : 'static'} properties.`;
      }
      return null;
    } catch (error) {
      console.warn('[EnhancedAssetExporter] Description enhancement failed:', error);
      return null;
    }
  }

  /**
   * Suggest tags using AI
   */
  private async suggestTagsWithAI(asset: LibraryAsset, _nodes: any[]): Promise<string[]> {
    try {
      // This would integrate with an AI service to suggest relevant tags
      // For now, return basic suggestions based on analysis
      const suggestions: string[] = [];
      
      const nodeInfo = this.analyzeNodes(_nodes);
      
      if (nodeInfo.hasKinematics) {
        suggestions.push('kinematic', 'movable');
      }
      
      if (nodeInfo.meshCount > 10) {
        suggestions.push('complex', 'detailed');
      }
      
      if (asset.domain === 'manufacturing') {
        suggestions.push('industrial', 'production');
      }
      
      return suggestions;
    } catch (error) {
      console.warn('[EnhancedAssetExporter] Tag suggestion failed:', error);
      return [];
    }
  }

  /**
   * Suggest capabilities using AI
   */
  private async suggestCapabilitiesWithAI(_asset: LibraryAsset, nodes: any[]): Promise<any> {
    try {
      // This would integrate with an AI service to suggest capabilities
      // For now, return basic suggestions
      const capabilities: any = {};
      
      const nodeInfo = this.analyzeNodes(nodes);
      
      if (nodeInfo.hasKinematics) {
        capabilities.hasKinematics = true;
        capabilities.dof = nodeInfo.jointCount || 0;
      }
      
      if (nodeInfo.boundingBox) {
        capabilities.dimensions = {
          length: nodeInfo.boundingBox.size.x,
          width: nodeInfo.boundingBox.size.z,
          height: nodeInfo.boundingBox.size.y
        };
      }
      
      return capabilities;
    } catch (error) {
      console.warn('[EnhancedAssetExporter] Capability suggestion failed:', error);
      return {};
    }
  }

  /**
   * Analyze nodes for AI processing
   */
  private analyzeNodes(nodes: any[]): any {
    return {
      count: nodes.length,
      meshCount: this.countMeshes(nodes),
      hasKinematics: this.hasKinematics(nodes),
      jointCount: this.countJoints(nodes),
      boundingBox: this.calculateBoundingBox(nodes),
      type: this.detectAssetType(nodes, 'structures')
    };
  }

  // ... (include all the existing methods from the original AssetExporter)
  
  /**
   * Generate asset name
   */
  private generateAssetName(nodes: any[]): string {
    if (nodes.length === 1) {
      return nodes[0].name || 'Exported Asset';
    }
    return `Exported Group (${nodes.length} objects)`;
  }

  /**
   * Detect asset class
   */
  private detectAssetClass(_nodes: any[]): string {
    // Use device classifier if available
    try {
      // const classification = this.deviceClassifier.classifyDevice(_nodes);
      return 'structures'; // Default fallback
    } catch {
      return 'structures';
    }
  }

  /**
   * Detect asset type
   */
  private detectAssetType(nodes: any[], assetClass: string): string {
    if (this.hasKinematics(nodes)) {
      return `${assetClass}-kinematic`;
    }
    return `${assetClass}-static`;
  }

  /**
   * Extract capabilities
   */
  private extractCapabilities(nodes: any[]): any {
    const capabilities: any = {};
    
    if (this.hasKinematics(nodes)) {
      capabilities.hasKinematics = true;
      capabilities.dof = this.countJoints(nodes);
    }
    
    const boundingBox = this.calculateBoundingBox(nodes);
    if (boundingBox) {
      capabilities.dimensions = {
        length: boundingBox.maximum.x - boundingBox.minimum.x,
        width: boundingBox.maximum.z - boundingBox.minimum.z,
        height: boundingBox.maximum.y - boundingBox.minimum.y
      };
    }
    
    return capabilities;
  }

  /**
   * Generate tags
   */
  private generateTags(nodes: any[], assetClass: string): string[] {
    const tags = [assetClass, 'exported'];
    
    if (this.hasKinematics(nodes)) {
      tags.push('kinematic', 'movable');
    }
    
    const meshCount = this.countMeshes(nodes);
    if (meshCount > 10) {
      tags.push('complex');
    } else if (meshCount === 1) {
      tags.push('simple');
    }
    
    return tags;
  }

  /**
   * Generate search keywords
   */
  private generateSearchKeywords(name: string, assetClass: string): string[] {
    return [
      name.toLowerCase(),
      assetClass.toLowerCase(),
      'exported',
      'custom'
    ];
  }

  /**
   * Generate description
   */
  private generateDescription(nodes: any[]): string {
    const meshCount = this.countMeshes(nodes);
    const hasKinematics = this.hasKinematics(nodes);
    
    let description = `Exported asset with ${meshCount} mesh${meshCount !== 1 ? 'es' : ''}`;
    
    if (hasKinematics) {
      description += ' and kinematic properties';
    }
    
    return description;
  }

  /**
   * Count meshes
   */
  private countMeshes(nodes: any[]): number {
    return nodes.filter(node => node.type === 'mesh').length;
  }

  /**
   * Check if has kinematics
   */
  private hasKinematics(nodes: any[]): boolean {
    return nodes.some(node => 
      node.type === 'joint' || 
      node.customMetadata?.hasKinematics ||
      node.name?.toLowerCase().includes('joint')
    );
  }

  /**
   * Count joints
   */
  private countJoints(nodes: any[]): number {
    return nodes.filter(node => 
      node.type === 'joint' || 
      node.name?.toLowerCase().includes('joint')
    ).length;
  }

  /**
   * Calculate bounding box
   */
  private calculateBoundingBox(_nodes: any[]): BABYLON.BoundingBox | null {
    // Implementation would calculate bounding box of all nodes
    return null;
  }

  /**
   * Serialize mesh data
   */
  private async serializeMeshData(_nodes: any[]): Promise<string> {
    // Implementation would serialize mesh data
    return JSON.stringify({ nodes: _nodes.length });
  }

  /**
   * Calculate file size
   */
  private calculateFileSize(asset: LibraryAsset, thumbnailData?: string, meshData?: string): number {
    let size = JSON.stringify(asset).length;
    
    if (thumbnailData) {
      size += thumbnailData.length;
    }
    
    if (meshData) {
      size += meshData.length;
    }
    
    return Math.round(size / 1024); // KB
  }

  /**
   * Generate asset ID
   */
  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
