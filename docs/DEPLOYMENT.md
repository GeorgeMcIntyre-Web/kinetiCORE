# kinetiCORE Deployment Guide
**Full-Stack Cloudflare Pages Deployment with Supabase Authentication**

## Overview

This guide covers deploying kinetiCORE to Cloudflare Pages with:
- ✅ Best-in-class asset compression (Brotli, Terser)
- ✅ Supabase authentication and storage
- ✅ Custom domain (kinetic-core.com)
- ✅ Optimized caching strategy
- ✅ World saving system with cloud storage
- ✅ Asset library with CDN delivery

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Build Configuration](#build-configuration)
4. [Cloudflare Pages Deployment](#cloudflare-pages-deployment)
5. [Custom Domain Setup](#custom-domain-setup)
6. [Supabase Configuration](#supabase-configuration)
7. [Testing & Verification](#testing--verification)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Cloudflare account (free tier works)
- Supabase account (free tier works)
- Custom domain (optional, but recommended)
- Git repository connected to GitHub

## Environment Setup

### 1. Create `.env` file

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your actual values:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://nhkusjsounzwkmevjsgl.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_CLOUDFLARE_WORKER_URL=https://kineticore-supabase-proxy.fractalnexustech.workers.dev

# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=99a4abb2620e21383c0710dacf97180e
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
```

## Build Configuration

### Asset Optimization

The project uses advanced Vite build configuration for optimal performance:

**Features:**
- **Terser minification** with 2-pass compression
- **Smart code splitting** by vendor (React, Babylon.js, Physics, Supabase)
- **Asset organization** by type (images, fonts, wasm, JS)
- **Console removal** in production builds
- **Long-term caching** with content hashing
- **CSS code splitting** for faster initial load

**Build process:**
```bash
npm run build
```

Expected output structure:
```
dist/
├── index.html
├── assets/
│   ├── js/
│   │   ├── index-[hash].js          # Main entry
│   │   ├── vendor-react-[hash].js   # React bundle
│   │   ├── vendor-babylon-core-[hash].js
│   │   ├── vendor-physics-[hash].js
│   │   └── vendor-supabase-[hash].js
│   ├── images/
│   ├── fonts/
│   └── wasm/
└── _headers                         # Cloudflare caching rules
```

### Compression Strategy

Cloudflare Pages automatically applies:
- **Brotli compression** (up to 25% better than Gzip)
- **Gzip fallback** for older browsers
- **Smart compression** based on file type and size

## Cloudflare Pages Deployment

### Method 1: GitHub Integration (Recommended)

1. **Connect Repository to Cloudflare Pages**
   - Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com/pages)
   - Click "Create a project"
   - Connect your GitHub account
   - Select `kinetiCORE` repository

2. **Configure Build Settings**
   ```
   Build command: npm run build
   Build output directory: dist
   Root directory: /
   Environment variables: (see below)
   ```

3. **Add Environment Variables**
   In Cloudflare Pages dashboard > Settings > Environment variables:
   ```
   VITE_SUPABASE_URL=https://nhkusjsounzwkmevjsgl.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_CLOUDFLARE_WORKER_URL=your_worker_url
   NODE_ENV=production
   ```

4. **Deploy**
   - Push to `main` branch
   - Cloudflare automatically builds and deploys
   - Every PR gets a preview URL

### Method 2: Direct Upload (Wrangler CLI)

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   npx wrangler login
   ```

3. **Build and Deploy**
   ```bash
   # Preview deployment
   npm run deploy:preview

   # Production deployment
   npm run deploy:production
   ```

## Custom Domain Setup

### Configure kinetic-core.com

1. **Add Custom Domain in Cloudflare Pages**
   - Go to your Pages project
   - Click "Custom domains"
   - Add `kinetic-core.com`
   - Add `www.kinetic-core.com` (will redirect to main)

2. **DNS Configuration**

   If domain is already in Cloudflare:
   ```
   Type: CNAME
   Name: kinetic-core.com
   Target: kineticore.pages.dev
   Proxy: Enabled (orange cloud)
   ```

   If domain is external:
   - Update nameservers to Cloudflare's
   - Wait for DNS propagation (up to 24 hours)

3. **Enable HTTPS**
   - Cloudflare automatically provisions SSL certificate
   - Force HTTPS redirect enabled by default

### Verify Custom Domain

```bash
# Check DNS resolution
nslookup kinetic-core.com

# Check HTTPS
curl -I https://kinetic-core.com
```

## Supabase Configuration

### 1. Database Setup

Your Supabase project already has these tables:
- `assets` - Asset library storage
- `worlds` - World save data
- `auth.users` - User accounts

### 2. Storage Buckets

Create storage buckets in Supabase dashboard:

```sql
-- Assets bucket (for 3D models, textures)
CREATE BUCKET assets
  WITH public = false
  FILE_SIZE_LIMIT = 50MB
  ALLOWED_MIME_TYPES = array['model/*', 'image/*', 'application/*'];

-- Worlds bucket (for saved scenes)
CREATE BUCKET worlds
  WITH public = false
  FILE_SIZE_LIMIT = 100MB
  ALLOWED_MIME_TYPES = array['application/json', 'application/octet-stream'];
```

### 3. Row Level Security (RLS)

Enable RLS policies:

```sql
-- Users can only read/write their own assets
CREATE POLICY "Users can manage their own assets"
ON assets
FOR ALL
USING (auth.uid() = owner_id);

-- Users can only read/write their own worlds
CREATE POLICY "Users can manage their own worlds"
ON worlds
FOR ALL
USING (auth.uid() = owner_id);
```

### 4. Authentication Settings

In Supabase dashboard > Authentication > Settings:

**Site URL:** `https://kinetic-core.com`

**Redirect URLs:**
```
https://kinetic-core.com/auth/callback
https://kineticore.pages.dev/auth/callback
http://localhost:5173/auth/callback
```

## Testing & Verification

### Local Production Build Test

```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview

# Open http://localhost:4173
```

### Performance Checklist

- [ ] **Lighthouse Score**
  - Performance: > 90
  - Accessibility: > 90
  - Best Practices: > 90
  - SEO: > 90

- [ ] **Bundle Size**
  - Main JS chunk: < 500KB (gzipped)
  - Vendor chunks: < 1MB each (gzipped)
  - Total initial load: < 2MB (gzipped)

- [ ] **Caching**
  - Verify `Cache-Control` headers in Network tab
  - Assets served from Cloudflare CDN
  - Brotli compression enabled

- [ ] **Functionality**
  - [ ] User authentication works
  - [ ] Asset upload to Supabase storage
  - [ ] World save/load functionality
  - [ ] 3D scene rendering
  - [ ] Physics simulation

### Browser Testing

Test in multiple browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Deployment Workflow

### Daily Development

```bash
# Feature branch workflow
git checkout -b feature/your-feature
# Make changes
npm run type-check  # Fix TypeScript errors
npm run lint        # Fix ESLint errors
npm test            # Run tests
git commit -m "feat: your feature"
git push origin feature/your-feature

# Create PR - gets automatic preview deployment
# After PR approval, merge to main
# Main branch auto-deploys to production
```

### Production Deployment

```bash
# Ensure all checks pass locally
npm run lint && npm run type-check && npm test && npm run build

# Push to main (if using GitHub integration)
git push origin main

# Or deploy directly with Wrangler
npm run deploy:production
```

## Troubleshooting

### Issue: Custom domain not working

**Symptoms:** `kinetic-core.com` shows "Not Found" or doesn't load

**Solutions:**
1. Check DNS propagation: `nslookup kinetic-core.com`
2. Verify CNAME record points to `kineticore.pages.dev`
3. Enable "Proxy" (orange cloud) in Cloudflare DNS
4. Wait up to 24 hours for global DNS propagation

### Issue: Build fails in Cloudflare

**Symptoms:** Build step fails with errors

**Solutions:**
1. Check Node version in Cloudflare settings (must be >= 18)
2. Verify all environment variables are set
3. Check build logs for specific errors
4. Test build locally: `npm run build`

### Issue: Supabase authentication fails

**Symptoms:** Login doesn't work, CORS errors

**Solutions:**
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
2. Check redirect URLs in Supabase dashboard match your domain
3. Ensure site URL in Supabase matches production domain
4. Check browser console for specific error messages

### Issue: Assets not loading

**Symptoms:** 3D models, images don't load

**Solutions:**
1. Verify Supabase storage buckets exist
2. Check RLS policies allow authenticated access
3. Verify CORS settings in Supabase storage
4. Check Content-Security-Policy headers allow Supabase domains

### Issue: Large bundle sizes

**Symptoms:** Slow initial load, large JS files

**Solutions:**
1. Check bundle analyzer: `npm run build -- --analyze`
2. Verify code splitting is working (check `/assets/js/` folder)
3. Consider lazy loading heavy components
4. Review imports - avoid importing entire libraries

## Performance Optimization Tips

### 1. Asset Library Optimization

- Store large 3D models in Supabase storage (not in bundle)
- Use CDN URLs for model loading
- Implement lazy loading for non-critical assets
- Enable Progressive Web App (PWA) for offline access

### 2. Cloudflare Settings

Enable these features in Cloudflare dashboard:

- **Auto Minify:** JS, CSS, HTML
- **Brotli:** Automatic (already enabled)
- **Polish:** Optimize images
- **Mirage:** Lazy-load images
- **HTTP/3:** Enable QUIC protocol
- **Early Hints:** Speed up navigation

### 3. Caching Strategy

Current caching rules (in `_headers`):

- **HTML:** Revalidate on every request (stale-while-revalidate)
- **JS/CSS bundles:** 1 year (immutable, has hash)
- **3D models:** 1 week (stale-while-revalidate 30 days)
- **Images/fonts:** 1 year (immutable)

## Security Best Practices

- ✅ HTTPS enforced on all domains
- ✅ Content Security Policy (CSP) configured
- ✅ Row Level Security (RLS) enabled in Supabase
- ✅ Environment variables never committed to git
- ✅ CORS properly configured
- ✅ XSS protection headers enabled

## Monitoring & Analytics

### Cloudflare Analytics

View in Cloudflare Pages dashboard:
- Total requests
- Bandwidth usage
- Geographic distribution
- Cache hit ratio

### Supabase Analytics

View in Supabase dashboard:
- Database queries
- Storage usage
- Authentication events
- API usage

## Cost Estimate

**Free Tier (Sufficient for MVP):**
- Cloudflare Pages: 500 builds/month, unlimited bandwidth
- Supabase: 500MB database, 1GB storage, 2GB bandwidth
- Custom domain: $10-15/year (one-time cost)

**Total monthly cost: $0** (excluding domain registration)

## Next Steps

After successful deployment:

1. [ ] Set up monitoring and error tracking (Sentry, LogRocket)
2. [ ] Configure custom email provider in Supabase
3. [ ] Set up automated backups for Supabase database
4. [ ] Enable Cloudflare Web Analytics
5. [ ] Configure rate limiting and DDoS protection
6. [ ] Set up CI/CD pipeline for automated testing
7. [ ] Implement feature flags for gradual rollouts

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review Cloudflare Pages docs: https://developers.cloudflare.com/pages/
3. Review Supabase docs: https://supabase.com/docs
4. Check project's GitHub issues
5. Contact team in Slack #dev-blockers channel

---

**Last updated:** 2025-10-23
**Maintained by:** George (Agent 1)
