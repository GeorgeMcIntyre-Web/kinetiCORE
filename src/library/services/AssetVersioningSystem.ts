/**
 * Asset Versioning System
 * Owner: George
 * 
 * Comprehensive versioning system for assets with change tracking,
 * rollback capabilities, and collaboration features
 */

import type { LibraryAsset } from '../types';

/**
 * Asset version entry
 */
export interface AssetVersion {
  id: string;
  assetId: string;
  version: number;
  createdAt: Date;
  createdBy: string;
  description?: string;
  changes: AssetChange[];
  assetData: LibraryAsset;
  thumbnailData?: string;
  meshData?: string;
  fileSize: number;
  checksum: string;
  isActive: boolean;
  tags: string[];
}

/**
 * Asset change entry
 */
export interface AssetChange {
  type: 'create' | 'update' | 'delete' | 'restore';
  field?: string;
  oldValue?: any;
  newValue?: any;
  description: string;
  timestamp: Date;
  userId: string;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  version1: AssetVersion;
  version2: AssetVersion;
  differences: AssetDifference[];
  summary: {
    totalChanges: number;
    fieldChanges: number;
    metadataChanges: number;
    fileChanges: boolean;
  };
}

/**
 * Asset difference entry
 */
export interface AssetDifference {
  field: string;
  type: 'added' | 'removed' | 'modified';
  oldValue?: any;
  newValue?: any;
  description: string;
}

/**
 * Version creation configuration
 */
export interface VersionCreationConfig {
  description?: string;
  tags?: string[];
  includeThumbnail?: boolean;
  includeMeshData?: boolean;
  createdBy: string;
}

/**
 * Asset Versioning System
 */
export class AssetVersioningSystem {
  private static instance: AssetVersioningSystem | null = null;
  private readonly API_BASE_URL = '/api/asset-versions';
  
  private constructor() {}

  public static getInstance(): AssetVersioningSystem {
    if (!AssetVersioningSystem.instance) {
      AssetVersioningSystem.instance = new AssetVersioningSystem();
    }
    return AssetVersioningSystem.instance;
  }

