# Cloudflare Supabase Setup Guide
# File: cloudflare/SETUP.md
# Owner: George

# Cloudflare Supabase Integration Setup

This guide will help you set up Supabase with Cloudflare Workers for optimal performance and global distribution.

## Prerequisites

- Cloudflare account with Workers enabled
- Supabase account and project
- Wrangler CLI installed (`npm install -g wrangler`)
- Node.js and npm

## Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Note down:
   - Project URL (e.g., `https://your-project.supabase.co`)
   - Anon key (public key)
   - Service role key (secret key)

## Step 2: Set Up Cloudflare Worker

1. **Create the worker:**
   ```bash
   cd cloudflare
   wrangler init kineticore-supabase-proxy
   ```

2. **Configure wrangler.toml:**
   ```bash
   # Update the SUPABASE_URL and SUPABASE_ANON_KEY in wrangler.toml
   ```

3. **Set secrets:**
   ```bash
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   # Enter your service role key when prompted
   ```

4. **Deploy the worker:**
   ```bash
   wrangler deploy
   ```

## Step 3: Configure Custom Domain (Optional)

1. **Add custom domain in Cloudflare:**
   - Go to Workers & Pages → Custom Domains
   - Add `api.supabase.your-domain.com`

2. **Update DNS:**
   - Add CNAME record: `api.supabase` → `your-worker.your-subdomain.workers.dev`

## Step 4: Update Frontend Configuration

1. **Install Supabase client:**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Update environment variables:**
   ```bash
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://api.supabase.your-domain.com
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Update your Supabase client configuration:**
   ```typescript
   // Use the Cloudflare Worker URL instead of direct Supabase URL
   const supabaseUrl = 'https://api.supabase.your-domain.com'
   ```

## Step 5: Deploy Database Schema

1. **Run migrations:**
   ```bash
   # Using Supabase CLI
   supabase db push
   
   # Or manually run the SQL from supabase/migrations/
   ```

2. **Set up Row Level Security:**
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
   
   -- Create policies
   CREATE POLICY "Users can view their own assets" ON public.assets
     FOR SELECT USING (auth.uid() = owner_id);
   
   CREATE POLICY "Users can create assets" ON public.assets
     FOR INSERT WITH CHECK (auth.uid() = owner_id);
   
   CREATE POLICY "Users can update their own assets" ON public.assets
     FOR UPDATE USING (auth.uid() = owner_id);
   ```

## Step 6: Test the Integration

1. **Test authentication:**
   ```typescript
   import { auth } from '@/lib/supabase-client'
   
   // Test sign up
   const { data, error } = await auth.signUp('test@example.com', 'password123')
   
   // Test sign in
   const { data, error } = await auth.signIn('test@example.com', 'password123')
   ```

2. **Test database operations:**
   ```typescript
   import { db } from '@/lib/supabase-client'
   
   // Test asset creation
   const { data, error } = await db.createAsset({
     name: 'Test Asset',
     description: 'Test description',
     domain: 'general',
     asset_class: 'structures',
     asset_type: 'generic',
     loader_type: 'glb',
     file_path: '/test/asset.glb',
     file_size: 1024,
     mime_type: 'model/gltf-binary',
     checksum: 'test-checksum',
     owner_id: 'user-id'
   })
   ```

## Step 7: Configure Authentication Providers

1. **Enable Google OAuth:**
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable Google provider
   - Add OAuth credentials

2. **Configure redirect URLs:**
   - Add `https://api.supabase.your-domain.com/auth/v1/callback` to allowed redirect URLs

## Step 8: Set Up Storage Buckets

1. **Create storage buckets:**
   ```sql
   -- These are already in the migration file
   INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   VALUES 
     ('user-assets', 'user-assets', false, 104857600, ARRAY['application/xml', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'image/png', 'image/jpeg']),
     ('shared-assets', 'shared-assets', false, 104857600, ARRAY['application/xml', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'image/png', 'image/jpeg']),
     ('thumbnails', 'thumbnails', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']),
     ('mesh-data', 'mesh-data', false, 52428800, ARRAY['application/octet-stream', 'model/gltf-binary']);
   ```

2. **Set storage policies:**
   ```sql
   CREATE POLICY "Users can upload to user-assets" ON storage.objects
     FOR INSERT WITH CHECK (bucket_id = 'user-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
   
   CREATE POLICY "Users can view their own assets" ON storage.objects
     FOR SELECT USING (bucket_id = 'user-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

## Step 9: Deploy Edge Functions

1. **Deploy asset processor function:**
   ```bash
   # Using Supabase CLI
   supabase functions deploy asset-processor
   
   # Or manually deploy to Cloudflare Workers
   wrangler deploy --name asset-processor
   ```

## Step 10: Monitor and Optimize

1. **Set up monitoring:**
   - Cloudflare Analytics for Worker performance
   - Supabase Dashboard for database metrics
   - Custom logging for asset operations

2. **Optimize performance:**
   - Enable Cloudflare caching for static assets
   - Use KV storage for frequently accessed data
   - Implement asset CDN with R2 storage

## Troubleshooting

### Common Issues:

1. **CORS errors:**
   - Ensure CORS headers are properly set in the Worker
   - Check that the frontend URL is allowed

2. **Authentication issues:**
   - Verify JWT tokens are being passed correctly
   - Check that RLS policies are properly configured

3. **Storage upload failures:**
   - Ensure storage policies allow the operation
   - Check file size limits and allowed MIME types

4. **Real-time not working:**
   - WebSocket proxying requires additional setup
   - Consider using Supabase's real-time directly for now

### Debug Commands:

```bash
# Check Worker logs
wrangler tail kineticore-supabase-proxy

# Test Worker locally
wrangler dev

# Check Supabase logs
supabase logs
```

## Next Steps

1. **Implement real-time features** with WebSocket proxying
2. **Add caching layer** with Cloudflare KV
3. **Set up monitoring** and alerting
4. **Optimize performance** with edge caching
5. **Add security features** like rate limiting and DDoS protection

## Benefits of This Setup

- **Global Performance:** Assets served from Cloudflare's edge network
- **Cost Effective:** Pay only for what you use
- **Scalable:** Automatic scaling with Cloudflare Workers
- **Secure:** Built-in DDoS protection and WAF
- **Unified:** Everything managed through Cloudflare dashboard
- **Developer Friendly:** Easy deployment with Wrangler CLI
