# kinetiCORE Deployment Pipeline Guide
**For: George (Agent 1), Cole (Agent 2), Edwin (Agent 3)**

## ✅ Current Status

- **Production URL:** https://kinetic-core.com
- **Cloudflare Pages URL:** https://kineticore-ey1.pages.dev
- **Deployment Status:** ✅ Automated via GitHub Actions
- **SSL:** ✅ Automatic (Cloudflare)
- **CDN:** ✅ Global (Cloudflare)

---

## 🚀 How Deployment Works

### **Automatic Deployment (Recommended)**

Every push to `main` automatically deploys to production:

```bash
# 1. Make your changes
git checkout main
git pull origin main

# 2. Create and test your changes
# ... your work here ...

# 3. Commit and push
git add .
git commit -m "feat: your feature description"
git push origin main

# 4. Deployment happens automatically! ✨
# - GitHub Actions runs tests
# - Builds the app
# - Deploys to Cloudflare Pages
# - Updates https://kinetic-core.com
```

**Timeline:** ~2-3 minutes from push to live

---

## 📋 Deployment Checklist (Before Pushing to Main)

Run these commands locally **BEFORE** pushing to main:

```bash
# 1. Type check (MUST pass)
npm run type-check

# 2. Lint (MUST pass)
npm run lint

# 3. Tests (MUST pass)
npm test

# 4. Build test (MUST pass)
npm run build

# 5. All checks pass? Push to main!
git push origin main
```

**Shortcut - Run all checks:**
```bash
npm run lint && npm run type-check && npm test && npm run build
```

---

## 🔄 Deployment Pipeline Architecture

### **GitHub Actions Workflow**

**File:** `.github/workflows/deploy.yml`

**Triggers:**
- Push to `main` branch
- Manual trigger via GitHub Actions UI

**Steps:**
1. ✅ Checkout code
2. ✅ Setup Node.js 18
3. ✅ Install dependencies (`npm ci`)
4. ✅ Build application (`npm run build`)
5. ✅ Deploy to Cloudflare Pages (production)

**Environment Variables (Set in Cloudflare Pages Dashboard):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase public API key
- `VITE_CLOUDFLARE_WORKER_URL` - Cloudflare Worker proxy URL

---

## 🛠️ Manual Deployment (If Needed)

### **Option 1: Via GitHub Actions (Recommended)**

1. Go to: https://github.com/GeorgeMcIntyre-Web/kinetiCORE/actions
2. Click **"Deploy to Cloudflare Pages"**
3. Click **"Run workflow"** button
4. Select branch: `main`
5. Click **"Run workflow"**

### **Option 2: Via CLI (Advanced)**

```bash
# Build locally
npm run build

# Deploy to production
npx wrangler pages deploy dist --project-name=kineticore --branch=main --commit-dirty=true
```

**Note:** CLI deployments require Cloudflare API token (see Setup section)

---

## ⚙️ Configuration Files

### **1. `.github/workflows/deploy.yml`**
- GitHub Actions workflow
- Triggers on push to `main`
- Uses `CLOUDFLARE_API_TOKEN` secret

### **2. `wrangler.toml`**
```toml
name = "kineticore"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"
```

### **3. `public/_headers`**
- Cloudflare Pages caching rules
- Security headers (CSP, CORS, etc.)
- Long-term caching for assets (1 year)
- Stale-while-revalidate for HTML

### **4. `vite.config.ts`**
- Build optimizations
- Code splitting (React, Babylon.js, Physics, Supabase)
- Terser minification
- Asset organization

---

## 🔐 Secrets Management

### **GitHub Secrets (Required)**

**Location:** https://github.com/GeorgeMcIntyre-Web/kinetiCORE/settings/secrets/actions

**Required Secret:**
- **Name:** `CLOUDFLARE_API_TOKEN`
- **Value:** Cloudflare API token with `Cloudflare Pages:Edit` permission
- **Used by:** `.github/workflows/deploy.yml`

**To rotate token:**
1. Create new token: https://dash.cloudflare.com/profile/api-tokens
2. Use template: "Edit Cloudflare Workers"
3. Copy token
4. Update GitHub secret
5. Delete old token

### **Cloudflare Pages Environment Variables**

**Location:** https://dash.cloudflare.com → Pages → kineticore → Settings → Environment variables

**Production Variables:**
```
VITE_SUPABASE_URL=https://nhkusjsounzwkmevjsgl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_CLOUDFLARE_WORKER_URL=https://kineticore-supabase-proxy.fractalnexustech.workers.dev
NODE_ENV=production
```

