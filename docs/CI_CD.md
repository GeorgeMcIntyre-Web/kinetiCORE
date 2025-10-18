# CI/CD Pipeline Guide

## Overview

kinetiCORE uses GitHub Actions for continuous integration and deployment. Our CI/CD pipeline ensures code quality, prevents broken builds, and provides fast feedback to developers.

## Pipeline Architecture

### Parallel Job Execution

The CI pipeline runs **4 parallel jobs** for maximum speed:

```
┌─────────────────┐
│   Push/PR       │
└────────┬────────┘
         │
    ┌────┴─────┬──────────┬───────────┐
    │          │          │           │
┌───▼───┐  ┌───▼───┐  ┌───▼────┐  ┌───▼────────┐
│ Lint  │  │ Tests │  │ Build  │  │ Bundle Size│
│ Type  │  │Coverage│  │ Verify │  │ Check      │
└───┬───┘  └───┬───┘  └───┬────┘  └───┬────────┘
    │          │          │           │
    └──────────┴──────────┴───────────┘
                   │
              ✅ All Pass
```

---

## Jobs Breakdown

### 1. **Lint & Type Check** (2-3 min)
**Purpose:** Fast feedback on code quality and TypeScript errors

**Steps:**
```bash
npm run lint         # ESLint checks
npm run type-check   # TypeScript compilation
```

**Fails on:**
- ESLint errors
- TypeScript compilation errors
- Unused variables/imports
- Type mismatches

**How to fix locally:**
```bash
npm run lint:fix        # Auto-fix linting issues
npm run type-check      # Check types
```

---

### 2. **Unit Tests** (3-5 min)
**Purpose:** Verify all unit tests pass and track code coverage

**Steps:**
```bash
npm run test:coverage   # Run tests with coverage
```

**Outputs:**
- Test results (pass/fail)
- Code coverage report
- Coverage uploaded to Codecov

**Fails on:**
- Any failing tests
- Test timeouts
- Assertion errors

**How to fix locally:**
```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm run test:coverage       # With coverage
```

---

### 3. **Build** (4-6 min)
**Purpose:** Verify production build succeeds

**Steps:**
```bash
npm run build              # Production build
```

**Outputs:**
- `dist/` directory with production assets
- Build artifacts uploaded (7-day retention)

**Fails on:**
- TypeScript errors (strict mode)
- Vite build errors
- Missing dependencies
- Asset loading failures

**How to fix locally:**
```bash
npm run build              # Test production build
npm run preview            # Preview build locally
```

---

### 4. **Bundle Size Check** (1-2 min)
**Purpose:** Monitor bundle sizes and prevent bloat

**Steps:**
```bash
ls -lh dist/assets/*.js    # Show bundle sizes
```

**Outputs:**
- List of all JavaScript bundles with sizes
- Currently informational only (no size limits enforced)

**Future enhancements:**
- Enforce max bundle sizes
- Track size changes over time
- Alert on significant size increases

---

## When CI Runs

### On Push to `main`
```bash
git push origin main
```
- Runs all 4 jobs
- Must pass before merge
- Prevents broken code in main

### On Pull Request
```bash
# Create PR from feature branch
git push origin feature/my-feature
```
- Runs all 4 jobs
- Shows status in PR
- Must pass before merge approval

---

## CI Status Badges

Add to README:

```markdown
![CI Status](https://github.com/your-org/kineticore/workflows/CI/badge.svg)
[![codecov](https://codecov.io/gh/your-org/kineticore/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/kineticore)
```

---

## Local Pre-Commit Checks

### Recommended Workflow

Before committing, run:

```bash
# Full check (recommended before pushing)
npm run lint && \
npm run type-check && \
npm test && \
npm run build
```

### Quick Check (during development)

```bash
# Fast feedback loop
npm run type-check   # TypeScript only (fastest)
npm test             # Unit tests
```

---

## Troubleshooting CI Failures

### ESLint Failures

**Error:**
```
src/components/MyComponent.tsx
  12:7  error  'value' is assigned but never used  @typescript-eslint/no-unused-vars
```

**Fix:**
```bash
npm run lint:fix          # Auto-fix if possible
# OR manually remove unused variable
```

---

### TypeScript Failures

**Error:**
```
src/components/MyComponent.tsx(45,12): error TS2551:
Property 'attachControls' does not exist on type 'ArcRotateCamera'.
Did you mean 'attachControl'?
```

**Fix:**
```typescript
// Before
camera.attachControls(canvas, true);

// After
camera.attachControl(canvas, true);
```

