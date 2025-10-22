/**
 * Asset Origin Service
 * Owner: Agent 2
 * 
 * Minimal service for managing asset origin information
 * Designed to be optional and extensible
 */

import type { LibraryAsset, AssetOrigin, AssetOriginType } from '../types';

export class AssetOriginService {
  private static instance: AssetOriginService | null = null;

  private constructor() {}

  public static getInstance(): AssetOriginService {
    if (!AssetOriginService.instance) {
      AssetOriginService.instance = new AssetOriginService();
    }
    return AssetOriginService.instance;
  }

  /**
   * Set origin for an asset (completely optional)
   */
  public setAssetOrigin(
    asset: LibraryAsset, 
    origin: AssetOrigin, 
    userId: string = 'current_user'
  ): LibraryAsset {
    const updatedAsset = { ...asset };
    
    // Set origin with timestamp
    updatedAsset.origin = {
      ...origin,
      createdAt: new Date(),
      createdBy: userId
    };

    // Add to provenance history
    if (!updatedAsset.provenanceHistory) {
      updatedAsset.provenanceHistory = [];
    }
    
    updatedAsset.provenanceHistory.push({
      type: 'created',
      timestamp: new Date(),
      userId,
      notes: `Origin set: ${origin.type || 'unknown'}`
    });

    return updatedAsset;
  }

  /**
   * Mark asset as reused from another project
   */
  public markAsReused(
    asset: LibraryAsset, 
    sourceProjectId: string, 
    userId: string = 'current_user'
  ): LibraryAsset {
    return this.setAssetOrigin(asset, {
      type: 'reused',
      sourceProject: sourceProjectId,
      notes: `Reused from project: ${sourceProjectId}`
    }, userId);
  }

  /**
   * Get origin type icon (simple visual indicator)
   */
  public getOriginIcon(originType?: AssetOriginType): string {
    switch (originType) {
      case 'freeIssue': return '🎁';
      case 'reused': return '♻️';
      case 'purchased': return '🛒';
      case 'internal': return '🏭';
      case 'custom': return '⚙️';
      default: return '';
    }
  }

  /**
   * Get origin type label
   */
  public getOriginLabel(originType?: AssetOriginType): string {
    switch (originType) {
      case 'freeIssue': return 'Free Issue';
      case 'reused': return 'Reused';
      case 'purchased': return 'Purchased';
      case 'internal': return 'Internal';
      case 'custom': return 'Custom';
      default: return 'Unknown';
    }
  }

  /**
   * Check if asset has origin information
   */
  public hasOrigin(asset: LibraryAsset): boolean {
    return !!(asset.origin && asset.origin.type);
  }

  /**
   * Get simple origin summary for display
   */
  public getOriginSummary(asset: LibraryAsset): string {
    if (!this.hasOrigin(asset)) {
      return '';
    }

    const origin = asset.origin!;
    let summary = this.getOriginLabel(origin.type);
    
    if (origin.owner) {
      summary += ` (Owner: ${origin.owner})`;
    }
    
    if (origin.sourceProject) {
      summary += ` (From: ${origin.sourceProject})`;
    }

    return summary;
  }

  /**
   * Filter assets by origin type (simple helper)
   */
  public filterByOriginType(assets: LibraryAsset[], originTypes: AssetOriginType[]): LibraryAsset[] {
    if (!originTypes || originTypes.length === 0) {
      return assets;
    }

    return assets.filter(asset => 
      asset.origin?.type && originTypes.includes(asset.origin.type)
    );
  }

  /**
   * Get all unique origin types from a list of assets
   */
  public getUniqueOriginTypes(assets: LibraryAsset[]): AssetOriginType[] {
    const types = new Set<AssetOriginType>();
    
    assets.forEach(asset => {
      if (asset.origin?.type) {
        types.add(asset.origin.type);
      }
    });

    return Array.from(types).sort();
  }

  /**
   * Get all unique owners from a list of assets
   */
  public getUniqueOwners(assets: LibraryAsset[]): string[] {
    const owners = new Set<string>();
    
    assets.forEach(asset => {
      if (asset.origin?.owner) {
        owners.add(asset.origin.owner);
      }
    });

    return Array.from(owners).sort();
  }
}