  /**
   * Create new version of asset
   */
  public async createVersion(
    assetId: string,
    assetData: LibraryAsset,
    config: VersionCreationConfig
  ): Promise<string> {
    try {
      // Get current version number
      const currentVersion = await this.getCurrentVersion(assetId);
      const nextVersion = currentVersion ? currentVersion.version + 1 : 1;

      // Calculate checksum
      const checksum = this.calculateChecksum(assetData);

      // Create version entry
      const version: AssetVersion = {
        id: this.generateVersionId(),
        assetId,
        version: nextVersion,
        createdAt: new Date(),
        createdBy: config.createdBy,
        description: config.description,
        changes: [{
          type: 'create',
          description: config.description || `Version ${nextVersion} created`,
          timestamp: new Date(),
          userId: config.createdBy
        }],
        assetData: { ...assetData },
        fileSize: this.calculateAssetSize(assetData),
        checksum,
        isActive: true,
        tags: config.tags || []
      };

      // Save to database
      const response = await fetch(`${this.API_BASE_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(version)
      });

      if (!response.ok) {
        throw new Error(`Failed to create version: ${response.statusText}`);
      }

      const result = await response.json();
      return result.versionId;

    } catch (error) {
      console.error('[AssetVersioning] Failed to create version:', error);
      throw error;
    }
  }

  /**
   * Get all versions of an asset
   */
  public async getAssetVersions(assetId: string): Promise<AssetVersion[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/asset/${assetId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get versions: ${response.statusText}`);
      }

      const data = await response.json();
      return data.versions || [];

    } catch (error) {
      console.error('[AssetVersioning] Failed to get versions:', error);
      return [];
    }
  }

  /**
   * Get specific version
   */
  public async getVersion(versionId: string): Promise<AssetVersion | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/${versionId}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.version;

    } catch (error) {
      console.error('[AssetVersioning] Failed to get version:', error);
      return null;
    }
  }

  /**
   * Get current version of asset
   */
  public async getCurrentVersion(assetId: string): Promise<AssetVersion | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/asset/${assetId}/current`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.version;

    } catch (error) {
      console.error('[AssetVersioning] Failed to get current version:', error);
      return null;
    }
  }

  /**
   * Restore asset to specific version
   */
  public async restoreToVersion(
    assetId: string,
    versionId: string,
    userId: string,
    description?: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          versionId,
          userId,
          description: description || `Restored to version ${versionId}`
        })
      });

      return response.ok;

    } catch (error) {
      console.error('[AssetVersioning] Failed to restore version:', error);
      return false;
    }
  }

  /**
   * Compare two versions
   */
  public async compareVersions(versionId1: string, versionId2: string): Promise<VersionComparison | null> {
    try {
      const [version1, version2] = await Promise.all([
        this.getVersion(versionId1),
        this.getVersion(versionId2)
      ]);

      if (!version1 || !version2) {
        return null;
      }

      const differences = this.calculateDifferences(version1.assetData, version2.assetData);

      return {
        version1,
        version2,
        differences,
        summary: {
          totalChanges: differences.length,
          fieldChanges: differences.filter(d => d.type === 'modified').length,
          metadataChanges: differences.filter(d => 
            ['tags', 'searchKeywords', 'description'].includes(d.field)
          ).length,
          fileChanges: differences.some(d => d.field === 'filePath')
        }
      };

    } catch (error) {
      console.error('[AssetVersioning] Failed to compare versions:', error);
      return null;
    }
  }

  /**
   * Get version history timeline
   */
  public async getVersionTimeline(assetId: string): Promise<AssetVersion[]> {
    try {
      const versions = await this.getAssetVersions(assetId);
      
      // Sort by version number (newest first)
      return versions.sort((a, b) => b.version - a.version);

    } catch (error) {
      console.error('[AssetVersioning] Failed to get timeline:', error);
      return [];
    }
  }

  /**
   * Delete version (soft delete)
   */
  public async deleteVersion(versionId: string, userId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/${versionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      return response.ok;

    } catch (error) {
      console.error('[AssetVersioning] Failed to delete version:', error);
      return false;
    }
  }

  /**
   * Get version statistics
   */
  public async getVersionStats(assetId: string): Promise<{
    totalVersions: number;
    activeVersions: number;
    totalSize: number;
    averageSize: number;
    lastModified: Date | null;
    contributors: string[];
  }> {
    try {
      const versions = await this.getAssetVersions(assetId);
      
      const activeVersions = versions.filter(v => v.isActive);
      const totalSize = versions.reduce((sum, v) => sum + v.fileSize, 0);
      const contributors = [...new Set(versions.map(v => v.createdBy))];

      return {
        totalVersions: versions.length,
        activeVersions: activeVersions.length,
        totalSize,
        averageSize: versions.length > 0 ? totalSize / versions.length : 0,
        lastModified: versions.length > 0 ? versions[0].createdAt : null,
        contributors
      };

    } catch (error) {
      console.error('[AssetVersioning] Failed to get stats:', error);
      return {
        totalVersions: 0,
        activeVersions: 0,
        totalSize: 0,
        averageSize: 0,
        lastModified: null,
        contributors: []
      };
    }
  }

  /**
   * Calculate differences between two asset versions
   */
  private calculateDifferences(asset1: LibraryAsset, asset2: LibraryAsset): AssetDifference[] {
    const differences: AssetDifference[] = [];
    
    // Compare all fields
    const fields = [
      'name', 'manufacturer', 'modelNumber', 'version', 'domain', 'assetClass',
      'assetType', 'loaderType', 'filePath', 'fileSize', 'description',
      'tags', 'searchKeywords', 'thumbnail', 'thumbnailUrl', 'documentationUrl',
      'specSheetUrl', 'source', 'capabilities'
    ];

    for (const field of fields) {
      const value1 = (asset1 as any)[field];
      const value2 = (asset2 as any)[field];

      if (this.hasChanged(value1, value2)) {
        differences.push({
          field,
          type: this.getChangeType(value1, value2),
          oldValue: value1,
          newValue: value2,
          description: this.getChangeDescription(field, value1, value2)
        });
      }
    }

    return differences;
  }

  /**
   * Check if values have changed
   */
  private hasChanged(value1: any, value2: any): boolean {
    if (value1 === value2) return false;
    
    // Handle arrays
    if (Array.isArray(value1) && Array.isArray(value2)) {
      if (value1.length !== value2.length) return true;
      return !value1.every((item, index) => item === value2[index]);
    }
    
    // Handle objects
    if (typeof value1 === 'object' && typeof value2 === 'object') {
      return JSON.stringify(value1) !== JSON.stringify(value2);
    }
    
    return true;
  }

  /**
   * Get change type
   */
  private getChangeType(oldValue: any, newValue: any): 'added' | 'removed' | 'modified' {
    if (oldValue === undefined || oldValue === null) return 'added';
    if (newValue === undefined || newValue === null) return 'removed';
    return 'modified';
  }

  /**
   * Get change description
   */
  private getChangeDescription(field: string, oldValue: any, newValue: any): string {
    const changeType = this.getChangeType(oldValue, newValue);
    
    switch (changeType) {
      case 'added':
        return `${field} added: ${newValue}`;
      case 'removed':
        return `${field} removed`;
      case 'modified':
        return `${field} changed from "${oldValue}" to "${newValue}"`;
      default:
        return `${field} updated`;
    }
  }

  /**
   * Calculate asset checksum
   */
  private calculateChecksum(asset: LibraryAsset): string {
    const data = JSON.stringify(asset, Object.keys(asset).sort());
    return this.simpleHash(data);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Calculate asset size
   */
  private calculateAssetSize(asset: LibraryAsset): number {
    // Estimate size based on asset data
    const data = JSON.stringify(asset);
    return Math.round(data.length / 1024); // KB
  }

  /**
   * Generate version ID
   */
  private generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
