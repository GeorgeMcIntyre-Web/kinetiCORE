/**
 * Cloud Asset Loader
 * Owner: George
 *
 * Downloads and caches assets from Cloudflare CDN with IndexedDB caching,
 * progress tracking, and local fallback support.
 */

import { AssetCache } from './AssetCache';
import type {
  AssetPackageMetadata,
  AssetDownloadResponse,
  AssetLoadProgress,
  CloudAssetConfig,
  CachedAssetPackage,
} from './types';

type ProgressCallback = (progress: AssetLoadProgress) => void;

/**
 * Cloud asset loader with caching and fallback
 */
export class CloudAssetLoader {
  private cache: AssetCache;
  private config: CloudAssetConfig;
  private progressCallbacks: Set<ProgressCallback> = new Set();

  constructor(config: Partial<CloudAssetConfig> = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'https://api.kineticore.io/v1',
      cdnBaseUrl: config.cdnBaseUrl || 'https://assets.kineticore.io',
      enableCache: config.enableCache ?? true,
      maxCacheSize: config.maxCacheSize || 500 * 1024 * 1024, // 500MB
      cacheTTL: config.cacheTTL || 7 * 24 * 60 * 60 * 1000, // 7 days
      enableFallback: config.enableFallback ?? true,
    };

    this.cache = new AssetCache(this.config.maxCacheSize);
  }

  /**
   * Initialize cache
   */
  async initialize(): Promise<void> {
    if (this.config.enableCache) {
      await this.cache.initialize();
    }
  }

  /**
   * Download and cache an asset package
   */
  async downloadAsset(
    assetId: string,
    version: string = 'latest'
  ): Promise<CachedAssetPackage> {
    // 1. Check cache first
    if (this.config.enableCache) {
      const cached = await this.cache.get(assetId, version);
      if (cached && !this.isStale(cached)) {
        this.emitProgress({
          assetId,
          version,
          phase: 'complete',
          filesTotal: cached.files.size,
          filesLoaded: cached.files.size,
          bytesTotal: cached.size,
          bytesLoaded: cached.size,
          progress: 100,
          source: 'cache',
        });
        return cached;
      }
    }

    // 2. Download from cloud
    try {
      return await this.downloadFromCloud(assetId, version);
    } catch (error) {
      console.error('Cloud download failed:', error);

      // 3. Fallback to local if enabled
      if (this.config.enableFallback) {
        console.warn('Falling back to local assets');
        throw new Error('Local fallback not yet implemented');
        // TODO: Implement local asset loading
      }

      throw error;
    }
  }

  /**
   * Download asset from cloud CDN
   */
  private async downloadFromCloud(
    assetId: string,
    version: string
  ): Promise<CachedAssetPackage> {
    // Get download URLs from API
    const downloadInfo = await this.getDownloadUrls(assetId, version);

    this.emitProgress({
      assetId,
      version,
      phase: 'downloading',
      filesTotal: downloadInfo.files.length,
      filesLoaded: 0,
      bytesTotal: downloadInfo.files.reduce((sum, f) => sum + f.size, 0),
      bytesLoaded: 0,
      progress: 0,
      source: 'cloud',
    });

    // Download all files in parallel
    const filePromises = downloadInfo.files.map((fileInfo) =>
        this.downloadFile(fileInfo.url, fileInfo.path)
    );

    const fileResults = await Promise.all(filePromises);

    // Build files map
    const files = new Map<string, ArrayBuffer>();
    for (const result of fileResults) {
      files.set(result.path, result.data);
    }

    // Get metadata (should be in files as metadata.json)
    const metadataBuffer = files.get('metadata.json');
    if (!metadataBuffer) {
      throw new Error('metadata.json not found in asset package');
    }

    const metadataText = new TextDecoder().decode(metadataBuffer);
    const metadata: AssetPackageMetadata = JSON.parse(metadataText);

    const packageSize = Array.from(files.values()).reduce(
      (sum, data) => sum + data.byteLength,
      0
    );

    const cachedPackage: CachedAssetPackage = {
      assetId,
      version,
      metadata,
      files,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
      size: packageSize,
    };

    // Cache the package
    if (this.config.enableCache) {
      this.emitProgress({
        assetId,
        version,
        phase: 'caching',
        filesTotal: files.size,
        filesLoaded: files.size,
        bytesTotal: packageSize,
        bytesLoaded: packageSize,
        progress: 95,
        source: 'cloud',
      });

      await this.cache.set(assetId, version, metadata, files);
    }

    this.emitProgress({
      assetId,
      version,
      phase: 'complete',
      filesTotal: files.size,
      filesLoaded: files.size,
      bytesTotal: packageSize,
      bytesLoaded: packageSize,
      progress: 100,
      source: 'cloud',
    });

    return cachedPackage;
  }

  /**
   * Get download URLs from API
   */
  private async getDownloadUrls(
    assetId: string,
    version: string
  ): Promise<AssetDownloadResponse> {
    const url = `${this.config.apiBaseUrl}/assets/${encodeURIComponent(
      assetId
    )}/download?version=${encodeURIComponent(version)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get download URLs: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Download a single file
   */
  private async downloadFile(
    url: string,
    path: string,
//     size: number,
//     assetId: string,
//     version: string
  ): Promise<{ path: string; data: ArrayBuffer }> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download ${path}: ${response.statusText}`);
    }

    const data = await response.arrayBuffer();

    // Emit progress for this file
    // Note: This is simplified; real implementation would track per-file progress
    return { path, data };
  }

  /**
   * Get asset metadata without downloading entire package
   */
  async getMetadata(assetId: string, version: string = 'latest'): Promise<AssetPackageMetadata> {
    // Check cache first
    if (this.config.enableCache) {
      const cached = await this.cache.get(assetId, version);
      if (cached) {
        return cached.metadata;
      }
    }

    // Fetch from API
    const url = `${this.config.apiBaseUrl}/assets/${encodeURIComponent(assetId)}?version=${encodeURIComponent(version)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get metadata: ${response.statusText}`);
    }

    const data = await response.json();
    return data.metadata;
  }

  /**
   * Check if cached package is stale
   */
  private isStale(cached: CachedAssetPackage): boolean {
    const age = Date.now() - cached.cachedAt;
    return age > this.config.cacheTTL;
  }

  /**
   * Clear asset from cache
   */
  async clearCache(assetId: string, version: string): Promise<void> {
    if (this.config.enableCache) {
      await this.cache.remove(assetId, version);
    }
  }

  /**
   * Clear all cached assets
   */
  async clearAllCache(): Promise<void> {
    if (this.config.enableCache) {
      await this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; usage: number; maxSize: number } {
    return {
      size: this.cache.getCacheSize(),
      usage: this.cache.getCacheUsage(),
      maxSize: this.config.maxCacheSize,
    };
  }

  /**
   * List all cached assets
   */
  async listCached(): Promise<Array<{ assetId: string; version: string; size: number }>> {
    if (this.config.enableCache) {
      return this.cache.list();
    }
    return [];
  }

  /**
   * Subscribe to progress events
   */
  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Emit progress event to all subscribers
   */
  private emitProgress(progress: AssetLoadProgress): void {
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    }
  }

  /**
   * Prefetch an asset (download but don't return)
   */
  async prefetch(assetId: string, version: string = 'latest'): Promise<void> {
    try {
      await this.downloadAsset(assetId, version);
    } catch (error) {
      console.warn(`Prefetch failed for ${assetId}:${version}`, error);
    }
  }

  /**
   * Batch prefetch multiple assets
   */
  async prefetchBatch(assets: Array<{ assetId: string; version?: string }>): Promise<void> {
    const promises = assets.map((asset) =>
      this.prefetch(asset.assetId, asset.version || 'latest')
    );
    await Promise.allSettled(promises);
  }

  /**
   * Get asset file by path
   */
  async getFile(
    assetId: string,
    version: string,
    filePath: string
  ): Promise<ArrayBuffer | null> {
    const package_ = await this.downloadAsset(assetId, version);
    return package_.files.get(filePath) || null;
  }

  /**
   * Get asset file as text
   */
  async getFileAsText(
    assetId: string,
    version: string,
    filePath: string
  ): Promise<string | null> {
    const data = await this.getFile(assetId, version, filePath);
    if (!data) return null;
    return new TextDecoder().decode(data);
  }

  /**
   * Get asset file as blob URL
   */
  async getFileAsBlobUrl(
    assetId: string,
    version: string,
    filePath: string,
    mimeType?: string
  ): Promise<string | null> {
    const data = await this.getFile(assetId, version, filePath);
    if (!data) return null;

    const blob = new Blob([data], { type: mimeType });
    return URL.createObjectURL(blob);
  }
}
