/**
 * Asset API Service
 * Owner: George (Architecture)
 *
 * Client-side service for fetching assets from backend API
 * Decouples frontend from data source (local files vs cloud API)
 */

import type { LibraryAsset, LibraryFilters, AssetManifest, Domain, AssetClass } from './types';

interface AssetAPIConfig {
  baseURL: string;
  useLocalFallback: boolean;
  localManifestPath?: string;
}

export class AssetAPIService {
  private static instance: AssetAPIService;
  private config: AssetAPIConfig;
  private cache: Map<string, any> = new Map();

  private constructor(config?: Partial<AssetAPIConfig>) {
    this.config = {
      baseURL: import.meta.env.VITE_ASSET_API_URL || 'http://localhost:3001/api',
      useLocalFallback: import.meta.env.VITE_USE_LOCAL_ASSETS === 'true' || true,
      localManifestPath: '/library/manifest.json',
      ...config,
    };
  }

  public static getInstance(config?: Partial<AssetAPIConfig>): AssetAPIService {
    if (!AssetAPIService.instance) {
      AssetAPIService.instance = new AssetAPIService(config);
    }
    return AssetAPIService.instance;
  }

  /**
   * Fetch all assets with optional filtering
   */
  public async fetchAssets(filters?: LibraryFilters): Promise<LibraryAsset[]> {
    try {
      // Try API first if configured
      if (!this.config.useLocalFallback) {
        return await this.fetchFromAPI(filters);
      }

      // Fallback to local manifest
      return await this.fetchFromLocal(filters);
    } catch (error) {
      console.error('[AssetAPI] Failed to fetch assets:', error);
      throw error;
    }
  }

  /**
   * Fetch from backend API
   */
  private async fetchFromAPI(filters?: LibraryFilters): Promise<LibraryAsset[]> {
    const params = new URLSearchParams();

    if (filters?.searchQuery) {
      params.append('search', filters.searchQuery);
    }
    if (filters?.domains) {
      params.append('domains', filters.domains.join(','));
    }
    if (filters?.assetClasses) {
      params.append('classes', filters.assetClasses.join(','));
    }
    if (filters?.manufacturers) {
      params.append('manufacturers', filters.manufacturers.join(','));
    }
    if (filters?.payloadRange) {
      params.append('payloadMin', filters.payloadRange[0].toString());
      params.append('payloadMax', filters.payloadRange[1].toString());
    }
    if (filters?.reachRange) {
      params.append('reachMin', filters.reachRange[0].toString());
      params.append('reachMax', filters.reachRange[1].toString());
    }
    if (filters?.dofRange) {
      params.append('dofMin', filters.dofRange[0].toString());
      params.append('dofMax', filters.dofRange[1].toString());
    }
    if (filters?.hasKinematics !== undefined) {
      params.append('hasKinematics', filters.hasKinematics.toString());
    }
    if (filters?.sortBy) {
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder || 'asc');
    }

