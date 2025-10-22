/**
 * User-Aware Asset Storage Manager
 * Owner: George
 * 
 * Multi-tier asset storage with user-based access control,
 * intelligent caching, and future-proof architecture
 */

import type { 
  User, 
  UserRole, 
  AssetPermission, 
  EnhancedAssetOwnership,
  AssetStorageInfo,
  SmartSearchQuery,
  SearchResult,
  AssetAnalytics,
  AssetVersion,
  AssetShareRequest,
  AssetLibraryConfig,
  StorageTierConfig,
  CacheStrategy
} from './UserAwareAssetTypes';
import type { LibraryAsset } from './types';
import { AssetDatabase } from './AssetDatabase';

/**
 * Multi-tier storage manager with user awareness
 */
export class UserAwareAssetManager {
  private static instance: UserAwareAssetManager | null = null;
  private localDatabase: AssetDatabase;
  private currentUser: User | null = null;
  private storageConfig: StorageTierConfig;
  private cacheStrategy: CacheStrategy;
  private analytics: Map<string, AssetAnalytics> = new Map();

  private constructor() {
    this.localDatabase = AssetDatabase.getInstance();
    this.storageConfig = this.getDefaultStorageConfig();
    this.cacheStrategy = this.getDefaultCacheStrategy();
  }

  public static getInstance(): UserAwareAssetManager {
    if (!UserAwareAssetManager.instance) {
      UserAwareAssetManager.instance = new UserAwareAssetManager();
    }
    return UserAwareAssetManager.instance;
  }

  /**
   * Initialize the asset manager with user context
   */
  public async initialize(user: User): Promise<void> {
    this.currentUser = user;
    await this.localDatabase.initialize();
    
    // Initialize storage tiers based on user role
    await this.initializeStorageTiers();
    
    // Start background tasks
    this.startBackgroundTasks();
    
    console.log(`[UserAwareAssetManager] Initialized for user: ${user.email}`);
  }

  /**
   * Save asset with user ownership and multi-tier storage
   */
  public async saveAsset(
    asset: LibraryAsset,
    ownership: EnhancedAssetOwnership,
    thumbnailData?: string,
    meshData?: string
  ): Promise<string> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    // Validate user permissions
    this.validateAssetPermissions(asset, ownership, 'write');

    // Generate unique asset ID
    const assetId = this.generateAssetId();

    // Update asset with ownership metadata
    const enhancedAsset: LibraryAsset = {
      ...asset,
      id: assetId,
      customMetadata: {
        ...asset.customMetadata,
        ownership,
        storageInfo: await this.determineStorageStrategy(asset, ownership)
      }
    };

    // Save to appropriate storage tiers
    const storageInfo = await this.saveToStorageTiers(
      enhancedAsset,
      ownership,
      thumbnailData,
      meshData
    );

    // Update analytics
    await this.updateAssetAnalytics(assetId, 'created');

