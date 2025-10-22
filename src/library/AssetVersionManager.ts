/**
 * Asset Versioning and History System
 * Owner: George
 * 
 * Comprehensive version control for assets with branching, merging,
 * and collaborative editing support
 */

import type { LibraryAsset } from './types';
import type { User } from '../auth/UserStore';
import type { AssetMetadata } from './AssetMetadataManager';

/**
 * Asset Version Types
 */
export interface AssetVersion {
  id: string;
  assetId: string;
  versionNumber: string; // Semantic versioning: 1.0.0, 1.1.0, 2.0.0
  branchName: string; // main, feature/new-design, hotfix/bug-fix
  parentVersionId?: string; // For branching
  mergeFromVersionId?: string; // For merging
  
  // Version metadata
  name: string;
  description: string;
  changes: VersionChange[];
  tags: string[];
  
  // File information
  fileInfo: {
    fileName: string;
    filePath: string;
    fileSize: number;
    checksum: string;
    mimeType: string;
  };
  
  // Creation info
  createdBy: string; // User ID
  createdAt: Date;
  createdByUser: {
    id: string;
    name: string;
    email: string;
  };
  
  // Status and validation
  status: 'draft' | 'review' | 'approved' | 'rejected' | 'archived';
  isStable: boolean;
  isPublic: boolean;
  
  // Review process
  review: {
    reviewers: string[];
    approvedBy: string[];
    rejectedBy: string[];
    comments: ReviewComment[];
    reviewDeadline?: Date;
  };
  
  // Analytics
  analytics: {
    downloadCount: number;
    viewCount: number;
    usageCount: number;
    lastUsed: Date;
  };
  
  // Dependencies
  dependencies: {
    requires: string[]; // Asset IDs this version depends on
    conflicts: string[]; // Asset IDs this version conflicts with
    compatibleWith: string[]; // Asset IDs this version is compatible with
  };
}

export interface VersionChange {
  id: string;
  type: 'added' | 'modified' | 'removed' | 'renamed' | 'moved';
  field: string; // 'name', 'description', 'geometry', 'materials', etc.
  oldValue?: any;
  newValue?: any;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'breaking';
  affectedComponents: string[]; // Which parts of the asset are affected
  timestamp: Date;
  userId: string;
}

export interface ReviewComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  type: 'comment' | 'suggestion' | 'approval' | 'rejection';
  resolved: boolean;
  parentCommentId?: string; // For threaded comments
  attachments?: string[]; // File attachments
}

export interface VersionBranch {
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  baseVersionId: string;
  headVersionId: string;
  isActive: boolean;
  isProtected: boolean; // Cannot be deleted
  permissions: {
    canCreateVersions: string[]; // User IDs
    canReview: string[]; // User IDs
    canMerge: string[]; // User IDs
  };
}

export interface VersionHistory {
  assetId: string;
  versions: AssetVersion[];
  branches: VersionBranch[];
  tags: VersionTag[];
  currentVersion: string;
  stableVersion: string;
  latestVersion: string;
}

export interface VersionTag {
  name: string;
  versionId: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  isRelease: boolean; // Release tags vs development tags
}

/**
 * Asset Version Manager
 */
export class AssetVersionManager {
  private static instance: AssetVersionManager | null = null;
  private versionCache: Map<string, AssetVersion> = new Map();
  private historyCache: Map<string, VersionHistory> = new Map();
  private branchCache: Map<string, VersionBranch> = new Map();

  private constructor() {}

  public static getInstance(): AssetVersionManager {
    if (!AssetVersionManager.instance) {
      AssetVersionManager.instance = new AssetVersionManager();
    }
    return AssetVersionManager.instance;
  }

