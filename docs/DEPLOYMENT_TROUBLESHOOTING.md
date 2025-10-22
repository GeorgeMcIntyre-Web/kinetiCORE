# Deployment Troubleshooting Guide

Quick reference for fixing common deployment issues on Cloudflare Pages.

## Quick Diagnostics

### Is the build failing?

1. **Check Build Logs**
   - Go to Cloudflare Dashboard → Workers & Pages → kineticore → Deployments
   - Click on the failed deployment → View build log
   - Look for the first error message

2. **Common Error Patterns**
   - `Error: Command failed` → Build script issue
   - `TS2304` → TypeScript error
   - `Cannot find module` → Missing dependency
   - `Expected "," but found` → Invalid JavaScript/JSON in functions/

### Is the deployment slow?

**Normal build times:**
- Dependencies: 10-15s (cached after first build)
- TypeScript: 10-15s
- Vite Build: 15-20s
- **Total: 40-50s**

If >2 minutes, check for:
- Large dependency installations
- Network issues (Cloudflare status page)
- Build output size (should be <10MB)

## Common Errors and Fixes

### 1. TypeScript Compilation Errors

**Error:**
```
src/components/Example.tsx(42,17): error TS2304: Cannot find name 'X'.
```

**Fix:**
```bash
# Find all TypeScript errors locally
npm run type-check

# Fix the errors in your code editor
# Then commit and push
git add .
git commit -m "fix: resolve TypeScript compilation errors"
git push
```

**Prevention:**
- Run `npm run type-check` before every commit
- Use IDE with TypeScript support (VSCode recommended)
- Enable pre-commit hooks (already configured with Husky)

---

### 2. Missing Dependencies

**Error:**
```
Error: Cannot find module 'lodash'
```

**Fix:**
```bash
# Install the missing dependency
npm install lodash

# Or if it's a dev dependency
npm install --save-dev @types/lodash

# Commit and push
git add package.json package-lock.json
git commit -m "fix: add missing lodash dependency"
git push
```

**Prevention:**
- Always commit `package-lock.json`
- Run `npm install` after pulling changes
- Use exact versions in package.json for critical dependencies

---

### 3. Build Script Failure

**Error:**
```
Error: Command "npm run build" exited with 1
```

**Fix:**
```bash
# Test build locally
npm run build

# If it fails locally, debug the error
# If it succeeds locally, check Cloudflare logs

# Common issue: environment-specific paths
# Solution: Use relative paths, not absolute
```

**Check package.json:**
```json
{
  "scripts": {
    "build": "tsc && vite build"  // ✅ Correct
    // Not: "build": "C:/my/path/to/vite build"  // ❌ Wrong
  }
}
```

---

### 4. Invalid Functions Middleware

**Error:**
```
Error: Expected "," but found ";"
```

**Cause:** Invalid JavaScript in `functions/_middleware.js`

**Fix:**
```bash
# Check if functions directory exists
ls -la functions/

# If it contains JSON files, remove them
rm -rf functions/_middleware.js

# Or rename to .json if needed
mv functions/_middleware.js functions/config.json

# Commit and push
git add functions/
git commit -m "fix: remove invalid middleware file"
git push
```

**When to use functions/:**
- Only for Cloudflare Pages Functions (server-side)
- kinetiCORE is a static SPA - **delete functions/ if it exists**

---

### 5. Out of Memory During Build

**Error:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Fix:**

Option 1: Increase Node memory (temporary)
```bash
# Add to package.json
{
  "scripts": {
    "build": "NODE_OPTIONS='--max-old-space-size=4096' tsc && vite build"
  }
}
```

Option 2: Optimize build (permanent)
```bash
# Check bundle size
npm run build -- --mode production

# Analyze what's making it large
npx vite-bundle-visualizer

# Common fixes:
# - Remove unused dependencies
# - Enable code splitting
# - Lazy load large libraries
```

---

### 6. Environment Variables Not Working

**Error:**
```
ReferenceError: process is not defined
```

**Fix:**

Cloudflare Pages uses Vite, which requires `VITE_` prefix:

```typescript
// ❌ Wrong
const apiKey = process.env.API_KEY;

// ✅ Correct
const apiKey = import.meta.env.VITE_API_KEY;
```

**Add in Cloudflare Dashboard:**
1. Settings → Environment variables
2. Add: `VITE_API_KEY` = `your-key-here`
3. Redeploy

---

### 7. Git LFS Files Not Deploying

**Error:**
```
File size exceeds maximum allowed size
```

