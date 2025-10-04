# kinetiCORE - Deployment Guide

## Hosting Platform: Cloudflare Pages

### Why Cloudflare Pages?
- **Unlimited bandwidth** (no overage charges for large 3D assets)
- **99.99% uptime SLA** on enterprise CDN
- **<50ms global latency** (200+ edge locations)
- **Optimal for WebGL/WASM** (Babylon.js + Rapier physics)
- **Cost-effective**: $0-60/year for 1-10K users vs $240-2,400/year on competitors

### Cost Projection
| User Scale | Monthly Cost | Annual Cost |
|------------|--------------|-------------|
| 0-1K users | $0 (free tier) | $0 |
| 1K-10K users | $5-15 | $60-180 |
| 10K-50K users | $15-50 | $180-600 |

---

## Prerequisites

1. **Node.js 18+** installed
2. **Cloudflare account** (free): https://dash.cloudflare.com/sign-up
3. **Wrangler CLI** installed:
   ```bash
   npm install -g wrangler
   ```

---

## Initial Setup

### 1. Install Wrangler (if not already installed)
```bash
npm install -D wrangler
```

### 2. Authenticate with Cloudflare
```bash
npx wrangler login
```
This opens a browser to authorize Wrangler with your Cloudflare account.

### 3. Create Cloudflare Pages Project
```bash
# First build the project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=kineticore
```

On first deployment, Wrangler will:
- Create a new Pages project named "kineticore"
- Upload your `dist` folder
- Provide a preview URL: `https://kineticore.pages.dev`

---

## Deployment Workflow

### Preview Deployment (for testing)
```bash
npm run deploy:preview
```
Creates a preview deployment with unique URL for testing changes.

### Production Deployment
```bash
npm run deploy:production
```
Deploys to production (`main` branch).

---

## CI/CD with GitHub Actions

### Automatic deployments on push to main

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: kineticore
          directory: dist
          branch: main
```

### Required GitHub Secrets

Add these in GitHub repo Settings → Secrets and variables → Actions:

1. **CLOUDFLARE_API_TOKEN**
   - Get from: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token" → Use "Edit Cloudflare Workers" template
   - Grant "Account.Cloudflare Pages" permissions

2. **CLOUDFLARE_ACCOUNT_ID**
   - Get from: https://dash.cloudflare.com → Account ID in sidebar

---

## Custom Domain Setup

### 1. Add Domain to Cloudflare
1. Go to https://dash.cloudflare.com
2. Click "Add a Site"
3. Enter your domain (e.g., `kineticore.com`)
4. Update nameservers at your domain registrar

### 2. Connect Domain to Pages
1. Go to Pages → kineticore → Custom domains
2. Click "Set up a custom domain"
3. Enter domain: `app.kineticore.com`
4. Cloudflare automatically configures DNS + SSL

---

## Environment Variables

### Local Development
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your values:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
   VITE_STRIPE_PROFESSIONAL_MONTHLY=price_YOUR_ID
   ```

### Production (Cloudflare Pages)
1. Go to Pages → kineticore → Settings → Environment variables
2. Add each variable:
   - `VITE_STRIPE_PUBLISHABLE_KEY`
   - `VITE_STRIPE_PROFESSIONAL_MONTHLY`
   - etc.

3. Redeploy:
   ```bash
   npm run deploy:production
   ```

---

## Performance Optimization

### Cloudflare Cache Headers (already configured in `wrangler.toml`)

```toml
# Static assets cached for 1 year
[[headers]]
for = "/assets/*"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"

# WASM files optimized
[[headers]]
for = "/*.wasm"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"
Content-Type = "application/wasm"

# 3D model files
[[headers]]
for = "/*.glb"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"
Content-Type = "model/gltf-binary"
```

### Build Optimization
```bash
# Production build with optimization
npm run build

# Analyze bundle size
npx vite-bundle-visualizer
```

---

## Monitoring & Analytics

### Cloudflare Analytics (built-in)
- Go to Pages → kineticore → Analytics
- View: Requests, Bandwidth, Errors, Geographic distribution

### Cloudflare Web Analytics (free, privacy-friendly)
1. Go to https://dash.cloudflare.com → Web Analytics
2. Add site: `kineticore.pages.dev`
3. Copy tracking script
4. Add to `index.html` before `</body>`

---

## Rollback & Version Control

### Rollback to Previous Deployment
1. Go to Pages → kineticore → Deployments
2. Find previous successful deployment
3. Click "..." → "Rollback to this deployment"

### Git-based Workflow
Every deployment is linked to a Git commit, making rollbacks easy:
```bash
git revert HEAD
git push origin main
# Cloudflare auto-deploys the reverted code
```

---

## Troubleshooting

### Build Fails on Cloudflare
**Issue:** TypeScript errors or missing dependencies

**Solution:**
```bash
# Test build locally first
npm run build

# Check for type errors
npm run type-check

# Ensure all dependencies are in package.json (not devDependencies)
```

### 404 Errors on Routes
**Issue:** React Router routes return 404

**Solution:** Add `_redirects` file to `public/`:
```
/* /index.html 200
```

### Large Bundle Size Warning
**Issue:** Bundle > 5MB

**Solution:**
```typescript
// vite.config.ts - add code splitting
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          babylon: ['@babylonjs/core', '@babylonjs/loaders'],
          rapier: ['@dimforge/rapier3d-compat'],
        },
      },
    },
  },
});
```

---

## Cost Monitoring

### Set Budget Alerts
1. Go to Cloudflare Dashboard → Notifications
2. Create alert: "Workers usage exceeds threshold"
3. Set threshold: 10 million requests/month (free tier limit)
4. Add email notification

### Upgrade to Paid Plan (if needed)
When you exceed 100K requests/day:
```bash
# Upgrade via dashboard or CLI
npx wrangler pages publish dist --project-name=kineticore --branch=main
```
Cloudflare automatically bills $5/month when free tier is exceeded.

---

## Production Checklist

Before launching:

- [ ] Custom domain configured
- [ ] SSL certificate active (automatic via Cloudflare)
- [ ] Environment variables set in Cloudflare Pages
- [ ] GitHub Actions CI/CD configured
- [ ] Budget alerts enabled
- [ ] Analytics tracking added
- [ ] Test deployment on preview URL
- [ ] Run performance audit (Lighthouse)
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Document rollback procedure for team

---

## Support Resources

- **Cloudflare Pages Docs:** https://developers.cloudflare.com/pages/
- **Wrangler CLI:** https://developers.cloudflare.com/workers/wrangler/
- **Community Forum:** https://community.cloudflare.com/c/developers/pages/
- **Status Page:** https://www.cloudflarestatus.com/

---

## Estimated Timeline

| Task | Time | Difficulty |
|------|------|------------|
| Initial setup | 15 min | Easy |
| First deployment | 5 min | Easy |
| Custom domain | 30 min | Medium |
| CI/CD setup | 45 min | Medium |
| Stripe integration | 2 hours | Medium |
| **Total** | **~3.5 hours** | |

---

## Next Steps

1. Deploy to Cloudflare Pages (free tier)
2. Test with beta users (<1K requests/day = free)
3. Add custom domain when ready for launch
4. Monitor usage and upgrade to $5/month plan as needed
5. Integrate Stripe for payments (see `STRIPE_SETUP.md`)

**Your hosting costs will be <$60/year while competitors charge $240-2,400/year.** 🚀
