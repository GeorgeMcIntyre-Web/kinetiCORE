/**
 * Cloudflare Worker for Supabase Proxy
 * File: src/index.ts
 * Owner: George
 * 
 * This worker acts as a proxy to Supabase, adding Cloudflare's edge benefits
 * while maintaining full Supabase functionality.
 */

import { createClient } from '@supabase/supabase-js'

export interface Env {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  R2_ASSETS: R2Bucket  // Asset storage bucket
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS()
    }

    try {
      // Initialize Supabase client
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false, // We'll handle sessions in the worker
          autoRefreshToken: false
        }
      })

      // Parse the request
      const url = new URL(request.url)
      const path = url.pathname

      // Route requests to appropriate endpoints
      if (path.startsWith('/assets/')) {
        // R2 asset storage (files, meshes, textures)
        return await handleR2Assets(request, env, ctx)
      } else if (path.startsWith('/auth/')) {
        return await handleAuth(request, supabase, env)
      } else if (path.startsWith('/rest/')) {
        return await handleRest(request, supabase, env)
      } else if (path.startsWith('/storage/')) {
        return await handleStorage(request, supabase, env)
      } else if (path.startsWith('/realtime/')) {
        return await handleRealtime(request, supabase, env)
      } else if (path.startsWith('/functions/')) {
        return await handleFunctions(request, supabase, env)
      }

      // Default response
      return new Response('Supabase Proxy Worker - kinetiCORE Asset Library', { 
        status: 200,
        headers: getCORSHeaders()
      })

    } catch (error) {
      console.error('Worker error:', error)
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 
          ...getCORSHeaders(),
          'Content-Type': 'application/json' 
        }
      })
    }
  }
}

/**
 * Handle authentication requests
 */
async function handleAuth(request: Request, supabase: any, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url)
    // Remove '/auth' from the path, keeping 'v1/signup' etc.
    const pathAndQuery = `${url.pathname}${url.search}`
    
    // Forward auth requests to Supabase
    const supabaseUrl = `${env.SUPABASE_URL}${pathAndQuery}`
    console.log('Auth request:', { path: pathAndQuery, supabaseUrl })
    
    const modifiedRequest = new Request(supabaseUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        'apikey': env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: request.body
    })

    const response = await fetch(modifiedRequest)
    
    // Handle response properly
    let data
    const contentType = response.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError)
        return new Response(JSON.stringify({ 
          error: 'Invalid JSON response from Supabase',
          message: 'Failed to parse JSON response'
        }), {
          status: 500,
          headers: {
            ...getCORSHeaders(),
            'Content-Type': 'application/json'
          }
        })
      }
    } else {
      // If response is not JSON, try to get text and return as error
      const textResponse = await response.text()
      console.error('Non-JSON response from Supabase:', textResponse)
      return new Response(JSON.stringify({ 
        error: 'Invalid response from Supabase',
        message: `Server returned ${contentType || 'unknown content type'}`,
        details: textResponse.substring(0, 200) // Limit details length
      }), {
        status: response.status || 500,
        headers: {
          ...getCORSHeaders(),
          'Content-Type': 'application/json'
        }
      })
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...getCORSHeaders(),
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Auth handler error:', error)
    return new Response(JSON.stringify({ 
      error: 'Authentication request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...getCORSHeaders(),
        'Content-Type': 'application/json'
      }
    })
  }
}

/**
 * Handle REST API requests
 */
async function handleRest(request: Request, supabase: any, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace('/rest/', '')

  // Extract JWT token from Authorization header
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  // Set auth token if provided
  if (token) {
    supabase.auth.setAuth(token)
  }

  // Forward REST requests to Supabase
  const supabaseUrl = `${env.SUPABASE_URL}/rest/v1/${path}`
  const modifiedRequest = new Request(supabaseUrl, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers),
      'Authorization': `Bearer ${token || env.SUPABASE_ANON_KEY}`,
      'apikey': env.SUPABASE_ANON_KEY
    },
    body: request.body
  })

  const response = await fetch(modifiedRequest)
  const data = await response.json()

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: {
      ...getCORSHeaders(),
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Handle storage requests
 */
async function handleStorage(request: Request, supabase: any, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace('/storage/', '')

  // Forward storage requests to Supabase
  const supabaseUrl = `${env.SUPABASE_URL}/storage/v1/${path}`
  const modifiedRequest = new Request(supabaseUrl, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers),
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'apikey': env.SUPABASE_ANON_KEY
    },
    body: request.body
  })

  const response = await fetch(modifiedRequest)
  
  // Handle file uploads/downloads
  if (request.method === 'GET' && response.headers.get('content-type')?.startsWith('application/')) {
    return response
  }

  const data = await response.json()
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: {
      ...getCORSHeaders(),
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Handle realtime requests
 */
async function handleRealtime(_request: Request, _supabase: any, _env: Env): Promise<Response> {
  // For realtime, we'll need to implement WebSocket proxying
  // This is more complex and might require a different approach
  return new Response(JSON.stringify({ 
    message: 'Realtime proxying not implemented yet' 
  }), {
    status: 501,
    headers: {
      ...getCORSHeaders(),
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Handle edge functions
 */
async function handleFunctions(request: Request, supabase: any, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace('/functions/', '')

  // Forward function requests to Supabase
  const supabaseUrl = `${env.SUPABASE_URL}/functions/v1/${path}`
  const modifiedRequest = new Request(supabaseUrl, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers),
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'apikey': env.SUPABASE_ANON_KEY
    },
    body: request.body
  })

  const response = await fetch(modifiedRequest)
  const data = await response.json()

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: {
      ...getCORSHeaders(),
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Handle CORS preflight requests
 */
function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders()
  })
}

/**
 * Get CORS headers
 */
function getCORSHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-supabase-api-version, x-client-info, x-supabase-client',
    'Access-Control-Max-Age': '86400'
  }
}

