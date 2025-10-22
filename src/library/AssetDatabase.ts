/**
 * Asset Database (IndexedDB)
 * Owner: George
 * 
 * Local storage system for user's custom assets using IndexedDB
 * Supports asset versioning, thumbnails, and metadata persistence
 */

import type { LibraryAsset } from './types';

/**
 * Database schema versions
 */
const DB_VERSION = 2; // Incremented for asset origin support
const DB_NAME = 'kineticore_asset_library';

/**
 * Store names
 */
const STORES = {
  ASSETS: 'assets',
  THUMBNAILS: 'thumbnails',
  METADATA: 'metadata',
  VERSIONS: 'versions'
} as const;

/**
 * Asset database entry
 */
export interface AssetDatabaseEntry {
  id: string;
  name: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  assetData: LibraryAsset;
  thumbnailData?: string; // Base64 encoded image
  meshData?: string; // Serialized mesh data
  fileSize: number;
  checksum: string;
  tags: string[];
  usageCount: number;
  lastUsed?: Date;
  isFavorite: boolean;
  
  // Asset Origin & Provenance
  origin?: import('./types').AssetOrigin;
  provenanceHistory?: import('./types').AssetProvenanceEntry[];
}

/**
 * Asset version entry
 */
export interface AssetVersionEntry {
  assetId: string;
  version: number;
  createdAt: Date;
  description?: string;
  changes?: string[];
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  totalAssets: number;
  totalSize: number;
  totalVersions: number;
  lastUpdated: Date;
  storageUsed: number;
}

/**
 * Search filters for database queries
 */
export interface DatabaseFilters {
  tags?: string[];
  assetClass?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  minUsageCount?: number;
  isFavorite?: boolean;
  searchQuery?: string;
  
  // Asset Origin Filters
  originTypes?: import('./types').AssetOriginType[];
  ownerCompanies?: string[];
  supplierCompanies?: string[];
}

/**
 * IndexedDB Asset Database
 */
