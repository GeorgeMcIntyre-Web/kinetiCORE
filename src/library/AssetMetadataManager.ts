/**
 * Asset Metadata Management System
 * Owner: George
 * 
 * Comprehensive metadata management for assets with intelligent categorization,
 * search optimization, and analytics tracking
 */

import type { LibraryAsset } from './types';
import type { User } from '../auth/UserStore';

/**
 * Enhanced Asset Metadata Types
 */
export interface AssetMetadata {
  // Core identification
  id: string;
  name: string;
  description?: string;
  version: string;
  
  // File information
  fileInfo: {
    originalName: string;
    filePath: string;
    fileSize: number; // bytes
    mimeType: string;
    checksum: string;
    uploadDate: Date;
    lastModified: Date;
  };
  
  // Asset classification
  classification: {
    domain: string; // 'robotics', 'manufacturing', 'automotive', etc.
    assetClass: string; // 'structures', 'machines', 'tools', etc.
    assetType: string; // 'robot', 'conveyor', 'fixture', etc.
    category: string; // 'industrial', 'commercial', 'educational', etc.
    subcategory?: string;
  };
  
  // Technical metadata
  technical: {
    loaderType: string;
    capabilities: string[];
    complexity: 'simple' | 'medium' | 'complex';
    polygonCount?: number;
    textureCount?: number;
    materialCount?: number;
    animationCount?: number;
    physicsEnabled: boolean;
    collisionGeometry: boolean;
    boundingBox: {
      min: [number, number, number];
      max: [number, number, number];
    };
    centerOfMass?: [number, number, number];
    inertiaMatrix?: number[][];
  };
  
  // Search and discovery
  searchable: {
    keywords: string[];
    tags: string[];
    manufacturers: string[];
    models: string[];
    partNumbers: string[];
    standards: string[]; // ISO, ANSI, etc.
    certifications: string[];
  };
  
  // Usage and analytics
  analytics: {
    viewCount: number;
    downloadCount: number;
    usageCount: number;
    rating: number;
    ratingCount: number;
    lastUsed: Date;
    popularityScore: number;
    trendingScore: number;
  };
  
  // Quality and validation
  quality: {
    validationStatus: 'pending' | 'validated' | 'failed' | 'warning';
    validationErrors: string[];
    qualityScore: number; // 0-100
    optimizationLevel: 'none' | 'basic' | 'advanced' | 'professional';
    compressionRatio?: number;
    lodLevels?: number;
  };
  
  // Relationships and dependencies
  relationships: {
    parentAssets: string[];
    childAssets: string[];
    relatedAssets: string[];
    dependencies: string[];
    usedInProjects: string[];
    compatibleWith: string[];
  };
  
  // Custom properties
  customProperties: Record<string, any>;
  
  // Provenance and licensing
  provenance: {
    source: 'upload' | 'library' | 'generated' | 'imported';
    originalAuthor?: string;
    license: string;
    copyright?: string;
    attribution?: string;
    modificationRights: boolean;
    commercialUse: boolean;
  };
  
  // AI-generated metadata
  aiGenerated: {
    autoTags: string[];
    description: string;
    category: string;
    complexity: string;
    useCases: string[];
    technicalSpecs: Record<string, any>;
    confidence: number; // 0-1
    lastAnalyzed: Date;
  };
}

/**
 * Asset Metadata Manager
 */
export class AssetMetadataManager {
  private static instance: AssetMetadataManager | null = null;
  private metadataCache: Map<string, AssetMetadata> = new Map();
  private searchIndex: Map<string, Set<string>> = new Map();
  private categoryTree: Map<string, CategoryNode> = new Map();

  private constructor() {
    this.initializeCategoryTree();
  }

  public static getInstance(): AssetMetadataManager {
    if (!AssetMetadataManager.instance) {
      AssetMetadataManager.instance = new AssetMetadataManager();
    }
    return AssetMetadataManager.instance;
  }

