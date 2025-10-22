# Cloudflare Pages Deployment Guide

Complete guide for deploying kinetiCORE to Cloudflare Pages with automatic CI/CD.

## Quick Start (5 Minutes)

### Prerequisites
- GitHub repository with kinetiCORE code
- Cloudflare account (free tier works)
- Push access to the repository

### Initial Setup

1. **Connect GitHub to Cloudflare Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to **Workers & Pages** → **Create Application** → **Pages**
   - Click **Connect to Git**
   - Authorize Cloudflare to access your GitHub account
   - Select the `kinetiCORE` repository

2. **Configure Build Settings**
   ```
   Project name: kineticore
   Production branch: main
   Build command: npm run build
   Build output directory: dist
   Root directory: (leave empty)
   ```

3. **Deploy**
   - Click **Save and Deploy**
   - Wait 2-3 minutes for the first build
   - Your site will be live at `https://kineticore.pages.dev`

## Automatic Deployments

Every push to `main` branch automatically triggers:
1. **GitHub Actions CI** (parallel)
   - Linting
   - Type checking
   - Unit tests
   - Build verification

2. **Cloudflare Pages Build** (after CI passes)
   - Fresh dependency installation
   - TypeScript compilation
   - Vite production build
   - Global CDN deployment

**Deployment time:** 2-3 minutes per push

## File Structure

### Important Files for Deployment

```
kinetiCORE/
├── wrangler.toml              # Cloudflare configuration
├── package.json               # Build scripts and dependencies
├── vite.config.ts             # Vite build configuration
├── tsconfig.json              # TypeScript configuration
├── .gitignore                 # Excludes local config files
└── docs/
    └── CLOUDFLARE_DEPLOYMENT.md  # This file
```

### Configuration Files

**`wrangler.toml`**
```toml
# Cloudflare Pages configuration for kinetiCORE
name = "kineticore"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"
```

**`package.json` (build scripts)**
```json
{
  "scripts": {
    "build": "tsc && vite build",
    "build:ci": "npm ci && tsc && vite build"
  }
}
```

## Custom Domains

### Add Your Own Domain

1. Go to Cloudflare Dashboard → Workers & Pages → kineticore
2. Click **Custom domains** tab
3. Click **Set up a custom domain**
4. Enter your domain (e.g., `app.yourcompany.com`)
5. Follow DNS configuration steps
6. Wait for SSL certificate provisioning (~5 minutes)

Your app will be available at both:
- `https://kineticore.pages.dev` (default)
- `https://app.yourcompany.com` (custom)

## Environment Variables

### Adding Environment Variables

If you need to add environment variables (API keys, etc.):

1. Go to Cloudflare Dashboard → Workers & Pages → kineticore
2. Click **Settings** → **Environment variables**
3. Add variables:
   ```
   Variable name: VITE_API_KEY
   Value: your-api-key-here
   ```
4. Click **Save**
5. Redeploy to apply changes

**Important:** Vite environment variables must be prefixed with `VITE_` to be exposed to the client.

## Rollback to Previous Version

### If a Deployment Fails

1. Go to Cloudflare Dashboard → Workers & Pages → kineticore
2. Click **Deployments** tab
3. Find the last successful deployment
4. Click **···** → **Rollback to this deployment**
5. Confirm rollback

**Instant rollback:** Previous version goes live immediately.

## Troubleshooting

### Common Build Errors

#### 1. TypeScript Compilation Errors
```
Error: TS2304: Cannot find name 'X'
```

**Fix:**
```bash
npm run type-check  # Find all TypeScript errors locally
# Fix the errors in your code
git add .
git commit -m "fix: resolve TypeScript errors"
git push
```

#### 2. Missing Dependencies
```
Error: Cannot find module 'X'
```

**Fix:**
```bash
npm install X --save-dev  # Install missing dependency
git add package.json package-lock.json
git commit -m "fix: add missing dependency X"
git push
```

#### 3. Build Script Issues
```
Error: Command not found
```

**Fix:** Ensure `package.json` has correct scripts:
```json
{
  "scripts": {
    "build": "tsc && vite build"
  }
}
```

#### 4. Invalid Functions Middleware
```
Error: Expected "," but found ";"
```

**Fix:** Remove invalid files from `functions/` directory:
```bash
rm -rf functions/_middleware.js  # Only if it contains JSON
git add functions/
git commit -m "fix: remove invalid middleware file"
git push
```

### Viewing Build Logs

1. Go to Cloudflare Dashboard → Workers & Pages → kineticore
2. Click **Deployments** tab
3. Click on any deployment
4. Click **View build log** to see detailed output

### Testing Locally Before Deploying

Always test the production build locally:

```bash
# Run full CI pipeline locally
npm run lint && npm run type-check && npm test && npm run build

# Preview production build
npm run preview

# Open http://localhost:4173 to test
```

## Branch Deployments (Preview URLs)

Cloudflare automatically creates preview deployments for non-main branches:

```bash
git checkout -b feature/new-feature
git push origin feature/new-feature
```

**Preview URL:** `https://abc123.kineticore.pages.dev`
- Automatically created for every branch
- Perfect for testing before merging to main
- Deleted automatically when branch is deleted

## Performance Optimization

### Build Performance Tips

1. **Cache Dependencies:** Cloudflare caches `node_modules` between builds
2. **Parallel Builds:** Multiple builds can run simultaneously
3. **Edge Caching:** Static assets cached globally for fast delivery