---

### Test Failures

**Error:**
```
FAIL src/__tests__/MyComponent.test.ts
  ● MyComponent › should render

    expect(received).toBe(expected)
    Expected: true
    Received: false
```

**Fix:**
```bash
npm test -- --watch                    # Run in watch mode
npm test -- MyComponent.test.ts        # Run specific test
npm run test:coverage                  # Check coverage
```

---

### Build Failures

**Error:**
```
ERROR: Build failed with 1 error:
src/components/MyComponent.tsx:12:15: ERROR: Could not resolve "missing-package"
```

**Fix:**
```bash
# Missing dependency
npm install missing-package

# OR check package.json
npm ci                 # Clean install
```

---

## Skipping CI (Emergency Only)

**⚠️ Use with extreme caution!**

```bash
# Skip CI on a commit (NOT recommended)
git commit -m "fix: emergency hotfix [skip ci]"
```

**When to use:**
- Documentation-only changes
- README updates
- Emergency hotfixes (with team approval)

**Never use for:**
- Code changes
- Dependency updates
- Configuration changes

---

## Performance Optimization

### Caching Strategy

The CI uses aggressive caching:

```yaml
- uses: actions/setup-node@v3
  with:
    cache: 'npm'           # Caches node_modules
```

**Benefits:**
- Faster `npm ci` (from ~2min to ~30s)
- Reduced network bandwidth
- More consistent builds

---

## Code Coverage

### Viewing Coverage Reports

**Local:**
```bash
npm run test:coverage
open coverage/index.html      # View HTML report
```

**CI (Codecov):**
- Automatic upload after test job
- View at: `https://codecov.io/gh/your-org/kineticore`
- PR comments show coverage changes

### Coverage Targets

**Current:**
- No minimum coverage enforced
- Tracking trends only

**Future goals:**
- 80% statement coverage
- 70% branch coverage
- Enforce on PRs

---

## Branch Protection Rules

**Recommended settings for `main` branch:**

1. **Require pull request reviews (1 approver)**
2. **Require status checks to pass:**
   - ✅ Lint & Type Check
   - ✅ Unit Tests
   - ✅ Build
   - ✅ Bundle Size Check
3. **Require branches to be up to date**
4. **No force pushes**
5. **No deletions**

**Setup:**
```
Settings → Branches → Add rule → Branch name: main
```

---

## Agent Coordination

### Agent Responsibilities

**Agent 1 (Claude Code - George):**
- Maintains CI/CD pipeline
- Fixes TypeScript compilation issues
- Updates workflow configurations
- Backend integration testing

**Agent 2 (Cursor - Cole/Edwin):**
- Ensures commits pass CI locally before pushing
- Fixes lint/type errors during development
- Reviews CI failures in PRs

**Agent 3 (Cursor - Deployment):**
- Uses CI build artifacts for Cloudflare deployment
- Coordinates with CI pipeline for production builds

---

## Quick Reference

| Check | Local Command | CI Job | Time |
|-------|--------------|--------|------|
| **Lint** | `npm run lint` | Lint & Type Check | ~1 min |
| **Types** | `npm run type-check` | Lint & Type Check | ~1 min |
| **Tests** | `npm test` | Unit Tests | ~3 min |
| **Coverage** | `npm run test:coverage` | Unit Tests | ~3 min |
| **Build** | `npm run build` | Build | ~4 min |
| **All** | Full check | All jobs (parallel) | ~6 min |

---

## Future Enhancements

### Planned Improvements

1. **E2E Testing** (Playwright)
   - Browser-based integration tests
   - Visual regression testing
   - ~10-15 min additional time

2. **Performance Testing**
   - Lighthouse CI
   - Bundle size regression
   - Load time metrics

3. **Security Scanning**
   - npm audit in CI
   - Dependency vulnerability checks
   - SAST tools (CodeQL)

4. **Deployment Automation**
   - Auto-deploy to staging on PR
   - Auto-deploy to production on main merge
   - Rollback capabilities

---

## Support

**CI Failures?**
1. Check the GitHub Actions tab
2. Review job logs for specific errors
3. Run checks locally first
4. Ask in `#dev-blockers` if stuck >1 hour

**CI Performance Issues?**
1. Check if caching is working
2. Review job durations
3. Consider splitting large jobs
4. Report to Agent 1 (George)

---

**Last Updated:** 2025-01-18
**Maintained by:** Agent 1 (Claude Code - George)