  /**
   * Create initial version of an asset
   */
  public async createInitialVersion(
    asset: LibraryAsset,
    file: File,
    user: User,
    metadata: AssetMetadata
  ): Promise<AssetVersion> {
    const version: AssetVersion = {
      id: this.generateVersionId(),
      assetId: asset.id,
      versionNumber: '1.0.0',
      branchName: 'main',
      
      name: asset.name,
      description: asset.description || 'Initial version',
      changes: [{
        id: this.generateChangeId(),
        type: 'added',
        field: 'asset',
        description: 'Initial asset creation',
        impact: 'medium',
        affectedComponents: ['all'],
        timestamp: new Date(),
        userId: user.id
      }],
      tags: ['initial', 'v1.0.0'],
      
      fileInfo: {
        fileName: file.name,
        filePath: asset.filePath,
        fileSize: file.size,
        checksum: metadata.fileInfo.checksum,
        mimeType: file.type
      },
      
      createdBy: user.id,
      createdAt: new Date(),
      createdByUser: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      
      status: 'approved', // Initial versions are auto-approved
      isStable: true,
      isPublic: true,
      
      review: {
        reviewers: [],
        approvedBy: [user.id],
        rejectedBy: [],
        comments: []
      },
      
      analytics: {
        downloadCount: 0,
        viewCount: 0,
        usageCount: 0,
        lastUsed: new Date()
      },
      
      dependencies: {
        requires: [],
        conflicts: [],
        compatibleWith: []
      }
    };

    // Cache version
    this.versionCache.set(version.id, version);
    
    // Initialize version history
    const history: VersionHistory = {
      assetId: asset.id,
      versions: [version],
      branches: [{
        name: 'main',
        description: 'Main development branch',
        createdBy: user.id,
        createdAt: new Date(),
        baseVersionId: version.id,
        headVersionId: version.id,
        isActive: true,
        isProtected: true,
        permissions: {
          canCreateVersions: [user.id],
          canReview: [user.id],
          canMerge: [user.id]
        }
      }],
      tags: [{
        name: 'v1.0.0',
        versionId: version.id,
        description: 'Initial release',
        createdBy: user.id,
        createdAt: new Date(),
        isRelease: true
      }],
      currentVersion: version.id,
      stableVersion: version.id,
      latestVersion: version.id
    };
    
    this.historyCache.set(asset.id, history);
    
    return version;
  }

  /**
   * Create new version
   */
  public async createVersion(
    assetId: string,
    versionData: {
      name: string;
      description: string;
      branchName?: string;
      parentVersionId?: string;
      changes: Omit<VersionChange, 'id' | 'timestamp' | 'userId'>[];
    },
    user: User,
    file?: File
  ): Promise<AssetVersion> {
    const history = this.historyCache.get(assetId);
    if (!history) {
      throw new Error(`Version history not found for asset: ${assetId}`);
    }

    const parentVersion = versionData.parentVersionId 
      ? this.versionCache.get(versionData.parentVersionId)
      : history.versions.find(v => v.branchName === (versionData.branchName || 'main'));

    if (!parentVersion) {
      throw new Error('Parent version not found');
    }

    // Calculate next version number
    const nextVersionNumber = this.calculateNextVersionNumber(
      parentVersion.versionNumber,
      versionData.changes
    );

    const version: AssetVersion = {
      id: this.generateVersionId(),
      assetId,
      versionNumber: nextVersionNumber,
      branchName: versionData.branchName || 'main',
      parentVersionId: parentVersion.id,
      
      name: versionData.name,
      description: versionData.description,
      changes: versionData.changes.map(change => ({
        ...change,
        id: this.generateChangeId(),
        timestamp: new Date(),
        userId: user.id
      })),
      tags: [],
      
      fileInfo: file ? {
        fileName: file.name,
        filePath: '', // Will be set by storage manager
        fileSize: file.size,
        checksum: '', // Will be calculated
        mimeType: file.type
      } : parentVersion.fileInfo,
      
      createdBy: user.id,
      createdAt: new Date(),
      createdByUser: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      
      status: 'draft',
      isStable: false,
      isPublic: false,
      
      review: {
        reviewers: [],
        approvedBy: [],
        rejectedBy: [],
        comments: []
      },
      
      analytics: {
        downloadCount: 0,
        viewCount: 0,
        usageCount: 0,
        lastUsed: new Date()
      },
      
      dependencies: {
        requires: parentVersion.dependencies.requires,
        conflicts: parentVersion.dependencies.conflicts,
        compatibleWith: parentVersion.dependencies.compatibleWith
      }
    };

    // Cache version
    this.versionCache.set(version.id, version);
    
    // Update history
    history.versions.push(version);
    history.latestVersion = version.id;
    
    // Update branch head
    const branch = history.branches.find(b => b.name === version.branchName);
    if (branch) {
      branch.headVersionId = version.id;
    }
    
    this.historyCache.set(assetId, history);
    
    return version;
  }