### Monitoring Build Times

Typical build times:
- **Dependencies:** 10-15s (cached after first build)
- **TypeScript:** 10-15s
- **Vite Build:** 15-20s
- **Total:** ~40-50s

If builds are slow:
- Check for large dependencies
- Review Vite build config
- Consider build output size

## Security Best Practices

### 1. Never Commit Secrets
```bash
# Add to .gitignore
.env
.env.local
.env.production
*.key
*.pem
```

### 2. Use Environment Variables
Store secrets in Cloudflare Dashboard, not in code:
```typescript
// Good
const apiKey = import.meta.env.VITE_API_KEY;

// Bad
const apiKey = "hardcoded-secret-key";
```

### 3. Review Access Logs
Regularly check Cloudflare Analytics for suspicious activity.

## Cost Estimate

**Cloudflare Pages Pricing (as of 2025):**
- **Free Tier:** 500 builds/month, unlimited requests
- **Paid Plans:** Start at $20/month for unlimited builds

**kinetiCORE Usage:**
- ~30 deployments/month (typical development)
- **Cost:** R0/month (fits in free tier)

## Multi-Developer Workflow

### Recommended Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push and create PR
git push origin feature/my-feature

# 4. Review preview deployment at:
# https://[commit-hash].kineticore.pages.dev

# 5. Merge to main (triggers production deploy)
git checkout main
git pull origin main
```

### Team Permissions

Invite team members in Cloudflare Dashboard:
1. Go to Account → Members
2. Click **Invite**
3. Enter email and select role:
   - **Administrator:** Full access
   - **Developer:** Deploy access
   - **Analytics:** Read-only

## GitHub Actions Integration

kinetiCORE uses GitHub Actions for additional CI checks:

```yaml
# .github/workflows/ci.yml
- Runs lint, type-check, and tests before Cloudflare build
- Prevents broken code from reaching production
- Runs in parallel with Cloudflare build
```

**CI/CD Pipeline:**
```
git push → GitHub Actions CI (parallel) → Cloudflare Build → Live
            ├─ Lint
            ├─ Type Check
            ├─ Unit Tests
            └─ Build Verification
```

## Support and Resources

### Official Documentation
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)

### kinetiCORE Team
- **Questions?** Open a GitHub issue
- **Deployment Issues?** Check build logs first
- **Need Help?** Contact the team in Slack

## Checklist: New Developer Setup

- [ ] Clone repository: `git clone https://github.com/GeorgeMcIntyre-Web/kinetiCORE.git`
- [ ] Install dependencies: `npm install`
- [ ] Test local build: `npm run build`
- [ ] Create feature branch: `git checkout -b feature/your-name`
- [ ] Make changes and test: `npm run dev`
- [ ] Run full CI locally: `npm run lint && npm run type-check && npm test && npm run build`
- [ ] Push and create PR: `git push origin feature/your-name`
- [ ] Review preview deployment
- [ ] Merge to main (after PR approval)
- [ ] Monitor production deployment at https://kineticore.pages.dev

## Wrangler CLI Deployment (Alternative Method)

### Why GitHub Integration is Recommended

**GitHub Integration (Recommended):**
- ✅ Automatic deployments on git push
- ✅ Preview URLs for all branches
- ✅ No local configuration needed
- ✅ Works with CI/CD pipeline
- ✅ Team-friendly (no local setup)

**Wrangler CLI (Advanced Users):**
- ⚠️ Requires local configuration
- ⚠️ Manual deployment process
- ⚠️ Account ID issues common
- ⚠️ API token management needed
- ✅ Good for testing/debugging

### Wrangler CLI Known Issues

#### Issue 1: "your_account_id_here" Placeholder

**Error:**
```
Error: Failed to publish. Reason: account ID is required
```

**Cause:** Wrangler expects `account_id` in `wrangler.toml`, but it's not supported for Pages projects.

**Fix:** Use GitHub integration instead - Wrangler CLI for Pages deployment has limitations.

#### Issue 2: Authentication Issues

**Error:**
```
Error: You must authenticate before running this command
```

**Steps to Debug:**
1. Login: `npx wrangler login`
2. Verify: `npx wrangler whoami`
3. Check account: Should show your email and account

**If still failing:** Wrangler CLI has known bugs with Pages projects. Use GitHub integration.

### When to Use Wrangler CLI

**Good Use Cases:**
- Testing Workers (not Pages)
- Debugging production issues
- Advanced Cloudflare features

**Not Recommended For:**
- Regular deployments (use GitHub)
- Team collaboration (use GitHub)
- kinetiCORE production deploys (use GitHub)

### Wrangler CLI Commands Reference

```bash
# Login to Cloudflare
npx wrangler login

# Check authentication
npx wrangler whoami

# Deploy to Pages (may have issues)
npx wrangler pages deploy dist --project-name=kineticore

# View deployment logs
npx wrangler pages deployment list --project-name=kineticore

# Tail logs
npx wrangler pages deployment tail
```

**Important:** For kinetiCORE, always prefer GitHub integration over Wrangler CLI for deployments.

## Emergency Contacts

**Deployment Issues:**
- George McIntyre (Architecture Lead)
- Check Cloudflare Status: https://www.cloudflarestatus.com/

**Build Failures:**
- Review build logs in Cloudflare Dashboard
- Check GitHub Actions output
- Test locally with `npm run build`

---

**Last Updated:** October 2025
**Maintainer:** George McIntyre
**Project:** kinetiCORE
