# CI/CD Performance Testing Guide

**Created:** 2025-10-23  
**Owner:** Agent 4  
**Purpose:** Comprehensive guide to automated performance testing in CI/CD

---

## 🎯 Overview

This guide covers the complete CI/CD performance testing infrastructure for kinetiCORE, including automated benchmarks, regression detection, and performance reporting.

---

## 📋 What's Automated

### 1. Performance Benchmarks (Every PR)
- Frame performance validation (60 FPS target)
- Operation timing benchmarks
- Memory usage tracking
- Regression detection

### 2. Lighthouse CI (Every PR)
- Performance score >90
- First Contentful Paint <2s
- Largest Contentful Paint <3s
- Total Blocking Time <300ms

### 3. Bundle Size Checks (Every PR)
- Individual chunk size limits
- Total bundle size <3.5MB
- Regression detection

### 4. Visual Regression (Every PR)
- Screenshot comparison
- UI component rendering
- Cross-browser testing

### 5. Load Testing (Weekly)
- 100+ concurrent objects
- Long-running sessions
- Memory leak detection

---

## 🔧 GitHub Actions Workflows

### Main Workflow: `.github/workflows/performance-tests.yml`

**Triggers:**
- Pull requests to `main`
- Pushes to `main`
- Manual workflow dispatch

**Jobs:**

#### 1. Performance Benchmarks
```yaml
- Runs: npm run test:performance
- Duration: ~5 minutes
- Outputs: benchmark-results.json
- Posts: PR comment with results
```

#### 2. Performance Regression Check
```yaml
- Compares with baseline (main branch)
- Threshold: 10% regression
- Fails PR if regression detected
```

#### 3. Lighthouse CI
```yaml
- Runs: 3 audits per URL
- Asserts: Performance >90
- Uploads: Lighthouse reports
```

#### 4. Bundle Size Check
```yaml
- Analyzes: dist/assets/*.js
- Checks: Individual and total limits
- Posts: PR comment with sizes
```

---

## 📊 Performance Targets

All targets are enforced automatically in CI:

| Metric | Target | Test | Severity |
|--------|--------|------|----------|
| **FPS (50 objects)** | 60 FPS | Regression test | Error |
| **Frame Time (P95)** | <16.67ms | Regression test | Error |
| **Input Latency (P95)** | <50ms | Regression test | Error |
| **IK Solve (single)** | <100ms | Regression test | Error |
| **IK Solve (multi)** | <200ms | Regression test | Error |
| **Lighthouse Performance** | >90 | Lighthouse CI | Error |
| **First Contentful Paint** | <2s | Lighthouse CI | Error |
| **Largest Contentful Paint** | <3s | Lighthouse CI | Error |
| **Total Blocking Time** | <300ms | Lighthouse CI | Error |
| **Bundle Size (total)** | <3.5MB | Bundle check | Warning |
| **Memory (1hr)** | No leaks | Load test | Error |

---

## 🚀 Local Testing

### Run All Performance Tests Locally

```bash
# Install dependencies
npm install

# Run performance benchmarks
npm run test:performance

# Run regression tests
npm run test:regression

# Run load tests
npm run test:load

# Run visual regression tests (requires Playwright)
npm run test:visual

# Check bundle size
npm run check:bundle

# Generate performance report
npm run report:performance
```

### Preview Lighthouse Results

```bash
# Build the project
npm run build

# Start preview server
npm run preview

# In another terminal, run Lighthouse
npm install -g @lhci/cli
lhci autorun
```

---

## 📈 Performance Report

### Automated Report Generation

After running performance tests, generate a comprehensive report:

```bash
npm run report:performance
```

This creates:
- `performance-reports/report.html` - Interactive HTML report
- `performance-reports/report.md` - Markdown summary
- `performance-reports/benchmark-results.json` - Raw data

### Report Contents

**HTML Report includes:**
- Performance summary cards
- Frame performance table
- Operation timing breakdown
- Memory usage charts
- Trend analysis

**Markdown Report includes:**
- Summary table
- Performance metrics
- Comparison with targets
- Status indicators (✅/⚠️)

---

## 🔍 Regression Detection

### How It Works

1. **Baseline Capture:**
   - Tests run on `main` branch
   - Results stored as baseline

2. **PR Testing:**
   - Tests run on PR branch
   - Results compared to baseline

3. **Regression Check:**
   - Difference calculated for each metric
   - Threshold: 10% (configurable)
   - PR fails if threshold exceeded

### Example PR Comment

```markdown
## 📊 Performance Benchmark Results

### Frame Performance
- **Average FPS:** 61.23
- **P95 Frame Time:** 16.12ms
- **Target:** 60 FPS (16.67ms per frame)

### Operations
- **ik-solve:** 45.32ms (P95: 78.91ms)
- **physics-step:** 2.15ms (P95: 3.87ms)
- **entity-sync:** 1.02ms (P95: 1.89ms)

### Memory
- **Current Usage:** 143.25MB
- **Peak Usage:** 187.91MB

### Regression Check
✅ No performance regressions detected

---
*Performance tests run on commit abc1234*
```