**Fix:**
```bash
# Cloudflare doesn't support Git LFS
# Solution: Move large files to R2 or external CDN

# Example: Store WASM files in public/
mv large-file.wasm public/assets/

# Update references
# Before: import wasmFile from './large-file.wasm'
# After: const wasmFile = '/assets/large-file.wasm'
```

---

### 8. Deployment Stuck in "Queued"

**Possible Causes:**
- Cloudflare platform issue
- Too many concurrent builds
- Account limits reached

**Fix:**
1. Wait 5 minutes
2. Check [Cloudflare Status](https://www.cloudflarestatus.com/)
3. Cancel and retry deployment
4. Check account limits in dashboard

---

### 9. 404 on Custom Routes (SPA Routing)

**Error:**
User visits `https://kineticore.pages.dev/settings` → 404

**Fix:**

Add `_redirects` file to `public/`:
```bash
# Create public/_redirects
echo "/*    /index.html   200" > public/_redirects

# Commit and push
git add public/_redirects
git commit -m "fix: add SPA redirect for client-side routing"
git push
```

**Or use `_routes.json`:**
```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": []
}
```

---

### 10. Build Succeeds but Site is Broken

**Symptoms:**
- White screen
- Console errors
- Assets not loading

**Debugging Steps:**

1. **Check Browser Console**
   ```
   F12 → Console tab
   Look for 404s or JavaScript errors
   ```

2. **Verify Asset Paths**
   ```bash
   # Check vite.config.ts
   export default defineConfig({
     base: '/',  // ✅ For root deployment
     // Not: base: '/kineticore/'  // ❌ Unless using subdomain
   })
   ```

3. **Test Production Build Locally**
   ```bash
   npm run build
   npm run preview
   # Open http://localhost:4173
   ```

4. **Check for Hardcoded URLs**
   ```typescript
   // ❌ Wrong
   const apiUrl = 'http://localhost:5001/api';

   // ✅ Correct
   const apiUrl = import.meta.env.VITE_API_URL || '/api';
   ```

---

## Emergency Rollback

### Instant Rollback to Previous Version

If the latest deployment broke production:

1. Go to Cloudflare Dashboard → kineticore → Deployments
2. Find last working deployment (green checkmark)
3. Click **···** → **Rollback to this deployment**
4. Confirm → Live immediately

**No rebuild needed** - instant rollback to previous static files.

---

## Testing Before Deployment

### Pre-Push Checklist

Run this **before every git push to main:**

```bash
# Full CI pipeline locally (takes ~1 minute)
npm run lint && npm run type-check && npm test && npm run build

# If all pass, you're good to push
git push origin main
```

### Test Production Build

```bash
# Build exactly as Cloudflare will
npm run build

# Preview production build
npm run preview

# Test in browser
# - http://localhost:4173
# - Check all routes
# - Check console for errors
# - Test main features
```

---

## Getting Help

### 1. Check Build Logs
Always start with build logs - they show the exact error.

### 2. Search GitHub Issues
Someone else may have had the same issue:
https://github.com/GeorgeMcIntyre-Web/kinetiCORE/issues

### 3. Ask the Team
- **Slack:** #deployment-help channel
- **GitHub:** Open an issue with:
  - Build log screenshot
  - Error message
  - What you tried

### 4. Cloudflare Support
For platform-specific issues:
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Discord](https://discord.gg/cloudflaredev)

---

## Deployment Health Checklist

Use this before major releases:

- [ ] `npm run type-check` passes locally
- [ ] `npm run lint` passes locally
- [ ] `npm test` passes locally
- [ ] `npm run build` succeeds locally
- [ ] `npm run preview` shows working site
- [ ] All routes tested in preview
- [ ] No console errors in preview
- [ ] Git commit is clean (no WIP code)
- [ ] PR reviewed and approved
- [ ] CI/CD pipeline passing on GitHub
- [ ] Monitoring set up for production

---

## Advanced Debugging

### Enable Verbose Logging

Add to `package.json` for detailed build output:
```json
{
  "scripts": {
    "build": "tsc --verbose && vite build --debug"
  }
}
```

### Check Bundle Size

```bash
# Analyze what's in your bundle
npx vite-bundle-visualizer

# Check individual file sizes
ls -lh dist/assets/
```

### Inspect Cloudflare Cache

Clear Cloudflare cache if assets aren't updating:
1. Cloudflare Dashboard → Caching
2. Click **Purge Everything**
3. Wait 30 seconds
4. Hard refresh browser (Ctrl+Shift+R)

---

**Last Updated:** October 2025
**Maintainer:** George McIntyre
**For urgent issues:** Check Slack #deployment-help