  /**
   * Create branch
   */
  public async createBranch(
    assetId: string,
    branchData: {
      name: string;
      description: string;
      baseVersionId: string;
    },
    user: User
  ): Promise<VersionBranch> {
    const history = this.historyCache.get(assetId);
    if (!history) {
      throw new Error(`Version history not found for asset: ${assetId}`);
    }

    // Check if branch already exists
    if (history.branches.some(b => b.name === branchData.name)) {
      throw new Error(`Branch '${branchData.name}' already exists`);
    }

    const branch: VersionBranch = {
      name: branchData.name,
      description: branchData.description,
      createdBy: user.id,
      createdAt: new Date(),
      baseVersionId: branchData.baseVersionId,
      headVersionId: branchData.baseVersionId,
      isActive: true,
      isProtected: false,
      permissions: {
        canCreateVersions: [user.id],
        canReview: [user.id],
        canMerge: [user.id]
      }
    };

    // Add to history
    history.branches.push(branch);
    this.historyCache.set(assetId, history);
    this.branchCache.set(`${assetId}:${branch.name}`, branch);
    
    return branch;
  }

  /**
   * Merge branch
   */
  public async mergeBranch(
    assetId: string,
    sourceBranch: string,
    targetBranch: string,
    mergeData: {
      message: string;
      strategy: 'fast-forward' | 'merge-commit' | 'squash';
    },
    user: User
  ): Promise<AssetVersion> {
    const history = this.historyCache.get(assetId);
    if (!history) {
      throw new Error(`Version history not found for asset: ${assetId}`);
    }

    const sourceBranchData = history.branches.find(b => b.name === sourceBranch);
    const targetBranchData = history.branches.find(b => b.name === targetBranch);

    if (!sourceBranchData || !targetBranchData) {
      throw new Error('Source or target branch not found');
    }

    const sourceVersion = this.versionCache.get(sourceBranchData.headVersionId);
    const targetVersion = this.versionCache.get(targetBranchData.headVersionId);

    if (!sourceVersion || !targetVersion) {
      throw new Error('Source or target version not found');
    }

    // Check for merge conflicts
    const conflicts = await this.detectMergeConflicts(sourceVersion, targetVersion);
    if (conflicts.length > 0) {
      throw new Error(`Merge conflicts detected: ${conflicts.join(', ')}`);
    }

    // Create merge version
    const mergeVersion: AssetVersion = {
      id: this.generateVersionId(),
      assetId,
      versionNumber: this.calculateNextVersionNumber(targetVersion.versionNumber, []),
      branchName: targetBranch,
      parentVersionId: targetVersion.id,
      mergeFromVersionId: sourceVersion.id,
      
      name: `${targetVersion.name} (merged from ${sourceBranch})`,
      description: mergeData.message,
      changes: [{
        id: this.generateChangeId(),
        type: 'modified',
        field: 'merge',
        description: `Merged changes from ${sourceBranch}`,
        impact: 'medium',
        affectedComponents: ['all'],
        timestamp: new Date(),
        userId: user.id
      }],
      tags: ['merge'],
      
      fileInfo: sourceVersion.fileInfo, // Use source version's file
      
      createdBy: user.id,
      createdAt: new Date(),
      createdByUser: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      
      status: 'approved', // Merged versions are auto-approved
      isStable: true,
      isPublic: true,
      
      review: {
        reviewers: [],
        approvedBy: [user.id],
        rejectedBy: [],
        comments: []
      },
      
      analytics: {
        downloadCount: 0,
        viewCount: 0,
        usageCount: 0,
        lastUsed: new Date()
      },
      
      dependencies: {
        requires: [...targetVersion.dependencies.requires, ...sourceVersion.dependencies.requires],
        conflicts: [...targetVersion.dependencies.conflicts, ...sourceVersion.dependencies.conflicts],
        compatibleWith: [...targetVersion.dependencies.compatibleWith, ...sourceVersion.dependencies.compatibleWith]
      }
    };

    // Cache version
    this.versionCache.set(mergeVersion.id, mergeVersion);
    
    // Update history
    history.versions.push(mergeVersion);
    history.latestVersion = mergeVersion.id;
    history.currentVersion = mergeVersion.id;
    history.stableVersion = mergeVersion.id;
    
    // Update target branch head
    targetBranchData.headVersionId = mergeVersion.id;
    
    this.historyCache.set(assetId, history);
    
    return mergeVersion;
  }

  /**
   * Get version history
   */
  public getVersionHistory(assetId: string): VersionHistory | null {
    return this.historyCache.get(assetId) || null;
  }

  /**
   * Get specific version
   */
  public getVersion(versionId: string): AssetVersion | null {
    return this.versionCache.get(versionId) || null;
  }

  /**
   * Get versions for asset
   */
  public getAssetVersions(assetId: string): AssetVersion[] {
    const history = this.historyCache.get(assetId);
    return history?.versions || [];
  }

  /**
   * Get branches for asset
   */
  public getAssetBranches(assetId: string): VersionBranch[] {
    const history = this.historyCache.get(assetId);
    return history?.branches || [];
  }

