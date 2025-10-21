# kinetiCORE Deployment Guide

## Auto-Deployment (Recommended for Production)

Simply push to GitHub - Cloudflare Pages will auto-build and deploy:

```bash
git add .
git commit -m "feat: your changes"
git push origin main
```

**Monitor deployment:**
- Cloudflare Dashboard: https://dash.cloudflare.com/ → Workers & Pages → kineticore
- Live URL: https://kineticore.pages.dev

**Deployment time:** ~2-3 minutes

---

## Manual CLI Deployment (For Quick Debugging)

### Option 1: Local Development Server
```bash
npm run dev
# Opens http://localhost:5173
# Instant reload on file changes
```

### Option 2: Wrangler Pages Dev (Test production build locally)
```bash
npm run build           # Build first
npx wrangler pages dev dist
# Runs production build locally with Cloudflare Pages environment
```

### Option 3: Direct Upload (Workaround for Wrangler bug)

Since `wrangler pages deploy` has an account ID caching bug, use the dashboard:

1. Build locally:
   ```bash
   npm run build
   ```

2. Go to Cloudflare Dashboard:
   - https://dash.cloudflare.com/
   - Workers & Pages → kineticore → Settings
   - Deployments tab → Manual deployment
   - Upload the `dist` folder

---

## CI/CD Pipeline

### GitHub Actions (Automatic)
- Runs on every push to `main`
- Jobs:
  - ✓ Lint & Type Check
  - ✓ Unit Tests
  - ✓ Build Verification
  - ✓ Bundle Size Check

### Cloudflare Pages (Automatic)
- Triggers on every push to `main`
- Build command: `npm run build`
- Output directory: `dist`
- Auto-deploys to: https://kineticore.pages.dev

---

## Deployment Workflow

```
┌─────────────────────────────────────────┐
│  Local Development                      │
├─────────────────────────────────────────┤
│  npm run dev                            │
│  → http://localhost:5173                │
│  → Instant hot-reload                   │
└─────────────────────────────────────────┘
               ↓ (when ready)
┌─────────────────────────────────────────┐
│  git add . && git commit && git push    │
└─────────────────────────────────────────┘
               ↓ (automatic)
┌──────────────┬──────────────────────────┐
│ GitHub       │ Cloudflare Pages         │
│ Actions CI   │ Auto-Build & Deploy      │
│ (2-6 min)    │ (2-3 min)                │
└──────────────┴──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  🌐 https://kineticore.pages.dev        │
│  (Live & deployed!)                     │
└─────────────────────────────────────────┘
```

---

## Debugging Failed Deployments

### 1. Check Cloudflare Build Logs
- Dashboard → kineticore → Deployments → View build log
- Look for TypeScript errors, missing dependencies, or build failures

### 2. Test Build Locally
```bash
# Clean install
rm -rf node_modules
npm install

# Test build
npm run type-check
npm run build

# If successful, push to GitHub
git push origin main
```

### 3. Common Issues

**Issue:** TypeScript errors
```bash
npm run type-check
# Fix errors, then rebuild
```

**Issue:** Missing dependencies
```bash
npm install
git add package-lock.json
git commit -m "chore: update dependencies"
git push
```

**Issue:** Build command fails
- Check `package.json` → `"build"` script
- Current: `"build": "tsc && vite build"`
- Don't include `npm ci` in build script (Cloudflare handles this)

---

## Preview Deployments

Every Pull Request gets an automatic preview deployment:
- Format: `https://[pr-number].kineticore.pages.dev`
- Perfect for testing before merging to main
- Automatically deleted when PR is closed

---

## Environment Variables

To add environment variables for production:

1. Cloudflare Dashboard → kineticore → Settings
2. Environment variables tab
3. Add variables for Production and Preview

Example:
```
VITE_ASSET_API_URL=https://api.kineticore.com
VITE_USE_LOCAL_ASSETS=false
```

---

## Rollback

To rollback to a previous deployment:

1. Cloudflare Dashboard → kineticore → Deployments
2. Find the working deployment
3. Click "..." → Rollback to this deployment

---

## Custom Domain

To add a custom domain (e.g., `app.kineticore.com`):

1. Cloudflare Dashboard → kineticore → Custom domains
2. Click "Set up a custom domain"
3. Enter your domain
4. Add DNS records as instructed
5. Wait for SSL provisioning (~1-2 min)

---

## Cost

**Current Setup:**
- Cloudflare Pages: FREE (unlimited bandwidth!)
- Custom domain: ~R30/month
- Total: **R30/month** (just the domain)

---

## Troubleshooting

**Wrangler CLI not working?**
- Known bug in Wrangler 4.44.0 with account ID caching
- Workaround: Use git push auto-deployment instead
- Or use dashboard manual upload for quick tests

**Build takes too long?**
- Cloudflare caches dependencies - subsequent builds are faster
- First build: ~3-4 min
- Cached builds: ~1-2 min

**Site not updating?**
- Check deployment status in dashboard
- Hard refresh browser: Ctrl+Shift+R (Chrome) or Ctrl+F5
- Clear Cloudflare cache if needed

---

**Last Updated:** 2025-10-21
**Maintained by:** George (Agent 1 - Claude Code)
