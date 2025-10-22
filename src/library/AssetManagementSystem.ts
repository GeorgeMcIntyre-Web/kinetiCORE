/**
 * Asset Management System Integration
 * Owner: George
 * 
 * Main integration point for all asset management systems
 */

import { UserAwareAssetManager } from './UserAwareAssetManager';
import { AssetMetadataManager } from './AssetMetadataManager';
import { AssetVersionManager } from './AssetVersionManager';
import { AdvancedSearchManager } from './AdvancedSearchManager';
import { AssetCollaborationManager } from './AssetCollaborationManager';
import { CDNCacheManager } from './CDNCacheManager';
import type { LibraryAsset } from './types';
import type { User } from '../auth/UserStore';
import type { AssetMetadata } from './AssetMetadataManager';
import type { AssetVersion } from './AssetVersionManager';
import type { SearchQuery, SearchResult } from './AdvancedSearchManager';
import type { AssetShareRequest, AssetComment } from './AssetCollaborationManager';
import type { CacheEntry, CDNAnalytics } from './CDNCacheManager';

/**
 * Main Asset Management System
 */
export class AssetManagementSystem {
  private static instance: AssetManagementSystem | null = null;
  
  // Core managers
  private assetManager: UserAwareAssetManager;
  private metadataManager: AssetMetadataManager;
  private versionManager: AssetVersionManager;
  private searchManager: AdvancedSearchManager;
  private collaborationManager: AssetCollaborationManager;
  private cdnManager: CDNCacheManager;
  
  // State
  private isInitialized: boolean = false;
  private currentUser: User | null = null;

  private constructor() {
    this.assetManager = UserAwareAssetManager.getInstance();
    this.metadataManager = AssetMetadataManager.getInstance();
    this.versionManager = AssetVersionManager.getInstance();
    this.searchManager = AdvancedSearchManager.getInstance();
    this.collaborationManager = AssetCollaborationManager.getInstance();
    this.cdnManager = CDNCacheManager.getInstance();
  }

  public static getInstance(): AssetManagementSystem {
    if (!AssetManagementSystem.instance) {
      AssetManagementSystem.instance = new AssetManagementSystem();
    }
    return AssetManagementSystem.instance;
  }

