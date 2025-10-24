/**
 * Cloud Asset Configuration
 * Owner: George
 *
 * Central configuration for cloud asset storage and delivery
 */

import type { CloudAssetConfig } from '../library/types';

/**
 * Environment-specific configuration
 */
interface EnvironmentConfig {
  apiBaseUrl: string;
  cdnBaseUrl: string;
  apiKey?: string;
}

const environments: Record<string, EnvironmentConfig> = {
  production: {
    apiBaseUrl: 'https://api.kineticore.io/v1',
    cdnBaseUrl: 'https://assets.kineticore.io',
  },
  staging: {
    apiBaseUrl: 'https://api-staging.kineticore.io/v1',
    cdnBaseUrl: 'https://assets-staging.kineticore.io',
  },
  development: {
    apiBaseUrl: 'http://localhost:8787/v1', // Local Workers dev server
    cdnBaseUrl: 'http://localhost:8787',
  },
  // For testing: Use production API but with mock data
  mock: {
    apiBaseUrl: 'https://api.kineticore.io/v1',
    cdnBaseUrl: 'https://assets.kineticore.io',
  },
};

/**
 * Get current environment
 */
function getEnvironment(): string {
  // Check for explicit override
  if (typeof window !== 'undefined') {
    const override = new URLSearchParams(window.location.search).get('cloudEnv');
    if (override && override in environments) {
      return override;
    }
  }

  // Check environment variable (Vite)
  const env = import.meta.env?.MODE || 'development';

  // Map Vite modes to our environments
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}

/**
 * Get environment-specific configuration
 */
function getEnvironmentConfig(): EnvironmentConfig {
  const env = getEnvironment();
  return environments[env] || environments.development;
}

/**
 * Default cloud asset configuration
 */
export const defaultCloudAssetConfig: CloudAssetConfig = {
  ...getEnvironmentConfig(),
  enableCache: true,
  maxCacheSize: 500 * 1024 * 1024, // 500MB
  cacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableFallback: true, // Fallback to local assets if cloud unavailable
};

/**
 * Feature flags for cloud assets
 */
export const cloudAssetFeatures = {
  enabled: true, // Master switch for cloud assets
  prefetch: true, // Prefetch popular assets on startup
  analytics: true, // Track usage analytics
  upload: false, // Enable asset upload UI (admin only)
  versioning: true, // Show version selection in UI
  offlineMode: true, // Use cached assets when offline
};

/**
 * Cache configuration
 */
export const cacheConfig = {
  maxSize: 500 * 1024 * 1024, // 500MB total cache
  maxAssetSize: 100 * 1024 * 1024, // 100MB per asset
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  evictionPolicy: 'lru' as const, // Least Recently Used
  autoCleanup: true, // Automatically clean up stale entries
  cleanupInterval: 60 * 60 * 1000, // 1 hour
};

/**
 * Prefetch configuration
 */
export const prefetchConfig = {
  enabled: true,
  onStartup: true, // Prefetch on app startup
  popularAssets: true, // Prefetch popular assets
  recentAssets: true, // Prefetch recently used assets
  maxPrefetch: 10, // Maximum number of assets to prefetch
  delayMs: 5000, // Delay after startup before prefetching (5s)
};

/**
 * Popular assets to prefetch (will be replaced by API call)
 */
export const popularAssetIds = [
  'mujoco-menagerie/franka_emika_panda',
  'mujoco-menagerie/unitree_go2',
  'mujoco-menagerie/universal_robots_ur5e',
  'mujoco-menagerie/kuka_iiwa_14',
  'mujoco-menagerie/boston_dynamics_spot',
];

/**
 * API retry configuration
 */
export const apiRetryConfig = {
  maxRetries: 3,
  retryDelayMs: 1000, // Start with 1s
  exponentialBackoff: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Download configuration
 */
export const downloadConfig = {
  parallelDownloads: 6, // Max concurrent file downloads per asset
  chunkSize: 5 * 1024 * 1024, // 5MB chunks for large files
  timeout: 60000, // 60s timeout per file
  retryFailedDownloads: true,
  maxRetries: 3,
};

/**
 * Upload configuration (for future use)
 */
export const uploadConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB per file
  maxPackageSize: 500 * 1024 * 1024, // 500MB per package
  allowedFileTypes: ['.xml', '.stl', '.obj', '.png', '.jpg', '.jpeg', '.md', '.txt'],
  chunkSize: 5 * 1024 * 1024, // 5MB chunks for multipart upload
  parallelUploads: 4,
  timeout: 120000, // 2 min per file
};

/**
 * Get configuration based on current environment
 */
export function getCloudAssetConfig(): CloudAssetConfig {
  const envConfig = getEnvironmentConfig();

  return {
    ...defaultCloudAssetConfig,
    ...envConfig,
    // Allow runtime overrides via localStorage (for testing)
    ...(typeof window !== 'undefined' && window.localStorage
      ? getLocalStorageOverrides()
      : {}),
  };
}

/**
 * Get configuration overrides from localStorage
 */
function getLocalStorageOverrides(): Partial<CloudAssetConfig> {
  try {
    const overrides = localStorage.getItem('kineticore:cloudAssetConfig');
    if (overrides) {
      return JSON.parse(overrides);
    }
  } catch (error) {
    console.warn('Failed to parse cloud asset config overrides:', error);
  }
  return {};
}

/**
 * Set configuration override in localStorage
 */
export function setCloudAssetConfigOverride(config: Partial<CloudAssetConfig>): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('kineticore:cloudAssetConfig', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save cloud asset config override:', error);
    }
  }
}

/**
 * Clear configuration overrides
 */
export function clearCloudAssetConfigOverride(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('kineticore:cloudAssetConfig');
  }
}

/**
 * Check if cloud assets are available
 */
export async function checkCloudAvailability(): Promise<boolean> {
  if (!cloudAssetFeatures.enabled) {
    return false;
  }

  const config = getCloudAssetConfig();

  try {
    const response = await fetch(`${config.apiBaseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
    return response.ok;
  } catch (error) {
    console.warn('Cloud assets unavailable:', error);
    return false;
  }
}

/**
 * Get cloud asset statistics
 */
export interface CloudAssetStats {
  totalAssets: number;
  totalSize: number;
  cacheSize: number;
  cacheUsage: number;
  cachedAssets: number;
  environment: string;
  apiAvailable: boolean;
}

/**
 * Export all configuration
 */
export const cloudAssetConfig = {
  default: defaultCloudAssetConfig,
  features: cloudAssetFeatures,
  cache: cacheConfig,
  prefetch: prefetchConfig,
  apiRetry: apiRetryConfig,
  download: downloadConfig,
  upload: uploadConfig,
  popularAssets: popularAssetIds,
  getConfig: getCloudAssetConfig,
  checkAvailability: checkCloudAvailability,
};