    console.log(`[UserAwareAssetManager] Saved asset: ${asset.name} (${assetId})`);
    return assetId;
  }

  /**
   * Get assets visible to current user
   */
  public async getUserAssets(filters?: {
    ownership?: 'own' | 'shared' | 'public' | 'all';
    assetTypes?: string[];
    tags?: string[];
    searchQuery?: string;
  }): Promise<LibraryAsset[]> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    const searchQuery: SmartSearchQuery = {
      query: filters?.searchQuery || '',
      userId: this.currentUser.id,
      filters: {
        ownership: filters?.ownership || 'all',
        assetTypes: filters?.assetTypes || [],
        capabilities: {},
        tags: filters?.tags || [],
        manufacturers: []
      },
      context: {
        currentProject: undefined,
        userPreferences: this.currentUser.preferences
      },
      sorting: {
        field: 'lastUsed',
        order: 'desc'
      },
      pagination: {
        page: 0,
        limit: 100
      }
    };

    return await this.searchAssets(searchQuery);
  }

  /**
   * Smart asset search with user context
   */
  public async searchAssets(query: SmartSearchQuery): Promise<LibraryAsset[]> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    const results: SearchResult[] = [];

    // Search local cache first
    const localResults = await this.searchLocalCache(query);
    results.push(...localResults);

    // Search user storage if needed
    if (query.filters.ownership === 'own' || query.filters.ownership === 'all') {
      const userResults = await this.searchUserStorage(query);
      results.push(...userResults);
    }

    // Search shared storage if user has access
    if (this.hasSharedStorageAccess() && 
        (query.filters.ownership === 'shared' || query.filters.ownership === 'public' || query.filters.ownership === 'all')) {
      const sharedResults = await this.searchSharedStorage(query);
      results.push(...sharedResults);
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = this.deduplicateResults(results);
    const sortedResults = this.sortByRelevance(uniqueResults, query);

    // Update analytics for searched assets
    for (const result of sortedResults.slice(0, 10)) {
      await this.updateAssetAnalytics(result.asset.id, 'view');
    }

    return sortedResults.map(result => result.asset);
  }

  /**
   * Share asset with other users
   */
  public async shareAsset(
    assetId: string,
    targetUsers: string[],
    permission: 'view' | 'edit' | 'admin',
    message?: string
  ): Promise<AssetShareRequest[]> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const ownership = asset.customMetadata?.ownership as EnhancedAssetOwnership;
    if (!ownership || ownership.ownerId !== this.currentUser.id) {
      throw new Error('Insufficient permissions to share asset');
    }

    const shareRequests: AssetShareRequest[] = [];

    for (const targetUserId of targetUsers) {
      const shareRequest: AssetShareRequest = {
        requestId: this.generateAssetId(),
        assetId,
        requestedBy: this.currentUser.id,
        requestedFrom: targetUserId,
        permission,
        message,
        status: 'pending',
        createdAt: new Date()
      };

      shareRequests.push(shareRequest);
      
      // Add to asset collaborators
      ownership.collaborators.push({
        userId: targetUserId,
        permission,
        addedAt: new Date(),
        addedBy: this.currentUser.id
      });
    }

    // Update asset ownership
    await this.updateAssetOwnership(assetId, ownership);

    // Send notifications (placeholder for future implementation)
    await this.sendShareNotifications(shareRequests);

    return shareRequests;
  }

  /**
   * Get asset with access control
   */
  public async getAsset(assetId: string): Promise<LibraryAsset | null> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    // Try local cache first
    let asset = await this.getFromLocalCache(assetId);
    
    if (!asset) {
      // Try user storage
      asset = await this.getFromUserStorage(assetId);
    }

    if (!asset) {
      // Try shared storage
      asset = await this.getFromSharedStorage(assetId);
    }

    if (!asset) {
      return null;
    }

    // Check access permissions
    const ownership = asset.customMetadata?.ownership as EnhancedAssetOwnership;
    if (!this.hasAssetAccess(asset, ownership)) {
      throw new Error('Access denied');
    }

    // Update usage analytics
    await this.updateAssetAnalytics(assetId, 'view');

    return asset;
  }

  /**
   * Create asset version
   */
  public async createAssetVersion(
    assetId: string,
    changes: string[],
    description: string
  ): Promise<AssetVersion> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const ownership = asset.customMetadata?.ownership as EnhancedAssetOwnership;
    if (!this.hasAssetAccess(asset, ownership, 'edit')) {
      throw new Error('Insufficient permissions to create version');
    }

    const version: AssetVersion = {
      versionId: this.generateAssetId(),
      assetId,
      versionNumber: await this.getNextVersionNumber(assetId),
      changes: changes.map(change => ({
        type: 'modified',
        field: 'content',
        description: change,
        impact: 'medium'
      })),
      createdBy: this.currentUser.id,
      createdAt: new Date(),
      description,
      isStable: false,
      downloadUrl: '', // Will be set after upload
      fileSize: 0, // Will be calculated
      checksum: '' // Will be calculated
    };

    // Save version metadata
    await this.saveAssetVersion(version);

    // Update asset analytics
    await this.updateAssetAnalytics(assetId, 'versioned');

    return version;
  }

  /**
   * Get asset analytics
   */
  public async getAssetAnalytics(assetId: string): Promise<AssetAnalytics | null> {
    return this.analytics.get(assetId) || null;
  }

  /**
   * Get user's asset library statistics
   */
  public async getUserAssetStats(): Promise<{
    totalAssets: number;
    totalSize: number;
    sharedAssets: number;
    publicAssets: number;
    recentActivity: any[];
  }> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    const userAssets = await this.getUserAssets();
    const totalSize = userAssets.reduce((sum, asset) => sum + (asset.fileSize || 0), 0);
    
    const sharedAssets = userAssets.filter(asset => {
      const ownership = asset.customMetadata?.ownership as EnhancedAssetOwnership;
      return ownership?.visibility === 'team' || ownership?.visibility === 'organization';
    }).length;

    const publicAssets = userAssets.filter(asset => {
      const ownership = asset.customMetadata?.ownership as EnhancedAssetOwnership;
      return ownership?.visibility === 'public';
    }).length;

    return {
      totalAssets: userAssets.length,
      totalSize,
      sharedAssets,
      publicAssets,
      recentActivity: [] // Placeholder for future implementation
    };
  }

  /**
   * Private helper methods
   */
  private async initializeStorageTiers(): Promise<void> {
    // Initialize local cache
    if (this.storageConfig.local.enabled) {
      await this.localDatabase.initialize();
    }

    // Initialize user storage (placeholder for cloud storage)
    if (this.storageConfig.user.enabled) {
      // TODO: Initialize Supabase or other cloud storage
    }

    // Initialize shared storage (placeholder for enterprise storage)
    if (this.storageConfig.shared.enabled) {
      // TODO: Initialize Cloudflare R2 or other shared storage
    }
  }

  private startBackgroundTasks(): void {
    // Cache cleanup task
    setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Analytics aggregation task
    setInterval(() => {
      this.aggregateAnalytics();
    }, 60 * 60 * 1000); // Every hour
  }

  private validateAssetPermissions(
    asset: LibraryAsset,
    ownership: EnhancedAssetOwnership,
    action: 'read' | 'write' | 'delete'
  ): void {
    if (!this.currentUser) return;

    const userRole = this.currentUser.role;
    const hasPermission = userRole.permissions.some(permission => 
      permission.action === action && 
      (permission.scope === 'own' || 
       permission.scope === 'team' || 
       permission.scope === 'organization' || 
       permission.scope === 'public')
    );

    if (!hasPermission) {
      throw new Error(`Insufficient permissions for ${action} action`);
    }
  }

  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async determineStorageStrategy(
    asset: LibraryAsset,
    ownership: EnhancedAssetOwnership
  ): Promise<AssetStorageInfo> {
    const storageInfo: AssetStorageInfo = {
      assetId: asset.id,
      tiers: {},
      accessCount: 0,
      lastAccessed: new Date(),
      popularityScore: 0
    };

    // Always cache locally for performance
    if (this.storageConfig.local.enabled) {
      storageInfo.tiers.local = {
        cached: true,
        cachedAt: new Date(),
        size: asset.fileSize || 0
      };
    }

    // Store in user storage for personal assets
    if (ownership.visibility === 'private' && this.storageConfig.user.enabled) {
      storageInfo.tiers.user = {
        url: '', // Will be set after upload
        uploadedAt: new Date(),
        size: asset.fileSize || 0,
        checksum: '' // Will be calculated
      };
    }

    // Store in shared storage for team/org/public assets
    if ((ownership.visibility === 'team' || 
         ownership.visibility === 'organization' || 
         ownership.visibility === 'public') && 
        this.storageConfig.shared.enabled) {
      storageInfo.tiers.shared = {
        url: '', // Will be set after upload
        uploadedAt: new Date(),
        size: asset.fileSize || 0,
        checksum: '', // Will be calculated
        organizationId: this.currentUser?.organizationId || ''
      };
    }

    return storageInfo;
  }

  private async saveToStorageTiers(
    asset: LibraryAsset,
    ownership: EnhancedAssetOwnership,
    thumbnailData?: string,
    meshData?: string
  ): Promise<AssetStorageInfo> {
    const storageInfo = await this.determineStorageStrategy(asset, ownership);

    // Save to local cache
    if (storageInfo.tiers.local) {
      await this.localDatabase.saveAsset(asset, thumbnailData, meshData);
    }

    // Save to user storage (placeholder)
    if (storageInfo.tiers.user) {
      // TODO: Upload to Supabase Storage
    }

    // Save to shared storage (placeholder)
    if (storageInfo.tiers.shared) {
      // TODO: Upload to Cloudflare R2
    }

    return storageInfo;
  }

  private async searchLocalCache(query: SmartSearchQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    try {
      const localAssets = await this.localDatabase.searchAssets({
        searchQuery: query.query,
        tags: query.filters.tags,
        assetClass: query.filters.assetTypes,
        isFavorite: false
      });

      for (const assetEntry of localAssets) {
        const asset = assetEntry.assetData;
        if (this.hasAssetAccess(asset, asset.customMetadata?.ownership)) {
          results.push({
            asset,
            score: this.calculateRelevanceScore(asset, query),
            matchedFields: this.getMatchedFields(asset, query.query),
            accessLevel: 'full',
            storageInfo: {
              assetId: asset.id,
              tiers: {
                local: {
                  cached: true,
                  cachedAt: new Date(),
                  size: asset.fileSize || 0
                }
              },
              accessCount: assetEntry.usageCount,
              lastAccessed: assetEntry.lastUsed || new Date(),
              popularityScore: this.calculatePopularityScore(assetEntry)
            }
          });
        }
      }
    } catch (error) {
      console.warn('[UserAwareAssetManager] Local cache search failed:', error);
    }

    return results;
  }

  private async searchUserStorage(query: SmartSearchQuery): Promise<SearchResult[]> {
    // Placeholder for user storage search
    return [];
  }

  private async searchSharedStorage(query: SmartSearchQuery): Promise<SearchResult[]> {
    // Placeholder for shared storage search
    return [];
  }

  private hasSharedStorageAccess(): boolean {
    return this.currentUser?.role.permissions.some(p => 
      p.scope === 'team' || p.scope === 'organization' || p.scope === 'public'
    ) || false;
  }

  private hasAssetAccess(
    asset: LibraryAsset,
    ownership?: EnhancedAssetOwnership,
    requiredPermission: 'view' | 'edit' | 'admin' = 'view'
  ): boolean {
    if (!this.currentUser || !ownership) return false;

    // Owner has full access
    if (ownership.ownerId === this.currentUser.id) return true;

    // Check collaborator permissions
    const collaborator = ownership.collaborators.find(c => c.userId === this.currentUser!.id);
    if (collaborator) {
      const permissionLevels = { view: 1, edit: 2, admin: 3 };
      return permissionLevels[collaborator.permission] >= permissionLevels[requiredPermission];
    }

    // Check visibility permissions
    switch (ownership.visibility) {
      case 'public':
        return requiredPermission === 'view';
      case 'team':
        return this.currentUser.teamIds.includes(ownership.ownerId) && requiredPermission === 'view';
      case 'organization':
        return this.currentUser.organizationId === ownership.ownerId && requiredPermission === 'view';
      default:
        return false;
    }
  }

  private calculateRelevanceScore(asset: LibraryAsset, query: SmartSearchQuery): number {
    let score = 0;

    // Name match
    if (asset.name.toLowerCase().includes(query.query.toLowerCase())) {
      score += 0.4;
    }

    // Description match
    if (asset.description?.toLowerCase().includes(query.query.toLowerCase())) {
      score += 0.3;
    }

    // Tag match
    const tagMatches = asset.tags.filter(tag => 
      tag.toLowerCase().includes(query.query.toLowerCase())
    ).length;
    score += tagMatches * 0.1;

    // Manufacturer match
    if (asset.manufacturer?.toLowerCase().includes(query.query.toLowerCase())) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private getMatchedFields(asset: LibraryAsset, query: string): string[] {
    const fields: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (asset.name.toLowerCase().includes(lowerQuery)) fields.push('name');
    if (asset.description?.toLowerCase().includes(lowerQuery)) fields.push('description');
    if (asset.manufacturer?.toLowerCase().includes(lowerQuery)) fields.push('manufacturer');
    if (asset.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) fields.push('tags');

    return fields;
  }

  private calculatePopularityScore(assetEntry: any): number {
    const usageCount = assetEntry.usageCount || 0;
    const daysSinceLastUsed = assetEntry.lastUsed 
      ? (Date.now() - assetEntry.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
      : 365;

    // Higher usage = higher score, but decay over time
    return Math.min(usageCount / 10, 1.0) * Math.exp(-daysSinceLastUsed / 30);
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.asset.id)) {
        return false;
      }
      seen.add(result.asset.id);
      return true;
    });
  }

  private sortByRelevance(results: SearchResult[], query: SmartSearchQuery): SearchResult[] {
    return results.sort((a, b) => {
      // Primary sort by relevance score
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      // Secondary sort by query preferences
      switch (query.sorting.field) {
        case 'name':
          return query.sorting.order === 'asc' 
            ? a.asset.name.localeCompare(b.asset.name)
            : b.asset.name.localeCompare(a.asset.name);
        case 'lastUsed':
          const aTime = a.storageInfo.lastAccessed.getTime();
          const bTime = b.storageInfo.lastAccessed.getTime();
          return query.sorting.order === 'asc' ? aTime - bTime : bTime - aTime;
        case 'popularity':
          return query.sorting.order === 'asc'
            ? a.storageInfo.popularityScore - b.storageInfo.popularityScore
            : b.storageInfo.popularityScore - a.storageInfo.popularityScore;
        default:
          return 0;
      }
    });
  }

  private async updateAssetAnalytics(assetId: string, action: string): Promise<void> {
    let analytics = this.analytics.get(assetId);
    if (!analytics) {
      analytics = {
        assetId,
        usageStats: {
          totalViews: 0,
          totalDownloads: 0,
          uniqueUsers: 0,
          projectsUsed: 0,
          lastUsed: new Date(),
          averageRating: 0,
          totalRating: 0
        },
        performanceMetrics: {
          averageLoadTime: 0,
          cacheHitRate: 0,
          downloadSuccessRate: 1,
          errorRate: 0
        },
        userInsights: {
          mostActiveUsers: [],
          usagePatterns: [],
          seasonalTrends: []
        }
      };
      this.analytics.set(assetId, analytics);
    }

    // Update usage stats
    switch (action) {
      case 'view':
        analytics.usageStats.totalViews++;
        analytics.usageStats.lastUsed = new Date();
        break;
      case 'download':
        analytics.usageStats.totalDownloads++;
        break;
      case 'created':
        analytics.usageStats.projectsUsed++;
        break;
    }
  }

  private async getFromLocalCache(assetId: string): Promise<LibraryAsset | null> {
    try {
      const assetEntry = await this.localDatabase.getAsset(assetId);
      return assetEntry?.assetData || null;
    } catch (error) {
      console.warn('[UserAwareAssetManager] Local cache get failed:', error);
      return null;
    }
  }

  private async getFromUserStorage(assetId: string): Promise<LibraryAsset | null> {
    // Placeholder for user storage retrieval
    return null;
  }

  private async getFromSharedStorage(assetId: string): Promise<LibraryAsset | null> {
    // Placeholder for shared storage retrieval
    return null;
  }

  private async updateAssetOwnership(assetId: string, ownership: EnhancedAssetOwnership): Promise<void> {
    const asset = await this.getAsset(assetId);
    if (asset) {
      asset.customMetadata = {
        ...asset.customMetadata,
        ownership
      };
      await this.localDatabase.saveAsset(asset);
    }
  }

  private async sendShareNotifications(shareRequests: AssetShareRequest[]): Promise<void> {
    // Placeholder for notification system
    console.log('[UserAwareAssetManager] Share notifications sent:', shareRequests.length);
  }

  private async getNextVersionNumber(assetId: string): Promise<string> {
    // Placeholder for version number generation
    return '1.0.0';
  }

  private async saveAssetVersion(version: AssetVersion): Promise<void> {
    // Placeholder for version storage
    console.log('[UserAwareAssetManager] Version saved:', version.versionId);
  }

  private async cleanupCache(): Promise<void> {
    // Placeholder for cache cleanup
    console.log('[UserAwareAssetManager] Cache cleanup completed');
  }

  private async aggregateAnalytics(): Promise<void> {
    // Placeholder for analytics aggregation
    console.log('[UserAwareAssetManager] Analytics aggregated');
  }

  private getDefaultStorageConfig(): StorageTierConfig {
    return {
      local: {
        enabled: true,
        maxSize: 500, // 500MB
        evictionPolicy: 'lru'
      },
      user: {
        enabled: true,
        maxSize: 10000, // 10GB
        provider: 'supabase'
      },
      shared: {
        enabled: false,
        maxSize: 0,
        provider: 'cloudflare-r2'
      }
    };
  }

  private getDefaultCacheStrategy(): CacheStrategy {
    return {
      prefetchRules: {
        basedOnProject: true,
        basedOnUserHistory: true,
        basedOnTeamActivity: false
      },
      evictionRules: {
        maxAge: 24, // 24 hours
        maxSize: 500, // 500MB
        minAccessCount: 1
      },
      compressionSettings: {
        enabled: true,
        algorithm: 'gzip',
        quality: 6
      }
    };
  }
}
