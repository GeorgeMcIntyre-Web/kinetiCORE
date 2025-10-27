/**
 * Asset Library Type Definitions
 * Owner: George
 *
 * Type system for the modern asset library supporting multi-sector scalability
 */

/**
 * Target industry domains
 */
export type Domain =
  | 'manufacturing'
  | 'logistics'
  | 'medical'
  | 'construction'
  | 'aerospace'
  | 'research'
  | 'custom';

/**
 * Asset classification types
 */
export type AssetClass =
  | 'robots'
  | 'endEffectors'
  | 'machinery'
  | 'equipment'
  | 'buildings'
  | 'structures'
  | 'vehicles'
  | 'tools'
  | 'primitives'
  | 'custom';

/**
 * Supported file loaders
 */
export type LoaderType =
  | 'urdf'
  | 'jt'
  | 'dwg'
  | 'gltf'
  | 'glb'
  | 'step'
  | 'stl'
  | 'obj'
  | 'mjcf'
  | 'usd'
  | 'primitive'
  | 'custom';

/**
 * Asset source origins
 */
export type AssetSource = 'local' | 'cloud' | 'url' | 'generated' | 'user-imported';

/**
 * Asset origin types for provenance tracking
 * Designed to be extensible - can add more types in the future
 */
export type AssetOriginType = 'freeIssue' | 'reused' | 'purchased' | 'internal' | 'custom';

/**
 * Minimal asset origin information
 * All fields are optional to maintain flexibility
 */
export interface AssetOrigin {
  type?: AssetOriginType;
  owner?: string;           // Simple string, can be company name or ID
  supplier?: string;         // Simple string, can be company name or ID
  sourceProject?: string;    // For reused assets
  notes?: string;           // Free-form notes
  createdAt?: Date;         // When origin was set
  createdBy?: string;       // Who set the origin
}

/**
 * Simple provenance entry for tracking changes
 * Minimal structure that can be extended later
 */
export interface AssetProvenanceEntry {
  type: 'created' | 'transferred' | 'modified' | 'reused';
  projectId?: string;
  company?: string;
  notes?: string;
  timestamp: Date;
  userId: string;
}

/**
 * Bounding box dimensions (mm)
 */
export interface BoundingBox {
  length: number;
  width: number;
  height: number;
}

/**
 * Vendor/supplier information
 */
export interface VendorInfo {
  name: string;
  url?: string;
  partNumber?: string;
  price?: number;
  currency?: string;
}

/**
 * Asset capabilities - extensible per sector
 */
export interface AssetCapabilities {
  // Kinematic properties
  hasKinematics?: boolean;
  dof?: number; // Degrees of freedom
  payload?: number; // kg
  reach?: number; // mm

  // Physical properties
  dimensions?: BoundingBox;
  mass?: number; // kg
  powerRequirement?: string; // e.g., "480V 3-phase", "24VDC"

  // Medical-specific
  fda510k?: string;
  sterile?: boolean;
  biocompatible?: boolean;

  // Construction-specific
  loadCapacity?: number; // kg
  fireRating?: string;
  seismicRating?: string;

  // Manufacturing-specific
  cycleTime?: number; // seconds
  precision?: number; // mm repeatability
  repeatability?: number; // mm

  // Custom properties
  [key: string]: unknown;
}

/**
 * Core library asset metadata
 */
export interface LibraryAsset {
  // === Identity ===
  id: string; // Unique UUID
  name: string; // Display name
  manufacturer?: string; // Brand/vendor
  modelNumber?: string; // SKU/part number
  version?: string; // Model version

  // === Classification ===
  domain: Domain;
  assetClass: AssetClass;
  assetType: string; // Specific subtype (e.g., "industrial-6axis")

  // === Technical ===
  loaderType: LoaderType;
  filePath: string; // Relative path from library root
  fileUrl?: string; // Full URL to file
  fileSize?: number; // MB
  checksum?: string; // SHA-256 hash
  metadata?: Record<string, unknown>; // Additional metadata
  meshFiles?: string[]; // Array of mesh file URLs

  // === Capabilities ===
  capabilities?: AssetCapabilities;

  // === Discovery & Search ===
  tags: string[]; // ["conveyor", "belt-driven", "24vdc"]
  searchKeywords: string[]; // Additional search terms
  description?: string; // Brief description

