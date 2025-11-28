# Testing Strategy - kinetiCORE

## Overview

kinetiCORE uses a multi-layered testing approach with different tools for different test types:

- **Unit & Integration Tests**: Vitest (happy-dom environment)
- **UI Component Tests**: Vitest + React Testing Library
- **E2E & Visual Tests**: Playwright
- **Performance Tests**: Playwright

## Test Commands

```bash
# Run unit tests (Vitest)
npm test
npm run test:unit      # Alias for npm test

# Run with coverage
npm run test:coverage

# Run E2E tests (Playwright)
npx playwright test

# Run specific test file
npm test -- tests/kinematics/KinematicsManager.toolingChains.test.ts
```

## Test Organization

### Vitest Tests (Unit/Integration)
**Location:** `src/**/*.test.{ts,tsx}`, `tests/**/*.test.{ts,tsx}`
**Environment:** happy-dom (lightweight DOM emulation)
**Best for:**
- Pure TypeScript logic
- React component rendering (no Canvas/WebGL)
- State management tests
- API/service integration tests

### Playwright Tests (E2E/Visual)
**Location:** `tests/visual/**/*.spec.ts`, `tests/performance/**/*.spec.ts`
**Environment:** Real browser (Chromium, Firefox, WebKit)
**Best for:**
- Full application workflows
- Visual regression testing
- Performance measurement
- Tests requiring WebGL/Canvas APIs

## Test File Naming

- Unit tests: `*.test.ts` or `*.test.tsx`
- E2E tests: `*.spec.ts` (Playwright only)
- Integration tests: `*.test.ts` (can use either framework)

## U112 GOLD Testing

### U112 Pipeline Tests
**Status:** GOLD ✅
**Location:** Protected GOLD pipeline files + supporting tests
**Coverage:**
- Auto-kinematics extraction pipeline
- Joint detection and validation
- Motion classification (prismatic/hinge/fixed)
- ICP-based motion analysis

### U112 Playwright E2E Tests
**Status:** ✅ IMPLEMENTED
**Location:** `tests/e2e/auto-kinematics/u112/`
**Files:**
- `u112-pipeline.spec.ts` - Full auto-fit pipeline test (analyze → capture → fit)
- `u112-motion-panel.spec.ts` - Motion Panel slider control test

**Why Playwright:** Babylon.js requires WebGL APIs not available in happy-dom. Playwright provides a real browser environment with full WebGL support.

**Running U112 E2E tests:**
```bash
# Run all U112 E2E tests
npx playwright test tests/e2e/auto-kinematics/u112/

# Run specific test
npx playwright test tests/e2e/auto-kinematics/u112/u112-pipeline.spec.ts
npx playwright test tests/e2e/auto-kinematics/u112/u112-motion-panel.spec.ts

# Run with UI mode (interactive debugging)
npx playwright test tests/e2e/auto-kinematics/u112/ --ui
```

### U112 Vitest Tests (ARCHIVED)
**Status:** ⚠️ ARCHIVED
**Files:**
- `tests/kinematics/KinematicsManager.toolingChains.test.ts` - Archived (see Playwright)
- `tests/ui/MotionPanel.u112.test.tsx` - Archived (see Playwright)

**Why archived:** Babylon.js requires WebGL APIs not available in happy-dom. These tests have been replaced by Playwright E2E tests with full WebGL support. The Vitest versions are kept for reference but excluded from test runs.

## 016ZF Multi-Hinge Testing

### 016ZF Pipeline Tests
**Status:** ✅ IMPLEMENTED
**Location:** `tests/e2e/auto-kinematics/016ZF/`
**Fixture:** `016ZF_20142435_140_1E1_CI00.glb` (4 moving clamps, 4 hinge joints)

**Files:**
- `016ZF-multi-hinge.spec.ts` - Full multi-hinge pipeline tests

**Coverage:**
- 4 moving units detected after analysis
- 4 hinge joints fitted with valid angles (80-100°)
- Motion Panel shows "All Clamps" aggregate slider
- Individual joint sliders visible for each clamp
- All Clamps slider moves all joints simultaneously

**Running 016ZF E2E tests:**
```bash
# Run all 016ZF tests
npx playwright test tests/e2e/auto-kinematics/016ZF/

# Run specific test
npx playwright test tests/e2e/auto-kinematics/016ZF/016ZF-multi-hinge.spec.ts
```

**Documentation:** See `docs/auto-kinematics/MULTI_HINGE_PIPELINE_016ZF.md` for architecture details.

### Multi-Hinge vs U112 Comparison

