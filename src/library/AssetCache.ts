/**
 * Asset Cache - IndexedDB Storage
 * Owner: George
 *
 * Manages local caching of cloud assets using IndexedDB for offline support
 * and fast repeated access. Implements LRU eviction when cache size exceeds limit.
 */

import type { CachedAssetPackage, AssetPackageMetadata } from './types';

const DB_NAME = 'kineticore-asset-cache';
const DB_VERSION = 1;
const ASSET_STORE = 'assets';
const FILE_STORE = 'files';

/**
 * Asset cache manager using IndexedDB
 */
export class AssetCache {
  private db: IDBDatabase | null = null;
  private readonly maxCacheSize: number;
  private currentCacheSize: number = 0;

  constructor(maxCacheSize: number = 500 * 1024 * 1024) {
    // Default: 500MB
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.calculateCacheSize().then(() => resolve());
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Asset metadata store
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          const assetStore = db.createObjectStore(ASSET_STORE, {
            keyPath: 'key', // "assetId:version"
          });
          assetStore.createIndex('assetId', 'assetId', { unique: false });
          assetStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }

        // File data store (separate for large blobs)
        if (!db.objectStoreNames.contains(FILE_STORE)) {
          const fileStore = db.createObjectStore(FILE_STORE, {
            keyPath: 'key', // "assetId:version:filePath"
          });
          fileStore.createIndex('assetKey', 'assetKey', { unique: false });
        }
      };
    });
  }

  /**
   * Get cached asset package
   */
  async get(assetId: string, version: string): Promise<CachedAssetPackage | null> {
    if (!this.db) {
      await this.initialize();
    }

    const key = this.makeKey(assetId, version);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ASSET_STORE, FILE_STORE], 'readonly');
      const assetStore = transaction.objectStore(ASSET_STORE);

      const request = assetStore.get(key);

      request.onerror = () => reject(new Error('Failed to read from cache'));

      request.onsuccess = async () => {
        const record = request.result;
        if (!record) {
          resolve(null);
          return;
        }

        // Load associated files
        const files = await this.getFiles(key);

        // Update last accessed time
        await this.updateLastAccessed(key);

        resolve({
          assetId: record.assetId,
          version: record.version,
          metadata: record.metadata,
          files,
          cachedAt: record.cachedAt,
          lastAccessed: Date.now(),
          size: record.size,
        });
      };
    });
  }

  /**
   * Store asset package in cache
   */
  async set(
    assetId: string,
    version: string,
    metadata: AssetPackageMetadata,
    files: Map<string, ArrayBuffer>
  ): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const key = this.makeKey(assetId, version);

    // Calculate package size
    let packageSize = 0;
    for (const fileData of files.values()) {
      packageSize += fileData.byteLength;
    }

    // Check if we need to evict
    await this.ensureSpace(packageSize);

    // Store asset metadata
    const assetRecord = {
      key,
      assetId,
      version,
      metadata,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
      size: packageSize,
    };

    // Store in transaction
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ASSET_STORE, FILE_STORE], 'readwrite');
      const assetStore = transaction.objectStore(ASSET_STORE);
      const fileStore = transaction.objectStore(FILE_STORE);

      // Store metadata
      assetStore.put(assetRecord);

      // Store files
      for (const [filePath, fileData] of files.entries()) {
        const fileKey = this.makeFileKey(assetId, version, filePath);
        fileStore.put({
          key: fileKey,
          assetKey: key,
          filePath,
          data: fileData,
        });
      }

      transaction.oncomplete = () => {
        this.currentCacheSize += packageSize;
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error('Failed to write to cache'));
      };
    });
  }

  /**
   * Remove asset from cache
   */
  async remove(assetId: string, version: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const key = this.makeKey(assetId, version);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ASSET_STORE, FILE_STORE], 'readwrite');
      const assetStore = transaction.objectStore(ASSET_STORE);
      const fileStore = transaction.objectStore(FILE_STORE);

      // Get asset size before deletion
      const getRequest = assetStore.get(key);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          this.currentCacheSize -= record.size;
        }

        // Delete asset metadata
        assetStore.delete(key);

        // Delete associated files
        const index = fileStore.index('assetKey');
        const cursorRequest = index.openCursor(IDBKeyRange.only(key));

        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to delete from cache'));
    });
  }

  /**
   * Check if asset is cached
   */
  async has(assetId: string, version: string): Promise<boolean> {
    if (!this.db) {
      await this.initialize();
    }

    const key = this.makeKey(assetId, version);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ASSET_STORE], 'readonly');
      const assetStore = transaction.objectStore(ASSET_STORE);

      const request = assetStore.get(key);

      request.onerror = () => reject(new Error('Failed to check cache'));
      request.onsuccess = () => resolve(!!request.result);
    });
  }

  /**
   * List all cached assets
   */
  async list(): Promise<Array<{ assetId: string; version: string; size: number }>> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ASSET_STORE], 'readonly');
      const assetStore = transaction.objectStore(ASSET_STORE);

      const request = assetStore.getAll();

      request.onerror = () => reject(new Error('Failed to list cache'));
      request.onsuccess = () => {
        const results = request.result.map((record) => ({
          assetId: record.assetId,
          version: record.version,
          size: record.size,
        }));
        resolve(results);
      };
    });
  }

  /**
   * Clear all cached assets
   */
  async clear(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ASSET_STORE, FILE_STORE], 'readwrite');
      const assetStore = transaction.objectStore(ASSET_STORE);
      const fileStore = transaction.objectStore(FILE_STORE);

      assetStore.clear();
      fileStore.clear();

      transaction.oncomplete = () => {
        this.currentCacheSize = 0;
        resolve();
      };

      transaction.onerror = () => reject(new Error('Failed to clear cache'));
    });
  }

  /**
   * Get current cache size
   */
  getCacheSize(): number {
    return this.currentCacheSize;
  }

  /**
   * Get cache usage percentage
   */
  getCacheUsage(): number {
    return (this.currentCacheSize / this.maxCacheSize) * 100;
  }

  // === Private Methods ===

  /**
   * Generate cache key
   */
  private makeKey(assetId: string, version: string): string {
    return `${assetId}:${version}`;
  }

  /**
   * Generate file cache key
   */
  private makeFileKey(assetId: string, version: string, filePath: string): string {
    return `${assetId}:${version}:${filePath}`;
  }

  /**
   * Get all files for an asset
   */
  private async getFiles(assetKey: string): Promise<Map<string, ArrayBuffer>> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([FILE_STORE], 'readonly');
      const fileStore = transaction.objectStore(FILE_STORE);
      const index = fileStore.index('assetKey');

      const files = new Map<string, ArrayBuffer>();
      const cursorRequest = index.openCursor(IDBKeyRange.only(assetKey));

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const record = cursor.value;
          files.set(record.filePath, record.data);
          cursor.continue();
        } else {
          resolve(files);
        }
      };

      cursorRequest.onerror = () => reject(new Error('Failed to read files from cache'));
    });
  }

  /**
   * Update last accessed timestamp
   */
  private async updateLastAccessed(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ASSET_STORE], 'readwrite');
      const assetStore = transaction.objectStore(ASSET_STORE);

      const getRequest = assetStore.get(key);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.lastAccessed = Date.now();
          assetStore.put(record);
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to update access time'));
    });
  }

  /**
   * Calculate total cache size from database
   */
  private async calculateCacheSize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ASSET_STORE], 'readonly');
      const assetStore = transaction.objectStore(ASSET_STORE);

      const request = assetStore.getAll();

      request.onerror = () => reject(new Error('Failed to calculate cache size'));
      request.onsuccess = () => {
        this.currentCacheSize = request.result.reduce(
          (sum, record) => sum + (record.size || 0),
          0
        );
        resolve();
      };
    });
  }

  /**
   * Ensure space for new asset (LRU eviction)
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    if (this.currentCacheSize + requiredSize <= this.maxCacheSize) {
      return; // Enough space
    }

    // Get all assets sorted by last accessed (LRU)
    const assets = await this.getAssetsSortedByLRU();

    // Evict assets until we have enough space
    const spaceNeeded = this.currentCacheSize + requiredSize - this.maxCacheSize;
    let spaceFreed = 0;

    for (const asset of assets) {
      if (spaceFreed >= spaceNeeded) break;

      await this.remove(asset.assetId, asset.version);
      spaceFreed += asset.size;
    }
  }

  /**
   * Get assets sorted by LRU (oldest first)
   */
  private async getAssetsSortedByLRU(): Promise<
    Array<{ assetId: string; version: string; size: number; lastAccessed: number }>
  > {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ASSET_STORE], 'readonly');
      const assetStore = transaction.objectStore(ASSET_STORE);

      const request = assetStore.getAll();

      request.onerror = () => reject(new Error('Failed to get LRU list'));
      request.onsuccess = () => {
        const results = request.result
          .map((record) => ({
            assetId: record.assetId,
            version: record.version,
            size: record.size,
            lastAccessed: record.lastAccessed,
          }))
          .sort((a, b) => a.lastAccessed - b.lastAccessed); // Oldest first

        resolve(results);
      };
    });
  }
}
