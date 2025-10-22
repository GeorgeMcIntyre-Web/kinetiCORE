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
  | 'primitives';

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
  | 'primitive';

/**
 * Asset source origins
 */
export type AssetSource = 'local' | 'cloud' | 'url' | 'generated';

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
  fileSize?: number; // MB

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