  /**
   * Generate comprehensive metadata for an asset
   */
  public async generateMetadata(
    asset: LibraryAsset,
    file: File,
    user: User
  ): Promise<AssetMetadata> {
    const metadata: AssetMetadata = {
      id: asset.id,
      name: asset.name,
      description: asset.description,
      version: '1.0.0',
      
      fileInfo: {
        originalName: file.name,
        filePath: asset.filePath,
        fileSize: file.size,
        mimeType: file.type,
        checksum: await this.calculateChecksum(file),
        uploadDate: new Date(),
        lastModified: new Date()
      },
      
      classification: await this.classifyAsset(asset, file),
      
      technical: await this.extractTechnicalMetadata(asset, file),
      
      searchable: await this.generateSearchableContent(asset, file),
      
      analytics: {
        viewCount: 0,
        downloadCount: 0,
        usageCount: 0,
        rating: 0,
        ratingCount: 0,
        lastUsed: new Date(),
        popularityScore: 0,
        trendingScore: 0
      },
      
      quality: await this.validateAssetQuality(asset, file),
      
      relationships: {
        parentAssets: [],
        childAssets: [],
        relatedAssets: [],
        dependencies: [],
        usedInProjects: [],
        compatibleWith: []
      },
      
      customProperties: asset.customMetadata || {},
      
      provenance: {
        source: 'upload',
        originalAuthor: user.name,
        license: 'MIT',
        modificationRights: true,
        commercialUse: true
      },
      
      aiGenerated: await this.generateAIMetadata(asset, file)
    };

    // Cache metadata
    this.metadataCache.set(asset.id, metadata);
    
    // Update search index
    await this.updateSearchIndex(metadata);
    
    return metadata;
  }

  /**
   * Update asset metadata
   */
  public async updateMetadata(
    assetId: string,
    updates: Partial<AssetMetadata>
  ): Promise<AssetMetadata> {
    const existing = this.metadataCache.get(assetId);
    if (!existing) {
      throw new Error(`Metadata not found for asset: ${assetId}`);
    }

    const updated = { ...existing, ...updates };
    this.metadataCache.set(assetId, updated);
    
    // Update search index
    await this.updateSearchIndex(updated);
    
    return updated;
  }

  /**
   * Get asset metadata
   */
  public getMetadata(assetId: string): AssetMetadata | null {
    return this.metadataCache.get(assetId) || null;
  }

  /**
   * Search assets by metadata
   */
  public async searchByMetadata(query: {
    keywords?: string[];
    tags?: string[];
    category?: string;
    domain?: string;
    assetType?: string;
    manufacturer?: string;
    complexity?: string;
    qualityScore?: { min: number; max: number };
    rating?: { min: number; max: number };
    fileSize?: { min: number; max: number };
    uploadDate?: { from: Date; to: Date };
  }): Promise<string[]> {
    const results = new Set<string>();
    
    for (const [assetId, metadata] of this.metadataCache) {
      if (this.matchesQuery(metadata, query)) {
        results.add(assetId);
      }
    }
    
    return Array.from(results);
  }

  /**
   * Get asset analytics
   */
  public getAnalytics(assetId: string): AssetMetadata['analytics'] | null {
    const metadata = this.metadataCache.get(assetId);
    return metadata?.analytics || null;
  }

  /**
   * Update asset analytics
   */
  public async updateAnalytics(
    assetId: string,
    event: 'view' | 'download' | 'use' | 'rate',
    data?: any
  ): Promise<void> {
    const metadata = this.metadataCache.get(assetId);
    if (!metadata) return;

    const analytics = metadata.analytics;
    
    switch (event) {
      case 'view':
        analytics.viewCount++;
        analytics.lastUsed = new Date();
        break;
      case 'download':
        analytics.downloadCount++;
        analytics.lastUsed = new Date();
        break;
      case 'use':
        analytics.usageCount++;
        analytics.lastUsed = new Date();
        break;
      case 'rate':
        if (data?.rating) {
          const totalRating = analytics.rating * analytics.ratingCount;
          analytics.ratingCount++;
          analytics.rating = (totalRating + data.rating) / analytics.ratingCount;
        }
        break;
    }
    
    // Recalculate popularity score
    analytics.popularityScore = this.calculatePopularityScore(analytics);
    
    // Update cache
    this.metadataCache.set(assetId, metadata);
  }

  /**
   * Get category suggestions
   */
  public getCategorySuggestions(asset: LibraryAsset): string[] {
    const suggestions: string[] = [];
    
    // Based on asset class
    switch (asset.assetClass) {
      case 'structures':
        suggestions.push('industrial', 'manufacturing', 'construction');
        break;
      case 'machines':
        suggestions.push('automation', 'robotics', 'machining');
        break;
      case 'tools':
        suggestions.push('hand-tools', 'power-tools', 'specialized');
        break;
    }
    
    // Based on domain
    switch (asset.domain) {
      case 'robotics':
        suggestions.push('robot', 'automation', 'industrial');
        break;
      case 'manufacturing':
        suggestions.push('production', 'assembly', 'quality');
        break;
      case 'automotive':
        suggestions.push('vehicle', 'transportation', 'mobility');
        break;
    }
    
    return [...new Set(suggestions)];
  }

