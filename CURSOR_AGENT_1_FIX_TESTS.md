# Cursor Agent 1: Fix Playwright Geometry Tests

**Priority:** 🔥 CRITICAL  
**Time:** 1-2 hours  
**Branch:** `feature/fix-playwright-geometry-tests`

---

## Objective

Fix the 5 failing Playwright geometry tests by replacing programmatic route creation with simple UI interactions.

**Current Issue:** Tests timeout during `page.evaluate()` with complex dynamic imports and command execution.

**New Approach:** Use UI clicks instead of programmatic commands.

---

## Setup

```bash
# Create branch from current feature branch
git checkout feature/smart-routing-system
git pull origin feature/smart-routing-system
git checkout -b feature/fix-playwright-geometry-tests
```

---

## Task

### File to Modify
**`tests/visual/routing-screenshots.spec.ts`** (lines 49-166)

### Current Problem Code (REMOVE THIS):
```typescript
async function createRouteWithGeometryAndLabel(page: Page, type: ...) {
  await ensureCanvasInEssential(page);
  
  // ❌ THIS TIMES OUT - Remove entire page.evaluate() block
  const routeId = await page.evaluate(async (routeType) => {
    const { useRoutingStore } = await import('/src/ui/store/routingStore.ts');
    // ... 100+ lines of complex programmatic setup
  }, type);
  
  await pause(300);
  return routeId;
}
```

### New Approach (IMPLEMENT THIS):

```typescript
async function createRouteWithUIInteractions(page: Page, type: 'electrical' | 'pipe' | 'cable_tray' | 'conduit') {
  // 1. Ensure in Essential mode (canvas is mounted)
  await ensureCanvasInEssential(page);
  
  // 2. Wait for routing toolbar to be ready
  await page.waitForSelector('[data-testid="routing-toolbar"]', { timeout: 5000 });
  
  // 3. Select route type from dropdown
  await page.selectOption('[data-testid="route-type-select"]', type);
  await pause(200);
  
  // 4. Click to create 2 connection points
  const canvas = page.locator('#viewport-essential >> canvas');
  
  // Click Point A (center-left of canvas)
  await canvas.click({
    position: { x: 200, y: 300 },
    force: true
  });
  await pause(300);
  
  // Click Point B (center-right of canvas)
  await canvas.click({
    position: { x: 600, y: 300 },
    force: true
  });
  await pause(300);
  
  // 5. Click "Generate Route" button
  await page.click('[data-testid="generate-route-btn"]', { force: true });
  
  // 6. Wait for route mesh to appear in scene
  await page.waitForFunction((routeType) => {
    const scene = (window as any).sceneManager?.getScene?.();
    if (!scene) return false;
    
    // Check for mesh with route type in name
    const meshes = scene.meshes || [];
    return meshes.some(m => 
      m.name?.toLowerCase().includes(routeType.toLowerCase()) ||
      m.id?.toLowerCase().includes(routeType.toLowerCase())
    );
  }, type, { timeout: 10000 });
  
  // 7. Press 'D' key to toggle debug labels ON
  await page.keyboard.press('d');
  await pause(500); // Wait for label to render
  
  // 8. Verify label is visible
  await page.waitForSelector('.route-debug-label', { timeout: 5000 });
}
```

---

## Implementation Steps

### Step 1: Add Test IDs to UI Components

You'll need to add `data-testid` attributes to these components:

**File:** `src/ui/layouts/ProfessionalModeLayout.tsx` or `EssentialModeLayout.tsx`

```typescript
// Routing toolbar
<div className="routing-toolbar" data-testid="routing-toolbar">
  
  // Route type selector
  <select 
    data-testid="route-type-select"
    value={currentRouteType}
    onChange={handleRouteTypeChange}
  >
    <option value="electrical">Electrical</option>
    <option value="pipe">Pipe</option>
    <option value="cable_tray">Cable Tray</option>
    <option value="conduit">Conduit</option>
  </select>
  
  // Generate button
  <button 
    data-testid="generate-route-btn"
    onClick={handleGenerateRoute}
  >
    Generate Route
  </button>
</div>
```

**File:** `src/routing/ui/RouteDebugLabels.ts`

```typescript
// Add class to label containers
labelContainer.name = 'route-debug-label'; // Babylon.js GUI naming
// Or add CSS class if using HTML overlay
```

### Step 2: Expose SceneManager to Window (for testing)

**File:** `src/scene/SceneManager.ts`

```typescript
export class SceneManager {
  private static instance: SceneManager;
  
  constructor() {
    // ...existing code
    
    // Expose for testing (only in dev mode)
    if (import.meta.env.DEV) {
      (window as any).sceneManager = this;
    }
  }
}
```

### Step 3: Update Test Function

Replace the `createRouteWithGeometryAndLabel` function with the new `createRouteWithUIInteractions` approach.

### Step 4: Update All 5 Geometry Tests

```typescript
test('Geometry: Electrical with label', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await createRouteWithUIInteractions(page, 'electrical');
  await page.screenshot({ path: 'docs/images/routing-electrical-with-label.png' });
});

test('Geometry: Pipe with label', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await createRouteWithUIInteractions(page, 'pipe');
  await page.screenshot({ path: 'docs/images/routing-pipe-with-label.png' });
});

// ... repeat for cable_tray, conduit, mixed
```

---

## Testing

```bash
# Run only geometry tests
npx playwright test tests/visual/routing-screenshots.spec.ts --project=chromium --grep "Geometry"

# Should see:
# ✅ 5/5 passing
# ✅ 5 screenshots generated in docs/images/
```

---

## Success Criteria

- ✅ All 5 geometry tests passing (no timeouts)
- ✅ All 5 screenshots generated automatically
- ✅ Tests complete in <5 minutes total
- ✅ No `page.evaluate()` used
- ✅ TypeScript: 0 errors
- ✅ ESLint: Acceptable

---

## Commit & PR

```bash
git add -A
git commit -m "fix(tests): rewrite geometry tests with UI interactions

Replaced page.evaluate() programmatic approach with simple UI clicks:
- Select route type from dropdown
- Click canvas to place connection points
- Click Generate Route button
- Wait for mesh in scene
- Press D key for debug labels
- Capture screenshot

All 5 geometry tests now passing (was 0/5, now 5/5).
Total test suite: 10/10 passing.

Fixes timeout issues by using DOM interactions instead of dynamic imports.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin feature/fix-playwright-geometry-tests

# Create PR on GitHub
# Title: "fix(tests): rewrite geometry tests with UI interactions"
# Merge into: feature/smart-routing-system
```

---

## Priority

⭐⭐⭐⭐⭐ **HIGHEST PRIORITY**

This unblocks:
- Automated screenshot generation
- CI/CD pipeline
- Complete test coverage (10/10)
- Professional PR presentation

**Start this first!**
