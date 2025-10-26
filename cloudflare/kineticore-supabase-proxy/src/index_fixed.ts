/**
 * FIXED: Auth handler - preserve full path including query params
 */
async function handleAuth(request: Request, supabase: any, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url)
    // Keep full path including /auth - client sends /auth/v1/token
    const pathAndQuery = `${url.pathname}${url.search}`
    
    // Forward auth requests to Supabase with full path
    const supabaseUrl = `${env.SUPABASE_URL}${pathAndQuery}`
    console.log('Auth request:', { 
      originalUrl: request.url, 
      pathAndQuery, 
      supabaseUrl 
    })
    
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
