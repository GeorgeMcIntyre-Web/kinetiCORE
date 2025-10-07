/**
 * Asset Library Manager
 * Owner: George
 *
 * Central manager for loading, searching, and filtering assets from the library
 */

import type {
  LibraryAsset,
  LibraryManifest,
  LibraryFilters,
  SearchResult,
  AssetInsertionConfig,
} from './types';

/**
 * Singleton manager for asset library operations
 */
export class AssetLibraryManager {
  private static instance: AssetLibraryManager;
  private manifest: LibraryManifest | null = null;
  private allAssets: LibraryAsset[] = [];
  private favorites: Set<string> = new Set();
  private recentAssets: string[] = []; // Asset IDs in order of recent use
  private readonly MAX_RECENT = 20;

  private constructor() {
    this.loadFavoritesFromStorage();
    this.loadRecentFromStorage();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AssetLibraryManager {
    if (!AssetLibraryManager.instance) {
      AssetLibraryManager.instance = new AssetLibraryManager();
    }
    return AssetLibraryManager.instance;
  }

  /**
   * Initialize library by loading manifest
   */
  public async initialize(manifestPath = '/library/manifest.json'): Promise<void> {
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.statusText}`);
      }
      this.manifest = await response.json();
      await this.loadAllAssets();
    } catch (error) {
      console.error('Failed to initialize asset library:', error);
      throw error;
    }
  }

  /**
   * Load all assets from domain manifests
   */
  private async loadAllAssets(): Promise<void> {
    if (!this.manifest) {
      throw new Error('Manifest not loaded');
    }

    const assetPromises = this.manifest.domains.map(async (domainInfo) => {
      try {
        const response = await fetch(`/library/${domainInfo.manifestPath}`);
        if (!response.ok) return [];
        const domainManifest = await response.json();
        return domainManifest.assets || [];
      } catch (error) {
        console.warn(`Failed to load domain ${domainInfo.id}:`, error);
        return [];
      }
    });

    const assetsArrays = await Promise.all(assetPromises);
    this.allAssets = assetsArrays.flat();

    // Update favorite and recent status
    this.allAssets.forEach((asset) => {
      asset.isFavorite = this.favorites.has(asset.id);
      const recentIndex = this.recentAssets.indexOf(asset.id);
      if (recentIndex !== -1) {
        asset.lastUsed = new Date(Date.now() - recentIndex * 60000); // Approximate
      }
    });
  }

  /**
   * Search assets with filters
   */
  public search(filters: LibraryFilters = {}): SearchResult[] {
    let results = [...this.allAssets];

    // Domain filter
    if (filters.domains && filters.domains.length > 0) {
      results = results.filter((asset) => filters.domains!.includes(asset.domain));
    }

    // Asset class filter
    if (filters.assetClasses && filters.assetClasses.length > 0) {
      results = results.filter((asset) =>
        filters.assetClasses!.includes(asset.assetClass)
      );
    }

    // Asset type filter
    if (filters.assetTypes && filters.assetTypes.length > 0) {
      results = results.filter((asset) =>
        filters.assetTypes!.includes(asset.assetType)
      );
    }

    // Manufacturer filter
    if (filters.manufacturers && filters.manufacturers.length > 0) {
      results = results.filter((asset) =>
        asset.manufacturer && filters.manufacturers!.includes(asset.manufacturer)
      );
    }

    // Tags filter (OR logic within tags)
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter((asset) =>
        filters.tags!.some((tag) => asset.tags.includes(tag))
      );
    }

    // Has kinematics filter
    if (filters.hasKinematics !== undefined) {
      results = results.filter(
        (asset) => asset.capabilities?.hasKinematics === filters.hasKinematics
      );
    }

    // DOF range filter
    if (filters.dofRange) {
      const [min, max] = filters.dofRange;
      results = results.filter((asset) => {
        const dof = asset.capabilities?.dof;
        return dof !== undefined && dof >= min && dof <= max;
      });
    }

    // Payload range filter (kg)
    if (filters.payloadRange) {
      const [min, max] = filters.payloadRange;
      results = results.filter((asset) => {
        const payload = asset.capabilities?.payload;
        return payload !== undefined && payload >= min && payload <= max;
      });
    }

    // Reach range filter (mm)
    if (filters.reachRange) {
      const [min, max] = filters.reachRange;
      results = results.filter((asset) => {
        const reach = asset.capabilities?.reach;
        return reach !== undefined && reach >= min && reach <= max;
      });
    }

    // Text search (fuzzy match on multiple fields)
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      results = results.map((asset) => {
        const score = this.calculateRelevanceScore(asset, query);
        return { asset, score, matchedFields: [] };
      })
        .filter((result) => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((result) => result.asset);
    }

    // Sorting
    if (filters.sortBy) {
      results.sort((a, b) => {
        let comparison = 0;
        switch (filters.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'manufacturer':
            comparison = (a.manufacturer || '').localeCompare(b.manufacturer || '');
            break;
          case 'usageCount':
            comparison = (a.usageCount || 0) - (b.usageCount || 0);
            break;
          case 'lastUsed':
            comparison = (a.lastUsed?.getTime() || 0) - (b.lastUsed?.getTime() || 0);
            break;
        }
        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return results.map((asset) => ({
      asset,
      score: 1.0,
      matchedFields: [],
    }));
  }

  /**
   * Calculate relevance score for search query
   */
  private calculateRelevanceScore(asset: LibraryAsset, query: string): number {
    let score = 0;

    // Exact match in name (highest weight)
    if (asset.name.toLowerCase().includes(query)) {
      score += 10;
    }

    // Match in manufacturer
    if (asset.manufacturer?.toLowerCase().includes(query)) {
      score += 5;
    }

    // Match in tags
    const tagMatches = asset.tags.filter((tag) => tag.toLowerCase().includes(query));
    score += tagMatches.length * 3;

    // Match in search keywords
    const keywordMatches = asset.searchKeywords.filter((kw) =>
      kw.toLowerCase().includes(query)
    );
    score += keywordMatches.length * 2;

    // Match in description
    if (asset.description?.toLowerCase().includes(query)) {
      score += 1;
    }

    // Match in asset type
    if (asset.assetType.toLowerCase().includes(query)) {
      score += 4;
    }

    return score;
  }

  /**
   * Get popular assets (most used)
   */
  public getPopular(limit = 20): LibraryAsset[] {
    return [...this.allAssets]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  /**
   * Get recent assets
   */
  public getRecent(limit = 20): LibraryAsset[] {
    return this.recentAssets
      .slice(0, limit)
      .map((id) => this.allAssets.find((asset) => asset.id === id))
      .filter((asset): asset is LibraryAsset => asset !== undefined);
  }

  /**
   * Get favorite assets
   */
  public getFavorites(): LibraryAsset[] {
    return this.allAssets.filter((asset) => asset.isFavorite);
  }

  /**
   * Toggle favorite status
   */
  public toggleFavorite(assetId: string): void {
    const asset = this.allAssets.find((a) => a.id === assetId);
    if (!asset) return;

    if (this.favorites.has(assetId)) {
      this.favorites.delete(assetId);
      asset.isFavorite = false;
    } else {
      this.favorites.add(assetId);
      asset.isFavorite = true;
    }

    this.saveFavoritesToStorage();
  }

  /**
   * Track asset usage
   */
  public recordUsage(assetId: string): void {
    const asset = this.allAssets.find((a) => a.id === assetId);
    if (!asset) return;

    // Update usage count
    asset.usageCount = (asset.usageCount || 0) + 1;
    asset.lastUsed = new Date();

    // Update recent list
    this.recentAssets = this.recentAssets.filter((id) => id !== assetId);
    this.recentAssets.unshift(assetId);
    this.recentAssets = this.recentAssets.slice(0, this.MAX_RECENT);

    this.saveRecentToStorage();
  }

  /**
   * Get asset by ID
   */
  public getAsset(assetId: string): LibraryAsset | undefined {
    return this.allAssets.find((asset) => asset.id === assetId);
  }

  /**
   * Get all assets
   */
  public getAllAssets(): LibraryAsset[] {
    return [...this.allAssets];
  }

  /**
   * Get unique manufacturers
   */
  public getManufacturers(): string[] {
    const manufacturers = new Set<string>();
    this.allAssets.forEach((asset) => {
      if (asset.manufacturer) {
        manufacturers.add(asset.manufacturer);
      }
    });
    return Array.from(manufacturers).sort();
  }

  /**
   * Get unique tags
   */
  public getTags(): string[] {
    const tags = new Set<string>();
    this.allAssets.forEach((asset) => {
      asset.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  /**
   * Get asset count by domain
   */
  public getAssetCountByDomain(domain: string): number {
    return this.allAssets.filter((asset) => asset.domain === domain).length;
  }

  /**
   * Get asset count by class
   */
  public getAssetCountByClass(assetClass: string): number {
    return this.allAssets.filter((asset) => asset.assetClass === assetClass).length;
  }

  /**
   * Save favorites to localStorage (in-memory fallback for artifacts)
   */
  private saveFavoritesToStorage(): void {
    try {
      const favArray = Array.from(this.favorites);
      localStorage.setItem('kineticore_library_favorites', JSON.stringify(favArray));
    } catch (error) {
      // localStorage not available (Claude artifacts), keep in memory only
    }
  }

  /**
   * Load favorites from localStorage
   */
  private loadFavoritesFromStorage(): void {
    try {
      const stored = localStorage.getItem('kineticore_library_favorites');
      if (stored) {
        const favArray = JSON.parse(stored);
        this.favorites = new Set(favArray);
      }
    } catch (error) {
      // localStorage not available, start with empty set
    }
  }

  /**
   * Save recent to localStorage
   */
  private saveRecentToStorage(): void {
    try {
      localStorage.setItem('kineticore_library_recent', JSON.stringify(this.recentAssets));
    } catch (error) {
      // localStorage not available, keep in memory only
    }
  }

  /**
   * Load recent from localStorage
   */
  private loadRecentFromStorage(): void {
    try {
      const stored = localStorage.getItem('kineticore_library_recent');
      if (stored) {
        this.recentAssets = JSON.parse(stored);
      }
    } catch (error) {
      // localStorage not available, start with empty array
    }
  }

  /**
   * Clear all data (for testing)
   */
  public reset(): void {
    this.manifest = null;
    this.allAssets = [];
    this.favorites.clear();
    this.recentAssets = [];
  }
}
