/**
 * Cloud Asset API Client
 * Owner: George
 *
 * Type-safe client for Cloudflare Workers API endpoints
 */

import type {
  AssetSearchRequest,
  AssetSearchResponse,
  AssetPackageMetadata,
  CloudManifest,
  InitiateUploadRequest,
  InitiateUploadResponse,
  CompleteUploadRequest,
  CompleteUploadResponse,
  AssetDownloadResponse,
} from './types';

export interface CloudAssetAPIConfig {
  apiBaseUrl: string;
  apiKey?: string; // For authenticated endpoints
  timeout?: number; // Request timeout in ms
}

/**
 * API client for cloud asset operations
 */
export class CloudAssetAPI {
  private config: CloudAssetAPIConfig;

  constructor(config: Partial<CloudAssetAPIConfig> = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'https://api.kineticore.io/v1',
      apiKey: config.apiKey,
      timeout: config.timeout || 30000, // 30s default
    };
  }

  // === Asset Discovery ===

  /**
   * Search assets with filters
   */
  async searchAssets(request: AssetSearchRequest = {}): Promise<AssetSearchResponse> {
    const params = new URLSearchParams();

    if (request.query) params.append('query', request.query);
    if (request.domain) request.domain.forEach((d) => params.append('domain', d));
    if (request.assetClass)
      request.assetClass.forEach((c) => params.append('assetClass', c));
    if (request.manufacturer)
      request.manufacturer.forEach((m) => params.append('manufacturer', m));
    if (request.tags) request.tags.forEach((t) => params.append('tags', t));
    if (request.minDof !== undefined) params.append('minDof', request.minDof.toString());
    if (request.maxDof !== undefined) params.append('maxDof', request.maxDof.toString());
    if (request.sortBy) params.append('sortBy', request.sortBy);
    if (request.limit) params.append('limit', request.limit.toString());
    if (request.offset) params.append('offset', request.offset.toString());

    const url = `${this.config.apiBaseUrl}/assets?${params.toString()}`;
    return this.fetch<AssetSearchResponse>(url);
  }

  /**
   * Get asset details by ID
   */
  async getAsset(
    assetId: string,
    version: string = 'latest'
  ): Promise<{ asset: AssetPackageMetadata; versions: string[] }> {
    const url = `${this.config.apiBaseUrl}/assets/${encodeURIComponent(
      assetId
    )}?version=${encodeURIComponent(version)}`;
    return this.fetch<{ asset: AssetPackageMetadata; versions: string[] }>(url);
  }

  /**
   * Get all versions of an asset
   */
  async getAssetVersions(
    assetId: string
  ): Promise<
    Array<{
      version: string;
      uploadedAt: string;
      status: string;
      downloadCount: number;
    }>
  > {
    const url = `${this.config.apiBaseUrl}/assets/${encodeURIComponent(assetId)}/versions`;
    const response = await this.fetch<{ versions: any[] }>(url);
    return response.versions;
  }

  /**
   * Get global manifest
   */
  async getGlobalManifest(): Promise<CloudManifest> {
    const url = `${this.config.apiBaseUrl}/manifests/global`;
    return this.fetch<CloudManifest>(url);
  }

  /**
   * Get domain-specific manifest
   */
  async getDomainManifest(domain: string): Promise<{ assets: AssetPackageMetadata[] }> {
    const url = `${this.config.apiBaseUrl}/manifests/${domain}`;
    return this.fetch<{ assets: AssetPackageMetadata[] }>(url);
  }

  // === Asset Download ===

  /**
   * Get download URLs for an asset
   */
  async getDownloadUrls(
    assetId: string,
    version: string = 'latest'
  ): Promise<AssetDownloadResponse> {
    const url = `${this.config.apiBaseUrl}/assets/${encodeURIComponent(
      assetId
    )}/download?version=${encodeURIComponent(version)}`;
    return this.fetch<AssetDownloadResponse>(url);
  }

  // === Asset Upload (Authenticated) ===

  /**
   * Initiate multi-part upload
   */
  async initiateUpload(request: InitiateUploadRequest): Promise<InitiateUploadResponse> {
    const url = `${this.config.apiBaseUrl}/upload/initiate`;
    return this.fetch<InitiateUploadResponse>(url, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Complete upload and trigger validation
   */
  async completeUpload(request: CompleteUploadRequest): Promise<CompleteUploadResponse> {
    const url = `${this.config.apiBaseUrl}/upload/${request.uploadId}/complete`;
    return this.fetch<CompleteUploadResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ files: request.files }),
    });
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string): Promise<{
    uploadId: string;
    status: 'uploading' | 'validating' | 'published' | 'failed';
    progress: number;
    errors?: string[];
    warnings?: string[];
  }> {
    const url = `${this.config.apiBaseUrl}/upload/${uploadId}/status`;
    return this.fetch(url);
  }

  /**
   * Cancel upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    const url = `${this.config.apiBaseUrl}/upload/${uploadId}/cancel`;
    await this.fetch(url, { method: 'POST' });
  }

  // === Asset Management (Authenticated) ===

  /**
   * Deprecate an asset version
   */
  async deprecateVersion(
    assetId: string,
    version: string,
    reason: string,
    replacedBy?: string
  ): Promise<void> {
    const url = `${this.config.apiBaseUrl}/assets/${encodeURIComponent(
      assetId
    )}/versions/${encodeURIComponent(version)}/deprecate`;
    await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ reason, replacedBy }),
    });
  }

  /**
   * Delete an asset version (admin only)
   */
  async deleteVersion(assetId: string, version: string): Promise<void> {
    const url = `${this.config.apiBaseUrl}/assets/${encodeURIComponent(
      assetId
    )}/versions/${encodeURIComponent(version)}`;
    await this.fetch(url, { method: 'DELETE' });
  }

  // === Analytics ===

  /**
   * Track asset download
   */
  async trackDownload(assetId: string, version: string): Promise<void> {
    const url = `${this.config.apiBaseUrl}/analytics/download`;
    await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ assetId, version, timestamp: new Date().toISOString() }),
    });
  }

  /**
   * Track asset instantiation
   */
  async trackInstantiate(assetId: string, version: string): Promise<void> {
    const url = `${this.config.apiBaseUrl}/analytics/instantiate`;
    await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ assetId, version, timestamp: new Date().toISOString() }),
    });
  }

  /**
   * Get popular assets
   */
  async getPopularAssets(limit: number = 20): Promise<AssetPackageMetadata[]> {
    const url = `${this.config.apiBaseUrl}/analytics/popular?limit=${limit}`;
    const response = await this.fetch<{ assets: AssetPackageMetadata[] }>(url);
    return response.assets;
  }

  // === Utilities ===

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; timestamp: string }> {
    const url = `${this.config.apiBaseUrl}/health`;
    return this.fetch(url);
  }

  /**
   * Get API version
   */
  async getVersion(): Promise<{ version: string; build: string }> {
    const url = `${this.config.apiBaseUrl}/version`;
    return this.fetch(url);
  }

  // === Private Methods ===

  /**
   * Generic fetch wrapper with auth and error handling
   */
  private async fetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add API key if configured
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new CloudAssetAPIError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorText
        );
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof CloudAssetAPIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new CloudAssetAPIError('Request timeout', 408, 'Request exceeded timeout');
        }
        throw new CloudAssetAPIError(`Network error: ${error.message}`, 0, error.message);
      }

      throw new CloudAssetAPIError('Unknown error', 0, 'An unknown error occurred');
    }
  }
}

/**
 * Custom error class for API errors
 */
export class CloudAssetAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: string
  ) {
    super(message);
    this.name = 'CloudAssetAPIError';
  }
}

/**
 * Singleton instance for convenience
 */
let apiInstance: CloudAssetAPI | null = null;

export function getCloudAssetAPI(config?: Partial<CloudAssetAPIConfig>): CloudAssetAPI {
  if (!apiInstance) {
    apiInstance = new CloudAssetAPI(config);
  }
  return apiInstance;
}

export function setCloudAssetAPI(api: CloudAssetAPI): void {
  apiInstance = api;
}