  /**
   * Get related assets
   */
  public async getRelatedAssets(assetId: string, limit: number = 10): Promise<string[]> {
    const metadata = this.metadataCache.get(assetId);
    if (!metadata) return [];

    const related = new Set<string>();
    
    // Find assets with similar tags
    for (const tag of metadata.searchable.tags) {
      const tagAssets = this.searchIndex.get(`tag:${tag}`) || new Set();
      for (const id of tagAssets) {
        if (id !== assetId) related.add(id);
      }
    }
    
    // Find assets with same category
    const categoryAssets = this.searchIndex.get(`category:${metadata.classification.category}`) || new Set();
    for (const id of categoryAssets) {
      if (id !== assetId) related.add(id);
    }
    
    // Find assets with same manufacturer
    for (const manufacturer of metadata.searchable.manufacturers) {
      const manufacturerAssets = this.searchIndex.get(`manufacturer:${manufacturer}`) || new Set();
      for (const id of manufacturerAssets) {
        if (id !== assetId) related.add(id);
      }
    }
    
    return Array.from(related).slice(0, limit);
  }

  /**
   * Private helper methods
   */
  private async calculateChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async classifyAsset(asset: LibraryAsset, file: File): Promise<AssetMetadata['classification']> {
    // Basic classification based on file extension and asset properties
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    let domain = asset.domain || 'general';
    let assetClass = asset.assetClass || 'structures';
    let assetType = asset.assetType || 'generic';
    let category = 'industrial';
    
    // Enhanced classification based on file type
    switch (extension) {
      case 'urdf':
        domain = 'robotics';
        assetClass = 'machines';
        assetType = 'robot';
        category = 'industrial';
        break;
      case 'glb':
      case 'gltf':
        if (asset.name.toLowerCase().includes('robot')) {
          domain = 'robotics';
          assetClass = 'machines';
          assetType = 'robot';
        } else if (asset.name.toLowerCase().includes('conveyor')) {
          domain = 'manufacturing';
          assetClass = 'machines';
          assetType = 'conveyor';
        }
        break;
      case 'stl':
        assetClass = 'structures';
        assetType = 'mesh';
        category = 'prototyping';
        break;
    }
    
    return {
      domain,
      assetClass,
      assetType,
      category,
      subcategory: undefined
    };
  }

  private async extractTechnicalMetadata(asset: LibraryAsset, file: File): Promise<AssetMetadata['technical']> {
    // Placeholder for technical metadata extraction
    // In a real implementation, this would parse the file and extract technical details
    
    return {
      loaderType: asset.loaderType,
      capabilities: asset.capabilities || [],
      complexity: 'medium',
      physicsEnabled: false,
      collisionGeometry: false,
      boundingBox: {
        min: [0, 0, 0],
        max: [1, 1, 1]
      }
    };
  }

  private async generateSearchableContent(asset: LibraryAsset, file: File): Promise<AssetMetadata['searchable']> {
    const keywords: string[] = [];
    const tags: string[] = [];
    const manufacturers: string[] = [];
    const models: string[] = [];
    const partNumbers: string[] = [];
    const standards: string[] = [];
    const certifications: string[] = [];
    
    // Extract keywords from name and description
    const text = `${asset.name} ${asset.description || ''}`.toLowerCase();
    const words = text.split(/\W+/).filter(word => word.length > 2);
    keywords.push(...words);
    
    // Extract tags from asset
    tags.push(...(asset.tags || []));
    
    // Extract manufacturer from name (basic heuristic)
    const manufacturerPatterns = [
      /^(fanuc|kuka|abb|yaskawa|mitsubishi|kawasaki|denso|staubli|comau|igus)/i,
      /^(bosch|siemens|schneider|omron|mitsubishi|allen-bradley)/i
    ];
    
    for (const pattern of manufacturerPatterns) {
      const match = asset.name.match(pattern);
      if (match) {
        manufacturers.push(match[1].toLowerCase());
        break;
      }
    }
    
    // Extract model numbers (basic heuristic)
    const modelPattern = /([a-z]+[\d]+[a-z]*)/gi;
    const modelMatches = asset.name.match(modelPattern);
    if (modelMatches) {
      models.push(...modelMatches.map(m => m.toLowerCase()));
    }
    
    return {
      keywords: [...new Set(keywords)],
      tags: [...new Set(tags)],
      manufacturers: [...new Set(manufacturers)],
      models: [...new Set(models)],
      partNumbers: [...new Set(partNumbers)],
      standards: [...new Set(standards)],
      certifications: [...new Set(certifications)]
    };
  }