  // === Visual & Documentation ===
  thumbnail?: string; // Relative path to thumbnail image
  thumbnailUrl?: string; // Or CDN URL
  documentationUrl?: string;
  specSheetUrl?: string;

  // === Sourcing ===
  source: AssetSource;
  vendor?: VendorInfo;

  // === Asset Origin (Optional) ===
  // Completely optional - existing assets work without any changes
  origin?: AssetOrigin;
  provenanceHistory?: AssetProvenanceEntry[];

  // === Usage Tracking ===
  usageCount?: number; // Popularity metric
  lastUsed?: Date;
  isFavorite?: boolean;
  createdAt?: Date; // When asset was added to library

  // === Extensibility ===
  customMetadata?: Record<string, unknown>;
}

/**
 * Asset manifest for organizing library
 */
export interface AssetManifest {
  version: string; // Manifest version
  lastUpdated: string; // ISO date string
  totalAssets: number;
  assets: LibraryAsset[];
}

/**
 * Domain-level manifest
 */
export interface DomainManifest {
  domain: Domain;
  name: string; // Display name
  assetCount: number;
  assetClasses: AssetClassManifest[];
}

/**
 * Asset class manifest
 */
export interface AssetClassManifest {
  id: AssetClass;
  name: string; // Display name
  assetCount: number;
  manifestPath: string; // Path to detailed manifest
}

/**
 * Root library manifest
 */
export interface LibraryManifest {
  version: string;
  lastUpdated: string;
  totalAssets: number;
  domains: {
    id: Domain;
    name: string;
    assetCount: number;
    manifestPath: string;
  }[];
}

/**
 * Search filter options
 */
export interface LibraryFilters {
  domains?: Domain[];
  assetClasses?: AssetClass[];
  assetTypes?: string[];
  manufacturers?: string[];
  tags?: string[];
  hasKinematics?: boolean;

  // Asset Origin Filters (Optional)
  originTypes?: AssetOriginType[];
  owners?: string[];
  suppliers?: string[];

  // Numeric range filters
  dofRange?: [number, number];
  payloadRange?: [number, number]; // kg
  reachRange?: [number, number]; // mm
  priceRange?: [number, number];

  // Text search
  searchQuery?: string;

  // Sorting
  sortBy?: 'name' | 'manufacturer' | 'usageCount' | 'lastUsed';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  asset: LibraryAsset;
  score: number; // Relevance score 0-1
  matchedFields: string[]; // Which fields matched the search
}

/**
 * Asset insertion configuration
 */
export interface AssetInsertionConfig {
  name?: string; // Override default name
  position?: { x: number; y: number; z: number }; // Custom position
  placement?: 'origin' | 'floor' | 'cursor' | 'custom';
  enablePhysics?: boolean;
  loadKinematics?: boolean;
  loadPMI?: boolean; // For JT files
  targetLOD?: number; // For JT files
}

/**
 * Parametric asset definition
 */
export interface ParametricAsset extends LibraryAsset {
  parameters: {
    [key: string]: {
      min: number;
      max: number;
      default: number;
      unit?: string;
    };
  };
}

/**
 * Asset plugin interface for extensibility
 */
export interface AssetSourcePlugin {
  id: string;
  name: string;
  search(query: string, filters?: LibraryFilters): Promise<LibraryAsset[]>;
  download?(asset: LibraryAsset): Promise<File>;
  authenticate?(): Promise<void>;
}

// === Cloud Asset Storage Types ===

/**
 * Asset package metadata for cloud storage
 */
export interface AssetPackageMetadata {
  // Identity
  id: string; // e.g., "mujoco-menagerie/franka_emika_panda"
  version: string; // Semantic version: "1.0.0"
  name: string;

  // Classification
  domain: Domain;
  assetClass: AssetClass;
  assetType: string;

  // Metadata
  manufacturer?: string;
  description?: string;
  license?: {
    type: string; // "BSD-3-Clause", "MIT", etc.
    file?: string; // "LICENSE"
    url?: string;
  };

  // Capabilities
  capabilities?: AssetCapabilities;

  // Files in package
  files: {
    mainModel: string; // "panda.xml", "robot.urdf"
    scene?: string; // "scene.xml"
    thumbnail?: string;
    meshes: string[]; // ["assets/link0.stl", ...]
    textures?: string[];
    documentation?: string; // "README.md"
    changelog?: string; // "CHANGELOG.md"
  };