  /**
   * Initialize the complete asset management system
   */
  public async initialize(user: User, cdnConfig?: any): Promise<void> {
    if (this.isInitialized) {
      console.warn('[AssetManagementSystem] Already initialized');
      return;
    }

    this.currentUser = user;

    try {
      // Initialize core asset manager
      await this.assetManager.initialize(user);
      console.log('[AssetManagementSystem] Asset manager initialized');

      // Initialize CDN and caching
      await this.cdnManager.initialize(cdnConfig);
      console.log('[AssetManagementSystem] CDN manager initialized');

      this.isInitialized = true;
      console.log('[AssetManagementSystem] System fully initialized');
    } catch (error) {
      console.error('[AssetManagementSystem] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Upload and process new asset
   */
  public async uploadAsset(
    file: File,
    assetData: Partial<LibraryAsset>,
    options: {
      generateMetadata?: boolean;
      createVersion?: boolean;
      cacheInCDN?: boolean;
      shareWithUsers?: string[];
      sharePermission?: 'view' | 'edit' | 'admin';
    } = {}
  ): Promise<{
    asset: LibraryAsset;
    metadata: AssetMetadata;
    version: AssetVersion;
    cacheEntry: CacheEntry;
    shareRequests?: AssetShareRequest[];
  }> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    // Create base asset
    const asset: LibraryAsset = {
      id: this.generateAssetId(),
      name: assetData.name || file.name,
      domain: assetData.domain || 'general',
      assetClass: assetData.assetClass || 'structures',
      assetType: assetData.assetType || 'generic',
      loaderType: this.determineLoaderType(file.name),
      filePath: '', // Will be set by storage manager
      fileSize: Math.round(file.size / (1024 * 1024)), // Convert to MB
      tags: assetData.tags || [],
      searchKeywords: assetData.searchKeywords || [file.name],
      description: assetData.description || `Uploaded by ${this.currentUser.name}`,
      source: 'local',
      usageCount: 0,
      lastUsed: new Date(),
      isFavorite: false,
      customMetadata: {
        ownership: {
          ownerId: this.currentUser.id,
          ownerType: 'user',
          createdAt: new Date(),
          permissions: {
            public: false,
            teamShare: true,
            organizationShare: this.currentUser.organizationId ? true : false,
            allowDownload: true,
            allowModify: true
          },
          visibility: this.currentUser.preferences.defaultAssetVisibility,
          sharingSettings: {
            allowDownload: true,
            allowModify: true,
            allowShare: true
          },
          accessHistory: [],
          collaborators: []
        }
      }
    };

    // Generate metadata
    const metadata = options.generateMetadata !== false
      ? await this.metadataManager.generateMetadata(asset, file, this.currentUser)
      : null;

    // Save asset
    const assetId = await this.assetManager.saveAsset(
      asset,
      asset.customMetadata!.ownership,
      undefined, // thumbnail
      undefined  // mesh data
    );

    // Create initial version
    const version = options.createVersion !== false
      ? await this.versionManager.createInitialVersion(asset, file, this.currentUser, metadata!)
      : null;

    // Cache in CDN
    const cacheEntry = options.cacheInCDN !== false
      ? await this.cdnManager.cacheAsset(asset, file, this.currentUser, metadata!)
      : null;

    // Share with users if requested
    let shareRequests: AssetShareRequest[] | undefined;
    if (options.shareWithUsers && options.shareWithUsers.length > 0) {
      shareRequests = await this.collaborationManager.shareAsset(
        assetId,
        options.shareWithUsers,
        options.sharePermission || 'view',
        {
          message: `Shared by ${this.currentUser.name}`,
          allowDownload: true,
          allowModification: options.sharePermission === 'edit'
        },
        this.currentUser
      );
    }

    return {
      asset: { ...asset, id: assetId },
      metadata: metadata!,
      version: version!,
      cacheEntry: cacheEntry!,
      shareRequests
    };
  }

  /**
   * Search assets with full system integration
   */
  public async searchAssets(
    query: string,
    filters: any = {},
    options: {
      includeMetadata?: boolean;
      includeRelated?: boolean;
      preloadResults?: boolean;
    } = {}
  ): Promise<{
    results: SearchResult[];
    facets: any[];
    suggestions: any[];
    analytics: any;
  }> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    // Get user assets
    const userAssets = await this.assetManager.getUserAssets({
      ownership: filters.ownership || 'all',
      assetTypes: filters.assetTypes || [],
      tags: filters.tags || [],
      searchQuery: query
    });

    // Get metadata for assets
    const metadataMap = new Map<string, AssetMetadata>();
    for (const asset of userAssets) {
      const metadata = this.metadataManager.getMetadata(asset.id);
      if (metadata) {
        metadataMap.set(asset.id, metadata);
      }
    }

    // Perform advanced search
    const searchQuery: SearchQuery = {
      query,
      filters: {
        ownership: filters.ownership || 'all',
        assetTypes: filters.assetTypes || [],
        domains: filters.domains || [],
        categories: filters.categories || [],
        manufacturers: filters.manufacturers || [],
        capabilities: filters.capabilities || [],
        complexity: filters.complexity || [],
        fileTypes: filters.fileTypes || [],
        qualityScore: filters.qualityScore || { min: 0, max: 100 },
        rating: filters.rating || { min: 0, max: 5 },
        validationStatus: filters.validationStatus || [],
        usageCount: filters.usageCount || { min: 0, max: 1000 },
        popularityScore: filters.popularityScore || { min: 0, max: 100 },
        trendingScore: filters.trendingScore || { min: 0, max: 100 },
        fileSize: filters.fileSize || { min: 0, max: 1000000000 },
        uploadDate: filters.uploadDate || { from: new Date(0), to: new Date() },
        lastUsed: filters.lastUsed || { from: new Date(0), to: new Date() },
        tags: filters.tags || [],
        keywords: filters.keywords || [],
        relatedTo: filters.relatedTo || [],
        compatibleWith: filters.compatibleWith || [],
        dependencies: filters.dependencies || []
      },
      context: {
        userId: this.currentUser.id,
        userRole: this.currentUser.role.name,
        userPreferences: this.currentUser.preferences,
        currentProject: undefined,
        projectType: undefined,
        sessionId: this.generateSessionId(),
        searchHistory: [],
        recentSearches: [],
        timezone: this.currentUser.preferences.timezone,
        language: this.currentUser.preferences.language
      },
      sorting: {
        field: filters.sortField || 'relevance',
        order: filters.sortOrder || 'desc'
      },
      pagination: {
        page: filters.page || 0,
        limit: filters.limit || 20
      },
      options: {
        fuzzySearch: true,
        semanticSearch: true,
        includeSynonyms: true,
        caseSensitive: false,
        includeMetadata: options.includeMetadata !== false,
        includeAnalytics: true,
        includeRelated: options.includeRelated !== false,
        maxRelated: 5,
        cacheResults: true,
        cacheTimeout: 300,
        maxResults: 1000
      }
    };

    const searchResults = await this.searchManager.search(searchQuery, userAssets, metadataMap);

    // Preload results if requested
    if (options.preloadResults) {
      const assetIds = searchResults.results.map(r => r.asset.id);
      await this.cdnManager.preloadAssets(assetIds, this.currentUser, 'medium');
    }

    return searchResults;
  }

  /**
   * Get asset with full context
   */
  public async getAsset(
    assetId: string,
    options: {
      includeMetadata?: boolean;
      includeVersions?: boolean;
      includeComments?: boolean;
      includeCollaboration?: boolean;
      cacheFromCDN?: boolean;
    } = {}
  ): Promise<{
    asset: LibraryAsset;
    metadata?: AssetMetadata;
    versions?: AssetVersion[];
    comments?: AssetComment[];
    collaboration?: any;
    cacheEntry?: CacheEntry;
  }> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    // Get asset
    const asset = await this.assetManager.getAsset(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const result: any = { asset };

    // Get metadata
    if (options.includeMetadata !== false) {
      result.metadata = this.metadataManager.getMetadata(assetId);
    }

    // Get versions
    if (options.includeVersions !== false) {
      result.versions = this.versionManager.getAssetVersions(assetId);
    }

    // Get comments
    if (options.includeComments !== false) {
      result.comments = this.collaborationManager.getAssetComments(assetId);
    }

    // Get collaboration info
    if (options.includeCollaboration !== false) {
      result.collaboration = this.collaborationManager.getCollaboration(assetId);
    }

    // Get from CDN cache
    if (options.cacheFromCDN !== false) {
      result.cacheEntry = await this.cdnManager.getCachedAsset(assetId, this.currentUser);
    }

    // Update analytics
    if (result.metadata) {
      await this.metadataManager.updateAnalytics(assetId, 'view');
    }

    return result;
  }

  /**
   * Update asset
   */
  public async updateAsset(
    assetId: string,
    updates: Partial<LibraryAsset>,
    file?: File,
    options: {
      createVersion?: boolean;
      versionDescription?: string;
      invalidateCache?: boolean;
    } = {}
  ): Promise<{
    asset: LibraryAsset;
    metadata?: AssetMetadata;
    version?: AssetVersion;
  }> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    // Get current asset
    const currentAsset = await this.assetManager.getAsset(assetId);
    if (!currentAsset) {
      throw new Error('Asset not found');
    }

    // Update asset
    const updatedAsset = { ...currentAsset, ...updates };
    
    // Update metadata if provided
    let updatedMetadata: AssetMetadata | undefined;
    if (file) {
      updatedMetadata = await this.metadataManager.generateMetadata(updatedAsset, file, this.currentUser);
    }

    // Create new version if requested
    let newVersion: AssetVersion | undefined;
    if (options.createVersion !== false) {
      const changes = this.generateChangeList(currentAsset, updatedAsset);
      newVersion = await this.versionManager.createVersion(
        assetId,
        {
          name: updatedAsset.name,
          description: options.versionDescription || 'Asset updated',
          changes: changes.map(change => ({
            type: change.type,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            description: change.description,
            impact: change.impact,
            affectedComponents: change.affectedComponents
          }))
        },
        this.currentUser,
        file
      );
    }

    // Invalidate cache if requested
    if (options.invalidateCache !== false) {
      await this.cdnManager.invalidateCache(assetId);
    }

    return {
      asset: updatedAsset,
      metadata: updatedMetadata,
      version: newVersion
    };
  }