    const url = `${this.config.baseURL}/assets?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.assets || [];
  }

  /**
   * Fetch from local manifest.json (current implementation)
   */
  private async fetchFromLocal(filters?: LibraryFilters): Promise<LibraryAsset[]> {
    // Check cache
    const cacheKey = 'local-manifest';
    if (this.cache.has(cacheKey)) {
      const manifest = this.cache.get(cacheKey) as AssetManifest;
      return this.filterAssets(manifest.assets, filters);
    }

    // Fetch manifest
    const response = await fetch(this.config.localManifestPath!);
    if (!response.ok) {
      throw new Error(`Failed to load local manifest: ${response.statusText}`);
    }

    const manifest: AssetManifest = await response.json();
    this.cache.set(cacheKey, manifest);

    return this.filterAssets(manifest.assets, filters);
  }

  /**
   * Client-side filtering (used for local fallback)
   */
  private filterAssets(assets: LibraryAsset[], filters?: LibraryFilters): LibraryAsset[] {
    if (!filters) return assets;

    let filtered = [...assets];

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (asset) =>
          asset.name.toLowerCase().includes(query) ||
          asset.manufacturer?.toLowerCase().includes(query) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          asset.searchKeywords.some((kw) => kw.toLowerCase().includes(query))
      );
    }

    // Domain filter
    if (filters.domains && filters.domains.length > 0) {
      filtered = filtered.filter((asset) => filters.domains!.includes(asset.domain));
    }

    // Asset class filter
    if (filters.assetClasses && filters.assetClasses.length > 0) {
      filtered = filtered.filter((asset) =>
        filters.assetClasses!.includes(asset.assetClass)
      );
    }

    // Manufacturer filter
    if (filters.manufacturers && filters.manufacturers.length > 0) {
      filtered = filtered.filter(
        (asset) => asset.manufacturer && filters.manufacturers!.includes(asset.manufacturer)
      );
    }

    // Payload range
    if (filters.payloadRange) {
      filtered = filtered.filter((asset) => {
        const payload = asset.capabilities?.payload;
        if (payload === undefined) return false;
        return payload >= filters.payloadRange![0] && payload <= filters.payloadRange![1];
      });
    }

    // Reach range
    if (filters.reachRange) {
      filtered = filtered.filter((asset) => {
        const reach = asset.capabilities?.reach;
        if (reach === undefined) return false;
        return reach >= filters.reachRange![0] && reach <= filters.reachRange![1];
      });
    }

    // DOF range
    if (filters.dofRange) {
      filtered = filtered.filter((asset) => {
        const dof = asset.capabilities?.dof;
        if (dof === undefined) return false;
        return dof >= filters.dofRange![0] && dof <= filters.dofRange![1];
      });
    }

    // Has kinematics
    if (filters.hasKinematics !== undefined) {
      filtered = filtered.filter(
        (asset) => asset.capabilities?.hasKinematics === filters.hasKinematics
      );
    }

    // Sorting
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (filters.sortBy) {
          case 'name':
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case 'manufacturer':
            aVal = a.manufacturer?.toLowerCase() || '';
            bVal = b.manufacturer?.toLowerCase() || '';
            break;
          case 'usageCount':
            aVal = a.usageCount || 0;
            bVal = b.usageCount || 0;
            break;
          case 'lastUsed':
            aVal = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
            bVal = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
            break;
          default:
            return 0;
        }

        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }

  /**
   * Fetch available categories
   */
  public async fetchCategories(): Promise<{ domains: Domain[]; classes: AssetClass[] }> {
    try {
      if (!this.config.useLocalFallback) {
        const response = await fetch(`${this.config.baseURL}/categories`);
        const data = await response.json();
        return data;
      }

      // For local, extract from manifest
      const assets = await this.fetchAssets();
      const domains = Array.from(new Set(assets.map((a) => a.domain)));
      const classes = Array.from(new Set(assets.map((a) => a.assetClass)));
      return { domains, classes };
    } catch (error) {
      console.error('[AssetAPI] Failed to fetch categories:', error);
      return { domains: [], classes: [] };
    }
  }

  /**
   * Record asset usage (for popularity tracking)
   */
  public async recordUsage(assetId: string): Promise<void> {
    try {
      if (!this.config.useLocalFallback) {
        await fetch(`${this.config.baseURL}/assets/${assetId}/usage`, {
          method: 'POST',
        });
      } else {
        // For local, just log (no persistence)
        console.log(`[AssetAPI] Asset used: ${assetId}`);
      }
    } catch (error) {
      console.error('[AssetAPI] Failed to record usage:', error);
    }
  }

  /**
   * Toggle favorite status
   */
  public async toggleFavorite(assetId: string): Promise<void> {
    try {
      if (!this.config.useLocalFallback) {
        await fetch(`${this.config.baseURL}/assets/${assetId}/favorite`, {
          method: 'POST',
        });
      } else {
        // For local, use localStorage
        const favorites = this.getFavoritesFromLocalStorage();
        const index = favorites.indexOf(assetId);
        if (index > -1) {
          favorites.splice(index, 1);
        } else {
          favorites.push(assetId);
        }
        localStorage.setItem('kineticore-favorites', JSON.stringify(favorites));
      }
    } catch (error) {
      console.error('[AssetAPI] Failed to toggle favorite:', error);
    }
  }

  /**
   * Get favorites from localStorage
   */
  private getFavoritesFromLocalStorage(): string[] {
    try {
      const stored = localStorage.getItem('kineticore-favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}