  /**
   * Add review comment
   */
  public async addReviewComment(
    versionId: string,
    comment: Omit<ReviewComment, 'id' | 'timestamp'>,
    user: User
  ): Promise<ReviewComment> {
    const version = this.versionCache.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const reviewComment: ReviewComment = {
      ...comment,
      id: this.generateCommentId(),
      timestamp: new Date()
    };

    version.review.comments.push(reviewComment);
    this.versionCache.set(versionId, version);
    
    return reviewComment;
  }

  /**
   * Approve version
   */
  public async approveVersion(
    versionId: string,
    user: User,
    comment?: string
  ): Promise<void> {
    const version = this.versionCache.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    version.status = 'approved';
    version.isStable = true;
    version.isPublic = true;
    
    if (!version.review.approvedBy.includes(user.id)) {
      version.review.approvedBy.push(user.id);
    }

    if (comment) {
      await this.addReviewComment(versionId, {
        userId: user.id,
        userName: user.name,
        content: comment,
        type: 'approval',
        resolved: false
      }, user);
    }

    this.versionCache.set(versionId, version);
    
    // Update history stable version
    const history = this.historyCache.get(version.assetId);
    if (history) {
      history.stableVersion = versionId;
      this.historyCache.set(version.assetId, history);
    }
  }

  /**
   * Reject version
   */
  public async rejectVersion(
    versionId: string,
    user: User,
    reason: string
  ): Promise<void> {
    const version = this.versionCache.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    version.status = 'rejected';
    
    if (!version.review.rejectedBy.includes(user.id)) {
      version.review.rejectedBy.push(user.id);
    }

    await this.addReviewComment(versionId, {
      userId: user.id,
      userName: user.name,
      content: reason,
      type: 'rejection',
      resolved: false
    }, user);

    this.versionCache.set(versionId, version);
  }

  /**
   * Create version tag
   */
  public async createTag(
    assetId: string,
    versionId: string,
    tagData: {
      name: string;
      description: string;
      isRelease: boolean;
    },
    user: User
  ): Promise<VersionTag> {
    const history = this.historyCache.get(assetId);
    if (!history) {
      throw new Error(`Version history not found for asset: ${assetId}`);
    }

    const version = this.versionCache.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const tag: VersionTag = {
      name: tagData.name,
      versionId,
      description: tagData.description,
      createdBy: user.id,
      createdAt: new Date(),
      isRelease: tagData.isRelease
    };

    history.tags.push(tag);
    this.historyCache.set(assetId, history);
    
    return tag;
  }

  /**
   * Get version diff
   */
  public async getVersionDiff(
    fromVersionId: string,
    toVersionId: string
  ): Promise<VersionChange[]> {
    const fromVersion = this.versionCache.get(fromVersionId);
    const toVersion = this.versionCache.get(toVersionId);

    if (!fromVersion || !toVersion) {
      throw new Error('One or both versions not found');
    }

    // Calculate diff between versions
    const changes: VersionChange[] = [];
    
    // Compare basic properties
    if (fromVersion.name !== toVersion.name) {
      changes.push({
        id: this.generateChangeId(),
        type: 'modified',
        field: 'name',
        oldValue: fromVersion.name,
        newValue: toVersion.name,
        description: `Name changed from "${fromVersion.name}" to "${toVersion.name}"`,
        impact: 'low',
        affectedComponents: ['metadata'],
        timestamp: new Date(),
        userId: toVersion.createdBy
      });
    }

    if (fromVersion.description !== toVersion.description) {
      changes.push({
        id: this.generateChangeId(),
        type: 'modified',
        field: 'description',
        oldValue: fromVersion.description,
        newValue: toVersion.description,
        description: 'Description updated',
        impact: 'low',
        affectedComponents: ['metadata'],
        timestamp: new Date(),
        userId: toVersion.createdBy
      });
    }

    // Compare file info
    if (fromVersion.fileInfo.checksum !== toVersion.fileInfo.checksum) {
      changes.push({
        id: this.generateChangeId(),
        type: 'modified',
        field: 'file',
        description: 'File content changed',
        impact: 'high',
        affectedComponents: ['geometry', 'materials', 'textures'],
        timestamp: new Date(),
        userId: toVersion.createdBy
      });
    }

    return changes;
  }