  /**
   * Share asset with users
   */
  public async shareAsset(
    assetId: string,
    targetUsers: string[],
    permission: 'view' | 'edit' | 'admin',
    options: {
      message?: string;
      expiresAt?: Date;
      requireApproval?: boolean;
    } = {}
  ): Promise<AssetShareRequest[]> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    return await this.collaborationManager.shareAsset(
      assetId,
      targetUsers,
      permission,
      {
        message: options.message,
        expiresAt: options.expiresAt,
        requireApproval: options.requireApproval,
        allowDownload: true,
        allowModification: permission !== 'view'
      },
      this.currentUser
    );
  }

  /**
   * Add comment to asset
   */
  public async addComment(
    assetId: string,
    content: string,
    type: 'comment' | 'suggestion' | 'question' | 'issue' = 'comment',
    mentions: string[] = []
  ): Promise<AssetComment> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    return await this.collaborationManager.addComment(
      assetId,
      {
        assetId,
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        content,
        type,
        status: 'active',
        mentions,
        attachments: []
      },
      this.currentUser
    );
  }

  /**
   * Get system analytics
   */
  public async getSystemAnalytics(timeRange?: { from: Date; to: Date }): Promise<{
    assetStats: any;
    userStats: any;
    cdnStats: CDNAnalytics;
    searchStats: any;
    collaborationStats: any;
  }> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    // Get user asset stats
    const userAssetStats = await this.assetManager.getUserAssetStats();

    // Get CDN analytics
    const cdnStats = this.cdnManager.getCDNAnalytics(timeRange);

    // Get search analytics
    const searchStats = this.searchManager.getSearchAnalytics(this.currentUser.id, timeRange);

    // Get collaboration stats
    const collaborationStats = {
      shareRequests: this.collaborationManager.getShareRequests(this.currentUser.id),
      notifications: this.collaborationManager.getUserNotifications(this.currentUser.id)
    };

    return {
      assetStats: userAssetStats,
      userStats: {
        totalAssets: userAssetStats.totalAssets,
        totalSize: userAssetStats.totalSize,
        sharedAssets: userAssetStats.sharedAssets,
        publicAssets: userAssetStats.publicAssets
      },
      cdnStats,
      searchStats,
      collaborationStats
    };
  }

  /**
   * Private helper methods
   */
  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineLoaderType(filename: string): any {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'urdf': return 'urdf';
      case 'glb': return 'glb';
      case 'gltf': return 'gltf';
      case 'stl': return 'stl';
      case 'obj': return 'obj';
      case 'dwg': return 'dwg';
      case 'jt': return 'jt';
      default: return 'primitive';
    }
  }

  private generateChangeList(oldAsset: LibraryAsset, newAsset: LibraryAsset): any[] {
    const changes: any[] = [];

    if (oldAsset.name !== newAsset.name) {
      changes.push({
        type: 'modified',
        field: 'name',
        oldValue: oldAsset.name,
        newValue: newAsset.name,
        description: `Name changed from "${oldAsset.name}" to "${newAsset.name}"`,
        impact: 'low',
        affectedComponents: ['metadata']
      });
    }

    if (oldAsset.description !== newAsset.description) {
      changes.push({
        type: 'modified',
        field: 'description',
        oldValue: oldAsset.description,
        newValue: newAsset.description,
        description: 'Description updated',
        impact: 'low',
        affectedComponents: ['metadata']
      });
    }

    if (JSON.stringify(oldAsset.tags) !== JSON.stringify(newAsset.tags)) {
      changes.push({
        type: 'modified',
        field: 'tags',
        oldValue: oldAsset.tags,
        newValue: newAsset.tags,
        description: 'Tags updated',
        impact: 'low',
        affectedComponents: ['metadata']
      });
    }

    return changes;
  }
}