| Feature | U112 (Single-Hinge) | 016ZF (Multi-Hinge) |
|---------|---------------------|---------------------|
| Moving units | 1 | 4 |
| Hinge joints | 1 | 4 |
| All Clamps slider | Hidden | Visible |
| Test focus | Core algorithm | Scale/multi-unit |

## Known Issues & Solutions

### Issue: "No test suite found" Errors

**Root Cause:** Babylon.js and other WebGL-dependent libraries cannot run in happy-dom environment due to missing Canvas/WebGL APIs.

**Affected Tests:**
- Tests importing Babylon.js directly
- Tests using 3D scene manipulation
- Tests requiring WebGL context
- Tests with physics engine dependencies

**Current Solution:** These tests are temporarily excluded in `vitest.config.ts`. See lines 38-66 for the full list.

**Long-term Solution:**
1. **Option A:** Migrate to Playwright for browser environment
2. **Option B:** Use jsdom with canvas polyfill
3. **Option C:** Mock Babylon.js imports for unit tests

### Issue: Jest vs Vitest Globals

**Root Cause:** Some test files were written for Jest but the project uses Vitest.

**Solution:** Converted `jest.fn()`, `jest.mock()` to `vi.fn()`, `vi.mock()` in:
- `src/__tests__/buttons/ButtonSystem.test.tsx`
- `src/__tests__/integration/ButtonIntegration.test.tsx`

## Collection Error Resolution

### Original Problem
The project had "collection errors" where Vitest was attempting to load test files with incompatible dependencies, causing the test suite to fail before any tests could run.

### Resolution Steps Taken

1. **Separated Playwright and Vitest configs**
   - Vitest: `vitest.config.ts` - excludes `tests/visual/**` and `tests/performance/**/*.spec.ts`
   - Playwright: `playwright.config.ts` - only runs `tests/visual/**`

2. **Fixed Jest globals**
   - Replaced all `jest.*` calls with `vi.*` equivalents
   - Added proper Vitest imports to test files

3. **Excluded incompatible tests**
   - Temporarily excluded 65+ test files with Babylon.js/WebGL dependencies
   - Added clear comments explaining why and how to fix

### Results
**Before:** 68 failed test files, 0 tests running
**After:** 1 failed test file (timeouts only), 118 tests passing ✅

## Test Environment Configuration

### Vitest Config (`vitest.config.ts`)
```typescript
test: {
  globals: true,
  environment: 'happy-dom',
  setupFiles: ['./src/__tests__/setup.ts'],
  include: [
    'src/**/*.{test,spec}.{ts,tsx}',
    'tests/**/*.{test,spec}.{ts,tsx}',
  ],
  exclude: [
    // Playwright tests
    'tests/visual/**',
    'tests/performance/**/*.spec.ts',
    // Babylon.js-dependent tests (temporarily excluded)
    'tests/babylon/**',
    'tests/kinematics/**',
    'tests/ui/**',
    // ... (see config for full list)
  ],
}
```

### Playwright Config (`playwright.config.ts`)
```typescript
{
  testDir: './tests/visual',
  timeout: 30 * 1000,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
  }
}
```

## GLBLoader Tests Status

### Current State
**File:** `src/loaders/glb/GLBLoader.test.ts`
**Status:** ⚠️ Most tests skipped

**Why skipped:** GLBLoader tests require WebGL/Babylon.js to perform actual GLB file loading. The happy-dom environment used by Vitest cannot provide Canvas/WebGL APIs.

**Which tests are skipped:**
- File validation (reject invalid types, empty files)
- MJCF interface compatibility
- Error handling and fallbacks
- Metadata extraction
- Options handling (progress callbacks, bounds calculation)
- ModelLoader integration

**Which tests still run:**
- Singleton pattern test (no WebGL required)
- Backward compatibility check (no WebGL required)

**Future migration:** These scenarios should be migrated to `tests/e2e/loaders/glb-loader.spec.ts` for full browser WebGL support.

## Tooling Test Helper (`window.__ToolingTestHelper__`)

### Overview
The Tooling Test Helper is a **dev/test-only** global API that provides programmatic access to app internals for E2E testing with Playwright.

**Location:** `src/dev/ToolingTestHelper.ts`

**Availability:**
- ✅ Development mode (`npm run dev`)
- ✅ Playwright E2E tests
- ❌ **NEVER** in production builds

### How It Works
The test helper is automatically attached to `window.__ToolingTestHelper__` after scene initialization in `SceneCanvas.tsx`.

**Attachment code:**
```ts
if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_TOOLING_HELPER === 'true') {
  attachToolingTestHelper({ scene, kinematicsManager });
}
```

