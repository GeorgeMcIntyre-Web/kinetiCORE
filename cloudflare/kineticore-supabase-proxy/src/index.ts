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
      const method = request.method

      // Route requests to appropriate Supabase endpoints
      if (path.startsWith('/auth/')) {
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
    const path = url.pathname.replace('/auth', '')
    
    // Forward auth requests to Supabase
    const supabaseUrl = `${env.SUPABASE_URL}/auth${path}`
    console.log('Auth request:', { originalPath: url.pathname, newPath: path, supabaseUrl })
    
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
async function handleRealtime(request: Request, supabase: any, env: Env): Promise<Response> {
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