/**
 * Asset Management API
 */
export class AssetManagementAPI {
  private system: AssetManagementSystem;

  constructor() {
    this.system = AssetManagementSystem.getInstance();
  }

  /**
   * Initialize system
   */
  public async initialize(user: User, cdnConfig?: any) {
    return await this.system.initialize(user, cdnConfig);
  }

  /**
   * Upload asset
   */
  public async uploadAsset(file: File, assetData: any, options?: any) {
    return await this.system.uploadAsset(file, assetData, options);
  }

  /**
   * Search assets
   */
  public async searchAssets(query: string, filters?: any, options?: any) {
    return await this.system.searchAssets(query, filters, options);
  }

  /**
   * Get asset
   */
  public async getAsset(assetId: string, options?: any) {
    return await this.system.getAsset(assetId, options);
  }

  /**
   * Update asset
   */
  public async updateAsset(assetId: string, updates: any, file?: File, options?: any) {
    return await this.system.updateAsset(assetId, updates, file, options);
  }

  /**
   * Share asset
   */
  public async shareAsset(assetId: string, targetUsers: string[], permission: any, options?: any) {
    return await this.system.shareAsset(assetId, targetUsers, permission, options);
  }

  /**
   * Add comment
   */
  public async addComment(assetId: string, content: string, type?: any, mentions?: string[]) {
    return await this.system.addComment(assetId, content, type, mentions);
  }

  /**
   * Get system analytics
   */
  public async getSystemAnalytics(timeRange?: any) {
    return await this.system.getSystemAnalytics(timeRange);
  }
}

// Export the main API instance
export const assetManagementAPI = new AssetManagementAPI();