### API Interface
```ts
interface ToolingTestHelper {
  u112: {
    setExtendedPose(): Promise<void>;          // Move U112 clamp to extended (~90°)
    loadAutoFittedState(): Promise<void>;      // Load pre-fitted U112 state
    getClampTransform(): Promise<{             // Get U112 clamp transform
      position: number[];
      rotation: number[];
    }>;
  };
  multiHinge: {                                // For 016ZF and other multi-hinge fixtures
    getMovingUnitCount(): number;              // Count of moving units
    getHingeJointCount(): number;              // Count of fitted hinge joints
    setAllClampsExtended(): Promise<void>;     // Set all clamps to extended pose
    setAllClampsRetracted(): Promise<void>;    // Set all clamps to retracted pose
    setClampPosition(                          // Set specific clamp position
      unitIndex: number,
      normalized: number                       // 0 = retracted, 1 = extended
    ): Promise<void>;
    getAllClampTransforms(): Promise<Array<{   // Get all clamp transforms
      unitId: string;
      position: number[];
      rotation: number[];
    }>>;
    getJointInfo(): Array<{                    // Get fitted joint info
      id: string;
      name: string;
      type: string;
      angleDeg: number;
      angleRad: number;
    }>;
  };
  fixtures: {
    listLoadedFixtures(): string[];            // List all loaded fixtures
    getFixtureInfo(rootName: string): unknown; // Get fixture details
  };
}
```

### Usage in Playwright Tests
```ts
// Example: Move U112 clamp to extended pose
await page.evaluate(async () => {
  const win = window as any;
  if (!win.__ToolingTestHelper__) {
    throw new Error('Test helper not available');
  }
  await win.__ToolingTestHelper__.u112.setExtendedPose();
});

// Example: Get clamp transform for assertions
const transform = await page.evaluate(async () => {
  const win = window as any;
  return await win.__ToolingTestHelper__.u112.getClampTransform();
});
console.log('Clamp position:', transform.position);
console.log('Clamp rotation:', transform.rotation);
```

### Implementation Notes
- Uses guard clauses throughout (no `else` statements)
- Provides graceful fallbacks when fixtures/joints not found
- Logs helpful console messages for debugging
- U112-specific helpers check for fitted joints before using FK solver
- Falls back to direct transform manipulation when joints not yet fitted

### Future Extensions
The `fixtures` API is scaffolded for future generic fixture support:
- List all loaded fixtures in the scene
- Query fixture metadata
- Programmatically load fixtures
- Snapshot/restore fixture states

## Future Improvements

### High Priority
1. **Migrate remaining Babylon.js tests to Playwright**
   - ✅ U112 Motion Panel tests (DONE)
   - ✅ Tooling pipeline tests (DONE)
   - ⏳ GLBLoader tests (TODO)
   - ⏳ Scene analysis tests (TODO)

2. **Re-enable excluded tests**
   - Fix import resolution issues
   - Add proper mocks/stubs where appropriate
   - Ensure all tests run in CI

### Medium Priority
3. **Add test fixtures**
   - Sample GLB files for loading tests
   - Mock tooling JSON data
   - Standardized test scenes

4. **Improve test performance**
   - Use test.concurrent for independent tests
   - Add test sharding for CI
   - Optimize heavy imports

## Contributing Tests

### Adding Unit Tests
1. Create test file: `src/path/to/feature.test.ts`
2. Import from vitest: `import { describe, it, expect } from 'vitest'`
3. Guard clauses over nested if/else
4. Keep functions focused and small

### Adding E2E Tests
1. Create test file: `tests/visual/feature.spec.ts`
2. Import from Playwright: `import { test, expect } from '@playwright/test'`
3. Use page object pattern for complex workflows
4. Add visual regression checks where appropriate

### Adding U112 Tests
U112 pipeline code is GOLD and should not be modified. When adding related tests:
1. Do not modify protected files (see `CLAUDE.md`)
2. Test through public APIs only
3. Document golden behavior explicitly
4. Mark as GOLD standard in test comments

## CI/CD Integration

Tests run automatically on every push via GitHub Actions:

```yaml
- run: npm run lint
- run: npm run type-check
- run: npm test
- run: npm run build
```

**Note:** E2E tests do not run in CI yet (requires browser setup).

## Questions?

See:
- `CLAUDE.md` - Project structure and ownership
- `docs/CI_CD.md` - CI/CD pipeline details
- `docs/auto-kinematics/U112_MOTION_PANEL_GOLD.md` - U112 GOLD specifications