  private async validateAssetQuality(asset: LibraryAsset, file: File): Promise<AssetMetadata['quality']> {
    const errors: string[] = [];
    let qualityScore = 100;
    
    // Check file size
    if (file.size > 100 * 1024 * 1024) { // 100MB
      errors.push('File size exceeds recommended limit');
      qualityScore -= 20;
    }
    
    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const supportedTypes = ['urdf', 'glb', 'gltf', 'stl', 'obj', 'dwg', 'jt'];
    if (!extension || !supportedTypes.includes(extension)) {
      errors.push('Unsupported file type');
      qualityScore -= 30;
    }
    
    // Check name quality
    if (asset.name.length < 3) {
      errors.push('Asset name too short');
      qualityScore -= 10;
    }
    
    if (!asset.description || asset.description.length < 10) {
      errors.push('Missing or insufficient description');
      qualityScore -= 15;
    }
    
    return {
      validationStatus: errors.length === 0 ? 'validated' : 'warning',
      validationErrors: errors,
      qualityScore: Math.max(0, qualityScore),
      optimizationLevel: 'none'
    };
  }

  private async generateAIMetadata(asset: LibraryAsset, file: File): Promise<AssetMetadata['aiGenerated']> {
    // Placeholder for AI-generated metadata
    // In a real implementation, this would use ML models to analyze the asset
    
    return {
      autoTags: ['industrial', '3d-model', 'mechanical'],
      description: `A ${asset.assetType} asset for ${asset.domain} applications`,
      category: asset.assetClass,
      complexity: 'medium',
      useCases: ['simulation', 'visualization', 'prototyping'],
      technicalSpecs: {},
      confidence: 0.7,
      lastAnalyzed: new Date()
    };
  }

  private async updateSearchIndex(metadata: AssetMetadata): Promise<void> {
    const assetId = metadata.id;
    
    // Index by tags
    for (const tag of metadata.searchable.tags) {
      const key = `tag:${tag}`;
      if (!this.searchIndex.has(key)) {
        this.searchIndex.set(key, new Set());
      }
      this.searchIndex.get(key)!.add(assetId);
    }
    
    // Index by category
    const categoryKey = `category:${metadata.classification.category}`;
    if (!this.searchIndex.has(categoryKey)) {
      this.searchIndex.set(categoryKey, new Set());
    }
    this.searchIndex.get(categoryKey)!.add(assetId);
    
    // Index by manufacturer
    for (const manufacturer of metadata.searchable.manufacturers) {
      const key = `manufacturer:${manufacturer}`;
      if (!this.searchIndex.has(key)) {
        this.searchIndex.set(key, new Set());
      }
      this.searchIndex.get(key)!.add(assetId);
    }
    
    // Index by keywords
    for (const keyword of metadata.searchable.keywords) {
      const key = `keyword:${keyword}`;
      if (!this.searchIndex.has(key)) {
        this.searchIndex.set(key, new Set());
      }
      this.searchIndex.get(key)!.add(assetId);
    }
  }

  private matchesQuery(metadata: AssetMetadata, query: any): boolean {
    // Keywords match
    if (query.keywords?.length) {
      const hasKeyword = query.keywords.some((keyword: string) =>
        metadata.searchable.keywords.some(k => k.includes(keyword.toLowerCase()))
      );
      if (!hasKeyword) return false;
    }
    
    // Tags match
    if (query.tags?.length) {
      const hasTag = query.tags.some((tag: string) =>
        metadata.searchable.tags.includes(tag.toLowerCase())
      );
      if (!hasTag) return false;
    }
    
    // Category match
    if (query.category && metadata.classification.category !== query.category) {
      return false;
    }
    
    // Domain match
    if (query.domain && metadata.classification.domain !== query.domain) {
      return false;
    }
    
    // Asset type match
    if (query.assetType && metadata.classification.assetType !== query.assetType) {
      return false;
    }
    
    // Manufacturer match
    if (query.manufacturer) {
      const hasManufacturer = metadata.searchable.manufacturers.includes(query.manufacturer.toLowerCase());
      if (!hasManufacturer) return false;
    }
    
    // Complexity match
    if (query.complexity && metadata.technical.complexity !== query.complexity) {
      return false;
    }
    
    // Quality score range
    if (query.qualityScore) {
      const score = metadata.quality.qualityScore;
      if (score < query.qualityScore.min || score > query.qualityScore.max) {
        return false;
      }
    }
    
    // Rating range
    if (query.rating) {
      const rating = metadata.analytics.rating;
      if (rating < query.rating.min || rating > query.rating.max) {
        return false;
      }
    }
    
    // File size range
    if (query.fileSize) {
      const size = metadata.fileInfo.fileSize;
      if (size < query.fileSize.min || size > query.fileSize.max) {
        return false;
      }
    }
    
    // Upload date range
    if (query.uploadDate) {
      const uploadDate = metadata.fileInfo.uploadDate;
      if (uploadDate < query.uploadDate.from || uploadDate > query.uploadDate.to) {
        return false;
      }
    }
    
    return true;
  }

