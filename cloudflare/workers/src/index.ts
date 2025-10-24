/**
 * Cloudflare Workers API for kinetiCORE Cloud Assets
 * Owner: George
 *
 * Main entry point for asset API endpoints
 */

import { Router } from 'itty-router';

// Environment bindings (configured in wrangler.toml)
export interface Env {
  ASSETS_BUCKET: R2Bucket; // R2 bucket for asset storage
  ASSETS_DB: D1Database; // D1 database for metadata
  MANIFESTS_KV: KVNamespace; // KV for manifest caching
  API_KEY: string; // Secret API key for admin endpoints
}

// Create router
const router = Router();

/**
 * CORS headers for all responses
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handle CORS preflight
 */
router.options('*', () => {
  return new Response(null, { headers: corsHeaders });
});

// === Health & Version ===

router.get('/v1/health', () => {
  return jsonResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

router.get('/v1/version', () => {
  return jsonResponse({
    version: '1.0.0',
    build: 'dev',
  });
});

// === Manifest Endpoints ===

router.get('/v1/manifests/global', async (request, env: Env) => {
  try {
    // Try KV cache first
    const cached = await env.MANIFESTS_KV.get('global-manifest', 'json');
    if (cached) {
      return jsonResponse(cached, {
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 min
          'X-Cache': 'HIT',
        },
      });
    }

    // Generate manifest from D1
    const manifest = await generateGlobalManifest(env);

    // Cache in KV
    await env.MANIFESTS_KV.put('global-manifest', JSON.stringify(manifest), {
      expirationTtl: 300, // 5 min
    });

    return jsonResponse(manifest, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    return errorResponse('Failed to load manifest', 500, error);
  }
});

router.get('/v1/manifests/:domain', async (request, env: Env) => {
  const { domain } = request.params;

  try {
    // Try KV cache
    const cached = await env.MANIFESTS_KV.get(`domain-${domain}`, 'json');
    if (cached) {
      return jsonResponse(cached);
    }

    // Generate from D1
    const manifest = await generateDomainManifest(env, domain);

    // Cache
    await env.MANIFESTS_KV.put(`domain-${domain}`, JSON.stringify(manifest), {
      expirationTtl: 300,
    });

    return jsonResponse(manifest);
  } catch (error) {
    return errorResponse('Failed to load domain manifest', 500, error);
  }
});

// === Asset Search & Discovery ===

router.get('/v1/assets', async (request, env: Env) => {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const domain = url.searchParams.getAll('domain');
    const assetClass = url.searchParams.getAll('assetClass');
    const manufacturer = url.searchParams.getAll('manufacturer');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const results = await searchAssets(env, {
      query,
      domain,
      assetClass,
      manufacturer,
      limit,
      offset,
    });

    return jsonResponse(results);
  } catch (error) {
    return errorResponse('Asset search failed', 500, error);
  }
});

router.get('/v1/assets/:assetId', async (request, env: Env) => {
  const { assetId } = request.params;
  const url = new URL(request.url);
  const version = url.searchParams.get('version') || 'latest';

  try {
    const asset = await getAsset(env, decodeURIComponent(assetId), version);

    if (!asset) {
      return errorResponse('Asset not found', 404);
    }

    return jsonResponse(asset);
  } catch (error) {
    return errorResponse('Failed to get asset', 500, error);
  }
});

router.get('/v1/assets/:assetId/download', async (request, env: Env) => {
  const { assetId } = request.params;
  const url = new URL(request.url);
  const version = url.searchParams.get('version') || 'latest';

  try {
    const downloadUrls = await getDownloadUrls(env, decodeURIComponent(assetId), version);

    if (!downloadUrls) {
      return errorResponse('Asset not found', 404);
    }

    return jsonResponse(downloadUrls);
  } catch (error) {
    return errorResponse('Failed to get download URLs', 500, error);
  }
});

// === Asset Upload (Authenticated) ===

router.post('/v1/upload/initiate', requireAuth, async (request, env: Env) => {
  try {
    const body = await request.json();
    // TODO: Implement upload initiation
    return jsonResponse({
      uploadId: 'upload_' + Date.now(),
      uploadUrls: {},
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
  } catch (error) {
    return errorResponse('Failed to initiate upload', 500, error);
  }
});

// === 404 Handler ===

router.all('*', () => {
  return errorResponse('Not found', 404);
});

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await router.handle(request, env, ctx);
    } catch (error) {
      console.error('Unhandled error:', error);
      return errorResponse('Internal server error', 500, error);
    }
  },
};

// === Helper Functions ===

/**
 * JSON response helper
 */
function jsonResponse(data: any, options: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...options.headers,
    },
  });
}

/**
 * Error response helper
 */