  /**
   * Private helper methods
   */
  private generateVersionId(): string {
    return `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCommentId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateNextVersionNumber(
    currentVersion: string,
    changes: VersionChange[]
  ): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    // Determine version bump based on change impact
    const hasBreakingChanges = changes.some(c => c.impact === 'breaking');
    const hasMajorChanges = changes.some(c => c.impact === 'high');
    
    if (hasBreakingChanges) {
      return `${major + 1}.0.0`;
    } else if (hasMajorChanges) {
      return `${major}.${minor + 1}.0`;
    } else {
      return `${major}.${minor}.${patch + 1}`;
    }
  }

  private async detectMergeConflicts(
    sourceVersion: AssetVersion,
    targetVersion: AssetVersion
  ): Promise<string[]> {
    const conflicts: string[] = [];
    
    // Check for conflicting dependencies
    const sourceConflicts = sourceVersion.dependencies.conflicts;
    const targetConflicts = targetVersion.dependencies.conflicts;
    
    for (const conflict of sourceConflicts) {
      if (targetVersion.dependencies.requires.includes(conflict)) {
        conflicts.push(`Dependency conflict: ${conflict}`);
      }
    }
    
    for (const conflict of targetConflicts) {
      if (sourceVersion.dependencies.requires.includes(conflict)) {
        conflicts.push(`Dependency conflict: ${conflict}`);
      }
    }
    
    // Check for incompatible changes
    const sourceBreakingChanges = sourceVersion.changes.filter(c => c.impact === 'breaking');
    const targetBreakingChanges = targetVersion.changes.filter(c => c.impact === 'breaking');
    
    if (sourceBreakingChanges.length > 0 && targetBreakingChanges.length > 0) {
      conflicts.push('Breaking changes in both branches');
    }
    
    return conflicts;
  }
}

/**
 * Version Management API
 */
export class VersionManagementAPI {
  private versionManager: AssetVersionManager;

  constructor() {
    this.versionManager = AssetVersionManager.getInstance();
  }

  /**
   * Create initial version
   */
  public async createInitialVersion(
    asset: LibraryAsset,
    file: File,
    user: User,
    metadata: AssetMetadata
  ): Promise<AssetVersion> {
    return await this.versionManager.createInitialVersion(asset, file, user, metadata);
  }

  /**
   * Create new version
   */
  public async createVersion(
    assetId: string,
    versionData: any,
    user: User,
    file?: File
  ): Promise<AssetVersion> {
    return await this.versionManager.createVersion(assetId, versionData, user, file);
  }

  /**
   * Create branch
   */
  public async createBranch(
    assetId: string,
    branchData: any,
    user: User
  ): Promise<VersionBranch> {
    return await this.versionManager.createBranch(assetId, branchData, user);
  }

  /**
   * Merge branch
   */
  public async mergeBranch(
    assetId: string,
    sourceBranch: string,
    targetBranch: string,
    mergeData: any,
    user: User
  ): Promise<AssetVersion> {
    return await this.versionManager.mergeBranch(assetId, sourceBranch, targetBranch, mergeData, user);
  }

  /**
   * Get version history
   */
  public getVersionHistory(assetId: string): VersionHistory | null {
    return this.versionManager.getVersionHistory(assetId);
  }

  /**
   * Get specific version
   */
  public getVersion(versionId: string): AssetVersion | null {
    return this.versionManager.getVersion(versionId);
  }

  /**
   * Get asset versions
   */
  public getAssetVersions(assetId: string): AssetVersion[] {
    return this.versionManager.getAssetVersions(assetId);
  }

  /**
   * Get asset branches
   */
  public getAssetBranches(assetId: string): VersionBranch[] {
    return this.versionManager.getAssetBranches(assetId);
  }

  /**
   * Add review comment
   */
  public async addReviewComment(
    versionId: string,
    comment: any,
    user: User
  ): Promise<ReviewComment> {
    return await this.versionManager.addReviewComment(versionId, comment, user);
  }

  /**
   * Approve version
   */
  public async approveVersion(
    versionId: string,
    user: User,
    comment?: string
  ): Promise<void> {
    return await this.versionManager.approveVersion(versionId, user, comment);
  }

  /**
   * Reject version
   */
  public async rejectVersion(
    versionId: string,
    user: User,
    reason: string
  ): Promise<void> {
    return await this.versionManager.rejectVersion(versionId, user, reason);
  }

  /**
   * Create version tag
   */
  public async createTag(
    assetId: string,
    versionId: string,
    tagData: any,
    user: User
  ): Promise<VersionTag> {
    return await this.versionManager.createTag(assetId, versionId, tagData, user);
  }

  /**
   * Get version diff
   */
  public async getVersionDiff(
    fromVersionId: string,
    toVersionId: string
  ): Promise<VersionChange[]> {
    return await this.versionManager.getVersionDiff(fromVersionId, toVersionId);
  }
}