/**
 * Handle R2 asset storage (files, meshes, textures)
 */
async function handleR2Assets(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url)
  // Path and query extracted from URL
  
  // Upload file to R2
  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      const contentType = request.headers.get('content-type') || 'application/octet-stream'
      
      // Handle multipart form data
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData()
        const file = formData.get('file') as File
        
        if (!file) {
          return new Response(JSON.stringify({ 
            error: 'No file provided' 
          }), {
            status: 400,
            headers: {
              ...getCORSHeaders(),
              'Content-Type': 'application/json'
            }
          })
        }
        
        // Upload to R2
        await env.R2_ASSETS.put(path, file.stream(), {
          httpMetadata: {
            contentType: file.type,
          },
          customMetadata: {
            uploadedAt: new Date().toISOString(),
            originalName: file.name,
          }
        })
        
        // Return URL
        const assetUrl = `${url.origin}/assets/${path}`
        
        return new Response(JSON.stringify({
          success: true,
          url: assetUrl,
          path: path,
          size: file.size,
          contentType: file.type
        }), {
          status: 200,
          headers: {
            ...getCORSHeaders(),
            'Content-Type': 'application/json'
          }
        })
      } 
      // Handle direct binary upload
      else {
        await env.R2_ASSETS.put(path, request.body, {
          httpMetadata: {
            contentType: contentType,
          },
          customMetadata: {
            uploadedAt: new Date().toISOString(),
          }
        })
        
        const assetUrl = `${url.origin}/assets/${path}`
        
        return new Response(JSON.stringify({
          success: true,
          url: assetUrl,
          path: path
        }), {
          status: 200,
          headers: {
            ...getCORSHeaders(),
            'Content-Type': 'application/json'
          }
        })
      }
    } catch (error) {
      console.error('R2 upload error:', error)
      return new Response(JSON.stringify({ 
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: {
          ...getCORSHeaders(),
          'Content-Type': 'application/json'
        }
      })
    }
  }
  
  // Download file from R2
  if (request.method === 'GET') {
    try {
      const object = await env.R2_ASSETS.get(path)
      
      if (!object) {
        return new Response(JSON.stringify({ 
          error: 'Asset not found',
          path: path
        }), { 
          status: 404,
          headers: {
            ...getCORSHeaders(),
            'Content-Type': 'application/json'
          }
        })
      }
      
      // Get ETag for caching
      const etag = object.etag
      const ifNoneMatch = request.headers.get('if-none-match')
      
      // Return 304 if not modified
      if (ifNoneMatch === etag) {
        return new Response(null, {
          status: 304,
          headers: getCORSHeaders()
        })
      }
      
      // Return file with caching headers
      return new Response(object.body, {
        headers: {
          ...getCORSHeaders(),
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
          'ETag': etag,
          'Content-Length': object.size.toString(),
        }
      })
    } catch (error) {
      console.error('R2 download error:', error)
      return new Response(JSON.stringify({ 
        error: 'Download failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: {
          ...getCORSHeaders(),
          'Content-Type': 'application/json'
        }
      })
    }
  }
  
  // Delete file from R2
  if (request.method === 'DELETE') {
    try {
      await env.R2_ASSETS.delete(path)
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Asset deleted',
        path: path
      }), {
        status: 200,
        headers: {
          ...getCORSHeaders(),
          'Content-Type': 'application/json'
        }
      })
    } catch (error) {
      console.error('R2 delete error:', error)
      return new Response(JSON.stringify({ 
        error: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: {
          ...getCORSHeaders(),
          'Content-Type': 'application/json'
        }
      })
    }
  }
  
  // List files (optional - for debugging)
  if (request.method === 'HEAD') {
    try {
      const object = await env.R2_ASSETS.head(path)
      
      if (!object) {
        return new Response(null, { 
          status: 404,
          headers: getCORSHeaders()
        })
      }
      
      return new Response(null, {
        status: 200,
        headers: {
          ...getCORSHeaders(),
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Length': object.size.toString(),
          'ETag': object.etag,
        }
      })
    } catch (error) {
      return new Response(null, {
        status: 500,
        headers: getCORSHeaders()
      })
    }
  }
  
  return new Response(JSON.stringify({ 
    error: 'Method not allowed' 
  }), { 
    status: 405,
    headers: {
      ...getCORSHeaders(),
      'Content-Type': 'application/json'
    }
  })
}