  // Package info
  packageSize: number; // bytes
  uploadedAt: string; // ISO 8601
  uploadedBy?: string; // user ID or "system"
  checksum: string; // SHA-256

  // Search
  tags: string[];
  searchKeywords: string[];

  // Usage tracking
  downloadCount?: number;
  usageCount?: number;

  // Versioning
  changelog?: string; // Changelog text
  previousVersion?: string; // "0.9.0"
}

/**
 * Global manifest for cloud asset catalog
 */
export interface CloudManifest {
  version: string; // Manifest schema version
  lastUpdated: string; // ISO 8601

  // Asset index
  assets: {
    id: string; // "mujoco-menagerie/franka_emika_panda"
    latestVersion: string; // "1.1.0"
    versions: string[]; // ["1.0.0", "1.1.0"]
    metadataUrl: string; // URL to latest metadata.json
  }[];

  // Domain structure
  domains: {
    id: Domain;
    name: string;
    assetCount: number;
    manifestPath: string;
  }[];

  // Statistics
  stats: {
    totalAssets: number;
    totalPackages: number;
    totalSize: number; // bytes
    manufacturers: string[];
  };
}

/**
 * Asset download response from API
 */
export interface AssetDownloadResponse {
  assetId: string;
  version: string;
  files: {
    path: string; // Relative path in package
    url: string; // CDN URL
    size: number;
    checksum: string;
  }[];
  bundleUrl?: string; // .tar.gz download (optional)
  expiresAt: string; // Signed URL expiration
}

/**
 * Asset search request to API
 */
export interface AssetSearchRequest {
  query?: string;
  domain?: string[];
  assetClass?: string[];
  manufacturer?: string[];
  tags?: string[];
  minDof?: number;
  maxDof?: number;
  sortBy?: 'name' | 'downloads' | 'updated';
  limit?: number; // Default: 50, max: 200
  offset?: number;
}

/**
 * Asset search response from API
 */
export interface AssetSearchResponse {
  assets: AssetPackageMetadata[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Upload initiation request
 */
export interface InitiateUploadRequest {
  assetId: string; // "custom/my_robot"
  version: string; // "1.0.0"
  metadata: Partial<AssetPackageMetadata>;
}

/**
 * Upload initiation response
 */
export interface InitiateUploadResponse {
  uploadId: string; // Unique upload session ID
  uploadUrls: Record<string, string>; // File path -> presigned URL
  expiresAt: string; // Upload expiration
}

/**
 * Upload completion request
 */
export interface CompleteUploadRequest {
  uploadId: string;
  files: string[]; // Uploaded file keys
}

/**
 * Validation report
 */
export interface ValidationReport {
  status: 'success' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  thumbnailGenerated: boolean;
  checksumVerified: boolean;
}

/**
 * Upload completion response
 */
export interface CompleteUploadResponse {
  status: 'validating' | 'published' | 'failed';
  assetId: string;
  version: string;
  validationReport?: ValidationReport;
}

/**
 * Cached asset package in IndexedDB
 */
export interface CachedAssetPackage {
  assetId: string;
  version: string;
  metadata: AssetPackageMetadata;
  files: Map<string, ArrayBuffer>; // File path -> file data
  cachedAt: number; // timestamp
  lastAccessed: number; // timestamp
  size: number; // total bytes
}

/**
 * Cloud asset loader configuration
 */
export interface CloudAssetConfig {
  apiBaseUrl: string; // "https://api.kineticore.io/v1"
  cdnBaseUrl: string; // "https://assets.kineticore.io"
  enableCache: boolean;
  maxCacheSize: number; // bytes
  cacheTTL: number; // milliseconds
  enableFallback: boolean; // Fallback to local assets
}

/**
 * Asset loader source type
 */
export type AssetLoaderSource = 'cloud' | 'local' | 'cache';

/**
 * Asset load progress event
 */
export interface AssetLoadProgress {
  assetId: string;
  version: string;
  phase: 'downloading' | 'parsing' | 'caching' | 'complete';
  filesTotal: number;
  filesLoaded: number;
  bytesTotal: number;
  bytesLoaded: number;
  progress: number; // 0-100
  source: AssetLoaderSource;
}