  private calculatePopularityScore(analytics: AssetMetadata['analytics']): number {
    const viewWeight = 1;
    const downloadWeight = 3;
    const usageWeight = 5;
    const ratingWeight = 2;
    
    const score = (
      analytics.viewCount * viewWeight +
      analytics.downloadCount * downloadWeight +
      analytics.usageCount * usageWeight +
      analytics.rating * analytics.ratingCount * ratingWeight
    );
    
    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, score / 10));
  }

  private initializeCategoryTree(): void {
    // Initialize category hierarchy
    const categories = [
      { id: 'industrial', name: 'Industrial', parent: null },
      { id: 'robotics', name: 'Robotics', parent: 'industrial' },
      { id: 'manufacturing', name: 'Manufacturing', parent: 'industrial' },
      { id: 'automotive', name: 'Automotive', parent: 'industrial' },
      { id: 'aerospace', name: 'Aerospace', parent: 'industrial' },
      { id: 'commercial', name: 'Commercial', parent: null },
      { id: 'educational', name: 'Educational', parent: null },
      { id: 'prototyping', name: 'Prototyping', parent: null }
    ];
    
    for (const category of categories) {
      this.categoryTree.set(category.id, {
        id: category.id,
        name: category.name,
        parent: category.parent,
        children: []
      });
    }
    
    // Build parent-child relationships
    for (const category of categories) {
      if (category.parent) {
        const parent = this.categoryTree.get(category.parent);
        if (parent) {
          parent.children.push(category.id);
        }
      }
    }
  }
}

/**
 * Category Tree Node
 */
interface CategoryNode {
  id: string;
  name: string;
  parent: string | null;
  children: string[];
}

/**
 * Asset Metadata API
 */
export class AssetMetadataAPI {
  private metadataManager: AssetMetadataManager;

  constructor() {
    this.metadataManager = AssetMetadataManager.getInstance();
  }

  /**
   * Generate metadata for uploaded asset
   */
  public async generateAssetMetadata(
    asset: LibraryAsset,
    file: File,
    user: User
  ): Promise<AssetMetadata> {
    return await this.metadataManager.generateMetadata(asset, file, user);
  }

  /**
   * Update asset metadata
   */
  public async updateAssetMetadata(
    assetId: string,
    updates: Partial<AssetMetadata>
  ): Promise<AssetMetadata> {
    return await this.metadataManager.updateMetadata(assetId, updates);
  }

  /**
   * Get asset metadata
   */
  public getAssetMetadata(assetId: string): AssetMetadata | null {
    return this.metadataManager.getMetadata(assetId);
  }

  /**
   * Search assets by metadata
   */
  public async searchAssetsByMetadata(query: any): Promise<string[]> {
    return await this.metadataManager.searchByMetadata(query);
  }

  /**
   * Get asset analytics
   */
  public getAssetAnalytics(assetId: string): AssetMetadata['analytics'] | null {
    return this.metadataManager.getAnalytics(assetId);
  }

  /**
   * Update asset analytics
   */
  public async updateAssetAnalytics(
    assetId: string,
    event: 'view' | 'download' | 'use' | 'rate',
    data?: any
  ): Promise<void> {
    return await this.metadataManager.updateAnalytics(assetId, event, data);
  }

  /**
   * Get related assets
   */
  public async getRelatedAssets(assetId: string, limit?: number): Promise<string[]> {
    return await this.metadataManager.getRelatedAssets(assetId, limit);
  }

  /**
   * Get category suggestions
   */
  public getCategorySuggestions(asset: LibraryAsset): string[] {
    return this.metadataManager.getCategorySuggestions(asset);
  }
}
