/**
 * User-Aware Asset Storage System
 * Owner: George
 * 
 * Multi-tier asset storage with user-based access control,
 * intelligent caching, and future-proof architecture
 */

import type { LibraryAsset, AssetCapabilities } from '../library/types';

/**
 * User authentication and role management
 */
export interface UserRole {
  id: string;
  name: string;
  permissions: AssetPermission[];
}

export interface AssetPermission {
  action: 'read' | 'write' | 'delete' | 'share';
  scope: 'own' | 'team' | 'organization' | 'public';
  assetTypes?: string[];
}

export interface AssetOwnership {
  ownerId: string;
  ownerType: 'user' | 'team' | 'organization';
  createdAt: Date;
  permissions: {
    public: boolean;
    teamShare: boolean;
    organizationShare: boolean;
    allowDownload: boolean;
    allowModify: boolean;
  };
  collaborators: {
    userId: string;
    permission: 'view' | 'edit' | 'admin';
    addedAt: Date;
  }[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  teamIds: string[];
  preferences: UserPreferences;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface UserPreferences {
  defaultAssetVisibility: 'private' | 'team' | 'organization' | 'public';
  autoSync: boolean;
  cacheSize: number; // MB
  notificationSettings: {
    assetShared: boolean;
    assetUpdated: boolean;
    teamActivity: boolean;
  };
}

/**
 * Enhanced asset ownership with sharing capabilities
 */
export interface EnhancedAssetOwnership extends AssetOwnership {
  visibility: 'private' | 'team' | 'organization' | 'public';
  sharingSettings: {
    allowDownload: boolean;
    allowModify: boolean;
    allowShare: boolean;
    expirationDate?: Date;
  };
  accessHistory: AssetAccessEntry[];
  collaborators: AssetCollaborator[];
}

export interface AssetAccessEntry {
  userId: string;
  action: 'view' | 'download' | 'edit' | 'share';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AssetCollaborator {
  userId: string;
  permission: 'view' | 'edit' | 'admin';
  addedAt: Date;
  addedBy: string;
  expiresAt?: Date;
}

/**
 * Multi-tier storage configuration
 */
export interface StorageTierConfig {
  local: {
    enabled: boolean;
    maxSize: number; // MB
    evictionPolicy: 'lru' | 'lfu' | 'fifo';
  };
  user: {
    enabled: boolean;
    maxSize: number; // MB
    provider: 'supabase' | 'aws' | 'azure';
  };
  shared: {
    enabled: boolean;
    maxSize: number; // MB
    provider: 'cloudflare-r2' | 'aws-s3' | 'azure-blob';
  };
}

/**
 * Asset storage location and metadata
 */
export interface AssetStorageInfo {
  assetId: string;
  tiers: {
    local?: {
      cached: boolean;
      cachedAt: Date;
      size: number;
    };
    user?: {
      url: string;
      uploadedAt: Date;
      size: number;
      checksum: string;
    };
    shared?: {
      url: string;
      uploadedAt: Date;
      size: number;
      checksum: string;
      organizationId: string;
    };
  };
  accessCount: number;
  lastAccessed: Date;
  popularityScore: number; // 0-1, based on usage patterns
}

/**
 * Smart caching strategy
 */
export interface CacheStrategy {
  prefetchRules: {
    basedOnProject: boolean;
    basedOnUserHistory: boolean;
    basedOnTeamActivity: boolean;
  };
  evictionRules: {
    maxAge: number; // hours
    maxSize: number; // MB
    minAccessCount: number;
  };
  compressionSettings: {
    enabled: boolean;
    algorithm: 'gzip' | 'brotli' | 'lz4';
    quality: number; // 1-9
  };
}

/**
 * Asset search and discovery
 */
export interface SmartSearchQuery {
  query: string;
  userId: string;
  filters: {
    ownership: 'own' | 'shared' | 'public' | 'all';
    assetTypes: string[];
    capabilities: Partial<AssetCapabilities>;
    dateRange: {
      from?: Date;
      to?: Date;
    };
    sizeRange: {
      min?: number; // MB
      max?: number; // MB
    };
    tags: string[];
    manufacturers: string[];
  };
  context: {
    currentProject?: string;
    similarAssets?: string[];
    userPreferences?: UserPreferences;
  };
  sorting: {
    field: 'name' | 'createdAt' | 'lastUsed' | 'popularity' | 'relevance';
    order: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    limit: number;
  };
}

export interface SearchResult {
  asset: LibraryAsset;
  score: number; // 0-1 relevance score
  matchedFields: string[];
  accessLevel: 'full' | 'limited' | 'preview';
  storageInfo: AssetStorageInfo;
}

/**
 * Asset analytics and insights
 */
export interface AssetAnalytics {
  assetId: string;
  usageStats: {
    totalViews: number;
    totalDownloads: number;
    uniqueUsers: number;
    projectsUsed: number;
    lastUsed: Date;
    averageRating: number;
    totalRating: number;
  };
  performanceMetrics: {
    averageLoadTime: number; // ms
    cacheHitRate: number; // 0-1
    downloadSuccessRate: number; // 0-1
    errorRate: number; // 0-1
  };
  userInsights: {
    mostActiveUsers: string[];
    usagePatterns: UsagePattern[];
    seasonalTrends: SeasonalTrend[];
  };
}

export interface UsagePattern {
  pattern: 'daily' | 'weekly' | 'monthly';
  peakHours: number[];
  peakDays: number[];
  averageUsage: number;
}

export interface SeasonalTrend {
  period: string; // e.g., "Q1 2025"
  usageCount: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Asset versioning and collaboration
 */
export interface AssetVersion {
  versionId: string;
  assetId: string;
  versionNumber: string; // Semantic versioning
  changes: VersionChange[];
  createdBy: string;
  createdAt: Date;
  description: string;
  isStable: boolean;
  downloadUrl: string;
  fileSize: number;
  checksum: string;
}

export interface VersionChange {
  type: 'added' | 'modified' | 'removed';
  field: string;
  oldValue?: any;
  newValue?: any;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'breaking';
}

export interface VersionComparison {
  version1: AssetVersion;
  version2: AssetVersion;
  changes: VersionChange[];
  summary: {
    totalChanges: number;
    breakingChanges: number;
    newFeatures: number;
    bugFixes: number;
  };
}

/**
 * Asset sharing and collaboration
 */
export interface AssetShareRequest {
  requestId: string;
  assetId: string;
  requestedBy: string;
  requestedFrom: string;
  permission: 'view' | 'edit' | 'admin';
  message?: string;
  expiresAt?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  respondedAt?: Date;
}

export interface AssetShareLink {
  linkId: string;
  assetId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
  permission: 'view' | 'download';
  password?: string;
  isActive: boolean;
}

/**
 * Asset library configuration
 */
export interface AssetLibraryConfig {
  organizationId: string;
  name: string;
  description: string;
  settings: {
    allowPublicAssets: boolean;
    requireApprovalForSharing: boolean;
    maxAssetSize: number; // MB
    allowedFileTypes: string[];
    autoTagging: boolean;
    versionControl: boolean;
  };
  storage: StorageTierConfig;
  cache: CacheStrategy;
  security: {
    encryption: boolean;
    auditLogging: boolean;
    accessControl: 'rbac' | 'abac';
  };
}

/**
 * Asset management events
 */
export interface AssetEvent {
  eventId: string;
  assetId: string;
  userId: string;
  type: 'created' | 'updated' | 'shared' | 'downloaded' | 'deleted' | 'versioned';
  timestamp: Date;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Asset recommendation engine
 */
export interface AssetRecommendation {
  assetId: string;
  reason: string;
  confidence: number; // 0-1
  basedOn: 'similarity' | 'usage_pattern' | 'project_context' | 'team_activity';
  metadata: {
    similarAssets?: string[];
    usagePattern?: UsagePattern;
    projectContext?: string;
    teamActivity?: string[];
  };
}

/**
 * Asset quality and validation
 */
export interface AssetValidation {
  assetId: string;
  isValid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  lastValidated: Date;
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixable: boolean;
  suggestedFix?: string;
}

export interface ValidationWarning {
  type: 'performance' | 'compatibility' | 'security' | 'quality';
  message: string;
  impact: 'low' | 'medium' | 'high';
}

export interface ValidationSuggestion {
  type: 'optimization' | 'enhancement' | 'standardization';
  message: string;
  benefit: string;
  effort: 'low' | 'medium' | 'high';
}

/**
 * Export/Import functionality
 */
export interface AssetExportOptions {
  format: 'json' | 'zip' | 'kicoreasset';
  includeThumbnails: boolean;
  includeVersions: boolean;
  includeMetadata: boolean;
  includeAnalytics: boolean;
  compression: boolean;
}

export interface AssetImportOptions {
  validateAssets: boolean;
  createVersions: boolean;
  preserveOwnership: boolean;
  mergeStrategy: 'skip' | 'replace' | 'rename' | 'merge';
}

/**
 * Asset backup and recovery
 */
export interface AssetBackup {
  backupId: string;
  userId: string;
  createdAt: Date;
  assetCount: number;
  totalSize: number;
  status: 'in_progress' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt: Date;
}

export interface AssetRecovery {
  recoveryId: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  recoveredAssets: string[];
  failedAssets: string[];
  downloadUrl?: string;
}

/**
 * Asset library statistics and reporting
 */
export interface AssetLibraryStats {
  totalAssets: number;
  totalSize: number; // MB
  totalUsers: number;
  totalOrganizations: number;
  storageBreakdown: {
    local: number;
    user: number;
    shared: number;
  };
  usageBreakdown: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  topAssets: {
    assetId: string;
    name: string;
    usageCount: number;
  }[];
  topUsers: {
    userId: string;
    name: string;
    assetCount: number;
  }[];
  recentActivity: AssetEvent[];
}

/**
 * Asset library health monitoring
 */
export interface AssetLibraryHealth {
  status: 'healthy' | 'warning' | 'critical';
  metrics: {
    storageUtilization: number; // 0-1
    cacheHitRate: number; // 0-1
    averageLoadTime: number; // ms
    errorRate: number; // 0-1
    userSatisfaction: number; // 0-1
  };
  alerts: HealthAlert[];
  recommendations: HealthRecommendation[];
  lastChecked: Date;
}

export interface HealthAlert {
  type: 'storage' | 'performance' | 'security' | 'reliability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface HealthRecommendation {
  type: 'optimization' | 'scaling' | 'maintenance' | 'security';
  priority: 'low' | 'medium' | 'high';
  message: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  cost: 'free' | 'low' | 'medium' | 'high';
}