**To update:**
1. Go to Settings → Environment variables
2. Choose "Production" environment
3. Click "+ Add variable"
4. Add/update variables
5. Trigger new deployment (push to main)

---

## 📊 Monitoring Deployments

### **1. GitHub Actions Dashboard**
- URL: https://github.com/GeorgeMcIntyre-Web/kinetiCORE/actions
- Shows: Build logs, test results, deployment status
- Notifications: Email on failure (configurable)

### **2. Cloudflare Pages Dashboard**
- URL: https://dash.cloudflare.com → Pages → kineticore → Deployments
- Shows: All deployments, preview/production status
- **Production badge:** Blue "Production" label
- **Preview badge:** Gray "Preview" label

### **3. Deployment Status**

**Check deployment status:**
```bash
# Via curl
curl -I https://kinetic-core.com

# Should return:
# HTTP/1.1 200 OK
# server: cloudflare
```

**Check latest deployment:**
```bash
# Visit Cloudflare Pages dashboard or check GitHub Actions
```

---

## 🚨 Troubleshooting

### **Issue: Deployment Fails in GitHub Actions**

**Symptoms:** Red X on workflow run

**Solutions:**
1. Check workflow logs for errors
2. Verify `CLOUDFLARE_API_TOKEN` is set correctly
3. Test build locally: `npm run build`
4. Check for TypeScript errors: `npm run type-check`
5. Check for lint errors: `npm run lint`

### **Issue: Deployment Succeeds but Site Shows 404**

**Symptoms:** "Deployment Not Found" or blank page

**Solutions:**
1. Check if deployment is marked as "Production" (blue badge)
2. Verify production branch is set to `main` in Cloudflare Pages Settings
3. Wait 1-2 minutes for CDN propagation
4. Clear browser cache (Ctrl+Shift+R)

### **Issue: Custom Domain Not Working**

**Symptoms:** `kinetic-core.com` shows error

**Solutions:**
1. Verify DNS CNAME record: `kinetic-core.com` → `kineticore-ey1.pages.dev`
2. Check Cloudflare Pages → Custom domains → kinetic-core.com is "Active"
3. Wait up to 10 minutes for SSL certificate provisioning
4. Check if production deployment exists (blue "Production" badge)

### **Issue: Environment Variables Not Working**

**Symptoms:** Supabase authentication fails, features broken

**Solutions:**
1. Verify variables are set in Cloudflare Pages dashboard
2. Check variable names start with `VITE_` (required for Vite)
3. Trigger new deployment after adding variables
4. Check browser console for errors

### **Issue: Build Succeeds Locally but Fails in CI**

**Symptoms:** Works on your PC, fails in GitHub Actions

**Solutions:**
1. Check Node.js version matches (18.x)
2. Delete `node_modules` and reinstall: `npm ci`
3. Check for environment-specific code
4. Review build logs in GitHub Actions for specific errors

---

## 👥 Team Workflow

### **George (Agent 1 - Claude Code)**
**Focus:** Backend, integration, architecture

**Typical workflow:**
```bash
git checkout -b feature/physics-improvements
# ... make changes ...
npm run lint && npm run type-check && npm test
git commit -m "feat: improve physics performance"
git push origin feature/physics-improvements
# Create PR → Auto-deploys preview URL
# After approval → Merge to main → Auto-deploys production
```

### **Cole (Agent 2 - Cursor)**
**Focus:** 3D rendering, Babylon.js, scene management

**Typical workflow:**
```bash
git checkout -b feature/new-loader
# ... make changes ...
npm run type-check  # Important for TypeScript
git commit -m "feat: add GLB loader support"
git push origin feature/new-loader
# Create PR → Get preview URL
```

### **Edwin (Agent 3 - Cursor)**
**Focus:** UI/UX, React components

**Typical workflow:**
```bash
git checkout -b feature/settings-panel
# ... make changes ...
npm run lint  # Check React/UI code
git commit -m "feat: add settings panel"
git push origin feature/settings-panel
# Create PR → Preview deployment
```

---

## 🎯 Best Practices

### **1. Always Use Feature Branches**
```bash
# ✅ Good
git checkout -b feature/my-feature
# ... work ...
git push origin feature/my-feature
# Create PR

# ❌ Bad
git checkout main
# ... work ...
git push origin main  # Skips PR review!
```

### **2. Test Before Pushing**
```bash
# Run all checks before push
npm run lint && npm run type-check && npm test && npm run build
```

### **3. Use Descriptive Commit Messages**
```bash
# ✅ Good
git commit -m "feat: add 3D model preview in asset library"
git commit -m "fix: resolve physics body disposal memory leak"

# ❌ Bad
git commit -m "updates"
git commit -m "fix bug"
```