---

## 🎨 Visual Regression Testing

### Setup Playwright

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install
```

### Run Visual Tests

```bash
# Run visual regression tests
npm run test:visual

# Update baseline screenshots
npm run test:visual -- --update-snapshots

# Run specific test
npm run test:visual -- homepage

# Run in UI mode
npm run test:visual -- --ui
```

### Visual Test Coverage

- Homepage rendering
- 3D scene canvas
- Performance monitor UI
- Floating panels
- Robot model loading
- IK gizmo display
- Transform panels
- Dark mode
- Responsive layouts (mobile, tablet)

---

## 📦 Bundle Size Monitoring

### Size Limits

Configured in `scripts/check-bundle-size.js`:

```javascript
const SIZE_LIMITS = {
  'vendor-react': 200,       // 200KB
  'vendor-babylon': 1000,    // 1MB
  'vendor-physics': 500,     // 500KB
  'vendor-state': 50,        // 50KB
  'dwg-loader': 1500,        // 1.5MB
  'main': 300,               // 300KB
};

const TOTAL_LIMIT = 3500; // 3.5MB total
```

### How to Fix Bundle Size Issues

**1. Check what increased:**
```bash
npm run check:bundle
```

**2. Analyze bundle:**
```bash
npm run build
# Check dist/bundle-sizes.json
```

**3. Common fixes:**
- Use dynamic imports for large modules
- Enable tree-shaking
- Remove unused dependencies
- Use smaller alternatives

**4. Update limits if justified:**
```javascript
// Only if increase is necessary and justified
SIZE_LIMITS['vendor-babylon'] = 1200; // Increased for new features
```

---

## 🧪 Load Testing

### Test Scenarios

**1. High Object Count (100+ objects)**
```typescript
it('should handle 100 objects', () => {
  // Creates 100 entities
  // Simulates 5 seconds of rendering
  // Validates FPS >55
});
```

**2. Concurrent Operations**
```typescript
it('should handle 100 concurrent IK solves', async () => {
  // Runs 100 IK solves in parallel
  // Validates P95 <100ms
});
```

**3. Long-Running Session**
```typescript
it('should maintain performance over 1 hour', () => {
  // Simulates 1 hour of operation
  // Validates no memory leaks
  // Validates consistent FPS
});
```

**4. Burst Load**
```typescript
it('should handle sudden load spikes', () => {
  // Normal load → spike → recovery
  // Validates system resilience
});
```

---

## 🔧 Troubleshooting

### Tests Failing in CI but Passing Locally

**Possible causes:**
1. Different Node.js version
2. Missing dependencies
3. Timing issues

**Solutions:**
```bash
# Use same Node version as CI
nvm use 18

# Clean install
rm -rf node_modules
npm ci

# Run with CI environment variable
CI=true npm run test:performance
```

### Lighthouse CI Failing

**Common issues:**
1. Preview server not ready
2. Timeout too short
3. Performance regression

**Solutions:**
```yaml
# Increase timeout
webServer:
  timeout: 120000  # 2 minutes

# Ensure server is ready
command: 'npx wait-on http://localhost:4173'
```

### Visual Regression Failures

**Causes:**
1. Legitimate UI changes
2. Font rendering differences
3. Animation timing

**Solutions:**
```bash
# Update baselines if changes are intentional
npm run test:visual -- --update-snapshots

# Disable animations in tests
await expect(page).toHaveScreenshot({ animations: 'disabled' });
```

---

## 📝 Best Practices

### 1. Run Tests Before Pushing

```bash
# Pre-push checklist
npm run lint
npm run type-check
npm test
npm run test:performance
npm run check:bundle
```

### 2. Monitor Performance Trends

- Check performance reports regularly
- Track metrics over time
- Identify gradual degradation

### 3. Set Realistic Targets

- Base targets on actual requirements
- Allow some margin for variance
- Update targets when justified

### 4. Document Changes

When performance changes:
```markdown
## Performance Impact

**Change:** Implemented new IK solver
**Impact:** IK solve time reduced from 85ms to 52ms (39% improvement)
**Evidence:** See performance-reports/comparison.json
```

---

## 🎯 CI/CD Integration Checklist

### Before Merging PR

- [ ] All tests passing
- [ ] No performance regressions (< 10%)
- [ ] Lighthouse score >90
- [ ] Bundle size within limits
- [ ] Visual tests passing
- [ ] Performance report reviewed

### After Merging

- [ ] New baseline created
- [ ] Performance report archived
- [ ] Metrics dashboard updated

---

## 📚 Related Documentation

- [Performance Monitoring Guide](./PERFORMANCE_MONITORING.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Performance Optimization](./PERFORMANCE_OPTIMIZATION.md)

---

## 🔗 Useful Links

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Playwright](https://playwright.dev/)
- [Bundle Size Best Practices](https://web.dev/performance-budgets-101/)

---

**Questions?** Post in `#dev-performance` Slack channel

_Last Updated: 2025-10-23 by Agent 4_