function errorResponse(message: string, status: number = 500, details?: any): Response {
  return jsonResponse(
    {
      error: message,
      status,
      details: details instanceof Error ? details.message : details,
    },
    { status }
  );
}

/**
 * Authentication middleware
 */
function requireAuth(request: Request, env: Env): Response | void {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Unauthorized', 401);
  }

  const token = authHeader.substring(7);

  if (token !== env.API_KEY) {
    return errorResponse('Forbidden', 403);
  }

  // Auth successful, continue to handler
}

// === Database Queries ===

/**
 * Generate global manifest from D1
 */
async function generateGlobalManifest(env: Env): Promise<any> {
  // Query assets table
  const result = await env.ASSETS_DB.prepare(
    `SELECT id, name, domain, latest_version FROM assets ORDER BY name`
  ).all();

  const assets = result.results.map((row: any) => ({
    id: row.id,
    latestVersion: row.latest_version,
    versions: [row.latest_version], // Simplified
    metadataUrl: `https://assets.kineticore.io/packages/${row.id}/latest/metadata.json`,
  }));

  // Get domain stats
  const domains = await env.ASSETS_DB.prepare(
    `SELECT domain, COUNT(*) as count FROM assets GROUP BY domain`
  ).all();

  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    assets,
    domains: domains.results.map((row: any) => ({
      id: row.domain,
      name: row.domain,
      assetCount: row.count,
      manifestPath: `${row.domain}.json`,
    })),
    stats: {
      totalAssets: assets.length,
      totalPackages: assets.length,
      totalSize: 0,
      manufacturers: [],
    },
  };
}

/**
 * Generate domain-specific manifest
 */
async function generateDomainManifest(env: Env, domain: string): Promise<any> {
  const result = await env.ASSETS_DB.prepare(
    `SELECT * FROM assets WHERE domain = ? ORDER BY name`
  )
    .bind(domain)
    .all();

  return {
    domain,
    assets: result.results,
  };
}

/**
 * Search assets
 */
async function searchAssets(
  env: Env,
  params: {
    query?: string | null;
    domain?: string[];
    assetClass?: string[];
    manufacturer?: string[];
    limit: number;
    offset: number;
  }
): Promise<any> {
  let query = `SELECT * FROM assets WHERE 1=1`;
  const bindings: any[] = [];

  if (params.domain && params.domain.length > 0) {
    query += ` AND domain IN (${params.domain.map(() => '?').join(',')})`;
    bindings.push(...params.domain);
  }

  if (params.assetClass && params.assetClass.length > 0) {
    query += ` AND asset_class IN (${params.assetClass.map(() => '?').join(',')})`;
    bindings.push(...params.assetClass);
  }

  if (params.manufacturer && params.manufacturer.length > 0) {
    query += ` AND manufacturer IN (${params.manufacturer.map(() => '?').join(',')})`;
    bindings.push(...params.manufacturer);
  }

  query += ` ORDER BY name LIMIT ? OFFSET ?`;
  bindings.push(params.limit, params.offset);

  const result = await env.ASSETS_DB.prepare(query).bind(...bindings).all();

  return {
    assets: result.results,
    total: result.results.length,
    offset: params.offset,
    limit: params.limit,
  };
}

/**
 * Get asset by ID
 */
async function getAsset(env: Env, assetId: string, version: string): Promise<any> {
  const result = await env.ASSETS_DB.prepare(`SELECT * FROM assets WHERE id = ?`)
    .bind(assetId)
    .first();

  if (!result) {
    return null;
  }

  return {
    asset: result,
    versions: [result.latest_version],
  };
}

/**
 * Get download URLs for asset
 */
async function getDownloadUrls(env: Env, assetId: string, version: string): Promise<any> {
  // Get asset metadata
  const asset = await getAsset(env, assetId, version);

  if (!asset) {
    return null;
  }

  // Get version details
  const versionResult = await env.ASSETS_DB.prepare(
    `SELECT * FROM asset_versions WHERE asset_id = ? AND version = ?`
  )
    .bind(assetId, version === 'latest' ? asset.asset.latest_version : version)
    .first();

  if (!versionResult) {
    return null;
  }

  // Parse metadata JSON to get file list
  const metadata = JSON.parse(versionResult.metadata_json);
  const r2Path = versionResult.r2_path;

  // Generate CDN URLs for all files
  const files = [];

  // Add main model
  files.push({
    path: metadata.files.mainModel,
    url: `https://assets.kineticore.io/${r2Path}${metadata.files.mainModel}`,
    size: 0,
    checksum: '',
  });

  // Add all meshes
  for (const mesh of metadata.files.meshes) {
    files.push({
      path: mesh,
      url: `https://assets.kineticore.io/${r2Path}${mesh}`,
      size: 0,
      checksum: '',
    });
  }

  return {
    assetId,
    version: versionResult.version,
    files,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
  };
}