**Format:** `type: description`

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `test:` - Tests
- `chore:` - Build/config changes

### **4. Check Preview Deployments**
Every PR gets a unique preview URL. Test it before merging!

**How to find preview URL:**
1. Create PR
2. Wait for "Deploy to Cloudflare Pages" check
3. Click "Details" → Opens preview URL

### **5. Monitor Production After Deployment**
After merging to main:
1. Wait 2-3 minutes
2. Visit https://kinetic-core.com
3. Test critical features
4. Check browser console for errors

---

## 📈 Performance Optimizations

### **Build Output (Current)**
```
dist/
├── index.html (4.90 kB → 1.62 kB gzipped)
├── assets/
│   ├── js/
│   │   ├── vendor-react-*.js (312 KB → 92 KB gzipped)
│   │   ├── vendor-supabase-*.js (164 KB → 41 KB gzipped)
│   │   ├── vendor-babylon-core-*.js (5.8 MB → 1.27 MB gzipped)
│   │   ├── vendor-physics-*.js (1.99 MB → 721 KB gzipped)
│   │   └── index-*.js (1.3 MB → 247 KB gzipped)
│   └── index-*.css (220 KB → 34 KB gzipped)
```

**Compression:** ~74% (19 MB → 4.5 MB gzipped)

### **Caching Strategy**
- **HTML:** Revalidate on every request (stale-while-revalidate)
- **JS/CSS:** 1 year cache (immutable, content-hashed filenames)
- **Images/Fonts:** 1 year cache
- **3D Models:** 1 week cache (stale-while-revalidate 30 days)

### **CDN Features (Cloudflare)**
- ✅ **Brotli compression** (automatic)
- ✅ **HTTP/3** (QUIC)
- ✅ **Auto minify** (HTML, CSS, JS)
- ✅ **Global edge network** (300+ locations)

---

## 🔗 Quick Links

### **Dashboards**
- **Production Site:** https://kinetic-core.com
- **GitHub Repo:** https://github.com/GeorgeMcIntyre-Web/kinetiCORE
- **GitHub Actions:** https://github.com/GeorgeMcIntyre-Web/kinetiCORE/actions
- **Cloudflare Pages:** https://dash.cloudflare.com/99a4abb2620e21383c0710dacf97180e/pages/view/kineticore
- **Cloudflare DNS:** https://dash.cloudflare.com/99a4abb2620e21383c0710dacf97180e/kinetic-core.com/dns/records

### **Documentation**
- **Full Deployment Guide:** [docs/DEPLOYMENT.md](DEPLOYMENT.md)
- **Project Instructions:** [CLAUDE.md](../CLAUDE.md)
- **CI/CD Guide:** [docs/CI_CD.md](CI_CD.md)

### **External Services**
- **Supabase Dashboard:** https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl
- **Cloudflare API Tokens:** https://dash.cloudflare.com/profile/api-tokens

---

## 🆘 Emergency Procedures

### **Rollback to Previous Deployment**

If production is broken, rollback immediately:

1. Go to: https://dash.cloudflare.com → Pages → kineticore → Deployments
2. Find the last working "Production" deployment
3. Click **three dots (•••)** → **"Rollback to this deployment"**
4. Confirm rollback
5. Site reverts in ~30 seconds

### **Hotfix Procedure**

For critical production bugs:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix the bug
# ... make minimal changes ...

# 3. Test thoroughly
npm run lint && npm run type-check && npm test && npm run build

# 4. Fast-track PR
git push origin hotfix/critical-bug
# Create PR with "HOTFIX:" prefix
# Get quick review
# Merge to main

# 5. Monitor deployment
# Watch GitHub Actions
# Verify fix at https://kinetic-core.com
```

### **Disable Auto-Deployment (Emergency)**

If you need to stop auto-deployments:

1. Go to: https://github.com/GeorgeMcIntyre-Web/kinetiCORE/settings/actions
2. Click **"Disable Actions"**
3. Manual deployments still work via Cloudflare dashboard

**Re-enable:**
1. Same page → **"Enable Actions"**

---

## ✅ Summary

**What you need to remember:**

1. **Push to main = auto-deploy to production** (~2-3 min)
2. **Always test locally before pushing** (lint + typecheck + test + build)
3. **Use feature branches + PRs** (gets preview URL)
4. **Check GitHub Actions for deployment status**
5. **Monitor https://kinetic-core.com after deployment**

**Questions?** Check [docs/DEPLOYMENT.md](DEPLOYMENT.md) or ask in Slack #dev-help

---

**Last Updated:** 2025-10-24
**Pipeline Status:** ✅ Production Ready
**Maintained By:** George (Agent 1)