export class AssetDatabase {
  private static instance: AssetDatabase | null = null;
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): AssetDatabase {
    if (!AssetDatabase.instance) {
      AssetDatabase.instance = new AssetDatabase();
    }
    return AssetDatabase.instance;
  }

  /**
   * Initialize the database
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('[AssetDatabase] Initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });
  }

  /**
   * Create database stores
   */
  private createStores(db: IDBDatabase): void {
    // Assets store
    if (!db.objectStoreNames.contains(STORES.ASSETS)) {
      const assetsStore = db.createObjectStore(STORES.ASSETS, { keyPath: 'id' });
      assetsStore.createIndex('name', 'name', { unique: false });
      assetsStore.createIndex('createdAt', 'createdAt', { unique: false });
      assetsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      assetsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      assetsStore.createIndex('assetClass', 'assetData.assetClass', { unique: false });
      assetsStore.createIndex('usageCount', 'usageCount', { unique: false });
      assetsStore.createIndex('isFavorite', 'isFavorite', { unique: false });
    }

    // Thumbnails store
    if (!db.objectStoreNames.contains(STORES.THUMBNAILS)) {
      db.createObjectStore(STORES.THUMBNAILS, { keyPath: 'assetId' });
    }

    // Metadata store
    if (!db.objectStoreNames.contains(STORES.METADATA)) {
      const metadataStore = db.createObjectStore(STORES.METADATA, { keyPath: 'assetId' });
      metadataStore.createIndex('lastUsed', 'lastUsed', { unique: false });
    }

    // Versions store
    if (!db.objectStoreNames.contains(STORES.VERSIONS)) {
      const versionsStore = db.createObjectStore(STORES.VERSIONS, { keyPath: ['assetId', 'version'] });
      versionsStore.createIndex('assetId', 'assetId', { unique: false });
      versionsStore.createIndex('createdAt', 'createdAt', { unique: false });
    }
  }

  /**
   * Save asset to database
   */
  public   async saveAsset(
    asset: LibraryAsset,
    thumbnailData?: string,
    _meshData?: string
  ): Promise<string> {
    await this.ensureInitialized();

    // const now = new Date();
    // const checksum = await this.calculateChecksum(asset);
    
    /*
    const _entry: AssetDatabaseEntry = {
      id: asset.id,
      name: asset.name,
      version: 1,
      createdAt: now,
      updatedAt: now,
      assetData: asset,
      thumbnailData,
      meshData,
      fileSize: this.calculateFileSize(asset, thumbnailData, meshData),
      checksum,
      tags: asset.tags || [],
      usageCount: 0,
      isFavorite: false
    };
    */

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS, STORES.THUMBNAILS], 'readwrite');
      
      // Save main asset
      // const assetsStore = transaction.objectStore(STORES.ASSETS);
      // const _assetRequest = assetsStore.put(entry);

      // Save thumbnail if provided
      if (thumbnailData) {
        const thumbnailsStore = transaction.objectStore(STORES.THUMBNAILS);
        thumbnailsStore.put({
          assetId: asset.id,
          data: thumbnailData
        });
      }

      transaction.oncomplete = () => {
        console.log(`[AssetDatabase] Saved asset: ${asset.name}`);
        resolve(asset.id);
      };

      transaction.onerror = () => {
        reject(new Error('Failed to save asset'));
      };
    });
  }

  /**
   * Get asset by ID
   */
  public async getAsset(assetId: string): Promise<AssetDatabaseEntry | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readonly');
      const store = transaction.objectStore(STORES.ASSETS);
      const request = store.get(assetId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to get asset'));
      };
    });
  }

  /**
   * Get asset thumbnail
   */
  public async getThumbnail(assetId: string): Promise<string | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.THUMBNAILS], 'readonly');
      const store = transaction.objectStore(STORES.THUMBNAILS);
      const request = store.get(assetId);

      request.onsuccess = () => {
        resolve(request.result?.data || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to get thumbnail'));
      };
    });
  }

  /**
   * Search assets with filters
   */
  public async searchAssets(filters: DatabaseFilters = {}): Promise<AssetDatabaseEntry[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readonly');
      const store = transaction.objectStore(STORES.ASSETS);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result;

        // Apply filters
        if (filters.tags && filters.tags.length > 0) {
          results = results.filter(asset => 
            filters.tags!.some(tag => asset.tags.includes(tag))
          );
        }

        if (filters.assetClass && filters.assetClass.length > 0) {
          results = results.filter(asset => 
            filters.assetClass!.includes(asset.assetData.assetClass)
          );
        }

        if (filters.createdAfter) {
          results = results.filter(asset => 
            asset.createdAt >= filters.createdAfter!
          );
        }

        if (filters.createdBefore) {
          results = results.filter(asset => 
            asset.createdAt <= filters.createdBefore!
          );
        }

        if (filters.minUsageCount !== undefined) {
          results = results.filter(asset => 
            asset.usageCount >= filters.minUsageCount!
          );
        }

        if (filters.isFavorite !== undefined) {
          results = results.filter(asset => 
            asset.isFavorite === filters.isFavorite!
          );
        }

        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          results = results.filter(asset => 
            asset.name.toLowerCase().includes(query) ||
            asset.assetData.description?.toLowerCase().includes(query) ||
            asset.tags.some((tag: string) => tag.toLowerCase().includes(query))
          );
        }

        // Sort by usage count and last used
        results.sort((a, b) => {
          if (a.usageCount !== b.usageCount) {
            return b.usageCount - a.usageCount;
          }
          return (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0);
        });

        resolve(results);
      };

      request.onerror = () => {
        reject(new Error('Failed to search assets'));
      };
    });
  }

  /**
   * Update asset usage
   */
  public async updateAssetUsage(assetId: string): Promise<void> {
    await this.ensureInitialized();

    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    asset.usageCount++;
    asset.lastUsed = new Date();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readwrite');
      const store = transaction.objectStore(STORES.ASSETS);
      const request = store.put(asset);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update asset usage'));
    });
  }

  /**
   * Toggle asset favorite status
   */
  public async toggleFavorite(assetId: string): Promise<boolean> {
    await this.ensureInitialized();

    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    asset.isFavorite = !asset.isFavorite;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readwrite');
      const store = transaction.objectStore(STORES.ASSETS);
      const request = store.put(asset);

      request.onsuccess = () => resolve(asset.isFavorite);
      request.onerror = () => reject(new Error('Failed to toggle favorite'));
    });
  }

  /**
   * Delete asset
   */
  public async deleteAsset(assetId: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [STORES.ASSETS, STORES.THUMBNAILS, STORES.METADATA, STORES.VERSIONS], 
        'readwrite'
      );

      // Delete from all stores
      transaction.objectStore(STORES.ASSETS).delete(assetId);
      transaction.objectStore(STORES.THUMBNAILS).delete(assetId);
      transaction.objectStore(STORES.METADATA).delete(assetId);
      
      // Delete all versions
      const versionsStore = transaction.objectStore(STORES.VERSIONS);
      const index = versionsStore.index('assetId');
      const request = index.openCursor(IDBKeyRange.only(assetId));
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log(`[AssetDatabase] Deleted asset: ${assetId}`);
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error('Failed to delete asset'));
      };
    });
  }

  /**
   * Get database statistics
   */
  public async getStats(): Promise<DatabaseStats> {
    await this.ensureInitialized();

    const assets = await this.searchAssets();
    const totalSize = assets.reduce((sum, asset) => sum + asset.fileSize, 0);
    const totalVersions = await this.getTotalVersions();
    const lastUpdated = assets.length > 0 
      ? new Date(Math.max(...assets.map(a => a.updatedAt.getTime())))
      : new Date();

    return {
      totalAssets: assets.length,
      totalSize,
      totalVersions,
      lastUpdated,
      storageUsed: await this.getStorageUsed()
    };
  }

  /**
   * Export asset as .kicoreasset file
   */
  public async exportAsset(assetId: string): Promise<Blob> {
    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const thumbnail = await this.getThumbnail(assetId);
    
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
   * Import asset from .kicoreasset file
   */
  public async importAsset(file: File): Promise<string> {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.asset) {
      throw new Error('Invalid .kicoreasset file');
    }

    const assetId = await this.saveAsset(
      data.asset,
      data.thumbnail,
      data.meshData
    );

    console.log(`[AssetDatabase] Imported asset: ${data.asset.name}`);
    return assetId;
  }

  /**
   * Clear all data (for testing)
   */
  public async clearAll(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [STORES.ASSETS, STORES.THUMBNAILS, STORES.METADATA, STORES.VERSIONS], 
        'readwrite'
      );

      transaction.objectStore(STORES.ASSETS).clear();
      transaction.objectStore(STORES.THUMBNAILS).clear();
      transaction.objectStore(STORES.METADATA).clear();
      transaction.objectStore(STORES.VERSIONS).clear();

      transaction.oncomplete = () => {
        console.log('[AssetDatabase] Cleared all data');
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error('Failed to clear data'));
      };
    });
  }

  /**
   * Private helper methods
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /*
  private async calculateChecksum(asset: LibraryAsset): Promise<string> {
    const data = JSON.stringify(asset);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  */

  /*
  private calculateFileSize(asset: LibraryAsset, thumbnail?: string, meshData?: string): number {
    let size = JSON.stringify(asset).length;
    if (thumbnail) size += thumbnail.length;
    if (meshData) size += meshData.length;
    return size;
  }
  */

  private async getTotalVersions(): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VERSIONS], 'readonly');
      const store = transaction.objectStore(STORES.VERSIONS);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to count versions'));
    });
  }

  private async getStorageUsed(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return 0;
  }
}
